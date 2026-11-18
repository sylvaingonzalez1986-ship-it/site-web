/** Real guide + navigation, confirmed DOM/API fixtures; no live account or writes. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

let source = (await readFile('scripts/audit-bank-clarity-lot27.mjs', 'utf8')).replaceAll('\r\n', '\n');
source = source.replace('`output/clarity-lot27/${before ? \'before\' : \'after\'}`', "'output/tutorial'")
  .replace('process.env.BANK_CLARITY_LOT27_PORT ?? 3597', 'process.env.TUTORIAL_AUDIT_PORT ?? 3601')
  .replace('Actual bank UI; valid local snapshots and original command validator; no live writes.', 'Actual KqFarmGuide and navigation; DOM confirmation fixtures and authenticated API response shapes; no live game actions.')
  .replace('focus:document.activeElement?.outerHTML', 'focus:document.activeElement?.outerHTML.slice(0,500)')
  .replace('Image({src,fill,priority,fetchPriority,', 'Image({src,fill,priority,preload,fetchPriority,')
  .replace('Banque · recette locale', 'Tutoriel · recette locale');

const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqFarmGuide} from '/src/components/placard/KqFarmGuide';
import {KqPlacardNavigation} from '/src/components/placard/KqPlacardNavigation';
import {KqSupportPackOpening} from '/src/components/placard/KqSupportPackOpening';
import {KqStaffHandbook} from '/src/components/placard/KqStaffHandbook';
import {FARM_GUIDE_STEPS,emptyFarmProgress} from '/src/lib/kanab-quest-farm-progress';
import {KQ_FARM_GUIDE_OPEN_EVENT,KQ_FARM_GUIDE_KEY} from '/src/lib/kanab-quest-farm-guide';
import retro from '/src/components/contest/ArenaRetro.module.css';
import shell from '/src/components/placard/PlacardPlayerShell.module.css';
const params=new URLSearchParams(location.search),owner=params.get('owner')||'tutorial-player';
window.__calls=[];window.__navigation=[];window.__clicks=0;window.__resumeMode=params.get('scenario')||'empty';
window.__guideSteps=FARM_GUIDE_STEPS.map(step=>({id:step.id,chapter:step.chapter,objectiveKind:step.objectiveKind}));window.__key=KQ_FARM_GUIDE_KEY+':'+owner;
window.__resume=()=>window.dispatchEvent(new Event(KQ_FARM_GUIDE_OPEN_EVENT));
const harvest={id:'flower-1',runId:'run-1',status:'available',storage:{stage:'curing',capacity:{totalUnits:100,protectedUnits:100,overflowUnits:0}},trim:{status:'in-progress',totalGrams:10,completedGrams:4}};
window.fetch=async(input,init={})=>{const path=new URL(String(input),location.origin).pathname,method=init.method||'GET';window.__calls.push({path,method});
 if(method!=='GET'||!['/api/arena/placard/runs','/api/arena/placard/flowers'].includes(path))throw Error('Unexpected tutorial request '+method+' '+path);
 if(window.__resumeMode==='failure')return Response.json({error:'Confirmation indisponible'},{status:503});
 if(path.endsWith('/runs'))return Response.json({activeRun:null,activeRuns:[]});
 return Response.json({flowers:window.__resumeMode==='past'?[harvest]:[]});
};
if(params.get('storage')==='blocked')Object.defineProperty(window,'localStorage',{get(){throw Error('Storage unavailable');}});
function App(){
 const [destination,setDestination]=React.useState({view:params.get('view')||'hub',...(params.get('section')?{section:params.get('section')}:{}),...(params.get('pole')?{pole:params.get('pole')}:{} )});
 const [fixture,setFixture]=React.useState({error:false,zone:false,assigned:false,observation:null,harvest:false,curing:false,trim:null,jury:false,sale:false,receipts:false,packOpen:false,packConfirmed:false,staffReady:false});
 const [staffTab,setStaffTab]=React.useState('planning');
 const [active,setActive]=React.useState(false);
 const navigate=React.useCallback(next=>{const target=typeof next==='string'?{view:next}:next;window.__navigation.push(target);setDestination(target);},[]);
 const changed=React.useCallback((value,started,completed)=>{setActive(value);window.__active={active:value,started,completed};},[]);
 window.__fixture=next=>setFixture(current=>({...current,...next}));window.__navigate=navigate;
 if(params.has('setup'))return <p>Préparation des données locales</p>;
 return <div className={retro.gameSurface+' '+shell.shell} data-placard-view={destination.view}>
  <KqPlacardNavigation active={destination.view==='collection'?'shop':destination.view} onNavigate={navigate} onHighlight={()=>{}}/>
  <div className={shell.content} id="placard-content"><header className={shell.sectionHeader}><h1 tabIndex={-1}>Ferme de recette · {destination.view}</h1></header>
   <KqFarmGuide ownerId={owner} initialOpen={!params.has('closed')} destination={destination} onNavigate={navigate} onActiveChange={changed}/>
   <section data-placard-stage={destination.view} style={{padding:16,minHeight:220}}>
    <p data-test-active>{active?'Guide actif':'Guide suspendu'}</p>
    {fixture.error?<p role="alert">La confirmation a échoué. Réessaie sans recommencer la dépense.</p>:null}
    {destination.view==='hub'?<div data-placard-next-action><button data-map-building="warehouse" onClick={()=>navigate('workshop')}>Ouvrir l’entrepôt</button></div>:null}
    {destination.view==='staff'?<div data-staff-desk data-guide-employee-count="0" data-guide-staff-ready={fixture.staffReady}>
     <div role="tablist" aria-label="Personnel"><button role="tab" data-staff-tab="overview" aria-selected={staffTab==='overview'} onClick={()=>setStaffTab('overview')}>Bilan</button><button role="tab" data-staff-tab="planning" aria-selected={staffTab==='planning'} onClick={()=>setStaffTab('planning')}>Planning</button></div>
     <div hidden={staffTab!=='overview'} inert={staffTab!=='overview'}><KqStaffHandbook/></div>
     {staffTab==='planning'?<p>Aucun salarié recruté.</p>:null}
    </div>:null}
    {destination.view==='workshop'?<div data-warehouse-map data-warehouse-draft={!fixture.zone||undefined} data-guide-saved-zone-count={fixture.zone?1:undefined} data-guide-assigned-zone-count={fixture.assigned?1:undefined}><p>Plan de l’entrepôt · zone de culture</p><button data-test-save data-warehouse-plan-review onClick={()=>window.__clicks++}>Vérifier et enregistrer le plan</button></div>:null}
    {fixture.observation?<p data-tutorial-observation={fixture.observation}>Information chargée et examinée : {fixture.observation}</p>:null}
    {fixture.harvest?<p data-guide-harvest-confirmed="true" data-guide-flower-id="flower-1">Récolte confirmée</p>:null}
    {fixture.curing?<article data-storage-inventory data-conservation-lot="flower-1" data-guide-flower-id="flower-1" data-guide-lot-protected="true" data-guide-curing-ready="false">Lot suivi · affinage en cours</article>:null}
    {fixture.trim?<p data-guide-trim-flower-id="flower-1" data-guide-trim-state={fixture.trim}>Préparation du lot : {fixture.trim}</p>:null}
    {fixture.jury?<p data-guide-jury-verdict="true" data-guide-flower-id="flower-1">Verdict confirmé</p>:null}
    {fixture.sale?<p data-guide-sale-confirmed="true" data-guide-flower-id="flower-1">Reçu confirmé</p>:null}
    {fixture.receipts?<p data-guide-pack-opened="true" data-guide-card-played="true" data-guide-school-answered="true">Reçus du jeu : pack ouvert, carte jouée et réponse enregistrée</p>:null}
    {fixture.packOpen?<KqSupportPackOpening confirmed={fixture.packConfirmed} cards={[{code:'BOTTE-005',name:'Carte du pack',rarity:'common'}]} cardCount={1} busy={false} error="" canRetry={false} onRetry={()=>{}} onClose={()=>setFixture(current=>({...current,packOpen:false}))} onContinue={()=>setFixture(current=>({...current,packOpen:false}))} continueLabel="Retour à la ferme"/>:null}
   </section>
  </div>
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
const entryStart = source.indexOf('const entry = `'), entryEnd = source.indexOf('const modules=', entryStart);
assert.ok(entryStart > 0 && entryEnd > entryStart);
source = source.slice(0, entryStart) + 'const entry = ' + JSON.stringify(entry) + ';\n' + source.slice(entryEnd);
const start = source.indexOf(' const frames='), end = source.indexOf(' assert.deepEqual(errors,[])', start);
assert.ok(start > 0 && end > start);
const checks = `
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const storage=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(window.__key)||'null'));
 const base=()=>({version:2,active:true,started:true,collapsed:false,completed:[]});
 async function open(progress=null,query=''){
  await page.goto(origin+'/?setup=1',{waitUntil:'networkidle0'});
  await page.evaluate(progress=>{localStorage.clear();sessionStorage.clear();if(progress!==null)localStorage.setItem('kq:farm-guide:v1:tutorial-player',typeof progress==='string'?progress:JSON.stringify(progress));},progress);
  await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-farm-guide-anchor]');await page.evaluate(()=>document.fonts.ready);await frames();
 }
 async function enter(selector){const handle=await page.$(selector);assert.ok(handle,'Control exists: '+selector);await handle.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await handle.focus();await page.keyboard.press('Enter');await frames();}
 async function byText(label){const handle=await page.evaluateHandle(label=>[...document.querySelectorAll('button')].find(el=>el.checkVisibility()&&el.textContent.includes(label)),label);assert.ok(await handle.evaluate(el=>!!el),'Visible button: '+label);await handle.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await handle.asElement().focus();await page.keyboard.press('Enter');await frames();}
 async function chapters(){if(!await page.$('dialog[data-tutorial-chapters][open]')){const trigger=await page.evaluateHandle(()=>[...document.querySelectorAll('[data-tutorial-library-trigger]')].find(el=>el.checkVisibility()));await trigger.asElement().focus();await page.keyboard.press('Enter');await page.waitForSelector('dialog[data-tutorial-chapters][open]');await frames();}}
 async function headingVisible(){await frames();const state=await page.$eval('[data-farm-guide] button[aria-controls]',el=>({focused:el===document.activeElement,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,headerBottom:document.querySelector('#placard-content > header')?.getBoundingClientRect().bottom??0}));assert.equal(state.focused,true,'Chapter selection restores focus to its guide heading');assert.ok(state.top>=Math.max(0,state.headerBottom)-1&&state.bottom<=page.viewport().height,'New objective is visible below the sticky header');}
 async function choose(id){await chapters();await enter('[data-tutorial-select="'+id+'"]');await page.waitForFunction(id=>document.querySelector('[data-farm-guide]')?.getAttribute('data-guide-step')===id,{},id);await headingVisible();}
 async function confirmed(id){await page.waitForFunction(id=>JSON.parse(localStorage.getItem(window.__key)||'null')?.completed.includes(id),{},id);}
 async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow');}
 async function shot(name){await page.evaluate(()=>Promise.allSettled([...document.images].map(img=>img.decode())));await page.screenshot({path:resolve(output,name+'.png')});}
 for(const width of [320,1440]){
  await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});
  await open({...base(),selectedStepId:'staff-week',completed:['staff-candidate','staff-planning','staff-development','staff-payroll','staff-prospecting','personal-work']},'view=staff');
  await page.waitForSelector('[data-staff-tab=overview][data-farm-guide-target]');assert.equal(await page.$('[data-tutorial-waiting]'),null,'No employee is required to discover the weekly plan');
  await enter('[data-staff-tab=overview]');await page.waitForSelector('[data-staff-guide=week] > summary[data-farm-guide-target]');await frames();assert.ok(!(await storage()).completed.includes('staff-week'),'The closed handbook is not completion');
  await enter('[data-staff-guide=week] > summary');assert.ok(!(await storage()).completed.includes('staff-week'),'Loading staff data does not complete the lesson');
  await page.evaluate(()=>window.__fixture({staffReady:true,error:true}));await frames();assert.ok(!(await storage()).completed.includes('staff-week'),'An error keeps the lesson pending');
  await enter('[data-staff-guide=week] > summary');await page.evaluate(()=>window.__fixture({error:false}));await frames();assert.ok(!(await storage()).completed.includes('staff-week'),'Ready data alone does not complete a closed lesson');
  await shot('staff-week-before-hiring-'+width);await enter('[data-staff-guide=week] > summary');await confirmed('staff-week');await noOverflow();await shot('staff-week-learned-'+width);
  assert.equal(await page.$eval('[data-staff-desk]',el=>el.dataset.guideEmployeeCount),'0');assert.ok((await page.evaluate(()=>window.__calls)).every(call=>call.method==='GET'),'Learning the weekly rules never hires or spends');
  await page.reload({waitUntil:'networkidle0'});assert.ok((await storage()).completed.includes('staff-week'),'Existing progress stays completed after reload');results.push({scenario:'weekly planning discovery before any hire, useful open/read, error/loading guards and persistence',width});
  await open();await page.waitForSelector('[data-farm-guide]');await noOverflow();assert.deepEqual((await storage()).completed,[],'The initial map view alone proves nothing');assert.equal(await page.$('[data-tutorial-chapters]'),null,'The full curriculum is not rendered in the game page');await shot('start-'+width);
  const stageTop=()=>page.$eval('[data-placard-stage]',el=>el.getBoundingClientRect().top+scrollY);
  const beforeLibrary=await stageTop();await chapters();assert.ok(Math.abs(await stageTop()-beforeLibrary)<2,'Opening all chapters does not push the game down');
  const libraryScroll=await page.$eval('[data-tutorial-chapters] [data-app-dialog-body]',el=>{el.scrollTop=el.scrollHeight;return{scroll:el.scrollTop,height:el.clientHeight,total:el.scrollHeight};});assert.ok(libraryScroll.scroll>0&&libraryScroll.height<libraryScroll.total,'The library scrolls inside its own bounded body');
  assert.ok(await page.$eval('[aria-label="Fermer les chapitres"]',el=>{const rect=el.getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight;}),'Close remains visible at the bottom of the list');await noOverflow();await shot('library-scroll-'+width);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-tutorial-chapters]'));assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-tutorial-library-trigger')),true,'Escape restores focus to the opener');assert.ok(Math.abs(await stageTop()-beforeLibrary)<2);
  await enter('[data-farm-guide] button[aria-controls]');assert.equal((await storage()).collapsed,true);const compactTop=await stageTop();await chapters();assert.ok(Math.abs(await stageTop()-compactTop)<2,'Browsing chapters preserves compact mode');await page.goBack();await page.waitForFunction(()=>!document.querySelector('[data-tutorial-chapters]'));assert.equal((await storage()).collapsed,true);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-farm-guide]');assert.equal(await page.$('[data-tutorial-chapters]'),null,'Reload never reopens the chapter list');await enter('[data-farm-guide] button[aria-controls]');results.push({scenario:'chapters only on demand, independent scroll, Escape/Back focus and no game displacement',width});
  await enter('[data-map-building="warehouse"]');await confirmed('welcome');assert.ok(!(await storage()).completed.includes('zone'),'Navigation did not save a zone');
  await enter('[data-test-save]');assert.ok(!(await storage()).completed.includes('zone'),'Click without successful response is not completion');
  await page.evaluate(()=>window.__fixture({zone:true,error:true}));await frames();assert.ok(!(await storage()).completed.includes('zone'),'An error prevents apparent snapshot success');await shot('failed-confirmation-'+width);
  await page.evaluate(()=>window.__fixture({error:false}));await confirmed('zone');await noOverflow();results.push({scenario:'navigation and click need real confirmation; error then recovery',width});
  await enter('[data-farm-guide-close]');await page.waitForFunction(()=>!document.querySelector('[data-farm-guide]'));assert.equal((await storage()).active,false);
  await page.reload({waitUntil:'networkidle0'});await frames();assert.equal(await page.$('[data-farm-guide]'),null,'Saved pause wins over initialOpen');
  if(width<700){await enter('button[aria-label="Plus d’activités"]');await page.waitForSelector('dialog[open]');await enter('dialog[open] [data-arena-learning-trigger]');}
  else await enter('aside [data-arena-learning-trigger]');
  await page.waitForSelector('[data-farm-guide]');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal((await storage()).active,true);assert.ok((await storage()).completed.includes('zone'));assert.equal(await page.$('[data-tutorial-chapters]'),null,'Resuming from Tutoriel shows only the current objective');await noOverflow();await shot('resumed-objective-'+width);results.push({scenario:'pause reload and real permanent navigation launcher',width});
  const waiting={...base(),completed:['welcome','zone','assign','launch','roll','resolve','harvest','store','trim'],flowerId:'flower-1',selectedStepId:'cure'};
  await open(waiting,'view=harvests&section=storage');await page.evaluate(()=>window.__fixture({curing:true}));await page.waitForSelector('[data-tutorial-waiting]');assert.match(await page.$eval('[data-tutorial-waiting]',el=>el.innerText),/En attente/);
  await choose('bank');assert.ok(!(await storage()).completed.includes('bank'),'Opening a banking destination alone is not a useful observation');
  await page.evaluate(()=>window.__fixture({observation:'bank'}));await confirmed('bank');assert.ok(!(await storage()).completed.includes('cure'));await noOverflow();results.push({scenario:'another independent chapter while curing waits',width});
  const acquired=await storage();await chapters();const warehouseGoal=await page.$('[data-tutorial-select="zone"]');
  if(warehouseGoal)await enter('[data-tutorial-select="zone"]');else{await enter('[data-tutorial-chapter="warehouse"] details > summary');await byText('Enregistrer une zone de culture');}
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem(window.__key)).replayStepId==='zone');await headingVisible();assert.match(await page.$eval('[data-farm-story-line]',el=>el.innerText),/sans répéter une opération/);const replayed=await storage();assert.ok(acquired.completed.every(id=>replayed.completed.includes(id)),'Replay preserves all acquired objectives');const actionIds=await page.evaluate(()=>window.__guideSteps.filter(step=>step.objectiveKind==='action').map(step=>step.id));assert.deepEqual(replayed.completed.filter(id=>actionIds.includes(id)),acquired.completed.filter(id=>actionIds.includes(id)),'Replay never invents a new game transaction');await noOverflow();await shot('replay-'+width);results.push({scenario:'replay preserves earned progress and requires no expense',width,headingFocusVisible:true});
 }
 await open(base(),'scenario=failure');await page.waitForFunction(()=>document.body.textContent.includes('Réessayer la vérification'));assert.deepEqual((await storage()).completed,[]);await page.evaluate(()=>window.__resumeMode='past');await byText('Réessayer la vérification');await confirmed('harvest');const reconciled=await storage();assert.ok(reconciled.completed.includes('launch')&&reconciled.completed.includes('roll')&&reconciled.completed.includes('resolve'));assert.ok(!reconciled.completed.includes('trim')&&!reconciled.completed.includes('cure')&&!reconciled.completed.includes('jury')&&!reconciled.completed.includes('sale'));results.push({scenario:'resume GET failure then confirmed past harvest, no synthetic verdict or sale'});
 await open(base());await page.evaluate(()=>window.__fixture({observation:'pack-open'}));await frames();assert.ok(!(await storage()).completed.includes('pack-open'),'A visit marker cannot complete a transaction');await page.evaluate(()=>window.__fixture({receipts:true,error:true}));await frames();for(const id of ['pack-open','card-play','school-answer'])assert.ok(!(await storage()).completed.includes(id));await page.evaluate(()=>window.__fixture({error:false}));for(const id of ['pack-open','card-play','school-answer'])await confirmed(id);results.push({scenario:'pack, card and answer require confirmed results and reject visit/error shortcuts'});
 await open(base());await page.evaluate(()=>window.__fixture({packOpen:true}));await page.waitForSelector('dialog[open] [data-farm-guide]');await frames();assert.ok(!(await storage()).completed.includes('pack-open'),'Real pack preview without confirmed prop does not complete opening');await page.evaluate(()=>window.__fixture({packConfirmed:true}));await confirmed('pack-open');await enter('button[aria-label="Fermer le pack ouvert"]');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.ok(await page.$('[data-farm-guide]'));results.push({scenario:'real pack preview remains pending until explicit receipt; modal guide portal survives closing'});
 for(const saved of ['{"version":99,"future":"preserve me"}','{broken']){await open(saved);await page.evaluate(()=>window.__resume());await page.waitForSelector('[data-farm-guide]');await enter('[data-farm-guide-close]');await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$('[data-farm-guide]'),null);assert.equal(await page.evaluate(()=>localStorage.getItem(window.__key)),saved);results.push({scenario:'future or corrupt save kept intact while a separate pause survives reload',saved});}
 await open(null,'storage=blocked');await page.waitForSelector('[data-farm-guide]');assert.match(await page.$eval('[data-farm-guide]',el=>el.innerText),/ne peut pas être enregistrée/);await enter('[data-farm-guide-close]');await page.waitForFunction(()=>!document.querySelector('[data-farm-guide]'));await page.evaluate(()=>window.__resume());await page.waitForSelector('[data-farm-guide]');results.push({scenario:'blocked localStorage reports limitation; pause and resume still work in memory'});
 await page.setViewport({width:320,height:900,isMobile:true,hasTouch:true});
 for(const lesson of ['bank','collection']){await open(base());const earned=await storage();await chapters();await enter('[data-tutorial-practice-menu] > summary');await enter('[data-tutorial-practice="'+lesson+'"]');await page.waitForSelector('dialog[data-playable-lesson="'+lesson+'"][open]');await page.waitForSelector('[data-releve-finish-lesson]');await frames();assert.deepEqual((await storage()).completed,earned.completed,'Practice cannot validate the live tutorial');assert.equal(await page.$('[data-farm-guide-target]'),null,'Live highlighting stops during practice');await shot('practice-'+lesson+'-320');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[data-playable-lesson][open]'));await frames();assert.deepEqual((await storage()).completed,earned.completed,'Leaving practice preserves live progress');assert.ok((await page.evaluate(()=>window.__calls)).every(call=>call.method==='GET'));await noOverflow();results.push({scenario:'real isolated practice opens and exits by Escape without live progress or mutations',lesson,width:320});}
 assert.ok((await page.evaluate(()=>window.__calls)).every(call=>call.method==='GET'),'Tutorial never sends economic commands');
`;
source = source.slice(0, start) + checks + source.slice(end);
await mkdir('output/tutorial', { recursive: true });
const file = resolve('output/tutorial/browser.mjs');
await writeFile(file, source);
await import(pathToFileURL(file).href);
