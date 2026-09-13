import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

const TAG = "arena-shared-read-v1";

/** Only common read models: never pass cookies, balances, quotes or viewer data. */
export function cacheArenaSharedRead<T>(key: string, loader: () => Promise<T>) {
  // Uses the existing non-Cache-Components configuration of this application.
  const cached = unstable_cache(loader, ["arena-shared-read-v1", key], { revalidate: 30, tags: [TAG] });
  let pending: Promise<T> | null = null;
  return () => {
    if (pending) return pending;
    const result = cached();
    pending = result;
    void result.finally(() => { if (pending === result) pending = null; }).catch(() => {});
    return result;
  };
}

export function invalidateArenaSharedReads() {
  revalidateTag(TAG, { expire: 0 });
}
