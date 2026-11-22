import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

export async function auditArenaPrizeDelivery({ origin, output, browser }) {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await page.setViewport({ width: 320, height: 710 });
    await page.goto(origin + '/arene?vue=classement', { waitUntil: 'domcontentloaded' });
    const act = async selector => {
      const node = await page.waitForSelector(selector, { visible: true });
      await node.focus();
      await page.keyboard.press('Enter');
    };
    await act('a[href="/arene/lots"]');
    await act('main summary');
    for (const [field, value] of Object.entries({ name: 'Camille Martin', address: '2 rue des Fleurs', postalCode: '29200', city: 'Brest' })) {
      await page.type(`input[name="${field}"]`, value);
    }
    await act('button[type="submit"]');
    await page.waitForSelector('p[role="alert"]');
    assert.equal(await page.$eval('[name=address]', input => input.value), '2 rue des Fleurs');
    await act('button[type="submit"]');
    const receipt = '[data-arena-prize-receipt]';
    await page.waitForSelector(receipt, { visible: true });
    await page.waitForFunction(selector => document.activeElement?.closest(selector), {}, receipt);
    assert.match(await page.$eval(receipt, node => node.textContent), /LOT-AR-TEST-1/);
    assert.deepEqual(await page.evaluate(() => window.prizeDeliveryCalls), Array.from({ length: 2 }, () => ({ path: '/api/arena/rewards/delivery', method: 'POST' })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(receipt, { visible: true });
    assert.match(await page.$eval(receipt, node => node.textContent), /LOT-AR-TEST-1.*0 €, livraison comprise/);
    assert.equal(await page.$('button[type="submit"]'), null);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(output, 'commande-retrouvee-320.png') });
    await writeFile(resolve(output, 'rapport.json'), JSON.stringify({ viewport: '320 × 710', navigation: 'clavier',
      receipt: 'LOT-AR-TEST-1', totalCents: 0, shippingCents: 0, returnedAfterLostResponse: true }, null, 2));
  } finally {
    await context.close();
  }
}
