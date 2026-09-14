const hre = require("hardhat");

/**
 * ONE-OFF (§2.79) — delete after it has run, per REPO_MAP.md.
 *
 * Deploys the token whose price is derived from the artist's funding and
 * supply, and the escrow that takes its goal from that token, then links them.
 * The marketplace is unchanged (token-agnostic, already USDC). Nothing is
 * migrated: every campaign was deleted in the §2.78 cleanup.
 *
 *   FEE_RECIPIENT=0x...  (required)
 *   npx hardhat run scripts/deployFundingModel.js --network sepolia
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
  console.log("  CHAIN_ESCROW_LEGACY_ADDRESS=   (empty — delete the variable)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
