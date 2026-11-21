import { getKqWarehouseRetailPrice } from "./kanab-quest-warehouse-retail";
import { existsSync } from "node:fs";
import { getKqCareProductArtwork } from "./kanab-quest-care-artwork";
import { KQ_WAREHOUSE_PREPARATION_CATALOG, getKqWarehouseInputPack, isKqWarehouseInputCode } from "./kanab-quest-warehouse-preparations";
import { describe, expect, it } from "vitest";
import { KQ_WAREHOUSE_CATALOG, getKqWarehouseDevice } from "./kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_FAMILIES } from "./kanab-quest-warehouse-options";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseServiceZoneQuote, getKqWarehouseZoneQuote, isKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";

describe("warehouse retail input packs", () => {
  it("gives every purchased pack a physical format, sourced price, whole game charges and its own illustration", () => {
    const codes = Object.keys(KQ_WAREHOUSE_PREPARATION_CATALOG).filter(isKqWarehouseInputCode);
    expect(codes).toHaveLength(18);
    for (const code of codes) {
      const pack = getKqWarehouseInputPack(code)!;
      const artwork = getKqCareProductArtwork(code)!;
      expect(pack.format.length).toBeGreaterThan(0);
      expect(pack.packPriceCents).toBeGreaterThan(0);
      expect(pack.chargesPerPack).toBeGreaterThan(0);
      expect(Number.isInteger(pack.chargesPerPack)).toBe(true);
      expect(artwork.referenceUrl).toBe(pack.url);
      expect(existsSync(`public${artwork.src}`)).toBe(true);
    }
    expect(new Set(codes.map(code => getKqCareProductArtwork(code)?.src)).size).toBe(codes.length);
    expect(getKqWarehouseInputPack("WAREHOUSE-MOP")).toBeUndefined();
    expect(getKqWarehouseInputPack("__proto__")).toBeUndefined();
    expect(getKqWarehouseInputPack("CARE-APHIDIUS")).toMatchObject({ packPriceCents: 2226, chargesPerPack: 500 });
    expect(getKqWarehouseInputPack("CARE-PHYTOSEIULUS")).toMatchObject({ packPriceCents: 1695, chargesPerPack: 25 });
  });
});

