import type { KqGameState } from './kanab-quest-game';
import type { KqBattle } from './kanab-quest-battle';
import type { KqReleveProductionLedgerEntry } from './kanab-quest-releve-production';
import { createKqTrial, trialQuality } from './kanab-quest-trial';
import { createKqBusinessPreview, getKqSaleVatCents, KQ_GAME_MONTH_MS, normalizeKqShopName, previewKqBusinessPayment, type KqLabInvoice } from './kanab-quest-business';
import { applyKqOperationsRequest, getKqOperationsCommerce, getKqOperationsEquipment, type KqOperationsLessonAction, type KqOperationsLessonState } from './kanab-quest-operations-lesson';
import { createChanvrierCareerSnapshot } from './chanvrier-career';
import { applyKqOperationsOnline, getKqOperationsCustomerDemand } from './kanab-quest-operations-online';
import { createKqOnlinePreview } from './kanab-quest-online';
import { changeKqStorageCapacity, changeKqStoragePostHarvest, createKqStorageLot, getKqStorageInventory, KQ_STORAGE_METHODS, KQ_STORAGE_OVERFLOW_CENTS_PER_GRAM, planKqStorageAllocation, projectKqStorageLot, resizeKqStorageCapacity, type KqStorageAllocation, type KqStorageLot } from './kanab-quest-storage';
import { getKqWarehousePostHarvestProfile, getKqWarehouseRunPostHarvestProfile } from './kanab-quest-post-harvest';
import { getKqWarehouseEquipmentDemand, getKqWarehouseQuote, getKqWarehouseRunSnapshot, isKqWarehouseState, type KqWarehouseState } from './kanab-quest-warehouse';
import { createKqWorkshop } from './kanab-quest-workshops';
import { quoteKqEnergy, type KqEnergySnapshot } from './kanab-quest-energy';
import { quoteKqWarehouseEnergy } from './kanab-quest-warehouse-run';
import { getKqWorkshopMachineSpecification } from './kanab-quest-workshop-machines';
import { getKqEquipmentDefinition } from './kanab-quest-equipment';
import { getKqMachineCondition } from './kanab-quest-maintenance';
import { KQ_MARKET_ROUTES, quoteKqMarketRoutes, type KqMarketRouteCode } from './kanab-quest-market';
import { getKqMarketWindow } from './kanab-quest-market-demand';
import { getKqCommerceStockQuality, KQ_COMPUTER_PRICE_CENTS, type KqCommerceSnapshot, type KqCommerceStock } from './kanab-quest-commerce';
import type { KqTreasuryAccount, KqTreasuryBalances, KqTreasuryEntry, KqTreasuryPeriod, KqTreasurySnapshot } from './kanab-quest-treasury';
import { KQ_MISSION_DEFINITIONS, type KqMissionSnapshot } from './kanab-quest-missions';
import type { KqStorageSnapshot } from './kanab-quest-api';
import { createKqTreasuryTutorial, type KqTreasuryTutorialState } from './kanab-quest-treasury-tutorial';
import { createKqStorageClimateAccrual, getKqStorageClimateBilling, payKqStorageClimateInvoices, settleKqStorageClimateAccrual, type KqStorageClimateAccrual } from './kanab-quest-storage-climate';

export type KqReleveCommerceChapter = 'delivery' | 'shop' | 'ledger' | 'business';
export type KqReleveHarvest = { zoneId: string; game: KqGameState; battle: KqBattle | null };
type Lot = KqReleveHarvest & { id: string; name: string; storage: KqStorageLot; prepared: boolean; assistance?: boolean };
export type KqReleveCommerceState = {
  version: 1; operations: KqOperationsLessonState; lots: Lot[];
  productionLedger: KqReleveProductionLedgerEntry[]; milestones: string[];
  openingBalances: KqTreasuryBalances; journal: KqTreasuryEntry[]; startedAt: string;
  responses: Record<string, unknown>;
  wholesaleSales: Array<{ at: number; equivalentUnits: number }>;
  warehouseState?: KqWarehouseState;
  warehouseRevision?: number;
  storageClimate?: KqStorageClimateAccrual;
  postHarvestBalanceVersion?: 2;
  finance?: KqTreasuryTutorialState;
};
const COMMERCE = '/api/arena/placard/commerce';
const HOUR = 3_600_000;
const stamp = (state: KqReleveCommerceState) => new Date(state.operations.trial.clock).toISOString();
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function mark(state: KqReleveCommerceState, milestone: string) { if (!state.milestones.includes(milestone)) state.milestones.push(milestone); }

function invoiceRows(ledger: KqReleveProductionLedgerEntry[], kind: 'lab' | 'supplier'): KqLabInvoice[] {
  return ledger.filter(row => row.kind === kind).map(row => ({ id: row.id, runId: row.id, issuedAt: row.issuedAt,
    dueAt: row.dueAt ?? row.issuedAt, amountCents: row.amountCents, remainingCents: row.status === 'paid' ? 0 : row.amountCents }));
}
function updateCalendar(state: KqReleveCommerceState) {
  const business = state.operations.trial.commerce.business!;
  business.serverNow = stamp(state);
  for (const group of [business.lab, business.suppliers!]) {
    group.outstandingCents = group.invoices.reduce((sum, row) => sum + row.remainingCents, 0);
    group.overdueCents = group.invoices.reduce((sum, row) => sum + (Date.parse(row.dueAt) <= state.operations.trial.clock ? row.remainingCents : 0), 0);
  }
  if (state.storageClimate) business.storageClimate = getKqStorageClimateBilling(state.storageClimate);
  business.nextEventAt = [...[...business.lab.invoices, ...business.suppliers!.invoices].filter(row => row.remainingCents > 0 && Date.parse(row.dueAt) > state.operations.trial.clock).map(row => row.dueAt),
    ...(business.storageClimate?.nextBillingAt ? [business.storageClimate.nextBillingAt] : [])].sort()[0] ?? null;
  const recent = state.wholesaleSales.filter(row => row.at + 24 * HOUR > state.operations.trial.clock);
  const capacity = 10_000 + Math.min(20, state.operations.trial.commerce.shopPartners ?? 0) * 2500;
  state.operations.trial.commerce.wholesale = { capacityEquivalentUnits: capacity, remainingEquivalentUnits: Math.max(0, capacity - recent.reduce((sum, row) => sum + row.equivalentUnits, 0)), resetsAt: recent.length ? new Date(Math.min(...recent.map(row => row.at)) + 24 * HOUR).toISOString() : null };
}
function balances(state: KqReleveCommerceState): KqTreasuryBalances {
  const { commerce, electricity } = state.operations.trial, business = commerce.business!;
  return { cash: commerce.cashCents, vat_reserve: business.vat.reservedCents, vat_payable: -business.vat.reservedCents,
    lab_payable: -business.lab.outstandingCents, supplier_payable: -business.suppliers!.outstandingCents, energy_payable: -electricity };
}

