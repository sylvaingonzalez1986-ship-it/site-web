import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKqEquipmentDefinition, getKqEquipmentUpgradeCost } from './kanab-quest-equipment';
import { quoteKqCommerce, type KqCommerceOffer, type KqCommerceReceipt } from './kanab-quest-commerce';
import { applyKqOperationsRequest, createKqOperationsLesson, getKqOperationsCommerce, getKqOperationsEnergy, getKqOperationsEquipment, getKqOperationsProgress, getKqOperationsStorage, type KqOperationsLessonAction } from './kanab-quest-operations-lesson';
import { createKqOperationsSession, restoreKqOperationsLesson } from './kanab-quest-operations-session';
import { KQ_CURING_DURATION_MS, KQ_STORAGE_OVERFLOW_GRACE_MS } from './kanab-quest-storage';
import { KQ_LAB_ANALYSIS_CENTS } from './kanab-quest-business';

const equipment = (body: Record<string, unknown>, method = 'PATCH'): KqOperationsLessonAction => ({ path: '/api/arena/placard/equipment', method, body });
const commerce = (body: Record<string, unknown>): KqOperationsLessonAction => ({ path: '/api/arena/placard/commerce', method: 'POST', body });
const storage = (body: Record<string, unknown>): KqOperationsLessonAction => ({ path: '/api/arena/placard/storage', method: 'POST', body });
afterEach(() => vi.unstubAllGlobals());

