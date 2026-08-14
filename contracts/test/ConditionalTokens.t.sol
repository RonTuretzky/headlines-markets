// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ConditionalTokens} from "../src/tokens/ConditionalTokens.sol";
import {TestUSDC} from "../src/tokens/TestUSDC.sol";
import {IERC20} from "../src/tokens/ERC20.sol";

contract ConditionalTokensTest is Test {
    ConditionalTokens ct;
    TestUSDC usdc;
    address oracle = makeAddr("oracle");
    address user = makeAddr("user");
    bytes32 qid = keccak256("question");
    bytes32 conditionId;
    uint256 yesId;
    uint256 noId;

    function setUp() public {
        ct = new ConditionalTokens();
        usdc = new TestUSDC();
        ct.prepareCondition(oracle, qid, 2);
        conditionId = ct.getConditionId(oracle, qid, 2);
        yesId = ct.getPositionId(IERC20(address(usdc)), ct.getCollectionId(conditionId, 1));
        noId = ct.getPositionId(IERC20(address(usdc)), ct.getCollectionId(conditionId, 2));
        usdc.mint(user, 1000e6);
    }

    function test_PrepareConditionIsIdempotentBeforeResolution() public {
        // Re-preparing the same (oracle, questionId, slots) is a safe no-op — this is
        // what stops an attacker from bricking a market by front-running its
        // constructor's prepareCondition on the market's deterministic condition.
        ct.prepareCondition(oracle, qid, 2); // no revert
        assertEq(ct.getOutcomeSlotCount(conditionId), 2);
    }

    function test_PrepareConditionAfterResolutionReverts() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        vm.prank(oracle);
        ct.reportPayouts(qid, payouts);
        vm.expectRevert(bytes("CT: condition already resolved"));
        ct.prepareCondition(oracle, qid, 2);
    }

    function test_SplitMintsCompleteSet() public {
        vm.startPrank(user);
        usdc.approve(address(ct), 100e6);
        ct.splitPosition(IERC20(address(usdc)), conditionId, 100e6);
        vm.stopPrank();

        assertEq(ct.balanceOf(yesId, user), 100e6);
        assertEq(ct.balanceOf(noId, user), 100e6);
        assertEq(usdc.balanceOf(user), 900e6);
        assertEq(usdc.balanceOf(address(ct)), 100e6);
    }

    function test_MergeReturnsCollateral() public {
        vm.startPrank(user);
        usdc.approve(address(ct), 100e6);
        ct.splitPosition(IERC20(address(usdc)), conditionId, 100e6);
        ct.mergePositions(IERC20(address(usdc)), conditionId, 40e6);
        vm.stopPrank();

        assertEq(ct.balanceOf(yesId, user), 60e6);
        assertEq(ct.balanceOf(noId, user), 60e6);
        assertEq(usdc.balanceOf(user), 940e6);
    }

    function test_OnlyOracleCanReport() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        // a non-oracle sender derives a different (unprepared) conditionId
        vm.expectRevert(bytes("CT: condition not prepared"));
        ct.reportPayouts(qid, payouts);
    }

    function test_ReportTwiceReverts() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        vm.prank(oracle);
        ct.reportPayouts(qid, payouts);
        vm.prank(oracle);
        vm.expectRevert(bytes("CT: payout already reported"));
        ct.reportPayouts(qid, payouts);
    }

    function test_ReportAllZeroesReverts() public {
        uint256[] memory payouts = new uint256[](2);
        vm.prank(oracle);
        vm.expectRevert(bytes("CT: payout is all zeroes"));
        ct.reportPayouts(qid, payouts);
    }

    function test_RedeemBeforeReportReverts() public {
        uint256[] memory sets = new uint256[](1);
        sets[0] = 1;
        vm.expectRevert(bytes("CT: result not reported yet"));
        ct.redeemPositions(IERC20(address(usdc)), conditionId, sets);
    }

    function test_RedeemWinningAndLosingSides() public {
        vm.startPrank(user);
        usdc.approve(address(ct), 100e6);
        ct.splitPosition(IERC20(address(usdc)), conditionId, 100e6);
        vm.stopPrank();

        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1; // YES wins
        vm.prank(oracle);
        ct.reportPayouts(qid, payouts);

        uint256[] memory sets = new uint256[](2);
        sets[0] = 1;
        sets[1] = 2;
        vm.prank(user);
        ct.redeemPositions(IERC20(address(usdc)), conditionId, sets);

        // 100 YES redeem at $1, 100 NO at $0
        assertEq(usdc.balanceOf(user), 1000e6);
        assertEq(ct.balanceOf(yesId, user), 0);
        assertEq(ct.balanceOf(noId, user), 0);
    }

    function test_SplitPayout5050() public {
        vm.startPrank(user);
        usdc.approve(address(ct), 100e6);
        ct.splitPosition(IERC20(address(usdc)), conditionId, 100e6);
        // transfer NO away so user only redeems YES
        ct.safeTransferFrom(user, makeAddr("other"), noId, 100e6, "");
        vm.stopPrank();

        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        payouts[1] = 1; // 50/50
        vm.prank(oracle);
        ct.reportPayouts(qid, payouts);

        uint256[] memory sets = new uint256[](1);
        sets[0] = 1;
        vm.prank(user);
        ct.redeemPositions(IERC20(address(usdc)), conditionId, sets);
        assertEq(usdc.balanceOf(user), 950e6); // 100 YES at $0.50
    }

    function test_RedeemRejectsNonElementaryIndexSet() public {
        uint256[] memory payouts = new uint256[](2);
        payouts[0] = 1;
        vm.prank(oracle);
        ct.reportPayouts(qid, payouts);

        uint256[] memory sets = new uint256[](1);
        sets[0] = 3; // both bits
        vm.expectRevert(bytes("CT: bad index set"));
        ct.redeemPositions(IERC20(address(usdc)), conditionId, sets);
    }
}
