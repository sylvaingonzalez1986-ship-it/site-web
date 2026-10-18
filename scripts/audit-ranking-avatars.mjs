/** Actual ranking UI and portrait assets with independent category fixtures. No backend writes. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/ranking-categories');
const modules = {
  'ranking-preview.tsx': `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {ContestTesterLeaderboard} from '/src/components/contest/ContestHubClient';
    createRoot(document.getElementById('root')).render(<main style={{padding:12,maxWidth:900,margin:'auto'}}><ContestTesterLeaderboard seasonItems={[]} globalItems={[]} profileTrack="regular" viewerPseudo="Camille"/></main>);
  `,
  'preview-cart': `import {buildEmptyLoyaltySummary} from '/src/lib/loyalty';const loyalty=buildEmptyLoyaltySummary();loyalty.currentBadge={...loyalty.badges[2],unlocked:true};export const useCart=()=>({user:location.search.includes('guest')?null:{id:'preview-user',firstName:'Camille',email:'player@example.test',contestBetaEnabled:true},loyalty,totalItems:Number(new URLSearchParams(location.search).get('count')??3),hasWelcomePack:true,sessionLoading:false,authLoading:false});`,
  'preview-pages': `export const useCmsPages=()=>({pages:location.search.includes('long')?Array.from({length:5},(_,i)=>({slug:'page-'+i,title:'Une histoire de chanvre et de producteurs '+i,navLabel:'',showInNav:true,position:i})):[]});`,
  'preview-store': `export const useCmsStore=()=>({store:{content:{profile:{}}}});`,
  'preview-drawer': `import React from 'react';export function CartDrawer({open,onClose}){return open?React.createElement('div',{role:'dialog','data-cart-preview':true},React.createElement('button',{onClick:onClose},'Fermer le panier')):null}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) {return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}`,
  'preview-navigation': `export const NavigationPending=()=>null; export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/navigation': `export const usePathname=()=>location.search.includes('inner')?'/boutique':location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),define:{'process.env.NEXT_PUBLIC_CONTEST_BETA_ACCESS_ENABLED':'"false"'},optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
  name:'isolated-rankings',enforce:'pre',
  resolveId(id){if(id.endsWith('/navigation/NavigationFeedback')||id==='./NavigationFeedback')return '\0preview-navigation';if(id.endsWith('/hooks/useCmsPages'))return '\0preview-pages';if(id.endsWith('/hooks/useCmsStore'))return '\0preview-store';if(id.endsWith('/components/CartDrawer'))return '\0preview-drawer';if(id.endsWith('/context/CartContext'))return '\0preview-cart';if(id in modules)return '\0'+id;},
  async load(id){if(id==='\0ranking-preview.tsx')return ts.transpileModule(modules['ranking-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Classements et avatars</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__ranking-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port:3224,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});

let browser; const errors=[]; let failPortraits=false;
const behavior = { failedCategory: null, delayedCategory: null, delay: 0, paginated: false, failedNextPage: false, generation: 1 };
const requests=[];
const pendingResponses=new Set();
const avatars=[{gender:'male',clothing:'teal',skin:'honey',appearance:{hair:'quiff',hairColor:'ginger',accessory:'glasses'}},{gender:'female',clothing:'berry',skin:'brown',appearance:{hair:'braids',hairColor:'pink',accessory:'earrings'}},null];
const entries=Array.from({length:10},(_,i)=>({entryKey:`player-${i}`,rank:i+1,pseudo:i===0?'Camille':i===1?'UnPseudoTresLongDe24Chars':'Cultivateur'+(i+1),avatar:avatars[i%3],score:1549-i*10.1,notebookScore:1000,placardScore:439.2,businessScore:109.8,tastedFlowerCount:10,duelSeasonPoints:1000,cultivatedAreaM2:100,seasonRevenueHt:10000,rating:1250,seasonPoints:1000,reputation:600,wins:12,losses:3,totalPoints:1000,approvedReviewCount:10,level:{label:'Connaisseur'}}));
const categoryEntries={
  general:entries,
  tasting:entries.map((entry,i)=>({...entry,pseudo:i===0?'Camille':'Testeur'+(i+1),score:1000-i*100,totalPoints:1000-i*100,tastedFlowerCount:10-i})),
  tastingGlobal:entries.map((entry,i)=>({...entry,pseudo:i===0?'Camille':'Global'+(i+1),score:2000-i*100,totalPoints:2000-i*100,tastedFlowerCount:20-i})),
  duels:entries.map((entry,i)=>({...entry,pseudo:i===0?'Dueliste':'Duelliste'+(i+1),score:701.1-i*10.1})),
  business:entries.map((entry,i)=>({...entry,pseudo:i===0?'EntrepriseSansDuel':'Entreprise'+(i+1),score:426.5-i*10.1,wins:0,losses:0,rating:900})),
};
const rewardPool={seasonCode:'2026-10',status:'active',contributionRateBps:100,poolGrams:100,wholePoolGrams:100,carriedGrams:0,currentWeekGrams:10,weeklyDice:{startsOn:'2026-10-12',endsOn:'2026-10-18',rollCount:1,average:3,rateBps:400,eligibleFlowerGrams:250,contributionGrams:10},startsAt:null,endsAt:null,updatedAt:'2026-10-18T10:00:00Z',minimumHumanBattles:3,eligiblePlayers:10,milestone:{previousGrams:0,nextGrams:200,progressPercent:50},topRewards:[{entryKey:'player-0',leaderboardRank:1,rewardRank:1,pseudo:'Camille',shareBps:2700,estimatedGrams:27}],surpriseReward:{shareBps:1000,estimatedGrams:10,eligiblePlayers:0,oneChancePerCustomer:true}};
const board='[data-arena-ranking-board]';
const rowSelector=`${board} ol > li > :is(a,div)`;
const modes=['general','tasting','duels','business'];
const expectedLabels=['Général','Dégustation','Duels','Entreprise'];
const summary=[];
const selectMode=async(page,mode)=>page.$$eval('[aria-label="Type de classement"] button',(buttons,index)=>buttons[index].click(),modes.indexOf(mode));
const ready=async(page,mode)=>{
  const first=categoryEntries[mode][0];
  await page.waitForFunction((selector,pseudo,score)=>{
    const rows=document.querySelectorAll(selector);
    return rows.length===10&&rows[0].children[2].textContent.includes(pseudo)&&rows[0].children[3].querySelector('strong').textContent===score;
  },{},rowSelector,first.pseudo,first.score.toLocaleString('fr-FR',{maximumFractionDigits:1}));
};
const recordPot=async page=>page.evaluate(()=>{window.__rankingPot=document.querySelector('h2').closest('section');});
const assertPot=async page=>assert(await page.evaluate(()=>window.__rankingPot===document.querySelector('h2').closest('section')&&window.__rankingPot.isConnected),'reward pot stays mounted');
try {
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());
    if(failPortraits&&url.pathname.startsWith('/contest/avatars/')){void request.abort();}
    else if(url.pathname.startsWith('/api/')){
      const requestedCategory=url.pathname.includes('/testers/rankings')?'tasting':url.pathname==='/api/arena/rankings'?url.searchParams.get('category')??'general':null;
      const category=requestedCategory==='tasting'&&url.searchParams.get('scope')==='global'?'tastingGlobal':requestedCategory;
      const offset=Number(url.searchParams.get('offset')??0);
      const fails=Boolean(category&&(category===behavior.failedCategory||(behavior.failedNextPage&&offset>0)));
      const allEntries=behavior.paginated&&category?Array.from({length:186},(_,i)=>({...categoryEntries[category][i%10],entryKey:`player-${i}`,rank:i+1,pseudo:i===185?'Camille':`Joueur${i+1}`,score:2500-i*10.1,avatar:null})):category?categoryEntries[category]:[];
      const pageEntries=behavior.paginated?allEntries.slice(offset,offset+Number(url.searchParams.get('limit')??50)):allEntries;
      const body=category?fails?{error:'unavailable'}:{formulaVersion:'arena-v3-tasting-first',revision:`revision-${behavior.generation}`,generatedAt:`2026-10-18T10:0${behavior.generation}:00Z`,category:requestedCategory,scope:url.searchParams.get('scope')??'season',entries:pageEntries,items:pageEntries,totalPlayers:allEntries.length,hasMore:offset+pageEntries.length<allEntries.length,nextOffset:offset+pageEntries.length<allEntries.length?offset+pageEntries.length:null,viewerEntry:allEntries.find(entry=>entry.pseudo==='Camille')??null}:url.pathname==='/api/arena/rewards'?rewardPool:{eligible:false,viewerRoll:null};
      requests.push({path:url.pathname,category,offset});
      const response=(async()=>{if(category&&category===behavior.delayedCategory)await new Promise(done=>setTimeout(done,behavior.delay));try{await request.respond({status:fails?503:200,contentType:'application/json',body:JSON.stringify(body)});}catch(error){if(!request.isInterceptResolutionHandled())throw error;}})();
      pendingResponses.add(response);void response.finally(()=>pendingResponses.delete(response));
    }
    else void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port==='3224')?request.continue():request.abort());
  });
  for(const width of [320,390,768,1440]) {
    await page.setViewport({width,height:1000});await page.goto('http://127.0.0.1:3224/',{waitUntil:'networkidle0'});
    await recordPot(page);
    for(const mode of modes){
      await selectMode(page,mode);await ready(page,mode);
      const tabs=await page.$$eval('[aria-label="Type de classement"] button',buttons=>buttons.map(button=>{const rect=button.getBoundingClientRect();const label=button.querySelector('strong').getBoundingClientRect();return {text:button.querySelector('strong').textContent,top:rect.top,left:rect.left,right:rect.right,labelContained:label.left>=rect.left&&label.right<=rect.right,contained:button.scrollWidth<=button.clientWidth+1};}));
      assert.deepEqual(tabs.map(tab=>tab.text),expectedLabels);
      assert(tabs.every(tab=>Math.abs(tab.top-tabs[0].top)<=3&&tab.contained&&tab.labelContained),'4 category columns fit '+width+' '+JSON.stringify(tabs));
      assert(tabs.every((tab,i)=>i===0||tab.left>=tabs[i-1].right),'category columns do not overlap');
      await page.waitForFunction(selector=>document.querySelectorAll(selector+' canvas[data-avatar-state="ready"]').length===7,{},rowSelector);
      const layout=await page.$$eval(rowSelector,rows=>rows.map(row=>{const [rank,avatar,identity,score]=row.children;const boxes=[rank,avatar,identity,score].map(el=>el.getBoundingClientRect());return {count:row.children.length,aligned:boxes.every((box,i)=>i===0||box.left>=boxes[i-1].right-1),contained:row.scrollWidth<=row.clientWidth+1,label:avatar.querySelector('[aria-label]')?.getAttribute('aria-label'),fallback:!avatar.querySelector('canvas')};}));
      assert.equal(layout.length,10);assert(layout.every(row=>row.count===4&&row.aligned&&row.contained),'row layout '+width+' '+mode);assert(layout[2].fallback);assert.equal(layout[0].label,'Avatar de '+categoryEntries[mode][0].pseudo);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
      if(mode==='business')assert(await page.$$eval(rowSelector,rows=>rows.every(row=>!/(Cote|\d+ V|\d+ D|pts Duels)/.test(row.textContent))),'business excludes duel stats');
      if(mode==='duels')assert((await page.$eval(rowSelector,row=>row.textContent)).includes('Cote 1250'),'duel rating retained');
      if(mode==='general')assert((await page.$eval(rowSelector,row=>row.textContent)).includes('27 g'),'general reward estimate retained');
      await assertPot(page);
      await (await page.$(board)).screenshot({path:resolve(output,`ranking-${width}-${mode}.png`)});
      summary.push({width,mode,columns:tabs.length,rows:layout.length,overflow:false});
      if(mode==='tasting'){await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.trim()==='Global').click());await ready(page,'tastingGlobal');assert(await page.$(`${rowSelector}[href^="/arene/profils/"]`));}
    }
  }
  await page.setViewport({width:390,height:1000});
  for(const mode of ['duels','business']){
    behavior.failedCategory=mode;behavior.delayedCategory=mode;behavior.delay=600;
    await page.reload({waitUntil:'networkidle0'});await recordPot(page);await selectMode(page,mode);
    await page.waitForSelector(`${board} [aria-busy="true"]`);
    assert.equal(await page.$$eval(rowSelector,rows=>rows.length),0,'loading hides previous category rows');
    await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('momentanément indisponible'),{},board);
    await (await page.$(board)).screenshot({path:resolve(output,`ranking-390-${mode}-error.png`)});
    behavior.failedCategory=null;
    await page.$$eval(`${board} button`,buttons=>buttons.find(b=>b.textContent.includes('Réessayer')).click());
    await ready(page,mode);await assertPot(page);
  }
  behavior.delayedCategory='duels';behavior.delay=900;
  await page.reload({waitUntil:'networkidle0'});await recordPot(page);await selectMode(page,'duels');await page.waitForSelector(`${board} [aria-busy="true"]`);
  await selectMode(page,'business');await ready(page,'business');await Promise.all([...pendingResponses]);await ready(page,'business');await assertPot(page);
  behavior.delayedCategory=null;await selectMode(page,'duels');await ready(page,'duels');await selectMode(page,'business');await ready(page,'business');
  behavior.paginated=true;
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForFunction(selector=>document.querySelectorAll(selector).length===51,{},rowSelector);
  assert((await page.$eval(board,el=>el.textContent)).includes('186 joueurs au tableau'));
  await page.$$eval(`${board} button`,buttons=>buttons.find(button=>button.textContent.includes('Ma place')).click());
  assert.equal(await page.$eval(`${board} [data-viewer="true"]`,row=>document.activeElement===row),true,'own position beyond page is focused');
  const next=()=>page.$$eval(`${board} button`,buttons=>buttons.find(button=>button.textContent.trim()==='Voir les joueurs suivants').click());
  behavior.failedNextPage=true;await next();
  await page.waitForFunction(selector=>document.querySelector(selector).textContent.includes('Impossible de charger la suite'),{},board);
  assert.equal(await page.$$eval(rowSelector,rows=>rows.length),51,'load-more errors keep existing rows');
  behavior.failedNextPage=false;await next();
  await page.waitForFunction(selector=>document.querySelectorAll(selector).length===101,{},rowSelector);
  behavior.generation=2;await next();
  await page.waitForFunction(selector=>document.querySelectorAll(selector).length===51,{},rowSelector);
  assert((await page.$eval(board,el=>el.textContent)).includes('la liste a été actualisée'));
  for(const expected of [101,151,186]){await next();await page.waitForFunction((selector,count)=>document.querySelectorAll(selector).length===count,{},rowSelector,expected);}
  assert.equal(await page.$$eval(`${board} [data-viewer="true"]`,rows=>rows.length),1,'viewer is not duplicated after final page');
  assert.equal(await page.$$eval(rowSelector,rows=>new Set(rows.map(row=>row.children[2].querySelector('strong').textContent)).size),186);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await (await page.$(board)).screenshot({path:resolve(output,'ranking-390-pagination.png')});
  behavior.paginated=false;
  failPortraits=true;await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(`${rowSelector} canvas[data-avatar-state="error"]`);
  assert.equal(await page.$eval(`${rowSelector} canvas[data-avatar-state="error"]`,el=>getComputedStyle(el).opacity),'0');
  assert.equal(await page.$$eval(rowSelector,rows=>rows.length),10);
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'audit-summary.json'),JSON.stringify({summary,checks:['four columns without clipping','independent category rows and scores','tasting season/global and profile links','business without duel statistics','duel rating details','general reward estimate','reward pot remains mounted','category loading/error/retry','rapid category switch with late response','pagination beyond100','pinned viewer186','load-more failure and retry','snapshot change restart','portrait fallback'],requests},null,2));
  console.log('Rankings passed: 4 categories at 320/390/768/1440px, season/global, independent scores, business without duel stats, error/retry, late response isolation, persistent rewards, actual portrait rendering and failed-image fallback.');
}finally{await browser?.close();await server.close();}
