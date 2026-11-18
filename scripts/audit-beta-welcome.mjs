// Reuse the isolated component harness; no Supabase credentials or real API.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let source=(await readFile('scripts/audit-bank-clarity-lot27.mjs','utf8')).replaceAll('\r\n','\n');
source=source.replace('`output/clarity-lot27/${before ? \'before\' : \'after\'}`',"'output/beta-welcome'").replace('?? 3597','?? 3599');
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqBetaWelcome} from '/src/components/placard/KqBetaWelcome';
import retro from '/src/components/contest/ArenaRetro.module.css';
const params=new URLSearchParams(location.search);
function App(){const [enabled,setEnabled]=React.useState(!params.has('wait'));window.enableBeta=()=>setEnabled(true);return <main className={retro.surface}><button id="game">Mon quartier</button><KqBetaWelcome ownerId={params.get('owner')||'player'} connectionKey={params.get('connection')||'session-a'} enabled={enabled}/></main>;}
createRoot(document.getElementById('root')).render(<App/>);
`;
const entryStart=source.indexOf('const entry = `'),entryEnd=source.indexOf('const modules=',entryStart);
assert(entryStart>0&&entryEnd>entryStart);source=source.slice(0,entryStart)+'const entry = '+JSON.stringify(entry)+';\n'+source.slice(entryEnd);
const start=source.indexOf(' const frames='),end=source.indexOf(' assert.deepEqual(errors,[])',start);
assert(start>0&&end>start);
source=source.slice(0,start)+`
 const opened='dialog[data-beta-welcome][open]';
 const closed=()=>page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 for(const width of [320,1440]){
  await page.goto(origin);await page.evaluate(()=>localStorage.clear());await page.setViewport({width,height:844});await page.goto(origin+'/?connection=first-'+width,{waitUntil:'networkidle0'});await page.waitForSelector(opened);
  const text=await page.$eval(opened,el=>el.innerText);assert.match(text,/jeu est en bêta/i);assert.match(text,/boîte aux lettres/i);assert.match(text,/après validation/i);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:resolve(output,'welcome-'+width+'.png')});
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('dialog')),true,'Keyboard stays in dialog');
  await page.keyboard.press('Escape');await closed();await page.reload({waitUntil:'networkidle0'});assert.equal(await page.$(opened),null,'Same connection remains dismissed after reload');
  await page.goto(origin+'/?view=market&connection=first-'+width,{waitUntil:'networkidle0'});assert.equal(await page.$(opened),null,'Navigation does not reopen');
  await page.goto(origin+'/?connection=second-'+width,{waitUntil:'networkidle0'});await page.waitForSelector(opened);
  await page.click('dialog [data-app-dialog-body] button');await closed();results.push({width,keyboard:true,reload:true,navigation:true,newConnection:true,playCloses:true});
 }
 await page.goto(origin+'/?connection=delayed&wait=1',{waitUntil:'networkidle0'});assert.equal(await page.$(opened),null);await page.evaluate(()=>window.enableBeta());await page.waitForSelector(opened);await page.click('button[aria-label="Fermer l’accueil bêta"]');await closed();results.push({waitsForEntry:true,closeButton:true});
`+source.slice(end);
await mkdir('output/beta-welcome',{recursive:true});const file=resolve('output/beta-welcome/browser.mjs');await writeFile(file,source);await import(pathToFileURL(file).href);
