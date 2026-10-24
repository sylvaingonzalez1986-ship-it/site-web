/** Real player Shell; all culture, collection and warehouse data stay in memory. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-culture-buddies');
const port = Number(process.env.KQ_CULTURE_BUDDIES_PORT ?? 3431), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const zonesOnly = process.argv.includes('--zones-only');
const reportFile = zonesOnly ? 'zones-report.json' : 'report.json';
const entry = `
import React from'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
import{PlacardPlayerShell}from'/src/components/placard/PlacardPlayerShell';
import{KqTutorialApiProvider,createKqTutorialApi}from'/src/components/placard/KqTutorialApiContext';
import{createReleveCultureTransport}from'/src/lib/kanab-quest-releve-culture';
import{getReleveNativeWarehouse}from'/src/lib/kanab-quest-releve-warehouse';
import{createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan}from'/src/lib/kanab-quest-releve-production';
import{createKqOperationsLesson,getKqOperationsEquipment}from'/src/lib/kanab-quest-operations-lesson';
const scenario=new URLSearchParams(location.search).get('scenario')||'single';
if(!new URLSearchParams(location.search).has('view'))history.replaceState(null,'','?scenario='+scenario+'&view=game&campaign=1');
let production=createKqReleveProduction();production.recentBuddieCodes=[];
if(scenario==='no-zones')production.revision=1;
const act=action=>production=applyKqReleveProductionAction(production,action);
if(scenario!=='no-zones'){act({type:'draft',warehouse:suggestKqRelevePlan(production,['multi','paused','rotation'].includes(scenario)?2:1)});act({type:'save-plan'});}
for(let index=0;index<3;index++)act({type:'reveal-buddie'});
if(scenario!=='no-zones'&&scenario!=='unassigned'){production.warehouse.zones.forEach((zone,index)=>act({type:'assign',zoneId:zone.id,buddieCode:production.ownedBuddies[index]}));act({type:'save-plan'});}
if(scenario==='rotation')production.recentBuddieCodes=[production.ownedBuddies[0],production.ownedBuddies[2]];
if(scenario==='paused'){production.warehouse.zones[1].active=false;production.draftWarehouse=structuredClone(production.warehouse);}
if(scenario==='active')act({type:'launch'});
const initial=structuredClone(production),lesson=createKqOperationsLesson('market');
const control={warehouseMode:scenario==='warehouse-error'?'error':scenario==='warehouse-malformed'?'malformed':'known',collectionMode:scenario==='collection-pending'?'pending':scenario==='collection-error'?'error':'known',rotationUnknown:scenario==='rotation-unknown',patchMode:'known',energyPending:false};
const deferred=[],patchReceipts=new Map();window.__calls=[];window.__unexpected=[];window.__appliedPatches=0;
const transport=createReleveCultureTransport({getState:()=>production,setState:next=>production=next});
const response=(body,status=200)=>Response.json(body,{status});
const request=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method??'GET',body=init.body?JSON.parse(init.body):null;
 window.__calls.push({path,method,body});
 if(method!=='GET'&&!(method==='PATCH'&&path.endsWith('/warehouse'))&&!(method==='POST'&&path.endsWith('/runs'))){window.__unexpected.push({path,method,body});return response({error:'Action hors périmètre de la recette.'},403);}
 if(path.endsWith('/equipment'))return response({...getKqOperationsEquipment(lesson),routePlan:null,strength:null});
 if(path.endsWith('/contracts'))return response({error:'Contrat hors périmètre de la recette.'},404);
 if(path.endsWith('/boosters')||path.endsWith('/missions'))return response({error:'Récompense hors périmètre de la recette.'},503);
 if(path.endsWith('/bootstrap')||path.endsWith('/collection')){
  if(control.collectionMode==='pending')await new Promise(done=>deferred.push(done));
  if(control.collectionMode==='error')return response({error:'Collection momentanément indisponible.'},503);
  const received=await transport(input,init),payload=await received.json();
  if(control.rotationUnknown){payload.buddieRotation=null;if(payload.playerSession)payload.playerSession.buddieRotation=null;}
  return response(payload,received.status);
 }
 if(path.endsWith('/energy')&&control.energyPending)await new Promise(done=>deferred.push(done));
 if(path.endsWith('/warehouse')){
  if(method==='GET'){
   if(control.warehouseMode==='error')return response({error:'Plan momentanément indisponible.'},503);
   if(control.warehouseMode==='malformed')return response({state:null,revision:null});
  }else{
   const cached=patchReceipts.get(body.requestKey);
   if(cached){if(JSON.stringify(cached.body)!==JSON.stringify(body))throw new Error('Request key reused for a different warehouse update');return response({...getReleveNativeWarehouse(production),receipt:{...cached.payload.receipt,replayed:true}});}
   if(control.patchMode==='pending')await new Promise(done=>deferred.push(done));
   if(control.patchMode==='503'){control.patchMode='known';return response({error:'Enregistrement momentanément indisponible.'},503);}
   if(control.patchMode==='409'){control.patchMode='known';production.revision++;production.warehouse.zones[0].name='Zone renommée ailleurs';production.draftWarehouse=structuredClone(production.warehouse);return response({error:'Ce plan a changé. Actualise avant de continuer.'},409);}
   const received=await transport(input,init),payload=await received.json();
   if(received.ok){payload.receipt={requestKey:body.requestKey,revision:payload.revision,investmentCents:0,creditUsedCents:0,chargedCents:0,replayed:false};window.__appliedPatches++;patchReceipts.set(body.requestKey,{body,payload});if(control.patchMode==='lost'){control.patchMode='known';throw new TypeError('Connexion interrompue après enregistrement.');}}
   return response(payload,received.status);
  }
 }
 const received=await transport(input,init);if(!received.ok)window.__unexpected.push({path,method,status:received.status});return received;
};
const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>new URL(typeof input==='string'?input:input.url,location.origin).pathname.startsWith('/api/')?request(input,init):originalFetch(input,init);
const api=createKqTutorialApi(request,{nativeWarehouse:true});api.isTutorial=false;
window.__fixture=()=>structuredClone({scenario,initial,production,warehouse:getReleveNativeWarehouse(production),control});
window.__control={set:(key,value)=>control[key]=value,externalAssignment:()=>{production.revision++;production.warehouse.zones[0].buddieCode=production.ownedBuddies[2];production.draftWarehouse=structuredClone(production.warehouse);},resolve:()=>{control.collectionMode='known';control.energyPending=false;control.patchMode='known';deferred.splice(0).forEach(done=>done());},notify:name=>api.notify(name)};
createRoot(document.getElementById('root')).render(<KqTutorialApiProvider api={api}><aside className="fixture-tools"><strong>Démo locale · choisir ses Buddies dans Culture</strong><p>Compte et données fictifs en mémoire.</p><select aria-label="Scénario local" value={scenario} onChange={event=>location.href='/?scenario='+event.target.value}>{['single','multi','unassigned','rotation','rotation-unknown','collection-error','warehouse-error','no-zones','active'].map(value=><option key={value}>{value}</option>)}</select></aside><PlacardPlayerShell draftOwnerId="culture-buddies-local-fixture"/></KqTutorialApiProvider>);
`;
const modules = {
  entry,
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
  '@/context/CartContext': `export const useCart=()=>({user:{id:'00000000-0000-4000-8000-000000000099'},isAuthenticated:true,authLoading:false,refreshSession:async()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}.fixture-tools{padding:12px 18px;font:12px Body;background:#182b24;color:#fff1d6}.fixture-tools p{margin:5px 0}.fixture-tools select{color:#172923;background:#fff1d6;padding:4px 8px}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react', '@3d-dice/dice-box-threejs'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'culture-buddies-audit', enforce: 'pre', resolveId(id) { if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets'; if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split('?')[0] !== '/') return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Buddies · démo locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [], unexpectedRequests = [];
let browser, page;
await mkdir(output, { recursive: true }); await server.listen();
if (preview) {
  console.log(`Local culture Buddies demo: ${origin} (PID ${process.pid}). In-memory data only.`);
  await new Promise(resolveStop => { const stop = () => { void server.close().then(resolveStop); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); });
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => { const url = new URL(request.url()); if (['data:', 'blob:'].includes(url.protocol)) return void request.continue(); if (url.origin !== origin || url.pathname.startsWith('/api/')) { forbiddenRequests.push(request.url()); return void request.abort(); } void request.continue(); });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const section='[data-culture-buddies]', cards='[data-setup-choice="cards"]', heritage='[data-setup-choice="heritage"]';
  const keyClick=async selector=>{await page.waitForSelector(selector,{visible:true});await page.focus(selector);await page.keyboard.press('Enter');};
  async function button(label,scope='body') {const match=await page.waitForFunction((label,scope)=>[...document.querySelectorAll(scope+' button')].find(node=>node.textContent.trim()===label&&!node.disabled&&node.getClientRects().length),{},label,scope);await match.asElement().focus();await page.keyboard.press('Enter');await match.dispose();}
  const fixture=()=>page.evaluate(()=>window.__fixture());
  const calls=()=>page.evaluate(()=>window.__calls);
  const mutations=async()=> (await calls()).filter(call=>call.method!=='GET');
  const setControl=(key,value)=>page.evaluate(([key,value])=>window.__control.set(key,value),[key,value]);
  const settle=async()=>{await page.waitForFunction(()=>!document.querySelector('[data-placard-view] > [role="status"]'));await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));};
  const layout=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  async function shot(name){await settle();await page.$eval(section,node=>node.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:resolve(output,name+'.png'),fullPage:false});}
  async function load(scenario='single',width=390){unexpectedRequests.push(...await page.evaluate(()=>window.__unexpected??[]).catch(()=>[]));await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();}).catch(()=>{});await page.setViewport({width,height:width===320?720:width===390?844:1000});await page.goto(origin+'/?scenario='+scenario,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);}
  const deck=()=>page.$eval('[data-preparation-deck]',node=>node.dataset.preparationDeck.split(',').filter(Boolean));
  const heritageChoice=()=>page.$eval('[data-preparation-heritage]',node=>node.dataset.preparationHeritage);
  async function openChoice(selector){if(!await page.$eval(selector,node=>node.open))await keyClick(selector+' > summary');}
  async function customPreparation(){
    await page.waitForSelector('[data-culture-preparation]');await openChoice(cards);await button('Retirer les cartes',cards);
    for(const code of ['BOTTE-005','BOTTE-005','BOTTE-024','BOTTE-003'])await keyClick(`${cards} [data-card-code="${code}"] button[aria-label^="Ajouter"]`);
    const selected=await deck();await keyClick(`${cards} [data-culture-keep-choice]`);await openChoice(heritage);
    await keyClick(`${heritage} button[aria-label^="Équiper"]:not([disabled])`);await keyClick(`${heritage} [data-culture-keep-choice]`);
    return{deck:selected,heritage:await heritageChoice()};
  }
  async function openPicker(zone='culture-1'){await keyClick(`[data-culture-buddie-change="${zone}"]`);await page.waitForSelector(`[data-culture-buddie-picker="${zone}"]`,{visible:true});}
  function withoutAssignments(state){return {...state,zones:state.zones.map(({buddieCode,...zone})=>{void buddieCode;return zone;})};}
  async function assertAssignmentOnly(before,expectedPatches=1){
    const after=(await fixture()).production,patches=(await mutations()).filter(call=>call.method==='PATCH');
    assert.equal(patches.length,expectedPatches);const patch=patches.at(-1).body;
    assert.equal(patch.expectedCostCents,0);assert.equal(patch.expectedRevision,before.revision);assert.match(patch.requestKey,/^[0-9a-f-]{36}$/i);
    assert.deepEqual(withoutAssignments(patch.state),withoutAssignments(before.warehouse),'Assignment never edits area, equipment, zone activity or names');
    assert.equal(after.cashCents,before.cashCents);assert.deepEqual(after.supportInventory,before.supportInventory);assert.deepEqual(after.ownedBuddies,before.ownedBuddies);
    assert.deepEqual(after.recentBuddieCodes,before.recentBuddieCodes,'Rotation changes only after starting a culture');assert.equal(after.game,null);
    assert.equal(after.ledger.slice(before.ledger.length).reduce((sum,row)=>sum+row.amountCents,0),0);
  }
  async function choose(code,zone='culture-1'){
    const count=await page.evaluate(()=>window.__appliedPatches);await keyClick(`[data-culture-buddie-picker="${zone}"] [data-buddie-select="${code}"]`);
    await page.waitForFunction(n=>window.__appliedPatches===n+1,{},count);await page.waitForFunction(()=>![...document.querySelectorAll('[data-culture-buddie-change]')].some(node=>node.disabled));await settle();
    const focused=await page.evaluate(()=>({zone:document.activeElement?.getAttribute('data-culture-buddie-change'),tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label'),html:document.activeElement?.outerHTML.slice(0,240)}));
    assert.equal(focused.zone,zone,`Saving restores keyboard focus to the edited zone: ${JSON.stringify(focused)}`);
  }
  async function startDialog(){await keyClick('[data-culture-preparation] > button');await page.waitForSelector('[data-culture-confirm-start]');}
  if (zonesOnly) {
    for (const width of [1440,320]) {
      await load('multi',width);await page.waitForSelector(section);await settle();
      const initialState=(await fixture()).production;
      const identities=await page.$$eval('[data-culture-buddie-zone]',nodes=>nodes.map(node=>{
        const badge=node.querySelector('[data-zone-number]');
        return{id:node.dataset.cultureBuddieZone,number:badge?.textContent.trim(),color:badge&&getComputedStyle(badge).backgroundColor,label:badge?.getAttribute('aria-label'),text:node.textContent};
      }));
      assert.deepEqual(identities.map(item=>item.number),['01','02']);
      assert.equal(new Set(identities.map(item=>item.color)).size,2,'Each culture has its own colour');
      for(const item of identities){assert.equal(item.label,'Zone '+item.number);assert(item.text.includes('1 m²'));}
      assert(!await page.$eval(section,node=>/La première zone|La seconde zone/.test(node.textContent)),'Free names are not displayed in preparation');
      await layout();await shot('zones-preparation-'+width);
      await openPicker('culture-2');
      assert(await page.$eval('[data-culture-buddie-picker]',node=>node.textContent.includes('Un Buddie pour la zone 02')));
      await keyClick('[data-culture-buddie-picker] button[aria-label="Fermer le choix du Buddie"]');
      await keyClick('[data-preparation-edit-plan]');await page.waitForSelector('[data-warehouse-zone-chip="culture-1"]');await settle();
      const chipData=()=>page.$$eval('[data-warehouse-zone-chip]',nodes=>nodes.map(node=>({
        id:node.dataset.warehouseZoneChip,number:node.querySelector('span')?.textContent.trim(),color:getComputedStyle(node.querySelector('span')).backgroundColor,
        label:node.getAttribute('aria-label'),kind:node.dataset.zoneKind,icon:node.querySelector('svg')?.getAttribute('class'),selected:node.getAttribute('aria-pressed'),
      })));
      const chips=await chipData();assert.deepEqual(chips.map(item=>item.number),['01','02','03','04']);
      assert.deepEqual(chips.map(item=>item.kind),['culture','culture','drying','storage']);
      assert.equal(new Set(chips.map(item=>item.color)).size,4,'Culture and service zones have distinct identifying colours');
      assert.equal(new Set(chips.map(item=>item.icon)).size,3,'Culture, drying and storage remain distinguishable by their icon');
      const kinds={culture:'Culture',drying:'Séchage',storage:'Stockage'};
      for(const chip of chips){assert.equal(chip.label,`Zone ${chip.number} · ${kinds[chip.kind]} · 1 m²`);}
      for(const item of identities){const chip=chips.find(chip=>chip.id===item.id);assert.equal(chip.number,item.number);assert.equal(chip.color,item.color,'Preparation and plan reuse the same colour');}
      const mapData=()=>page.$$eval('[data-warehouse-plan] g[data-zone-id]',nodes=>nodes.map(node=>{
        const marker=node.querySelector('[data-zone-badge-background]');
        return{id:node.dataset.zoneId,number:node.querySelector('[data-zone-number]')?.getAttribute('data-zone-number'),color:marker&&getComputedStyle(marker).fill,title:node.querySelector('title')?.textContent,selected:node.dataset.selected};
      }));
      const initialMap=await mapData();assert.equal(initialMap.length,4);
      for(const chip of chips){const map=initialMap.find(item=>item.id===chip.id);assert.equal(map.number,chip.number);assert.equal(map.color,chip.color);assert(map.title.includes(chip.label));}
      for(const chip of chips){
        await keyClick(`[data-warehouse-zone-chip="${chip.id}"]`);await settle();
        const selected=(await chipData()).find(item=>item.id===chip.id),map=(await mapData()).find(item=>item.id===chip.id);
        assert.equal(selected.selected,'true');assert.equal(map.selected,'true');assert.equal(selected.color,chip.color);assert.equal(map.color,chip.color,'Selected zones keep their identifying colour');
      }
      await keyClick('[data-warehouse-zone-chip="culture-2"]');await keyClick('[data-warehouse-action="configure"]');
      await page.waitForSelector('[data-warehouse-zone-dialog][open]');
      assert(!await page.$eval('[data-warehouse-zone-dialog]',node=>node.textContent.includes('Nom de la zone')),'The naming field has been removed');
      assert.equal(await page.$$eval('[data-warehouse-zone-dialog] input',nodes=>nodes.filter(node=>['La première zone','La seconde zone'].includes(node.value)).length),0);
      await layout();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-warehouse-zone-dialog][open]'));await settle();
      await layout();await page.$eval('[data-warehouse-zone-chip]',node=>node.scrollIntoView({block:'start',behavior:'instant'}));
      await page.screenshot({path:resolve(output,'zones-plan-'+width+'.png'),fullPage:true});
      await keyClick('[data-warehouse-campaign-action="start"]');await page.waitForSelector(section);await settle();
      assert.deepEqual((await fixture()).production,initialState,'Reading zone labels and changing selection never modifies the plan or account');
      assert.equal((await mutations()).length,0);await layout();
      results.push({scenario:'number, area, colour and accessible type remain consistent across preparation, plan, selection and inspector',width});
    }
  }
  if (!zonesOnly) {
  for(const width of [1440,390,320]){
    await load('single',width);await page.waitForSelector(section);const before=(await fixture()).production;const prepared=await customPreparation();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await settle();await page.screenshot({path:resolve(output,'first-fold-'+width+'.png'),fullPage:false});
    assert.equal((await mutations()).length,0,'Reading and preparing cards never changes account state');await openPicker();
    assert.equal((await mutations()).length,0,'Opening the chooser does not assign, buy or launch');
    await layout();
    if(width<700){await page.focus('[data-culture-buddie-picker] [role="list"]');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('[data-culture-buddie-picker] [role="list"]').scrollLeft>0);assert.equal((await mutations()).length,0);}
    await page.$eval('[data-culture-buddie-picker]',node=>node.scrollIntoView({block:'start',behavior:'instant'}));await settle();await page.screenshot({path:resolve(output,'picker-'+width+'.png'),fullPage:false});
    const target=before.ownedBuddies[1];await keyClick(`[data-buddie-variety-card="${target}"]`);await page.waitForSelector('[data-buddie-variety-popover]');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-buddie-variety-popover]'));
    assert.equal((await mutations()).length,0,'Reading a variety sheet is passive');await choose(target);
    await assertAssignmentOnly(before);assert.equal((await fixture()).production.warehouse.zones[0].buddieCode,target);
    assert.deepEqual(await deck(),prepared.deck);assert.equal(await heritageChoice(),prepared.heritage);
    await layout();await shot('chosen-'+width);
    // The plan is an optional detour; the header return retains the preparation.
    await keyClick('[data-preparation-edit-plan]');await page.waitForSelector('[data-placard-view="workshop"]');await settle();
    await keyClick('[data-warehouse-campaign-action="start"]');await page.waitForSelector(section);await settle();
    assert.deepEqual(await deck(),prepared.deck);assert.equal(await heritageChoice(),prepared.heritage);assert.equal((await mutations()).length,1);
    assert.equal((await fixture()).production.warehouse.zones[0].buddieCode,target);await layout();
    results.push({scenario:'direct choice and warehouse return preserve preparation',width});
  }
  await load('multi');await page.waitForSelector(section);let before=(await fixture()).production;await openPicker();
  assert.equal(await page.$eval(`[data-buddie-select="${before.ownedBuddies[1]}"]`,node=>node.disabled),true,'Another zone already owns this variety');
  await choose(before.ownedBuddies[2]);await assertAssignmentOnly(before);
  before=(await fixture()).production;await keyClick('[data-culture-buddie-remove="culture-2"]');
  await page.waitForFunction(()=>!window.__fixture().production.warehouse.zones[1].buddieCode);await assertAssignmentOnly(before,2);
  assert.equal((await fixture()).production.warehouse.zones[1].active,true,'Removing a Buddie does not deactivate or resize the zone');
  await keyClick('[data-culture-buddie-remove="culture-1"]');await page.waitForFunction(()=>window.__fixture().production.warehouse.zones.every(zone=>!zone.buddieCode));
  assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true,'An entirely empty assignment cannot start');
  assert.equal((await mutations()).filter(call=>call.method==='POST').length,0);await layout();await shot('two-zones-unassigned-390');
  results.push({scenario:'two zones reject duplicate varieties and remove assignments without altering the floor plan'});

  await load('paused');await page.waitForSelector(section);
  assert(await page.$eval('[data-culture-buddie-zone="culture-2"]',node=>node.textContent.includes('Zone en pause')));
  for(const selector of ['[data-culture-buddie-change="culture-2"]','[data-culture-buddie-remove="culture-2"]'])assert.equal(await page.$eval(selector,node=>node.disabled),true);
  assert.equal((await mutations()).length,0);results.push({scenario:'paused zones remain visible and cannot be edited from preparation'});

  await load('rotation');await page.waitForSelector(section);before=(await fixture()).production;await openPicker();
  for(const code of before.recentBuddieCodes)assert.equal(await page.$eval(`[data-buddie-select="${code}"]`,node=>node.disabled),true);
  assert.equal((await mutations()).length,0);assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true);
  await layout();await shot('rotation-390');results.push({scenario:'rotation cannot be bypassed and blocks an unavailable participant'});

  for(const mode of ['503','lost']){
    await load();await page.waitForSelector(section);before=(await fixture()).production;await setControl('patchMode',mode);await openPicker();
    await keyClick(`[data-buddie-select="${before.ownedBuddies[1]}"]`);await page.waitForSelector('[data-culture-buddie-retry]');
    assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true,'An uncertain assignment blocks culture launch');
    await keyClick('[data-culture-buddie-retry]');await page.waitForFunction(()=>!document.querySelector('[data-culture-buddie-retry]'));await settle();
    const patches=(await mutations()).filter(call=>call.method==='PATCH');assert.equal(patches.length,2);assert.deepEqual(patches[1].body,patches[0].body,'Retry keeps the same idempotency key and payload');
    assert.equal(await page.evaluate(()=>window.__appliedPatches),1);assert.equal((await fixture()).production.cashCents,before.cashCents);
    assert.equal((await fixture()).production.warehouse.zones[0].buddieCode,before.ownedBuddies[1]);results.push({scenario:'assignment retry '+mode+' preserves the exact request'});
  }
  await load();await page.waitForSelector(section);before=(await fixture()).production;await setControl('patchMode','lost');await openPicker();
  await keyClick(`[data-buddie-select="${before.ownedBuddies[1]}"]`);await page.waitForSelector('[data-culture-buddie-retry]');
  await page.evaluate(()=>window.__control.externalAssignment());await keyClick('[data-culture-buddie-retry]');await page.waitForSelector('[data-culture-buddie-refresh]');
  const changedPatches=(await mutations()).filter(call=>call.method==='PATCH');assert.equal(changedPatches.length,2);assert.deepEqual(changedPatches[1].body,changedPatches[0].body);
  assert.equal(await page.evaluate(()=>window.__appliedPatches),1);assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true);
  await keyClick('[data-culture-buddie-refresh]');await page.waitForFunction(()=>!document.querySelector('[data-culture-buddie-refresh]'));await settle();
  assert.equal((await mutations()).length,2,'An old receipt with a newer plan never reapplies its old assignment');
  assert.equal((await fixture()).production.warehouse.zones[0].buddieCode,before.ownedBuddies[2]);
  assert(await page.$eval('[data-culture-buddie-zone="culture-1"]',node=>node.textContent.includes('Strawberry CBD')),'The refreshed zone shows the actual newer assignment');
  results.push({scenario:'lost response then concurrent plan change requires a read instead of reapplying the old assignment'});
  await load();await page.waitForSelector(section);before=(await fixture()).production;await setControl('patchMode','409');await openPicker();
  await keyClick(`[data-buddie-select="${before.ownedBuddies[1]}"]`);await page.waitForSelector('[data-culture-buddie-refresh]');
  assert.equal((await mutations()).length,1);assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true);
  await keyClick('[data-culture-buddie-refresh]');await page.waitForFunction(()=>!document.querySelector('[data-culture-buddie-refresh]'));await settle();
  assert.equal((await fixture()).production.warehouse.zones[0].name,'Zone renommée ailleurs','The original stored name remains intact even when the UI uses numbered zones');
  assert.equal((await mutations()).length,1,'Refreshing a conflict never reapplies the rejected change');
  assert.equal((await fixture()).production.warehouse.zones[0].buddieCode,before.ownedBuddies[0]);results.push({scenario:'409 refresh keeps external plan edits and never resubmits automatically'});

  await load('rotation-unknown');await page.waitForSelector(section);assert.equal((await mutations()).length,0);
  assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true);
  results.push({scenario:'unknown rotation is never treated as fully available'});
  await load('collection-pending');await page.waitForSelector('[data-culture-selection]');assert.equal((await mutations()).length,0);
  await page.evaluate(()=>window.__control.resolve());await page.waitForSelector(section);assert.equal((await mutations()).length,0);
  results.push({scenario:'pending collection waits for confirmed ownership'});
  for(const scenario of ['warehouse-error','warehouse-malformed','collection-error']){
    await load(scenario);await page.waitForSelector('[data-culture-selection] [role="alert"]');assert.equal((await mutations()).length,0);
    await setControl(scenario==='collection-error'?'collectionMode':'warehouseMode','known');await keyClick('[data-culture-selection] button');await page.waitForSelector(section);
    assert.equal((await mutations()).length,0);results.push({scenario:scenario+' stays unknown until a successful explicit read'});
  }
  await load('no-zones');await page.waitForSelector(section);assert(await page.$eval(section,node=>node.textContent.includes('Ajoute une zone')));
  assert.equal((await mutations()).length,0);assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true);
  results.push({scenario:'no physical zone offers planning without inventing a culture'});

  await load();await page.waitForSelector(section);before=(await fixture()).production;await setControl('patchMode','pending');await openPicker();
  await keyClick(`[data-buddie-select="${before.ownedBuddies[1]}"]`);await page.waitForFunction(()=>document.querySelector('[data-culture-buddies]').getAttribute('aria-busy')==='true');
  assert.equal(await page.$eval('[data-culture-preparation] > button',node=>node.disabled),true);
  assert.equal(await page.$eval('[data-preparation-edit-plan]',node=>node.disabled),true);
  await page.keyboard.press('Enter');assert.equal((await mutations()).length,1,'Repeated activation cannot send a parallel assignment');
  await page.evaluate(()=>window.__control.resolve());await page.waitForFunction(()=>window.__appliedPatches===1);await settle();await assertAssignmentOnly(before);
  results.push({scenario:'pending save blocks duplicate activation, navigation and launch'});

  await load();await page.waitForSelector(section);before=(await fixture()).production;await startDialog();
  await page.waitForFunction(()=>!document.querySelector('[data-culture-confirm-start]').disabled);
  const firstQuotes=(await calls()).filter(call=>call.path.endsWith('/energy')).length;await button('Annuler','dialog');
  await openPicker();await choose(before.ownedBuddies[1]);await setControl('energyPending',true);await startDialog();
  assert.equal(await page.$eval('[data-culture-confirm-start]',node=>node.disabled),true,'The old energy quote cannot start a changed preparation');
  assert.equal((await mutations()).filter(call=>call.method==='POST').length,0,'Opening a confirmation never starts a culture');
  await page.evaluate(()=>window.__control.resolve());await page.waitForFunction(()=>!document.querySelector('[data-culture-confirm-start]').disabled);
  assert((await calls()).filter(call=>call.path.endsWith('/energy')).length>firstQuotes,'A fresh energy quote is read');
  await keyClick('[data-culture-confirm-start]');await page.waitForSelector('[data-culture-play]');
  const launched=(await fixture()).production;assert.equal(launched.game.campaign.members[0].buddieCode,before.ownedBuddies[1]);
  assert.equal((await mutations()).filter(call=>call.method==='POST'&&call.path.endsWith('/runs')).length,1);
  assert.deepEqual(launched.supportInventory,before.supportInventory,'Launching does not consume support cards');
  results.push({scenario:'assignment invalidates energy and culture starts only after explicit confirmation'});
  }

  unexpectedRequests.push(...await page.evaluate(()=>window.__unexpected));assert.deepEqual(unexpectedRequests,[]);
  assert.deepEqual(errors, []); assert.deepEqual(forbiddenRequests, []);
  await writeFile(resolve(output, reportFile), JSON.stringify({ ok: true, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ok:true,groups:results.length,results,output}));
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, reportFile), JSON.stringify({ ok: false, error: error.message, stack: error.stack, results, errors, forbiddenRequests, body: page ? await page.evaluate(() => document.body.innerText).catch(() => null) : null }, null, 2));
  throw error;
} finally { if (!preview) { await browser?.close(); await server.close(); } }
