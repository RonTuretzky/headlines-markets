// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDKIMRegistry} from "./IZKEmail.sol";

/// @title MockDKIMRegistry
/// @notice Stand-in for zkEmail's DKIMRegistry (which maps DKIM signing domains to
/// hashes of their published DNS public keys, maintained by a DNSSEC oracle or a
/// trusted updater).
///
/// Two paths to register a key:
///  1. `setDKIMPublicKeyHash` — owner-set arbitrary hashes (mirrors production).
///  2. `registerMockKey` — PERMISSIONLESS registration of the deterministic mock key
///     `keccak256("MOCK_DKIM_KEY:" ++ domain)`, which is what the mock prover emits.
///     This keeps the whole demo flow permissionless: creating a market over a new
///     newspaper domain never requires an admin. Production replaces this contract
///     with the real registry.
contract MockDKIMRegistry is IDKIMRegistry {
    event DKIMPublicKeyHashRegistered(string domainName, bytes32 publicKeyHash);
    event DKIMPublicKeyHashRevoked(string domainName, bytes32 publicKeyHash);

    address public immutable owner;
    mapping(bytes32 => mapping(bytes32 => bool)) private valid; // keccak(domain) => keyHash => ok

    constructor() {
        owner = msg.sender;
    }

    function isDKIMPublicKeyHashValid(string calldata domainName, bytes32 publicKeyHash)
        external
        view
        returns (bool)
    {
        return valid[keccak256(bytes(domainName))][publicKeyHash];
    }

    /// @notice The deterministic key hash the mock prover uses for every domain.
    function mockKeyHash(string memory domainName) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("MOCK_DKIM_KEY:", domainName));
    }

    /// @notice Permissionlessly register the mock key for a domain.
    function registerMockKey(string calldata domainName) external {
        bytes32 h = mockKeyHash(domainName);
        valid[keccak256(bytes(domainName))][h] = true;
        emit DKIMPublicKeyHashRegistered(domainName, h);
    }

    function setDKIMPublicKeyHash(string calldata domainName, bytes32 publicKeyHash) external {
        require(msg.sender == owner, "DKIM: not owner");
        valid[keccak256(bytes(domainName))][publicKeyHash] = true;
        emit DKIMPublicKeyHashRegistered(domainName, publicKeyHash);
    }

    function revokeDKIMPublicKeyHash(string calldata domainName, bytes32 publicKeyHash) external {
        require(msg.sender == owner, "DKIM: not owner");
        valid[keccak256(bytes(domainName))][publicKeyHash] = false;
        emit DKIMPublicKeyHashRevoked(domainName, publicKeyHash);
    }
}
