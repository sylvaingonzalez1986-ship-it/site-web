import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const roomActivities = {
  bank: {
    bank: 'view=treasury&pole=bank&section=loans',
    savings: 'view=treasury&pole=bank&section=savings',
    stocks: 'view=treasury&pole=bank&section=stocks',
    crypto: 'view=treasury&pole=bank&section=crypto',
  },
  office: {team: 'view=staff', 'team-register': 'view=staff&section=team', recruitment: 'view=staff&section=candidates', accounts: 'view=staff&section=accounting'},
  market: {sales: 'view=market&section=sales', stock: 'view=market&section=dashboard', business: 'view=market&section=management', communication: 'view=social'},
  missions: {missions: 'view=missions', community: 'view=missions&section=community'},
  arena: {jury: 'view=arena', 'arena-storage': 'view=harvests&section=storage'},
  shop: {packs: 'view=shop', collection: 'view=shop&tab=collection', buddies: 'view=shop&section=buddies'},
};
const path = '/arene/placard';
const activityBubble = '#village-building-activities';
const activityPanel = '[data-village-activity-panel]';
const roomQuery = id => `view=hub&room=${id}`;
const roomSelector = id => `[data-building-room="${id}"]`;
const link = query => `a[href="${path}?${query}"]`;
const fromRoom = (id, query) => `${query}&fromRoom=${id}`;
const liveCanvas = 'canvas[data-live="true"]';
export const bankReturnLink = `${activityPanel} ${link(roomQuery('bank'))}`;

export async function assertBankService(page, section) {
  await page.waitForSelector('[data-treasury-bank]', {visible: true});
  await page.waitForSelector(`#bank-panel-${section}[role="region"]`, {visible: true});
  assert.deepEqual(await page.$$eval('[id^="bank-panel-"]', nodes => nodes.map(node => node.id)), [`bank-panel-${section}`]);
  assert.equal(await page.$('[id^="bank-desk-"], [aria-label="Guichets de la banque"], img[src*="bureau-bank-"]'), null);
  const shortcuts = `${activityPanel} a[href*="view=treasury"], button[aria-label="Ouvrir le menu du quartier"], button[aria-label="Revenir au village 3D"]`;
  assert.deepEqual(await page.$$eval(shortcuts, nodes => nodes.filter(node => node.checkVisibility()).map(node => node.textContent)), []);
  const headerControls = await page.$$eval(`${activityPanel} > header :is(a,button)`, nodes => nodes.filter(node => node.checkVisibility()).map(node => ({
    label: node.textContent.trim(), name: node.getAttribute('aria-label') || node.textContent.trim(), href: node.getAttribute('href'),
  })));
  assert.deepEqual(headerControls, [{label: 'Retour à la banque', name: 'Retour à la banque', href: `${path}?${roomQuery('bank')}`}]);
}

