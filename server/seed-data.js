"use strict";
/* Seed data — mirrors the mock ASSETS/CAMPAIGNS/portfolio previously
   hardcoded in the frontend (dashboard/index.html), now served from a
   real backend + SQLite database instead of living only in client JS. */

function monthLabel(offsetFromNow) {
  const d = new Date(2026, 7, 1); // Aug 2026 anchor, matches the frontend's anchor date
  d.setMonth(d.getMonth() - offsetFromNow);
  return d.toLocaleString("en", { month: "short", year: "2-digit" });
}
function buildRoyaltyHistory(months, base, growth, volatility, seed) {
  const out = [];
  let rnd = seed;
  const next = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  for (let i = months - 1; i >= 0; i--) {
    const trend = base * Math.pow(growth, months - 1 - i);
    const noise = 1 + (next() - 0.5) * volatility;
    out.push({ month: monthLabel(i), royaltyUSD: Math.max(0, Math.round(trend * noise)) });
  }
  return out;
}

const ASSETS = [
  {
    id: "midnight-static", kind: "catalogue", title: "Midnight Static", artistName: "Nova Reyes", genre: "Indie Pop",
    description: "Three-single catalogue with a steady 24-month streaming history across Spotify, Apple Music and SIAE-reported performance royalties. No prior liens; verified chain of title.",
    verified: true, tokenPrice: 25, tokensTotal: 4000, tokensSold: 2860, projectedYield: 8.2,
    royaltyHistory: buildRoyaltyHistory(24, 3400, 1.018, 0.16, 41),
    aiDisclosure: { vocals: "human", instrumentation: "human", composition: "human", postProduction: "human", lyrics: "human" },
    dspPolicy: "Spotify: monetized normally. TIDAL: unaffected (no AI content declared).",
    riskFactors: [
      "Streaming performance can decline if playlist placement or artist popularity fades.",
      "DSPs can change monetization or AI-content policy unilaterally after tokens are sold.",
      "This is a pilot structure; token liquidity is limited and no secondary market is guaranteed."
    ],
    documents: [{ name: "SIAE royalty statement — Q2 2026", type: "PDF", date: "Jul 2026" }, { name: "Chain-of-title confirmation", type: "PDF", date: "Jun 2026" }, { name: "SPV formation deed", type: "PDF", date: "May 2026" }],
    status: "funding"
  },
  {
    id: "glass-horizon", kind: "preproduction", title: "Glass Horizon (Draft)", artistName: "Cerchio Blu", genre: "Electronic",
    description: "An AI-assisted instrumental draft seeking financing to add live strings, vocal takes and professional mix/master before release — converting a policy-exposed draft into a documented, human-produced track.",
    verified: true, tokenPrice: 10, tokensTotal: 6000, tokensSold: 2220, targetRaiseUse: "Studio time, session vocalist, mix & master",
    aiDisclosure: { vocals: "pending", instrumentation: "ai", composition: "ai-assisted", postProduction: "pending", lyrics: "human" },
    dspPolicy: "TIDAL demonetizes fully AI-generated tracks — financing aims to add enough human production to exit that classification before release.",
    riskFactors: [
      "This track is unreleased and has no royalty history — financing carries venture-style risk, not bond-like income.",
      "Funds are held in milestone-gated escrow; a tranche only releases when the SPV manager confirms that milestone was met.",
      "If the funding goal is not reached, uncommitted funds are refunded pro-rata."
    ],
    documents: [{ name: "Production budget breakdown", type: "PDF", date: "Aug 2026" }, { name: "Draft demo (instrumental)", type: "MP3", date: "Aug 2026" }],
    milestones: [
      { name: "Funding goal reached", trancheAmount: 5000, status: "active" },
      { name: "Studio & session vocalist booked", trancheAmount: 8000, status: "pending" },
      { name: "Mix & master delivered", trancheAmount: 6000, status: "pending" },
      { name: "Release confirmed on DSPs", trancheAmount: 3200, status: "pending" }
    ],
    status: "funding"
  },
  {
    id: "ember-choir", kind: "catalogue", title: "Ember Choir", artistName: "Sasha Wren", genre: "Alt R&B",
    description: "A four-track EP with 18 months of reported royalties. Independently verified against distributor statements; token proceeds go to the artist as a partial catalogue sale.",
    verified: true, tokenPrice: 40, tokensTotal: 2500, tokensSold: 2500, projectedYield: 6.4,
    royaltyHistory: buildRoyaltyHistory(18, 5200, 1.01, 0.14, 87),
    aiDisclosure: { vocals: "human", instrumentation: "human", composition: "human", postProduction: "human", lyrics: "human" },
    dspPolicy: "Spotify & TIDAL: unaffected (no AI content declared).",
    riskFactors: [
      "Sold out — secondary transfers, if any, are subject to the platform’s compliance restrictions.",
      "Past royalty performance is not a guarantee of future income."
    ],
    documents: [{ name: "Distributor statement — 18mo trailing", type: "PDF", date: "Jul 2026" }, { name: "SPV formation deed", type: "PDF", date: "Feb 2026" }],
    status: "sold-out"
  },
  {
    id: "paper-cranes", kind: "catalogue", title: "Paper Cranes", artistName: "Kobo Lindqvist", genre: "Lo-fi / Ambient",
    description: "A meditative six-track catalogue with a long tail of consistent, low-volatility sync and mechanical royalties rather than viral streaming spikes.",
    verified: true, tokenPrice: 15, tokensTotal: 5000, tokensSold: 940, projectedYield: 5.1,
    royaltyHistory: buildRoyaltyHistory(24, 2100, 1.006, 0.10, 19),
    aiDisclosure: { vocals: "human", instrumentation: "ai-assisted", composition: "human", postProduction: "human", lyrics: "human" },
    dspPolicy: 'Spotify: monetized normally, AI-assisted instrumentation disclosed via DDEX metadata. TIDAL: below "substantially AI-generated" threshold as currently defined.',
    riskFactors: [
      'DDEX AI-disclosure categories are self-reported pending a platform audit trail.',
      'TIDAL has not published a quantitative threshold for "substantially AI-generated" — policy could tighten.',
      "This is a pilot structure; token liquidity is limited and no secondary market is guaranteed."
    ],
    documents: [{ name: "PRO royalty statement — 24mo trailing", type: "PDF", date: "Aug 2026" }, { name: "AI-tooling disclosure log", type: "PDF", date: "Aug 2026" }],
    status: "funding"
  },
  {
    id: "low-tide-orchestra", kind: "preproduction", title: "Low Tide Orchestra", artistName: "Marea Nera", genre: "Cinematic / Orchestral",
    description: "A raw voice-memo sketch seeking a full string-orchestra recording, mix and a companion short film. Token holders receive a shortlist vote on the recording studio (advisory only).",
    verified: false, tokenPrice: 20, tokensTotal: 3000, tokensSold: 180, targetRaiseUse: "Orchestra recording session, mixing, short-film production",
    aiDisclosure: { vocals: "human", instrumentation: "pending", composition: "human", postProduction: "pending", lyrics: "n/a" },
    dspPolicy: "No AI-generated elements planned; disclosure will be finalized after production.",
    riskFactors: [
      "Onboarding diligence is still in progress — catalogue is not yet fully verified.",
      "This track is unreleased and has no royalty history — venture-style risk, not bond-like income.",
      "Funds are held in milestone-gated escrow with a pro-rata refund path if the goal is not met."
    ],
    documents: [{ name: "Voice-memo sketch", type: "MP3", date: "Aug 2026" }, { name: "Production budget draft", type: "PDF", date: "Aug 2026" }],
    milestones: [
      { name: "Funding goal reached", trancheAmount: 3600, status: "pending" },
      { name: "Orchestra session booked", trancheAmount: 14000, status: "pending" },
      { name: "Mix & master delivered", trancheAmount: 9000, status: "pending" },
      { name: "Short film & release confirmed", trancheAmount: 9400, status: "pending" }
    ],
    status: "funding"
  },
  {
    id: "copper-radio", kind: "catalogue", title: "Copper Radio", artistName: "The Aftertaste", genre: "Rock",
    description: "A seven-song back catalogue from a touring band, tokenized to raise partial liquidity while the band retains the majority interest and full creative control.",
    verified: true, tokenPrice: 30, tokensTotal: 3200, tokensSold: 3200, projectedYield: 7.0,
    royaltyHistory: buildRoyaltyHistory(24, 4600, 1.004, 0.20, 63),
    aiDisclosure: { vocals: "human", instrumentation: "human", composition: "human", postProduction: "human", lyrics: "human" },
    dspPolicy: "Spotify & TIDAL: unaffected (no AI content declared).",
    riskFactors: [
      "Sold out — secondary transfers, if any, are subject to the platform’s compliance restrictions.",
      "Streaming performance can decline if the band’s touring activity or releases slow down."
    ],
    documents: [{ name: "Distributor statement — 24mo trailing", type: "PDF", date: "Jun 2026" }, { name: "SPV formation deed", type: "PDF", date: "Jan 2026" }],
    status: "sold-out"
  }
];

const CAMPAIGNS = [
  { id: "glass-horizon", assetId: "glass-horizon", title: "Glass Horizon (Draft)", artistName: "Cerchio Blu", holders: 184 }
];

const PORTFOLIO = {
  holdings: [
    { assetId: "midnight-static", tokens: 40, costBasis: 1000, unclaimed: 38.40 },
    { assetId: "ember-choir", tokens: 12, costBasis: 480, unclaimed: 14.10 }
  ],
  distributions: [
    { date: "Jun 2026", assetId: "midnight-static", amount: 31.20 },
    { date: "May 2026", assetId: "midnight-static", amount: 29.80 },
    { date: "Jul 2026", assetId: "ember-choir", amount: 12.50 }
  ]
};

module.exports = { ASSETS, CAMPAIGNS, PORTFOLIO };
