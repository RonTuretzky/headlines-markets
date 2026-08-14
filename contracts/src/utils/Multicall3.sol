// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal Multicall3 (aggregate3 subset) so viem can batch reads on a
/// fresh anvil chain, which does not predeploy the canonical multicall contract.
contract Multicall3 {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData) {
        returnData = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            if (!success) {
                require(calls[i].allowFailure, "Multicall3: call failed");
            }
            returnData[i] = Result({success: success, returnData: ret});
        }
    }
}
