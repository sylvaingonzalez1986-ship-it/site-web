import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { frameVillageSubject } from './fixtures/village-audit-camera.mjs';

export const entry = `
import React from "react";import {createRoot} from "react-dom/client";
import {VillagePrototype} from "/src/components/placard/world/VillagePrototype";
import {QuarterCharacterContext} from "/src/components/contest/QuarterCharacterContext";
import {KqQuizzShowScene} from "/src/components/placard/KqQuizzShowScene";
import * as three from "audit-world-three";
window.probeThree = three;
const profile={nickname:"Camille",gender:"female",skin:"honey",clothing:"teal",strength:"merchant"};
const room=new URLSearchParams(location.search).get("room");
const Farm=React.lazy(async()=>{
  const {KqGrowRoomIsometric}=await import("/src/components/placard/KqGrowRoomIsometric");
  const {createKqWarehouseStarter}=await import("/src/lib/kanab-quest-warehouse");
  const plan=createKqWarehouseStarter();
  const zones=plan.zones.map(zone=>({id:zone.id,name:zone.name,status:"idle",areaM2:zone.width*zone.height}));
  function Interior(){const [selected,select]=React.useState(null);return <KqGrowRoomIsometric plan={plan} zones={zones} selected={selected} onSelect={i=>select(zones[i]?.id??null)} onKey={()=>{}} profile={profile} visible motion={false}/>;}
  return {default:Interior};
});
createRoot(document.getElementById("main-content")).render(room==="ferme" ?
  <React.Suspense><Farm/></React.Suspense> : room ?
  <div style={{width:"100vw",height:"100vh",background:"#eeddb9",display:"grid",alignContent:"center"}}><KqQuizzShowScene mode="hall" onChoose={id=>document.body.dataset.destination=id}/></div> :
  <QuarterCharacterContext.Provider value={profile}><VillagePrototype/></QuarterCharacterContext.Provider>);`;

const root = resolve('output/village-faune');
const ready = 'canvas[data-village-ready="true"][data-motion-state="running"]';
const baseline = process.argv.includes('--baseline');
const moving = process.argv.includes('--moving');
const repeatCourse = moving && process.argv.includes('--repeat');
const label = baseline ? 'avant' : 'apres';
const wait = ms => new Promise(done => setTimeout(done, ms));

async function comparison(name, scenes) {
  const width=760, height=400, margin=10, rowHeight=height+37;
  const pieces=[];
  const caption=(title,x,y,size)=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="bold" fill="#203d3b">${title}</text>`;
  let type=caption('Avant',margin,29,24)+caption('Après',width+margin*2,29,24);
  for(const [row,[file,title]] of scenes.entries()) {
    const y=40+row*rowHeight;
    type+=caption(title,margin,y+19,18);
    for(const [col,version] of ['avant','apres'].entries()) {
      const input=await sharp(resolve(root,version,file+'.png')).resize(width,height,{fit:'contain',background:'#e8e5db'}).png().toBuffer();
      pieces.push({input,top:y+26,left:margin+col*(width+margin)});
    }
  }
  const w=width*2+3*margin, h=40+scenes.length*rowHeight;
  pieces.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${type}</svg>`),top:0,left:0});
  await sharp({create:{width:w,height:h,channels:3,background:'#f3efdf'}}).composite(pieces).webp({quality:91}).toFile(resolve(root,name+'.webp'));
}

export async function writeComparisons() {
  await comparison('comparatif-quartier',[['bureau','Vue générale'],['ferme','La ferme'],['littoral','Le chenal et le phare']]);
  await comparison('comparatif-parcours',[['paysage','Le Quartier en paysage tactile'],['personnage','Suivi du personnage'],['echange','Dialogue avec le pêcheur']]);
  await comparison('comparatif-interieurs',[['entrepot','Entrepôt de la ferme'],['interieur','Salle du QuizzShow']]);
}