/** The only initial stock is the player's resolved production. No cash or stock fixture is merged in. */
export function createReleveCommerce(input: { cashCents: number; clock?: number; harvests: KqReleveHarvest[]; ledger?: KqReleveProductionLedgerEntry[] }): KqReleveCommerceState {
  requireValue(Number.isSafeInteger(input.cashCents) && input.cashCents >= 0, 'Trésorerie de campagne invalide.');
  const harvests = input.harvests.filter(row => row.game.completedAt && (row.game.harvestGrams ?? 0) > 0);
  requireValue(harvests.length > 0, 'Termine le verdict de ta récolte avant de rejoindre le marché.');
  requireValue(harvests.every(row => row.battle?.burnedAt), 'Termine le verdict de chaque zone avant de rejoindre le marché.');
  const first = harvests[0], clock = input.clock ?? Date.parse(first.battle!.burnedAt!);
  const trial = createKqTrial();
  Object.assign(trial, { clock, game: structuredClone(first.game), battle: structuredClone(first.battle), electricity: 0 });
  const ledger = structuredClone(input.ledger ?? []), business = createKqBusinessPreview(clock);
  business.lab.invoices = invoiceRows(ledger, 'lab');
  business.suppliers = { outstandingCents: 0, overdueCents: 0, invoices: invoiceRows(ledger, 'supplier') };
  trial.electricity = ledger.filter(row => row.kind === 'energy' && row.status === 'due').reduce((sum, row) => sum + row.amountCents, 0);
  trial.commerce = { ...trial.commerce, cashCents: input.cashCents, reputation: 0, clients: 0, shopPartners: 0, computerOwned: false, business, online: createKqOnlinePreview(clock) };
  Object.assign(trial.commerce.online!.site, { active: false, createdAt: null });
  const room = first.game.warehouse?.sourceState;
  const equipment = room ? getKqWarehouseEquipmentDemand(room.zones, room.serviceZones) : [];
  const ownedContainers: Record<string, number> = {};
  for (const item of equipment) {
    if (item.code === 'LP-SUPER-1L' || item.code === 'BROR-JARS-48') ownedContainers['GLASS-1L'] = (ownedContainers['GLASS-1L'] ?? 0) + item.quantity * (item.code === 'LP-SUPER-1L' ? 6 : 48);
    if (item.code === 'CURTEC-60L') ownedContainers['CURTEC-60L'] = (ownedContainers['CURTEC-60L'] ?? 0) + item.quantity;
  }
  const reserved: KqStorageAllocation[] = [];
  const lots: Lot[] = harvests.map((harvest, index) => {
    const id = `releve-${harvest.zoneId}`, game = structuredClone(harvest.game), battle = structuredClone(harvest.battle!);
    requireValue(game.care && battle.burnedAt, 'Cette récolte ne possède pas de bilan de conservation.');
    const capacity = { ...planKqStorageAllocation({ totalUnits: Math.round(game.harvestGrams! * 10), ownedContainers, reservedAllocations: reserved, nowMs: clock }), automaticOverflowSale: false, overflowDeadlineAt: null };
    reserved.push(...capacity.allocations);
    const storage = createKqStorageLot({ flowerId: id, harvestedAt: game.completedAt!, curingStartedAt: battle.burnedAt, capacity,
      ...(game.warehouse?.sourceState ? { postHarvest: getKqWarehouseRunPostHarvestProfile(game.warehouse, room) } : {}),
      baseline: { varietyCode: game.varietyCode, juryScore: trialQuality({ ...trial, game, battle }), aroma: battle.playerFlower.stats.aroma, care: game.care } });
    return { ...harvest, game, battle, id, name: `${game.varietyName} · récolte ${index + 1}`, storage, prepared: false };
  });
  const inventory = { ownedCodes: [] as string[], purchasedCodes: [] as string[], equippedCodes: [] as string[], levels: {}, maintenance: {}, cultureWear: {} };
  const operations: KqOperationsLessonState = { lesson: 'market', trial, tents: [{ ...structuredClone(inventory), tentNumber: 1 }], buildings: [{ ...structuredClone(inventory), buildingNumber: 1, anchorTentNumber: 1 }], shared: inventory,
    storage: { ownedContainers, defaultMethodCode: 'STORAGE-GLASS', lot: lots[0].storage, revision: 0, overflowSales: [] }, prepared: false, events: [], routePlan: null, quotes: {}, receipts: {}, customerDemandUsage: {} };
  const state: KqReleveCommerceState = { version: 1, postHarvestBalanceVersion: 2, operations, lots, productionLedger: ledger, milestones: [], openingBalances: {}, journal: [], startedAt: ledger.map(row => row.issuedAt).sort()[0] ?? new Date(clock).toISOString(), responses: {}, wholesaleSales: [] };
  state.storageClimate = createKqStorageClimateAccrual(commerceWarehouse(state), clock);
  updateCalendar(state);
  const initialCash = input.cashCents + ledger.filter(row => row.status === 'paid').reduce((sum, row) => sum + row.amountCents, 0);
  state.openingBalances = { cash: initialCash, opening_equity: -initialCash };
  for (const row of ledger) {
    const debit: KqTreasuryAccount = row.kind === 'equipment' ? 'equipment' : row.kind === 'lab' ? 'expense_lab' : row.kind === 'energy' || row.kind === 'care' ? 'expense_energy' : 'expense_other';
    const credit: KqTreasuryAccount = row.status === 'paid' ? 'cash' : row.kind === 'lab' ? 'lab_payable' : row.kind === 'supplier' ? 'supplier_payable' : 'energy_payable';
    state.journal.unshift({ id: row.id, occurredAt: row.issuedAt, kind: row.kind === 'equipment' ? 'equipment-purchase' : row.status === 'due' ? `${row.kind}-issued` : 'cash', reference: row.label,
      postings: [{ account: debit, deltaCents: row.amountCents }, { account: credit, deltaCents: -row.amountCents }] });
  }
  return state;
}

/** Optional dossier only: its named harvest, furnished room and 5,000 euros are loans, never merged into the story. */
export function createReleveCommerceBusiness(): KqReleveCommerceState {
  const trial = createKqWorkshop('market');
  const room = getKqWarehouseQuote({ version: 1, floor: { columns: 10, rows: 10 }, zones: [{ id: 'demo', name: 'Zone de démonstration', x: 1, y: 1, width: 1, height: 1, active: true, lightingCode: 'MH-TS1000', airCode: 'SIM-AIR-01' }],
    serviceZones: [{ id: 'drying', name: 'Séchage prêté', x: 1, y: 7, width: 1, height: 1, kind: 'drying', deviceCode: 'SJ-DRYIT90' }, { id: 'storage', name: 'Réserve prêtée', x: 4, y: 7, width: 1, height: 1, kind: 'storage', deviceCode: 'LP-SUPER-1L' }], equipment: [], preparedAreaM2: 0 }).nextState;
  let state = createReleveCommerce({ cashCents: 500_000, clock: trial.clock, harvests: [{ zoneId: 'business-demo', game: { ...trial.game!, varietyName: 'Récolte prêtée par Sylvain', warehouse: getKqWarehouseRunSnapshot(room) }, battle: trial.battle }] });
  state = applyReleveCommerceRequest(state, { path: '/api/releve/commerce', method: 'POST', body: { action: 'mature' } }).state;
  mark(state, 'business-dossier');
  return state;
}

