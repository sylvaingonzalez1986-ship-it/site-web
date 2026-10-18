import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKqWorkshop } from './kanab-quest-workshops';
import { getKqWarehouseQuote, getKqWarehouseRunSnapshot } from './kanab-quest-warehouse';
import { createKqReleveProduction, suggestKqRelevePlan } from './kanab-quest-releve-production';
import { applyReleveCommerceRequest, createReleveCommerce, createReleveCommerceBusiness, createReleveCommerceTransport, getReleveCommerceProgress, getReleveCommerceSnapshot, getReleveCommerceStorageSnapshot, getReleveCommerceTreasury, needsReleveCommerceSample, type KqReleveCommerceState } from './kanab-quest-releve-commerce';
import { getKqTreasuryReport, isKqTreasurySnapshot } from './kanab-quest-treasury';
import { KQ_GAME_MONTH_MS } from './kanab-quest-business';
import { KQ_CURING_DURATION_MS, projectKqStorageLot } from './kanab-quest-storage';

function fixture(count = 2, grams = 200) {
  const trial = createKqWorkshop('market');
  const warehouse = getKqWarehouseQuote(suggestKqRelevePlan(createKqReleveProduction(), 2)).nextState;
  const game = { ...trial.game!, harvestGrams: grams, warehouse: getKqWarehouseRunSnapshot(warehouse) };
  const time = new Date(trial.clock).toISOString();
  return createReleveCommerce({ cashCents: 90_000, clock: trial.clock, harvests: Array.from({ length: count }, (_, index) => ({ zoneId: `zone-${index}`, game, battle: trial.battle })),
    ledger: [
      { id: 'equipment', kind: 'equipment', label: 'Installation', amountCents: 110_000, status: 'paid', issuedAt: time },
      { id: 'energy', kind: 'energy', label: 'Énergie', amountCents: 4000, status: 'due', issuedAt: time, dueAt: time },
      { id: 'lab', kind: 'lab', label: 'Laboratoire', amountCents: 4500, status: 'due', issuedAt: time, dueAt: time },
      { id: 'supplier', kind: 'supplier', label: 'Fournisseur', amountCents: 2200, status: 'due', issuedAt: time, dueAt: time },
    ] });
}
function run(state: KqReleveCommerceState, body: Record<string, unknown>, narrative = false) {
  return applyReleveCommerceRequest(state, { path: narrative ? '/api/releve/commerce' : '/api/arena/placard/commerce', method: 'POST', body });
}
function prepare(state: KqReleveCommerceState, index = 0) {
  const raw = getReleveCommerceSnapshot(state).rawLots[index];
  return run(state, { action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: raw.options.find(row => row.route === 'raw')!.market!.processingCostCents }).state;
}
function sell(state: KqReleveCommerceState, units: number, stockId = state.operations.trial.commerce.stocks[0].id) {
  const quoted = run(state, { action: 'quote', stockId, channel: 'wholesale', policy: 'advised', units });
  const offer = quoted.payload as { quoteId: string; offer: { payoutCents: number } };
  return run(quoted.state, { action: 'sell', quoteId: offer.quoteId, expectedPayoutCents: offer.offer.payoutCents, requestKey: `sale-${state.operations.trial.commerce.receipts.length}` }).state;
}
const online = (state: KqReleveCommerceState, command: string, payload: Record<string, unknown>) => run(state, { action: 'online', command, payload }).state;
afterEach(() => vi.unstubAllGlobals());

