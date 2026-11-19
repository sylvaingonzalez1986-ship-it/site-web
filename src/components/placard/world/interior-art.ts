import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { furnishCivic, furnishCivicStation } from "./building-civic-decor";
import { furnishOffice, furnishOfficeStation } from "./building-office-decor";
import { furnishMarket, furnishMarketStation } from "./building-market-decor";
import type { InteriorObject, InteriorRoom } from "./interior-types";

/** The same pigments as the painted Quartier; all detail below is generated geometry. */
const PAINT = {
  ink: "#233a37", cream: "#f5e7c7", paper: "#fff4d7", plaster: "#dfd7bc",
  stone: "#b6b4a0", slate: "#40545a", teal: "#078d87", darkTeal: "#08635f",
  wood: "#af7849", honey: "#d6a15f", gold: "#efb63d", steel: "#acb9af",
  green: "#497a4e", leaf: "#6f9952", earth: "#514537", red: "#ba604b",
  skin: "#edbd89", hair: "#483c33", blue: "#386899", glass: "#a4d3c3",
  apricot: "#e7ab72",
  brass: "#d29b3e", bronze: "#8c5a27", iron: "#4e6267", forgedIron: "#293e43",
  velvet: "#185851", leather: "#93614a", walnut: "#835634", limestone: "#d4c1a0",
  windowGlass: "#b8ddcf", suit: "#20594a", silverHair: "#c4c3b3",
} as const;
type Pigment = keyof typeof PAINT;
type V3 = readonly [number, number, number];
const ZERO: V3 = [0, 0, 0];
type Surface = "timber" | "plaster" | "granite" | "paper" | "cloth" | "metal" | "glass";

const finishByPaint: Partial<Record<Pigment, { surface: Surface; roughness: number; metalness?: number }>> = {
  wood: { surface: "timber", roughness: 0.76 },
  honey: { surface: "timber", roughness: 0.76 },
  walnut: { surface: "timber", roughness: 0.76 },
  teal: { surface: "timber", roughness: 0.76 },
  darkTeal: { surface: "timber", roughness: 0.76 },
  cream: { surface: "plaster", roughness: 0.95 },
  plaster: { surface: "plaster", roughness: 0.95 },
  paper: { surface: "paper", roughness: 0.94 },
  stone: { surface: "granite", roughness: 0.89 },
  limestone: { surface: "granite", roughness: 0.89 },
  iron: { surface: "metal", roughness: 0.49, metalness: 0.45 },
  forgedIron: { surface: "metal", roughness: 0.65, metalness: 0.36 },
  brass: { surface: "metal", roughness: 0.35, metalness: 0.55 },
  bronze: { surface: "metal", roughness: 0.54, metalness: 0.47 },
  gold: { surface: "metal", roughness: 0.43, metalness: 0.36 },
  steel: { surface: "metal", roughness: 0.51, metalness: 0.4 },
  velvet: { surface: "cloth", roughness: 0.99 },
  leather: { surface: "cloth", roughness: 0.72 },
  suit: { surface: "cloth", roughness: 0.88 },
  windowGlass: { surface: "glass", roughness: 0.27, metalness: 0.04 },
};

