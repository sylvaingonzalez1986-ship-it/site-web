export const KQ_REWARD_BALANCE = {
  training: {
    directSeasonPoints: { min: 0, max: 0 },
    arenaExperience: { min: 0.1, max: 0.1 },
    winnerCardCount: 1,
    affectsRating: false,
    affectsStreak: false,
  },
  pvp: {
    directSeasonPoints: { min: 3, max: 36 },
    arenaExperience: { min: 0.6, max: 1.6 },
    winnerCardCount: 3,
    affectsRating: true,
    affectsStreak: true,
  },
  seasonFormula: {
    winBase: 10,
    winDifficultyRange: 20,
    lossBase: 3,
    lossDifficultyRange: 3,
    streakStep: 2,
    streakBonusCap: 6,
  },
  pvpExperienceByWonRounds: {
    0: 0.6,
    1: 0.8,
    2: 1.4,
    3: 1.6,
  },
} as const;

export function getKqRemainingDailyChallengePoints(
  challenges: Iterable<{ claimKey: string; points: number }>,
  claimedChallengeCodes: Iterable<string>,
) {
  const claimed = new Set(claimedChallengeCodes);
  return Array.from(challenges).reduce(
    (total, challenge) => total + (claimed.has(challenge.claimKey) ? 0 : challenge.points),
    0,
  );
}

export function auditKqRewardBalance() {
  const issues: string[] = [];
  if (KQ_REWARD_BALANCE.training.directSeasonPoints.max >= KQ_REWARD_BALANCE.pvp.directSeasonPoints.min) {
    issues.push("Les points directs de l’entraînement doivent rester sous le minimum PvP.");
  }
  if (KQ_REWARD_BALANCE.training.arenaExperience.max >= KQ_REWARD_BALANCE.pvp.arenaExperience.min) {
    issues.push("L’EXP d’entraînement doit rester sous le minimum PvP.");
  }
  if (KQ_REWARD_BALANCE.training.winnerCardCount >= KQ_REWARD_BALANCE.pvp.winnerCardCount) {
    issues.push("La récompense de cartes d’entraînement doit rester sous la récompense PvP.");
  }
  return { valid: issues.length === 0, issues };
}
