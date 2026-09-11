import {
  getKqEquipmentRequirementState,
  getKqEquipmentAtLevel,
  KQ_EQUIPMENT_CATALOG,
  type KqEquipmentUnlock,
} from "@/lib/kanab-quest-equipment";

export const KQ_MARKET_ROUTE_CODES = [
  "biomass",
  "raw",
  "dry-sift",
  "static-sift",
  "ice-water-hash",
  "rosin-trial",
  "rosin-selection",
  "rosin-premium",
  "rosin-signature",
  "hash-signature",
] as const;

export type KqMarketRouteCode = (typeof KQ_MARKET_ROUTE_CODES)[number];
export type KqMarketQualityBand = "biomass" | "standard" | "selection" | "premium" | "signature";

export type KqMarketRouteDefinition = {
  code: KqMarketRouteCode;
  name: string;
  family: "salvage" | "flower" | "hash" | "rosin";
  description: string;
  minimumJuryScore: number;
  requiredUnlocks: KqEquipmentUnlock[];
  extractionYieldPercent: number;
  basePriceCentsPerProductGram: number;
  reputationMultiplier: number;
};

export type KqMarketQuote = {
  route: KqMarketRouteCode;
  name: string;
  family: KqMarketRouteDefinition["family"];
  description: string;
  available: boolean;
  blockedReason: string | null;
  missingUnlocks: KqEquipmentUnlock[];
  minimumJuryScore: number;
  processedInputGrams: number;
  productGrams: number;
  remainderGrams: number;
  remainderDestination: "raw" | "biomass" | null;
  biomassRemainderGrams: number;
  processingCapacityPercent: number;
  processingPrecision: number;
  payoutCents: number;
  reputationGain: number;
  reputationPolicyVersion?: 2;
};

export const KQ_MARKET_ROUTES: readonly KqMarketRouteDefinition[] = [
  {
    code: "biomass",
    name: "Biomasse",
    family: "salvage",
    description: "Écouler proprement un lot trop faible. Très peu rentable, sans réputation.",
    minimumJuryScore: 0,
    requiredUnlocks: [],
    extractionYieldPercent: 100,
    basePriceCentsPerProductGram: 30,
    reputationMultiplier: 0,
  },
  {
    code: "raw",
    name: "Lot brut",
    family: "flower",
    description: "Vendre la fleur telle qu'elle a été présentée au jury.",
    minimumJuryScore: 5.8,
    requiredUnlocks: ["raw-sale"],
    extractionYieldPercent: 100,
    basePriceCentsPerProductGram: 180,
    reputationMultiplier: 1,
  },
  {
    code: "dry-sift",
    name: "Hash tamisé",
    family: "hash",
    description: "Une transformation accessible, avec un rendement limité mais une meilleure valeur au gramme.",
    minimumJuryScore: 6.2,
    requiredUnlocks: ["dry-sift"],
    extractionYieldPercent: 18,
    basePriceCentsPerProductGram: 1_600,
    reputationMultiplier: 1.35,
  },
  {
    code: "static-sift",
    name: "Static Sift",
    family: "hash",
    description: "Une micro-série électrostatique très pure : peu de rendement, forte valeur et grosse réputation.",
    minimumJuryScore: 8.3,
    requiredUnlocks: ["dry-sift", "static-sift"],
    extractionYieldPercent: 10,
    basePriceCentsPerProductGram: 12_000,
    reputationMultiplier: 3.8,
  },
  {
    code: "ice-water-hash",
    name: "Hash eau-glace",
    family: "hash",
    description: "Une extraction plus exigeante qui valorise les lots aromatiques et réguliers.",
    minimumJuryScore: 6.8,
    requiredUnlocks: ["ice-water-hash"],
    extractionYieldPercent: 16,
    basePriceCentsPerProductGram: 2_200,
    reputationMultiplier: 1.7,
  },
  {
    code: "rosin-trial",
    name: "Rosin d'essai",
    family: "rosin",
    description: "Une petite série pressée, rentable seulement si la fleur tient déjà ses promesses.",
    minimumJuryScore: 6.5,
    requiredUnlocks: ["rosin-trial"],
    extractionYieldPercent: 15,
    basePriceCentsPerProductGram: 2_600,
    reputationMultiplier: 1.55,
  },
  {
    code: "rosin-selection",
    name: "Rosin Sélection",
    family: "rosin",
    description: "Un lot plus régulier, destiné aux fleurs réellement sélectionnées par le jury.",
    minimumJuryScore: 7.2,
    requiredUnlocks: ["rosin-selection"],
    extractionYieldPercent: 18,
    basePriceCentsPerProductGram: 3_200,
    reputationMultiplier: 2,
  },
  {
    code: "rosin-premium",
    name: "Rosin Premium",
    family: "rosin",
    description: "La transformation haut de gamme pour les récoltes qui méritent l'investissement.",
    minimumJuryScore: 8,
    requiredUnlocks: ["rosin-premium"],
    extractionYieldPercent: 20,
    basePriceCentsPerProductGram: 4_200,
    reputationMultiplier: 2.6,
  },
  {
    code: "rosin-signature",
    name: "Rosin Signature",
    family: "rosin",
    description: "Une série automatisée réservée aux fleurs d'exception et aux ateliers déjà rentables.",
    minimumJuryScore: 8.8,
    requiredUnlocks: ["rosin-signature"],
    extractionYieldPercent: 22,
    basePriceCentsPerProductGram: 8_000,
    reputationMultiplier: 3.6,
  },
  {
    code: "hash-signature",
    name: "Hash Signature",
    family: "hash",
    description: "Lavage, filtration automatisée et séchage spécialisé : le palier réservé aux meilleurs lots du Placard.",
    minimumJuryScore: 8.8,
    requiredUnlocks: ["ice-water-hash", "hash-filtration", "freeze-drying"],
    extractionYieldPercent: 18,
    basePriceCentsPerProductGram: 7_000,
    reputationMultiplier: 4.2,
  },
] as const;

