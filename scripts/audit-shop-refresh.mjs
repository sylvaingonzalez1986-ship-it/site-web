/** Browser checks for the real shop refresh lifecycle, using only an isolated tutorial API. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/shop-refresh');
const port = 3259;
const modules = {
  entry: `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqTreasuryManagement} from '/src/components/placard/KqTreasuryManagement';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
let state=createKqOperationsLesson('market');
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
const command=(command,payload)=>execute({action:'online',command,payload});
state.trial.commerce.business.shop.name='Les Chanvriers Bretons';
const raw=getKqOperationsCommerce(state).rawLots[0];
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const stock=state.trial.commerce.stocks[0];
command('buy-packaging',{code:'kraft-5',quantity:8});
command('create-listing',{stockId:stock.id,formatGrams:5,packagingCode:'kraft-5',packets:8,packetPriceCents:913});
const initial=getKqOperationsCommerce(state);
command('start-marketing',{version:2,code:'behind-scenes',angle:'craft',listingId:initial.online.listings[0].id,budgetCode:'local'});
const campaignSeed=getKqOperationsCommerce(state).online.marketing.active;
const start=performance.now();const origin=Date.parse(initial.business.serverNow);
window.reads=[];window.writes=[];window.mission=null;
const api=createKqTutorialApi(async(path,options)=>{
 if(options?.method==='POST'){window.writes.push({path,body:options.body});throw new Error('This audit never submits an operation')}
 window.reads.push({path,at:performance.now()});
 const snapshot=structuredClone(initial);
 const now=origin+performance.now()-start;
 snapshot.business.serverNow=new Date(now).toISOString();snapshot.online.serverNow=snapshot.business.serverNow;
 if(window.mission)snapshot.online.marketing.active=window.mission;
 return new Response(JSON.stringify(snapshot),{status:200,headers:{'content-type':'application/json'}})
});
window.notify=name=>api.notify(name);
window.launchMissionSoon=()=>{const now=origin+performance.now()-start;window.mission={...structuredClone(campaignSeed),id:'audit-v2-mission',startedAt:new Date(now-12*3600000+120).toISOString(),launchesAt:new Date(now+120).toISOString(),endsAt:new Date(now+48*3600000).toISOString()};api.notify('kq:commerce-updated')};
window.endMissionSoon=()=>{const now=origin+performance.now()-start;window.mission={id:'audit-mission',code:'introduction',angle:'craft',startedAt:new Date(now-1000).toISOString(),endsAt:new Date(now+120).toISOString()};api.notify('kq:commerce-updated')};
function App(){const[mounted,setMounted]=useState(true);window.unmountShop=()=>setMounted(false);return <KqTutorialApiProvider api={api}>{mounted?<KqTreasuryManagement onOpenShop={()=>{}} onPrepareStock={()=>{window.navigation='prepare'}} onViewSales={()=>{window.navigation='sales'}}/>:null}</KqTutorialApiProvider>}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:24px;font-family:Arial,sans-serif;background:#fff3db;color:#162e25}#root{max-width:1100px;margin:auto}</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></body></html>';
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'] },
  plugins: [{
    name: 'shop-refresh-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url !== '/') return next();
        response.setHeader('Content-Type', 'text/html'); response.end(html);
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser, page;
const checks = [], errors = [], blockedRequests = [];
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().startsWith(`http://127.0.0.1:${port}/`) && !request.url().includes('/api/') || request.url().startsWith('data:')) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  await page.evaluateOnNewDocument(() => {
    const interval = window.setInterval.bind(window);
    // Only the shop's polling and display clocks are accelerated. Browser time,
    // request promises, React scheduling and all timeouts keep their real pace.
    window.setInterval = (callback, delay, ...args) => interval(delay === 60000 ? () => { if (!window.suspendAuditPoll) callback(...args); } : callback, delay === 60000 ? 300 : delay === 15000 ? 75 : delay, ...args);
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    window.setAuditHidden = value => { hidden = value; document.dispatchEvent(new Event('visibilitychange')); };
  });
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[aria-label="Pilotage de la boutique"]');
  const count = () => page.evaluate(() => window.reads.length);
  const click = async text => {
    const handle = await page.waitForFunction(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text && !button.disabled && button.getBoundingClientRect().height > 0), {}, text);
    await handle.asElement().click(); await handle.dispose();
  };
  const tabs = '[role="tablist"][aria-label="Gérer ma boutique"]';
  const navigate = async label => {
    const handle = await page.waitForFunction((tabs, label) => [...document.querySelectorAll(tabs + ' [role="tab"]')].find(tab => tab.textContent.trim() === label), {}, tabs, label);
    await handle.asElement().click(); await handle.dispose();
    await page.waitForFunction((tabs, label) => document.querySelector(tabs + ' [aria-selected="true"]')?.textContent.trim() === label, {}, tabs, label);
    assert.equal(await page.$$eval('[role="tabpanel"]', panels => panels.filter(panel => panel.getBoundingClientRect().height > 0).length), 1, 'Only the selected shop panel is visible');
  };
  let before = await count();
  await page.waitForFunction(before => window.reads.length >= before + 2, {}, before);
  checks.push('visible management polls repeatedly');

  await navigate('Réglages');
  const input = 'input[placeholder="Ton nom de marque"]';
  await page.evaluate(selector => { const details = document.querySelector(selector)?.closest('details'); if (details) details.open = true; }, input);
  const draft = 'Ma future enseigne artisanale';
  await page.click(input); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(input, draft);
  before = await count();
  await page.waitForFunction(before => window.reads.length >= before + 2, {}, before);
  assert.equal(await page.$eval(input, node => node.value), draft);
  await navigate('Activité'); await navigate('Communication'); await navigate('Réglages');
  assert.equal(await page.$eval(input, node => node.value), draft);
  checks.push('unsubmitted shop name survives repeated snapshot refreshes and switching shop panels');

  await click('Enregistrer le nom'); await page.waitForSelector('dialog[open]');
  await wait(100); before = await count();
  await page.evaluate(() => { window.notify('kq:commerce-updated'); window.notify('kq:equipment-updated'); });
  await wait(950);
  assert.equal(await count(), before, 'confirmation suspends polling and event-triggered reloads');
  assert.equal(await page.evaluate(() => window.writes.length), 0);
  await click('Revenir');
  await page.waitForFunction(before => window.reads.length > before, {}, before);
  assert.equal(await page.$eval(input, node => node.value), draft);
  checks.push('confirmation suspends refreshes; cancelling resumes polling without losing the draft or writing data');

  await page.evaluate(() => window.setAuditHidden(true));
  await wait(100); before = await count();
  await page.evaluate(() => window.notify('kq:commerce-updated'));
  await wait(950);
  assert.equal(await count(), before, 'hidden tab makes no polling or event requests');
  await page.evaluate(() => window.setAuditHidden(false));
  await page.waitForFunction(before => window.reads.length > before, { timeout: 1000 }, before);
  checks.push('hidden tab suspends refreshes and visibility restoration reloads the snapshot');

  before = await count();
  await page.evaluate(() => window.notify('kq:commerce-updated'));
  await page.waitForFunction(before => window.reads.length > before, { timeout: 1000 }, before);
  checks.push('commerce updates trigger a fresh read');

  await page.evaluate(() => { window.suspendAuditPoll = true; window.launchMissionSoon(); });
  await wait(70); before = await count();
  await wait(450);
  assert.equal(await count(), before + 1, 'The preparation-to-diffusion boundary refreshes exactly once without the regular poll');
  await page.evaluate(() => { window.suspendAuditPoll = false; });
  checks.push('v2 preparation completion refreshes the snapshot at launchesAt independently of regular polling');

  await page.evaluate(() => window.endMissionSoon());
  await wait(750);
  const staleStart = await count();
  await wait(950);
  const staleReads = await count() - staleStart;
  assert.ok(staleReads >= 2 && staleReads <= 4, 'stale elapsed mission permits normal polling without a reload loop: ' + staleReads);
  assert.equal(await page.$eval(input, node => node.value), draft);
  checks.push('a stale expired marketing mission does not create a render/request loop');

  await navigate('Activité');
  await page.click('a[href$="section=sales"]');
  assert.equal(await page.evaluate(() => window.navigation), 'prepare');
  await page.click('a[href$="section=dashboard"]');
  assert.equal(await page.evaluate(() => window.navigation), 'sales');
  checks.push('preparation and sales callbacks pass through management to the shop');

  await page.evaluate(() => window.unmountShop());
  await page.waitForFunction(() => !document.querySelector('[aria-label="Gestion de mon entreprise"]'));
  await wait(100); before = await count();
  await page.evaluate(() => { window.notify('kq:commerce-updated'); window.notify('kq:equipment-updated'); window.setAuditHidden(true); window.setAuditHidden(false); });
  await wait(950);
  assert.equal(await count(), before, 'unmount cleans polling, subscriptions and visibility listener');
  checks.push('unmount removes polling, event subscriptions and visibility handling');
  assert.equal(await page.evaluate(() => window.writes.length), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  checks.push('no mutation, external request, production API request or browser exception');

  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, checks }, null, 2));
  console.log('Shop refresh browser audit: ' + checks.length + ' checks passed. Results: ' + output);
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
    console.log(await page.evaluate(() => ({ reads: window.reads, writes: window.writes })));
  }
  console.log({ errors, blockedRequests });
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
}
