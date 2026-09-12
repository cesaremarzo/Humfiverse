const hre = require("hardhat");

/**
 * Deploys HumfiverseMarketplace — the secondary-market exchange.
 *
 * Unlike every other contract change this project has made, this one
 * stands alone: the marketplace reaches the catalogue token through the
 * plain IERC1155 interface and takes only a fee recipient in its
 * constructor, so **neither HumfiverseCatalogueToken nor
 * HumfiverseMilestoneEscrow needs redeploying**, and no existing holder
 * balance or campaign is touched. Nothing on the token side authorises
 * this contract either — each seller approves it themselves with
 * setApprovalForAll when they list, which is the point: the platform
 * cannot move anyone's tokens without that wallet's own signature.
 *
 *   MARKETPLACE_FEE_RECIPIENT=0x...  (optional, defaults to the deployer)
 *   npx hardhat run scripts/deployMarketplace.js --network sepolia
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const feeRecipient = process.env.MARKETPLACE_FEE_RECIPIENT || deployer.address;

  console.log("Deploying HumfiverseMarketplace with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log("Fee recipient:", feeRecipient, feeRecipient === deployer.address ? "(deployer)" : "");

  const Factory = await hre.ethers.getContractFactory("HumfiverseMarketplace");
  const marketplace = await Factory.deploy(feeRecipient);
  await marketplace.waitForDeployment();

  const address = await marketplace.getAddress();
  const receipt = await marketplace.deploymentTransaction().wait();

  console.log("\nHumfiverseMarketplace deployed to:", address);
  console.log("Deploy block:", receipt.blockNumber);
  console.log("Network:", hre.network.name);
  console.log("\nSet this in server/.env and on Render:");
  console.log("  CHAIN_MARKETPLACE_ADDRESS=" + address);
  console.log("\n(No deploy block needed: the backend reads listings by id");
  console.log(" straight from the contract and never scans events, so there");
  console.log(" is no starting block to remember — see §2.55 for why that");
  console.log(" matters on a free-tier RPC.)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
