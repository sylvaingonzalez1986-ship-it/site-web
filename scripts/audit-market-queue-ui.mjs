// Existing isolated Vite/browser harness, actual market components, memory API.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let source=(await readFile('scripts/audit-bank-clarity-lot27.mjs','utf8')).replaceAll('\r\n','\n');
source=source.replace('`output/clarity-lot27/${before ? \'before\' : \'after\'}`',"'output/audit-global-jeu/market-browser'").replace('?? 3597','?? 3598');
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqCryptoMarket} from '/src/components/placard/KqCryptoMarket';import {KqStockMarket} from '/src/components/placard/KqStockMarket';
import {getKqStockInstrument} from '/src/lib/kanab-quest-stocks';
import {KqStaffRecoveryProvider} from '/src/components/placard/KqStaffRecoveryContext';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import retro from '/src/components/contest/ArenaRetro.module.css';
const market=new URLSearchParams(location.search).get('market')||'crypto';
const id='22222222-2222-4222-8222-222222222222',now=()=>new Date().toISOString();
let queued=JSON.parse(localStorage.getItem('fixture-queue')||'[]');window.__calls=[];
const crypto={id:1,rank:1,name:'Bitcoin',symbol:'BTC',priceEur:'100',change24h:1,quotedAt:now(),inTop100:true};
const request=async(input,init={})=>{
 const url=new URL(String(input),location.origin),body=init.body?JSON.parse(init.body):null;window.__calls.push({method:init.method||'GET',body});
 if(!body){let assets=market==='crypto'?[crypto]:(url.searchParams.get('ids')||'^FCHI').split(',').map(id=>{const i=getKqStockInstrument(id);return i?{...i,priceNative:'100',priceEur:'100',changePercent:1,quotedAt:now(),refreshedAt:now(),marketState:'open',fxRate:'1',fxQuotedAt:i.currency==='USD'?now():null}:null}).filter(Boolean);return Response.json({version:1,serverNow:now(),marketStatus:'live',updatedAt:now(),cashCents:100000,assets,positions:[],recentTrades:[],queuedOrders:queued});}
 if(body.action==='preview'){return Response.json({orderId:id,assetId:body.assetId,side:body.side,quantity:'1',priceEur:'100',amountCents:10000,quotedAt:now(),expiresAt:new Date(Date.now()+60000).toISOString()});}
 if(body.action==='confirm'){
  if(body.executionPolicy!=='next-publication')throw new Error('Missing explicit future-price instruction');
  if(!queued.length){queued=[{orderId:id,market,assetId:market==='crypto'?'1':'^FCHI',side:'buy',budgetCents:10000,quantity:'1',submittedAt:now(),deadlineAt:new Date(Date.now()+604800000).toISOString(),status:'pending',reason:null,executionAt:null}];localStorage.setItem('fixture-queue',JSON.stringify(queued));return Response.json({error:'Réponse perdue'},{status:503});}
  return Response.json({queuedOrder:queued[0],replayed:true});
 }
 throw new Error('Unexpected action');
};
const api=createKqTutorialApi(request);api.isTutorial=false;
createRoot(document.getElementById('root')).render(<div className={retro.surface}><KqTutorialApiProvider api={api}><KqStaffRecoveryProvider ownerId="11111111-1111-4111-8111-111111111111">{market==='crypto'?<KqCryptoMarket/>:<KqStockMarket/>}</KqStaffRecoveryProvider></KqTutorialApiProvider></div>);
`;
const entryStart=source.indexOf('const entry = `'),entryEnd=source.indexOf('const modules=',entryStart);
assert(entryStart>0&&entryEnd>entryStart);source=source.slice(0,entryStart)+'const entry = '+JSON.stringify(entry)+';\n'+source.slice(entryEnd);
// Never request external logos in this fixture.
source=source.replace("typeof src==='string'?src:src.src","typeof src==='string'&&src.startsWith('https:')?'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E':typeof src==='string'?src:src.src");
const start=source.indexOf(' const frames='),end=source.indexOf(' assert.deepEqual(errors,[])',start);
assert(start>0&&end>start);
source=source.slice(0,start)+`
 const click=async selector=>{const button=await page.waitForSelector(selector);await button.evaluate(el=>el.scrollIntoView({block:'center'}));await button.focus();await page.keyboard.press('Enter');};
 for(const market of ['crypto','stocks'])for(const width of [320,1440]){
  await page.goto(origin);await page.evaluate(()=>localStorage.clear());await page.setViewport({width,height:844});await page.goto(origin+'/?market='+market,{waitUntil:'networkidle0'});
  await click('button[aria-label^="Acheter "]:not(:disabled)');await page.waitForSelector('dialog[open]');await click('dialog button[type="submit"]');
  const confirm=market==='crypto'?'[data-crypto-confirm]':'[data-stock-confirm]';await page.waitForSelector(confirm);
  assert.match(await page.$eval('dialog',el=>el.innerText),/cours.*postérieur|prochain cours/);assert.doesNotMatch(await page.$eval('dialog',el=>el.innerText),/Prix bloqué|Cours bloqué|exactement celui/);
  await page.screenshot({path:resolve(output,market+'-review-'+width+'.png')});await click(confirm);
  await page.waitForSelector('[data-finance-recovery] button');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  const first=await page.evaluate(()=>window.__calls.find(c=>c.body?.action==='confirm').body);
  await page.reload({waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.body).length),0,'No submission on reload');
  await click('[data-finance-recovery] button');await page.waitForFunction(()=>!document.querySelector('[data-finance-recovery] button'));
  const second=await page.evaluate(()=>window.__calls.find(c=>c.body?.action==='confirm').body);assert.deepEqual(second,first);
  assert.match(await page.$eval('section[aria-label="Ordres transmis"]',el=>el.innerText),/En attente/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No overflow');await page.screenshot({path:resolve(output,market+'-pending-'+width+'.png'),fullPage:true});results.push({market,width,lostResponseReplayed:true,pendingVisible:true});
 }
`+source.slice(end);
await mkdir('output/audit-global-jeu',{recursive:true});const file=resolve('output/audit-global-jeu/market-browser.mjs');await writeFile(file,source);await import(pathToFileURL(file).href);
