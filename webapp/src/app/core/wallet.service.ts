import { Injectable, signal } from '@angular/core';
import { WalletState } from './models';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const CHAIN_NAMES: Record<string, string> = {
  '0x1': 'Ethereum Mainnet',
  '0x89': 'Polygon',
  '0xa': 'Optimism',
  '0xa4b1': 'Arbitrum One',
  '0x2105': 'Base',
  '0xaa36a7': 'Sepolia Testnet',
  '0x5': 'Goerli Testnet',
  '0x38': 'BNB Chain'
};

/** MetaMask / injected-provider connection — identity-only (eth_accounts,
 * eth_requestAccounts, eth_chainId). No signature or transaction is ever
 * requested; redeeming is simulated, matching the original site's design
 * intent (see planning/legal-regulatory-notes.md). */
@Injectable({ providedIn: 'root' })
export class WalletService {
  readonly state = signal<WalletState>({ address: null, chainId: null, connecting: false });

  chainName(hex: string | null): string {
    if (!hex) return 'Unknown network';
    return CHAIN_NAMES[hex.toLowerCase()] || 'Chain ' + parseInt(hex, 16);
  }

  truncateAddr(addr: string | null): string {
    return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';
  }

  async connect(): Promise<{ ok: boolean; rejected?: boolean }> {
    if (!window.ethereum) return { ok: false };
    this.state.update((s) => ({ ...s, connecting: true }));
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      this.state.set({ address: accounts[0] || null, chainId, connecting: false });
      return { ok: !!accounts[0] };
    } catch (err: unknown) {
      this.state.update((s) => ({ ...s, connecting: false }));
      const code = (err as { code?: number })?.code;
      return { ok: false, rejected: code === 4001 };
    }
  }

  disconnect(): void {
    this.state.update((s) => ({ ...s, address: null, chainId: null }));
  }

  async silentSync(): Promise<void> {
    if (!window.ethereum) return;
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
      if (accounts && accounts[0]) {
        const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
        this.state.update((s) => ({ ...s, address: accounts[0], chainId }));
      }
    } catch {
      /* ignore — silent check */
    }
  }

  wireProviderEvents(): void {
    if (!window.ethereum?.on) return;
    window.ethereum.on('accountsChanged', (...args: unknown[]) => {
      const accounts = args[0] as string[];
      this.state.update((s) => ({ ...s, address: (accounts && accounts[0]) || null }));
    });
    window.ethereum.on('chainChanged', (...args: unknown[]) => {
      const chainId = args[0] as string;
      this.state.update((s) => ({ ...s, chainId }));
    });
  }
}
