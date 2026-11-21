import * as THREE from "three";
import { VILLAGE_PHASE_START } from "./village-calendar";

/** Default daylight on the village map and its isometric preview in the fitting room. */
export const VILLAGE_LIGHT = {
  exposure: 1.08, ambient: .23,
  sky: "#e3eff0", ground: "#778b73", hemi: 1.19,
  key: { color: "#ffedd2", power: 2.68, position: [-16, 26, 17] },
  rim: { color: "#c1e1e7", power: .63, position: [15, 14, -20] },
} as const;

type VillagePalette = {
  exposure: number;
  ambient: number;
  sky: string;
  ground: string;
  hemi: number;
  key: { color: string; power: number };
  rim: { color: string; power: number };
  clear: string;
  water: readonly [number, number, number];
  lamps: number;
};

const day: VillagePalette = { ...VILLAGE_LIGHT, clear: "#159a9e", water: [1, 1, 1], lamps: 0 };
const dawn: VillagePalette = {
  exposure: 1.04, ambient: .19, sky: "#efc5bc", ground: "#8c8b9e", hemi: .93,
  key: { color: "#ffc997", power: 1.7 }, rim: { color: "#8dafe3", power: .52 },
  clear: "#557a95", water: [1.06, .64, .79], lamps: .22,
};
const dusk: VillagePalette = {
  exposure: 1.02, ambient: .17, sky: "#d8a5ae", ground: "#9a7b83", hemi: .92,
  key: { color: "#ffab78", power: 1.62 }, rim: { color: "#9a98d9", power: .57 },
  clear: "#83697f", water: [1.20, .49, .64], lamps: .31,
};
const night: VillagePalette = {
  exposure: .99, ambient: .14, sky: "#97b5eb", ground: "#7786a5", hemi: .71,
  key: { color: "#a8c4f0", power: .44 }, rim: { color: "#9ebcf6", power: .48 },
  clear: "#152f53", water: [.12, .22, .44], lamps: 1,
};

/** Keep the direction fixed so the map can reuse its cached shadow texture. */
export function sampleVillageLighting(minute: number | null) {
  const { dawn: dawnStart, day: dayStart, dusk: duskStart, night: nightStart } = VILLAGE_PHASE_START;
  const dawnPeak = (dawnStart + dayStart) / 2;
  const duskPeak = (duskStart + nightStart) / 2;
  let from = day, to = day, mix = 0;
  if (minute !== null) {
    if (minute < dawnStart || minute >= nightStart) {
      from = to = night;
    } else if (minute < dawnPeak) {
      from = night; to = dawn; mix = THREE.MathUtils.smoothstep(minute, dawnStart, dawnPeak);
    } else if (minute < dayStart) {
      from = dawn; mix = THREE.MathUtils.smoothstep(minute, dawnPeak, dayStart);
    } else if (minute >= duskPeak) {
      from = dusk; to = night; mix = THREE.MathUtils.smoothstep(minute, duskPeak, nightStart);
    } else if (minute >= duskStart) {
      to = dusk; mix = THREE.MathUtils.smoothstep(minute, duskStart, duskPeak);
    }
  }
  const blend = (a: number, b: number) => THREE.MathUtils.lerp(a, b, mix);
  const tint = (a: string, b: string) => new THREE.Color(a).lerp(new THREE.Color(b), mix);
  return {
    exposure: blend(from.exposure, to.exposure),
    ambient: blend(from.ambient, to.ambient),
    sky: tint(from.sky, to.sky),
    ground: tint(from.ground, to.ground),
    hemi: blend(from.hemi, to.hemi),
    key: { color: tint(from.key.color, to.key.color), power: blend(from.key.power, to.key.power) },
    rim: { color: tint(from.rim.color, to.rim.color), power: blend(from.rim.power, to.rim.power) },
    clear: tint(from.clear, to.clear),
    water: [blend(from.water[0], to.water[0]), blend(from.water[1], to.water[1]), blend(from.water[2], to.water[2])] as const,
    lamps: blend(from.lamps, to.lamps),
  };
}

export function applyVillageEmissives(object: THREE.Object3D, lamps: number) {
  object.traverse(part => {
    if (!(part instanceof THREE.Mesh) || !(part.material instanceof THREE.MeshStandardMaterial)) return;
    const material = part.material;
    if (material.name === "village-lantern") {
      material.emissive.set("#ffad4c");
      material.emissiveIntensity = lamps * 1.45;
    } else if (material.name === "village-window") {
      material.emissive.set("#ffb469");
      material.emissiveIntensity = lamps * .64;
    }
  });
}
