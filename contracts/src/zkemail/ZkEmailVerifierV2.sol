// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CompiledEmailProof, EmailProof, IDKIMRegistry, IZKEmailVerifier, IZkRegexVerifier} from "./IZKEmail.sol";
import {IGroth16Verifier, ZkRegexVerifierRegistry} from "./ZkRegexVerifierRegistry.sol";

/// @title ZkEmailVerifierV2
/// @notice The verifier markets talk to, with a REAL Groth16 path (backlog A3):
///
/// - `verify` (transparent path): mock keccak check, as before — the DKIM-RSA
///   circuit is backlog A1 and stays mocked.
/// - `verifyCompiled`: if the proof's pattern pair has a compiled circuit in the
///   ZkRegexVerifierRegistry, the proof bytes MUST be a real Groth16 proof and are
///   verified with an onchain pairing check against that circuit's verifying key,
///   with public input `binding = keccak(domain, pubkeyHash, timestamp, nullifier)
///   mod r` binding the zk proof to the claimed email identity. Only if NO circuit
///   is registered does it fall back to the mock keccak check, so markets over
///   yet-uncompiled patterns still settle in dev.
contract ZkEmailVerifierV2 is IZKEmailVerifier, IZkRegexVerifier {
    bytes32 public constant PROOF_DOMAIN = keccak256("ZKEMAIL_MOCK_PROOF_V1");
    bytes32 public constant COMPILED_PROOF_DOMAIN = keccak256("ZKEMAIL_MOCK_COMPILED_PROOF_V1");
    /// BN254 scalar field modulus (public inputs must be field elements)
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IDKIMRegistry public immutable dkimRegistry;
    ZkRegexVerifierRegistry public immutable circuitRegistry;

    constructor(IDKIMRegistry _dkimRegistry, ZkRegexVerifierRegistry _circuitRegistry) {
        dkimRegistry = _dkimRegistry;
        circuitRegistry = _circuitRegistry;
    }

    // ------------------------------------------------------------------
    // Transparent path (mock — real DKIM circuit is backlog A1)
    // ------------------------------------------------------------------

    function verify(EmailProof calldata p) external view returns (bool) {
        if (!dkimRegistry.isDKIMPublicKeyHashValid(p.domainName, p.publicKeyHash)) {
            return false;
        }
        bytes32 expected = keccak256(
            abi.encode(
                PROOF_DOMAIN,
                p.domainName,
                p.publicKeyHash,
                p.timestamp,
                p.fromAddress,
                p.subject,
                p.bodyExcerpt,
                p.emailNullifier
            )
        );
        return p.proof.length == 32 && bytes32(p.proof) == expected;
    }

    // ------------------------------------------------------------------
    // Compiled path (REAL Groth16 when a circuit is registered)
    // ------------------------------------------------------------------

    function verifyCompiled(CompiledEmailProof calldata p) external view returns (bool) {
        if (!dkimRegistry.isDKIMPublicKeyHashValid(p.domainName, p.publicKeyHash)) {
            return false;
        }
        IGroth16Verifier groth16 = circuitRegistry.verifierFor(p.fromPatternHash, p.contentPatternHash);
        if (address(groth16) != address(0)) {
            // Real pairing check. Proof bytes = abi.encode(uint[2] a, uint[2][2] b, uint[2] c).
            if (p.proof.length != 256) return false;
            (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) =
                abi.decode(p.proof, (uint256[2], uint256[2][2], uint256[2]));
            uint256[1] memory pub = [bindingOf(p)];
            return groth16.verifyProof(a, b, c, pub);
        }
        // No compiled circuit for this pair yet: dev-mode mock fallback.
        bytes32 expected = keccak256(
            abi.encode(
                COMPILED_PROOF_DOMAIN,
                p.domainName,
                p.publicKeyHash,
                p.timestamp,
                p.fromPatternHash,
                p.contentPatternHash,
                p.emailNullifier
            )
        );
        return p.proof.length == 32 && bytes32(p.proof) == expected;
    }

    /// @notice The public input binding a zk-regex proof to the claimed email identity.
    function bindingOf(CompiledEmailProof calldata p) public pure returns (uint256) {
        return uint256(
            keccak256(abi.encode(p.domainName, p.publicKeyHash, p.timestamp, p.emailNullifier))
        ) % SNARK_SCALAR_FIELD;
    }
}
