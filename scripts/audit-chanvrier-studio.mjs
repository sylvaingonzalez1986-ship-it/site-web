import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';

export const entry = `
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {ChanvrierProfileEditor} from '/src/components/contest/ChanvrierProfileEditor';
import {ChanvrierAvatar} from '/src/components/contest/ChanvrierAvatar';
import {QuarterCharacterContext} from '/src/components/contest/QuarterCharacterContext';
import {QuarterCharacterGate} from '/src/components/contest/QuarterCharacterGate';
import {VillagePrototype} from '/src/components/placard/world/VillagePrototype';
import {KqGrowRoom} from '/src/components/placard/KqGrowRoom';
import {createKqWarehouseStarter} from '/src/lib/kanab-quest-warehouse';
import {getWarehouseRoomZones} from '/src/components/placard/culture-room-state';
import {parseChanvrierProfile} from '/src/lib/arena-chanvrier';
import InteriorCanvas from '/src/components/placard/world/InteriorCanvas';
import {createInteriorRoom} from '/src/components/placard/world/interior-rooms';
const plan=createKqWarehouseStarter(), zones=getWarehouseRoomZones(plan, []);
const noop=()=>{}, room=createInteriorRoom('shop',null);
function Fixture(){
  const [record,update]=useState(),[editing,edit]=useState(true),[quality,setQuality]=useState('high');
  useEffect(()=>{fetch('/api/arena/chanvrier').then(r=>r.json()).then(v=>update(parseChanvrierProfile(v.profile)))},[]);
  if(record===undefined)return null;
  const mode=location.search;
  if(mode==='?village')return <QuarterCharacterGate ownerId="studio-player"><VillagePrototype/></QuarterCharacterGate>;
  return <QuarterCharacterContext.Provider value={record}>{mode==='?village'?<VillagePrototype/>:mode==='?culture'?<KqGrowRoom zones={zones} plan={plan} playerProfile={record}/>:mode==='?shop'?<><button id="quality" onClick={()=>setQuality('low')}>Qualité réduite</button><div style={{position:'relative',height:'90vh'}}><InteriorCanvas room={room} profile={record} followPlayer suspended={false} editing={false} overhead={false} grid={false} quality={quality} sensitivity={1} selectedId={null} preview={null} previewValid onSelect={noop} onInteract={noop} onPlace={noop} onExit={noop} onReady={noop} onUnavailable={noop}/></div></>:editing?<ChanvrierProfileEditor profile={record} skipInheritance onSaved={p=>{update(p);edit(false)}} onClose={()=>edit(false)} />:<><button id="edit" onClick={()=>edit(true)}>Modifier</button>{record&&<div style={{width:200}}><ChanvrierAvatar profile={record}/></div>}</>}</QuarterCharacterContext.Provider>
}createRoot(document.querySelector('#main-content')).render(<Fixture/>);
`;

