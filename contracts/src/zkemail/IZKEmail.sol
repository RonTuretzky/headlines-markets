// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The public outputs of a zkEmail proof, modelled on zkEmail's
/// `EmailProof` / `EmailAuthMsg` structures (zkemail/email-tx-builder).
///
/// In production zkEmail, a Groth16 proof attests that an email carrying a valid
/// DKIM signature from `domainName` (whose public key hashes to `publicKeyHash`)
/// contained these regex-extracted fields, without revealing the rest of the email.
/// Here the extracted fields are the From address, the Subject line and a bounded
/// body excerpt — exactly what a headline-market circuit would expose so that the
/// market's regex conditions can be evaluated onchain.
struct EmailProof {
    /// DKIM signing domain (the `d=` tag), e.g. "nytimes.com"
    string domainName;
    /// Poseidon/keccak hash of the DKIM RSA public key used to sign
    bytes32 publicKeyHash;
    /// Email Date header as unix seconds (proven inside the circuit)
    uint256 timestamp;
    /// Extracted From header address, e.g. "nytdirect@nytimes.com"
    string fromAddress;
    /// Extracted Subject header, decoded
    string subject;
    /// Extracted body excerpt (bounded, like zkEmail's max body bytes)
    string bodyExcerpt;
    /// Unique per email (hash of the DKIM signature); prevents replay
    bytes32 emailNullifier;
    /// The zk proof itself (mock bytes here; Groth16 points in production)
    bytes proof;
}

interface IZKEmailVerifier {
    /// @notice Returns true iff the proof is valid for the claimed public outputs.
    function verify(EmailProof calldata emailProof) external view returns (bool);
}

interface IDKIMRegistry {
    /// @notice Returns true iff `publicKeyHash` is a valid DKIM key hash for `domainName`.
    function isDKIMPublicKeyHashValid(string calldata domainName, bytes32 publicKeyHash)
        external
        view
        returns (bool);
}
