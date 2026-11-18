import type { WarehouseSpatialItem, WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { getGrowRoomShellRegistration } from "./KqGrowRoomShellRegistration";
export type GrowCamera = {
  zoom: number;
  x: number;
  z: number;
};
export const OVERVIEW: GrowCamera = { zoom: 1, x: 0, z: 0 };
export const ELEVATION_SIN = 12 / Math.hypot(20, 12), ELEVATION_COS = 20 / Math.hypot(20, 12);
export const CAMERA_HEIGHT = 1.35;
export function cameraScale(layout: WarehouseSpatialLayout, width: number, height: number, zoom: number) {
  const { slab, wallHeight } = getGrowRoomShellRegistration(layout);
  const w = slab.width + Math.abs(slab.x) * 2, d = slab.depth + Math.abs(slab.z) * 2;
  const horizontal = w * .8 + d * .6;
  const vertical = (w * .6 + d * .8) * ELEVATION_SIN + Math.max(3.05, (wallHeight - CAMERA_HEIGHT) * 2) * ELEVATION_COS;
  return Math.min(width / horizontal, height / vertical) * .94 * zoom;
}
export function projectRoomPoint(x: number, y: number, z: number, camera: GrowCamera, scale: number, width: number, height: number) {
  x -= camera.x;
  z -= camera.z;
  return { x: width / 2 + (x * .8 - z * .6) * scale, y: height / 2 + ((x * .6 + z * .8) * ELEVATION_SIN - (y - CAMERA_HEIGHT) * ELEVATION_COS) * scale };
}
export function unprojectFloor(px: number, py: number, camera: GrowCamera, scale: number, width: number, height: number) {
  const right = (px - width / 2) / scale, front = ((py - height / 2) / scale - CAMERA_HEIGHT * ELEVATION_COS) / ELEVATION_SIN;
  return { x: camera.x + .8 * right + .6 * front, z: camera.z - .6 * right + .8 * front };
}
export function projectedFootprint(item: Pick<WarehouseSpatialItem, "x" | "z" | "width" | "depth">, camera: GrowCamera, scale: number, width: number, height: number, planeY = .017) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => { const point = projectRoomPoint(item.x + i * item.width / 2, planeY, item.z + j * item.depth / 2, camera, scale, width, height); return point.x.toFixed(2) + "," + point.y.toFixed(2); }).join(" ");
}
export function clampCamera(next: GrowCamera, layout: WarehouseSpatialLayout): GrowCamera {
  const zoom = Math.max(1, Math.min(6, next.zoom));
  if (zoom === 1)
    return OVERVIEW;
  const limit = (extent: number) => ((extent + 2) * .60) * (1 - 1 / zoom);
  return { zoom, x: Math.max(-limit(layout.width), Math.min(limit(layout.width), next.x)), z: Math.max(-limit(layout.depth), Math.min(limit(layout.depth), next.z)) };
}
