import { ARENA_FORMULA_VERSION } from "@/lib/arena-ranking";

export const ARENA_CUSTOMER_REWARD_RATE_BPS = 100;
export const ARENA_CUSTOMER_REWARD_MIN_BATTLES = 3;
export const ARENA_CUSTOMER_REWARD_TOP_SIZE = 10;

export const ARENA_CUSTOMER_REWARD_DICE_RATES = [
  { diceResult: "1–2", rateBps: 100, ratePercent: 1 },
  { diceResult: "3", rateBps: 400, ratePercent: 4 },
  { diceResult: "4", rateBps: 700, ratePercent: 7 },
  { diceResult: "5–6", rateBps: 1_000, ratePercent: 10 },
] as const;

/**
 * The collective average is rounded to the nearest face, then translated to
 * one of the four public weekly rates. An empty week starts at the 1% floor.
 */
export function getArenaCustomerRewardRateBps(diceAverage: number | null | undefined) {
  if (!Number.isFinite(diceAverage)) return 100;
  if (Number(diceAverage) < 2.5) return 100;
  if (Number(diceAverage) < 3.5) return 400;
  if (Number(diceAverage) < 4.5) return 700;
  return 1_000;
}

export type ArenaCustomerRewardSlot = {
  code: string;
  kind: "ranking" | "surprise";
  rewardRank: number | null;
  shareBps: number;
  label: string;
};

export const ARENA_CUSTOMER_REWARD_SLOTS: readonly ArenaCustomerRewardSlot[] = [
  { code: "rank-1", kind: "ranking", rewardRank: 1, shareBps: 2_700, label: "1re place" },
  { code: "rank-2", kind: "ranking", rewardRank: 2, shareBps: 1_800, label: "2e place" },
  { code: "rank-3", kind: "ranking", rewardRank: 3, shareBps: 1_350, label: "3e place" },
  { code: "rank-4", kind: "ranking", rewardRank: 4, shareBps: 675, label: "4e place" },
  { code: "rank-5", kind: "ranking", rewardRank: 5, shareBps: 675, label: "5e place" },
  { code: "rank-6", kind: "ranking", rewardRank: 6, shareBps: 360, label: "6e place" },
  { code: "rank-7", kind: "ranking", rewardRank: 7, shareBps: 360, label: "7e place" },
  { code: "rank-8", kind: "ranking", rewardRank: 8, shareBps: 360, label: "8e place" },
  { code: "rank-9", kind: "ranking", rewardRank: 9, shareBps: 360, label: "9e place" },
  { code: "rank-10", kind: "ranking", rewardRank: 10, shareBps: 360, label: "10e place" },
  { code: "surprise", kind: "surprise", rewardRank: null, shareBps: 1_000, label: "La Fleur Surprise" },
] as const;

export type ArenaCustomerRewardStanding = {
  playerId: string;
  leaderboardRank: number;
  pseudo: string;
  score: number;
  rating: number;
  wins: number;
  losses: number;
  tastedFlowerCount?: number;
  rankingFormulaVersion?: string;
};

export type ArenaCustomerRewardProjection = {
  wholePoolGrams: number;
  carriedGrams: number;
  rankingPoolGrams: number;
  surprisePoolGrams: number;
  slots: Array<ArenaCustomerRewardSlot & { grams: number }>;
};

function safePoolDecigrams(poolGrams: number) {
  if (!Number.isFinite(poolGrams) || poolGrams <= 0) return 0;
  return Math.max(0, Math.floor((poolGrams + Number.EPSILON) * 10));
}

/**
 * Allocates every whole gram with the largest-remainder method. Keeping the
 * public percentages in basis points makes the result stable and auditable.
 */
export function projectArenaCustomerRewardPool(poolGrams: number): ArenaCustomerRewardProjection {
  const poolDecigrams = safePoolDecigrams(poolGrams);
  const wholePoolGrams = Math.floor(poolDecigrams / 10);
  const carriedGrams = Number(((poolDecigrams % 10) / 10).toFixed(1));
  const allocations = ARENA_CUSTOMER_REWARD_SLOTS.map((slot, index) => {
    const numerator = wholePoolGrams * slot.shareBps;
    return {
      ...slot,
      index,
      grams: Math.floor(numerator / 10_000),
      remainder: numerator % 10_000,
    };
  });
  let gramsLeft = wholePoolGrams - allocations.reduce((sum, slot) => sum + slot.grams, 0);
  const remainderOrder = [...allocations].sort((left, right) =>
    right.remainder - left.remainder || left.index - right.index,
  );
  for (const slot of remainderOrder) {
    if (gramsLeft <= 0) break;
    slot.grams += 1;
    gramsLeft -= 1;
  }
  const slots = allocations.map((slot) => ({
    code: slot.code,
    kind: slot.kind,
    rewardRank: slot.rewardRank,
    shareBps: slot.shareBps,
    label: slot.label,
    grams: slot.grams,
  }));
  return {
    wholePoolGrams,
    carriedGrams,
    rankingPoolGrams: slots.filter((slot) => slot.kind === "ranking").reduce((sum, slot) => sum + slot.grams, 0),
    surprisePoolGrams: slots.find((slot) => slot.kind === "surprise")?.grams ?? 0,
    slots,
  };
}

