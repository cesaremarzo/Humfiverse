// Keeps one browser (with a test wallet) open and takes commands over HTTP.
import http from 'node:http';
import { launch, sleep } from './cdp.mjs';
import { attachWallet } from './wallet.mjs';
import { dumpForm } from './explore.mjs';
const [role, port] = [process.argv[2], Number(process.argv[3] || 8790)];
const b = await launch({ port: port + 1000 });
await attachWallet(b, role);
const logs = [];
b.on((m) => { if (m.method === 'Runtime.consoleAPICalled' && /warn|error/.test(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)); });
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const u = new URL(req.url, 'http://x');
  try {
    let out;
    if (u.pathname === '/goto') { await b.goto(body, Number(u.searchParams.get('wait') || 8000)); out = 'ok'; }
    else if (u.pathname === '/eval') out = await b.evalJs(body);
    else if (u.pathname === '/dump') out = await dumpForm(b);
    else if (u.pathname === '/shot') { await b.shot(body); out = body; }
    else if (u.pathname === '/file') { const { nth, path } = JSON.parse(body); const { root } = await b.send('DOM.getDocument', { depth: -1 }); const { nodeIds } = await b.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'input[type=file]' }); await b.send('DOM.setFileInputFiles', { nodeId: nodeIds[nth], files: [path] }); out = 'file set on #' + nth + ' of ' + nodeIds.length; }
    else if (u.pathname === '/logs') { out = logs.splice(0).join('\n'); }
    else if (u.pathname === '/quit') { res.end('bye'); b.close(); process.exit(0); }
    res.end(typeof out === 'string' ? out : JSON.stringify(out));
  } catch (e) { res.statusCode = 500; res.end(String(e.message || e)); }
}).listen(port, () => console.log('ctl ready', role, port));
