// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "./ERC1155.sol";
import {IERC20} from "./ERC20.sol";

/// @title ConditionalTokens
/// @notice A simplified reimplementation of Gnosis's Conditional Tokens Framework —
/// the token layer Polymarket settles on. Outcome shares are ERC1155 positions fully
/// collateralised by an arbitrary ERC20 (configurable per market, USDC on Polymarket):
///
///   - `splitPosition`: lock N collateral, mint N of every outcome token ("complete set").
///   - `mergePositions`: burn a complete set, unlock the collateral.
///   - `reportPayouts`: the condition's oracle (here: the HeadlineMarket contract)
///     reports the payout vector, e.g. [1, 0] for YES.
///   - `redeemPositions`: burn outcome tokens for their share of the payout.
///
/// Simplifications vs Gnosis CTF: no nested collections (flat conditions only) and
/// split/merge/redeem operate on elementary index sets (one token per outcome slot).
contract ConditionalTokens is ERC1155 {
    event ConditionPreparation(
        bytes32 indexed conditionId, address indexed oracle, bytes32 indexed questionId, uint256 outcomeSlotCount
    );
    event ConditionResolution(
        bytes32 indexed conditionId,
        address indexed oracle,
        bytes32 indexed questionId,
        uint256 outcomeSlotCount,
        uint256[] payoutNumerators
    );
    event PositionSplit(
        address indexed stakeholder, IERC20 collateralToken, bytes32 indexed conditionId, uint256 amount
    );
    event PositionsMerge(
        address indexed stakeholder, IERC20 collateralToken, bytes32 indexed conditionId, uint256 amount
    );
    event PayoutRedemption(
        address indexed redeemer,
        IERC20 indexed collateralToken,
        bytes32 indexed conditionId,
        uint256[] indexSets,
        uint256 payout
    );

    /// conditionId => payout numerator per outcome slot (empty until prepared/reported)
    mapping(bytes32 => uint256[]) public payoutNumerators;
    /// conditionId => sum of numerators (0 until reported)
    mapping(bytes32 => uint256) public payoutDenominator;

    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external {
        require(outcomeSlotCount > 1 && outcomeSlotCount <= 256, "CT: bad outcome slot count");
        bytes32 conditionId = getConditionId(oracle, questionId, outcomeSlotCount);
        if (payoutNumerators[conditionId].length != 0) {
            // Idempotent: the conditionId already fully commits to (oracle, questionId,
            // outcomeSlotCount), so a repeat with identical params is a safe no-op as
            // long as it hasn't resolved. This stops anyone from bricking a market by
            // front-running its constructor and pre-preparing its (deterministic)
            // condition — the market's own prepareCondition call then just returns.
            require(payoutDenominator[conditionId] == 0, "CT: condition already resolved");
            return;
        }
        payoutNumerators[conditionId] = new uint256[](outcomeSlotCount);
        emit ConditionPreparation(conditionId, oracle, questionId, outcomeSlotCount);
    }

    /// @notice Oracle reports the result. Payout vector semantics match Gnosis/Polymarket:
    /// [1,0] = first outcome wins, [0,1] = second wins, [1,1] = 50/50 split.
    function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external {
        uint256 outcomeSlotCount = payouts.length;
        bytes32 conditionId = getConditionId(msg.sender, questionId, outcomeSlotCount);
        require(payoutNumerators[conditionId].length == outcomeSlotCount, "CT: condition not prepared");
        require(payoutDenominator[conditionId] == 0, "CT: payout already reported");

        uint256 den = 0;
        for (uint256 i = 0; i < outcomeSlotCount; i++) {
            den += payouts[i];
            payoutNumerators[conditionId][i] = payouts[i];
        }
        require(den > 0, "CT: payout is all zeroes");
        payoutDenominator[conditionId] = den;
        emit ConditionResolution(conditionId, msg.sender, questionId, outcomeSlotCount, payouts);
    }

    /// @notice Lock `amount` collateral and mint `amount` of every outcome token.
    function splitPosition(IERC20 collateralToken, bytes32 conditionId, uint256 amount) external {
        uint256 slots = payoutNumerators[conditionId].length;
        require(slots > 0, "CT: condition not prepared");
        require(collateralToken.transferFrom(msg.sender, address(this), amount), "CT: collateral transfer failed");
        for (uint256 i = 0; i < slots; i++) {
            _mint(msg.sender, getPositionId(collateralToken, getCollectionId(conditionId, 1 << i)), amount);
        }
        emit PositionSplit(msg.sender, collateralToken, conditionId, amount);
    }

    /// @notice Burn `amount` of every outcome token and unlock `amount` collateral.
    function mergePositions(IERC20 collateralToken, bytes32 conditionId, uint256 amount) external {
        uint256 slots = payoutNumerators[conditionId].length;
        require(slots > 0, "CT: condition not prepared");
        for (uint256 i = 0; i < slots; i++) {
            _burn(msg.sender, getPositionId(collateralToken, getCollectionId(conditionId, 1 << i)), amount);
        }
        require(collateralToken.transfer(msg.sender, amount), "CT: collateral transfer failed");
        emit PositionsMerge(msg.sender, collateralToken, conditionId, amount);
    }

    /// @notice After resolution, burn held outcome tokens for their collateral payout.
    /// @param indexSets Elementary index sets to redeem, e.g. [1, 2] for both slots of a binary market.
    function redeemPositions(IERC20 collateralToken, bytes32 conditionId, uint256[] calldata indexSets) external {
        uint256 den = payoutDenominator[conditionId];
        require(den > 0, "CT: result not reported yet");
        uint256[] storage numerators = payoutNumerators[conditionId];
        uint256 slots = numerators.length;

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < indexSets.length; i++) {
            uint256 indexSet = indexSets[i];
            // Elementary sets only: exactly one bit, within range.
            require(indexSet > 0 && (indexSet & (indexSet - 1)) == 0 && indexSet < (1 << slots), "CT: bad index set");
            uint256 slot = bitIndex(indexSet);
            uint256 positionId = getPositionId(collateralToken, getCollectionId(conditionId, indexSet));
            uint256 bal = balanceOf[positionId][msg.sender];
            if (bal > 0) {
                _burn(msg.sender, positionId, bal);
                totalPayout += (bal * numerators[slot]) / den;
            }
        }
        if (totalPayout > 0) {
            require(collateralToken.transfer(msg.sender, totalPayout), "CT: collateral transfer failed");
        }
        emit PayoutRedemption(msg.sender, collateralToken, conditionId, indexSets, totalPayout);
    }

    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256) {
        return payoutNumerators[conditionId].length;
    }

    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount));
    }

    /// @dev Gnosis derives collections on alt_bn128; keccak keeps identical semantics for a flat hierarchy.
    function getCollectionId(bytes32 conditionId, uint256 indexSet) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(conditionId, indexSet));
    }

    function getPositionId(IERC20 collateralToken, bytes32 collectionId) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(collateralToken, collectionId)));
    }

    function bitIndex(uint256 indexSet) private pure returns (uint256 i) {
        while (indexSet > 1) {
            indexSet >>= 1;
            i++;
        }
    }
}
