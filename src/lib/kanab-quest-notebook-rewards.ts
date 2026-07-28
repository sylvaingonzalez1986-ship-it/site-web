export type KqNotebookReward = {
  supportBoosters: number;
  cultureTokens: number;
};

export const KQ_CULTURE_TOKEN_START_XP = 1;
export const KQ_CULTURE_TOKEN_RUN_CAP = 2;
// Intentionally dormant while the public site is live. Activating the reward
// pipeline requires the complete launch checklist documented in the game design.
export const KQ_NOTEBOOK_REWARDS_LIVE = false;

export const KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE: Readonly<Record<string, KqNotebookReward>> = {
  "premier-carnet": { supportBoosters: 1, cultureTokens: 0 },
  "gouteur-regulier": { supportBoosters: 1, cultureTokens: 2 },
  "premiere-piste": { supportBoosters: 1, cultureTokens: 0 },
  "combo-aromatique": { supportBoosters: 1, cultureTokens: 1 },
  "nez-absolu": { supportBoosters: 2, cultureTokens: 1 },
  "expert-outdoor": { supportBoosters: 1, cultureTokens: 1 },
  "expert-greenhouse": { supportBoosters: 1, cultureTokens: 1 },
  "expert-indoor": { supportBoosters: 1, cultureTokens: 1 },
  "critique-utile": { supportBoosters: 0, cultureTokens: 1 },
  "validateur-serieux": { supportBoosters: 0, cultureTokens: 1 },
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
