/** Focused History journey using the existing local navigation fixture. */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

export async function auditSchoolHistory({page,visit,click,screenshot,assertNoOverflow,results,fixture,setWidth}) {
 const text=async(label,scope='[data-school]')=>{
  const handle=await page.waitForFunction(({label,scope})=>[...document.querySelectorAll(`${scope} button`)].find(el=>el.checkVisibility()&&!el.disabled&&el.textContent.trim().startsWith(label)),{}, {label,scope});
  await handle.asElement().evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await handle.asElement().click();await handle.dispose();
 };
 const passage=async id=>{await visit('cards',`view=school&section=learn&module=history&passage=${id}`);await page.waitForSelector('[data-school-history]');};
 const saveReady=()=>page.waitForFunction(()=>![...document.querySelectorAll('[data-school-history] [role=status]')].some(el=>el.textContent.includes('en cours')));
 const capture=async name=>{await page.waitForFunction(()=>![...document.querySelectorAll('[role=status]')].some(el=>el.textContent.includes('Ouverture de')));await page.screenshot({path:resolve('output/placard-navigation',`${name}-viewport.png`)});await screenshot(name);};
 const choose=async(activity,wrongReason=false)=>{
  for(const step of activity.steps){if(activity.steps.length>1)await click(`[data-history-activity="${activity.id}"] [data-activity-step="${step.id}"]`);await click(`input[name="${activity.id}-${step.id}"][value="${step.choices.find(c=>c.correct).id}"]`);if(step.reasons?.length)await click(`input[name="${activity.id}-${step.id}-reason"][value="${step.reasons.find(c=>wrongReason?!c.correct:c.correct).id}"]`);}
 };
 const completeActivity=async(activity,wrongFirst=false)=>{
  const scope=`[data-history-activity="${activity.id}"]`;
  await page.waitForSelector(scope);assert(await page.$eval(scope,el=>[...el.querySelectorAll('button')].find(button=>button.textContent.startsWith('Vérifier mes arguments')).disabled),'Cannot validate an unanswered exercise');
  if(wrongFirst){await choose(activity,true);await text('Vérifier mes arguments',scope);assert.equal(await page.$eval(scope,el=>el.textContent.includes('Relis les preuves')),true,'A correct assertion with wrong evidence fails');await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(`${scope} input:checked`);assert.equal(await page.$eval(scope,el=>el.textContent.includes('Relis les preuves')),true,'Exercise draft and feedback survive reload');}
  await choose(activity);await text('Vérifier mes arguments',scope);await text('Enregistrer cette activité',scope);await page.waitForFunction(scope=>document.querySelector(scope)?.textContent.includes('Activité enregistrée'),{},scope);
 };
 for(const width of [320,1440]) {
  setWidth(width);fixture.reset();await page.setViewport({width,height:width===320?844:1000,isMobile:width===320,hasTouch:width===320,deviceScaleFactor:1});
  await passage('history-index');await page.evaluate(()=>sessionStorage.clear());await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-school-history]');
  assert.equal(await page.$$eval('[data-school-history] article',els=>els.length),11);await assertNoOverflow('History index');await page.evaluate(()=>window.scrollTo(0,0));await capture(`school-history-index-${width}`);
  await page.type('[data-school-history] input[type=search]','Noyal');await page.waitForFunction(()=>document.querySelector('[data-school-history] [role=status]')?.textContent.includes('résultat'));assert(await page.$$eval('[data-school-history] button',els=>els.some(el=>el.textContent.includes('Noyal'))),'Search finds Noyal');
  await passage('history-evidence-1');await page.waitForSelector('[data-history-diagram]');await text('J’ai parcouru cette leçon');await saveReady();assert(fixture.historySnapshot.lessonIds.includes('history-evidence-1'));
  await text('Leçon suivante');await page.waitForSelector('[data-history-lesson="history-evidence-2"]');await saveReady();await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-history-lesson="history-evidence-2"]');assert.equal(fixture.historySnapshot.resumeLessonId,'history-evidence-2');
  await text('L’Arbre Mère');await page.waitForSelector('[data-buddie-collection-detail][open]');await page.keyboard.press('Escape');await page.waitForSelector('[data-history-lesson="history-evidence-2"]');assert.equal(new URL(page.url()).searchParams.get('passage'),'history-evidence-2');
  await text('Frise','nav[aria-label="Explorer le parcours Histoire"]');await page.waitForSelector('[aria-label="Frise historique filtrable"]');await page.select('[data-school-history] select','brittany');await page.select('[data-school-history] select:nth-of-type(1)','brittany');
  const selectors=await page.$$('[data-school-history] select');await selectors[1].select('fibre');assert(await page.$$eval('[data-school-history] ol>li',els=>els.length>0));await assertNoOverflow('Filtered timeline');await capture(`school-history-timeline-${width}`);
  await text('Carte','nav[aria-label="Explorer le parcours Histoire"]');await page.waitForSelector('svg[aria-labelledby="history-map-title history-map-desc"]');
  const hypothesis=fixture.history.HISTORY_ROUTES.find(route=>route.certainty==='hypothesis');assert(hypothesis,'At least one appropriately uncertain circulation');await text(hypothesis.title);assert(await page.$('svg path[stroke-dasharray]'),'Hypothesis is dashed, not colour only');await assertNoOverflow('History map');await page.$eval('svg[aria-labelledby="history-map-title history-map-desc"]',el=>el.scrollIntoView({block:'center'}));await capture(`school-history-map-${width}`);
  await page.focus('div[aria-label="Choisir une circulation"] button');await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert(await page.$eval('div[aria-label="Choisir une circulation"] button[aria-pressed=true]',el=>el===document.activeElement),'Map is operable with keyboard');
  await text('Glossaire','nav[aria-label="Explorer le parcours Histoire"]');await page.waitForSelector('[data-school-history] dl dt');await page.type('[data-school-history] input[type=search]','rouissage');assert.equal(await page.$$eval('[data-school-history] dl dt',els=>els.length),1);await assertNoOverflow('Glossary');
  const archaeology=fixture.history.HISTORY_CHAPTERS.find(chapter=>chapter.id==='eurasian-antiquity').checkpoint;
  await passage(archaeology.id);await completeActivity(archaeology,true);
  const lessonActivities=['history-brittany-1','history-brittany-2','history-twentieth-century-2','history-evidence-2'].map(id=>fixture.history.HISTORY_LESSONS.find(lesson=>lesson.id===id));assert(lessonActivities.every(Boolean));
  for(const lesson of lessonActivities) {await passage(lesson.id);await completeActivity(lesson.activity);await assertNoOverflow(`${lesson.activity.kind} exercise`);if(lesson.id==='history-brittany-1'){await page.$eval('[data-history-activity]',el=>el.scrollIntoView({block:'start'}));await capture(`school-history-noyal-${width}`);}}
  const chapter=fixture.history.HISTORY_CHAPTERS[0];await passage(chapter.checkpoint.id);await completeActivity(chapter.checkpoint);assert(fixture.historySnapshot.checkpointIds.includes(chapter.checkpoint.id));
  await passage('history-index');await text('Composer mon quiz');await page.waitForSelector('[data-school] input[type=radio]');const ids=[];
  for(let index=0;index<10;index++) {const id=await page.$eval('[data-school] input[type=radio]',el=>el.name);ids.push(id);await click(`input[name="${id}"][value="${fixture.answers[id].correctOptionId}"]`);if(index===4){await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(`input[name="${id}"]:checked`);}if(index<9)await text('Suivante');}
  assert.equal(new Set(ids.map(id=>fixture.history.HISTORY_QUESTIONS.find(q=>q.id===id).chapterId)).size,10);await text('Valider mes réponses');await page.waitForSelector('[aria-label="Résultat du quiz"]');assert.equal(fixture.snapshot.quizzes.find(q=>q.quizId==='history').paidCents,1000);assert.match(fixture.submissions.at(-1).selectionId,/^h1\./);await assertNoOverflow('History synthesis result');
  await click('[data-school-correction] summary');await click('[data-school-correction][open] details summary');assert.equal(await page.$$eval('[data-school-correction][open] details[open] > ul > li',els=>els.length),4);await text('Revoir ce passage','[data-school-correction][open]');await page.waitForSelector('[data-history-lesson]');await assertNoOverflow('Correction deep link');
  await passage('history-index');await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-school-history]');assert(fixture.historySnapshot.activityIds.length===4&&fixture.historySnapshot.checkpointIds.length===2&&fixture.historySnapshot.lessonIds.length===1);
  results.push({scenario:'history-curriculum',width,chapters:11,lessons:22,activityKinds:5,reasonRequired:true,checkpoint:true,resume:true,search:true,glossary:true,timelineFilters:true,mapUncertainty:true,mapKeyboard:true,buddyReturn:true,quizDistinctChapters:10,optionCorrections:4,rewardCents:1000});
 }
 for(const name of ['kanab-quest-school-history-early-answers.ts','kanab-quest-school-history-modern-answers.ts']) {const status=await page.evaluate(async name=>(await fetch(`/src/lib/${name}?raw`)).status,name);assert.equal(status,403,'Author answer files cannot be downloaded');}
}
