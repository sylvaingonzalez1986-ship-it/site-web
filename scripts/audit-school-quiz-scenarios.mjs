/** Focused immediate-feedback quiz audit; all transport data stays local. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';

export async function auditSchoolQuizFlow({page,visit,click,screenshot,assertNoOverflow,results,fixture,setWidth}) {
 const readDraft=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(key=>/^kq-school-draft:v1:.*:plant$/.test(key)))));
 const post=(path,body,owner)=>page.evaluate(async({path,body,owner})=>{const response=await fetch('/api/arena/placard/school'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Kq-School-Owner':owner},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};},{path,body,owner});
 const start=async()=>{await visit('cards','view=school&module=plant&passage=botany-index');const handle=await page.waitForFunction(()=>[...document.querySelectorAll('[data-school] button')].find(el=>el.checkVisibility()&&!el.disabled&&el.textContent.includes('Composer mon quiz')));await handle.asElement().evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await handle.asElement().click();await handle.dispose();await page.waitForSelector('[data-quiz-check]');};
 const capture=async name=>{await page.$eval('[data-school-quiz], [data-school-quiz-result]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:resolve('output/placard-navigation',name+'-viewport.png')});await screenshot(name);};
 for(const width of [320,1440]){
  setWidth(width);fixture.reset();await page.setViewport({width,height:width===320?844:1000,isMobile:width===320,hasTouch:width===320,deviceScaleFactor:1});
  const owner=fixture.snapshot.ownerId,reward=fixture.snapshot.quizzes.find(q=>q.quizId==='plant');Object.assign(reward,{bestScore:7,paidCents:700,remainingCents:300,attempts:1});fixture.snapshot.totalPaidCents=700;fixture.snapshot.cashCents+=700;
  await visit('cards','view=school');await page.evaluate(()=>sessionStorage.clear());await start();
  let draft=await readDraft();const first=draft.quiz.questions[0],correct=fixture.answers[first.id].correctOptionId,wrong=first.options.find(o=>o.id!==correct).id;
  assert.equal(await page.$$eval('[data-school-quiz] fieldset',els=>els.length),1);assert.equal(await page.$$eval('[data-quiz-option]',els=>els.length),4);
  assert((await page.$eval('[data-quiz-budget]',el=>el.textContent)).includes('3,00'));
  await page.focus('[data-quiz-option] input');await page.keyboard.press('ArrowDown');assert(await page.$('[data-quiz-option] input:checked'),'Native radio keyboard selection works');
  await click(`[data-quiz-option="${wrong}"]`);fixture.loseNextCheck();await click('[data-quiz-check]');await page.waitForSelector('[data-school-quiz] [role=alert]');
  const sent=structuredClone(fixture.checkSubmissions.at(-1));assert.equal(fixture.credits,0);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-quiz-check]');assert.equal(await page.$eval('[data-school-quiz] fieldset',el=>el.disabled),true);
  assert.equal(await page.$eval('[data-school-quiz] input:checked',el=>el.value),wrong);await click('[data-quiz-check]');await page.waitForSelector('[data-quiz-feedback="incorrect"]');assert.deepEqual(fixture.checkSubmissions.at(-1),sent);
  assert((await page.$eval('[data-quiz-feedback] h4',el=>el.textContent)).includes('incorrecte'));await assertNoOverflow('Immediate incorrect feedback');await capture('school-quiz-feedback-'+width);
  assert.equal((await post('/quiz/check',{...sent,optionId:correct},owner)).status,409);
  assert.equal((await post('/quiz/check',{...sent,requestKey:randomUUID(),optionId:correct},owner)).status,409);
  draft=await readDraft();const forged={requestKey:randomUUID(),quizId:draft.quiz.quizId,contentVersion:draft.quiz.contentVersion,selectionId:draft.quiz.selectionId,answers:draft.quiz.questions.map(q=>({questionId:q.id,optionId:fixture.answers[q.id].correctOptionId}))};
  assert.equal((await post('/quiz',forged,owner)).status,409);assert.equal((await post('/quiz/check',sent,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).body.code,'school_owner_changed');assert.equal(fixture.credits,0);
  for(let index=1;index<10;index++){
   await click('[data-quiz-next]');await page.waitForFunction(index=>document.querySelector('[aria-current=step]')?.textContent.trim()===String(index+1),{},index);
   draft=await readDraft();const question=draft.quiz.questions[index];await click(`[data-quiz-option="${fixture.answers[question.id].correctOptionId}"]`);await click('[data-quiz-check]');await page.waitForSelector('[data-quiz-feedback="correct"]');
   if(index===4){await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-quiz-feedback="correct"]');assert.equal(await page.$eval('[data-school-quiz] fieldset',el=>el.disabled),true);}
  }
  fixture.loseNext();await click('[data-quiz-next]');await page.waitForSelector('[data-school-quiz] [role=alert]');const submitted=structuredClone(fixture.submissions.at(-1));assert.equal(reward.paidCents,900);assert.equal(fixture.credits,1);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-quiz-submit]');await click('[data-quiz-submit]');await page.waitForSelector('[data-school-quiz-result]');assert.deepEqual(fixture.submissions.at(-1),submitted);assert.equal(fixture.credits,1);assert.equal(reward.paidCents,900);assert.equal(fixture.snapshot.totalBudgetCents,10000);
  const completed=await readDraft();assert.equal(completed.completion.result.score,9);assert.equal(completed.completion.result.gainCents,200);await assertNoOverflow('Immediate quiz final receipt');await capture('school-quiz-result-'+width);
  await click('[data-quiz-full-review]>summary');await click('[data-school-correction]>summary');await click('[data-school-correction][open] details>summary');assert.equal(await page.$$eval('[data-school-correction][open] details[open] li',els=>els.length),4);
  const originalStorage=await page.evaluate(owner=>sessionStorage.getItem('kq-school-draft:v1:'+owner+':plant'),owner);
  fixture.snapshot.ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';await page.reload({waitUntil:'networkidle0'});await start();assert.equal(await page.$('[data-school-quiz] input:checked'),null);assert.equal(await page.evaluate(owner=>sessionStorage.getItem('kq-school-draft:v1:'+owner+':plant'),owner),originalStorage);
  fixture.snapshot.ownerId=owner;await visit('cards','view=school&section=quiz&module=plant');await page.waitForSelector('[data-school-quiz-result]');assert.equal((await readDraft()).requestKey,completed.requestKey);
  const privateStatus=await page.evaluate(async()=>(await fetch('/src/lib/kanab-quest-school-botany-foundations-answers.ts?raw')).status);assert.equal(privateStatus,403);
  results.push({scenario:'immediate-quiz',width,oneQuestion:true,largeNativeChoices:4,keyboard:true,wrongFeedbackExplicit:true,lostCheckRetry:true,immutableAnswer:true,selectionKeySwapRejected:true,ownerGuard409:true,ownerDraftIsolation:true,reloadCheckedAnswer:true,lostFinalRetry:true,score:9,legacyPaidCents:700,gainCents:200,paidCents:900,totalBudgetCents:10000,credits:1,privateAnswers403:true,fullOptionCorrections:4});
 }
}
