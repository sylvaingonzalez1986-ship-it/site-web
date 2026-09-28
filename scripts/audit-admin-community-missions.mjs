/** Real admin components; synthetic API and browser only. Never contacts Supabase. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd(), output = resolve(root, "output/admin-community-missions");
const port = 3254;
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';import {AdminMissionsPanel} from '/src/components/admin/AdminMissionsPanel';
const scenario=new URLSearchParams(location.search).get('scenario');
const mission={id:'mission-flower',slug:'fleur-en-arene',title:'Ta fleur entre en scène',description:'Montre ta fleur prête à combattre.',icon:'camera',rewardType:'support_pack',rewardAmount:1,rewardCardId:null,maxCompletionsPerUser:1,requiresProof:true,proofInstructions:'La fleur et ton pseudo doivent être visibles.',isActive:true,sortOrder:1};
const submissions=['support_pack','game_cash','buddies','packs','points'].map((rewardType,index)=>({id:'submission-'+index,userId:'player-'+index,missionId:mission.id,missionTitle:mission.title,missionSlug:mission.slug,userName:'Joueur '+index,userEmail:'joueur'+index+'@example.test',revision:2,proofUrl:'https://example.test/publication',proofStoragePath:'fake/image.webp',proofSignedUrl:'/contest/mascot/flower-inspector.png',proofText:'Voici ma fleur.',proofContentType:'image/webp',proofFileSize:1000,proofUploadedAt:'2026-09-28T10:00:00Z',status:'pending',adminNote:null,reviewedBy:null,reviewedAt:null,rewardGranted:false,createdAt:'2026-09-28T10:00:00Z',rewardType,rewardAmount:rewardType==='game_cash'?1250:1,rewardCardId:rewardType==='buddies'?'buddy-1':null,rewardCardName:rewardType==='buddies'?'Le Jardinier':null,rewardLabel:null}));
window.__requests=[];window.__fail=scenario==='load-error';window.__failReview=false;window.__saved=null;
const nativeFetch=window.fetch.bind(window);
window.fetch=async(url,init={})=>{
 if(String(url)!=='/api/admin/missions') return nativeFetch(url,init);
 if(!init.method){if(window.__fail)return Response.json({error:'Service temporairement indisponible.'},{status:503});return Response.json({overview:{totalMissions:1,totalSubmissions:5,pendingSubmissions:submissions.filter(s=>s.status==='pending').length,approvedSubmissions:0,rejectedSubmissions:0,changesRequestedSubmissions:0,submissions},missions:[mission],pendingReferrals:[],referralSettings:{pointsAmount:50,packsAmount:5,updatedAt:null},buddyOptions:[{id:'buddy-1',name:'Le Jardinier',rarity:'common',imageUrl:'/contest/mascot/flower-inspector.png'}]});}
 const body=JSON.parse(init.body);window.__requests.push(body);await new Promise(resolve=>setTimeout(resolve,180));
 if(init.method==='POST'){
  if(window.__failReview)return Response.json({error:'Connexion interrompue. Réessayez.'},{status:503});
  const s=submissions.find(s=>s.id===body.submissionId);if(s.revision!==body.expectedRevision)return Response.json({error:'La preuve a changé. Rechargez.'},{status:409});
  s.status={approve:'approved',reject:'rejected',request_changes:'changes_requested'}[body.action];s.adminNote=body.adminNote??null;s.rewardGranted=body.action==='approve';s.reviewedAt=new Date().toISOString();return Response.json({ok:true});
 }
 window.__saved=body;return Response.json({ok:true});
};
createRoot(document.getElementById('root')).render(React.createElement('main',{style:{maxWidth:1400,margin:'auto'}},React.createElement(AdminMissionsPanel)));`;
const server = await createServer({root,configFile:false,envDir:false,publicDir:resolve(root,"public"),cacheDir:resolve(output,"vite-cache"),esbuild:{jsx:"automatic",loader:"tsx"},optimizeDeps:{include:["react","react-dom/client","lucide-react"]},resolve:{alias:{"@":resolve(root,"src")}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
 name:"admin-missions-fixture",resolveId(id){if(id==="admin-entry.tsx")return "\0admin-entry.tsx";},load(id){if(id==="\0admin-entry.tsx")return entry;},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split("?")[0]!=="/")return next();res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin missions · Démo locale</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__admin-entry.tsx"></script></html>');});}
}],server:{host:"127.0.0.1",port,strictPort:true,hmr:false,watch:null}});
let browser;
try {
 await mkdir(output,{recursive:true});await server.listen();
 if(process.argv.includes("--serve")){console.log(`Admin preview (synthetic data): http://127.0.0.1:${port}`);await new Promise(()=>{});}
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:["--no-sandbox","--disable-gpu"]});
 const page=await browser.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on("request",r=>{const u=new URL(r.url());void ((u.protocol==="data:"||(u.hostname==="127.0.0.1"&&u.port===String(port)))?r.continue():r.abort());});
 const go=async(scenario="ready")=>{await page.goto(`http://127.0.0.1:${port}/?scenario=${scenario}`,{waitUntil:"networkidle0"});};
 const click=async(text)=>page.$$eval("button",(buttons,text)=>buttons.find(b=>b.textContent.includes(text)).click(),text);
 const waitText=async(text)=>page.waitForFunction(text=>document.body.textContent.includes(text),{},text);
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:900});await go();await waitText("Les preuves à vérifier");await overflow();
  assert.equal(await page.$$eval("button",buttons=>buttons.filter(b=>b.textContent.includes("Valider et attribuer")).length),5);
  await page.screenshot({path:resolve(output,`queue-${width}.png`),fullPage:true});
 }
 await page.setViewport({width:390,height:844});
 await click("Demander une correction");await waitText("Ajoutez un message au joueur");assert.equal(await page.evaluate(()=>window.__requests.length),0);
 assert.equal(await page.evaluate(()=>document.activeElement.id),"review-note-submission-0");
 await page.type("#review-note-submission-0","Le pseudo doit être visible.");
 await page.evaluate(()=>{window.__failReview=true;});await click("Demander une correction");await waitText("Connexion interrompue");
 const failed=await page.evaluate(()=>window.__requests[0]);
 await page.evaluate(()=>{window.__failReview=false;});await click("Demander une correction");await waitText("Correction demandée");
 const retried=await page.evaluate(()=>window.__requests[1]);assert.equal(failed.requestKey,retried.requestKey);assert.equal(retried.expectedRevision,2);assert.equal(retried.action,"request_changes");
 await click("À corriger");await waitText("Message au joueur");await page.screenshot({path:resolve(output,"correction-390.png"),fullPage:true});
 await click("À vérifier");
 const before=await page.evaluate(()=>window.__requests.length);
 await page.$$eval("button",buttons=>{const b=buttons.find(b=>b.textContent.includes("Valider et attribuer"));b.click();b.click();});
 await waitText("Participation validée");assert.equal(await page.evaluate(()=>window.__requests.length),before+1);
 await click("Validées");await waitText("Gain attribué");await waitText("12,5 € du jeu");
 await click("Catalogue et récompenses");await overflow();
 await page.select("#mission-rewardType","buddies");assert(await page.$("#mission-buddy"));await page.select("#mission-buddy","buddy-1");
 await page.select("#mission-rewardType","game_cash");
 await page.type("#mission-title","Récompense fleur");await page.type("#mission-slug","fleur-bonus");await page.type("#mission-description","Partage ta fleur.");
 await page.focus("#mission-rewardAmount");await page.keyboard.down("Control");await page.keyboard.press("KeyA");await page.keyboard.up("Control");await page.keyboard.press("Backspace");await page.type("#mission-rewardAmount","12.50");await click("Creer la mission");
 assert(await page.$("fieldset[disabled]"));
 const savingCount=await page.evaluate(()=>window.__requests.length);await click("Desactiver");assert.equal(await page.evaluate(()=>window.__requests.length),savingCount);
 await page.waitForFunction(()=>Boolean(window.__saved));const saved=await page.evaluate(()=>window.__saved.mission);assert.equal(saved.rewardAmount,1250);assert.equal(saved.rewardCardId,null);assert.equal(saved.isActive,false);
 await page.screenshot({path:resolve(output,"catalog-390.png"),fullPage:true});
 await go("load-error");await waitText("Les missions ne sont pas disponibles");assert.equal(await page.$$eval("button",buttons=>buttons.some(b=>b.textContent.includes("Valider et attribuer"))),false);
 await page.evaluate(()=>{window.__fail=false;});await click("Recharger");await waitText("Les preuves à vérifier");await overflow();
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,"report.json"),JSON.stringify({passed:true,widths:[320,390,768,1440],checks:["manual-queue-default","correction-note-required","retry-same-request-key","double-click-single-request","revision-in-review","exact-currency-conversion","buddy-selector","draft-by-default","catalog-mutations-serialized","load-error-recovery"],errors},null,2));
 console.log("Admin missions UI: responsive queue, corrections, retries, duplicate clicks, reward editor and recovery passed.");
} finally {await browser?.close();await server.close();}