function selectLot(state: KqReleveCommerceState, lot: Lot) {
  state.operations.trial.game = lot.game; state.operations.trial.battle = lot.battle;
  state.operations.storage.lot = lot.storage; state.operations.prepared = lot.prepared;
}
function processingCodes(state: KqReleveCommerceState, route: KqMarketRouteCode) {
  const definition = KQ_MARKET_ROUTES.find(item => item.code === route)!;
  return state.operations.shared.equippedCodes.filter(code => getKqEquipmentDefinition(code)?.unlocks.some(unlock => definition.requiredUnlocks.includes(unlock)));
}
function physicalRoutes(state: KqReleveCommerceState, lot: Lot) {
  const shared = state.operations.shared, c = state.operations.trial.commerce, clock = state.operations.trial.clock;
  const equipmentCodes = shared.equippedCodes.filter(code => !shared.maintenance[code]?.due);
  const specs = Object.fromEntries(equipmentCodes.map(code => [code, getKqWorkshopMachineSpecification(code, shared.levels[code])]));
  const storage = projectKqStorageLot(lot.storage, clock);
  return quoteKqMarketRoutes({ juryScore: storage.conditionScore, harvestGrams: lot.storage.capacity!.totalUnits / 10,
    // The backend uses this compatibility unlock for whole flowers; no tent is granted to the farm.
    equipmentCodes: ['TENT-080-STARTER', ...equipmentCodes], equipmentLevels: shared.levels, processWholeLot: true,
    processingBatchGrams: Object.fromEntries(Object.entries(specs).filter(([, spec]) => spec).map(([code, spec]) => [code, spec!.capacityGrams])),
    marketContext: { reputation: c.reputation, routeSales: c.routeSales, recentSales: {}, marketVolumes: c.marketVolumes, window: getKqMarketWindow(clock) },
  }).map(quote => {
    const codes = processingCodes(state, quote.route).filter(code => equipmentCodes.includes(code));
    const seconds = codes.reduce((sum, code) => sum + (specs[code]?.durationSeconds ?? 0), 0) * Math.ceil(quote.processedInputGrams / Math.max(.1, quote.processingBatchGrams ?? quote.processedInputGrams));
    const blocked = storage.capacity!.overflowUnits > 0 ? 'La réserve ne protège pas tout ce lot.' : codes.length > 0 && storage.stage !== 'ready' ? 'Termine les six heures d’affinage avant la transformation.' : null;
    return { ...quote, processingEquipmentCodes: codes, processingDurationSeconds: seconds, ...(blocked ? { available: false, blockedReason: blocked } : {}) };
  });
}
function prepareLot(state: KqReleveCommerceState, body: Record<string, unknown>) {
  const lot = state.lots.find(row => row.id === body.flowerId);
  requireValue(lot && !lot.prepared, 'Choisis un lot brut disponible.');
  const quote = physicalRoutes(state, lot).find(row => row.route === body.route);
  requireValue(quote && quote.available, quote?.blockedReason ?? 'Filière indisponible.');
  const c = state.operations.trial.commerce, cost = quote.market?.processingCostCents ?? 0, clock = state.operations.trial.clock;
  requireValue(body.expectedCostCents === cost && c.cashCents >= cost, 'Le coût a changé ou la trésorerie ne suffit pas.');
  c.cashCents -= cost;
  const codes = quote.processingEquipmentCodes;
  const pending = c.stocks.filter(stock => stock.processingReadyAt && processingCodes(state, stock.batchRoute).some(code => codes.includes(code)));
  const starts = Math.max(clock, ...pending.map(stock => Date.parse(stock.processingReadyAt!)));
  const readyAt = quote.processingDurationSeconds > 0 ? new Date(starts + quote.processingDurationSeconds * 1000).toISOString() : null;
  const makeStock = (id: string, route: KqMarketRouteCode, grams: number, equivalent: number, base: number): KqCommerceStock => ({ id, flowerId: lot.id, name: lot.name, varietyCode: lot.game.varietyCode,
    route, batchRoute: quote.route, juryScore: lot.storage.baseline.juryScore, initialUnits: Math.round(grams * 10), remainingUnits: Math.round(grams * 10), equivalentUnits: Math.round(equivalent * 10), originalUnits: Math.round(lot.game.harvestGrams! * 10),
    baseUnitCents: base, payoutExact: 0, payoutRounded: 0, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, processingReadyAt: route === quote.route ? readyAt : null, storage: projectKqStorageLot(lot.storage, clock) });
  const stock = makeStock(`${lot.id}:product`, quote.route, quote.productGrams, quote.processedInputGrams, quote.productBaseUnitCents ?? 30);
  c.stocks.push(stock);
  if (quote.remainderGrams > 0) {
    const route = quote.remainderDestination === 'raw' ? 'raw' : 'biomass';
    const remainderQuote = physicalRoutes(state, lot).find(row => row.route === route)!;
    c.stocks.push(makeStock(`${lot.id}:remainder`, route, quote.remainderGrams, quote.remainderGrams, remainderQuote.productBaseUnitCents ?? 30));
  }
  for (const code of codes) {
    const previous = state.operations.shared.maintenance[code];
    const condition = getKqMachineCondition(code, state.operations.shared.levels[code], (previous?.cycles ?? 0) + 1, (previous?.version ?? 0) + 1);
    if (condition) state.operations.shared.maintenance[code] = condition;
  }
  c.campaign ??= { id: 'releve-campaign', revision: 0, reputation: c.reputation, clientsStart: c.clients, shopPartnersStart: c.shopPartners, event: 'normal', internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 };
  c.demand ??= { serverNow: stamp(state), updatedAt: stamp(state), onlineDebt: 0, shopDebt: 0, growthResetsAt: new Date(clock + 24 * HOUR).toISOString() };
  lot.prepared = true; mark(state, 'prepared'); state.operations.events.push('prepare');
  return { action: 'prepare', stockId: stock.id, flowerId: lot.id, cashAfterCents: c.cashCents };
}
/** Reconcile each source separately: packing releases bulk, and selling a second lot cannot erase the first. */
function refreshStocks(state: KqReleveCommerceState) {
  const { commerce, clock } = state.operations.trial;
  for (const lot of state.lots) {
    const stocks = commerce.stocks.filter(stock => stock.flowerId === lot.id);
    if (lot.prepared) {
      const remaining = stocks.reduce((sum, stock) => sum + (stock.initialUnits ? Math.ceil(stock.equivalentUnits * stock.remainingUnits / stock.initialUnits) : 0), 0);
      lot.storage = changeKqStorageCapacity(lot.storage, resizeKqStorageCapacity(lot.storage.capacity!, Math.min(remaining, lot.storage.capacity!.totalUnits)), clock);
    }
    for (const stock of stocks) { stock.storage = projectKqStorageLot(lot.storage, clock); stock.storageRevision = commerce.revision; }
  }
  selectLot(state, state.lots[0]); updateCalendar(state);
}
export function getReleveCommerceSnapshot(state: KqReleveCommerceState): KqCommerceSnapshot {
  const view = structuredClone(state); refreshStocks(view);
  const rawLots = view.lots.filter(lot => !lot.prepared).flatMap(lot => {
    selectLot(view, lot);
    return getKqOperationsCommerce(view.operations).rawLots.map(row => ({ ...row, flowerId: lot.id, varietyName: lot.name, options: physicalRoutes(view, lot) }));
  });
  return { ...view.operations.trial.commerce, rawLots, customerDemand: getKqOperationsCustomerDemand(view.operations), electricityOutstandingCents: view.operations.trial.electricity };
}
export function getReleveCommerceCash(state: KqReleveCommerceState) { return state.operations.trial.commerce.cashCents; }

