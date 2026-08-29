const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying HumfiverseMilestoneEscrow with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const Factory = await hre.ethers.getContractFactory("HumfiverseMilestoneEscrow");
  const escrow = await Factory.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  const deployTx = escrow.deploymentTransaction();
  const receipt = await deployTx.wait();
  console.log("HumfiverseMilestoneEscrow deployed to:", address);
  console.log("Deploy block:", receipt.blockNumber);
  console.log("Network:", hre.network.name);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
