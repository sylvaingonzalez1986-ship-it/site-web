export const ARENA_FORMULA_VERSION = "arena-v3-tasting-first";
export const ARENA_POINTS_PER_FLOWER = 100;
export const ARENA_DUEL_REFERENCE_POINTS = 50;

export type ArenaRankingCategory = "tasting" | "duels" | "business";

export type ArenaScoreInput = {
  /** Distinct purchased flowers with an approved review during the season. */
  tastedFlowerCount: number;
  /** Human PvP awards only; bot challenge awards must be removed upstream. */
  duelSeasonPoints: number;
  businessScore?: number;
};

export type ArenaScoreBreakdown = {
  total: number;
  notebook: number;
  placard: number;
  business: number;
  eligible: boolean;
};

const safeNumber = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const roundScore = (value: number) => Math.round(value * 10) / 10;

export function calculateArenaScore(input: ArenaScoreInput): ArenaScoreBreakdown {
  const notebook = Math.floor(safeNumber(input.tastedFlowerCount)) * ARENA_POINTS_PER_FLOWER;
  const placard = roundScore(100 * Math.log2(1 + safeNumber(input.duelSeasonPoints) / ARENA_DUEL_REFERENCE_POINTS));
  const business = roundScore(safeNumber(input.businessScore ?? 0));
  const total = roundScore(notebook + placard + business);
  return { total, notebook, placard, business, eligible: total > 0 };
}
