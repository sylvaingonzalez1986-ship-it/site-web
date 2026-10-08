import { KQ_EQUIPMENT_CATALOG, KQ_STARTING_EQUIPMENT_CODES, getKqEquipmentDefinition, getKqEquipmentRequirementState, getKqEquipmentUpgradeCost, isKqSharedEquipment, validateKqEquipmentCart } from './kanab-quest-equipment';
import { getKqProductionExpansion } from './kanab-quest-production';
import { getKqMachineCondition, type KqMachineCondition } from './kanab-quest-maintenance';
import { getKqCultureEquipmentCondition, getKqCultureOperationalCodes, type KqCultureEquipmentCondition } from './kanab-quest-culture-wear';
import { quoteKqEnergy, type KqEnergyMode } from './kanab-quest-energy';
import { KQ_COMPUTER_PRICE_CENTS, KQ_SALES_CHANNELS, getKqCommerceCapacity, getKqShopBudget, quoteKqCommerce, type KqCommerceOffer, type KqCommerceReceipt, type KqCommerceSnapshot, type KqCommerceStock, type KqOnlinePrice, type KqSalesChannel } from './kanab-quest-commerce';
import { previewKqBusinessPayment } from './kanab-quest-business';
import { isKqMarketRouteCode, quoteKqMarketRoutes, type KqMarketRouteCode } from './kanab-quest-market';
import { getKqMarketWindow } from './kanab-quest-market-demand';
import { createKqWorkshop } from './kanab-quest-workshops';
import { trialQuality, type KqTrialState } from './kanab-quest-trial';

export type KqOperationsLessonId = 'equipment' | 'warehouse' | 'market';
type Inventory = { ownedCodes: string[]; purchasedCodes: string[]; equippedCodes: string[]; levels: Record<string, number>; maintenance: Record<string, KqMachineCondition>; cultureWear: Record<string, KqCultureEquipmentCondition> };
type Tent = Inventory & { tentNumber: number };
type PreparedQuote = { offer: KqCommerceOffer; stockId: string; revision: number };
export type KqOperationsLessonState = {
  lesson: KqOperationsLessonId; trial: KqTrialState; tents: Tent[]; shared: Inventory;
  prepared: boolean; events: string[]; routePlan: { route: string; equipmentCode: string } | null;
  quotes: Record<string, PreparedQuote>; receipts: Record<string, unknown>;
};
export type KqOperationsLessonAction = { path: string; method: string; body: Record<string, unknown> };
const LOT_ID = 'operations-lesson-flower';

function inventory(codes: readonly string[], equipped = codes): Inventory {
  return { ownedCodes: [...codes], purchasedCodes: codes.filter(code => getKqEquipmentDefinition(code)?.purchasable), equippedCodes: [...equipped], levels: Object.fromEntries(codes.map(code => [code, 1])), maintenance: {}, cultureWear: {} };
}

