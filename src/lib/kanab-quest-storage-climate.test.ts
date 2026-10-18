import { describe, expect, it } from "vitest";
import { KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseStorageClimateQuote } from "./kanab-quest-warehouse";
import { KQ_GAME_MONTH_MS } from "./kanab-quest-business";
import { createKqStorageClimateAccrual, getKqStorageClimateBilling, settleKqStorageClimateAccrual } from "./kanab-quest-storage-climate";

describe("post-harvest investment and monthly storage electricity", () => {
  it.each([
    ["SJ-DRYIT90", "SIM-DRYING-02", "SIM-DRYING-03"],
    ["LP-SUPER-1L", "BROR-JARS-48", "CURTEC-60L"],
  ])("charges more per m² and per capacity for each upgrade from %s", (...codes) => {
    const devices = codes.map(code => KQ_WAREHOUSE_CATALOG.find(device => device.code === code)!);
    const pricesPerM2 = devices.map(device => device.priceCents * device.zoneLayout!.unitsPerM2);
    const pricesPerGram = devices.map(device => device.priceCents / device.zoneLayout!.capacityGramsPerUnit);
    for (let tier = 1; tier < devices.length; tier++) {
      expect(pricesPerM2[tier]).toBeGreaterThan(pricesPerM2[tier - 1] * 3);
      expect(pricesPerGram[tier]).toBeGreaterThan(pricesPerGram[tier - 1]);
    }
  });

  it.each([["01", 6, 150], ["02", 12, 300], ["03", 24, 600]] as const)("quotes model %s per storage m² even without an active culture", (tier, kwh, cents) => {
    const starter = createKqWarehouseStarter();
    const state = { ...starter, zones: [], storageClimateCode: `SIM-STORAGE-CLIMATE-${tier}`,
      serviceZones: starter.serviceZones!.map(zone => zone.kind === "storage" ? { ...zone, width: 3, height: 2, y: 7 } : zone) };
    expect(getKqWarehouseStorageClimateQuote(state)).toEqual({ code: `SIM-STORAGE-CLIMATE-${tier}`, areaM2: 6,
      kwhPerM2: kwh, monthlyKwh: kwh * 6, monthlyCents: cents * 6, centsPerM2: cents });
  });

  it("does not bill equipment in reserve and does not repurchase owned models at the new price", () => {
    const starter = createKqWarehouseStarter();
    const owned = { ...starter, equipment: [...starter.equipment, { code: "SIM-STORAGE-CLIMATE-03", quantity: 1 }] };
    expect(getKqWarehouseStorageClimateQuote(owned)).toMatchObject({ code: null, monthlyCents: 0, monthlyKwh: 0 });
    expect(getKqWarehouseQuote({ ...owned, storageClimateCode: "SIM-STORAGE-CLIMATE-03" }, owned).totalCostCents).toBe(0);
    expect(getKqWarehouseStorageClimateQuote({ ...owned, storageClimateCode: "SIM-STORAGE-CLIMATE-03", serviceZones: [] })).toMatchObject({ code: null, areaM2: 0, monthlyCents: 0 });
  });

  it("bills elapsed use once and prorates both a tier change and removal", () => {
    const origin = Date.parse("2026-10-18T12:00:00Z");
    const room = { ...createKqWarehouseStarter(), storageClimateCode: "SIM-STORAGE-CLIMATE-01" };
    let accrual = createKqStorageClimateAccrual(room, origin);
    const upgraded = { ...room, storageClimateCode: "SIM-STORAGE-CLIMATE-03" };
    accrual = settleKqStorageClimateAccrual(accrual, upgraded, origin + KQ_GAME_MONTH_MS / 2).next;
    const stopped = { ...room }; delete (stopped as Partial<typeof stopped>).storageClimateCode;
    accrual = settleKqStorageClimateAccrual(accrual, stopped, origin + KQ_GAME_MONTH_MS * 3 / 4).next;
    expect(getKqStorageClimateBilling(accrual)).toMatchObject({ monthlyCostCents: 0, accruedCents: 225 });
    const settled = settleKqStorageClimateAccrual(accrual, stopped, origin + KQ_GAME_MONTH_MS * 3);
    expect(settled.issued).toHaveLength(1);
    expect(settled.issued[0].amountCents).toBe(225); // half a month at 150 + quarter at 600.
    expect(settleKqStorageClimateAccrual(settled.next, stopped, origin + KQ_GAME_MONTH_MS * 3).issued).toEqual([]);
    expect(getKqStorageClimateBilling(settled.next)).toMatchObject({ code: null, areaM2: 0, nextBillingAt: null, accruedCents: 0, outstandingCents: 225 });
  });

  it("retains fractional cents through interrupted billing periods", () => {
    const origin = Date.parse("2026-10-18T12:00:00Z"), hour = 3_600_000;
    const inactive = createKqWarehouseStarter(), room = { ...inactive, storageClimateCode: "SIM-STORAGE-CLIMATE-01" };
    let accrual = createKqStorageClimateAccrual(room, origin);
    for (let month = 0; month < 4; month++) {
      accrual = settleKqStorageClimateAccrual(accrual, inactive, origin + month * KQ_GAME_MONTH_MS + hour).next;
      accrual = settleKqStorageClimateAccrual(accrual, room, origin + (month + 1) * KQ_GAME_MONTH_MS).next;
    }
    expect(accrual.invoices.map(invoice => invoice.amountCents)).toEqual([1, 1, 1, 2]);
    expect(accrual.accruedCentsMs).toBe(0);
  });
});
