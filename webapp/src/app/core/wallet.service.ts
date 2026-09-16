import { Injectable, signal } from '@angular/core';
import { ethers } from 'ethers';
import { WalletState } from './models';
import {
  EmbeddedSession,
  Eip1193Provider,
  SocialStrategy,
  connectEmail,
  connectJwt,
  connectSocial,
  embeddedUserEmail,
  embeddedWalletEnabled,
  hasStoredEmbeddedSession,
  openSocialPopup,
  restoreSession,
  sendEmailCode
} from './embedded-wallet';

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export interface ConnectResult {
  ok: boolean;
  rejected?: boolean;
  /** The user closed the sign-in dialog without choosing anything. */
  cancelled?: boolean;
  popupBlocked?: boolean;
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
// get testnet ETH (for gas) from faucets there. Payments are USDC (§2.73).
const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7'; // 11155111
const SEPOLIA_ADD_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
  blockExplorerUrls: ['https://sepolia.etherscan.io']
};

const EXPLORER_BASE = 'https://sepolia.etherscan.io';
const BUY_ABI = ['function buy(uint256 tokenId, uint256 amount) external'];
/* Secondary market. `setApprovalForAll` is on the token contract, the rest
   on HumfiverseMarketplace — two different addresses, hence two ABIs. */
const ERC1155_APPROVAL_ABI = [
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address account, address operator) external view returns (bool)'
];
const MARKETPLACE_ABI = [
  'function list(address token, uint256 tokenId, uint256 amount, uint256 pricePerToken) external returns (uint256)',
  'function cancelListing(uint256 listingId) external',
  'function buyListing(uint256 listingId, uint256 amount) external',
  'event Listed(uint256 indexed listingId, address indexed seller, address indexed token, uint256 tokenId, uint256 amount, uint256 pricePerToken)'
];
const CONTRIBUTE_ABI = ['function contribute(uint256 campaignId, uint256 amount) external'];
/* §2.73: payments are in USDC. Each paying contract names its own token, so
   the address is read from the contract being paid, never configured here. */
const PAYMENT_TOKEN_ABI = ['function paymentToken() view returns (address)'];
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];
/* Same function on the escrow and the marketplace (§2.71). */
const WITHDRAW_FEES_ABI = ['function withdrawFees() external'];
/* Cancellation and refunds (§2.85). cancelCampaign is owner-only; refund
   pays only msg.sender, so every contributor claims their own. */
const ESCROW_REFUND_ABI = [
  'function owner() view returns (address)',
  'function campaigns(uint256) view returns (address artist, uint256 studioId, uint256 fundingGoal, uint256 raised, uint256 deadline, uint8 status, uint256 releasedBps, string assetId)',
  'function campaignReleased(uint256) view returns (uint256)',
  'function contributions(uint256, address) view returns (uint256)',
  'function cancelCampaign(uint256 campaignId) external',
  'function refund(uint256 campaignId) external'
];
const CONFIRM_MILESTONE_ABI = [
  'function confirmMilestoneAsArtist(uint256 campaignId, uint256 milestoneIndex) external',
  'function confirmMilestoneAsStudio(uint256 campaignId, uint256 milestoneIndex) external'
];

/** The user's wallet, from either of two sources (§2.83): an in-app wallet
 * created from a Google/Apple/email login, or MetaMask / any injected
 * provider. Both end up as an EIP-1193 provider, and every transaction below
 * goes through `eip1193()`, so no caller needs to know which one it is.
 * Identity checks (eth_accounts, eth_requestAccounts, eth_chainId) never
 * prompt for a signature. Every write is a real transaction signed by the
 * user's own key — never by Humfiverse (see
 * planning/legal-regulatory-notes.md §7.8 on why purchases stay fixed-price). */
@Injectable({ providedIn: 'root' })
export class WalletService {
  readonly state = signal<WalletState>({ address: null, chainId: null, connecting: false, kind: null });

