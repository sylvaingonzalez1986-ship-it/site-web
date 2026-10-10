// Real warehouse scene with local React state. No account or external API calls.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, process.env.DRYING_ROOM_AUDIT_OUTPUT || 'output/placard-drying-room');
const port = Number(process.env.DRYING_ROOM_AUDIT_PORT || 3259);
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'next/image': `import React from 'react';
    export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}) {
      return <img {...props} src={typeof src === 'string' ? src : src.src}
        style={{...(fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : {}),...props.style}}/>;
    }`,
  'drying-room-fixture': `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {KqWarehouseScene} from '/src/components/placard/KqWarehouseScene';
    import {isKqSharedEquipment} from '/src/lib/kanab-quest-equipment';
    const query = new URLSearchParams(location.search);
    const count = Number(query.get('units') || 2);
    const all = ['TENT-120','LED-300','AIR-EC6','CLIMATE-SMART','SIFT-TRAY','WASHER-25L',
      'AUTO-SIEVE','STATIC-PLASMA','PRESS-0600','FREEZE-DRYER','SOLAR-BACKUP','SECURITY-DOG'];
    const shared = query.has('full') ? all.filter(isKqSharedEquipment) : ['FREEZE-DRYER'];
    const sharedEquipment = {equippedCodes:shared,levels:Object.fromEntries(shared.map(code=>[code,1]))};
    const base = query.has('full') ? all.filter(code=>!isKqSharedEquipment(code))
      : ['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];
    function App() {
      const [tents,setTents] = useState(()=>Array.from({length:count},(_,index)=>({
        tentNumber:index+1,ownedCodes:[...base],equippedCodes:[...base],levels:{'DRYING-ROOM':1},
      })));
      const [selectedTentNumber,setSelectedTentNumber] = useState(1);
      const [selectedSlot,setSelectedSlot] = useState('flower-drying');
      const selected = tents.find(tent=>tent.tentNumber===selectedTentNumber);
      const change = patch => setTents(current=>current.map(tent=>
        tent.tentNumber===selectedTentNumber ? {...tent,...patch(tent)} : tent));
      window.__fixture = {tents,selectedTentNumber,selectedSlot};
      return <main>
        <header className="fixture-controls">
          <span>Démonstration locale · aucun compte</span>
          <button data-fixture="own" onClick={()=>change(tent=>({ownedCodes:[...new Set([...tent.ownedCodes,'DRYING-ROOM'])]}))}>Mettre en réserve</button>
          <button data-fixture="install" disabled={!selected.ownedCodes.includes('DRYING-ROOM')}
            onClick={()=>change(tent=>({equippedCodes:[...new Set([...tent.equippedCodes,'DRYING-ROOM'])]}))}>Installer</button>
          <button data-fixture="upgrade" onClick={()=>change(tent=>({levels:{...tent.levels,'DRYING-ROOM':5}}))}>Niveau 5</button>
          <output data-fixture="status">Tente {selectedTentNumber} · {selectedSlot}</output>
        </header>
        <KqWarehouseScene tents={tents} selectedTentNumber={selectedTentNumber}
          equippedCodes={selected.equippedCodes} levels={selected.levels} sharedEquipment={sharedEquipment}
          selectedSlot={selectedSlot} onSelect={(number,slot)=>{setSelectedTentNumber(number);setSelectedSlot(slot);}}/>
      </main>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `,
};

