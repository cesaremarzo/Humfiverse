const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying HumfiverseCatalogueToken with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const Factory = await hre.ethers.getContractFactory("HumfiverseCatalogueToken");
  const token = await Factory.deploy();
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
