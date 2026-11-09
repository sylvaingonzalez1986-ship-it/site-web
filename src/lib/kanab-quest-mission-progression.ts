import type { KqMissionReward } from "./kanab-quest-missions";

export type KqLevelRewardCode = `level-${number}`;
export type KqLevelReward = {
  code: KqLevelRewardCode;
  level: number;
  requiredXp: number;
  reward: KqMissionReward;
  rewardAvailable: boolean;
  claimed: boolean;
  claimable: boolean;
  entitlementId: string | null;
  packAvailable: boolean | null;
  cardCount: number;
};
export type KqMissionProgression = {
  totalXp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number | null;
  rewards: KqLevelReward[];
};

export const KQ_MISSION_MAX_LEVEL = 20;
/** Display and fixtures only. The database verifies XP and all reward claims. */
export function getKqMissionLevel(totalXp: number) {
  const xp = Number.isSafeInteger(totalXp) && totalXp >= 0 ? totalXp : 0;
  let level = 1, floor = 0;
  while (level < KQ_MISSION_MAX_LEVEL && xp >= floor + 100 + (level - 1) * 50) {
    floor += 100 + (level - 1) * 50;
    level++;
  }
  return { totalXp: xp, level, levelXp: xp - floor, nextLevelXp: level === KQ_MISSION_MAX_LEVEL ? null : 100 + (level - 1) * 50 };
}
export function isKqLevelRewardCode(value: unknown): value is KqLevelRewardCode {
  return typeof value === "string" && /^level-(?:[2-9]|1[0-9]|20)$/.test(value);
}
/** Invalid or absent server data is unknown, never an invented level one. */
export function isKqMissionProgression(value: unknown): value is KqMissionProgression {
  if (!value || typeof value !== "object") return false;
  const row = value as KqMissionProgression;
  if (!Number.isSafeInteger(row.totalXp) || row.totalXp < 0 || !Array.isArray(row.rewards)
    || row.rewards.some(reward => !reward || typeof reward !== "object")) return false;
  const expected = getKqMissionLevel(row.totalXp);
  return row.level === expected.level && row.levelXp === expected.levelXp && row.nextLevelXp === expected.nextLevelXp
    && row.rewards.length === 19
    && new Set(row.rewards.map(reward => reward.code)).size === 19
    && row.rewards.every(reward => isKqLevelRewardCode(reward.code) && reward.code === `level-${reward.level}`
      && reward.requiredXp === ((reward.level - 1) * (reward.level + 2) * 25)
      && typeof reward.claimed === "boolean" && typeof reward.claimable === "boolean"
      && typeof reward.rewardAvailable === "boolean" && !!reward.reward
      && (!reward.claimable || (!reward.claimed && row.totalXp >= reward.requiredXp)));
}
