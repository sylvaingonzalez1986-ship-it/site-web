import assert from 'node:assert/strict';

const support = '[data-financial-support]';
const panel = '[data-producer-support-panel]';
const receipt = '[data-support-return]';
const district = 'canvas[data-village-ready="true"]';
const farm = '[data-village-building="hemp-farm"]';
const amount = support + ' input[name="amount"]';
const submit = support + ' button[type="submit"]';
const officialBitcoin = panel + ' ' + support + ' a[href="https://www.leschanvriersbretons.com/soutenir"]';

async function viewAtFarm(page) {
  return page.evaluate(async district => {
    const { fiberRoots, Vector3 } = await import('/@id/__x00__support-audit-scene');
    const canvas = document.querySelector(district);
    const { camera, scene } = fiberRoots.get(canvas).store.getState();
    const farmCollider = scene.getObjectByName('village-hemp-farm-collider');
    const point = farmCollider?.getWorldPosition(new Vector3());
    if (point) { point.y += 1.65; point.project(camera); }
    const bounds = canvas.getBoundingClientRect();
    return {
      point: point ? { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2 } : null,
      position: camera.position.toArray(), rotation: camera.quaternion.toArray(), zoom: camera.zoom,
    };
  }, district);
}

function assertSameView(before, after) {
  for (const key of ['position', 'rotation']) {
    assert.ok(before[key].every((value, i) => Math.abs(value - after[key][i]) < 0.001), 'Camera ' + key + ' is preserved');
  }
  assert.ok(Math.abs(before.zoom - after.zoom) < 0.001, 'Camera zoom is preserved');
}

