const dismissed = new Set<string>();
export const betaNoticeStorageKey = (owner: string) => `kq:beta-notice:v1:${owner}`;
const memoryKey = (owner: string, connection: string) => `${owner}:${connection}`;
export function hasDismissedBetaNotice(owner: string, connection: string, storage: Pick<Storage, "getItem">) {
  if (dismissed.has(memoryKey(owner, connection))) return true;
  try {
    const seen = storage.getItem(betaNoticeStorageKey(owner)) === connection;
    if (seen) dismissed.add(memoryKey(owner, connection));
    return seen;
  } catch { return false; }
}
export function dismissBetaNotice(owner: string, connection: string, storage: Pick<Storage, "setItem">) {
  dismissed.add(memoryKey(owner, connection));
  try { storage.setItem(betaNoticeStorageKey(owner), connection); } catch { /* The current visit remains usable if persistence is blocked. */ }
}
