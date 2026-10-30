// Real harvests, navigation, warehouse and shop components. Local read-only API fixtures only.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-harvests-navigation');
const harvestsOnly = process.argv.includes('--harvests-only');
const port = 3254, origin = `http://127.0.0.1:${port}`;
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'harvests-entry': `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {KqHarvests} from '/src/components/placard/KqHarvests';
    import {KqPlacardNavigation} from '/src/components/placard/KqPlacardNavigation';
    import {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';
    import {KqSupportBoosterShop} from '/src/components/placard/KqSupportBoosterShop';
    import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
    import {createKqOperationsLesson,getKqOperationsEquipment,getKqOperationsStorage} from '/src/lib/kanab-quest-operations-lesson';
    import {createKqStorageLot,projectKqStorageLot,planKqStorageAllocation} from '/src/lib/kanab-quest-storage';
    import {createKqWarehouseStarter} from '/src/lib/kanab-quest-warehouse';
    import {KQ_CARE_PRODUCTS} from '/src/lib/kanab-quest-care';
    import styles from '/src/components/placard/PlacardPlayerShell.module.css';
    const query=new URLSearchParams(location.search),now=Date.parse('2026-10-10T10:00:00Z');
    const lesson=createKqOperationsLesson('warehouse'),equipment=getKqOperationsEquipment(lesson);
    const ownedContainers={'GLASS-1L':6},reserved=[];
    const makeLot=(id,ageMinutes,totalUnits)=>{
      const started=now-ageMinutes*60000;
      const capacity=planKqStorageAllocation({totalUnits,ownedContainers,reservedAllocations:reserved,preferredMethodCode:'STORAGE-GLASS',nowMs:started});
      reserved.push(...capacity.allocations);
      const raw=createKqStorageLot({flowerId:id,harvestedAt:new Date(started).toISOString(),curingStartedAt:new Date(started).toISOString(),baseline:lesson.storage.lot.baseline,capacity});
      return {flowerId:id,varietyName:'Récolte '+id,harvestGrams:totalUnits/10,flowerStatus:'burned',projection:projectKqStorageLot(raw,now)};
    };
    const lots=[makeLot('ready-flower',420,1000),makeLot('curing-flower',30,1000),makeLot('overflow-flower',30,1800)];
    const storage={...getKqOperationsStorage(lesson),serverNow:new Date(now).toISOString(),ownedContainers,lots,
      stockBreakdown:{bulkUnits:3800,bulkProtectedUnits:3000,bulkOverflowUnits:800,packedUnits:0,packedActiveUnits:0,packedPausedUnits:0,packedOtherUnits:0,packedPackets:0},
      capacity:{totalUnits:3000,usedUnits:3000,reservedUnits:3000,freeUnits:0,overflowUnits:800}};
    // An available flower can enter the jury only when its server projection confirms completed curing.
    const flower=(id,status)=>({id,runId:'run-'+id,varietyCode:lesson.storage.lot.baseline.varietyCode,varietyName:'Récolte '+id,quality:70,traits:[],combos:[],stats:{aroma:70},status,storage:status==='available'?structuredClone(lots[0].projection):undefined,createdAt:new Date(now).toISOString(),queuedAt:status==='queued'?new Date(now).toISOString():null,lockedAt:status==='locked'?new Date(now).toISOString():null,burnedAt:status==='burned'?new Date(now).toISOString():null});
    const flowers=[flower('jury-flower','available'),flower('queued-flower','queued'),flower('locked-flower','locked'),flower('spent-flower','burned'),flower('ready-flower','burned')];
    if(query.has('empty')){flowers.length=0;storage.lots=[];}
    if(query.has('jury-only'))storage.lots=[];
    const shop={collectionActive:true,costPerPack:5,spendablePoints:100,welcomeClaimed:true,availableEntitlements:[]};
    const failing=new Set((query.get('fail')??'').split(',').filter(Boolean));
    window.__calls=[];window.__links=[];window.__recover=()=>failing.clear();
    window.__snapshot=()=>JSON.stringify({flowers,storage,equipment,shop});window.__initial=window.__snapshot();
    const request=async(url,options={})=>{
      const path=new URL(String(url),location.origin).pathname,method=options.method??'GET';window.__calls.push({path,method});
      if(method!=='GET')throw new Error('Read-only fixture rejected mutation '+method+' '+path);
      const key=path.split('/').at(-1);
      if(failing.has(key))return Response.json({error:'Indisponibilité locale simulée.'},{status:503});
      const payload={flowers:{flowers},storage,equipment,warehouse:{state:createKqWarehouseStarter(),revision:1,cashCents:500000,activeRun:false,activeRuns:[],stockGrams:380,storageReservedGrams:300,storageCapacityGrams:300,salesGramsPerDay:0},collection:{ownedBuddieCodes:[],buddieRotation:{recentBuddieCodes:[]}},boosters:shop,care:{cashCents:500000,inventory:[],catalog:KQ_CARE_PRODUCTS},commerce:{computerOwned:true,cashCents:500000}}[key];
      if(!payload)throw new Error('Unexpected API fixture request '+path);
      return Response.json(payload);
    };
    const originalFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url).startsWith('/api/')?request(url,options):originalFetch(url,options);
    const api={...createKqTutorialApi(request),isTutorial:false};
    sessionStorage.setItem('kq:selected-tent','1');
    function App(){
      const[view,setView]=useState('harvests'),[section,setSection]=useState('overview'),[flowerId,setFlowerId]=useState(),[configureStorage,setConfigureStorage]=useState(false);
      const navigate=next=>{setView(next);setSection('overview');setConfigureStorage(false);};
      return <KqTutorialApiProvider api={api}><div className={styles.shell}>
        <KqPlacardNavigation active={view} onNavigate={navigate} onHighlight={()=>{}}/>
        <div className={styles.content} data-fixture-content>
          {view==='harvests'?<KqHarvests section={section} initialFlowerId={flowerId} onSectionChange={(section,id)=>{setSection(section);setFlowerId(id);}} onOpenWarehouse={id=>{setFlowerId(id);setSection('storage');setConfigureStorage(true);setView('workshop');}} onOpenArena={flowerId=>window.__links.push({view:'arena',flowerId})} onOpenMarket={flowerId=>window.__links.push({view:'market',flowerId})} onOpenGame={()=>navigate('game')}/>
          :view==='workshop'?<KqWarehouseEntry embedded initialSection={section==='storage'?'storage':'equipment'} initialStorageEquipmentOpen={configureStorage} initialFlowerId={flowerId} onOpenHarvests={id=>{setFlowerId(id);setSection('storage');setConfigureStorage(false);setView('harvests');}} onOpenMarket={id=>window.__links.push({view:'market',flowerId:id})} onClose={()=>navigate('hub')} onOpenShop={()=>navigate('shop')}/>
          :view==='shop'?<KqSupportBoosterShop embedded autoOpen autoClaimWelcome={false} onExit={()=>navigate('hub')} onOpenWorkshop={()=>navigate('workshop')}/>
          :<main data-fixture-destination={view}><h1>{view}</h1></main>}
          <button type='button' data-fixture-after>Fin de la page</button>
        </div>
      </div></KqTutorialApiProvider>;
    }createRoot(document.getElementById('root')).render(<App/>);
  `,
};
const server = await createServer({root, configFile:false, envDir:false, cacheDir:resolve(output,'vite-cache'), publicDir:resolve(root,'public'),
  resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']}, optimizeDeps:{include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','lucide-react']},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'harvests-navigation-audit',enforce:'pre',resolveId(id){if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';if(id in modules)return '\0'+id;},
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}button{cursor:pointer}</style><div id="root"></div><script type="module" src="/@id/__x00__harvests-entry"></script></html>');});}}],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});

