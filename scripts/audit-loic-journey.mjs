import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const guide = '[data-sylvain-guide]';
const book = '[data-sylvain-library]';
const highlight = '[data-sylvain-highlight]';
const control = name => `[data-sylvain-control="${name}"]`;
const closeGuide = 'button[data-sylvain-control="close"][aria-label="Fermer le guide"]:enabled';
const menu = 'button[aria-label="Ouvrir le menu du quartier"]';
const initialLessons = ['warehouse', 'install', 'prepare', 'supplies', 'launch', 'next'];

async function guideState(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith('kq:sylvain-guide:'));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
}

async function fixtureState(page) {
  return page.evaluate(() => ({
    production: window.loicFixture.read(),
    calls: window.loicFixture.calls,
  }));
}

async function waitForCompletion(page, lesson) {
  await page.waitForFunction(lesson => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith('kq:sylvain-guide:'));
    return key && JSON.parse(localStorage.getItem(key)).completed.includes(lesson);
  }, {}, lesson);
}

async function journey(browser, origin, target, viewport, welcome) {
  const { width, height, hasTouch } = viewport;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  const checkpoints = [];
  const firstDraftGestures = [];
  let welcomePack;
  const pageErrors = [];
  let phase = 'ouvrir le Quartier';
  page.on('pageerror', error => pageErrors.push(String(error)));

  const capture = name => page.screenshot({ path: resolve(target, `${name}-${width}.png`) });
  const wait = selector => page.waitForSelector(selector, { visible: true, timeout: 30000 });
  const tapText = async (selector, label) => {
    const result = await page.waitForFunction((selector, label) =>
      Array.from(document.querySelectorAll(selector)).find(button => !button.disabled && button.checkVisibility() && button.textContent.trim() === label),
    {}, selector, label);
    const button = result.asElement();
    await button.scrollIntoView();
    await button.tap();
    await result.dispose();
  };
  const act = async (selector, keyboard = false) => {
    const element = await wait(selector);
    if (keyboard) {
      await element.focus();
      await page.keyboard.press('Enter');
    } else if (hasTouch) {
      await element.tap();
    } else {
      await element.click();
    }
    await element.dispose();
  };
  const checkpoint = async name => {
    const metrics = await page.evaluate(({ guide, highlight }) => {
      const shown = document.querySelector(guide);
      const mark = document.querySelector(highlight);
      const guideBox = shown?.getBoundingClientRect();
      const targetBox = mark?.getBoundingClientRect();
      const overlap = Boolean(guideBox && targetBox && guideBox.width > 0 && targetBox.width > 0
        && Math.min(guideBox.bottom, targetBox.bottom) > Math.max(guideBox.top, targetBox.top)
        && Math.min(guideBox.right, targetBox.right) > Math.max(guideBox.left, targetBox.left));
      return {
        viewport: innerWidth,
        width: document.documentElement.scrollWidth,
        height: innerHeight,
        guideHeight: guideBox?.height ?? 0,
        marker: mark?.getAttribute('data-sylvain-target') ?? null,
        overlap,
        mode: shown?.getAttribute('data-mode') ?? null,
        lesson: shown?.getAttribute('data-lesson') ?? null,
      };
    }, { guide, highlight });
    assert(metrics.width <= width + 1, `Page trop large pour ${width}px à l’étape « ${name} »`);
    if (hasTouch) assert(metrics.guideHeight <= Math.ceil(metrics.height * .28), `Guide trop haut à ${width}px`);
    assert(!metrics.overlap, `Le guide couvre sa cible à l’étape « ${name} »`);
    checkpoints.push({ name, ...metrics });
  };

  try {
    await page.setViewport(viewport);
    if (welcome) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`${origin}/arene/placard?view=hub${welcome ? '&welcome&empty&persist&poor' : ''}`, { waitUntil: 'domcontentloaded' });
    await wait(`${guide}[data-mode=invited]`);
    await wait(`${guide}[data-mode=invited] ${closeGuide}`);
    await page.waitForFunction(() => typeof window.loicFixture?.read === 'function');
    const baseline = await fixtureState(page);
    assert.equal(baseline.production.warehouse.zones.length, 0);
    if (welcome) assert.deepEqual(baseline.production.ownedBuddies, []);
    await page.waitForFunction(() => document.querySelector('[data-village-unavailable=true]') ||
      Array.from(document.querySelectorAll('[data-village-prototype] [role=status]'))
        .some(node => node.textContent.startsWith('Village 3D prêt')), { timeout: 60000 });
    await checkpoint('Invitation du Quartier');
    await capture('invitation');
    assert.equal(await page.$(book), null, 'Invitation bloquante');
    assert.equal(await page.$('[data-farm-guide], [data-releve-guide-active]'), null, 'Un ancien guide subsiste');
    await act(`${guide} ${control('start')}`, !hasTouch);
    firstDraftGestures.push('Commencer avec Loïc');
    await wait(`${guide}[data-mode=active][data-lesson=warehouse]`);
    const started = await fixtureState(page);
    assert.deepEqual(started.production, baseline.production, 'Activer le guide a modifié la partie');
    const zoom = 'button[aria-label="Agrandir le village"]:enabled';
    if (await page.$(zoom)) await act(zoom, !hasTouch);
    await checkpoint('Démarrage volontaire');

    phase = 'ouvrir le Pilotage';
    await act(`${guide} ${control('locate')}`, !hasTouch);
    firstDraftGestures.push('Rejoindre l’entrepôt avec Loïc');
    const warehouseMarker = await page.$(`${highlight}[data-sylvain-target~=warehouse]`);
    if (warehouseMarker) {
      const onHub = await page.$('[data-placard-view=hub]');
      if (onHub) {
        await act(`${highlight}[data-sylvain-target~=warehouse]`);
        firstDraftGestures.push('Ouvrir le contrôle repéré');
      }
      await warehouseMarker.dispose();
      await onHub?.dispose();
    }
    await wait(`${guide}[data-lesson=install]`);
    await wait('[data-sylvain-warehouse-mode=pilotage]');
    await checkpoint('Pilotage ouvert');

    phase = 'composer et examiner le premier plan';
    await act('[data-warehouse-mode=arrangement]:enabled');
    firstDraftGestures.push('Aménager');
    await act('[data-warehouse-first-plan]:enabled');
    firstDraftGestures.push('Proposer un plan de départ');
    const review = await page.$('[data-sylvain-target~=install-review]:enabled');
    if (review) await act('[data-sylvain-target~=install-review]:enabled');
    await review?.dispose();
    await wait('[data-warehouse-plan-payable-cents]');
    const price = Number(await page.$eval('[data-warehouse-plan-payable-cents]', node => node.dataset.warehousePlanPayableCents));
    assert(price > 0, 'Le devis payable en euros est visible');
    assert.equal((await guideState(page)).completed.includes('install'), false, 'Le brouillon valide le montage');
    await capture('devis');
    await checkpoint('Devis avant paiement');

    phase = 'refuser une première sauvegarde';
    await page.evaluate(() => { window.loicFixture.rejectNextSave = true; });
    await act('[data-warehouse-action=save]:enabled');
    await page.waitForFunction(() => window.loicFixture.rejectNextSave === false);
    await wait('[data-warehouse-action=save]:enabled');
    const rejected = await fixtureState(page);
    assert.deepEqual(rejected.production.warehouse, baseline.production.warehouse, 'Le refus a modifié le plan');
    assert.equal(rejected.production.cashCents, baseline.production.cashCents, 'Le refus a débité la partie');
    assert.equal((await guideState(page)).completed.includes('install'), false, 'Le refus valide le montage');
    await checkpoint('Refus sans validation ni débit');

    phase = 'enregistrer puis reprendre après pause';
    await act('[data-warehouse-action=save]:enabled');
    await wait(`${guide}[data-lesson=prepare]`);
    const installed = await fixtureState(page);
    assert(installed.production.warehouse.zones.length > 0);
    assert.equal(baseline.production.cashCents - installed.production.cashCents, price, 'Le débit ne correspond pas au devis');
    await checkpoint('Zone enregistrée au prix confirmé');

    phase = 'explorer une activité hors parcours';
    await act(menu, !hasTouch);
    await act('dialog[open] [data-placard-nav=school]:enabled', !hasTouch);
    await wait('[data-placard-view=school]');
    assert.deepEqual((await guideState(page)).completed.filter(id => initialLessons.includes(id)), ['warehouse', 'install']);
    await act(`${guide} ${control('locate')}`, !hasTouch);
    await wait('[data-placard-view=workshop]');
    await wait('[data-warehouse-campaign-action=start]');
    await checkpoint('Détour par QuizzShow sans perdre les étapes du guide');

    phase = 'reprendre après pause et rechargement';
    await act(`${guide} ${control('pause')}`);
    await wait(`${guide}[data-mode=paused]`);
    await wait(`${guide}[data-mode=paused] ${closeGuide}`);
    await page.waitForSelector(highlight, { hidden: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(`${guide}[data-mode=paused]`);
    assert.equal((await guideState(page)).completed.includes('install'), true);
    assert.equal((await fixtureState(page)).production.cashCents, installed.production.cashCents);
    await act(`${guide} ${control('resume')}`);
    await wait(`${guide}[data-lesson=prepare]`);
    await checkpoint('Pause et progression conservées au rechargement');

    phase = 'fermer le guide en cours puis le retrouver depuis le menu';
    await wait(`${highlight}[data-sylvain-target~=prepare-open]`);
    const activeClose = `${guide}[data-mode=active] ${closeGuide}`;
    await wait(activeClose);
    assert.equal(await page.$eval(activeClose, button => button.tabIndex), 0, 'La croix est inaccessible avec Tab');
    const beforeClose = await guideState(page);
    await capture('croix-active');
    await act(activeClose, !hasTouch);
    await page.waitForSelector(`${guide}[data-mode=off][hidden]`);
    await page.waitForFunction(selector => document.querySelector(selector) === null, {}, highlight);
    assert.equal(await page.$(book), null, 'La fermeture directe ouvre le carnet');
    const closed = { ...beforeClose, mode: 'off' };
    assert.deepEqual(await guideState(page), closed, 'La fermeture change les étapes du guide');
    assert.deepEqual((await fixtureState(page)).production, installed.production, 'Fermer le guide modifie la partie');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`${guide}[data-mode=off][hidden]`);
    await wait('[data-warehouse-campaign-action=start]');
    assert.equal(await page.$(highlight), null, 'Un repère revient après rechargement');
    assert.deepEqual(await guideState(page), closed, 'La fermeture ou les acquis se perdent au rechargement');
    await checkpoint('Fermeture directe du guide et du repère conservée au rechargement');
    await capture('guide-ferme');
    await act(menu, !hasTouch);
    await act('dialog[open] [data-arena-learning-trigger]', !hasTouch);
    await wait(book);
    assert.deepEqual(await guideState(page), closed, 'L’ouverture du carnet réactive le guide');
    await act(`${book} ${control('resume')}`, !hasTouch);
    await wait(`${guide}[data-mode=active][data-lesson=prepare]`);
    await wait(`${highlight}[data-sylvain-target~=prepare-open]`);
    await checkpoint('Carnet rouvert par le menu et repère restauré après reprise volontaire');

    phase = 'placer une variété disponible';
    await act('[data-warehouse-campaign-action=start]');
    await wait('[data-sylvain-culture-setup]');
    if (welcome) {
      phase = 'obtenir les premiers Buddies via le pack de bienvenue';
      await wait('[data-empty-buddie-collection] [data-sylvain-target~=prepare-packs]');
      assert.equal(await page.$('[data-culture-buddie-change]:enabled'), null, 'Le joueur peut choisir avant d’avoir une variété');
      await act(`${guide} ${control('locate')}`);
      await act('[data-empty-buddie-collection] [data-sylvain-target~=prepare-packs]:enabled');
      await wait('[data-placard-view=shop]');
      await wait('[data-buddie-pack-welcome][data-sylvain-highlight]:enabled');
      await act(`${guide} ${control('locate')}`);
      await capture('pack-offert');
      await act('[data-buddie-pack-welcome]:enabled');
      await wait('[data-buddie-pack-open][data-sylvain-highlight]:enabled');
      assert.deepEqual((await fixtureState(page)).production.ownedBuddies, [], 'Récupérer un pack révèle ses cartes avant de l’ouvrir');
      await act(`${guide} ${control('locate')}`);
      await act('[data-buddie-pack-open]:enabled');
      await act('[data-pack-phase=idle] [data-open-action]:enabled');
      await wait('[data-pack-phase=cards]');
      await tapText('[data-pack-phase=cards] button', 'Tout révéler');
      await wait('[data-pack-phase=recap]');
      assert.equal(await page.$$eval('[data-pack-phase=recap] button[data-buddie]', elements => elements.length), 3);
      await capture('buddies-reveles');
      await tapText('[data-pack-phase=recap] button', 'Terminer');
      await page.waitForSelector('[data-pack-phase]', { hidden: true });
      welcomePack = await page.evaluate(() => ({
        points: window.__fixture.points,
        bought: window.__fixture.purchaseCommits.buddies,
        tickets: window.__fixture.tickets.map(({ id, status }) => ({ id, status })),
        revealed: window.__fixture.buddieOpens.welcome.cards.map(({ code, rarity }) => ({ code, rarity })),
        claims: window.__fixture.requests.filter(({ method, url }) => method === 'POST' && url === '/api/account/welcome-pack').length,
        openings: window.__fixture.requests.filter(({ method, url }) => method === 'POST' && url.endsWith('/scratch')).length,
      }));
      assert.equal(welcomePack.points, 0);
      assert.equal(welcomePack.bought, 0);
      assert.equal(welcomePack.claims, 1);
      assert.equal(welcomePack.openings, 1);
      assert.deepEqual(welcomePack.tickets, [{ id: 'welcome', status: 'scratched' }]);
      assert.equal(new Set(welcomePack.revealed.map(card => card.code)).size, 3);
      assert(welcomePack.revealed.every(card => card.rarity === 'common'));
      assert.equal((await fixtureState(page)).production.cashCents, installed.production.cashCents, 'Le pack offert a débité le jeu');
      assert.equal((await guideState(page)).completed.includes('prepare'), false, 'Ouvrir le pack valide l’affectation');
      await checkpoint('Pack offert récupéré et ouvert sans achat');
      phase = 'revenir affecter un Buddie du pack offert';
      await act('[data-placard-back=game]');
      await wait('[data-sylvain-culture-setup]');
      await act(`${guide} ${control('locate')}`);
    }
    await act('[data-culture-buddie-change]:enabled');
    await act('[data-culture-buddie-picker] [data-buddie-select]:enabled', !hasTouch);
    await wait(`${guide}[data-lesson=supplies]`);
    const assigned = await fixtureState(page);
    assert(assigned.production.warehouse.zones.some(zone => zone.buddieCode), 'Variété absente du plan sauvegardé');
    if (welcome) assert(welcomePack.revealed.some(card => assigned.production.warehouse.zones.some(zone => zone.buddieCode === card.code)));
    await checkpoint('Variété affectée');

    phase = 'récupérer après retrait de la variété';
    await act('[data-culture-buddie-remove]:enabled', !hasTouch);
    await wait(`${guide}[data-lesson=prepare]`);
    assert((await guideState(page)).completed.includes('prepare'), 'Retirer le Buddie efface un acquis');
    const withdrawn = await fixtureState(page);
    assert(withdrawn.production.warehouse.zones.every(zone => !zone.buddieCode), 'Le retrait n’a pas été enregistré');
    assert.equal(withdrawn.production.cashCents, installed.production.cashCents, 'Le retrait a débité la partie');
    await capture('reprise-variete');
    await act(`${guide} ${control('locate')}`, !hasTouch);
    await act('[data-culture-buddie-change]:enabled', !hasTouch);
    await act('[data-culture-buddie-picker] [data-buddie-select]:enabled', !hasTouch);
    await wait(`${guide}[data-lesson=supplies]`);
    const reassigned = await fixtureState(page);
    assert(reassigned.production.warehouse.zones.some(zone => zone.buddieCode), 'La réaffectation n’a pas été enregistrée');
    assert.equal(reassigned.production.cashCents, installed.production.cashCents, 'La réaffectation a débité la partie');
    assert.equal((await guideState(page)).completed.filter(id => id === 'prepare').length, 1, 'L’acquis a été enregistré deux fois');
    await checkpoint('Prérequis retiré puis réparé sans nouveau débit');

    phase = 'vérifier les stocks et confirmer le semis';
    await act('[data-culture-start-review]:enabled');
    await wait('[data-launch-supplies] details[data-sylvain-supplies-ready=true]');
    assert.equal((await guideState(page)).completed.includes('supplies'), false, 'Le devis seul valide la lecture des stocks');
    await act('summary[data-sylvain-target~=supplies]', !hasTouch);
    await wait('[data-launch-supplies] details[open][data-sylvain-supplies-ready=true]');
    await wait(`${guide}[data-lesson=launch]`);
    assert.equal((await guideState(page)).completed.includes('launch'), false, 'Le récapitulatif valide un semis');
    await checkpoint('Stocks vérifiés avant le semis');
    await capture('semis');
    await act('[data-culture-confirm-start]:enabled');
    await wait('[data-sylvain-run]');
    await waitForCompletion(page, 'launch');
    const launched = await fixtureState(page);
    assert(launched.production.game.campaign, 'La campagne n’est pas enregistrée dans la partie');
    const progress = await guideState(page);
    assert.deepEqual(progress.completed.filter(id => initialLessons.slice(0, -1).includes(id)), initialLessons.slice(0, -1));
    await checkpoint('Semis confirmé dans la partie réelle');
    await capture('culture');

    if (welcome) {
      phase = 'relire et passer volontairement l’étape suivante';
      await wait(`${guide}[data-lesson=next]`);
      await act(`${guide} ${control('book')}`);
      await act(`${book} [data-sylvain-lesson=warehouse] summary`);
      await wait(`${book} [data-sylvain-lesson=warehouse] details[open]`);
      assert.deepEqual(await guideState(page), progress, 'La relecture change la progression');
      assert.deepEqual((await fixtureState(page)).production, launched.production, 'La relecture change la partie');
      await act(`${book} ${control('skip')}`);
      await page.waitForSelector(book, { hidden: true });
      assert.deepEqual((await guideState(page)).skipped, ['next']);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await wait(`${guide}[data-mode=active]`);
      assert.deepEqual((await guideState(page)).skipped, ['next']);
      assert.deepEqual((await fixtureState(page)).production, launched.production, 'Le passage de l’étape change la partie');
      await checkpoint('Relecture sans mutation et passage persistant de l’échéance');
      assert.deepEqual(pageErrors, []);
      return { width, height, touch: hasTouch, firstDraftGestures, checkpoints, welcomePack, progress: await guideState(page) };
    }

    phase = 'retrouver la prochaine échéance';
    if (!progress.completed.includes('next')) {
      await act(`${guide} ${control('locate')}`, !hasTouch);
      const warehouse = await page.$('[data-placard-view=game] [data-sylvain-highlight][data-sylvain-target~=warehouse]');
      if (warehouse) await act('[data-placard-view=game] [data-sylvain-highlight][data-sylvain-target~=warehouse]');
      await warehouse?.dispose();
      await waitForCompletion(page, 'next');
    }
    await checkpoint('Prochaine échéance consultée');
    const completed = await guideState(page);

    phase = 'relire et désactiver le guide';
    await act(`${guide} ${control('book')}`, !hasTouch);
    await wait(book);
    await act(`${book} [data-sylvain-lesson=warehouse] summary`, !hasTouch);
    await wait(`${book} [data-sylvain-lesson=warehouse] details[open]`);
    assert.deepEqual(await guideState(page), completed, 'La relecture a changé la progression');
    assert.deepEqual((await fixtureState(page)).production, launched.production, 'La relecture a changé la partie');
    await capture('carnet');
    if (await page.$(`${book} ${control('skip')}`)) {
      const current = await page.$eval(guide, node => node.dataset.lesson);
      await act(`${book} ${control('skip')}`);
      await page.waitForSelector(book, { hidden: true });
      assert((await guideState(page)).skipped.includes(current), 'L’étape passée n’est pas mémorisée');
      assert.deepEqual((await fixtureState(page)).production, launched.production, 'Passer une étape a changé la partie');
      await act(`${guide} ${control('book')}`);
    }
    await act(`${book} ${control('off')}`);
    await page.waitForSelector(book, { hidden: true });
    await page.waitForSelector(`${guide}[data-mode=off][hidden]`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`${guide}[data-mode=off][hidden]`);
    assert.deepEqual((await fixtureState(page)).production, launched.production, 'Désactiver le guide a changé la partie');
    await checkpoint('Relecture, passage et désactivation sans action de jeu');

    phase = 'ouvrir le carnet depuis le menu après désactivation';
    await act(menu, !hasTouch);
    await act('dialog[open] [data-arena-learning-trigger]', !hasTouch);
    await wait(book);
    assert.equal((await guideState(page)).mode, 'off', 'Le menu réactive le guide sans demande');
    await act(`${book} ${control('resume')}`, !hasTouch);
    await wait(`${guide}[data-mode=active]`);
    await checkpoint('Carnet depuis le menu et reprise volontaire');
    assert.deepEqual(pageErrors, []);
    return { width, height, touch: hasTouch, firstDraftGestures, checkpoints, calls: (await fixtureState(page)).calls, progress: await guideState(page) };
  } catch (error) {
    await capture('echec');
    const evidence = await page.evaluate(({ guide, highlight, book }) => ({
      url: location.href,
      guide: document.querySelector(guide)?.outerHTML,
      marker: document.querySelector(highlight)?.outerHTML.slice(0, 900),
      book: Boolean(document.querySelector(book)),
      calls: window.loicFixture?.calls,
    }), { guide, highlight, book });
    await writeFile(resolve(target, `echec-${width}.json`), JSON.stringify({ phase, checkpoints, pageErrors, evidence }, null, 2));
    throw new Error(`${width}px — ${phase}`, { cause: error });
  } finally {
    await context.close();
  }
}

export async function auditLoicJourney({ origin, output, browser, welcomeOnly = false }) {
  const target = resolve(output, welcomeOnly ? 'loic-welcome' : 'loic');
  await mkdir(target, { recursive: true });
  const results = [];
  const mobile = { width: 320, height: 710, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  for (const viewport of welcomeOnly ? [mobile] : [
    { width: 1440, height: 900, deviceScaleFactor: 1, hasTouch: false },
    mobile,
  ]) results.push(await journey(browser, origin, target, viewport, welcomeOnly));
  await writeFile(resolve(target, 'rapport.json'), JSON.stringify(results, null, 2));
  return results;
}