/** Tiny deterministic pigment fields; no image asset, browser canvas or network dependency. */
function pigmentTexture(surface: Surface, detailed: boolean) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  let seed = hash(surface);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296;
    let value: number;
    if (detailed && surface === "timber") {
      const bend = Math.sin(y * 0.049) * 2.8 + Math.sin(y * 0.106 + x * 0.043) * 1.1;
      const grain = Math.sin(x * 0.32 + bend);
      const pores = Math.sin(x * 1.39 + bend * 1.45);
      value = 243 + grain * 7 + pores * 3 - noise * 5;
      if (grain > 0.92) value -= 9 + pores * 3;
    } else if (surface === "timber") {
      const grain = Math.sin(x * 0.48 + Math.sin(y * 0.065) * 1.9 + Math.sin(y * 0.017) * 3.4);
      value = 244 + grain * 6 - noise * 7;
      if (Math.sin(x * 0.14 + Math.sin(y * 0.018) * 1.1) > 0.985) value -= 15;
    } else if (detailed && surface === "plaster") {
      value = 248 + Math.sin(x * 0.16 + Math.sin(y * 0.11)) * Math.cos(y * 0.18) * 5 - noise * 5;
      if (noise < 0.068) value -= 17;
    } else if (surface === "plaster") {
      value = noise < 0.045 ? 240 + noise * 160 : 251 + noise * 4;
    } else if (surface === "cloth") {
      value = 251 - noise * 6 - Math.pow(Math.sin(x * Math.PI / 4) * Math.sin(y * Math.PI / 4), 2) * 21;
    } else if (surface === "paper") {
      value = 253 - noise * 11 - (noise < 0.07 ? 11 : 0);
    } else if (surface === "metal") {
      value = 247 + Math.sin(x * 1.9 + Math.sin(y * 0.06)) * 3 - noise * 6;
    } else if (surface === "glass") {
      value = 242 + Math.sin((x + y) * 0.1) * 5 - noise * 4;
    } else if (detailed) {
      value = 247 + Math.sin(x * 0.08 + y * 0.09) * 6 - noise * 12;
      if (noise < 0.072) value -= 12;
    } else {
      value = 228 + noise * 27;
      if (noise < 0.08) value -= 26;
    }
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = Math.round(value);
    pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = `procedural-interior-${surface}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function mergeParts(parts: THREE.BufferGeometry[], name: string) {
  if (parts.length === 1) return parts[0];
  const merged = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!merged) throw new Error(`Cannot merge interior art: ${name}`);
  return merged;
}

/** Source geometries are consumed immediately and merged by pigment (no per-plank meshes). */
export class Art {
  private paints = new Map<Pigment, THREE.BufferGeometry[]>();
  private pivots: { name: string; at: V3; art: Art }[] = [];
  private sourceCount = 0;

  constructor(private readonly detailed = false) {}

  pivot(name: string, at: V3) {
    const art = new Art(this.detailed);
    this.pivots.push({ name, at, art });
    return art;
  }

  add(geometry: THREE.BufferGeometry, paint: Pigment, at: V3, rotation: V3 = ZERO, tone = 1) {
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1),
    ));
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    if (this.detailed) {
      const tint = new THREE.Color(PAINT[paint]).multiplyScalar(tone);
      for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
    } else colors.fill(tone);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    const batch = this.paints.get(paint) ?? [];
    batch.push(flat);
    this.paints.set(paint, batch);
    this.sourceCount++;
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, paint: Pigment, rotation: V3 = ZERO, tone = 1) {
    this.add(new THREE.BoxGeometry(w, h, d), paint, [x, y, z], rotation, tone);
  }

  bevelBox(w: number, h: number, d: number, radius: number, x: number, y: number, z: number, paint: Pigment, rotation: V3 = ZERO) {
    this.add(new RoundedBoxGeometry(w, h, d, 1, radius), paint, [x, y, z], rotation);
  }

  cylinder(r: number, h: number, x: number, y: number, z: number, paint: Pigment, top = r, rotation: V3 = ZERO) {
    this.add(new THREE.CylinderGeometry(top, r, h, 12), paint, [x, y, z], rotation);
  }

  sphere(r: number, x: number, y: number, z: number, paint: Pigment, scale: V3 = [1, 1, 1]) {
    const geometry = new THREE.SphereGeometry(r, 12, 8);
    geometry.scale(...scale);
    this.add(geometry, paint, [x, y, z]);
  }

  torus(r: number, tube: number, x: number, y: number, z: number, paint: Pigment, rotation: V3 = ZERO) {
    this.add(new THREE.TorusGeometry(r, tube, 6, 20), paint, [x, y, z], rotation);
  }

  rod(from: V3, to: V3, width: number, paint: Pigment) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const geometry = new THREE.CylinderGeometry(width / 2, width / 2, a.distanceTo(b), 7);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    this.add(geometry, paint, a.add(b).multiplyScalar(0.5).toArray() as [number, number, number]);
  }

  frame(w: number, h: number, x: number, y: number, z: number, paint: Pigment, thickness = 0.055) {
    this.box(w, thickness, thickness, x, y - h / 2, z, paint);
    this.box(w, thickness, thickness, x, y + h / 2, z, paint);
    this.box(thickness, h, thickness, x - w / 2, y, z, paint);
    this.box(thickness, h, thickness, x + w / 2, y, z, paint);
  }

  finish(name: string): THREE.Group {
    return this.merge(name, new Map(), new Map());
  }

  private merge(name: string, textures: Map<Surface, THREE.DataTexture>, materials: Map<string, THREE.MeshStandardMaterial>): THREE.Group {
    const group = new THREE.Group();
    const meshes = new Map<string, { material: THREE.MeshStandardMaterial; parts: THREE.BufferGeometry[] }>();
    const strokes = new Map<number, THREE.BufferGeometry[]>();
    group.name = name;
    group.userData.sourcePieces = this.sourceCount;
    for (const [paint, geometries] of this.paints) {
      const geometry = mergeParts(geometries, paint);
      const finish = this.detailed ? finishByPaint[paint] : undefined;
      const legacySurface: Surface | null = paint === "wood" || paint === "honey" ? "timber"
        : paint === "cream" || paint === "plaster" || paint === "paper" ? "plaster"
          : paint === "stone" ? "granite" : null;
      const surface = finish?.surface ?? legacySurface;
      if (surface && !textures.has(surface)) textures.set(surface, pigmentTexture(surface, this.detailed));
      const roughness = finish?.roughness ?? (paint === "steel" ? 0.63 : 0.95);
      const metalness = finish?.metalness ?? (paint === "steel" ? 0.28 : 0);
      const key = this.detailed && paint !== "gold" ? `${surface ?? "painted"}-${roughness}-${metalness}` : paint;
      let material = materials.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color: this.detailed ? "#ffffff" : PAINT[paint], roughness, metalness,
          vertexColors: true, flatShading: !this.detailed, map: surface ? textures.get(surface)! : null,
          ...(paint === "gold" ? { emissive: PAINT.gold, emissiveIntensity: 0.035 } : {}),
        });
        materials.set(key, material);
      }
      const batch = meshes.get(key) ?? { material, parts: [] };
      batch.parts.push(geometry);
      meshes.set(key, batch);
      // Structural ink strokes, as in the 2D drawing; foliage and skin keep their soft silhouette.
      if (!["leaf", "green", "skin", "hair", "glass", "windowGlass", "silverHair", "velvet", "leather", "suit"].includes(paint)) {
        const edges = new THREE.EdgesGeometry(geometry, this.detailed ? 43 : 35);
        const opacity = this.detailed ? (surface === "plaster" || surface === "granite" ? 0.1 : 0.22) : 0.37;
        const batch = strokes.get(opacity) ?? [];
        batch.push(edges);
        strokes.set(opacity, batch);
      }
    }
    for (const [key, { material, parts }] of meshes) {
      const mesh = new THREE.Mesh(mergeParts(parts, key), material);
      mesh.name = `${name}-${key}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const [opacity, parts] of strokes) {
      const line = new THREE.LineSegments(mergeParts(parts, "ink"), new THREE.LineBasicMaterial({ color: PAINT.ink, transparent: true, opacity }));
      line.name = `${name}-ink`;
      group.add(line);
    }
    for (const pivot of this.pivots) {
      const child = pivot.art.merge(pivot.name, textures, materials);
      child.position.set(...pivot.at);
      group.add(child);
      group.userData.sourcePieces += child.userData.sourcePieces;
    }
    this.pivots.length = 0;
    this.paints.clear();
    return group;
  }
}

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

function plankTop(a: Art, w: number, d: number, y: number, paint: Pigment = "honey") {
  a.box(w, 0.11, d, 0, y, 0, "wood");
  const count = Math.max(3, Math.ceil(w / 0.24));
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + w * (i + 0.5) / count;
    a.box(w / count - 0.012, 0.025, d - 0.035, x, y + 0.065, 0, paint, ZERO, 0.92 + (i % 3) * 0.035);
    for (const z of [-d * 0.38, d * 0.38]) a.cylinder(0.012, 0.006, x, y + 0.081, z, "ink");
  }
}

function table(a: Art, w: number, d: number, h = 0.9) {
  plankTop(a, w, d, h);
  for (const x of [-w * 0.4, w * 0.4]) for (const z of [-d * 0.35, d * 0.35]) {
    a.box(0.085, h, 0.085, x, h / 2, z, "wood");
    a.box(0.11, 0.08, 0.11, x, 0.04, z, "ink");
  }
  a.box(w * 0.88, 0.12, 0.045, 0, h - 0.18, d * 0.35, "wood");
}

function jar(a: Art, x: number, y: number, z: number, size = 0.2, filled = true) {
  a.cylinder(size * 0.45, size * 1.5, x, y + size * 0.75, z, "glass");
  if (filled) a.cylinder(size * 0.37, size * 0.9, x, y + size * 0.55, z, "green");
  a.cylinder(size * 0.48, size * 0.13, x, y + size * 1.54, z, "steel");
  a.box(size * 0.7, size * 0.42, 0.016, x, y + size * 0.75, z + size * 0.44, "paper");
}

function paper(a: Art, x: number, y: number, z: number, w = 0.35, h = 0.45) {
  a.box(w, h, 0.012, x, y, z, "paper", [0, 0, -0.035]);
  for (let n = 0; n < 4; n++) a.box(w * (n === 0 ? 0.48 : 0.72), 0.012, 0.006, x - w * 0.03, y + h * (0.24 - n * 0.14), z + 0.011, "stone");
  a.sphere(0.02, x, y + h * 0.43, z + 0.024, "gold");
}

