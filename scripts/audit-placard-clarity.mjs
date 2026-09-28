/** Local UI audit. Real lobby, shell, collection and progression; destination stubs isolate navigation. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/placard-clarity'), port=3224, origin=`http://127.0.0.1:${port}`, preview=process.argv.includes('--preview');
function fixturePayload(path,scenario){
 if(path==='/api/arena/placard/equipment')return {tentNumber:1,tents:[{tentNumber:1,equippedCodes:[],levels:{}}],productionUnits:scenario==='active'?4:1,ownedCodes:[],purchasedCodes:[],equippedCodes:[],cashCents:0,levels:{},reputation:0,activeRun:scenario==='active',readyLotCount:scenario==='lots'?2:0,availableFlowerCount:scenario==='jury'?1:0,routeMasteries:[],routePlan:null};
 if(path==='/api/arena/placard/collection')return {collection:{cards:[]}};
 return null;
}
const previewFetch=preview?`const fixturePayload=${fixturePayload.toString()};const nativeFetch=window.fetch.bind(window);let failed=false;window.fetch=async(input,init={})=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);const scenario=new URLSearchParams(location.search).get('scenario')||'starter';const method=init.method||(input instanceof Request?input.method:'GET');if(method!=='GET')return new Response(JSON.stringify({error:'Prévisualisation locale : lecture seule'}),{status:405,headers:{'Content-Type':'application/json'}});if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment'){failed=true;return new Response(JSON.stringify({error:'Essai local'}),{status:503,headers:{'Content-Type':'application/json'}});}const body=fixturePayload(url.pathname,scenario);return new Response(JSON.stringify(body||{error:'API non simulée'}),{status:body?200:404,headers:{'Content-Type':'application/json'}});};`:'';
const stub=(name,body)=>`import React from 'react';export function ${name}(props){return <section data-destination="${name}" style={{padding:24}}><p data-simulated-destination>Destination simulée · vérification de navigation uniquement.</p>${body}</section>}`;
const destinations={
 './KanabQuestDicePrototype':stub('KanabQuestDicePrototype','<h1>{props.viewMode === "arena" ? "Jury & duels" : "La culture"}</h1>'),
 './KqWarehouseEntry':stub('KqWarehouseEntry','<h1>Entrepôt</h1><p data-equipment>{props.initialEquipmentCode}</p><button onClick={()=>props.onOpenShop("LED-500")}>Acheter une lampe</button>'),
 './KqMarketDesk':stub('KqMarketDesk','<h1>Marché</h1>'),
 './KqTreasuryDesk':stub('KqTreasuryDesk','<h1>Le Bureau</h1><button onClick={props.onOpenMarket}>Aller au Marché</button>'),
 './KqSupportBoosterShop':stub('KqSupportBoosterShop','<h1>La Boutique</h1><p data-catalog>{props.autoOpenEquipment ? "Matériel" : "Packs"}</p><p data-equipment>{props.initialEquipmentCode}</p><button onClick={()=>props.onOpenWorkshop(props.initialEquipmentCode)}>Installer</button><button onClick={props.onExit}>Quitter la boutique</button><button onClick={props.onOpenCollection}>Ma collection</button>'),
 './KqMissionCenter':stub('KqMissionCenter','<h1>Missions</h1><button onClick={()=>props.onOpen("shop")}>Mes packs</button>'),
};
const modules={
 'entry':`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';${previewFetch}createRoot(document.getElementById('root')).render(<>${preview?'<p role="note" style={{margin:0,padding:"8px 16px",background:"#fffaf1",color:"#003f30",fontSize:12}}>Prévisualisation locale du menu · données de démonstration. Les destinations sont simulées.</p>':''}<PlacardPlayerShell/></>);`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
 'next/navigation':`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});`,
 'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
 ...Object.fromEntries(Object.entries(destinations).map(([key,value])=>['destination:'+key,value])),
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}button{cursor:pointer}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'placard-clarity',enforce:'pre',resolveId(id,importer){if(importer?.replaceAll('\\','/').endsWith('/PlacardPlayerShell.tsx')&&id in destinations)return '\0destination:'+id;if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/','/arene/placard'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard — vérification locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser,scenario='starter',failed=false;
const errors=[],requests=[],results=[];
if(preview){
 await mkdir(output,{recursive:true});await server.listen();
 console.log(`Prévisualisation locale du menu · données de démonstration et destinations simulées : ${origin}/arene/placard?scenario=starter`);
}else try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>{errors.push(e.message);});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',r=>{
  const url=new URL(r.url());if(url.protocol==='data:')return void r.continue();
  if(url.origin!==origin)return void r.abort();if(!url.pathname.startsWith('/api/'))return void r.continue();
  requests.push({path:url.pathname,method:r.method()});
  const send=(body,status=200)=>void r.respond({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/arena/placard/equipment'){
   if(scenario==='error'&&!failed){failed=true;return send({error:'Essai local'},503);}
   return send(fixturePayload(url.pathname,scenario));
  }
  if(url.pathname==='/api/arena/placard/collection')return send(fixturePayload(url.pathname,scenario));
  return send({error:'Unexpected local API'},404);
 });
 const visit=async(state='starter',query='')=>{scenario=state;failed=false;await page.goto(origin+'/arene/placard?scenario='+state+(query?'&'+query:''),{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
 const view=async value=>{await page.waitForSelector(`[data-placard-view="${value}"]`);if(value!=="hub")await page.waitForSelector(`[data-placard-view="${value}"] [data-destination]`);};
 const clickText=async text=>{const button=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text&&el.checkVisibility()),{},text);await button.asElement().click();await button.dispose();};
 const measure=()=>page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,primary:[...document.querySelectorAll('[data-placard-activity]')].map(el=>({id:el.dataset.placardActivity,text:el.innerText,background:getComputedStyle(el).backgroundColor})),visibleControls:[...document.querySelectorAll('button,a,summary')].filter(el=>el.checkVisibility()).length,brokenImages:[...document.images].filter(el=>el.complete&&!el.naturalWidth).map(el=>el.src)}));
 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
  for(const state of ['starter','active','jury','lots']){
   await visit(state);await view('hub');await page.mouse.move(0,0);
   assert.equal(await page.$$eval('dialog[open]',els=>els.length),0);
   const m=await measure();assert.equal(m.overflow,false);assert.deepEqual(m.brokenImages,[]);assert.deepEqual(m.primary.map(x=>x.id),['game','workshop','market','treasury','arena','collection']);assert.equal(m.visibleControls,9);
   assert(m.primary.every(x=>x.background==='rgb(244, 196, 61)'),'All six activity cards share the yellow background');
   assert.deepEqual(await page.$$eval('[aria-label="Missions du Placard"] button',els=>els.map(el=>el.textContent.trim())),['Missions']);
   assert.equal(await page.$('[aria-label="Activités du Placard"] [aria-label="Missions du Placard"]'),null);
   if(state==='active'){assert(m.primary[0].text.includes('Reprendre ma culture'));assert(m.primary[1].text.includes('4 tentes'));}
   if(state==='lots')assert(m.primary[2].text.includes('2 lots prêts'));
   if(state==='jury')assert(m.primary.find(x=>x.id==='arena').text.includes('1 Fleur disponible'));
   await page.screenshot({path:resolve(output,`lobby-${state}-${width}.png`),fullPage:true});results.push({state,...m});
  }
  for(const target of ['game','workshop','market','treasury','arena']){
   await visit();await page.click(`[data-placard-activity="${target}"]`);await view(target);assert.equal(new URL(page.url()).searchParams.get('view'),target);
   await page.goBack();await view('hub');await page.goForward();await view(target);
  }
  await visit();await page.click('[data-placard-activity="collection"]');await page.waitForSelector('dialog[open]');
  assert.equal(await page.$eval('dialog[open]',el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:resolve(output,`collection-${width}.png`),fullPage:true});
  await page.click('dialog footer button');await view('shop');assert.equal(await page.$eval('[data-catalog]',el=>el.textContent),'Packs');assert.equal(await page.$('dialog[open]'),null);
  await clickText('Quitter la boutique');await view('hub');
  await page.click('summary');assert.equal(await page.$eval('details',el=>el.open),true);assert.equal((await measure()).overflow,false);await page.screenshot({path:resolve(output,`help-${width}.png`),fullPage:true});
 }
 await visit('starter','guide=1');await page.click('[data-placard-activity="workshop"]');await view('workshop');await clickText('Acheter une lampe');await view('shop');
 assert.equal(new URL(page.url()).searchParams.get('guide'),'1');assert.equal(new URL(page.url()).searchParams.get('catalog'),'equipment');assert.equal(await page.$eval('[data-equipment]',el=>el.textContent),'LED-500');
 await page.goBack();await view('workshop');await page.goForward();await view('shop');await clickText('Installer');await view('workshop');assert.equal(await page.$eval('[data-equipment]',el=>el.textContent),'LED-500');
 await visit('starter','view=shop&catalog=equipment&equipment=LED-500&from=workshop');await view('shop');assert.equal(await page.$eval('[data-catalog]',el=>el.textContent),'Matériel');await clickText('Quitter la boutique');await view('workshop');
 await visit('starter','view=missions');await view('missions');await page.click('details > summary');await page.waitForSelector('[data-placard-dashboard]');await page.waitForSelector('[aria-label="Prochain investissement"]');assert.equal(await page.$('[aria-label="Vues du tableau de bord"]'),null);await page.screenshot({path:resolve(output,'progression.png'),fullPage:true});
 await visit('error');await page.waitForSelector('[data-placard-lobby] [role="status"]');await clickText('Réessayer');await page.waitForSelector('[data-placard-lobby] [role="status"]',{hidden:true});
 await visit('starter','view=unknown');await view('hub');
 assert(requests.every(r=>r.method==='GET'));assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,scope:'Real lobby, shell, collection, progression; other destinations stubbed for navigation only',results,sixYellowCards:true,missionsOnlySecondary:true,directTreasuryAndArena:true,browserHistory:true,equipmentDeepLinks:true,collectionToShop:true,helpOnDemand:true,progressionOnDemand:true,retry:true,readOnly:true,requests,errors},null,2));
 console.log(JSON.stringify({passed:true,viewports:4,states:4,browserHistory:true,errors,output}));
}finally{await browser?.close();await server.close();}