/** The real harvest/storage contracts, projected from every lot of this campaign. */
export function getReleveCommerceStorageSnapshot(current: KqReleveCommerceState): KqStorageSnapshot {
  const state = structuredClone(current);
  refreshStocks(state);
  const containers = getKqStorageInventory(state.operations.storage.ownedContainers, state.lots.flatMap(lot => lot.storage.capacity!.allocations));
  const lots = state.lots.filter(lot => lot.storage.capacity!.totalUnits > 0).map(lot => {
    const projection = projectKqStorageLot(lot.storage, state.operations.trial.clock);
    const units = lot.prepared ? 0 : Math.min(projection.capacity!.overflowUnits, state.operations.trial.commerce.wholesale?.remainingEquivalentUnits ?? 0);
    const payoutCents = Math.round(units * KQ_STORAGE_OVERFLOW_CENTS_PER_GRAM / 10);
    const payment = previewKqBusinessPayment(payoutCents, state.operations.trial.commerce.business!, state.operations.trial.electricity);
    return { flowerId: lot.id, varietyName: lot.name, harvestGrams: lot.game.harvestGrams!, flowerStatus: lot.battle!.playerFlower.status, projection,
      ...(units > 0 ? { overflowOffer: { units, payoutCents, netPayoutCents: payment.netPayoutCents } } : {}) };
  });
  return { serverNow: stamp(state), cashCents: getReleveCommerceCash(state), catalog: KQ_STORAGE_METHODS, containers,
    ownedMethodCodes: [...new Set(containers.filter(item => item.ownedQuantity > 0).map(item => item.methodCode))],
    ownedContainers: state.operations.storage.ownedContainers, installedContainers: state.operations.storage.ownedContainers,
    defaultMethodCode: state.operations.storage.defaultMethodCode, overflowSales: state.operations.storage.overflowSales,
    capacity: { totalUnits: containers.reduce((sum, item) => sum + item.ownedQuantity * item.capacityUnits, 0),
      usedUnits: lots.reduce((sum, lot) => sum + lot.projection.capacity!.protectedUnits, 0),
      reservedUnits: lots.reduce((sum, lot) => sum + lot.projection.capacity!.reservedCapacityUnits, 0),
      freeUnits: containers.reduce((sum, item) => sum + item.freeQuantity * item.capacityUnits, 0),
      overflowUnits: lots.reduce((sum, lot) => sum + lot.projection.capacity!.overflowUnits, 0) }, lots };
}
function commerceWarehouse(state: KqReleveCommerceState): KqWarehouseState {
  return state.warehouseState ?? state.lots[0].game.warehouse?.sourceState ?? { version: 1, floor: { columns: 10, rows: 10 }, zones: [], serviceZones: [], equipment: [], preparedAreaM2: 0 };
}
function settleStorageClimate(state: KqReleveCommerceState) {
  const trial = state.operations.trial, now = trial.clock, room = commerceWarehouse(state);
  const current = state.storageClimate ?? createKqStorageClimateAccrual(room, now);
  const settled = settleKqStorageClimateAccrual(current, room, now);
  state.storageClimate = settled.next;
  for (const invoice of settled.issued) {
    trial.electricity += invoice.amountCents;
    state.journal.unshift({ id: `${invoice.id}:issued`, occurredAt: invoice.periodEndedAt, kind: 'storage-climate-issued', reference: 'Climatisation du stockage · mois de jeu',
      postings: [{ account: 'expense_energy', deltaCents: invoice.amountCents }, { account: 'energy_payable', deltaCents: -invoice.amountCents }] });
  }
  if (settled.issued.length) {
    const due = getKqStorageClimateBilling(settled.next).outstandingCents;
    const paid = payKqStorageClimateInvoices(settled.next, Math.min(trial.commerce.cashCents, due));
    trial.commerce.cashCents -= paid; trial.electricity -= paid;
    if (paid) state.journal.unshift({ id: `${settled.issued.at(-1)!.id}:paid`, occurredAt: stamp(state), kind: 'storage-climate-paid', reference: 'Règlement automatique de la climatisation',
      postings: [{ account: 'energy_payable', deltaCents: paid }, { account: 'cash', deltaCents: -paid }] });
  }
  updateCalendar(state);
}
function reconcileClimatePayment(state: KqReleveCommerceState, previousEnergyCents: number) {
  if (!state.storageClimate) return;
  const climateDue = getKqStorageClimateBilling(state.storageClimate).outstandingCents;
  const payment = Math.max(0, previousEnergyCents - state.operations.trial.electricity);
  const olderDue = Math.max(0, previousEnergyCents - climateDue);
  payKqStorageClimateInvoices(state.storageClimate, Math.max(0, payment - olderDue));
  updateCalendar(state);
}
function warehouseContainers(room: KqWarehouseState) {
  const result: Record<string, number> = {};
  for (const item of getKqWarehouseEquipmentDemand(room.zones, room.serviceZones)) {
    if (item.code === 'LP-SUPER-1L' || item.code === 'BROR-JARS-48') result['GLASS-1L'] = (result['GLASS-1L'] ?? 0) + item.quantity * (item.code === 'LP-SUPER-1L' ? 6 : 48);
    if (item.code === 'CURTEC-60L') result['CURTEC-60L'] = (result['CURTEC-60L'] ?? 0) + item.quantity;
  }
  return result;
}
function getReleveCommerceWarehouse(state: KqReleveCommerceState) {
  const storage = getReleveCommerceStorageSnapshot(state);
  return { state: commerceWarehouse(state), revision: state.warehouseRevision ?? 0, cashCents: getReleveCommerceCash(state), activeRun: false, activeRuns: [], completedRuns: [],
    legacyActiveRun: false, migrationCreditCents: 0, stockGrams: storage.lots.reduce((sum, lot) => sum + lot.projection.capacity!.totalUnits / 10, 0),
    storageReservedGrams: storage.capacity.reservedUnits / 10, reservedHarvestGrams: 0, storageCapacityGrams: storage.capacity.totalUnits / 10,
    salesGramsPerDay: null, context: { available: true }, storageClimateBilling: state.operations.trial.commerce.business?.storageClimate };
}
export function getReleveCommerceMissions(state: KqReleveCommerceState): KqMissionSnapshot {
  const harvested = state.lots.some(lot => !lot.assistance);
  const claimed = state.milestones.includes('first-harvest');
  return { collectionActive: true, missions: KQ_MISSION_DEFINITIONS.map(definition => ({ ...definition,
    progress: definition.code === 'first-harvest' && harvested ? 1 : 0,
    cardCount: definition.reward.kind === 'pack' ? definition.reward.cardCount : definition.reward.kind === 'card' ? 1 : 0,
    rewardAvailable: true, claimed: definition.code === 'first-harvest' && claimed,
    unlocked: definition.step === 1 || (definition.track === 'culture' && definition.step === 2 && claimed),
    claimable: definition.code === 'first-harvest' && harvested && !claimed, entitlementId: null, packAvailable: false,
  })) };
}
export function needsReleveCommerceSample(state: KqReleveCommerceState) {
  return !state.lots.some(lot => !lot.prepared && lot.storage.baseline.juryScore >= 5.8 && lot.storage.capacity!.totalUnits >= 100)
    && !state.operations.trial.commerce.stocks.some(stock => stock.route !== 'biomass' && stock.remainingUnits >= 50 && getKqCommerceStockQuality(stock) >= 5.8);
}
function lendSample(state: KqReleveCommerceState) {
  requireValue(needsReleveCommerceSample(state) && !state.milestones.includes('sample-loaned'), 'Le lot pédagogique est proposé lorsque ta récolte ne permet plus l’essai en ligne.');
  const id = 'releve-sylvain-sample', source = state.lots[0], now = state.operations.trial.clock;
  const storage = createKqStorageLot({ flowerId: id, harvestedAt: new Date(now - 6 * HOUR).toISOString(),
    capacity: { totalUnits: 300, allocations: [{ containerCode: 'GLASS-1L', quantity: 1, storedUnits: 300 }], automaticOverflowSale: false, overflowDeadlineAt: null },
    baseline: { ...source.storage.baseline, juryScore: 8 } });
  state.operations.storage.ownedContainers['GLASS-1L'] = (state.operations.storage.ownedContainers['GLASS-1L'] ?? 0) + 1;
  state.lots.push({ ...structuredClone(source), id, name: 'Lot de démonstration de Sylvain · prêt de 30 g', storage, prepared: true, assistance: true });
  const stock: KqCommerceStock = { id, flowerId: id, name: 'Lot de démonstration de Sylvain · prêt de 30 g', varietyCode: source.game.varietyCode, route: 'raw', batchRoute: 'raw', juryScore: 8,
    initialUnits: 300, remainingUnits: 300, equivalentUnits: 300, originalUnits: 300, baseUnitCents: 300, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, storage: projectKqStorageLot(storage, now) };
  state.operations.trial.commerce.stocks.push(stock); mark(state, 'sample-loaned');
}
export function getReleveCommerceOutstanding(state: KqReleveCommerceState) {
  const c = state.operations.trial.commerce;
  return { labCents: c.business!.lab.outstandingCents, supplierCents: c.business!.suppliers!.outstandingCents, energyCents: state.operations.trial.electricity,
    totalCents: c.business!.lab.outstandingCents + c.business!.suppliers!.outstandingCents + state.operations.trial.electricity };
}
function payInvoices(invoices: KqLabInvoice[], amount: number, now: number, overdueOnly = false) {
  for (const row of invoices) { if (overdueOnly && Date.parse(row.dueAt) > now) continue; const paid = Math.min(amount, row.remainingCents); row.remainingCents -= paid; amount -= paid; }
}
function collect(state: KqReleveCommerceState, cents: number) {
  updateCalendar(state);
  const trial = state.operations.trial, business = trial.commerce.business!, payment = previewKqBusinessPayment(cents, business, trial.electricity);
  const previousEnergyCents = trial.electricity;
  trial.commerce.cashCents += payment.netPayoutCents; trial.electricity = payment.electricityRemainingCents;
  business.vat.salesTtcCents += cents; business.vat.reservedCents += payment.vatCents;
  payInvoices(business.lab.invoices, payment.labPaidCents, trial.clock, true);
  payInvoices(business.suppliers!.invoices, payment.supplierPaidCents, trial.clock, true);
  reconcileClimatePayment(state, previousEnergyCents); updateCalendar(state); return payment;
}
function journalMutation(state: KqReleveCommerceState, before: KqTreasuryBalances, kind: string, account: KqTreasuryAccount, revenueCents?: number) {
  const after = balances(state);
  const postings = (Object.keys(after) as KqTreasuryAccount[]).map(key => ({ account: key, deltaCents: (after[key] ?? 0) - (before[key] ?? 0) })).filter(row => row.deltaCents !== 0);
  if (revenueCents) postings.push({ account, deltaCents: -revenueCents });
  const balance = postings.reduce((sum, row) => sum + row.deltaCents, 0);
  if (balance) postings.push({ account: revenueCents !== undefined ? 'expense_other' : account, deltaCents: -balance });
  if (postings.length) state.journal.unshift({ id: `releve-entry-${state.journal.length + 1}`, occurredAt: stamp(state), kind, reference: `La Relève · ${kind}`, postings });
}
export function getReleveCommerceTreasury(state: KqReleveCommerceState, options: { period?: KqTreasuryPeriod; offset?: number; limit?: number } = {}): KqTreasurySnapshot {
  const period = options.period ?? 'all', now = state.operations.trial.clock, start = Date.parse(state.startedAt);
  const monthStart = start + Math.floor((now - start) / KQ_GAME_MONTH_MS) * KQ_GAME_MONTH_MS;
  const from = period === 'all' ? start : period === 'current' ? monthStart : Math.max(start, monthStart - KQ_GAME_MONTH_MS);
  const to = period === 'previous' ? monthStart : now;
  const opening = { ...state.openingBalances };
  for (const entry of state.journal.filter(row => Date.parse(row.occurredAt) < from)) for (const row of entry.postings) opening[row.account] = (opening[row.account] ?? 0) + row.deltaCents;
  const entries = state.journal.filter(row => Date.parse(row.occurredAt) >= from && (period === 'previous' ? Date.parse(row.occurredAt) < to : Date.parse(row.occurredAt) <= to));
  const closing = { ...opening };
  for (const entry of entries) for (const row of entry.postings) closing[row.account] = (closing[row.account] ?? 0) + row.deltaCents;
  const offset = Math.max(0, Math.trunc(options.offset ?? 0)), limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 25)));
  const rows = entries.flatMap(entry => entry.postings);
  const isoFrom = new Date(from).toISOString(), isoTo = new Date(to).toISOString();
  return { version: 1, serverNow: stamp(state), startedAt: state.startedAt, businessStartedAt: state.startedAt, period: { key: period, from: isoFrom, to: isoTo },
    openingBalances: opening, closingBalances: closing, series: [{ from: isoFrom, to: isoTo, cashOpeningCents: opening.cash ?? 0, cashClosingCents: closing.cash ?? 0,
      inflowsCents: rows.filter(row => row.account === 'cash' && row.deltaCents > 0).reduce((sum, row) => sum + row.deltaCents, 0), outflowsCents: -rows.filter(row => row.account === 'cash' && row.deltaCents < 0).reduce((sum, row) => sum + row.deltaCents, 0),
      revenueCents: -rows.filter(row => row.account.startsWith('revenue_')).reduce((sum, row) => sum + row.deltaCents, 0), expenseCents: rows.filter(row => row.account.startsWith('expense_')).reduce((sum, row) => sum + row.deltaCents, 0) }],
    journal: { items: entries.slice(offset, offset + limit), total: entries.length, offset, limit },
    checks: { walletCashCents: closing.cash ?? 0, vatReserveCents: closing.vat_reserve ?? 0, savingsCents: closing.savings ?? 0, loanDebtCents: -(closing.loan_payable ?? 0), cryptoCostCents: closing.crypto_assets ?? 0, securitiesCostCents: closing.securities_assets ?? 0, labDebtCents: -(closing.lab_payable ?? 0), energyDebtCents: -(closing.energy_payable ?? 0), supplierDebtCents: -(closing.supplier_payable ?? 0), vatDebtCents: -(closing.vat_payable ?? 0) } };
}
function energySnapshot(state: KqReleveCommerceState): KqEnergySnapshot {
  const quote = quoteKqEnergy([]), rows = state.productionLedger.filter(row => row.kind === 'energy');
  const climate = state.storageClimate ? getKqStorageClimateBilling(state.storageClimate) : undefined;
  let paid = rows.reduce((sum, row) => sum + row.amountCents, 0) - (state.operations.trial.electricity - (climate?.outstandingCents ?? 0));
  return { cashCents: getReleveCommerceCash(state), outstandingCents: state.operations.trial.electricity, invoiceCount: rows.length, bestGramsPerKwh: null, storageClimate: climate, quotes: { eco: quote, balanced: quote, intensive: quote },
    invoices: rows.map((row, index) => { const payment = Math.min(paid, row.amountCents); paid -= payment; const game = state.lots[index]?.game;
      return { runId: row.id, createdAt: row.issuedAt, totalCents: row.amountCents, remainingCents: row.amountCents - payment, harvestGrams: game?.harvestGrams ?? 0, quote: game?.warehouse ? quoteKqWarehouseEnergy(game.warehouse) : quote }; }) };
}

