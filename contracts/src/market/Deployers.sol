// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConditionalTokens} from "../tokens/ConditionalTokens.sol";
import {IERC20} from "../tokens/ERC20.sol";
import {IZKEmailVerifier} from "../zkemail/IZKEmail.sol";
import {HeadlineMarket} from "./HeadlineMarket.sol";
import {FPMM} from "./FPMM.sol";

/// @notice Stateless deployer contracts. `new Child(...)` embeds the child's full
/// initcode in the creating contract's runtime bytecode; hosting each CREATE here
/// keeps MarketFactory (and everything else) under the EIP-170 24,576-byte runtime
/// limit, so the system deploys on vanilla EVM chains (backlog E1).
contract MarketDeployer {
    function deploy(
        ConditionalTokens conditionalTokens,
        IZKEmailVerifier verifier,
        IERC20 collateralToken,
        address creator,
        string calldata question,
        string calldata description,
        string calldata contentRegex,
        HeadlineMarket.ContentField contentField,
        HeadlineMarket.Source[] calldata sources,
        uint8 threshold,
        uint64 windowStart,
        uint64 deadline,
        uint64 resolutionBuffer
    ) external returns (HeadlineMarket) {
        return new HeadlineMarket(
            conditionalTokens,
            verifier,
            collateralToken,
            creator,
            question,
            description,
            contentRegex,
            contentField,
            sources,
            threshold,
            windowStart,
            deadline,
            resolutionBuffer
        );
    }
}

contract FPMMDeployer {
    function deploy(ConditionalTokens conditionalTokens, IERC20 collateralToken, bytes32 conditionId, uint256 fee)
        external
        returns (FPMM)
    {
        return new FPMM(conditionalTokens, collateralToken, conditionId, fee);
    }
}
