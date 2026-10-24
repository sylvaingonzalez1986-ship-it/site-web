import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKqOperationsRequest, createKqOperationsLesson, getKqOperationsCommerce, type KqOperationsLessonAction, type KqOperationsLessonState } from './kanab-quest-operations-lesson';
import { createKqOperationsSession, restoreKqOperationsLesson } from './kanab-quest-operations-session';
import { getKqOperationsSocial } from './kanab-quest-operations-social';
import { getKqSocialAdventure } from './kanab-quest-social-adventure';
import { getKqOnlineAudience } from './kanab-quest-online';
import { getKqSocialScenario, getKqSponsorOffers, isKqSocialSnapshot, normalizeKqSocialSnapshot, type KqSocialPlatform, type KqSocialSnapshot } from './kanab-quest-social';
import { KQ_SOCIAL_LEGACY_SCENARIOS, KQ_SOCIAL_V2_SCENARIOS } from './kanab-quest-social-stories';
import { applyReleveCommerceRequest, createReleveCommerceBusiness, createReleveCommerceTransport } from './kanab-quest-releve-commerce';

const SOCIAL = '/api/arena/placard/social';
const uuid = (number: number) => `10000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`;
const post = (body: Record<string, unknown>): KqOperationsLessonAction => ({ path: SOCIAL, method: 'POST', socialCatalogVersion: 2, socialNarrativeVersion: 3, body: { modelVersion: 2, ...body } });
const online = (command: string, payload: Record<string, unknown>): KqOperationsLessonAction => ({ path: '/api/arena/placard/commerce', method: 'POST', body: { action: 'online', command, payload } });
function choose(state: KqOperationsLessonState, platform: KqSocialPlatform = 'instagram', requestKey = uuid(1)) {
  const snapshot = getKqOperationsSocial(state);
  const adventure = getKqSocialAdventure(snapshot, platform), story = adventure.scene;
  return post({ action: 'choose', expectedRevision: snapshot.revision, platform, scenarioId: story.id, choiceId: story.choices[0].id, requestKey,
    narrativeVersion: 3, subjectId: adventure.subject!.id, contextKey: adventure.contextKey });
}
const advance = (state: KqOperationsLessonState, hours: number) => applyKqOperationsRequest(state, online('advance-online-time', { hours })).state;
function sponsorReady(state = createKqOperationsLesson('market')) {
  state.trial.commerce.online!.followers = 10_000;
  state.social = getKqOperationsSocial(state);
  for (const platform of ['instagram', 'x'] as const) Object.assign(state.social.platforms[platform], { followers: 5000, trust: 90, haters: 0, moderation: 0 });
  state.social.socialFollowers = 10_000;
  return state;
}
function sponsorCommand(state: KqOperationsLessonState, action: string, request: number, values: Record<string, unknown> = {}) {
  return post({ action, expectedRevision: getKqOperationsSocial(state).revision, requestKey: uuid(request), ...values });
}
function completedPartnership() {
  let state = sponsorReady();
  const sponsor = getKqSponsorOffers(getKqOperationsSocial(state)).find(offer => offer.eligible)!.sponsor;
  const cash = state.trial.commerce.cashCents;
  state = applyKqOperationsRequest(state, sponsorCommand(state, 'sponsor-accept', 100, { sponsorId: sponsor.id })).state;
  state = applyKqOperationsRequest(state, sponsorCommand(state, 'sponsor-post', 101, { tag: sponsor.requiredTags[0] })).state;
  state = advance(state, 1);
  state = applyKqOperationsRequest(state, sponsorCommand(state, 'sponsor-post', 102, { tag: sponsor.requiredTags[1] })).state;
  return { state, sponsor, cash };
}
afterEach(() => vi.unstubAllGlobals());