export async function auditBuildingRooms({page, visit, click, assertNoOverflow, results, output, bankOfficeOnly = false}) {
  const rooms = Object.entries(roomActivities).filter(([id]) => !bankOfficeOnly || id === 'bank' || id === 'office');
  const screenshotDir = resolve(output, 'building-rooms');
  await mkdir(screenshotDir, {recursive: true});
  const assertQuery = async query => {
    const expected = Object.fromEntries(new URLSearchParams(query));
    try {
      await page.waitForFunction(expected => {
        const params = new URLSearchParams(location.search);
        return Object.entries(expected).every(([key, value]) => params.get(key) === value);
      }, {timeout: 12000}, expected);
    } catch (cause) {
      throw new Error(`Expected ${query}, current URL is ${page.url()}`, {cause});
    }
    assert.equal(new URL(page.url()).pathname, path);
  };
  const assertActivity = async (id, query) => {
    await assertQuery(query);
    const section = new URLSearchParams(query).get('section') ?? 'overview';
    if (id === 'bank') {
      await assertBankService(page, section);
      const content = {loans: '[data-bank-offer]', savings: 'button[aria-label="Actualiser le livret"]', stocks: '[data-stock-logo]', crypto: '[data-crypto-logo]'};
      await page.waitForSelector(`#bank-panel-${section} ${content[section]}`, {visible: true});
      await assertNoOverflow(`bank service ${section}`);
    } else if (id === 'office' && section === 'accounting') {
      await page.waitForSelector('[data-staff-accounting] [data-guide-invoices-tab][aria-pressed="true"]', {visible: true});
      await page.waitForSelector('[data-staff-accounting] [data-guide-finances-ready]', {visible: true});
    } else if (id === 'office') {
      await page.waitForSelector(`[data-staff-tab="${section}"][aria-selected="true"]`, {visible: true});
      await page.waitForSelector(`[data-staff-panel="${section}"]`, {visible: true});
    }
  };
  const keyActivate = async (selector, visibleFocus = false) => {
    await page.waitForSelector(selector, {visible: true});
    if (visibleFocus) await page.keyboard.press('Tab');
    await page.focus(selector);
    assert.equal(await page.$eval(selector, node => node === document.activeElement), true, selector);
    if (visibleFocus) {
      assert.equal(await page.$eval(selector, node => {
        const style = getComputedStyle(node);
        return node.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      }), true, `${selector} has a visible keyboard focus outline`);
    }
    await page.keyboard.press('Enter');
  };
  const openVillageBuilding = async (id, query) => {
    const closeBubble = `${activityBubble} button`;
    if (await page.$(closeBubble)) await keyActivate(closeBubble);
    await keyActivate(`[data-village-building="${id}"]`);
    const entry = await page.waitForSelector(`${activityBubble}[data-building="${id}"] nav a`, {visible: true});
    assert.deepEqual(await entry.evaluate(node => ({
      label: node.textContent.trim(),
      href: node.getAttribute('href'),
      subtitle: Boolean(node.querySelector('small')),
    })), {label: 'Entrer', href: `${path}?${query}`, subtitle: false}, `${id}: the first link opens the building`);
    if (id === 'bank' || id === 'office') {
      const activities = roomActivities[id];
      const shortcuts = id === 'bank' ? Object.values(activities) : [activities.team, activities.accounts];
      assert.deepEqual(await page.$$eval(`${activityBubble} nav a`, nodes => nodes.map(node => node.search.slice(1))), [query, ...shortcuts]);
    }
  };
  const enterFromVillage = async id => {
    await openVillageBuilding(id, roomQuery(id));
    await keyActivate(`${activityBubble} ${link(roomQuery(id))}`);
    await assertQuery(roomQuery(id));
  };
  const checkBackToRoom = async (id, input = 'keyboard') => {
    const back = id === 'bank' ? bankReturnLink : `${activityPanel} ${link(roomQuery(id))}[aria-label]`;
    if (input === 'touch') await page.tap(back);
    else if (input === 'mouse') await click(back);
    else if (id === 'bank') {
      await page.focus(`${activityPanel} > header h1`);
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      assert.equal(await page.$eval(back, node => node === document.activeElement && node.matches(':focus-visible')), true);
      await page.keyboard.press('Enter');
    } else await keyActivate(back);
    await assertQuery(roomQuery(id));
    await page.waitForSelector(roomSelector(id), {visible: true});
    if (id === 'bank') {
      const params = new URL(page.url()).searchParams;
      params.delete('world');
      assert.deepEqual(Object.fromEntries(params), {view: 'hub', room: 'bank'});
    }
  };
  const exitRoom = async id => {
    await keyActivate(`${roomSelector(id)} ${link('view=hub')}`);
    await page.waitForSelector(roomSelector(id), {hidden: true});
    assert.equal(new URL(page.url()).searchParams.has('room'), false);
  };
  const checkRoom = async (id, activities) => {
    const room = roomSelector(id);
    await page.waitForSelector(room, {visible: true});
    await assertNoOverflow(`${id} room`);
    assert.deepEqual(await page.$$eval(`${room} [data-building-object]`, nodes => nodes.map(node => node.dataset.buildingObject).sort()), Object.keys(activities).sort());
    for (const [object, query] of Object.entries(activities)) {
      const destination = `${room} ${link(fromRoom(id, query))}[data-building-object="${object}"]`;
      await page.waitForSelector(destination, {visible: true});
      assert.equal(await page.$eval(destination, node => node.tabIndex), 0);
    }
    return room;
  };
  const furniturePoints = async (room, objects) => {
    const selector = `${room} ${liveCanvas}`;
    await page.waitForSelector(selector, {visible: true});
    const points = await page.$eval(selector, (node, objects) => {
      node.scrollIntoView({block: 'center', behavior: 'instant'});
      const bounds = node.getBoundingClientRect();
      const scene = node.closest('[data-building-room]');
      const samples = new Map(objects.map(id => [id, []]));
      const columns = 34, rows = 26;
      // Sample real projected surfaces before issuing a native click or tap.
      // The raycast's public hover state identifies the furniture beneath each point.
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const x = Math.round(bounds.left + bounds.width * (col + .5) / columns);
          const y = Math.round(bounds.top + bounds.height * (row + .5) / rows);
          if (document.elementFromPoint(x, y) !== node) continue;
          node.dispatchEvent(new PointerEvent('pointermove', {pointerType: 'mouse', clientX: x, clientY: y}));
          samples.get(scene.dataset.roomHover)?.push([(x - bounds.left) / bounds.width, (y - bounds.top) / bounds.height]);
        }
      }
      node.dispatchEvent(new PointerEvent('pointerleave', {pointerType: 'mouse'}));
      const result = {};
      for (const [id, points] of samples) {
        if (!points.length) continue;
        const centre = points.reduce(([x, y], [a, b]) => [x + a / points.length, y + b / points.length], [0, 0]);
        const distance = ([x, y]) => Math.hypot(x - centre[0], y - centre[1]);
        result[id] = points.sort((a, b) => distance(a) - distance(b))[0];
      }
      return result;
    }, objects);
    assert.deepEqual(Object.keys(points), objects, `${room} exposes a canvas hit for each object`);
    return points;
  };
  const activateFurniture = async (room, object, coordinates, touch = false) => {
    const selector = `${room} ${liveCanvas}`;
    const point = await page.$eval(selector, (node, {coordinates: [horizontal, vertical], object}) => {
      node.scrollIntoView({block: 'center', behavior: 'instant'});
      const bounds = node.getBoundingClientRect();
      const x = bounds.left + bounds.width * horizontal, y = bounds.top + bounds.height * vertical;
      if (document.elementFromPoint(x, y) !== node) throw Error('Canvas furniture is covered');
      node.dispatchEvent(new PointerEvent('pointermove', {pointerType: 'mouse', clientX: x, clientY: y}));
      const hovered = node.closest('[data-building-room]').dataset.roomHover;
      if (hovered !== object) throw Error(`Canvas point for ${object} hits ${hovered || 'nothing'} after returning to the room`);
      return {x, y};
    }, {coordinates, object});
    if (touch) {
      await page.touchscreen.tap(point.x, point.y);
    } else {
      await page.mouse.move(point.x, point.y);
      await page.waitForSelector(`${room}[data-room-hover="${object}"]`, {timeout: 5000});
      await page.mouse.click(point.x, point.y);
    }
  };
  const visitFurniture = async (id, room, activities, touch = false) => {
    const points = await furniturePoints(room, Object.keys(activities));
    for (const [object, query] of Object.entries(activities)) {
      await page.waitForSelector(`${room} ${liveCanvas}`, {visible: true});
      await activateFurniture(room, object, points[object], touch);
      const destination = fromRoom(id, query);
      await assertActivity(id, destination);
      if ((object === 'bank' || object === 'accounts') && [320,1440].includes(page.viewport().width)) {
        await page.screenshot({path: resolve(screenshotDir, `${id}-${object === 'bank' ? 'loans' : 'accounting'}-${page.viewport().width}.png`)});
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const params = new URL(page.url()).searchParams;
      params.delete('world');
      assert.deepEqual(Object.fromEntries(params), Object.fromEntries(new URLSearchParams(destination)), `${object} keeps its exact destination after the pointer event sequence`);
      await checkBackToRoom(id, id === 'bank' ? (touch ? 'touch' : 'mouse') : 'keyboard');
    }
    return Object.keys(points);
  };
  const visitFurnitureByKeyboard = async (id, room, activities) => {
    for (const [object, query] of Object.entries(activities)) {
      const destination = fromRoom(id, query);
      await keyActivate(`${room} ${link(destination)}[data-building-object="${object}"]`, true);
      await assertActivity(id, destination);
      if (page.viewport().width === 1440 && object === 'accounts') {
        const department = name => `[data-staff-department="${name}"]`;
        await keyActivate(department('team'));
        await assertActivity(id, fromRoom(id, activities.team));
        assert.equal(await page.$eval(department('team'), node => node.getAttribute('aria-pressed')), 'true');
        await keyActivate(department('accounting'));
        await assertActivity(id, destination);
        await page.goBack();
        await assertActivity(id, fromRoom(id, activities.team));
        await page.goForward();
        await assertActivity(id, destination);
        assert.equal(await page.$eval(department('accounting'), node => node.getAttribute('aria-pressed')), 'true');
        results.push({scenario: 'staff-department-history', width: 1440, sections: ['accounting','team','accounting'], backForward: true});
      }
      await checkBackToRoom(id);
    }
    return Object.keys(activities);
  };

  await page.setViewport({width: 1440, height: 1000, deviceScaleFactor: 1});
  await visit('starter');
  await page.waitForSelector('canvas[data-village-ready="true"]');
  if (!bankOfficeOnly) {
    await openVillageBuilding('warehouse', 'view=workshop');
    await openVillageBuilding('collection', 'view=school');
  }
  for (const [id, activities] of rooms) {
    await enterFromVillage(id);
    const room = await checkRoom(id, activities);
    const canvas = await page.waitForSelector(`${room} ${liveCanvas}`, {visible: true});
    await canvas.screenshot({path: resolve(screenshotDir, `${id}.png`)});
    const query = fromRoom(id, Object.values(activities)[0]);
    await keyActivate(`${room} ${link(query)}`, true);
    await assertActivity(id, query);
    await page.waitForSelector(activityPanel, {visible: true});
    assert.equal(new URL(page.url()).searchParams.has('room'), false);
    await page.goBack();
    await assertQuery(roomQuery(id));
    await checkRoom(id, activities);
    await page.goForward();
    await assertActivity(id, query);
    await checkBackToRoom(id);
    if (id === 'bank') {
      await exitRoom(id);
      await click('button[aria-label="Ouvrir le menu du quartier"]');
      await click('dialog[open] [data-placard-nav="treasury"]');
      await assertQuery(roomQuery(id));
      assert.equal(new URL(page.url()).searchParams.has('fromRoom'), false);
    }
    await page.waitForSelector(`${room} ${liveCanvas}`, {visible: true});
    if (id === 'bank') {
      assert.equal(await page.$eval(`${room} ${liveCanvas}`, node => {
        const loseContext = node.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        loseContext?.loseContext();
        window.__restoreRoomContext = () => loseContext?.restoreContext();
        return Boolean(loseContext);
      }), true, 'WebGL context loss triggered by the browser extension');
      await page.waitForSelector(`${room} ${liveCanvas}`, {hidden: true});
      await checkRoom(id, activities);
      await page.evaluate(() => window.__restoreRoomContext());
      await page.waitForSelector(`${room} ${liveCanvas}`, {visible: true});
      await page.screenshot({path: resolve(screenshotDir, 'bank-desktop-page.png')});
    }
    const furnitureClicked = await visitFurniture(id, room, activities);
    const keyboardFurniture = await visitFurnitureByKeyboard(id, room, activities);
    results.push({scenario: 'isometric-building-room', room: id, width: 1440, village: true, activities, history: true, activityEntry: true, contextRestored: id === 'bank', furnitureClicked, keyboardFurniture, visibleFocus: true});
    await exitRoom(id);
  }

  for (const [width, height] of [[320, 568], [844, 390]]) {
    await page.setViewport({width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 2});
    await visit('starter', roomQuery('bank'));
    for (const [id, activities] of rooms) {
      if (id !== 'bank') await enterFromVillage(id);
      const room = await checkRoom(id, activities);
      await page.waitForSelector(`${room} ${liveCanvas}`, {visible: true});
      if (id === 'bank' || id === 'office') {
        await page.screenshot({path: resolve(screenshotDir, `${id}-${width === 320 ? 'mobile' : 'landscape'}-page.png`)});
      }
      const furnitureTapped = await visitFurniture(id, room, activities, true);
      results.push({scenario: 'isometric-building-room', room: id, width, height, liveWebGL: true, furnitureTapped});
      await exitRoom(id);
    }
  }

  for (const width of [320, 1440]) {
    await page.setViewport({width, height: width === 320 ? 568 : 1000, isMobile: width === 320, hasTouch: width === 320});
    for (const query of Object.values(roomActivities.bank)) {
      await visit('starter', query);
      assert.equal(new URL(page.url()).searchParams.has('fromRoom'), false);
      await assertActivity('bank', query);
      await checkBackToRoom('bank', width === 320 ? 'touch' : 'keyboard');
    }
    results.push({scenario: 'bank-direct-services', width, services: ['loans', 'savings', 'stocks', 'crypto'], returnToBank: true});
  }

  const noWebGL = await page.evaluateOnNewDocument(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (context, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(context)) return null;
      return getContext.call(this, context, ...args);
    };
  });
  try {
    await page.setViewport({width: 320, height: 568, isMobile: true, hasTouch: true, deviceScaleFactor: 2});
    await visit('starter');
    await page.waitForSelector('[data-village-unavailable]', {visible: true});
    for (const [id, activities] of rooms) {
      await enterFromVillage(id);
      let room = await checkRoom(id, activities);
      if (id === 'bank') {
        await page.reload({waitUntil: 'networkidle0'});
        await assertQuery(roomQuery(id));
        room = await checkRoom(id, activities);
      }
      assert.equal(await page.$(`${room} ${liveCanvas}`), null);
      assert.equal(await page.$eval(`${room} [style*="/placard/building-rooms/"]`, async (node, id) => {
        const background = getComputedStyle(node).backgroundImage.match(/^url\("(.*)"\)$/)?.[1];
        if (!background) return false;
        const image = new Image();
        image.src = new URL(background, location.href).href;
        await image.decode();
        return node.checkVisibility() && new URL(image.src).pathname === `/placard/building-rooms/${id}.webp` && image.naturalWidth > 0;
      }, id), true, `${id}: static room poster is available`);
      const keyboardFurniture = await visitFurnitureByKeyboard(id, room, activities);
      results.push({scenario: 'isometric-building-room-without-webgl', room: id, width: 320, keyboardFurniture, visibleFocus: true, reload: id === 'bank', activities, activityBack: true});
      await exitRoom(id);
    }
  } finally {
    await page.removeScriptToEvaluateOnNewDocument(noWebGL.identifier);
  }
}
