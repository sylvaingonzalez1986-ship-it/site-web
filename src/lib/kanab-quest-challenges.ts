import type { KqBattle } from "@/lib/kanab-quest-battle";
import type { KqGameState } from "@/lib/kanab-quest-game";
import type { KqRankProfile } from "@/lib/kanab-quest-ranking";

export type KqChallengeResult = {
  code: string;
  claimKey: string;
  dayKey: string;
  title: string;
  description: string;
  points: number;
  completed: boolean;
};

type KqChallengeFacts = {
  game: KqGameState;
  battle: KqBattle;
  sparks: number;
  successfulStages: number;
  criticalStages: number;
  failedStages: number;
  playerRoundWins: number;
};

type KqChallengeDefinition = Omit<KqChallengeResult, "claimKey" | "dayKey" | "completed"> & {
  isCompleted: (facts: KqChallengeFacts) => boolean;
};

const KQ_CHALLENGE_POOL: KqChallengeDefinition[] = [
  { code: "steady-grower", title: "Main sûre", description: "Terminer avec moins de 3 Pressions.", points: 8, isCompleted: ({ game }) => game.phase === "complete" && game.pressure < 3 },
  { code: "spark-hunter", title: "Chasseur d’étincelles", description: "Obtenir au moins 4 Étincelles pendant la culture.", points: 10, isCompleted: ({ sparks }) => sparks >= 4 },
  { code: "green-streak", title: "Série verte", description: "Réussir au moins 4 étapes de production.", points: 8, isCompleted: ({ successfulStages }) => successfulStages >= 4 },
  { code: "biocontrol", title: "Défense biologique", description: "Déclencher le combo PBI ciblée.", points: 12, isCompleted: ({ game }) => game.combos.includes("PBI ciblée") },
  { code: "clean-sweep", title: "Jury unanime", description: "Remporter les trois manches du concours.", points: 15, isCompleted: ({ battle, playerRoundWins }) => battle.status === "verdict" && playerRoundWins === 3 },
  { code: "no-failure", title: "Sans accroc", description: "Finir la culture sans aucun échec.", points: 12, isCompleted: ({ game, failedStages }) => game.phase === "complete" && failedStages === 0 },
  { code: "critical-touch", title: "Main brillante", description: "Obtenir au moins 2 réussites exceptionnelles.", points: 10, isCompleted: ({ criticalStages }) => criticalStages >= 2 },
  { code: "jury-edge", title: "Décision serrée", description: "Gagner le concours par deux manches à une.", points: 9, isCompleted: ({ battle, playerRoundWins }) => battle.status === "verdict" && battle.winner === "player" && playerRoundWins === 2 },
  { code: "comeback", title: "Retour en force", description: "Gagner malgré au moins un échec de culture.", points: 11, isCompleted: ({ battle, failedStages }) => battle.status === "verdict" && battle.winner === "player" && failedStages >= 1 },
];

export function getKqChallengeDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function challengeRotation(dayKey: string) {
  const start = Number(dayKey.replaceAll("-", "")) % KQ_CHALLENGE_POOL.length;
  return Array.from({ length: 3 }, (_, index) => KQ_CHALLENGE_POOL[(start + index * 4) % KQ_CHALLENGE_POOL.length]);
}

export function getKqDailyChallenges(date = new Date()) {
  const dayKey = getKqChallengeDayKey(date);
  return challengeRotation(dayKey).map((challenge) => ({
    code: challenge.code,
    title: challenge.title,
    description: challenge.description,
    points: challenge.points,
    dayKey,
    claimKey: `${dayKey}:${challenge.code}`,
  }));
}

export function getKqGameChallengeDate(game: KqGameState, fallback = new Date()) {
  if (game.challengeDayKey && /^\d{4}-\d{2}-\d{2}$/.test(game.challengeDayKey)) return new Date(`${game.challengeDayKey}T12:00:00Z`);
  const date = new Date(game.seed);
  return game.seed >= 1_000_000_000_000 && !Number.isNaN(date.getTime()) ? date : fallback;
}

export function getKqChallengeProgress(game: KqGameState, code: string) {
  const sparks = game.history.reduce((sum, entry) => sum + (entry.sparks ?? entry.dice.filter((die) => die === 6).length), 0);
  const successes = game.history.filter((entry) => entry.outcome === "success" || entry.outcome === "critical").length;
  const criticals = game.history.filter((entry) => entry.outcome === "critical").length;
  const failures = game.history.filter((entry) => entry.outcome === "failure").length;
  if (code === "steady-grower") return { label: `Pression ${game.pressure}/3`, reached: game.pressure < 3 };
  if (code === "spark-hunter") return { label: `${Math.min(sparks, 4)}/4 Étincelles`, reached: sparks >= 4 };
  if (code === "green-streak") return { label: `${Math.min(successes, 4)}/4 étapes`, reached: successes >= 4 };
  if (code === "biocontrol") return { label: game.combos.includes("PBI ciblée") ? "Combo réalisé" : "Combo à réaliser", reached: game.combos.includes("PBI ciblée") };
  if (code === "no-failure") return { label: failures === 0 ? "Aucun échec" : `${failures} échec${failures > 1 ? "s" : ""}`, reached: failures === 0 };
  if (code === "critical-touch") return { label: `${Math.min(criticals, 2)}/2 critiques`, reached: criticals >= 2 };
  return { label: "Décidé par le jury", reached: false };
}

export function evaluateKqChallenges(game: KqGameState, battle: KqBattle, date = getKqGameChallengeDate(game)): KqChallengeResult[] {
  const sparks = game.history.reduce((sum, entry) => sum + (entry.sparks ?? entry.dice.filter((die) => die === 6).length), 0);
  const successfulStages = game.history.filter((entry) => entry.outcome === "success" || entry.outcome === "critical").length;
  const criticalStages = game.history.filter((entry) => entry.outcome === "critical").length;
  const failedStages = game.history.filter((entry) => entry.outcome === "failure").length;
  const playerRoundWins = battle.rounds.filter((round) => round.winner === "player").length;
  const dayKey = game.challengeDayKey ?? getKqChallengeDayKey(date);
  const facts = { game, battle, sparks, successfulStages, criticalStages, failedStages, playerRoundWins };

  return challengeRotation(dayKey).map(({ isCompleted, ...challenge }) => ({
    ...challenge,
    dayKey,
    claimKey: `${dayKey}:${challenge.code}`,
    completed: isCompleted(facts),
  }));
}

export function claimKqChallenges(profile: KqRankProfile, challenges: KqChallengeResult[]) {
  const newlyCompleted = challenges.filter((challenge) => challenge.completed && !profile.claimedChallengeCodes.includes(challenge.claimKey));
  if (newlyCompleted.length === 0) return profile;
  const challengePoints = newlyCompleted.reduce((sum, challenge) => sum + challenge.points, 0);
  return {
    ...profile,
    seasonPoints: profile.seasonPoints + challengePoints,
    lastSeasonPointsDelta: profile.lastSeasonPointsDelta + challengePoints,
    claimedChallengeCodes: [...profile.claimedChallengeCodes, ...newlyCompleted.map((challenge) => challenge.claimKey)],
    lastClaimedChallengeCodes: newlyCompleted.map((challenge) => challenge.claimKey),
  };
}
