/** Real recap components with engine-built local receipts; no API or account. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/arena-recap'),origin='http://127.0.0.1:3266';
const modules={
  fixture:`import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
    import{KqCultureRecap,KqJuryRecap}from'/src/components/placard/KqPersonalRecap';
    import{startKqTrialCulture}from'/src/lib/kanab-quest-trial';
    import{rollKqDice,resolveKqStage,advanceKqStage,playKqCard}from'/src/lib/kanab-quest-game';
    import{encodeKqSave,parseKqGameSave}from'/src/lib/kanab-quest-persistence';
    import{getKqCultureAnalysis}from'/src/lib/kanab-quest-culture-analysis';
    import styles from'/src/components/placard/KanabQuestDicePrototype.module.css';
    const scenario=new URLSearchParams(location.search).get('scenario')||'culture';
    const legacyEntry=entry=>{const{decision,...receipt}=entry;return receipt;};
    function buildCulture(){
      for(let seed=1;seed<=500;seed++){
        let candidate=startKqTrialCulture('balanced',seed);
        for(let index=0;index<6;index++){
          if(index===0)candidate=playKqCard(candidate,'BOTTE-005');
          candidate=resolveKqStage(rollKqDice(candidate));
          if(candidate.cultureDead)break;
          candidate=advanceKqStage(candidate);
        }
        if(candidate.phase==='complete'&&!candidate.cultureDead&&candidate.history.length===6&&candidate.history.some(entry=>entry.outcome==='failure'||entry.outcome==='fragile')&&getKqCultureAnalysis(candidate).advice.some(advice=>advice.basis==='verified-position'))return candidate;
      }
      throw new Error('No valid engine-generated culture found for the recap audit.');
    }
    let game=buildCulture();
    if(scenario==='culture-legacy')game={...game,history:game.history.map(legacyEntry)};
    if(scenario==='culture-partial')game={...game,history:game.history.map((entry,index)=>index<3?entry:legacyEntry(entry))};
    const storageKey='recap-audit-fixture-v1:'+scenario;
    if(scenario.startsWith('culture')){const saved=parseKqGameSave(localStorage.getItem(storageKey));if(saved)game=saved;else localStorage.setItem(storageKey,encodeKqSave(game));}
    const round=(code,label,playerScore,opponentScore,winner)=>({code,label,explanation:'Manche locale préparée pour vérifier le bilan.',playerScore,opponentScore,winner});
    let rounds=[round('visual-impact','Impact visuel',90,91,'opponent'),round('blind-aroma','Arômes à l’aveugle',60,50,'player'),round('technical-jury','Jury technique',85,95,'opponent')];
    if(scenario==='jury-tie')rounds=[round('visual-impact','Impact visuel',90,90,'opponent'),round('blind-aroma','Arômes à l’aveugle',60,50,'player'),round('technical-jury','Jury technique',85,95,'opponent')];
    if(scenario==='jury-victory')rounds=[round('visual-impact','Impact visuel',90,89,'player'),round('blind-aroma','Arômes à l’aveugle',60,50,'player'),round('technical-jury','Jury technique',85,75,'player')];
    if(scenario==='jury-legacy')rounds=rounds.map((entry,index)=>({...entry,code:'archived-unknown-'+index}));
    const playerStats={appearance:90,vigor:90,aroma:60,regularity:60,mastery:85};
    const opponentStats={appearance:91,vigor:91,aroma:50,regularity:50,mastery:95};
    window.__recapFixture={game,rounds,playerStats,opponentStats};
    function Fixture(){const[prepared,setPrepared]=React.useState(false);const recap=scenario.startsWith('culture')?React.createElement(KqCultureRecap,{state:game}):React.createElement('div',{className:styles.verdictPanel},React.createElement(KqJuryRecap,{rounds,...(scenario==='jury-no-stats'?{}:{playerStats,opponentStats}),onPrepare:()=>setPrepared(true)}));return React.createElement('main',{className:styles.page,'data-player-mode':true},prepared?React.createElement('p',{'data-audit-prepared':true},'Préparation locale ouverte'):React.createElement('section',{className:styles.traitsPanel},recap));}
    createRoot(document.getElementById('root')).render(React.createElement(Fixture));`,
  link:`import React from'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/image':`import React from'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}`;
const server=await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'arena-recap-fixture',enforce:'pre',resolveId(id){if(id.endsWith('/components/navigation/NavigationLink')||id==='next/link')return '\0link';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>`);});}}],server:{host:'127.0.0.1',port:3266,strictPort:true,hmr:false,watch:null}});
const report={passed:false,results:[],apiRequests:[],remote:[],errors:[]};let browser,page,scenario='';
async function visit(name,width){scenario=name;await page.setViewport({width,height:900});await page.goto(origin+'/?scenario='+name,{waitUntil:'networkidle0'});await page.waitForSelector(name.startsWith('culture')?'[data-culture-personal-recap]':'[data-jury-personal-recap]');}
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+': horizontal overflow');await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});}
async function details(selector){const summary=await page.waitForSelector(selector+'>summary');assert((await summary.boundingBox()).height>=44,'Details target at least44px');await summary.focus();await page.keyboard.press('Enter');await page.waitForSelector(selector+'[open]');}
try{
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',error=>report.errors.push({scenario,message:error.message}));await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.protocol==='blob:')return void request.continue();if(url.origin!==origin){report.remote.push(url.href);return void request.abort();}if(url.pathname.startsWith('/api/')){report.apiRequests.push({scenario,method:request.method(),path:url.pathname});return void request.respond({status:503,contentType:'application/json',body:'{}'});}void request.continue();});
  for(const width of [390,1440]){
    for(const [name,coverage] of [['culture','detailed'],['culture-partial','partial'],['culture-legacy','legacy']]){
      await visit(name,width);const receipt=await page.evaluate(()=>window.__recapFixture.game);assert.equal(receipt.history.length,6);assert.equal(receipt.phase,'complete');assert.equal(receipt.usedCards.includes('BOTTE-005'),true);
      assert.equal(await page.$eval('[data-culture-personal-recap]',el=>el.dataset.analysisCoverage),coverage);await page.waitForSelector('[data-culture-analysis]');await shot(name+'-'+width+'-summary');
      assert.equal(await page.$$eval('[data-recap-card]',nodes=>nodes.filter(node=>node.checkVisibility()).length),1,'The summary presents one primary card');
      await details('[data-recap-card-details]');assert((await page.$eval('[data-recap-card-details]',el=>el.textContent)).includes('stock'),'Card conditions preserve the inventory caveat');if(width===390)await shot(name+'-'+width+'-card-conditions');await page.focus('[data-recap-card-details]>summary');await page.keyboard.press('Enter');
      await details('[data-culture-analysis-details]');assert.equal(await page.$$eval('[data-analysis-stage]',nodes=>nodes.length),6);
      const lines=await page.$$eval('[data-analysis-stage]',nodes=>nodes.map(node=>node.textContent));receipt.history.forEach((entry,index)=>{assert(lines[index].includes(entry.stage));assert(lines[index].includes(entry.situation));assert(lines[index].includes(entry.dice.join(' · ')));});
      if(width===390){const readable=await page.$$eval('[data-analysis-stage]',nodes=>nodes.map(node=>({row:node.getBoundingClientRect().width,paragraph:node.querySelector('p').getBoundingClientRect().width,facts:[...node.querySelectorAll('ul>li')].map(fact=>fact.getBoundingClientRect().width)})));assert(readable.every(row=>row.paragraph>=row.row*.75&&row.facts.every(fact=>fact>=row.row*.65)),`Culture details remain readable inside the real parent styles: ${JSON.stringify(readable)}`);}
      if(coverage!=='detailed')assert(await page.$('[data-analysis-legacy]'),'Older decisions are explicitly unavailable');
      if(coverage==='detailed')assert(await page.$('[data-recap-card][data-advice-basis="verified-position"]'),'Detailed receipts explain an actual alternative card');
      if(coverage==='legacy')assert.equal(await page.$$eval('[data-recap-card][data-advice-basis="verified-position"]',nodes=>nodes.length),0,'No alleged playable historical card without a recorded decision');
      const cardImages=await page.$$eval('[data-recap-card] img',nodes=>nodes.map(img=>({alt:img.alt,loaded:img.complete&&img.naturalWidth>0})));assert(cardImages.every(image=>image.alt.startsWith('Carte ')&&image.loaded),'Recommended cards have a loaded visual and accessible label');await shot(name+'-'+width+'-details');
      const text=await page.$eval('[data-culture-personal-recap]',el=>el.textContent);assert(!/NaN|undefined|Infinity/.test(text));
      await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-personal-recap]');assert.equal(await page.$eval('[data-culture-personal-recap]',el=>el.textContent),text,'Reload retains the recorded analysis');assert.deepEqual(await page.evaluate(()=>window.__recapFixture.game),receipt,'Reading the recap never rewrites the culture');report.results.push({name,width,coverage,reload:true});
    }
    for(const name of ['jury','jury-tie','jury-victory','jury-legacy','jury-no-stats']){
      await visit(name,width);await page.waitForSelector('[data-jury-analysis]');assert((await page.$eval('[data-jury-analysis]>h4',el=>el.textContent)).includes('Impact visuel'),'Focus is the closest loss or victory, not the lowest absolute score');await shot(name+'-'+width+'-summary');await details('[data-jury-analysis-details]');const text=await page.$eval('[data-jury-personal-recap]',el=>el.textContent);assert(!/NaN|undefined|Infinity/.test(text));
      if(name==='jury-legacy'){assert(text.includes('ancienne manche'));assert(!/65\s*%|35\s*%/.test(text),'Unknown historical criteria are not invented');}
      else {assert(/65\s*%/.test(text)&&/35\s*%/.test(text),'Real criterion weights are explained');}
      if(name==='jury-tie')assert(text.includes('aucun déficit de note'),'A tied loss is explained without an alleged score deficit');
      if(name==='jury-no-stats'){assert(text.includes('statistiques complètes'));assert(!text.includes('Contribution à l’écart'),'Missing stats cannot support numerical attribution');}
      if(name==='jury'){assert(text.includes('-0,65 point')&&text.includes('-0,35 point'),'Weighted contributions retain the precision needed to explain a one-point gap');}
      await shot(name+'-'+width+'-details');
      const button=await page.$('[data-recap-prepare]');await button.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));assert((await button.boundingBox()).height>=44);await button.click();await page.waitForSelector('[data-audit-prepared]');report.results.push({name,width,keyboardDetails:true,prepare:true});
    }
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.apiRequests,[]);assert.deepEqual(report.remote,[]);report.passed=true;
}catch(error){report.failure=error.stack;await shot('failure').catch(()=>undefined);process.exitCode=1;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();await server.close();}
