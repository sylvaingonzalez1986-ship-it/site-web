import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { projectVillageSurface, villageMaterial, type VillageSurface } from "./village-surfaces";

export type VillageBuildingKind = "warehouse" | "bank" | "office" | "market" | "shop" | "arena" | "missions" | "collection";

const C = {
  cream: "#f6e6bc", light: "#fff2cf", slate: "#344c56", tile: "#516872",
  slateGreen: "#37564e", slateViolet: "#51566a", lime: "#f4e2bc",
  teal: "#008f8c", tealDark: "#00615f", wood: "#ad713d", woodLight: "#d99a57",
  gold: "#efb33b", ink: "#243b37", stone: "#bcb092", granite: "#93988a", glass: "#3b7777",
  paper: "#fff4d6", red: "#ba503b", green: "#477c50", white: "#fff9e7",
} as const;
type Paint = keyof typeof C;
type XYZ = readonly [number, number, number];
type RoofSlate = "slate" | "slateGreen" | "slateViolet";
type MaterialFamily = "masonry" | "roof" | "joinery" | "metal" | "solid";

const familyByPaint: Partial<Record<Paint, MaterialFamily>> = {
  lime: "masonry", stone: "masonry", granite: "masonry", slate: "roof", tile: "roof", slateGreen: "roof", slateViolet: "roof",
  wood: "joinery", woodLight: "joinery", teal: "joinery", tealDark: "joinery", gold: "metal",
};
const surfaceByFamily: Partial<Record<MaterialFamily, VillageSurface>> = { masonry: "granite", roof: "slate", joinery: "timber" };

/** Pigment is baked into the vertices, leaving one mesh per material on each animated part. */
class BuildingParts {
  private batches = new Map<MaterialFamily, THREE.BufferGeometry[]>();
  private children: THREE.Group[] = [];
  private pigment = new THREE.Color();

  constructor(private readonly origin: XYZ = [0, 0, 0]) {}

  add(geometry: THREE.BufferGeometry, paint: Paint, position: XYZ, rotation: XYZ = [0, 0, 0], tone = 1) {
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    this.pigment.set(C[paint]).multiplyScalar(tone);
    for (let i = 0; i < colors.length; i += 3) this.pigment.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.deleteAttribute("uv");
    this.append(geometry, familyByPaint[paint] ?? "solid", position, rotation);
  }

  private append(geometry: THREE.BufferGeometry, family: MaterialFamily, position: XYZ, rotation: XYZ) {
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(position[0] - this.origin[0], position[1] - this.origin[1], position[2] - this.origin[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(1, 1, 1),
    ));
    const batch = this.batches.get(family) ?? [];
    batch.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
    this.batches.set(family, batch);
  }

  box(size: XYZ, position: XYZ, paint: Paint, rotation: XYZ = [0, 0, 0], tone = 1) {
    this.add(new THREE.BoxGeometry(...size), paint, position, rotation, tone);
  }

  cylinder(radius: number, height: number, position: XYZ, paint: Paint, rotation: XYZ = [0, 0, 0], topRadius = radius) {
    this.add(new THREE.CylinderGeometry(topRadius, radius, height, 12), paint, position, rotation);
  }

  sphere(radius: number, position: XYZ, paint: Paint, scale: XYZ = [1, 1, 1]) {
    const geometry = new THREE.SphereGeometry(radius, 12, 8);
    geometry.scale(...scale);
    this.add(geometry, paint, position);
  }

  torus(radius: number, tube: number, position: XYZ, paint: Paint, rotation: XYZ = [0, 0, 0]) {
    this.add(new THREE.TorusGeometry(radius, tube, 6, 20), paint, position, rotation);
  }

  beam(from: XYZ, to: XYZ, thickness: number, paint: Paint) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const geometry = new THREE.BoxGeometry(thickness, a.distanceTo(b), thickness);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    this.add(geometry, paint, a.add(b).multiplyScalar(0.5).toArray() as [number, number, number]);
  }

  shape(shape: THREE.Shape, depth: number, position: XYZ, paint: Paint, bevel = 0.025) {
    this.add(new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, bevelEnabled: bevel > 0, bevelSize: bevel,
      bevelThickness: bevel, bevelSegments: 1, curveSegments: 10,
    }), paint, position);
  }

  /** Keep modelling coordinates unchanged; child vertices are rebased around their hinge. */
  group(name: string, pivot: XYZ, build: (parts: BuildingParts) => void, visible = true) {
    const parts = new BuildingParts(pivot);
    build(parts);
    const group = parts.buildGroup(name);
    group.position.set(pivot[0] - this.origin[0], pivot[1] - this.origin[1], pivot[2] - this.origin[2]);
    group.visible = visible;
    this.children.push(group);
    return group;
  }

  movable(id: string, pivot: XYZ, build: (parts: BuildingParts) => void) {
    return this.group(`motion-${id}`, pivot, build);
  }

  anchor(name: string, position: XYZ) {
    return this.group(name, position, () => {});
  }

  /** Rotate static facade details into the same material batches, including rear faces. */
  facing(position: XYZ, yaw: number, build: (parts: BuildingParts) => void) {
    const details = new BuildingParts();
    build(details);
    if (details.children.length) throw new Error("Animated details need their own named hinge");
    for (const [family, geometries] of details.batches) {
      for (const geometry of geometries) this.append(geometry, family, position, [0, yaw, 0]);
    }
  }

  private buildGroup(name: string, meshPrefix = name) {
    const group = new THREE.Group();
    group.name = name;
    for (const [family, geometries] of this.batches) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (!merged) throw new Error(`Unable to merge village ${name}/${family}`);
      merged.computeBoundingSphere();
      const surface = surfaceByFamily[family];
      if (surface) projectVillageSurface(merged, surface);
      const material = villageMaterial({ vertexColors: true, roughness: 0.92, metalness: family === "metal" ? 0.2 : 0, flatShading: true }, surface);
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${meshPrefix}-${family}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (this.children.length) group.add(...this.children);
    return group;
  }

  finish(kind: VillageBuildingKind | "mailbox") {
    const group = this.buildGroup(`village-building-${kind}`, kind);
    group.userData.buildingKind = kind;
    return group;
  }
}

function arch(width: number, height: number) {
  const r = width / 2, shape = new THREE.Shape();
  shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, height - r);
  shape.absarc(0, height - r, r, 0, Math.PI, false); shape.closePath();
  return shape;
}

function graniteBlock(p: BuildingParts, width: number, height: number, at: XYZ, salt: number, paint: Paint = "stone", yaw = 0) {
  const w = width / 2, h = height / 2, bevel = 0.032;
  const shape = new THREE.Shape();
  shape.moveTo(-w, -h + bevel); shape.lineTo(-w + bevel, -h);
  shape.lineTo(w - bevel * (1 + salt % 2), -h + Math.sin(salt) * 0.016); shape.lineTo(w, -h + bevel * 1.3);
  shape.lineTo(w - bevel * 0.3, h - bevel); shape.lineTo(w - bevel * 1.5, h);
  shape.lineTo(-w + bevel * 1.4, h + Math.cos(salt) * 0.01); shape.lineTo(-w, h - bevel); shape.closePath();
  p.add(new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.014, bevelSegments: 1 }),
    paint, at, [0, yaw, Math.sin(salt * 1.5) * 0.037], 0.86 + salt % 7 * 0.028);
}

function wall(p: BuildingParts, width: number, depth: number, height: number, rise: number, farm = false) {
  p.box([width, height, depth], [0, height / 2 + 0.12, 0], "lime");
  p.box([width + 0.15, 0.23, depth + 0.13], [0, 0.14, 0], "stone");
  const gable = new THREE.Shape();
  gable.moveTo(-width / 2, 0); gable.lineTo(width / 2, 0); gable.lineTo(0, rise); gable.closePath();
  p.shape(gable, depth, [0, height + 0.12, -depth / 2], "lime", 0);
  // Staggered Breton granite footing and alternating dressed corner stones.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) for (let i = 0; i < Math.ceil(width / 0.5); i++) {
      const unit = width / Math.ceil(width / 0.5), x = -width / 2 + unit * (i + 0.5);
      graniteBlock(p, unit - 0.068, 0.145, [x, 0.19 + row * 0.18, side * (depth / 2 + 0.027)], i * 3 + row + 1,
        (i + row) % 4 === 0 ? "granite" : "stone", side === 1 ? 0 : Math.PI);
    }
    for (let i = 0; i < Math.ceil(depth / 0.5); i++) {
      const unit = depth / Math.ceil(depth / 0.5);
      graniteBlock(p, unit - 0.06, 0.283, [side * (width / 2 + 0.021), 0.275, -depth / 2 + unit * (i + 0.5)], i + 4,
        i % 4 === 0 ? "granite" : "stone", side * Math.PI / 2);
    }
    for (const back of [-1, 1]) for (let row = 0; row < Math.floor(height / 0.34); row++) {
      const long = row % 2 === 0;
      p.box([long ? 0.43 : 0.27, 0.27, 0.13], [side * (width / 2 - (long ? 0.15 : 0.07)), 0.52 + row * 0.33, back * (depth / 2 + 0.035)], row % 3 ? "stone" : "light", [0, 0, side * 0.012], 0.92 + row % 3 * 0.04);
      p.box([0.13, 0.27, long ? 0.26 : 0.43], [side * (width / 2 + 0.035), 0.52 + row * 0.33, back * (depth / 2 - (long ? 0.07 : 0.15))], "stone", [0, 0, 0], 0.9 + row % 3 * 0.045);
    }
    // Under the limewash, staggered stones follow the old masonry courses.
    for (let i = 0; i < (farm ? 8 : 4); i++) {
      const mortarCourse = i % 3;
      const z = -depth * 0.36 + depth * 0.69 * (i + 0.5) / (farm ? 8 : 4);
      graniteBlock(p, 0.27 + i % 3 * 0.09, 0.11 + i % 2 * 0.04, [side * (width / 2 + 0.001), 0.51 + mortarCourse * 0.17, z], i + 2,
        i % 5 === 0 ? "granite" : "stone", side * Math.PI / 2);
    }
    p.box([width - 0.12, 0.11, 0.1], [0, height + 0.07, side * (depth / 2 + 0.035)], "wood");
  }
}

function slateShingle(length: number, width: number, seed: number, side: number) {
  const l = length / 2, w = width / 2;
  const corner = Math.min(l * 0.4, w * 0.6, 0.022 + seed % 4 * 0.008);
  const outline = [[-l, -w + corner], [-l + corner, -w], [l - corner, -w], [l, -w + corner * 0.7],
    [l, w - corner * 1.2], [l - corner, w], [-l + corner, w], [-l, w - corner]];
  const positions = outline.flatMap(([x, z]) => [x, 0.028 - x * side * 0.105, z]);
  positions.push(...outline.flatMap(([x, z]) => [x, -0.035, z]));
  const indices: number[] = [];
  for (let i = 1; i < outline.length - 1; i++) indices.push(0, i + 1, i);
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    indices.push(i, next, i + 8, next, next + 8, i + 8);
  }
  const tile = new THREE.BufferGeometry();
  tile.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  tile.setIndex(indices);
  tile.computeVertexNormals();
  return tile;
}

