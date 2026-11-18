// Reuse the existing isolated bank harness; extend only its scenarios/fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let source=await readFile('scripts/audit-bank-clarity-lot27.mjs','utf8');
source=source.replaceAll('\r\n','\n');
const replace=(before,after)=>{assert(source.includes(before),`Fixture anchor: ${before.slice(0,80)}`);source=source.replace(before,after);};
replace('`output/clarity-lot27/${before ? \'before\' : \'after\'}`', "'output/audit-global-jeu/finance-browser'");
replace("import {KqBankLoans}","import {KqStaffRecoveryProvider} from '/src/components/placard/KqStaffRecoveryContext';\nimport {KqBankLoans}");
replace('<KqTutorialApiProvider api={api}>','<KqTutorialApiProvider api={api}><KqStaffRecoveryProvider ownerId="11111111-1111-4111-8111-111111111111">');
replace('</KqTutorialApiProvider>','</KqStaffRecoveryProvider></KqTutorialApiProvider>');
replace('const receipts=new Map();', "const receipts=new Map(JSON.parse(localStorage.getItem('fixture-receipts')||'[]')); if(localStorage.getItem('fixture-snapshot'))snapshot=JSON.parse(localStorage.getItem('fixture-snapshot'));window.__snapshot=snapshot;\nwindow.__stall=false;window.__test401=false;");
replace("if(path!=='/api/arena/placard/bank')", "if(method==='POST'&&window.__stall)return new Promise(()=>{});if(method==='POST'&&window.__test401)return new Response('',{status:401});if(path!=='/api/arena/placard/bank')");
replace('receipts.set(body.requestKey,structuredClone(snapshot));', "receipts.set(body.requestKey,structuredClone(snapshot));localStorage.setItem('fixture-receipts',JSON.stringify([...receipts]));localStorage.setItem('fixture-snapshot',JSON.stringify(snapshot));");
const start=source.indexOf(' if(before){'),end=source.indexOf(' assert.deepEqual(errors,[])',start);
assert(start>0&&end>start);
const scenarios=`
 const posts=()=>page.evaluate(()=>window.__calls.filter(call=>call.method==='POST'));
 async function fresh(scenario,width=320){await page.goto(origin);await page.evaluate(()=>localStorage.clear());await page.setViewport({width,height:844});await open(scenario);}
 async function submit(){await clickButton('Examiner le contrat');await page.waitForSelector('dialog[open]');await clickButton('Signer');}
 for(const width of [320,1440]){
  await fresh('lost-response',width);await submit();await page.waitForSelector('[data-finance-recovery] button');
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  const first=(await posts())[0].body;
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-finance-recovery] button');
  assert.equal((await posts()).length,0,'Reload never resubmits');
  await clickButton('Vérifier cette confirmation');await page.waitForFunction(()=>document.querySelector('[data-bank-notice]')?.textContent.includes('Contrat signé'));
  const second=(await posts())[0].body;assert.equal(second.requestKey,first.requestKey);assert.equal(second.expectedOwnerId,first.expectedOwnerId);
  assert.equal(await page.evaluate(()=>window.__snapshot.cashCents),300000,'Only one debit/credit');
  assert.equal((await metrics()).overflow,false);await shot('recovered-'+width,true);results.push({case:'lost response / reload / same receipt',width});
 }
 await fresh('offer');await page.evaluate(()=>window.__test401=true);await submit();
 await page.waitForSelector('[data-finance-recovery] a');assert.match(await page.$eval('[data-finance-recovery]',el=>el.innerText),/session a expiré/);
 assert.equal(await page.$eval('[data-finance-recovery] button',el=>el.disabled),true);results.push({case:'401 preserves dossier and offers reconnect'});
 await fresh('offer');await page.evaluate(()=>window.__stall=true);await submit();
 const other=await browser.newPage();await other.setRequestInterception(true);other.on('request',request=>{const url=new URL(request.url());if(['data:','blob:'].includes(url.protocol)||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{external.push(request.url());void request.abort();}});
 await other.goto(origin+'/?scenario=offer',{waitUntil:'networkidle0'});await other.waitForSelector('[data-finance-recovery] button');await other.click('[data-finance-recovery] button');
 await other.waitForFunction(()=>document.querySelector('[data-finance-recovery]')?.textContent.includes('autre fenêtre'));
 assert.equal(await other.evaluate(()=>window.__calls.filter(call=>call.method==='POST').length),0,'Other tab cannot send while first confirmation holds its lock');await other.close();results.push({case:'two tabs share one financial confirmation lock'});
 await page.waitForFunction(()=>document.querySelector('[data-finance-recovery]')?.textContent.includes('Délai dépassé'),{timeout:26000});
 await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 assert.equal((await posts()).length,1);await shot('timeout-320',true);results.push({case:'stalled transport bounded; presentation closes; dossier retained'});
`;
source=source.slice(0,start)+scenarios+source.slice(end);
await mkdir('output/audit-global-jeu',{recursive:true});
const file=resolve('output/audit-global-jeu/finance-browser.mjs');await writeFile(file,source);
await import(pathToFileURL(file).href);
