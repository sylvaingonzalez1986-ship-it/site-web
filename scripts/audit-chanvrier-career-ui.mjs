// Real warehouse and catalog components with isolated API fixtures. No account or remote API.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/chanvrier-rework/ui');
const port = 3267;
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'next/navigation': `export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);`,
  'next/link': `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'career-audit': `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import '/src/app/globals.css';
    import { KqWarehouseEntry } from '/src/components/placard/KqWarehouseEntry';
    import { KqEquipmentCatalogModal } from '/src/components/placard/KqEquipmentCatalogModal';
    import { KqCareerProgress } from '/src/components/placard/KqCareerProgress';
    import { KqEnergyPanel } from '/src/components/placard/KqEnergyPanel';
    import { createKqTutorialApi, KqTutorialApiProvider } from '/src/components/placard/KqTutorialApiContext';
    import { createKqOperationsLesson, applyKqOperationsRequest, getKqOperationsEquipment } from '/src/lib/kanab-quest-operations-lesson';
    import { createChanvrierCareerSnapshot } from '/src/lib/chanvrier-career';
    import { getChanvrierAppearance } from '/src/lib/arena-chanvrier';
    import { KQ_EQUIPMENT_CATALOG, getKqEquipmentDefinition, getKqEquipmentUpgradeCost, isKqSharedEquipment } from '/src/lib/kanab-quest-equipment';
    import { getKqProductionExpansion } from '/src/lib/kanab-quest-production';
    import { getKqMachineCondition } from '/src/lib/kanab-quest-maintenance';
    const query = new URLSearchParams(location.search);
    window.__profile={nickname:'Lou.Chanvre',gender:'female',clothing:'teal',skin:'honey',strength:'green-thumb',appearance:{...getChanvrierAppearance({gender:'female'}),hair:'braids',hairColor:'black',eyes:'round',eyeColor:'green',accessory:'glasses'}};
    if(query.has('buildings')){
      let lesson=createKqOperationsLesson('warehouse');lesson.trial.commerce.cashCents=10000000;
      const apply=(body,method='PATCH')=>{lesson=applyKqOperationsRequest(lesson,{path:'/api/arena/placard/equipment',method,body}).state;};
      while(lesson.tents.length<6){const quote=getKqProductionExpansion(lesson.tents.length);apply({action:'expand-production',expectedUnits:lesson.tents.length,expectedCostCents:quote.totalCostCents});}
      apply({tentNumber:1,equipmentCodes:['SECURITY-CAMERA','SOLAR-BACKUP']},'POST');
      apply({tentNumber:6,equipmentCodes:['SECURITY-CAMERA','DRYING-ROOM']},'POST');
      apply({tentNumber:1,equipmentCode:'SECURITY-CAMERA'});apply({tentNumber:1,equipmentCode:'SOLAR-BACKUP'});apply({tentNumber:6,equipmentCode:'SECURITY-CAMERA'});
      window.__lesson=lesson;window.__lessonSnapshot=tent=>getKqOperationsEquipment(window.__lesson,tent);
    }
    const starter = ['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];
    const purchased = query.has('owned') ? ['PRESS-0600'] : query.has('legacyservice') ? ['DRYING-ROOM'] : [];
    sessionStorage.setItem('kq:selected-tent','1');
    window.__state = {career:createChanvrierCareerSnapshot({xp:Number(query.get('xp')||0),completedCultures:Number(query.get('cultures')||0),processingPractice:{washing:Number(query.get('washing')||0)}}),productionUnits:Number(query.get('units')||1),cashCents:3000000,levels:{'PRESS-0600':3},ownedCodes:[...starter,...purchased],purchasedCodes:purchased,equippedCodes:[...starter],cycles:2,version:1};
    window.__requests = [];
    window.__reads = [];
    window.__names = Object.fromEntries(KQ_EQUIPMENT_CATALOG.map(item=>[item.code,item.name]));
    const snapshot = () => {
      const s=window.__state;
      const sharedEquipment={ownedCodes:s.ownedCodes.filter(isKqSharedEquipment),purchasedCodes:s.purchasedCodes.filter(isKqSharedEquipment),equippedCodes:s.equippedCodes.filter(isKqSharedEquipment),levels:s.levels,maintenance:{'PRESS-0600':getKqMachineCondition('PRESS-0600',s.levels['PRESS-0600'],s.cycles,s.version)}};
      const tents=Array.from({length:s.productionUnits},(_,index)=>({tentNumber:index+1,ownedCodes:[...starter,...s.ownedCodes.filter(code=>!isKqSharedEquipment(code)&&!starter.includes(code))],purchasedCodes:s.purchasedCodes.filter(code=>!isKqSharedEquipment(code)),equippedCodes:s.equippedCodes.filter(code=>!isKqSharedEquipment(code)),levels:s.levels,cultureWear:{}}));
      return {...s,chanvrierProfile:query.has('missingprofile')||query.has('tutorial')?null:window.__profile,equipmentScopeVersion:2,buildings:[],tentNumber:1,tents,sharedEquipment,catalog:KQ_EQUIPMENT_CATALOG,routePlan:null,reputation:0,cultureWear:{},maintenance:sharedEquipment.maintenance,storageCapacity:{freeUnits:1000,totalUnits:1500},expansionEnergyCents:414,production:getKqProductionExpansion(s.productionUnits)};
    };
    const original=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return original(url,init);
      if(!init.method||init.method==='GET')window.__reads.push(String(url));
      if(query.has('buildings')){
        const body=init.body?JSON.parse(init.body):{};
        if(init.method&&init.method!=='GET')window.__requests.push(body);
        try{const result=applyKqOperationsRequest(window.__lesson,{path:String(url),method:init.method||'GET',body});window.__lesson=result.state;const payload=(!init.method||init.method==='GET')&&String(url).startsWith('/api/arena/placard/equipment')?{...result.payload,chanvrierProfile:query.has('missingprofile')||query.has('tutorial')?null:window.__profile}:result.payload;return new Response(JSON.stringify(payload));}
        catch(error){return new Response(JSON.stringify({error:error.message}),{status:400});}
      }
      if(!String(url).startsWith('/api/arena/placard/equipment'))throw new Error('Unexpected fixture request: '+url);
      if(!init.method||init.method==='GET')return new Response(JSON.stringify(snapshot()));
      const body=JSON.parse(init.body);window.__requests.push(body);const s=window.__state;
      if(init.method==='POST'){
        const total=body.equipmentCodes.reduce((sum,code)=>sum+getKqEquipmentDefinition(code).priceCents,0);
        s.cashCents-=total;s.ownedCodes.push(...body.equipmentCodes);s.purchasedCodes.push(...body.equipmentCodes);
        return new Response(JSON.stringify({equipmentCodes:body.equipmentCodes,totalPriceCents:total,cashAfterCents:s.cashCents}));
      }
      if(body.action==='expand-production'){
        const quote=getKqProductionExpansion(s.productionUnits);s.cashCents-=quote.totalCostCents;s.productionUnits=quote.nextUnits;
      }else if(body.action==='upgrade'){
        const level=s.levels[body.equipmentCode]||1;s.cashCents-=getKqEquipmentUpgradeCost(body.equipmentCode,level);s.levels[body.equipmentCode]=level+1;
        return new Response(JSON.stringify({level:level+1}));
      }else if(body.action==='repair'){
        s.cashCents-=body.expectedCostCents;s.cycles=0;s.version++;
      }else if(body.equipmentCode){
        const slot=getKqEquipmentDefinition(body.equipmentCode).slot;
        s.equippedCodes=s.equippedCodes.filter(code=>getKqEquipmentDefinition(code).slot!==slot).concat(body.equipmentCode);
      }
      return new Response(JSON.stringify({ok:true}));
    };
    const view=${process.argv.includes('--career-only')} ? <KqCareerProgress career={window.__state.career} profile={query.has('missingprofile')||query.has('tutorial')?null:window.__profile}/> : query.get('view')==='energy'
      ? <KqEnergyPanel selectedMode='balanced' onModeChange={()=>{}} /> : query.get('view')==='catalog'
      ? <KqEquipmentCatalogModal onClose={()=>{}} />
      : <KqWarehouseEntry initialEquipmentCode={query.get('equipment')} onClose={()=>{}} onOpenShop={()=>{}} />;
    createRoot(document.getElementById('root')).render(query.has('tutorial')?<KqTutorialApiProvider api={createKqTutorialApi(window.fetch)}>{view}</KqTutorialApiProvider>:view);
  `,
};
const server = await createServer({
  root, configFile:false, envDir:false, cacheDir:resolve(output,'vite-cache'), publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom/client','lucide-react']},
  resolve:{alias:{'@':resolve(root,'src')}}, css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'career-ui-audit',enforce:'pre',
    resolveId(id){if(id in modules)return '\0'+id;if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';},
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit local Chanvrier</title><style>@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:AuditBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}body{margin:0;background:#fff1d6}</style><div id="root"></div><script type="module" src="/@id/__x00__career-audit"></script></html>');
    });},
  }], server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});
let browser;
const errors=[], checks=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>void(request.url().startsWith(origin)||request.url().startsWith('data:')?request.continue():request.abort()));
  const visit=async query=>{await page.goto(`${origin}/?${query}`,{waitUntil:'networkidle0'});if(query.includes('view=energy'))await page.waitForSelector('[aria-label="Électricité par bâtiment"]');else await page.waitForFunction(tutorial=>document.querySelector('[data-career-progress]')?.textContent.includes(tutorial?'XP de démonstration':'XP permanents'),{},query.includes('tutorial'));};
  const card=async code=>page.evaluateHandle(code=>[...document.querySelectorAll('article')].find(article=>article.querySelector('button[aria-label="Voir '+window.__names[code]+'"]')),code);
  const click=async prefix=>{const button=await page.evaluateHandle(prefix=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(prefix)&&button.getClientRects().length),prefix);assert.ok(button.asElement(),prefix);await button.asElement().click();};
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const portraitReady=async()=>page.waitForSelector('[data-career-progress] canvas[data-avatar-state="ready"]');
  const updatePortrait=async()=>{
    await portraitReady();
    const before=await page.$eval('[data-career-progress] canvas',el=>el.toDataURL());
    const readCount=await page.evaluate(()=>window.__reads.length);
    await page.evaluate(()=>{
      window.__profile={...window.__profile,nickname:'Lou.Atelier',skin:'ebony',appearance:{...window.__profile.appearance,hair:'afro',hairColor:'ginger',accessory:'none'}};
      window.dispatchEvent(new CustomEvent('kq:equipment-updated'));
      window.dispatchEvent(new CustomEvent('arena:profile-updated',{detail:window.__profile}));
    });
    await page.waitForFunction(()=>document.querySelector('[data-career-progress]')?.textContent.includes('Lou.Atelier'));
    await portraitReady();
    assert.notEqual(await page.$eval('[data-career-progress] canvas',el=>el.toDataURL()),before);
    assert.equal(await page.evaluate(()=>window.__reads.length),readCount+1);
    assert.equal(await page.evaluate(()=>window.__reads.some(url=>url.startsWith('/api/arena/chanvrier'))),false);
  };
  for(const width of [320,390,1440]){
    await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});
    if(!process.argv.includes('--career-only')){
    await visit('view=catalog');await noOverflow();
    await portraitReady();assert.match(await page.$eval('[data-career-progress]',el=>el.textContent),/Lou.Chanvre/);
    await updatePortrait();checks.push(`catalog-custom-portrait-refresh-${width}`);
    const locked=await card('LED-300');assert.equal(await locked.evaluate(el=>el.querySelector('footer button').disabled),true);
    assert.match(await locked.evaluate(el=>el.textContent),/Niveau métier 2 requis/);
    const starterBuy=await card('SECURITY-CAMERA');assert.equal(await starterBuy.evaluate(el=>el.querySelector('footer button').disabled),false);
    assert.equal(await page.evaluate(()=>window.__requests.length),0);
    await page.screenshot({path:resolve(output,`catalog-novice-${width}.png`)});checks.push(`novice-gates-${width}`);

    await visit('view=catalog&xp=4500&washing=0');
    const advanced=await card('AUTO-SIEVE');assert.equal(await advanced.evaluate(el=>el.querySelector('footer button').disabled),true);
    assert.match(await advanced.evaluate(el=>el.textContent),/0\/3 lots transformés/);checks.push(`practice-gate-${width}`);
    await visit('view=catalog&xp=4500&washing=6');
    assert.equal(await (await card('AUTO-SIEVE')).evaluate(el=>el.querySelector('footer button').disabled),false);
    checks.push(`practice-unlocked-${width}`);

    await visit('view=catalog&owned');const owned=await card('PRESS-0600');
    assert.equal(await owned.evaluate(el=>el.querySelector('footer button').disabled),false);
    await owned.evaluate(el=>el.querySelector('footer button').click());await page.waitForFunction(()=>window.__state.equippedCodes.includes('PRESS-0600'));
    checks.push(`legacy-install-${width}`);

    await visit('owned&equipment=PRESS-0600');
    await updatePortrait();checks.push(`warehouse-custom-portrait-refresh-${width}`);
    const upgrade=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Niveau 4')));
    assert.equal(await upgrade.evaluate(el=>el.disabled),true);
    await click('Entretenir');await page.waitForFunction(()=>window.__state.cycles===0);
    assert.equal(await page.evaluate(()=>window.__requests[0].action),'repair');checks.push(`preventive-service-${width}`);
    await page.screenshot({path:resolve(output,`warehouse-novice-${width}.png`)});

    await visit('owned&equipment=PRESS-0600&xp=4500');await click('Niveau 4');
    await page.waitForFunction(()=>window.__state.levels['PRESS-0600']===4);checks.push(`machine-configuration-${width}`);

    await visit('units=4&xp=4500');await page.$eval('[data-production-capacity]',el=>{el.open=true;el.scrollIntoView({block:'start'});});
    assert.match(await page.$eval('[data-production-capacity]',el=>el.textContent),/100 g sur 150 g/);
    await noOverflow();await page.screenshot({path:resolve(output,`expansion-five-${width}.png`)});
    await click('Ouvrir le second entrepôt');await page.waitForFunction(()=>window.__state.productionUnits===5);
    assert.equal(await page.evaluate(()=>window.__requests[0].expectedCostCents),2030000);
    checks.push(`warehouse-five-${width}`);

    await visit('buildings&equipment=DRYING-ROOM');
    assert.equal(await page.$$eval('[data-warehouse-slot="security"][data-warehouse-scope="building"]',els=>els.length),2);
    assert.equal(await page.$$eval('[data-warehouse-slot="flower-drying"][data-installed="true"]',els=>els.length),1);
    assert.equal(await page.$$eval('[data-recap-slot="flower-drying"]',els=>els.length),0);
    assert.equal(await page.$$eval('[data-building-recap-slot="flower-drying"]',els=>els.length),2);
    await noOverflow();await page.screenshot({path:resolve(output,`building-services-${width}.png`)});
    await page.$eval('[data-warehouse-slot="tent"][data-tent-number="6"]',el=>el.click());
    await page.waitForFunction(()=>document.querySelector('#warehouse-slot-title')?.previousElementSibling?.textContent.includes('Tente 6'));
    await click('Vue liste');
    await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.querySelector('span')?.textContent==='Pièce séchoir');button?.click();});
    await page.waitForFunction(()=>document.querySelector('#warehouse-slot-title')?.previousElementSibling?.textContent.includes('Entrepôt 2'));
    await click('Installer · entrepôt 2');
    await page.waitForFunction(()=>window.__lesson.buildings[1].equippedCodes.includes('DRYING-ROOM'));
    assert.equal(await page.evaluate(()=>window.__requests.at(-1).tentNumber),6);
    await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(el=>el.textContent==='Installation…'));
    await click('Niveau 2');await page.waitForFunction(()=>window.__lesson.buildings[1].levels['DRYING-ROOM']===2);
    assert.equal(await page.evaluate(()=>window.__lesson.buildings[0].levels['DRYING-ROOM']),1);
    await page.select('select[aria-label="Tente à équiper"]','5');
    await page.waitForFunction(()=>document.querySelector('select[aria-label="Tente à équiper"]')?.value==='5' && document.querySelector('#warehouse-slot-title')?.previousElementSibling?.textContent.includes('Entrepôt 2'));
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.querySelector('span')?.textContent==='Pièce séchoir')?.click());
    await page.waitForFunction(()=>document.querySelector('section[aria-label^="Niveau de"]')?.textContent.includes('NIV. 2'));
    checks.push(`building-service-install-upgrade-${width}`);

    await visit('buildings&view=catalog');
    const dog=await card('SECURITY-DOG');await dog.evaluate(el=>el.querySelector('footer button').click());
    await page.select('select[aria-label="Tente à équiper"]','2');
    await page.waitForFunction(()=>document.querySelector('select[aria-label="Tente à équiper"]').value==='2'&&!document.querySelector('select[aria-label="Tente à équiper"]').disabled);
    assert.match(await (await card('SECURITY-DOG')).evaluate(el=>el.textContent),/Au panier/);
    await page.select('select[aria-label="Tente à équiper"]','6');
    await page.waitForFunction(()=>document.querySelector('select[aria-label="Tente à équiper"]').value==='6'&&!document.querySelector('select[aria-label="Tente à équiper"]').disabled);
    assert.doesNotMatch(await (await card('SECURITY-DOG')).evaluate(el=>el.textContent),/Au panier/);
    assert.match(await (await card('SECURITY-DOG')).evaluate(el=>el.textContent),/Entrepôt 2/);
    await page.select('select[aria-label="Tente à équiper"]','1');
    await page.waitForFunction(()=>document.querySelector('select[aria-label="Tente à équiper"]').value==='1'&&!document.querySelector('select[aria-label="Tente à équiper"]').disabled);
    assert.match(await (await card('SECURITY-DOG')).evaluate(el=>el.textContent),/Au panier/);
    checks.push(`building-cart-destinations-${width}`);

    await visit('buildings&view=energy');
    await page.evaluate(()=>{for(const el of document.querySelectorAll('details'))el.open=true;});
    assert.equal(await page.$$eval('[aria-label="Usure prévue du matériel"] progress',els=>els.filter(el=>el.getAttribute('aria-label').includes(window.__names['DRYING-ROOM'])).length),1);
    assert.match(await page.$eval('[aria-label="Électricité par bâtiment"]',el=>el.textContent),/Séchoir et sécurité comptés une fois/);
    await noOverflow();await page.screenshot({path:resolve(output,`building-energy-${width}.png`)});checks.push(`building-energy-wear-${width}`);

    await visit('legacyservice&equipment=DRYING-ROOM&xp=4500');
    assert.equal(await page.$$eval('[data-building-recap]',els=>els.length),0);
    await click('Installer · tente 1');await page.waitForFunction(()=>window.__state.equippedCodes.includes('DRYING-ROOM'));
    assert.equal(await page.evaluate(()=>window.__requests[0].tentNumber),1);checks.push(`legacy-service-per-tent-${width}`);

    }
    await visit('view=catalog&xp=250&washing=2&cultures=3');await portraitReady();
    const career=await page.$eval('[data-career-progress]',el=>el.textContent);
    assert.match(career,/Niveau 2/);assert.match(career,/50 \/ 200 XP/);assert.match(career,/encore 150 XP/);
    assert.equal(await page.$eval('[data-career-progress] progress',el=>el.value),25);
    await page.screenshot({path:resolve(output,`career-personalized-collapsed-${width}.png`)});
    await page.$eval('[data-career-details] > summary',el=>el.click());
    assert.equal(await page.$$eval('[data-career-details] ol > li',els=>els.length),10);
    assert.match(await page.$eval('[data-career-details]',el=>el.textContent),/\+100 XP métier par culture terminée/);
    assert.match(await page.$eval('[data-career-details]',el=>el.textContent),/Les transformations ne donnent pas d’XP métier/);
    assert.match(await page.$eval('[data-career-details]',el=>el.textContent),/2 \/ 3 lots de lavage/);
    await noOverflow();await page.screenshot({path:resolve(output,`career-personalized-details-${width}.png`)});
    await page.focus('[data-career-details] > summary');await page.keyboard.press('Enter');
    assert.equal(await page.$eval('[data-career-details]',el=>el.open),false);
    await page.keyboard.press('Space');assert.equal(await page.$eval('[data-career-details]',el=>el.open),true);
    if(width===320){
      await page.setViewport({width,height:640,isMobile:true,hasTouch:true});await noOverflow();
      const detail=await page.$eval('[data-career-details] > div',el=>({height:el.clientHeight,scrollHeight:el.scrollHeight,width:el.clientWidth,scrollWidth:el.scrollWidth}));
      assert.ok(detail.height>0&&detail.height<=226);assert.ok(detail.scrollHeight>detail.height);assert.ok(detail.scrollWidth<=detail.width+1);
      await page.screenshot({path:resolve(output,'career-details-small-screen-320x640.png')});
      await page.$eval('[data-career-details] > div',el=>{el.scrollTop=el.scrollHeight;});
      assert.ok(await page.$eval('[data-career-details] > div',el=>el.scrollTop>0));
      await page.focus('[data-career-details] > summary');await page.keyboard.press('Enter');
      assert.equal(await page.$eval('[data-career-details]',el=>el.open),false);
      await page.setViewport({width,height:1000,isMobile:true,hasTouch:true});
    }
    checks.push(`career-level-details-${width}`);

    await visit('view=catalog&missingprofile');
    assert.equal(await page.$$eval('[data-career-portrait] canvas',els=>els.length),0);
    assert.equal(await page.$$eval('[data-career-portrait] [aria-label="Portrait indisponible"]',els=>els.length),1);
    await visit('buildings&tutorial');
    assert.equal(await page.$$eval('[data-career-portrait] canvas',els=>els.length),0);
    assert.match(await page.$eval('[data-career-progress]',el=>el.textContent),/Chanvrier d’essai/);
    assert.match(await page.$eval('[data-career-progress]',el=>el.textContent),/Niveau prêté pour cet exercice/);
    assert.equal(await page.evaluate(()=>window.__reads.some(url=>url.startsWith('/api/arena/chanvrier'))),false);
    checks.push(`career-missing-and-tutorial-profile-${width}`);
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks:checks.length,errors,output}));
}catch(error){const page=(await browser?.pages())?.at(-1);if(page){await page.screenshot({path:resolve(output,'failure.png')});await writeFile(resolve(output,'failure.html'),await page.content());}console.error(JSON.stringify({checks,errors,error:error.message}));throw error;}
finally{await browser?.close();await server.close();}