export async function run({origin,output}) {
  const browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader'],userDataDir:join(output,'chrome')});
  const report = { scope:'Chromium local, API de profil simulée, émulation tactile. Les intervalles portent sur les images WebGL de l’aperçu et le tas sur la page entière.', frames:[], captures:[], errors:[] };
  const page=await browser.newPage();
  const cdp=await page.createCDPSession();
  page.setDefaultTimeout(60000);
  let profile=null, requests=0, rejectOnce=true;
  const desktop={width:1360,height:900,deviceScaleFactor:1}, phone={width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1};
  const stage='[data-preview-state="ready"]';
  const button=(label)=>`button[aria-label="${label}"]`;
  const byText=async(label,scope='button')=>{
    const found=await page.evaluateHandle((label,scope)=>[...document.querySelectorAll(scope)].find(n=>n.textContent.trim()===label && n.getClientRects().length),label,scope);
    const element=found.asElement();
    assert(element,'Missing visible control '+label);
    await element.click(); await found.dispose();
  };
  const category=(name)=>byText(name,'nav[aria-label="Personnaliser l’apparence"] button');
  const shot=async(name)=>{
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const {cssVisualViewport:v}=await cdp.send('Page.getLayoutMetrics');
    const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,
      clip:{x:v.pageX,y:v.pageY,width:v.clientWidth,height:v.clientHeight,scale:1}});
    await writeFile(join(output,name+'.png'),Buffer.from(data,'base64'));
    report.captures.push(name+'.png');
  };
  const layout=async()=>page.evaluate(()=>{
    const d=document.querySelector('dialog'), el=document.querySelector('[data-preview-state]'), r=el.getBoundingClientRect();
    return { viewport:[innerWidth,innerHeight], dialog:[d.clientWidth,d.scrollWidth],preview:[Math.round(r.width),Math.round(r.height)], overflows:document.documentElement.scrollWidth>innerWidth || d.scrollWidth>d.clientWidth+2 };
  });
  const measure=async(label)=>{
    await page.evaluate(()=>{window.avatarFrames=[];});
    await new Promise(resolve=>setTimeout(resolve,2400));
    const samples=await page.evaluate(()=>window.avatarFrames);
    assert(samples.length>=2,'Preview animation rendered at least twice: '+label);
    const times=samples.slice(1).map((t,i)=>t-samples[i]).sort((a,b)=>a-b);
    const span=samples.at(-1)-samples[0];
    report.frames.push({label,count:samples.length,meanFps:+(1000*times.length/span).toFixed(1),
      medianMs:+times[Math.floor(times.length*.5)].toFixed(1),p95Ms:+times[Math.floor(times.length*.95)].toFixed(1),
      slowestMs:+times.at(-1).toFixed(1),heapMiB:+((await page.metrics()).JSHeapUsedSize/1048576).toFixed(1)});
  };
  try{
    await page.setRequestInterception(true);
    page.on('request',r=>{
      const u=new URL(r.url());
      if(u.pathname==='/api/arena/tutorial')return void r.respond({status:200,contentType:'application/json',body:JSON.stringify({userId:'studio-player',chanvrier:profile})});
      if(u.pathname==='/api/arena/chanvrier') {
        if(r.method()==='POST'){requests++;if(rejectOnce){rejectOnce=false;return void r.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Interruption de test'})});}profile=JSON.parse(r.postData());}
        return void r.respond({status:200,contentType:'application/json',body:JSON.stringify({profile,created:requests===2})});
      }
      if(u.pathname.startsWith('/api/'))return void r.respond({status:200,contentType:'application/json',body:'{"items":[],"cashCents":100,"activeRun":false,"readyLotCount":0,"availableFlowerCount":0}'});
      if(u.hostname==='127.0.0.1'||u.protocol==='data:'||u.protocol==='blob:')void r.continue();else void r.abort();
    });
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.evaluateOnNewDocument(()=>{
      window.avatarFrames=[];
      const original=WebGL2RenderingContext.prototype.clear;
      WebGL2RenderingContext.prototype.clear=function(bits){
        if(this.canvas.closest?.('[data-preview-state]') && window.avatarFrames.length<600)window.avatarFrames.push(performance.now());
        return original.call(this,bits);
      };
    });
    await page.setViewport(desktop);await page.goto(origin);await page.waitForSelector(stage);
    report.graphics=await page.$eval(stage+' canvas',canvas=>{
      const gl=canvas.getContext('webgl2'), ext=gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'indisponible';
    });
    await page.type('input[autocomplete="nickname"]','Mael29');
    await category('Cheveux');await page.click(button('Coupe de cheveux : Tresses'));
    await category('Tenue');await byText('Fête en pays bigouden');
    await page.waitForSelector('[data-avatar-state="ready"]');
    assert.equal((await layout()).overflows,false);
    await shot('atelier-breton-ordinateur');
    await byText('Faire marcher');await measure('1360 × 900 · marche');
    await page.click(button('Tourner à droite'));assert.notEqual(await page.$eval(stage,n=>n.dataset.previewRotation),'0.000');
    await page.click(button('Recentrer la vue'));
    await page.click(button('Vue du Quartier en isométrie'));
    await shot('atelier-echelle-quartier');
    // Puppeteer reloads the document when setViewport switches isMobile. Rotate
    // this live editor using CDP so a viewport change never replaces its draft.
    const resizePhone=async(width,height)=>{
      await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
      await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    };
    await resizePhone(phone.width,phone.height);
    await page.click(button('En pied'));await measure('390 × 844 · marche');
    const box=await (await page.$(stage)).boundingBox();
    const start={x:box.x+box.width*.31,y:box.y+box.height*.5};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...start,x:start.x+40}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.notEqual(await page.$eval(stage,n=>n.dataset.previewRotation),'0.000');
    await page.click(button('Recentrer la vue'));
    await shot('atelier-telephone');
    const before=await page.metrics();
    for(let i=0;i<18;i++)await byText(i%2?'Fête en pays bigouden':'Grain au large');
    const after=await page.metrics();
    report.rapidChanges={count:18,heapBeforeMiB:+(before.JSHeapUsedSize/1048576).toFixed(1),heapAfterMiB:+(after.JSHeapUsedSize/1048576).toFixed(1)};
    await category('Cheveux');
    for(let i=0;i<12;i++)await page.click(button('Coupe de cheveux : '+(i%2?'Tresses':'Ondulations')));
    await category('Tenue');
    await page.select('dialog select','clothing');
    for(const color of ['#417891','#437993','#497d96','#417995','#49829c','#427a91']){
      await page.$eval('input[type=color]',(n,hex)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(n,hex);n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));},color);
    }
    report.rapidChanges.hair=12;report.rapidChanges.colors=6;
    const apply=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='Appliquer'&&!n.disabled));
    if(apply.asElement())await apply.asElement().click();
    await apply.dispose();
    await resizePhone(844,390);
    assert.equal(await page.$eval('dialog select',s=>s.value),'clothing');
    assert.equal((await layout()).overflows,false);
    await shot('atelier-paysage');
    await resizePhone(320,640);
    report.smallScreen=await layout();assert.equal(report.smallScreen.overflows,false);await shot('atelier-320');
    assert.equal(requests,0);
    await page.click('[data-profile-next]'); await page.click('[data-profile-next]'); await page.click('[name=confirm-strength]');await page.click('[data-profile-next]');
    await page.waitForSelector('dialog [role=alert]');await page.click('[data-profile-next]');await page.waitForSelector('#edit');assert.equal(requests,2);
    assert.equal(profile.appearance.hair,'braids');assert.equal(profile.appearance.headwear,'bigouden-coif');assert.equal(profile.appearance.dyes.top,'#427a91');
    report.saved=profile;
    await page.reload();await page.waitForSelector(stage);await category('Cheveux');assert.equal(await page.$eval(button('Coupe de cheveux : Tresses'),b=>b.getAttribute('aria-pressed')),'true');
    await category('Tenue');await page.select('dialog select','clothing');assert.equal(await page.$eval('input[type=color]',el=>el.value),'#427a91');
    await page.select('dialog select','outfits');await byText('Grain au large');await byText('Annuler');
    await byText('Grain au large');await page.keyboard.press('Escape');await page.waitForSelector('#edit');assert.equal(requests,2);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:desktop.width,height:desktop.height,deviceScaleFactor:1,mobile:false});
    await page.goto(origin+'/?culture');await page.waitForSelector('[data-personalized="true"]');await shot('salle-culture');
    await page.goto(origin+'/?shop');await page.waitForSelector('canvas[data-ready="true"]');await page.click('#quality');await page.waitForSelector('canvas[data-quality="low"]');await shot('boutique-qualite-reduite');
    await page.goto(origin+'/?village');await page.waitForSelector('canvas[data-village-ready="true"]');
    await page.click('details:has([data-observe-life="player"]) summary');await page.click('[data-observe-life="player"]');await page.waitForSelector('canvas[data-life-observe="player"][data-camera-transition="idle"]');
    await shot('personnage-au-quartier');
    await page.click('details:has([data-observe-life="player"]) summary');await byText('Modifier mon personnage');
    await page.waitForSelector(stage);await category('Tenue');await page.select('dialog select','clothing');
    assert.equal(await page.$eval('input[type=color]',el=>el.value),'#427a91');
    await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});assert.equal(requests,2);
    await page.evaluateOnNewDocument(()=>{
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args)};
    });
    await page.goto(origin);await page.waitForSelector('[data-preview-state="fallback"] [data-avatar-state="ready"]');
    const ink=await page.$eval('[data-preview-state="fallback"] canvas[data-avatar-state="ready"]',canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])visible++;return visible;
    });
    assert(ink>200);report.softwarePortraitPixels=ink;
    assert.deepEqual(report.errors,[]);report.passed=true;
  }finally{
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
  }
  console.log(JSON.stringify({passed:true,images:report.captures,frames:report.frames}));
}