async function measure(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), data = canvas.dataset;
    const intervals = [], cpu = [], stalls = [];
    const start = performance.now(), first = Number(data.renderFrames);
    let last = first;
    do {
      await new Promise(requestAnimationFrame);
      if (last === Number(data.renderFrames)) continue;
      last = Number(data.renderFrames);
      const frameMs=Number(data.frameInterval), cpuMs=Number(data.renderSubmitMs);
      intervals.push(frameMs); cpu.push(cpuMs);
      if(frameMs>50) stalls.push({atMs:Math.round(performance.now()-start),frameMs,cpuMs,camera:data.cameraTransition});
    } while (performance.now() - start < 4500);
    intervals.sort((a,b) => a-b); cpu.sort((a,b) => a-b);
    const pct = (list, p) => list[Math.floor((list.length-1)*p)];
    const ctx = canvas.getContext('webgl2'), ext = ctx.getExtension('WEBGL_debug_renderer_info');
    return {
      fps: (last-first)*1000/(performance.now()-start), frames:last-first,
      p95Ms:pct(intervals,.95), maxMs:intervals.at(-1), above50Ms:intervals.filter(t=>t>50).length,
      stalls, cpuP95Ms:pct(cpu,.95), drawCalls:+data.drawCalls, triangles:+data.triangles, textures:+data.textures,
      buffer:[canvas.width,canvas.height], gpu:ctx.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : ctx.RENDERER)
    };
  });
}

async function measureCameraCourse(page) {
  const click=async label => {
    const target='button[aria-label="'+label+'"]';
    if (page.viewport().hasTouch) await page.tap(target); else await page.click(target);
  };
  const [sample]=await Promise.all([measure(page),(async()=>{
    await wait(250);
    for(const label of ['Tourner à droite','Tourner à droite','Tourner à gauche','Recentrer la vue isométrique']) {
      await click(label); await wait(680);
    }
    await page.waitForSelector('canvas[data-camera-transition="idle"]');
  })()]);
  return sample;
}

/** Capture the mounted landscape through a second lens; preserve the player's live camera and HUD. */
async function detail(page, target, span, name, dir) {
  const png = await page.evaluate(({target, span}) => {
    const canvas=document.querySelector('canvas'), T=window.probeThree;
    const {gl,scene,camera}=T.fiberRoots.get(canvas).store.getState();
    const c=camera.clone(), center=new T.Vector3();
    if(target==='coastal-flock') {
      const birds=scene.getObjectByName('gull-flight-poses').children.filter(bird=>bird.visible);
      const companions=birds.filter(bird=>bird.userData.route===birds[0].userData.route);
      for(const bird of companions) center.add(bird.position);
      center.divideScalar(companions.length);
    } else center.fromArray(target);
    c.position.copy(center).add(new T.Vector3(32.527,32.527,32.527));
    c.lookAt(center); c.zoom=(c.top-c.bottom)/span; c.updateProjectionMatrix(); c.updateMatrixWorld();
    gl.render(scene,c);
    const url=canvas.toDataURL('image/png');
    gl.render(scene,camera); return url;
  },{target,span});
  await writeFile(resolve(dir,name+'.png'),Buffer.from(png.split(',')[1],'base64'));
}

async function recordCoastalFlight(page, dir) {
  await page.evaluate(() => {
    const {scene,camera}=window.probeThree.fiberRoots.get(document.querySelector('canvas')).store.getState();
    const bird=scene.getObjectByName('gull-flight-poses').children[1];
    const offset=camera.position.clone().set(32.527,32.527,32.527);
    const previous=camera.clone();
    let raf;
    function follow() {
      camera.position.copy(bird.position).add(offset);
      camera.lookAt(bird.position); camera.zoom=(camera.top-camera.bottom)/6.5;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      raf=requestAnimationFrame(follow);
    }
    follow();
    window.restoreFlightCamera=() => { cancelAnimationFrame(raf); camera.copy(previous); camera.updateMatrixWorld(); };
  });
  try {
    const video=await page.screencast({path:resolve(dir,'vol-littoral.webm'),ffmpegPath,fps:20,scale:.8});
    try { await wait(5500); } finally { await video.stop(); }
  } finally {
    await page.evaluate(() => { window.restoreFlightCamera(); delete window.restoreFlightCamera; });
  }
}

