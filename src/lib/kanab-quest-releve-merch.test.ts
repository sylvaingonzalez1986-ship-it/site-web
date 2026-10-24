import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReleveCommerceGuide } from './arena-releve-commerce-guide';
import { applyReleveCommerceRequest, createReleveCommerceBusiness, createReleveCommerceMerch, createReleveCommerceTransport, getReleveCommerceProgress, type KqReleveCommerceState } from './kanab-quest-releve-commerce';
import { canReadReleveMerchReport, getReleveMerchGuide, prepareReleveCommerceMerch } from './kanab-quest-releve-merch';
import { getKqMerchModuleEligibility } from './kanab-quest-merch';

const command = (state: KqReleveCommerceState, name: string, payload: Record<string, unknown> = {}) => applyReleveCommerceRequest(state, {
  path: '/api/arena/placard/commerce', method: 'POST', body: { action: 'online', command: name, payload },
}).state;
const read = (state: KqReleveCommerceState) => applyReleveCommerceRequest(state, {
  path: '/api/releve/commerce', method: 'POST', body: { action: 'read-merch-report' },
}).state;
function stocked() {
  let state = createReleveCommerceMerch();
  state = command(state, 'buy-merch-module', { code: 'paper' });
  return command(state, 'buy-merch-stock', { code: 'stickers', quantity: 10 });
}
afterEach(() => vi.unstubAllGlobals());

