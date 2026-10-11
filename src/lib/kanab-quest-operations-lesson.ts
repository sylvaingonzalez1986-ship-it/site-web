import { KQ_EQUIPMENT_CATALOG, KQ_STARTING_EQUIPMENT_CODES, getKqEquipmentBuildingNumber, getKqEquipmentDefinition, getKqEquipmentRequirementState, getKqEquipmentUpgradeCost, isKqBuildingEquipment, isKqSharedEquipment, validateKqEquipmentCart } from './kanab-quest-equipment';
import { getKqEffectiveTentProfiles, getKqProductionExpansion } from './kanab-quest-production';
import { createChanvrierCareerSnapshot } from './chanvrier-career';
import { getKqMachineCondition, type KqMachineCondition } from './kanab-quest-maintenance';
import { getKqCultureEquipmentCondition, getKqCultureOperationalCodes, type KqCultureEquipmentCondition } from './kanab-quest-culture-wear';
import { quoteKqEnergy, quoteKqTentEnergy, type KqEnergyMode } from './kanab-quest-energy';
import { KQ_COMPUTER_PRICE_CENTS, KQ_SALES_CHANNELS, getKqCommerceCapacity, getKqShopBudget, quoteKqCommerce, type KqCommerceOffer, type KqCommerceReceipt, type KqCommerceSnapshot, type KqCommerceStock, type KqOnlinePrice, type KqSalesChannel } from './kanab-quest-commerce';
import { KQ_GAME_MONTH_MS, normalizeKqShopName, previewKqBusinessPayment } from './kanab-quest-business';
import { createKqOnlinePreview, getKqOnlineSiteTier } from './kanab-quest-online';
import { applyKqOperationsOnline } from './kanab-quest-operations-online';
import { KQ_MARKET_ROUTES, isKqMarketRouteCode, quoteKqMarketRoutes, type KqMarketRouteCode } from './kanab-quest-market';
import { getKqMarketWindow } from './kanab-quest-market-demand';
import { createKqWorkshop } from './kanab-quest-workshops';
import { advanceKqTrialClock, KQ_TUTORIAL_STORAGE_NOTICE, trialQuality, type KqTrialState } from './kanab-quest-trial';
import { changeKqStorageCapacity, changeKqStorageMethod, createKqStorageLot, fillKqStorageCapacity, getKqStorageContainer, getKqStorageInventory, getKqStorageMethod, KQ_STARTER_STORAGE_CONTAINERS, KQ_STORAGE_CONTAINERS, KQ_STORAGE_METHODS, KQ_STORAGE_OVERFLOW_CENTS_PER_GRAM, planKqStorageAllocation, projectKqStorageLot, resizeKqStorageCapacity, type KqStorageCapacity, type KqStorageLot, type KqStorageMethodCode } from './kanab-quest-storage';

export type KqOperationsLessonId = 'equipment' | 'warehouse' | 'market';
type Inventory = { ownedCodes: string[]; purchasedCodes: string[]; equippedCodes: string[]; levels: Record<string, number>; maintenance: Record<string, KqMachineCondition>; cultureWear: Record<string, KqCultureEquipmentCondition> };
type Tent = Inventory & { tentNumber: number };
type Building = Inventory & { buildingNumber: number; anchorTentNumber: number };
type PreparedQuote = { offer: KqCommerceOffer; stockId: string; revision: number };
export type KqOperationsLessonState = {
  lesson: KqOperationsLessonId; trial: KqTrialState; tents: Tent[]; buildings: Building[]; shared: Inventory;
  storage: { ownedContainers: Record<string, number>; defaultMethodCode: KqStorageMethodCode; lot: KqStorageLot; revision: number;
    overflowSales: Array<{ flowerId: string; units: number; payoutCents: number; netPayoutCents: number; soldAt: string; automatic: boolean }> };
  prepared: boolean; events: string[]; routePlan: { route: string; equipmentCode: string } | null;
  quotes: Record<string, PreparedQuote>; receipts: Record<string, unknown>;
  onlineOrderCredits?: Record<string, number>;
  onlineSimulation?: { packedQualities: Record<string, number>; promotedFlowerIds: string[]; clientDay: string; clientsStart: number; clientsGained: number; clientsLost: number; loyaltyProgress: number; churnProgress: number };
};
export type KqOperationsLessonAction = { path: string; method: string; body: Record<string, unknown> };
const LOT_ID = 'operations-lesson-flower';

