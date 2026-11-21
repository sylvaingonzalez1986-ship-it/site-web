import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function auditLoicCleaning({origin, output, browser}) {
  const page = await browser.newPage();
  const guide = '[data-sylvain-guide]';
  const book = '[data-sylvain-library][open]';
  const panel = '[data-warehouse-cleaning]';
  const card = '[data-sylvain-lesson="cleaning"]';
  const villageReturn = '[data-warehouse-v4] [data-placard-back="hub"]';
  const draft = '[data-warehouse-draft="true"]';
  const activeDialog = 'dialog[open][data-app-dialog]';
  const pressButton = async node => {
    await node.focus();
    await page.keyboard.press('Enter');
    await node.dispose();
  };
  const press = async selector => {
    await pressButton(await page.waitForSelector(selector, {visible:true}));
  };
  const pressDialogButton = async label => {
    const handle = await page.waitForFunction((selector, text) =>
      [...document.querySelectorAll(`${selector} button`)].find(button => !button.disabled && button.textContent.trim() === text), {}, activeDialog, label);
    await pressButton(handle.asElement());
  };
  const mode = (id) => `[data-sylvain-control="${id}"]`;
  const vacuum = '[data-warehouse-clean-step="vacuum"]';
  const writes = () => page.evaluate(() => window.loicFixture.calls.filter(call => call.method !== 'GET'));
  try {
    await page.setViewport({width:1440,height:900});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    page.setDefaultTimeout(120000);
    await page.goto(origin+'/arene/placard?view=workshop&cleaning=1', {waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForSelector('[data-warehouse-mode-switch="pilotage"]');
    await page.waitForSelector('[data-village-toolbar-return]', {hidden:true});
    await press(villageReturn);
    await page.waitForSelector('[data-placard-view="hub"]');
    assert.equal(new URL(page.url()).searchParams.has('view'), false);
    await page.goBack({waitUntil:'domcontentloaded'});

    page.setDefaultTimeout(30000);
    await page.setViewport({width:320,height:844});
    await press('[data-warehouse-mode="arrangement"]:enabled');
    await page.waitForSelector('[data-warehouse-mode-switch="arrangement"]');
    assert.equal(await page.$eval(villageReturn, node => {
      const {left, right, top, bottom, height} = node.getBoundingClientRect();
      return left >= 0 && right <= innerWidth && top >= 0 && bottom <= innerHeight && height >= 44;
    }), true);
    await page.screenshot({path:resolve(output,'retour-village-320.png')});
    await press('[data-warehouse-first-plan]:enabled');
    await page.waitForSelector(draft);
    await page.waitForFunction(() => document.activeElement?.matches('[data-warehouse-iso-map]'));
    await press(villageReturn);
    await pressDialogButton('Continuer à modifier');
    await page.waitForSelector(activeDialog, {hidden:true});
    await page.waitForSelector(draft);
    await press(villageReturn);
    await pressDialogButton('Quitter en gardant le brouillon');
    await page.waitForSelector('[data-placard-view="hub"]');
    await page.goBack({waitUntil:'domcontentloaded'});
    await page.waitForSelector(draft);
    await press('[data-warehouse-action="reset"]:enabled');
    await page.waitForSelector(draft, {hidden:true});

    page.setDefaultTimeout(120000);
    await page.setViewport({width:390,height:844});
    await press('button[data-warehouse-module="cleaning"]');
    await page.waitForSelector(vacuum+':enabled');
    await press('button[aria-label="Ouvrir le menu du quartier"]');
    await press('dialog[open] [data-arena-learning-trigger]');
    await press(book+' '+mode('start'));
    await press(guide+' '+mode('book'));
    await press(book+' '+card+' summary');
    await press(book+' [data-sylvain-select="cleaning"]');
    await page.waitForSelector(guide+'[data-lesson=cleaning]');
    await press(vacuum);
    await page.waitForFunction(p => document.querySelector(p)?.textContent.includes('En cours'), {}, panel);
    const started = await page.evaluate(() => JSON.parse(sessionStorage.getItem('loic-preparations')).previewCleaning.vacuum.pending);
    assert.equal(Date.parse(started.endsAt)-Date.parse(started.startsAt), 300000);
    assert.equal((await writes()).filter(call=>call.body?.action==='clean').length, 1);
    assert.equal(await page.$eval(vacuum,node=>node.disabled), true);
    assert.equal(await page.$eval(panel, node=>node.hasAttribute('data-sylvain-seen')), false);
    await page.screenshot({path:resolve(output,'nettoyage-en-cours.png')});
    await press(villageReturn);
    await page.waitForSelector('[data-placard-view="hub"]');
    await page.waitForSelector(guide+'[data-lesson=cleaning]');
    // Advance only the fixture's service clock beyond the recorded due date.
    await page.evaluate(() => sessionStorage.setItem('loic-clock-offset','300005'));
    await page.reload({waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForSelector(guide+'[data-lesson=cleaning]');
    await press(guide+' '+mode('locate'));
    await press('button[data-warehouse-module="cleaning"]');
    await page.waitForSelector(panel+'[data-sylvain-seen~=cleaning]');
    await press(guide+' '+mode('book'));
    await page.waitForSelector(book+' '+card+'[data-status=completed]');
    assert.equal((await writes()).length, 0);
    await writeFile(resolve(output,'nettoyage.json'), JSON.stringify({
      passed:true, source:'API locale, horloge de recette avancée au-delà de l’échéance', started, minutes:5,
      confirmedOnlyAfterCompletion:true, leftQuarterAndReloaded:true, repeatedGameCommandsAfterReload:0,
      warehouseReturn:{ pilotageWidth:1440, arrangementWidth:320, keyboard:true, draftKept:true },
    },null,2));
  } catch (error) {
    await writeFile(resolve(output,'diagnostic-nettoyage.txt'), await page.$eval('body',node=>node.innerText).catch(()=>String(error)));
    throw error;
  } finally { await page.close(); }
}
