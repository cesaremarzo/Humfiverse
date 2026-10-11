import { recordScene } from './rec.mjs';
import { attachWallet } from './wallet.mjs';
import { readFileSync } from 'node:fs';
const SITE = 'https://humfiverse.com/#/';
const HELP = readFileSync(new URL('./helpers.js', import.meta.url), 'utf8');
const which = process.argv[2];
const setAll = (h, js) => h.js(`(() => { ${js} })()`);
const scenes = {
  // business voice (25.7 s): the internal escrow dashboard, fees per contract
  '06-admin': async (h) => {
    for (let i = 0; i < 12; i++) { await h.goto(SITE + 'admin/escrow', 14000); if (!(await h.js("/Http failure|No escrow campaigns yet/.test(document.body.innerText)"))) { console.log('clean load on try', i + 1); break; } console.log('retry'); await h.sleep(15000); }
    await h.prep(); await h.startRec();
    await h.sleep(2500);
    await h.scrollTo('Platform fees', 2000, 140); await h.sleep(1500);
    await h.point('Milestone escrow*', { sel: 'div,span,h3,h4' }); await h.sleep(4500);
    await h.point('Catalogue token*', { sel: 'div,span,h3,h4' }); await h.sleep(4000);
    await h.point('Secondary market*', { sel: 'div,span,h3,h4' }); await h.sleep(3000);
    await h.scrollTo('golden-hour-538', 2500, 160); await h.sleep(5000);
  },
  // problem voice (22.9 s): who it's for, the artist page
  '01-live': async (h) => {
    await h.goto(SITE + 'for-artists', 10000); await h.prep(); await h.startRec();
    await h.sleep(5000); await h.scrollTo(700, 5000); await h.sleep(4500); await h.scrollTo(1400, 5000); await h.sleep(5000);
  },
  // business voice (25.7 s): the wizard computing fees on a real draft
  '06-live': async (h) => {
    await attachWallet(h.__b, 'artist', { log: false });
    await h.goto(SITE + 'artist/onboarding', 10000); await h.js(HELP);
    await h.js("hv.set('Glass Horizon','Northern Lights II') + hv.set('Cerchio Blu','Lena Marsh') + hv.set('worth financing','Second EP.')");
    await h.js("hv.btn('Continue')"); await h.sleep(800); await h.js("hv.btn('Pre-production financing')"); await h.js("hv.btn('Continue')"); await h.sleep(1500);
    await h.js("hv.set('Analog Sun Studio','Bluehouse Studio')");
    await h.prep(); await h.js('scrollTo(0, 0)'); await h.sleep(500);
    await h.startRec();
    await h.sleep(3500);
    await h.scrollTo('Total funding requested', 3000, 380); await h.sleep(5500);
    await h.scrollTo('Milestones', 3000, 140); await h.sleep(6000);
    await h.scrollTo('Total', 2500, 520); await h.sleep(5000);
  },
  // close (12.3 s): the product's front door
  '07-live': async (h) => {
    await h.goto('https://humfiverse.com/', 10000); await h.prep(); await h.startRec();
    await h.sleep(4000); await h.point("I'm an artist", { sel: 'a,button' }); await h.sleep(8000);
  },
};
await recordScene(which, scenes[which], { port: 9500 + Object.keys(scenes).indexOf(which) });
