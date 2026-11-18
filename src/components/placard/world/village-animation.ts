import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAP_ENTRANCES, MAP_SCENERY } from "../KqPlacardMap.scene";
import { paintingToGround } from "./village-layout";
import { villageBreezeStrength } from "./village-wind";
import { disposeVillageObject } from "./village-terrain";
import type { VillageBuildingKind } from "./village-buildings";

export type VillageActivityState = { culture: boolean; market: boolean; jury: boolean };
export type AnimatedVillageBuilding = {
  place: { id: VillageBuildingKind; scale: number };
  object: THREE.Group;
  position: [number, number, number];
};

const noHit: THREE.Object3D["raycast"] = () => {};
const mix = THREE.MathUtils.lerp;
const wave = (time: number, duration: number, delay = 0) => (1 - Math.cos(Math.max(0, time - delay) / duration * Math.PI)) / 2;

/** All motion is decoration; timings and wind amplitudes come from the 2D scene. */
export function createVillageAnimation(buildings: readonly AnimatedVillageBuilding[]) {
  const root = new THREE.Group();
  root.name = "village-atmosphere";
  const mesh = (geometry: THREE.BufferGeometry, color: string, parent: THREE.Object3D = root) => {
    const result = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
    result.raycast = noHit; parent.add(result); return result;
  };
  function flowerPatch(id: "hydrangea" | "daisies") {
    const spec = MAP_SCENERY.find(piece => piece.id === id)!;
    const [x, z] = paintingToGround(spec.anchor[0], spec.anchor[1]);
    const group = new THREE.Group(); group.name = `motion-${id}`; group.position.set(x, 0.02, z); root.add(group);
    const geometries = new Map<string, THREE.BufferGeometry[]>();
    const part = (geometry: THREE.BufferGeometry, color: string, px: number, py: number, pz: number) => {
      const source = geometry.index ? geometry.toNonIndexed() : geometry;
      if (source !== geometry) geometry.dispose();
      source.deleteAttribute("uv"); source.translate(px, py, pz);
      const batch = geometries.get(color) ?? []; batch.push(source); geometries.set(color, batch);
    };
    for (let i = 0; i < 7; i++) {
      const px = Math.sin(i * 2.4) * 0.5, pz = Math.cos(i * 2.4) * 0.4, y = 0.55 + (i % 3) * 0.14;
      part(new THREE.CylinderGeometry(0.025, 0.035, y, 5), "#3d7849", px, y / 2, pz);
      if (id === "hydrangea") {
        part(new THREE.IcosahedronGeometry(0.34, 1), i % 2 ? "#72b7cb" : "#a1d0d3", px, y, pz);
        part(new THREE.IcosahedronGeometry(0.35, 0), "#216e51", px, y * 0.45, pz);
      } else {
        for (let k = 0; k < 6; k++) part(new THREE.SphereGeometry(0.1, 6, 4).scale(1, 0.4, 1), "#f3d063", px + Math.sin(k * Math.PI / 3) * 0.13, y, pz + Math.cos(k * Math.PI / 3) * 0.13);
        part(new THREE.SphereGeometry(0.065, 6, 4), "#c38a35", px, y + 0.02, pz);
      }
    }
    for (const [color, parts] of geometries) {
      const merged = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
      if (merged) mesh(merged, color, group);
    }
    return group;
  }
  const plants = [flowerPatch("hydrangea"), flowerPatch("daisies")];
  const moving = MAP_SCENERY.map(spec => ({ spec, object: plants.find(plant => plant.name === `motion-${spec.id}`)
    ?? buildings.find(building => building.place.id === spec.building)?.object.getObjectByName(`motion-${spec.id}`) })).filter(item => item.object !== undefined);

  const smoke = buildings.filter(building => building.place.id === "office" || building.place.id === "shop").flatMap((building, chimney) => {
    building.object.updateMatrixWorld(true);
    const origin = building.object.getObjectByName("anchor-smoke")?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(-1, 4.5, -0.6);
    origin.multiplyScalar(building.place.scale).add(new THREE.Vector3(...building.position));
    return [0, 1, 2].map(index => {
      const material = new THREE.MeshBasicMaterial({ color: "#f8ebce", transparent: true, opacity: 0, depthWrite: false });
      const shapes = [[0, 0, 0], [0.19, 0.06, 0], [-0.12, 0.12, 0.08]].map(([x, y, z]) => new THREE.IcosahedronGeometry(0.24, 1).translate(x, y, z));
      const geometry = mergeGeometries(shapes, false)!; shapes.forEach(shape => shape.dispose());
      const object = new THREE.Mesh(geometry, material); object.raycast = noHit; root.add(object);
      return { object, material, origin, index, chimney };
    });
  });

  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const at = (y * 32 + x) * 4;
    pixels.set([255, 209, 100, Math.round(Math.max(0, 1 - Math.hypot(x - 15.5, y - 15.5) / 15.5) ** 2 * 255)], at);
  }
  const glowTexture = new THREE.DataTexture(pixels, 32, 32); glowTexture.needsUpdate = true;
  const lights = buildings.flatMap(building => {
    const activity: keyof VillageActivityState | null = building.place.id === "warehouse" ? "culture" : building.place.id === "market" ? "market" : building.place.id === "arena" ? "jury" : null;
    if (!activity) return [];
    const positions = activity === "jury" ? [[-1.65, 2.2, 1.4], [1.65, 2.2, 1.4]] : activity === "culture" ? [[0.1, 1.8, 1.95], [0.1, 2.5, 1.95]] : [[0, 1.4, 1.5]];
    return positions.map(position => {
      const material = new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
      const object = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), material);
      object.position.set(...position as [number, number, number]).multiplyScalar(building.place.scale).add(new THREE.Vector3(...building.position));
      object.raycast = noHit; root.add(object); return { object, material, activity: activity as keyof VillageActivityState };
    });
  });
  const buildingActivities = buildings.map(({ object }) => ({
    culture: object.getObjectByName("activity-culture"),
    market: object.getObjectByName("activity-market"),
    jury: object.getObjectByName("activity-jury"),
    doors: object.getObjectByName("idle-culture"),
  }));
  const intentMaterial = new THREE.MeshBasicMaterial({ color: "#ffe5a0", transparent: true, opacity: 0, depthWrite: false });
  const intent = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32), intentMaterial);
  intent.rotation.x = -Math.PI / 2; intent.raycast = noHit; root.add(intent);
  let greeting: { building: VillageBuildingKind; start: number } | null = null;

  return {
    object: root,
    parts: moving.map(({ spec }) => spec.id),
    react(building: VillageBuildingKind, time: number) { greeting = { building, start: time }; },
    update(time: number, activity: VillageActivityState, reduced: boolean) {
      const age = greeting ? time - greeting.start : Infinity;
      const reaction = !reduced && age < 1.13 ? Math.sin(age / 1.13 * Math.PI * 3) * Math.exp(-age * 3) : 0;
      const gust = villageBreezeStrength(time);
      for (const { spec, object } of moving) {
        const amplitude = THREE.MathUtils.degToRad(spec.amplitude);
        const paper = spec.building === "missions";
        const phase = (Math.max(0, time - spec.delay) % (2.45 + 11.7));
        const breeze = paper ? phase < 2.45 ? Math.sin(phase / 2.45 * Math.PI * 2) * (1 - phase / 2.45) : 0
          : mix(-1, 1, wave(time, spec.duration, spec.delay));
        const value = reduced ? 0 : amplitude * (breeze * gust + (greeting?.building === spec.building ? reaction * (spec.building === "warehouse" ? 0.6 : 1.9) : 0));
        object!.rotation[spec.id === "flag" ? "y" : "z"] = value;
      }
      smoke.forEach(({ object, material, origin, index, chimney }) => {
        const duration = chimney ? 5.85 : 5.2;
        const progress = (time + index * 1.7 + (chimney ? 1.35 : 0.5)) % duration / duration;
        object.visible = !reduced;
        object.position.set(origin.x + progress * 0.65, origin.y + progress * 2.2, origin.z - progress * 0.25);
        object.scale.setScalar(mix(0.35, 1.65, progress));
        material.opacity = Math.min(1, progress * duration / 1.3) * Math.max(0, Math.min(1, (1 - progress) * duration / 2.2)) * 0.6;
      });
      for (const { culture, market, jury, doors } of buildingActivities) {
        if (culture) culture.visible = activity.culture;
        if (market) market.visible = activity.market;
        if (jury) jury.visible = activity.jury;
        if (doors) doors.visible = !activity.culture;
      }
      lights.forEach(({ object, material, activity: key }, index) => {
        object.visible = activity[key]; material.opacity = reduced ? 0.12 : mix(0.12, 0.33, wave(time, 3.2 + index * 0.6));
      });
      intent.visible = !reduced && age >= 0 && age < 0.65;
      if (greeting) {
        const [x, z] = paintingToGround(...MAP_ENTRANCES[greeting.building]);
        intent.position.set(x, 0.09, z);
        intent.scale.set(mix(0.78, 1.14, Math.min(1, age / 0.65)) * 1.3, 0.5, 1);
        intentMaterial.opacity = Math.max(0, 0.65 * (1 - age / 0.65));
      }
    },
    dispose() { disposeVillageObject(root); glowTexture.dispose(); },
  };
}