function roof(p: BuildingParts, width: number, depth: number, base: number, rise: number, slate: RoofSlate = "slate") {
  const half = width / 2, slope = Math.hypot(half, rise), angle = Math.atan2(rise, half);
  for (const side of [-1, 1]) {
    const rotation: XYZ = [0, 0, -side * angle];
    p.box([slope, 0.16, depth], [side * width / 4, base + rise / 2, 0], slate, rotation, 0.82);
    p.box([0.1, 0.17, depth + 0.04], [side * half, base, 0], "ink");
    const rows = Math.max(3, Math.ceil(slope / 0.46)), columns = Math.max(3, Math.ceil(depth / 0.44));
    for (let row = 0; row < rows; row++) for (let col = 0; col <= columns; col++) {
      const unit = depth / columns, offset = row % 2 * unit / 2;
      const bias = Math.sin(row * 3.2 + col * 6.7 + side) * 0.044;
      const nextBias = Math.sin(row * 3.2 + (col + 1) * 6.7 + side) * 0.044;
      const left = Math.max(-depth / 2, -depth / 2 + col * unit - offset + bias);
      const right = Math.min(depth / 2, -depth / 2 + (col + 1) * unit - offset + nextBias);
      if (right - left < 0.085) continue;
      const t = (row + 0.48) / rows, seed = (row * 17 + col * 11 + side + 1) % 13;
      const x = side * half * t, y = base + rise * (1 - t) + 0.124 + seed % 4 * 0.003;
      const paint = seed % 7 === 0 ? "tile" : slate;
      p.add(slateShingle(slope / rows + 0.027, right - left - 0.021, seed, side), paint, [x, y, (left + right) / 2],
        [0, Math.sin(seed) * 0.014, -side * angle], 0.89 + seed * 0.016);
    }
    for (const z of [-depth / 2, depth / 2]) {
      p.beam([0, base + rise + 0.015, z], [side * half, base + 0.015, z], 0.13, "ink");
      p.beam([0, base + rise - 0.1, z - Math.sign(z) * 0.04], [side * half, base - 0.1, z - Math.sign(z) * 0.04], 0.12, "wood");
    }
    // Visible rafter ends and an eaves gutter return a handmade silhouette.
    for (let i = 0; i < Math.ceil(depth / 0.45); i++) p.box([0.34, 0.11, 0.105], [side * (half - 0.14), base - 0.15, -depth / 2 + 0.19 + i * 0.45], "woodLight", rotation, 0.9 + i % 3 * 0.04);
    p.cylinder(0.075, depth + 0.16, [side * (half + 0.025), base - 0.05, 0], "ink", [Math.PI / 2, 0, 0]);
  }
  p.box([0.12, 0.13, depth + 0.09], [0, base + rise + 0.06, 0], "ink");
  const caps = Math.ceil(depth / 0.37), capLength = depth / caps;
  for (let i = 0; i < caps; i++) p.cylinder(0.12, capLength - 0.016, [0, base + rise + 0.1, -depth / 2 + (i + 0.5) * capLength],
    i % 4 ? slate : "tile", [Math.PI / 2, 0, 0], 0.112);
}

function chimney(p: BuildingParts, x: number, y: number, z: number) {
  p.box([0.47, 0.84, 0.47], [x, y, z], "cream");
  p.box([0.62, 0.16, 0.61], [x, y + 0.34, z], "stone");
  p.box([0.34, 0.35, 0.35], [x + 0.04, y + 0.59, z], "wood");
  p.box([0.47, 0.1, 0.47], [x + 0.04, y + 0.79, z], "woodLight");
  p.box([0.29, 0.012, 0.29], [x + 0.04, y + 0.846, z], "ink");
  for (let row = 0; row < 4; row++) for (const side of [-1, 1]) {
    p.box([0.45, 0.018, 0.02], [x, y - 0.3 + row * 0.18, z + side * 0.24], "stone");
    p.box([0.018, 0.15, 0.02], [x + (row % 2 ? -0.1 : 0.09), y - 0.22 + row * 0.18, z + side * 0.24], "stone");
    p.box([0.02, 0.018, 0.45], [x + side * 0.24, y - 0.3 + row * 0.18, z], "stone");
  }
  p.box([0.67, 0.075, 0.67], [x, y - 0.39, z], "slate");
}

function door(p: BuildingParts, x: number, z: number, width: number, height: number, paint: Paint = "teal", doubles = false) {
  p.shape(arch(width + 0.19, height + 0.11), 0.09, [x, 0.22, z], "ink");
  p.shape(arch(width, height), 0.095, [x, 0.24, z + 0.07], paint);
  for (let i = 1; i <= 5; i++) {
    const px = x - width / 2 + i * width / 6;
    const top = height - width / 2 + Math.sqrt(Math.max(0, width * width / 4 - (px - x) ** 2));
    p.box([0.016, top - 0.07, 0.016], [px, 0.26 + top / 2, z + 0.18], paint === "wood" ? "woodLight" : "tealDark");
  }
  if (doubles) {
    p.box([0.04, height - 0.08, 0.045], [x, height / 2 + 0.24, z + 0.19], "ink");
    for (const side of [-1, 1]) {
      for (const y of [0.7, 1.6]) p.box([width * 0.31, 0.11, 0.07], [x + side * width * 0.32, y, z + 0.2], "ink");
      p.box([0.07, 0.25, 0.1], [x + side * 0.12, 1.05, z + 0.23], "ink");
    }
  } else p.sphere(0.085, [x + width * 0.28, 1.03, z + 0.24], "gold");
  p.box([width + 0.27, 0.17, 0.44], [x, 0.16, z + 0.25], "light");
  for (const side of [-1, 1]) {
    for (const y of [0.6, Math.min(1.48, height - 0.25)]) {
      p.box([width * 0.19, 0.055, 0.035], [x + side * width * 0.37, y, z + 0.225], "ink");
      for (const offset of [0.015, width * 0.1]) p.sphere(0.022, [x + side * (width * 0.3 + offset), y, z + 0.251], "gold");
    }
    for (let row = 0; row < Math.floor((height - width / 2) / 0.28); row++) p.box([0.13, 0.245, 0.15], [x + side * (width / 2 + 0.1), 0.37 + row * 0.28, z + 0.08], "stone", [0, 0, 0], 0.94 + row % 2 * 0.06);
  }
  const radius = width / 2 + 0.1;
  for (let segment = 0; segment < 9; segment++) {
    const angle = segment * Math.PI / 8;
    p.box([0.16, 0.2, 0.15], [x + Math.cos(angle) * radius, 0.24 + height - width / 2 + Math.sin(angle) * radius, z + 0.075], segment === 4 ? "light" : "stone", [0, 0, angle - Math.PI / 2]);
  }
  p.box([0.085, 0.18, 0.03], [x + width * 0.28, 0.8, z + 0.22], "ink");
  p.sphere(0.027, [x + width * 0.28, 0.83, z + 0.245], "gold");
  p.box([width + 0.08, 0.02, 0.3], [x, 0.256, z + 0.27], "stone");
}

function window(p: BuildingParts, x: number, y: number, z: number, shutters = true) {
  p.shape(arch(0.71, 1.12), 0.04, [x, y, z], "ink");
  p.shape(arch(0.55, 0.96), 0.04, [x, y + 0.08, z + 0.04], "glass");
  p.box([0.055, 0.94, 0.05], [x, y + 0.55, z + 0.11], "light");
  p.box([0.55, 0.055, 0.05], [x, y + 0.54, z + 0.11], "light");
  p.box([0.87, 0.1, 0.24], [x, y + 0.01, z + 0.1], "light");
  p.box([0.81, 0.065, 0.19], [x, y - 0.075, z + 0.06], "stone");
  for (const side of [-1, 1]) {
    p.box([0.06, 0.81, 0.04], [x + side * 0.305, y + 0.51, z + 0.1], "wood");
    p.box([0.16, 0.025, 0.02], [x + side * 0.14, y + 0.73, z + 0.095], "light", [0, 0, 0.5]);
  }
  if (shutters) for (const side of [-1, 1]) {
    p.box([0.28, 1.03, 0.09], [x + side * 0.49, y + 0.54, z + 0.05], "teal");
    for (const dy of [0.22, 0.8]) p.box([0.29, 0.07, 0.04], [x + side * 0.49, y + dy, z + 0.12], "tealDark");
    for (const dx of [-0.075, 0.025, 0.1]) p.box([0.014, 0.95, 0.025], [x + side * 0.49 + dx, y + 0.54, z + 0.105], "tealDark");
    p.beam([x + side * 0.6, y + 0.25, z + 0.13], [x + side * 0.39, y + 0.79, z + 0.13], 0.035, "tealDark");
    for (const dy of [0.22, 0.8]) p.sphere(0.025, [x + side * 0.42, y + dy, z + 0.15], "ink");
  }
}

function crate(p: BuildingParts, [x, y, z]: XYZ, size = 0.62) {
  p.box([size, size, size], [x, y + size / 2, z], "wood");
  for (const dy of [0.08, size - 0.08]) p.box([size + 0.03, 0.09, 0.055], [x, y + dy, z + size / 2 + 0.01], "woodLight");
  for (const dx of [-size / 2 + 0.07, size / 2 - 0.07]) p.box([0.09, size, 0.055], [x + dx, y + size / 2, z + size / 2 + 0.01], "woodLight");
  p.beam([x - size * 0.34, y + 0.12, z + size / 2 + 0.05], [x + size * 0.34, y + size - 0.12, z + size / 2 + 0.05], 0.065, "woodLight");
  for (let row = 1; row < 4; row++) {
    p.box([size - 0.07, 0.018, 0.025], [x, y + row * size / 4, z + size / 2 + 0.012], "ink");
    for (const side of [-1, 1]) p.box([0.025, 0.018, size - 0.06], [x + side * (size / 2 + 0.012), y + row * size / 4, z], "ink");
    p.box([0.018, 0.02, size - 0.07], [x - size / 2 + row * size / 4, y + size + 0.012, z], "woodLight");
  }
  for (const dx of [-size * 0.39, size * 0.39]) for (const dy of [0.08, size - 0.08]) p.sphere(0.021, [x + dx, y + dy, z + size / 2 + 0.045], "ink");
  p.box([size * 0.3, 0.045, 0.025], [x, y + size * 0.85, z + size / 2 + 0.025], "ink");
}

