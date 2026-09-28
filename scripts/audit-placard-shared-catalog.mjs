// Real catalogue components; all API calls intercepted and every remote request blocked.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-shared-catalog');
const origin = 'http://127.0.0.1:3244';
const modules = {
  'next/link': `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>;}`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'shared-catalog-entry': `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {KqEquipmentCatalogModal} from '/src/components/placard/KqEquipmentCatalogModal';
    import {KQ_EQUIPMENT_CATALOG,KQ_STARTING_EQUIPMENT_CODES,getKqEquipmentAtLevel,getKqEquipmentDefinition,getKqEquipmentUpgradeCost,isKqProcessingEquipment,formatKqCash} from '/src/lib/kanab-quest-equipment';
    import {getKqCultureEquipmentCondition} from '/src/lib/kanab-quest-culture-wear';
    sessionStorage.setItem('kq:selected-tent','2');
    const starter=[...KQ_STARTING_EQUIPMENT_CODES];
    const sharedEquipment={ownedCodes:[...starter,'WASHER-25L'],purchasedCodes:['WASHER-25L'],equippedCodes:[...starter,'WASHER-25L'],levels:{'WASHER-25L':4},maintenance:{},cultureWear:{},operationalCodes:[...starter,'WASHER-25L']};
    const state={cashCents:10000000,productionUnits:8,sharedEquipment,tents:[]};
    const refreshTents=()=>{const common=state.sharedEquipment,local=code=>!isKqProcessingEquipment(code);state.tents=Array.from({length:8},(_,i)=>({tentNumber:i+1,ownedCodes:common.ownedCodes.filter(local),purchasedCodes:common.purchasedCodes.filter(local),equippedCodes:common.equippedCodes.filter(local),levels:Object.fromEntries(Object.entries(common.levels).filter(([code])=>local(code))),maintenance:{},cultureWear:structuredClone(common.cultureWear),cultureOperationalCodes:common.operationalCodes.filter(local),operationalCodes:common.operationalCodes.filter(local)}));};
    refreshTents();
    window.__state=state; window.__mutations=[]; window.__reads=[]; window.__unexpected=[]; window.__holdUpgrade=false; window.__releaseUpgrade=null; window.__holdReadTent=null; window.__releaseRead=null; window.__holdPurchaseRead=false; window.__rejectHeldRead=false; window.__failNextRead=false;
    window.__meta=Object.fromEntries(KQ_EQUIPMENT_CATALOG.map(item=>[item.code,{name:item.name,price:item.priceCents}]));
    window.__upgradePrice=formatKqCash(getKqEquipmentUpgradeCost('WASHER-25L',4,1));
    const response=payload=>new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}});
    const original=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      const parsed=new URL(String(url),location.origin);
      if(!parsed.pathname.startsWith('/api/'))return original(url,init);
      if(parsed.pathname!=='/api/arena/placard/equipment'){
        window.__unexpected.push(parsed.href);throw new Error('Unexpected API request '+parsed.href);
      }
      const method=init.method||'GET';
      if(method==='GET'){
        const tentNumber=Number(parsed.searchParams.get('tentNumber')||1);window.__reads.push(tentNumber);
        if(window.__failNextRead){window.__failNextRead=false;return new Response(JSON.stringify({error:'Actualisation locale indisponible.'}),{status:503});}
        refreshTents();
        const levels=state.sharedEquipment.levels;
        const payload=structuredClone({...state,...state.sharedEquipment,tentNumber,levels,equipmentPricingUnits:1,reputation:0,routePlan:null,activeRun:false,
          catalog:KQ_EQUIPMENT_CATALOG.filter(item=>item.purchasable).map(item=>getKqEquipmentAtLevel(item.code,levels[item.code]))});
        if(window.__holdReadTent===tentNumber){const rejectHeld=window.__rejectHeldRead;window.__rejectHeldRead=false;window.__holdReadTent=null;await new Promise(resolve=>{window.__releaseRead=resolve;});if(rejectHeld)throw new TypeError('Ancienne connexion locale interrompue.');}
        return response(payload);
      }
      const body=JSON.parse(init.body);window.__mutations.push({method,body});
      if(body.expectedUnits!==8||body.tentNumber!==1)throw new Error('Wrong global equipment target');
      if(method==='PATCH'&&body.action==='upgrade'){
        if(window.__holdUpgrade){window.__holdUpgrade=false;await new Promise(resolve=>{window.__releaseUpgrade=resolve;});}
        if(body.tentNumber!==1||body.equipmentCode!=='WASHER-25L'||body.expectedLevel!==state.sharedEquipment.levels['WASHER-25L'])throw new Error('Invalid shared upgrade target');
        state.cashCents-=getKqEquipmentUpgradeCost(body.equipmentCode,body.expectedLevel,1);
        state.sharedEquipment.levels[body.equipmentCode]++;
        return response({level:state.sharedEquipment.levels[body.equipmentCode]});
      }
      if(method==='POST'){
        const total=body.equipmentCodes.reduce((sum,code)=>sum+getKqEquipmentDefinition(code).priceCents,0);
        for(const code of body.equipmentCodes){
          const target=state.sharedEquipment;
          if(target.ownedCodes.includes(code))throw new Error('Duplicate ownership');
          target.ownedCodes.push(code);target.purchasedCodes.push(code);target.levels[code]=1;
          const wear=getKqCultureEquipmentCondition(code,1,0,0);if(wear)target.cultureWear[code]=wear;
        }
        refreshTents();
        state.cashCents-=total;
        if(window.__holdPurchaseRead){window.__holdPurchaseRead=false;window.__holdReadTent=body.tentNumber;}
        return response({equipmentCodes:body.equipmentCodes,totalPriceCents:total,cashAfterCents:state.cashCents});
      }
      if(method==='PATCH'&&!body.action){
        const common=state.sharedEquipment,definition=getKqEquipmentDefinition(body.equipmentCode);
        if(!definition||!common.purchasedCodes.includes(body.equipmentCode))throw new Error('Installing unowned common equipment');
        common.equippedCodes=common.equippedCodes.filter(code=>getKqEquipmentDefinition(code).slot!==definition.slot).concat(body.equipmentCode);
        common.operationalCodes=[...common.equippedCodes];refreshTents();
        return response({equipped:true});
      }
      window.__unexpected.push(method+' '+parsed.href);throw new Error('Unexpected mutation');
    };
    createRoot(document.getElementById('root')).render(<KqEquipmentCatalogModal initialEquipmentCode="WASHER-25L" onClose={()=>{window.__closed=true;}}/>);
  `,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'shared-catalog-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalogue commun local</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}#root{position:relative;height:100dvh}</style><div id="root"></div><script type="module" src="/@id/__x00__shared-catalog-entry"></script></html>');});}}],
  server:{host:'127.0.0.1',port:3244,strictPort:true,hmr:false,watch:null}});

