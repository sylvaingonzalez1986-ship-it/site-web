import * as THREE from "three";
import { paintingToGround, VILLAGE_MAILBOX_POSITION } from "./village-layout";
import { VILLAGE_COAST, VILLAGE_RIVER } from "./village-terrain";
import type { VillageWalkSurface } from "./village-life-types";

export type VillageObstacle = { x: number; z: number; radius: number };
export type VillageGroundPath = { samples: { x: number; z: number }[]; width: number };

function polygon(points: readonly (readonly [number, number])[]) {
  return new THREE.CatmullRomCurve3(points.map(point => {
    const [x, z] = paintingToGround(...point); return new THREE.Vector3(x, 0, z);
  }), true, "centripetal").getPoints(160);
}

const coast = polygon(VILLAGE_COAST), river = polygon(VILLAGE_RIVER);
function contains(points: THREE.Vector3[], x: number, z: number) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}
function clearOfEdge(points: THREE.Vector3[], x: number, z: number, margin: number) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / Math.max(1e-9, dx * dx + dz * dz)));
    if ((x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2 < margin * margin) return false;
  }
  return true;
}

/** Physical props come from the terrain generator, not a second approximate map. */
export function createVillageWalkSurface(terrain: THREE.Group, buildings: readonly { object: THREE.Group; position: [number, number, number]; place: { scale: number } }[], reserved: readonly VillageObstacle[] = []): VillageWalkSurface {
  const obstacles: VillageObstacle[] = [...(terrain.userData.navigationObstacles ?? []), ...reserved,
    { x: VILLAGE_MAILBOX_POSITION[0], z: VILLAGE_MAILBOX_POSITION[2], radius: 0.85 }];
  const paths: VillageGroundPath[] = terrain.userData.groundPaths ?? [];
  const boxes = buildings.map(({ object, position, place }) => {
    const box = new THREE.Box3().setFromObject(object);
    // Models still have their local transform when the scene is constructed.
    box.min.multiplyScalar(place.scale).add(new THREE.Vector3(...position));
    box.max.multiplyScalar(place.scale).add(new THREE.Vector3(...position));
    box.max.z += 0.65; // Doorstep and occupied entrance apron.
    return box;
  });
  return {
    isWalkable(x, z, radius) {
      if (!contains(coast, x, z) || contains(river, x, z)) return false;
      if (!clearOfEdge(coast, x, z, radius + 0.65) || !clearOfEdge(river, x, z, radius + 0.5)) return false;
      if (boxes.some(box => x > box.min.x - radius && x < box.max.x + radius && z > box.min.z - radius && z < box.max.z + radius)) return false;
      return !obstacles.some(obstacle => (x - obstacle.x) ** 2 + (z - obstacle.z) ** 2 < (radius + obstacle.radius) ** 2);
    },
    heightAt(x, z) {
      return paths.some(path => path.samples.some(point => (x - point.x) ** 2 + (z - point.z) ** 2 < (path.width / 2) ** 2)) ? 0.08 : 0.019;
    },
  };
}
