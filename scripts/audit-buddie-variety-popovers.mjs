/** Real carousels and game UI; local synthetic APIs, no remote requests or writes. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/buddie-variety-popovers');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-placard-warehouse-v4.mjs', 'utf8')).split("if(process.argv.includes('--preview'))")[0];
source = source.replace("'output/warehouse-v4'", "'output/buddie-variety-popovers'").replace('?? 3248', '?? 3283');
source = source.replace('const server = await createServer', "modules['next/link']+='export const useLinkStatus=()=>({pending:false});';\nconst server = await createServer");
source = source.replace("import {KqWarehouse} from '/src/components/placard/KqWarehouse';", "import {KqWarehouse} from '/src/components/placard/KqWarehouse'; import {KqBuddieCarousel} from '/src/components/placard/KqBuddieCarousel'; import {KQ_BUDDIES} from '/src/lib/kanab-quest-game';");
source = source.replace('createRoot(document.getElementById(\'root\')).render(<Fixture/>);', `
    function Preparation(){const [selected,setSelected]=React.useState('HH2026-004');window.__selected=selected;return <div style={{paddingTop:240,paddingBottom:160}}><KqBuddieCarousel buddies={KQ_BUDDIES} artwork={{}} selectedCode={selected} rotation={{requiredDistinctBuddies:2,recentBuddieCodes:['HH2026-002']}} onSelect={setSelected}/></div>;}
    createRoot(document.getElementById('root')).render(query.has('preparation')?<Preparation/>:<Fixture/>);
  `);
source = source.replace("Array.from({length:15},(_,index)=>'HH2026-'+String(index+2)", "Array.from({length:52},(_,index)=>'HH2026-'+String(index+1)");
source += String.raw`
let browser, page;
const checks=[], errors=[], blocked=[];
const popup='[data-buddie-variety-popover]';
try {
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>void dialog.accept());
  await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{blocked.push(request.url());void request.abort();}});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const visit=async(query)=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
  const enter=async()=>{await page.waitForSelector('[aria-label="Mode du plan"]');await page.$$eval('[aria-label="Mode du plan"] button',nodes=>nodes.find(node=>node.textContent.trim()==='Cultures').click());await page.click('[data-warehouse-buddie-toggle]');await page.waitForSelector('[data-warehouse-buddie-carousel]');};
  const card=code=>'[data-warehouse-buddie-card="'+code+'"]';
  const openCard=async(code,touch=false)=>{const selector=card(code);await page.$eval(selector,node=>node.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));await settle();const handle=await page.$(selector);if(touch){const r=await handle.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else await handle.click();await page.waitForSelector(popup+'[data-buddie-variety-popover="'+code+'"]',{visible:true});await settle();};
  const geometry=async(anchor)=>page.$eval(popup,(node,anchor)=>{const p=node.getBoundingClientRect(),a=document.querySelector(anchor).getBoundingClientRect();return {left:p.left,right:p.right,top:p.top,bottom:p.bottom,height:p.height,anchorTop:a.top,flavors:node.querySelectorAll('ul[aria-label="Les deux goûts de cette variété"] > li').length,brokenFlavors:[...node.querySelectorAll('ul[aria-label="Les deux goûts de cette variété"] img')].filter(image=>image.complete&&!image.naturalWidth).length,overflow:document.documentElement.scrollWidth>innerWidth+1,sourceLinks:[...node.querySelectorAll('a[href]')].map(link=>link.href),viewport:{width:innerWidth,height:innerHeight}};},anchor);
  const fits=g=>{assert(g.left>=0&&g.right<=g.viewport.width+1);assert(g.top>=0&&g.bottom<=g.viewport.height+1);assert(g.bottom<=g.anchorTop+1,'Popup stays above the carousel');assert(g.height>=100);assert.equal(g.flavors,2);assert.equal(g.brokenFlavors,0);assert.equal(g.overflow,false);};
  const noWrites=async()=>assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[]);
  const close=async()=>{await page.click('[data-buddie-variety-close]');await page.waitForSelector(popup,{hidden:true});};
  for(const [width,height] of [[320,740],[390,844],[768,1024],[1440,900],[844,390]]) {
    await page.setViewport({width,height,isMobile:width<600,hasTouch:width<600});
    await visit('compact&cultures&buddieDrag');await enter();
    await openCard('HH2026-003',width<600);
    let g=await geometry('[data-warehouse-buddie-carousel]');fits(g);assert.equal(g.sourceLinks.length,0,'Buddie profiles do not display source links');
    assert.equal(await page.$('[data-warehouse-buddie-card][data-selected]'),null,'Reading does not arm placement');
    await noWrites();await page.screenshot({path:resolve(output,'warehouse-'+width+'.png'),fullPage:true});
    await page.keyboard.press('Escape');await page.waitForSelector(popup,{hidden:true});
    assert.equal(await page.$eval(card('HH2026-003'),node=>document.activeElement===node),true,'Escape returns focus to the card');
    await openCard('HH2026-002',width<600);fits(await geometry('[data-warehouse-buddie-carousel]'));
    assert.equal(await page.$$eval('[data-buddie-variety-choose]',nodes=>nodes.some(node=>!node.disabled)),false,'An active Buddie is readable but cannot be placed');await close();
    await openCard('HH2026-005',width<600);assert.equal(await page.$$eval('[data-buddie-variety-choose]',nodes=>nodes.some(node=>!node.disabled)),false,'A rotating Buddie cannot be placed');await close();
    await openCard('HH2026-003',width<600);await page.click('[data-buddie-variety-choose]');await page.waitForSelector(popup,{hidden:true});
    assert.equal(await page.$eval(card('HH2026-003'),node=>node.dataset.selected),'true','Explicit action arms the chosen card');await noWrites();await page.keyboard.press('Escape');
    await openCard('HH2026-004',width<600);await page.mouse.click(3,3);await page.waitForSelector(popup,{hidden:true});
    checks.push({name:'warehouse-'+width,geometry:g,activeAndRotationReadable:true,explicitPlacement:true,escapeAndOutsideClose:true});
  }
  for(const [width,height] of [[320,1000],[1440,1000],[844,390]]) {
    await page.setViewport({width,height,isMobile:width===320,hasTouch:width===320});await visit('preparation');
    const picture='button[aria-label="Voir la fiche de Cannatonic"]';
    await page.waitForSelector(picture);await page.$eval(picture,node=>node.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await page.click(picture);await page.waitForSelector(popup,{visible:true});await settle();
    const g=await geometry('[role="list"][aria-label="Tes cartes Buddies"]');fits(g);await page.screenshot({path:resolve(output,'preparation-'+width+'.png'),fullPage:true});
    await page.click('[data-buddie-variety-choose]');await page.waitForSelector(popup,{hidden:true});assert.equal(await page.evaluate(()=>window.__selected),'HH2026-003');
    checks.push({name:'preparation-'+width,geometry:g});
  }
  await page.setViewport({width:1440,height:1000});await visit('compact&cultures&buddieDrag');await enter();
  await page.$eval('[data-warehouse-map-viewport]',node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.$eval(card('HH2026-003'),node=>node.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));await settle();
  const a=await page.$eval(card('HH2026-003'),node=>{const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
  const b=await page.$eval('[data-warehouse-map]',map=>{const p=new DOMPoint(Number(map.dataset.gridOriginX)+5.5*Number(map.dataset.gridCellSize),Number(map.dataset.gridOriginY)+1.5*Number(map.dataset.gridCellSize)).matrixTransform(map.getScreenCTM());return {x:p.x,y:p.y};});
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.waitForSelector('[data-warehouse-buddie-ghost]');assert.equal(await page.$(popup),null,'Dragging does not open the profile');await page.mouse.up();await settle();
  assert.equal(await page.$eval('[data-zone-id="second"]',node=>node.querySelector('[data-zone-buddie]')?.getAttribute('data-zone-buddie')),'HH2026-003');await noWrites();checks.push({name:'drag-still-places-without-popup-or-write'});
  await page.evaluate(()=>sessionStorage.clear());await visit('cultures&buddieDrag');await enter();await page.click('[data-warehouse-action="fullscreen"]');await page.waitForFunction(()=>Boolean(document.fullscreenElement));await openCard('HH2026-003');fits(await geometry('[data-warehouse-buddie-carousel]'));await close();await page.evaluate(()=>document.exitFullscreen());checks.push({name:'fullscreen-profile'});
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log(JSON.stringify({passed:checks.length,output}));
} catch(error) { if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw error; }
finally {await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,blocked},null,2));await browser?.close();await server.close();}
`;
const fixture=resolve(output,'fixture.mjs');await writeFile(fixture,source);await import(pathToFileURL(fixture).href);
