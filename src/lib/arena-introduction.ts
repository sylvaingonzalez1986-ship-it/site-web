export type ArenaIntroductionState = 'new' | 'seen' | 'unavailable';
export type ArenaLearningStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const ARENA_RELEVE_VISITS_KEY = 'arena-releve-visits-v1';
export const ARENA_LEARNING_ENTRY_KEY = 'arena-learning-entry-v1';
export type ArenaLearningEntryChoice = 'quick' | 'story' | 'quarter';
const LEGACY_OWNER_KEY = 'arena-releve-legacy-owner-v1';
const seenInThisTab = new Set<string>();
const entryChoicesInThisTab = new Map<string, ArenaLearningEntryChoice>();
export const arenaIntroductionKey = (userId: string) => `arena-releve-introduction-v1:${userId}`;
export const arenaLearningAccountKey = (key: string, userId: string) => `${key}:${userId}`;

export function hasSeenArenaIntroduction(userId: string): boolean {
  if (seenInThisTab.has(userId)) return true;
  try { return localStorage.getItem(arenaIntroductionKey(userId)) === 'seen'; }
  catch { return false; }
}

/** Called after a playable introduction mounts or the player chooses the quarter,
 * never while displaying the choice screen or prefetching a route. */
export function rememberArenaIntroduction(userId: string) {
  seenInThisTab.add(userId);
  try { localStorage.setItem(arenaIntroductionKey(userId), 'seen'); }
  catch { /* The account preference and this tab still prevent a reopen loop. */ }
}

/** Preferences use the same account-scoped store as lessons, without touching a save. */
export function readArenaLearningEntryChoice(userId: string, storage: ArenaLearningStorage) {
  try {
    const value = storage.getItem(ARENA_LEARNING_ENTRY_KEY);
    const choice = entryChoicesInThisTab.get(userId) ?? (value === 'quick' || value === 'story' || value === 'quarter' ? value : null);
    return { choice, storageUnavailable: false };
  } catch {
    return { choice: entryChoicesInThisTab.get(userId) ?? null, storageUnavailable: true };
  }
}

export function rememberArenaLearningEntryChoice(userId: string, storage: ArenaLearningStorage, choice: ArenaLearningEntryChoice): boolean {
  try {
    storage.setItem(ARENA_LEARNING_ENTRY_KEY, choice);
    entryChoicesInThisTab.delete(userId);
    return true;
  } catch { entryChoicesInThisTab.set(userId, choice); return false; }
}

/** A paused lesson offers a choice to resume; it never opens itself on return. */
export function getArenaLearningEntryScreen(state: ArenaIntroductionState, seenLocally: boolean, choice: ArenaLearningEntryChoice | null): 'choice' | 'quarter' {
  if (choice === 'quick' || choice === 'story') return 'choice';
  return choice === 'quarter' || state === 'seen' || seenLocally ? 'quarter' : 'choice';
}

/** New players never inherit another player's browser trial. Existing players
 * can recover the old unscoped save, claimed once for the first returning account. */
export function createArenaLearningStorage(userId: string, inheritLegacy = false,
  getStorage: () => ArenaLearningStorage = () => localStorage): ArenaLearningStorage {
  return {
    getItem(key) {
      const storage = getStorage();
      const saved = storage.getItem(arenaLearningAccountKey(key, userId));
      if (saved !== null || !inheritLegacy) return saved;
      const owner = storage.getItem(LEGACY_OWNER_KEY);
      if (owner !== null && owner !== userId) return null;
      const legacy = storage.getItem(key);
      if (legacy !== null) {
        storage.setItem(LEGACY_OWNER_KEY, userId);
        storage.setItem(arenaLearningAccountKey(key, userId), legacy);
      }
      return legacy;
    },
    setItem(key, value) {
      // Entry and the help launcher share this adapter. Keep their explicit
      // destination in sync even when a failed browser write needs a tab fallback.
      const entryChoice = key === ARENA_LEARNING_ENTRY_KEY && (value === 'quick' || value === 'story' || value === 'quarter') ? value : null;
      if (entryChoice) entryChoicesInThisTab.set(userId, entryChoice);
      getStorage().setItem(arenaLearningAccountKey(key, userId), value);
      if (entryChoice) entryChoicesInThisTab.delete(userId);
    },
  };
}

export function markArenaIntroductionCompleted(storage: ArenaLearningStorage) {
  try {
    const saved = JSON.parse(storage.getItem(ARENA_RELEVE_VISITS_KEY) ?? 'null');
    const meetings = Array.isArray(saved?.meetings) ? saved.meetings : [];
    storage.setItem(ARENA_RELEVE_VISITS_KEY, JSON.stringify({ story: true, meetings }));
  } catch { /* The story session also persists its completed state. */ }
}
