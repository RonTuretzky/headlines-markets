// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The material needed to verify a real DKIM-signed email onchain.
///
/// A newspaper's mail server signs an outgoing email with its DKIM private key over a
/// canonicalized set of headers (RFC 6376). `header` is exactly those canonicalized
/// bytes; `signature` is the RSA signature (the DKIM `b=` tag); `publicKeyHash =
/// keccak256(modulus)` selects the domain's public key in the DKIMRegistry. The
/// verifier does a genuine RSA-SHA256 check of `signature` over `header` against that
/// key, then binds the extracted `fromAddress` / `subject` by requiring they appear in
/// the authenticated `header`. Nothing here is mocked — this is the same verification
/// an inbound mail server performs.
struct EmailProof {
    string domainName; // DKIM signing domain (the `d=` tag), e.g. "nytimes.com"
    bytes32 publicKeyHash; // keccak256(RSA modulus); selects the key in DKIMRegistry
    uint256 timestamp; // email Date as unix seconds (parsed from the signed Date header)
    string fromAddress; // From header address, bound to `header`
    string subject; // Subject, bound to `header`
    string bodyExcerpt; // body excerpt (matched by content regex; see DKIMVerifier note on body binding)
    bytes32 emailNullifier; // keccak256(signature); unique per email, prevents replay
    bytes header; // canonicalized signed headers (the RSA-signed message)
    bytes signature; // RSA signature over `header` (DKIM `b=`)
}

interface IZKEmailVerifier {
    /// @notice Returns true iff the email proof is a valid DKIM signature whose
    /// authenticated header binds the claimed From/Subject.
    function verify(EmailProof calldata emailProof) external view returns (bool);
}

interface IDKIMRegistry {
    /// @notice Returns true iff `publicKeyHash` is a valid DKIM key for `domainName`.
    function isDKIMPublicKeyHashValid(string calldata domainName, bytes32 publicKeyHash)
        external
        view
        returns (bool);
}