function barrel(p: BuildingParts, x: number, z: number, y = 0) {
  p.cylinder(0.33, 0.75, [x, y + 0.375, z], "wood", [0, 0, 0], 0.29);
  p.cylinder(0.31, 0.05, [x, y + 0.76, z], "woodLight");
  for (const dy of [0.16, 0.59]) p.torus(0.32, 0.035, [x, y + dy, z], "ink", [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    p.beam([x + Math.cos(a) * 0.325, y + 0.08, z + Math.sin(a) * 0.325], [x + Math.cos(a) * 0.29, y + 0.71, z + Math.sin(a) * 0.29], 0.015, "ink");
  }
  for (const dx of [-0.12, 0.08]) p.box([0.017, 0.012, 0.51], [x + dx, y + 0.792, z], "wood");
  p.cylinder(0.045, 0.017, [x + 0.12, y + 0.801, z - 0.07], "wood");
}

function woodGrain(p: BuildingParts, x: number, y: number, z: number, width: number, height: number) {
  for (let i = 0; i < 3; i++) p.beam([x - width * 0.36 + i * width * 0.31, y - height * 0.34, z], [x - width * 0.3 + i * width * 0.31, y + height * (0.2 + i % 2 * 0.2), z], 0.012, "woodLight");
  p.torus(width * 0.13, 0.009, [x + width * 0.04, y, z], "woodLight");
}

function leafEmblem(p: BuildingParts, x: number, y: number, z: number, scale = 1) {
  p.beam([x, y - 0.13 * scale, z], [x, y + 0.12 * scale, z], 0.018 * scale, "green");
  for (const angle of [-1.05, -0.55, 0, 0.55, 1.05]) {
    const leaf = new THREE.SphereGeometry(0.09 * scale, 6, 4);
    leaf.scale(0.35, 1.5, 0.17); leaf.rotateZ(-angle);
    p.add(leaf, "green", [x + Math.sin(angle) * 0.08 * scale, y + Math.cos(angle) * 0.08 * scale, z]);
  }
}

function flowerBox(p: BuildingParts, x: number, y: number, z: number, width = 0.9) {
  p.box([width, 0.21, 0.32], [x, y, z], "wood");
  for (const dy of [-0.09, 0.08]) p.box([width + 0.04, 0.04, 0.36], [x, y + dy, z], "woodLight");
  p.box([width - 0.08, 0.025, 0.25], [x, y + 0.11, z], "ink");
  for (let i = 0; i < 5; i++) {
    const px = x - width * 0.36 + i * width * 0.18, py = y + 0.23 + i % 2 * 0.06;
    p.sphere(0.11, [px, y + 0.16, z], "green", [1.2, 0.8, 1]);
    p.sphere(0.055, [px, py, z + 0.035], i % 2 ? "gold" : "light");
    for (let petal = 0; petal < 5; petal++) {
      const a = petal * Math.PI * 2 / 5;
      p.sphere(0.049, [px + Math.cos(a) * 0.061, py + Math.sin(a) * 0.061, z + 0.037], i % 2 ? "light" : "gold", [1, 1, 0.5]);
    }
  }
  for (const dx of [-width * 0.32, width * 0.32]) p.box([0.05, 0.33, 0.39], [x + dx, y - 0.02, z - 0.015], "ink");
}

function wallLantern(p: BuildingParts, x: number, y: number, z: number) {
  p.box([0.11, 0.26, 0.055], [x, y + 0.3, z], "ink");
  p.beam([x, y + 0.38, z], [x, y + 0.46, z + 0.3], 0.045, "ink");
  activityLantern(p, x, y, z + 0.3);
  p.add(new THREE.ConeGeometry(0.25, 0.16, 4), "ink", [x, y + 0.3, z + 0.3], [0, Math.PI / 4, 0]);
}

function cottageDetails(p: BuildingParts, width: number, depth: number, height: number, rise: number) {
  for (const side of [-1, 1]) {
    p.facing([side * (width / 2 + 0.015), 0, 0], side * Math.PI / 2, face => {
      window(face, 0, 0.97, 0);
      flowerBox(face, 0, 0.87, 0.19);
      wallLantern(face, -depth * 0.33, 1.83, 0.035);
    });
    const x = side * (width / 2 + 0.16), z = -depth / 2 + 0.2;
    p.cylinder(0.055, height - 0.16, [x, height / 2 + 0.1, z], "slate");
    for (const y of [0.5, height - 0.25]) p.torus(0.064, 0.018, [x, y, z], "ink", [Math.PI / 2, 0, 0]);
    p.beam([x, 0.2, z], [x + side * 0.22, 0.15, z + 0.13], 0.095, "slate");
  }
  p.facing([0, 0, -depth / 2 - 0.025], Math.PI, face => {
    window(face, -0.82, 0.92, 0); window(face, 0.82, 0.92, 0);
    p.box([width - 0.3, 0.13, 0.1], [0, height + 0.01, -depth / 2 - 0.06], "wood");
  });
  for (const side of [-1, 1]) {
    p.beam([0, height + rise - 0.14, side * (depth / 2 + 0.04)], [0, height + 0.24, side * (depth / 2 + 0.04)], 0.11, "wood");
    for (const direction of [-1, 1]) p.beam([direction * width * 0.31, height + 0.14, side * (depth / 2 + 0.04)], [0, height + rise - 0.2, side * (depth / 2 + 0.04)], 0.085, "wood");
  }
}

function book(p: BuildingParts, x: number, y: number, z: number, width: number, height: number, paint: Paint, lean = 0) {
  p.box([width, height, 0.29], [x, y + height / 2, z], paint, [0, 0, lean]);
  p.box([width - 0.025, height - 0.04, 0.26], [x, y + height / 2, z - 0.022], "paper", [0, 0, lean]);
  p.box([width, height, 0.045], [x, y + height / 2, z + 0.15], paint, [0, 0, lean]);
  for (const dy of [0.09, height - 0.09]) p.box([width * 0.79, 0.023, 0.015], [x, y + dy, z + 0.18], "gold", [0, 0, lean]);
  p.box([width * 0.56, height * 0.25, 0.018], [x, y + height * 0.55, z + 0.18], "paper", [0, 0, lean]);
}

function plantPot(p: BuildingParts, x: number, y: number, z: number, scale = 1) {
  p.cylinder(0.15 * scale, 0.3 * scale, [x, y + 0.15 * scale, z], "wood", [0, 0, 0], 0.2 * scale);
  p.cylinder(0.215 * scale, 0.07 * scale, [x, y + 0.3 * scale, z], "woodLight");
  p.beam([x, y + 0.3 * scale, z], [x, y + 0.78 * scale, z], 0.035 * scale, "green");
  for (const side of [-1, 1]) {
    const leaf = new THREE.SphereGeometry(0.14 * scale, 7, 5);
    leaf.scale(0.6, 1.7, 0.3); leaf.rotateZ(side * 0.7);
    p.add(leaf, "green", [x + side * 0.1 * scale, y + 0.58 * scale, z]);
  }
}

function canopy(p: BuildingParts, width: number, y: number, z: number, stripe: Paint, strips = 7, length = 1.2) {
  const unit = width / strips, frontY = y - Math.sin(0.24) * length / 2;
  for (let i = 0; i < strips; i++) {
    const x = -width / 2 + unit * (i + 0.5), paint = i % 2 === 0 ? stripe : "paper";
    for (let fold = 0; fold < 4; fold++) {
      const along = (fold + 0.5) / 4 - 0.5, belly = Math.sin((fold + 0.5) / 4 * Math.PI) * 0.07;
      p.box([unit + 0.012, 0.06, length / 4 + 0.025], [x, y - Math.sin(0.24) * length * along + belly, z + Math.cos(0.24) * length * along], paint, [0.24 - Math.cos((fold + 0.5) / 4 * Math.PI) * 0.14, 0, 0], 0.96 + fold % 2 * 0.04);
      p.box([0.012, 0.013, length / 4 + 0.022], [x - unit / 2 + 0.018, y - Math.sin(0.24) * length * along + belly + 0.037, z + Math.cos(0.24) * length * along], i % 2 ? "stone" : "light", [0.24 - Math.cos((fold + 0.5) / 4 * Math.PI) * 0.14, 0, 0]);
    }
    const scallop = new THREE.Shape();
    scallop.moveTo(-unit / 2, 0.09); scallop.lineTo(unit / 2, 0.09);
    scallop.lineTo(unit / 2, -0.11); scallop.quadraticCurveTo(0, -0.4, -unit / 2, -0.11); scallop.closePath();
    p.shape(scallop, 0.055, [x, frontY, z + Math.cos(0.24) * length / 2], paint, 0.008);
    p.sphere(0.023, [x, frontY - 0.22, z + Math.cos(0.24) * length / 2 + 0.064], i % 2 ? "stone" : "light", [1, 1, 0.4]);
  }
  p.box([width + 0.1, 0.12, 0.12], [0, y + Math.sin(0.24) * length / 2, z - Math.cos(0.24) * length / 2], "ink");
  for (const side of [-1, 1]) p.sphere(0.09, [side * (width / 2 + 0.08), y + Math.sin(0.24) * length / 2, z - Math.cos(0.24) * length / 2], "gold");
}

function activityJar(p: BuildingParts, x: number, y: number, z: number) {
  p.cylinder(0.23, 0.46, [x, y + 0.23, z], "glass");
  p.cylinder(0.235, 0.055, [x, y + 0.48, z], "paper");
  p.torus(0.22, 0.025, [x, y + 0.05, z], "light", [Math.PI / 2, 0, 0]);
  for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
    p.sphere(0.075, [x + side * 0.086, y + 0.1 + row * 0.12, z + 0.18], "green", [1, 1.1, 0.7]);
  }
}

function activityLantern(p: BuildingParts, x: number, y: number, z: number) {
  p.beam([x, y + 0.27, z], [x, y + 0.49, z], 0.035, "ink");
  p.torus(0.075, 0.022, [x, y + 0.3, z], "ink");
  p.sphere(0.2, [x, y, z], "gold", [0.8, 1.1, 0.8]);
  for (const dy of [-0.21, 0.21]) p.cylinder(0.2, 0.07, [x, y + dy, z], "ink");
  for (const dx of [-0.13, 0.13]) for (const dz of [-0.1, 0.1]) {
    p.beam([x + dx, y - 0.21, z + dz], [x + dx, y + 0.21, z + dz], 0.025, "wood");
  }
}

