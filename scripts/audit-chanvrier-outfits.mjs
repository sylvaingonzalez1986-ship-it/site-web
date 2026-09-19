// Captures the real avatar renderer. Loading checks support a separate visual review.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { createServer, transformWithOxc } from 'vite';

const root = process.cwd();
const phase = process.argv.includes('--before') ? 'before' : 'after';
const output = resolve(root, 'output/chanvrier-outfit-audit', phase);
const reference = resolve(root, 'output/imagegen/sylvain-outfits-v5/source/current-reference.png');
const origin = 'http://127.0.0.1:3220';
const errors = [];
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChanvrierAvatar } from '/src/components/contest/ChanvrierAvatar';
import { DEFAULT_CHANVRIER_APPEARANCE as defaults, CHANVRIER_APPEARANCE_OPTIONS as options, CHANVRIER_SKINS as skins, CHANVRIER_CLOTHES as colors } from '/src/lib/arena-chanvrier';
const mode = new URLSearchParams(location.search).get('mode') || 'reference';
const base = { gender: 'male', clothing: 'ochre', skin: 'ivory', appearance: { ...defaults, hair: 'crop', hairColor: 'black', mouth: 'grin', top: 'tee', bottom: 'jeans', bottomColor: 'teal', shoes: 'work', shoeColor: 'ochre', accessory: 'none' } };
const profiles = [];
function add(key, label, changes, appearance) { profiles.push({ key, label, profile: { ...base, ...changes, appearance: { ...base.appearance, ...appearance } } }); }
if (mode === 'bottom-shoes') for (const bottom of options.bottom) for (const shoe of options.shoes) add(bottom.code + '-' + shoe.code, bottom.name + ' / ' + shoe.name, {}, { bottom: bottom.code, shoes: shoe.code });
else if (mode === 'tops') for (const top of options.top) add(top.code, top.name, {}, { top: top.code });
else if (mode === 'silhouettes') for (const gender of ['male', 'female']) for (const skin of skins) add(gender + '-' + skin.code, gender + ' / ' + skin.name, { gender, skin: skin.code }, { top: 'tee', bottom: 'shorts', shoes: 'sneakers' });
else if (mode === 'colors') for (const color of colors) add(color.code, color.name, { clothing: color.code }, { top: 'jacket', bottom: 'cargo', bottomColor: color.code, shoes: 'high-tops', shoeColor: color.code });
else add('reference', 'Personnage de référence', {}, {});
function App() { return <main><h1>{mode}</h1><div className="grid">{profiles.map(({ key, label, profile }) => <figure key={key} data-choice={key}><ChanvrierAvatar profile={profile} className="avatar"/><figcaption>{label}</figcaption></figure>)}</div></main>; }
createRoot(document.getElementById('root')).render(<App/>);
`;

const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') } },
  optimizeDeps: { include: ['react', 'react-dom/client'] },
  plugins: [{
    name: 'chanvrier-outfit-audit',
    resolveId(id) { if (id === 'chanvrier-outfit-entry') return '\0chanvrier-outfit-entry'; },
    async load(id) { if (id === '\0chanvrier-outfit-entry') return (await transformWithOxc(entry, 'outfit-entry.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Audit des tenues</title><style>*{box-sizing:border-box}body{margin:0;background:#f6e9c9;color:#003f30;font-family:Arial,sans-serif}main{padding:24px}h1{margin:0 0 16px;font-size:24px}.grid{display:grid;grid-template-columns:repeat(4,288px);gap:16px}figure{margin:0;background:#fff5df;box-shadow:inset 0 0 0 1px #d8c9a8;overflow:hidden}.avatar{display:block;width:288px;height:480px}figcaption{height:48px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:14px;padding:8px}</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__chanvrier-outfit-entry"></script></body></html>`);
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3220, strictPort: true, hmr: false, watch: null },
});

let browser;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  const executablePath = Launcher.getInstallations()[0];
  assert.ok(executablePath, 'Chromium installation required.');
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1248, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => { if (request.url().startsWith(origin)) errors.push(`${request.failure()?.errorText} ${request.url()}`); });
  await page.setRequestInterception(true);
  page.on('request', request => { void (request.url().startsWith(origin) || request.url().startsWith('data:') ? request.continue() : request.abort()); });
  const groups = {};
  for (const mode of ['reference', 'bottom-shoes', 'tops', 'silhouettes', 'colors']) {
    await page.goto(`${origin}/?mode=${mode}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => { const items = [...document.querySelectorAll('canvas[data-avatar-state]')]; return items.length && items.every(item => item.dataset.avatarState !== 'loading'); }, { timeout: 45000 });
    const portraits = await page.$$eval('figure[data-choice]', figures => figures.map(figure => {
      const canvas = figure.querySelector('canvas');
      const ankles = document.createElement('canvas'); ankles.width = 540; ankles.height = 280;
      ankles.getContext('2d').drawImage(canvas, 140, 980, 540, 280, 0, 0, 540, 280);
      return { choice: figure.dataset.choice, state: canvas.dataset.avatarState, image: canvas.toDataURL(), ankles: ankles.toDataURL() };
    }));
    for (const portrait of portraits) {
      assert.equal(portrait.state, 'ready', `${mode}/${portrait.choice} should load`);
      portrait.hash = createHash('sha256').update(portrait.image).digest('hex');
      if (mode === 'reference') {
        await writeFile(resolve(output, 'reference.png'), Buffer.from(portrait.image.split(',')[1], 'base64'));
        if (phase === 'before') {
          await mkdir(resolve(reference, '..'), { recursive: true });
          await writeFile(reference, Buffer.from(portrait.image.split(',')[1], 'base64'));
        }
      }
      delete portrait.image;
    }
    assert.equal(new Set(portraits.map(item => item.hash)).size, portraits.length, `${mode} choices should differ`);
    assert.deepEqual(errors, [], 'Browser errors');
    await page.screenshot({ path: resolve(output, `${mode}.png`), fullPage: true });
    if (mode === 'bottom-shoes') {
      assert.equal(portraits.length, 16);
      await page.evaluate(items => {
        for (const item of items) {
          const figure = [...document.querySelectorAll('figure')].find(node => node.dataset.choice === item.choice);
          const canvas = figure.querySelector('canvas'); const image = new Image(); image.src = item.ankles;
          image.style.cssText = 'width:288px;height:auto;display:block'; canvas.replaceWith(image);
        }
      }, portraits);
      await page.waitForFunction(() => [...document.images].every(item => item.complete));
      await page.screenshot({ path: resolve(output, 'ankle-detail.png'), fullPage: true });
    }
    portraits.forEach(item => delete item.ankles);
    groups[mode] = portraits;
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), phase, note: 'Asset loading and independent choices verified. Screenshots require visual inspection.', groups, errors }, null, 2) + '\n');
  console.log(`PASS: 16 bottoms/shoes combinations plus tops, silhouettes and colors. Review ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
