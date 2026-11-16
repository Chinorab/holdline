// Renders the end card, caption plates and speed badges as PNG with the site's own fonts.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = (process.env.VIDEO_OUT || 'video-out') + '/build/png';
const F = (n) => 'data:font/woff2;base64,' + fs.readFileSync('public/fonts/' + n).toString('base64');
const text = JSON.parse(fs.readFileSync((process.env.VIDEO_OUT || 'video-out') + '/voice/text.json', 'utf8'));
const css = `
@font-face{font-family:Archivo;font-weight:100 900;font-stretch:62% 125%;src:url(${F('archivo-latin.woff2')}) format('woff2')}
@font-face{font-family:Atk;font-weight:200 800;src:url(${F('atkinson-hyperlegible-next-latin.woff2')}) format('woff2')}
html,body{margin:0;background:transparent}`;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_EXE || undefined });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  // End card
  await p.setContent(`<style>${css}
    body{width:1920px;height:1080px;background:#e4e2dd;color:#1d1c1a;display:flex;flex-direction:column;justify-content:center;padding-left:200px;box-sizing:border-box;font-family:Atk}
    h1{font-family:Archivo;font-stretch:112%;font-weight:800;font-size:150px;letter-spacing:-.04em;margin:0 0 28px;line-height:.9}
    p{font-size:46px;font-weight:500;margin:0 0 70px}
    .u{align-self:flex-start;font-size:38px;font-weight:650;border-top:3px solid #1d1c1a;padding-top:22px;display:inline-block}
    .s{font-size:30px;color:#5d5a56;margin-top:18px}</style>
    <h1>Holdline</h1><p>One wildfire a day, on your real table.</p><div class="u">holdline-kappa.vercel.app</div><div class="s">Meta Quest 3 and 3S, in the Quest browser</div>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/endcard.png` });
  // Caption plates: one per scene, bottom band, transparent around a dark plate.
  for (const [k, t] of Object.entries(text)) {
    await p.setContent(`<style>${css}
      body{width:1920px;height:1080px;display:flex;align-items:flex-end;justify-content:center}
      div{margin-bottom:64px;max-width:1380px;background:rgba(29,28,26,.88);color:#f3f1ed;font-family:Atk;font-weight:600;font-size:40px;line-height:1.3;padding:16px 30px;border-radius:6px;text-align:center;text-wrap:balance}</style><div>${t}</div>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${OUT}/cap_${k}.png`, omitBackground: true });
  }
  for (const s of ['2x', '3x', '4x', '5x', '8x', '16x']) {
    await p.setContent(`<style>${css}
      body{width:1920px;height:1080px}
      div{position:absolute;right:56px;top:48px;background:rgba(29,28,26,.82);color:#f3f1ed;font-family:Atk;font-weight:700;font-size:34px;padding:8px 18px;border-radius:6px}</style><div>${s}</div>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${OUT}/speed_${s}.png`, omitBackground: true });
  }
  await b.close();
  console.log('rendered');
})();
