import { recordScene } from './rec.mjs';
import { attachWallet, WALLETS } from './wallet.mjs';
import { readFileSync } from 'node:fs';
const SITE = 'https://humfiverse.com/#/';
const HELP = readFileSync(new URL('./helpers.js', import.meta.url), 'utf8');
const which = process.argv[2];
const waitFor = async (h, expr, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await h.js(expr)) return true; await h.sleep(1000); } console.warn('timeout waiting for', expr); return false; };
const typeInto = (h, sel, v) => h.js(`(() => { const e = ${sel}; e.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, '${v}'); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
const clickIn = async (h, card, text) => {
  const ok = await h.js(`(() => { const cards = [...document.querySelectorAll('section,article,div')].filter(d => d.innerText && d.innerText.includes(${JSON.stringify(card)}) && d.querySelector('table'));
    const c = cards.sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!c) return false;
    const btn = [...c.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!btn) return false;
    c.scrollIntoView({ block: 'center' }); const r = btn.getBoundingClientRect(); const cur = document.querySelector('.hv-cur'); cur.style.left = (r.left + r.width / 2) + 'px'; cur.style.top = (r.top + r.height / 2) + 'px'; window.__hvClick = btn; return true; })()`);
  if (!ok) { console.warn('clickIn not found', card, text); return; }
  await h.sleep(1100); await h.js(`document.querySelector('.hv-cur').classList.add('down')`); await h.sleep(160); await h.js(`document.querySelector('.hv-cur').classList.remove('down'), window.__hvClick.click(), 1`);
};
const rowState = (milestone, re) => `(() => { const c = [...document.querySelectorAll('section,article,div')].filter(d => d.innerText && d.innerText.includes('golden-hour-538') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; const r = c && [...c.querySelectorAll('tr')].find(r => r.innerText.includes('${milestone}')); return !!r && ${re}; })()`;
const scenes = {
  'after': ['studio', async (h) => {
    await h.goto(SITE + 'studio', 12000); await h.js(HELP); await h.prep();
    await h.js(`(() => { const c = [...document.querySelectorAll('section,article,div')].filter(d => d.innerText && d.innerText.includes('golden-hour-538') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 140); return 1; })()`);
    await h.startRec(); await h.sleep(1500);
    await h.js(`(() => { const c = [...document.querySelectorAll('section,article,div')].filter(d => d.innerText && d.innerText.includes('golden-hour-538') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; const r = [...c.querySelectorAll('tr')].find(r => r.innerText.includes('Funding goal reached')); const b = [...r.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Released'); const q = b.getBoundingClientRect(); const cur = document.querySelector('.hv-cur'); cur.style.left = (q.left + q.width / 2) + 'px'; cur.style.top = (q.top + q.height / 2) + 'px'; return 1; })()`);
    await h.sleep(5500);
  }],
  'launch': ['artist', async (h) => {
    const b = h.__b;
    const typeIn = async (label, text) => { await h.js(`(() => { const e = hv.field(${JSON.stringify(label)}); const r = e.getBoundingClientRect(); const c = document.querySelector('.hv-cur'); c.style.left = (r.left + 40) + 'px'; c.style.top = (r.top + r.height / 2) + 'px'; e.focus(); return 1; })()`); await h.sleep(700);
      for (let i = 1; i <= text.length; i++) { await h.js(`hv.set(${JSON.stringify(label)}, ${JSON.stringify(text.slice(0, i))})`); await h.sleep(28); } await h.sleep(250); };
    const next = async () => { await h.click('Continue', { sel: 'button' }); await h.sleep(900); await h.js('scrollTo(0,0)'); await h.sleep(400); };
    await h.goto(SITE + 'artist/onboarding', 11000); await h.js(HELP); await h.prep(); await h.startRec();
    await h.sleep(1500);
    await typeIn('Glass Horizon', 'Golden Hour'); await typeIn('Cerchio Blu', 'Lena Marsh');
    await typeIn('worth financing', 'Debut EP recorded with a live band at Bluehouse Studio.');
    await next();
    await h.click('Pre-production financing*', { sel: 'button' }); await h.sleep(600); await next();
    await typeIn('Analog Sun Studio', 'Bluehouse Studio');
    await typeIn('0x…', WALLETS.studio.address);
    await h.js(`(() => { const nums = [...document.querySelectorAll('input[type=number]')].filter(hv.vis); [2,1,1,1,5].forEach((v, i) => { const e = nums[i]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e, String(v)); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); }); return 1; })()`);
    { const { root } = await b.send('DOM.getDocument', { depth: -1 }); const { nodeIds } = await b.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'input[type=file]' }); await b.send('DOM.setFileInputFiles', { nodeId: nodeIds[1], files: [new URL('./cover2.jpg', import.meta.url).pathname] }); }
    await h.sleep(600);
    await h.scrollTo('Milestones', 1800, 120); await h.sleep(3500);
    await next();
    await h.js(`[...document.querySelectorAll('button')].filter(b => hv.vis(b) && b.textContent.trim() === 'Human').forEach(b => b.click()), 1`); await h.sleep(800); await next();
    await h.js(`[...document.querySelectorAll('input[type=checkbox]')].filter(e => !e.checked).forEach(e => e.click()), 1`); await h.sleep(600); await next();
    await h.sleep(1500);
    await h.js(`[...document.querySelectorAll('input[type=checkbox]')].filter(e => hv.vis(e) && !e.checked).forEach(e => e.click()), 1`); await h.sleep(500);
    await h.click('Launch campaign', { sel: 'button' });
    await waitFor(h, `/escrow created on-chain|Escrow created|escrowCreated/i.test([...document.querySelectorAll('[class*=toast]')].map(e => e.innerText).join(' '))`, 240000);
    await h.sleep(3000);
  }],
  'fan': ['fan', async (h) => {
    await h.goto(SITE + 'asset/golden-hour-538', 10000); await h.js(HELP); await h.prep(); await h.startRec();
    await h.sleep(2500);
    await h.point('Fund this campaign', { sel: 'button' }); await h.sleep(300);
    await typeInto(h, `[...document.querySelectorAll('input[type=text],input[type=number]')].find(e => hv.vis(e) && e.value === '1')`, '5'); await h.sleep(1200);
    await h.click('I understand this is a pilot structure*', { sel: 'label' }); await h.sleep(800);
    await h.click('Fund this campaign', { sel: 'button' });
    await waitFor(h, `/100%/.test([...document.querySelectorAll('div')].find(d => d.textContent.trim().startsWith('Funded'))?.textContent || '') || /contribut|funded/i.test([...document.querySelectorAll('[class*=toast]')].map(e => e.innerText).join(' '))`, 180000);
    await h.sleep(4000);
    await h.scrollTo('Milestone escrow snapshot', 1500, 300); await h.sleep(4000);
  }],
  'artist': ['artist', async (h) => {
    await h.goto(SITE + 'artist/milestones', 12000); await h.js(HELP); await h.prep();
    await h.js(`(() => { const c = [...document.querySelectorAll('section,article,div')].filter(d => d.innerText && d.innerText.includes('golden-hour-538') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 140); return 1; })()`);
    await h.startRec(); await h.sleep(3000);
    await clickIn(h, 'golden-hour-538', 'Confirm milestone');
    await waitFor(h, rowState('Funding goal reached', "!r.querySelector('button') && /waiting on the studio/i.test(r.innerText)"), 180000);
    await h.sleep(5000);
  }],
  'studio': ['studio', async (h) => {
    await h.goto(SITE + 'studio', 12000); await h.js(HELP); await h.prep();
    await h.js(`(() => { const c = [...document.querySelectorAll('section,article,div')].filter(d => d.innerText && d.innerText.includes('golden-hour-538') && d.querySelector('table')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 140); return 1; })()`);
    await h.startRec(); await h.sleep(3000);
    await clickIn(h, 'golden-hour-538', 'Confirm milestone');
    await waitFor(h, rowState('Funding goal reached', "/Released/.test(r.innerText)"), 180000);
    await h.sleep(6000);
  }],
};
const [role, fn] = scenes[which];
await recordScene('live-' + which, async (h) => { await attachWallet(h.__b, role); await fn(h); }, { port: 9400 + Object.keys(scenes).indexOf(which), poll: true });