/** Geometry follows the three existing activity vignettes; the caller owns visibility. */
function cultureActivity(p: BuildingParts) {
  p.group("activity-culture", [0, 0, 0], active => {
    active.shape(arch(2.49, 2.43), 0.09, [0.1, 0.22, 1.57], "ink");
    active.shape(arch(2.3, 2.32), 0.095, [0.1, 0.24, 1.64], "ink");
    active.box([2.57, 0.17, 0.44], [0.1, 0.16, 1.82], "light");
    for (const side of [-1, 1]) {
      const leaf = active.group(`culture-door-${side < 0 ? "left" : "right"}`, [0.1 + side * 1.15, 0.24, 1.64], panel => {
        const shape = new THREE.Shape();
        if (side < 0) {
          shape.moveTo(-1.15, 0); shape.lineTo(0, 0); shape.lineTo(0, 2.32);
          shape.absarc(0, 1.17, 1.15, Math.PI / 2, Math.PI, false);
        } else {
          shape.moveTo(0, 0); shape.lineTo(1.15, 0); shape.lineTo(1.15, 1.17);
          shape.absarc(0, 1.17, 1.15, 0, Math.PI / 2, false);
        }
        shape.closePath();
        panel.shape(shape, 0.095, [0.1, 0.24, 1.64], "teal");
        for (const dy of [0.7, 1.6]) panel.box([0.83, 0.11, 0.07], [0.1 + side * 0.66, dy, 1.77], "ink");
        panel.box([0.07, 0.25, 0.1], [0.1 + side * 0.12, 1.05, 1.8], "ink");
        for (const offset of [0.29, 0.57, 0.86]) {
          const top = 1.17 + Math.sqrt(1.15 ** 2 - offset ** 2);
          panel.box([0.018, top - 0.05, 0.018], [0.1 + side * offset, 0.24 + top / 2, 1.75], "tealDark");
        }
      });
      leaf.rotation.y = side * Math.PI * 0.56;
    }
    active.box([2.12, 0.12, 0.62], [0.1, 0.53, 1.99], "woodLight");
    for (const x of [-0.79, 0.99]) for (const z of [1.77, 2.2]) {
      active.box([0.1, 0.35, 0.1], [x, 0.3, z], "wood");
    }
    for (const x of [-0.64, 0.1, 0.84]) {
      active.cylinder(0.14, 0.28, [x, 0.73, 1.99], "wood", [0, 0, 0], 0.2);
      active.cylinder(0.215, 0.06, [x, 0.86, 1.99], "woodLight");
      active.beam([x, 0.87, 1.99], [x, 1.71, 1.99], 0.03, "green");
      for (const y of [1.08, 1.42]) for (const angle of [-1.15, -0.6, 0, 0.6, 1.15]) {
        const leaf = new THREE.SphereGeometry(0.12, 7, 5);
        leaf.scale(0.38, 1.85, 0.3); leaf.rotateZ(-angle);
        active.add(leaf, "green", [x + Math.sin(angle) * 0.14, y + Math.cos(angle) * 0.14, 1.99]);
      }
    }
    active.beam([0.1, 2.5, 1.89], [0.1, 2.29, 1.89], 0.035, "ink");
    active.cylinder(0.27, 0.2, [0.1, 2.23, 1.89], "gold", [0, 0, 0], 0.09);
    active.cylinder(0.2, 0.025, [0.1, 2.12, 1.89], "light");
  }, false);
}

function marketActivity(p: BuildingParts) {
  p.group("activity-market", [0, 0, 0], active => {
    crate(active, [2.67, 0.08, 0.79], 0.71);
    crate(active, [3.15, 0.08, 1.31], 0.62);
    activityJar(active, 2.67, 0.79, 0.79);
    active.box([0.39, 0.57, 0.18], [3.16, 0.99, 1.31], "paper", [0, 0, -0.05]);
    active.sphere(0.1, [3.16, 1, 1.41], "green", [0.7, 1.45, 0.3]);
    active.beam([3.13, 0.1, 0.27], [3.13, 2.37, 0.27], 0.065, "wood");
    active.sphere(0.075, [3.13, 2.43, 0.27], "woodLight");
    const flag = new THREE.Shape();
    flag.moveTo(0, 0); flag.lineTo(0.84, -0.19); flag.lineTo(0.64, -0.37);
    flag.lineTo(0.75, -0.61); flag.lineTo(0, -0.44); flag.closePath();
    active.shape(flag, 0.035, [3.17, 2.3, 0.27], "teal", 0.008);
  }, false);
}

function juryActivity(p: BuildingParts) {
  p.group("activity-jury", [0, 0, 0], active => {
    active.box([3.28, 0.13, 1.04], [0, 1.36, 0.79], "woodLight");
    for (const x of [-1.35, 1.35]) for (const z of [0.43, 1.16]) {
      active.box([0.12, 0.83, 0.12], [x, 0.91, z], "wood");
    }
    for (let stripe = 0; stripe < 7; stripe++) {
      const x = -1.41 + stripe * 0.47, paint = stripe % 2 === 0 ? "teal" : "paper";
      active.box([0.47, 0.04, 1.08], [x, 1.445, 0.79], paint);
      active.box([0.47, 0.61, 0.045], [x, 1.15, 1.34], paint);
    }
    for (const x of [-0.85, 0, 0.85]) {
      activityJar(active, x, 1.47, 0.86);
      active.cylinder(0.08, 0.035, [x + 0.34, 1.49, 1.09], "gold");
    }
    for (const x of [-1.7, 1.7]) activityLantern(active, x, 2.28, 0.67);
  }, false);
}

function warehouse(p: BuildingParts) {
  wall(p, 4.35, 3.1, 2.52, 1.42, true); roof(p, 4.85, 3.65, 2.65, 1.44, "slateGreen");
  // Breathing boards close the two gables of the barn over the limewashed masonry.
  for (const face of [-1, 1]) for (let col = -7; col <= 7; col++) {
    const x = col * 0.255;
    const topAt = (edge: number) => 4.015 - 1.42 * Math.abs(edge) / 2.175;
    const board = new THREE.Shape();
    board.moveTo(-0.116, 0); board.lineTo(0.116, 0);
    board.lineTo(0.116, topAt(x + 0.116) - 2.695); board.lineTo(-0.116, topAt(x - 0.116) - 2.695); board.closePath();
    p.shape(board, 0.037, [x, 2.695, face === 1 ? 1.558 : -1.594], col % 3 ? "wood" : "woodLight", 0.006);
  }
  cottageDetails(p, 4.35, 3.1, 2.52, 1.42);
  p.group("idle-culture", [0, 0, 0], idle => door(idle, 0.1, 1.57, 2.3, 2.32, "teal", true));
  cultureActivity(p);
  p.box([2.65, 0.26, 0.16], [0.1, 2.78, 1.72], "woodLight", [0, 0, -0.035]);
  p.box([1.1, 1.67, 2.1], [-2.64, 0.9, -0.1], "wood");
  for (let i = 0; i < 6; i++) p.box([0.162, 1.6, 0.04], [-3.08 + i * 0.178, 0.9, 0.958], i % 3 ? "wood" : "woodLight", [0, 0, 0], 0.88 + i % 4 * 0.04);
  p.box([1.5, 0.14, 2.5], [-2.72, 1.96, -0.1], "slate", [0, 0, 0.25]);
  for (let row = 0; row < 4; row++) for (let column = 0; column < 7; column++) {
    p.box([0.4, 0.055, 0.34], [-3.29 + row * 0.37, 1.96 + (-0.57 + row * 0.37) * Math.sin(0.25) + 0.09, -1.15 + column * 0.35], column % 4 ? "slate" : "tile", [0, 0, 0.25], 0.88 + (row + column) % 4 * 0.05);
  }
  for (let plank = 0; plank < 7; plank++) {
    const z = -1 + plank * 0.29;
    p.box([0.035, 1.6, 0.018], [-3.205, 0.91, z], "ink");
    p.box([0.04, 0.08, 0.26], [-3.22, 0.44, z], "woodLight");
  }
  p.box([1.08, 0.12, 0.1], [-2.65, 0.4, 1.01], "woodLight");
  p.beam([-3.05, 0.46, 1.04], [-2.25, 1.58, 1.04], 0.08, "woodLight");
  woodGrain(p, -2.7, 0.97, 1.03, 0.5, 0.9);
  p.box([0.19, 0.7, 0.19], [0.8, 4.02, -0.55], "slate");
  p.add(new THREE.ConeGeometry(0.34, 0.35, 4), "ink", [0.8, 4.5, -0.55], [0, Math.PI / 4, 0]);
  crate(p, [-2.05, 0, 1.97], 0.65); crate(p, [-2.65, 0, 2.45], 0.52);
  barrel(p, 2.08, 1.96);
  p.box([0.7, 0.47, 0.12], [1.64, 2.84, 1.72], "wood", [0, 0, -0.13]);
  for (const x of [1.36, 1.88]) for (const y of [2.7, 2.95]) p.sphere(0.027, [x, y, 1.8], "ink");
  woodGrain(p, 1.63, 2.84, 1.8, 0.65, 0.38);
  // Hinged rooflight, ventilation louvres and the salvaged cart wheel from the painting.
  p.box([0.73, 0.13, 0.87], [-1.21, 3.46, -0.53], "ink", [0, 0, 0.536]);
  p.box([0.59, 0.15, 0.71], [-1.21, 3.53, -0.53], "glass", [0, 0, 0.536]);
  p.box([0.65, 0.06, 0.04], [-1.21, 3.62, -0.53], "light", [0, 0, 0.536]);
  for (const z of [-0.76, -0.3]) p.box([0.16, 0.055, 0.055], [-1.48, 3.42, z], "ink", [0, 0, 0.536]);
  p.box([0.65, 0.43, 0.08], [0.12, 3.37, 1.59], "ink");
  for (let i = 0; i < 4; i++) p.box([0.57, 0.06, 0.09], [0.12, 3.22 + i * 0.1, 1.65], "tealDark", [0.16, 0, 0]);
  p.torus(0.5, 0.105, [-3.02, 0.59, 1.27], "ink", [0, 0.18, 0]);
  p.torus(0.39, 0.045, [-3.02, 0.59, 1.3], "woodLight", [0, 0.18, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    p.beam([-3.02, 0.59, 1.32], [-3.02 + Math.cos(a) * 0.38, 0.59 + Math.sin(a) * 0.38, 1.32], 0.045, "wood");
  }
  p.cylinder(0.095, 0.16, [-3.02, 0.59, 1.34], "ink", [Math.PI / 2, 0, 0]);
  for (const x of [1.65, 1.87]) {
    p.beam([x, 0.2, 1.62], [x - 0.13, 1.92, 1.59], 0.045, "woodLight");
    p.box([0.13, 0.24, 0.055], [x, 0.24, 1.64], "slate");
  }
  wallLantern(p, -1.63, 2.13, 1.62);
  p.box([0.67, 0.08, 0.65], [2.08, 0.87, 1.96], "woodLight");
  plantPot(p, 2.08, 0.92, 1.96, 0.8);
  for (const x of [-2.55, -2.29]) p.sphere(0.17, [x, 0.18, 2.93], "cream", [0.9, 1.1, 0.8]);
}

function bank(p: BuildingParts) {
  wall(p, 3.65, 2.9, 2.45, 1.24); roof(p, 4.15, 3.4, 2.57, 1.27);
  cottageDetails(p, 3.65, 2.9, 2.45, 1.24);
  chimney(p, -0.9, 3.74, -0.6);
  p.cylinder(1.07, 0.18, [0.53, 1.29, 1.56], "ink", [Math.PI / 2, 0, 0]);
  p.cylinder(0.94, 0.2, [0.53, 1.29, 1.69], "slate", [Math.PI / 2, 0, 0]);
  p.torus(0.84, 0.045, [0.53, 1.29, 1.82], "tile");
  p.torus(0.29, 0.06, [0.53, 1.29, 1.9], "gold");
  p.cylinder(0.105, 0.12, [0.53, 1.29, 1.95], "gold", [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    p.beam([0.53, 1.29, 1.92], [0.53 + Math.cos(a) * 0.27, 1.29 + Math.sin(a) * 0.27, 1.92], 0.047, "gold");
  }
  for (const y of [0.72, 1.87]) p.box([0.32, 0.16, 0.17], [1.45, y, 1.85], "ink");
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    p.cylinder(0.039, 0.038, [0.53 + Math.cos(a) * 0.95, 1.29 + Math.sin(a) * 0.95, 1.825], "gold", [Math.PI / 2, 0, 0]);
    p.box([0.02, 0.09, 0.025], [0.53 + Math.cos(a) * 0.68, 1.29 + Math.sin(a) * 0.68, 1.825], "tile", [0, 0, a - Math.PI / 2]);
  }
  for (const y of [0.72, 1.87]) {
    p.cylinder(0.095, 0.3, [1.44, y, 1.91], "tile");
    p.cylinder(0.11, 0.035, [1.44, y + 0.16, 1.91], "gold");
  }
  p.box([0.26, 0.15, 0.065], [0.94, 0.99, 1.85], "ink");
  p.cylinder(0.035, 0.04, [0.94, 1.015, 1.9], "gold", [Math.PI / 2, 0, 0]);
  p.box([2.43, 0.12, 0.69], [0.5, 0.15, 1.75], "stone");
  p.box([2.6, 0.1, 0.45], [0.5, 0.055, 2.1], "light");
  window(p, -1.04, 0.99, 1.47, false);
  for (const x of [-1.21, -0.87]) p.box([0.035, 0.82, 0.035], [x, 1.54, 1.63], "ink");
  p.box([0.57, 0.035, 0.035], [-1.04, 1.51, 1.64], "ink");
  wallLantern(p, -1.6, 2.05, 1.5);
  p.beam([1.47, 3.1, 0.98], [2.7, 3.42, 0.98], 0.12, "ink");
  p.movable("bank-sign", [2.55, 3.39, 0.98], sign => {
    sign.beam([2.55, 3.39, 0.98], [2.55, 3.07, 0.98], 0.055, "ink");
    sign.cylinder(0.48, 0.12, [2.55, 2.75, 0.98], "gold", [Math.PI / 2, 0, 0]);
    sign.torus(0.39, 0.04, [2.55, 2.75, 1.06], "wood");
    sign.box([0.06, 0.44, 0.04], [2.55, 2.75, 1.08], "cream");
    sign.box([0.26, 0.06, 0.04], [2.55, 2.92, 1.08], "cream");
    sign.box([0.26, 0.06, 0.04], [2.55, 2.58, 1.08], "cream");
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      sign.box([0.02, 0.035, 0.02], [2.55 + Math.cos(a) * 0.425, 2.75 + Math.sin(a) * 0.425, 1.055], "light", [0, 0, a]);
    }
    sign.torus(0.07, 0.018, [2.55, 3.12, 0.98], "gold");
  });
  p.beam([1.52, 2.79, 0.98], [2.18, 3.28, 0.98], 0.07, "ink");
}

