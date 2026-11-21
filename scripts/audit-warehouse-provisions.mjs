// Chromium and a disposable PostgreSQL database. The browser uses the actual
// warehouse catalogue, seed preparation and crop health components with the application RPCs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { installWarehousePreparations } from "./lib/warehouse-preparation-fixture.mjs";
import { installCultureCareFixture, installCultureCareWork } from "./lib/culture-care-fixture.mjs";

const out = resolve("output/warehouse-provisions");
const fixtureCashCents = 250000;
const retail = JSON.parse(await readFile("src/lib/kanab-quest-warehouse-retail-supplies.json", "utf8"));
await mkdir(out, { recursive: true });
const original = await readFile("scripts/audit-placard-warehouse-v4.mjs", "utf8");
const bootstrap = original.slice(0, original.indexOf("if(process.argv.includes('--preview'))"));
const entry = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqWarehouseSupplies,WarehouseRunSupplies} from '/src/components/placard/KqWarehouseSupplies';
import {KqWarehouseLaunchSupplies} from '/src/components/placard/KqWarehouseLaunchSupplies';
import {KqCultureCarePanel} from '/src/components/placard/KqCultureCarePanel';
import {getKqCampaignParticipants} from '/src/lib/kanab-quest-campaign';
import {formatKqCash} from '/src/lib/kanab-quest-equipment';
import {createKqWarehouseEmpty,createKqWarehouseStarter,getKqWarehouseQuote} from '/src/lib/kanab-quest-warehouse';
const starter=createKqWarehouseStarter();
const empty=createKqWarehouseEmpty();
const installation=getKqWarehouseQuote({...empty, zones:[{...starter.zones[0],id:'zone',x:1,y:1,width:2,height:1,name:'Serre est',active:true,buddieCode:'HH2026-002',optionCodes:['SIM-SUBSTRATE-01']}],
 serviceZones:[],airPlacements:[],stationPlacements:[{id:'centrale',x:0,y:1,code:'SIM-WATER-03'}]},empty);
