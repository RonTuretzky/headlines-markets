// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "./ERC20.sol";

/// @notice Faucet collateral token for local/testnet use. Polymarket settles in USDC;
/// this mirrors USDC's 6 decimals. Anyone can mint themselves play money.
contract TestUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000e6;

    constructor() ERC20("Test USD Coin", "USDC", 6) {}

    /// @notice Mint 10,000 USDC to the caller.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
