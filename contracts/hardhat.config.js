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
  // Sourcify verification needs no API key (unlike Etherscan/Basescan's own
  // verify flow) — publishes the source so Basescan's UI shows it as
  // verified too, which is what makes a deployed contract's actual
  // governance logic readable at the explorer link, not just its bytecode.
  sourcify: {
    enabled: true
  },
  etherscan: {
    enabled: false
  }
};
