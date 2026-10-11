// The SQL snapshot lasts 60 seconds and the public route may reuse it for 30.
// A cold or stale bootstrap needs one private read after loading the ranking.
const KQ_BOOTSTRAP_RANKING_MAX_AGE_MS = 90_000;

export function canReuseKqBootstrapProgress(
  progress: { leaderboardGeneratedAt?: string | null } | null | undefined,
  now = Date.now(),
): boolean {
  if (progress === null) return true; // No ranking profile yet.
  if (!progress?.leaderboardGeneratedAt) return false;
  const age = now - Date.parse(progress.leaderboardGeneratedAt);
  return Number.isFinite(age) && age >= -5_000 && age <= KQ_BOOTSTRAP_RANKING_MAX_AGE_MS;
}
