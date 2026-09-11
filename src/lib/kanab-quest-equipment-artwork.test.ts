import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getKqEquipmentArtwork,
  KQ_EQUIPMENT_ARTWORK,
} from "@/lib/kanab-quest-equipment-artwork";
import { KQ_EQUIPMENT_CATALOG } from "@/lib/kanab-quest-equipment";

describe("Kanab Quest equipment artwork", () => {
  it("ships one distinct local WebP hero object for every catalog item", () => {
    const artwork = Object.values(KQ_EQUIPMENT_ARTWORK);
    expect(artwork).toHaveLength(22);
    expect(new Set(artwork.map((item) => item.src)).size).toBe(22);

    artwork.forEach((item) => {
      expect(item.src.endsWith(".webp")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", item.src.slice(1))), item.src).toBe(true);
      expect(item.alt.length).toBeGreaterThan(30);
    });
  });

  it("covers the full equipment catalog with dedicated artwork", () => {
    const expectedCodes = KQ_EQUIPMENT_CATALOG
      .map((equipment) => equipment.code)
      .sort();

    expect(expectedCodes).toHaveLength(15);
    expect(Object.keys(KQ_EQUIPMENT_ARTWORK)).toEqual(expect.arrayContaining(expectedCodes));
    ["AUTO-SIEVE", "WASHER-75G", "TSS-225", "STATIC-PLASMA"].forEach((code) => {
      expect(getKqEquipmentArtwork(code)?.src).toContain(`equipment-${code}-hero-v2.webp`);
    });
  });

  it("returns a safe fallback for an unknown equipment code", () => {
    expect(getKqEquipmentArtwork("LED-300")?.src).toContain("equipment-LED-300");
    expect(getKqEquipmentArtwork("PRESS-2T")?.src).toContain("equipment-PRESS-2T");
    expect(getKqEquipmentArtwork("UNKNOWN")).toBeNull();
  });
});
