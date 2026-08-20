// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EmailProof, IZKEmailVerifier} from "./IZKEmail.sol";
import {DKIMRegistry} from "./DKIMRegistry.sol";
import {RSAVerify} from "./RSAVerify.sol";

/// @title DKIMVerifier
/// @notice REAL DKIM verification (no mock): checks a genuine RSA-SHA256 signature over
/// an email's canonicalized headers against the sending domain's real public key, then
/// binds the extracted `fromAddress` and `subject` by requiring they appear verbatim in
/// the authenticated header bytes. A market's content regex then runs over that
/// authenticated subject, so a YES settlement is cryptographic proof the newspaper
/// really sent a matching email.
///
/// Verification steps:
///  1. Look up the RSA public key (modulus, exponent) for (domain, publicKeyHash) in
///     the DKIMRegistry. Reject if not registered.
///  2. RSA-SHA256 verify `signature` over `header` (RSAVerify + modexp precompile).
///  3. Bind identity: require `fromAddress` and `subject` are substrings of the
///     RSA-verified `header`, and `emailNullifier == keccak256(signature)`.
///
/// Note on body matching: `header` authenticates the Subject (and From/Date), so
/// Subject-field markets are fully bound. Binding body content requires additionally
/// checking the DKIM body hash (`bh=`) against the canonicalized body — a documented
/// hardening item (backlog A4); until then, prefer Subject-field conditions.
contract DKIMVerifier is IZKEmailVerifier {
    DKIMRegistry public immutable registry;

    constructor(DKIMRegistry _registry) {
        registry = _registry;
    }

    function verify(EmailProof calldata p) external view returns (bool) {
        (bytes memory modulus, bytes memory exponent, bool valid) = registry.keyData(p.domainName, p.publicKeyHash);
        if (!valid) return false;
        // publicKeyHash commits to the exact modulus, so the registry can't be tricked
        // into pairing a hash with a different key.
        if (keccak256(modulus) != p.publicKeyHash) return false;

        // (2) real RSA-SHA256 signature check over the canonicalized header
        if (!RSAVerify.pkcs1Sha256(sha256(p.header), p.signature, exponent, modulus)) return false;

        // (3) bind the extracted fields to the authenticated header
        if (p.emailNullifier != keccak256(p.signature)) return false;
        if (!contains(p.header, bytes(p.fromAddress))) return false;
        if (!contains(p.header, bytes(p.subject))) return false;
        return true;
    }

    /// @dev Naive substring search (fine at "no gas constraints"; headers are small).
    function contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        if (needle.length == 0) return true;
        if (needle.length > haystack.length) return false;
        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
