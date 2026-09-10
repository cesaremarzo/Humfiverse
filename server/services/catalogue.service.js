"use strict";
/* Domain rules for a catalogue asset's royalty history — the one part of
   an asset record that anything other than the onboarding wizard writes.

   Context worth keeping: the wizard used to synthesize a fake royalty
   history for every catalogue campaign via a seeded random-walk
   generator, which produced a fabricated "72% projected yield" for a
   track with no distribution history at all. That generator is gone. What
   replaced it is a real, self-reported, dated figure — the functions
   below — plus an admin cleanup path for the rows created before the fix
   (stripRoyaltyHistory). */

const catalogueRepo = require("../data/catalogue.repo");

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const WALLET_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function isValidMonth(month) {
  return MONTH_PATTERN.test(month);
}

/** `reportedBy` is stored purely for transparency in the UI, never used
 * to gate anything — anything that isn't a well-formed address is simply
 * dropped rather than rejected. */
function normalizeReporter(reportedBy) {
  return typeof reportedBy === "string" && WALLET_PATTERN.test(reportedBy) ? reportedBy.toLowerCase() : undefined;
}

/** Upserts by month, so a resubmission corrects a mistake instead of
 * duplicating it, and keeps the array sorted ascending so yield.util.ts's
 * trailing-12-months slice and the line chart both keep working
 * unchanged. Returns the new history. */
async function upsertRoyaltyReport(asset, { month, royaltyUSD, reportedBy }) {
  const history = (Array.isArray(asset.royaltyHistory) ? asset.royaltyHistory : []).filter((m) => m.month !== month);
  history.push(reportedBy ? { month, royaltyUSD, reportedBy } : { month, royaltyUSD });
  history.sort((a, b) => a.month.localeCompare(b.month));
  asset.royaltyHistory = history;
  await catalogueRepo.saveAsset(asset);
  return history;
}

async function removeRoyaltyReport(asset, month) {
  const history = (Array.isArray(asset.royaltyHistory) ? asset.royaltyHistory : []).filter((m) => m.month !== month);
  asset.royaltyHistory = history;
  await catalogueRepo.saveAsset(asset);
  return history;
}

/** Drops the field entirely rather than emptying it — the frontend's
 * "Royalty data pending" state keys off its absence, and an empty array
 * would read as "reported, and it was zero". */
async function stripRoyaltyHistory(asset) {
  delete asset.royaltyHistory;
  await catalogueRepo.saveAsset(asset);
}

module.exports = { isValidMonth, normalizeReporter, upsertRoyaltyReport, removeRoyaltyReport, stripRoyaltyHistory };
