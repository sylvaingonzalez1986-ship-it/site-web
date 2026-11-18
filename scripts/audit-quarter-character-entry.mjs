// Actual editor and entry gate; all API requests are synthetic and local.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let source=(await readFile('scripts/audit-bank-clarity-lot27.mjs','utf8')).replaceAll('\r\n','\n');
source=source.replace('`output/clarity-lot27/${before ? \'before\' : \'after\'}`',"'output/quarter-character-entry'").replace('?? 3597','?? 3603');
source=source.replace('Actual bank UI; valid local snapshots and original command validator; no live writes.','Actual character editor, quarter entry gate and Arena map; synthetic local profile responses; no live writes.');
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {QuarterCharacterGate} from '/src/components/contest/QuarterCharacterGate';
import {ArenaGameEntry} from '/src/components/contest/ArenaGameEntry';
import {ContestArenaHub} from '/src/components/contest/ContestArenaHub';
import {AuditConsent} from 'audit-consent';
const mode=new URLSearchParams(location.search).get('mode');
const profile={nickname:'Testeur29',gender:'male',clothing:'ochre',skin:'ivory',strength:'green-thumb'};
window.calls=[];let failed=false,savedProfile=null;
if(mode==='entry-blocked')for(const storage of [localStorage,sessionStorage])for(const name of ['getItem','setItem','removeItem'])Object.defineProperty(storage,name,{value:()=>{throw new Error('Storage unavailable')}});
const readProfile=()=>{try{return JSON.parse(localStorage.getItem('profile')||'null')}catch{return savedProfile}};
window.fetch=async(input,init={})=>{
 const path=new URL(String(input),location.origin).pathname;window.calls.push({path,method:init.method||'GET'});
 if(path==='/api/arena/tutorial'){
  if(init.method==='POST')return Response.json({ok:true});
  if(mode==='signed-out')return Response.json({}, {status:401});
  if(mode==='error'&&!failed){failed=true;return Response.json({}, {status:503});}
  return Response.json({userId:mode==='other-owner'?'other':'player',chanvrier:mode==='returning'||mode==='entry-free'?profile:mode==='invalid'?{}:readProfile()});
 }
 if(path==='/api/arena/chanvrier'&&init.method==='POST'){
  if(mode==='entry-save-error'&&!failed){failed=true;return Response.json({error:'Enregistrement indisponible, réessaie.'},{status:503});}
  const saved=JSON.parse(init.body);savedProfile=saved;try{localStorage.setItem('profile',JSON.stringify(saved))}catch{}return Response.json({profile:saved});
 }
 throw new Error('Unexpected request '+path);
};
function App(){const [enabled,setEnabled]=React.useState(mode!=='wait'&&mode!=='entry-wait');window.enable=()=>setEnabled(true);return mode==='arena'?<ContestArenaHub/>:mode?.startsWith('entry')?<AuditConsent blocked={!enabled}><ArenaGameEntry userId="player" introductionState={mode==='entry-seen'?'seen':'new'} betaConnectionKey="test-connection"/></AuditConsent>:<QuarterCharacterGate ownerId="player" enabled={enabled}><div id="game">Quartier prêt</div></QuarterCharacterGate>;}
createRoot(document.getElementById('root')).render(<App/>);
`;
const a=source.indexOf('const entry = `'),b=source.indexOf('const modules=',a);
assert(a>0&&b>a);source=source.slice(0,a)+'const entry = '+JSON.stringify(entry)+';\n'+source.slice(b);
source=source.replace('const modules={entry,',`const modules={entry,
 'audit-consent':\`import React from 'react';const Context=React.createContext({showBanner:false});export function AuditConsent({blocked,children}){return <Context.Provider value={{showBanner:blocked}}>{children}</Context.Provider>}export function useCookieConsent(){return React.useContext(Context)}\`,
 'next/dynamic':\`import React from 'react';import {KqFarmGuide} from '/src/components/placard/KqFarmGuide';export default function dynamic(){return function Game({initialGuideOpen,initialGuideStep}){return <main id="game" data-placard-view="workshop" data-guide={initialGuideOpen} data-step={initialGuideStep}><h1>Le plan de ma grange</h1><KqFarmGuide ownerId="player" initialOpen={initialGuideOpen} initialStep={initialGuideStep} destination={{view:'workshop'}} onNavigate={()=>{}} onActiveChange={()=>{}}/><div data-warehouse-map>Plan local sans transaction</div></main>}}\`,
`);
source=source.replace('resolveId(id){if(id in modules)',"resolveId(id){if(/\\/CookieConsentProvider(?:\\.tsx)?$/.test(id))return '\\0audit-consent';if(id in modules)");
source=source.replace('#root{max-width:1200px;margin:auto;padding:12px;box-sizing:border-box}', '#root{min-width:0}');
const start=source.indexOf(' const frames='),end=source.indexOf(' assert.deepEqual(errors,[])',start);
assert(start>0&&end>start);
source=source.slice(0,start)+`
 async function enter(selector){await page.$eval(selector,node=>node.scrollIntoView({block:'center'}));await page.focus(selector);await page.keyboard.press('Enter');}
 async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 async function clean(mode){await page.goto(origin+'/?mode='+mode,{waitUntil:'networkidle0'});await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload({waitUntil:'networkidle0'});}
 async function completeCharacter(){
  await enter('[data-arrival-create]');await page.waitForSelector('[data-profile-step="look"]');
  assert.equal(await page.$('[data-profile-step="inheritance"]'),null);
  await page.type('input[autocomplete="nickname"]','Testeur29');await enter('[data-profile-next]');
  await page.waitForSelector('[data-profile-step="strength"]');await enter('[data-profile-next]');
  await page.waitForSelector('input[name="confirm-strength"]');assert.equal(await page.$eval('[data-profile-next]',node=>node.disabled),true);
  await page.click('input[name="confirm-strength"]');await noOverflow();await enter('[data-profile-next]');
 }
 for(const width of [320,1440]){
  await page.setViewport({width,height:844});await clean('entry');
  await page.waitForSelector('[data-quarter-arrival="story"]');assert.equal(await page.$('#game'),null);assert.equal(await page.$('dialog[open]'),null);
  assert.equal((await page.evaluate(()=>window.calls)).filter(c=>c.method==='POST').length,0);
  assert.match(await page.$eval('h1',n=>n.textContent),/Tout commence dans une grange/);
  await noOverflow();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(output,'story-'+width+'.png'),fullPage:true});
  await enter('[data-arrival-create]');await page.waitForSelector('[data-chanvrier-profile][open]');await noOverflow();await page.screenshot({path:resolve(output,'creation-'+width+'.png')});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await page.$('#game'),null);
  await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-arrival-create]'));
  await completeCharacter();await page.waitForSelector('[data-quarter-arrival="meeting"]');assert.equal(await page.$('#game'),null);assert.equal(await page.$('[data-beta-welcome]'),null);
  assert.equal((await page.evaluate(()=>window.calls)).filter(c=>c.method==='POST'&&c.path==='/api/arena/chanvrier').length,1);
  await noOverflow();await page.screenshot({path:resolve(output,'meeting-'+width+'.png'),fullPage:true});
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-quarter-arrival="meeting"]');assert.equal(await page.$('[data-chanvrier-profile]'),null);
  await enter('[data-arrival-start]');await page.waitForSelector('#game[data-guide="true"][data-step="zone"]');
  assert.equal(new URL(page.url()).searchParams.get('view'),'workshop');
  await page.waitForSelector('[data-beta-welcome][open]');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kq:farm-guide:v1:player'))?.selectedStepId==='zone');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('kq:farm-guide:v1:player')).completed),[]);
  assert.match(await page.$eval('[data-farm-guide]',n=>n.textContent),/Enregistrer une zone de culture/);
  assert.match(await page.$eval('[data-farm-guide]',n=>n.textContent),/Loïc/);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#game');assert.equal(await page.$('[data-quarter-arrival]'),null);assert.equal(await page.$('[data-beta-welcome]'),null);
  await page.goto(origin+'/?mode=arena',{waitUntil:'networkidle0'});assert.equal(await page.$('[data-arena-profile-trigger]'),null);assert.equal((await page.evaluate(()=>window.calls)).length,0);
  await noOverflow();results.push({width,storyBeforeCharacter:true,cancelAndResume:true,savedOnce:true,meetingResumes:true,planAndGuide:true,noInventedProgress:true,betaAfterStory:true,reloadSkipsCreation:true,arenaHasNoProfile:true});
 }
 await page.goto(origin+'/?mode=error',{waitUntil:'networkidle0'});await page.waitForSelector('[role="alert"]');assert.equal(await page.$('#game'),null);await page.click('[data-quarter-character-gate]>button');await page.waitForSelector('#game');results.push({retry:true});
 for(const mode of ['signed-out','other-owner','invalid']){await page.goto(origin+'/?mode='+mode,{waitUntil:'networkidle0'});assert.equal(await page.$('#game'),null);assert.equal(await page.$('[data-chanvrier-profile]'),null);results.push({mode,blocked:true});}
 await page.goto(origin+'/?mode=wait',{waitUntil:'networkidle0'});assert.equal((await page.evaluate(()=>window.calls)).length,0);await page.evaluate(()=>window.enable());await page.waitForSelector('#game');results.push({waitsForCookieConsent:true});
 await clean('entry-wait');assert.equal((await page.evaluate(()=>window.calls)).length,0);await page.evaluate(()=>window.enable());await page.waitForSelector('[data-quarter-arrival="story"]');results.push({entryWaitsForCookieConsent:true});
 await clean('entry-seen');await page.waitForSelector('[data-quarter-arrival="story"]');results.push({serverProfileOverridesSeenFlag:true});
 await clean('entry&guide=1');await page.waitForSelector('[data-quarter-arrival="story"]');assert.equal((await page.evaluate(()=>window.calls)).filter(c=>c.method==='POST').length,0);results.push({guideLinkKeepsFirstArrival:true});
 await clean('entry-save-error');await completeCharacter();await page.waitForSelector('[data-chanvrier-profile] [role="alert"]');assert.equal(await page.$('[data-quarter-arrival="meeting"]'),null);assert.equal(await page.$('#game'),null);await enter('[data-profile-next]');await page.waitForSelector('[data-quarter-arrival="meeting"]');results.push({saveErrorKeepsCharacter:true});
 await clean('entry-free');await page.waitForSelector('[data-entry-quarter]');assert.equal(await page.$('[data-quarter-arrival]'),null);await enter('[data-entry-quarter]');await page.waitForSelector('#game[data-guide="false"]');results.push({existingCharacterCanPlayFreely:true});
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.goto(origin+'/?mode=entry-blocked',{waitUntil:'networkidle0'});await page.waitForSelector('[data-quarter-arrival="story"]');await completeCharacter();await page.waitForSelector('[data-quarter-arrival="meeting"]');await enter('[data-arrival-start]');await page.waitForSelector('#game[data-step="zone"]');results.push({blockedStorageStillPlayable:true});
`+source.slice(end);
await mkdir('output/quarter-character-entry',{recursive:true});const file=resolve('output/quarter-character-entry/browser.mjs');await writeFile(file,source);await import(pathToFileURL(file).href);
