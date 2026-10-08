/** Real mission/pack interfaces; synthetic rewards and every API intercepted locally. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/mission-direct-pack'),origin='http://127.0.0.1:3265';
const definitions=[['first-harvest','culture',1,1,3],['three-varieties','culture',2,3,3],['contest-flower','culture',3,1,10],['online-two','online',1,2,3],['online-five','online',2,5,3],['online-ten','online',3,10,10],['shop-one','shops',1,1,3],['shop-three','shops',2,3,3],['shop-six','shops',3,6,10]];
let scenario='',targetCode='first-harvest',earned=new Set(),opened=new Set(),failure='';
const report={passed:false,fixture:'Real KqMissionCenter and KqSupportPackOpening; intercepted local API only.',results:[],requests:[],unexpected:[],remote:[],errors:[]};
const cards=count=>Array.from({length:count},(_,index)=>({code:`BOTTE-${String(index+1).padStart(3,'0')}`,name:`Carte de fixture ${index+1}`,rarity:index%3===0?'rare':'commune'}));
const snapshot=()=>({collectionActive:true,missions:definitions.map(([code,track,step,target,cardCount])=>{
  const previous=definitions.find(row=>row[1]===track&&row[2]===step-1),claimed=earned.has(code),unlocked=!previous||earned.has(previous[0]);
  return {code,track,step,target,cardCount,claimed,unlocked,claimable:!claimed&&unlocked&&code===targetCode,progress:claimed||code===targetCode?target:0,entitlementId:claimed?'fixture-'+code:null,packAvailable:claimed?!opened.has(code):null};
})});
const modules={
  fixture:`import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';import{KqMissionCenter}from'/src/components/placard/KqMissionCenter';import retro from'/src/components/contest/ArenaRetro.module.css';createRoot(document.getElementById('root')).render(React.createElement('div',{className:retro.surface+' '+retro.shell},React.createElement(KqMissionCenter,{onOpen:view=>location.assign('/arene/placard?view='+view)})));`,
  link:`import React from'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/image':`import React from'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/navigation':`export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:path=>location.assign(path),replace:path=>location.replace(path),refresh:()=>{}});`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}`;
const server=await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'mission-direct-pack-fixture',enforce:'pre',resolveId(id){if(id.endsWith('/components/navigation/NavigationLink')||id==='next/link')return '\0link';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{
  const path=req.url?.split('?')[0];if(path==='/'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>`);return;}
  if(path==='/arene/placard'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1 data-audit-destination>Destination locale</h1>');return;}next();
});}}],server:{host:'127.0.0.1',port:3265,strictPort:true,hmr:false,watch:null}});
let browser,page;
const modal='dialog[data-mission-pack-opening][open]',reveal='[data-support-pack-reveal]';
async function clickText(text,selector='button'){
  await page.waitForFunction((selector,text)=>[...document.querySelectorAll(selector)].some(el=>el.textContent.includes(text)&&!el.disabled),{},selector,text);
  const handles=await page.$$(selector);for(const handle of handles){if(await handle.evaluate((el,text)=>el.textContent.includes(text)&&!el.disabled,text)){await handle.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await handle.click();return;}}
  assert.fail('Missing button: '+text);
}
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+': horizontal overflow');await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});}
async function visit(name,width,{code='first-harvest',existing=false,fail=''}={}){
  scenario=name;targetCode=code;earned=new Set();opened=new Set();failure=fail;
  const target=definitions.find(row=>row[0]===code);for(const row of definitions){if(row[1]===target[1]&&row[2]<target[2]){earned.add(row[0]);opened.add(row[0]);}}if(existing)earned.add(code);
  await page.setViewport({width,height:844});await page.goto(origin+'/?scenario='+name,{waitUntil:'networkidle0'});await clickText('Tous mes défis');await page.waitForSelector('section[aria-label="Culture"]');
}
async function claimAndOpen(){
  const targetTrack=definitions.find(row=>row[0]===targetCode)[1];const label={culture:'Culture',online:'Vente en ligne',shops:'Boutiques partenaires'}[targetTrack];
  const selector=`section[aria-label="${label}"] button`;await page.waitForFunction(selector=>{const button=document.querySelector(selector);return button?.textContent.includes('Récupérer mon pack')&&!button.disabled},{},selector);
  // Same-task repeats test the immediate guards, before React can disable the buttons.
  await page.$eval(selector,button=>{button.click();button.click();});await page.waitForFunction(()=>{const button=document.querySelector('[data-mission-receipt] button');return button?.textContent.includes('Ouvrir mon pack')&&!button.disabled;});
  await page.$eval('[data-mission-receipt] button',button=>{button.click();button.click();});await page.waitForSelector(modal);
}
async function checkReveal(count){
  await page.waitForFunction(count=>document.querySelectorAll('[data-support-pack-reveal] article').length===count,{},count);
  assert(await page.$eval(modal,el=>el.contains(document.activeElement)),'Focus stays inside the native pack dialog');
  const geometry=await page.$eval(reveal,el=>{const buttons=[...el.querySelectorAll('button')];return buttons.map(button=>{const r=button.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});});
  assert(geometry.every(r=>r.w>=44&&r.h>=44&&r.x>=0&&r.x+r.w<=page.viewport().width+1&&r.y>=0&&r.y+r.h<=844),'Reveal actions are accessible');
  if(count===10){assert(await page.$eval(`${reveal} [aria-label="Les cartes de ton pack"]`,el=>{el.scrollLeft=el.scrollWidth;const last=el.lastElementChild.getBoundingClientRect(),frame=el.getBoundingClientRect();return last.right<=frame.right+1&&last.left>=frame.left;}),'The last card is reachable by scrolling');await page.$eval(`${reveal} [aria-label="Les cartes de ton pack"]`,el=>{el.scrollLeft=0;});}
}
try{
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',error=>report.errors.push({scenario,message:error.message}));await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setRequestInterception(true);
  page.on('request',async request=>{
    const url=new URL(request.url());if(url.protocol==='data:'||url.protocol==='blob:')return void request.continue();if(url.origin!==origin){report.remote.push(url.origin+url.pathname);return void request.abort();}if(!url.pathname.startsWith('/api/'))return void request.continue();
    const entry={scenario,method:request.method(),path:url.pathname,...(request.postData()?{body:JSON.parse(request.postData())}:{})};report.requests.push(entry);const respond=(status,body)=>request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
    if(entry.method==='GET'&&entry.path==='/api/account/missions')return void respond(200,{missions:[],pendingRewards:[]});
    if(entry.method==='GET'&&entry.path==='/api/arena/placard/missions')return void respond(200,snapshot());
    if(entry.method==='POST'&&entry.path==='/api/arena/placard/missions'){
      assert.deepEqual(entry.body,{code:targetCode});const replayed=earned.has(targetCode);earned.add(targetCode);await new Promise(done=>setTimeout(done,120));return void respond(200,{entitlementId:'fixture-'+targetCode,cardCount:definitions.find(row=>row[0]===targetCode)[4],replayed});
    }
    if(entry.method==='PATCH'&&entry.path==='/api/arena/placard/boosters'){
      assert.deepEqual(entry.body,{entitlementId:'fixture-'+targetCode});await new Promise(done=>setTimeout(done,120));if(failure){if(failure==='ambiguous')opened.add(targetCode);return void respond(503,{error:'Réponse locale interrompue. Réessaie.'});}opened.add(targetCode);return void respond(200,{cards:cards(definitions.find(row=>row[0]===targetCode)[4])});
    }
    report.unexpected.push(entry);return void respond(405,{error:'No unconfigured API or remote writes permitted.'});
  });
  for(const width of [390,1440]){
    for(const [code,count,destination] of [['first-harvest',3,'game'],['contest-flower',10,'game'],['online-two',3,'market']]){
      const name=code+'-'+width;await visit(name,width,{code});await claimAndOpen();await checkReveal(count);await shot(name);
      assert.equal(report.requests.filter(row=>row.scenario===name&&row.method==='POST').length,1);assert.equal(report.requests.filter(row=>row.scenario===name&&row.method==='PATCH').length,1);
      await page.click(`${reveal}>button:last-child`);await page.waitForSelector('[data-audit-destination]');assert.equal(new URL(page.url()).search,'?view='+destination);report.results.push({name,count,destination,doubleClickSafe:true});
    }
    await visit('older-pack-'+width,width,{existing:true});await clickText('pack de mission à ouvrir');await checkReveal(3);await page.click('[aria-label="Fermer le pack ouvert"]');await page.waitForSelector(modal,{hidden:true});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-pressed')),'true');assert.equal(await page.$$eval('footer button',buttons=>buttons.filter(b=>b.textContent.includes('pack de mission')).length),0);report.results.push({name:'older-pack-'+width,closeRestoresScroll:true,focusRestored:true});
  }
  await visit('retry',390,{fail:'retry'});await claimAndOpen();await page.waitForFunction(()=>document.querySelector('dialog[open] [role="alert"]')?.textContent.includes('interrompue'));failure='';await clickText('Réessayer l’ouverture',modal+' button');await checkReveal(3);assert.equal(report.requests.filter(row=>row.scenario==='retry'&&row.method==='PATCH').length,2);await shot('retry-390');await page.keyboard.press('Escape');await page.waitForSelector(modal,{hidden:true});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');report.results.push({name:'retry',escapeRestoresScroll:true});
  await visit('ambiguous',390,{fail:'ambiguous'});await claimAndOpen();await page.waitForFunction(()=>document.querySelector('dialog[open] [role="alert"]')?.textContent.includes('Ce pack a déjà été ouvert'));
  assert.equal(await page.$$eval('dialog[open] button',buttons=>buttons.filter(button=>button.textContent.includes('Réessayer')).length),0);assert.equal(report.requests.filter(row=>row.scenario==='ambiguous'&&row.method==='PATCH').length,1);await shot('ambiguous-390');await clickText('Retour aux missions',modal+' button');await page.waitForSelector(modal,{hidden:true});report.results.push({name:'ambiguous',duplicateOpeningPrevented:true});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpected,[]);assert.deepEqual(report.remote,[]);report.passed=true;
}catch(error){report.failure=error.stack;await shot('failure').catch(()=>undefined);process.exitCode=1;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();await server.close();}
