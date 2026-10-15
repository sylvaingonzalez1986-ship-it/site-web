/** Real warehouse editor, local synthetic APIs, no production network or writes. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const output=resolve('output/warehouse-fixed-plan');
await mkdir(output,{recursive:true});
let source=(await readFile('scripts/audit-placard-warehouse-v4.mjs','utf8')).split("if(process.argv.includes('--preview'))")[0];
assert(source.includes('await server.listen();'),'Known local warehouse fixture');
source=source.replace("'output/warehouse-v4'","'output/warehouse-fixed-plan'").replace('?? 3248','?? 3281');
source=source.replace('const server = await createServer',"modules['next/link']+='export const useLinkStatus=()=>({pending:false});';\nconst server = await createServer");
source=source.replace('const [closed,setClosed]=React.useState(false);return','const [closed,setClosed]=React.useState(false);window.__unmountWarehouse=()=>setClosed(true);return');
source+=String.raw`
const only=process.argv.find(argument=>argument.startsWith('--only='))?.slice(7);
const matches=name=>!only||(only.endsWith('*')?name.startsWith(only.slice(0,-1)):name===only);
const previous=only?JSON.parse(await readFile(resolve(output,'report.json'),'utf8').catch(()=>'{}')):{};
let browser,page,cdp;const checks=only?(previous.checks??[]).filter(check=>!matches(check.name)):[],errors=previous.errors??[],blocked=previous.blocked??[];
const report=async()=>writeFile(resolve(output,'report.json'),JSON.stringify({passed:checks.every(item=>item.passed)&&errors.length===0,checks,errors,blocked,mode:'Actual KqWarehouse and KqWarehousePlan, browser-local synthetic API, all external and real API network blocked'},null,2));
try{
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();cdp=await page.createCDPSession();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>void dialog.accept());
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{blocked.push(request.url());void request.abort();}});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const frame=async()=>{await page.$eval('[data-warehouse-map-viewport]',node=>node.scrollIntoView({block:'center',behavior:'instant'}));await settle();};
 const visit=async()=>{await page.goto(origin+'/?compact',{waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-map] [data-zone-id]');await frame();};
 const viewport=()=>page.evaluate(()=>{
  const svg=document.querySelector('[data-warehouse-map]'),view=document.querySelector('[data-warehouse-map-viewport]'),rect=svg.getBoundingClientRect(),bounds=view.getBoundingClientRect(),matrix=svg.getScreenCTM(),x=Number(svg.dataset.gridOriginX),y=Number(svg.dataset.gridOriginY),cell=Number(svg.dataset.gridCellSize),columns=Number(svg.dataset.gridColumns),rows=Number(svg.dataset.gridRows);
  const start=new DOMPoint(x,y).matrixTransform(matrix),end=new DOMPoint(x+columns*cell,y+rows*cell).matrixTransform(matrix);
  return {columns,rows,left:rect.left,top:rect.top,width:rect.width,height:rect.height,scrollLeft:view.scrollLeft,scrollTop:view.scrollTop,scrollWidth:view.scrollWidth,scrollHeight:view.scrollHeight,clientWidth:view.clientWidth,clientHeight:view.clientHeight,grid:{left:start.x,top:start.y,right:end.x,bottom:end.y,width:end.x-start.x,height:end.y-start.y},fits:start.x>=bounds.left-1&&end.x<=bounds.right+1&&start.y>=bounds.top-1&&end.y<=bounds.bottom+1&&start.x>=0&&end.x<=innerWidth&&start.y>=0&&end.y<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,fixed:view.dataset.fixedCamera};
 });
 const zones=()=>page.$$eval('[data-warehouse-map] [data-zone-id]',nodes=>nodes.map(node=>{const rect=[...node.children].find(child=>child.tagName==='rect'),map=node.closest('svg'),cell=Number(map.dataset.gridCellSize);return {id:node.dataset.zoneId,x:(Number(rect.getAttribute('x'))-Number(map.dataset.gridOriginX))/cell,y:(Number(rect.getAttribute('y'))-Number(map.dataset.gridOriginY))/cell,width:Number(rect.getAttribute('width'))/cell,height:Number(rect.getAttribute('height'))/cell};}));
 const noWrites=async()=>assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[],'No API mutation before explicit confirmation');
 const point=(x,y)=>page.$eval('[data-warehouse-map]',(map,{x,y})=>{const p=new DOMPoint(Number(map.dataset.gridOriginX)+(x+.5)*Number(map.dataset.gridCellSize),Number(map.dataset.gridOriginY)+(y+.5)*Number(map.dataset.gridCellSize)).matrixTransform(map.getScreenCTM());return {x:p.x,y:p.y};},{x,y});
 const action=async name=>{await page.click('[data-warehouse-action="'+name+'"]');await settle();};
 const drawMode=async()=>{if(await page.$eval('[data-warehouse-map]',node=>node.dataset.drawing!=='true'))await action('draw');await frame();};
 const press=async(p,touch)=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});else{await page.mouse.move(p.x,p.y);await page.mouse.down();}};
 const move=async(p,touch)=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});else await page.mouse.move(p.x,p.y);await settle();};
 const release=async(touch,cancel=false)=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});else{if(cancel)await page.keyboard.press('Escape');await page.mouse.up();}await settle();};
 const draw=async(start,end,{touch=false,cancel=false,screenshot,valid=true}={})=>{
  await drawMode();const before=await zones(),camera=await viewport(),a=await point(start.x,start.y),b=await point(end.x,end.y);await press(a,touch);
  for(let step=1;step<=8;step++)await move({x:a.x+(b.x-a.x)*step/8,y:a.y+(b.y-a.y)*step/8},touch);
  await page.waitForSelector('[data-warehouse-draw-preview]');
  const preview=await page.$eval('[data-warehouse-draw-preview]',node=>({valid:node.dataset.valid==='true',width:Number(node.dataset.width),height:Number(node.dataset.height),area:Number(node.dataset.area)}));
  const stable=measurement=>{for(const key of ['left','top','width','height'])assert(Math.abs(camera[key]-measurement[key])<=2,'Plan remains stable during and after gesture: '+key+' delta '+(measurement[key]-camera[key]));};
  stable(await viewport());assert.equal(preview.valid,valid,'Preview validity');assert.deepEqual(await zones(),before,'No zone commit before pointer release');await noWrites();if(screenshot)await page.screenshot({path:resolve(output,screenshot+'-preview.png')});
  await release(touch,cancel);await page.waitForSelector('[data-warehouse-draw-preview]',{hidden:true});const after=await zones();
  assert.equal(after.length,before.length+(valid&&!cancel?1:0),'Exactly one zone committed on a valid release');
  if(valid&&!cancel){const added=after.find(zone=>!before.some(previous=>previous.id===zone.id));assert.deepEqual({width:added.width,height:added.height},{width:preview.width,height:preview.height});}
  await noWrites();stable(await viewport());await frame();const nextCamera=await viewport();assert(Math.abs(nextCamera.width-camera.width)<1,'Drawing does not zoom the plan');
  if(screenshot)await page.screenshot({path:resolve(output,screenshot+'-finished.png')});return {preview,added:after.find(zone=>!before.some(previous=>previous.id===zone.id))};
 };
 const run=async(name,fn)=>{if(!matches(name))return;try{const detail=await fn();checks.push({name,passed:true,...detail});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});console.error('FAIL '+name+': '+error.message);await page.screenshot({path:resolve(output,'failed-'+name.replace(/[^a-z0-9-]/gi,'-')+'.png')}).catch(()=>{});await release(true,true).catch(()=>{});await page.mouse.up().catch(()=>{});}await report();};
 for(const [width,height] of [[320,740],[390,844],[430,932],[844,390],[1440,900]]){
  await page.setViewport({width,height,isMobile:width<1000,hasTouch:width<1000});
  await run('fixed-'+width,async()=>{
   await visit();const first=await viewport();assert.equal(first.fixed,'true');assert.equal(first.columns,10);assert.equal(first.rows,10);assert(first.fits,'All 100 cells fit simultaneously');assert(!first.overflow,'No horizontal page overflow');assert(first.scrollWidth<=first.clientWidth+1&&first.scrollHeight<=first.clientHeight+1,'Map has no pan range');
   assert.equal(await page.$$eval('[data-warehouse-action="zoom-in"],[data-warehouse-action="zoom-out"],input[aria-label="Zoom du plan"]',nodes=>nodes.filter(node=>node.getClientRects().length>0).length),0,'No compact zoom controls');
   const selected=await point(2,9);await page.mouse.click(selected.x,selected.y);await frame();const selection=await viewport();assert(Math.abs(first.width-selection.width)<1,'Selection does not zoom');
   const free=await point(7,7);await page.mouse.move(free.x,free.y);await page.mouse.wheel({deltaY:-240});await settle();await frame();
   const a=await point(7,7),b=await point(8,8);await press(a,false);await move(b,false);await release(false);await frame();const after=await viewport();assert(Math.abs(first.width-after.width)<1,'Wheel and background drag do not zoom');assert.equal(after.scrollLeft,0);assert.equal(after.scrollTop,0);await noWrites();await page.screenshot({path:resolve(output,'fixed-'+width+'.png')});return {width,height,grid:first.grid,scaleWidth:first.width};
  });
  await run('mouse-draw-'+width,async()=>{await visit();return await draw({x:6,y:6},{x:7,y:7},{screenshot:'mouse-'+width});});
  if(width<1000)await run('touch-draw-'+width,async()=>{await visit();return await draw({x:6,y:6},{x:8,y:8},{touch:true,screenshot:'touch-'+width});});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await run('grid-control-320',async()=>{
  await page.setViewport({width:320,height:740,isMobile:true,hasTouch:true});await visit();
  const control=await page.$eval('[aria-label="Afficher la grille"]',button=>{const rect=button.getBoundingClientRect(),toolbar=button.parentElement.parentElement.getBoundingClientRect(),parts=[...button.children].map(child=>{const r=child.getBoundingClientRect();return {tag:child.tagName,text:child.textContent,width:r.width,height:r.height,contained:r.left>=rect.left-1&&r.right<=rect.right+1&&r.top>=rect.top-1&&r.bottom<=rect.bottom+1};});return {width:rect.width,height:rect.height,insideToolbar:rect.right<=toolbar.right+1&&rect.left>=toolbar.left-1,parts};});
  assert(control.width>=44&&control.height>=44);assert(control.insideToolbar);assert(control.parts.every(part=>part.width>0&&part.height>0&&part.contained),'Grid icon and label are fully visible');await page.click('[aria-label="Afficher la grille"]');assert.equal(await page.$eval('[aria-label="Afficher la grille"]',node=>node.getAttribute('aria-pressed')),'true');await frame();assert((await viewport()).fits);await page.screenshot({path:resolve(output,'grid-control-320.png')});return control;
 });
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await run('reverse-touch',async()=>{await visit();const result=await draw({x:8,y:8},{x:6,y:6},{touch:true});assert.deepEqual({...result.added,id:undefined},{id:undefined,x:6,y:6,width:3,height:3});return result;});
 await run('edge-clamp',async()=>{await visit();const result=await draw({x:8,y:8},{x:10.5,y:10.5},{touch:true});assert.deepEqual({...result.added,id:undefined},{id:undefined,x:8,y:8,width:2,height:2});return result;});
 await run('overlap-rejected',async()=>{await visit();await draw({x:1,y:1},{x:0,y:0},{touch:true,valid:false,screenshot:'overlap'});assert.equal((await zones()).length,3);});
 await run('touch-cancel',async()=>{await visit();await draw({x:6,y:6},{x:8,y:8},{touch:true,cancel:true});assert.equal((await zones()).length,3);});
 await run('escape-cancel',async()=>{await visit();await draw({x:6,y:6},{x:8,y:8},{cancel:true});assert.equal((await zones()).length,3);});
 await run('keyboard-two-corners',async()=>{
  await visit();await drawMode();await page.$eval('[data-warehouse-map]',node=>node.focus({preventScroll:true}));for(let i=0;i<4;i++){await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');}await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');assert.equal((await zones()).length,3);await noWrites();await page.keyboard.press('Enter');await settle();const added=(await zones()).find(zone=>!zone.id.startsWith('starter'));assert.deepEqual({...added,id:undefined},{id:undefined,x:6,y:6,width:2,height:2});await noWrites();return {added};
 });
 for(const touch of [true,false])await run('resize-'+(touch?'touch':'mouse'),async()=>{
  await visit();await draw({x:6,y:6},{x:7,y:7},{touch});await page.click('[data-warehouse-tool="resize"]');await frame();const before=await zones(),camera=await viewport();const selected=before.find(zone=>!zone.id.startsWith('starter'));
  const handle=await page.$eval('[data-warehouse-resize-handle]',node=>{const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height};});assert(handle.width>=44-0.1&&handle.height>=44-0.1,'Resize target is at least44px');
  const cell=await page.$eval('[data-warehouse-map]',node=>Number(node.dataset.gridCellSize)*node.getScreenCTM().a);await press({x:handle.x,y:handle.y},touch);for(let i=1;i<=8;i++)await move({x:handle.x+cell*i/8,y:handle.y+cell*i/8},touch);
  await page.waitForSelector('[data-warehouse-transform-preview][data-valid="true"]');assert.deepEqual(await zones(),before,'Resize previews before release');await noWrites();await page.screenshot({path:resolve(output,'resize-'+(touch?'touch':'mouse')+'-preview.png')});await release(touch);await page.waitForSelector('[data-warehouse-transform-preview]',{hidden:true});const changed=(await zones()).find(zone=>zone.id===selected.id);assert.equal(changed.width,3);assert.equal(changed.height,3);const after=await viewport();for(const key of ['left','top','width','height'])assert(Math.abs(after[key]-camera[key])<=2,'Resize preserves plan geometry');await noWrites();return {handle,changed};
 });
 await run('explicit-save-only',async()=>{await visit();await draw({x:6,y:6},{x:6,y:7});await noWrites();if(!await page.$('[data-warehouse-action="save"]')){await page.click('[data-warehouse-plan] [data-warehouse-action="configure"]');await page.waitForSelector('dialog[data-warehouse-zone-dialog][open]');}const save=await page.$('[data-warehouse-action="save"]');assert(save);await save.click();await page.waitForFunction(()=>window.__snapshot.revision===2);assert.equal(await page.evaluate(()=>window.__requests.length),1);return {requests:await page.evaluate(()=>window.__requests.length)};});
 const scrollState=()=>page.evaluate(()=>{const parent=document.querySelector('[data-scroll-fixture]');return {document:scrollY,parent:parent?.scrollTop??0,documentMax:document.documentElement.scrollHeight-innerHeight,parentMax:parent?parent.scrollHeight-parent.clientHeight:0,styles:{html:document.documentElement.style.cssText,body:document.body.style.cssText,parent:parent?.style.cssText??''}};});
 const nativeSwipe=async(nested)=>{
  const target=await page.evaluate(nested=>{const parent=document.querySelector('[data-scroll-fixture]'),rect=parent?.getBoundingClientRect(),current=nested?parent.scrollTop:scrollY,max=nested?parent.scrollHeight-parent.clientHeight:document.documentElement.scrollHeight-innerHeight;return {x:nested?rect.left+5:9,y:Math.min(innerHeight-190,Math.max(210,(rect?.top??0)+innerHeight*.65)),distance:max-current>180?-160:160};},nested);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x,y:target.y,id:9,radiusX:4,radiusY:4,force:1}]});
  for(let step=1;step<=12;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:target.x,y:target.y+target.distance*step/12,id:9,radiusX:4,radiusY:4,force:1}]});await new Promise(resolve=>setTimeout(resolve,24));}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(resolve=>setTimeout(resolve,300));await settle();return target;
 };
 const prepareScrollFixture=async nested=>{
  await visit();await page.evaluate(nested=>{document.body.style.minHeight='200vh';if(nested){const root=document.getElementById('root'),parent=document.createElement('div');parent.dataset.scrollFixture='';parent.style.cssText='height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;padding:0 12px;max-width:100%';root.replaceWith(parent);parent.append(root);const spacer=document.createElement('div');spacer.style.height='100vh';spacer.dataset.scrollFixtureSpacer='';parent.append(spacer);}else{const rail=document.createElement('div');rail.dataset.scrollFixtureRail='';rail.style.cssText='position:fixed;left:0;top:0;width:18px;height:100dvh;z-index:9999;touch-action:pan-y';document.body.append(rail);}},nested);await frame();
  const before=await scrollState();await nativeSwipe(nested);const after=await scrollState();assert(Math.abs(after[nested?'parent':'document']-before[nested?'parent':'document'])>30,'Native touch can scroll before the gesture: '+JSON.stringify({before,after}));
  await page.evaluate(position=>{scrollTo(0,position.document);const parent=document.querySelector('[data-scroll-fixture]');if(parent)parent.scrollTop=position.parent;},before);await settle();return {nativePreconditionDelta:after[nested?'parent':'document']-before[nested?'parent':'document']};
 };
 for(const [nested,end,tool] of [[false,'release','draw'],[true,'release','draw'],[false,'cancel','draw'],[true,'cancel','draw'],[true,'release','resize'],[false,'release','move'],[true,'unmount','draw']])await run('scroll-'+(nested?'parent':'document')+'-'+tool+'-'+end,async()=>{
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});const precondition=await prepareScrollFixture(nested);
  if(tool!=='draw'){await draw({x:6,y:6},{x:7,y:7},{touch:true});await page.click('[data-warehouse-tool="'+tool+'"]');await frame();}else await drawMode();
  const before=await scrollState(),camera=await viewport(),initialZones=await zones();let a,b;
  if(tool==='resize'){a=await page.$eval('[data-warehouse-resize-handle]',node=>{const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});const cell=await page.$eval('[data-warehouse-map]',node=>Number(node.dataset.gridCellSize)*node.getScreenCTM().a);b={x:a.x+cell,y:a.y-cell};}
  else{a=await point(6,6);b=await point(tool==='move'?7:8,tool==='move'?7:3);}
  await press(a,true);for(let step=1;step<=8;step++)await move({x:a.x+(b.x-a.x)*step/8,y:a.y+(b.y-a.y)*step/8},true);
  const preview=tool==='draw'?'[data-warehouse-draw-preview]':'[data-warehouse-transform-preview]';await page.waitForSelector(preview);
  if(tool==='draw'){await page.keyboard.press('Enter');await page.keyboard.press('Space');assert.deepEqual(await zones(),initialZones,'Enter and Space cannot commit during a pointer gesture');assert(await page.$(preview),'Pointer preview remains active after concurrent keyboard input');}
  const wheelTarget=await page.evaluate(nested=>{const parent=document.querySelector('[data-scroll-fixture]'),rect=parent?.getBoundingClientRect();return {x:nested?rect.left+5:2,y:innerHeight*.55};},nested);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',...wheelTarget,deltaX:0,deltaY:160});await new Promise(resolve=>setTimeout(resolve,160));await settle();
  const during=await scrollState(),heldCamera=await viewport();assert(Math.abs(during.document-before.document)<=2,'Document cannot scroll during '+tool);assert(Math.abs(during.parent-before.parent)<=2,'Scrollable ancestor cannot scroll during '+tool);assert(Math.abs(heldCamera.top-camera.top)<=2,'SVG remains under the finger');assert.deepEqual(await zones(),initialZones,'No draft commit while held');await noWrites();await page.screenshot({path:resolve(output,'scroll-'+(nested?'parent':'document')+'-'+tool+'-'+end+'-held.png')});
  if(end==='unmount'){await page.evaluate(()=>window.__unmountWarehouse());await page.waitForSelector('[data-warehouse-map]',{hidden:true});await release(true,true);}else{await release(true,end==='cancel');await page.waitForSelector(preview,{hidden:true});}
  const released=await scrollState();assert.deepEqual(released.styles,before.styles,'All scroll styles are restored after '+end);if(end!=='unmount')assert(Math.abs(released.document-before.document)<=2&&Math.abs(released.parent-before.parent)<=2,'Release keeps current scroll position');
  if(end==='cancel')assert.deepEqual(await zones(),initialZones,'Cancel creates no zone');await nativeSwipe(nested);const unlocked=await scrollState(),key=nested?'parent':'document';assert(Math.abs(unlocked[key]-released[key])>30,'Native touch scroll resumes after '+end);await noWrites();return {...precondition,documentDeltaWhileHeld:during.document-before.document,parentDeltaWhileHeld:during.parent-before.parent,unlockedTouchDelta:unlocked[key]-released[key],stylesRestored:true};
 });
 await report();if(only)assert(checks.some(check=>matches(check.name)),'Unknown isolated check');assert(checks.every(check=>check.passed),'Some fixed-plan checks failed; see report.json');assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,output}));
}finally{await report();await browser?.close();await server.close();}
`;
const fixture=resolve(output,'fixture.mjs');await writeFile(fixture,source);await import(pathToFileURL(fixture).href);
