import assert from 'node:assert/strict';
import {resolve} from 'node:path';
export async function auditSchoolChallenge({page,visit,click,screenshot,assertNoOverflow,results,fixture,setWidth}){
 const width=320;setWidth(width);fixture.reset();await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const owner=fixture.snapshot.ownerId,wallet=structuredClone(fixture.snapshot),pendingKey='kq-school-challenge-pending:v1:'+owner;
 const enter=()=>visit('cards','view=school&section=quiz');
 const capture=async name=>{await page.$eval('[data-school-challenge]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:resolve('output/placard-navigation',name+'-viewport.png')});await screenshot(name);};
 await enter();await page.evaluate(()=>sessionStorage.clear());await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-challenge-start]');
 fixture.loseNextChallenge('start');await click('[data-challenge-start]');await page.waitForSelector('[data-challenge-retry]');
 const start=structuredClone(fixture.challengeSubmissions.at(-1)),first=fixture.challengeSnapshot.round;
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-challenge-retry]');await click('[data-challenge-retry]');await page.waitForSelector('[data-challenge-question]');
 assert.deepEqual(fixture.challengeSubmissions.at(-1),start);assert.equal(fixture.challengeSnapshot.round.openedAt,first.openedAt);
 assert.equal(await page.$$eval('[data-challenge-question] fieldset',els=>els.length),1);assert.equal(await page.$$eval('[data-challenge-option]',els=>els.length),4);
 const wrong=first.question.options.find(o=>o.id!==fixture.answers[first.question.id].correctOptionId).id;
 fixture.loseNextChallenge('answer');await page.focus(`[data-challenge-option="${wrong}"]`);await page.keyboard.press('Enter');await page.waitForSelector('[data-challenge-retry]');
 const initialAnswer=structuredClone(fixture.challengeSubmissions.at(-1)),initialFeedback=structuredClone(fixture.challengeSnapshot.round.feedback);
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-challenge-feedback="incorrect"]');await click('[data-challenge-retry]');await page.waitForSelector('[data-challenge-feedback="incorrect"]');
 assert.deepEqual(fixture.challengeSubmissions.at(-1),initialAnswer);assert.deepEqual(fixture.challengeSnapshot.round.feedback,initialFeedback);assert.equal(initialFeedback.awardedPoints,0);await assertNoOverflow('Challenge wrong feedback');await capture('school-challenge-lost-answer-320');
 fixture.loseNextChallenge('next');await click('[data-challenge-next]');await page.waitForSelector('[data-challenge-retry]');const next=structuredClone(fixture.challengeSubmissions.at(-1)),opened=fixture.challengeSnapshot.round.openedAt;
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-challenge-retry]');await click('[data-challenge-retry]');await page.waitForFunction(()=>document.querySelector('[data-challenge-question]')&&![...document.querySelectorAll('[data-challenge-retry]')].some(el=>el.checkVisibility()));
 assert.deepEqual(fixture.challengeSubmissions.at(-1),next);assert.equal(fixture.challengeSnapshot.round.questionNumber,2);assert.equal(fixture.challengeSnapshot.round.openedAt,opened);
 const ids=[first.question.id];
 for(let index=1;index<20;index++){
  const question=fixture.challengeSnapshot.round.question;ids.push(question.id);
  if(index===1){fixture.advanceChallenge(25000);await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-challenge-answer]');}
  if(index===3)fixture.loseNextChallenge('answer');
  await click(`[data-challenge-option="${fixture.answers[question.id].correctOptionId}"]`);
  if(index===3){
   await page.waitForSelector('[data-challenge-retry]');const stored=await page.evaluate(key=>sessionStorage.getItem(key),pendingKey);
   fixture.snapshot.ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-challenge-start]');assert.equal(await page.$('[data-challenge-feedback]'),null);assert.equal(await page.$('[data-challenge-retry]'),null);
   await click('[data-challenge-start]');await page.waitForSelector('[data-challenge-question]');assert.equal(fixture.challengeSnapshot.round.answeredCount,0);
   assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),pendingKey),stored);
   fixture.snapshot.ownerId=owner;await enter();await page.waitForSelector('[data-challenge-feedback="correct"]');await click('[data-challenge-retry]');
  }
  await page.waitForSelector('[data-challenge-feedback="correct"]');
  if(index===1)assert.equal(fixture.challengeSnapshot.round.feedback.bonusPoints,0);
  if(index===19)fixture.loseNextChallenge('next');
  await click('[data-challenge-next]');
  if(index<19)await page.waitForFunction(id=>document.querySelector('[data-challenge-question]')?.getAttribute('data-challenge-question')!==id,{},question.id);
 }
 await page.waitForSelector('[data-challenge-retry]');assert.equal(fixture.challengeSnapshot.completedCount,1);const final=structuredClone(fixture.challengeSubmissions.at(-1)),score=fixture.challengeSnapshot.round.score;
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-challenge-result]');await click('[data-challenge-retry]');await page.waitForSelector('[data-challenge-result]');assert.deepEqual(fixture.challengeSubmissions.at(-1),final);assert.equal(fixture.challengeSnapshot.completedCount,1);assert.equal(fixture.challengeSnapshot.bestScore,score);
 assert.equal(fixture.challengeSnapshot.round.correctCount,19);assert.equal(new Set(ids).size,20);assert.deepEqual(fixture.snapshot,wallet);await assertNoOverflow('Challenge final result');await capture('school-challenge-result-320');
 for(const file of ['kanab-quest-school-challenge-server.ts','kanab-quest-school-harvest-answers.ts','kanab-quest-hemp-quiz-bank.ts','kanab-quest-hemp-quiz-biology.ts','kanab-quest-hemp-quiz-uses.ts'])assert.equal(await page.evaluate(async file=>(await fetch('/src/lib/'+file+'?raw')).status,file),403);
 results.push({scenario:'challenge-lost-responses',width,questions:20,correct:19,score,oneQuestion:true,nativeKeyboard:true,lostStart:true,lostAnswer:true,lostNext:true,lostCompletion:true,ownerPendingIsolation:true,stableQuestionClock:true,lateAnswerNoBonus:true,completedCount:1,walletUnchanged:true,privateSources403:true});
}
