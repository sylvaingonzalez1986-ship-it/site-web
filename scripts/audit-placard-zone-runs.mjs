// Real React game and domain engine. API fixtures stay entirely in this browser.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-zone-runs');
const port = Number(process.env.KQ_ZONE_RUN_AUDIT_PORT ?? 3272), origin = `http://127.0.0.1:${port}`;
const modules = {
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);`,
  'zone-runs-entry': `
    import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
    import {startKqGame,resolveKqStage,advanceKqStage,KQ_BUDDIES} from '/src/lib/kanab-quest-game';
    import {createKqWarehouseStarter,getKqWarehouseQuote,getKqWarehouseRunSnapshot} from '/src/lib/kanab-quest-warehouse';
    import {quoteKqWarehouseEnergy} from '/src/lib/kanab-quest-warehouse-run';
    const initial=createKqWarehouseStarter();
    const layout=getKqWarehouseQuote({...initial,zones:['a','b','c'].map((id,i)=>({...initial.zones[0],id,name:['La grande chambre','La relève','La petite chambre'][i],x:10+i*3,y:10,width:i===2?2:1,height:1,buddieCode:'HH2026-00'+(i+1)}))}).nextState;
    const make=(zoneId,id,seed)=>{const zone=layout.zones.find(zone=>zone.id===zoneId);return {runId:id,zoneId,buddieCode:zone.buddieCode,startedAt:'2026-10-13T12:00:00Z',updatedAt:'2026-10-13T12:00:00Z',burnReceipts:[],state:startKqGame(seed,{varietyCode:zone.buddieCode,deckCodes:[],warehouse:getKqWarehouseRunSnapshot(layout,1,zoneId),startedAt:'2026-10-13T12:00:00Z'})};};
    const a=make('a','11111111-1111-4111-8111-111111111111',51);a.state={...a.state,phase:'rolled',dice:[6,6,6]};
    const b=make('b','22222222-2222-4222-8222-222222222222',52);b.state=advanceKqStage(resolveKqStage({...b.state,phase:'rolled',dice:[6,6,6]}));
    const done=make('c','33333333-3333-4333-8333-333333333333',53);
    for(let i=0;i<6;i++)done.state=advanceKqStage(resolveKqStage({...done.state,phase:'rolled',dice:[6,6,6]}));
    window.__fixture=JSON.parse(sessionStorage.getItem('zone-audit-state')??'null')??{runs:[a,b,done],receipts:{},starts:[],created:0};
    window.__ids={a:a.runId,b:b.runId,done:done.runId};window.__requests=[];window.__holdAction=false;window.__loseStart=false;
    const persist=()=>sessionStorage.setItem('zone-audit-state',JSON.stringify(window.__fixture));
    const active=()=>window.__fixture.runs.filter(run=>run.state.phase!=='complete');
    const session=()=>({activeRun:active()[0]??null,activeRuns:active(),flowers:[],battles:[],progress:null,buddieRotation:{requiredDistinctBuddies:2,recentBuddieCodes:[]}});
    const original=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const href=String(input);if(!href.startsWith('/api/'))return original(input,init);
      const url=new URL(href,location.origin),method=init.method??'GET';window.__requests.push({path:url.pathname,query:url.search,method});
      if(url.pathname.endsWith('/bootstrap'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory:{'BOTTE-003':3,'BOTTE-017':1},availableInventory:{'BOTTE-003':0,'BOTTE-017':1},cultureTokenBalance:0},ownedBuddieCodes:KQ_BUDDIES.slice(0,4).map(b=>b.code),ownedBuddies:[],heritage:{cards:[]},playerSession:session(),buddieRotation:session().buddieRotation});
      if(url.pathname.endsWith('/session'))return Response.json(session());
      if(url.pathname.endsWith('/rankings'))return Response.json({entries:[]});
      if(url.pathname.endsWith('/me'))return Response.json({progress:null});
      if(url.pathname.endsWith('/warehouse'))return Response.json({state:layout,revision:1,cashCents:1500000});
      if(url.pathname.endsWith('/care'))return Response.json({cashCents:1500000,basicCarePriceCents:200,inventory:[],catalog:[]});
      if(url.pathname.endsWith('/flowers'))return Response.json({flowers:[]});
      if(url.pathname.endsWith('/battles'))return Response.json({battles:[]});
      if(url.pathname.endsWith('/energy')){
        const run=window.__fixture.runs.find(run=>run.runId===url.searchParams.get('runId'));
        const warehouse=run?.state.warehouse??getKqWarehouseRunSnapshot(layout,1,url.searchParams.get('zoneId')??'a');
        const quote=quoteKqWarehouseEnergy(warehouse);
        return Response.json({warehouse,quotes:{eco:quote,balanced:quote,intensive:quote},cashCents:1500000,outstandingCents:0,invoiceCount:0,invoices:[],supplierInvoice:null,supplierInvoices:run?[{runId:run.runId,totalCents:warehouse.consumablesCostCents,remainingCents:warehouse.consumablesCostCents,dueAt:'2026-10-18T12:00:00Z'}]:[]});
      }
      if(url.pathname.endsWith('/runs')&&method==='GET'){
        const runId=url.searchParams.get('runId'),zoneId=url.searchParams.get('zoneId');
        const selected=runId?window.__fixture.runs.find(run=>run.runId===runId&&(!zoneId||run.zoneId===zoneId)):zoneId?active().find(run=>run.zoneId===zoneId):active()[0];
        return Response.json({activeRun:selected??null,activeRuns:active()});
      }
      if(url.pathname.endsWith('/runs')&&method==='POST'){
        const body=JSON.parse(init.body);window.__fixture.starts.push(body);
        if(window.__fixture.receipts[body.requestKey]){persist();return Response.json(window.__fixture.receipts[body.requestKey]);}
        if(active().some(run=>run.zoneId===body.zoneId))return Response.json({error:'Zone déjà occupée.'},{status:409});
        const run=make(body.zoneId,'44444444-4444-4444-8444-444444444444',54);window.__fixture.runs.push(run);window.__fixture.created++;
        const receipt={runId:run.runId,state:run.state,burnReceipt:null,freeSubstrate:true,cultureTokenBalance:0,buddieRotation:session().buddieRotation};
        window.__fixture.receipts[body.requestKey]=receipt;persist();
        if(window.__loseStart){window.__loseStart=false;throw new TypeError('Réponse perdue après validation. Réessaie.');}
        return Response.json(receipt);
      }
      if(url.pathname.endsWith('/actions')){
        const run=window.__fixture.runs.find(run=>url.pathname.includes(run.runId));
        if(window.__holdAction)await new Promise(resolve=>window.__releaseAction=resolve);
        const body=JSON.parse(init.body);run.state=body.action==='resolve'?resolveKqStage(run.state):advanceKqStage(run.state);persist();
        return Response.json({state:run.state,persistedFlower:null});
      }
      throw new Error('Unexpected fixture request '+method+' '+href);
    };
    localStorage.setItem('kq-dice-direct-result','1');
    function Fixture(){const [selection,setSelection]=React.useState(()=>({zoneId:new URLSearchParams(location.search).get('zone')??undefined,runId:new URLSearchParams(location.search).get('run')??undefined}));
      window.__select=next=>{const params=new URLSearchParams();if(next.zoneId)params.set('zone',next.zoneId);if(next.runId)params.set('run',next.runId);history.replaceState(null,'','/?'+params);setSelection(next);};
      return <KanabQuestDicePrototype apiScope="player" showAdminOperations={false} viewMode="game" initialZoneId={selection.zoneId} initialRunId={selection.runId} onOpenRun={window.__select} onOpenWarehouse={zoneId=>{window.__backZone=zoneId??null;}}/>;}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','lucide-react','next/dynamic']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'zone-runs-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#f1edda}</style><div id="root"></div><script type="module" src="/@id/__x00__zone-runs-entry"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const checks=[],errors=[],blockedRequests=[];let browser,page;
