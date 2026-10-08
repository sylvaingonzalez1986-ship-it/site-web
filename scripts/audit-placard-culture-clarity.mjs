// Real culture UI, real engine and local saves. All API requests are intercepted.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/placard-culture-clarity');
const origin = 'http://127.0.0.1:3239';
const modules = {
  'culture-entry': `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import '/src/app/globals.css';
    import { KanabQuestDicePrototype } from '/src/components/placard/KanabQuestDicePrototype';
    import { startKqGame, resolveKqStage, advanceKqStage } from '/src/lib/kanab-quest-game';
    import { encodeKqSave, parseKqGameSave } from '/src/lib/kanab-quest-persistence';
    import { KQ_LOCAL_KEYS } from '/src/lib/kanab-quest-repository';
    const root = createRoot(document.getElementById('root')); let renderKey = 0;
    window.__showCulture = (mode = 'prepare') => {
      sessionStorage.clear(); localStorage.clear();
      let state = startKqGame(270926, {
        deckCodes: ['BOTTE-003', 'BOTTE-004', 'BOTTE-005', 'BOTTE-006'],
        heritageCode: mode === 'heritage' ? 'HERITAGE-007' : 'HERITAGE-002',
        startedAt: '2026-09-27T12:00:00Z'
      });
      state.situationCodes = ['SIT-007','SIT-002','SIT-009','SIT-004','SIT-005','SIT-006'];
      if (mode === 'danger') {
        state = resolveKqStage({ ...state, phase: 'rolled', dice: [1,1,1], pressure: 0 });
        state = advanceKqStage(state);
        state = { ...state, phase: 'rolled', dice: [1,1,1] };
      } else if (mode === 'first-danger') {
        state = { ...state, phase: 'rolled', dice: [1,1,1] };
      } else if (mode === 'rolled' || mode === 'heritage') {
        state = { ...state, phase: 'rolled', dice: [4,2,3] };
      } else if (mode === 'last-resolved') {
        for (let index = 0; index < 5; index += 1) {
          state = advanceKqStage(resolveKqStage({ ...state, phase: 'rolled', dice: [6,6,6], pressure: 0 }));
        }
        state = resolveKqStage({ ...state, phase: 'rolled', dice: [6,6,6], pressure: 0 });
      } else if (mode === 'resolved') {
        state = resolveKqStage({ ...state, phase: 'rolled', dice: [4,5,6], pressure: 0 });
      }
      const encoded = encodeKqSave(state);
      if (!parseKqGameSave(encoded)) throw new Error('Invalid culture fixture');
      localStorage.setItem(KQ_LOCAL_KEYS.game, encoded);
      localStorage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify(Object.fromEntries(['BOTTE-003','BOTTE-004','BOTTE-005','BOTTE-006'].map(code => [code, 3]))));
      localStorage.setItem(KQ_LOCAL_KEYS.onboardingSeen, '1');
      localStorage.setItem('kq-dice-direct-result', mode === 'prepare-motion' ? '0' : '1');
      root.render(<div key={++renderKey} data-culture-fixture={mode}><KanabQuestDicePrototype apiScope="admin" showAdminOperations={false} viewMode="game"/></div>);
    };
    window.__readCulture = () => parseKqGameSave(localStorage.getItem(KQ_LOCAL_KEYS.game));
    window.__showCulture();
  `,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>; }`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}) { return <a {...props}/>; }`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}}); export const usePathname=()=>'/dev/placard'; export const useSearchParams=()=>new URLSearchParams();`,
};

const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react', 'next/dynamic'] },
  resolve: { alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'culture-clarity-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Culture locale</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__culture-entry"></script></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3239, strictPort: true, hmr: false, watch: null },
});

let browser;
const errors = [], results = [], blockedRequests = [], apiRequests = [];
const viewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
  { width: 390, height: 600 },
  { width: 667, height: 375 },
];
const primary = '[data-culture-primary-action]';
const actionbar = '[data-culture-actionbar]';
const report = { passed: false, results, errors, apiRequests, blockedRequests, backend: 'All API calls intercepted; no live account or backend used.' };
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      apiRequests.push({ method: request.method(), path: url.pathname });
      void request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'API désactivée pour cet audit local.' }) });
    }
    else if (url.origin === origin || url.protocol === 'data:') void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const show = async mode => {
    await page.waitForFunction(() => typeof window.__showCulture === 'function');
    await page.evaluate(mode => window.__showCulture(mode), mode);
    await page.waitForSelector(`[data-culture-fixture="${mode}"] [data-culture-play]`);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-culture-situation] img')].every(img => img.complete && img.naturalWidth > 0));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  };
  const clickText = async (selector, prefix) => {
    const handle = await page.evaluateHandle((selector, prefix) => [...document.querySelectorAll(selector)].find(el => el.textContent.trim().startsWith(prefix)), selector, prefix);
    assert.ok(handle.asElement(), prefix);
    await handle.asElement().evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await handle.asElement().click();
  };
  const clickControl = async selector => {
    await page.$eval(selector, element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    assert.equal(await page.$eval(selector, element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit === element || element.contains(hit);
    }), true, `${selector}: visible pointer target`);
    await page.click(selector);
  };
  const assertNoOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label);
  const measurePrimary = async () => page.$eval(primary, element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      action: element.dataset.action,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: innerHeight,
      documentTop: rect.top + scrollY,
      fullyVisible: rect.top >= 0 && rect.bottom <= innerHeight + 1,
      clickable: hit === element || element.contains(hit),
    };
  });
  const assertPrimary = async (action, label, mobile) => {
    assert.equal(await page.$$(primary).then(elements => elements.length), 1, `${label}: one primary action`);
    const position = await measurePrimary();
    assert.equal(position.action, action, `${label}: correct action`);
    assert.ok(position.height >= 44, `${label}: usable touch target`);
    if (mobile) {
      assert.ok(position.fullyVisible, `${label}: primary visible ${JSON.stringify(position)}`);
      assert.ok(position.clickable, `${label}: primary unoccluded`);
      assert.equal(await page.$eval(actionbar, element => getComputedStyle(element).position), 'fixed', `${label}: fixed mobile action`);
    }
    return position;
  };
  for (const { width, height } of viewports) {
    const mobile = width <= 760;
    const label = `${width}x${height}`;
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await show('prepare');
    await assertNoOverflow(`prepare ${label}`);
    const prepare = await assertPrimary('roll', `prepare ${label}`, mobile);
    assert.equal(await page.$eval('[data-culture-situation]', el => getComputedStyle(el).display === 'none'), false);
    assert.equal(await page.$eval('[data-culture-decision]', el => getComputedStyle(el).display === 'none'), false);
    assert.equal(await page.$$('nav[aria-label="Sections de la partie"]').then(els => els.length), 0);
    assert.equal(await page.$$eval('[aria-label="Détails de la culture"] > details', els => els.every(el => !el.open)), true);
    assert.equal(await page.$$('[role="dialog"]').then(els => els.length), 0);
    assert.equal(await page.$$eval('button', els => els.filter(el => el.checkVisibility() && el.textContent.includes('Lancer les dés')).length), 1);
    const layout = await page.evaluate(() => {
      const bounds = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { top: rect.top + scrollY, bottom: rect.bottom + scrollY, height: rect.height };
      };
      return { situation: bounds('[data-culture-situation]'), decision: bounds('[data-culture-decision]'), pageHeight: document.documentElement.scrollHeight };
    });
    await page.screenshot({ path: resolve(output, `prepare-${label}.png`), fullPage: true });
    if (mobile) await page.screenshot({ path: resolve(output, `prepare-viewport-${label}.png`) });
    await clickControl('[data-culture-hand] > summary');
    await assertNoOverflow(`hand ${label}`);
    await assertPrimary('roll', `hand open ${label}`, mobile);
    assert.ok(await page.$('button[data-category]:not(:disabled)'));
    await clickControl('button[data-category]:not(:disabled)');
    await page.waitForSelector('[role="dialog"]');
    const confirmation = await page.$eval('[role="dialog"]', el => el.textContent);
    assert.match(confirmation, /détruit une copie/);
    assert.match(confirmation, /Avantage/);
    assert.match(confirmation, /Risque/);
    await assertNoOverflow(`burn ${label}`);
    assert.equal(await page.$eval(actionbar, element => element.hasAttribute('data-suspended')), true, `${label}: main action suspended during burn`);
    const cancelButton = await page.evaluateHandle(() => [...document.querySelectorAll('[role="dialog"] button')].find(element => element.textContent === 'Annuler'));
    await cancelButton.asElement().evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    assert.equal(await cancelButton.asElement().evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit === element || element.contains(hit);
    }), true, `${label}: dialog controls above mobile action`);
    await page.screenshot({ path: resolve(output, `burn-${label}.png`) });
    await clickText('button', 'Annuler');
    await page.waitForSelector('[role="dialog"]', { hidden: true });
    await assertPrimary('roll', `burn cancelled ${label}`, mobile);
    await clickControl('[data-culture-hand] > summary');
    await clickText('summary', 'Projection de la récolte');
    await assertNoOverflow(`projection ${label}`);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await assertPrimary('roll', `bottom of page ${label}`, mobile);
    if (mobile) {
      const lastDisclosureUncovered = await page.evaluate(() => {
        const summary = [...document.querySelectorAll('[aria-label="Détails de la culture"] > details > summary')].at(-1).getBoundingClientRect();
        const bar = document.querySelector('[data-culture-actionbar]').getBoundingClientRect();
        return summary.bottom <= bar.top;
      });
      assert.ok(lastDisclosureUncovered, `${label}: final disclosure reachable above actionbar`);
    }
    await show('rolled');
    const rolled = await assertPrimary('resolve', `rolled ${label}`, mobile);
    await assertNoOverflow(`rolled ${label}`);
    assert.equal(await page.$eval('[data-culture-result]', element => Boolean(element.compareDocumentPosition(document.querySelector('[data-culture-hand]')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, `${label}: result before optional hand`);
    await page.screenshot({ path: resolve(output, `rolled-${label}.png`), fullPage: true });
    await clickControl('[data-culture-hand] > summary');
    await assertPrimary('resolve', `reaction hand ${label}`, mobile);
    await show('resolved');
    await page.waitForSelector('[data-outcome-stage]');
    const resolved = await assertPrimary('advance', `resolved ${label}`, mobile);
    assert.equal(await page.$eval('[data-outcome-stage] img', img => img.getBoundingClientRect().height >= 64), true);
    await assertNoOverflow(`outcome ${label}`);
    await page.screenshot({ path: resolve(output, `resolved-${label}.png`), fullPage: true });
    results.push({ width, height, prepare, rolled, resolved, layout, optionalDetails: true, burnConfirmation: true, lastDisclosureUncovered: true, noOverflow: true });
    console.log(JSON.stringify({ viewport: label, passed: true }));
  }
  await page.setViewport({ width: 390, height: 600, isMobile: true, hasTouch: true });
  for (const mode of ['first-danger', 'danger']) {
    await show(mode);
    await assertPrimary('resolve', mode, true);
    assert.equal(await page.$eval(`${actionbar} [data-warning]`, element => {
      const rect = element.getBoundingClientRect();
      const button = document.querySelector('[data-culture-primary-action]').getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= button.top && button.top - rect.bottom <= 48;
    }), true, `${mode}: death warning immediately above confirmation`);
    assert.match(await page.$eval(`${actionbar} [data-warning]`, element => element.textContent), mode === 'danger' ? /mort|mour|meur/i : /0|zéro/);
  }
  assert.equal(await page.$$eval('button', els => els.filter(el => el.checkVisibility() && el.textContent === 'Valider le résultat').length), 1);
  await clickText('summary', 'Jouer une réaction');
  assert.ok(await page.$('button[data-category="luck"]:not(:disabled)'));
  await assertPrimary('resolve', 'danger reaction open', true);
  await page.screenshot({ path: resolve(output, 'danger-reaction-390x600.png') });
  await show('heritage');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent === 'Activer le pouvoir'));
  await clickText('button', 'Activer le pouvoir');
  await page.waitForFunction(() => document.body.textContent.includes('pouvoir utilisé'));
  await show('rolled');
  await page.$eval(primary, element => element.focus());
  const keyboardTargets = [];
  for (let index = 0; index < 2; index += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { tag: element.tagName, label: element.textContent.trim(), uncovered: hit === element || element.contains(hit) };
    });
    assert.equal(focus.tag, 'SUMMARY');
    assert.ok(focus.uncovered, `Keyboard focus remains above actionbar: ${focus.label}`);
    keyboardTargets.push(focus);
  }
  assert.equal(await page.evaluate(() => document.activeElement?.parentElement?.hasAttribute('data-culture-hand')), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-culture-hand]', element => element.open), true);
  await assertPrimary('resolve', 'keyboard hand opened', true);
  report.keyboardTargets = keyboardTargets;
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await show('prepare-motion');
  await page.evaluate(() => {
    const nav = document.createElement('nav');
    nav.dataset.simulatedArenaNav = '';
    nav.textContent = 'Navigation de l’arène · coque simulée';
    nav.style.cssText = 'position:fixed;z-index:80;top:0;left:0;right:0;height:70px;background:#003f30;color:#fff5da;padding:12px;font-size:12px;box-sizing:border-box';
    document.body.append(nav);
  });
  const assertBelowNavigation = async selector => {
    await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), {}, selector);
    assert.ok(await page.$eval(selector, element => element.getBoundingClientRect().top >= 70), `${selector}: focus below simulated sticky navigation`);
  };
  await page.click(primary);
  await page.waitForSelector(`${primary}[data-action="resolve"]:not(:disabled)`);
  await assertPrimary('resolve', 'real roll transition', true);
  await assertBelowNavigation('[data-culture-decision]');
  assert.equal(await page.$eval('[data-motion-phase]', element => element.dataset.motionPhase), 'idle', 'Reduced motion skips the dice animation even when direct result is off');
  assert.equal(await page.evaluate(() => window.__readCulture()?.phase), 'rolled');
  await page.click(primary);
  await page.waitForSelector('[data-outcome-stage]');
  await assertPrimary('advance', 'real resolve transition', true);
  await assertBelowNavigation('[data-culture-result]');
  await page.screenshot({ path: resolve(output, 'resolved-after-action-390x600.png') });
  assert.equal(await page.evaluate(() => window.__readCulture()?.phase), 'resolved');
  await page.click(primary);
  await page.waitForFunction(() => document.querySelector('[data-culture-situation]')?.textContent.includes('Étape 2/6'));
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-culture-situation'));
  await assertPrimary('roll', 'real advance transition', true);
  await assertBelowNavigation('[data-culture-situation]');
  assert.equal(await page.evaluate(() => window.__readCulture()?.stageIndex), 1);
  await show('last-resolved');
  assert.match(await page.$eval(primary, element => element.textContent), /Révéler la Récolte/);
  await page.click(primary);
  await page.waitForSelector('[aria-label="Carte Fleur obtenue"]');
  assert.equal(await page.evaluate(() => window.__readCulture()?.phase), 'complete');
  assert.equal(await page.$$(actionbar).then(elements => elements.length), 0, 'No obsolete actionbar on harvest screen');
  await assertNoOverflow('harvest');
  await page.screenshot({ path: resolve(output, 'harvest-390x600.png'), fullPage: true });
  Object.assign(report, { firstZeroWarning: true, dangerWarning: true, reactionAccessible: true, heritageActivated: true, rollResolveAdvance: true, nextSituationFocused: true, harvestTransition: true, reducedMotion: true, simulatedStickyNavigation: { height: 70, zIndex: 80, focusTargetsUncovered: true } });
  assert.deepEqual(errors, []);
  report.passed = true;
  try { report.baseline = JSON.parse(await readFile(resolve(output, 'baseline.json'), 'utf8')); } catch { /* Baseline is optional on later runs. */ }
  console.log(JSON.stringify({ passed: true, results, output }));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
