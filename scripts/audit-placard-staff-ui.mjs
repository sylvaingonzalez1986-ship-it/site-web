/** Staff UI against the real deterministic engine; transport and money stay in memory. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-staff-ui');
const origin = 'http://127.0.0.1:3438';
const benefitsOnly = process.argv.includes('--benefits-only');
const impactDashboardOnly = process.argv.includes('--impact-dashboard-only');
const workPlanOnly = process.argv.includes('--work-plan-only');
const workSceneOnly = process.argv.includes('--work-scene-only');
const workScenePreview = workSceneOnly && process.argv.includes('--preview');
const prospectingOnly = process.argv.includes('--prospecting-only');
const playerWorkOnly = process.argv.includes('--player-work-only');
const visualClarityOnly = process.argv.includes('--visual-clarity-only');
const helpOnly = process.argv.includes('--help-dashboards-only');
const dashboardOnly = process.argv.includes('--dashboard-only') || helpOnly;
// The former exclusive-lot motion/portrait recipes now run the shared-stock
// workflow, including identity failures and the same animation lifecycle.
const trimMotionAlias = process.argv.includes('--trim-motion-only') || process.argv.includes('--trim-portraits-only');
const staffMomentsOnly = process.argv.includes('--staff-moments-only');
const archiveOnly = process.argv.includes('--archive-only');
const contractLifecycleOnly = process.argv.includes('--contract-lifecycle-only');
const employeeSheetOnly = process.argv.includes('--employee-sheet-only') || contractLifecycleOnly;
const weeklyPlanOnly = process.argv.includes('--weekly-plan-only');
const cultureWorkOnly = process.argv.includes('--culture-work-only');
const processingWorkOnly = process.argv.includes('--processing-work-only');
const sharedTrimEdgeOnly = process.argv.includes('--shared-trim-edge-only');
const sharedTrimOnly = process.argv.includes('--shared-trim-only') || sharedTrimEdgeOnly || trimMotionAlias;
const reportName = impactDashboardOnly ? 'impact-dashboard-report.json' : benefitsOnly ? 'benefits-report.json' : contractLifecycleOnly ? 'contract-lifecycle-report.json' : helpOnly ? 'help-dashboard-report.json' : dashboardOnly ? 'dashboard-report.json' : processingWorkOnly ? 'processing-work-report.json' : cultureWorkOnly ? 'culture-work-report.json' : weeklyPlanOnly ? 'weekly-plan-report.json' : employeeSheetOnly ? 'employee-sheet-report.json' : sharedTrimEdgeOnly ? 'shared-trim-edge-report.json' : sharedTrimOnly ? 'shared-trim-report.json' : archiveOnly ? 'archive-report.json' : workScenePreview ? 'work-scene-preview-report.json' : workSceneOnly ? 'work-scene-report.json' : staffMomentsOnly ? 'staff-moments-report.json' : visualClarityOnly ? 'visual-clarity-report.json' : playerWorkOnly ? 'player-work-report.json' : prospectingOnly ? 'prospecting-report.json' : workPlanOnly ? 'work-plan-report.json' : 'report.json';
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {KqStaffDesk} from '/src/components/placard/KqStaffDesk';
import {KqPlayerWorkStatus} from '/src/components/placard/KqPlayerWorkStatus';
import {KqCultureWorkStatus,useKqCultureWorkQuote} from '/src/components/placard/KqCultureWorkStatus';
import {getKqPlayerWorkErrorMessage} from '/src/lib/kanab-quest-player-work-errors';
import {KqWorkshopTrimDesk} from '/src/components/placard/KqWorkshopTrimDesk';
import {KqCommerceDesk} from '/src/components/placard/KqCommerceDesk';
import {createKqProcessingPlan} from '/src/lib/kanab-quest-processing-profiles';
import {createKqOperationsLesson,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqStaffState,projectKqStaffSnapshot,applyKqStaffCommand,advanceKqStaff,getKqStaffMonthlyCost,getKqStaffTrainingCost,getKqStaffLevel,getKqStaffCapacity,KQ_STAFF_CITIES} from '/src/lib/kanab-quest-staff';
import {getKqStaffPlannedTaskCost,getKqStaffWeeklyCost} from '/src/lib/kanab-quest-staff-weekly';
import {KQ_GAME_DAY_MS} from '/src/lib/kanab-quest-business';
import {parseChanvrierProfile,DEFAULT_CHANVRIER_APPEARANCE} from '/src/lib/arena-chanvrier';
const now='2026-11-07T12:00:00.000Z';
const playerProfile=parseChanvrierProfile({nickname:'Sylvain',gender:'male',skin:'peach',clothing:'teal',strength:'green-thumb',appearance:{...DEFAULT_CHANVRIER_APPEARANCE,hair:'quiff',facialHair:'none'}});
if(!playerProfile)throw Error('Invalid audit player profile');
let profileState=new URLSearchParams(location.search).get('profile')??'ready',profileReads=0;
let raw={state:createKqStaffState(now),revision:0,serverNow:now,cashCents:2500000,context:{businessStartedAt:now,reputation:800,instagramFollowers:3500,shopPartners:2,activeRuns:[{id:'test-run',name:'Culture de démonstration'}],processingBatches:[{id:'test-batch',flowerId:'test-flower',name:'Lot de démonstration',startedAt:now,readyAt:'2026-11-09T12:00:00.000Z'}],supplierInvoices:[],trimLots:[{flowerId:'trim-manual',name:'Récolte pour trim manuel',requiredWork:6,completedWork:0,mode:null,completedAt:null},{flowerId:'trim-machine',name:'Récolte pour trim machine',requiredWork:6,completedWork:0,mode:null,completedAt:null}]}};
raw.context.trimQueueVersion=2;raw.context.trimLots=raw.context.trimLots.map((lot,index)=>({...lot,totalGrams:360,completedGrams:0,createdAt:new Date(Date.parse(now)-(2-index)*60000).toISOString()}));
if(${benefitsOnly}||(${impactDashboardOnly}&&!new URLSearchParams(location.search).has('empty'))||(${dashboardOnly}&&new URLSearchParams(location.search).get('dashboard')!=='empty')||${processingWorkOnly}||${cultureWorkOnly}||${weeklyPlanOnly}||${employeeSheetOnly}||${sharedTrimOnly}||${workPlanOnly}||${workSceneOnly}||(${visualClarityOnly}&&new URLSearchParams(location.search).has('team'))){
 for(const code of ['anna','mael']){const candidate=projectKqStaffSnapshot(raw).candidates.find(candidate=>candidate.code===code),temporary=(${employeeSheetOnly}||${weeklyPlanOnly})&&code==='mael',weeklyHours=temporary?14:35;raw.state=applyKqStaffCommand(raw,{action:'hire',candidateCode:code,contract:temporary?'cdd':'cdi',weeklyHours,durationMonths:temporary?3:0,reason:temporary?'temporary-increase':'permanent',expectedMonthlyCostCents:getKqStaffMonthlyCost(candidate,weeklyHours).totalCents},'work-plan-'+code).state}
 raw.context.activeRuns.push({id:'test-run-selected',name:'Culture choisie pour Maël'});
 raw.context.processingBatches.push({id:'test-batch-selected',flowerId:'test-flower-selected',name:'Lot choisi pour Anna',startedAt:now,readyAt:'2026-11-09T12:00:00.000Z'});
}
if(${employeeSheetOnly})raw.state.employees[0].skills={culture:100,processing:900,communication:2500,sales:4900,administration:8100};
if(${contractLifecycleOnly}){raw.context.contractLifecycleVersion=1;raw.context.contractCooldowns={worker:new Date(Date.parse(now)+4*KQ_GAME_DAY_MS).toISOString()};raw.context.weeklyPlanVersion=1;raw.archiveCount=2;}
if(${cultureWorkOnly}){raw.context.cultureWorkVersion=1;raw.context.weeklyPlanVersion=1;raw.context.activeRuns=[];}
if(${processingWorkOnly}){raw.context.processingWorkVersion=1;raw.context.weeklyPlanVersion=1;raw.context.processingBatches=[];}
if(${benefitsOnly}||${impactDashboardOnly}){
 const params=new URLSearchParams(location.search);raw.context.cultureWorkVersion=1;raw.context.processingWorkVersion=1;raw.context.weeklyPlanVersion=1;
 if(raw.state.employees[0]){raw.state.employees[0].skills={culture:1600,processing:1600,communication:1600,sales:1600,administration:1600};raw.state.employees[0].trait='organized';}
 if(!params.has('legacy'))raw.context.staffBenefitsVersion=1;
 raw.state.supplierDiscountPercent=6;raw.state.supplierDiscountUntil=new Date(Date.parse(now)+7*KQ_GAME_DAY_MS).toISOString();
 if(!params.has('unknown'))raw.benefits={trackedSince:now,supplierSavingsCents:1320,supplierBaseCents:22000,supplierNetCents:20680,discountedInvoices:1,followersGained:52,partnersGained:2,invoicesPaidCount:1,invoicesPaidCents:20680,payrollPaidCount:0,payrollPaidCents:0,cultureHoursDelegated:3,processingHoursDelegated:2,processingSecondsSaved:0,trimGrams:100,lastBenefitAt:now,lastAdministration:null};
}
if(${impactDashboardOnly}&&raw.state.employees.length){
 const anna='work-plan-anna',mael='work-plan-mael',task=(id,employeeId,kind,hours,extra={})=>({id,employeeId,kind,skill:kind==='training'?'processing':kind==='trim'?'processing':kind,hours,day:1,startedAt:now,completesAt:new Date(Date.parse(now)+2*60*60*1000).toISOString(),status:'running',trainingCostCents:0,skillLevel:2,...extra});
 raw.state.tasks=[task('impact-culture',anna,'culture',3,{cultureShift:true,cultureUsedHours:1}),task('impact-processing',anna,'processing',2,{processingShift:true,processingUsedHours:.5}),task('impact-training',anna,'training',2,{status:'completed',trainingCostCents:7000,completesAt:now,result:{version:1,xpGained:12}}),task('impact-communication',mael,'communication',2),task('impact-trim',mael,'trim',1,{trimQueue:true,trimMode:'manual',trimGrams:25,trimRateGramsPerHour:90,trimProgressAt:now,trimContributions:[{flowerId:'trim-manual',grams:25}]}),task('impact-administration',mael,'administration',.5),task('impact-sales',mael,'sales',2,{cityId:'brest',salesAttempts:1,successChance:30}),task('impact-player','player','communication',4,{status:'completed',completesAt:now,result:{version:1,followersOffered:999}}),task('impact-previous-day',anna,'culture',6,{day:0,status:'completed',completesAt:now})];
 raw.state.employees[0].workDays['1']={usedHours:7,extraHours:0};raw.state.employees[1].workDays['1']={usedHours:5.5,extraHours:0};
 raw.state.tasks.find(row=>row.id==='impact-trim').trimQualityDelta=2;raw.context.trimLots[0].completedGrams=25;raw.context.trimLots[0].completedWork=25/60;raw.context.trimLots[0].mode='manual';
 const plans=[[[{kind:'culture',hours:3},{kind:'processing',hours:2}],[{kind:'trim',hours:1,trimMode:'manual'},{kind:'communication',hours:2}],[{kind:'administration',hours:.5},{kind:'training',skill:'processing',hours:2}],[{kind:'sales',cityId:'brest',hours:2}],[]],[[{kind:'culture',hours:1},{kind:'communication',hours:3}],[{kind:'sales',cityId:'brest',hours:2},{kind:'administration',hours:1}],[{kind:'training',skill:'culture',hours:2}],[{kind:'trim',hours:2,trimMode:'manual'}],[{kind:'processing',hours:3}]]];
 raw.state.employees.forEach((employee,index)=>{const days=plans[index].map(day=>day.map(slot=>({...slot,costCents:getKqStaffPlannedTaskCost(slot)})));employee.weeklyPlan={enabled:true,days,nextDay:2,updatedAt:now,weeklyCostCents:getKqStaffWeeklyCost(days),history:[]}});
}
if(${dashboardOnly}){
 const scenario=new URLSearchParams(location.search).get('dashboard');raw.context.weeklyPlanVersion=1;
 raw.state.playerWorkDays['1']={usedHours:3.5};
 raw.state.employees.forEach((employee,index)=>{employee.workDays['1']={usedHours:index?1.5:2.5,extraHours:0}});
 if(scenario==='weekend'){raw.serverNow=new Date(Date.parse(now)+5*KQ_GAME_DAY_MS).toISOString();raw.state.playerWorkDays['6']={usedHours:12}}
 if(scenario==='payroll')raw.state.payroll.push({id:'dashboard-unpaid',employeeId:raw.state.employees[0].id,dueAt:now,grossCents:10000,employerCents:3500,indemnityCents:0,totalCents:13500,paidCents:3500});
}
let cultureMode=new URLSearchParams(location.search).get('culture-status')??'employee',cultureReads=0;
const cultureQuote=()=>({version:1,runId:'test-run',stageIndex:0,day:1,phase:cultureMode==='legacy'?'rolled':'prepare',source:cultureMode==='blocked'?'blocked':cultureMode==='player'||cultureMode==='legacy'?'player':'employee',paid:false,stepHours:cultureMode==='invalid'?1:0.5,playerRemainingHours:10,employee:cultureMode==='player'||cultureMode==='legacy'?null:{id:'work-plan-anna',name:'Anna',code:'anna',level:2,role:'worker',taskId:'culture-budget',allocatedHours:2,usedHours:cultureMode==='blocked'?2:.5,remainingHours:cultureMode==='blocked'?0:1.5},bonus:{vitality:1,terpenes:1,yieldPercent:2,cannabinoids:1},reason:cultureMode==='legacy'?'Étape déjà engagée avant ce suivi : aucun nouveau débit.':cultureMode==='blocked'?'La réserve Culture est épuisée.':undefined});
if(${weeklyPlanOnly}){if(!new URLSearchParams(location.search).has('no-weekly'))raw.context.weeklyPlanVersion=1;raw.context.activeRuns.forEach(run=>run.startedAt=now)}
if(${prospectingOnly}){
 const candidate=projectKqStaffSnapshot(raw).candidates.find(candidate=>candidate.code==='ines');raw.state=applyKqStaffCommand(raw,{action:'hire',candidateCode:candidate.code,contract:'cdi',weeklyHours:35,durationMonths:0,reason:'permanent',expectedMonthlyCostCents:getKqStaffMonthlyCost(candidate,35).totalCents},'prospecting-ines').state;
 raw.context.shopPartners=125;raw.state.prospecting={rennes:50,brest:30};
 // Stable request IDs keep the real prospecting draw reproducible; the engine's chance is unchanged.
 let sequence=0;crypto.randomUUID=()=>('22222222-2222-4222-8222-'+String(++sequence).padStart(12,'0'));
}
if(${sharedTrimOnly}){
 raw.context.trimQueueVersion=2;
 raw.context.trimLots=raw.context.trimLots.map((lot,index)=>({...lot,totalGrams:index?600:90,completedGrams:0,createdAt:new Date(Date.parse(now)-(2-index)*60000).toISOString()}));
 raw.state.trimmerOwned=!new URLSearchParams(location.search).has('unowned');
 raw.state.employees.forEach((employee,index)=>{employee.skills.processing=index?8100:0;employee.trait='meticulous'});
 if(${sharedTrimEdgeOnly}){raw.context.trimLots[0].totalGrams=120;raw.context.trimLots[0].mode='machine';raw.context.trimLots[1].mode='manual';raw.state=applyKqStaffCommand(raw,{action:'assign',employeeId:'work-plan-mael',kind:'culture',hours:1,targetId:'test-run'},'fixture-queued-mael').state}
}
const applyEffects=effects=>{for(const effect of effects){if(effect.kind==='trim-work'){const lot=raw.context.trimLots.find(lot=>lot.flowerId===effect.flowerId);lot.mode=effect.mode;if(effect.unit==='g'){lot.completedGrams=Math.min(lot.totalGrams,(lot.completedGrams??0)+effect.work);lot.completedWork=lot.requiredWork*lot.completedGrams/lot.totalGrams}else{lot.completedWork=Math.min(lot.requiredWork,lot.completedWork+effect.work);if(lot.totalGrams)lot.completedGrams=lot.totalGrams*lot.completedWork/lot.requiredWork}if(lot.completedWork>=lot.requiredWork)lot.completedAt=raw.serverNow}else if(effect.kind==='sales'){raw.context.shopPartners+=effect.shopPartners;raw.context.reputation+=effect.reputation}}};
let failNext=false,loseNextResponse=false,unavailable=(${impactDashboardOnly}||${dashboardOnly}||${employeeSheetOnly}||${weeklyPlanOnly})&&new URLSearchParams(location.search).has('read-error'),reads=0,holdSettlement=${impactDashboardOnly};const calls=[],seen=new Map(),openedHarvests=[];
const settle=()=>{const settled=advanceKqStaff(raw);raw={...raw,state:settled.state,cashCents:raw.cashCents-settled.debitCents};applyEffects(settled.effects)};
if(${workSceneOnly}){
 const scenario=new URLSearchParams(location.search).get('scene');
 const seed=(command,id)=>{const result=applyKqStaffCommand(raw,command,id);raw={...raw,state:result.state,cashCents:raw.cashCents-result.debitCents,revision:raw.revision+1};applyEffects(result.effects)};
 if(scenario==='live'){
  seed({action:'assign',employeeId:'work-plan-anna',kind:'culture',hours:2,targetId:'test-run'},'scene-culture');
  seed({action:'assign',employeeId:'work-plan-mael',kind:'communication',hours:2},'scene-communication');
  seed({action:'player-assign',kind:'processing',hours:1,targetId:'test-flower',expectedCostCents:0},'scene-player');
  seed({action:'assign',employeeId:'work-plan-anna',kind:'administration',hours:1},'scene-queued');
 }else if(scenario==='deadline'){
  seed({action:'assign',employeeId:'work-plan-anna',kind:'culture',hours:1,targetId:'test-run'},'scene-deadline');holdSettlement=true;
 }else if(['culture','processing','communication','sales','administration','training','trim'].includes(scenario)){
  const common={employeeId:'work-plan-anna',hours:scenario==='sales'||scenario==='training'?2:1};
  seed(scenario==='training'?{...common,action:'train',skill:'culture',expectedCostCents:getKqStaffTrainingCost(common.hours)}:scenario==='trim'?{...common,action:'trim',mode:'manual',expectedCostCents:0}:{...common,action:'assign',kind:scenario,...(scenario==='culture'?{targetId:'test-run'}:scenario==='processing'?{targetId:'test-flower'}:scenario==='sales'?{cityId:'brest',expectedCostCents:KQ_STAFF_CITIES.find(city=>city.id==='brest').travelCents}:{})},'scene-'+scenario);
 }
}
const archiveRequests=[],archiveHeld=[];
let archiveFail=null,archiveHold=null;
const archiveDate=index=>new Date(Date.parse(now)-(index+1)*86400000).toISOString().replace('.000Z','.123456+00:00');
const archiveId=(kind,index)=>'a0000000-0000-4000-8000-'+String(kind*1000+index).padStart(12,'0');
const archiveCandidate=projectKqStaffSnapshot(raw).candidates[0];
const archiveContracts=Array.from({length:45},(_,index)=>({...archiveCandidate,id:archiveId(1,index),name:index===0?'Léonie Le Guen':index===44?'Maëlle Le Gall du Val de l’Oust':'Ancien contrat '+String(index+1).padStart(2,'0'),status:'ended',contract:'cdd',weeklyHours:21,hiredAt:'2026-03-01T12:00:00.000Z',endsAt:archiveDate(index),hourlyCents:1456,reason:'temporary-increase',nextPayrollAt:archiveDate(index),paidUntil:archiveDate(index),grossEarnedCents:123456,overtimeGrossCents:0,finalPaid:true,workDays:{},leave:[],completedTasks:index===0?23:0}));
const archivePayroll=Array.from({length:23},(_,index)=>({id:archiveId(2,index),employeeId:archiveContracts[0].id,dueAt:archiveDate(index),grossCents:10000+index,employerCents:3500,indemnityCents:1000,totalCents:14500+index,paidCents:14500+index}));
const archiveTasks=Array.from({length:23},(_,index)=>({id:archiveId(3,index),employeeId:archiveContracts[0].id,kind:index===0?'training':index===1?'trim':'culture',skill:index===0?'processing':'culture',hours:index===0?2:1.5,startedAt:archiveDate(index+1),completesAt:archiveDate(index),day:index+1,status:'completed',trainingCostCents:index===0?2500:0,skillLevel:2,...(index===1?{trimMode:'manual'}:{}),outcome:index===22?undefined:'Résultat conservé '+(index+1)+' : '+(index===0?'+12 XP en transformation.':index===1?'Trim manuel : 6 unités de préparation effectuées.':'Soins appliqués à la culture.')}));
let contractReadFailure=false;const contractReads=[];
if(${contractLifecycleOnly}){archiveContracts.splice(2);archiveContracts.forEach((employee,index)=>{employee.code='former-'+index;employee.role='worker';employee.contracts=['cdi','cdd','seasonal'];employee.skills={culture:1240,processing:8100,communication:455,sales:900,administration:1600};employee.workDays={'1':{usedHours:2,extraHours:0}};});}
if(${archiveOnly}){
 const mode=new URLSearchParams(location.search).get('archive');
 if(mode!=='legacy')raw.archiveCount=mode==='empty'?0:archiveContracts.length;
 if(mode==='empty-list')archiveContracts.length=0;
}
const requestArchive=async(url,method)=>{
 if(method!=='GET')throw Error('Archive fixture permits read requests only');
 const kind=url.searchParams.get('kind'),employeeId=url.searchParams.get('employeeId'),at=url.searchParams.get('afterAt'),id=url.searchParams.get('afterId');
 archiveRequests.push({kind,employeeId,at,id});
 if(!['contract','payroll','task'].includes(kind))throw Error('Unexpected archive kind');
 if(kind!=='contract'&&!archiveContracts.some(employee=>employee.id===employeeId))throw Error('Unknown archived employee');
 if(archiveFail===kind){archiveFail=null;return Response.json({error:'Le registre est temporairement indisponible. Réessaie le chargement.'},{status:503})}
 const rows=kind==='contract'?archiveContracts:(kind==='payroll'?archivePayroll:archiveTasks).filter(item=>item.employeeId===employeeId);
 const stamp=item=>kind==='contract'?item.endsAt:kind==='payroll'?item.dueAt:item.completesAt;
 const previous=id?rows.findIndex(item=>item.id===id&&stamp(item)===at):-1;
 if(id&&previous<0)throw Error('Cursor timestamp or identity was changed');
 const start=previous+1,items=structuredClone(rows.slice(start,start+20)),last=items.at(-1);
 const payload={items,nextCursor:start+items.length<rows.length?{at:stamp(last),id:last.id}:null};
 if(archiveHold===kind){archiveHold=null;await new Promise(resolve=>archiveHeld.push(resolve))}
 return Response.json(payload);
};
if(${archiveOnly})window.__archive={requests:archiveRequests,failNext:kind=>archiveFail=kind,holdNext:kind=>archiveHold=kind,release:()=>archiveHeld.shift()?.(),pending:()=>archiveHeld.length,rename:name=>archiveContracts[0].name=name,expected:()=>structuredClone({contracts:archiveContracts,payroll:archivePayroll,tasks:archiveTasks})};
const request=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method??'GET';
 if(${cultureWorkOnly}&&path==='/api/arena/placard/runs/test-run/work'){
  if(method!=='GET')throw Error('Culture quote must remain read only');cultureReads++;
  if(cultureMode==='network-error')throw Error('[supabase:culture-work] private database detail');
  if(cultureMode==='session-error')return Response.json({error:'Non autorisé.'},{status:401});
  if(cultureMode==='error')return Response.json({error:'[supabase:culture-work] private database detail'},{status:503});
  if(cultureMode==='business-error')return Response.json({error:getKqPlayerWorkErrorMessage('culture_work_exhausted')},{status:409});
  if(cultureMode==='service-error')return Response.json({error:'Prise en charge momentanément indisponible. Actualise avant de lancer l’étape.'},{status:503});
  const quote=cultureQuote();if(cultureMode==='fractional')quote.playerRemainingHours=4.2;
  return Response.json({quote});
 }
 if((${archiveOnly}||${contractLifecycleOnly})&&path==='/api/arena/placard/staff/archive')return requestArchive(url,method);
 if(${contractLifecycleOnly}&&path==='/api/arena/placard/staff/rehire'){
  if(method!=='GET')throw Error('Rehire quote is read only');contractReads.push(url.searchParams.get('contractId'));
  if(contractReadFailure){contractReadFailure=false;return Response.json({error:'Dossier momentanément indisponible. Réessaie.'},{status:503})}
  const source=archiveContracts.find(person=>person.id===url.searchParams.get('contractId'));
  if(!source||raw.state.employees.some(person=>(person.personId??person.id)===(source.personId??source.id)))return Response.json({error:'Cette personne a déjà un contrat actif.'},{status:400});
  return Response.json({employee:structuredClone(source),snapshot:projectKqStaffSnapshot(raw)});
 }
 if(path==='/api/arena/placard/social/player'&&method==='GET'){profileReads++;return profileState==='error'?Response.json({error:'Profil temporairement indisponible'},{status:503}):Response.json({firstName:'Sylvain',profile:profileState==='null'?null:playerProfile})}
 if(path!=='/api/arena/placard/staff')throw Error('Unexpected API '+path);
 const body=method==='POST'?JSON.parse(init.body):null;if(body)calls.push(body);
 if(unavailable)return Response.json({error:'Le personnel est indisponible dans cet essai.'},{status:503});
 if(method==='POST'){
  if(failNext){failNext=false;return Response.json({error:'Connexion interrompue. Réessaie ce même dossier.'},{status:503})}
  if(seen.has(body.requestKey))return Response.json(seen.get(body.requestKey));
  if(${weeklyPlanOnly}||${contractLifecycleOnly})settle();
  if(${contractLifecycleOnly}&&body.action==='rehire')raw.context.rehireSource=structuredClone(archiveContracts.find(person=>person.id===body.sourceContractId));
  try{const applied=applyKqStaffCommand(raw,body,body.requestKey);raw={...raw,state:applied.state,cashCents:raw.cashCents-applied.debitCents,revision:raw.revision+1};applyEffects(applied.effects);const result=projectKqStaffSnapshot(raw);seen.set(body.requestKey,result);if(loseNextResponse){loseNextResponse=false;return Response.json({error:'Réponse perdue après enregistrement. Réessaie ce même dossier.'},{status:503})}return Response.json(result)}catch(error){return Response.json({error:error.message},{status:400})}
 }
 reads++;if(!holdSettlement)settle();return Response.json(projectKqStaffSnapshot(raw));
};
const api=createKqTutorialApi(request);
if(${contractLifecycleOnly})window.__contracts={reads:contractReads,source:()=>structuredClone(archiveContracts[0]),failRead:()=>contractReadFailure=true,disable:()=>{delete raw.context.contractLifecycleVersion;api.notify('kq:staff-updated')},expire:()=>{raw.serverNow=raw.state.employees.find(person=>person.id==='work-plan-mael').endsAt;api.notify('kq:staff-updated')}};
if(${cultureWorkOnly})window.__cultureWork={mode:value=>{cultureMode=value;api.notify('kq:staff-updated')},reads:()=>cultureReads,consume:hours=>{raw.state.tasks.find(task=>task.cultureShift).cultureUsedHours=hours;api.notify('kq:staff-updated')}};
if(${processingWorkOnly})window.__processingStaff={consume:hours=>{raw.state.tasks.find(task=>task.processingShift).processingUsedHours=hours;api.notify('kq:staff-updated')}};
if(${weeklyPlanOnly})window.__weeklyPlan={advance:(day,hour=0)=>{raw.serverNow=new Date(Date.parse(now)+(day-1+hour/24)*KQ_GAME_DAY_MS).toISOString()},availability:value=>{unavailable=!value;api.notify('kq:staff-updated')},budget:cents=>raw.cashCents=cents};
if(${employeeSheetOnly})window.__employeeSheet={expected:id=>{const employee=raw.state.employees.find(person=>person.id===id);return structuredClone({employee,cost:getKqStaffMonthlyCost(employee,employee.weeklyHours),levels:Object.fromEntries(Object.entries(employee.skills).map(([skill,xp])=>[skill,getKqStaffLevel(xp)]))})},availability:value=>{unavailable=!value;api.notify('kq:staff-updated')}};
if(${dashboardOnly})window.__dashboard={availability:value=>{unavailable=!value;api.notify('kq:staff-updated')},expected:()=>{const snapshot=projectKqStaffSnapshot(raw);return structuredClone({snapshot,capacities:snapshot.state.employees.filter(employee=>employee.status==='active').map(employee=>({id:employee.id,...getKqStaffCapacity(employee,snapshot.calendar)}))})}};
if(${impactDashboardOnly})window.__impactControl={availability:value=>{unavailable=!value;api.notify('kq:staff-updated')},pause:id=>{raw.state.employees.find(employee=>employee.id===id).weeklyPlan.enabled=false;api.notify('kq:staff-updated')},leave:id=>{raw.state.employees.find(employee=>employee.id===id).leave=[{id:'impact-leave',startDay:1,endDay:5,days:5}];api.notify('kq:staff-updated')},benefitsMissing:()=>{delete raw.benefits;api.notify('kq:staff-updated')},retire:id=>{raw.state.employees.find(employee=>employee.id===id).status='ended';api.notify('kq:staff-updated')}};
if(${sharedTrimOnly})window.__sharedTrim={advance:minutes=>{raw.serverNow=new Date(Date.parse(now)+minutes*60000).toISOString()},availability:value=>{unavailable=!value},profile:value=>{profileState=value;api.notify('arena:profile-updated')},empty:()=>{raw.context.trimLots=[];raw.state.tasks=[]},omit:()=>{delete raw.context.trimLots}};
if(${workSceneOnly})Object.assign(window,{__workScene:{profile:value=>{profileState=value;api.notify('arena:profile-updated')},profileReads:()=>profileReads,availability:value=>{unavailable=!value},armDeadline:milliseconds=>{raw.serverNow=new Date(Date.parse(raw.state.tasks[0].completesAt)-milliseconds).toISOString()},settle:()=>{holdSettlement=false;raw.serverNow=new Date(Math.max(...raw.state.tasks.map(task=>Date.parse(task.completesAt)))+1000).toISOString()}}});
window.__staff={calls,openedHarvests,raw:()=>structuredClone(raw),failNext:()=>failNext=true,loseNextResponse:()=>loseNextResponse=true,unavailable:()=>unavailable=true,leaveRights:()=>{raw.state.employees[0].hiredAt='2026-10-20T12:00:00.000Z'},finish:()=>{raw.serverNow=new Date(Math.max(...raw.state.tasks.map(task=>Date.parse(task.completesAt)))+1000).toISOString()},payroll:()=>{raw.state.payroll.push({id:'pay-test',employeeId:raw.state.employees[0].id,dueAt:now,grossCents:10000,employerCents:3500,indemnityCents:0,totalCents:13500,paidCents:0})}};
Object.assign(window.__staff,{reads:()=>reads,snapshot:()=>projectKqStaffSnapshot(raw),armRecruitment:milliseconds=>{const deadline=projectKqStaffSnapshot(raw).recruitment.refreshAt;raw.serverNow=new Date(Date.parse(deadline)-milliseconds).toISOString();setTimeout(()=>{raw.serverNow=deadline},milliseconds)},advanceRecruitment:()=>{raw.serverNow=projectKqStaffSnapshot(raw).recruitment.refreshAt}});
Object.assign(window.__staff,{condition:condition=>{if(condition==='weekend')raw.serverNow=new Date(Date.parse(now)+5*KQ_GAME_DAY_MS).toISOString();if(condition==='exhausted')raw.state.employees[0].workDays['1']={usedHours:7,extraHours:0};if(condition==='leave')raw.state.employees[0].leave=[{id:'fixture-leave',startDay:1,endDay:1,days:1}]}});
Object.assign(window.__staff,{personalCondition:condition=>{if(condition==='late')raw.serverNow=new Date(Date.parse(now)+3*60*60*1000).toISOString();if(condition==='weekend-unpaid'){raw.serverNow=new Date(Date.parse(now)+5*KQ_GAME_DAY_MS).toISOString();raw.state.payroll.push({id:'personal-unpaid',employeeId:'former-employee',dueAt:now,grossCents:10000,employerCents:3500,indemnityCents:0,totalCents:13500,paidCents:0})}}});
Object.assign(window.__staff,{personalDay:()=>{raw.serverNow=projectKqStaffSnapshot(raw).calendar.nextDayAt;api.notify('kq:staff-updated')},personalSocialHours:hours=>{const day=String(projectKqStaffSnapshot(raw).calendar.day);raw.state.playerWorkDays[day]={usedHours:(raw.state.playerWorkDays[day]?.usedHours??0)+hours};api.notify('kq:social-updated')},personalAvailability:value=>{unavailable=!value;api.notify('kq:staff-updated')}});
Object.assign(window.__staff,{personalSkills:xp=>{raw.state.playerSkills={culture:xp,processing:xp,communication:xp,sales:xp,administration:xp};raw.state.playerProcessingXp=xp;api.notify('kq:staff-updated')}});
function Fixture(){const[view,setView]=useState('staff'),[busy,setBusy]=useState(false),[disabled,setDisabled]=useState(false),[trimEmployee,setTrimEmployee]=useState(undefined);return <KqTutorialApiProvider api={api}><nav aria-label="Navigation de recette"><button disabled={busy} onClick={()=>setView('staff')}>Personnel</button><button disabled={busy} onClick={()=>setView('workshop')}>Atelier</button><button disabled={busy} onClick={()=>setDisabled(value=>!value)}>{disabled?'Déverrouiller le parent':'Verrouiller le parent'}</button></nav>{${playerWorkOnly || helpOnly}?<div style={{maxWidth:1180,margin:'auto',padding:16}}><KqPlayerWorkStatus view={view} onOpenPersonal={()=>setView('staff')}/></div>:null}{view==='staff'?<KqStaffDesk onOpenTrim={employeeId=>{setTrimEmployee(employeeId);setView('workshop')}}/>:<main style={{padding:'24px 16px',maxWidth:1180,margin:'auto'}}><KqWorkshopTrimDesk initialFlowerId={${workPlanOnly}&&trimEmployee?undefined:'trim-manual'} initialEmployeeId={trimEmployee} disabled={disabled} onBusyChange={setBusy} onOpenHarvests={flowerId=>openedHarvests.push(flowerId)}/></main>}</KqTutorialApiProvider>}
function CultureStatusFixture(){const work=useKqCultureWorkQuote({enabled:true,runId:'test-run',stageIndex:0,phase:cultureMode==='legacy'?'rolled':'prepare',request});return <KqCultureWorkStatus quote={work.quote} error={work.error} onRefresh={work.refresh}/>}
let processingMode='preview',processingAvailable=true,processingFail=false;
const processingCalls=[],processingBase=getKqOperationsCommerce(createKqOperationsLesson('market'));
const processingFlower='a0000000-0000-4000-8000-000000000001';
const processingPlan=createKqProcessingPlan({inputGrams:1000,productGrams:100,equipmentCodes:['PRESS-0600','FREEZE-DRYER']});
const processingFunded=1000*1.6/processingPlan.nominalHours;
const processingActor={id:'work-plan-anna',name:'Anna',code:'anna',level:2,role:'worker',taskId:'processing-budget',allocatedHours:2,usedHours:0,remainingHours:2};
function processingQuote(){return {version:1,flowerId:processingFlower,token:'abcdef0123456789abcdef0123456789',inputGrams:1000,source:processingAvailable?'employee':'blocked',employee:{...processingActor,usedHours:processingAvailable?0:2,remainingHours:processingAvailable?2:0},efficiency:0.8,playerRemainingHours:10,bookedHours:processingAvailable?2:0,activeHours:processingAvailable?2:0,nominalHours:processingAvailable?1.6:0,remainingNominalHours:processingPlan.nominalHours,fundedGrams:processingAvailable?processingFunded:0,passiveHours:24,startedAt:now,readyAt:'2026-11-07T12:20:00.000Z',blockedReason:processingAvailable?null:'La réserve Transformation est épuisée.'}}
function processingJob(){return {version:1,flowerId:processingFlower,route:'dry-sift',inputGrams:1000,completedGrams:processingMode==='completed'?1000:processingMode==='blocked'?processingFunded:0,fundedGrams:processingMode==='completed'?1000:processingFunded,remainingGrams:processingMode==='completed'?0:1000-processingFunded,nominalHours:processingPlan.nominalHours,remainingNominalHours:processingPlan.nominalHours-1.6,status:processingMode,startedAt:now,readyAt:processingMode==='running'?'2026-11-07T12:20:00.000Z':null,finalReadyAt:processingMode==='passive'?'2026-11-07T16:20:00.000Z':processingMode==='completed'?now:null,delegated:true,actor:processingActor,bookedHours:2,activeHours:2,remainingHours:8,plan:processingPlan}}
function processingSnapshot(){const snapshot=structuredClone(processingBase);snapshot.serverNow=now;const rawLot=snapshot.rawLots[0];rawLot.flowerId=processingFlower;const product=rawLot.options.find(option=>option.route==='dry-sift');Object.assign(product,{available:true,blockedReason:undefined,processedInputGrams:1000,productGrams:100,processingWork:{...processingPlan,...(processingMode==='missing-quote'?{}:{quote:processingQuote()})}});if(!['preview','missing-quote'].includes(processingMode)){snapshot.rawLots=[];snapshot.stocks=[{id:'processing-stock',flowerId:processingFlower,name:'Récolte de démonstration',route:'dry-sift',batchRoute:'dry-sift',juryScore:80,initialUnits:1000,remainingUnits:1000,equivalentUnits:10000,originalUnits:1000,baseUnitCents:100,repExact:0,repRounded:0,professionalUnits:0,counted:false,processingReadyAt:'9999-12-31T00:00:00.000Z',processingWork:processingJob()}];snapshot.processingJobs=[processingJob()]}return snapshot}
const processingApi=createKqTutorialApi(async(input,init={})=>{if(new URL(String(input),location.origin).pathname!=='/api/arena/placard/commerce')throw Error('Unexpected processing API');if(!init.method||init.method==='GET')return Response.json(processingSnapshot());const body=JSON.parse(init.body);processingCalls.push(body);if(body.action==='processing-quote')return Response.json({quote:processingQuote()});if(processingFail){processingFail=false;return Response.json({error:'Connexion interrompue. Réessaie cette demande.'},{status:503})}if(body.action==='prepare'||body.action==='processing-work'){assertProcessingToken(body);processingMode='running';return Response.json({action:body.action,stockId:'processing-stock',flowerId:processingFlower,message:'Travail réservé.'})}throw Error('Unexpected mutation '+body.action)});
function assertProcessingToken(body){if(body.expectedWork!==processingQuote().token)throw Error('Missing expected work token')}
window.__processing={calls:processingCalls,mode:value=>{processingMode=value;processingApi.notify('kq:storage-updated')},available:value=>{processingAvailable=value},fail:()=>{processingFail=true}};
function ProcessingFixture(){return <KqTutorialApiProvider api={processingApi}><main style={{maxWidth:980,margin:'24px auto',padding:16}}><KqCommerceDesk mode='sales' initialFlowerId={processingFlower} onOpenShop={()=>{}}/></main></KqTutorialApiProvider>}
createRoot(document.getElementById('root')).render(${processingWorkOnly}&&new URLSearchParams(location.search).has('processing')?<ProcessingFixture/>:${cultureWorkOnly}&&new URLSearchParams(location.search).has('culture-status')?<KqTutorialApiProvider api={api}><main style={{maxWidth:680,margin:'24px auto',padding:16}}><CultureStatusFixture/></main></KqTutorialApiProvider>:<Fixture/>);
`;
const modules = {
  entry,
  'next/image': `import React from'react';export default function Image({src,fill,preload,priority,unoptimized,quality,placeholder,blurDataURL,loader,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
  'next/dynamic': `import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={null}><C {...props}/></React.Suspense>}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;font:16px Body,Arial,sans-serif;background:#fff1d6}*{box-sizing:border-box}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [] } },
  plugins: [{ name: 'staff-audit', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('Live API disabled'); return; } if (req.url?.split('?')[0] !== '/') return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Personnel · recette isolée</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port: 3438, strictPort: true, hmr: false, watch: null },
});
await mkdir(output, { recursive: true });
const errors = [], forbiddenRequests = [], results = [];
let browser, page;
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => { const url = new URL(request.url()); if (['data:', 'blob:'].includes(url.protocol)) return void request.continue(); if (url.origin !== origin || url.pathname.startsWith('/api/')) { forbiddenRequests.push(request.url()); return void request.abort(); } void request.continue(); });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  async function button(label, scope = 'body') { const handle = await page.waitForFunction((label, scope) => [...document.querySelectorAll(scope + ' button')].find(node => node.textContent.trim() === label && !node.disabled && node.getClientRects().length), {}, label, scope); await handle.asElement().focus(); await page.keyboard.press('Enter'); await handle.dispose(); }
  async function select(label, value) { if (label === 'Ville à prospecter') { const activeScope = await page.$('[data-staff-work-form]') ? '[data-staff-work-form]' : '[data-player-work-desk]'; await disclosure(activeScope + ' [data-prospecting-city-list]', true); const selector = `${activeScope} [data-prospecting-city="${value}"]`; await page.waitForSelector(selector, { visible: true }); await page.focus(selector); await page.keyboard.press('Enter'); return; } const handle = await page.waitForFunction(label => [...document.querySelectorAll('label')].find(node => node.childNodes[0]?.textContent.trim() === label)?.querySelector('select'), {}, label); await handle.asElement().select(value); await handle.dispose(); }
  async function input(label, value) { const handle = await page.waitForFunction(label => [...document.querySelectorAll('label')].find(node => node.childNodes[0]?.textContent.trim() === label)?.querySelector('input'), {}, label); await handle.asElement().focus(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type(String(value)); await handle.dispose(); }
  async function summary(prefix) { const handle = await page.waitForFunction(prefix => [...document.querySelectorAll('summary')].find(node => node.textContent.trim().startsWith(prefix)), {}, prefix); await handle.asElement().focus(); await page.keyboard.press('Enter'); await handle.dispose(); }
  const raw = () => page.evaluate(() => window.__staff.raw());
  const calls = () => page.evaluate(() => window.__staff.calls);
  const layout = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
  const shot = async name => { await layout(); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: false }); };
  async function keyActivate(selector) { const control = await page.waitForSelector(selector, { visible: true }); await control.focus(); await page.keyboard.press('Enter'); await control.dispose(); }
  async function disclosure(selector, open) {
    if (!await page.$(selector)) return;
    if (await page.$eval(selector, (node, open) => node.open !== open, open)) await keyActivate(selector + ' > summary');
    await page.waitForFunction((selector, open) => document.querySelector(selector)?.open === open, {}, selector, open);
  }
  async function closeAssignment(expectedStation) {
    if (!await page.$('[data-staff-assignment-panel]')) return;
    const control = await page.waitForFunction(() => [...document.querySelectorAll('[data-staff-assignment-panel] button')].find(node => node.textContent.includes('Annuler')));
    await control.asElement().focus(); await page.keyboard.press('Enter'); await control.dispose();
    await page.waitForFunction(() => !document.querySelector('[data-staff-assignment-panel]'));
    if (expectedStation) await page.waitForFunction(kind => document.activeElement?.getAttribute('data-staff-station') === kind, {}, expectedStation);
  }
  async function personalActivity(kind) {
    await closeAssignment();
    await page.waitForSelector('[data-guide-staff-ready="true"]');
    if (await page.$eval('[data-staff-work-employee="player"]', node => node.getAttribute('aria-pressed') !== 'true')) await keyActivate('[data-staff-work-employee="player"]');
    await keyActivate(`[data-staff-station="${kind === 'countryside' ? 'sales' : kind}"]`);
    if (kind !== 'trim') await page.waitForSelector('[data-player-work-form]', { visible: true });
    if (kind === 'countryside') await keyActivate('[data-player-prospecting-mode="countryside"]');
  }
  if (impactDashboardOnly) {
    const impact = '[data-staff-benefits-dashboard]', panel = '[data-staff-impact-panel]';
    const sectors = ['culture', 'processing', 'trim', 'communication', 'sales', 'administration', 'training'];
    const dayHours = [3, 2, 1, 2, 2, .5, 2], weekHours = [4, 5, 3, 5, 4, 1.5, 4];
    const ready = () => page.waitForSelector('[data-guide-staff-ready="true"]');
    const control = (kind, value) => `${impact} button[data-staff-impact-${kind}="${value}"]`;
    const readHours = () => page.$eval(impact + ' [data-staff-impact-hours]', node => Number(node.getAttribute('data-hours')));
    const selectImpact = async (kind, value) => { await keyActivate(control(kind, value)); await page.waitForFunction(selector => { const node = document.querySelector(selector); return node?.getAttribute('aria-selected') === 'true' || node?.getAttribute('aria-pressed') === 'true'; }, {}, control(kind, value)); };
    const verifyPanel = async sector => {
      assert.equal(await page.$$eval(panel, nodes => nodes.filter(node => node.getClientRects().length).length), 1, 'Only the selected sector panel is visible');
      const tab = await page.$eval(control('sector', sector), node => ({ selected: node.getAttribute('aria-selected'), controls: node.getAttribute('aria-controls'), role: node.getAttribute('role') }));
      assert.equal(tab.role, 'tab'); assert.equal(tab.selected, 'true');
      assert(await page.$eval(panel, (node, id) => node.id === id && node.getAttribute('role') === 'tabpanel', tab.controls), 'The active tab names its real panel');
      await layout();
      assert(await page.$eval(impact, node => node.scrollWidth <= node.clientWidth + 1), 'The impact dashboard fits its content width');
    };
    const checkSectors = async expected => {
      assert.equal(await page.$$(impact + ' button[data-staff-impact-sector]').then(nodes => nodes.length), 7, 'All seven sectors remain available');
      for (const [index, sector] of sectors.entries()) {
        await selectImpact('sector', sector); await verifyPanel(sector);
        const measured = await page.$eval(panel, node => node.getAttribute('data-hours'));
        assert.notEqual(measured, null, 'The active sector exposes its measured hours');
        assert.equal(Number(measured), expected[index], 'The sector uses only the selected source of hours: ' + sector);
      }
    };
    const load = async query => { await page.goto(origin + (query ?? ''), { waitUntil: 'networkidle0' }); await ready(); await page.waitForSelector(impact); await page.evaluate(() => document.fonts.ready); };
    const updateFixture = async (name, ...args) => { const before = await page.evaluate(() => window.__staff.reads()); await page.evaluate(({ name, args }) => window.__impactControl[name](...args), { name, args }); await page.waitForFunction(before => window.__staff.reads() > before, {}, before); await ready(); };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1100, hasTouch: width < 500 });
      await load(); const before = await raw();
      await selectImpact('mode', 'day'); await selectImpact('person', 'all'); assert.equal(await readHours(), 12.5);
      await checkSectors(dayHours);
      assert.match(await page.$eval(panel + ' [data-staff-impact-metrics="actual"] [data-impact-metric="xp-processing"] dd', node => node.textContent), /^12 XP$/);
      assert.equal(await page.$(panel + ' [data-staff-impact-metrics="forecast"] [data-impact-metric="xp-processing"]'), null, 'Completed training is not forecast a second time');
      for (const [sector, id, value] of [['culture', 'culture-hours', '1 h'], ['processing', 'processing-hours', '0,5 h'], ['trim', 'trim-grams', '25 g']]) {
        await selectImpact('sector', sector); assert.equal(await page.$eval(`${panel} [data-staff-impact-metrics="actual"] [data-impact-metric="${id}"] dd`, node => node.textContent), value, 'Only recorded, correctly labelled units are shown as actual gains');
      }
      await selectImpact('sector', 'communication'); assert.equal(await page.$(panel + ' [data-staff-impact-metrics="actual"]'), null, 'Global followers and player receipts are not attributed to a running employee mission');
      await selectImpact('sector', 'culture'); await page.focus(control('sector', 'culture')); await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-staff-impact-sector') === 'processing'); await verifyPanel('processing');
      await page.keyboard.press('End'); await page.waitForFunction(() => document.activeElement?.getAttribute('data-staff-impact-sector') === 'training'); await verifyPanel('training');
      await page.keyboard.press('Home'); await page.waitForFunction(() => document.activeElement?.getAttribute('data-staff-impact-sector') === 'culture'); await verifyPanel('culture');
      await (await page.$(impact)).screenshot({ path: resolve(output, `impact-dashboard-day-${width}.png`) });
      await selectImpact('person', 'work-plan-anna'); assert.equal(await readHours(), 7);
      await checkSectors([3, 2, 0, 0, 0, 0, 2]);
      await selectImpact('person', 'work-plan-mael'); assert.equal(await readHours(), 5.5);
      await checkSectors([0, 0, 1, 2, 2, .5, 0]);
      await selectImpact('mode', 'week'); assert.equal(await readHours(), 14);
      await selectImpact('person', 'work-plan-anna'); assert.equal(await readHours(), 12.5);
      await selectImpact('person', 'all'); assert.equal(await readHours(), 26.5);
      await checkSectors(weekHours);
      assert.match(await page.$eval(impact, node => node.textContent), /prévision|prévu|prévue|prévisionnel|planifié|programm/i, 'A weekly template is explicitly conditional');
      await selectImpact('sector', 'communication'); await (await page.$(impact)).screenshot({ path: resolve(output, `impact-dashboard-week-${width}.png`) });
      assert.equal((await calls()).length, 0, 'Changing mode, person, sector and keyboard tabs sends no action'); assert.deepEqual(await raw(), before, 'Reading the dashboard leaves tasks, money and plans unchanged');
      results.push({ width, scope: 'impact overview navigation', checks: ['seven sector tabs and exactly one panel', 'keyboard arrows, Home and End', 'day 12.5 h from employee tasks only', 'weekly 26.5 h from enabled plans only', 'all and individual filters', 'recorded 1 h culture, 0.5 h processing, 25 g trim and 12 XP training', 'no repeated forecast for completed training', 'no global, player or old-day receipts attributed to current employee missions', 'explicitly conditional weekly impact', 'no overflow', 'zero commands or state mutations'], mutations: 0 });
    }
    await page.setViewport({ width: 320, height: 844, hasTouch: true }); await load();
    await selectImpact('mode', 'week'); await selectImpact('person', 'work-plan-anna');
    await keyActivate(impact + ' [data-staff-impact-plan]');
    const planner = '[data-staff-weekly-planner="work-plan-anna"]'; await page.waitForSelector(planner);
    await keyActivate(planner + ' [data-weekly-day="0"]');
    await page.focus(planner + ' [data-weekly-slot="0"] [data-weekly-hours]'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type('2'); await page.keyboard.press('Tab');
    await keyActivate(planner + ' [data-weekly-activate]'); await page.waitForSelector('dialog[open]'); assert.equal((await calls()).length, 0, 'Review remains read only');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); assert.equal(await readHours(), 12.5, 'An unsaved draft does not change the overview');
    await keyActivate(planner + ' [data-weekly-activate]'); await button('Confirmer les changements', 'dialog'); await ready();
    await page.waitForFunction(() => document.querySelector('[data-staff-impact-hours]')?.getAttribute('data-hours') === '11.5');
    const saved = await raw(); assert.equal(saved.state.employees[0].weeklyPlan.days[0][0].hours, 2); assert.equal(saved.cashCents, 2500000); assert.equal((await calls()).length, 1); assert.equal((await calls())[0].action, 'set-weekly-plan');
    await button('Actualiser'); await ready(); assert.equal(await readHours(), 11.5, 'Refreshing retains the saved plan in the overview');
    await selectImpact('mode', 'day'); assert.equal(await readHours(), 7, 'Saving the next weekly template does not change current reservations');
    await selectImpact('mode', 'week'); await layout();
    results.push({ width: 320, scope: 'saved weekly plan refresh', checks: ['draft and cancellation do not alter overview', 'one explicit set-weekly-plan confirmation', 'saved plan updates overview immediately and after refresh', 'day reservations retained', 'cash unchanged', 'no overflow'], mutations: 1 });
    await load(); await selectImpact('mode', 'week'); await updateFixture('pause', 'work-plan-mael');
    await page.waitForFunction(() => document.querySelector('[data-staff-impact-hours]')?.getAttribute('data-hours') === '12.5');
    await selectImpact('person', 'work-plan-mael'); assert.equal(await readHours(), 0); assert.match(await page.$eval(impact, node => node.textContent), /pause/i);
    await selectImpact('mode', 'day'); assert.equal(await readHours(), 5.5, 'Pausing a weekly plan preserves reservations made today');
    await selectImpact('person', 'work-plan-anna'); await updateFixture('leave', 'work-plan-anna');
    assert.equal(await readHours(), 7, 'A recorded leave does not invent cancelled task receipts');
    await selectImpact('mode', 'week'); assert.match(await page.$eval(impact, node => node.textContent), /congé/i);
    await (await page.$(impact)).screenshot({ path: resolve(output, 'impact-dashboard-leave-320.png') });
    await updateFixture('benefitsMissing'); await disclosure('[data-staff-benefits-history]', true);
    assert.match(await page.$eval('[data-staff-benefits-history]', node => node.textContent), /indisponible|ne fournit pas/i); assert.equal((await calls()).length, 0);
    results.push({ width: 320, scope: 'paused plans, leave and missing receipts', checks: ['paused templates excluded from week total', 'paused status explained', 'current reservations retained', 'leave shown as a planning condition', 'missing global receipts unavailable rather than zero', 'zero commands'], mutations: 0 });
    await load(); await selectImpact('mode', 'week'); const known = await raw();
    await page.evaluate(() => window.__impactControl.availability(false)); await page.waitForSelector('[data-staff-desk] [role="alert"]'); await page.waitForSelector('[data-staff-dashboard][data-stale="true"]');
    assert.match(await page.$eval('[data-staff-dashboard]', node => node.textContent), /Dernières données reçues/); assert.equal(await readHours(), 26.5);
    assert(await page.$eval(impact + ' [data-staff-impact-plan]', node => node.disabled), 'Stale data disables the scheduling action');
    await selectImpact('person', 'work-plan-anna'); assert.equal(await readHours(), 12.5); await selectImpact('sector', 'administration'); await verifyPanel('administration');
    assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), known); await (await page.$(impact)).screenshot({ path: resolve(output, 'impact-dashboard-stale-320.png') });
    await updateFixture('availability', true); assert.equal(await readHours(), 12.5);
    await page.goto(origin + '?read-error', { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-staff-desk] [role="alert"]'); assert.equal(await page.$(impact), null, 'A first failed read must not show invented zero impact');
    await updateFixture('availability', true); await page.waitForSelector(impact);
    await selectImpact('mode', 'week'); await selectImpact('person', 'work-plan-mael'); await updateFixture('retire', 'work-plan-mael');
    await page.waitForFunction(() => { const node = document.querySelector('[data-staff-impact-person="all"]'); return node?.getAttribute('aria-pressed') === 'true' || node?.getAttribute('aria-selected') === 'true'; }); assert.equal(await page.$(control('person', 'work-plan-mael')), null);
    assert.equal((await calls()).length, 0); await layout();
    results.push({ width: 320, scope: 'read failure and selection recovery', checks: ['last known totals retained and labelled stale', 'read-only filters usable on stale data', 'failed first read has no fictional dashboard', 'successful retry', 'departed employee returns selection to all', 'no overflow or commands'], mutations: 0 });
    await load('?empty&unknown'); assert.match(await page.$eval(impact, node => node.textContent), /aucun salarié|recrut/i); await checkSectors([0, 0, 0, 0, 0, 0, 0]); assert.equal((await calls()).length, 0); await (await page.$(impact)).screenshot({ path: resolve(output, 'impact-dashboard-empty-320.png') });
    results.push({ width: 320, scope: 'confirmed empty team', checks: ['empty team explained', 'all sectors accessible', 'missing benefits not fabricated', 'no overflow or commands'], mutations: 0 });
  }
  if (benefitsOnly) {
    const ready = () => page.waitForSelector('[data-guide-staff-ready="true"]');
    const cancel = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await ready(); await page.evaluate(() => document.fonts.ready);
      assert.match(await page.$eval('[data-staff-supplier-discount]', node => node.textContent), /6 %/);
      assert.match(await page.$eval('[data-staff-supplier-savings]', node => node.textContent), /13,20/);
      await disclosure('[data-staff-benefits-history]', true); await layout();
      assert.match(await page.$eval('[data-staff-benefits-history]', node => node.textContent), /Suivi depuis.*52.*2/s);
      await (await page.$('[data-staff-benefits-dashboard]')).screenshot({ path: resolve(output, `benefits-dashboard-${width}.png`) });
      await disclosure('[data-staff-benefits-history]', false);
      const before = await raw();
      for (const [kind, duration, expected] of [['culture', 3, /6 étapes/], ['processing', 2, /75 %/], ['communication', 2, /52 abonnés/], ['sales', 6, /3 tentatives/], ['administration', null, /6 %/]]) {
        await closeAssignment();
        await keyActivate('[data-staff-work-employee="work-plan-anna"]'); await keyActivate(`[data-staff-station="${kind}"]`);
        await page.waitForSelector('[data-staff-work-form]');
        if (duration !== null) await input('Temps à réserver', duration);
        else assert.equal(await page.$eval('[data-staff-work-form] input', node => node.value), '0.5', 'Administration defaults to thirty minutes');
        const preview = `[data-staff-work-form] [data-staff-benefit-preview="${kind}"]`;
        await page.waitForSelector(preview);
        assert.match(await page.$eval(preview, node => node.textContent), expected);
        if (kind === 'administration') {
          assert.match(await page.$eval(preview, node => node.textContent), /7 jours du jeu/);
          assert.match(await page.$eval(preview + ' > p', node => node.textContent), /nouvelles factures.*Entrepôt/);
        }
        if (await page.$(preview + ' details')) { await disclosure(preview + ' details', true); await disclosure(preview + ' details', false); }
        await layout();
        await (await page.$('[data-staff-assignment-panel]')).screenshot({ path: resolve(output, `benefits-${kind}-${width}.png`) });
        await button('Vérifier l’affectation', '[data-staff-work-form]'); await page.waitForSelector('dialog[open]');
        const confirmation = await page.$eval('dialog', node => node.textContent);
        assert.match(confirmation, /Prévision/); assert.match(confirmation, expected); assert.match(confirmation, /Conditions de la prévision/);
        if (kind !== 'sales') assert.match(confirmation, /Paiement immédiat0\s*€/);
        await layout(); await cancel();
        assert.equal((await calls()).length, 0, 'Review and cancellation never spend money or reserve hours');
      }
      assert.deepEqual((await raw()).state, before.state);
      await closeAssignment();
      await personalActivity('administration');
      assert.equal(await page.$eval('[data-player-work-form] input', node => node.value), '0.5');
      await button('Vérifier mon travail', '[data-player-work-form]'); await page.waitForSelector('dialog[open]');
      assert.match(await page.$eval('dialog', node => node.textContent), /Prévision.*7 jours du jeu/s); await cancel(); await closeAssignment();
      await keyActivate('[data-staff-work-plan] [data-staff-open-employee="work-plan-anna"]'); await keyActivate('dialog[data-staff-employee-sheet] [data-staff-open-weekly]');
      await page.waitForSelector('[data-staff-weekly-planner]'); await keyActivate('[data-weekly-add]');
      for (const kind of ['administration', 'trim', 'sales']) {
        await page.select('[data-weekly-kind]', kind);
        if (kind === 'sales') await page.select('[data-weekly-city]', 'brest');
        await page.waitForSelector(`[data-weekly-slot] [data-staff-benefit-preview="${kind}"]`); await layout();
      }
      results.push({ width, scope: 'benefit previews', checks: ['five employee sectors with real level forecasts', 'same forecast and conditions in confirmation', 'administration defaults 0.5 h', 'personal administration', 'weekly admin trim and sales', 'keyboard details and confirmation cancellation', 'actual savings separately dated', 'no overflow'], mutations: 0 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await ready();
      await disclosure('[data-staff-admin-rules]', true);
      assert.equal(await page.$eval('[data-staff-admin-toggle]', node => node.getAttribute('aria-pressed')), 'false');
      await keyActivate('[data-staff-admin-toggle]'); await keyActivate('[data-staff-admin-payroll]');
      await input('Plafond par jour du jeu (€)', '-1');
      assert(await page.$eval('[data-staff-admin-review]', node => node.disabled), 'Invalid limits block review');
      await input('Plafond par jour du jeu (€)', '350'); await input('Solde minimum à garder (€)', '1200');
      await keyActivate('[data-staff-admin-review]'); await page.waitForSelector('dialog[open]');
      const rulesReview = await page.$eval('dialog', node => node.textContent);
      assert.match(rulesReview, /350\s*€/); assert.match(rulesReview, /1\s?200\s*€/); assert.match(rulesReview, /Débit à cette confirmation0\s*€/);
      assert.equal((await calls()).length, 0); await cancel(); assert.equal((await raw()).state.administrationRules, undefined);
      await keyActivate('[data-staff-admin-review]'); await page.waitForSelector('dialog[open]'); await button('Autoriser ces règles', 'dialog'); await ready();
      await page.waitForFunction(() => window.__staff.raw().state.administrationRules?.enabled === true);
      const saved = await raw(); assert.equal(saved.state.administrationRules.maxDailyCents, 35000); assert.equal(saved.state.administrationRules.cashReserveCents, 120000);
      assert.equal(saved.cashCents, 2500000); assert.equal((await calls()).length, 1); await layout();
      await (await page.$('[data-staff-admin-rules]')).screenshot({ path: resolve(output, `benefits-rules-${width}.png`) });
      await page.evaluate(() => window.__staff.payroll()); await button('Actualiser'); await ready();
      await keyActivate('[data-staff-work-employee="work-plan-anna"]'); await keyActivate('[data-staff-station="administration"]');
      assert.equal(await page.$eval('[data-staff-work-form] button[type="submit"]', node => node.disabled), false, 'The authorized administrator can work to settle overdue payroll');
      await closeAssignment(); await keyActivate('[data-staff-station="communication"]');
      assert.equal(await page.$eval('[data-staff-work-form] button[type="submit"]', node => node.disabled), true, 'Other activities remain blocked by overdue payroll');
      await closeAssignment(); await keyActivate('[data-staff-work-employee="work-plan-mael"]'); await keyActivate('[data-staff-station="administration"]');
      assert.equal(await page.$eval('[data-staff-work-form] button[type="submit"]', node => node.disabled), true, 'Other employees do not inherit payment permission');
      results.push({ width, scope: 'delegated payment authorization', checks: ['off by default', 'limits validation', 'keyboard review', 'cancel no change', 'limits and no debit in confirmation', 'one explicit saved authorization', 'cash unchanged', 'no overflow'], mutations: 1 });
    }
    await page.goto(origin + '?unknown&legacy', { waitUntil: 'networkidle0' }); await ready();
    assert.match(await page.$eval('[data-staff-supplier-savings]', node => node.textContent), /Indisponible/);
    assert.equal(await page.$('[data-staff-admin-rules]'), null, 'Unsupported server does not show payment authorization');
    assert.equal((await calls()).length, 0);
    results.push({ scope: 'missing server capabilities', checks: ['unknown savings not zero', 'no payment rules on old server', 'no POST'] });
  }
  if (contractLifecycleOnly) {
    const planner = '[data-staff-contract-planner]';
    const ready = () => page.waitForSelector('[data-guide-staff-ready="true"]');
    const openCurrent = async () => {
      await keyActivate('[data-staff-work-plan] [data-staff-open-employee="work-plan-mael"]');
      await page.waitForSelector('dialog[data-staff-employee-sheet][open]');
      await keyActivate('dialog [data-staff-manage-contract="work-plan-mael"]');
      await page.waitForSelector('[data-staff-contract-planner="manage"]');
      assert.equal(await page.$('dialog[open]'), null, 'Contract planning does not nest dialogs');
    };
    const review = async () => { await keyActivate('[data-staff-contract-review]'); await page.waitForSelector('dialog[open]'); };
    const cancelled = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); await page.waitForFunction(() => document.activeElement?.hasAttribute('data-staff-contract-review')); };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await ready(); await page.evaluate(() => document.fonts.ready);
      const initial = await raw(), old = initial.state.employees.find(person => person.id === 'work-plan-mael');
      await openCurrent(); await page.select('[data-staff-renew-months]', '3');
      await layout(); await (await page.$(planner)).screenshot({ path: resolve(output, `contract-renew-${width}.png`) });
      await review();
      assert.equal((await calls()).length, 0, 'Reviewing an amendment does not commit it');
      assert((await page.$eval('dialog', node => node.textContent)).includes('Débit immédiat'));
      await cancelled(); assert.deepEqual((await raw()).state, initial.state);
      await review(); if (width === 320) await page.evaluate(() => window.__staff.loseNextResponse());
      await button('Signer l’avenant', 'dialog');
      if (width === 320) { await page.waitForSelector('dialog [role="alert"]'); await button('Réessayer la confirmation', 'dialog'); const sent = await calls(); assert.equal(sent.at(-1).requestKey, sent.at(-2).requestKey); }
      await page.waitForFunction(() => !document.querySelector('[data-staff-contract-planner]')); await ready();
      const renewed = (await raw()).state.employees.find(person => person.id === old.id);
      assert.equal(renewed.renewals.length, 1); assert.equal(Date.parse(renewed.endsAt) - Date.parse(old.endsAt), 3 * 30 * 4 * 60 * 60 * 1000);
      for (const key of ['hiredAt', 'skills', 'leave', 'nextPayrollAt', 'workDays']) assert.deepEqual(renewed[key], old[key]);
      assert.equal((await raw()).cashCents, initial.cashCents);
      await openCurrent(); await keyActivate('[data-staff-contract-action="convert"]'); await review(); await button('Confirmer le CDI', 'dialog');
      await page.waitForFunction(() => !document.querySelector('[data-staff-contract-planner]')); await ready();
      const permanent = (await raw()).state.employees.find(person => person.id === old.id);
      assert.equal(permanent.contract, 'cdi'); assert.equal(permanent.endsAt, null); assert.equal(permanent.hiredAt, old.hiredAt); assert.deepEqual(permanent.skills, old.skills);
      assert.equal((await raw()).state.payroll.length, 0, 'Continuation produces no final settlement');
      results.push({ width, scope: 'renewal and CDI continuation', checks: ['keyboard sheet to inline planner', 'no nested dialog', 'exact three-month extension', 'cancel and focus return', 'lost response retry once', 'same identity XP leave and pay dates', 'no debit or final settlement', 'CDI no end date', 'no overflow'] });

      const source = await page.evaluate(() => window.__contracts.source());
      await keyActivate('[data-staff-tab="payroll"]'); await disclosure('[data-staff-archive]', true); await button('Consulter le dossier de ' + source.name, '[data-staff-archive]');
      if (width === 320) await page.evaluate(() => window.__contracts.failRead());
      await keyActivate(`[data-staff-rehire="${source.id}"]`);
      if (width === 320) { await page.waitForSelector('[data-staff-rehire-error]'); assert.equal(await page.$('[data-staff-contract-form="rehire"]'), null); await button('Recharger le dossier', planner); }
      await page.waitForSelector('[data-staff-contract-form="rehire"]');
      assert.match(await page.$eval('[data-staff-rehire-block]', node => node.textContent), /carence/i);
      assert(await page.$eval('[data-staff-contract-review]', node => node.disabled));
      await page.select('[data-staff-rehire-contract]', 'cdi'); await page.select('[data-staff-rehire-hours]', '14');
      await disclosure('[data-staff-contract-skills]', true);
      for (const [skill, xp] of Object.entries(source.skills)) assert((await page.$eval(`[data-staff-contract-skill="${skill}"]`, node => node.textContent)).replace(/\s/g, '').includes(xp + 'XP'));
      await layout(); await (await page.$(planner)).screenshot({ path: resolve(output, `contract-rehire-${width}.png`) });
      const beforeRehire = await raw(); await review(); await cancelled(); assert.deepEqual((await raw()).state, beforeRehire.state);
      await review(); if (width === 390) await page.evaluate(() => window.__staff.loseNextResponse());
      await button('Signer le nouveau contrat', 'dialog');
      if (width === 390) { await page.waitForSelector('dialog [role="alert"]'); await button('Réessayer la confirmation', 'dialog'); const sent = await calls(); assert.equal(sent.at(-1).requestKey, sent.at(-2).requestKey); }
      await page.waitForFunction(() => !document.querySelector('[data-staff-contract-planner]')); await ready();
      const after = await raw(), people = after.state.employees.filter(person => person.previousContractId === source.id);
      assert.equal(people.length, 1); assert.notEqual(people[0].id, source.id); assert.equal(people[0].personId, source.id);
      assert.deepEqual(people[0].skills, source.skills); assert.deepEqual(people[0].workDays, source.workDays);
      assert.equal(people[0].weeklyHours, 14); assert.deepEqual(people[0].leave, []); assert.equal(people[0].weeklyPlan, undefined);
      assert.equal(after.cashCents, beforeRehire.cashCents); assert.deepEqual(await page.evaluate(() => window.__contracts.source()), source);
      assert.equal(await page.$eval('[data-staff-tab="team"]', node => node.getAttribute('aria-selected') ?? node.getAttribute('aria-pressed')), 'true');
      await layout();
      results.push({ width, scope: 'former employee rehire', checks: ['archive dossier entry', 'source failure retry', 'ordinary CDD role cooldown and CDI alternative', 'exact five persisted XP values', 'new contract identity', 'fresh finances and leave', 'recent work hours retained', 'no automatic weekly plan', 'old archive unchanged', 'no signature debit', 'cancel without mutation and replay without duplicate', 'no overflow'] });
    }
    await page.goto(origin, { waitUntil: 'networkidle0' }); await ready();
    await page.evaluate(() => window.__contracts.disable()); await ready();
    await keyActivate('[data-staff-work-plan] [data-staff-open-employee="work-plan-mael"]');
    await page.waitForSelector('dialog[data-staff-employee-sheet][open]');
    assert.equal(await page.$('[data-staff-manage-contract], [data-staff-rehire]'), null, 'Older database capability does not expose unsupported mutations');
    results.push({ scope: 'contract capability compatibility', checks: ['existing dossiers work without migration', 'unsupported lifecycle actions hidden'], mutations: 0 });
  }
  if (helpOnly) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-guide-staff-ready="true"]'); await page.evaluate(() => document.fonts.ready);
      await page.focus('[data-player-work-status] summary'); await page.keyboard.press('Enter');
      await page.waitForSelector('[data-player-work-status] details[open]');
      const before = await raw();
      for (const skill of ['communication', 'sales', 'processing', 'administration', 'culture']) {
        await page.focus(`[data-player-cost-selector="${skill}"]`); await page.keyboard.press('Space');
        assert.equal(await page.$eval(`[data-player-cost-selector="${skill}"]`, node => node.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.$$eval('[data-player-cost-group]:not([hidden])', nodes => nodes.length), 1);
        assert.equal(await page.$eval('[data-player-cost-group]:not([hidden])', node => node.dataset.playerCostGroup), skill);
        await layout();
      }
      await page.click('[data-player-cost-selector="communication"]');
      await (await page.$('[data-player-work-status]')).screenshot({ path: resolve(output, `help-workday-${width}.png`) });
      await disclosure('[data-player-work-status] details', false);
      for (const guide of ['planning', 'development']) {
        const selector = `[data-staff-guide="${guide}"]`;
        await disclosure(selector, true); await layout();
        assert(await page.$(selector + ' [data-help-facts]'));
        if (guide === 'planning') {
          for (const topic of ['hours', 'culture', 'workshop', 'sales', 'administration']) {
            await keyActivate(`[data-help-topic="${topic}"]`);
            assert.equal(await page.$eval(`[data-help-topic="${topic}"]`, node => node.getAttribute('aria-pressed')), 'true');
            assert.equal(await page.$$eval('[data-help-topic-panel]:not([hidden])', nodes => nodes.length), 1);
            assert.equal(await page.$eval('[data-help-topic-panel]:not([hidden])', node => node.dataset.helpTopicPanel), topic);
            await layout();
          }
          await keyActivate('[data-help-topic="culture"]');
        }
        await page.$$eval(selector + ' img', images => Promise.all(images.filter(img => img.checkVisibility()).map(img => img.decode())));
        const illustratedFacts = await page.$$eval(selector + ' [data-help-facts] > div', facts => facts.filter(node => node.checkVisibility()).map(node => {
          const img = node.querySelector('img'), value = node.querySelector('dd');
          const a = img.getBoundingClientRect(), b = value.getBoundingClientRect();
          return { loaded: img.complete && img.naturalWidth > 0, width: a.width, height: a.height, space: b.left - a.right, alt: img.alt };
        }));
        assert(illustratedFacts.length && illustratedFacts.every(fact => fact.loaded && fact.width >= 80 && fact.height >= 80 && fact.space >= 4 && fact.alt === ''), 'Generated illustrations are loaded, large, decorative and separate from readable values');
        await (await page.$(selector)).screenshot({ path: resolve(output, `help-staff-${guide}-${width}.png`) });
        await disclosure(selector, false);
      }
      await button('Atelier', '[aria-label="Navigation de recette"]');
      await page.waitForSelector('[data-trim-shared-form]');
      const trimHelp = await page.$('[data-trim-shared-form] details');
      assert(trimHelp); await trimHelp.evaluate(node => node.open = true); await layout();
      assert(await trimHelp.$('[data-help-dashboard]'));
      await trimHelp.screenshot({ path: resolve(output, `help-trim-${width}.png`) });
      assert.equal((await calls()).length, 0, 'Help and category selection never submit a command');
      assert.deepEqual(await raw(), before, 'Reading help leaves hours, money and assignments intact');
      results.push({ width, scope: 'illustrated explanation dashboards', checks: ['keyboard disclosure and five activity buttons', 'five staff topics with one visible explanation', 'loaded generated scenes, decorative alt and no text overlap', 'day allocation and renewal', 'responsive staff rules and trim help', 'no horizontal overflow', 'no command or state change'], mutations: 0 });
    }
  }
  if (dashboardOnly && !helpOnly) {
    const dashboard = '[data-staff-dashboard]', plan = '[data-staff-work-plan]', sheet = 'dialog[data-staff-employee-sheet]';
    const metric = name => `${dashboard} [data-staff-metric="${name}"]`;
    const number = text => Number(text.replace(/[^\d,.-]/g, '').replace(',', '.'));
    const metricValue = name => page.$eval(metric(name), node => (node.querySelector('[data-staff-metric-value]') ?? node.querySelector('dd').firstChild).textContent.trim());
    const ready = () => page.waitForSelector('[data-guide-staff-ready="true"]');
    const fullShot = async name => { await layout(); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); };
    const open = async (width, scenario = '') => {
      await page.setViewport({ width, height: width < 500 ? 844 : 1100, hasTouch: width < 500 });
      await page.goto(origin + (scenario ? '?dashboard=' + scenario : ''), { waitUntil: 'networkidle0' });
      await ready(); await page.waitForSelector(dashboard); await page.evaluate(() => document.fonts.ready);
    };
    const verify = async () => {
      const { snapshot, capacities } = await page.evaluate(() => window.__dashboard.expected());
      const used = snapshot.state.playerWorkDays[String(snapshot.calendar.day)]?.usedHours ?? 0;
      const total = capacities.reduce((sum, item) => sum + item.baseHours + item.extraHours, 0);
      const remaining = capacities.reduce((sum, item) => sum + item.remainingHours, 0);
      assert.equal(number(await metricValue('player')), 12 - used, 'Personal availability comes from the authoritative daily ledger');
      const personalMeter = await page.$eval(metric('player') + ' [role="meter"]', node => ({ value: Number(node.getAttribute('aria-valuenow')), max: Number(node.getAttribute('aria-valuemax')) }));
      assert.deepEqual(personalMeter, { value: 12 - used, max: 12 });
      if (total > 0) {
        assert.equal(number(await metricValue('team')), remaining, 'Team hours sum active employees’ remaining capacity');
        assert.deepEqual(await page.$eval(metric('team') + ' [role="meter"]', node => ({ value: Number(node.getAttribute('aria-valuenow')), max: Number(node.getAttribute('aria-valuemax')) })), { value: remaining, max: total });
      } else {
        assert.equal(await metricValue('team'), capacities.length ? 'Repos' : 'À recruter');
        assert.equal(await page.$(metric('team') + ' [role="meter"]'), null, 'No meaningless zero-capacity gauge');
      }
      assert.equal(Math.round(number(await metricValue('monthly')) * 100), snapshot.monthlyEmployerCostCents, 'Monthly cost uses the server estimate including employer charges');
      assert.match(await page.$eval(metric('monthly'), node => node.textContent), /Estimation mensuelle, charges comprises/i);
      assert.equal(Math.round(number(await metricValue('payroll')) * 100), snapshot.outstandingCents, 'Payroll shows the remaining amount due, including partial payments');
      const footer = await page.$eval(dashboard, node => node.textContent);
      assert.match(footer, /Trésorerie disponible/);
      await layout();
      return { snapshot, remaining, total, playerRemaining: 12 - used };
    };
    for (const width of [320, 390, 1440]) {
      await open(width); const before = await raw(), expected = await verify();
      assert.equal(expected.playerRemaining, 8.5); assert.equal(expected.remaining, 10); assert.equal(expected.total, 14);
      await fullShot(`dashboard-normal-${width}`);
      const id = expected.snapshot.state.employees[0].id, opener = `${plan} [data-staff-open-employee="${id}"]`;
      await keyActivate(opener); await page.waitForSelector(sheet + '[open]', { visible: true });
      assert(await page.$eval(sheet, node => node.contains(document.activeElement)), 'Employee sheet receives keyboard focus');
      await page.keyboard.press('Escape'); await page.waitForFunction(selector => !document.querySelector('dialog[open]') && document.activeElement === document.querySelector(selector), {}, opener);
      await keyActivate(`${plan} [data-staff-open-weekly="${id}"]`);
      await page.waitForSelector(`[data-staff-weekly-planner="${id}"]`, { visible: true });
      assert(await page.evaluate(id => document.activeElement?.matches(`[data-staff-employee-id="${id}"] [data-staff-planning-mode="week"]`), id), 'Direct weekly access places focus in the requested employee’s planning');
      assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), before, 'Reading a sheet and opening the week changes no cash, hours or tasks');
      await fullShot(`dashboard-weekly-${width}`);
      results.push({ width, scope: 'dashboard active team', values: { playerHours: expected.playerRemaining, teamHours: expected.remaining, teamCapacity: expected.total, monthlyCents: expected.snapshot.monthlyEmployerCostCents, payrollCents: expected.snapshot.outstandingCents }, checks: ['server cash and costs', 'personal ledger and combined active capacity', 'monthly estimate distinguished from amount due', 'keyboard sheet and focus return', 'direct week access and focus', 'no horizontal overflow', 'no command before confirmation'], mutations: 0 });

      await open(width, 'weekend'); const resting = await verify(), weekendBefore = await raw();
      assert(resting.snapshot.calendar.weekend); assert.equal(resting.playerRemaining, 0);
      assert.match(await page.$eval(metric('team'), node => node.textContent), /Repos du week-end/);
      for (const employee of resting.snapshot.state.employees) {
        const card = await page.$eval(`[data-staff-work-employee="${employee.id}"]`, node => ({ text: node.parentElement.textContent, meters: node.parentElement.querySelectorAll('[role="meter"]').length }));
        assert.match(card.text, /Repos du week-end/); assert.equal(card.meters, 0, 'Resting employee card omits the 0 h / 0 h gauge');
      }
      await fullShot(`dashboard-weekend-${width}`);
      await keyActivate('[data-staff-next-action] button'); await page.waitForSelector('[data-staff-weekly-planner]', { visible: true });
      assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), weekendBefore);
      results.push({ width, scope: 'dashboard exhausted weekend', checks: ['zero personal hours preserved', 'weekend explained without zero-capacity gauges', 'next action opens weekly planning', 'no game mutation', 'no horizontal overflow'], mutations: 0 });

      await open(width, 'payroll'); const unpaid = await verify(), unpaidBefore = await raw();
      assert.equal(unpaid.snapshot.outstandingCents, 10000, 'Fixture retains a partially paid 135 euro payroll with 100 euro still due');
      assert.match(await page.$eval(metric('team'), node => node.textContent), /bloquées.*paie/);
      await fullShot(`dashboard-payroll-${width}`);
      await keyActivate('[data-staff-next-action] button'); await page.waitForSelector('[data-staff-panel="payroll"]', { visible: true });
      assert.equal((await calls()).length, 0, 'The next action only opens the payroll view');
      await button('Vérifier le règlement'); await page.waitForSelector('dialog[open]');
      assert.match((await page.$eval('dialog[open]', node => node.textContent)).replace(/\s/g, ' '), /100 €/);
      await page.keyboard.press('Escape'); assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), unpaidBefore, 'Cancel leaves the partial payroll and cash untouched');
      results.push({ width, scope: 'dashboard unpaid payroll', checks: ['remaining due after partial payment', 'available hours distinguished from blocked assignments', 'next action opens payroll only', 'exact amount in confirmation', 'cancel without mutation', 'no horizontal overflow'], mutations: 0 });

      await open(width, 'empty'); const empty = await verify(), emptyBefore = await raw();
      assert.equal(empty.snapshot.state.employees.length, 0); assert.equal(empty.snapshot.monthlyEmployerCostCents, 0);
      await fullShot(`dashboard-empty-${width}`);
      await keyActivate('[data-staff-next-action] button'); await page.waitForSelector('[data-staff-panel="candidates"]', { visible: true });
      assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), emptyBefore);
      results.push({ width, scope: 'dashboard no employees', checks: ['confirmed empty team distinguished from unavailable data', 'zero actual monthly and payroll amounts', 'personal work retained', 'recruitment next action is read only', 'no horizontal overflow'], mutations: 0 });
    }
    await open(320); const known = await raw(), knownValues = await Promise.all(['player', 'team', 'monthly', 'payroll'].map(metricValue));
    await page.evaluate(() => window.__dashboard.availability(false)); await page.waitForSelector('[data-staff-desk] [role="alert"]');
    await page.waitForSelector('[data-staff-dashboard][data-stale="true"]');
    assert.deepEqual(await Promise.all(['player', 'team', 'monthly', 'payroll'].map(metricValue)), knownValues, 'Failed refresh preserves the last known figures');
    assert.match(await page.$eval(dashboard, node => node.textContent), /Dernières données reçues/);
    assert(await page.$eval('[data-staff-next-action] button', node => node.disabled));
    await fullShot('dashboard-stale-320'); assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), known);
    await page.goto(origin + '?read-error', { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-staff-desk] [role="alert"]');
    assert.equal(await page.$('[data-staff-metric]'), null, 'Initial read failure never invents zero hours or euro amounts');
    assert.equal(await page.$(plan), null); assert.equal((await calls()).length, 0); await fullShot('dashboard-unavailable-320');
    await page.evaluate(() => window.__dashboard.availability(true)); await ready(); await verify();
    results.push({ width: 320, scope: 'dashboard unavailable and recovery', checks: ['last known data retained and identified as stale', 'next action disabled after failed refresh', 'first read error has no fictional zero values', 'successful recovery', 'no mutation', 'no overflow'], mutations: 0 });
  }
  if (processingWorkOnly) {
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1100, hasTouch: width < 500 });
      await page.goto(origin + '?processing=1', { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-commerce-preparation]');
      await page.select('[data-commerce-preparation] select', 'dry-sift');
      await page.waitForSelector('[data-processing-work-summary][data-work-source="employee"]');
      const preview = await page.$eval('[data-processing-work-summary]', node => node.textContent);
      assert(preview.includes('Anna') && preview.includes('Tes heures consommées0 h') && preview.includes('2 h de jeu') && preview.includes('24 h de jeu') && preview.includes('240 min réelles'));
      await disclosure('[data-processing-sources]', true);
      assert.equal(await page.$$eval('[data-processing-sources] a', nodes => nodes.filter(node => node.href.startsWith('https://')).length), 2);
      await layout(); await disclosure('[data-processing-sources]', false);
      await page.$eval('[data-processing-work-summary]', node => node.scrollIntoView({ block: 'start' })); await shot('processing-preview-' + width);
      await keyActivate('[data-prepare-lot]'); await page.waitForSelector('dialog[open]');
      assert.equal(await page.$eval('dialog [data-processing-work-summary]', node => node.textContent), preview);
      await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.__processing.calls.length), 0);
      await keyActivate('[data-prepare-lot]'); await button('Confirmer', 'dialog');
      await page.waitForSelector('[data-processing-status="running"]');
      assert.equal(await page.evaluate(() => window.__processing.calls[0].expectedWork), 'abcdef0123456789abcdef0123456789');
      assert(!(await page.$eval('body', node => node.innerText)).includes('9999'));
      await page.evaluate(() => { window.__processing.available(false); window.__processing.mode('blocked'); });
      await page.waitForSelector('[data-processing-status="blocked"]');
      assert((await page.$eval('[data-commerce-workshop-scene]', node => node.textContent)).includes('Aucun relais joueur'));
      await keyActivate('[data-resume-processing]'); await page.waitForSelector('dialog [data-work-source="blocked"]');
      assert(await page.$eval('dialog footer button:last-child', node => node.disabled));
      await page.evaluate(() => window.__processing.available(true)); await button('Actualiser les heures', 'dialog');
      await page.waitForSelector('dialog [data-work-source="employee"]');
      await page.evaluate(() => window.__processing.fail()); await button('Confirmer', 'dialog');
      await page.waitForFunction(() => document.querySelector('dialog [role="alert"]')?.textContent.includes('Connexion interrompue'));
      await button('Confirmer', 'dialog'); await page.waitForSelector('[data-processing-status="running"]');
      const resumed = await page.evaluate(() => window.__processing.calls.filter(call => call.action === 'processing-work'));
      assert.equal(resumed.length, 2); assert.equal(resumed[0].requestKey, resumed[1].requestKey);
      await page.evaluate(() => window.__processing.mode('passive')); await page.waitForSelector('[data-processing-status="passive"]');
      assert((await page.$eval('[data-commerce-workshop-scene]', node => node.textContent)).includes('Attente autonome'));
      await page.evaluate(() => window.__processing.mode('completed')); await page.waitForSelector('[data-processing-status="completed"]');
      assert(!(await page.$eval('body', node => node.innerText)).includes('9999')); await layout();
      await page.goto(origin + '?processing=1', { waitUntil: 'networkidle0' }); await page.select('[data-commerce-preparation] select', 'dry-sift');
      await page.evaluate(() => window.__processing.mode('missing-quote')); await page.waitForSelector('[data-work-source="unavailable"]');
      assert(await page.$eval('[data-prepare-lot]', node => node.disabled));
      results.push({ width, scope: 'processing quote and continuation', checks: ['same server work summary before confirmation', 'official source links', 'employee hours and zero player hours', 'game and real time units', 'cancel without mutation', 'expected work token', 'blocked continuation', 'refresh employee hours', 'same request key retry', 'passive and completed statuses', 'no sentinel date', 'missing quote blocks confirmation', 'no overflow'] });

      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-guide-staff-ready="true"]');
      await keyActivate('[data-staff-work-employee="work-plan-anna"]'); await keyActivate('[data-staff-station="processing"]');
      const form = '[data-staff-work-form="work-plan-anna"]'; await page.waitForSelector(form);
      assert.equal(await page.$eval(form + ' select', node => node.value), ''); assert((await page.$eval(form + ' select', node => node.textContent)).includes('Toutes les transformations'));
      await button('Vérifier l’affectation', form); await page.waitForSelector('dialog[open]');
      assert((await page.$eval('dialog', node => node.textContent)).includes('sans relais automatique du joueur'));
      await page.keyboard.press('Escape'); assert.equal((await calls()).length, 0);
      await button('Vérifier l’affectation', form); await button('Confier ce travail', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.some(task => task.processingShift));
      assert.equal((await calls()).at(-1).targetId, undefined);
      await page.waitForSelector('[data-task-station="processing"][data-task-activity="available"]');
      assert.equal(await page.$eval('[data-staff-station-scene="processing"]', node => node.dataset.stationAnimated), 'false');
      await page.evaluate(() => window.__processingStaff.consume(.5));
      await page.waitForFunction(() => document.querySelector('[data-staff-work-station="processing"]')?.textContent.includes('0,5 h consommées'));
      await layout(); await page.$eval('[data-staff-work-station="processing"]', node => node.scrollIntoView({ block: 'center' })); await shot('processing-staff-' + width);
      await closeAssignment(); await keyActivate('[data-staff-work-plan] [data-staff-open-employee="work-plan-anna"]'); await keyActivate('dialog[data-staff-employee-sheet] [data-staff-open-weekly]');
      await keyActivate('[data-weekly-add]'); await page.select('[data-weekly-kind]', 'processing');
      assert((await page.$eval('[data-weekly-target]', node => node.textContent)).includes('Toutes les transformations'));
      assert(!(await page.$eval('[data-staff-weekly-planner]', node => node.textContent)).includes('Aucune cible disponible actuellement'));
      await layout(); assert.equal((await calls()).length, 1);
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-guide-staff-ready="true"]');
      await keyActivate('[data-staff-station="processing"]'); await page.waitForSelector('[data-player-processing-entry]');
      assert.equal(await page.$('[data-player-work-form]'), null);
      assert((await page.$eval('[data-player-processing-entry] a', node => node.href)).endsWith('?view=market&section=sales'));
      results.push({ width, scope: 'processing employee reservation', checks: ['reserve before lot exists', 'all transformations target omitted', 'cancel without mutation', 'real reserve consumption and remaining hours', 'no false work animation', 'weekly reserve before lot', 'player opens actual lot processing instead of legacy assistance', 'no overflow'] });
    }
  }
  if (cultureWorkOnly) {
    const status = '[data-culture-work-status]';
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1100, hasTouch: width < 500 });
      await page.goto(origin + '?culture-status=employee', { waitUntil: 'networkidle0' });
      await page.waitForSelector(status + '[data-work-source="employee"]');
      await page.waitForFunction(() => document.querySelector('[data-culture-work-status] [data-avatar-state="ready"]'));
      const text = await page.$eval(status, node => node.textContent.replace(/\s/g, ''));
      assert(text.includes('Annaassurecetteétape') && text.includes('0hpourtoi') && text.includes('1,5h/2h'));
      await disclosure(status + ' details', true); assert((await page.$eval(status + ' dl:not([data-help-facts])', node => node.textContent)).includes('Rendement+2 %'));
      await shot('culture-work-employee-' + width);
      await page.evaluate(() => window.__cultureWork.mode('blocked')); await page.waitForSelector(status + '[data-work-source="blocked"]');
      const blocked = await page.$eval(status, node => node.textContent);
      assert(blocked.includes('Culture en attente') && blocked.includes('davantage d’heures Culture') && blocked.includes('prochain jour travaillé'));
      assert.equal(await page.$('[data-culture-confirm-relay]'), null, 'Exhaustion offers no personal takeover');
      const beforeRefresh = await page.evaluate(() => window.__cultureWork.reads()); await button('Actualiser les heures');
      await page.waitForFunction(before => window.__cultureWork.reads() > before && document.querySelector('[data-work-source="blocked"]'), {}, beforeRefresh);
      await shot('culture-work-blocked-' + width);
      await page.evaluate(() => window.__cultureWork.mode('player')); await page.waitForSelector(status + '[data-work-source="player"]');
      await page.waitForFunction(() => document.querySelector('[data-culture-work-status] [data-avatar-state="ready"]'));
      assert((await page.$eval(status, node => node.textContent)).includes('Tu assures cette étape')); await layout();
      await page.evaluate(() => window.__cultureWork.mode('fractional')); await page.waitForSelector(status + '[data-work-source="employee"]');
      await disclosure(status + ' details', true);
      assert((await page.$eval(status, node => node.textContent)).includes('4,2 h'), 'The observed 4.2-hour personal balance remains valid while an employee covers Culture');
      await page.evaluate(() => window.__cultureWork.mode('invalid')); await page.waitForFunction(() => document.querySelector('[data-culture-work-status]')?.textContent.includes('indisponibles'));
      assert.equal(await page.$(status + '[data-work-source]'), null, 'An invalid quote is never presented as valid');
      for (const [mode, expected] of [['business-error', 'La réserve Culture de l’employé'], ['service-error', 'Prise en charge momentanément indisponible'], ['session-error', 'Ta session a expiré'], ['error', 'Les heures de cette étape sont indisponibles'], ['network-error', 'Les heures de cette étape sont indisponibles']]) {
        const before = await page.evaluate(() => window.__cultureWork.reads());
        await page.evaluate(mode => window.__cultureWork.mode(mode), mode);
        await page.waitForFunction(({ before, expected }) => window.__cultureWork.reads() > before && document.querySelector('[data-culture-work-status]')?.textContent.includes(expected), {}, { before, expected });
        assert.equal(await page.$(status + '[data-work-source]'), null, 'Failed reads never authorize work');
        assert(!(await page.$eval(status, node => node.textContent)).includes('private database detail'), 'Internal errors stay hidden');
      }
      await button('Actualiser les heures');
      await page.evaluate(() => window.__cultureWork.mode('employee')); await page.waitForSelector(status + '[data-work-source="employee"]');
      await page.goto(origin + '?culture-status=legacy', { waitUntil: 'networkidle0' }); await page.waitForFunction(() => document.querySelector('[data-culture-work-status]')?.textContent.includes('Étape déjà engagée'));
      assert.equal(await page.$(status + ' dl:not([data-help-facts])'), null, 'Legacy stages invent neither bonus nor a receipt'); await layout();
      results.push({ width, scope: 'culture stage work status', checks: ['actual staff portrait', 'server remaining hours', 'employee cost without player cost', 'keyboard bonus details', 'exhaustion blocks with added-hours or next-workday guidance', 'no personal takeover action', 'blocked quote can refresh', 'actual player portrait for never-delegated culture', 'fractional personal balance preserved', 'invalid quote rejected', 'known business, service and session explanations', 'HTTP and transport internals hidden', 'read failure and recovery', 'legacy stage without invented receipt', 'no overflow'] });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-guide-staff-ready="true"]');
      assert.equal((await raw()).context.activeRuns.length, 0);
      await keyActivate('[data-staff-work-employee="work-plan-anna"]'); await keyActivate('[data-staff-station="culture"]');
      const form = '[data-staff-work-form="work-plan-anna"]'; await page.waitForSelector(form);
      assert.equal(await page.$eval(form + ' select', node => node.value), ''); assert((await page.$eval(form + ' select', node => node.textContent)).includes('Toutes les cultures'));
      await button('Vérifier l’affectation', form); await page.waitForSelector('dialog[open]');
      assert((await page.$eval('dialog', node => node.textContent)).includes('4 étapes à 0,5 h')); await page.keyboard.press('Escape'); assert.equal((await calls()).length, 0);
      await button('Vérifier l’affectation', form); await button('Confier ce travail', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.tasks.some(task => task.cultureShift));
      const command = (await calls()).at(-1), task = (await raw()).state.tasks.at(-1); assert.equal(command.targetId, undefined); assert.equal(task.cultureUsedHours, 0);
      await page.waitForSelector('[data-task-activity="available"]'); assert.equal(await page.$eval('[data-staff-station-scene="culture"]', node => node.dataset.stationAnimated), 'false');
      await page.evaluate(() => window.__cultureWork.consume(.5)); await page.waitForFunction(() => document.querySelector('[data-staff-work-station="culture"]')?.textContent.includes('0,5 h consommées'));
      await page.$eval('[data-staff-work-station="culture"]', node => node.scrollIntoView({ block: 'center' })); await shot('culture-work-reservation-' + width);
      await closeAssignment(); await keyActivate('[data-staff-work-plan] [data-staff-open-employee="work-plan-anna"]'); await keyActivate('dialog[data-staff-employee-sheet] [data-staff-open-weekly]');
      await keyActivate('[data-weekly-add]'); assert((await page.$eval('[data-weekly-target]', node => node.textContent)).includes('Toutes les cultures'));
      assert(!(await page.$eval('[data-staff-weekly-planner]', node => node.textContent)).includes('Aucune cible disponible actuellement'));
      await layout(); assert.equal((await calls()).length, 1, 'Reviewing the weekly budget remains read only');
      results.push({ width, scope: 'culture employee reservation', checks: ['reserve before culture starts', 'all cultures target omitted', 'half-hour stages in confirmation', 'cancel without mutation', 'one explicit reservation', 'consumption and remainder', 'available portrait without fake work animation', 'weekly all-cultures budget without missing-target warning'] });
    }
  }
  if (weeklyPlanOnly) {
    const employeeId = 'work-plan-anna', dossier = '[data-staff-employee-id="work-plan-anna"]';
    const planner = '[data-staff-weekly-planner="work-plan-anna"]';
    const ready = () => page.waitForSelector('[data-guide-staff-ready="true"]');
    const refresh = async () => { const before = await page.evaluate(() => window.__staff.reads()); await button('Actualiser'); await page.waitForFunction(before => window.__staff.reads() > before, {}, before); await ready(); };
    const open = async (id = employeeId) => { await keyActivate(`[data-staff-work-plan] [data-staff-open-employee="${id}"]`); await keyActivate('dialog[data-staff-employee-sheet] [data-staff-open-weekly]'); await page.waitForSelector(`[data-staff-weekly-planner="${id}"]`); await page.waitForFunction(id => document.activeElement?.matches(`[data-staff-employee-id="${id}"] [data-staff-planning-mode="week"]`), {}, id); };
    const hours = async (slot, value) => { await page.focus(`${planner} [data-weekly-slot="${slot}"] [data-weekly-hours]`); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type(String(value)); await page.keyboard.press('Tab'); };
    const add = async (kind, index) => { await keyActivate(planner + ' [data-weekly-add]'); await page.select(`${planner} [data-weekly-slot="${index}"] [data-weekly-kind]`, kind); };
    const cost = () => page.$eval(planner + ' [data-weekly-cost]', node => Math.round(Number(node.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100));
    const assertPlannerLayout = async () => { await layout(); assert(await page.$eval(planner, node => node.scrollWidth <= node.clientWidth + 1), 'Weekly planner has no internal horizontal overflow'); };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1100, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await ready(); await open();
      assert.equal((await calls()).length, 0, 'Opening weekly planning is read only');
      assert(await page.$eval(planner + ' [data-weekly-activate]', node => node.disabled), 'An empty template cannot activate');
      await keyActivate(planner + ' [data-weekly-day="1"]');
      await add('training', 0); await hours(0, 2);
      await add('sales', 1); assert(await page.$eval(planner + ' [data-weekly-activate]', node => node.disabled), 'A city is required before confirmation');
      await page.select(planner + ' [data-weekly-slot="1"] [data-weekly-city]', 'brest');
      await add('trim', 2); await hours(2, 1);
      await page.focus(planner + ' [data-weekly-trim-mode]'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); assert.equal(await page.$eval(planner + ' [data-weekly-trim-mode]', node => node.value), 'machine'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); assert.equal(await page.$eval(planner + ' [data-weekly-trim-mode]', node => node.value), 'manual', 'Trim mode remains operable with the keyboard');
      assert.equal(await cost(), 13000, 'The week shows the actual training and travel costs');
      assert(await page.$eval(planner + ' [data-weekly-add]', node => node.disabled), 'Three slots is the daily limit');
      assert.equal(await page.$(planner + ' [data-weekly-target]'), null, 'Shared trim requires no lot selection');
      await assertPlannerLayout(); await page.$eval(planner, node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot(`weekly-plan-editor-${width}`);
      await keyActivate(planner + ' [data-weekly-activate]'); await page.waitForSelector('dialog[open]');
      const review = await page.$eval('dialog[open]', node => node.textContent);
      assert(/prochain jour/.test(review) && /130/.test(review) && /hors salaires/.test(review), 'Confirmation explains timing and recurring cost');
      assert.equal((await calls()).length, 0, 'Reviewing the complete plan makes no POST');
      await shot(`weekly-plan-confirm-${width}`);
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); assert.equal((await calls()).length, 0, 'Cancelling the review sends no command'); assert.equal(await cost(), 13000, 'Cancelling preserves the draft'); await page.waitForFunction(() => document.activeElement?.matches('[data-weekly-activate]')); await keyActivate(planner + ' [data-weekly-activate]');
      if (width === 320) await page.evaluate(() => window.__staff.failNext());
      await button('Activer la semaine', 'dialog');
      if (width === 320) { await page.waitForSelector('dialog [role="alert"]'); await button('Réessayer la confirmation', 'dialog'); const posts = await calls(); assert.equal(posts.at(-1).requestKey, posts.at(-2).requestKey, 'Retry keeps its request key'); }
      await page.waitForSelector(dossier + ' [data-weekly-plan-status="enabled"]');
      const activated = await raw();
      assert.equal(activated.cashCents, 2500000, 'Activating a schedule charges nothing immediately'); assert.equal(activated.state.tasks.length, 0, 'No retroactive task starts today');
      assert.equal(activated.state.employees[0].weeklyPlan.nextDay, 2);
      const posted = (await calls()).at(-1); assert.equal(posted.action, 'set-weekly-plan'); assert.equal(posted.expectedWeeklyCostCents, 13000); assert.equal(posted.days[1][2].kind, 'trim'); assert(!posted.days[1][2].targetId);
      await page.evaluate(() => window.__weeklyPlan.advance(2)); await refresh();
      const started = await raw(); assert.equal(started.state.tasks.length, 3); assert.equal(started.cashCents, 2487000); assert.equal(started.state.employees[0].workDays['2'].usedHours, 5);
      assert(started.state.tasks.every(task => task.weeklyPlanAt && task.status === 'running')); assert.equal(started.state.tasks[2].trimQueue, true);
      assert.equal(started.state.tasks[2].trimGrams, 0, 'Queued shared trim claims no premature result');
      await refresh(); assert.deepEqual(await raw(), started, 'Reading the same occurrence cannot charge or reserve twice');
      const postsBeforeTab = (await calls()).length;
      await keyActivate(dossier + ' [data-staff-planning-mode="day"]'); assert.equal((await calls()).length, postsBeforeTab, 'Changing tab cannot pause a schedule');
      assert(await page.$eval(dossier + ' [data-staff-work-form] fieldset', node => node.disabled), 'Manual work waits for an explicit pause');
      await keyActivate(dossier + ' [data-weekly-pause]'); assert.equal((await calls()).length, postsBeforeTab, 'Pause requires confirmation'); await button('Confirmer la pause', 'dialog');
      await page.waitForSelector(dossier + ' [data-weekly-plan-status="paused"]');
      const paused = await raw(); assert.deepEqual(paused.state.tasks, started.state.tasks, 'Pausing preserves all current reservations'); assert.equal(paused.cashCents, started.cashCents);
      await page.evaluate(() => window.__weeklyPlan.advance(9, 6)); await refresh();
      const after = await raw(); assert.equal(after.state.tasks.length, 3, 'The following week does not repeat a paused plan'); assert(after.state.tasks.every(task => task.status === 'completed')); assert.equal(after.cashCents, started.cashCents);
      assert(after.state.employees[0].skills.processing > activated.state.employees[0].skills.processing, 'Finishing current training grants real XP after a pause'); assert(after.state.tasks[2].trimGrams > 0, 'Current shared trim finishes against actual stock');
      await keyActivate(dossier + ' [data-staff-planning-mode="week"]'); await disclosure(planner + ' [data-weekly-history]', true); await page.$eval(planner + ' [data-weekly-history]', node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await shot(`weekly-plan-history-${width}`);
      results.push({ width, scope: 'weekly schedule activation and continuity', checks: ['keyboard entry from employee sheet and focus placement', 'keyboard duration and trim mode fields', 'five days and three-slot limit', 'actual 130 euro weekly cost excluding wages', 'review and Escape cancellation have no POST and preserve draft and focus', ...(width === 320 ? ['503 retry uses same key'] : []), 'starts next day with actual fees and five hours', 'read idempotence', 'shared trim has no target or premature grams', 'day tab does not pause', 'explicit pause preserves current work and earned XP', 'no following-week start while paused', 'history and no overflow'] });
    }
    await page.setViewport({ width: 320, height: 844, hasTouch: true }); await page.goto(origin, { waitUntil: 'networkidle0' }); await ready(); await open('work-plan-mael');
    const partTime = '[data-staff-weekly-planner="work-plan-mael"]'; await keyActivate(partTime + ' [data-weekly-day="2"]'); assert.equal(await page.$(partTime + ' [data-weekly-add]'), null, 'A 14-hour contract has Wednesday off'); assert((await page.$eval(partTime + ' [data-weekly-day-panel="2"]', node => node.textContent)).includes('Repos'));
    await open(); await keyActivate(planner + ' [data-weekly-add]'); await hours(0, 8); assert(await page.$eval(planner + ' [data-weekly-activate]', node => node.disabled), 'Over seven hours is rejected'); await hours(0, 2);
    assert.equal(await page.$eval(planner + ' [data-weekly-target]', node => node.value), '', 'A culture can retain automatic targeting');
    await keyActivate(planner + ' [data-weekly-save-paused]'); await button('Enregistrer en pause', 'dialog'); await page.waitForSelector(dossier + ' [data-weekly-plan-status="paused"]');
    assert.equal((await raw()).state.tasks.length, 0); assert.equal((await raw()).cashCents, 2500000); assert.equal((await calls()).at(-1).days[0][0].targetId, undefined);
    await page.evaluate(() => window.__weeklyPlan.availability(false)); await page.waitForSelector('[data-staff-desk] [role="alert"]'); assert(await page.$eval(planner + ' [data-weekly-activate]', node => node.disabled), 'Stale data cannot prepare a new schedule');
    await page.evaluate(() => window.__weeklyPlan.availability(true)); await ready(); await page.goto(origin + '?no-weekly', { waitUntil: 'networkidle0' }); await ready(); await open(); await page.waitForSelector('[data-weekly-unavailable]'); assert.equal(await page.$('[data-weekly-activate]'), null); assert.equal((await calls()).length, 0);
    await shot('weekly-plan-unavailable-320');
    await page.goto(origin + '?read-error', { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-staff-desk] [role="alert"]'); assert.equal(await page.$('[data-staff-weekly-planner]'), null); assert.equal((await calls()).length, 0); await page.evaluate(() => window.__weeklyPlan.availability(true)); await ready();
    results.push({ width: 320, scope: 'weekly plan guards and availability', checks: ['part-time contractual days', 'seven-hour limit', 'automatic target omitted from command', 'paused save has no work or fees', 'stale read disables editing', 'server capability absence shows no action', 'first read failure creates no fictional plan', 'recovery'] });
  }
  if (employeeSheetOnly && !contractLifecycleOnly) {
    const sheet = 'dialog[data-staff-employee-sheet]', plan = '[data-staff-work-plan]';
    const opener = id => `${plan} [data-staff-open-employee="${id}"]`;
    const expected = id => page.evaluate(id => window.__employeeSheet.expected(id), id);
    const open = async id => { await keyActivate(opener(id)); await page.waitForSelector(sheet + '[open]', { visible: true }); await page.waitForFunction(() => document.querySelector('[data-staff-employee-sheet]')?.contains(document.activeElement)); };
    const returnedFocus = id => page.waitForFunction(selector => document.querySelector(selector) === document.activeElement, {}, opener(id));
    const escape = async id => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[data-staff-employee-sheet][open]')); await returnedFocus(id); };
    const sheetLayout = async () => { await layout(); assert(await page.$eval(sheet, node => { const box = node.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1; }), 'The dialog fits the viewport with no internal horizontal overflow'); };
    const verify = async id => {
      const { employee, cost, levels } = await expected(id);
      const text = (await page.$eval(sheet, node => node.textContent)).replace(/\s/g, '');
      assert(text.includes(employee.name.replace(/\s/g, '')), 'The sheet names the requested employee');
      assert(text.includes(String(employee.weeklyHours) + 'h'), 'The saved weekly hours are visible');
      if (employee.endsAt) assert(await page.$(`${sheet} time[datetime="${employee.endsAt}"]`), 'The saved end date remains present for the fixed-term contract');
      for (const [field, cents] of [['gross', cost.grossCents], ['employer', cost.employerCents], ['total', cost.totalCents]]) assert.equal(await page.$eval(`${sheet} [data-staff-sheet-cost="${field}"]`, node => Math.round(Number(node.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100)), cents, 'The sheet shows the actual monthly ' + field);
      assert(/estim/i.test(text), 'Monthly costs are explicitly identified as estimates');
      for (const [skill, level] of Object.entries(levels)) {
        const row = `${sheet} [data-staff-sheet-skill="${skill}"]`;
        assert.equal(await page.$eval(row + ' [role="meter"]', node => Number(node.getAttribute('aria-valuenow'))), level, 'The skill meter uses the saved level for ' + skill);
        assert((await page.$eval(row, node => node.textContent)).replace(/\s/g, '').includes(employee.skills[skill] + 'XP'), 'The saved XP is readable for ' + skill);
      }
      await sheetLayout();
    };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1100, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-guide-staff-ready="true"]'); await page.evaluate(() => document.fonts.ready);
      const before = await raw();
      await keyActivate('[data-staff-work-employee="work-plan-anna"]');
      await open('work-plan-anna'); await verify('work-plan-anna');
      await page.waitForSelector(sheet + ' canvas[data-avatar-state="ready"]');
      const anna = await page.$eval(sheet + ' canvas', node => node.toDataURL());
      const focusable = await page.$$eval(sheet + ' button, ' + sheet + ' a[href], ' + sheet + ' [tabindex="0"]', nodes => nodes.filter(node => !node.disabled && node.getClientRects().length).length);
      assert(focusable > 0, 'The sheet exposes a keyboard close control');
      for (let index = 0; index <= focusable; index++) { await page.keyboard.press('Tab'); assert(await page.$eval(sheet, node => node.contains(document.activeElement)), 'Tab stays inside the modal'); }
      await page.$eval(sheet, node => { node.scrollTop = 0; }); await shot(`employee-sheet-anna-${width}`);
      await escape('work-plan-anna');
      assert.equal(await page.$eval('[data-staff-work-employee="work-plan-anna"]', node => node.getAttribute('aria-pressed')), 'true', 'Reading a sheet preserves the selected worker');
      await keyActivate('[data-staff-station="culture"]'); await page.waitForSelector('[data-staff-work-form="work-plan-anna"]');
      await open('work-plan-mael'); await verify('work-plan-mael');
      await page.waitForSelector(sheet + ' canvas[data-avatar-state="ready"]'); assert.notEqual(await page.$eval(sheet + ' canvas', node => node.toDataURL()), anna, 'The second employee keeps their own portrait');
      assert((await page.$eval(sheet, node => node.textContent)).includes('CDD'), 'The part-time fixed-term contract is identified');
      await page.$eval(sheet, node => { node.scrollTop = 0; }); await shot(`employee-sheet-mael-${width}`);
      if (width === 390) { await button('Fermer', sheet); await page.waitForFunction(() => !document.querySelector('[data-staff-employee-sheet][open]')); await returnedFocus('work-plan-mael'); }
      else await escape('work-plan-mael');
      assert(await page.$('[data-staff-work-form="work-plan-anna"]'), 'Inspecting a colleague preserves the prepared assignment');
      assert.equal(await page.$eval('[data-staff-work-employee="work-plan-anna"]', node => node.getAttribute('aria-pressed')), 'true', 'Inspecting Maël does not select him for the current assignment');
      await closeAssignment('culture');
      assert.deepEqual(await raw(), before, 'Reading both employee sheets changes neither money nor work'); assert.equal((await calls()).length, 0);
      results.push({ width, scope: 'employee sheet consultation', checks: ['keyboard opening and native modal focus containment', 'Escape returns to exact opener', 'actual employee portrait', 'five saved skill levels and XP', 'CDI35h and CDD14h', 'monthly salary plus employer charges and total estimate', 'no horizontal overflow', 'selected worker and draft assignment preserved', 'no POST or game mutation'], mutations: 0 });
    }
    // An actual pointer drag still prepares an assignment after a sheet closes.
    await page.$eval(plan, node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    const from = await page.$eval('[data-staff-work-employee="work-plan-anna"]', node => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
    const to = await page.$eval('[data-staff-work-station="communication"]', node => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 20 }); await page.mouse.up();
    await page.waitForSelector('[data-staff-work-form="work-plan-anna"][data-staff-work-kind="communication"]'); await closeAssignment('communication');
    assert.equal((await calls()).length, 0, 'Dragging still prepares without submitting');
    await page.setViewport({ width: 320, height: 844, hasTouch: true }); await open('work-plan-anna');
    const beforeError = await raw(); await page.evaluate(() => window.__employeeSheet.availability(false));
    await page.waitForSelector('[data-staff-sheet-stale]');
    assert(await page.$eval(sheet, node => [...node.querySelectorAll('button')].find(button => button.textContent.trim() === 'Organiser sa journée')?.disabled), 'Stale details stay readable while new planning is disabled');
    await verify('work-plan-anna'); assert.deepEqual(await raw(), beforeError, 'A failed read preserves the saved employee and salary'); await shot('employee-sheet-stale-320');
    await page.evaluate(() => window.__employeeSheet.availability(true)); await page.waitForSelector('[data-guide-staff-ready="true"]'); await escape('work-plan-anna');
    await page.goto(origin + '?read-error', { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-staff-desk] [role="alert"]');
    assert.equal(await page.$(sheet + '[open]'), null); assert.equal(await page.$('[data-staff-open-employee]'), null, 'An unavailable first read cannot invent an employee sheet');
    await page.evaluate(() => window.__employeeSheet.availability(true)); await page.waitForSelector('[data-guide-staff-ready="true"]'); await open('work-plan-mael'); await verify('work-plan-mael'); await escape('work-plan-mael');
    assert.equal((await calls()).length, 0);
    results.push({ width: 320, scope: 'employee sheet availability and assignment continuity', checks: ['real pointer drag survives modal use', 'failed read retains confirmed details with visible warning', 'initial unavailable read has no invented employee', 'read recovery opens actual employee', 'no POST'], mutations: 0 });
  }
  if (sharedTrimOnly) {
    // LAN HTTP browsers expose getRandomValues but not randomUUID.
    await page.evaluateOnNewDocument(() => {
      if (innerWidth === 320) Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    });
    const scene = '[data-trim-scene]', worker = '[data-trim-worker]';
    const selectWorker = async id => {
      const selector = worker + ' input[data-work-actor-choice="' + id + '"]';
      await page.$eval(selector, node => node.closest('label').scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      await page.focus(selector); await page.keyboard.press('Space');
      await page.waitForFunction(id => document.querySelector('[data-trim-worker]')?.dataset.trimWorker === id, {}, id);
    };
    const wait = milliseconds => new Promise(done => setTimeout(done, milliseconds));
    const taskCount = count => page.waitForFunction(count => window.__staff.raw().state.tasks.filter(task => task.kind === 'trim').length === count, {}, count);
    const start = async (employeeId, hours, mode = 'manual') => {
      await selectWorker(employeeId); await input('Heures de trim', hours); await button(mode === 'manual' ? 'Manuel' : 'Machine');
      await button('Vérifier le trim'); await button('Confirmer le trim', 'dialog');
    };
    const painted = () => page.$$eval('[data-trim-moving-part]', nodes => nodes.map(node => { const style = getComputedStyle(node); return { part: node.dataset.trimMovingPart, transform: style.transform, animation: style.animationName, playState: style.animationPlayState }; }));
    const frozen = async label => { await painted(); await wait(200); const before = await painted(); assert(before.every(item => item.playState === 'paused' || item.animation === 'none'), label + ' pauses every tool'); await wait(250); assert.deepEqual(await painted(), before, label + ' preserves the painted tools'); };
    for (const width of sharedTrimEdgeOnly ? [] : [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
      if (width === 320) assert.equal(await page.evaluate(() => typeof crypto.randomUUID), 'undefined', 'Mobile LAN regression runs without native randomUUID');
      await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector(worker);
      assert.equal(await page.$$eval('[data-workshop-trim-desk] button', nodes => nodes.some(node => /^(Préparer le trim|Suivre le trim|Refermer le lot)$/.test(node.textContent.trim()))), false, 'Shared stock requires no lot chooser');
      await input('Heures de trim', '1');
      await button('Verrouiller le parent'); assert(await page.$eval('[data-workshop-trim-desk] button[type="submit"]', node => node.disabled), 'Parent lock prevents a new reservation'); await button('Déverrouiller le parent');
      await button('Vérifier le trim');
      const review = (await page.$eval('dialog', node => node.textContent)).replace(/\s+/g, ' ');
      assert(review.includes('60') && review.includes('10 min') && review.includes('1 h'), 'Level-one manual quote exposes 60 grams and ten real minutes per game hour');
      assert.equal((await calls()).length, 0, 'Reviewing reserves no hours'); await page.keyboard.press('Escape');
      await button('Vérifier le trim');
      if (width === 320) await page.evaluate(() => window.__staff.failNext());
      if (width === 390) await page.evaluate(() => window.__staff.loseNextResponse());
      await button('Confirmer le trim', 'dialog');
      if (width < 500) {
        await page.waitForSelector('dialog [role="alert"]');
        assert.equal((await raw()).state.tasks.filter(task => task.kind === 'trim').length, width === 320 ? 0 : 1, 'The transport fixture distinguishes rejected and saved-but-lost responses');
        await button('Réessayer la confirmation', 'dialog');
        const attempted = await calls(); assert.equal(attempted[0].requestKey, attempted[1].requestKey, 'Retry reuses the exact operation key');
      }
      await taskCount(1); await page.waitForSelector(worker);
      assert.equal((await raw()).state.playerWorkDays['1'].usedHours, 1);
      await start('work-plan-anna', '1'); await taskCount(2);
      await selectWorker('work-plan-mael'); await input('Heures de trim', '0.5'); await button('Manuel'); await button('Vérifier le trim');
      assert((await page.$eval('dialog', node => node.textContent)).includes('150'), 'A level-ten worker is quoted at 150 grams per game hour by hand'); await page.keyboard.press('Escape');
      await button('Machine'); await button('Vérifier le trim');
      assert((await page.$eval('dialog', node => node.textContent)).includes('600'), 'The machine offers four times the same worker rate'); await page.keyboard.press('Escape');
      await button('Manuel'); await button('Vérifier le trim'); await button('Confirmer le trim', 'dialog'); await taskCount(3);
      const scheduled = await raw(), tasks = scheduled.state.tasks.filter(task => task.kind === 'trim');
      assert(tasks.every(task => task.trimQueue && !('targetId' in task) && task.startedAt === scheduled.serverNow), 'Three different workers join the same stock concurrently');
      assert.deepEqual(tasks.map(task => task.trimRateGramsPerHour), [60, 60, 150]);
      assert.deepEqual(tasks.map(task => Date.parse(task.completesAt) - Date.parse(task.startedAt)), [600000, 600000, 300000]);
      assert(tasks.every(task => task.trimGrams === 0 && task.trimContributions.length === 0), 'Confirmation never reports estimated grams as actual progress');
      assert((await calls()).filter(command => command.action === 'trim').every(command => !('flowerId' in command)), 'No submitted trim command selects a flower');
      if (width === 320) {
        const trimKeys = (await calls()).filter(command => command.action === 'trim').map(command => command.requestKey);
        assert(trimKeys.every(key => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)), 'LAN trim submits valid UUID v4 request keys');
        assert.equal(new Set(trimKeys).size, 3, 'Each confirmed trim gets its own key while retries keep the original');
        results.push({ width, scope: 'trim without native randomUUID', checks: ['confirmation opens', 'valid UUID v4 request keys', 'distinct operations', 'same-key retry'], mutations: trimKeys.length });
      }
      assert(await page.$(worker), 'The allocation form remains available while colleagues work');
      await page.waitForFunction(() => document.querySelectorAll('[data-trim-scene] canvas[data-avatar-state="ready"]').length >= 3);
      const avatars = await page.$$eval('[data-trim-scene] canvas[data-avatar-state="ready"]', nodes => nodes.map(node => node.toDataURL()));
      assert(new Set(avatars).size >= 3, 'The actual player, Anna and Maël keep distinct avatars');
      await page.$eval(scene, node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot(`shared-trim-team-${width}`);
      await frozen('Reduced motion');
      if (width === 390) {
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
        await page.$eval(scene, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.waitForFunction(() => document.querySelector('[data-trim-scene]')?.dataset.motionState === 'running');
        const fixedArt = () => page.$$eval('[data-trim-static-art]', nodes => nodes.map(node => { const style = getComputedStyle(node); return { part: node.dataset.trimStaticArt, transform: style.transform, animation: style.animationName }; }));
        const fixedBefore = await fixedArt(), beforeMotion = await painted(); await wait(400); assert.notDeepEqual(await painted(), beforeMotion, 'Confirmed concurrent workers move their tools'); assert.deepEqual(await fixedArt(), fixedBefore, 'The illustrated bench never moves with the articulated tools');
        await keyActivate('[data-trim-motion-toggle]'); await frozen('User pause');
        await button('Actualiser'); await frozen('Pause survives the server refresh');
        await keyActivate('[data-trim-motion-toggle]');
        await page.evaluate(() => { const spacer = document.createElement('div'); spacer.dataset.trimAuditSpacer = ''; spacer.style.height = '200vh'; document.body.append(spacer); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); });
        await page.waitForFunction(() => document.querySelector('[data-trim-scene]')?.dataset.motionState === 'offscreen'); await frozen('Offscreen scene');
        await page.evaluate(() => document.querySelector('[data-trim-audit-spacer]').remove()); await page.$eval(scene, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const other = await browser.newPage(); let realHidden = false;
        try { await other.bringToFront(); realHidden = await page.evaluate(() => document.hidden); if (!realHidden) await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForFunction(() => document.querySelector('[data-trim-scene]')?.dataset.motionState === 'hidden'); await frozen('Hidden tab'); }
        finally { if (!realHidden) await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); }); await other.close(); await page.bringToFront(); }
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await frozen('Live reduced-motion preference');
        const playerCanvas = '[data-trim-worker-id="player"] canvas', playerPortrait = await page.$eval(playerCanvas, node => node.toDataURL());
        for (const status of ['null', 'error']) { await page.evaluate(status => window.__sharedTrim.profile(status), status); await page.waitForSelector(playerCanvas, { hidden: true }); assert.equal(await page.$$eval('[data-trim-character="employee"] canvas[data-avatar-state="ready"]', nodes => nodes.length), 2, 'Employee portraits survive unavailable player identity'); assert(await page.$('[data-trim-worker-row="player"]'), 'The assigned player remains named when their portrait is unavailable'); }
        await page.evaluate(() => window.__sharedTrim.profile('ready')); await page.waitForSelector(playerCanvas + '[data-avatar-state="ready"]'); assert.equal(await page.$eval(playerCanvas, node => node.toDataURL()), playerPortrait, 'Profile recovery restores the same customized player');
        assert.deepEqual(await raw(), scheduled, 'Animation never changes credited grams, money or planning');
      }
      await selectWorker('player'); await input('Heures de trim', '12'); assert(await page.$eval('[data-workshop-trim-desk] button[type="submit"]', node => node.disabled), 'Player cannot exceed eleven remaining hours');
      await selectWorker('work-plan-anna'); await input('Heures de trim', '7'); assert(await page.$eval('[data-workshop-trim-desk] button[type="submit"]', node => node.disabled), 'Employee cannot exceed six remaining hours');
      await input('Heures de trim', '0.5');
      await page.evaluate(() => window.__sharedTrim.advance(5)); await button('Actualiser');
      await page.waitForFunction(() => window.__staff.raw().context.trimLots[0].completedGrams === 90);
      const partial = await raw(); assert.deepEqual(partial.context.trimLots.map(lot => lot.completedGrams), [90, 45], 'Concurrent throughput fills the oldest lot before the next lot');
      assert.equal(partial.state.tasks.reduce((sum, task) => sum + (task.trimGrams ?? 0), 0), 135, 'Only actual credited grams reach worker receipts');
      await page.$eval(scene, node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot(`shared-trim-progress-${width}`);
      await page.evaluate(() => window.__sharedTrim.availability(false)); await button('Actualiser'); await page.waitForSelector('[data-workshop-trim-desk] [role="alert"]');
      assert(await page.$eval('[data-workshop-trim-desk] button[type="submit"]', node => node.disabled), 'An unavailable read disables further reservation');
      await frozen('Unavailable stock'); assert.deepEqual(await raw(), partial, 'Failed refresh preserves the confirmed grams');
      await page.evaluate(() => { window.__sharedTrim.availability(true); window.__sharedTrim.advance(10); }); await button('Actualiser');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.every(task => task.status === 'completed'));
      const completed = await raw(); assert.deepEqual(completed.context.trimLots.map(lot => lot.completedGrams), [90, 105]); assert.equal(completed.cashCents, scheduled.cashCents);
      assert.equal(completed.state.tasks.length, 3); assert.equal(completed.state.playerWorkDays['1'].usedHours, 1);
      await page.$eval('[data-workshop-trim-desk]', node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot(`shared-trim-confirmed-${width}`);
      await button('Retrouver cette récolte →'); assert.deepEqual(await page.evaluate(() => window.__staff.openedHarvests), ['trim-manual']);
      await button('Personnel', '[aria-label="Navigation de recette"]'); await page.waitForSelector('[data-guide-staff-ready="true"]');
      assert.equal((await raw()).state.employees.find(employee => employee.id === 'work-plan-anna').workDays['1'].usedHours, 1, 'The same employee planning is retained in Personnel');
      results.push({ width, scope: 'shared trim stock', checks: ['no lot chooser or flowerId command', 'review and parent lock', 'rejected and lost-response same-key retry', 'player plus two concurrent employees', '60 and 150 grams/hour; machine times four', 'ten real minutes/game hour', 'actual distinct avatars', 'form remains available', 'player and employee capacity', 'oldest harvest first', 'confirmed grams separate from estimates', 'read failure preserves progress', 'motion pause and reduced motion', 'harvest callback', 'no horizontal overflow'], tasks: 3, confirmedGrams: 195, mutations: (await calls()).length });
    }
    if (!sharedTrimEdgeOnly) {
    await page.setViewport({ width: 390, height: 844, hasTouch: true }); await page.goto(origin, { waitUntil: 'networkidle0' }); await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector(worker);
    await start('player', '0.5', 'machine'); await taskCount(1); assert.equal((await raw()).state.tasks[0].trimRateGramsPerHour, 240);
    await page.evaluate(() => window.__sharedTrim.advance(5)); await button('Actualiser'); await page.waitForFunction(() => window.__staff.raw().state.tasks[0].status === 'completed');
    assert.deepEqual((await raw()).context.trimLots.map(lot => lot.completedGrams), [90, 30], 'A level-one machine task credits 120 grams across FIFO lots in five minutes');
    results.push({ width: 390, scope: 'machine actual throughput', checks: ['240 grams/hour at level one', 'five real minutes for half a game hour', '120 actual grams across two FIFO lots'], mutations: 1 });
    await page.goto(origin + '?unowned', { waitUntil: 'networkidle0' }); await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector(worker);
    await button('Machine'); assert(await page.$eval('[data-workshop-trim-desk] button[type="submit"]', node => node.disabled), 'Machine requires its confirmed purchase');
    await button('Vérifier cet achat'); assert((await page.$eval('dialog', node => node.textContent)).replace(/\s/g, '').includes('1500'), 'Purchase keeps its actual price'); await page.keyboard.press('Escape');
    await page.evaluate(() => window.__sharedTrim.empty()); await button('Actualiser'); await page.waitForFunction(() => document.querySelector('[data-workshop-trim-desk] button[type="submit"]')?.disabled); assert.equal((await calls()).length, 0);
    await shot('shared-trim-empty-390');
    await page.evaluate(() => window.__sharedTrim.omit()); await button('Actualiser'); await page.waitForFunction(() => !document.querySelector('[data-trim-worker]') && document.querySelector('[data-workshop-trim-desk]')?.textContent.includes('disponible'));
    assert.equal((await calls()).length, 0);
    results.push({ scope: 'shared trim stock prerequisites', checks: ['unowned machine blocks work', 'purchase review without payment', 'empty stock blocks reservation', 'missing stock does not invent zero progress'], mutations: 0 });
    }
    if (sharedTrimEdgeOnly) {
      await page.setViewport({ width: 320, height: 844, hasTouch: true }); await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await page.goto(origin, { waitUntil: 'networkidle0' }); await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector(worker);
      await start('player', '1', 'machine'); await taskCount(1); await start('work-plan-anna', '1'); await taskCount(2); await start('work-plan-mael', '0.5'); await taskCount(3); await start('work-plan-anna', '0.5'); await taskCount(4);
      await disclosure('[data-trim-worker-row="work-plan-anna"] details', true);
      assert((await page.$eval('[data-trim-worker-row="work-plan-anna"] details', node => node.textContent)).includes('0,5 h'), 'Additional queued trim reservations remain available by keyboard');
      await page.waitForSelector('[data-trim-worker-row="work-plan-mael"][data-trim-worker-state="queued"]');
      assert.equal(await page.$eval('[data-trim-current-rate]', node => node.textContent), '300 g / h de jeu', 'Queued Maël does not contribute his 150 grams/hour to current throughput');
      await page.evaluate(() => window.__sharedTrim.advance(5)); await button('Actualiser');
      await page.waitForSelector('[data-trim-worker-row="player"][data-trim-worker-state="waiting-harvest"]');
      assert.equal(await page.$eval('[data-trim-current-rate]', node => node.textContent), '60 g / h de jeu', 'Idle machine and queued worker are excluded while Anna still works');
      assert.deepEqual((await raw()).context.trimLots.map(lot => lot.completedGrams), [120, 30]);
      assert.equal((await raw()).state.tasks.find(task => task.kind === 'trim' && task.employeeId === 'player').trimGrams, 120, 'No compatible stock means no invented machine progress');
      await page.$eval(scene, node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('[data-trim-scene]')?.dataset.motionState === 'running');
      const machine = '[data-trim-moving-part="rotor"]';
      const rotor = await page.$eval(machine, node => ({ transform: getComputedStyle(node).transform, playState: getComputedStyle(node).animationPlayState })); await wait(350);
      assert.equal(rotor.playState, 'paused'); assert.deepEqual(await page.$eval(machine, node => ({ transform: getComputedStyle(node).transform, playState: getComputedStyle(node).animationPlayState })), rotor, 'The exhausted machine visibly pauses while other work continues');
      await shot('shared-trim-compatible-empty-320');
      await page.$eval('[data-trim-worker-row="player"]', node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot('shared-trim-compatible-workers-320');
      const posted = (await calls()).length;
      assert.equal(posted, 4); assert.equal((await raw()).state.playerWorkDays['1'].usedHours, 1, 'An idle worker retains the confirmed reservation');
      results.push({ width: 320, scope: 'compatible stock exhaustion and queued workers', checks: ['current rate excludes queued workers', 'current rate excludes workers without compatible stock', 'additional queued reservations remain consultable', 'manual colleague continues', 'machine stops animating', 'only actual grams credited', 'reserved hours preserved', 'four explicit commands', 'no overflow'], mutations: posted });
    }
  }
  if (archiveOnly) {
    const archive = '[data-staff-archive]', dossier = '[aria-labelledby="staff-archived-contract-name"]';
    const archiveCalls = () => page.evaluate(() => structuredClone(window.__archive.requests));
    const contractNames = () => page.$$eval('[data-staff-archive] button[aria-expanded]', nodes => nodes.map(node => node.textContent.replace('Consulter le dossier de ', '')));
    const historyRows = label => page.evaluate(label => [...document.querySelectorAll('[aria-labelledby="staff-archived-contract-name"] details')].find(node => node.querySelector('summary')?.textContent === label)?.querySelectorAll('li').length ?? 0, label);
    const historyReady = async (label, count) => page.waitForFunction((label, count) => [...document.querySelectorAll('[aria-labelledby="staff-archived-contract-name"] details')].find(node => node.querySelector('summary')?.textContent === label)?.querySelectorAll('li').length === count, {}, label, count);
    const enterPayroll = async suffix => {
      await page.goto(origin + (suffix ?? ''), { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('[data-guide-staff-ready="true"]');
      assert.equal((await archiveCalls()).length, 0, 'The team view does not request archived records');
      await keyActivate('[data-staff-tab="payroll"]');
      assert.equal((await archiveCalls()).length, 0, 'Paie & contrats leaves archived records unloaded until opened');
    };
    const openContract = async name => {
      await button('Consulter le dossier de ' + name, archive);
      await page.waitForFunction(name => document.querySelector('#staff-archived-contract-name')?.textContent === name && document.activeElement?.id === 'staff-archived-contract-name', {}, name);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Refermer le dossier', 'The dossier heading leads to its close control in keyboard order');
    };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await enterPayroll();
      assert((await page.$eval(archive + ' > summary', node => node.textContent)).includes('(45)'), 'The authoritative archive count is visible');
      await disclosure(archive, true); await page.waitForFunction(() => document.querySelectorAll('[data-staff-archive] button[aria-expanded]').length === 20);
      assert.equal((await archiveCalls()).length, 1, 'Opening the archive requests only the first contract page');
      await page.$eval(archive, node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot(`archive-contracts-${width}`);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Consulter le dossier de Léonie Le Guen', 'Tab reaches the first archived dossier after its disclosure');
      await button('Afficher la suite des contrats', archive); await page.waitForFunction(() => document.querySelectorAll('[data-staff-archive] button[aria-expanded]').length === 40);
      await button('Afficher la suite des contrats', archive); await page.waitForFunction(() => document.querySelectorAll('[data-staff-archive] button[aria-expanded]').length === 45);
      const expected = await page.evaluate(() => window.__archive.expected());
      assert.deepEqual(await contractNames(), expected.contracts.map(employee => employee.name), 'All 45 historical contracts remain present exactly once across three pages');
      assert.equal(await page.$$eval('[data-staff-archive] button', nodes => nodes.filter(node => node.textContent === 'Afficher la suite des contrats').length), 0, 'The final contract page ends pagination');
      const readsBeforeSelection = (await archiveCalls()).length;
      await openContract(expected.contracts[0].name);
      assert.equal((await archiveCalls()).length, readsBeforeSelection, 'Selecting a contract keeps its payroll and task records lazy');
      const contract = (await page.$eval(dossier, node => node.textContent)).replace(/\s/g, ' ');
      for (const text of ['Léonie Le Guen', '21 h / semaine', '14,56', '1 234,56', 'Réglé']) assert(contract.includes(text), 'The archived contract retains ' + text);
      await summary('Paies réglées'); await historyReady('Paies réglées', 20);
      const firstPayroll = (await page.$eval(dossier, node => node.textContent)).replace(/\s/g, ' ');
      for (const text of ['145 € réglés', 'Brut 100 €', 'charges 35 €', 'indemnités 10 €', expected.payroll[0].id]) assert(firstPayroll.includes(text), 'The saved payroll exposes ' + text);
      assert.equal((await archiveCalls()).filter(read => read.kind === 'task').length, 0, 'Payroll access does not fetch task history');
      await button('Afficher la suite des paies', dossier); await historyReady('Paies réglées', 23);
      assert.equal(await historyRows('Paies réglées'), 23);
      const payrollReferences = await page.$$eval(dossier + ' details li small', nodes => nodes.map(node => node.textContent).filter(text => text.startsWith('Référence : ')).map(text => text.slice('Référence : '.length)));
      assert.deepEqual(payrollReferences, expected.payroll.map(pay => pay.id), 'Every saved payroll reference is present once, in server order');
      await summary('Paies réglées');
      await summary('Tâches et résultats'); await historyReady('Tâches et résultats', 20);
      const tasks = (await page.$eval(dossier, node => node.textContent)).replace(/\s/g, ' ');
      for (const text of ['Formation', '2 h', 'Coût de formation : 25 €', expected.tasks[0].outcome, 'Trim manuel', '1,5 h', expected.tasks[1].outcome]) assert(tasks.includes(text), 'Task history retains ' + text);
      await page.$eval(dossier, node => node.scrollIntoView({ block: 'start', behavior: 'instant' })); await shot(`archive-dossier-${width}`);
      await button('Afficher la suite des tâches', dossier); await historyReady('Tâches et résultats', 23);
      assert((await page.$eval(dossier, node => node.textContent)).includes('Résultat détaillé non enregistré.'), 'Missing task outcomes are identified instead of invented');
      const taskOutcomes = await page.evaluate(() => {
        const detail = [...document.querySelectorAll('[aria-labelledby="staff-archived-contract-name"] details')].find(node => node.querySelector('summary')?.textContent === 'Tâches et résultats');
        return [...detail.querySelectorAll('li > p')].map(node => node.textContent);
      });
      assert.deepEqual(taskOutcomes, expected.tasks.map(task => task.outcome ?? 'Résultat détaillé non enregistré.'), 'Every saved task outcome is present once, in server order');
      const reads = await archiveCalls();
      for (const kind of ['contract', 'payroll', 'task']) assert(reads.some(read => read.kind === kind && read.at?.endsWith('.123456+00:00')), 'Pagination preserves the server cursor precision for ' + kind);
      assert(reads.filter(read => read.kind !== 'contract').every(read => read.employeeId === expected.contracts[0].id), 'Every history request belongs to the selected employee');
      await button('Refermer le dossier', dossier);
      assert(await page.evaluate(name => document.activeElement?.textContent === 'Consulter le dossier de ' + name, expected.contracts[0].name), 'Closing the dossier restores its keyboard opener');
      await openContract(expected.contracts.at(-1).name);
      await summary('Paies réglées'); await page.waitForFunction(() => document.body.textContent.includes('Aucune paie enregistrée dans ce dossier.'));
      await summary('Tâches et résultats'); await page.waitForFunction(() => document.body.textContent.includes('Aucune tâche enregistrée dans ce dossier.'));
      await layout();
      assert.equal((await calls()).length, 0, 'Archive consultation never writes a staff command');
      results.push({ width, scope: 'staff archive navigation and history', checks: ['lazy contract/payroll/task reads', '45 contracts in three pages with no omissions or duplicates', '23 payroll rows and 23 task rows', 'server cursor precision', 'saved contract terms and payroll amounts', 'task results and missing-result wording', 'empty employee histories', 'keyboard opening and focus return', 'no horizontal overflow'], mutations: 0 });
    }
    await page.setViewport({ width: 320, height: 844, hasTouch: true });
    await enterPayroll('?archive=legacy'); assert.equal(await page.$(archive), null, 'An old database snapshot does not offer an unavailable archive');
    await enterPayroll('?archive=empty'); await disclosure(archive, true);
    assert((await page.$eval(archive, node => node.textContent)).includes('Aucun contrat archivé pour le moment.')); assert.equal((await archiveCalls()).length, 0, 'A confirmed empty archive does not fetch an unnecessary page');
    await enterPayroll('?archive=empty-list'); await disclosure(archive, true);
    await page.waitForFunction(() => document.querySelector('[data-staff-archive]')?.textContent.includes('Aucun contrat archivé pour le moment.'));
    await enterPayroll(); await page.evaluate(() => window.__archive.failNext('contract')); await disclosure(archive, true);
    await page.waitForSelector(archive + ' [role="alert"]'); await button('Réessayer le chargement', archive);
    await page.waitForFunction(() => document.querySelectorAll('[data-staff-archive] button[aria-expanded]').length === 20);
    await page.evaluate(() => window.__archive.failNext('contract')); await button('Afficher la suite des contrats', archive);
    await page.waitForSelector(archive + ' [role="alert"]'); assert.equal((await contractNames()).length, 20, 'A next-page failure preserves already loaded contracts');
    await button('Réessayer le chargement', archive); await page.waitForFunction(() => document.querySelectorAll('[data-staff-archive] button[aria-expanded]').length === 40);
    await openContract('Léonie Le Guen'); await page.evaluate(() => window.__archive.failNext('payroll')); await summary('Paies réglées');
    await page.waitForSelector(dossier + ' [role="alert"]'); await button('Réessayer le chargement', dossier); await historyReady('Paies réglées', 20);
    await page.evaluate(() => window.__archive.failNext('payroll')); await button('Afficher la suite des paies', dossier);
    await page.waitForSelector(dossier + ' [role="alert"]'); assert.equal(await historyRows('Paies réglées'), 20, 'A failed payroll continuation preserves displayed amounts');
    await button('Réessayer le chargement', dossier); await historyReady('Paies réglées', 23);
    await page.evaluate(() => window.__archive.failNext('task')); await summary('Tâches et résultats');
    await page.waitForSelector(dossier + ' [role="alert"]'); await button('Réessayer le chargement', dossier); await historyReady('Tâches et résultats', 20);
    await page.evaluate(() => window.__archive.failNext('task')); await button('Afficher la suite des tâches', dossier);
    await page.waitForSelector(dossier + ' [role="alert"]'); assert.equal(await historyRows('Tâches et résultats'), 20, 'A failed task continuation preserves saved results');
    await button('Réessayer le chargement', dossier); await historyReady('Tâches et résultats', 23);
    const retries = await archiveCalls();
    for (const kind of ['contract', 'payroll', 'task']) {
      const repeated = retries.filter(read => read.kind === kind && read.id);
      assert.equal(repeated.length, 2, 'Each next page has one explicit retry for ' + kind); assert.deepEqual(repeated[0], repeated[1], 'Retry retains the exact cursor and employee for ' + kind);
    }
    await enterPayroll(); await page.evaluate(() => window.__archive.holdNext('contract')); await disclosure(archive, true);
    await page.waitForFunction(() => window.__archive.pending() === 1); await disclosure(archive, false);
    await page.evaluate(() => window.__archive.rename('Léonie Dossier actualisé')); await disclosure(archive, true);
    await page.waitForFunction(() => document.querySelector('[data-staff-archive]')?.textContent.includes('Léonie Dossier actualisé'));
    await page.evaluate(() => window.__archive.release()); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert((await contractNames()).includes('Léonie Dossier actualisé') && !(await contractNames()).includes('Léonie Le Guen'), 'A delayed response from the closed register cannot replace the reopened register');
    await openContract('Léonie Dossier actualisé'); await page.evaluate(() => window.__archive.holdNext('payroll')); await summary('Paies réglées');
    await page.waitForFunction(() => window.__archive.pending() === 1); await button('Refermer le dossier', dossier);
    await openContract('Ancien contrat 02'); await summary('Paies réglées');
    await page.waitForFunction(() => document.querySelector('[aria-labelledby="staff-archived-contract-name"]')?.textContent.includes('Aucune paie enregistrée dans ce dossier.'));
    await page.evaluate(() => window.__archive.release()); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await historyRows('Paies réglées'), 0, 'A late response from another dossier never shows its payroll under the new employee');
    assert.equal(await page.$eval('#staff-archived-contract-name', node => node.textContent), 'Ancien contrat 02');
    await layout(); assert.equal((await calls()).length, 0);
    results.push({ width: 320, scope: 'archive empty, legacy, retry and stale responses', checks: ['archive capability absent', 'zero count and empty returned page', 'first and next page failures for all three histories', 'retry preserves cursor and visible rows', 'late response after closing/reopening archive', 'late payroll after changing employee', 'no horizontal overflow'], mutations: 0 });
  }
  if (staffMomentsOnly) {
    const scene = '[data-staff-moment]';
    const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const ready = () => page.waitForSelector('[data-guide-staff-ready="true"]');
    const noMoment = async label => assert.equal(await page.$(scene), null, label);
    const shown = () => page.evaluate(() => window.__staffMomentsSeen);
    const startObservation = () => page.evaluate(() => {
      window.__staffMomentsSeen = [];
      const nodes = new WeakMap();
      const record = node => {
        if (!(node instanceof Element)) return;
        for (const moment of [...(node.matches('[data-staff-moment]') ? [node] : []), ...node.querySelectorAll('[data-staff-moment]')]) {
          if (nodes.get(moment) === moment.dataset.momentId) continue;
          nodes.set(moment, moment.dataset.momentId);
          window.__staffMomentsSeen.push({ id: moment.dataset.momentId, kind: moment.dataset.staffMoment });
        }
      };
      new MutationObserver(records => records.forEach(recording => recording.type === 'attributes' ? record(recording.target) : recording.addedNodes.forEach(record)))
        .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-moment-id'] });
    });
    const checkMoment = async (kind, person, portraitLabel) => {
      await page.waitForSelector(`[data-staff-moment="${kind}"]`, { visible: true });
      assert.equal(await page.$$eval(scene, nodes => nodes.length), 1, 'One confirmed action exposes exactly one reaction');
      assert.equal(await page.$eval('[data-moment-avatar]', node => node.dataset.momentAvatar), person.id, 'The receipt belongs to the confirmed employee');
      assert.equal(await page.$eval('[data-moment-portrait]', node => node.dataset.momentPortrait), person.portraitCode ?? person.code, 'The preserved profile controls the portrait');
      await page.waitForSelector(scene + ' [data-avatar-state="ready"]');
      await page.waitForFunction(() => [...document.querySelectorAll('[data-staff-moment] img')].every(node => node.complete && node.naturalWidth > 0));
      assert.equal(await page.$eval(scene + ' canvas', node => node.getAttribute('aria-label')), portraitLabel, 'Candidate and receipt use the same rendered avatar identity');
      assert((await page.$eval(scene, node => node.textContent)).includes(person.name), 'The authoritative name remains readable');
      assert(await page.$eval(scene, node => node.contains(document.activeElement)), 'Confirmation places keyboard focus in the new receipt');
      assert(await page.evaluate(() => { const style = getComputedStyle(document.activeElement); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2; }), 'The receipt focus ring is visible');
      assert(await page.$eval(scene, async node => {
        for (const surface of [node, ...node.querySelectorAll('button')]) {
          const style = getComputedStyle(surface), url = style.borderImageSource.match(/url\(["']?(.*?)["']?\)/)?.[1];
          if (!url || !style.borderImageSlice.includes('fill') || style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.boxShadow !== 'none') return false;
          const material = new Image(); material.src = url; await material.decode();
        }
        return true;
      }), 'Paper surfaces and control plates use decoded nine-slice artwork with no native rectangle');
      await page.$eval(scene, node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await layout();
      assert(await page.$eval('[data-moment-dismiss]', node => { const rect = node.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44; }), 'The receipt can be dismissed with a usable touch target');
      return page.$eval(scene, node => node.dataset.momentId);
    };
    const dismiss = async () => {
      await keyActivate('[data-moment-dismiss]'); await page.waitForFunction(() => !document.querySelector('[data-staff-moment]'));
      assert(await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement !== document.body && document.activeElement.isConnected && document.activeElement.getClientRects().length > 0), 'Keyboard dismissal returns focus to a visible control');
    };
    const noReplayAfterRead = async expectedSeen => {
      await button('Actualiser'); await ready(); await noMoment('A GET refresh never reconstructs a dismissed reaction');
      await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector('[aria-label="Atelier de trim"]');
      await button('Personnel', '[aria-label="Navigation de recette"]'); await ready();
      await noMoment('Remounting Personnel never reconstructs a past result');
      assert.deepEqual(await shown(), expectedSeen, 'Neither GET nor remount replays the reaction');
    };
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready); await ready();
      await startObservation(); await noMoment('The initial GET does not celebrate an action');
      await button('Recruter'); await page.waitForSelector('[data-candidate-code] [data-avatar-state="ready"]');
      const candidateCode = await page.$eval('[data-candidate-code]', node => node.dataset.candidateCode);
      const portraitLabel = await page.$eval(`[data-candidate-code="${candidateCode}"] canvas`, node => node.getAttribute('aria-label'));
      await button('Choisir ce profil', `[data-candidate-code="${candidateCode}"]`); await select('Temps hebdomadaire', '14'); await select('Contrat', 'cdd');
      const beforeHire = await raw();
      await button('Vérifier le contrat'); await page.waitForSelector('dialog[open]'); await noMoment('Reviewing a contract does not trigger a reaction');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog'));
      assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), beforeHire, 'Cancelling a contract preserves the authoritative state');
      await noMoment('Cancelling a contract does not trigger a reaction');
      await button('Vérifier le contrat'); await page.evaluate(() => window.__staff.failNext()); await button('Signer ce contrat', 'dialog');
      await page.waitForSelector('dialog [role="alert"]'); await noMoment('A failed hire response cannot trigger a reaction');
      assert.deepEqual(await raw(), beforeHire, 'A rejected hire leaves money and employees unchanged');
      await button('Réessayer la confirmation', 'dialog'); await ready();
      const hired = await raw(), employee = hired.state.employees[0];
      const hireId = await checkMoment('hire', employee, portraitLabel);
      const hirePosts = await calls(); assert.equal(hirePosts.length, 2); assert.equal(hirePosts[0].requestKey, hirePosts[1].requestKey, 'Hire retry retains the same request key');
      assert.equal(employee.code, candidateCode); assert.equal(employee.weeklyHours, 14); assert.equal(employee.contract, 'cdd');
      assert.equal(hired.cashCents, beforeHire.cashCents, 'Signing a contract does not debit a salary');
      assert.deepEqual(await shown(), [{ id: hireId, kind: 'hire' }], 'Failed confirmation plus retry displays the hire once');
      await shot(`staff-moment-hire-${width}`);
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.waitForFunction(() => document.querySelector('[data-staff-moment]')?.dataset.momentMotion === 'reduced');
      const reducedPaint = () => page.$$eval('[data-moment-moving-part]', nodes => nodes.map(node => ({ transform: getComputedStyle(node).transform, opacity: getComputedStyle(node).opacity })));
      const reduced = await reducedPaint(); await pause(250); assert.deepEqual(await reducedPaint(), reduced, 'Live reduced motion leaves every illustrated layer still');
      assert(await page.$eval(scene, node => node.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')), 'Reduced motion stops actual animation timelines');
      assert.deepEqual(await raw(), hired, 'The visual response cannot mutate the confirmed contract');
      await shot(`staff-moment-reduced-${width}`); await dismiss(); await noReplayAfterRead([{ id: hireId, kind: 'hire' }]);
      await keyActivate(`[data-staff-work-employee="${employee.id}"]`); await keyActivate('[data-staff-station="training"]');
      await input('Temps à réserver', '2'); await select('Compétence à apprendre', 'communication');
      const beforeTraining = await raw();
      await button('Vérifier l’affectation'); await page.waitForSelector('dialog[open]');
      const review = await page.$eval('dialog', node => node.textContent);
      assert(review.includes(employee.name) && review.includes('Communication') && review.includes('2 h') && review.includes('70'), 'The exact employee, skill, hours and fee are reviewed before payment');
      await noMoment('Reviewing a training proposal does not trigger a reaction'); await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog')); assert.deepEqual(await raw(), beforeTraining, 'Cancelling training preserves money, hours and XP');
      await noMoment('Cancelling training does not trigger a reaction');
      await button('Vérifier l’affectation');
      await page.evaluate(lost => lost ? window.__staff.loseNextResponse() : window.__staff.failNext(), width === 320);
      await button('Payer et commencer', 'dialog'); await page.waitForSelector('dialog [role="alert"]');
      await noMoment('An unconfirmed training response cannot trigger a reaction, even if the server committed it');
      if (width !== 320) assert.deepEqual(await raw(), beforeTraining, 'Rejected training preserves its budget and capacity');
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: width === 390 ? 'no-preference' : 'reduce' }]);
      let recorder, video;
      if (width === 390) {
        const { default: ffmpegPath } = await import('ffmpeg-static'); video = resolve(output, 'staff-moment-training-demo.webm');
        recorder = await page.screencast({ path: video, format: 'webm', fps: 24, ffmpegPath });
      }
      let trainingId;
      try {
        await button('Réessayer la confirmation', 'dialog'); await ready();
        trainingId = await checkMoment('training', employee, portraitLabel);
        if (width === 390) {
          await page.waitForFunction(() => document.querySelector('[data-staff-moment]')?.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'));
          const paint = () => page.$$eval('[data-moment-moving-part]', nodes => nodes.map(node => getComputedStyle(node).transform));
          const initialPaint = await paint(); await pause(220); assert.notDeepEqual(await paint(), initialPaint, 'Normal motion visibly moves the confirmed character or book');
          await pause(4000);
          await page.waitForFunction(() => document.querySelector('[data-staff-moment]')?.dataset.momentMotion === 'complete');
          assert(await page.$eval(scene, node => node.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')), 'The reaction finishes instead of looping while the task runs');
        }
      } finally { await recorder?.stop(); }
      const trained = await raw(), task = trained.state.tasks[0], posts = await calls();
      assert.equal(posts.length, 4); assert.equal(posts[2].requestKey, posts[3].requestKey, 'Training retry retains its request key');
      assert.equal(trained.state.tasks.length, 1, 'Retry creates one training task');
      assert.equal(task.employeeId, employee.id); assert.equal(task.kind, 'training'); assert.equal(task.hours, 2); assert.equal(task.trainingCostCents, 7000);
      assert.equal(trained.cashCents, beforeTraining.cashCents - task.trainingCostCents, 'Training is charged exactly once, including the lost-response retry');
      assert.equal(trained.state.employees[0].workDays['1'].usedHours, 2, 'Only the confirmed training hours are reserved');
      assert.deepEqual(trained.state.employees[0].skills, beforeTraining.state.employees[0].skills, 'Starting training grants no premature XP or level');
      const receipt = await page.$eval(scene, node => node.textContent);
      assert(receipt.includes('2 h') && receipt.includes('70') && receipt.includes('Communication'), 'The receipt retains the actual duration, paid amount and target skill');
      assert.equal(await page.$eval('[data-moment-hours]', node => node.textContent.trim()), '2 h');
      assert.equal(await page.$eval('[data-moment-cost]', node => Math.round(Number(node.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100)), task.trainingCostCents);
      assert.equal(await page.$eval('[data-moment-training-state]', node => node.dataset.momentTrainingState), 'in-progress', 'The receipt describes confirmed work still in progress');
      assert(!/niveau\s*\+|niveau gagn|formation termin|formation réussie/i.test(receipt), 'A confirmed start is not presented as a completed course or level gain');
      const expectedSeen = [{ id: hireId, kind: 'hire' }, { id: trainingId, kind: 'training' }];
      assert.deepEqual(await shown(), expectedSeen, 'Only the two acknowledged actions have reactions');
      await shot(`staff-moment-training-${width}`); await dismiss(); await noReplayAfterRead(expectedSeen);
      await page.evaluate(() => window.__staff.finish()); await button('Actualiser'); await ready();
      assert.equal((await raw()).state.tasks[0].status, 'completed'); await noMoment('A GET that settles training does not replay its start');
      assert.deepEqual(await shown(), expectedSeen); assert.equal((await calls()).length, 4, 'Viewing, motion, closing and refreshing never write business actions');
      results.push({ width, scope: 'confirmed staff reactions', checks: ['no reaction during review, cancellation or failure', 'one exact hire identity', 'same-key hire and training retry', 'real contract without salary debit', 'real training cost and shared hours', 'no premature XP or level gain', 'keyboard dismissal focus', 'live reduced motion', 'finite painted motion at 390', 'no replay after GET, remount or completion', 'no page overflow'], mutations: posts.length, ...(width === 320 ? { lostResponse: 'training committed before 503; retry returned the cached result without duplicate payment' } : {}), ...(video ? { video } : {}) });
    }
    await page.setViewport({ width: 390, height: 844, hasTouch: true });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(origin, { waitUntil: 'networkidle0' }); await ready();
    await page.evaluate(() => window.__staff.advanceRecruitment()); await button('Actualiser'); await ready(); await startObservation();
    const renewed = await page.evaluate(() => window.__staff.snapshot().candidates[0]);
    assert(renewed.portraitCode && renewed.code !== renewed.portraitCode, 'The renewal fixture exercises an identity distinct from its portrait source');
    await button('Recruter'); await page.waitForSelector(`[data-candidate-code="${renewed.code}"] [data-avatar-state="ready"]`);
    const portraitLabel = await page.$eval(`[data-candidate-code="${renewed.code}"] canvas`, node => node.getAttribute('aria-label'));
    await button('Choisir ce profil', `[data-candidate-code="${renewed.code}"]`); await button('Vérifier le contrat'); await button('Signer ce contrat', 'dialog'); await ready();
    const employee = (await raw()).state.employees[0]; await checkMoment('hire', employee, portraitLabel);
    assert.equal(employee.name, renewed.name); assert.equal(employee.portraitCode, renewed.portraitCode);
    await shot('staff-moment-renewed-390');
    await keyActivate('[data-moment-open-employee]'); await page.waitForSelector('dialog[data-staff-employee-sheet][open]');
    assert(await page.$('[data-staff-moment]'), 'Reading the employee sheet preserves its confirmed receipt');
    await button('Organiser sa journée', '[data-staff-employee-sheet]'); await page.waitForFunction(() => !document.querySelector('[data-staff-moment]'));
    assert(await page.$eval(`[data-staff-employee-id="${employee.id}"] [data-staff-open-planning]`, node => node === document.activeElement && node.getAttribute('aria-expanded') === 'true'), 'The next action opens the exact employee file and restores keyboard focus');
    await noMoment('Opening the employee file dismisses its receipt');
    results.push({ width: 390, scope: 'renewed candidate identity', checks: ['new candidate name and code', 'preserved portrait source and canvas identity', 'single acknowledged hire', 'next action opens the exact employee file with keyboard focus', 'decoded nine-slice materials', 'reduced motion', 'no overflow'], mutations: (await calls()).length });
  }
  if (visualClarityOnly) {
    for (const width of [320, 390, 1440]) {
      const height = width < 500 ? 844 : 1000;
      await page.setViewport({ width, height, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('[data-guide-staff-ready="true"]');
      assert.equal((await raw()).state.employees.length, 0, 'The first daily plan is usable without an employee');
      assert.equal(await page.$('[data-player-work-form], [data-staff-work-form], [data-staff-prospecting-map]'), null, 'The landing does not preselect an activity or expose an unrelated form/map');
      assert.equal(await page.$eval('[data-staff-work-employee="player"]', node => node.getAttribute('aria-pressed')), 'true');
      const geometry = await page.evaluate(() => {
        const board = document.querySelector('[data-staff-work-plan]').getBoundingClientRect();
        const firstStation = document.querySelector('[data-staff-work-station]').getBoundingClientRect();
        return { boardTop: Math.round(board.top), firstStationBottom: Math.round(firstStation.bottom), viewportHeight: innerHeight };
      });
      assert(geometry.boardTop < height && geometry.firstStationBottom <= height, 'The actor and first illustrated activities are visible on entry');
      assert(await page.$$eval('[data-staff-station], [data-staff-work-employee]', nodes => nodes.every(node => { const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; })), 'Actors and stations retain usable touch targets');
      assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'The entire path runs with reduced motion enabled');
      await shot(`clarity-empty-${width}`);
      const before = await raw();
      await personalActivity('sales');
      assert.equal(await page.$$eval('[data-player-work-form], [data-staff-work-form]', nodes => nodes.length), 1, 'Choosing a player activity exposes one form');
      await page.waitForSelector('[data-staff-assignment-panel] [data-staff-prospecting-map]', { visible: true });
      assert(await page.$$eval('[data-prospecting-city-list], [data-prospecting-profile]', nodes => nodes.length === 2 && nodes.every(node => !node.open)), 'Duplicate city choices and market details remain secondary until requested');
      await keyActivate('[data-player-prospecting-mode="countryside"]');
      assert.equal(await page.$('[data-staff-prospecting-map]'), null, 'The countryside mode removes the unrelated city map');
      await keyActivate('[data-player-prospecting-mode="city"]');
      await page.waitForSelector('[data-staff-prospecting-map]', { visible: true });
      await closeAssignment('sales');
      assert(await page.$eval('[data-staff-station="sales"]', node => { const style = getComputedStyle(node); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0; }), 'Keyboard return focus remains visible');
      assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), before, 'Activity and destination exploration do not spend time or money');
      await shot(`clarity-return-${width}`);

      await page.goto(origin + '?team=1', { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('[data-guide-staff-ready="true"]');
      const teamBefore = await raw(); assert.equal(teamBefore.state.employees.length, 2);
      await keyActivate('[data-staff-work-employee="work-plan-mael"]');
      await keyActivate('[data-staff-station="culture"]');
      await page.waitForSelector('[data-staff-work-form="work-plan-mael"]');
      assert.equal(await page.$$eval('[data-player-work-form], [data-staff-work-form]', nodes => nodes.length), 1, 'A staff activity does not leave a parallel personal form open');
      await select('Culture à accompagner', 'test-run-selected'); await input('Temps à réserver', '2');
      await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await page.waitForSelector('dialog[open]');
      const reviewText = await page.$eval('dialog dl', node => node.textContent);
      assert(reviewText.includes('Maël Riou') && reviewText.includes('Culture choisie pour Maël') && /2\s*h/.test(reviewText));
      await page.keyboard.press('Escape'); assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), teamBefore);
      await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await button('Confier ce travail', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1);
      const assigned = (await raw()).state.tasks[0];
      assert.deepEqual({ employeeId: assigned.employeeId, targetId: assigned.targetId, hours: assigned.hours }, { employeeId: 'work-plan-mael', targetId: 'test-run-selected', hours: 2 });
      await page.waitForSelector(`[data-staff-work-task="${assigned.id}"] [data-avatar-state="ready"]`);
      assert.equal(await page.$('[data-staff-assignment-panel]'), null, 'A confirmed assignment returns to the plan');
      assert((await page.$eval(`[data-staff-work-task="${assigned.id}"]`, node => node.textContent)).includes('Maël Riou'), 'The real assigned person remains visible at the station');
      assert.equal((await raw()).state.employees.find(employee => employee.id === assigned.employeeId).workDays['1'].usedHours, 2);
      assert.equal((await calls()).length, 1); assert.equal((await raw()).cashCents, teamBefore.cashCents);
      await page.$eval('[data-staff-work-plan]', node => node.scrollIntoView({ block: 'start' })); await shot(`clarity-assigned-${width}`);
      results.push({ width, scope: 'unified daily work clarity', geometry, checks: ['actor and stations on entry', 'no initial form or map', 'player works without employees', '44px actor and station targets', 'one contextual form', 'city and countryside maps follow selection', 'keyboard cancellation restores visible focus', 'selection and review without mutation', 'confirmed employee avatar at exact station', 'actual hours retained', 'reduced motion', 'no page overflow'], mutations: 1 });
    }
  }
  if (playerWorkOnly) {
    const scope = '[data-player-work-desk]';
    const globalHours = async expected => page.waitForFunction(value => Number(document.querySelector('[data-player-work-status] [role="meter"]')?.getAttribute('aria-valuenow')) === value && !!document.querySelector('[data-player-work-status] [role="meter"]'), {}, expected);
    const ready = async () => { await page.waitForSelector('[data-guide-staff-ready="true"]'); await page.waitForSelector('[data-staff-work-plan]'); };
    const review = async () => { await button('Vérifier mon travail', scope); await page.waitForSelector('dialog[open]'); return page.$$eval('dialog dl > div', nodes => Object.fromEntries(nodes.map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent]))); };
    const cashValue = text => Number(text.replace(/[^\d,.-]/g, '').replace(',', '.'));
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await ready(); await page.evaluate(() => document.fonts.ready);
      await globalHours(12); await page.$eval('[data-player-work-status]', node => node.scrollIntoView({ block: 'start' })); await shot(`player-global-${width}`);
      await disclosure('[data-player-work-status] details', true);
      for (const [xp, level, hourGesture, halfHourGesture] of [[0, 1, '60 min', '30 min'], [1600, 5, '36 min', '18 min'], [8100, 10, '6 min', '3 min']]) {
        await page.evaluate(value => window.__staff.personalSkills(value), xp);
        await page.waitForFunction(level => document.querySelector('[data-player-cost-group="communication"]')?.dataset.skillLevel === String(level), {}, level);
        for (const [skill, expected] of [['communication', [hourGesture, halfHourGesture]], ['processing', [hourGesture, halfHourGesture]], ['sales', [hourGesture, halfHourGesture]], ['administration', [halfHourGesture]]]) {
          await page.click(`[data-player-cost-selector="${skill}"]`);
          assert.equal(await page.$$eval('[data-player-cost-group]:not([hidden])', nodes => nodes.length), 1, 'Only the chosen activity is visible');
          assert.equal(await page.$eval(`[data-player-cost-group="${skill}"]`, node => node.dataset.skillLevel), String(level));
          assert.deepEqual(await page.$$eval(`[data-player-cost-group="${skill}"] li strong`, nodes => nodes.map(node => node.textContent)), expected);
          const widths = await page.$$eval(`[data-player-cost-group="${skill}"] li div[aria-hidden] > span`, nodes => nodes.map(node => Number.parseFloat(node.style.width)));
          assert.deepEqual(widths, expected.map(value => Number(value.split(' ')[0]) / 60 * 100), 'All activities share a true 60-minute scale');
        }
        assert.deepEqual(await page.$$eval('[data-player-cost-group="culture"] li strong', nodes => nodes.map(node => node.textContent)), ['30 min', '30 min'], 'Culture retains the half-hour-per-stage policy');
      }
      await page.click('[data-player-cost-selector="communication"]');
      await page.$eval('[data-player-work-status]', node => node.scrollIntoView({ block: 'start' })); await shot(`action-time-level10-${width}`); await layout();
      await page.evaluate(() => window.__staff.personalSkills(0));
      await page.waitForFunction(() => document.querySelector('[data-player-cost-group="communication"]')?.dataset.skillLevel === '1');
      await disclosure('[data-player-work-status] details', false);
      results.push({ width, scope: 'proportional action durations', checks: ['level1/5/10', 'own workstation skill', '1h becomes0.1h', '30min becomes0.05h', 'culture unchanged', 'read-only refresh', 'no overflow'], mutations: 0 });
      assert.equal((await raw()).state.employees.length, 0);
      assert.equal(await page.$(scope), null, 'A personal mission opens only after choosing a station');
      await personalActivity('culture');
      assert.equal(await page.$eval(scope + ' [role="meter"]', node => Number(node.getAttribute('aria-valuemax'))), 12);
      await page.$eval(scope, node => node.scrollIntoView({ block: 'start' })); await shot(`player-work-${width}`);
      await select('Ta culture à accompagner', 'test-run');
      const before = await raw(), proposal = await review();
      assert.equal(proposal['Qui travaille'], 'Toi'); assert.equal(proposal['Destination / objectif'], 'Culture de démonstration'); assert.equal(proposal['Temps réservé aujourd’hui'], '2 h'); assert.equal(cashValue(proposal['Paiement immédiat']), 0);
      await page.keyboard.press('Escape'); assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), before);
      await page.waitForFunction(() => document.activeElement?.textContent.trim() === 'Vérifier mon travail');
      await review();
      if (width === 320) await page.evaluate(() => window.__staff.failNext());
      await button('Commencer mon travail', 'dialog');
      if (width === 320) { await page.waitForSelector('dialog [role="alert"]'); await button('Réessayer la confirmation', 'dialog'); const posted = await calls(); assert.equal(posted.at(-1).requestKey, posted.at(-2).requestKey); }
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1); await ready();
      await personalActivity('communication'); await review(); await button('Commencer mon travail', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 2); await ready();
      await personalActivity('trim'); await page.waitForSelector('[data-trim-worker]');
      assert.equal(await page.$eval('[data-trim-worker]', node => node.dataset.trimWorker), 'player');
      assert.equal(await page.$('[data-trim-assigned-employee="player"]'), null, 'Personal trim is not described as an unavailable employee');
      assert.equal(await page.$eval('[data-trim-shared-form] input[type="number"]', node => Number(node.max)), 8, 'Workshop allows only the same eight remaining hours after four reserved hours');
      await globalHours(8);
      await input('Heures de trim', '2'); await button('Vérifier le trim'); await button('Confirmer le trim', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 3);
      await button('Personnel', '[aria-label="Navigation de recette"]'); await ready();
      await personalActivity('sales');
      assert.equal(await page.$eval(scope + ' [role="meter"]', node => Number(node.getAttribute('aria-valuenow'))), 6);
      await select('Ville à prospecter', 'brest');
      await input('Tes heures à réserver', '1'); assert(await page.$eval(scope + ' button[type="submit"]', node => node.disabled), 'City prospecting requires at least two hours');
      await input('Tes heures à réserver', '2');
      const cityReview = await review(); assert.equal(cityReview['Destination / objectif'], 'Brest (29)'); assert.equal(cashValue(cityReview['Frais de déplacement au départ']), 60);
      await shot(`player-city-confirm-${width}`); await button('Payer le trajet et partir', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 4); await ready();
      await globalHours(4);
      for (const [index, kind] of ['administration', 'processing'].entries()) {
        await personalActivity(kind); await review(); await button('Commencer mon travail', 'dialog');
        await page.waitForFunction(count => window.__staff.raw().state.tasks.length === count, {}, 5 + index); await ready();
      }
      const assigned = await raw(); assert.equal(assigned.state.playerWorkDays['1'].usedHours, 12); assert.equal(assigned.cashCents, before.cashCents - 6000);
      await globalHours(0);
      assert.deepEqual(assigned.state.tasks.map(task => task.kind), ['culture', 'communication', 'trim', 'sales', 'administration', 'processing']);
      assert(assigned.state.tasks.every((task, index, all) => task.employeeId === 'player' && (!index || Date.parse(task.startedAt) >= Date.parse(all[index - 1].completesAt))), 'All personal tasks and trim queue without overlap');
      assert.equal(assigned.state.tasks[5].targetId, 'test-flower');
      await personalActivity('countryside'); assert(await page.$eval(scope + ' button[type="submit"]', node => node.disabled));
      assert((await page.$eval(scope, node => node.textContent)).includes('12 h complètes'));
      await page.evaluate(() => window.__staff.finish()); await button('Actualiser'); await ready();
      assert((await raw()).state.tasks.every(task => task.status === 'completed'));
      assert((await raw()).state.playerSkills.culture > 0 && (await raw()).state.playerSkills.processing > 0 && (await raw()).state.playerSkills.communication > 0 && (await raw()).state.playerSkills.administration > 0 && (await raw()).state.playerSkills.sales > 0);
      await layout();
      results.push({ width, scope: 'personal work and shared trim', checks: ['visible without employees', '12-hour meter', 'global remaining hours after personal missions and trim', 'keyboard confirmation and cancellation', 'same request on retry', 'five personal skills', 'trim workshop callback', 'shared hours in both screens', 'queued personal work', 'city minimum and exact cost', 'exhausted rural trip blocked', 'completed task XP', 'no page overflow'], mutations: (await calls()).length });

      await page.goto(origin, { waitUntil: 'networkidle0' }); await ready();
      await personalActivity('countryside'); await select('Département à sillonner', '29');
      assert(await page.$eval(scope + ' input', node => node.readOnly && node.value === '12'));
      assert((await page.$eval(scope, node => node.textContent)).includes('0 à 2'));
      const ruralBefore = await raw(), ruralReview = await review();
      assert.equal(ruralReview['Destination / objectif'], 'Finistère (29)'); assert.equal(ruralReview['Temps réservé aujourd’hui'], '12 h'); assert.equal(cashValue(ruralReview['Frais de déplacement au départ']), 40);
      await shot(`player-rural-confirm-${width}`); await page.keyboard.press('Escape'); assert.deepEqual(await raw(), ruralBefore); assert.equal((await calls()).length, 0);
      await review(); await button('Payer le trajet et partir', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1); await ready();
      const ruralTask = (await raw()).state.tasks[0]; assert.equal(ruralTask.kind, 'countryside'); assert.equal(ruralTask.department, '29'); assert.equal(Date.parse(ruralTask.completesAt) - Date.parse(ruralTask.startedAt), 2 * 60 * 60 * 1000);
      assert.equal((await raw()).cashCents, ruralBefore.cashCents - 4000); assert.equal((await raw()).context.shopPartners, ruralBefore.context.shopPartners);
      await page.evaluate(() => window.__staff.finish()); await button('Actualiser'); await ready();
      const ruralAfter = await raw(); const gain = ruralAfter.context.shopPartners - ruralBefore.context.shopPartners; assert(gain >= 0 && gain <= 2);
      await button('Actualiser'); await ready(); assert.equal((await raw()).context.shopPartners, ruralAfter.context.shopPartners);
      assert.equal((await calls()).length, 1); await layout();
      results.push({ width, scope: 'rural personal day', checks: ['selected Breton department', 'fixed12 hours equals2 real hours', '40 euro explicit review', 'cancellation without writes', 'no immediate reward', '0-2 contacts on completion', 'no replay on refresh'], mutations: 1 });
    }
    await page.setViewport({ width: 390, height: 844 }); await page.goto(origin, { waitUntil: 'networkidle0' }); await ready();
    await page.evaluate(() => window.__staff.personalCondition('late')); await button('Actualiser'); await ready(); await personalActivity('countryside');
    assert(await page.$eval(scope + ' button[type="submit"]', node => node.disabled)); assert((await page.$eval(scope, node => node.textContent)).includes('finirait après la fin de journée')); assert.equal((await calls()).length, 0);
    await page.goto(origin, { waitUntil: 'networkidle0' }); await ready(); await page.evaluate(() => window.__staff.personalCondition('weekend-unpaid')); await button('Actualiser'); await ready();
    assert((await page.evaluate(() => window.__staff.snapshot())).calendar.weekend); assert((await page.evaluate(() => window.__staff.snapshot())).outstandingCents > 0);
    await personalActivity('communication');
    await review(); await button('Commencer mon travail', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1); await ready();
    assert.equal((await raw()).state.playerWorkDays['6'].usedHours, 2); assert.equal((await raw()).cashCents, 2500000);
    results.push({ width: 390, scope: 'personal availability', checks: ['end-of-day reservation blocked', 'weekend allowed', 'unpaid employee wages do not block player', 'no salary debit'], mutations: 1 });
    await globalHours(10); await page.evaluate(() => window.__staff.personalDay()); await ready(); await globalHours(12);
    await page.evaluate(() => window.__staff.personalSocialHours(1.5)); await globalHours(10.5);
    await page.evaluate(() => window.__staff.personalAvailability(false));
    await page.waitForFunction(() => document.querySelector('[data-player-work-status]')?.textContent.includes('Temps de travail indisponible'));
    assert.equal(await page.$('[data-player-work-status] [role="meter"]'), null, 'Unavailable hours are not presented as zero or as a fresh allowance');
    assert.deepEqual(await page.$$eval('[data-player-cost-group="communication"] dd', nodes => nodes.map(node => node.textContent)), ['6 min à 60 min', '3 min à 30 min']);
    assert.deepEqual(await page.$$eval('[data-player-cost-group="processing"] dd', nodes => nodes.map(node => node.textContent)), ['6 min à 60 min', '3 min à 30 min']);
    assert.equal(await page.$('[data-player-cost-group="communication"] figure'), null, 'Unknown skill has no fabricated current-duration chart');
    await page.evaluate(() => window.__staff.personalAvailability(true)); await button('Actualiser', '[data-player-work-status]'); await globalHours(10.5);
    await layout(); assert.equal((await calls()).length, 1, 'Global status and its retries only read the snapshot');
    results.push({ width: 390, scope: 'global personal status', checks: ['authoritative next-day renewal', 'social event refreshes confirmed hours', 'unknown data never presented as zero', 'read-only retry recovers same remaining hours'], mutations: 0 });
  }
  if (workSceneOnly) {
    const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const scene = kind => `[data-staff-station-scene="${kind}"]`;
    const activity = (kind, value) => page.waitForFunction((kind, value) => document.querySelector(`[data-staff-station-scene="${kind}"]`)?.dataset.stationActivity === value, {}, kind, value);
    const motion = (kind, value) => page.waitForFunction((kind, value) => document.querySelector(`[data-staff-station-scene="${kind}"]`)?.dataset.stationMotion === value, {}, kind, value);
    const painted = kind => page.$$eval(scene(kind) + ' [data-station-moving-part]', nodes => nodes.map(node => { const style = getComputedStyle(node); return { part: node.dataset.stationMovingPart, transform: style.transform, opacity: style.opacity, animation: style.animationName, playState: style.animationPlayState }; }));
    const visiblyMoves = async kind => {
      const first = await page.$$eval(scene(kind) + ' [data-station-moving-part]', nodes => nodes.map(node => getComputedStyle(node).transform));
      await page.waitForFunction((selector, first) => JSON.stringify([...document.querySelectorAll(selector + ' [data-station-moving-part]')].map(node => getComputedStyle(node).transform)) !== JSON.stringify(first), { timeout: 5000 }, scene(kind), first);
    };
    const show = async kind => { await page.$eval(scene(kind), node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await motion(kind, 'running'); };
    const frozen = async (kind, label) => { await painted(kind); await pause(200); const before = await painted(kind); assert(before.every(part => part.animation === 'none' || part.playState === 'paused'), label + ' stops CSS timelines'); await pause(280); assert.deepEqual(await painted(kind), before, label + ' stops painted motion'); };
    const readyArt = async () => {
      await page.waitForFunction(() => [...document.querySelectorAll('[data-staff-station-scene] img')].every(node => node.complete && node.naturalWidth > 0));
      await page.waitForFunction(() => [...document.querySelectorAll('[data-staff-station-scene] canvas')].every(node => node.dataset.avatarState === 'ready'));
    };
    const actors = () => page.$$eval('[data-staff-station-scene][data-station-actor]', nodes => nodes.map(node => ({ station: node.dataset.staffStationScene, actor: node.dataset.stationActor, activity: node.dataset.stationActivity })).sort((a, b) => a.station.localeCompare(b.station)));
    const open = async (width, query = 'live') => {
      await page.setViewport({ width, height: width < 500 ? 844 : 1050, hasTouch: width < 500 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await page.goto(origin + (query ? '?scene=' + query : ''), { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready); await page.waitForSelector('[data-guide-staff-ready="true"]');
      await page.waitForSelector(scene('culture')); await readyArt();
    };
    const refresh = async () => { const before = await page.evaluate(() => window.__staff.reads()); await button('Actualiser'); await page.waitForFunction(before => window.__staff.reads() > before, {}, before); await page.waitForSelector('[data-guide-staff-ready="true"]'); };
    const expectedActors = [
      { station: 'administration', actor: 'work-plan-anna', activity: 'queued' },
      { station: 'communication', actor: 'work-plan-mael', activity: 'working' },
      { station: 'culture', actor: 'work-plan-anna', activity: 'working' },
      { station: 'processing', actor: 'player', activity: 'working' },
    ];
    for (const width of workScenePreview ? [1440] : [320, 390, 1440]) {
      await open(width); const before = await raw();
      const geometry = await page.$$eval('[data-staff-station-scene]', nodes => nodes.map(node => { const scene = node.getBoundingClientRect(), canvas = node.querySelector('[data-station-moving-part="actor"] canvas')?.getBoundingClientRect(); return { station: node.dataset.staffStationScene, sceneWidth: scene.width, buttonWidth: node.closest('button').getBoundingClientRect().width, ...(canvas ? { actorBottom: canvas.bottom - scene.top, sceneHeight: scene.height } : {}) }; }));
      assert(geometry.every(item => Math.abs(item.sceneWidth - item.buttonWidth) <= 2), 'Every scene fills its station width independently of the label length');
      assert(geometry.every(item => item.actorBottom === undefined || item.actorBottom <= item.sceneHeight + 6), 'Characters stay inside the illustration and cannot cover a station sign or its costs');
      assert.deepEqual(await actors(), expectedActors, 'Only the authoritative task identities occupy their actual stations');
      for (const [kind, actor, name] of [['culture', 'work-plan-anna', 'Anna Le Gall'], ['communication', 'work-plan-mael', 'Maël Riou'], ['processing', 'player', 'Toi']]) {
        assert.equal(await page.$eval(scene(kind), node => node.dataset.stationActor), actor);
        const label = await page.$eval(`[data-staff-work-station="${kind}"]`, node => node.textContent);
        assert(label.includes(name), 'The station names the same real employee or customized player: ' + kind);
        await page.waitForSelector(scene(kind) + ' canvas[data-avatar-state="ready"]');
        await show(kind); await visiblyMoves(kind);
      }
      await show('administration'); await frozen('administration', 'Queued work');
      assert.equal(await page.$eval(scene('administration'), node => node.dataset.stationAnimated), 'false');
      const empty = await page.$$eval('[data-staff-station-scene][data-station-activity="idle"]', nodes => nodes.map(node => ({ station: node.dataset.staffStationScene, actors: node.querySelectorAll('canvas').length, tools: node.querySelectorAll('[data-station-moving-part="tool"]').length })));
      assert(empty.length > 0 && empty.every(item => item.actors === 0 && item.tools === 0), 'Idle stations retain only their own decorative vignette');
      await page.$eval('[data-staff-work-plan]', node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await shot(`work-scene-working-${width}`);
      if (width === 1440 && !workScenePreview) {
        await motion('culture', 'running'); await motion('communication', 'running');
        const { default: ffmpegPath } = await import('ffmpeg-static');
        const { execFile } = await import('node:child_process');
        const video = resolve(output, 'work-scene-motion-demo.webm');
        const capture = resolve(output, 'work-scene-motion-capture.webm');
        const recorder = await page.screencast({ path: capture, format: 'webm', fps: 24, ffmpegPath });
        try { await pause(4500); } finally { await recorder.stop(); }
        await new Promise((resolve, reject) => execFile(ffmpegPath, ['-y', '-i', capture, '-t', '4', '-an', '-r', '24', '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-pix_fmt', 'yuv420p', video], error => error ? reject(error) : resolve()));
        results.push({ width, scope: 'two visible active work stations video', video, checks: ['Anna at culture', 'Maël at communication', 'customized player at processing', 'no task or money change'], mutations: 0 });
      }
      assert.deepEqual(await raw(), before, 'Animation cannot change cash, task results or reserved hours');
      assert.equal((await calls()).length, 0, 'Rendering and motion create no POST');
      results.push({ width, scope: 'real station identities', geometry, checks: ['real engine task identities and names', 'distinct live character and small tool', 'queued worker stays still', 'idle station has no invented worker', 'decoded art and portraits', 'equal full station scene widths', 'no overflow'], mutations: 0 });
    }

    if (!workScenePreview) {
    // The same mounted scenes follow preference, viewport and read availability.
    const beforeLifecycle = await raw();
    await keyActivate('[data-staff-plan-motion-toggle]'); await motion('culture', 'paused'); await frozen('culture', 'User pause');
    assert.equal(await page.$eval('[data-staff-plan-motion-toggle]', node => node.getAttribute('aria-pressed')), 'true');
    await refresh(); await motion('culture', 'paused'); await frozen('culture', 'Pause after server read');
    await keyActivate('[data-staff-plan-motion-toggle]'); await show('culture');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await motion('culture', 'reduced'); await frozen('culture', 'Live reduced motion');
    await shot('work-scene-reduced-1440');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]); await show('culture');
    await page.evaluate(() => { const spacer = document.createElement('div'); spacer.dataset.workSceneAuditSpacer = ''; spacer.style.height = '200vh'; document.body.append(spacer); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); });
    await motion('culture', 'offscreen'); await frozen('culture', 'Offscreen work scene');
    await page.evaluate(() => document.querySelector('[data-work-scene-audit-spacer]').remove()); await show('culture');
    const other = await browser.newPage(); let realHidden = false;
    try {
      await other.bringToFront(); realHidden = await page.evaluate(() => document.hidden);
      if (!realHidden) await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await motion('culture', 'hidden'); await frozen('culture', 'Hidden tab');
    } finally {
      if (!realHidden) await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await other.close(); await page.bringToFront();
    }
    await show('culture'); assert.deepEqual(await raw(), beforeLifecycle);
    await page.evaluate(() => window.__workScene.availability(false)); await button('Actualiser'); await page.waitForSelector('[data-staff-desk] [role="alert"]');
    await page.waitForFunction(() => document.querySelector('[data-staff-station-scene="culture"]')?.dataset.stationAnimated === 'false'); await frozen('culture', 'Failed server read');
    assert.deepEqual(await raw(), beforeLifecycle, 'Failed reads preserve the last authoritative tasks and all money');
    assert.equal((await calls()).length, 0); await shot('work-scene-unavailable-1440');
    results.push({ width: 1440, scope: 'station motion lifecycle', checks: ['pause and resume', 'pause survives GET', 'live reduced motion', 'real offscreen observer', realHidden ? 'real hidden tab' : 'visibility event fallback', 'read failure stops work', 'unchanged tasks, hours and cash', 'zero POST'], mutations: 0 });

    await open(390); await show('processing');
    const playerAvatar = await page.$eval(scene('processing') + ' canvas', node => node.toDataURL());
    const beforeProfile = await raw();
    for (const profile of ['null', 'error']) {
      const reads = await page.evaluate(() => window.__workScene.profileReads());
      await page.evaluate(profile => window.__workScene.profile(profile), profile);
      await page.waitForFunction(reads => window.__workScene.profileReads() > reads, {}, reads);
      await page.waitForSelector(scene('processing') + ' canvas', { hidden: true });
      assert.equal(await page.$eval(scene('processing'), node => node.dataset.stationActor), 'player', 'Missing profile never substitutes an employee');
      assert.equal(await page.$$eval(scene('culture') + ' canvas[data-avatar-state="ready"]', nodes => nodes.length), 1, 'Employee identity does not depend on the player profile');
      await shot(`work-scene-profile-${profile}-390`);
    }
    await page.evaluate(() => window.__workScene.profile('ready')); await page.waitForSelector(scene('processing') + ' canvas[data-avatar-state="ready"]');
    assert.equal(await page.$eval(scene('processing') + ' canvas', node => node.toDataURL()), playerAvatar, 'Profile recovery restores the same customized avatar');
    assert.deepEqual(await raw(), beforeProfile); assert.equal((await calls()).length, 0);
    results.push({ width: 390, scope: 'current player profile fallback', checks: ['existing GET social/player', 'customized player full avatar', 'null and 503 use neutral fallback', 'employee unaffected', 'profile recovery', 'no write or economic change'], mutations: 0 });

    await open(390, 'deadline');
    await page.evaluate(() => window.__workScene.armDeadline(900)); await refresh(); await show('culture');
    const beforeDeadline = await raw();
    await activity('culture', 'waiting'); await frozen('culture', 'Elapsed estimated deadline without server completion');
    assert.equal((await raw()).state.tasks[0].status, 'running', 'Elapsed client time cannot finish authoritative work');
    assert.deepEqual(await raw(), beforeDeadline, 'Elapsed client time cannot grant XP, money or task effects');
    await page.waitForSelector('[data-staff-work-task="scene-deadline"][data-task-activity="waiting"]');
    await shot('work-scene-waiting-390');
    await page.evaluate(() => window.__workScene.settle()); await refresh(); await activity('culture', 'idle');
    assert.equal((await raw()).state.tasks[0].status, 'completed', 'Only the real engine acknowledgment completes the task');
    assert.equal(await page.$(scene('culture') + ' canvas'), null, 'Completed work removes the active scene character');
    await frozen('culture', 'Completed task'); assert.equal((await calls()).length, 0); await shot('work-scene-completed-390');
    results.push({ width: 390, scope: 'deadline and authoritative completion', checks: ['estimated deadline stops movement', 'waiting task remains visible', 'no client completion or reward', 'server completion removes actor', 'zero POST'], mutations: 0 });

    for (const kind of ['culture', 'processing', 'communication', 'sales', 'administration', 'training', 'trim']) {
      await open(390, kind); await show(kind); await activity(kind, 'working');
      assert.deepEqual(await actors(), [{ station: kind, actor: 'work-plan-anna', activity: 'working' }]);
      const before = await raw(); await visiblyMoves(kind);
      assert.equal(await page.$$eval(scene(kind) + ' [data-station-moving-part="tool"] img', nodes => nodes.filter(node => node.complete && node.naturalWidth > 0).length), ['processing', 'trim'].includes(kind) ? 0 : 1, 'Only known appropriate tools accompany the real task');
      await shot(`work-scene-station-${kind}-390`); assert.deepEqual(await raw(), before); assert.equal((await calls()).length, 0);
    }
    results.push({ width: 390, scope: 'seven station materials', checks: ['unique station vignette retained', 'all seven real engine task kinds', 'actual Anna identity', 'decoded appropriate small props', 'no invented processing or trim mode', 'painted motion', 'no overflow or POST'], mutations: 0 });

    for (const width of [320, 390, 1440]) {
      await open(width, ''); const before = await raw();
      const employee = '[data-staff-work-employee="work-plan-mael"]', station = '[data-staff-station="culture"]';
      if (width === 390) { const actor = await page.$(employee); await actor.tap(); await actor.dispose(); const target = await page.$(station); await target.tap(); await target.dispose(); }
      else { await keyActivate(employee); await keyActivate(station); }
      await page.waitForSelector('[data-staff-work-form="work-plan-mael"]');
      assert.deepEqual(await actors(), [], 'Keyboard/touch preparation never starts a worker in the scenery');
      await input('Temps à réserver', '1'); await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await page.waitForSelector('dialog[open]');
      assert.deepEqual(await actors(), [], 'A proposal never starts work'); await page.keyboard.press('Escape');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await closeAssignment('culture'); assert.deepEqual(await raw(), before); assert.equal((await calls()).length, 0); await layout();
    }
    results.push({ widths: [320, 390, 1440], scope: 'speculative assignment remains inert', checks: ['keyboard and touch assignment', 'proposal and cancellation preserve focus', 'no invented actor or animation', 'zero POST', 'no overflow'], mutations: 0 });
    }
  }
  if (workPlanOnly) {
    const employee = id => `[data-staff-work-employee="${id}"]`;
    const station = kind => `[data-staff-work-station="${kind}"]`;
    const form = id => `[data-staff-work-form="${id}"]`;
    async function keyClick(selector) { await page.waitForSelector(selector, { visible: true }); await page.focus(selector); await page.keyboard.press('Enter'); }
    async function tap(selector) { const node = await page.waitForSelector(selector, { visible: true }); await node.tap(); await node.dispose(); }
    async function cancelAssignment(expectedStation) {
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      const control = await page.waitForFunction(() => [...document.querySelectorAll('[data-staff-assignment-panel] button')].find(node => node.textContent.includes('Annuler') && !node.disabled));
      // The dialog restores its triggering button on the next frame. Let that
      // finish before focusing another control, or Enter can reopen the dialog.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await control.asElement().focus(); await page.keyboard.press('Enter'); await control.dispose();
      await page.waitForFunction(() => !document.querySelector('[data-staff-assignment-panel]'));
      if (expectedStation) await page.waitForFunction(kind => document.activeElement?.getAttribute('data-staff-station') === kind, {}, expectedStation);
    }
    async function assign(id, kind, interaction = 'keyboard') {
      const beforeCalls = (await calls()).length;
      const beforeTasks = (await raw()).state.tasks;
      const beforeArrivals = await page.$$eval('[data-staff-work-task][data-task-arrived="true"]', nodes => nodes.map(node => node.dataset.staffWorkTask).sort());
      const beforeSceneActors = await page.$$eval('[data-staff-station-scene][data-station-actor]', nodes => nodes.map(node => [node.dataset.staffStationScene, node.dataset.stationActor]));
      const normalMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches);
      async function checkDropPreview() {
        await page.waitForSelector(station(kind) + ' [data-staff-placement-preview="drop"]');
        assert((await page.$eval(station(kind) + ' [data-staff-placement-preview]', node => node.textContent)).includes('À préparer'), 'The destination portrait is visibly marked as preparation');
        assert.equal(await page.$eval('[data-staff-drag-preview]', node => node.dataset.ready), 'true');
        assert.deepEqual(await page.$$eval('[data-staff-work-task][data-task-arrived="true"]', nodes => nodes.map(node => node.dataset.staffWorkTask).sort()), beforeArrivals, 'A speculative drag creates no confirmed arrival');
        assert.deepEqual((await raw()).state.tasks, beforeTasks, 'A drag preview cannot create a task');
        assert.deepEqual(await page.$$eval('[data-staff-station-scene][data-station-actor]', nodes => nodes.map(node => [node.dataset.staffStationScene, node.dataset.stationActor])), beforeSceneActors, 'A drag preview cannot invent or swap a working scene actor');
      }
      if (interaction === 'mouse-drag' || interaction.startsWith('touch-drag')) {
        const scrollDrag = interaction === 'touch-drag-scroll';
        // Bring the chosen portrait into view before measuring the drop target.
        // The paper cards can stack; the separate short viewport still exercises edge scrolling.
        if (scrollDrag) await page.setViewport({ width: 390, height: 420, hasTouch: true });
        await page.$eval(employee(id), node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
        const source = await page.$eval(employee(id) + (interaction.startsWith('touch-drag') ? ' [data-staff-work-drag-handle]' : ''), node => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
        const target = await page.$eval(station(kind), node => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
        const height = await page.evaluate(() => innerHeight);
        assert(source.y > 0 && source.y < height && (scrollDrag || target.y > 0 && target.y < height), 'Drag starts from a visible source');
        if (interaction.startsWith('touch-drag')) {
          const client = await page.createCDPSession();
          try {
            const scrollBefore = await page.evaluate(() => scrollY);
            if (scrollDrag) assert(target.y > height, 'The distant station initially needs scrolling');
            await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...source, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
            const approach = scrollDrag ? { x: target.x, y: height - 18 } : target;
            for (let step = 1; step <= 18; step++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: source.x + (approach.x - source.x) * step / 18, y: source.y + (approach.y - source.y) * step / 18, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
            if (scrollDrag) {
              await page.waitForFunction(kind => { const box = document.querySelector(`[data-staff-work-station="${kind}"]`)?.getBoundingClientRect(); return box && box.top > 70 && box.bottom < innerHeight - 90; }, {}, kind);
              assert((await page.evaluate(() => scrollY)) > scrollBefore + 150, 'Holding the actual touch drag near the edge scrolls to a distant room');
              const destination = await page.$eval(station(kind), node => { const box = node.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
              await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...destination, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
            }
            await page.waitForSelector(station(kind) + '[data-drop-target="true"]');
            await checkDropPreview();
            await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } finally { await client.detach(); }
        } else {
          await page.mouse.move(source.x, source.y); await page.mouse.down();
          if (normalMotion) {
            await page.mouse.move(source.x + 14, source.y, { steps: 2 }); await page.waitForSelector('[data-staff-drag-preview]');
            const pickup = await page.$eval('[data-staff-drag-preview] > span:first-child', node => { const style = getComputedStyle(node); return { name: style.animationName, seconds: parseFloat(style.animationDuration), count: style.animationIterationCount }; });
            assert.notEqual(pickup.name, 'none', 'Ordinary motion enables the physical pickup response');
            assert(pickup.seconds > 0 && pickup.seconds <= .5 && pickup.count === '1', 'Pickup motion is short and finite');
            await shot('work-plan-motion-pickup');
          }
          await page.mouse.move(target.x, target.y, { steps: 24 });
          await page.waitForSelector(station(kind) + '[data-drop-target="true"]'); await checkDropPreview();
          if (normalMotion) {
            await shot('work-plan-motion-drop');
            await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
            await page.waitForFunction(() => [...document.querySelectorAll('[data-staff-work-plan] *')].every(node => getComputedStyle(node).animationName === 'none'));
            assert.equal(await page.$eval('[data-staff-drag-preview] > span:first-child', node => getComputedStyle(node).animationName), 'none', 'Reduced motion takes effect during an active drag');
            assert.equal(await page.$eval(station(kind) + ' > button > span:first-child > span:first-child', node => getComputedStyle(node).translate), 'none', 'Reduced motion also removes the destination artwork lift');
            await checkDropPreview(); await shot('work-plan-motion-reduced-drag');
            await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
          }
          await page.mouse.up();
        }
        if (scrollDrag) await page.setViewport({ width: 390, height: 844, hasTouch: true });
      } else {
        if (await page.$eval(employee(id), node => node.getAttribute('aria-pressed') !== 'true')) await (interaction === 'touch' ? tap(employee(id)) : keyClick(employee(id)));
        await page.waitForFunction(id => document.querySelector(`[data-staff-work-employee="${id}"]`)?.getAttribute('aria-pressed') === 'true', {}, id);
        await (interaction === 'touch' ? tap(station(kind) + ' > button') : keyClick(station(kind) + ' > button'));
      }
      if (kind !== 'trim') {
        await page.waitForSelector(form(id), { visible: true });
        assert.equal(await page.$eval(form(id), node => node.dataset.staffWorkKind), kind, 'The chosen station opens the exact employee and activity');
        await page.waitForSelector(station(kind) + ' [data-staff-placement-preview="preparing"]');
      }
      assert.equal((await calls()).length, beforeCalls, 'Dropping or selecting a station never posts a command');
    }
    async function openPlan(width, motion = 'reduce') {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: motion }]);
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('[data-staff-work-plan]', { visible: true });
      assert.equal((await raw()).state.employees.length, 2);
    }
    for (const width of [320, 390, 1440]) {
      await openPlan(width); const before = await raw(); await shot(`work-plan-${width}`);
      assert.deepEqual(await page.$$eval('[data-staff-work-station]', nodes => nodes.map(node => node.dataset.staffWorkStation).sort()), ['culture', 'processing', 'communication', 'sales', 'administration', 'training', 'trim'].sort());
      await assign('work-plan-mael', 'culture', width === 1440 ? 'mouse-drag' : width === 390 ? 'touch-drag' : 'keyboard');
      await select('Culture à accompagner', 'test-run-selected'); await input('Temps à réserver', '2');
      await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await page.waitForSelector('dialog[open]');
      const review = await page.$eval('dialog dl', node => node.textContent);
      assert(review.includes('Maël Riou') && review.includes('Culture choisie pour Maël') && /2\s*h/.test(review), 'Confirmation names the chosen employee, target and hours');
      await shot(`work-plan-confirm-${width}`); await page.keyboard.press('Escape');
      assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), before, 'Cancelling the confirmation preserves tasks, hours and cash');
      await cancelAssignment('culture'); assert.equal((await calls()).length, 0);
      await assign('work-plan-mael', 'culture'); await select('Culture à accompagner', 'test-run-selected'); await input('Temps à réserver', '2');
      await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await button('Confier ce travail', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1);
      const committed = await raw(), task = committed.state.tasks[0];
      assert.deepEqual({ employeeId: task.employeeId, kind: task.kind, targetId: task.targetId, hours: task.hours }, { employeeId: 'work-plan-mael', kind: 'culture', targetId: 'test-run-selected', hours: 2 });
      assert.equal(committed.cashCents, before.cashCents);
      assert.equal(committed.state.employees.find(row => row.id === task.employeeId).workDays['1'].usedHours, 2);
      assert.equal((await calls()).length, 1);
      await button('Actualiser'); await page.waitForSelector(`[data-staff-work-task="${task.id}"]`);
      await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector('[data-workshop-trim-desk]');
      await button('Personnel', '[aria-label="Navigation de recette"]'); await page.waitForSelector(`[data-staff-work-task="${task.id}"]`);
      assert.deepEqual((await raw()).state.tasks, committed.state.tasks, 'Confirmed work is restored from the API after refreshing and remounting the desk');
      await page.$eval('[data-staff-work-plan]', node => node.scrollIntoView({ block: 'start' })); await shot(`work-plan-persisted-${width}`);

      for (const kind of ['processing', 'communication', 'sales', 'administration', 'training']) {
        await assign('work-plan-anna', kind, width < 500 ? 'touch' : 'keyboard');
        if (kind === 'processing') await select('Lot en séchage ou affinage', 'test-flower-selected');
        if (kind === 'sales') await select('Ville à prospecter', 'brest');
        await input('Temps à réserver', kind === 'training' || kind === 'sales' ? '2' : '1');
        await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await page.waitForSelector('dialog[open]');
        const text = await page.$eval('dialog dl', node => node.textContent);
        assert(text.includes('Anna Le Gall'), 'Every station retains the selected worker');
        if (kind === 'processing') assert(text.includes('Lot choisi pour Anna'));
        if (kind === 'sales') assert(text.includes('Brest') && text.includes('Frais de déplacement au départ'));
        await page.keyboard.press('Escape'); await cancelAssignment();
        assert.equal((await calls()).length, 1, 'Reviewing other stations never assigns work or charges training/travel');
      }
      if (width === 390) {
        await assign('work-plan-anna', 'administration', 'touch-drag-scroll');
        await shot('work-plan-touch-scroll-administration-390');
        await cancelAssignment('administration');
        assert.equal((await calls()).length, 1, 'A long touch drag and cancellation do not persist an assignment');
      }
      await assign('work-plan-anna', 'trim', width < 500 ? 'touch' : 'keyboard');
      await page.waitForSelector('[data-workshop-trim-desk]', { visible: true });
      await page.waitForSelector('[data-trim-worker]', { visible: true });
      assert.equal(await page.$eval('[data-trim-worker]', node => node.dataset.trimWorker), 'work-plan-anna', 'Trim forwards the selected employee to the workshop form');
      assert.equal((await calls()).length, 1);
      assert.deepEqual((await raw()).state.tasks, committed.state.tasks);
      await shot(`work-plan-trim-${width}`);
      results.push({ width, scope: 'work plan', checks: ['seven stations', width === 1440 ? 'real mouse pointer drag' : width === 390 ? 'real CDP touch drag' : 'keyboard selection', ...(width === 390 ? ['touch drag auto-scroll reaches administration without posting'] : []), width < 500 ? 'touch taps' : 'keyboard stations', 'no write on placement', 'exact employee target and hours', 'confirmation cancellation', 'assignment cancellation restores station focus', 'confirmed task and shared hours', 'API refresh and remount persistence', 'training and travel review without payment', 'shared trim stock and selected employee'], mutations: (await calls()).length });
    }
    for (const condition of ['weekend', 'exhausted', 'leave', 'error']) {
      await openPlan(390);
      if (condition === 'error') await page.evaluate(() => window.__staff.unavailable());
      else await page.evaluate(condition => window.__staff.condition(condition), condition);
      await button('Actualiser');
      if (condition === 'error') {
        await page.waitForSelector('[data-staff-desk] [role="alert"]');
        assert(await page.$$eval('[data-staff-work-employee]', nodes => nodes.every(node => node.matches(':disabled'))), 'Unavailable data disables new placement');
      } else {
        await page.waitForSelector('[data-guide-staff-ready="true"]');
        await assign('work-plan-anna', 'communication', 'touch');
        assert(await page.$eval('[data-staff-assignment-panel]', node => { const buttons = [...node.querySelectorAll('button[type="submit"]')]; return buttons.length > 0 && buttons.every(button => button.matches(':disabled')); }), 'Unavailable hours cannot be confirmed');
        const text = await page.$eval('[data-staff-work-plan]', node => node.textContent);
        assert(condition === 'weekend' ? /repos|week-end|samedi/i.test(text) : condition === 'leave' ? /congé/i.test(text) : /épuis|0 h|aucune heure|plus d’heure/i.test(text), 'The plan explains why this employee cannot work');
      }
      assert.equal((await calls()).length, 0); assert.equal((await raw()).state.tasks.length, 0);
      await shot(`work-plan-${condition}-390`);
      results.push({ width: 390, scope: 'work plan ' + condition, checks: ['visible availability reason', 'no executable assignment', 'no mutation'], mutations: 0 });
    }
    await openPlan(1440, 'no-preference');
    const beforeMotion = await raw();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-avatar-state]')].every(node => node.dataset.avatarState === 'ready'));
    await shot('work-plan-motion-before');
    await assign('work-plan-mael', 'culture', 'mouse-drag');
    assert.equal(await page.$('[data-task-arrived="true"]'), null, 'Releasing a portrait only prepares the assignment');
    await select('Culture à accompagner', 'test-run-selected'); await input('Temps à réserver', '2');
    await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await page.waitForSelector('dialog[open]');
    assert.equal(await page.$('[data-task-arrived="true"]'), null, 'The confirmation dialog does not claim an assignment');
    await button('Confier ce travail', 'dialog');
    await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1);
    const working = (await raw()).state.tasks[0];
    const workingRow = `[data-staff-work-task="${working.id}"]`;
    await page.waitForSelector(workingRow + '[data-task-arrived="true"][data-task-activity="working"]');
    assert((await page.$eval(workingRow, node => node.textContent)).includes('Affecté'), 'Only the confirmed server task receives the assignment stamp');
    assert(Date.parse(working.startedAt) <= Date.parse((await raw()).serverNow));
    const arrival = await page.$eval(workingRow + ' > span:first-child', node => { const style = getComputedStyle(node); return { name: style.animationName, seconds: parseFloat(style.animationDuration), count: style.animationIterationCount }; });
    assert.notEqual(arrival.name, 'none'); assert(arrival.seconds > 0 && arrival.seconds <= .6 && arrival.count === '1', 'Confirmed arrival has a finite settling response');
    assert.equal((await raw()).state.employees.find(row => row.id === working.employeeId).workDays['1'].usedHours, 2);
    assert.equal((await raw()).cashCents, beforeMotion.cashCents);
    await page.$eval('[data-staff-work-plan]', node => node.scrollIntoView({ block: 'start' })); await shot('work-plan-motion-confirmed');
    await page.waitForFunction(() => !document.querySelector('[data-task-arrived="true"]'));
    const readsBeforeRefresh = await page.evaluate(() => window.__staff.reads());
    await button('Actualiser'); await page.waitForFunction(reads => window.__staff.reads() > reads, {}, readsBeforeRefresh);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.$('[data-task-arrived="true"]'), null, 'Refreshing the same task does not replay a confirmation');
    await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector('[data-workshop-trim-desk]');
    await button('Personnel', '[aria-label="Navigation de recette"]'); await page.waitForSelector(workingRow);
    assert.equal(await page.$('[data-task-arrived="true"]'), null, 'Remounting a recorded task does not replay a confirmation');
    await assign('work-plan-mael', 'communication'); await input('Temps à réserver', '1');
    await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await button('Confier ce travail', 'dialog');
    await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 2);
    const queued = (await raw()).state.tasks.find(task => task.id !== working.id), queuedRow = `[data-staff-work-task="${queued.id}"]`;
    await page.waitForSelector(queuedRow + '[data-task-arrived="true"][data-task-activity="queued"]');
    assert.equal(queued.startedAt, working.completesAt, 'Queued state follows the authoritative end of the preceding task');
    assert((await page.$eval(queuedRow, node => node.textContent)).includes('À venir'));
    assert.equal((await raw()).state.employees.find(row => row.id === working.employeeId).workDays['1'].usedHours, 3);
    await page.$eval('[data-staff-work-plan]', node => node.scrollIntoView({ block: 'start' })); await shot('work-plan-motion-queued');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-staff-work-plan] *')].every(node => getComputedStyle(node).animationName === 'none'));
    assert((await page.$eval(queuedRow, node => node.textContent)).includes('Affecté'), 'Reduced motion preserves visible confirmation and queue state');
    assert.equal((await calls()).length, 2, 'Motion and preference changes only accompany the two explicitly confirmed assignments');
    assert.equal((await raw()).cashCents, beforeMotion.cashCents);
    await shot('work-plan-motion-after-reduced');
    results.push({ width: 1440, scope: 'work plan motion', checks: ['finite normal portrait pickup', 'speculative drop preview cannot confirm', 'live reduced-motion during active pointer drag', 'snapshot-only finite task arrival', 'real working and queued states', 'server hours and cash unchanged by motion', 'refresh and remount never replay arrival', 'reduced motion keeps confirmation readable'], mutations: (await calls()).length });
  }
  if (prospectingOnly) {
    async function activate(selector, touch = false) {
      const control = await page.waitForSelector(selector, { visible: true });
      if (touch) await control.tap(); else { await control.focus(); await page.keyboard.press('Enter'); }
      await control.dispose();
    }
    async function openProspecting(touch = false) {
      if (await page.$eval('[data-staff-work-employee="prospecting-ines"]', node => node.getAttribute('aria-pressed') !== 'true')) await activate('[data-staff-work-employee="prospecting-ines"]', touch);
      await activate('button[data-staff-station="sales"]', touch);
      await page.waitForSelector('[data-staff-assignment-panel] [data-staff-prospecting-map]', { visible: true });
      assert.equal(await page.$eval('[data-staff-work-form]', node => node.dataset.staffWorkForm), 'prospecting-ines');
    }
    async function chooseCity(cityId, touch = false, pin = false) {
      const selector = `[data-staff-assignment-panel] [${pin ? 'data-prospecting-map-pin' : 'data-prospecting-city'}="${cityId}"]`;
      if (pin) {
        const control = await page.waitForSelector(selector, { visible: true });
        await control.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'center' }));
        if (touch) await control.tap(); else await control.click();
        await control.dispose();
      } else { await disclosure('[data-staff-assignment-panel] [data-prospecting-city-list]', true); await activate(selector, touch); }
      await page.waitForSelector(`[data-staff-assignment-panel] [data-prospecting-city-details="${cityId}"]`, { visible: true });
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: width < 500 ? 844 : 1000, hasTouch: width < 500 });
      await page.goto(origin, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('[data-staff-work-plan]'); await openProspecting(width < 500);
      const before = await raw();
      assert.equal(before.context.shopPartners, 125); assert.equal(before.state.prospecting.brest, 30);
      assert.deepEqual(await page.$$eval('[data-staff-assignment-panel] [data-prospecting-department]', nodes => [...new Set(nodes.map(node => node.dataset.prospectingDepartment))].sort()), ['22', '29', '35', '56']);
      await disclosure('[data-staff-assignment-panel] [data-prospecting-city-list]', true);
      assert.equal(await page.$$eval('[data-staff-assignment-panel] [data-prospecting-city]', nodes => nodes.length), 8);
      assert(await page.$$eval('[data-staff-assignment-panel] [data-prospecting-city]', nodes => nodes.every(node => { const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; })), 'Every city has a usable touch target');
      assert(await page.$$eval('[data-staff-assignment-panel] [data-prospecting-map-pin]', nodes => nodes.length === 8 && nodes.every(node => { const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; })), 'Geographic map points remain usable at every width');
      if (width < 500) {
        await page.focus('[data-staff-assignment-panel] [data-prospecting-map-viewport]'); await page.keyboard.press('End');
        assert(await page.$eval('[data-staff-assignment-panel] [data-prospecting-map-viewport]', node => node.scrollLeft > 100), 'The map pans independently of the page on mobile');
      }
      await chooseCity('brest', width < 500, true);
      assert.equal(await page.$eval('[data-staff-assignment-panel] [data-prospecting-map-pin="brest"]', node => node.getAttribute('aria-pressed')), 'true');
      assert.equal(Number((await page.$eval('[data-staff-assignment-panel] [data-prospecting-city-details="brest"] dl dd', node => node.textContent)).replace(/[^\d,.-]/g, '').replace(',', '.')), 60);
      assert.equal((await calls()).length, 0, 'A direct map point selects Brest and its offered price without creating a mission');
      const flavors = new Set(), products = new Set();
      for (const [index, cityId] of ['saint-brieuc', 'brest', 'vannes', 'rennes'].entries()) {
        await chooseCity(cityId, width < 500 && index % 2 === 0, index === 0);
        await disclosure('[data-staff-assignment-panel] [data-prospecting-profile]', true);
        flavors.add(await page.$eval('[data-staff-assignment-panel] [data-prospecting-city-details] [data-prospecting-flavors]', node => node.textContent.trim()));
        const productText = await page.$eval('[data-staff-assignment-panel] [data-prospecting-city-details] [data-prospecting-products]', node => node.textContent.trim());
        assert(/fleurs/i.test(productText) && /hash/i.test(productText) && /rosin/i.test(productText), 'The city describes all three product families');
        products.add(productText);
        assert.equal((await calls()).length, 0, 'Exploring market profiles never sends a mission or charges a trip');
      }
      assert.equal(flavors.size, 4, 'Cities across the four departments have distinct visible flavor profiles');
      assert(products.size > 1, 'Product interests and examples change with the selected city');
      await chooseCity('brest', width < 500);
      await disclosure('[data-staff-assignment-panel] [data-prospecting-city-list]', false);
      await disclosure('[data-staff-assignment-panel] [data-prospecting-profile]', false);
      await page.$eval('[data-staff-assignment-panel] [data-staff-prospecting-map]', node => node.scrollIntoView({ block: 'start' })); await shot(`prospecting-map-${width}`);
      await disclosure('[data-staff-assignment-panel] [data-prospecting-profile]', true);
      await page.$eval('[data-staff-assignment-panel] [data-prospecting-city-details="brest"]', node => node.scrollIntoView({ block: 'start' })); await shot(`prospecting-city-${width}`);
      await input('Temps à réserver', '2'); await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await page.waitForSelector('dialog[open]');
      const review = await page.$$eval('dialog dl > div', nodes => Object.fromEntries(nodes.map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent])));
      assert.equal(review['Employé'], 'Inès Laurent'); assert.equal(review['Destination / objectif'], 'Brest (29)');
      assert.equal(review['Temps réservé aujourd’hui'], '2 h'); assert.equal(Number(review['Frais de déplacement au départ'].replace(/[^\d,.-]/g, '').replace(',', '.')), 60);
      await shot(`prospecting-confirm-${width}`); await page.keyboard.press('Escape');
      assert.equal((await calls()).length, 0); assert.deepEqual(await raw(), before, 'Cancelling keeps the offered city, funds, hours and network untouched');

      await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await button('Payer le trajet et partir', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1);
      assert.equal((await raw()).cashCents, before.cashCents - 6000);
      const first = (await raw()).state.tasks[0];
      assert.deepEqual({ employeeId: first.employeeId, kind: first.kind, cityId: first.cityId, hours: first.hours }, { employeeId: 'prospecting-ines', kind: 'sales', cityId: 'brest', hours: 2 });
      assert(first.successChance > 0 && first.successChance <= 90);
      assert.equal((await raw()).context.shopPartners, 125, 'A confirmed trip is not yet a successful recruitment');
      await page.evaluate(() => window.__staff.finish()); await button('Actualiser');
      await page.waitForFunction(() => window.__staff.raw().context.shopPartners === 126);
      assert.equal((await raw()).state.prospecting.brest, 31);
      await button('Actualiser'); await page.waitForSelector('[data-guide-staff-ready="true"]');
      assert.equal((await raw()).context.shopPartners, 126, 'Refreshing does not replay a completed recruitment');

      await openProspecting(width < 500); await chooseCity('brest');
      await input('Temps à réserver', '2'); await button('Vérifier l’affectation', '[data-staff-assignment-panel]'); await button('Payer le trajet et partir', 'dialog');
      await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 2);
      await page.evaluate(() => window.__staff.finish()); await button('Actualiser');
      await page.waitForFunction(() => window.__staff.raw().context.shopPartners === 127);
      assert.equal((await raw()).state.prospecting.brest, 32);
      assert.equal((await raw()).cashCents, before.cashCents - 12000);
      assert.equal((await raw()).state.employees[0].workDays['1'].usedHours, 4);
      const commands = await calls(); assert.equal(commands.length, 2);
      assert(commands.every(command => command.action === 'assign' && command.cityId === 'brest' && command.expectedCostCents === 6000));
      await openProspecting(); await chooseCity('brest');
      assert((await page.$eval('[data-staff-assignment-panel] [data-staff-prospecting-map]', node => node.textContent)).includes('127'), 'The map displays the confirmed network beyond 100 partners');
      await page.$eval('[data-staff-assignment-panel] [data-prospecting-city-details="brest"]', node => node.scrollIntoView({ block: 'start' })); await shot(`prospecting-repeat-${width}`);
      assert.equal((await calls()).length, 2);
      results.push({ width, scope: 'Brittany prospecting map', checks: ['four departments and eight usable city buttons', 'keyboard and touch navigation', 'changing flavor and product profiles', 'informational exploration without writes', 'exact destination hours and travel cost', 'cancellation without mutation', 'network 125→126→127', 'Brest revisited beyond former local pool', 'two travel payments only', 'completed rewards do not replay', 'no horizontal overflow'], mutations: commands.length });
    }
  }
  for (const width of impactDashboardOnly || benefitsOnly || process.argv.includes('--recruitment-only') || dashboardOnly || processingWorkOnly || cultureWorkOnly || weeklyPlanOnly || employeeSheetOnly || sharedTrimOnly || archiveOnly || workSceneOnly || workPlanOnly || prospectingOnly || playerWorkOnly || visualClarityOnly || staffMomentsOnly ? [] : [320, 390, 1440]) {
    await page.setViewport({ width, height: width < 500 ? 844 : 1000 });
    await page.goto(origin, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('[data-staff-desk] [role="meter"]'); await shot(`empty-${width}`);
    assert.equal(await page.$$eval('[data-staff-desk] button', buttons => buttons.some(button => /^(Trim|Préparer le trim|Vérifier cet achat)$/.test(button.textContent.trim()))), false, 'Personnel contains no trim operations');
    assert.equal((await calls()).length, 0);
    await button('Recruter'); await page.waitForFunction(() => [...document.querySelectorAll('[data-avatar-state]')].length > 0 && [...document.querySelectorAll('[data-avatar-state]')].every(node => node.dataset.avatarState === 'ready')); await shot(`candidates-${width}`);
    await page.$eval('[data-avatar-state]', node => node.scrollIntoView({ block: 'start' })); await shot(`portraits-${width}`);
    await button('Choisir ce profil'); await select('Temps hebdomadaire', '14'); await select('Contrat', 'cdd');
    await button('Vérifier le contrat'); await page.waitForSelector('dialog[open]');
    assert((await page.$eval('dialog', node => node.textContent)).includes('Coût mensuel récurrent estimé'));
    await shot(`hire-confirm-${width}`); await page.keyboard.press('Escape');
    assert.equal((await calls()).length, 0, 'Escape and review do not hire');
    await button('Vérifier le contrat'); await button('Signer ce contrat', 'dialog');
    await page.waitForFunction(() => window.__staff.raw().state.employees.length === 1);
    assert.equal((await raw()).cashCents, 2500000, 'No payroll debit at signature');
    await keyActivate('[data-moment-open-employee]'); await page.waitForSelector('dialog[data-staff-employee-sheet][open]');
    await button('Organiser sa journée', '[data-staff-employee-sheet]'); await page.waitForSelector('[data-staff-work-form]', { visible: true });
    await select('Activité', 'training'); await input('Temps à réserver', '1');
    assert.equal(await page.$eval('[data-staff-work-form] button[type="submit"]', node => node.disabled), true, 'Invalid training hours are blocked without crashing');
    await input('Temps à réserver', '2'); await button('Vérifier l’affectation');
    if (width === 320) await page.evaluate(() => window.__staff.failNext());
    await button('Payer et commencer', 'dialog');
    if (width === 320) { await page.waitForSelector('dialog [role="alert"]'); await button('Réessayer la confirmation', 'dialog'); const mutations = await calls(); assert.equal(mutations.at(-1).requestKey, mutations.at(-2).requestKey, 'Same request key on retry'); }
    await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 1);
    assert.equal((await raw()).cashCents, 2493000, '2 h training paid once');
    assert.equal((await raw()).state.employees[0].workDays['1'].usedHours, 2, 'Training consumes shared capacity');
    await select('Activité', 'sales'); await select('Ville à prospecter', 'brest'); await button('Vérifier l’affectation');
    assert((await page.$eval('dialog', node => node.textContent)).includes('Frais de déplacement au départ'));
    await button('Payer le trajet et partir', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.tasks.length === 2);
    assert.equal((await raw()).cashCents, 2487000, 'Travel cost charged after confirmation');
    assert.equal((await raw()).state.employees[0].workDays['1'].usedHours, 4, 'Prospecting shares capacity');
    await page.evaluate(() => window.__staff.leaveRights()); await button('Actualiser');
    await summary('Congés payés'); await input('Premier jour du jeu', '8'); await input('Dernier jour inclus', '9');
    await button('Vérifier les congés'); await shot(`leave-confirm-${width}`); await button('Confirmer les congés', 'dialog');
    await page.waitForFunction(() => window.__staff.raw().state.employees[0].leave.length === 1);
    assert.equal((await raw()).state.employees[0].leave[0].days, 5, 'Part-time leave counts company workdays until return');
    await button('Annuler cette période'); await button('Annuler les congés', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.employees[0].leave.length === 0);
    await page.evaluate(() => window.__staff.payroll()); await button('Actualiser'); await keyActivate('[data-staff-tab="payroll"]'); await shot(`payroll-${width}`);
    await button('Vérifier le règlement'); await button('Payer les salaires', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.payroll[0].paidCents === 13500);
    await page.waitForFunction(() => !document.querySelector('dialog[open]')); await page.waitForSelector('[data-guide-staff-ready="true"]');
    await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector('[data-workshop-trim-desk] [aria-label="Récoltes en attente de trim"]');
    assert.deepEqual(await page.$$eval('[aria-label="Récoltes en attente de trim"] dd', nodes => nodes.map(node => Number(node.textContent.replace(/[^0-9]/g, '')))), [720, 2], 'Workshop shows confirmed remaining grams and harvest count');
    await button('Verrouiller le parent'); assert.equal(await page.$eval('[data-workshop-trim-desk] button[type="submit"]', node => node.disabled), true, 'Parent editing locks trim'); await button('Déverrouiller le parent');
    await shot(`workshop-${width}`); await input('Heures de trim', '6'); await button('Vérifier le trim');
    assert((await page.$eval('dialog', node => node.textContent)).includes('Toi'), 'Player can prepare without assigning an employee');
    assert.equal(await page.$$eval('[aria-label="Navigation de recette"] button', nodes => nodes.every(node => node.disabled)), true, 'Confirmation locks parent navigation');
    await page.keyboard.press('Escape'); assert.equal(await page.$$eval('[aria-label="Navigation de recette"] button', nodes => nodes.some(node => node.disabled)), false, 'Cancelling releases parent navigation');
    await button('Vérifier le trim'); await shot(`manual-trim-confirm-${width}`);
    if (width === 320) await page.evaluate(() => window.__staff.failNext());
    await button('Confirmer le trim', 'dialog');
    if (width === 320) { await page.waitForSelector('dialog [role="alert"]'); assert.equal(await page.$$eval('[aria-label="Navigation de recette"] button', nodes => nodes.every(node => node.disabled)), true, 'Failed confirmation keeps the parent locked while retry is pending'); await button('Réessayer la confirmation', 'dialog'); const mutations = await calls(); assert.equal(mutations.at(-1).requestKey, mutations.at(-2).requestKey, 'Workshop retry preserves its request key'); }
    await page.waitForFunction(() => window.__staff.raw().state.playerWorkDays['1']?.usedHours === 6);
    assert.deepEqual(await page.$$eval('[aria-label="Récoltes en attente de trim"] dd', nodes => nodes.map(node => Number(node.textContent.replace(/[^0-9]/g, '')))), [720, 2], 'Reservation alone does not claim prepared grams');
    await page.evaluate(() => window.__staff.finish()); await button('Actualiser'); await page.waitForFunction(() => window.__staff.raw().context.trimLots[0].completedAt !== null);
    await button('Vérifier cet achat'); await shot(`machine-purchase-confirm-${width}`); const beforeMachine = (await raw()).cashCents;
    await button('Acheter la trimeuse', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.trimmerOwned);
    assert.equal((await raw()).cashCents, beforeMachine - 150000, 'Machine purchase charged only after confirmation');
    await select('Qui fait le trim ?', (await raw()).state.employees[0].id); await button('Machine'); await input('Heures de trim', '1.5');
    await button('Vérifier le trim'); assert((await page.$eval('dialog', node => node.textContent)).includes('-3'), 'Machine quality penalty is visible before confirmation');
    await shot(`machine-trim-confirm-${width}`); await button('Confirmer le trim', 'dialog'); await page.waitForFunction(() => window.__staff.raw().state.tasks.some(task => task.kind === 'trim' && task.trimMode === 'machine'));
    assert.equal((await raw()).state.employees[0].workDays['1'].usedHours, 5.5, 'Trim shares the employee daily capacity');
    await page.evaluate(() => window.__staff.finish()); await button('Actualiser'); await page.waitForFunction(() => window.__staff.raw().context.trimLots[1].completedAt !== null); await shot(`trim-completed-${width}`);
    assert.deepEqual(await page.$$eval('[aria-label="Récoltes en attente de trim"] dd', nodes => nodes.map(node => Number(node.textContent.replace(/[^0-9]/g, '')))), [0, 0]);
    await button('Retrouver cette récolte →'); assert.deepEqual(await page.evaluate(() => window.__staff.openedHarvests), ['trim-manual'], 'Completed lot returns through the parent navigation callback');
    await button('Personnel', '[aria-label="Navigation de recette"]'); await page.waitForSelector('[data-guide-staff-ready="true"]');
    await keyActivate(`[data-staff-work-employee="${(await raw()).state.employees[0].id}"]`);
    await page.waitForFunction(() => { const employeeId = window.__staff.raw().state.employees[0].id; const meter = document.querySelector(`[data-staff-work-employee="${employeeId}"]`)?.parentElement?.querySelector('[role="meter"]'); return meter?.getAttribute('aria-valuenow') === '1.5' && meter?.getAttribute('aria-valuemax') === '7'; });
    assert((await page.$eval('[data-staff-desk]', node => node.textContent)).includes('Trim'), 'Personnel retains completed employee work history');
    assert.equal(await page.$$eval('[data-staff-desk] button', buttons => buttons.some(button => /^(Trim|Préparer le trim|Vérifier cet achat)$/.test(button.textContent.trim()))), false);
    await button('Atelier', '[aria-label="Navigation de recette"]'); await page.waitForSelector('[data-workshop-trim-desk] [aria-label="Récoltes en attente de trim"]');
    await page.evaluate(() => window.__staff.unavailable()); await button('Actualiser'); await page.waitForSelector('[role="alert"]'); await shot(`unavailable-${width}`);
    results.push({ width, checks: ['layout', 'profile avatar renderer ready', 'keyboard dialogs', 'review without mutation', 'hire', 'invalid training', 'shared capacity', 'travel confirmation', 'part-time leave and cancellation', 'payroll', 'independent workshop', 'initial lot', 'parent locking', 'workshop retry', 'actual lot counts', 'player manual trim', 'machine purchase', 'employee machine trim', 'quality penalty review', 'trim completion', 'harvest callback', 'shared hours on return to Personnel', 'unavailable isolation'], mutations: (await calls()).length });
  }
  for (const width of impactDashboardOnly || benefitsOnly || dashboardOnly || processingWorkOnly || cultureWorkOnly || weeklyPlanOnly || employeeSheetOnly || sharedTrimOnly || archiveOnly || workSceneOnly || workPlanOnly || prospectingOnly || playerWorkOnly || visualClarityOnly || staffMomentsOnly ? [] : [320, 1440]) {
    await page.setViewport({ width, height: width < 500 ? 844 : 1000 });
    await page.goto(origin, { waitUntil: 'networkidle0' }); await button('Recruter');
    await page.waitForSelector('[data-recruitment-cycle="0"]');
    assert((await page.$eval('[data-recruitment-cycle]', node => node.textContent)).includes('15 jours de jeu'));
    const firstCodes = await page.$$eval('[data-candidate-code]', nodes => nodes.map(node => node.dataset.candidateCode));
    await page.evaluate(() => { window.__realDateNow = Date.now; Date.now = () => 4102444800000; });
    await button('Actualiser'); await page.waitForSelector('[data-staff-desk][data-guide-staff-ready="true"]');
    assert.equal(await page.$eval('[data-recruitment-cycle]', node => node.dataset.recruitmentCycle), '0', 'Client clock cannot rotate offers');
    await page.evaluate(() => { Date.now = window.__realDateNow; window.__staff.armRecruitment(800); });
    await button('Actualiser'); await page.waitForSelector('[data-recruitment-cycle="1"]');
    const secondCodes = await page.$$eval('[data-candidate-code]', nodes => nodes.map(node => node.dataset.candidateCode));
    assert.equal(secondCodes.some(code => firstCodes.includes(code)), false, 'Timer reads a genuinely new server offer list');
    assert.equal((await calls()).length, 0, 'Rotation never posts a hiring command');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-avatar-state]')].every(node => node.dataset.avatarState === 'ready'));
    assert(await page.$$eval('[data-candidate-code] canvas', nodes => new Set(nodes.map(node => node.toDataURL())).size > 1), 'Rotated offers retain varied profile portraits');
    await page.$eval('[data-recruitment-cycle]', node => node.scrollIntoView({ block: 'start' })); await shot(`recruitment-renewal-${width}`);
    await button('Choisir ce profil'); await button('Vérifier le contrat'); await page.waitForSelector('dialog[open]');
    const review = await page.$eval('dialog dl', node => node.textContent);
    const beforeExpiry = await raw();
    await page.evaluate(() => { window.__staff.advanceRecruitment(); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.$eval('[data-recruitment-cycle]', node => node.dataset.recruitmentCycle), '1', 'Pending confirmation is not silently replaced after sleep');
    await button('Signer ce contrat', 'dialog'); await page.waitForSelector('dialog [role="alert"]');
    assert((await page.$eval('dialog [role="alert"]', node => node.textContent)).includes('plus disponible'), 'Expired offer rejection is shown');
    assert.equal(await page.$eval('dialog dl', node => node.textContent), review, 'Rejected proposal keeps its reviewed person and cost');
    assert.equal((await raw()).cashCents, beforeExpiry.cashCents); assert.equal((await raw()).state.employees.length, 0);
    await shot(`recruitment-expired-${width}`); await button('Réessayer la confirmation', 'dialog');
    await page.waitForFunction(() => window.__staff.calls.length === 2);
    const refused = await calls(); assert.equal(refused[0].requestKey, refused[1].requestKey); assert.equal(refused[0].candidateCode, secondCodes[0]);
    await page.waitForFunction(() => !!document.querySelector('dialog [role="alert"]') && [...document.querySelectorAll('dialog button')].some(node => node.textContent.trim() === 'Réessayer la confirmation' && !node.disabled));
    await page.keyboard.press('Escape'); await page.waitForSelector('[data-recruitment-cycle="2"]');
    assert((await page.$eval('[data-staff-panel="candidates"]', node => node.textContent)).includes('Ce dossier ne fait plus partie'));
    const beforeSleepReads = await page.evaluate(() => window.__staff.reads());
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); window.__staff.advanceRecruitment(); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.evaluate(() => window.__staff.reads()), beforeSleepReads, 'Hidden tab does not poll eagerly');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForSelector('[data-recruitment-cycle="3"]');
    assert.equal((await calls()).length, 2, 'Return from sleep only refreshes offered candidates');
    results.push({ width, scope: 'recruitment renewal', checks: ['15 game day calendar', 'server clock authority', 'deadline refresh', 'renewed portrait identities', 'pending proposal preserved', 'expired offer rejected', 'same retry request key', 'deferred refresh after cancellation', 'return from hidden tab'], mutations: (await calls()).length });
  }
  assert.deepEqual(errors, [], 'No browser errors'); assert.deepEqual(forbiddenRequests, [], 'No production or external API calls');
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: true, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ ok: true, groups: results.length, report: 'output/placard-staff-ui/' + reportName }));
} catch (error) {
  const debug = await page?.evaluate(() => ({ inputs: [...document.querySelectorAll('input,select')].map(node => ({ value: node.value, text: node.closest('label')?.textContent })), alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent), text: document.querySelector('[aria-label="Atelier de trim"]')?.textContent, scenes: [...document.querySelectorAll('[data-staff-station-scene]')].map(node => ({ ...node.dataset, text: node.closest('[data-staff-work-station]')?.textContent })), fixture: window.__staff?.raw() })).catch(() => null);
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: false, message: error.message, results, errors, forbiddenRequests, debug }, null, 2));
  throw error;
} finally { await browser?.close(); await server.close(); }
