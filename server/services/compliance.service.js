"use strict";
/* The two regulatory ceremonies this prototype performs before an artist
   or investor can proceed: clause-by-clause contract acceptance, and a
   MiFID II appropriateness assessment. Both record an audit trail and
   return a receipt; neither is connected to a real registry, a real
   identity provider, or a real signature. */

const crypto = require("crypto");
const { CONTRACT_TEMPLATE, CONTRACT_TEMPLATE_SHA256 } = require("../contract-template");
const complianceRepo = require("../data/compliance.repo");
const { verifyLaunch } = require("../lib/launch-auth");
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

/* B-4: the acceptance is tied to the launch the artist wallet signed, which
   names this exact template (version and sha256). The receipt is a hash of
   what was recorded — wallet, asset, text, signature, time — not a random
   value, so anyone holding the record can recompute it. */
async function recordContractAcceptance(body) {
  const launch = verifyLaunch(body.launch);
  if (launch.contractVersion !== CONTRACT_TEMPLATE.version || launch.contractSha256 !== CONTRACT_TEMPLATE_SHA256) {
    throw Object.assign(new Error("the signed launch names a different version of the artist agreement; sign the launch again"), { code: "unauthorized" });
  }
  const acceptedAt = new Date().toISOString();
  const receiptHash = "0x" + crypto.createHash("sha256")
    .update([launch.artistWallet, launch.assetId, CONTRACT_TEMPLATE.version, CONTRACT_TEMPLATE_SHA256, body.launch.signature, acceptedAt].join("|"))
    .digest("hex");
  await complianceRepo.insertContractAcceptance({
    templateVersion: CONTRACT_TEMPLATE.version,
    artistName: launch.artistName,
    trackTitle: launch.title,
    vessatoriaAccepted: body.vessatoriaAccepted || {},
    receiptHash,
    acceptedAt,
    artistWallet: launch.artistWallet,
    assetId: launch.assetId,
    templateSha256: CONTRACT_TEMPLATE_SHA256,
    launchSignature: body.launch.signature
  });
  return { receiptHash, acceptedAt, templateVersion: CONTRACT_TEMPLATE.version, templateSha256: CONTRACT_TEMPLATE_SHA256 };
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
 * record for this wallet; not verified if it has never completed one.
 * Returns only that yes/no (§2.89): the route is public. */
async function getKycStatusForWallet(walletAddress) {
  const row = await complianceRepo.findLatestKycByWallet(walletAddress);
  return { verified: !!row };
}

module.exports = {
  VESSATORIA_CLAUSE_IDS,
  validateContractAcceptance,
  recordContractAcceptance,
  scoreAppropriateness,
  recordKyc,
  getKycStatusForWallet
};
