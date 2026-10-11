import { recordScene } from './rec.mjs';
const SITE = 'https://humfiverse.com/#/';
const CARDS = new URL('../cards/', import.meta.url).href;
const ES = 'https://sepolia.etherscan.io/address/';
const only = process.argv[2];
const D = { '01': 22.4, '02': 14.4, '03': 43.0, '04': 23.7, '05': 16.0, '06': 25.2, '07': 11.3 };
const pad = (k) => (D[k] + 0.8) * 1000;
// Hide the escrow tab's "Governance" card: it describes an advisory vote the contracts don't have.
const hideGov = `(() => { const h = [...document.querySelectorAll('h2,h3,h4,div,span')].find(e => e.children.length === 0 && e.textContent.trim() === 'Governance'); if (h) { let p = h; for (let i = 0; i < 4 && p.parentElement; i++) { p = p.parentElement; if (p.getBoundingClientRect().height > 80) break; } p.style.display = 'none'; } return !!h; })()`;
const cookies = `(() => { const b = [...document.querySelectorAll('button,a')].find(e => /^(Got it!|Accept all|Accept|Accept selection|Save settings|Reject all)$/.test(e.textContent.trim())); if (b) b.click(); return !!b; })()`;
const scenes = {
  '01-problem': async (h) => { await h.goto(CARDS + '01-problem.html', 2500); await h.js('document.getAnimations().forEach(a => { a.currentTime = 0; })'); await h.startRec(); await h.sleep(pad('01')); },
  '02-solution': async (h) => {
    await h.goto(SITE, 9000); await h.prep(); await h.startRec();
    await h.sleep(6500); await h.scrollTo(900, 3500); await h.sleep(5200);
  },
  '03-escrow': async (h) => {
    await h.goto(SITE + 'marketplace', 9000); await h.prep(); await h.startRec();
    await h.sleep(2200); await h.click('New song', { sel: 'h3,h2,a,div' }); await h.sleep(3500); await h.prep();
    await h.scrollTo('Milestone escrow snapshot', 2000, 260); await h.sleep(4000);
    await h.click('Escrow & milestones', { sel: 'button,a,[role=tab]' }); await h.sleep(500); await h.js(hideGov); await h.scrollTo(0, 600);
    await h.sleep(10500);
    await h.cutTo(ES + '0xBAEbC0f24C3528137B2A5DcC13E276E7c652a82A', 6000, async () => { await h.js(cookies); await h.sleep(800); await h.prep(); await h.js('scrollTo(0, 380)'); });
    await h.sleep(800); await h.point('Confirm Mile*', { sel: 'span,div,a,button' }); await h.sleep(7500);
    await h.point('Refund', { sel: 'span,div,a,button' }); await h.sleep(11000);
  },
  '04-catalogue': async (h) => {
    await h.goto(SITE + 'asset/honest-man-595', 9000); await h.prep(); await h.startRec();
    await h.sleep(2500); await h.scrollTo('On-chain token', 2500, 200); await h.sleep(2500);
    await h.scrollTo('Royalty payouts on chain', 2500, 160); await h.sleep(7000);
    await h.cutTo(SITE + 'asset/test-878', 8000, async () => { await h.prep(); await h.js(`(() => { const e = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && x.textContent.trim() === 'Token price history'); if (e) scrollTo(0, e.getBoundingClientRect().top + scrollY - 200); return 1; })()`); });
    await h.sleep(7500);
  },
  '05-trust': async (h) => {
    await h.goto(ES + '0x3ad890480fce3070BA1B8341dc455c5D52048cF9', 6000); await h.js(cookies); await h.sleep(800); await h.prep(); await h.startRec();
    await h.sleep(800); await h.scrollTo(380, 1800); await h.sleep(3500);
    await h.cutTo('https://app.safe.global/settings/setup?safe=sep:0xBA2ad0Ca063092E350f1427dd86F7E9C8730245d', 14000, async () => { await h.js(cookies); await h.sleep(1500); await h.js(cookies); await h.sleep(800); });
    await h.sleep(5000);
    await h.cutTo('https://github.com/cesaremarzo/Humfiverse/tree/main/contracts/contracts', 6000);
    await h.sleep(5800);
  },
  '06-business': async (h) => { await h.goto(CARDS + '06-business.html', 2500); await h.js('document.getAnimations().forEach(a => { a.currentTime = 0; })'); await h.startRec(); await h.sleep(pad('06')); },
  '07-close': async (h) => { await h.goto(CARDS + '07-close.html', 2500); await h.js('document.getAnimations().forEach(a => { a.currentTime = 0; })'); await h.startRec(); await h.sleep(pad('07')); },
};
let port = 9360;
for (const [name, fn] of Object.entries(scenes)) if (!only || name.startsWith(only)) await recordScene(name, fn, { port: port++ });
