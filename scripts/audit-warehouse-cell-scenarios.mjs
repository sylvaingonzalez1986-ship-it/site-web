/** Actual 2D warehouse/plan/dialogs on the existing browser-local fixture. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function auditWarehouseCells({origin,output,server,puppeteer,Launcher}) {
  const report={passed:false,checks:[],errors:[],blocked:[],mode:'Actual KqWarehouse and SVG plan; browser-local GET/PATCH, real domain quotes and idempotent receipts; no external requests or real transaction.'};
  let browser,page,cdp;
  const menu='dialog[data-warehouse-cell-menu][open]',map='[data-warehouse-map]';
  try{
    browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
    page=await browser.newPage();cdp=await page.createCDPSession();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(90000);
    page.on('pageerror',error=>report.errors.push(error.message));page.on('dialog',dialog=>void dialog.accept());
    await page.setRequestInterception(true);page.on('request',request=>{
      const url=new URL(request.url());
      if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();
      else{report.blocked.push(request.url());void request.abort();}
    });
    const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const wait=ms=>page.evaluate(ms=>new Promise(resolve=>setTimeout(resolve,ms)),ms);
    const capture=name=>page.screenshot({path:resolve(output,name+'.png')});
    const snapshot=()=>page.evaluate(()=>structuredClone(window.__snapshot));
    const requests=()=>page.evaluate(()=>structuredClone(window.__requests));
    const frame=async()=>{await page.$eval('[data-warehouse-map-viewport]',node=>node.scrollIntoView({block:'center',behavior:'instant'}));await settle();};
    const point=(x,y)=>page.$eval(map,(node,{x,y})=>{const p=new DOMPoint(Number(node.dataset.gridOriginX)+(x+.5)*Number(node.dataset.gridCellSize),Number(node.dataset.gridOriginY)+(y+.5)*Number(node.dataset.gridCellSize)).matrixTransform(node.getScreenCTM());return{x:p.x,y:p.y};},{x,y});
    let touch=false;
    const activate=async selector=>{await page.$eval(selector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));if(touch)await page.tap(selector);else await page.click(selector);await settle();};
    const visit=async(tag)=>{await page.goto(origin+'/?compact&cells&persist='+tag,{waitUntil:'networkidle0'});await page.waitForSelector(map);await activate('[data-warehouse-arrange]');await frame();};
    const cell=async(x,y,mode='choose')=>{
      await frame();const p=await point(x,y);
      assert.equal(await page.$eval(map,(node,p)=>node.contains(document.elementFromPoint(p.x,p.y)),p),true,'A real pointer reaches the selected SVG cell');
      if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      else await page.mouse.click(p.x,p.y);
      await wait(350);await page.waitForSelector(`${menu}[data-cell-menu-mode="${mode}"]`);
      assert.equal(await page.$$eval('dialog[open]',nodes=>nodes.length),1,'One gesture opens exactly one dialog');
    };
    const cancel=async()=>{await activate(`${menu} [data-warehouse-cell-cancel]`);await page.waitForSelector(menu,{hidden:true});};
    const confirm=async()=>{await activate(`${menu} [data-warehouse-cell-save]`);await page.waitForSelector(menu,{hidden:true});};
    const checkMenu=async()=>{
      const layout=await page.$eval(menu,node=>{const r=node.getBoundingClientRect(),body=node.querySelector('[data-app-dialog-body]');return{width:r.width,height:r.height,within:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,overflow:node.scrollWidth>node.clientWidth+1||body.scrollWidth>body.clientWidth+1,choices:[...node.querySelectorAll('[data-warehouse-cell-choice]')].map(n=>n.dataset.warehouseCellChoice)};});
      assert.ok(layout.within&&!layout.overflow,'Cell menu fits the viewport');return layout;
    };
    for(const width of [1440,320]){
      touch=width===320;await page.setViewport({width,height:touch?760:1000,isMobile:touch,hasTouch:touch});await visit('cells-'+width+'-'+Date.now());
      const initial=await snapshot();
      const layout=await page.$eval('[data-warehouse-cell-layout]',node=>{
        const scene=node.firstElementChild.getBoundingClientRect(),summary=node.querySelector(':scope > aside')?.getBoundingClientRect(),plan=node.querySelector('[data-warehouse-map-viewport]').getBoundingClientRect();
        return{workspaceWidth:node.clientWidth,planWidth:plan.width,sceneBottom:scene.bottom,summaryTop:summary?.top??null};
      });
      assert.ok(layout.planWidth>=layout.workspaceWidth*.9,'The construction plan uses the full workspace width');
      if(layout.summaryTop!==null)assert.ok(layout.summaryTop>=layout.sceneBottom-2,'The summary is below the construction plan');
      await page.$eval(map,node=>node.focus());
      for(let i=0;i<10;i++){await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');}
      for(let i=0;i<4;i++){await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');}
      await page.keyboard.press('Enter');await page.waitForSelector(menu);assert.match(await page.$eval(menu,node=>node.textContent),/Colonne 5, ligne 5/);
      await page.keyboard.press('Escape');await page.waitForSelector(menu,{hidden:true});assert.equal((await requests()).length,0);
      await capture('cells-full-plan-'+width);
      for(const[kind,x,y]of[['culture',8,8],['storage',8,5],['drying',0,6]]){
        const before=(await requests()).length;await cell(x,y);const layout=await checkMenu();
        assert.deepEqual(layout.choices,['culture','storage','drying','partition']);assert.match(await page.$eval(menu,node=>node.textContent),new RegExp(`Colonne ${x+1}, ligne ${y+1}`));
        if(kind==='culture')await capture('cells-choose-'+width);
        await activate(`${menu} [data-warehouse-cell-choice="${kind}"]`);await page.waitForSelector(`${menu}[data-cell-menu-mode="preview"]`);
        assert.equal((await requests()).length,before,'Choice and preview never write');assert.match(await page.$eval(menu,node=>node.textContent),/À payer maintenant/);
        await checkMenu();await confirm();const calls=await requests();assert.equal(calls.length,before+1);
        const next=await snapshot(),item=kind==='culture'?next.state.zones.at(-1):next.state.serviceZones.at(-1);
        assert.deepEqual({x:item.x,y:item.y,width:item.width,height:item.height},{x,y,width:1,height:1},'The chosen cell is preserved exactly');
        assert.equal(next.cashCents,initial.cashCents-calls.reduce((sum,call)=>sum+call.expectedCostCents,0));
      }
      report.checks.push({name:'cells-exact-placement-'+width,passed:true,touch,keyboard:true,threeKinds:true,choiceStable:true,explicitConfirmation:true,layout});
      let before=(await requests()).length;
      await cell(4,4);await activate(`${menu} [data-warehouse-cell-choice="partition"]`);
      for(let i=0;i<2;i++)await activate(`${menu} [aria-label="Allonger la paroi d’un mètre"]`);
      assert.equal(await page.$eval('[data-warehouse-wall-length]',node=>node.textContent),'3 m');
      await activate(`${menu} [data-warehouse-wall-rotate]`);await capture('cells-wall-preview-'+width);await cancel();
      assert.equal((await requests()).length,before);assert.equal((await snapshot()).state.partitions?.length??0,0);
      await cell(4,4);await activate(`${menu} [data-warehouse-cell-choice="partition"]`);
      for(let i=0;i<2;i++)await activate(`${menu} [aria-label="Allonger la paroi d’un mètre"]`);
      await activate(`${menu} [data-warehouse-wall-rotate]`);await confirm();
      const saved=await snapshot(),wall=saved.state.partitions.at(-1);assert.deepEqual({...wall,id:'wall'},{id:'wall',x:4,y:4,axis:'y',length:3});
      await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(`${map} [data-partition-id="${wall.id}"]`);await frame();
      assert.deepEqual((await snapshot()).state.partitions,saved.state.partitions);
      await capture('cells-wall-plan-'+width);
      await cell(4,4,'preview');await activate(`${menu} [data-warehouse-wall-remove]`);await cancel();assert.equal((await snapshot()).state.partitions.length,1);
      await cell(4,4,'preview');await activate(`${menu} [data-warehouse-wall-remove]`);await confirm();
      assert.equal((await snapshot()).state.partitions.length,0);assert.equal((await snapshot()).state.zones.length,initial.state.zones.length+1);
      report.checks.push({name:'cells-walls-'+width,passed:true,metreGrowth:true,rotation:true,cancelNoPatch:true,persistence:true,explicitRemoval:true});
      before=(await requests()).length;
      await cell(7,7);await activate(`${menu} [data-warehouse-cell-choice="storage"]`);
      await page.locator(`${menu} button::-p-text(Déplacer sur le plan)`).click();await page.waitForSelector(menu,{hidden:true});await cell(0,0,'preview');
      await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('superposer'),{},menu);
      assert.equal(await page.$eval(`${menu} [data-warehouse-cell-save]`,node=>node.disabled),true);await cancel();assert.equal((await requests()).length,before);
      const authoritative=await snapshot();
      assert.deepEqual(await page.$$eval(`${map} [data-zone-id]`,nodes=>nodes.map(node=>node.dataset.zoneId).sort()),[...authoritative.state.zones,...authoritative.state.serviceZones].map(zone=>zone.id).sort(),'Cancelling removes the preview from the actual displayed plan');
      report.checks.push({name:'cells-overlap-'+width,passed:true,moveToOccupiedCell:true,confirmationBlocked:true,cancelRestoresOperation:true});
    }
    touch=false;await page.setViewport({width:1440,height:1000,isMobile:false,hasTouch:false});await visit('cells-conflict-'+Date.now());
    await cell(8,8);await activate(`${menu} [data-warehouse-cell-choice="culture"]`);await page.evaluate(()=>window.__snapshot.revision++);
    await activate(`${menu} [data-warehouse-cell-save]`);await page.waitForSelector('[data-warehouse-reconcile]');
    assert.ok(await page.$(menu));assert.equal(await page.$eval(`${menu} [data-warehouse-cell-save]`,node=>node.disabled),true);
    await page.keyboard.press('Escape');await page.waitForSelector(menu,{hidden:true});await activate('[data-warehouse-reconcile]');await page.waitForSelector('[data-warehouse-reconcile-confirm]');
    await activate('[data-warehouse-reconcile-confirm]');await page.waitForSelector('[data-warehouse-reconcile-confirm]',{hidden:true});
    assert.equal(await page.$$eval(`${map} [data-zone-id]`,nodes=>nodes.length),(await snapshot()).state.zones.length+(await snapshot()).state.serviceZones.length);
    await cell(8,8);await page.keyboard.press('Escape');await page.waitForSelector(menu,{hidden:true});
    report.checks.push({name:'cells-conflict-reconcile',passed:true,draftKept:true,staleSaveBlocked:true,authoritativeGetDiscardsDraft:true});
    await cell(8,8);await activate(`${menu} [data-warehouse-cell-choice="culture"]`);const before=await snapshot();await page.evaluate(()=>window.__loseResponseOnce=true);
    await activate(`${menu} [data-warehouse-cell-save]`);await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('réessayer'),{},`${menu} [data-warehouse-cell-save]`);
    assert.equal(await page.$eval(`${menu} [data-warehouse-cell-cancel]`,node=>node.disabled),true);
    assert.equal(await page.$eval(`${menu} select`,node=>node.disabled),true);
    const first=(await requests()).at(-1);await capture('cells-unknown-retry');await confirm();const calls=await requests(),second=calls.at(-1),after=await snapshot();
    assert.deepEqual(second,first,'Ambiguous retry keeps the entire body and request key');assert.equal(after.revision,before.revision+1);assert.equal(after.cashCents,before.cashCents-first.expectedCostCents);
    report.checks.push({name:'cells-unknown-retry',passed:true,editingAndCancelLocked:true,identicalBodyAndKey:true,appliedOnce:true});
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);report.passed=true;
    console.log(JSON.stringify({passed:true,checks:report.checks.length,output}));
  }catch(error){report.failure=error.stack;if(page){await captureFailure(page,output);report.failureText=await page.$eval('body',node=>node.innerText).catch(()=>'');}throw error;}
  finally{await writeFile(resolve(output,'report-cells.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.httpServer?.closeAllConnections();await server.close();}
}

async function captureFailure(page,output){await page.screenshot({path:resolve(output,'cells-failure.png')}).catch(()=>{});}
