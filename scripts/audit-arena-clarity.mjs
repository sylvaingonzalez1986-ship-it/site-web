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
const port = 3221;
const origin = `http://127.0.0.1:${port}`;
const sampleProfile = { nickname:'Camille29', gender:'female', clothing:'teal', skin:'honey', strength:'green-thumb' };
const activities = [
  { id:'carnet', label:'Déguster', href:'/arene/carnet/regular' },
  { id:'jouer', label:'Cultiver', href:'/arene/placard' },
  { id:'classement', label:'Classement', href:'/arene?vue=classement' },
];
const modules = {
  'arena-clarity-fixture': `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ContestArenaHub} from '/src/components/contest/ContestArenaHub';
    const params=new URLSearchParams(location.search);
    createRoot(document.getElementById('root')).render(React.createElement(ContestArenaHub,{
      activitiesLocked:params.get('state')==='prelaunch',initialMode:params.get('mode')||'jouer',
    }));
  `,
  'preview-cart': `export const useCart=()=>({user:new URLSearchParams(location.search).get('state')==='guest'?null:{id:'local-arena-audit'},authLoading:false});`,
  'preview-consent': `export const useCookieConsent=()=>({showBanner:false});`,
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
        response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arène — audit local</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__arena-clarity-fixture"></script></html>`);
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
const errors=[],requests=[],blockedRemote=[],unexpectedApi=[],results=[],navigationResults=[],interactionResults=[];
const resetFixture=state=>({state,profile:state==='new'?null:sampleProfile,progress:{step:state==='new'?0:9,status:state==='new'?'new':'completed'}});
try {
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
    if(fixture.state==='guest')return respond(401,{error:'Local guest fixture'});
    if(url.pathname==='/api/arena/tutorial'){
      if(request.method()==='POST')fixture.progress=JSON.parse(request.postData());
      else if(request.method()!=='GET'){unexpectedApi.push(record);return respond(405,{});}
      return respond(200,{userId:'local-arena-audit',chanvrier:fixture.profile,progress:fixture.progress,persisted:true});
    }
    if(url.pathname==='/api/arena/chanvrier'){
      if(request.method()==='POST')fixture.profile=JSON.parse(request.postData());
      else if(request.method()!=='GET'){unexpectedApi.push(record);return respond(405,{});}
      return respond(200,{profile:fixture.profile});
    }
    if(url.pathname==='/api/arena/chanvrier/progress'&&request.method()==='GET')return respond(200,{
      reputation:0,metrics:{},badges:[],missions:[],showcase:{title:null,badges:[],tracked:null},newBadgeCount:0,badgeCount:0,unlockedFamilies:0,packsGranted:0,rank:null,
    });
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
  const load=async(state,mode='jouer',progress)=>{
    fixture=resetFixture(state);
    if(progress)fixture.progress=progress;
    await page.goto(`${origin}/?state=${state}&mode=${mode}`,{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-arena-scene]',{timeout:60000});
    if(state!=='prelaunch'){
      await page.waitForSelector('[data-arena-account-controls]',{visible:true});
      await page.waitForSelector('[data-arena-help-trigger]',{visible:true});
    }
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-arena-scene] img')].every(image=>image.complete&&image.naturalWidth>0));
    await noModal();
  };
  const measure=()=>page.evaluate(()=>{
    const controls=[...document.querySelectorAll('a[href],button,summary')].filter(element=>element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
    const describe=element=>{const rect=element.getBoundingClientRect();return {label:(element.getAttribute('aria-label')||element.textContent).trim().replace(/\s+/g,' '),tag:element.tagName.toLowerCase(),left:rect.left,right:rect.right,top:rect.top+scrollY,bottom:rect.bottom+scrollY,inViewport:rect.bottom>0&&rect.top<innerHeight,position:getComputedStyle(element).position};};
    const rows=controls.map(describe), overlaps=[];
    controls.forEach((first,index)=>controls.slice(index+1).forEach(second=>{
      if(first.contains(second)||second.contains(first))return;
      const a=first.getBoundingClientRect(),b=second.getBoundingClientRect();
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([describe(first).label,describe(second).label]);
    }));
    return {width:innerWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
      outside:rows.filter(row=>row.left< -1||row.right>innerWidth+1).map(row=>row.label),overlaps,
      renderedControls:rows.length,viewportControls:rows.filter(row=>row.inViewport).length,controls:rows,
      activities:[...document.querySelectorAll('[data-arena-activity]')].map(describe),
      sceneImages:[...document.querySelectorAll('[data-arena-scene] img')].map(image=>image.getAttribute('src')),
      sceneRequests:[...new Set(performance.getEntriesByType('resource').map(resource=>resource.name).filter(name=>name.includes('/contest/mascot/arena-scene-')))]};
  });
  const assertLayout=layout=>{
    assert.equal(layout.horizontalOverflow,false,'No horizontal page overflow');
    assert.deepEqual(layout.outside,[],'Controls must fit the viewport width');
    assert.deepEqual(layout.overlaps,[],'Interactive controls must not overlap');
  };
  const screenshot=name=>page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1,isMobile:width<700,hasTouch:width<700});
    for(const state of ['guest','new','returning','prelaunch']){
      const requestStart=requests.length;
      await load(state);
      const layout=await measure(); assertLayout(layout);
      assert.equal(layout.activities.length,3,'Exactly three activity choices');
      assert.equal(layout.sceneImages.length,1,'Exactly one scene image in the DOM');
      assert.equal(layout.sceneRequests.length,1,'Only the chosen scene is loaded');
      assert(layout.renderedControls<=8,'Learning stays alongside concise account and activity controls');
      assert.equal(await visibleCount('[data-arena-first-culture-trigger]'),0,'The retired first culture is absent');
      assert.equal(await visibleCount('[data-arena-discovery-entry] [data-arena-learning-trigger]'),1,'Learning remains directly available before and after opening');
      assert.equal(layout.controls.filter(control=>control.position==='fixed').length,0,'Account/help controls stay inline');
      assert.equal(await visibleCount('a[href*="pack-pionniers"],a[href*="view=missions"]'),0,'Pack and mission shortcuts are not permanently displayed');
      assert(requests.slice(requestStart).every(request=>request.method==='GET'),'Arrival must not mutate profile or tutorial progress');
      for(const activity of activities){
        const info=await page.$eval(`[data-arena-activity="${activity.id}"]`,element=>({text:element.textContent,tag:element.tagName,href:element.getAttribute('href'),disabled:element.getAttribute('aria-disabled')==='true'||element.disabled===true}));
        assert(info.text.includes(activity.label));
        if(state!=='prelaunch'){assert.equal(info.tag,'A');assert.equal(info.href,activity.href);}
        else {assert.equal(info.tag,'DIV','Prelaunch activities are non-interactive');assert.equal(info.href,null);assert(info.text.includes('Bientôt'));}
      }
      if(state==='prelaunch'){
        assert(await page.$eval('body',body=>body.textContent.includes('15 octobre')),'Opening date remains visible');
        assert.equal(await page.$$eval('[data-arena-activity] a,[data-arena-activity] button',elements=>elements.length),0);
      }
      if(width>=768){
        const rows=layout.activities;
        assert(Math.max(...rows.map(row=>row.top))-Math.min(...rows.map(row=>row.top))<2,'Desktop activities share one row');
      } else {
        assert(layout.activities.every((row,index)=>index===0||row.top>=layout.activities[index-1].bottom-1),'Mobile activities have distinct rows');
      }
      await screenshot(`${state}-${width}`);
      results.push({state,...layout,noAutomaticModal:true,arrivalReadOnly:true});
    }
    for(const activity of activities){
      await load('guest');
      await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click(`[data-arena-activity="${activity.id}"]`)]);
      assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,activity.href);
      await page.waitForSelector('[data-audit-destination]');
      navigationResults.push({width,activity:activity.id,oneClick:true,destination:activity.href});
    }
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
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await load('new');
  await clickText('Créer mon personnage'); await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await screenshot('new-profile-on-demand-390');
  await page.click('[aria-label="Fermer le profil"]'); await noModal();
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
  await clickText('Créer mon personnage'); await page.waitForSelector('[data-chanvrier-profile][open]',{visible:true});
  await saveProfile('Nouveau29');
  await page.waitForSelector('[data-chanvrier-card][data-inline="true"]',{visible:true});
  await noModal();
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
  const activeStart=requests.length;
  await load('returning','jouer',{step:4,status:'active'});
  await noModal();
  assert(requests.slice(activeStart).every(request=>request.method==='GET'),'Restored active progress does not restart the trial');
  await load('guest'); await page.click('[data-arena-help-trigger]');
  assert.equal(await visibleCount('a[href*="connexion"]')>0,true,'Guest has a sign-in path for the trial');
  await clickText('Lire le guide'); await page.waitForSelector('[role="dialog"]',{visible:true});
  await page.keyboard.press('Escape'); await noModal();
  await load('returning','carnet');
  assert((await measure()).sceneImages[0].includes('carnet'),'initialMode selects the unique scene');
  const initialTransform=await page.$eval('[data-arena-scene]',element=>getComputedStyle(element).transform);
  await page.mouse.move(310,400); await page.mouse.move(30,200);
  assert.equal(await page.$eval('[data-arena-scene]',element=>getComputedStyle(element).transform),initialTransform,'Pointer movement does not add parallax');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpectedApi,[]);assert.deepEqual(blockedRemote,[]);
  const report={passed:true,createdAt:new Date().toISOString(),scope:'Actual hub and account/help components; global shell omitted. API calls and navigation destinations are local fixtures; no environment or credentials loaded.',
    results,navigationResults,interactionResults,newProfileOptional:true,cancelledProfileDoesNotStartTrial:true,directProfileSaveDoesNotStartTrial:true,requestedTrialStartsAfterProfileSave:true,activeProgressDoesNotAutoOpen:true,guestGuideAvailable:true,initialModeRespected:true,sceneWithoutParallax:true,requests,errors,unexpectedApi,blockedRemote};
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:true,widths:[320,390,768,1440],states:['guest','new','returning','prelaunch'],oneClickRoutes:navigationResults.length,output},null,2));
} catch(error) {
  await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(resolve(output,'failure-report.json'),JSON.stringify({passed:false,error:error instanceof Error?error.stack:String(error),results,navigationResults,interactionResults,requests,errors,unexpectedApi,blockedRemote},null,2)+'\n');
  throw error;
} finally {await browser?.close();await server.close();}
