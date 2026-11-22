/** Interactive local rehearsal of the actual culture screen. All mutable data lives on this origin. */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = process.cwd();
const serve = process.argv.includes("--serve");
const previewOnly = process.argv.includes("--preview-only");
if(previewOnly&&!serve)throw Error("--preview-only requires --serve.");
const refreshVisuals=process.argv.includes("--refresh-visuals");
const nativeGpu=process.argv.includes("--native-gpu");
const group = process.argv.find(arg=>arg.startsWith("--check="))?.slice(8);
if (group && !["warehouse","warehouse-actor","warehouse-services","campaign","orientation","parity","pbi","pbi-smoke"].includes(group)) throw Error("--check accepts warehouse, warehouse-actor, warehouse-services, campaign, orientation, parity, pbi or pbi-smoke.");
if(refreshVisuals&&group)throw Error("--refresh-visuals runs the complete browser route with existing measured frame data.");
const output = resolve(root, "output/culture-room", nativeGpu ? (group || "full")+"-native-gpu" : group || (serve ? "preview" : "."));
const port = Number(process.env.CULTURE_ROOM_PORT ?? (serve ? 3693 : 3694));
const origin = "http://127.0.0.1:" + port;
await mkdir(output, {recursive:true});

function mount() {
  const params = new URLSearchParams(location.search);
  const scenario = params.get("scene") || "campaign";
  const key = "culture-room-fixture-v3/" + scenario;
  const saved = sessionStorage.getItem(key);
  function fixture() {
    let state = createKqReleveProduction();
    const act = action => { state = applyKqReleveProductionAction(state, action); };
    state.cashCents=5_000_000;
    const plan=suggestKqRelevePlan(state,2);
    plan.zones=[
      {...plan.zones[0],x:1,y:1,width:3,height:1,rotation:90,optionCodes:["SIM-SUBSTRATE-02"]},
      {...plan.zones[1],x:6,y:3,width:1,height:3,rotation:180,lightingCode:"SIM-LIGHT-02",airCode:"SIM-AIR-03"}
    ];
    plan.serviceZones=[
      {...plan.serviceZones[0],x:1,y:7,width:2,height:1,rotation:270},
      {...plan.serviceZones[1],x:7,y:8,width:2,height:1,rotation:90}
    ];
    plan.partitions=[{id:"east-divider",x:4,y:0,axis:"y",length:3},{id:"bench-divider",x:2,y:6,axis:"x",length:3}];
    act({type:"draft",warehouse:plan});
    act({type:"save-plan"});
    for (let i=0; i<3; i++) act({type:"reveal-buddie"});
    act({type:"assign",zoneId:"culture-1",buddieCode:"HH2026-005"});
    act({type:"assign",zoneId:"culture-2",buddieCode:"HH2026-010"});
    act({type:"save-plan"});
    act({type:"deck",codes:["BOTTE-005","BOTTE-006","BOTTE-024"]});
    act({type:"launch"});
    state.game.situationCodes[0]="SIT-001";
    state.game.care.problems=[{code:"APHIDS",severity:1,status:"confirmed",trend:"stable",appearedAt:0,variant:0}];
    if(scenario.startsWith("pbi-")) {
      state.game.care.problems[0].severity=2;
      state.game.care.problems[0].plants=[{zoneId:"culture-2",x:0,y:1,slot:3,severity:2}];
    }
    state.careInventory={"CARE-APHIDIUS":1};
    if (scenario === "pbi-smoke") {
      state.careInventory["CARE-SHADE"] = 1;
      state.careInventory["CARE-SEAWEED"] = 1;
    }
    if (scenario.startsWith("interventions-")) {
      for (const code of ["CARE-VERMICOMPOST", "CARE-COMPOST-TEA", "CARE-ORGANIC-FEED", "CARE-SEAWEED"]) state.careInventory[code]=1;
    }
    const stages = scenario==="harvest" ? 4 : 0;
    while (state.game.stageIndex<stages) {
      for (const type of ["assist","roll","resolve","advance"]) act({type});
    }
    return state;
  }
  let state = saved ? JSON.parse(saved) : fixture();
  const parity=/^parity-(0|90|180|270)$/.exec(scenario);
  const angle=parity?Number(parity[1]):null;
  const warehouseMode=!!parity||["warehouse","warehouse-turned","empty"].includes(scenario);
  let stock=null;
  let building=null;
  if(warehouseMode){
    const base=getReleveNativeWarehouse(state);
    if(scenario==="empty"){
      building={...base,state:createKqReleveProduction().warehouse,activeRuns:[],activeRun:false};
    }else{
      // The warehouse can contain independent runs; a campaign shares one stage.
      const first=base.state.zones[0];
      const unassigned={...first};
      delete unassigned.buddieCode;
      const zones=[...base.state.zones,
        {...first,id:"culture-3",name:"Colonne nord",x:8,y:0,width:2,height:2,rotation:angle??270,buddieCode:"HH2026-020"},
        {...unassigned,id:"culture-4",name:"Bacs ouest",x:1,y:4,width:2,height:1,rotation:0,active:false},
        {...unassigned,id:"culture-5",name:"Annexe",x:5,y:7,width:1,height:1,rotation:90}];
      const serviceZones=base.state.serviceZones.map(zone=>parity ? {...zone,width:2,height:2,rotation:angle}
        : scenario==="warehouse-turned"&&zone.kind==="storage" ? {...zone,rotation:270} : zone);
      const plan=getKqWarehouseQuote({...base.state,zones,serviceZones}).nextState;
      let previous=structuredClone(state);
      while(previous.game.phase!=="complete")for(const type of ["assist","roll","resolve","advance"])previous=applyKqReleveProductionAction(previous,{type});
      stock=getReleveProductionStorageSnapshot(previous);
      const stockGrams=stock.lots.reduce((total,lot)=>total+lot.harvestGrams,0);
      const activeRuns=zones.slice(0,3).map((zone,index)=>({
        zoneId:zone.id,runId:"63000000-0000-4000-8000-00000000000"+(index+1),buddieCode:zone.buddieCode,
        stageIndex:[1,3,5][index],phase:index===1?"rolled":"prepare",startedAt:state.game.startedAt
      }));
      building={...base,state:plan,activeRuns,activeRun:true,stockGrams,storageReservedGrams:stock.capacity.reservedUnits/10};
      if(parity){
        building.activeRuns[2].stageIndex=2;
        const installed=sessionStorage.getItem(key+"/plan");
        if(installed)Object.assign(building,JSON.parse(installed));
      }
    }
  }
  const calls=[];
  const transport=createReleveCultureTransport({
    getState:()=>state,
    setState:next=>{state=next;sessionStorage.setItem(key,JSON.stringify(next));}
  });
  const request=async (url,init)=>{
    const method=init?.method??"GET", body=init?.body?JSON.parse(init.body):null;
    if (method!=="GET") await new Promise(resolve=>setTimeout(resolve,110));
    const path=new URL(String(url),location.origin).pathname;
    let response;
    if(method==="GET"&&path.endsWith("/warehouse"))response=Response.json(building??getReleveNativeWarehouse(state));
    else if(parity&&method==="PATCH"&&path.endsWith("/warehouse")){
      const issues=validateKqWarehouseSpatialTransition(building.state,body.state);
      if(issues.length)response=Response.json({error:issues[0]},{status:400});
      else{
        const quote=getKqWarehouseQuote(body.state,building.state);
        if(body.expectedRevision!==building.revision||body.expectedCostCents!==quote.totalCostCents)
          response=Response.json({error:"Devis à actualiser."},{status:409});
        else{
          const receipt={state:quote.nextState,revision:building.revision+1,cashCents:building.cashCents-quote.totalCostCents};
          Object.assign(building,receipt);sessionStorage.setItem(key+"/plan",JSON.stringify(receipt));response=Response.json(building);
        }
      }
    }
    else if(method==="GET"&&stock&&path.endsWith("/storage"))response=Response.json(stock);
    else if(method==="GET"&&path.endsWith("/work")){
      const game=state.game;
      response=Response.json({version:1,runId:game.campaign.leaderRunId,stageIndex:game.stageIndex,phase:game.phase,day:1,
        source:"player",paid:game.phase!=="prepare",stepHours:.5,playerRemainingHours:8-(game.history.length+Number(game.phase==="rolled"))*.5,
        employee:null,bonus:{vitality:0,terpenes:0,yieldPercent:0,cannabinoids:0}});
    }else if(method==="GET"&&path.endsWith("/contracts")){
      response=Response.json({code:"light-hand",status:"available",runId:null,quality:null,cardsUsed:null,rewardCents:3000,canAccept:false,reason:null});
    }else response=await transport(url,init);
    calls.push({path:String(url),method,body,status:response.status});
    return response;
  };
  const api=createKqTutorialApi(request);
  api.isTutorial=false;
  const profile={gender:"female",skin:"copper",clothing:"berry",appearance:{...DEFAULT_CHANVRIER_APPEARANCE,hair:"bun",top:"jacket",accessory:"glasses"}};
  const isolated = {session:sessionStorage,persistent:localStorage};
  const e=React.createElement;
  if(parity)window.mountReferencePlan=async()=>{
    const [{KqWarehousePlan},{getKqWarehouseDimensions}]=await Promise.all([
      import("/src/components/placard/KqWarehousePlan"),import("/src/lib/kanab-quest-warehouse")]);
    const host=document.createElement("div");
    document.getElementById("root").append(host);
    const reference=createRoot(host);
    const plan=building.state;
    const noAction=()=>{};
    reference.render(e(KqWarehousePlan,{
      zones:plan.zones,serviceZones:plan.serviceZones,dimensions:getKqWarehouseDimensions(plan),
      partitions:plan.partitions,selectedId:plan.zones[0]?.id,drawing:false,drawingKind:"culture",
      anchor:null,cursor:{x:0,y:0},zoom:100,managing:false,locked:true,growing:building.activeRun,
      onZoom:noAction,onToggleDrawing:noAction,onDrawingKind:noAction,onSelectPoint:noAction,
      onCursor:noAction,onKeyDown:noAction,onDrawZone:()=>false,onConfigureZone:noAction,onTransformZone:noAction,
    }));
    window.unmountReferencePlan=()=>{reference.unmount();host.remove();};
  };
  window.inspectFixture=()=>({cash:state.cashCents,game:state.game,inventory:state.supportInventory,care:state.careInventory,careArea:state.careAreaInventory,calls,
    plan:building?.state??state.warehouse,revision:building?.revision,stockGrams:building?.stockGrams,stockLots:stock?.lots.length,activeRuns:building?.activeRuns});
  if(parity)window.inspectWorkshopMeshes=async()=>{
    const [THREE,{createRoomResources},{makeGrowStation,releaseStation},{getWarehouseRoomZones},
      {getKqWarehouseSpatialLayout}]=await Promise.all([import("three"),
      import("/src/components/placard/KqGrowRoomGeometry"),import("/src/components/placard/KqGrowRoomWorldArt"),
      import("/src/components/placard/culture-room-state"),import("/src/lib/kanab-quest-warehouse-spatial")]);
    const resources=createRoomResources(),result=[];
    try{
      const layout=getKqWarehouseSpatialLayout(building.state);
      const zones=getWarehouseRoomZones(building.state,building.activeRuns,null,building.stockGrams);
      for(const item of layout.items.filter(i=>i.kind==="culture")){
        const station=makeGrowStation(resources,item,zones.find(z=>z.id===item.id),24,false);
        station.updateMatrixWorld(true);
        station.traverse(mesh=>{
          if(!mesh.isInstancedMesh||!["lighting","air"].includes(mesh.name))return;
          for(let i=0;i<mesh.count;i++){
            const matrix=new THREE.Matrix4(),p=new THREE.Vector3();
            mesh.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix.premultiply(mesh.matrixWorld));
            result.push({zone:item.id,kind:mesh.name,x:p.x,z:p.z});
          }
        });
        releaseStation(station);
      }
      return result;
    }finally{resources.dispose();}
  };
  const legacyGame={...state.game,campaign:undefined,warehouse:undefined,equipment:{...state.game.equipment,
    tents:Array.from({length:7},(_,i)=>({tentNumber:i+1,codes:[]}))}};
  const content=scenario==="legacy" ? e(KqCultureRoom,{state:legacyGame})
    : warehouseMode ? e(KqWarehouse,{embedded:true,initialSection:"equipment",onClose:()=>{}}) : e(KanabQuestDicePrototype,{
    apiScope:"player",initialCampaign:true,initialRunId:state.game.campaign.leaderRunId,
    isolatedStorage:isolated,viewMode:"game",showWarehouseNavigation:false,showAdminOperations:false
  });
  createRoot(document.getElementById("root")).render(e("div",{className:retro.surface},e(QuarterCharacterContext.Provider,{value:profile},e(KqTutorialApiProvider,{api},content))));
}
const entry = [
  "import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';",
  "import retro from '/src/components/contest/ArenaRetro.module.css';",
  "import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';",
  "import {KqWarehouse} from '/src/components/placard/KqWarehouse';",
  "import {KqCultureRoom} from '/src/components/placard/KqCultureRoom';",
  "import {QuarterCharacterContext} from '/src/components/contest/QuarterCharacterContext';",
  "import {DEFAULT_CHANVRIER_APPEARANCE} from '/src/lib/arena-chanvrier';",
  "import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';",
  "import {createReleveCultureTransport,getReleveProductionStorageSnapshot} from '/src/lib/kanab-quest-releve-culture';",
  "import {getReleveNativeWarehouse} from '/src/lib/kanab-quest-releve-warehouse';",
  "import {getKqWarehouseQuote} from '/src/lib/kanab-quest-warehouse';",
  "import {validateKqWarehouseSpatialTransition} from '/src/lib/kanab-quest-warehouse-spatial';",
  "import {createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan} from '/src/lib/kanab-quest-releve-production';",
  "("+mount.toString()+")();"
].join("\n");
const modules={
  entry,
  "next/image":"import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,preload,...p}){return <img {...p} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...p.style}}/>;}",
  "next/link":"import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...p}){return <a {...p}/>}",
  "next/navigation":"export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);",
  "next/dynamic":"import React from 'react';export default function dynamic(fn,options={}){const C=React.lazy(()=>fn().then(m=>({default:m.default||m})));return p=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...p}/></React.Suspense>}"
};
const html='<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Salle de culture · démonstration locale</title><style>@font-face{font-family:Display;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:Body;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>';
const server=await createServer({
  root,configFile:false,envDir:false,cacheDir:resolve(output,"vite-cache"),publicDir:resolve(root,"public"),
  resolve:{alias:{"@":resolve(root,"src")},dedupe:["react","react-dom"]},
  optimizeDeps:{include:["react","react/jsx-runtime","react/jsx-dev-runtime","react-dom","react-dom/client","lucide-react","cannon-es","three",
    "three/addons/utils/BufferGeometryUtils.js","three/addons/geometries/RoundedBoxGeometry.js"]},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:"local-culture-room",enforce:"pre",
    resolveId(id){
      if(id.endsWith("/public/placard/warehouse-v2/manifest.json"))return "\0warehouse-art-manifest";
      if(Object.hasOwn(modules,id))return "\0"+id;
    },
    async load(id){
      if(id==="\0warehouse-art-manifest")return "export default "+await readFile(resolve(root,"public/placard/warehouse-v2/manifest.json"),"utf8");
      if(id.startsWith("\0")&&Object.hasOwn(modules,id.slice(1)))return(await transformWithOxc(modules[id.slice(1)],id+".tsx",{lang:"tsx",jsx:{runtime:"automatic"}})).code;
    },
    configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split("?")[0]!=="/")return next();
      res.setHeader("Content-Type","text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy","connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:");
      const comparison=group==="parity"?' · <a href="/output/culture-room/parity/index.html">Comparer la salle au plan de référence</a>':"";
      const links='<nav style="padding:.55rem 1rem;font:14px Body,sans-serif;background:#fff8e7;color:#172923" aria-label="Démonstration locale">Données simulées · <a href="/?scene=campaign">Campagne</a> · <a href="/?scene=pbi-demo">Foyer de pucerons</a> · <a href="/?scene=harvest">Récolte</a> · <a href="/?scene=warehouse">Entrepôt</a>'+comparison+'</nav>';
      res.end(serve?html.replace('<div id="root">',links+'<div id="root">'):html);
    });}}],
  server:{host:"127.0.0.1",port,strictPort:true,hmr:false,watch:null}
});
await server.listen();
if(serve){
  console.log(origin+"/");
  const closed=new Promise(done=>{process.once("SIGINT",done);process.once("SIGTERM",done);});
  // The preview and the audit each have their own browser storage and report.
  if(!previewOnly)await audit().catch(error=>console.error(error));
  await closed;
  await server.close();
}else await audit();

