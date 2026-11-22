export type KqVisit = { at: string; cashCents: number; readyLotCount: number };

export function readKqEarlierVisit(raw: string | null, now: KqVisit): KqVisit | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<KqVisit> | null;
    if (!saved || typeof saved.at !== "string" || !Number.isSafeInteger(saved.cashCents) ||
      !Number.isSafeInteger(saved.readyLotCount) || saved.readyLotCount! < 0) return null;
    const elapsed = Date.parse(now.at) - Date.parse(saved.at);
    return Number.isFinite(elapsed) && elapsed >= 4 * 3600000 ? saved as KqVisit : null;
  } catch { return null; }
}
