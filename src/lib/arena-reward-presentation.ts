/** Decorative fill uses a fixed scale; crossing a milestone must never empty the jar. */
export function getArenaRewardJarFill(grams: number) {
  const safe = Number.isFinite(grams) ? Math.max(0, grams) : 0;
  return Math.min(100, (safe / 1_000) * 100);
}

export function getArenaRewardMilestone(grams: number) {
  const safe = Number.isFinite(grams) ? Math.max(0, grams) : 0;
  const steps = [25, 50, 100, 200, 500, 1_000];
  const next = steps.find((step) => step > safe) ?? (Math.floor(safe / 1_000) + 1) * 1_000;
  const previous = safe >= 1_000 ? Math.floor(safe / 1_000) * 1_000 : [...steps].reverse().find((step) => step <= safe) ?? 0;
  return { previousGrams: previous, nextGrams: next, progressPercent: Math.round(((safe - previous) / (next - previous)) * 100) };
}

export function isArenaRewardSeasonOpen(pool: { status: string; startsAt: string | null; endsAt: string | null }, now = Date.now()) {
  return pool.status === "active"
    && (!pool.startsAt || Date.parse(pool.startsAt) <= now)
    && (!pool.endsAt || Date.parse(pool.endsAt) > now);
}

export const formatArenaRewardGrams = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Math.max(0, value));
