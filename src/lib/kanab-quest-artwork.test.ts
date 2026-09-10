import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KQ_CARD_ARTWORK, KQ_CARD_ILLUSTRATIONS } from "@/lib/kanab-quest-artwork";
import { KQ_CARDS } from "@/lib/kanab-quest-game";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";

describe("Kanab Quest card artwork", () => {
  it("covers every La Botte and Heritage card with a distinct local WebP", () => {
    const codes = [...KQ_CARDS, ...KQ_HERITAGE_CARDS].map((card) => card.code);
    const paths = codes.map((code) => KQ_CARD_ARTWORK[code]);
    expect(codes).toHaveLength(48);
    expect(paths.every(Boolean)).toBe(true);
    expect(new Set(paths).size).toBe(48);
    for (const artwork of paths) {
      expect(artwork.endsWith(".webp")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", artwork.slice(1))), artwork).toBe(true);
    }
  });

  it("keeps a distinct raw illustration behind every composed card front", () => {
    const codes = [...KQ_CARDS, ...KQ_HERITAGE_CARDS].map((card) => card.code);
    const paths = codes.map((code) => KQ_CARD_ILLUSTRATIONS[code]);

    expect(paths.every(Boolean)).toBe(true);
    expect(new Set(paths).size).toBe(48);
    for (const artwork of paths) {
      expect(artwork.endsWith(".webp")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", artwork.slice(1))), artwork).toBe(true);
    }
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-006"]).toContain("deuxieme-chance-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-007"]).toContain("hydroponie-recirculante-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-008"]).toContain("aeroponie-haute-pression-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["BOTTE-021"]).toContain("engrais-bio-complet-v2.webp");
    expect(KQ_CARD_ARTWORK["BOTTE-007"]).toContain("hydroponie-recirculante-front-v2.webp");
    expect(KQ_CARD_ARTWORK["BOTTE-008"]).toContain("aeroponie-haute-pression-front-v2.webp");
    expect(KQ_CARD_ARTWORK["BOTTE-021"]).toContain("engrais-bio-complet-front-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["HERITAGE-011"]).toContain("canopy-legacy-v2.webp");
    expect(KQ_CARD_ILLUSTRATIONS["HERITAGE-012"]).toContain("signature-maitre-v2.webp");
    expect(KQ_CARD_ARTWORK["HERITAGE-011"]).toContain("front-v4.webp");
    expect(KQ_CARD_ARTWORK["HERITAGE-012"]).toContain("front-v4.webp");
  });
});
