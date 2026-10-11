// Records one scene of the live site as an MP4 via CDP screencast.
import { launch, sleep } from './cdp.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export async function recordScene(name, script, { port = 9340, poll = false } = {}) {
  const b = await launch({ port });
  const frames = [];
  b.on((m) => {
    if (m.method === 'Page.screencastFrame') {
      if (!recording) { b.send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {}); return; }
      frames.push({ data: m.params.data, t: m.params.metadata.timestamp, cut: pendingCut }); pendingCut = false;
      b.send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
    }
  });
  const h = helpers(b); h.__b = b;
  let recording = false; let pendingCut = false; let started = false;
  h.startRec = async () => { if (poll) { if (frames.length) pendingCut = true; if (!recording) { recording = true; (async () => { while (recording) { const t = Date.now() / 1000; try { const { data } = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); if (recording) { frames.push({ data, t, cut: pendingCut }); pendingCut = false; } } catch {} await sleep(30); } })(); } return; } await b.evalJs(`(() => { if (window.__hvTick) return 1; window.__hvTick = 1; const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;z-index:2147483647;pointer-events:none'; document.documentElement.appendChild(d); let k = 0; const f = () => { k ^= 1; d.style.background = k ? 'rgba(8,9,12,.02)' : 'rgba(8,9,12,.03)'; requestAnimationFrame(f); }; f(); return 1; })()`).catch(() => {}); if (!started) { started = true; await b.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 }); } if (frames.length) pendingCut = true; recording = true; await sleep(60); };
  h.pause = () => { recording = false; };
  h.stopRec = async () => { recording = false; await sleep(300); };
  // Navigate off-camera: the cut goes straight from the last frame to the loaded page.
  h.cutTo = async (url, wait = 6000, after) => { recording = false; await b.goto(url, wait); if (after) await after(); await h.startRec(); };
  await script(h);
  if (poll) { recording = false; await sleep(400); }
  const stopT = Date.now() / 1000;
  if (!poll) await b.send('Page.stopScreencast');
  b.close();
  // Frames arrive only when the page repaints: hold each frame until the next one.
  const dir = `../frames/${name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  let list = '';
  frames.forEach((f, i) => {
    const file = `${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(`${dir}/${file}`, Buffer.from(f.data, 'base64'));
    const next = frames[i + 1] ? (frames[i + 1].cut ? f.t + 1 / 30 : frames[i + 1].t) : f.t + 20;
    list += `file '${file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
  });
  list += `file '${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(`${dir}/list.txt`, list);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`,
    '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', `../scenes/${name}.mp4`]);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `../scenes/${name}.mp4`]).toString().trim();
  console.log(`${name}: ${frames.length} frames, ${dur}s`);
}

function helpers(b) {
  const js = b.evalJs;
  const h = {
    goto: (url, wait) => b.goto(url, wait),
    sleep,
    js,
    // Hide noise that isn't part of the story; add a visible cursor.
    prep: () => js(`(() => {
      const s = document.createElement('style');
      s.textContent = '.hv-cur{position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(167,151,255,.35);border:2px solid #fff;box-shadow:0 0 18px rgba(167,151,255,.8);pointer-events:none;transition:left .9s cubic-bezier(.4,0,.2,1),top .9s cubic-bezier(.4,0,.2,1),transform .15s}.hv-cur.down{transform:scale(.7)}';
      document.head.appendChild(s);
      if (!document.querySelector('.hv-cur')) { const c = document.createElement('div'); c.className = 'hv-cur'; c.style.left = '1500px'; c.style.top = '700px'; document.body.appendChild(c); }
      return true; })()`),
    // Smooth scroll to y (absolute) or to an element's top minus offset.
    scrollTo: async (target, ms = 1800, offset = 120) => {
      await js(`new Promise((res) => {
        const t = ${JSON.stringify(target)};
        const y0 = window.scrollY;
        let y1 = typeof t === 'number' ? t : (() => { const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === t) || document.querySelector(t); return el ? el.getBoundingClientRect().top + y0 - ${offset} : y0; })();
        y1 = Math.max(0, Math.min(y1, document.documentElement.scrollHeight - innerHeight));
        const st = performance.now();
        const step = (now) => { const p = Math.min(1, (now - st) / ${ms}); const e = p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2; scrollTo(0, y0 + (y1 - y0) * e); p < 1 ? requestAnimationFrame(step) : res(true); };
        requestAnimationFrame(step);
      })`);
    },
    // Move the fake cursor to the element whose text matches, then click it.
    click: async (text, { sel = 'a,button,[role=tab],li,span,div', click = true } = {}) => {
      const ok = await js(`(() => {
        const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.offsetParent && (e.textContent.trim() === ${JSON.stringify(text)} || (${JSON.stringify(text)}.endsWith('*') && e.textContent.trim().startsWith(${JSON.stringify(text)}.slice(0, -1)))));
        const el = els[0]; if (!el) return false;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect(); const c = document.querySelector('.hv-cur');
        c.style.left = (r.left + r.width / 2) + 'px'; c.style.top = (r.top + r.height / 2) + 'px';
        window.__hvClick = el; return true; })()`);
      if (!ok) { console.warn('click target not found:', text); return; }
      await sleep(1100);
      await js(`document.querySelector('.hv-cur').classList.add('down')`); await sleep(160);
      await js(`document.querySelector('.hv-cur').classList.remove('down')`);
      if (click) await js(`window.__hvClick.click(), true`);
    },
    point: async (text, o = {}) => h.click(text, { ...o, click: false }),
  };
  return h;
}
