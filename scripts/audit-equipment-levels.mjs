// Real React components, synthetic wallet: never writes to Supabase.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
const root = process.cwd(), output = resolve(root, "output/equipment-levels");
const modules = {
  "equipment-levels-entry": `
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {KqEquipmentCatalogModal} from '/src/components/placard/KqEquipmentCatalogModal';
    import {KqEquipmentInventoryModal} from '/src/components/placard/KqEquipmentInventoryModal';
    import {KQ_EQUIPMENT_CATALOG,getKqEquipmentAtLevel,getKqEquipmentUpgradeCost} from '/src/lib/kanab-quest-equipment';
    const query = new URLSearchParams(location.search), level = Number(query.get('level') || 4);
    const codes = KQ_EQUIPMENT_CATALOG.filter(e=>e.purchasable).map(e=>e.code);
    let snapshot = {cashCents:query.has('poor')?0:99999999, reputation:100, ownedCodes:codes, purchasedCodes:codes,
      equippedCodes:codes, levels:Object.fromEntries(codes.map(c=>[c,level])), routePlan:null, activeRun:false};
    const getSnapshot=()=>({...snapshot,catalog:codes.map(code=>getKqEquipmentAtLevel(code,snapshot.levels[code]))});
    const originalFetch=window.fetch.bind(window);window.__upgrades=[];window.__fail=false;
    window.fetch=async(url,init={})=>{
      if(url!='/api/arena/placard/equipment')return originalFetch(url,init);
      if(init.method==='PATCH'){
        const body=JSON.parse(init.body);window.__upgrades.push(body);
        await new Promise(r=>setTimeout(r,150));
        if(window.__fail){window.__fail=false;return new Response(JSON.stringify({error:'Incident réseau de test.'}),{status:503});}
        if(body.action==='upgrade'){
          if(snapshot.levels[body.equipmentCode]!==body.expectedLevel)return new Response(JSON.stringify({error:'Niveau périmé'}),{status:409});
          snapshot.cashCents-=getKqEquipmentUpgradeCost(body.equipmentCode,body.expectedLevel);
          snapshot.levels={...snapshot.levels,[body.equipmentCode]:body.expectedLevel+1};
          return new Response(JSON.stringify({level:body.expectedLevel+1}));
        }
        return new Response('{}');
      }
      return new Response(JSON.stringify(getSnapshot()));
    };
    function App(){const [state,setState]=useState(getSnapshot());return query.get('view')==='inventory'
      ? React.createElement(KqEquipmentInventoryModal,{...state,loading:false,loadError:'',onClose:()=>{},onOpenShop:()=>{},onRetry:()=>setState(getSnapshot())})
      : React.createElement(KqEquipmentCatalogModal,{initialEquipmentCode:'TENT-120',onClose:()=>{}});}
    createRoot(document.getElementById('root')).render(React.createElement(App));
  `,
  "next/image": `import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
};
const server = await createServer({ root, configFile:false, envDir:false, cacheDir:resolve(output,"vite-cache"),
  publicDir:resolve(root,"public"), optimizeDeps:{include:["react","react-dom/client","lucide-react"]},
  esbuild:{jsx:"automatic",loader:"tsx"}, resolve:{alias:{"@":resolve(root,"src")}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:"equipment-audit",enforce:"pre",resolveId(id){if(id in modules)return "\0"+id;},
    load(id){if(id.startsWith("\0"))return modules[id.slice(1)];},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split("?")[0]!=="/")return next();
      res.setHeader("Content-Type","text/html");res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-sans:Arial}body{margin:0;background:#0b252b}#root{height:100dvh;position:relative}</style><div id="root"></div><script type="module" src="/@id/__x00__equipment-levels-entry"></script></html>');});}}],
  server:{host:"127.0.0.1",port:3198,strictPort:true,hmr:false,watch:null},
});
let browser;
const errors=[],results=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,"chrome-profile"),args:["--no-sandbox","--disable-gpu"]});
  const page=await browser.newPage();page.on("pageerror",e=>{errors.push(e.message);console.error(e.message);});
  await page.setRequestInterception(true);
  page.on("request",r=>{if(r.url().startsWith("http://127.0.0.1:3198")||r.url().startsWith("data:"))void r.continue();else void r.abort();});
  const panel='section[aria-label^="Niveau de"]';
  const visit=async(query)=>{await page.goto("http://127.0.0.1:3198/?"+query,{waitUntil:"networkidle0"});await page.waitForSelector(panel);};
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
    for(const view of ["catalog","inventory"]){
      await visit(`view=${view}&level=4`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      assert.deepEqual(await page.$$eval('img',imgs=>imgs.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)),[]);
      const button=await page.$(panel+' button');await button.evaluate(el=>el.scrollIntoView({block:'center'}));
      await button.click();await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('data-tier')==='5',{},panel);
      assert.equal(await page.evaluate(()=>window.__upgrades.length),1);
      assert.equal(await page.evaluate(()=>window.__upgrades[0].expectedLevel),4);
      await page.screenshot({path:resolve(output,`${view}-${width}-level5.png`)});
      results.push({width,view,upgrade:"4→5",overflow:false});
    }
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await visit('level=9');await page.$eval(panel+' button',el=>el.click());
  await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('data-tier')==='10',{},panel);
  assert.equal(await page.$(panel+' button'),null);
  await page.screenshot({path:resolve(output,'catalog-390-level10.png')});
  await visit('level=1&poor');assert.equal(await page.$eval(panel+' button',el=>el.disabled),true);
  await visit('level=4');await page.evaluate(()=>{window.__fail=true;});await page.$eval(panel+' button',el=>el.click());
  await page.waitForSelector(panel+' [role="alert"]');assert.equal(await page.$eval(panel,el=>el.getAttribute('data-tier')),'1');
  await page.$eval(panel+' button',el=>el.click());await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('data-tier')==='5',{},panel);
  assert.equal(await page.evaluate(()=>window.__upgrades[0].requestKey===window.__upgrades[1].requestKey),true);
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors,maximumLevel:true,insufficientCash:true,retry:true},null,2));
  console.log(JSON.stringify({views:results.length,maximumLevel:true,insufficientCash:true,retry:true,errors}));
} finally {await browser?.close();await server.close();}