function plant(a: Art, x: number, z: number, size = 1, y = 0) {
  a.cylinder(0.16 * size, 0.3 * size, x, y + 0.15 * size, z, "slate", 0.2 * size);
  a.cylinder(0.18 * size, 0.025, x, y + 0.305 * size, z, "earth");
  a.rod([x, y + 0.3 * size, z], [x, y + 1.03 * size, z], 0.025 * size, "green");
  for (let tier = 0; tier < 3; tier++) for (let side = 0; side < 3; side++) {
    const angle = side * Math.PI * 2 / 3 + tier * 0.8;
    const cy = y + (0.45 + tier * 0.19) * size;
    const tip: V3 = [x + Math.sin(angle) * 0.24 * size, cy + 0.12 * size, z + Math.cos(angle) * 0.24 * size];
    a.rod([x, cy, z], tip, 0.016 * size, "green");
    // A compound palmate leaf with pointed lobes, legible at eye level.
    for (let finger = -1; finger <= 1; finger++) {
      const leaf = new THREE.SphereGeometry(1, 5, 3);
      leaf.scale(0.047 * size, 0.16 * size, 0.016 * size);
      a.add(leaf, (tier + side) % 2 ? "green" : "leaf", tip, [0.8, angle + finger * 0.55, -0.5 + finger * 0.5]);
    }
  }
}

function culture(a: Art, object: InteriorObject, w: number, d: number) {
  const h = 2.25, railX = w * 0.46, railZ = d * 0.46;
  for (const x of [-railX, railX]) for (const z of [-railZ, railZ]) {
    a.box(0.065, h, 0.065, x, h / 2, z, "teal");
    a.box(0.12, 0.055, 0.12, x, 0.0275, z, "ink");
  }
  for (const y of [0.08, h]) {
    a.box(w * 0.94, 0.055, 0.055, 0, y, -railZ, "steel");
    for (const x of [-railX, railX]) a.box(0.055, 0.055, d * 0.94, x, y, 0, "steel");
  }
  a.box(w * 0.83, 0.055, d * 0.79, 0, 0.06, 0, "slate");
  a.box(w * 0.81, 0.025, d * 0.77, 0, 0.1, 0, "earth");
  const code = object.deviceCode ?? "";
  const lampBars = /LIGHT-03|FCE|600|720/.test(code) ? 4 : /LIGHT-02|300|LED/.test(code) ? 3 : 1;
  for (let n = 0; n < lampBars; n++) {
    const x = (n - (lampBars - 1) / 2) * w * 0.6 / lampBars;
    a.box(w * 0.64 / lampBars, 0.07, d * 0.72, x, h - 0.3, 0, "steel");
    a.box(w * 0.5 / lampBars, 0.018, d * 0.67, x, h - 0.343, 0, object.active ? "gold" : "paper");
    for (const z of [-d * 0.26, d * 0.26]) a.rod([x, h - 0.25, z], [x, h, z], 0.012, "ink");
  }
  // Crops appear only when the authoritative room object reports activity.
  if (object.active) {
    const nx = Math.max(1, Math.min(3, Math.floor(w / 0.65))), nz = Math.max(1, Math.min(3, Math.floor(d / 0.65)));
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      plant(a, (ix - (nx - 1) / 2) * w * 0.68 / nx, (iz - (nz - 1) / 2) * d * 0.66 / nz, Math.min(1.12, w / nx, d / nz) * 0.8, 0.12);
    }
  } else {
    for (const x of [-w * 0.2, w * 0.2]) a.cylinder(0.15, 0.25, x, 0.245, 0, "slate", 0.19);
  }
  a.box(0.2, 0.33, 0.075, railX - 0.1, 1.25, railZ, "cream");
  a.box(0.14, 0.1, 0.012, railX - 0.1, 1.3, railZ + 0.044, "darkTeal");
  a.sphere(0.022, railX - 0.1, 1.19, railZ + 0.05, object.active ? "gold" : "stone");
}

function drying(a: Art, object: InteriorObject, w: number, d: number) {
  const code = object.deviceCode ?? "";
  if (/NET|FILET|DRYIT90|drying-1/i.test(code)) {
    const r = Math.min(w, d) * 0.43;
    for (let tier = 0; tier < 5; tier++) {
      const y = 0.2 + tier * 0.34;
      a.cylinder(r, 0.018, 0, y, 0, "stone");
      a.torus(r, 0.027, 0, y + 0.05, 0, "slate", [Math.PI / 2, 0, 0]);
      if (object.active) for (let i = 0; i < 6; i++) a.sphere(0.07, Math.sin(i * 2.4) * r * 0.65, y + 0.065, Math.cos(i * 2.4) * r * 0.65, "green", [1, 0.5, 0.65]);
    }
    for (let i = 0; i < 4; i++) a.rod([Math.sin(i * Math.PI / 2) * r, 0.17, Math.cos(i * Math.PI / 2) * r], [0, 2, 0], 0.025, "ink");
  } else {
    for (const x of [-w * 0.41, w * 0.41]) {
      a.box(0.07, 1.92, 0.07, x, 1.04, 0, "steel");
      a.box(0.1, 0.07, d * 0.86, x, 0.12, 0, "slate");
      for (const z of [-d * 0.34, d * 0.34]) a.sphere(0.07, x, 0.07, z, "ink");
    }
    a.box(w * 0.9, 0.07, 0.07, 0, 1.98, 0, "steel");
    for (let row = 0; row < 5; row++) {
      const z = (row - 2) * d * 0.16;
      a.box(w * 0.8, 0.032, 0.032, 0, 1.88, z, "steel");
      if (object.active) for (let n = 0; n < 3; n++) {
        const x = (n - 1) * w * 0.23;
        a.rod([x, 1.88, z], [x, 1.5, z], 0.012, "wood");
        for (const side of [-1, 1]) a.sphere(0.11, x + side * 0.055, 1.48, z, "green", [0.62, 1.5, 0.7]);
      }
    }
  }
}