function office(p: BuildingParts) {
  wall(p, 4.15, 3.05, 2.55, 1.35); roof(p, 4.65, 3.55, 2.68, 1.37);
  cottageDetails(p, 4.15, 3.05, 2.55, 1.35);
  door(p, 0, 1.56, 0.85, 1.86);
  window(p, -1.18, 1.03, 1.56); window(p, 1.19, 1.03, 1.56);
  p.cylinder(0.16, 0.05, [0, 3.08, 1.59], "ink", [Math.PI / 2, 0, 0]);
  p.torus(0.21, 0.055, [0, 3.08, 1.61], "light");
  p.box([0.035, 0.27, 0.025], [0, 3.08, 1.65], "wood");
  p.box([0.27, 0.035, 0.025], [0, 3.08, 1.65], "wood");
  // Paper registers visible in the office window, as in the source painting.
  for (let i = 0; i < 4; i++) {
    const x = 1.05 + i * 0.085, y = 1.55 + i % 2 * 0.08;
    p.box([0.37, 0.56, 0.025], [x, y, 1.7 + i * 0.025], i % 2 ? "paper" : "cream", [0, 0, i % 2 ? -0.04 : 0.06]);
    for (let line = 0; line < 5; line++) p.box([0.24 - line % 2 * 0.05, 0.014, 0.012], [x, y + 0.14 - line * 0.07, 1.724 + i * 0.025], "stone");
  }
  flowerBox(p, -1.18, 0.89, 1.72, 0.97);
  wallLantern(p, 0.61, 2.16, 1.6);
  p.box([1.17, 0.13, 0.53], [0, 0.06, 2.08], "stone");
  p.box([0.64, 0.58, 0.07], [-1.58, 0.69, 1.57], "wood");
  p.box([0.53, 0.45, 0.03], [-1.58, 0.69, 1.62], "tealDark");
  for (let row = 0; row < 3; row++) p.box([0.32 - row * 0.04, 0.025, 0.02], [-1.58, 0.8 - row * 0.1, 1.65], "cream");
  chimney(p, -1.27, 3.58, -0.65);
  p.anchor("anchor-smoke", [-1.23, 4.42, -0.65]);
  p.beam([2.08, 2.3, 0.9], [2.4, 4.32, 0.9], 0.065, "wood");
  p.sphere(0.085, [2.4, 4.36, 0.9], "gold");
  p.movable("flag", [2.4, 4.1725, 0.9], flag => {
    for (let row = 0; row < 9; row++) for (let col = 0; col < 4; col++) {
      flag.box([0.25, 0.085, 0.025], [2.53 + col * 0.245, 4.13 - row * 0.084, 0.9 + Math.sin(col * 1.2) * 0.07], row % 2 === 0 ? "ink" : "white");
    }
    flag.box([0.4, 0.4, 0.04], [2.61, 3.97, 0.98], "white");
    for (const x of [2.51, 2.69]) for (const y of [3.85, 4.03]) {
      flag.sphere(0.022, [x, y, 1.01], "ink"); flag.box([0.045, 0.05, 0.025], [x, y - 0.034, 1.01], "ink");
    }
  });
}

function market(p: BuildingParts) {
  p.box([4.5, 0.16, 2.9], [0, 0.1, 0], "wood");
  for (const x of [-1.95, 1.95]) for (const z of [-0.96, 1.05]) p.box([0.15, 2.65, 0.15], [x, 1.41, z], "wood");
  p.box([4.07, 0.18, 0.18], [0, 2.92, -0.96], "woodLight");
  canopy(p, 4.4, 2.72, 0.2, "gold", 9, 2.6);
  p.box([4.05, 0.2, 1.13], [0, 1.02, 0.8], "woodLight");
  p.box([3.85, 0.75, 0.17], [0, 0.6, 1.27], "wood");
  for (let i = 0; i < 9; i++) p.box([0.025, 0.74, 0.03], [-1.7 + i * 0.42, 0.6, 1.37], "woodLight");
  for (const x of [-1.75, 1.75]) p.beam([x, 2.5, 1.05], [x + (x > 0 ? -0.55 : 0.55), 2.02, 1.05], 0.1, "woodLight");
  for (let i = 0; i < 3; i++) {
    const x = -1.49 + i * 0.48;
    p.cylinder(0.19, 0.52 + i % 2 * 0.15, [x, 1.37 + i % 2 * 0.075, 0.84], "glass");
    p.cylinder(0.21, 0.07, [x, 1.65 + i % 2 * 0.15, 0.84], "paper");
    p.sphere(0.105, [x, 1.29, 1.0], "green");
  }
  for (const x of [0.15, 0.7]) {
    p.box([0.4, 0.69, 0.27], [x, 1.47, 0.45], "cream");
    p.box([0.35, 0.055, 0.3], [x, 1.83, 0.45], "woodLight");
    plantPot(p, x, 1.13, 0.98, 0.58);
  }
  for (const x of [1.3, 1.62]) {
    p.cylinder(0.105, 0.33, [x, 1.29, 0.96], "tealDark");
    p.cylinder(0.045, 0.15, [x, 1.53, 0.96], "wood");
    p.box([0.14, 0.15, 0.03], [x, 1.3, 1.06], "paper");
  }
  crate(p, [-2.2, 0.17, 1.53], 0.62); crate(p, [-2.18, 0.17, 0.68], 0.55);
  p.box([0.62, 0.95, 0.1], [2.1, 0.68, 1.56], "woodLight", [-0.14, 0, -0.05]);
  p.box([0.49, 0.79, 0.05], [2.1, 0.7, 1.63], "slate", [-0.14, 0, -0.05]);
  // Cross-braced joinery, layered back shelves and floorboards fill the open stall.
  for (let board = 0; board < 12; board++) p.box([0.025, 0.018, 2.84], [-2.05 + board * 0.37, 0.19, 0], "woodLight");
  for (const x of [-1.95, 1.95]) {
    woodGrain(p, x, 1.4, 1.134, 0.14, 2.4);
    for (const y of [0.42, 2.46]) p.box([0.2, 0.11, 0.2], [x, y, 1.05], "ink");
    p.beam([x, 0.4, -0.94], [x, 1.17, -0.22], 0.1, "woodLight");
  }
  for (const y of [0.58, 1.13, 1.82]) {
    p.box([3.74, 0.1, 0.56], [0, y, -0.8], "woodLight");
    p.box([3.74, 0.18, 0.075], [0, y + 0.06, -1.05], "wood");
  }
  p.beam([-1.91, 0.3, -1.02], [1.91, 2.6, -1.02], 0.095, "wood");
  p.beam([1.91, 0.3, -1.04], [-1.91, 2.6, -1.04], 0.095, "wood");
  for (let i = 0; i < 7; i++) {
    const x = -1.5 + i * 0.49;
    p.cylinder(0.12, 0.29 + i % 2 * 0.12, [x, 1.32 + i % 2 * 0.06, -0.77], "glass");
    p.cylinder(0.125, 0.045, [x, 1.485 + i % 2 * 0.12, -0.77], "paper");
    p.box([0.13, 0.14, 0.018], [x, 1.31, -0.642], "cream");
    if (i % 2 === 0) leafEmblem(p, x, 1.32, -0.623, 0.43);
  }
  for (let i = 0; i < 5; i++) {
    const x = -1.42 + i * 0.68;
    p.box([0.36, 0.42 + i % 2 * 0.11, 0.24], [x, 2.1 + i % 2 * 0.055, -0.78], "cream", [0, 0, Math.sin(i) * 0.035]);
    p.box([0.4, 0.055, 0.27], [x, 2.31 + i % 2 * 0.11, -0.78], "woodLight");
    leafEmblem(p, x, 2.09, -0.64, 0.65);
  }
  for (let i = 0; i < 3; i++) {
    const x = -1.49 + i * 0.48;
    p.torus(0.17, 0.017, [x, 1.13, 0.84], "light", [Math.PI / 2, 0, 0]);
    for (let row = 0; row < 3; row++) for (const side of [-1, 1]) p.sphere(0.057, [x + side * 0.076, 1.2 + row * 0.12, 0.99], "green", [1, 1.3, 0.55]);
    p.box([0.022, 0.31, 0.018], [x - 0.11, 1.36, 0.996], "light");
  }
  for (const x of [0.15, 0.7]) leafEmblem(p, x, 1.48, 0.594, 1.03);
  for (const x of [1.3, 1.62]) leafEmblem(p, x, 1.3, 1.084, 0.38);
  // A little brass balance and sample bowls distinguish the merchant's counter.
  p.box([0.43, 0.055, 0.33], [0.42, 1.15, 0.99], "gold");
  p.cylinder(0.035, 0.57, [0.42, 1.45, 0.99], "ink");
  p.beam([0.09, 1.75, 0.99], [0.75, 1.75, 0.99], 0.035, "gold");
  for (const side of [-1, 1]) {
    const x = 0.42 + side * 0.3;
    for (const dz of [-0.09, 0.09]) p.beam([x, 1.74, 0.99], [x, 1.48, 0.99 + dz], 0.012, "ink");
    p.cylinder(0.15, 0.055, [x, 1.47, 0.99], "gold", [0, 0, 0], 0.18);
  }
  for (let line = 0; line < 3; line++) p.box([0.29 - line % 2 * 0.07, 0.024, 0.018], [2.1, 0.9 - line * 0.14, 1.68 + line * 0.017], "paper");
  p.beam([1.8, 0.19, 1.53], [1.8, 1.1, 1.58], 0.065, "wood");
  p.beam([2.36, 0.19, 1.53], [2.36, 1.1, 1.58], 0.065, "wood");
  for (const x of [-1.76, 1.76]) activityLantern(p, x, 2.18, -0.57);
  for (const x of [-2.2, -2.07]) for (const z of [1.4, 1.64]) p.sphere(0.13, [x, 0.85, z], "green", [1, 0.8, 1]);
  marketActivity(p);
}

