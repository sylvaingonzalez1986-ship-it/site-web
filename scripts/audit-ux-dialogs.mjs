/** Real dialog components; synthetic fixtures and local-only network. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/ux-implementation/dialogs'), port = 3269;
const modules = {
  'dialog-fixture': `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {CardDetailModal} from '/src/components/lottery/CardDetailModal';
    import {PageRewardDrawer} from '/src/components/lottery/PageRewardDrawer';
    import {DuplicateBurnDrawer} from '/src/components/lottery/DuplicateBurnDrawer';
    import {OrderDetailModal} from '/src/components/account/OrderDetailModal';
    import {ProducerTcgModal} from '/src/components/boutique/ProducerTcgModal';
    import {AppDialog,useDialogNavigation} from '/src/components/ui/AppDialog';
    const card={slotIndex:0,cardDefinitionId:'demo',code:'demo',cardNumber:1,name:'Buddie de démonstration',rarity:'common',imageUrl:'/app/lottery/tcg-card-back-sylvain-v2.webp',description:'Une longue description de carte. '.repeat(50),isOwned:true,ownedCount:12,burnableCount:11,burnableInstanceIds:Array.from({length:11},(_,i)=>'copy-'+i)};
    const page={rarity:'common',label:'Bronze',rewardStatus:'claimable',rewardOptions:Array.from({length:12},(_,i)=>({rewardDefinitionId:'reward-'+i,title:'Récompense '+i,description:'Une réduction de démonstration.',discountPercent:10})),burnOffer:{duplicatesRequired:10,discountPercent:10,giftWeightGrams:2}};
    const order={id:'DEMO-COMMANDE-123456789',createdAt:'2026-10-14T10:00:00Z',status:'paid',paymentState:'paid',shippingAddress:'1 rue de la Démonstration',shippingCity:'Rennes',shippingPostalCode:'35000',shippingCountry:'FR',totalAmount:180,items:Array.from({length:20},(_,i)=>({name:'Fleur de démonstration au nom très long '+i,quantity:2,unitPrice:4.5,lineTotal:9}))};
    const producers=[0,1].map(i=>({id:'producer-'+i,name:'Producteur '+i,description:'Une histoire de terroir. '.repeat(15),image:card.imageUrl,location:'Bretagne',department:'Ille-et-Vilaine',region:'Bretagne',website:'',socialLinks:{},cultureType:['outdoor'],certifications:[],climate:'oceanic',soil:'loam',altitude:'50 m',speciality:'Fleurs',philosophy:'',experience:'10 ans',founded:'2016'}));
    const fetchOriginal=window.fetch.bind(window);window.fetch=(input,init)=>String(input).startsWith('/api/')?Promise.resolve(Response.json({rewards:null})):fetchOriginal(input,init);
    function NavigateAction({finish}){const navigate=useDialogNavigation();return <button data-navigate onClick={()=>navigate(finish)}>Ouvrir la destination</button>;}
    function Fixture(){const [open,setOpen]=useState(null),[nested,setNested]=useState(false),[producer,setProducer]=useState('producer-0');return <>
      <main style={{padding:24}}><h1>Recette fenêtres</h1>{['card','reward','burn','order','producer','replace','navigate'].map(kind=><button style={{margin:8,padding:16,border:'2px solid'}} data-open={kind} key={kind} onClick={()=>setOpen(kind)}>{kind}</button>)}<p style={{height:1600}}>Page de fond défilante</p></main>
      <nav data-test-dock style={{position:'fixed',bottom:0,width:'100%',height:68,zIndex:2147483000,background:'orange'}}>Navigation de fond</nav>
      {open==='card'&&<CardDetailModal slot={card} onClose={()=>setOpen(null)}/>}
      {open==='reward'&&<PageRewardDrawer page={page} acting={false} onClaim={async()=>{}} onClose={()=>setOpen(null)}/>}
      {open==='burn'&&<DuplicateBurnDrawer page={page} group={{...card,duplicateCount:11}} acting={false} onBurn={async()=>{}} onClose={()=>setOpen(null)}/>}
      <OrderDetailModal order={open==='order'?order:null} onClose={()=>setOpen(null)}/>
      <ProducerTcgModal open={open==='producer'} producers={producers} selectedProducerId={producer} productsByProducerId={new Map(producers.map(p=>[p.id,[{id:'demo'}]]))} addButtonLabel='Ajouter' lowStockThresholdGrams={5} producerPartnerLabel='Producteur partenaire' producerWebsiteLabel='Voir son site' onClose={()=>setOpen(null)} onSelectProducer={setProducer}/>
      {open==='replace'&&<AppDialog open onClose={()=>setOpen(null)} title='Choisir'><button data-replace onClick={()=>setOpen('card')}>Voir la carte</button></AppDialog>}
      <AppDialog open={open==='navigate'} onClose={()=>setOpen(null)} title='Parent'><button data-nest onClick={()=>setNested(true)}>Ouvrir enfant</button><AppDialog open={nested} onClose={()=>setNested(false)} title='Enfant'><NavigateAction finish={()=>history.pushState({test:'destination'},'', '/?destination')}/></AppDialog></AppDialog>
    </>};createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);`,
  'image-stub': `import React from 'react';export default function Image({fill,priority,sizes,unoptimized,placeholder,blurDataURL,loader,...props}){return <img {...props} style={{...props.style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:{})}}/>}`,
  'link-stub': `import React from 'react';export default function Link({prefetch,replace,scroll,...props}){return <a {...props}/>}`,
  'product-stub': `import React,{useState} from 'react';import {ProductAnalysisModal} from '/src/components/boutique/ProductAnalysisModal';import {ProductVideoModal} from '/src/components/boutique/ProductVideoModal';export function ProductCard(){const [media,setMedia]=useState(null);return <div><button style={{padding:20}} data-media='analysis' onClick={()=>setMedia('analysis')}>Analyse de la fleur</button><button style={{padding:20}} data-media='video' onClick={()=>setMedia('video')}>Vidéo de la fleur</button><ProductAnalysisModal open={media==='analysis'} analysisUrl='/fixture-analysis' productName='Fleur de démonstration' onClose={()=>setMedia(null)}/><ProductVideoModal open={media==='video'} videoUrl='/fixture-video' productName='Fleur de démonstration' onClose={()=>setMedia(null)}/></div>}`,
};
const server = await createServer({configFile:false,root,publicDir:resolve(root,'public'),cacheDir:resolve(output,'vite-cache'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','lucide-react']},plugins:[{name:'dialog-fixture',enforce:'pre',resolveId(id){const normalized=id.replaceAll('\\','/');if(id==='next/image')return '\0image-stub';if(id==='next/link'||normalized.endsWith('/components/navigation/NavigationLink'))return '\0link-stub';if(normalized.endsWith('/components/ProductCard'))return '\0product-stub';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},transform(code,id){if(id.startsWith('\0')&&modules[id.slice(1)])return transformWithOxc(code,id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}});},configureServer(vite){vite.middlewares.use((req,res,next)=>{const path=req.url?.split('?')[0];if(path==='/fixture-analysis'){res.setHeader('Content-Type','text/html');res.end('<p>Analyse de démonstration</p>');return;}if(path==='/fixture-video'){res.statusCode=404;res.end();return;}if(path!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-body:Arial;--font-display:Impact}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__dialog-fixture"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;const errors=[],results=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port===String(port)))void r.continue();else void r.abort();});
  const settle=()=>new Promise(resolve=>setTimeout(resolve,150));
  const count=()=>page.$$eval('dialog[open]',els=>els.length);
  for (const [width,height] of [[320,568],[390,844],[430,932],[844,390],[390,420],[1440,1000]]) {
    await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle0'});
    for(const kind of ['card','reward','burn','order','producer']) {
      await page.click(`[data-open="${kind}"]`);await page.waitForSelector('dialog[open]');await settle();
      const before=await page.evaluate(()=>({state:history.state,scroll:scrollY}));
      const check=await page.$eval('dialog[open]',dialog=>{const close=dialog.querySelector(':scope > header > button'),r=close.getBoundingClientRect(),body=dialog.querySelector('[data-app-dialog-body]');body.scrollTop=body.scrollHeight;return {width:innerWidth,height:innerHeight,closeW:r.width,closeH:r.height,closeVisible:r.top>=0&&r.bottom<=innerHeight,overflow:dialog.scrollWidth>dialog.clientWidth+1,bodyOverflow:body.scrollWidth>body.clientWidth+1,topLayer:dialog.matches(':modal'),lock:document.documentElement.style.overflow,front:dialog.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};});
      await page.screenshot({path:resolve(output,kind+'-'+width+'x'+height+'.png')}); if(check.bodyOverflow) console.log(await page.$eval('dialog[open] [data-app-dialog-body]',body=>[...body.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>body.getBoundingClientRect().right+1).slice(0,10).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,40)})))); assert(check.closeW>=44&&check.closeH>=44&&check.closeVisible&&check.topLayer&&check.front,JSON.stringify({kind,...check}));assert.equal(check.overflow,false,JSON.stringify({kind,...check}));assert.equal(check.bodyOverflow,false,JSON.stringify({kind,...check}));assert.equal(check.lock,'hidden');
      await page.screenshot({path:resolve(output,`${kind}-${width}x${height}.png`)});
      if(kind==='producer'){
        for(const media of ['analysis','video']){
          await page.click(`[data-media="${media}"]`);await page.waitForFunction(()=>document.querySelectorAll('dialog[open]').length===2);await settle();
          await page.keyboard.press('Escape');await settle();assert.equal(await count(),1,'Escape closes only media');assert(await page.$('dialog[aria-label^="Fiche producteur"]'));
          assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-media')),media,'Focus returns to media opener');
        }
      }
      await page.focus('dialog[open] > header > button');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');assert(await page.evaluate(()=>document.activeElement?.closest('dialog[open]')!==null),'Tab remains inside dialog');
      if(kind==='order')await page.goBack();else await page.keyboard.press('Escape');await settle();assert.equal(await count(),0);assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-open')),kind,'Focus returns to opener');
      results.push({kind,width,height,...check,historyBefore:before.state});
    }
  }
  await page.click('[data-open="replace"]');await page.click('[data-replace]');await settle();assert.equal(await count(),1,'Replacing a dialog keeps the destination open');assert(await page.$('#card-detail-title'));
  await page.keyboard.press('Escape');await settle();assert.equal(await count(),0);
  await page.evaluate(()=>history.pushState({test:'departure'},'', '/?departure'));await page.click('[data-open="navigate"]');await page.click('[data-nest]');assert.equal(await count(),2);
  await page.click('[data-navigate]');await page.waitForFunction(()=>location.search==='?destination');await settle();assert.equal(await count(),0,'Navigation closes every overlay');await page.goBack();await settle();assert.equal(new URL(page.url()).search,'?departure');assert.deepEqual(await page.evaluate(()=>history.state),{test:'departure'},'Back reaches the real departure without ghost overlays');assert.equal(await count(),0);
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors}));
} finally {await browser?.close();await server.close();}