function storage(a: Art, object: InteriorObject, w: number, d: number, books = false) {
  const code = object.deviceCode ?? "";
  if (!books && /CURTEC|DRUM/.test(code)) {
    const count = w > 1.3 ? 2 : 1, r = Math.min(d * 0.4, w * 0.38 / count);
    for (let n = 0; n < count; n++) {
      const x = (n - (count - 1) / 2) * w * 0.53;
      a.cylinder(r, 0.85, x, 0.44, 0, "cream");
      a.cylinder(r * 1.04, 0.08, x, 0.9, 0, "red");
      a.box(r, 0.23, 0.018, x, 0.5, r, "paper");
      a.torus(r * 0.96, 0.018, x, 0.13, 0, "steel", [Math.PI / 2, 0, 0]);
      a.torus(r * 0.96, 0.018, x, 0.72, 0, "steel", [Math.PI / 2, 0, 0]);
    }
    return;
  }
  if (!books && /STORAGE-CLIMATE/.test(code)) {
    a.box(w, 1.9, d, 0, 0.95, 0, "steel");
    a.box(w * 0.87, 1.66, 0.035, 0, 0.95, d * 0.51, "teal");
    a.box(w * 0.64, 0.22, 0.012, -w * 0.05, 1.55, d * 0.54, "darkTeal");
    a.box(0.045, 0.35, 0.07, w * 0.3, 0.96, d * 0.55, "ink");
    for (let n = 0; n < 5; n++) a.box(w * 0.62, 0.018, 0.012, 0, 0.2 + n * 0.05, d * 0.54, "slate");
    a.sphere(0.028, w * 0.29, 1.55, d * 0.54, object.active ? "gold" : "stone");
    return;
  }
  if (!books && /LP-SUPER/.test(code)) {
    plankTop(a, w, d, 0.08);
    const count = Math.max(1, Math.min(3, Math.floor(w / 0.28)));
    for (let n = 0; n < count; n++) jar(a, (n - (count - 1) / 2) * w * 0.72 / count, 0.16, 0, Math.min(0.3, d * 0.6), Boolean(object.active));
    return;
  }
  const height = books ? 1.85 : 1.9;
  for (const x of [-w * 0.46, w * 0.46]) for (const z of [-d * 0.43, d * 0.43]) a.box(0.065, height, 0.065, x, height / 2, z, books ? "wood" : "slate");
  for (let tier = 0; tier < 4; tier++) {
    const y = 0.12 + tier * 0.47;
    a.box(w, 0.045, d, 0, y, 0, books ? "honey" : "slate");
    if (books) {
      const count = Math.max(4, Math.floor(w / 0.11));
      for (let n = 0; n < count; n++) {
        const h = 0.25 + (n * 3 % 5) * 0.022;
        const x = -w * 0.43 + n * w * 0.86 / count;
        const color: Pigment = ["teal", "red", "gold", "cream", "slate"][n % 5] as Pigment;
        a.box(w * 0.74 / count, h, d * 0.66, x, y + h / 2 + 0.03, 0, color);
        a.box(w * 0.53 / count, 0.018, 0.006, x, y + h * 0.7, d * 0.335, "paper");
      }
    } else if (object.active !== false) {
      const count = Math.max(2, Math.min(5, Math.floor(w / 0.26)));
      for (let n = 0; n < count; n++) jar(a, (n - (count - 1) / 2) * w * 0.79 / count, y + 0.025, d * 0.12, Math.min(0.2, d * 0.6), Boolean(object.active));
    }
  }
  for (const sign of [-1, 1]) a.rod([-w * 0.45, sign < 0 ? 0.2 : 1.7, -d * 0.43], [w * 0.45, sign < 0 ? 1.7 : 0.2, -d * 0.43], 0.025, books ? "wood" : "steel");
}

function machine(a: Art, object: InteriorObject, w: number, d: number) {
  const code = object.deviceCode ?? "";
  if (/PRESS|GV-GP50/.test(code)) {
    table(a, w, d, 0.64);
    for (const x of [-w * 0.33, w * 0.33]) a.box(0.09, 0.86, d * 0.55, x, 1.12, 0, "teal");
    a.box(w * 0.81, 0.12, d * 0.65, 0, 1.51, 0, "teal");
    a.cylinder(0.085, 0.31, 0, 1.33, 0, "steel");
    for (const y of [0.83, 1.1]) a.box(w * 0.51, 0.1, d * 0.57, 0, y, 0, "steel");
    a.rod([w * 0.31, 1.25, d * 0.1], [w * 0.43, 1.49, d * 0.24], 0.04, "ink");
  } else if (/FREEZE|WASHER|PLASMA/.test(code)) {
    a.box(w * 0.86, 1.17, d * 0.85, 0, 0.66, 0, "cream");
    a.box(w * 0.9, 0.12, d * 0.9, 0, 0.08, 0, "slate");
    const r = Math.min(w * 0.31, 0.38);
    a.cylinder(r, 0.07, 0, 0.69, d * 0.45, "ink", r, [Math.PI / 2, 0, 0]);
    a.cylinder(r * 0.84, 0.076, 0, 0.69, d * 0.46, "glass", r * 0.84, [Math.PI / 2, 0, 0]);
    a.box(w * 0.4, 0.13, 0.025, 0, 1.1, d * 0.44, "darkTeal");
    a.sphere(0.035, w * 0.27, 1.1, d * 0.46, object.active ? "gold" : "stone");
  } else {
    table(a, w, d);
    a.box(w * 0.65, 0.12, d * 0.65, 0, 1.05, 0, "steel");
    if (/SIFT|SIEVE/.test(code)) {
      a.box(w * 0.57, 0.025, d * 0.57, 0, 1.12, 0, "stone");
      for (let i = -3; i <= 3; i++) a.box(w * 0.53, 0.005, 0.009, 0, 1.137, i * d * 0.07, "ink");
    } else {
      jar(a, -w * 0.23, 1.12, 0, 0.17, Boolean(object.active));
      a.box(w * 0.22, 0.025, d * 0.35, w * 0.2, 1.14, d * 0.1, "paper");
      a.rod([w * 0.09, 0.99, -d * 0.22], [w * 0.3, 1.47, -d * 0.22], 0.05, "teal");
      a.sphere(0.09, w * 0.3, 1.47, -d * 0.22, "steel", [1.6, 0.5, 1]);
    }
  }
}

function character(a: Art, object: InteriorObject) {
  const seed = hash(object.id), skin: Pigment = "skin", shirt: Pigment = seed % 2 ? "teal" : "blue";
  for (const x of [-0.13, 0.13]) {
    a.sphere(0.14, x, 0.1, 0.07, "ink", [0.83, 0.7, 1.55]);
    a.cylinder(0.096, 0.51, x, 0.41, 0, "slate", 0.11);
  }
  a.sphere(0.29, 0, 0.93, 0, shirt, [0.95, 1.25, 0.67]);
  a.box(0.35, 0.42, 0.04, 0, 0.85, 0.2, "honey");
  a.box(0.23, 0.12, 0.015, 0, 0.87, 0.226, "wood");
  for (const side of [-1, 1]) {
    a.rod([side * 0.22, 1.08, 0], [side * 0.34, 0.81, 0.04], 0.17, shirt);
    a.sphere(0.095, side * 0.33, 0.74, 0.07, skin);
    a.sphere(0.06, side * 0.25, 1.49, 0.015, skin);
  }
  a.cylinder(0.09, 0.13, 0, 1.23, 0, skin);
  a.sphere(0.26, 0, 1.49, 0, skin, [0.9, 1.04, 0.86]);
  a.sphere(0.26, 0, 1.59, -0.045, "hair", [0.91, 0.72, 0.8]);
  a.sphere(0.24, 0, 1.68, -0.02, shirt, [1.03, 0.5, 1]);
  a.box(0.34, 0.025, 0.19, 0.025, 1.65, 0.17, shirt, [0, 0, -0.05]);
  for (const x of [-0.075, 0.075]) {
    a.sphere(0.027, x, 1.5, 0.208, "ink", [0.65, 1.4, 0.4]);
    a.sphere(0.009, x - 0.005, 1.513, 0.22, "paper");
  }
  a.sphere(0.036, 0, 1.43, 0.228, skin, [1, 0.65, 0.7]);
  a.rod([-0.055, 1.38, 0.21], [0, 1.364, 0.222], 0.015, "ink");
  a.rod([0, 1.364, 0.222], [0.065, 1.39, 0.205], 0.015, "ink");
}

