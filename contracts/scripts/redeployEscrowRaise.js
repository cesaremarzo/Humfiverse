/* One-off (§2.114): deploys the escrow with raise deadlines and minimums,
   linked to the current token, and hands it to the Safe. Delete after use.

   Escrow only: the token is unchanged, so nothing is re-minted. The current
   escrow's campaigns stay where they are, read-only, and join
   CHAIN_ESCROW_LEGACY_ADDRESS; the token keeps it as retiredEscrow once the
   Safe links the new one, so its refunds keep working.

   Founder (DEPLOYER_PRIVATE_KEY) deploys and owns the escrow first, so it can
   set the operator and register the verified studio, then transfers
   ownership to the Safe. The one step it cannot do is
   token.setEscrowContract — the token is owned by the Safe — so the script
   writes a Transaction Builder batch for it.

   Resumable: NEW_ESCROW=<address> skips the deploy; every other step checks
   on chain whether it is already done. One run at a time (§2.102).

   node scripts/redeployEscrowRaise.js            (RPC from SEPOLIA_RPC_URL)
   RPC_URL=http://127.0.0.1:8546 node scripts/...  (a fork, for the dry run) */

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const TOKEN = "0xe26C2FC4A77e26cc1A4404DD5DA63ae8761dF997";
const SAFE = "0xBA2ad0Ca063092E350f1427dd86F7E9C8730245d";
const FEES = "0xd156BDD971c9034A2C78496889E258c4601b7524";
// Studios verified off chain and registered by the Safe on the current escrow.
const STUDIOS = [{ wallet: "0xDB0184bB248d6AcD15163f0541571892f0A632b3", name: "Bluehouse Studio" }];

const artifact = require("../artifacts/contracts/HumfiverseMilestoneEscrow.sol/HumfiverseMilestoneEscrow.json");

/* The Transaction Builder's own checksum (same as server/services/takedown.service.js). */
function txBuilderChecksum(batch) {
  const replacer = (_k, v) => (v === undefined ? null : v);
  const ser = (json) => {
    if (Array.isArray(json)) return `[${json.map(ser).join(",")}]`;
    if (json && typeof json === "object") {
      const keys = Object.keys(json).sort();
      let acc = `{${JSON.stringify(keys, replacer)}`;
      for (const k of keys) acc += `${ser(json[k])},`;
      return `${acc}}`;
    }
    return JSON.stringify(json, replacer);
  };
  return ethers.keccak256(ethers.toUtf8Bytes(ser({ ...batch, meta: { ...batch.meta, name: null } })));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || process.env.SEPOLIA_RPC_URL, 11155111, { cacheTimeout: -1 }); // no request cache: a fast chain reuses a stale nonce
  const founder = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  console.log("Founder:", founder.address, "balance", ethers.formatEther(await provider.getBalance(founder.address)), "ETH");
  const [latest, pending] = await Promise.all([provider.getTransactionCount(founder.address, "latest"), provider.getTransactionCount(founder.address, "pending")]);
  if (latest !== pending) throw new Error(`Founder has ${pending - latest} pending transaction(s): wait for them (§2.102).`);

  const token = new ethers.Contract(TOKEN, ["function owner() view returns (address)", "function escrowContract() view returns (address)", "function operator() view returns (address)"], provider);
  const tokenOwner = await token.owner();
  const oldEscrow = await token.escrowContract();
  console.log("Token owner:", tokenOwner, "· current escrow:", oldEscrow);

  let address = process.env.NEW_ESCROW;
  if (!address) {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, founder);
    const escrow = await factory.deploy(TOKEN, FEES);
    const receipt = await escrow.deploymentTransaction().wait();
    address = await escrow.getAddress();
    console.log(`Deployed escrow ${address} at block ${receipt.blockNumber} — rerun with NEW_ESCROW=${address} if interrupted`);
  } else {
    console.log("Resuming with escrow", address);
  }
  const escrow = new ethers.Contract(address, artifact.abi, founder);
  const owner = await escrow.owner();

  if ((await escrow.operator()).toLowerCase() !== founder.address.toLowerCase()) {
    if (owner.toLowerCase() !== founder.address.toLowerCase()) throw new Error("operator not set and Founder no longer owns the escrow");
    await (await escrow.setOperator(founder.address)).wait();
    console.log("Operator set to Founder");
  }

  for (const s of STUDIOS) {
    let found = false;
    for (let id = 1; ; id++) {
      const st = await escrow.studios(id);
      if (st.wallet === ethers.ZeroAddress) break;
      if (st.wallet.toLowerCase() === s.wallet.toLowerCase()) { found = true; console.log(`Studio ${s.name} already registered as ${id}`); break; }
    }
    if (!found) {
      if ((await escrow.owner()).toLowerCase() !== founder.address.toLowerCase()) throw new Error(`${s.name} not registered and Founder no longer owns the escrow`);
      await (await escrow.registerStudio(s.wallet, s.name)).wait();
      console.log("Registered", s.name);
    }
  }

  if ((await escrow.owner()).toLowerCase() === founder.address.toLowerCase()) {
    await (await escrow.transferOwnership(SAFE)).wait();
    console.log("Escrow ownership transferred to the Safe");
  }
  console.log("Escrow owner:", await escrow.owner(), "· fee recipient:", await escrow.feeRecipient());

  if ((await token.escrowContract()).toLowerCase() === address.toLowerCase()) {
    console.log("Token already points at the new escrow.");
    return;
  }
  const data = new ethers.Interface(["function setEscrowContract(address next)"]).encodeFunctionData("setEscrowContract", [address]);
  const batch = {
    version: "1.0",
    chainId: "11155111",
    createdAt: Date.now(),
    meta: {
      name: "Link the new escrow (§2.114)",
      description: `HumfiverseCatalogueToken.setEscrowContract(${address}) — the previous escrow ${oldEscrow} stays as retiredEscrow`,
      txBuilderVersion: "1.16.5",
      createdFromSafeAddress: SAFE,
      createdFromOwnerAddress: ""
    },
    transactions: [{ to: TOKEN, value: "0", data }]
  };
  batch.meta.checksum = txBuilderChecksum(batch);
  const out = path.join(process.env.BATCH_DIR || process.cwd(), "safe-link-escrow.json");
  fs.writeFileSync(out, JSON.stringify(batch, null, 2));
  console.log(`\nLast step, in the Safe app (2 of 3 signatures): load ${out} in the Transaction Builder,\nor call ${TOKEN}.setEscrowContract(${address}) — data ${data}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
