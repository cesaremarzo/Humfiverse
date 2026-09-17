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
 * the receipt is the proof, so the endpoint needs no authentication. */

const { ethers } = require("ethers");
const chain = require("../chain");
const onchainRepo = require("../data/onchain.repo");
const royaltiesRepo = require("../data/royalties.repo");

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;
/** Long enough for "DistroKid statement, August 2026 (ref 88213)". */
const MAX_STATEMENT_LENGTH = 200;

function fail(code, message) {
  return Object.assign(new Error(message), { code });
}

/** The statementRef a statement text is written on chain as. The frontend
 * computes the same hash before depositing. */
function statementRefOf(statement) {
  return ethers.keccak256(ethers.toUtf8Bytes(statement));
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
      statement: r.statement,
      block: r.block,
      depositedAt: r.deposited_at
    }))
  };
}

/** Records the deposits a transaction made. `statement` is stored only on
 * the deposits whose on-chain statementRef is its hash, so nobody can
 * attach a description the depositor did not commit to. */
async function recordDeposit(txHash, statement) {
  if (!TX_HASH_PATTERN.test(String(txHash))) throw fail("invalid", "txHash must be a 32-byte hex transaction hash");
  if (statement != null && (typeof statement !== "string" || statement.length > MAX_STATEMENT_LENGTH)) {
    throw fail("invalid", `statement must be a string of at most ${MAX_STATEMENT_LENGTH} characters`);
  }
  if (!(await chain.royaltiesSupported())) throw fail("unsupported", "the configured token contract does not pay royalties");

  const deposits = await chain.getRoyaltyDepositsFromTx(txHash);
  if (deposits === null) throw fail("not_found", "transaction not found or not successful yet");
  if (!deposits.length) throw fail("invalid", "transaction contains no royalty deposit on this token contract");

  const ref = statement ? statementRefOf(statement) : null;
  const recorded = [];
  for (const d of deposits) {
    const token = await onchainRepo.findTokenByTokenId(d.tokenId);
    const row = { ...d, statement: ref && ref === d.statementRef ? statement : null };
    await royaltiesRepo.saveDeposit(chain.CONTRACT_ADDRESS, row);
    recorded.push({ ...row, assetId: token ? token.asset_id : null });
  }
  return { recorded };
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

module.exports = { royaltiesForAsset, recordDeposit, claimableForWallet, statementRefOf, MAX_STATEMENT_LENGTH };
