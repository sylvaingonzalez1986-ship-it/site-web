import { KQ_WAREHOUSE_ART_FRAMES } from "@/lib/kanab-quest-warehouse-artwork";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";

type Floor = Pick<WarehouseSpatialLayout, "width" | "depth">;
const SOURCE_SIZE = 1024;

// Pixel centres of the fixtures on the approved, renovated overhead drawing.
// North/south refer to the top/bottom of KqWarehousePlan, not the isometric camera.
export const GROW_SHELL_LANDMARKS = {
  "frame-nw": [37, 36], "frame-ne": [986, 36],
  "frame-sw": [37, 949], "frame-se": [986, 949],
  "south-door": [512, 944], "south-threshold": [512, 892],
  "north-extractor": [427, 67], "north-power": [648, 66],
  "north-light-west": [211, 65], "north-light-east": [815, 65],
  "west-power": [80, 332], "west-lamp": [82, 515], "east-lamp": [940, 515],
} as const;
export type ShellLandmark = keyof typeof GROW_SHELL_LANDMARKS;

export function getGrowRoomShellRegistration(layout: Floor) {
  const frame = layout.width === 40 && layout.depth === 25 ? KQ_WAREHOUSE_ART_FRAMES.legacy : KQ_WAREHOUSE_ART_FRAMES.compact;
  const unitX = frame.width / SOURCE_SIZE / frame.grid.cell;
  const unitZ = frame.height / SOURCE_SIZE / frame.grid.cell;
  const x = (pixel: number) => pixel * unitX - frame.grid.x / frame.grid.cell - layout.width / 2;
  const z = (pixel: number) => pixel * unitZ - frame.grid.y / frame.grid.cell - layout.depth / 2;
  function bounds(x0: number, z0: number, x1: number, z1: number) {
    return { x: (x(x0) + x(x1)) / 2, z: (z(z0) + z(z1)) / 2, width: (x1 - x0) * unitX, depth: (z1 - z0) * unitZ };
  }
  function landmark(id: ShellLandmark) {
    const [px, py] = GROW_SHELL_LANDMARKS[id];
    return { id, x: x(px), z: z(py) };
  }
  return {
    frame, x, z, unitX, unitZ, bounds, landmark, landmarks: Object.keys(GROW_SHELL_LANDMARKS) as ShellLandmark[],
    slab: bounds(18, 12, 1006, 990),
    resin: bounds(103, 111, 921, 891),
    // Widths follow the calibrated plan. The illustration carries no vertical measurement.
    wallHeight: layout.width === 40 ? 3.25 : 2.74,
  };
}
