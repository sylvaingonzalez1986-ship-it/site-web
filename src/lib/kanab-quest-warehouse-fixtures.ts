import { getKqWarehouseDevice } from "./kanab-quest-warehouse-catalog";

/** Metres from the back-left corner of the unrotated zone. These are the centres
 * of the two equipment sprites on the original 30-pixel plan cell. */
export function getKqWarehouseFixturePositions(width: number, depth: number, kind: "lighting" | "air", code: string) {
  const coverage = getKqWarehouseDevice(code)?.gameCapacity?.value ?? (kind === "lighting" ? 1 : 20);
  const area = width * depth;
  const offsetX = kind === "lighting" ? 14 / 30 : 24.5 / 30;
  const offsetZ = kind === "lighting" ? 7.5 / 30 : 24.5 / 30;
  return Array.from({ length: Math.ceil(area / coverage) }, (_, index) => {
    const cell = Math.min(area - 1, Math.floor(index * coverage));
    return { x: cell % width + offsetX, z: Math.floor(cell / width) + offsetZ };
  });
}
