import { describe, expect, it } from "vitest";
import {
  drawKqHeritageCard,
  KQ_HERITAGE_CARDS,
  KQ_HERITAGE_CRAFT_COST,
  KQ_HERITAGE_DUPLICATE_FRAGMENTS,
} from "@/lib/kanab-quest-heritage";

describe("Kanab Quest heritage cards", () => {
  it("ships twelve permanent cards without rarity", () => {
    expect(KQ_HERITAGE_CARDS).toHaveLength(12);
    expect(KQ_HERITAGE_CARDS.every((card) => !("rarity" in card))).toBe(true);
  });

  it("uses one identical duplicate reward and crafting cost", () => {
    expect(KQ_HERITAGE_DUPLICATE_FRAGMENTS).toBe(1);
    expect(KQ_HERITAGE_CRAFT_COST).toBe(5);
  });

  it("prioritizes every missing card equally", () => {
    const first = drawKqHeritageCard({ seed: 42 });
    const ownedCodes = KQ_HERITAGE_CARDS.filter((card) => card.code !== first.card.code).map((card) => card.code);
    const draw = drawKqHeritageCard({ seed: 42, ownedCodes });
    expect(draw.card.code).toBe(first.card.code);
    expect(draw.duplicate).toBe(false);
  });

  it("is deterministic and only reports a duplicate when the collection is complete", () => {
    const ownedCodes = KQ_HERITAGE_CARDS.map((card) => card.code);
    const first = drawKqHeritageCard({ seed: 9, ownedCodes });
    const second = drawKqHeritageCard({ seed: 9, ownedCodes });
    expect(first).toEqual(second);
    expect(first.duplicate).toBe(true);
  });
});
