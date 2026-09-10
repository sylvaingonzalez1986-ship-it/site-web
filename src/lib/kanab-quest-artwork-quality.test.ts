import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  KQ_CARD_ARTWORK,
  KQ_CARD_ILLUSTRATIONS,
} from "@/lib/kanab-quest-artwork";
import { KQ_EQUIPMENT_ARTWORK } from "@/lib/kanab-quest-equipment-artwork";
import {
  KQ_POWER_OUTAGE_ARTWORK,
  KQ_SITUATION_ARTWORK,
} from "@/lib/kanab-quest-situation-artwork";

const publicPath = (src: string) => join(process.cwd(), "public", src.slice(1));
const sha256 = (src: string) => createHash("sha256")
  .update(readFileSync(publicPath(src)))
  .digest("hex");

const cardIllustrations = Object.values(KQ_CARD_ILLUSTRATIONS);
const cardFronts = Object.values(KQ_CARD_ARTWORK);
const situations = [
  ...Object.values(KQ_SITUATION_ARTWORK).map((artwork) => artwork.src),
  KQ_POWER_OUTAGE_ARTWORK.src,
];
const equipment = Object.values(KQ_EQUIPMENT_ARTWORK).map((artwork) => artwork.src);
const everyProductionAsset = [
  ...cardIllustrations,
  ...cardFronts,
  ...situations,
  ...equipment,
];

describe("Kanab Quest artwork production quality", () => {
  it("does not ship the same bitmap behind two different artwork references", () => {
    const hashes = everyProductionAsset.map(sha256);
    expect(new Set(hashes).size).toBe(everyProductionAsset.length);
  });

  it("keeps cards portrait and gameplay scenes square", async () => {
    const cardMetadata = await Promise.all(
      [...cardIllustrations, ...cardFronts].map((src) => sharp(publicPath(src)).metadata()),
    );
    const squareMetadata = await Promise.all(
      [...situations, ...equipment].map((src) => sharp(publicPath(src)).metadata()),
    );

    cardMetadata.forEach(({ width, height }) => {
      expect(width).toBeTypeOf("number");
      expect(height).toBeTypeOf("number");
      expect(width! * 3).toBe(height! * 2);
    });
    squareMetadata.forEach(({ width, height }) => {
      expect(width).toBeGreaterThanOrEqual(1200);
      expect(width).toBe(height);
    });
  });

  it("keeps runtime WebP assets inside their mobile transfer budgets", () => {
    const assertMaximumBytes = (src: string, maximumBytes: number) => {
      expect(statSync(publicPath(src)).size, src).toBeLessThanOrEqual(maximumBytes);
    };

    cardFronts.forEach((src) => assertMaximumBytes(src, 600 * 1024));
    situations.forEach((src) => assertMaximumBytes(src, 700 * 1024));
    equipment.forEach((src) => assertMaximumBytes(src, 600 * 1024));
    cardIllustrations.forEach((src) => assertMaximumBytes(src, 1100 * 1024));
  });
});
