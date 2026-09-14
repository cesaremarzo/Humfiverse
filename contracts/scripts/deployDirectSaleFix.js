const hre = require("hardhat");

/**
 * ONE-OFF (§2.81) — delete after it has run, per REPO_MAP.md.
 *
 * Deploys the token with per-token direct-sale control and the escrow that
 * refuses a token on direct sale or with tokens already sold outside it, then
 * links them. The marketplace is unchanged. Nothing is migrated: the only
 * campaign on the previous contracts is a broken test, cancelled and removed
 * separately.
 *
 *   FEE_RECIPIENT=0x...  (required)
 *   npx hardhat run scripts/deployDirectSaleFix.js --network sepolia
 */
const USDC = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient || !ethers.isAddress(feeRecipient)) throw new Error("set FEE_RECIPIENT");
  const usdc = new ethers.Contract(USDC, ["function symbol() view returns (string)", "function decimals() view returns (uint8)"], deployer);
  if ((await usdc.symbol()) !== "USDC" || Number(await usdc.decimals()) !== 6) throw new Error(`${USDC} is not 6-decimal USDC`);
  console.log("Deployer:", deployer.address, "| fee recipient:", feeRecipient, "| USDC:", USDC);

  const token = await (await ethers.getContractFactory("HumfiverseCatalogueToken")).deploy(USDC);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const tokenBlock = (await token.deploymentTransaction().wait()).blockNumber;
  await (await token.setFeeRecipient(feeRecipient)).wait();
  console.log("HumfiverseCatalogueToken:", tokenAddress, "block", tokenBlock);

  const escrow = await (await ethers.getContractFactory("HumfiverseMilestoneEscrow")).deploy(tokenAddress, feeRecipient);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  const escrowBlock = (await escrow.deploymentTransaction().wait()).blockNumber;
  await (await token.setEscrowContract(escrowAddress)).wait();
  console.log("HumfiverseMilestoneEscrow:", escrowAddress, "block", escrowBlock, "| token escrowContract ->", await token.escrowContract());

  console.log("\nSet these on Render (humfiverse-api) and in server/.env:");
  console.log(`  CHAIN_CONTRACT_ADDRESS=${tokenAddress}`);
  console.log(`  CHAIN_CONTRACT_DEPLOY_BLOCK=${tokenBlock}`);
  console.log(`  CHAIN_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`  CHAIN_ESCROW_DEPLOY_BLOCK=${escrowBlock}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
