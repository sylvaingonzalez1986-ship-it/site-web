import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSchoolFixture} from './audit-school-scenarios.mjs';
const fixture=await createSchoolFixture(),checks=[];
const check=(label,value,expected)=>{assert.deepEqual(value,expected,label);checks.push(label);};
async function request(body,owner=fixture.snapshot.ownerId){let response;await fixture.handle({method:()=>body?'POST':'GET',headers:()=>({'x-kq-school-owner':owner}),postData:()=>JSON.stringify(body),respond:async value=>{response={status:value.status,body:JSON.parse(value.body)};},abort:async()=>{response={aborted:true};}},new URL('http://local.test/api/arena/placard/school/challenge'));return response;}
const start={action:'start',requestKey:randomUUID()},before=structuredClone(fixture.snapshot);
check('GET initially has no round',(await request()).body.round,null);
fixture.loseNextChallenge('start');check('lost start response commits round',(await request(start)).aborted,true);
const first=fixture.challengeSnapshot,roundId=first.round.id;
check('retry start keeps question and clock',[(await request(start)).body.round.id,(await request(start)).body.round.openedAt],[roundId,first.round.openedAt]);
check('initial snapshot carries no private answers',JSON.stringify(first).includes('correctOptionId'),false);
const seen=[];let total=0;
for(let index=0;index<20;index++){
 const question=fixture.challengeSnapshot.round.question;seen.push(question);const correct=fixture.answers[question.id].correctOptionId;
 const optionId=index===0?question.options.find(option=>option.id!==correct).id:correct;
 fixture.advanceChallenge(index===1?25000:10000);
 const answer={action:'answer',requestKey:randomUUID(),roundId,questionId:question.id,optionId};
 if(index===0){fixture.loseNextChallenge('answer');check('answer response loss follows commitment',(await request(answer)).aborted,true);}
 const result=(await request(answer)).body,feedback=result.round.feedback;total+=feedback.awardedPoints;
 assert.equal(result.round.score,total);assert.equal(result.round.answers.length,index+1);assert.equal(feedback.level,Math.floor(index/5)+1);
 if(index===0){check('wrong choice earns no speed points',[feedback.basePoints,feedback.bonusPoints,feedback.awardedPoints],[0,0,0]);check('immutable answer survives retry',(await request(answer)).body.round.feedback,feedback);check('correcting a revealed answer is rejected',(await request({...answer,requestKey:randomUUID(),optionId:correct})).status,409);}
 if(index===1)check('late answer remains possible with base points only',[feedback.basePoints,feedback.bonusPoints],[100,0]);
 const next={action:'next',requestKey:randomUUID(),roundId,questionId:question.id};
 fixture.advanceChallenge(100000);if(index===4){fixture.loseNextChallenge('next');check('next response loss follows commitment',(await request(next)).aborted,true);}
 const moved=(await request(next)).body;assert.equal(moved.round.questionNumber,Math.min(index+2,20));
 if(index===4){check('retry next cannot skip another question',(await request(next)).body.round.questionNumber,6);check('reading feedback does not consume next question bonus',Date.parse(moved.serverNow)-Date.parse(moved.round.openedAt)<1000,true);}
}
const complete=fixture.challengeSnapshot;
check('twenty distinct mixed questions',[seen.length,new Set(seen.map(q=>q.id)).size,new Set(seen.map(q=>q.themeId)).size],[20,20,9]);
check('five questions per level',[1,2,3,4].map(level=>seen.filter(q=>q.level===level).length),[5,5,5,5]);
check('best and completed state survive GET',[(await request()).body.round.status,complete.bestScore,complete.bestCorrectCount,complete.completedCount,complete.round.question],['complete',total,19,1,null]);
check('challenge never changes old quiz rewards or wallet',fixture.snapshot,before);
check('old owner mutation header is rejected',(await request(start,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).body.code,'school_owner_changed');
const originalOwner=fixture.snapshot.ownerId;fixture.snapshot.ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';check('ownerB sees no ownerA session',(await request()).body.round,null);
fixture.snapshot.ownerId=originalOwner;check('ownerA retrieves its own completed round',(await request()).body.round.id,roundId);
check('replacement requires current-round confirmation',(await request({action:'start',requestKey:randomUUID()})).status,409);
const fresh=(await request({action:'start',requestKey:randomUUID(),replaceRoundId:roundId})).body;
check('fresh explicit round preserves best',[fresh.round.score,fresh.bestScore,fresh.completedCount],[0,total,1]);
check('late command from replaced round cannot touch fresh round',(await request({action:'answer',requestKey:randomUUID(),roundId,questionId:seen[0].id,optionId:'a'})).status,409);
console.log('PASS: '+checks.length+' challenge fixture lifecycle, lost-response and owner checks.');
