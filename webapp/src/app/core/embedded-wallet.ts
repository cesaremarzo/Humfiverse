import { environment } from '../../environments/environment';

/* thirdweb in-app wallet (§2.83): a wallet created for the user from a
   Google/Apple/email login, with no browser extension involved. The key is
   held by thirdweb's enclave and never reaches Humfiverse, so the backend
   stays unable to move anyone's tokens — the same property MetaMask gave.

   The SDK is several hundred kB, so it is imported only when someone picks
   one of these logins or returns with a stored session; MetaMask users never
   download it. */

export type SocialStrategy = 'google' | 'apple';

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface EmbeddedSession {
  provider: Eip1193Provider;
  address: string;
  disconnect: () => Promise<void>;
  onDisconnect: (handler: () => void) => void;
}

/* Remembers that the last session was an in-app wallet, so a page load
   knows whether it is worth loading the SDK to restore it. */
const SESSION_FLAG = 'humfiverse.embeddedWallet';

export const embeddedWalletEnabled = (): boolean => !!environment.thirdwebClientId;

export function hasStoredEmbeddedSession(): boolean {
  try {
    return localStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

function setStoredSession(on: boolean): void {
  try {
    if (on) localStorage.setItem(SESSION_FLAG, '1');
    else localStorage.removeItem(SESSION_FLAG);
  } catch {
    /* private mode: the session just won't survive a reload */
  }
}

/* Deliberate narrow imports. The `thirdweb/wallets` barrel (where the SDK's
   own EIP-1193 adapter lives) also drags in WalletConnect and the Coinbase
   SDK, which turned the build into ~1,100 chunk files committed to docs/.
   The adapter below is the part of it this app uses. */
async function loadSdk() {
  const [{ createThirdwebClient, getRpcClient, prepareTransaction, sendTransaction }, { sepolia }, { inAppWallet, preAuthenticate }] =
    await Promise.all([import('thirdweb'), import('thirdweb/chains'), import('thirdweb/wallets/in-app')]);
  const client = createThirdwebClient({ clientId: environment.thirdwebClientId });
  /* EIP-7702 keeps the user's address a plain EOA — the one the contracts
     see as msg.sender for buy/contribute/confirm — while thirdweb's
     executor pays the gas. A 4337 smart account would give the user a
     different address from the signer, and nothing here needs that. */
  const wallet = inAppWallet({
    auth: { options: ['google', 'apple', 'email'], mode: 'popup' },
    metadata: { name: 'Humfiverse' },
    executionMode: { mode: 'EIP7702', sponsorGas: true }
  });
  const rpc = getRpcClient({ client, chain: sepolia });

  /* What ethers' BrowserProvider asks of a wallet: the account, and sending
     a transaction. Everything else (chain id, calls, receipts, gas
     estimates) is a plain read and goes to the RPC. An in-app wallet shows
     no confirmation prompt of its own — the app's own confirm dialogs are
     the consent step. */
  const provider: Eip1193Provider = {
    request: async ({ method, params }) => {
      const account = wallet.getAccount();
      switch (method) {
        case 'eth_accounts':
        case 'eth_requestAccounts':
          return account ? [account.address] : [];
        case 'eth_sendTransaction': {
          if (!account) throw new Error('no-wallet');
          const tx = (params?.[0] ?? {}) as { to?: string; data?: string; value?: string };
          const { transactionHash } = await sendTransaction({
            account,
            transaction: prepareTransaction({
              client,
              chain: sepolia,
              to: tx.to as `0x${string}`,
              data: (tx.data ?? '0x') as `0x${string}`,
              value: tx.value ? BigInt(tx.value) : 0n
            })
          });
          return transactionHash;
        }
        // §2.88: the launch authorization. ethers sends the UTF-8 message
        // hex-encoded; signing the raw bytes gives the same EIP-191
        // signature MetaMask produces, recoverable by ethers.verifyMessage.
        case 'personal_sign': {
          if (!account) throw new Error('no-wallet');
          return account.signMessage({ message: { raw: params?.[0] as `0x${string}` } });
        }
        default:
          return rpc({ method, params } as Parameters<typeof rpc>[0]);
      }
    }
  };
  return { client, chain: sepolia, wallet, preAuthenticate, provider };
}

type Sdk = Awaited<ReturnType<typeof loadSdk>>;
let sdkPromise: Promise<Sdk> | null = null;
const sdk = (): Promise<Sdk> => (sdkPromise ??= loadSdk());

function toSession(s: Sdk, address: string): EmbeddedSession {
  setStoredSession(true);
  return {
    provider: s.provider,
    address,
    disconnect: async () => {
      setStoredSession(false);
      await s.wallet.disconnect();
    },
    onDisconnect: (handler) => {
      s.wallet.subscribe('disconnect', () => {
        setStoredSession(false);
        handler();
      });
    }
  };
}

/** Opens thirdweb's Google/Apple login popup. Must be called synchronously
 * inside the click handler: after awaiting the SDK import the browser no
 * longer counts the open as user-initiated and blocks it (Safari always
 * does). When handed a window, the SDK only listens for its result and never
 * navigates it, so the URL is built here — it mirrors getLoginUrl() in
 * thirdweb/wallets/in-app/core/authentication/getLoginPath.js, which is not
 * exported. The package is pinned to an exact version for that reason;
 * re-check this line when upgrading it. */
export function openSocialPopup(strategy: SocialStrategy): Window | null {
  const url = `https://embedded-wallet.thirdweb.com/api/2024-05-05/login/${strategy}?clientId=${encodeURIComponent(environment.thirdwebClientId)}`;
  return window.open(url, `Login to ${strategy}`, 'width=420,height=620');
}

/** Google/Apple, completing the popup opened by openSocialPopup(). */
export async function connectSocial(strategy: SocialStrategy, popup: Window): Promise<EmbeddedSession> {
  const s = await sdk();
  const account = await s.wallet.connect({ client: s.client, chain: s.chain, strategy, openedWindow: popup });
  return toSession(s, account.address);
}

export async function sendEmailCode(email: string): Promise<void> {
  const s = await sdk();
  await s.preAuthenticate({ client: s.client, strategy: 'email', email });
}

export async function connectEmail(email: string, verificationCode: string): Promise<EmbeddedSession> {
  const s = await sdk();
  const account = await s.wallet.connect({ client: s.client, chain: s.chain, strategy: 'email', email, verificationCode });
  return toSession(s, account.address);
}

/** A JWT signed by our own backend (server/services/identity-jwt.service.js)
 * — the path an EU Digital Identity Wallet login will take once the
 * backend can verify a PID presentation. Needs "Custom JWT" configured in
 * the thirdweb dashboard with the backend's JWKS URL. */
export async function connectJwt(jwt: string): Promise<EmbeddedSession> {
  const s = await sdk();
  const account = await s.wallet.connect({ client: s.client, chain: s.chain, strategy: 'jwt', jwt });
  return toSession(s, account.address);
}

/** Restores a stored session without any prompt; null when there is none. */
export async function restoreSession(): Promise<EmbeddedSession | null> {
  if (!embeddedWalletEnabled() || !hasStoredEmbeddedSession()) return null;
  try {
    const s = await sdk();
    const account = await s.wallet.autoConnect({ client: s.client, chain: s.chain });
    return toSession(s, account.address);
  } catch {
    setStoredSession(false);
    return null;
  }
}
