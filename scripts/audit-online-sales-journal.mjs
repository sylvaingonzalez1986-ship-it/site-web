/** Real sales dashboard, polling and full journal against an isolated tutorial API. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/online-sales-journal');
const port = Number(process.env.KQ_SALES_JOURNAL_PORT ?? 3408), origin = `http://127.0.0.1:${port}`;
const modules = {
  entry: `import React from 'react';import {createRoot} from 'react-dom/client';
import {KqCommerceDesk} from '/src/components/placard/KqCommerceDesk';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
import {getKqShopActivity} from '/src/lib/kanab-quest-shop-activity';
let state=createKqOperationsLesson('market');
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
const command=(command,payload)=>execute({action:'online',command,payload});
const raw=getKqOperationsCommerce(state).rawLots[0];
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
let online=state.trial.commerce.online;online.site.tier='flagship';online.site.paidUntil=new Date(state.trial.clock+30*24*3600000).toISOString();online.upgrades.branding=true;online.confidence=95;online.stats.orders=500;
state.trial.commerce.cashCents=10000000;state.trial.commerce.reputation=500;state.trial.commerce.clients=100;online.followers=5000;
command('buy-merch-module',{code:'paper'});command('buy-merch-stock',{code:'stickers',quantity:65});command('update-merch',{code:'stickers',priceCents:400,active:true});
online=state.trial.commerce.online;online.stats.orders=0;
const stockId=state.trial.commerce.stocks[0].id,totalPackets=Math.floor(state.trial.commerce.stocks[0].remainingUnits/50);
command('buy-packaging',{code:'kraft-5',quantity:totalPackets});
const list=(name,packets)=>{state.trial.commerce.stocks[0].name=name;command('create-listing',{stockId,formatGrams:5,packagingCode:'kraft-5',packets,packetPriceCents:913});return state.trial.commerce.online.listings.at(-1).id};
const old=list('Récolte ancienne',totalPackets-7);
for(let day=0;day<7;day++)command('advance-online-time',{hours:24});
const partial=list('Récolte partiellement vendue',3);
const paused=list('Paquets en pause',1);command('pause-listing',{listingId:paused});
const closed=list('Paquets retirés',1);command('close-listing',{listingId:closed});
const blocked=list('Paquets à qualité insuffisante',1);command('pause-listing',{listingId:blocked});
Object.assign(state.trial.commerce.online.listings.find(row=>row.id===blocked),{qualityScore:5.7,status:'quality-blocked'});
const discarded=list('Paquets jetés sans vente',1);command('discard-listing',{listingId:discarded});
online=state.trial.commerce.online;online.site.tier='basic';online.followers=0;online.upgrades={branding:false,photography:false};
state.trial.commerce.reputation=0;state.trial.commerce.clients=0;state.onlineOrderCredits[partial]=.999;
command('advance-online-time',{hours:1});
window.ids={old,partial,paused,closed,blocked,discarded};window.reads=[];window.writes=[];window.failNextJournal=false;window.overlapNextPage=false;
window.fixture=()=>structuredClone(getKqOperationsCommerce(state));
window.receipts=()=>structuredClone(getKqShopActivity(getKqOperationsCommerce(state)).receipts);
window.sellRemaining=()=>{state.trial.commerce.online.followers=5000;state.trial.commerce.reputation=500;state.trial.commerce.clients=100;command('advance-online-time',{hours:24})};
const api=createKqTutorialApi(async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),method=init.method??'GET';
 if(url.origin!==location.origin||!['/api/arena/placard/commerce','/api/arena/placard/commerce/sales'].includes(url.pathname))throw new Error('Unexpected isolated endpoint: '+url.pathname);
 if(method!=='GET'){window.writes.push({path:url.pathname,method});throw new Error('Journal navigation cannot submit commands')}
 window.reads.push(url.pathname+url.search);
 if(url.pathname.endsWith('/sales')){
  await new Promise(done=>setTimeout(done,100));
  if(window.failNextJournal){window.failNextJournal=false;return Response.json({error:'Journal temporairement indisponible.'},{status:503})}
 }
 const before=JSON.stringify(state),result=applyKqOperationsRequest(state,{path:url.pathname+url.search,method,body:{}});
 if(url.pathname.endsWith('/sales')&&(result.state!==state||JSON.stringify(state)!==before))throw new Error('Journal read changed the exercise');
 state=result.state;
 if(url.pathname.endsWith('/sales')&&url.searchParams.has('cursor')&&window.overlapNextPage){window.overlapNextPage=false;const known=window.receipts().find(row=>!result.payload.receipts.some(sale=>sale.id===row.id));if(known)result.payload.receipts.unshift(known)}
 return Response.json(result.payload);
});
createRoot(document.getElementById('root')).render(<KqTutorialApiProvider api={api}><main className="audit-surface"><KqCommerceDesk mode="dashboard" onOpenShop={()=>{}} /></main></KqTutorialApiProvider>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:AuditBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:400 700}:root{--font-display:AuditDisplay;--font-body:AuditBody}*{box-sizing:border-box}body{margin:0;font-family:AuditBody,Arial,sans-serif;background:#174c3b}.audit-surface{max-width:1200px;margin:auto;padding:12px}button,a,select,input{font-family:inherit}</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></body></html>';
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  plugins: [{ name: 'online-sales-journal-audit', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; }, async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; }, configureServer(vite) { vite.middlewares.use((request, response, next) => { if (request.url?.startsWith('/api/')) { response.statusCode = 403; response.end('Real API disabled'); return; } if (request.url !== '/') return next(); response.setHeader('Content-Type', 'text/html'); response.end(html); }); } }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const checks = [], errors = [], forbidden = [];
let browser, page;
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => { const url = request.url(); if ((url.startsWith(origin + '/') && !url.includes('/api/')) || url.startsWith('data:')) void request.continue(); else { forbidden.push(url); void request.abort(); } });
  await page.evaluateOnNewDocument(() => {
    const interval = window.setInterval.bind(window);
    // Exercise only the real 60-second commerce poll; other browser clocks stay real.
    window.setInterval = (callback, delay, ...args) => interval(delay === 60000 ? () => { if (!window.pauseAuditPoll) callback(...args); } : callback, delay === 60000 ? 300 : delay, ...args);
    window.pauseAuditPoll = true;
  });
  await page.setViewport({ width: 1440, height: 1000 }); await page.goto(origin, { waitUntil: 'networkidle0' });
  const journal = '[data-online-sales-journal]', rows = journal + ' [data-online-sale]';
  const rowIds = () => page.$$eval(rows, nodes => nodes.map(node => node.dataset.onlineSale));
  const readCount = () => page.evaluate(() => window.reads.filter(path => path.includes('/commerce/sales')).length);
  const visibleListings = () => page.$$eval('[data-online-listing]', nodes => nodes.map(node => node.dataset.onlineListing));
  const more = async () => { const count = (await rowIds()).length; await page.click('[data-online-sales-more]'); await page.waitForFunction(count => document.querySelectorAll('[data-online-sale]').length > count || document.querySelector('[data-online-sales-retry]'), {}, count); };
  const allPages = async () => { for (let count = 0; await page.$('[data-online-sales-more]:not(:disabled)'); count++) { assert.ok(count < 20, 'Pagination must terminate'); await more(); } };
  const overflow = async width => { await page.setViewport({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width); assert.doesNotMatch(await page.$eval('.audit-surface', node => node.innerText), /NaN|undefined|Infinity/); };

  await page.waitForSelector(journal);
  const ids = await page.evaluate(() => window.ids), initial = await page.evaluate(() => window.fixture());
  const partial = initial.online.listings.find(row => row.id === ids.partial);
  assert.ok(partial.soldPackets > 0 && partial.remainingPackets > 0, 'Fixture contains an actual partial sale');
  assert.ok((await page.evaluate(() => window.receipts())).length > 50, 'Real simulated history spans more than one page');
  assert.deepEqual((await visibleListings()).sort(), [ids.partial, ids.paused, ids.closed, ids.blocked].sort());
  assert.equal(await readCount(), 0, 'Collapsed history does not fetch');
  assert.equal(await page.$eval(journal, node => node.open), false);
  assert.doesNotMatch(await page.$eval('[aria-label="Filtrer les annonces"]', node => node.innerText), /Terminées/);
  checks.push('Partially sold, paused, withdrawn and quality-blocked stock remain; sold-out and discarded cards leave all filters');

  await page.focus(journal + ' summary'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('[data-online-sale]').length === 50);
  assert.equal(await readCount(), 1);
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SUMMARY');
  await overflow(320); await page.$eval(journal, node => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: resolve(output, 'journal-detail-320.png') });
  await overflow(1440);
  await page.$eval(journal, node => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: resolve(output, 'journal-detail-1440.png') });
  const firstPage = await rowIds();
  await page.evaluate(() => { window.failNextJournal = true; }); await more();
  await page.waitForSelector('[data-online-sales-retry]');
  assert.deepEqual(await rowIds(), firstPage, 'A failed next page preserves visible receipts');
  await page.evaluate(() => { window.overlapNextPage = true; });
  await page.click('[data-online-sales-retry]');
  await page.waitForFunction(() => document.querySelectorAll('[data-online-sale]').length > 50);
  await allPages();
  const expected = await page.evaluate(() => window.receipts());
  assert.deepEqual(await rowIds(), expected.map(sale => sale.id), 'All real receipts retain chronological order across page boundaries and overlapping replies');
  assert.equal(new Set(await rowIds()).size, expected.length);
  const displayed = await page.$$eval(rows, nodes => nodes.map(node => ({ id: node.dataset.onlineSale, text: node.innerText,
    amounts: [...node.querySelectorAll('dl dd')].map(value => Math.round(Number(value.textContent.replace(/[^\d,-]/g, '').replace(',', '.')) * 100)) })));
  for (const sale of expected) {
    const row = displayed.find(row => row.id === sale.id);
    assert.ok(row.text.includes(sale.name), 'Recorded product name remains visible');
    assert.ok(row.text.includes(sale.quantity === 1 ? sale.unitLabel.replace(/s$/, '') : sale.unitLabel), 'Packets and merch keep their respective units');
    assert.match(row.text, /TTC/); assert.match(row.text, /Versé en trésorerie/);
    assert.deepEqual(row.amounts, [sale.revenueCents, sale.feesCents, sale.netPayoutCents], 'Each receipt preserves recorded TTC, fees and credited cash');
  }
  assert.ok(!displayed.some(row => row.text.includes('Paquets jetés sans vente')), 'Discarding stock creates no sale');
  checks.push('Keyboard opens the full journal; failed pages retry without losing rows; overlapping pages deduplicate and show every actual flower/merch receipt');

  for (const width of [1440, 320]) { await overflow(width); await page.screenshot({ path: resolve(output, 'journal-' + width + '.png'), fullPage: true }); }
  await page.evaluate(() => { window.sellRemaining(); window.pauseAuditPoll = false; });
  await page.waitForFunction(id => !document.querySelector('[data-online-listing="' + id + '"]'), {}, ids.partial);
  await page.evaluate(() => { window.pauseAuditPoll = true; });
  const refreshed = await page.evaluate(() => window.fixture());
  assert.equal(refreshed.online.listings.find(row => row.id === ids.partial).remainingPackets, 0);
  assert.deepEqual((await visibleListings()).sort(), [ids.paused, ids.closed, ids.blocked].sort());
  assert.equal(refreshed.online.stats.orders - initial.online.stats.orders, partial.remainingPackets);
  assert.equal(refreshed.online.listings.reduce((sum, row) => sum + row.soldPackets, 0), refreshed.online.stats.orders);
  await page.click('[data-online-sales-refresh]'); await page.waitForFunction(() => document.querySelectorAll('[data-online-sale]').length === 50);
  await allPages();
  assert.deepEqual(await rowIds(), (await page.evaluate(() => window.receipts())).map(sale => sale.id));
  checks.push('An automatic commerce poll removes the last sold packet listing without remounting; cumulative totals and refreshed journal retain its complete sales');

  await page.focus(journal + ' summary'); await page.keyboard.press('Enter');
  assert.equal(await page.$eval(journal, node => node.open), false);
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SUMMARY');
  const count = await readCount(); await page.evaluate(() => { window.pauseAuditPoll = false; });
  const commerceReads = await page.evaluate(() => window.reads.filter(path => !path.includes('/sales')).length);
  await page.waitForFunction(count => window.reads.filter(path => !path.includes('/sales')).length >= count + 2, {}, commerceReads);
  await page.evaluate(() => { window.pauseAuditPoll = true; });
  assert.equal(await readCount(), count, 'Closed history stays lazy during automatic polling');
  await overflow(320); await page.screenshot({ path: resolve(output, 'active-listings-320.png'), fullPage: true });
  assert.deepEqual(await page.evaluate(() => window.writes), []); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  checks.push('320px layout and native summary focus work; history closes without losing focus; browsing sends only isolated GETs');
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, checks, receipts: (await page.evaluate(() => window.receipts())).length }, null, 2));
  console.log(`Online sales journal audit: ${checks.length} checks passed.`);
} catch (error) {
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }); console.log(await page.evaluate(() => ({ errors: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent), reads: window.reads, ids: window.ids, text: document.body.innerText.slice(-5000) }))); }
  throw error;
} finally { if (browser) await browser.close(); await server.close(); }
