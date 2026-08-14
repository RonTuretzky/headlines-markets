// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EmailProof, IZKEmailVerifier, IDKIMRegistry} from "./IZKEmail.sol";

/// @title MockZKEmailVerifier
/// @notice Mock of zkEmail's Groth16 verifier with the same trust shape:
///
///  1. The DKIM public key hash must be registered for the claimed domain
///     (same check as production zkEmail — DKIMRegistry is the trust root).
///  2. The proof bytes must "verify" against the public outputs. Production runs a
///     Groth16 pairing check binding the outputs to a real DKIM-signed email; the
///     mock instead expects `proof = keccak256(abi.encode(PROOF_DOMAIN, ...outputs))`,
///     which our mock prover (scripts/prove-email) computes from a raw `.eml` file.
///
/// Swapping this contract for a real zkEmail verifier (and the registry for the real
/// DKIMRegistry) upgrades the system to trustless settlement with no other changes.
contract MockZKEmailVerifier is IZKEmailVerifier {
    bytes32 public constant PROOF_DOMAIN = keccak256("ZKEMAIL_MOCK_PROOF_V1");

    IDKIMRegistry public immutable dkimRegistry;

    constructor(IDKIMRegistry _dkimRegistry) {
        dkimRegistry = _dkimRegistry;
    }

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
}
