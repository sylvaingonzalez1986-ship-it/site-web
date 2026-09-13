import assert from 'node:assert/strict';
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile, access, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
const output='output/arena-rewards';
const route=resolve('src/app/arena-reward-preview-local/page.tsx');
try { await access(route); throw new Error('La page de test existe déjà ; arrêt pour ne pas l’écraser.'); } catch(e) { if(e.code !== 'ENOENT') throw e; }
await mkdir(resolve(route,'..'),{recursive:true});
await mkdir(`${output}/profile`,{recursive:true});
await writeFile(route, `"use client";
import { useState } from "react";
import { ArenaCustomerRewardPot, type ArenaCustomerRewardPool } from "@/components/contest/ArenaCustomerRewards";
import { ContestArenaHub } from "@/components/contest/ContestArenaHub";
const initial: ArenaCustomerRewardPool = {
 seasonCode:"DEMO",status:"active",contributionRateBps:700,poolGrams:500,wholePoolGrams:500,carriedGrams:0,currentWeekGrams:70,
 startsAt:"2026-01-01T00:00:00Z",endsAt:"2099-12-31T00:00:00Z",updatedAt:"2026-09-12",minimumHumanBattles:3,eligiblePlayers:12,
 milestone:{previousGrams:500,nextGrams:1000,progressPercent:0},
 weeklyDice:{startsOn:"2026-09-07",endsOn:"2026-09-14",rollCount:8,average:4,rateBps:700,eligibleFlowerGrams:1000,contributionGrams:70},
 topRewards:[{leaderboardRank:1,rewardRank:1,pseudo:"Camille",shareBps:2700,estimatedGrams:135}],
 surpriseReward:{shareBps:1000,estimatedGrams:50,eligiblePlayers:2,oneChancePerCustomer:true},
 viewer:{rank:12,battles:2,estimatedGrams:null,grant:null}
};
export default function Preview(){
 const [pool,setPool]=useState(initial); const [mode,setMode]=useState("active");
 return <main style={{padding:"110px 12px 24px",maxWidth:1200,margin:"auto"}}>
 <select aria-label="Scénario" value={mode} onChange={e=>{setMode(e.target.value);setPool({...initial,status:e.target.value === "settled" ? "settled" : e.target.value === "frozen" ? "frozen" : "active",viewer:e.target.value === "guest" ? null : {...initial.viewer!,grant:e.target.value === "settled" ? {grams:50,kind:"surprise"} : null}})}}>{["active","guest","unavailable","loading","frozen","settled","lobby"].map(m=><option key={m}>{m}</option>)}</select>
 {mode === "lobby" ? <ContestArenaHub/> : <ArenaCustomerRewardPot rankingId="ranking" rewardPool={mode === "unavailable" || mode === "loading" ? null : pool} onRewardPoolChange={setPool} loading={mode === "loading"} unavailable={mode === "unavailable"} viewerPseudo={mode === "guest" ? undefined : "Camille"}/>}
 <div id="ranking">Classement de démonstration</div></main>;
}`);
let chrome;
try {
 chrome=await launch({userDataDir:resolve(`${output}/profile`),chromeFlags:['--headless','--disable-gpu']});
 const browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`}); const page=await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',request=>{
  if(new URL(request.url()).pathname==='/api/arena/rewards/dice') {
   return request.respond({status:200,contentType:'application/json',body:JSON.stringify(request.method()==='POST'?{viewerRoll:5}:{eligible:true,viewerRoll:null})});
  }
  void request.continue();
 });
 await page.goto('http://localhost:3000');
 await page.evaluate(async()=>{await fetch('/api/age-gate/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})});});
 await page.goto('http://localhost:3000/arena-reward-preview-local',{waitUntil:'networkidle2'});
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Tout refuser')?.click());
 await page.waitForSelector('[aria-label="Ouvrir le détail du bocal"]');
 const results=[];
 for(const width of [320,390,768,1440]) {
  await page.setViewport({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);
  await page.screenshot({path:`${output}/rewards-${width}.png`,fullPage:true});
  results.push({width,overflow:false});
 }
 await page.click('[aria-label="Ouvrir le détail du bocal"]');
 assert.equal(await page.$eval('[aria-label="Ouvrir le détail du bocal"]',el=>el.getAttribute('aria-expanded')),'true');
 assert.ok((await page.$eval('body',el=>el.innerText)).replace(/\s/g,' ').includes('1 000 g vendus × 7 % = 70 g'));
 await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.startsWith('#2'))?.click());
 assert.ok((await page.$eval('body',el=>el.innerText)).includes('90 g'));
 await page.$$eval('summary',els=>els.find(el=>el.textContent.includes('Le dé collectif'))?.click());
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Lancer mon dé')));
 await page.$$eval('button',els=>els.find(el=>el.textContent.includes('Lancer mon dé')).click());
 await page.waitForFunction(()=>document.body.innerText.includes('Ton dé : 5'));
 for(const mode of ['guest','unavailable','loading','frozen','settled','lobby']) {
  await page.select('select[aria-label="Scénario"]',mode);
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow in ${mode}`);
  const text=await page.$eval('body',el=>el.innerText);
  if(mode==='frozen'||mode==='settled') assert.equal(text.includes('Lancer mon dé'),false);
  if(mode==='settled') assert.ok(text.includes('Tu as remporté 50 g'));
  if(mode==='unavailable') assert.ok(text.includes('momentanément indisponible'));
  await page.screenshot({path:`${output}/${mode}-390.png`,fullPage:true});
 }
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/results.json`,JSON.stringify({fixtures:true,results,states:['guest','unavailable','loading','frozen','settled','lobby'],errors},null,2));
 console.log('Vérification réussie : quatre largeurs, sept états, détails, rangs et dé simulé.');
 await browser.disconnect();
} finally { if(chrome) await chrome.kill(); await unlink(route); }
