import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getBuddieArtwork, hasModernBuddieArtwork } from "./buddie-artwork";
import readyCodes from "./buddie-artwork-ready.json";
import { KQ_BUDDIES } from "./kanab-quest-game";

describe("Buddies illustration catalog", () => {
  it("covers all 52 playable Buddies with distinct, valid 4:5 WebP scenes", async () => {
    expect([...readyCodes].sort()).toEqual(KQ_BUDDIES.map(({ code }) => code).sort());
    expect(readyCodes).toHaveLength(52);
    const hashes = await Promise.all(KQ_BUDDIES.map(async ({ code }) => {
      expect(hasModernBuddieArtwork(code)).toBe(true);
      const source = getBuddieArtwork(code, "/old-card.png");
      expect(source).toMatch(/^\/app\/kanab-quest\/buddies\/hh2026-\d{3}-scene-v2\.webp$/);
      const bytes = await readFile(path.join(process.cwd(), "public", source));
      const metadata = await sharp(bytes).metadata();
      expect({ format: metadata.format, width: metadata.width, height: metadata.height }, code)
        .toEqual({ format: "webp", width: 1024, height: 1280 });
      return createHash("sha256").update(bytes).digest("hex");
    }));
    expect(new Set(hashes).size).toBe(52);
  });

  it("preserves external catalog images for bonus, support and unknown codes", () => {
    for (const code of ["BOTTE-001", "HERITAGE-001", "BONUS-001", "HH2026-053", "hh2026-020", "HH2026-020/../../", ""]) {
      expect(hasModernBuddieArtwork(code)).toBe(false);
      expect(getBuddieArtwork(code, "https://example.com/original.png")).toBe("https://example.com/original.png");
    }
    expect(getBuddieArtwork("unknown")).toBe("");
  });
});
