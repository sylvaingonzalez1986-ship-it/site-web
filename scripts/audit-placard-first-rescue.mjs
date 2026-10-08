/** First-culture rescue and recovery UI, real components/engine, isolated local fixtures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/placard-first-rescue');
const port = 3240;
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'rescue-fixture': `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import '/src/app/globals.css';
    import { KanabQuestDicePrototype } from '/src/components/placard/KanabQuestDicePrototype';
    import { startKqGame, playKqCard, resolveKqStage, advanceKqStage } from '/src/lib/kanab-quest-game';
    import { encodeKqSave, parseKqGameSave } from '/src/lib/kanab-quest-persistence';
    import { KQ_LOCAL_KEYS } from '/src/lib/kanab-quest-repository';
    const app = createRoot(document.getElementById('root')); let renderKey = 0;
    const render = () => app.render(<div key={++renderKey} data-rescue-fixture><KanabQuestDicePrototype apiScope="admin" showAdminOperations={false} viewMode="game" /></div>);
    const store = state => {
      const encoded = encodeKqSave(state);
      if (!parseKqGameSave(encoded)) throw new Error('Rescue fixture rejected by save parser');
      localStorage.setItem(KQ_LOCAL_KEYS.game, encoded);
    };
    window.__readRescue = () => parseKqGameSave(localStorage.getItem(KQ_LOCAL_KEYS.game));
    window.__rescueAccountSnapshot = () => ({ game: localStorage.getItem(KQ_LOCAL_KEYS.game), inventory: localStorage.getItem(KQ_LOCAL_KEYS.inventory), burns: localStorage.getItem(KQ_LOCAL_KEYS.burnHistory) });
    window.__showRescue = (mode = 'available') => {
      localStorage.clear(); sessionStorage.clear();
      let state = startKqGame(270926, {
        deckCodes: ['BOTTE-003', 'BOTTE-005', 'BOTTE-006'],
        heritageCode: 'HERITAGE-002', startedAt: '2026-10-07T12:00:00Z',
      });
      state.situationCodes = ['SIT-007','SIT-002','SIT-009','SIT-004','SIT-005','SIT-006'];
      if (mode !== 'legacy-second-zero') state.firstCultureRescue = true;
      if (mode === 'second-zero' || mode === 'legacy-second-zero') {
        state = playKqCard(state, 'BOTTE-003');
        if (!state.usedCards.includes('BOTTE-003')) throw new Error('Fixture must include one genuinely used card');
        state = advanceKqStage(resolveKqStage({ ...state, phase: 'rolled', dice: [2,2,3] }));
        state = { ...state, phase: 'rolled', dice: [2,2,3], rollNonce: state.rollNonce + 1 };
      }
      store(state);
      localStorage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify({ 'BOTTE-003': 2, 'BOTTE-005': 3, 'BOTTE-006': 3 }));
      localStorage.setItem(KQ_LOCAL_KEYS.onboardingSeen, '1');
      localStorage.setItem('kq-dice-direct-result', '1');
      render();
    };
    window.__injectNextZero = () => {
      const state = window.__readRescue();
      if (!state || state.phase !== 'prepare') throw new Error('Only inject a fixture roll after advancing through the real UI');
      store({ ...state, phase: 'rolled', dice: [2,2,3], rollNonce: state.rollNonce + 1 });
      render();
    };
    window.__unprotectedVerdict = () => resolveKqStage({ ...window.__readRescue(), firstCultureRescue: undefined });
    if (new URLSearchParams(location.search).has('resume') && window.__readRescue()) render();
    else window.__showRescue();
  `,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>; }`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}) { return <a {...props}/>; }`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader, options={}) { const Component=React.lazy(()=>loader().then(m=>({default:m.default||m}))); return props=><React.Suspense fallback={options.loading?React.createElement(options.loading):null}><Component {...props}/></React.Suspense>; }`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}}); export const usePathname=()=>'/dev/placard'; export const useSearchParams=()=>new URLSearchParams();`,
};

const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'first-rescue-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/') return next();
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Secours de première culture — audit local</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__rescue-fixture"></script></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser;
let page;
const errors = [], results = [], apiRequests = [], blockedRequests = [];
const primary = '[data-culture-primary-action]';
const actionbar = '[data-culture-actionbar]';
const rescue = '[data-culture-rescue]';
const trial = '[data-arena-first-culture][open]';
const trialAction = action => `${trial} [data-first-culture-action="${action}"]`;
const report = {
  passed: false, results, errors, apiRequests, blockedRequests,
  scope: 'Browser UI and local persistence only. All API calls intercepted; no credentials, live data or server eligibility checks.',
};

try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:') return void request.continue();
    if (url.origin !== origin) {
      blockedRequests.push({ origin: url.origin, path: url.pathname, method: request.method() });
      return void request.abort();
    }
    if (url.pathname.startsWith('/api/')) {
      apiRequests.push({ method: request.method(), path: url.pathname });
      return void request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'API désactivée pour cet audit local.' }) });
    }
    void request.continue();
  });

  const noOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label);
  const screenshot = async name => page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  const click = async selector => {
    await page.waitForSelector(`${selector}:not(:disabled)`);
    await page.$eval(selector, element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    assert.equal(await page.$eval(selector, element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return rect.height >= 44 && (hit === element || element.contains(hit));
    }), true, `${selector}: unobscured target at least 44px`);
    await page.click(selector);
  };
  const assertPrimary = async (action, mobile, label) => {
    await page.waitForSelector(`${primary}[data-action="${action}"]:not(:disabled)`);
    assert.equal((await page.$$(primary)).length, 1, `${label}: one primary action`);
    const bounds = await page.$eval(primary, element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { top: rect.top, bottom: rect.bottom, height: rect.height, viewport: innerHeight, clickable: hit === element || element.contains(hit) };
    });
    assert.ok(bounds.height >= 44, `${label}: touch target`);
    if (mobile) assert.ok(bounds.top >= 0 && bounds.bottom <= bounds.viewport + 1 && bounds.clickable, `${label}: mobile action remains available ${JSON.stringify(bounds)}`);
    return bounds;
  };
  const show = async mode => {
    await page.evaluate(mode => window.__showRescue(mode), mode);
    await page.waitForSelector('[data-culture-play]');
    await page.waitForFunction(mode => {
      const state = window.__readRescue();
      return state?.phase === (mode === 'available' ? 'prepare' : 'rolled')
        && document.querySelector('[data-culture-decision]')?.dataset.phase === state.phase;
    }, {}, mode);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  };

  for (const { width, height } of [{ width: 320, height: 844 }, { width: 390, height: 600 }, { width: 1440, height: 900 }]) {
    const mobile = width <= 760;
    const label = `${width}x${height}`;
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await show('available');
    await page.waitForSelector(`${rescue}[data-status="available"]`);
    assert.match(await page.$eval(rescue, element => element.textContent), /première culture.*secours gratuit/is);
    const openingAction = await assertPrimary('roll', mobile, `available ${label}`);
    await noOverflow(`available ${label}`);
    await screenshot(`available-${label}`);

    await show('second-zero');
    await page.waitForSelector(`${rescue}[data-status="available"]`);
    const before = await page.evaluate(() => window.__readRescue());
    assert.equal(before.history.filter(entry => entry.total === 0).length, 1);
    assert.equal(before.usedCards.length, 1);
    const normalVerdict = await page.evaluate(() => window.__unprotectedVerdict());
    const previewText = await page.$eval('[data-culture-result]', element => element.textContent);
    assert.match(previewText, /secours gratuit.*culture continuera/is);
    assert.doesNotMatch(previewText, /entraînera la mort|fera mourir|mettra fin/i);
    assert.match(await page.$eval(actionbar, element => element.textContent), /secours.*continuer/is);
    await assertPrimary('resolve', mobile, `second zero ${label}`);
    await noOverflow(`second zero ${label}`);
    await screenshot(`before-rescue-${label}`);
    await click(primary);
    await page.waitForSelector('[data-culture-rescue-receipt]');
    await page.waitForFunction(() => window.__readRescue()?.phase === 'resolved');
    const rescued = await page.evaluate(() => window.__readRescue());
    assert.equal(rescued.cultureDead === true, false);
    assert.equal(rescued.history.at(-1).rescued, true);
    assert.equal(rescued.history.filter(entry => entry.rescued).length, 1);
    assert.equal(rescued.history.filter(entry => entry.total === 0).length, 2);
    for (const field of ['dice', 'quality', 'xp', 'pressure', 'usedCards', 'deckCodes', 'traits']) {
      assert.deepEqual(rescued[field], normalVerdict[field], `${label}: rescue preserves normal ${field}`);
    }
    const { rescued: marker, ...rescuedEntry } = rescued.history.at(-1);
    assert.equal(marker, true);
    assert.deepEqual(rescuedEntry, normalVerdict.history.at(-1), `${label}: rescue preserves stage verdict and gains`);
    assert.equal((await page.$$('[data-outcome="dead"]')).length, 0);
    assert.equal(await page.$eval(rescue, element => element.dataset.status), 'used');
    assert.match(await page.$eval('[data-culture-rescue-receipt]', element => element.textContent), /secours.*continuer.*(inchang|pénalités)/is);
    await assertPrimary('advance', mobile, `rescued ${label}`);
    await noOverflow(`rescued ${label}`);
    await screenshot(`rescued-${label}`);

    // A full navigation reload proves that the save parser retains the rescue.
    await page.goto(`${origin}/?resume=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-culture-rescue-receipt]');
    assert.deepEqual(await page.evaluate(() => window.__readRescue()), rescued, `${label}: rescued state survives reload`);
    assert.equal(await page.$eval(rescue, element => element.dataset.status), 'used');
    await click(primary);
    await page.waitForFunction(() => window.__readRescue()?.phase === 'prepare' && window.__readRescue()?.stageIndex === 2);
    await page.evaluate(() => window.__injectNextZero());
    await page.waitForFunction(() => document.querySelector('[data-culture-decision]')?.dataset.phase === 'rolled');
    assert.match(await page.$eval('[data-culture-result]', element => element.textContent), /mettra fin à ta culture/i);
    assert.match(await page.$eval(actionbar, element => element.textContent), /fera mourir/i);
    await assertPrimary('resolve', mobile, `third zero ${label}`);
    await click(primary);
    await page.waitForSelector('[data-outcome="dead"]');
    const dead = await page.evaluate(() => window.__readRescue());
    assert.equal(dead.phase, 'complete');
    assert.equal(dead.cultureDead, true);
    assert.equal(dead.harvestGrams, 0);
    assert.equal(dead.history.filter(entry => entry.total === 0).length, 3);
    assert.equal(dead.history.filter(entry => entry.rescued).length, 1);
    assert.match(await page.$eval('[data-outcome="dead"] h1', element => element.textContent), /terminée sans récolte/i);
    const recoveryCopy = await page.$eval('[data-culture-recovery]', element => element.textContent);
    assert.match(recoveryCopy, /gardes ta collection.*Buddie.*Héritage.*cartes non jouées/is);
    assert.match(recoveryCopy, /copies utilisées.*consommées/is);
    assert.match(recoveryCopy, /prochaine culture.*réaction.*XP/is);
    assert.match(recoveryCopy, /essai gratuit.*récolte fictive/is);
    assert.equal((await page.$$(actionbar)).length, 0, `${label}: obsolete dock removed at death`);
    assert.equal((await page.$$('[data-rescued="true"]')).length, 1);
    await noOverflow(`death ${label}`);
    await screenshot(`death-${label}`);

    const accountBeforeTrial = await page.evaluate(() => window.__rescueAccountSnapshot());
    const requestsBeforeTrial = apiRequests.length;
    await click('[data-culture-recovery-action="trial"]');
    await page.waitForSelector(trial);
    await click(trialAction('roll'));
    await page.waitForSelector(trialAction('resolve'));
    await noOverflow(`recovery trial ${label}`);
    await screenshot(`trial-${label}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector(trial, { hidden: true });
    assert.deepEqual(await page.evaluate(() => window.__rescueAccountSnapshot()), accountBeforeTrial, `${label}: trial leaves failed culture and collection unchanged`);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-culture-recovery-action')), 'trial', `${label}: closing returns focus to the trial opener`);
    await click('[data-culture-recovery-action="trial"]');
    await page.waitForSelector(`${trial}[data-first-culture-phase="rolled"]`);
    for (let stage = 0; stage < 6; stage++) {
      if (stage > 0) await click(trialAction('roll'));
      await click(trialAction('resolve'));
      await click(trialAction('next'));
    }
    await page.waitForSelector(`${trial}[data-first-culture-phase="complete"]`);
    assert.deepEqual(await page.evaluate(() => window.__rescueAccountSnapshot()), accountBeforeTrial, `${label}: completing the trial awards no real resources`);
    assert.equal(apiRequests.length, requestsBeforeTrial, `${label}: no API requests from the trial`);
    await click(trialAction('continue'));
    await page.waitForSelector(trial, { hidden: true });
    await page.waitForSelector('[data-culture-preparation]');
    assert.deepEqual(await page.evaluate(() => window.__readRescue()), dead, `${label}: returning to preparation does not start or reset the saved culture`);

    await show('legacy-second-zero');
    assert.equal((await page.$$(rescue)).length, 0, `${label}: no rescue silently added to older runs`);
    assert.match(await page.$eval(actionbar, element => element.textContent), /fera mourir/i);
    await click(primary);
    await page.waitForSelector('[data-outcome="dead"]');
    const legacyDead = await page.evaluate(() => window.__readRescue());
    assert.equal(legacyDead.cultureDead, true);
    assert.equal(legacyDead.history.filter(entry => entry.total === 0).length, 2);
    assert.equal(legacyDead.history.some(entry => entry.rescued), false);
    await click('[data-culture-recovery-action="prepare"]');
    await page.waitForSelector('[data-culture-preparation]');
    results.push({ width, height, openingAction, secondZeroRescued: true, normalVerdictPreserved: true, reloadPreserved: true, thirdZeroFatal: true, recoveryTrialCompleted: true, returnToPreparation: true, legacySecondZeroFatal: true, noOverflow: true });
    console.log(JSON.stringify({ viewport: label, passed: true }));
  }
  assert.equal(apiRequests.some(request => request.method !== 'GET'), false, 'No mutations sent, even to the intercepted backend');
  assert.deepEqual(errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, viewports: results.length, output }));
} catch (error) {
  report.failure = error.stack;
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
