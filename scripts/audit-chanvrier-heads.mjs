// Real avatar component in the same isolated Vite/Puppeteer setup as the editor audit.
// Screenshots require visual review: distinct pixels do not prove correct anatomy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { createServer, transformWithOxc } from 'vite';

const root = process.cwd();
const output = resolve(root, 'output/chanvrier-head-audit');
const port = 3218;
const origin = `http://127.0.0.1:${port}`;
const errors = [];
const mobileWidth = 180;
// Report this diagnostic threshold; it is not a calibrated human-perception score.
const differenceThreshold = 16;
const baselinePath = process.argv.find(argument => argument.startsWith('--baseline='))?.slice('--baseline='.length);
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
const skin = query.get('skin') || 'ivory';
const full = query.get('view') === 'full';
const genders = [{ code: 'male', name: 'Masculin' }, { code: 'female', name: 'Féminin' }];
const choices = micro ? (micro === 'skin' ? skins : micro === 'gender' ? genders : options[micro]) : options.hair;
const base = {
  gender: 'male', clothing: 'ochre', skin,
  appearance: {
    ...defaults, face, hair, hairColor: 'chestnut',
    eyes: 'almond', eyebrows: 'natural', nose: 'small', mouth: 'smile',
    facialHair: query.get('facialHair') || 'none', accessory: query.get('accessory') || 'none',
  },
};
window.avatarAuditCatalog = {
  faces: options.face.map(({ code }) => code),
  hairs: options.hair.map(({ code }) => code),
};
function App() {
  return <main style={{ '--avatar-width': (query.get('width') || '384') + 'px' }}>
    <h1>{micro ? 'Choix indépendant : ' + micro : 'Visage : ' + face}</h1>
    <p className="note">Aperçus du composant réel, proportions natives. Vérifier les contours, raccords et proportions. Cheveux : {hair} · Peau : {skin}{query.get('facialHair') ? ' · Barbe : ' + query.get('facialHair') : ''}{query.get('accessory') ? ' · Accessoire : ' + query.get('accessory') : ''}.</p>
    <div className="grid" style={query.has('width') ? { gridTemplateColumns: 'repeat(6, var(--avatar-width))' } : undefined}>
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
            .grid{display:grid;grid-template-columns:repeat(4,var(--avatar-width));gap:16px}
            figure{margin:0;background:#fff5df;box-shadow:inset 0 0 0 1px #d8c9a8;overflow:hidden}
            .portrait{display:block;width:var(--avatar-width);height:auto;object-fit:contain}
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

  async function capture(query, name, expected, compareAtMobileSize = false) {
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
    const mobilePairs = compareAtMobileSize ? await page.$$eval('figure[data-choice]', (figures, settings) => {
      const samples = figures.map(figure => {
        const source = figure.querySelector('canvas');
        const thumbnail = document.createElement('canvas');
        thumbnail.width = settings.width;
        thumbnail.height = Math.round(settings.width * source.height / source.width);
        const context = thumbnail.getContext('2d');
        context.fillStyle = '#fff5df';
        context.fillRect(0, 0, thumbnail.width, thumbnail.height);
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
        return { choice: figure.dataset.choice, pixels: context.getImageData(0, 0, thumbnail.width, thumbnail.height).data };
      });
      const pairs = [];
      for (let left = 0; left < samples.length; left++) {
        for (let right = left + 1; right < samples.length; right++) {
          const first = samples[left], second = samples[right];
          let changedPixels = 0, strongPixels = 0, absoluteDelta = 0, maximumDelta = 0;
          let minX = settings.width, minY = settings.width, maxX = -1, maxY = -1;
          for (let offset = 0; offset < first.pixels.length; offset += 4) {
            let pixelDelta = 0;
            for (let channel = 0; channel < 3; channel++) {
              const delta = Math.abs(first.pixels[offset + channel] - second.pixels[offset + channel]);
              absoluteDelta += delta;
              pixelDelta = Math.max(pixelDelta, delta);
            }
            maximumDelta = Math.max(maximumDelta, pixelDelta);
            if (pixelDelta) changedPixels++;
            if (pixelDelta >= settings.threshold) {
              strongPixels++;
              const x = (offset / 4) % settings.width, y = Math.floor(offset / 4 / settings.width);
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
          }
          pairs.push({
            choices: [first.choice, second.choice], changedPixels, strongPixels,
            meanAbsoluteChannelDelta: Number((absoluteDelta / (first.pixels.length / 4 * 3)).toFixed(4)),
            maximumChannelDelta: maximumDelta,
            strongDifferenceBounds: strongPixels ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
          });
        }
      }
      return pairs;
    }, { width: mobileWidth, threshold: differenceThreshold }) : undefined;
    for (const pair of mobilePairs || []) {
      assert.ok(pair.strongPixels > 0,
        `${name}/${pair.choices.join(' vs ')}: selected variants must differ after reducing to ${mobileWidth}px`);
    }
    assert.deepEqual(errors, [], `${name}: browser and asset errors`);
    const screenshot = resolve(output, `${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    return { screenshot, portraits, mobilePairs };
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

  // Group by the attribute under review, so silhouettes are directly comparable.
  // The catalogue above still covers all 72 hairstyle/face combinations.
  const mobileComparisons = {};
  for (const hair of ['bald', 'crop', 'bob']) {
    mobileComparisons[`face-${hair}`] = await capture(
      `micro=face&hair=${hair}&width=${mobileWidth}`, `mobile-faces-${hair}`, catalog.faces.length, true);
  }
  for (const skin of ['ivory', 'ebony']) {
    for (const choice of ['nose', 'eyes', 'eyeColor']) {
      mobileComparisons[`${choice}-${skin}`] = await capture(
        `micro=${choice}&hair=crop&skin=${skin}&width=${mobileWidth}`, `mobile-${choice}-${skin}`, undefined, true);
    }
  }

  const noseOverlays = {};
  for (const [field, value] of [['facialHair', 'stubble'], ['facialHair', 'beard'], ['facialHair', 'moustache'], ['accessory', 'glasses'], ['accessory', 'round-glasses']]) {
    noseOverlays[value] = await capture(
      `micro=nose&hair=crop&${field}=${value}&width=${mobileWidth}`, `mobile-noses-${value}`, 3, true);
  }

  const microchoices = {};
  for (const choice of ['eyes', 'eyebrows', 'nose', 'mouth', 'facialHair', 'accessory', 'hairColor', 'eyeColor', 'skin']) {
    microchoices[choice] = await capture(`micro=${choice}&hair=crop`, `choices-${choice}`);
  }
  const bodychoices = {};
  for (const choice of ['top', 'bottom', 'shoes', 'gender', 'accessory']) {
    bodychoices[choice] = await capture(`micro=${choice}&hair=crop&view=full`, `body-${choice}`);
  }
  const baseline = baselinePath ? JSON.parse(await readFile(resolve(root, baselinePath), 'utf8')) : null;
  const baselineComparison = baseline ? Object.fromEntries(Object.entries(mobileComparisons).map(([name, group]) => [
    name, group.mobilePairs.map(pair => {
      const before = baseline.mobileComparisons?.[name]?.mobilePairs.find(candidate =>
        candidate.choices.join('|') === pair.choices.join('|'));
      return {
        choices: pair.choices, strongPixelsBefore: before?.strongPixels ?? null, strongPixelsAfter: pair.strongPixels,
        strongPixelRatio: before?.strongPixels ? Number((pair.strongPixels / before.strongPixels).toFixed(2)) : null,
      };
    }),
  ])) : undefined;
  await writeFile(resolve(output, 'report.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'Loading, distinct-choice and mobile downsampling checks. RGB deltas are diagnostics, not a calibrated perception or anatomy score; review the side-by-side screenshots.',
    avatarCssWidth: 384,
    mobileCssWidth: mobileWidth,
    differenceThreshold,
    combinationCount: catalog.faces.length * catalog.hairs.length,
    faces, mobileComparisons, baselineComparison, noseOverlays, microchoices, bodychoices, errors,
  }, null, 2) + '\n');
  console.log(`PASS: ${catalog.faces.length * catalog.hairs.length} hair/face combinations, ${Object.keys(mobileComparisons).length} side-by-side mobile grids, ${Object.keys(noseOverlays).length} nose/overlay grids, ${Object.keys(microchoices).length} facial-choice grids and ${Object.keys(bodychoices).length} full-body grids; all assets loaded without browser errors. Mobile RGB differences are diagnostics, not a visual-quality assertion. Review screenshots: ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
