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
    for (const code of expectedCodes.filter(code => !code.startsWith("TENT-") && !getKqWorkshopProductArtwork(code))) expect(getKqEquipmentArtwork(code)?.src).toMatch(/^\/placard\/equipment-sylvain-v1\//);
    ["WASHER-75G", "TSS-225"].forEach((code) => {
      expect(getKqEquipmentArtwork(code)?.src).toContain(`equipment-${code}-hero-v2.webp`);
    });
  });

  it("covers every warehouse offer with three distinct tier illustrations per family", () => {
    const offers = [...KQ_WAREHOUSE_CATALOG.filter(item => item.purchasable !== false && item.kind !== "processing"), ...KQ_WAREHOUSE_OPTIONS];
    expect(offers).toHaveLength(39);
    expect(offers.some(item => item.code.startsWith("TENT-"))).toBe(false);
    const artwork = offers.map(item => getKqWarehouseProductArtwork(item.code));
    // Storage climate machines reuse the established climate-family tier art.
    expect(new Set(artwork.map(item => item?.src)).size).toBe(36);
    for (const [index, item] of artwork.entries()) {
      expect(item?.tier).toBe(offers[index].tier);
      expect(item?.src).toMatch(/^\/placard\/equipment-sylvain-v1\/[a-z]+-[123]\.webp$/);
      expect(existsSync(join(process.cwd(), "public", item!.src.slice(1))), item?.src).toBe(true);
    }
    const repeatedSources = [...new Set(artwork.map(item => item!.src))]
      .filter(src => artwork.filter(item => item!.src === src).length > 1);
    expect(repeatedSources.sort()).toEqual([1, 2, 3].map(tier => `/placard/equipment-sylvain-v1/climate-${tier}.webp`));
    for (const suffix of ["01", "02", "03"]) {
      expect(getKqWarehouseProductArtwork(`SIM-STORAGE-CLIMATE-${suffix}`)?.src)
        .toBe(getKqWarehouseProductArtwork(`SIM-CLIMATE-${suffix}`)?.src);
    }
    expect(getKqWarehouseProductArtwork("MH-FCE3000")?.src).toBe(getKqWarehouseProductArtwork("SIM-LIGHT-02")?.src);
    expect(getKqWarehouseProductArtwork("UNKNOWN")).toBeNull();
  });

  it("shares ten restored illustrations between workshop offers and details without inventing tier models", () => {
    const models = {
      "SIFT-TRAY": ["SIFT-TRAY", "SIFT-TRAY", "SIFT-TRAY"],
      "PRESS-0600": ["PRESS-0600", "PRESS-10T", "PRESS-20T"],
      "WASHER-25L": ["WASHER-25L", "WASHER-75G", "TSS-225"],
      "AUTO-SIEVE": ["AUTO-SIEVE", "AUTO-SIEVE", "AUTO-SIEVE"],
      "FREEZE-DRYER": ["FREEZE-DRYER", "FREEZE-DRYER", "FREEZE-DRYER"],
      "STATIC-PLASMA": ["STATIC-PLASMA", "STATIC-PLASMA", "STATIC-PLASMA"],
    };
    const sources = Object.entries(models).flatMap(([code, expectedModels]) => [1, 4, 7].map((level, index) => {
      const artwork = getKqWorkshopProductArtwork(code, level)!;
      expect(artwork.src).toBe(`/app/kanab-quest/equipment/equipment-${expectedModels[index]}-hero-v2.webp`);
      expect(artwork.tier).toBe(["economy", "standard", "premium"][index]);
      expect(artwork.alt.length).toBeGreaterThan(30);
      expect(getKqEquipmentArtwork(code, level)?.src).toBe(artwork.src);
      expect(existsSync(join(process.cwd(), "public", artwork.src.slice(1))), artwork.src).toBe(true);
      return artwork.src;
    }));
    expect(new Set(sources).size).toBe(10);
    for (const offer of KQ_WAREHOUSE_CATALOG.filter(item => item.kind === "processing")) {
      expect(getKqWarehouseProductArtwork(offer.code)?.src).toBe(getKqWorkshopProductArtwork(offer.legacyCode!, offer.tier === "premium" ? 7 : offer.tier === "standard" ? 4 : 1)?.src);
    }
  });

  it("keeps the existing 1/4/7 tier boundaries and normalizes invalid levels", () => {
    for (const [level, model] of [[1, "PRESS-0600"], [3, "PRESS-0600"], [4, "PRESS-10T"], [6, "PRESS-10T"], [7, "PRESS-20T"], [10, "PRESS-20T"]] as const) {
      expect(getKqWorkshopProductArtwork("PRESS-0600", level)?.src).toContain(`equipment-${model}-hero-v2.webp`);
    }
    for (const level of [0, 11, 1.5, NaN]) expect(getKqWorkshopProductArtwork("PRESS-0600", level)?.src).toContain("equipment-PRESS-0600-hero-v2.webp");
    expect(getKqWorkshopProductArtwork("toString")).toBeNull();
    expect(getKqWorkshopProductArtwork("__proto__")).toBeNull();
  });

  it("returns a safe fallback for an unknown equipment code", () => {
    expect(getKqEquipmentArtwork("LED-300")?.src).toContain("lighting-2");
    expect(getKqEquipmentArtwork("PRESS-2T")?.src).toContain("equipment-PRESS-2T");
    expect(getKqEquipmentArtwork("UNKNOWN")).toBeNull();
  });
});
