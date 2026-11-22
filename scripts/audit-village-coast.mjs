import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const scene = '[data-village-prototype] canvas[data-village-ready="true"]';
const menu = 'button[aria-label="Ouvrir le menu du quartier"]';
const overview = 'button[aria-label="Ouvrir le bilan de ma partie"]';
const observer = 'details:has([data-observe-life]) > summary';
const team = '[data-village-prototype] > [data-team-panel]';
const sizes = [['bureau', 1440, 900], ['portrait', 390, 844], ['paysage', 844, 390], ['petit', 320, 568]];

async function settled(page) {
  await page.waitForFunction(selector => {
    const canvas = document.querySelector(selector);
    return canvas?.dataset.cameraTransition === 'idle' && Math.abs(canvas.clientWidth - innerWidth) <= 1;
  }, { timeout: 90000 }, scene);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function auditCoastCorner({page, visit, results, baseline, output}) {
  const width = 1600, height = 1100;
  const variant = baseline ? 'avant' : 'apres';
  await page.setViewport({width, height, deviceScaleFactor: 1});
  await visit('starter', 'world=3d&entryGate=1');
  await settled(page);
  const collapse = `${team} [data-team-close]`;
  if (await page.$(collapse)) await page.click(collapse);
  const capture = view => page.screenshot({path: resolve(output, `coin-littoral-${view}-${variant}.png`)});
  const landmarkSpan = () => page.evaluate(() => {
    const positions = ['warehouse', 'shop'].map(id => {
      const label = document.querySelector(`[data-village-building="${id}"]`);
      const matrix = new DOMMatrixReadOnly(getComputedStyle(label).transform);
      return [matrix.e, matrix.f];
    });
    return Math.hypot(positions[0][0] - positions[1][0], positions[0][1] - positions[1][1]);
  });
  const x = width * .8, y = height * .45;
  await page.mouse.move(x, y);
  assert(await page.evaluate(({scene, x, y}) => document.elementFromPoint(x, y) === document.querySelector(scene), {scene, x, y}));
  await capture('ouverture');
  const openingSpan = await landmarkSpan();
  await page.mouse.wheel({deltaY: 12000});
  await settled(page);
  const minimumSpan = await landmarkSpan();
  assert(minimumSpan < openingSpan * .25, 'The wheel must shrink the projected village');
  await page.mouse.wheel({deltaY: 1500});
  await settled(page);
  assert(Math.abs(await landmarkSpan() - minimumSpan) < .1, 'A further outward wheel step must leave the scale unchanged');
  await capture('dezoom');
  // Raise the camera with the same orbit gesture as the player so all four corners fit.
  await page.mouse.down();
  await page.mouse.move(x, y + 220, {steps: 12});
  await page.mouse.up();
  await settled(page);
  await capture('vue-haute');
  results.push({scenario: 'littoral-coin-dezoom-maximal', width, height, openingSpan, minimumSpan});
}

export async function auditVillageCoast({page, visit, results, baseline, output, corner}) {
  if (corner) return auditCoastCorner({page, visit, results, baseline, output});
  const variant = baseline ? 'avant' : 'apres';
  const cdp = await page.createCDPSession();
  for (const [device, width, height] of sizes) {
    const mobile = device !== 'bureau';
    await page.setViewport({width, height, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, isLandscape: width > height});
    // Portrait and landscape share the mounted game during rotation.
    if (device === 'bureau' || device === 'portrait') await visit('starter', 'world=3d&entryGate=1');
    await settled(page);
    await page.click('[aria-label="Recentrer la vue isométrique"]');
    await page.mouse.move(width * .53, 5);
    await settled(page);
    const collapseTeam = `${team} [data-team-close]`;
    if (await page.$(collapseTeam)) await page.click(collapseTeam);
    await page.waitForSelector(`${team} [data-team-open]`);
    await page.screenshot({path: resolve(output, `littoral-${device}-${variant}.png`)});
    const layout = await page.evaluate(({scene, controls}) => {
      const canvas = document.querySelector(scene);
      const box = canvas.getBoundingClientRect();
      return {
        top: box.top, width: box.width, height: box.height, viewport: [innerWidth,innerHeight],
        buffer: [canvas.width, canvas.height],
        drawCalls: Number(canvas.dataset.drawCalls), triangles: Number(canvas.dataset.triangles),
        controls: controls.map(selector => {
          const node = document.querySelector(selector), r = node.getBoundingClientRect();
          return {selector, width: r.width, height: r.height, hit: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))};
        }),
        seaReceivesPointer: document.elementFromPoint(innerWidth*.53, 5) === canvas,
      };
    }, {scene, controls: [menu,overview,observer, `${team} [data-team-open]`]});
    results.push({scenario:'littoral-' + device, device, ...layout});
    if (baseline) continue;
    assert.equal(layout.top, 0, device + ' canvas reaches the top');
    assert.equal(layout.height, height);
    assert.equal(layout.width, width);
    assert(Math.abs(layout.buffer[0] / layout.buffer[1] - width / height) < .01);
    assert.equal(layout.seaReceivesPointer, true);
    for (const control of layout.controls) {
      assert(control.hit && control.height >= 44 && control.width >= 44, device + ' ' + JSON.stringify(control));
    }
    if (device === 'paysage') {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', {insets:{left:44, right:34, bottom:21}});
      await page.waitForFunction(selector => document.querySelector(selector).getBoundingClientRect().left >= 44, {}, menu);
      assert(await page.$eval(`${team} [data-team-open]`, node => {
        const r = node.getBoundingClientRect();
        return innerWidth - r.right >= 34 && innerHeight - r.bottom >= 21;
      }));
      await page.screenshot({path: resolve(output, 'littoral-paysage-encoche.png')});
    }
    await page.click(menu);
    await page.waitForSelector('dialog[open][aria-label="Menu de Kanab Quest"]');
    await page.keyboard.press('Escape');
    await page.click(observer);
    const fisherman = '[data-observe-life="fisherman"]';
    await page.waitForSelector(fisherman, {visible:true});
    await page.click(fisherman);
    await page.waitForSelector('canvas[data-life-observe="fisherman"]');
    await page.click('[aria-label="Recentrer la vue isométrique"]');
    await page.click(overview);
    await page.waitForSelector('[data-village-activity-panel]', {visible:true});
    if (device === 'paysage') await page.screenshot({path: resolve(output, 'littoral-paysage-bilan.png')});
    await page.click('[aria-label="Revenir au village 3D"]');
    await page.waitForSelector('[data-village-activity-panel]', {hidden:true});
    await page.waitForSelector(team);
    if (await page.$(collapseTeam)) await page.click(collapseTeam);
    await page.waitForSelector(`${team} [data-team-open]`, {visible:true});
    await page.click(`${team} [data-team-open]`);
    await page.waitForSelector(`${team} [data-team-close]`, {visible:true});
    if (device === 'paysage') await page.screenshot({path: resolve(output, 'littoral-paysage-equipe.png')});
    await page.click(collapseTeam);
    await page.focus('[data-village-building="warehouse"]');
    await page.keyboard.press('Enter');
    const active = '#village-building-activities';
    await page.waitForSelector(active + '[data-positioned]');
    for (const selector of [active + ' button', active + ' a']) {
      assert(await page.$eval(selector, node => {
        const r = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), device + ' building action covered: ' + selector);
    }
    await page.click(active + ' button');
    if (device === 'paysage') await cdp.send('Emulation.setSafeAreaInsetsOverride', {insets:{}});
    await page.click('[aria-label="Tourner à droite"]');
    await settled(page);
    if (device === 'bureau') await page.screenshot({path: resolve(output, 'littoral-rotation.png')});
    await page.click('[aria-label="Recentrer la vue isométrique"]');
    await settled(page);
  }
  if (baseline) return;
  await page.evaluate(() => document.addEventListener('keydown', () => {
    document.querySelector('[data-village-prototype]').requestFullscreen();
  }, {once: true}));
  await page.keyboard.press('f');
  await page.waitForFunction(() => !!document.fullscreenElement);
  await settled(page);
  assert(await page.$eval(scene, canvas => canvas.getBoundingClientRect().top === 0 && Math.abs(canvas.clientHeight - innerHeight) <= 1));
  await page.evaluate(() => document.exitFullscreen());
  results.push({fullscreen: true});
}
