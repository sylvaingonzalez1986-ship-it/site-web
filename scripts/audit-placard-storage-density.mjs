/** Actual conservation component and warehouse wiring, entirely synthetic local API. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/storage-density');
const port = Number(process.env.KQ_STORAGE_DENSITY_AUDIT_PORT ?? 3396);
const origin = `http://127.0.0.1:${port}`;
const baseline = process.argv.includes('--baseline');
const capturesOnly = process.argv.includes('--captures-only');
const protectionOnly = process.argv.includes('--protection-only');
assert(!protectionOnly || (!baseline && !capturesOnly), '--protection-only is a separate focused audit');
const reportSuffix = protectionOnly ? 'protection-' : capturesOnly ? 'captures-' : '';
const baselineNames = ['KqWarehouseHarvests.tsx','KqWarehouseHarvests.module.css','KqWarehouse.tsx','KqWarehouse.module.css'];
const originals = baseline ? new Map(await Promise.all(baselineNames.map(async name => [resolve(root,'src/components/placard',name).replaceAll('\\','/'), await readFile(resolve(output,'baseline',name),'utf8')]))) : new Map();
const readyId = 'd98e8471-1111-4111-8111-111111111111';
const curingId = 'a18f0172-2222-4222-8222-222222222222';
const overflowId = 'e24c9183-3333-4333-8333-333333333333';
const secondOverflowId = 'f65a1274-5555-4555-8555-555555555555';
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `const router={push:href=>{window.__navigation=href;}};export const useRouter=()=>router;`,
  'commerce-witness': `import React from 'react';export function KqCommerceDesk({initialFlowerId}){return <output data-selected-workshop-lot={initialFlowerId}>Lot sélectionné : {initialFlowerId}</output>;}export function KqCommerceComputer(){return null;}`,
  'workshop-witness': `import React from 'react';export function KqWarehouseEntry(){return <div data-workshop-witness>Atelier</div>;}`,
  'conservation-entry': `
    import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KqWarehouseHarvests} from '/src/components/placard/KqWarehouseHarvests';
    import {KqHarvestStorage} from '/src/components/placard/KqHarvestStorage';
    import {KqWarehouse} from '/src/components/placard/KqWarehouse';
    import {createKqWarehouseStarter,getKqWarehouseSummary} from '/src/lib/kanab-quest-warehouse';
    import {KQ_WAREHOUSE_CATALOG} from '/src/lib/kanab-quest-warehouse-catalog';
    import {createKqStorageLot,projectKqStorageLot,KQ_STORAGE_METHODS,KQ_STORAGE_CONTAINERS} from '/src/lib/kanab-quest-storage';
    const query=new URLSearchParams(location.search),scenario=query.get('scenario')??'ready';
    const now=Date.parse('2026-10-18T12:00:00Z');
    const baseline={varietyCode:'HH2026-002',juryScore:8.5,aroma:75,care:{terpenes:75,cannabinoidExpression:70,cannabinoidConversion:15,cannabinoidOxidation:0}};
    function makeLot(flowerId,varietyName,units,ageHours,overflowUnits=0){
      const protectedUnits=units-overflowUnits;
      const capacity={totalUnits:units,allocations:protectedUnits?[{containerCode:'GLASS-3L',quantity:Math.ceil(protectedUnits/1500),storedUnits:protectedUnits}]:[],overflowDeadlineAt:overflowUnits?new Date(now+1800000).toISOString():null,automaticOverflowSale:true};
      const lot=createKqStorageLot({flowerId,harvestedAt:new Date(now-ageHours*3600000).toISOString(),baseline,capacity});
      return {flowerId,varietyName,harvestGrams:units/10,flowerStatus:'available',projection:projectKqStorageLot(lot,now),...(overflowUnits?{overflowOffer:{units:overflowUnits,payoutCents:6750,netPayoutCents:5400}}:{})};
    }
    const ready=makeLot('${readyId}','White Widow CBD',1655,12);
    const curing=makeLot('${curingId}','Purple Haze CBD',2875,3);
    const overflow=makeLot('${overflowId}','Critical CBD',5000,12,1250);
    const secondOverflow=makeLot('${secondOverflowId}','Carmagnola',9250,12,730);
    const dense=[ready,curing,overflow,...[3250,4020,2180,1500,1950].map((units,index)=>makeLot('d98e8471-4444-4444-8444-'+String(index+4).padStart(12,'0'),['Super Skunk CBD','Lemon Haze CBD','Amnesia CBD','Northern Lights CBD','OG Kush CBD'][index],units,index%2?2:12))];
    const lots=scenario==='empty'?[]:scenario==='dense'?dense:scenario==='multi-overflow'?[ready,curing,overflow,secondOverflow]:['mixed','overflow','partial-offer','stale-overflow-error'].includes(scenario)?[ready,curing,overflow]:[ready];
    const inventoryUnits=scenario==='empty'?0:['dense','multi-overflow'].includes(scenario)?lots.reduce((sum,lot)=>sum+lot.projection.capacity.totalUnits,0):9530;
    if(scenario==='long')ready.varietyName='Une variété au nom particulièrement long pour vérifier la lisibilité des cartes';
    if(scenario==='ready-by-clock'){ready.projection.stage='curing';ready.projection.progressPercent=99.9;}
    if(scenario==='no-offer') { lots.splice(0,lots.length,overflow);delete overflow.overflowOffer; }
    if(scenario==='partial-offer')overflow.overflowOffer={units:250,payoutCents:1350,netPayoutCents:1080};
    window.__workshopCalls=[];window.__overflowCalls=[];window.__protectionCalls=[];window.__apiCalls=[];window.__retryCalls=0;window.__holdSale=query.has('hold');
    window.__releaseSale=null;window.__closeCalls=0;window.__failStorage=false;window.__failNextSale=false;window.__fixtures={readyId:ready.flowerId,curingId:curing.flowerId,overflowId:overflow.flowerId,lots:structuredClone(lots)};
    const storage={serverNow:new Date(now).toISOString(),cashCents:587484,ownedMethodCodes:['STORAGE-GLASS'],defaultMethodCode:'STORAGE-GLASS',catalog:KQ_STORAGE_METHODS,containers:KQ_STORAGE_CONTAINERS,ownedContainers:{'GLASS-3L':30},installedContainers:{'GLASS-3L':30},capacity:{totalUnits:40000,usedUnits:inventoryUnits,freeUnits:scenario==='empty'?40000:2100,reservedUnits:scenario==='empty'?0:37900,overflowUnits:lots.reduce((sum,lot)=>sum+lot.projection.capacity.overflowUnits,0)},overflowSales:[],lots};
    const state=createKqWarehouseStarter();
    const snapshot={state,revision:1,cashCents:587484,activeRun:false,activeRuns:[],completedRuns:[],stockGrams:inventoryUnits/10,storageReservedGrams:scenario==='empty'?0:3790,storageCapacityGrams:4000,reservedHarvestGrams:0,salesGramsPerDay:30,context:{available:true}};
    const original=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return original(url,init);
      const call={url:String(url),method:init.method??'GET',body:init.body?JSON.parse(init.body):null};window.__apiCalls.push(call);
      if(call.url==='/api/arena/placard/warehouse')return Response.json(snapshot);
      if(call.url==='/api/arena/placard/collection')return Response.json({ownedBuddieCodes:[],buddieRotation:{requiredDistinctBuddies:2,recentBuddieCodes:[]}});
      if(call.url==='/api/arena/placard/storage'){
        if(window.__failStorage)return Response.json({error:'Lecture des lots interrompue.'},{status:503});
        if(call.method==='POST'){
          window.__overflowCalls.push(call.body);
          if(window.__failNextSale){window.__failNextSale=false;return Response.json({error:'La reprise du surplus a été interrompue.'},{status:503});}
          if(window.__holdSale)await new Promise(resolve=>window.__releaseSale=resolve);
          const sold=storage.lots.find(lot=>lot.flowerId===call.body.flowerId);
          sold.projection.capacity.totalUnits-=sold.projection.capacity.overflowUnits;
          sold.projection.capacity.overflowUnits=0;delete sold.overflowOffer;
        }
        return Response.json(storage);
      }
      throw new Error('Unexpected local fixture API: '+call.url);
    };
    const draftStore=query.has('dirty')?{read:()=>({...state,zones:state.zones.map((zone,index)=>index?zone:{...zone,name:'Brouillon non enregistré',...(query.has('invalid-plan')?{x:999}:{})})}),write:()=>{}}:undefined;
    function Fixture(){
      const [disabled,setDisabled]=React.useState(query.has('disabled'));
      const [area,setArea]=React.useState(query.has('dirty')||query.has('equipment')||query.has('zone')?'warehouse':'harvests');
      const [flowerId,setFlowerId]=React.useState(query.get('flower')??undefined);
      React.useEffect(()=>{window.__setDisabled=setDisabled;},[]);
      const openMarket=id=>{window.__workshopCalls.push(id);setFlowerId(id);setArea('commerce');};
      const openHarvests=id=>{setFlowerId(id);setArea('harvests');};
      return query.has('integration')?area==='warehouse'?<KqWarehouse embedded={!query.has('modal')} initialSection="storage" initialFlowerId={flowerId} initialEquipmentCode={query.has('equipment')?KQ_WAREHOUSE_CATALOG.find(device=>device.room==='storage'&&device.kind==='climate').code:undefined} initialZoneId={query.has('zone')?state.serviceZones?.find(zone=>zone.kind==='storage')?.id:undefined} draftStore={draftStore} onOpenMarket={openMarket} onOpenHarvests={openHarvests} onClose={()=>window.__closeCalls++}/>:area==='commerce'?<output data-selected-workshop-lot={flowerId}>Commerce · {flowerId}</output>:<main><KqHarvestStorage initialFlowerId={flowerId} onOpenMarket={openMarket} onOpenOverview={openHarvests} onOpenWarehouse={query.has('without-protection')?undefined:id=>{setFlowerId(id);setArea('warehouse');}}/></main>:<main data-conservation-fixture><KqWarehouseHarvests storage={['loading','unknown','error'].includes(scenario)?null:storage} stockGrams={scenario==='loading'||scenario==='unknown'?null:snapshot.stockGrams} storageReservedGrams={scenario==='loading'||scenario==='unknown'?null:snapshot.storageReservedGrams} storageCapacityGrams={scenario==='unknown'?null:4000} disabled={disabled} error={scenario.includes('error')?'Lecture des lots interrompue.':undefined} onRetry={()=>window.__retryCalls++} onOpenWorkshop={flowerId=>window.__workshopCalls.push(flowerId)} onSellOverflow={flowerId=>window.__overflowCalls.push(flowerId)} onProtectOverflow={query.has('without-protection')?undefined:flowerId=>window.__protectionCalls.push(flowerId)}/></main>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `,
};
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, baseline?'vite-cache-before':'vite-cache-after'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  resolve: { alias: { '@': resolve(root, 'src') } }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'conservation-audit', enforce: 'pre',
    resolveId(id) {
      if (id in modules) return '\0' + id;
      if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets';
      if (id === './KqCommerceDesk') return '\0commerce-witness';
      if (id === './KqWarehouseEntry') return '\0workshop-witness';
    },
    async load(id) { if (originals.has(id.replaceAll('\\','/'))) return originals.get(id.replaceAll('\\','/')); if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conservation · audit local</title><style>@font-face{font-family:"Warehouse Display";src:url("/src/app/fonts/BarlowCondensed-Latin-Bold.woff2") format("woff2");font-weight:700;font-display:swap}@font-face{font-family:"Warehouse Body";src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2") format("woff2");font-weight:300 700;font-display:swap}:root{--font-display:"Warehouse Display";--font-body:"Warehouse Body";--font-sans:"Warehouse Body";--ink:#172923;--muted:#536058;--green:#076c61;--line:#17292355}body{margin:0;background:#fff1d6;padding:24px;font-family:var(--font-body),sans-serif;color:#172923}main{max-width:1500px;margin:auto}button,input{font-family:inherit}@media(max-width:600px){body{padding:10px}}</style><div id="root"></div><script type="module" src="/@id/__x00__conservation-entry"></script></html>');
      });
    },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

const checks = [], errors = [], forbidden = [], measures = [], screenshots = [];
let browser, page, changingFixture = false, comparisonAvailable = false;
const verify = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks.push(label); };
const phase = baseline ? 'before' : 'after';
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { if (changingFixture && dialog.type() === 'beforeunload') void dialog.accept(); else { errors.push('Unexpected native dialog: ' + dialog.type()); void dialog.dismiss(); } });
  page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => { const url = new URL(request.url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) void request.continue(); else { forbidden.push(request.url()); void request.abort(); } });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const visit = async (scenario = 'dense', extra = '&integration') => {
    changingFixture = true;
    try { await page.goto(`${origin}/?scenario=${scenario}${extra}`, { waitUntil: 'networkidle0' }); } finally { changingFixture = false; }
    await page.waitForSelector('[data-conservation-summary], [data-warehouse-harvests-access]'); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.allSettled([...document.images].map(image => image.decode())));
    console.log('Fixture ready:', scenario + extra);
  };
  const text = selector => page.$eval(selector, element => element.textContent.replaceAll('\u00a0', ' ').replaceAll('\u202f', ' '));
  async function layout(label) {
    verify(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, label + ': no horizontal overflow');
    verify(await page.evaluate(() => /NaN|Infinity|undefined|Invalid Date/.test(document.body.textContent)), false, label + ': no invalid numbers');
  }
  async function shot(name, fullPage = true) { const file = `${phase}-${name}.png`; await page.screenshot({ path: resolve(output, file), fullPage }); screenshots.push(file); }
  async function press(selector) { await page.focus(selector); await page.keyboard.press('Enter'); }
  for (const width of protectionOnly ? [] : [320, 390, 1440, 1644]) {
    await page.setViewport({ width, height: 1000, isMobile: width < 700, hasTouch: width < 700 }); await visit();
    verify(await page.$$eval('[data-conservation-lot]', nodes => nodes.length), 8, `${width}: eight independent lots in the real parent`);
    await layout(String(width));
    const measured = await page.evaluate(() => {
      const lots = [...document.querySelectorAll('[data-conservation-lot]')];
      const height = lots.map(lot => Math.round(lot.getBoundingClientRect().height));
      const first = lots[0].getBoundingClientRect();
      return { viewport: innerWidth, lotHeights: height, medianLotHeight: [...height].sort((a, b) => a - b)[Math.floor(height.length / 2)], firstLotTop: Math.round(first.top + scrollY), firstLotWidth: Math.round(first.width), documentHeight: document.documentElement.scrollHeight,
        equipmentOutsideHarvests: !document.querySelector('[data-storage-equipment], [data-warehouse-room]') };
    });
    measures.push(measured); await shot(`parent-${width}`); await shot(`top-${width}`, false);
    await page.$eval('[data-conservation-lot]', element => element.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot(`first-lots-${width}`, false);
    if (!baseline) {
      verify(measured.equipmentOutsideHarvests, true, `${width}: conservation contains no equipment manager or warehouse navigation`);
      verify(await page.$$eval('[data-lot-details]', nodes => nodes.every(node => !node.open)), true, `${width}: lot details start closed`);
      verify(await page.$$eval('[data-lot-quality],[data-curing-progress]', nodes => nodes.every(node => node.getBoundingClientRect().height > 0)), true, `${width}: quality and curing remain visible with details closed`);
      verify(await page.$$eval('[data-conservation-lot] button,[data-lot-details] > summary', nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).every(node => node.getBoundingClientRect().height >= 44)), true, `${width}: visible lot controls keep 44px touch targets`);
      verify(await page.$eval('[data-storage-summary-details]', node => node.open), false, `${width}: secondary global statistics start closed`);
      await press(`[data-conservation-lot="${readyId}"] [data-lot-details] > summary`);
      verify(await page.$eval(`[data-conservation-lot="${readyId}"] [data-lot-details]`, node => node.open), true, `${width}: lot details open with keyboard`);
      await press(`[data-conservation-lot="${readyId}"] [data-lot-details] > summary`);
      await press('[data-harvest-open-warehouse]'); await page.waitForSelector('[data-storage-climate-section]', { visible: true });
      verify(await page.$eval('[data-storage-equipment]', node => node.open), true, `${width}: explicit capacity action opens the warehouse equipment`);
      verify((await text('[data-storage-equipment] > summary')).includes('/ mois de jeu'), true, `${width}: installed monthly climate costs remain visible`);
      verify(await page.$$eval('[data-conservation-lot]', nodes => nodes.length), 0, `${width}: warehouse has no second lot manager`);
      await layout(`${width} equipment open`);
      await press('[data-warehouse-harvests-access] button'); await page.waitForSelector('[data-harvest-storage]');
    }
  }
  if (!protectionOnly) await writeFile(resolve(output, `${phase}-measures.json`), JSON.stringify(measures, null, 2));

  if (!baseline && !capturesOnly) {
    if (!protectionOnly) {
    await page.setViewport({ width: 390, height: 1000 }); await visit('mixed', '');
    const ready = `[data-conservation-lot="${readyId}"]`, curing = `[data-conservation-lot="${curingId}"]`, overflow = `[data-conservation-lot="${overflowId}"]`;
    verify((await text(ready)).includes('165,5 g'), true, 'Each lot keeps its own current quantity');
    verify((await text(`${ready} [data-lot-quality]`)).includes('/10'), true, 'Quality remains visible with its own scale');
    verify(await page.$eval(`${curing} [data-curing-progress] [role="meter"]`, node => Number(node.getAttribute('aria-valuenow'))), 50, 'Three of six hours remains a real 50% curing progress');
    await press(`[data-open-workshop="${curingId}"]`); verify(await page.evaluate(() => window.__workshopCalls), [curingId], 'A curing lot can open its conditions at the counter with the exact ID');
    await press(`[data-open-workshop="${readyId}"]`); verify(await page.evaluate(() => window.__workshopCalls), [curingId, readyId], 'Ready lot passes its own ID');
    const urgentText = await page.$eval(overflow, node => node.innerText.replaceAll('\u00a0', ' ').replaceAll('\u202f', ' '));
    for (const amount of ['125', '67,50', '54']) verify(urgentText.includes(amount), true, `Urgent surplus retains mass/gross/net: ${amount}`);
    verify(await page.$eval(`${overflow} [data-overflow-deadline]`, node => Boolean(node.getClientRects().length)), true, 'Automatic sale deadline stays visible without opening details');
    verify(await page.$$eval('[data-protect-overflow]', nodes => nodes.map(node => node.dataset.protectOverflow)), [overflowId], 'Only the lot with an actual surplus offers protection');
    await press(`[data-protect-overflow="${overflowId}"]`); verify(await page.evaluate(() => window.__protectionCalls), [overflowId], 'Protection forwards the selected lot ID by keyboard');
    verify(await page.evaluate(() => window.__overflowCalls.length), 0, 'Protection does not call the sale callback');
    verify(await page.evaluate(() => window.__apiCalls.filter(call => call.method !== 'GET').length), 0, 'Protection does not write to any API');
    await press(`[data-sell-overflow="${overflowId}"]`); verify(await page.evaluate(() => window.__overflowCalls), [overflowId], 'Surplus action forwards the exact ID');
    await page.evaluate(() => window.__setDisabled(true)); await page.waitForFunction(() => [...document.querySelectorAll('[data-open-workshop],[data-sell-overflow],[data-protect-overflow]')].every(node => node.disabled));
    await page.$eval(`[data-sell-overflow="${overflowId}"]`, node => node.click()); verify(await page.evaluate(() => window.__overflowCalls), [overflowId], 'Disabled action cannot repeat a sale');
    await page.$eval(`[data-protect-overflow="${overflowId}"]`, node => node.click()); verify(await page.evaluate(() => window.__protectionCalls), [overflowId], 'Disabled protection cannot repeat its callback');
    await visit('ready-by-clock', '');
    verify((await text('[data-curing-status]')).toLowerCase().includes('terminé'), false, 'Server curing stage does not become ready merely because the clock elapsed');
    verify((await text('[data-conservation-summary]')).includes('99 %'), true, 'Unconfirmed curing stays at 99% in readable text');
    await visit('unknown', ''); verify(await page.$$eval('[data-conservation-capacity] [role="meter"]', nodes => nodes.length), 0, 'Unknown capacity is not zero');
    await visit('no-offer', ''); verify(await page.$$eval('[data-sell-overflow]', nodes => nodes.length), 0, 'No invented sale action without an offer');
    verify((await text('[data-conservation-lot]')).includes('125'), true, 'Unpriced surplus stays visible');
    await press(`[data-protect-overflow="${overflowId}"]`); verify(await page.evaluate(() => window.__protectionCalls), [overflowId], 'A surplus can be protected without an available wholesale offer');
    await visit('mixed', '&without-protection'); verify(await page.$$eval('[data-protect-overflow]', nodes => nodes.length), 0, 'No ineffective protection button when the optional callback is absent');
    await visit('error', ''); await page.click('[role="alert"] button'); verify(await page.evaluate(() => window.__retryCalls), 1, 'Load error keeps a working retry');
    await visit('stale-error', ''); verify(await page.$$eval('[data-open-workshop]', nodes => nodes.every(node => node.disabled)), true, 'A refresh error keeps known lots visible but prevents stale actions');
    await visit('stale-overflow-error', ''); verify(await page.$eval(`[data-protect-overflow="${overflowId}"]`, node => node.disabled), true, 'A stale conservation snapshot disables protection');
    await page.$eval(`[data-protect-overflow="${overflowId}"]`, node => node.click()); verify(await page.evaluate(() => window.__protectionCalls.length), 0, 'Stale surplus cannot pass its old context to the equipment');
    for (const scenario of ['empty', 'loading', 'long']) { await visit(scenario, ''); await layout(scenario); }

    await visit('ready'); await press(`[data-open-workshop="${readyId}"]`); await page.waitForSelector('[data-selected-workshop-lot]');
    verify(await page.$eval('[data-selected-workshop-lot]', node => node.dataset.selectedWorkshopLot), readyId, 'Conservation forwards the selected lot to Commerce');
    verify(await page.$$eval('[data-warehouse-room]', nodes => nodes.length), 0, 'Preparing a sale never mounts a warehouse room');
    }
    await page.setViewport({ width: 320, height: 900 }); await visit('multi-overflow');
    verify(await page.$$eval('[data-protect-overflow]', nodes => nodes.length), 2, 'Two independent surplus lots expose their own protection action');
    const protectionContext = '[data-storage-protection-target]';
    for (const [flowerId, variety, grams] of [[secondOverflowId, 'Carmagnola', '73'], [overflowId, 'Critical CBD', '125']]) {
      await press(`[data-protect-overflow="${flowerId}"]`);
      await page.waitForFunction(id => document.querySelector('[data-storage-equipment]')?.open && document.querySelector('[data-storage-protection-target]')?.getAttribute('data-storage-protection-target') === id, {}, flowerId);
      await page.waitForFunction(() => document.activeElement === document.querySelector('[data-storage-protection-target]'));
      verify(await page.evaluate(() => document.activeElement === document.querySelector('[data-storage-protection-target]')), true, `${variety}: keyboard focus reaches the selected lot beside configuration`);
      const context = await text(protectionContext);
      verify(context.includes(variety), true, `${variety}: protection context identifies the selected variety`);
      verify(new RegExp('(?:^|\\s)' + grams + '\\s*g(?:\\s|$|[.,;])').test(await text(`${protectionContext} [role="status"]`)), true, `${variety}: context uses the selected lot's actual surplus grams`);
      verify(await page.$$eval(protectionContext, nodes => nodes.length), 1, `${variety}: switching lots replaces the previous context`);
      verify(await page.evaluate(() => window.__apiCalls.filter(call => call.method !== 'GET').length), 0, `${variety}: opening equipment neither buys, allocates nor saves`);
      verify(await page.$$eval('[data-warehouse-draft]', nodes => nodes.length), 0, `${variety}: navigation does not create a plan draft`);
      verify(await page.evaluate(() => {
        const context = document.querySelector('[data-storage-protection-target]');
        const chart = document.querySelector('[data-postharvest-comparison="storage"]');
        const zone = document.querySelector('[data-post-harvest="storage"] [data-post-harvest-zone]');
        return Boolean(context && chart && zone && (chart.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING) && (context.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING));
      }), true, `${variety}: the original comparison remains above and storage configuration follows the context`);
      verify(await page.$$eval('[data-post-harvest="storage"] [data-postharvest-upgrade]', nodes => nodes.some(node => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight && rect.height > 0; })), true, `${variety}: a storage upgrade is visible immediately at 320px without more scrolling`);
      await layout(`320 protection ${variety}`);
      await press('[data-return-protection-lot]');
      await page.waitForFunction(id => document.activeElement?.getAttribute('data-conservation-lot')===id, {}, flowerId);
      verify(await page.evaluate(() => document.activeElement?.getAttribute('data-conservation-lot')), flowerId, `${variety}: keyboard return focuses the same lot`);
    }
    await press(`[data-protect-overflow="${overflowId}"]`);
    await shot('protection-target-320', false);
    await page.setViewport({ width: 1440, height: 1000 });
    await page.$eval(protectionContext, element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await layout('1440 protection context'); await shot('protection-target-1440', false);
    await press('[data-return-protection-lot]'); await page.waitForSelector('[data-harvest-storage]');
    verify(await page.$$eval('[data-protect-overflow]', nodes => nodes.length), 2, 'Returning from equipment preserves both unprotected surpluses');
    await press(`[data-sell-overflow="${overflowId}"]`);
    await page.waitForFunction(id => !document.querySelector(`[data-sell-overflow="${id}"]`), {}, overflowId);
    verify(await page.$eval(`[data-conservation-lot="${overflowId}"] [data-curing-status]`, node => node.textContent.includes('Contenant manquant')), false, 'Refreshed lot stops showing the old surplus after an explicit sale');
    verify(await page.$$eval('[data-protect-overflow]', nodes => nodes.map(node => node.dataset.protectOverflow)), [secondOverflowId], 'An explicit sale preserves the other lot and its protection action');
    verify(await page.evaluate(() => window.__apiCalls.filter(call => call.method !== 'GET').map(call => ({method:call.method,action:call.body?.action,flowerId:call.body?.flowerId}))), [{method:'POST',action:'sell-overflow',flowerId:overflowId}], 'Only the separately requested sale produces a write');
    await page.setViewport({ width: 320, height: 900 });
    await visit('partial-offer'); await press(`[data-protect-overflow="${overflowId}"]`); await page.waitForSelector(protectionContext, { visible: true });
    verify(/(?:^|\s)125\s*g(?:\s|$|[.,;])/.test(await text(`${protectionContext} [role="status"]`)), true, 'A partial 25 g wholesale offer does not replace the actual 125 g protection need');
    verify(await page.evaluate(() => window.__apiCalls.filter(call => call.method !== 'GET').length), 0, 'Partial-offer protection remains navigation only');
    await visit('no-offer'); await press(`[data-protect-overflow="${overflowId}"]`); await page.waitForSelector(protectionContext, { visible: true });
    verify((await text(protectionContext)).includes('Critical CBD'), true, 'Real parent opens protection equipment even without a sale offer');
    await layout('320 protection without offer');
    if (!protectionOnly) {
    await visit('mixed', '&integration&dirty'); verify(await page.$$eval('[data-sell-overflow],[data-protect-overflow]', nodes => nodes.length), 0, 'An unsaved warehouse plan contains no sale or lot manager');
    verify(await page.$eval('[data-warehouse-harvests-access] button', node => node.disabled), true, 'A plan must be saved or cancelled before using the contextual return');
    await page.$eval('[data-warehouse-harvests-access] button', node => node.click()); verify(await page.$$eval('[data-harvest-storage]', nodes => nodes.length), 0, 'Disabled return keeps the unsaved plan in place');
    verify(await page.evaluate(() => window.__overflowCalls.length), 0, 'Unsaved plan cannot send a sale request');
    await visit('mixed', '&integration&dirty&invalid-plan');
    verify(await page.$$eval('[data-storage-equipment]', nodes => nodes.length), 0, 'An invalid draft exposes correction instead of absent equipment');
    verify(await page.$$eval('[data-protect-overflow]', nodes => nodes.length), 0, 'An invalid draft cannot offer navigation to equipment that is not rendered');
    verify(await page.evaluate(() => window.__apiCalls.filter(call => call.method !== 'GET').length), 0, 'Invalid draft remains local without implicit save');
    await visit('mixed', '&integration&hold'); await press(`[data-sell-overflow="${overflowId}"]`); await page.waitForFunction(() => window.__overflowCalls.length === 1);
    verify(await page.$eval(`[data-sell-overflow="${overflowId}"]`, node => node.disabled), true, 'Pending sale cannot be repeated');
    verify(await page.$eval(`[data-protect-overflow="${overflowId}"]`, node => node.disabled), true, 'Pending sale also disables surplus protection');
    const sale = await page.evaluate(() => window.__overflowCalls[0]); verify(sale.action, 'sell-overflow', 'Existing sale command preserved'); verify(sale.flowerId, overflowId, 'Pending sale keeps the exact lot'); verify(typeof sale.requestKey, 'string', 'Sale keeps its idempotency key');
    await page.evaluate(() => window.__releaseSale()); await page.waitForFunction(() => !document.querySelector('[data-sell-overflow]'));
    verify(await page.$$eval('[data-conservation-lot]', nodes => nodes.length), 3, 'Sale preserves the protected remainder and other lots');
    await visit('mixed'); await page.evaluate(() => { window.__failNextSale=true; }); await press(`[data-sell-overflow="${overflowId}"]`); await page.waitForSelector('[role="alert"]');
    verify(await page.$eval(`[data-sell-overflow="${overflowId}"]`, node => node.disabled), true, 'A failed sale requires refreshing its offer before retry');
    await press('[role="alert"] button'); await page.waitForSelector('[role="alert"]', {hidden:true});
    await press(`[data-sell-overflow="${overflowId}"]`); await page.waitForFunction(() => window.__overflowCalls.length===2 && !document.querySelector('[data-sell-overflow]'));
    verify(await page.evaluate(() => window.__overflowCalls[0].requestKey===window.__overflowCalls[1].requestKey), true, 'Retrying an interrupted sale retains its idempotency key');
    await visit('mixed'); await page.evaluate(() => { window.__failStorage=true; }); await press('[aria-label="Actualiser le stockage"]'); await page.waitForSelector('[role="alert"]');
    verify(await page.$$eval('[data-open-commerce],[data-sell-overflow],[data-protect-overflow]', nodes => nodes.every(node => node.disabled)), true, 'A failed real refresh disables all stale lot actions');
    await page.evaluate(() => { window.__failStorage=false; }); await press('[role="alert"] button'); await page.waitForSelector('[role="alert"]', {hidden:true});
    verify(await page.$eval(`[data-sell-overflow="${overflowId}"]`, node => node.disabled), false, 'Retry restores an authoritative offer and enables its action');
    await visit('mixed', '&integration&without-protection');
    verify(await page.$eval(`[data-protect-overflow="${overflowId}"]`, node => new URL(node.href).searchParams.get('flower')), overflowId, 'Standalone protection link preserves its lot');
    verify(await page.$eval(`[data-protect-overflow="${overflowId}"]`, node => new URL(node.href).searchParams.get('view')), 'workshop', 'Standalone protection link opens the warehouse');
    for (const target of ['equipment', 'zone']) { await visit('dense', '&integration&' + target); verify(await page.$eval('[data-storage-equipment]', node => node.open), true, `Explicit ${target} entry opens the equipment controls`); }
    await visit('ready', '&integration&equipment&flower='+readyId); await press('[data-warehouse-room="processing"]'); await page.waitForSelector('[data-warehouse-commerce-access] button');
    verify(await page.$$eval('[data-selected-workshop-lot]', nodes => nodes.length), 0, 'Atelier no longer embeds the Commerce sales manager');
    await press('[data-warehouse-commerce-access] button'); await page.waitForSelector('[data-selected-workshop-lot]'); verify(await page.$eval('[data-selected-workshop-lot]', node => node.dataset.selectedWorkshopLot), readyId, 'Atelier opens Commerce with the same lot');
    await visit('empty'); verify(await page.$$eval('[data-warehouse-capacity-blocked]', nodes => nodes.length), 0, 'An empty installed warehouse has no capacity warning');
    verify(await page.$eval('[data-conservation-summary]', node => Number.parseFloat(getComputedStyle(node).paddingTop) >= 16), true, 'The flower heading keeps spacing when no warning precedes it'); await shot('no-warning-390', false);
    await visit('dense', '&integration&dirty&modal'); await press('[aria-label="Fermer l’entrepôt"]'); await page.waitForSelector('[data-app-dialog]', { visible: true });
    verify((await text('[data-app-dialog]')).includes('Modifications en cours'), true, 'An unsaved plan still requires the leave confirmation');
    await page.keyboard.press('Escape'); await page.waitForSelector('[data-app-dialog]', { hidden: true }); verify(await page.evaluate(() => window.__closeCalls), 0, 'Dismissing the leave confirmation preserves the warehouse');
    await press('[aria-label="Fermer l’entrepôt"]'); await page.waitForSelector('[data-app-dialog]', { visible: true });
    const leave = await page.evaluateHandle(() => [...document.querySelectorAll('[data-app-dialog] button')].find(button => /Quitter (en gardant|sans enregistrer)/.test(button.textContent)));
    assert(leave.asElement(), 'The confirmation exposes an explicit leave action');
    await leave.asElement().focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__closeCalls === 1); verify(await page.evaluate(() => window.__apiCalls.filter(call => call.method === 'POST').length), 0, 'Leaving with a draft never installs it implicitly');
    const previous = await readFile(resolve(output, 'before-report.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    comparisonAvailable = Boolean(previous?.success && previous.measures);
    if (comparisonAvailable) for (const measure of measures) { const before = previous.measures.find(item => item.viewport === measure.viewport); if (!before) continue; verify(measure.medianLotHeight < before.medianLotHeight, true, `${measure.viewport}: lot height is smaller than the baseline`); verify(measure.firstLotTop < before.firstLotTop, true, `${measure.viewport}: first flower appears earlier than the baseline`); }
    }
  }
  verify(errors, [], 'No browser exception'); verify(forbidden, [], 'No external requests');
  await writeFile(resolve(output, `${phase}-${reportSuffix}report.json`), JSON.stringify({ success: true, baseline, protectionOnly, comparisonAvailable, checks: checks.length, results: checks, measures, screenshots, errors, forbidden }, null, 2));
  console.log(JSON.stringify({ success: true, phase, protectionOnly, checks: checks.length, measures, output }, null, 2));
} catch (error) {
  await Promise.race([page?.screenshot({ path: resolve(output, `${phase}-failure.png`), fullPage: true }).catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
  await writeFile(resolve(output, `${phase}-${reportSuffix}report.json`), JSON.stringify({ success: false, error: error.stack, checks, measures, errors, forbidden }, null, 2)); console.error(error.stack); process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
