import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

// Exercise the real first-entry gate and live-guide launcher. The live game
// shell alone is replaced, so a first-time visit cannot accidentally mutate an
// account during this audit. All requests to the preference endpoint are mocked.
const root = process.cwd();
const output = resolve(root, 'output/arena-introduction');
const port = Number(process.argv.find(argument => argument.startsWith('--port='))?.slice(7) ?? 3273);
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'warehouse-manifest': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')}`,
  fixture: `import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';import{ArenaGameEntry}from'/src/components/contest/ArenaGameEntry';import{AuditConsent}from'audit-consent';const params=new URLSearchParams(location.search);function App(){const[userId,setUserId]=React.useState(params.get('user')||'first-player');const[state,setState]=React.useState(params.get('state')||'new');const[blocked,setBlocked]=React.useState(params.get('cookies')==='1');const[generation,setGeneration]=React.useState(0);window.__entryAudit={changeUser:(user,state='new')=>{setUserId(user);setState(state);setGeneration(value=>value+1)},releaseCookies:()=>setBlocked(false),remount:()=>setGeneration(value=>value+1)};return React.createElement(AuditConsent,{blocked},React.createElement(ArenaGameEntry,{key:userId+':'+generation,userId,introductionState:state}))}createRoot(document.getElementById('root')).render(React.createElement(App));`,
  'audit-consent': `import React from'react';const Context=React.createContext({showBanner:false});export function AuditConsent({blocked,children}){return React.createElement(Context.Provider,{value:{showBanner:blocked,hasConsent:()=>true}},children)}export function useCookieConsent(){return React.useContext(Context)}`,
  'audit-shell': `import React from'react';import{ArenaLearningLauncher}from'/src/components/contest/ArenaLearningLauncher';import{KQ_FARM_GUIDE_OPEN_EVENT}from'/src/lib/kanab-quest-farm-guide';export function PlacardPlayerShell({initialGuideOpen=false,draftOwnerId}){const[open,setOpen]=React.useState(initialGuideOpen);React.useEffect(()=>{window.__shellMounts=(window.__shellMounts||0)+1;const start=()=>setOpen(true);window.addEventListener(KQ_FARM_GUIDE_OPEN_EVENT,start);return()=>window.removeEventListener(KQ_FARM_GUIDE_OPEN_EVENT,start)},[]);return React.createElement('main',{'data-audit-native-shell':true,'data-audit-guide-open':open,'data-owner':draftOwnerId},React.createElement('h1',null,'Mon quartier'),React.createElement('button',{'data-audit-pause-guide':true,onClick:()=>setOpen(false)},'Mettre le guide en pause'),React.createElement(ArenaLearningLauncher))}export default PlacardPlayerShell;`,
  'next/dynamic': `import React from'react';export default function dynamic(load,options={}){const C=React.lazy(async()=>{const m=await load();return{default:m.default||m}});return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props))}}`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/navigation': `export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:href=>{window.__lastRouterPush=href},replace:()=>{},refresh:()=>{}});`,
};
const auditStyle = `
@font-face{font-family:GameBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2) format('woff2');font-weight:400 700}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Bold.woff2) format('woff2');font-weight:700}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2) format('woff2');font-weight:800}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2) format('woff2');font-weight:900}
@font-face{font-family:GameHandwritten;src:url(/src/app/fonts/Caveat-Latin-Bold.woff2) format('woff2');font-weight:700}
:root{--font-body:GameBody;--font-display:GameDisplay;--font-handwritten:GameHandwritten}
body{margin:0;background:#fff1d6;font-family:var(--font-body),sans-serif}button{font-family:inherit}`;
const server = await createServer({
  configFile: false, envDir: false, root, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', '@3d-dice/dice-box-threejs', 'gsap'] },
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'arena-introduction-audit', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('warehouse-v2/manifest.json')) return '\0warehouse-manifest';
      if (/\/CookieConsentProvider(?:\.tsx)?$/.test(id)) return '\0audit-consent';
      if (/\/PlacardPlayerShell(?:\.tsx)?$/.test(id)) return '\0audit-shell';
      if (id in modules) return '\0' + id;
    },
    load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/') return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${auditStyle}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>`);
    }); },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser, page, failPreference = false;