describe('La Relève: the same harvest and wallet through commerce', () => {
  it('keeps historical drying at harvest while using the current storage equipment', () => {
    const trial = createKqWorkshop('market');
    const planned = suggestKqRelevePlan(createKqReleveProduction(), 2);
    const warehouse = getKqWarehouseQuote({ ...planned, storageClimateCode: 'SIM-STORAGE-CLIMATE-03',
      serviceZones: planned.serviceZones!.map(zone => ({ ...zone, deviceCode: zone.kind === 'drying' ? 'SIM-DRYING-03' : 'CURTEC-60L' })) }).nextState;
    const historical = getKqWarehouseRunSnapshot(warehouse, 0, undefined, 2, 2, 1);
    const game = { ...trial.game!, harvestGrams: 200, warehouse: historical };
    const state = createReleveCommerce({ cashCents: 90_000, clock: trial.clock,
      harvests: [{ zoneId: 'historical', game, battle: trial.battle }] });
    expect(state.lots[0].storage.postHarvest).toMatchObject({ dryingQualityBonus: .4, storageQualityBonus: .6, climateQualityBonus: .5 });
    expect(state.lots[0].game.warehouse).toEqual(historical);
  });

  it('checkpoints the old rate once before upgrading a saved commerce campaign', () => {
    let state = fixture(1);
    const room = state.lots[0].game.warehouse!.sourceState;
    state.warehouseState = getKqWarehouseQuote({ ...room, storageClimateCode: 'SIM-STORAGE-CLIMATE-03',
      serviceZones: room.serviceZones!.map(zone => ({ ...zone, deviceCode: zone.kind === 'drying' ? 'SIM-DRYING-03' : 'CURTEC-60L' })) }, room).nextState;
    delete state.postHarvestBalanceVersion;
    const original = state.lots[0].storage;
    original.postHarvest = { dryingQualityBonus: .4, storageQualityBonus: .3, climateQualityBonus: .3,
      aromaRateFactor: 42, chemistryRateFactor: 42, containerQualityBonus: 0, curingBonusWeightedMs: 0 };
    state.operations.trial.clock = Date.parse(original.curingStartedAt) + KQ_CURING_DURATION_MS / 2;
    const before = projectKqStorageLot(original, state.operations.trial.clock);
    const read = { path: '/api/arena/placard/storage', method: 'GET', body: {} };
    state = applyReleveCommerceRequest(state, read).state;
    const upgraded = state.lots[0].storage;
    expect(upgraded.postHarvest).toMatchObject({ dryingQualityBonus: .4, storageQualityBonus: .6, climateQualityBonus: .5,
      curingBonusWeightedMs: KQ_CURING_DURATION_MS * 30 });
    expect(projectKqStorageLot(upgraded, state.operations.trial.clock).conditionScore).toBe(before.conditionScore);
    expect(projectKqStorageLot(upgraded, Date.parse(upgraded.readyAt)).postHarvest?.curingQualityBonus).toBe(.85);
    expect(state.postHarvestBalanceVersion).toBe(2);
    expect(applyReleveCommerceRequest(state, read).state).toEqual(state);
  });

  it('moderates saved version-two profiles prospectively without removing earned quality', () => {
    let state = fixture(1);
    const room = state.lots[0].game.warehouse!.sourceState;
    state.warehouseState = getKqWarehouseQuote({ ...room, storageClimateCode: 'SIM-STORAGE-CLIMATE-03',
      serviceZones: room.serviceZones!.map(zone => ({ ...zone, deviceCode: zone.kind === 'drying' ? 'SIM-DRYING-03' : 'CURTEC-60L' })) }, room).nextState;
    const original = state.lots[0].storage;
    original.postHarvest = { dryingQualityBonus: 1.2, storageQualityBonus: 1, climateQualityBonus: .8,
      aromaRateFactor: 14, chemistryRateFactor: 14, containerQualityBonus: 0, curingBonusWeightedMs: 0 };
    state.operations.trial.clock = Date.parse(original.curingStartedAt) + KQ_CURING_DURATION_MS / 2;
    const before = projectKqStorageLot(original, state.operations.trial.clock);
    const read = { path: '/api/arena/placard/storage', method: 'GET', body: {} };
    state = applyReleveCommerceRequest(state, read).state;
    const changed = state.lots[0].storage;
    expect(changed.postHarvest).toMatchObject({ dryingQualityBonus: 1.2, storageQualityBonus: .6, climateQualityBonus: .5,
      aromaRateFactor: 33, chemistryRateFactor: 33, curingBonusWeightedMs: KQ_CURING_DURATION_MS * 90 });
    expect(projectKqStorageLot(changed, state.operations.trial.clock).conditionScore).toBe(before.conditionScore);
    expect(projectKqStorageLot(changed, Date.parse(changed.readyAt)).postHarvest?.curingQualityBonus).toBe(1.45);
    expect(state.postHarvestBalanceVersion).toBe(2);
    expect(applyReleveCommerceRequest(state, read).state).toEqual(state);
  });

  it('bills monthly storage climate independently from culture and reconciles the automatic debit', () => {
    let state = fixture();
    const previous = state.lots[0].game.warehouse!.sourceState;
    const candidate = { ...previous, storageClimateCode: 'SIM-STORAGE-CLIMATE-01' };
    const quote = getKqWarehouseQuote(candidate, previous);
    state = applyReleveCommerceRequest(state, { path: '/api/arena/placard/warehouse', method: 'PATCH', body: {
      state: candidate, expectedRevision: 0, expectedCostCents: quote.totalCostCents } }).state;
    const before = state.operations.trial.commerce.cashCents, electricity = state.operations.trial.electricity;
    state.operations.trial.clock += KQ_GAME_MONTH_MS;
    const read = { path: '/api/arena/placard/warehouse', method: 'GET', body: {} };
    state = applyReleveCommerceRequest(state, read).state;
    expect(state.operations.trial.commerce.cashCents).toBe(before - 150);
    expect(state.operations.trial.electricity).toBe(electricity);
    expect(state.operations.trial.commerce.business!.storageClimate).toMatchObject({ monthlyCostCents: 150, outstandingCents: 0,
      invoices: [{ amountCents: 150, remainingCents: 0 }] });
    expect(applyReleveCommerceRequest(state, read).state).toEqual(state);
    const report = getKqTreasuryReport(getReleveCommerceTreasury(state));
    expect(report.balanceSheet.differenceCents).toBe(0);
    expect(state.journal.filter(entry => entry.kind === 'storage-climate-issued')).toHaveLength(1);
    expect(state.journal.filter(entry => entry.kind === 'storage-climate-paid')).toHaveLength(1);
  });

  it('includes unpaid climate in the shared electricity balance and clears it with the same payment', () => {
    let state = fixture();
    const previous = state.lots[0].game.warehouse!.sourceState;
    const candidate = { ...previous, storageClimateCode: 'SIM-STORAGE-CLIMATE-01' };
    const quote = getKqWarehouseQuote(candidate, previous);
    state = applyReleveCommerceRequest(state, { path: '/api/arena/placard/warehouse', method: 'PATCH', body: {
      state: candidate, expectedRevision: 0, expectedCostCents: quote.totalCostCents } }).state;
    state.operations.trial.commerce.cashCents = 50;
    state.operations.trial.clock += KQ_GAME_MONTH_MS;
    const read = { path: '/api/arena/placard/energy', method: 'GET', body: {} };
    const due = applyReleveCommerceRequest(state, read); state = due.state;
    expect(state.operations.trial.electricity).toBe(4100);
    expect(state.operations.trial.commerce.business!.storageClimate?.outstandingCents).toBe(100);
    expect((due.payload as { storageClimate: { invoices: Array<{ remainingCents: number }> } }).storageClimate.invoices.at(-1)).toMatchObject({ remainingCents: 100 });
    state.operations.trial.commerce.cashCents = 5000;
    state = applyReleveCommerceRequest(state, { path: '/api/arena/placard/energy', method: 'POST', body: { expectedCents: 4100 } }).state;
    expect(state.operations.trial.electricity).toBe(0);
    expect(state.operations.trial.commerce.business!.storageClimate?.outstandingCents).toBe(0);
    expect(state.operations.trial.commerce.cashCents).toBe(900);
  });

  it('uses sale collections to settle monthly climate after older energy debts', () => {
    let state = fixture();
    state = applyReleveCommerceRequest(state, { path: '/api/arena/placard/energy', method: 'POST', body: { expectedCents: 4000 } }).state;
    state = run(state, { action: 'pay-lab', expectedCents: 4500 }).state;
    state = run(state, { action: 'pay-supplier', expectedCents: 2200 }).state;
    const previous = state.lots[0].game.warehouse!.sourceState;
    const candidate = { ...previous, storageClimateCode: 'SIM-STORAGE-CLIMATE-01' };
    const quote = getKqWarehouseQuote(candidate, previous);
    state = applyReleveCommerceRequest(state, { path: '/api/arena/placard/warehouse', method: 'PATCH', body: {
      state: candidate, expectedRevision: 0, expectedCostCents: quote.totalCostCents } }).state;
    state.operations.trial.commerce.cashCents = 0;
    state.operations.trial.clock += KQ_GAME_MONTH_MS;
    state = applyReleveCommerceRequest(state, { path: '/api/arena/placard/energy', method: 'GET', body: {} }).state;
    expect(state.operations.trial.electricity).toBe(150);
    state.operations.trial.commerce.cashCents = 10000;
    state = sell(prepare(state), 100);
    expect(state.operations.trial.electricity).toBe(0);
    expect(state.operations.trial.commerce.business!.storageClimate?.outstandingCents).toBe(0);
    expect(state.operations.trial.commerce.receipts.at(-1)?.electricityPaidCents).toBe(150);
  });

  it('opens native storage with separate reservations and releases only the sold lot', () => {
    let state = run(fixture(), { action: 'mature' }, true).state;
    const before = getReleveCommerceStorageSnapshot(state);
    expect(before.lots).toHaveLength(2);
    expect(before.capacity.usedUnits).toBe(4000);
    expect(before.capacity.reservedUnits).toBe(4000);
    state = sell(prepare(state), 100);
    const after = getReleveCommerceStorageSnapshot(state);
    expect(after.lots.map(lot => lot.projection.capacity!.totalUnits)).toEqual([1900, 2000]);
    expect(after.capacity.usedUnits).toBe(3900);
    expect(after.capacity.reservedUnits).toBe(4000);
    expect(state.lots[1].storage).toEqual(fixture().lots[1].storage);
  });

  it('sells a native storage overflow offer once, preserving protected stock and balanced common accounts', () => {
    const state = fixture(1, 1500), storage = getReleveCommerceStorageSnapshot(state);
    expect(storage.lots[0].overflowOffer?.units).toBe(3000);
    const action = { path: '/api/arena/placard/storage', method: 'POST', body: { action: 'sell-overflow', flowerId: storage.lots[0].flowerId, requestKey: 'storage-receipt' } };
    const sold = applyReleveCommerceRequest(state, action);
    expect(getReleveCommerceStorageSnapshot(sold.state).capacity.overflowUnits).toBe(0);
    expect(getReleveCommerceStorageSnapshot(sold.state).lots[0].projection.capacity!.totalUnits).toBe(12000);
    expect(sold.state.wholesaleSales[0].equivalentUnits).toBe(3000);
    expect(applyReleveCommerceRequest(sold.state, action).state).toEqual(sold.state);
    const treasury = getReleveCommerceTreasury(sold.state);
    expect(getKqTreasuryReport(treasury).reconciled).toBe(true);
    expect(getKqTreasuryReport(treasury).balanceSheet.differenceCents).toBe(0);
  });

  it('applies the real warehouse quote to the shared wallet and protects overflow after installing more storage', () => {
    const state = fixture(1, 1500), previous = state.lots[0].game.warehouse!.sourceState;
    const candidate = structuredClone(previous);
    candidate.serviceZones!.find(zone => zone.kind === 'storage')!.width = 2;
    const quote = getKqWarehouseQuote(candidate, previous);
    const action = { path: '/api/arena/placard/warehouse', method: 'PATCH', body: { state: candidate, expectedRevision: 0, expectedCostCents: quote.totalCostCents, requestKey: 'install-storage' } };
    const installed = applyReleveCommerceRequest(state, action).state;
    expect(getReleveCommerceStorageSnapshot(installed).capacity.overflowUnits).toBe(0);
    expect(installed.operations.trial.commerce.cashCents).toBe(90_000 - quote.totalCostCents);
    expect(installed.warehouseRevision).toBe(1);
    expect(applyReleveCommerceRequest(installed, action).state).toEqual(installed);
    expect(() => applyReleveCommerceRequest(installed, { ...action, body: { ...action.body, requestKey: 'stale-plan' } })).toThrow('plan a changé');
    expect(getKqTreasuryReport(getReleveCommerceTreasury(installed)).reconciled).toBe(true);
    expect(state.warehouseState).toBeUndefined();
  });

  it('persists bank and savings against the same commerce wallet, with replay-safe balanced journal entries', async () => {
    let state = fixture();
    const transport = () => createReleveCommerceTransport({ getState: () => state, setState: next => { state = next; } });
    const request = async (path: string, body?: object) => {
      const response = await transport()(path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined);
      expect(response.ok).toBe(true);
      return response.json();
    };
    const bank = await request('/api/arena/placard/bank');
    expect(bank.cashCents).toBe(90_000);
    const loan = { action: 'borrow', requestKey: '72000000-0000-4000-8000-000000000001', quoteId: bank.offer.quoteId, amountCents: 10000, expectedRateBps: bank.offer.rateBps };
    await request('/api/arena/placard/bank', loan);
    expect(state.operations.trial.commerce.cashCents).toBe(100_000);
    state = JSON.parse(JSON.stringify(state));
    await request('/api/arena/placard/bank', loan);
    expect(state.operations.trial.commerce.cashCents).toBe(100_000);
    expect(state.journal.filter(entry => entry.kind === 'loan-issued')).toHaveLength(1);
    await request('/api/arena/chanvrier/savings', { action: 'deposit', amountCents: 5000, requestKey: '72000000-0000-4000-8000-000000000002' });
    expect(getReleveCommerceSnapshot(state).cashCents).toBe(95_000);
    state = run(state, { action: 'buy-computer', requestKey: 'computer-buy' }).state;
    expect((await request('/api/arena/placard/bank')).cashCents).toBe(50_000);
    const savings = await request('/api/arena/chanvrier/savings');
    expect(savings.balanceCents).toBe(5000);
    expect(savings.cashCents).toBe(50_000);
    const treasury = getReleveCommerceTreasury(state);
    expect(treasury.checks.savingsCents).toBe(5000);
    expect(getKqTreasuryReport(treasury).reconciled).toBe(true);
    expect(getKqTreasuryReport(treasury).balanceSheet.differenceCents).toBe(0);
  });
  it('imports both real harvests and every invoice without adding cash, machines or a shop', () => {
    const state = fixture();
    const snapshot = getReleveCommerceSnapshot(state);
    expect(snapshot.cashCents).toBe(90_000);
    expect(snapshot.rawLots.map(row => row.harvestGrams)).toEqual([200, 200]);
    expect(state.operations.shared.ownedCodes).toEqual([]);
    expect(snapshot.computerOwned).toBe(false);
    expect(snapshot.online!.site.active).toBe(false);
    expect(snapshot.business!.lab.outstandingCents).toBe(4500);
    expect(snapshot.business!.suppliers!.outstandingCents).toBe(2200);
    expect(state.operations.storage.ownedContainers).toEqual({ 'GLASS-1L': 24 });
    expect(state.lots.every(lot => lot.storage.capacity?.automaticOverflowSale === false)).toBe(true);
    const treasury = getReleveCommerceTreasury(state);
    expect(isKqTreasurySnapshot(treasury)).toBe(true);
    expect(treasury.closingBalances.cash).toBe(90_000);
    expect(getKqTreasuryReport(treasury).balanceSheet.differenceCents).toBe(0);
  });

  it('requires an explicit six-hour advance and never automatically sells warehouse overflow', () => {
    const state = fixture(1, 1500);
    expect(getReleveCommerceSnapshot(state).rawLots[0].storage!.capacity!.overflowUnits).toBe(3000);
    const later = run(state, { action: 'mature' }, true).state;
    expect(later.operations.trial.clock - state.operations.trial.clock).toBe(6 * 3_600_000);
    expect(later.operations.trial.commerce.cashCents).toBe(90_000);
    expect(getReleveCommerceSnapshot(later).rawLots[0].harvestGrams).toBe(1500);
    expect(later.operations.storage.overflowSales).toEqual([]);
  });

  it('prepares entire lots, preserves the other lot and partial-sale stock, and settles supplier withholding once', () => {
    let state = run(fixture(), { action: 'mature' }, true).state;
    state = prepare(state);
    const first = state.operations.trial.commerce.stocks[0];
    state = sell(state, 100, first.id);
    const soldFirst = state.operations.trial.commerce.stocks.find(row => row.id === first.id)!;
    expect(soldFirst.remainingUnits).toBe(1900);
    state = prepare(state);
    expect(state.operations.trial.commerce.stocks.map(row => row.remainingUnits).sort()).toEqual([1900, 2000]);
    state = sell(state, 1900, first.id);
    const business = state.operations.trial.commerce.business!;
    const supplierPaid = state.operations.trial.commerce.receipts.reduce((sum, row) => sum + (row.supplierPaidCents ?? 0), 0);
    expect(supplierPaid).toBeGreaterThan(0);
    expect(business.suppliers!.outstandingCents).toBe(2200 - supplierPaid);
    expect(business.suppliers!.invoices[0].remainingCents).toBe(business.suppliers!.outstandingCents);
    expect(state.operations.trial.commerce.stocks.find(row => row.id !== first.id)!.remainingUnits).toBe(2000);
    const treasury = getReleveCommerceTreasury(state);
    expect(isKqTreasurySnapshot(treasury)).toBe(true);
    expect(treasury.closingBalances.cash).toBe(state.operations.trial.commerce.cashCents);
    expect(getKqTreasuryReport(treasury).balanceSheet.differenceCents).toBe(0);
  });

  it('shares the rolling wholesale quota across lots and replenishes it after 24 hours', () => {
    let state = run(fixture(2, 600), { action: 'mature' }, true).state;
    state = prepare(prepare(state));
    state = sell(state, 6000);
    const second = state.operations.trial.commerce.stocks.find(row => row.remainingUnits > 0)!;
    state = sell(state, 6000, second.id);
    expect(getReleveCommerceSnapshot(state).wholesale!.remainingEquivalentUnits).toBe(0);
    expect(state.operations.trial.commerce.stocks.find(row => row.id === second.id)!.remainingUnits).toBe(2000);
    expect(() => sell(state, 100, second.id)).toThrow('capacité');
    state = online(state, 'advance-online-time', { hours: 24 });
    expect(getReleveCommerceSnapshot(state).wholesale!.remainingEquivalentUnits).toBe(10000);
  });

  it('opens a free basic site after the explicit computer loan, charges packaging and accepts sold-out publication', () => {
    let state = prepare(run(fixture(1), { action: 'mature' }, true).state);
    expect(() => run(state, { action: 'create-shop', name: 'La ferme' })).toThrow('ordinateur');
    state = run(state, { action: 'borrow-computer' }, true).state;
    const before = state.operations.trial.commerce.cashCents;
    state = run(state, { action: 'create-shop', name: 'La ferme' }).state;
    expect(state.operations.trial.commerce.cashCents).toBe(before);
    state = online(state, 'buy-packaging', { code: 'kraft-5', quantity: 1 });
    expect(state.operations.trial.commerce.cashCents).toBeLessThan(before);
    state = online(state, 'create-listing', { stockId: state.operations.trial.commerce.stocks[0].id, formatGrams: 5, packagingCode: 'kraft-5', packets: 1, packetPriceCents: 1000 });
    state = online(state, 'start-marketing', { version: 2, code: 'introduction', angle: 'value', listingId: state.operations.trial.commerce.online!.listings[0].id, budgetCode: 'local' });
    state = online(state, 'advance-online-time', { hours: 24 });
    state = run(state, { action: 'read-report' }, true).state;
    expect(state.operations.trial.commerce.online!.listings[0].status).toBe('sold-out');
    expect(getReleveCommerceProgress(state, 'shop').complete).toBe(true);
    expect(state.operations.trial.commerce.stocks[0].remainingUnits).toBe(1950);
    const report = getKqTreasuryReport(getReleveCommerceTreasury(state));
    expect(report.income.revenueCents).toBe(833);
    expect(state.operations.trial.commerce.online!.stats.feesCents).toBe(25);
    expect(report.balanceSheet.differenceCents).toBe(0);
  });

  it('offers a separately named sample only after consent, retaining the original verdict and depleted lot', () => {
    let state = prepare(run(fixture(1, 30), { action: 'mature' }, true).state);
    expect(needsReleveCommerceSample(state)).toBe(false);
    expect(() => run(state, { action: 'borrow-sample' }, true)).toThrow('lot pédagogique');
    state = sell(state, 300);
    const original = structuredClone(state.lots[0]);
    expect(needsReleveCommerceSample(state)).toBe(true);
    state = run(state, { action: 'borrow-sample' }, true).state;
    expect(state.lots[0]).toEqual(original);
    expect(state.lots[1].assistance).toBe(true);
    expect(state.operations.trial.commerce.stocks.at(-1)!.remainingUnits).toBe(300);
    expect(state.operations.trial.commerce.stocks.at(-1)!.name).toContain('démonstration');
  });

  it('awards the 50 euro first-harvest reward once and keeps its receipt balanced', () => {
    const first = run(fixture(), { action: 'first-harvest', requestKey: 'claim' }, true);
    const replay = run(first.state, { action: 'first-harvest', requestKey: 'claim' }, true);
    expect(replay.state).toBe(first.state);
    expect(first.state.operations.trial.commerce.cashCents).toBe(95_000);
    expect(() => run(first.state, { action: 'first-harvest' }, true)).toThrow('déjà');
    expect(getKqTreasuryReport(getReleveCommerceTreasury(first.state)).balanceSheet.differenceCents).toBe(0);
  });

  it('uses the native mission claim and receipt without duplicating a reward on replay', async () => {
    let state = fixture();
    const request = createReleveCommerceTransport({ getState: () => state, setState: next => { state = next; } });
    const snapshot = await (await request('/api/arena/placard/missions')).json();
    expect(snapshot.missions.filter((mission: { claimable: boolean }) => mission.claimable)).toEqual([expect.objectContaining({ code: 'first-harvest', reward: { kind: 'cash', amountCents: 5000 } })]);
    const claim = () => request('/api/arena/placard/missions', { method: 'POST', body: JSON.stringify({ code: 'first-harvest' }) });
    expect(await (await claim()).json()).toMatchObject({ replayed: false, cashAfterCents: 95_000, reward: { kind: 'cash', amountCents: 5000 } });
    expect(await (await claim()).json()).toMatchObject({ replayed: true, cashAfterCents: 95_000 });
    expect(getKqTreasuryReport(getReleveCommerceTreasury(state)).balanceSheet.differenceCents).toBe(0);
    expect((await request('/api/arena/placard/missions', { method: 'POST', body: JSON.stringify({ code: 'three-varieties' }) })).ok).toBe(false);
  });

  it('paginates actual receipts and shows an empty previous period before the first month', () => {
    const state = fixture();
    const first = getReleveCommerceTreasury(state, { limit: 2 });
    const next = getReleveCommerceTreasury(state, { limit: 2, offset: 2 });
    expect(first.journal.items).toHaveLength(2);
    expect(next.journal.items).toHaveLength(2);
    expect(first.journal.items[0].id).not.toBe(next.journal.items[0].id);
    const previous = getReleveCommerceTreasury(state, { period: 'previous' });
    expect(previous.journal.items).toEqual([]);
    expect(previous.closingBalances.cash).toBe(200_000);
    expect(isKqTreasurySnapshot(previous)).toBe(true);
  });

  it('pays the selected zone invoice, leaving the other zone debt and cash intact', () => {
    const source = fixture();
    const state = createReleveCommerce({ cashCents: 90_000, clock: source.operations.trial.clock, harvests: source.lots,
      ledger: [...source.productionLedger, { ...source.productionLedger.find(row => row.id === 'lab')!, id: 'second-lab' }] });
    const paid = run(state, { action: 'pay-lab', invoiceId: 'second-lab' }).state;
    expect(paid.operations.trial.commerce.cashCents).toBe(85_500);
    expect(paid.operations.trial.commerce.business!.lab.invoices.map(row => row.remainingCents)).toEqual([4500, 0]);
    expect(paid.operations.trial.commerce.business!.lab.outstandingCents).toBe(4500);
    expect(getKqTreasuryReport(getReleveCommerceTreasury(paid)).balanceSheet.differenceCents).toBe(0);
  });

  it('remits reserved VAT at the calendar deadline without charging the cash balance again', () => {
    let state = sell(prepare(run(fixture(1), { action: 'mature' }, true).state), 100);
    const cash = state.operations.trial.commerce.cashCents, reserved = state.operations.trial.commerce.business!.vat.reservedCents;
    expect(reserved).toBeGreaterThan(0);
    for (let day = 0; day < 5; day++) state = online(state, 'advance-online-time', { hours: 24 });
    expect(state.operations.trial.commerce.cashCents).toBe(cash);
    expect(state.operations.trial.commerce.business!.vat).toMatchObject({ reservedCents: 0, paidCents: reserved });
    expect(getKqTreasuryReport(getReleveCommerceTreasury(state)).balanceSheet.differenceCents).toBe(0);
  });

  it('keeps the optional business dossier separate and requires a campaign after its publication', () => {
    const state = createReleveCommerceBusiness();
    expect(state.operations.trial.commerce.cashCents).toBe(500_000);
    expect(state.lots[0].name).toContain('prêtée');
    expect(state.milestones).toContain('business-dossier');
    state.milestones.push('published', 'online-time', 'report-read');
    expect(getReleveCommerceProgress(state, 'shop').complete).toBe(true);
    expect(getReleveCommerceProgress(state, 'business').complete).toBe(false);
  });

  it('serializes state and never calls the network for either supported or forbidden requests', async () => {
    let state = JSON.parse(JSON.stringify(fixture())) as KqReleveCommerceState;
    const network = vi.fn(() => { throw new Error('network forbidden'); }); vi.stubGlobal('fetch', network);
    const request = createReleveCommerceTransport({ getState: () => state, setState: next => { state = next; } });
    expect((await request('/api/arena/placard/commerce')).status).toBe(200);
    expect((await request('https://example.com/api/arena/placard/commerce')).status).toBe(400);
    expect((await request('/api/arena/placard/bank', { method: 'POST', body: '{}' })).status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });
});