function inventory(codes: readonly string[], equipped = codes): Inventory {
  const cultureWear: Inventory['cultureWear'] = {};
  for (const code of codes) {
    const condition = getKqCultureEquipmentCondition(code, 1, 0);
    if (condition) cultureWear[code] = condition;
  }
  return { ownedCodes: [...codes], purchasedCodes: codes.filter(code => getKqEquipmentDefinition(code)?.purchasable), equippedCodes: [...equipped], levels: Object.fromEntries(codes.map(code => [code, 1])), maintenance: {}, cultureWear };
}

export function createKqOperationsLesson(lesson: KqOperationsLessonId): KqOperationsLessonState {
  let trial = createKqWorkshop('market');
  const totalUnits = Math.round((trial.game?.harvestGrams ?? 0) * 10);
  // Only the market exercise lends sufficient jars with its already matured lot.
  // The warehouse exercise demonstrates the ordinary two-jar starter capacity.
  const ownedContainers: Record<string, number> = { ...KQ_STARTER_STORAGE_CONTAINERS,
    ...(lesson === 'market' ? { 'GLASS-1L': Math.max(2, Math.ceil(totalUnits / 500)) } : {}),
  };
  const { terpenes, cannabinoidExpression, cannabinoidConversion, cannabinoidOxidation } = trial.game!.care!;
  const lot = createKqStorageLot({ flowerId: LOT_ID, harvestedAt: trial.game!.completedAt!, curingStartedAt: trial.battle!.burnedAt!,
    capacity: planKqStorageAllocation({ totalUnits, ownedContainers, preferredMethodCode: 'STORAGE-GLASS', nowMs: trial.clock }),
    baseline: { varietyCode: trial.game!.varietyCode, juryScore: trialQuality(trial), aroma: trial.battle!.playerFlower.stats.aroma,
      care: { terpenes, cannabinoidExpression, cannabinoidConversion, cannabinoidOxidation } },
  });
  if (lesson === 'market') trial = advanceKqTrialClock(trial, Date.parse(lot.readyAt));
  trial.commerce.cashCents = 500_000;
  // The lent harvest arrives with its previous culture's electricity settled.
  trial.electricity = 0;
  // A shop is lent with the evaluated lot so all three real distribution screens
  // can be explored. Creating a real shop belongs to the treasury lesson.
  trial.commerce.computerOwned = true;
  trial.commerce.online = createKqOnlinePreview(trial.clock);
  if (trial.commerce.business) trial.commerce.business.shop = { name: 'Le shop de Sylvain · essai', createdAt: new Date(trial.clock).toISOString(), paidUntil: null, renew: false, active: true, tier: 'basic', monthlyCents: 0 };
  const tent: Tent = { ...inventory(KQ_STARTING_EQUIPMENT_CODES), tentNumber: 1 };
  const building: Building = { ...inventory(lesson === 'equipment' ? [] : ['DRYING-ROOM']), buildingNumber: 1, anchorTentNumber: 1 };
  const shared = inventory(lesson === 'equipment' ? [] : ['SIFT-TRAY', 'PRESS-0600']);
  if (lesson !== 'equipment') {
    tent.ownedCodes.push('LED-300'); tent.purchasedCodes.push('LED-300');
    tent.equippedCodes = tent.equippedCodes.filter(code => getKqEquipmentDefinition(code)?.slot !== 'lighting').concat('LED-300');
    tent.levels['LED-300'] = 1;
  }
  if (lesson === 'warehouse') {
    const machine = KQ_EQUIPMENT_CATALOG.find(item => item.category === 'processing' && getKqMachineCondition(item.code, 1, 10)?.due);
    if (machine && !shared.ownedCodes.includes(machine.code)) {
      shared.ownedCodes.push(machine.code); shared.purchasedCodes.push(machine.code); shared.equippedCodes.push(machine.code); shared.levels[machine.code] = 1;
    }
    if (machine) shared.maintenance[machine.code] = getKqMachineCondition(machine.code, 1, 10)!;
    tent.cultureWear['LED-300'] = getKqCultureEquipmentCondition('LED-300', 1, 60)!;
  }
  return { lesson, trial, tents: [tent], buildings: [building], shared, storage: { ownedContainers, defaultMethodCode: 'STORAGE-GLASS', lot, revision: 0, overflowSales: [] }, prepared: false, events: [], routePlan: null, quotes: {}, receipts: {} };
}

function lessonStorageMethods(state: KqOperationsLessonState) {
  return KQ_STORAGE_METHODS.filter(method => KQ_STORAGE_CONTAINERS.some(container => container.methodCode === method.code && state.storage.ownedContainers[container.code] > 0)).map(method => method.code);
}

