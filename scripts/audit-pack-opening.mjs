/** Real booster UI + local fixtures. Run: node scripts/audit-pack-opening.mjs [--record] */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import localByDefault from 'next/dist/compiled/postcss-modules-local-by-default/index.js';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/pack-opening-studio');
const port = 3237;
const recordOnly = process.argv.includes('--record');
const origin = `http://127.0.0.1:${port}`;
const rarities = ['common', 'silver', 'gold', 'epic', 'legendary'];
const modules = {
  'pack-opening-audit': `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import '/src/app/globals.css';
    import { PackOpeningFlowModal } from '/src/components/account/PackOpeningFlowModal';
    const params = new URLSearchParams(location.search);
    const names = ['Strawberry CBD', 'Cherry Wine', 'ACDC', 'Harlequin', 'L’Arbre Mère - Toutes Variétés'];
    const codes = ['HH2026-020', 'HH2026-011', 'HH2026-005', 'HH2026-004', 'HH2026-001'];
    const cards = ['common', 'silver', 'gold', 'epic', 'legendary'].map((rarity, i) => ({
      id: 'audit-card-' + i, code: codes[i], name: names[i], rarity,
      cardNumber: Number(codes[i].slice(-3)), imageUrl: '/app/kanab-quest/buddies/' + codes[i].toLowerCase() + '-scene-v2.webp',
      description: 'Fixture locale', ownedCount: i === 1 ? 2 : 1, isBonus: false,
    }));
    const ticket = { id: 'audit-ticket', userId: 'audit', ticketNumber: 'KANAB QUEST · COLLECTION 01', orderAmount: 0, status: 'available', createdAt: '2026-09-22' };
    const result = { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, scratchedAt: '2026-09-22', card: cards[0], cards,
      inventory: { totalCards: 52, uniqueOwned: 12, totalOwnedCopies: 17, duplicateCopies: 5, byRarity: {} }, bonusPrize: null };
    window.__audit = { opens: 0, closes: 0, ticketIds: [], settled: false };
    const onOpen = async ticketId => {
      window.__audit.opens++; window.__audit.ticketIds.push(ticketId);
      if (params.has('deferred')) await new Promise(resolve => { window.__resolveOpen = resolve; });
      else await new Promise(resolve => setTimeout(resolve, 60));
      if (params.has('fail') && window.__audit.opens === 1) throw new Error('Réseau indisponible. Réessaie ce même booster.');
      window.__audit.settled = true;
      return result;
    };
    function App() {
      const [open, setOpen] = useState(false);
      return <><button id="audit-launch" type="button" onClick={() => setOpen(true)}>Ouvrir l’aperçu</button>
        <PackOpeningFlowModal ticket={open ? ticket : null} onOpen={onOpen} onClose={() => { window.__audit.closes++; setOpen(false); }} /></>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  `,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
};
const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, 'public'), cacheDir: resolve(output, 'vite-cache'),
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  resolve: { alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'pack-opening-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async transform(code, id) {
      const file = id.split('?')[0];
      if (file.endsWith('.module.css')) {
        // Match Next's pure CSS-module selectors before Vite transforms them.
        await postcss([localByDefault({ mode: 'pure' })]).process(code, { from: file });
      }
      return null;
    },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) {
        return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
      }
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Kanab Quest · Ouverture</title><style>@font-face{font-family:AuditDisplay;src:url('/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2');font-weight:800}@font-face{font-family:AuditBody;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody}body{background:#002d24}#audit-launch{margin:32px;padding:16px;background:#f4c43d;color:#002d24}</style><div id="root"></div><script type="module" src="/@id/__x00__pack-opening-audit"></script></html>`);
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser;
const errors = [], blockedRequests = [], results = [];
let scenario = 'boot';
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
    userDataDir: resolve(output, recordOnly ? 'chrome-profile-record' : 'chrome-profile'), args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push({ scenario, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ scenario, message: message.text() }); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().startsWith(origin) || request.url().startsWith('data:')) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  await page.evaluateOnNewDocument(() => {
    window.__audioAudit = { contexts: 0, closed: 0 };
    const NativeContext = window.AudioContext;
    if (NativeContext) {
      window.AudioContext = new Proxy(NativeContext, { construct(Target, args) {
        const context = Reflect.construct(Target, args);
        window.__audioAudit.contexts++;
        const close = context.close.bind(context);
        context.close = (...closeArgs) => { window.__audioAudit.closed++; return close(...closeArgs); };
        return context;
      } });
    }
  });
  const waitPhase = phase => page.waitForSelector(`[data-pack-phase="${phase}"]`);
  const waitMotion = motion => page.waitForSelector(`[data-card-motion="${motion}"]`);
  const button = label => page.locator(`button::-p-text(${label})`);
  const shot = name => page.screenshot({ path: resolve(output, name + '.png') });
  const decode = () => page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
  const state = () => page.evaluate(() => {
    const experience = document.querySelector('[data-pack-phase]');
    const card = document.querySelector('[data-card-revealed]');
    return { phase: experience?.dataset.packPhase, rarity: experience?.dataset.rarity,
      motion: document.querySelector('[data-card-motion]')?.dataset.cardMotion,
      revealed: card?.dataset.cardRevealed, cardLabel: card?.getAttribute('aria-label'),
      index: document.querySelector('[aria-current="step"]')?.getAttribute('aria-label') };
  });
  const checkLayout = async () => {
    await decode();
    const check = await page.evaluate(() => {
      const experience = document.querySelector('[data-pack-phase]');
      const dialog = document.querySelector('[role="dialog"]');
      const rect = dialog?.getBoundingClientRect();
      return { documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        experienceOverflow: !!experience && experience.scrollWidth > experience.clientWidth + 1,
        dialogInViewport: !!rect && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
        brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src) };
    });
    assert.equal(check.documentOverflow, false, scenario + ': document overflow');
    assert.equal(check.experienceOverflow, false, scenario + ': content overflow');
    assert.equal(check.dialogInViewport, true, scenario + ': modal outside viewport');
    assert.deepEqual(check.brokenImages, [], scenario + ': broken image');
    return check;
  };
  const visit = async (query = '', viewport = { width: 390, height: 844 }) => {
    await page.setViewport({ ...viewport, isMobile: viewport.width < 700, hasTouch: viewport.width < 700, deviceScaleFactor: 1 });
    await page.goto(origin + '/' + query, { waitUntil: 'networkidle0' });
    await page.click('#audit-launch');
    await waitPhase('idle'); await decode(); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      window.__trace = [];
      const capture = () => {
        const experience = document.querySelector('[data-pack-phase]');
        const next = { phase: experience?.dataset.packPhase, motion: document.querySelector('[data-card-motion]')?.dataset.cardMotion,
          rarity: experience?.dataset.rarity, revealed: document.querySelector('[data-card-revealed]')?.dataset.cardRevealed,
          index: document.querySelector('[aria-current="step"]')?.getAttribute('aria-label') };
        if (JSON.stringify(next) !== JSON.stringify(window.__trace.at(-1)?.state)) window.__trace.push({ at: performance.now(), state: next });
      };
      new MutationObserver(capture).observe(document.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['data-pack-phase', 'data-card-motion', 'data-card-revealed', 'data-rarity', 'aria-current'] });
      capture();
    });
    assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0, 'audio must require opt-in');
    assert.equal(await page.evaluate(() => window.__audit.opens), 0, 'display must not open the pack');
  };
  const ready = async () => { await waitPhase('cards'); await waitMotion('ready'); await decode(); };
  const assertSecret = async () => {
    const current = await state();
    assert.equal(current.revealed, 'false', 'new card stays face down');
    assert.match(current.cardLabel, /^Révéler la carte/, 'accessible label must conceal the card');
    assert.equal(await page.$('[data-card-revealed="true"]'), null);
  };
  const reveal = async (input, prefix) => {
    await assertSecret();
    if (input === 'keyboard') { await page.focus('[data-card-revealed]'); await page.keyboard.press('Enter'); }
    else if (input === 'touch') {
      const box = await (await page.$('[data-card-revealed]')).boundingBox();
      await page.touchscreen.touchStart(box.x + box.width * .85, box.y + box.height * .5);
      await page.touchscreen.touchMove(box.x + box.width * .15, box.y + box.height * .5);
      await page.touchscreen.touchEnd();
    } else await button('Révéler la carte').click();
    await waitMotion('revealing');
    assert.equal((await state()).revealed, 'false', 'face stays concealed during anticipation');
    assert(await page.$$eval('button[aria-label="Carte suivante"]', buttons => buttons.every(element => element.disabled)), 'navigation locks during flip');
    if (prefix) await shot(prefix + '-anticipation');
    await waitMotion('revealed');
    assert.equal((await state()).revealed, 'true');
  };

  if (recordOnly) {
    scenario = 'mobile-recording'; console.log('Pack opening audit:', scenario);
    await visit('', { width: 390, height: 844 });
    const ffmpegPath = (await import('ffmpeg-static')).default;
    const videoPath = resolve(output, 'opening-demo.webm');
    const recorder = await page.screencast({ path: videoPath, format: 'webm', fps: 30, quality: 23, ffmpegPath });
    const startedAt = Date.now();
    try {
      await sleep(900);
      const box = await (await page.$('[aria-label="Glissez pour ouvrir le booster"]')).boundingBox();
      const x = box.x + box.width * .15, y = box.y + box.height * .3;
      await page.touchscreen.touchStart(x, y);
      for (let step = 1; step <= 8; step++) {
        await page.touchscreen.touchMove(x + box.width * .075 * step, y);
        await sleep(45);
      }
      await page.touchscreen.touchEnd(); await ready(); await sleep(450);
      for (const [index] of rarities.entries()) {
        await button('Révéler la carte').click(); await waitMotion('revealed'); await sleep(600);
        if (index < rarities.length - 1) {
          await page.click('button[aria-label="Carte suivante"]'); await ready(); await sleep(250);
        }
      }
      await button('Voir mon butin').click(); await waitPhase('recap'); await sleep(1200);
      await shot('recording-recap');
    } finally { await recorder.stop(); }
    assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0, 'recorded demonstration stays muted');
    assert.deepEqual(errors, []); assert.deepEqual(blockedRequests, []);
    const recording = { passed: true, videoPath, width: 390, height: 844, fps: 30, muted: true, durationMs: Date.now() - startedAt, errors };
    await writeFile(resolve(output, 'recording-report.json'), JSON.stringify(recording, null, 2));
    console.log(JSON.stringify(recording));
  } else {
  for (const width of [320, 390, 768, 1440]) {
    scenario = 'viewport-' + width; console.log('Pack opening audit:', scenario);
    await visit('', { width, height: width < 700 ? 844 : 1000 });
    await sleep(700); await checkLayout(); await shot('sealed-' + width);
    if (width === 1440) {
      await page.click('button[aria-label="Son de l’ouverture"]');
      await page.waitForSelector('button[aria-label="Son de l’ouverture"][aria-pressed="true"]');
    }
    if (width === 390) {
      const box = await (await page.$('[aria-label="Glissez pour ouvrir le booster"]')).boundingBox();
      const x = box.x + box.width * .15, y = box.y + box.height * .3;
      await page.touchscreen.touchStart(x, y); await page.touchscreen.touchMove(x + box.width * .12, y); await page.touchscreen.touchEnd();
      assert.equal(await page.evaluate(() => window.__audit.opens), 0, 'short tear must not open');
      assert.equal((await state()).phase, 'idle');
      await page.touchscreen.touchStart(x, y); await page.touchscreen.touchMove(x + box.width * .75, y); await page.touchscreen.touchEnd();
    } else if (width === 768) {
      await page.focus('[aria-label="Glissez pour ouvrir le booster"]'); await page.keyboard.press('Enter');
    } else {
      await page.evaluate(() => {
        const open = [...document.querySelectorAll('button')].find(element => element.textContent.trim() === 'Ouvrir le pack');
        open.click(); open.click(); open.click();
        document.querySelector('[aria-label="Glissez pour ouvrir le booster"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
    }
    await waitPhase('opening'); await shot('opening-' + width);
    await ready(); await assertSecret(); await checkLayout(); await shot('card-back-' + width);
    assert.equal(await page.evaluate(() => window.__audit.opens), 1, 'repeated input must not duplicate the request');
    for (const [index, rarity] of rarities.entries()) {
      await reveal(width === 768 ? 'keyboard' : width === 390 && index === 1 ? 'touch' : 'button', width === 390 ? rarity + '-390' : null);
      assert.equal((await state()).rarity, rarity);
      await checkLayout(); await shot(rarity + '-' + width);
      if (index < rarities.length - 1) {
        await page.click('button[aria-label="Carte suivante"]');
        await waitMotion('exiting');
        assert(await page.$$eval('button[aria-label="Carte suivante"]', buttons => buttons.every(element => element.disabled)), 'navigation locks during exit');
        await ready(); await assertSecret();
      }
    }
    await button('Voir mon butin').click(); await waitPhase('recap'); await checkLayout();
    assert.equal(await page.$$eval('button[aria-label^="Revoir "]', elements => elements.length), 5);
    await shot('recap-' + width);
    await page.click('button[aria-label^="Revoir Harlequin"]'); await waitPhase('cards'); await waitMotion('revealed');
    assert.equal((await state()).rarity, 'epic', 'recap review keeps already revealed cards visible');
    assert.equal(await page.evaluate(() => window.__audit.opens), 1);
    await button('Voir mon butin').click(); await waitPhase('recap');
    await button('Ranger dans mon album').click(); await page.waitForSelector('[role="dialog"]', { hidden: true });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'audit-launch', 'focus returns to opener');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'scroll lock is released');
    assert.deepEqual(await page.evaluate(() => window.__audioAudit), width === 1440 ? { contexts: 1, closed: 1 } : { contexts: 0, closed: 0 }, 'audio remains opt-in through every rarity and closes with the modal');
    results.push({ scenario, passed: true, touch: width === 390, keyboard: width === 768, rarities, trace: await page.evaluate(() => window.__trace) });
  }

  scenario = 'slow-skip'; console.log('Pack opening audit:', scenario);
  await visit('?deferred=1'); await button('Ouvrir le pack').click(); await waitPhase('opening');
  await button('Passer l’animation').click(); await sleep(100);
  assert.equal((await state()).phase, 'opening', 'skip must still wait for the result');
  assert.deepEqual(await page.$eval('[data-card-revealed]', element => ({ revealed: element.dataset.cardRevealed, disabled: element.disabled, hidden: element.getAttribute('aria-hidden') })), { revealed: 'false', disabled: true, hidden: 'true' }, 'extracted back cannot reveal before the result');
  await page.evaluate(() => window.__resolveOpen()); await ready(); await assertSecret();
  await button('Tout révéler').click(); await waitPhase('recap');
  assert.equal(await page.$$eval('button[aria-label^="Revoir "]', elements => elements.length), 5);
  results.push({ scenario, passed: true });

  scenario = 'network-retry'; console.log('Pack opening audit:', scenario);
  await visit('?fail=1'); await button('Ouvrir le pack').click(); await waitPhase('error');
  assert.match(await page.$eval('[role="alert"]', element => element.textContent), /Réseau indisponible/);
  await shot('network-error'); await button('Réessayer').click(); await ready(); await assertSecret();
  assert.deepEqual(await page.evaluate(() => window.__audit.ticketIds), ['audit-ticket', 'audit-ticket']);
  results.push({ scenario, passed: true });

  scenario = 'sound-and-unmount'; console.log('Pack opening audit:', scenario);
  await visit('?deferred=1');
  const soundSelector = 'button[aria-label="Son de l’ouverture"]';
  assert.equal(await page.$eval(soundSelector, element => element.getAttribute('aria-pressed')), 'false');
  await page.click(soundSelector); await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-pressed') === 'true', {}, soundSelector);
  assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 1);
  await page.click(soundSelector); await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-pressed') === 'false', {}, soundSelector);
  await page.click(soundSelector); await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-pressed') === 'true', {}, soundSelector);
  assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 1, 'sound toggle reuses its context');
  await button('Ouvrir le pack').click(); await waitPhase('opening');
  await page.keyboard.press('Escape'); await page.waitForSelector('[role="dialog"]', { hidden: true });
  await page.evaluate(() => window.__resolveOpen()); await sleep(250);
  assert.equal(await page.$('[data-pack-phase]'), null, 'late result must not remount a closed pack');
  assert.equal(await page.evaluate(() => window.__audioAudit.closed), 1, 'audio context closes on unmount');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.click('#audit-launch'); await waitPhase('idle');
  assert.equal(await page.$eval(soundSelector, element => element.getAttribute('aria-pressed')), 'false', 'sound starts disabled on remount');
  assert.equal(await page.evaluate(() => window.__audit.opens), 1, 'remount must not repeat a purchase/open');
  await page.focus('button[aria-label="Fermer"]'); await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  assert(await page.$eval('[role="dialog"]', element => element.contains(document.activeElement)), 'focus stays within modal');
  await page.keyboard.press('Escape');
  results.push({ scenario, passed: true });

  scenario = 'reduced-motion-short-viewport'; console.log('Pack opening audit:', scenario);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await visit('', { width: 320, height: 480 }); await checkLayout(); await shot('reduced-motion-sealed-320x480');
  await button('Ouvrir le pack').click(); await ready(); await assertSecret(); await checkLayout(); await shot('reduced-motion-back-320x480');
  await button('Révéler la carte').click(); await waitMotion('revealed'); await checkLayout();
  await page.click('button[aria-label="Carte suivante"]'); await ready(); await assertSecret();
  await button('Tout révéler').click(); await waitPhase('recap'); await checkLayout();
  await shot('reduced-motion-recap-320x480');
  assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0);
  results.push({ scenario, passed: true });

  assert.deepEqual(errors, [], 'browser errors'); assert.deepEqual(blockedRequests, [], 'unexpected external requests');
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: true, results, errors, blockedRequests }, null, 2));
  console.log(JSON.stringify({ passed: true, output, scenarios: results.map(result => result.scenario) }));
  }
} catch (error) {
  await writeFile(resolve(output, recordOnly ? 'recording-report.json' : 'report.json'), JSON.stringify({ passed: false, scenario, error: String(error), results, errors, blockedRequests }, null, 2));
  const page = (await browser?.pages())?.at(-1);
  if (page) await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser?.close(); await server.close();
}
