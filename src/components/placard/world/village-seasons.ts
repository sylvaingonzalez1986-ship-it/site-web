import * as THREE from "three";
import type { VillageCalendar } from "./village-calendar";

type Season = VillageCalendar["season"];

const palettes = {
  spring: { turf: "#abc987", grass: "#64a45b", crown: "#6e9f52", crownWarm: "#8caf55", evergreen: "#4f9067", meadow: "#a5bb7e", mainlandEvergreen: "#57956e", particle: "#ffe1dd" },
  summer: { turf: null, grass: null, crown: null, crownWarm: null, evergreen: null, meadow: null, mainlandEvergreen: null, particle: "#f2d778" },
  autumn: { turf: "#b3ae72", grass: "#aa914f", crown: "#ca742d", crownWarm: "#da9e39", evergreen: "#557d59", meadow: "#aaa171", mainlandEvergreen: "#568363", particle: "#e79546" },
  winter: { turf: "#8c9b79", grass: "#7f8c65", crown: null, crownWarm: null, evergreen: "#456c60", meadow: "#879785", mainlandEvergreen: "#4d7470", particle: "#ccd8c4" },
} satisfies Record<Season, Record<string, string | null>>;

export type VillageSeasonPigment = "turf" | "grass" | "crown" | "crownWarm" | "evergreen" | "meadow" | "mainlandEvergreen";
type PigmentBatch = { mesh: THREE.Mesh; original: Float32Array; ranges: readonly { start: number; end: number; pigment: VillageSeasonPigment }[] };
const pigmentBatches = new WeakMap<THREE.Mesh, PigmentBatch>();

/** Ranges use vertex indices in the final, merged geometry. */
export function registerVillagePigments(mesh: THREE.Mesh, ranges: PigmentBatch["ranges"]) {
  const color = mesh.geometry.getAttribute("color");
  if (!color || !ranges.length) return;
  pigmentBatches.set(mesh, { mesh, original: Float32Array.from(color.array), ranges });
}

const pigmentBases: Record<VillageSeasonPigment, string> = {
  turf: "#a6bc7c", grass: "#759653", crown: "#5b9569", crownWarm: "#5b9569", evergreen: "#509363",
  meadow: "#a2b580", mainlandEvergreen: "#5d9566",
};

const appliedSeasons = new WeakMap<THREE.Group, Season>();
const farmCrops = {
  spring: { stem: "#638b46", leaf: "#5e9c4c" },
  summer: { stem: "#668341", leaf: "#51894a" },
  autumn: { stem: "#8b7b3f", leaf: "#a18a46" },
  winter: { stem: "#668341", leaf: "#51894a" },
} satisfies Record<Season, { stem: string; leaf: string }>;

export function getVillageSeason(terrain: THREE.Group): Season {
  return appliedSeasons.get(terrain) ?? "summer";
}

export function applyVillageSeason(terrain: THREE.Group, season: Season) {
  if (appliedSeasons.get(terrain) === season) return;
  appliedSeasons.set(terrain, season);
  const palette = palettes[season], tint = new THREE.Color(), base = new THREE.Color();
  terrain.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    switch (object.name) {
      case "landscape-crown":
      case "landscape-crownWarm": object.visible = season !== "winter"; break;
      case "landscape-spring-blossom": object.visible = season === "spring"; break;
      case "landscape-summer-blossom": object.visible = season === "summer"; break;
      case "landscape-autumn-litter": object.visible = season === "autumn"; break;
      case "landscape-wildflowers": object.visible = season === "spring" || season === "summer"; break;
      case "hemp-farm-stems":
      case "hemp-farm-leaves":
        object.visible = season !== "winter";
        (object.material as THREE.MeshStandardMaterial).color.set(object.name === "hemp-farm-stems" ? farmCrops[season].stem : farmCrops[season].leaf);
        break;
      case "hemp-farm-stubble": object.visible = season === "winter"; break;
    }
    const batch = pigmentBatches.get(object);
    if (!batch) return;
    const colors = batch.mesh.geometry.getAttribute("color");
    colors.array.set(batch.original);
    for (const { start, end, pigment } of batch.ranges) {
      const shade = palette[pigment];
      if (!shade) continue;
      tint.set(shade);
      base.set(pigmentBases[pigment]);
      // Luminance carries over the original cuts and shadows without leaving a green cast.
      for (let i = start; i < end; i++) {
        const offset = i * 3;
        const green = batch.original[offset + 1];
        const strength = green / base.g;
        const retained = pigment === "turf" || pigment === "meadow" ? .17 : .08;
        colors.setXYZ(i, tint.r * strength * (1 - retained) + batch.original[offset] * retained,
          tint.g * strength * (1 - retained) + green * retained,
          tint.b * strength * (1 - retained) + batch.original[offset + 2] * retained);
      }
    }
    colors.needsUpdate = true;
  });
}

/** Drifting petals/leaves and a handful of sunny insects stay close to vegetation. */
export function createVillageSeasonMotion(terrain: THREE.Group) {
  const anchors = (terrain.userData.seasonAnchors ?? []) as readonly (readonly [number, number, number])[];
  const count = anchors.length * 3;
  const geometry = new THREE.IcosahedronGeometry(.095, 0);
  const material = new THREE.MeshBasicMaterial();
  const object = new THREE.InstancedMesh(geometry, material, count);
  object.name = "village-season-drift";
  object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  object.frustumCulled = false;
  object.raycast = () => {};
  object.visible = false;
  const transform = new THREE.Object3D();
  let lastTime = -1, lastSeason: Season | undefined;
  return {
    object,
    update(time: number, reduced: boolean, quality: "high" | "low") {
      const season = getVillageSeason(terrain);
      object.visible = !reduced && season !== "winter";
      if (!object.visible || (lastTime === time && lastSeason === season)) return;
      if (lastSeason !== season) material.color.set(palettes[season].particle);
      lastTime = time;
      lastSeason = season;
      const perAnchor = quality === "low" ? 2 : 3;
      object.count = anchors.length * perAnchor;
      for (let i = 0; i < object.count; i++) {
        const anchor = anchors[Math.floor(i / perAnchor)], salt = i * 2.39996;
        const summer = season === "summer";
        const cycle = (time * (season === "autumn" ? .19 : .13) + i * .618) % 1;
        transform.position.set(
          anchor[0] + Math.sin(salt) * .75 + Math.sin(time * 1.6 + salt) * .18 + (summer ? 0 : cycle * 1.35),
          summer ? .7 + Math.sin(time * 2.2 + salt) * .42 : .25 + (anchor[1] - .25) * (1 - cycle),
          anchor[2] + Math.cos(salt) * .75 + Math.cos(time * 1.4 + salt) * .29,
        );
        transform.rotation.set(time * 1.9 + salt, time + salt, salt);
        const size = summer ? .53 : .85 + Math.sin(salt) * .15;
        transform.scale.set(size, size * .28, size * .68);
        transform.updateMatrix();
        object.setMatrixAt(i, transform.matrix);
      }
      object.instanceMatrix.needsUpdate = true;
    },
    dispose() { object.dispose(); geometry.dispose(); material.dispose(); },
  };
}
