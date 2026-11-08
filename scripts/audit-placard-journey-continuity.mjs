/** Real player Shell, preparation and storage; every API operation stays in memory. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-journey-continuity');
const port = Number(process.env.KQ_JOURNEY_PORT ?? 3426), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const preparationOnly = process.argv.includes('--preparation-only'), storageOnly = process.argv.includes('--storage-only');
const guideNavigationOnly = process.argv.includes('--guide-navigation-only');
const guideCompletionOnly = process.argv.includes('--guide-completion-only');
const guideOnly = guideNavigationOnly || guideCompletionOnly || process.argv.includes('--guide-only'), workshopOnly = process.argv.includes('--workshop-only'), staffGuideOnly = process.argv.includes('--staff-guide-only');
const workPlanOnly = process.argv.includes('--work-plan-only');
const financialSupportOnly = process.argv.includes('--financial-support-only');
const sharedTrimOnly = process.argv.includes('--shared-trim-only');
const cultureWorkOnly = process.argv.includes('--culture-work-only');
const cultureCarouselVisualOnly = process.argv.includes('--culture-carousel-visual-only');
const cultureQualityOnly = process.argv.includes('--culture-quality-only');
const cultureBadgesOnly = process.argv.includes('--culture-badges-only');
const cultureCarouselOnly = cultureBadgesOnly || cultureQualityOnly || cultureCarouselVisualOnly || process.argv.includes('--culture-carousel-only');
const reportName = cultureBadgesOnly ? 'culture-badges-report.json' : cultureQualityOnly ? 'culture-quality-report.json' : cultureCarouselVisualOnly ? 'culture-carousel-visual-report.json' : cultureCarouselOnly ? 'culture-carousel-report.json' : cultureWorkOnly ? 'culture-work-report.json' : sharedTrimOnly ? 'shared-trim-report.json' : financialSupportOnly ? 'financial-support-report.json' : workPlanOnly ? 'work-plan-report.json' : staffGuideOnly ? 'staff-guide-report.json' : workshopOnly ? 'workshop-report.json' : guideCompletionOnly ? 'guide-completion-report.json' : guideNavigationOnly ? 'guide-navigation-report.json' : guideOnly ? 'guide-report.json' : preparationOnly ? 'preparation-report.json' : storageOnly ? 'storage-report.json' : 'report.json';
const targetId = 'c0a00002-0000-4000-8000-000000000002', decoyId = 'c0a00001-0000-4000-8000-000000000001';
const planEmployeeId = 'c0a00003-0000-4000-8000-000000000003';
const entry = `
import React from'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
import{PlacardPlayerShell}from'/src/components/placard/PlacardPlayerShell';
import{KqTutorialApiProvider,createKqTutorialApi}from'/src/components/placard/KqTutorialApiContext';
import{createReleveCultureTransport}from'/src/lib/kanab-quest-releve-culture';
import{createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan}from'/src/lib/kanab-quest-releve-production';
import{createKqOperationsLesson,getKqOperationsStorage,getKqOperationsEquipment}from'/src/lib/kanab-quest-operations-lesson';
import{createKqStaffState,projectKqStaffSnapshot,applyKqStaffCommand,getKqStaffMonthlyCost}from'/src/lib/kanab-quest-staff';
import{FARM_GUIDE_STEPS}from'/src/lib/kanab-quest-farm-progress';
import{FARM_GUIDE_CHAPTERS}from'/src/lib/kanab-quest-farm-guide';
import{encodeKqSave,parseKqGameSave}from'/src/lib/kanab-quest-persistence';
window.__guideIds={steps:FARM_GUIDE_STEPS.map(step=>step.id),chapters:FARM_GUIDE_CHAPTERS.map(chapter=>chapter.id)};
const scenario=new URLSearchParams(location.search).get('scenario')||'preparation';
window.__financialSupportUrl=scenario==='financial-support-hidden'?'':scenario==='financial-support-invalid'?'javascript:alert(1)':'https://pay.vivawallet.com/les-champs-bretons';
if(${financialSupportOnly}){
 if(scenario==='financial-support-default')delete window.process.env.NEXT_PUBLIC_KQ_FINANCIAL_SUPPORT_URL;
 else window.process.env.NEXT_PUBLIC_KQ_FINANCIAL_SUPPORT_URL=window.__financialSupportUrl;
}
const workdayScenario=scenario==='workday';
const workshopScenario=scenario==='workshop',staffGuideScenario=scenario==='staff-guide',staffPlanScenario=scenario==='staff-plan',storageScenario=scenario.startsWith('storage')||workshopScenario||staffPlanScenario;
if(!new URLSearchParams(location.search).has('view'))history.replaceState(null,'','?scenario='+scenario+'&view='+(storageScenario?'harvests':'game&campaign=1'));
let production=createKqReleveProduction();const act=action=>production=applyKqReleveProductionAction(production,action);
act({type:'draft',warehouse:suggestKqRelevePlan(production)});act({type:'save-plan'});
for(let index=0;index<3;index++)act({type:'reveal-buddie'});
act({type:'assign',zoneId:production.warehouse.zones[0].id,buddieCode:production.ownedBuddies[0]});act({type:'save-plan'});
if(scenario.startsWith('culture-carousel')){
 act({type:'launch'});production.game={...production.game,xp:20};
 if(scenario==='culture-carousel-complete')for(let index=0;index<6;index++){act({type:'roll'});act({type:'assist'});act({type:'resolve'});act({type:'advance'});}
 if(scenario==='culture-carousel-dead')production.game={...production.game,phase:'complete',cultureDead:true,harvestGrams:0,completedAt:new Date(production.clock).toISOString(),care:{...production.game.care,vitality:0}};
}
const badgeCase=new URLSearchParams(location.search).get('badgeCase');
if(${cultureBadgesOnly}&&badgeCase){
 const hand=['BOTTE-005','BOTTE-005','BOTTE-017','BOTTE-003','BOTTE-006','BOTTE-024'];
 production.supportInventory={'BOTTE-005':9,'BOTTE-017':7,'BOTTE-003':8,'BOTTE-006':6,'BOTTE-024':4};
 production.deckCodes=hand;production.cashCents=900000;
 production.game={...production.game,deckCodes:hand,handCodes:hand,collectionCodes:Object.keys(production.supportInventory),xp:20,situationCodes:['SIT-001',...production.game.situationCodes.slice(1)]};
 delete production.game.heritageReserveCodes;
 production.careInventory={'CARE-COMPOST-TEA':9,'CARE-SEAWEED':4,'CARE-APHIDIUS':3,'CARE-SWIRSKII':8,'CARE-ORGANIC-FEED':5,'CARE-PHYTOSEIULUS':2};
 production.game.care={...production.game.care,problems:['APHIDS','SALTS','HEAT','MITES'].map(code=>({code,severity:2,status:'confirmed',trend:'stable',appearedAt:0,variant:0}))};
 if(badgeCase==='xp-zero')production.game.xp=0;
 if(badgeCase==='stock-zero'){production.supportInventory['BOTTE-005']=0;production.supportInventory['BOTTE-017']=0;}
 if(badgeCase==='rolled')production.game={...production.game,phase:'rolled',dice:[1,2,4]};
 if(badgeCase==='resolved')production.game={...production.game,phase:'resolved'};
 if(badgeCase==='used-input')production.game.care.applications=[{productCode:'CARE-VERMICOMPOST',stageIndex:0}];
 if(badgeCase==='zero'){production.careInventory={};production.cashCents=0;}
 if(badgeCase==='poor-care')production.cashCents=100;
 if(badgeCase==='late')production.game.stageIndex=4;
 if(badgeCase==='finished-care')production.game={...production.game,stageIndex:4,phase:'resolved'};
 if(badgeCase==='stage-transition')production.game={...production.game,stageIndex:3,phase:'rolled',dice:[6,6,6]};
 if(badgeCase==='base'&&!parseKqGameSave(encodeKqSave(production.game)))throw Error('Invalid local badge transaction fixture');
}
const initial=structuredClone(production);
const lesson=createKqOperationsLesson(scenario==='storage-overflow'?'warehouse':'market'),base=getKqOperationsStorage(lesson);
const baseStorage={...base,capacity:Object.fromEntries(Object.entries(base.capacity).map(([key,value])=>[key,value*2])),ownedContainers:Object.fromEntries(Object.entries(base.ownedContainers).map(([key,value])=>[key,value*2])),containers:base.containers.map(container=>({...container,ownedQuantity:container.ownedQuantity*2,occupiedQuantity:container.occupiedQuantity*2,storedUnits:container.storedUnits*2,freeQuantity:container.freeQuantity*2}))};
const targetId='${targetId}',decoyId='${decoyId}';
const staffNow='2026-11-07T12:00:00.000Z';
const staffRaw={state:createKqStaffState(staffNow),revision:0,serverNow:staffNow,cashCents:production.cashCents,context:{businessStartedAt:staffNow,reputation:0,instagramFollowers:0,shopPartners:0,activeRuns:[],processingBatches:[],supplierInvoices:[],trimLots:[{flowerId:targetId,name:'Cherry Abacus à trimmer',requiredWork:6,completedWork:0,mode:null,completedAt:null}]}};
if(${sharedTrimOnly}){staffRaw.context.trimQueueVersion=2;staffRaw.context.trimLots.unshift({...staffRaw.context.trimLots[0],flowerId:decoyId});staffRaw.context.trimLots.forEach((lot,index)=>Object.assign(lot,{totalGrams:360,completedGrams:0,createdAt:new Date(Date.parse(staffNow)-(2-index)*60000).toISOString()}))}
if(staffPlanScenario){const candidate=projectKqStaffSnapshot(staffRaw).candidates[0];staffRaw.state=applyKqStaffCommand(staffRaw,{action:'hire',candidateCode:candidate.code,contract:'cdi',weeklyHours:35,durationMonths:0,reason:'permanent',expectedMonthlyCostCents:getKqStaffMonthlyCost(candidate,35).totalCents},'${planEmployeeId}').state;staffRaw.context.trimLots.push({flowerId:decoyId,name:'Autre récolte à trimmer',requiredWork:6,completedWork:0,mode:null,completedAt:null})}
staffRaw.context.trimQueueVersion=2;staffRaw.context.trimLots=staffRaw.context.trimLots.map((lot,index)=>({...lot,totalGrams:360,completedGrams:0,createdAt:new Date(Date.parse(staffNow)-(2-index)*60000).toISOString()}));
const lots=[{...baseStorage.lots[0],flowerId:decoyId,varietyName:'Cherry Abacus'},{...baseStorage.lots[0],flowerId:targetId,varietyName:'Cherry Abacus'}];
const storageSnapshot=()=>({...baseStorage,lots:storageScenario?lots:[]});
let storageMode='known',collectionMode='known',heritageMode='known',staffMode='known',storageDelay=0,allowPlay=false,actionMode='known',careMode=new URLSearchParams(location.search).get('careMode')??'known',careMutationMode='known';
const deferred=[];window.__calls=[];window.__unexpected=[];
const cultureWorkSteps=new Set();
const transport=createReleveCultureTransport({getState:()=>production,setState:next=>production=next});
const response=(body,status=200)=>Response.json(body,{status});
const projectSoloSession=payload=>{if(scenario==='culture-carousel-solo')for(const run of [payload.activeRun,...payload.activeRuns??[]])if(run)delete run.state.campaign;return payload};
const request=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method??'GET',body=init.body?JSON.parse(init.body):null;
 window.__calls.push({path,method,body,...(${cultureBadgesOnly}?{query:url.search}:{})});
 if(path.endsWith('/social/player')&&method==='GET')return response({firstName:'Joueur',profile:null});
 const permittedPlay=allowPlay&&method==='POST'&&(path.endsWith('/runs')||/\\/runs\\/[^/]+\\/actions$/.test(path)||(${cultureBadgesOnly}&&(path.endsWith('/care')||/\\/runs\\/[^/]+\\/cards$/.test(path))));
 if(method!=='GET'&&(staffGuideScenario||staffPlanScenario||(!(method==='PATCH'&&path.endsWith('/warehouse'))&&!permittedPlay))){window.__unexpected.push({path,method,body});return response({error:'Mutation interdite dans cette recette.'},403)}
 if(permittedPlay&&actionMode==='reject')return response({error:'Action refusée dans la recette locale. Aucun changement enregistré.'},409);
 if(permittedPlay&&(actionMode==='pending'||careMutationMode==='pending'&&path.endsWith('/care')))await new Promise(done=>deferred.push(done));
 if(method==='GET'&&path.endsWith('/care')&&careMode==='error')return response({error:'Tarif de soin temporairement indisponible.'},503);
 if(method==='GET'&&path.endsWith('/care')&&careMode==='pending')await new Promise(done=>deferred.push(done));
 if(${cultureBadgesOnly}&&method==='GET'&&path.endsWith('/care')&&['pending-first','malformed','no-price'].includes(careMode)){
  const mode=careMode;if(mode==='pending-first')careMode='known';
  const payload=await(await transport(input,init)).json();
  if(mode==='pending-first')await new Promise(done=>deferred.push(done));
  if(mode==='malformed')delete payload.inventory;if(mode==='no-price')delete payload.basicCarePriceCents;
  return response(payload);
 }
 if(path.endsWith('/work')&&method==='GET'){
  const game=production.game;if(!game)return response({error:'Culture absente'},404);
  const day=projectKqStaffSnapshot(staffRaw).calendar.day,used=staffRaw.state.playerWorkDays[String(day)]?.usedHours??0;
  const runId=game.campaign.leaderRunId,paid=cultureWorkSteps.has(runId+':'+game.stageIndex);
  return response({version:1,runId,stageIndex:game.stageIndex,day,phase:game.phase,source:!paid&&used>11.5?'blocked':'player',paid,stepHours:.5,playerRemainingHours:12-used,employee:null,bonus:{vitality:0,terpenes:0,yieldPercent:0,cannabinoids:0},reason:null});
 }
 if(path.endsWith('/staff')){
  if(staffMode==='pending')await new Promise(done=>deferred.push(done));
  if(staffMode==='error')return response({error:'Personnel temporairement indisponible.'},503);
  return response(projectKqStaffSnapshot(staffRaw));
 }
 if(path.endsWith('/storage')){
  if(storageDelay==='pending')await new Promise(done=>deferred.push(done));else if(storageDelay)await new Promise(done=>setTimeout(done,storageDelay));
  if(storageMode==='error')return response({error:'Stockage temporairement indisponible.'},503);
  if(storageMode==='malformed')return response({serverNow:baseStorage.serverNow,lots:null});
  const snapshot=storageSnapshot();return response(storageMode==='missing'?{...snapshot,lots:snapshot.lots.filter(lot=>lot.flowerId!==targetId)}:snapshot);
 }
 if(path.endsWith('/equipment'))return response({...getKqOperationsEquipment(lesson),...(workdayScenario?{activeRun:false,readyLotCount:0,availableFlowerCount:0,curingFlowerCount:0,trimFlowerCount:0}:{}),...(workshopScenario?{cashCents:production.cashCents}:{}),routePlan:null,strength:null});
 if(workdayScenario&&path.endsWith('/commerce'))return response({});
 if(path.endsWith('/contracts'))return response({error:'Contrats hors périmètre de cette recette.'},404);
 if((${financialSupportOnly}||${guideOnly})&&path.endsWith('/commerce'))return response({error:'Finances hors périmètre de cette recette.'},503);
 if(path.endsWith('/bootstrap')){
  if(collectionMode==='pending')await new Promise(done=>deferred.push(done));
  if(collectionMode==='error')return response({error:'Collection temporairement indisponible.'},503);
  const payload=await(await transport(input,init)).json();
  if(payload.playerSession)projectSoloSession(payload.playerSession);
  if(heritageMode==='empty')payload.heritage.cards=[];
  return response(payload);
 }
 if(path.endsWith('/warehouse')){
  const received=await transport(input,init),payload=await received.json();
  return response(storageScenario?{...payload,stockGrams:lots.reduce((sum,lot)=>sum+lot.harvestGrams,0),storageReservedGrams:0}:payload,received.status);
 }
 if(path.endsWith('/flowers')&&storageScenario)return response({flowers:[]});
 if(path==='/api/account/collection')return response({pages:[{slots:[]}]});
 if(path.endsWith('/boosters'))return response({collectionActive:true,costPerPack:100,spendablePoints:0,availableEntitlements:[],welcomeClaimed:false});
 if(path.endsWith('/missions'))return ${guideCompletionOnly}?response({collectionActive:true,missions:[]}):response({error:'Aucune mission utilisée par cette recette.'},503);
 const workKey=production.game?production.game.campaign.leaderRunId+':'+production.game.stageIndex:null;
 const received=await transport(input,init);
 if(${cultureBadgesOnly}&&permittedPlay&&path.endsWith('/care')&&careMutationMode==='lost'&&received.ok){careMutationMode='known';throw Error('Réponse de soin interrompue après validation locale.');}
 if(scenario==='culture-carousel-solo'&&method==='GET'&&(/\\/(session|runs)$/.test(path)))return response(projectSoloSession(await received.json()),received.status);
 if(permittedPlay&&received.ok&&body?.action==='roll'&&workKey&&!cultureWorkSteps.has(workKey)){cultureWorkSteps.add(workKey);const day=projectKqStaffSnapshot(staffRaw).calendar.day;const used=staffRaw.state.playerWorkDays[String(day)]?.usedHours??0;staffRaw.state.playerWorkDays[String(day)]={usedHours:used+.5}}
 if(!received.ok)window.__unexpected.push({path,method,status:received.status});return received;
};
const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>new URL(typeof input==='string'?input:input.url,location.origin).pathname.startsWith('/api/')?request(input,init):originalFetch(input,init);
const api=createKqTutorialApi(request,{nativeWarehouse:true});api.isTutorial=false;
window.__fixture=()=>structuredClone({scenario,initial,production,lots,storageMode,collectionMode,heritageMode,staffRaw});
window.__control={allowPlay:value=>allowPlay=value,storageLot:(id,patch)=>Object.assign(lots.find(lot=>lot.flowerId===id).projection,patch),storage:mode=>storageMode=mode,storageDelay:value=>storageDelay=value,collection:mode=>collectionMode=mode,heritage:mode=>heritageMode=mode,staff:mode=>staffMode=mode,removeCopies:code=>{production.supportInventory[code]=0},launch:()=>act({type:'launch'}),resolve:()=>{storageDelay=0;collectionMode='known';if(staffMode==='pending')staffMode='known';deferred.splice(0).forEach(done=>done())},notify:name=>api.notify(name)};
window.__control.workHours=remaining=>{const day=projectKqStaffSnapshot(staffRaw).calendar.day;staffRaw.state.playerWorkDays[String(day)]={usedHours:12-remaining};api.notify('kq:staff-updated')};
window.__control.actionMode=value=>actionMode=value;window.__control.careMode=value=>careMode=value;
window.__control.careMutationMode=value=>careMutationMode=value;
window.__control.nextWorkday=()=>{staffRaw.serverNow=projectKqStaffSnapshot(staffRaw).calendar.nextDayAt;api.notify('kq:staff-updated')};
window.__control.trim=(id,stage)=>{
 const lot=staffRaw.context.trimLots.find(lot=>lot.flowerId===id);
 staffRaw.state.tasks=[];
 if(stage==='absent')staffRaw.context.trimLots=staffRaw.context.trimLots.filter(lot=>lot.flowerId!==id);
 else if(lot){lot.completedAt=stage==='complete'?staffRaw.serverNow:null;lot.completedWork=stage==='complete'?lot.requiredWork:stage==='partial'?2:0;
  lot.completedGrams=lot.completedWork/lot.requiredWork*lot.totalGrams;
  if(${sharedTrimOnly}){if(stage==='queued'||stage==='running')staffRaw.state.tasks=[{id:'fixture-shared-trim',employeeId:'player',kind:'trim',skill:'processing',hours:1,startedAt:new Date(Date.parse(staffRaw.serverNow)+(stage==='queued'?300000:-300000)).toISOString(),completesAt:new Date(Date.parse(staffRaw.serverNow)+600000).toISOString(),day:1,status:'running',trainingCostCents:0,skillLevel:1,trimMode:'manual',trimQueue:true,trimRateGramsPerHour:60,trimProgressAt:staffRaw.serverNow,trimGrams:stage==='running'?30:0,trimContributions:stage==='running'?[{flowerId:id,grams:30}]:[],trimQualityDelta:1}];api.notify('kq:staff-updated');return}
  if(stage==='queued'||stage==='running')staffRaw.state.tasks=[{id:'fixture-trim-task',employeeId:'player',kind:'trim',skill:'processing',hours:1,startedAt:new Date(Date.parse(staffRaw.serverNow)+(stage==='queued'?1800000:0)).toISOString(),completesAt:new Date(Date.parse(staffRaw.serverNow)+3600000).toISOString(),day:1,status:'running',targetId:id,trainingCostCents:0,skillLevel:1,trimMode:'manual',trimWork:1,trimQualityDelta:1}];
 }api.notify('kq:staff-updated');
};
if(${financialSupportOnly})api.isTutorial=scenario==='financial-support-tutorial';
const fixtureRoot=createRoot(document.getElementById('root'));
const renderFixture=ownerId=>fixtureRoot.render(<KqTutorialApiProvider api={api}><aside className="fixture-tools"><strong>Démo locale · retrouver sa préparation et sa récolte</strong><p>Choix, plan et lots fictifs en mémoire. Aucun compte réel.</p><label>Parcours <select value={scenario} onChange={event=>location.href='/?scenario='+event.target.value}>{['preparation','storage','storage-overflow'].map(value=><option key={value}>{value}</option>)}</select></label></aside><PlacardPlayerShell draftOwnerId={ownerId}/></KqTutorialApiProvider>);
window.__control.owner=renderFixture;renderFixture('journey-local-fixture');
`;
const modules = {
  entry,
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
  '@/context/CartContext': `export const useCart=()=>({user:{id:'00000000-0000-4000-8000-000000000099'},isAuthenticated:true,authLoading:false,refreshSession:async()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}.fixture-tools{padding:12px 18px;font:12px Body;background:#182b24;color:#fff1d6}.fixture-tools p{margin:5px 0}.fixture-tools select{max-width:100%;margin-left:8px;color:#182b24}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  define: { 'process.env.NEXT_PUBLIC_KQ_FINANCIAL_SUPPORT_URL': '""' },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', '@3d-dice/dice-box-threejs'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'journey-continuity-audit', enforce: 'pre', resolveId(id) { if (/\/src\/context\/CartContext(?:\.tsx)?$/.test(id.replaceAll('\\', '/'))) return '\0@/context/CartContext'; if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets'; if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('Real API disabled'); return; } if (!['/', '/arene/placard'].includes(req.url?.split('?')[0])) return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Préparation et stockage · démo locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [];
let browser, page;
await mkdir(output, { recursive: true }); await server.listen();
if (preview) {
  console.log(`Local journey continuity demo: ${origin} (PID ${process.pid}). In-memory data only.`);
  await new Promise(resolveStop => { const stop = () => { void server.close().then(resolveStop); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); });
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => { const url = new URL(request.url()); if (['data:', 'blob:'].includes(url.protocol)) return void request.continue(); if (url.origin !== origin || url.pathname.startsWith('/api/')) { forbiddenRequests.push(request.url()); return void request.abort(); } void request.continue(); });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const keyClick = async selector => { await page.waitForSelector(selector, { visible: true }); await page.focus(selector); await page.keyboard.press('Enter'); };
  async function button(label, scope = 'body') { const match = await page.waitForFunction((label, scope) => [...document.querySelectorAll(scope + ' button')].find(node => node.textContent.trim() === label && !node.disabled && node.getClientRects().length), {}, label, scope); await match.asElement().focus(); await page.keyboard.press('Enter'); await match.dispose(); }
  const fixture = () => page.evaluate(() => window.__fixture());
  const rememberedDeck = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('lcb:culture-preparation:v1:journey-local-fixture')).deckCodes.sort());
  const mutations = () => page.evaluate(() => window.__calls.filter(call => call.method !== 'GET'));
  async function load(scenario, width = 390, query = '') {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
    await page.setViewport({ width, height: width === 320 ? 720 : width === 390 ? 844 : 1000 });
    await page.goto(`${origin}${guideOnly ? '/arene/placard' : '/'}?scenario=${scenario}${query ? '&' + query : ''}`, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
  }
  async function layout() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow'); }
  const settled = () => page.waitForFunction(() => !document.querySelector('[data-placard-view] > [role="status"]'));
  async function screenshot(name) { await settled(); await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: false }); }
  async function visibleBelowHeader(selector) {
    await settled();
    const position = await page.$eval(selector, node => ({ top: node.getBoundingClientRect().top, headerBottom: document.querySelector('#placard-content > header').getBoundingClientRect().bottom }));
    assert(position.top >= position.headerBottom + 8, `Focused target must clear sticky header: ${JSON.stringify(position)}`);
  }
  const cards = '[data-setup-choice="cards"]', heritage = '[data-setup-choice="heritage"]';
  async function openChoice(selector) { if (!await page.$eval(selector, node => node.open)) await keyClick(selector + ' > summary'); }
  const deck = () => page.$eval('[data-preparation-deck]', node => node.dataset.preparationDeck.split(',').filter(Boolean).sort());
  async function prepare({ empty = false, noHeritage = false } = {}) {
    await page.waitForSelector('[data-culture-preparation]'); await openChoice(cards);
    await button('Retirer les cartes', cards);
    if (!empty) for (const code of ['BOTTE-005', 'BOTTE-005', 'BOTTE-024', 'BOTTE-003']) await keyClick(`${cards} [data-card-code="${code}"] button[aria-label^="Ajouter"]`);
    const selected = await deck(); await keyClick(`${cards} [data-culture-keep-choice]`);
    await openChoice(heritage);
    if (noHeritage) await button('Sans Héritage', heritage);
    else await keyClick(`${heritage} button[aria-label^="Équiper"]:not([disabled])`);
    const heritageText = await page.$eval(heritage + ' > summary strong', node => node.textContent);
    await keyClick(`${heritage} [data-culture-keep-choice]`);
    return { selected, heritageText };
  }
  async function openPlan() {
    await keyClick('[data-preparation-edit-plan]'); await page.waitForSelector('[data-warehouse-v4]', { visible: true });
    await page.waitForSelector('[data-warehouse-map]'); assert.equal(new URL(page.url()).searchParams.get('from'), 'game');
    assert.equal((await mutations()).length, 0, 'Opening the plan does not launch a culture or buy equipment');
  }
  async function assertPreparation(expected, campaign = true) {
    await page.waitForSelector('[data-culture-preparation]', { visible: true });
    if (campaign) assert.equal(new URL(page.url()).searchParams.get('campaign'), '1');
    assert.equal(await page.$eval(heritage + ' > summary strong', node => node.textContent), expected.heritageText);
    await openChoice(cards); assert.deepEqual(await deck(), expected.selected);
    assert.equal((await fixture()).production.game, null); assert.equal((await mutations()).length, 0);
    await layout();
  }
  if (cultureBadgesOnly) {
    const runQuery = 'view=game&run=61000000-0000-4000-8000-000000000001';
    const cardTab = '[data-culture-tab="cards"]', careTab = '[data-culture-tab="care"]';
    const intervention = '[data-care-section="intervention"]', products = '[data-care-reserve-toggle]';
    async function expectCount(scope, count) {
      await page.waitForFunction((scope, count) => {
        const node = document.querySelector(scope)?.querySelector('[data-action-count]');
        return count > 0 ? node?.getAttribute('data-action-count') === String(count) && node.querySelector('[aria-hidden="true"]')?.textContent.trim() === String(count) : !node;
      }, {}, scope, count);
    }
    async function panel(id) {
      await keyClick(`[data-culture-tab="${id}"]`);
      await page.waitForSelector(`[data-culture-panel="${id}"]:not([hidden])`, { visible: true });
    }
    async function loadBadges(badgeCase = 'base', width = 390, query = '') {
      await load('culture-carousel', width, `${runQuery}&badgeCase=${badgeCase}${query ? '&' + query : ''}`);
      await page.waitForSelector('[data-culture-carousel]');
    }
    async function openCare() {
      await panel('care'); await keyClick(intervention);
      await page.waitForSelector('[data-care-basic]');
    }
    async function openProducts() {
      if (!await page.$eval(products, node => node.getAttribute('aria-expanded') === 'true')) await keyClick(products);
      await page.waitForSelector('[data-care-reserve-status="ready"]', { visible: true });
    }
    const gameSnapshot = () => page.evaluate(() => {
      const { milestones, ...production } = window.__fixture().production;
      return JSON.stringify(production);
    });
    const guideSnapshot = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /farm-guide|farm-progress/.test(key)).map(key => [key, localStorage.getItem(key)])));
    for (const width of [320, 390, 1440]) {
      await loadBadges('base', width);
      await expectCount(cardTab, 2); await expectCount(careTab, 4);
      assert.equal(await page.$('img[src*="culture-desk"]'), null, 'The wide Culture illustration is no longer mounted');
      assert.equal(await page.$$eval('[data-culture-tab] img', nodes => nodes.length), 6, 'Each tab retains its own illustration');
      assert.equal((await fixture()).production.milestones.includes('health-read'), false, 'Availability preload does not mark health as read');
      assert.deepEqual((await fixture()).production, (await fixture()).initial, 'The first badge read preserves the entire game and lesson milestones');
      const before = await gameSnapshot(), guideBefore = await guideSnapshot();
      const badgeGeometry = await page.$$eval('[data-culture-tab] [data-action-count]', nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
        return { width: rect.width, height: rect.height, text: node.textContent, title: node.getAttribute('title'), ariaLabel: node.getAttribute('aria-label'), color: css.color, background: css.backgroundColor, border: css.borderColor };
      }));
      assert(badgeGeometry.every(item => item.width <= 40 && item.height <= 32), 'Action counts remain small badges');
      assert(badgeGeometry.every(item => /[1-9].*(action|carte|soin)/.test(item.title)), 'A written accessible meaning accompanies every count');
      await panel('cards'); await expectCount(cardTab, 2);
      assert.equal(await page.$eval('[data-hand-filter="playable"] b', node => Number(node.textContent)), 2, 'Badge counts distinct playable choices, not 16 stock copies or duplicate cards');
      await panel('play'); await page.focus('[data-culture-tab="play"]'); await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-culture-tab') === 'care');
      await keyClick(intervention); await expectCount(intervention, 4); await expectCount(products, 3);
      await openProducts();
      await expectCount('[data-care-rayon="input"]', 2);
      await expectCount('[data-care-rayon="pbi"]', 1);
      await expectCount('[data-care-rayon="context"]', 2);
      await page.focus(intervention); await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-care-section') === 'overview');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-care-section') === 'intervention');
      await panel('cards'); await panel('care');
      assert.equal(await page.$eval(products, node => node.getAttribute('aria-expanded')), 'true', 'Badge navigation preserves the open reserve');
      assert.equal(await gameSnapshot(), before, 'Navigation never spends cash, XP, stock or hours');
      assert.deepEqual(await guideSnapshot(), guideBefore, 'Badges and navigation do not auto-complete the tutorial');
      assert.equal((await mutations()).length, 0);
      await layout(); await screenshot(`culture-badges-care-${width}`);
      await panel('play'); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await screenshot(`culture-badges-play-${width}`);
      results.push({ width, distinctPlayableChoices: 2, usableProductTypes: 3, affordableMaintenance: 1, smallBadges: badgeGeometry, noHero: true, sixTabIllustrations: true, keyboard: true, noOverflow: true, noNavigationMutationsOrGuideCompletion: true });
    }
    for (const [name, expected] of [['xp-zero', 0], ['stock-zero', 0], ['rolled', 2], ['resolved', 0]]) {
      await loadBadges(name); await expectCount(careTab, 4); await expectCount(cardTab, expected);
      await panel('cards');
      assert.equal(await page.$eval('[data-hand-filter="playable"] b', node => Number(node.textContent)), expected);
      assert.equal((await mutations()).length, 0);
      results.push({ case: name, playableChoices: expected, cardRulesAndStockHonored: true });
    }
    for (const [name, total, usable] of [['zero', 0, 0], ['poor-care', 3, 3], ['used-input', 2, 1], ['late', 3, 2], ['finished-care', 0, 0]]) {
      await loadBadges(name); await expectCount(cardTab, name === 'finished-care' ? 0 : name === 'late' ? 1 : 2);
      await openCare();
      if (name !== 'finished-care') await page.waitForSelector('[data-care-cash][data-cash-cents]');
      await expectCount(careTab, total); await expectCount(intervention, total); await expectCount(products, usable);
      assert.equal((await mutations()).length, 0);
      results.push({ case: name, careChoices: total, usableProductTypes: usable, unavailableChoicesExcluded: true });
    }
    for (const mode of ['pending', 'error', 'malformed']) {
      await loadBadges('base', 390, `careMode=${mode}`);
      await expectCount(cardTab, 2); await expectCount(careTab, null);
      assert.equal(await page.$(`${careTab} [data-action-count="0"]`), null, 'Unknown care availability is never presented as zero');
      await openCare(); await expectCount(intervention, null); await expectCount(products, null);
      await page.evaluate(() => { window.__control.careMode('known'); window.__control.resolve(); });
      await keyClick('[data-culture-care] button[aria-label="Actualiser la trésorerie"]');
      await expectCount(careTab, 4); await expectCount(products, 3);
      assert.equal((await mutations()).length, 0);
      results.push({ case: mode, unknownHasNoFalseZeroOrGreen: true, readOnlyRecovery: true });
    }
    await loadBadges('base', 390, 'careMode=no-price'); await expectCount(careTab, 3);
    await openCare(); await expectCount(products, 3); await expectCount(intervention, 3);
    assert.equal(await page.$eval('[data-care-basic]', node => node.disabled), true, 'Missing server maintenance quote excludes only that action');
    assert.equal((await mutations()).length, 0);
    results.push({ missingMaintenanceQuote: true, verifiedProductsStillCounted: 3, noInventedPrice: true });

    await loadBadges('base'); await openCare(); await openProducts();
    await keyClick('[data-care-rayon="input"]');
    await page.evaluate(() => { window.__control.allowPlay(true); window.__control.careMutationMode('pending'); });
    await keyClick('[data-care-product="CARE-VERMICOMPOST"] [data-care-product-buy]');
    await page.waitForFunction(() => window.__calls.some(call => call.method === 'POST' && call.path.endsWith('/care')));
    await expectCount(careTab, null); await expectCount(cardTab, null); await expectCount(products, null);
    await page.evaluate(() => { window.__control.careMutationMode('known'); window.__control.resolve(); });
    await expectCount(careTab, 5); await expectCount(products, 4); await expectCount('[data-care-rayon="input"]', 3);
    assert.equal((await fixture()).production.careAreaInventory['CARE-VERMICOMPOST'] > 0, true, 'Explicit purchase records one complete surface passage');
    await keyClick('[data-care-product="CARE-VERMICOMPOST"] [data-care-product-use]');
    await expectCount(careTab, 2); await expectCount(products, 1); await expectCount('[data-care-rayon="input"]', 0);
    assert.equal((await fixture()).production.game.care.applications.some(item => item.productCode === 'CARE-VERMICOMPOST'), true);
    assert.equal((await mutations()).length, 2, 'Only the requested local purchase and use were submitted');
    results.push({ explicitPurchaseRefreshesCounts: true, useExcludesOtherInputsForThisStage: true, busyHasNoGreen: true, mutationCount: 2 });

    await loadBadges('base'); await openCare(); await expectCount(careTab, 4);
    await page.evaluate(() => { window.__control.allowPlay(true); window.__control.careMutationMode('lost'); });
    await keyClick('[data-care-basic]');
    await page.waitForFunction(() => document.querySelector('[data-care-basic]')?.textContent.includes('Vérifier'));
    await expectCount(careTab, null); await expectCount(products, null);
    const lost = await fixture();
    await keyClick('[data-care-basic]'); await expectCount(careTab, 3); await expectCount(products, 3);
    assert.equal((await fixture()).production.cashCents, lost.production.cashCents, 'Recovery reuses the receipt without a second debit');
    const recoverWrites = await mutations();
    assert.equal(recoverWrites.length, 2); assert.equal(recoverWrites[0].body.requestKey, recoverWrites[1].body.requestKey);
    results.push({ unresolvedCareReceiptHasNoGreen: true, recoveryRefreshesCounts: true, sameKeyNoSecondDebit: true });

    await loadBadges('base'); await expectCount(cardTab, 2); await panel('cards');
    await keyClick('[data-action-card="BOTTE-005"]');
    await page.waitForSelector('[data-card-choice]', { visible: true });
    await expectCount(cardTab, null); await expectCount(careTab, null);
    await page.evaluate(() => { window.__control.allowPlay(true); window.__control.actionMode('pending'); });
    await keyClick('[data-culture-confirm-card]');
    await page.waitForFunction(() => window.__calls.some(call => call.method === 'POST' && call.path.endsWith('/cards')));
    await expectCount(cardTab, null); await expectCount(careTab, null);
    await page.evaluate(() => { window.__control.actionMode('known'); window.__control.resolve(); });
    await page.waitForSelector('[data-card-choice]', { hidden: true });
    await expectCount(cardTab, 0); await expectCount(careTab, 4);
    assert.equal((await fixture()).production.supportInventory['BOTTE-005'], 8, 'One explicit card play consumes exactly one copy');
    assert.equal((await mutations()).length, 1);
    results.push({ cardConfirmationAndBusyHideCounts: true, playedPreparationClearsPlayableBadge: true, oneCopyConsumed: true });

    await loadBadges('stage-transition', 390, 'careMode=pending-first');
    await expectCount(careTab, null);
    await page.evaluate(() => window.__control.allowPlay(true));
    await keyClick('[data-culture-primary-action]');
    await page.waitForSelector('[data-culture-play][data-culture-phase="resolved"]');
    await expectCount(careTab, 3);
    await page.evaluate(() => window.__control.resolve());
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await expectCount(careTab, 3);
    assert.equal((await mutations()).length, 1);
    results.push({ stageTransitionExcludesLatePbi: true, latePreviousQuoteCannotRestoreOldCount: true });
  } else if (cultureQualityOnly) {
    const runQuery = 'view=game&run=61000000-0000-4000-8000-000000000001';
    const qualityLink = '[data-care-quality-link]';
    const careTabs = () => page.$$eval('[data-care-section]', nodes => nodes.map(node => node.dataset.careSection));
    const snapshot = () => page.evaluate(() => {
      const { milestones, ...production } = window.__fixture().production;
      // The local lesson records the first health read; it is not a game action.
      return JSON.stringify(production);
    });
    async function panel(id) {
      await keyClick(`[data-culture-tab="${id}"]`);
      await page.waitForSelector(`[data-culture-panel="${id}"]:not([hidden])`, { visible: true });
    }
    async function openQuality(key) {
      await page.focus(qualityLink); await page.keyboard.press(key);
      await page.waitForSelector('[data-culture-panel="harvest"]:not([hidden])', { visible: true });
      await page.waitForFunction(() => document.activeElement?.dataset.cultureTab === 'harvest' || document.activeElement?.dataset.culturePanel === 'harvest');
      assert(await page.evaluate(() => document.activeElement.checkVisibility() && !document.activeElement.closest('[inert]')), 'Quality navigation moves focus out of the hidden care panel');
      assert.match(await page.$eval('[data-culture-panel="harvest"]', node => node.textContent), /CBD|CBG|THC/, 'The destination includes actual variety analyses');
      await layout();
    }
    for (const width of [320, 390, 1440]) {
      await load('culture-carousel', width, runQuery);
      await page.waitForSelector('[data-culture-carousel]');
      const before = await snapshot();
      await panel('care');
      assert.deepEqual(await careTabs(), ['overview', 'intervention'], 'Campaign care has no empty quality tab');
      assert.equal(await page.$eval(qualityLink, node => node.textContent.trim()), 'Qualité des variétés');
      assert.equal(await page.$eval(qualityLink, node => node.getAttribute('role')), null, 'The destination action is a button outside the care tablist');
      assert.equal(await page.$eval(qualityLink, node => !!node.closest('[role="tablist"]')), false);
      await page.focus('[data-care-section="overview"]'); await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.careSection), 'intervention', 'Keyboard care navigation stops at the final real tab');
      await keyClick('[data-care-reserve-toggle]');
      await page.waitForSelector('[data-care-reserve-status="ready"]', { visible: true });
      await page.$eval(qualityLink, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await screenshot(`culture-quality-campaign-${width}`);
      await openQuality('Enter');
      await screenshot(`culture-quality-destination-${width}`);
      await panel('care');
      assert.equal(await page.$eval('[data-care-section="intervention"]', node => node.getAttribute('aria-selected')), 'true');
      assert.equal(await page.$eval('[data-care-reserve-toggle]', node => node.getAttribute('aria-expanded')), 'true', 'Returning to care preserves the open product reserve');
      await openQuality('Space'); await panel('care');
      assert.equal(await snapshot(), before, 'Reading quality preserves production, funds, care and inventory');
      assert.equal((await mutations()).length, 0);
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
      results.push({ width, campaignDirectQualityAction: true, noEmptyQualityTab: true, keyboardEnterAndSpace: true, visibleDestinationFocus: true, realAnalysisVisible: true, interventionAndReservePreserved: true, noMutations: true });

      await load('culture-carousel-complete', width, runQuery); await panel('care');
      const completeBefore = await snapshot();
      assert.deepEqual(await careTabs(), ['overview', 'intervention']);
      await openQuality('Enter');
      assert.match(await page.$eval('[data-culture-tab="harvest"]', node => node.textContent), /Récoltes/);
      assert.equal(await snapshot(), completeBefore); assert.equal((await mutations()).length, 0);
      results.push({ width, finalCampaignQualityDestination: true, noMutations: true });

      await load('culture-carousel-dead', width, runQuery); await panel('care');
      assert.deepEqual(await careTabs(), ['overview', 'intervention']);
      assert.equal(await page.$(qualityLink), null, 'A lost campaign has no quality destination');
      assert.equal(await page.$('[data-care-section="quality"]'), null);
      assert.equal((await mutations()).length, 0); await layout();
      results.push({ width, deadCampaignNoQualityLinkOrTab: true, noMutations: true });

      await load('culture-carousel-solo', width, runQuery); await panel('care');
      assert.deepEqual(await careTabs(), ['overview', 'intervention', 'quality'], 'Solo care retains its substantive quality tab');
      assert.equal(await page.$(qualityLink), null);
      await keyClick('[data-care-section="quality"]');
      const visibleQuality = await page.$eval('[data-care-section="quality"]', node => { const panel = document.getElementById(node.getAttribute('aria-controls')); return { visible: panel.checkVisibility(), text: panel.textContent }; });
      assert.equal(visibleQuality.visible, true); assert.match(visibleQuality.text, /Qualité en développement/); assert.match(visibleQuality.text, /CBD|CBG|THC/);
      assert.equal((await mutations()).length, 0); await layout(); await screenshot(`culture-quality-solo-${width}`);
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
      results.push({ width, soloQualityAndAnalysisRetained: true, noMutations: true });
    }
  } else if (cultureCarouselOnly) {
    const ids = ['play', 'care', 'cards', 'harvest', 'journal', 'rules'];
    const tab = id => `[data-culture-tab="${id}"]`;
    const active = () => page.$eval('[data-culture-tab][aria-selected="true"]', node => node.dataset.cultureTab);
    async function panel(id) {
      await keyClick(tab(id));
      await page.waitForSelector(`[data-culture-panel="${id}"]:not([hidden])`, { visible: true });
    }
    async function assertPanels(id) {
      const measures = await page.evaluate(() => ({
        panels: [...document.querySelectorAll('[data-culture-panel]')].map(node => ({ id: node.dataset.culturePanel, hidden: node.hidden, inert: node.inert, visible: node.checkVisibility(), height: node.getBoundingClientRect().height })),
        tabs: [...document.querySelectorAll('[data-culture-tab]')].map(node => ({ id: node.dataset.cultureTab, role: node.getAttribute('role'), selected: node.getAttribute('aria-selected'), target: document.getElementById(node.getAttribute('aria-controls'))?.dataset.culturePanel })),
        pageHeight: document.documentElement.scrollHeight,
      }));
      assert.deepEqual(measures.panels.map(item => item.id), ids, 'All Culture sections remain mounted');
      assert.deepEqual(measures.panels.filter(item => item.visible).map(item => item.id), [id], 'Only the selected panel occupies the page');
      assert(measures.panels.filter(item => item.id !== id).every(item => item.hidden && item.inert && item.height === 0), 'Inactive panels have no layout gap and cannot receive focus');
      assert(measures.tabs.every(item => item.role === 'tab' && item.target === item.id && item.selected === String(item.id === id)), 'Tabs expose their selected panel to assistive technology');
      assert(await page.$eval('[data-culture-primary-action]', node => node.checkVisibility()), 'The next game action remains visible from every panel');
      assert(await page.$eval('[data-culture-work-status]', node => node.checkVisibility()), 'Authoritative work cost remains available from every panel');
      await layout();
      return measures;
    }
    const gameSnapshot = () => page.evaluate(() => { const value = window.__fixture().production; return JSON.stringify({ game: value.game, cashCents: value.cashCents, inventory: value.supportInventory, careInventory: value.careInventory }); });
    for (const [width, height] of cultureCarouselVisualOnly ? [[320, 568], [390, 844]] : [[320, 568], [390, 844], [768, 1000], [1440, 1000]]) {
      await load('culture-carousel', width, 'view=game&run=61000000-0000-4000-8000-000000000001');
      await page.setViewport({ width, height, hasTouch: width < 768 });
      await page.waitForSelector('[data-culture-carousel]');
      await page.waitForSelector('[data-culture-primary-action]:not([disabled])');
      if (cultureCarouselVisualOnly) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await screenshot(`culture-carousel-initial-${width}x${height}`);
      }
      const initialGame = await gameSnapshot();
      const heights = {};
      for (const id of cultureCarouselVisualOnly ? ['play'] : ids) {
        await panel(id); heights[id] = (await assertPanels(id)).pageHeight;
        await screenshot(`culture-carousel-${id}-${width}x${height}`);
        if (id === 'play') {
          await page.$eval('[data-culture-decision]', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await screenshot(`culture-carousel-dice-${width}x${height}`);
        }
      }
      assert.equal((await mutations()).length, 0, 'Reading all six panels never submits an action');
      assert.equal(await gameSnapshot(), initialGame, 'Navigation preserves the complete game, cash and inventories');
      results.push({ width, height, sixAccessiblePanels: true, inactivePanelsHaveNoHeightOrFocus: true, pageHeights: heights, navigationHasNoMutations: true });
      if (cultureCarouselVisualOnly) continue;

      await panel('play'); await page.focus(tab('play')); await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('[data-culture-tab="care"]')?.getAttribute('aria-selected') === 'true');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.cultureTab), 'care', 'Arrow navigation moves keyboard focus with selection');
      await page.keyboard.press('End'); assert.equal(await active(), 'rules');
      await page.keyboard.press('Home'); assert.equal(await active(), 'play');
      await keyClick('[data-culture-carousel-next]'); assert.equal(await active(), 'care');
      await keyClick('[data-culture-carousel-prev]'); assert.equal(await active(), 'play');
      assert.equal((await mutations()).length, 0);
      results.push({ width, keyboardArrowsHomeEnd: true, previousNext: true });
      if (width < 768) {
        const client = await page.createCDPSession();
        async function swipe(selector, dx, dy = 0) {
          await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
          const point = await page.$eval(selector, node => { const box = node.getBoundingClientRect(); return { x: box.left + box.width * .75, y: box.top + Math.min(35, box.height / 2) }; });
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
          for (let step = 1; step <= 5; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + dx * step / 5, y: point.y + dy * step / 5, id: 1 }] });
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
        await swipe('[data-culture-carousel] > div:first-child > :first-child', -100);
        await page.waitForFunction(() => document.querySelector('[data-culture-tab="care"]')?.getAttribute('aria-selected') === 'true');
        await swipe('[data-culture-carousel] > div:first-child > :first-child', -10, -80);
        assert.equal(await active(), 'care', 'Vertical scrolling never changes panels');
        await client.detach();
        assert.equal((await mutations()).length, 0);
        results.push({ width, touchSwipe: true, verticalScrollDoesNotNavigate: true });
      }

      await panel('cards');
      await keyClick('[data-hand-filter="all"]');
      const cardTrigger = '[data-culture-panel="cards"] [data-action-card]';
      await keyClick(cardTrigger);
      await page.waitForSelector('[data-card-choice]', { visible: true });
      assert.match(await page.$eval('[data-culture-card-cost]', node => node.textContent), /XP de culture.*1 copie détruite.*Disponibles/s);
      assert.equal(await page.$eval('[data-culture-actionbar]', node => node.hasAttribute('data-suspended')), true);
      await page.keyboard.press('Escape'); await page.waitForSelector('[data-card-choice]', { hidden: true });
      assert(await page.evaluate(() => document.activeElement?.checkVisibility() && !!document.activeElement?.closest('[data-culture-panel="cards"]')), 'Closing a card restores visible focus within its panel');
      await panel('journal'); await panel('cards');
      assert.equal(await page.$eval('[data-hand-filter="all"]', node => node.getAttribute('aria-pressed')), 'true', 'The selected card filter survives panel changes');
      await panel('care');
      await keyClick('[data-care-section="intervention"]');
      await page.waitForSelector('[data-care-cash][data-cash-cents]', { visible: true });
      const expectedCarePrice = await page.evaluate(() => (window.__fixture().production.game.campaign.members.reduce((sum, member) => sum + member.warehouse.activeAreaM2, 0) * 5).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
      assert((await page.$eval('[data-care-basic]', node => node.textContent)).includes(expectedCarePrice), 'The server-priced surface amount remains visible before paying');
      assert.match(await page.$eval('[data-care-cash]', node => node.textContent), /Trésorerie.*€/);
      await keyClick('[data-care-reserve-toggle]');
      await page.waitForSelector('[data-care-reserve-status="ready"]', { visible: true });
      await panel('journal'); await panel('care');
      assert.equal(await page.$eval('[data-care-section="intervention"]', node => node.getAttribute('aria-selected')), 'true', 'The selected care section survives panel changes');
      assert.equal(await page.$eval('[data-care-reserve-toggle]', node => node.getAttribute('aria-expanded')), 'true', 'Product reserve remains open on return');
      await panel('harvest');
      assert.match(await page.$eval('[data-culture-panel="harvest"]', node => node.textContent), /estim|projection|projet/i, 'Future yield keeps an explicit estimate label');
      assert.equal((await mutations()).length, 0, 'Card inspection, care consultation and projections never spend anything');
      assert.equal(await gameSnapshot(), initialGame);
      results.push({ width, cardCostAndCancelFocus: true, cardFilterRetained: true, careCashAndPriceVisible: true, careDisclosureAndReserveRetained: true, estimatesLabelled: true });

      await panel('play');
      for (const remaining of [11.55, .55, .49]) {
        await page.evaluate(remaining => window.__control.workHours(remaining), remaining);
        await page.waitForFunction(remaining => document.querySelector('[data-culture-work-status]')?.textContent.includes(remaining.toLocaleString('fr-FR') + ' h'), {}, remaining);
        assert.equal(await page.$eval('[data-culture-primary-action]', node => node.disabled), remaining < .5, 'Fractional balances preserve authoritative roll permission');
      }
      await page.evaluate(() => window.__control.workHours(11.55));
      await page.waitForSelector('[data-culture-primary-action]:not([disabled])');
      results.push({ width, fractionalHoursAccepted: true, insufficientHoursStillBlock: true, noDebitDuringNavigation: (await mutations()).length === 0 });
    }

    if (!cultureCarouselVisualOnly) {
    await panel('care'); await keyClick('[data-care-section="intervention"]');
    await page.evaluate(() => window.__control.careMode('error'));
    await keyClick('[data-culture-care] button[aria-label="Actualiser la trésorerie"]');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-culture-care] [role="status"]')].some(node => node.checkVisibility() && node.textContent.includes('Tarif de soin temporairement indisponible')));
    assert(await page.$eval('[data-care-basic]', node => node.disabled), 'Unavailable authoritative care price prevents payment');
    await panel('journal'); await panel('care');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-culture-care] [role="status"]')].some(node => node.checkVisibility() && node.textContent.includes('Tarif de soin temporairement indisponible')));
    await page.evaluate(() => window.__control.careMode('known'));
    await keyClick('[data-culture-care] button[aria-label="Actualiser la trésorerie"]');
    await page.waitForSelector('[data-care-basic]:not([disabled])');
    assert.equal((await mutations()).length, 0, 'Care error recovery only reads the server');
    results.push({ unavailableCarePriceBlocksPayment: true, careErrorRetainedAcrossPanelChanges: true, exactServerPriceVisible: true });
    await panel('rules');
    const beforeAction = await gameSnapshot();
    await page.evaluate(() => { window.__control.allowPlay(true); window.__control.actionMode('reject'); });
    await keyClick('[data-culture-primary-action]');
    assert.equal(await active(), 'play', 'The primary action returns to the dice before offering a game action');
    assert.equal((await mutations()).length, 0, 'Returning to the dice from a secondary panel never rolls');
    await keyClick('[data-culture-primary-action]');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some(node => node.checkVisibility() && node.textContent.includes('Action refusée')));
    await panel('care');
    assert(await page.$$eval('[role="alert"]', nodes => nodes.some(node => node.checkVisibility() && node.textContent.includes('Action refusée'))), 'A game error stays visible when reading another panel');
    assert.equal(await gameSnapshot(), beforeAction, 'Rejected action leaves game and balances intact');
    await page.evaluate(() => window.__control.actionMode('known'));
    await keyClick('[data-culture-primary-action]');
    assert.equal((await mutations()).length, 1, 'Returning from care only reveals the dice');
    await keyClick('[data-culture-primary-action]');
    await page.waitForSelector('[data-culture-play][data-culture-phase="rolled"]');
    assert.equal(await active(), 'play', 'Rolling from a secondary panel reveals the dice result');
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-culture-decision'));
    await panel('cards'); await keyClick('[data-culture-primary-action]');
    assert.equal((await mutations()).length, 2, 'Returning from cards does not validate a hidden result');
    await keyClick('[data-culture-primary-action]');
    await page.waitForSelector('[data-culture-play][data-culture-phase="resolved"]');
    assert.equal(await active(), 'play', 'Validation reveals the result panel');
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-culture-result'));
    await panel('journal'); await keyClick('[data-culture-primary-action]');
    assert.equal((await mutations()).length, 3, 'Returning from journal does not advance a hidden result');
    await keyClick('[data-culture-primary-action]');
    await page.waitForSelector('[data-culture-play][data-culture-phase="prepare"][data-culture-stage="1"]');
    assert.equal(await active(), 'play', 'Advancing reveals the next situation');
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-culture-situation'));
    assert.equal(await page.$eval('[data-motion-phase]', node => node.dataset.motionPhase), 'idle', 'Reduced motion avoids a running dice animation');
    const writes = await mutations();
    assert.deepEqual(writes.map(call => call.body.action), ['roll', 'roll', 'resolve', 'advance'], 'Only explicit in-memory turn actions were submitted');
    results.push({ globalErrorSurvivesPanelNavigation: true, rejectedActionDoesNotMutate: true, stageTransitionsRevealAndFocusResults: true, reducedMotion: true, onlyFourExplicitLocalActionRequests: true });
    for (const width of [320, 1440]) {
      await load('culture-carousel-complete', width, 'view=game&run=61000000-0000-4000-8000-000000000001');
      await page.waitForSelector('[data-culture-phase="complete"] [data-culture-carousel]');
      const completeGame = await gameSnapshot();
      for (const id of ['harvest', 'journal', 'care', 'charges']) {
        await panel(id);
        assert.deepEqual(await page.$$eval('[data-culture-panel]', nodes => nodes.filter(node => node.checkVisibility()).map(node => node.dataset.culturePanel)), [id]);
        assert(await page.$$eval('[data-culture-panel][hidden]', nodes => nodes.every(node => node.inert && node.getBoundingClientRect().height === 0)));
        assert(await page.$eval('[data-harvest-moment]', node => node.checkVisibility()), 'The actual harvested total and storage action stay visible outside the carousel');
        await layout(); await screenshot(`culture-carousel-complete-${id}-${width}`);
      }
      await panel('journal');
      assert.equal(await page.$$eval('[data-culture-campaign-recap] [aria-label="Bulletin de la récolte"] ol > li', nodes => nodes.length), 6, 'The complete campaign retains all six results');
      assert.equal(await page.$('[data-culture-primary-action]'), null, 'The completed campaign never exposes a stale dice action');
      assert.equal(await gameSnapshot(), completeGame);
      assert.equal((await mutations()).length, 0, 'Reading the complete campaign never pays a charge or starts another run');
      results.push({ width, completedCampaignFourPanels: true, sixStageJournalRetained: true, noStaleDiceAction: true, completeNavigationHasNoMutations: true });
    }
    await load('culture-carousel-dead', 320, 'view=game&run=61000000-0000-4000-8000-000000000001');
    await page.waitForSelector('[data-culture-phase="complete"] [data-harvest-moment]');
    assert.match(await page.$eval('[data-harvest-moment]', node => node.textContent), /Aucune récolte/);
    assert.equal(await page.$('[data-harvest-moment] button'), null, 'A lost campaign offers no fictitious harvest to store');
    assert.equal(await page.$('[data-culture-primary-action]'), null, 'A lost campaign cannot roll again');
    await panel('care'); await layout(); await screenshot('culture-carousel-dead-320');
    assert.equal((await mutations()).length, 0);
    results.push({ width: 320, deadCampaignNoHarvestOrDiceAction: true, healthRecordAccessible: true, noMutations: true });
    }
  }
  if (cultureWorkOnly) {
    const roll = '[data-culture-primary-action][data-action="roll"]';
    for (const width of [320, 390, 1440]) {
      await load('preparation', width);
      await prepare({ empty: true, noHeritage: true });
      await page.evaluate(() => window.__control.allowPlay(true));
      await keyClick('[data-culture-start-review]');
      await keyClick('[data-culture-confirm-start]');
      await page.waitForSelector('[data-culture-play][data-guide-culture-started="true"]');
      assert.equal((await mutations()).length, 1, 'Only the explicit in-memory launch has written');
      for (const remaining of [11.95, 11.55, 0.55]) {
        await page.evaluate(remaining => window.__control.workHours(remaining), remaining);
        await page.waitForFunction(remaining => {
          const status = document.querySelector('[data-culture-work-status]');
          return status?.dataset.workSource === 'player' && status.textContent.includes(remaining.toLocaleString('fr-FR') + ' h') && !document.querySelector('[data-culture-primary-action][data-action="roll"]')?.disabled;
        }, {}, remaining);
        assert.equal((await mutations()).length, 1, 'Reading fractional available hours never rolls or debits');
      }
      await page.evaluate(() => window.__control.workHours(.49));
      await page.waitForSelector('[data-culture-work-status][data-work-source="blocked"]');
      assert(await page.$eval(roll, node => node.disabled), 'An authoritative insufficient-hours quote still blocks the roll');
      await page.evaluate(() => window.__control.workHours(11.55));
      await page.waitForFunction(() => document.querySelector('[data-culture-work-status]')?.textContent.includes('11,55 h') && !document.querySelector('[data-culture-primary-action][data-action="roll"]')?.disabled);
      await page.$eval(roll, node => node.scrollIntoView({ block: 'center' }));
      await layout(); await screenshot('culture-fractional-hours-' + width);
      await keyClick(roll);
      await page.waitForSelector('[data-culture-play][data-culture-phase="rolled"]');
      await page.waitForFunction(() => document.querySelector('[data-culture-work-status]')?.textContent.includes('11,05 h'));
      const writes = await mutations();
      assert.equal(writes.length, 2, 'Exactly one launch and one explicit roll');
      assert.equal(writes[1].body.action, 'roll');
      assert.equal(writes[1].body.expectedStageIndex, 0);
      assert(Math.abs((await fixture()).staffRaw.state.playerWorkDays['1'].usedHours - .95) < 1e-9, 'The existing half-hour stage cost stays unchanged');
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
      results.push({ width, fractionalBalances: [11.95, 11.55, .55], blockedBalance: .49, exactRollCost: .5, onlyExplicitInMemoryWrites: true });
    }
  }
  if (sharedTrimOnly) {
    const guideKey = 'kq:farm-guide:v1:journey-local-fixture';
    const completed = ['welcome', 'zone', 'buddies', 'cards', 'packs', 'assign', 'launch', 'roll', 'resolve', 'harvest', 'store'];
    const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), guideKey);
    const marker = id => '[data-guide-trim-flower-id="' + id + '"]';
    for (const width of [320, 390, 1440]) {
      await load('storage', width, 'view=harvests&section=storage&flower=' + targetId);
      await page.evaluate(({ key, completed, flowerId }) => localStorage.setItem(key, JSON.stringify({ version: 2, active: true, started: true, collapsed: false, completed, flowerId })), { key: guideKey, completed, flowerId: targetId });
      await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('[data-farm-guide][data-guide-step="trim"]');
      await keyClick('[data-farm-guide-action]'); await page.waitForSelector('[data-trim-worker]');
      await page.waitForSelector(marker(targetId) + '[data-guide-trim-state="required"]');
      assert.equal(new URL(page.url()).searchParams.get('flower'), targetId, 'The guide keeps its own harvest identity in the route');
      assert.equal(await page.$$eval('[data-workshop-trim-desk] button', nodes => nodes.some(node => /^(Préparer le trim|Refermer le lot|Suivre le trim)$/.test(node.textContent.trim()))), false, 'Guide navigation opens shared stock without choosing a lot');
      await keyClick('[data-farm-guide-action]'); assert(await page.$(marker(targetId) + '[data-farm-guide-target]'), 'Guidance highlights the tracked harvest marker in shared stock');
      await button('Vérifier le trim', '[data-workshop-trim-desk]'); await page.waitForSelector('dialog[open]');
      assert(await page.$$eval('[data-warehouse-room]', nodes => nodes.every(node => node.disabled)), 'Shared trim review still locks parent room navigation');
      assert.equal((await mutations()).length, 0); await page.keyboard.press('Escape');
      await page.evaluate(id => window.__control.trim(id, 'complete'), decoyId);
      await page.waitForSelector(marker(decoyId) + '[data-guide-trim-state="complete"]');
      assert.equal((await saved()).completed.includes('trim'), false, 'Completing a different harvest cannot complete the tracked harvest');
      for (const stage of ['queued', 'running', 'partial']) {
        await page.evaluate(({ id, stage }) => window.__control.trim(id, stage), { id: targetId, stage });
        await page.waitForSelector(marker(targetId) + '[data-guide-trim-state="' + (stage === 'running' ? 'running' : 'required') + '"]');
        assert.equal((await saved()).completed.includes('trim'), false, 'Shared ' + stage + ' work is not a completed harvest');
      }
      await page.$eval('[data-workshop-trim-desk]', node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await layout(); await screenshot(`shared-trim-guide-${width}`);
      await page.evaluate(() => { window.__control.staff('error'); window.__control.notify('kq:staff-updated'); }); await page.waitForSelector('[data-workshop-trim-desk] [role="alert"]');
      assert.equal((await saved()).completed.includes('trim'), false, 'Failed stock reads cannot complete the guide');
      await page.evaluate(id => { window.__control.staff('known'); window.__control.trim(id, 'complete'); }, targetId);
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).completed.includes('trim'), {}, guideKey);
      assert.equal((await saved()).flowerId, targetId); assert.equal((await saved()).completed.includes('jury'), false);
      await page.waitForSelector('[data-farm-guide][data-guide-step="jury"]');
      assert.equal((await mutations()).length, 0); assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
      await layout();
      results.push({ width, scenario: 'shared stock in real Shell and guide', checks: ['no lot chooser', 'tracked harvest route and matching marker', 'review locks parent without writing', 'other harvest cannot complete objective', 'shared queued/running/partial work never claims completion', 'unavailable stock preserves guide', 'own confirmed harvest advances guide', 'no horizontal overflow'], mutations: 0 });
    }
    await keyClick('[data-farm-guide-close]'); await page.waitForFunction(() => !document.querySelector('[data-farm-guide]'));
    await page.evaluate(id => window.__control.trim(id, 'running'), targetId);
    assert.equal(await page.$('[data-farm-guide]'), null, 'Stock refresh never reopens a closed guide');
    results.push({ scenario: 'closed guide remains closed after shared stock refresh', mutations: 0 });
  }
  if (financialSupportOnly) {
    for (const width of [320, 390, 1440]) {
      await load('financial-support-default', width, 'view=hub');
      assert.equal(await page.evaluate(() => window.process.env.NEXT_PUBLIC_KQ_FINANCIAL_SUPPORT_URL), undefined, 'Production without a hosting variable still displays the operator-provided link');
      await page.waitForSelector('[data-financial-support]', { visible: true });
      const support = '[data-financial-support]';
      const link = support + ' a';
      const before = (await fixture()).production.cashCents;
      const heading = await page.$eval(support + ' h2', node => ({ text: node.textContent.trim(), transform: getComputedStyle(node).textTransform, weight: Number(getComputedStyle(node).fontWeight) }));
      assert(heading.transform === 'uppercase' || heading.text === heading.text.toLocaleUpperCase('fr'), 'Support heading is displayed in uppercase');
      assert(heading.weight >= 700, 'Support heading is bold');
      const artwork = await page.$eval(support + ' img', node => {
        const bounds = node.getBoundingClientRect();
        return { source: node.getAttribute('src'), loaded: node.complete && node.naturalWidth > 0, width: bounds.width, height: bounds.height, decorative: node.alt === '' && !!node.closest('[aria-hidden="true"]') };
      });
      assert(artwork.loaded && artwork.width >= 100 && artwork.height >= 100, 'Support illustration is loaded and readable at every viewport');
      assert(artwork.decorative, 'Support illustration leaves heading and controls in accessible HTML');
      assert(artwork.source.includes('/producer-support-v1.webp'), 'Support uses its dedicated producer illustration');
      assert.match(await page.$eval(support, node => node.textContent), /seulement si l’envie te prend et si tu peux/);
      assert.equal(await page.$eval(link, node => node.href), 'https://pay.vivawallet.com/les-champs-bretons');
      assert.equal(await page.$eval(link, node => node.textContent.trim()), 'Soutenir');
      assert.equal(await page.$eval(link, node => node.target), '_blank');
      assert(await page.$eval(link, node => node.rel.includes('noopener') && node.rel.includes('noreferrer')));
      await page.$eval(support, node => { node.style.scrollMarginTop = '80px'; node.scrollIntoView({ block: 'start', behavior: 'instant' }); });
      await screenshot(`financial-support-intro-${width}`);
      await keyClick(support + ' summary');
      assert(await page.$eval(support + ' details', node => node.open));
      assert.match(await page.$eval(support, node => node.textContent), /SASU Les Champs Bretons/);
      assert.match(await page.$eval(support + ' details', node => node.textContent), /Avantage en échangeAucunNi objet, bonus, accès privilégié ou avantage dans les concours/);
      assert.match(await page.$eval(support, node => node.textContent), /réduction d’impôt/);
      assert.match(await page.$eval(support + ' details', node => node.textContent), /Choisis ton montant sur la page Viva, puis vérifie-le avant de confirmer ce soutien ponctuel/);
      await page.$eval(link, node => node.addEventListener('click', event => { event.preventDefault(); window.__supportActivated = node.href; }));
      await keyClick(link);
      assert.equal(await page.evaluate(() => window.__supportActivated), 'https://pay.vivawallet.com/les-champs-bretons');
      assert(await page.$eval(link, node => getComputedStyle(node).outlineStyle !== 'none'));
      assert(await page.$eval(link, node => node.getBoundingClientRect().height >= 44));
      assert.equal((await fixture()).production.cashCents, before);
      assert.equal((await mutations()).length, 0);
      await layout();
      await page.$eval(support, node => node.scrollIntoView({ block: 'center' }));
      await screenshot(`financial-support-${width}`);
      results.push({ width, heading, artwork, keyboard: true, disclosures: true, noGameMutation: true, externalNavigationPrevented: true });
    }
    await load('financial-support', 390, 'view=hub');
    await page.waitForSelector('[data-financial-support]', { visible: true });
    assert.equal(await page.$eval('[data-financial-support] a', node => node.href), 'https://pay.vivawallet.com/les-champs-bretons');
    results.push({ scenario: 'financial-support', configuredLink: true });
    for (const scenario of ['financial-support-hidden', 'financial-support-invalid', 'financial-support-tutorial']) {
      await load(scenario, 390, 'view=hub');
      await page.waitForSelector('[data-placard-lobby]');
      assert.equal(await page.$('[data-financial-support]'), null);
      assert.equal((await mutations()).length, 0);
      results.push({ scenario, hidden: true });
    }
  } else if (workPlanOnly) {
    await load('staff-plan', 390, 'view=staff');
    await page.waitForSelector('[data-staff-work-plan]', { visible: true });
    const before = await fixture();
    await keyClick(`[data-staff-work-employee="${planEmployeeId}"]`);
    await keyClick('[data-staff-work-station="trim"] > button');
    await page.waitForSelector('[data-warehouse-v4] [data-workshop-trim-desk]', { visible: true });
    const url = new URL(page.url());
    for (const [name, value] of Object.entries({ view: 'workshop', section: 'processing', workshop: 'trim', employee: planEmployeeId, from: 'staff' })) assert.equal(url.searchParams.get(name), value);
    await page.waitForSelector(`[data-trim-assigned-employee="${planEmployeeId}"]`, { visible: true });
    await page.waitForSelector('[data-trim-worker]', { visible: true });
    assert.equal((await mutations()).length, 0);
    await page.waitForSelector('[data-trim-worker]', { visible: true });
    assert.equal(await page.$eval('[data-trim-worker]', node => node.value), planEmployeeId);
    await button('Vérifier le trim', '[data-workshop-trim-desk]'); await page.waitForSelector('dialog[open] #staff-confirm-title');
    const confirmation = await page.$eval('dialog dl', node => node.textContent);
    assert(confirmation.includes('Anna Le Gall') && confirmation.includes('Cadence'), 'The real workshop reviews the selected employee and shared-stock rate');
    assert(await page.$$eval('[data-warehouse-room]', nodes => nodes.every(node => node.disabled)), 'Trim review retains the parent room lock');
    await layout(); await screenshot('work-plan-real-trim-confirm-390');
    await page.keyboard.press('Escape');
    assert.equal((await mutations()).length, 0); assert.deepEqual((await fixture()).staffRaw, before.staffRaw);
    await page.goBack({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-staff-work-plan]', { visible: true });
    assert.equal(new URL(page.url()).searchParams.get('view'), 'staff');
    assert.equal((await mutations()).length, 0); assert.deepEqual((await fixture()).staffRaw, before.staffRaw);
    await layout(); await screenshot('work-plan-real-return-390');
    results.push({ width: 390, scenario: 'real Personnel work plan → shared workshop trim → employee and rate review → cancel and browser Back', selectedEmployeePreserved: true, noLotChooser: true, parentLockedDuringReview: true, noGameWrites: true });
  }
  if (workshopOnly) {
    for (const width of [320, 390, 1440]) {
      await load('workshop', width, `view=workshop&section=processing&workshop=trim&flower=${targetId}&from=harvests&fromFlower=${targetId}`);
      await page.waitForSelector('[data-warehouse-v4] [data-trim-shared-form]', { visible: true });
      const initialStaff = (await fixture()).staffRaw;
      assert.equal(await page.$eval('[data-workshop-section]', node => node.dataset.workshopSection), 'trim');
      await layout(); await screenshot('workshop-trim-' + width);
      await keyClick('[data-workshop-tabs] button:nth-child(2)');
      await page.waitForSelector('[data-workshop-section="machines"]', { visible: true });
      await page.waitForSelector('[data-warehouse-commerce-access]', { visible: true });
      await layout(); await screenshot('workshop-machines-' + width);
      await keyClick('[data-workshop-tabs] button:first-child');
      await page.waitForSelector('[data-trim-shared-form]', { visible: true });
      await button('Vérifier le trim', '[data-workshop-trim-desk]');
      await page.waitForSelector('dialog[open] #staff-confirm-title', { visible: true });
      await page.waitForFunction(() => [...document.querySelectorAll('[data-workshop-tabs] button')].every(node => node.disabled));
      assert(await page.$$eval('[data-warehouse-room]', nodes => nodes.length === 4 && nodes.every(node => node.disabled)), 'Parent rooms stay locked during trim confirmation');
      assert.equal(await page.$eval('[data-workshop-section]', node => node.dataset.workshopSection), 'trim');
      assert.equal((await mutations()).length, 0, 'Preparing the confirmation performs no work or purchase');
      await screenshot('workshop-confirmation-' + width);
      await button('Annuler', 'dialog[open]');
      await page.waitForFunction(() => !document.querySelector('dialog[open]') && [...document.querySelectorAll('[data-workshop-tabs] button')].every(node => !node.disabled));
      await keyClick('[data-placard-back="harvests"]');
      await page.waitForSelector(`[data-harvest-id="${targetId}"]`, { visible: true });
      assert.equal(new URL(page.url()).searchParams.get('flower'), targetId);
      assert.deepEqual((await fixture()).staffRaw, initialStaff);
      assert.equal((await mutations()).length, 0);
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
      await layout();
      results.push({ scenario: 'real workshop trim/machines/trim, confirmation locks parent, cancellation returns to selected harvest without mutations', width, preservedFlower: true });
    }
  }
  if (staffGuideOnly) {
    const guideKey = 'kq:farm-guide:v1:journey-local-fixture';
    // Freeze the previously complete guide: deriving this from today's step list would hide migration regressions.
    const previousSteps = ['welcome', 'zone', 'buddies', 'cards', 'packs', 'assign', 'launch', 'roll', 'resolve', 'harvest', 'store', 'cure', 'jury', 'sale', 'accounts', 'listings', 'bank', 'site', 'studio', 'merch', 'promotion', 'adventure', 'partners', 'missions'];
    const staffSteps = ['staff-candidate', 'staff-planning', 'staff-development', 'staff-payroll'];
    const storedGuide = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), guideKey);
    const waitStep = step => page.waitForSelector(`[data-farm-guide][data-guide-step="${step}"]`, { visible: true });
    const settleGuide = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const staffProgress = async () => (await storedGuide()).completed.filter(id => staffSteps.includes(id));
    async function seedPreviousGuide(active = false) {
      const previous = { version: 2, active, started: true, collapsed: !active, completed: previousSteps, flowerId: targetId };
      await page.evaluate(({ key, previous }) => localStorage.setItem(key, JSON.stringify(previous)), { key: guideKey, previous });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-guide-staff-ready="true"]', { visible: true });
      return previous;
    }
    async function guideTarget() {
      if (await page.$eval('[data-farm-guide]', node => node.dataset.expanded !== 'true')) await keyClick('[data-farm-guide] button[aria-controls]');
      await keyClick('[data-farm-guide-action]'); await settleGuide();
    }
    async function assertReadOnly(before) {
      assert.deepEqual((await fixture()).staffRaw, before.staffRaw, 'No employee, task, leave or payroll is created while learning');
      assert.deepEqual((await fixture()).production, before.production, 'The farm and its cash remain unchanged');
      assert.equal((await mutations()).length, 0, 'Personnel discovery sends only GET requests');
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
      assert(await page.evaluate(() => window.__calls.some(call => call.path.endsWith('/staff') && call.method === 'GET')), 'The real Personnel component loads its snapshot');
    }
    for (const width of [320, 390, 1440]) {
      await load('staff-guide', width, 'view=staff');
      const previous = await seedPreviousGuide(); const before = await fixture();
      assert.equal(before.staffRaw.state.employees.length, 0, 'The learning route works without an employee');
      assert.equal(await page.$('[data-farm-guide]'), null, 'Adding Personnel never reopens a previously closed guide');
      assert.equal(await page.$('[data-farm-guide-resume]'), null);
      const restored = await storedGuide();
      assert.deepEqual({ ...restored, completed: restored.completed.filter(id => id !== 'trim') }, previous, 'Old objectives, tracked harvest and display preferences are preserved');
      assert(restored.completed.includes('trim'), 'An old confirmed jury satisfies the trim prerequisite without retroactive work');
      await page.evaluate(() => window.dispatchEvent(new Event('kq:farm-guide-open')));
      await waitStep('staff-candidate');
      await guideTarget();
      assert(await page.$('[data-staff-tab="candidates"][data-farm-guide-target]'));
      assert.deepEqual(await staffProgress(), [], 'Highlighting recruitment is not reading a contract');
      await keyClick('[data-staff-tab="candidates"]');
      await page.waitForSelector('[data-staff-panel="candidates"]', { visible: true });
      await settleGuide();
      assert.deepEqual(await staffProgress(), [], 'A list of candidates alone does not complete contract discovery');
      await keyClick('[data-staff-profile]');
      await page.waitForSelector('[data-staff-hire-form]', { visible: true });
      await waitStep('staff-planning');
      assert.deepEqual(await staffProgress(), ['staff-candidate']);
      assert(await page.$eval('[data-staff-hire-form]', node => /brut/i.test(node.textContent) && /coût employeur/i.test(node.textContent)), 'The actual contract displays gross salary and estimated employer cost');
      await layout(); await screenshot('staff-guide-contract-' + width);
      await guideTarget();
      assert(await page.$('[data-staff-guide="planning"] > summary[data-farm-guide-target]'));
      assert.deepEqual(await staffProgress(), ['staff-candidate'], 'Focusing a closed planning explanation is not reading it');
      await keyClick('[data-staff-guide="planning"] > summary');
      await waitStep('staff-development');
      assert(await page.$eval('[data-staff-guide="planning"]', node => node.open && /heure/i.test(node.textContent) && /mission/i.test(node.textContent)));
      await guideTarget();
      assert.deepEqual(await staffProgress(), ['staff-candidate', 'staff-planning']);
      await keyClick('[data-staff-guide="development"] > summary');
      await waitStep('staff-payroll');
      assert(await page.$eval('[data-staff-guide="development"]', node => node.open && /formation/i.test(node.textContent) && /congé/i.test(node.textContent)));
      await layout(); await screenshot('staff-guide-development-' + width);
      await guideTarget();
      assert(await page.$('[data-staff-tab="payroll"][data-farm-guide-target]'));
      assert.deepEqual(await staffProgress(), staffSteps.slice(0, 3), 'Payroll discovery needs the visible payroll panel');
      await keyClick('[data-staff-tab="payroll"]');
      await page.waitForSelector('[data-staff-panel="payroll"]', { visible: true });
      await waitStep('complete');
      assert.deepEqual(await staffProgress(), staffSteps);
      assert(await page.$eval('[data-staff-panel="payroll"]', node => node.textContent.includes('Aucune paie à régler')), 'No debt or payment is required to understand payroll');
      assert.equal((await storedGuide()).flowerId, targetId);
      for (const id of previousSteps) assert((await storedGuide()).completed.includes(id));
      await page.$eval('[data-staff-panel="payroll"]', node => node.scrollIntoView({ block: 'center' }));
      await layout(); await screenshot('staff-guide-payroll-' + width);
      const completed = (await storedGuide()).completed;
      await keyClick('[data-farm-guide-close]');
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-guide-staff-ready="true"]');
      assert.equal(await page.$('[data-farm-guide]'), null);
      assert.deepEqual((await storedGuide()).completed, completed, 'The four discoveries survive closing and reloading');
      await assertReadOnly(before);
      results.push({ width, scenario: 'previously completed guide → candidates → planning → development → payroll', closedPreferencePreserved: true, trackedHarvestPreserved: true, explicitVisibleEvidence: true, noEmployeeRequired: true, persisted: true, noGameWrites: true });
      console.log('Personnel guide discovery verified at ' + width + 'px');
    }

    await load('staff-guide', 390, 'view=staff');
    await seedPreviousGuide(true); const beforeUnavailable = await fixture();
    await waitStep('staff-candidate'); await keyClick('[data-staff-tab="candidates"]');
    await page.evaluate(() => { window.__control.staff('pending'); window.__control.notify('kq:staff-updated'); });
    await page.waitForFunction(() => !document.querySelector('[data-guide-staff-ready="true"]') && [...document.querySelectorAll('[data-staff-desk] button')].some(node => node.disabled && node.textContent.includes('Actualisation')));
    assert(await page.$$eval('[data-staff-profile]', nodes => nodes.length > 0 && nodes.every(node => node.disabled)), 'Retained candidate profiles stay disabled during loading');
    assert(await page.$$eval('[data-staff-tab]', nodes => nodes.length === 3 && nodes.every(node => node.disabled)), 'Personnel navigation stays disabled during loading');
    assert.equal(await page.$('[data-staff-hire-form]'), null, 'Loading cannot open a contract from retained offers');
    await keyClick('[data-staff-guide="planning"] > summary');
    await keyClick('[data-staff-guide="development"] > summary');
    await settleGuide();
    assert.deepEqual(await staffProgress(), [], 'Visible stale data cannot validate objectives while the snapshot is loading');
    await page.evaluate(() => { window.__control.staff('error'); window.__control.resolve(); });
    await page.waitForSelector('[data-staff-desk] [role="alert"]', { visible: true });
    await settleGuide();
    assert.deepEqual(await staffProgress(), [], 'An error cannot turn retained offers and open explanations into successful visits');
    assert(await page.$$eval('[data-staff-profile], [data-staff-tab]', nodes => nodes.length > 3 && nodes.every(node => node.disabled)), 'Failed data leaves candidate actions and Personnel navigation locked');
    assert.equal(await page.$('[data-staff-hire-form]'), null);
    assert.equal(await page.$('[data-guide-staff-ready="true"]'), null);
    await layout(); await screenshot('staff-guide-unavailable-390');
    await page.evaluate(() => window.__control.staff('known'));
    await button('Réessayer', '[data-staff-desk] [role="alert"]');
    await page.waitForSelector('[data-guide-staff-ready="true"]');
    await settleGuide();
    await waitStep('staff-candidate');
    assert.deepEqual(await staffProgress(), staffSteps.slice(1, 3), 'A successful GET validates the retained open explanations, while the unopened contract stays incomplete');
    assert(await page.$$eval('[data-staff-profile], [data-staff-tab]', nodes => nodes.every(node => !node.disabled)), 'Successful recovery unlocks the real controls');
    await keyClick('[data-staff-profile]');
    await page.waitForSelector('[data-staff-hire-form]', { visible: true });
    await waitStep('staff-payroll');
    assert.deepEqual(await staffProgress(), staffSteps.slice(0, 3), 'Opening the recovered contract supplies the missing candidate evidence');
    await keyClick('[data-staff-tab="payroll"]'); await waitStep('complete');
    await assertReadOnly(beforeUnavailable);
    results.push({ width: 390, scenario: 'loading and failed refresh lock candidate actions and preserve incomplete objectives; retry restores explanations and a freshly opened contract', loadingControlsLocked: true, loadingDoesNotValidate: true, errorDoesNotValidate: true, retryRestores: true, recoveredContractOpened: true, noGameWrites: true });
  }
  if (guideCompletionOnly) {
    const guideKey = 'kq:farm-guide:v1:journey-local-fixture';
    const launcher = '[data-arena-learning-trigger]';
    const menu = 'dialog[aria-label="Menu de Kanab Quest"]';
    const storedGuide = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), guideKey);
    const readOnly = async before => {
      const after = await fixture();
      assert.deepEqual(after.production, before.production, 'Guide completion preserves the game');
      assert.deepEqual(after.staffRaw, before.staffRaw, 'Guide completion preserves staff and working hours');
      assert.deepEqual(after.lots, before.lots, 'Guide completion preserves the harvests');
      assert.deepEqual(await mutations(), [], 'Guide completion never submits a gameplay mutation');
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
    };
    const availability = async expected => {
      await page.waitForFunction((selector, count) => document.querySelectorAll(selector).length === count, {}, launcher, expected ? 2 : 0);
      assert.equal(await page.$$eval('[data-placard-learning-entry]', nodes => nodes.length), expected ? 2 : 0, 'Both navigation wrappers follow the completed state');
    };
    const openMenu = async () => {
      await keyClick('button[aria-label="Plus d’activités"]');
      await page.waitForFunction(() => document.querySelector('dialog[aria-label="Menu de Kanab Quest"]')?.open);
    };
    const seed = async raw => {
      await page.evaluate(({ key, raw }) => raw === null ? localStorage.removeItem(key) : localStorage.setItem(key, raw), { key: guideKey, raw });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-placard-lobby]');
    };
    for (const width of [320, 390, 1440]) {
      await load('preparation', width, 'view=hub');
      const steps = await page.evaluate(() => window.__guideIds.steps);
      assert.equal(steps.at(-1), 'missions', 'The scenario visits the actual final guide objective');
      await seed(JSON.stringify({ version: 2, active: false, started: true, collapsed: true, completed: steps.slice(0, -1) }));
      const before = await fixture();
      await availability(true);
      assert.equal(await page.$('[data-farm-guide]'), null, 'A paused incomplete guide remains paused after reload');
      if (width < 1000) await openMenu();
      const scope = width < 1000 ? menu : '[data-placard-view] > aside';
      await keyClick(scope + ' ' + launcher);
      await page.waitForSelector('[data-farm-guide][data-guide-step="missions"]', { visible: true });
      assert.equal(await page.$eval(menu, node => node.open), false);
      results.push({ width, scenario: 'paused incomplete guide remains available in both navigation locations and resumes by keyboard', noGameWrites: true });
      await keyClick('[data-farm-guide-action]');
      await page.waitForSelector('[data-mission-summary]', { visible: true });
      await page.waitForSelector('[data-farm-guide][data-guide-step="complete"]');
      await availability(false);
      assert.deepEqual((await storedGuide()).completed, steps, 'The real mission summary supplies the final completion evidence');
      assert(!await page.$eval('[data-farm-story-line]', node => node.textContent.includes('Apprendre à jouer')), 'Completion advice does not point to a removed launcher');
      await readOnly(before);
      await keyClick('[data-farm-guide-close]');
      await page.waitForFunction(() => !document.querySelector('[data-farm-guide]'));
      await availability(false);
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-mission-summary]');
      await availability(false);
      assert.equal((await storedGuide()).active, false);
      if (width < 1000) await openMenu();
      assert(await page.$eval(scope, node => [...node.querySelectorAll('summary')].some(summary => summary.textContent.includes('Comment jouer'))), 'Screen help remains available after tutorial completion');
      await layout(); await screenshot('guide-complete-' + width);
      if (width < 1000) {
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog[aria-label="Menu de Kanab Quest"]')?.open && !history.state?.lcbOverlays?.length && !document.documentElement.hasAttribute('data-site-scroll-locked'));
      }
      await readOnly(before);
      results.push({ width, scenario: 'real final objective removes both launchers immediately; completed and closed save stays hidden after reload', completionPersisted: true, screenHelpRetained: true, noGameWrites: true });
    }
    for (const scenario of ['missing', 'legacy', 'malformed']) {
      await load('preparation', 390, 'view=hub');
      const raw = scenario === 'missing' ? null : scenario === 'malformed' ? '{broken' : JSON.stringify({ version: 1, active: false, read: await page.evaluate(() => window.__guideIds.chapters) });
      await seed(raw);
      const before = await fixture();
      await availability(true);
      assert.equal(await page.$('[data-farm-guide]'), null);
      if (scenario === 'malformed') assert.equal(await page.evaluate(key => localStorage.getItem(key), guideKey), raw, 'Malformed progress is not overwritten');
      await openMenu();
      await keyClick(menu + ' ' + launcher);
      await page.waitForSelector('[data-farm-guide]', { visible: true });
      assert.notEqual(await page.$eval('[data-farm-guide]', node => node.dataset.guideStep), 'complete');
      await availability(true);
      await readOnly(before);
      results.push({ width: 390, scenario: scenario + ' progress keeps learning available and starts an incomplete guide', noGameWrites: true });
    }
    await load('preparation', 390, 'view=hub');
    const completed = await page.evaluate(() => window.__guideIds.steps);
    await seed(JSON.stringify({ version: 2, active: false, started: true, collapsed: true, completed }));
    const beforeOwnerSwitch = await fixture();
    await availability(false);
    await page.evaluate(() => window.__control.owner('journey-second-owner'));
    await availability(true);
    assert.equal(await page.evaluate(() => localStorage.getItem('kq:farm-guide:v1:journey-second-owner')), null, 'A different owner starts without inherited progress');
    assert.deepEqual((await storedGuide()).completed, completed, 'The previous owner keeps their own completion');
    await page.evaluate(() => window.__control.owner('journey-local-fixture'));
    await availability(false);
    await readOnly(beforeOwnerSwitch);
    results.push({ width: 390, scenario: 'switching owners on the mounted Shell isolates completion and returning restores it', noGameWrites: true });
  }
  if (guideOnly && !guideCompletionOnly) {
    const menu = 'dialog[aria-label="Menu de Kanab Quest"]';
    const launcher = '[data-arena-learning-trigger]';
    const guideKey = 'kq:farm-guide:v1:journey-local-fixture';
    const unlocked = () => page.waitForFunction(() => !document.documentElement.hasAttribute('data-site-scroll-locked') && getComputedStyle(document.body).overflow !== 'hidden' && !(history.state?.lcbOverlays?.length));
    for (const width of [320, 390, 1440]) {
      for (const view of ['hub', 'harvests']) {
        await load(view === 'hub' ? 'preparation' : 'storage', width, 'view=' + view + '&flower=' + targetId + '&from=market');
        await page.waitForSelector(view === 'hub' ? '[data-placard-lobby]' : '[data-harvest-id]');
        const before = await fixture(), url = page.url();
        await page.evaluate(() => history.replaceState({ ...history.state, guideNavigationSentinel: 'preserved' }, ''));
        assert.equal(await page.$('[data-placard-lobby] [data-placard-learning-entry], [data-placard-lobby] [data-arena-learning-trigger]'), null, 'The neighborhood map no longer repeats learning controls');
        assert.equal(await page.$('[data-arena-practice-trigger], [data-entry-practice]'), null, 'The live game has no separate practice button');
        assert.equal(await page.$('[data-farm-guide]'), null, 'Learning remains an explicit action');
        if (view === 'hub') await page.screenshot({ path: resolve(output, 'guide-lobby-' + width + '.png'), fullPage: true });
        const scope = width <= 1000 ? menu : '[data-placard-view] > aside';
        const openMenu = async () => {
          await keyClick('button[aria-label="Plus d’activités"]');
          await page.waitForFunction(() => document.querySelector('dialog[aria-label="Menu de Kanab Quest"]')?.open && document.documentElement.hasAttribute('data-site-scroll-locked') && history.state?.lcbOverlays?.length === 1);
        };
        if (width <= 1000) {
          await openMenu();
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => !document.querySelector('dialog[aria-label="Menu de Kanab Quest"]')?.open);
          await unlocked();
          assert.equal(page.url(), url, 'Escape closes the drawer without changing the current activity');
          await openMenu();
          await page.goBack();
          await page.waitForFunction(() => !document.querySelector('dialog[aria-label="Menu de Kanab Quest"]')?.open);
          await unlocked();
          assert.equal(page.url(), url, 'Back consumes only the drawer history entry');
          await openMenu();
        }
        const entry = scope + ' ' + launcher;
        await page.waitForSelector(entry, { visible: true });
        assert(await page.$eval(entry, node => {
          const footer = node.closest('[data-placard-learning-entry]')?.parentElement;
          const help = footer?.querySelector('details > summary');
          return !node.closest('details') && help && !!(node.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING);
        }), 'Apprendre à jouer is directly above Comment jouer, outside its disclosure');
        await page.focus(entry);
        assert(await page.$eval(entry, node => getComputedStyle(node).outlineStyle !== 'none'), 'The guide entry has a visible keyboard focus indicator');
        if (view === 'hub') await screenshot('guide-navigation-' + width);
        await page.keyboard.press('Enter');
        await page.waitForSelector('[data-farm-guide]', { visible: true });
        await unlocked();
        assert.equal(await page.$eval(menu, node => node.open), false, 'The menu closes before the native guide is used');
        assert.equal(page.url(), url, 'Opening the guide preserves the activity, harvest and return context');
        assert.equal(await page.evaluate(() => history.state.guideNavigationSentinel), 'preserved', 'Guide launch preserves existing history state');
        assert.equal(await page.$('[data-arena-learning], [data-releve]'), null, 'The entry opens the native guide directly');
        const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).completed, guideKey);
        await keyClick('[data-farm-guide-close]');
        await page.waitForFunction(() => !document.querySelector('[data-farm-guide]'));
        assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog:not([open])'))), false, 'Closing the guide never leaves focus inside the hidden menu');
        if (width <= 1000) await openMenu();
        await keyClick(entry);
        await page.waitForSelector('[data-farm-guide]', { visible: true });
        await unlocked();
        assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).completed, guideKey), progress, 'Reopening preserves guide progress');
        assert.deepEqual((await fixture()).production, before.production, 'Learning navigation preserves game state');
        assert.deepEqual((await fixture()).staffRaw, before.staffRaw, 'Learning navigation does not reserve work or change staff');
        assert.equal((await mutations()).length, 0, 'Opening and closing the guide performs no gameplay mutation');
        assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
        await layout();
        results.push({ width, view, directNavigationEntry: true, noPracticeButton: true, keyboard: true, drawerAndHistorySafe: true, contextAndProgressPreserved: true, noGameWrites: true });
      }
    }
  }
  if (guideOnly && !guideNavigationOnly && !guideCompletionOnly) {
    const guideKey = 'kq:farm-guide:v1:journey-local-fixture';
    const storedGuide = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), guideKey);
    const openGuide = () => page.evaluate(() => window.dispatchEvent(new Event('kq:farm-guide-open')));
    const waitStep = step => page.waitForSelector('[data-farm-guide][data-guide-step="' + step + '"]');
    const expanded = () => page.$eval('[data-farm-guide] button[aria-controls]', node => node.getAttribute('aria-expanded') === 'true');
    const expandGuide = async () => { if (!await expanded()) await keyClick('[data-farm-guide] button[aria-controls]'); };
    const seedGuide = async completed => {
      await page.evaluate(({ key, completed }) => localStorage.setItem(key, JSON.stringify({ version: 2, active: true, started: true, collapsed: false, completed })), { key: guideKey, completed });
      await page.reload({ waitUntil: 'networkidle0' });
    };
    async function visitChapter(label) {
      await expandGuide();
      const notebook = '[data-farm-guide] details';
      if (!await page.$eval(notebook, node => node.open)) await keyClick(notebook + ' > summary');
      await button(label, notebook);
    }
    async function assertNoGuide() {
      await page.waitForFunction(() => !document.querySelector('[data-farm-guide]'));
      assert.equal(await page.$('[data-farm-guide-resume]'), null, 'Closing leaves no replacement guide banner');
    }
    for (const width of [320, 390, 1440]) {
      await load('preparation', width);
      await page.waitForSelector('[data-culture-start-review]');
      assert.equal(await page.$('[data-farm-guide]'), null, 'Guide stays hidden until explicitly started');
      await seedGuide(['welcome']);
      await waitStep('buddies');
      const before = await fixture();
      assert.deepEqual((await storedGuide()).completed, ['welcome', 'zone', 'assign'], 'Only confirmed saved fixture zones and assignment are credited automatically');
      assert.equal(await page.$eval('[data-farm-guide] details', node => node.open), false, 'The notebook starts folded');
      await keyClick('[data-farm-guide-action]');
      await page.waitForSelector('dialog[open] [data-farm-guide-host] [data-guide-step="cards"]');
      assert.equal(await page.$eval('[data-collection-tab="buddies"]', node => node.getAttribute('aria-selected')), 'true');
      await page.waitForFunction(() => { const image = document.querySelector('[data-farm-story-scene] img'); return image?.complete && image.naturalWidth > 0; });
      assert(await page.$eval('[data-farm-story-scene] img', node => node.checkVisibility() && node.getBoundingClientRect().width >= 100 && node.getBoundingClientRect().height >= 60), 'The compact illustration remains visible at every width');
      assert(await page.$eval('[data-farm-story-line]', node => node.textContent.length < 220), 'One concise objective remains visible');
      await layout(); await screenshot('guide-collection-' + width);
      await keyClick('[data-farm-guide-action]');
      assert.equal(await expanded(), false);
      assert(await page.$('[data-collection-tab="botte"][data-farm-guide-target]'), 'Guidance focuses the actual card tab');
      assert.equal((await storedGuide()).completed.includes('cards'), false, 'Highlighting a tab cannot complete its discovery');
      await keyClick('[data-collection-tab="botte"]');
      await waitStep('packs');
      assert.equal(await expanded(), false, 'Advancing an objective never expands the compact guide');
      await keyClick('[data-collection-tab="buddies"]');
      await keyClick('[data-collection-tab="botte"]');
      assert.equal(await expanded(), false, 'Changing collection tabs preserves compact mode');
      if (width === 320) await screenshot('guide-playing-320');
      await page.reload({ waitUntil: 'networkidle0' });
      await waitStep('packs');
      assert.equal(await expanded(), false, 'Reload restores compact mode');
      await expandGuide(); await keyClick('[data-farm-guide-action]');
      await page.waitForSelector('[data-arena-tour-surface="shop"]');
      await waitStep('launch');
      assert.equal((await mutations()).length, 0, 'Opening Packs never claims, buys, or opens a pack');
      const beforeClose = await storedGuide();
      await keyClick('[data-farm-guide-close]'); await assertNoGuide();
      assert.equal((await storedGuide()).active, false);
      await page.reload({ waitUntil: 'networkidle0' }); await assertNoGuide();
      assert.equal((await mutations()).length, 0, 'A closed guide on Packs never causes an automatic claim');
      await openGuide(); await waitStep('launch');
      assert.deepEqual((await storedGuide()).completed, beforeClose.completed, 'Reopening preserves earned objectives');
      await keyClick('[data-farm-guide-action]');
      await page.waitForSelector('[data-culture-start-review]');
      await waitStep('launch');
      await layout(); await screenshot('guide-culture-' + width);
      await keyClick('[data-farm-guide-action]');
      assert.equal(await expanded(), false);
      await keyClick('[data-culture-start-review]');
      await page.waitForSelector('[data-culture-confirm-start]', { visible: true });
      assert.equal((await storedGuide()).completed.includes('launch'), false, 'Opening the launch confirmation is not a launched culture');
      assert.equal((await mutations()).length, 0, 'Guide navigation and launch review never perform a game action');
      await page.keyboard.press('Escape');
      assert.deepEqual((await fixture()).production, before.production, 'Exploration leaves the in-memory game unchanged');
      results.push({ width, savedSnapshotEvidence: true, explicitCollectionTabs: true, compactIllustration: true, compactAcrossTabsAndReload: true, closedWithoutBanner: true, reopenedProgress: true, launchReviewNotCompletion: true, noGameWrites: true });
    }

    // Only these explicit game controls may write, and only to the in-memory culture transport.
    await page.setViewport({ width: 390, height: 844 });
    await page.evaluate(() => window.__control.allowPlay(true));
    await keyClick('[data-culture-start-review]');
    await page.waitForSelector('[data-culture-confirm-start]', { visible: true });
    assert.equal((await mutations()).length, 0);
    await keyClick('[data-culture-confirm-start]');
    await page.waitForSelector('[data-culture-play][data-guide-culture-started="true"]');
    await waitStep('roll');
    await page.waitForFunction(() => document.querySelector('[data-player-work-status]')?.textContent.includes('12 h / 12 h'));
    assert.equal((await mutations()).length, 1);
    await keyClick('[data-culture-primary-action][data-action="roll"]');
    await page.waitForSelector('[data-culture-play][data-culture-phase="rolled"]');
    await waitStep('resolve');
    await page.waitForFunction(() => document.querySelector('[data-player-work-status]')?.textContent.includes('11,5 h / 12 h'));
    assert.equal((await storedGuide()).completed.includes('resolve'), false, 'Rolled dice alone do not resolve a turn');
    await keyClick('[data-culture-primary-action][data-action="resolve"]');
    await page.waitForSelector('[data-guide-turn-resolved="true"]');
    await waitStep('harvest');
    await page.waitForFunction(() => document.querySelector('[data-player-work-status]')?.textContent.includes('11,5 h / 12 h'));
    assert.equal((await storedGuide()).completed.includes('harvest'), false, 'A resolved turn is not a harvest');
    const playWrites = await mutations();
    assert.equal(playWrites.length, 3);
    assert(playWrites[0].path.endsWith('/runs'));
    assert.deepEqual(playWrites.slice(1).map(call => call.body.action), ['roll', 'resolve']);
    assert(playWrites.slice(1).every(call => /\/runs\/[^/]+\/actions$/.test(call.path)));
    await visibleBelowHeader('[data-farm-guide]');
    await layout(); await screenshot('guide-real-turn-390');
    await page.evaluate(() => window.__control.allowPlay(false));
    results.push({ explicitLaunchRollResolve: true, onlyThreeAuthorizedInMemoryWrites: true, noPrematureHarvest: true, allowanceRefreshedAfterEachCultureAction: true });

    await load('storage', 320);
    await page.waitForSelector('[data-harvest-id]');
    const previousSteps = ['welcome', 'zone', 'buddies', 'cards', 'packs', 'assign', 'launch', 'roll', 'resolve', 'harvest'];
    await page.evaluate(({ key, completed, flowerId }) => {
      localStorage.setItem(key, JSON.stringify({ version: 2, active: true, started: true, collapsed: false, completed, flowerId }));
    }, { key: guideKey, completed: previousSteps, flowerId: targetId });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-harvest-id]');
    await page.evaluate(id => {
      const lot = window.__fixture().lots.find(item => item.flowerId === id);
      window.__control.storageLot(id, { stage: 'curing', capacity: { ...lot.projection.capacity, protectedUnits: 0, overflowUnits: lot.projection.capacity.totalUnits, allocations: [] } });
    }, targetId);
    await waitStep('store');
    await keyClick('[data-farm-guide-action]');
    await page.waitForSelector('[data-conservation-lot="' + targetId + '"][data-selected="true"]');
    assert.equal(new URL(page.url()).searchParams.get('flower'), targetId);
    assert.equal((await storedGuide()).flowerId, targetId);
    assert.equal((await storedGuide()).completed.includes('store'), false, 'A protected homonymous lot does not complete storage for the selected harvest');
    assert.equal((await storedGuide()).completed.includes('cure'), false, 'A mature homonymous lot does not complete curing for the selected harvest');
    await keyClick('[data-farm-guide-action]');
    assert(await page.$('[data-conservation-lot="' + targetId + '"][data-farm-guide-target]'), 'Storage guidance highlights the tracked lot, not its homonym');
    assert.equal(await page.$('[data-conservation-lot="' + decoyId + '"][data-farm-guide-target]'), null);
    await expandGuide(); await layout(); await screenshot('guide-storage-320');
    assert.equal((await mutations()).length, 0);
    results.push({ homonymousStorageIdentity: true, wrongLotCannotCompleteStorageOrCuring: true, storageNoWrites: true });

    // Follow the same lot into the real Atelier. Snapshot transitions are in-memory fixtures.
    for (const width of [320, 390, 1440]) {
      await load('storage', width, 'view=harvests&section=storage&flower=' + targetId);
      await page.evaluate(({ key, completed, flowerId }) => localStorage.setItem(key, JSON.stringify({ version: 2, active: true, started: true, collapsed: false, completed, flowerId })), { key: guideKey, completed: [...previousSteps, 'store'], flowerId: targetId });
      await page.reload({ waitUntil: 'networkidle0' });
      await waitStep('trim');
      await keyClick('[data-farm-guide-action]');
      await page.waitForSelector('[data-guide-trim-flower-id="' + targetId + '"][data-guide-trim-state="required"]');
      assert.equal(new URL(page.url()).searchParams.get('section'), 'processing');
      assert.equal(new URL(page.url()).searchParams.get('flower'), targetId);
      await page.evaluate(() => window.scrollTo(0, 0));
      await screenshot('guide-trim-guidance-' + width);
      await keyClick('[data-farm-guide-action]');
      assert(await page.$('[data-guide-trim-flower-id="' + targetId + '"][data-farm-guide-target]'));
      await expandGuide(); await layout(); await screenshot('guide-trim-required-' + width);
      for (const stage of ['queued', 'running', 'partial']) {
        await page.evaluate(({ id, stage }) => window.__control.trim(id, stage), { id: targetId, stage });
        await page.waitForSelector('[data-guide-trim-state="' + (stage === 'partial' ? 'required' : stage) + '"]');
        await waitStep('trim');
        assert.equal((await storedGuide()).completed.includes('trim'), false);
      }
      await page.evaluate(id => window.__control.trim(id, 'complete'), targetId);
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).completed.includes('trim'), {}, guideKey);
      await waitStep('jury');
      assert.equal((await storedGuide()).flowerId, targetId);
      assert.equal((await storedGuide()).completed.includes('jury'), false);
      assert.equal((await mutations()).length, 0);
      results.push({ width, trim: 'tracked lot required, queued, running, partial and confirmed complete', noPrematureJury: true, noGameWrites: true });
      assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
    }

    // An unavailable read must not turn absence into a historical exemption.
    await load('storage', 390, 'view=workshop&section=processing');
    await page.evaluate(({ key, completed, flowerId }) => localStorage.setItem(key, JSON.stringify({ version: 2, active: true, started: true, collapsed: false, completed, flowerId })), { key: guideKey, completed: [...previousSteps, 'store'], flowerId: targetId });
    await page.reload({ waitUntil: 'networkidle0' }); await waitStep('trim');
    await page.waitForSelector('[data-trim-shared-form]', { visible: true });
    await page.waitForSelector('[data-guide-trim-flower-id="' + targetId + '"][data-guide-trim-state="required"]');
    assert.equal(new URL(page.url()).searchParams.get('flower'), null, 'Manual lot selection works without a deep link');
    await page.evaluate(() => { window.__control.staff('error'); window.__control.notify('kq:staff-updated'); });
    await page.waitForSelector('[data-workshop-trim-desk] [role="alert"]');
    assert.equal((await storedGuide()).completed.includes('trim'), false);
    await page.evaluate(id => { window.__control.staff('known'); window.__control.trim(id, 'absent'); }, targetId);
    await waitStep('cure');
    assert.equal((await storedGuide()).completed.includes('trim'), true);
    results.push({ legacyTrimExemption: true, failedReadNeverCompletesTrim: true, manualSelectionWithoutFlowerUrl: true });

    for (const width of [320, 390, 1440]) {
      await load('workday', width, 'view=hub');
      await page.waitForSelector('[data-placard-next-action][data-priority="new-culture"][data-tone="ready"]');
      await page.evaluate(() => window.__control.workHours(0.5));
      await page.waitForFunction(() => document.querySelector('[data-resume-work-notice]')?.textContent.includes('0,5 h'));
      assert(await page.$eval('[data-placard-next-action]', node => node.textContent.includes('Le lancement demande 1 h')));
      await layout(); await screenshot('guide-workday-half-hour-' + width);
      await page.evaluate(() => window.__control.workHours(0));
      await page.waitForSelector('[data-placard-next-action][data-priority="workday"]');
      await page.$eval('[data-placard-next-action]', node => node.scrollIntoView({ block: 'center' }));
      await layout(); await screenshot('guide-workday-exhausted-' + width);
      await page.evaluate(() => { window.__control.staff('error'); window.__control.notify('kq:staff-updated'); });
      await page.waitForFunction(() => document.querySelector('[data-resume-work-notice]')?.textContent.includes('restent à vérifier'));
      assert.equal(await page.$('[data-placard-next-action][data-priority="workday"]'), null);
      await page.evaluate(() => { window.__control.staff('known'); window.__control.nextWorkday(); });
      await page.waitForSelector('[data-placard-next-action][data-priority="new-culture"][data-tone="ready"]');
      assert.equal(await page.$('[data-resume-work-notice]'), null);
      assert.equal((await mutations()).length, 0);
      results.push({ width, hours: '12, 0.5, 0, failed read then next server day', sameAllowanceAsGauge: true, noGameWrites: true });
    }

    await load('preparation', 320);
    await openGuide();
    await visitChapter('Culture');
    await page.waitForSelector('[data-culture-selection], [data-culture-preparation]');
    await page.evaluate(key => localStorage.setItem(key, '{broken'), guideKey);
    await page.reload({ waitUntil: 'networkidle0' }); await assertNoGuide();
    await openGuide(); await page.waitForSelector('[data-farm-guide]');
    await page.waitForFunction(() => document.querySelector('[data-farm-guide]')?.textContent.includes('ne peut pas être enregistrée'));
    await keyClick('[data-farm-guide] button[aria-controls]');
    await keyClick('[data-farm-guide-close]'); await openGuide();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), guideKey), '{broken', 'Opening, minimizing and closing never overwrite an unreadable save');
    assert.equal((await mutations()).length, 0);
    results.push({ unreadableSavePreserved: true });
  }
  if (!cultureCarouselOnly && !cultureWorkOnly && !sharedTrimOnly && !storageOnly && !guideOnly && !workshopOnly && !staffGuideOnly && !workPlanOnly && !financialSupportOnly) {
  for (const width of [1440, 390, 320]) {
    await load('preparation', width); const expected = await prepare(); await openPlan(); await layout();
    await screenshot('plan-return-' + width); await keyClick('[data-placard-back="game"]');
    await assertPreparation(expected); await screenshot('preparation-restored-' + width);
    results.push({ scenario: 'custom deck and heritage preserved across plan and return button', width });
    console.log('Preparation preserved at ' + width + 'px');
  }
  await load('preparation'); let expected = await prepare(); await openPlan();
  await page.goBack({ waitUntil: 'networkidle0' }); await assertPreparation(expected);
  results.push({ scenario: 'browser Back restores the preparation without launching' });
  await load('preparation'); expected = await prepare(); await openPlan();
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('[data-placard-back="game"]'); await keyClick('[data-placard-back="game"]');
  await assertPreparation(expected); results.push({ scenario: 'tab reload during plan preserves owner-scoped preparation' });
  await load('preparation'); expected = await prepare(); await openPlan();
  await keyClick('[data-warehouse-campaign-action="start"]'); await assertPreparation(expected);
  results.push({ scenario: 'warehouse launch CTA returns to preserved choices without submitting a culture' });
  await load('preparation', 320); expected = await prepare({ empty: true, noHeritage: true }); await openPlan(); await keyClick('[data-placard-back="game"]');
  await assertPreparation(expected); results.push({ scenario: 'deliberate empty deck and Sans Héritage remain empty' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.removeCopies('BOTTE-005'));
  await keyClick('[data-placard-back="game"]'); await assertPreparation({ ...expected, selected: expected.selected.filter(code => code !== 'BOTTE-005') });
  assert(await page.$('[data-preparation-adjusted]'));
  results.push({ scenario: 'confirmed inventory reduction removes only unavailable selected copies' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.heritage('empty'));
  await keyClick('[data-placard-back="game"]'); await assertPreparation({ ...expected, heritageText: 'Sans Héritage' });
  assert(await page.$('[data-preparation-adjusted]')); results.push({ scenario: 'confirmed missing heritage clears only unavailable heritage with notice' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.collection('pending'));
  await keyClick('[data-placard-back="game"]'); await page.waitForSelector('[data-culture-selection]');
  assert.deepEqual(await rememberedDeck(), expected.selected, 'Pending inventory never clears remembered cards');
  await page.evaluate(() => window.__control.resolve()); await assertPreparation(expected);
  results.push({ scenario: 'pending collection preserves remembered choices until confirmed' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.collection('error'));
  await keyClick('[data-placard-back="game"]'); await page.waitForFunction(() => document.body.textContent.includes('Collection temporairement indisponible.'));
  assert.deepEqual(await rememberedDeck(), expected.selected); assert.equal((await mutations()).length, 0);
  await page.evaluate(() => window.__control.collection('known')); await keyClick('[data-culture-selection] button'); await assertPreparation(expected);
  results.push({ scenario: 'failed collection read never clears remembered cards' });
  await load('preparation'); expected = await prepare();
  // Culture deliberately hides mobile navigation; leave through its warehouse return.
  await openPlan();
  await button('Récoltes', 'nav[aria-label="Accès rapides de Kanab Quest"]'); await button('Jury & duels', '[data-placard-harvests]');
  await page.waitForSelector('[data-placard-view="arena"]'); await settled();
  await button('Culture', 'nav[aria-label="Accès rapides de Kanab Quest"]'); await assertPreparation(expected, false);
  results.push({ scenario: 'visiting the arena does not overwrite the saved preparation on return to culture' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.launch());
  const launched = (await fixture()).production.game;
  await keyClick('[data-placard-back="game"]');
  await page.waitForFunction(() => document.querySelector('[data-culture-play]') || [...document.querySelectorAll('[data-culture-selection] button')].some(node => !node.disabled && node.getClientRects().length));
  if (!await page.$('[data-culture-play]')) await keyClick('[data-culture-selection] button');
  await page.waitForSelector('[data-culture-play]', { visible: true });
  assert.equal(await page.$eval('[data-culture-play]', node => node.dataset.cultureRun), launched.campaign.leaderRunId);
  assert.deepEqual((await fixture()).production.game, launched); assert.equal((await mutations()).length, 0);
  results.push({ scenario: 'a culture already started elsewhere is resumed without applying the remembered preparation' });
  }
  if (!cultureCarouselOnly && !cultureWorkOnly && !sharedTrimOnly && !preparationOnly && !guideOnly && !workshopOnly && !staffGuideOnly && !workPlanOnly && !financialSupportOnly) {
  for (const width of [1440, 390, 320]) {
    await load('storage', width); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
    const before = await fixture(); await page.evaluate(() => window.__control.storageDelay(220));
    await keyClick(`[data-harvest-open-storage="${targetId}"]`);
    await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`, { visible: true });
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-conservation-lot') === id, {}, targetId);
    await visibleBelowHeader(`[data-conservation-lot="${targetId}"]`);
    assert.equal(new URL(page.url()).searchParams.get('flower'), targetId);
    assert.equal(await page.$(`[data-conservation-lot="${decoyId}"][data-selected="true"]`), null);
    await layout(); await screenshot('exact-storage-' + width);
    await keyClick('[data-harvest-overview]'); await page.waitForSelector(`[data-harvest-id="${targetId}"]`, { visible: true });
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-harvest-id') === id, {}, targetId);
    await visibleBelowHeader(`[data-harvest-id="${targetId}"]`);
    assert.deepEqual((await fixture()).production, before.production); assert.equal((await mutations()).length, 0);
    results.push({ scenario: 'homonymous harvest → exact storage lot → focused harvest row', width });
    console.log('Exact storage and return focus verified at ' + width + 'px');
  }
  for (const state of ['missing', 'error', 'malformed']) {
    await load('storage'); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
    await page.evaluate(state => window.__control.storage(state), state); await keyClick(`[data-harvest-open-storage="${targetId}"]`);
    await page.waitForSelector(`[data-storage-selection="${state === 'missing' ? 'missing' : 'unavailable'}"]`, { visible: true });
    assert.equal(await page.$('[data-conservation-lot][data-selected="true"]'), null, 'Unavailable target never selects a homonym');
    await layout(); await screenshot('storage-' + state + '-390');
    await page.evaluate(() => window.__control.storage('known')); await keyClick('[data-storage-selection-retry]');
    await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`, { visible: true });
    assert.equal((await mutations()).length, 0); results.push({ scenario: 'storage ' + state + ': explicit state, read-only retry restores target' });
  }
  await load('storage', 320); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
  await page.evaluate(() => window.__control.storageDelay('pending')); await keyClick(`[data-harvest-open-storage="${targetId}"]`);
  await page.waitForSelector('[data-storage-selection="loading"]', { visible: true });
  assert.equal(await page.$('[data-conservation-lot][data-selected="true"]'), null);
  await page.evaluate(() => window.__control.resolve());
  await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`);
  await page.goBack({ waitUntil: 'networkidle0' });
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-harvest-id') === id, {}, targetId);
  assert.equal((await mutations()).length, 0); results.push({ scenario: 'pending storage never means missing; browser Back focuses originating row' });
  await load('storage-overflow', 390); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
  await keyClick(`[data-harvest-open-storage="${targetId}"]`);
  await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`);
  assert.equal((await mutations()).length, 0); results.push({ scenario: 'Protéger le surplus targets the exact homonymous lot without buying or selling' });
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors'); assert.deepEqual(forbiddenRequests, [], 'No remote or real API requests');
  assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: true, checks: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: results.length, output }));
} catch (error) {
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {}); await writeFile(resolve(output, 'failure.html'), await page.content()).catch(() => {}); }
  const calls = page ? await page.evaluate(() => window.__calls).catch(() => []) : [];
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: false, results, error: String(error.stack ?? error), errors, forbiddenRequests, calls }, null, 2)); throw error;
} finally { if (!preview) { await browser?.close(); await server.close(); } }
