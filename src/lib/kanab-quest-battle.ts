import { getKqCultureSystemSummary, getKqHarvestTier, isKqCultureDead, KQ_BUDDIES, KQ_CARDS, type KqGameState, type KqOutcome } from "@/lib/kanab-quest-game";
import { createKqIntegrityCode } from "@/lib/kanab-quest-persistence";
import { createKqCareState, getKqCannabinoidReport, getKqTerpeneReport, type KqTerpeneReport } from "@/lib/kanab-quest-care";
import type { KqBuddieCultivationProfile } from "./kanab-quest-buddie-cultivation";

export type KqFlowerStatus = "available" | "locked" | "burned";

export type KqFlowerCard = {
  id: string;
  /** Missing on historical snapshots, which retain their original five-stat rules. */
  rulesVersion?: 2 | 3;
  ownerName: string;
  variety: string;
  tier: string;
  status: KqFlowerStatus;
  createdAt: string;
  integrityCode: string;
  traits: string[];
  /** Fictional cultivar profile and simulated rates, never a laboratory result. */
  cannabinoidReport?: ReturnType<typeof getKqCannabinoidReport>;
  cultivationProfile?: KqBuddieCultivationProfile;
  terpeneReport?: KqTerpeneReport;
  stats: {
    appearance: number;
    aroma: number;
    vigor: number;
    mastery: number;
    regularity: number;
    /** Expression of the cultivar's profile; higher THC is never an advantage. */
    cannabinoids?: number;
  };
};

export type KqBattleRound = {
  code: string;
  label: string;
  explanation: string;
  playerScore: number;
  opponentScore: number;
  winner: "player" | "opponent";
  tieBreak?: boolean;
};

export type KqBattle = {
  id: string;
  status: "locked" | "verdict";
  playerFlower: KqFlowerCard;
  opponentFlower: KqFlowerCard;
  opponentRating: number;
  rounds: KqBattleRound[];
  winner: "player" | "opponent" | null;
  burnedAt: string | null;
};

const roundTenth = (value: number) => Math.round(value * 10) / 10;
const clampStat = (value: number) => Math.max(35, Math.min(99, roundTenth(value)));
const outcomeValue: Record<KqOutcome, number> = { critical: 4, success: 3, fragile: 2, failure: 0 };
export type KqFlowerStat = keyof KqFlowerCard["stats"];
type FlowerStat = KqFlowerStat;

export const KQ_JURY_SCORING = {
  primaryWeight: 0.65,
  secondaryWeight: 0.35,
  adjustmentMin: -3,
  adjustmentMax: 3,
} as const;