async function walkOnPath(page) {
  const points=await page.evaluate(()=>{
    const canvas=document.querySelector('canvas'), T=window.probeThree;
    const {scene,camera}=T.fiberRoots.get(canvas).store.getState(), player=scene.getObjectByName('chanvrier');
    const terrain=scene.getObjectByName('village-landscape'), box=canvas.getBoundingClientRect();
    const origin=player.position.toArray(), result=[];
    for(const path of terrain.userData.groundPaths) for(const p of path.samples) {
      const d=Math.hypot(p.x-origin[0],p.z-origin[2]);
      if(d<1.1 || d>3.8) continue;
      const projected=new T.Vector3(p.x,.08,p.z).project(camera);
      const x=box.left+(1+projected.x)*box.width/2, y=box.top+(1-projected.y)*box.height/2;
      if(document.elementFromPoint(x,y)!==canvas || result.some(q=>Math.hypot(q.x-x,q.y-y)<10)) continue;
      const ray=new T.Raycaster();
      ray.setFromCamera(new T.Vector2(projected.x,projected.y),camera);
      const first=ray.intersectObjects(scene.children,true).find(hit=>hit.object.visible);
      if(first && first.object.parent===terrain) result.push({x,y});
    }
    return {origin,result};
  });
  for(const p of points.result.slice(0,12)) {
    await page.mouse.click(p.x,p.y);
    const moved=await page.waitForFunction((origin)=>{
      const scene=window.probeThree.fiberRoots.get(document.querySelector('canvas')).store.getState().scene;
      const p=scene.getObjectByName('chanvrier').position;
      return Math.hypot(p.x-origin[0],p.z-origin[2])>.18;
    },{timeout:1500},points.origin).then(()=>true,()=>false);
    if(moved) return;
  }
  throw new Error('A click on the ground did not move the player: '+JSON.stringify(points));
}

async function observe(page, subject) {
  const menu='details:has([data-observe-life])';
  const choice='[data-observe-life="' + subject + '"]';
  const tap=page.viewport()?.hasTouch;
  if(tap) await page.tap(menu+' summary'); else await page.click(menu+' summary');
  await page.waitForSelector(menu+'[open] '+choice,{visible:true});
  if(tap) await page.tap(choice); else await page.click(choice);
  try {
    await page.waitForSelector('canvas[data-life-observe="' + subject + '"][data-camera-transition="idle"]',{timeout:8000});
  } catch(error) {
    const state=await page.evaluate(({menu,choice})=>{
      const item=document.querySelector(choice), canvas=document.querySelector('canvas'), r=item.getBoundingClientRect();
      return {open:document.querySelector(menu).open, pressed:item.getAttribute('aria-pressed'), camera:canvas.dataset.cameraTransition,
        subject:canvas.dataset.lifeObserve, focused:document.activeElement?.outerHTML.slice(0,220),
        at:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,220)};
    },{menu,choice});
    throw new Error('Observer '+subject+' '+JSON.stringify(state),{cause:error});
  }
}

