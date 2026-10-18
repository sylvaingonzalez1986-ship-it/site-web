import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

// Exercise the real first-entry gate, arrival and replay launcher. The live game
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
  'audit-shell': `import React from'react';import{ArenaLearningLauncher}from'/src/components/contest/ArenaLearningLauncher';export function PlacardPlayerShell(){React.useEffect(()=>{window.__shellMounts=(window.__shellMounts||0)+1},[]);return React.createElement('main',{'data-audit-native-shell':true},React.createElement('h1',null,'Mon quartier'),React.createElement(ArenaLearningLauncher))}export default PlacardPlayerShell;`,
  'next/dynamic': `import React from'react';export default function dynamic(load,options={}){const C=React.lazy(async()=>{const m=await load();return{default:m.default||m}});return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props))}}`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/navigation': `export const usePathname=()=>'/arene';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
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

async function inspectArrival(expected = 'arrival-locked') {
  await page.waitForSelector(`dialog[open][data-releve] [data-releve-guide-active="${expected}"]`, { visible: true });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-releve-guide-card] img')].some(image => image.complete && image.naturalWidth));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const view = await page.evaluate(() => {
    const target = document.querySelector('[data-releve-guide-active]');
    const coach = document.querySelector('[data-releve-guide-card]');
    const r = target.getBoundingClientRect(), c = coach.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      id: target.dataset.releveGuideActive,
      inViewport: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1,
      unoccluded: at === target || target.contains(at),
      coachVisible: c.left >= -1 && c.right <= innerWidth + 1 && c.top >= -1 && c.bottom <= innerHeight + 1,
      hubPresent: !!document.querySelector('[data-arena-learning]'),
      shellPresent: !!document.querySelector('[data-audit-native-shell]'),
      shellMounts: window.__shellMounts || 0,
    };
  });
  assert.equal(view.id, expected);
  assert(view.inViewport && view.unoccluded && view.coachVisible, JSON.stringify(view));
  return view;
}

async function pauseIntroduction() {
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-audit-native-shell]');
  await page.waitForFunction(() => !document.querySelector('[data-releve]'));
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

  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 960, deviceScaleFactor: 1 });
    const user = `first-player-${width}`;
    await page.goto(`${origin}/?user=${user}`, { waitUntil: 'networkidle0' });
    const first = await inspectArrival();
    assert(!first.hubPresent && !first.shellPresent && first.shellMounts === 0, 'Arrival must be the first game screen, without loading the live shell.');
    await screenshot(`first-entry-${width}`);
    await page.click('[data-releve-guide-active="arrival-locked"]');
    await inspectArrival('arrival-opened');
    await pauseIntroduction();
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-audit-native-shell]');
    assert.equal(await page.$('[data-releve]'), null, 'The introduction must not reopen after a deliberate pause and reload.');
    await page.click('[data-arena-learning-trigger]');
    await page.waitForSelector('[data-releve-start]');
    await page.click('[data-releve-start]');
    await inspectArrival('arrival-opened');
    await screenshot(`resumed-from-quarter-${width}`);
    await page.evaluate(second => window.__entryAudit.changeUser(second), `second-player-${width}`);
    const second = await inspectArrival();
    assert(!second.hubPresent && !second.shellPresent, 'Switching accounts must present that player\'s own introduction.');
    await page.evaluate(firstUser => window.__entryAudit.changeUser(firstUser), user);
    await page.waitForSelector('[data-audit-native-shell]');
    assert.equal(await page.$('[data-releve]'), null, 'Returning to the first account must retain its seen preference.');
    await page.click('[data-arena-learning-trigger]');
    await page.waitForSelector('[data-releve-start]');
    await page.click('[data-releve-start]');
    await inspectArrival('arrival-opened');
    results.push({ width, autoIntroduction: true, nativeShellDeferred: true, pauseAndReload: true, quarterReplayResumes: true, isolatedAccounts: true });
  }

  const beforeSeen = api.length;
  await page.goto(`${origin}/?user=returning-player&state=seen`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-audit-native-shell]');
  assert.equal(await page.$('[data-releve]'), null, 'A known returning account must go directly to its game.');
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
  await inspectArrival();
  await page.waitForFunction(() => localStorage.getItem('arena-releve-introduction-v1:cookie-player') === 'seen');
  results.push({ cookiesDelayIntroductionAndPreference: true });

  failPreference = true;
  await page.goto(`${origin}/?user=offline-player&state=unavailable`, { waitUntil: 'networkidle0' });
  await inspectArrival();
  await page.click('[data-releve-guide-active="arrival-locked"]');
  await inspectArrival('arrival-opened');
  await pauseIntroduction();
  const beforeOfflineReload = api.length;
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-audit-native-shell]');
  assert.equal(await page.$('[data-releve]'), null);
  assert.equal(api.length, beforeOfflineReload, 'A failed preference POST must not create an introduction loop.');
  await page.click('[data-arena-learning-trigger]');
  await page.waitForSelector('[data-releve-start]');
  await page.click('[data-releve-start]');
  await inspectArrival('arrival-opened');
  failPreference = false;
  assert(api.some(request => request.failed), 'The offline preference failure must actually be exercised.');
  results.push({ unavailableAccountStartsIntroduction: true, failedPreferenceUsesLocalFallback: true, offlineReplayResumes: true });

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
