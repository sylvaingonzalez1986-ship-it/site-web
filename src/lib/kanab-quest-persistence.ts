import { getKqHandCodes, KQ_CARDS, KQ_HAND_SIZE, KQ_HERITAGE_RESERVE_SIZE, KQ_SITUATIONS, KQ_STAGES, type KqGameState } from "@/lib/kanab-quest-game";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";
import type { KqBattle } from "@/lib/kanab-quest-battle";
import type { KqRankProfile } from "@/lib/kanab-quest-ranking";

type SaveEnvelope<T> = { version: 1; payload: T };
const KQ_LEGACY_HAND_SIZE = 10;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function encodeKqSave<T>(payload: T) {
  return JSON.stringify({ version: 1, payload } satisfies SaveEnvelope<T>);
}

export function parseKqGameSave(raw: string | null): KqGameState | null {
  if (!raw) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isRecord(envelope) || envelope.version !== 1 || !isRecord(envelope.payload)) return null;
    const state = envelope.payload;
    const phases = ["prepare", "rolled", "resolved", "complete"];
    const knownCards = new Set(KQ_CARDS.map((card) => card.code));
    const knownSituations = new Set(KQ_SITUATIONS.map((situation) => situation.code));
    if (!isFiniteNumber(state.seed) || !isFiniteNumber(state.stageIndex) || state.stageIndex < 0 || state.stageIndex >= KQ_STAGES.length) return null;
    if (!phases.includes(String(state.phase)) || !isFiniteNumber(state.xp) || state.xp < 0 || !isFiniteNumber(state.quality)) return null;
    if (typeof state.varietyCode !== "string" || typeof state.varietyName !== "string") return null;
    if (state.challengeDayKey !== undefined && (typeof state.challengeDayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(state.challengeDayKey))) return null;
    if (state.startedAt !== undefined && (typeof state.startedAt !== "string" || Number.isNaN(Date.parse(state.startedAt)))) return null;
    if (state.completedAt !== undefined && (typeof state.completedAt !== "string" || Number.isNaN(Date.parse(state.completedAt)))) return null;
    if (!Array.isArray(state.deckCodes) || state.deckCodes.some((code) => typeof code !== "string" || !knownCards.has(code))) return null;
    if (state.handCodes !== undefined && (!Array.isArray(state.handCodes) || state.handCodes.length > KQ_LEGACY_HAND_SIZE || state.handCodes.some((code) => typeof code !== "string" || !knownCards.has(code)))) return null;
    if (state.heritageReserveCodes !== undefined && (!Array.isArray(state.heritageReserveCodes) || state.heritageReserveCodes.length > KQ_HERITAGE_RESERVE_SIZE || state.heritageReserveCodes.some((code) => typeof code !== "string" || !knownCards.has(code)))) return null;
    const heritageAllowsThreeRedraws = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode)?.effect === "two-extra-redraws";
    const persistedRedrawLimit = heritageAllowsThreeRedraws ? 3 : 1;
    if (state.handRedrawsUsed !== undefined && (!Number.isInteger(state.handRedrawsUsed) || Number(state.handRedrawsUsed) < 0 || Number(state.handRedrawsUsed) > persistedRedrawLimit)) return null;
    if (state.heritageCode !== undefined && (typeof state.heritageCode !== "string" || !KQ_HERITAGE_CARDS.some((card) => card.code === state.heritageCode))) return null;
    if (state.heritageUsed !== undefined && typeof state.heritageUsed !== "boolean") return null;
    if (state.heritageArmed !== undefined && typeof state.heritageArmed !== "boolean") return null;
    if (!Array.isArray(state.collectionCodes) || state.collectionCodes.some((code) => typeof code !== "string" || !knownCards.has(code))) return null;
    if (!Array.isArray(state.situationCodes) || state.situationCodes.length !== KQ_STAGES.length || state.situationCodes.some((code) => typeof code !== "string" || !knownSituations.has(code))) return null;
    if (!Array.isArray(state.history) || state.history.length > KQ_STAGES.length || !Array.isArray(state.traits) || !Array.isArray(state.combos)) return null;
    if (!Array.isArray(state.usedCards) || !Array.isArray(state.playedThisStage) || state.usedCards.some((code) => typeof code !== "string" || !knownCards.has(code)) || state.playedThisStage.some((code) => typeof code !== "string" || !knownCards.has(code))) return null;
    const expectedHistoryLength = state.phase === "complete" ? KQ_STAGES.length : Number(state.stageIndex) + (state.phase === "resolved" ? 1 : 0);
    if (state.history.length !== expectedHistoryLength) return null;
    const deckCounts = (state.deckCodes as string[]).reduce<Record<string, number>>((counts, code) => ({ ...counts, [code]: (counts[code] ?? 0) + 1 }), {});
    const usedCounts = (state.usedCards as string[]).reduce<Record<string, number>>((counts, code) => ({ ...counts, [code]: (counts[code] ?? 0) + 1 }), {});
    const collectionCodes = state.collectionCodes as string[];
    if (Object.entries(usedCounts).some(([code, count]) => {
      const card = KQ_CARDS.find((item) => item.code === code);
      return card?.category === "pbi" ? !collectionCodes.includes(code) : count > (deckCounts[code] ?? 0);
    })) return null;
    if (state.handCodes !== undefined && state.handCodes.some((code) => {
      const card = KQ_CARDS.find((item) => item.code === code);
      return !card || card.category === "substrate" || card.category === "pbi" || (deckCounts[code] ?? 0) <= 0;
    })) return null;
    if (state.heritageReserveCodes !== undefined) {
      const heritage = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode);
      if (heritage?.effect !== "opening-hand-reserve" || state.stageIndex !== 0 || state.heritageUsed === true) return null;
      if (state.heritageReserveCodes.some((code) => {
        const card = KQ_CARDS.find((item) => item.code === code);
        return !card || card.category === "substrate" || card.category === "pbi" || (deckCounts[code] ?? 0) <= 0;
      })) return null;
    }
    if (state.dice !== null && (!Array.isArray(state.dice) || state.dice.length !== 3 || state.dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6))) return null;
    if (state.bonusDie !== undefined && state.bonusDie !== null && (!Number.isInteger(state.bonusDie) || Number(state.bonusDie) < 1 || Number(state.bonusDie) > 6)) return null;
    if (state.effectNotices !== undefined && (!Array.isArray(state.effectNotices) || state.effectNotices.length > 12 || state.effectNotices.some((notice) => typeof notice !== "string" || notice.length > 240))) return null;
    if (!isFiniteNumber(state.pressure) || state.pressure < 0 || state.pressure > 4 || !isFiniteNumber(state.cancelledDangers) || state.cancelledDangers < 0) return null;
    if (typeof state.preparationPlayed !== "boolean" || typeof state.reactionPlayed !== "boolean") return null;
    return {
      ...state,
      ...(Array.isArray(state.handCodes) && state.handCodes.length > KQ_HAND_SIZE
        ? { handCodes: state.handCodes.slice(0, KQ_HAND_SIZE) }
        : {}),
    } as unknown as KqGameState;
  } catch {
    return null;
  }
}

