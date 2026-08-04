export type KqNotebookReward = {
  supportBoosters: number;
  cultureTokens: number;
};

export const KQ_CULTURE_TOKEN_START_XP = 1;
export const KQ_CULTURE_TOKEN_RUN_CAP = 2;
export const KQ_NOTEBOOK_REWARDS_LIVE = true;

export const KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE: Readonly<Record<string, KqNotebookReward>> = {
  "premier-carnet": { supportBoosters: 1, cultureTokens: 0 },
  "combo-aromatique": { supportBoosters: 1, cultureTokens: 0 },
};

export function getKqNotebookReward(badgeCode: string): KqNotebookReward {
  return KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE[badgeCode] ?? { supportBoosters: 0, cultureTokens: 0 };
}

export function formatKqNotebookReward(reward: KqNotebookReward): string {
  const parts: string[] = [];
  if (reward.supportBoosters > 0) {
    parts.push(`${reward.supportBoosters} booster${reward.supportBoosters > 1 ? "s" : ""} La Botte`);
  }
  if (reward.cultureTokens > 0) {
    parts.push(`${reward.cultureTokens} jeton${reward.cultureTokens > 1 ? "s" : ""} Coup de pouce`);
  }
  return parts.join(" + ");
}
