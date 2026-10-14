const storageKey = (userId: string) => `kq:support-pack-purchase-key:${userId}`;
const requestKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A null account is the tutorial: its requests must never touch live recovery storage. */
export function readSupportPackPurchaseKey(userId: string | null): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const key = sessionStorage.getItem(storageKey(userId));
    return key && requestKeyPattern.test(key) ? key : null;
  } catch { return null; }
}

export function saveSupportPackPurchaseKey(userId: string | null, key: string | null) {
  if (!userId || typeof window === "undefined") return;
  try {
    if (key) sessionStorage.setItem(storageKey(userId), key);
    else sessionStorage.removeItem(storageKey(userId));
  } catch { /* The mounted shop still retains its key if browser storage is unavailable. */ }
}
