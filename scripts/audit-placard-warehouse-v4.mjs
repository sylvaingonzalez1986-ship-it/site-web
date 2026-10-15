// Actual React view and domain model, with browser-local API fixtures only.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/warehouse-v4');
const port = Number(process.env.KQ_WAREHOUSE_AUDIT_PORT ?? 3248);
const origin = 'http://127.0.0.1:'+port;
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react'; export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,...props}){return <a {...props}/>;}`,
  'next/navigation': `const router={push:href=>{window.__navigation=href;}};export function useRouter(){return router;}`,
  'warehouse-v4-entry': `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {KqWarehouse} from '/src/components/placard/KqWarehouse';
    import {createKqWarehouseStarter,getKqWarehouseQuote} from '/src/lib/kanab-quest-warehouse';
    import {KQ_EQUIPMENT_CATALOG,getKqEquipmentDefinition,getKqEquipmentUpgradeCost,isKqSharedEquipment} from '/src/lib/kanab-quest-equipment';
    import {createChanvrierCareerSnapshot} from '/src/lib/chanvrier-career';
    import {getKqMachineCondition} from '/src/lib/kanab-quest-maintenance';
    import {getKqWorkshopTierPrice} from '/src/lib/kanab-quest-workshop-machines';
    import {quoteKqMarketRoutes} from '/src/lib/kanab-quest-market';
    const query=new URLSearchParams(location.search);
    let state=createKqWarehouseStarter();
    // Historical scenarios deliberately keep their original 40×25 footprint.
    // The dedicated 100 m² audit opts into the new starter with ?compact.
    if(!query.has('compact')){
      const {floor,...historical}=state;void floor;
      state={...historical,serviceZones:state.serviceZones.map(zone=>({...zone,y:24}))};
    }
    if(query.has('expanded')) state=getKqWarehouseQuote({...state,zones:[{...state.zones[0],x:2,y:2,width:6,height:5,name:'La première chambre'},{...state.zones[0],id:'second',x:11,y:2,width:5,height:4,name:'La relève'}]}).nextState;
    if(query.has('full')) state=getKqWarehouseQuote({...state,serviceZones:[],zones:[{...state.zones[0],x:0,y:0,width:query.has('compact')?10:40,height:query.has('compact')?10:25,name:'Toute la chambre'}]}).nextState;
    if(query.has('legacy')){state={...state};delete state.serviceZones;}
    if(query.has('fragmented'))state=getKqWarehouseQuote({...state,serviceZones:state.serviceZones.map(zone=>zone.kind==='storage'?{...zone,width:2,deviceCode:'CURTEC-60L'}:zone)}).nextState;
    window.__snapshot={state,revision:1,cashCents:query.has('poor')?100:1500000,activeRun:query.has('active'),legacyActiveRun:false,migrationCreditCents:0,stockGrams:100,storageReservedGrams:query.has('fragmented')?24000:undefined,salesGramsPerDay:30,context:{available:true}};
    if(query.has('compact'))Object.assign(window.__snapshot,{activeRuns:[],completedRuns:[]});
    if(query.has('cultures')||query.has('campaign')||query.has('readyCampaign')){
      const rectangles=query.has('compact')?[{x:1,y:1,width:2,height:2},{x:5,y:1,width:2,height:2},{x:1,y:5,width:2,height:2}]:[{x:2,y:2,width:6,height:5},{x:11,y:2,width:5,height:4},{x:19,y:2,width:4,height:4}];
      state=getKqWarehouseQuote({...state,zones:[{...state.zones[0],...rectangles[0],buddieCode:query.has('campaign')||query.has('readyCampaign')?'HH2026-003':'HH2026-002',name:'La première chambre'},{...state.zones[0],id:'second',...rectangles[1],name:'La relève'},{...state.zones[0],id:'third',...rectangles[2],buddieCode:'HH2026-004',name:'Le jardin'}]}).nextState;
      window.__snapshot={...window.__snapshot,state,activeRun:true,activeRuns:[{runId:'11111111-1111-4111-8111-111111111111',zoneId:'starter',buddieCode:'HH2026-002',stageIndex:2,phase:'ready',startedAt:'2026-10-13T12:00:00Z'}],completedRuns:[]};
      if(query.has('campaign'))window.__snapshot.activeRuns=[{runId:'11111111-1111-4111-8111-111111111111',zoneId:'starter',buddieCode:'HH2026-003'},{runId:'22222222-2222-4222-8222-222222222222',zoneId:'third',buddieCode:'HH2026-004'}].map(run=>({...run,stageIndex:2,phase:'ready',startedAt:'2026-10-13T12:00:00Z',campaignId:'99999999-9999-4999-8999-999999999999',leaderRunId:'11111111-1111-4111-8111-111111111111'}));
      if(query.has('readyCampaign')){window.__snapshot.activeRun=false;window.__snapshot.activeRuns=[];}
    }
    window.__requests=[];window.__apiCalls=[];window.__receipts={};window.__failOnce=false;window.__hold=false;
    const persistenceKey=query.has('persist')?'warehouse-audit-'+query.get('persist'):null;
    if(persistenceKey&&sessionStorage.getItem(persistenceKey)){
      const persisted=JSON.parse(sessionStorage.getItem(persistenceKey));
      window.__snapshot=persisted.snapshot;window.__receipts=persisted.receipts;
    }
    const persistFixture=()=>{if(persistenceKey)sessionStorage.setItem(persistenceKey,JSON.stringify({snapshot:window.__snapshot,receipts:window.__receipts}));};
    window.__loseResponseOnce=false;
    const starter=['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];
    const machines=KQ_EQUIPMENT_CATALOG.filter(item=>isKqSharedEquipment(item.code));
    window.__equipmentRequests=[];
    window.__machines=machines.map(item=>({code:item.code,slot:item.slot,name:item.name}));
    window.__workshop={ownedCodes:machines.map(item=>item.code),purchasedCodes:machines.map(item=>item.code),equippedCodes:machines.map(item=>item.code),levels:Object.fromEntries(machines.map(item=>[item.code,3])),maintenance:Object.fromEntries(machines.map(item=>[item.code,getKqMachineCondition(item.code,3,2)]))};
    window.__tierReceipts={};
    if(query.has('newWorkshop'))window.__workshop={ownedCodes:[],purchasedCodes:[],equippedCodes:[],levels:{},maintenance:{}};
    const equipmentSnapshot=()=>{
      const shared=window.__workshop;
      return {equipmentScopeVersion:3,career:createChanvrierCareerSnapshot({xp:4500,completedCultures:20,processingPractice:{sifting:30,washing:30,pressing:30}}),tentNumber:1,productionUnits:4,cashCents:window.__snapshot.cashCents,ownedCodes:[...starter,...shared.ownedCodes],purchasedCodes:shared.purchasedCodes,equippedCodes:[...starter,...shared.equippedCodes],levels:shared.levels,maintenance:shared.maintenance,sharedEquipment:shared,catalog:KQ_EQUIPMENT_CATALOG,routePlan:null,reputation:500,tents:[{tentNumber:1,ownedCodes:starter,purchasedCodes:[],equippedCodes:starter,levels:{}}],buildings:[],activeRun:window.__snapshot.activeRun};
    };
    window.__storageRequests=[];
    window.__storage={lots:query.has('overflow')?[{flowerId:'11111111-1111-4111-8111-111111111111',varietyName:'Lot de reprise',harvestGrams:1200,projection:{readyAt:'2026-01-01T12:00:00Z',stage:'ready',methodName:'Bocaux',capacity:{totalUnits:12000,overflowUnits:10000,overflowDeadlineAt:null}},overflowOffer:{units:10000,payoutCents:20000,netPayoutCents:16000}}]:[],serverNow:new Date().toISOString()};
    if(query.has('ready'))window.__storage.lots=[{flowerId:'22222222-2222-4222-8222-222222222222',varietyName:'Lot prêt pour l’atelier',harvestGrams:100,projection:{readyAt:'2026-01-01T12:00:00Z',stage:'ready',methodName:'Bocaux',capacity:{totalUnits:1000,overflowUnits:0,overflowDeadlineAt:null}}}];
    const fetchOriginal=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return fetchOriginal(url,init);
      window.__apiCalls.push({url:String(url),method:init.method??'GET'});
      if(String(url)==='/api/arena/placard/collection')return Response.json({ownedBuddieCodes:query.has('buddieDrag')?Array.from({length:15},(_,index)=>'HH2026-'+String(index+2).padStart(3,'0')):['HH2026-002','HH2026-003','HH2026-004'],buddieRotation:{requiredDistinctBuddies:5,recentBuddieCodes:query.has('buddieDrag')?['HH2026-005','HH2026-002']:['HH2026-002']}});
      if(String(url).startsWith('/api/arena/placard/equipment')){
        if(!init.method||init.method==='GET')return Response.json(equipmentSnapshot());
        const body=JSON.parse(init.body);window.__equipmentRequests.push(body);
        if(window.__hold)await new Promise(resolve=>window.__release=resolve);
        const workshop=window.__workshop;
        if(body.action==='workshop-tier'){
          if(window.__tierReceipts[body.requestKey])return Response.json({...window.__tierReceipts[body.requestKey],replayed:true});
          const previous=workshop.levels[body.equipmentCode]??0;
          const price=getKqWorkshopTierPrice(body.equipmentCode,getKqEquipmentDefinition(body.equipmentCode).priceCents,body.targetLevel,previous);
          if(previous!==body.expectedLevel||price!==body.expectedPriceCents||price===null||price>window.__snapshot.cashCents)return Response.json({error:'Devis de gamme invalide.'},{status:400});
          window.__snapshot.cashCents-=price;
          workshop.ownedCodes=[...new Set([...workshop.ownedCodes,body.equipmentCode])];
          workshop.purchasedCodes=[...new Set([...workshop.purchasedCodes,body.equipmentCode])];
          workshop.levels[body.equipmentCode]=body.targetLevel;
          if(!workshop.maintenance[body.equipmentCode])workshop.maintenance[body.equipmentCode]=getKqMachineCondition(body.equipmentCode,body.targetLevel,0);
          const receipt={equipmentCode:body.equipmentCode,previousLevel:previous,level:body.targetLevel,priceCents:price,cashAfterCents:window.__snapshot.cashCents,replayed:false};
          window.__tierReceipts[body.requestKey]=receipt;
          if(window.__loseResponseOnce){window.__loseResponseOnce=false;throw Error('Réponse perdue après validation. Réessaie.');}
          return Response.json(receipt);
        }
        if(body.action==='upgrade'){
          const level=workshop.levels[body.equipmentCode];
          window.__snapshot.cashCents-=getKqEquipmentUpgradeCost(body.equipmentCode,level);
          workshop.levels[body.equipmentCode]=level+1;
          return Response.json({level:level+1});
        }
        if(body.action==='repair'){
          window.__snapshot.cashCents-=body.expectedCostCents;
          workshop.maintenance[body.equipmentCode]=getKqMachineCondition(body.equipmentCode,workshop.levels[body.equipmentCode],0,body.expectedVersion+1);
        }else if(body.equipmentCode){
          const slot=getKqEquipmentDefinition(body.equipmentCode).slot;
          workshop.equippedCodes=workshop.equippedCodes.filter(code=>getKqEquipmentDefinition(code).slot!==slot).concat(body.equipmentCode);
        }
        return Response.json({ok:true});
      }
      if(String(url)==='/api/arena/placard/commerce'){
        return Response.json({revision:1,cashCents:window.__snapshot.cashCents,reputation:500,clients:0,computerOwned:false,internetRenew:false,campaign:null,stocks:[],receipts:[],marketVolumes:{},ownVolumes:{},routeSales:{},electricityOutstandingCents:0,rawLots:window.__storage.lots.filter(lot=>!lot.projection.capacity.overflowUnits).map(lot=>({flowerId:lot.flowerId,varietyName:lot.varietyName,juryScore:8,harvestGrams:lot.harvestGrams,options:quoteKqMarketRoutes({juryScore:8,harvestGrams:lot.harvestGrams,equipmentCodes:['TENT-080-STARTER',...window.__workshop.equippedCodes],equipmentLevels:window.__workshop.levels})}))});
      }
      if(String(url)==='/api/arena/placard/storage'){
        if(init.method==='POST'){
          const body=JSON.parse(init.body);window.__storageRequests.push(body);
          if(window.__failOnce){window.__failOnce=false;throw Error('Connexion interrompue. Réessaie.');}
          if(!window.__receipts[body.requestKey]){window.__storage.lots=[];window.__snapshot.cashCents+=16000;window.__snapshot.stockGrams=0;window.__receipts[body.requestKey]=structuredClone(window.__storage);}
          return Response.json(window.__receipts[body.requestKey]);
        }
        return Response.json(window.__storage);
      }
      if(String(url)!=='/api/arena/placard/warehouse')throw Error('Unexpected fixture API: '+url);
      if(!init.method||init.method==='GET')return Response.json(window.__snapshot);
      const body=JSON.parse(init.body);window.__requests.push(body);
      if(window.__hold)await new Promise(resolve=>window.__release=resolve);
      if(window.__failOnce){window.__failOnce=false;throw Error('Connexion interrompue. Réessaie.');}
      if(window.__receipts[body.requestKey])return Response.json(window.__receipts[body.requestKey]);
      const snapshot=window.__snapshot;
      if((snapshot.activeRun&&!snapshot.activeRuns)||body.expectedRevision!==snapshot.revision)return Response.json({error:'Plan modifié. Actualise.'},{status:409});
      if(snapshot.activeRuns?.some(run=>JSON.stringify(snapshot.state.zones.find(zone=>zone.id===run.zoneId))!==JSON.stringify(body.state.zones.find(zone=>zone.id===run.zoneId))))return Response.json({error:'Cette zone est en culture.'},{status:409});
      const quote=getKqWarehouseQuote(body.state,snapshot.state);
      if(quote.totalCostCents!==body.expectedCostCents||quote.totalCostCents>snapshot.cashCents)return Response.json({error:'Devis invalide.'},{status:400});
      window.__snapshot={...snapshot,state:quote.nextState,cashCents:snapshot.cashCents-quote.totalCostCents,revision:snapshot.revision+1};
      window.__receipts[body.requestKey]=structuredClone(window.__snapshot);
      persistFixture();
      if(window.__loseResponseOnce){window.__loseResponseOnce=false;throw Error('Réponse perdue après validation. Réessaie.');}
      return Response.json(window.__snapshot);
    };
    window.__closeCount=0;
    function Fixture(){const [closed,setClosed]=React.useState(false);return closed?<p data-warehouse-closed>Entrepôt fermé</p>:<KqWarehouse embedded={!query.has('modal')} onClose={()=>{window.__closeCount++;setClosed(true);}}/>;}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `,
};
await mkdir(output, { recursive: true });
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  publicDir: resolve(root, 'public'), resolve: {alias: {'@': resolve(root, 'src')}},
  optimizeDeps: {include: ['react', 'react-dom', 'react-dom/client', 'lucide-react']},
  plugins: [{name:'warehouse-v4-audit',enforce:'pre',
    resolveId(id){if(id in modules)return '\0'+id;if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';},
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/')return next();
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrepôt · Prévisualisation locale</title><style>@font-face{font-family:"Warehouse Display";src:url("/src/app/fonts/BarlowCondensed-Latin-Bold.woff2") format("woff2");font-weight:700;font-display:swap}@font-face{font-family:"Warehouse Hand";src:url("/src/app/fonts/Caveat-Latin-Bold.woff2") format("woff2");font-weight:700;font-display:swap}@font-face{font-family:"Warehouse Body";src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2") format("woff2");font-weight:300 700;font-display:swap}:root{--font-display:"Warehouse Display";--font-handwritten:"Warehouse Hand";--font-body:"Warehouse Body"}*{box-sizing:border-box}body{margin:0;background:#183529;font-family:"Warehouse Body",Arial,sans-serif;padding:20px}#root{max-width:1400px;margin:auto}button,input,select{font-family:inherit}@media(max-width:600px){body{padding:6px}}</style><div id="root"></div><script type="module" src="/@id/__x00__warehouse-v4-entry"></script></html>');
    });}
  }],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}
});
await server.listen();
if(process.argv.includes('--preview')){
  console.log('Prévisualisation locale avec données de démonstration : '+origin+'/?expanded');
}else{
  let browser,page;const errors=[],checks=[],measurements={},loadedAssets=new Set();
  const visualOnly=process.argv.includes('--visual-only');
  const shopOnly=process.argv.includes('--shop-only');
  const workshopOnly=process.argv.includes('--workshop-only');
  const chromeOnly=process.argv.includes('--chrome-only');
  const culturesOnly=process.argv.includes('--cultures-only');
  const buddieDragOnly=process.argv.includes('--buddie-drag-only');
  try{
    browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
    page=await browser.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(60000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.ok())loadedAssets.add(response.url());});
    await page.setRequestInterception(true);
    page.on('request',request=>void(request.url().startsWith(origin)||request.url().startsWith('data:')?request.continue():request.abort()));
    const enterCultures=async(openChooser=true)=>{
      await page.waitForSelector('[aria-label="Mode du plan"]');
      await page.$$eval('[aria-label="Mode du plan"] button',nodes=>nodes.find(node=>node.textContent.trim()==='Cultures').click());
      await page.waitForSelector('[data-warehouse-buddie-toggle]');
      if(openChooser)await page.click('[data-warehouse-buddie-toggle]');
    };
    const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-map] [data-zone-id]');if(culturesOnly||buddieDragOnly)await enterCultures();};
    const clickAction=async(action)=>{
      const selector='[data-warehouse-action="'+action+'"]';
      await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].some(node=>!node.disabled),{},selector);
      const control=await page.$(selector);assert.ok(control,'Warehouse action '+action);await control.click();
    };
    const clickRoom=async(room)=>{await page.click('[data-warehouse-room="'+room+'"]');if(room==='culture'&&(culturesOnly||buddieDragOnly))await enterCultures(false);};
    const openDetails=async(selector)=>{
      const details=await page.$(selector);
      if(details&&!await details.evaluate(node=>node.open)){
        await page.$eval(selector+' > summary',node=>node.scrollIntoView({block:'center',behavior:'instant'}));
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await page.click(selector+' > summary');
        await page.waitForFunction(selector=>document.querySelector(selector)?.open,{},selector);
      }
    };
    const clickText=async(text)=>{
      for(let attempt=0;attempt<3;attempt++){
        const node=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(text)&&!button.disabled&&button.getClientRects().length)||false,{},text);
        try{assert.ok(node.asElement(),'button '+text);await node.asElement().click();return;}
        catch(error){if(attempt===2||!/detached|not clickable|not an Element/.test(error.message))throw error;}
        finally{await node.dispose();}
      }
    };
    const fill=async(label,value)=>{await openDetails('[data-warehouse-zone-settings]');const input=await page.evaluateHandle(label=>[...document.querySelectorAll('label')].find(el=>el.textContent.startsWith(label))?.querySelector('input'),label);assert.ok(input.asElement(),label);await input.asElement().focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type(String(value));await page.keyboard.press('Tab');assert.equal(await input.asElement().evaluate(el=>el.value),String(value),'Field value replaced');};
    const assertLayout=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('input,select')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<0);}).map(el=>el.outerHTML)),[],'Editable controls remain inside viewport');};
    const assertWorkshopTierLayout=async context=>{
      const cards=await page.$$eval('[data-workshop-tiers] article[data-workshop-tier]',nodes=>nodes.filter(node=>node.getBoundingClientRect().width>0).map(node=>{
        const card=node.getBoundingClientRect();
        return {tier:node.dataset.workshopTier,width:card.width,overflow:[...node.querySelectorAll('button,dt,dd')].filter(part=>{const r=part.getBoundingClientRect();return r.left<card.left-1||r.right>card.right+1||r.bottom>card.bottom+1||part.scrollWidth>part.clientWidth+1;}).map(part=>part.textContent)};
      }));
      assert.equal(cards.length,3,'All three workshop tiers remain visible in '+context);
      for(const card of cards)assert.deepEqual(card.overflow,[],'Workshop tier '+card.tier+' controls and metrics fit inside their card in '+context);
      measurements.workshopTierLayout??={};measurements.workshopTierLayout[context]=cards;
    };
    const readInspector=async()=>page.evaluate(()=>{
      const value=label=>Number([...document.querySelectorAll('label')].find(el=>el.textContent.startsWith(label))?.querySelector('input')?.value);
      return {x:value('Position X'),y:value('Position Y'),width:value('Largeur'),height:value('Profondeur')};
    });
    const geometry=async()=>page.$eval('[data-warehouse-map]',map=>({
      x:Number(map.dataset.gridOriginX),y:Number(map.dataset.gridOriginY),cell:Number(map.dataset.gridCellSize),
      columns:Number(map.dataset.gridColumns),rows:Number(map.dataset.gridRows),
      width:map.getBoundingClientRect().width,height:map.getBoundingClientRect().height,
    }));
    const setZoom=async(value)=>{
      const wasOpen=await page.$eval('[data-warehouse-plan-help]',node=>node.open);
      await openDetails('[data-warehouse-plan-help]');
      const control=await page.$('input[aria-label="Zoom du plan"]');assert.ok(control,'Zoom control');
      const {min,step}=await control.evaluate(node=>({min:Number(node.min),step:Number(node.step)}));
      assert.equal((value-min)%step,0,'Requested zoom follows slider step');
      await control.focus();await page.keyboard.press('Home');
      // Initial framing and React's controlled range can commit between keys.
      // Read the real control after each frame instead of assuming every key
      // started from the previous requested value (especially with touch emulation).
      for(let attempt=0;attempt<80;attempt++){
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const current=await control.evaluate(node=>Number(node.value));
        if(current===value)break;
        await page.keyboard.press(current<value?'ArrowRight':'ArrowLeft');
      }
      assert.equal(await control.evaluate(node=>Number(node.value)),value,'Exact requested zoom');
      if(!wasOpen)await page.click('[data-warehouse-plan-help] > summary');
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    const pointAtCell=async(x,y)=>{
      await page.$eval('[data-warehouse-map-viewport]',viewport=>viewport.scrollIntoView({block:'center'}));
      await page.evaluate(({x,y})=>{
        const map=document.querySelector('[data-warehouse-map]'),viewport=document.querySelector('[data-warehouse-map-viewport]');
        const point=new DOMPoint(Number(map.dataset.gridOriginX)+(x+.5)*Number(map.dataset.gridCellSize),Number(map.dataset.gridOriginY)+(y+.5)*Number(map.dataset.gridCellSize)).matrixTransform(map.getScreenCTM());
        const box=viewport.getBoundingClientRect();
        viewport.scrollLeft+=point.x-box.left-box.width/2;viewport.scrollTop+=point.y-box.top-box.height/2;
      },{x,y});
      const point=await page.evaluate(({x,y})=>{
        const map=document.querySelector('[data-warehouse-map]'),viewport=document.querySelector('[data-warehouse-map-viewport]');
        const point=new DOMPoint(Number(map.dataset.gridOriginX)+(x+.5)*Number(map.dataset.gridCellSize),Number(map.dataset.gridOriginY)+(y+.5)*Number(map.dataset.gridCellSize)).matrixTransform(map.getScreenCTM());
        const box=viewport.getBoundingClientRect();
        return {x:point.x,y:point.y,visible:point.x>Math.max(0,box.left)&&point.x<Math.min(innerWidth,box.right)&&point.y>Math.max(0,box.top)&&point.y<Math.min(innerHeight,box.bottom)};
      },{x,y});
      assert.equal(point.visible,true,'Cell '+x+','+y+' remains reachable inside the scrolled map');return point;
    };
    const clickCell=async(x,y,touch=false)=>{const point=await pointAtCell(x,y);if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);};
    const settleView=async()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const readSavedPlan=async()=>page.evaluate(()=>({state:window.__snapshot.state,revision:window.__snapshot.revision,cashCents:window.__snapshot.cashCents,requests:window.__requests.length}));
    const readBuddieAssignments=async()=>page.$$eval('[data-warehouse-map] [data-zone-kind="culture"][data-zone-id]',nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.zoneId,node.querySelector('[data-zone-buddie]')?.getAttribute('data-zone-buddie')??null])));
    const buddieCard=code=>'[data-warehouse-buddie-card="'+code+'"]';
    const visibleCellPoint=async(x,y)=>page.evaluate(({x,y})=>{
      const map=document.querySelector('[data-warehouse-map]'),viewport=document.querySelector('[data-warehouse-map-viewport]');
      const point=new DOMPoint(Number(map.dataset.gridOriginX)+(x+.5)*Number(map.dataset.gridCellSize),Number(map.dataset.gridOriginY)+(y+.5)*Number(map.dataset.gridCellSize)).matrixTransform(map.getScreenCTM());
      const box=viewport.getBoundingClientRect(),hit=document.elementFromPoint(point.x,point.y);
      return {x:point.x,y:point.y,visible:point.x>Math.max(0,box.left)&&point.x<Math.min(innerWidth,box.right)&&point.y>Math.max(0,box.top)&&point.y<Math.min(innerHeight,box.bottom)&&map.contains(hit)};
    },{x,y});
    const prepareBuddieDrag=async(code,cell)=>{
      await pointAtCell(cell.x,cell.y);
      await page.$eval(buddieCard(code),node=>node.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));
      await settleView();
      const start=await page.$eval(buddieCard(code),node=>{
        const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
        return {x,y,visible:x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&node.contains(document.elementFromPoint(x,y))};
      });
      const end=await visibleCellPoint(cell.x,cell.y);
      measurements.lastBuddieGesture={code,cell,start,end,width:await page.evaluate(()=>innerWidth)};
      assert.equal(start.visible,true,'Buddie drag source is visible and unobscured');
      assert.equal(end.visible,true,'Buddie drop target and source are simultaneously visible');
      return {start,end};
    };
    let touchSession;
    const touchGesture=async(start,end,{cancel=false,onMove}={})=>{
      touchSession??=await page.createCDPSession();
      const send=(type,point)=>touchSession.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{x:point.x,y:point.y,id:1,radiusX:3,radiusY:3,force:.6}]:[]});
      await send('touchStart',start);
      for(let step=1;step<=12;step++){
        await send('touchMove',{x:start.x+(end.x-start.x)*step/12,y:start.y+(end.y-start.y)*step/12});
        await settleView();
      }
      if(onMove)await onMove();
      await send(cancel?'touchCancel':'touchEnd');await settleView();
    };
    const dragBuddie=async(code,cell,{touch=false,cancel=false,button='left',blocked=false,capture,onDragging}={})=>{
      const {start,end}=await prepareBuddieDrag(code,cell);
      const preview=async()=>{
        if(button==='left'&&!blocked)assert.ok(await page.$('[data-warehouse-buddie-ghost="'+code+'"]'),'Actual pointer movement displays the dragged card');
        else assert.equal(await page.$('[data-warehouse-buddie-ghost]'),null,'Unavailable card or secondary mouse button never starts a drag');
        if(button==='left'&&!blocked){
          const target=await page.evaluate(({x,y})=>{
            const node=document.elementFromPoint(x,y)?.closest('[data-zone-id]');
            return node?{id:node.dataset.zoneId,kind:node.dataset.zoneKind,drop:node.dataset.buddieDrop,busy:window.__snapshot.activeRuns.some(run=>run.zoneId===node.dataset.zoneId)}:null;
          },end);
          if(target)assert.equal(target.drop,target.kind==='culture'&&!target.busy?'valid':'invalid','Drop highlight explains whether the hovered zone accepts this Buddie');
        }
        if(capture)await page.screenshot({path:resolve(output,capture)});
        if(onDragging)await onDragging();
      };
      if(touch)await touchGesture(start,end,{cancel,onMove:preview});
      else{
        await page.mouse.move(start.x,start.y);await page.mouse.down({button});
        await page.mouse.move(end.x,end.y,{steps:14});await settleView();await preview();
        if(cancel)await page.keyboard.press('Escape');
        await page.mouse.up({button});await settleView();
      }
      assert.equal(await page.$('[data-warehouse-buddie-ghost]'),null,'Pointer release or cancellation clears the dragged card');
    };
    const assertBuddieDraftOnly=async(before)=>{
      assert.deepEqual(await readSavedPlan(),before,'Buddie assignment keeps the saved plan, revision and balance unchanged');
      assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[],'No launch, purchase or save is sent automatically');
      assert.equal(await page.evaluate(()=>window.__navigation??null),null,'Buddie gestures do not navigate into a culture');
    };
    const cellDelta=async(x,y)=>page.$eval('[data-warehouse-map]',(map,{x,y})=>{
      const matrix=map.getScreenCTM(),cell=Number(map.dataset.gridCellSize);
      return {x:x*cell*matrix.a,y:y*cell*matrix.d};
    },{x,y});
    const dragBy=async(start,delta,{cancel=false}={})=>{
      await page.mouse.move(start.x,start.y);await page.mouse.down();
      await page.mouse.move(start.x+delta.x,start.y+delta.y,{steps:8});
      await settleView();
      if(cancel)await page.keyboard.press('Escape');
      await page.mouse.up();await settleView();
    };
    const assertInitialFraming=async()=>{
      await settleView();
      const framing=await page.evaluate(()=>{
        const viewport=document.querySelector('[data-warehouse-map-viewport]'),map=document.querySelector('[data-warehouse-map]');
        const zone=map.querySelector('[data-zone-id][data-selected="true"]'),box=viewport.getBoundingClientRect(),rect=zone.getBoundingClientRect();
        const outline=zone.querySelector(':scope > rect[fill="transparent"]');
        const center=new DOMPoint(outline.x.baseVal.value+outline.width.baseVal.value/2,outline.y.baseVal.value+outline.height.baseVal.value/2).matrixTransform(map.getScreenCTM());
        const idealLeft=center.x-box.left-viewport.clientLeft+viewport.scrollLeft-viewport.clientWidth/2;
        const idealTop=center.y-box.top-viewport.clientTop+viewport.scrollTop-viewport.clientHeight/2;
        const expectedLeft=Math.max(0,Math.min(viewport.scrollWidth-viewport.clientWidth,idealLeft));
        const expectedTop=Math.max(0,Math.min(viewport.scrollHeight-viewport.clientHeight,idealTop));
        return {scenario:location.search,zoneId:zone.getAttribute('data-zone-id'),viewportWidth:innerWidth,zoom:Number(document.querySelector('input[aria-label="Zoom du plan"]').value),zoneWidth:rect.width,visible:rect.right>box.left&&rect.left<box.right&&rect.bottom>box.top&&rect.top<box.bottom,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,expectedLeft,expectedTop,centeringError:Math.hypot(viewport.scrollLeft-expectedLeft,viewport.scrollTop-expectedTop)};
      });
      measurements.initialFraming??={};measurements.initialFraming[framing.viewportWidth]=framing;
      measurements.initialFramingCases??=[];measurements.initialFramingCases.push(framing);
      assert.ok(framing.zoom>100,'Initial selection is enlarged automatically');
      assert.ok(framing.zoneWidth>=20,'Initial one-square-metre zone has a readable footprint');
      assert.equal(framing.visible,true,'Initial selected zone is visible in the framed viewport');
      assert.ok(framing.centeringError<2,'Initial selection is centered within the actual scrollable camera bounds');
    };
    const assertPlanAssets=async()=>{
      const assets=await page.$eval('[data-warehouse-map]',async map=>{
        const sources=[...new Set([...map.querySelectorAll('image')].map(node=>node.href.baseVal).filter(Boolean))];
        return Promise.all(sources.map(async source=>{const img=new Image();img.src=source;await img.decode();return {url:img.src,width:img.naturalWidth,height:img.naturalHeight};}));
      });
      assert.ok(assets.length>=2,'Illustrated room and equipment/plant bitmap assets exist');
      assert.ok(assets.some(asset=>asset.url.endsWith('/placard/warehouse-v4/overhead-room-sylvain-v1.webp')),'The plan uses the cartoon room matching the Sylvain village');
      for(const asset of assets){assert.ok(asset.url.startsWith(origin+'/'),'Plan assets are served locally');assert.ok(loadedAssets.has(asset.url),'Successful asset response: '+asset.url);assert.ok(asset.width>0&&asset.height>0,'Bitmap decodes: '+asset.url);}
      measurements.planAssets=assets;
      const grid=await geometry();
      assert.deepEqual({columns:grid.columns,rows:grid.rows},{columns:40,rows:25},'Exactly 1,000 square-metre cells');
      assert.ok(Number.isFinite(grid.x)&&Number.isFinite(grid.y)&&grid.cell>0,'Grid has a usable coordinate system');
    };
    if(!shopOnly&&!workshopOnly&&!chromeOnly&&!culturesOnly&&!buddieDragOnly){
    for(const width of [320,390,768,1440]){
      await page.setViewport({width,height:1000});await visit('expanded');await assertLayout();await assertPlanAssets();await assertInitialFraming();
      assert.deepEqual(await page.$$eval('[data-warehouse-room]',els=>els.map(el=>el.textContent.trim())),['Plan','Stockage','Atelier']);
      assert.deepEqual(await page.$$eval('section[aria-label="Prévision de production et débouchés"] h4',els=>els.map(el=>el.textContent)),['01 · Culture','02 · Séchage','03 · Stockage','04 · Transformation','05 · Ventes']);
      await page.screenshot({path:resolve(output,'culture-'+width+'.png'),fullPage:true});
      await clickRoom('storage');await assertLayout();assert.ok((await page.content()).includes('Stockage économique'));
      await page.screenshot({path:resolve(output,'storage-'+width+'.png'),fullPage:true});
      await clickRoom('processing');await page.waitForFunction(()=>document.querySelector('[data-warehouse-workshop]')?.textContent.includes('niveau 3'));await assertLayout();
      assert.equal(await page.$$eval('[data-warehouse-workshop] button[data-installed]',els=>els.length),6,'Six existing workshop slots');
      assert.equal(await page.$$eval('[data-warehouse-workshop] svg[role=img]',els=>els.length),0,'Workshop has no culture map');
      assert.equal(await page.evaluate(()=>document.querySelector('[data-warehouse-workshop]').textContent.includes('Tente 1')),false,'No legacy tent controls');
      await page.screenshot({path:resolve(output,'processing-'+width+'.png'),fullPage:true});
      checks.push('3 rooms at '+width+'px');
    }
    for(const width of [820,900]){
      await page.setViewport({width,height:1000});await visit('expanded');await assertLayout();
      const heading=await page.$eval('[data-warehouse-plan]',plan=>{
        const heading=plan.firstElementChild;
        return {width:heading.clientWidth,contentWidth:heading.scrollWidth};
      });
      assert.ok(heading.contentWidth<=heading.width+1,'Plan heading remains fully visible beside the inspector at '+width+'px');
      await page.screenshot({path:resolve(output,'culture-'+width+'.png'),fullPage:true});
    }
    checks.push('plan heading and controls fit beside the inspector at 820/900px');
    await page.setViewport({width:1440,height:1000});await visit();await assertLayout();
    await assertInitialFraming();
    const starterBitmaps=await page.$$eval('[data-warehouse-map] image',nodes=>new Set(nodes.map(node=>node.href.baseVal)).size);
    assert.ok(await page.$eval('[data-warehouse-plan]',node=>node.textContent.includes('m²')&&node.querySelector('[data-warehouse-plan-help]')?.open===false),'Starter shows its selected area with detailed help collapsed');
    assert.equal(await page.$$eval('[data-warehouse-map] [data-zone-id] rect',nodes=>nodes.some(node=>node.getAttribute('fill')?.includes('-plants-rows'))),false,'An idle zone displays equipment, not a launched crop');
    await page.screenshot({path:resolve(output,'culture-starter-1440.png'),fullPage:true});
    await visit('expanded&active');await assertLayout();
    assert.equal(await page.$$eval('[data-warehouse-map] [data-zone-id] rect',nodes=>nodes.some(node=>node.getAttribute('fill')?.includes('-plants-rows'))),true,'Active culture displays planted rows');
    await page.screenshot({path:resolve(output,'culture-active-1440.png'),fullPage:true});
    const fullStarted=performance.now();await visit('full');measurements.fullAreaNavigationMs=Math.round(performance.now()-fullStarted);
    await assertLayout();await assertPlanAssets();
    assert.deepEqual(await readInspector(),{x:0,y:0,width:40,height:25},'The full 1,000 square metres render as a usable allocation');
    measurements.fullAreaUniqueBitmaps=await page.$$eval('[data-warehouse-map] image',nodes=>new Set(nodes.map(node=>node.href.baseVal)).size);
    assert.equal(measurements.fullAreaUniqueBitmaps,starterBitmaps,'The full room reuses the same bitmap sources as the starter');
    await page.screenshot({path:resolve(output,'culture-full-1440.png'),fullPage:true});
    checks.push('starter close-up, active crop and full 1,000m² allocation with shared bitmap atlas');
    if(!visualOnly){
    for(const width of [320,390]){
      await page.setViewport({width,height:1000});await visit();
      await assertInitialFraming();await assertLayout();
    }
    checks.push('starter automatically frames a visible enlarged selection at desktop and 320/390px without overflow');
    await page.setViewport({width:1440,height:1000});await visit('expanded');await setZoom(200);
    const wheelAnchor=await pointAtCell(20,12);
    const worldAt=async point=>page.$eval('[data-warehouse-map]',(map,point)=>{
      const world=new DOMPoint(point.x,point.y).matrixTransform(map.getScreenCTM().inverse());
      return {x:world.x,y:world.y};
    },point);
    const beforeWheel=await worldAt(wheelAnchor),wheelSaved=await readSavedPlan(),wheelDraft=await readInspector();
    await page.mouse.move(wheelAnchor.x,wheelAnchor.y);await page.mouse.wheel({deltaY:-160});
    await page.waitForFunction(()=>Number(document.querySelector('input[aria-label="Zoom du plan"]').value)>200);
    await settleView();
    const afterWheel=await worldAt(wheelAnchor);
    assert.ok(Math.hypot(afterWheel.x-beforeWheel.x,afterWheel.y-beforeWheel.y)<3,'Wheel zoom keeps the same map point under the pointer');
    assert.deepEqual(await readInspector(),wheelDraft,'Wheel zoom preserves the selected draft');
    assert.deepEqual(await readSavedPlan(),wheelSaved,'Wheel zoom never mutates or spends');
    const panStart=await pointAtCell(20,12),panBefore=await page.$eval('[data-warehouse-map-viewport]',node=>({x:node.scrollLeft,y:node.scrollTop}));
    await dragBy(panStart,{x:80,y:60});
    const panAfter=await page.$eval('[data-warehouse-map-viewport]',node=>({x:node.scrollLeft,y:node.scrollTop}));
    assert.ok(Math.abs(panAfter.x-panBefore.x)>40&&Math.abs(panAfter.y-panBefore.y)>30,'Dragging the empty floor pans the viewport');
    assert.deepEqual(await readInspector(),wheelDraft,'Panning does not move the selected zone');
    assert.deepEqual(await readSavedPlan(),wheelSaved,'Panning preserves stored state and balance');
    checks.push('pointer-anchored wheel zoom and background drag pan preserve the selected draft and saved account');

    await visit('expanded');await setZoom(200);
    const transformSaved=await readSavedPlan();
    await page.click('[data-warehouse-tool="move"]');
    const moveStart=await pointAtCell(4,4);
    await dragBy(moveStart,await cellDelta(2,1));
    assert.deepEqual(await readInspector(),{x:4,y:3,width:6,height:5},'Dragging the selected zone moves the exact draft footprint');
    assert.deepEqual(await readSavedPlan(),transformSaved,'Moving a zone does not save or spend before confirmation');
    await page.click('[data-warehouse-tool="resize"]');
    await pointAtCell(10,8);
    const handle=await page.$('[data-warehouse-resize-handle]');assert.ok(handle,'Selected zone has a resize handle');
    const handleBox=await handle.boundingBox();assert.ok(handleBox,'Resize handle has screen coordinates');
    await dragBy({x:handleBox.x+handleBox.width/2,y:handleBox.y+handleBox.height/2},await cellDelta(1,1));
    assert.deepEqual(await readInspector(),{x:4,y:3,width:7,height:6},'Resize handle adds the intended square metres to the draft');
    assert.deepEqual(await readSavedPlan(),transformSaved,'Resizing never spends or saves before explicit purchase');
    await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
    assert.deepEqual(await page.evaluate(()=>{const zone=window.__snapshot.state.zones[0];return {x:zone.x,y:zone.y,width:zone.width,height:zone.height};}),{x:4,y:3,width:7,height:6},'Confirmed transformed footprint reaches the saved plan');
    assert.equal(await page.evaluate(()=>window.__requests.length),1,'Only the confirmation sends a warehouse mutation');
    checks.push('moving and resizing change only the quoted draft until one explicit save');

    await visit('expanded');await setZoom(200);await page.click('[data-warehouse-tool="move"]');
    const rejectedSaved=await readSavedPlan(),rejectedDraft=await readInspector();
    const overlapStart=await pointAtCell(4,4),overlapDelta=await cellDelta(8,0);
    await page.mouse.move(overlapStart.x,overlapStart.y);await page.mouse.down();
    await page.mouse.move(overlapStart.x+overlapDelta.x,overlapStart.y+overlapDelta.y,{steps:8});
    await page.waitForSelector('[data-warehouse-transform-preview][data-valid="false"]');
    await page.mouse.up();await settleView();
    assert.deepEqual(await readInspector(),rejectedDraft,'Overlapping drag is rejected without changing the inspector');
    assert.deepEqual(await readSavedPlan(),rejectedSaved,'Overlapping drag cannot mutate saved state or spend');
    const escapeStart=await pointAtCell(4,4);
    await dragBy(escapeStart,await cellDelta(1,2),{cancel:true});
    assert.equal(await page.$('[data-warehouse-transform-preview]'),null,'Escape clears the transform preview');
    assert.deepEqual(await readInspector(),rejectedDraft,'Escape restores the unchanged draft');
    assert.deepEqual(await readSavedPlan(),rejectedSaved,'Cancelled drag never sends a purchase');
    checks.push('overlapping transforms are rejected and Escape cancels a drag without draft or server mutation');

    await visit('expanded&active');await setZoom(200);
    const lockedSaved=await readSavedPlan(),lockedDraft=await readInspector();
    for(const tool of ['move','resize'])assert.equal(await page.$eval('[data-warehouse-tool="'+tool+'"]',node=>node.disabled),true,'Active culture disables '+tool);
    await dragBy(await pointAtCell(4,4),await cellDelta(1,1));
    assert.equal(await page.$('[data-warehouse-transform-preview]'),null,'Active culture cannot start a transform');
    assert.deepEqual(await readInspector(),lockedDraft,'Active culture preserves its footprint');
    assert.deepEqual(await readSavedPlan(),lockedSaved,'Active culture blocks plan spending');
    checks.push('an active culture locks mouse transforms as well as form inputs');

    await page.setViewport({width:390,height:1000,isMobile:true,hasTouch:true});await visit('expanded');await setZoom(200);
    const touchSaved=await readSavedPlan();
    const touchDragBy=async(start,delta)=>{
      await page.touchscreen.touchStart(start.x,start.y);
      for(let step=1;step<=6;step++)await page.touchscreen.touchMove(start.x+delta.x*step/6,start.y+delta.y*step/6);
      await page.touchscreen.touchEnd();await settleView();
    };
    await page.click('[data-warehouse-tool="move"]');await touchDragBy(await pointAtCell(4,4),await cellDelta(1,1));
    assert.deepEqual(await readInspector(),{x:3,y:3,width:6,height:5},'Touch drag moves the draft without scrolling it away');
    await page.click('[data-warehouse-tool="resize"]');await pointAtCell(9,8);
    const touchHandle=await page.$('[data-warehouse-resize-handle]'),touchHandleBox=await touchHandle?.boundingBox();
    assert.ok(touchHandleBox,'Resize handle remains reachable by touch');
    await touchDragBy({x:touchHandleBox.x+touchHandleBox.width/2,y:touchHandleBox.y+touchHandleBox.height/2},await cellDelta(1,1));
    assert.deepEqual(await readInspector(),{x:3,y:3,width:7,height:6},'Touch resize snaps the intended dimensions');
    assert.deepEqual(await readSavedPlan(),touchSaved,'Touch transformations never buy before confirmation');
    await assertLayout();checks.push('mobile touch can move and resize a draft without saving or horizontal overflow');

    await page.setViewport({width:1440,height:1000,isMobile:false,hasTouch:false});
    await visit('expanded');
    if(await page.evaluate(()=>document.fullscreenEnabled)){
      const fullscreenSaved=await readSavedPlan(),fullscreenDraft=await readInspector();
      await clickAction('fullscreen');await page.waitForFunction(()=>Boolean(document.fullscreenElement));
      assert.ok(await page.evaluate(()=>document.fullscreenElement.contains(document.querySelector('[data-warehouse-map]'))),'Fullscreen contains the interactive plan');
      await clickAction('fullscreen');await page.waitForFunction(()=>!document.fullscreenElement);
      assert.deepEqual(await readInspector(),fullscreenDraft,'Fullscreen leaves the selected draft unchanged');
      assert.deepEqual(await readSavedPlan(),fullscreenSaved,'Fullscreen never changes the saved plan');
      await assertLayout();checks.push('fullscreen enters and exits while preserving the plan and page layout');
      await clickAction('fullscreen');await page.waitForFunction(()=>Boolean(document.fullscreenElement));
      await clickAction('draw');await clickCell(20,8);await clickCell(21,9);
      await page.waitForFunction(()=>{
        const quote=document.querySelector('[data-warehouse-zone-quote]');
        if(!quote||!document.fullscreenElement?.contains(quote))return false;
        const box=quote.getBoundingClientRect();return box.top>=0&&box.top<innerHeight-40;
      });
      assert.deepEqual(await readInspector(),{x:20,y:8,width:2,height:2},'A new fullscreen zone reaches its accessible inspector');
      assert.deepEqual(await readSavedPlan(),fullscreenSaved,'Drawing in fullscreen remains a quote until confirmation');
      await clickAction('fullscreen');await page.waitForFunction(()=>!document.fullscreenElement);
      checks.push('fullscreen drawing keeps the inspector and purchase quote accessible without spending');
    }else measurements.fullscreen='not supported by this browser';
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    await visit('expanded&active');
    const sceneAnimations=async()=>page.evaluate(()=>document.getAnimations().filter(animation=>{
      const target=animation.effect?.target;
      return target instanceof Element&&target.closest('section[aria-label="Plan illustré de l’entrepôt"]')&&animation.playState==='running';
    }).length);
    await page.waitForFunction(()=>document.getAnimations().some(animation=>animation.effect?.target instanceof Element&&animation.effect.target.closest('section[aria-label="Plan illustré de l’entrepôt"]')&&animation.playState==='running'));
    assert.ok(await sceneAnimations()>0,'Living scene animates when motion is permitted');
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await settleView();
    assert.equal(await sceneAnimations(),0,'Reduced-motion preference stops ambient scene animation');
    await page.emulateMediaFeatures([]);
    checks.push('ambient motion exists and respects the reduced-motion preference');

    await page.setViewport({width:390,height:1000});
    for(const kind of ['drying','storage']){
      await visit();await page.click('[data-warehouse-draw-kind="'+kind+'"]');await clickAction('draw');
      await clickCell(7,6);await clickCell(9,7);
      await page.waitForFunction(()=>{const quote=document.querySelector('[data-warehouse-zone-quote]');if(!quote)return false;const box=quote.getBoundingClientRect();return box.top>=0&&box.top<innerHeight-40;});
      assert.deepEqual(await readInspector(),{x:7,y:6,width:3,height:2},'Six square metres allocated to '+kind);
      assert.equal(await page.$eval('[data-warehouse-zone-kind]',node=>node.dataset.warehouseZoneKind),kind);
      const expectedCapacity=kind==='drying'?6000:7200;
      assert.equal(await page.$eval('[data-warehouse-capacity-grams]',node=>Number(node.dataset.warehouseCapacityGrams)),expectedCapacity,'Displayed installed capacity before purchase');
      await openDetails('[data-warehouse-quote-details]');
      const recap=await page.$eval('[data-warehouse-zone-quote]',node=>node.textContent);
      for(const label of ['Surface','Coût complet de la zone','Coût neuf / m²','Capacité totale','Capacité par m²','À payer pour ce plan'])assert.ok(recap.includes(label),'Visible pre-purchase recap: '+label);
      assert.ok(recap.includes(kind==='drying'?'6 × Séchage économique':'24 × Stockage économique'),'The quote discloses the number and model of devices');
      assert.equal(await page.evaluate(()=>window.__requests.length),0,'Service drawing never buys before confirmation');
      assert.equal(await page.evaluate(()=>window.__snapshot.state.serviceZones.length),2,'Only the draft changes before confirmation');
      await assertLayout();await page.screenshot({path:resolve(output,'service-'+kind+'-quote-390.png'),fullPage:true});
      await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
      assert.deepEqual(await page.evaluate(()=>{const zone=window.__snapshot.state.serviceZones.at(-1);return {kind:zone.kind,x:zone.x,y:zone.y,width:zone.width,height:zone.height};}),{kind,x:7,y:6,width:3,height:2},'Service footprint reaches saved state');
    }
    checks.push('drying and storage rectangles show exact area, equipment, total/per-m² costs and capacity before any purchase');
    await page.setViewport({width:1440,height:1000});await visit();await clickRoom('storage');
    await page.click('[data-warehouse-place-device="CURTEC-60L"]');
    assert.equal(await page.$eval('[data-warehouse-draw-kind="storage"]',node=>node.getAttribute('aria-pressed')),'true','Storage catalogue opens the common plan with correct usage');
    await clickCell(12,7);await clickCell(13,7);
    assert.equal(await page.$eval('[data-warehouse-capacity-grams]',node=>Number(node.dataset.warehouseCapacityGrams)),24000,'Two square metres of four drums each provide 24,000 game grams');
    const material=await page.$('[data-warehouse-zone-kind="storage"] select');assert.ok(material);
    assert.equal(await material.evaluate(node=>node.value),'CURTEC-60L','Chosen material is retained when entering the plan');
    await material.select('BROR-JARS-48');
    assert.equal(await page.$eval('[data-warehouse-capacity-grams]',node=>Number(node.dataset.warehouseCapacityGrams)),4800,'Changing the storage system recomputes capacity');
    await material.select('CURTEC-60L');await assertLayout();
    await page.screenshot({path:resolve(output,'service-drum-quote-1440.png'),fullPage:true});
    await fill('Position X',0);await fill('Position Y',0);
    assert.match(await page.$eval('[role=alert]',node=>node.textContent),/chevauch|superposer/,'Storage cannot overlap cultivation when edited');
    assert.equal(await page.$eval('[data-warehouse-action="save"]',node=>node.disabled),true);
    checks.push('storage material chooser changes density and rejects overlap with cultivation');
    for(const [kind,x,y] of [['drying',0,0],['storage',0,24],['culture',2,24]]){
      await visit();await page.click('[data-warehouse-draw-kind="'+kind+'"]');await clickAction('draw');await clickCell(x,y);await clickCell(x,y);
      assert.match(await page.$eval('[role=alert]',node=>node.textContent),/chevauch|superposer/,'Shared footprint rejects '+kind+' over an occupied cell');
      assert.equal(await page.$$eval('[data-warehouse-map] [data-zone-id]',nodes=>nodes.length),3,'Rejected rectangle is not added');
      assert.equal(await page.evaluate(()=>window.__requests.length),0,'Rejected rectangle never spends');
    }
    checks.push('all three zone usages compete for the same cells with no overlap');
    await visit('legacy');await page.click('[data-warehouse-draw-kind="drying"]');await clickAction('draw');await clickCell(6,6);await clickCell(6,6);
    assert.ok(await page.$('[data-warehouse-adoption]'),'Historical capacity conversion is disclosed before commitment');
    assert.equal(await page.$eval('[data-warehouse-action="save"]',node=>node.disabled),true,'Cannot remove space needed by existing stocks');
    await page.click('[data-warehouse-draw-kind="storage"]');await clickAction('draw');await clickCell(8,6);await clickCell(8,6);
    await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
    assert.equal(await page.evaluate(()=>window.__snapshot.state.serviceZones.length),2,'Legacy owner can place drying and storage before adopting the common plan');
    checks.push('legacy capacity adoption warns before purchase and protects occupied storage');
    await visit('fragmented');
    assert.equal(await page.$eval('[data-warehouse-storage-free-grams]',node=>Number(node.dataset.warehouseStorageFreeGrams)),0,'Assigned drums reserve their full volume despite little product remaining');
    assert.equal(await page.$eval('[data-warehouse-storage-free-grams]',node=>node.dataset.warning),'true','Harvest storage alert includes assigned containers');
    await clickCell(2,24);await fill('Largeur',1);
    assert.ok(await page.$('[data-warehouse-capacity-blocked]'),'Reducing the capacity of assigned containers is explained');
    assert.equal(await page.$eval('[data-warehouse-action="save"]',node=>node.disabled),true,'Cannot remove the container capacity reserved by existing lots');
    await page.select('[data-warehouse-zone-kind="storage"] select','LP-SUPER-1L');
    assert.equal(await page.$eval('[data-warehouse-capacity-grams]',node=>Number(node.dataset.warehouseCapacityGrams)),1200,'Compact jar replacement still contains the actual 100 grams');
    assert.equal(await page.$eval('[data-warehouse-action="save"]',node=>node.disabled),false,'Changing container types permits the server to reallocate lots into smaller containers');
    await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
    assert.equal(await page.evaluate(()=>window.__snapshot.state.serviceZones.find(zone=>zone.kind==='storage').deviceCode),'LP-SUPER-1L','Compact replacement is submitted for authoritative allocation');
    checks.push('partly filled containers still occupy storage and block shrinking their reserved capacity');
    checks.push('changing container types permits compact reallocation using real product mass');
    for(const width of [390,1440]){
      await page.setViewport({width,height:1000});
      for(const zoom of [100,175,250,400]){
        await visit();await setZoom(100);const original=await geometry();await setZoom(zoom);const magnified=await geometry();
        assert.ok(Math.abs(magnified.width/original.width-zoom/100)<.005,'Rendered width follows exact '+zoom+'% zoom at '+width+'px');
        assert.ok(Math.abs(magnified.height/original.height-zoom/100)<.005,'Rendered height follows exact '+zoom+'% zoom at '+width+'px');
        await clickAction('draw');await clickCell(7,6);await clickCell(9,7);
        assert.deepEqual(await readInspector(),{x:7,y:6,width:3,height:2},'Pointer creates the intended six cells after scrolling and zoom');
        assert.equal(await page.evaluate(()=>window.__requests.length),0,'Pointer draft does not spend');
        await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
        assert.deepEqual(await page.evaluate(()=>{const zone=window.__snapshot.state.zones.at(-1);return {x:zone.x,y:zone.y,width:zone.width,height:zone.height};}),{x:7,y:6,width:3,height:2},'The exact pointer allocation reaches the saved state');
        await assertLayout();
      }
      await pointAtCell(8,6);await page.screenshot({path:resolve(output,'culture-zoom-400-'+width+'.png'),fullPage:true});
      checks.push('exact pointer allocation at 100/175/250/400% zoom and '+width+'px');
    }
    await page.setViewport({width:390,height:1000,isMobile:true,hasTouch:true});await visit();await setZoom(250);await clickAction('draw');
    await clickCell(-1,-1,true);await clickCell(39,24,true);await clickCell(39,24,true);
    assert.deepEqual(await readInspector(),{x:39,y:24,width:1,height:1},'Outside-floor touch ignored; final cell 1,000 can be placed exactly');
    await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
    assert.deepEqual(await page.evaluate(()=>{const zone=window.__snapshot.state.zones.at(-1);return {x:zone.x,y:zone.y,width:zone.width,height:zone.height};}),{x:39,y:24,width:1,height:1});
    await pointAtCell(39,24);await assertLayout();await page.screenshot({path:resolve(output,'culture-cell-1000-mobile.png'),fullPage:true});checks.push('mobile touch reaches cell 1,000 and ignores the room walls');
    await page.setViewport({width:1440,height:1000,isMobile:false,hasTouch:false});await visit();
    await clickAction('draw');
    await page.$eval('[data-warehouse-map]',node=>node.focus());
    await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.__requests.length),0,'Draft does not spend');
    assert.equal(await page.$$eval('[data-warehouse-map] [data-zone-kind="culture"]',els=>els.length),2,'Keyboard rectangle drawn');
    assert.deepEqual(await readInspector(),{x:2,y:2,width:3,height:2},'Keyboard rectangle has the exact coordinates and area');
    await clickAction('save');
    await page.waitForFunction(()=>window.__snapshot.revision===2);
    assert.equal(await page.evaluate(()=>window.__snapshot.state.zones.length),2);
    checks.push('keyboard 6m² creation and paid save');
    await fill('Position X',39);
    assert.ok((await page.$eval('[role=alert]',el=>el.textContent)).includes('dépasse'));
    assert.equal(await page.$eval('[data-warehouse-action="save"]',el=>el.disabled),true);
    checks.push('invalid layout cannot save');
    await visit();await fill('Largeur',2);
    await page.evaluate(()=>{window.__failOnce=true;});
    await clickAction('save');await page.waitForSelector('[role=alert]');
    await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
    assert.equal(await page.evaluate(()=>window.__requests[0].requestKey===window.__requests[1].requestKey),true,'Retry keeps idempotency key');
    checks.push('network retry keeps request identity');
    await visit('poor');await fill('Largeur',10);
    assert.equal(await page.$eval('[data-warehouse-action="save"]',el=>el.disabled),true);
    checks.push('insufficient funds blocks purchase');
    await visit('active');assert.equal(await page.$eval('input[type=number]',el=>el.disabled),true);
    await clickRoom('storage');assert.equal(await page.$$eval('[data-warehouse-place-device]',els=>els.length>=4&&els.every(el=>el.disabled)),true);
    checks.push('active run locks culture and storage layout purchases');
    await visit();await clickRoom('processing');await page.waitForFunction(()=>document.querySelector('[data-warehouse-workshop]')?.textContent.includes('niveau 3'));
    const workshopText=await page.$eval('[data-warehouse-workshop]',el=>el.textContent);
    assert.ok(workshopText.includes('Entretien'),'Legacy maintenance available');
    assert.ok(workshopText.includes('niveau 4'),'Legacy next-level upgrade available');
    await page.$$eval('[data-warehouse-workshop] details > summary',nodes=>nodes.find(node=>node.textContent.startsWith('Réglages fins'))?.click());
    await page.evaluate(()=>{window.__hold=true;});
    await clickText('Niveau 4');
    await page.waitForFunction(()=>window.__equipmentRequests.length===1&&typeof window.__release==='function');
    assert.deepEqual(await page.evaluate(()=>{const request=window.__equipmentRequests[0];return {action:request.action,equipmentCode:request.equipmentCode,tentNumber:request.tentNumber,expectedUnits:request.expectedUnits};}),{action:'upgrade',equipmentCode:'PRESS-0600',tentNumber:1,expectedUnits:4},'Existing shared-machine upgrade API and true account units');
    await page.waitForFunction(()=>[...document.querySelectorAll('[role=tab]')].every(el=>el.disabled),{timeout:3000});
    assert.equal(await page.$$eval('[role=tab]',els=>els.every(el=>el.disabled)),true,'Cannot hide an ongoing workshop purchase');
    await page.evaluate(()=>{window.__hold=false;window.__release();});
    await page.waitForFunction(()=>document.querySelector('[data-warehouse-workshop] [aria-label="Niveau du matériel"]')?.getAttribute('aria-valuenow')==='4');
    await clickText('Entretenir');
    await page.waitForFunction(()=>window.__equipmentRequests.length===2&&window.__workshop.maintenance['PRESS-0600'].cycles===0);
    assert.equal(await page.evaluate(()=>window.__equipmentRequests[1].action),'repair','Existing maintenance API');
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(el=>el.textContent==='Matériel de l’atelier commun'&&!el.disabled));
    await clickText('Matériel de l’atelier commun');
    await page.waitForSelector('[data-warehouse-workshop] #equipment-catalog-title');
    await assertLayout();
    assert.equal(await page.evaluate(()=>document.querySelector('[data-warehouse-workshop]').textContent.includes('Éclairage')),false,'Shop restricted to workshop equipment');
    await clickText('Retour à mes machines');await clickText('Ouvrir les lots');
    await page.waitForFunction(()=>document.body.textContent.includes('Ta réserve est vide'));
    checks.push('existing six-machine inventory, levels, maintenance, restricted shop and commerce connected');
    await visit('ready');await clickRoom('storage');await clickText('Utiliser ce lot à l’atelier');
    await page.waitForFunction(()=>document.body.textContent.includes('Que veux-tu obtenir ?'));
    assert.ok(await page.evaluate(()=>document.body.textContent.includes('Lot prêt pour l’atelier · 100 g')),'Storage-selected lot opens directly in original recipe workflow');
    const recipe=await page.$('select');assert.ok(recipe);await recipe.select('rosin-selection');
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent.startsWith('Transformer et continuer')).disabled),true,'Existing press level still gates advanced recipe');
    await recipe.select('rosin-trial');
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent.startsWith('Transformer et continuer')).disabled),false,'Unlocked recipe usable for ready stored lot');
    checks.push('ready storage lot reaches existing recipes with level requirements');
    await visit('overflow');await clickRoom('storage');await page.waitForFunction(()=>document.body.textContent.includes('Lot de reprise'));
    await page.evaluate(()=>[...document.querySelectorAll('summary')].find(el=>el.textContent.includes('sans contenant')).click());
    assert.equal(await page.evaluate(()=>document.body.textContent.includes('vente automatique au grossiste le')),false);
    await page.evaluate(()=>{window.__failOnce=true;});
    await clickText('Vendre le surplus');await page.waitForSelector('[role=alert]');await clickText('Vendre le surplus');
    await page.waitForFunction(()=>document.body.textContent.includes('Surplus vendu au grossiste'));
    assert.equal(await page.evaluate(()=>window.__storageRequests[0].requestKey===window.__storageRequests[1].requestKey),true);
    assert.equal(await page.evaluate(()=>window.__snapshot.stockGrams),0);
    checks.push('legacy surplus remains sellable with safe retry');
    }
    }
    if(!visualOnly&&!chromeOnly&&!culturesOnly&&!buddieDragOnly){
      if(!workshopOnly){
      const shop='[data-warehouse-shop]';
      const openShop=async()=>{await clickAction('shop');await page.waitForSelector(shop,{visible:true});await settleView();};
      const closeShop=async()=>{await page.click(shop+' [aria-label="Fermer la boutique"]');await page.waitForSelector(shop,{hidden:true});};
      const category=async name=>{await page.click('[data-warehouse-shop-category="'+name+'"]');await settleView();};
      const choose=async code=>{await page.click('[data-warehouse-shop-choose="'+code+'"]');await page.waitForSelector('[data-warehouse-shop-product="'+code+'"][data-chosen="true"]');};
      const assertShopLayout=async()=>{
        await assertLayout();
        const box=await page.$eval(shop,node=>{const box=node.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:node.clientWidth,contentWidth:node.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight};});
        assert.ok(box.left>=-1&&box.right<=box.viewportWidth+1,'Shop fits horizontally inside the viewport');
        assert.ok(box.top>=-1&&box.bottom<=box.viewportHeight+1,'Shop stays within the visible viewport');
        assert.ok(box.contentWidth<=box.width+1,'Shop content does not overflow its modal horizontally');
      };

      await page.setViewport({width:1440,height:1000,isMobile:false,hasTouch:false});await visit('expanded');
      const beforeBrowsing=await readSavedPlan();await openShop();
      assert.equal(await page.$eval(shop,node=>node.tagName),'DIALOG','Shop uses a native modal dialog');
      assert.equal(await page.$eval(shop,node=>node.contains(document.activeElement)),true,'Opening the shop moves keyboard focus inside');
      const families=['lighting','air','water','climate','control','hygiene','logistics','security','substrate','nutrition','drying','storage'];
      assert.equal(await page.$('[data-warehouse-shop-category="references"]'),null,'Commercial catalogue was removed from the shop');
      for(const family of families){
        await category(family);
        const offers=await page.$$eval('[data-warehouse-shop-product]',nodes=>nodes.map(node=>({code:node.dataset.warehouseShopProduct,tier:node.dataset.tier,text:node.textContent,price:node.querySelector('[data-warehouse-shop-price]')?.textContent,action:!!node.querySelector('[data-warehouse-shop-choose]')})));
        assert.equal(offers.length,3,'Exactly three purchasable alternatives in '+family);
        assert.deepEqual(offers.map(item=>item.tier),['economy','standard','premium'],'Consistent tier order in '+family);
        for(const offer of offers){assert.ok(offer.action&&offer.price?.includes('€'),'Every '+family+' offer has an explicit game price and purchase choice');assert.ok(offer.text.includes('m²'),'Surface pricing is visible');}
        const text=await page.$eval(shop,node=>node.textContent);
        for(const label of ['Économique','Standard','Haut de gamme'])assert.ok(text.includes(label),'Tier label '+label+' is visible');
        assert.ok(!/Prix non relevé|Sur devis|Terralba|Mars Hydro|Secret Jardin|Le Parfait|CurTec|Graveda|IKEA/.test(text),'The shop only displays fictional priced equipment');
        assert.equal(await page.$('[data-warehouse-shop-compare]'),null,'Choosing equipment needs no separate comparison selection');
      }
      measurements.shopTiers={families:families.length,offers:families.length*3};
      assert.deepEqual(await readSavedPlan(),beforeBrowsing,'Browsing the three tiers never mutates the saved plan or balance');
      await page.keyboard.press('Escape');await page.waitForSelector(shop,{hidden:true});
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-warehouse-action')),'shop','Escape restores focus to the opening button');
      assert.deepEqual(await readSavedPlan(),beforeBrowsing,'Closing the comparison remains free');
      checks.push('shop presents exactly three priced actionable tiers in all twelve equipment families with no commercial catalogue or comparison step');

      await openShop();await category('lighting');
      const alternativeLight=await page.$eval('[data-warehouse-shop-product][data-chosen="false"]',node=>({code:node.dataset.warehouseShopProduct,name:node.querySelector('h4').textContent}));
      await choose(alternativeLight.code);await closeShop();
      assert.ok((await page.$eval('[data-warehouse-zone-quote]',node=>node.textContent)).includes(alternativeLight.name),'Physical lighting choice reaches the zone quote');
      assert.deepEqual(await readSavedPlan(),beforeBrowsing,'Changing lighting through the shop still waits for the main quote');
      await clickAction('reset');
      await visit();const beforeService=await readSavedPlan();await openShop();await category('drying');
      const drying=await page.$eval('[data-warehouse-shop-product][data-tier="premium"]',node=>({code:node.dataset.warehouseShopProduct,name:node.querySelector('h4').textContent}));
      await page.click('[data-warehouse-shop-choose="'+drying.code+'"]');await page.waitForSelector(shop,{hidden:true});
      await clickCell(7,6);await clickCell(9,7);
      assert.equal(await page.$eval('[data-warehouse-zone-kind]',node=>node.dataset.warehouseZoneKind),'drying','Shop service choice opens drawing for the correct zone usage');
      assert.ok((await page.$eval('[data-warehouse-zone-quote]',node=>node.textContent)).includes(drying.name),'Selected service device reaches the drawing quote');
      assert.deepEqual(await readSavedPlan(),beforeService,'Service placement from the shop is only a draft');
      await clickAction('save');await page.waitForFunction(()=>window.__snapshot.revision===2);
      assert.equal(await page.evaluate(()=>window.__snapshot.state.serviceZones.at(-1).deviceCode),drying.code,'The exact service device is stored after confirmation');
      checks.push('shop offers all eight three-choice families and connects physical lighting and service placement to the existing quote');

      const persistenceId='shop-'+Date.now();await visit('expanded&persist='+persistenceId);
      const beforePurchase=await readSavedPlan();await openShop();await category('water');
      await choose('SIM-WATER-01');await choose('SIM-WATER-02');
      const waterName=await page.$eval('[data-warehouse-shop-product="SIM-WATER-02"] h4',node=>node.textContent);
      assert.equal(await page.$eval('[data-warehouse-shop-product="SIM-WATER-01"]',node=>node.dataset.chosen),'false','Selecting a second profile replaces the first in its family');
      await category('nutrition');await choose('SIM-NUTRITION-02');
      const nutritionName=await page.$eval('[data-warehouse-shop-product="SIM-NUTRITION-02"] h4',node=>node.textContent);await closeShop();
      assert.deepEqual(await readSavedPlan(),beforePurchase,'Choosing modules only changes the draft');
      const moduleRecap=await page.$eval('[data-warehouse-zone-modules]',node=>node.textContent);
      assert.ok(moduleRecap.includes(waterName)&&moduleRecap.includes(nutritionName),'Inspector lists both draft modules');
      assert.ok(moduleRecap.includes('/m²')&&moduleRecap.includes('/m²/cycle'),'Module investment and recurring prices retain the surface unit');
      assert.equal(await page.$$eval('[data-warehouse-module]',nodes=>new Set(nodes.map(node=>node.dataset.warehouseModule)).size),2,'Selected modules appear as objects in the room');
      await openDetails('[data-warehouse-quote-details]');
      const purchaseQuote=await page.$eval('[data-warehouse-zone-quote]',node=>node.textContent);
      for(const label of ['30 m²','Coût neuf / m²','Dont équipements au m²','Charges / m² / cycle','Dont fournitures / m²'])assert.ok(purchaseQuote.includes(label),'Pre-purchase quote includes '+label);
      await page.evaluate(()=>{window.__loseResponseOnce=true;});await clickAction('save');await page.waitForSelector('[role=alert]');
      const afterCommit=await readSavedPlan();assert.equal(afterCommit.revision,2,'Fixture committed the purchase before losing its response');
      await clickAction('save');await page.waitForFunction(()=>window.__requests.length===2&&document.body.textContent.includes('Aménagement installé.'));
      const purchase=await page.evaluate(()=>({requests:window.__requests,snapshot:window.__snapshot}));
      assert.equal(purchase.requests[0].requestKey,purchase.requests[1].requestKey,'An uncertain purchase retries with the same receipt identity');
      assert.equal(purchase.snapshot.revision,2,'Retry does not create another revision');
      assert.equal(beforePurchase.cashCents-purchase.snapshot.cashCents,purchase.requests[0].expectedCostCents,'Cash is debited exactly once by the confirmed quote');
      assert.deepEqual(purchase.snapshot.state.zones[0].optionCodes,['SIM-WATER-02','SIM-NUTRITION-02'],'The saved zone has one profile per chosen family');
      assert.deepEqual(purchase.snapshot.state.zones[1].optionCodes??[],[],'Unselected zone remains unchanged');
      await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-zone-modules]');
      assert.deepEqual((await readSavedPlan()).state,purchase.snapshot.state,'A fresh frontend load restores the persisted fixture response');
      assert.equal((await readSavedPlan()).cashCents,purchase.snapshot.cashCents,'Reload does not debit the purchase again');
      assert.equal(await page.$eval('[data-warehouse-action="save"]',node=>node.disabled),true,'Reloaded saved modules do not create a new unsaved quote');
      await openShop();await category('water');
      assert.equal(await page.$eval('[data-warehouse-shop-product="SIM-WATER-02"]',node=>node.dataset.chosen),'true','The reopened shop restores the purchased choice');
      await category('nutrition');await page.click('[data-warehouse-shop-remove="nutrition"]');await closeShop();
      assert.ok(!(await page.$eval('[data-warehouse-zone-modules]',node=>node.textContent)).includes(nutritionName),'Removing a module updates the draft inspector');
      assert.deepEqual((await readSavedPlan()).state,purchase.snapshot.state,'Removing a draft module does not discard purchased inventory');
      await clickAction('reset');
      assert.ok((await page.$eval('[data-warehouse-zone-modules]',node=>node.textContent)).includes(nutritionName),'Cancel restores the saved module choice');
      checks.push('module choice replaces within a family, scales to zone area, saves once after lost response and survives frontend reload');

      await visit('expanded&active');const beforeLocked=await readSavedPlan();await openShop();await category('water');
      assert.equal(await page.$$eval('[data-warehouse-shop-choose]',nodes=>nodes.length===3&&nodes.every(node=>node.disabled)),true,'Active culture allows browsing but locks installation');
      assert.equal(await page.$$eval('[data-warehouse-shop-price]',nodes=>nodes.length),3,'Locked equipment still shows all three prices');await closeShop();
      assert.deepEqual(await readSavedPlan(),beforeLocked,'Locked comparison cannot mutate the active plan');
      await visit('expanded&poor');const beforePoor=await readSavedPlan();await openShop();await category('water');await choose('SIM-WATER-02');await closeShop();
      assert.equal(await page.$eval('[data-warehouse-action="save"]',node=>node.disabled),true,'Insufficient funds disable the actual purchase');
      assert.deepEqual(await readSavedPlan(),beforePoor,'Unaffordable draft does not spend');
      checks.push('shop preserves active-culture locks and blocks purchases beyond the available balance');

      for(const width of [1440,390,320]){
        await page.setViewport({width,height:1000,isMobile:width<600,hasTouch:width<600});await visit('expanded');await openShop();
        for(const family of ['lighting','nutrition','drying','storage']){
          await category(family);await assertShopLayout();
          assert.equal(await page.$$eval('[data-warehouse-shop-product]',nodes=>nodes.length),3,'Three readable cards at '+width+' in '+family);
          await page.screenshot({path:resolve(output,'shop-tiers-'+family+'-'+width+'.png')});
          const finalChoice=await page.$('[data-warehouse-shop-product][data-tier="premium"]');await finalChoice.evaluate(node=>node.scrollIntoView({block:'center'}));await settleView();
          await assertShopLayout();
          const stable=await page.$eval(shop,node=>({top:node.scrollTop,left:node.scrollLeft,closeTop:node.querySelector('[aria-label="Fermer la boutique"]').getBoundingClientRect().top}));
          assert.equal(stable.top,0,'Browsing offers keeps the modal header fixed');assert.equal(stable.left,0,'Cards never horizontally move the modal');assert.ok(stable.closeTop>=0,'Close stays visible');
        }
        await closeShop();
      }
      checks.push('direct tier cards and their purchase actions remain readable at 1440, 390 and 320 pixels');
      }

      for(const width of [1440,390,320]){
        await page.setViewport({width,height:1000,isMobile:width<600,hasTouch:width<600});await visit('expanded');await clickRoom('processing');
        await page.waitForSelector('[data-workshop-tiers]');await assertLayout();await assertWorkshopTierLayout('installed-'+width);
        await page.screenshot({path:resolve(output,'processing-'+width+'.png'),fullPage:true});
        await visit('newWorkshop');await clickRoom('processing');
        await clickText('Matériel de l’atelier commun');await page.waitForSelector('#equipment-catalog-title');
        const name=await page.evaluate(()=>window.__machines.find(item=>item.code==='SIFT-TRAY').name);
        const machineButton='button[aria-label='+JSON.stringify('Voir '+name)+']';
        await page.waitForSelector(machineButton,{visible:true});
        // The inventory opens its suggested machine directly. On narrow screens
        // that detail covers the catalogue; dismiss it before choosing another.
        const suggestedDetail=await page.$('button[aria-label="Fermer la fiche"]');
        if(suggestedDetail){await suggestedDetail.click();await page.waitForSelector('button[aria-label="Fermer la fiche"]',{hidden:true});}
        await page.click(machineButton);await page.waitForSelector('[data-workshop-tiers="SIFT-TRAY"]');
        const tiers=await page.$$eval('[data-workshop-tiers="SIFT-TRAY"] [data-workshop-tier]',nodes=>nodes.map(node=>({level:node.dataset.workshopTier,label:node.querySelector('small').textContent,price:node.querySelector('b').textContent})));
        assert.deepEqual(tiers.map(item=>item.level),['1','4','7'],'Every machine offers the three actual acquisition tiers');
        assert.deepEqual(tiers.map(item=>item.label),['Économique','Standard','Haut de gamme'],'Workshop uses the same three tier labels');
        assert.ok(tiers.every(item=>item.price.includes('€')),'Every workshop tier displays its complete acquisition price');
        await page.$eval('[data-workshop-tiers="SIFT-TRAY"]',node=>node.scrollIntoView({block:'start'}));await settleView();await assertLayout();
        const bounds=await page.$eval('[data-workshop-tiers="SIFT-TRAY"]',node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth};});
        assert.ok(bounds.left>=-1&&bounds.right<=bounds.viewport+1,'Workshop tier cards stay inside the viewport');
        const overflowingControls=await page.$$eval('[data-workshop-tier]',cards=>cards.flatMap(card=>{
          const box=card.getBoundingClientRect();
          return [...card.querySelectorAll('button,b')].filter(node=>{const rect=node.getBoundingClientRect();return rect.left<box.left-1||rect.right>box.right+1;}).map(node=>node.textContent);
        }));
        assert.deepEqual(overflowingControls,[],'Workshop prices and purchase buttons stay inside each card at '+width);
        await assertWorkshopTierLayout('catalog-'+width);await page.screenshot({path:resolve(output,'workshop-tiers-'+width+'.png')});
        if(width===1440){
          const cashBefore=await page.evaluate(()=>window.__snapshot.cashCents);
          await page.click('[data-workshop-tier-choose="4"]');
          assert.equal(await page.evaluate(()=>window.__equipmentRequests.length),0,'Choosing a workshop tier asks for confirmation before spending');
          await page.evaluate(()=>{window.__loseResponseOnce=true;window.__hold=true;});await page.click('[data-workshop-tier-confirm]');
          await page.waitForFunction(()=>window.__equipmentRequests.length===1&&typeof window.__release==='function');
          assert.equal(await page.$eval('[data-workshop-tier-confirm]',node=>node.disabled),true,'The confirmation cannot be double-clicked');
          await page.evaluate(()=>{window.__hold=false;window.__release();});await page.waitForSelector('[data-workshop-tiers] [role="alert"]');
          await page.click('[data-workshop-tier-confirm]');await page.waitForFunction(()=>window.__equipmentRequests.length===2&&document.querySelector('[data-workshop-tier="4"]')?.dataset.attained==='true');
          const result=await page.evaluate(()=>({requests:window.__equipmentRequests,cash:window.__snapshot.cashCents,workshop:window.__workshop}));
          assert.equal(result.requests[0].requestKey,result.requests[1].requestKey,'Lost workshop response reuses its purchase identity');
          assert.equal(result.requests[0].action,'workshop-tier');assert.equal(result.requests[0].targetLevel,4);assert.equal(result.requests[0].expectedLevel,0);
          assert.equal(result.workshop.levels['SIFT-TRAY'],4,'Direct standard acquisition arrives at the real level');
          assert.equal(cashBefore-result.cash,88000,'Standard acquisition is charged exactly once');
          assert.ok(!result.workshop.equippedCodes.includes('SIFT-TRAY'),'New ownership does not silently change the installed workshop');
        }
      }
      checks.push('workshop offers three complete prices, confirms direct acquisition and retries a lost response without duplicate spending at desktop and mobile sizes');

    }
    if(chromeOnly){
      for(const width of [320,390]){
        await page.setViewport({width,height:1050,isMobile:true,hasTouch:true});await visit('expanded&modal');await assertLayout();await assertInitialFraming();
        assert.equal(await page.$eval('[data-warehouse-v4]',node=>node.getAttribute('aria-modal')),'true','Fixture exercises the real modal');
        assert.equal(await page.$eval('[data-warehouse-v4]',node=>node.scrollWidth<=node.clientWidth+1),true,'Modal has no internal horizontal overflow at '+width);
        for(const selector of ['[data-warehouse-action="shop"]','button[aria-label="Actualiser l’entrepôt"]','button[aria-label="Fermer l’entrepôt"]']){
          const bounds=await page.$eval(selector,node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});
          assert.ok(bounds.width>0&&bounds.height>0&&bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=1050,'Modal header action remains visible at '+width+': '+selector);
        }
        assert.equal(await page.$eval('[data-warehouse-plan-help]',node=>node.open),false,'Plan instructions start collapsed');
        assert.equal(await page.$eval('[data-warehouse-zone-settings]',node=>node.open),false,'Advanced zone fields start collapsed');
        assert.equal(await page.$eval('[data-warehouse-quote-details]',node=>node.open),false,'Detailed price breakdown starts collapsed');
        assert.equal(await page.$eval('[data-warehouse-forecast]',node=>node.open),false,'Forecast starts collapsed');
        assert.match(await page.$eval('[data-warehouse-zone-quote]',node=>node.textContent),/Coût neuf \/ m²/,'Selected quote distinguishes new-equipment cost from the payable amount');
        // A fixed modal already fills the viewport. Full-page capture can paint
        // nested SVG scrollers at their origin despite unchanged DOM scroll values.
        await page.screenshot({path:resolve(output,'modal-simple-'+width+'.png'),fullPage:false});
        await openDetails('[data-warehouse-plan-help]');assert.ok(await page.$eval('input[aria-label="Zoom du plan"]',node=>node.getBoundingClientRect().height>0),'Fine zoom remains reachable through Help');
        await page.click('[data-warehouse-plan-help] > summary');
        await page.click('button[aria-label="Fermer l’entrepôt"]');await page.waitForSelector('[data-warehouse-closed]');assert.equal(await page.evaluate(()=>window.__closeCount),1,'Close calls the parent once');
        assert.equal(await page.$('[data-warehouse-v4]'),null,'The fixture removes the modal when closed');
      }
      checks.push('simplified modal at320/390 keeps every header action visible, folds secondary information and closes exactly once');
      for(const width of [1440,390,320]){
        await page.setViewport({width,height:1050,isMobile:width<600,hasTouch:width<600});await visit('expanded&modal');await clickAction('shop');await page.waitForSelector('[data-warehouse-shop]',{visible:true});
        const snapshot=await readSavedPlan();
        for(const family of ['lighting','water']){
          await page.click('[data-warehouse-shop-category="'+family+'"]');await settleView();
          assert.equal(await page.$$eval('[data-warehouse-shop-product]',nodes=>nodes.length),3,'The simplified shop retains all three choices');
          const bounds=await page.$eval('[data-warehouse-shop]',node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:node.scrollWidth>node.clientWidth+1};});
          assert.ok(bounds.left>=-1&&bounds.right<=width+1&&bounds.top>=-1&&bounds.bottom<=1051&&!bounds.overflow,'Shop stays inside the '+width+' viewport');
          const premium=await page.$('[data-warehouse-shop-product][data-tier="premium"]');await premium.evaluate(node=>node.scrollIntoView({block:'center'}));await settleView();
          const action=await premium.$('button[data-warehouse-shop-choose]');assert.ok(action);assert.ok(await action.evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),'Last tier action is reachable at '+width);
          await page.$eval('[data-warehouse-shop-product]',node=>node.scrollIntoView({block:'start'}));await settleView();await page.screenshot({path:resolve(output,'shop-simple-'+family+'-'+width+'.png')});
        }
        await page.click('[aria-label="Fermer la boutique"]');await page.waitForSelector('[data-warehouse-shop]',{hidden:true});
        assert.deepEqual(await readSavedPlan(),snapshot,'Browsing simplified offers does not save or spend');
        assert.equal(await page.evaluate(()=>window.__closeCount),0,'Closing the shop keeps its parent modal open');
        await page.click('button[aria-label="Fermer l’entrepôt"]');await page.waitForSelector('[data-warehouse-closed]');
      }
      checks.push('simplified shop keeps three priced choices and reachable purchase actions at1440/390/320 while closing independently of the warehouse');
    }
    if(culturesOnly){
      for(const width of [1440,390,320]){
        await page.setViewport({width,height:1000});await visit('cultures');await assertLayout();await assertPlanAssets();
        assert.equal(await page.$('[data-warehouse-action="draw"]'),null,'Culture mode hides editing tools');
        assert.equal(await page.$$eval('[data-zone-buddie]',nodes=>nodes.length),2,'Assigned Buddies appear on their zones');
        assert.equal(await page.$eval('[data-warehouse-culture-action="resume"]',node=>node.getAttribute('href')),'/arene/placard?view=game&zone=starter&run=11111111-1111-4111-8111-111111111111');
        await page.screenshot({path:resolve(output,'cultures-'+width+'.png'),fullPage:true});
        await clickCell(4,4);assert.ok((await page.evaluate(()=>window.__navigation)).includes('run=11111111'),'Click occupied zone resumes its specific run');
        await clickCell(12,3);await page.waitForSelector('[data-warehouse-culture="second"]');
        assert.equal(await page.$eval(buddieCard('HH2026-002'),node=>node.getAttribute('aria-disabled')==='true'||node.disabled),true,'Occupied and rotating Buddie is unavailable');
        await page.click(buddieCard('HH2026-003'));await clickCell(12,3);
        await page.click('[data-warehouse-culture-action="save"]');
        await page.waitForFunction(()=>window.__snapshot.state.zones.find(zone=>zone.id==='second').buddieCode==='HH2026-003');
        assert.equal(await page.evaluate(()=>window.__snapshot.state.zones.find(zone=>zone.id==='second').buddieCode),'HH2026-003');
        assert.equal(await page.$('[data-warehouse-campaign-action="start"]'),null,'An independent legacy culture must finish before the next campaign');
        await clickText('Aménager');
        await clickCell(3,3);await openDetails('[data-warehouse-zone-settings]');
        assert.equal(await page.$eval('[data-warehouse-zone-settings] input',node=>node.disabled),true,'Occupied zone is immutable');
        assert.equal(await page.$eval('[data-warehouse-tool="move"]',node=>node.disabled),true,'Occupied zone cannot move');
        await clickAction('shop');
        assert.equal(await page.$eval('[data-warehouse-shop-product][data-tier="premium"] button[data-warehouse-shop-choose]',node=>node.disabled),true,'The occupied zone cannot acquire replacement equipment');
        await page.click('[data-warehouse-shop-category="storage"]');
        assert.equal(await page.$eval('[data-warehouse-shop-product][data-tier="premium"] button[data-warehouse-shop-choose]',node=>node.disabled),false,'Shared storage can expand while a culture is active');
        await page.click('[aria-label="Fermer la boutique"]');
        await clickCell(12,3);await fill('Nom de la zone','La relève libre');
        await clickAction('save');await page.waitForFunction(()=>window.__snapshot.state.zones.find(zone=>zone.id==='second').name==='La relève libre');
        assert.equal(await page.evaluate(()=>window.__snapshot.activeRuns.length),1,'Editing a free zone preserves the ongoing culture');
        await clickText('Cultures');await page.evaluate(()=>{window.__navigation=null;});await clickCell(20,3);
        assert.equal(await page.evaluate(()=>window.__navigation),null,'An idle zone does not start a parallel campaign during an independent legacy culture');
        await assertLayout();checks.push('zone portraits, Buddie assignment, exact run/zone navigation and free-zone editing at '+width+'px');
        await visit('readyCampaign');await assertLayout();await assertInitialFraming();
        assert.equal(await page.$eval('[data-warehouse-campaign-action="start"]',node=>node.getAttribute('href')),'/arene/placard?view=game&campaign=1','Placed available Buddies share one campaign preparation');
        await clickCell(20,3);assert.equal(await page.evaluate(()=>window.__navigation),'/arene/placard?view=game&campaign=1','An idle assigned zone opens the common campaign');
        await page.screenshot({path:resolve(output,'campaign-ready-'+width+'.png'),fullPage:true});
        await visit('campaign');await assertLayout();await assertInitialFraming();
        assert.equal(await page.$eval('[data-warehouse-campaign-action="resume"]',node=>node.getAttribute('href')),'/arene/placard?view=game&campaign=1&run=11111111-1111-4111-8111-111111111111','The campaign toolbar resumes the canonical run');
        for(const point of [[4,4],[20,3]]){await clickCell(...point);assert.equal(new URL(await page.evaluate(()=>window.__navigation),origin).searchParams.get('run'),'11111111-1111-4111-8111-111111111111','Each occupied member zone resumes the same campaign leader');}
        assert.equal(await page.$$eval('[data-zone-buddie]',nodes=>new Set(nodes.map(node=>node.getAttribute('data-zone-buddie'))).size),2,'The shared campaign retains two distinct zone Buddies');
        await page.screenshot({path:resolve(output,'campaign-active-'+width+'.png'),fullPage:true});
        assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[],'Browsing the shared campaign performs no purchase or gameplay mutation');
        checks.push('shared campaign preparation and both member-zone links retain one leader at '+width+'px');
      }
    }
    if(buddieDragOnly){
      for(const width of [1440,390,320]){
        const touch=width<600;
        await page.setViewport({width,height:1000,isMobile:touch,hasTouch:touch});
        await visit('cultures&buddieDrag&persist=buddie-'+width);await page.waitForSelector('[data-warehouse-buddie-dock]');await assertLayout();
        await setZoom(touch?350:175);
        const before=await readSavedPlan();
        await dragBuddie('HH2026-003',{x:12,y:3},{touch,capture:'buddie-drag-'+width+'.png'});
        assert.equal((await readBuddieAssignments()).second,'HH2026-003','Dropping over a free zone assigns its draft');
        await assertBuddieDraftOnly(before);
        await page.click('[data-warehouse-culture-action="save"]');
        await page.waitForFunction(()=>window.__snapshot.state.zones.find(zone=>zone.id==='second').buddieCode==='HH2026-003');
        const saved=await readSavedPlan();
        assert.equal(saved.requests,1,'One explicit save persists the assignment');assert.equal(saved.cashCents,before.cashCents,'Assigning an owned Buddie is free');
        await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-map]');await enterCultures();
        assert.equal((await readBuddieAssignments()).second,'HH2026-003','The saved assignment survives a new frontend load');
        await assertLayout();await page.screenshot({path:resolve(output,'buddie-dock-'+width+'.png')});
        checks.push('real '+(touch?'CDP touch':'left mouse')+' drag at '+width+'px assigns a free zone, spends nothing and persists only after Save');

        await visit('cultures&buddieDrag');await setZoom(touch?350:175);
        const replacementBefore=await readSavedPlan();
        await dragBuddie('HH2026-003',{x:20,y:3},{touch});
        assert.equal((await readBuddieAssignments()).third,'HH2026-003','A free assigned zone accepts a replacement Buddie');
        await assertBuddieDraftOnly(replacementBefore);
        checks.push('replacing a Buddie on an idle assigned zone remains an unsaved draft at '+width+'px');

        await visit('cultures&buddieDrag');await setZoom(touch?350:175);
        const transferBefore=await readSavedPlan();
        await dragBuddie('HH2026-004',{x:12,y:3},{touch});
        const transferred=await readBuddieAssignments();
        assert.equal(transferred.second,'HH2026-004','Dropping an assigned card transfers it to the target zone');
        assert.equal(transferred.third,null,'The previous idle zone releases the transferred Buddie');
        await assertBuddieDraftOnly(transferBefore);
        checks.push('moving an already assigned Buddie releases its previous idle zone without saving at '+width+'px');

        for(const [label,cell] of [['empty floor',{x:9,y:10}],['storage service',{x:2,y:24}],['occupied culture',{x:4,y:4}]]){
          await visit('cultures&buddieDrag');await setZoom(touch?350:175);
          const invalidBefore=await readSavedPlan(),assignments=await readBuddieAssignments();
          await dragBuddie('HH2026-003',cell,{touch});
          assert.deepEqual(await readBuddieAssignments(),assignments,'Invalid drop onto '+label+' cannot affect any zone');
          await assertBuddieDraftOnly(invalidBefore);
        }
        checks.push('floor, shared storage and occupied cultures reject actual drops at '+width+'px');

        await visit('cultures&buddieDrag');await setZoom(touch?350:175);
        const cancelBefore=await readSavedPlan(),cancelAssignments=await readBuddieAssignments();
        await page.evaluate(()=>{window.__cancelledTouches=0;window.addEventListener('pointercancel',()=>window.__cancelledTouches++,{capture:true});});
        await dragBuddie('HH2026-003',{x:12,y:3},{touch,cancel:true});
        if(touch)assert.ok(await page.evaluate(()=>window.__cancelledTouches>0),'CDP touchCancel emits a real pointercancel event');
        assert.deepEqual(await readBuddieAssignments(),cancelAssignments,'Cancellation preserves every draft assignment');
        await assertBuddieDraftOnly(cancelBefore);
        checks.push((touch?'native touch cancellation':'Escape during left mouse drag')+' cancels assignment at '+width+'px');

        for(const [code,reason] of [['HH2026-002','active'],['HH2026-005','rotation']]){
          assert.equal(await page.$eval(buddieCard(code),node=>node.dataset.buddieBlocked),reason,'Unavailable card exposes its reason');
          await page.$eval(buddieCard(code),node=>node.scrollIntoView({block:'nearest',inline:'center'}));
          const card=await page.$(buddieCard(code));await card.click();
          await page.waitForSelector('[data-buddie-variety-popover="'+code+'"]',{visible:true});
          assert.notEqual(await card.evaluate(node=>node.dataset.selected),'true','Unavailable Buddie cannot be armed');
          assert.equal(await page.$('[data-buddie-variety-choose]'),null,'Unavailable Buddie can be read but not placed');
          await page.click('[data-buddie-variety-close]');
          await dragBuddie(code,{x:12,y:3},{touch,blocked:true});
          assert.deepEqual(await readBuddieAssignments(),cancelAssignments,'Dragging an unavailable Buddie cannot affect a zone');
        }
        if(!touch){await dragBuddie('HH2026-003',{x:12,y:3},{button:'right'});assert.deepEqual(await readBuddieAssignments(),cancelAssignments,'Secondary mouse button cannot assign a Buddie');}
        await assertBuddieDraftOnly(cancelBefore);
        checks.push('occupied and rotating Buddies cannot be selected at '+width+'px');

        await visit('cultures&buddieDrag');
        await page.$eval('[data-warehouse-buddie-dock]',node=>node.scrollIntoView({block:'end'}));await settleView();
        const scrollBefore=await page.$eval('[data-warehouse-buddie-carousel]',node=>node.scrollLeft);
        if(touch){
          const band=await page.$eval('[data-warehouse-buddie-scroll]',node=>{const r=node.getBoundingClientRect();return {x:r.left+r.width*.85,y:r.top+r.height/2,dx:r.width*.65};});
          await touchGesture(band,{x:band.x-band.dx,y:band.y});
        }else await page.click('[data-warehouse-buddie-scroll-by="next"]');
        await page.waitForFunction(previous=>document.querySelector('[data-warehouse-buddie-carousel]').scrollLeft>previous+10,{},scrollBefore);
        assert.equal(await page.$('[data-warehouse-buddie-ghost]'),null,'Browsing the carousel never starts a placement');
        assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[],'Browsing the collection sends no mutation');
        await page.$eval(buddieCard('HH2026-003'),node=>node.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));
        const pick=await page.$(buddieCard('HH2026-003'));
        if(touch){const r=await pick.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else{await pick.focus();await page.keyboard.press('Enter');}
        await page.click('[data-buddie-variety-choose]');
        assert.equal(await pick.evaluate(node=>node.dataset.selected),'true','The profile action explicitly arms one card');
        assert.equal(await page.$eval('[data-zone-id="second"]',node=>node.dataset.buddieTarget),'true','Arming a card marks free culture zones as valid targets');
        assert.notEqual(await page.$eval('[data-zone-id="starter"]',node=>node.dataset.buddieTarget),'true','Occupied culture is never advertised as an admissible target');
        const zoneButton=await page.waitForFunction(()=>[...document.querySelectorAll('button[data-zone-kind="culture"]')].find(node=>node.textContent.includes('La relève')));
        await zoneButton.asElement().focus();await page.keyboard.press('Enter');await settleView();
        assert.equal((await readBuddieAssignments()).second,'HH2026-003','Keyboard activation of the zone accepts the selected card');
        assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[],'Accessible fallback also requires explicit save');
        assert.equal(await page.evaluate(()=>window.__navigation??null),null,'Accessible fallback assigns rather than navigating');
        checks.push('carousel browsing and tap/keyboard placement remain available at '+width+'px');

        const toggle='[data-warehouse-buddie-toggle]';
        const assignedDraft=await readBuddieAssignments();
        await page.focus(toggle);await page.keyboard.press('Enter');await settleView();
        assert.equal(await page.$eval(toggle,node=>node.getAttribute('aria-expanded')),'false','Keyboard closes the carousel');
        assert.equal(await page.$eval(toggle,node=>document.activeElement===node),true,'Closing keeps keyboard focus on the reopening control');
        assert.equal(await page.$$eval('[data-warehouse-buddie-card]',nodes=>nodes.some(node=>node.checkVisibility())),false,'Collapsed cards are outside the visual and keyboard flow');
        assert.deepEqual(await readBuddieAssignments(),assignedDraft,'Closing preserves unsaved Buddie assignments');
        await assertLayout();await page.screenshot({path:resolve(output,'buddie-collapsed-'+width+'.png')});
        await page.keyboard.press('Space');await settleView();
        assert.equal(await page.$eval(toggle,node=>node.getAttribute('aria-expanded')),'true','The same keyboard control reopens the carousel');
        assert.equal(await page.$('[data-warehouse-buddie-card][data-selected]'),null,'Reopening does not arm the last card');
        checks.push('collapse and reopen preserve assignments, focus and keyboard access at '+width+'px');

        await visit('cultures&buddieDrag');
        await page.focus(buddieCard('HH2026-003'));await page.keyboard.press('Enter');
        await page.click('[data-buddie-variety-choose]');
        await page.focus(toggle);await page.keyboard.press('Enter');await settleView();
        assert.equal(await page.$('[data-warehouse-buddie-card][data-selected]'),null,'Closing cancels a keyboard-armed card');
        assert.equal(await page.$('[data-zone-id][data-buddie-target="true"]'),null,'Closing clears placement targets');
        for(const destination of ['manage','shop','storage','processing']){
          if(destination==='manage')await clickText('Aménager');
          else if(destination==='shop')await clickAction('shop');
          else await clickRoom(destination);
          assert.equal(await page.$('[data-warehouse-buddie-dock]'),null,'No Buddie carousel remains in '+destination);
          if(destination==='manage')await clickText('Cultures');
          else if(destination==='shop')await page.click('[aria-label="Fermer la boutique"]');
          else await clickRoom('culture');
          await page.waitForSelector(toggle);
          assert.equal(await page.$eval(toggle,node=>node.getAttribute('aria-expanded')),'false','Manual closure persists after visiting '+destination);
        }
        checks.push('closed preference survives Aménager, Boutique, Stockage and Atelier at '+width+'px');

        for(const destination of ['close','manage','shop','storage','processing']){
          await visit('cultures&buddieDrag');await setZoom(touch?350:175);
          const beforeGesture=await readSavedPlan(),beforeAssignments=await readBuddieAssignments();
          await dragBuddie('HH2026-003',{x:12,y:3},{touch,onDragging:async()=>{
            // Hardware keyboard can change context while a pointer is captured.
            if(destination==='close')await page.focus(toggle);
            else if(destination==='manage')await page.evaluate(()=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Aménager').focus());
            else await page.focus(destination==='shop'?'[data-warehouse-action="shop"]':'[data-warehouse-room="'+destination+'"]');
            await page.keyboard.press('Enter');await settleView();
            assert.equal(await page.$('[data-warehouse-buddie-ghost]'),null,'Context '+destination+' cancels the pointer capture and ghost before release');
          }});
          if(destination==='close')assert.equal(await page.$eval(toggle,node=>node.getAttribute('aria-expanded')),'false');
          else assert.equal(await page.$('[data-warehouse-buddie-dock]'),null,'Context '+destination+' unmounts the dock');
          if(destination==='manage')await clickText('Cultures');
          else if(destination==='shop')await page.click('[aria-label="Fermer la boutique"]');
          else if(destination!=='close')await clickRoom('culture');
          await page.waitForSelector('[data-warehouse-map]');await settleView();
          assert.deepEqual(await readBuddieAssignments(),beforeAssignments,'Late pointer release after '+destination+' does not assign a Buddie');
          assert.equal(await page.$('[data-zone-id][data-buddie-target="true"]'),null,'No armed selection survives '+destination);
          await assertBuddieDraftOnly(beforeGesture);await assertLayout();
        }
        checks.push('closing and leaving Cultures cancel real '+(touch?'touch':'mouse')+' drags without side effects at '+width+'px');
      }
    }
    assert.deepEqual(errors,[]);
    await writeFile(resolve(output,buddieDragOnly?'buddie-drag-report.json':culturesOnly?'cultures-report.json':chromeOnly?'chrome-report.json':workshopOnly?'workshop-report.json':shopOnly?'shop-report.json':visualOnly?'visual-report.json':'report.json'),JSON.stringify({passed:true,checks,measurements,errors},null,2));
    console.log(JSON.stringify({passed:true,checks,measurements,output}));
  }catch(error){
    await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
    await writeFile(resolve(output,'failure.json'),JSON.stringify({message:error.message,errors,checks,measurements},null,2));throw error;
  }finally{await browser?.close();await server.close();}
}