const errors = [], consoleErrors = [], expectedNetworkErrors = [], api = [], results = [];

async function expectShell(guided) {
  await page.waitForSelector(`[data-audit-native-shell][data-audit-guide-open="${guided}"]`);
  assert.equal(await page.$('[data-releve]'), null, 'The primary path must mount the actual game, never a trial.');
}

async function screenshot(name) {
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
}

try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (failPreference && message.text().includes('net::ERR_FAILED')) expectedNetworkErrors.push(message.text());
    else consoleErrors.push(message.text());
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      api.push({ path: url.pathname, method: request.method(), body: request.postData(), failed: failPreference });
      if (failPreference) return void request.abort('failed');
      return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (url.protocol !== 'data:' && url.origin !== origin) return void request.abort();
    void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('releve-real-player-sentinel', 'unchanged');
    window.__shellMounts = 0;
  });

  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 960, deviceScaleFactor: 1 });
    const user = `first-player-${width}`;
    await page.goto(`${origin}/?user=${user}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-entry-guide]');
    assert.equal(await page.$('[data-audit-native-shell]'), null, 'Choosing an entry must not initialize live game data.');
    assert.equal(await page.$('[data-releve]'), null, 'A fresh visit must not start a disconnected trial.');
    assert.equal(await page.$('[data-entry-practice]'), null, 'The first entry offers guided and free play without a separate trial');
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Essais à part')), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Entry must fit narrow screens.');
    await screenshot(`first-entry-${width}`);
    await page.click('[data-entry-guide]');
    await expectShell(true);
    await page.waitForFunction(id => localStorage.getItem(`arena-learning-entry-v1:${id}`) === 'quarter', {}, user);
    await page.click('[data-audit-pause-guide]');
    await page.reload({ waitUntil: 'networkidle0' });
    await expectShell(false);
    const beforeGuide = api.length;
    const context = await page.evaluate(() => { const url = new URL(location.href); url.searchParams.set('view', 'market'); url.searchParams.set('lot', 'player-lot'); history.replaceState(history.state, '', url); return location.search; });
    await page.click('[data-arena-learning-trigger]');
    await expectShell(true);
    assert.equal(await page.evaluate(() => location.search), context, 'Opening help must preserve the current view and lot.');
    assert.equal(api.length, beforeGuide, 'Opening help must not perform a game action.');
    assert.equal(await page.$('[data-arena-learning]'), null, 'The main launcher must open the live guide directly.');
    assert.equal(await page.$('[data-arena-practice-trigger]'), null, 'The launcher has no separate practice button.');
    await page.evaluate(second => window.__entryAudit.changeUser(second), `second-player-${width}`);
    await page.waitForSelector('[data-entry-guide]');
    assert.equal(await page.$('[data-audit-native-shell]'), null, 'Another account must choose its own entry.');
    await page.click('[data-entry-quarter]');
    await expectShell(false);
    await page.evaluate(firstUser => window.__entryAudit.changeUser(firstUser), user);
    await expectShell(false);
    results.push({ width, liveGuideEntry: true, nativeShellDeferred: true, freePlay: true, pauseAndReload: true, launcherPreservesContext: true, isolatedAccounts: true, noPracticeEntry: true });
  }

  const beforeSeen = api.length;
  await page.goto(`${origin}/?user=returning-player&state=seen`, { waitUntil: 'networkidle0' });
  await expectShell(false);
  assert.equal(api.length, beforeSeen, 'Returning players must not reset their saved introduction preference.');
  results.push({ returningAccountSkipsIntroduction: true });

  const beforeCookies = api.length;
  await page.goto(`${origin}/?user=cookie-player&cookies=1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-arena-introduction-loading]');
  assert.equal(await page.$('[data-releve]'), null);
  assert.equal(await page.$('[data-audit-native-shell]'), null);
  assert.equal(api.length, beforeCookies, 'Cookie settings must not prematurely consume the introduction.');
  assert.equal(await page.evaluate(() => localStorage.getItem('arena-releve-introduction-v1:cookie-player')), null);
  await page.evaluate(() => window.__entryAudit.releaseCookies());
  await page.waitForSelector('[data-entry-guide]');
  assert.equal(api.length, beforeCookies, 'Displaying the choice must not consume the introduction.');
  await page.click('[data-entry-guide]');
  await expectShell(true);
  await page.waitForFunction(() => localStorage.getItem('arena-releve-introduction-v1:cookie-player') === 'seen');
  results.push({ cookiesDelayIntroductionAndPreference: true });

  for (const choice of ['quick', 'story']) {
    await page.evaluate(value => {
      localStorage.setItem(`arena-learning-entry-v1:legacy-${value}`, value);
      localStorage.setItem(`arena-releve-session-v1:legacy-${value}`, 'preserved-legacy-save');
    }, choice);
    await page.goto(`${origin}/?user=legacy-${choice}&state=seen`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-entry-guide]');
    assert.equal(await page.$('[data-releve]'), null, 'Historical exercise choices must not automatically resume a trial.');
    const beforeRequestedGuide = api.length;
    await page.goto(`${origin}/?user=legacy-${choice}&state=seen&guide=1&cookies=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-arena-introduction-loading]');
    assert.equal(await page.$('[data-audit-native-shell]'), null);
    assert.equal(api.length, beforeRequestedGuide);
    await page.evaluate(() => window.__entryAudit.releaseCookies());
    await expectShell(true);
    await page.waitForFunction(value => localStorage.getItem(`arena-learning-entry-v1:legacy-${value}`) === 'quarter', {}, choice);
    assert.equal(await page.evaluate(value => localStorage.getItem(`arena-releve-session-v1:legacy-${value}`), choice), 'preserved-legacy-save');
    results.push({ legacyChoice: choice, explicitGuideTakesPriority: true, oldSavePreserved: true, consentHonored: true });
  }

  failPreference = true;
  await page.goto(`${origin}/?user=offline-player&state=unavailable`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-entry-guide]');
  await page.click('[data-entry-guide]');
  await expectShell(true);
  await page.waitForFunction(() => localStorage.getItem('arena-learning-entry-v1:offline-player') === 'quarter');
  await new Promise(resolve => setTimeout(resolve, 100));
  const beforeOfflineReload = api.length;
  await page.reload({ waitUntil: 'networkidle0' });
  await expectShell(false);
  assert.equal(api.length, beforeOfflineReload, 'A failed preference POST must not create an introduction loop.');
  await page.click('[data-arena-learning-trigger]');
  await expectShell(true);
  failPreference = false;
  assert(api.some(request => request.failed), 'The offline preference failure must actually be exercised.');
  results.push({ unavailableAccountOffersGuide: true, failedPreferenceUsesLocalFallback: true, offlineGuideReopens: true });

  for (const request of api) {
    assert.equal(request.path, '/api/arena/tutorial', 'The introduction may only save its preference, never call a live game endpoint.');
    assert.equal(request.method, 'POST');
    assert.deepEqual(JSON.parse(request.body), { intent: 'introduction', step: 0, status: 'active' });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  assert.equal(await page.evaluate(() => localStorage.getItem('releve-real-player-sentinel')), 'unchanged');
  console.log(JSON.stringify({ passed: true, results, api, errors }));
} catch (error) {
  process.exitCode = 1;
  console.error(error);
  if (page) {
    await screenshot('failure');
    console.error(await page.evaluate(() => ({ text: document.body.innerText, storageKeys: Object.keys(localStorage), openDialogs: [...document.querySelectorAll('dialog[open]')].map(element => element.outerHTML.slice(0, 600)) })));
  }
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: !process.exitCode, results, api, errors, consoleErrors, expectedNetworkErrors }, null, 2));
  await browser?.close();
  await server.close();
}