export function parseKqBattleSave(raw: string | null): KqBattle | null {
  if (!raw) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isRecord(envelope) || envelope.version !== 1 || !isRecord(envelope.payload)) return null;
    const battle = envelope.payload;
    if (battle.status !== "locked" && battle.status !== "verdict") return null;
    if (!isRecord(battle.playerFlower) || !isRecord(battle.opponentFlower) || !isFiniteNumber(battle.opponentRating)) return null;
    if (!Array.isArray(battle.rounds) || typeof battle.id !== "string") return null;
    if (battle.status === "locked" && (battle.playerFlower.status !== "locked" || battle.opponentFlower.status !== "locked" || battle.burnedAt !== null)) return null;
    if (battle.status === "verdict" && (battle.playerFlower.status !== "burned" || battle.opponentFlower.status !== "burned" || battle.rounds.length !== 3 || typeof battle.burnedAt !== "string")) return null;
    return battle as unknown as KqBattle;
  } catch {
    return null;
  }
}

export function parseKqRankSave(raw: string | null): KqRankProfile | null {
  if (!raw) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isRecord(envelope) || envelope.version !== 1 || !isRecord(envelope.payload)) return null;
    const profile = envelope.payload;
    if (typeof profile.playerId !== "string" || typeof profile.name !== "string") return null;
    for (const field of ["rating", "seasonPoints", "wins", "losses", "streak", "burnedFlowers"] as const) {
      if (!isFiniteNumber(profile[field]) || profile[field] < 0) return null;
    }
    if (!Array.isArray(profile.processedBattleIds) || profile.processedBattleIds.some((id) => typeof id !== "string")) return null;
    if (new Set(profile.processedBattleIds).size !== profile.processedBattleIds.length) return null;
    if (!Array.isArray(profile.claimedChallengeCodes) || profile.claimedChallengeCodes.some((code) => typeof code !== "string")) return null;
    if (new Set(profile.claimedChallengeCodes).size !== profile.claimedChallengeCodes.length) return null;
    if (profile.lastClaimedChallengeCodes !== undefined && (!Array.isArray(profile.lastClaimedChallengeCodes) || profile.lastClaimedChallengeCodes.some((code) => typeof code !== "string"))) return null;
    if (profile.claimedArenaRewardKeys !== undefined && (!Array.isArray(profile.claimedArenaRewardKeys) || profile.claimedArenaRewardKeys.some((key) => typeof key !== "string"))) return null;
    if (profile.lastArenaRewardCards !== undefined && (!Array.isArray(profile.lastArenaRewardCards) || profile.lastArenaRewardCards.some((code) => typeof code !== "string" || !/^BOTTE-\d{3}$/.test(code)))) return null;
    return {
      ...profile,
      lastRatingDelta: isFiniteNumber(profile.lastRatingDelta) ? profile.lastRatingDelta : 0,
      lastSeasonPointsDelta: isFiniteNumber(profile.lastSeasonPointsDelta) ? profile.lastSeasonPointsDelta : 0,
      lastClaimedChallengeCodes: Array.isArray(profile.lastClaimedChallengeCodes) ? profile.lastClaimedChallengeCodes : [],
      claimedArenaRewardKeys: Array.isArray(profile.claimedArenaRewardKeys) ? profile.claimedArenaRewardKeys : [],
      lastArenaRewardCards: Array.isArray(profile.lastArenaRewardCards) ? profile.lastArenaRewardCards : [],
    } as unknown as KqRankProfile;
  } catch {
    return null;
  }
}

export function createKqIntegrityCode(state: KqGameState) {
  const canonical = JSON.stringify({
    seed: state.seed, varietyCode: state.varietyCode, deckCodes: state.deckCodes, handCodes: getKqHandCodes(state), heritageReserveCodes: state.heritageReserveCodes ?? [], handRedrawsUsed: state.handRedrawsUsed ?? 0, heritageCode: state.heritageCode ?? null, heritageUsed: state.heritageUsed ?? false, situationCodes: state.situationCodes,
    usedCards: state.usedCards, quality: state.quality, xp: state.xp, pressure: state.pressure, traits: state.traits, combos: state.combos, bonusDie: state.bonusDie ?? null, effectNotices: state.effectNotices ?? [],
    history: state.history.map((entry) => ({ stage: entry.stage, dice: entry.dice, total: entry.total, target: entry.target, outcome: entry.outcome, trait: entry.trait, dangers: entry.dangers, sparks: entry.sparks, pressureAfter: entry.pressureAfter })),
  });
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `KQ-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}
