/** Real album components and hook, local synthetic API responses, no credentials. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-workshop/album');
const modules = {
  'album-entry': `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {CollectionAlbumContent} from '/src/components/account/CollectionAlbumClient';
    import {LOTTERY_POINTS_PACK_COST} from '/src/lib/lottery-collection';
    import {RARITY_ORDER,rarityLabels} from '/src/lib/lottery-card-ui';
    const params=new URLSearchParams(location.search),empty=params.has('empty');
    const imageUrl='/app/lottery/tcg-card-back.png';
    const reward={rewardDefinitionId:'reward-1',code:'reward',title:'Réduction de collection',description:'Une récompense de démonstration.',kind:'discount',imageUrl:'',discountPercent:10,customPayload:{},priority:1,isActive:true};
    const pages=RARITY_ORDER.map((rarity,p)=>{
      const owned=empty?0:p===0?8:3;
      const slots=Array.from({length:8},(_,i)=>({slotIndex:i,cardDefinitionId:rarity+i,code:rarity+i,cardNumber:p*8+i+1,name:'Carte '+(p*8+i+1),rarity,imageUrl,description:'Carte de démonstration.',isOwned:i<owned,ownedCount:i<owned?i===0?11:1:0,burnableCount:i===0&&!empty?10:0,burnableInstanceIds:i===0&&!empty?Array.from({length:10},(_,j)=>rarity+'-copy-'+j):[]}));
      return {rarity,pageNumber:p+1,label:rarityLabels[rarity],title:'Les '+rarityLabels[rarity],totalSlots:8,ownedUnique:owned,missingCount:8-owned,duplicateCopies:empty?0:10,completionPercent:owned/8*100,isComplete:owned===8,rewardStatus:owned===8?'claimable':'locked',rewardOptions:[reward],burnOffer:p<3?{duplicatesRequired:10,discountPercent:10,giftWeightGrams:2}:null,slots,duplicateGroups:empty?[]:[{...slots[0],duplicateCount:10}]};
    });
    const album={collectionId:'demo',collectionCode:'demo',collectionTitle:'Les Buddies',isActive:true,pageOrder:RARITY_ORDER,summary:{totalCards:40,ownedUnique:empty?0:20,totalOwnedCopies:empty?0:70,duplicateCopies:empty?0:50,completionPercent:empty?0:50,completedPages:empty?0:1,claimablePages:empty?0:1,availableClaims:0},pages,availableClaims:[],generatedAt:'2026-09-10'};
    let tickets=empty?[]:[{id:'pack-1',ticketNumber:'DEMO-001',status:'available'}],points=empty?0:LOTTERY_POINTS_PACK_COST*3;
    window.__writes=[];window.__failPack=params.has('packError');
    const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}}),realFetch=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return realFetch(url,init);
      if(init.method==='POST')window.__writes.push({url,body:init.body?JSON.parse(init.body):null});
      if(String(url).endsWith('/scratch')){
        await new Promise(r=>setTimeout(r,params.has('slow')?1800:80));
        if(window.__failPack){window.__failPack=false;return new Response(JSON.stringify({error:'Réseau momentanément indisponible. Réessaie.'}),{status:503});}
        const cards=RARITY_ORDER.map((rarity,i)=>({id:'reward-card-'+i,cardNumber:i+1,name:['La découverte','Reflet argenté','Pépite dorée','Éclat épique','Héritage légendaire'][i],rarity,imageUrl,ownedCount:i===1?2:1,isBonus:i===3,description:'Carte de démonstration.'}));
        tickets[0].status='scratched';return json({ticketId:'pack-1',ticketNumber:'DEMO-001',scratchedAt:'2026-09-11',card:cards[0],cards,inventory:{totalCards:40,uniqueOwned:24,totalOwnedCopies:75,duplicateCopies:51,byRarity:{}},bonusPrize:{title:'Bonus de démonstration'}});
      }
      if(url==='/api/account/welcome-pack')return json({eligible:params.has('welcome')});
      if(url==='/api/public/collection-preview')return json({album});
      if(url==='/api/arena/placard/bootstrap')return json({collection:{cards:[]}});
      if(url==='/api/account/collection')return json(album);
      if(url==='/api/account/tickets'){
        if(init.method==='POST'){const {packCount}=JSON.parse(init.body);points-=packCount*LOTTERY_POINTS_PACK_COST;tickets.push({id:'pack-2',ticketNumber:'DEMO-002',status:'available'});return json({granted:packCount});}
        return json({tickets,loyalty:{spendablePoints:points},config:{seasonLabel:'Saison 01',albumSubtitle:'Les cartes de ta collection, réunies au même endroit.'}});
      }
      if(url==='/api/account/collection/claim'){pages[0].rewardStatus='claimed';return json({claim:{id:'claim-1'}});}
      if(url==='/api/account/collection/burn'){pages[0].duplicateGroups=[];return json({claim:{id:'burn-1'}});}
      return json({error:'Route absente de la démonstration'});
    };
    createRoot(document.getElementById('root')).render(React.createElement(CollectionAlbumContent,{embedded:params.has('embedded')}));`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/profil/collection';export const useSearchParams=()=>new URLSearchParams();`,
  '/src/context/CartContext.tsx': `export const useCart=()=>({isAuthenticated:!new URLSearchParams(location.search).has('preview'),authLoading:false});`,
};
const server = await createServer({root, configFile:false, envDir:false, cacheDir:resolve(output,'vite-cache'), publicDir:resolve(root,'public'), esbuild:{jsx:'automatic'}, optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'album-audit',enforce:'pre',resolveId(id){if(id.replaceAll('\\','/').endsWith('/src/context/CartContext'))return '\0/src/context/CartContext.tsx';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Album</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__album-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3197,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;const errors=[],results=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3197'))void r.continue();else void r.abort();});
  const visit=async(query='')=>{await page.goto('http://127.0.0.1:3197/'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-album-lobby]');};
  const enter=async(mode)=>{await page.click(`[data-album-mode-button="${mode}"]`);await page.click('[data-album-enter]');};
  const back=async()=>page.locator('::-p-text(Retour à l’album)').click();
  const shot=async(name)=>page.screenshot({path:resolve(output,name+'.png')});
  const layout=()=>page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}));
  for(const width of [320,390,768,1440]) {
    console.log('Album and booster audit:',width);
    await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});await visit();
    await shot('album-'+width);const check=await layout();assert.equal(check.overflow,false);assert.deepEqual(check.brokenImages,[]);
    assert(await page.$('img[src="/app/lottery/charles-booster-presentation-v2.png"]'));
    assert.equal(await page.$('img[src="/app/lottery/album-booster-mascot-v3.webp"]'),null);
    assert.equal(await page.$$eval('[data-album-enter]',els=>els.length),1);
    await enter('cards');await page.waitForSelector('[aria-label="Mes cartes"]');
    await page.click('button[aria-label="Page suivante"]');
    assert.equal(await page.$eval('[aria-current="page"]',el=>el.textContent.includes('Silver')),true);
    const visible=await page.$eval('[aria-current="page"]',el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1;});assert(visible);
    await page.click('button[aria-label="Page précédente"]');
    await page.$eval('[aria-label="Mes cartes"]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));await shot('cards-'+width);
    await page.click('button[title="#1 Carte 1"]');await page.waitForSelector('[role="dialog"]');await shot('detail-'+width);await page.click('[role="dialog"] button[aria-label="Fermer"]');
    await page.locator('::-p-text(La Botte & Héritages)').click();await page.waitForSelector('[aria-label="Progression La Botte"]');assert.equal((await layout()).overflow,false);await shot('placard-'+width);
    await back();await page.click('[data-album-enter]');await page.waitForSelector('[aria-label="Glissez pour ouvrir le booster"]');
    assert(await page.$('img[src="/app/lottery/sealed-booster-pack.png"]'));
    await new Promise(r=>setTimeout(r,750));await shot('pack-sealed-'+width);
    const pack=await page.$('[aria-label="Glissez pour ouvrir le booster"]'),bounds=await pack.boundingBox();
    if(width===390){
      const x=bounds.x+bounds.width*.15,y=bounds.y+bounds.height*.4;
      await page.touchscreen.touchStart(x,y);await page.touchscreen.touchMove(x+20,y);await page.touchscreen.touchEnd();assert.equal(await page.evaluate(()=>window.__writes.length),0);
      await page.touchscreen.touchStart(x,y);await page.touchscreen.touchMove(x+bounds.width*.75,y);await page.touchscreen.touchEnd();
    }else{
      await page.locator('::-p-text(Ouvrir le pack)').click();
      await page.evaluate(()=>document.querySelector('[aria-label="Glissez pour ouvrir le booster"]')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    }
    await page.waitForSelector('[data-pack-phase="opening"]');await shot('pack-tear-'+width);await page.waitForSelector('[data-pack-phase="cards"]');
    assert.equal(await page.evaluate(()=>window.__writes.filter(w=>w.url.endsWith('/scratch')).length),1);
    const rarities=['common','silver','gold','epic','legendary'];
    for(let i=0;i<5;i++){
      assert(await page.$('[data-card-revealed="false"]'));
      if(width===390&&i===1){const box=await (await page.$('[data-card-revealed]')).boundingBox();await page.touchscreen.touchStart(box.x+box.width*.85,box.y+box.height*.5);await page.touchscreen.touchMove(box.x+box.width*.15,box.y+box.height*.5);await page.touchscreen.touchEnd();}
      else{await page.focus('[data-card-revealed]');await page.keyboard.press('Enter');}
      await page.waitForSelector('[data-card-revealed="true"]');
      assert.equal(await page.$eval('[data-pack-phase]',e=>e.dataset.rarity),rarities[i]);
      await new Promise(r=>setTimeout(r,950));await shot('pack-'+rarities[i]+'-'+width);
      assert.equal((await layout()).overflow,false);
      if(i<4)await page.click('button[aria-label="Carte suivante"]');
    }
    await page.locator('::-p-text(Voir mon butin)').click();await page.waitForSelector('[data-pack-phase="recap"]');await new Promise(r=>setTimeout(r,1000));await shot('pack-recap-'+width);
    assert.equal(await page.$$eval('button[aria-label^="Revoir "]',els=>els.length),5);
    await page.locator('::-p-text(Ranger dans mon album)').click();assert.equal(await page.$('[aria-label="Ouverture du booster"]'),null);
    results.push({width,...check,pages:true,cardDetails:true,originalBooster:true});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await visit();
  await page.locator('::-p-text(Obtenir des boosters)').click();await shot('boosters-390');
  await page.locator('::-p-text(Acheter 1)').click();await page.waitForFunction(()=>window.__writes.some(w=>w.url==='/api/account/tickets'));
  assert.deepEqual(await page.evaluate(()=>window.__writes[0].body),{packCount:1});
  await back();await enter('rewards');await shot('rewards-390');
  await page.locator('::-p-text(Voir mes gains)').click();await page.waitForSelector('#page-reward-title');await shot('reward-390');
  await page.locator('[role="dialog"] ::-p-text(Réduction de collection)').click();await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
  assert.deepEqual(await page.evaluate(()=>window.__writes.find(w=>w.url.endsWith('/claim')).body),{pageRarity:'common',rewardDefinitionId:'reward-1'});
  await page.locator('::-p-text(Gérer mes doublons)').click();await page.waitForSelector('#duplicate-manager-title');await shot('duplicates-390');await page.click('[role="dialog"] button[aria-label="Fermer"]');
  await visit('?empty=1');assert(await page.$eval('[data-album-enter]',e=>e.textContent.includes('Obtenir')));assert.equal((await layout()).overflow,false);await shot('empty-390');
  await page.click('[data-album-enter]');assert(await page.$eval('[aria-label="Actions de l\'album"] > div button:last-child',e=>e.disabled));
  await visit('?preview=1');assert(await page.$('a[href="/compte/inscription?next=/profil/collection"]'));assert.equal((await layout()).overflow,false);await shot('preview-390');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await visit('?embedded=1');
  await page.focus('[data-album-mode-button="boosters"]');await page.keyboard.press('End');assert.equal(await page.$eval('[data-album-mode-button="rewards"]',e=>e.getAttribute('aria-pressed')),'true');
  await page.keyboard.press('Home');assert.equal(await page.$eval('[data-album-mode-button="boosters"]',e=>e.getAttribute('aria-pressed')),'true');
  await enter('cards');assert.equal((await layout()).overflow,false);
  await visit('?packError=1');await page.click('[data-album-enter]');await page.focus('[aria-label="Glissez pour ouvrir le booster"]');await page.keyboard.press('Enter');
  await page.waitForSelector('[data-pack-phase="error"]');await shot('pack-error');await page.locator('::-p-text(Réessayer)').click();await page.waitForSelector('[data-pack-phase="cards"]');
  assert.equal(await page.evaluate(()=>window.__writes.filter(w=>w.url.endsWith('/scratch')).length),2);
  await page.locator('::-p-text(Tout révéler)').click();await page.waitForSelector('[data-pack-phase="recap"]');
  await new Promise(r=>setTimeout(r,3300));assert(await page.$('[data-pack-phase="recap"]'));
  await page.click('button[aria-label="Revoir Héritage légendaire"]');assert(await page.$('[data-card-revealed="true"]'));
  assert(await page.$$eval('[data-pack-phase] *',els=>els.every(el=>getComputedStyle(el).animationName==='none')));
  await page.keyboard.press('Escape');assert.equal(await page.$('[aria-label="Ouverture du booster"]'),null);
  await page.setViewport({width:320,height:480,isMobile:true,hasTouch:true});await visit('?slow=1');await page.click('[data-album-enter]');
  await page.locator('::-p-text(Ouvrir le pack)').click();await page.locator('::-p-text(Passer l’animation)').click();await page.waitForSelector('[data-pack-phase="cards"]');
  assert.equal(await page.evaluate(()=>window.__writes.filter(w=>w.url.endsWith('/scratch')).length),1);
  await page.locator('::-p-text(Tout révéler)').click();await shot('pack-small-height');assert.equal((await layout()).overflow,false);
  await page.focus('button[aria-label="Fermer"]');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');assert(await page.$eval('[role="dialog"]',el=>el.contains(document.activeElement)));
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,purchase:true,claim:true,duplicates:true,empty:true,preview:true,reducedMotion:true,pack:{touch:true,keyboard:true,allRarities:true,bonus:true,noDuplicateRequests:true,retry:true,skip:true,manualRecap:true,shortViewport:true,focusTrap:true},errors},null,2));
  console.log(JSON.stringify({passed:true,output}));
} finally {await browser?.close();await server.close();}
