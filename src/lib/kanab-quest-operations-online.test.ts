import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKqOperationsRequest, createKqOperationsLesson, getKqOperationsCommerce, getKqOperationsProgress, getKqOperationsStorage, type KqOperationsLessonState } from './kanab-quest-operations-lesson';
import { createKqOperationsSession, restoreKqOperationsLesson } from './kanab-quest-operations-session';
import { estimateKqOnlineOffer, KQ_ONLINE_SITE_TIERS, getKqOnlineUpgradeCost, type KqOnlineSiteTier } from './kanab-quest-online';
import { KQ_GAME_MONTH_MS } from './kanab-quest-business';
import { KQ_BUDDIE_FLAVOR_PROFILES } from './kanab-quest-buddie-flavors';
import { getKqCustomerDemandFlavorMatch, KQ_CUSTOMER_DEMAND_PERIOD_MS } from './kanab-quest-customer-demand';
import { estimateKqMerchOffer, KQ_MERCH_PRODUCTS } from './kanab-quest-merch';
import { getKqStudioLevels, KQ_STUDIO_LEVELS, type KqStudioTrack } from './kanab-quest-studio';
import { getKqShopActivity } from './kanab-quest-shop-activity';
import type { KqOnlineSalesPage } from './kanab-quest-online-sales';

const action = (command: string, payload: Record<string, unknown>, requestKey?: string) => ({ path: '/api/arena/placard/commerce', method: 'POST', body: { action: 'online', command, payload, requestKey } });
const run = (state: KqOperationsLessonState, command: string, payload: Record<string, unknown>, requestKey?: string) => applyKqOperationsRequest(state, action(command, payload, requestKey)).state;
function prepare() {
  const state = createKqOperationsLesson('market');
  const raw = getKqOperationsCommerce(state).rawLots[0];
  return applyKqOperationsRequest(state, { path: '/api/arena/placard/commerce', method: 'POST', body: {
    action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: raw.options.find(row => row.route === 'raw')!.market!.processingCostCents,
  } }).state;
}
function listed(price = 1, packagingCode = 'kraft-5') {
  let state = prepare();
  state = run(state, 'buy-packaging', { code: packagingCode, quantity: 10 });
  return run(state, 'create-listing', { stockId: state.trial.commerce.stocks[0].id, formatGrams: 5, packagingCode, packets: 10, packetPriceCents: price });
}

describe('storage inventory after packaging in the operations lesson', () => {
  it('removes packed mass from bulk and reports it once with the original conversion ratio', () => {
    const state = listed();
    const snapshot = getKqOperationsStorage(state);
    const listing = state.trial.commerce.online!.listings[0];
    expect(listing.equivalentUnitsPerProductUnit).toBe(1);
    expect(snapshot.stockBreakdown).toMatchObject({ packedUnits: 500, packedActiveUnits: 500, packedPackets: 10 });
    expect(snapshot.stockBreakdown!.bulkUnits + snapshot.stockBreakdown!.packedUnits).toBe(Math.round(state.trial.game!.harvestGrams! * 10));
  });
});

function demandListing(matches: 0 | 1 | 2, price = 1) {
  let state = prepare();
  const request = getKqOperationsCommerce(state).customerDemand!.requests.find(row => row.channel === 'online')!;
  const stock = state.trial.commerce.stocks[0];
  stock.varietyCode = Object.keys(KQ_BUDDIE_FLAVOR_PROFILES).find(code => getKqCustomerDemandFlavorMatch(request, code).matchedFlavorCount === matches)!;
  expect(stock.varietyCode).toBeTruthy();
  stock.juryScore = 9.7; stock.storage!.conditionScore = 9.7;
  state = run(state, 'buy-packaging', { code: 'kraft-5', quantity: 10 });
  state = run(state, 'create-listing', { stockId: stock.id, formatGrams: 5, packagingCode: 'kraft-5', packets: 10, packetPriceCents: price });
  return { state, request };
}
afterEach(() => vi.unstubAllGlobals());

