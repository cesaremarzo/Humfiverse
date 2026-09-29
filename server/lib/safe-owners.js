"use strict";
/* The signers of the owner Safe (§2.97), read from the Safe itself. They
   are the people who can cancel a campaign on chain, so they are the ones
   who may run the off-chain half of the procedure too (§2.105). Cached for
   five minutes: a signer change is rare, and a stale list only ever lasts
   that long. */
const { ethers } = require("ethers");
const { OWNER_SAFE_ADDRESS } = require("../config");

const RPC_URL = process.env.CHAIN_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(RPC_URL, 11155111);
const safe = new ethers.Contract(OWNER_SAFE_ADDRESS, ["function getOwners() view returns (address[])"], provider);
const TTL_MS = 5 * 60 * 1000;
let cached = null;

async function safeOwners() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.owners;
  const owners = (await safe.getOwners()).map((a) => a.toLowerCase());
  cached = { at: Date.now(), owners };
  return owners;
}

async function isSafeOwner(wallet) {
  return (await safeOwners()).includes(String(wallet).toLowerCase());
}

module.exports = { safeOwners, isSafeOwner, OWNER_SAFE_ADDRESS };
