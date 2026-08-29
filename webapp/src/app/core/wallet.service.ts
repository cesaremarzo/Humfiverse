import { Injectable, signal } from '@angular/core';
import { ethers } from 'ethers';
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
  '0x14a34': 'Base Sepolia',
  '0xaa36a7': 'Sepolia Testnet',
  '0x5': 'Goerli Testnet',
  '0x38': 'BNB Chain'
};

const BASE_SEPOLIA_CHAIN_ID_HEX = '0x14a34'; // 84532
const BASE_SEPOLIA_ADD_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org']
};

const BUY_ABI = ['function buy(uint256 tokenId, uint256 amount) external payable'];

/** MetaMask / injected-provider connection. Identity checks (eth_accounts,
 * eth_requestAccounts, eth_chainId) never prompt for a signature. `buyOnchain`
 * is the one path in this app that does request a real signature and submits
 * a real transaction — a fixed-price primary purchase against
 * HumfiverseCatalogueToken.buy() (see contracts/), never an automatically
 * priced/dynamic trade (see planning/legal-regulatory-notes.md §7.8).
 * Everything else (redeeming, resale listings) stays simulated. */
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

  /** Switches the wallet to Base Sepolia, adding it first if the wallet
   * doesn't know about it yet (error 4902). Returns false if the user
   * rejects either prompt. */
  async ensureBaseSepolia(): Promise<boolean> {
    if (!window.ethereum) return false;
    if (this.state().chainId?.toLowerCase() === BASE_SEPOLIA_CHAIN_ID_HEX) return true;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }] });
      this.state.update((s) => ({ ...s, chainId: BASE_SEPOLIA_CHAIN_ID_HEX }));
      return true;
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code !== 4902) return false;
      try {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [BASE_SEPOLIA_ADD_PARAMS] });
        this.state.update((s) => ({ ...s, chainId: BASE_SEPOLIA_CHAIN_ID_HEX }));
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Real on-chain purchase: switches to Base Sepolia if needed, then
   * requests a signature for `buy(tokenId, amount)` against
   * HumfiverseCatalogueToken, paying `amount * priceWei`. Throws on
   * rejection, wrong network, or a reverted/failed transaction — callers
   * are expected to catch and show the user what happened. */
  async buyOnchain(params: { contractAddress: string; tokenId: number; amount: number; priceWei: string }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!window.ethereum) throw new Error('no-wallet');
    const switched = await this.ensureBaseSepolia();
    if (!switched) throw new Error('wrong-network');

    const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(params.contractAddress, BUY_ABI, signer);
    const value = BigInt(params.priceWei) * BigInt(params.amount);

    const tx = await contract['buy'](params.tokenId, params.amount, { value });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.basescan.org/tx/${receipt.hash}` };
  }
}