export function createKqOperationsLesson(lesson: KqOperationsLessonId): KqOperationsLessonState {
  const trial = createKqWorkshop('market');
  trial.commerce.cashCents = 500_000;
  // The lent harvest arrives with its previous culture's electricity settled.
  trial.electricity = 0;
  // A shop is lent with the evaluated lot so all three real distribution screens
  // can be explored. Creating a real shop belongs to the treasury lesson.
  trial.commerce.computerOwned = true;
  if (trial.commerce.business) trial.commerce.business.shop = { name: 'Le shop de Sylvain · essai', createdAt: new Date(trial.clock).toISOString(), paidUntil: new Date(trial.clock + 30 * 86400000).toISOString(), renew: true, active: true };
  const tent: Tent = { ...inventory(KQ_STARTING_EQUIPMENT_CODES), tentNumber: 1 };
  const shared = inventory(lesson === 'equipment' ? [] : ['SIFT-TRAY', 'PRESS-0600']);
  if (lesson !== 'equipment') {
    tent.ownedCodes.push('LED-300', 'DRYING-ROOM'); tent.purchasedCodes.push('LED-300', 'DRYING-ROOM');
    tent.equippedCodes = tent.equippedCodes.filter(code => getKqEquipmentDefinition(code)?.slot !== 'lighting').concat('LED-300', 'DRYING-ROOM');
    tent.levels['LED-300'] = 1; tent.levels['DRYING-ROOM'] = 1;
  }
  if (lesson === 'warehouse') {
    const machine = KQ_EQUIPMENT_CATALOG.find(item => item.category === 'processing' && getKqMachineCondition(item.code, 1, 10)?.due);
    if (machine && !shared.ownedCodes.includes(machine.code)) {
      shared.ownedCodes.push(machine.code); shared.purchasedCodes.push(machine.code); shared.equippedCodes.push(machine.code); shared.levels[machine.code] = 1;
    }
    if (machine) shared.maintenance[machine.code] = getKqMachineCondition(machine.code, 1, 10)!;
    tent.cultureWear['LED-300'] = getKqCultureEquipmentCondition('LED-300', 1, 60)!;
  }
  return { lesson, trial, tents: [tent], shared, prepared: false, events: [], routePlan: null, quotes: {}, receipts: {} };
}

export function getKqOperationsEquipment(state: KqOperationsLessonState, tentNumber = 1) {
  const tent = state.tents.find(item => item.tentNumber === tentNumber) ?? state.tents[0];
  return { ...tent, tents: state.tents, sharedEquipment: state.shared, cashCents: state.trial.commerce.cashCents,
    ownedCodes: [...tent.ownedCodes, ...state.shared.ownedCodes], purchasedCodes: [...tent.purchasedCodes, ...state.shared.purchasedCodes],
    equippedCodes: [...tent.equippedCodes, ...state.shared.equippedCodes], levels: { ...tent.levels, ...state.shared.levels },
    productionUnits: state.tents.length, equipmentPricingUnits: 1, production: getKqProductionExpansion(state.tents.length),
    routePlan: state.routePlan, catalog: KQ_EQUIPMENT_CATALOG, reputation: state.trial.commerce.reputation, activeRun: false,
  };
}

function routes(state: KqOperationsLessonState) {
  const equipment = getKqOperationsEquipment(state);
  const commerce = state.trial.commerce;
  const operational = equipment.equippedCodes.filter(code => !state.shared.maintenance[code]?.due);
  return quoteKqMarketRoutes({ juryScore: trialQuality(state.trial), harvestGrams: state.trial.game?.harvestGrams ?? 0,
    equipmentCodes: operational, equipmentLevels: equipment.levels,
    marketContext: { reputation: commerce.reputation, routeSales: commerce.routeSales, recentSales: {}, marketVolumes: commerce.marketVolumes, window: getKqMarketWindow(state.trial.clock) },
  });
}

export function getKqOperationsCommerce(state: KqOperationsLessonState): KqCommerceSnapshot {
  return { ...state.trial.commerce, rawLots: state.prepared ? [] : [{ flowerId: LOT_ID, varietyName: 'La récolte de Sylvain · essai', juryScore: trialQuality(state.trial), harvestGrams: state.trial.game?.harvestGrams ?? 0, options: routes(state) }], electricityOutstandingCents: state.trial.electricity };
}