const report={passed:false,checks,errors,blockedRequests,backend:'Browser-local fixtures only; no external API.'};
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||url.protocol==='data:')void request.continue();else{blockedRequests.push(request.url());void request.abort();}});
  const click=async(selector)=>{await page.$eval(selector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.click(selector);};
  const clickText=async(text)=>{const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),text);assert.ok(handle.asElement(),text);await handle.asElement().evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await handle.asElement().click();};
  const waitRun=async(id)=>page.waitForSelector(`main[data-culture-run="${id}"]`);
  await page.setViewport({width:1440,height:1000});await page.goto(origin+'/?zone=b',{waitUntil:'networkidle0'});
  const ids=await page.evaluate(()=>window.__ids);await waitRun(ids.b);
  assert.equal(await page.$eval('main[data-culture-play]',node=>node.dataset.cultureZone),'b');
  assert.equal(await page.$eval('main[data-culture-play]',node=>node.dataset.cultureStage),'1');
  checks.push('explicit zone B overrides bootstrap activeRun A and restores B stage');
  await page.evaluate(()=>window.__select({}));await page.waitForSelector('[data-culture-selection]');
  assert.match(await page.$eval('[data-culture-selection]',node=>node.innerText),/La grande chambre/);assert.match(await page.$eval('[data-culture-selection]',node=>node.innerText),/La relève/);
  assert.equal(await page.$('main[data-culture-play]'),null);checks.push('global Culture lists active zones without starting an unspecified culture');
  await page.evaluate(ids=>window.__select({zoneId:'c',runId:ids.done}),ids);await waitRun(ids.done);
  assert.equal(await page.$eval('main[data-culture-run]',node=>node.dataset.culturePhase),'complete');
  await page.waitForFunction(()=>window.__requests.some(request=>request.path.endsWith('/energy')&&request.query.includes(window.__ids.done)));
  assert.match(await page.$eval('[aria-label="Charges de Kanab Quest"]',node=>node.innerText),/Facture fournisseur/);
  checks.push('explicit terminal run restores harvest and selects its frozen energy and supplier invoice');
  await page.evaluate(ids=>window.__select({zoneId:'a',runId:ids.a}),ids);await waitRun(ids.a);
  await page.evaluate(()=>{window.__holdAction=true;});await click('[data-culture-primary-action]');await page.waitForFunction(()=>typeof window.__releaseAction==='function');
  await page.evaluate(ids=>window.__select({zoneId:'b',runId:ids.b}),ids);await waitRun(ids.b);
  const before=await page.$eval('main[data-culture-play]',node=>({run:node.dataset.cultureRun,stage:node.dataset.cultureStage,phase:node.dataset.culturePhase,variety:node.dataset.cultureVariety}));
  await page.evaluate(()=>window.__releaseAction());await page.waitForFunction(()=>window.__fixture.runs[0].state.phase==='resolved');
  assert.deepEqual(await page.$eval('main[data-culture-play]',node=>({run:node.dataset.cultureRun,stage:node.dataset.cultureStage,phase:node.dataset.culturePhase,variety:node.dataset.cultureVariety})),before);
  checks.push('late action A response after switching to B leaves B state and selection intact');
  await page.evaluate(()=>window.__select({zoneId:'c'}));await page.waitForSelector('article[data-culture-zone="c"]');
  assert.match(await page.$eval('article[data-culture-zone="c"]',node=>node.innerText),/La petite chambre/);
  await click('[data-setup-choice="cards"] > summary');await page.waitForSelector('[data-setup-choice="cards"] [data-card-code="BOTTE-017"]');
  assert.equal(await page.$('[data-setup-choice="cards"] [data-card-code="BOTTE-003"]'),null);
  await click('[data-setup-choice="cards"] > summary');
  checks.push('new deck preparation excludes copies reserved in the other cultures');
  for(const width of [1440,390]){await page.setViewport({width,height:1000,isMobile:width<760,hasTouch:width<760});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:resolve(output,'preparation-c-'+width+'.png'),fullPage:true});}
  await clickText('Lancer ma culture');await page.waitForSelector('[aria-labelledby="culture-system-burn-title"]');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Commencer'&&!button.disabled));
  assert.match(await page.$eval('[aria-label="Charges de Kanab Quest"]',node=>node.innerText),/2 m² engagés/);
  await page.evaluate(()=>{window.__loseStart=true;});await clickText('Commencer');
  await page.waitForFunction(()=>document.body.innerText.includes('Réponse perdue après validation. Réessaie.'));
  await clickText('Commencer');await waitRun('44444444-4444-4444-8444-444444444444');
  const starts=await page.evaluate(()=>window.__fixture.starts);assert.equal(starts.length,2);assert.equal(starts[0].requestKey,starts[1].requestKey);assert.equal(starts[0].zoneId,'c');assert.equal(starts[0].buddieCode,'HH2026-003');assert.equal(await page.evaluate(()=>window.__fixture.created),1);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('kq-zone-start:c')),null);
  checks.push('zone C uses assigned Buddie and 2m² quote; lost start response retries same UUID with one created run');
  await page.reload({waitUntil:'networkidle0'});await waitRun('44444444-4444-4444-8444-444444444444');
  checks.push('reload restores the selected zone/run URL instead of the first active culture');
  for(const width of [390,320]){await page.setViewport({width,height:900,isMobile:true,hasTouch:true});await page.evaluate(()=>window.__select({}));await page.waitForSelector('[data-culture-selection]');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:resolve(output,'cultures-'+width+'.png'),fullPage:true});await page.evaluate(ids=>window.__select({zoneId:'b',runId:ids.b}),ids);await waitRun(ids.b);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:resolve(output,'culture-b-'+width+'.png'),fullPage:true});}
  checks.push('culture chooser and selected game stay within 320/390px viewport');
  assert.deepEqual(errors,[]);report.passed=true;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){report.error=String(error?.stack??error);if(page){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});report.text=await page.evaluate(()=>document.body.innerText).catch(()=>null);}await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));throw error;}
finally{await browser?.close();await server.close();}
