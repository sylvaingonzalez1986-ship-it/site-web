import {
  advanceKqStage,
  canPlayKqCard,
  KQ_BUDDIES,
  KQ_CARDS,
  playKqCard,
  resolveKqStage,
  rollKqDice,
  startKqGame,
  type KqGameState,
} from './kanab-quest-game';

export const KQ_FIRST_CULTURE_VERSION = 1;
export const KQ_FIRST_CULTURE_SUPPORT = KQ_CARDS.find(card => card.code === 'BOTTE-021')!;
export const KQ_FIRST_CULTURE_EQUIPMENT = ['TENT-080-STARTER', 'AIR-STARTER', 'LED-300', 'DRYING-ROOM'];

export type KqFirstCultureAction = 'roll' | 'support' | 'resolve' | 'next';

const ACTIONS: readonly KqFirstCultureAction[] = ['roll', 'support', 'resolve', 'next'];
const SCENARIO = ['SIT-001', 'SIT-002', 'SIT-009', 'SIT-004', 'SIT-005', 'SIT-006'];
const DEMO_TIME = '2026-10-07T12:00:00.000Z';

/** A prepared, reproducible learning scenario. The normal engine remains unchanged. */
export function createKqFirstCulture(): KqGameState {
  const game = startKqGame(1178, {
    varietyCode: KQ_BUDDIES.find(buddie => buddie.rarity === 'gold')!.code,
    deckCodes: [KQ_FIRST_CULTURE_SUPPORT.code],
    collectionCodes: [KQ_FIRST_CULTURE_SUPPORT.code],
    equipmentCodes: KQ_FIRST_CULTURE_EQUIPMENT,
    energyMode: 'balanced',
    startedAt: DEMO_TIME,
  });
  return { ...game, varietyName: 'Buddie d’essai', situationCodes: [...SCENARIO] };
}

export function reduceKqFirstCulture(game: KqGameState, action: KqFirstCultureAction): KqGameState {
  switch (action) {
    case 'roll': return rollKqDice(game);
    case 'support': return canPlayKqCard(game, KQ_FIRST_CULTURE_SUPPORT).allowed
      ? playKqCard(game, KQ_FIRST_CULTURE_SUPPORT.code)
      : game;
    case 'resolve': return resolveKqStage(game);
    case 'next': {
      const next = advanceKqStage(game);
      // Replaying a local learning session must not depend on the wall clock.
      return next !== game && next.phase === 'complete' ? { ...next, completedAt: DEMO_TIME } : next;
    }
    default: return game;
  }
}

export function firstCultureStorageKey(scope: string) {
  return `kq-first-culture-v${KQ_FIRST_CULTURE_VERSION}:${scope}`;
}

/** Restore actions, never a saved game snapshot, collection or account balance. */
export function restoreKqFirstCulture(value: unknown): { game: KqGameState; actions: KqFirstCultureAction[] } {
  const empty = { game: createKqFirstCulture(), actions: [] as KqFirstCultureAction[] };
  if (!value || typeof value !== 'object') return empty;
  const saved = value as { version?: unknown; actions?: unknown };
  if (saved.version !== KQ_FIRST_CULTURE_VERSION || !Array.isArray(saved.actions) || saved.actions.length > 24) return empty;
  if (!saved.actions.every(action => typeof action === 'string' && ACTIONS.includes(action as KqFirstCultureAction))) return empty;

  try {
    let game = empty.game;
    const actions: KqFirstCultureAction[] = [];
    for (const action of saved.actions as KqFirstCultureAction[]) {
      const next = reduceKqFirstCulture(game, action);
      // Invalid order or a duplicate action invalidates the journal, rather than
      // inventing progression that the player has never completed.
      if (next === game) return empty;
      game = next;
      actions.push(action);
    }
    return { game, actions };
  } catch {
    return empty;
  }
}
