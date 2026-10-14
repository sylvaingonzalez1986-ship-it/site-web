import { isKqEnergyQuoteValid } from "@/lib/kanab-quest-energy";
import { KQ_RETIRED_SUBSTRATE_CODES, isKqRetiredSubstrate, getKqHandCodes, getKqStateHeritage, getKqBuildingHarvestLosses, getKqBuildingLossAverage, getKqBuildingIncidentLosses, KQ_CARDS, KQ_HAND_SIZE, KQ_HERITAGE_RESERVE_SIZE, KQ_SITUATIONS, KQ_STAGES, type KqGameState, type KqSharedEquipmentRunProfile } from "@/lib/kanab-quest-game";
import { isKqHeritageEffect, isKqHeritageTiming } from "@/lib/kanab-quest-heritage";
import { getKqEquipmentDefinition, isKqProcessingEquipment, summarizeKqEquipmentLoadout } from "@/lib/kanab-quest-equipment";
import type { KqBattle } from "@/lib/kanab-quest-battle";
import type { KqRankProfile } from "@/lib/kanab-quest-ranking";
import { getKqProductionUnits, type KqTentEquipmentProfile } from "./kanab-quest-production-scale";
import { areKqBuildingServicesConsistent, summarizeKqTentEquipment } from "./kanab-quest-production";
import { isKqStageDecision } from "./kanab-quest-culture-analysis";
import { isKqCareState, isKqCareReplacedCard } from "./kanab-quest-care";
import { isKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { isKqWarehouseEnergyQuote } from "./kanab-quest-warehouse-run";
import { applyKqBuddieYield, isKqBuddieCultivationProfile } from "./kanab-quest-buddie-cultivation";
import { isKqCampaign } from "./kanab-quest-campaign";

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
    if (state.warehouse !== undefined && !isKqWarehouseRunSnapshot(state.warehouse)) return null;
    const warehouse = isKqWarehouseRunSnapshot(state.warehouse) ? state.warehouse : undefined;
    if (warehouse && (warehouse.activeAreaM2 <= 0 || !isRecord(state.equipment)
      || !Array.isArray(state.equipment.codes) || state.equipment.codes.length !== 0
      || state.equipment.productionUnits !== undefined || state.equipment.tents !== undefined
      || state.equipment.shared !== undefined || state.equipment.scope !== undefined)) return null;
    const buildingScope = isRecord(state.equipment) && state.equipment.scope === "building";
    if (state.rulesVersion !== undefined && state.rulesVersion !== 2 && state.rulesVersion !== 3) return null;
    const healthRules = state.rulesVersion === 3;
    if (healthRules ? !isKqCareState(state.care) : state.care !== undefined) return null;
    if (state.cultivationProfile !== undefined && (!healthRules || !isKqBuddieCultivationProfile(state.cultivationProfile)
      || state.cultivationProfile.buddieCode !== state.varietyCode)) return null;
    if (state.campaign !== undefined) {
      if (!isKqCampaign(state.campaign) || warehouse?.version !== 2 || !state.cultivationProfile) return null;
      const member = state.campaign.members.find(item => item.zoneId === warehouse.zoneId);
      if (!member || member.buddieCode !== state.varietyCode
        || JSON.stringify(member.cultivationProfile) !== JSON.stringify(state.cultivationProfile)
        || JSON.stringify(member.warehouse) !== JSON.stringify(warehouse)) return null;
    }
    if (state.domiciliation !== undefined && state.domiciliation !== "home" && state.domiciliation !== "external") return null;
    const phases = ["prepare", "rolled", "resolved", "complete"];
    const knownCards = new Set<string>([...KQ_CARDS.map((card) => card.code), ...KQ_RETIRED_SUBSTRATE_CODES]);
    const knownSituations = new Set(KQ_SITUATIONS.map((situation) => situation.code));
    if (!isFiniteNumber(state.seed) || !isFiniteNumber(state.stageIndex) || state.stageIndex < 0 || state.stageIndex >= KQ_STAGES.length) return null;
    if (!phases.includes(String(state.phase)) || !isFiniteNumber(state.xp) || state.xp < 0 || !isFiniteNumber(state.quality)) return null;
    if (state.cultureDead !== undefined && typeof state.cultureDead !== "boolean") return null;
    if (state.firstCultureRescue !== undefined && typeof state.firstCultureRescue !== "boolean") return null;
    const cultureDead = state.cultureDead === true;
    const requestedUnits = isRecord(state.equipment) ? state.equipment.productionUnits : undefined;
    if (requestedUnits !== undefined && (typeof requestedUnits !== "number" || getKqProductionUnits(requestedUnits) !== requestedUnits)) return null;
    const productionUnits = getKqProductionUnits(requestedUnits as number | undefined);
    if (cultureDead && (state.phase !== "complete" || state.harvestGrams !== 0 || state.equipmentQualityBonus !== 0)) return null;
    if (state.harvestGrams !== undefined && (!isFiniteNumber(state.harvestGrams) || state.harvestGrams < (cultureDead || healthRules || warehouse ? 0 : 20 * productionUnits) || state.harvestGrams > (warehouse?.estimatedHarvestGrams ?? 500 * productionUnits))) return null;
    if (warehouse && isKqBuddieCultivationProfile(state.cultivationProfile) && isFiniteNumber(state.harvestGrams)
      && state.harvestGrams > applyKqBuddieYield(warehouse.estimatedHarvestGrams, state.cultivationProfile)) return null;
    if (state.equipmentQualityBonus !== undefined && (!Number.isInteger(state.equipmentQualityBonus) || Number(state.equipmentQualityBonus) < 0 || Number(state.equipmentQualityBonus) > 20)) return null;
    if (state.powerOutage !== undefined && typeof state.powerOutage !== "boolean") return null;
    if (state.harvestLossPercent !== undefined && (!isFiniteNumber(state.harvestLossPercent) || state.harvestLossPercent < 0 || state.harvestLossPercent > 80)) return null;
    if (state.equipment !== undefined) {
      if (!isRecord(state.equipment) || !Array.isArray(state.equipment.codes) || state.equipment.codes.length > 12) return null;
      const scope = state.equipment.scope;
      if (scope !== undefined && scope !== "installation" && scope !== "tent" && scope !== "building") return null;
      const equipmentCodes = state.equipment.codes;
      if (equipmentCodes.some((code) => typeof code !== "string" || !getKqEquipmentDefinition(code))) return null;
      if (new Set(equipmentCodes).size !== equipmentCodes.length) return null;
      const levels = state.equipment.levels;
      if (levels !== undefined && (!isRecord(levels) || Object.entries(levels).some(([code, level]) =>
        !equipmentCodes.includes(code) || !Number.isInteger(level) || Number(level) < 1 || Number(level) > 10))) return null;
      const shared = state.equipment.shared;
      if (shared !== undefined) {
        if (!isRecord(shared) || !Array.isArray(shared.codes) || shared.codes.length > 6
          || new Set(shared.codes).size !== shared.codes.length
          || shared.codes.some(code => typeof code !== "string" || !isKqProcessingEquipment(code))) return null;
        if (new Set(shared.codes.map(code => getKqEquipmentDefinition(String(code))?.slot)).size !== shared.codes.length) return null;
        if (!isRecord(shared.levels) || Object.entries(shared.levels).some(([code, level]) =>
          !(shared.codes as unknown[]).includes(code) || !Number.isInteger(level) || Number(level) < 1 || Number(level) > 10)
          || shared.codes.some(code => !Object.hasOwn(shared.levels as object, code))) return null;
        if (equipmentCodes.some(code => isKqProcessingEquipment(String(code)))) return null;
      }
      const tents = state.equipment.tents;
      if (tents !== undefined) {
        if (!Array.isArray(tents) || tents.length !== productionUnits) return null;
        const numbers = new Set<number>();
        for (const tent of tents) {
          if (!isRecord(tent) || !Number.isInteger(tent.tentNumber) || Number(tent.tentNumber) < 1 || Number(tent.tentNumber) > productionUnits) return null;
          if (numbers.has(Number(tent.tentNumber))) return null;
          numbers.add(Number(tent.tentNumber));
          if (!Array.isArray(tent.codes) || tent.codes.length > 12 || new Set(tent.codes).size !== tent.codes.length
            || tent.codes.some(code => typeof code !== "string" || !getKqEquipmentDefinition(code))) return null;
          if (shared !== undefined && tent.codes.some(code => isKqProcessingEquipment(String(code)))) return null;
          if (!isRecord(tent.levels) || Object.entries(tent.levels).some(([code, level]) =>
            !(tent.codes as unknown[]).includes(code) || !Number.isInteger(level) || Number(level) < 1 || Number(level) > 10)) return null;
          if (tent.codes.some(code => !Object.hasOwn(tent.levels as object, code))) return null;
        }
        const first = (tents as KqTentEquipmentProfile[]).find(tent => tent.tentNumber === 1)!;
        if (equipmentCodes.join("|") !== first.codes.join("|") || !isRecord(levels)
          || equipmentCodes.some(code => levels[String(code)] !== first.levels[String(code)])) return null;
      }
      if ((scope === "tent" || scope === "building") && (!Array.isArray(tents) || shared === undefined)) return null;
      if (scope === "building" && !areKqBuildingServicesConsistent(tents as KqTentEquipmentProfile[])) return null;
      if (scope === "installation") {
        if (!Array.isArray(tents) || shared === undefined || !isRecord(levels)) return null;
        if ((tents as KqTentEquipmentProfile[]).some(tent => tent.codes.length !== equipmentCodes.length
          || tent.codes.some(code => !equipmentCodes.includes(code) || tent.levels[code] !== levels[code]))) return null;
      }
      const expected = tents === undefined && shared === undefined
        ? summarizeKqEquipmentLoadout(equipmentCodes as string[], levels as Record<string, number> | undefined)
        : summarizeKqTentEquipment(
          (tents ?? [{ tentNumber: 1, codes: equipmentCodes, levels: levels ?? {} }]) as KqTentEquipmentProfile[],
          shared as KqSharedEquipmentRunProfile | undefined, scope,
        );
      for (const field of ["quantityPercent", "qualityMaxBonus", "regularityPercent", "pressureDelta", "powerWatts", "energyDiscountPercent", "processingPrecision", "processingCapacityPercent"] as const) {
        if (state.equipment[field] !== expected[field]) return null;
      }
      if (!Array.isArray(state.equipment.unlocks)) return null;
      if (levels !== undefined ? state.equipment.unlocks.join("|") !== expected.unlocks.join("|")
        : state.equipment.unlocks.some((unlock) => !expected.unlocks.includes(unlock as typeof expected.unlocks[number]))) return null;
    }
    if (warehouse ? !isKqWarehouseEnergyQuote(state.energy, warehouse)
      : state.energy !== undefined && (!isRecord(state.equipment) || !isKqEnergyQuoteValid(state.energy, state.equipment.codes as string[], state.equipment.levels as Record<string, number> | undefined, productionUnits, state.equipment.tents as KqTentEquipmentProfile[] | undefined, state.equipment.scope as "installation" | "tent" | "building" | undefined))) return null;
    if (typeof state.varietyCode !== "string" || typeof state.varietyName !== "string") return null;
    if (state.challengeDayKey !== undefined && (typeof state.challengeDayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(state.challengeDayKey))) return null;
    if (state.startedAt !== undefined && (typeof state.startedAt !== "string" || Number.isNaN(Date.parse(state.startedAt)))) return null;
    if (state.completedAt !== undefined && (typeof state.completedAt !== "string" || Number.isNaN(Date.parse(state.completedAt)))) return null;
    if (!Array.isArray(state.deckCodes) || state.deckCodes.some((code) => typeof code !== "string" || !knownCards.has(code))) return null;
    if (healthRules && state.deckCodes.some(code => isKqCareReplacedCard(String(code)))) return null;
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
      if (entry.rescued !== undefined && typeof entry.rescued !== "boolean") return true;
      if (entry.qualityDelta !== undefined && (!Number.isInteger(entry.qualityDelta) || Number(entry.qualityDelta) < -1 || Number(entry.qualityDelta) > 6)) return true;
      if (entry.xpGain !== undefined && (!Number.isInteger(entry.xpGain) || Number(entry.xpGain) < 0 || Number(entry.xpGain) > 20)) return true;
      if (entry.harvestLossPercent !== undefined && (!isFiniteNumber(entry.harvestLossPercent) || Number(entry.harvestLossPercent) < 0 || Number(entry.harvestLossPercent) > 35
        || (!buildingScope && !Number.isInteger(entry.harvestLossPercent)))) return true;
      return false;
    })) return null;
    if (buildingScope) {
      if (state.powerOutage !== false) return null;
      const current = state as unknown as KqGameState;
      for (let index = 0; index < current.history.length; index++) {
        const entry = current.history[index];
        const situation = KQ_SITUATIONS.find(item => item.code === current.situationCodes[index]);
        // New building journals always include the decision needed to verify a
        // local protection. Historical scopes keep their optional explanations.
        if (!situation || !isKqStageDecision(entry.decision) || !isRecord(entry.buildingHarvestLosses) || Array.isArray(entry.buildingHarvestLosses)) return null;
        const before = { ...current, history: current.history.slice(0, index), playedThisStage: entry.decision.playedThisStage };
        const expected = getKqBuildingIncidentLosses(before, situation, entry.outcome);
        if (Object.keys(entry.buildingHarvestLosses).length !== Object.keys(expected).length
          || Object.entries(expected).some(([building, loss]) => entry.buildingHarvestLosses?.[building] !== loss)) return null;
        const previous = getKqBuildingLossAverage(before, getKqBuildingHarvestLosses(before));
        const after = { ...before, history: current.history.slice(0, index + 1) };
        const next = getKqBuildingLossAverage(after, getKqBuildingHarvestLosses(after));
        if (entry.decision.harvestLossPercent !== previous || entry.decision.powerOutage !== false
          || entry.harvestLossPercent !== Math.round((next - previous) * 100) / 100) return null;
      }
      if (state.harvestLossPercent !== getKqBuildingLossAverage(current, getKqBuildingHarvestLosses(current))) return null;
    } else if (state.history.some(entry => entry.buildingHarvestLosses !== undefined)) return null;
    let zeroSuccessStages = 0;
    let rescuedStages = 0;
    for (const entry of state.history) {
      const unsuccessfulZero = entry.total === 0 && entry.outcome !== "success" && entry.outcome !== "critical";
      if (unsuccessfulZero) zeroSuccessStages += 1;
      if (entry.rescued === true) {
        rescuedStages += 1;
        if (state.firstCultureRescue !== true || (!healthRules && (!unsuccessfulZero || zeroSuccessStages !== 2)) || rescuedStages > 1) return null;
      }
    }
    if (!healthRules && state.firstCultureRescue === true && zeroSuccessStages >= 2 && rescuedStages !== 1) return null;
    const unrescuedZeroStages = zeroSuccessStages - rescuedStages;
    if (!healthRules && state.firstCultureRescue === true && !cultureDead && unrescuedZeroStages >= 2) return null;
    if (!Array.isArray(state.usedCards) || !Array.isArray(state.playedThisStage) || state.usedCards.some((code) => typeof code !== "string" || !knownCards.has(code)) || state.playedThisStage.some((code) => typeof code !== "string" || !knownCards.has(code))) return null;
    if (state.usedCards.filter(code => KQ_CARDS.find(card => card.code === code)?.rarity === "epic").length > 1) return null;
    if (!healthRules && cultureDead && unrescuedZeroStages < 2) return null;
    if (healthRules && isKqCareState(state.care)) {
      if (cultureDead !== (state.care.vitality === 0)) return null;
      const latestAllowed = Number(state.stageIndex) + Number(state.phase === "resolved");
      if (state.care.applications.some(item => item.stageIndex > latestAllowed)
        || state.care.problems.some(item => item.appearedAt > Number(state.stageIndex))
        || state.care.history.some(item => item.stageIndex > latestAllowed)
        || (state.care.lastBasicCareStage !== null && state.care.lastBasicCareStage > latestAllowed)) return null;
      if (state.usedCards.some(code => isKqCareReplacedCard(String(code))) || state.playedThisStage.some(code => isKqCareReplacedCard(String(code)))) return null;
    }
    const expectedHistoryLength = cultureDead ? Number(state.stageIndex) + 1
      : state.phase === "complete" ? KQ_STAGES.length : Number(state.stageIndex) + (state.phase === "resolved" ? 1 : 0);
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
      // A damaged optional explanation must not erase an otherwise valid culture.
      history: state.history.map(entry => {
        if (entry.decision === undefined || isKqStageDecision(entry.decision)) return entry;
        const { decision: _decision, ...receipt } = entry;
        void _decision;
        return receipt;
      }),
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
    ...(state.warehouse ? { warehouse: state.warehouse } : {}),
    ...(state.cultivationProfile ? { cultivationProfile: state.cultivationProfile } : {}),
    ...(state.campaign ? { campaign: state.campaign } : {}),
    ...(state.rulesVersion === 3 ? { rulesVersion: 3, care: state.care } : {}),
    ...(state.firstCultureRescue === true ? { firstCultureRescue: true } : {}),
    ...(state.domiciliation ? { domiciliation: state.domiciliation } : {}),
    seed: state.seed, varietyCode: state.varietyCode, deckCodes: state.deckCodes, handCodes: getKqHandCodes(state), heritageReserveCodes: state.heritageReserveCodes ?? [], handRedrawsUsed: state.handRedrawsUsed ?? 0, heritageCode: state.heritageCode ?? null, heritageName: state.heritageName ?? null, heritageTiming: state.heritageTiming ?? null, heritageEffect: state.heritageEffect ?? null, heritageProducerName: state.heritageProducerName ?? null, heritageImageUrl: state.heritageImageUrl ?? null, heritageUsed: state.heritageUsed ?? false, situationCodes: state.situationCodes,
    usedCards: state.usedCards, quality: state.quality, xp: state.xp, pressure: state.pressure, traits: state.traits, combos: state.combos, bonusDie: state.bonusDie ?? null, effectNotices: state.effectNotices ?? [],
    ...(getKqProductionUnits(state.equipment?.productionUnits) > 1 ? { productionUnits: state.equipment?.productionUnits } : {}),
    ...(state.equipment?.tents ? { equipmentTents: state.equipment.tents } : {}),
    ...(state.equipment?.shared ? { equipmentShared: state.equipment.shared } : {}),
    ...(state.equipment?.scope ? { equipmentScope: state.equipment.scope } : {}),
    equipmentCodes: state.equipment?.codes ?? [], equipmentQualityBonus: state.equipmentQualityBonus ?? 0, harvestGrams: state.harvestGrams ?? null,
    powerOutage: state.powerOutage ?? false, harvestLossPercent: state.harvestLossPercent ?? 0,
    history: state.history.map((entry) => ({ stage: entry.stage, dice: entry.dice, total: entry.total, target: entry.target, outcome: entry.outcome, trait: entry.trait, dangers: entry.dangers, sparks: entry.sparks, pressureAfter: entry.pressureAfter, qualityDelta: entry.qualityDelta, xpGain: entry.xpGain, harvestLossPercent: entry.harvestLossPercent, ...(entry.buildingHarvestLosses ? { buildingHarvestLosses: entry.buildingHarvestLosses } : {}), ...(entry.rescued === true ? { rescued: true } : {}), ...(entry.decision ? { decision: entry.decision } : {}) })),
  });
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `KQ-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}
