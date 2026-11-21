import { describe, expect, it } from "vitest";
import { getKqWarehouseDevice } from "./kanab-quest-warehouse-catalog";
import { getKqWarehouseLightingCount, getKqWarehouseLightingLayout, getKqWarehouseZoneLightingLayout } from "./kanab-quest-warehouse-fixtures";
import { createKqWarehouseStarter, getKqWarehouseEquipmentDemand, getKqWarehouseZoneQuote, KQ_WAREHOUSE_UNLIT_CODE } from "./kanab-quest-warehouse";

describe("warehouse lighting footprints", () => {
  it.each([
    [1, 1, "MH-TS1000"], [10, 1, "SIM-LIGHT-03"], [1, 10, "SIM-LIGHT-03"],
    [3, 3, "SIM-LIGHT-02"], [7, 3, "MH-FCE3000"], [40, 25, "MH-TS1000"],
  ] as const)("tiles %d × %d m with the paid count of %s", (width, depth, lightingCode) => {
    const zone = { ...createKqWarehouseStarter().zones[0], width, height: depth, lightingCode };
    const capacity = getKqWarehouseDevice(lightingCode)!.gameCapacity.value;
    const fixtures = getKqWarehouseLightingLayout(width, depth, lightingCode);
    const count = Math.ceil(width * depth / capacity);
    expect(fixtures).toHaveLength(count);
    expect(getKqWarehouseZoneQuote(zone).devices.find(device => device.code === lightingCode)?.quantity).toBe(count);
    expect(getKqWarehouseEquipmentDemand([zone]).find(device => device.code === lightingCode)?.quantity).toBe(count);
    expect(new Set(fixtures.map(({ x, z }) => `${x},${z}`)).size).toBe(count);
    const rows = new Map<number, { end: number; start: number; depth: number }>();
    const alongX = width >= depth;
    for (const fixture of fixtures) {
      const [start, span, offset, strip] = alongX
        ? [fixture.left, fixture.width, fixture.top, fixture.depth]
        : [fixture.top, fixture.depth, fixture.left, fixture.width];
      const prior = rows.get(fixture.row);
      expect(start).toBeCloseTo(prior?.end ?? 0);
      expect(offset).toBeCloseTo(prior?.start ?? offset);
      expect(fixture.width * fixture.depth).toBeCloseTo(width * depth / count);
      expect(fixture.width * fixture.depth).toBeLessThanOrEqual(capacity + 1e-9);
      expect(fixture.x).toBeCloseTo(fixture.left + fixture.width / 2);
      expect(fixture.z).toBeCloseTo(fixture.top + fixture.depth / 2);
      rows.set(fixture.row, { end: start + span, start: offset, depth: strip });
    }
    let end = 0;
    for (const row of rows.values()) {
      expect(row.end).toBeCloseTo(Math.max(width, depth));
      expect(row.start).toBeCloseTo(end);
      end += row.depth;
    }
    expect(end).toBeCloseTo(Math.min(width, depth));
  });

  it("uses projected bounds and preserves layout identity on a quarter turn", () => {
    const zone = { width: 4, height: 2, lightingCode: "SIM-LIGHT-03" };
    expect(getKqWarehouseZoneLightingLayout(zone)).toEqual([
      { x: 1, z: 1, left: 0, top: 0, width: 2, depth: 2, row: 0 },
      { x: 3, z: 1, left: 2, top: 0, width: 2, depth: 2, row: 0 },
    ]);
    for (const rotation of [90, 270] as const) {
      const projected = getKqWarehouseZoneLightingLayout({ ...zone, width: 2, height: 4, rotation });
      expect(projected.map(({ x, z }) => [x, z])).toEqual(rotation === 90 ? [[1, 3], [1, 1]] : [[1, 1], [1, 3]]);
    }
  });

  it("does not add a fixture for empty support or a non-lighting model", () => {
    for (const code of [undefined, KQ_WAREHOUSE_UNLIT_CODE, "SIM-AIR-01"]) {
      expect(getKqWarehouseLightingCount(5, 4, code)).toBe(0);
      expect(getKqWarehouseLightingLayout(5, 4, code)).toEqual([]);
    }
  });
});