  /** Drives the sign-in dialog rendered once in the app shell. */
  readonly pickerOpen = signal(false);
  readonly embeddedEnabled = embeddedWalletEnabled();
  readonly hasInjected = typeof window !== 'undefined' && !!window.ethereum;

  private embedded: EmbeddedSession | null = null;
  private readProvider: ethers.JsonRpcProvider | null = null;
  private pickerResolve: ((r: ConnectResult) => void) | null = null;

  chainName(hex: string | null): string {
    if (!hex) return 'Unknown network';
    return CHAIN_NAMES[hex.toLowerCase()] || 'Chain ' + parseInt(hex, 16);
  }

  truncateAddr(addr: string | null): string {
    return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';
  }

  private eip1193(): Eip1193Provider | null {
    if (this.state().kind === 'embedded') return this.embedded?.provider ?? null;
    return window.ethereum ?? null;
  }

  /** Opens the sign-in dialog and resolves once the user has connected or
   * closed it. Every "Connect wallet" button in the app calls this. Without
   * a thirdweb client id there is nothing to choose between, so it goes
   * straight to the injected wallet as it always did. */
  connect(): Promise<ConnectResult> {
    if (!this.embeddedEnabled) return this.connectInjected();
    this.pickerResolve?.({ ok: false, cancelled: true });
    this.pickerOpen.set(true);
    return new Promise((resolve) => (this.pickerResolve = resolve));
  }

  closePicker(result: ConnectResult = { ok: false, cancelled: true }): void {
    this.pickerOpen.set(false);
    const resolve = this.pickerResolve;
    this.pickerResolve = null;
    resolve?.(result);
  }

