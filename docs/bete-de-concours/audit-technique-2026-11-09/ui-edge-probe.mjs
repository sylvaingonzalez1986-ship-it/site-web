/** Real player Shell, preparation and storage; every API operation stays in memory. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'docs/bete-de-concours/audit-technique-2026-11-09/browser-journey');
const port = Number(process.env.KQ_JOURNEY_PORT ?? 3436), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const preparationOnly = process.argv.includes('--preparation-only'), storageOnly = process.argv.includes('--storage-only');
const guideNavigationOnly = process.argv.includes('--guide-navigation-only');
const guideCompletionOnly = process.argv.includes('--guide-completion-only');
const guideOnly = guideNavigationOnly || guideCompletionOnly || process.argv.includes('--guide-only'), workshopOnly = process.argv.includes('--workshop-only'), staffGuideOnly = process.argv.includes('--staff-guide-only');
const workPlanOnly = process.argv.includes('--work-plan-only');
const financialSupportOnly = process.argv.includes('--financial-support-only');
const sharedTrimOnly = process.argv.includes('--shared-trim-only');
const cultureWorkOnly = process.argv.includes('--culture-work-only');
const cultureRelayOnly = process.argv.includes('--culture-relay-only');
const cultureCarouselVisualOnly = process.argv.includes('--culture-carousel-visual-only');
const cultureQualityOnly = process.argv.includes('--culture-quality-only');
const cultureBadgesOnly = process.argv.includes('--culture-badges-only');
const cultureCarouselOnly = cultureBadgesOnly || cultureQualityOnly || cultureCarouselVisualOnly || process.argv.includes('--culture-carousel-only');
const reportName = cultureRelayOnly ? 'culture-relay-report.json' : cultureBadgesOnly ? 'culture-badges-report.json' : cultureQualityOnly ? 'culture-quality-report.json' : cultureCarouselVisualOnly ? 'culture-carousel-visual-report.json' : cultureCarouselOnly ? 'culture-carousel-report.json' : cultureWorkOnly ? 'culture-work-report.json' : sharedTrimOnly ? 'shared-trim-report.json' : financialSupportOnly ? 'financial-support-report.json' : workPlanOnly ? 'work-plan-report.json' : staffGuideOnly ? 'staff-guide-report.json' : workshopOnly ? 'workshop-report.json' : guideCompletionOnly ? 'guide-completion-report.json' : guideNavigationOnly ? 'guide-navigation-report.json' : guideOnly ? 'guide-report.json' : preparationOnly ? 'preparation-report.json' : storageOnly ? 'storage-report.json' : 'report.json';
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
if(${cultureRelayOnly}){
 const candidate=projectKqStaffSnapshot(staffRaw).candidates[0];
 staffRaw.state=applyKqStaffCommand(staffRaw,{action:'hire',candidateCode:candidate.code,contract:'cdi',weeklyHours:35,durationMonths:0,reason:'permanent',expectedMonthlyCostCents:getKqStaffMonthlyCost(candidate,35).totalCents},'${planEmployeeId}').state;
 staffRaw.context.cultureWorkVersion=1;
 staffRaw.context.activeRuns=[{id:production.game.campaign.leaderRunId,name:'Culture locale',startedAt:staffNow}];
 staffRaw.state=applyKqStaffCommand(staffRaw,{action:'assign',employeeId:'${planEmployeeId}',kind:'culture',hours:1,targetId:production.game.campaign.leaderRunId},'relay-culture-task').state;
 const relayCase=new URLSearchParams(location.search).get('relayCase');
 if(relayCase==='employee-exhausted'||relayCase==='both-exhausted')staffRaw.state.tasks.find(task=>task.id==='relay-culture-task').cultureUsedHours=1;
 if(relayCase==='player-exhausted'||relayCase==='both-exhausted')staffRaw.state.playerWorkDays['1']={usedHours:11.75};
}
staffRaw.context.trimQueueVersion=2;staffRaw.context.trimLots=staffRaw.context.trimLots.map((lot,index)=>({...lot,totalGrams:360,completedGrams:0,createdAt:new Date(Date.parse(staffNow)-(2-index)*60000).toISOString()}));
const lots=[{...baseStorage.lots[0],flowerId:decoyId,varietyName:'Cherry Abacus'},{...baseStorage.lots[0],flowerId:targetId,varietyName:'Cherry Abacus'}];
const storageSnapshot=()=>({...baseStorage,lots:storageScenario?lots:[]});
let storageMode='known',collectionMode='known',heritageMode='known',staffMode='known',storageDelay=0,allowPlay=false,actionMode='known',careMode=new URLSearchParams(location.search).get('careMode')??'known',careMutationMode='known';
const deferred=[];window.__calls=[];window.__unexpected=[];
const cultureWorkSteps=new Set();
const cultureWorkReceipts=new Map();
const pendingWorkQuotes=[];let nextWorkQuoteMode='known';
const zeroWorkBonus={vitality:0,terpenes:0,yieldPercent:0,cannabinoids:0};
const workQuote=(workChoice='auto')=>{
 const game=production.game,day=projectKqStaffSnapshot(staffRaw).calendar.day;
 const used=staffRaw.state.playerWorkDays[String(day)]?.usedHours??0,playerRemainingHours=Number((12-used).toFixed(2));
 const runId=game.campaign.leaderRunId,paid=cultureWorkSteps.has(runId+':'+game.stageIndex);
 const receipt=cultureWorkReceipts.get(runId+':'+game.stageIndex);
 const choices=[{choice:'player',source:'player',employee:null,available:playerRemainingHours>=.5,bonus:zeroWorkBonus,reason:playerRemainingHours>=.5?null:'Temps personnel épuisé.'}];
 if(${cultureRelayOnly}){
  const worker=staffRaw.state.employees[0],task=staffRaw.state.tasks.find(task=>task.id==='relay-culture-task');
  const remainingHours=task.hours-(task.cultureUsedHours??0);
  const employee={id:worker.id,name:worker.name,code:worker.code,portraitCode:worker.portraitCode,level:4,role:worker.role,taskId:task.id,allocatedHours:task.hours,usedHours:task.cultureUsedHours??0,remainingHours};
  choices.push({choice:'employee:'+worker.id,source:'employee',employee,available:remainingHours>=.5,bonus:{vitality:3,terpenes:2,yieldPercent:4,cannabinoids:1},reason:remainingHours>=.5?null:'Budget Culture épuisé.'});
 }
 const selected=receipt?{...receipt,employee:choices.find(choice=>choice.choice===receipt.choice)?.employee??null}:(workChoice==='auto'?choices.find(choice=>choice.source==='employee'&&choice.available)??choices.find(choice=>choice.source==='employee')??choices[0]:choices.find(choice=>choice.choice===workChoice));
 const choice=selected??{source:'blocked',employee:null,bonus:zeroWorkBonus,available:false,reason:'Intervenant indisponible.'};
 return {version:1,runId,stageIndex:game.stageIndex,day,phase:game.phase,source:paid||choice.available?choice.source:'blocked',paid,stepHours:.5,playerRemainingHours,employee:choice.employee,bonus:choice.bonus,reason:choice.reason??null,...(${cultureRelayOnly}?{workChoice,choices:paid||game.phase!=='prepare'?[]:choices}:{})};
};
const transport=createReleveCultureTransport({getState:()=>production,setState:next=>production=next});
const response=(body,status=200)=>Response.json(body,{status});
const projectSoloSession=payload=>{if(scenario==='culture-carousel-solo')for(const run of [payload.activeRun,...payload.activeRuns??[]])if(run)delete run.state.campaign;return payload};
const request=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method??'GET',body=init.body?JSON.parse(init.body):null;
 window.__calls.push({path,method,body,...(${cultureBadgesOnly || cultureRelayOnly}?{query:url.search}:{})});
 if(path.endsWith('/staff')&&window.__staffDiagnostic&&method==='POST') { window.__staffCommand=body;window.__staffSignal=Boolean(init.signal);if(window.__staffDiagnostic==='401')return response({error:'Non autorisé.'},401);if(window.__staffDiagnostic==='lost')throw Error('Réponse interrompue (simulation locale).');if(window.__staffDiagnostic==='pending')return new Promise(()=>{}); }
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
  const quote=workQuote(url.searchParams.get('workChoice')??'auto'),mode=nextWorkQuoteMode;nextWorkQuoteMode='known';
  if(mode==='pending')await new Promise(done=>pendingWorkQuotes.push(done));
  if(mode==='error')return response({error:'Devis Culture temporairement indisponible.'},503);
  return response(quote);
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
 const rollWork=permittedPlay&&body?.action==='roll'&&${cultureRelayOnly}?workQuote(body.workChoice??'auto'):null;
 if(rollWork&&(rollWork.source==='blocked'||body.expectedStageIndex!==production.game.stageIndex))return response({error:'Intervenant indisponible ou étape modifiée.'},409);
 const received=await transport(input,init);
 if(${cultureBadgesOnly}&&permittedPlay&&path.endsWith('/care')&&careMutationMode==='lost'&&received.ok){careMutationMode='known';throw Error('Réponse de soin interrompue après validation locale.');}
 if(scenario==='culture-carousel-solo'&&method==='GET'&&(/\\/(session|runs)$/.test(path)))return response(projectSoloSession(await received.json()),received.status);
 if(permittedPlay&&received.ok&&body?.action==='roll'&&workKey&&!cultureWorkSteps.has(workKey)){
  cultureWorkSteps.add(workKey);
  if(rollWork?.source==='employee')staffRaw.state.tasks.find(task=>task.id===rollWork.employee.taskId).cultureUsedHours+=.5;
  else{const day=projectKqStaffSnapshot(staffRaw).calendar.day;const used=staffRaw.state.playerWorkDays[String(day)]?.usedHours??0;staffRaw.state.playerWorkDays[String(day)]={usedHours:used+.5}}
  if(rollWork)cultureWorkReceipts.set(workKey,{choice:rollWork.source==='player'?'player':'employee:'+rollWork.employee.id,source:rollWork.source,employee:rollWork.employee,bonus:rollWork.bonus,available:true});
 }
 if(!received.ok)window.__unexpected.push({path,method,status:received.status});return received;
};
const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>new URL(typeof input==='string'?input:input.url,location.origin).pathname.startsWith('/api/')?request(input,init):originalFetch(input,init);
const api=createKqTutorialApi(request,{nativeWarehouse:true});api.isTutorial=false;
window.__fixture=()=>structuredClone({scenario,initial,production,lots,storageMode,collectionMode,heritageMode,staffRaw,...(${cultureRelayOnly}?{workReceipts:[...cultureWorkReceipts.values()],pendingWorkQuotes:pendingWorkQuotes.length}:{})});
window.__control={allowPlay:value=>allowPlay=value,storageLot:(id,patch)=>Object.assign(lots.find(lot=>lot.flowerId===id).projection,patch),storage:mode=>storageMode=mode,storageDelay:value=>storageDelay=value,collection:mode=>collectionMode=mode,heritage:mode=>heritageMode=mode,staff:mode=>staffMode=mode,removeCopies:code=>{production.supportInventory[code]=0},launch:()=>act({type:'launch'}),resolve:()=>{storageDelay=0;collectionMode='known';if(staffMode==='pending')staffMode='known';deferred.splice(0).forEach(done=>done())},notify:name=>api.notify(name)};
window.__control.workHours=remaining=>{const day=projectKqStaffSnapshot(staffRaw).calendar.day;staffRaw.state.playerWorkDays[String(day)]={usedHours:12-remaining};api.notify('kq:staff-updated')};
window.__control.employeeWorkHours=remaining=>{const task=staffRaw.state.tasks.find(task=>task.id==='relay-culture-task');task.cultureUsedHours=task.hours-remaining;api.notify('kq:staff-updated')};
window.__control.workQuoteMode=mode=>nextWorkQuoteMode=mode;
window.__control.releaseWorkQuotes=()=>pendingWorkQuotes.splice(0).forEach(done=>done());
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
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output, 'chromium-probe-profile'), args: ['--no-sandbox', '--disable-gpu', '--disable-background-networking'] });
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
  await load('workshop', 320, 'view=workshop&section=processing&workshop=trim&flower='+targetId);
  await page.waitForSelector('[data-trim-shared-form]', {visible: true});
  await keyClick('[data-placard-back="hub"]');
  await page.waitForSelector('[data-placard-view="hub"]');
  await settled();
  await new Promise(resolve=>setTimeout(resolve,500));
  results.push({scenario:'Keyboard section back to hub', viewport:320, focus:await page.evaluate(()=>({tag:document.activeElement.tagName, text:document.activeElement.textContent?.slice(0,100), html:document.activeElement.outerHTML.slice(0,240)}))});
  await screenshot('probe-back-hub-320');
  await load('workshop', 320, 'view=workshop&section=processing&workshop=trim&flower='+targetId);
  await page.waitForSelector('[data-trim-shared-form]', {visible: true});
  await page.evaluate(()=>window.__staffDiagnostic='lost');
  await button('Vérifier le trim', '[data-workshop-trim-desk]');
  await page.waitForSelector('dialog[open] #staff-confirm-title');
  await keyClick('dialog[open] button:last-child');
  await page.waitForSelector('dialog[open] [role="alert"]');
  const firstCommand=await page.evaluate(()=>window.__staffCommand);
  await screenshot('probe-staff-lost-response-320');
  await button('Annuler','dialog[open]');
  await button('Vérifier le trim', '[data-workshop-trim-desk]');
  await page.waitForSelector('dialog[open] #staff-confirm-title');
  await keyClick('dialog[open] button:last-child');
  await page.waitForSelector('dialog[open] [role="alert"]');
  const secondCommand=await page.evaluate(()=>window.__staffCommand);
  results.push({scenario:'Lost staff response then Cancel and retry', firstCommand, secondCommand, changedKey:firstCommand.requestKey!==secondCommand.requestKey});
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-trim-shared-form]',{visible:true});
  results.push({scenario:'Reload after unacknowledged staff command', hasRecoveryDialog:await page.$('dialog[open]')!==null, storedKeys:await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}))});
  await page.evaluate(()=>window.__staffDiagnostic='401');
  await button('Vérifier le trim', '[data-workshop-trim-desk]');
  await page.waitForSelector('dialog[open] #staff-confirm-title');
  await keyClick('dialog[open] button:last-child');
  await page.waitForSelector('dialog[open] [role="alert"]');
  results.push({scenario:'Staff response 401', dialog:await page.$eval('dialog[open]',node=>node.innerText), loginLinks:await page.$$eval('a[href*="connexion"]',nodes=>nodes.length)});
  await screenshot('probe-staff-401-320');
  await button('Annuler','dialog[open]');
  await page.evaluate(()=>window.__staffDiagnostic='pending');
  await button('Vérifier le trim', '[data-workshop-trim-desk]');
  await page.waitForSelector('dialog[open] #staff-confirm-title');
  await keyClick('dialog[open] button:last-child');
  await page.keyboard.press('Escape');
  results.push({scenario:'Staff response held pending, Escape', dialogOpen:await page.$('dialog[open]')!==null, buttons:await page.$$eval('dialog[open] button',nodes=>nodes.map(node=>({text:node.innerText,disabled:node.disabled}))), requestHasAbortSignal:await page.evaluate(()=>window.__staffSignal)});
  assert.deepEqual(errors, [], 'No uncaught browser errors'); assert.deepEqual(forbiddenRequests, [], 'No remote or real API requests');
  assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: true, checks: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: results.length, output }));
} catch (error) {
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {}); await writeFile(resolve(output, 'failure.html'), await page.content()).catch(() => {}); }
  const calls = page ? await page.evaluate(() => window.__calls).catch(() => []) : [];
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: false, results, error: String(error.stack ?? error), errors, forbiddenRequests, calls }, null, 2)); throw error;
} finally { if (!preview) { await browser?.close(); await server.close(); } }