describe('isolated online shop exercise', () => {
  it('restarts only the next order when changing a price and preserves past sales', () => {
    let state = listed(3000);
    const listingId = state.trial.commerce.online!.listings[0].id;
    state.onlineOrderCredits = { [listingId]: 1 };
    state = run(state, 'advance-online-time', { hours: 1 });
    expect(state.trial.commerce.online!.stats.orders).toBeGreaterThan(0);
    const before = structuredClone(state.trial.commerce.online!);
    const cash = state.trial.commerce.cashCents;
    state.onlineOrderCredits![listingId] = .75;

    const changed = run(state, 'update-listing', { listingId, packetPriceCents: 3200 }, 'change-price');
    expect(changed.onlineOrderCredits?.[listingId] ?? 0).toBe(0);
    expect(changed.trial.commerce.online!.listings[0]).toEqual({ ...before.listings[0], packetPriceCents: 3200 });
    expect(changed.trial.commerce.online!.recentSales).toEqual(before.recentSales);
    expect(changed.trial.commerce.online!.stats).toEqual(before.stats);
    expect(changed.trial.commerce.cashCents).toBe(cash);
    expect(state.onlineOrderCredits![listingId]).toBe(.75);

    changed.onlineOrderCredits![listingId] = .25;
    const repeated = run(changed, 'update-listing', { listingId, packetPriceCents: 3200 }, 'change-price');
    expect(repeated).toBe(changed);
    expect(repeated.onlineOrderCredits![listingId]).toBe(.25);
    expect(() => run(changed, 'update-listing', { listingId, packetPriceCents: 0 })).toThrow();
    expect(changed.onlineOrderCredits![listingId]).toBe(.25);
  });

  it.each([
    ['pause-listing', 'active', 'paused'],
    ['close-listing', 'active', 'closed'],
    ['resume-listing', 'paused', 'active'],
    ['resume-listing', 'closed', 'active'],
  ] as const)('%s from %s resets only that listing’s progress and preserves its stock, price and sales', (command, status, expectedStatus) => {
    let state = listed(3000);
    const listingId = state.trial.commerce.online!.listings[0].id;
    state.onlineOrderCredits = { [listingId]: 1 };
    state = run(state, 'advance-online-time', { hours: 1 });
    expect(state.trial.commerce.online!.recentSales.length).toBeGreaterThan(0);
    state = run(state, 'buy-packaging', { code: 'kraft-5', quantity: 2 });
    state = run(state, 'create-listing', {
      stockId: state.trial.commerce.stocks[0].id, formatGrams: 5, packagingCode: 'kraft-5', packets: 2, packetPriceCents: 3217,
    });
    const online = state.trial.commerce.online!;
    const otherId = online.listings[1].id;
    online.listings[0].status = status;
    state.onlineOrderCredits = { [listingId]: .75, [otherId]: .4 };
    const before = structuredClone(state);

    const changed = run(state, command, { listingId }, 'change-status');
    expect(changed.onlineOrderCredits).toEqual({ [otherId]: .4 });
    expect(changed.trial.commerce.online).toEqual({
      ...before.trial.commerce.online!,
      listings: [{ ...online.listings[0], status: expectedStatus }, online.listings[1]],
    });
    expect(changed.trial.commerce.stocks).toEqual(before.trial.commerce.stocks);
    expect(changed.trial.commerce.cashCents).toBe(before.trial.commerce.cashCents);
    expect(changed.storage).toEqual(before.storage);
    expect(state).toEqual(before);

    changed.onlineOrderCredits![listingId] = .2;
    expect(run(changed, command, { listingId }, 'change-status')).toBe(changed);
    expect(changed.onlineOrderCredits).toEqual({ [listingId]: .2, [otherId]: .4 });
  });

  it.each(['quality', 'site-suspended', 'sold-out'] as const)('keeps progress and state intact when resuming is refused because of %s', reason => {
    const state = listed(3000);
    const online = state.trial.commerce.online!;
    const row = online.listings[0];
    row.status = 'closed';
    if (reason === 'quality') row.qualityScore = 5.7;
    if (reason === 'site-suspended') online.site.active = false;
    if (reason === 'sold-out') row.remainingPackets = 0;
    state.onlineOrderCredits = { [row.id]: .75 };
    const before = structuredClone(state);

    expect(() => run(state, 'resume-listing', { listingId: row.id })).toThrow(
      reason === 'site-suspended' ? 'Réactive ton site' : 'Ces paquets ne peuvent plus',
    );
    expect(state).toEqual(before);
  });

  it('invests once, occupies preparation, and awards only earned followers at the campaign end', () => {
    let initial = listed(3000);
    const listingId = initial.trial.commerce.online!.listings[0].id;
    const cash = initial.trial.commerce.cashCents;
    const payload = { version: 2, code: 'behind-scenes', angle: 'value', listingId, budgetCode: 'regional' };
    let prepared = run(initial, 'start-marketing', payload, 'paid-campaign');
    expect(prepared.trial.commerce.cashCents).toBe(cash - 8000);
    expect(run(prepared, 'start-marketing', payload, 'paid-campaign')).toBe(prepared);
    expect(() => run(prepared, 'start-marketing', payload, 'second-campaign')).toThrow('atelier');
    expect(prepared.trial.commerce.online!.marketing.active).toMatchObject({ version: 2, costCents: 8000, results: { orders: 0, followersEarned: 0 } });
    initial = run(initial, 'advance-online-time', { hours: 12 });
    prepared = run(prepared, 'advance-online-time', { hours: 12 });
    expect(prepared.trial.commerce.online!.stats.orders).toBe(initial.trial.commerce.online!.stats.orders);
    expect(prepared.trial.commerce.online!.followers).toBe(0);
    expect(prepared.trial.commerce.online!.marketing.active).toMatchObject({ results: { orders: 0, followersEarned: 0 } });
    prepared = run(prepared, 'advance-online-time', { hours: 24 });
    expect(prepared.trial.commerce.online!.followers).toBe(0);
    prepared = run(prepared, 'advance-online-time', { hours: 24 });
    const online = prepared.trial.commerce.online!, report = online.marketing.history![0];
    expect(online.marketing.active).toBeNull();
    expect(report.version).toBe(2);
    if (report.version !== 2) throw new Error('Prepared campaign report expected');
    expect(report.results.orders).toBeGreaterThan(0);
    expect(report.results.satisfiedOrders).toBeLessThanOrEqual(report.results.orders);
    expect(report.results.followersEarned).toBe(Math.min(30, report.results.satisfiedOrders * 10));
    expect(online.followers).toBe(report.results.followersEarned);
    expect(report.results.revenueCents).toBe(report.results.orders * 3000);
  });

  it('keeps the advertising investment lost when the target cannot find buyers', () => {
    let state = listed(1_000_000);
    const listingId = state.trial.commerce.online!.listings[0].id;
    const cash = state.trial.commerce.cashCents;
    state = run(state, 'start-marketing', { version: 2, code: 'behind-scenes', angle: 'premium', listingId, budgetCode: 'national' });
    for (const hours of [24, 24, 12]) state = run(state, 'advance-online-time', { hours });
    expect(state.trial.commerce.cashCents).toBe(cash - 18000);
    expect(state.trial.commerce.online!.followers).toBe(0);
    expect(state.trial.commerce.online!.marketing.history![0]).toMatchObject({ results: { orders: 0, satisfiedOrders: 0, followersEarned: 0 } });
  });

  it('rejects unfunded or inactive targets and lets an introduction precede a harvest campaign', () => {
    let state = listed(3000);
    const listingId = state.trial.commerce.online!.listings[0].id;
    const poor = structuredClone(state);
    poor.trial.commerce.cashCents = 0;
    expect(() => run(poor, 'start-marketing', { version: 2, code: 'harvest', angle: 'value', listingId, budgetCode: 'regional' })).toThrow();
    expect(poor.trial.commerce.online!.marketing.active).toBeNull();
    const paused = run(state, 'pause-listing', { listingId });
    expect(() => run(paused, 'start-marketing', { version: 2, code: 'introduction', angle: 'value', listingId, budgetCode: 'local' })).toThrow('active');
    state = run(state, 'start-marketing', { version: 2, code: 'introduction', angle: 'value', listingId, budgetCode: 'national' });
    expect(state.trial.commerce.online!.marketing.active).toMatchObject({ costCents: 0, budgetCode: 'local', visitorsPerDay: 35 });
    state = run(state, 'advance-online-time', { hours: 24 });
    state = run(state, 'start-marketing', { version: 2, code: 'harvest', angle: 'value', listingId, budgetCode: 'local' });
    expect(state.trial.commerce.online!.marketing.active?.code).toBe('harvest');
  });

  it.each([0, 1, 2] as const)('settles an online purchase with %s matching aromas, preserving the chosen price', matches => {
    const { state, request } = demandListing(matches, 5500);
    const online = state.trial.commerce.online!, row = online.listings[0];
    expect(row.varietyCode).toBe(state.trial.commerce.stocks[0].varietyCode);
    const forecast = estimateKqOnlineOffer({ ...row, quality: row.qualityScore, customerDemand: getKqOperationsCommerce(state).customerDemand,
      reputation: state.trial.commerce.reputation, clients: state.trial.commerce.clients, online });
    if (matches) expect(forecast.customerDemand).toMatchObject({ matchedFlavorCount: matches, bonusPercent: request.bonusPercent * matches / 2 });
    else expect(forecast.customerDemand).toBeUndefined();
    expect(state.customerDemandUsage).toEqual({});
    state.onlineOrderCredits = { [row.id]: 1 };
    const sold = run(state, 'advance-online-time', { hours: 1 }, 'first-order');
    expect(sold.trial.commerce.online!.stats.orders).toBe(1);
    expect(sold.trial.commerce.online!.recentSales[0].packetPriceCents).toBe(5500);
    expect(sold.customerDemandUsage?.[request.id] ?? 0).toBe(matches ? 50 : 0);
    expect(run(sold, 'advance-online-time', { hours: 1 }, 'first-order')).toBe(sold);
  });

  it('limits the shared online allowance to actual packets across multiple listings', () => {
    const prepared = demandListing(2), request = prepared.request;
    let state = prepared.state;
    const first = state.trial.commerce.online!.listings[0];
    state = run(state, 'buy-packaging', { code: 'kraft-5', quantity: 2 });
    state = run(state, 'create-listing', { stockId: state.trial.commerce.stocks[0].id, formatGrams: 5, packagingCode: 'kraft-5', packets: 2, packetPriceCents: 1 });
    const second = state.trial.commerce.online!.listings[1];
    state.customerDemandUsage = { [request.id]: request.capacityUnits - 50 };
    state.onlineOrderCredits = { [first.id]: 1, [second.id]: 1 };
    const sold = run(state, 'advance-online-time', { hours: 1 });
    expect(sold.trial.commerce.online!.stats.orders).toBe(2);
    expect(sold.customerDemandUsage![request.id]).toBe(request.capacityUnits);
    expect(getKqOperationsCommerce(sold).customerDemand!.requests.find(row => row.channel === 'online')!.remainingUnits).toBe(0);
    expect(getKqOperationsCommerce(sold).customerDemand!.requests.filter(row => row.channel !== 'online').every(row => row.remainingUnits === row.capacityUnits)).toBe(true);
  });

  it('recalculates the accepted reference between packets when the last bonus is spent', () => {
    const { state, request } = demandListing(2, 6000);
    const row = state.trial.commerce.online!.listings[0];
    state.customerDemandUsage = { [request.id]: request.capacityUnits - 50 };
    state.onlineOrderCredits = { [row.id]: 2 };
    const sold = run(state, 'advance-online-time', { hours: 1 });
    const [regularSale, demandSale] = sold.trial.commerce.online!.recentSales;
    expect(sold.trial.commerce.online!.stats.orders).toBe(2);
    expect(sold.customerDemandUsage![request.id]).toBe(request.capacityUnits);
    expect(demandSale.satisfaction).toBeGreaterThan(regularSale.satisfaction);
    expect(regularSale.packetPriceCents).toBe(demandSale.packetPriceCents);
  });

  it('does not spend the demand quota when price acceptance or maturity prevents a purchase', () => {
    const overpriced = demandListing(2, 1_000_000);
    overpriced.state.onlineOrderCredits = { [overpriced.state.trial.commerce.online!.listings[0].id]: 1 };
    const blocked = run(overpriced.state, 'advance-online-time', { hours: 1 });
    expect(blocked.trial.commerce.online!.stats.orders).toBe(0);
    expect(blocked.customerDemandUsage).toEqual({});
    const immature = demandListing(2);
    immature.state.onlineOrderCredits = { [immature.state.trial.commerce.online!.listings[0].id]: 1 };
    immature.state.trial.commerce.stocks[0].storage!.readyAt = new Date(immature.state.trial.clock + 2 * 3_600_000).toISOString();
    const waiting = run(immature.state, 'advance-online-time', { hours: 1 });
    expect(waiting.trial.commerce.online!.stats.orders).toBe(0);
    expect(waiting.customerDemandUsage).toEqual({});
  });

  it('restores full allowances on the next virtual period without reusing the old counters', () => {
    const { state, request } = demandListing(2);
    state.customerDemandUsage = { [request.id]: request.capacityUnits };
    state.trial.clock = (request.period + 1) * KQ_CUSTOMER_DEMAND_PERIOD_MS - 3_600_000;
    state.trial.commerce.online!.listings[0].status = 'paused';
    const next = run(state, 'advance-online-time', { hours: 1 });
    expect(next.trial.commerce.customerDemand!.period).toBe(request.period + 1);
    expect(next.trial.commerce.customerDemand!.requests.every(row => row.remainingUnits === row.capacityUnits)).toBe(true);
    expect(next.customerDemandUsage![request.id]).toBe(request.capacityUnits);
  });

  it('transfers packaged mass out of bulk storage and never returns used packaging on close', () => {
    const initial = prepare();
    const stock = initial.trial.commerce.stocks[0];
    const initialCapacity = getKqOperationsStorage(initial).capacity.usedUnits;
    const bought = run(initial, 'buy-packaging', { code: 'kraft-5', quantity: 3 }, 'pack-once');
    expect(bought.trial.commerce.cashCents).toBe(initial.trial.commerce.cashCents - 75);
    expect(run(bought, 'buy-packaging', { code: 'kraft-5', quantity: 3 }, 'pack-once')).toBe(bought);
    const prepared = run(bought, 'create-listing', { stockId: stock.id, formatGrams: 5, packagingCode: 'kraft-5', packets: 3, packetPriceCents: 1273 });
    expect(prepared.trial.commerce.stocks[0].remainingUnits).toBe(stock.remainingUnits - 150);
    expect(getKqOperationsStorage(prepared).capacity.usedUnits).toBe(initialCapacity - 150);
    expect(prepared.trial.commerce.online!.packaging.find(row => row.code === 'kraft-5')!.quantity).toBe(0);
    const listing = prepared.trial.commerce.online!.listings[0];
    expect(listing).toMatchObject({ remainingPackets: 3, packetPriceCents: 1273 });
    const closed = run(prepared, 'close-listing', { listingId: listing.id });
    expect(closed.trial.commerce.online!.listings[0]).toMatchObject({ status: 'closed', remainingPackets: 3 });
    expect(closed.trial.commerce.stocks).toEqual(prepared.trial.commerce.stocks);
    expect(closed.trial.commerce.online!.packaging).toEqual(prepared.trial.commerce.online!.packaging);
    expect(run(closed, 'resume-listing', { listingId: listing.id }).trial.commerce.online!.listings[0].status).toBe('active');
  });

  it('does not grant a sale when publishing, then settles purchases with virtual time and a mission', () => {
    let state = listed(1);
    expect(state.trial.commerce.online!.stats.orders).toBe(0);
    expect(getKqOperationsProgress(state).complete).toBe(false);
    state = run(state, 'start-marketing', { code: 'introduction', angle: 'value' });
    const clock = state.trial.clock, confidence = state.trial.commerce.online!.confidence;
    state = run(state, 'advance-online-time', { hours: 24 });
    expect(state.trial.clock).toBe(clock + 86_400_000);
    const online = state.trial.commerce.online!;
    expect(online.stats.orders).toBeGreaterThan(0);
    expect(online.listings[0].remainingPackets + online.stats.orders).toBe(10);
    expect(online.confidence).toBeGreaterThan(confidence);
    expect(online.marketing).toMatchObject({ active: null, completedCodes: ['introduction'] });
    expect(online.followers).toBe(15);
    expect(online.recentSales[0].satisfaction).toBeGreaterThanOrEqual(75);
    expect(getKqOperationsProgress(state).complete).toBe(true);
    expect(() => run(state, 'start-marketing', { code: 'introduction', angle: 'value' })).toThrow('déjà');
  });

  it.each(['active', 'paused', 'closed', 'quality-blocked'] as const)('discards %s packets without restoring stock, cash, packaging or a sale', status => {
    const initial = listed(1_000_000);
    const row = initial.trial.commerce.online!.listings[0];
    row.status = status;
    if (status === 'quality-blocked') row.qualityScore = 5.7;
    initial.onlineOrderCredits = { [row.id]: .75 };
    const discarded = run(initial, 'discard-listing', { listingId: row.id }, 'discard-once');
    expect(discarded.trial.commerce.online!.listings[0]).toMatchObject({
      id: row.id, status: 'discarded', initialPackets: 10, remainingPackets: 0, soldPackets: 0,
    });
    expect(discarded.trial.commerce.stocks).toEqual(initial.trial.commerce.stocks);
    expect(discarded.storage).toEqual(initial.storage);
    expect(discarded.trial.commerce.cashCents).toBe(initial.trial.commerce.cashCents);
    expect(discarded.trial.commerce.reputation).toBe(initial.trial.commerce.reputation);
    expect(discarded.trial.commerce.clients).toBe(initial.trial.commerce.clients);
    expect(discarded.trial.commerce.online!.packaging).toEqual(initial.trial.commerce.online!.packaging);
    expect(discarded.trial.commerce.online!.stats).toEqual(initial.trial.commerce.online!.stats);
    expect(discarded.trial.commerce.online!.recentSales).toEqual([]);
    expect(discarded.onlineOrderCredits).toEqual({});
    expect(getKqOperationsProgress(discarded).complete).toBe(false);
    expect(run(discarded, 'discard-listing', { listingId: row.id }, 'discard-once')).toBe(discarded);
    expect(() => run(discarded, 'resume-listing', { listingId: row.id })).toThrow('ne peuvent plus');
    expect(() => run(discarded, 'update-listing', { listingId: row.id, packetPriceCents: 1 })).toThrow('épuisée');
    const later = run(discarded, 'advance-online-time', { hours: 24 });
    expect(later.trial.commerce.online!.listings[0].status).toBe('discarded');
    expect(later.trial.commerce.online!.stats.orders).toBe(0);
  });

  it('preserves the history of earlier purchases when the remaining packets are discarded', () => {
    let state = listed(1);
    state = run(state, 'start-marketing', { code: 'introduction', angle: 'value' });
    state = run(state, 'advance-online-time', { hours: 24 });
    const before = structuredClone(state.trial.commerce.online!);
    expect(before.listings[0].soldPackets).toBeGreaterThan(0);
    state = run(state, 'discard-listing', { listingId: before.listings[0].id });
    expect(state.trial.commerce.online!.listings[0].soldPackets).toBe(before.listings[0].soldPackets);
    expect(state.trial.commerce.online!.stats).toEqual(before.stats);
    expect(state.trial.commerce.online!.recentSales).toEqual(before.recentSales);
  });

  it('does not invent customers or reputation losses at an absurd price without a purchase', () => {
    let state = listed(1_000_000);
    const before = { cash: state.trial.commerce.cashCents, clients: state.trial.commerce.clients, reputation: state.trial.commerce.reputation };
    state = run(state, 'start-marketing', { code: 'introduction', angle: 'premium' });
    state = run(state, 'advance-online-time', { hours: 24 });
    expect(state.trial.commerce.online!.stats.orders).toBe(0);
    expect({ cash: state.trial.commerce.cashCents, clients: state.trial.commerce.clients, reputation: state.trial.commerce.reputation }).toEqual(before);
    expect(state.trial.commerce.online!.confidence).toBe(60);
  });

  it('matches the marketing angle to the actual price instead of granting the same conversion', () => {
    const demand = ['value', 'premium'].map(angle => {
      let state = listed(1);
      state = run(state, 'start-marketing', { code: 'introduction', angle });
      state = run(state, 'advance-online-time', { hours: 24 });
      return state.trial.commerce.online!.stats.orders + Object.values(state.onlineOrderCredits!).reduce((sum, credit) => sum + credit, 0);
    });
    expect(demand[0]).toBeGreaterThan(demand[1]);
  });

  it('keeps the free site and paid hosting synchronized with the business controls', () => {
    let state = prepare();
    expect(state.trial.commerce.business!.shop).toMatchObject({ tier: 'basic', monthlyCents: 0, paidUntil: null });
    state.trial.commerce.online!.stats.orders = 5;
    state = run(state, 'upgrade-site', { tier: 'improved' });
    expect(state.trial.commerce.business!.shop).toMatchObject({ tier: 'improved', monthlyCents: 3000, active: true });
    const request = (body: Record<string, unknown>) => applyKqOperationsRequest(state, { path: '/api/arena/placard/commerce', method: 'POST', body }).state;
    state = request({ action: 'rename-shop', name: '  Chez   Sylvain  ' });
    expect(state.trial.commerce.business!.shop.name).toBe('Chez Sylvain');
    state = request({ action: 'shop-renewal', enabled: true });
    expect(state.trial.commerce.online!.site.renew).toBe(true);
    expect(state.trial.commerce.business!.shop.renew).toBe(true);
  });

  it('progresses through all six levels, consuming only each differential and the required upgrades', () => {
    let state = prepare();
    state.trial.commerce.cashCents = 2_100_000;
    const stocks = structuredClone(state.trial.commerce.stocks);
    for (const target of KQ_ONLINE_SITE_TIERS.slice(1)) {
      let online = state.trial.commerce.online!;
      online.stats.orders = target.minimumOrders;
      online.confidence = target.minimumConfidence;
      online.followers = target.minimumFollowers;
      for (const code of target.requiredUpgrades) if (!state.trial.commerce.online!.upgrades[code]) {
        state = run(state, 'buy-upgrade', { code });
      }
      online = state.trial.commerce.online!;
      const stats = structuredClone(online.stats);
      const cashBefore = state.trial.commerce.cashCents;
      const price = getKqOnlineUpgradeCost(online.site.tier, target.code);
      state = run(state, 'upgrade-site', { tier: target.code }, `level-${target.code}`);
      expect(state.trial.commerce.cashCents).toBe(cashBefore - price);
      expect(state.trial.commerce.online!.site).toMatchObject({ tier: target.code, active: true, renew: true,
        paidUntil: new Date(state.trial.clock + KQ_GAME_MONTH_MS).toISOString(), maxLevel: 6 });
      expect(state.trial.commerce.business!.shop).toMatchObject({ tier: target.code, monthlyCents: target.monthlyCents, active: true, renew: true });
      expect(state.trial.commerce.online!.stats).toEqual(stats);
      expect(state.trial.commerce.online!.confidence).toBe(target.minimumConfidence);
      expect(state.trial.commerce.online!.followers).toBe(target.minimumFollowers);
      expect(state.trial.commerce.stocks).toEqual(stocks);
      expect(run(state, 'upgrade-site', { tier: target.code }, `level-${target.code}`)).toBe(state);
    }
    expect(state.trial.commerce.cashCents).toBe(0);
    expect(state.trial.commerce.online!.upgrades).toEqual({ photography: true, branding: true });
    expect(state.trial.commerce.online!.site.tier).toBe('flagship');
  });

  it.each(['basic', 'pro', 'signature', 'flagship'] as const)('rejects a return, repurchase or skipped level toward %s atomically', target => {
    const state = prepare();
    const online = state.trial.commerce.online!;
    online.site.tier = 'pro'; online.stats.orders = 1000; online.confidence = 100; online.followers = 1000;
    online.upgrades = { photography: true, branding: true };
    state.trial.commerce.cashCents = 10_000_000;
    const before = structuredClone(state);
    expect(() => run(state, 'upgrade-site', { tier: target })).toThrow();
    expect(state).toEqual(before);
  });

  it.each([
    ['orders', 'studio'], ['confidence', 'studio'], ['followers', 'studio'],
    ['photography', 'studio'], ['branding', 'signature'], ['cash', 'studio'], ['availability', 'studio'],
  ] as const)('rejects the %s obstacle for %s before spending or changing the site', (obstacle, target) => {
    const state = prepare();
    const online = state.trial.commerce.online!;
    online.site.tier = target === 'signature' ? 'studio' : 'pro';
    online.stats.orders = 350; online.confidence = 88; online.followers = 300;
    online.upgrades = { photography: true, branding: true };
    state.trial.commerce.cashCents = 1_000_000;
    if (obstacle === 'orders') online.stats.orders = 79;
    if (obstacle === 'confidence') online.confidence = 69;
    if (obstacle === 'followers') online.followers = 49;
    if (obstacle === 'photography' || obstacle === 'branding') online.upgrades[obstacle] = false;
    if (obstacle === 'cash') state.trial.commerce.cashCents = 349999;
    if (obstacle === 'availability') delete online.site.maxLevel;
    const before = structuredClone(state);
    expect(() => run(state, 'upgrade-site', { tier: target })).toThrow();
    expect(state).toEqual(before);
  });

  it.each([null, -KQ_GAME_MONTH_MS, 2 * KQ_GAME_MONTH_MS])('keeps the more distant paid hosting date when the previous offset is %s', offset => {
    const state = prepare();
    const online = state.trial.commerce.online!;
    online.site.tier = 'pro'; online.site.active = false; online.site.renew = false;
    online.site.paidUntil = offset === null ? null : new Date(state.trial.clock + offset).toISOString();
    online.stats.orders = 80; online.confidence = 70; online.followers = 50; online.upgrades.photography = true;
    state.trial.commerce.cashCents = 350000;
    const next = run(state, 'upgrade-site', { tier: 'studio' });
    const expectedDate = new Date(state.trial.clock + Math.max(KQ_GAME_MONTH_MS, offset ?? 0)).toISOString();
    expect(next.trial.commerce.online!.site).toMatchObject({ tier: 'studio', active: true, renew: true, paidUntil: expectedDate });
    expect(next.trial.commerce.business!.shop).toMatchObject({ tier: 'studio', active: true, renew: true, paidUntil: expectedDate, monthlyCents: 11000 });
    expect(next.trial.commerce.cashCents).toBe(0);
  });

  it('renews a flagship shop at its own hosting tariff without inventing orders', () => {
    let state = prepare();
    const online = state.trial.commerce.online!;
    online.site = { ...online.site, tier: 'flagship', renew: true, paidUntil: new Date(state.trial.clock + 1_800_000).toISOString() };
    state.trial.commerce.cashCents = 28000;
    const previousPaidUntil = Date.parse(online.site.paidUntil!);
    state = run(state, 'advance-online-time', { hours: 1 });
    expect(state.trial.commerce.cashCents).toBe(0);
    expect(state.trial.commerce.online!.stats.orders).toBe(0);
    expect(state.trial.commerce.online!.site).toMatchObject({ tier: 'flagship', active: true,
      paidUntil: new Date(previousPaidUntil + KQ_GAME_MONTH_MS).toISOString() });
    expect(state.trial.commerce.business!.shop).toMatchObject({ tier: 'flagship', monthlyCents: 28000 });
  });

  it('rejects an unknown tier without resetting to a free basic shop', () => {
    const state = prepare(), before = structuredClone(state);
    expect(() => run(state, 'upgrade-site', { tier: 'other' as KqOnlineSiteTier })).toThrow('inconnue');
    expect(state).toEqual(before);
  });

  it('makes an expensive disappointing purchase lower confidence and lose clients', () => {
    let state = listed();
    state.trial.commerce.clients = 100;
    const online = state.trial.commerce.online!, row = online.listings[0];
    const reference = estimateKqOnlineOffer({ route: row.route, quality: row.qualityScore, baseUnitCents: row.baseUnitCents, formatGrams: 5,
      packagingCode: row.packagingCode, packetPriceCents: 1, reputation: state.trial.commerce.reputation, clients: 100, online }).referencePacketPriceCents;
    state = run(state, 'update-listing', { listingId: row.id, packetPriceCents: Math.round(reference * 1.6) });
    for (let days = 0; days < 3; days++) state = run(state, 'advance-online-time', { hours: 24 });
    expect(state.trial.commerce.online!.stats.orders).toBeGreaterThan(0);
    expect(state.trial.commerce.online!.confidence).toBeLessThan(60);
    expect(state.trial.commerce.clients).toBeLessThan(100);
    expect(state.trial.commerce.online!.recentSales.every(sale => sale.satisfaction < 60)).toBe(true);
  });

  it('ages paused and closed packets with their original packaging protection', () => {
    const evolved = ['kraft-5', 'glass-5'].map(code => {
      let state = listed(1_000_000, code);
      const row = state.trial.commerce.online!.listings[0], before = row.qualityScore;
      state = run(state, 'close-listing', { listingId: row.id });
      state = run(state, 'advance-online-time', { hours: 24 });
      expect(state.trial.commerce.online!.stats.orders).toBe(0);
      expect(state.trial.commerce.online!.listings[0].status).toBe('closed');
      return before - state.trial.commerce.online!.listings[0].qualityScore;
    });
    expect(evolved[0]).toBeCloseTo(.06);
    expect(evolved[1]).toBeCloseTo(.03);
  });

  it('rejects immature, insufficient, mispackaged and unbranded stock atomically', () => {
    let state = prepare();
    const before = structuredClone(state);
    const payload = { stockId: state.trial.commerce.stocks[0].id, formatGrams: 5, packagingCode: 'kraft-5', packets: 3, packetPriceCents: 1273 };
    expect(() => run(state, 'create-listing', payload)).toThrow('emballages');
    expect(state).toEqual(before);
    expect(() => run(state, 'buy-packaging', { code: 'printed-5', quantity: 1 })).toThrow('marque');
    state = run(state, 'buy-packaging', { code: 'kraft-5', quantity: 3 });
    expect(() => run(state, 'create-listing', { ...payload, packagingCode: 'kraft-10' })).toThrow('format');
    const immature = structuredClone(state);
    immature.trial.commerce.stocks[0].storage!.readyAt = new Date(immature.trial.clock + 86_400_000).toISOString();
    expect(() => run(immature, 'create-listing', payload)).toThrow('curing');
    const short = structuredClone(state); short.trial.commerce.stocks[0].remainingUnits = 100;
    expect(() => run(short, 'create-listing', payload)).toThrow('vrac');
    expect(() => run(state, 'upgrade-site', { tier: 'pro' })).toThrow('Passe d’abord');
    expect(() => run(state, 'advance-online-time', { hours: 25 })).toThrow('invalide');
  });

  it('replays local commands deterministically and never sends virtual time to the network', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    const session = createKqOperationsSession('market');
    const before = session.getSnapshot().trial.clock;
    const commands = [action('buy-packaging', { code: 'glass-10', quantity: 2 }, 'buy'), action('advance-online-time', { hours: 24 }, 'day')];
    for (const command of commands) {
      const response = await session.request(command.path, { method: command.method, body: JSON.stringify(command.body) });
      expect(response.ok).toBe(true);
    }
    expect(session.getSnapshot().trial.clock).toBe(before + 86_400_000);
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: commands }).state).toEqual(session.getSnapshot());
    expect(network).not.toHaveBeenCalled();
  });
});

