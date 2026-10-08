/** Real Next app, clean guest browser. All non-read network requests are blocked. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const origin = process.env.ARENA_AUDIT_ORIGIN || 'http://localhost:3000';
const output = resolve('output/arena-playable-learning', process.env.ARENA_AUDIT_RUN || 'integrated');
const allLessons = ['cards','equipment','culture','jury','market','collection','specialties','warehouse','missions','bank','investments','business','notebook'];
const lessons = process.env.ARENA_AUDIT_LESSONS?.split(',') || allLessons;
const hub = 'dialog[data-arena-learning][open]';
const lessonDialog = id => `dialog[data-playable-lesson="${id}"][open]`;
const card = id => `${hub} [data-learning-lesson="${id}"],${hub} [data-learning-workshop="${id}"],${hub} [data-learning-topic="${id}"]`;
const readiness = { equipment:'[data-arena-tour-surface="catalog"]',warehouse:'[data-arena-tour-surface="warehouse"] [data-warehouse-slot]',market:'[data-screen="lots"]',collection:'[data-pack-phase="idle"]',specialties:'dialog[data-chanvrier-profile][open]',missions:'[aria-label="Parcours des missions"]',notebook:'[data-tasting-book]',bank:'[data-treasury-tutorial="bank"] #bank-loans-title',investments:'[data-treasury-tutorial="investments"]',business:'[data-treasury-tutorial="business"]',cards:'main[data-playable-lesson] [data-culture-preparation]',culture:'main[data-playable-lesson] [data-culture-primary-action]',jury:'main[data-playable-lesson]' };
const report = { passed:false, origin, lessons:[], catalogue:[], apiDuringLesson:[], blockedWrites:[], runtimeErrors:[], failedChunks:[], warnings:[] };
let activeLesson = null;
await mkdir(output,{recursive:true});
const browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
const page = await browser.newPage();
page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(120000);
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
page.on('pageerror',error=>report.runtimeErrors.push({lesson:activeLesson,message:error.message}));
page.on('console',message=>{if(message.type()==='warn'&&/Image|fill|position/.test(message.text()))report.warnings.push({lesson:activeLesson,message:message.text()});});
page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/_next/')&&response.status()>=400)report.failedChunks.push({path:url.pathname,status:response.status()});});
await page.setRequestInterception(true);
page.on('request',request=>{
  const url = new URL(request.url());
  if(activeLesson&&url.pathname.startsWith('/api/'))report.apiDuringLesson.push({lesson:activeLesson,method:request.method(),path:url.pathname});
  if(!['GET','HEAD','OPTIONS'].includes(request.method())){report.blockedWrites.push({lesson:activeLesson,method:request.method(),path:url.pathname});return void request.abort();}
  void request.continue();
});

async function click(selector){
  await page.waitForSelector(selector,{visible:true});
  await page.$eval(selector,el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.click(selector);
}
async function button(text,scope=lessonDialog(activeLesson),exact=false){
  await page.waitForFunction(({text,scope,exact})=>[...document.querySelectorAll(scope+' button')].some(el=>el.checkVisibility()&&!el.disabled&&(exact?el.textContent.trim()===text:el.textContent.includes(text))),{}, {text,scope,exact});
  const handle = await page.evaluateHandle(({text,scope,exact})=>[...document.querySelectorAll(scope+' button')].find(el=>el.checkVisibility()&&!el.disabled&&(exact?el.textContent.trim()===text:el.textContent.includes(text))),{text,scope,exact});
  const element=handle.asElement();assert(element,`Button ${text}`);await element.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await element.click();await handle.dispose();
}
async function screenshot(name){await page.screenshot({path:resolve(output,name+'.png'),fullPage:false});}
async function coachCheck(id){
  await page.waitForSelector(`${lessonDialog(id)} [data-playable-coach]`,{visible:true});
  const result=await page.$eval(`${lessonDialog(id)} [data-playable-coach]`,el=>{const rect=el.getBoundingClientRect();const root=el.closest('dialog');return {visible:rect.width>0&&rect.top>=0&&rect.bottom<=innerHeight+1,topLayer:root?.open,buttons:[...el.querySelectorAll('button')].filter(b=>b.checkVisibility()).map(b=>b.getBoundingClientRect().height)};});
  assert(result.visible,`${id} coach within viewport`);assert(result.topLayer,`${id} coach in an open native dialog`);assert(result.buttons.every(height=>height>=43),`${id} coach touch targets`);
  return result;
}
async function closeLesson(id){
  await click(`${lessonDialog(id)} [data-playable-coach] button[aria-label="Quitter cet essai"]`);
  await page.waitForSelector(lessonDialog(id),{hidden:true});activeLesson=null;await page.waitForSelector(hub,{visible:true});
}
async function playOperations(id){
  if(id==='equipment'){
    await button('Ajouter',`${lessonDialog(id)} article:has(button[aria-label="Voir LED spéciale 300 W"])`);
    await click(`${lessonDialog(id)} button[aria-label^="Ouvrir le panier"]`);await button('Valider le panier');await button('Confirmer l’achat');
    await page.waitForSelector('[aria-labelledby="equipment-purchase-title"]');await button('Installer','[aria-labelledby="equipment-purchase-title"]');
    await click(`${lessonDialog(id)} [data-warehouse-slot="lighting"]`);await page.waitForSelector(`${lessonDialog(id)} select`);await page.select(`${lessonDialog(id)} select`,'LED-300');await button('Installer · tente');
  } else if(id==='warehouse'){
    await click(`${lessonDialog(id)} [data-warehouse-slot="lighting"]`);await button('Niveau 2 ·');await page.waitForSelector(`${lessonDialog(id)} [data-warehouse-slot="lighting"][aria-label*="niveau 2"]`);
  } else {
    await button('Transformer');await page.waitForSelector('[data-screen="preparation"]');await page.select('[data-screen="preparation"] select','dry-sift');await button('Transformer et continuer');
    await page.waitForSelector('dialog[aria-labelledby="commerce-confirm-title"][open]');await coachCheck(id);await screenshot('market-preparation-confirmation-390');
    await button('Confirmer','dialog[aria-labelledby="commerce-confirm-title"][open]');await page.waitForSelector('[data-screen="distribution"]');await button('Grossistes');await button('Vendre ce lot');
    await page.waitForSelector('dialog[aria-labelledby="commerce-confirm-title"][open]');await coachCheck(id);await button('Confirmer','dialog[aria-labelledby="commerce-confirm-title"][open]');await page.waitForSelector('[data-screen="receipt"]');
  }
  await page.waitForSelector(`${lessonDialog(id)} [data-playable-coach][data-complete="true"]`);
}
async function playDiscovery(id){
  if(id==='collection'){
    await button('Ouvrir le pack');await page.waitForSelector('[data-pack-phase="cards"]');await button('Tout révéler');await page.waitForSelector('[data-pack-phase="recap"]');await button('Ranger dans mon album');
    await page.waitForFunction(()=>document.querySelector('[data-playable-discovery="collection"]')?.textContent.includes('3 cartes'));
  } else if(id==='specialties'){
    await page.type('dialog[data-chanvrier-profile] input[autocomplete="nickname"]','ApprentiAudit');await button('Féminine');await button('Choisir ma force');await button('Bricoleur');await button('Créer mon chanvrier');
  } else if(id==='missions'){
    await button('Tous mes défis');await button('Récupérer mon pack');await button('Ouvrir mon pack',`${lessonDialog(id)} [data-mission-receipt]`);await page.waitForSelector('dialog[data-mission-pack-opening][open] [data-support-pack-reveal]');
    assert.equal(await page.$$eval('dialog[data-mission-pack-opening] [data-support-pack-reveal] article',cards=>cards.length),3);await page.waitForFunction(()=>[...document.querySelectorAll('dialog[data-mission-pack-opening] [data-support-pack-reveal] img')].every(img=>img.complete&&img.naturalWidth>0));await coachCheck(id);
    assert(await page.$('dialog[data-mission-pack-opening][open] [data-playable-coach]'),'Mission coach follows the native pack dialog');
    if(process.env.ARENA_AUDIT_EXITS){await click('button[aria-label="Fermer le pack ouvert"]');await button('Communauté');await button('Participer',`${lessonDialog(id)} article`);await page.waitForSelector('dialog[open] button[aria-label="Fermer la mission"]');await coachCheck(id);}
  } else if(id==='notebook'){
    const tasting=await page.evaluate(()=>[...document.querySelectorAll('button')].some(el=>el.checkVisibility()&&el.textContent.includes('Déguster cette fleur')));
    if(tasting)await button('Déguster cette fleur');
    else {await click('[aria-label="Ouvrir mon carnet de dégustation"]');await click('[data-culture="indoor"][data-track="regular"]');await click('[data-book-entry]');await button('Déguster cette fleur');}
    await page.waitForSelector('[aria-label="Étapes de notation"]');
    let evaluated=0;
    for(let index=1;index<=4;index++){
      await click(`[aria-label^="Étape ${index+1} :"]`);
      const ranges=await page.$$('input[type="range"]');
      for(const range of ranges){await range.focus();await page.keyboard.press('ArrowRight');assert.match(await range.evaluate(el=>el.getAttribute('aria-valuetext')||''),/sur 100/);evaluated++;}
    }
    assert.equal(evaluated,10,'All ten real notebook criteria evaluated');
    await page.type('textarea[aria-label="Critique rédigée"]','Notes fictives pour apprendre à remplir le carnet : aspect soigné, parfum agréable et sensation douce.');
    await button('Envoyer mon avis');await page.waitForSelector(`${lessonDialog(id)} [data-playable-coach][data-complete="true"]`);
    if(process.env.ARENA_AUDIT_EXITS){const links=await page.$$eval(`${lessonDialog(id)} [data-tasting-book] a[href]`,nodes=>nodes.map(node=>node.getAttribute('href')).filter(href=>href.startsWith('/')));assert.deepEqual(links,[],'Notebook lesson has no exit links to the live game');}
  }
}

async function playTreasury(id){
  if(id==='bank'){
    await button('Examiner le contrat');await page.waitForSelector('dialog[aria-labelledby="bank-contract-title"][open]');await coachCheck(id);await button('Signer et recevoir le capital');await page.waitForSelector('dialog[aria-labelledby="bank-contract-title"][open]',{hidden:true});
    await click('#bank-desk-savings');await page.waitForSelector('input[placeholder="Ex. 100,00"]');await page.type('input[placeholder="Ex. 100,00"]','100');await button('Déposer');
    await page.waitForFunction(()=>document.querySelector('input[placeholder="Ex. 100,00"]')?.value==='');await page.type('input[placeholder="Ex. 100,00"]','100');await button('Retirer');
  } else if(id==='investments'){
    await button('Acheter des parts');await page.waitForSelector('dialog[aria-labelledby="stock-order-title"][open]');await coachCheck(id);
    if(!process.env.ARENA_AUDIT_EXITS){await button('Préparer l’offre');await click('[data-stock-confirm]');await page.waitForSelector('dialog[aria-labelledby="stock-order-title"][open]',{hidden:true});}
  } else {
    await page.type('input[placeholder="Le nom de ta boutique"]','Boutique essai audit');await button('Créer mon site');await page.waitForSelector('dialog[aria-labelledby="treasury-management-title"][open]');await coachCheck(id);await button('Confirmer','dialog[aria-labelledby="treasury-management-title"][open]');await page.waitForSelector('dialog[aria-labelledby="treasury-management-title"][open]',{hidden:true});
  }
}

try{
  await page.setViewport({width:390,height:900});const response=await page.goto(origin+'/arene',{waitUntil:'networkidle2'});assert(response.status()<400);
  const decline=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(el=>/^(Tout refuser|Refuser|Continuer sans accepter)$/i.test(el.textContent.trim())&&el.checkVisibility()));if(decline.asElement())await decline.asElement().click();await decline.dispose();
  assert.equal(await page.$$eval('[data-arena-first-culture-entry],[data-arena-first-culture-trigger]',nodes=>nodes.length),0,'The retired first culture is absent');
  await click('[data-arena-discovery-entry] [data-arena-learning-trigger]');await page.waitForSelector(hub,{visible:true});
  assert.equal(await page.$$eval(`${hub} [data-learning-choice]`,nodes=>nodes.length),0,'No text quiz');
  for(const width of [320,390,1440]){
    await page.setViewport({width,height:900});const visibleCards=[];
    for(const group of ['game','explore']){await click(`${hub} [data-learning-group="${group}"]`);visibleCards.push(...await page.$$eval(`${hub} [data-learning-lesson]`,nodes=>nodes.map(node=>node.dataset.learningLesson)));const overflow=await page.$eval(hub,el=>el.scrollWidth-el.clientWidth);assert(overflow<=1);await screenshot(`catalogue-${group}-${width}`);}
    assert.deepEqual([...new Set(visibleCards)].sort(),[...allLessons].sort());report.catalogue.push({width,cards:visibleCards.length,overflow:0});
  }
  await page.setViewport({width:390,height:900});
  for(const id of lessons){
    await click(`${hub} [data-learning-group="${allLessons.indexOf(id)<5?'game':'explore'}"]`);activeLesson=id;await click(card(id));await page.waitForSelector(lessonDialog(id),{visible:true});if(readiness[id])await page.waitForSelector(`${lessonDialog(id)} ${readiness[id]}`,{visible:true});else await page.waitForFunction(selector=>!document.querySelector(selector)?.textContent.includes('Préparation de ton espace de jeu'),{},lessonDialog(id));
    const coach=await coachCheck(id);await screenshot(`${id}-390-before`);
    if(['equipment','warehouse','market'].includes(id))await playOperations(id);
    if(['collection','specialties','missions','notebook'].includes(id))await playDiscovery(id);
    if(['bank','investments','business'].includes(id))await playTreasury(id);
    if(id==='jury'){
      await button('Trouver un adversaire au hasard');await button('Lancer le verdict du jury');await button('Confirmer le verdict');
      await page.waitForSelector(`${lessonDialog(id)} [data-jury-personal-recap] [data-jury-analysis]`);
      await click(`${lessonDialog(id)} [data-jury-analysis-details]>summary`);await page.waitForSelector(`${lessonDialog(id)} [data-jury-analysis-details][open]`);await coachCheck(id);
    }
    await screenshot(`${id}-390-after`);const item={id,coach,apiCalls:report.apiDuringLesson.filter(row=>row.lesson===id)};report.lessons.push(item);assert.deepEqual(item.apiCalls,[],`${id}: no live API in lesson`);
    if(id==='notebook'&&process.env.ARENA_AUDIT_EXITS){await button('Les possibilités',`${lessonDialog(id)} [data-tasting-book]`);await page.waitForSelector(lessonDialog(id),{hidden:true});activeLesson=null;await page.waitForSelector(hub,{visible:true});}else await closeLesson(id);
  }
  await page.keyboard.press('Escape');await page.waitForSelector(hub,{hidden:true});
  if(process.env.ARENA_AUDIT_EXITS){
    const overflow=await page.evaluate(()=>({html:document.documentElement.style.overflow,body:document.body.style.overflow}));assert.notEqual(overflow.html,'hidden');assert.notEqual(overflow.body,'hidden');
    await page.evaluate(()=>scrollTo(0,0));await page.mouse.wheel({deltaY:400});await page.waitForFunction(()=>scrollY>100);report.returnScroll={...overflow,scrollY:await page.evaluate(()=>scrollY)};
  }
  assert.deepEqual(report.runtimeErrors,[]);assert.deepEqual(report.failedChunks,[]);assert.deepEqual(report.blockedWrites.filter(row=>row.path.startsWith('/api/')),[]);
  report.passed=true;
}catch(error){report.failure=error.stack;report.currentLesson=activeLesson;await screenshot('failure').catch(()=>undefined);report.visibleButtons=await page.$$eval('button',nodes=>nodes.filter(el=>el.checkVisibility()).map(el=>({text:el.textContent.trim(),label:el.getAttribute('aria-label'),disabled:el.disabled}))).catch(()=>[]);process.exitCode=1;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
