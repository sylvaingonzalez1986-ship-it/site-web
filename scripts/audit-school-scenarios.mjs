/** Real school UI against an in-memory transport. Author answers stay in this Node process. */
import assert from 'node:assert/strict';
import {createChallengeFixture} from './school-challenge-fixture.mjs';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {transformWithOxc} from 'vite';
const visualAudit=process.argv.includes('--school-visual');

const authorUrls=new Map();
async function authorUrl(file){
 if(authorUrls.has(file))return authorUrls.get(file);
 const pending=(async()=>{
  const source=(await readFile(file,'utf8')).replace(/import ["']server-only["'];?/g,'');
  if(extname(file)==='.json')return `data:text/javascript;base64,${Buffer.from(`export default ${JSON.stringify(JSON.parse(source))};`).toString('base64')}`;
  let {code}=await transformWithOxc(source,file,{lang:'ts'});
  const imports=[...code.matchAll(/from\s*["'](\.\.?\/[^"']+)["']/g)];
  for(const match of imports){const target=resolve(dirname(file),match[1]+(extname(match[1])?'':'.ts'));const url=await authorUrl(target);code=code.replaceAll(`"${match[1]}"`,JSON.stringify(url)).replaceAll(`'${match[1]}'`,JSON.stringify(url));}
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
 })();authorUrls.set(file,pending);return pending;
}
export async function authorModule(name){return import(await authorUrl(resolve('src/lib',name)));}
export async function loadHempQuizFixtureBank(){return (await authorModule('kanab-quest-hemp-quiz-bank.ts')).HEMP_QUIZ_BANK;}
export async function createSchoolFixture(ownerId='00000000-0000-4000-8000-000000000001'){
 const content=await authorModule('kanab-quest-school-content.ts');
 const history=await authorModule('kanab-quest-school-history.ts');
 const botany=await authorModule('kanab-quest-school-botany.ts');
 const terpenes=await authorModule('kanab-quest-school-terpenes.ts');
 const cannabinoids=await authorModule('kanab-quest-school-cannabinoids.ts');
 const cultivation=await authorModule('kanab-quest-school-cultivation.ts');
 const health=await authorModule('kanab-quest-school-health.ts');
 const soil=await authorModule('kanab-quest-school-soil.ts');
 const products=await authorModule('kanab-quest-school-products.ts');
 const harvest=await authorModule('kanab-quest-school-harvest.ts');
 const {parseKqSchoolHistoryProgress}=await authorModule('kanab-quest-school-history-progress.ts');
 const {parseKqSchoolBotanyProgress}=await authorModule('kanab-quest-school-botany-progress.ts');
 const {parseKqSchoolTerpenesProgress}=await authorModule('kanab-quest-school-terpenes-progress.ts');
 const {parseKqSchoolCannabinoidsProgress}=await authorModule('kanab-quest-school-cannabinoids-progress.ts');
 const {parseKqSchoolCultivationProgress}=await authorModule('kanab-quest-school-cultivation-progress.ts');
 const {parseKqSchoolHealthProgress}=await authorModule('kanab-quest-school-health-progress.ts');
 const {parseKqSchoolSoilProgress}=await authorModule('kanab-quest-school-soil-progress.ts');
 const {parseKqSchoolProductsProgress}=await authorModule('kanab-quest-school-products-progress.ts');
 const {parseKqSchoolHarvestProgress}=await authorModule('kanab-quest-school-harvest-progress.ts');
 const {parseKqSchoolSubmission}=await authorModule('kanab-quest-school.ts');
 const {parseKqSchoolCheck}=await authorModule('kanab-quest-school-feedback.ts');
 const {parseKqSchoolChallengeCommand,getKqSchoolChallengePoints}=await authorModule('kanab-quest-school-challenge.ts');
 const {createKqSchoolChallengePlan}=await authorModule('kanab-quest-school-challenge-server.ts');
 const challenge=createChallengeFixture({createPlan:createKqSchoolChallengePlan,parseCommand:parseKqSchoolChallengeCommand,points:getKqSchoolChallengePoints});
 const {KQ_SCHOOL_ANSWERS:legacyAnswers,KQ_SCHOOL_HISTORY_ANSWERS:historyAnswers,KQ_SCHOOL_BOTANY_ANSWERS:botanyAnswers,KQ_SCHOOL_TERPENE_ANSWERS:terpeneAnswers,KQ_SCHOOL_CANNABINOID_ANSWERS:cannabinoidAnswers,KQ_SCHOOL_CULTIVATION_ANSWERS:cultivationAnswers,KQ_SCHOOL_HEALTH_ANSWERS:healthAnswers,KQ_SCHOOL_SOIL_ANSWERS:soilAnswers,KQ_SCHOOL_PRODUCTS_ANSWERS:productsAnswers,KQ_SCHOOL_HARVEST_ANSWERS:harvestAnswers}=await authorModule('kanab-quest-school-answers.ts');
 const {HEMP_QUIZ_BANK}=await authorModule('kanab-quest-hemp-quiz-bank.ts');
 const hempAnswers=Object.fromEntries(HEMP_QUIZ_BANK.map(item=>[item.id,{correctOptionId:String.fromCharCode(97+item.answer),explanation:item.explanation}]));
 const answers={...legacyAnswers,...historyAnswers,...botanyAnswers,...terpeneAnswers,...cannabinoidAnswers,...cultivationAnswers,...healthAnswers,...soilAnswers,...productsAnswers,...harvestAnswers,...hempAnswers};
 let harvestSnapshot,harvestSubmissions,harvestSequence=0,lostHarvest=false;
 let productsSnapshot,productsSubmissions,productsSequence=0,lostProducts=false;
 let soilSnapshot,soilSubmissions,soilSequence=0,lostSoil=false;
 let healthSnapshot,healthSubmissions,healthSequence=0,lostHealth=false;
 let cultivationSnapshot,cultivationSubmissions,cultivationSequence=0,lostCultivation=false;
 let cannabinoidsSnapshot,cannabinoidsSubmissions,cannabinoidsSequence=0,lostCannabinoids=false;
 let checks=new Map(),checkSubmissions=[],lostCheck=false;
 let snapshot,receipts,receiptCommands,submissions,credits,historySnapshot,botanySnapshot,botanySubmissions,terpenesSnapshot,terpenesSubmissions,selections,historySequence=0,botanySequence=0,terpenesSequence=0,lost=false,lostBotany=false,lostTerpenes=false,snapshotGate=null,releaseSnapshot=null;
 const reset=()=>{challenge.reset();snapshot={version:1,ownerId,cashCents:10000,lessonIds:[],workshopIds:[],totalBudgetCents:10000,totalPaidCents:0,quizzes:content.KQ_SCHOOL_MODULES.map(module=>({quizId:module.id,rewardId:`school:${module.id}`,budgetCents:1000,bestScore:null,paidCents:0,remainingCents:1000,attempts:0,lastAttemptAt:null}))};receipts=new Map();checks=new Map();checkSubmissions=[];lostCheck=false;submissions=[];credits=0;lost=false;};
 reset();
 const learningSnapshot=version=>({version:1,ownerId:snapshot.ownerId,contentVersion:version,lessonIds:[],checkpointIds:[],activityIds:[],resumeLessonId:null,revision:0,updatedAt:null,resumeConflict:false});
 const resetLearning=()=>{historySnapshot=learningSnapshot(history.VERSION);botanySnapshot=learningSnapshot(botany.VERSION);terpenesSnapshot=learningSnapshot(terpenes.VERSION);cannabinoidsSnapshot=learningSnapshot(cannabinoids.CANNABINOID_VERSION);cultivationSnapshot=learningSnapshot(cultivation.VERSION);healthSnapshot=learningSnapshot(health.VERSION);soilSnapshot=learningSnapshot(soil.VERSION);productsSnapshot=learningSnapshot(products.VERSION);harvestSnapshot=learningSnapshot(harvest.VERSION);harvestSequence=0;harvestSubmissions=[];lostHarvest=false;productsSequence=0;productsSubmissions=[];lostProducts=false;soilSequence=0;soilSubmissions=[];lostSoil=false;healthSequence=0;healthSubmissions=[];lostHealth=false;cultivationSequence=0;cultivationSubmissions=[];lostCultivation=false;cannabinoidsSequence=0;cannabinoidsSubmissions=[];lostCannabinoids=false;selections=new Map();receiptCommands=new Map();historySequence=0;botanySequence=0;terpenesSequence=0;botanySubmissions=[];terpenesSubmissions=[];lostBotany=false;lostTerpenes=false;};resetLearning();
 const handle=async(request,url)=>{
  const json=body=>request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
  const fail=(status,error,code)=>request.respond({status,contentType:'application/json',body:JSON.stringify({error,...(code?{code}:{})})});
  const ownerHeader=request.headers?.()['x-kq-school-owner'];
  if(request.method()==='POST'&&ownerHeader&&ownerHeader!==snapshot.ownerId)return fail(409,'Le compte a changé.','school_owner_changed');
  if(url.pathname.endsWith('/challenge')){const outcome=challenge.request(request.method(),request.method()==='GET'?null:JSON.parse(request.postData()),snapshot.ownerId);if(outcome.aborted)return request.abort('failed');return request.respond({status:outcome.status,contentType:'application/json',body:JSON.stringify(outcome.body)});}
  if(url.pathname.endsWith('/history')||url.pathname.endsWith('/botany')||url.pathname.endsWith('/terpenes')||url.pathname.endsWith('/cannabinoids')||url.pathname.endsWith('/cultivation')||url.pathname.endsWith('/health')||url.pathname.endsWith('/soil')||url.pathname.endsWith('/products')||url.pathname.endsWith('/harvest')){
   const isBotany=url.pathname.endsWith('/botany'),isTerpenes=url.pathname.endsWith('/terpenes'),isCannabinoids=url.pathname.endsWith('/cannabinoids'),isCultivation=url.pathname.endsWith('/cultivation'),isHealth=url.pathname.endsWith('/health'),isSoil=url.pathname.endsWith('/soil'),isProducts=url.pathname.endsWith('/products'),isHarvest=url.pathname.endsWith('/harvest'),state=isBotany?botanySnapshot:isTerpenes?terpenesSnapshot:isCannabinoids?cannabinoidsSnapshot:isCultivation?cultivationSnapshot:isHealth?healthSnapshot:isSoil?soilSnapshot:isProducts?productsSnapshot:isHarvest?harvestSnapshot:historySnapshot;
   if(request.method()==='GET')return json({...state,resumeConflict:false});
   const command=(isBotany?parseKqSchoolBotanyProgress:isTerpenes?parseKqSchoolTerpenesProgress:isCannabinoids?parseKqSchoolCannabinoidsProgress:isCultivation?parseKqSchoolCultivationProgress:isHealth?parseKqSchoolHealthProgress:isSoil?parseKqSchoolSoilProgress:isProducts?parseKqSchoolProductsProgress:isHarvest?parseKqSchoolHarvestProgress:parseKqSchoolHistoryProgress)(JSON.parse(request.postData()));
   if(!command)return fail(400,'Progression invalide.');
   if(isBotany)botanySubmissions.push(structuredClone(command));
   if(isTerpenes)terpenesSubmissions.push(structuredClone(command));
   if(isCannabinoids)cannabinoidsSubmissions.push(structuredClone(command));
   if(isCultivation)cultivationSubmissions.push(structuredClone(command));
   if(isHealth)healthSubmissions.push(structuredClone(command));
   if(isSoil)soilSubmissions.push(structuredClone(command));
   if(isProducts)productsSubmissions.push(structuredClone(command));
   if(isHarvest)harvestSubmissions.push(structuredClone(command));
   const before=JSON.stringify({...state,resumeConflict:false});
   for(const key of ['lessonIds','checkpointIds','activityIds'])state[key]=[...new Set([...state[key],...command[key]])].sort();
   const changedPosition=Object.hasOwn(command,'resumeLessonId')&&command.resumeLessonId!==state.resumeLessonId;
   const conflict=Boolean(changedPosition&&command.expectedRevision!==state.revision);
   if(changedPosition&&!conflict)state.resumeLessonId=command.resumeLessonId;
   state.resumeConflict=false;
   if(JSON.stringify(state)!==before){state.revision++;state.updatedAt=new Date().toISOString();}
   if(isBotany&&lostBotany){lostBotany=false;return request.abort('failed');}
   if(isTerpenes&&lostTerpenes){lostTerpenes=false;return request.abort('failed');}
   if(isCannabinoids&&lostCannabinoids){lostCannabinoids=false;return request.abort('failed');}
   if(isCultivation&&lostCultivation){lostCultivation=false;return request.abort('failed');}
   if(isHealth&&lostHealth){lostHealth=false;return request.abort('failed');}
   if(isSoil&&lostSoil){lostSoil=false;return request.abort('failed');}
   if(isProducts&&lostProducts){lostProducts=false;return request.abort('failed');}
   if(isHarvest&&lostHarvest){lostHarvest=false;return request.abort('failed');}
   return json({...state,resumeConflict:conflict});
  }
  if(request.method()==='GET'){
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='history'){
    const sequence=historySequence++,selectionId=`h1.${randomUUID()}.${'a'.repeat(64)}`;
    const chosen=history.HISTORY_CHAPTERS.filter((_,index)=>index!==sequence%11).map(chapter=>{const questions=history.HISTORY_QUESTIONS.filter(question=>question.chapterId===chapter.id);return questions[Math.floor(sequence/11)%questions.length];});
    selections.set(selectionId,{quizId:'history',ownerId:snapshot.ownerId,version:history.VERSION,questions:chosen});return json({quizId:'history',contentVersion:history.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='plant'){
    const sequence=botanySequence++,selectionId=`b1.${randomUUID()}.${'b'.repeat(64)}`;
    const chapterQuestions=botany.BOTANY_CHAPTERS.map(chapter=>botany.BOTANY_QUESTIONS.filter(question=>question.chapterId===chapter.id));
    const offset=Math.floor(sequence/8)%4,chosen=chapterQuestions.map(questions=>questions[offset]);
    for(const index of [sequence%8,(sequence+1)%8])chosen.push(chapterQuestions[index][(offset+1)%4]);
    selections.set(selectionId,{quizId:'plant',ownerId:snapshot.ownerId,version:botany.VERSION,questions:chosen});
    return json({quizId:'plant',contentVersion:botany.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='genetics'){
    const sequence=cultivationSequence++,selectionId=`u1.${randomUUID()}.${'b'.repeat(64)}`;
    const chapterQuestions=cultivation.CULTIVATION_CHAPTERS.map(chapter=>cultivation.CULTIVATION_QUESTIONS.filter(question=>question.chapterId===chapter.id));
    const offset=Math.floor(sequence/8)%4,chosen=chapterQuestions.map(questions=>questions[offset]);
    for(const index of [sequence%8,(sequence+1)%8])chosen.push(chapterQuestions[index][(offset+1)%4]);
    selections.set(selectionId,{quizId:'genetics',ownerId:snapshot.ownerId,version:cultivation.VERSION,questions:chosen});
    return json({quizId:'genetics',contentVersion:cultivation.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='biodiversity'){
    const sequence=healthSequence++,selectionId=`p1.${randomUUID()}.${'b'.repeat(64)}`;
    const chapterQuestions=health.HEALTH_CHAPTERS.map(chapter=>health.HEALTH_QUESTIONS.filter(question=>question.chapterId===chapter.id));
    const offset=Math.floor(sequence/8)%4,chosen=chapterQuestions.map(questions=>questions[offset]);
    for(const index of [sequence%8,(sequence+1)%8])chosen.push(chapterQuestions[index][(offset+1)%4]);
    selections.set(selectionId,{quizId:'biodiversity',ownerId:snapshot.ownerId,version:health.VERSION,questions:chosen});
    return json({quizId:'biodiversity',contentVersion:health.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='molecules'){
    const sequence=terpenesSequence++,selectionId=`t1.${randomUUID()}.${'c'.repeat(64)}`;
    const chosen=terpenes.TERPENE_CHAPTERS.map((chapter,index)=>terpenes.TERPENE_QUESTIONS.filter(question=>question.chapterId===chapter.id)[(sequence+index)%4]);
    selections.set(selectionId,{quizId:'molecules',ownerId:snapshot.ownerId,version:terpenes.VERSION,questions:chosen});
    return json({quizId:'molecules',contentVersion:terpenes.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='uses'){
    const sequence=soilSequence++,selectionId=`s1.${randomUUID()}.${'c'.repeat(64)}`;
    const chosen=soil.SOIL_CHAPTERS.map((chapter,index)=>soil.SOIL_QUESTIONS.filter(question=>question.chapterId===chapter.id)[(sequence+index)%4]);
    selections.set(selectionId,{quizId:'uses',ownerId:snapshot.ownerId,version:soil.VERSION,questions:chosen});
    return json({quizId:'uses',contentVersion:soil.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='profiles'){
    const sequence=productsSequence++,selectionId=`v1.${randomUUID()}.${'c'.repeat(64)}`;
    const chosen=products.PRODUCTS_CHAPTERS.map((chapter,index)=>products.PRODUCTS_QUESTIONS.filter(question=>question.chapterId===chapter.id)[(sequence+index)%4]);
    selections.set(selectionId,{quizId:'profiles',ownerId:snapshot.ownerId,version:products.VERSION,questions:chosen});
    return json({quizId:'profiles',contentVersion:products.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='prevention'){
    const sequence=harvestSequence++,selectionId=`r1.${randomUUID()}.${'c'.repeat(64)}`;
    const chosen=harvest.HARVEST_CHAPTERS.map((chapter,index)=>harvest.HARVEST_QUESTIONS.filter(question=>question.chapterId===chapter.id)[(sequence+index)%4]);
    const extraChapter=harvest.HARVEST_CHAPTERS[sequence%9].id;
    chosen.push(harvest.HARVEST_QUESTIONS.find(question=>question.chapterId===extraChapter&&!chosen.some(selected=>selected.id===question.id)));
    selections.set(selectionId,{quizId:'prevention',ownerId:snapshot.ownerId,version:harvest.VERSION,questions:chosen});
    return json({quizId:'prevention',contentVersion:harvest.VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')&&url.searchParams.get('quizId')==='evidence'){
    const sequence=cannabinoidsSequence++,selectionId=`c1.${randomUUID()}.${'d'.repeat(64)}`;
    const chosen=cannabinoids.CANNABINOID_CHAPTERS.map((chapter,index)=>cannabinoids.CANNABINOID_QUESTIONS.filter(question=>question.chapterId===chapter.id)[(sequence+index)%4]);
    selections.set(selectionId,{quizId:'evidence',ownerId:snapshot.ownerId,version:cannabinoids.CANNABINOID_VERSION,questions:chosen});
    return json({quizId:'evidence',contentVersion:cannabinoids.CANNABINOID_VERSION,selectionId,questions:chosen.map(question=>({...question,options:[...question.options].reverse()}))});
   }
   if(url.pathname.endsWith('/quiz')){const lesson=content.KQ_SCHOOL_MODULES.find(item=>item.id===url.searchParams.get('quizId'));const selectionId=`l1.${randomUUID()}.${'e'.repeat(64)}`;selections.set(selectionId,{quizId:lesson.id,ownerId:snapshot.ownerId,version:lesson.version,questions:lesson.questions});return json({quizId:lesson.id,contentVersion:lesson.version,selectionId,questions:lesson.questions.map(question=>({...question,options:[...question.options].reverse()}))});}
   if(snapshotGate){await snapshotGate;snapshotGate=null;}
   return json(snapshot);
  }
  const body=JSON.parse(request.postData());
  if(url.pathname.endsWith('/progress')){snapshot.lessonIds=[...new Set([...snapshot.lessonIds,...body.lessonIds])];snapshot.workshopIds=[...new Set([...snapshot.workshopIds,...body.workshopIds])];return json(snapshot);}
  if(url.pathname.endsWith('/quiz/check')){
   const check=parseKqSchoolCheck(body);if(!check)return fail(400,'Invalid check');
   const selection=selections.get(check.selectionId);if(!selection||selection.ownerId!==snapshot.ownerId||selection.quizId!==check.quizId||selection.version!==check.contentVersion)return fail(409,'Quiz actualise','CONTENT_VERSION_CHANGED');
   const question=selection.questions.find(q=>q.id===check.questionId);if(!question||!question.options.some(o=>o.id===check.optionId))return fail(400,'Invalid question');
   checkSubmissions.push(structuredClone(check));
   if([...checks.values()].some(entry=>entry.selectionId===check.selectionId&&entry.requestKey!==check.requestKey))return fail(409,"Attempt mismatch","school_request_mismatch");
   let entry=checks.get(check.requestKey);if(entry&&(entry.selectionId!==check.selectionId||entry.quizId!==check.quizId||entry.contentVersion!==check.contentVersion))return fail(409,'Attempt mismatch','school_request_mismatch');
   if(!entry){entry={...check,corrections:new Map()};checks.set(check.requestKey,entry);}
   const previous=entry.corrections.get(check.questionId);if(previous&&previous.optionId!==check.optionId)return fail(409,'Answer locked','school_feedback_locked');
   const answer=answers[question.id],correction=previous??{questionId:question.id,optionId:check.optionId,correctOptionId:answer.correctOptionId,isCorrect:check.optionId===answer.correctOptionId,explanation:answer.explanation,optionExplanations:answer.optionExplanations,lessonId:question.lessonId,sectionId:question.sectionId,sources:question.sources,buddyCodes:question.buddyCodes};entry.corrections.set(question.id,correction);
   if(lostCheck){lostCheck=false;return request.abort('failed');}
   return json({ownerId:snapshot.ownerId,requestKey:check.requestKey,correction,replayed:Boolean(previous)});
  }
  const parsed=parseKqSchoolSubmission(body);
  if(!parsed)return fail(400,'Tentative invalide.');
  submissions.push(body);
  const financialCommand=JSON.stringify({requestKey:parsed.requestKey,quizId:parsed.quizId,contentVersion:parsed.contentVersion,answers:parsed.answers});
  if(receipts.has(body.requestKey))return receiptCommands.get(body.requestKey)!==financialCommand?fail(409,'Cette tentative possède déjà un reçu différent.','school_request_mismatch'):json({...receipts.get(body.requestKey),snapshot:structuredClone(snapshot),replayed:true});
  if([...checks.values()].some(entry=>entry.selectionId===body.selectionId&&entry.requestKey!==body.requestKey))return fail(409,"Attempt mismatch","school_feedback_mismatch");
  const checked=checks.get(body.requestKey);if(checked){if(checked.quizId!==body.quizId||checked.contentVersion!==body.contentVersion||checked.selectionId!==body.selectionId)return fail(409,'Attempt mismatch','school_feedback_mismatch');if(checked.corrections.size!==10)return fail(409,'Validate every answer','school_feedback_incomplete');if(body.answers.some(answer=>checked.corrections.get(answer.questionId)?.optionId!==answer.optionId))return fail(409,'Answer locked','school_feedback_locked');}
  const lesson=content.KQ_SCHOOL_MODULES.find(item=>item.id===body.quizId),progress=snapshot.quizzes.find(item=>item.quizId===body.quizId);
  const selection=selections.get(body.selectionId);
  const questions=['history','plant','molecules','evidence','genetics','biodiversity','uses','profiles','prevention','law'].includes(body.quizId)?selection?.quizId===body.quizId&&selection.ownerId===snapshot.ownerId&&selection.version===body.contentVersion?selection.questions:null:lesson.questions;
  if(!questions)return request.respond({status:409,contentType:'application/json',body:JSON.stringify({error:'Recommence ce quiz de démonstration après le redémarrage du serveur.',code:'CONTENT_VERSION_CHANGED'})});
  if(questions.some(question=>!body.answers.some(answer=>answer.questionId===question.id&&question.options.some(option=>option.id===answer.optionId))))return fail(400,'Question ou option invalide.');
  const corrections=questions.map(question=>{const optionId=body.answers.find(item=>item.questionId===question.id).optionId,answer=answers[question.id];return {questionId:question.id,optionId,correctOptionId:answer.correctOptionId,isCorrect:optionId===answer.correctOptionId,explanation:answer.explanation,optionExplanations:answer.optionExplanations,lessonId:question.lessonId,sectionId:question.sectionId,sources:question.sources,buddyCodes:question.buddyCodes};});
  const score=corrections.filter(item=>item.isCorrect).length,target=score<7?0:Math.floor(progress.budgetCents*score/10),gainCents=Math.max(0,target-progress.paidCents);
  if(gainCents)credits++;
  Object.assign(progress,{bestScore:Math.max(progress.bestScore||0,score),paidCents:progress.paidCents+gainCents,remainingCents:progress.budgetCents-progress.paidCents-gainCents,attempts:progress.attempts+1,lastAttemptAt:'2026-11-11T12:00:00.000Z'});
  snapshot.cashCents+=gainCents;snapshot.totalPaidCents+=gainCents;
  const completion={snapshot:structuredClone(snapshot),replayed:false,result:{requestKey:body.requestKey,quizId:body.quizId,contentVersion:body.contentVersion,score,bestScore:progress.bestScore,passed:score>=7,gainCents,paidCents:progress.paidCents,remainingCents:progress.remainingCents,cashCents:snapshot.cashCents,corrections}};
  if(!checks.has(body.requestKey))checks.set(body.requestKey,{...body,corrections:new Map(corrections.map(item=>[item.questionId,item]))});
  receipts.set(body.requestKey,completion);
  receiptCommands.set(body.requestKey,financialCommand);
  await new Promise(resolve=>setTimeout(resolve,100));
  if(lost){lost=false;return request.abort('failed');}
  return json(completion);
 };
 return {content,answers,history,botany,terpenes,cannabinoids,cultivation,health,soil,products,harvest,reset(){reset();resetLearning();},handle,get snapshot(){return snapshot;},get historySnapshot(){return historySnapshot;},get botanySnapshot(){return botanySnapshot;},get botanySubmissions(){return botanySubmissions;},get terpenesSnapshot(){return terpenesSnapshot;},get terpenesSubmissions(){return terpenesSubmissions;},get cannabinoidsSnapshot(){return cannabinoidsSnapshot;},get cannabinoidsSubmissions(){return cannabinoidsSubmissions;},get cultivationSnapshot(){return cultivationSnapshot;},get cultivationSubmissions(){return cultivationSubmissions;},get healthSnapshot(){return healthSnapshot;},get healthSubmissions(){return healthSubmissions;},get soilSnapshot(){return soilSnapshot;},get soilSubmissions(){return soilSubmissions;},get harvestSnapshot(){return harvestSnapshot;},get harvestSubmissions(){return harvestSubmissions;},get productsSnapshot(){return productsSnapshot;},get productsSubmissions(){return productsSubmissions;},get submissions(){return submissions;},get challengeSnapshot(){return challenge.snapshot(snapshot.ownerId);},get challengeSubmissions(){return challenge.submissions;},loseNextChallenge(action){challenge.loseNext(action);},advanceChallenge(milliseconds){challenge.advance(milliseconds);},get checkSubmissions(){return checkSubmissions;},loseNextCheck(){lostCheck=true;},get credits(){return credits;},loseNext(){lost=true;},loseNextBotany(){lostBotany=true;},loseNextTerpenes(){lostTerpenes=true;},loseNextCannabinoids(){lostCannabinoids=true;},loseNextCultivation(){lostCultivation=true;},loseNextHealth(){lostHealth=true;},loseNextSoil(){lostSoil=true;},loseNextProducts(){lostProducts=true;},loseNextHarvest(){lostHarvest=true;},holdSnapshot(){snapshotGate=new Promise(resolve=>{releaseSnapshot=resolve;});},releaseSnapshot(){releaseSnapshot?.();}};
}

export async function auditSchool({page,visit,view,click,screenshot,assertNoOverflow,results,fixture,setWidth}){
 const waitText=text=>page.waitForFunction(text=>document.querySelector('[data-school]')?.textContent.includes(text),{},text);
 const clickText=async text=>{const handle=await page.waitForFunction(text=>[...document.querySelectorAll('[data-school] button')].find(element=>element.checkVisibility()&&element.textContent.trim().startsWith(text)),{},text);await handle.asElement().evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await handle.asElement().click();await handle.dispose();};
 const fill=async(selector,text)=>{await page.focus(selector);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.sendCharacter(text);};
 const schoolTab=async label=>{const buttons=await page.$$('nav[aria-label="L’école"] button');let clicked=false;for(const button of buttons)if((await button.evaluate(el=>el.textContent)).trim()===label){await button.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await button.click();clicked=true;break;}assert(clicked,`School tab ${label} is available`);};
 const capture=async name=>{const outputName=visualAudit?name.replace(/^school-/,'school-visual-'):name;await page.waitForFunction(()=>!document.querySelector('[role=status]')?.textContent.includes('Ouverture de'));await page.evaluate(()=>window.scrollTo(0,0));await screenshot(outputName);await page.screenshot({path:resolve('output/placard-navigation',`${outputName}-viewport.png`)});};
 async function checkInterior(width){
  await page.waitForSelector('[data-school-interior]');await page.waitForFunction(()=>[...document.querySelectorAll('[data-school-interior] img')].every(img=>img.complete&&img.naturalWidth>0));
  await page.waitForSelector('[data-school-sprite-layer][data-ready=true]');assert.equal(await page.$$eval('[data-school-sprite]',els=>els.length),2,'Two real illustration sprites are loaded');
  const sizes=await page.$$eval('[data-school-destination]',els=>els.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}));assert(sizes.every(size=>size.width>=44&&size.height>=44),'All scene destinations have usable touch targets');
  await page.$eval('[data-school-interior]',el=>el.scrollIntoView({block:'center'}));await page.waitForSelector('[data-school-interior][data-motion-state=reduced]');
  const transforms=()=>page.$$eval('[data-school-sprite]',els=>els.map(el=>getComputedStyle(el).transform));
  const still=await transforms();await new Promise(resolve=>setTimeout(resolve,180));assert.deepEqual(await transforms(),still,'Reduced motion starts with stationary art');
  await click('button[aria-label="Animer l’école"]');await page.waitForSelector('[data-school-interior][data-motion-state=running]');const moving=await transforms();await new Promise(resolve=>setTimeout(resolve,230));assert.notDeepEqual(await transforms(),moving,'Actual lamp/book illustration transforms advance');
  await page.screenshot({path:resolve('output/placard-navigation',`school-visual-motion-${width}-a.png`)});await new Promise(resolve=>setTimeout(resolve,230));await page.screenshot({path:resolve('output/placard-navigation',`school-visual-motion-${width}-b.png`)});
  await click('button[aria-label="Mettre les animations de l’école en pause"]');await page.waitForSelector('[data-school-interior][data-motion-state=paused]');const paused=await transforms();await new Promise(resolve=>setTimeout(resolve,180));assert.deepEqual(await transforms(),paused,'Pause stops the real artwork');
  await click('button[aria-label="Animer l’école"]');await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.waitForSelector('[data-school-interior][data-motion-state=offscreen]');
  await page.$eval('[data-school-interior]',el=>el.scrollIntoView({block:'center'}));await page.waitForSelector('[data-school-interior][data-motion-state=running]');
  const other=await page.browser().newPage();try{await other.goto('about:blank');await other.bringToFront();await page.waitForSelector('[data-school-interior][data-motion-state=hidden]');}finally{await other.close();await page.bringToFront();}await page.waitForSelector('[data-school-interior][data-motion-state=running]');
  await click('button[aria-label="Mettre les animations de l’école en pause"]');await page.focus('[data-school-destination=learn]');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-school-destination')),'quiz','Keyboard can reach each destination');
  results.push({scenario:'illustrated-interior-motion',width,sprites:2,reduced:true,pause:true,offscreen:true,hiddenTab:true});
 }
 async function solve(quizId,score){
  const lesson=fixture.content.KQ_SCHOOL_MODULES.find(item=>item.id===quizId);
  for(let index=0;index<10;index++){
   const question=lesson.questions[index],correct=fixture.answers[question.id].correctOptionId;
   await page.waitForSelector(`input[name="${question.id}"]`);
   assert.equal(await page.$$eval(`input[name="${question.id}"]`,els=>els.length),4);
   const option=index<score?correct:question.options.find(item=>item.id!==correct).id;
   await click(`input[name="${question.id}"][value="${option}"]`);
   if(index===3){await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(`input[name="${question.id}"]:checked`);}
   if(index<9)await clickText('Suivante');
  }
 }
 for(const width of (process.env.SCHOOL_AUDIT_WIDTHS||'320,390,1440').split(',').map(Number)){
  setWidth(width);fixture.reset();await page.setViewport({width,height:width<700?844:1050,isMobile:width<700,hasTouch:width<700,deviceScaleFactor:1});
  await visit('cards','view=school');await view('school');await page.evaluate(()=>sessionStorage.clear());await page.reload({waitUntil:'networkidle0'});await waitText('0 / 10');
  assert.equal(await page.$$eval(visualAudit?'[data-school-course]':'[data-school] article',els=>els.length),10,'Ten available courses');await assertNoOverflow('School home');await capture(`school-home-${width}`);
  if(visualAudit&&process.env.SCHOOL_VISUAL_LAYOUT_ONLY==='1'){
   await click('[data-school-destination=learn]');await click('[data-school-course=plant] button');await page.waitForSelector('[data-school-lesson=plant]');await click('button[aria-label="Séquence suivante"]');await click('button[aria-label="Séquence suivante"]');
   const tabs=await page.$$eval('nav[aria-label="L’école"] button',els=>els.map(el=>({top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height})));
   assert.equal(tabs.length,3);assert(tabs.every(tab=>Math.abs(tab.top-tabs[0].top)<2&&tab.height>=44),'Three tabs stay on one accessible row');
   const summary=await page.$eval('[data-school-lesson] details summary',element=>{const text=[...element.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.includes('En savoir plus'));const range=document.createRange();range.selectNodeContents(text);const words=range.getBoundingClientRect(),icon=element.querySelector('svg').getBoundingClientRect();return {height:element.getBoundingClientRect().height,textCenter:words.top+words.height/2,iconCenter:icon.top+icon.height/2};});assert(summary.height<=56&&Math.abs(summary.textCenter-summary.iconCenter)<4,'Read-more icon and label share one line');
   await assertNoOverflow('Final lesson layout');await capture(`school-course-${width}`);
   await click('button[aria-label="Séquence suivante"]');await clickText('Passer au quiz');await page.waitForSelector('input[name="plant-q01"]');await assertNoOverflow('Final quiz layout');await capture(`school-quiz-${width}`);results.push({scenario:'final-visual-layout',width,threeTabs:true});continue;
  }
  if(visualAudit){await checkInterior(width);await click('[data-school-destination=learn]');await click('[data-school-course=plant] button');}else await clickText('Commencer');
  await page.waitForSelector('#school-plant-plant-identity, [id^="school-plant-"]');
  if(visualAudit){
   await page.waitForFunction(()=>{const img=document.querySelector('[data-school-lesson=plant] figure img');return img?.complete&&img.naturalWidth>0;});
   assert.equal(await page.$$eval('[data-school-lesson=plant] > section',els=>els.length),1,'Only one short illustrated sequence is shown');
   await click('[data-school-lesson] summary');assert((await page.$eval('[data-school-lesson] details[open]',el=>el.textContent)).length>200,'The complete source text remains expandable');await click('[data-school-lesson] details[open] summary');
   await click('button[aria-label="Séquence suivante"]');await click('button[aria-label="Séquence suivante"]');await page.waitForSelector('#school-plant-plant-3');await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#school-plant-plant-3');
  }else assert((await page.$eval('[data-school] article',el=>el.textContent)).length>1500,'Real authored course text is visible');
  await clickText('Lire sa fiche ·');await page.waitForSelector('[data-buddie-collection-detail][open]');await page.keyboard.press('Escape');await view('school');
  assert.equal(new URL(page.url()).searchParams.get('module'),'plant');if(visualAudit){assert.equal(new URL(page.url()).searchParams.get('passage'),'plant-3');await page.waitForSelector('#school-plant-plant-3');}await assertNoOverflow('Course');await capture(`school-course-${width}`);
  if(visualAudit)await click('button[aria-label="Séquence suivante"]');await clickText(visualAudit?'J’ai parcouru le cours':'J’ai parcouru ce cours');await waitText('Lecture enregistrée');assert.deepEqual(fixture.snapshot.lessonIds,['plant']);
  await clickText('Passer au quiz');
  if(width===320){
   await page.waitForSelector('input[name="plant-q01"]');await click('input[name="plant-q01"][value="a"]');await schoolTab('Quiz');
   await click(visualAudit?'[data-school-course=molecules] button:last-child':'[data-school] article:nth-child(2) button:last-child');await page.waitForSelector('input[name="molecules-q01"]');await click('input[name="molecules-q01"][value="b"]');await schoolTab('Quiz');
   await click(visualAudit?'[data-school-course=plant] button:last-child':'[data-school] article:first-child button:last-child');await page.waitForSelector('input[name="plant-q01"][value="a"]:checked');results.push({scenario:'independent-quiz-drafts',width,preserved:true});
  }
  await solve('plant',7);await assertNoOverflow('Quiz');await capture(`school-quiz-${width}`);
  if(width===320)fixture.loseNext();
  const before=fixture.submissions.length;await clickText('Valider mes réponses');
  await page.evaluate(()=>[...document.querySelectorAll('[data-school] button')].find(el=>el.textContent.includes('Validation…'))?.click());
  if(width===320){
   await waitText('Connexion interrompue');assert.equal(fixture.submissions.length,before+1);const first=structuredClone(fixture.submissions.at(-1));
   assert.equal(await page.$eval('[data-school] fieldset',el=>el.disabled),true);
   await page.reload({waitUntil:'networkidle0'});await waitText('Réessayer la validation');await clickText('Réessayer la validation');await page.waitForSelector('[aria-label="Résultat du quiz"]');
   assert.deepEqual(fixture.submissions.at(-1),first,'Reload retries the same durable request and answers');assert.equal(fixture.credits,1,'Lost response credits once');
  }else await page.waitForSelector('[aria-label="Résultat du quiz"]');
  assert((await page.$eval('[aria-label="Résultat du quiz"]',el=>el.textContent)).includes('7/10'));assert.equal(fixture.snapshot.totalPaidCents,700);await assertNoOverflow('Results');await capture(`school-result-${width}`);
  if(visualAudit){assert.equal(await page.$$eval('[data-school-correction][open]',els=>els.length),0,'Explanations are collapsed until requested');await click('[data-school-correction="plant-q10"] > summary');}
  await clickText('Lire sa fiche ·');await page.waitForSelector('[data-buddie-collection-detail][open]');await page.keyboard.press('Escape');await page.waitForSelector('[aria-label="Résultat du quiz"]');
  if(visualAudit)await page.waitForSelector('[data-school-correction="plant-q10"][open]');
  if(width===320){
   await clickText('Améliorer mon score');await solve('plant',9);await clickText('Valider mes réponses');await page.waitForSelector('[aria-label="Résultat du quiz"]');assert.equal(fixture.snapshot.totalPaidCents,900);assert.equal(await page.$$eval('[aria-label="Résultat du quiz"] dl > div',els=>parseFloat(els.find(el=>el.querySelector('dt')?.textContent==='Gain versé').querySelector('dd').textContent.replace(',','.'))),2);
  }
  await schoolTab('Ateliers');await waitText('Choisissez une définition');
  for(const data of fixture.content.KQ_SCHOOL_CROSSWORDS){
   await clickText(data.title);await page.waitForSelector(`input[id^="${data.id}-"]`);
   await clickText('Une lettre d’aide');await waitText('Indice :');
   const first=`input[id^="${data.id}-"][tabindex="0"]`;await page.focus(first);const initial=await page.evaluate(()=>document.activeElement.id);await page.keyboard.press(data.entries[0].direction==='down'?'ArrowDown':'ArrowRight');assert.notEqual(await page.evaluate(()=>document.activeElement.id),initial,'Keyboard moves between actual crossword cells');
   for(const entry of data.entries){await clickText(`${entry.number}. ${entry.direction==='across'?'→':'↓'}`);await fill('input[aria-label^="Mot "]',entry.displayAnswer);}
   await clickText('Vérifier la grille');await waitText('Grille terminée');assert(fixture.snapshot.workshopIds.includes(data.id));await assertNoOverflow('Crossword');await capture(`school-${data.id}-${width}`);
   await page.$eval('[role="group"][aria-label^="Grille"]',el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:resolve('output/placard-navigation',`school-${visualAudit?'visual-':''}${data.id}-${width}-grid.png`)});
  }
  await clickText('L’histoire en six repères');await clickText('Valider l’ordre');await waitText('repères à la bonne place');
  for(let index=0;index<fixture.content.KQ_SCHOOL_TIMELINE.length;index++){
   const item=fixture.content.KQ_SCHOOL_TIMELINE[index];
   for(let guard=0;guard<8;guard++){
    const position=await page.$$eval('[data-school] ol li strong',els=>els.map(el=>el.textContent));
    if(position.indexOf(item.title)===index)break;
    await click(`button[aria-label="Avancer ${item.title.replaceAll('"','\\"')}"]`);
   }
  }
  await clickText('Valider l’ordre');await waitText('Tous les repères sont dans l’ordre');assert(fixture.snapshot.workshopIds.includes('timeline-history'));await assertNoOverflow('Timeline');await capture(`school-timeline-${width}`);
  for(const data of fixture.content.KQ_SCHOOL_MATCHING_SETS){
   await clickText(data.title);await page.waitForSelector('[data-school] select');
   const selects=await page.$$('[data-school] select');assert.equal(selects.length,data.pairs.length);
   for(let index=0;index<data.pairs.length;index++)await selects[index].select(data.pairs[(index+1)%data.pairs.length].id);
   await clickText('Vérifier les associations');await waitText('À revoir :');
   for(let index=0;index<data.pairs.length;index++)await selects[index].select(data.pairs[index].id);
   await clickText('Vérifier les associations');await waitText('Atelier terminé');assert(fixture.snapshot.workshopIds.includes(data.id));await assertNoOverflow('Matching');
  }
  await capture(`school-matching-${width}`);assert.equal(fixture.snapshot.workshopIds.length,6);results.push({scenario:'real-school',width,quizScore:7,allSixWorkshops:true,publicBuddyReturn:true,requestRecovery:width===320});
  if(width===320){
   fixture.holdSnapshot();await page.goto(new URL('/arene/placard?scenario=cards&view=school&section=workshops',page.url()).href,{waitUntil:'domcontentloaded'});await waitText('Lecture de votre parcours');assert.equal(await page.$('input[id^="crossword-"]'),null,'Workshop cannot accept input before owner has loaded');fixture.releaseSnapshot();await page.waitForSelector('input[id^="crossword-"]');
   results.push({scenario:'workshop-owner-loading',width,protected:true});
   await visit('cards','view=school&section=quiz&module=plant');await page.waitForSelector('[aria-label="Résultat du quiz"]');
   const current=fixture.snapshot.quizzes.find(item=>item.quizId==='plant');Object.assign(current,{bestScore:10,paidCents:1000,remainingCents:0});fixture.snapshot.totalPaidCents=1000;fixture.snapshot.cashCents=11000;
   await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Résultat du quiz"]');assert.equal(await page.$$eval('[aria-label="Résultat du quiz"] dl > div',els=>els.find(el=>el.querySelector('dt')?.textContent==='Meilleur score').querySelector('dd').textContent),'10/10');await page.waitForFunction(()=>[...document.querySelectorAll('[aria-label="Résultat du quiz"] button')].some(el=>el.textContent.includes('S’entraîner')));
   assert((await page.$eval('[aria-label="Résultat du quiz"]',el=>el.textContent)).includes('9/10'),'Historical receipt keeps its actual attempt score');results.push({scenario:'historical-receipt-current-best',width,bestScore:10,receiptScore:9});
   if(visualAudit){
    const illustrations=[];
    for(const lesson of fixture.content.KQ_SCHOOL_COURSES){
     await visit('cards',`view=school&section=learn&module=${lesson.id}`);await page.waitForFunction(id=>{const image=document.querySelector(`[data-school-lesson="${id}"] figure img`);return image?.complete&&image.naturalWidth>0;},{},lesson.id);
     const art=await page.$eval(`[data-school-lesson="${lesson.id}"] figure img`,image=>({src:image.getAttribute('src'),alt:image.alt,fit:getComputedStyle(image).objectFit,width:image.naturalWidth,height:image.naturalHeight}));assert(art.alt.length>20);assert.equal(art.fit,'contain');illustrations.push(art);
     assert.equal(await page.$$eval('[data-school-lesson] nav[aria-label="Les séquences du cours"] [aria-current=step]',els=>els.length),1);await assertNoOverflow(`Illustrated course ${lesson.id}`);
     if(['uses','profiles','law'].includes(lesson.id))await capture(`school-course-${lesson.id}-${width}`);
    }
    assert.equal(new Set(illustrations.map(item=>item.src)).size,10,'Each course has its own real raster illustration');results.push({scenario:'ten-illustrated-courses',width,illustrations});
   }
  }
 }
}