function merchReady() {
  const state = prepare();
  const online = state.trial.commerce.online!;
  online.site.tier = 'studio'; online.site.paidUntil = new Date(state.trial.clock + KQ_GAME_MONTH_MS).toISOString();
  online.upgrades.branding = true; online.stats.orders = 80; online.confidence = 70;
  state.trial.commerce.cashCents = 1_000_000;
  state.trial.electricity = 0;
  return state;
}

function merchListed(quantity = 20, priceCents = 400) {
  let state = run(merchReady(), 'buy-merch-module', { code: 'paper' });
  state = run(state, 'buy-merch-stock', { code: 'stickers', quantity });
  return run(state, 'update-merch', { code: 'stickers', priceCents, active: true });
}

describe('isolated complete online sales journal', () => {
  it('keeps more than twenty actual sales in each circuit and paginates tied dates without changing the exercise', () => {
    let state = merchListed(45, 1);
    const online = state.trial.commerce.online!, stock = state.trial.commerce.stocks[0];
    online.stats.orders = 0;
    online.site.tier = 'flagship'; online.followers = 5000; online.confidence = 95;
    state.trial.commerce.reputation = 500; state.trial.commerce.clients = 100;
    const packets = Math.min(50, Math.floor(stock.remainingUnits / 50));
    expect(packets).toBeGreaterThan(20);
    state = run(state, 'buy-packaging', { code: 'kraft-5', quantity: packets });
    state = run(state, 'create-listing', { stockId: stock.id, formatGrams: 5, packagingCode: 'kraft-5', packets, packetPriceCents: 1 });
    for (let day = 0; day < 7; day++) state = run(state, 'advance-online-time', { hours: 24 });
    const sold = state.trial.commerce.online!;
    expect(sold.recentSales.length).toBeGreaterThan(20);
    expect(sold.merch!.recentSales.length).toBeGreaterThan(20);
    expect(sold.recentSales.reduce((sum, sale) => sum + sale.packets, 0)).toBe(sold.stats.orders);
    expect(sold.merch!.recentSales.reduce((sum, sale) => sum + sale.quantity, 0)).toBe(sold.merch!.stats.unitsSold);
    const expected = getKqShopActivity(getKqOperationsCommerce(state)).receipts;
    expect(new Set(expected.map(sale => sale.soldAt)).size).toBeLessThan(expected.length);
    const before = structuredClone(state), received: KqOnlineSalesPage['receipts'] = [];
    let cursor: string | null = null;
    do {
      const result = applyKqOperationsRequest(state, { method: 'GET', body: {}, path: '/api/arena/placard/commerce/sales?limit=7' + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '') });
      expect(result.state).toBe(state);
      const page = result.payload as KqOnlineSalesPage;
      expect(page.receipts.length).toBeLessThanOrEqual(7);
      received.push(...page.receipts); cursor = page.nextCursor;
      expect(received.length).toBeLessThanOrEqual(expected.length);
    } while (cursor);
    expect(received).toEqual(expected);
    expect(new Set(received.map(sale => sale.id)).size).toBe(received.length);
    expect(state).toEqual(before);
  });

  it('does not settle overdue storage overflow while reading or rejecting a journal query', () => {
    const state = createKqOperationsLesson('warehouse');
    state.trial.clock = Date.parse(state.storage.lot.capacity!.overflowDeadlineAt!) + 1000;
    expect(getKqOperationsStorage(state).lots[0].projection.capacity!.overflowDue).toBe(true);
    const before = structuredClone(state);
    const result = applyKqOperationsRequest(state, { path: '/api/arena/placard/commerce/sales', method: 'GET', body: {} });
    expect(result.state).toBe(state);
    expect(result.payload).toEqual({ receipts: [], nextCursor: null });
    for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'cursor=invalid', 'cursor=trial:%7B%7D']) {
      expect(() => applyKqOperationsRequest(state, { path: `/api/arena/placard/commerce/sales?${query}`, method: 'GET', body: {} })).toThrow();
    }
    expect(state).toEqual(before);
  });

  it('does not invent missing historical receipts and keeps tutorial reads off the live network', async () => {
    const state = merchListed();
    state.trial.commerce.online!.stats.orders = 900;
    const result = applyKqOperationsRequest(state, { path: '/api/arena/placard/commerce/sales', method: 'GET', body: {} });
    expect(result.payload).toEqual({ receipts: [], nextCursor: null });
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    const session = createKqOperationsSession('market', 'sales-journal');
    const before = session.getSnapshot();
    const response = await session.request('/api/arena/placard/commerce/sales?limit=50');
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ receipts: [], nextCursor: null });
    expect(session.getSnapshot()).toBe(before);
    expect(network).not.toHaveBeenCalled();
  });
});