const layout=installation.nextState;
const members=getKqCampaignParticipants(layout,1,undefined,null,1);
window.fetch=async(url,init)=>{const result=await window.register(String(url),init?.body?JSON.parse(init.body):null);return Response.json(result.body,{status:result.status});};
function Preview(){
 const [installed,confirm]=useState(false);
 const [section,set]=useState('nutrition'),[ready,setReady]=useState(null),[active,start]=useState(null),[crop,updateCrop]=useState(null),[busy,setBusy]=useState(false);
 if(!installed)return <main><h1>Entrepôt de recette · 100 m²</h1><p>Budget du scénario d’irrigation · {formatKqCash(${fixtureCashCents})}</p><button onClick={async()=>{await window.installPlan(layout,installation.totalCostCents);confirm(true)}}>Installer les bacs, lampes et centrale · {formatKqCash(installation.totalCostCents)}</button></main>;
 return <main style={{maxWidth:960,margin:'auto',padding:12,background:'#fff3dc'}}>
 <nav>{[['nutrition','Intrants et provisions'],['water','Irrigation'],[active?'health':'review',active?'Santé':'Préparer le semis'],...(active?[['provisions','Provisions de la zone']]:[])].map(([id,label])=><button data-section={id} key={id} onClick={()=>set(id)}>{label}</button>)}</nav>
 <h2>{section==='review'?'Préparer mes cultures':section==='health'?'Santé':section==='provisions'?'Provisions de la zone':section==='water'?'Irrigation':'Intrants et provisions'}</h2>
 {section==='provisions'?<WarehouseRunSupplies runs={[{runId:active,name:'Serre est'}]}/>:section==='health' && crop ? <><KqCultureCarePanel presentation="carousel" state={crop} runId={active} request={window.fetch} onStateChange={updateCrop} onBusyChange={setBusy}/>
 <button data-check-stage disabled={busy || crop.phase==='resolved'} onClick={async()=>updateCrop(await window.checkStage(active))}>Valider l’opération</button></> :section==='review'?<>
 <KqWarehouseLaunchSupplies members={members} onReady={setReady}/>
 <button disabled={!ready} onClick={async()=>{const result=await window.launch(members[0].warehouse,ready);start(result.id);updateCrop(result.state);set('health')}}>Lancer la culture</button></>:<KqWarehouseSupplies key={section} section={section} layout={layout}/>}</main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);`;
const start = bootstrap.indexOf("  'warehouse-v4-entry':");
const end = bootstrap.indexOf("\n};", start);
const serverModule = bootstrap.slice(0,start) + "  'warehouse-v4-entry':" + JSON.stringify(entry) + bootstrap.slice(end);
const local = resolve(out,"serve.mjs");
await writeFile(local, serverModule.replace("?? 3248","?? 0").replace("'output/warehouse-v4'","'output/warehouse-provisions'") + "\nconst listeningOrigin='http://127.0.0.1:'+server.httpServer.address().port;export {server,listeningOrigin as origin};");
const {server,origin} = await import(pathToFileURL(local).href);
let browser,db;
try {
  db=new PGlite();
  const migration=name=>readFile(resolve("supabase/migrations",name),"utf8");
  await installCultureCareFixture(db,migration);
  await db.exec(await migration("20261010000600_kq_care_explicit_problems.sql"));
  await db.exec(await migration("20261010001000_kq_paid_basic_care.sql"));
  await installCultureCareWork(db,migration);
  for(const name of ["20261108000900_kq_care_surface_and_purchase_register","20261118000100_kq_care_sectors","20261118000400_kq_care_input_sectors"]) await db.exec(await migration(name+".sql"));
  await installWarehousePreparations(db,{retail:false});
  for(const name of ["20261121001300_kq_warehouse_care_provisions","20261122000200_kq_warehouse_retail_supplies","20261122000310_kq_warehouse_airlock_preparation","20261122000500_kq_warehouse_supply_packs","20261122000510_kq_supply_clock_after_lock"]) await db.exec(await migration(name+".sql"));
  await db.exec("ALTER FUNCTION kq_treasury_initialize(uuid) SET search_path=pg_catalog,public; ALTER FUNCTION fixture_wallet_movement() SET search_path=pg_catalog,public;");
  const {startKqGame,rollKqDice,resolveKqStage,previewKqResolution}=await server.ssrLoadModule("/src/lib/kanab-quest-game.ts");
  const {KQ_CARE_PRODUCTS,applyKqCareProduct}=await server.ssrLoadModule("/src/lib/kanab-quest-care.ts");
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:["--no-sandbox"]});
  const checks=[];
  for(const width of [1440,320]){
    const owner=randomUUID(),page=await browser.newPage();
    const errors=[];
    let installationCents=0;
    const scalar=async(sql,args)=>(await db.query(sql,args)).rows[0].value;
    const runRow=async id=>(await db.query("select state,updated_at::text from kq_runs where id=$1 and user_id=$2",[id,owner])).rows[0];
    await db.query("insert into auth.users(id) values($1)",[owner]);
    await db.query("insert into kq_equipment_wallets(user_id,cash_cents) values($1,$2)",[owner,fixtureCashCents]);
    await page.setViewport({width,height:width===320?720:900,isMobile:width===320,hasTouch:width===320});
    page.on("pageerror",error=>{ errors.push(error.message); console.error(error.message); });
    await page.exposeFunction("installPlan",(layout,quotedCents)=>db.transaction(async tx=>{
      const existing=await tx.query("select state from kq_warehouse_layouts where user_id=$1",[owner]);
      if(existing.rows.length){assert.deepEqual(existing.rows[0].state,layout);return true;}
      assert(Number.isInteger(quotedCents)&&quotedCents>0);
      const debit=await tx.query("update kq_equipment_wallets set cash_cents=cash_cents-$2 where user_id=$1 and cash_cents>=$2 returning cash_cents",[owner,quotedCents]);
      assert.equal(debit.rows.length,1);
      installationCents=quotedCents;
      await tx.query("insert into kq_warehouse_layouts values($1,$2)",[owner,layout]);return true;
    }));
    await page.exposeFunction("register",async(url,command)=>{
      try {
        const parsed=new URL(url,origin), intervention=parsed.pathname.match(/\/runs\/([^/]+)\/care$/);
        if(intervention && command){
          const id=intervention[1],run=await runRow(id);
          const next=applyKqCareProduct(run.state,command.productCode,command.target);
          const body=await scalar("select rpc_kq_apply_care($1,$2,$3,$4,$5,$6,NULL) value",[owner,id,command.productCode,command.requestKey,run.updated_at,next]);
          return {status:200,body};
        }
        if(parsed.pathname.endsWith("/care")){
          const body=await scalar("select rpc_kq_care_shop_v2($1,$2) value",[owner,parsed.searchParams.get("runId")]);
          for(const product of KQ_CARE_PRODUCTS) assert.equal(body.prices[product.code],retail[product.code].packPriceCents);
          return {status:200,body:{...body,catalog:KQ_CARE_PRODUCTS.map(p=>({...p,priceCents:body.prices[p.code]}))}};
        }
        return {status:200,body:command?await scalar("select rpc_kq_warehouse_preparation_command($1,$2,$3) value",[owner,command.requestKey,command])
          :await scalar("select rpc_kq_warehouse_preparations($1) value",[owner])};
      } catch(error){console.error(error.message,error.where);return {status:409,body:{error:error.message}};}
    });
    await page.exposeFunction("launch",async(warehouse,quoteKey)=>{
      const id=randomUUID();
      let state;
      for(let seed=1;seed<=100;seed++){
        const candidate=startKqGame(seed,{warehouse});
        if(["success","critical"].includes(previewKqResolution(rollKqDice(candidate))?.outcome)){state=candidate;break;}
      }
      assert(state);
      state.care.problems=[{code:"IRON",severity:2,status:"confirmed",trend:"stable",variant:0,appearedAt:0,plants:[{zoneId:"zone",x:1,y:0,slot:0,severity:2}]}];
      await db.transaction(async tx=>{
        await tx.query("insert into kq_runs(id,user_id,status,warehouse_zone_id,state) values($1,$2,'active','zone',$3)",[id,owner,state]);
        await tx.query("select kq_warehouse_launch_preparations($1,$2,ARRAY[$2]::uuid[],'{}',$3)",[owner,id,quoteKey]);
      }); return {id,state:(await runRow(id)).state};
    });
    await page.exposeFunction("checkStage",async id=>{
      const {state}=await runRow(id);
      const checked=resolveKqStage(rollKqDice(state));
      assert(checked.care.problems.every(p=>p.code!=="IRON"),"Targeted iron treatment resolves the grade-two deficiency in the successful check");
      await db.query("update kq_runs set state=$2 where id=$1",[id,checked]);
      return checked;
    });
    await page.goto(origin,{waitUntil:"domcontentloaded",timeout:90000});
    const click=async selector=>{
      const node=await page.waitForSelector(selector,{visible:true,timeout:60000}).catch(async error=>{
        console.error((await page.$eval("body",el=>el.innerText)).slice(0,1600));throw error;
      });
      await node.evaluate(el=>el.scrollIntoView({block:"center"}));
      await page.waitForFunction(el=>!el.disabled,{},node);
      if(width===320) await node.tap(); else {await node.focus();await page.keyboard.press("Enter");}
      await node.dispose();
    };
    await click("button::-p-text(Installer les bacs)");
    const base="WAREHOUSE-NUTRITION-BASE", iron="CARE-IRON", provision="WAREHOUSE-PBI";
    const card=code=>'[data-warehouse-supply="'+code+'"]';
    const buy=async(code,packs,previous)=>{
      const product=card(code), details=product+" summary";
      await click(details);
      assert.equal(await page.$eval(product+" details a",node=>node.href),retail[code].url);
      await click(details);
      if(packs>1){
        const quantity=product+" input[type=number]";
        await page.focus(quantity); await page.keyboard.press("ArrowUp");
        assert.equal(await page.$eval(quantity,node=>node.value),String(packs));
      }
      await click(product+" [data-warehouse-buy-pack]");
      const expected=previous+packs*retail[code].chargesPerPack;
      await page.waitForFunction((selector,count)=>document.querySelector(selector+" [data-supply-stock]")?.dataset.supplyStock===String(count),{},product,expected);
      assert.equal(await scalar("select quantity::int value from kq_warehouse_input_stock where user_id=$1 and code=$2",[owner,code]),expected);
    };
    await buy(base,1,0);
    await buy(provision,1,0);
    await buy(iron,2,0);
    await page.screenshot({path:resolve(out,"prix-public-"+width+".png")});
    await click("[data-section=water]");
    await click("section button::-p-text(Préparer le mélange)");
    await page.waitForSelector("button::-p-text(Remplacer le mélange)");
    await click("[data-section=review]");
    await page.waitForSelector("p::-p-text(1 / 2 m² alimentés au semis)");
    assert.equal(await page.$$eval("[data-launch-supplies] input",nodes=>nodes.length),0);
    assert((await page.$eval("[data-launch-supplies]",el=>el.innerText)).includes("+3,5 %"));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:resolve(out,"semis-"+width+".png"),fullPage:true});
    await click("button::-p-text(Lancer la culture)");
    await page.waitForSelector("[data-care-problem-location]");
    assert.match(await page.$eval("[data-care-problem-location]",el=>el.innerText),/Serre est, case 2, 1/);
    const atSowing=2*retail[iron].chargesPerPack;
    await click("[data-section=nutrition]");
    await buy(iron,1,atSowing);
    await click("[data-section=health]");
    await click("[data-care-open-products]");
    const care='[data-care-product="CARE-IRON"]';
    await page.waitForFunction((s,n)=>document.querySelector(s+' [data-care-stock]')?.dataset.careStock===String(n),{},care,atSowing);
    assert.equal(await page.$$eval("[data-care-product]",nodes=>nodes.length),1);
    assert.match(await page.$eval(care,el=>el.innerText),/CANNA Mono Fer/);
    assert.equal(await page.$eval(care+" [data-care-product-use]",el=>el.dataset.careTarget),JSON.stringify(["zone",1,0]));
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    await page.$eval(care,el=>el.scrollIntoView({block:"center",behavior:"instant"}));
    await page.screenshot({path:resolve(out,"soin-"+width+".png")});
    await click(care+" [data-care-product-use]");
    await page.waitForFunction(n=>document.querySelector("[data-care-feedback]")?.innerText.includes("Stock restant pour la culture : "+n+" charges"),{},atSowing-1);
    assert.match(await page.$eval("[data-care-feedback]",el=>el.innerText),/1 charge consommée pour 1 m².*Serre est, case 2, 1/);
    const remaining=await scalar("select quantity::int value from kq_warehouse_input_stock where user_id=$1 and code=$2",[owner,iron]);
    assert.equal(remaining,atSowing+retail[iron].chargesPerPack-1);
    const receipt=await scalar("select count(*)::int value from kq_care_interventions where user_id=$1 and product_code=$2 and charged_cents=0",[owner,iron]);
    assert.equal(receipt,1);
    await click("[data-check-stage]");
    await click("[data-care-section=overview]");
    await click("[data-care-last-check] summary");
    const healthCheck=await page.$eval("[data-care-last-check]",el=>el.innerText);
    assert.match(healthCheck,/problème résorbé/);
    await page.screenshot({path:resolve(out,"bilan-"+width+".png")});
    await click("[data-section=provisions]");
    await click('[data-warehouse-use="WAREHOUSE-PBI"]');
    await page.waitForFunction(name=>[...document.querySelectorAll("p")].some(p=>p.innerText.includes(name+" · consommation de 1 dose")),{},retail[provision].name);
    const totals=await db.query("select code, reserved, consumed from kq_warehouse_run_inputs i join kq_runs r on r.id=i.run_id where r.user_id=$1 and i.consumed>0 order by code",[owner]);
    assert.deepEqual(totals.rows.map(r=>r.code),[iron,base,provision]);
    assert(totals.rows.every(row=>row.reserved===0&&row.consumed===1));
    const suppliesCents=retail[base].packPriceCents+retail[provision].packPriceCents+3*retail[iron].packPriceCents;
    const cashCents=await scalar("select cash_cents value from kq_equipment_wallets where user_id=$1",[owner]);
    assert.equal(cashCents,fixtureCashCents-installationCents-suppliesCents);
    assert.deepEqual(errors,[]);
    checks.push({width,fixtureCashCents,installationCents,suppliesCents,cashCents,product:iron,atSowing,usableAfterTreatment:atSowing-1,remainingInWarehouse:remaining,healthCheck,inputs:totals.rows});
    await page.close();
  }
  await writeFile(resolve(out,"rapport.json"),JSON.stringify(checks,null,2));
  console.log("Achats par conditionnement, semis, traitement ciblé et bilan vérifiés à 1440 et 320 px.");
} finally {
  await browser?.close(); await db?.close(); server.httpServer?.closeAllConnections(); await server.close();
}