/** Fail-closed sandbox. This adapter deliberately has no live transport fallback. */
export function applyReleveCommerceRequest(current: KqReleveCommerceState, action: KqOperationsLessonAction): { state: KqReleveCommerceState; payload: unknown } {
  const url = new URL(action.path, 'https://releve.invalid');
  requireValue(url.origin === 'https://releve.invalid', 'La visite reste dans sa simulation locale.');
  const method = action.method.toUpperCase(), body = action.body;
  const roomProfile = getKqWarehousePostHarvestProfile(commerceWarehouse(current));
  const profileKeys = ['storageQualityBonus', 'climateQualityBonus', 'aromaRateFactor', 'chemistryRateFactor'] as const;
  const changedProfiles = current.lots.map(lot => current.postHarvestBalanceVersion !== 2
    || profileKeys.some(key => lot.storage.postHarvest?.[key] !== roomProfile[key]));
  if (changedProfiles.some(Boolean)) {
    current = structuredClone(current);
    current.lots.forEach((lot, index) => {
      if (changedProfiles[index]) lot.storage = changeKqStoragePostHarvest(lot.storage, roomProfile, current.operations.trial.clock);
    });
    current.postHarvestBalanceVersion = 2;
    selectLot(current, current.lots[0]);
  }
  if (method === 'GET') {
    if (!current.storageClimate || current.storageClimate.updatedAt !== current.operations.trial.clock) {
      current = structuredClone(current); settleStorageClimate(current);
    }
    if (url.pathname === COMMERCE) return { state: current, payload: getReleveCommerceSnapshot(current) };
    if (url.pathname === '/api/arena/placard/treasury') return { state: current, payload: getReleveCommerceTreasury(current, { period: ['current', 'previous', 'all'].includes(url.searchParams.get('period') ?? '') ? url.searchParams.get('period') as KqTreasuryPeriod : 'all', offset: Number(url.searchParams.get('offset')) || 0, limit: Number(url.searchParams.get('limit')) || 25 }) };
    if (url.pathname === '/api/arena/placard/energy') return { state: current, payload: energySnapshot(current) };
    if (url.pathname === '/api/arena/placard/missions') return { state: current, payload: getReleveCommerceMissions(current) };
    if (url.pathname === '/api/account/missions') return { state: current, payload: { missions: [], pendingRewards: [] } };
    if (url.pathname === '/api/arena/placard/equipment') return { state: current, payload: { ...getKqOperationsEquipment(current.operations), career: createChanvrierCareerSnapshot() } };
    if (url.pathname === '/api/arena/placard/storage') return { state: current, payload: getReleveCommerceStorageSnapshot(current) };
    if (url.pathname === '/api/arena/placard/warehouse') return { state: current, payload: getReleveCommerceWarehouse(current) };
    if (url.pathname === '/api/arena/placard/flowers') return { state: current, payload: { flowers: [] } };
    if (url.pathname === '/api/arena/placard/collection') return { state: current, payload: { ownedBuddieCodes: [...new Set(current.lots.map(lot => lot.game.varietyCode))], buddieRotation: { requiredDistinctBuddies: 5, recentBuddieCodes: current.lots.map(lot => lot.game.varietyCode) } } };
    throw new Error('Cet espace se visite dans une autre rencontre de Sylvain.');
  }
  requireValue(method === 'POST' || (method === 'PATCH' && ['/api/arena/placard/equipment', '/api/arena/placard/warehouse'].includes(url.pathname)), 'Opération indisponible dans cette visite.');
  const key = typeof body.requestKey === 'string' ? `${url.pathname}:${body.requestKey}` : null;
  if (key && Object.hasOwn(current.responses, key)) return { state: current, payload: current.responses[key] };
  const state = structuredClone(current);
  settleStorageClimate(state);
  const before = balances(state);
  refreshStocks(state);
  let c = state.operations.trial.commerce, payload: unknown = { ok: true }, kind = String(body.action ?? 'invoice-payment');
  let account: KqTreasuryAccount = 'expense_other';
  let revenueCents: number | undefined;
  const spend = (amount: number) => { requireValue(Number.isSafeInteger(amount) && amount >= 0 && c.cashCents >= amount, 'Trésorerie fictive insuffisante.'); c.cashCents -= amount; };
  if (url.pathname === '/api/releve/commerce') {
    if (body.action === 'mature') {
      state.operations.trial.clock = Math.max(state.operations.trial.clock, ...state.lots.map(lot => Date.parse(lot.storage.readyAt))); mark(state, 'mature');
    } else if (body.action === 'finish-processing') {
      const previousTtc = c.business!.vat.salesTtcCents;
      const ready = Math.max(state.operations.trial.clock, ...c.stocks.map(stock => stock.processingReadyAt ? Date.parse(stock.processingReadyAt) : 0));
      requireValue(ready > state.operations.trial.clock, 'Aucune transformation en attente.');
      while (state.operations.trial.clock < ready) {
        const hours = Math.min(24, Math.floor((ready - state.operations.trial.clock) / HOUR));
        if (!hours) { state.operations.trial.clock = ready; break; }
        applyKqOperationsOnline(state.operations, 'advance-online-time', { hours }, { spend, collect: cents => collect(state, cents), releaseStorage: () => refreshStocks(state) });
        refreshStocks(state);
      }
      const ttc = c.business!.vat.salesTtcCents - previousTtc;
      revenueCents = ttc - getKqSaleVatCents(ttc, previousTtc); account = 'revenue_online'; kind = 'sale';
      mark(state, 'processing-finished');
    } else if (body.action === 'borrow-computer') { c.computerOwned = true; mark(state, 'computer-loaned'); }
    else if (body.action === 'borrow-sample') lendSample(state);
    else if (body.action === 'read-receipt') { requireValue(c.receipts.length > 0, 'Effectue une livraison avant de lire son reçu.'); mark(state, 'receipt-read'); }
    else if (body.action === 'read-report') { requireValue(state.milestones.includes('online-time'), 'Avance les ventes avant de lire le bilan.'); mark(state, 'report-read'); }
    else if (body.action === 'read-ledger') mark(state, 'ledger-read');
    else if (body.action === 'first-harvest') { requireValue(!state.milestones.includes('first-harvest'), 'La prime a déjà été réclamée.'); c.cashCents += 5000; mark(state, 'first-harvest'); account = 'revenue_rewards'; kind = 'reward'; }
    else throw new Error('Action narrative inconnue.');
  } else if (url.pathname === '/api/arena/placard/warehouse') {
    requireValue(method === 'PATCH' && isKqWarehouseState(body.state) && body.expectedRevision === (state.warehouseRevision ?? 0), 'Ce plan a changé. Actualise avant de continuer.');
    const previous = commerceWarehouse(state), quote = getKqWarehouseQuote(body.state, previous);
    requireValue(quote.totalCostCents === body.expectedCostCents, 'Le devis a changé. Vérifie le montant avant de confirmer.');
    const oldContainers = warehouseContainers(previous), nextContainers = warehouseContainers(quote.nextState);
    const installed = { ...state.operations.storage.ownedContainers };
    for (const code of new Set([...Object.keys(oldContainers), ...Object.keys(nextContainers)])) installed[code] = Math.max(0, (installed[code] ?? 0) - (oldContainers[code] ?? 0) + (nextContainers[code] ?? 0));
    const reserved: KqStorageAllocation[] = [];
    const capacities = state.lots.map(lot => {
      const capacity = { ...planKqStorageAllocation({ totalUnits: lot.storage.capacity!.totalUnits, ownedContainers: installed, reservedAllocations: reserved, nowMs: state.operations.trial.clock }), automaticOverflowSale: false, overflowDeadlineAt: null };
      reserved.push(...capacity.allocations);
      return capacity;
    });
    const beforeProtected = state.lots.reduce((sum, lot) => sum + lot.storage.capacity!.allocations.reduce((total, allocation) => total + allocation.storedUnits, 0), 0);
    requireValue(reserved.reduce((sum, allocation) => sum + allocation.storedUnits, 0) >= beforeProtected, 'Ce réaménagement laisserait une partie du stock sans contenant.');
    spend(quote.totalCostCents);
    state.warehouseState = quote.nextState; state.warehouseRevision = (state.warehouseRevision ?? 0) + 1;
    settleStorageClimate(state);
    state.operations.storage.ownedContainers = installed;
    state.lots.forEach((lot, index) => {
      lot.storage = changeKqStorageCapacity(lot.storage, capacities[index], state.operations.trial.clock);
      lot.storage = changeKqStoragePostHarvest(lot.storage, getKqWarehousePostHarvestProfile(quote.nextState), state.operations.trial.clock);
    });
    payload = getReleveCommerceWarehouse(state); account = 'equipment'; kind = 'equipment-purchase';
  } else if (url.pathname === '/api/arena/placard/storage') {
    requireValue(body.action === 'sell-overflow', 'Ajoute les contenants depuis le plan de l’entrepôt.');
    const lot = state.lots.find(item => item.id === body.flowerId);
    const offer = getReleveCommerceStorageSnapshot(state).lots.find(item => item.flowerId === body.flowerId)?.overflowOffer;
    requireValue(lot && offer && !lot.prepared, 'Aucun surplus disponible pour cette offre.');
    const payment = collect(state, offer.payoutCents);
    lot.storage = changeKqStorageCapacity(lot.storage, resizeKqStorageCapacity(lot.storage.capacity!, lot.storage.capacity!.totalUnits - offer.units), state.operations.trial.clock);
    state.operations.storage.overflowSales.push({ flowerId: lot.id, ...offer, netPayoutCents: payment.netPayoutCents, soldAt: stamp(state), automatic: false });
    state.wholesaleSales.push({ at: state.operations.trial.clock, equivalentUnits: offer.units });
    updateCalendar(state); payload = getReleveCommerceStorageSnapshot(state); revenueCents = offer.payoutCents - payment.vatCents; account = 'revenue_wholesale'; kind = 'sale';
  } else if (url.pathname === '/api/arena/placard/equipment') {
    requireValue(body.action === 'repair', 'Le matériel est prêté pour cet essai. Les conditions métier affichées restent nécessaires pour l’acquérir.');
    const code = String(body.equipmentCode ?? ''), condition = state.operations.shared.maintenance[code];
    requireValue(state.operations.shared.ownedCodes.includes(code) && condition && condition.cycles > 0 && condition.version === body.expectedVersion && condition.repairCents === body.expectedCostCents, 'L’état de cette machine a changé. Actualise son entretien.');
    spend(condition.repairCents);
    state.operations.shared.maintenance[code] = getKqMachineCondition(code, state.operations.shared.levels[code] ?? 1, 0, condition.version + 1)!;
    payload = { repaired: true, cashAfterCents: c.cashCents }; kind = 'equipment-repair';
  } else if (url.pathname === '/api/arena/placard/missions') {
    requireValue(body.code === 'first-harvest', 'Découvre les autres missions dans la rencontre du quartier.');
    const mission = getReleveCommerceMissions(state).missions.find(row => row.code === 'first-harvest')!;
    requireValue(mission.claimable || mission.claimed, 'Termine ta première récolte avant de réclamer sa récompense.');
    if (!mission.claimed) { c.cashCents += 5000; mark(state, 'first-harvest'); account = 'revenue_rewards'; kind = 'reward'; }
    payload = { entitlementId: null, cardCount: 0, replayed: mission.claimed, reward: { kind: 'cash', amountCents: 5000 }, cashAfterCents: c.cashCents };
  } else if (url.pathname === '/api/arena/placard/energy') {
    requireValue(body.expectedCents === state.operations.trial.electricity, 'La facture a changé.'); spend(state.operations.trial.electricity); state.operations.trial.electricity = 0; kind = 'energy-paid';
    if (state.storageClimate) payKqStorageClimateInvoices(state.storageClimate, getKqStorageClimateBilling(state.storageClimate).outstandingCents);
  } else if (url.pathname === COMMERCE) {
    if (body.action === 'buy-computer') {
      requireValue(!c.computerOwned, 'Ordinateur déjà disponible.'); spend(KQ_COMPUTER_PRICE_CENTS); c.computerOwned = true; account = 'equipment'; kind = 'equipment-purchase';
      payload = { action: 'buy-computer', cashAfterCents: c.cashCents };
    } else if (body.action === 'create-shop') {
      requireValue(c.computerOwned, 'Emprunte d’abord l’ordinateur de Sylvain.'); requireValue(!c.business!.shop.createdAt, 'La boutique est déjà ouverte.');
      const name = normalizeKqShopName(body.name);
      Object.assign(c.business!.shop, { name, createdAt: stamp(state), active: true, tier: 'basic', monthlyCents: 0, paidUntil: null, renew: false });
      Object.assign(c.online!.site, { createdAt: stamp(state), active: true, tier: 'basic', paidUntil: null, renew: false }); mark(state, 'site-opened');
    } else if (body.action === 'prepare') { payload = prepareLot(state, body); account = 'expense_processing'; kind = 'processing'; }
    else if (body.action === 'pay-lab' || body.action === 'pay-supplier') {
      const group = body.action === 'pay-lab' ? c.business!.lab : c.business!.suppliers!;
      const invoices = typeof body.invoiceId === 'string' ? group.invoices.filter(row => row.id === body.invoiceId) : group.invoices;
      requireValue(invoices.length > 0, 'Facture introuvable.');
      const amount = invoices.reduce((sum, row) => sum + row.remainingCents, 0);
      requireValue(body.expectedCents === undefined || body.expectedCents === amount, 'La facture a changé.');
      spend(amount); payInvoices(invoices, amount, state.operations.trial.clock); kind = body.action === 'pay-lab' ? 'lab-paid' : 'supplier-paid';
    } else if (body.action === 'online') {
      const previousTtc = c.business!.vat.salesTtcCents;
      if (body.command === 'create-listing') {
        const input = body.payload as Record<string, unknown> | undefined;
        const stock = c.stocks.find(row => row.id === input?.stockId);
        requireValue(!stock?.processingReadyAt || Date.parse(stock.processingReadyAt) <= state.operations.trial.clock, 'Termine le travail de l’atelier avant de conditionner ce produit.');
      }
      payload = applyKqOperationsOnline(state.operations, body.command, body.payload, { spend, collect: cents => collect(state, cents), releaseStorage: () => refreshStocks(state) });
      if (body.command === 'create-listing') {
        if (!state.milestones.includes('published')) state.milestones = state.milestones.filter(item => item !== 'online-time' && item !== 'report-read');
        mark(state, 'published');
      }
      if (body.command === 'advance-online-time') { mark(state, 'online-time'); account = 'revenue_online'; kind = 'sale'; const ttc = c.business!.vat.salesTtcCents - previousTtc; revenueCents = ttc - getKqSaleVatCents(ttc, previousTtc); }
      if (body.command === 'start-marketing') { mark(state, 'campaign'); account = 'expense_advertising'; if (state.milestones.includes('business-dossier')) state.milestones = state.milestones.filter(item => item !== 'online-time' && item !== 'report-read'); }
      if (body.command === 'upgrade-site' || body.command === 'buy-upgrade') account = 'website';
    } else {
      requireValue(['quote', 'sell', 'rename-shop', 'shop-renewal', 'renew-shop'].includes(String(body.action)), 'Cette opération se découvre dans une autre rencontre.');
      const quotedStockId = state.operations.quotes[String(body.quoteId)]?.stockId;
      const stock = c.stocks.find(row => row.id === (body.stockId ?? quotedStockId));
      const lot = state.lots.find(row => row.id === (body.flowerId ?? stock?.flowerId)) ?? state.lots[0];
      selectLot(state, lot);
      const otherStocks = c.stocks.filter(row => row.flowerId !== lot.id);
      c.stocks = c.stocks.filter(row => row.flowerId === lot.id);
      const previousEnergyCents = state.operations.trial.electricity;
      const result = applyKqOperationsRequest(state.operations, { ...action, path: COMMERCE });
      state.operations = result.state; c = state.operations.trial.commerce; payload = result.payload;
      reconcileClimatePayment(state, previousEnergyCents);
      if (body.action === 'sell') {
        const receipt = c.receipts.at(-1)!; receipt.flowerId = lot.id;
        if (receipt.channel === 'wholesale') state.wholesaleSales.push({ at: state.operations.trial.clock, equivalentUnits: state.operations.quotes[String(body.quoteId)].offer.equivalentSold });
        payInvoices(c.business!.suppliers!.invoices, receipt.supplierPaidCents ?? 0, state.operations.trial.clock, true);
        mark(state, 'delivered'); account = receipt.channel === 'wholesale' ? 'revenue_wholesale' : 'revenue_shop'; kind = 'sale';
      }
      c.stocks.push(...otherStocks);
    }
  } else throw new Error('Cette adresse est indisponible dans la simulation.');
  refreshStocks(state); c.revision++;
  if (state.operations.trial.clock >= Date.parse(c.business!.vat.nextSettlementAt)) {
    const vat = c.business!.vat;
    vat.paidCents += vat.reservedCents; vat.reservedCents = 0;
    const dueAt = Date.parse(vat.nextSettlementAt);
    vat.nextSettlementAt = new Date(dueAt + (Math.floor((state.operations.trial.clock - dueAt) / KQ_GAME_MONTH_MS) + 1) * KQ_GAME_MONTH_MS).toISOString();
  }
  // The quote's revision must match the final adapter revision.
  if (body.action === 'quote') for (const quote of Object.values(state.operations.quotes)) if (quote.revision === c.revision - 1) quote.revision = c.revision;
  journalMutation(state, before, kind, account, revenueCents);
  settleStorageClimate(state);
  if (key) state.responses[key] = structuredClone(payload);
  return { state, payload };
}

