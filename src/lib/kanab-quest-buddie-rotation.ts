export const KQ_BUDDIE_ROTATION_REQUIRED = 5;

export type KqBuddieRotation = {
  requiredDistinctBuddies: typeof KQ_BUDDIE_ROTATION_REQUIRED;
  /** Most recently used first; one entry per Buddie variety, never per copy. */
  recentBuddieCodes: string[];
};

export function getKqBuddieRotationRemaining(code: string, recentBuddieCodes: readonly string[]): number {
  const recent = [...new Set(recentBuddieCodes)].slice(0, KQ_BUDDIE_ROTATION_REQUIRED);
  const index = recent.indexOf(code);
  return index === -1 ? 0 : KQ_BUDDIE_ROTATION_REQUIRED - index;
}

/** Call only after the server has successfully started a culture. */
export function recordKqBuddieUse(code: string, recentBuddieCodes: readonly string[]): string[] {
  return [...new Set([code, ...recentBuddieCodes])].slice(0, KQ_BUDDIE_ROTATION_REQUIRED);
}

export function getKqBuddieRotationMessage(remaining: number): string {
  return `Ce Buddie sera disponible après avoir utilisé ${remaining} autre${remaining > 1 ? "s" : ""} Buddie${remaining > 1 ? "s" : ""} différent${remaining > 1 ? "s" : ""}.`;
}
