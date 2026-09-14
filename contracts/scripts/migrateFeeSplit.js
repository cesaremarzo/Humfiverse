const hre = require("hardhat");

/**
 * ONE-OFF (§2.72) — delete after it has run, per REPO_MAP.md.
 *
 * Moves to the 2% primary fee + 3% milestone fee contracts. Unlike §2.71 this
 * redeploys the token too (buy() gained the fee), and the escrow holds the
 * token address immutably, so both go:
 *
 *   1. Reads every minted token off the old token contract, and every holder
 *      from the production holder index — then re-checks every balance with
 *      balanceOf and requires held + pool == supply per token. A token that
 *      does not balance stops the script before anything is deployed.
 *   2. Reads the current escrow. A campaign with any confirmation or release
 *      stops the script. A campaign that only received contributions is
 *      cancelled there, so its contributors can call refund() for their ETH,
 *      and recreated fresh on the new escrow.
 *   3. Deploys the token, mints every token id with the same slug, supply,
 *      price, title, artist and audio URI, and re-releases every balance.
 *   4. Deploys the escrow linked to it, re-registers every studio in the same
 *      order (ids match), recreates the campaigns.
 *   5. Checks the marketplace (unchanged, token-agnostic) has no active listing
 *      on the old token.
 *
 *   FEE_RECIPIENT=0x...  (required)
 *   npx hardhat run scripts/migrateFeeSplit.js --network sepolia
 */

