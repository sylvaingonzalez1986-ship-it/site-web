/** Real UI with local engine fixtures; API and external requests never leave this audit. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/placard-outcomes');
const port = Number(process.env.PLACARD_OUTCOME_AUDIT_PORT || 3231);
const origin = `http://127.0.0.1:${port}`;
const stages = [
  ['Germination', 'germination'], ['Enracinement', 'enracinement'],
  ['Croissance', 'croissance'], ['Floraison', 'floraison'],
  ['Récolte', 'recolte'], ['Séchage & affinage', 'sechage-affinage'],
];
const outcomes = ['critical', 'success', 'fragile', 'failure'];
// Narrow reruns keep the complete report and refresh only the changed illustration.
const stageFilter = process.argv.find(arg => arg.startsWith('--stage='))?.slice(8);
const outcomeFilter = process.argv.find(arg => arg.startsWith('--outcome='))?.slice(10);
assert.ok(!stageFilter || stages.some(([, slug]) => slug === stageFilter), 'Unknown --stage');
assert.ok(!outcomeFilter || [...outcomes, 'dead'].includes(outcomeFilter), 'Unknown --outcome');
const selected = (stage, outcome) => (!stageFilter || stages[stage][1] === stageFilter) && (!outcomeFilter || outcome === outcomeFilter);
const reportPath = resolve(output, [ 'report', stageFilter, outcomeFilter ].filter(Boolean).join('-') + '.json');

const modules = {
  'outcome-fixtures': `
    import { startKqGame, resolveKqStage, advanceKqStage } from '/src/lib/kanab-quest-game';
    import { encodeKqSave, parseKqGameSave } from '/src/lib/kanab-quest-persistence';
    import { createKqTrial, reduceKqTrial, canTrialResolve, KQ_TRIAL_VERSION } from '/src/lib/kanab-quest-trial';
    export function fixture(stageIndex, outcome) {
      let state = startKqGame(220926, { deckCodes: ['BOTTE-003', 'BOTTE-004', 'BOTTE-005', 'BOTTE-006'], startedAt: '2026-09-22T12:00:00Z' });
      state.situationCodes = ['SIT-007','SIT-002','SIT-009','SIT-004','SIT-005','SIT-006'];
      const dice = { critical: [4,5,6], success: [4,5,2], fragile: [4,2,3], failure: [1,2,3], dead: [1,2,3] };
      for (let index = 0; index <= stageIndex; index++) {
        const current = index === stageIndex ? outcome : outcome === 'dead' && index === 0 ? 'failure' : 'critical';
        state = resolveKqStage({ ...state, phase: 'rolled', dice: dice[current], pressure: 0 });
        if (index < stageIndex) state = advanceKqStage(state);
      }
      if (outcome === 'dead' ? !state.cultureDead : state.lastOutcome !== outcome) throw new Error('Fixture verdict mismatch');
      const encoded = encodeKqSave(state);
      if (!parseKqGameSave(encoded)) throw new Error('Fixture rejected by the real save parser');
      return { state, encoded };
    }
    export function fixtures() {
      return Array.from({ length: 6 }, (_, stage) => ['critical','success','fragile','failure', ...(stage ? ['dead'] : [])].map(outcome => ({ stage, outcome, ...fixture(stage, outcome) }))).flat();
    }
    export function trialFixtures() {
      let state = createKqTrial();
      const actions = [], snapshots = [];
      const dispatch = action => { const next = reduceKqTrial(state, action); if (next === state) throw new Error('Invalid trial action: ' + JSON.stringify(action)); state = next; actions.push(action); };
      dispatch({type:'check',value:'notebook'}); dispatch({type:'next'});
      for (const value of ['buddie','deck','heritage']) dispatch({type:'check',value});
      dispatch({type:'next'}); dispatch({type:'buy'}); dispatch({type:'next'});
      for (const code of ['LED-300','DRYING-ROOM','SIFT-TRAY']) dispatch({type:'install',code});
      dispatch({type:'next'});
      while (state.chapter === 4 && !state.game.cultureDead) {
        if (state.game.stageIndex === 0) dispatch({type:'play',code:'BOTTE-005'});
        if (state.game.stageIndex === 2) dispatch({type:'play',code:'BOTTE-004'});
        dispatch({type:'roll'});
        if (!canTrialResolve(state)) {
          const afterHeritage = reduceKqTrial(state,{type:'heritage'});
          if (afterHeritage !== state) dispatch({type:'heritage'});
        }
        if (!canTrialResolve(state) && state.game.stageIndex === 2) dispatch({type:'play',code:'BOTTE-002'});
        dispatch({type:'resolve'});
        snapshots.push({stage:state.game.stageIndex, outcome:state.game.cultureDead?'dead':state.game.lastOutcome, saved:{version:KQ_TRIAL_VERSION,actions:structuredClone(actions)}});
        if (!state.game.cultureDead) dispatch({type:'advance'});
      }
      return snapshots;
    }
  `,
  'outcome-entry': `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import '/src/app/globals.css';
    import { KanabQuestDicePrototype } from '/src/components/placard/KanabQuestDicePrototype';
    import { KqGuidedTrial } from '/src/components/placard/KqGuidedTrial';
    import { KQ_LOCAL_KEYS } from '/src/lib/kanab-quest-repository';
    import { kqTrialStorageKey } from '/src/lib/kanab-quest-trial';
    import { fixture, trialFixtures } from 'outcome-fixtures';
    const root = createRoot(document.getElementById('root')); let renderKey = 0;
    window.__trialFixtures = trialFixtures();
    window.__showOutcome = (stage, outcome) => {
      sessionStorage.clear(); localStorage.clear();
      const row = fixture(stage, outcome);
      localStorage.setItem(KQ_LOCAL_KEYS.game, row.encoded);
      localStorage.setItem(KQ_LOCAL_KEYS.onboardingSeen, '1');
      localStorage.setItem('kq-dice-direct-result', '1');
      window.__fixture = { stage, outcome, game: row.state };
      root.render(<KanabQuestDicePrototype key={++renderKey} apiScope="admin" showAdminOperations={false} viewMode="game"/>);
    };
    window.__showTrial = index => {
      const row = window.__trialFixtures[index];
      sessionStorage.setItem(kqTrialStorageKey('outcome-audit'),JSON.stringify(row.saved));
      root.render(<KqGuidedTrial key={++renderKey} userId="outcome-audit" onPause={()=>{}} onComplete={()=>{}} busy={false} error=""/>);
      return {stage:row.stage,outcome:row.outcome};
    };
    window.__showOutcome(0,'critical');
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
    name: 'outcome-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit des verdicts du Placard</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__outcome-entry"></script></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser;
const errors = [], apiRequests = [], results = [], trialResults = [];
try {
  await mkdir(output, { recursive: true });
  const fixtureModule = await server.ssrLoadModule('outcome-fixtures');
  const allFixtures = fixtureModule.fixtures();
  assert.equal(allFixtures.length, 29);
  const trialFixtures = fixtureModule.trialFixtures();
  assert.ok(trialFixtures.length > 0);
  if (process.argv.includes('--fixtures-only')) {
    console.log(JSON.stringify({ passed: true, engineFixtures: allFixtures.length, trialFixtures: trialFixtures.map(({stage,outcome})=>({stage,outcome})) }));
  } else {
    await server.listen();
    browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        apiRequests.push({ url: url.pathname, method: request.method() });
        void request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'API désactivée dans cet audit visuel local.' }) });
      } else if (url.origin === origin || url.protocol === 'data:') void request.continue();
      else void request.abort();
    });
    const selector = (stage, outcome) => `[data-outcome-stage=${JSON.stringify(stages[stage][0])}][data-outcome="${outcome}"]`;
    const inspect = async (stage, outcome, name, trial = false) => {
      const target = selector(stage, outcome);
      await page.waitForSelector(target, { visible: true });
      await page.$eval(target, element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForFunction(target => {
        const image = document.querySelector(target)?.querySelector('img');
        return image?.complete && image.naturalWidth > 0;
      }, {}, target);
      await page.$eval(target, async element => {
        const animations = element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity);
        await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const actual = await page.$eval(target, element => {
        const image = element.querySelector('img'), rect = image.getBoundingClientRect(), style = getComputedStyle(image);
        const dialog = element.closest('dialog');
        const points = [[.1,.1],[.9,.1],[.5,.5],[.1,.9],[.9,.9]];
        const fullyVisible = rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth
          && points.every(([x,y]) => image === document.elementFromPoint(rect.left + x * rect.width, rect.top + y * rect.height));
        return {
          source: new URL(image.src).pathname, alt: image.alt, imageWidth: rect.width, imageHeight: rect.height,
          naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, objectFit: style.objectFit,
          fullyVisible,
          viewportOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          panelOverflow: element.scrollWidth > element.clientWidth + 1,
          dialogOverflow: dialog ? dialog.scrollWidth > dialog.clientWidth + 1 : false,
        };
      });
      assert.equal(actual.source, `/app/kanab-quest/reactions/stages-v3/${stages[stage][1]}-${outcome}.webp`, name);
      assert.ok(actual.alt.length > 20, name + ': useful alt text');
      assert.ok(actual.imageWidth >= 120 && actual.imageHeight >= 120, name + ': artwork remains readable');
      assert.equal(actual.fullyVisible, true, name + ': artwork is fully in the viewport and unobstructed');
      assert.equal(actual.objectFit, 'contain', name + ': complete botanical subject is visible');
      assert.equal(actual.viewportOverflow, false, name + ': document overflow');
      assert.equal(actual.panelOverflow, false, name + ': result overflow');
      assert.equal(actual.dialogOverflow, false, name + ': tutorial overflow');
      const clip = await page.$eval(target, element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height };
      });
      await page.screenshot({ path: resolve(output, name + '-card.png'), clip, captureBeyondViewport: true });
      if (outcome === 'critical' || outcome === 'dead' || trial) await page.screenshot({ path: resolve(output, name + '-viewport.png') });
      return { stage: stages[stage][0], outcome, ...actual };
    };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 700 ? 844 : 1000, isMobile: width < 700, hasTouch: width < 700 });
      await page.goto(origin, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => typeof window.__showOutcome === 'function');
      for (let stage = 0; stage < stages.length; stage++) {
        for (const outcome of [...outcomes, ...(stage ? ['dead'] : [])]) {
          if (!selected(stage, outcome)) continue;
          await page.evaluate(({stage,outcome})=>window.__showOutcome(stage,outcome), { stage, outcome });
          await page.waitForSelector(selector(stage, outcome));
          if (outcome !== 'dead') await page.click('nav[aria-label="Sections de la partie"] button:nth-child(3)');
          const name = `${stages[stage][1]}-${outcome}-${width}`;
          results.push({ width, ...await inspect(stage, outcome, name) });
          if (outcome === 'dead') {
            assert.equal(await page.$eval('#culture-death-title', el => el.textContent), 'Culture morte');
            assert.equal(await page.$$eval('[data-outcome="dead"] img', els => els.length), 1);
          }
        }
      }
      console.log(`PASS: ${results.filter(row => row.width === width).length} stage/verdict illustrations at ${width}px.`);
      for (let index = 0; index < trialFixtures.length; index++) {
        if (!selected(trialFixtures[index].stage, trialFixtures[index].outcome)) continue;
        const {stage,outcome} = await page.evaluate(index=>window.__showTrial(index), index);
        const name = `trial-${stages[stage][1]}-${outcome}-${width}`;
        trialResults.push({ width, ...await inspect(stage,outcome,name,true) });
        assert.equal(await page.$$eval('[data-trial-situation]', els => els.length), 0, 'Resolved tutorial uses the verdict illustration');
      }
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(apiRequests.filter(request => request.method !== 'GET'), []);
    const report = { passed: true, engineFixtures: 29, filters: { stage: stageFilter, outcome: outcomeFilter }, results, trialResults, errors, apiRequests, limitations: 'Local Vite harness uses the real React/CSS components and persistence parser with a next/image shim; no production account or API is used.' };
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: true, verdictScreens: results.length, trialScreens: trialResults.length, output }));
  }
} catch (error) {
  await writeFile(reportPath, JSON.stringify({ passed: false, error: String(error), results, trialResults, errors, apiRequests }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