let browser,page; const errors=[],blocked=[],results=[];
const detail='aside[aria-label^="D\u00e9tails de"]', upgrade='section[aria-label^="Niveau de"]', tentSelector='select[aria-label="Tente à observer"]';
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());if((url.origin===origin&&!url.pathname.startsWith('/api/'))||url.protocol==='data:')void request.continue();else{blocked.push(request.url());void request.abort();}});
  const clickText=async(prefix,scope='')=>{
    const button=await page.evaluateHandle(({prefix,scope})=>[...(scope?document.querySelector(scope):document).querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(prefix)&&!button.disabled),{prefix,scope});
    assert.ok(button.asElement(),'Button '+prefix);await button.asElement().evaluate(el=>el.scrollIntoView({block:'center'}));await button.asElement().click();
  };
  const card=async code=>page.evaluateHandle(code=>[...document.querySelectorAll('main article')].find(article=>article.querySelector('button')?.getAttribute('aria-label')==='Voir '+window.__meta[code].name),code);
  const open=async code=>{const node=(await card(code)).asElement();assert.ok(node,code);const button=await node.$('button');await button.evaluate(el=>el.scrollIntoView({block:'center'}));await button.click();await page.waitForSelector(detail);};
  const closeDetail=async()=>{await page.click('button[aria-label="Fermer la fiche"]');await page.waitForSelector(detail,{hidden:true});};
  const select=async number=>{
    const reads=await page.evaluate(()=>window.__reads.length);
    await page.select(tentSelector,String(number));
    await page.waitForFunction(({selector,number})=>document.querySelector(selector)?.value===String(number),{},{selector:tentSelector,number});
    assert.equal(await page.evaluate(()=>window.__reads.length),reads,'Observing another tent never reloads the global catalogue');
  };
  const checkSharedOwned=async level=>{
    const node=(await card('WASHER-25L')).asElement();
    assert.equal(await node.evaluate(el=>el.dataset.owned),'true');
    assert.equal(await node.$eval('footer button',el=>el.disabled),true);
    assert.equal(await page.$eval(detail,el=>[...el.querySelectorAll('button')].some(button=>button.textContent==='D\u00e9j\u00e0 \u00e9quip\u00e9'&&button.disabled)),true);
    assert.equal(await page.$eval(upgrade+' [role="progressbar"]',el=>Number(el.getAttribute('aria-valuenow'))),level);
  };
  for(const width of [320,390,1440]){
    await page.setViewport({width,height:950,isMobile:width<700,hasTouch:width<700});
    await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector(upgrade+' button');
    assert.equal(await page.$eval(tentSelector,el=>el.value),'2');
    await checkSharedOwned(4);
    const price=await page.evaluate(()=>window.__upgradePrice);
    assert.ok((await page.$eval(upgrade+' button',el=>el.textContent)).includes(price));
    await page.$eval(upgrade+' button',el=>el.scrollIntoView({block:'center'}));await page.click(upgrade+' button');
    await page.waitForFunction(selector=>document.querySelector(selector+' [role="progressbar"]')?.getAttribute('aria-valuenow')==='5',{},upgrade);
    assert.equal(await page.evaluate(()=>window.__mutations.length),1);
    assert.deepEqual(await page.evaluate(()=>{const {tentNumber,expectedUnits,expectedLevel,equipmentCode}=window.__mutations[0].body;return {tentNumber,expectedUnits,expectedLevel,equipmentCode};}),{tentNumber:1,expectedUnits:8,expectedLevel:4,equipmentCode:'WASHER-25L'});
    await page.screenshot({path:resolve(output,`shared-upgrade-${width}.png`)});
    await closeDetail();
    for(const tent of [1,8,2]){await select(tent);await open('WASHER-25L');await checkSharedOwned(5);await closeDetail();}
    const purchaseCodes=['LED-300','DRYING-ROOM','SOLAR-BACKUP','SECURITY-DOG','PRESS-0600'];
    for(const code of purchaseCodes){
      const node=(await card(code)).asElement();assert.ok(node,code);const add=await node.$('footer button');
      assert.equal(await add.evaluate(el=>el.textContent),'Ajouter');await add.evaluate(el=>el.scrollIntoView({block:'center'}));await add.click();
    }
    await select(8);
    await page.click('button[aria-label^="Ouvrir le panier,"]');await clickText('Valider le panier');await page.waitForSelector('[aria-labelledby="checkout-title"]');
    const destination=await page.$$eval('[aria-labelledby="checkout-title"] > div > p > span',els=>els.map(el=>el.textContent));
    const names=await page.evaluate(()=>window.__meta);
    for(const code of purchaseCodes)assert.ok(destination.some(text=>text.toLocaleLowerCase('fr').includes(names[code].name.toLocaleLowerCase('fr')+' · toutes les tentes')),code+' bought once for all tents');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.screenshot({path:resolve(output,`global-checkout-${width}.png`)});
    if(width===1440)await page.evaluate(()=>{window.__holdPurchaseRead=true;});
    await clickText('Confirmer l');await page.waitForSelector('[aria-labelledby="equipment-purchase-title"]');
    const purchases=await page.evaluate(()=>window.__mutations.filter(call=>call.method==='POST'));
    assert.equal(purchases.length,1);assert.equal(purchases[0].body.tentNumber,1);assert.equal(purchases[0].body.expectedUnits,8);
    assert.deepEqual(purchases[0].body.equipmentCodes,purchaseCodes);
    assert.equal(await page.evaluate(codes=>codes.every(code=>window.__state.sharedEquipment.purchasedCodes.filter(owned=>owned===code).length===1),purchaseCodes),true,'Each item has one global acquisition');
    assert.equal(await page.evaluate(()=>window.__state.tents.every(tent=>['LED-300','DRYING-ROOM','SOLAR-BACKUP','SECURITY-DOG'].every(code=>tent.ownedCodes.includes(code)))),true,'Every physical tent inherits non-processing acquisitions');
    assert.equal(await page.evaluate(()=>window.__state.tents.some(tent=>tent.ownedCodes.includes('PRESS-0600'))),false,'Processing remains one common workshop');
    await clickText('Continuer les achats');
    if(width===1440){
      await page.waitForFunction(()=>window.__releaseRead!==null);
      await page.evaluate(()=>window.__releaseRead());
      await page.waitForFunction(selector=>!document.querySelector(selector)?.disabled,{},tentSelector);
    }
    for(const number of [1,2,8]){
      await select(number);
      for(const code of purchaseCodes){
        const owned=(await card(code)).asElement();
        assert.equal(await owned.evaluate(el=>el.dataset.owned),'true',code+' remains owned from tent '+number);
        assert.notEqual(await owned.$eval('footer button',el=>el.textContent),'Ajouter',code+' cannot be bought again');
      }
    }
    for(const code of purchaseCodes){
      const owned=(await card(code)).asElement(),install=await owned.$('footer button');
      assert.equal(await install.evaluate(el=>el.textContent),'Équiper',code+' is owned and available for one global installation');
      await install.evaluate(el=>el.scrollIntoView({block:'center'}));await install.click();
      await page.waitForFunction(code=>document.querySelector('main article button[aria-label="Voir '+window.__meta[code].name+'"]')?.closest('article')?.querySelector('footer button')?.textContent==='Équipé',{},code);
    }
    await select(1);
    for(const code of purchaseCodes)assert.equal(await(await card(code)).asElement().$eval('footer button',el=>el.textContent),'Équipé',code+' installation applies to all tents');
    assert.deepEqual(await page.evaluate(()=>window.__unexpected),[]);
    results.push({width,initialTent:2,allOwnershipShared:true,unitUpgradePrice:price,upgradeTarget:1,checkedTents:[1,8,2],globalDestinations:destination,purchaseCodes,purchaseCount:1,cartSurvivesTentSelection:true});
  }
  // An older GET cannot roll back the global inventory after a newer refresh.
  await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector(upgrade+' button');await closeDetail();
  await page.evaluate(()=>{window.__holdReadTent=1;window.dispatchEvent(new Event('kq:equipment-updated'));});
  await page.waitForFunction(()=>window.__releaseRead!==null);await select(8);
  await page.evaluate(()=>{const common=window.__state.sharedEquipment;common.ownedCodes.push('LED-300');common.purchasedCodes.push('LED-300');common.levels['LED-300']=6;window.dispatchEvent(new Event('kq:equipment-updated'));});
  await page.waitForFunction(()=>document.querySelector('main article button[aria-label="Voir '+window.__meta['LED-300'].name+'"]')?.closest('article')?.dataset.owned==='true');
  await page.evaluate(()=>window.__releaseRead());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.$eval(tentSelector,el=>el.value),'8');
  assert.equal(await(await card('WASHER-25L')).asElement().evaluate(el=>el.dataset.owned),'true');
  assert.equal(await(await card('LED-300')).asElement().evaluate(el=>el.dataset.owned),'true','Late GET cannot discard a new common acquisition');
  // A rejected old connection cannot overwrite the outcome of a newer GET.
  await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector(upgrade+' button');await closeDetail();
  await page.evaluate(()=>{window.__holdReadTent=1;window.__rejectHeldRead=true;window.dispatchEvent(new Event('kq:equipment-updated'));});
  await page.waitForFunction(()=>window.__releaseRead!==null);
  await page.evaluate(()=>{const common=window.__state.sharedEquipment;common.ownedCodes.push('LED-300');common.purchasedCodes.push('LED-300');common.levels['LED-300']=6;window.dispatchEvent(new Event('kq:equipment-updated'));});
  await page.waitForFunction(()=>document.querySelector('main article button[aria-label="Voir '+window.__meta['LED-300'].name+'"]')?.closest('article')?.dataset.owned==='true');
  await page.evaluate(()=>window.__releaseRead());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.$('[role="alert"]'),null,'An obsolete rejected GET does not publish an error over a fresh successful inventory');
  await page.evaluate(()=>{window.__failNextRead=true;window.dispatchEvent(new Event('kq:equipment-updated'));});
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="alert"]')].some(el=>el.textContent.includes('Actualisation locale indisponible.')));
  await page.evaluate(()=>window.dispatchEvent(new Event('kq:equipment-updated')));
  await page.waitForSelector('[role="alert"]',{hidden:true});
  // A shared upgrade must not return the player to the previously selected tent.
  await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector(upgrade+' button');
  await page.evaluate(()=>{window.__holdUpgrade=true;});
  await page.$eval(upgrade+' button',el=>el.scrollIntoView({block:'center'}));await page.click(upgrade+' button');
  await page.waitForFunction(()=>window.__releaseUpgrade!==null);
  await closeDetail();await select(8);
  await page.evaluate(()=>window.__releaseUpgrade());
  await page.waitForFunction(()=>window.__state.sharedEquipment.levels['WASHER-25L']===5);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.$eval(tentSelector,el=>el.value),'8','Late shared upgrade must keep the newly selected tent');
  assert.ok((await card('WASHER-25L')).asElement(),'Late upgrade must leave the selected catalogue populated');
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,lateUpgradeKeepsSelection:true,staleReadIgnored:true,staleRejectedReadIgnored:true,successfulRefreshClearsError:true,purchaseRefreshGlobal:true,allEquipmentBoughtOnce:true,errors,blocked},null,2));
  console.log(JSON.stringify({passed:true,viewports:results.map(result=>result.width),output}));
}catch(error){await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});await writeFile(resolve(output,'failure.json'),JSON.stringify({error:error.message,errors,blocked,results},null,2));throw error;}
finally{await browser?.close();await server.close();}
