/** Real jury carousel, local fixtures. Confirmations open without submitting a duel. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/clarity-lot13/jury');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-ux-jury.mjs', 'utf8')).split('let browser,page;')[0];
assert(source.includes('const server=await createServer'));
source = source.replace("'output/ux-implementation/jury'", "'output/clarity-lot13/jury'").replace('??3270', '??3622')
  .replace("include:['react','react-dom/client'", "include:['react','react-dom','react-dom/client'")
  .replace('import {createKqCareState}', 'import {createKqCareState,getKqCannabinoidReport}')
  .replace('const session=()=>', 'const originalSession=()=>')
  .replace('    window.fetch=async', () => `
    const session=()=>{
      const base=originalSession();
      base.flowers[0].cannabinoidReport=getKqCannabinoidReport({varietyCode:flower.varietyCode,care:createKqCareState()});
      if(['multiple','target','refresh'].includes(state.mode))return {...base,flowers:Array.from({length:state.flowerCount??4},(_,i)=>({...base.flowers[0],id:'flower-'+i,varietyName:i===1?'Variété au nom particulièrement long pour vérifier la lisibilité sur petit écran':'Fleur de recette '+(i+1),quality:84-i,storage:state.mode==='refresh'&&i===3?undefined:base.flowers[0].storage}))};
      if(state.mode==='locked')return {...base,flowers:[{...base.flowers[0],status:'available'}],battles:[{...battle,id:'locked-target',status:'locked',winner:null,rounds:[],verdictAt:null}]};
      if(state.mode==='queued')return {...base,flowers:[{...base.flowers[0],status:'queued',queuedAt:new Date().toISOString()}]};
      if(state.mode==='empty')return {...base,flowers:[],battles:[battle]};
      return base;
    };
    window.fetch=async`)
  .replace('state.requests.push({path,method,time:performance.now()});', () => `
      const action=init.body?JSON.parse(init.body).action:null;
      state.requests.push({path,method,action,time:performance.now()});
      // Queue polling uses POST: stub it locally without matching a duel.
      if(method==='POST'&&action==='poll')return Response.json({matchStatus:'queued',flowerId:flower.id,queuedAt:new Date().toISOString()});
      if(method!=='GET')throw Error('Read-only fixture rejected '+method+' '+path);
      if(state.mode==='error'&&['/bootstrap','/session'].some(s=>path.endsWith(s)))return Response.json({error:'Lecture de la réserve indisponible'},{status:503});
      if(state.mode==='loading'&&path.endsWith('/bootstrap'))await new Promise(resolve=>{state.releaseLoading=resolve;});`)
  .replace('state.mode=mode;state.readsFail=false;', 'state.mode=mode;delete state.flowerCount;state.readsFail=false;')
  .replace("apiScope='player' showAdminOperations", "initialFlowerId={mode==='target'?'flower-2':undefined} apiScope='player' showAdminOperations")
  .replace('root.render(<KanabQuestDicePrototype key={++key}', 'root.render(<div key={++key} data-jury-fixture-mode={mode}><KanabQuestDicePrototype')
  .replace("onOpenMarket={()=>{document.body.dataset.navigated='market'}}/>);", "onOpenMarket={()=>{document.body.dataset.navigated='market'}}/></div>);");
source += String.raw`
let browser,page;const errors=[],external=[],checks=[];
const trackSelector='#placard-reserve [role="list"]';
const nextSelector='#placard-reserve button[aria-label^="Voir les cartes suivantes"]';
const previousSelector='#placard-reserve button[aria-label^="Voir les cartes précédentes"]';
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();else{external.push(request.url());void request.abort();}});
 const click=async selector=>{const handle=await page.waitForSelector(selector,{visible:true});await handle.evaluate(n=>n.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await handle.click();await handle.dispose();};
 const show=async(mode,ready=true)=>{await page.evaluate(mode=>window.__showJury(mode),mode);await page.waitForFunction(mode=>document.querySelector('[data-jury-fixture-mode]')?.dataset.juryFixtureMode===mode,{},mode);if(ready)await page.waitForFunction(()=>!!document.querySelector('[data-jury-flower-card]')&&!document.querySelector('[data-jury-loading]'));await page.evaluate(()=>document.fonts.ready);};
 const clean=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');assert.equal(await page.evaluate(()=>window.__jury.requests.some(r=>r.method!=='GET'&&r.action!=='poll')),false,'No game mutation');};
 const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));};
 const scrollPosition=()=>page.$eval(trackSelector,n=>n.scrollLeft);
 const cardVisible=async id=>page.$eval('[data-jury-flower-card="'+id+'"]',card=>{
  const r=card.getBoundingClientRect(),t=card.closest('[role="list"]').getBoundingClientRect();
  return card.checkVisibility()&&!card.closest('details:not([open])')&&r.width>140&&r.height>180&&r.left>=t.left-2&&r.right<=t.right+2;
 });
 const waitCard=async id=>{await page.waitForFunction(id=>{const card=document.querySelector('[data-jury-flower-card="'+id+'"]');if(!card)return false;const r=card.closest('[role="listitem"]').getBoundingClientRect(),t=card.closest('[role="list"]').getBoundingClientRect();return r.left>=t.left-2&&r.right<=t.right+2;},{},id);const samples=await page.$eval(trackSelector,node=>new Promise(resolve=>{let previous=node.scrollLeft,stable=0;const samples=[];const timer=setInterval(()=>{const current=node.scrollLeft;samples.push(current);stable=Math.abs(current-previous)<.1?stable+1:0;previous=current;if(stable>=6||samples.length>=50){clearInterval(timer);resolve(samples);}},30);}));assert(samples.length<50,'Carousel settles: '+samples.join(','));};
 const confirm=async(id,kind)=>{
  const selector='[data-culture-'+kind+'-flower="'+id+'"]';
  await page.focus(selector);await page.keyboard.press('Enter');await page.waitForSelector(kind==='ranked'?'#random-queue-title':'#remote-battle-title');
  assert.equal(await page.$eval('[data-jury-confirm-flower]',n=>n.dataset.juryConfirmFlower),id,'Confirmation uses the selected Flower');
  assert.match(await page.$eval('[data-jury-stock-consequence]',n=>n.textContent),/stock récolté.*conservé/);
  const dialog=await page.$eval('dialog[open]',n=>({overflow:n.scrollWidth>n.clientWidth+1,close:n.querySelector('header button').getBoundingClientRect().top>=0}));assert(!dialog.overflow&&dialog.close,'Confirmation fits and can be closed');
  await close();assert.equal(await page.$eval(selector,n=>document.activeElement===n),true,'Dialog restores exact action focus');await clean();
 };
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector('[data-jury-flower-card]');await page.evaluate(()=>document.fonts.ready);
  const initial=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
   return {ranked:rect('[data-culture-ranked-flower]'),training:rect('[data-culture-training-flower]'),card:rect('[data-jury-flower-card]'),detailsOpen:document.querySelector('[data-jury-flower-details]').open,copy:document.getElementById('jury-flower-use-flower-demo').textContent};
  });
  assert(initial.ranked.height>=44&&initial.training.height>=44);assert(!initial.detailsOpen);assert(await cardVisible('flower-demo'),'The real card is visible before opening analyses');assert(initial.card.top<844,'Card appears in the first viewport');assert.match(initial.copy,/consommée au verdict/);assert.match(initial.copy,/stock récolté est conservé/);
  assert(await page.$$eval('[data-jury-flower-details] > summary, #placard-reserve > details > summary, [data-jury-season] > summary',nodes=>nodes.every(n=>getComputedStyle(n).flexDirection==='row'&&n.querySelector('svg'))),'Disclosure arrows stay beside their labels');
  assert.equal(await page.$eval(trackSelector,n=>n.getAttribute('aria-label')),'Fleurs d’Arène en réserve');
  assert.equal(await page.$$eval('#placard-reserve nav button',nodes=>nodes.every(n=>n.disabled)),true,'Single card has no active paging control');
  await page.screenshot({path:resolve(output,'decisions-'+width+'.png')});await clean();checks.push({width,case:'initial',...initial});
  await page.focus('#placard-flower-flower-demo');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cultureRankedFlower),'flower-demo');
  await confirm('flower-demo','ranked');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cultureTrainingFlower),'flower-demo');await confirm('flower-demo','training');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.parentElement.dataset.juryFlowerDetails),'flower-demo');await page.keyboard.press('Enter');assert.equal(await page.$eval('[data-jury-flower-details]',n=>n.open),true);assert(await cardVisible('flower-demo'));await clean();
  await click('[data-cannabinoid-report] > summary');assert.equal(await page.$eval('[data-cannabinoid-report]',n=>n.open),true);await clean();
  await page.screenshot({path:resolve(output,'card-expanded-'+width+'.png'),fullPage:true});checks.push({width,case:'keyboard',rankedThenTrainingThenDetails:true,confirmExactFlower:true,focusRestored:true,analysisAccessible:true});
  for(const mode of ['curing','unknown','locked','queued']){
   await show(mode);assert(await cardVisible('flower-demo'));assert.equal(await page.$('[data-culture-ranked-flower]'),null);assert.equal(await page.$('[data-culture-training-flower]'),null);
   if(mode==='locked'){await click('[data-culture-follow-duel]');await page.waitForFunction(()=>document.activeElement?.dataset.battleId==='locked-target');}
   else if(mode==='queued'){assert.match(await page.$eval('#placard-flower-flower-demo',n=>n.textContent),/Recherche en cours/);assert.match(await page.$eval('#placard-flower-flower-demo button',n=>n.textContent),/Retirer de la file/);}
   else{if(mode==='curing')assert.equal(await page.$eval('[role="meter"]',n=>n.getAttribute('aria-valuenow')),'50');else assert.match(await page.$eval('[data-culture-curing]',n=>n.textContent),/à vérifier/);await click('[data-culture-open-storage]');assert.equal(await page.evaluate(()=>document.body.dataset.navigated),'storage:flower-demo');}
   await clean();checks.push({width,case:mode,noPrematureDuel:true,cardVisible:true});
  }
  await show('multiple');assert.equal(await page.$$eval('[data-jury-flower-card]',n=>n.length),4);assert.equal(await page.$$eval('[data-jury-flower-details][open]',n=>n.length),0);assert(await cardVisible('flower-0'));
  const names=await page.$$eval('[id^="jury-flower-name-"]',nodes=>nodes.map(n=>({overflow:n.scrollWidth>n.clientWidth+1,text:n.textContent})));assert(names.every(n=>!n.overflow));
  assert.equal(await page.$eval(previousSelector,n=>n.disabled),true);await click(nextSelector);await waitCard('flower-1');assert((await scrollPosition())>0,'Next arrow changes slide');assert(await cardVisible('flower-1'));
  await page.screenshot({path:resolve(output,'multiple-'+width+'.png'),fullPage:true});await confirm('flower-1','ranked');await confirm('flower-1','training');
  await page.focus(trackSelector);await page.keyboard.press('ArrowRight');await waitCard('flower-2');await page.keyboard.press('ArrowLeft');await waitCard('flower-1');await clean();checks.push({width,case:'multiple',flowers:4,longNameWraps:true,arrowsAndKeyboard:true,exactSecondFlower:true});
  await click(previousSelector);await waitCard('flower-0');
  // Move over artwork itself so a drag cannot accidentally open a duel.
  await page.$eval('[data-jury-flower-card="flower-0"]',n=>n.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  const gesture=await page.$eval('[data-jury-flower-card="flower-0"]',n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width*.82,y:Math.min(innerHeight-30,Math.max(30,r.top+r.height*.45)),distance:Math.min(210,r.width*.72)};});
  if(width<700){
   const cdp=await page.createCDPSession();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gesture.x,y:gesture.y}]});
   for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:gesture.x-gesture.distance*i/12,y:gesture.y}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   await page.waitForFunction(selector=>document.querySelector(selector).scrollLeft>20,{},trackSelector);await waitCard('flower-1');
  }else{
   await click(nextSelector);await waitCard('flower-1');await page.$eval('[data-jury-flower-card="flower-1"]',n=>n.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
   const drag=await page.$eval('[data-jury-flower-card="flower-1"]',n=>{const r=n.getBoundingClientRect(),t=n.closest('[role="list"]').getBoundingClientRect();return {x:r.left+30,y:r.top+r.height*.4,endX:Math.min(innerWidth-30,r.left+t.width*.72)};});
   await page.mouse.move(drag.x,drag.y);await page.mouse.down();await page.mouse.move(drag.endX,drag.y,{steps:20});await page.mouse.up();await waitCard('flower-0');
  }
  assert.equal(await page.$('dialog[open]'),null);await clean();checks.push({width,case:width<700?'touch-swipe':'mouse-drag',scrolls:true,noDuelOpened:true});
  await show('target');await page.waitForFunction(()=>document.activeElement?.id==='placard-flower-flower-2');await waitCard('flower-2');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cultureRankedFlower),'flower-2');await confirm('flower-2','ranked');await clean();checks.push({width,case:'target',exactThirdFlower:true,cardVisible:true});
  await show('empty',false);await page.waitForFunction(()=>!document.querySelector('[data-jury-loading]')&&document.querySelector('#placard-reserve')?.textContent.includes('Aucune Fleur'));assert.equal(await page.$('[data-jury-flower-card]'),null);await click('[data-archived-jury-recap] > summary');assert.equal(await page.$eval('[data-archived-jury-recap]',n=>n.open),true);await clean();checks.push({width,case:'empty',historyAccessible:true});
  await show('loading',false);await page.waitForSelector('[data-jury-loading][role="status"]');assert.equal(await page.$('[data-jury-flower-card]'),null);await clean();await page.evaluate(()=>window.__jury.releaseLoading());await page.waitForSelector('[data-jury-flower-card]');checks.push({width,case:'loading',noFalseEmptyState:true});
  await show('error',false);await page.waitForSelector('[data-jury-loading][role="alert"]');assert.equal(await page.$('[data-jury-flower-card]'),null);assert.match(await page.$eval('[data-jury-loading]',n=>n.textContent),/indisponible/);await page.evaluate(()=>{window.__jury.mode='success';});await click('[data-jury-loading] button');await page.waitForSelector('[data-jury-flower-card]');await clean();checks.push({width,case:'error',retryRestoresReserve:true});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await show('multiple');await click(nextSelector);await waitCard('flower-1');const still=await scrollPosition();await new Promise(resolve=>setTimeout(resolve,700));assert.equal(await scrollPosition(),still,'Carousel never advances automatically');await clean();checks.push({width:390,case:'reduced-motion',navigationWorks:true,noAutoplay:true});
 await show('refresh');await click(nextSelector);await waitCard('flower-1');await page.evaluate(()=>{window.__jury.flowerCount=3;window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>document.querySelectorAll('[data-jury-flower-card]').length===3);await waitCard('flower-1');assert.equal(await page.$eval('#placard-reserve nav [role="status"]',n=>n.getAttribute('aria-label')),'Carte 2 sur 3');await clean();checks.push({width:390,case:'count-refresh',selectedFlowerPreserved:true,counterUpdated:true});
 await page.setViewport({width:320,height:568,isMobile:true,hasTouch:true});await show('success');await confirm('flower-demo','training');await clean();checks.push({width:320,height:568,case:'short-screen',confirmationAccessible:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({checks:checks.length,errors,external}));
}catch(error){if(page){await page.screenshot({path:resolve(output,'failure.png')});await writeFile(resolve(output,'failure.json'),JSON.stringify({message:error.message,layout:await page.evaluate(()=>({focus:document.activeElement?.outerHTML,track:[...document.querySelectorAll('#placard-reserve [role="list"]')].map(n=>({left:n.scrollLeft,width:n.clientWidth,children:[...n.children].map(c=>({id:c.id,left:c.offsetLeft}))}))})),text:await page.evaluate(()=>document.body.innerText),requests:await page.evaluate(()=>window.__jury?.requests)},null,2));}throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external},null,2));if(browser)await browser.close();await server.close();}
`;
const runtime=resolve(output,'run.mjs');
await writeFile(runtime,source);
await import(pathToFileURL(runtime).href);