export const KQ_ROUTE_EXPERTISE_TIERS = [
  { code: "discovery", name: "Découverte", minimumSales: 0 },
  { code: "apprentice", name: "Apprentie", minimumSales: 1 },
  { code: "confirmed", name: "Confirmée", minimumSales: 3 },
  { code: "expert", name: "Experte", minimumSales: 6 },
  { code: "master", name: "Maîtrise", minimumSales: 10 },
] as const;

export type KqRouteExpertiseTier = (typeof KQ_ROUTE_EXPERTISE_TIERS)[number];

export const KQ_ROUTE_EXPERTISE_REPUTATION_BONUSES = {
  3: 5,
  6: 12,
  10: 25,
} as const;

export function isKqTransformationMarketRoute(route: KqMarketRouteCode) {
  const family = KQ_MARKET_ROUTES.find((candidate) => candidate.code === route)?.family;
  return family === "hash" || family === "rosin";
}

export function getKqRouteExpertiseBonusReputation(
  route: KqMarketRouteCode,
  saleCount: number,
  baseReputationGain?: number,
) {
  // Omit the score only for a future, conditional milestone, never a sale preview.
  if (baseReputationGain !== undefined && baseReputationGain <= 0) return 0;
  if (!isKqTransformationMarketRoute(route)) return 0;
  const normalizedSaleCount = Math.max(0, Math.trunc(Number(saleCount) || 0));
  if (normalizedSaleCount === 3) return KQ_ROUTE_EXPERTISE_REPUTATION_BONUSES[3];
  if (normalizedSaleCount === 6) return KQ_ROUTE_EXPERTISE_REPUTATION_BONUSES[6];
  if (normalizedSaleCount === 10) return KQ_ROUTE_EXPERTISE_REPUTATION_BONUSES[10];
  return 0;
}

export function getKqRouteExpertiseProgress(saleCount: number) {
  const parsedSaleCount = Number(saleCount);
  const normalizedSaleCount = Number.isFinite(parsedSaleCount)
    ? Math.max(0, Math.trunc(parsedSaleCount))
    : 0;
  const tier = [...KQ_ROUTE_EXPERTISE_TIERS]
    .reverse()
    .find((candidate) => normalizedSaleCount >= candidate.minimumSales)
    ?? KQ_ROUTE_EXPERTISE_TIERS[0];
  const nextTier = KQ_ROUTE_EXPERTISE_TIERS.find((candidate) => candidate.minimumSales > normalizedSaleCount) ?? null;
  return {
    saleCount: normalizedSaleCount,
    tier,
    nextTier,
    salesToNext: nextTier ? nextTier.minimumSales - normalizedSaleCount : 0,
    progressPercent: nextTier
      ? Math.round(Math.min(1, normalizedSaleCount / nextTier.minimumSales) * 100)
      : 100,
  };
}

