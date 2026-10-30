/** Read-only local observation of the current shell, menu and map; destination pages are stubs. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const output=resolve('output/clarity-lot5/navigation/after'), port=Number(process.env.KQ_NAVIGATION_MOBILE_PORT??3555), origin=`http://127.0.0.1:${port}`;
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['scripts/audit-placard-navigation.mjs','--preview'],{env:{...process.env,NAVIGATION_AUDIT_PORT:String(port)},stdio:['pipe','pipe','pipe'],windowsHide:true});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Local preview did not start')),60000);server.stdout.on('data',chunk=>{if(String(chunk).includes('Prévisualisation navigation')){clearTimeout(timer);resolve();}});server.once('exit',code=>{clearTimeout(timer);reject(new Error(`Preview stopped: ${code}`));});server.stderr.on('data',chunk=>{if(String(chunk).includes('already in use')){clearTimeout(timer);reject(new Error(String(chunk)));}});});
const browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
const report=[];
try {
 const page=await browser.newPage(); page.setDefaultTimeout(25000);
 await page.setRequestInterception(true);page.on('request',request=>{const u=new URL(request.url());if(u.protocol==='data:'||u.origin===origin)void request.continue();else void request.abort();});
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844});await page.goto(origin+'/arene/placard',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-placard-next-action]');await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:resolve(output,`shell-${width}-full.png`),fullPage:true});
  await page.$eval('#placard-map-viewport',el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const metrics=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
   const labels=[...document.querySelectorAll('[data-map-label]')].map(e=>({id:e.dataset.mapLabel,text:e.textContent,rect:rect(e),font:getComputedStyle(e.firstElementChild).fontSize}));
   const overlaps=[];for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].rect,b=labels[j].rect;const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(w>1&&h>1)overlaps.push({a:labels[i].id,b:labels[j].id,width:w,height:h});}
   const image=document.querySelector('#placard-map-viewport img').getBoundingClientRect();
   const hits=[...document.querySelectorAll('[data-map-building]')].map(e=>{const[x,y]=e.dataset.mapHitPoint.split(',').map(Number);const xx=image.left+image.width*x/100,yy=image.top+image.height*y/100;return{id:e.dataset.mapBuilding,actual:document.elementFromPoint(xx,yy)?.closest('[data-map-building]')?.dataset.mapBuilding??null,x:xx,y:yy};});
   return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,labels,overlaps,hits};
  });report.push(metrics);await page.screenshot({path:resolve(output,`map-${width}-viewport.png`)});
  assert.equal(metrics.overflow,false);assert.deepEqual(metrics.overlaps,[]);
  for(const hit of metrics.hits)assert.equal(hit.actual,hit.id,`${width}: each of eight real building points keeps its target`);
  if(width<1001){
   await page.$eval('button[aria-label="Plus d’activités"]',e=>e.focus());await page.keyboard.press('Enter');await page.waitForSelector('dialog[open]');
   await page.screenshot({path:resolve(output,`menu-${width}-viewport.png`)});
   report.push({width,menu:await page.evaluate(()=>({focus:document.activeElement?.getAttribute('aria-label'),dialog:document.querySelector('dialog[open]')?.getBoundingClientRect().toJSON(),overflow:document.querySelector('dialog[open]').scrollWidth>document.querySelector('dialog[open]').clientWidth+1}))});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
   report.push({width,escapeFocus:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))});
   assert.equal(report.at(-1).escapeFocus,'Plus d’activités');
  }
  await page.$eval('summary[aria-label="Aide du quartier"]',e=>{e.scrollIntoView({block:'center',behavior:'instant'});e.focus()});await page.keyboard.press('Enter');
  const help=await page.$eval('summary[aria-label="Aide du quartier"]',e=>({content:e.nextElementSibling.getBoundingClientRect().toJSON(),map:e.closest('[data-placard-map]').getBoundingClientRect().toJSON()}));
  assert(help.content.bottom<=help.map.bottom,`${width}: help text is not clipped by the map`);report.push({width,help});
  await page.screenshot({path:resolve(output,`help-${width}-full.png`),fullPage:true});await page.keyboard.press('Escape');
  assert.equal(await page.$eval('summary[aria-label="Aide du quartier"]',e=>!e.parentElement.open&&document.activeElement===e),true);
  await page.$eval('[data-map-zoom-toggle]',e=>{e.scrollIntoView({block:'center',behavior:'instant'});e.focus()});await page.keyboard.press('Enter');await page.waitForSelector('[data-map-zoomed]');
  await page.$eval('#placard-map-viewport',e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  await page.$eval('[data-map-building="warehouse"]',e=>e.focus());
  for(const id of ['warehouse','bank','office','market','shop','arena','missions','collection']){
   if(id!=='warehouse')await page.keyboard.press('Tab');
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-map-building')),id);
   report.push({width,zoomFocus:id,geometry:await page.$eval(`[data-map-label="${id}"]`,e=>{const r=e.getBoundingClientRect(),v=document.querySelector('#placard-map-viewport').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:v.toJSON(),visible:r.left>=v.left&&r.right<=v.right&&r.top>=v.top&&r.bottom<=v.bottom}})});
   assert.equal(report.at(-1).geometry.visible,true,`${width}: keyboard focus sign for ${id} stays visible in the zoomed map`);
  }
  await page.screenshot({path:resolve(output,`zoom-keyboard-${width}.png`)});
  await page.$eval('[data-map-building="warehouse"]',e=>e.focus());await page.keyboard.press('Enter');await page.waitForSelector('#placard-building-details');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#placard-building-details'));
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-map-building')),'warehouse');
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto(origin+'/arene/placard',{waitUntil:'networkidle0'});await page.waitForSelector('[data-placard-next-action]');
 await page.$eval('[data-map-zoom-toggle]',e=>e.click());await page.waitForSelector('[data-map-zoomed]');
 await page.$eval('#placard-map-viewport',e=>{e.scrollIntoView({block:'center',behavior:'instant'});e.scrollLeft=0;});
 const panStart=await page.$eval('#placard-map-viewport',e=>{const r=e.getBoundingClientRect();return {x:r.right-40,y:r.top+r.height/2,left:e.scrollLeft};});
 const client=await page.createCDPSession();
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:panStart.x,y:panStart.y}]});
 for(let step=1;step<=6;step++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:panStart.x-step*22,y:panStart.y}]});await new Promise(resolve=>setTimeout(resolve,25));}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const panEnd=await page.$eval('#placard-map-viewport',e=>e.scrollLeft);
 assert(panEnd>panStart.left+40,'Native touch panning still moves the zoomed illustration');
 assert.equal(await page.$('#placard-building-details'),null,'Panning does not open a building');
 report.push({width:390,touchPan:{before:panStart.left,after:panEnd}});
 await writeFile(resolve(output,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Current shell, navigation and map, local preview data, destination stubs. No remote requests.',report},null,2));
 console.log(JSON.stringify({passed:true,widths:[320,390,1440],buildingHitChecks:24,zoomKeyboardChecks:24,helpChecks:3,touchPan:true,output}));
}finally{await browser.close();server.kill();}