export function getKqOperationsEnergy(state: KqOperationsLessonState) {
  const tents = state.tents.map(tent => ({ tentNumber: tent.tentNumber, equippedCodes: tent.equippedCodes, levels: tent.levels, cultureWear: tent.cultureWear, cultureOperationalCodes: getKqCultureOperationalCodes(tent.equippedCodes, tent.cultureWear) }));
  const profiles = tents.map(tent => ({ tentNumber: tent.tentNumber, codes: tent.cultureOperationalCodes, levels: tent.levels }));
  const first = tents[0];
  return { cashCents: state.trial.commerce.cashCents, productionUnits: tents.length, tents, outstandingCents: 0, invoiceCount: 0, bestGramsPerKwh: null, invoices: [],
    cultureEquipmentCodes: first.equippedCodes, cultureOperationalCodes: first.cultureOperationalCodes, cultureWear: first.cultureWear,
    quotes: Object.fromEntries((['eco', 'balanced', 'intensive'] as KqEnergyMode[]).map(mode => [mode, quoteKqEnergy(first.cultureOperationalCodes, first.levels, mode, tents.length, profiles)])),
  };
}

function requireCondition(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

/** Executes only this exercise. Unknown endpoints fail closed; there is no network fallback. */
export function applyKqOperationsRequest(current: KqOperationsLessonState, action: KqOperationsLessonAction): { state: KqOperationsLessonState; payload: unknown } {
  const { method, body } = action;
  const url = new URL(action.path, 'https://lesson.invalid');
  requireCondition(url.origin === 'https://lesson.invalid', 'Cette action ne fait pas partie de cet atelier.');
  if (method === 'GET') {
    if (url.pathname === '/api/arena/placard/equipment') return { state: current, payload: getKqOperationsEquipment(current, Number(url.searchParams.get('tentNumber')) || 1) };
    if (url.pathname === '/api/arena/placard/commerce') return { state: current, payload: getKqOperationsCommerce(current) };
    if (url.pathname === '/api/arena/placard/energy') return { state: current, payload: getKqOperationsEnergy(current) };
    throw new Error('Cet espace possède son propre atelier. Reviens aux possibilités pour le découvrir.');
  }
  requireCondition(method === 'POST' || method === 'PATCH', 'Action indisponible dans cet atelier.');
  const receiptKey = typeof body.requestKey === 'string' ? `${url.pathname}:${body.requestKey}` : null;
  if (receiptKey && Object.hasOwn(current.receipts, receiptKey)) return { state: current, payload: current.receipts[receiptKey] };
  const state = structuredClone(current);
  const c = state.trial.commerce;
  let payload: unknown;
  const spend = (cents: number) => { requireCondition(Number.isFinite(cents) && cents >= 0 && c.cashCents >= cents, 'Budget fictif insuffisant.'); c.cashCents -= cents; };
  if (url.pathname === '/api/arena/placard/equipment') {
    const number = Number(body.tentNumber) || 1;
    const tent = state.tents.find(item => item.tentNumber === number);
    requireCondition(tent, 'Tente indisponible.');
    if (body.action === 'expand-production') {
      const expansion = getKqProductionExpansion(state.tents.length);
      requireCondition(expansion.nextUnits && body.expectedUnits === state.tents.length && body.expectedCostCents === expansion.totalCostCents, 'Le projet a changé. Actualise l’entrepôt.');
      spend(expansion.totalCostCents);
      for (let next = state.tents.length + 1; next <= expansion.nextUnits!; next++) state.tents.push({ ...inventory(KQ_STARTING_EQUIPMENT_CODES), tentNumber: next });
      state.events.push('expand'); payload = { productionUnits: state.tents.length, cashAfterCents: c.cashCents };
    } else if (body.action === 'route-plan') {
      state.routePlan = typeof body.route === 'string' && typeof body.equipmentCode === 'string' ? { route: body.route, equipmentCode: body.equipmentCode } : null;
      payload = { routePlan: state.routePlan };
    } else if (method === 'POST') {
      const codes = Array.isArray(body.equipmentCodes) ? body.equipmentCodes.filter((code): code is string => typeof code === 'string') : [];
      const validation = validateKqEquipmentCart({ cartCodes: codes, ownedCodes: [...tent!.ownedCodes, ...state.shared.ownedCodes], cashCents: c.cashCents, productionUnits: 1 });
      requireCondition(codes.length > 0 && !validation.errors.length, validation.errors[0] ?? 'Choisis du matériel dans le catalogue.'); spend(validation.totalCents);
      for (const code of validation.uniqueCodes) {
        const target = isKqSharedEquipment(code) ? state.shared : tent!;
        target.ownedCodes.push(code); target.purchasedCodes.push(code); target.levels[code] = 1;
      }
      state.events.push('purchase'); payload = { tentNumber: number, equipmentCodes: codes, totalPriceCents: validation.totalCents, cashAfterCents: c.cashCents };
    } else {
      const code = String(body.equipmentCode ?? '');
      const item = getKqEquipmentDefinition(code);
      const target = isKqSharedEquipment(code) ? state.shared : tent!;
      requireCondition(item && target.purchasedCodes.includes(code), 'Équipement non acheté dans cet atelier.');
      if (body.action === 'upgrade') {
        const level = target.levels[code] ?? 1;
        const cost = getKqEquipmentUpgradeCost(code, level, 1);
        requireCondition(cost !== null && level === body.expectedLevel, 'Niveau déjà atteint ou modifié.'); spend(cost!);
        target.levels[code] = level + 1;
        state.events.push('upgrade'); payload = { level: level + 1, cashAfterCents: c.cashCents };
      } else if (body.action === 'repair') {
        const condition = target.maintenance[code];
        requireCondition(condition?.due && condition.version === body.expectedVersion, 'Cette machine est déjà prête.'); spend(condition.repairCents);
        target.maintenance[code] = getKqMachineCondition(code, target.levels[code], 0, condition.version + 1)!;
        state.events.push('repair'); payload = { repaired: true };
      } else if (body.action === 'replace') {
        const condition = target.cultureWear[code];
        requireCondition(condition?.due && condition.version === body.expectedVersion, 'Cet équipement fonctionne encore.'); spend(condition.replacementCents);
        target.cultureWear[code] = getKqCultureEquipmentCondition(code, target.levels[code], 0, condition.version + 1)!;
        state.events.push('replace'); payload = { replaced: true };
      } else {
        requireCondition(!body.action, 'Action d’équipement inconnue.');
        const requirement = getKqEquipmentRequirementState({ equipment: item!, ownedCodes: [...tent!.ownedCodes, ...state.shared.ownedCodes], cartCodes: [] });
        requireCondition(requirement.compatible && !target.cultureWear[code]?.due, 'Complète les prérequis avant cette installation.');
        target.equippedCodes = target.equippedCodes.filter(other => getKqEquipmentDefinition(other)?.slot !== item!.slot).concat(code);
        state.events.push('install'); payload = { installed: code };
      }
    }
  } else if (url.pathname === '/api/arena/placard/commerce') {
    if (body.action === 'buy-computer') {
      requireCondition(!c.computerOwned, 'Ordinateur déjà disponible.'); spend(KQ_COMPUTER_PRICE_CENTS); c.computerOwned = true;
      payload = { action: 'buy-computer', cashAfterCents: c.cashCents };
    } else if (body.action === 'prepare') {
      requireCondition(!state.prepared && body.flowerId === LOT_ID, 'Ce lot est déjà préparé.');
      requireCondition(typeof body.route === 'string' && isKqMarketRouteCode(body.route), 'Filière inconnue.');
      const route = body.route as KqMarketRouteCode;
      const quote = routes(state).find(item => item.route === route)!;
      requireCondition(quote.available || route === 'raw' || route === 'biomass', quote.blockedReason ?? 'Filière indisponible.');
      const cost = quote.market?.processingCostCents ?? 0;
      requireCondition(body.expectedCostCents === cost, 'Le coût a changé.'); spend(cost);
      const stock = (id: string, target: KqMarketRouteCode, grams: number, equivalent: number, base: number): KqCommerceStock => ({ id, flowerId: LOT_ID, name: 'La récolte de Sylvain · essai', route: target, batchRoute: target, juryScore: trialQuality(state.trial), initialUnits: Math.round(grams * 10), remainingUnits: Math.round(grams * 10), equivalentUnits: Math.round(equivalent * 10), originalUnits: Math.round((state.trial.game?.harvestGrams ?? 0) * 10), baseUnitCents: base, payoutExact: 0, payoutRounded: 0, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false });
      c.stocks = [stock('operations-stock', route, quote.productGrams, quote.processedInputGrams, quote.productBaseUnitCents ?? 30)];
      if (quote.remainderGrams > 0) {
        const remainderRoute = quote.remainderDestination === 'raw' ? 'raw' : 'biomass';
        const remainder = routes(state).find(item => item.route === remainderRoute)!;
        c.stocks.push(stock('operations-remainder', remainderRoute, quote.remainderGrams, quote.remainderGrams, remainder.productBaseUnitCents ?? 30));
      }
      const now = new Date(state.trial.clock).toISOString();
      c.campaign = { id: 'operations-campaign', revision: 0, reputation: c.reputation, clientsStart: c.clients, shopPartnersStart: c.shopPartners, event: 'normal', internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 };
      c.demand = { serverNow: now, updatedAt: now, onlineDebt: 0, shopDebt: 0, growthResetsAt: new Date(state.trial.clock + 86400000).toISOString() };
      state.prepared = true; state.events.push('prepare'); c.revision++;
      payload = { action: 'prepare', stockId: 'operations-stock', flowerId: LOT_ID, cashAfterCents: c.cashCents };
    } else if (body.action === 'quote') {
      const stock = c.stocks.find(item => item.id === body.stockId);
      requireCondition(stock && KQ_SALES_CHANNELS.includes(body.channel as KqSalesChannel) && ['advised', 'premium', 'discovery'].includes(String(body.policy)), 'Choisis un lot et un circuit disponibles.');
      const offer = quoteKqCommerce(c, stock!, body.channel as KqSalesChannel, body.policy as KqOnlinePrice, typeof body.units === 'number' ? body.units : undefined, state.trial.clock);
      requireCondition(!offer.reason && offer.units > 0, offer.reason ?? 'Aucune quantité à vendre.');
      const quoteId = `operations-quote-${Object.keys(state.quotes).length + 1}`;
      state.quotes[quoteId] = { offer, stockId: stock!.id, revision: c.revision };
      const payment = previewKqBusinessPayment(offer.payoutCents, c.business!, state.trial.electricity);
      payload = { quoteId, offer, ...payment, expiresAt: new Date(state.trial.clock + 600000).toISOString() };
    } else if (body.action === 'sell') {
      const quote = state.quotes[String(body.quoteId)];
      requireCondition(quote && quote.revision === c.revision && quote.offer.payoutCents === body.expectedPayoutCents, 'Recalcule l’offre avant de vendre.');
      const { offer } = quote;
      const stock = c.stocks.find(item => item.id === quote.stockId)!;
      requireCondition(stock.remainingUnits >= offer.units, 'Ce stock a déjà été vendu.');
      const payment = previewKqBusinessPayment(offer.payoutCents, c.business!, state.trial.electricity);
      c.cashCents += payment.netPayoutCents; state.trial.electricity = payment.electricityRemainingCents;
      c.business!.vat.salesTtcCents += offer.payoutCents; c.business!.vat.reservedCents += payment.vatCents;
      let lab = payment.labPaidCents;
      for (const invoice of c.business!.lab.invoices) if (Date.parse(invoice.dueAt) <= state.trial.clock) { const paid = Math.min(lab, invoice.remainingCents); invoice.remainingCents -= paid; lab -= paid; }
      c.business!.lab.outstandingCents -= payment.labPaidCents; c.business!.lab.overdueCents -= payment.labPaidCents;
      c.reputation = Math.max(0, c.reputation + offer.reputationDelta); c.clients = offer.clientsAfter; c.shopPartners = offer.shopPartnersAfter;
      c.shopRecruitment = offer.shopRecruitmentAfter; c.shopChurn = offer.shopChurnAfter;
      c.demand!.onlineDebt = Math.min(1, c.demand!.onlineDebt + offer.directCost / (getKqCommerceCapacity(c.campaign!.reputation).baseUnits * (1 + .25 * Math.min(1, c.campaign!.clientsStart / getKqCommerceCapacity(c.campaign!.reputation).maxClients))));
      c.demand!.shopDebt = Math.min(1, c.demand!.shopDebt + offer.shopCost / getKqShopBudget(c.campaign!.shopPartnersStart ?? 0, c.campaign!.event));
      Object.assign(c.campaign!, { goodUnits: offer.goodUnitsAfter, disappointmentUnits: offer.disappointmentAfter, shopGoodUnits: offer.shopGoodUnitsAfter, shopBadUnits: offer.shopBadUnitsAfter });
      Object.assign(stock, { remainingUnits: stock.remainingUnits - offer.units, payoutExact: offer.payoutExactAfter, payoutRounded: offer.payoutRoundedAfter, repExact: offer.repExactAfter, repRounded: offer.repRoundedAfter });
      c.ownVolumes[stock.route] = (c.ownVolumes[stock.route] ?? 0) + offer.equivalentSold / 10;
      c.revision++; state.events.push('sell');
      const receipt: KqCommerceReceipt = { action: 'sell', stockId: stock.id, flowerId: LOT_ID, channel: offer.channel, units: offer.units, payoutCents: offer.payoutCents, ...payment, cashAfterCents: c.cashCents, reputationGain: offer.reputationDelta, satisfaction: offer.satisfaction, clientsBefore: offer.clientsBefore, clientsAfter: offer.clientsAfter, shopPartnersBefore: offer.shopPartnersBefore, shopPartnersAfter: offer.shopPartnersAfter, shopPartnersDelta: offer.shopPartnersAfter - offer.shopPartnersBefore, shopPricePercent: offer.shopPricePercent, remainingUnits: stock.remainingUnits };
      c.receipts.push(receipt); payload = receipt;
    } else throw new Error('Cette opération se découvre dans l’atelier Trésorerie.');
  } else throw new Error('Action indisponible dans cet atelier.');
  if (receiptKey) state.receipts[receiptKey] = payload;
  return { state, payload };
}

export function getKqOperationsProgress(state: KqOperationsLessonState) {
  if (state.lesson === 'market') return { complete: state.events.includes('sell'), instruction: state.events.includes('sell') ? 'Ta vente est enregistrée dans cet essai. Compare un autre circuit avec le reste du lot, ou explore un autre espace.' : state.prepared ? 'Ton produit est prêt. Choisis un circuit, compare le prix et la quantité, puis confirme ta vente fictive.' : 'Ouvre le lot de Sylvain. Choisis une transformation, puis passe aux offres de vente.' };
  if (state.lesson === 'warehouse') return { complete: state.events.some(event => ['upgrade', 'repair', 'expand', 'replace'].includes(event)), instruction: state.events.length ? 'Observe les changements dans ton entrepôt. Tu peux améliorer une autre machine ou agrandir ton installation.' : 'Explore l’entrepôt : choisis une machine pour l’améliorer ou l’entretenir, ou ouvre le projet d’agrandissement.' };
  return { complete: state.events.includes('purchase') && state.events.includes('install'), instruction: state.events.includes('install') ? 'Ton matériel est installé. Observe sa place dans l’entrepôt, puis compare les modes d’énergie.' : state.events.includes('purchase') ? 'Ton achat est en réserve. Ouvre l’entrepôt et installe-le à son emplacement.' : 'Choisis une lampe dans la vraie boutique. Ajoute-la au panier et confirme ton achat avec le budget prêté.' };
}