export function getReleveCommerceProgress(state: KqReleveCommerceState, chapter: KqReleveCommerceChapter) {
  const has = (key: string) => state.milestones.includes(key);
  if (chapter === 'delivery') return { complete: has('mature') && has('delivered') && has('receipt-read'), instruction: !has('mature') ? 'Laisse six heures fictives à ta récolte, puis ouvre le lot dans Vendre ma production.' : !has('delivered') ? 'Prépare le lot entier, compare les offres disponibles et livre une petite quantité. Garde au moins 10 g pour la boutique.' : 'Ouvre le reçu : distingue le prix TTC, la TVA, le remboursement des factures et le net reçu.' };
  if (chapter === 'shop' || chapter === 'business') return { complete: has('published') && has('online-time') && has('report-read') && (chapter !== 'business' || has('campaign')), instruction: !state.operations.trial.commerce.computerOwned ? 'Sylvain te prête son ordinateur. Ouvre gratuitement ta boutique de base et choisis son nom.' : !has('published') ? 'Achète quelques emballages, prépare des paquets avec ton stock puis publie-les. Une campagne reste facultative dans l’aventure.' : chapter === 'business' && !has('campaign') ? 'Dans ce dossier séparé, lance la campagne de présentation gratuite et compare son bilan après 24 heures fictives.' : 'Avance de 24 heures fictives et consulte le bilan. Une annonce épuisée reste une publication réussie.' };
  return { complete: has('ledger-read') && has('first-harvest'), instruction: 'Rapproche les ventes des factures de ta campagne. La prime Première récolte ajoute 50 € fictifs, une seule fois.' };
}

