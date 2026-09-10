"use strict";
/* The two regulatory ceremonies this prototype performs before an artist
   or investor can proceed: clause-by-clause contract acceptance, and a
   MiFID II appropriateness assessment. Both record an audit trail and
   return a receipt; neither is connected to a real registry, a real
   identity provider, or a real signature. */

const { CONTRACT_TEMPLATE } = require("../contract-template");
const complianceRepo = require("../data/compliance.repo");
const { fakeTxHash } = require("../lib/receipts");

const VESSATORIA_CLAUSE_IDS = CONTRACT_TEMPLATE.clauses.filter(c => c.vessatoria).map(c => c.id);

/* Server-side re-validation: never trust the client's checkbox state alone
   for a document with clauses that (per art. 1341 co.2 c.c.) need specific,
   individual acceptance — the general "I accept" checkbox is not enough on
   its own for those clauses. */
function validateContractAcceptance(body) {
  const missing = [];
  if (body.generalAccepted !== true) missing.push("generalAccepted");
  const va = body.vessatoriaAccepted || {};
  for (const clauseId of VESSATORIA_CLAUSE_IDS) {
    if (va[clauseId] !== true) missing.push(clauseId);
  }
  return missing;
}

async function recordContractAcceptance(body) {
  const receiptHash = fakeTxHash();
  const acceptedAt = new Date().toISOString();
  await complianceRepo.insertContractAcceptance({
    templateVersion: CONTRACT_TEMPLATE.version,
    artistName: body.artistName || "",
    trackTitle: body.trackTitle || "",
    vessatoriaAccepted: body.vessatoriaAccepted || {},
    receiptHash,
    acceptedAt
  });
  return { receiptHash, acceptedAt, templateVersion: CONTRACT_TEMPLATE.version };
}

/* MiFID II Art. 25(3) appropriateness assessment (execution-only regime):
   for a complex, non-standard instrument like a royalty-participation
   note, the firm must assess the client's knowledge/experience and warn
   them if the product may not be appropriate — it does NOT have to
   block the transaction outright (that's the suitability regime, which
   applies to advice, not execution-only). Scoring here is a simple
   illustrative heuristic, not a validated methodology. */
const APPROPRIATENESS_THRESHOLD = 3; // out of a max of 4 points

function scoreAppropriateness(answers) {
  answers = answers || {};
  let score = 0;
  if (answers.priorComplexInvestments === true) score += 1;
  if (answers.familiarWithIlliquidInstruments === true) score += 1;
  if (answers.understandsCapitalLossRisk === true) score += 1;
  if (answers.yearsExperience === "3+") score += 1;
  else if (answers.yearsExperience === "1-3") score += 0.5;
  const result = score >= APPROPRIATENESS_THRESHOLD ? "appropriate" : "warning";
  return { score, result };
}

async function recordKyc(body) {
  const { score, result } = scoreAppropriateness(body.answers);
  const receiptHash = fakeTxHash();
  const createdAt = new Date().toISOString();
  const classification = body.classification === "professional" ? "professional" : "retail";
  const walletAddress = body.walletAddress ? String(body.walletAddress).toLowerCase() : null;
  await complianceRepo.insertKycRecord({
    walletAddress,
    fullName: body.fullName || "",
    dob: body.dob || "",
    nationality: body.nationality || "",
    classification,
    score,
    appropriatenessResult: result,
    sourceOfFunds: body.sourceOfFunds || "",
    pep: body.pep,
    receiptHash,
    createdAt
  });
  return { verified: true, classification, appropriatenessResult: result, score, receiptHash };
}

/** A wallet that has already completed KYC/appropriateness shouldn't be
 * asked again on a later visit or purchase (§2.30, fixing a real gap the
 * user caught — this check previously didn't exist at all, so every
 * session re-required KYC regardless of wallet). Looks up the most recent
 * record for this wallet; not verified if it has never completed one. */
async function getKycStatusForWallet(walletAddress) {
  const row = await complianceRepo.findLatestKycByWallet(walletAddress);
  if (!row) return { verified: false };
  return {
    verified: true,
    classification: row.classification,
    appropriatenessResult: row.appropriateness_result,
    score: row.score,
    receiptHash: row.receipt_hash
  };
}

module.exports = {
  VESSATORIA_CLAUSE_IDS,
  validateContractAcceptance,
  recordContractAcceptance,
  scoreAppropriateness,
  recordKyc,
  getKycStatusForWallet
};
