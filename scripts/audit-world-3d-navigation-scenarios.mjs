/** Shared live shell and Three canvas, with read-only local destination/API fixtures. */
import assert from 'node:assert/strict';

export function world3dFixturePayload(path) {
  if (path === '/api/arena/tutorial') return {userId:'world-audit-player',chanvrier:{nickname:'VillageAudit',gender:'male',clothing:'teal',skin:'honey',strength:'green-thumb'}};
  if (path === '/api/arena/chanvrier/progress') return {metrics:{},reputation:0,rating:1000,rank:null,rankAsOf:null,badges:[],missions:[],showcase:{badges:[],title:null,tracked:null},unlockedFamilies:0,packsGranted:0,newBadgeCount:0,badgeCount:0};
  if (path === '/api/arena/feedback') return {items:[],total:0,hasMore:false};
  return null;
}

export async function auditWorld3d({page,visit,click,screenshot,assertNoOverflow,results,origin}) {
  page.setDefaultTimeout(20000);
  const menu='button[aria-label="Ouvrir le menu du quartier"]';
  const drawer='dialog[aria-label="Menu de Kanab Quest"][open]';
  const panel='[data-village-activity-panel]';
  const waitView=async view=>{
    await page.waitForSelector(`[data-placard-view="${view}"][data-placard-world="3d"]`);
    if(view!=='hub')await page.waitForSelector('[data-destination], [data-placard-collections]');
    else await page.waitForFunction(()=>document.querySelector('#placard-content')?.hidden);
    assert.equal(new URL(page.url()).pathname,'/arene/placard');
  };
  const sameCanvas=async()=>{
    assert.equal(await page.evaluate(()=>window.__worldAuditCanvas===document.querySelector('canvas[data-village-ready="true"]')),true,'Activity navigation retains the same Three canvas');
    assert.equal(await page.$('[data-placard-map], [data-map-mailbox]'),null,'No duplicate 2D map or mailbox is mounted behind the village');
  };
  const rememberCanvas=()=>page.evaluate(()=>{window.__worldAuditCanvas=document.querySelector('canvas[data-village-ready="true"]');});
  const noInterior=async()=>{
    assert.equal(await page.$('[data-enter-interior], [data-interior], [data-interior-scene]'),null,'Only the exterior village remains available');
    assert.equal(new URL(page.url()).searchParams.has('room'),false,'Obsolete room parameters are removed');
  };
  const nav=async key=>{await click(menu);await page.waitForSelector(drawer);await click(`${drawer} [data-placard-nav="${key}"]`);await waitView(key);await sameCanvas();};
  const close=async()=>{await click('button[aria-label="Revenir au village 3D"]');await waitView('hub');await sameCanvas();};
  const chooseActivity=async(building,href)=>{
    await page.focus(`[data-village-building="${building}"]`);await page.keyboard.press('Enter');
    await page.waitForSelector('#village-building-activities');
    await click(`#village-building-activities a[href="${href}"]`);
    const params=new URL(href,origin).searchParams;
    await waitView(params.get('view'));
    for(const [key,value] of params)assert.equal(new URL(page.url()).searchParams.get(key),value,`${building} retains ${key}=${value}`);
    await sameCanvas();
  };

  for(const width of [1440,320]) {
    await page.setViewport({width,height:width===320?844:1000,isMobile:width===320,hasTouch:width===320,deviceScaleFactor:1});
    await visit('starter','world=3d');
    await page.waitForSelector('canvas[data-village-ready="true"]',{timeout:60000});
    await waitView('hub');await rememberCanvas();await sameCanvas();
    await click(menu);await page.waitForSelector(drawer);
    assert.deepEqual(await page.$$eval(`${drawer} [data-placard-nav]`,nodes=>nodes.map(node=>node.dataset.placardNav).sort()),['hub','game','harvests','workshop','market','social','treasury','staff','school','missions','shop'].sort());
    await page.keyboard.press('Escape');await page.waitForSelector(drawer,{hidden:true});
    for(const destination of ['game','harvests','workshop','market','social','treasury','staff','school','missions','shop','hub'])await nav(destination);
    await assertNoOverflow('3D village');
    await screenshot(`world-3d-hub-${width}`);
    results.push({scenario:'world-3d-all-navigation',width,destinations:11,persistentCanvas:true,noDuplicateMap:true});

    await chooseActivity('bank','/arene/placard?view=treasury&pole=bank');
    assert.equal(await page.$eval('[data-treasury-pole]',node=>node.textContent),'bank');
    await close();
    await chooseActivity('market','/arene/placard?view=market&section=management');
    assert.equal(await page.$eval('[data-market-section]',node=>node.textContent),'management');
    await close();
    await chooseActivity('warehouse','/arene/placard?view=workshop&section=processing');
    assert.equal(await page.$eval('[data-warehouse-section]',node=>node.textContent),'processing');
    await close();
    await chooseActivity('arena','/arene/placard?view=arena');await close();
    await chooseActivity('shop','/arene/placard?view=shop&tab=collection');
    await page.waitForSelector('[data-placard-collections]');await close();
    results.push({scenario:'world-3d-building-destinations',width,bank:true,commerceManagement:true,processing:true,jury:true,collection:true});

    await click('button[aria-label="Ouvrir le bilan de ma partie"]');
    await page.waitForSelector(`${panel} [data-placard-next-action]`);
    await page.waitForSelector(`${panel} [data-chanvrier-card] button`);
    assert.equal(await page.$eval('[data-placard-lobby]',node=>node.checkVisibility()),true,'The authoritative resume summary remains available');
    await click('[data-chanvrier-card] button');
    await page.waitForSelector('dialog[data-chanvrier-palmares][open]');
    assert.equal(await page.$eval('[data-chanvrier-palmares] h2',node=>node.textContent),'VillageAudit');
    await click('[data-chanvrier-palmares] footer a[href="/arene/placard?view=missions"]');
    await waitView('missions');await sameCanvas();
    await close();
    await click('button[aria-label="Ouvrir le bilan de ma partie"]');
    await page.waitForSelector(`${panel} [data-placard-next-action] button`);
    await click(`${panel} [data-placard-next-action] button`);await waitView('game');await sameCanvas();
    await close();
    results.push({scenario:'world-3d-profile-and-resume',width,profilePortalLink:true,authoritativeResume:true});

    await click(menu);await page.waitForSelector(drawer);
    await click(`${drawer} [data-arena-learning-trigger]`);
    await page.waitForSelector('[data-farm-guide]');
    assert.equal(await page.$eval('[data-farm-guide]',node=>node.checkVisibility()),true,'The tutorial can open while the activity panel is closed');
    await page.$eval('[data-farm-guide-action]',node=>node.scrollIntoView({block:'nearest',behavior:'instant'}));
    assert.equal(await page.$eval('[data-farm-guide-action]',node=>{const rect=node.getBoundingClientRect();return node.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));}),true,'The tutorial action is above the village and accepts a real pointer click');
    await click('[data-farm-guide-action]');
    await page.waitForSelector(panel);await sameCanvas();
    assert.equal(new URL(page.url()).searchParams.get('world'),'3d');
    await screenshot(`world-3d-tutorial-${width}`);
    await click('[data-farm-guide-close]');await page.waitForSelector('[data-farm-guide]',{hidden:true});
    await close();
    results.push({scenario:'world-3d-tutorial',width,guideVisible:true,modePreserved:true});

    await nav('market');await nav('staff');
    await page.goBack();await waitView('market');await sameCanvas();
    await page.goForward();await waitView('staff');await sameCanvas();
    if(width===320){
      const dimensions=await page.$eval(panel,node=>({client:node.clientHeight,scroll:node.scrollHeight,overflow:getComputedStyle(node).overflowY}));
      assert(dimensions.scroll>dimensions.client+100,'Long activity content scrolls inside the mobile panel');
      assert(['auto','scroll'].includes(dimensions.overflow));
      await page.$eval('[data-world-panel-end]',node=>node.scrollIntoView({block:'center',behavior:'instant'}));
      assert(await page.$eval(panel,node=>node.scrollTop>100),'Panel scrolling exposes the last activity');
      await assertNoOverflow('Mobile 3D activity');await screenshot('world-3d-panel-scroll-320');
      const position=await page.$eval(panel,node=>node.scrollTop);
      await nav('market');await page.goBack();await waitView('staff');
      try { await page.waitForFunction(position=>document.querySelector('[data-village-activity-panel]')?.scrollTop>=position-8,{},position); }
      catch { throw Error(`Mobile activity Back did not restore scroll: ${JSON.stringify({expected:position,...await page.$eval(panel,node=>({actual:node.scrollTop,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight}))})}`); }
      await click('[data-world-panel-end]');await waitView('workshop');
      assert.equal(new URL(page.url()).searchParams.get('employee'),'fixture-last-employee');await sameCanvas();
    }
    await close();
    results.push({scenario:'world-3d-history-and-scroll',width,back:true,forward:true,mobileInternalScroll:width===320});

    await noInterior();
    await page.focus('[data-village-building="warehouse"]');await page.keyboard.press('Enter');
    await page.waitForSelector('#village-building-activities');
    const arrange='#village-building-activities a[href="/arene/placard?view=workshop"]';
    assert.match(await page.$eval(arrange,node=>node.textContent),/Aménager l.entrepôt/);
    assert.equal(await page.$('[data-enter-interior]'),null,'Building actions offer the existing warehouse plan instead of entering an interior');
    await click(arrange);await waitView('workshop');await sameCanvas();await noInterior();
    assert.equal(await page.$eval('[data-warehouse-section]',node=>node.textContent),'equipment');
    assert.ok(await page.$(`${panel} [data-destination="KqWarehouseEntry"]`),'Warehouse planning uses its existing 2D activity inside the shared panel');
    await page.goBack();await waitView('hub');await sameCanvas();
    await page.goForward();await waitView('workshop');await sameCanvas();
    await assertNoOverflow('Exterior village with 2D warehouse planning');await screenshot(`world-exterior-workshop-${width}`);
    await close();

    for(const [room,destination] of [['warehouse','workshop'],['bank','treasury']]){
      await visit('starter',`world=3d&room=${room}`);
      await page.waitForSelector('canvas[data-village-ready="true"]');await waitView(destination);
      await page.waitForFunction(()=>!new URLSearchParams(location.search).has('room'));
      assert.equal(new URL(page.url()).searchParams.get('view'),destination,'Old room-only links resolve to the corresponding existing activity');
      await rememberCanvas();await sameCanvas();await noInterior();
      await close();await page.goBack();await waitView(destination);await sameCanvas();
      await page.goForward();await waitView('hub');await sameCanvas();
    }
    const precise={view:'workshop',section:'storage',zone:'fixture-zone',flower:'fixture-flower'};
    await visit('starter',`world=3d&room=bank&${new URLSearchParams(precise)}`);
    await page.waitForSelector('canvas[data-village-ready="true"]');await waitView('workshop');
    await page.waitForFunction(()=>!new URLSearchParams(location.search).has('room'));
    for(const [key,value]of Object.entries(precise))assert.equal(new URL(page.url()).searchParams.get(key),value,`Removing room preserves ${key}`);
    assert.equal(await page.$eval('[data-warehouse-section]',node=>node.textContent),'storage');
    assert.equal(await page.$eval('[data-warehouse-flower]',node=>node.textContent),'fixture-flower');
    await rememberCanvas();await sameCanvas();await noInterior();
    await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('canvas[data-village-ready="true"]');await waitView('workshop');
    await rememberCanvas();await noInterior();await close();
    results.push({scenario:'exterior-with-2d-activities',width,noInterior:true,warehousePlanLink:true,real2dPanel:true,persistentCanvas:true,history:true,legacyRoomActivities:['workshop','treasury'],preciseParametersPreserved:true,reload:true});
  }

  // An ordinary existing URL has no world parameter; it must resume the saved mode.
  await visit('starter','view=market&section=sales&flower=fixture-flower');
  await page.waitForSelector('canvas[data-village-ready="true"]');await waitView('market');
  assert.equal(new URL(page.url()).searchParams.has('world'),false);
  await rememberCanvas();
  await page.evaluate(async()=>{const {registerNavigationGuard}=await import('/src/lib/navigation-guard.ts');window.__worldDraftGuardCleanup=registerNavigationGuard(next=>{window.__worldDraftContinue=next;});});
  await click('button[aria-label="Passer à la carte 2D"]');
  assert.equal(await page.$eval('[data-placard-world]',node=>node.dataset.placardWorld),'3d','An unresolved draft blocks a presentation switch');
  assert.equal(await page.evaluate(()=>typeof window.__worldDraftContinue),'function');
  await sameCanvas();
  await page.evaluate(()=>{window.__worldDraftGuardCleanup();window.__worldDraftContinue();delete window.__worldDraftContinue;delete window.__worldDraftGuardCleanup;});
  await page.waitForSelector('[data-placard-world="2d"][data-placard-view="market"]');
  assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower','Switching presentation preserves activity context');
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-placard-world="2d"]');
  await visit('starter','view=market');await page.waitForSelector('[data-placard-world="2d"]');
  await page.evaluate(()=>{localStorage.setItem('kq:world-mode:v1:another-player','3d');window.dispatchEvent(new StorageEvent('storage',{key:'kq:world-mode:v1:another-player',newValue:'3d'}));});
  assert.equal(await page.$eval('[data-placard-world]',node=>node.dataset.placardWorld),'2d','Another account does not change this presentation');
  await page.evaluate(()=>{localStorage.setItem('kq:world-mode:v1:world-audit-player','3d');window.dispatchEvent(new StorageEvent('storage',{key:'kq:world-mode:v1:world-audit-player',newValue:'3d'}));});
  await page.waitForSelector('canvas[data-village-ready="true"]');await waitView('market');
  results.push({scenario:'world-3d-presentation-persistence',ordinaryLinks:true,explicit2d:true,reload:true,accountIsolation:true,storageNotification:true,draftGuard:true});

  await visit('world-signed-out','world=3d&view=game&run=fixture-run&entryGate=1');
  await page.waitForSelector('[data-quarter-character-gate] a[href^="/compte/connexion"]');
  assert.equal(await page.$('[data-placard-view]'),null,'An expired profile session cannot mount the game');
  const login=new URL(await page.$eval('[data-quarter-character-gate] a[href^="/compte/connexion"]',node=>node.href));
  const next=new URL(login.searchParams.get('next'),origin);
  assert.equal(next.pathname,'/arene/placard');
  for(const [key,value] of [['world','3d'],['view','game'],['run','fixture-run']])assert.equal(next.searchParams.get(key),value);
  results.push({scenario:'world-3d-entry-reconnection',profileSessionGate:true,modeAndActivityPreserved:true});
}
