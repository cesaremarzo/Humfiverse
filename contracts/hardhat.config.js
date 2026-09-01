require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = DEPLOYER_KEY ? [DEPLOYER_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun"
    }
  },
  networks: {
    // Base Sepolia — EVM-compatible L2 testnet, consistent with the
    // "low-fee L2" recommendation in planning/technical-architecture.md §2.4.
    // Faucet: https://docs.base.org/tools/network-faucets/
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts
    }
  },
  // Sourcify verification needs no API key but its Sourcify-side
  // check-all-by-addresses endpoint returned 404 against this hardhat-verify
  // version — left enabled for whenever that's fixed upstream, but the
  // actual verification path used is Etherscan's unified V2 API below
  // (one key covers Basescan too, natively supported by chain id 84532 —
  // see planning/technical-architecture.md §2.24).
  sourcify: {
    enabled: true
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
