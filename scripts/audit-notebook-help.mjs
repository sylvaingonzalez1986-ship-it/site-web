/** Real notebook + isolated tasting lesson. Synthetic data only; all account API calls are recorded. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, process.argv.find(value => value.startsWith('--output='))?.slice(9) ?? 'output/notebook-help');
const widths=(process.argv.find(value=>value.startsWith('--widths='))?.slice(9)??'320,390,1440').split(',').map(Number);
const port = Number(process.argv.find(value => value.startsWith('--port='))?.slice(7) ?? 3274);
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'warehouse-manifest': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')}`,
  fixture: `import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
    import{ContestTastingBook}from'/src/components/contest/ContestTastingBook';
    import{ARENA_RELEVE_MEETINGS}from'/src/lib/arena-releve';
    window.__meetings=ARENA_RELEVE_MEETINGS;
    const entry={id:'real-flower',slug:'real-flower',title:'La fleur de mon carnet',productId:'real-product',seasonId:'season',track:'regular',category:'indoor',story:'Une fleur du carnet personnel.',technicalSheet:{genetics:'Sélection bretonne',soil:'Terre vivante'},producer:{id:'producer',name:'Le jardin de Sylvain',region:'Bretagne'},imageUrl:'/product_flower.jpg',galleryUrls:[],isPublished:true,position:0,createdAt:'2026-10-18',updatedAt:'2026-10-18',stats:{approvedReviewCount:0,averageScore:0,criterionAverages:{},consumptionCounts:{}}};
    createRoot(document.getElementById('root')).render(React.createElement(ContestTastingBook,{entries:[entry],unlocks:[{entryId:entry.id,unlockedAt:'2026-10-18'}],viewerProfile:{pseudo:'Mon vrai carnet',createdAt:'2026-10-18',updatedAt:'2026-10-18'},badges:[],isAuthenticated:true,draftOwnerId:'notebook-help-owner',seasonLabel:'Les dégustations de l’Arène · Saison 2026',initialTrack:'regular',initialCategory:'indoor'}));`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from'react';export default function dynamic(load,options={}){const C=React.lazy(async()=>{const m=await load();return{default:m.default||m}});return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props))}}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:href=>history.replaceState(history.state,'',href),refresh:()=>{window.__refreshes=(window.__refreshes||0)+1}});`,
};
const fonts = `
@font-face{font-family:GameBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:400 700}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Bold.woff2);font-weight:700}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2);font-weight:800}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}
@font-face{font-family:GameHandwritten;src:url(/src/app/fonts/Caveat-Latin-Bold.woff2);font-weight:700}
:root{--font-body:GameBody;--font-display:GameDisplay;--font-handwritten:GameHandwritten}body{margin:0;font-family:var(--font-body),sans-serif}`;
const server = await createServer({
  configFile:false, envDir:false, root, publicDir:resolve(root,'public'), cacheDir:resolve(output,'vite-cache'),
  esbuild:{jsx:'automatic'}, resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react','@3d-dice/dice-box-threejs','gsap']},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'notebook-help-audit',enforce:'pre',
    resolveId(id){if(id.endsWith('warehouse-v2/manifest.json'))return '\0warehouse-manifest';if(id in modules)return '\0'+id},
    load(id){if(id.startsWith('\0'))return modules[id.slice(1)]},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/arene/carnet/regular')return next();
      res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>${fonts}</style><div class="site-background"><header>Navigation du site</header><main><div id="root"></div></main></div><script type="module" src="/@id/__x00__fixture"></script></html>`);
    })},
  }],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});
let browser,page;
const errors=[],consoleErrors=[],api=[],results=[],steps=[];
const criteria=['appearance','manicure','drying_curing','cold_aroma','aroma_intensity','aroma_complexity','flavor','smoothness_burn','persistence','overall_impression'];
const lessonScope='dialog[open][data-playable-lesson="notebook"]';
const lessonSelector=selector=>`${lessonScope} ${selector}`;
const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,350)));
const draftKey='contest-notebook-draft:v2:notebook-help-owner:real-flower';
const draft=JSON.stringify({version:2,ownerId:'notebook-help-owner',entryId:'real-flower',comment:'Mes notes personnelles doivent rester intactes.',savedAt:123456});
async function geometry(){return{configuredViewport:page.viewport(),dom:await page.evaluate(()=>{
  const target=document.querySelector('dialog[open] [data-releve-guide-active]');
  const inspect=element=>element?{tag:element.tagName,class:element.className,rect:element.getBoundingClientRect().toJSON(),scrollTop:element.scrollTop,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight,overflow:getComputedStyle(element).overflowY}:null;
  const ancestors=[];for(let parent=target;parent;parent=parent.parentElement)ancestors.push(inspect(parent));
  const rect=target?.getBoundingClientRect();
  return{time:performance.now(),innerWidth,innerHeight,visualViewport:{width:visualViewport.width,height:visualViewport.height},activeStep:target?.getAttribute('data-releve-guide-active'),activeElement:inspect(document.activeElement),target:inspect(target),hit:rect?inspect(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)):null,spotlight:inspect(document.querySelector('dialog[open] [data-releve-spotlight]')),viewport:inspect(target?.closest('[data-tasting-scroll]')),footer:inspect(target?.closest('[data-notebook-page]')?.querySelector('[data-notebook-footer]')),ancestors};
})}}
async function snapshot(name){
  const before=name.includes('submit')?await geometry():null;
  // The Carnet fills the fixed viewport. DevTools full-page capture can change
  // nested scroll offsets while composing the image, so capture the real UI.
  await settle();await page.screenshot({path:resolve(output,`${name}.png`),fullPage:false});
  if(before){const after=await geometry();await settle();const settled=await geometry();await writeFile(resolve(output,`${name}-geometry.json`),JSON.stringify({before,after,settled},null,2))}
}
async function closedLayout(){
  await page.waitForSelector('[data-notebook-help]',{visible:true});
  await page.evaluate(()=>document.fonts.ready);
  const layout=await page.evaluate(()=>{
    const cover=document.querySelector('button[aria-label="Ouvrir mon carnet de dégustation"]');
    const help=document.querySelector('[data-notebook-help]');
    const cr=cover.getBoundingClientRect(),hr=help.getBoundingClientRect();
    const visible=r=>r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;
    const hit=document.elementFromPoint(hr.left+hr.width/2,hr.top+hr.height/2);
    return{width:innerWidth,height:innerHeight,coverVisible:visible(cr),helpVisible:visible(hr),helpClickable:help===hit||help.contains(hit),separate:hr.top>=cr.bottom||cr.top>=hr.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1,open:document.querySelector('[data-tasting-book]').hasAttribute('data-open'),helpText:help.textContent.trim()};
  });
  assert(layout.coverVisible&&layout.helpVisible&&layout.helpClickable&&layout.separate,JSON.stringify(layout));
  assert(!layout.overflow&&!layout.open,JSON.stringify(layout));
  assert.equal(layout.helpText,'Comment faire ?');return layout;
}
async function assertRestored(url){
  await page.waitForFunction(()=>!document.querySelector('dialog[open][data-playable-lesson="notebook"]'));
  await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-notebook-help'));
  assert.equal(page.url(),url,'Tutorial must leave real notebook URL unchanged');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),draft,'Personal draft must be untouched');
  await closedLayout();
}
async function openHelp(){
  await page.click('[data-notebook-help]');
  await page.waitForSelector('dialog[open][data-playable-lesson="notebook"] [data-tasting-book]',{visible:true,timeout:60000});
  assert.equal(await page.$$eval('dialog[open] [data-notebook-help]',nodes=>nodes.length),0,'No recursive help button in lesson');
  await page.waitForSelector('[data-releve-guide-active]',{visible:true});
}
async function guide(){
  await page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] [data-releve-guide-active]')].some(el=>el.getClientRects().length&&!el.closest(':disabled,[aria-disabled=true]')),{timeout:15000});
  await page.waitForFunction(()=>{
    const target=document.querySelector('dialog[open] [data-releve-guide-active]');if(!target)return false;
    const r=target.getBoundingClientRect(),key=[r.x,r.y,r.width,r.height].map(Math.round).join(',');
    if(window.__guideStable?.key!==key){window.__guideStable={key,at:performance.now()};return false}return performance.now()-window.__guideStable.at>180;
  },{timeout:4000});
  await page.waitForFunction(()=>{
    const target=document.querySelector('dialog[open] [data-releve-guide-active]'),spotlight=document.querySelector('dialog[open] [data-releve-spotlight]');
    if(!target||!spotlight)return false;
    const t=target.getBoundingClientRect(),s=spotlight.getBoundingClientRect(),x=t.x+t.width/2,y=t.y+t.height/2;
    return x>=s.left&&x<=s.right&&y>=s.top&&y<=s.bottom;
  },{timeout:4000});
  const g=await page.evaluate(()=>{
    const target=document.querySelector('dialog[open] [data-releve-guide-active]');
    const coach=document.querySelector('dialog[open] [data-releve-guide-card]');
    const r=target.getBoundingClientRect(),c=coach.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    const overlap=Math.max(0,Math.min(r.right,c.right)-Math.max(r.left,c.left))*Math.max(0,Math.min(r.bottom,c.bottom)-Math.max(r.top,c.top));
    const acknowledge=coach.querySelector('[data-releve-acknowledge]');
    return{id:target.getAttribute('data-releve-guide-active'),tag:target.tagName,type:target.getAttribute('type'),label:target.getAttribute('aria-label')||target.textContent?.trim(),instruction:coach.querySelector('[role="status"]')?.textContent?.trim(),title:[...coach.querySelectorAll('strong')].map(node=>node.textContent.trim()).join(' · '),acknowledge:!!acknowledge,ready:acknowledge?!acknowledge.disabled:null,native:!!target.closest('[data-tasting-book]')||!!target.closest('[data-releve-guide-card]'),visible:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,clickable:target===hit||target.contains(hit),coachClear:coach.contains(target)||overlap<1};
  });
  for(const key of ['native','visible','clickable','coachClear'])assert(g[key],`${key}: ${JSON.stringify(g)}`);
  return g;
}
async function physicalClick(selector){
  const button=await page.$(lessonSelector(selector));assert(button,`Missing native control: ${selector}`);
  await page.waitForFunction(selector=>{const element=document.querySelector(selector);if(!element)return false;const r=element.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return element===top||element.contains(top)},{timeout:2000},lessonSelector(selector)).catch(()=>{throw new Error(`Native control remains covered: ${selector}`)});
  await button.click();await button.dispose();
}
async function sameCheckpoint(id){
  await settle();
  assert.equal(await page.$eval(lessonSelector('[data-releve-guide-card]'),element=>element.dataset.guideStep),id,`Interacting must not skip the explanation for ${id}`);
}
async function fillNative(selector,text){
  const input=await page.$(lessonSelector(selector));assert(input,`Missing native field: ${selector}`);
  await input.click({clickCount:3});await page.keyboard.down('Control');await page.keyboard.press('a');await page.keyboard.up('Control');await input.type(text);await page.keyboard.press('Tab');await input.dispose();
}
async function assertFreeExploration(id){
  await physicalClick('button[aria-label="Explorer librement"]');
  await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-releve-guide-active]'));
  await physicalClick('button[aria-label="Reprendre le guidage"]');
  await page.waitForFunction(id=>document.querySelector('dialog[open] [data-releve-guide-card]')?.getAttribute('data-guide-step')===id,{},id);
  return true;
}
async function advanceExpected(id,{confirm=false}={}){
  const current=await guide();assert.equal(current.id,`notebook:${id}`);
  if(id==='mode')await physicalClick('[data-notebook-method="joint_no_tobacco"]');
  else if(id.startsWith('score-')&&id!=='score-scale'){
    const criterion=id.slice('score-'.length);
    if(confirm)await physicalClick(`[data-notebook-criterion="${criterion}"] button[aria-label^="Confirmer "]`);
    else{await page.focus(lessonSelector(`[data-notebook-criterion="${criterion}"] input[type="range"]`));await page.keyboard.press('ArrowRight');await page.keyboard.press('Tab')}
  }
  await sameCheckpoint(current.id);
  if(current.acknowledge){await page.waitForSelector(lessonSelector('[data-releve-acknowledge]:not(:disabled)'));await physicalClick('[data-releve-acknowledge]')}
  else await physicalClick('[data-releve-guide-active]');
}
async function exploreAndResume(nativeActions){
  await physicalClick('button[aria-label="Explorer librement"]');
  await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-releve-guide-active]'));
  for(const selector of nativeActions){
    const control=await page.waitForSelector(lessonSelector(selector),{visible:true});
    await control.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await settle();await physicalClick(selector);
  }
  await physicalClick('button[aria-label="Reprendre le guidage"]');
}
async function exerciseNavigationRecovery(){
  for(const id of ['taste','mode','mode-details','next-page-1','score-scale','score-appearance','score-manicure'])await advanceExpected(id,{confirm:id==='score-manicure'});
  assert.equal((await guide()).id,'notebook:score-drying_curing');
  const values=()=>page.$$eval(lessonSelector('[data-notebook-criterion] input[type="range"]'),nodes=>nodes.map(node=>node.value));
  const before=await values();
  await exploreAndResume(['[data-notebook-page-link="0"]']);
  assert.equal((await guide()).id,'notebook:next-page-1','Returning a page must return the player to the pending lesson');
  await physicalClick('[data-releve-guide-active]');assert.equal((await guide()).id,'notebook:score-drying_curing');
  assert.deepEqual(await values(),before,'Native previous-page navigation must preserve scored values');
  await exploreAndResume(['button[aria-label="Table des matières"]','button[data-track="regular"][data-culture="outdoor"]']);
  const recovery=[];
  for(let count=0;count<7;count++){
    const current=await guide();recovery.push(current.id);
    if(current.id==='notebook:score-drying_curing')break;
    assert(!current.acknowledge,'Chapter recovery should navigate rather than repeat an acknowledged field');
    await physicalClick('[data-releve-guide-active]');await settle();
  }
  assert.equal(recovery.at(-1),'notebook:score-drying_curing','Guide must recover from an empty chapter to the pending field');
  assert.deepEqual(await values(),before,'Leaving the flower must preserve previously scored values');
  await snapshot('recovered-empty-chapter-1440');
  await physicalClick('button[aria-label="Recommencer cet essai"]');
  await advanceExpected('taste');const reset=await guide();assert.equal(reset.id,'notebook:mode');assert.equal(reset.ready,false,'Restart resets explicit mode confirmation and acknowledged lessons');
  assert.equal(await page.$eval(lessonSelector('[data-notebook-method="vaporizer"]'),node=>node.getAttribute('aria-pressed')),'true','Restart resets the native form');
  await physicalClick('[data-releve-finish-lesson]');
  return{nativeConfirmation:true,previousPagePreservesScores:true,emptyChapterRecovery:recovery,restartResetsLesson:true};
}
async function finishLesson(width){
  let actions=0,freeExploration=false,responsiveSubmit=false;
  const visited=[],scoreExplanations=[],teachingActions=[];
  for(let i=0;i<85;i++){
    const g=await guide();steps.push({width,...g});visited.push(g.id);console.log(`${width}px ${i+1}. ${g.id} ${g.title}`);
    assert.notEqual(g.id,'notebook:contents','Loading the native tasting page must not send the player back to the contents');
    if(g.id==='notebook:complete'){
      assert.deepEqual(scoreExplanations.map(item=>item.criterion),criteria,'Every scoring line must be taught in native page order');
      assert.equal(new Set(scoreExplanations.map(item=>item.instruction)).size,criteria.length,'Criteria need specific, distinct explanations');
      assert.equal(new Set(scoreExplanations.map(item=>item.title)).size,criteria.length,'Each scoring line needs its own visible title');
      for(const id of ['mode','mode-details','score-scale','aromas','aromas-multiple','other-aroma','other-aroma-detail','aromas-review','profile','comment','recap'])assert(visited.includes(`notebook:${id}`),`Missing tutorial checkpoint: ${id}`);
      assert(teachingActions.every(item=>item.manualAdvance),'Every teaching checkpoint must wait for the player to continue');
      await snapshot(`lesson-complete-${width}`);await physicalClick('[data-releve-guide-active]');
      return{actions:actions+1,checkpoints:visited.length,scoreExplanations,teachingActions,freeExploration,responsiveSubmit};
    }
    if(i===0||['notebook:mode','notebook:aromas-multiple','notebook:other-aroma-detail','notebook:score-flavor','notebook:comment','notebook:recap'].includes(g.id))await snapshot(`lesson-${i}-${g.id.split(':')[1]}-${width}`);
    if(g.id==='notebook:mode'){
      assert(g.acknowledge&&!g.ready,'An initially selected mode must still require an explicit choice');
      if(!freeExploration){freeExploration=await assertFreeExploration(g.id);await guide()}
      await physicalClick('[data-releve-guide-active]');actions++;
      await sameCheckpoint(g.id);
      const selected=await page.$$eval(lessonSelector('[data-notebook-method][aria-pressed="true"]'),nodes=>nodes.map(node=>node.dataset.notebookMethod));
      assert.equal(selected.length,1,'The consumption mode is a single choice');
    }else if(g.id==='notebook:mode-details'){
      assert(g.ready,'Mode details must remain optional');
      await fillNative('input[aria-label="Précisions sur ton mode de dégustation"]','Matériel fictif pour découvrir le carnet.');actions++;
      await sameCheckpoint(g.id);
    }else if(g.id.startsWith('notebook:score-')&&g.id!=='notebook:score-scale'){
      const criterion=g.id.slice('notebook:score-'.length);assert(criteria.includes(criterion),`Unknown criterion: ${criterion}`);
      assert(g.acknowledge&&!g.ready,`${criterion}: unevaluated defaults must not count as a score`);
      assert(g.instruction.length>85,`${criterion}: explain what is assessed, not only how to move the slider`);
      scoreExplanations.push({criterion,title:g.title,instruction:g.instruction});
      const input=await page.$(lessonSelector(`[data-notebook-criterion="${criterion}"] input[type="range"]`));assert(input,`Missing real slider for ${criterion}`);
      await input.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Tab');await input.dispose();actions++;
      await sameCheckpoint(g.id);
    }else if(['notebook:aromas','notebook:aromas-multiple','notebook:other-aroma'].includes(g.id)){
      assert(g.acknowledge&&!g.ready,`${g.id} must teach an explicit checkbox action`);
      await physicalClick('[data-releve-guide-active]');actions++;await sameCheckpoint(g.id);
      const selected=await page.$$eval(lessonSelector('[data-notebook-aroma]:checked'),nodes=>nodes.map(node=>node.dataset.notebookAroma));
      if(g.id==='notebook:aromas')assert(selected.includes('citrus'),'First checkbox should select Agrumes');
      if(g.id==='notebook:aromas-multiple')assert(selected.includes('citrus')&&selected.includes('floral'),'A second checkbox must preserve the first family');
      if(g.id==='notebook:other-aroma')assert(selected.includes('other'),'Other family reveals a native description field');
    }else if(g.id==='notebook:other-aroma-detail'){
      assert(!g.ready,'Other aroma needs an example before continuing the teaching step');
      await fillNative('[data-notebook-other-aroma]','Notes de thé fictives');actions++;await sameCheckpoint(g.id);
    }else if(g.id==='notebook:aromas-review'){
      const selected=await page.$$eval(lessonSelector('[data-notebook-aroma]:checked'),nodes=>nodes.map(node=>node.dataset.notebookAroma));
      assert(selected.includes('citrus')&&selected.includes('floral')&&selected.includes('other'),'Review must retain each taught checkbox choice');
    }else if(g.id==='notebook:comment'){
      await fillNative('[data-notebook-comment]','Fiche fictive : aspect soigné, agrumes et floral, nuance de thé, goût doux et persistant.');actions++;await sameCheckpoint(g.id);
    }else if(g.id==='notebook:submit'){
      if(width===1440){
        await page.setViewport({width:800,height:600,deviceScaleFactor:1});assert.equal((await guide()).id,g.id,'Shrinking the real window must keep the submit control reachable');
        await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});assert.equal((await guide()).id,g.id,'Restoring the real window must keep the submit control reachable');
        responsiveSubmit=true;
      }
      await snapshot(`lesson-submit-${width}`);
    }
    if(g.acknowledge){
      await sameCheckpoint(g.id);
      await page.waitForSelector(lessonSelector('[data-releve-acknowledge]:not(:disabled)'),{visible:true});
      await physicalClick('[data-releve-acknowledge]');actions++;
      teachingActions.push({id:g.id,manualAdvance:true});
    }else{
      await physicalClick('[data-releve-guide-active]');actions++;
    }
    await page.waitForFunction(id=>document.querySelector('dialog[open] [data-releve-guide-card]')?.getAttribute('data-guide-step')!==id,{timeout:15000},g.id);
  }
  throw new Error('The guided tasting failed to complete within 85 checkpoints');
}
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await page.setRequestInterception(true);page.on('request',request=>{
    const url=new URL(request.url());if(url.pathname.startsWith('/api/')){api.push({method:request.method(),url:url.pathname});void request.respond({status:200,contentType:'application/json',body:'{"campaigns":[],"availableEntitlements":[],"collection":{"cards":[]}}'});return}
    if(url.protocol==='data:'||url.origin===origin)void request.continue();else void request.abort();
  });
  for(const width of widths){
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1});
    await page.goto(`${origin}/arene/carnet/regular?season=2026&source=notebook-help-audit`,{waitUntil:'networkidle0'});
    await page.evaluate(({key,value})=>{localStorage.clear();localStorage.setItem(key,value)},{key:draftKey,value:draft});
    const layout=await closedLayout();await snapshot(`cover-${width}`);const url=page.url();
    const meeting=await page.evaluate(()=>window.__meetings.find(item=>item.id==='notebook'));
    assert.deepEqual(meeting.lessons,['collection'],'Game meeting should offer only the card album');
    assert(!/dégustation|fiche fictive|carnet de dégustation/i.test(JSON.stringify(meeting)),'Tasting tutorial must be absent from game meeting');
    await openHelp();await guide();await snapshot(`help-${width}`);
    await page.click('dialog[open] [data-releve-finish-lesson]');
    await assertRestored(url);
    await openHelp();
    // Focus the lesson's exit before Escape so it tests modal dismissal, not
    // the native book's separate Escape action for turning back a page.
    await page.focus('dialog[open] [data-releve-finish-lesson]');
    await page.keyboard.press('Escape');await assertRestored(url);
    let navigation=null;if(width===1440&&!process.argv.includes('--skip-navigation')){await openHelp();navigation=await exerciseNavigationRecovery();await assertRestored(url)}
    await openHelp();const lesson=await finishLesson(width);await assertRestored(url);
    results.push({width,layout,returnButton:true,escape:true,focusRestored:true,personalDraftUnchanged:true,urlUnchanged:true,collectionOnlyMeeting:true,navigation,lesson});
  }
  assert.deepEqual(api,[],'Tutorial must never contact account APIs');assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  const report={passed:true,results,steps,api,errors,consoleErrors};await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,results:results.map(result=>({width:result.width,checkpoints:result.lesson.checkpoints,actions:result.lesson.actions,navigation:result.navigation})),api:api.length,errors,consoleErrors},null,2));
}catch(error){
  if(page){
    await writeFile(resolve(output,'failure-geometry.json'),JSON.stringify(await geometry().catch(()=>null),null,2));await snapshot('failure').catch(()=>{});await writeFile(resolve(output,'failure.html'),await page.content()).catch(()=>{});
  }
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:false,message:String(error),results,steps,api,errors,consoleErrors},null,2));throw error;
}finally{await browser?.close();await server.close()}