describe("fictional equipment tiers", () => {
  it("offers exactly three purchasable tiers at their documented retail prices", () => {
    for (const kind of ["lighting", "air", "drying", "storage"]) {
      const devices = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === kind && device.purchasable !== false);
      expect(devices.map(device => device.tier)).toEqual(["economy", "standard", "premium"]);
      for (const device of devices) expect(device.priceCents).toBe(getKqWarehouseRetailPrice(device.code)?.unitPriceCents);
    }
    for (const family of KQ_WAREHOUSE_OPTION_FAMILIES) {
      const options = KQ_WAREHOUSE_OPTIONS.filter(option => option.family === family.code);
      expect(options.map(option => option.tier)).toEqual(["economy", "standard", "premium"]);
      for (const option of options) {
        const retail = getKqWarehouseRetailPrice(option.code);
        if (retail) expect(option.unitPriceCents).toBe(retail.unitPriceCents);
      }
    }
  });

  it("actually lowers billed energy with higher lighting/extraction tiers when their coverage is used", () => {
    const base = { ...createKqWarehouseStarter().zones[0], width: 40, height: 10 };
    for (const kind of ["lighting", "air"]) {
      const codes = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === kind && device.purchasable !== false).map(device => device.code);
      const quotes = codes.map(code => getKqWarehouseZoneQuote({ ...base, [kind === "lighting" ? "lightingCode" : "airCode"]: code }));
      expect(quotes[1].energyCostCents).toBeLessThan(quotes[0].energyCostCents);
      expect(quotes[2].energyCostCents).toBeLessThan(quotes[1].energyCostCents);
    }
  });

  it("charges whole units at their retail price for every valid zone, including partially used devices", () => {
    const base = { ...createKqWarehouseStarter().zones[0], x: 0, y: 0 };
    for (const kind of ["lighting", "air", "drying", "storage"] as const) {
      const devices = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === kind && device.purchasable !== false);
      for (let width = 1; width <= 40; width++) for (let height = 1; height <= 25; height++) {
        const area = width * height;
        const quotes = devices.map(device => kind === "lighting" || kind === "air"
          ? getKqWarehouseZoneQuote({ ...base, width, height, [kind === "lighting" ? "lightingCode" : "airCode"]: device.code })
          : getKqWarehouseServiceZoneQuote({ id: "test", name: "Test", x: 0, y: 0, width, height, kind, deviceCode: device.code }));
        for (const [index, quote] of quotes.entries()) {
          const line = quote.devices.find(item => item.code === devices[index].code)!;
          const expectedCount = devices[index].zoneLayout ? area * devices[index].zoneLayout.unitsPerM2
            : Math.ceil(area / devices[index].gameCapacity.value);
          expect(line.quantity).toBe(expectedCount);
          expect(line.totalCents).toBe(expectedCount * devices[index].priceCents);
        }
      }
    }
  });

  it("improves zone profiles by tier and prices the shared cart independently of the culture", () => {
    for (const family of KQ_WAREHOUSE_OPTION_FAMILIES) {
      const options = KQ_WAREHOUSE_OPTIONS.filter(option => option.family === family.code);
      if (family.code === "logistics") {
        expect(options.map(option => option.yieldBonusPercent)).toEqual([1, 0, 3]);
        expect(options[1]).toMatchObject({ name: "Chariot de manutention", qualityBonus: 0, consumablesCentsPerM2: 0 });
        expect(options[2].consumablesCentsPerM2).toBeGreaterThan(options[0].consumablesCentsPerM2);
        continue;
      }
      expect(options.map(option => option.yieldBonusPercent)).toEqual([1, 2, 3]);
      expect(options[1].qualityBonus).toBeGreaterThanOrEqual(options[0].qualityBonus);
      expect(options[2].qualityBonus).toBeGreaterThanOrEqual(options[1].qualityBonus);
      expect(options[1].consumablesCentsPerM2).toBeGreaterThan(options[0].consumablesCentsPerM2);
      expect(options[2].consumablesCentsPerM2).toBeGreaterThan(options[1].consumablesCentsPerM2);
    }
  });

  it("adds real simulated drying/storage capacity without inventing electricity charges", () => {
    for (const kind of ["drying", "storage"] as const) {
      const devices = KQ_WAREHOUSE_CATALOG.filter(device => device.kind === kind);
      const quotes = devices.map(device => getKqWarehouseServiceZoneQuote({ id: "service", name: "Service", x: 0, y: 0, width: 1, height: 1, kind, deviceCode: device.code }));
      expect(quotes[1].capacityGrams).toBeGreaterThan(quotes[0].capacityGrams);
      expect(quotes[2].capacityGrams).toBeGreaterThan(quotes[1].capacityGrams);
      expect(devices.every(device => device.watts === 0)).toBe(true);
    }
  });

  it("preserves historical lamp inventory and run charges but refuses forged new purchases", () => {
    const starter = createKqWarehouseStarter();
    const old = {
      ...starter,
      zones: starter.zones.map(zone => ({ ...zone, lightingCode: "MH-FCE3000" })),
      equipment: starter.equipment.map(item => item.code === "MH-TS1000" ? { ...item, code: "MH-FCE3000" } : item),
    };
    expect(getKqWarehouseDevice("MH-FCE3000")).toMatchObject({ priceCents: 19900, watts: 300, purchasable: false, gameCapacity: { value: 2 } });
    const frozen = getKqWarehouseRunSnapshot(old);
    expect(frozen).toMatchObject({ powerWatts: 335, energyKwh: 350.4, energyCostCents: 8760 });
    expect(isKqWarehouseRunSnapshot(frozen)).toBe(true);
    expect(getKqWarehouseQuote(old, old).totalCostCents).toBe(0);
    const replacement = getKqWarehouseQuote({ ...old, zones: starter.zones }, old);
    expect(replacement.nextState.equipment).toContainEqual({ code: "MH-FCE3000", quantity: 1 });
    const restored = getKqWarehouseQuote({ ...replacement.nextState, zones: old.zones }, replacement.nextState);
    expect(restored.totalCostCents).toBe(0);
    expect(() => getKqWarehouseQuote(old, starter)).toThrow("historique");
    expect(() => getKqWarehouseQuote({ ...old, equipment: [...old.equipment.filter(item => item.code !== "MH-FCE3000"), { code: "MH-FCE3000", quantity: 2 }] }, old)).toThrow("historique");
    expect(isKqWarehouseRunSnapshot(frozen)).toBe(true);
  });

  it("identifies the retail price of every purchasable device", () => {
    for (const device of KQ_WAREHOUSE_CATALOG.filter(item => item.purchasable !== false)) {
      const reference = getKqWarehouseRetailPrice(device.code);
      expect(reference, device.code).toBeDefined();
      expect(device.sourceUrl).toEqual(reference?.url);
      expect(device.priceCents).toEqual(reference?.unitPriceCents);
      expect(device.priceBasis).toBe("observed");
    }
  });
});
