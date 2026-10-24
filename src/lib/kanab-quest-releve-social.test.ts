import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyReleveCommerceRequest, createReleveCommerceBusiness, createReleveCommerceSocial, createReleveCommerceTransport, getReleveCommerceProgress, getReleveCommerceSnapshot, type KqReleveCommerceState } from './kanab-quest-releve-commerce';
import { getReleveSocialLearning } from './kanab-quest-releve-social';
import { getReleveCommerceGuide } from './arena-releve-commerce-guide';
import { getKqSocialAdventure } from './kanab-quest-social-adventure';
import { KQ_SOCIAL_SPONSORS, type KqSocialPlatform, type KqSocialSnapshot } from './kanab-quest-social';

const socialPath = '/api/arena/placard/social';
function snapshot(state: KqReleveCommerceState) {
  return applyReleveCommerceRequest(state, { path: socialPath, method: 'GET', body: {} }).payload as KqSocialSnapshot;
}
function narrative(state: KqReleveCommerceState, action: string, values: Record<string, unknown> = {}) {
  return applyReleveCommerceRequest(state, { path: '/api/releve/commerce', method: 'POST', body: { action, ...values } }).state;
}
function publication(state: KqReleveCommerceState, platform: KqSocialPlatform) {
  const social = snapshot(state), adventure = getKqSocialAdventure(social, platform);
  return applyReleveCommerceRequest(state, { path: socialPath, method: 'POST', body: {
    modelVersion: 2, requestKey: `91000000-0000-4000-8000-${String(social.revision + 1).padStart(12, '0')}`,
    expectedRevision: social.revision, action: 'choose', platform, scenarioId: adventure.scene.id,
    choiceId: adventure.scene.choices[0].id, narrativeVersion: 3, subjectId: adventure.subject?.id, contextKey: adventure.contextKey,
  } }).state;
}
afterEach(() => vi.unstubAllGlobals());

