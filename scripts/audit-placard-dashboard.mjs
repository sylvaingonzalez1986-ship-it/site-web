/** Real dashboard and lobby, synthetic progression, no credentials or external writes. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/placard-workshop/dashboard');
const modules = {
  'dashboard-entry': `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {KqPlacardHud} from '/src/components/placard/KqPlacardHud';
    import {KqPlacardLobby} from '/src/components/placard/KqPlacardLobby';
    import {KQ_EQUIPMENT_CATALOG} from '/src/lib/kanab-quest-equipment';
    import {KQ_MARKET_ROUTES} from '/src/lib/kanab-quest-market';
    const scenario = new URLSearchParams(location.search).get('scenario');
    const starters = KQ_EQUIPMENT_CATALOG.filter(e => !e.purchasable).map(e => e.code);
    const purchases = KQ_EQUIPMENT_CATALOG.filter(e => e.purchasable).slice(0, 8).map(e => e.code);
    const allCodes = KQ_EQUIPMENT_CATALOG.map(e => e.code);
    const ownedCodes = scenario === 'starter' ? starters : scenario === 'complete' ? allCodes : [...starters, ...purchases];
    const snapshot = {
      cashCents: scenario === 'starter' ? 0 : 23456789, reputation: 470,
      ownedCodes, purchasedCodes: ownedCodes.filter(c => !starters.includes(c)),
      equippedCodes: scenario === 'starter' ? starters : ['TENT-150', 'LED-500', 'AIR-EC6', 'SIFT-TRAY'],
      activeRun: scenario === 'culture', readyLotCount: ['jury', 'shop', 'starter'].includes(scenario) ? 0 : 3,
      availableFlowerCount: ['shop', 'starter'].includes(scenario) ? 0 : 4,
      routePlan: scenario === 'pinned' ? {route: 'dry-sift', equipmentCode: 'SIFT-TRAY'} : null,
      routeMasteries: scenario === 'starter' ? [] : KQ_MARKET_ROUTES.filter(r => r.family === 'hash' || r.family === 'rosin').map((r, i) => ({
        route:r.code, saleCount:scenario === 'complete' ? 100 : i+1, bestJuryScore:8.4,
        totalPayoutCents:1200000, totalReputation:80, masteredAt:'2026-09-10T10:00:00Z'
      }))
    };
    const originalFetch = window.fetch.bind(window);
    window.__opened = []; window.__patches = []; window.__failMission = false;
    let failLoad = scenario === 'error';
    window.fetch = async (url, init = {}) => {
      if (url !== '/api/arena/placard/equipment') return originalFetch(url, init);
      if (init.method === 'PATCH') {
        const body = JSON.parse(init.body); window.__patches.push(body);
        if(window.__failMission) {window.__failMission=false; return new Response(JSON.stringify({error:'Mission indisponible pour le test.'}), {status:503});}
        snapshot.routePlan = {route:body.route, equipmentCode:body.equipmentCode};
        return new Response('{}');
      }
      if(scenario === 'loading') await new Promise(r => setTimeout(r, 2500));
      if(failLoad) {failLoad=false; return new Response(JSON.stringify({error:'Atelier indisponible pour le test.'}), {status:503});}
      return new Response(JSON.stringify(snapshot));
    };
    const open = (destination, code) => window.__opened.push({destination, code});
    createRoot(document.getElementById('root')).render(scenario === 'lobby'
      ? React.createElement(KqPlacardLobby, {onOpen:destination=>open(destination), onOpenEquipment:code=>open('shop',code)})
      : React.createElement('main', {style:{maxWidth:950,margin:'0 auto',padding:16}}, React.createElement(KqPlacardHud, {
        onOpenGame:()=>open('game'), onOpenArena:()=>open('arena'), onOpenMarket:()=>open('market'), onOpenShop:code=>open('shop',code)
      })));
  `,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
};
const server = await createServer({
  root, cacheDir:resolve(output, 'vite-cache'), optimizeDeps:{include:['react','react-dom/client','lucide-react']},
  configFile:false, envDir:false, publicDir:resolve(root,'public'), esbuild:{jsx:'automatic'},
  resolve:{alias:{'@':resolve(root,'src')}}, css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'dashboard-audit', enforce:'pre', resolveId(id){if(id in modules)return '\0'+id;}, load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/')return next();
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tableau de bord du Placard</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__dashboard-entry"></script></html>');
    });}
  }], server:{host:'127.0.0.1',port:3197,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}
});
let browser;
const errors = [], results = [];
try {
  await mkdir(output,{recursive:true}); await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
  const page = await browser.newPage(); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3197'))void r.continue();else void r.abort();});
  const visit = async scenario => {await page.goto('http://127.0.0.1:3197/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('#hud-tab-overview',{timeout:60000});};
  const checkLayout = async () => {
    const result = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1, brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}));
    assert.equal(result.overflow,false); assert.deepEqual(result.brokenImages,[]);
    return result;
  };
  const shot = async name => {await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  for(const width of [320,390,768,1440]) {
    await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
    await visit('populated');
    assert.equal(await page.$$eval('#placard-hud-content article',els=>els.length),1);
    assert.equal(await page.$$eval('#placard-hud-content details',els=>els.length),0);
    await page.click('#placard-hud-content article button');
    assert.equal(await page.evaluate(()=>window.__opened.at(-1).destination),'market');
    await shot('overview-'+width); await checkLayout();
    await page.click('#hud-tab-equipment');
    assert.equal(await page.$$eval('#placard-hud-content article',els=>els.length),0);
    assert.equal(await page.$$eval('#placard-hud-content > ul > li',els=>els.length),5);
    await shot('equipment-'+width); await checkLayout();
    await page.locator('::-p-text(Ouvrir l’Inventaire)').click(); await page.waitForSelector('[role="dialog"]');
    await page.keyboard.press('Escape'); assert.equal(await page.$('[role="dialog"]'),null);
    await page.click('#hud-tab-goals');
    assert.equal(await page.$$eval('#placard-hud-content > details[open]',els=>els.length),0);
    await shot('goals-'+width); await checkLayout();
    await page.click('[aria-label="Filières maîtrisées"] > summary');
    assert.equal(await page.$$eval('[aria-label="Filières maîtrisées"] li',els=>els.length),8);
    await checkLayout();
    results.push({width,overflow:false,sectionsIndependent:true,inventoryOpens:true});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  for(const [scenario,destination] of [['culture','game'],['jury','arena'],['shop','shop'],['starter','game']]) {
    await visit(scenario); await page.click('#placard-hud-content article button');
    assert.equal(await page.evaluate(()=>window.__opened.at(-1).destination),destination);
  }
  await page.click('#hud-tab-equipment'); assert(await page.$eval('#placard-hud-content',e=>e.textContent.includes('kit de départ')));
  await page.click('#hud-tab-goals'); await page.click('[aria-label="Mission d’atelier"] > summary');
  await page.evaluate(()=>{window.__failMission=true;}); await page.click('[aria-label="Mission d’atelier"] button');
  await page.waitForSelector('[aria-label="Mission d’atelier"] [role="alert"]');
  await page.click('[aria-label="Mission d’atelier"] button');
  await page.waitForFunction(()=>document.querySelector('#placard-hud-content')?.textContent.includes('objectif sauvegardé'));
  assert.equal(await page.evaluate(()=>window.__patches.length),2);
  assert.equal(await page.evaluate(()=>window.__patches.at(-1).action),'route-plan');
  await checkLayout();
  await visit('pinned'); await page.click('#hud-tab-goals');
  assert(await page.$eval('#placard-hud-content',e=>e.textContent.includes('objectif sauvegardé')));
  await page.locator('::-p-text(Poursuivre la filière)').click();
  assert.equal(await page.evaluate(()=>window.__opened.at(-1).code),'SIFT-TRAY');
  await visit('complete'); await page.click('#hud-tab-goals');
  assert(await page.$eval('#placard-hud-content',e=>e.textContent.includes('Progression principale terminée')));
  await page.goto('http://127.0.0.1:3197/?scenario=error',{waitUntil:'networkidle0'}); await page.waitForSelector('[role="alert"]');
  assert.equal(await page.$('#hud-tab-overview'),null); await page.click('[role="alert"] button'); await page.waitForSelector('#hud-tab-overview');
  await page.goto('http://127.0.0.1:3197/?scenario=loading',{waitUntil:'domcontentloaded'}); await page.waitForSelector('[role="status"]');
  assert.equal(await page.$('#hud-tab-overview'),null); await page.waitForSelector('#hud-tab-overview');
  await visit('lobby'); await page.click('details > summary');
  await page.$eval('[data-placard-dashboard]',el=>el.scrollIntoView({block:'start'}));
  await shot('lobby-390'); await checkLayout();
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,destinations:true,pinnedGoal:true,missionRetry:true,complete:true,loadingAndRetry:true,lobby:true,errors},null,2));
  console.log(JSON.stringify({passed:true,results,output}));
} finally {await browser?.close();await server.close();}
