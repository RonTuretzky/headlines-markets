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

/// @notice Public outputs of a COMPILED zk-regex proof (backlog E1/A3): the From and
/// content patterns are compiled INTO the circuit, which only produces a proof when
/// the DKIM-signed email actually matches them. The email content therefore never
/// appears onchain — only commitments identifying which patterns the circuit
/// enforced (in production these commit to the per-pattern Groth16 verifying key;
/// here they are keccak hashes of the pattern sources).
///
/// This is the gas-real settlement path: no onchain regex interpretation and no
/// subject/body in calldata. It is also the privacy-real path: a settler proves
/// "a matching alert exists" without revealing the email.
struct CompiledEmailProof {
    /// DKIM signing domain (the `d=` tag), e.g. "nytimes.com"
    string domainName;
    /// Hash of the DKIM RSA public key used to sign
    bytes32 publicKeyHash;
    /// Email Date header as unix seconds (proven inside the circuit)
    uint256 timestamp;
    /// Commitment to the From-address pattern the circuit enforced: keccak256(fromRegex)
    bytes32 fromPatternHash;
    /// Commitment to the content condition the circuit enforced:
    /// keccak256(abi.encodePacked(uint8(contentField), patternSource))
    bytes32 contentPatternHash;
    /// Unique per email (hash of the DKIM signature); prevents replay
    bytes32 emailNullifier;
    /// The zk proof (mock bytes here; Groth16 points in production)
    bytes proof;
}

interface IZkRegexVerifier {
    /// @notice Returns true iff the compiled proof is valid for its public outputs.
    function verifyCompiled(CompiledEmailProof calldata compiledProof) external view returns (bool);
}

interface IDKIMRegistry {
    /// @notice Returns true iff `publicKeyHash` is a valid DKIM key hash for `domainName`.
    function isDKIMPublicKeyHashValid(string calldata domainName, bytes32 publicKeyHash)
        external
        view
        returns (bool);
}
