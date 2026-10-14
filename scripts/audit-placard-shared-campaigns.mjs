// Real React and game-domain interactions; all API responses are browser-local fixtures.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-shared-campaigns');
const port = Number(process.env.KQ_SHARED_CAMPAIGN_AUDIT_PORT ?? 3273), origin = `http://127.0.0.1:${port}`;
const modules = {
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);`,
  'shared-campaign-entry': `
    import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
    import {startKqGame,rollKqDice,resolveKqStage,advanceKqStage,KQ_BUDDIES} from '/src/lib/kanab-quest-game';
    import {createKqFlower} from '/src/lib/kanab-quest-battle';
    import {createKqWarehouseStarter,getKqWarehouseQuote} from '/src/lib/kanab-quest-warehouse';
    import {quoteKqWarehouseEnergy} from '/src/lib/kanab-quest-warehouse-run';
    import {getKqCampaignParticipants,getKqCampaignTotals,getKqCampaignWarehouse,getKqCampaignMemberState} from '/src/lib/kanab-quest-campaign';
    const initial=createKqWarehouseStarter();
    const layout=getKqWarehouseQuote({...initial,zones:['a','b'].map((id,i)=>({...initial.zones[0],id,name:['Chambre Expression','Chambre Rendement'][i],x:10+i*3,y:10,width:1,height:1,buddieCode:'HH2026-00'+(i+3)}))}).nextState;
    const members=getKqCampaignParticipants(layout,1).map((member,i)=>({...member,runId:i===0?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222'}));
    const campaign={version:1,id:'33333333-3333-4333-8333-333333333333',leaderRunId:members[0].runId,members};
    window.__fixture=JSON.parse(sessionStorage.getItem('campaign-audit-state')??'null')??{runs:[],flowers:[],receipts:{},starts:[],actions:[],created:0};
    window.__campaign=campaign;window.__totals=getKqCampaignTotals(members);window.__requests=[];window.__loseStart=false;
    const persist=()=>sessionStorage.setItem('campaign-audit-state',JSON.stringify(window.__fixture));
    const active=()=>window.__fixture.runs.filter(run=>run.state.phase!=='complete');
    const session=()=>({activeRun:active()[0]??null,activeRuns:active(),flowers:window.__fixture.flowers,battles:[],progress:null,buddieRotation:{requiredDistinctBuddies:5,recentBuddieCodes:[]}});
    const original=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const href=String(input);if(!href.startsWith('/api/'))return original(input,init);
      const url=new URL(href,location.origin),method=init.method??'GET';window.__requests.push({path:url.pathname,query:url.search,method});
      if(url.pathname.endsWith('/bootstrap'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory:{'BOTTE-017':1},availableInventory:{'BOTTE-017':1},cultureTokenBalance:0},ownedBuddieCodes:KQ_BUDDIES.slice(0,4).map(b=>b.code),ownedBuddies:[],heritage:{cards:[]},playerSession:session(),buddieRotation:session().buddieRotation});
      if(url.pathname.endsWith('/session'))return Response.json(session());
      if(url.pathname.endsWith('/rankings'))return Response.json({entries:[]});
      if(url.pathname.endsWith('/me'))return Response.json({progress:null});
      if(url.pathname.endsWith('/warehouse'))return Response.json({state:layout,revision:1,cashCents:1500000});
      if(url.pathname.endsWith('/care'))return Response.json({cashCents:1500000,basicCarePriceCents:200,inventory:[],catalog:[]});
      if(url.pathname.endsWith('/flowers'))return Response.json({flowers:window.__fixture.flowers});
      if(url.pathname.endsWith('/battles'))return Response.json({battles:[]});
      if(url.pathname.endsWith('/energy')){
        const warehouse=getKqCampaignWarehouse(members),quote=quoteKqWarehouseEnergy(warehouse);
        return Response.json({warehouse,quotes:{eco:quote,balanced:quote,intensive:quote},cashCents:1500000,outstandingCents:0,invoiceCount:0,invoices:[],supplierInvoice:null,supplierInvoices:window.__fixture.runs.map(run=>({runId:run.runId,zoneId:run.zoneId,totalCents:run.state.warehouse.consumablesCostCents,remainingCents:run.state.warehouse.consumablesCostCents,dueAt:'2026-10-18T12:00:00Z'}))});
      }
      if(url.pathname.endsWith('/runs')&&method==='GET'){
        const runId=url.searchParams.get('runId'),zoneId=url.searchParams.get('zoneId');
        const selected=runId?window.__fixture.runs.find(run=>run.runId===runId):zoneId?active().find(run=>run.zoneId===zoneId):active()[0];
        return Response.json({activeRun:selected??null,activeRuns:active()});
      }
      if(url.pathname.endsWith('/runs')&&method==='POST'){
        const body=JSON.parse(init.body);window.__fixture.starts.push(body);
        if(window.__fixture.receipts[body.requestKey]){persist();return Response.json({...window.__fixture.receipts[body.requestKey],replayed:true});}
        if(body.campaign!==true||body.zoneId||body.buddieCode!==members[0].buddieCode)return Response.json({error:'Contrat campagne incorrect.'},{status:400});
        const leader={...startKqGame(94,{varietyCode:members[0].buddieCode,deckCodes:body.deckCodes,warehouse:members[0].warehouse,cultivationProfile:members[0].cultivationProfile,startedAt:'2026-10-13T12:00:00Z'}),campaign};
        window.__fixture.runs=members.map(member=>({runId:member.runId,zoneId:member.zoneId,buddieCode:member.buddieCode,startedAt:'2026-10-13T12:00:00Z',updatedAt:'2026-10-13T12:00:00Z',burnReceipts:[],state:getKqCampaignMemberState(leader,member)}));window.__fixture.created++;
        const receipt={runId:campaign.leaderRunId,state:leader,burnReceipt:null,freeSubstrate:true,cultureTokenBalance:0,buddieRotation:session().buddieRotation};
        window.__fixture.receipts[body.requestKey]=receipt;persist();
        if(window.__loseStart){window.__loseStart=false;throw new TypeError('Réponse perdue après validation. Réessaie.');}
        return Response.json(receipt);
      }
      if(url.pathname.endsWith('/actions')){
        const body=JSON.parse(init.body);window.__fixture.actions.push({path:url.pathname,...body});
        if(!url.pathname.includes(campaign.leaderRunId))return Response.json({error:'Action hors leader.'},{status:409});
        const leader=window.__fixture.runs[0];
        const next=body.action==='roll'?{...rollKqDice(leader.state),dice:[6,6,6]}:body.action==='resolve'?resolveKqStage(leader.state):advanceKqStage(leader.state);
        window.__fixture.runs=members.map((member,i)=>({...window.__fixture.runs[i],state:getKqCampaignMemberState(next,member)}));
        if(next.phase==='complete'&&!next.cultureDead)window.__fixture.flowers=window.__fixture.runs.map(run=>{const flower=createKqFlower(run.state);return {...flower,id:'official-'+run.zoneId,runId:run.runId,varietyCode:run.buddieCode,varietyName:run.state.varietyName,quality:run.state.quality,combos:run.state.combos,queuedAt:null,lockedAt:null,burnedAt:null};});
        persist();return Response.json({state:window.__fixture.runs[0].state,persistedFlower:null,persistedFlowers:window.__fixture.flowers});
      }
      throw new Error('Unexpected fixture request '+method+' '+href);
    };
    localStorage.setItem('kq-dice-direct-result','1');
    function Fixture(){const [selection,setSelection]=React.useState(()=>({runId:new URLSearchParams(location.search).get('run')??undefined,campaign:true}));
      window.__select=next=>{const params=new URLSearchParams({campaign:'1'});if(next.runId)params.set('run',next.runId);history.replaceState(null,'','/?'+params);setSelection({...next,campaign:true});};
      return <KanabQuestDicePrototype apiScope="player" showAdminOperations={false} viewMode="game" initialCampaign initialRunId={selection.runId} onOpenRun={window.__select} onOpenWarehouse={()=>{window.__back=true;}}/>;}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `,
};
const fontCss = `@font-face{font-family:'Warehouse Display';src:url('/src/app/fonts/BarlowCondensed-Latin-Bold.woff2')}@font-face{font-family:'Warehouse Hand';src:url('/src/app/fonts/Caveat-Latin-Bold.woff2')}@font-face{font-family:'Warehouse Body';src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2')}:root{--font-display:'Warehouse Display';--font-handwritten:'Warehouse Hand';--font-body:'Warehouse Body';--font-sans:'Warehouse Body'}body{margin:0;background:#f1edda;font-family:'Warehouse Body',Arial}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react','next/dynamic']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'shared-campaign-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fontCss+'</style><div id="root"></div><script type="module" src="/@id/__x00__shared-campaign-entry"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const checks=[],errors=[],blockedRequests=[];let browser,page;
const report={passed:false,checks,errors,blockedRequests,backend:'Browser-local fixtures only; no external API or database.'};
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||url.protocol==='data:')void request.continue();else{blockedRequests.push(request.url());void request.abort();}});
  const click=async(selector)=>{await page.$eval(selector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.click(selector);};
  const clickText=async(text)=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===text&&!button.disabled),{},text);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text),text);assert.ok(handle.asElement(),text);await handle.asElement().evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await handle.asElement().click();};
  const profiles=()=>page.$$eval('[data-campaign-member]',nodes=>nodes.map(node=>({zone:node.dataset.campaignMember,buddie:node.dataset.campaignBuddie,values:[...node.querySelectorAll('dl dd')].map(dd=>dd.textContent.trim())})));
  const responsive=async(phase)=>{for(const width of [1440,390,320]){await page.setViewport({width,height:width===1440?1100:950,isMobile:width<760,hasTouch:width<760});await page.waitForSelector('[data-campaign-summary]');await page.$eval('[data-campaign-summary]',node=>node.scrollIntoView({block:'start',behavior:'instant'}));await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,phase+' overflow '+width);assert.equal((await profiles()).length,2);await page.screenshot({path:resolve(output,phase+'-'+width+'.png')});checks.push(phase+' shows both distinct profiles within '+width+'px viewport');}};
  await page.setViewport({width:1440,height:1100});await page.goto(origin+'/?campaign=1',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-campaign-summary][data-campaign-phase="preparation"]');
  const preparation=await profiles();assert.deepEqual(preparation.map(row=>row.buddie),['HH2026-003','HH2026-004']);assert.notDeepEqual(preparation[0].values,preparation[1].values);
  assert.equal(await page.evaluate(()=>window.__fixture.starts.length),0);checks.push('preparation includes every assigned active zone and distinct profile estimates without automatic launch');
  await responsive('preparation');await page.setViewport({width:1440,height:1100});
  await clickText('Lancer la campagne');await page.waitForSelector('[aria-labelledby="culture-system-burn-title"]');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Commencer'&&!button.disabled));
  assert.match(await page.$eval('[data-campaign-energy]',node=>node.innerText),/2 m² engagés/);checks.push('one confirmation presents combined costs and a single shared deck');
  await page.evaluate(()=>{window.__loseStart=true;});await clickText('Commencer');
  await page.waitForFunction(()=>document.body.innerText.includes('Réponse perdue après validation. Réessaie.'));await clickText('Commencer');
  await page.waitForSelector('main[data-culture-play]');
  const started=await page.evaluate(()=>({starts:window.__fixture.starts,created:window.__fixture.created,runs:window.__fixture.runs,totals:window.__totals}));
  assert.equal(started.starts.length,2);assert.equal(started.created,1);assert.equal(started.runs.length,2);assert.equal(started.starts[0].campaign,true);assert.equal(started.starts[0].zoneId,undefined);assert.equal(started.starts[0].requestKey,started.starts[1].requestKey);assert.equal(started.starts[0].expectedEnergyCents,started.totals.energyCostCents);
  checks.push('lost confirmation reuses one request key and creates one campaign with two members');
  await page.waitForFunction(()=>document.querySelector('[data-culture-primary-action]')?.dataset.action==='roll');await click('[data-culture-primary-action]');
  await page.waitForFunction(()=>document.querySelector('main[data-culture-play]')?.dataset.culturePhase==='rolled');
  const afterRoll=await page.evaluate(()=>({actions:window.__fixture.actions,runs:window.__fixture.runs}));
  assert.equal(afterRoll.actions.length,1);assert.equal(afterRoll.actions[0].action,'roll');assert.deepEqual(afterRoll.runs[0].state.dice,afterRoll.runs[1].state.dice);assert.equal(afterRoll.runs[1].state.phase,'rolled');
  checks.push('one real roll click calls the leader once and moves both members to identical dice');
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('main[data-culture-play]');
  assert.equal(await page.$eval('main[data-culture-play]',node=>node.dataset.culturePhase),'rolled');checks.push('reload restores the shared leader and frozen participant profiles');
  await click('[data-campaign-progress] > summary');await page.waitForSelector('[data-campaign-progress][open]');assert.equal((await profiles()).length,2);
  for(let step=0;step<20;step++){
    if(await page.$('main[data-culture-campaign][data-culture-phase="complete"]'))break;
    await page.waitForFunction(()=>{const button=document.querySelector('[data-culture-primary-action]');return button&&!button.disabled;});
    const before=await page.evaluate(()=>window.__fixture.actions.length);await click('[data-culture-primary-action]');
    await page.waitForFunction(count=>window.__fixture.actions.length===count+1,{},before);
    await page.waitForFunction(()=>document.querySelector('main[data-culture-campaign][data-culture-phase="complete"]')||(()=>{const main=document.querySelector('main[data-culture-play]'),state=window.__fixture.runs[0].state;return main?.dataset.culturePhase===state.phase&&Number(main.dataset.cultureStage)===state.stageIndex;})());
  }
  await page.waitForSelector('main[data-culture-campaign][data-culture-phase="complete"]');
  const finished=await page.evaluate(()=>window.__fixture);assert.equal(finished.actions.length,18);assert.ok(finished.actions.every(action=>action.path.includes(started.runs[0].runId)));
  assert.deepEqual(finished.runs[0].state.history,finished.runs[1].state.history);assert.deepEqual(finished.runs[0].state.care,finished.runs[1].state.care);assert.notEqual(finished.runs[0].state.harvestGrams,finished.runs[1].state.harvestGrams);assert.equal(finished.flowers.length,2);
  assert.notDeepEqual(finished.flowers[0].cannabinoidReport.totals,finished.flowers[1].cannabinoidReport.totals);assert.notEqual(finished.flowers[0].terpeneReport.totalPercent,finished.flowers[1].terpeneReport.totalPercent);
  await page.waitForFunction(()=>document.querySelectorAll('[data-campaign-member] a[href*="flower="]').length===2);checks.push('six shared stages create two separate harvests and official flowers with distinct simulated reports');
  const results=await profiles();for(const [index,row] of results.entries())assert.equal(row.values[0],finished.runs[index].state.harvestGrams.toLocaleString('fr-FR',{maximumFractionDigits:1})+' g');
  checks.push('displayed final grams agree exactly with each domain receipt');await responsive('results');
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('main[data-culture-campaign][data-culture-phase="complete"]');assert.deepEqual(await profiles(),results);checks.push('completed campaign reload retains both harvests and links');
  assert.deepEqual(errors,[]);report.passed=true;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){report.error=String(error?.stack??error);if(page){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});report.text=await page.evaluate(()=>document.body.innerText).catch(()=>null);}await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));throw error;}
finally{await browser?.close();await server.close();}
