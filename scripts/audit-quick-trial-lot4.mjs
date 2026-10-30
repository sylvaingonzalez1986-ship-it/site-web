/** Real short trial; all mutations use its local engines. Network operations are rejected. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/clarity-lot4/quick-trial');
const port = Number(process.env.KQ_QUICK_TRIAL_AUDIT_PORT ?? 3598), origin = `http://127.0.0.1:${port}`;
const modules = {
  'next/image': `import React from 'react';export default function Image({fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  entry: `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {ArenaQuickTrial} from '/src/components/contest/ArenaQuickTrial';
    import {ArenaLearningStorageProvider} from '/src/components/contest/ArenaLearningStorage';
    import {createArenaLearningStorage} from '/src/lib/arena-introduction';
    const params=new URLSearchParams(location.search),account=params.get('account')??'audit-A';window.readyCount=0;
    const storage=params.has('unavailable')?{getItem(){throw new Error('storage blocked')},setItem(){throw new Error('storage blocked')}}:createArenaLearningStorage(account);
    function App(){const[screen,setScreen]=React.useState('trial');return <ArenaLearningStorageProvider storage={storage}><button data-outside>Hors de la modale</button>{screen==='trial'?<ArenaQuickTrial onReady={()=>{window.readyCount++;}} onClose={()=>setScreen('paused')} onOpenQuarter={()=>setScreen('quarter')} onContinueLearning={()=>setScreen('learning')}/>:<div data-exit-destination={screen}><p>{screen}</p><button data-reopen onClick={()=>setScreen('trial')}>Reprendre l’essai</button></div>}</ArenaLearningStorageProvider>};
    createRoot(document.getElementById('root')).render(<App/>);`,
};
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'] }, resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'quick-trial-audit', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split('?')[0] !== '/') return next(); res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Essai court local</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;font-family:Arial;background:#fff1d6}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>'); }); } }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null } });
let browser;
const results = [], errors = [], external = [], writes = [], api = [];
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => {
    const url = new URL(request.url()); if (url.protocol === 'data:') return void request.continue();
    if (url.origin !== origin) { external.push(url.href); return void request.abort(); }
    if (!['GET', 'HEAD'].includes(request.method())) { writes.push(url.pathname); return void request.abort(); }
    if (url.pathname.startsWith('/api/')) { api.push(url.pathname); return void request.abort(); }
    void request.continue();
  });
  const visit = async query => { await page.goto(`${origin}/?${query}`, { waitUntil: 'networkidle0' }); await page.waitForSelector('dialog[open]'); };
  const step = async name => page.waitForSelector(`[data-quick-trial="${name}"]`);
  const click = async selector => { const element = await page.waitForSelector(selector, { visible: true }); await element.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await element.focus(); await page.keyboard.press('Enter'); };
  const act = async name => click(`[data-quick-action="${name}"]`);
  const capture = async name => {
    await page.$eval('dialog > div', node => node.scrollTo({ top: 0 }));
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: no document overflow`);
    const bounds = await page.$eval('dialog', node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, viewport: innerWidth, height: innerHeight, scroll: node.scrollWidth, client: node.clientWidth }; });
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewport && bounds.top >= 0 && bounds.bottom <= bounds.height + 1, `${name}: dialog within viewport`);
    assert.ok(bounds.scroll <= bounds.client + 1, `${name}: no horizontal dialog overflow`);
  };
  for (const width of [320, 390, 1440]) {
    console.log(`Essai court : ${width}px`);
    await page.setViewport({ width, height: 844, isMobile: width < 700, hasTouch: width < 700 });
    const account = `audit-${width}`; await visit(`account=${account}`);
    await capture(`choice-${width}`); assert.equal(await page.evaluate(() => window.readyCount), 1);
    await click(`[data-quick-variety]:${width === 390 ? 'last' : 'first'}-child`); await step('culture');
    for (let index = 0; index < 6; index++) {
      await act('roll');
      if (index === 0) { await capture(`decision-${width}`); if (width === 390) await act('support'); }
      await act('resolve'); await act('next');
    }
    await step('storage'); await capture(`storage-${width}`);
    await click(`[data-quick-container="${width === 390 ? 'BOVEDA-1L' : 'GLASS-3L'}"]`); await step('curing');
    await capture(`curing-${width}`);
    assert.equal(await page.$('[data-quick-action="jury"]'), null);
    await page.keyboard.press('Escape'); await page.waitForSelector('[data-quick-exit]');
    assert.match(await page.$eval('[data-quick-exit]', node => node.textContent), /Rien n’est transféré/);
    await click('[data-quick-pause]'); await page.waitForSelector('[data-exit-destination="paused"]');
    await click('[data-reopen]'); await step('curing'); assert.equal(await page.$('[data-quick-exit]'), null);
    await page.reload({ waitUntil: 'networkidle0' }); await step('curing');
    await act('mature'); await step('jury'); await capture(`jury-confirm-${width}`);
    await act('jury'); await step('verdict'); await act('open-market'); await step('prepare');
    await click('[data-quick-route="raw"]'); await step('sale');
    await page.focus('[data-quick-quantity]'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.keyboard.type('25');
    assert.equal(await page.$eval('[data-quick-quantity]', node => node.value), '25');
    assert.equal(await page.$eval('[data-quick-channel="wholesale"]', node => node.disabled), false, 'Professional offer is available');
    await click('[data-quick-channel="wholesale"]'); await step('confirm');
    const confirmation = await page.$eval('[data-quick-sale-confirm]', node => node.textContent);
    assert.match(confirmation, /25 g/); assert.match(confirmation, /TVA réservée/); await capture(`sale-confirm-${width}`);
    await page.reload({ waitUntil: 'networkidle0' }); await step('confirm'); assert.equal(await page.$eval('[data-quick-sale-confirm]', node => node.textContent), confirmation);
    await act('cancel-sale'); await step('sale'); await click('[data-quick-channel="wholesale"]'); await step('confirm');
    await act('sell'); await step('complete'); await capture(`exit-${width}`);
    const exitText = await page.$eval('[data-quick-exit]', node => node.textContent);
    assert.match(exitText, /Recette nette fictive/); assert.match(exitText, /6 heures réelles/); assert.match(exitText, /Stock fictif restant/);
    for (let tab = 0; tab < 10; tab++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog') || document.activeElement === document.body), true, 'Focus never reaches the inert background'); }
    await click('[data-quick-quarter]'); await page.waitForSelector('[data-exit-destination="quarter"]');
    await visit('account=other-' + width); await step('variety');
    await visit('account=' + account); await step('complete');
    await click('[data-quick-learn]'); await page.waitForSelector('[data-exit-destination="learning"]');
    results.push({ width, loop: true, keyboard: true, pauseResume: true, curingReload: true, noAutomaticMaturity: true, confirmationReload: true, cancelledSale: true, accountIsolation: true, quarterExit: true, learningExit: true, exactExit: exitText });
  }
  await visit('unavailable=1'); await step('variety');
  assert.match(await page.$eval('[role="status"]', node => node.textContent), /Sauvegarde locale indisponible/);
  await click('[data-quick-variety]:first-child'); await step('culture'); await act('roll');
  await page.keyboard.press('Escape'); await page.waitForSelector('[data-quick-exit]');
  assert.match(await page.$eval('[data-quick-exit]', node => node.textContent), /n’est pas garantie/);
  results.push({ unavailableStorage: true, stillPlayable: true, explicitUnsavedExit: true });
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []); assert.deepEqual(api, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ results, errors, external, writes, api }, null, 2));
  console.log(JSON.stringify({ passed: results.length, errors, external, writes, api }));
} finally { await browser?.close(); await server.close(); }
