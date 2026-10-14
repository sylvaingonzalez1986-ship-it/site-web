/** Actual Warehouse UI; local API fixtures only. No Supabase request or mutation. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/warehouse-100m2');
const port=Number(process.env.KQ_WAREHOUSE_100M2_PORT??3275),origin='http://127.0.0.1:'+port;
const fixture=spawn(process.execPath,['scripts/audit-placard-warehouse-v4.mjs','--preview'],{cwd:root,env:{...process.env,KQ_WAREHOUSE_AUDIT_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
let fixtureLog='',browser,page;
fixture.stdout.on('data',chunk=>{fixtureLog+=chunk;});fixture.stderr.on('data',chunk=>{fixtureLog+=chunk;});
const checks=[],errors=[],external=[];
try {
  await mkdir(output,{recursive:true});
  let ready=false;
  for(let attempt=0;attempt<120;attempt++) {
    if(fixture.exitCode!==null)throw Error('Fixture exited: '+fixtureLog);
    try{ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok;}catch{}
    if(ready)break;await delay(250);
  }
  assert.ok(ready,'Local fixture starts');
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();else {external.push(request.url());void request.abort();}});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const visit=async(query)=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-map] [data-zone-id]');await settle();};
  const clickText=async(text)=>{const handle=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&!node.disabled&&node.textContent.trim()===text)||false,{},text);await handle.asElement().click();await handle.dispose();await settle();};
  const action=name=>page.click('[data-warehouse-action="'+name+'"]');
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  const shot=async(name)=>{await noOverflow();await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  const dimensions=()=>page.$eval('[data-warehouse-map]',map=>({columns:Number(map.dataset.gridColumns),rows:Number(map.dataset.gridRows),viewBox:map.getAttribute('viewBox')}));
  const saved=()=>page.evaluate(()=>({state:window.__snapshot.state,cash:window.__snapshot.cashCents,revision:window.__snapshot.revision,requests:window.__requests.length}));
  const assignments=()=>page.$$eval('[data-warehouse-map] [data-zone-kind="culture"][data-zone-id]',nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.zoneId,node.querySelector('[data-zone-buddie]')?.getAttribute('data-zone-buddie')??null])));
  const openSettings=async()=>{const selector='details[data-warehouse-zone-settings]';await page.waitForSelector(selector);if(!await page.$eval(selector,node=>node.open))await page.click(selector+' > summary');await settle();};
  const fields=()=>page.evaluate(()=>Object.fromEntries(['Largeur','Profondeur','Position X','Position Y'].map(label=>{const input=[...document.querySelectorAll('label')].find(node=>node.textContent.startsWith(label))?.querySelector('input');return [label,{value:Number(input.value),min:Number(input.min),max:Number(input.max),disabled:input.disabled}];})));
  const screenPoint=async(x,y)=>page.evaluate(({x,y})=>{const map=document.querySelector('[data-warehouse-map]'),viewport=document.querySelector('[data-warehouse-map-viewport]');const point=new DOMPoint(Number(map.dataset.gridOriginX)+(x+.5)*Number(map.dataset.gridCellSize),Number(map.dataset.gridOriginY)+(y+.5)*Number(map.dataset.gridCellSize)).matrixTransform(map.getScreenCTM());const box=viewport.getBoundingClientRect();return {x:point.x,y:point.y,visible:point.x>Math.max(0,box.left)&&point.x<Math.min(innerWidth,box.right)&&point.y>Math.max(0,box.top)&&point.y<Math.min(innerHeight,box.bottom)&&map.contains(document.elementFromPoint(point.x,point.y))};},{x,y});
  const chip=async(id)=>{const name=await page.evaluate(id=>window.__snapshot.state.zones.find(zone=>zone.id===id).name,id);const handle=await page.waitForFunction(name=>[...document.querySelectorAll('[aria-label="Sélection des zones"] button')].find(node=>node.textContent.includes(name))||false,{},name);await handle.asElement().focus();await page.keyboard.press('Enter');await handle.dispose();await settle();};
  let cdp;
  const drag=async(code,{x,y},{touch,cancel=false,expected='valid'}={})=>{
    await action('overview');await page.$eval('[data-warehouse-map-viewport]',node=>node.scrollIntoView({block:'center',behavior:'instant'}));
    const card='[data-warehouse-buddie-card="'+code+'"]';
    await page.$eval(card,node=>node.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));await settle();
    const start=await page.$eval(card,node=>{const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,visible:node.contains(document.elementFromPoint(x,y))};});
    const end=await screenPoint(x,y);
    assert.ok(start.visible&&end.visible,'Card and compact drop target are simultaneously visible');
    if(touch){cdp??=await page.createCDPSession();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1}]});}
    else{await page.mouse.move(start.x,start.y);await page.mouse.down();}
    for(let step=1;step<=12;step++){
      const point={x:start.x+(end.x-start.x)*step/12,y:start.y+(end.y-start.y)*step/12};
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});else await page.mouse.move(point.x,point.y);
      await settle();
    }
    await page.waitForSelector('[data-warehouse-buddie-ghost]');
    assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-zone-id]')?.dataset.buddieDrop,end),expected,'Compact geometry identifies the correct drop zone');
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
    else{if(cancel)await page.keyboard.press('Escape');await page.mouse.up();}
    await settle();assert.equal(await page.$('[data-warehouse-buddie-ghost]'),null,'Completed gesture clears ghost');
  };

  for(const width of [1440,390,320]) {
    const touch=width<700;
    await page.setViewport({width,height:1000,isMobile:touch,hasTouch:touch});
    await visit('compact');
    assert.deepEqual(await dimensions(),{columns:10,rows:10,viewBox:'0 0 400 400'});
    assert.ok(await page.$eval('[data-warehouse-map]',async map=>{const source=[...map.querySelectorAll('image')].find(node=>node.href.baseVal.endsWith('/overhead-room-100m2-sylvain-v1.webp'));if(!source)return false;const image=new Image();image.src=source.href.baseVal;await image.decode();return image.naturalWidth>0&&image.naturalHeight>0;}),'New compact cartoon room loads');
    assert.equal(await page.$eval('[aria-label="Repères de ton installation"]',node=>node.textContent.includes('/ 100')),true,'Surface shows 100 m²');
    assert.equal(await page.$eval('[data-warehouse-map]',node=>node.getAttribute('aria-label').includes('100 cases')),true);
    await clickText('Aménager');await openSettings();
    assert.deepEqual(await fields(),{'Largeur':{value:1,min:1,max:10,disabled:false},'Profondeur':{value:1,min:1,max:10,disabled:false},'Position X':{value:0,min:0,max:9,disabled:false},'Position Y':{value:0,min:0,max:9,disabled:false}});
    await action('overview');await shot('starter-'+width);
    checks.push('starter '+width+': 100 m², 10×10 accessible geometry and inspector bounds');

    await action('draw');await page.$eval('[data-warehouse-map]',node=>node.focus());
    for(let n=0;n<14;n++){await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');}
    await page.keyboard.press('Enter');await page.keyboard.press('Enter');await settle();await openSettings();
    const boundary=await fields();assert.equal(boundary['Position X'].value,9);assert.equal(boundary['Position Y'].value,9);
    assert.equal(boundary.Largeur.max,1);assert.equal(boundary.Profondeur.max,1);
    assert.equal((await saved()).requests,0,'Drawing only modifies the draft');
    checks.push('keyboard '+width+': cursor clamps to case100 and creates exactly1m² without a purchase');

    await visit('compact&cultures&buddieDrag&persist=compact-'+width);
    await page.waitForSelector('[data-warehouse-buddie-card="HH2026-003"]');
    const before=await saved();await drag('HH2026-003',{x:5,y:1},{touch});
    assert.equal((await assignments()).second,'HH2026-003');assert.deepEqual(await saved(),before,'Drop is an unpaid unsaved draft');
    await page.click('[data-warehouse-culture-action="save"]');
    await page.waitForFunction(()=>window.__snapshot.state.zones.find(zone=>zone.id==='second').buddieCode==='HH2026-003');
    assert.equal((await saved()).cash,before.cash);assert.equal((await saved()).requests,1);
    await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-buddie-dock]');
    assert.equal((await assignments()).second,'HH2026-003');
    await action('overview');await shot('buddies-'+width);
    checks.push('Buddies '+width+': real '+(touch?'touch':'mouse')+' drop, one free save and reload preserve compact active plan');

    const protectedBefore=await assignments();await drag('HH2026-003',{x:1,y:1},{touch,expected:'invalid'});assert.deepEqual(await assignments(),protectedBefore);
    await drag('HH2026-003',{x:1,y:5},{touch,cancel:true});assert.deepEqual(await assignments(),protectedBefore);
    assert.equal((await saved()).requests,0,'Rejected or cancelled gestures do not save after reload');
    await page.focus('[data-warehouse-buddie-card="HH2026-003"]');await page.keyboard.press('Enter');await chip('third');
    assert.equal((await assignments()).third,'HH2026-003');assert.equal((await assignments()).second,null);
    checks.push('Buddies '+width+': active zone rejects drop, cancellation preserves plan and keyboard transfers an idle Buddie');

    await visit('compact&campaign');
    for(const id of ['starter','third']){await chip(id);assert.equal(new URL(await page.evaluate(()=>window.__navigation),origin).searchParams.get('run'),'11111111-1111-4111-8111-111111111111');}
    assert.equal((await saved()).requests,0);await action('overview');await shot('campaign-'+width);
    checks.push('campaign '+width+': both occupied compact zones resume one canonical leader without writing');
  }
  await page.setViewport({width:1440,height:1000});await visit('full');
  assert.deepEqual(await dimensions(),{columns:40,rows:25,viewBox:'0 0 1536 1024'});
  await action('overview');await shot('legacy-full-1440');checks.push('historical floor-less 1,000m² plan keeps its full40×25 geometry');
  await visit('compact&full');await action('overview');await shot('compact-full-1440');
  assert.deepEqual(await dimensions(),{columns:10,rows:10,viewBox:'0 0 400 400'});checks.push('fully allocated compact100m² remains visible');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);checks.push('no JavaScript error or external network request');
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,fixture:'Real production React components with local simulated API responses; no database transaction.',checks,errors,external},null,2));
  console.log('100 m² warehouse audit: '+checks.length+' checks passed.');
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(output,'failure.json'),JSON.stringify({message:error.message,checks,errors,fixtureLog},null,2));throw error;}
finally{await browser?.close();fixture.kill();await Promise.race([new Promise(resolve=>fixture.once('exit',resolve)),delay(3000)]);}
