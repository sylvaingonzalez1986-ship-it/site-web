import { describe, expect, it } from 'vitest';
import { createArenaLearningStorage } from './arena-introduction';
import { ARENA_QUICK_TRIAL_KEY, ARENA_QUICK_TRIAL_VERSION, createArenaQuickTrial, createArenaQuickTrialSession, getQuickTrialContainers, QUICK_TRIAL_BUDDIES, readArenaQuickTrialResume, reduceArenaQuickTrial, restoreArenaQuickTrial, type ArenaQuickTrialAction } from './arena-quick-trial';
import { KQ_CURING_DURATION_MS, projectKqStorageLot } from './kanab-quest-storage';
import { getReleveCommerceSnapshot } from './kanab-quest-releve-commerce';

function run(varietyCode = QUICK_TRIAL_BUDDIES[0].code, support = false) {
  let state = createArenaQuickTrial();
  const actions: ArenaQuickTrialAction[] = [];
  const act = (action: ArenaQuickTrialAction) => {
    const next = reduceArenaQuickTrial(state, action);
    expect(next).not.toBe(state);
    state = next; actions.push(action);
    return state;
  };
  act({ type: 'start', varietyCode });
  for (let index = 0; index < 6; index++) {
    act({ type: 'culture', action: 'roll' });
    if (index === 0 && support) act({ type: 'culture', action: 'support' });
    act({ type: 'culture', action: 'resolve' });
    act({ type: 'culture', action: 'next' });
  }
  return { get state() { return state; }, actions, act };
}

