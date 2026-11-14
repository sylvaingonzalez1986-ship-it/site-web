import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {challengeTestPlan} from './school-challenge-test-data.mjs';
const db=new PGlite(),checks=[],owner=randomUUID(),other=randomUUID(),plan=challengeTestPlan();
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const call=(command=null,user=owner,bank=command?.action==='start'?plan:null)=>scalar('SELECT rpc_kq_school_challenge($1,$2,$3)',[user,command,bank]);
const check=(name,value,expected)=>{assert.deepEqual(value,expected,name);checks.push(name);};
const reject=async(name,command,pattern=/school_challenge_/,user=owner,bank)=>{await assert.rejects(()=>call(command,user,bank),pattern);checks.push(name);};
const command=(action,roundId,questionId,extra={})=>({action,requestKey:randomUUID(),roundId,questionId,...extra});
try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE wallet_sentinel(cents INTEGER); INSERT INTO wallet_sentinel VALUES(10700);');
 for(const id of [owner,other])await db.query('INSERT INTO auth.users VALUES($1)',[id]);
 await db.exec(await readFile('supabase/migrations/20261112001100_kq_school_challenge.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261113000100_kq_school_hemp_quiz.sql','utf8'));
 check('new owner has no round',(await call()).round,null);
 const start={action:'start',requestKey:randomUUID()},first=await call(start),id=first.round.id;
 check('start exposes exactly one current question',[first.round.questionNumber,first.round.totalQuestions,first.round.level,first.round.answers.length],[1,20,1,0]);
 check('unanswered response contains no private reference',JSON.stringify(first).includes('correctOptionId'),false);
 check('resume keeps the original question clock',(await call()).round.openedAt,first.round.openedAt);
 check('lost start retry reuses round and clock',[(await call(start)).round.id,(await call(start)).round.openedAt],[id,first.round.openedAt]);
 await reject('new start cannot silently replace an existing round',{action:'start',requestKey:randomUUID()},/round_changed/);
 await reject('cannot answer a future question',command('answer',id,'test-q02',{optionId:'a'}),/question_changed/);
 await reject('cannot advance before answering',command('next',id,'test-q01'),/answer_required/);
 await reject('client time and score fields are rejected',command('answer',id,'test-q01',{optionId:'a',elapsedMs:0,score:3000}),/invalid/);
 const wrong=command('answer',id,'test-q01',{optionId:'b'}),feedback=await call(wrong);
 check('wrong first answer gives zero points',[feedback.round.score,feedback.round.feedback.basePoints,feedback.round.feedback.bonusPoints,feedback.round.feedback.awardedPoints],[0,0,0,0]);
 check('feedback contains only the answered correction',[feedback.round.answers.length,feedback.round.feedback.question.id],[1,'test-q01']);
 check('lost answer retry preserves exact stored feedback',(await call(wrong)).round.feedback,feedback.round.feedback);
 check('duplicate same answer under another command changes no points',(await call(command('answer',id,'test-q01',{optionId:'b'}))).round.feedback,feedback.round.feedback);
 await reject('changing an already revealed answer is rejected',command('answer',id,'test-q01',{optionId:'a'}),/answer_locked/);
 await reject('request identity cannot change command',{...wrong,optionId:'a'},/request_mismatch/);
 const next=command('next',id,'test-q01'),second=await call(next);
 check('next opens only the second question',[second.round.question.id,second.round.feedback,second.round.answers.length],['test-q02',null,1]);
 check('duplicate next keeps clock and position',[(await call(next)).round.openedAt,(await call(command('next',id,'test-q01'))).round.questionNumber],[second.round.openedAt,2]);
 await db.query("UPDATE kq_school_challenge_rounds SET opened_at=clock_timestamp()-interval '10 seconds' WHERE user_id=$1 AND id=$2",[owner,id]);
 const timed=await call(command('answer',id,'test-q02',{optionId:'a'}));
 check('database time determines linear bonus',timed.round.feedback.bonusPoints,Math.floor(50*Math.max(0,20000-timed.round.feedback.elapsedMs)/20000));
 check('ten-second elapsed time is server measured',timed.round.feedback.elapsedMs>=10000,true);
 const firstBonus=timed.round.feedback.bonusPoints;
 check('correct answer receives base100',timed.round.feedback.basePoints,100);
 await call(command('next',id,'test-q02'));
 for(let index=2;index<20;index++){
  const questionId=plan.questions[index].question.id;
  await db.query("UPDATE kq_school_challenge_rounds SET opened_at=clock_timestamp()-interval '21 seconds' WHERE user_id=$1 AND id=$2",[owner,id]);
  const answer=await call(command('answer',id,questionId,{optionId:'a'}));
  assert.equal(answer.round.feedback.bonusPoints,0);assert.equal(answer.round.level,Math.floor(index/5)+1);
  assert.equal(answer.round.score,answer.round.answers.reduce((sum,item)=>sum+item.basePoints+item.bonusPoints,0));
  for(const future of plan.questions.slice(index+1))assert(!JSON.stringify(answer).includes(future.question.id));
  if(index<19)await call(command('next',id,questionId));
 }
 checks.push('score is exactly the sum of awarded base and bonus points');checks.push('no future question identity or correction appears in answer snapshots');
 checks.push('questions remain answerable after20seconds with no speed bonus');checks.push('all four levels advance in groups of five');
 check('best waits for the explicit end of the round',(await call()).completedCount,0);
 const finish=command('next',id,'test-q20'),complete=await call(finish);
 check('completed round has20 answers and no upcoming question',[complete.round.status,complete.round.question,complete.round.answers.length],['complete',null,20]);
 check('completed best records points and accuracy',[complete.round.score,complete.bestScore,complete.bestCorrectCount,complete.completedCount],[1900+firstBonus,1900+firstBonus,19,1]);
 check('lost final-next retry counts the round once',(await call(finish)).completedCount,1);
 check('new command repeating final-next also counts once',(await call(command('next',id,'test-q20'))).completedCount,1);
 const fresh=await call({action:'start',requestKey:randomUUID(),replaceRoundId:id});
 check('explicit fresh round retains completed best',[fresh.round.score,fresh.round.answeredCount,fresh.bestScore,fresh.completedCount],[0,0,1900+firstBonus,1]);
 check('another owner starts with no private round',(await call(null,other)).round,null);
 await reject('another owner cannot submit to this round',command('answer',fresh.round.id,'test-q01',{optionId:'a'}),/round_changed/,other);
 const invalid=structuredClone(plan);invalid.questions[1]=invalid.questions[0];
 await reject('duplicate plan questions are rejected',{action:'start',requestKey:randomUUID(),replaceRoundId:fresh.round.id},/invalid_plan/,owner,invalid);
 const oneTheme=structuredClone(plan);for(const entry of oneTheme.questions)entry.question.themeId='plant';
 await reject('a plan must cover all nine themes',{action:'start',requestKey:randomUUID(),replaceRoundId:fresh.round.id},/invalid_plan/,owner,oneTheme);
 check('no wallet side effect exists',await scalar('SELECT cents FROM wallet_sentinel'),10700);
 const hempPlan=structuredClone(plan);hempPlan.contentVersion='2026-11-13.hemp2';
 await reject('new hemp version rejects any history question',{action:'start',requestKey:randomUUID(),replaceRoundId:fresh.round.id},/invalid_plan/,owner,hempPlan);
 for(const entry of hempPlan.questions)if(entry.question.themeId==='history')entry.question.themeId='seeds';
 const hemp=await call({action:'start',requestKey:randomUUID(),replaceRoundId:fresh.round.id},owner,hempPlan);
 check('new hemp plan accepts Seeds instead of History',hemp.round.question.themeId,'seeds');
 check('bank change preserves completed scores',[hemp.bestScore,hemp.bestCorrectCount,hemp.completedCount],[complete.bestScore,complete.bestCorrectCount,complete.completedCount]);
 for(const table of ['players','rounds','requests']){
  check(table+' has explicit RLS',await scalar('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',['kq_school_challenge_'+table]),true);
  for(const role of ['anon','authenticated','service_role'])check(role+' cannot read/write '+table,await scalar('SELECT has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\')',[role,'kq_school_challenge_'+table]),false);
 }
 for(const role of ['anon','authenticated','service_role']){
  check(role+' named public RPC permission',await scalar('SELECT has_function_privilege($1,\'rpc_kq_school_challenge(uuid,jsonb,jsonb)\',\'EXECUTE\')',[role]),role==='service_role');
  check(role+' cannot directly invoke internal projection',await scalar('SELECT has_function_privilege($1,\'kq_school_challenge_snapshot(uuid,boolean)\',\'EXECUTE\')',[role]),false);
 }
 console.log('PASS: '+checks.length+' local challenge session, scoring, resume and permissions checks.');
}finally{await db.close();}