export async function auditSupportCampaign({ page, load, button, keyClick, screenshot, layout, fixture, results, mockSupportRedirect }) {
  const shortcuts = '[aria-label="Les bâtiments du village"]';
  const waitText = (selector, pattern) => page.waitForFunction((selector, source, flags) =>
    new RegExp(source, flags).test(document.querySelector(selector)?.textContent ?? ''), {}, selector, pattern.source, pattern.flags);
  const calls = () => page.evaluate(() => window.__calls.filter(call => call.method !== 'GET'));
  const openPanel = () => page.waitForSelector(panel + ' ' + support, { visible: true });
  const focusFarm = () => page.waitForFunction(selector => document.querySelector(selector) === document.activeElement, {}, farm);
  const setAmount = async value => {
    await page.focus(amount);
    await page.keyboard.press('Home');
    await page.keyboard.down('Shift');
    await page.keyboard.press('End');
    await page.keyboard.up('Shift');
    await page.keyboard.type(value);
  };
  const settle = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const openFromModel = async input => {
    const { point } = await viewAtFarm(page);
    assert.ok(point, 'The farm collider is present');
    assert.ok(await page.evaluate(({ x, y }, selector) => document.elementFromPoint(x, y) === document.querySelector(selector), point, district),
      'The farm silhouette is on screen and clear of the village controls');
    if (input === 'touch') await page.touchscreen.tap(point.x, point.y);
    else {
      await page.mouse.move(point.x, point.y);
      await page.waitForFunction(district => document.querySelector(district).style.cursor === 'pointer', {}, district);
      await page.mouse.click(point.x, point.y);
    }
    await openPanel();
  };

  await load('financial-support-default', 1440, 'view=hub&villageDay=1&villageMinute=720');
  await page.waitForSelector(district);
  await page.waitForSelector(shortcuts + ' ' + farm + '[data-offscreen="false"]');
  assert.equal(await page.$(support), null);
  await keyClick('[aria-label="Ouvrir le bilan de ma partie"]');
  await page.waitForSelector('[data-village-activity-panel] [data-placard-lobby]', { visible: true });
  assert.equal(await page.$(support), null, 'The overview does not duplicate support');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-village-activity-panel]', { hidden: true });
  const teamClose = await page.$('[data-team-close][aria-label="Replier mon équipe"]');
  if (teamClose) await teamClose.click();
  await page.click('[aria-label="Recentrer la vue isométrique"]');
  await settle();
  await screenshot('ferme-continent-printemps-1440');
  const desktopView = await viewAtFarm(page);
  const desktopProduction = (await fixture()).production;
  await openFromModel('pointer');
  await page.waitForFunction(() => document.activeElement === document.querySelector('[data-producer-support-panel] h1'));
  assert.equal(new URL(page.url()).searchParams.get('villageMinute'), '720');
  await waitText(support, /150,00/);
  await page.waitForFunction(selector => document.querySelector(selector + ' input[name="pseudonym"]')?.value === 'Breton29', {}, support);
  assert.equal(await page.$$eval(support + ' [role="meter"]', nodes => nodes.length), 1);
  assert.equal(await page.$$eval(support + ' li', nodes => nodes.length), 2);
  await screenshot('soutien-1440');
  await button('Voir les soutiens précédents', support);
  await page.waitForFunction(selector => document.querySelectorAll(selector + ' li').length === 3, {}, support);
  await page.keyboard.press('Escape');
  await page.waitForSelector(panel, { hidden: true });
  await focusFarm();
  await settle();
  assertSameView(desktopView, await viewAtFarm(page));
  await page.keyboard.press('Enter');
  await openPanel();
  await page.goBack();
  await page.waitForSelector(panel, { hidden: true });
  await focusFarm();
  assert.deepEqual((await fixture()).production, desktopProduction);
  assert.deepEqual(await calls(), []);
  results.push({ scenario: 'carte continentale, survol, clic, clavier, Échap et retour navigateur', width: 1440, cameraPreserved: true, gameMutations: 0 });

  for (const [season, day, minute, phase] of [['summer', 91, 390, 'dawn'], ['autumn', 181, 1170, 'dusk']]) {
    await page.evaluate(({ day, minute }) => {
      const url = new URL(location.href);
      url.searchParams.set('villageDay', String(day)); url.searchParams.set('villageMinute', String(minute));
      history.replaceState(history.state, '', url); window.dispatchEvent(new PopStateEvent('popstate'));
    }, { day, minute });
    await page.waitForSelector('[data-village-season="' + season + '"][data-village-phase="' + phase + '"]');
    await screenshot('ferme-continent-' + season + '-1440');
  }
  await load('financial-support-default', 320, 'view=hub&villageDay=271&villageMinute=1380');
  await page.waitForSelector(district);
  await page.waitForSelector('[data-village-season="winter"][data-village-phase="night"]');
  await screenshot('ferme-continent-nuit-320');
  await openFromModel('touch');
  await waitText(support, /Moyen de paiement/);
  await page.focus(submit);
  await screenshot('soutien-320');
  const formFits = await page.$eval(submit, node => {
    const bounds = node.getBoundingClientRect(), container = node.closest('[data-producer-support-panel]');
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return node.contains(hit) && bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= container.getBoundingClientRect().bottom && container.scrollWidth <= container.clientWidth + 1;
  });
  assert.ok(formFits, 'Payment controls fit the narrow panel');
  await keyClick(support + ' a[href^="#"]');
  await page.waitForFunction(() => document.activeElement === document.querySelector('[data-support-presentation] h2'));
  const presentation = await page.$eval('[data-support-presentation]', node => node.textContent);
  assert.match(presentation, /la tréso, ça ne pousse pas sous les lampes/);
  assert.match(presentation, /les banques rangent le chéquier/);
  assert.match(presentation, /seulement si l’envie te prend et si tu peux/);
  await screenshot('appel-aux-dons-320');
  await layout();
  await button('Retour au Quartier', panel);
  await focusFarm();
  results.push({ scenario: 'printemps à midi, été à l’aube, automne le soir, hiver de nuit et toucher du modèle', mobile: 320, noOverflow: true });

  for (const [provider, width] of [['viva', 1440], ['swiss-bitcoin-pay', 320]]) {
    await load('financial-support-default', width, 'view=hub&villageDay=1&villageMinute=720');
    await page.waitForSelector(district);
    await page.click('[aria-label="Agrandir le village"]');
    await page.click('[aria-label="Tourner à droite"]');
    await page.focus(farm);
    await settle();
    const beforeCheckout = await viewAtFarm(page);
    await page.keyboard.press('Enter');
    await openPanel();
    await page.waitForFunction(selector => document.querySelector(selector + ' input[name="pseudonym"]')?.value === 'Breton29', {}, support);
    if (provider === 'swiss-bitcoin-pay') {
      await page.focus(support + ' input[value="viva"]');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.$eval(support + ' input[name="provider"]:checked', node => node.value), provider);
    }
    await setAmount('2,005');
    await keyClick(submit);
    await waitText(support + ' [role="alert"]', /deux décimales/);
    assert.deepEqual(await calls(), []);
    await setAmount('2,50');
    await page.evaluate(() => { window.__holdSupportCheckout = true; });
    await page.$eval(support + ' form', form => {
      form.requestSubmit();
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => window.__supportPending.length === 1);
    await waitText(support, /Création de la session de paiement/);
    const [checkout, ...extra] = await calls();
    assert.equal(extra.length, 0, 'Double-submit produces one attempt');
    assert.equal(checkout.path, '/api/support/checkout');
    assert.equal(checkout.body.amountCents, 250);
    assert.equal(checkout.body.provider, provider);
    assert.equal(checkout.body.publishName, false);
    assert.equal(checkout.body.publishAmount, false);
    mockSupportRedirect(provider, checkout.body.id);
    const openInvoice = support + ' a[href^="https://app.swiss-bitcoin-pay.ch/invoice/"]';
    if (provider === 'swiss-bitcoin-pay') {
      await page.evaluate(() => window.__supportPending.shift()());
      await waitText(openInvoice, /Ouvrir Swiss Bitcoin Pay/);
      assert.equal((await calls()).length, 1);
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      provider === 'swiss-bitcoin-pay' ? keyClick(openInvoice) : page.evaluate(() => window.__supportPending.shift()()),
    ]);
    await page.waitForSelector(receipt, { visible: true });
    await waitText(receipt, /En attente de confirmation/);
    assert.doesNotMatch(await page.$eval(receipt + ' h1', node => node.textContent), /Merci/);
    const statusRequest = (await calls()).find(call => call.path === '/api/support/status');
    assert.equal(statusRequest.body.id, checkout.body.id);
    assert.equal(statusRequest.body.token, checkout.body.token);
    assert.equal(typeof statusRequest.body.transactionId === 'string', provider === 'viva');
    assert.equal(statusRequest.body.orderCode, provider === 'viva' ? '987654321012345678' : undefined);
    assert.equal(new URL(page.url()).searchParams.has('token'), false);
    await page.evaluate(() => { window.__supportStatusFailure = true; });
    await button('Vérifier à nouveau', receipt);
    await waitText(receipt + ' [role="alert"]', /momentanément indisponible/);
    await page.evaluate(() => { window.__supportStatusFailure = false; window.__supportState = 'paid'; });
    await button('Vérifier à nouveau', receipt);
    await waitText(receipt + ' h1', /Merci pour ton soutien/);
    await waitText(receipt, /2,50/);
    assert.ok((await calls()).every(call => call.path === '/api/support/status' && call.body.id === checkout.body.id));
    await screenshot('soutien-confirme-' + provider + '-' + width);
    const returnLink = receipt + ' a[href^="/arene/placard"]';
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      keyClick(returnLink),
    ]);
    await page.waitForSelector(district);
    assert.equal(new URL(page.url()).searchParams.get('villageMinute'), '720');
    assert.equal(new URL(page.url()).searchParams.has('support'), false);
    await settle();
    assertSameView(beforeCheckout, await viewAtFarm(page));
    assert.deepEqual(await calls(), []);
    results.push({ scenario: 'paiement simulé ' + provider, width, oneAttempt: true, serverConfirmationRequired: true, retrySameId: true, returnCameraPreserved: true });
  }

  for (const [provider, terminal, message] of [['viva', 'cancelled', /a été annulée/], ['swiss-bitcoin-pay', 'expired', /a expiré/]]) {
    await load('financial-support-default', 390, 'view=hub&support=1');
    await openPanel();
    await page.waitForFunction(selector => document.querySelector(selector + ' input[name="pseudonym"]')?.value === 'Breton29', {}, support);
    if (provider !== 'viva') await page.click(support + ' label:has(input[value="' + provider + '"])');
    await page.evaluate(() => { window.__supportCheckoutState = 'uncertain'; });
    await keyClick(submit);
    await waitText(support, /évite un second versement/);
    const [checkout] = await calls();
    assert.equal(checkout.body.provider, provider);
    if (terminal === 'cancelled') {
      await page.evaluate(() => { window.__supportState = 'ready'; });
      await button('Vérifier mon paiement', support);
      await button('Annuler cette session', support);
    } else {
      await page.evaluate(() => { window.__supportState = 'expired'; });
      await button('Vérifier mon paiement', support);
    }
    await waitText(support, message);
    assert.equal((await calls()).filter(call => call.path === '/api/support/checkout').length, 1);
    assert.ok((await calls()).every(call => call.body.id === checkout.body.id));
    await button('Préparer une nouvelle contribution', support);
    await page.waitForSelector(submit, { visible: true });
    results.push({ scenario: terminal, provider, originalAttemptTracked: true });
  }

  for (const scenario of ['viva-only', 'no-providers']) {
    await load('financial-support-' + scenario, 320, 'view=hub');
    await keyClick(farm);
    await openPanel();
    await page.waitForSelector(officialBitcoin, { visible: true });
    const link = await page.$eval(officialBitcoin, node => {
      // Exercise keyboard activation while keeping the real merchant site outside this fixture.
      node.addEventListener('click', event => {
        event.preventDefault();
        node.dataset.auditActivated = 'true';
      }, { once: true });
      return { text: node.innerText, target: node.target };
    });
    assert.match(link.text, /Bitcoin Lightning\s*Formulaire officiel/i);
    assert.equal(link.target, '_blank');
    assert.equal(Boolean(await page.$(submit)), scenario === 'viva-only');
    if (scenario === 'viva-only') {
      assert.equal(await page.$eval(support + ' input[name="provider"]:checked', node => node.value), 'viva');
    }
    await keyClick(officialBitcoin);
    assert.equal(await page.$eval(officialBitcoin, node => node.dataset.auditActivated), 'true');
    assert.deepEqual(await calls(), []);
    results.push({ scenario, width: 320, officialBitcoinForm: true, localPaymentRequests: 0 });
  }

  for (const [scenario, expected] of [['error', /momentanément indisponible/], ['malformed', /momentanément indisponible/], ['review', /Total en cours de vérification/], ['no-goal', /150,00/], ['closed', /actuellement fermées/]]) {
    await load('financial-support-' + scenario, 320, 'view=hub&support=1');
    await openPanel();
    await waitText(support, expected);
    assert.equal(Boolean(await page.$(support + ' [role="meter"]')), scenario === 'closed');
    if (['error', 'malformed', 'closed'].includes(scenario)) assert.equal(await page.$(submit), null);
    if (scenario === 'closed') assert.equal(await page.$(officialBitcoin), null);
    if (['error', 'malformed'].includes(scenario)) assert.doesNotMatch(await page.$eval(support, node => node.textContent), /0,00/);
    await layout();
    results.push({ scenario, truthfulSummary: true });
  }
  await load('financial-support-tutorial', 390, 'view=hub&support=1');
  await page.waitForSelector('dialog[data-sylvain-library][open]', { visible: true });
  await button('Commencer avec Loïc', 'dialog[data-sylvain-library][open]');
  await page.waitForSelector('[data-sylvain-guide][data-mode="active"]', { visible: true });
  assert.equal(await page.$(panel), null);
  results.push({ scenario: 'guide actif', supportAbsent: true });
  await load('financial-support-standalone', 320);
  await page.waitForSelector(support + ' h1', { visible: true });
  await page.waitForSelector(submit, { visible: true });
  await layout();
  results.push({ scenario: 'lien public /soutenir', formAvailable: true });

  await load('financial-support-return-wrong', 320, 'support=33333333-3333-4333-8333-333333333333&success=true');
  await waitText(receipt + ' [role="alert"]', /introuvable/);
  assert.doesNotMatch(await page.$eval(receipt + ' h1', node => node.textContent), /Merci/);
  assert.deepEqual(await calls(), []);
  await load('financial-support-return-legacy', 320, 'success=true');
  await waitText(receipt, /Préparation du paiement en cours/);
  assert.doesNotMatch(await page.$eval(receipt + ' h1', node => node.textContent), /Merci/);
  assert.ok((await calls()).every(call => call.path === '/api/support/status'));
  await load('financial-support-return-legacy', 320, 's=123456789012345678&success=true');
  await waitText(receipt + ' [role="alert"]', /ne correspond pas à ta fiche/);
  assert.doesNotMatch(await page.$eval(receipt + ' h1', node => node.textContent), /Merci/);
  results.push({ scenario: 'identifiant étranger et retour forcé', successIgnored: true, legacyVivaSupported: true, wrongOrderRejected: true });

  for (const width of [320, 1440]) {
    await load('financial-support-admin', width);
    await waitText('body', /Registre des soutiens/);
    assert.match(await page.$eval('body', node => node.textContent), /À compléter/);
    await keyClick('details > summary');
    await page.type('details input[inputmode="decimal"]', '0,31');
    await page.type('details input[maxlength="200"]', 'RELEVE-11');
    await button('Enregistrer les frais');
    await page.waitForFunction(() => window.__calls.some(call => call.body?.action === 'fees'));
    const fees = await page.evaluate(() => window.__calls.find(call => call.body?.action === 'fees').body);
    assert.equal(fees.feesCents, 31);
    assert.equal(fees.reference, 'RELEVE-11');
    await waitText('body', /9,69/);
    await keyClick('details:nth-of-type(2) > summary');
    await waitText('details:nth-of-type(2)[open]', /Facture Swiss Bitcoin Pay/);
    assert.match(await page.$eval('details:nth-of-type(2) summary', node => node.textContent), /Lightning.*Session expirée/);
    assert.match(await page.$eval('a[download]', node => node.href), /\/api\/admin\/support\?.*format=csv/);
    await layout();
    results.push({ width, scenario: 'registre administratif', feesUnknownUntilEntered: true, exportAvailable: true });
  }
}