let browser,page;const errors=[],checks=[],blocked=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{
    if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();
    else{blocked.push(request.url());void request.abort();}
  });
  const states=()=>page.$$eval('[data-harvest-state]',nodes=>nodes.map(node=>node.dataset.harvestState));
  const clickHandle=async handle=>{await handle.evaluate(node=>node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await handle.click();};
  const clickSelector=async selector=>{const handle=await page.waitForSelector(selector);await clickHandle(handle);await handle.dispose();};
  const clickText=async(text,scope='')=>{const handle=await page.waitForFunction((text,scope)=>[...document.querySelectorAll(scope+' button')].find(node=>node.textContent.trim()===text&&node.getClientRects().length&&!node.disabled),{},text,scope);await clickHandle(handle.asElement());await handle.dispose();};
  const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-placard-harvests]');await page.waitForFunction(()=>document.querySelector('[data-harvest-id], [role="alert"]')||document.body.textContent.includes('Ta prochaine récolte commence ici'));};
  const unlocked=async()=>{
    assert.deepEqual(await page.evaluate(()=>({html:document.documentElement.style.overflow,body:document.body.style.overflow,modal:!!document.querySelector('[data-fixture-content] [aria-modal="true"]')})),{html:'',body:'',modal:false},'Pages must keep document scrolling and navigation available');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal document overflow');
  };
  const navigate=async(key,width)=>{
    if(width<=1000){await page.click('[aria-label="Accès rapides de Kanab Quest"] button[aria-haspopup="dialog"]');await page.waitForSelector('dialog[open]');await page.click('dialog[open] [data-placard-nav="'+key+'"]');await page.waitForSelector('dialog[open]',{hidden:true});}
    else await page.click('aside [data-placard-nav="'+key+'"]');
  };
  const unchanged=async()=>assert.deepEqual(await page.evaluate(()=>({changed:window.__snapshot()!==window.__initial,mutations:window.__calls.filter(call=>call.method!=='GET')})),{changed:false,mutations:[]},'Navigation and opening management screens must not mutate account data');
  const screenshot=async(name)=>{await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  for(const[width,height]of [[1440,1000],[1000,900],[390,844],[320,740]]){
    await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await visit();
    assert.deepEqual(await states(),['overflow','jury','duel','queued','ready','curing']);
    assert.deepEqual(await page.$$eval('[data-placard-harvests] figure li strong',nodes=>nodes.map(node=>Number(node.textContent))),[3,1,1,1],'Harvest summary counts each harvest once across jury, curing, ready and overflow');
    assert.equal(await page.$('[data-harvest-id="spent-flower"]'),null,'Burned flowers without remaining stock are omitted');
    await unlocked();await screenshot('harvests-'+width);
    for(const id of ['jury-flower','queued-flower','locked-flower']){
      await clickSelector('[data-harvest-id="'+id+'"] button');
      await page.waitForFunction(id=>window.__links.at(-1)?.flowerId===id,{},id);
      assert.deepEqual(await page.evaluate(()=>window.__links.at(-1)),{view:'arena',flowerId:id});
    }
    for(const[id,label]of [['ready-flower','Préparer la vente'],['curing-flower','Voir l’offre grossiste'],['overflow-flower','Voir l’offre grossiste']]){
      await clickText(label,'[data-harvest-id="'+id+'"]');assert.deepEqual(await page.evaluate(()=>window.__links.at(-1)),{view:'market',flowerId:id});
    }
    await page.select('[data-placard-harvests] select','jury');assert.deepEqual(await states(),['jury','duel','queued']);
    await page.select('[data-placard-harvests] select','stock');assert.deepEqual(await states(),['overflow','ready','curing']);
    assert.equal(await page.$eval('[data-placard-harvests] figcaption',node=>node.textContent),'6 récoltes par étape','Filtering the list preserves the complete harvest summary');
    await page.select('[data-placard-harvests] select','all');
    await clickText('Protéger le surplus');await page.waitForSelector('[data-conservation-summary]');
    assert.equal(await page.$('[data-warehouse-room]'),null,'Conservation never embeds the warehouse navigation');
    assert.equal(await page.$$eval('[data-protect-overflow]',nodes=>nodes.length),1);
    assert.equal(await page.$eval('[data-conservation-lot="overflow-flower"]',node=>node===document.activeElement),true,'Conservation focuses the selected lot');
    await unlocked();await screenshot('storage-'+width);
    await clickSelector('[data-protect-overflow="overflow-flower"]');await page.waitForSelector('[data-storage-protection-target="overflow-flower"]');
    assert.equal(await page.$$eval('[data-conservation-summary]',nodes=>nodes.length),1,'The warehouse reuses one shared lot manager');
    assert.equal(await page.$eval('[data-conservation-lot="overflow-flower"] [data-lot-summary]',node=>node.dataset.lotSummary),'overflow-flower','The warehouse keeps the same canonical lot identity');
    assert.equal(await page.$eval('[data-storage-equipment]',node=>node.open),true,'Adding containers opens the requested configuration directly');
    await clickSelector('[data-storage-equipment] > summary');
    assert.equal(await page.$eval('[data-storage-equipment]',node=>node.open),false,'The player can close the configuration');
    const storageReads=await page.evaluate(()=>window.__calls.filter(call=>call.path.endsWith('/storage')).length);
    await clickSelector('[aria-label="Actualiser le stockage"]');
    await page.waitForFunction(count=>window.__calls.filter(call=>call.path.endsWith('/storage')).length>count,{},storageReads);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.$eval('[data-storage-equipment]',node=>node.open),false,'Refreshing the selected lot respects the voluntary close');
    await clickSelector('[data-storage-equipment] > summary');
    await clickSelector('[data-return-protection-lot]');await page.waitForSelector('[data-conservation-lot="overflow-flower"]');
    await clickText('Toutes mes récoltes','[aria-label="Parcours des récoltes"]');await page.waitForSelector('[data-harvest-id]');assert.deepEqual(await states(),['overflow','jury','duel','queued','ready','curing']);
    await navigate('workshop',width);await page.waitForSelector('[data-arena-tour-surface="warehouse"]');
    await page.waitForFunction(()=>!document.body.textContent.includes('Actualisation de l’atelier…'));
    assert.equal(await page.$eval('[data-arena-tour-surface="warehouse"]',node=>node.getAttribute('role')),'region');
    assert.equal(await page.$('[aria-label="Fermer l’inventaire"]'),null,'Embedded warehouse has no modal close button');
    await clickSelector('[data-warehouse-room="storage"]');await page.waitForSelector('[data-storage-equipment]');
    assert.equal(await page.$eval('[data-storage-equipment]',node=>node.open),false,'A normal warehouse visit keeps storage configuration collapsed');
    await unlocked();await screenshot('warehouse-'+width);
    if(harvestsOnly){await unchanged();checks.push({width,height,states:6,summaryCounts:true,filters:true,flowerLinks:true,storageJourney:true,lotFocus:true,targetedConfigurationOpen:true,voluntaryCloseRespected:true,normalStorageCollapsed:true,embeddedWarehouse:true,noOverflow:true,noMutations:true});continue;}
    await navigate('shop',width);await page.waitForSelector('[data-shop-page] [aria-label="Ouvrir le rayon matériel"]');
    await page.waitForFunction(()=>!document.querySelector('[aria-label^="Acheter un booster"]').disabled);
    assert.equal(await page.$eval('[data-arena-tour-surface="shop"]',node=>node.getAttribute('role')),'region');
    if(width<640){
      const spacing=await page.$eval('[data-shop-page]',node=>({hintTop:node.querySelector('[class*="shopHint"]').getBoundingClientRect().top,walletBottom:node.querySelector('[class*="wallet"]').getBoundingClientRect().bottom}));
      assert.ok(spacing.hintTop>spacing.walletBottom,'Mobile shop help must sit below the wallet without covering its balance');
    }
    await unlocked();await screenshot('shop-'+width);
    await page.focus('[aria-label="Ouvrir le rayon matériel"]');await page.keyboard.press('Tab');
    assert.equal(await page.$eval('[data-fixture-after]',node=>node===document.activeElement),true,'Tab can leave the embedded shop');
    await page.keyboard.press('Escape');assert.ok(await page.$('[data-shop-page] [data-arena-tour-surface="shop"]'),'Escape does not dismiss an embedded shop page');
    await navigate('harvests',width);await page.waitForSelector('[data-harvest-id]');await unlocked();await unchanged();
    checks.push({width,height,states:6,filters:true,flowerLinks:true,storageTab:true,embeddedWarehouse:true,embeddedShop:true,navigationAvailable:true,noMutations:true});
  }
  await page.setViewport({width:390,height:844});
  for(const[fail,remaining]of [['flowers',['overflow','ready','curing']],['storage',['jury','duel','queued']],['flowers,storage',[]]]){
    await visit('fail='+fail);assert.deepEqual(await states(),remaining);assert.equal(await page.$$eval('[role="alert"]',nodes=>nodes.length),fail.split(',').length);
    assert.equal(await page.$('[data-placard-harvests] h3')===null,remaining.length===0,'Unavailable data must not show an empty account prompt');
    if(remaining.length){
      const legend=await page.$$eval('[data-placard-harvests] figure li',nodes=>nodes.map(node=>({label:node.querySelector('span').textContent,value:Number(node.querySelector('strong').textContent)})));
      assert.deepEqual(legend,fail==='flowers'?[{label:'En affinage',value:1},{label:'Prêtes à vendre',value:1},{label:'Surplus à protéger',value:1}]:[{label:'Jury et duels',value:3}],'Unavailable source categories are omitted, never reported as zero');
      assert.equal(await page.$eval('[data-harvest-summary-unavailable]',node=>node.textContent),fail==='flowers'?'Jury et duels : données indisponibles.':'Affinage, vente et surplus : données indisponibles.','The partial summary names its unavailable data');
      assert.match(await page.$eval('[data-placard-harvests] figcaption',node=>node.textContent),/données partielles/);
    }else assert.equal(await page.$('[data-placard-harvests] figure'),null,'No allocation chart without either data source');
    await page.evaluate(()=>window.__recover());await page.click('[role="alert"] button');await page.waitForFunction(()=>document.querySelectorAll('[data-harvest-id]').length===6&&!document.querySelector('[role="alert"]'));
    assert.deepEqual(await page.$$eval('[data-placard-harvests] figure li strong',nodes=>nodes.map(node=>Number(node.textContent))),[3,1,1,1],'Recovery restores all category counts');
    assert.equal(await page.$('[data-harvest-summary-unavailable]'),null,'Recovery removes the missing-data notice');
    await unchanged();checks.push({partialFailure:fail,retry:true,successfulSourceRetained:true,unavailableCategoriesOmitted:true});
  }
  await visit('jury-only');assert.deepEqual(await page.$$eval('[data-placard-harvests] figure li strong',nodes=>nodes.map(node=>Number(node.textContent))),[3,0,0,0],'A successfully loaded empty storage remains an actual zero');await page.select('[data-placard-harvests] select','stock');await clickText('Voir toutes mes récoltes');assert.deepEqual(await states(),['jury','duel','queued']);
  await visit('empty');await clickText('Commencer une culture');await page.waitForSelector('[data-fixture-destination="game"]');await unchanged();
  if(!harvestsOnly){
  await visit();await navigate('shop',390);await clickSelector('[aria-label="Ouvrir le rayon matériel"]');await page.waitForSelector('[aria-labelledby="equipment-catalog-title"]');
  assert.equal(await page.$eval('[aria-labelledby="equipment-catalog-title"]',node=>node.getAttribute('role')),'region','Embedded catalogue remains part of the page');await unlocked();
  await page.focus('[aria-label="Retour à la boutique"]');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
  assert.equal(await page.$eval('[aria-label="Accès rapides de Kanab Quest"] button[aria-haspopup="dialog"]',node=>node===document.activeElement),true,'Shift+Tab can leave the catalogue and return to navigation');
  await page.click('[aria-label="Accès rapides de Kanab Quest"] button[aria-haspopup="dialog"]');await page.waitForSelector('dialog[open]');await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});
  assert.ok(await page.$('[aria-labelledby="equipment-catalog-title"]'),'Escape from navigation must preserve the underlying shop catalogue');
  await clickText('Ajouter','[data-arena-tour-surface="catalog"] main');
  await clickSelector('[aria-label^="Ouvrir le panier,"]');await page.waitForSelector('[aria-label="Panier matériel"][data-open]');
  await page.focus('[aria-label="Panier matériel"] > header button');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
  assert.equal(await page.$eval('[aria-label="Panier matériel"] > footer button',node=>node===document.activeElement),true,'Cart Shift+Tab wraps to its final control');
  await page.keyboard.press('Tab');assert.equal(await page.$eval('[aria-label="Panier matériel"] > header button',node=>node===document.activeElement),true,'Cart Tab wraps to its first control');
  await clickText('Valider le panier','[aria-label="Panier matériel"]');await page.waitForSelector('[aria-labelledby="checkout-title"]');
  assert.equal(await page.$eval('[aria-labelledby="checkout-title"]',node=>node.getAttribute('role')),'alertdialog');
  const cartTotal=await page.$eval('[aria-label="Panier matériel"] > footer > div > strong',node=>node.textContent);
  assert.equal(await page.$eval('[aria-labelledby="checkout-title"] > dl > div > dd',node=>node.textContent),cartTotal,'Confirmation shows the same local cart total');
  await page.focus('[aria-labelledby="checkout-title"] > footer button:first-child');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
  assert.equal(await page.$eval('[aria-labelledby="checkout-title"] > footer button:last-child',node=>node===document.activeElement),true,'Confirmation Shift+Tab stays in its layer');
  await page.keyboard.press('Tab');assert.equal(await page.$eval('[aria-labelledby="checkout-title"] > footer button:first-child',node=>node===document.activeElement),true,'Confirmation Tab stays in its layer');
  await page.keyboard.press('Escape');await page.waitForSelector('[aria-labelledby="checkout-title"]',{hidden:true});
  assert.ok(await page.$('[aria-label="Panier matériel"][data-open]'),'Escape from confirmation returns to the cart without submitting it');
  await page.keyboard.press('Escape');await page.waitForSelector('[aria-label="Panier matériel"][data-open]',{hidden:true});
  assert.ok(await page.$('[aria-labelledby="equipment-catalog-title"]'),'Escape closes only the active cart layer');await unlocked();await unchanged();
  checks.push({embeddedCatalogue:true,keyboardExit:true,drawerEscapePreservesCatalogue:true,cartEscapePreservesCatalogue:true,cartAndConfirmationFocusTraps:true,confirmationTotal:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  await writeFile(resolve(output,harvestsOnly?'harvests-report.json':'report.json'),JSON.stringify({scope:harvestsOnly?'harvests':'full-navigation',checks,emptyAccount:true,emptyFilter:true,errors,remoteRequests:blocked},null,2));
  console.log(JSON.stringify({checks:checks.length,viewports:4,errors,remoteRequests:blocked.length}));
}catch(error){
  if(page){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(output,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,checks,errors,content:await page.evaluate(()=>document.body.innerText).catch(()=>null)},null,2));}
  throw error;
}finally{await browser?.close();await server.close();}
