// Real culture UI, real engine and local saves. All API requests are intercepted.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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
      } else if (mode === 'resolved') {
        state = resolveKqStage({ ...state, phase: 'rolled', dice: [4,5,6], pressure: 0 });
      }
      const encoded = encodeKqSave(state);
      if (!parseKqGameSave(encoded)) throw new Error('Invalid culture fixture');
      localStorage.setItem(KQ_LOCAL_KEYS.game, encoded);
      localStorage.setItem(KQ_LOCAL_KEYS.inventory, JSON.stringify(Object.fromEntries(['BOTTE-003','BOTTE-004','BOTTE-005','BOTTE-006'].map(code => [code, 3]))));
      localStorage.setItem(KQ_LOCAL_KEYS.onboardingSeen, '1');
      localStorage.setItem('kq-dice-direct-result', '1');
      root.render(<div key={++renderKey} data-culture-fixture={mode}><KanabQuestDicePrototype apiScope="admin" showAdminOperations={false} viewMode="game"/></div>);
    };
    window.__showCulture();
  `,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>; }`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}) { return <a {...props}/>; }`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}}); export const usePathname=()=>'/dev/placard'; export const useSearchParams=()=>new URLSearchParams();`,
};

const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
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
const errors = [], results = [];
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
    if (url.pathname.startsWith('/api/')) void request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'API désactivée pour cet audit local.' }) });
    else if (url.origin === origin || url.protocol === 'data:') void request.continue();
    else void request.abort();
  });
  const show = async mode => {
    await page.evaluate(mode => window.__showCulture(mode), mode);
    await page.waitForSelector(`[data-culture-fixture="${mode}"] [data-culture-play]`);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-culture-situation] img')].every(img => img.complete && img.naturalWidth > 0));
  };
  const clickText = async (selector, prefix) => {
    const handle = await page.evaluateHandle((selector, prefix) => [...document.querySelectorAll(selector)].find(el => el.textContent.trim().startsWith(prefix)), selector, prefix);
    assert.ok(handle.asElement(), prefix);
    await handle.asElement().click();
  };
  const assertNoOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await show('prepare');
    await assertNoOverflow(`prepare ${width}`);
    assert.equal(await page.$eval('[data-culture-situation]', el => getComputedStyle(el).display === 'none'), false);
    assert.equal(await page.$eval('[aria-label="Décision du tour"]', el => getComputedStyle(el).display === 'none'), false);
    assert.equal(await page.$$('nav[aria-label="Sections de la partie"]').then(els => els.length), 0);
    assert.equal(await page.$$eval('[aria-label="Détails de la culture"] > details', els => els.every(el => !el.open)), true);
    assert.equal(await page.$$('[role="dialog"]').then(els => els.length), 0);
    assert.equal(await page.$$eval('button', els => els.filter(el => el.checkVisibility() && el.textContent.includes('Lancer les dés')).length), 1);
    await page.screenshot({ path: resolve(output, `prepare-${width}.png`), fullPage: true });
    await clickText('summary', 'Préparer une carte');
    await assertNoOverflow(`hand ${width}`);
    assert.ok(await page.$('button[data-category]:not(:disabled)'));
    await page.click('button[data-category]:not(:disabled)');
    await page.waitForSelector('[role="dialog"]');
    const confirmation = await page.$eval('[role="dialog"]', el => el.textContent);
    assert.match(confirmation, /détruit une copie/);
    assert.match(confirmation, /Avantage/);
    assert.match(confirmation, /Risque/);
    await assertNoOverflow(`burn ${width}`);
    await page.screenshot({ path: resolve(output, `burn-${width}.png`), fullPage: true });
    await clickText('button', 'Annuler');
    await clickText('summary', 'Préparer une carte');
    await clickText('summary', 'Projection de la récolte');
    await assertNoOverflow(`projection ${width}`);
    await show('resolved');
    await page.waitForSelector('[data-outcome-stage]');
    assert.equal(await page.$eval('[data-outcome-stage] img', img => img.getBoundingClientRect().height > 100), true);
    await assertNoOverflow(`outcome ${width}`);
    await page.screenshot({ path: resolve(output, `resolved-${width}.png`), fullPage: true });
    results.push({ width, sharedFlow: true, optionalDetails: true, burnConfirmation: true, reactionArtwork: true, noOverflow: true });
  }
  await page.setViewport({ width: 390, height: 900, isMobile: true, hasTouch: true });
  await show('first-danger');
  await page.waitForFunction(() => document.body.textContent.includes('Valider ce résultat comptera comme une étape à 0 réussite'));
  await show('danger');
  await page.waitForFunction(() => document.body.textContent.includes('Valider ce deuxième résultat à 0 réussite'));
  assert.equal(await page.$$eval('button', els => els.filter(el => el.checkVisibility() && el.textContent === 'Valider le résultat').length), 1);
  await clickText('summary', 'Jouer une réaction');
  assert.ok(await page.$('button[data-category="luck"]:not(:disabled)'));
  await page.screenshot({ path: resolve(output, 'danger-reaction-390.png'), fullPage: true });
  await show('heritage');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent === 'Activer le pouvoir'));
  await clickText('button', 'Activer le pouvoir');
  await page.waitForFunction(() => document.body.textContent.includes('pouvoir utilisé'));
  await show('prepare');
  await clickText('button', 'Lancer les dés');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent === 'Valider le résultat'));
  await clickText('button', 'Valider le résultat');
  await page.waitForSelector('[data-outcome-stage]');
  await clickText('button', 'Étape suivante');
  await page.waitForFunction(() => document.querySelector('[data-culture-situation]')?.textContent.includes('Étape 2/6'));
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-culture-situation'));
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: true, results, firstZeroWarning: true, dangerWarning: true, reactionAccessible: true, heritageActivated: true, rollResolveAdvance: true, nextSituationFocused: true, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, results, output }));
} finally {
  await browser?.close();
  await server.close();
}
