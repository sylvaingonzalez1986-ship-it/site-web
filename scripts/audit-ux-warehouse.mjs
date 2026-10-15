/** Draft recovery and exits, real React components, browser-local API fixtures. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/ux-implementation/warehouse');
await mkdir(output, {recursive:true});
let source = (await readFile('scripts/audit-placard-warehouse-v4.mjs','utf8')).split("if(process.argv.includes('--preview'))")[0];
assert.ok(source.includes('await server.listen();'));
source = source.replace("'output/warehouse-v4'", "'output/ux-implementation/warehouse'")
  .replace('?? 3248', '?? 3277')
  .replace('const [closed,setClosed]=React.useState(false);', 'const [closed,setClosed]=React.useState(false);const [owner,setOwner]=React.useState(query.get("owner")||"ux-test");window.__setOwner=setOwner;')
  .replace('closed?<p data-warehouse-closed>Entrepôt fermé</p>', 'closed?<div><p data-warehouse-closed>Entrepôt fermé</p><button data-reopen onClick={()=>setClosed(false)}>Réouvrir</button></div>')
  .replace('<KqWarehouse embedded=', '<KqWarehouse draftOwnerId={owner} embedded=');
source += `
let browser; const checks=[],errors=[];
try {
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(); page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>void dialog.accept());
  await page.setRequestInterception(true);
  page.on('request',request=>void(request.url().startsWith(origin)||request.url().startsWith('data:')?request.continue():request.abort()));
  const visit=async(query='compact&modal')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-map]');};
  const rename=async(name)=>{
    await page.$eval('[data-warehouse-zone-settings]',node=>{node.open=true;});
    const input=await page.$('[data-warehouse-zone-settings] input'); await input.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await input.type(name);
    await page.waitForFunction(()=>document.querySelector('[data-warehouse-draft]')?.textContent.includes('conservé'));
  };
  const clickText=async(text)=>{const button=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text&&!node.disabled)||false,{},text);await button.asElement().click();};
  for(const width of [320,390,844,1440]) {
    await page.setViewport({width,height:width===844?390:844,isMobile:width<700,hasTouch:width<700});
    await visit('compact&modal&owner=test-'+width);
    await rename('Mon brouillon '+width);
    await page.click('[aria-label="Fermer l’entrepôt"]');
    await page.waitForSelector('[data-app-dialog][open]');
    const exit=await page.$eval('[data-app-dialog] header button',node=>{const r=node.getBoundingClientRect();return {visible:r.top>=0&&r.bottom<=innerHeight,hit:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
    assert.ok(exit.visible&&exit.hit,'Confirmation exit visible at '+width);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
    await page.screenshot({path:resolve(output,'leave-'+width+'.png')});
    await page.evaluate(()=>history.back());await page.waitForSelector('[data-app-dialog]',{hidden:true});
    assert.equal(await page.$('[data-warehouse-closed]'),null,'Back keeps the editor');
    await page.click('[aria-label="Fermer l’entrepôt"]');await clickText('Quitter en gardant le brouillon');
    await page.waitForSelector('[data-warehouse-closed]');
    await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-draft]');
    assert.equal(await page.$eval('[data-warehouse-zone-settings] input',node=>node.value),'Mon brouillon '+width,'Reload restores draft');
    await page.click('[data-warehouse-tool="move"]');await page.waitForSelector('[data-warehouse-action="finish-manipulation"]');
    await page.click('[data-warehouse-action="finish-manipulation"]');
    assert.equal(await page.$eval('[data-warehouse-map]',node=>node.dataset.tool),'inspect');
    await page.click('[data-warehouse-action="save"]');await page.waitForFunction(()=>window.__snapshot.revision===2);
    await page.waitForSelector('[data-warehouse-draft]',{hidden:true});
    assert.equal(await page.evaluate(owner=>sessionStorage.getItem('lcb:warehouse-draft:v1:'+owner),'test-'+width),null);
    checks.push({width,draftRecovery:true,guard:true,back:true,save:true,gestureExit:true});console.log('Warehouse checks passed: '+width);
  }
  await visit('compact&modal&owner=conflict');await rename('Ancien plan');
  await page.evaluate(()=>{const key='lcb:warehouse-draft:v1:conflict',draft=JSON.parse(sessionStorage.getItem(key));draft.revision=0;sessionStorage.setItem(key,JSON.stringify(draft));});
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.textContent.includes('Un ancien brouillon'));
  assert.notEqual(await page.$eval('[data-warehouse-zone-settings] input',node=>node.value),'Ancien plan');
  await clickText('Examiner le brouillon');await page.waitForFunction(()=>document.querySelector('[data-warehouse-zone-settings] input').value==='Ancien plan');
  await visit('compact&modal&owner=different');assert.notEqual(await page.$eval('[data-warehouse-zone-settings] input',node=>node.value),'Ancien plan');
  checks.push({staleRevision:true,separateAccounts:true});
  await visit('compact&modal&owner=account-a');await rename('Plan du compte A');
  await page.evaluate(()=>window.__setOwner('account-b'));
  await page.waitForFunction(()=>document.querySelector('[data-warehouse-zone-settings] input').value!=='Plan du compte A');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('lcb:warehouse-draft:v1:account-b')),null);
  checks.push({accountChangeDoesNotCopyDraft:true});
  await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Denied','SecurityError');}});});
  await visit();await page.$eval('[data-warehouse-zone-settings]',node=>{node.open=true;});const input=await page.$('[data-warehouse-zone-settings] input');await input.click({clickCount:3});await input.type('Sans stockage');
  await page.click('[aria-label="Fermer l’entrepôt"]');await page.waitForSelector('[data-app-dialog]');
  await clickText('Quitter sans enregistrer');await page.waitForSelector('[data-warehouse-closed]');
  await page.click('[data-reopen]');await page.waitForSelector('[data-warehouse-draft]');
  assert.ok(await page.$eval('[data-warehouse-zone-settings] input',node=>node.value.endsWith('Sans stockage')),'In-memory recovery survives remount without sessionStorage');
  checks.push({blockedStorageExit:true,blockedStorageRemountRecovery:true});assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
} finally {await browser?.close();await server.close();}
`;
const path=resolve(output,'fixture.mjs');await writeFile(path,source);
await import(pathToFileURL(path).href);