/** Local origin at the footprint centre, feet at y=0; final dimensions already include yaw. */
export function createInteriorObjectArt(object: InteriorObject, room?: InteriorRoom["id"]): THREE.Group {
  const quarterTurn = object.rotation === 90 || object.rotation === 270;
  const inset = object.kind === "partition" ? 1 : 0.94;
  const w = (quarterTurn ? object.depth : object.width) * inset;
  const d = (quarterTurn ? object.width : object.depth) * inset;
  const a = new Art(room !== undefined && Boolean(cutawayPalettes[room]));
  const furnished = room === "bank" || room === "office" ? furnishOfficeStation(a, object.id, w, d)
    : room === "market" || room === "shop" ? furnishMarketStation(a, object.id, w, d)
      : room === "arena" || room === "missions" ? furnishCivicStation(a, object.id, w, d) : false;
  if (!furnished) switch (object.kind) {
    case "partition": {
      const alongX = w >= d, length = Math.max(w, d), thickness = Math.min(w, d);
      const panel = (span: number, height: number, edge: number, offset: number, y: number, pigment: Pigment) =>
        a.box(alongX ? span : edge, height, alongX ? edge : span, alongX ? offset : 0, y, alongX ? 0 : offset, pigment);
      panel(length, 2.3, thickness * 0.76, 0, 1.25, "plaster");
      panel(length, 0.12, thickness, 0, 0.06, "darkTeal");
      panel(length, 0.09, thickness, 0, 2.455, "teal");
      const post = Math.min(0.085, length / 4);
      for (const offset of [-length / 2 + post / 2, length / 2 - post / 2]) panel(post, 2.5, thickness, offset, 1.25, "teal");
      for (let metre = 1; metre < length - 0.01; metre++) panel(0.025, 2.35, thickness * 0.85, metre - length / 2, 1.225, "stone");
      break;
    }
    case "culture": culture(a, object, w, d); break;
    case "drying": drying(a, object, w, d); break;
    case "storage": storage(a, object, w, d); break;
    case "bookshelf": storage(a, object, w, d, true); break;
    case "workbench": machine(a, object, w, d); break;
    case "character": character(a, object); break;
    case "desk":
      table(a, w, d);
      a.box(w * 0.3, 0.025, d * 0.45, -w * 0.16, 0.987, d * 0.12, "paper", [0, 0.12, 0]);
      for (let n = 0; n < 4; n++) a.box(w * 0.2, 0.004, 0.008, -w * 0.16, 1.003, d * (0.02 + n * 0.05), "stone");
      a.cylinder(0.06, 0.13, w * 0.29, 1.04, -d * 0.17, "ink");
      a.rod([w * 0.29, 1.05, -d * 0.17], [w * 0.34, 1.32, -d * 0.14], 0.015, "gold");
      break;
    case "counter":
      a.box(w * 0.92, 0.9, d * 0.83, 0, 0.45, 0, "wood");
      plankTop(a, w, d, 0.94);
      a.box(w * 0.85, 0.62, 0.025, 0, 0.48, d * 0.43, "teal");
      a.frame(w * 0.75, 0.48, 0, 0.48, d * 0.45, "honey");
      for (const x of [-w * 0.25, 0, w * 0.25]) jar(a, x, 1.02, -d * 0.12, 0.18, true);
      break;
    case "board":
      for (const x of [-w * 0.4, w * 0.4]) {
        a.box(0.08, 1.95, 0.08, x, 0.975, 0, "wood");
        a.box(0.13, 0.07, d * 0.86, x, 0.035, 0, "wood");
      }
      a.box(w * 0.87, 1.18, Math.min(d * 0.3, 0.09), 0, 1.3, 0, "wood");
      a.box(w * 0.77, 1.05, 0.016, 0, 1.3, Math.min(d * 0.15, 0.045) + 0.015, "darkTeal");
      for (let n = 0; n < 3; n++) paper(a, (n - 1) * w * 0.24, 1.3 + (n % 2) * 0.1, Math.min(d * 0.15, 0.045) + 0.032, w * 0.19, 0.55);
      break;
    case "cards":
      table(a, w, d, 0.88);
      a.box(w * 0.8, 0.018, d * 0.72, 0, 0.97, 0, "darkTeal");
      for (let n = 0; n < 5; n++) {
        const x = (n - 2) * w * 0.14;
        a.box(w * 0.11, 0.018, d * 0.43, x, 0.991, 0, "paper", [0, (n - 2) * 0.05, 0]);
        a.box(w * 0.08, 0.007, d * 0.3, x, 1.005, 0, n % 2 ? "teal" : "gold", [0, (n - 2) * 0.05, 0]);
        a.sphere(w * 0.021, x, 1.015, 0, "cream", [1, 0.1, 1]);
      }
      break;
    case "podium":
      a.box(w * 0.9, 0.15, d * 0.85, 0, 0.075, 0, "wood");
      a.box(w * 0.72, 0.92, d * 0.66, 0, 0.61, 0, "teal");
      a.box(w * 0.51, 0.54, 0.02, 0, 0.63, d * 0.34, "gold");
      a.box(w * 0.38, 0.4, 0.025, 0, 0.63, d * 0.355, "cream");
      plankTop(a, w, d, 1.12);
      a.cylinder(Math.min(w, d) * 0.15, 0.05, 0, 1.24, 0, "gold");
      a.sphere(Math.min(w, d) * 0.11, 0, 1.29, 0, "red", [1, 0.6, 1]);
      a.rod([w * 0.3, 1.2, -d * 0.2], [w * 0.28, 1.53, -d * 0.13], 0.025, "ink");
      a.sphere(0.05, w * 0.28, 1.53, -d * 0.13, "slate", [0.8, 1.3, 0.8]);
      break;
    case "safe": {
      a.box(w, 1.65, d, 0, 0.825, 0, "slate");
      a.box(w * 0.87, 1.43, 0.075, 0, 0.83, d * 0.5, "steel");
      a.box(w * 0.73, 1.27, 0.09, 0, 0.83, d * 0.52, "slate");
      const r = Math.min(w * 0.21, 0.26);
      a.torus(r, 0.03, 0, 0.85, d * 0.59, "gold");
      a.sphere(0.06, 0, 0.85, d * 0.6, "gold");
      for (let n = 0; n < 3; n++) a.rod([0, 0.85, d * 0.6], [Math.sin(n * Math.PI * 2 / 3) * r, 0.85 + Math.cos(n * Math.PI * 2 / 3) * r, d * 0.6], 0.032, "gold");
      for (const y of [0.35, 1.3]) a.box(w * 0.14, 0.12, 0.13, w * 0.38, y, d * 0.56, "ink");
      break;
    }
    case "exit":
      // The architectural door is in room art; this threshold marker stays below the doorway.
      a.box(w, 0.018, d, 0, 0.009, 0, "darkTeal");
      a.box(w * 0.78, 0.009, d * 0.72, 0, 0.024, 0, "honey");
      for (let n = -2; n <= 2; n++) a.box(w * 0.65, 0.004, 0.012, 0, 0.03, n * d * 0.09, "wood");
      break;
  }
  const group = a.finish(`interior-object-${object.id}`);
  const localBounds = new THREE.Box3().setFromObject(group);
  const localCenter = localBounds.getCenter(new THREE.Vector3());
  for (const child of group.children) {
    child.position.x -= localCenter.x;
    child.position.y -= Math.min(0, localBounds.min.y);
    child.position.z -= localCenter.z;
  }
  group.rotation.y = object.rotation * Math.PI / 180;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group), size = bounds.getSize(new THREE.Vector3());
  // Includes protruding handles, braces and yaw: art never invalidates the collision footprint.
  const footprintInset = object.kind === "partition" ? 1 : 0.98;
  const sx = Math.min(1, object.width * footprintInset / Math.max(size.x, 0.001));
  const sz = Math.min(1, object.depth * footprintInset / Math.max(size.z, 0.001));
  // A narrow interaction footprint must not turn a standing host into a knee-high figurine.
  group.scale.set(quarterTurn ? sz : sx, 1, quarterTurn ? sx : sz);
  group.userData.kind = object.kind;
  group.userData.deviceCode = object.deviceCode;
  group.userData.active = object.active;
  if (object.kind === "partition") group.userData.interiorPartition = true;
  return group;
}

