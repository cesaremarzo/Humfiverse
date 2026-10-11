// A browser wallet for the recorder: announced to the page over EIP-6963
// like an extension, with every signature made here in Node by a test key.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../../../contracts/package.json', import.meta.url));
const { ethers } = require('ethers');
require('dotenv').config({ path: new URL('../../../server/.env', import.meta.url).pathname, quiet: true });
export const WALLETS = JSON.parse(readFileSync(new URL('./demo-wallets.json', import.meta.url)));
export const rpc = new ethers.JsonRpcProvider(process.env.CHAIN_RPC_URL);
export { ethers };

const ICON = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7159FF"/><path d="M9 11h14v12H9z" fill="none" stroke="#fff" stroke-width="2"/><circle cx="20" cy="17" r="1.6" fill="#fff"/></svg>').toString('base64');

const pageScript = (name) => `(() => {
  const pending = {}; let seq = 0; const listeners = {};
  window.__hvResolve = (i, ok, val) => { const p = pending[i]; if (!p) return; delete pending[i]; if (ok) p.res(val); else { const e = new Error(val.message); e.code = val.code; p.rej(e); } };
  window.__hvEmit = (ev, data) => (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) {} });
  const provider = {
    isHumfiverseDemo: true,
    request: ({ method, params }) => new Promise((res, rej) => { const i = ++seq; pending[i] = { res, rej }; window.hvWallet(JSON.stringify({ i, method, params: params || [] })); }),
    on: (e, f) => { (listeners[e] = listeners[e] || []).push(f); return provider; },
    removeListener: (e, f) => { listeners[e] = (listeners[e] || []).filter((x) => x !== f); return provider; },
  };
  const info = Object.freeze({ uuid: 'b1c6c0de-0000-4000-8000-0000000000aa', name: ${JSON.stringify(name)}, icon: ${JSON.stringify(ICON)}, rdns: 'com.humfiverse.demowallet' });
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
  try { localStorage.setItem('humfiverse.injectedWallet', 'com.humfiverse.demowallet'); } catch (e) {}
})();`;

export async function attachWallet(b, role, { name = 'Demo Wallet', log = true } = {}) {
  const signer = new ethers.Wallet(WALLETS[role].key, rpc);
  await b.send('Runtime.addBinding', { name: 'hvWallet' });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: pageScript(name) });
  b.on(async (m) => {
    if (m.method !== 'Runtime.bindingCalled' || m.params.name !== 'hvWallet') return;
    const { i, method, params } = JSON.parse(m.params.payload);
    let ok = true, val;
    try { val = await handle(signer, method, params); if (log) console.log(`  [${role}] ${method}${typeof val === 'string' && val.startsWith('0x') && val.length === 66 ? ' → ' + val : ''}`); }
    catch (e) { ok = false; val = { message: e.shortMessage || e.message, code: e.code === 'ACTION_REJECTED' ? 4001 : -32603 }; console.warn(`  [${role}] ${method} FAILED: ${val.message}`); }
    await b.send('Runtime.evaluate', { expression: `window.__hvResolve(${i}, ${ok}, ${JSON.stringify(val ?? null)})`, contextId: m.params.executionContextId }).catch(() => {});
  });
  return signer;
}

async function handle(signer, method, params) {
  switch (method) {
    case 'eth_requestAccounts': case 'eth_accounts': return [signer.address];
    case 'eth_chainId': return '0xaa36a7';
    case 'net_version': return '11155111';
    case 'wallet_switchEthereumChain': case 'wallet_addEthereumChain': case 'wallet_watchAsset': return null;
    case 'wallet_requestPermissions': case 'wallet_getPermissions': return [{ parentCapability: 'eth_accounts' }];
    case 'personal_sign': {
      const msg = params[0];
      return signer.signMessage(typeof msg === 'string' && /^0x[0-9a-f]*$/i.test(msg) ? ethers.getBytes(msg) : msg);
    }
    case 'eth_sign': return signer.signMessage(ethers.getBytes(params[1]));
    case 'eth_signTypedData_v4': case 'eth_signTypedData': {
      const d = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
      const types = { ...d.types }; delete types.EIP712Domain;
      return signer.signTypedData(d.domain, types, d.message);
    }
    case 'eth_sendTransaction': { if (process.env.DRYRUN) { await new Promise((r) => setTimeout(r, 3000)); throw Object.assign(new Error('User rejected (dry run)'), { code: 'ACTION_REJECTED' }); }
      const t = params[0];
      const tx = await signer.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : 0n, ...(t.gas ? { gasLimit: BigInt(t.gas) } : {}) });
      return tx.hash;
    }
    default: return rpc.send(method, params);
  }
}
