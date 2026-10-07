import type { MissionRewardType } from "@/types/missions";

export const MISSION_REWARD_LIMITS: Record<MissionRewardType, number> = {
  packs: 20, points: 1000, support_pack: 5, buddies: 1, game_cash: 100000,
};

export function formatMissionReward(reward: {
  rewardType: MissionRewardType;
  rewardAmount: number;
  rewardCardName?: string | null;
}): string {
  const amount = reward.rewardAmount;
  switch (reward.rewardType) {
    case "packs": return `${amount} pack${amount > 1 ? "s" : ""} Buddies`;
    case "points": return `${amount} point${amount > 1 ? "s" : ""} fidélité`;
    case "support_pack": return `${amount} pack${amount > 1 ? "s" : ""} Botte du Chanvrier (${amount > 1 ? "3 cartes chacun" : "3 cartes"})`;
    case "buddies": return reward.rewardCardName ? `Buddy ${reward.rewardCardName}` : "1 Buddy";
    case "game_cash": return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount / 100)} € du jeu`;
  }
}

export function getMissionRewardDestination(rewardType: MissionRewardType): { href: string; label: string } {
  switch (rewardType) {
    case "points": return { href: "/profil?tab=fidelite", label: "Voir mes points" };
    case "packs": return { href: "/profil/collection", label: "Ouvrir mes packs Buddies" };
    case "buddies": return { href: "/profil/collection", label: "Voir mes Buddies" };
    case "support_pack": return { href: "/arene/placard?view=shop", label: "Ouvrir mes packs Botte du Chanvrier" };
    case "game_cash": return { href: "/arene/placard", label: "Retrouver mon argent du jeu" };
  }
}