function updateLessonStorage(state: KqOperationsLessonState, capacity: KqStorageCapacity, methodCode?: KqStorageMethodCode) {
  const now = state.trial.clock;
  state.storage.lot = changeKqStorageCapacity(state.storage.lot, capacity, now);
  if (methodCode) state.storage.lot = changeKqStorageMethod(state.storage.lot, methodCode, now);
  state.storage.revision++; state.trial.commerce.revision++;
  const projection = projectKqStorageLot(state.storage.lot, now);
  state.trial.commerce.stocks = state.trial.commerce.stocks.map(stock => ({ ...stock, storage: projection, storageRevision: state.storage.revision }));
}

function collectLessonPayment(state: KqOperationsLessonState, payoutCents: number) {
  const c = state.trial.commerce;
  const payment = previewKqBusinessPayment(payoutCents, c.business!, state.trial.electricity);
  c.cashCents += payment.netPayoutCents; state.trial.electricity = payment.electricityRemainingCents;
  c.business!.vat.salesTtcCents += payoutCents; c.business!.vat.reservedCents += payment.vatCents;
  let lab = payment.labPaidCents;
  for (const invoice of c.business!.lab.invoices) if (Date.parse(invoice.dueAt) <= state.trial.clock) { const paid = Math.min(lab, invoice.remainingCents); invoice.remainingCents -= paid; lab -= paid; }
  c.business!.lab.outstandingCents -= payment.labPaidCents; c.business!.lab.overdueCents -= payment.labPaidCents;
  return payment;
}

function sellLessonOverflow(state: KqOperationsLessonState, automatic: boolean) {
  const capacity = projectKqStorageLot(state.storage.lot, state.trial.clock).capacity!;
  requireCondition(capacity.overflowUnits > 0 && !state.prepared, 'Aucun surplus à vendre dans cet essai.');
  // Same fixed early-clearance game tariff as the authoritative storage RPC.
  const payoutCents = Math.round(capacity.overflowUnits * KQ_STORAGE_OVERFLOW_CENTS_PER_GRAM / 10);
  const payment = collectLessonPayment(state, payoutCents);
  state.storage.overflowSales.push({ flowerId: LOT_ID, units: capacity.overflowUnits, payoutCents, netPayoutCents: payment.netPayoutCents, soldAt: new Date(state.trial.clock).toISOString(), automatic });
  updateLessonStorage(state, resizeKqStorageCapacity(state.storage.lot.capacity!, capacity.protectedUnits));
  state.events.push('storage-overflow-sale');
}

export function getKqOperationsStorage(state: KqOperationsLessonState) {
  const projection = projectKqStorageLot(state.storage.lot, state.trial.clock);
  const containers = getKqStorageInventory(state.storage.ownedContainers, state.storage.lot.capacity?.allocations);
  return { serverNow: new Date(state.trial.clock).toISOString(), cashCents: state.trial.commerce.cashCents,
    ownedMethodCodes: lessonStorageMethods(state), ownedContainers: state.storage.ownedContainers, defaultMethodCode: state.storage.defaultMethodCode,
    catalog: KQ_STORAGE_METHODS, containers, overflowSales: state.storage.overflowSales,
    capacity: { totalUnits: containers.reduce((sum, item) => sum + item.ownedQuantity * item.capacityUnits, 0),
      usedUnits: projection.capacity!.protectedUnits, reservedUnits: projection.capacity!.reservedCapacityUnits,
      freeUnits: containers.reduce((sum, item) => sum + item.freeQuantity * item.capacityUnits, 0), overflowUnits: projection.capacity!.overflowUnits },
    lots: state.prepared && state.trial.commerce.stocks.every(stock => stock.remainingUnits === 0) ? [] : [{
      flowerId: LOT_ID, varietyName: 'La récolte de Sylvain · essai', harvestGrams: state.trial.game?.harvestGrams ?? 0,
      flowerStatus: state.trial.battle!.playerFlower.status, projection,
    }],
  };
}

