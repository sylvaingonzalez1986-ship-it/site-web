const gameKey = /^(?:kq[:-]|arena-(?:releve-|journey-|learning-entry-)|lcb:(?:warehouse-draft|culture-preparation):)/;
const awaitingCreation = "awaiting-creation";

/** The database creation timestamp identifies the adventure across browsers and survives appearance edits. */
export function synchronizeQuarterStorage(ownerId: string, createdAt: string | null) {
  const encodedOwner = encodeURIComponent(ownerId);
  const marker = `quarter-character-generation:${encodedOwner}`;
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      const previous = storage.getItem(marker);
      if (createdAt !== null && previous === createdAt) continue;
      // After a successful local creation, drafts already belong to this character.
      if (createdAt === null || previous !== awaitingCreation) {
        for (let index = storage.length - 1; index >= 0; index--) {
          const key = storage.key(index);
          if (!key || !gameKey.test(key)) continue;
          if (key.split(":").some(part => part === ownerId || part === encodedOwner)) storage.removeItem(key);
        }
      }
      storage.setItem(marker, createdAt ?? awaitingCreation);
    } catch { /* The server profile still controls entry if browser storage is unavailable. */ }
  }
}