export type KqRouteExpertiseMission = {
  route: KqMarketRouteCode;
  name: string;
  source: "pinned" | "nearest";
  saleCount: number;
  currentTier: KqRouteExpertiseTier;
  targetTier: KqRouteExpertiseTier;
  salesRemaining: number;
  progressPercent: number;
  bonusReputation: number;
};

/** Keeps one short repeat-sale goal visible, preferring the player's pinned route. */
export function getKqRouteExpertiseMission(input: {
  masteries: ReadonlyArray<{ route: KqMarketRouteCode; saleCount: number }>;
  pinnedRoute?: KqMarketRouteCode | null;
}): KqRouteExpertiseMission | null {
  const saleCounts = new Map(input.masteries.map((mastery) => [mastery.route, mastery.saleCount]));
  const candidates = KQ_MARKET_ROUTES.flatMap((route) => {
    if (route.family !== "hash" && route.family !== "rosin") return [];
    const progress = getKqRouteExpertiseProgress(saleCounts.get(route.code) ?? 0);
    if (!progress.nextTier) return [];
    return [{ route, progress }];
  });
  const pinned = candidates.find((candidate) => candidate.route.code === input.pinnedRoute);
  const selected = pinned ?? [...candidates].sort((left, right) => (
    left.progress.salesToNext - right.progress.salesToNext
    || getKqRouteExpertiseBonusReputation(right.route.code, right.progress.nextTier!.minimumSales)
      - getKqRouteExpertiseBonusReputation(left.route.code, left.progress.nextTier!.minimumSales)
    || right.progress.saleCount - left.progress.saleCount
    || left.progress.nextTier!.minimumSales - right.progress.nextTier!.minimumSales
    || KQ_MARKET_ROUTE_CODES.indexOf(left.route.code) - KQ_MARKET_ROUTE_CODES.indexOf(right.route.code)
  ))[0];
  if (!selected?.progress.nextTier) return null;
  return {
    route: selected.route.code,
    name: selected.route.name,
    source: pinned ? "pinned" : "nearest",
    saleCount: selected.progress.saleCount,
    currentTier: selected.progress.tier,
    targetTier: selected.progress.nextTier,
    salesRemaining: selected.progress.salesToNext,
    progressPercent: selected.progress.progressPercent,
    bonusReputation: getKqRouteExpertiseBonusReputation(
      selected.route.code,
      selected.progress.nextTier.minimumSales,
    ),
  };
}

const roundTenth = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

/** Game balance, not a real-world product grading standard. */
export function getKqMarketReputationRule(route: KqMarketRouteCode) {
  const definition = KQ_MARKET_ROUTES.find((candidate) => candidate.code === route)!;
  const demanding = definition.family === "rosin" || route === "static-sift" || route === "hash-signature";
  return {
    neutralFrom: demanding ? 8 : 7,
    gainFrom: demanding ? 8.8 : 8,
    multiplier: definition.reputationMultiplier,
  };
}

export function calculateKqMarketReputation(route: KqMarketRouteCode, juryScore: number) {
  const rule = getKqMarketReputationRule(route);
  if (!Number.isFinite(juryScore) || rule.multiplier === 0) return 0;
  // Integer arithmetic keeps the browser and PostgreSQL identical at half points.
  const score = Math.round(clamp(juryScore, 0, 10) * 10);
  const neutral = Math.round(rule.neutralFrom * 10);
  const gain = Math.round(rule.gainFrom * 10);
  const weight = Math.round(rule.multiplier * 100);
  if (score < neutral) return -Math.max(1, Math.round((neutral - score) * 4 * weight / 1000));
  if (score < gain) return 0;
  return Math.max(1, Math.round((score - gain + 10) * 4 * weight / 1000));
}

export function getKqMarketReputationLabel(route: KqMarketRouteCode) {
  if (route === "biomass") return "Sans effet sur la réputation";
  const rule = getKqMarketReputationRule(route);
  const format = (value: number) => value.toLocaleString("fr-FR");
  return `Baisse < ${format(rule.neutralFrom)} · stable < ${format(rule.gainFrom)} · hausse dès ${format(rule.gainFrom)}/10`;
}