function playingCard(p: BuildingParts, x: number, y: number, z: number, angle: number, paint: Paint) {
  p.box([0.37, 0.52, 0.055], [x, y, z], "wood", [0, 0, angle]);
  p.box([0.29, 0.43, 0.035], [x, y, z + 0.04], "paper", [0, 0, angle]);
  p.box([0.12, 0.17, 0.04], [x, y, z + 0.07], paint, [0, 0, angle + 0.35]);
  for (const side of [-1, 1]) p.sphere(0.025, [x + side * 0.085, y + side * 0.15, z + 0.069], paint, [0.8, 1, 0.3]);
  for (const side of [-1, 1]) p.box([0.19, 0.012, 0.012], [x, y + side * 0.17, z + 0.063], "stone", [0, 0, angle]);
}

function stool(p: BuildingParts, x: number, z: number, height: number) {
  p.cylinder(0.28, 0.12, [x, height, z], "woodLight");
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    p.beam([x + Math.cos(a) * 0.15, height - 0.06, z + Math.sin(a) * 0.15], [x + Math.cos(a) * 0.23, 0.12, z + Math.sin(a) * 0.23], 0.07, "wood");
    const b = a + Math.PI * 2 / 3;
    p.beam([x + Math.cos(a) * 0.2, height * 0.4, z + Math.sin(a) * 0.2], [x + Math.cos(b) * 0.2, height * 0.4, z + Math.sin(b) * 0.2], 0.04, "woodLight");
  }
  for (const dx of [-0.08, 0.08]) p.box([0.015, 0.012, 0.46], [x + dx, height + 0.065, z], "wood");
}

function shop(p: BuildingParts) {
  wall(p, 3.95, 2.95, 2.6, 1.22); roof(p, 4.45, 3.45, 2.73, 1.26, "slateGreen");
  cottageDetails(p, 3.95, 2.95, 2.6, 1.22);
  chimney(p, -0.98, 3.68, -0.58); door(p, -1.0, 1.51, 0.82, 1.88);
  p.anchor("anchor-smoke", [-0.94, 4.52, -0.58]);
  p.box([1.68, 1.24, 0.12], [0.59, 1.3, 1.57], "ink");
  p.box([1.51, 1.07, 0.07], [0.59, 1.3, 1.65], "glass");
  // The painted open collector's album and sealed packs occupy the shop window.
  for (const side of [-1, 1]) {
    const x = 0.29 + side * 0.29;
    p.box([0.58, 0.89, 0.085], [x, 1.3, 1.73], "woodLight", [0, side * -0.12, side * 0.06]);
    p.box([0.51, 0.79, 0.04], [x, 1.31, 1.79], "paper", [0, side * -0.12, side * 0.06]);
    for (const y of [1.1, 1.49]) playingCard(p, x, y, 1.85, side * 0.06, y < 1.3 ? "gold" : "teal");
  }
  p.box([0.045, 0.9, 0.06], [0.29, 1.3, 1.79], "wood");
  for (const [x, paint] of [[1.11, "teal"], [1.43, "red"]] as const) {
    p.box([0.27, 0.73, 0.075], [x, 1.29, 1.8], paint, [0, 0, -0.08]);
    p.box([0.22, 0.59, 0.025], [x, 1.29, 1.85], "gold", [0, 0, -0.08]);
    p.box([0.18, 0.53, 0.025], [x, 1.29, 1.874], paint, [0, 0, -0.08]);
    p.box([0.1, 0.14, 0.025], [x, 1.29, 1.9], "paper", [0, 0, 0.65]);
    for (const y of [0.96, 1.62]) for (let i = 0; i < 5; i++) p.box([0.015, 0.055, 0.025], [x - 0.09 + i * 0.045, y, 1.85], "light");
  }
  p.box([1.61, 0.055, 0.08], [0.59, 1.91, 1.72], "woodLight");
  for (const x of [-0.25, 1.43]) p.box([0.08, 1.18, 0.12], [x, 1.3, 1.7], "wood");
  p.box([1.84, 0.12, 0.27], [0.58, 0.65, 1.68], "woodLight");
  canopy(p, 3.83, 2.59, 1.83, "teal");
  p.beam([1.7, 2.93, 0.57], [2.66, 3.04, 0.57], 0.1, "ink");
  p.movable("shop-sign", [2.49, 3.02, 0.57], sign => {
    sign.beam([2.49, 3.02, 0.57], [2.49, 2.69, 0.57], 0.035, "ink");
    sign.box([0.77, 0.65, 0.12], [2.49, 2.4, 0.57], "woodLight", [0, 0, 0.06]);
    playingCard(sign, 2.39, 2.41, 0.67, -0.16, "teal"); playingCard(sign, 2.59, 2.4, 0.71, 0.15, "gold");
    for (const dx of [-0.31, 0.31]) for (const dy of [-0.23, 0.23]) sign.sphere(0.024, [2.49 + dx, 2.4 + dy, 0.655], "ink");
    sign.torus(0.055, 0.015, [2.49, 2.74, 0.57], "gold");
  });
  barrel(p, -1.98, 1.8); plantPot(p, -1.98, 0.79, 1.8, 0.85); stool(p, 1.75, 2.11, 0.65);
  wallLantern(p, -1.61, 2.16, 1.54);
  p.beam([1.72, 2.65, 0.57], [2.22, 2.99, 0.57], 0.065, "ink");
  p.facing([2.02, 0, -0.75], Math.PI / 2, face => {
    face.box([0.61, 1.05, 0.41], [0, 0.69, 0.14], "wood");
    for (const y of [0.2, 0.64, 1.18]) face.box([0.67, 0.055, 0.48], [0, y, 0.15], "woodLight");
    for (let i = 0; i < 4; i++) book(face, -0.2 + i * 0.13, 0.67, 0.13, 0.11, 0.37 + i % 2 * 0.06, i % 2 ? "teal" : "red");
    for (let i = 0; i < 3; i++) book(face, -0.2 + i * 0.18, 0.24, 0.13, 0.15, 0.3 + i % 2 * 0.04, i % 2 ? "gold" : "tealDark");
  });
}

