import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKqEquipmentDefinition, getKqEquipmentUpgradeCost, KQ_STARTING_EQUIPMENT_CODES } from './kanab-quest-equipment';
import { quoteKqCommerce, type KqCommerceOffer, type KqCommerceReceipt } from './kanab-quest-commerce';
import { applyKqOperationsRequest, createKqOperationsLesson, getKqOperationsCommerce, getKqOperationsEnergy, getKqOperationsEquipment, getKqOperationsProgress, getKqOperationsStorage, type KqOperationsLessonAction, type KqOperationsLessonState } from './kanab-quest-operations-lesson';
import { createKqOperationsSession, restoreKqOperationsLesson } from './kanab-quest-operations-session';
import { KQ_CURING_DURATION_MS, KQ_STORAGE_OVERFLOW_GRACE_MS } from './kanab-quest-storage';
import { KQ_LAB_ANALYSIS_CENTS } from './kanab-quest-business';
import { quoteKqEnergy } from './kanab-quest-energy';
import { KQ_BUDDIE_FLAVOR_PROFILES } from './kanab-quest-buddie-flavors';
import { getKqCustomerDemandFlavorMatch, KQ_CUSTOMER_DEMAND_PERIOD_MS, type KqCustomerDemandChannel } from './kanab-quest-customer-demand';

const equipment = (body: Record<string, unknown>, method = 'PATCH'): KqOperationsLessonAction => ({ path: '/api/arena/placard/equipment', method, body });
const commerce = (body: Record<string, unknown>): KqOperationsLessonAction => ({ path: '/api/arena/placard/commerce', method: 'POST', body });
const storage = (body: Record<string, unknown>): KqOperationsLessonAction => ({ path: '/api/arena/placard/storage', method: 'POST', body });
afterEach(() => vi.unstubAllGlobals());

function demandStock(channel: KqCustomerDemandChannel, matchedNotes: 0 | 1 | 2) {
  let state = createKqOperationsLesson('market');
  const request = getKqOperationsCommerce(state).customerDemand!.requests.find(row => row.channel === channel)!;
  const varietyCode = Object.keys(KQ_BUDDIE_FLAVOR_PROFILES).find(code => getKqCustomerDemandFlavorMatch(request, code).matchedFlavorCount === matchedNotes)!;
  expect(varietyCode).toBeTruthy();
  state.trial.game!.varietyCode = varietyCode;
  const raw = getKqOperationsCommerce(state).rawLots[0];
  expect(raw.varietyCode).toBe(varietyCode);
  state = applyKqOperationsRequest(state, commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: raw.options.find(row => row.route === 'raw')!.market!.processingCostCents })).state;
  state.trial.commerce.stocks[0].juryScore = 9.7;
  state.trial.commerce.stocks[0].storage!.conditionScore = 9.7;
  return { state, request, varietyCode };
}

