// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ConditionalTokens} from "../src/tokens/ConditionalTokens.sol";
import {TestUSDC} from "../src/tokens/TestUSDC.sol";
import {IERC20} from "../src/tokens/ERC20.sol";
import {MockDKIMRegistry} from "../src/zkemail/MockDKIMRegistry.sol";
import {MockZKEmailVerifier} from "../src/zkemail/MockZKEmailVerifier.sol";
import {CompiledEmailProof, EmailProof} from "../src/zkemail/IZKEmail.sol";
import {HeadlineMarket} from "../src/market/HeadlineMarket.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {MarketDeployer, FPMMDeployer} from "../src/market/Deployers.sol";
import {FPMM} from "../src/market/FPMM.sol";

/// @notice Shared fixture: deploys the whole stack and provides a Solidity-side
/// mock prover mirroring scripts/prove-email.mjs.
contract MarketTestBase is Test {
    ConditionalTokens ct;
    TestUSDC usdc;
    MockDKIMRegistry dkim;
    MockZKEmailVerifier verifier;
    MarketFactory factory;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address settler = makeAddr("settler");

    function setUp() public virtual {
        ct = new ConditionalTokens();
        usdc = new TestUSDC();
        dkim = new MockDKIMRegistry();
        verifier = new MockZKEmailVerifier(dkim);
        factory = new MarketFactory(ct, verifier, new MarketDeployer(), new FPMMDeployer());

        dkim.registerMockKey("nytimes.com");
        dkim.registerMockKey("email.washingtonpost.com");
        dkim.registerMockKey("email.reuters.com");

        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);
        usdc.mint(carol, 1_000_000e6);
    }

    /// @dev Mirrors the JS mock prover: proof = keccak256(abi.encode(PROOF_DOMAIN, outputs)).
    function makeProof(
        string memory domain,
        uint256 timestamp,
        string memory from,
        string memory subject,
        string memory body,
        bytes32 nullifier
    ) internal view returns (EmailProof memory p) {
        p.domainName = domain;
        p.publicKeyHash = dkim.mockKeyHash(domain);
        p.timestamp = timestamp;
        p.fromAddress = from;
        p.subject = subject;
        p.bodyExcerpt = body;
        p.emailNullifier = nullifier;
        p.proof = abi.encodePacked(
            keccak256(
                abi.encode(
                    verifier.PROOF_DOMAIN(),
                    p.domainName,
                    p.publicKeyHash,
                    p.timestamp,
                    p.fromAddress,
                    p.subject,
                    p.bodyExcerpt,
                    p.emailNullifier
                )
            )
        );
    }

    /// @dev Mirrors the JS prover's buildCompiledProof: the patterns are "compiled into
    /// the circuit", so the proof carries pattern commitments instead of email content.
    function makeCompiledProof(
        string memory domain,
        uint256 timestamp,
        string memory fromRegex,
        HeadlineMarket.ContentField field,
        string memory contentPattern,
        bytes32 nullifier
    ) internal view returns (CompiledEmailProof memory p) {
        p.domainName = domain;
        p.publicKeyHash = dkim.mockKeyHash(domain);
        p.timestamp = timestamp;
        p.fromPatternHash = keccak256(bytes(fromRegex));
        p.contentPatternHash = keccak256(abi.encodePacked(uint8(field), contentPattern));
        p.emailNullifier = nullifier;
        p.proof = abi.encodePacked(
            keccak256(
                abi.encode(
                    verifier.COMPILED_PROOF_DOMAIN(),
                    p.domainName,
                    p.publicKeyHash,
                    p.timestamp,
                    p.fromPatternHash,
                    p.contentPatternHash,
                    p.emailNullifier
                )
            )
        );
    }

    function nytSources() internal pure returns (HeadlineMarket.Source[] memory sources) {
        sources = new HeadlineMarket.Source[](3);
        sources[0] = HeadlineMarket.Source({
            name: "The New York Times",
            dkimDomain: "nytimes.com",
            fromRegex: "^nytdirect@nytimes\\.com$",
            contentRegex: ""
        });
        sources[1] = HeadlineMarket.Source({
            name: "The Washington Post",
            dkimDomain: "email.washingtonpost.com",
            fromRegex: "@email\\.washingtonpost\\.com$",
            contentRegex: ""
        });
        sources[2] = HeadlineMarket.Source({
            name: "Reuters",
            dkimDomain: "email.reuters.com",
            fromRegex: "@email\\.reuters\\.com$",
            contentRegex: ""
        });
    }

    function defaultParams() internal view returns (MarketFactory.CreateMarketParams memory params) {
        params = MarketFactory.CreateMarketParams({
            question: "Will the Fed cut rates before October 2026?",
            description: "Resolves YES if 2 of 3 sources (NYT, WaPo, Reuters) email a breaking-news"
                " alert matching the pattern before the deadline.",
            contentRegex: "(?i)fed (cuts|lowers|slashes) (interest )?rates",
            contentField: HeadlineMarket.ContentField.SubjectOrBody,
            sources: nytSources(),
            threshold: 2,
            windowStart: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 30 days),
            resolutionBuffer: 1 days,
            collateralToken: IERC20(address(usdc)),
            fee: 2e16, // 2%
            initialLiquidity: 0,
            distributionHint: new uint256[](0)
        });
    }

    function createDefaultMarket() internal returns (HeadlineMarket market, FPMM fpmm) {
        (market, fpmm) = factory.createMarket(defaultParams());
    }

    function createFundedMarket(uint256 liquidity) internal returns (HeadlineMarket market, FPMM fpmm) {
        MarketFactory.CreateMarketParams memory params = defaultParams();
        params.initialLiquidity = liquidity;
        vm.startPrank(alice);
        usdc.approve(address(factory), liquidity);
        (market, fpmm) = factory.createMarket(params);
        vm.stopPrank();
    }
}
