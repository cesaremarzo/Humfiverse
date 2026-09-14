const hre = require("hardhat");

/**
 * ONE-OFF (§2.71) — delete after it has run, per REPO_MAP.md.
 *
 * Deploys the fee-bearing HumfiverseMilestoneEscrow and HumfiverseMarketplace
 * and moves live state across:
 *
 *   1. Reads every studio and campaign off the current escrow, fresh.
 *   2. Refuses to start if any campaign holds contributions that have not all
 *      been released — those would be stranded on a contract the token no
 *      longer authorises. Nothing is deployed in that case.
 *   3. Deploys the new escrow linked to the existing token (the token is not
 *      redeployed: setEscrowContract is owner-settable) and authorises it.
 *   4. Re-registers every studio in the same order, so studio ids match the
 *      old contract and the backend's escrow_studios cache stays valid.
 *   5. Recreates every campaign that never received a contribution, with the
 *      same artist, goal, studio, asset, token and milestones. A campaign that
 *      was funded and fully released stays on the old escrow and is read from
 *      there via CHAIN_ESCROW_LEGACY_ADDRESS — recreating it would show it as
 *      unfunded.
 *   6. Deploys the new marketplace, after checking the old one has no active
 *      listing that would be orphaned.
 *
 *   ESCROW_FEE_RECIPIENT=0x...       (optional, defaults to the deployer)
 *   MARKETPLACE_FEE_RECIPIENT=0x...  (optional, defaults to the deployer)
 *   npx hardhat run scripts/migrateFees.js --network sepolia
 */

