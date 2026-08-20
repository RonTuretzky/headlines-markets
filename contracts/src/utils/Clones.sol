// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal EIP-1167 clone deployer (backlog E1): each market/FPMM is a
/// 45-byte proxy delegatecalling a shared implementation, so creating a market
/// costs ~2 CREATEs of 45 bytes instead of redeploying ~30KB of initcode.
library Clones {
    function clone(address implementation) internal returns (address instance) {
        bytes20 target = bytes20(implementation);
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), target)
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "Clones: create failed");
    }
}
