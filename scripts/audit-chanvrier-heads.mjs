// Real avatar component in the same isolated Vite/Puppeteer setup as the editor audit.
// Screenshots require visual review: distinct pixels do not prove correct anatomy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { createServer, transformWithOxc } from 'vite';

const root = process.cwd();
const output = resolve(root, 'output/chanvrier-head-audit');
const port = 3218;
const origin = `http://127.0.0.1:${port}`;
const errors = [];
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChanvrierAvatar } from '/src/components/contest/ChanvrierAvatar';
import {
  DEFAULT_CHANVRIER_APPEARANCE as defaults,
  CHANVRIER_APPEARANCE_OPTIONS as options,
  CHANVRIER_SKINS as skins,
} from '/src/lib/arena-chanvrier';
const query = new URLSearchParams(location.search);
const micro = query.get('micro');
const face = query.get('face') || 'oval';
const hair = query.get('hair') || 'crop';
const full = query.get('view') === 'full';
const genders = [{ code: 'male', name: 'Masculin' }, { code: 'female', name: 'Féminin' }];
const choices = micro ? (micro === 'skin' ? skins : micro === 'gender' ? genders : options[micro]) : options.hair;
const base = {
  gender: 'male', clothing: 'ochre', skin: 'ivory',
  appearance: {
    ...defaults, face, hair, hairColor: 'chestnut',
    eyes: 'almond', eyebrows: 'natural', nose: 'small', mouth: 'smile',
    facialHair: 'none', accessory: 'none',
  },
};
window.avatarAuditCatalog = {
  faces: options.face.map(({ code }) => code),
  hairs: options.hair.map(({ code }) => code),
};
function App() {
  return <main>
    <h1>{micro ? 'Choix indépendant : ' + micro : 'Visage : ' + face}</h1>
    <p className="note">Aperçus du composant réel, proportions natives. Vérifier les contours, raccords et proportions.</p>
    <div className="grid">
      {choices.map(choice => {
        const profile = { ...base, appearance: { ...base.appearance } };
        if (micro === 'skin') profile.skin = choice.code;
        else if (micro === 'gender') profile.gender = choice.code;
        else profile.appearance[micro || 'hair'] = choice.code;
        return <figure key={choice.code} data-choice={choice.code}>
          <ChanvrierAvatar profile={profile} view={full ? 'full' : 'portrait'} className="portrait" />
          <figcaption><strong>{choice.name}</strong><span>{choice.code}</span></figcaption>
        </figure>;
      })}
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

const server = await createServer({
  root,
  configFile: false,
  envDir: false,
  cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') } },
  optimizeDeps: { include: ['react', 'react-dom/client'] },
  plugins: [{
    name: 'chanvrier-head-audit',
    resolveId(id) {
      if (id === 'chanvrier-head-entry') return '\0chanvrier-head-entry';
    },
    async load(id) {
      if (id === '\0chanvrier-head-entry') {
        return (await transformWithOxc(entry, 'head-entry.tsx', {
          lang: 'tsx', jsx: { runtime: 'automatic' },
        })).code;
      }
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Audit des portraits Chanvrier</title><link rel="icon" href="data:,">
          <style>
            *{box-sizing:border-box}body{margin:0;background:#f6e9c9;color:#003f30;font-family:Arial,sans-serif}
            main{padding:24px}h1{font-size:28px;margin:0 0 8px}.note{margin:0 0 24px;font-size:15px}
            .grid{display:grid;grid-template-columns:repeat(4,384px);gap:16px}
            figure{margin:0;background:#fff5df;box-shadow:inset 0 0 0 1px #d8c9a8;overflow:hidden}
            .portrait{display:block;width:384px;height:auto;object-fit:contain}
            figcaption{height:52px;text-align:center;display:flex;flex-direction:column;gap:4px;font-size:15px}
            figcaption span{font-size:12px;color:#5c685b}
          </style></head><body><div id="root"></div>
          <script type="module" src="/@id/__x00__chanvrier-head-entry"></script></body></html>`);
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  const executablePath = Launcher.getInstallations()[0];
  assert.ok(executablePath, 'A local Chromium browser is required for the visual audit.');
  browser = await puppeteer.launch({
    executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1632, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(origin)) {
      errors.push(`${request.failure()?.errorText || 'Request failed'} ${request.url()}`);
    }
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    void (request.url().startsWith(origin) || request.url().startsWith('data:')
      ? request.continue() : request.abort());
  });

  async function capture(query, name, expected) {
    await page.goto(`${origin}/?${query}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => {
      const canvases = [...document.querySelectorAll('canvas[data-avatar-state]')];
      return canvases.some(canvas => canvas.dataset.avatarState === 'error')
        || (canvases.length > 0 && canvases.every(canvas => canvas.dataset.avatarState === 'ready'));
    }, { timeout: 45000 });
    const portraits = await page.$$eval('figure[data-choice]', figures => figures.map(figure => {
      const canvas = figure.querySelector('canvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 32) opaque++;
      return {
        choice: figure.dataset.choice,
        state: canvas.dataset.avatarState,
        occupiedPixels: opaque,
        width: canvas.width,
        height: canvas.height,
        image: canvas.toDataURL(),
      };
    }));
    if (expected !== undefined) assert.equal(portraits.length, expected, `${name}: portrait count`);
    for (const portrait of portraits) {
      assert.equal(portrait.state, 'ready', `${name}/${portrait.choice}: asset loading`);
      assert.ok(portrait.occupiedPixels > 1000, `${name}/${portrait.choice}: a visible portrait is rendered`);
      portrait.hash = createHash('sha256').update(portrait.image).digest('hex');
      delete portrait.image;
    }
    assert.equal(new Set(portraits.map(portrait => portrait.hash)).size, portraits.length,
      `${name}: every selected option must produce a distinct portrait`);
    assert.deepEqual(errors, [], `${name}: browser and asset errors`);
    const screenshot = resolve(output, `${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    return { screenshot, portraits };
  }

  const faces = {};
  faces.oval = await capture('face=oval', 'face-oval', 12);
  const catalog = await page.evaluate(() => window.avatarAuditCatalog);
  for (const face of catalog.faces.filter(face => face !== 'oval')) {
    faces[face] = await capture(`face=${face}`, `face-${face}`, catalog.hairs.length);
  }
  for (const hair of catalog.hairs) {
    assert.equal(new Set(Object.values(faces).map(group =>
      group.portraits.find(portrait => portrait.choice === hair).hash)).size,
    catalog.faces.length, `${hair}: every face option must produce a distinct portrait`);
  }

  const microchoices = {};
  for (const choice of ['eyes', 'eyebrows', 'nose', 'mouth', 'facialHair', 'accessory', 'hairColor', 'eyeColor', 'skin']) {
    microchoices[choice] = await capture(`micro=${choice}&hair=crop`, `choices-${choice}`);
  }
  const bodychoices = {};
  for (const choice of ['top', 'bottom', 'shoes', 'gender', 'accessory']) {
    bodychoices[choice] = await capture(`micro=${choice}&hair=crop&view=full`, `body-${choice}`);
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'Loading and distinct-choice checks only. Review the screenshots for visual quality and placement.',
    avatarCssWidth: 384,
    combinationCount: catalog.faces.length * catalog.hairs.length,
    faces, microchoices, bodychoices, errors,
  }, null, 2) + '\n');
  console.log(`PASS: ${catalog.faces.length * catalog.hairs.length} hair/face combinations, ${Object.keys(microchoices).length} facial-choice grids and ${Object.keys(bodychoices).length} full-body grids; all assets loaded without browser errors. This is not a visual-quality assertion. Review screenshots: ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
