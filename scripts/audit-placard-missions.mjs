/** Isolated real UI with synthetic lots: no credentials, no production writes. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(), output=resolve(root,'output/placard-missions');
const modules={
 'workshop-entry': `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
 import {KqMissionCenter} from '/src/components/placard/KqMissionCenter';import retro from '/src/components/contest/ArenaRetro.module.css';
 import {KqPlacardLobby} from '/src/components/placard/KqPlacardLobby';
 const scenario=new URLSearchParams(location.search).get('scenario');
 const definitions=[['first-harvest','culture',1,1,3,'harvests'],['three-varieties','culture',2,3,3,'varieties'],['contest-flower','culture',3,1,10,'contest'],['online-two','online',1,2,3,'clients'],['online-five','online',2,5,3,'clients'],['online-ten','online',3,10,10,'clients'],['shop-one','shops',1,1,3,'shops'],['shop-three','shops',2,3,3,'shops'],['shop-six','shops',3,6,10,'shops']];
 window.__counts={harvests:1,varieties:3,contest:1,clients:2,shops:1};window.__claims=[];window.__fail=scenario==='error';
 const earned=new Map(scenario==='complete'?definitions.map(d=>[d[0],'pack-'+d[0]]):[]);
 const state=()=>({collectionActive:scenario!=='inactive',missions:definitions.map(([code,track,step,target,cardCount,metric])=>{const previous=definitions.find(d=>d[1]===track&&d[2]===step-1);const claimed=earned.has(code),unlocked=!previous||earned.has(previous[0]);return {code,track,step,target,cardCount,claimed,unlocked,claimable:!claimed&&unlocked&&window.__counts[metric]>=target,progress:claimed?target:Math.min(target,window.__counts[metric]),entitlementId:earned.get(code)??null,packAvailable:claimed};})});
 const nativeFetch=window.fetch.bind(window);window.fetch=async(url,init={})=>{
  if(String(url)!=='/api/arena/placard/missions')return nativeFetch(url,init);
  if(scenario==='guest')return new Response(JSON.stringify({error:'Connecte-toi pour retrouver tes missions.'}),{status:401});
  if(window.__fail)return new Response(JSON.stringify({error:'Le centre de missions est momentanément indisponible.'}),{status:503});
  if(init.method!=='POST')return new Response(JSON.stringify(state()));
  const {code}=JSON.parse(init.body);window.__claims.push(code);await new Promise(resolve=>setTimeout(resolve,120));
  const mission=state().missions.find(m=>m.code===code),replayed=earned.has(code);
  if(!replayed&&!mission?.claimable)return new Response(JSON.stringify({error:'Objectif incomplet'}),{status:409});
  earned.set(code,'pack-'+code);return new Response(JSON.stringify({entitlementId:earned.get(code),cardCount:mission.cardCount,replayed}));
 };
 const onOpen=view=>{window.__destination=view;};createRoot(document.getElementById('root')).render(React.createElement('div',{className:retro.surface+' '+retro.shell},scenario==='lobby'?React.createElement(KqPlacardLobby,{onOpen,onOpenEquipment:()=>{}}):React.createElement(KqMissionCenter,{onOpen})));`,
 '@/components/navigation/NavigationLink': `import React from 'react';export default function Link(props){return React.createElement('a',props);}`,
 'mission-hud': `export function KqPlacardHud(){return null;}`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,{loading:Loading}){const Component=React.lazy(async()=>({default:await loader()}));return props=>React.createElement(React.Suspense,{fallback:React.createElement(Loading)},React.createElement(Component,props));}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server=await createServer({root,cacheDir:resolve(output,"vite-cache"),optimizeDeps:{include:["react","react-dom/client","lucide-react"]},configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'workshop-audit',enforce:'pre',resolveId(id){if(id.endsWith('/components/navigation/NavigationLink'))return '\0@/components/navigation/NavigationLink';if(id.endsWith('/KqPlacardHud')||id==='./KqPlacardHud')return '\0mission-hud';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard · Atelier</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__workshop-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3201,strictPort:true,hmr:false,watch:null}});
let browser;
try {
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3201'))void r.continue();else void r.abort();});
 const goto=async(scenario='ready')=>{await page.goto('http://127.0.0.1:3201/?scenario='+scenario,{waitUntil:'networkidle0'});};
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const shot=async(name)=>{await page.evaluate(async()=>{await Promise.allSettled([...document.images].map(img=>img.decode()));});await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
 for(const width of [320,390,768,1440]) {
  await page.setViewport({width,height:900});await goto();await page.waitForSelector('section[aria-label="Culture"]');
  await overflow();assert.equal(await page.$$('progress').then(e=>e.length),3);
  await shot('missions-'+width);
 }
 await page.setViewport({width:390,height:844});
 await page.click('section[aria-label="Culture"] button');
 await page.waitForFunction(()=>document.body.innerText.includes('Bravo ! Un pack de 3 cartes gagné.'));
 assert.deepEqual(await page.evaluate(()=>window.__claims),['first-harvest']);
 await page.waitForFunction(()=>document.querySelector('section[aria-label="Culture"] h2').textContent.includes('Le goût'));
 await page.click('section[aria-label="Culture"] button');
 await page.waitForFunction(()=>document.querySelector('section[aria-label="Culture"] h2').textContent.includes('concours'));
 await page.click('section[aria-label="Culture"] button');
 await page.waitForFunction(()=>document.body.innerText.includes('Bravo ! Un pack de 10 cartes gagné.'));
 await page.waitForFunction(()=>document.querySelector('section[aria-label="Culture"]').textContent.includes('Parcours terminé'));
 await shot('claimed-390');
 await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.includes('Ouvrir la boutique')).click());
 assert.equal(await page.evaluate(()=>window.__destination),'shop');
 await page.evaluate(()=>{window.__counts.clients=1;});
 await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.includes('Actualiser')).click());
 await page.waitForFunction(()=>document.querySelector('section[aria-label="Vente en ligne"] button').textContent.includes('Vendre en ligne'));
 await page.click('section[aria-label="Vente en ligne"] button');assert.equal(await page.evaluate(()=>window.__destination),'market');
 for(const scenario of ['guest','error','inactive','complete','lobby']) {
  await goto(scenario);await overflow();await shot(scenario+'-390');
  if(scenario==='guest')assert(await page.$('a[href*="connexion"]'));
  if(scenario==='error'){
   await page.evaluate(()=>{window.__fail=false;});await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.includes('Réessayer')).click());
   await page.waitForSelector('section[aria-label="Culture"]');
  }
  if(scenario==='inactive')assert.equal(await page.$$eval('section button',buttons=>buttons.every(b=>b.disabled)),true);
  if(scenario==='complete')assert.equal(await page.$$eval('h2',els=>els.filter(el=>el.textContent.includes('Parcours terminé')).length),3);
  if(scenario==='lobby'){
   await page.$$eval('nav[aria-label="Activités du Placard"] button',buttons=>buttons.find(b=>b.textContent.includes('Missions')).click());
   await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.includes('Voir mes missions')).click());
   assert.equal(await page.evaluate(()=>window.__destination),'missions');
  }
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,widths:[320,390,768,1440],states:['ready','claimed','guest','error-recovery','inactive','complete','lobby'],claims:[3,3,10],audienceRegression:true,errors},null,2));
 console.log('Missions UI passed: four widths, three sequential claims, 3/10 cards, audience regression, guest/retry/inactive/completed states and lobby navigation.');
} finally {await browser?.close();await server.close();}