const JURY_SCENARIOS: Array<{ code: string; group: number; label: string; explanation: string; primary: FlowerStat; secondary: FlowerStat }> = [
  { code: "visual-impact", group: 0, label: "Impact visuel", explanation: "Le jury compare l’apparence et la vigueur de chaque fleur.", primary: "appearance", secondary: "vigor" },
  { code: "showcase", group: 0, label: "Vitrine du club", explanation: "La présentation compte, mais la régularité évite les mauvaises surprises.", primary: "appearance", secondary: "regularity" },
  { code: "structure", group: 0, label: "Structure de la fleur", explanation: "La vigueur domine cette épreuve, soutenue par l’apparence générale.", primary: "vigor", secondary: "appearance" },
  { code: "resin-finish", group: 0, label: "Finition résineuse", explanation: "Le jury observe la finition visuelle, puis cherche si les arômes soutiennent cette première impression.", primary: "appearance", secondary: "aroma" },
  { code: "trim-balance", group: 0, label: "Équilibre de présentation", explanation: "Une présentation nette doit aussi témoigner de choix techniques maîtrisés pendant la production.", primary: "appearance", secondary: "mastery" },
  { code: "blind-aroma", group: 1, label: "Arômes à l’aveugle", explanation: "Le profil aromatique est jugé sans connaître le cultivateur.", primary: "aroma", secondary: "regularity" },
  { code: "terpene-table", group: 1, label: "Table des terpènes", explanation: "Le jury cherche un arôme expressif porté par une culture maîtrisée.", primary: "aroma", secondary: "mastery" },
  { code: "jar-opening", group: 1, label: "Ouverture du bocal", explanation: "La première impression aromatique et la constance font la différence.", primary: "aroma", secondary: "regularity" },
  { code: "aroma-evolution", group: 1, label: "Évolution du bouquet", explanation: "Le jury compare l’expression aromatique initiale et la vigueur qui lui donne de la tenue.", primary: "aroma", secondary: "vigor" },
  { code: "visual-aroma", group: 1, label: "Promesse aromatique", explanation: "Le bouquet reste prioritaire, mais son accord avec l’apparence renforce la cohérence de la Fleur.", primary: "aroma", secondary: "appearance" },
  { code: "grower-mastery", group: 2, label: "Maîtrise du cultivateur", explanation: "Les décisions de culture et la régularité du résultat sont évaluées.", primary: "mastery", secondary: "regularity" },
  { code: "consistency", group: 2, label: "Régularité du lot", explanation: "Une fleur constante l’emporte sur un résultat brillant mais irrégulier.", primary: "regularity", secondary: "mastery" },
  { code: "technical-jury", group: 2, label: "Jury technique", explanation: "La maîtrise pèse davantage, avec la vigueur comme preuve du parcours.", primary: "mastery", secondary: "vigor" },
  { code: "production-trace", group: 2, label: "Trace de production", explanation: "Le jury valorise une conduite maîtrisée dont la vigueur finale confirme la solidité.", primary: "mastery", secondary: "vigor" },
  { code: "lot-harmony", group: 2, label: "Harmonie du lot", explanation: "La régularité générale est confrontée à l’apparence pour départager les lots les plus cohérents.", primary: "regularity", secondary: "appearance" },
];

// Existing codes are immutable: archived verdicts must remain explainable with
// their original weights. New aromatic rounds explain the linked terpene/aroma
// axis; the underlying terpene index is never counted a second time.
const JURY_SCENARIOS_V3: typeof JURY_SCENARIOS = [
  ...JURY_SCENARIOS.filter((scenario) => scenario.group !== 1 && scenario.code !== "lot-harmony"),
  { code: "cannabinoid-fidelity-v3", group: 2, label: "Potentiel cannabinoïde", explanation: "Le jury compare le potentiel propre à chaque variété développé puis conservé, avec la régularité du lot. Cet indice de jeu sur 99 est distinct des taux en %. Un taux de THC plus élevé ne rapporte aucun bonus.", primary: "cannabinoids", secondary: "regularity" },
  { code: "blind-aroma-v3", group: 1, label: "Arômes à l’aveugle", explanation: "Le jury compare les terpènes et les arômes à travers une seule note, soutenue par la régularité du lot.", primary: "aroma", secondary: "regularity" },
  { code: "terpene-table-v3", group: 1, label: "Table des terpènes et arômes", explanation: "La note aromatique issue des terpènes développés et préservés domine cette épreuve, avec la maîtrise de la culture.", primary: "aroma", secondary: "mastery" },
  { code: "jar-opening-v3", group: 1, label: "Ouverture du bocal", explanation: "Le jury évalue le bouquet porté par les terpènes préservés, puis la régularité du lot.", primary: "aroma", secondary: "regularity" },
  { code: "aroma-evolution-v3", group: 1, label: "Évolution du bouquet", explanation: "La note commune aux terpènes et aux arômes est soutenue par la vigueur du parcours.", primary: "aroma", secondary: "vigor" },
  { code: "visual-aroma-v3", group: 1, label: "Promesse aromatique", explanation: "Le bouquet issu du potentiel terpénique reste prioritaire ; l’apparence complète cette seule évaluation aromatique.", primary: "aroma", secondary: "appearance" },
];

function juryScenarios(rulesVersion: number) {
  return rulesVersion >= 3 ? JURY_SCENARIOS_V3 : JURY_SCENARIOS;
}