function wallWindow(a: Art, x: number, y: number, z: number, w: number, h: number) {
  a.box(w, h, 0.025, x, y, z, "darkTeal");
  a.box(w * 0.82, h * 0.82, 0.03, x, y, z + 0.025, "glass");
  a.frame(w, h, x, y, z + 0.055, "teal", 0.075);
  a.box(0.055, h, 0.055, x, y, z + 0.06, "cream");
  a.box(w, 0.055, 0.055, x, y, z + 0.06, "cream");
  a.box(w + 0.16, 0.08, 0.2, x, y - h / 2, z + 0.1, "stone");
}

function roomInsignia(a: Art, room: InteriorRoom) {
  const y = room.height - 0.55, z = -room.depth / 2 + 0.17;
  if (room.id === "warehouse") return;
  a.box(1.55, 0.72, 0.09, 0, y, z, "wood");
  a.box(1.4, 0.59, 0.025, 0, y, z + 0.06, "darkTeal");
  if (room.id === "bank") {
    a.cylinder(0.245, 0.045, 0, y, z + 0.1, "gold", 0.245, [Math.PI / 2, 0, 0]);
    a.torus(0.18, 0.014, 0, y, z + 0.13, "honey");
    a.rod([-0.04, y + 0.15, z + 0.14], [-0.04, y - 0.15, z + 0.14], 0.024, "honey");
    a.rod([0.04, y + 0.15, z + 0.14], [0.04, y - 0.15, z + 0.14], 0.024, "honey");
  } else if (room.id === "arena") {
    a.cylinder(0.09, 0.08, 0, y - 0.21, z + 0.14, "gold");
    a.cylinder(0.035, 0.12, 0, y - 0.12, z + 0.14, "gold");
    a.cylinder(0.07, 0.27, 0, y + 0.04, z + 0.14, "gold", 0.17);
    for (const x of [-0.17, 0.17]) a.torus(0.085, 0.018, x, y + 0.06, z + 0.14, "gold");
  } else if (room.id === "shop") {
    for (let n = -1; n <= 1; n++) {
      a.box(0.27, 0.39, 0.025, n * 0.21, y + Math.abs(n) * 0.025, z + 0.1 + (n + 1) * 0.018, "paper", [0, 0, n * -0.15]);
      a.sphere(0.06, n * 0.21, y, z + 0.14 + (n + 1) * 0.018, n % 2 ? "gold" : "teal", [1, 1.4, 0.2]);
    }
  } else if (room.id === "collection") {
    a.cylinder(0.25, 0.025, 0, y, z + 0.11, "gold", 0.25, [Math.PI / 2, 0, 0]);
    const arc = new THREE.TorusGeometry(0.09, 0.025, 5, 12, Math.PI * 1.4);
    a.add(arc, "darkTeal", [0, y + 0.07, z + 0.14], [0, 0, -0.45]);
    a.rod([0.035, y + 0.01, z + 0.14], [0, y - 0.08, z + 0.14], 0.04, "darkTeal");
    a.sphere(0.026, 0, y - 0.15, z + 0.14, "darkTeal");
  } else if (room.id === "market") {
    for (const x of [-0.25, 0, 0.25]) jar(a, x, y - 0.23, z + 0.14, 0.19, false);
  } else {
    paper(a, -0.15, y, z + 0.1, 0.36, 0.44);
    paper(a, 0.16, y + 0.03, z + 0.13, 0.33, 0.43);
    if (room.id === "office") a.rod([0.35, y - 0.15, z + 0.17], [0.46, y + 0.2, z + 0.17], 0.035, "gold");
  }
}

const cutawayPalettes: Partial<Record<InteriorRoom["id"], {
  wall: Pigment;
  trim: Pigment;
  floor: readonly [Pigment, Pigment];
  tiles: boolean;
}>> = {
  bank: { wall: "cream", trim: "darkTeal", floor: ["limestone", "stone"], tiles: true },
  office: { wall: "cream", trim: "darkTeal", floor: ["honey", "wood"], tiles: false },
  market: { wall: "apricot", trim: "darkTeal", floor: ["honey", "apricot"], tiles: false },
  missions: { wall: "plaster", trim: "blue", floor: ["cream", "plaster"], tiles: true },
  arena: { wall: "wood", trim: "darkTeal", floor: ["honey", "wood"], tiles: false },
  shop: { wall: "cream", trim: "darkTeal", floor: ["cream", "apricot"], tiles: true },
};

