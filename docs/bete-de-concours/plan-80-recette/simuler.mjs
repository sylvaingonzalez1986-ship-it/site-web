// Simulation locale conditionnelle. Voir economie.md pour le périmètre SQL.
import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
});
const load = name => vite.ssrLoadModule(`/src/lib/kanab-quest-${name}.ts`);
const HOUR = 3_600_000;
const ORIGIN = Date.UTC(2026, 10, 22, 8);
const PACK = ["HH2026-020", "HH2026-021", "HH2026-022"];
const DEVELOPED_ALBUM = [...PACK, "HH2026-023"];
const SEEDS = [113, 2026, 15277, 19873, 27183, 39068, 51987, 63129, 73105, 85314, 92821, 99109];
const EXTRA_SEEDS = [211, 3341, 10613, 16931, 23909, 31019, 42331, 54319, 62003, 77003, 89069, 96643];
const SUPPORT = ["BOTTE-006", "BOTTE-017", "BOTTE-037"];
const CHANNELS = ["cbd-shop", "wholesale"];
const OFFLINE_HOURS = 168;
const DAY_HOURS = 24;
const BASIC_CARE_MAX_VITALITY = 80;
const ORIGIN_OF_DEVELOPED_BALANCE = 500000;
const median = numbers => {
  if (!numbers.length) return null;
  const values = [...numbers].sort((a, b) => a - b);
  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 ? values[midpoint] : (values[midpoint - 1] + values[midpoint]) / 2;
};
const sum = values => values.reduce((a, b) => a + b, 0);

function createLedger(openingCash) {
  let cash = openingCash;
  const invoices = [];
  const add = (kind, cents, dueAt) => invoices.push({ kind, cents, dueAt, processed: false });
  function settle(at) {
    const due = invoices.filter(invoice => invoice.cents && !invoice.processed && invoice.kind !== "energy" && invoice.dueAt <= at)
      .sort((a, b) => a.dueAt - b.dueAt || a.kind.localeCompare(b.kind));
    for (const invoice of due) {
      const paid = invoice.kind === "lab" && cash < invoice.cents ? 0 : Math.min(cash, invoice.cents);
      cash -= paid;
      invoice.cents -= paid;
      invoice.processed = true;
    }
  }
  function collect(payout, vat, at) {
    settle(at);
    const afterVat = payout - vat;
    let budget = Math.floor(afterVat / 2);
    for (const kind of ["lab", "energy", "supplier"]) {
      for (const invoice of invoices.filter(invoice => invoice.kind === kind && invoice.dueAt <= at)) {
        const paid = Math.min(invoice.cents, budget);
        invoice.cents -= paid;
        budget -= paid;
      }
    }
    cash += afterVat - Math.floor(afterVat / 2) + budget;
  }
  const snapshot = at => ({ cashCents: cash,
    dueCents: sum(invoices.filter(invoice => invoice.dueAt <= at).map(invoice => invoice.cents)),
    outstandingCents: sum(invoices.map(invoice => invoice.cents)),
    ...Object.fromEntries(["lab", "energy", "supplier"].map(kind =>
      [`${kind}OutstandingCents`, sum(invoices.filter(invoice => invoice.kind === kind).map(invoice => invoice.cents))])) });
  return { add, settle, collect, snapshot, credit: cents => { cash += cents; }, debit: cents => { cash -= cents; } };
}

