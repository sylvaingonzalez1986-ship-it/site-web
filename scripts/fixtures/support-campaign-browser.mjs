import assert from 'node:assert/strict';

/** Uses the existing journey harness, real components and intercepted in-memory APIs. */
export async function auditSupportCampaign({ page, load, button, keyClick, screenshot, layout, fixture, results }) {
  const support = '[data-financial-support]';
  for (const width of [320, 390, 1440]) {
    await load('financial-support-default', width, 'view=hub');
    await page.waitForSelector(support + ' [role="meter"]');
    assert.match(await page.$eval(support, node => node.textContent), /150,00/);
    assert.match(await page.$eval(support + ' img', node => node.src), /producer-support/);
    assert.equal(await page.$$eval(support + ' li', nodes => nodes.length), 2);
    const before = (await fixture()).production.cashCents;
    await page.$eval(support, node => { node.style.scrollMarginTop = '80px'; node.scrollIntoView({ block: 'start', behavior: 'instant' }); });
    await screenshot('support-campaign-' + width);
    await button('Je soutiens', support);
    await page.waitForFunction(() => document.querySelector('[data-financial-support] input[name="pseudonym"]').value === 'Breton29');
    assert(await page.$eval(support + ' h3', node => node === document.activeElement));
    await page.focus(support + ' input[name="amount"]'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('2,50');
    await button('Voir les soutiens précédents', support);
    await page.waitForFunction(() => document.querySelectorAll('[data-financial-support] li').length === 3);
    assert.equal(await page.$$eval(support + ' li', nodes => nodes.length), 3);
    assert.equal(await page.$$eval(support + ' input[type="checkbox"]', nodes => nodes.filter(node => node.checked).length), 0);
    await page.$eval(support + ' input[type="checkbox"]', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.click(support + ' input[type="checkbox"]');
    await page.$eval(support + ' form', form => { form.requestSubmit(); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await page.waitForFunction(() => window.__calls.some(call => call.path === '/api/support/checkout'));
    const sent = await page.evaluate(() => window.__calls.filter(call => call.path === '/api/support/checkout'));
    assert.equal(sent.length, 1); assert.equal(sent[0].body.amountCents, 250); assert.equal(sent[0].body.pseudonym, 'Breton29');
    assert.equal(sent[0].body.publishName, true); assert.equal(sent[0].body.publishAmount, false); assert.equal(sent[0].body.token.length, 64);
    assert(await page.$eval(support + ' input[name="pseudonym"]', node => node.closest('fieldset').disabled));
    await page.evaluate(() => window.__supportPending.splice(0).forEach(done => done()));
    await page.waitForFunction(() => ![...document.querySelectorAll('[data-financial-support] button')].some(node => node.textContent.includes('Préparation…')));
    await layout(); await screenshot('support-form-' + width);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector(support + ' input[name="pseudonym"]');
    assert.equal(await page.$eval(support + ' input[name="amount"]', node => node.value), '2.5');
    assert.equal(await page.evaluate(() => window.__calls.filter(call => call.path === '/api/support/checkout').length), 0);
    assert.equal((await fixture()).production.cashCents, before);
    await button('Annuler cette session', support);
    await page.waitForFunction(() => document.querySelector('[data-financial-support]').textContent.includes('session de paiement a été annulée'));
    await button('Préparer une nouvelle fiche', support);
    assert.equal(await page.$eval(support + ' input[name="pseudonym"]', node => node.closest('fieldset').disabled), false);
    await button('Fermer la fiche', support);
    await page.waitForFunction(() => document.activeElement.textContent.trim() === 'Je soutiens');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Je soutiens');
    await layout();
    results.push({ width, checks: ['confirmed total', 'real objective', 'donor pagination', 'pseudo prefill', 'anonymous defaults', 'French decimals', 'single attempt for double submit', 'reload preserves form without new payment', 'cancellation', 'keyboard focus', 'no game writes', 'no overflow'] });
  }
  for (const scenario of ['financial-support-error', 'financial-support-malformed', 'financial-support-review', 'financial-support-no-goal', 'financial-support-closed']) {
    await load(scenario, 320, 'view=hub'); await page.waitForSelector(support);
    if (scenario.endsWith('error') || scenario.endsWith('malformed')) {
      await page.waitForSelector(support + ' [role="alert"]');
      assert(!/0,00/.test(await page.$eval(support, node => node.textContent)), 'Unavailable total is not zero');
    }
    if (scenario.endsWith('review')) { await page.waitForFunction(() => document.querySelector('[data-financial-support]').textContent.includes('Total en cours de vérification')); assert.equal(await page.$(support + ' [role="meter"]'), null); }
    if (scenario.endsWith('no-goal')) { await page.waitForFunction(() => document.querySelector('[data-financial-support]').textContent.includes('150,00')); assert.equal(await page.$(support + ' [role="meter"]'), null); }
    if (scenario.endsWith('closed')) { await page.waitForFunction(() => document.querySelector('[data-financial-support]').textContent.includes('actuellement fermées')); assert(await page.$$eval(support + ' button', nodes => nodes.find(node => node.textContent.trim() === 'Je soutiens').disabled)); }
    await layout(); results.push({ scenario, noFabricatedState: true });
  }
  await load('financial-support-tutorial', 390, 'view=hub'); await page.waitForSelector('[data-placard-lobby]'); assert.equal(await page.$(support), null);
  results.push({ scenario: 'tutorial', supportAbsent: true });
  await load('financial-support-return-pending', 320); await page.waitForSelector('[data-support-return]');
  await page.waitForFunction(() => document.querySelector('[data-support-return]').textContent.includes('pas encore confirmé'));
  assert(!/Merci pour ton soutien !/.test(await page.$eval('[data-support-return]', node => node.textContent)));
  await page.evaluate(() => { window.__supportState = 'paid'; }); await button('Vérifier à nouveau', '[data-support-return]');
  await page.waitForFunction(() => document.querySelector('[data-support-return]').textContent.includes('Merci pour ton soutien !'));
  assert.equal(await page.evaluate(() => window.__calls.filter(call => call.path === '/api/support/checkout').length), 0);
  await layout(); await screenshot('support-return-320'); results.push({ scenario: 'return', serverConfirmationRequired: true, noNewCheckout: true });
  for (const width of [320, 1440]) {
    await load('financial-support-admin', width); await page.waitForFunction(() => document.body.textContent.includes('Registre des soutiens'));
    assert.match(await page.$eval('body', node => node.textContent), /À compléter/);
    await keyClick('details > summary');
    await page.type('details input[inputmode="decimal"]', '0,31'); await page.type('details input[maxlength="200"]', 'RELEVE-11');
    await button('Enregistrer les frais'); await page.waitForFunction(() => window.__calls.some(call => call.body?.action === 'fees'));
    const fees = await page.evaluate(() => window.__calls.find(call => call.body?.action === 'fees').body);
    assert.equal(fees.feesCents, 31); assert.equal(fees.reference, 'RELEVE-11');
    await page.waitForFunction(() => document.body.textContent.includes('9,69'));
    assert.match(await page.$eval('a[download]', node => node.href), /\/api\/admin\/support\?.*format=csv/);
    await layout(); await screenshot('support-admin-' + width); results.push({ width, scenario: 'admin', feesUnknownUntilEntered: true, exportAvailable: true, noOverflow: true });
  }
}