const server = await createServer({
  root, configFile:false, envDir:false, cacheDir:resolve(output,'vite-cache'), publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom/client','lucide-react']},
  resolve:{alias:{'@':resolve(root,'src')}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{
    name:'drying-room-audit', enforce:'pre',
    resolveId(id) {
      if (id in modules) return '\0'+id;
      const match = id.replaceAll('\\','/').match(/public\/placard\/(warehouse-v\d+\/manifest\.json)$/);
      if (match) return '\0warehouse-manifest:'+match[1].replace(/\.json$/,'');
    },
    async load(id) {
      if (id.startsWith('\0warehouse-manifest:')) {
        return `export default ${await readFile(resolve(root,'public/placard',id.slice('\0warehouse-manifest:'.length)+'.json'),'utf8')};`;
      }
      if (id.startsWith('\0') && modules[id.slice(1)]) {
        return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;
      }
    },
    configureServer(vite) {
      vite.middlewares.use((req,res,next)=>{
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type','text/html');
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Contrôle local du séchoir</title><style>
          :root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#123f38;font-family:Arial}
          main{max-width:1150px;margin:0 auto}.fixture-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px;background:#f4e9cc;color:#143c32;font-size:12px}
          .fixture-controls button{padding:8px;border:1px solid #235546;border-radius:4px}.fixture-controls button:disabled{opacity:.45}
          </style><div id="root"></div><script type="module" src="/@id/__x00__drying-room-fixture"></script></html>`);
      });
    },
  }],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});

const dryer = '[data-warehouse-slot="flower-drying"]';
const booth = `${dryer} img[src="/placard/warehouse-v3/flower-drying-room.webp"]`;
const freezeDryer = '[data-warehouse-slot="drying"][data-warehouse-scope="shared"]';
const tent = number => `[data-warehouse-slot="tent"][data-tent-number="${number}"]`;
const errors = [], failedImages = [], runs = [];
let browser;
try {
  await mkdir(output,{recursive:true});
  await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.request().resourceType()==='image'&&response.status()>=400)failedImages.push({url:response.url(),status:response.status()});});
  await page.setRequestInterception(true);
  page.on('request',request=>void(request.url().startsWith(origin+'/')||request.url().startsWith('data:')?request.continue():request.abort()));

  const settle = ()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const decode = async()=>{
    const images = await page.evaluate(async()=>{
      await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
      return [...document.images].filter(image=>!image.complete||!image.naturalWidth).map(image=>image.src);
    });
    assert.deepEqual(images,[],'Every warehouse asset loads');
  };
  const screenshot = async name=>{await decode();await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  const selectTent = async number=>{
    const button = await page.$(tent(number));
    assert.ok(button,`Tent ${number} exists`);
    await button.evaluate(element=>element.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
    await button.click();
    await page.waitForFunction(number=>window.__fixture.selectedTentNumber===number,{},number);
    await settle();
  };
  const install = async()=>{
    await page.click('[data-fixture="own"]');
    await page.click('[data-fixture="install"]');
    await page.waitForSelector(booth);
    await decode();
  };
  const checkBooth = async(number,level)=>{
    assert.equal(await page.$eval(dryer,element=>element.dataset.installed),'true');
    assert.equal(await page.$eval(dryer,element=>Number(element.dataset.tentNumber)),number);
    assert.equal((await page.$$(booth)).length,1,'Exactly one complete selected-tent dryer appears');
    const flowers = level>=5?'flower-drying-full.webp':'flower-drying.webp';
    assert.ok(await page.$(`${dryer} img[src="/placard/warehouse-v2/${flowers}"]`),`Correct flower density at level ${level}`);
    assert.equal((await page.$$(`${dryer} img`)).length,2,'Installed dryer includes its enclosure and flowers');
    const geometry = await page.$eval(dryer,(element,number)=>{
      const box=element.getBoundingClientRect();
      const room=element.closest('[data-warehouse-bay]').getBoundingClientRect();
      const grow=document.querySelector('[data-warehouse-slot="tent"][data-tent-number="'+number+'"]').getBoundingClientRect();
      const children=[...element.querySelectorAll('img')].map(image=>{const r=image.getBoundingClientRect();return {left:r.left-box.left,top:r.top-box.top,right:r.right-box.left,bottom:r.bottom-box.top};});
      return {width:box.width,height:box.height,bottom:box.bottom-room.top,tentBottom:grow.bottom-room.top,
        insideRoom:box.left>=room.left-1&&box.right<=room.right+1&&box.top>=room.top-1&&box.bottom<=room.bottom+1,children};
    },number);
    assert.ok(geometry.insideRoom,'Complete dryer stays within its warehouse');
    assert.ok(Math.abs(geometry.bottom-geometry.tentBottom)<1.5,'Dryer stands on the same rear floor as the tents');
    for(const child of geometry.children)assert.ok(child.left>=-1&&child.top>=-1&&child.right<=geometry.width+1&&child.bottom<=geometry.height+1,'Dryer artwork stays inside its hit target');
    assert.equal((await page.$$(freezeDryer)).length,1,'The shared freeze dryer remains installed independently');
    await page.$eval(dryer,element=>element.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
    const hit = await page.$eval(dryer,element=>{
      const r=element.getBoundingClientRect();
      return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('[data-warehouse-slot]')?.dataset.warehouseSlot;
    });
    assert.equal(hit,'flower-drying','Dryer remains independently clickable');
    await page.click(dryer);
    await page.waitForFunction(()=>window.__fixture.selectedSlot==='flower-drying');
    return geometry;
  };

  for(const width of [390,1440]) {
    await page.setViewport({width,height:width===390?844:1000,isMobile:width===390,hasTouch:width===390});
    for(const units of [2,8]) {
      await page.goto(`${origin}/?units=${units}${units===8?'&full':''}`,{waitUntil:'networkidle0'});
      await page.waitForSelector(tent(1));
      await decode();
      assert.equal((await page.$$(booth)).length,0,'Unowned dryer has no enclosure');
      assert.equal(await page.$eval(dryer,element=>element.dataset.installed),'false');
      await page.click('[data-fixture="own"]');
      await settle();
      assert.equal((await page.$$(booth)).length,0,'Owned equipment in reserve has no enclosure');
      await screenshot(`reserve-${units}-${width}`);
      await page.click('[data-fixture="install"]');
      await page.waitForSelector(booth);
      const level1 = await checkBooth(1,1);
      await screenshot(`installed-level1-${units}-${width}`);
      await page.click('[data-fixture="upgrade"]');
      await page.waitForSelector(`${dryer} img[src$="flower-drying-full.webp"]`);
      const level5 = await checkBooth(1,5);
      assert.ok(Math.abs(level1.width-level5.width)<1&&Math.abs(level1.height-level5.height)<1,'Upgrades preserve the enclosure size');
      await screenshot(`installed-level5-${units}-${width}`);
      await selectTent(2);
      assert.equal((await page.$$(booth)).length,0,'Selecting an unequipped tent hides the first tent dryer');
      await selectTent(1);
      await checkBooth(1,5);
      if(units===8) {
        await selectTent(5);
        assert.equal((await page.$$(booth)).length,0,'Second warehouse does not borrow the first tent dryer');
        await install();
        await checkBooth(5,1);
        assert.equal(await page.$eval(booth,image=>image.closest('[data-warehouse-bay]').dataset.warehouseBay),'2');
        await screenshot(`second-warehouse-${width}`);
        await selectTent(6);
        assert.equal((await page.$$(booth)).length,0,'Other second-warehouse tents remain unequipped');
        await selectTent(1);
        await checkBooth(1,5);
        assert.equal(await page.$eval(booth,image=>image.closest('[data-warehouse-bay]').dataset.warehouseBay),'1');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Page has no horizontal overflow');
      await decode();
      runs.push({width,units,installed:true,reserveHidden:true,levelVariants:true,tentIsolation:true,geometry:level1});
    }
  }
  assert.deepEqual(failedImages,[]);
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({runs,errors,failedImages},null,2)+'\n');
  console.log('PASS: complete drying room, reserve/install states, level variants, tent and warehouse isolation, shared freeze dryer, 390/1440 layouts and loaded images.');
} finally {
  await browser?.close();
  await server.close();
}
