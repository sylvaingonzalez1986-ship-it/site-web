import { getKqHarvestTier, KQ_CARDS, type KqGameState, type KqOutcome } from "@/lib/kanab-quest-game";
import { createKqIntegrityCode } from "@/lib/kanab-quest-persistence";

export type KqFlowerStatus = "available" | "locked" | "burned";

export type KqFlowerCard = {
  id: string;
  ownerName: string;
  variety: string;
  tier: string;
  status: KqFlowerStatus;
  createdAt: string;
  integrityCode: string;
  traits: string[];
  stats: {
    appearance: number;
    aroma: number;
    vigor: number;
    mastery: number;
    regularity: number;
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
type FlowerStat = keyof KqFlowerCard["stats"];

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

export const KQ_JURY_SCENARIO_COUNT = JURY_SCENARIOS.length;

export function getKqJuryProgram(seed: number, recentScenarioCodes: string[] = []) {
  return [0, 1, 2].map((group) => {
    const pool = JURY_SCENARIOS.filter((scenario) => scenario.group === group);
    const fresh = pool.filter((scenario) => !recentScenarioCodes.includes(scenario.code));
    const candidates = fresh.length > 0 ? fresh : pool;
    const scenario = candidates[Math.abs(seed + group * 7) % candidates.length];
    return { code: scenario.code, label: scenario.label, explanation: scenario.explanation };
  });
}

function statNoise(seed: number, salt: number) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * 7) - 3;
}

export function resolveKqJuryWinner(playerScore: number, opponentScore: number, seed: number, roundIndex: number) {
  if (playerScore > opponentScore) return { winner: "player" as const, tieBreak: false };
  if (opponentScore > playerScore) return { winner: "opponent" as const, tieBreak: false };
  const juryVote = statNoise(seed, 40 + roundIndex);
  return { winner: juryVote >= 0 ? "player" as const : "opponent" as const, tieBreak: true };
}

export function createKqFlower(state: KqGameState, ownerName = "Toi"): KqFlowerCard {
  if (state.phase !== "complete" || state.history.length === 0) throw new Error("La culture doit être terminée.");
  const values = state.history.map((entry) => outcomeValue[entry.outcome]);
  const early = values.slice(0, 3).reduce((sum, value) => sum + value, 0);
  const late = values.slice(3).reduce((sum, value) => sum + value, 0);
  const successes = state.history.filter((entry) => entry.outcome === "success" || entry.outcome === "critical").length;
  const failures = state.history.filter((entry) => entry.outcome === "failure").length;
  const playedSupportCount = state.usedCards.filter((code) => KQ_CARDS.find((card) => card.code === code)?.category !== "substrate").length;
  const base = 52 + state.quality * 2.4;
  return {
    id: `FLOWER-${state.seed}-${state.history.map((entry) => entry.dice.join("")).join("")}`,
    ownerName,
    variety: state.varietyName,
    tier: getKqHarvestTier(state.quality),
    status: "available",
    createdAt: state.completedAt ?? state.startedAt ?? new Date(0).toISOString(),
    integrityCode: createKqIntegrityCode(state),
    traits: [...state.traits],
    stats: {
      appearance: clampStat(base + values[4] * 2 - failures * 2),
      aroma: clampStat(base + late * 1.5 + (state.traits.some((trait) => trait.includes("Arômes")) ? 4 : 0)),
      vigor: clampStat(base + early * 1.6),
      mastery: clampStat(48 + successes * 7 + playedSupportCount * 2 - failures * 3),
      regularity: clampStat(72 + successes * 3 - failures * 9),
    },
  };
}

export function createKqOpponent(seed: number, config: { ownerName?: string; variety?: string; rating?: number } = {}): KqFlowerCard {
  const base = 64 + (config.rating ? (config.rating - 1000) / 18 : 0) + statNoise(seed, 1);
  return {
    id: `RIVAL-${seed}`,
    ownerName: config.ownerName ?? "Maya du Club",
    variety: config.variety ?? "Sour Tsunami",
    tier: base >= 72 ? "Qualité concours" : "Belle pousse",
    status: "available",
    createdAt: new Date().toISOString(),
    integrityCode: `RIVAL-${seed.toString(16).toUpperCase()}`,
    traits: ["Culture régulière", "Agrumes francs", "Séchage patient"],
    stats: {
      appearance: clampStat(base + statNoise(seed, 2)), aroma: clampStat(base + 4 + statNoise(seed, 3)),
      vigor: clampStat(base + statNoise(seed, 4)), mastery: clampStat(base + 2 + statNoise(seed, 5)),
      regularity: clampStat(base + 3 + statNoise(seed, 6)),
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
  const program = getKqJuryProgram(seed, recentScenarioCodes);
  const definitions = program.map((entry) => JURY_SCENARIOS.find((scenario) => scenario.code === entry.code)!);
  const rounds = definitions.map((round, index) => {
    const playerBase = player[round.primary] * 0.65 + player[round.secondary] * 0.35;
    const opponentBase = opponent[round.primary] * 0.65 + opponent[round.secondary] * 0.35;
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
