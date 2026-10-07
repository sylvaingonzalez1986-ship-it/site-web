/** Real player mission components, local API fixtures only. Run --preview for manual review. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/community-missions'), port = 3253, origin = `http://127.0.0.1:${port}`, preview = process.argv.includes('--preview');
const fixture = `
const result=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const query=new URLSearchParams(location.search);
const iso='2026-09-28T10:00:00Z';
const submission=(missionId,status,extra={})=>({id:'proof-'+missionId,userId:'fixture-player',missionId,proofUrl:'https://www.instagram.com/p/fixture/',proofStoragePath:'private/fixture.webp',proofContentType:'image/webp',proofFileSize:300,proofUploadedAt:iso,proofText:'Mon pseudo : FleurDuLarge',status,adminNote:null,reviewedBy:null,reviewedAt:null,rewardGranted:status==='approved',revision:2,rewardType:'support_pack',rewardAmount:1,rewardCardId:null,rewardCardName:null,rewardLabel:'1 pack Botte du Chanvrier',missionTitle:'Une mission du tableau',createdAt:iso,...extra});
const mission=(id,title,rewardType,rewardAmount,extra={})=>({id,slug:id,title,description:'Partage ta plus belle Fleur du Placard et présente sa force à la communauté.',icon:'camera',rewardType,rewardAmount,rewardCardId:null,maxCompletionsPerUser:1,requiresProof:true,proofInstructions:'La Fleur et ton pseudonyme doivent être visibles. Une capture lisible suffit.',isActive:true,sortOrder:1,userSubmissions:[],completedCount:0,canSubmit:true,...extra});
window.__missions=[
mission('flower','Présente ta championne','support_pack',1),
mission('community','Ton histoire de chanvrier','game_cash',2500,{icon:'star',canSubmit:false,userSubmissions:[submission('community','pending',{rewardType:'game_cash',rewardAmount:2500})]}),
mission('buddy','La plus belle photo','buddies',1,{rewardCardId:'buddy-fixture',userSubmissions:[submission('buddy','changes_requested',{adminNote:'Peux-tu ajouter ton pseudo sur la capture ?',rewardType:'buddies',rewardCardName:'Sylvain'})]}),
mission('pack','Ton carnet de bord','packs',2,{completedCount:1,canSubmit:false,userSubmissions:[submission('pack','approved',{rewardType:'packs',rewardAmount:2})]}),
mission('visit','Les nouvelles du village','points',10),
mission('inactive','Ancienne mission conservée','points',12,{isActive:false,canSubmit:false,userSubmissions:[submission('inactive','rejected',{missionTitle:'Ancienne mission conservée',createdAt:'2026-09-28T12:00:00Z',adminNote:'La capture ne montre pas le compte demandé.',rewardType:'points',rewardAmount:12})]})];
const rewards=[{id:'referral-fixture',referrerId:'fixture-player',refereeId:'fixture-friend',orderId:'order-fixture',status:'pending',pointsAmount:20,packsAmount:1,chosenAt:null,createdAt:iso}];
const codes=['first-harvest','three-varieties','contest-flower','online-two','online-five','online-ten','shop-one','shop-three','shop-six'];
const legacy={collectionActive:true,missions:codes.map((code,index)=>({code,track:index<3?'culture':index<6?'online':'shops',step:index%3+1,target:index%3+1,progress:index===0?1:0,cardCount:3,claimed:false,unlocked:index%3===0,claimable:index===0,entitlementId:null,packAvailable:false}))};
window.__posts=[];window.__reads=0;window.__destinations=[];window.__proofUrls=[];window.__revokedUrls=[];window.__getMode=query.get('state')||'ok';window.__postMode='ok';window.__slowGet=false;
const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=file=>{const url=create(file);window.__proofUrls.push(url);return url;};URL.revokeObjectURL=url=>{window.__revokedUrls.push(url);revoke(url);};
const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{const url=new URL(String(input),location.href);if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
 if(url.pathname==='/api/account/missions'){
  if(init.method==='POST'){
   const body=Object.fromEntries([...init.body.entries()].map(([key,value])=>[key,value instanceof File?{name:value.name,type:value.type,size:value.size}:value]));window.__posts.push(body);
   await new Promise(resolve=>setTimeout(resolve,100));
   if(window.__postMode==='network')throw new TypeError('Connexion interrompue');
   if(window.__postMode==='error')return result({error:'Vérification momentanément indisponible. Réessaie.'},503);
   const selected=window.__missions.find(item=>item.id===body.missionId);selected.userSubmissions=[submission(selected.id,'pending',{id:body.submissionId||'proof-'+selected.id,proofUrl:body.proofUrl||null,proofText:body.proofText,revision:body.submissionId?3:1,rewardType:selected.rewardType,rewardAmount:selected.rewardAmount})];selected.canSubmit=false;
   return result({success:true});
  }
  window.__reads++;const value=structuredClone({missions:window.__missions,pendingRewards:rewards});
  if(window.__slowGet){window.__slowGet=false;await new Promise(resolve=>setTimeout(resolve,450));}
  if(window.__getMode==='unauthorized')return result({error:'Connecte-toi pour retrouver tes missions.'},401);
  if(window.__getMode==='error')return result({error:'Le tableau est temporairement indisponible.'},503);
  return result(value);
 }
 if(url.pathname==='/api/arena/placard/missions'){
  if(init.method==='POST'){const body=JSON.parse(init.body);const selected=legacy.missions.find(item=>item.code===body.code);selected.claimed=true;selected.claimable=false;selected.packAvailable=true;return result({entitlementId:'legacy-fixture',cardCount:3,replayed:false});}
  return result(legacy);
 }
 if(url.pathname==='/api/account/referral-choice'){const body=JSON.parse(init.body);rewards[0].status='chosen_'+body.choice;return result({success:true});}
 return result({error:'API non simulée'},404);
};`;
const modules = {
 entry: `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {KqMissionCenter} from '/src/components/placard/KqMissionCenter';import {MissionsSection} from '/src/components/account/MissionsSection';${fixture}createRoot(document.getElementById('root')).render(<><p style={{padding:'8px 16px',margin:0,background:'#fff6dc',color:'#003f30',fontSize:11}}>Prévisualisation locale · missions et récompenses de démonstration</p>{query.has('account')?<div style={{maxWidth:1120,margin:'auto',padding:16}}><MissionsSection/></div>:<KqMissionCenter onOpen={view=>window.__destinations.push(view)}/>}</>);`,
 'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
 'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30;font-family:Body,sans-serif}button{cursor:pointer}`;
const server = await createServer({ root, configFile:false, envDir:false, cacheDir:resolve(output,'vite-cache'), publicDir:resolve(root,'public'), optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']}, resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']}, css:{postcss:{plugins:[tailwindcss({base:root})]}}, plugins:[{name:'community-missions-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/','/arene/placard','/compte'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Centre de missions — aperçu local</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);});}}], server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null} });
await mkdir(output,{recursive:true});await server.listen();
let browser;
const errors=[], results=[];
if(preview){console.log(`Prévisualisation du centre de missions : ${origin}/`);}else try {
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||['data:','blob:'].includes(url.protocol))void request.continue();else void request.abort();});
 const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
 const click=async(text,selector='button')=>{const element=await page.waitForFunction((text,selector)=>[...document.querySelectorAll(selector)].find(el=>el.textContent.trim()===text&&el.checkVisibility()),{},text,selector);await element.asElement().click();await element.dispose();};
 const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');
 const body=()=>page.evaluate(()=>document.body.innerText);
 const shot=name=>page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
 const open=async(id='flower')=>{await page.click(`[data-mission-id="${id}"] button`);await page.waitForSelector('dialog[open]');assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');assert(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));};
 const imagePath=resolve(output,'proof.png');await writeFile(imagePath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});await visit();await page.waitForSelector('[data-mission-id="flower"]');assert.equal(await page.$$eval('[data-mission-id]',items=>items.length),4);await noOverflow();assert.deepEqual(await page.$$eval('img',images=>images.filter(image=>image.complete&&!image.naturalWidth).map(image=>image.src)),[]);await shot('community-'+width);
  await open();await noOverflow();await page.screenshot({path:resolve(output,'proof-dialog-'+width+'.png')});await page.focus('dialog [aria-label="Fermer la mission"]');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('type')),'submit');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Fermer la mission');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-mission-id]')?.dataset.missionId),'flower');
  await click('Suivant');assert.equal(await page.$$eval('[data-mission-id]',items=>items.length),1);await click('Précédent');await click('Tous mes défis');await page.waitForSelector('progress');assert.equal(await page.$$eval('progress',items=>items.length),3);await noOverflow();await shot('legacy-challenges-'+width);await click('Communauté');await page.waitForSelector('[data-mission-id="flower"]');
  results.push({width,illustratedWelcome:true,fourCardsPerPage:true,pagination:true,legacyChallengesAccessible:true,dialogFocus:true,escapeRestoresFocus:true,noOverflow:true});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await visit();await open();await click('Envoyer ma preuve');await page.waitForSelector('dialog [role="alert"]');assert.equal(await page.evaluate(()=>window.__posts.length),0);
 const file=await page.$('dialog input[type=file]');await file.uploadFile(imagePath);await page.waitForSelector('img[alt="Aperçu de ta capture"]');await page.type('dialog textarea','Mon message conservé');await page.evaluate(()=>{window.__postMode='network';});await click('Envoyer ma preuve');await page.waitForFunction(()=>document.querySelector('dialog [role="alert"]')?.textContent.includes('Connexion'));assert.equal(await page.$eval('dialog textarea',input=>input.value),'Mon message conservé');assert.equal(await page.$eval('dialog input[type=file]',input=>input.files.length),1);assert.equal(await page.evaluate(()=>window.__posts.length),1);
 await page.evaluate(()=>{window.__postMode='ok';});await page.$eval('dialog form',form=>{form.requestSubmit();form.requestSubmit();});await page.waitForFunction(()=>!document.querySelector('dialog'));await page.waitForFunction(()=>document.body.innerText.includes('Preuve envoyée !'));assert.equal(await page.evaluate(()=>window.__posts.length),2);assert.equal(await page.evaluate(()=>window.__posts[0].requestKey===window.__posts[1].requestKey),true);assert.equal(await page.evaluate(()=>window.__posts[1].proofUrl),'');assert.equal(await page.evaluate(()=>window.__proofUrls.every(url=>window.__revokedUrls.includes(url))),true);assert((await body()).includes('Ancienne mission conservée'));assert((await body()).includes('La capture ne montre pas le compte demandé.'));await noOverflow();await shot('submission-history-390');
 await click('Participer1 à compléter');await open('buddy');assert.equal(await page.$eval('dialog textarea',input=>input.value),'Mon pseudo : FleurDuLarge');assert((await body()).includes('Ta capture précédente est conservée'));await click('Renvoyer ma preuve');await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(await page.evaluate(()=>window.__posts.at(-1).submissionId),'proof-buddy');assert.equal(await page.evaluate(()=>window.__posts.at(-1).expectedRevision),'2');assert.equal(await page.evaluate(()=>window.__posts.at(-1).file),undefined);
 await visit('state=error');await page.waitForSelector('[role="alert"]');await page.evaluate(()=>{window.__getMode='ok';});await click('Réessayer');await page.waitForSelector('[data-mission-id="flower"]');await page.evaluate(()=>{window.__getMode='error';});await page.click('[aria-label="Actualiser les missions communautaires"]');await page.waitForSelector('[role="alert"]');assert.equal(await page.$$eval('[data-mission-id]',items=>items.length),4);
 await visit();await page.evaluate(()=>{window.__slowGet=true;window.dispatchEvent(new Event('focus'));window.__missions[0].title='La mission actualisée';window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>document.querySelector('[data-mission-id=flower] h3')?.textContent==='La mission actualisée');await new Promise(resolve=>setTimeout(resolve,500));assert.equal(await page.$eval('[data-mission-id=flower] h3',element=>element.textContent),'La mission actualisée');await visit('state=unauthorized');await page.waitForSelector('a[href^="/compte/connexion"]');await noOverflow();
 await visit('account=1');await page.waitForSelector('[data-mission-id="flower"]');assert((await body()).toLocaleLowerCase('fr').includes('centre de missions'));await click('Choisir mon cadeau');await page.waitForSelector('dialog[open]');await page.keyboard.press('Escape');await click('Mes envois1 en attente');assert((await body()).includes('Ancienne mission conservée'));await noOverflow();await shot('account-history-390');
 await visit();await click('Tous mes défis');await click('Récupérer mon pack');await page.waitForFunction(()=>document.body.innerText.includes('Bravo ! Un pack de 3 cartes gagné.'));assert((await body()).includes('1 pack de mission à ouvrir'));await click('Ouvrir la boutique');assert.equal(await page.evaluate(()=>window.__destinations.at(-1)),'shop');
 assert.deepEqual(errors,[]);const report={results,networkRetryPreservesFieldsAndKey:true,optionalLink:true,privatePreviewRevoked:true,correctionPreservesSubmissionAndRevision:true,inactiveHistoryVisible:true,fetchRecovery:true,accountUsesSharedBoard:true,legacyClaimWorks:true,doubleSubmitGuard:true,lateGetIgnored:true,keyboardFocusWrap:true,errors};await writeFile(resolve(output,'audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser?.close();await server.close();}
