/** Focused keyboard regression: real notebook UI, synthetic data and local requests only. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const baseline = process.argv.includes('--baseline');
const selectedCase = process.argv.find(arg=>arg.startsWith('--case='))?.slice(7);
const output = resolve(root, 'output/notebook-keyboard', baseline ? 'baseline' : 'fixed');
const port = 3221;
const modules = {
  'keyboard-preview': `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ContestTastingBook} from '/src/components/contest/ContestTastingBook';
    const entry={id:'keyboard-flower',slug:'keyboard-flower',title:'Fleur du carnet',productId:'keyboard-product',seasonId:'keyboard-season',track:'regular',category:'outdoor',story:'Fleur fictive pour la vérification locale du clavier.',technicalSheet:{},producer:{id:'keyboard-producer',name:'Producteur fictif'},imageUrl:'/product_flower.jpg',galleryUrls:[],isPublished:true,position:0,createdAt:'2026-10-25',updatedAt:'2026-10-25',stats:{approvedReviewCount:0,averageScore:0,criterionAverages:{},consumptionCounts:{}}};
    createRoot(document.getElementById('root')).render(React.createElement(ContestTastingBook,{entries:[entry],unlocks:[{entryId:entry.id,unlockedAt:'2026-10-25'}],viewerProfile:{pseudo:'Camille',createdAt:'2026-10-25',updatedAt:'2026-10-25'},badges:[],isAuthenticated:true,draftOwnerId:'keyboard-audit',initialEntryId:entry.id,initialEditNotes:true,seasonLabel:'Vérification locale',initialTrack:'regular',initialCategory:'outdoor'}));
  `,
  'preview-consent': `export const useCookieConsent=()=>({showBanner:false});`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({
  configFile:false, envDir:false, root, publicDir:resolve(root,'public'),cacheDir:resolve(output,'vite-cache'),
  esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},
  optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'isolated-notebook-keyboard',enforce:'pre',
    resolveId(id){if(id.endsWith('/cookies/CookieConsentProvider'))return '\0preview-consent';if(id in modules)return '\0'+id;},
    load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},
    configureServer(vite){vite.middlewares.use((request,response,next)=>{
      if(request.url?.split('?')[0]!=='/')return next();
      response.setHeader('Content-Type','text/html');
      response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carnet · clavier local</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}@font-face{font-family:Hand;src:url('/src/app/fonts/Caveat-Latin-Bold.woff2');font-weight:700}:root{--font-display:Display;--font-body:Body;--font-sans:Body;--font-handwritten:Hand}body{margin:0}</style><main><div id="root"></div></main><script type="module" src="/@id/__x00__keyboard-preview"></script></html>`);
    });},
  }],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}},
});
const pause = () => new Promise(resolve=>setTimeout(resolve,400));
const comment = Array.from({length:18},(_,i)=>`Ligne ${i+1} : fleur douce, parfum fruité et agréable.`).join('\n');
const results=[],errors=[],requests=[];
let browser;
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.pathname.startsWith('/api/')){
      requests.push({path:url.pathname,method:request.method()});
      return void request.respond({status:200,contentType:'application/json',body:'{"campaigns":[],"availableEntitlements":[],"collection":{"cards":[]}}'});
    }
    void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port===String(port))?request.continue():request.abort());
  });
  await page.evaluateOnNewDocument(()=>{
    if(location.protocol==='http:')localStorage.clear();
    const viewport=window.visualViewport;
    const originalHeight=Object.getOwnPropertyDescriptor(VisualViewport.prototype,'height').get;
    const originalTop=Object.getOwnPropertyDescriptor(VisualViewport.prototype,'offsetTop').get;
    let fakeHeight=null,fakeTop=null;
    Object.defineProperty(viewport,'height',{configurable:true,get:()=>fakeHeight??originalHeight.call(viewport)});
    Object.defineProperty(viewport,'offsetTop',{configurable:true,get:()=>fakeTop??originalTop.call(viewport)});
    window.__setKeyboardViewport=(height,top=0)=>{
      fakeHeight=height;fakeTop=height===null?null:top;
      viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));
    };
  });
  const measure=()=>page.evaluate(()=>{
    const field=document.querySelector('[data-notebook-comment]');
    const scroll=field.closest('[data-tasting-scroll]');
    const r=field.getBoundingClientRect();
    const viewport=window.visualViewport;
    let top=viewport.offsetTop,bottom=top+viewport.height;
    for(let parent=field.parentElement;parent;parent=parent.parentElement){
      if(/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)){
        const bounds=parent.getBoundingClientRect();top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);
      }
      if(getComputedStyle(parent).position==='fixed')break;
    }
    const style=getComputedStyle(field),mirror=document.createElement('div');
    for(const property of ['boxSizing','width','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textIndent','wordSpacing','tabSize'])mirror.style[property]=style[property];
    Object.assign(mirror.style,{position:'absolute',left:'-10000px',top:'0',whiteSpace:'pre-wrap',overflowWrap:'break-word',borderStyle:'solid',visibility:'hidden'});
    mirror.textContent=field.value.substring(0,field.selectionEnd);
    const caret=document.createElement('span');caret.textContent='|';mirror.append(caret);document.body.append(mirror);
    const caretTop=r.top+caret.offsetTop-field.scrollTop,caretBottom=caretTop+caret.getBoundingClientRect().height;
    mirror.remove();
    const sr=scroll.getBoundingClientRect(),book=document.querySelector('[data-tasting-book]').getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,visualHeight:viewport.height,visualTop:viewport.offsetTop,bookTop:book.top,bookBottom:book.bottom,scrollTop:scroll.scrollTop,scrollHeight:sr.height,textareaTop:r.top,textareaBottom:r.bottom,textareaHeight:r.height,textareaVisible:Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,top)),clipTop:top,clipBottom:bottom,caretTop,caretBottom,caretVisible:caretTop>=Math.max(top,r.top)-2&&caretBottom<=Math.min(bottom,r.bottom)+2,fontSize:parseFloat(style.fontSize),horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,focused:document.activeElement===field};
  });
  const scenarios=[
    {name:'ios-320',width:320,height:568,keyboardHeight:260,offsetTop:0},
    {name:'ios-320-short',width:320,height:568,keyboardHeight:224,offsetTop:0},
    {name:'ios-390',width:390,height:844,keyboardHeight:350,offsetTop:0},
    {name:'ios-390-panned',width:390,height:844,keyboardHeight:250,offsetTop:56},
    {name:'android-320',width:320,height:568,keyboardHeight:260,resize:true},
    {name:'android-390',width:390,height:844,keyboardHeight:350,resize:true},
    {name:'android-landscape',width:844,height:390,keyboardHeight:224,resize:true,mobile:true},
    {name:'android-rotation',width:390,height:844,keyboardHeight:350,resize:true,rotation:true},
    {name:'desktop',width:1440,height:1000,keyboardHeight:1000},
  ];
  for(const scenario of scenarios){
    if(selectedCase&&!selectedCase.split(',').includes(scenario.name))continue;
    const mobile=scenario.mobile??scenario.width<700;
    const setKeyboard=async open=>{
      if(scenario.resize)await page.setViewport({width:scenario.width,height:open?scenario.keyboardHeight:scenario.height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
      else await page.evaluate(({height,top})=>window.__setKeyboardViewport(height,top),{height:open?scenario.keyboardHeight:null,top:scenario.offsetTop??0});
      await pause();
    };
    await page.setViewport({width:scenario.width,height:scenario.height,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-notebook-page-link="4"]',{visible:true,timeout:60000});
    await page.click('[data-notebook-page-link="4"]');
    await page.waitForSelector('[data-notebook-comment]');
    await page.focus('[data-notebook-comment]');await pause();
    const before=await measure();
    await setKeyboard(true);
    await pause();await page.keyboard.sendCharacter(comment.slice(0,-1));await page.type('[data-notebook-comment]',comment.slice(-1));await pause();
    const keyboard=await measure();
    await page.screenshot({path:resolve(output,`${scenario.name}.png`),clip:{x:0,y:scenario.offsetTop??0,width:scenario.width,height:scenario.keyboardHeight}});
    await page.$eval('[data-notebook-submit]',button=>button.scrollIntoView({block:'center'}));await pause();
    const submit=await page.$eval('[data-notebook-submit]',button=>{
      const r=button.getBoundingClientRect();let top=visualViewport.offsetTop,bottom=top+visualViewport.height;
      for(let parent=button.parentElement;parent;parent=parent.parentElement){if(/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)){const bounds=parent.getBoundingClientRect();top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}if(getComputedStyle(parent).position==='fixed')break;}
      return {top:r.top,bottom:r.bottom,visible:r.top>=top-1&&r.bottom<=bottom+1};
    });
    await setKeyboard(false);
    const systemDismissed=await page.$eval('[data-tasting-book]',book=>({compact:book.dataset.bookInputOpen==='true',focused:document.activeElement?.hasAttribute('data-notebook-comment')}));
    await page.$eval('[data-notebook-comment]',field=>field.blur());await pause();
    const restored=await measure();
    const actual=await page.$eval('[data-notebook-comment]',field=>field.value);
    let buttonDismissed=null,submitTapped=null,rotation=null;
    if(!baseline&&mobile){
      const reopenInput=async()=>{
        await page.$eval('[data-notebook-comment]',field=>field.scrollIntoView({block:'center'}));await pause();
        await page.tap('[data-notebook-comment]');await pause();
        assert(await page.$eval('[data-notebook-comment]',field=>document.activeElement===field),`${scenario.name}: reopening tap focuses comment`);
        await setKeyboard(true);
      };
      assert.equal(systemDismissed.compact,false,`${scenario.name}: system dismissal restores navigation even with input focused`);
      assert.equal(systemDismissed.focused,true,`${scenario.name}: system dismissal does not discard focus`);
      await reopenInput();
      await page.waitForSelector('[data-book-finish-input]',{visible:true});
      await page.tap('[data-book-finish-input]');await setKeyboard(false);
      buttonDismissed=await page.$eval('[data-tasting-book]',book=>({compact:book.dataset.bookInputOpen==='true',focused:document.activeElement?.hasAttribute('data-notebook-comment')}));
      assert.equal(buttonDismissed.compact,false,`${scenario.name}: close keyboard control restores navigation`);
      assert.equal(buttonDismissed.focused,false,`${scenario.name}: close keyboard control blurs textarea`);
      await reopenInput();
      if(scenario.rotation){
        const rotate=async height=>{await page.setViewport({width:844,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});await pause();};
        await rotate(224);
        await page.keyboard.sendCharacter('.');await page.keyboard.press('Backspace');await pause();
        const rotated=await measure();
        assert(rotated.scrollHeight>=120&&rotated.textareaVisible>=90&&rotated.caretVisible,'rotation: comment and newly typed line remain visible');
        await page.screenshot({path:resolve(output,'android-rotation-open.png')});
        await rotate(390);
        const firstClose=await page.$eval('[data-tasting-book]',book=>book.dataset.bookInputOpen==='true');
        assert.equal(firstClose,false,'rotation: native dismissal restores navigation');
        await page.$eval('[data-notebook-comment]',field=>field.scrollIntoView({block:'center'}));await pause();
        const tapPoint=await page.$eval('[data-notebook-comment]',field=>{
          const r=field.getBoundingClientRect(),s=field.closest('[data-tasting-scroll]').getBoundingClientRect();
          return {x:(r.left+r.right)/2,y:(Math.max(r.top,s.top,visualViewport.offsetTop)+Math.min(r.bottom,s.bottom,visualViewport.offsetTop+visualViewport.height))/2};
        });
        assert(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.hasAttribute('data-notebook-comment'),tapPoint),'rotation: reopening touches the visible part of the comment');
        await page.evaluate(()=>{
          window.__rotationEvents=[];
          for(const type of ['pointerdown','pointerup','focusout','focusin','touchend','click'])document.addEventListener(type,event=>window.__rotationEvents.push({type,target:event.target?.tagName,comment:event.target?.hasAttribute('data-notebook-comment'),active:document.activeElement?.tagName,compact:document.querySelector('[data-tasting-book]')?.dataset.bookInputOpen}),{capture:true});
        });
        await page.touchscreen.tap(tapPoint.x,tapPoint.y);await pause();
        const afterTap=await page.evaluate(()=>({events:window.__rotationEvents,active:document.activeElement?.tagName,compact:document.querySelector('[data-tasting-book]')?.dataset.bookInputOpen,scale:visualViewport.scale,height:visualViewport.height}));
        await rotate(224);
        const secondOpen=await page.$eval('[data-tasting-book]',book=>book.dataset.bookInputOpen==='true');
        if(!secondOpen)console.log(JSON.stringify({rotationTapFailure:afterTap,afterResize:await measure()}));
        assert.equal(secondOpen,true,'rotation: same focused field reopens keyboard layout');
        await rotate(390);
        const secondClose=await page.$eval('[data-tasting-book]',book=>book.dataset.bookInputOpen==='true');
        assert.equal(secondClose,false,'rotation: second native dismissal restores navigation');
        assert.equal(await page.$eval('[data-notebook-comment]',field=>field.value),comment,'rotation preserves the comment across two keyboard cycles');
        rotation={rotated,firstClose,secondOpen,secondClose};
        await setKeyboard(false);await reopenInput();
      }
      await page.$eval('[data-notebook-submit]',button=>button.scrollIntoView({block:'center'}));await pause();
      await page.evaluate(()=>{
        window.__tapEvents=[];
        for(const type of ['pointerdown','pointerup','focusout','focusin','touchstart','touchend','click'])document.addEventListener(type,event=>{
          const button=document.querySelector('[data-notebook-submit]');const r=button?.getBoundingClientRect();
          window.__tapEvents.push({type,target:event.target?.outerHTML?.slice(0,160),active:document.activeElement?.tagName,compact:document.querySelector('[data-tasting-book]')?.dataset.bookInputOpen,buttonTop:r?.top,buttonBottom:r?.bottom,time:performance.now()});
        },{capture:true});
      });
      await page.tap('[data-notebook-submit]');
      try{await page.waitForSelector('[data-notebook-page="1"]',{timeout:3000});}catch(error){
        const debug=await page.evaluate(()=>({events:window.__tapEvents,page:document.querySelector('[data-notebook-page]')?.dataset.notebookPage,alerts:[...document.querySelectorAll('[role="alert"]')].map(el=>el.textContent)}));
        console.log(JSON.stringify({scenario:scenario.name,tapFailure:debug}));
        await page.screenshot({path:resolve(output,`${scenario.name}-tap-failure.png`)});throw error;
      }
      submitTapped=await page.$eval('[role="alert"]',alert=>alert.textContent.includes('critère'));
      assert(submitTapped,`${scenario.name}: actual touch submits through blur and shows expected missing-criteria validation`);
    }
    results.push({scenario:scenario.name,before,keyboard,submit,systemDismissed,buttonDismissed,submitTapped,rotation,restored,commentPreserved:actual===comment});
    console.log(JSON.stringify(results.at(-1)));
    if(!baseline){
      assert.equal(keyboard.horizontalOverflow,false,`${scenario.name}: no horizontal overflow`);
      assert(keyboard.scrollHeight>=120,`${scenario.name}: usable reading/typing area (${keyboard.scrollHeight}px)`);
      assert(keyboard.textareaVisible>=90,`${scenario.name}: visible writing field (${keyboard.textareaVisible}px)`);
      assert(keyboard.caretVisible,`${scenario.name}: typed line remains visible`);
      assert(keyboard.fontSize>=16,`${scenario.name}: input avoids mobile zoom`);
      assert(submit.visible,`${scenario.name}: submission is reachable`);
      assert.equal(actual,comment,`${scenario.name}: keyboard dismissal preserves comment`);
      assert(Math.abs(restored.bookBottom-scenario.height)<=2,`${scenario.name}: notebook height restored`);
    }
  }
  await writeFile(resolve(output,selectedCase?`report-${selectedCase}.json`:'report.json'),JSON.stringify({results,errors,requests},null,2));
  assert.deepEqual(errors,[],'browser runtime errors');
  assert(requests.every(request=>request.method==='GET'),'no data writes');
  console.log(`${baseline?'Baseline collected':'Keyboard regression passed'}: ${results.length} scenarios, synthetic local data only.`);
} finally {await browser?.close();await server.close();}
