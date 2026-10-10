/** Browser audit of the real arena hub. Local fixtures only: no .env, credentials or remote requests. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/arena-clarity-release');
const port = Number(process.argv.find(argument=>argument.startsWith('--port='))?.slice(7)??3221);
const origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const interactionsOnly = process.argv.includes('--interactions-only');
const sampleProfile = { nickname:'Camille29', gender:'female', clothing:'teal', skin:'honey', strength:'green-thumb' };
function resetFixture(state){return {state,profile:['new','prelaunch-new'].includes(state)?null:sampleProfile,progress:{step:state==='new'?0:9,status:state==='new'?'new':'completed'}};}
function fixturePayload(fixture,path,method,rawBody){
  if(fixture.state==='guest')return {status:401,body:{error:'Local guest fixture'}};
  if(path==='/api/arena/tutorial'){
    if(fixture.state==='error'&&!fixture.identityFailed){fixture.identityFailed=true;return {status:503,body:{error:'Local unavailable profile'}};}
    if(method==='POST')fixture.progress=JSON.parse(rawBody);
    else if(method!=='GET')return null;
    return {status:200,body:{userId:'local-arena-audit',chanvrier:fixture.profile,progress:fixture.progress,persisted:true}};
  }
  if(path==='/api/arena/chanvrier'){
    if(fixture.state==='prelaunch-error'&&!fixture.identityFailed){fixture.identityFailed=true;return {status:503,body:{error:'Local unavailable profile'}};}
    if(method==='POST')fixture.profile=JSON.parse(rawBody);
    else if(method!=='GET')return null;
    return {status:200,body:{profile:fixture.profile}};
  }
  if(path==='/api/arena/chanvrier/progress'&&method==='GET'){
    if(fixture.state==='card-error'&&!fixture.cardFailed){fixture.cardFailed=true;return {status:503,body:{error:'Local unavailable achievements'}};}
    return {status:200,body:{reputation:0,metrics:{},badges:[],missions:[],showcase:{title:null,badges:[],tracked:null},newBadgeCount:0,badgeCount:0,unlockedFamilies:0,packsGranted:0,rank:null}};
  }
  if(path==='/api/arena/placard/summary'&&method==='GET')return {status:200,body:{activeRun:true,readyLotCount:1,availableFlowerCount:0,supportPackCount:0,buddiePackCount:0}};
  return null;
}
const previewFetch=preview?`const sampleProfile=${JSON.stringify(sampleProfile)};const resetFixture=${resetFixture.toString()};const fixturePayload=${fixturePayload.toString()};const fixture=resetFixture(new URLSearchParams(location.search).get('state')||'returning');const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==location.origin)throw new TypeError('Prévisualisation locale uniquement');if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);const method=init.method||(input instanceof Request?input.method:'GET');const payload=fixturePayload(fixture,url.pathname,method,init.body);return new Response(JSON.stringify(payload?.body||{error:'API non simulée'}),{status:payload?.status||404,headers:{'Content-Type':'application/json'}});};`:'';
const activities = [
  { id:'carnet', label:'Le Carnet', href:'/arene/carnet/regular' },
  { id:'jouer', label:'JOUER', href:'/arene/placard' },
  { id:'classement', label:'Le Classement', href:'/arene?vue=classement' },
];
const modules = {
  'arena-clarity-fixture': `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ContestArenaHub} from '/src/components/contest/ContestArenaHub';
    ${previewFetch}
    const params=new URLSearchParams(location.search);
    createRoot(document.getElementById('root')).render(React.createElement(ContestArenaHub,{
      activitiesLocked:params.get('state')?.startsWith('prelaunch'),initialMode:params.get('mode')||'jouer',personalSummaryEnabled:params.get('summary')==='1',
    }));
  `,
  'preview-cart': `export const useCart=()=>({user:new URLSearchParams(location.search).get('state')==='guest'?null:{id:'local-arena-audit'},authLoading:false});`,
  'preview-consent': `export const useCookieConsent=()=>({showBanner:new URLSearchParams(location.search).get('state')==='blocked'});`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) {return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props))}`,
  'next/navigation': `export const usePathname=()=>'/arene';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:href=>location.assign(href),replace:href=>location.replace(href),refresh:()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}`;
const server = await createServer({
  configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},
  esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'arena-clarity-audit',enforce:'pre',
    resolveId(id){
      if(id.endsWith('/context/CartContext'))return '\0preview-cart';
      if(id.endsWith('/cookies/CookieConsentProvider'))return '\0preview-consent';
      if(id in modules)return '\0'+id;
    },
    load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},
    configureServer(vite){vite.middlewares.use((request,response,next)=>{
      const pathname=request.url?.split('?')[0];
      if(pathname==='/'){
        response.setHeader('Content-Type','text/html');
        response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arène — audit local</title><style>${fonts}</style>${preview?'<p role="note" style="margin:0;padding:8px 16px;background:#fffaf1;color:#003f30;font-size:12px">Prévisualisation locale · données de démonstration et destinations simulées.</p>':''}<div id="root"></div><script type="module" src="/@id/__x00__arena-clarity-fixture"></script></html>`);
        return;
      }
      if(pathname?.startsWith('/arene')||pathname?.startsWith('/compte')||pathname?.startsWith('/profil')){
        response.setHeader('Content-Type','text/html');
        response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><h1 data-audit-destination>Destination locale simulée</h1></html>');
        return;
      }
      next();
    });},
  }],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}},
});
let browser;
let page;
let fixture;
const errors=[],requests=[],blockedRemote=[],unexpectedApi=[],results=[],navigationResults=[],interactionResults=[],touchResults=[];
if(preview){
  await mkdir(output,{recursive:true});await server.listen();
  console.log(`Prévisualisation locale de la carte de l’Arène · données et destinations simulées : ${origin}/?state=returning`);
}else try {
  await mkdir(output,{recursive:true}); await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage(); page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.protocol==='data:')return void request.continue();
    if(url.origin!==origin){blockedRemote.push({url:url.origin+url.pathname,method:request.method()});return void request.abort();}
    if(!url.pathname.startsWith('/api/'))return void request.continue();
    const record={state:fixture?.state,path:url.pathname,method:request.method()}; requests.push(record);
    const respond=(status,body)=>void request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
    if(fixture.state==='loading'&&url.pathname==='/api/arena/tutorial')return;
    const payload=fixturePayload(fixture,url.pathname,request.method(),request.postData());
    if(payload)return respond(payload.status,payload.body);
    unexpectedApi.push(record);return respond(404,{error:'No local fixture for this API'});
  });
  const visibleCount=selector=>page.$$eval(selector,elements=>elements.filter(element=>element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})).length);
  const clickText=async text=>{
    const handle=await page.waitForFunction(text=>[...document.querySelectorAll('button,a')].find(element=>element.textContent.trim()===text&&element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})),{},text);
    await handle.asElement().click(); await handle.dispose();
  };
  const noModal=async()=>{
    assert.equal(await visibleCount('dialog[open],[role="dialog"],[data-arena-journey-ui]'),0,'No profile, guide or trial may open automatically');
  };
  const load=async(state,mode='jouer',progress,query='')=>{
    fixture=resetFixture(state);
    if(progress)fixture.progress=progress;
    await page.goto(`${origin}/?state=${state}&mode=${mode}${query?'&'+query:''}`,{waitUntil:state==='loading'?'domcontentloaded':'networkidle0'});
    await page.waitForSelector('[data-arena-scene]',{timeout:60000});
    if(!state.startsWith('prelaunch')&&state!=='blocked'){
      await page.waitForSelector('[data-arena-account-controls]',{visible:true});
      await page.waitForSelector('[data-arena-help-trigger]',{visible:true});
    }
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-arena-scene] img')].every(image=>image.complete&&image.naturalWidth>0));
    if(!['loading','blocked'].includes(state))await page.waitForFunction(()=>document.querySelector('[data-arena-profile-trigger]')?.disabled===false);
    await noModal();
  };
  const measure=()=>page.evaluate(()=>{
    const controls=[...document.querySelectorAll('a[href],button,summary')].filter(element=>element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
    const describe=element=>{const rect=element.getBoundingClientRect();return {id:element.getAttribute('data-arena-activity')||(element.hasAttribute('data-arena-profile-trigger')?'profil':null),label:(element.getAttribute('aria-label')||element.textContent).trim().replace(/\s+/g,' '),tag:element.tagName.toLowerCase(),left:rect.left,right:rect.right,top:rect.top+scrollY,bottom:rect.bottom+scrollY,width:rect.width,height:rect.height,inViewport:rect.bottom>0&&rect.top<innerHeight,position:getComputedStyle(element).position};};
    const rows=controls.map(describe), overlaps=[];
    controls.forEach((first,index)=>controls.slice(index+1).forEach(second=>{
      if(first.contains(second)||second.contains(first))return;
      const a=first.getBoundingClientRect(),b=second.getBoundingClientRect();
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([describe(first).label,describe(second).label]);
    }));
    const map=document.querySelector('[data-arena-map]'),viewport=document.querySelector('#arena-map-viewport'),image=map.querySelector('img'),imageBounds=image.getBoundingClientRect();
    const sites=[...map.querySelectorAll('[data-arena-activity],[data-arena-profile-trigger]')].map(element=>{const row=describe(element),label=describe(element.querySelector(':scope > span'));return {...row,labelBounds:label,quadrant:((row.left+row.right)/2<imageBounds.left+imageBounds.width/2?'left':'right')+'-'+((row.top+row.bottom)/2<imageBounds.top+scrollY+imageBounds.height/2?'top':'bottom')};});
    const face={left:imageBounds.left+imageBounds.width*.37,right:imageBounds.left+imageBounds.width*.58,top:imageBounds.top+scrollY+imageBounds.height*.35,bottom:imageBounds.top+scrollY+imageBounds.height*.54};
    return {width:innerWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
      outside:rows.filter(row=>row.left< -1||row.right>innerWidth+1).map(row=>row.label),overlaps,
      renderedControls:rows.length,viewportControls:rows.filter(row=>row.inViewport).length,controls:rows,
      activities:[...document.querySelectorAll('[data-arena-activity]')].map(describe),
      sites,face,mapZoomed:map.getAttribute('data-map-zoomed')==='true',zoomPressed:map.querySelector('[data-arena-map-zoom]')?.getAttribute('aria-pressed'),mapViewport:{width:viewport.clientWidth,scrollWidth:viewport.scrollWidth,scrollLeft:viewport.scrollLeft,overflowX:getComputedStyle(viewport).overflowX},mapImageWidth:imageBounds.width,
      sceneImages:[...document.querySelectorAll('[data-arena-scene] img')].map(image=>image.getAttribute('src')),
      sceneRequests:[...new Set(performance.getEntriesByType('resource').map(resource=>resource.name).filter(name=>name.includes('/contest/map/arena-desk-')))]};
  });
  const assertLayout=layout=>{
    assert.equal(layout.horizontalOverflow,false,'No horizontal page overflow');
    assert.deepEqual(layout.outside,[],'Controls must fit the viewport width');
    assert.deepEqual(layout.overlaps,[],'Interactive controls must not overlap');
    assert.equal(layout.sites.length,4,'Four map destinations');
    assert.equal(new Set(layout.sites.map(site=>site.quadrant)).size,4,'One destination in each map quadrant');
    const intersects=(first,second)=>Math.min(first.right,second.right)-Math.max(first.left,second.left)>.5&&Math.min(first.bottom,second.bottom)-Math.max(first.top,second.top)>.5;
    for(const site of layout.sites){
      assert(site.width>=44&&site.height>=44,`${site.id} has at least a 44px target`);
      assert.equal(site.quadrant,{carnet:'left-bottom',jouer:'right-bottom',classement:'right-top',profil:'left-top'}[site.id],`${site.id} matches its illustrated desk object`);
      assert.equal(intersects(site.labelBounds,layout.face),false,`${site.id} leaves Sylvain’s face visible`);
      for(const other of layout.sites.filter(other=>other.id!==site.id))assert.equal(intersects(site.labelBounds,other),false,`${site.id} label does not cover the ${other.id} target`);
    }
    if(layout.width<=700){assert.equal(layout.mapZoomed,false);assert.equal(layout.zoomPressed,'false');assert(layout.mapViewport.scrollWidth<=layout.mapViewport.width+1,'The whole map fits on mobile');assert(Math.abs(layout.mapImageWidth-layout.mapViewport.width)<=1,'The mobile overview displays the complete image');}
  };
  const screenshot=name=>page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});
  const tap=async selector=>{
    await page.$eval(selector,element=>element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
    const point=await page.$eval(selector,element=>{const bounds=element.getBoundingClientRect();return {x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};});
    await page.touchscreen.tap(point.x,point.y);
  };
  const assertProfileFocus=()=>page.waitForFunction(()=>document.activeElement?.hasAttribute('data-arena-profile-trigger'));
  for(const width of interactionsOnly?[]:[320,390,430,768,1440]){
    await page.setViewport({width,height:width<=700?844:1000,deviceScaleFactor:1,isMobile:width<=700,hasTouch:width<=700});
    for(const state of ['guest','new','returning','prelaunch']){
      const requestStart=requests.length;
      await load(state);
      const layout=await measure(); assertLayout(layout);
      assert.equal(layout.activities.length,3,'Exactly three activity choices');
      assert.equal(layout.sceneImages.length,1,'Exactly one scene image in the DOM');
      assert.equal(layout.sceneRequests.length,1,'Only the map image is loaded');
      assert.equal(layout.sceneImages[0],'/contest/map/arena-desk-v4.webp');
      assert(layout.renderedControls<=10,'Learning stays alongside concise account and map controls');
      assert.equal(await visibleCount('[data-arena-first-culture-trigger]'),0,'The retired first culture is absent');
      assert.equal(await visibleCount('[data-arena-discovery-entry] [data-arena-learning-trigger]'),1,'Learning remains directly available before and after opening');
      assert.equal(layout.controls.filter(control=>control.position==='fixed').length,0,'Account/help controls stay inline');
      assert.equal(await visibleCount('a[href*="pack-pionniers"],a[href*="view=missions"]'),0,'Pack and mission shortcuts are not permanently displayed');
      assert(requests.slice(requestStart).every(request=>request.method==='GET'),'Arrival must not mutate profile or tutorial progress');
      for(const activity of activities){
        const info=await page.$eval(`[data-arena-activity="${activity.id}"]`,element=>({text:element.textContent,tag:element.tagName,href:element.getAttribute('href'),disabled:element.getAttribute('aria-disabled')==='true'||element.disabled===true}));
        assert(info.text.includes(activity.label));
        if(state!=='prelaunch'){assert.equal(info.tag,'A');assert.equal(info.href,activity.href);}
        else {assert.equal(info.tag,'DIV','Prelaunch activities are non-interactive');assert.equal(info.href,null);assert.equal(info.disabled,true);assert(info.text.includes('Bientôt'));}
      }
      if(state==='prelaunch'){
        assert(await page.$eval('body',body=>body.textContent.includes('15 octobre')),'Opening date remains visible');
        assert.equal(await page.$$eval('[data-arena-activity] a,[data-arena-activity] button',elements=>elements.length),0);
        assert.equal(await page.$eval('[data-arena-map]',element=>(element.textContent.match(/Bientôt/g)||[]).length),3);
      }
      await screenshot(`${state}-${width}`);
      results.push({state,...layout,noAutomaticModal:true,arrivalReadOnly:true});
    }
    for(const activity of activities){
      await load('guest');
      await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator(`[data-arena-activity="${activity.id}"]`).click()]);
      assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,activity.href);
      await page.waitForSelector('[data-audit-destination]');
      navigationResults.push({width,activity:activity.id,oneClick:true,destination:activity.href});
    }
    await load('guest');
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('[data-arena-profile-trigger]').click()]);
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,'/compte/connexion?next=%2Farene');
    navigationResults.push({width,activity:'profil',oneClick:true,destination:'/compte/connexion?next=%2Farene'});
    await load('returning');await page.locator('[data-arena-profile-trigger]').click();
    await page.waitForSelector('[data-chanvrier-palmares][open]',{visible:true});await screenshot(`map-profile-${width}`);
    await page.keyboard.press('Escape');await noModal();await assertProfileFocus();
    await load('returning');
    await page.click('[data-arena-help-trigger]');
    await page.waitForFunction(()=>document.querySelector('[data-arena-help-trigger]')?.getAttribute('aria-expanded')==='true');
    await clickText('Lire le guide'); await page.waitForSelector('[role="dialog"]',{visible:true});
    await screenshot(`guide-${width}`);
    await page.keyboard.press('Escape'); await noModal();
    await page.click('[data-arena-trial-trigger]');
    await page.waitForSelector('[data-arena-journey-ui][open]',{visible:true,timeout:60000});
    await screenshot(`trial-${width}`);
    await page.click('[aria-label="Mettre l’essai en pause"]');
    await page.waitForFunction(()=>!document.querySelector('[data-arena-journey-ui][open]'));
    await noModal();
    interactionResults.push({width,guideOnDemand:true,trialOnDemand:true,pauseClosesTrial:true});
  }
  for(const width of [320,390,430]){
    await page.setViewport({width,height:568,isMobile:true,hasTouch:true});await load('returning');assertLayout(await measure());
    await tap('[data-arena-profile-trigger]');await page.waitForSelector('[data-chanvrier-palmares][open]',{visible:true});
    await page.keyboard.press('Escape');await noModal();await assertProfileFocus();
    await tap('[data-arena-map-zoom]');await page.waitForSelector('[data-arena-map-zoom][aria-pressed="true"]');
    let layout=await measure();assert.equal(layout.mapZoomed,true);assert.equal(layout.horizontalOverflow,false);assert(layout.mapViewport.scrollWidth>layout.mapViewport.width);assert.equal(layout.mapViewport.overflowX,'auto');
    const swipe=await page.$eval('#arena-map-viewport',element=>{element.scrollIntoView({block:'center',behavior:'instant'});element.scrollLeft=0;const bounds=element.getBoundingClientRect();return {startX:bounds.right-30,endX:bounds.left+30,y:Math.max(30,Math.min(innerHeight-30,bounds.top+100))};});
    const touch=await page.touchscreen.touchStart(swipe.startX,swipe.y);
    for(let step=1;step<=8;step++){await touch.move(swipe.startX+(swipe.endX-swipe.startX)*step/8,swipe.y);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));}
    await touch.end();await page.waitForFunction(()=>document.querySelector('#arena-map-viewport').scrollLeft>10);
    // A touch during native momentum stops scrolling instead of activating a control.
    await page.$eval('#arena-map-viewport',element=>new Promise(resolve=>{
      let previous=element.scrollLeft,stableFrames=0;
      const check=()=>{stableFrames=Math.abs(element.scrollLeft-previous)<.5?stableFrames+1:0;previous=element.scrollLeft;if(stableFrames>=8)resolve();else requestAnimationFrame(check);};
      requestAnimationFrame(check);
    }));
    await screenshot(`touch-zoom-${width}x568`);
    await tap('[data-arena-map-zoom]');await page.waitForSelector('[data-arena-map-zoom][aria-pressed="false"]');layout=await measure();assertLayout(layout);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await screenshot(`touch-overview-${width}x568`);
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),tap('[data-arena-activity="jouer"]')]);
    assert.equal(new URL(page.url()).pathname,'/arene/placard');
    touchResults.push({width,height:568,overview:true,profileTouch:true,zoomTouch:true,panTouch:true,unzoomTouch:true,oneTapActivity:true});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await load('new');
  await page.locator('[data-arena-profile-trigger]').click(); await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await screenshot('new-profile-on-demand-390');
  await page.click('[aria-label="Fermer le profil"]'); await noModal();await assertProfileFocus();
  await page.click('[data-arena-help-trigger]'); await page.click('[data-arena-trial-trigger]');
  await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await page.click('[aria-label="Fermer le profil"]'); await noModal();
  const saveProfile=async nickname=>{
    await page.type('input[autocomplete="nickname"]',nickname);
    await clickText('Choisir ma force');
    await clickText('Créer mon chanvrier');
    await page.waitForFunction(()=>!document.querySelector('[data-chanvrier-profile][open]'));
  };
  await load('new');
  const directProfileStart=requests.length;
  await page.locator('[data-arena-profile-trigger]').click(); await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await saveProfile('Nouveau29');
  await page.waitForSelector('[data-arena-profile-trigger]:not(:disabled)',{visible:true});
  await noModal();await assertProfileFocus();
  assert.deepEqual(requests.slice(directProfileStart).filter(request=>request.method==='POST').map(request=>request.path),['/api/arena/chanvrier'],'Direct profile creation does not start or mutate the trial');
  await screenshot('new-profile-saved-no-trial-390');
  await load('new');
  const trialProfileStart=requests.length;
  await page.click('[data-arena-help-trigger]'); await page.click('[data-arena-trial-trigger]');
  await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await saveProfile('Essai29');
  await page.waitForSelector('[data-arena-journey-ui][open]',{visible:true,timeout:60000});
  assert.deepEqual(requests.slice(trialProfileStart).filter(request=>request.method==='POST').map(request=>request.path),['/api/arena/chanvrier','/api/arena/tutorial'],'Trial intent survives successful profile creation');
  await screenshot('new-profile-saved-starts-requested-trial-390');
  await page.click('[aria-label="Mettre l’essai en pause"]');
  await page.waitForFunction(()=>!document.querySelector('[data-arena-journey-ui][open]'));
  await load('returning');const returningEditStart=requests.length;
  await page.locator('[data-arena-profile-trigger]').click();await page.waitForSelector('[data-chanvrier-palmares][open]',{visible:true});
  await clickText('Personnaliser mon personnage');await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await page.keyboard.press('Escape');await noModal();await assertProfileFocus();
  await page.locator('[data-arena-profile-trigger]').click();await page.waitForSelector('[data-chanvrier-palmares][open]',{visible:true});
  await clickText('Personnaliser mon personnage');await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await clickText('Choisir ma force');await clickText('Enregistrer mon profil');await page.waitForSelector('[data-chanvrier-profile][open]',{hidden:true});await noModal();await assertProfileFocus();
  assert.deepEqual(requests.slice(returningEditStart).filter(request=>request.method==='POST').map(request=>request.path),['/api/arena/chanvrier']);
  for(const state of ['error','prelaunch-error']){
    await load(state);const retryStart=requests.length;await page.locator('[data-arena-profile-trigger]').click();
    await page.waitForFunction(()=>document.querySelector('[data-arena-profile-trigger]')?.disabled===false&&document.querySelector('[data-arena-profile-trigger]')?.textContent?.includes('Réessayer')===false);
    await noModal();assert(requests.slice(retryStart).every(request=>request.method==='GET'),'Retry only loads profile state');
    await page.locator('[data-arena-profile-trigger]').click();
    await page.waitForSelector(state==='error'?'[data-chanvrier-palmares][open]':'[data-chanvrier-profile][open]',{visible:true});
    await page.keyboard.press('Escape');await noModal();await assertProfileFocus();
  }
  await load('card-error');await page.locator('[data-arena-profile-trigger]').click();await page.waitForSelector('[data-chanvrier-palmares][open] [role="alert"]');
  await clickText('Réessayer le palmarès');await page.waitForSelector('[data-chanvrier-palmares][open] [role="alert"]',{hidden:true});
  await page.keyboard.press('Escape');await noModal();await assertProfileFocus();
  for(const state of ['loading','blocked']){
    await load(state);assert.equal(await page.$eval('[data-arena-profile-trigger]',element=>element.disabled),true);await noModal();
    assert(requests.filter(request=>request.state===state).every(request=>request.method==='GET'));
  }
  await load('prelaunch-new');const prelaunchSaveStart=requests.length;await page.locator('[data-arena-profile-trigger]').click();
  await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});await saveProfile('Avant29');await noModal();await assertProfileFocus();
  assert.deepEqual(requests.slice(prelaunchSaveStart).map(request=>request.path),['/api/arena/chanvrier'],'Prelaunch creation never starts the tutorial or the game');
  await load('returning','jouer',undefined,'summary=1');await page.waitForSelector('[data-arena-player-resume][data-resume-status="ready"]');
  assert.equal(await page.$eval('[data-resume-primary]',element=>element.getAttribute('href')),'/arene/placard?view=game');
  await load('prelaunch','jouer',undefined,'summary=1');assert.equal(await page.$('[data-arena-player-resume]'),null);
  const activeStart=requests.length;
  await load('returning','jouer',{step:4,status:'active'});
  await noModal();
  assert(requests.slice(activeStart).every(request=>request.method==='GET'),'Restored active progress does not restart the trial');
  await load('guest'); await page.click('[data-arena-help-trigger]');
  assert.equal(await visibleCount('a[href*="connexion"]')>0,true,'Guest has a sign-in path for the trial');
  await clickText('Lire le guide'); await page.waitForSelector('[role="dialog"]',{visible:true});
  await page.keyboard.press('Escape'); await noModal();
  for(const mode of ['carnet','jouer','classement']){
    await load('returning',mode);
    assert.equal((await measure()).sceneImages[0],'/contest/map/arena-desk-v4.webp','All modes share one illustrated desk');
    assert.equal(await page.$eval('[data-arena-activity][data-current="true"]',element=>element.getAttribute('data-arena-activity')),mode);
  }
  const initialTransform=await page.$eval('[data-arena-scene]',element=>getComputedStyle(element).transform);
  await page.mouse.move(310,400); await page.mouse.move(30,200);
  assert.equal(await page.$eval('[data-arena-scene]',element=>getComputedStyle(element).transform),initialTransform,'Pointer movement does not add parallax');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpectedApi,[]);assert.deepEqual(blockedRemote,[]);
  const report={passed:true,createdAt:new Date().toISOString(),scope:'Actual hub and account/help components; global shell omitted. API calls and navigation destinations are local fixtures; no environment or credentials loaded.',
    results,navigationResults,interactionResults,touchResults,fourMapSites:true,defaultMobileOverview:true,mapZoomAndTouchPan:true,guestProfileSignIn:true,profileCardOnDemand:true,profileFocusRestored:true,profileErrorRetry:true,profileLoadingAndConsentBlocked:true,prelaunchProfileCreation:true,optionalPlayerSummary:true,newProfileOptional:true,cancelledProfileDoesNotStartTrial:true,directProfileSaveDoesNotStartTrial:true,requestedTrialStartsAfterProfileSave:true,activeProgressDoesNotAutoOpen:true,guestGuideAvailable:true,initialModeRespected:true,sceneWithoutParallax:true,requests,errors,unexpectedApi,blockedRemote};
  await writeFile(resolve(output,interactionsOnly?'interaction-report.json':'report.json'),JSON.stringify({...report,interactionsOnly},null,2)+'\n');
  console.log(JSON.stringify({passed:true,interactionsOnly,widths:interactionsOnly?[]:[320,390,430,768,1440],states:['guest','new','returning','prelaunch'],oneClickRoutes:navigationResults.length,touchViewports:touchResults.length,output},null,2));
} catch(error) {
  await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(resolve(output,'failure-report.json'),JSON.stringify({passed:false,error:error instanceof Error?error.stack:String(error),results,navigationResults,interactionResults,requests,errors,unexpectedApi,blockedRemote},null,2)+'\n');
  throw error;
} finally {await browser?.close();await server.close();}