const API = process.env.HUMFIVERSE_API || "https://humfiverse-api.onrender.com";
const OLD_TOKEN = process.env.OLD_TOKEN_ADDRESS || "0xd8820e0fb8F6229577BcdfA0BaAF864280B969a4";
const OLD_ESCROW = process.env.OLD_ESCROW_ADDRESS || "0x85555cf462149C8C106A966a34521eBa82E7Ea27";
const MARKETPLACE = process.env.MARKETPLACE_ADDRESS || "0x6eCae01eB8bA89721016A33ce64E3803Dd2C3d0b";
const ZERO = "0x0000000000000000000000000000000000000000";

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient || !ethers.isAddress(feeRecipient)) throw new Error("set FEE_RECIPIENT to the wallet that receives withdrawn fees");

  const oldToken = await ethers.getContractAt("HumfiverseCatalogueToken", OLD_TOKEN);
  const oldEscrow = await ethers.getContractAt("HumfiverseMilestoneEscrow", OLD_ESCROW);
  const market = await ethers.getContractAt("HumfiverseMarketplace", MARKETPLACE);
  console.log("Deployer:", deployer.address, "| fee recipient:", feeRecipient);
  if ((await oldEscrow.owner()).toLowerCase() !== deployer.address.toLowerCase()) throw new Error("deployer does not own the escrow");

  // --- 1. tokens and holders, verified against the chain ---
  const { assetIds } = await getJson("/api/onchain/list");
  const { tokens: views } = await getJson(`/api/onchain/batch?ids=${assetIds.join(",")}`);
  const tokens = [];
  for (const assetId of assetIds) {
    const v = views[assetId];
    if (!v?.onchain) throw new Error(`${assetId}: no on-chain view from the API`);
    const id = BigInt(v.tokenId);
    const supply = await oldToken.totalSupplyOf(id);
    const pool = await oldToken.poolBalance(id);
    const { holders, verified } = await getJson(`/api/holders/${assetId}`);
    if (!verified) throw new Error(`${assetId}: the holder index has not verified this token — run reconcile first`);
    let held = 0n;
    const balances = [];
    for (const h of holders) {
      const bal = await oldToken.balanceOf(h.wallet, id);
      if (bal !== BigInt(h.balance)) throw new Error(`${assetId}: ${h.wallet} holds ${bal} on chain, index says ${h.balance}`);
      if (bal > 0n) balances.push({ wallet: h.wallet, amount: bal });
      held += bal;
    }
    if (held + pool !== supply) throw new Error(`${assetId}: held ${held} + pool ${pool} != supply ${supply} — a holder is missing`);
    tokens.push({
      assetId, id, supply, balances,
      slug: await oldToken.catalogueSlug(id),
      price: await oldToken.pricePerToken(id),
      title: await oldToken.trackTitle(id),
      artist: await oldToken.artistName(id),
      audio: await oldToken.trackAudioUri(id)
    });
    console.log(`  token ${id} ${assetId}: supply ${supply}, pool ${pool}, ${balances.length} holder(s) — balanced`);
  }
  // Any minted id the backend does not know about would be silently dropped.
  const maxId = tokens.reduce((m, t) => (t.id > m ? t.id : m), 0n);
  for (let id = 1n; id <= maxId + 10n; id++) {
    if ((await oldToken.totalSupplyOf(id)) > 0n && !tokens.some((t) => t.id === id)) throw new Error(`token id ${id} is minted on chain but unknown to the backend`);
  }

  // --- 2. escrow campaigns ---
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
    for (let i = 0; i < milestones.length; i++) {
      if (milestones[i].released || (await oldEscrow.artistConfirmed(id, i)) || (await oldEscrow.studioConfirmed(id, i))) {
        throw new Error(`campaign #${id} ${c.assetId} has a confirmed or released milestone — cannot migrate. Nothing has been deployed.`);
      }
    }
    if (Number(c.status) !== 0) throw new Error(`campaign #${id} ${c.assetId} is already cancelled — resolve by hand. Nothing has been deployed.`);
    campaigns.push({ id, artist: c.artist, studioId: c.studioId, fundingGoal: c.fundingGoal, raised: c.raised, deadline: c.deadline, assetId: c.assetId, tokenId: await oldEscrow.campaignTokenId(id), milestones });
    console.log(`  campaign #${id} ${c.assetId}: raised ${ethers.formatEther(c.raised)} ETH${c.raised > 0n ? " -> will be cancelled here so contributors can refund, then recreated" : " -> recreate"}`);
  }
  for (let id = 1; ; id++) {
    const l = await market.getListing(id);
    if (l.seller === ZERO) break;
    if (l.active) throw new Error(`marketplace listing #${id} is still active on the old token. Nothing has been deployed.`);
  }
  console.log("Marketplace: no active listings.");

  // --- 3. token ---
  const token = await (await ethers.getContractFactory("HumfiverseCatalogueToken")).deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const tokenBlock = (await token.deploymentTransaction().wait()).blockNumber;
  console.log("\nHumfiverseCatalogueToken deployed:", tokenAddress, "block", tokenBlock);
  await (await token.setFeeRecipient(feeRecipient)).wait();
  if ((await token.payoutRecipient()) !== (await oldToken.payoutRecipient())) await (await token.setPayoutRecipient(await oldToken.payoutRecipient())).wait();
  for (const t of tokens) {
    await (await token.mintCatalogue(t.id, t.slug, t.supply, t.price, t.title, t.artist)).wait();
    if (t.audio) await (await token.setTrackAudioUri(t.id, t.audio)).wait();
    for (const b of t.balances) await (await token.releaseFromPool(b.wallet, t.id, b.amount)).wait();
    for (const b of t.balances) {
      if ((await token.balanceOf(b.wallet, t.id)) !== b.amount) throw new Error(`restore mismatch for ${t.assetId} ${b.wallet}`);
    }
    console.log(`  minted ${t.assetId} (id ${t.id}), restored ${t.balances.length} balance(s)`);
  }

  // --- 4. escrow ---
  const escrow = await (await ethers.getContractFactory("HumfiverseMilestoneEscrow")).deploy(tokenAddress, feeRecipient);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  const escrowBlock = (await escrow.deploymentTransaction().wait()).blockNumber;
  await (await token.setEscrowContract(escrowAddress)).wait();
  console.log("\nHumfiverseMilestoneEscrow deployed:", escrowAddress, "block", escrowBlock, "| token escrowContract ->", await token.escrowContract());
  for (const s of studios) {
    await (await escrow.registerStudio(s.wallet, s.name)).wait();
    const created = await escrow.studios(s.id);
    if (created.wallet !== s.wallet || created.name !== s.name) throw new Error(`studio id mismatch at ${s.id}`);
  }
  console.log(`Registered ${studios.length} studios with matching ids.`);
  for (const c of campaigns) {
    if (c.raised > 0n) {
      await (await oldEscrow.cancelCampaign(c.id)).wait();
      console.log(`  cancelled ${c.assetId} on the old escrow — its contributors can now call refund(${c.id}) there`);
    }
    await (await escrow.createCampaign(
      c.artist, c.fundingGoal, c.studioId, c.deadline, c.assetId, c.tokenId,
      c.milestones.map((m) => m.name), c.milestones.map((m) => m.bps), c.milestones.map((m) => m.payee)
    )).wait();
    console.log(`  ${c.assetId}: recreated as #${await escrow.campaignIdByAssetId(c.assetId)}`);
  }
  for (const s of studios.filter((s) => !s.active)) await (await escrow.setStudioActive(s.id, false)).wait();

  console.log("\nSet these in server/.env AND on Render (humfiverse-api), then merge:");
  console.log(`  CHAIN_CONTRACT_ADDRESS=${tokenAddress}`);
  console.log(`  CHAIN_CONTRACT_DEPLOY_BLOCK=${tokenBlock}`);
  console.log(`  CHAIN_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`  CHAIN_ESCROW_DEPLOY_BLOCK=${escrowBlock}`);
  console.log("  (CHAIN_ESCROW_LEGACY_ADDRESS and CHAIN_MARKETPLACE_ADDRESS stay as they are)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
