import assert from 'node:assert/strict';
import { mkdir,writeFile,unlink,access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const files=['src/app/navigation-feedback-preview/page.tsx','src/app/navigation-feedback-preview/target/page.tsx'];
for(const file of files){try{await access(file);throw new Error('Existing fixture: '+file);}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(resolve(files[1],'..'),{recursive:true});
await mkdir('output/navigation-feedback/profile',{recursive:true});
await writeFile(files[0],`"use client";
import Link from "@/components/navigation/NavigationLink";
import {useRouter} from "@/components/navigation/NavigationFeedback";
export default function Page(){const router=useRouter();return <div style={{padding:150}}><Link id="slow-link" href="/navigation-feedback-preview/target?test=link" prefetch={false}>Lien lent</Link><button id="slow-button" onClick={()=>router.push('/navigation-feedback-preview/target?test=button')}>Bouton lent</button><Link id="same-page" href="#anchor">Ancre</Link><Link id="cancelled" href="/navigation-feedback-preview/target?test=cancelled" prefetch={false} onNavigate={e=>e.preventDefault()}>Annuler</Link><div id="anchor">Ancre locale</div></div>}`);
await writeFile(files[1],`export const dynamic="force-dynamic";export default async function Page(){await new Promise(resolve=>setTimeout(resolve,3000));return <div id="destination" style={{padding:150}}>Page arrivée</div>}`);
let chrome;
try{
 chrome=await launch({userDataDir:resolve('output/navigation-feedback/profile'),chromeFlags:['--headless','--disable-gpu']});
 const browser=await puppeteer.connect({browserURL:'http://127.0.0.1:'+chrome.port});const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000');
 await page.evaluate(async()=>{await fetch('/api/age-gate/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})});});
 for(const [trigger,width] of [['slow-link',390],['slow-button',1440]]){
  await page.setViewport({width,height:844});
  await page.goto('http://localhost:3000/navigation-feedback-preview',{waitUntil:'networkidle2'});
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Tout refuser')?.click());
  await page.waitForSelector('#same-page',{timeout:20000}).catch(async e=>{console.log(page.url(),errors,(await page.$eval('body',el=>el.innerText)).slice(0,1800));throw e;});
  await page.click('#same-page');assert.equal(await page.$('[data-navigation-pending]'),null);
  await page.click('#cancelled');assert.equal(await page.$('[data-navigation-pending]'),null);
  await page.click('#'+trigger);
  await page.waitForSelector('[data-navigation-pending]',{timeout:1500});
  await page.screenshot({path:`output/navigation-feedback/${trigger}.png`});
  await page.waitForSelector('#destination');
  await page.waitForFunction(()=>!document.querySelector('[data-navigation-pending]'));
 }
 assert.deepEqual(errors,[]);console.log('PASS: mobile link, desktop button, streamed loading, completion, same-page anchor and cancelled navigation.');
 await browser.disconnect();
}finally{if(chrome)await chrome.kill();for(const file of files)await unlink(file);}