export function formatKqReputationDelta(delta: number) {
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString("fr-FR")}`;
}

export function previewKqMarketReputation(reputation: number, baseGain: number, expertiseBonus: number) {
  const before = Math.max(0, Math.trunc(reputation));
  const after = Math.max(0, before + baseGain + (baseGain > 0 ? expertiseBonus : 0));
  return { reputationAfter: after, reputationGain: after - before };
}

export function getKqMarketQualityBand(juryScore: number): KqMarketQualityBand {
  if (juryScore >= 8.8) return "signature";
  if (juryScore >= 8) return "premium";
  if (juryScore >= 7) return "selection";
  if (juryScore >= 5.8) return "standard";
  return "biomass";
}

export function getKqJuryScoreFromStats(stats: Record<string, number>) {
  const values = ["appearance", "aroma", "vigor", "mastery", "regularity"]
    .map((key) => Number(stats[key]))
    .filter(Number.isFinite);
  if (values.length === 0) return 0;
  return roundTenth(clamp(values.reduce((total, value) => total + value, 0) / values.length / 10, 0, 10));
}

export function getKqJuryScoreFromRounds(
  rounds: Array<{ playerScore: number; opponentScore: number }>,
  perspective: "player" | "opponent" = "player",
) {
  const scores = rounds
    .map((round) => Number(perspective === "player" ? round.playerScore : round.opponentScore))
    .filter(Number.isFinite);
  if (scores.length === 0) return 0;
  return roundTenth(clamp(scores.reduce((total, score) => total + score, 0) / scores.length / 10, 0, 10));
}

export function calculateKqEquipmentQualityBonus(maximumBonus: number, successfulStages: number) {
  return Math.max(0, Math.floor(clamp(maximumBonus, 0, 20) * clamp(successfulStages, 0, 6) / 6));
}

export function calculateKqHarvestGrams(input: {
  quality: number;
  successfulStages: number;
  quantityPercent: number;
}) {
  const baseGrams = clamp(55 + input.successfulStages * 7 + input.quality * 3, 35, 160);
  return roundTenth(clamp(baseGrams * (1 + clamp(input.quantityPercent, 0, 250) / 100), 20, 500));
}

function getRouteEquipmentState(equipmentCodes: string[], route: KqMarketRouteDefinition, levels: Record<string, number> = {}) {
  if (route.requiredUnlocks.length === 0) {
    return { missingUnlocks: [] as KqEquipmentUnlock[], capacityPercent: 100, precision: 100, valueBonusPercent: 0 };
  }
  const equipped = equipmentCodes.map((code) => getKqEquipmentAtLevel(code, levels[code]))
    .filter((equipment): equipment is NonNullable<typeof equipment> => equipment !== null);
  const selected = route.requiredUnlocks.map((unlock) => equipped
    .filter((equipment) => equipment.unlocks.includes(unlock))
    .sort((left, right) => (right.effects.processingPrecision ?? 0) - (left.effects.processingPrecision ?? 0))[0] ?? null);
  const missingUnlocks = route.requiredUnlocks.filter((_, index) => selected[index] === null);
  const processingEquipment = selected.filter((equipment): equipment is NonNullable<typeof equipment> => equipment !== null);
  return {
    missingUnlocks,
    valueBonusPercent: processingEquipment.length > 0
      ? processingEquipment.reduce((sum, equipment) => sum + (equipment.effects.processingValueBonusPercent ?? 0), 0) / processingEquipment.length : 0,
    capacityPercent: processingEquipment.length > 0
      ? Math.min(...processingEquipment.map((equipment) => equipment.effects.processingCapacity ?? 0))
      : 0,
    precision: processingEquipment.length > 0
      ? Math.min(...processingEquipment.map((equipment) => equipment.effects.processingPrecision ?? 0))
      : 0,
  };
}

export function quoteKqMarketRoutes(input: {
  juryScore: number;
  harvestGrams: number;
  equipmentCodes: string[];
  equipmentLevels?: Record<string, number>;
}): KqMarketQuote[] {
  const juryScore = roundTenth(clamp(input.juryScore, 0, 10));
  const harvestGrams = roundTenth(clamp(input.harvestGrams, 0, 500));
  const rawRoute = KQ_MARKET_ROUTES.find((route) => route.code === "raw");
  if (!rawRoute) throw new Error("La voie de vente brute est absente du marché.");
  const rawEquipment = getRouteEquipmentState(input.equipmentCodes, rawRoute, input.equipmentLevels);
  const rawRemainderAvailable = juryScore >= rawRoute.minimumJuryScore
    && rawEquipment.missingUnlocks.length === 0;
  return KQ_MARKET_ROUTES.map((route) => {
    const equipment = getRouteEquipmentState(input.equipmentCodes, route, input.equipmentLevels);
    const scoreBlocked = juryScore < route.minimumJuryScore;
    const equipmentBlocked = equipment.missingUnlocks.length > 0;
    const processingCapacityPercent = route.family === "hash" || route.family === "rosin"
      ? clamp(equipment.capacityPercent, 0, 100)
      : 100;
    const processedInputGrams = roundTenth(harvestGrams * processingCapacityPercent / 100);
    const productGrams = roundTenth(processedInputGrams * route.extractionYieldPercent / 100);
    const remainderGrams = roundTenth(Math.max(0, harvestGrams - processedInputGrams));
    const remainderDestination = remainderGrams <= 0
      ? null
      : rawRemainderAvailable && (route.family === "hash" || route.family === "rosin")
        ? "raw" as const
        : "biomass" as const;
    const biomassRemainderGrams = remainderDestination === "biomass" ? remainderGrams : 0;
    const juryFactor = route.code === "biomass" ? 1 : clamp(0.7 + juryScore / 20, 0.7, 1.2);
    const precisionFactor = route.family === "hash" || route.family === "rosin"
      ? clamp(0.82 + equipment.precision / 550, 0.82, 1)
      : 1;
    const productValueCents = productGrams * route.basePriceCentsPerProductGram * juryFactor * precisionFactor * (1 + equipment.valueBonusPercent / 100);
    const remainderValueCents = remainderDestination === "raw"
      ? remainderGrams * rawRoute.basePriceCentsPerProductGram * juryFactor
      : remainderGrams * 30;
    const payoutCents = Math.max(0, Math.round(productValueCents + remainderValueCents));
    const blockedReason = scoreBlocked
      ? `Le jury exige au moins ${route.minimumJuryScore.toFixed(1)}/10.`
      : equipmentBlocked
        ? "Équipement de transformation manquant ou non installé."
        : harvestGrams <= 0
          ? "Le lot ne contient aucune matière valorisable."
          : null;
    const reputationGain = blockedReason ? 0 : calculateKqMarketReputation(route.code, juryScore);
    return {
      route: route.code,
      name: route.name,
      family: route.family,
      description: route.description,
      available: blockedReason === null,
      blockedReason,
      missingUnlocks: equipment.missingUnlocks,
      minimumJuryScore: route.minimumJuryScore,
      processedInputGrams,
      productGrams,
      remainderGrams,
      remainderDestination,
      biomassRemainderGrams,
      processingCapacityPercent,
      processingPrecision: equipment.precision,
      payoutCents,
      reputationGain,
      reputationPolicyVersion: 2,
    };
  });
}

export function getKqMarketRecommendations(quotes: KqMarketQuote[]) {
  const available = quotes.filter((quote) => quote.available);
  const routeOrder = (route: KqMarketRouteCode) => KQ_MARKET_ROUTE_CODES.indexOf(route);
  const bestPayout = [...available].sort((left, right) => (
    right.payoutCents - left.payoutCents
    || right.reputationGain - left.reputationGain
    || routeOrder(left.route) - routeOrder(right.route)
  ))[0] ?? null;
  const reputationCandidate = [...available].sort((left, right) => (
    right.reputationGain - left.reputationGain
    || right.payoutCents - left.payoutCents
    || routeOrder(left.route) - routeOrder(right.route)
  ))[0] ?? null;
  const bestReputation = reputationCandidate && reputationCandidate.reputationGain > 0
    ? reputationCandidate
    : null;
  return {
    availableCount: available.length,
    bestPayout,
    bestReputation,
    rawBaseline: available.find((quote) => quote.route === "raw") ?? null,
    oneClearWinner: Boolean(
      bestPayout
      && bestReputation
      && bestPayout.route === bestReputation.route,
    ),
  };
}

export type KqPinnedRouteLotStatus = {
  route: KqMarketRouteCode;
  name: string;
  available: boolean;
  state: "ready" | "quality" | "equipment" | "quality-and-equipment";
  qualityGap: number;
  minimumJuryScore: number;
  missingUnlocks: KqEquipmentUnlock[];
};

export type KqPinnedRouteFlowerPreview = {
  route: KqMarketRouteCode;
  name: string;
  estimatedJuryScore: number;
  minimumJuryScore: number;
  qualityGap: number;
  likelyReady: boolean;
};

export type KqPinnedRouteVerdictStatus = {
  route: KqMarketRouteCode;
  name: string;
  juryScore: number;
  minimumJuryScore: number;
  qualityGap: number;
  qualified: boolean;
};

export type KqNextRouteMasteryGoal = {
  route: KqMarketRouteCode;
  name: string;
  minimumJuryScore: number;
  equipmentCode: string;
  equipmentName: string;
  equipmentPriceCents: number;
  investmentRequired: boolean;
};

const KQ_ROUTE_MASTERY_BRANCHES: readonly (readonly KqMarketRouteCode[])[] = [
  ["dry-sift", "static-sift"],
  ["ice-water-hash", "hash-signature"],
  ["rosin-trial", "rosin-selection", "rosin-premium", "rosin-signature"],
] as const;

const KQ_ROUTE_PIVOT_CODES: Partial<Record<KqMarketRouteCode, readonly string[]>> = {
  "dry-sift": ["SIFT-TRAY"],
  "static-sift": ["STATIC-PLASMA"],
  "ice-water-hash": ["WASHER-25L"],
  "hash-signature": ["AUTO-SIEVE", "FREEZE-DRYER", "WASHER-25L"],
  "rosin-trial": ["PRESS-0600"],
  "rosin-selection": ["PRESS-0600"],
  "rosin-premium": ["PRESS-0600"],
  "rosin-signature": ["PRESS-0600"],
};

export type KqRoutePlanEquipmentGoal = {
  route: KqMarketRouteCode;
  routeName: string;
  minimumJuryScore: number;
  equipmentCode: string;
  equipmentName: string;
  equipmentPriceCents: number;
  investmentRequired: boolean;
};

/** Selects one valid pivot for a persistent route goal, reusing capable owned gear first. */
export function getKqRoutePlanEquipmentGoal(input: {
  route: KqMarketRouteCode;
  ownedCodes: readonly string[];
}): KqRoutePlanEquipmentGoal | null {
  const route = KQ_MARKET_ROUTES.find((candidate) => candidate.code === input.route);
  if (!route || (route.family !== "hash" && route.family !== "rosin")) return null;
  const owned = new Set(input.ownedCodes);
  const ownedEquipment = KQ_EQUIPMENT_CATALOG.filter((equipment) => owned.has(equipment.code));
  const ownedUnlocks = new Set(ownedEquipment.flatMap((equipment) => equipment.unlocks));
  const missingUnlocks = route.requiredUnlocks.filter((unlock) => !ownedUnlocks.has(unlock));
  const preferredCodes = KQ_ROUTE_PIVOT_CODES[route.code] ?? [];
  const preferredEquipment = preferredCodes.flatMap((code) => {
    const equipment = KQ_EQUIPMENT_CATALOG.find((candidate) => candidate.code === code && candidate.purchasable);
    return equipment ? [equipment] : [];
  });
  const equipment = missingUnlocks.length > 0
    ? preferredEquipment.find((candidate) => (
      !owned.has(candidate.code)
      && candidate.unlocks.some((unlock) => missingUnlocks.includes(unlock))
    )) ?? KQ_EQUIPMENT_CATALOG.find((candidate) => (
      candidate.purchasable
      && !owned.has(candidate.code)
      && candidate.unlocks.some((unlock) => missingUnlocks.includes(unlock))
    ))
    : preferredEquipment
      .filter((candidate) => owned.has(candidate.code))
      .sort((left, right) => (
        (right.effects.processingPrecision ?? 0) - (left.effects.processingPrecision ?? 0)
        || (right.effects.processingCapacity ?? 0) - (left.effects.processingCapacity ?? 0)
        || right.priceCents - left.priceCents
      ))[0] ?? ownedEquipment.find((candidate) => (
        candidate.unlocks.some((unlock) => route.requiredUnlocks.includes(unlock))
      ));
  if (!equipment) return null;
  return {
    route: route.code,
    routeName: route.name,
    minimumJuryScore: route.minimumJuryScore,
    equipmentCode: equipment.code,
    equipmentName: equipment.name,
    equipmentPriceCents: equipment.priceCents,
    investmentRequired: !owned.has(equipment.code),
  };
}

/** Explains why the currently selected lot can, or cannot, follow the saved workshop route. */
export function getKqPinnedRouteLotStatus(input: {
  route: KqMarketRouteCode | null;
  juryScore: number;
  quotes: KqMarketQuote[];
}): KqPinnedRouteLotStatus | null {
  if (!input.route) return null;
  const quote = input.quotes.find((item) => item.route === input.route);
  if (!quote) return null;

  const qualityGap = roundTenth(Math.max(0, quote.minimumJuryScore - clamp(input.juryScore, 0, 10)));
  const missesQuality = qualityGap > 0;
  const missesEquipment = quote.missingUnlocks.length > 0;
  const state = missesQuality && missesEquipment
    ? "quality-and-equipment" as const
    : missesQuality
      ? "quality" as const
      : missesEquipment
        ? "equipment" as const
        : "ready" as const;

  return {
    route: quote.route,
    name: quote.name,
    available: quote.available,
    state,
    qualityGap,
    minimumJuryScore: quote.minimumJuryScore,
    missingUnlocks: [...quote.missingUnlocks],
  };
}

/** Keeps every market option visible while moving the saved objective to the first reading position. */
export function prioritizeKqPinnedMarketRoute(
  quotes: KqMarketQuote[],
  route: KqMarketRouteCode | null,
) {
  if (!route) return [...quotes];
  return [...quotes].sort((left, right) => (
    Number(right.route === route) - Number(left.route === route)
  ));
}

/** Gives a pre-jury quality signal; the official three-round verdict remains authoritative. */
export function getKqPinnedRouteFlowerPreview(input: {
  route: KqMarketRouteCode | null;
  stats: Record<string, number>;
}): KqPinnedRouteFlowerPreview | null {
  if (!input.route) return null;
  const route = KQ_MARKET_ROUTES.find((item) => item.code === input.route);
  if (!route) return null;
  const estimatedJuryScore = getKqJuryScoreFromStats(input.stats);
  const qualityGap = roundTenth(Math.max(0, route.minimumJuryScore - estimatedJuryScore));
  return {
    route: route.code,
    name: route.name,
    estimatedJuryScore,
    minimumJuryScore: route.minimumJuryScore,
    qualityGap,
    likelyReady: qualityGap === 0,
  };
}

/** Compares the authoritative three-round jury score with the saved market objective. */
export function getKqPinnedRouteVerdictStatus(input: {
  route: KqMarketRouteCode | null;
  rounds: Array<{ playerScore: number; opponentScore: number }>;
  perspective?: "player" | "opponent";
}): KqPinnedRouteVerdictStatus | null {
  if (!input.route) return null;
  const route = KQ_MARKET_ROUTES.find((item) => item.code === input.route);
  if (!route) return null;
  const juryScore = getKqJuryScoreFromRounds(input.rounds, input.perspective ?? "player");
  const qualityGap = roundTenth(Math.max(0, route.minimumJuryScore - juryScore));
  return {
    route: route.code,
    name: route.name,
    juryScore,
    minimumJuryScore: route.minimumJuryScore,
    qualityGap,
    qualified: qualityGap === 0,
  };
}

/** Suggests the next unmastered tier in the same processing family. */
export function getKqNextRouteMasteryGoal(input: {
  completedRoute: KqMarketRouteCode;
  masteredRoutes: readonly KqMarketRouteCode[];
  ownedCodes: readonly string[];
}): KqNextRouteMasteryGoal | null {
  const branch = KQ_ROUTE_MASTERY_BRANCHES.find((routes) => routes.includes(input.completedRoute));
  if (!branch) return null;
  const currentIndex = branch.indexOf(input.completedRoute);
  const mastered = new Set(input.masteredRoutes);
  const nextRouteCode = branch.slice(currentIndex + 1).find((route) => !mastered.has(route));
  if (!nextRouteCode) return null;
  const route = KQ_MARKET_ROUTES.find((item) => item.code === nextRouteCode);
  if (!route) return null;
  const equipmentGoal = getKqRoutePlanEquipmentGoal({ route: nextRouteCode, ownedCodes: input.ownedCodes });
  if (!equipmentGoal) return null;

  return {
    route: route.code,
    name: route.name,
    minimumJuryScore: route.minimumJuryScore,
    equipmentCode: equipmentGoal.equipmentCode,
    equipmentName: equipmentGoal.equipmentName,
    equipmentPriceCents: equipmentGoal.equipmentPriceCents,
    investmentRequired: equipmentGoal.investmentRequired,
  };
}

export function getKqNewlyUnlockedMarketRoutes(input: {
  currentUnlocks: readonly KqEquipmentUnlock[];
  projectedUnlocks: readonly KqEquipmentUnlock[];
}) {
  const current = new Set(input.currentUnlocks);
  const projected = new Set(input.projectedUnlocks);
  return KQ_MARKET_ROUTES.filter((route) => (
    route.requiredUnlocks.length > 0
    && route.requiredUnlocks.every((unlock) => projected.has(unlock))
    && !route.requiredUnlocks.every((unlock) => current.has(unlock))
  ));
}

export type KqMarketEquipmentGoal = {
  code: string;
  name: string;
  priceCents: number;
  remainingCents: number;
  affordable: boolean;
  kind: "install" | "buy" | "prerequisite";
  targetEquipmentName: string | null;
};

/** Chooses the first concrete workshop action that can unlock a blocked route. */
export function getKqMarketEquipmentGoal(input: {
  quote: KqMarketQuote;
  ownedCodes: string[];
  equippedCodes: string[];
  cashCents: number;
}): KqMarketEquipmentGoal | null {
  const missingUnlock = input.quote.missingUnlocks?.[0];
  if (!missingUnlock) return null;
  const owned = new Set(input.ownedCodes);
  const equipped = new Set(input.equippedCodes);
  const directCandidates = KQ_EQUIPMENT_CATALOG
    .filter((equipment) => equipment.purchasable && equipment.unlocks.includes(missingUnlock))
    .sort((left, right) => (
      Number(!owned.has(left.code)) - Number(!owned.has(right.code))
      || Number(equipped.has(right.code)) - Number(equipped.has(left.code))
      || left.priceCents - right.priceCents
      || left.code.localeCompare(right.code)
    ));
  const direct = directCandidates[0] ?? null;
  if (!direct) return null;

  if (owned.has(direct.code)) {
    return {
      code: direct.code,
      name: direct.name,
      priceCents: direct.priceCents,
      remainingCents: 0,
      affordable: true,
      kind: "install",
      targetEquipmentName: null,
    };
  }

  const missingRequirement = getKqEquipmentRequirementState({
    equipment: direct,
    ownedCodes: input.ownedCodes,
  }).missing[0];
  const prerequisite = missingRequirement?.oneOf
    .map((code) => KQ_EQUIPMENT_CATALOG.find((equipment) => equipment.code === code) ?? null)
    .filter((equipment): equipment is NonNullable<typeof equipment> => Boolean(equipment?.purchasable && !owned.has(equipment.code)))
    .filter((equipment) => getKqEquipmentRequirementState({ equipment, ownedCodes: input.ownedCodes }).compatible)
    .sort((left, right) => left.priceCents - right.priceCents || left.code.localeCompare(right.code))[0] ?? null;
  const goal = prerequisite ?? direct;

  return {
    code: goal.code,
    name: goal.name,
    priceCents: goal.priceCents,
    remainingCents: Math.max(0, goal.priceCents - input.cashCents),
    affordable: input.cashCents >= goal.priceCents,
    kind: prerequisite ? "prerequisite" : "buy",
    targetEquipmentName: prerequisite ? direct.name : null,
  };
}

export function isKqMarketRouteCode(value: string): value is KqMarketRouteCode {
  return (KQ_MARKET_ROUTE_CODES as readonly string[]).includes(value);
}
