export const KQ_STORAGE_REFRESH_MS = 120_000;

type RefreshSnapshot = { serverNow: string; lots: readonly { projection: { nextChangeAt: string } }[] };

/** Use the server clock so a wrong device clock cannot delay a due surplus sale. */
export function getKqStorageRefreshDelay(snapshot: RefreshSnapshot | null, elapsedMs = 0): number {
  if (!snapshot) return KQ_STORAGE_REFRESH_MS;
  const serverNow = Date.parse(snapshot.serverNow);
  let delay = KQ_STORAGE_REFRESH_MS;
  for (const lot of snapshot.lots) {
    const next = Date.parse(lot.projection.nextChangeAt);
    if (Number.isFinite(next) && next > serverNow) {
      delay = Math.min(delay, next - serverNow - Math.max(0, elapsedMs));
    }
  }
  // Small grace for the response trip, and a floor preventing retry bursts.
  return Math.max(1_000, Math.min(KQ_STORAGE_REFRESH_MS, delay + 100));
}
