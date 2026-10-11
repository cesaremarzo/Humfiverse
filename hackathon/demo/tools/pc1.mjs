import { recordScene } from './rec.mjs';
await recordScene('pitch-01-team', async (h) => { await h.goto(new URL('../../pitch/cards/01-team.html', import.meta.url).href, 2500); await h.js('document.getAnimations().forEach(a => { a.currentTime = 0; })'); await h.startRec(); await h.sleep(20000); }, { port: 9700 });