export function createReleveCommerceTransport(options: { getState: () => KqReleveCommerceState; setState: (state: KqReleveCommerceState) => void }): typeof fetch {
  const financePaths = new Set(['/api/arena/chanvrier', '/api/arena/chanvrier/savings', ...['bank', 'stocks', 'crypto'].map(name => `/api/arena/placard/${name}`)]);
  const handle: typeof fetch = async (input, init) => {
    try {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET');
      const raw = init?.body ?? (typeof input !== 'string' && !(input instanceof URL) ? await input.clone().text() : undefined);
      requireValue(raw === undefined || raw === null || typeof raw === 'string', 'Corps de requête indisponible.');
      const body = typeof raw === 'string' && raw ? JSON.parse(raw) as Record<string, unknown> : {};
      requireValue(body && typeof body === 'object' && !Array.isArray(body), 'Opération invalide.');
      const url = new URL(path, 'https://releve.invalid');
      requireValue(url.origin === 'https://releve.invalid', 'La visite reste dans sa simulation locale.');
      if (financePaths.has(url.pathname)) {
        const current = options.getState();
        const finance = createKqTreasuryTutorial({ now: () => current.operations.trial.clock, initialCashCents: getReleveCommerceCash(current), state: current.finance });
        finance.synchronizeCash(getReleveCommerceCash(current));
        const response = await finance.request(`${url.pathname}${url.search}`, { ...init, method, ...(method.toUpperCase() === 'GET' ? {} : { body: JSON.stringify(body) }) });
        if (response.ok && method.toUpperCase() === 'POST') {
          const next = structuredClone(current), snapshot = finance.snapshot();
          const previousIds = new Set(current.finance?.journal.map(entry => entry.id));
          next.journal.unshift(...snapshot.journal.filter(entry => !previousIds.has(entry.id)));
          next.finance = snapshot;
          next.operations.trial.commerce.cashCents = snapshot.balances.cash ?? 0;
          next.operations.trial.commerce.revision++;
          options.setState(next);
        }
        return response;
      }
      const result = applyReleveCommerceRequest(options.getState(), { path, method, body });
      if (result.state !== options.getState()) options.setState(result.state);
      return Response.json(result.payload);
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Opération indisponible.' }, { status: 400 }); }
  };
  // Native desks can refresh simultaneously. A financial action must share the
  // same latest wallet with the commerce/storage action immediately before it.
  let queue: Promise<unknown> = Promise.resolve();
  return (input, init) => { const response = queue.then(() => handle(input, init)); queue = response.catch(() => undefined); return response; };
}
