import { getKqWarehouseDevice } from "./kanab-quest-warehouse-catalog";
import type { KqWarehouseZone } from "./kanab-quest-warehouse";

export type KqWarehouseLightingFixture = {
  x: number;
  z: number;
  left: number;
  top: number;
  width: number;
  depth: number;
  row: number;
};

export function getKqWarehouseLightingCount(width: number, depth: number, code?: string): number {
  const device = code === undefined ? undefined : getKqWarehouseDevice(code);
  if (device?.kind !== "lighting" || device.gameCapacity.unit !== "m2" || width <= 0 || depth <= 0) return 0;
  const units = Math.ceil(width * depth / device.gameCapacity.value);
  return Number.isSafeInteger(units) ? units : 0;
}

/** Each row uses equal spacing along the long axis. Its strip shares the short
 * axis in proportion to its number of fixtures, so all footprints have equal area. */
export function getKqWarehouseLightingLayout(width: number, depth: number, code?: string): KqWarehouseLightingFixture[] {
  const count = getKqWarehouseLightingCount(width, depth, code);
  if (!count) return [];
  const alongX = width >= depth;
  const long = Math.max(width, depth), short = Math.min(width, depth);
  const rows = Math.max(1, Math.round(Math.sqrt(count * short / long)));
  const fixtures: KqWarehouseLightingFixture[] = [];
  for (let row = 0; row < rows; row++) {
    const start = Math.round(row * count / rows), end = Math.round((row + 1) * count / rows);
    const span = long / (end - start);
    const stripStart = short * start / count, stripEnd = short * end / count;
    for (let column = 0; column < end - start; column++) {
      const left = alongX ? span * column : stripStart;
      const top = alongX ? stripStart : span * column;
      const width = alongX ? span : stripEnd - stripStart;
      const depth = alongX ? stripEnd - stripStart : span;
      fixtures.push({ x: left + width / 2, z: top + depth / 2, left, top, width, depth, row });
    }
  }
  return fixtures;
}

/** Same fixtures projected into the saved plan's axes and relative to its origin. */
export function getKqWarehouseZoneLightingLayout(zone: Pick<KqWarehouseZone, "width" | "height" | "rotation" | "lightingCode">): KqWarehouseLightingFixture[] {
  const { rotation = 0 } = zone;
  const quarterTurn = rotation === 90 || rotation === 270;
  const width = quarterTurn ? zone.height : zone.width, depth = quarterTurn ? zone.width : zone.height;
  return getKqWarehouseLightingLayout(width, depth, zone.lightingCode).map(fixture => {
    const transformed = {
      width: quarterTurn ? fixture.depth : fixture.width,
      depth: quarterTurn ? fixture.width : fixture.depth,
      left: fixture.left,
      top: fixture.top,
    };
    if (rotation === 90) {
      transformed.left = fixture.top;
      transformed.top = width - fixture.left - fixture.width;
    } else if (rotation === 180) {
      transformed.left = width - fixture.left - fixture.width;
      transformed.top = depth - fixture.top - fixture.depth;
    } else if (rotation === 270) {
      transformed.left = depth - fixture.top - fixture.depth;
      transformed.top = fixture.left;
    }
    return { ...fixture, ...transformed, x: transformed.left + transformed.width / 2, z: transformed.top + transformed.depth / 2 };
  });
}

/** Metres from the back-left corner of the unrotated zone. These are the centres
 * of the original air and tent lighting sprites where applicable. */
export function getKqWarehouseFixturePositions(width: number, depth: number, kind: "lighting" | "air", code: string) {
  if (kind === "lighting" && !["LED-150-STARTER", "LED-300", "LED-500"].includes(code)) {
    return getKqWarehouseLightingLayout(width, depth, code).map(({ x, z }) => ({ x, z }));
  }
  const coverage = getKqWarehouseDevice(code)?.gameCapacity?.value ?? (kind === "lighting" ? 1 : 20);
  const area = width * depth;
  const offsetX = kind === "lighting" ? 14 / 30 : 24.5 / 30;
  const offsetZ = kind === "lighting" ? 7.5 / 30 : 24.5 / 30;
  return Array.from({ length: Math.ceil(area / coverage) }, (_, index) => {
    const cell = Math.min(area - 1, Math.floor(index * coverage));
    return { x: cell % width + offsetX, z: Math.floor(cell / width) + offsetZ };
  });
}