export function hasKqFlowerCannabinoids(flower: KqFlowerCard): boolean {
  return flower.rulesVersion === 3 && typeof flower.stats.cannabinoids === "number"
    && Number.isFinite(flower.stats.cannabinoids) && flower.stats.cannabinoids >= 35 && flower.stats.cannabinoids <= 99;
}

/** A mixed-generation contest always uses the five criteria both Flowers own. */
export function getKqBattleRulesVersion(playerFlower: KqFlowerCard, opponentFlower: KqFlowerCard): 2 | 3 {
  return hasKqFlowerCannabinoids(playerFlower) && hasKqFlowerCannabinoids(opponentFlower) ? 3 : 2;
}

export const KQ_JURY_SCENARIO_COUNT = JURY_SCENARIOS.length;

/** Shared by the resolver and verdict explanations; unknown historical codes stay unknown. */
export function getKqJuryScoringCriteria(code: string): Array<{ stat: KqFlowerStat; weight: number }> | null {
  const scenario = [...JURY_SCENARIOS, ...JURY_SCENARIOS_V3].find(item => item.code === code);
  return scenario ? [
    { stat: scenario.primary, weight: KQ_JURY_SCORING.primaryWeight },
    { stat: scenario.secondary, weight: KQ_JURY_SCORING.secondaryWeight },
  ] : null;
}

export function getKqJuryProgram(seed: number, recentScenarioCodes: string[] = [], rulesVersion: number = 2) {
  return [0, 1, 2].map((group) => {
    const pool = juryScenarios(rulesVersion).filter((scenario) => scenario.group === group);
    const recent = recentScenarioCodes.map((code) => code.replace(/-v3$/, ""));
    const fresh = pool.filter((scenario) => !recent.includes(scenario.code.replace(/-v3$/, "")));
    const candidates = fresh.length > 0 ? fresh : pool;
    const scenario = candidates[Math.abs(seed + group * 7) % candidates.length];
    return { code: scenario.code, label: scenario.label, explanation: scenario.explanation };
  });
}

function statNoise(seed: number, salt: number) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * (KQ_JURY_SCORING.adjustmentMax - KQ_JURY_SCORING.adjustmentMin + 1)) + KQ_JURY_SCORING.adjustmentMin;
}

export function resolveKqJuryWinner(playerScore: number, opponentScore: number, seed: number, roundIndex: number) {
  if (playerScore > opponentScore) return { winner: "player" as const, tieBreak: false };
  if (opponentScore > playerScore) return { winner: "opponent" as const, tieBreak: false };
  const juryVote = statNoise(seed, 40 + roundIndex);
  return { winner: juryVote >= 0 ? "player" as const : "opponent" as const, tieBreak: true };
}

