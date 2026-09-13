import assert from 'node:assert/strict';
import {mkdir,writeFile,unlink,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {launch} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const route='src/app/ranking-layout-preview/page.tsx';
try{await access(route);throw new Error('Fixture already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(resolve(route,'..'),{recursive:true});await mkdir('output/ranking-layout/profile',{recursive:true});
await writeFile(route,`import {ContestTesterLeaderboard} from '@/components/contest/ContestHubClient';import styles from '@/components/contest/ContestArena.module.css';export default function Page(){return <div className={styles.page} style={{padding:'120px 12px 20px'}}><div className={styles.playerRankingSection}><ContestTesterLeaderboard seasonItems={[]} globalItems={[]} profileTrack="regular" viewerPseudo="Sylvain" /></div></div>}`);
let chrome;
try{
chrome=await launch({userDataDir:resolve('output/ranking-layout/profile'),chromeFlags:['--headless','--disable-gpu']});
const browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`});const page=await browser.newPage();
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
await page.setRequestInterception(true);
page.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/api/arena/rewards')return req.respond({status:503,contentType:'application/json',body:'{}'});if(path==='/api/arena/rankings')return req.respond({status:200,contentType:'application/json',body:JSON.stringify({entries:Array.from({length:12},(_,i)=>({rank:i+1,pseudo:i===11?'Sylvain':`Joueur ${i+1}`,score:454-i*20,notebookScore:120,placardScore:334-i*20,wins:2,losses:1}))})});void req.continue();});
await page.goto('http://localhost:3000');await page.evaluate(async()=>{await fetch('/api/age-gate/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})});});
await page.goto('http://localhost:3000/ranking-layout-preview',{waitUntil:'networkidle2'});
await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Tout refuser')?.click());
await page.waitForSelector('[data-viewer]');
for(const width of [320,390,1440]){
await page.setViewport({width,height:900});
const geometry=await page.evaluate(()=>{const toolbar=document.querySelector('.contest-station-board-toolbar'),button=[...toolbar.querySelectorAll('button')].find(b=>b.textContent==='Voir ma position'),count=toolbar.querySelector('strong');const b=button.getBoundingClientRect(),c=count.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,buttonFits:button.scrollWidth<=button.clientWidth,overlap:b.left<c.right&&b.right>c.left&&b.top<c.bottom&&b.bottom>c.top};});
assert.equal(geometry.overflow,false);assert.equal(geometry.buttonFits,true);assert.equal(geometry.overlap,false);
await page.$$eval('button',els=>els.find(e=>e.textContent==='Voir ma position').click());
await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-viewer'));
const board=await page.$('.contest-station-board');await board.screenshot({path:`output/ranking-layout/board-${width}.png`});
}
await page.$eval('[aria-label="Ouvrir le détail du bocal"]',button=>button.setAttribute('data-retained-pot','true'));
await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.trim().startsWith('Dégustation')).click());
assert.ok(await page.$('[data-retained-pot]'), 'Pot remains mounted in tasting');
await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.trim().startsWith('Placard')).click());
assert.ok(await page.$('[data-retained-pot]'), 'Pot remains mounted in Placard');
await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.trim().startsWith('Général')).click());
assert.ok(await page.$('[data-retained-pot]'), 'Pot remains mounted on return to general');
console.log('PASS: layout, own position and persistent pot across all three rankings.');await browser.disconnect();
}finally{if(chrome)await chrome.kill();await unlink(route);}