describe('Merch lesson on the existing local commerce transport', () => {
  it('borrows eligibility without inventing revenue, stock, or completed learning', () => {
    const original = createReleveCommerceBusiness(), before = structuredClone(original);
    const state = prepareReleveCommerceMerch(original), commerce = state.operations.trial.commerce;
    expect(original).toEqual(before);
    expect(commerce.cashCents).toBe(500_000);
    expect(commerce.online!.stats).toMatchObject({ orders: 5, revenueCents: 0, netRevenueCents: 0 });
    expect(commerce.online!.recentSales).toEqual([]);
    expect(commerce.online!.merch).toMatchObject({ modules: [], inventory: [], stats: { unitsSold: 0, revenueCents: 0, moduleCostCents: 0 } });
    expect(getKqMerchModuleEligibility(commerce.online!, 'paper', commerce.cashCents).allowed).toBe(true);
    expect(getKqMerchModuleEligibility(commerce.online!, 'textile', commerce.cashCents).allowed).toBe(false);
    expect(getReleveCommerceProgress(state, 'merch').complete).toBe(false);
    expect(() => read(state)).toThrow('Mets ta série en vitrine');
  });

  it('charges collection and fabrication separately, retaining a draft offer outside the window', () => {
    const state = stocked(), commerce = state.operations.trial.commerce, merch = commerce.online!.merch!;
    expect(commerce.cashCents).toBe(500_000 - 12_000 - 800);
    expect(merch.stats).toMatchObject({ moduleCostCents: 12_000, stockCostCents: 800, unitsSold: 0 });
    expect(merch.inventory).toEqual([{ code: 'stickers', quantity: 10, priceCents: 400, active: false, sold: 0, progress: 0 }]);
    expect(canReadReleveMerchReport(state)).toBe(false);
  });

  it('requires time after publication and then a reading, preserving real stock and sales', () => {
    let state = stocked();
    state = command(state, 'advance-online-time', { hours: 24 });
    expect(state.milestones).not.toContain('merch-time');
    state = command(state, 'update-merch', { code: 'stickers', priceCents: 400, active: true });
    expect(state.milestones).toContain('merch-published');
    expect(() => read(state)).toThrow('Mets ta série en vitrine');
    state = command(state, 'advance-online-time', { hours: 24 });
    const merch = state.operations.trial.commerce.online!.merch!;
    expect(merch.inventory[0].quantity + merch.inventory[0].sold).toBe(10);
    expect(merch.stats.unitsSold).toBe(merch.inventory[0].sold);
    expect(merch.stats.revenueCents).toBe(merch.stats.unitsSold * 400);
    expect(canReadReleveMerchReport(state)).toBe(true);
    expect(getReleveCommerceProgress(state, 'merch').complete).toBe(false);
    state = read(state);
    expect(getReleveCommerceProgress(state, 'merch').complete).toBe(true);
    expect(state.operations.trial.commerce.online!.merch).toEqual(merch);
  });

  it('accepts observing no sale without manufacturing a result', () => {
    let state = stocked();
    state = command(state, 'update-merch', { code: 'stickers', priceCents: 100_000, active: true });
    state = command(state, 'advance-online-time', { hours: 24 });
    const merch = state.operations.trial.commerce.online!.merch!;
    expect(merch.stats.unitsSold).toBe(0);
    expect(merch.stats.revenueCents).toBe(0);
    expect(merch.inventory[0].quantity).toBe(10);
    expect(getReleveCommerceProgress(read(state), 'merch').complete).toBe(true);
  });

  it('deducts the already calculated fees once, alongside cumulative VAT, from the lesson wallet', () => {
    let state = stocked();
    state = command(state, 'update-merch', { code: 'stickers', priceCents: 400, active: true });
    const before = state.operations.trial.commerce.cashCents;
    state = command(state, 'advance-online-time', { hours: 24 });
    const commerce = state.operations.trial.commerce, merch = commerce.online!.merch!;
    expect(merch.stats).toMatchObject({ unitsSold: 2, revenueCents: 800, feesCents: 20, netRevenueCents: 647 });
    expect(commerce.business!.vat.reservedCents).toBe(133);
    expect(commerce.cashCents - before).toBe(800 - 133 - 20);
    expect(merch.recentSales.reduce((sum, sale) => sum + sale.netPayoutCents, 0)).toBe(647);
    expect(merch.recentSales.reduce((sum, sale) => sum + sale.feesCents, 0)).toBe(20);
    const posting = state.journal[0].postings;
    expect(posting).toContainEqual({ account: 'expense_other', deltaCents: 20 });
    expect(posting.reduce((sum, row) => sum + row.deltaCents, 0)).toBe(0);
  });

  it('keeps the adapter local and rejects a premature publication without mutating the exercise', async () => {
    const liveFetch = vi.fn(() => { throw new Error('Unexpected real API'); });
    vi.stubGlobal('fetch', liveFetch);
    let state = createReleveCommerceMerch();
    const before = structuredClone(state);
    const transport = createReleveCommerceTransport({ getState: () => state, setState: next => { state = next; } });
    const response = await transport('/api/arena/placard/commerce', { method: 'POST', body: JSON.stringify({ action: 'online', command: 'update-merch', payload: { code: 'stickers', priceCents: 400, active: true } }) });
    expect(response.ok).toBe(false);
    expect(state).toEqual(before);
    expect(liveFetch).not.toHaveBeenCalled();
  });

  it('points to the native Merch tabs, confirmation, stock controls and actual report', () => {
    const initial = createReleveCommerceMerch();
    expect(getReleveCommerceGuide('merch', initial)).toEqual(getReleveMerchGuide(initial));
    expect(getReleveMerchGuide(initial)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'merch-open', selector: '[data-shop-view="merch"][aria-selected="false"]' }),
      expect.objectContaining({ id: 'merch-module', selector: '[data-merch-buy-module="paper"]' }),
      expect.objectContaining({ id: 'merch-confirm', scope: 'dialog[open][aria-labelledby="treasury-management-title"]' }),
    ]));
    let state = stocked();
    state = command(state, 'update-merch', { code: 'stickers', priceCents: 400, active: true });
    state = command(state, 'advance-online-time', { hours: 24 });
    expect(getReleveMerchGuide(state)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'merch-report', selector: '[data-merch-activity] details:not([open]) > summary' }),
    ]));
  });
});
