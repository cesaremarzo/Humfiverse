const hre = require("hardhat");

async function main() {
  const catalogueTokenAddress = process.env.CATALOGUE_TOKEN_ADDRESS;
  if (!catalogueTokenAddress) {
    throw new Error(
      "Set CATALOGUE_TOKEN_ADDRESS to the deployed HumfiverseCatalogueToken address (see scripts/deploy.js output) — " +
        "the escrow now needs it at deploy time so contribute() can release tokens from that pool directly (§2.42)."
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  // Where withdrawFees() sends the 5% retained from each released tranche.
  const feeRecipient = process.env.ESCROW_FEE_RECIPIENT || deployer.address;
  console.log("Deploying HumfiverseMilestoneEscrow with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log("Linked HumfiverseCatalogueToken:", catalogueTokenAddress);
  console.log("Fee recipient:", feeRecipient, feeRecipient === deployer.address ? "(deployer)" : "");

  const Factory = await hre.ethers.getContractFactory("HumfiverseMilestoneEscrow");
  const escrow = await Factory.deploy(catalogueTokenAddress, feeRecipient);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  const deployTx = escrow.deploymentTransaction();
  const receipt = await deployTx.wait();
  console.log("HumfiverseMilestoneEscrow deployed to:", address);
  console.log("Deploy block:", receipt.blockNumber);
  console.log("Network:", hre.network.name);

  // Authorize the escrow on the token side — without this, contribute()'s
  // internal releaseFromPool call reverts with "not authorized".
  console.log("\nAuthorizing escrow on the catalogue token...");
  const token = await hre.ethers.getContractAt("HumfiverseCatalogueToken", catalogueTokenAddress);
  const authTx = await token.setEscrowContract(address);
  await authTx.wait();
  console.log("Done — HumfiverseCatalogueToken.escrowContract is now", address);

  // Phase 2 (§2.92): the backend's key gets the operator role on both
  // contracts — mint, audio link, studios, campaigns — while ownership is
  // meant to move to a multisig once real state is restored.
  const operator = process.env.OPERATOR_ADDRESS;
  if (operator) {
    await (await token.setOperator(operator)).wait();
    await (await escrow.setOperator(operator)).wait();
    console.log("Operator set on token and escrow:", operator);
  } else {
    console.log("OPERATOR_ADDRESS not set — only the owner can mint or create campaigns.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