describe('real operations on a loaned installation', () => {
  it('purchases into reserve, installs only in the selected tent and preserves the starter', () => {
    const initial = createKqOperationsLesson('equipment');
    const purchase = equipment({ equipmentCodes: ['LED-300'], requestKey: 'lamp', tentNumber: 1 }, 'POST');
    const bought = applyKqOperationsRequest(initial, purchase).state;
    expect(initial.tents[0].ownedCodes).not.toContain('LED-300');
    expect(bought.tents[0].ownedCodes).toContain('LED-300');
    expect(bought.tents[0].equippedCodes).not.toContain('LED-300');
    expect(bought.trial.commerce.cashCents).toBe(initial.trial.commerce.cashCents - getKqEquipmentDefinition('LED-300')!.priceCents);
    expect(applyKqOperationsRequest(bought, purchase).state).toBe(bought);
    const installed = applyKqOperationsRequest(bought, equipment({ equipmentCode: 'LED-300' })).state;
    expect(installed.tents[0].equippedCodes).toContain('LED-300');
    expect(installed.tents[0].equippedCodes).not.toContain('LED-150-STARTER');
    expect(installed.tents[0].ownedCodes).toContain('LED-150-STARTER');
    expect(getKqOperationsProgress(installed).complete).toBe(true);
    expect(getKqOperationsEnergy(installed).quotes.intensive.totalCents).toBeGreaterThan(getKqOperationsEnergy(installed).quotes.eco.totalCents);
  });

  it('uses live improvement, repair and expansion costs without altering a second installation', () => {
    const initial = createKqOperationsLesson('warehouse');
    const [code, condition] = Object.entries(initial.shared.maintenance)[0];
    expect(condition.due).toBe(true);
    const repaired = applyKqOperationsRequest(initial, equipment({ action: 'repair', equipmentCode: code, expectedVersion: condition.version })).state;
    expect(repaired.shared.maintenance[code].due).toBe(false);
    expect(repaired.trial.commerce.cashCents).toBe(initial.trial.commerce.cashCents - condition.repairCents);
    const upgraded = applyKqOperationsRequest(repaired, equipment({ action: 'upgrade', equipmentCode: 'LED-300', expectedLevel: 1 })).state;
    expect(upgraded.tents[0].levels['LED-300']).toBe(2);
    expect(upgraded.trial.commerce.cashCents).toBe(repaired.trial.commerce.cashCents - getKqEquipmentUpgradeCost('LED-300', 1)!);
    const expansion = getKqOperationsEquipment(upgraded).production;
    const expanded = applyKqOperationsRequest(upgraded, equipment({ action: 'expand-production', expectedUnits: 1, expectedCostCents: expansion.totalCostCents })).state;
    expect(expanded.tents).toHaveLength(2);
    expect(expanded.tents[1].ownedCodes).not.toContain('LED-300');
    expect(createKqOperationsLesson('warehouse')).toEqual(initial);
    expect(() => applyKqOperationsRequest(upgraded, equipment({ action: 'upgrade', equipmentCode: 'LED-300', expectedLevel: 1 }))).toThrow();
  });

  it('transforms with the official yield then sells a quoted partial quantity once', () => {
    const initial = createKqOperationsLesson('market');
    const raw = getKqOperationsCommerce(initial).rawLots[0];
    const route = raw.options.find(item => item.route === 'dry-sift')!;
    expect(route.available).toBe(true);
    const prepared = applyKqOperationsRequest(initial, commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'dry-sift', expectedCostCents: route.market!.processingCostCents })).state;
    expect(getKqOperationsCommerce(prepared).rawLots).toHaveLength(0);
    const stock = prepared.trial.commerce.stocks[0];
    expect(stock.remainingUnits).toBe(Math.round(route.productGrams * 10));
    const quoted = applyKqOperationsRequest(prepared, commerce({ action: 'quote', stockId: stock.id, channel: 'wholesale', policy: 'advised', units: 10 }));
    const quote = quoted.payload as { quoteId: string; offer: KqCommerceOffer };
    expect(quote.offer).toEqual(quoteKqCommerce(prepared.trial.commerce, stock, 'wholesale', 'advised', 10, prepared.trial.clock));
    const sell = commerce({ action: 'sell', quoteId: quote.quoteId, expectedPayoutCents: quote.offer.payoutCents, requestKey: 'sale-once' });
    const sold = applyKqOperationsRequest(quoted.state, sell);
    const receipt = sold.payload as KqCommerceReceipt;
    expect(sold.state.trial.commerce.stocks[0].remainingUnits).toBe(stock.remainingUnits - 10);
    expect(sold.state.trial.commerce.cashCents - prepared.trial.commerce.cashCents).toBe(receipt.netPayoutCents);
    expect(receipt.payoutCents).toBe((receipt.netPayoutCents ?? 0) + (receipt.vatCents ?? 0) + (receipt.labPaidCents ?? 0) + (receipt.electricityPaidCents ?? 0));
    expect(applyKqOperationsRequest(sold.state, sell).state).toBe(sold.state);
    expect(() => applyKqOperationsRequest(sold.state, commerce({ ...sell.body, requestKey: 'retry-different-key' }))).toThrow();
  });

  it('replays only a valid journal and refuses other lessons or foreign endpoints', () => {
    const actions = [equipment({ equipmentCodes: ['LED-300'] }, 'POST'), equipment({ equipmentCode: 'LED-300' })];
    const restored = restoreKqOperationsLesson('equipment', { version: 1, lesson: 'equipment', actions });
    expect(getKqOperationsProgress(restored.state).complete).toBe(true);
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'equipment', actions }).actions).toEqual([]);
    expect(restoreKqOperationsLesson('equipment', { version: 1, lesson: 'equipment', actions: [...actions, { path: 'https://example.com/api/arena/placard/equipment', method: 'POST', body: {} }] }).actions).toEqual([]);
  });

  it('purchases and assigns a loaned storage installation once, then restores only that exercise', () => {
    const initial = createKqOperationsLesson('warehouse');
    const read = applyKqOperationsRequest(initial, { path: '/api/arena/placard/storage', method: 'GET', body: {} });
    expect(read.state).toBe(initial);
    expect(read.payload).toEqual(getKqOperationsStorage(initial));
    const lot = getKqOperationsStorage(initial).lots[0];
    expect(lot.projection.stage).toBe('curing');
    const actions = [storage({ action: 'buy', containerCode: 'CVAULT-1LB', quantity: 1, requestKey: 'storage-once' }),
      storage({ action: 'select-default', methodCode: 'STORAGE-CVAULT' }),
      storage({ action: 'assign', methodCode: 'STORAGE-CVAULT', flowerId: lot.flowerId })];
    expect(() => applyKqOperationsRequest(initial, actions[2])).toThrow('Achète');
    const bought = applyKqOperationsRequest(initial, actions[0]);
    expect(bought.state.trial.commerce.cashCents).toBe(initial.trial.commerce.cashCents - 12000);
    expect(applyKqOperationsRequest(bought.state, actions[0]).state).toBe(bought.state);
    const selected = applyKqOperationsRequest(bought.state, actions[1]).state;
    expect(selected.storage.lot.methodCode).toBe('STORAGE-GLASS');
    const assigned = applyKqOperationsRequest(selected, actions[2]).state;
    expect(getKqOperationsStorage(assigned).lots[0].projection).toMatchObject({ methodCode: 'STORAGE-CVAULT', readyAt: lot.projection.readyAt, curingStartedAt: lot.projection.curingStartedAt });
    expect(getKqOperationsProgress(assigned).complete).toBe(true);
    expect(restoreKqOperationsLesson('warehouse', { version: 1, lesson: 'warehouse', actions }).state).toEqual(assigned);
    expect(createKqOperationsLesson('warehouse')).toEqual(initial);
    expect(() => applyKqOperationsRequest(assigned, storage({ action: 'assign', methodCode: 'STORAGE-CVAULT', flowerId: 'official-flower' }))).toThrow('Lot indisponible');
  });

  it('keeps warehouse lots immature and advances the sales lesson after its verdict without a retail exemption', () => {
    for (const lesson of ['warehouse', 'market'] as const) {
      let initial = createKqOperationsLesson(lesson);
      if (lesson === 'warehouse') initial = applyKqOperationsRequest(initial, storage({ action: 'buy', containerCode: 'GLASS-3L', quantity: 5 })).state;
      const lot = getKqOperationsCommerce(initial).rawLots[0];
      const mature = lesson === 'market';
      expect(lot.storage!.stage).toBe(mature ? 'ready' : 'curing');
      expect(initial.trial.clock - Date.parse(initial.trial.battle!.burnedAt!)).toBe(mature ? KQ_CURING_DURATION_MS : 0);
      if (mature) expect(initial.trial.clock).toBe(Date.parse(lot.storage!.readyAt));
      expect(initial.trial.commerce.business!.lab).toMatchObject({ outstandingCents: KQ_LAB_ANALYSIS_CENTS, overdueCents: 0 });
      const route = lot.options.find(item => item.route === 'raw')!;
      const prepared = applyKqOperationsRequest(initial, commerce({ action: 'prepare', flowerId: lot.flowerId, route: 'raw', expectedCostCents: route.market!.processingCostCents })).state;
      const stock = prepared.trial.commerce.stocks[0];
      const retail = quoteKqCommerce(prepared.trial.commerce, stock, 'online', 'advised', 10, prepared.trial.clock);
      expect(stock.storage!.stage).toBe(mature ? 'ready' : 'curing');
      if (mature) expect(retail.reason).toBeNull();
      else expect(retail.reason).toContain('Curing en cours');
      expect(quoteKqCommerce(prepared.trial.commerce, stock, 'wholesale', 'advised', 10, prepared.trial.clock).reason).toBeNull();
    }
  });

  it('keeps accrued conservation losses and invalidates an earlier quotation after moving a lot', () => {
    let state = createKqOperationsLesson('market');
    const original = getKqOperationsStorage(state).lots[0].projection;
    const raw = getKqOperationsCommerce(state).rawLots[0], route = raw.options.find(item => item.route === 'raw')!;
    state = applyKqOperationsRequest(state, commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: route.market!.processingCostCents })).state;
    const quoted = applyKqOperationsRequest(state, commerce({ action: 'quote', stockId: state.trial.commerce.stocks[0].id, channel: 'wholesale', policy: 'advised', units: 10 }));
    const quote = quoted.payload as { quoteId: string; offer: KqCommerceOffer };
    state = applyKqOperationsRequest(quoted.state, storage({ action: 'buy', containerCode: 'CANNATROL', quantity: 1 })).state;
    state = applyKqOperationsRequest(state, storage({ action: 'assign', methodCode: 'STORAGE-CANNATROL', flowerId: raw.flowerId })).state;
    expect(state.trial.commerce.stocks[0].storage).toMatchObject({ methodCode: 'STORAGE-CANNATROL', conditionScore: original.conditionScore, readyAt: original.readyAt, terpenes: original.terpenes });
    expect(() => applyKqOperationsRequest(state, commerce({ action: 'sell', quoteId: quote.quoteId, expectedPayoutCents: quote.offer.payoutCents }))).toThrow('Recalcule');
  });

  it('buys repeatable quantities, fills the surplus and charges only once per request', () => {
    const initial = createKqOperationsLesson('warehouse');
    const before = getKqOperationsStorage(initial);
    expect(before.ownedContainers).toEqual({ 'GLASS-1L': 2 });
    expect(before.capacity.totalUnits).toBe(1000);
    expect(before.capacity.overflowUnits).toBeGreaterThan(0);
    const buy = storage({ action: 'buy', containerCode: 'GLASS-2L', quantity: 2, requestKey: 'two-jars' });
    const bought = applyKqOperationsRequest(initial, buy);
    const after = getKqOperationsStorage(bought.state);
    expect(after.ownedContainers['GLASS-2L']).toBe(2);
    expect(after.cashCents).toBe(before.cashCents - 1800);
    expect(after.capacity.overflowUnits).toBe(0);
    expect(after.lots[0].projection.capacity!.overflowDeadlineAt).toBe(before.lots[0].projection.capacity!.overflowDeadlineAt);
    expect(after.lots[0].projection.readyAt).toBe(before.lots[0].projection.readyAt);
    expect(applyKqOperationsRequest(bought.state, buy).state).toBe(bought.state);
    const repeated = applyKqOperationsRequest(bought.state, storage({ ...buy.body, quantity: 1, requestKey: 'one-more-jar' })).state;
    expect(repeated.storage.ownedContainers['GLASS-2L']).toBe(3);
    expect(() => applyKqOperationsRequest(initial, storage({ ...buy.body, quantity: 0 }))).toThrow('Choisis');
    expect(() => applyKqOperationsRequest(initial, storage({ ...buy.body, quantity: 1.5 }))).toThrow('Choisis');
  });

  it('blocks surplus transformation and clears only the exposed mass with a recorded wholesale payment', () => {
    const initial = createKqOperationsLesson('warehouse');
    const before = getKqOperationsStorage(initial), raw = getKqOperationsCommerce(initial).rawLots[0];
    const route = raw.options.find(item => item.route === 'raw')!;
    expect(() => applyKqOperationsRequest(initial, commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: route.market!.processingCostCents }))).toThrow('surplus');
    const sell = storage({ action: 'sell-overflow', flowerId: raw.flowerId, requestKey: 'sell-surplus' });
    const sold = applyKqOperationsRequest(initial, sell).state;
    const after = getKqOperationsStorage(sold), receipt = after.overflowSales[0];
    expect(receipt.units).toBe(before.capacity.overflowUnits);
    expect(receipt.payoutCents).toBe(Math.round(receipt.units * 5.4));
    expect(after.cashCents - before.cashCents).toBe(receipt.netPayoutCents);
    expect(after.capacity.overflowUnits).toBe(0);
    expect(after.capacity.usedUnits).toBe(before.capacity.usedUnits);
    expect(after.capacity.reservedUnits).toBe(before.capacity.reservedUnits);
    expect(getKqOperationsCommerce(sold).rawLots[0].harvestGrams).toBe(before.capacity.usedUnits / 10);
    expect(sold.trial.commerce.reputation).toBe(initial.trial.commerce.reputation);
    expect(applyKqOperationsRequest(sold, sell).state).toBe(sold);
  });

  it('automatically sells overdue surplus before a late purchase, without repeating that sale', () => {
    const initial = createKqOperationsLesson('warehouse');
    initial.trial.clock += KQ_STORAGE_OVERFLOW_GRACE_MS;
    const expired = applyKqOperationsRequest(initial, storage({ action: 'buy', containerCode: 'GLASS-3L', quantity: 1, requestKey: 'late-container' })).state;
    expect(expired.storage.overflowSales).toHaveLength(1);
    expect(expired.storage.overflowSales[0].automatic).toBe(true);
    expect(expired.storage.lot.capacity!.totalUnits).toBe(1000);
    expect(expired.storage.ownedContainers['GLASS-3L']).toBe(1);
    const read = applyKqOperationsRequest(expired, { path: '/api/arena/placard/storage', method: 'GET', body: {} });
    expect(read.state).toBe(expired);
    expect(expired.storage.overflowSales).toHaveLength(1);
  });

  it('releases containers as the flower-equivalent mass of processed products is sold', () => {
    const initial = createKqOperationsLesson('market');
    const raw = getKqOperationsCommerce(initial).rawLots[0], route = raw.options.find(item => item.route === 'dry-sift')!;
    let state = applyKqOperationsRequest(initial, commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'dry-sift', expectedCostCents: route.market!.processingCostCents })).state;
    const initialCapacity = getKqOperationsStorage(state).capacity;
    for (const current of [...state.trial.commerce.stocks]) {
      const quoted = applyKqOperationsRequest(state, commerce({ action: 'quote', stockId: current.id, channel: 'wholesale', policy: 'advised', units: current.remainingUnits }));
      const quote = quoted.payload as { quoteId: string; offer: KqCommerceOffer };
      state = applyKqOperationsRequest(quoted.state, commerce({ action: 'sell', quoteId: quote.quoteId, expectedPayoutCents: quote.offer.payoutCents })).state;
      expect(getKqOperationsStorage(state).capacity.usedUnits).toBeLessThan(initialCapacity.usedUnits);
    }
    const freed = getKqOperationsStorage(state);
    expect(freed.capacity.usedUnits).toBe(0);
    expect(freed.capacity.reservedUnits).toBe(0);
    expect(freed.capacity.freeUnits).toBe(freed.capacity.totalUnits);
    expect(freed.lots).toHaveLength(0);
  });

  it('never falls back to network, even with refused session storage', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network); vi.stubGlobal('window', {});
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Denied'); } });
    const session = createKqOperationsSession('equipment');
    const warehouse = await session.request('/api/arena/placard/storage');
    expect(warehouse.ok).toBe(true);
    expect((await warehouse.json()).ownedMethodCodes).toEqual(['STORAGE-GLASS']);
    const storageBuy = await session.request('/api/arena/placard/storage', { method: 'POST', body: JSON.stringify({ action: 'buy', containerCode: 'GROVE-1LB', quantity: 1, requestKey: 'grove' }) });
    expect(storageBuy.ok).toBe(true);
    expect(session.getSnapshot().storage.ownedContainers['GROVE-1LB']).toBe(1);
    const response = await session.request('/api/arena/placard/equipment', { method: 'POST', body: JSON.stringify({ equipmentCodes: ['LED-300'] }) });
    expect(response.ok).toBe(true);
    expect(session.getSnapshot().tents[0].ownedCodes).toContain('LED-300');
    expect((await session.request('/api/arena/placard/finance', { method: 'POST', body: '{}' })).status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });
});
