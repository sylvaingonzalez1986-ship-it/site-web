export type KqNotebookReward = {
  supportBoosters: number;
  cultureTokens: number;
};

export const KQ_CULTURE_TOKEN_START_XP = 1;
export const KQ_CULTURE_TOKEN_RUN_CAP = 2;
export const KQ_NOTEBOOK_REWARDS_LIVE = false;

// Tasting missions are retired. Existing packs and culture tokens remain usable.
export const KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE: Readonly<Record<string, KqNotebookReward>> = {};

export function getKqNotebookReward(badgeCode: string): KqNotebookReward {
  return KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE[badgeCode] ?? { supportBoosters: 0, cultureTokens: 0 };
}

export function formatKqNotebookReward(reward: KqNotebookReward): string {
  const parts: string[] = [];
  if (reward.supportBoosters > 0) {
    parts.push(`${reward.supportBoosters} booster${reward.supportBoosters > 1 ? "s" : ""} Botte du Chanvrier`);
  }
  if (reward.cultureTokens > 0) {
    parts.push(`${reward.cultureTokens} jeton${reward.cultureTokens > 1 ? "s" : ""} Coup de pouce`);
  }
  return parts.join(" + ");
}
