/** Read-only deterministic affordability audit using the application's quotes. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, envDir: false,
  resolve: { alias: { "@": resolve("src") } }, server: { middlewareMode: true, watch: null } });
try {
  const load = name => vite.ssrLoadModule(`/src/lib/${name}.ts`);
  const [career, equipment, market, commerce, business, energy, storage, maintenance, production] = await Promise.all([
    "chanvrier-career", "kanab-quest-equipment", "kanab-quest-market", "kanab-quest-commerce", "kanab-quest-business",
    "kanab-quest-energy", "kanab-quest-storage", "kanab-quest-maintenance", "kanab-quest-production",
  ].map(load));
  const starterCodes = [...equipment.KQ_STARTING_EQUIPMENT_CODES];
  const startingEnergy = energy.quoteKqEnergy(starterCodes).totalCents;
  const jar = storage.KQ_STORAGE_CONTAINERS.find(item => item.code === "GROVE-1LB");
  const targetLevels = { "SIFT-TRAY": 6, "PRESS-0600": 10, "WASHER-25L": 9, "AUTO-SIEVE": 9, "FREEZE-DRYER": 9, "STATIC-PLASMA": 6 };
  const euro = cents => Math.round(cents) / 100;

  function simulate(startingCashEuros, expand, channel = "cbd-shop") {
    let cash = startingCashEuros * 100, units = 1, capacityGrams = 100, grossSales = 0, xp = 0, session = 0;
    let minimumCash = cash, levelTenSession = null, goalSession = null, bankruptcySession = null;
    const codes = [], levels = {}, wear = {}, events = [], practice = { sifting: 0, washing: 0, pressing: 0 };
    const costs = { equipment: 0, upgrades: 0, extensions: 0, storage: 0, energy: 0, lab: 0, vat: 0, processing: 0, maintenance: 0 };
    let state = { revision: 0, cashCents: cash, reputation: 0, clients: 0, computerOwned: false, internetRenew: false,
      shopPartners: 0, shopRecruitment: 0, shopChurn: 0, campaign: null, stocks: [], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {} };

    function pay(amount, category) { cash -= amount; costs[category] += amount; minimumCash = Math.min(minimumCash, cash); }
    function stocksFor(quote, harvestGrams) {
      const make = (route, grams, equivalent, baseUnitCents) => ({ id: `${session}-${route}`, flowerId: `flower-${session}`,
        name: "Simulation", route, batchRoute: quote.route, juryScore: 9.2, initialUnits: Math.round(grams * 10),
        remainingUnits: Math.round(grams * 10), equivalentUnits: Math.round(equivalent * 10), originalUnits: Math.round(harvestGrams * 10),
        baseUnitCents, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, payoutExact: 0, payoutRounded: 0 });
      return [make(quote.route, quote.productGrams, quote.processedInputGrams, quote.productBaseUnitCents ?? 30),
        ...(quote.remainderGrams > 0 ? [make(quote.remainderDestination, quote.remainderGrams, quote.remainderGrams,
          quote.remainderDestination === "raw" ? 180 : 30)] : [])];
    }
    function sellQuote(quote, harvestGrams, originalState) {
      const next = structuredClone(originalState);
      let gross = 0, professional = 0;
      for (const stock of stocksFor(quote, harvestGrams)) {
        for (const outlet of channel === "wholesale" ? ["wholesale"] : ["cbd-shop", "wholesale"]) {
          if (stock.remainingUnits <= 0) break;
          const offer = commerce.quoteKqCommerce(next, stock, outlet);
          if (offer.reason || offer.units === 0) continue;
          gross += offer.payoutCents;
          if (outlet === "cbd-shop" && stock.route === quote.route) professional += offer.equivalentSold;
          Object.assign(stock, { remainingUnits: stock.remainingUnits - offer.units, payoutExact: offer.payoutExactAfter,
            payoutRounded: offer.payoutRoundedAfter, repExact: offer.repExactAfter, repRounded: offer.repRoundedAfter });
          next.reputation = Math.max(0, next.reputation + offer.reputationDelta);
          next.shopPartners = offer.shopPartnersAfter; next.shopRecruitment = offer.shopRecruitmentAfter; next.shopChurn = offer.shopChurnAfter;
          Object.assign(next.campaign, { shopUsed: next.campaign.shopUsed + offer.shopCost, shopGoodUnits: offer.shopGoodUnitsAfter, shopBadUnits: offer.shopBadUnitsAfter });
        }
      }
      if (professional >= quote.processedInputGrams * 5 && market.calculateKqMarketReputation(quote.route, 9.2) > 0) {
        const count = (next.routeSales[quote.route] ?? 0) + 1;
        next.routeSales[quote.route] = count;
        next.reputation += market.getKqRouteExpertiseBonusReputation(quote.route, count);
      }
      return { state: next, gross };
    }

    for (session = 1; session <= 400; session++) {
      const snapshot = career.createChanvrierCareerSnapshot({ xp, completedCultures: session - 1, processingPractice: practice });
      const reserve = 2 * (business.KQ_LAB_ANALYSIS_CENTS + startingEnergy * units);
      if (expand) {
        const next = production.getKqProductionExpansion(units);
        if (next.nextUnits && career.getChanvrierCareerGate(xp, career.getChanvrierExpansionRequiredLevel(next.nextUnits)).allowed
          && cash >= next.totalCostCents + reserve + startingEnergy * 2) {
          pay(next.totalCostCents, "extensions"); units = next.nextUnits; events.push({ afterSession: session - 1, tents: units });
        }
      }
      for (const code of Object.keys(targetLevels)) {
        const item = equipment.getKqEquipmentDefinition(code);
        if (!codes.includes(code) && career.getChanvrierEquipmentAccess(snapshot, code).allowed && cash >= item.priceCents + reserve) {
          pay(item.priceCents, "equipment"); codes.push(code); levels[code] = 1; wear[code] = 0;
          events.push({ afterSession: session - 1, acquired: code });
        }
        while (codes.includes(code) && levels[code] < targetLevels[code]) {
          const cost = equipment.getKqEquipmentUpgradeCost(code, levels[code]);
          if (!career.getChanvrierCareerGate(xp, career.getChanvrierEquipmentUpgradeRequiredLevel(code, levels[code] + 1)).allowed || cash < cost + reserve) break;
          pay(cost, "upgrades"); levels[code]++;
        }
      }
      const harvestGrams = 100 * units;
      while (capacityGrams < harvestGrams && cash >= jar.priceCents) {
        pay(jar.priceCents, "storage"); capacityGrams += jar.capacityUnits / 10;
      }
      if (capacityGrams < harvestGrams) { bankruptcySession = session; break; }
      state.campaign = { id: `cycle-${session}`, revision: session, reputation: state.reputation, clientsStart: 0, event: "normal", internetPaid: false,
        shopPartnersStart: state.shopPartners, shopRecruitmentStart: state.shopRecruitment, shopChurnStart: state.shopChurn,
        shopGoodUnits: 0, shopBadUnits: 0, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 };
      const quotes = market.quoteKqMarketRoutes({ juryScore: 9.2, harvestGrams, equipmentCodes: [...starterCodes, ...codes], equipmentLevels: levels,
        marketContext: { reputation: state.reputation, routeSales: state.routeSales, recentSales: {}, marketVolumes: {}, window: session * 4 } });
      const options = quotes.filter(quote => quote.available).map(quote => {
        const usedCodes = [...new Set(market.KQ_MARKET_ROUTES.find(route => route.code === quote.route).requiredUnlocks
          .flatMap(unlock => codes.filter(code => equipment.getKqEquipmentDefinition(code).unlocks.includes(unlock))))];
        const repairs = usedCodes.reduce((sum, code) => {
          const condition = maintenance.getKqMachineCondition(code, levels[code], wear[code]);
          return sum + (condition?.due ? condition.repairCents : 0);
        }, 0);
        const sold = sellQuote(quote, harvestGrams, state), processing = quote.market?.processingCostCents ?? 0;
        return { quote, usedCodes, repairs, processing, ...sold, net: sold.gross - business.getKqSaleVatCents(sold.gross, grossSales) - processing - repairs };
      }).filter(option => option.processing + option.repairs <= cash);
      options.sort((a, b) => b.net - a.net);
      const practiceRoute = practice.sifting < 10 ? "dry-sift" : practice.washing < 6 ? "ice-water-hash" : null;
      const chosen = options.find(option => option.quote.route === practiceRoute && option.net > business.KQ_LAB_ANALYSIS_CENTS + startingEnergy * units) ?? options[0];
      if (!chosen) { bankruptcySession = session; break; }
      for (const code of chosen.usedCodes) {
        const condition = maintenance.getKqMachineCondition(code, levels[code], wear[code]);
        if (condition?.due) { pay(condition.repairCents, "maintenance"); wear[code] = 0; }
        wear[code]++;
      }
      pay(chosen.processing, "processing");
      cash += chosen.gross;
      pay(business.getKqSaleVatCents(chosen.gross, grossSales), "vat"); grossSales += chosen.gross;
      pay(startingEnergy * units, "energy"); pay(business.KQ_LAB_ANALYSIS_CENTS, "lab"); state = chosen.state;
      if (chosen.quote.family === "rosin") practice.pressing++;
      if (["dry-sift", "static-sift"].includes(chosen.quote.route)) practice.sifting++;
      if (["ice-water-hash", "hash-signature"].includes(chosen.quote.route)) practice.washing++;
      xp += career.getChanvrierCultureXp({ status: "completed", completedStages: 6 });
      if (career.getChanvrierCareerProgress(xp).level === 10) levelTenSession ??= session;
      if (cash < 0) { bankruptcySession = session; break; }
      if (Object.entries(targetLevels).every(([code, level]) => (levels[code] ?? 0) >= level) && units === (expand ? 8 : 1)) { goalSession = session; break; }
    }
    return { startingCashEuros, strategy: expand ? "gradual-eight-tents" : "stable-one-tent", channel,
      completedSessions: Math.min(session, 400), levelTenSession, fullWorkshopSession: goalSession, bankruptcySession,
      finalTents: units, finalCashEuros: euro(cash), minimumCashEuros: euro(minimumCash), revenueEuros: euro(grossSales),
      costsEuros: Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, euro(value)])), practice, levels, events };
  }
  const scenarios = [350, 1000, 5000].flatMap(cash => [simulate(cash, false), simulate(cash, true)]);
  for (const scenario of scenarios) {
    assert.equal(scenario.bankruptcySession, null, `viable professional route at ${scenario.startingCashEuros} euros`);
    assert.ok(scenario.fullWorkshopSession, "full workshop achievable with conservative cash reserves");
  }
  // Isolate the beginner's raw-flower fallback from later investments. This
  // intentionally assumes a 100 g successful harvest, never emergency overflow.
  const startingWholesale = [6.5, 7, 8, 9.2].flatMap(juryScore => ["normal", "promotion", "restock"].map(event => {
    const account = { revision: 0, cashCents: 35000, reputation: 0, clients: 0, computerOwned: false, internetRenew: false,
      campaign: { id: "startup", revision: 0, reputation: 0, clientsStart: 0, event, internetPaid: false,
        directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 }, stocks: [], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {} };
    const stock = { id: "startup", flowerId: "startup", name: "Starter", route: "raw", batchRoute: "raw", juryScore,
      initialUnits: 1000, remainingUnits: 1000, equivalentUnits: 1000, originalUnits: 1000, baseUnitCents: 180,
      repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
    const offer = commerce.quoteKqCommerce(account, stock, "wholesale"), retail = commerce.quoteKqCommerce(account, stock, "cbd-shop");
    const vat = business.getKqSaleVatCents(offer.payoutCents, 0);
    const margin = offer.payoutCents - vat - business.KQ_LAB_ANALYSIS_CENTS - startingEnergy;
    assert.ok(margin > 0, `${juryScore}/${event}: raw wholesale supports a starter cycle`);
    assert.ok(retail.payoutCents > offer.payoutCents, `${juryScore}/${event}: retail keeps a price advantage`);
    return { juryScore, event, grossEuros: euro(offer.payoutCents), vatEuros: euro(vat), operatingMarginEuros: euro(margin),
      retailGrossEuros: euro(retail.payoutCents), cashAfter45SessionsFrom350Euros: euro(35000 + 45 * margin), reputationGain: offer.reputationDelta };
  }));
  const wholesaleOnly = simulate(350, false, "wholesale");
  assert.equal(wholesaleOnly.bankruptcySession, null, "commercial-quality wholesale no longer forces a cash deficit");
  console.log(JSON.stringify({ assumptions: [
    "One completed culture per real day, constant 100 g per starter tent and jury score 9.2; these are scenario assumptions, not a forecast.",
    "Wait six hours for curing before CBD-shop sales; daily demand is fully replenished. Remaining demand overflow is sold wholesale. No unsold stock carries over.",
    "Uses live market recipe/commerce quotes, actual starter electricity, 45 euro laboratory fee once per session, included 20% VAT (TTC/6), processing fees and machine maintenance.",
    "Starts with two free 50 g jars; buys 454 g Grove bags as required. No debt, money gifts, savings interest, merchant bonus, website or advertising.",
    "Growth equipment stays at the viable starter kit; only the common processing workshop is purchased. Upgrades obey career gates, acquisitions obey practice gates. Keeps two sessions of operating cash before investments.",
    "Core goals: all six processing machines at useful recipe levels, career level ten, and one/eight tents. Recipe expertise follows at least half a quality lot sold professionally.",
    "Commercial raw wholesale at quality >=6.5 pays 38% normally, 35% in promotion, 39% in restock. Poor raw flowers and extracts keep 25/30/33%; biomass and emergency overflow are unchanged. Low harvests or degraded lots can still lose money.",
    "The starter wholesale table holds gear at the starter kit for 45 sessions. Exclusive wholesale never earns the retail reputation needed for advanced recipes; sustainable cash is not a promise to unlock the full workshop through this channel alone.",
  ], scenarios, startingWholesale, stressCase: wholesaleOnly }, null, 2));
} finally { await vite.close(); }
