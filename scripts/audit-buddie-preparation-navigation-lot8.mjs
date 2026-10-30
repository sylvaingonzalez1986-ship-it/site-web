/** Real Shell and KqCultureBuddies. Destination stubs isolate navigation from purchases and assignments. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/clarity-lot8/buddie-navigation');
const port = 3580, origin = `http://127.0.0.1:${port}`;
const destinations = {
  './KanabQuestDicePrototype': `import React from 'react';
    import {KqCultureBuddies} from '/src/components/placard/KqCultureBuddies';
    import {createKqWarehouseStarter} from '/src/lib/kanab-quest-warehouse';
    const snapshot={state:createKqWarehouseStarter(),revision:1,activeRuns:[],activeRun:false};
    export function KanabQuestDicePrototype(props){const params=new URLSearchParams(location.search),state=params.get('fixture');
      const owned=state==='unknown'?null:state==='owned'?['HH2026-001']:[];
      return <section data-culture-fixture className="fixture"><KqCultureBuddies snapshot={snapshot} ownedCodes={owned} artwork={{}} rotation={{requiredDistinctBuddies:2,recentBuddieCodes:[]}}
        onSaved={()=>{throw Error('Assignment not authorized in navigation fixture');}} onBlockedChange={()=>{}}
        onOpenWarehouse={()=>props.onOpenWarehouse('starter')} onOpenBuddiePacks={state==='fallback'?undefined:props.onOpenBuddiePacks} onRefresh={()=>{window.__refreshes++;}}/>
        <div className="fixture-controls"><button data-choose-cards onClick={()=>props.onPreparationChange?.({deckCodes:['BOTTE-006'],heritageCode:'HH2026-002'})}>Préparer des cartes dans la fixture</button>
        <output data-prepared>{JSON.stringify(props.initialPreparation??null)}</output></div></section>;}`,
  './KqSupportBoosterShop': `import React from 'react';export function KqSupportBoosterShop(props){return <section data-packs-fixture className="fixture">
    <p>Destination simulée : aucun pack acheté ou ouvert.</p><p data-packs-section>{props.initialSection}</p>
    <button data-packs-botte onClick={()=>props.onSectionChange('botte')}>Packs La Botte</button>
    <button data-packs-buddies onClick={()=>props.onSectionChange('buddies')}>Packs Buddies</button>
    <button data-packs-exit onClick={props.onExit}>Quitter les packs</button></section>;}`,
  './KqMissionCenter': `import React from 'react';export function KqMissionCenter(){return <section data-missions-fixture>Retour aux missions vérifié.</section>;}`,
  './KqMarketDesk': `import React from 'react';export function KqMarketDesk(props){return <section data-market-fixture><output>{JSON.stringify(props)}</output></section>;}`,
  './KqHarvests': `import React from 'react';export function KqHarvests(props){return <section data-harvests-fixture><output>{JSON.stringify(props)}</output></section>;}`,
};
const modules = {
  entry: `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';
    window.__refreshes=0;window.__writes=[];const native=fetch;
    window.fetch=async(input,init={})=>{const url=new URL(String(input),location.href);if(!url.pathname.startsWith('/api/'))return native(input,init);
      if(init.method&&init.method!=='GET'){window.__writes.push(url.pathname);return Response.json({error:'Read-only fixture'},{status:405});}
      if(url.pathname==='/api/account/missions')return Response.json({missions:[],pendingRewards:[]});return Response.json({error:'Unexpected fixture API'},{status:404});};
    createRoot(document.getElementById('root')).render(<PlacardPlayerShell draftOwnerId="buddie-navigation-lot8"/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
  ...Object.fromEntries(Object.entries(destinations).map(([key,value])=>['destination:'+key,value])),
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'buddie-preparation-navigation',enforce:'pre',resolveId(id,importer){if(importer?.replaceAll('\\','/').endsWith('/PlacardPlayerShell.tsx')&&id in destinations)return '\0destination:'+id;if(id in modules)return '\0'+id;},
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/','/arene/placard'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buddies et préparation</title><style>@font-face{font-family:Display;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:Body;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}.fixture{padding:16px;max-width:1000px;margin:auto}.fixture-controls{margin-top:40px;padding-top:16px;border-top:1px solid #172923}.fixture-controls output{display:block;overflow-wrap:anywhere}[data-packs-fixture] button,.fixture-controls button{display:block;margin:12px 0;min-height:44px}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>');});}}],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});

let browser,page;const results=[],errors=[],external=[],writes=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',r=>{const url=new URL(r.url());if(r.method()!=='GET')writes.push({method:r.method(),url:r.url()});if(url.protocol==='data:'||url.origin===origin)void r.continue();else{external.push(r.url());void r.abort();}});
  const params=()=>new URL(page.url()).searchParams;
  const visit=async query=>{await page.goto(origin+'/arene/placard?'+query,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
  const enter=async selector=>{const node=await page.waitForSelector(selector,{visible:true});await node.focus();await page.keyboard.press('Enter');};
  const waitView=async view=>page.waitForFunction(v=>new URLSearchParams(location.search).get('view')===v,{},view);
  const assertParams=expected=>{for(const [key,value]of Object.entries(expected))assert.equal(params().get(key),value,`${key} in ${page.url()}`);};
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const cta='[data-empty-buddie-collection] button';
  for(const width of [320,390,1440]) {
    await page.setViewport({width,height:900});
    await visit('view=game&zone=starter&campaign=1&from=missions');await page.waitForSelector(cta);
    assert.equal(await page.$('[data-culture-buddie-change]'),null);assert.equal(await page.$('[data-culture-buddie-picker]'),null);
    await page.focus(cta);await noOverflow();await page.screenshot({path:resolve(output,`empty-${width}.png`),fullPage:true});
    await enter('[data-choose-cards]');await page.waitForFunction(()=>document.querySelector('[data-prepared]').textContent.includes('BOTTE-006'));
    await enter(cta);await waitView('shop');assertParams({section:'buddies',from:'game',zone:'starter',campaign:'1',fromGame:'missions'});
    await enter('[data-packs-botte]');assertParams({section:null,fromGame:'missions',zone:'starter',campaign:'1'});
    await enter('[data-packs-buddies]');await page.reload({waitUntil:'networkidle0'});assertParams({section:'buddies',fromGame:'missions',zone:'starter',campaign:'1'});
    await page.goBack();await page.waitForFunction(()=>!new URLSearchParams(location.search).has('section'));
    await page.goForward();await page.waitForFunction(()=>new URLSearchParams(location.search).get('section')==='buddies');
    await page.waitForSelector('[data-placard-back="game"][aria-label="Revenir à ma préparation"]');
    await enter('[data-packs-exit]');await waitView('game');assertParams({zone:'starter',campaign:'1',from:'missions',fromGame:null});
    await page.waitForFunction(()=>document.querySelector('[data-prepared]')?.textContent.includes('HH2026-002'));
    await noOverflow();await page.screenshot({path:resolve(output,`return-${width}.png`),fullPage:true});
    await enter('[data-placard-back="missions"]');await waitView('missions');await page.waitForSelector('[data-missions-fixture]');
    assert.deepEqual(await page.evaluate(()=>window.__writes),[]);
    results.push({width,scenario:'empty-collection-missions-draft',keyboard:true,emptyPickerAbsent:true,sectionSwitch:true,reload:true,history:true,exactReturn:true,noOverflow:true});

    await page.evaluate(()=>sessionStorage.clear());await visit('view=game&zone=starter&campaign=1&from=missions');await enter(cta);await waitView('shop');
    await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-placard-back="game"][aria-label="Retour à la culture"]');
    await enter('[data-placard-back="game"]');await waitView('game');assertParams({zone:'starter',campaign:'1',from:'missions'});
    await page.waitForSelector('[data-prepared]');assert.equal(await page.$eval('[data-prepared]',el=>el.textContent),'null');results.push({width,scenario:'no-draft',exactReturn:true,noInventedDraft:true});

    await visit('view=game&zone=starter&run=run-fixture');await enter(cta);await waitView('shop');assertParams({zone:'starter',run:'run-fixture',fromGame:null});
    await enter('[data-placard-back="game"]');await waitView('game');assertParams({zone:'starter',run:'run-fixture',from:null});results.push({width,scenario:'direct-running-culture',exactReturn:true});

    await visit('view=game&fixture=unknown');await page.waitForSelector('[data-culture-buddie-change]:disabled');assert.equal(await page.$('[data-empty-buddie-collection]'),null);
    await page.evaluate(()=>{const refresh=[...document.querySelectorAll('[data-culture-fixture] button')].find(el=>el.textContent==='Actualiser');refresh.focus();});
    await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__refreshes),1);await noOverflow();
    await page.screenshot({path:resolve(output,`unknown-${width}.png`),fullPage:true});results.push({width,scenario:'unknown-collection',noAcquisitionAdvice:true,refresh:true});

    await visit('view=game&fixture=owned');await page.waitForSelector('[data-culture-buddie-change]:not(:disabled)');assert.equal(await page.$('[data-empty-buddie-collection]'),null);
    await enter('[data-culture-buddie-change]');await page.waitForSelector('[data-culture-buddie-picker]');await noOverflow();assert.deepEqual(await page.evaluate(()=>window.__writes),[]);
    results.push({width,scenario:'owned-collection',existingPicker:true,noWrites:true});
  }
  await visit('view=game&fixture=fallback');const fallback=await page.waitForSelector('[data-empty-buddie-collection] a');
  assert.equal(await fallback.evaluate(el=>el.getAttribute('href')),'/arene/placard?view=shop&section=buddies&from=game');await enter('[data-empty-buddie-collection] a');await waitView('shop');
  await page.waitForSelector('[data-packs-fixture]');assertParams({section:'buddies',from:'game'});results.push({scenario:'standalone-local-link',correctDestination:true});

  for(const scenario of [
    {query:'view=shop&section=buddies&from=market&fromSection=management&fromBusiness=merch&fromFlower=flower-a&fromLot=stock-a&fromListing=listing-a',expected:{view:'market',section:'management',business:'merch',flower:'flower-a',lot:'stock-a',listing:'listing-a'},selector:'[data-market-fixture]'},
    {query:'view=shop&section=buddies&from=harvests&fromSection=storage&fromFlower=flower-b',expected:{view:'harvests',section:'storage',flower:'flower-b'},selector:'[data-harvests-fixture]'},
  ]) {
    await visit(scenario.query);await enter('[data-packs-botte]');await enter('[data-packs-buddies]');await page.reload({waitUntil:'networkidle0'});await enter('[data-packs-exit]');
    await page.waitForSelector(scenario.selector);assertParams(scenario.expected);results.push({scenario:'existing-'+scenario.expected.view+'-provenance',exactReturn:true});
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({scope:'Real Shell + KqCultureBuddies; Packs, Culture host, Missions, Commerce and Harvests are read-only routing stubs.',results,errors,external,writes},null,2));
  console.log(`${results.length} Buddie navigation checks passed: 320/390/1440, keyboard, empty/unknown/owned, preparation, history, reload, existing provenance; no writes.`);
} catch(error) {await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally {const timeout=setTimeout(()=>{browser?.process()?.kill();server.httpServer?.closeAllConnections();},5000);try{await browser?.close();server.httpServer?.closeAllConnections();await server.close();}finally{clearTimeout(timeout);}}