export function createKqFlower(state: KqGameState, ownerName = "Toi"): KqFlowerCard {
  if (isKqCultureDead(state)) throw new Error("Une culture morte ne produit pas de carte Fleur.");
  if (state.phase !== "complete" || state.history.length === 0) throw new Error("La culture doit être terminée.");
  if (state.rulesVersion === 3 && (!state.care || !Number.isFinite(state.care.terpenes) || !Number.isFinite(state.care.cannabinoidExpression))) throw new Error("Le suivi des terpènes et des cannabinoïdes de cette culture est incomplet.");
  const values = state.history.map((entry) => outcomeValue[entry.outcome]);
  const early = values.slice(0, 3).reduce((sum, value) => sum + value, 0);
  const late = values.slice(3).reduce((sum, value) => sum + value, 0);
  const successes = state.history.filter((entry) => entry.outcome === "success" || entry.outcome === "critical").length;
  const failures = state.history.filter((entry) => entry.outcome === "failure").length;
  const playedSupportCount = state.usedCards.filter((code) => KQ_CARDS.find((card) => card.code === code)?.category !== "substrate").length;
  const cultureSystem = getKqCultureSystemSummary(state.deckCodes);
  const base = 52 + state.quality * 2.4;
  const newRules = state.rulesVersion === 3;
  // SIT-006 rewards successful preservation. A negative trait mentioning
  // "Arômes" must never turn an aromatic loss into a bonus on new cultures.
  const aromaBonus = newRules
    ? state.history.some((entry, index) => state.situationCodes[index] === "SIT-006"
      && (entry.outcome === "success" || entry.outcome === "critical")) ? 4 : 0
    : state.traits.some((trait) => trait.includes("Arômes")) ? 4 : 0;
  const sensoryQuality = clampStat(base + late * 1.5 + aromaBonus);
  // This 75/25 split is a balancing rule, not a measured chemical relation.
  // The care index carries development/preservation; the remaining quarter
  // reflects the broader quality of the operations behind the bouquet.
  const aroma = newRules
    ? clampStat(clampStat(state.care!.terpenes) * 0.75 + sensoryQuality * 0.25)
    : sensoryQuality;
  const cannabinoidReport = newRules ? getKqCannabinoidReport(state) : undefined;
  const terpeneReport = newRules ? getKqTerpeneReport(state) : undefined;
  const identity = state.cultivationProfile
    ? `-${state.cultivationProfile.buddieCode}${state.warehouse?.version === 2 ? `-${state.warehouse.zoneId}` : ""}` : "";
  return {
    id: `FLOWER-${state.seed}-${state.history.map((entry) => entry.dice.join("")).join("")}${identity}`,
    ...(newRules ? { rulesVersion: 3 as const } : {}),
    ...(cannabinoidReport ? { cannabinoidReport } : {}),
    ...(state.cultivationProfile ? { cultivationProfile: structuredClone(state.cultivationProfile) } : {}),
    ...(terpeneReport ? { terpeneReport } : {}),
    ownerName,
    variety: state.varietyName,
    tier: getKqHarvestTier(state.quality),
    status: "available",
    createdAt: state.completedAt ?? state.startedAt ?? new Date(0).toISOString(),
    integrityCode: createKqIntegrityCode(state),
    traits: [...new Set([
      ...state.traits,
      ...(cultureSystem ? [`Mode de culture · ${cultureSystem.name}`] : []),
    ])],
    stats: {
      appearance: clampStat(base + values[4] * 2 - failures * 2),
      aroma,
      vigor: clampStat(base + early * 1.6),
      mastery: clampStat(48 + successes * 7 + playedSupportCount * 2 - failures * 3),
      regularity: clampStat(72 + successes * 3 - failures * 9 + (state.equipment?.regularityPercent ?? 0)),
      ...(cannabinoidReport ? { cannabinoids: clampStat(cannabinoidReport.score) } : {}),
    },
  };
}

export function createKqOpponent(seed: number, config: { ownerName?: string; variety?: string; rating?: number; rulesVersion?: number } = {}): KqFlowerCard {
  const base = 64 + (config.rating ? (config.rating - 1000) / 18 : 0) + statNoise(seed, 1);
  const terpenes = clampStat(base + 2 + statNoise(seed, 7));
  const sensoryQuality = clampStat(base + 4 + statNoise(seed, 3));
  const cannabinoids = clampStat(base + 2 + statNoise(seed, 8));
  const cannabinoidReport = config.rulesVersion === 3 ? getKqCannabinoidReport({
    varietyCode: KQ_BUDDIES.find(buddie => buddie.name === (config.variety ?? "Sour Tsunami"))?.code ?? KQ_BUDDIES[0].code,
    care: { ...createKqCareState(), cannabinoidExpression: cannabinoids },
  }) : undefined;
  return {
    id: `RIVAL-${seed}`,
    ...(config.rulesVersion === 3 ? { rulesVersion: 3 as const } : {}),
    ...(cannabinoidReport ? { cannabinoidReport } : {}),
    ownerName: config.ownerName ?? "Maya du Club",
    variety: config.variety ?? "Sour Tsunami",
    tier: base >= 72 ? "Qualité concours" : "Belle pousse",
    status: "available",
    createdAt: new Date().toISOString(),
    integrityCode: `RIVAL-${seed.toString(16).toUpperCase()}`,
    traits: ["Culture régulière", "Agrumes francs", "Séchage patient"],
    stats: {
      appearance: clampStat(base + statNoise(seed, 2)), aroma: config.rulesVersion === 3 ? clampStat(terpenes * 0.75 + sensoryQuality * 0.25) : sensoryQuality,
      vigor: clampStat(base + statNoise(seed, 4)), mastery: clampStat(base + 2 + statNoise(seed, 5)),
      regularity: clampStat(base + 3 + statNoise(seed, 6)),
      ...(cannabinoidReport ? { cannabinoids: cannabinoidReport.score } : {}),
    },
  };
}

