import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKqEquipmentDefinition, getKqEquipmentUpgradeCost } from './kanab-quest-equipment';
import { quoteKqCommerce, type KqCommerceOffer, type KqCommerceReceipt } from './kanab-quest-commerce';
import { applyKqOperationsRequest, createKqOperationsLesson, getKqOperationsCommerce, getKqOperationsEnergy, getKqOperationsEquipment, getKqOperationsProgress, type KqOperationsLessonAction } from './kanab-quest-operations-lesson';
import { createKqOperationsSession, restoreKqOperationsLesson } from './kanab-quest-operations-session';

const equipment = (body: Record<string, unknown>, method = 'PATCH'): KqOperationsLessonAction => ({ path: '/api/arena/placard/equipment', method, body });
const commerce = (body: Record<string, unknown>): KqOperationsLessonAction => ({ path: '/api/arena/placard/commerce', method: 'POST', body });
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

  it('never falls back to network, even with refused session storage', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network); vi.stubGlobal('window', {});
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Denied'); } });
    const session = createKqOperationsSession('equipment');
    const response = await session.request('/api/arena/placard/equipment', { method: 'POST', body: JSON.stringify({ equipmentCodes: ['LED-300'] }) });
    expect(response.ok).toBe(true);
    expect(session.getSnapshot().tents[0].ownedCodes).toContain('LED-300');
    expect((await session.request('/api/arena/placard/finance', { method: 'POST', body: '{}' })).status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });
});
