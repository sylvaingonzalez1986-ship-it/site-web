import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import producerHeritageCards from "@/data/producer-heritage-cards.json";
import { KQ_CARD_ARTWORK, KQ_CARD_ILLUSTRATIONS } from "@/lib/kanab-quest-artwork";
import { KQ_ACTIVE_CARDS } from "@/lib/kanab-quest-game";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";

describe("Kanab Quest card artwork", () => {
  it("publishes Original Growing and removes retired producers from the current artwork catalogue", () => {
    expect(producerHeritageCards.cards.find((card) => card.code === "HERITAGE-020"))
      .toMatchObject({ producerName: "Original Growing", effect: "calm-target-relief" });
    for (const code of ["HERITAGE-013", "HERITAGE-014", "HERITAGE-015"]) {
      expect(producerHeritageCards.cards.some((card) => card.code === code)).toBe(false);
      expect(KQ_CARD_ARTWORK[code]).toBeUndefined();
      expect(KQ_CARD_ILLUSTRATIONS[code]).toBeUndefined();
    }
  });

  it("uses the published front and illustration of every current producer Heritage", () => {
    for (const card of producerHeritageCards.cards) {
      expect(KQ_CARD_ARTWORK[card.code], card.code).toBe(card.frontUrl);
      expect(KQ_CARD_ILLUSTRATIONS[card.code], card.code).toBe(card.illustrationUrl);
      expect(existsSync(join(process.cwd(), "public", card.frontUrl.slice(1))), card.frontUrl).toBe(true);
      expect(existsSync(join(process.cwd(), "public", card.illustrationUrl.slice(1))), card.illustrationUrl).toBe(true);
    }
  });

  it("covers every active Botte du Chanvrier and Heritage card with a distinct local WebP", () => {
    const codes = [...KQ_ACTIVE_CARDS, ...KQ_HERITAGE_CARDS].map((card) => card.code);
    const paths = codes.map((code) => KQ_CARD_ARTWORK[code]);
    expect(codes).toHaveLength(42);
    expect(paths.every(Boolean)).toBe(true);
    expect(new Set(paths).size).toBe(42);
    for (const artwork of paths) {
      expect(artwork.endsWith(".webp")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", artwork.slice(1))), artwork).toBe(true);
    }
  });

  it("keeps a distinct raw illustration behind every composed card front", () => {
    const codes = [...KQ_ACTIVE_CARDS, ...KQ_HERITAGE_CARDS].map((card) => card.code);
    const paths = codes.map((code) => KQ_CARD_ILLUSTRATIONS[code]);

    expect(paths.every(Boolean)).toBe(true);
    expect(new Set(paths).size).toBe(42);
    for (const artwork of paths) {
      expect(artwork.endsWith(".webp")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", artwork.slice(1))), artwork).toBe(true);
    }
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-006"]).toContain("deuxieme-chance-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-007"]).toContain("hydroponie-recirculante-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-008"]).toContain("aeroponie-haute-pression-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-021"]).toContain("diagnostic-croise-v1.webp");
    expect(KQ_CARD_ARTWORK["BOTTE-007"]).toContain("hydroponie-recirculante-front-v2.webp");
    expect(KQ_CARD_ARTWORK["BOTTE-008"]).toContain("aeroponie-haute-pression-front-v2.webp");
    expect(KQ_CARD_ARTWORK["BOTTE-021"]).toContain("diagnostic-croise-front-v7.webp");
    expect(KQ_CARD_ILLUSTRATIONS["HERITAGE-011"]).toContain("canopy-legacy-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["HERITAGE-012"]).toContain("signature-maitre-v2.webp");
    expect(KQ_CARD_ARTWORK["HERITAGE-011"]).toContain("front-v4.webp");
    expect(KQ_CARD_ARTWORK["HERITAGE-012"]).toContain("front-v4.webp");
  });
});