describe('isolated merchandise simulation', () => {
  it('buys independent modules and prepays manufacturing without publishing or adding sales', () => {
    const initial = merchReady(), initialCash = initial.trial.commerce.cashCents;
    let state = run(initial, 'buy-merch-module', { code: 'objects' }, 'objects-once');
    expect(state.trial.commerce.online!.merch!.modules).toEqual(['objects']);
    expect(run(state, 'buy-merch-module', { code: 'objects' }, 'objects-once')).toBe(state);
    expect(() => run(state, 'buy-merch-module', { code: 'objects' })).toThrow('déjà');
    state = run(state, 'buy-merch-stock', { code: 'mug', quantity: 12 }, 'mugs-once');
    expect(run(state, 'buy-merch-stock', { code: 'mug', quantity: 12 }, 'mugs-once')).toBe(state);
    expect(state.trial.commerce.cashCents).toBe(initialCash - 95000 - 12 * 550);
    expect(state.trial.commerce.online!.merch).toMatchObject({
      inventory: [{ code: 'mug', quantity: 12, active: false, priceCents: 1600, sold: 0, progress: 0 }],
      stats: { unitsSold: 0, stockCostCents: 6600, moduleCostCents: 95000 }, recentSales: [],
    });
    expect(state.trial.commerce.stocks).toEqual(initial.trial.commerce.stocks);
    expect(state.trial.commerce.online!.stats).toEqual(initial.trial.commerce.online!.stats);
  });

  it.each([0, -1, 1.5, '2', NaN, Infinity, 501])('rejects invalid stock quantity %s without spending', quantity => {
    const state = run(merchReady(), 'buy-merch-module', { code: 'paper' }), before = structuredClone(state);
    expect(() => run(state, 'buy-merch-stock', { code: 'stickers', quantity })).toThrow();
    expect(state).toEqual(before);
  });

  it('rejects locked, absent, underfunded and suspended purchases atomically', () => {
    const initial = merchReady();
    expect(() => run(initial, 'buy-merch-stock', { code: 'stickers', quantity: 1 })).toThrow('collection');
    const old = structuredClone(initial); delete old.trial.commerce.online!.merch;
    expect(() => run(old, 'buy-merch-module', { code: 'paper' })).toThrow('disponible');
    expect(() => run(old, 'buy-merch-stock', { code: 'stickers', quantity: 1 })).toThrow('disponible');
    expect(() => run(old, 'update-merch', { code: 'stickers', priceCents: 400, active: true })).toThrow('disponible');
    const poor = run(initial, 'buy-merch-module', { code: 'paper' }); poor.trial.commerce.cashCents = 79;
    const before = structuredClone(poor);
    expect(() => run(poor, 'buy-merch-stock', { code: 'stickers', quantity: 1 })).toThrow('Budget');
    expect(poor).toEqual(before);
    poor.trial.commerce.online!.site.active = false;
    expect(() => run(poor, 'buy-merch-stock', { code: 'stickers', quantity: 1 })).toThrow('Réactive');
  });

  it('keeps restocks below 500 units and preserves the current price, publication and fractional progress', () => {
    let state = merchListed(20, 477);
    state.trial.commerce.online!.merch!.inventory[0].progress = .45;
    state = run(state, 'buy-merch-stock', { code: 'stickers', quantity: 480 });
    expect(state.trial.commerce.online!.merch!.inventory[0]).toMatchObject({ quantity: 500, active: true, priceCents: 477, progress: .45 });
    expect(() => run(state, 'buy-merch-stock', { code: 'stickers', quantity: 1 })).toThrow('500');
  });

  it('uses real shelf slots and releases one when an article is paused', () => {
    let state = merchReady();
    state.trial.commerce.online!.site.tier = 'improved';
    state.trial.commerce.online!.merch!.modules = ['paper', 'textile'];
    for (const code of ['stickers', 'poster', 'tote']) state = run(state, 'buy-merch-stock', { code, quantity: 5 });
    state = run(state, 'update-merch', { code: 'stickers', priceCents: 400, active: true });
    state = run(state, 'update-merch', { code: 'poster', priceCents: 1200, active: true });
    expect(() => run(state, 'update-merch', { code: 'tote', priceCents: 1800, active: true })).toThrow('emplacements');
    state = run(state, 'update-merch', { code: 'stickers', priceCents: 400, active: false });
    state = run(state, 'update-merch', { code: 'tote', priceCents: 1800, active: true });
    expect(state.trial.commerce.online!.merch!.inventory.filter(row => row.active).map(row => row.code)).toEqual(['poster', 'tote']);
  });

  it('preserves unchanged progress, resets price changes and pauses, and validates publication inputs', () => {
    let state = merchListed(); state.trial.commerce.online!.merch!.inventory[0].progress = .9;
    state = run(state, 'update-merch', { code: 'stickers', priceCents: 400, active: true });
    expect(state.trial.commerce.online!.merch!.inventory[0].progress).toBe(.9);
    for (const payload of [{ priceCents: 0, active: true }, { priceCents: 400.5, active: true }, { priceCents: 100001, active: true }, { priceCents: 400, active: 'true' }]) {
      expect(() => run(state, 'update-merch', { code: 'stickers', ...payload })).toThrow();
    }
    state = run(state, 'update-merch', { code: 'stickers', priceCents: 500, active: true });
    expect(state.trial.commerce.online!.merch!.inventory[0].progress).toBe(0);
    state.trial.commerce.online!.site.active = false; state.trial.commerce.online!.merch!.inventory[0].progress = .5;
    state = run(state, 'update-merch', { code: 'stickers', priceCents: 500, active: false });
    expect(state.trial.commerce.online!.merch!.inventory[0].progress).toBe(0);
    expect(() => run(state, 'update-merch', { code: 'stickers', priceCents: 500, active: true })).toThrow('Réactive');
  });

  it('sells autonomous merchandise without modifying flower sales, quality, reputation or followers', () => {
    const initial = merchListed(), initialOnline = initial.trial.commerce.online!;
    const quote = estimateKqMerchOffer({ online: initialOnline, code: 'stickers', priceCents: 400, reputation: initial.trial.commerce.reputation, clients: initial.trial.commerce.clients });
    const state = run(initial, 'advance-online-time', { hours: 24 }, 'merch-day');
    const commerce = state.trial.commerce, online = commerce.online!, merch = online.merch!;
    expect(merch.stats.unitsSold).toBe(Math.floor(quote.unitsPerDay));
    expect(merch.stats.unitsSold).toBeGreaterThan(0);
    expect(merch.inventory[0].quantity + merch.stats.unitsSold).toBe(20);
    expect(merch.stats.revenueCents).toBe(merch.stats.unitsSold * 400);
    expect(merch.stats.feesCents).toBe(merch.stats.unitsSold * 10);
    expect(merch.stats.stockCostCents).toBe(1600);
    expect(merch.stats.costOfGoodsSoldCents).toBe(merch.stats.unitsSold * 80);
    const vatCents = commerce.business!.vat.reservedCents - initial.trial.commerce.business!.vat.reservedCents;
    expect(merch.stats.netRevenueCents).toBe(merch.stats.revenueCents - merch.stats.feesCents - vatCents);
    expect(commerce.cashCents).toBe(initial.trial.commerce.cashCents + merch.stats.netRevenueCents);
    expect(online.stats).toEqual(initialOnline.stats); expect(online.recentSales).toEqual([]);
    expect(online.confidence).toBe(initialOnline.confidence); expect(online.followers).toBe(initialOnline.followers);
    expect(commerce.reputation).toBe(initial.trial.commerce.reputation); expect(commerce.clients).toBe(initial.trial.commerce.clients);
    expect(commerce.stocks.map(stock => [stock.remainingUnits, stock.juryScore, stock.repExact])).toEqual(initial.trial.commerce.stocks.map(stock => [stock.remainingUnits, stock.juryScore, stock.repExact]));
    expect(state.customerDemandUsage).toEqual(initial.customerDemandUsage);
    expect(run(state, 'advance-online-time', { hours: 24 }, 'merch-day')).toBe(state);
  });

  it('uses existing VAT and debt collection without charging manufacturing twice', () => {
    let state = merchListed();
    const commerce = state.trial.commerce;
    commerce.business!.vat.salesTtcCents = 10_000_000;
    state.trial.electricity = 300;
    const before = commerce.cashCents;
    state = run(state, 'advance-online-time', { hours: 24 });
    const result = state.trial.commerce, merch = result.online!.merch!;
    expect(merch.stats.unitsSold).toBeGreaterThan(0);
    expect(result.business!.vat.reservedCents).toBeGreaterThan(0);
    expect(state.trial.electricity).toBeLessThan(300);
    expect(result.cashCents - before).toBe(merch.stats.netRevenueCents);
    expect(merch.stats.netRevenueCents).toBe(merch.stats.revenueCents - merch.stats.feesCents - result.business!.vat.reservedCents - (300 - state.trial.electricity));
    expect(merch.stats.stockCostCents).toBe(1600);
  });

  it('never oversells, unpublishes an exhausted article and does not transfer old credit to fresh stock', () => {
    let state = merchListed(1, 1);
    state.trial.commerce.online!.followers = 5000;
    state = run(state, 'advance-online-time', { hours: 24 });
    expect(state.trial.commerce.online!.merch!.inventory[0]).toMatchObject({ quantity: 0, sold: 1, active: false, progress: 0 });
    expect(() => run(state, 'update-merch', { code: 'stickers', priceCents: 400, active: true })).toThrow('épuisé');
    const before = state.trial.commerce.online!.merch!.stats.unitsSold;
    state = run(state, 'buy-merch-stock', { code: 'stickers', quantity: 10 });
    expect(state.trial.commerce.online!.merch!.inventory[0]).toMatchObject({ active: false, priceCents: 1, progress: 0 });
    state = run(state, 'advance-online-time', { hours: 24 });
    expect(state.trial.commerce.online!.merch!.stats.unitsSold).toBe(before);
  });

  it('cumulates fees across flower and merchandise sales without a negative 1-cent receipt', () => {
    let state = merchListed(2, 1);
    const online = state.trial.commerce.online!;
    online.stats.revenueCents = 19; online.stats.feesCents = 0;
    online.merch!.inventory[0].progress = .999999;
    state.trial.commerce.business!.vat.salesTtcCents = 2;
    const cash = state.trial.commerce.cashCents;
    state = run(state, 'advance-online-time', { hours: 1 });
    expect(state.trial.commerce.online!.merch!.recentSales[0]).toMatchObject({ priceCents: 1, netPayoutCents: 0, feesCents: 0 });
    expect(state.trial.commerce.cashCents).toBe(cash);
    state.trial.commerce.online!.merch!.inventory[0].progress = .999999;
    state = run(state, 'advance-online-time', { hours: 1 });
    expect(state.trial.commerce.online!.merch!.recentSales[0]).toMatchObject({ priceCents: 1, netPayoutCents: 0, feesCents: 1 });
    expect(state.trial.commerce.online!.merch!.stats.feesCents).toBe(1);
    expect(state.trial.commerce.cashCents).toBe(cash);
  });

  it('does not accrue demand while inactive, paused or unreasonably priced', () => {
    for (const reason of ['inactive', 'paused', 'price']) {
      const initial = merchListed(20, reason === 'price' ? 1000 : 400);
      if (reason === 'inactive') initial.trial.commerce.online!.site.active = false;
      if (reason === 'paused') initial.trial.commerce.online!.merch!.inventory[0].active = false;
      const later = run(initial, 'advance-online-time', { hours: 24 });
      expect(later.trial.commerce.online!.merch!.inventory[0].progress).toBe(0);
      expect(later.trial.commerce.online!.merch!.stats.unitsSold).toBe(0);
    }
  });

  it('lets a merch receipt before the deadline pay the next hosting period', () => {
    let state = merchListed();
    const online = state.trial.commerce.online!;
    const paidUntil = state.trial.clock + 30 * 60000;
    online.site.paidUntil = new Date(paidUntil).toISOString(); online.site.renew = true;
    state.trial.commerce.cashCents = 10900;
    const rate = estimateKqMerchOffer({ online, code: 'stickers', priceCents: 400, reputation: state.trial.commerce.reputation, clients: state.trial.commerce.clients }).unitsPerDay;
    online.merch!.inventory[0].progress = 1 - rate * (20 / 60) / 24;
    state = run(state, 'advance-online-time', { hours: 1 });
    expect(state.trial.commerce.online!.site.active).toBe(true);
    expect(Date.parse(state.trial.commerce.online!.site.paidUntil!)).toBe(paidUntil + KQ_GAME_MONTH_MS);
    expect(Date.parse(state.trial.commerce.online!.merch!.recentSales[0].soldAt)).toBeLessThan(paidUntil);
    expect(state.trial.commerce.cashCents).toBeLessThan(1000);
  });

  it('suspends hosting before a sale that lands exactly on its unpaid deadline', () => {
    let state = merchListed();
    const online = state.trial.commerce.online!;
    online.site.paidUntil = new Date(state.trial.clock + 30 * 60000).toISOString(); online.site.renew = false;
    const rate = estimateKqMerchOffer({ online, code: 'stickers', priceCents: 400, reputation: state.trial.commerce.reputation, clients: state.trial.commerce.clients }).unitsPerDay;
    online.merch!.inventory[0].progress = 1 - rate * .5 / 24;
    state = run(state, 'advance-online-time', { hours: 1 });
    expect(state.trial.commerce.online!.site.active).toBe(false);
    expect(state.trial.commerce.online!.merch!.stats.unitsSold).toBe(0);
    expect(state.trial.commerce.online!.merch!.inventory[0].quantity).toBe(20);
  });

  it('never settles a new article backwards or consumes a future settlement interval twice', () => {
    let state = run(merchReady(), 'advance-online-time', { hours: 24 });
    state = run(state, 'buy-merch-module', { code: 'paper' });
    state = run(state, 'buy-merch-stock', { code: 'stickers', quantity: 20 });
    state = run(state, 'update-merch', { code: 'stickers', priceCents: 400, active: true });
    expect(state.trial.commerce.online!.merch!.stats.unitsSold).toBe(0);
    const purchasedAt = state.trial.clock;
    state.trial.commerce.online!.settledUntil = new Date(purchasedAt + 2 * 3600000).toISOString();
    state = run(state, 'advance-online-time', { hours: 2 });
    expect(state.trial.commerce.online!.merch!.inventory[0].progress).toBe(0);
    expect(Date.parse(state.trial.commerce.online!.settledUntil)).toBe(purchasedAt + 2 * 3600000);
    state = run(state, 'advance-online-time', { hours: 24 });
    expect(state.trial.commerce.online!.merch!.recentSales.every(sale => Date.parse(sale.soldAt) > purchasedAt + 2 * 3600000)).toBe(true);
  });

  it('shares the current audience across active references instead of multiplying it', () => {
    let state = merchListed();
    state = run(state, 'buy-merch-stock', { code: 'poster', quantity: 20 });
    state = run(state, 'update-merch', { code: 'poster', priceCents: 1200, active: true });
    const initial = structuredClone(state);
    state = run(state, 'advance-online-time', { hours: 24 });
    const rows = state.trial.commerce.online!.merch!.inventory;
    for (const row of rows) {
      const expected = estimateKqMerchOffer({ online: initial.trial.commerce.online!, code: row.code, priceCents: row.priceCents,
        reputation: initial.trial.commerce.reputation, clients: initial.trial.commerce.clients, activeProductCount: 2 }).unitsPerDay;
      expect(row.sold + row.progress).toBeCloseTo(expected, 8);
    }
    expect(KQ_MERCH_PRODUCTS.length).toBe(6);
  });
});

