import { KQ_RETIRED_SUBSTRATE_CODES, isKqRetiredSubstrate, getKqHandCodes, getKqStateHeritage, KQ_CARDS, KQ_HAND_SIZE, KQ_HERITAGE_RESERVE_SIZE, KQ_SITUATIONS, KQ_STAGES, type KqGameState } from "@/lib/kanab-quest-game";
import { isKqHeritageEffect, isKqHeritageTiming } from "@/lib/kanab-quest-heritage";
import { getKqEquipmentDefinition, summarizeKqEquipmentLoadout } from "@/lib/kanab-quest-equipment";
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
    const knownCards = new Set<string>([...KQ_CARDS.map((card) => card.code), ...KQ_RETIRED_SUBSTRATE_CODES]);
    const knownSituations = new Set(KQ_SITUATIONS.map((situation) => situation.code));
    if (!isFiniteNumber(state.seed) || !isFiniteNumber(state.stageIndex) || state.stageIndex < 0 || state.stageIndex >= KQ_STAGES.length) return null;
    if (!phases.includes(String(state.phase)) || !isFiniteNumber(state.xp) || state.xp < 0 || !isFiniteNumber(state.quality)) return null;
    if (state.harvestGrams !== undefined && (!isFiniteNumber(state.harvestGrams) || state.harvestGrams < 20 || state.harvestGrams > 500)) return null;
    if (state.equipmentQualityBonus !== undefined && (!Number.isInteger(state.equipmentQualityBonus) || Number(state.equipmentQualityBonus) < 0 || Number(state.equipmentQualityBonus) > 20)) return null;
    if (state.powerOutage !== undefined && typeof state.powerOutage !== "boolean") return null;
    if (state.harvestLossPercent !== undefined && (!isFiniteNumber(state.harvestLossPercent) || state.harvestLossPercent < 0 || state.harvestLossPercent > 80)) return null;
    if (state.equipment !== undefined) {
      if (!isRecord(state.equipment) || !Array.isArray(state.equipment.codes) || state.equipment.codes.length > 12) return null;
      const equipmentCodes = state.equipment.codes;
      if (equipmentCodes.some((code) => typeof code !== "string" || !getKqEquipmentDefinition(code))) return null;
      if (new Set(equipmentCodes).size !== equipmentCodes.length) return null;
      const levels = state.equipment.levels;
      if (levels !== undefined && (!isRecord(levels) || Object.entries(levels).some(([code, level]) =>
        !equipmentCodes.includes(code) || !Number.isInteger(level) || Number(level) < 1 || Number(level) > 10))) return null;
      const expected = summarizeKqEquipmentLoadout(equipmentCodes as string[], levels as Record<string, number> | undefined);
      for (const field of ["quantityPercent", "qualityMaxBonus", "regularityPercent", "pressureDelta", "powerWatts", "energyDiscountPercent", "processingPrecision", "processingCapacityPercent"] as const) {
        if (state.equipment[field] !== expected[field]) return null;
      }
      if (!Array.isArray(state.equipment.unlocks)) return null;
      if (levels !== undefined ? state.equipment.unlocks.join("|") !== expected.unlocks.join("|")
        : state.equipment.unlocks.some((unlock) => !expected.unlocks.includes(unlock as typeof expected.unlocks[number]))) return null;
    }
    if (typeof state.varietyCode !== "string" || typeof state.varietyName !== "string") return null;
    if (state.challengeDayKey !== undefined && (typeof state.challengeDayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(state.challengeDayKey))) return null;
    if (state.startedAt !== undefined && (typeof state.startedAt !== "string" || Number.isNaN(Date.parse(state.startedAt)))) return null;
    if (state.completedAt !== undefined && (typeof state.completedAt !== "string" || Number.isNaN(Date.parse(state.completedAt)))) return null;
    if (!Array.isArray(state.deckCodes) || state.deckCodes.some((code) => typeof code !== "string" || !knownCards.has(code))) return null;
    if (state.handCodes !== undefined && (!Array.isArray(state.handCodes) || state.handCodes.length > KQ_LEGACY_HAND_SIZE || state.handCodes.some((code) => typeof code !== "string" || !knownCards.has(code)))) return null;
    if (state.heritageReserveCodes !== undefined && (!Array.isArray(state.heritageReserveCodes) || state.heritageReserveCodes.length > KQ_HERITAGE_RESERVE_SIZE || state.heritageReserveCodes.some((code) => typeof code !== "string" || !knownCards.has(code)))) return null;
    if (state.heritageCode !== undefined) {
      if (typeof state.heritageCode !== "string" || !/^HERITAGE-[0-9]{3,6}$/.test(state.heritageCode)) return null;
      if (state.heritageName !== undefined && (typeof state.heritageName !== "string" || state.heritageName.trim().length < 3 || state.heritageName.length > 120)) return null;
      if (state.heritageTiming !== undefined && !isKqHeritageTiming(state.heritageTiming)) return null;
      if (state.heritageEffect !== undefined && !isKqHeritageEffect(state.heritageEffect)) return null;
      if (state.heritageProducerName !== undefined && (typeof state.heritageProducerName !== "string" || state.heritageProducerName.length > 120)) return null;
      if (state.heritageImageUrl !== undefined && (typeof state.heritageImageUrl !== "string" || state.heritageImageUrl.length > 2000)) return null;
      if (!getKqStateHeritage(state as KqGameState)) return null;
    } else if ([state.heritageName, state.heritageTiming, state.heritageEffect, state.heritageProducerName, state.heritageImageUrl]
      .some((value) => value !== undefined)) return null;
    const heritageAllowsThreeRedraws = getKqStateHeritage(state as KqGameState)?.effect === "two-extra-redraws";
    const persistedRedrawLimit = heritageAllowsThreeRedraws ? 3 : 1;
    if (state.handRedrawsUsed !== undefined && (!Number.isInteger(state.handRedrawsUsed) || Number(state.handRedrawsUsed) < 0 || Number(state.handRedrawsUsed) > persistedRedrawLimit)) return null;
    if (state.heritageUsed !== undefined && typeof state.heritageUsed !== "boolean") return null;
    if (state.heritageArmed !== undefined && typeof state.heritageArmed !== "boolean") return null;
    if (!Array.isArray(state.collectionCodes) || state.collectionCodes.some((code) => typeof code !== "string" || !knownCards.has(code))) return null;
    if (!Array.isArray(state.situationCodes) || state.situationCodes.length !== KQ_STAGES.length || state.situationCodes.some((code) => typeof code !== "string" || !knownSituations.has(code))) return null;
    if (!Array.isArray(state.history) || state.history.length > KQ_STAGES.length || !Array.isArray(state.traits) || !Array.isArray(state.combos)) return null;
    if (state.history.some((entry) => {
      if (!isRecord(entry)) return true;
      if (entry.qualityDelta !== undefined && (!Number.isInteger(entry.qualityDelta) || Number(entry.qualityDelta) < -1 || Number(entry.qualityDelta) > 4)) return true;
      if (entry.xpGain !== undefined && (!Number.isInteger(entry.xpGain) || Number(entry.xpGain) < 0 || Number(entry.xpGain) > 20)) return true;
      if (entry.harvestLossPercent !== undefined && (!Number.isInteger(entry.harvestLossPercent) || Number(entry.harvestLossPercent) < 0 || Number(entry.harvestLossPercent) > 35)) return true;
      return false;
    })) return null;
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
      const heritage = getKqStateHeritage(state as KqGameState);
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
      deckCodes: state.deckCodes.filter((code) => !isKqRetiredSubstrate(String(code))),
      collectionCodes: state.collectionCodes.filter((code) => !isKqRetiredSubstrate(String(code))),
      playedThisStage: state.playedThisStage.filter((code) => !isKqRetiredSubstrate(String(code))),
      usedCards: state.usedCards.filter((code) => !isKqRetiredSubstrate(String(code))),
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
    seed: state.seed, varietyCode: state.varietyCode, deckCodes: state.deckCodes, handCodes: getKqHandCodes(state), heritageReserveCodes: state.heritageReserveCodes ?? [], handRedrawsUsed: state.handRedrawsUsed ?? 0, heritageCode: state.heritageCode ?? null, heritageName: state.heritageName ?? null, heritageTiming: state.heritageTiming ?? null, heritageEffect: state.heritageEffect ?? null, heritageProducerName: state.heritageProducerName ?? null, heritageImageUrl: state.heritageImageUrl ?? null, heritageUsed: state.heritageUsed ?? false, situationCodes: state.situationCodes,
    usedCards: state.usedCards, quality: state.quality, xp: state.xp, pressure: state.pressure, traits: state.traits, combos: state.combos, bonusDie: state.bonusDie ?? null, effectNotices: state.effectNotices ?? [],
    equipmentCodes: state.equipment?.codes ?? [], equipmentQualityBonus: state.equipmentQualityBonus ?? 0, harvestGrams: state.harvestGrams ?? null,
    powerOutage: state.powerOutage ?? false, harvestLossPercent: state.harvestLossPercent ?? 0,
    history: state.history.map((entry) => ({ stage: entry.stage, dice: entry.dice, total: entry.total, target: entry.target, outcome: entry.outcome, trait: entry.trait, dangers: entry.dangers, sparks: entry.sparks, pressureAfter: entry.pressureAfter, qualityDelta: entry.qualityDelta, xpGain: entry.xpGain, harvestLossPercent: entry.harvestLossPercent })),
  });
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `KQ-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}