function arena(p: BuildingParts) {
  p.box([4.72, 0.27, 3.1], [0, 0.33, 0], "wood");
  for (let i = 0; i < 9; i++) p.box([0.025, 0.025, 3.06], [-2.1 + i * 0.53, 0.478, 0], "woodLight");
  for (let i = 0; i < 10; i++) for (const z of [-1.32, 1.31]) p.sphere(0.025, [-2.14 + i * 0.47, 0.476, z], "ink", [1, 0.35, 1]);
  for (const x of [-2.08, 2.08]) for (const z of [-1.2, 1.22]) {
    p.box([0.21, 2.7, 0.21], [x, 1.78, z], "wood");
    p.box([0.35, 0.14, 0.35], [x, 0.51, z], "woodLight");
    p.box([0.29, 0.16, 0.29], [x, 2.85, z], "woodLight");
    woodGrain(p, x, 1.6, z + 0.115, 0.19, 1.8);
    for (const y of [0.77, 2.62]) p.box([0.23, 0.075, 0.23], [x, y, z], "ink");
  }
  p.box([4.28, 2.05, 0.16], [0, 1.52, -1.19], "tealDark");
  for (let i = 0; i < 13; i++) p.box([0.021, 2, 0.025], [-1.99 + i * 0.33, 1.52, -1.09], "ink");
  for (const y of [0.66, 2.26]) p.box([4.2, 0.11, 0.1], [0, y, -1.06], "wood");
  // Carved leaf medallion and books on the rear judging bench.
  p.cylinder(0.49, 0.08, [0, 1.72, -1.04], "woodLight", [Math.PI / 2, 0, 0]);
  p.cylinder(0.4, 0.05, [0, 1.72, -0.98], "cream", [Math.PI / 2, 0, 0]);
  p.torus(0.42, 0.028, [0, 1.72, -0.94], "gold");
  leafEmblem(p, 0, 1.71, -0.94, 1.8);
  p.box([3.43, 0.12, 0.48], [0, 0.84, -0.76], "woodLight");
  for (const x of [-1.48, 1.48]) p.box([0.1, 0.38, 0.1], [x, 0.62, -0.76], "wood");
  for (let i = 0; i < 3; i++) book(p, -1.45 + i * 0.17, 0.91, -0.77, 0.14, 0.39 + i % 2 * 0.08, i % 2 ? "red" : "teal");
  for (const x of [-2.08, 2.08]) {
    p.beam([x, 2.88, 1.22], [x - Math.sign(x) * 0.64, 2.28, 1.22], 0.15, "woodLight");
    p.box([0.14, 0.5, 2.3], [x, 0.97, -0.1], "wood");
    p.box([0.24, 0.11, 2.4], [x, 1.26, -0.1], "woodLight");
    for (let i = 0; i < 6; i++) p.box([0.105, 0.56, 0.075], [x, 0.95, -1 + i * 0.37], "woodLight");
  }
  p.box([4.37, 0.22, 0.23], [0, 2.94, 1.22], "woodLight"); roof(p, 5.05, 3.58, 3.05, 1.05, "slateGreen");
  for (let i = 0; i < 3; i++) stool(p, -1.15 + i * 1.15, 0.47, 1.1);
  p.box([1.88, 0.16, 0.48], [0, 0.12, 1.94], "woodLight");
  p.box([1.88, 0.18, 0.43], [0, 0.27, 1.66], "woodLight");
  for (const z of [1.7, 1.95]) p.box([1.8, 0.018, 0.023], [0, z === 1.7 ? 0.367 : 0.207, z], "wood");
  for (const x of [-1.92, 1.92]) p.box([0.15, 0.53, 0.15], [x, 0.31, 1.53], "wood");
  p.cylinder(0.21, 0.52, [0, 3.1, 1.59], "gold", [0, 0, 0], 0.41);
  p.cylinder(0.34, 0.035, [0, 3.37, 1.59], "wood");
  p.torus(0.4, 0.045, [0, 3.38, 1.59], "gold", [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) p.torus(0.2, 0.045, [side * 0.39, 3.12, 1.59], "gold");
  p.cylinder(0.085, 0.21, [0, 2.75, 1.59], "gold");
  p.box([0.52, 0.11, 0.38], [0, 2.61, 1.59], "gold");
  for (let i = 0; i < 7; i++) {
    const x = -1.55 + i * 0.52, y = 2.61 - 0.22 * (1 - (x / 1.65) ** 2);
    if (i > 0) {
      const px = x - 0.52, py = 2.61 - 0.22 * (1 - (px / 1.65) ** 2);
      p.beam([px, py, 1.53], [x, y, 1.53], 0.025, "ink");
    }
    const triangle = new THREE.Shape(); triangle.moveTo(-0.17, 0); triangle.lineTo(0.17, 0); triangle.lineTo(0, -0.32); triangle.closePath();
    p.shape(triangle, 0.025, [x, y, 1.55], i % 2 === 0 ? "paper" : "teal", 0);
  }
  for (const x of [-2.1, 2.1]) {
    for (const y of [0.36, 1.14, 2.47, 2.84]) p.sphere(0.035, [x, y, 1.355], "ink");
    activityLantern(p, x, 2.09, -0.95);
  }
  for (let i = 0; i < 8; i++) p.box([0.47, 0.19, 0.04], [-1.87 + i * 0.53, 0.29, 1.58], "woodLight", [0, 0, 0], 0.83 + i % 3 * 0.06);
  juryActivity(p);
}

function missions(p: BuildingParts) {
  for (const x of [-0.94, 0.94]) {
    p.box([0.19, 2.66, 0.21], [x, 1.33, 0], "wood");
    p.box([0.3, 0.14, 0.32], [x, 0.12, 0], "stone");
    woodGrain(p, x, 1.36, 0.12, 0.18, 2.18);
    for (const y of [0.31, 0.77, 2.31]) {
      p.box([0.23, 0.09, 0.25], [x, y, 0], "ink");
      p.sphere(0.032, [x, y, 0.143], "gold");
    }
  }
  p.box([1.82, 1.69, 0.18], [0, 1.59, -0.04], "woodLight");
  p.box([1.63, 1.46, 0.045], [0, 1.6, 0.075], "wood");
  for (let i = 0; i < 6; i++) {
    p.box([0.018, 1.45, 0.017], [-0.67 + i * 0.27, 1.59, 0.104], "ink");
    woodGrain(p, -0.66 + i * 0.27, 1.58, -0.14, 0.23, 1.3);
  }
  p.beam([-0.84, 0.82, -0.16], [0.84, 2.32, -0.16], 0.11, "wood");
  for (const x of [-0.86, 0.86]) for (const y of [0.81, 2.34]) p.sphere(0.035, [x, y, 0.13], "ink");
  p.box([2.1, 0.13, 0.23], [0, 0.68, 0.04], "woodLight"); roof(p, 2.46, 0.96, 2.5, 0.48);
  const notes = [
    ["note-left", -0.52, 1.91, 0.43, 0.58, 0.1], ["notices", 0.03, 1.6, 0.58, 0.84, -0.03],
    ["note-right", 0.56, 1.99, 0.37, 0.51, -0.16], ["note-low", -0.56, 1.12, 0.36, 0.43, 0.06],
    ["note-corner", 0.55, 1.23, 0.38, 0.47, 0.15],
  ] as const;
  for (const [id, x, y, w, h, a] of notes) {
    p.movable(id, [x, y + h * 0.36, 0.178], note => {
      note.box([w + 0.035, h + 0.035, 0.025], [x, y, 0.12], "ink", [0, 0, a]);
      note.box([w, h, 0.03], [x, y, 0.145], "paper", [0, 0, a]);
      note.sphere(0.028, [x, y + h * 0.36, 0.178], "ink");
      for (let line = 0; line < 3; line++) note.box([w * 0.62, 0.013, 0.012], [x, y + 0.07 - line * 0.07, 0.168], "stone");
      note.box([w * 0.43, 0.027, 0.013], [x - w * 0.06, y + h * 0.27, 0.169], "wood");
      note.cylinder(0.04, 0.015, [x + w * 0.23, y - h * 0.28, 0.175], id === "notices" ? "red" : "gold", [Math.PI / 2, 0, 0]);
      const fold = new THREE.Shape(); fold.moveTo(0, 0); fold.lineTo(0.075, 0.075); fold.lineTo(0, 0.075); fold.closePath();
      note.shape(fold, 0.009, [x + w / 2 - 0.07, y - h / 2 + 0.02, 0.174], "cream", 0);
    });
  }
  p.box([0.31, 0.23, 0.23], [0.69, 0.88, 0.28], "wood");
  p.box([0.32, 0.045, 0.27], [0.69, 1, 0.28], "woodLight");
  for (let i = 0; i < 3; i++) {
    p.cylinder(0.036, 0.3, [0.62 + i * 0.07, 1.06, 0.29], "paper", [0, 0, (i - 1) * 0.16]);
    p.torus(0.034, 0.009, [0.62 + i * 0.07, 1.1, 0.29], "red", [Math.PI / 2, 0, 0]);
  }
  p.box([1.39, 0.12, 0.36], [-0.03, 0.11, 0.47], "stone");
}

function collection(p: BuildingParts) {
  wall(p, 4.35, 3.08, 2.6, 1.3); roof(p, 4.85, 3.58, 2.73, 1.32, "slateViolet");
  cottageDetails(p, 4.35, 3.08, 2.6, 1.3);
  p.box([2.86, 1.72, 0.16], [-0.32, 1.16, 1.59], "ink");
  p.box([2.73, 0.15, 0.9], [-0.32, 0.32, 1.86], "red");
  for (const side of [-1, 1]) {
    const x = -0.32 + side * 1.18;
    p.box([0.38, 1.54, 0.18], [x, 1.17, 1.77], "red");
    for (let fold = 0; fold < 3; fold++) p.cylinder(0.065, 1.5, [x - 0.13 + fold * 0.13, 1.17, 1.89], fold % 2 ? "wood" : "red");
    p.box([0.45, 0.09, 0.1], [x, 0.94, 1.96], "gold");
    for (const dx of [-0.115, 0.025, 0.14]) p.beam([x + dx * 0.5, 0.95, 1.99], [x + dx, 0.44, 1.97], 0.019, "wood");
    p.torus(0.045, 0.018, [x + side * 0.2, 0.94, 1.98], "gold");
    p.beam([x + side * 0.2, 0.94, 1.98], [x + side * 0.23, 0.69, 1.98], 0.027, "gold");
    p.sphere(0.055, [x + side * 0.23, 0.66, 1.98], "gold", [0.65, 1.4, 0.65]);
  }
  for (let i = 0; i < 4; i++) {
    const x = -1.2 + i * 0.59;
    p.box([0.45, 0.54, 0.37], [x, 0.66, 1.96], "woodLight");
    p.box([0.49, 0.08, 0.42], [x, 0.97, 1.96], "teal");
    p.box([0.29, 0.32, 0.035], [x, 0.67, 2.16], "gold");
    p.box([0.21, 0.24, 0.025], [x, 0.67, 2.19], "paper");
    p.sphere(0.085, [x, 1.05, 1.96], "red", [1, 0.55, 1]);
    p.cylinder(0.11, 0.025, [x, 1.01, 1.96], "ink");
    p.box([0.035, 0.48, 0.04], [x - 0.185, 0.67, 2.17], "wood");
    p.box([0.035, 0.48, 0.04], [x + 0.185, 0.67, 2.17], "wood");
    p.box([0.27, 0.025, 0.02], [x, 0.56, 2.21], "stone");
    for (const dx of [-0.16, 0.16]) p.sphere(0.018, [x + dx, 0.87, 2.18], "gold");
  }
  door(p, 1.6, 1.58, 0.7, 1.9, "wood");
  const plate = new THREE.Shape();
  plate.moveTo(-1.49, -0.27); plate.lineTo(1.49, -0.27); plate.quadraticCurveTo(1.7, 0, 1.49, 0.27);
  plate.lineTo(-1.49, 0.27); plate.quadraticCurveTo(-1.7, 0, -1.49, -0.27); plate.closePath();
  p.movable("library-sign", [-0.28, 2.63, 1.72], sign => {
    sign.shape(plate, 0.11, [-0.28, 2.33, 1.72], "gold", 0.035);
    for (const y of [2.125, 2.535]) sign.box([2.68, 0.022, 0.02], [-0.28, y, 1.86], "wood");
    for (const x of [-1.58, 1.02]) sign.sphere(0.032, [x, 2.33, 1.86], "ink", [1, 1, 0.4]);
    for (const x of [-1.27, 0.71]) {
      sign.torus(0.075, 0.025, [x, 2.66, 1.78], "ink");
      sign.beam([x, 2.54, 1.78], [x, 2.75, 1.78], 0.035, "ink");
    }
    // Carved book motif keeps the sign decorative; destination text stays in HTML.
    for (const side of [-1, 1]) {
      sign.box([0.3, 0.31, 0.022], [-0.28 + side * 0.16, 2.33, 1.865], "paper", [0, 0, side * 0.06]);
      for (let line = 0; line < 3; line++) sign.box([0.21, 0.013, 0.012], [-0.28 + side * 0.16, 2.4 - line * 0.07, 1.883], "wood");
    }
    sign.box([0.025, 0.34, 0.015], [-0.28, 2.33, 1.885], "wood");
  });
  p.box([2.78, 0.14, 0.23], [-0.32, 1.95, 1.8], "wood");
  for (let i = 0; i < 10; i++) {
    p.cylinder(0.073, 0.035, [-1.62 + i * 0.29, 1.94, 1.93], "gold", [Math.PI / 2, 0, 0]);
    p.sphere(0.048, [-1.62 + i * 0.29, 1.94, 1.964], "light", [1, 1, 0.5]);
  }
  p.cylinder(0.23, 0.07, [-0.28, 2.91, 1.7], "gold", [Math.PI / 2, 0, 0]);
  p.torus(0.19, 0.035, [-0.28, 2.91, 1.76], "wood");
  questionMark(p, -0.28, 2.91, 1.805, 0.53);
  for (const x of [-0.91, 0.35]) {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 0.085 : 0.17;
      if (i === 0) star.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else star.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    star.closePath(); p.shape(star, 0.04, [x, 2.89, 1.65], "gold", 0.01);
  }
  p.box([0.92, 0.13, 0.83], [0, 4.04, -0.08], "stone");
  for (const x of [-0.33, 0.33]) p.box([0.12, 0.66, 0.12], [x, 4.36, -0.01], "cream");
  p.box([0.72, 0.6, 0.09], [0, 4.37, -0.36], "ink"); roof(p, 1.03, 0.92, 4.7, 0.43);
  p.cylinder(0.09, 0.25, [0, 4.42, 0.05], "gold");
  p.sphere(0.09, [0, 4.57, 0.05], "gold");
  for (let row = 0; row < 6; row++) p.torus(0.092, 0.008, [0, 4.33 + row * 0.042, 0.05], "ink", [Math.PI / 2, 0, 0]);
  p.beam([-0.14, 4.49, 0.05], [-0.14, 4.26, 0.05], 0.028, "gold");
  p.beam([0.14, 4.49, 0.05], [0.14, 4.26, 0.05], 0.028, "gold");
  p.beam([-0.14, 4.26, 0.05], [0.14, 4.26, 0.05], 0.028, "gold");
  p.beam([0, 4.13, 0.05], [0, 4.29, 0.05], 0.035, "gold");
  p.box([0.21, 0.04, 0.12], [0, 4.13, 0.05], "gold");
  p.sphere(0.1, [0, 5.24, -0.08], "gold");
  for (const x of [-0.33, 0.33]) p.box([0.21, 0.07, 0.2], [x, 4.64, 0.01], "stone");
  // Original question-mark easel at the entrance, with two real support legs.
  p.box([0.67, 0.88, 0.08], [2.33, 0.72, 1.95], "wood", [-0.1, 0, -0.07]);
  p.box([0.54, 0.72, 0.035], [2.33, 0.73, 2.016], "gold", [-0.1, 0, -0.07]);
  p.box([0.45, 0.63, 0.025], [2.33, 0.73, 2.047], "paper", [-0.1, 0, -0.07]);
  questionMark(p, 2.33, 0.75, 2.1, 1);
  for (const x of [2.08, 2.57]) {
    p.beam([x, 0.1, 1.72], [x, 1.12, 1.89], 0.065, "woodLight");
    p.beam([x, 0.1, 2.09], [x, 1.12, 1.89], 0.065, "woodLight");
  }
  p.facing([-2.21, 0, 0.84], -Math.PI / 2, face => {
    face.box([0.75, 0.63, 0.38], [0, 0.51, 0.1], "wood");
    for (const y of [0.24, 0.82]) face.box([0.83, 0.07, 0.44], [0, y, 0.12], "woodLight");
    for (let i = 0; i < 4; i++) book(face, -0.27 + i * 0.18, 0.29, 0.12, 0.14, 0.38 + i % 2 * 0.07, ["teal", "red", "gold", "tealDark"][i] as Paint);
  });
}

function questionMark(p: BuildingParts, x: number, y: number, z: number, scale: number) {
  const points = [[-0.1, 0.1], [-0.09, 0.19], [0.04, 0.22], [0.12, 0.14], [0.09, 0.04], [0.005, -0.025], [0.005, -0.07]];
  const curve = new THREE.CatmullRomCurve3(points.map(([px, py]) => new THREE.Vector3(px * scale, py * scale, 0)));
  p.add(new THREE.TubeGeometry(curve, 16, 0.028 * scale, 6, false), "ink", [x, y, z]);
  p.sphere(0.034 * scale, [x + 0.005 * scale, y - 0.16 * scale, z], "ink", [1, 1, 0.45]);
}

/** Each call owns its geometries/materials. Origin: ground level; front: +Z. */
export function createVillageBuilding(kind: VillageBuildingKind): THREE.Group {
  const parts = new BuildingParts();
  const factories: Record<VillageBuildingKind, (parts: BuildingParts) => void> = {
    warehouse, bank, office, market, shop, arena, missions, collection,
  };
  factories[kind](parts);
  return parts.finish(kind);
}

/** The separate KqMailbox map prop, modelled from /placard/ui/mailbox-v1.webp. */
export function createVillageMailbox(): THREE.Group {
  const p = new BuildingParts();
  p.box([1.02, 0.12, 0.86], [0, 0.08, 0], "ink");
  p.box([0.92, 0.24, 0.76], [0, 0.21, 0], "woodLight");
  p.box([0.4, 1.04, 0.4], [0, 0.77, 0], "wood");
  p.box([0.32, 1.02, 0.035], [0, 0.77, 0.215], "woodLight");
  for (const x of [-0.1, 0.09]) p.beam([x, 0.32, 0.24], [x + 0.025, 1.17, 0.24], 0.02, "wood");

  p.box([1.45, 1.23, 1.02], [0, 1.75, 0], "ink");
  p.box([1.4, 1.15, 0.96], [0, 1.75, 0], "tealDark");
  p.box([1.31, 1.11, 0.055], [0, 1.75, 0.53], "teal");
  p.box([0.99, 0.18, 0.04], [0, 2.08, 0.575], "tealDark");
  p.box([0.93, 0.12, 0.045], [0, 2.08, 0.6], "ink");

  const roof = new THREE.Shape();
  roof.moveTo(-0.86, 0); roof.quadraticCurveTo(-0.65, 0.08, -0.54, 0.3);
  roof.quadraticCurveTo(0, 0.92, 0.54, 0.3); roof.quadraticCurveTo(0.65, 0.08, 0.86, 0);
  roof.lineTo(0.86, -0.09); roof.lineTo(-0.86, -0.09); roof.closePath();
  p.shape(roof, 1.14, [0, 2.35, -0.57], "tealDark", 0.04);
  p.shape(roof, 0.04, [0, 2.35, 0.58], "teal", 0.02);
  const trim = new THREE.Shape();
  trim.moveTo(-0.88, 0); trim.quadraticCurveTo(-0.65, 0.08, -0.54, 0.3);
  trim.quadraticCurveTo(0, 0.92, 0.54, 0.3); trim.quadraticCurveTo(0.65, 0.08, 0.88, 0);
  trim.lineTo(0.88, -0.08); trim.quadraticCurveTo(0.65, 0, 0.48, 0.24);
  trim.quadraticCurveTo(0, 0.8, -0.48, 0.24); trim.quadraticCurveTo(-0.65, 0, -0.88, -0.08); trim.closePath();
  p.shape(trim, 0.04, [0, 2.36, 0.65], "gold", 0.018);
  p.cylinder(0.16, 0.1, [0, 2.98, 0.05], "gold");
  p.sphere(0.15, [0, 3.12, 0.05], "gold");
  for (const [x, y] of [[-0.1, 2.52], [0.1, 2.52], [0, 2.65]]) p.sphere(0.09, [x, y, 0.66], "gold", [0.75, 1, 0.35]);

  // Raised envelope and dark fold lines stay readable without raster textures.
  p.box([0.78, 0.53, 0.055], [-0.12, 1.62, 0.59], "ink");
  p.box([0.7, 0.45, 0.045], [-0.12, 1.62, 0.635], "paper");
  for (const x of [-0.45, 0.21]) {
    p.beam([x, 1.82, 0.665], [-0.12, 1.58, 0.665], 0.028, "ink");
    p.beam([x, 1.42, 0.665], [x < 0 ? -0.24 : 0, 1.66, 0.665], 0.022, "ink");
  }
  p.cylinder(0.12, 0.06, [0.47, 1.71, 0.61], "ink", [Math.PI / 2, 0, 0]);
  p.sphere(0.11, [0.47, 1.71, 0.67], "gold", [1, 1, 0.65]);
  for (const x of [-0.58, 0.58]) for (const y of [1.28, 2.22]) p.sphere(0.045, [x, y, 0.58], "gold");
  // Folded metal returns, hinges and fasteners remain part of the mailbox hit target.
  for (const side of [-1, 1]) {
    p.box([0.055, 1.08, 0.08], [side * 0.645, 1.75, 0.54], "tealDark");
    p.box([0.04, 0.77, 0.73], [side * 0.715, 1.76, 0], "teal");
    p.box([0.045, 0.055, 0.8], [side * 0.719, 2.16, 0], "gold");
    for (const z of [-0.32, 0.32]) for (const y of [1.43, 2.09]) p.sphere(0.027, [side * 0.744, y, z], "gold");
    for (let vent = 0; vent < 3; vent++) p.box([0.025, 0.023, 0.28], [side * 0.742, 1.61 + vent * 0.1, -0.01], "tealDark");
    p.beam([side * 0.12, 0.82, 0], [side * 0.55, 1.16, 0], 0.085, "woodLight");
    p.box([0.08, 0.09, 0.85], [side * 0.57, 1.14, 0], "ink");
  }
  for (const y of [1.49, 1.99]) {
    p.box([0.19, 0.08, 0.045], [-0.58, y, 0.61], "gold");
    p.cylinder(0.035, 0.14, [-0.67, y, 0.62], "ink");
    p.sphere(0.018, [-0.53, y, 0.64], "ink");
  }
  p.box([1.03, 0.055, 0.09], [0, 2.19, 0.62], "tealDark", [-0.19, 0, 0]);
  p.box([0.91, 0.018, 0.035], [0, 2.187, 0.672], "light");
  p.box([0.022, 0.07, 0.018], [0.47, 1.69, 0.747], "ink");
  p.box([0.79, 0.76, 0.055], [0, 1.73, -0.51], "teal");
  for (const x of [-0.36, 0.36]) for (const y of [1.39, 2.07]) p.sphere(0.026, [x, y, -0.55], "gold");
  p.box([0.23, 0.055, 0.075], [0, 1.83, -0.555], "ink");
  for (const y of [0.37, 1.07]) {
    p.box([0.43, 0.075, 0.43], [0, y, 0], "ink");
    p.sphere(0.036, [0, y, 0.234], "gold");
  }
  for (const x of [-0.32, 0.32]) for (const z of [-0.27, 0.27]) p.cylinder(0.035, 0.035, [x, 0.348, z], "ink");
  return p.finish("mailbox");
}