function studioReady() {
  const state = merchReady(), online = state.trial.commerce.online!;
  state.trial.commerce.cashCents = 2_000_000;
  online.upgrades = { photography: false, branding: false };
  online.site.tier = 'flagship'; online.stats.orders = 350; online.confidence = 90;
  return state;
}

describe('isolated creative studio purchases', () => {
  it('buys all nine steps at their incremental costs and preserves sales, stock and audience', () => {
    const initial = studioReady(); let state = initial, total = 0;
    const sequence: Array<[KqStudioTrack, number]> = [['photography', 1], ['branding', 1], ['editorial', 1],
      ['photography', 2], ['branding', 2], ['editorial', 2], ['photography', 3], ['branding', 3], ['editorial', 3]];
    for (const [track, level] of sequence) {
      const cost = KQ_STUDIO_LEVELS.find(item => item.track === track && item.level === level)!.costCents;
      state = run(state, 'buy-studio-level', { track, level, costCents: 1 }, `${track}-${level}`);
      total += cost;
      expect(state.trial.commerce.cashCents).toBe(initial.trial.commerce.cashCents - total);
      expect(getKqStudioLevels(state.trial.commerce.online!)[track]).toBe(level);
      expect(run(state, 'buy-studio-level', { track, level, costCents: 1 }, `${track}-${level}`)).toBe(state);
      expect(() => run(state, 'buy-studio-level', { track, level })).toThrow('déjà');
    }
    const online = state.trial.commerce.online!;
    expect(online.studio!.levels).toEqual({ photography: 3, branding: 3, editorial: 3 });
    expect(online.upgrades).toEqual({ photography: true, branding: true });
    expect(online.stats).toEqual(initial.trial.commerce.online!.stats);
    expect(online.followers).toBe(initial.trial.commerce.online!.followers);
    expect(online.confidence).toBe(initial.trial.commerce.online!.confidence);
    expect(online.merch).toEqual(initial.trial.commerce.online!.merch);
    expect(state.trial.commerce.stocks).toEqual(initial.trial.commerce.stocks);
    expect(state.trial.clock).toBe(initial.trial.clock);
  });

  it('retains old purchases and advances their tracks from level one without paying again', () => {
    let state = studioReady();
    state = run(state, 'buy-upgrade', { code: 'photography' });
    state = run(state, 'buy-upgrade', { code: 'branding' });
    expect(state.trial.commerce.online!.studio!.levels).toEqual({ photography: 1, branding: 1, editorial: 0 });
    const cash = state.trial.commerce.cashCents;
    state = run(state, 'buy-studio-level', { track: 'photography', level: 2 });
    expect(state.trial.commerce.cashCents).toBe(cash - 55000);
    expect(() => run(state, 'buy-upgrade', { code: 'photography' })).toThrow('déjà');
    expect(state.trial.commerce.online!.studio!.levels.photography).toBe(2);
  });

  it.each(['legacy', 'computer', 'created', 'inactive', 'site-level', 'orders', 'confidence', 'cash', 'sequence', 'unknown'])('rejects an invalid %s purchase atomically', reason => {
    const state = studioReady(), online = state.trial.commerce.online!;
    online.studio!.levels.photography = 1;
    let track = 'photography', level = 2;
    if (reason === 'legacy') delete online.studio;
    if (reason === 'computer') state.trial.commerce.computerOwned = false;
    if (reason === 'created') online.site.createdAt = null;
    if (reason === 'inactive') online.site.active = false;
    if (reason === 'site-level') online.site.tier = 'basic';
    if (reason === 'orders') online.stats.orders = 14;
    if (reason === 'confidence') online.confidence = 54;
    if (reason === 'cash') state.trial.commerce.cashCents = 54999;
    if (reason === 'sequence') level = 3;
    if (reason === 'unknown') track = 'unknown';
    const before = structuredClone(state);
    expect(() => run(state, 'buy-studio-level', { track, level })).toThrow();
    expect(state).toEqual(before);
  });

  it('blocks new commands on old snapshots while retaining the original first purchases', () => {
    let state = studioReady(); delete state.trial.commerce.online!.studio;
    expect(() => run(state, 'buy-studio-level', { track: 'photography', level: 1 })).toThrow('disponible');
    state = run(state, 'buy-upgrade', { code: 'photography' });
    state = run(state, 'buy-upgrade', { code: 'branding' });
    expect(getKqStudioLevels(state.trial.commerce.online!)).toEqual({ photography: 1, branding: 1, editorial: 0 });
    expect(() => run(state, 'choose-studio-style', { style: 'clear' })).toThrow('disponible');
    expect(state.trial.commerce.online!.studio).toBeUndefined();
  });

  it('allows a free style choice after identity or editorial work even with suspended hosting', () => {
    for (const track of ['branding', 'editorial'] as const) {
      let state = studioReady(); state.trial.commerce.online!.studio!.levels[track] = 1;
      state.trial.commerce.online!.site.active = false;
      state.trial.commerce.cashCents = 0;
      const initial = structuredClone(state);
      state = run(state, 'choose-studio-style', { style: 'signature' }, 'style-once');
      expect(state.trial.commerce.online!.studio!.style).toBe('signature');
      expect(state.trial.commerce.cashCents).toBe(0);
      expect(state.trial.clock).toBe(initial.trial.clock);
      expect(state.trial.commerce.online!.stats).toEqual(initial.trial.commerce.online!.stats);
      expect(state.trial.commerce.online!.merch).toEqual(initial.trial.commerce.online!.merch);
      expect(run(state, 'choose-studio-style', { style: 'signature' }, 'style-once')).toBe(state);
    }
  });

  it.each(['locked', 'computer', 'created', 'unknown'])('rejects %s style changes without touching the state', reason => {
    const state = studioReady(); state.trial.commerce.online!.studio!.levels.branding = reason === 'locked' ? 0 : 1;
    if (reason === 'computer') state.trial.commerce.computerOwned = false;
    if (reason === 'created') state.trial.commerce.online!.site.createdAt = null;
    const before = structuredClone(state);
    expect(() => run(state, 'choose-studio-style', { style: reason === 'unknown' ? 'unknown' : 'clear' })).toThrow();
    expect(state).toEqual(before);
  });

  it('applies identity and editorial conversion to actual merch sales after the style change', () => {
    const initial = merchListed(100);
    const online = initial.trial.commerce.online!;
    online.studio!.levels = { photography: 0, branding: 3, editorial: 3 };
    let state = run(initial, 'choose-studio-style', { style: 'clear' });
    const expected = estimateKqMerchOffer({ online: state.trial.commerce.online!, code: 'stickers', priceCents: 400,
      reputation: state.trial.commerce.reputation, clients: state.trial.commerce.clients }).unitsPerDay;
    state = run(state, 'advance-online-time', { hours: 24 });
    const row = state.trial.commerce.online!.merch!.inventory[0];
    expect(row.sold + row.progress).toBeCloseTo(expected, 8);
    expect(row.sold).toBe(Math.floor(expected));
  });
});