async function audit(){
  let savedPerf;
  if(refreshVisuals){
    const base=resolve(root,"output/culture-room"),backup=resolve(base,"frames-before-visual-fix.json");
    try { savedPerf=JSON.parse(await readFile(backup,"utf8")); } catch(error) {
      if(error.code!=="ENOENT")throw error;
      const prior=JSON.parse(await readFile(resolve(base,"report.json"),"utf8"));
      assert.ok(prior.passed&&prior.frames?.length,"A successful measured browser run is required");
      const lastSample=(await stat(resolve(base,"worker-drying-close-1440.png"))).mtime.toISOString();
      savedPerf={capturedBy:lastSample,note:"Measured before the drying-mesh occlusion and arrival-inspection changes.",frames:prior.frames};
      await writeFile(backup,JSON.stringify(savedPerf,null,2)+"\n");
    }
  }
  const browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:["--no-sandbox",...(nativeGpu?["--enable-gpu"]:["--use-angle=swiftshader","--enable-unsafe-swiftshader"])]});
  const page=await browser.newPage();
  page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
  const checks=[],frames=[...(savedPerf?.frames??[])],errors=[],blocked=[];
  const screenshots=[];
  const report={passed:false,checks,frames,errors,blocked,screenshots,walks:[],gpuMode:nativeGpu?"native":"swiftshader",checkedAt:new Date().toISOString(),source:"Player culture screen and warehouse room, local production transport and synthetic account. Chromium touch emulation."};
  if(savedPerf)report.frameEvidence={file:"frames-before-visual-fix.json",capturedBy:savedPerf.capturedBy,note:savedPerf.note};
  page.on("pageerror",e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on("request",req=>{
    const url=new URL(req.url());
    if(url.origin===origin&&url.pathname==="/favicon.ico")void req.respond({status:204});
    else if(["data:","blob:"].includes(url.protocol)||url.origin===origin&&!url.pathname.startsWith("/api/"))void req.continue();
    else {blocked.push(url.href);void req.abort();}
  });
  const room="[data-grow-room]";
  const selected='[data-grow-pick][aria-pressed="true"]';
  const footprint=id=>'[data-grow-footprint="'+id+'"]';
  const pick=id=>'[data-grow-pick="'+id+'"]';
  const state=()=>page.evaluate(()=>window.inspectFixture());
  const viewport=async (width,height=width>800?900:844,touch=width<800)=>{
    const mounted=await page.$(room);
    await page.setViewport({width,height,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
    if(mounted)await page.waitForSelector(room);
  };
  const reveal=async sel=>{await page.$eval(sel,n=>n.scrollIntoView({block:"center",inline:"center",behavior:"instant"}));};
  const tap=async sel=>{await page.waitForSelector(sel,{visible:true});await page.waitForFunction(s=>!document.querySelector(s)?.disabled,{},sel);await reveal(sel);if(page.viewport().hasTouch)await page.tap(sel);else await page.click(sel);};
  const visibleRoom=async()=>{await reveal(room);await page.waitForSelector('[data-grow-motion="running"]');};
  const visit=async scene=>{await page.goto(origin+"/?scene="+scene,{waitUntil:"domcontentloaded"});if(scene!=="empty")await page.waitForSelector(room);await page.evaluate(()=>document.fonts.ready);};
  const shot=async name=>{
    const file=name+".png";await (await page.$(room)).screenshot({path:resolve(output,file)});screenshots.push(file);
  };
  const pass=(name,data={})=>{checks.push({name,...data});console.log(name);};
  async function chooseCareProduct(code="CARE-APHIDIUS"){
    await tap('[data-culture-tab="care"]');
    await tap('[data-care-section="intervention"]');
    if(await page.$eval('[data-care-reserve-toggle]',n=>n.getAttribute('aria-expanded')!=="true"))await tap('[data-care-reserve-toggle]');
    await tap(code==="CARE-APHIDIUS" ? '[data-care-rayon="pbi"]' : '[data-care-rayon="input"]');
    const product='[data-care-product="'+code+'"] [data-care-product-use]';
    await tap(product);
    await page.waitForSelector("[data-pbi-instructions]",{visible:true});
  }
  async function pressCareCell(key){
    const selector='[data-pbi-cell="'+key+'"]';
    await reveal("[data-grow-camera]");
    const point=await page.$eval(selector,node=>{
      const points=Array.from(node.points);
      const x=points.reduce((sum,p)=>sum+p.x,0)/points.length,y=points.reduce((sum,p)=>sum+p.y,0)/points.length;
      const p=new DOMPoint(x,y).matrixTransform(node.getScreenCTM());
      return {x:p.x,y:p.y,hit:document.elementFromPoint(p.x,p.y)?.closest("[data-pbi-cell]")?.dataset.pbiCell};
    });
    assert.equal(point.hit,key,"The projected polygon receives the click at its actual screen position");
    if(page.viewport().hasTouch)await page.touchscreen.tap(point.x,point.y);
    else await page.mouse.click(point.x,point.y);
    await page.waitForSelector("[data-pbi-instructions]",{hidden:true});
  }
  const actor=pose=>'[data-grow-actor][data-actor-state="'+pose+'"]';
  const pose=async (gesture,name)=>{
    await visibleRoom();const visible=await page.waitForSelector(actor(gesture));
    const target=await visible.evaluate(n=>n.dataset.actorTarget);
    if(name)await shot(name);
    return target;
  };
  async function sample(name,during,windowMs=1700){
    await visibleRoom();
    if(refreshVisuals){if(during)await during();return;}
    const measurement=page.evaluate(async windowMs=>{
      const samples=[],poses=new Set(),targets=new Set(),positions=new Set(),actor=document.querySelector("[data-grow-actor]");
      let last=null;
      await new Promise(done=>{const start=performance.now();function frame(t){
        if(last!==null)samples.push(t-last);last=t;poses.add(actor?.dataset.actorState);
        targets.add(actor?.dataset.actorTarget);positions.add([actor?.dataset.worldX,actor?.dataset.worldZ,actor?.dataset.facing].join("/"));
        if(t-start<windowMs)requestAnimationFrame(frame);else done();
      }requestAnimationFrame(frame);});
      samples.sort((a,b)=>a-b);
      const span=samples.reduce((a,b)=>a+b,0);
      return {frames:samples.length,durationMs:Math.round(span),fps:+(1000*samples.length/span).toFixed(1),p95ms:+samples[Math.floor(samples.length*.95)].toFixed(1),maxMs:+samples.at(-1).toFixed(1),poses:[...poses],targets:[...targets],actorTransforms:positions.size,visibleFootprints:document.querySelectorAll("[data-grow-footprint]").length};
    },windowMs);
    if(during)await during();
    const result={name,width:page.viewport().width,sampledAt:new Date().toISOString(),...await measurement};
    frames.push(result);
    console.log(result.width+" px, "+name+": "+result.fps+" rAF/s, p95 "+result.p95ms+" ms, "+result.actorTransforms+" actor transforms.");
  }
  function rectangles(plan){
    const {columns,rows}=plan.floor;
    const zones=[...plan.zones,...plan.serviceZones].map(z=>({
      id:z.id,kind:z.kind??"culture",x:z.x+(z.width-columns)/2,z:z.y+(z.height-rows)/2,
      w:z.width,d:z.height,r:z.rotation??0
    }));
    const partitions=plan.partitions.map(wall=>{
      const horizontal=wall.axis==="x";
      return {id:wall.id,kind:"partition",x:wall.x+((horizontal?wall.length:1)-columns)/2,
        z:wall.y+((horizontal?1:wall.length)-rows)/2,w:horizontal ? wall.length : .12,d:horizontal ? .12 : wall.length,r:horizontal?0:90};
    });
    return [...zones,...partitions];
  }
  async function geometry(plan){
    await page.waitForSelector("[data-grow-isometric]");await page.waitForSelector('[data-grow-camera][data-renderer="webgl"]');
    report.webglRenderer??=await page.$eval("[data-grow-canvas]",canvas=>{
      const gl=canvas.getContext("webgl2");
      const info=gl?.getExtension("WEBGL_debug_renderer_info");
      return info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):null;
    });
    const expected=rectangles(plan);
    const actual=await page.$$eval("[data-grow-footprint]",nodes=>nodes.map(n=>({
      id:n.dataset.growFootprint,kind:n.dataset.kind,x:Number(n.dataset.worldX),z:Number(n.dataset.worldZ),
      w:Number(n.dataset.width),d:Number(n.dataset.depth),r:Number(n.dataset.rotation),points:Array.from(n.points,p=>[p.x,p.y])
    })));
    assert.equal(actual.length,expected.length,"One projected footprint per saved zone or partition");
    const areaRatios=[];
    for(const item of expected){
      const found=actual.find(f=>f.id===item.id);assert.ok(found,item.id);
      const {points,...data}=found;assert.deepEqual(data,item,"Saved footprint and orientation "+item.id);
      assert.equal(points.length,4,"Projected floor quadrilateral "+item.id);
      const area=Math.abs(points.reduce((sum,[x,y],i)=>{
        const [nextX,nextY]=points[(i+1)%4];
        return sum+x*nextY-y*nextX;
      },0))/2;
      assert.ok(area>0,"Visible floor area "+item.id);
      areaRatios.push(area/(item.w*item.d));
    }
    assert.ok(Math.max(...areaRatios)/Math.min(...areaRatios)<1.06,
      "Actual rendered floor polygons retain a common area scale across large and narrow objects");
    assert.equal(new Set(actual.map(i=>JSON.stringify(i.points))).size,actual.length,"Asymmetric objects occupy distinct displayed polygons");
    return expected;
  }
  async function center(id){
    return page.$eval(footprint(id),node=>{
      const points=Array.from(node.points);
      const p=new DOMPoint(points.reduce((a,v)=>a+v.x,0)/points.length,points.reduce((a,v)=>a+v.y,0)/points.length).matrixTransform(node.getScreenCTM());
      return {x:p.x,y:p.y};
    });
  }
  async function selectOnFloor(id){
    await reveal("[data-grow-canvas]");
    const point=await center(id);
    if(page.viewport().hasTouch)await page.touchscreen.tap(point.x,point.y);
    else await page.mouse.click(point.x,point.y);
    await page.waitForSelector(pick(id)+'[aria-pressed="true"]');
    const zoneMenu=await page.$('dialog[data-warehouse-zone-menu][open]');
    if(zoneMenu){
      await page.keyboard.press("Escape");
      await page.waitForSelector('dialog[data-warehouse-zone-menu][open]',{hidden:true});
    }
  }
  const camera=()=>page.$eval("[data-grow-camera]",n=>({zoom:Number(n.dataset.zoom),x:Number(n.dataset.panX),z:Number(n.dataset.panZ)}));
  const resetCamera=async()=>{
    const reset="[data-grow-reset]";
    await page.waitForSelector(reset);
    if(!await page.$eval(reset,n=>n.disabled))await tap(reset);
  };
  async function openStationButtons(){
    const toggle=await page.$("[data-grow-toggle-posts]");
    if(toggle && await toggle.evaluate(b=>b.getClientRects().length>0 && b.getAttribute("aria-expanded")==="false")){
      await toggle.focus();await page.keyboard.press("Enter");
      await page.waitForSelector('[data-grow-toggle-posts][aria-expanded="true"]');
    }
  }
  async function frameStation(id){
    const canvas="[data-grow-canvas]";
    await resetCamera();
    for(let i=0;i<3&&!await page.$eval("[data-grow-zoom-in]",n=>n.disabled);i++)await tap("[data-grow-zoom-in]");
    await reveal(canvas);
    const bounds=await page.$eval(canvas,n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};});
    const clamp=(x,max)=>Math.max(-max,Math.min(max,x));
    for(let i=0;i<3;i++){
      const target=await center(id),dx=clamp(bounds.x-target.x,bounds.w*.35),dy=clamp(bounds.y-target.y,bounds.h*.35);
      if(Math.hypot(dx,dy)<10)break;
      await page.mouse.move(bounds.x,bounds.y);await page.mouse.down();
      await page.mouse.move(bounds.x+dx,bounds.y+dy,{steps:4});await page.mouse.up();
    }
  }
  const closer=async(name,id)=>{await frameStation(id);await shot(name);await resetCamera();};
  async function compareRotation(){
    const station=async(scenario)=>{
      await visit(scenario);await visibleRoomIfReduced();await geometry((await state()).plan);
      await openStationButtons();await tap(pick("storage"));await resetCamera();
      for(let i=0;i<3;i++)await tap("[data-grow-zoom-in]");
      await page.focus("[data-grow-camera]");
      for(let i=0;i<3;i++)await page.keyboard.press("ArrowDown");
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const handle=await page.$("[data-grow-canvas]"),png=await handle.screenshot();
      const target=await center("storage"),r=await handle.boundingBox();
      const width=140,height=120,left=Math.max(0,Math.min(Math.round(target.x-r.x-width/2),Math.floor(r.width-width)));
      const top=Math.max(0,Math.min(Math.round(target.y-r.y-height*.65),Math.floor(r.height-height)));
      const crop=sharp(png).extract({left,top,width,height}).removeAlpha();
      const file=scenario+"-storage-orientation.png";
      await crop.clone().png().toFile(resolve(output,file));screenshots.push(file);
      return {pixels:await crop.raw().toBuffer(),points:await page.$eval(footprint("storage"),n=>n.getAttribute("points"))};
    };
    const before=await station("warehouse"),after=await station("warehouse-turned");
    assert.equal(before.points,after.points,"Only the fixture orientation changes in the two crops");
    let changed=0;
    for(let i=0;i<before.pixels.length;i+=3){
      if(Math.max(...[0,1,2].map(c=>Math.abs(before.pixels[i+c]-after.pixels[i+c])))>24)changed++;
    }
    assert.ok(changed>70,"A 180° service rotation visibly changes the furnished mesh ("+changed+" pixels)");
    return changed;
  }
  const visibleRoomIfReduced=async()=>{await reveal(room);await page.waitForSelector('[data-grow-motion="reduced"]');};
  // The production actor caps each simulation step; software WebGL may deliver
  // fewer than three frames per second. Other selector deadlines stay unchanged.
  const walkTimeout=nativeGpu?30000:90000;
  async function walk(id,obstacles,expectInspection=false){
    const poses=await page.evaluate(async({id,obstacles,expectInspection,walkTimeout})=>{
      const start=performance.now(),positions=new Set(),collisions=[],states=new Set(),facings=new Set();
      let last=null,travel=0,maxStep=0,lastFrame=start,maxFrameMs=0;
      await new Promise(done=>{
        function tick(){
          const now=performance.now();maxFrameMs=Math.max(maxFrameMs,now-lastFrame);lastFrame=now;
          const actor=document.querySelector("[data-grow-actor]");
          const x=Number(actor?.dataset.worldX),z=Number(actor?.dataset.worldZ),pose=actor?.dataset.actorState;
          if(Number.isFinite(x)&&Number.isFinite(z)){
            positions.add(x.toFixed(3)+"/"+z.toFixed(3));states.add(pose);
            facings.add(Number(actor.dataset.facing).toFixed(2));
            if(last){const step=Math.hypot(x-last.x,z-last.z);travel+=step;maxStep=Math.max(maxStep,step);}
            last={x,z};
            for(const ob of obstacles){
              if(Math.abs(x-ob.x)<ob.w/2+.218&&Math.abs(z-ob.z)<ob.d/2+.218&&collisions.length<8)collisions.push({id:ob.id,x,z,pose});
            }
          }
          if(now-start>walkTimeout || (positions.size>3&&actor?.dataset.actorTarget===id&&pose==="idle"&&(!expectInspection||states.has("inspect"))))done();
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      const a=document.querySelector("[data-grow-actor]");
      return {samples:positions.size,states:[...states],collisions,target:a?.dataset.actorTarget,pose:a?.dataset.actorState,position:last,
        elapsedMs:Math.round(lastFrame-start),maxFrameMs:Math.round(maxFrameMs),motion:document.querySelector("[data-grow-room]")?.dataset.growMotion,
        travelM:+travel.toFixed(2),maxStepM:+maxStep.toFixed(3),directions:facings.size};
    },{id,obstacles,expectInspection,walkTimeout});
    report.walks.push({id,...poses});
    assert.deepEqual(poses.collisions,[],"Actor radius stays clear of fixture rectangles during walk");
    assert.ok(poses.samples>=4&&poses.states.includes("walking"),"Measured distinct world positions along the route");
    assert.equal(poses.target,id);assert.equal(poses.pose,"idle");
    assert.ok(poses.travelM>0.3&&poses.maxStepM<0.3&&poses.directions>1,
      "Travel and turning progress through small intermediate steps "+JSON.stringify(poses));
    if(expectInspection)assert.ok(poses.states.indexOf("walking")>=0&&poses.states.indexOf("inspect")>poses.states.indexOf("walking"),
      "Inspection takes place after walking to the selected growing culture");
    return {samples:poses.samples,travelM:poses.travelM,maxStepM:poses.maxStepM,directions:poses.directions,states:poses.states};
  }
  try{
    if (!group || group === "warehouse-actor") {
      for (const width of [320, 1440]) {
        await viewport(width);
        await visit("warehouse");
        await visibleRoom();
        assert.equal(await page.$(selected), null);
        const walking = await page.waitForSelector(actor("walking"), {timeout: 60000});
        assert.equal(await walking.evaluate(node => node.dataset.actorTarget), "culture-1");
        const inspecting = await page.waitForSelector(actor("inspect"), {timeout: 60000});
        assert.equal(await inspecting.evaluate(node => node.dataset.actorTarget), "culture-1");
        await shot("inspection-" + width);
        assert.equal(await page.$(selected), null);
        assert.equal((await state()).calls.filter(call => call.method === "POST").length, 0);
        await selectOnFloor("culture-2");
        await page.waitForSelector('[data-grow-actor][data-actor-target="culture-2"]');
        pass("Le personnage inspecte une culture dès l’entrée et rejoint le poste choisi à " + width + " px");
      }
    }
    if(group==="parity"){
      const {checkWarehouseParity}=await import("./audit-culture-room-parity.mjs");
      await checkWarehouseParity({page,output,viewport,visit,state,geometry,reveal,tap,pass,screenshots});
    }
    if(!group || group==="pbi"){
      const {checkSpatialCare}=await import("./audit-culture-room-pbi.mjs");
      await checkSpatialCare({page,output,viewport,visit,state,reveal,tap,pass,pose,screenshots,chooseCareProduct,pressCareCell});
    }
    if(group==="pbi-smoke"){
      await viewport(390);await visit("pbi-smoke");
      assert.equal(await page.$("[data-warehouse-iso-map]"),null);
      await selectOnFloor("culture-2");
      await chooseCareProduct();
      await pressCareCell("culture-2:0:1");
      const live=await state(),target={zoneId:"culture-2",x:0,y:1};
      assert.deepEqual(live.game.care.applications.map(application=>application.target),[target]);
      assert.deepEqual(live.calls.filter(call=>call.method==="POST").map(call=>[call.body.productCode,call.body.target,call.status]),[["CARE-APHIDIUS",target,200]]);
      pass("Culture selection and projected PBI target without warehouse editing",{target});

      await tap('[data-culture-tab="play"]');
      for (const phase of ["rolled", "resolved", "prepare"]) {
        await tap("[data-culture-primary-action]");
        await page.waitForSelector('[data-culture-phase="'+phase+'"]');
      }
      for (const code of ["CARE-SHADE", "CARE-SEAWEED"]) {
        await chooseCareProduct(code);
        await pressCareCell("culture-2:0:1");
      }
      const afterInputs = await state();
      assert.deepEqual(afterInputs.game.care.applications.map(({productCode, stageIndex, target:cell}) => [productCode, stageIndex, cell]),
        [["CARE-APHIDIUS", 0, target], ["CARE-SHADE", 1, target], ["CARE-SEAWEED", 1, target]]);
      await chooseCareProduct("CARE-SHADE");
      assert.equal(await page.$('[data-pbi-cell="culture-2:0:1"]'), null);
      pass("The next turn accepts shade and a different input on the PBI square, then excludes that square for duplicate shade",{target});
    }
    if(!group||group==="campaign"){
    await viewport(320);await visit("campaign");await visibleRoom();
    await page.waitForSelector('[data-grow-actor="player"][data-personalized="true"]');
    assert.equal(await page.$$(selected).then(n=>n.length),1);
    assert.equal(await pose("inspect"), await page.$eval(selected, node => node.dataset.growPick));
    pass("Le personnage examine la culture ouverte avant la première action du joueur");
    await geometry((await state()).plan);
    await shot("campaign-320");await selectOnFloor("culture-2");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const initial=await state();assert.equal(initial.calls.filter(c=>c.method==="POST").length,0);
    assert.equal(await page.$("[data-playable-lesson]"),null);
    assert.ok(await page.$("[data-culture-work-status]"));
    await sample("Walking to second culture");pass("320 px, selected second campaign zone, verified avatar and two visible cultures");
    await tap('[data-culture-tab="cards"]');await tap('[data-action-card="BOTTE-005"]');
    assert.match(await page.$eval("[data-card-target]",n=>n.textContent),/Campagne.*2 zones/);
    assert.equal((await state()).inventory["BOTTE-005"],initial.inventory["BOTTE-005"]);
    await tap("[data-culture-confirm-card]");await page.waitForSelector("[data-card-play-result]");
    await tap("[data-culture-show-room]");
    assert.equal(await page.evaluate(()=>document.activeElement?.matches("[data-grow-camera]")),true);
    assert.equal(await page.$eval(selected, node => node.dataset.growPick),"culture-2");
    await pose("water","watering-320");
    const played=await state();assert.equal(played.inventory["BOTTE-005"],initial.inventory["BOTTE-005"]-1);
    await selectOnFloor("culture-1");
    await page.waitForSelector(actor("walking"));pass("Card inspection, confirmed water gesture and interruption by a new target");
    await chooseCareProduct();await pressCareCell("culture-1:1:0");await pose("pbi","care-320");
    assert.equal((await state()).careArea["CARE-APHIDIUS"],5);
    await tap("[data-care-basic]");await page.waitForSelector("[data-care-waiting]");await pose("sweep");
    assert.ok((await state()).cash<initial.cash);pass("Two confirmed care gestures, one dose consumed and paid care queued for the stage");
    await tap('[data-culture-tab="play"]');const primary="[data-culture-primary-action]";
    await tap(primary);await page.waitForSelector('[data-culture-phase="rolled"]');await pose("dice","dice-320");
    const rolled=await state();assert.deepEqual(rolled.calls.filter(c=>c.body?.action==="roll").map(c=>c.status),[200]);
    const otherPage=await browser.newPage();await otherPage.bringToFront();await page.waitForFunction(()=>document.hidden,{polling:80});
    await page.waitForFunction(()=>document.querySelector("[data-grow-room]")?.dataset.growMotion==="hidden",{polling:80});
    const rigPose=()=>page.$eval("[data-grow-actor]",a=>[a.dataset.worldX,a.dataset.worldZ,a.dataset.facing,a.dataset.actorState]);
    const beforeAbsence=await rigPose();
    const hiddenMs=await otherPage.evaluate(async()=>{const t=performance.now();await new Promise(r=>setTimeout(r,700));return Math.round(performance.now()-t);});
    assert.deepEqual(await rigPose(),beforeAbsence,"The rendered actor stays still while the game tab is behind another tab");
    await page.bringToFront();await otherPage.close();await page.waitForFunction(()=>!document.hidden);
    await page.waitForFunction(()=>["running","offscreen"].includes(document.querySelector("[data-grow-room]")?.dataset.growMotion),{polling:80});
    const returnedMotion=await page.$eval(room,n=>n.dataset.growMotion);
    await visibleRoom();
    assert.deepEqual((await state()).game,rolled.game);
    await page.reload({waitUntil:"networkidle0"});await page.waitForSelector('[data-culture-phase="rolled"]');assert.deepEqual((await state()).game.dice,rolled.game.dice);
    await visibleRoom();await page.waitForSelector(actor("idle"));assert.ok(!(await page.$(actor("dice"))));
    pass("Confirmed dice, suspended actor in a background tab, single roll and unchanged result after reload",{dice:rolled.game.dice,hiddenMs,returnedMotion});
    await tap(primary);await page.waitForSelector('[data-culture-phase="resolved"]');await tap(primary);await page.waitForSelector('[data-culture-stage="1"][data-culture-phase="prepare"]');
    assert.ok((await state()).game.care.history.some(x=>x.kind==="resolution"));pass("Stage resolution applies deferred care and advances normally");
    await viewport(390);await visit("harvest");await visibleRoom();await shot("harvest-before-390");
    await tap(primary);await page.waitForSelector('[data-culture-phase="rolled"]');await tap(primary);await page.waitForSelector('[data-culture-phase="resolved"]');
    await pose("harvest","harvest-390");await tap(primary);await page.waitForSelector('[data-culture-stage="5"]');
    assert.equal(await pose("dry","drying-action-390"),"drying");
    await tap(primary);await page.waitForSelector('[data-culture-phase="rolled"]');
    await tap(primary);await page.waitForSelector('[data-culture-phase="resolved"]');await tap(primary);await page.waitForSelector('[data-culture-phase="complete"]');
    await page.waitForSelector("[data-harvest-moment]");await page.waitForSelector("[data-grow-isometric]");
    assert.equal(await pose("store","storage-action-390"),"storage");
    const finalGame=(await state()).game;
    await page.reload({waitUntil:"networkidle0"});await page.waitForSelector('[data-culture-phase="complete"]');
    assert.deepEqual((await state()).game,finalGame);
    assert.equal(await page.evaluate(()=>window.inspectFixture().calls.filter(c=>c.method==="POST").length),0);
    pass("Harvest gesture, drying, completed two-variety campaign and read-only return to its report");
    }
    if(!group||group==="warehouse"||group==="warehouse-services"){
    await viewport(390);
    await visit("warehouse");await visibleRoom();
    const warehouse=await state();assert.ok(warehouse.stockGrams>0&&warehouse.stockLots===2);
    assert.equal(new Set(warehouse.activeRuns.map(run=>run.stageIndex)).size,3);
    const obstacles=await geometry(warehouse.plan);
    const ids=[...warehouse.plan.zones,...warehouse.plan.serviceZones].map(zone=>zone.id);
    assert.equal((await page.$$("[data-grow-posts]")).length,1,"One keyboard station list");
    assert.equal((await page.$$("[data-grow-pick]")).length,ids.length,"Real warehouse zone controls mounted");
    for(const width of group==="warehouse-services"?[]:[320,390,1440]){
      await viewport(width);await visibleRoom();await resetCamera();
      await geometry(warehouse.plan);
      assert.equal((await page.$$("[data-grow-camera]")).length,1,"One warehouse viewport");
      assert.equal((await page.$$("svg[data-warehouse-map]")).length,0,"No overhead viewport in the warehouse");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await sample("Seven-zone furnished warehouse with rapid target changes",async()=>{
        for(const id of ["culture-2","culture-3","culture-1","drying"]){
          await selectOnFloor(id);
        }
      });
      await page.waitForSelector(actor("idle"));
      await shot("warehouse-"+width);
      await sample("Warm scene with repeated target changes",async()=>{
        // Finish far from the dryer so the actor keeps moving for the measurement.
        for(const id of ["culture-1","culture-2","culture-3"])await selectOnFloor(id);
      },2500);
      await selectOnFloor("drying");
      await page.waitForSelector(actor("idle"));
    }
    if(group==="warehouse-services")await selectOnFloor("drying");
    await page.waitForSelector('[data-warehouse-room="drying"][aria-selected="true"]');
    assert.match(await page.$eval(room,n=>n.innerText),/1 culture en séchage/);
    if(group==="warehouse-services"){
      await selectOnFloor("storage");
      await page.waitForSelector('[data-warehouse-room="storage"][aria-selected="true"]');
      const stockLabel=warehouse.stockGrams.toLocaleString("fr-FR")+" g";
      assert.ok((await page.$eval(room,n=>n.innerText)).includes(stockLabel),"Storage inspection displays the occupied stock in grams");
      await selectOnFloor("culture-2");
      await page.waitForSelector('[data-warehouse-room="culture"][aria-selected="true"]');
      assert.deepEqual((await state()).plan,warehouse.plan);
      assert.equal((await state()).calls.filter(c=>c.method!=="GET").length,0);
      pass("Drying and stock status, return to culture and no mutation",{stockGrams:warehouse.stockGrams});
    }else{
    await closer("worker-drying-close-1440","drying");
    await viewport(390);await visibleRoom();await resetCamera();
    const baseline=await camera();await tap("[data-grow-zoom-in]");const enlarged=await camera();
    assert.ok(enlarged.zoom>baseline.zoom);await tap("[data-grow-zoom-out]");await resetCamera();
    assert.deepEqual(await camera(),baseline);
    await tap("[data-grow-zoom-in]");await tap("[data-grow-zoom-in]");
    const zoomed=await camera();
    await reveal("[data-grow-canvas]");
    const surface=await page.$eval("[data-grow-canvas]",n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width*.45,y:r.top+r.height*.7};});
    const client=await page.createCDPSession();
    await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[surface]});
    for(const offset of [12,25,40,60])await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:surface.x+offset,y:surface.y-10}]});
    await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    const panned=await camera();assert.ok(Math.abs(panned.x-zoomed.x)+Math.abs(panned.z-zoomed.z)>.01,"Finger drag pans the enlarged view");
    const pair=spread=>[{id:1,x:surface.x-spread,y:surface.y},{id:2,x:surface.x+spread,y:surface.y}];
    await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:pair(18)});
    for(const spread of [22,27,32,37])await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:pair(spread)});
    await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await client.detach();
    assert.ok((await camera()).zoom>panned.zoom,"Two-finger pinch enlarges the actual plane");
    await resetCamera();assert.deepEqual(await camera(),baseline);await geometry(warehouse.plan);
    assert.equal(await page.$eval("[data-grow-toggle-posts]",b=>b.getAttribute("aria-expanded")),"false");
    await openStationButtons();
    await page.focus(pick("culture-1"));await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.growPick),"culture-2");
    await page.keyboard.down("Shift");await page.keyboard.press("Tab");await page.keyboard.up("Shift");
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.growPick),"culture-1");
    await selectOnFloor("storage");const storageSteps=await walk("storage",obstacles);
    await page.waitForSelector('[data-warehouse-room="storage"][aria-selected="true"]');
    const stockLabel=warehouse.stockGrams.toLocaleString("fr-FR")+" g";
    assert.ok((await page.$eval(room,n=>n.innerText)).includes(stockLabel),"Storage inspection displays the occupied stock in grams");
    await closer("worker-storage-close-390","storage");
    await selectOnFloor("culture-2");
    const reachingCrop=walk("culture-2",obstacles,true);
    try {
      await page.waitForSelector(actor("inspect")+'[data-actor-target="culture-2"]',{timeout:walkTimeout});
      await shot("inspection-arrival-390");
    } catch(error) { await reachingCrop.catch(()=>{});throw error; }
    const cropSteps=await reachingCrop;
    await page.waitForSelector('[data-warehouse-room="culture"][aria-selected="true"]');
    assert.deepEqual((await state()).plan,warehouse.plan);assert.equal((await state()).calls.filter(c=>c.method!=="GET").length,0);
    pass("Saved asymmetric floor, oriented fixtures, stock, mobile pan/zoom/reset, keyboard and non-mutating selection",{footprints:obstacles.length,stockGrams:warehouse.stockGrams});
    pass("Feet clear physical zones and partitions on two inspected routes",{storage:storageSteps,culture:cropSteps,radiusM:.22});
    pass("Arrived and inspected the selected growing crop without a game action",{target:"culture-2",states:cropSteps.states});
    await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);await page.waitForSelector('[data-grow-motion="reduced"]');
    await selectOnFloor("culture-3");
    await page.waitForSelector('[data-grow-actor][data-actor-target="culture-3"]');
    pass("Reduced motion preserves inspection of the new selection");
    await visit("empty");await page.waitForSelector("[data-grow-pick]",{hidden:true});await page.waitForFunction(()=>window.inspectFixture?.().calls.some(c=>c.path.includes("/warehouse")&&c.status===200));
    assert.equal((await page.$$("[data-grow-pick]")).length,0);pass("Empty warehouse has no invented crops");
    }
    }
    if(!group||group==="warehouse"||group==="orientation"){
      if(group==="orientation"){
        await viewport(390);
        await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
      }
      await visit("legacy");assert.equal(await page.$("[data-grow-isometric]"),null);
      assert.equal((await page.$$("[data-grow-bay]")).length,1);
      assert.equal((await page.$$("select[aria-label='Choisir une zone de culture'] option")).length,7);
      await page.focus(pick("tent-1"));await page.keyboard.press("End");await page.waitForSelector(pick("tent-7")+'[aria-pressed="true"]');
      assert.equal((await page.$$("[data-grow-bay]")).length,1);
      pass("Historic installation keeps all seven tents keyboard-accessible, shown one at a time without an invented plan");
      const rotatedPixels=await compareRotation();
      pass("Real WebGL output changes when a full storage station turns 180° inside the same footprint",{rotatedPixels,comparisonPixels:16800});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);report.passed=true;
  }catch(error){report.failure=String(error.stack||error);report.diagnostic=await page.evaluate(()=>({text:document.body.innerText.slice(0,800),actor:{...document.querySelector("[data-grow-actor]")?.dataset},last:window.inspectFixture?.().calls.slice(-4)})).catch(()=>null);await page.screenshot({path:resolve(output,"failure.png")}).catch(()=>{});throw error;}
  finally{
    const json=JSON.stringify(report,null,2);
    await writeFile(resolve(output,"report.json"),json);
    if(serve&&!group&&!nativeGpu){
      if(report.passed)await Promise.all(screenshots.map(file=>copyFile(resolve(output,file),resolve(root,"output/culture-room",file))));
      await writeFile(resolve(root,"output/culture-room/report.json"),json);
    }
    await browser.close();
    if(!serve)await server.close();
  }
}

