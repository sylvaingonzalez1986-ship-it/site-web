import type { KqBattle } from "@/lib/kanab-quest-battle";

export type KqRankProfile = {
  playerId: string;
  name: string;
  rating: number;
  seasonPoints: number;
  wins: number;
  losses: number;
  streak: number;
  burnedFlowers: number;
  lastRatingDelta: number;
  lastSeasonPointsDelta: number;
  processedBattleIds: string[];
  claimedChallengeCodes: string[];
  lastClaimedChallengeCodes: string[];
  claimedArenaRewardKeys: string[];
  lastArenaRewardCards: string[];
};

export type KqRival = {
  id: string;
  name: string;
  variety: string;
  rating: number;
  seedOffset: number;
};

export type KqRankableStanding = {
  id: string;
  rating: number;
  seasonPoints: number;
  wins: number;
};

export function compareKqStandings(a: KqRankableStanding, b: KqRankableStanding) {
  return b.rating - a.rating
    || b.seasonPoints - a.seasonPoints
    || b.wins - a.wins
    || a.id.localeCompare(b.id);
}

export const KQ_RIVALS: KqRival[] = [
  { id: "rival-maya", name: "Maya du Club", variety: "Sour Tsunami", rating: 980, seedOffset: 17 },
  { id: "rival-jules", name: "Jules Green", variety: "ACDC", rating: 1025, seedOffset: 29 },
  { id: "rival-nora", name: "Nora Botanica", variety: "Cannatonic", rating: 1070, seedOffset: 43 },
  { id: "rival-sami", name: "Sami du Comptoir", variety: "Harlequin", rating: 935, seedOffset: 61 },
  { id: "rival-lina", name: "Lina Terpènes", variety: "Charlotte’s Web", rating: 1120, seedOffset: 73 },
  { id: "rival-theo", name: "Théo des Serres", variety: "Lifter", rating: 1175, seedOffset: 89 },
  { id: "rival-ines", name: "Inès Botanique", variety: "Elektra", rating: 1235, seedOffset: 101 },
  { id: "rival-awa", name: "Awa du Cercle", variety: "Remedy", rating: 1300, seedOffset: 127 },
];

export function createKqRankProfile(): KqRankProfile {
  return { playerId: "local-player", name: "Toi", rating: 1000, seasonPoints: 0, wins: 0, losses: 0, streak: 0, burnedFlowers: 0, lastRatingDelta: 0, lastSeasonPointsDelta: 0, processedBattleIds: [], claimedChallengeCodes: [], lastClaimedChallengeCodes: [], claimedArenaRewardKeys: [], lastArenaRewardCards: [] };
}

export function getKqMatchmaking(profile: KqRankProfile, count = 3) {
  return [...KQ_RIVALS].sort((a, b) => Math.abs(a.rating - profile.rating) - Math.abs(b.rating - profile.rating)).slice(0, count);
}

export function getKqRatingStake(playerRating: number, opponentRating: number) {
  const expected = 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  return {
    win: Math.round(24 * (1 - expected)),
    loss: Math.round(-24 * expected),
  };
}

const KQ_LEAGUES = [
  { name: "Graine", minRating: 0, nextRating: 950 },
  { name: "Pousse", minRating: 950, nextRating: 1050 },
  { name: "Canopée", minRating: 1050, nextRating: 1150 },
  { name: "Fleur", minRating: 1150, nextRating: 1250 },
  { name: "Grand Cru", minRating: 1250, nextRating: null },
] as const;

export function getKqLeague(rating: number) {
  const league = [...KQ_LEAGUES].reverse().find((entry) => rating >= entry.minRating) ?? KQ_LEAGUES[0];
  const progress = league.nextRating === null ? 100 : Math.max(0, Math.min(100, Math.round((rating - league.minRating) / (league.nextRating - league.minRating) * 100)));
  return {
    ...league,
    progress,
    pointsToNext: league.nextRating === null ? 0 : Math.max(0, league.nextRating - rating),
  };
}

export function applyKqBattleToRanking(profile: KqRankProfile, battle: KqBattle, opponentRating: number) {
  if (battle.status !== "verdict" || !battle.winner || profile.processedBattleIds.includes(battle.id)) return profile;
  const won = battle.winner === "player";
  const stake = getKqRatingStake(profile.rating, opponentRating);
  const ratingDelta = won ? stake.win : stake.loss;
  const seasonPointsDelta = won ? 25 + Math.min(10, profile.streak * 2) : 8;
  return {
    ...profile,
    rating: Math.max(100, profile.rating + ratingDelta),
    seasonPoints: profile.seasonPoints + seasonPointsDelta,
    wins: profile.wins + (won ? 1 : 0),
    losses: profile.losses + (won ? 0 : 1),
    streak: won ? profile.streak + 1 : 0,
    burnedFlowers: profile.burnedFlowers + 1,
    lastRatingDelta: ratingDelta,
    lastSeasonPointsDelta: seasonPointsDelta,
    lastClaimedChallengeCodes: [],
    lastArenaRewardCards: [],
    processedBattleIds: [...profile.processedBattleIds, battle.id],
  };
}

export function getKqLocalLeaderboard(profile: KqRankProfile) {
  return [
    ...KQ_RIVALS.map((rival) => ({ id: rival.id, name: rival.name, rating: rival.rating, seasonPoints: 0, wins: 0, isPlayer: false })),
    { id: profile.playerId, name: profile.name, rating: profile.rating, seasonPoints: profile.seasonPoints, wins: profile.wins, isPlayer: true },
  ].sort(compareKqStandings).map((entry, index) => ({ ...entry, rank: index + 1 }));
}
