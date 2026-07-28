import { KQ_CARDS, type KqSupportCard } from "@/lib/kanab-quest-game";
import type { KqRankProfile } from "@/lib/kanab-quest-ranking";

export const KQ_SUPPORT_BOOSTER_POINTS_COST = 5;

function seededUnit(seed: number, slot: number) {
  const value = Math.sin(seed * 12.9898 + slot * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function pickRarity(unit: number): KqSupportCard["rarity"] {
  if (unit < 0.7) return "common";
  if (unit < 0.94) return "uncommon";
  return "rare";
}

function pickCard(cards: KqSupportCard[], rarity: KqSupportCard["rarity"], unit: number) {
  const pool = cards.filter((card) => card.rarity === rarity);
  return pool[Math.floor(unit * pool.length)];
}

function drawSupportCard(seed: number, slot: number, guaranteeCommon = false) {
  const activeCards = KQ_CARDS.filter((card) => card.category !== "pbi" || card.targets?.length);
  const rarity = guaranteeCommon ? "common" : pickRarity(seededUnit(seed, slot));
  return pickCard(activeCards, rarity, seededUnit(seed, slot + 1));
}

export function openKqSupportBooster(seed: number) {
  return Array.from({ length: 10 }, (_, index) => drawSupportCard(seed, index * 2, index === 0));
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
