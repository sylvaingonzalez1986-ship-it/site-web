import * as THREE from "three";

export const knitPalette = ["#ff0000", "#00ff00", "#0000ff", "#000000"] as const;

let sharedKnit: THREE.MeshStandardMaterial | undefined;
let wearers = 0;

export function borrowKnittedFabric() {
  if (!sharedKnit) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96 });
    material.name = "chanvrier-knit";
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 clothRest;\nvarying vec4 vClothRest;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvClothRest = clothRest;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
varying vec4 vClothRest;

float stitches(vec2 point) {
  vec2 stitch = point * vec2(116.0, 126.0);
  float coverage = 1.0 - smoothstep(0.23, 0.85, max(fwidth(stitch.x), fwidth(stitch.y)));
  float wale = cos(stitch.x * PI2);
  float loop = cos(stitch.y * PI2 - abs(sin(stitch.x * PI)) * 1.8);
  return coverage * (0.025 * wale + 0.027 * loop * (0.53 + 0.47 * wale));
}`)
        .replace("#include <color_fragment>", `#include <color_fragment>
float knitSide = smoothstep(0.6, 1.6, abs(vClothRest.x) / max(abs(vClothRest.z), 0.001));
float stitch = mix(stitches(vClothRest.xy), stitches(vClothRest.zy), knitSide);
diffuseColor.rgb *= 1.0 + vClothRest.w * stitch;`);
    };
    sharedKnit = material;
  }
  wearers++;
  return sharedKnit;
}

export function releaseKnittedFabric() {
  if (--wearers === 0) {
    sharedKnit?.dispose();
    sharedKnit = undefined;
  }
}

/** A recolor edits pigments only. Positions used by the knit stay fixed while the cloth bends. */
export function prepareKnittedFabric(mesh: THREE.Mesh, restPoint: (index: number) => readonly [number, number, number]) {
  const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
  const zones = new Uint8Array(colors.count);
  const rest = new Float32Array(colors.count * 4);
  for (let i = 0; i < colors.count; i++) {
    const zone = colors.getX(i) ? 0 : colors.getY(i) ? 1 : colors.getZ(i) ? 2 : 3;
    const [x, y, z] = restPoint(i);
    zones[i] = zone;
    rest.set([x, y, z, Number(zone !== 3)], i * 4);
  }
  colors.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute("clothRest", new THREE.BufferAttribute(rest, 4));
  let previous: readonly string[] | undefined;
  return (palette: readonly string[]) => {
    if (previous?.every((hex, i) => palette[i] === hex)) return;
    previous = palette;
    const pigments = palette.map(hex => new THREE.Color(hex));
    for (let i = 0; i < zones.length; i++) {
      const pigment = pigments[zones[i]];
      colors.setXYZ(i, pigment.r, pigment.g, pigment.b);
    }
    colors.needsUpdate = true;
  };
}
