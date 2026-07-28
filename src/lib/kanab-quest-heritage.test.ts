import { describe, expect, it } from "vitest";
import {
  drawKqHeritageCard,
  getKqHeritageRarity,
  KQ_HERITAGE_CARDS,
  KQ_HERITAGE_CRAFT_COSTS,
  KQ_HERITAGE_DUPLICATE_FRAGMENTS,
  KQ_HERITAGE_PITY_THRESHOLD,
} from "@/lib/kanab-quest-heritage";

describe("Kanab Quest heritage cards", () => {
  it("ships the agreed 6 / 4 / 2 permanent catalog", () => {
    expect(KQ_HERITAGE_CARDS).toHaveLength(12);
    expect(KQ_HERITAGE_CARDS.filter((card) => card.rarity === "common")).toHaveLength(6);
    expect(KQ_HERITAGE_CARDS.filter((card) => card.rarity === "rare")).toHaveLength(4);
    expect(KQ_HERITAGE_CARDS.filter((card) => card.rarity === "epic")).toHaveLength(2);
  });

  it("converts duplicates without making epic cards directly craftable", () => {
    expect(KQ_HERITAGE_DUPLICATE_FRAGMENTS).toEqual({ common: 1, rare: 3, epic: 8 });
    expect(KQ_HERITAGE_CRAFT_COSTS).toEqual({ common: 5, rare: 12, epic: null });
  });

  it("guarantees a rare or epic after five common pulls", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      expect(getKqHeritageRarity(seed, KQ_HERITAGE_PITY_THRESHOLD)).not.toBe("common");
    }
  });

  it("prioritizes a missing card inside the rolled rarity", () => {
    const first = drawKqHeritageCard({ seed: 42, pullsWithoutRare: 0 });
    const ownedSameRarity = KQ_HERITAGE_CARDS
      .filter((card) => card.rarity === first.card.rarity && card.code !== first.card.code)
      .map((card) => card.code);
    const draw = drawKqHeritageCard({ seed: 42, pullsWithoutRare: 0, ownedCodes: ownedSameRarity });
    expect(draw.card.code).toBe(first.card.code);
    expect(draw.duplicate).toBe(false);
  });

  it("is deterministic and only reports a duplicate when the rarity is complete", () => {
    const rarity = getKqHeritageRarity(9, 0);
    const ownedCodes = KQ_HERITAGE_CARDS.filter((card) => card.rarity === rarity).map((card) => card.code);
    const first = drawKqHeritageCard({ seed: 9, pullsWithoutRare: 0, ownedCodes });
    const second = drawKqHeritageCard({ seed: 9, pullsWithoutRare: 0, ownedCodes });
    expect(first).toEqual(second);
    expect(first.duplicate).toBe(true);
  });
});
