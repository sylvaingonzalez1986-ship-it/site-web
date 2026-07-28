import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KQ_CARD_ARTWORK } from "@/lib/kanab-quest-artwork";
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
});
