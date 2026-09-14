// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice TEST-ONLY stand-in for USDC in the Hardhat suite and local
///         dry-runs: 6 decimals and an open mint. Never deployed to Sepolia —
///         the live contracts use Circle's USDC (§2.73).
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
