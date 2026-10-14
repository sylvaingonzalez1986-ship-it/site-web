import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getKqEquipmentArtwork,
  KQ_EQUIPMENT_ARTWORK,
} from "@/lib/kanab-quest-equipment-artwork";
import { KQ_EQUIPMENT_CATALOG } from "@/lib/kanab-quest-equipment";
import { getKqWarehouseProductArtwork, getKqWorkshopProductArtwork } from "./kanab-quest-warehouse-product-artwork";
import { KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTIONS } from "./kanab-quest-warehouse-options";

describe("Kanab Quest equipment artwork", () => {
  it("ships one distinct local WebP hero object for every catalog item", () => {
    const artwork = Object.values(KQ_EQUIPMENT_ARTWORK);
    expect(artwork).toHaveLength(25);
    expect(new Set(artwork.map((item) => item.src)).size).toBe(25);

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

    expect(expectedCodes).toHaveLength(17);
    expect(Object.keys(KQ_EQUIPMENT_ARTWORK)).toEqual(expect.arrayContaining(expectedCodes));
    for (const code of expectedCodes.filter(code => !code.startsWith("TENT-"))) expect(getKqEquipmentArtwork(code)?.src).toMatch(/^\/placard\/equipment-sylvain-v1\//);
    ["WASHER-75G", "TSS-225"].forEach((code) => {
      expect(getKqEquipmentArtwork(code)?.src).toContain(`equipment-${code}-hero-v2.webp`);
    });
  });

  it("gives each warehouse family three distinct illustrations without changing saved codes", () => {
    const offers = [...KQ_WAREHOUSE_CATALOG.filter(item => item.purchasable !== false && item.kind !== "processing"), ...KQ_WAREHOUSE_OPTIONS];
    expect(offers).toHaveLength(36);
    expect(offers.some(item => item.code.startsWith("TENT-"))).toBe(false);
    const artwork = offers.map(item => getKqWarehouseProductArtwork(item.code));
    expect(new Set(artwork.map(item => item?.src)).size).toBe(36);
    for (const [index, item] of artwork.entries()) {
      expect(item?.tier).toBe(offers[index].tier);
      expect(item?.src).toMatch(/^\/placard\/equipment-sylvain-v1\/[a-z]+-[123]\.webp$/);
      expect(existsSync(join(process.cwd(), "public", item!.src.slice(1))), item?.src).toBe(true);
    }
    expect(getKqWarehouseProductArtwork("MH-FCE3000")?.src).toBe(getKqWarehouseProductArtwork("SIM-LIGHT-02")?.src);
    expect(getKqWarehouseProductArtwork("UNKNOWN")).toBeNull();
  });

  it("shares all eighteen workshop illustrations between tier offers and equipment details", () => {
    const codes = ["SIFT-TRAY", "PRESS-0600", "WASHER-25L", "AUTO-SIEVE", "FREEZE-DRYER", "STATIC-PLASMA"];
    const sources = codes.flatMap(code => [1, 4, 7].map(level => {
      const artwork = getKqWorkshopProductArtwork(code, level)!;
      expect(getKqEquipmentArtwork(code, level)?.src).toBe(artwork.src);
      expect(existsSync(join(process.cwd(), "public", artwork.src.slice(1))), artwork.src).toBe(true);
      return artwork.src;
    }));
    expect(new Set(sources).size).toBe(18);
  });

  it("returns a safe fallback for an unknown equipment code", () => {
    expect(getKqEquipmentArtwork("LED-300")?.src).toContain("lighting-2");
    expect(getKqEquipmentArtwork("PRESS-2T")?.src).toContain("equipment-PRESS-2T");
    expect(getKqEquipmentArtwork("UNKNOWN")).toBeNull();
  });
});
