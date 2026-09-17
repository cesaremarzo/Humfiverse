"use strict";
/* Royalty income paid to token holders (§2.92).
 *
 * The token contract does all the accounting: a deposit raises a per-token
 * accumulator, every transfer settles both sides first, and each holder's
 * claimable amount is a view. So this service reads totals and claimable
 * amounts from the chain every time and stores nothing it could get wrong.
 *
 * The one thing it keeps is the deposit history, because listing past
 * RoyaltiesDeposited events would mean the full-history eth_getLogs scan
 * §2.39 rules out. The wallet that deposits reports its transaction hash;
 * the receipt is the proof, so the endpoint needs no authentication.
 *
 * It also publishes each deposit's statement file (§2.98). The statementRef
 * on chain is the file's SHA-256, so the file is its own authorization:
 * only the exact bytes the depositor committed to are accepted. */

const chain = require("../chain");
const onchainRepo = require("../data/onchain.repo");
const royaltiesRepo = require("../data/royalties.repo");
const pinata = require("../pinata");
const { statementRefOf, checkStatementFile } = require("../lib/statement-file");

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function fail(code, message) {
  return Object.assign(new Error(message), { code });
}

/** An asset's royalty totals, its deposit history and, when `wallet` is
 * given, what that wallet can claim. `supported: false` on a token contract
 * deployed before royalties — the page then says so instead of showing zeros. */
async function royaltiesForAsset(assetId, wallet) {
  if (wallet && !WALLET_PATTERN.test(wallet)) throw fail("invalid", "not a valid wallet address");
  const token = await onchainRepo.findTokenByAssetId(assetId);
  if (!token) return { assetId, onchain: false, supported: false };
  const state = await chain.getRoyaltyState(token.token_id);
  if (!state) return { assetId, onchain: true, supported: false };

  const [rows, claimable] = await Promise.all([
    royaltiesRepo.depositsOf(chain.CONTRACT_ADDRESS, token.token_id),
    wallet ? chain.getClaimableRoyalties(token.token_id, wallet) : null
  ]);
  return {
    assetId,
    onchain: true,
    supported: true,
    ...state,
    claimableUsdc: claimable,
    deposits: rows.map((r) => ({
      txHash: r.tx_hash,
      explorerUrl: `${chain.EXPLORER_BASE}/tx/${r.tx_hash}`,
      depositor: r.depositor,
      amountUsdc: r.amount_usdc,
      statementRef: r.statement_ref,
      statementUri: r.statement_uri,
      statementMime: r.statement_mime,
      statementBytes: r.statement_bytes,
      block: r.block,
      depositedAt: r.deposited_at
    }))
  };
}

/** The RoyaltiesDeposited logs of `txHash`, read from its receipt. */
async function depositsInTx(txHash) {
  if (!TX_HASH_PATTERN.test(String(txHash))) throw fail("invalid", "txHash must be a 32-byte hex transaction hash");
  if (!(await chain.royaltiesSupported())) throw fail("unsupported", "the configured token contract does not pay royalties");
  const deposits = await chain.getRoyaltyDepositsFromTx(txHash);
  if (deposits === null) throw fail("not_found", "transaction not found or not successful yet");
  if (!deposits.length) throw fail("invalid", "transaction contains no royalty deposit on this token contract");
  return deposits;
}

/** Records the deposits a transaction made. */
async function recordDeposit(txHash) {
  const deposits = await depositsInTx(txHash);
  const recorded = [];
  for (const d of deposits) {
    const token = await onchainRepo.findTokenByTokenId(d.tokenId);
    await royaltiesRepo.saveDeposit(chain.CONTRACT_ADDRESS, d);
    recorded.push({ ...d, assetId: token ? token.asset_id : null });
  }
  return { recorded };
}

/** Publishes the statement file of the deposits in `txHash` whose
 * statementRef is the file's SHA-256: pinned to IPFS, linked from the
 * deposit history. Anyone may send it, since only the committed bytes
 * match. Sending it again returns the link already stored. */
async function attachStatement(txHash, buffer) {
  const { mime, extension } = checkStatementFile(buffer);
  const deposits = await depositsInTx(txHash);
  const ref = statementRefOf(buffer);
  const matching = deposits.filter((d) => d.statementRef.toLowerCase() === ref);
  if (!matching.length) throw fail("invalid", "this file's SHA-256 is not the statementRef of any deposit in the transaction");

  for (const d of matching) await royaltiesRepo.saveDeposit(chain.CONTRACT_ADDRESS, d);
  const existing = await royaltiesRepo.statementFileOf(chain.CONTRACT_ADDRESS, ref);
  if (existing) {
    for (const d of matching) await royaltiesRepo.setStatementFile(chain.CONTRACT_ADDRESS, d, existing);
    return { statementRef: ref, ...existing };
  }

  if (!pinata.uploadsEnabled()) throw fail("disabled", "uploads are disabled on this server (no Pinata key configured)");
  // Named by hash, not by the depositor's filename: the name is public too.
  const uri = await pinata.uploadFile(buffer, `royalty-statement-${ref.slice(2, 18)}.${extension}`);
  const file = { uri, mime, bytes: buffer.length };
  for (const d of matching) await royaltiesRepo.setStatementFile(chain.CONTRACT_ADDRESS, d, file);
  return { statementRef: ref, ...file };
}

/** Every token `wallet` can claim royalties on, including tokens it no
 * longer holds: what a token earned before it was sold stays with the
 * seller (§2.92). */
async function claimableForWallet(wallet) {
  if (!WALLET_PATTERN.test(wallet)) throw fail("invalid", "not a valid wallet address");
  if (!(await chain.royaltiesSupported())) return { supported: false, contractAddress: chain.CONTRACT_ADDRESS, claimable: [] };
  const tokens = await onchainRepo.listTokens();
  const rows = await Promise.all(
    tokens.map(async (t) => ({
      assetId: t.asset_id,
      tokenId: t.token_id,
      claimableUsdc: await chain.getClaimableRoyalties(t.token_id, wallet)
    }))
  );
  return { supported: true, contractAddress: chain.CONTRACT_ADDRESS, claimable: rows.filter((r) => BigInt(r.claimableUsdc) > 0n) };
}

module.exports = { royaltiesForAsset, recordDeposit, attachStatement, claimableForWallet };
