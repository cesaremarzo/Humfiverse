import { recordScene } from './rec.mjs';
const C = new URL('../../pitch/cards/', import.meta.url).href;
const D = { '01-team': 19.7, '02-problem': 24.2, '04-why-now': 14.6, '06-business': 22.0, '07-next': 11.1 };
let port = 9600;
for (const [n, d] of Object.entries(D)) {
  await recordScene('pitch-' + n, async (h) => { await h.goto(C + n + '.html', 2500); await h.js('document.getAnimations().forEach(a => { a.currentTime = 0; })'); await h.startRec(); await h.sleep(d * 1000 + 300); }, { port: port++ });
}
