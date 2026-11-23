/** Shared live shell and Three canvas, with read-only local destination/API fixtures. */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {bankReturnLink} from './audit-building-rooms-scenarios.mjs';

export function world3dFixturePayload(path) {
  if (path === '/api/arena/tutorial') return {userId:'world-audit-player',chanvrier:{nickname:'VillageAudit',gender:'male',clothing:'teal',skin:'honey',strength:'green-thumb'}};
  if (path === '/api/arena/chanvrier/progress') return {metrics:{},reputation:0,rating:1000,rank:null,rankAsOf:null,badges:[],missions:[],showcase:{badges:[],title:null,tracked:null},unlockedFamilies:0,packsGranted:0,newBadgeCount:0,badgeCount:0};
  if (path === '/api/arena/feedback') return {items:[],total:0,hasMore:false};
  return null;
}

export async function auditQuarterMenu({page, visit, assertNoOverflow, results, origin, output}) {
  const trigger = 'button[aria-label="Ouvrir le menu du quartier"]';
  const menu = 'dialog[aria-label="Menu de Kanab Quest"][open]';
  const returnLink = 'a[href="/arene"][aria-label="Retour à l’Arène"]';
  const readyCanvas = 'canvas[data-village-ready="true"]';
  const destinations = ['hub', 'game', 'harvests', 'workshop', 'market', 'social', 'treasury', 'staff', 'school', 'missions', 'shop'];
  const mobile = () => page.viewport().width === 320;
  const activate = async selector => {
    await page.waitForSelector(selector, {visible: true});
    await page.$eval(selector, element => element.scrollIntoView({block: 'nearest', behavior: 'instant'}));
    if (mobile()) await page.tap(selector);
    else await page.click(selector);
  };
  const openMenu = async () => {
    await activate(trigger);
    await page.waitForSelector(menu, {visible: true});
  };
  const awaitMenuClose = () => page.waitForSelector(menu, {hidden: true});
  const checkActive = async key => {
    assert.deepEqual(await page.$$eval(`${menu} [aria-current="page"]`, items => items.map(item => item.dataset.placardNav)), [key]);
  };
  const checkOverflow = async () => {
    await assertNoOverflow('Quarter menu');
    assert.equal(await page.$eval(menu, element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1;
    }), true, 'The menu stays inside the viewport and has no horizontal scroll');
  };
  const capture = async name => {
    await page.$eval(menu, async element => {
      await Promise.all([...element.querySelectorAll('img')].map(image => image.decode()));
      await document.fonts.ready;
    });
    await page.screenshot({path: resolve(output, `quarter-menu-${name}.jpg`), quality: 92});
  };
  const waitArena = async () => {
    await page.waitForSelector('main[data-world="arena"] h1', {visible: true});
    assert.equal(new URL(page.url()).pathname, '/arene');
    assert.equal(new URL(page.url()).search, '');
  };
  for (const width of [1440, 320]) {
    await page.setViewport({width, height: width === 320 ? 710 : 900, isMobile: width === 320, hasTouch: width === 320});
    await visit('starter', 'villageDay=1&villageMinute=720');
    await page.waitForSelector(readyCanvas);
    await page.waitForSelector('[data-village-phase="day"]');
    await page.evaluate(selector => { window.__quarterMenuCanvas = document.querySelector(selector); }, readyCanvas);

    await page.focus(trigger);
    await page.keyboard.press('Enter');
    await page.waitForSelector(menu);
    await checkActive('hub');
    await checkOverflow();
    await capture(width);
    const focused = new Set();
    for (let index = 0; index < 20; index++) {
      await page.keyboard.press('Tab');
      const tab = await page.$eval(menu, element => ({
        inside: element.contains(document.activeElement) || document.activeElement === document.body,
        destination: document.activeElement?.dataset.placardNav,
      }));
      assert.equal(tab.inside, true, 'Tab cannot reach controls behind the modal');
      if (tab.destination) focused.add(tab.destination);
    }
    assert.equal(focused.size, destinations.length, 'Every destination can receive keyboard focus');
    await page.keyboard.press('Escape');
    await awaitMenuClose();
    await page.waitForFunction(selector => {
      return document.activeElement?.matches(selector) && !document.documentElement.hasAttribute('data-site-scroll-locked');
    }, {}, trigger);
    await openMenu();
    await page.goBack();
    await awaitMenuClose();
    assert.equal(new URL(page.url()).pathname, '/arene/placard');

    for (const key of [...destinations.slice(1), 'hub']) {
      await openMenu();
      assert.deepEqual(await page.$$eval(`${menu} [data-placard-nav]`, items => items.map(item => item.dataset.placardNav).sort()), [...destinations].sort());
      await activate(`${menu} [data-placard-nav="${key}"]`);
      await awaitMenuClose();
      if (key === 'treasury') await page.waitForSelector('[data-building-room="bank"]', {visible: true});
      else await page.waitForSelector(`[data-placard-view="${key}"]`);
      assert.equal(await page.evaluate(selector => window.__quarterMenuCanvas === document.querySelector(selector), readyCanvas), true);
      await openMenu();
      await checkActive(key);
      await activate(`${menu} button[aria-label="Fermer le menu"]`);
      await awaitMenuClose();
    }
    results.push({scenario: 'destinations-and-modal', width, destinations: destinations.length, keyboard: true, touch: mobile(), canvasRetained: true});

    for (const [query, active] of [
      ['view=hub&room=office', 'staff'],
      ['view=hub&room=market', 'market'],
      ['view=hub&room=missions', 'missions'],
      ['view=hub&room=arena', 'harvests'],
      ['view=hub&room=shop', 'shop'],
      ['view=collection&section=buddies', 'shop'],
      ['view=arena', 'harvests'],
    ]) {
      await page.evaluate(search => {
        history.pushState({}, '', `?${search}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, query);
      if (query.startsWith('view=collection')) await page.waitForSelector('[data-placard-collections]');
      await openMenu();
      await checkActive(active);
      await activate(`${menu} button[aria-label="Fermer le menu"]`);
      await awaitMenuClose();
    }
    results.push({scenario: 'room-and-deep-link-active-state', width, collection: true, jury: true, rooms: true});

    await visit('starter');
    await openMenu();
    await activate(`${menu} [data-arena-learning-trigger]`);
    await page.waitForSelector('dialog[data-sylvain-library][open]', {visible: true});
    await awaitMenuClose();
    results.push({scenario: 'learning-launcher', width, guideVisible: true});

    const query = 'view=market&section=sales&flower=fixture-flower';
    await visit('starter', query);
    await page.waitForSelector('[data-placard-view="market"]');
    await activate(`header ${returnLink}`);
    await waitArena();
    await visit('starter', query);
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForSelector('[data-placard-view="market"]');
    await page.evaluate(async () => {
      const {registerNavigationGuard} = await import('/src/lib/navigation-guard.ts');
      window.__quarterMenuGuard = registerNavigationGuard(continuation => { window.__quarterMenuContinue = continuation; });
    });
    const guardedUrl = page.url();
    await openMenu();
    await activate(`${menu} ${returnLink}`);
    await page.waitForFunction(() => typeof window.__quarterMenuContinue === 'function');
    await awaitMenuClose();
    assert.equal(page.url(), guardedUrl, 'The guard retains the deep link until the player confirms');
    assert.equal(await page.$eval('[data-market-section]', element => element.textContent), 'sales');
    assert.equal(await page.evaluate(() => Boolean(window.history.state?.lcbOverlays?.length)), false);
    await page.evaluate(() => {
      window.__quarterMenuGuard();
      window.__quarterMenuContinue();
    });
    await waitArena();
    await page.goBack();
    await page.waitForSelector('[data-placard-view="market"]');
    await awaitMenuClose();
    assert.equal(page.url(), guardedUrl);
    results.push({scenario: 'arena-return', width, direct: true, reload: true, draftGuard: true, backRestoresActivity: true});
  }

  await page.goto(new URL('/menu-indisponible', origin).href, {waitUntil: 'domcontentloaded'});
  await openMenu();
  const disabled = `${menu} [data-placard-nav="game"]`;
  assert.equal(await page.$eval(disabled, element => element.disabled), true);
  assert.match(await page.$eval(disabled, element => element.getAttribute('aria-label')), /Culture indisponible/);
  await activate(disabled);
  assert.equal(await page.evaluate(() => document.body.hasAttribute('data-test-navigation')), false);
  await page.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('Culture indisponible pour cet essai'), {}, menu);
  await checkOverflow();
  results.push({scenario: 'unavailable-destination', width: 320, disabled: true, reasonVisible: true});

  await visit('starter', 'villageDay=1&villageMinute=1320');
  await page.waitForSelector(readyCanvas);
  await page.waitForSelector('[data-village-phase="night"]');
  await openMenu();
  await checkActive('hub');
  await checkOverflow();
  await capture('nuit-320');
  results.push({scenario: 'night-quarter-menu', width: 320});
}

export async function auditWorld3d({page,visit,click,screenshot,assertNoOverflow,results,origin,warehousePlayer}) {
  page.setDefaultTimeout(20000);
  const menu='button[aria-label="Ouvrir le menu du quartier"]';
  const drawer='dialog[aria-label="Menu de Kanab Quest"][open]';
  const panel='[data-village-activity-panel]';
  const legacyPresentation='[data-placard-map], img[src*="placard-world-quizzshow-v9.webp"], [aria-label="Passer à la carte 2D"], [aria-label="Voir la carte d’origine"], [aria-label="Voir le village en 3D"]';
  const waitView=async view=>{
    await page.waitForSelector(`[data-placard-view="${view}"][data-placard-world="3d"]`);
    if(view!=='hub')await page.waitForSelector('[data-destination], [data-placard-collections]');
    else await page.waitForFunction(()=>document.querySelector('#placard-content')?.hidden);
    assert.equal(new URL(page.url()).pathname,'/arene/placard');
  };
  const sameCanvas=async()=>{
    assert.equal(await page.evaluate(()=>window.__worldAuditCanvas===document.querySelector('canvas[data-village-ready="true"]')),true,'Activity navigation retains the same Three canvas');
    assert.equal(await page.$(legacyPresentation+', [data-map-mailbox]'),null,'The village has a single presentation and mailbox');
  };
  const rememberCanvas=()=>page.evaluate(()=>{window.__worldAuditCanvas=document.querySelector('canvas[data-village-ready="true"]');});
  const noInterior=async()=>{
    assert.equal(await page.$('[data-enter-interior], [data-interior], [data-interior-scene]'),null,'Only the exterior village remains available');
    assert.equal(new URL(page.url()).searchParams.has('room'),false,'Obsolete room parameters are removed');
  };
  const bankRoom='[data-building-room="bank"]';
  const nav=async key=>{
    await click(menu);await page.waitForSelector(drawer);await click(`${drawer} [data-placard-nav="${key}"]`);
    if(key==='treasury') await page.waitForSelector(bankRoom,{visible:true});
    else await waitView(key);
    await sameCanvas();
  };
  const close=async()=>{
    if(await page.$('[data-placard-view="treasury"]')){
      await click(bankReturnLink);await page.waitForSelector(bankRoom,{visible:true});
      await click(`${bankRoom} a[href="/arene/placard?view=hub"]`);
    }else await click('button[aria-label="Revenir au village 3D"]');
    await waitView('hub');await sameCanvas();
  };
  const chooseActivity=async(building,href)=>{
    await page.focus(`[data-village-building="${building}"]`);await page.keyboard.press('Enter');
    await page.waitForSelector('#village-building-activities');
    await click(`#village-building-activities a[href="${href}"]`);
    const params=new URL(href,origin).searchParams;
    await waitView(params.get('view'));
    for(const [key,value] of params)assert.equal(new URL(page.url()).searchParams.get(key),value,`${building} retains ${key}=${value}`);
    await sameCanvas();
  };

  if (warehousePlayer) {
    const playerState = async visible => {
      const state = await page.waitForFunction(expected => {
        const scene = window.villagePlayerScene();
        const player = scene?.getObjectByName('chanvrier');
        if (!player) return false;
        let rendered = false;
        scene.traverseVisible(object => { if (object === player) rendered = true; });
        return rendered === expected && { model: player.uuid, position: player.position.toArray() };
      }, { timeout: 60000 }, visible);
      return state.jsonValue();
    };
    for (const [width, view] of [[1440, 'workshop'], [320, 'game']]) {
      await page.setViewport({ width, height: width === 320 ? 710 : 900 });
      await visit('active', `view=${view}&entryGate=1`);
      await waitView(view);
      const atEntry = await playerState(false);
      await rememberCanvas();
      await close();
      assert.deepEqual(await playerState(true), atEntry);
      const next = view === 'game' ? 'workshop' : 'game';
      await chooseActivity('warehouse', `/arene/placard?view=${next}`);
      assert.deepEqual(await playerState(false), atEntry);
      await close();
      assert.deepEqual(await playerState(true), atEntry);
      await nav('market');
      assert.deepEqual(await playerState(true), atEntry);
      results.push({ scenario: 'warehouse-village-player', width, direct: view, farmLink: next, sameModelAndPosition: true, visibleAtMarket: true });
    }
    return;
  }
  await visit('starter');
  await page.waitForSelector('canvas[data-village-ready="true"]',{timeout:60000});
  await waitView('hub');
  assert.equal(new URL(page.url()).searchParams.has('world'),false);
  await rememberCanvas();await sameCanvas();
  await page.evaluate(()=>localStorage.setItem('kq:world-mode:v1:world-audit-player','2d'));
  await visit('starter','view=market&section=sales&flower=fixture-flower');
  await page.waitForSelector('canvas[data-village-ready="true"]');await waitView('market');
  assert.equal(new URL(page.url()).searchParams.has('world'),false);
  await visit('starter','world=2d&view=market&section=sales&flower=fixture-flower');
  await page.waitForFunction(()=>new URLSearchParams(location.search).get('world')==='3d');
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('canvas[data-village-ready="true"]');await waitView('market');
  assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
  assert.equal(await page.$eval('[data-market-section]',node=>node.textContent),'sales');
  await rememberCanvas();await sameCanvas();
  await page.evaluate(async()=>{
    const {registerNavigationGuard}=await import('/src/lib/navigation-guard.ts');
    window.__worldDraftGuardCleanup=registerNavigationGuard(next=>{window.__worldDraftContinue=next;});
  });
  await click('button[aria-label="Revenir au village 3D"]');
  assert.equal(await page.evaluate(()=>typeof window.__worldDraftContinue),'function');
  await waitView('market');await sameCanvas();
  await page.evaluate(()=>{
    window.__worldDraftGuardCleanup();window.__worldDraftContinue();
    delete window.__worldDraftGuardCleanup;delete window.__worldDraftContinue;
  });
  await waitView('hub');await sameCanvas();
  results.push({scenario:'world-3d-only-entry',ordinaryLinks:true,obsoletePreferenceIgnored:true,legacy2dLink:true,reload:true,activityParameters:true,draftGuard:true});

  const noWebGL=await page.evaluateOnNewDocument(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(context,...args){
      if(['webgl','webgl2','experimental-webgl'].includes(context))return null;
      return getContext.call(this,context,...args);
    };
  });
  try {
    await page.setViewport({width:320,height:844,isMobile:true,hasTouch:true});
    await visit('starter');
    const fallback='[data-village-unavailable]';
    await page.waitForSelector(fallback,{visible:true});await waitView('hub');
    assert.equal(await page.$(legacyPresentation),null);
    const bank=`${fallback} [data-village-building="bank"]`;
    await page.focus(bank);await page.keyboard.press('Enter');
    const activity='#village-building-activities a[href="/arene/placard?view=treasury&pole=bank&section=loans"]';
    await page.waitForSelector(activity,{visible:true});
    await page.focus(activity);await page.keyboard.press('Enter');
    await waitView('treasury');
    assert.equal(await page.$eval('[data-bank-desk]',node=>node.textContent),'loans');
    await page.focus(bankReturnLink);await page.keyboard.press('Enter');
    await page.waitForSelector(bankRoom,{visible:true});
    await click(`${bankRoom} a[href="/arene/placard?view=hub"]`);
    await waitView('hub');
    await page.waitForSelector(activity,{visible:true});
    await click('[aria-label="Fermer les activités du bâtiment"]');
    await page.waitForFunction(selector=>document.activeElement?.matches(selector),{},bank);
    await assertNoOverflow('Village activity navigation without WebGL');
    results.push({scenario:'world-3d-without-webgl',width:320,keyboardBankActivity:true,returnToVillage:true});
  } finally {
    await page.removeScriptToEvaluateOnNewDocument(noWebGL.identifier);
  }

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

    await chooseActivity('bank','/arene/placard?view=treasury&pole=bank&section=stocks');
    assert.equal(await page.$eval('[data-bank-desk]',node=>node.textContent),'stocks');
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
      await close();await page.goBack();
      if(room==='bank') await page.waitForSelector(bankRoom,{visible:true});
      else await waitView(destination);
      await sameCanvas();
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

  await visit('world-signed-out','world=3d&view=game&run=fixture-run&entryGate=1');
  await page.waitForSelector('[data-quarter-character-gate] a[href^="/compte/connexion"]');
  assert.equal(await page.$('[data-placard-view]'),null,'An expired profile session cannot mount the game');
  const login=new URL(await page.$eval('[data-quarter-character-gate] a[href^="/compte/connexion"]',node=>node.href));
  const next=new URL(login.searchParams.get('next'),origin);
  assert.equal(next.pathname,'/arene/placard');
  for(const [key,value] of [['world','3d'],['view','game'],['run','fixture-run']])assert.equal(next.searchParams.get(key),value);
  results.push({scenario:'world-3d-entry-reconnection',profileSessionGate:true,modeAndActivityPreserved:true});
}