function makeCutaway(room: InteriorRoom, palette: NonNullable<(typeof cutawayPalettes)[InteriorRoom["id"]]>) {
  const bank = room.id === "bank";
  const a = new Art(true), { width: w, depth: d } = room;
  const h = room.id === "shop" || room.id === "market" ? 3.85 : 2.75;
  const left = -w / 2, rear = -d / 2;
  a.box(w + 0.24, 0.2, d + 0.24, 0, -0.125, 0, palette.trim);
  a.box(w + 0.13, 0.085, d + 0.13, 0, -0.236, 0, "wood");
  const tileSize = bank ? 1.12 : 0.82;
  const nx = Math.ceil(w / (palette.tiles ? tileSize : 0.4)), nz = Math.ceil(d / (palette.tiles ? tileSize : 2.9));
  const tw = w / nx, td = d / nz;
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    const tone = 0.94 + ((ix * 7 + iz * 3) % 5) * 0.013;
    const accent = room.id === "shop" ? (ix + iz) % 2 : Number((ix * 3 + iz) % 7 === 0);
    const seam = bank ? 0.008 : 0.015;
    a.box(tw - seam, 0.025, td - seam, left + (ix + 0.5) * tw, 0, rear + (iz + 0.5) * td, palette.floor[accent], ZERO, tone);
  }
  const sideHeight = room.id === "market" || room.id === "arena" ? 1.15 : 2.12;
  a.box(w + 0.16, h, 0.16, 0, h / 2, rear - 0.02, palette.wall);
  a.box(0.16, sideHeight, d, left - 0.02, sideHeight / 2, 0, palette.wall);
  a.box(w + 0.23, 0.13, 0.28, 0, h, rear - 0.02, palette.trim);
  a.box(0.28, 0.13, d + 0.14, left - 0.02, sideHeight, 0, palette.trim);
  const rail = bank ? 0.82 : 0.65;
  a.box(w, rail, 0.06, 0, rail / 2, rear + 0.072, palette.trim);
  a.box(0.06, rail, d, left + 0.075, rail / 2, 0, palette.trim);
  a.box(w, 0.07, 0.12, 0, rail, rear + 0.085, "honey");
  a.box(0.12, 0.07, d, left + 0.085, rail, 0, "honey");
  if (bank) {
    for (let n = 0; n < 10; n++) {
      const x = left + (n + 0.5) * w / 10;
      a.box(w / 10 - 0.12, 0.52, 0.028, x, 0.42, rear + 0.111, "teal");
      a.frame(w / 10 - 0.21, 0.43, x, 0.42, rear + 0.13, "darkTeal", 0.031);
    }
    for (let n = 0; n < 8; n++) {
      const z = rear + (n + 0.5) * d / 8;
      a.box(0.028, 0.52, d / 8 - 0.12, left + 0.111, 0.42, z, "teal");
    }
    for (const x of [-4.9, -1.98, 0.37, 3.65, 5.25]) {
      a.box(0.105, 1.82, 0.13, x, 1.74, rear + 0.08, "darkTeal");
      for (const y of [0.88, 2.59]) a.box(0.19, 0.105, 0.18, x, y, rear + 0.1, "teal");
    }
  } else {
    for (let n = 0; n < Math.ceil(w / 0.55); n++) {
      a.box(0.02, 0.61, 0.018, left + 0.16 + n * 0.55, 0.325, rear + 0.105, "wood");
    }
  }
  a.box(w * 0.17, 0.12, 0.33, 0, -0.058, d / 2 + 0.16, "stone");
  if (room.id === "bank" || room.id === "office") furnishOffice(a, room.id);
  else if (room.id === "market" || room.id === "shop") furnishMarket(a, room.id);
  else if (room.id === "arena" || room.id === "missions") furnishCivic(a, room.id);
  const group = a.finish(`interior-cutaway-${room.id}`);
  group.userData.generated = true;
  return group;
}

