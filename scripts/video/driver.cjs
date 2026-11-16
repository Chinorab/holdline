// Persistent capture driver: keeps one headed Chromium on the dev page and takes commands over HTTP.
//   POST /eval        body = JS expression or async IIFE source, evaluated in the page, JSON result
//   POST /goto?url=   navigate
//   POST /rec/start?name=  CDP screencast frames + in-page game audio
//   POST /rec/stop    writes clips/<name>/frames/*.jpg, times.json, audio.webm
//   POST /shot?name=  png screenshot
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = (process.env.VIDEO_OUT || 'video-out') + '/clips';
fs.mkdirSync(OUT, { recursive: true });
let page, cdp, rec = null;

const AUDIO_JS = `(() => {
  window.__cap = window.__cap || {};
  const head = window.__holdlineDebug.world.player.head;
  let listener = null; head.traverse((o) => { if (o.type === 'AudioListener') listener = o; });
  if (!listener) return 'no listener';
  const ctx = listener.context;
  const dest = ctx.createMediaStreamDestination();
  listener.gain.connect(dest);
  const mr = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
  const chunks = [];
  mr.ondataavailable = (e) => chunks.push(e.data);
  window.__cap = { mr, chunks, dest, listener, t0: Date.now(), state: ctx.state };
  mr.start(500);
  return 'audio ' + ctx.state;
})()`;
const AUDIO_STOP_JS = `(async () => {
  const c = window.__cap; if (!c || !c.mr) return null;
  await new Promise((r) => { c.mr.onstop = r; c.mr.stop(); });
  c.listener.gain.disconnect(c.dest);
  const b = new Blob(c.chunks, { type: 'audio/webm' });
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
  return { t0: c.t0, b64: btoa(s) };
})()`;

async function startRec(name) {
  const dir = path.join(OUT, name, 'frames');
  fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  rec = { name, dir, n: 0, times: [], audio: null };
  try { rec.audio = await page.evaluate(AUDIO_JS); } catch (e) { rec.audio = 'err ' + e.message; }
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  return { started: name, audio: rec.audio };
}
async function stopRec() {
  if (!rec) return null;
  await cdp.send('Page.stopScreencast');
  const r = rec; rec = null;
  let audio = null;
  try { audio = await page.evaluate(AUDIO_STOP_JS); } catch (e) { audio = null; }
  let marks = []; try { marks = await page.evaluate('window.__marks || []'); } catch (e) {}
  fs.writeFileSync(path.join(OUT, r.name, 'marks.json'), JSON.stringify(marks.map((m) => ({ n: m.n, s: m.t - (r.times[0] || m.t) }))));
  if (audio) fs.writeFileSync(path.join(OUT, r.name, 'audio.webm'), Buffer.from(audio.b64, 'base64'));
  fs.writeFileSync(path.join(OUT, r.name, 'times.json'), JSON.stringify({ times: r.times, audioT0: audio ? audio.t0 / 1000 : null }));
  const span = r.times.length > 1 ? r.times[r.times.length - 1] - r.times[0] : 0;
  return { name: r.name, frames: r.n, seconds: span, fps: span ? (r.n - 1) / span : 0, audio: !!audio };
}

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: process.env.CHROME_EXE || undefined,
    args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--window-size=1940,1200', '--window-position=0,0', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', (f) => {
    if (rec) {
      rec.n++;
      fs.writeFileSync(path.join(rec.dir, String(rec.n).padStart(6, '0') + '.jpg'), Buffer.from(f.data, 'base64'));
      rec.times.push(f.metadata.timestamp);
    }
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = ''; for await (const c of req) body += c;
    let out;
    try {
      if (u.pathname === '/eval') out = await page.evaluate(body);
      else if (u.pathname === '/goto') { await page.goto(u.searchParams.get('url')); out = 'ok'; }
      else if (u.pathname === '/click') { await page.click(u.searchParams.get('sel')); out = 'ok'; }
      else if (u.pathname === '/mouse') { const [x, y] = body.split(',').map(Number); await page.mouse.move(x, y, { steps: 25 }); out = 'ok'; }
      else if (u.pathname === '/script') { await page.addScriptTag({ path: u.searchParams.get('path') }); out = 'ok'; }
      else if (u.pathname === '/rec/start') out = await startRec(u.searchParams.get('name'));
      else if (u.pathname === '/rec/stop') out = await stopRec();
      else if (u.pathname === '/shot') { const p = path.join(OUT, u.searchParams.get('name') + '.png'); await page.screenshot({ path: p }); out = p; }
      else if (u.pathname === '/quit') { res.end('bye'); await browser.close(); process.exit(0); }
      res.end(JSON.stringify({ ok: true, out }));
    } catch (e) { res.end(JSON.stringify({ ok: false, err: String(e && e.message || e) })); }
  }).listen(8795, () => console.log('driver ready'));
})();
