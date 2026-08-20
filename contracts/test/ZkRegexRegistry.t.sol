// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {console2} from "forge-std/console2.sol";
import {MarketTestBase} from "./MarketTestBase.sol";
import {HeadlineMarket} from "../src/market/HeadlineMarket.sol";
import {FPMM} from "../src/market/FPMM.sol";
import {CompiledEmailProof} from "../src/zkemail/IZKEmail.sol";
import {IGroth16Verifier, ZkRegexVerifierRegistry} from "../src/zkemail/ZkRegexVerifierRegistry.sol";

/// @dev Stand-in Groth16 verifier: accepts iff pA[0] == 42 and the public signal is
/// the expected binding — enough to prove the hybrid wiring (real proofs are
/// exercised by the node integration test against the actual generated verifier).
contract FakeGroth16Verifier is IGroth16Verifier {
    uint256 public immutable expectedBinding;

    constructor(uint256 _expectedBinding) {
        expectedBinding = _expectedBinding;
    }

    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[1] calldata pubSignals
    ) external view returns (bool) {
        return pA[0] == 42 && pubSignals[0] == expectedBinding;
    }
}

contract ZkRegexRegistryTest is MarketTestBase {
    string constant FED_PATTERN = "(?i)fed (cuts|lowers|slashes) (interest )?rates";
    string constant NYT_FROM = "^nytdirect@nytimes\\.com$";

    function pairHashes() internal pure returns (bytes32 fromHash, bytes32 contentHash) {
        fromHash = keccak256(bytes(NYT_FROM));
        contentHash = keccak256(abi.encodePacked(uint8(HeadlineMarket.ContentField.SubjectOrBody), FED_PATTERN));
    }

    function test_RegistryIsWriteOnce() public {
        (bytes32 fromHash, bytes32 contentHash) = pairHashes();
        FakeGroth16Verifier v = new FakeGroth16Verifier(0);
        circuitRegistry.register(fromHash, contentHash, v);
        assertEq(address(circuitRegistry.verifierFor(fromHash, contentHash)), address(v));

        // nobody can swap in a different verifier afterwards
        FakeGroth16Verifier attacker = new FakeGroth16Verifier(0);
        vm.expectRevert(bytes("Registry: pair already registered"));
        circuitRegistry.register(fromHash, contentHash, attacker);
    }

    function test_RegisteredCircuitDisablesMockFallback() public {
        (HeadlineMarket market,) = createDefaultMarket();

        // Build a mock-style compiled proof (keccak "proof"). Without a circuit it
        // verifies via the fallback…
        CompiledEmailProof memory mockProof = makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            NYT_FROM,
            HeadlineMarket.ContentField.SubjectOrBody,
            FED_PATTERN,
            "m1"
        );
        (bool okBefore,) = market.checkCompiledProof(0, mockProof);
        assertTrue(okBefore, "mock fallback should verify before a circuit exists");

        // …but once a real circuit is registered for the pair, mock proofs are dead:
        // the pattern pair now REQUIRES a Groth16 proof.
        (bytes32 fromHash, bytes32 contentHash) = pairHashes();
        uint256 binding = verifier.bindingOf(mockProof);
        circuitRegistry.register(fromHash, contentHash, new FakeGroth16Verifier(binding));

        (bool okAfter, string memory reason) = market.checkCompiledProof(0, mockProof);
        assertFalse(okAfter, "mock proof must be rejected once the circuit exists");
        assertEq(reason, "invalid zkemail proof");

        // and a (fake-)Groth16 proof with the right binding + shape passes
        uint256[2] memory a = [uint256(42), 0];
        uint256[2][2] memory b;
        uint256[2] memory c;
        mockProof.proof = abi.encode(a, b, c);
        (bool okReal,) = market.checkCompiledProof(0, mockProof);
        assertTrue(okReal, "well-formed Groth16 proof with correct binding verifies");

        // wrong-shape proof bytes are rejected cleanly
        mockProof.proof = hex"deadbeef";
        (bool okBad,) = market.checkCompiledProof(0, mockProof);
        assertFalse(okBad);

        // full settlement through the real-verifier path
        mockProof.proof = abi.encode(a, b, c);
        market.submitCompiledProof(0, mockProof);
        assertTrue(market.sourceMatched(0));
    }

    function test_BindingCommitsToAllIdentityFields() public {
        CompiledEmailProof memory p = makeCompiledProof(
            "nytimes.com",
            block.timestamp + 1 days,
            NYT_FROM,
            HeadlineMarket.ContentField.SubjectOrBody,
            FED_PATTERN,
            "b1"
        );
        uint256 base = verifier.bindingOf(p);
        p.timestamp += 1;
        assertTrue(verifier.bindingOf(p) != base, "timestamp must change the binding");
        p.timestamp -= 1;
        p.emailNullifier = "b2";
        assertTrue(verifier.bindingOf(p) != base, "nullifier must change the binding");
    }

    function test_CloneMarketCreationGas() public {
        uint256 g = gasleft();
        createDefaultMarket();
        console2.log("createMarket (EIP-1167 clones, no liquidity):", g - gasleft());
    }
}
