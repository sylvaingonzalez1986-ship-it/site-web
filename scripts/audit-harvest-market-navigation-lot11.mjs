/** Real shell and Commerce. Source screens are explicit callback fixtures. Read-only API. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/clarity-lot11/navigation');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-commerce-navigation.mjs', 'utf8')).split('let browser;')[0];
assert(source.includes('const server=await createServer'));
source = source.replace("'output/clarity-lot2/navigation'", "'output/clarity-lot11/navigation'")
  .replace('??3443', '??3613')
  .replace('const modules={', () => `
for(const [key,name] of [['./KqHarvests','KqHarvests'],['./KqWarehouseEntry','KqWarehouseEntry']]){
  destinations[key]=stub(name,'<p data-source-flower>{props.initialFlowerId}</p><button data-fixture-stock onClick={()=>props.onOpenMarket(props.initialFlowerId,"dashboard")}>Voir mon stock en vente</button>');
}
const modules={`);
source += String.raw`
let browser;const checks=[],errors=[],external=[],networkWrites=[];
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',request=>{
   const url=new URL(request.url());if(url.protocol==='data:')return void request.continue();
   if(url.origin!==origin){external.push(url.href);return void request.abort();}
   if(!['GET','HEAD'].includes(request.method())){networkWrites.push(url.href);return void request.abort();}
   if(url.pathname.startsWith('/api/'))return void request.respond({status:200,contentType:'application/json',body:'{}'});
   void request.continue();
 });
 const click=async selector=>{const handle=await page.waitForSelector(selector,{visible:true});await handle.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await handle.click();};
 const params=()=>new URL(page.url()).searchParams;
 for(const width of [320,390,1440])for(const [view,section] of [['harvests',''],['harvests','storage'],['workshop','storage']]){
   await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
   await page.goto(origin+'/arene/placard?view='+view+'&section='+section+'&flower=empty-bulk-fixture',{waitUntil:'networkidle0'});
   await click('[data-fixture-stock]');await page.waitForSelector('[data-screen="dashboard"]');
   assert.equal(params().get('section'),'dashboard');assert.equal(params().get('flower'),'empty-bulk-fixture');assert.equal(params().get('from'),view);assert.equal(params().get('fromFlower'),'empty-bulk-fixture');assert.equal(params().get('fromSection'),section||null);
   assert.equal(await page.$('[data-commerce-missing-flower]'),null,'No missing bulk preparation replaces the sales dashboard');
   await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-screen="dashboard"]');
   await click('[data-placard-back="'+view+'"]');await page.waitForSelector('[data-fixture-stock]');
   assert.equal(params().get('flower'),'empty-bulk-fixture');assert.equal(params().get('section'),section||null);
   await click('[data-fixture-stock]');await page.waitForSelector('[data-screen="dashboard"]');
   await page.goBack();await page.waitForSelector('[data-fixture-stock]');assert.equal(params().get('flower'),'empty-bulk-fixture');
   await page.goForward();await page.waitForSelector('[data-screen="dashboard"]');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(await page.evaluate(()=>window.posts),[]);
   checks.push({width,view,section:section||'overview',dashboard:true,reload:true,returnToLot:true,history:true,noWrites:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(networkWrites,[]);
 console.log(JSON.stringify({checks:checks.length,errors,external,networkWrites}));
}finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external,networkWrites},null,2));if(browser)await browser.close();await server.close();}
`;
const runtime = resolve(output, 'run.mjs');
await writeFile(runtime, source);
await import(pathToFileURL(runtime).href);
