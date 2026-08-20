// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {console2} from "forge-std/console2.sol";
import {MarketTestBase} from "./MarketTestBase.sol";
import {HeadlineMarket} from "../src/market/HeadlineMarket.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {FPMM} from "../src/market/FPMM.sol";
import {CompiledEmailProof, EmailProof} from "../src/zkemail/IZKEmail.sol";

/// @notice The compiled zk-regex settlement path (backlog E1/A3): pattern commitments
/// instead of onchain regex, event-only evidence, no email content in calldata.
contract CompiledProofTest is MarketTestBase {
    HeadlineMarket market;
    FPMM fpmm;

    string constant FED_PATTERN = "(?i)fed (cuts|lowers|slashes) (interest )?rates";
    string constant FED_SUBJECT = "Breaking News: Fed cuts rates by 50 basis points";

    function setUp() public override {
        super.setUp();
        (market, fpmm) = createDefaultMarket();
    }

    function nytCompiled(bytes32 nullifier) internal view returns (CompiledEmailProof memory) {
        return makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            "^nytdirect@nytimes\\.com$", // the market's configured from pattern
            HeadlineMarket.ContentField.SubjectOrBody,
            FED_PATTERN, // the market's default content pattern
            nullifier
        );
    }

    function wapoCompiled(bytes32 nullifier) internal view returns (CompiledEmailProof memory) {
        return makeCompiledProof(
            "email.washingtonpost.com",
            block.timestamp + 1 days,
            "@email\\.washingtonpost\\.com$",
            HeadlineMarket.ContentField.SubjectOrBody,
            FED_PATTERN,
            nullifier
        );
    }

    function test_CompiledProofSettlesMarket() public {
        CompiledEmailProof memory p1 = nytCompiled("c1");
        CompiledEmailProof memory p2 = wapoCompiled("c2");

        vm.prank(settler);
        market.submitCompiledProof(0, p1);
        assertEq(market.matchedCount(), 1);
        assertTrue(market.sourceMatched(0));

        vm.prank(settler);
        market.submitCompiledProof(1, p2);
        assertEq(uint256(market.resolution()), uint256(HeadlineMarket.Resolution.Yes));
        assertEq(ct.payoutNumerators(market.conditionId(), 0), 1);
        // evidence is event-only on this path: no storage rows
        assertEq(market.getEvidence().length, 0);
    }

    function test_MixedPathsReachThreshold() public {
        // one transparent (interpreted) proof + one compiled proof
        EmailProof memory interpreted = makeProof(
            "nytimes.com", block.timestamp + 1 days, "nytdirect@nytimes.com", FED_SUBJECT, "", "m1"
        );
        market.submitProof(0, interpreted);

        CompiledEmailProof memory compiled = wapoCompiled("m2");
        market.submitCompiledProof(1, compiled);
        assertEq(uint256(market.resolution()), uint256(HeadlineMarket.Resolution.Yes));
    }

    function test_RejectsWrongPatternCommitments() public {
        // right domain/timestamps, but the circuit enforced a DIFFERENT content pattern
        CompiledEmailProof memory p = makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            "^nytdirect@nytimes\\.com$",
            HeadlineMarket.ContentField.SubjectOrBody,
            "(?i)totally different pattern",
            "w1"
        );
        vm.expectRevert(bytes("Market: wrong content circuit"));
        market.submitCompiledProof(0, p);

        // wrong from pattern
        CompiledEmailProof memory p2 = makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            "@nytimes\\.com$",
            HeadlineMarket.ContentField.SubjectOrBody,
            FED_PATTERN,
            "w2"
        );
        vm.expectRevert(bytes("Market: wrong from circuit"));
        market.submitCompiledProof(0, p2);

        // wrong content FIELD (Subject vs SubjectOrBody) changes the commitment too
        CompiledEmailProof memory p3 = makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            "^nytdirect@nytimes\\.com$",
            HeadlineMarket.ContentField.Subject,
            FED_PATTERN,
            "w3"
        );
        vm.expectRevert(bytes("Market: wrong content circuit"));
        market.submitCompiledProof(0, p3);
    }

    function test_RejectsTamperedCompiledProof() public {
        CompiledEmailProof memory p = nytCompiled("t1");
        p.timestamp += 1; // outputs changed after proving
        vm.expectRevert(bytes("Market: invalid zkemail proof"));
        market.submitCompiledProof(0, p);
    }

    function test_NullifierSharedAcrossPaths() public {
        // an email consumed by the interpreted path cannot be replayed via the compiled
        // path (same nullifier space)
        EmailProof memory interpreted = makeProof(
            "nytimes.com", block.timestamp + 1 days, "nytdirect@nytimes.com", FED_SUBJECT, "", "shared"
        );
        market.submitProof(0, interpreted);

        CompiledEmailProof memory compiled = wapoCompiled("shared");
        vm.expectRevert(bytes("Market: email already used"));
        market.submitCompiledProof(1, compiled);
    }

    function test_CompiledProofRespectsWindow() public {
        CompiledEmailProof memory late = makeCompiledProof(
            "nytimes.com",
            uint256(market.deadline()) + 1,
            "^nytdirect@nytimes\\.com$",
            HeadlineMarket.ContentField.SubjectOrBody,
            FED_PATTERN,
            "l1"
        );
        vm.expectRevert(bytes("Market: email after deadline"));
        market.submitCompiledProof(0, late);
    }

    function test_CheckCompiledProofReasons() public view {
        CompiledEmailProof memory good = nytCompiled("d1");
        (bool ok, string memory reason) = market.checkCompiledProof(0, good);
        assertTrue(ok);
        assertEq(reason, "");

        (ok, reason) = market.checkCompiledProof(1, good); // NYT proof against WaPo slot
        assertFalse(ok);
        assertEq(reason, "wrong DKIM domain");
    }

    function test_PerSourceOverrideCommitment() public {
        // a source with its own contentRegex commits to the OVERRIDE, not the default
        MarketFactory.CreateMarketParams memory params = defaultParams();
        params.sources[0].contentRegex = "(?i)federal reserve (cuts|lowers)";
        params.threshold = 1;
        (HeadlineMarket m2,) = factory.createMarket(params);

        CompiledEmailProof memory withDefault = makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            "^nytdirect@nytimes\\.com$",
            HeadlineMarket.ContentField.SubjectOrBody,
            FED_PATTERN,
            "o1"
        );
        vm.expectRevert(bytes("Market: wrong content circuit"));
        m2.submitCompiledProof(0, withDefault);

        CompiledEmailProof memory withOverride = makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            "^nytdirect@nytimes\\.com$",
            HeadlineMarket.ContentField.SubjectOrBody,
            "(?i)federal reserve (cuts|lowers)",
            "o2"
        );
        m2.submitCompiledProof(0, withOverride);
        assertEq(uint256(m2.resolution()), uint256(HeadlineMarket.Resolution.Yes));
    }

    /// Gas: interpreted (onchain regex + content calldata + evidence storage) vs
    /// compiled (commitment checks + event). Logged so the numbers land in CI output.
    function test_GasComparison_InterpretedVsCompiled() public {
        EmailProof memory interpreted = makeProof(
            "nytimes.com",
            block.timestamp + 1 days,
            "nytdirect@nytimes.com",
            FED_SUBJECT,
            // realistic body excerpt so the interpreted figure is honest
            "The Federal Reserve cut its benchmark interest rate by half a percentage point on"
            " Wednesday, an emergency step that underscored mounting concern about cracks in"
            " the labor market and tightening credit conditions.",
            "g1"
        );
        uint256 gasBefore = gasleft();
        market.submitProof(0, interpreted);
        uint256 interpretedGas = gasBefore - gasleft();

        CompiledEmailProof memory compiled = wapoCompiled("g2");
        gasBefore = gasleft();
        market.submitCompiledProof(1, compiled); // note: this one also resolves + reports payouts
        uint256 compiledGas = gasBefore - gasleft();

        console2.log("submitProof (interpreted, regex onchain):", interpretedGas);
        console2.log("submitCompiledProof (incl. YES resolution):", compiledGas);
        assertLt(compiledGas, interpretedGas / 4, "compiled path should be dramatically cheaper");
    }
}
