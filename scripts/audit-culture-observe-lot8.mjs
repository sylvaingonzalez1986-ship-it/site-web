/** Real components, preparation model and in-memory culture transport. No remote calls or database. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd(), output = resolve(root, "output/clarity-lot8/culture-observe", process.env.KQ_CULTURE_CLARITY_PHASE ?? "after");
const port = Number(process.env.CULTURE_OBSERVE_LOT8_PORT ?? 3588), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from"react";import{createRoot}from"react-dom/client";import"/src/app/globals.css";
import{KanabQuestDicePrototype}from"/src/components/placard/KanabQuestDicePrototype";
import{KqDeckPreparation}from"/src/components/placard/KqDeckPreparation";
import{createKqTutorialApi,KqTutorialApiProvider}from"/src/components/placard/KqTutorialApiContext";
import{getKqPreparationStartingXp}from"/src/lib/kanab-quest-deck-preparation";
import{createReleveCultureTransport}from"/src/lib/kanab-quest-releve-culture";
import{createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan}from"/src/lib/kanab-quest-releve-production";
import{getKqCampaignParticipants}from"/src/lib/kanab-quest-campaign";
import{startKqGame,KQ_ACTIVE_CARDS,KQ_BUDDIES}from"/src/lib/kanab-quest-game";
import{KQ_HERITAGE_CARDS}from"/src/lib/kanab-quest-heritage";
import retro from"/src/components/contest/ArenaRetro.module.css";
const scenario=new URLSearchParams(location.search).get('scenario')||'official';
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};
const candidates=KQ_ACTIVE_CARDS.filter(card=>!['pbi','substrate'].includes(card.category)&&card.rarity!=='epic').map(card=>card.code);
const inventory=Object.fromEntries(candidates.map(code=>[code,3]));
const doubleDeck=[...candidates.slice(0,9),candidates[0]];
window.__calls=[];window.__pending=[];
window.__callbacks=[];
if(scenario.startsWith('panel-')){
 const kind=scenario.slice(6),deck=kind==='empty'?[]:kind==='large'?candidates.slice(0,13):kind==='expensive'?['BOTTE-039','BOTTE-039']:doubleDeck;
 const stock=['loading','error'].includes(kind)?null:kind==='missing'?{[candidates[0]]:1}:kind==='expensive'?{'BOTTE-039':2}:inventory;
 const heritage=KQ_HERITAGE_CARDS.find(card=>card.effect==='starting-xp-two');
 const buddies=[KQ_BUDDIES[0],KQ_BUDDIES.find(card=>card.advantageLevel>0)];
 const xp=kind==='unknown'?null:kind==='expensive'?1:getKqPreparationStartingXp({source:'official',buddieCodes:buddies.map(card=>card.code),heritageCard:heritage,chanvrierStrength:'green-thumb'});
 window.__fixture={deck,stock,xp,expectedXp:1+2+Math.max(...buddies.map(card=>card.advantageLevel))+2+2};
 window.__localChecks=['local','tutorial'].map(source=>{const base=source==='local'?2:1;const input={source,buddieCodes:[buddies[1].code],heritageCard:heritage,chanvrierStrength:undefined,localBaseXp:base};return {source,forecast:getKqPreparationStartingXp(input),actual:startKqGame(2,{varietyCode:buddies[1].code,startingXp:base,heritageCode:heritage.code,heritageCard:heritage}).xp};});
 createRoot(document.getElementById('root')).render(<div className={retro.surface}><main style={{maxWidth:960,margin:'auto',padding:12}}><KqDeckPreparation deckCodes={deck} inventory={stock} startingXp={xp} loading={kind==='loading'} error={kind==='error'?'Stock indisponible':''}/></main></div>);
}else{
 let production=createKqReleveProduction();const act=action=>production=applyKqReleveProductionAction(production,action);
 act({type:'draft',warehouse:suggestKqRelevePlan(production,scenario==='campaign'?2:1)});act({type:'save-plan'});
 for(let index=0;index<3;index++)act({type:'reveal-buddie'});
 const zones=production.warehouse.zones;
 zones.forEach((zone,index)=>act({type:'assign',zoneId:zone.id,buddieCode:production.ownedBuddies[index]}));act({type:'save-plan'});
 if(scenario==='empty-buddies')production={...production,ownedBuddies:[],warehouse:{...production.warehouse,zones:production.warehouse.zones.map(zone=>{const emptyZone={...zone};delete emptyZone.buddieCode;return emptyZone;})}};
 production={...production,heritageCode:scenario==='unknown-heritage'?'HERITAGE-999':scenario==='absent-heritage'?'HERITAGE-006':production.heritageCode};
 const transport=createReleveCultureTransport({getState:()=>production,setState:next=>{production=next;window.__production=next;}});
 const pending=new Map();let equipmentMode=scenario==='equipment-pending'?'pending':scenario==='equipment-invalid'?'invalid':'known';
 let bootstrapMode=scenario==='stock-loading'?'pending':scenario==='stock-error'?'error':'known';
 let energyStatus=scenario;window.__recoverEnergy=()=>{energyStatus='known'};
 const request=async(input,init)=>{const url=new URL(String(input),location.origin),path=url.pathname,method=init?.method||'GET';window.__calls.push({path,method,signal:init?.signal});if(method!=='GET')throw new Error('Read-only audit: no culture launch or transaction');
  if(path.endsWith('/equipment')){if(equipmentMode==='pending'){const id=window.__calls.length;window.__pending.push(id);return await new Promise(resolve=>pending.set(id,resolve));}if(equipmentMode==='error')return Response.json({error:'indisponible'},{status:503});if(equipmentMode==='invalid')return Response.json({strength:'not-a-strength'});if(equipmentMode==='green')return Response.json({strength:'green-thumb'});}
  if(path.endsWith('/bootstrap')){if(bootstrapMode==='pending'){window.__bootstrapPending=true;return await new Promise(resolve=>pending.set('bootstrap',resolve));}if(bootstrapMode==='error')return Response.json({error:'Stock indisponible'},{status:503});if(bootstrapMode==='collection-error'){const payload=await(await transport(input,init)).json();return Response.json({...payload,collection:null});}if(scenario==='heritage-unavailable'){const payload=await(await transport(input,init)).json();return Response.json({...payload,heritage:null});}}
  if(path.includes('/contracts'))return Response.json({error:'Not in fixture'},{status:404});
  if(path.endsWith('/energy')&&energyStatus==='energy-error')return Response.json({error:'Devis temporairement indisponible'},{status:503});
  if(path.endsWith('/energy')&&energyStatus==='energy-loading')return await new Promise(resolve=>{window.__resolveEnergy=async()=>{energyStatus='known';resolve(await transport(input,init));}});
  return transport(input,init);
 };
 const api=createKqTutorialApi(request);api.isTutorial=false;
 window.__control={equipment:mode=>{equipmentMode=mode;api.notify('kq:equipment-updated');},resolve:(id,strength)=>{pending.get(id)?.(Response.json({strength}));pending.delete(id);},bootstrap:async()=>{bootstrapMode='known';pending.get('bootstrap')?.(await transport('/api/arena/placard/bootstrap'));window.__bootstrapPending=false;},stock:mode=>{bootstrapMode=mode;api.notify('kq:collection-updated');},refresh:()=>api.notify('kq:collection-updated')};
 const participants=getKqCampaignParticipants(production.warehouse,production.revision);
 window.__fixture={deck:production.deckCodes,heritageCode:production.heritageCode,participants:participants.map(member=>member.buddieCode),expectedXp:getKqPreparationStartingXp({source:'official',buddieCodes:participants.map(member=>member.buddieCode),heritageCard:KQ_HERITAGE_CARDS.find(card=>card.code===production.heritageCode),chanvrierStrength:null}),expectedXpWithoutHeritage:getKqPreparationStartingXp({source:'official',buddieCodes:participants.map(member=>member.buddieCode),heritageCard:null,chanvrierStrength:null}),stock:production.supportInventory};window.__production=production;
 createRoot(document.getElementById('root')).render(<div className={retro.surface}><KqTutorialApiProvider api={api}><KanabQuestDicePrototype apiScope="player" initialCampaign showAdminOperations={false} showWarehouseNavigation={false} initialPreparation={{deckCodes:production.deckCodes,heritageCode:production.heritageCode}} isolatedStorage={storage} onOpenBuddiePacks={()=>window.__callbacks.push('buddie-packs')} onOpenWarehouse={()=>window.__callbacks.push('warehouse')}/></KqTutorialApiProvider></div>);
}
`;
const modules = {
  entry,
  "next/image": `import React from"react";export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==="string"?src:src.src} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...props.style}}/>}`,
  "next/link": `import React from"react";export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  "next/navigation": `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  "next/dynamic": `import React from"react";export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(root, "output/clarity-lot8/culture-observe/vite-cache"), publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react", "@3d-dice/dice-box-threejs"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: "deck-preparation-audit", enforce: "pre", resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) { if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split("?")[0] !== "/") return next(); res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Préparation du deck · audit isolé</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});
let browser,page;const results=[],errors=[],external=[];
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(['data:','blob:'].includes(u.protocol)||u.origin===origin&&!u.pathname.startsWith('/api/'))void r.continue();else{external.push(r.url());void r.abort();}});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const shot=async(name,fullPage=false)=>page.screenshot({path:resolve(output,name+'.png'),fullPage});
 const enter=async selector=>{const e=await page.waitForSelector(selector,{visible:true});await e.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await e.focus();await page.keyboard.press('Enter');};
 for(const size of [{width:320,height:844,name:'320'},{width:390,height:844,name:'390'},{width:320,height:422,name:'reflow-640-at-200'},{width:1440,height:844,name:'1440'}]){
  await page.setViewport({width:size.width,height:size.height});await page.goto(origin+'/?scenario=official',{waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-start-review]');await page.evaluate(()=>document.fonts.ready);await shot('preparation-'+size.name,true);
  const start=await page.$eval('[data-culture-start-review]',e=>({top:e.getBoundingClientRect().top+scrollY,height:e.getBoundingClientRect().height,text:e.textContent}));
  const summaries=await page.$$eval('[data-setup-choice] > summary',elements=>elements.map(e=>({text:e.innerText,height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize})));
  await enter('[data-setup-choice="cards"] > summary');await page.waitForSelector('[data-deck-preparation]');await page.$eval('[data-deck-preparation]',e=>e.scrollIntoView({block:'start',behavior:'instant'}));await shot('deck-'+size.name);
  const deckMetrics=await page.$eval('[data-deck-preparation]',node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height,overflow:node.scrollWidth>node.clientWidth+1,labels:[...node.querySelectorAll('dt')].map(e=>({text:e.textContent,font:parseFloat(getComputedStyle(e).fontSize)})),secondary:[...node.querySelectorAll('small,p,summary span')].filter(e=>e.checkVisibility()).map(e=>({text:e.textContent,font:parseFloat(getComputedStyle(e).fontSize)})),copies:node.querySelector('[data-deck-copies]').firstChild.textContent,xp:node.querySelector('[data-deck-starting-xp]').firstChild.textContent};});
  assert.equal(deckMetrics.overflow,false);assert(deckMetrics.labels.every(label=>label.font>=14));assert(deckMetrics.secondary.every(label=>label.font>=13));assert.equal(deckMetrics.copies,'10');assert.equal(deckMetrics.xp,'5 XP');
  await enter('[data-deck-compatibility] > summary');assert.equal(await page.$$eval('[data-deck-compatibility] [role="meter"]',nodes=>nodes.length),6);await shot('deck-compatibility-'+size.name);await enter('[data-deck-compatibility] > summary');assert.equal(await page.$eval('[data-deck-compatibility]',e=>e.open),false);
  const smallDeck=await page.$eval('[data-setup-choice="cards"]',node=>[...node.querySelectorAll('p,small,span,strong,label')].filter(e=>e.checkVisibility()&&e.childElementCount===0&&e.textContent.trim()&&parseFloat(getComputedStyle(e).fontSize)<12).slice(0,14).map(e=>({text:e.textContent.trim(),font:getComputedStyle(e).fontSize})));
  await enter('[data-setup-choice="cards"] > summary');await enter('[data-culture-start-review]');await page.waitForSelector('[data-culture-confirm-start]:not(:disabled)');await shot('start-cost-'+size.name);
  const dialog=await page.$eval('[data-app-dialog]',node=>{const body=node.querySelector('[data-app-dialog-body]'),button=node.querySelector('[data-culture-confirm-start]');const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return{box:rect(node),body:rect(body),scrollHeight:body.scrollHeight,scrollWidth:body.scrollWidth,button:rect(button),text:body.innerText,smallText:[...node.querySelectorAll('p,small,span,strong,label,b')].filter(e=>e.checkVisibility()&&e.childElementCount===0&&e.textContent.trim()&&parseFloat(getComputedStyle(e).fontSize)<12).map(e=>({text:e.textContent.trim(),font:getComputedStyle(e).fontSize})),overflow:document.documentElement.scrollWidth>innerWidth+1};});
  const budget=await page.$eval('[data-campaign-budget]',e=>{const r=e.getBoundingClientRect();return{text:e.innerText,top:r.top,bottom:r.bottom};});assert.match(budget.text,/66,70\s*€/);assert(budget.top>=dialog.body.y&&budget.bottom<=dialog.body.bottom,'Budget visible on opening, including the reduced viewport');assert.equal(dialog.overflow,false);assert.match(dialog.text,/Aucune carte consommée au départ/);assert.match(dialog.text,/6 heures réelles d’affinage/);
  await enter('[data-culture-launch-cards] > summary');assert.equal(await page.$eval('[data-culture-launch-cards]',e=>e.open),true);assert.match(await page.$eval('[data-culture-launch-cards]',e=>e.innerText),/10 cartes choisies/);await enter('[data-culture-launch-cards] > summary');assert.equal(await page.$eval('[data-culture-launch-cards]',e=>e.open),false);
  await page.focus('[data-culture-confirm-start]');await shot('start-confirm-focused-'+size.name);const focused=await page.$eval('[data-culture-confirm-start]',e=>{const r=e.getBoundingClientRect();return{y:r.y,bottom:r.bottom,focus:document.activeElement===e,outline:getComputedStyle(e).outlineStyle,fullyVisible:r.y>=0&&r.bottom<=innerHeight}});
  assert.equal(focused.fullyVisible,true);assert.notEqual(focused.outline,'none');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-app-dialog]'));assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-culture-start-review')),true);assert.equal(await page.evaluate(()=>window.__production.game),null);assert((await page.evaluate(()=>window.__calls)).every(c=>c.method==='GET'));
  results.push({viewport:size,start,summaries,smallDeck,deckMetrics,dialog,budget,focused,keyboardDetails:true,escapeRestoresOpener:true});
 }
 for(const scenario of ['panel-unknown','panel-missing','panel-loading']){
  await page.setViewport({width:320,height:422});await page.goto(origin+'/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('[data-deck-preparation]');await page.evaluate(()=>document.fonts.ready);await shot(scenario,true);
  const unknown=await page.$eval('[data-deck-preparation]',node=>({text:node.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1,labels:[...node.querySelectorAll('dt,small')].map(e=>({text:e.textContent,font:parseFloat(getComputedStyle(e).fontSize)}))}));assert.equal(unknown.overflow,false);assert(unknown.labels.every(item=>item.font>=13));assert.match(unknown.text,/À vérifier/);results.push({scenario,...unknown});
 }
 for(const scenario of ['energy-loading','energy-error']){
  await page.setViewport({width:390,height:844});await page.goto(origin+'/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-start-review]:not(:disabled)');await enter('[data-culture-start-review]');await page.waitForSelector('[data-culture-confirm-start]');
  if(scenario==='energy-error')await page.waitForSelector('[data-campaign-energy] [role="alert"]');else await page.waitForFunction(()=>typeof window.__resolveEnergy==='function');
  assert.equal(await page.$eval('[data-culture-confirm-start]',e=>e.disabled),true);assert.equal(await page.$('[data-campaign-budget]'),null,'Missing quote must not appear as a zero budget');await shot(scenario);
  if(scenario==='energy-loading')await page.evaluate(()=>window.__resolveEnergy());else{await page.evaluate(()=>window.__recoverEnergy());await enter('[aria-label="Actualiser les charges"]');}
  await page.waitForSelector('[data-culture-confirm-start]:not(:disabled)');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__production.game),null);assert((await page.evaluate(()=>window.__calls)).every(c=>c.method==='GET'));results.push({scenario,startBlockedUntilQuote:true,recovery:true});
 }
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844});await page.goto(origin+'/?scenario=empty-buddies',{waitUntil:'networkidle0'});await page.waitForSelector('[data-empty-buddie-collection]');await shot('empty-buddies-'+width,true);assert.equal(await page.$eval('[data-culture-start-review]',e=>e.disabled),true);
  await enter('[data-empty-buddie-collection] button');assert.deepEqual(await page.evaluate(()=>window.__callbacks),['buddie-packs']);assert.equal(await page.evaluate(()=>window.__production.game),null);assert((await page.evaluate(()=>window.__calls)).every(c=>c.method==='GET'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);results.push({scenario:'empty-buddies',width,exactCallback:true,noLaunch:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Actual player preparation component; local official-style GET transport; no launch; reflow case uses320×422CSSpx, equivalent available layout at200% of640×844, not native browser zoom',results,errors,external},null,2));console.log(JSON.stringify({observed:results.length,errors,external,output}));
}catch(e){await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw e;}
finally{const timer=setTimeout(()=>{browser?.process()?.kill();server.httpServer?.closeAllConnections();},5000);try{await browser?.close();server.httpServer?.closeAllConnections();await server.close();}finally{clearTimeout(timer);}}
