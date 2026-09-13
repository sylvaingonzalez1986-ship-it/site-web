// Real shop components and CSS; synthetic purchases only, remote requests blocked.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
const root=process.cwd(), output=resolve(root,"output/placard-shop");
const modules={
  "shop-audit-entry": `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqSupportBoosterShop} from '/src/components/placard/KqSupportBoosterShop';
import {KQ_EQUIPMENT_CATALOG,KQ_STARTING_EQUIPMENT_CODES} from '/src/lib/kanab-quest-equipment';
const query=new URLSearchParams(location.search);
const entitlement=(id,source)=>({id,source,cardCount:10,createdAt:'2026-09-13'});
const shop={collectionActive:!query.has('closed'),costPerPack:5,spendablePoints:query.has('poor')?0:1147,welcomeClaimed:true,
availableEntitlements:query.has('empty')?[]:[entitlement('duel','pvp_win'),entitlement('mission','mission_reward')]};
const equipment={cashCents:500000,reputation:312,ownedCodes:[...KQ_STARTING_EQUIPMENT_CODES],equippedCodes:[...KQ_STARTING_EQUIPMENT_CODES],purchasedCodes:[],levels:{},routePlan:null,catalog:KQ_EQUIPMENT_CATALOG};
window.__calls=[];window.__fail=false;const original=window.fetch.bind(window);
window.fetch=async(url,init={})=>{
 if(!String(url).startsWith('/api/'))return original(url,init);
 const body=init.body?JSON.parse(init.body):{};const method=init.method||'GET';
 if(method!=='GET'){window.__calls.push({url,method,body});await new Promise(r=>setTimeout(r,180));}
 if(window.__fail){window.__fail=false;return new Response(JSON.stringify({error:'La caisse est momentanément indisponible.'}),{status:503});}
 let payload={};
 if(url.includes('/boosters')){
  if(method==='POST'){shop.spendablePoints-=5;shop.availableEntitlements.push(entitlement('purchase-'+window.__calls.length,'points_purchase'));}
  if(method==='PATCH'){shop.availableEntitlements=shop.availableEntitlements.filter(e=>e.id!==body.entitlementId);payload={cards:[{code:'BOTTE-013',name:'Voile d’ombrage',rarity:'commune'},{code:'BOTTE-020',name:'Nettoyage du placard',rarity:'rare'}]};}
  if(method==='GET')payload=shop;
 }else if(url.includes('/equipment')){
  if(method==='POST'){const total=body.equipmentCodes.reduce((n,c)=>n+equipment.catalog.find(e=>e.code===c).priceCents,0);equipment.cashCents-=total;equipment.ownedCodes.push(...body.equipmentCodes);equipment.purchasedCodes.push(...body.equipmentCodes);payload={equipmentCodes:body.equipmentCodes,totalPriceCents:total,cashAfterCents:equipment.cashCents};}
  if(method==='PATCH'&&body.equipmentCode){equipment.equippedCodes.push(body.equipmentCode);}
  if(method==='GET')payload=equipment;
 }else if(url.includes('/commerce'))payload={computerOwned:true,cashCents:equipment.cashCents};
 return new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}});
};
createRoot(document.getElementById('root')).render(React.createElement(KqSupportBoosterShop,{autoOpen:true}));`,
  "next/image": `import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,"vite-cache"),publicDir:resolve(root,"public"),
  optimizeDeps:{include:["react","react-dom/client","lucide-react"]},esbuild:{jsx:"automatic",loader:"tsx"},resolve:{alias:{"@":resolve(root,"src")}},css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:"shop-audit",enforce:"pre",resolveId(id){if(id in modules)return "\0"+id;},load(id){if(id.startsWith("\0"))return modules[id.slice(1)];},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=="/")return next();res.setHeader("Content-Type","text/html");res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-sans:Arial}body{margin:0;background:#0b252b}</style><div id="root"></div><script type="module" src="/@id/__x00__shop-audit-entry"></script></html>');});}}],
  server:{host:"127.0.0.1",port:3205,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:["--no-sandbox","--disable-gpu"]});
 const page=await browser.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:3205')||r.url().startsWith('data:'))void r.continue();else void r.abort();});
 const selector=(label)=>`button[aria-label="${label}"]`;
 const visit=async(query='')=>{await page.goto('http://127.0.0.1:3205/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector(selector('Ouvrir le rayon matériel'));};
 const clickText=async(text)=>{const button=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&!b.closest('[inert]')),text);assert.ok(button.asElement(),text);await button.asElement().click();};
 const screenshot=async(name)=>{await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:resolve(output,name+'.png')});};
 for(const [width,height]of [[320,740],[390,844],[768,1024],[1440,1000],[844,390]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await visit();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const bounds=await page.$$eval('[class*="hotspot"]',els=>els.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,visible:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1};}));
  assert.equal(bounds.length,4);assert.ok(bounds.every(b=>b.visible&&b.width>=44&&b.height>=44));
  await screenshot(`counter-${width}`);
  await page.click('button[aria-label^="Acheter un booster"]');await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('ajouté'));
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.method==='POST').length),1);
  await page.click('button[aria-label^="Ouvrir un pack,"]');await page.waitForSelector(selector('Fermer le pack ouvert'));await page.keyboard.press('Escape');
  await page.click(selector('Ouvrir le rayon matériel'));await page.waitForSelector('[aria-labelledby="equipment-catalog-title"]');await screenshot(`equipment-${width}`);
  assert.equal(await page.$eval('#equipment-filters',e=>getComputedStyle(e).display),'none');
  await clickText('Chercher et filtrer');await page.type('#equipment-filters input','Tente');
  await page.waitForFunction(()=>[...document.querySelectorAll('main article')].every(e=>e.textContent.includes('Tente')));
  await page.$eval('#equipment-filters input',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));});
  await clickText('Ranger les filtres');
  await clickText('Vente en ligne');await page.waitForSelector('[aria-label="Matériel de vente en ligne"]');await screenshot(`computer-${width}`);
  await clickText('Tout le matériel');
  const add=await page.evaluateHandle(()=>[...document.querySelectorAll('main article footer button')].find(b=>!b.disabled));await add.asElement().click();
  await page.click('button[aria-label^="Ouvrir le panier,"]');await page.waitForFunction(()=>document.querySelector('[aria-label="Panier matériel"]')?.getAttribute('data-open')==='true');
  assert.equal(await page.$eval('[aria-labelledby="equipment-catalog-title"]',e=>e.scrollLeft),0,'The sliding cart must not shift the scene');
  await screenshot(`cart-${width}`);await clickText('Valider le panier');await page.waitForSelector('[aria-labelledby="checkout-title"]');
  await clickText('Confirmer l’achat');await page.waitForSelector('[aria-labelledby="equipment-purchase-title"]');
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.url.includes('equipment')&&c.method==='POST').length),1);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForSelector('[aria-labelledby="equipment-catalog-title"]',{hidden:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  results.push({width,height,targets:bounds,purchase:true,pack:true,equipment:true});
 }
 await page.setViewport({width:390,height:844});await visit('poor&empty');assert.equal(await page.$eval('button[aria-label^="Acheter un booster"]',b=>b.disabled),true);assert.equal(await page.$eval(selector('Aucun pack disponible'),b=>b.disabled),true);
 await visit();await page.evaluate(()=>window.__fail=true);await page.click('button[aria-label^="Acheter un booster"]');await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('indisponible'));await screenshot('purchase-error');
 await visit('closed');assert.equal(await page.$eval('button[aria-label^="Acheter un booster"]',b=>b.disabled),true);await page.click(selector('Ouvrir le rayon matériel'));await page.waitForSelector('[aria-labelledby="equipment-catalog-title"]');
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors,insufficientPoints:true,emptyPacks:true,failedPurchase:true,closedCollection:true},null,2));console.log(JSON.stringify({viewports:results.length,purchases:true,errors}));
}finally{await browser?.close();await server.close();}