export function getKqOperationsEquipment(state: KqOperationsLessonState, tentNumber = 1) {
  const profile = <T extends Inventory>(source: T, scope: 'tent' | 'building' | 'workshop') => {
    const cultureOperationalCodes = scope === 'tent' ? getKqCultureOperationalCodes(source.equippedCodes, source.cultureWear)
      : source.equippedCodes.filter(code => !source.cultureWear[code]?.due);
    return { ...source, cultureOperationalCodes, operationalCodes: cultureOperationalCodes.filter(code => !source.maintenance[code]?.due) };
  };
  const tents = state.tents.map(tent => profile(tent, 'tent'));
  const buildings = state.buildings.map(building => profile(building, 'building'));
  const sharedEquipment = profile(state.shared, 'workshop');
  const tent = tents.find(item => item.tentNumber === tentNumber) ?? tents[0];
  const building = buildings.find(item => item.buildingNumber === getKqEquipmentBuildingNumber(tent.tentNumber))!;
  const scopes = [tent, building, sharedEquipment];
  return { ...tent, tents, buildings, equipmentScopeVersion: 3 as const, sharedEquipment, cashCents: state.trial.commerce.cashCents,
    career: createChanvrierCareerSnapshot({ xp: 4500, completedCultures: 45, processingPractice: { sifting: 10, washing: 6, pressing: 6 } }),
    storageCapacity: getKqOperationsStorage(state).capacity,
    expansionEnergyCents: state.tents.length < 8 ? quoteKqEnergy([...KQ_STARTING_EQUIPMENT_CODES]).totalCents : 0,
    ownedCodes: scopes.flatMap(item => item.ownedCodes), purchasedCodes: scopes.flatMap(item => item.purchasedCodes),
    equippedCodes: scopes.flatMap(item => item.equippedCodes), levels: { ...tent.levels, ...building.levels, ...sharedEquipment.levels },
    maintenance: { ...tent.maintenance, ...building.maintenance, ...sharedEquipment.maintenance },
    cultureWear: { ...tent.cultureWear, ...building.cultureWear },
    cultureOperationalCodes: scopes.flatMap(item => item.cultureOperationalCodes), operationalCodes: scopes.flatMap(item => item.operationalCodes),
    productionUnits: state.tents.length, equipmentPricingUnits: 1, production: getKqProductionExpansion(state.tents.length),
    routePlan: state.routePlan, catalog: KQ_EQUIPMENT_CATALOG, reputation: state.trial.commerce.reputation, activeRun: false,
  };
}

function routes(state: KqOperationsLessonState) {
  const equipment = getKqOperationsEquipment(state);
  const commerce = state.trial.commerce;
  const operational = equipment.equippedCodes.filter(code => !state.shared.maintenance[code]?.due);
  return quoteKqMarketRoutes({ juryScore: projectKqStorageLot(state.storage.lot, state.trial.clock).conditionScore, harvestGrams: (state.storage.lot.capacity?.totalUnits ?? 0) / 10,
    equipmentCodes: operational, equipmentLevels: equipment.levels,
    marketContext: { reputation: commerce.reputation, routeSales: commerce.routeSales, recentSales: {}, marketVolumes: commerce.marketVolumes, window: getKqMarketWindow(state.trial.clock) },
  });
}

export function getKqOperationsCommerce(state: KqOperationsLessonState): KqCommerceSnapshot {
  return { ...state.trial.commerce, rawLots: state.prepared ? [] : [{ flowerId: LOT_ID, varietyName: 'La récolte de Sylvain · essai', juryScore: trialQuality(state.trial), harvestGrams: (state.storage.lot.capacity?.totalUnits ?? 0) / 10, options: routes(state), storage: projectKqStorageLot(state.storage.lot, state.trial.clock) }], electricityOutstandingCents: state.trial.electricity };
}

export function getKqOperationsEnergy(state: KqOperationsLessonState) {
  const equipment = getKqOperationsEquipment(state);
  const profiles = getKqEffectiveTentProfiles(equipment);
  return { cashCents: state.trial.commerce.cashCents, productionUnits: equipment.tents.length, tents: equipment.tents,
    buildings: equipment.buildings, equipmentScopeVersion: equipment.equipmentScopeVersion, outstandingCents: 0, invoiceCount: 0, bestGramsPerKwh: null, invoices: [],
    cultureEquipmentCodes: equipment.equippedCodes, cultureOperationalCodes: equipment.cultureOperationalCodes, cultureWear: equipment.cultureWear,
    quotes: Object.fromEntries((['eco', 'balanced', 'intensive'] as KqEnergyMode[]).map(mode => [mode, quoteKqTentEnergy(profiles, mode, 'building')])),
  };
}