describe('short trial uses the existing culture, storage, jury and commerce engines', () => {
  it.each(QUICK_TRIAL_BUDDIES.map(buddie => buddie.code))('keeps %s and its exact harvest through explicit storage and jury', code => {
    const trial = run(code);
    expect(trial.state.game!.varietyCode).toBe(code);
    const units = Math.round(trial.state.game!.harvestGrams! * 10);
    expect(units).toBeGreaterThan(0);
    expect(trial.state.storage!.capacity!.allocations).toEqual([]);
    expect(reduceArenaQuickTrial(trial.state, { type: 'jury' })).toBe(trial.state);
    expect(reduceArenaQuickTrial(trial.state, { type: 'mature' })).toBe(trial.state);
    const container = getQuickTrialContainers(trial.state)[1];
    trial.act({ type: 'store', containerCode: container.code as 'BOVEDA-1L' });
    expect(trial.state.storage!.capacity!.allocations).toEqual([{ containerCode: container.code, quantity: container.quantity, storedUnits: units }]);
    expect(projectKqStorageLot(trial.state.storage!, trial.state.clock).stage).toBe('curing');
    expect(reduceArenaQuickTrial(trial.state, { type: 'jury' })).toBe(trial.state);
    const before = trial.state.clock;
    trial.act({ type: 'mature' });
    expect(trial.state.clock - before).toBe(KQ_CURING_DURATION_MS);
    expect(trial.state.battle).toBeNull();
    trial.act({ type: 'jury' });
    expect(trial.state.battle!.burnedAt).toBe(new Date(trial.state.clock).toISOString());
    expect(trial.state.storage!.capacity!.totalUnits).toBe(units);
    expect(reduceArenaQuickTrial(trial.state, { type: 'jury' })).toBe(trial.state);
  });

  it('keeps the optional card a real choice with cost and an effect on the harvest', () => {
    const noCard = run(), card = run(undefined, true);
    expect(noCard.state.game!.usedCards).toHaveLength(0);
    expect(card.state.game!.usedCards).toHaveLength(1);
    expect(card.state.game!.quality).toBeGreaterThan(noCard.state.game!.quality);
  });

  it.each([false, true])('does not sell until confirmation and reproduces the exact receipt, support=%s', support => {
    const trial = run(undefined, support);
    trial.act({ type: 'store', containerCode: 'GLASS-3L' });
    trial.act({ type: 'mature' }); trial.act({ type: 'jury' }); trial.act({ type: 'open-market' });
    const raw = getReleveCommerceSnapshot(trial.state.commerce!).rawLots[0];
    expect(raw.options.find(option => option.route === 'raw')?.available).toBe(true);
    trial.act({ type: 'prepare', route: 'raw' });
    trial.act({ type: 'quote', channel: 'wholesale', units: 100 });
    expect(trial.state.offer!.netPayoutCents).toBeGreaterThan(0);
    expect(getReleveCommerceSnapshot(trial.state.commerce!).receipts).toHaveLength(0);
    const units = getReleveCommerceSnapshot(trial.state.commerce!).stocks[0].remainingUnits;
    trial.act({ type: 'cancel-sale' });
    expect(getReleveCommerceSnapshot(trial.state.commerce!).stocks[0].remainingUnits).toBe(units);
    trial.act({ type: 'quote', channel: 'wholesale', units: 200 });
    const quote = trial.state.offer!;
    trial.act({ type: 'sell' });
    const sold = getReleveCommerceSnapshot(trial.state.commerce!);
    expect(sold.stocks[0].remainingUnits).toBe(units - quote.offer.units);
    expect(sold.cashCents).toBe(quote.netPayoutCents);
    expect(sold.receipts).toHaveLength(1);
    expect(reduceArenaQuickTrial(trial.state, { type: 'sell' })).toBe(trial.state);
    const restored = restoreArenaQuickTrial({ version: ARENA_QUICK_TRIAL_VERSION, actions: trial.actions });
    expect(restored?.state).toEqual(trial.state);
    expect(restored?.state.step).toBe('complete');
  });

  it('rejects invalid journals and account snapshot injection', () => {
    for (const value of [null, {}, { version: 0, actions: [] }, { version: 1, actions: [{ type: 'sell' }] },
      { version: 1, actions: [{ type: 'start', varietyCode: 'unknown' }] }, { version: 1, actions: Array(121).fill({ type: 'jury' }) },
    ]) expect(restoreArenaQuickTrial(value)).toBeNull();
    expect(restoreArenaQuickTrial({ version: 1, actions: [], state: { step: 'complete' }, cashCents: 999999 })?.state).toEqual(createArenaQuickTrial());
  });

  it('isolates saves by account and keeps La Relève intact', () => {
    const values = new Map([['arena-releve-session-v1:A', 'full-story-save']]);
    const backing = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const accountA = createArenaLearningStorage('A', false, () => backing), accountB = createArenaLearningStorage('B', false, () => backing);
    const session = createArenaQuickTrialSession(accountA);
    session.play({ type: 'start', varietyCode: QUICK_TRIAL_BUDDIES[1].code });
    session.play({ type: 'culture', action: 'roll' });
    expect(readArenaQuickTrialResume(accountA)?.label).toContain('Culture');
    expect(readArenaQuickTrialResume(accountB)).toBeNull();
    expect(createArenaQuickTrialSession(accountA).getSnapshot().state).toEqual(session.getSnapshot().state);
    expect(values.get('arena-releve-session-v1:A')).toBe('full-story-save');
    expect(values.has(ARENA_QUICK_TRIAL_KEY)).toBe(false);
  });

  it('keeps play available and shows a warning when saving fails', () => {
    const session = createArenaQuickTrialSession({ getItem: () => null, setItem: () => { throw new Error('Quota'); } });
    session.play({ type: 'start', varietyCode: QUICK_TRIAL_BUDDIES[0].code });
    expect(session.getSnapshot().state.step).toBe('culture');
    expect(session.getSnapshot().warning).toContain('ne peut pas être enregistrée');
    expect(createArenaQuickTrialSession().getSnapshot().warning).toContain('indisponible');
  });

  it('clears an obsolete warning after a valid save succeeds', () => {
    let saved = '{}';
    const session = createArenaQuickTrialSession({ getItem: () => saved, setItem: (_key, value) => { saved = value; } });
    expect(session.getSnapshot().warning).toContain('illisible');
    session.play({ type: 'start', varietyCode: QUICK_TRIAL_BUDDIES[0].code });
    expect(session.getSnapshot().warning).toBe('');
    expect(restoreArenaQuickTrial(JSON.parse(saved))?.state.step).toBe('culture');
  });
});
