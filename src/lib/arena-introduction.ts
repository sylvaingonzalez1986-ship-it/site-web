export type ArenaIntroductionState = 'new' | 'seen' | 'unavailable';
export type ArenaLearningStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const ARENA_RELEVE_VISITS_KEY = 'arena-releve-visits-v1';
const LEGACY_OWNER_KEY = 'arena-releve-legacy-owner-v1';
const seenInThisTab = new Set<string>();
export const arenaIntroductionKey = (userId: string) => `arena-releve-introduction-v1:${userId}`;
export const arenaLearningAccountKey = (key: string, userId: string) => `${key}:${userId}`;

export function hasSeenArenaIntroduction(userId: string): boolean {
  if (seenInThisTab.has(userId)) return true;
  try { return localStorage.getItem(arenaIntroductionKey(userId)) === 'seen'; }
  catch { return false; }
}

/** Called only after the introduction actually mounts, never during prefetch. */
export function rememberArenaIntroduction(userId: string) {
  seenInThisTab.add(userId);
  try { localStorage.setItem(arenaIntroductionKey(userId), 'seen'); }
  catch { /* The account preference and this tab still prevent a reopen loop. */ }
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
    setItem(key, value) { getStorage().setItem(arenaLearningAccountKey(key, userId), value); },
  };
}

export function markArenaIntroductionCompleted(storage: ArenaLearningStorage) {
  try {
    const saved = JSON.parse(storage.getItem(ARENA_RELEVE_VISITS_KEY) ?? 'null');
    const meetings = Array.isArray(saved?.meetings) ? saved.meetings : [];
    storage.setItem(ARENA_RELEVE_VISITS_KEY, JSON.stringify({ story: true, meetings }));
  } catch { /* The story session also persists its completed state. */ }
}
