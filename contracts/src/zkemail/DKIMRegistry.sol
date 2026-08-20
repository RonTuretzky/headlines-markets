// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDKIMRegistry} from "./IZKEmail.sol";

/// @title DKIMRegistry
/// @notice Stores REAL DKIM public keys (RSA modulus + exponent) per signing domain,
/// as published in the domain's DNS (`<selector>._domainkey.<domain>` TXT record).
/// Replaces the mock registry: keys here are the actual DNS-published moduli, and the
/// verifier does a real RSA check against them.
///
/// Registration is permissionless: `publicKeyHash = keccak256(modulus)` binds the hash
/// to the exact modulus, and settling still requires a valid RSA signature (i.e. the
/// domain's private key), so registering someone's public key grants no power. A
/// production deployment adds key-validity windows fed by a DNSSEC oracle so that keys
/// rotated out of DNS remain verifiable for emails dated while they were live
/// (backlog A2); this contract keeps keys valid until explicitly revoked by their
/// registrant.
contract DKIMRegistry is IDKIMRegistry {
    event DKIMKeyRegistered(string domainName, bytes32 indexed publicKeyHash, string selector);
    event DKIMKeyRevoked(string domainName, bytes32 indexed publicKeyHash);

    struct Key {
        bytes modulus;
        bytes exponent;
        address registrant;
        bool valid;
    }

    // keccak(domain) => keccak(modulus) => key
    mapping(bytes32 => mapping(bytes32 => Key)) private _keys;

    function isDKIMPublicKeyHashValid(string calldata domainName, bytes32 publicKeyHash)
        external
        view
        returns (bool)
    {
        return _keys[keccak256(bytes(domainName))][publicKeyHash].valid;
    }

    /// @notice Register a real DKIM public key for a domain.
    /// @param exponent big-endian public exponent (e.g. hex"010001" for 65537)
    /// @param modulus big-endian RSA modulus (the DNS `p=` key)
    function registerKey(string calldata domainName, string calldata selector, bytes calldata exponent, bytes calldata modulus)
        external
        returns (bytes32 publicKeyHash)
    {
        require(modulus.length >= 128, "DKIM: modulus too short"); // >= 1024-bit
        require(exponent.length > 0 && exponent.length <= 8, "DKIM: bad exponent");
        publicKeyHash = keccak256(modulus);
        Key storage k = _keys[keccak256(bytes(domainName))][publicKeyHash];
        require(!k.valid, "DKIM: key already registered");
        k.modulus = modulus;
        k.exponent = exponent;
        k.registrant = msg.sender;
        k.valid = true;
        emit DKIMKeyRegistered(domainName, publicKeyHash, selector);
    }

    /// @notice The registrant may revoke a key (e.g. after DNS rotation).
    function revokeKey(string calldata domainName, bytes32 publicKeyHash) external {
        Key storage k = _keys[keccak256(bytes(domainName))][publicKeyHash];
        require(k.registrant == msg.sender, "DKIM: not registrant");
        k.valid = false;
        emit DKIMKeyRevoked(domainName, publicKeyHash);
    }

    function keyData(string calldata domainName, bytes32 publicKeyHash)
        external
        view
        returns (bytes memory modulus, bytes memory exponent, bool valid)
    {
        Key storage k = _keys[keccak256(bytes(domainName))][publicKeyHash];
        return (k.modulus, k.exponent, k.valid);
    }
}
