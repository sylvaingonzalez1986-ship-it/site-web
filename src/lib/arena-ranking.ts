export const ARENA_NOTEBOOK_SCORE_CAP = 300;
export const ARENA_PLACARD_ACTIVITY_CAP = 600;
export const ARENA_PLACARD_SKILL_CAP = 100;

export type ArenaScoreInput = {
  notebookSeasonPoints: number;
  placardSeasonPoints: number;
  placardRating: number;
  placardBattles: number;
};

export type ArenaScoreBreakdown = {
  total: number;
  notebook: number;
  placard: number;
  eligible: boolean;
};

const safeInteger = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function calculateArenaScore(input: ArenaScoreInput): ArenaScoreBreakdown {
  const notebook = Math.min(ARENA_NOTEBOOK_SCORE_CAP, safeInteger(input.notebookSeasonPoints));
  const activity = Math.min(ARENA_PLACARD_ACTIVITY_CAP, safeInteger(input.placardSeasonPoints) * 2);
  const rating = Number.isFinite(input.placardRating) ? input.placardRating : 1000;
  const skill = Math.min(ARENA_PLACARD_SKILL_CAP, Math.max(0, Math.round((rating - 900) / 4)));
  const placard = activity + skill;
  const eligible = safeInteger(input.placardBattles) > 0;

  return { total: eligible ? notebook + placard : 0, notebook, placard, eligible };
}