function requireCondition(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

/** Executes only this exercise. Unknown endpoints fail closed; there is no network fallback. */
export function applyKqOperationsRequest(current: KqOperationsLessonState, action: KqOperationsLessonAction): { state: KqOperationsLessonState; payload: unknown } {
  const { method, body } = action;
  const url = new URL(action.path, 'https://lesson.invalid');
  requireCondition(url.origin === 'https://lesson.invalid', 'Cette action ne fait pas partie de cet atelier.');
  if (projectKqStorageLot(current.storage.lot, current.trial.clock).capacity?.overflowDue) {
    current = structuredClone(current);
    sellLessonOverflow(current, true);
  }
  if (method === 'GET') {
    if (url.pathname === '/api/arena/placard/equipment') return { state: current, payload: getKqOperationsEquipment(current, Number(url.searchParams.get('tentNumber')) || 1) };
    if (url.pathname === '/api/arena/placard/commerce') return { state: current, payload: getKqOperationsCommerce(current) };
    if (url.pathname === '/api/arena/placard/energy') return { state: current, payload: getKqOperationsEnergy(current) };
    if (url.pathname === '/api/arena/placard/storage') return { state: current, payload: getKqOperationsStorage(current) };
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
    const building = state.buildings.find(item => item.buildingNumber === getKqEquipmentBuildingNumber(number))!;
    const ownedCodes = [...tent.ownedCodes, ...building.ownedCodes, ...state.shared.ownedCodes];
    const targetInventory = (code: string) => isKqSharedEquipment(code) ? state.shared : isKqBuildingEquipment(code) ? building : tent;
    if (body.action === 'expand-production') {
      const expansion = getKqProductionExpansion(state.tents.length);
      requireCondition(expansion.nextUnits && body.expectedUnits === state.tents.length && body.expectedCostCents === expansion.totalCostCents, 'Le projet a changé. Actualise l’entrepôt.');
      spend(expansion.totalCostCents);
      for (let next = state.tents.length + 1; next <= expansion.nextUnits!; next++) state.tents.push({ ...inventory(KQ_STARTING_EQUIPMENT_CODES), tentNumber: next });
      if (state.buildings.length < Math.ceil(state.tents.length / 4)) state.buildings.push({ ...inventory([]), buildingNumber: 2, anchorTentNumber: 5 });
      state.events.push('expand'); payload = { productionUnits: state.tents.length, cashAfterCents: c.cashCents };
    } else if (body.action === 'route-plan') {
      state.routePlan = typeof body.route === 'string' && typeof body.equipmentCode === 'string' ? { route: body.route, equipmentCode: body.equipmentCode } : null;
      payload = { routePlan: state.routePlan };
    } else if (method === 'POST') {
      const codes = Array.isArray(body.equipmentCodes) ? body.equipmentCodes.filter((code): code is string => typeof code === 'string') : [];
      const validation = validateKqEquipmentCart({ cartCodes: codes, ownedCodes, cashCents: c.cashCents, productionUnits: 1 });
      requireCondition(codes.length > 0 && !validation.errors.length, validation.errors[0] ?? 'Choisis du matériel dans le catalogue.'); spend(validation.totalCents);
      for (const code of validation.uniqueCodes) {
        const target = targetInventory(code);
        target.ownedCodes.push(code); target.purchasedCodes.push(code); target.levels[code] = 1;
        const condition = getKqCultureEquipmentCondition(code, 1, 0);
        if (condition) target.cultureWear[code] = condition;
      }
      state.events.push('purchase'); payload = { tentNumber: number, equipmentCodes: codes, totalPriceCents: validation.totalCents, cashAfterCents: c.cashCents };
    } else {
      const code = String(body.equipmentCode ?? '');
      const item = getKqEquipmentDefinition(code);
      const target = targetInventory(code);
      requireCondition(item && target.purchasedCodes.includes(code), 'Équipement non acheté dans cet atelier.');
      if (body.action === 'upgrade') {
        const level = target.levels[code] ?? 1;
        const cost = getKqEquipmentUpgradeCost(code, level, 1);
        requireCondition(cost !== null && level === body.expectedLevel, 'Niveau déjà atteint ou modifié.'); spend(cost!);
        target.levels[code] = level + 1;
        state.events.push('upgrade'); payload = { level: level + 1, cashAfterCents: c.cashCents };
      } else if (body.action === 'repair') {
        const condition = target.maintenance[code];
        requireCondition(condition && condition.cycles > 0 && condition.version === body.expectedVersion, 'Cette machine est déjà prête.'); spend(condition.repairCents);
        target.maintenance[code] = getKqMachineCondition(code, target.levels[code], 0, condition.version + 1)!;
        state.events.push('repair'); payload = { repaired: true };
      } else if (body.action === 'replace') {
        const condition = target.cultureWear[code];
        requireCondition(condition?.due && condition.version === body.expectedVersion, 'Cet équipement fonctionne encore.'); spend(condition.replacementCents);
        target.cultureWear[code] = getKqCultureEquipmentCondition(code, target.levels[code], 0, condition.version + 1)!;
        state.events.push('replace'); payload = { replaced: true };
      } else {
        requireCondition(!body.action, 'Action d’équipement inconnue.');
        const requirement = getKqEquipmentRequirementState({ equipment: item!, ownedCodes, cartCodes: [] });
        requireCondition(requirement.compatible && !target.cultureWear[code]?.due, 'Complète les prérequis avant cette installation.');
        target.equippedCodes = target.equippedCodes.filter(other => getKqEquipmentDefinition(other)?.slot !== item!.slot).concat(code);
        state.events.push('install'); payload = { installed: code };
      }
    }
  } else if (url.pathname === '/api/arena/placard/storage') {
    requireCondition(method === 'POST', 'Le stockage accepte les actions POST dans cet essai.');
    if (body.action === 'buy') {
      const container = getKqStorageContainer(String(body.containerCode ?? ''));
      requireCondition(container, 'Contenant de conservation inconnu.');
      const quantity = body.quantity;
      requireCondition(typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 1000, 'Choisis entre 1 et 1 000 contenants.');
      spend(container.priceCents * quantity);
      state.storage.ownedContainers[container.code] = (state.storage.ownedContainers[container.code] ?? 0) + quantity;
      updateLessonStorage(state, fillKqStorageCapacity(state.storage.lot.capacity!, { ownedContainers: state.storage.ownedContainers, preferredMethodCode: state.storage.defaultMethodCode, nowMs: state.trial.clock }));
      state.events.push('storage-purchase');
    } else if (body.action === 'sell-overflow') {
      requireCondition(body.flowerId === LOT_ID, 'Lot indisponible dans cet essai.');
      sellLessonOverflow(state, false);
    } else {
      const storageMethod = getKqStorageMethod(String(body.methodCode ?? ''));
      requireCondition(storageMethod, 'Installation de conservation inconnue.');
      requireCondition(lessonStorageMethods(state).includes(storageMethod.code), 'Achète un contenant de cette famille dans cet essai avant de la choisir.');
      if (body.action === 'select-default') {
        state.storage.defaultMethodCode = storageMethod.code; state.events.push('storage-default');
      } else if (body.action === 'assign') {
        requireCondition(body.flowerId === LOT_ID && (!state.prepared || c.stocks.some(stock => stock.remainingUnits > 0)), 'Lot indisponible dans cet essai.');
        updateLessonStorage(state, planKqStorageAllocation({ totalUnits: state.storage.lot.capacity!.totalUnits, ownedContainers: state.storage.ownedContainers,
          preferredMethodCode: storageMethod.code, overflowDeadlineAt: state.storage.lot.capacity!.overflowDeadlineAt, nowMs: state.trial.clock }), storageMethod.code);
        state.events.push('storage-assign');
      } else throw new Error('Action de stockage inconnue.');
    }
    payload = getKqOperationsStorage(state);
  } else if (url.pathname === '/api/arena/placard/commerce') {
    if (body.action === 'online') {
      payload = applyKqOperationsOnline(state, body.command, body.payload, {
        spend,
        collect: cents => collectLessonPayment(state, cents),
        releaseStorage: () => {
          const remaining = c.stocks.reduce((sum, stock) => sum + (stock.initialUnits > 0 ? Math.ceil(stock.equivalentUnits * stock.remainingUnits / stock.initialUnits) : 0), 0);
          updateLessonStorage(state, resizeKqStorageCapacity(state.storage.lot.capacity!, remaining));
        },
      });
    } else if (body.action === 'rename-shop') {
      c.business!.shop.name = normalizeKqShopName(body.name);
      c.revision++;
      payload = { action: body.action, cashAfterCents: c.cashCents };
    } else if (body.action === 'shop-renewal' || body.action === 'renew-shop') {
      const online = c.online!;
      if (body.action === 'shop-renewal') {
        requireCondition(typeof body.enabled === 'boolean', 'Choisis une reconduction valide.');
        online.site.renew = body.enabled;
      } else {
        requireCondition(!online.site.active, 'Le site est déjà actif.');
        const tier = getKqOnlineSiteTier(online.site.tier);
        spend(tier.monthlyCents);
        online.site.paidUntil = tier.monthlyCents ? new Date(state.trial.clock + KQ_GAME_MONTH_MS).toISOString() : null;
        online.site.active = true;
      }
      Object.assign(c.business!.shop, { paidUntil: online.site.paidUntil, active: online.site.active, renew: online.site.renew });
      c.revision++;
      payload = { action: body.action, cashAfterCents: c.cashCents };
    } else if (body.action === 'sell-overflow') {
      requireCondition(body.flowerId === LOT_ID, 'Lot indisponible dans cet essai.');
      sellLessonOverflow(state, false);
      payload = getKqOperationsStorage(state);
    } else if (body.action === 'buy-computer') {
      requireCondition(!c.computerOwned, 'Ordinateur déjà disponible.'); spend(KQ_COMPUTER_PRICE_CENTS); c.computerOwned = true;
      payload = { action: 'buy-computer', cashAfterCents: c.cashCents };
    } else if (body.action === 'prepare') {
      requireCondition(!state.prepared && body.flowerId === LOT_ID, 'Ce lot est déjà préparé.');
      requireCondition(!projectKqStorageLot(state.storage.lot, state.trial.clock).capacity?.overflowUnits, 'Stocke ou vends le surplus au grossiste avant de préparer ce lot.');
      requireCondition(typeof body.route === 'string' && isKqMarketRouteCode(body.route), 'Filière inconnue.');
      const route = body.route as KqMarketRouteCode;
      const quote = routes(state).find(item => item.route === route)!;
      requireCondition(quote.available || route === 'raw' || route === 'biomass', quote.blockedReason ?? 'Filière indisponible.');
      const cost = quote.market?.processingCostCents ?? 0;
      requireCondition(body.expectedCostCents === cost, 'Le coût a changé.'); spend(cost);
      const stock = (id: string, target: KqMarketRouteCode, grams: number, equivalent: number, base: number): KqCommerceStock => ({ id, flowerId: LOT_ID, name: 'La récolte de Sylvain · essai', route: target, batchRoute: target, juryScore: trialQuality(state.trial), initialUnits: Math.round(grams * 10), remainingUnits: Math.round(grams * 10), equivalentUnits: Math.round(equivalent * 10), originalUnits: Math.round((state.trial.game?.harvestGrams ?? 0) * 10), baseUnitCents: base, payoutExact: 0, payoutRounded: 0, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, storage: projectKqStorageLot(state.storage.lot, state.trial.clock), storageRevision: state.storage.revision });
      c.stocks = [stock('operations-stock', route, quote.productGrams, quote.processedInputGrams, quote.productBaseUnitCents ?? 30)];
      if (quote.remainderGrams > 0) {
        const remainderRoute = quote.remainderDestination === 'raw' ? 'raw' : 'biomass';
        const remainder = routes(state).find(item => item.route === remainderRoute)!;
        c.stocks.push(stock('operations-remainder', remainderRoute, quote.remainderGrams, quote.remainderGrams, remainder.productBaseUnitCents ?? 30));
      }
      const definition = KQ_MARKET_ROUTES.find(item => item.code === route)!;
      for (const code of state.shared.equippedCodes) {
        const machine = getKqEquipmentDefinition(code);
        if (!machine || !definition.requiredUnlocks.some(unlock => machine.unlocks.includes(unlock))) continue;
        const previous = state.shared.maintenance[code];
        const condition = getKqMachineCondition(code, state.shared.levels[code], (previous?.cycles ?? 0) + 1, (previous?.version ?? 0) + 1);
        if (condition) state.shared.maintenance[code] = condition;
      }
      const now = new Date(state.trial.clock).toISOString();
      c.campaign = { id: 'operations-campaign', revision: 0, reputation: c.reputation, clientsStart: c.clients, shopPartnersStart: c.shopPartners, event: 'normal', internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 };
      c.demand = { serverNow: now, updatedAt: now, onlineDebt: 0, shopDebt: 0, growthResetsAt: new Date(state.trial.clock + 86400000).toISOString() };
      state.prepared = true; state.events.push('prepare'); c.revision++;
      payload = { action: 'prepare', stockId: 'operations-stock', flowerId: LOT_ID, cashAfterCents: c.cashCents };
    } else if (body.action === 'quote') {
      requireCondition(body.channel !== 'online', 'La vente en ligne passe par les annonces. Conditionne tes paquets et choisis leur prix.');
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
      const payment = collectLessonPayment(state, offer.payoutCents);
      c.reputation = Math.max(0, c.reputation + offer.reputationDelta); c.clients = offer.clientsAfter; c.shopPartners = offer.shopPartnersAfter;
      c.shopRecruitment = offer.shopRecruitmentAfter; c.shopChurn = offer.shopChurnAfter;
      c.demand!.onlineDebt = Math.min(1, c.demand!.onlineDebt + offer.directCost / (getKqCommerceCapacity(c.campaign!.reputation).baseUnits * (1 + .25 * Math.min(1, c.campaign!.clientsStart / getKqCommerceCapacity(c.campaign!.reputation).maxClients))));
      c.demand!.shopDebt = Math.min(1, c.demand!.shopDebt + offer.shopCost / getKqShopBudget(c.campaign!.shopPartnersStart ?? 0, c.campaign!.event));
      Object.assign(c.campaign!, { goodUnits: offer.goodUnitsAfter, disappointmentUnits: offer.disappointmentAfter, shopGoodUnits: offer.shopGoodUnitsAfter, shopBadUnits: offer.shopBadUnitsAfter });
      Object.assign(stock, { remainingUnits: stock.remainingUnits - offer.units, payoutExact: offer.payoutExactAfter, payoutRounded: offer.payoutRoundedAfter, repExact: offer.repExactAfter, repRounded: offer.repRoundedAfter });
      const remainingEquivalentUnits = c.stocks.reduce((sum, item) => sum + (item.initialUnits > 0 ? Math.ceil(item.equivalentUnits * item.remainingUnits / item.initialUnits) : 0), 0);
      updateLessonStorage(state, resizeKqStorageCapacity(state.storage.lot.capacity!, remainingEquivalentUnits));
      c.ownVolumes[stock.route] = (c.ownVolumes[stock.route] ?? 0) + offer.equivalentSold / 10;
      c.revision++; state.events.push('sell');
      const receipt: KqCommerceReceipt = { action: 'sell', stockId: stock.id, flowerId: LOT_ID, channel: offer.channel, units: offer.units, payoutCents: offer.payoutCents, ...payment, cashAfterCents: c.cashCents, reputationGain: offer.reputationDelta, satisfaction: offer.satisfaction, clientsBefore: offer.clientsBefore, clientsAfter: offer.clientsAfter, shopPartnersBefore: offer.shopPartnersBefore, shopPartnersAfter: offer.shopPartnersAfter, shopPartnersDelta: offer.shopPartnersAfter - offer.shopPartnersBefore, shopPricePercent: offer.shopPricePercent, remainingUnits: stock.remainingUnits };
      c.receipts.push(receipt); payload = receipt;
    } else throw new Error('Cette opération ne fait pas partie de cet essai. La gestion se trouve au Marché et les factures au Bureau.');
  } else throw new Error('Action indisponible dans cet atelier.');
  if (receiptKey) state.receipts[receiptKey] = payload;
  return { state, payload };
}

export function getKqOperationsProgress(state: KqOperationsLessonState) {
  if (state.lesson === 'market') return { complete: state.events.includes('sell'), instruction: state.events.includes('sell') ? 'Ta vente est enregistrée dans cet essai. Compare un autre circuit avec le reste du lot, ou explore un autre espace.' : state.events.includes('online-listing') ? 'Tes paquets sont en rayon. Essaie une mission pour attirer des visiteurs, puis avance de 24 heures fictives pour observer les ventes.' : state.prepared ? 'Ton produit est prêt. Vends aux professionnels, ou achète des emballages et fixe le prix de tes paquets dans ton commerce en ligne.' : `${KQ_TUTORIAL_STORAGE_NOTICE} Des bocaux suffisants et un site de base sont prêtés pour ce lot. Ouvre le lot de Sylvain, puis choisis une transformation et un circuit.` };
  if (state.lesson === 'warehouse') return { complete: state.events.some(event => ['upgrade', 'repair', 'expand', 'replace', 'storage-assign', 'storage-purchase', 'storage-overflow-sale'].includes(event)), instruction: state.events.length ? 'Observe les contenants occupés et la place disponible. Achète de la capacité pour ton surplus ou cède-le au grossiste ; tu peux aussi améliorer tes machines.' : 'Explore l’entrepôt : deux bocaux de 1 L sont offerts. Ajoute des contenants pour protéger ta récolte après son verdict ; le surplus encore sans contenant est vendu automatiquement au grossiste 1 heure réelle après le verdict. Le temps reste fictif dans cet atelier.' };
  return { complete: state.events.includes('purchase') && state.events.includes('install'), instruction: state.events.includes('install') ? 'Ton matériel est installé. Observe sa place dans l’entrepôt, puis compare les modes d’énergie.' : state.events.includes('purchase') ? 'Ton achat est en réserve. Ouvre l’entrepôt et installe-le à son emplacement.' : 'Choisis une lampe dans la vraie boutique. Ajoute-la au panier et confirme ton achat avec le budget prêté.' };
}
