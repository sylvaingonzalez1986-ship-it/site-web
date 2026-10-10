import { KQ_ACTIVE_CARDS, type KqSupportCard } from "@/lib/kanab-quest-game";
import type { KqRankProfile } from "@/lib/kanab-quest-ranking";

export const KQ_SUPPORT_BOOSTER_POINTS_COST = 5;
/** Per random slot; the first slot of a booster is always common. */
export const KQ_SUPPORT_RARITY_WEIGHTS = { common: 70, uncommon: 23, rare: 6, epic: 1 } as const;

function seededUnit(seed: number, slot: number) {
  const value = Math.sin(seed * 12.9898 + slot * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function pickKqSupportRarity(unit: number): KqSupportCard["rarity"] {
  if (!Number.isFinite(unit) || unit < 0 || unit >= 1) throw new Error("Invalid support rarity draw");
  const roll = Math.floor(unit * 100) + 1;
  if (roll <= 70) return "common";
  if (roll <= 93) return "uncommon";
  if (roll <= 99) return "rare";
  return "epic";
}

function pickCard(cards: KqSupportCard[], rarity: KqSupportCard["rarity"], unit: number) {
  const pool = cards.filter((card) => card.rarity === rarity);
  if (!pool.length) throw new Error(`Support rarity unavailable: ${rarity}`);
  return pool[Math.floor(unit * pool.length)];
}

export function drawKqSupportCard(seed: number, slot = 0, guaranteeCommon = false) {
  const rarity = guaranteeCommon ? "common" : pickKqSupportRarity(seededUnit(seed, slot));
  return pickCard(KQ_ACTIVE_CARDS, rarity, seededUnit(seed, slot + 1));
}

export function openKqSupportBooster(seed: number) {
  return Array.from({ length: 10 }, (_, index) => drawKqSupportCard(seed, index * 2, index === 0));
}

export function addKqBoosterToInventory(inventory: Record<string, number>, cards: KqSupportCard[]) {
  const next = { ...inventory };
  cards.forEach((card) => { next[card.code] = (next[card.code] ?? 0) + 1; });
  return next;
}

export function applyKqArenaStreakReward(profile: KqRankProfile, inventory: Record<string, number>, seed: number) {
  if (profile.streak <= 0 || profile.streak % 3 !== 0) return { profile, inventory, cards: [] as KqSupportCard[] };
  const rewardKey = `streak-${profile.wins}-${profile.streak}`;
  if (profile.claimedArenaRewardKeys.includes(rewardKey)) return { profile, inventory, cards: [] as KqSupportCard[] };
  const cards = openKqSupportBooster(seed + profile.wins * 97);
  return {
    inventory: addKqBoosterToInventory(inventory, cards),
    cards,
    profile: {
      ...profile,
      claimedArenaRewardKeys: [...profile.claimedArenaRewardKeys, rewardKey],
      lastArenaRewardCards: cards.map((card) => card.code),
    },
  };
}
