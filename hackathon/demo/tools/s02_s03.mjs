import { recordScene } from './rec.mjs';
const SITE = 'https://humfiverse.com/#/';
await recordScene('02-solution', async (h) => {
  await h.goto(SITE, 9000); await h.prep(); await h.startRec();
  await h.sleep(5000);
  await h.scrollTo(900, 4000); await h.sleep(3500);
  await h.scrollTo(1800, 4000); await h.sleep(3500);
}, { port: 9341 });
await recordScene('03-escrow', async (h) => {
  await h.goto(SITE + 'marketplace', 9000); await h.prep(); await h.startRec();
  await h.sleep(2500);
  await h.click('New song', { sel: 'h3,h2,a,div' }); await h.sleep(5000); await h.prep();
  await h.sleep(1500);
  await h.click('Escrow & milestones', { sel: 'button,a,[role=tab]' }); await h.sleep(2500);
  await h.scrollTo(350, 2500); await h.sleep(6000);
  await h.scrollTo(900, 3500); await h.sleep(6000);
  await h.goto(SITE + 'artist/milestones', 7000); await h.prep();
  await h.sleep(6000);
  await h.goto(SITE + 'studio', 7000); await h.prep();
  await h.sleep(5000);
}, { port: 9342 });
