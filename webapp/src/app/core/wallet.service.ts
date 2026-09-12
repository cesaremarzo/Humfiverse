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

// Switched from Base Sepolia to real Ethereum Sepolia (§2.35) — easier to
// get testnet ETH from faucets there.
const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7'; // 11155111
const SEPOLIA_ADD_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
  blockExplorerUrls: ['https://sepolia.etherscan.io']
};

const EXPLORER_BASE = 'https://sepolia.etherscan.io';
const BUY_ABI = ['function buy(uint256 tokenId, uint256 amount) external payable'];
/* Secondary market. `setApprovalForAll` is on the token contract, the rest
   on HumfiverseMarketplace — two different addresses, hence two ABIs. */
const ERC1155_APPROVAL_ABI = [
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address account, address operator) external view returns (bool)'
];
const MARKETPLACE_ABI = [
  'function list(address token, uint256 tokenId, uint256 amount, uint256 pricePerToken) external returns (uint256)',
  'function cancelListing(uint256 listingId) external',
  'function buyListing(uint256 listingId, uint256 amount) external payable',
  'event Listed(uint256 indexed listingId, address indexed seller, address indexed token, uint256 tokenId, uint256 amount, uint256 pricePerToken)'
];
const CONTRIBUTE_ABI = ['function contribute(uint256 campaignId) external payable'];
const CONFIRM_MILESTONE_ABI = [
  'function confirmMilestoneAsArtist(uint256 campaignId, uint256 milestoneIndex) external',
  'function confirmMilestoneAsStudio(uint256 campaignId, uint256 milestoneIndex) external'
];

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

  /** Switches the wallet to Sepolia, adding it first if the wallet doesn't
   * know about it yet (error 4902). Returns false if the user rejects
   * either prompt. */
  async ensureSepolia(): Promise<boolean> {
    if (!window.ethereum) return false;
    if (this.state().chainId?.toLowerCase() === SEPOLIA_CHAIN_ID_HEX) return true;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
      this.state.update((s) => ({ ...s, chainId: SEPOLIA_CHAIN_ID_HEX }));
      return true;
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code !== 4902) return false;
      try {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [SEPOLIA_ADD_PARAMS] });
        this.state.update((s) => ({ ...s, chainId: SEPOLIA_CHAIN_ID_HEX }));
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Real on-chain purchase: switches to Sepolia if needed, then
   * requests a signature for `buy(tokenId, amount)` against
   * HumfiverseCatalogueToken, paying `amount * priceWei`. Throws on
   * rejection, wrong network, or a reverted/failed transaction — callers
   * are expected to catch and show the user what happened. */
  /* --- secondary market (HumfiverseMarketplace) ---
     Every one of these is a transaction from the user's own wallet. The
     backend has no operator function on that contract, so it cannot list,
     cancel or move anyone's tokens — which is what the previous
     server-side listing design got wrong (§2.58). */

  private async signerFor(address: string, abi: string[]): Promise<ethers.Contract> {
    if (!window.ethereum) throw new Error('no-wallet');
    if (!(await this.ensureSepolia())) throw new Error('wrong-network');
    const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
    return new ethers.Contract(address, abi, await provider.getSigner());
  }

  /** Has this wallet already let the marketplace move its tokens? The
   * contract refuses to create a listing without it, so the UI asks for
   * this first rather than letting `list` revert. */
  async isMarketplaceApproved(tokenContract: string, marketplace: string): Promise<boolean> {
    const owner = this.state().address;
    if (!owner) return false;
    const token = await this.signerFor(tokenContract, ERC1155_APPROVAL_ABI);
    return token['isApprovedForAll'](owner, marketplace);
  }

  /** One approval covers every future listing of every token in this
   * contract, which is the standard ERC-1155 pattern and why it is a
   * separate step the user consents to once. It does not transfer
   * anything by itself. */
  async approveMarketplace(tokenContract: string, marketplace: string): Promise<{ txHash: string; explorerUrl: string }> {
    const token = await this.signerFor(tokenContract, ERC1155_APPROVAL_ABI);
    const tx = await token['setApprovalForAll'](marketplace, true);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
    return { txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  /** Creates the listing on chain and reads the new id back out of the
   * Listed event, which is what the backend then indexes. */
  async listOnMarketplace(params: { marketplace: string; tokenContract: string; tokenId: number; qty: number; pricePerTokenWei: string }):
    Promise<{ listingId: number; txHash: string; explorerUrl: string }> {
    const contract = await this.signerFor(params.marketplace, MARKETPLACE_ABI);
    const tx = await contract['list'](params.tokenContract, params.tokenId, params.qty, BigInt(params.pricePerTokenWei));
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    let listingId = 0;
    for (const log of receipt.logs ?? []) {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'Listed') { listingId = Number(parsed.args['listingId']); break; }
      } catch {
        /* a log from another contract in the same transaction */
      }
    }
    if (!listingId) throw new Error('tx-failed');
    return { listingId, txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  async cancelListingOnchain(params: { marketplace: string; listingId: number }): Promise<{ txHash: string; explorerUrl: string }> {
    const contract = await this.signerFor(params.marketplace, MARKETPLACE_ABI);
    const tx = await contract['cancelListing'](params.listingId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
    return { txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  /** Pays exactly qty x pricePerToken; the contract rejects anything else.
   * Tokens and ETH move in this one transaction. */
  async buyListingOnchain(params: { marketplace: string; listingId: number; qty: number; pricePerTokenWei: string }):
    Promise<{ txHash: string; explorerUrl: string }> {
    const contract = await this.signerFor(params.marketplace, MARKETPLACE_ABI);
    const value = BigInt(params.pricePerTokenWei) * BigInt(params.qty);
    const tx = await contract['buyListing'](params.listingId, params.qty, { value });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
    return { txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  async buyOnchain(params: { contractAddress: string; tokenId: number; amount: number; priceWei: string }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!window.ethereum) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(params.contractAddress, BUY_ABI, signer);
    const value = BigInt(params.priceWei) * BigInt(params.amount);

    const tx = await contract['buy'](params.tokenId, params.amount, { value });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
  }

  /** Real on-chain contribution to a preproduction campaign's milestone
   * escrow — same pattern as `buyOnchain`, paying into
   * HumfiverseMilestoneEscrow.contribute() instead of
   * HumfiverseCatalogueToken.buy(). The ETH sits in escrow, not with the
   * artist, until Humfiverse confirms each milestone (see
   * planning/technical-architecture.md §2.15). */
  async contributeOnchain(params: { contractAddress: string; campaignId: number; amountWei: string }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!window.ethereum) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(params.contractAddress, CONTRIBUTE_ABI, signer);

    const tx = await contract['contribute'](params.campaignId, { value: BigInt(params.amountWei) });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
  }

  /** Real on-chain milestone attestation (§2.27) — the artist's own wallet
   * confirming a milestone was genuinely met. A tranche only releases once
   * both this and confirmMilestoneAsStudio (below) have been called for the
   * same milestone; Humfiverse has no equivalent function of its own. */
  async confirmMilestoneAsArtist(params: { contractAddress: string; campaignId: number; milestoneIndex: number }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!window.ethereum) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(params.contractAddress, CONFIRM_MILESTONE_ABI, signer);

    const tx = await contract['confirmMilestoneAsArtist'](params.campaignId, params.milestoneIndex);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
  }

  /** Same as confirmMilestoneAsArtist, but called from the studio's own
   * registered wallet — see the contract-level note in
   * HumfiverseMilestoneEscrow.sol on why this exists (§2.27). */
  async confirmMilestoneAsStudio(params: { contractAddress: string; campaignId: number; milestoneIndex: number }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!window.ethereum) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    const provider = new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(params.contractAddress, CONFIRM_MILESTONE_ABI, signer);

    const tx = await contract['confirmMilestoneAsStudio'](params.campaignId, params.milestoneIndex);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
  }
}
