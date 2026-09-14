const hre = require("hardhat");

/**
 * ONE-OFF (§2.73) — delete after it has run, per REPO_MAP.md.
 *
 * Moves all three contracts from ETH to USDC payments. Every contract's
 * payment currency is fixed at deployment, so the token, the escrow and the
 * marketplace are all redeployed. Prices and goals convert from wei at the
 * app's 0.0001 ETH = $1 mapping — 1e8 wei per USDC base unit — and any amount
 * that does not convert exactly stops the script rather than rounding.
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
 *   5. Checks the old marketplace has no active listing, withdraws any ETH
 *      fees still accrued on the retiring contracts, and deploys the USDC
 *      marketplace.
 *
 *   FEE_RECIPIENT=0x...  (required)
 *   npx hardhat run scripts/migrateUsdc.js --network sepolia
 */

const API = process.env.HUMFIVERSE_API || "https://humfiverse-api.onrender.com";
const OLD_TOKEN = process.env.OLD_TOKEN_ADDRESS || "0x4eB0391C547742815daf5Cf8754E93CC8fF1A963";
const OLD_ESCROW = process.env.OLD_ESCROW_ADDRESS || "0xf8f9E203bFe05630B56d52d695bb67c146029fa9";
const MARKETPLACE = process.env.MARKETPLACE_ADDRESS || "0x6eCae01eB8bA89721016A33ce64E3803Dd2C3d0b";
// Circle's USDC on Ethereum Sepolia.
const USDC = process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const WEI_PER_USDC_UNIT = 100_000_000n;

function toUsdc(wei, what) {
  if (wei % WEI_PER_USDC_UNIT !== 0n) throw new Error(`${what}: ${wei} wei does not convert to whole USDC base units. Nothing has been deployed.`);
  return wei / WEI_PER_USDC_UNIT;
}
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
  const usdc = new ethers.Contract(USDC, ["function symbol() view returns (string)", "function decimals() view returns (uint8)"], deployer);
  console.log("Deployer:", deployer.address, "| fee recipient:", feeRecipient);
  const [sym, dec] = [await usdc.symbol(), await usdc.decimals()];
  if (sym !== "USDC" || Number(dec) !== 6) throw new Error(`${USDC} is ${sym} with ${dec} decimals, not USDC with 6`);
  console.log("Payment token:", USDC, sym, Number(dec), "decimals");
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
      price: toUsdc(await oldToken.pricePerToken(id), `${assetId} price`),
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
    campaigns.push({ id, artist: c.artist, studioId: c.studioId, fundingGoal: toUsdc(c.fundingGoal, `${c.assetId} goal`), raised: c.raised, deadline: c.deadline, assetId: c.assetId, tokenId: await oldEscrow.campaignTokenId(id), milestones });
    console.log(`  campaign #${id} ${c.assetId}: raised ${ethers.formatEther(c.raised)} ETH${c.raised > 0n ? " -> will be cancelled here so contributors can refund, then recreated" : " -> recreate"}`);
  }
  for (let id = 1; ; id++) {
    const l = await market.getListing(id);
    if (l.seller === ZERO) break;
    if (l.active) throw new Error(`marketplace listing #${id} is still active on the old token. Nothing has been deployed.`);
  }
  console.log("Old marketplace: no active listings.");

  // ETH fees still accrued on the retiring contracts go to their recipient
  // first; withdrawFees() is open to any caller.
  for (const [name, c] of [["token", oldToken], ["escrow", oldEscrow], ["marketplace", market]]) {
    const accrued = await c.accruedFees().catch(() => 0n);
    if (accrued > 0n) {
      await (await c.withdrawFees()).wait();
      console.log(`Withdrew ${ethers.formatEther(accrued)} ETH of fees from the old ${name}.`);
    }
  }

  // --- 3. token ---
  const token = await (await ethers.getContractFactory("HumfiverseCatalogueToken")).deploy(USDC);
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

  // --- 6. marketplace ---
  const newMarket = await (await ethers.getContractFactory("HumfiverseMarketplace")).deploy(USDC, feeRecipient);
  await newMarket.waitForDeployment();
  const marketAddress = await newMarket.getAddress();
  console.log("\nHumfiverseMarketplace deployed:", marketAddress);

  console.log("\nSet these in server/.env AND on Render (humfiverse-api), then merge:");
  console.log(`  CHAIN_CONTRACT_ADDRESS=${tokenAddress}`);
  console.log(`  CHAIN_CONTRACT_DEPLOY_BLOCK=${tokenBlock}`);
  console.log(`  CHAIN_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`  CHAIN_ESCROW_DEPLOY_BLOCK=${escrowBlock}`);
  console.log(`  CHAIN_MARKETPLACE_ADDRESS=${marketAddress}`);
  console.log("  (CHAIN_ESCROW_LEGACY_ADDRESS stays as it is)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
