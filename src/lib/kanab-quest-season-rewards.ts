export const KQ_SEASON_REWARDS_LIVE = false;
export const KQ_SEASON_MIN_BATTLES = 3;

export type KqSeasonStanding = {
  playerId: string;
  rank: number;
  seasonPoints: number;
  rating: number;
  wins: number;
  losses: number;
};

export type KqSeasonRewardTier = {
  code: "champion" | "podium" | "finalist" | "participant";
  label: string;
  title: string;
  frame: "or" | "argent-bronze" | "saison" | null;
  ribbon: string;
  supportBoosters: number;
  heritageFragments: number;
  specialInvite: boolean;
};

export const KQ_SEASON_REWARD_TIERS: readonly KqSeasonRewardTier[] = [
  {
    code: "champion",
    label: "Champion de saison",
    title: "Maître du Placard",
    frame: "or",
    ribbon: "Champion de saison",
    supportBoosters: 3,
    heritageFragments: 12,
    specialInvite: true,
  },
  {
    code: "podium",
    label: "Podium",
    title: "Cultivateur d’élite",
    frame: "argent-bronze",
    ribbon: "Podium de saison",
    supportBoosters: 2,
    heritageFragments: 8,
    specialInvite: true,
  },
  {
    code: "finalist",
    label: "Top 10",
    title: "Finaliste du Placard",
    frame: "saison",
    ribbon: "Finaliste de saison",
    supportBoosters: 1,
    heritageFragments: 3,
    specialInvite: false,
  },
  {
    code: "participant",
    label: "Participant classé",
    title: "Cultivateur de saison",
    frame: null,
    ribbon: "Saison complète",
    supportBoosters: 0,
    heritageFragments: 1,
    specialInvite: false,
  },
] as const;

export function getKqSeasonRewardTier(standing: KqSeasonStanding): KqSeasonRewardTier | null {
  if (standing.wins + standing.losses < KQ_SEASON_MIN_BATTLES || standing.rank < 1) return null;
  if (standing.rank === 1) return KQ_SEASON_REWARD_TIERS[0];
  if (standing.rank <= 3) return KQ_SEASON_REWARD_TIERS[1];
  if (standing.rank <= 10) return KQ_SEASON_REWARD_TIERS[2];
  return KQ_SEASON_REWARD_TIERS[3];
}

export function getKqSeasonDisplayCode(seasonCode: string) {
  const match = seasonCode.trim().match(/(?:^|[-_])(S\d+)$/i);
  return match ? match[1].toUpperCase() : seasonCode.trim();
}

export function personalizeKqSeasonRewardTier(
  tier: KqSeasonRewardTier,
  seasonCode: string,
): KqSeasonRewardTier {
  const label = getKqSeasonDisplayCode(seasonCode);
  return {
    ...tier,
    ribbon: tier.code === "participant"
      ? `Saison ${label} complète`
      : `${tier.ribbon} ${label}`,
  };
}

export function buildKqSeasonRewardPreview(
  seasonCode: string,
  standings: KqSeasonStanding[],
) {
  const seenPlayers = new Set<string>();
  const grants = standings.flatMap((standing) => {
    if (!standing.playerId || seenPlayers.has(standing.playerId)) return [];
    seenPlayers.add(standing.playerId);
    const baseTier = getKqSeasonRewardTier(standing);
    if (!baseTier) return [];
    const tier = personalizeKqSeasonRewardTier(baseTier, seasonCode);
    return [{
      grantKey: `${seasonCode}:${standing.playerId}:${tier.code}`,
      seasonCode,
      playerId: standing.playerId,
      rank: standing.rank,
      tier,
    }];
  });
  return {
    rewardsLive: KQ_SEASON_REWARDS_LIVE,
    seasonCode,
    eligiblePlayers: grants.length,
    totalSupportBoosters: grants.reduce((sum, grant) => sum + grant.tier.supportBoosters, 0),
    totalHeritageFragments: grants.reduce((sum, grant) => sum + grant.tier.heritageFragments, 0),
    grants,
  };
}