  async connectInjected(): Promise<ConnectResult> {
    if (!window.ethereum) return { ok: false };
    this.state.update((s) => ({ ...s, connecting: true }));
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      await this.dropEmbeddedSession();
      this.state.set({ address: accounts[0] || null, chainId, connecting: false, kind: accounts[0] ? 'injected' : null });
      return { ok: !!accounts[0] };
    } catch (err: unknown) {
      this.state.update((s) => ({ ...s, connecting: false }));
      const code = (err as { code?: number })?.code;
      return { ok: false, rejected: code === 4001 };
    }
  }

  /** Google/Apple. Call straight from the click handler, with no await
   * before it — see openSocialPopup. */
  connectWithSocial(strategy: SocialStrategy): Promise<ConnectResult> {
    const popup = openSocialPopup(strategy);
    if (!popup) return Promise.resolve({ ok: false, popupBlocked: true });
    return this.connectEmbedded(() => connectSocial(strategy, popup));
  }

  sendEmailCode(email: string): Promise<void> {
    return sendEmailCode(email);
  }

  connectWithEmail(email: string, code: string): Promise<ConnectResult> {
    return this.connectEmbedded(() => connectEmail(email, code));
  }

  /** EU Digital Identity Wallet entry point, for when the backend verifier
   * exists: it will hand back a JWT signed with our own key. */
  connectWithIdentityJwt(jwt: string): Promise<ConnectResult> {
    return this.connectEmbedded(() => connectJwt(jwt));
  }

  private async connectEmbedded(open: () => Promise<EmbeddedSession>): Promise<ConnectResult> {
    this.state.update((s) => ({ ...s, connecting: true }));
    try {
      this.adoptEmbedded(await open());
      return { ok: true };
    } catch (err) {
      console.warn('In-app wallet sign-in failed.', err);
      this.state.update((s) => ({ ...s, connecting: false }));
      return { ok: false };
    }
  }

  private adoptEmbedded(session: EmbeddedSession): void {
    this.embedded = session;
    session.onDisconnect(() => {
      if (this.embedded !== session) return;
      this.embedded = null;
      this.state.set({ address: null, chainId: null, connecting: false, kind: null });
    });
    this.state.set({ address: session.address, chainId: SEPOLIA_CHAIN_ID_HEX, connecting: false, kind: 'embedded' });
  }

  private async dropEmbeddedSession(): Promise<void> {
    const session = this.embedded;
    this.embedded = null;
    await session?.disconnect().catch(() => undefined);
  }

  /** For an in-app wallet this signs the user out; they sign back in with
   * the same login and get the same address. */
  disconnect(): void {
    void this.dropEmbeddedSession();
    this.state.update((s) => ({ ...s, address: null, chainId: null, kind: null }));
  }

  async silentSync(): Promise<void> {
    if (hasStoredEmbeddedSession()) {
      const session = await restoreSession();
      if (session) {
        this.adoptEmbedded(session);
        return;
      }
    }
    if (!window.ethereum) return;
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
      if (accounts && accounts[0] && this.state().kind !== 'embedded') {
        const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
        this.state.update((s) => ({ ...s, address: accounts[0], chainId, kind: 'injected' }));
      }
    } catch {
      /* ignore — silent check */
    }
  }

  /** MetaMask's own account/network changes. Ignored while an in-app wallet
   * is the active one, or switching accounts in an idle extension would
   * silently replace the user's signed-in wallet. */
  wireProviderEvents(): void {
    if (!window.ethereum?.on) return;
    window.ethereum.on('accountsChanged', (...args: unknown[]) => {
      if (this.state().kind !== 'injected') return;
      const accounts = args[0] as string[];
      const address = (accounts && accounts[0]) || null;
      this.state.update((s) => ({ ...s, address, kind: address ? 'injected' : null }));
    });
    window.ethereum.on('chainChanged', (...args: unknown[]) => {
      if (this.state().kind !== 'injected') return;
      const chainId = args[0] as string;
      this.state.update((s) => ({ ...s, chainId }));
    });
  }

  /** ETH and USDC held by `address` on Sepolia, read straight from the
   * chain rather than through the connected wallet, so it works whichever
   * network MetaMask happens to be on. The USDC address comes from
   * `paymentTokenSource`'s own paymentToken() (§2.73), never from config;
   * `usdc` is null when there is no contract to ask. */
  async readBalances(address: string, paymentTokenSource: string | null): Promise<{ eth: bigint; usdc: bigint | null }> {
    const provider = this.reader();
    const usdc = async () => {
      if (!paymentTokenSource) return null;
      const token = await new ethers.Contract(paymentTokenSource, PAYMENT_TOKEN_ABI, provider)['paymentToken']();
      return (await new ethers.Contract(token, ERC20_ABI, provider)['balanceOf'](address)) as bigint;
    };
    const [eth, usdcBalance] = await Promise.all([provider.getBalance(address), usdc()]);
    return { eth, usdc: usdcBalance };
  }

  private reader(): ethers.JsonRpcProvider {
    return (this.readProvider ??= new ethers.JsonRpcProvider(SEPOLIA_ADD_PARAMS.rpcUrls[0], 11155111, { staticNetwork: true }));
  }

  async readEscrowOwner(contractAddress: string): Promise<string> {
    return new ethers.Contract(contractAddress, ESCROW_REFUND_ABI, this.reader())['owner']();
  }

  /** A campaign's refund figures, straight from the contract. `pool` is
   * what the campaign still held when cancelled (raised less released
   * tranches); refunds already claimed are not subtracted, since the
   * contract keeps no running total of them. `refundable` mirrors refund()'s
   * own formula for `contributor`: contributed × pool / raised. */
  async readRefundState(contractAddress: string, campaignId: number, contributor: string | null):
    Promise<{ raised: bigint; released: bigint; pool: bigint; contributed: bigint; refundable: bigint }> {
    const escrow = new ethers.Contract(contractAddress, ESCROW_REFUND_ABI, this.reader());
    const [c, released, contributed] = await Promise.all([
      escrow['campaigns'](campaignId),
      escrow['campaignReleased'](campaignId) as Promise<bigint>,
      contributor ? (escrow['contributions'](campaignId, contributor) as Promise<bigint>) : Promise.resolve(0n)
    ]);
    const raised = c.raised as bigint;
    const pool = raised - released;
    return { raised, released, pool, contributed, refundable: raised > 0n ? (contributed * pool) / raised : 0n };
  }

  /** EIP-191 signature of `message` by the connected wallet — no network
   * switch, no transaction. Used for the launch authorization (§2.88). */
  /** The in-app wallet's login email, for prefilling registration (§2.93). */
  async loginEmail(): Promise<string | null> {
    return this.state().kind === 'embedded' ? embeddedUserEmail() : null;
  }

  async signMessage(message: string): Promise<string> {
    const eip1193 = this.eip1193();
    if (!eip1193) throw new Error('no-wallet');
    const provider = new ethers.BrowserProvider(eip1193 as unknown as ethers.Eip1193Provider);
    return (await provider.getSigner()).signMessage(message);
  }

  /** Owner-only on the contract: stops contributions and opens refund(). */
  async cancelCampaignOnchain(params: { contractAddress: string; campaignId: number }): Promise<{ txHash: string; explorerUrl: string }> {
    const contract = await this.signerFor(params.contractAddress, ESCROW_REFUND_ABI);
    const tx = await contract['cancelCampaign'](params.campaignId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
    return { txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  /** The connected wallet's own refund from a cancelled campaign. The 2%
   * contribution fee is not refunded, and the tokens stay where they are. */
  async refundOnchain(params: { contractAddress: string; campaignId: number }): Promise<{ txHash: string; explorerUrl: string }> {
    const contract = await this.signerFor(params.contractAddress, ESCROW_REFUND_ABI);
    const tx = await contract['refund'](params.campaignId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
    return { txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  /** Switches the wallet to Sepolia, adding it first if the wallet doesn't
   * know about it yet (error 4902). Returns false if the user rejects
   * either prompt. */
  async ensureSepolia(): Promise<boolean> {
    const provider = this.eip1193();
    if (!provider) return false;
    if (this.state().chainId?.toLowerCase() === SEPOLIA_CHAIN_ID_HEX) return true;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
      this.state.update((s) => ({ ...s, chainId: SEPOLIA_CHAIN_ID_HEX }));
      return true;
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code !== 4902) return false;
      try {
        await provider.request({ method: 'wallet_addEthereumChain', params: [SEPOLIA_ADD_PARAMS] });
        this.state.update((s) => ({ ...s, chainId: SEPOLIA_CHAIN_ID_HEX }));
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Real on-chain purchase: switches to Sepolia if needed, then
   * requests a signature for `buy(tokenId, amount)` against
   * HumfiverseCatalogueToken, paying `amount * priceUsdc`. Throws on
   * rejection, wrong network, or a reverted/failed transaction — callers
   * are expected to catch and show the user what happened. */
  /* --- secondary market (HumfiverseMarketplace) ---
     Every one of these is a transaction from the user's own wallet. The
     backend has no operator function on that contract, so it cannot list,
     cancel or move anyone's tokens — which is what the previous
     server-side listing design got wrong (§2.58). */

  private async signerFor(address: string, abi: string[]): Promise<ethers.Contract> {
    const eip1193 = this.eip1193();
    if (!eip1193) throw new Error('no-wallet');
    if (!(await this.ensureSepolia())) throw new Error('wrong-network');
    const provider = new ethers.BrowserProvider(eip1193 as unknown as ethers.Eip1193Provider);
    return new ethers.Contract(address, abi, await provider.getSigner());
  }

  /** Makes sure `spender` may pull `amount` USDC from this wallet: reads the
   * contract's own payment token, refuses early with `insufficient-usdc`
   * when the balance cannot cover it — rather than letting the transaction
   * revert after a signature — and asks for an approval of exactly this
   * amount when the current allowance is short. Returns once the approval
   * has confirmed. */
  private async ensureUsdc(spender: string, amount: bigint): Promise<void> {
    const owner = this.state().address;
    if (!owner) throw new Error('no-wallet');
    const payer = await this.signerFor(spender, PAYMENT_TOKEN_ABI);
    const usdc = await this.signerFor(await payer['paymentToken'](), ERC20_ABI);
    if ((await usdc['balanceOf'](owner)) < amount) throw new Error('insufficient-usdc');
    if ((await usdc['allowance'](owner, spender)) >= amount) return;
    const tx = await usdc['approve'](spender, amount);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
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
  async listOnMarketplace(params: { marketplace: string; tokenContract: string; tokenId: number; qty: number; pricePerTokenUsdc: string }):
    Promise<{ listingId: number; txHash: string; explorerUrl: string }> {
    const contract = await this.signerFor(params.marketplace, MARKETPLACE_ABI);
    const tx = await contract['list'](params.tokenContract, params.tokenId, params.qty, BigInt(params.pricePerTokenUsdc));
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

  /** Pays qty x pricePerToken in USDC, after approving that amount. Tokens
   * and USDC move in this one transaction. */
  async buyListingOnchain(params: { marketplace: string; listingId: number; qty: number; pricePerTokenUsdc: string }):
    Promise<{ txHash: string; explorerUrl: string }> {
    const cost = BigInt(params.pricePerTokenUsdc) * BigInt(params.qty);
    await this.ensureUsdc(params.marketplace, cost);
    const contract = await this.signerFor(params.marketplace, MARKETPLACE_ABI);
    const tx = await contract['buyListing'](params.listingId, params.qty);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
    return { txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  /** Sends a contract's accrued platform fees to its feeRecipient. Any
   * wallet may send this — it only chooses when, never where. */
  async withdrawFeesOnchain(contractAddress: string): Promise<{ txHash: string; explorerUrl: string }> {
    const contract = await this.signerFor(contractAddress, WITHDRAW_FEES_ABI);
    const tx = await contract['withdrawFees']();
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');
    return { txHash: tx.hash, explorerUrl: `${EXPLORER_BASE}/tx/${tx.hash}` };
  }

  async buyOnchain(params: { contractAddress: string; tokenId: number; amount: number; priceUsdc: string }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!this.eip1193()) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    await this.ensureUsdc(params.contractAddress, BigInt(params.priceUsdc) * BigInt(params.amount));
    const contract = await this.signerFor(params.contractAddress, BUY_ABI);

    const tx = await contract['buy'](params.tokenId, params.amount);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
  }

  /** Real on-chain contribution to a preproduction campaign's milestone
   * escrow — same pattern as `buyOnchain`, paying into
   * HumfiverseMilestoneEscrow.contribute() instead of
   * HumfiverseCatalogueToken.buy(). The USDC sits in escrow, not with the
   * artist, until Humfiverse confirms each milestone (see
   * planning/technical-architecture.md §2.15). */
  async contributeOnchain(params: { contractAddress: string; campaignId: number; amountUsdc: string }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!this.eip1193()) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    await this.ensureUsdc(params.contractAddress, BigInt(params.amountUsdc));
    const contract = await this.signerFor(params.contractAddress, CONTRIBUTE_ABI);

    const tx = await contract['contribute'](params.campaignId, BigInt(params.amountUsdc));
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
  }

  /** Real on-chain milestone attestation (§2.27) — the artist's own wallet
   * confirming a milestone was genuinely met. A tranche only releases once
   * both this and confirmMilestoneAsStudio (below) have been called for the
   * same milestone; Humfiverse has no equivalent function of its own. */
  async confirmMilestoneAsArtist(params: { contractAddress: string; campaignId: number; milestoneIndex: number }): Promise<{ txHash: string; explorerUrl: string }> {
    if (!this.eip1193()) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    const provider = new ethers.BrowserProvider(this.eip1193() as unknown as ethers.Eip1193Provider);
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
    if (!this.eip1193()) throw new Error('no-wallet');
    const switched = await this.ensureSepolia();
    if (!switched) throw new Error('wrong-network');

    const provider = new ethers.BrowserProvider(this.eip1193() as unknown as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(params.contractAddress, CONFIRM_MILESTONE_ABI, signer);

    const tx = await contract['confirmMilestoneAsStudio'](params.campaignId, params.milestoneIndex);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('tx-failed');

    return { txHash: receipt.hash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.hash}` };
  }
}
