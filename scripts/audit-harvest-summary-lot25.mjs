/** Real player UI and card engine; isolated local API. No live requests or writes. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const before=process.argv.includes('--before');
const helpLayout=process.argv.includes('--help-layout'),helpBaseline=process.argv.includes('--help-baseline'),helpKeyboard=process.argv.includes('--help-keyboard');
const root=process.cwd(), output=resolve(root, helpLayout?'output/help-panels/'+(helpBaseline?'before':helpKeyboard?'keyboard':'after'):'output/clarity-lot25/'+(before?'before':'after'));
const port=Number(process.env.HARVEST_SUMMARY_LOT25_PORT??3595),origin='http://127.0.0.1:'+port;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
import {KqCampaignSummary} from '/src/components/placard/KqCampaignSummary';
import {KqCannabinoidReport} from '/src/components/placard/KqCannabinoidReport';
import {KqHelpDashboard,KqHelpGrid,KqHelpSteps} from '/src/components/placard/KqHelpDashboard';
import {getKqCannabinoidReport} from '/src/lib/kanab-quest-care';
import {KqHarvestMoment} from '/src/components/placard/KqHarvestMoment';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {startKqGame,KQ_CARDS,resolveKqStage,advanceKqStage} from '/src/lib/kanab-quest-game';
import {createKqWarehouseStarter,getKqWarehouseQuote} from '/src/lib/kanab-quest-warehouse';
import {getKqCampaignParticipants,getKqCampaignMemberState,getKqCampaignWarehouse} from '/src/lib/kanab-quest-campaign';
import {quoteKqWarehouseEnergy} from '/src/lib/kanab-quest-warehouse-run';
import {encodeKqSave,parseKqGameSave} from '/src/lib/kanab-quest-persistence';
import {createKqFlower} from '/src/lib/kanab-quest-battle';
import retro from '/src/components/contest/ArenaRetro.module.css';
const scenario=new URLSearchParams(location.search).get('scenario')||'solo';
const helpLayout=${helpLayout};
const initial=createKqWarehouseStarter();
const plan=getKqWarehouseQuote({...initial,zones:[
 {...initial.zones[0],id:'a',buddieCode:'HH2026-002'},
 {...initial.zones[0],id:'b',x:4,width:2,buddieCode:'HH2026-003',optionCodes:['SIM-CLIMATE-03','SIM-NUTRITION-03']},
 ...(helpLayout?[{...initial.zones[0],id:'c',x:6,width:2,buddieCode:'HH2026-004'}]:[])
]},initial).nextState;
const members=getKqCampaignParticipants(plan,4).map((member,i)=>({...member,runId:'40000000-0000-4000-8000-00000000000'+(i+1)}));
const runId=members[0].runId;
const manifest={version:1,id:'50000000-0000-4000-8000-000000000001',leaderRunId:runId,members};
let game=startKqGame(300,{varietyCode:members[0].buddieCode,warehouse:members[0].warehouse,cultivationProfile:members[0].cultivationProfile,startedAt:'2026-10-30T10:00:00Z'});
if(!helpLayout)while(game.phase!=='complete')game=advanceKqStage(resolveKqStage({...game,phase:'rolled',dice:[6,6,6]}));
if(scenario.startsWith('campaign')||helpLayout)game={...game,campaign:manifest};
if(scenario.includes('dead'))game={...game,cultureDead:true,harvestGrams:0,equipmentQualityBonus:0,care:{...game.care,vitality:0}};
if(scenario.includes('zero'))game={...game,harvestGrams:0};
if(scenario.includes('unknown'))game={...game,harvestGrams:undefined};
if(!parseKqGameSave(encodeKqSave(game)))throw new Error('Invalid completed harvest fixture');
const ownStates=game.campaign?members.map(member=>getKqCampaignMemberState(game,member)):[game];
const makeFlower=(own,id)=>({...createKqFlower(own),id:'flower-'+id,runId:id,varietyCode:own.varietyCode,varietyName:own.varietyName,quality:own.quality,combos:own.combos,status:'available',storage:{stage:'curing'},queuedAt:null,lockedAt:null,burnedAt:null});
const flowers=helpLayout||scenario.includes('dead')||scenario.includes('zero')||scenario.includes('unknown')?[]:ownStates.map((own,i)=>makeFlower(own,members[i].runId));
if(scenario==='campaign-official-quality')flowers.forEach((flower,i)=>{flower.quality+=i+2;});
if(scenario==='solo-unconfirmed')flowers.length=0;
if(scenario==='solo-other-flower')flowers.splice(0,flowers.length,makeFlower(game,'90000000-0000-4000-8000-000000000001'));
const inventory=Object.fromEntries(KQ_CARDS.map(card=>[card.code,3]));
const run={runId,zoneId:'a',state:game,status:'complete',buddieCode:game.varietyCode,startedAt:game.startedAt,updatedAt:'2026-10-30T10:05:00Z',burnReceipts:[]};
const session=()=>({activeRun:run,activeRuns:[],flowers,battles:[],progress:null,warnings:[]});
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};storage.persistent.setItem('kq-dice-direct-result','1');
window.__fixture={game,ownStates,flowers,members,requests:[],storageCalls:[],expected:{grams:ownStates.map(own=>own.harvestGrams),qualities:ownStates.map(own=>own.quality)}};
window.__helpReports=ownStates.map(getKqCannabinoidReport);
const request=async(input,init={})=>{
 const url=new URL(String(input),location.origin),path=url.pathname,method=init.method??'GET';window.__fixture.requests.push({path,search:url.search,method});
 if(method!=='GET')throw new Error('Unexpected mutation in harvest recap: '+method+' '+path);
 if(path.endsWith('/bootstrap'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]},ownedBuddieCodes:members.map(m=>m.buddieCode),heritage:{cards:[]},playerSession:session(),warnings:[]});
 if(path.endsWith('/runs')||path.endsWith('/session'))return Response.json(session());
 if(path.endsWith('/collection')||path.endsWith('/cards'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]}});
 if(path.endsWith('/flowers'))return Response.json({flowers});
 if(path.endsWith('/rankings'))return Response.json({entries:[]});
 if(path.endsWith('/me'))return Response.json({progress:null});
 if(path.endsWith('/equipment'))return Response.json({strength:null,routePlan:null});
 if(path.endsWith('/care'))return Response.json({cashCents:12000,basicCarePriceCents:200,inventory:[],catalog:[]});
 if(path.endsWith('/energy')){const warehouse=getKqCampaignWarehouse(game.campaign?members:[members[0]]),quote=quoteKqWarehouseEnergy(warehouse);return Response.json({warehouse,quotes:{eco:quote,balanced:quote,intensive:quote},cashCents:12000,outstandingCents:1200,invoiceCount:1,invoices:[{runId,totalCents:1200,remainingCents:1200,dueAt:'2026-11-01T10:00:00Z'}],supplierInvoice:null,supplierInvoices:[]});}
 if(path.endsWith('/warehouse'))return Response.json({state:plan,revision:4,cashCents:12000});
 if(path.endsWith('/contracts'))return Response.json({code:'light-hand',status:'available',runId:null,quality:null,cardsUsed:0,rewardCents:3000,canAccept:true,reason:null});
 return Response.json({error:'Outside isolated fixture'},{status:404});
};
const api=createKqTutorialApi(request);api.isTutorial=false;
const damagedManifest={...manifest,members:members.map((member,i)=>i?{...member,buddieCode:'UNKNOWN-HISTORICAL-BUDDIE'}:member)};
const terminalState={...game,campaign:scenario==='component-campaign-unknown'?damagedManifest:manifest};
const params=new URLSearchParams(location.search);
const helpContent=scenario==='campaign'?<KqCampaignSummary state={game}/>:scenario==='isolated'?<KqCannabinoidReport report={getKqCannabinoidReport(game)} provisional/>:<KqHelpDashboard>
 <KqHelpGrid art='help-quality' items={[{label:'Qualité finale',value:'10 / 10 maximum',art:'help-quality'},{label:'Bonus de séchage',value:'Cultures lancées après installation',detail:'Selon matériel et capacité de la salle.',art:'help-culture'},{label:'Lots déjà en cours',value:'Bonus conservé',detail:'Les cultures lancées gardent leur bonus de séchage.',art:'help-time'}]}/>
 <KqHelpSteps art='warehouse' steps={[{label:'Modèle choisi',detail:'Ce modèle, dans cette zone, hors pose et aménagement.',art:'help-workshop'},{label:'Tout le plan',detail:'Toutes les zones + pose et aménagement.',art:'warehouse'},{label:'Total final',detail:'Crédits déduits ; matériel réparti selon toutes les modifications.',art:'help-accounts'}]}/>
</KqHelpDashboard>;
const content=helpLayout?<main data-help-fixture={scenario} style={{width:params.has('container')?Number(params.get('container')):'100%',maxWidth:'100%',margin:'auto',padding:scenario==='campaign'?0:12,boxSizing:'border-box'}}>{helpContent}</main>:scenario==='preparation'?<KqCampaignSummary participants={members}/>:scenario.startsWith('component-')?<><KqHarvestMoment state={terminalState} flowers={flowers} runId={runId} fresh={false}/><KqCampaignSummary state={terminalState} flowers={flowers}/></>:<KanabQuestDicePrototype apiScope='player' initialRunId={runId} initialCampaign={!!game.campaign} viewMode='game' showWarehouseNavigation={false} showAdminOperations={false} isolatedStorage={storage} onOpenStorage={flowerId=>window.__fixture.storageCalls.push(flowerId??null)}/>;
createRoot(document.getElementById('root')).render(<div className={[retro.surface,helpLayout?retro.gameSurface:''].filter(Boolean).join(' ')}><KqTutorialApiProvider api={api}>{content}</KqTutorialApiProvider></div>);
`;
const modules = {
 entry,
 "next/image": `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 "next/link": `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
 "next/navigation": `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
 "next/dynamic": `import React from 'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>;}`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
 optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react','@3d-dice/dice-box-threejs']},
 resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},
 plugins:[{name:'harvest-summary-lot25',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},
 async load(id){if(helpBaseline&&/\/(KqHelpDashboard|KqCultureCare|KqCampaignSummary)\.module\.css$/.test(id)){const name=id.split('/').at(-1).replace('.module.css','.before.module.css');return await readFile(resolve(root,'output/help-panels',name),'utf8')}if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmation de carte · recette locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);})}}],
 server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});

const results=[],errors=[],external=[];const report={passed:false,mode:before||helpBaseline?'before':'after',results,errors,external,backend:'Real React UI and game engine, isolated local API; no external requests or writes.'};let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',request=>{const u=new URL(request.url());if(u.origin===origin&&u.pathname==='/favicon.ico')void request.respond({status:204});else if(['data:','blob:'].includes(u.protocol)||u.origin===origin&&!u.pathname.startsWith('/api/'))void request.continue();else{external.push(request.url());void request.abort()}});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 async function load(scenario){await page.goto(origin+'/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector(scenario==='preparation'?'[data-campaign-summary]':scenario.startsWith('component-')?'[data-harvest-moment]':'main[data-culture-phase="complete"]');await page.evaluate(()=>document.fonts.ready);}
 async function shot(name){await page.evaluate(()=>Promise.allSettled([...document.images].map(i=>i.decode())));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true})}
 async function frames(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
 async function enter(selector){await page.$eval(selector,e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.focus(selector);await page.keyboard.press('Enter');await frames()}
 async function noOverflow(label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' has no horizontal overflow')}
 async function noWrites(){assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(r=>r.method!=='GET').length),0,'Reading harvest details spends nothing')}
 async function disclosure(selector){assert.equal(await page.$eval(selector,e=>e.open),false,selector+' starts closed');await enter(selector+' > summary');assert.equal(await page.$eval(selector,e=>e.open),true);assert.equal(await page.$eval(selector+' > summary',e=>e===document.activeElement),true,'Opening keeps focus on the summary');await noOverflow(selector+' open');await page.keyboard.press('Space');await frames();assert.equal(await page.$eval(selector,e=>e.open),false);assert.equal(await page.$eval(selector+' > summary',e=>e===document.activeElement),true,'Closing keeps focus on the summary')}
 if(helpLayout){
  const cases=[
   ...[320,390,1440].map(width=>({scenario:'campaign',width,container:width===1440?1100:width})),
   ...[220,320,480,1100].map(container=>({scenario:'isolated',width:1440,container})),
   ...[320,390].map(width=>({scenario:'isolated',width,container:width})),
   ...[220,320,480,1100].map(container=>({scenario:'shared',width:1440,container})),
   ...[320,390].map(width=>({scenario:'shared',width,container:width})),
  ];
  for(const item of cases.filter(item=>!helpKeyboard||item.scenario==='campaign'&&[320,1440].includes(item.width))){
   const {scenario,width,container}=item;
   await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});
   await page.goto(origin+'/?scenario='+scenario+'&container='+container,{waitUntil:'networkidle0'});
   await page.waitForSelector('[data-help-fixture]');await page.evaluate(()=>document.fonts.ready);
   const disclosures=await page.$$('[data-cannabinoid-report] > summary');
   for(const summary of disclosures){
    assert.equal(await summary.evaluate(e=>e.parentElement.open),false,'Reports start closed');
    await summary.focus();await page.keyboard.press('Enter');await frames();
    assert.equal(await summary.evaluate(e=>e.parentElement.open&&document.activeElement===e),true,'Enter opens the report with focus retained');
    await page.keyboard.press('Space');await frames();
    assert.equal(await summary.evaluate(e=>e.parentElement.open),false,'Space closes the report');
    await page.keyboard.press('Enter');await frames();
   }
   await page.evaluate(()=>Promise.allSettled([...document.images].map(i=>i.decode())));
   const layout=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
    const textLayout=e=>{
     const brokenWords=[];const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
     while(walker.nextNode()){
      const node=walker.currentNode;if(node.parentElement.closest('[aria-hidden=true]'))continue;
      for(const match of node.textContent.matchAll(/[\p{L}\p{N}]{5,}/gu)){
       const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
       const lines=new Set([...range.getClientRects()].map(r=>Math.round(r.y)));
       if(lines.size>1)brokenWords.push({word:match[0],lines:lines.size});
      }
     }
     return{text:e.textContent.trim(),...rect(e),fontSize:parseFloat(getComputedStyle(e).fontSize),brokenWords};
    };
    const facts=[...document.querySelectorAll('[data-help-facts] > div')].map(e=>({box:rect(e),label:textLayout(e.querySelector('dt > span:last-child')),value:textLayout(e.querySelector('dd strong')),caption:e.querySelector('dd > span')?textLayout(e.querySelector('dd > span')):null,art:rect(e.querySelector('dt > span:first-child'))}));
    const steps=[...document.querySelectorAll('[data-help-steps] > li')].map(e=>({box:rect(e),text:textLayout(e.querySelector(':scope > div')),art:rect(e.querySelector(':scope > span'))}));
    const reports=[...document.querySelectorAll('[data-cannabinoid-report]')].map((e,i)=>{
     const expected=window.__helpReports[i];const expectedCells=Object.values(expected.rates).length+Object.values(expected.totals).length;
     return{box:rect(e),summary:e.querySelector('summary').textContent,values:[...e.querySelectorAll('[data-help-facts] dd strong')].map(n=>n.textContent),expectedValues:[expected.score+'/99',expected.profile.name],caption:e.querySelector('table caption').textContent,rows:e.querySelectorAll('tbody tr').length,cellCount:e.querySelectorAll('tbody td').length,expectedCells,tableScroll:e.querySelector('[role=region]').scrollWidth-e.querySelector('[role=region]').clientWidth,imagesLoaded:[...e.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0)};
    });
    return{overflow:document.documentElement.scrollWidth-innerWidth,members:[...document.querySelectorAll('[data-campaign-member]')].map(rect),facts,steps,reports};
   });
   const keyboard=[];
   if(helpKeyboard){
    for(const region of await page.$$('[data-cannabinoid-report] [role=region]')){
     await region.focus();assert(await region.evaluate(e=>document.activeElement===e),'Scrollable table is keyboard focusable');
     const beforeScroll=await region.evaluate(e=>e.scrollLeft);await page.keyboard.press('ArrowRight');
     await page.waitForFunction(e=>e.scrollLeft>0,{timeout:3000},region);
     const state=await region.evaluate(e=>({before:0,after:e.scrollLeft,max:e.scrollWidth-e.clientWidth,focusVisible:e.matches(':focus-visible'),outline:getComputedStyle(e).outlineStyle}));
     assert(state.after>beforeScroll&&state.focusVisible&&state.outline!=='none','ArrowRight scrolls the focused table with visible focus');keyboard.push(state);
    }
    const summary=await page.$eval('[data-cannabinoid-report] > summary',e=>({font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize}));
    assert.match(summary.font,/Body/);assert.equal(summary.size,'14px');keyboard.push({summary});
   }
   const name=scenario+'-'+width+'-container-'+container;
   await page.evaluate(()=>window.scrollTo(0,0));await shot(name);
   results.push({...item,...layout,keyboard});
   for(const actual of layout.reports){assert.deepEqual(actual.values,actual.expectedValues,'Scores and profiles preserve the real report');assert.match(actual.summary,/taux simulés/);assert.match(actual.caption,/teneurs simulées en masse sèche/);assert.equal(actual.rows,7);assert.equal(actual.cellCount,actual.expectedCells);assert(actual.imagesLoaded,'All report illustrations loaded')}
   if(scenario==='campaign'){assert.equal(layout.members.length,3);if(width===1440)assert.equal(new Set(layout.members.map(m=>m.y)).size,1,'Three real campaign columns at desktop')}
   if(!helpBaseline){
    assert(layout.overflow<=1,name+' stays within the page');
    for(const fact of layout.facts){
     assert(fact.value.width>=100,name+' leaves readable value width: '+JSON.stringify(fact));
     for(const text of [fact.label,fact.value,fact.caption].filter(Boolean)){assert(text.fontSize>=11.5,name+' uses readable text size');assert.deepEqual(text.brokenWords,[],name+' does not split ordinary words: '+text.text)}
     assert(fact.art.width<=120&&fact.art.width<=fact.box.width*.5,name+' illustration has a bounded footprint');
    }
    for(const step of layout.steps){assert(step.text.width>=100,name+' leaves readable step text');assert.deepEqual(step.text.brokenWords,[],name+' does not split ordinary step words');assert(step.art.width<=126&&step.art.width<=step.box.width*.5,name+' step artwork fits its column')}
   }
   await noWrites();
  }
 }else{
 for(const width of [320,390,1440])for(const scenario of ['solo','campaign']){
  await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});await load(scenario);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,scenario+' horizontal overflow '+width);
  await shot(scenario+'-'+width);
  const metric=await page.evaluate(()=>({height:document.documentElement.scrollHeight,summaryHeight:document.querySelector('[data-campaign-summary]')?.getBoundingClientRect().height??null,headings:[...document.querySelectorAll('main h1,main h2')].map(h=>h.textContent),closedDetails:[...document.querySelectorAll('main details')].filter(d=>!d.open).length}));
  results.push({scenario,width,...metric});
  if(!before){
   const expected=await page.evaluate(()=>({grams:window.__fixture.expected.grams,qualities:window.__fixture.expected.qualities,flowers:window.__fixture.flowers}));
   const moment=await page.$eval('[data-harvest-moment]',e=>e.innerText);const total=Math.round(expected.grams.reduce((a,b)=>a+b,0)*10)/10;
   assert.ok(moment.includes(total.toLocaleString('fr-FR',{maximumFractionDigits:1})),'Hero preserves authoritative harvested grams');assert.match(moment,/points/,'Culture quality is labelled in points');
   await enter('[data-harvest-moment] button');assert.deepEqual(await page.evaluate(()=>window.__fixture.storageCalls),[scenario==='solo'?expected.flowers[0].id:null],'Hero leads to the exact solo stock or campaign storage');
   if(scenario==='solo'){
    for(const selector of ['[data-harvest-journal]','[data-harvest-charges]','[data-harvest-flower]'])await disclosure(selector);
    assert.equal(await page.$$eval('[data-harvest-flower]',nodes=>nodes.length),1,'One Fleur detail destination');
   }else{
    assert.equal(await page.$$eval('[data-campaign-member]',nodes=>nodes.length),2,'Both varieties stay distinct');
    await disclosure('[data-culture-campaign-recap]');
    await disclosure('[data-harvest-charges]');
    for(let i=0;i<2;i++){
     const row='[data-campaign-member="'+['a','b'][i]+'"]';const text=await page.$eval(row,e=>e.innerText);
     assert.ok(text.includes(expected.grams[i].toLocaleString('fr-FR',{maximumFractionDigits:1})),'Each variety shows its own grams');assert.ok(text.includes(String(expected.qualities[i])),'Each variety shows its own culture quality');
     const href=await page.$eval(row+' a',e=>e.getAttribute('href'));const url=new URL(href,origin);assert.equal(url.searchParams.get('view'),'workshop');assert.equal(url.searchParams.get('section'),'storage');assert.equal(url.searchParams.get('flower'),expected.flowers[i].id,'Each storage link targets its own flower');
     await disclosure(row+' [data-campaign-harvest-profile]');
    }
   }
   await noWrites();results.push({scenario:scenario+' results, storage and keyboard disclosures',width,preservedGrams:true,preservedQuality:true,noWrites:true});
  }
 }
 if(!before){
  await page.setViewport({width:320,height:422,isMobile:true,hasTouch:true});
  for(const scenario of ['solo','campaign']){
   await load(scenario);await enter('[data-harvest-moment] button');const hit=await page.$eval('[data-harvest-moment] button',e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{height:r.height,visible:r.top>=0&&r.bottom<=innerHeight,uncovered:e===hit||e.contains(hit)}});assert.ok(hit.visible&&hit.uncovered&&hit.height>=44,'Storage action remains reachable on short screens');await noOverflow(scenario+' 320x422');await page.screenshot({path:resolve(output,scenario+'-320x422-action.png')});results.push({scenario:scenario+' short viewport',width:320,height:422,button:hit});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  for(const scenario of ['unknown','zero','dead','campaign-dead']){
   await load(scenario);await noOverflow(scenario);assert.equal(await page.$('[data-harvest-moment] button'),null,'Unavailable or zero harvest cannot open storage');assert.equal(await page.$('[data-harvest-flower]'),null,'No Fleur is invented for absent harvest');
   if(scenario==='unknown')assert.match(await page.$eval('[data-harvest-moment]',e=>e.innerText),/Quantité indisponible/);
   if(scenario==='zero')assert.match(await page.$eval('[data-harvest-moment]',e=>e.innerText),/Aucune récolte/);
   if(scenario==='dead')assert.match(await page.$eval('[data-outcome="dead"]',e=>e.innerText),/sans récolte/i);
   if(scenario==='campaign-dead'){assert.equal(await page.$('[data-campaign-harvest-profile]'),null,'A dead campaign has no harvested profile');assert.equal(await page.$('[data-campaign-member] a'),null,'A dead campaign has no nonexistent stock link');assert.ok((await page.$$eval('[data-campaign-harvest-grams]',nodes=>nodes.map(e=>e.textContent))).every(text=>/0\s*g/.test(text)),'A real terminal zero remains zero')}
   if(scenario==='unknown'||scenario==='zero'){await disclosure('[data-harvest-journal]');await disclosure('[data-harvest-charges]')}
   await noWrites();await shot(scenario+'-390');results.push({scenario,unknownIsNotZero:true,noInventedFlower:true,noWrites:true});
  }
  await load('campaign-official-quality');
  const official=await page.evaluate(()=>window.__fixture.flowers.map(f=>f.quality));for(let i=0;i<2;i++)assert.ok((await page.$eval('[data-campaign-member="'+['a','b'][i]+'"]',e=>e.innerText)).includes(String(official[i])),'Displayed quality follows the official flower');results.push({scenario:'campaign official quality',quality:official});
  for(const scenario of ['solo-unconfirmed','solo-other-flower']){
   await load(scenario);await enter('[data-harvest-flower] > summary');assert.match(await page.$eval('[data-harvest-flower]',e=>e.innerText),/Fleur à confirmer/);assert.equal(await page.$('[aria-label="Carte Fleur obtenue"]'),null,'An unconfirmed official flower is never recreated from the old game state');await enter('[data-harvest-moment] button');assert.deepEqual(await page.evaluate(()=>window.__fixture.storageCalls),[null],'An unrelated stock ID is never substituted');await noOverflow(scenario);await noWrites();results.push({scenario,noInventedFlower:true,noWrongStockTarget:true});
  }
  await load('preparation');assert.equal(await page.$('[data-campaign-harvest-profile]'),null,'Preparation retains projection presentation');assert.match(await page.$eval('[data-campaign-summary]',e=>e.innerText),/estimés|estimé/);await noOverflow('preparation');results.push({scenario:'preparation projections unchanged',noWrites:true});
  await load('component-campaign-unknown');await noOverflow('historical unknown campaign member');assert.match(await page.$eval('[data-campaign-summary]',e=>e.innerText),/indisponible|à vérifier|inconnue/i);assert.match(await page.$eval('[data-campaign-member="b"] [data-campaign-harvest-grams]',e=>e.textContent),/—/,'Missing grams are not fabricated zero');assert.match(await page.$eval('[data-campaign-harvest-total]',e=>e.textContent),/—/,'An incomplete total is not fabricated');assert.match(await page.$eval('[data-campaign-member="b"] [data-campaign-harvest-profile]',e=>e.textContent),/indisponible/,'An unknown harvest has no invented profile');assert.equal(await page.$('[data-campaign-member="b"] [data-cannabinoid-report]'),null);assert.equal(await page.$('[data-campaign-member="b"] a'),null);await shot('campaign-unknown-390');results.push({scenario:'historical campaign member missing',unknownIsNotZero:true,noInventedProfile:true});
 }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.passed=true;
}catch(error){report.failure=error.stack;console.error(error);process.exitCode=1}finally{await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();console.log(JSON.stringify(report,null,2))}
