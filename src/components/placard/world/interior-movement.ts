import type { InteriorObject, InteriorRoom } from "./interior-types";

export type InteriorPoint = { x: number; z: number };
export const INTERIOR_PLAYER_RADIUS = 0.22;
export const INTERIOR_EYE_HEIGHT = 1.65;
/** One-metre paid-floor cells; the surrounding circulation apron is excluded. */
export function interiorFloorCell(point: InteriorPoint, room: Pick<InteriorRoom, "width" | "depth" | "workArea">): InteriorPoint | null {
  const width = room.workArea?.width ?? room.width, depth = room.workArea?.depth ?? room.depth;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)
    || point.x < -width / 2 || point.x >= width / 2 || point.z < -depth / 2 || point.z >= depth / 2) return null;
  return { x: Math.floor(point.x + width / 2) + 0.5 - width / 2, z: Math.floor(point.z + depth / 2) + 0.5 - depth / 2 };
}
type CollisionRoom = Pick<InteriorRoom, "width" | "depth" | "objects"> & Partial<Pick<InteriorRoom, "spawn">>;
const EPSILON = 0.00001;

function solid(object: InteriorObject) {
  return object.solid !== false && object.kind !== "exit";
}

/** Final, rotated footprints are already supplied by the room model. */
export function interiorPositionIsFree(point: InteriorPoint, room: CollisionRoom, radius = INTERIOR_PLAYER_RADIUS) {
  if (Math.abs(point.x) > room.width / 2 - radius + EPSILON || Math.abs(point.z) > room.depth / 2 - radius + EPSILON) return false;
  return !room.objects.some(object => solid(object)
    && Math.abs(point.x - object.x) < object.width / 2 + radius - EPSILON
    && Math.abs(point.z - object.z) < object.depth / 2 + radius - EPSILON);
}

/** Deterministic recovery after loading a layout or adding furniture around a player. */
export function findInteriorSpawn(point: InteriorPoint, room: CollisionRoom, radius = INTERIOR_PLAYER_RADIUS): InteriorPoint {
  const limitX = Math.max(0, room.width / 2 - radius), limitZ = Math.max(0, room.depth / 2 - radius);
  const clampX = (x: number) => Math.max(-limitX, Math.min(limitX, x));
  const clampZ = (z: number) => Math.max(-limitZ, Math.min(limitZ, z));
  const origin = { x: clampX(point.x), z: clampZ(point.z) };
  if (interiorPositionIsFree(origin, room, radius)) return origin;
  // The configured entrance sits in the clear circulation apron. Prefer this bounded
  // recovery after a confirmed edit instead of enumerating all furniture intersections.
  if (room.spawn) {
    const entrance = { x: clampX(room.spawn[0]), z: clampZ(room.spawn[1]) };
    if (interiorPositionIsFree(entrance, room, radius)) return entrance;
  }
  const xs = [origin.x, -limitX, limitX], zs = [origin.z, -limitZ, limitZ];
  room.objects.filter(solid).forEach(object => {
    xs.push(clampX(object.x - object.width / 2 - radius), clampX(object.x + object.width / 2 + radius));
    zs.push(clampZ(object.z - object.depth / 2 - radius), clampZ(object.z + object.depth / 2 + radius));
  });
  let result = origin, distance = Infinity;
  for (const x of xs) for (const z of zs) {
    const candidate = { x, z }, squared = (x - point.x) ** 2 + (z - point.z) ** 2;
    if (squared < distance && interiorPositionIsFree(candidate, room, radius)) { result = candidate; distance = squared; }
  }
  return result;
}

/** Small swept steps avoid tunnelling; separate axes permit sliding along walls. */
export function moveInteriorPlayer(point: InteriorPoint, delta: InteriorPoint, room: CollisionRoom, radius = INTERIOR_PLAYER_RADIUS): InteriorPoint {
  const result = interiorPositionIsFree(point, room, radius) ? { ...point } : findInteriorSpawn(point, room, radius);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.z)) / (radius / 2)));
  const dx = delta.x / steps, dz = delta.z / steps;
  for (let i = 0; i < steps; i++) {
    const alongX = { x: result.x + dx, z: result.z };
    if (interiorPositionIsFree(alongX, room, radius)) result.x = alongX.x;
    const alongZ = { x: result.x, z: result.z + dz };
    if (interiorPositionIsFree(alongZ, room, radius)) result.z = alongZ.z;
  }
  return result;
}

/** Input length is capped so diagonal movement has the same speed as forward. */
export function interiorMovementVector(sideways: number, forward: number, yaw: number, distance: number): InteriorPoint {
  const length = Math.max(1, Math.hypot(sideways, forward));
  const x = sideways / length * distance, z = forward / length * distance;
  return { x: Math.cos(yaw) * x - Math.sin(yaw) * z, z: -Math.sin(yaw) * x - Math.cos(yaw) * z };
}
