/**
 * Maps a failed wallet/contract call to the translation key that explains it.
 *
 * This was a single catch-all message regardless of cause — indistinguishable
 * whether the user declined the signature, their wallet couldn't cover the
 * ETH, or the contract itself reverted (and if it reverted, for what reason).
 * That collapsed every real diagnosis into "open devtools and read the
 * console", which is exactly what made a real on-chain-capacity bug take
 * several rounds to pin down.
 *
 * Returns a key plus its interpolation params rather than a finished string,
 * so this stays pure and the caller keeps the TranslateService. `reason` is
 * the raw Solidity revert string when ethers can decode one, passed through
 * verbatim and untranslated by design: it's a fixed contract string, not
 * user-facing copy this app authored.
 */
export interface OnchainErrorMessage {
  key: string;
  params?: Record<string, string>;
}

export function onchainErrorTranslation(err: unknown): OnchainErrorMessage {
  const e = err as { message?: string; code?: string; reason?: string; shortMessage?: string };
  if (e?.message === 'wrong-network') return { key: 'toast.onchainWrongNetwork' };
  if (e?.message === 'no-wallet') return { key: 'toast.noWalletDetected' };
  if (e?.code === 'ACTION_REJECTED') return { key: 'toast.onchainRejected' };
  if (e?.code === 'INSUFFICIENT_FUNDS') return { key: 'toast.onchainInsufficientFunds' };
  if (e?.message === 'tx-failed') return { key: 'toast.onchainReverted' };
  const reason = e?.reason || e?.shortMessage;
  if (reason) return { key: 'toast.onchainBuyFailedReason', params: { reason } };
  return { key: 'toast.onchainBuyFailed' };
}
