import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  drawKqHeritageCard,
  KQ_HERITAGE_CARDS,
  KQ_HERITAGE_CRAFT_COST,
  KQ_HERITAGE_DUPLICATE_FRAGMENTS,
  KQ_HERITAGE_EFFECTS,
  KQ_HERITAGE_EFFECT_TEMPLATES,
  resolveKqHeritageCard,
} from "@/lib/kanab-quest-heritage";

describe("Kanab Quest heritage cards", () => {
  it("ships twelve reusable mechanic templates without rarity", () => {
    expect(KQ_HERITAGE_CARDS).toHaveLength(12);
    expect(KQ_HERITAGE_CARDS.every((card) => !("rarity" in card))).toBe(true);
  });

  it("offers twenty-five distinct producer powers with unique tradeoffs", () => {
    expect(KQ_HERITAGE_EFFECT_TEMPLATES).toHaveLength(25);
    expect(KQ_HERITAGE_EFFECTS).toHaveLength(25);
    expect(new Set(KQ_HERITAGE_EFFECT_TEMPLATES.map((card) => card.effect)).size).toBe(25);
    expect(new Set(KQ_HERITAGE_EFFECT_TEMPLATES.map((card) => card.description)).size).toBe(25);
    expect(new Set(KQ_HERITAGE_EFFECT_TEMPLATES.map((card) => card.drawback)).size).toBe(25);
    expect(KQ_HERITAGE_EFFECT_TEMPLATES.every((card) => card.description.length >= 40 && card.drawback.length >= 40)).toBe(true);
  });

  it("describes the equipped producer mechanic when a legacy code has been reassigned", () => {
    expect(resolveKqHeritageCard({
      heritageCode: "HERITAGE-002",
      heritageEffect: "flower-lowest-plus-three",
      heritageName: "Floraison généreuse · Iznofarm",
      heritageProducerName: "Iznofarm",
    })).toMatchObject({
      code: "HERITAGE-002",
      name: "Floraison généreuse · Iznofarm",
      timing: "once-per-run",
      effect: "flower-lowest-plus-three",
      description: "En Floraison, ajoute +3 au dé le plus faible, sans dépasser 6.",
      producerName: "Iznofarm",
    });
    expect(resolveKqHeritageCard({
      heritageCode: "HERITAGE-002",
      heritageEffect: "flower-lowest-plus-three",
    })?.name).toBe("Floraison généreuse");
    expect(resolveKqHeritageCard({ heritageCode: "HERITAGE-002" })).toEqual(KQ_HERITAGE_CARDS[1]);
  });

  it("keeps the database catalogue aligned with every stronger power", () => {
    const migrations = [
      "20260805000200_kq_stronger_heritage_powers.sql",
      "20260809000100_kq_five_card_hand.sql",
    ].map((fileName) => fs.readFileSync(path.join(process.cwd(), "supabase/migrations", fileName), "utf8")).join("\n");
    KQ_HERITAGE_CARDS.forEach((card) => {
      expect(migrations).toContain(`'${card.code}'`);
      expect(migrations).toContain(`'${card.effect}'`);
      expect(migrations).toContain(card.description.replaceAll("'", "''"));
    });
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

  it("draws from a producer-driven catalogue of any size", () => {
    const cards = [
      ...KQ_HERITAGE_CARDS,
      { ...KQ_HERITAGE_CARDS[0], code: "HERITAGE-013", name: "Héritage du nouveau producteur" },
    ];
    const ownedCodes = cards.slice(0, -1).map((card) => card.code);
    expect(drawKqHeritageCard({ seed: 8, ownedCodes, cards }).card.code).toBe("HERITAGE-013");
  });
});
