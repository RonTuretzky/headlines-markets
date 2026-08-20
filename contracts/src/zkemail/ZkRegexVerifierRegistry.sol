// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Groth16 verifier interface as exported by snarkjs for a 1-public-signal
/// circuit (our zk-regex pattern circuits: public input = the binding hash).
interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[1] calldata pubSignals
    ) external view returns (bool);
}

/// @title ZkRegexVerifierRegistry
/// @notice Maps a market pattern pair — (fromPatternHash, contentPatternHash) — to the
/// deployed Groth16 verifier for its compiled zk-regex circuit (backlog A3).
///
/// Registration is permissionless but WRITE-ONCE per pair: the first registered
/// verifier is final, so a later attacker cannot swap in an always-true verifier.
/// The residual trust assumption (dev mode) is that the first registrant compiled the
/// honest circuit for that pattern; production replaces this with a per-circuit
/// multi-party ceremony whose verifying key is checked against a published
/// transcript. Markets whose pair has no registered circuit fall back to the mock
/// keccak proof check (see ZkEmailVerifierV2) so settlement never bricks.
contract ZkRegexVerifierRegistry {
    event CircuitRegistered(
        bytes32 indexed pairHash, bytes32 fromPatternHash, bytes32 contentPatternHash, address verifier
    );

    /// pairHash = keccak256(abi.encodePacked(fromPatternHash, contentPatternHash))
    mapping(bytes32 => IGroth16Verifier) public verifiers;

    function pairHash(bytes32 fromPatternHash, bytes32 contentPatternHash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(fromPatternHash, contentPatternHash));
    }

    function register(bytes32 fromPatternHash, bytes32 contentPatternHash, IGroth16Verifier verifier) external {
        require(address(verifier) != address(0), "Registry: zero verifier");
        bytes32 h = pairHash(fromPatternHash, contentPatternHash);
        require(address(verifiers[h]) == address(0), "Registry: pair already registered");
        verifiers[h] = verifier;
        emit CircuitRegistered(h, fromPatternHash, contentPatternHash, address(verifier));
    }

    function verifierFor(bytes32 fromPatternHash, bytes32 contentPatternHash)
        external
        view
        returns (IGroth16Verifier)
    {
        return verifiers[pairHash(fromPatternHash, contentPatternHash)];
    }
}