try {
  const [warehouse, first, conditionModel, campaign, game, care, battle, market, storage, postHarvest, commerce, business, trim, rotation, equipment, processing] =
    await Promise.all(["warehouse", "warehouse-first-plan", "warehouse-condition", "campaign", "game", "care", "battle",
      "market", "storage", "post-harvest", "commerce", "business", "staff-trim", "buddie-rotation", "equipment", "processing-profiles"].map(load));

  const empty = warehouse.createKqWarehouseEmpty();
  const firstDraft = first.proposeFirstWarehousePlan(empty);
  const starter = warehouse.getKqWarehouseQuote(firstDraft, empty);
  const extension = warehouse.getKqWarehouseQuote({
    ...starter.nextState,
    zones: [...starter.nextState.zones, { ...starter.nextState.zones[0], id: "seconde-zone", name: "Seconde zone", x: 5, y: 2 }],
  }, starter.nextState);
  const totalDeveloped = starter.totalCostCents + extension.totalCostCents;
  const scenarios = [
    { name: "depart-loic", plan: starter.nextState, capex: starter.totalCostCents, capital: 100000, album: PACK },
    { name: "deux-zones", plan: extension.nextState, capex: totalDeveloped, capital: ORIGIN_OF_DEVELOPED_BALANCE, album: DEVELOPED_ALBUM },
  ];
  // The same LP-SUPER-1L field kit is used in these two plans.
  const capacityByCode = state => ({ "GLASS-1L": sum(state.serviceZones.filter(zone => zone.kind === "storage")
    .map(zone => {
      assert.equal(zone.deviceCode, "LP-SUPER-1L");
      return 6 * sum(warehouse.getKqWarehouseServiceZoneQuote(zone).devices.map(line => line.quantity));
    })) });

  function simulate(scenario, policy, sequence, { supportCards = [], informed = false, trial = false, claim = false } = {}) {
    const isOptimizer = policy === "optimiseur";
    const isAbsent = policy === "absent";
    const waitHours = isAbsent ? OFFLINE_HOURS : DAY_HOURS;
    const records = [];
    let netPosition = scenario.capital - scenario.capex;
    const ledger = createLedger(netPosition);
    const availableSupport = [...supportCards];
    const claimed = new Set();
    let wear = conditionModel.initializeKqWarehouseCondition(scenario.plan);
    let recentBuddies = [];
    let history = [];
    let grossLifetime = 0;
    let now = ORIGIN;
    let shopRecruitment = 0;
    let shopPartners = 0;
    const hoursByDay = new Map();
    const recordHours = (at, hours) => {
      const key = Math.floor((at - ORIGIN) / business.KQ_GAME_DAY_MS);
      hoursByDay.set(key, (hoursByDay.get(key) ?? 0) + hours);
    };
    recordHours(now, 0.5); // achat du plan; dans le scénario développé, deux enregistrements
    if (scenario.plan.zones.length > 1) recordHours(now, 0.5);
    const plan = structuredClone(scenario.plan);
    for (const [index, seed] of sequence.entries()) {
      // NetPosition réserve déjà toutes les factures et la TVA. SQL peut proposer
      // un semis même lorsque cette solvabilité conservatrice est négative.
      const atStart = now;
      ledger.settle(now);
      const available = scenario.album.filter(code => rotation.getKqBuddieRotationRemaining(code, recentBuddies) === 0);
      assert.ok(available.length >= plan.zones.length);
      plan.zones.forEach((zone, zoneIndex) => { zone.buddieCode = available[zoneIndex]; });
      recordHours(now, .5); // sauvegarde des affectations
      const members = campaign.getKqCampaignParticipants(plan, index + 1, wear, null, 1)
        .map((member, zoneIndex) => ({ ...member, runId: `61000000-0000-4000-8000-${String(zoneIndex + 1).padStart(12, "0")}` }));
      const quoted = campaign.getKqCampaignTotals(members);
      for (const member of members) ledger.add("supplier", member.warehouse.consumablesCostCents, now + business.KQ_SUPPLIER_PAYMENT_TERM_MS);
      const first = members[0];
      let state = {
        ...game.startKqGame(seed, { rulesVersion: 3, warehouse: first.warehouse, varietyCode: first.buddieCode,
          cultivationProfile: first.cultivationProfile, deckCodes: availableSupport, collectionCodes: [...scenario.album, ...availableSupport],
          domiciliation: "external", firstCultureRescue: index === 0, startedAt: new Date(now).toISOString(),
          recentSituationCodes: history.slice(0, 12).flatMap(row => row) }),
        campaign: { version: 1, id: "62000000-0000-4000-8000-000000000001", leaderRunId: first.runId, members },
      };
      recentBuddies = members.reduce((recent, member) => rotation.recordKqBuddieUse(member.buddieCode, recent), recentBuddies);
      let careCents = 0;
      let stageHours = 0;
      if (isAbsent) now += OFFLINE_HOURS * HOUR;
      ledger.settle(now);
      const weekAfterSemis = isAbsent ? { stage: state.stageIndex, vitality: state.care.vitality,
        supplierDueSinceSemisCents: quoted.consumablesCostCents, yieldGrams: null, ...ledger.snapshot(now) } : null;
      while (state.phase !== "complete") {
        const mainVerte = game.KQ_ACTIVE_CARDS.find(card => card.code === "BOTTE-017");
        if (availableSupport.includes(mainVerte.code) && state.stageIndex >= 2 && game.canPlayKqCard(state, mainVerte).allowed) {
          state = game.playKqCard(state, mainVerte.code);
        }
        state = game.rollKqDice(state);
        recordHours(now, .5);
        stageHours += .5;
        let preview = game.previewKqResolution(state);
        if (preview.total < 2) for (const code of ["BOTTE-037", "BOTTE-006"]) {
          const card = game.KQ_ACTIVE_CARDS.find(candidate => candidate.code === code);
          if (card && availableSupport.includes(code) && game.canPlayKqCard(state, card).allowed) {
            state = game.playKqCard(state, code);
            preview = game.previewKqResolution(state);
            break;
          }
        }
        if (isOptimizer && state.care.vitality < BASIC_CARE_MAX_VITALITY
          && preview.outcome !== "success" && preview.outcome !== "critical" && care.canPerformKqBasicCare(state).allowed) {
          const price = care.getKqCarePricing(state).basicCarePriceCents;
          if (netPosition - careCents >= price) {
            state = care.performKqBasicCare(state);
            careCents += price;
            ledger.debit(price);
          }
        }
        state = game.resolveKqStage(state);
        state = game.advanceKqStage(state);
      }
      const dead = game.isKqCultureDead(state);
      for (const code of state.usedCards) if (availableSupport.includes(code)) availableSupport.splice(availableSupport.indexOf(code), 1);
      for (const member of members) {
        ledger.add("energy", member.warehouse.energyCostCents, now);
        if (!dead) ledger.add("lab", business.KQ_LAB_ANALYSIS_CENTS, now + business.KQ_GAME_MONTH_MS);
      }
      const seen = state.situationCodes.slice(0, dead ? state.stageIndex + 1 : game.KQ_STAGES.length);
      history = [...members.map(() => seen), ...history];
      const labor = { stages: stageHours, trim: 0, prepare: 0, sell: 0, assign: .5 };
      const lots = [];
      const saleClock = now + (isAbsent ? OFFLINE_HOURS : 6) * HOUR;
      let reservedAllocations = [];
      let shopUsed = 0;
      let wholesaleUsed = 0;
      const shopPartnersStart = shopPartners;
      const shopRecruitmentStart = shopRecruitment;
      let shopGoodUnits = 0;
      let roundVatCents = 0;
      let grossCents = 0;
      if (!dead) for (const member of members) {
        const harvested = campaign.getKqCampaignMemberState(state, member);
        const flower = battle.createKqFlower(harvested);
        const grams = harvested.harvestGrams;
        if (grams <= 0) continue;
        const trimHours = Math.ceil(grams / trim.getKqStaffTrimRate(1, "manual") * 2) / 2;
        const trimmed = trim.getKqStaffSharedTrimQuote({ mode: "manual", level: 1, hours: trimHours });
        labor.trim += trimHours;
        recordHours(now, trimHours);
        const totalUnits = Math.round(grams * 10);
        const storageLot = storage.createKqStorageLot({ flowerId: flower.id, harvestedAt: new Date(now).toISOString(),
          baseline: { varietyCode: member.buddieCode, juryScore: market.getKqJuryScoreFromStats(flower.stats),
            aroma: flower.stats.aroma, care: harvested.care }, preJury: true,
          capacity: storage.planKqStorageAllocation({ totalUnits, nowMs: now, ownedContainers: capacityByCode(plan), reservedAllocations }),
          postHarvest: postHarvest.getKqWarehousePostHarvestProfile(plan) });
        reservedAllocations = [...reservedAllocations, ...storageLot.capacity.allocations];
        assert.equal(sum(storageLot.capacity.allocations.map(allocation => allocation.storedUnits)), totalUnits);
        const stats = Object.fromEntries(Object.entries(flower.stats).filter(([, value]) => Number.isFinite(value)));
        stats.appearance = Math.max(0, Math.min(99, stats.appearance + trimmed.qualityDelta));
        const jury = storage.applyKqStorageToJury(storageLot, stats, saleClock);
        const battleSeed = seed + 11;
        const opponent = battle.createKqOpponent(battleSeed, { rulesVersion: 3, rating: 1000 + (harvested.quality - 12) * 12,
          ownerName: "Loïc · Jardin d’essai", variety: "Harlequin" });
        const verdict = battle.resolveKqBattle(battle.lockKqBattle({ ...flower, stats: jury.stats }, opponent, battleSeed), battleSeed, new Date(saleClock));
        const juryScore = market.getKqJuryScoreFromRounds(verdict.rounds);
        const projection = storage.projectKqStorageLot(jury.lot, saleClock, juryScore);
        const route = projection.conditionScore >= 5.8 ? "raw" : "biomass";
        const reference = market.KQ_MARKET_ROUTES.find(option => option.code === route).basePriceCentsPerProductGram;
        const stock = { route, batchRoute: route, varietyCode: member.buddieCode, juryScore: projection.conditionScore,
          baseUnitCents: reference, initialUnits: totalUnits, remainingUnits: totalUnits, equivalentUnits: totalUnits,
          originalUnits: totalUnits, repExact: 0, repRounded: 0 };
        const sales = [];
        labor.prepare += 1;
        recordHours(saleClock, 1);
        for (const channel of isOptimizer || informed ? CHANNELS : ["wholesale"]) {
          if (!stock.remainingUnits) break;
          const wholesaleCapacity = 10000 + shopPartners * 2500;
          const marketState = { online: { version: 1 }, reputation: 0, clients: 0, shopPartners, shopRecruitment,
            campaign: { event: "normal", directUsed: 0, shopUsed, shopPartnersStart, shopRecruitmentStart, shopGoodUnits },
            marketVolumes: {}, ownVolumes: {},
            wholesale: { capacityEquivalentUnits: wholesaleCapacity, remainingEquivalentUnits: wholesaleCapacity - wholesaleUsed },
          };
          const offer = commerce.quoteKqCommerce(marketState, stock, channel, "advised", undefined, saleClock);
          if (!offer.units) continue;
          if (trial && channel === "wholesale" && route === "raw" && stock.juryScore >= 5.8 && stock.juryScore < 6.5) {
            offer.unitCents = 120;
            offer.payoutExactAfter = (stock.payoutExact ?? 0) + offer.units * offer.unitCents / 10;
            offer.payoutRoundedAfter = Math.round(offer.payoutExactAfter);
            offer.payoutCents = offer.payoutRoundedAfter - (stock.payoutRounded ?? 0);
          }
          stock.remainingUnits -= offer.units;
          stock.payoutExact = offer.payoutExactAfter;
          stock.payoutRounded = offer.payoutRoundedAfter;
          stock.repExact = offer.repExactAfter;
          stock.repRounded = offer.repRoundedAfter;
          if (channel === "wholesale") wholesaleUsed += offer.equivalentSold;
          else {
            shopUsed += offer.equivalentSold;
            shopRecruitment = offer.shopRecruitmentAfter;
            shopPartners = offer.shopPartnersAfter;
            shopGoodUnits = offer.shopGoodUnitsAfter;
          }
          const vat = business.getKqSaleVatCents(offer.payoutCents, grossLifetime);
          grossLifetime += offer.payoutCents;
          grossCents += offer.payoutCents;
          roundVatCents += vat;
          ledger.collect(offer.payoutCents, vat, saleClock);
          labor.sell += .5;
          recordHours(saleClock, .5);
          sales.push({ channel, grams: offer.units / 10, unitCents: offer.unitCents, ttcCents: offer.payoutCents, vatCents: vat });
        }
        assert.equal(stock.remainingUnits, 0);
        lots.push({ grams, juryScore, saleQuality: projection.conditionScore, buddie: member.buddieCode, route, trimHours, sales });
      }
      const charges = { energy: quoted.energyCostCents, supplier: quoted.consumablesCostCents,
        lab: dead ? 0 : members.length * business.KQ_LAB_ANALYSIS_CENTS, care: careCents, vat: roundVatCents };
      const netCents = grossCents - sum(Object.values(charges));
      // Isolate one explicit claim, available after an observed first harvest.
      const reward = claim && lots.length && !claimed.has("first-harvest") ? 5000 : 0;
      if (reward) { claimed.add("first-harvest"); ledger.credit(reward); }
      netPosition += netCents + reward;
      const balance = ledger.snapshot(dead ? now : saleClock);
      assert.equal(balance.cashCents - balance.outstandingCents, netPosition);
      if (!dead) wear = { ...wear, assets: wear.assets.map(asset => ({ ...asset, wearPercent: Math.min(100, asset.wearPercent + 5) })) };
      records.push({ seed, atStart: new Date(atStart).toISOString(), dead, weekAfterSemis, hours: labor, quoted, charges, netCents,
        cashAfterReservesCents: netPosition, balance, grossCents, lots, usedCards: state.usedCards, history: state.history.map(entry => entry.outcome),
        rewardCents: reward, stockValueAfterSaleCents: 0, gameHoursLeft: 12 - (hoursByDay.get(Math.floor(((dead ? now : saleClock) - ORIGIN) / business.KQ_GAME_DAY_MS)) ?? 0) });
      now = (dead ? now : saleClock) + waitHours * HOUR;
    }
    assert.ok(Math.max(...hoursByDay.values()) <= 12, "La journée simulée doit être réalisable");
    return {
      initialUncommittedCents: scenario.capital - scenario.capex,
      maxGameWorkHoursPerDay: Math.max(...hoursByDay.values()),
      minPositionCents: Math.min(...records.map(row => row.cashAfterReservesCents)),
      elapsedHours: (now - waitHours * HOUR - ORIGIN) / HOUR, cycles: records,
    };
  }

  function summarize(run, capex) {
    const cycles = run.cycles;
    const lots = cycles.flatMap(row => row.lots);
    const medianHours = median(cycles.map(row => sum(Object.values(row.hours))));
    let running = 0;
    const breakEvenIndex = cycles.findIndex(row => (running += row.netCents) >= capex);
    const firstDeficitIndex = cycles.findIndex(row => row.cashAfterReservesCents < 0);
    return { completed: cycles.length - cycles.filter(row => row.dead).length, cycleNetMedianCents: median(cycles.map(row => row.netCents)),
      netCents: sum(cycles.map(row => row.netCents)), firstNetCents: cycles[0].netCents, cycleWorkMedianHours: medianHours,
      medianGramsPerLot: median(lots.map(lot => lot.grams)), medianQualityPerLot: median(lots.map(lot => lot.saleQuality)),
      commercialLots: lots.filter(lot => lot.saleQuality >= 6.5).length, totalLots: lots.length,
      firstCashAfterReservesCents: cycles[0].cashAfterReservesCents, minPositionCents: run.minPositionCents,
      firstDeficitCycle: firstDeficitIndex < 0 ? null : firstDeficitIndex + 1,
      paybackCycle: breakEvenIndex < 0 ? null : breakEvenIndex + 1, elapsedHours: run.elapsedHours };
  }

  if (process.argv.includes("--investissements")) {
    const seedsD = Array.from({ length: 12 }, (_, i) => createHash("sha256")
      .update("kanab-quest/plan80/investissement-D/" + (i + 1)).digest().readUInt32BE(0) % 100000);
    const quotes = [starter, ...[false, true].map(extraction => warehouse.getKqWarehouseQuote({
      ...firstDraft, zones: firstDraft.zones.map(zone => ({ ...zone, lightingCode: "MH-TS1000" })),
      airPlacements: extraction ? [{ id: "extracteur", code: "SIM-AIR-01", x: 0, y: 2 }] : [],
    }, empty))];
    const series = { A: SEEDS, B: EXTRA_SEEDS, D: seedsD };
    const rows = [];
    for (const [serie, seeds] of Object.entries(series)) {
      const scenariosToTest = [...quotes.map(quote => ({ ...scenarios[0], plan: quote.nextState, capex: quote.totalCostCents })), scenarios[1],
        { ...scenarios[1], plan: starter.nextState, capex: starter.totalCostCents }];
      const results = scenariosToTest.map(scenario => simulate(scenario, "optimiseur", seeds, { informed: true }));
      for (const [index, reference, choice] of [[1, 0, "lampe"], [2, 1, "extraction avec la lampe"], [3, 4, "seconde zone"]]) {
        const initial = scenariosToTest[index].capex - scenariosToTest[reference].capex;
        const deltas = results[index].cycles.map((cycle, i) => cycle.netCents - results[reference].cycles[i].netCents);
        const hours = results[index].cycles.map((cycle, i) => sum(Object.values(cycle.hours)) - sum(Object.values(results[reference].cycles[i].hours)));
        let cumulative = 0;
        const paid = deltas.findIndex(delta => (cumulative += delta) >= initial);
        rows.push({ serie, choice, addedCapitalCents: initial, additionalMarginCents: sum(deltas),
          medianAdditionalWorkHours: median(hours), firstPaybackCycle: paid < 0 ? null : paid + 1,
          finalAdditionalCashAfterCapitalCents: sum(deltas) - initial,
          operatingMarginCents: sum(results[index].cycles.map(cycle => cycle.netCents)),
          firstPositionCents: results[index].cycles[0].cashAfterReservesCents });
      }
    }
    await writeFile(new URL("investissements.json", import.meta.url), JSON.stringify({ series, rows }, null, 2) + "\n");
  } else {
    const validation = process.argv.includes("--validation");
    const config = JSON.parse(await readFile(new URL("series.json", import.meta.url)));
    const series = validation ? { C: config.validationC } : { A: SEEDS, B: EXTRA_SEEDS };
    const modes = validation ? { information: { informed: true } } : {
      temoin: {}, information: { informed: true }, palier: { informed: true, trial: true },
      cartes: { informed: true, supportCards: SUPPORT }, reclamation: { informed: true, claim: true },
    };
    const runs = [];
    for (const [serie, seeds] of Object.entries(series)) for (const scenario of scenarios) {
      for (const profile of ["debutant", "optimiseur", "absent"]) for (const [mode, options] of Object.entries(modes)) {
        const run = simulate(scenario, profile, seeds, options);
        const cycles = run.cycles.map(c => ({ seed: c.seed, at: c.atStart, netCents: c.netCents, grossCents: c.grossCents,
          rewardCents: c.rewardCents, cashCents: c.balance.cashCents, dueCents: c.balance.dueCents,
          outstandingCents: c.balance.outstandingCents, positionCents: c.cashAfterReservesCents, stockValueCents: c.stockValueAfterSaleCents,
          workHours: sum(Object.values(c.hours)), remainingHours: c.gameHoursLeft, dead: c.dead, usedCards: c.usedCards,
          quality: c.lots.map(lot => lot.saleQuality) }));
        runs.push({ serie, scenario: scenario.name, profile, mode, summary: summarize(run, scenario.capex), cycles });
      }
    }
    const alternativePlans = [false, true].map(ventilated => {
      const draft = { ...firstDraft, zones: firstDraft.zones.map(zone => ({ ...zone, lightingCode: "MH-TS1000" })),
        airPlacements: ventilated ? [{ id: "extracteur", code: "SIM-AIR-01", x: 0, y: 2 }] : [] };
      const quote = warehouse.getKqWarehouseQuote(draft, empty);
      const scenario = { ...scenarios[0], plan: quote.nextState, capex: quote.totalCostCents };
      const summary = warehouse.getKqWarehouseSummary(scenario.plan, 2, 2, undefined, undefined, 1);
      return { ventilated, capexCents: scenario.capex, energyCostCents: summary.energyCostCents,
        operatingCostCents: summary.operatingCostCents, estimatedGrams: summary.estimatedHarvestGrams,
        optimizerA: summarize(simulate(scenario, "optimiseur", SEEDS), scenario.capex),
        optimizerB: summarize(simulate(scenario, "optimiseur", EXTRA_SEEDS), scenario.capex) };
    });
    const processingQuotes = market.quoteKqMarketRoutes({ juryScore: 8, harvestGrams: 100,
      equipmentCodes: ["TENT-080-STARTER", "SIFT-TRAY", "PRESS-0600"], processWholeLot: true,
      marketContext: { reputation: 0, routeSales: {}, recentSales: {}, marketVolumes: {}, window: 0 } });
    const processingExample = [["raw", null], ["dry-sift", "SIFT-TRAY"], ["rosin-trial", "PRESS-0600"]].map(([route, machine]) => {
      const quote = processingQuotes.find(row => row.route === route);
      const totalUnits = Math.round(quote.productGrams * 10);
      const stock = { route, batchRoute: route, juryScore: 8, baseUnitCents: quote.productBaseUnitCents,
        initialUnits: totalUnits, remainingUnits: totalUnits, equivalentUnits: 1000, originalUnits: 1000, repExact: 0, repRounded: 0 };
      const state = { online: { version: 1 }, reputation: 0, clients: 0, shopPartners: 0, shopRecruitment: 0,
        campaign: { event: "normal", directUsed: 0, shopUsed: 0 }, marketVolumes: {}, ownVolumes: {} };
      const saleOffers = Object.fromEntries(CHANNELS.map(channel => {
        const offer = commerce.quoteKqCommerce(state, stock, channel, "advised");
        const vat = business.getKqSaleVatCents(offer.payoutCents, 0);
        return [channel, { ttcCents: offer.payoutCents, vatCents: vat,
          netAfterPreparationCents: offer.payoutCents - vat - quote.market.processingCostCents }];
      }));
      return { route, available: quote.available, reason: quote.blockedReason,
        capexCents: machine ? equipment.getKqEquipmentDefinition(machine).priceCents : 0,
        processingCostCents: quote.market.processingCostCents, productGrams: quote.productGrams, saleOffers,
        work: machine ? processing.createKqProcessingPlan({ inputGrams: 100, productGrams: quote.productGrams, equipmentCodes: [machine] }).nominalHours : 0 };
    });
    const result = { series, modes, runs, extensionCents: extension.totalCostCents, alternativePlans, processingExample };
    const file = validation ? "validation-c.json" : "comparaison-ab.json";
    await writeFile(new URL(file, import.meta.url), JSON.stringify(result) + "\n");
    console.log(file, runs.length, "séries de 12 campagnes");
  }
} finally {
  await vite.close();
}