const TOKEN = process.env.CATALOGUE_TOKEN_ADDRESS || "0xd8820e0fb8F6229577BcdfA0BaAF864280B969a4";
const OLD_ESCROW = process.env.OLD_ESCROW_ADDRESS || "0x170c825f68024D0b919BfacecD0D8FcFDc639f8d";
const OLD_MARKETPLACE = process.env.OLD_MARKETPLACE_ADDRESS || "0x88af7374622cb99C015C2435202d3f1392264356";
const ZERO = "0x0000000000000000000000000000000000000000";

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const escrowFeeRecipient = process.env.ESCROW_FEE_RECIPIENT || deployer.address;
  const marketFeeRecipient = process.env.MARKETPLACE_FEE_RECIPIENT || deployer.address;

  const token = await ethers.getContractAt("HumfiverseCatalogueToken", TOKEN);
  const oldEscrow = await ethers.getContractAt("HumfiverseMilestoneEscrow", OLD_ESCROW);
  const oldMarket = await ethers.getContractAt("HumfiverseMarketplace", OLD_MARKETPLACE);

  console.log("Deployer:", deployer.address);
  console.log("Token:", TOKEN, "owner", await token.owner());
  if ((await token.owner()).toLowerCase() !== deployer.address.toLowerCase()) throw new Error("deployer does not own the token — cannot call setEscrowContract");

  // --- 1. read the old escrow ---
  const studios = [];
  for (let id = 1; ; id++) {
    const s = await oldEscrow.studios(id);
    if (s.wallet === ZERO) break;
    studios.push({ id, name: s.name, wallet: s.wallet, active: s.active });
  }
  const campaigns = [];
  for (let id = 1; ; id++) {
    const c = await oldEscrow.campaigns(id);
    if (c.artist === ZERO) break;
    const milestones = await oldEscrow.getMilestones(id);
    let anyConfirmation = false;
    for (let i = 0; i < milestones.length; i++) {
      if ((await oldEscrow.artistConfirmed(id, i)) || (await oldEscrow.studioConfirmed(id, i))) anyConfirmation = true;
    }
    campaigns.push({
      id,
      artist: c.artist,
      studioId: c.studioId,
      fundingGoal: c.fundingGoal,
      raised: c.raised,
      deadline: c.deadline,
      status: Number(c.status),
      releasedBps: Number(c.releasedBps),
      assetId: c.assetId,
      tokenId: await oldEscrow.campaignTokenId(id),
      milestones,
      anyConfirmation
    });
  }
  console.log(`\nOld escrow ${OLD_ESCROW}: ${studios.length} studios, ${campaigns.length} campaigns`);

  // --- 2. classify, refusing anything that would strand funds ---
  const recreate = [];
  const legacy = [];
  for (const c of campaigns) {
    const untouched = c.raised === 0n && c.releasedBps === 0 && !c.anyConfirmation && c.status === 0;
    const finished = c.releasedBps === 10_000;
    const line = `  #${c.id} ${c.assetId} raised ${ethers.formatEther(c.raised)} ETH, released ${c.releasedBps / 100}%`;
    if (untouched) { recreate.push(c); console.log(line, "-> recreate on the new escrow"); }
    else if (finished) { legacy.push(c); console.log(line, "-> stays on the old escrow (legacy, read-only)"); }
    else throw new Error(`${line} — partially funded, released or cancelled. Resolve it before migrating; nothing has been deployed.`);
  }
  for (let id = 1; ; id++) {
    const l = await oldMarket.getListing(id);
    if (l.seller === ZERO) break;
    if (l.active) throw new Error(`old marketplace listing #${id} is still active — it would be orphaned. Nothing has been deployed.`);
  }
  console.log("Old marketplace: no active listings.");

  // --- 3. new escrow, linked ---
  const escrow = await (await ethers.getContractFactory("HumfiverseMilestoneEscrow")).deploy(TOKEN, escrowFeeRecipient);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  const escrowBlock = (await escrow.deploymentTransaction().wait()).blockNumber;
  console.log("\nHumfiverseMilestoneEscrow deployed:", escrowAddress, "block", escrowBlock, "fee recipient", escrowFeeRecipient);
  await (await token.setEscrowContract(escrowAddress)).wait();
  console.log("Token escrowContract ->", await token.escrowContract());

  // --- 4. studios, same ids ---
  for (const s of studios) {
    await (await escrow.registerStudio(s.wallet, s.name)).wait();
    const created = await escrow.studios(s.id);
    if (created.wallet !== s.wallet || created.name !== s.name) throw new Error(`studio id mismatch at ${s.id}`);
  }
  console.log(`Registered ${studios.length} studios with matching ids.`);

  // --- 5. campaigns ---
  for (const c of recreate) {
    await (
      await escrow.createCampaign(
        c.artist, c.fundingGoal, c.studioId, c.deadline, c.assetId, c.tokenId,
        c.milestones.map((m) => m.name), c.milestones.map((m) => m.bps), c.milestones.map((m) => m.payee)
      )
    ).wait();
    const newId = await escrow.campaignIdByAssetId(c.assetId);
    const m = await escrow.getMilestones(newId);
    if (newId === 0n || m.length !== c.milestones.length) throw new Error(`campaign ${c.assetId} did not recreate cleanly`);
    console.log(`  ${c.assetId}: old #${c.id} -> new #${newId}`);
  }
  // Only now, since createCampaign requires an active studio.
  for (const s of studios.filter((s) => !s.active)) await (await escrow.setStudioActive(s.id, false)).wait();

  // --- 6. new marketplace ---
  const market = await (await ethers.getContractFactory("HumfiverseMarketplace")).deploy(marketFeeRecipient);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("\nHumfiverseMarketplace deployed:", marketAddress, "fee recipient", marketFeeRecipient);

  console.log("\nSet these in server/.env AND on Render (humfiverse-api):");
  console.log(`  CHAIN_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`  CHAIN_ESCROW_DEPLOY_BLOCK=${escrowBlock}`);
  console.log(`  CHAIN_ESCROW_LEGACY_ADDRESS=${legacy.length ? OLD_ESCROW : ""}`);
  console.log(`  CHAIN_MARKETPLACE_ADDRESS=${marketAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
