const hre = require("hardhat");
const catalogues = require("./catalogues");

async function main() {
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("Set CONTRACT_ADDRESS to the deployed HumfiverseCatalogueToken address (see scripts/deploy.js output).");
  }

  const token = await hre.ethers.getContractAt("HumfiverseCatalogueToken", address);

  for (const { tokenId, slug, supply, priceWei } of catalogues) {
    const already = await token.totalSupplyOf(tokenId);
    if (already > 0n) {
      console.log(`Token id ${tokenId} (${slug}) already minted (supply ${already}) — skipping.`);
      continue;
    }
    console.log(`Minting token id ${tokenId} (${slug}), supply ${supply}, price ${priceWei} wei/token...`);
    const tx = await token.mintCatalogue(tokenId, slug, supply, priceWei);
    const receipt = await tx.wait();
    console.log(`  done — tx ${receipt.hash}`);
  }

  console.log("\nPool balances:");
  for (const { tokenId, slug } of catalogues) {
    const bal = await token.poolBalance(tokenId);
    console.log(`  ${slug} (id ${tokenId}): ${bal.toString()}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
