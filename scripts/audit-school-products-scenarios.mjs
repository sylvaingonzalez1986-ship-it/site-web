/** Real Products UI against the local, in-memory school transport. */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

export async function auditSchoolProducts({page,visit,click,screenshot,assertNoOverflow,results,fixture,setWidth}) {
 const course='[data-school-curriculum="products"]';
 const text=async(label,scope='[data-school]')=>{const handle=await page.waitForFunction(({label,scope})=>[...document.querySelectorAll(`${scope} button`)].find(el=>el.checkVisibility()&&!el.disabled&&el.textContent.trim().startsWith(label)),{},{label,scope});await handle.asElement().evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await handle.asElement().click();await handle.dispose();};
 // Public content can mount before the authenticated owner and progress arrive.
 const passage=async id=>{await visit('cards',`view=school&module=profiles&passage=${id}`);await page.waitForSelector(course);await page.waitForFunction(scope=>{const panel=document.querySelector(scope);return panel&&!panel.textContent.includes('La progression détaillée sera disponible lorsque');},{},course);};
 const capture=async(name,selector)=>{await page.waitForFunction(()=>![...document.querySelectorAll('[role=status]')].some(el=>el.textContent.includes('Ouverture')));if(selector)await page.$eval(selector,el=>el.scrollIntoView({block:'start',behavior:'instant'}));else await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve('output/placard-navigation',`${name}-viewport.png`)});await screenshot(name);};
 const choose=async(activity,wrongReason=false,alternate=false)=>{for(const step of activity.steps){if(activity.steps.length>1)await click(`[data-history-activity="${activity.id}"] [data-activity-step="${step.id}"]`);const choices=step.choices.filter(choice=>choice.correct);await click(`input[name="${activity.id}-${step.id}"][value="${(alternate?choices.at(-1):choices[0]).id}"]`);if(step.reasons?.length){const reason=(wrongReason?step.reasons.find(item=>!item.correct):undefined)??step.reasons.find(item=>item.correct);await click(`input[name="${activity.id}-${step.id}-reason"][value="${reason.id}"]`);}}};
 const solve=async(activity,wrongFirst=false)=>{const scope=`[data-history-activity="${activity.id}"]`;await page.waitForSelector(scope);if(wrongFirst){assert(activity.steps.some(step=>step.reasons?.some(reason=>!reason.correct)),'Exercise has a meaningful incorrect justification');await choose(activity,true);await text('Vérifier mes arguments',scope);assert(await page.$eval(scope,el=>el.textContent.includes('Relis les preuves')));assert(!fixture.productsSnapshot.activityIds.includes(activity.id));await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(`${scope} input:checked`);assert(await page.$eval(scope,el=>el.textContent.includes('Relis les preuves')),'Incorrect justification and feedback survive reload');}await choose(activity);await text('Vérifier mes arguments',scope);await text('Enregistrer cette activité',scope);await page.waitForFunction(scope=>document.querySelector(scope)?.textContent.includes('Activité enregistrée'),{},scope);};

 const widths=(process.env.PRODUCTS_AUDIT_WIDTHS??'320,1440').split(',').map(Number);
 assert(widths.length>0&&new Set(widths).size===widths.length&&widths.every(width=>[320,1440].includes(width)),'Use the supported Products audit widths');
 for(const width of widths) {
  setWidth(width);fixture.reset();await page.setViewport({width,height:width===320?844:1000,isMobile:width===320,hasTouch:width===320,deviceScaleFactor:1});
  // An old profiles quiz already paid 700 cents; the new course shares that ceiling.
  const reward=fixture.snapshot.quizzes.find(item=>item.quizId==='profiles');Object.assign(reward,{bestScore:7,paidCents:700,remainingCents:300,attempts:1});fixture.snapshot.cashCents+=700;fixture.snapshot.totalPaidCents+=700;
  await passage('products-index');await page.evaluate(()=>sessionStorage.clear());await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(course);assert.equal(await page.$$eval(`${course} article`,els=>els.length),10);await assertNoOverflow('Products index');await capture(`school-products-index-${width}`);
  await page.type(`${course} input[type=search]`,'fibre');await page.waitForFunction(scope=>[...document.querySelectorAll(`${scope} [role=status]`)].some(el=>el.textContent.includes('résultats')&&parseInt(el.textContent,10)>0),{},course);

  await passage('products-seeds-1');fixture.loseNextProducts();await text('J’ai parcouru cette leçon');await page.waitForSelector(`${course} [role=alert]`);assert(fixture.productsSnapshot.lessonIds.includes('products-seeds-1'));const revision=fixture.productsSnapshot.revision;
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(scope=>document.querySelector(scope)?.textContent.includes('Enregistrer les étapes en attente'),{},course);await text('Enregistrer les étapes en attente');await page.waitForFunction(scope=>!document.querySelector(`${scope} [role=alert]`)&&!document.querySelector(scope)?.textContent.includes('Enregistrer les étapes en attente'),{},course);assert.equal(fixture.productsSnapshot.revision,revision,'Retry acknowledges the committed batch without a new revision');
  const exercised=new Set();
  for(const id of ['products-seeds-1','products-fibres-2','products-resins-2','products-labels-1','products-quality-2','products-traceability-1']){const lesson=fixture.products.PRODUCTS_LESSONS.find(item=>item.id===id);assert(lesson);await passage(id);await solve(lesson.activity,id==='products-seeds-1');exercised.add(lesson.activity.id);await assertNoOverflow(id);}
  await passage('products-seeds-checkpoint');await solve(fixture.products.PRODUCTS_CHAPTERS.find(chapter=>chapter.id==='seeds').checkpoint);assert.equal(fixture.snapshot.totalPaidCents,700,'Practice and reading pay no currency');

  await passage('products-overview');await page.waitForSelector('[data-products-point]');
  const points=fixture.products.PRODUCTS_PLATE_POINTS;
  assert.equal(await page.$$eval('[data-products-point]',els=>els.length),points.length);
  await page.waitForFunction(()=>{const img=document.querySelector('[data-products-plate] img');return img?.complete&&img.naturalWidth>0;});
  for(const point of points){await click(`[data-products-point="${point.id}"]`);await page.waitForSelector(`[data-products-point-detail="${point.id}"]`);assert.equal(await page.$eval(`[data-products-point="${point.id}"]`,el=>el.getAttribute('aria-pressed')),'true');assert((await page.$eval('[data-products-point-detail]',el=>el.textContent)).includes(point.text));}
  await page.focus(`[data-products-point="${points[0].id}"]`);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.productsPoint),points[1].id);await page.keyboard.press('Enter');await page.waitForSelector(`[data-products-point-detail="${points[1].id}"]`);await assertNoOverflow('Products plate');await capture(`school-products-plate-${width}`,'[data-products-plate]');

  await passage('products-processes');await page.waitForSelector('[data-products-process]');
  const processes=fixture.products.PRODUCTS_PROCESS_CARDS;
  assert.equal(await page.$$eval('[data-products-process]',els=>els.length),processes.length);
  for(const process of processes){await click(`[data-products-process="${process.id}"]`);await page.waitForSelector(`[data-products-process-detail="${process.id}"]`);const actual=await page.$eval('[data-products-process-detail]',el=>el.textContent);for(const value of [process.input,process.change,process.result,process.examples,process.limit])assert(actual.includes(value));}
  await assertNoOverflow('Products processes');await capture(`school-products-processes-${width}`,'[data-products-processes]');

  await passage('products-fibres');await page.waitForSelector('[data-products-fibre-stage]');
  const stages=fixture.products.PRODUCTS_FIBRE_STAGES;
  assert.equal(await page.$$eval('[data-products-fibre-stage]',els=>els.length),stages.length);
  for(const stage of stages){await click(`[data-products-fibre-stage="${stage.id}"]`);await page.waitForSelector(`[data-products-fibre-detail="${stage.id}"]`);const actual=await page.$eval('[data-products-fibre-detail]',el=>el.textContent);for(const value of [stage.input,stage.transformation,...stage.outputs,stage.limit,...stage.controls])assert(actual.includes(value));}
  await click('[data-products-fibres]>details>summary');await text('Vérifier le parcours des fibres','[data-products-fibres]');assert(await page.$eval('[data-products-fibres] [role=status]',el=>el.textContent.startsWith('Repars')));
  for(let target=0;target<stages.length;target++){let current=(await page.$$eval('[data-products-fibre-order]',els=>els.map(el=>el.dataset.productsFibreOrder))).indexOf(stages[target].id);assert(current>=target);while(current>target){await page.evaluate(title=>[...document.querySelectorAll('[data-products-fibres] button')].find(el=>el.getAttribute('aria-label')===`Monter : ${title}`).focus(),stages[target].title);await page.keyboard.press('Enter');current--;}}
  assert.deepEqual(await page.$$eval('[data-products-fibre-order]',els=>els.map(el=>el.dataset.productsFibreOrder)),stages.map(stage=>stage.id));await text('Vérifier le parcours des fibres','[data-products-fibres]');assert(await page.$eval('[data-products-fibres] [role=status]',el=>el.textContent.startsWith('Ce parcours textile est cohérent')));await assertNoOverflow('Products fibres keyboard');await capture(`school-products-fibres-${width}`,'[data-products-fibres]');

  await passage('products-labels');await page.waitForSelector('[data-products-claim]');
  const claims=fixture.products.PRODUCTS_LABEL_CLAIMS;
  assert.equal(await page.$$eval('[data-products-claim]',els=>els.length),claims.length);
  for(const claim of claims){await click(`[data-products-claim="${claim.id}"]`);assert.equal(await page.$('[data-products-claim-feedback]'),null);await text('Examiner cette affirmation','[data-products-labels]');await page.waitForSelector(`[data-products-claim-feedback="${claim.id}"]`);const actual=await page.$eval('[data-products-claim-feedback]',el=>el.textContent);for(const value of [claim.conclusion,claim.why])assert(actual.includes(value));}
  await assertNoOverflow('Products labels');await capture(`school-products-labels-${width}`,'[data-products-labels]');

  await passage('products-atlas');await page.waitForSelector('[data-products-atlas-item]');
  const atlas=fixture.products.PRODUCTS_ATLAS;
  assert.equal(await page.$$eval('[data-products-atlas-item]',els=>els.length),atlas.length);
  const family=atlas.find(item=>item.family==='fibre')?.family??atlas[0].family;
  await page.select('[data-products-atlas] select',family);
  assert.deepEqual(await page.$$eval('[data-products-atlas-item]',els=>els.map(el=>el.dataset.productsAtlasItem)),atlas.filter(item=>item.family===family).map(item=>item.id));
  const candidate=atlas.find(item=>item.family===family);await page.type('[data-products-atlas] input[type=search]',candidate.title);
  const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matching=atlas.filter(item=>item.family===family&&fold(`${item.title} ${item.plantPart} ${item.origin} ${item.principle}`).includes(fold(candidate.title)));
  assert.deepEqual(await page.$$eval('[data-products-atlas-item]',els=>els.map(el=>el.dataset.productsAtlasItem)),matching.map(item=>item.id));
  await page.focus(`[data-products-atlas-item="${candidate.id}"]`);await page.keyboard.press('Enter');await page.waitForSelector(`[data-products-atlas-detail="${candidate.id}"]`);
  assert.equal(new URL(page.url()).searchParams.get('passage'),`products-atlas-${candidate.id}`);
  const detail='[data-products-atlas-detail]';for(let index=1;index<=3;index++)await click(`${detail}>details:nth-of-type(${index})>summary`);
  const actual=await page.$eval(detail,el=>el.textContent);for(const value of [candidate.origin,candidate.principle,candidate.marketEvidence,...candidate.properties,...candidate.limits,...candidate.checks])assert(actual.includes(value));
  await assertNoOverflow('Products atlas filters and keyboard');await capture(`school-products-atlas-${width}`,'[data-products-atlas]');

  await passage('products-certificate');await page.waitForSelector('[data-products-result]');
  const certificate=fixture.products.PRODUCTS_CERTIFICATE;
  assert.equal(await page.$$eval('[data-products-result]',els=>els.length),6);
  assert.equal(await page.$$eval('[data-products-result][data-status="not-tested"]',els=>els.length),4);
  assert.equal(await page.$$eval('[data-products-result]:not([data-status="not-tested"])',els=>els.length),2);
  assert((await page.$eval('[data-products-certificate]',el=>el.textContent)).includes(certificate.lot));
  for(const row of certificate.rows){const scope=`[data-products-result="${row.id}"]`;const actual=await page.$eval(scope,el=>el.textContent);assert(actual.includes(row.result));if(row.unit!=='—')assert(actual.includes(row.unit));await click(`[data-products-result-detail="${row.id}"]`);await page.waitForSelector(`[data-products-measure-note="${row.id}"]`);assert((await page.$eval('[data-products-measure-note]',el=>el.textContent)).includes(row.note));}
  await click('[data-products-certificate]>details>summary');for(const limit of certificate.limits)assert((await page.$eval('[data-products-certificate]',el=>el.textContent)).includes(limit));
  assert.equal(await page.$$eval('[data-products-certificate] figure',els=>els.length),0,'Unmeasured parameters are never plotted as zeros');await assertNoOverflow('Products certificate measured and missing');await capture(`school-products-certificate-${width}`,'[data-products-certificate]');

  await passage('products-traceability-2');await page.waitForSelector('[data-products-trace]');
  const documents=fixture.products.PRODUCTS_TRACE_DOCUMENTS,questions=fixture.products.PRODUCTS_TRACE_QUESTIONS;
  const traceActivity=fixture.products.PRODUCTS_LESSONS.find(lesson=>lesson.id==='products-traceability-2').activity.id;
  const chooseTrace=async(wrong=false)=>{for(const question of questions){await click(`[data-products-trace] input[name="products-trace-${question.id}"][value="${question.choices.find(choice=>choice.correct).id}"]`);await click(`[data-products-trace] input[name="products-trace-${question.id}-reason"][value="${question.reasons.find(reason=>wrong?!reason.correct:reason.correct).id}"]`);}};
  await chooseTrace(true);
  for(const document of documents.slice(0,-1)){await click(`[data-products-document="${document.id}"]`);await page.waitForSelector(`[data-products-document-detail="${document.id}"]`);assert((await page.$eval('[data-products-document-detail]',el=>el.textContent)).includes(document.text));}
  assert(await page.$eval('[data-products-trace]',el=>[...el.querySelectorAll('button')].find(button=>button.textContent.startsWith('Vérifier l’enquête')).disabled),'All four documents are required');
  await click(`[data-products-document="${documents.at(-1).id}"]`);await text('Vérifier l’enquête','[data-products-trace]');await page.waitForSelector('[data-products-trace-result="review"]');assert(!fixture.productsSnapshot.activityIds.includes(traceActivity));
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-products-trace-result="review"]');assert.equal(await page.$$eval('[data-products-trace] input:checked',els=>els.length),4);assert.equal(await page.$$eval('[data-products-document]',els=>els.filter(el=>el.textContent.includes('consulté')).length),4);
  await chooseTrace();await text('Vérifier l’enquête','[data-products-trace]');await page.waitForSelector('[data-products-trace-result="passed"]');await text('Enregistrer cette activité','[data-products-trace]');await page.waitForFunction(()=>document.querySelector('[data-products-trace]')?.textContent.includes('Activité enregistrée'));exercised.add(traceActivity);
  await assertNoOverflow('Products traceability draft and reasons');await capture(`school-products-trace-${width}`,'[data-products-trace]');assert.equal(fixture.snapshot.totalPaidCents,700,'All product tools and the lot investigation pay no currency');

  await passage('products-fibres-1');const buddyButton=await page.waitForFunction(()=>[...document.querySelectorAll('[data-curriculum-lesson="products-fibres-1"] button')].find(el=>el.checkVisibility()&&el.textContent.trim().endsWith('· lire la fiche')));await buddyButton.asElement().evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await buddyButton.asElement().click();await buddyButton.dispose();await page.waitForSelector('[data-buddie-collection-detail="HH2026-045"][open]');assert(await page.$eval('[data-buddie-collection-detail="HH2026-045"]',el=>el.textContent.includes('manque encore à ton album')),'The public Carmagnola record opens without card ownership');await page.keyboard.press('Escape');await page.waitForSelector('[data-curriculum-lesson="products-fibres-1"]');assert.equal(new URL(page.url()).searchParams.get('module'),'profiles');assert.equal(new URL(page.url()).searchParams.get('passage'),'products-fibres-1');

  const learningBefore=structuredClone(fixture.productsSnapshot);const ownerGuard=await page.evaluate(async()=>{const response=await fetch('/api/arena/placard/school/products',{method:'POST',headers:{'Content-Type':'application/json','X-Kq-School-Owner':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},body:JSON.stringify({lessonIds:['products-seeds-1'],checkpointIds:[],activityIds:[]})});return {status:response.status,body:await response.json()};});assert.equal(ownerGuard.status,409);assert.equal(ownerGuard.body.code,'school_owner_changed');assert.deepEqual(fixture.productsSnapshot,learningBefore);
  await passage('products-index');await text('Composer mon quiz');await page.waitForSelector('[data-school] input[type=radio]');const ids=[];
  for(let index=0;index<10;index++){const id=await page.$eval('[data-school] input[type=radio]',el=>el.name);ids.push(id);await click(`input[name="${id}"][value="${fixture.answers[id].correctOptionId}"]`);if(index===4){await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(`input[name="${id}"]:checked`);}if(index<9)await text('Suivante');}
  assert.equal(new Set(ids).size,10);assert.equal(new Set(ids.map(id=>fixture.products.PRODUCTS_QUESTIONS.find(question=>question.id===id).chapterId)).size,10);
  if(width===320)fixture.loseNext();await text('Valider mes réponses');
  if(width===320){await page.waitForFunction(()=>document.querySelector('[data-school]')?.textContent.includes('Connexion interrompue'));const sent=structuredClone(fixture.submissions.at(-1));await page.reload({waitUntil:'networkidle0'});await text('Réessayer la validation');await page.waitForSelector('[aria-label="Résultat du quiz"]');assert.deepEqual(fixture.submissions.at(-1),sent,'Quiz retry preserves key, selector and answers');}else await page.waitForSelector('[aria-label="Résultat du quiz"]');
  assert.equal(reward.rewardId,'school:profiles');assert.equal(reward.paidCents,1000);assert.equal(fixture.snapshot.totalPaidCents,1000);assert.equal(fixture.credits,1);assert.match(fixture.submissions.at(-1).selectionId,/^v1\./);assert.equal(await page.$$eval('[aria-label="Résultat du quiz"] dl>div',els=>parseFloat(els.find(el=>el.querySelector('dt')?.textContent==='Gain versé').querySelector('dd').textContent.replace(',','.'))),3);await capture(`school-products-result-${width}`);
  await click('[data-school-correction] summary');await click('[data-school-correction][open] details summary');assert.equal(await page.$$eval('[data-school-correction][open] details[open]>ul>li',els=>els.length),4);await text('Revoir ce passage','[data-school-correction][open]');await page.waitForSelector('[data-curriculum-lesson]');assert.equal(new URL(page.url()).searchParams.get('module'),'profiles');await assertNoOverflow('Products correction passage');
  assert.equal(fixture.productsSnapshot.activityIds.length,exercised.size);assert.equal(fixture.productsSnapshot.checkpointIds.length,1);for(const other of [fixture.historySnapshot,fixture.botanySnapshot,fixture.terpenesSnapshot,fixture.cannabinoidsSnapshot,fixture.cultivationSnapshot,fixture.healthSnapshot,fixture.soilSnapshot])assert.deepEqual(other.lessonIds,[]);
  results.push({scenario:'products-curriculum',width,chapters:10,lessons:20,exercises:exercised.size,activityDraft:true,wrongJustification:true,lostProgressRetry:true,plateHotspots:points.length,plateKeyboard:true,atlasEntries:atlas.length,atlasFilters:true,fibreStages:stages.length,fibreKeyboard:true,processCards:processes.length,labelClaims:claims.length,certificateMeasured:2,certificateNotMeasured:4,traceabilityInvestigation:true,unownedBuddyReturn:true,ownerGuard409:true,quizUniqueQuestions:10,quizChapters:10,optionCorrections:4,legacyRewardCents:700,simulatedGainCents:300,quizRetry:width===320});
 }
 assert.equal(await page.evaluate(async()=>(await fetch('/src/lib/kanab-quest-school-products-answers.ts?raw')).status),403);
}
