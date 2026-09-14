const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying HumfiverseCatalogueToken with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // §2.73: every price and payment is in this token. Circle's USDC on Sepolia by default.
  const paymentToken = process.env.PAYMENT_TOKEN_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  console.log("Payment token:", paymentToken);
  const Factory = await hre.ethers.getContractFactory("HumfiverseCatalogueToken");
  const token = await Factory.deploy(paymentToken);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("HumfiverseCatalogueToken deployed to:", address);
  console.log("Network:", hre.network.name);
  console.log("\nNext: run the mint script to mint each catalogue's supply into the pool:");
  console.log(`  CONTRACT_ADDRESS=${address} npx hardhat run scripts/mintCatalogues.js --network ${hre.network.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
