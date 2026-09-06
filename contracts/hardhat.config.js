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
      evmVersion: "cancun",
      // createCampaign gained a tokenId parameter (§2.42, unifying
      // catalogue/preproduction token release) and now trips the EVM's
      // stack-depth limit under the default codegen — viaIR compiles
      // through Yul instead, which doesn't have that limitation.
      viaIR: true
    }
  },
  networks: {
    // Ethereum Sepolia — switched from Base Sepolia (§2.35) because
    // testnet ETH faucets for the real Sepolia network are far easier to
    // get than Base's own, and it's still a fine EVM testnet for this
    // prototype; the "low-fee L2" reasoning in
    // planning/technical-architecture.md §2.4 was about a real mainnet
    // choice, not this testnet one. Faucet: https://sepoliafaucet.com or
    // https://www.alchemy.com/faucets/ethereum-sepolia
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts
    }
  },
  // Sourcify verification needs no API key but its Sourcify-side
  // check-all-by-addresses endpoint returned 404 against this hardhat-verify
  // version — left enabled for whenever that's fixed upstream, but the
  // actual verification path used is Etherscan's unified V2 API below
  // (one key, natively supported by chain id 11155111 —
  // see planning/technical-architecture.md §2.24/§2.35).
  sourcify: {
    enabled: true
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
