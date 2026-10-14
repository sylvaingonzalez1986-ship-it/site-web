import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKqOperationsRequest, createKqOperationsLesson, getKqOperationsCommerce, getKqOperationsProgress, getKqOperationsStorage, type KqOperationsLessonState } from './kanab-quest-operations-lesson';
import { createKqOperationsSession, restoreKqOperationsLesson } from './kanab-quest-operations-session';
import { estimateKqOnlineOffer } from './kanab-quest-online';
import { KQ_BUDDIE_FLAVOR_PROFILES } from './kanab-quest-buddie-flavors';
import { getKqCustomerDemandFlavorMatch, KQ_CUSTOMER_DEMAND_PERIOD_MS } from './kanab-quest-customer-demand';

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
    expect(() => run(state, 'upgrade-site', { tier: 'pro' })).toThrow('Développe');
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
