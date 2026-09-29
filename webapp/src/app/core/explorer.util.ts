/** Block explorer links for the chain the contracts live on (Ethereum
 * Sepolia, technical-architecture.md §2.35). One place to change it. */
export const EXPLORER_BASE = 'https://sepolia.etherscan.io';

export type ExplorerKind = 'address' | 'tx' | 'token';

export function explorerUrl(kind: ExplorerKind, value: string, tokenId?: number | null): string {
  if (kind === 'tx') return `${EXPLORER_BASE}/tx/${value}`;
  if (kind === 'token' && tokenId != null) return `${EXPLORER_BASE}/nft/${value}/${tokenId}`;
  return `${EXPLORER_BASE}/address/${value}`;
}