describe('local social adventure and commerce', () => {
  it('keeps anonymous exercise identity neutral without settling elapsed game time', () => {
    const exercise = createKqOperationsLesson('market');
    exercise.trial.clock += 30 * 24 * 60 * 60 * 1000;
    const before = structuredClone(exercise);
    const read = applyKqOperationsRequest(exercise, { path: `${SOCIAL}/player`, method: 'GET', body: {} });
    expect(read).toEqual({ state: before, payload: { firstName: null, profile: null } });
    expect(read.state).toBe(exercise);
    const visit = createReleveCommerceBusiness();
    visit.operations.trial.clock += 30 * 24 * 60 * 60 * 1000;
    const visitBefore = structuredClone(visit);
    const visitRead = applyReleveCommerceRequest(visit, { path: `${SOCIAL}/player`, method: 'GET', body: {} });
    expect(visitRead).toEqual({ state: visitBefore, payload: { firstName: null, profile: null } });
    expect(visitRead.state).toBe(visit);
  });

  it('opens old saves without changing their state, followers or wallet', () => {
    const state = createKqOperationsLesson('market');
    state.trial.commerce.online!.followers = 73;
    const before = structuredClone(state);
    const read = applyKqOperationsRequest(state, { path: SOCIAL, method: 'GET', body: {} });
    expect(read.state).toBe(state);
    expect(read.payload).toMatchObject({ revision: 0, energy: 100, audienceFollowers: 73, socialFollowers: 0, history: [] });
    expect(state).toEqual(before);
    expect(state.social).toBeUndefined();
  });

  it('keeps marketing followers when social choices add their own audience', () => {
    let state = createKqOperationsLesson('market');
    state = applyKqOperationsRequest(state, online('start-marketing', { code: 'introduction', angle: 'craft' })).state;
    state = applyKqOperationsRequest(state, choose(state)).state;
    const instagramFollowers = getKqOperationsSocial(state).socialFollowers;
    expect(instagramFollowers).toBeGreaterThan(0);
    state = advance(state, 24);
    expect(state.trial.commerce.online!.followers).toBe(instagramFollowers + 15);
    expect(getKqOperationsSocial(state)).toMatchObject({ audienceFollowers: instagramFollowers + 15, socialFollowers: instagramFollowers });
    state = applyKqOperationsRequest(state, choose(state, 'x', uuid(2))).state;
    expect(state.trial.commerce.online!.followers).toBe(getKqOperationsSocial(state).socialFollowers + 15);
  });

  it('caps marketing rewards before they can turn a positive social choice into negative followers', () => {
    let state = createKqOperationsLesson('market');
    state.trial.commerce.online!.followers = 99_999;
    state = applyKqOperationsRequest(state, online('start-marketing', { code: 'introduction', angle: 'craft' })).state;
    state = advance(state, 24);
    expect(state.trial.commerce.online!.followers).toBe(100_000);
    expect(isKqSocialSnapshot(getKqOperationsSocial(state))).toBe(true);
    state = applyKqOperationsRequest(state, choose(state)).state;
    expect(state.social).toMatchObject({ audienceFollowers: 100_000, socialFollowers: 0,
      platforms: { instagram: { followers: 0 } }, history: [{ followersDelta: 0 }],
    });
    expect(isKqSocialSnapshot(state.social)).toBe(true);
  });

  it('applies higher demand only to future shop visits and never rewrites settled sales', () => {
    let state = createKqOperationsLesson('market');
    const raw = getKqOperationsCommerce(state).rawLots[0];
    state = applyKqOperationsRequest(state, { path: '/api/arena/placard/commerce', method: 'POST', body: {
      action: 'prepare', flowerId: raw.flowerId, route: 'raw', expectedCostCents: raw.options.find(row => row.route === 'raw')!.market!.processingCostCents,
    } }).state;
    state = applyKqOperationsRequest(state, online('buy-packaging', { code: 'kraft-5', quantity: 10 })).state;
    state = applyKqOperationsRequest(state, online('create-listing', { stockId: state.trial.commerce.stocks[0].id, formatGrams: 5,
      packagingCode: 'kraft-5', packets: 10, packetPriceCents: 1 })).state;
    state = advance(state, 1);
    const before = structuredClone(state.trial.commerce.online!);
    const posted = applyKqOperationsRequest(state, choose(state)).state;
    expect(posted.trial.clock).toBe(state.trial.clock);
    expect(posted.trial.commerce.cashCents).toBe(state.trial.commerce.cashCents);
    expect(posted.trial.commerce.online!.stats).toEqual(before.stats);
    expect(posted.trial.commerce.online!.recentSales).toEqual(before.recentSales);
    expect(posted.trial.commerce.online!.settledUntil).toBe(before.settledUntil);
    const audience = (target: KqOperationsLessonState) => getKqOnlineAudience({ online: target.trial.commerce.online!, reputation: target.trial.commerce.reputation, clients: target.trial.commerce.clients });
    expect(audience(posted) - audience(state)).toBeCloseTo(getKqOperationsSocial(posted).additionalVisitsPerDay);
    expect(advance(posted, 1).trial.commerce.online!.stats.visitors).toBeGreaterThan(advance(state, 1).trial.commerce.online!.stats.visitors);
  });

  it('records one effect per request and rejects stale, early and malformed choices atomically', () => {
    const initial = createKqOperationsLesson('market');
    const action = choose(initial);
    const result = applyKqOperationsRequest(initial, action);
    const replay = applyKqOperationsRequest(result.state, action);
    expect(replay.state).toBe(result.state);
    expect(replay.payload).toEqual(result.payload);
    const before = structuredClone(result.state);
    expect(() => applyKqOperationsRequest(result.state, post({ ...action.body, requestKey: uuid(2) }))).toThrow('situation');
    expect(() => applyKqOperationsRequest(result.state, post({ action: 'recover', expectedRevision: 1, requestKey: 'invalid' }))).toThrow('invalide');
    expect(() => applyKqOperationsRequest(result.state, { ...choose(result.state, 'x', uuid(4)), method: 'PATCH' })).toThrow('méthode');
    expect(result.state).toEqual(before);
    let chained = applyKqOperationsRequest(result.state, choose(result.state, 'instagram', uuid(3))).state;
    chained = applyKqOperationsRequest(chained, choose(chained, 'instagram', uuid(5))).state;
    expect(chained.trial.clock).toBe(initial.trial.clock);
    expect(() => applyKqOperationsRequest(chained, choose(chained, 'instagram', uuid(6)))).toThrow();
  });

  it('uses the exercise clock for mental recovery and leaves closed shops inactive', () => {
    const initial = createKqOperationsLesson('market');
    initial.trial.commerce.online!.site.active = false;
    let state = applyKqOperationsRequest(initial, choose(initial, 'x')).state;
    const spent = getKqOperationsSocial(state);
    expect(spent.energy).toBeLessThan(100);
    expect(spent.siteActive).toBe(false);
    expect(state.trial.commerce.online!.site.active).toBe(false);
    state = applyKqOperationsRequest(state, post({ action: 'recover', expectedRevision: 1, requestKey: uuid(2) })).state;
    expect(state.social).toMatchObject({ energy: Math.min(100, spent.energy + 30), audienceFollowers: spent.audienceFollowers });
    state = applyKqOperationsRequest(state, choose(state, 'instagram', uuid(3))).state;
    const beforeRest = getKqOperationsSocial(state).energy;
    expect(beforeRest).toBeLessThan(100);
    expect(() => applyKqOperationsRequest(state, post({ action: 'recover', expectedRevision: 3, requestKey: uuid(4) }))).toThrow('pause');
    state = advance(state, 24);
    expect(getKqOperationsSocial(state).energy).toBe(100);
    expect(state.social!.energy).toBe(beforeRest);
    expect(state.trial.commerce.online!.site.active).toBe(false);
  });

  it('replays the social journal deterministically and never requests the real account', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    const session = createKqOperationsSession('market');
    const actions: KqOperationsLessonAction[] = [];
    const execute = async (action: KqOperationsLessonAction) => {
      const response = await session.request(action.path, { method: action.method, body: JSON.stringify(action.body) });
      expect(response.ok).toBe(true); actions.push(action);
    };
    await execute(choose(session.getSnapshot()));
    await execute(choose(session.getSnapshot(), 'x', uuid(2)));
    await execute(online('advance-online-time', { hours: 1 }));
    await execute(choose(session.getSnapshot(), 'instagram', uuid(3)));
    const read = await session.request(SOCIAL);
    expect(read.ok).toBe(true);
    expect((await read.json() as KqSocialSnapshot).history).toHaveLength(3);
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions }).state).toEqual(session.getSnapshot());
    expect(network).not.toHaveBeenCalled();
  });

  it('saves the current narrative marker outside the accepted command and restores it once', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
    const session = createKqOperationsSession('market', 'narrative-test');
    const action = choose(session.getSnapshot());
    const result = await session.request(SOCIAL, { method: 'POST', body: JSON.stringify(action.body) });
    expect(result.ok).toBe(true);
    const saved = JSON.parse(storage.get(session.storageKey)!);
    expect(saved.actions).toEqual([action]);
    expect(saved.actions[0].body).not.toHaveProperty('socialNarrativeVersion');
    expect(session.getSnapshot().social!.history[0]).toMatchObject({ narrativeVersion: 3, id: action.body.requestKey });
    const restored = createKqOperationsSession('market', 'narrative-test');
    restored.restore();
    expect(restored.getSnapshot()).toEqual(session.getSnapshot());
    const retried = await restored.request(SOCIAL, { method: 'POST', body: JSON.stringify(action.body) });
    expect(retried.ok).toBe(true);
    expect(restored.getSnapshot().social!.history).toHaveLength(1);
    expect(JSON.parse(storage.get(session.storageKey)!).actions).toHaveLength(1);
  });

  it.each(['instagram', 'x'] as const)('restores an expanded %s journal with its old prose before appending the current narrative', platform => {
    const actions: KqOperationsLessonAction[] = [];
    let expected = createKqOperationsLesson('market');
    for (let index = 0; index < 11; index++) {
      const clock = online('advance-online-time', { hours: 1 });
      actions.push(clock);
      expected = applyKqOperationsRequest(expected, clock).state;
      const snapshot = getKqOperationsSocial(expected, undefined, 2);
      const scene = getKqSocialScenario(platform, index, snapshot.platforms[platform].memory, KQ_SOCIAL_LEGACY_SCENARIOS);
      const action: KqOperationsLessonAction = { path: SOCIAL, method: 'POST', socialCatalogVersion: 2, body: {
        modelVersion: 2, action: 'choose', platform, expectedRevision: index, requestKey: uuid(500 + index), scenarioId: scene.id,
        choiceId: scene.choices.find(choice => choice.intent === 'care')!.id,
      } };
      actions.push(action);
      expected = applyKqOperationsRequest(expected, action, { replaySocialLegacyNarrative: true }).state;
      expect(expected.social!.history[0].outcome).toBe(scene.choices.find(choice => choice.id === action.body.choiceId)!.outcome);
      expect(expected.social!.history[0]).not.toHaveProperty('narrativeVersion');
    }
    expect(Object.keys(getKqOperationsSocial(expected, undefined, 2).platforms[platform].memory).length).toBeGreaterThan(0);
    if (!isKqSocialSnapshot(expected.social)) throw new Error('Expected a restored version-two snapshot');
    expected.social = normalizeKqSocialSnapshot({ ...expected.social, narrativeVersion: undefined }, expected.trial.clock);
    const restored = restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions });
    expect(restored.actions).toEqual(actions);
    expect(restored.state).toEqual(expected);
    expect(getKqOperationsSocial(restored.state).platforms[platform].chapter).toBe(0);
    expect(getKqOperationsSocial(restored.state).platforms[platform].memory).toEqual({});
    const account = getKqOperationsSocial(restored.state).platforms[platform];
    expect(getKqSocialScenario(platform, account.chapter, account.memory).body).toBe(getKqSocialScenario(platform, account.chapter).body);
    const clock = online('advance-online-time', { hours: 1 });
    expected = applyKqOperationsRequest(expected, clock).state;
    const fresh = choose(expected, platform, uuid(520));
    expected = applyKqOperationsRequest(expected, fresh).state;
    const mixed = restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: [...actions, clock, fresh] });
    expect(mixed.state).toEqual(expected);
    const mixedSocial = getKqOperationsSocial(mixed.state);
    expect(mixedSocial.history[0].narrativeVersion).toBe(3);
    expect(mixedSocial.history.slice(1).every(entry => entry.narrativeVersion === undefined)).toBe(true);
    expect(mixedSocial.history.slice(1)).toEqual(restored.state.social!.history);
    expect(mixedSocial.platforms[platform].memory).toEqual({ [String(fresh.body.scenarioId)]: fresh.body.choiceId });
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: mixed.actions }).state).toEqual(mixed.state);
    expect(applyKqOperationsRequest(mixed.state, fresh).state).toBe(mixed.state);
  });

  it('rejects invalid narrative journal markers and attempts to replay an older version after a new narrative', () => {
    const initial = createKqOperationsLesson('market'), first = choose(initial);
    for (const marker of [1, 4, null, '2', true]) {
      expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: [{ ...first, socialNarrativeVersion: marker }] }).actions).toEqual([]);
    }
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: [{ ...first, socialCatalogVersion: undefined }] }).actions).toEqual([]);
    const next = applyKqOperationsRequest(initial, first).state;
    const second = { ...choose(next, 'x', uuid(2)), socialNarrativeVersion: undefined };
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: [first, second] }).actions).toEqual([]);
  });

  it.each(['instagram', 'x'] as const)('preserves archived V2 %s publications and their effects before starting the producer story', platform => {
    const actions: KqOperationsLessonAction[] = [];
    let expected = createKqOperationsLesson('market');
    for (let index = 0; index < 3; index++) {
      const clock = online('advance-online-time', { hours: 1 });
      actions.push(clock); expected = applyKqOperationsRequest(expected, clock).state;
      const snapshot = getKqOperationsSocial(expected, undefined, 2);
      const scene = getKqSocialScenario(platform, index, snapshot.platforms[platform].memory, KQ_SOCIAL_V2_SCENARIOS);
      const choice = scene.choices.find(row => row.intent === 'care')!;
      const action: KqOperationsLessonAction = { path: SOCIAL, method: 'POST', socialCatalogVersion: 2, socialNarrativeVersion: 2,
        body: { modelVersion: 2, action: 'choose', platform, expectedRevision: index, requestKey: uuid(600 + index), scenarioId: scene.id, choiceId: choice.id } };
      actions.push(action);
      expected = applyKqOperationsRequest(expected, action, { replaySocialV2Narrative: true }).state;
      expect(expected.social!.history[0]).toMatchObject({ narrativeVersion: 2, outcome: choice.outcome });
    }
    if (!isKqSocialSnapshot(expected.social)) throw new Error('Expected a restored V2 snapshot');
    const archive = structuredClone(expected.social.history), followers = expected.trial.commerce.online!.followers;
    expected.social = normalizeKqSocialSnapshot(expected.social, expected.trial.clock);
    const restored = restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions });
    expect(restored.actions).toEqual(actions); expect(restored.state).toEqual(expected);
    expect(restored.state.social!.history).toEqual(archive);
    expect(restored.state.trial.commerce.online!.followers).toBe(followers);
    expect(getKqOperationsSocial(restored.state).platforms[platform]).toMatchObject({ chapter: 0, memory: {} });
    const clock = online('advance-online-time', { hours: 1 });
    expected = applyKqOperationsRequest(expected, clock).state;
    const fresh = choose(expected, platform, uuid(610));
    expected = applyKqOperationsRequest(expected, fresh).state;
    const mixed = restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: [...actions, clock, fresh] });
    expect(mixed.state).toEqual(expected);
    expect(getKqOperationsSocial(mixed.state).history[0].narrativeVersion).toBe(3);
    expect(mixed.state.social!.history.slice(1)).toEqual(archive);
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: mixed.actions }).state).toEqual(mixed.state);
  });

  it('makes the same choices available in La Relève without inventing shop receipts', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    let state = createReleveCommerceBusiness();
    const transport = createReleveCommerceTransport({ getState: () => state, setState: next => { state = next; } });
    const read = await transport(SOCIAL);
    expect(read.ok).toBe(true);
    expect(await read.json()).toMatchObject({ revision: 0, siteActive: false });
    const action = choose(state.operations);
    const before = structuredClone(state);
    const response = await transport(SOCIAL, { method: 'POST', body: JSON.stringify(action.body) });
    expect(response.ok).toBe(true);
    const result = await response.json() as KqSocialSnapshot;
    expect(result).toMatchObject({ revision: 1, version: 2 });
    expect(result.socialFollowers).toBeGreaterThan(0);
    expect(result.audienceFollowers).toBe(result.socialFollowers);
    expect(state.operations.trial.commerce.online!.stats).toEqual(before.operations.trial.commerce.online!.stats);
    expect(state.operations.trial.commerce.cashCents).toBe(before.operations.trial.commerce.cashCents);
    expect(state.journal).toEqual(before.journal);
    expect(applyReleveCommerceRequest(state, action).state).toBe(state);
    expect(network).not.toHaveBeenCalled();
  });

  it('restores historical social choices with their original rewards, then replays new choices', () => {
    const legacy = (body: Record<string, unknown>): KqOperationsLessonAction => ({ path: SOCIAL, method: 'POST', body });
    const actions = [online('start-marketing', { code: 'introduction', angle: 'craft' }),
      legacy({ action: 'choose', expectedRevision: 0, requestKey: uuid(1), platform: 'instagram', scenarioId: 'ig-first-frame', choiceId: 'workshop' }),
      legacy({ action: 'choose', expectedRevision: 1, requestKey: uuid(2), platform: 'x', scenarioId: 'x-first-thread', choiceId: 'thread' }),
      online('advance-online-time', { hours: 24 }),
      legacy({ action: 'choose', expectedRevision: 2, requestKey: uuid(3), platform: 'instagram', scenarioId: 'ig-comment', choiceId: 'explain' })];
    const restored = restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions });
    expect(restored.actions).toHaveLength(actions.length);
    expect(restored.state.trial.commerce.online!.followers).toBe(85);
    expect(restored.state.social).toMatchObject({ version: 2, revision: 3, socialFollowers: 70,
      platforms: { instagram: { followers: 56 }, x: { followers: 14 } }, sponsors: { earnedCents: 0 } });
    expect(() => applyKqOperationsRequest(restored.state, actions[1])).toThrow('invalide');
    const clockAction = online('advance-online-time', { hours: 1 });
    let current = applyKqOperationsRequest(restored.state, clockAction).state;
    const currentChoice = choose(current, 'instagram', uuid(4));
    current = applyKqOperationsRequest(current, currentChoice).state;
    expect(restoreKqOperationsLesson('market', { version: 1, lesson: 'market', actions: [...actions, clockAction, currentChoice] }).state).toEqual(current);
  });

  it('settles pressure only against fictional elapsed time', () => {
    let state = sponsorReady();
    state.social!.platforms.x.haters = 60;
    expect(getKqOperationsSocial(state).platforms.x.haters).toBe(60);
    state = advance(state, 1);
    expect(getKqOperationsSocial(state).platforms.x.haters).toBe(58);
    expect(state.social!.platforms.x.haters).toBe(60);
  });

  it('pays a completed partnership once as a net reward and records the cash movement', () => {
    const { state, sponsor, cash } = completedPartnership();
    expect(state.trial.commerce.cashCents).toBe(cash);
    expect(getKqOperationsSocial(state).sponsors.active?.progressTags).toEqual(sponsor.requiredTags);
    const beforeVat = structuredClone(state.trial.commerce.business!.vat);
    const action = sponsorCommand(state, 'sponsor-claim', 103);
    const claimed = applyKqOperationsRequest(state, action);
    expect(claimed.state.trial.commerce.cashCents).toBe(cash + sponsor.rewardCents);
    expect(claimed.state.trial.commerce.business!.vat).toEqual(beforeVat);
    expect(claimed.state.trial.commerce.business!.ledger).toContainEqual({ id: `social-sponsor-${uuid(103)}`, kind: 'social-sponsor-reward', amountCents: sponsor.rewardCents, occurredAt: getKqOperationsSocial(claimed.state).serverNow });
    expect(getKqOperationsSocial(claimed.state).sponsors).toMatchObject({ earnedCents: sponsor.rewardCents, completedIds: [sponsor.id], active: null });
    expect(applyKqOperationsRequest(claimed.state, action).state).toBe(claimed.state);
    expect(() => applyKqOperationsRequest(claimed.state, sponsorCommand(claimed.state, 'sponsor-claim', 104))).toThrow();
  });

  it('rejects a reward that would overflow the wallet without consuming the completed partnership', () => {
    const { state, sponsor } = completedPartnership();
    state.trial.commerce.cashCents = 2_147_483_647 - sponsor.rewardCents + 1;
    const before = structuredClone(state);
    const action = sponsorCommand(state, 'sponsor-claim', 103);
    expect(() => applyKqOperationsRequest(state, action)).toThrow('trésorerie');
    expect(state).toEqual(before);
    state.trial.commerce.cashCents -= 1;
    expect(applyKqOperationsRequest(state, action).state.trial.commerce.cashCents).toBe(2_147_483_647);
  });

  it('cancels a partial partnership without a reward or debt', () => {
    let state = sponsorReady();
    const sponsor = getKqSponsorOffers(getKqOperationsSocial(state)).find(offer => offer.eligible)!.sponsor;
    const cash = state.trial.commerce.cashCents;
    state = applyKqOperationsRequest(state, sponsorCommand(state, 'sponsor-accept', 100, { sponsorId: sponsor.id })).state;
    state = applyKqOperationsRequest(state, sponsorCommand(state, 'sponsor-post', 101, { tag: sponsor.requiredTags[0] })).state;
    const cancelled = applyKqOperationsRequest(state, sponsorCommand(state, 'sponsor-cancel', 102)).state;
    expect(cancelled.trial.commerce.cashCents).toBe(cash);
    expect(getKqOperationsSocial(cancelled).sponsors).toMatchObject({ active: null, earnedCents: 0 });
    expect(cancelled.trial.commerce.business!.ledger.some(row => row.kind === 'social-sponsor-reward')).toBe(false);
  });

  it('classifies a La Relève partnership payment as a reward in its balanced journal', () => {
    let state = createReleveCommerceBusiness();
    state.operations = sponsorReady(state.operations);
    const sponsor = getKqSponsorOffers(getKqOperationsSocial(state.operations)).find(offer => offer.eligible)!.sponsor;
    state = applyReleveCommerceRequest(state, sponsorCommand(state.operations, 'sponsor-accept', 100, { sponsorId: sponsor.id })).state;
    state = applyReleveCommerceRequest(state, sponsorCommand(state.operations, 'sponsor-post', 101, { tag: sponsor.requiredTags[0] })).state;
    state = applyReleveCommerceRequest(state, online('advance-online-time', { hours: 1 })).state;
    state = applyReleveCommerceRequest(state, sponsorCommand(state.operations, 'sponsor-post', 102, { tag: sponsor.requiredTags[1] })).state;
    const cash = state.operations.trial.commerce.cashCents;
    const claim = sponsorCommand(state.operations, 'sponsor-claim', 103);
    state = applyReleveCommerceRequest(state, claim).state;
    expect(state.operations.trial.commerce.cashCents).toBe(cash + sponsor.rewardCents);
    const entry = state.journal.find(row => row.kind === 'social-sponsor-reward')!;
    expect(entry.postings).toContainEqual({ account: 'cash', deltaCents: sponsor.rewardCents });
    expect(entry.postings).toContainEqual({ account: 'revenue_rewards', deltaCents: -sponsor.rewardCents });
    expect(entry.postings.reduce((sum, row) => sum + row.deltaCents, 0)).toBe(0);
    expect(applyReleveCommerceRequest(state, claim).state).toBe(state);
  });
});
