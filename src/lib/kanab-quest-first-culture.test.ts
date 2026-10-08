import { describe, expect, it } from 'vitest';
import { canPlayKqCard, getKqZeroSuccessStageCount, isKqCultureDead, previewKqResolution } from './kanab-quest-game';
import {
  createKqFirstCulture,
  firstCultureStorageKey,
  KQ_FIRST_CULTURE_SUPPORT,
  KQ_FIRST_CULTURE_VERSION,
  reduceKqFirstCulture,
  restoreKqFirstCulture,
  type KqFirstCultureAction,
} from './kanab-quest-first-culture';

function finish(supportAt = -1) {
  let game = createKqFirstCulture();
  const actions: KqFirstCultureAction[] = [];
  const act = (action: KqFirstCultureAction) => {
    game = reduceKqFirstCulture(game, action);
    actions.push(action);
    expect(restoreKqFirstCulture({ version: KQ_FIRST_CULTURE_VERSION, actions }).game).toEqual(game);
  };
  for (let stage = 0; stage < 6; stage++) {
    act('roll');
    if (stage === supportAt) {
      expect(canPlayKqCard(game, KQ_FIRST_CULTURE_SUPPORT).allowed).toBe(true);
      act('support');
    }
    expect(['success', 'critical']).toContain(previewKqResolution(game)?.outcome);
    act('resolve');
    act('next');
  }
  return { game, actions };
}

describe('first culture without an account', () => {
  it.each([-1, 0, 3, 4, 5])('guarantees a harvest with support at stage %s, including no support', supportAt => {
    const { game } = finish(supportAt);
    expect(game.phase).toBe('complete');
    expect(game.history).toHaveLength(6);
    expect(game.harvestGrams).toBeGreaterThan(0);
    expect(getKqZeroSuccessStageCount(game)).toBe(0);
    expect(isKqCultureDead(game)).toBe(false);
    expect(game.usedCards).toHaveLength(supportAt < 0 ? 0 : 1);
    expect(game.heritageCode).toBeUndefined();
  });

  it('uses a real, optional reaction with a visible cost and benefit', () => {
    const rolled = reduceKqFirstCulture(createKqFirstCulture(), 'roll');
    expect(previewKqResolution(rolled)?.outcome).toBe('success');
    const improved = reduceKqFirstCulture(rolled, 'support');
    expect(improved.xp).toBe(rolled.xp - KQ_FIRST_CULTURE_SUPPORT.xpCost);
    expect(previewKqResolution(improved)?.outcome).toBe('critical');
    expect(reduceKqFirstCulture(improved, 'support')).toBe(improved);
    expect(finish(0).game.quality).toBeGreaterThan(finish().game.quality);
    expect(reduceKqFirstCulture(rolled, 'roll')).toBe(rolled);
  });

  it('cannot skip a stage or duplicate its rewards', () => {
    const opening = createKqFirstCulture();
    expect(reduceKqFirstCulture(opening, 'next')).toBe(opening);
    expect(reduceKqFirstCulture(opening, 'resolve')).toBe(opening);
    expect(reduceKqFirstCulture(opening, 'support')).toBe(opening);
    const resolved = reduceKqFirstCulture(reduceKqFirstCulture(opening, 'roll'), 'resolve');
    expect(reduceKqFirstCulture(resolved, 'resolve')).toBe(resolved);
    const { game } = finish();
    for (const action of ['roll', 'resolve', 'support', 'next'] as const) {
      expect(reduceKqFirstCulture(game, action)).toBe(game);
    }
  });

  it('rejects corrupt, obsolete and out-of-order journals and ignores injected account data', () => {
    const empty = createKqFirstCulture();
    for (const value of [null, {}, { version: 0, actions: ['roll'] },
      { version: KQ_FIRST_CULTURE_VERSION, actions: ['next'] },
      { version: KQ_FIRST_CULTURE_VERSION, actions: ['roll', 'roll'] },
      { version: KQ_FIRST_CULTURE_VERSION, actions: [{ type: 'roll' }] },
      { version: KQ_FIRST_CULTURE_VERSION, actions: Array(25).fill('roll') },
    ]) expect(restoreKqFirstCulture(value).game).toEqual(empty);

    const restored = restoreKqFirstCulture({ version: KQ_FIRST_CULTURE_VERSION, actions: [],
      game: { xp: 999999, phase: 'complete' }, cashCents: 999999, userId: 'forged' });
    expect(restored.game).toEqual(empty);
    expect(firstCultureStorageKey('guest')).not.toBe(firstCultureStorageKey('member'));
    expect(firstCultureStorageKey('guest')).toContain('kq-first-culture-');
  });
});