export function lockKqBattle(playerFlower: KqFlowerCard, opponentFlower: KqFlowerCard, seed: number, opponentRating = 1000): KqBattle {
  if (playerFlower.status !== "available" || opponentFlower.status !== "available") throw new Error("Une Fleur n’est plus disponible.");
  return {
    id: `BATTLE-${seed}-${playerFlower.id}`,
    status: "locked",
    playerFlower: { ...playerFlower, status: "locked" },
    opponentFlower: { ...opponentFlower, status: "locked" },
    opponentRating,
    rounds: [], winner: null, burnedAt: null,
  };
}

export function resolveKqBattle(battle: KqBattle, seed: number, verdictAt = new Date(), recentScenarioCodes: string[] = []): KqBattle {
  if (battle.status !== "locked") return battle;
  const player = battle.playerFlower.stats;
  const opponent = battle.opponentFlower.stats;
  const rulesVersion = getKqBattleRulesVersion(battle.playerFlower, battle.opponentFlower);
  const program = getKqJuryProgram(seed, recentScenarioCodes, rulesVersion);
  const definitions = program.map((entry) => juryScenarios(rulesVersion).find((scenario) => scenario.code === entry.code)!);
  const rounds = definitions.map((round, index) => {
    // The terpene index is already integrated in aroma during Flower creation;
    // it must never receive a second weight in the same verdict.
    const playerBase = player[round.primary]! * KQ_JURY_SCORING.primaryWeight + player[round.secondary]! * KQ_JURY_SCORING.secondaryWeight;
    const opponentBase = opponent[round.primary]! * KQ_JURY_SCORING.primaryWeight + opponent[round.secondary]! * KQ_JURY_SCORING.secondaryWeight;
    const playerScore = roundTenth(playerBase + statNoise(seed, 10 + index));
    const opponentScore = roundTenth(opponentBase + statNoise(seed, 20 + index));
    const decision = resolveKqJuryWinner(playerScore, opponentScore, seed, index);
    return {
      code: round.code,
      label: round.label,
      explanation: decision.tieBreak ? `${round.explanation} Égalité départagée par le vote du jury.` : round.explanation,
      playerScore,
      opponentScore,
      ...decision,
    };
  });
  const playerWins = rounds.filter((round) => round.winner === "player").length;
  const burnedAt = verdictAt.toISOString();
  return {
    ...battle, status: "verdict", rounds, winner: playerWins >= 2 ? "player" : "opponent", burnedAt,
    playerFlower: { ...battle.playerFlower, status: "burned" },
    opponentFlower: { ...battle.opponentFlower, status: "burned" },
  };
}

export function invertKqBattlePerspective(battle: KqBattle): KqBattle {
  return {
    ...battle,
    playerFlower: battle.opponentFlower,
    opponentFlower: battle.playerFlower,
    rounds: battle.rounds.map((round) => ({
      ...round,
      playerScore: round.opponentScore,
      opponentScore: round.playerScore,
      winner: round.winner === "player" ? "opponent" : "player",
    })),
    winner: battle.winner === null ? null : battle.winner === "player" ? "opponent" : "player",
  };
}