export async function auditWorld(origin) {
  const dir=resolve(root,label); await mkdir(dir,{recursive:true});
  const report={label, passed:false, api:[], external:[], errors:[], performance:{}, readyMs:{}, samples:{}, interactions:[]};
  const browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage(); page.setDefaultTimeout(60000);
    page.on('pageerror', e=>report.errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',request=>{
      const url=new URL(request.url());
      if(url.pathname==='/favicon.ico') return void request.respond({status:204});
      if(url.pathname.startsWith('/api/')) {
        report.api.push(request.method()+' '+url.pathname);
        const body=url.pathname.endsWith('/equipment') ? {activeRun:true,cashCents:125000,readyLotCount:3,availableFlowerCount:2,curingFlowerCount:1} :
          url.pathname.endsWith('/feedback') ? {items:[],total:0,hasMore:false} : null;
        if(body) return void request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
      }
      if(url.origin===origin || ['data:','blob:'].includes(url.protocol)) return void request.continue();
      report.external.push(url.origin); void request.abort();
    });
    report.browser=await browser.version();
    for(const [device,width,height,mobile] of [['bureau',1440,900,false],['paysage',844,390,true]]) {
      await page.setViewport({width,height,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile,isLandscape:true});
      const started=performance.now();
      await page.goto(origin,{waitUntil:'domcontentloaded'}); await page.waitForSelector(ready);
      report.readyMs[device]=Math.round(performance.now()-started);
      await page.click('button[aria-label="Recentrer la vue isométrique"]');
      await page.mouse.move(width*.52,4); await wait(1100);
      if(moving) {
        report.performance[device]=[];
        for(let i=0;i<(repeatCourse?3:1);i++) report.performance[device].push(await measureCameraCourse(page));
        report.interactions.push(device+'-rotations-recentrage');
        continue;
      }
      report.performance[device]=[];
      for(let i=0;i<3;i++) report.performance[device].push(await measure(page));
      if(!baseline && mobile) assert.ok(report.performance[device].every(s=>s.buffer[0]<=Math.ceil(width*1.25)), 'Mobile DPR budget');
      await page.screenshot({path:resolve(dir,device+'.png')});
      if(!mobile) {
        await detail(page,[-12,1,3.8],9,'ferme',dir);
        await detail(page,[-12.6,.42,5.6],4.6,'paturage',dir);
        await detail(page,[-9,1.4,-11],17,'littoral',dir);
        if(!baseline) {
          await detail(page,'coastal-flock',5.4,'mouettes',dir);
          await recordCoastalFlight(page,dir);
        }
        await walkOnPath(page); report.interactions.push('player-walk');
        await frameVillageSubject(page,'player');
        await page.screenshot({path:resolve(dir,'personnage.png')});
        await observe(page,'fisherman');
        await page.focus('[data-npc-access="fisherman"]'); await page.keyboard.press('Enter');
        await page.waitForSelector('[data-npc-dialogue="fisherman"]');
        await page.waitForSelector('canvas[data-camera-transition="idle"]');
        await page.screenshot({path:resolve(dir,'echange.png')});
        await page.click('[data-npc-next]'); await page.click('[aria-label="Fermer l’échange"]');
        await page.click('[aria-label="Recentrer la vue isométrique"]'); await wait(600);
        report.interactions.push('dialogue');
      }
      report.samples[device]=await page.evaluate(()=>{
        const canvas=document.querySelector('canvas'), {scene}=window.probeThree.fiberRoots.get(canvas).store.getState();
        const gulls=scene.getObjectByName('gull-flight-poses');
        const sheep=[];
        scene.traverse(obj=>{if(obj.userData.species==='sheep') sheep.push({pos:obj.position.toArray(),...obj.userData});});
        return {sheep,gulls:gulls?.children.map(b=>({pos:b.position.toArray(),...b.userData}))??[], quality:canvas.dataset.lifeQuality};
      });
      await page.focus('[data-village-building="warehouse"]'); await page.keyboard.press('Enter');
      await page.waitForSelector('[data-building="warehouse"] a[href*="view=workshop"]');
      await page.click('[aria-label="Fermer les activités du bâtiment"]');
      report.interactions.push(device+'-farm');
      if(!mobile) continue;
      await page.click('[aria-label="Recentrer la vue isométrique"]'); await wait(600);
      const recorder=await page.screencast({path:resolve(dir,'quartier-paysage.webm'),ffmpegPath,fps:15,scale:.8});
      await wait(2200);
      await page.click('[aria-label="Tourner à droite"]'); await wait(2200);
      await recorder.stop();
      if(!baseline) {
        await page.click('[aria-label="Recentrer la vue isométrique"]'); await wait(550);
        await frameVillageSubject(page,'sheep');
        const flockVideo=await page.screencast({path:resolve(dir,'troupeau.webm'),ffmpegPath,fps:20,scale:.8});
        await wait(6500); await flockVideo.stop();
        await page.screenshot({path:resolve(dir,'observer-troupeau.png')});
        report.interactions.push('sheep-camera-recording');
      }
      await page.click('[data-village-motion-toggle]'); await page.waitForSelector('canvas[data-motion-state="paused"]');
      const time=()=>page.$eval('canvas',c=>c.dataset.motionTime), paused=await time(); await wait(400); assert.equal(await time(),paused);
      await page.click('[data-village-motion-toggle]'); await page.waitForSelector(ready);
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
      await page.waitForSelector('canvas[data-motion-state="reduced"]'); await wait(90);
      const still=await time(); await wait(300); assert.equal(await time(),still);
      report.interactions.push('pause','reduced-motion');
      await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    }
    if(moving) { assert.deepEqual(report.errors,[]); assert.deepEqual(report.external,[]); report.passed=true; return; }
    await page.setViewport({width:1100,height:720,deviceScaleFactor:1});
    await page.goto(origin+'/?room=1',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-quizzshow-scene="hall"] canvas[data-live="true"]');
    await page.screenshot({path:resolve(dir,'interieur.png')});
    await page.goto(origin+'/?room=ferme',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-grow-camera][data-renderer="webgl"]');
    await page.screenshot({path:resolve(dir,'entrepot.png')});
    assert.deepEqual(report.errors,[]); assert.deepEqual(report.external,[]);
    if(!baseline) {
      assert.ok(report.samples.bureau.sheep.length>=3 && report.samples.bureau.sheep.every(s=>s.active));
      assert.ok(report.samples.bureau.gulls.length>=6);
    }
    report.passed=true;
  } finally {
    const filename=repeatCourse?'parcours-reprises.json':moving?'parcours.json':'mesures.json';
    await writeFile(resolve(dir,filename),JSON.stringify(report,null,2));
    await browser.close();
  }
  if(!baseline && await access(resolve(root,'avant','mesures.json')).then(()=>true,()=>false)) await writeComparisons();
  console.log(label,report.performance,report.interactions);
}