describe('the independent social practice desk', () => {
  it('lends the basic site without inventing followers or changing another dossier', () => {
    const business = createReleveCommerceBusiness(), before = structuredClone(business);
    const state = createReleveCommerceSocial(), social = snapshot(state);
    expect(state.operations.trial.commerce).toMatchObject({ cashCents: 500_000, computerOwned: true });
    expect(state.operations.trial.commerce.online?.site).toMatchObject({ active: true, tier: 'basic' });
    expect(social.platforms.instagram.followers).toBe(0);
    expect(social.platforms.x.followers).toBe(0);
    expect(social.culture?.source).toBe('loan');
    expect(business).toEqual(before);
    expect(getReleveCommerceProgress(state, 'social').complete).toBe(false);
  });

  it('requires two actual publications, their explicit result readings and real partnership conditions', () => {
    let state = createReleveCommerceSocial();
    expect(() => narrative(state, 'read-social-result', { entryId: 'made-up' })).toThrow('résultat enregistré');
    expect(() => narrative(state, 'read-social-partnerships', { sponsorId: KQ_SOCIAL_SPONSORS[0].id })).toThrow('deux réseaux');
    for (const platform of ['instagram', 'x'] as const) {
      state = publication(state, platform);
      const id = state.operations.social!.history[0].id;
      expect(getReleveSocialLearning(state).pendingResultId).toBe(id);
      expect(getReleveCommerceProgress(state, 'social').complete).toBe(false);
      const cash = state.operations.trial.commerce.cashCents;
      state = narrative(state, 'read-social-result', { entryId: id });
      state = narrative(state, 'read-social-result', { entryId: id });
      expect(state.operations.trial.commerce.cashCents).toBe(cash);
      expect(state.milestones.filter(item => item === `social-${platform}-read`)).toHaveLength(1);
    }
    expect(getReleveCommerceProgress(state, 'social').complete).toBe(false);
    expect(() => narrative(state, 'read-social-partnerships', { sponsorId: 'made-up' })).toThrow('marque proposée');
    const cash = state.operations.trial.commerce.cashCents;
    state = narrative(state, 'read-social-partnerships', { sponsorId: KQ_SOCIAL_SPONSORS[0].id });
    expect(getReleveCommerceProgress(state, 'social').complete).toBe(true);
    expect(snapshot(state).sponsors.active).toBeNull();
    expect(state.operations.trial.commerce.cashCents).toBe(cash);
  });

  it('restores the unread result from serialized history and advances only the practice clock', () => {
    let state = publication(createReleveCommerceSocial(), 'instagram');
    const restored = JSON.parse(JSON.stringify(state)) as KqReleveCommerceState;
    expect(getReleveSocialLearning(restored).pendingResultId).toBe(state.operations.social!.history[0].id);
    const before = state.operations.trial.clock, mental = snapshot(state).energy;
    state = narrative(state, 'advance-social-time');
    expect(state.operations.trial.clock).toBe(before + 300_000);
    expect(snapshot(state).energy).toBe(Math.min(100, mental + 1));
    expect(state.operations.trial.commerce.online?.settledUntil).toBe(new Date(before + 300_000).toISOString());
    expect(() => narrative(createReleveCommerceBusiness(), 'advance-social-time')).toThrow('dossier Réseaux');
    expect(() => applyReleveCommerceRequest(state, { path: '/api/arena/placard/commerce', method: 'POST', body: { action: 'online', command: 'start-marketing' } })).toThrow('rencontres dédiées');
  });

  it('does not count a recovery event or a legacy history entry as a publication read', () => {
    let state = publication(createReleveCommerceSocial(), 'instagram');
    const social = snapshot(state);
    state = applyReleveCommerceRequest(state, { path: socialPath, method: 'POST', body: { modelVersion: 2, requestKey: '92000000-0000-4000-8000-000000000001', expectedRevision: social.revision, action: 'recover' } }).state;
    expect(() => narrative(state, 'read-social-result', { entryId: state.operations.social!.history[0].id })).toThrow('résultat enregistré');
    const older = structuredClone(state);
    if (older.operations.social?.version === 2) older.operations.social.history[1].narrativeVersion = 2;
    expect(() => narrative(older, 'read-social-result', { entryId: older.operations.social!.history[1].id })).toThrow('résultat enregistré');
  });

  it('never sends social reads, writes or forbidden requests to the real server', async () => {
    let state = createReleveCommerceSocial();
    const network = vi.fn(() => { throw new Error('No real network in a lesson'); }); vi.stubGlobal('fetch', network);
    const request = createReleveCommerceTransport({ getState: () => state, setState: next => { state = next; } });
    expect((await request(socialPath)).status).toBe(200);
    expect((await request('/api/releve/commerce', { method: 'POST', body: JSON.stringify({ action: 'advance-social-time' }) })).status).toBe(200);
    expect((await request(`https://example.com${socialPath}`)).status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });

  it('points the business lesson at Promouvoir and requires an existing campaign report', () => {
    const state = createReleveCommerceBusiness();
    state.operations.trial.commerce.computerOwned = true;
    state.milestones.push('site-opened', 'published');
    expect(getReleveCommerceGuide('business', state).some(step => step.selector === '[data-shop-view="marketing"][aria-selected="false"]')).toBe(true);
    state.milestones.push('campaign', 'online-time');
    expect(() => narrative(state, 'read-report')).toThrow('bilan de ta campagne');
    expect(getReleveCommerceGuide('business', state).some(step => step.selector === '[data-marketing-history]:not([open]) > summary')).toBe(true);
  });

  it('validates the actual completed campaign report and rejects five-minute commerce backfill', () => {
    let state = createReleveCommerceBusiness();
    const commerce = (body: Record<string, unknown>) => { state = applyReleveCommerceRequest(state, { path: '/api/arena/placard/commerce', method: 'POST', body }).state; };
    const online = (command: string, payload: Record<string, unknown>) => commerce({ action: 'online', command, payload });
    state = narrative(state, 'borrow-computer');
    commerce({ action: 'create-shop', name: 'La boutique d’essai' });
    const raw = getReleveCommerceSnapshot(state).rawLots[0];
    commerce({ action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: raw.options.find(option => option.route === 'raw')!.market!.processingCostCents });
    online('buy-packaging', { code: 'kraft-5', quantity: 1 });
    online('create-listing', { stockId: state.operations.trial.commerce.stocks[0].id, formatGrams: 5, packagingCode: 'kraft-5', packets: 1, packetPriceCents: 1000 });
    online('start-marketing', { version: 2, code: 'introduction', angle: 'value', listingId: state.operations.trial.commerce.online!.listings[0].id, budgetCode: 'local' });
    expect(() => narrative(state, 'read-report')).toThrow();
    online('advance-online-time', { hours: 24 });
    const report = state.operations.trial.commerce.online!.marketing.history![0];
    expect(() => narrative(state, 'read-report', { reportId: 'unknown' })).toThrow('bilan de ta campagne');
    state = narrative(state, 'read-report', { reportId: report.id });
    expect(getReleveCommerceProgress(state, 'business').complete).toBe(true);
    state.milestones.push('social-dossier');
    expect(() => narrative(state, 'advance-social-time')).toThrow('ancien essai contient des ventes');
  });
});