describe('periodic requests in the isolated market', () => {
  it('exposes all three profiles on the virtual clock, without consuming demand on read', () => {
    const initial = createKqOperationsLesson('market'), before = structuredClone(initial);
    const snapshot = getKqOperationsCommerce(initial);
    expect(snapshot.customerDemand!.serverNow).toBe(new Date(initial.trial.clock).toISOString());
    expect(snapshot.customerDemand!.requests.map(row => row.channel)).toEqual(['online', 'cbd-shop', 'wholesale']);
    expect(snapshot.rawLots[0].varietyCode).toBe(initial.trial.game!.varietyCode);
    expect(initial).toEqual(before);
  });

  it.each(['cbd-shop', 'wholesale'] as const)('pays zero, half or full aroma premium through %s, only at confirmation', channel => {
    for (const matches of [0, 1, 2] as const) {
      const { state, request, varietyCode } = demandStock(channel, matches);
      const stock = state.trial.commerce.stocks[0];
      expect(stock.varietyCode).toBe(varietyCode);
      const quoted = applyKqOperationsRequest(state, commerce({ action: 'quote', stockId: stock.id, channel, policy: 'advised', units: 50 }));
      const quote = quoted.payload as { quoteId: string; offer: KqCommerceOffer };
      expect(quoted.state.customerDemandUsage).toEqual({});
      expect(quote.offer.unitCents).toBeCloseTo((channel === 'cbd-shop' ? 300 : 210) * (1 + request.bonusPercent * matches / 200), 6);
      if (matches) expect(quote.offer.customerDemand).toMatchObject({ units: 50, bonusPercent: request.bonusPercent * matches / 2, matchedFlavorCount: matches });
      else expect(quote.offer.customerDemand).toBeUndefined();
      const sale = commerce({ action: 'sell', quoteId: quote.quoteId, expectedPayoutCents: quote.offer.payoutCents, requestKey: 'demand-sale' });
      const sold = applyKqOperationsRequest(quoted.state, sale);
      expect(sold.state.customerDemandUsage?.[request.id] ?? 0).toBe(matches ? 50 : 0);
      expect(sold.state.trial.commerce.receipts.at(-1)!.payoutCents).toBe(quote.offer.payoutCents);
      expect(applyKqOperationsRequest(sold.state, sale).state).toBe(sold.state);
      expect(sold.state.trial.commerce.customerDemand!.requests.find(row => row.channel === channel)!.remainingUnits).toBe(request.capacityUnits - (matches ? 50 : 0));
    }
  });

  it('shares the remaining bonus across lots while selling excess quantity at the regular price', () => {
    const { state, request } = demandStock('wholesale', 2);
    state.customerDemandUsage = { [request.id]: request.capacityUnits - 30 };
    const stock = state.trial.commerce.stocks[0];
    const secondUnits = Math.floor(stock.remainingUnits / 2);
    stock.remainingUnits -= secondUnits;
    state.trial.commerce.stocks.push({ ...structuredClone(stock), id: 'second-lot', remainingUnits: secondUnits });
    const quoted = applyKqOperationsRequest(state, commerce({ action: 'quote', stockId: stock.id, channel: 'wholesale', policy: 'advised', units: 50 }));
    const quote = quoted.payload as { quoteId: string; offer: KqCommerceOffer };
    expect(quote.offer.customerDemand!.units).toBe(30);
    expect(quote.offer.payoutCents).toBe(Math.round(210 * (20 + 30 * (1 + request.bonusPercent / 100)) / 10));
    const sold = applyKqOperationsRequest(quoted.state, commerce({ action: 'sell', quoteId: quote.quoteId, expectedPayoutCents: quote.offer.payoutCents })).state;
    const next = applyKqOperationsRequest(sold, commerce({ action: 'quote', stockId: 'second-lot', channel: 'wholesale', policy: 'advised', units: 50 })).payload as { offer: KqCommerceOffer };
    expect(next.offer.customerDemand).toBeUndefined();
    expect(next.offer.unitCents).toBe(210);
    expect(next.offer.reason).toBeNull();
    expect(sold.customerDemandUsage![request.id]).toBe(request.capacityUnits);
  });

  it('rolls the virtual calendar forward and rejects a quote across its period boundary', () => {
    const { state, request } = demandStock('wholesale', 2);
    state.trial.clock = (request.period + 1) * KQ_CUSTOMER_DEMAND_PERIOD_MS - 1000;
    state.customerDemandUsage = { [request.id]: 50 };
    const upcoming = getKqOperationsCommerce(state).customerDemand!.upcoming;
    expect(upcoming).toHaveLength(3);
    const quoted = applyKqOperationsRequest(state, commerce({ action: 'quote', stockId: state.trial.commerce.stocks[0].id, channel: 'wholesale', policy: 'advised', units: 10 }));
    const quote = quoted.payload as { quoteId: string; offer: KqCommerceOffer };
    quoted.state.trial.clock += 1000;
    const next = getKqOperationsCommerce(quoted.state).customerDemand!;
    expect(next.period).toBe(request.period + 1);
    expect(next.requests).toEqual(upcoming);
    expect(next.requests.every(row => row.remainingUnits === row.capacityUnits)).toBe(true);
    expect(quoted.state.customerDemandUsage![request.id]).toBe(50);
    expect(() => applyKqOperationsRequest(quoted.state, commerce({ action: 'sell', quoteId: quote.quoteId, expectedPayoutCents: quote.offer.payoutCents }))).toThrow('Recalcule');
  });

  it('restores a consumed allowance by replaying the saved local actions', () => {
    let state = createKqOperationsLesson('market');
    const actions: KqOperationsLessonAction[] = [];
    const execute = (action: KqOperationsLessonAction) => {
      const result = applyKqOperationsRequest(state, action);
      state = result.state; actions.push(action);
      return result.payload;
    };
    const raw = getKqOperationsCommerce(state).rawLots[0];
    execute(commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: raw.options.find(row => row.route === 'raw')!.market!.processingCostCents }));
    let channel: 'cbd-shop' | 'wholesale' | undefined;
    for (let day = 0; day < 10; day++) {
      channel = (['cbd-shop', 'wholesale'] as const).find(candidate => quoteKqCommerce(getKqOperationsCommerce(state), state.trial.commerce.stocks[0], candidate, 'advised', 10, state.trial.clock).customerDemand);
      if (channel) break;
      execute(commerce({ action: 'online', command: 'advance-online-time', payload: { hours: 24 } }));
    }
    expect(channel).toBeTruthy();
    const quote = execute(commerce({ action: 'quote', stockId: state.trial.commerce.stocks[0].id, channel, policy: 'advised', units: 10 })) as { quoteId: string; offer: KqCommerceOffer };
    const sale = commerce({ action: 'sell', quoteId: quote.quoteId, expectedPayoutCents: quote.offer.payoutCents, requestKey: 'saved-demand-sale' });
    execute(sale);
    expect(Object.values(state.customerDemandUsage!).reduce((sum, units) => sum + units, 0)).toBe(10);
    const restored = restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions }).state;
    expect(restored).toEqual(state);
    expect(applyKqOperationsRequest(restored, sale).state).toBe(restored);
  });
});

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

  it('lends drying to the first building and exposes only physical culture equipment in tents', () => {
    const state = createKqOperationsLesson('warehouse'), snapshot = getKqOperationsEquipment(state);
    expect(snapshot.equipmentScopeVersion).toBe(3);
    expect(snapshot.buildings[0]).toMatchObject({ buildingNumber: 1, anchorTentNumber: 1, equippedCodes: ['DRYING-ROOM'] });
    expect(snapshot.tents[0].ownedCodes).not.toContain('DRYING-ROOM');
    expect(snapshot.equippedCodes).toContain('DRYING-ROOM');
    expect(snapshot.cultureOperationalCodes).toContain('DRYING-ROOM');
    expect(snapshot.buildings[0].cultureWear['DRYING-ROOM']).toMatchObject({ conditionPercent: 100, due: false });
    expect(snapshot.tents[0].cultureWear['DRYING-ROOM']).toBeUndefined();
  });

  it('shares services bought from tents two and six within their own building and bills each physical service once', () => {
    let state = createKqOperationsLesson('equipment');
    state.trial.commerce.cashCents = 10_000_000; // Lent test budget, never an official account.
    const expandTo = (current: KqOperationsLessonState, count: number) => {
      while (current.tents.length < count) {
        const expansion = getKqOperationsEquipment(current).production;
        current = applyKqOperationsRequest(current, equipment({ action: 'expand-production', expectedUnits: current.tents.length, expectedCostCents: expansion.totalCostCents })).state;
      }
      return current;
    };
    state = expandTo(state, 4);
    const firstServices = ['DRYING-ROOM', 'SOLAR-BACKUP', 'SECURITY-CAMERA'];
    const before = state.trial.commerce.cashCents;
    state = applyKqOperationsRequest(state, equipment({ tentNumber: 2, equipmentCodes: firstServices }, 'POST')).state;
    expect(getKqOperationsEnergy(state).buildings[0].cultureWear['DRYING-ROOM']).toMatchObject({ conditionPercent: 100, due: false });
    expect(state.trial.commerce.cashCents).toBe(before - firstServices.reduce((sum, code) => sum + getKqEquipmentDefinition(code)!.priceCents, 0));
    for (const code of firstServices) state = applyKqOperationsRequest(state, equipment({ tentNumber: 2, equipmentCode: code })).state;
    state = applyKqOperationsRequest(state, equipment({ action: 'upgrade', tentNumber: 4, equipmentCode: 'SOLAR-BACKUP', expectedLevel: 1 })).state;
    for (let tent = 1; tent <= 4; tent++) {
      const snapshot = getKqOperationsEquipment(state, tent);
      expect(snapshot.equippedCodes).toEqual(expect.arrayContaining(firstServices));
      expect(snapshot.levels['SOLAR-BACKUP']).toBe(2);
      expect(snapshot.tents[tent - 1].ownedCodes).toEqual([...KQ_STARTING_EQUIPMENT_CODES]);
    }
    const expectedAnchor = quoteKqEnergy([...KQ_STARTING_EQUIPMENT_CODES, ...firstServices], { 'SOLAR-BACKUP': 2 });
    const expectedOther = quoteKqEnergy([...KQ_STARTING_EQUIPMENT_CODES, 'SOLAR-BACKUP'], { 'SOLAR-BACKUP': 2 });
    const energy = getKqOperationsEnergy(state).quotes.balanced;
    expect(energy.totalCents).toBe(expectedAnchor.totalCents + 3 * expectedOther.totalCents);
    expect(energy.lines.filter(line => line.code === 'DRYING-ROOM')).toMatchObject([{ tentNumber: 1, buildingNumber: 1 }]);
    expect(energy.lines.filter(line => line.code === 'SECURITY-CAMERA')).toHaveLength(1);
    state = expandTo(state, 5);
    expect(state.buildings[1]).toMatchObject({ buildingNumber: 2, anchorTentNumber: 5, ownedCodes: [], equippedCodes: [] });
    expect(getKqOperationsEquipment(state, 5).ownedCodes).not.toContain('DRYING-ROOM');
    expect(getKqOperationsEnergy(state).quotes.balanced.totalCents).toBe(energy.totalCents + quoteKqEnergy([...KQ_STARTING_EQUIPMENT_CODES]).totalCents);
    state = expandTo(state, 8);
    state = applyKqOperationsRequest(state, equipment({ tentNumber: 6, equipmentCodes: ['SECURITY-DOG'] }, 'POST')).state;
    state = applyKqOperationsRequest(state, equipment({ tentNumber: 6, equipmentCode: 'SECURITY-DOG' })).state;
    for (let tent = 5; tent <= 8; tent++) {
      expect(getKqOperationsEquipment(state, tent).equippedCodes).toContain('SECURITY-DOG');
      expect(getKqOperationsEquipment(state, tent).equippedCodes).not.toContain('SECURITY-CAMERA');
      expect(getKqOperationsEquipment(state, tent).equippedCodes).not.toContain('SOLAR-BACKUP');
    }
    expect(getKqOperationsEquipment(state, 2).equippedCodes).toContain('SECURITY-CAMERA');
    expect(getKqOperationsEquipment(state, 2).equippedCodes).not.toContain('SECURITY-DOG');
    expect(() => applyKqOperationsRequest(state, equipment({ tentNumber: 7, equipmentCodes: ['SECURITY-DOG'] }, 'POST'))).toThrow();
  });

  it('replays a building service journal once from a non-anchor tent without affecting another lesson', () => {
    const initial = createKqOperationsLesson('equipment'), expansion = getKqOperationsEquipment(initial).production;
    const actions = [equipment({ action: 'expand-production', expectedUnits: 1, expectedCostCents: expansion.totalCostCents, requestKey: 'second-tent' }),
      equipment({ tentNumber: 2, equipmentCodes: ['SECURITY-CAMERA'], requestKey: 'building-camera' }, 'POST'),
      equipment({ tentNumber: 2, equipmentCode: 'SECURITY-CAMERA' }),
      equipment({ action: 'upgrade', tentNumber: 2, equipmentCode: 'SECURITY-CAMERA', expectedLevel: 1, requestKey: 'camera-upgrade' })];
    const state = actions.reduce((current, action) => applyKqOperationsRequest(current, action).state, initial);
    const restored = restoreKqOperationsLesson('equipment', { version: 1, lesson: 'equipment', actions });
    expect(restored.state).toEqual(state);
    expect(getKqOperationsEquipment(restored.state, 1).levels['SECURITY-CAMERA']).toBe(2);
    expect(applyKqOperationsRequest(state, actions[1]).state).toBe(state);
    expect(createKqOperationsLesson('equipment')).toEqual(initial);
  });

  it('transforms with the official yield then sells a quoted partial quantity once', () => {
    const initial = createKqOperationsLesson('market');
    const raw = getKqOperationsCommerce(initial).rawLots[0];
    const route = raw.options.find(item => item.route === 'dry-sift')!;
    expect(route.available).toBe(true);
    const prepared = applyKqOperationsRequest(initial, commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'dry-sift', expectedCostCents: route.market!.processingCostCents })).state;
    expect(getKqOperationsCommerce(prepared).rawLots).toHaveLength(0);
    expect(prepared.shared.maintenance['SIFT-TRAY'].cycles).toBe(1);
    expect(prepared.shared.maintenance['PRESS-0600']).toBeUndefined();
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
      const retail = quoteKqCommerce(prepared.trial.commerce, stock, 'cbd-shop', 'advised', 10, prepared.trial.clock);
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