export function isArenaCustomerRewardEligible(
  standing: Pick<ArenaCustomerRewardStanding, "playerId" | "wins" | "losses" | "tastedFlowerCount" | "rankingFormulaVersion">,
  minBattles = ARENA_CUSTOMER_REWARD_MIN_BATTLES,
) {
  return standing.playerId.trim().length > 0 && (
    standing.wins + standing.losses >= Math.max(0, Math.floor(minBattles))
    || standing.rankingFormulaVersion === ARENA_FORMULA_VERSION && (standing.tastedFlowerCount ?? 0) >= 1
  );
}

export function buildArenaCustomerRewardPreview(
  poolGrams: number,
  standings: ArenaCustomerRewardStanding[],
  minBattles = ARENA_CUSTOMER_REWARD_MIN_BATTLES,
) {
  const projection = projectArenaCustomerRewardPool(poolGrams);
  const seenPlayers = new Set<string>();
  const uniqueStandings = [...standings]
    .filter((standing) => {
      if (seenPlayers.has(standing.playerId) || !standing.playerId.trim()) return false;
      seenPlayers.add(standing.playerId);
      return true;
    })
    .sort((left, right) => left.leaderboardRank - right.leaderboardRank || (left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0));
  const eligibleStandings = uniqueStandings.filter((standing) => isArenaCustomerRewardEligible(standing, minBattles));
  const rankingSlots = projection.slots.filter((slot) => slot.kind === "ranking");
  const tieGroups = new Map<number, ArenaCustomerRewardStanding[]>();
  for (const standing of uniqueStandings) {
    const group = tieGroups.get(standing.leaderboardRank) ?? [];
    group.push(standing);
    tieGroups.set(standing.leaderboardRank, group);
  }
  const tieIndexes = new Map(uniqueStandings.map((standing) => [standing.playerId, 0]));
  let previousOccupiedRank = 0;
  for (const [rank, group] of tieGroups) {
    if (group.some(standing => standing.rankingFormulaVersion === ARENA_FORMULA_VERSION)) {
      if (!Number.isInteger(rank) || rank <= previousOccupiedRank) throw new Error("Overlapping customer reward ranking positions");
      previousOccupiedRank = rank + group.length - 1;
    }
    group.forEach((standing, index) => tieIndexes.set(standing.playerId, index));
  }
  const rankingWinners = eligibleStandings
    .filter((standing) => standing.leaderboardRank >= 1 && standing.leaderboardRank <= ARENA_CUSTOMER_REWARD_TOP_SIZE)
    .map((standing) => {
      const slot = rankingSlots.find((candidate) => candidate.rewardRank === standing.leaderboardRank);
      if (!slot) throw new Error(`Missing customer reward slot for rank ${standing.leaderboardRank}`);
      // Ineligible members still occupy their tied places and retain their
      // unissued share. The remaining players must never inherit that share.
      const tied = standing.rankingFormulaVersion === ARENA_FORMULA_VERSION
        ? tieGroups.get(standing.leaderboardRank)!
        : [standing];
      const occupiedThroughRank = standing.leaderboardRank + tied.length - 1;
      const groupSlots = rankingSlots.filter((candidate) => candidate.rewardRank! >= standing.leaderboardRank && candidate.rewardRank! <= occupiedThroughRank);
      const groupGrams = groupSlots.reduce((sum, candidate) => sum + candidate.grams, 0);
      const groupShareBps = groupSlots.reduce((sum, candidate) => sum + candidate.shareBps, 0);
      const index = standing.rankingFormulaVersion === ARENA_FORMULA_VERSION ? tieIndexes.get(standing.playerId)! : 0;
      return {
        ...standing,
        rewardRank: standing.leaderboardRank,
        slotCode: slot.code,
        shareBps: Number((groupShareBps / tied.length).toFixed(8)),
        grams: Math.floor(groupGrams / tied.length) + (index < groupGrams % tied.length ? 1 : 0),
        tiedPlayers: tied.length,
        occupiedThroughRank,
      };
    });
  const surpriseCandidates = eligibleStandings.filter(
    (standing) => standing.leaderboardRank > ARENA_CUSTOMER_REWARD_TOP_SIZE,
  );
  return {
    ...projection,
    minBattles,
    eligiblePlayers: eligibleStandings.length,
    rankingWinners,
    surpriseCandidates,
  };
}

export function pickArenaSurpriseCandidate<T>(candidates: readonly T[], randomIndex: number): T | null {
  if (!Number.isInteger(randomIndex) || randomIndex < 0 || randomIndex >= candidates.length) return null;
  return candidates[randomIndex] ?? null;
}