/** Architecture only. Furniture and gameplay state belong exclusively to object art. */
export function createInteriorRoomArt(room: InteriorRoom, { cutaway = false }: { cutaway?: boolean } = {}): THREE.Group {
  const palette = cutawayPalettes[room.id];
  if (cutaway && palette) return makeCutaway(room, palette);
  const a = new Art(), w = room.width, d = room.depth, h = room.height;
  const roof = new Art();
  const open = ["market", "missions", "arena"].includes(room.id), warehouse = room.id === "warehouse";
  a.box(w + 0.2, 0.18, d + 0.2, 0, -0.1, 0, open ? "wood" : "stone");
  // Irregular pigment and fine joints are modelled, so no external textures are required.
  if (warehouse) {
    const floorWidth = room.workArea?.width ?? w, floorDepth = room.workArea?.depth ?? d;
    // The apron has no competing joints. Every paid-floor joint follows the
    // same metre grid and origin as the clickable construction cells.
    a.box(w, 0.025, d, 0, -0.005, 0, "plaster", ZERO, 0.97);
    for (let ix = 0; ix < floorWidth; ix++) for (let iz = 0; iz < floorDepth; iz++) {
      const tone = 0.94 + (ix * 7 + iz * 3) % 5 * 0.012;
      a.box(0.984, 0.025, 0.984, -floorWidth / 2 + ix + 0.5, 0.002, -floorDepth / 2 + iz + 0.5, "plaster", ZERO, tone);
    }
  } else {
    const tile = open ? 0.42 : 1.0, nx = Math.ceil(w / tile), nz = Math.ceil(d / (open ? d : tile));
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      const tw = w / nx, td = d / nz, tone = 0.94 + (ix * 7 + iz * 3) % 5 * 0.012;
      a.box(tw - 0.016, 0.025, td - 0.016, -w / 2 + (ix + 0.5) * tw, 0.002, -d / 2 + (iz + 0.5) * td, open ? "honey" : "cream", ZERO, tone);
    }
  }
  if (!open) {
    a.box(w + 0.24, h, 0.2, 0, h / 2, -d / 2 - 0.1, "cream");
    for (const x of [-w / 2 - 0.1, w / 2 + 0.1]) a.box(0.2, h, d + 0.2, x, h / 2, 0, "cream");
    const doorway = Math.min(1.8, w * 0.3), side = (w - doorway) / 2;
    for (const sign of [-1, 1]) a.box(side, h, 0.2, sign * (doorway / 2 + side / 2), h / 2, d / 2 + 0.1, "cream");
    const doorHeight = Math.min(2.4, h * 0.86);
    a.box(doorway, h - doorHeight, 0.2, 0, doorHeight + (h - doorHeight) / 2, d / 2 + 0.1, "cream");
    a.frame(doorway + 0.12, doorHeight, 0, doorHeight / 2, d / 2, "teal", 0.14);
    // A recessed closed door is an interaction target, not an opening into unmodelled space.
    a.box(doorway - 0.06, doorHeight - 0.06, 0.09, 0, doorHeight / 2, d / 2 + 0.07, "teal");
    for (let n = -2; n <= 2; n++) a.box(0.014, doorHeight - 0.18, 0.012, n * doorway * 0.16, doorHeight / 2, d / 2 + 0.018, "darkTeal");
    a.sphere(0.065, doorway * 0.3, 1, d / 2 - 0.02, "gold");
    for (const y of [0.42, doorHeight * 0.76]) a.box(doorway * 0.27, 0.1, 0.04, -doorway * 0.3, y, d / 2 - 0.01, "ink");
    // Granite footing and waist-height timber keep the village's identity indoors.
    a.box(w, 0.34, 0.12, 0, 0.19, -d / 2 + 0.04, "stone");
    a.box(w, 0.08, 0.1, 0, 1.02, -d / 2 + 0.035, warehouse ? "teal" : "wood");
    for (const sign of [-1, 1]) {
      a.box(0.12, 0.34, d, sign * (w / 2 - 0.04), 0.19, 0, "stone");
      a.box(0.1, 0.08, d, sign * (w / 2 - 0.035), 1.02, 0, warehouse ? "teal" : "wood");
      for (let n = 0; n < Math.floor(d / 0.65); n++) a.box(0.015, 0.018, 0.024, sign * (w / 2 - 0.105), 0.34, -d / 2 + 0.35 + n * 0.65, "ink");
      for (let row = 0; row < 4; row++) {
        const sy = 0.47 + row * 0.26, sz = -d / 2 + 0.08;
        a.box(row % 2 ? 0.45 : 0.31, 0.225, 0.04, sign * (w / 2 - (row % 2 ? 0.24 : 0.17)), sy, sz, "stone", ZERO, 0.95 + row % 2 * 0.035);
        a.box(0.04, 0.225, row % 2 ? 0.31 : 0.45, sign * (w / 2 - 0.08), sy, -d / 2 + (row % 2 ? 0.17 : 0.24), "stone", ZERO, 0.95 + row % 2 * 0.035);
      }
    }
    const windows = w > 8 ? 3 : 2;
    for (let n = 0; n < windows; n++) wallWindow(a, (n - (windows - 1) / 2) * w / (windows + 0.5), Math.min(2.05, h * 0.64), -d / 2 + 0.035, Math.min(1.2, w / 5), Math.min(1.05, h * 0.3));
    for (const sign of [-1, 1]) for (const z of [-d * 0.23, d * 0.22]) {
      const x = sign * (w / 2 - 0.045), wy = Math.min(2.05, h * 0.64), wh = Math.min(1.05, h * 0.3);
      a.box(0.025, wh, 1.2, x, wy, z, "darkTeal");
      a.box(0.035, wh * 0.83, 1, x - sign * 0.025, wy, z, "glass");
      for (const y of [wy - wh / 2, wy + wh / 2]) a.box(0.075, 0.075, 1.26, x - sign * 0.055, y, z, "teal");
      for (const dz of [-0.6, 0.6]) a.box(0.075, wh, 0.075, x - sign * 0.055, wy, z + dz, "teal");
      a.box(0.06, wh, 0.045, x - sign * 0.065, wy, z, "cream");
      a.box(0.06, 0.045, 1.2, x - sign * 0.065, wy, z, "cream");
      a.box(0.2, 0.07, 1.4, x - sign * 0.08, wy - wh / 2, z, "stone");
    }
  } else {
    // Open public shelters retain the horizon, apron and unmistakable wooden framework.
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) {
      a.box(0.19, h, 0.19, x, h / 2, z, "wood");
      a.box(0.25, 0.35, 0.25, x, 0.18, z, "stone");
      a.rod([x, h - 0.9, z], [x - Math.sign(x) * 0.65, h - 0.12, z], 0.12, "honey");
    }
    a.box(w, h * 0.5, 0.12, 0, h * 0.25, -d / 2, "darkTeal");
    // Rear planks, with gaps and ink seams; do not add any solid furniture outside footprints.
    const plankCount = Math.ceil(w / 0.42);
    for (let n = 0; n < plankCount; n++) a.box(w / plankCount - 0.02, h * 0.45, 0.05, -w / 2 + (n + 0.5) * w / plankCount, h * 0.25, -d / 2 + 0.08, "wood", ZERO, 0.94 + n % 3 * 0.025);
    const stripeCount = Math.ceil(w / 0.75);
    for (let n = 0; n < stripeCount; n++) roof.box(w / stripeCount, 0.055, d + 0.3, -w / 2 + (n + 0.5) * w / stripeCount, h + 0.12, 0, n % 2 ? "cream" : room.id === "market" ? "gold" : "teal");
    for (let n = 0; n < 9; n++) {
      const shape = new THREE.Shape().moveTo(-0.16, 0).lineTo(0.16, 0).lineTo(0, -0.28).closePath();
      a.add(new THREE.ShapeGeometry(shape), n % 2 ? "cream" : "gold", [-w * 0.4 + n * w * 0.1, h - 0.25, d / 2 + 0.01]);
    }
    a.rod([-w * 0.43, h - 0.22, d / 2], [w * 0.43, h - 0.22, d / 2], 0.018, "ink");
  }
  const beams = Math.max(3, Math.ceil(d / 2.1));
  for (let n = 0; n < beams; n++) {
    const z = -d / 2 + (n + 0.5) * d / beams;
    roof.box(w, 0.16, 0.15, 0, h - 0.04, z, warehouse ? "teal" : "wood");
    if (!open) for (const sign of [-1, 1]) {
      a.box(0.12, h - 0.2, 0.12, sign * (w / 2 - 0.1), h / 2, z, warehouse ? "teal" : "wood");
      a.rod([sign * (w / 2 - 0.12), h - 0.7, z], [sign * (w / 2 - 0.65), h - 0.13, z], 0.08, warehouse ? "darkTeal" : "honey");
      if (warehouse) for (const y of [0.4, h - 0.4]) {
        a.box(0.17, 0.23, 0.18, sign * (w / 2 - 0.1), y, z, "darkTeal");
        a.sphere(0.022, sign * (w / 2 - 0.2), y, z, "steel");
      }
    }
    if (warehouse || n % 2 === 0) {
      roof.box(Math.min(1.5, w * 0.25), 0.075, 0.3, 0, h - 0.17, z, "slate");
      roof.box(Math.min(1.4, w * 0.23), 0.018, 0.26, 0, h - 0.22, z, "paper");
    }
  }
  if (!open) {
    roof.box(w, 0.08, d, 0, h + 0.12, 0, "plaster");
    if (warehouse) {
      for (const x of [-w * 0.46, w * 0.46]) {
        roof.rod([x, h - 0.4, -d * 0.46], [x, h - 0.4, d * 0.46], 0.11, "steel");
        for (let n = 0; n < 8; n++) roof.torus(0.062, 0.012, x, h - 0.4, -d * 0.4 + n * d * 0.11, "slate");
      }
      a.box(1.3, 0.65, 0.19, 0, h - 0.55, -d / 2 + 0.16, "steel");
      for (let n = 0; n < 6; n++) a.box(1.05, 0.035, 0.025, 0, h - 0.77 + n * 0.085, -d / 2 + 0.27, "ink");
    }
  }
  roomInsignia(a, room);
  const group = a.finish(`interior-room-${room.id}`);
  const ceiling = roof.finish("interior-roof");
  ceiling.userData.interiorRoof = true;
  group.add(ceiling);
  // Engine can hide just roof geometry for overhead editing without disposing room art.
  group.userData.generated = true;
  group.userData.openShelter = open;
  return group;
}

/** Every group owns its merged buffers/materials; no shared globals remain alive after teardown. */
export function disposeInteriorArt(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return;
    geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  group.clear();
}
