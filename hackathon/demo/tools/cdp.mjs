// Minimal CDP driver: launch headless Chrome, give a page session.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function launch({ width = 1920, height = 1080, port = 9333 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hv-cdp-'));
  const proc = spawn(CHROME, [...(process.env.HEADFUL ? ['--window-position=3000,0','--disable-blink-features=AutomationControlled'] : ['--headless=new']), `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    `--window-size=${width},${height}`, '--hide-scrollbars', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let tgt;
  for (let i = 0; i < 50; i++) { try { tgt = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' })).json(); break; } catch { await sleep(200); } }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const handlers = [];
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } else if (m.method) handlers.forEach((h) => h(m)); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  const goto = async (url, wait = 4000) => { await send('Page.navigate', { url }); await sleep(wait); };
  const shot = async (path) => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(path, Buffer.from(data, 'base64')); };
  return { send, evalJs, goto, shot, on: (h) => handlers.push(h), close: () => { try { ws.close(); } catch {} proc.kill(); } };
}
