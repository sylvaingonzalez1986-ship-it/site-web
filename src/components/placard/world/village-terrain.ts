import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAP_ENTRANCES, MAP_SCENERY } from "../KqPlacardMap.scene";
import { paintingToGround, VILLAGE_MAILBOX_POSITION, VILLAGE_PLACES, villagePlacePosition } from "./village-layout";
import { createVillageMainland } from "./village-mainland";
import { VILLAGE_SHEEP_PASTURE } from "./village-sheep-pasture";
import { projectVillageSurface, villageGraniteBlock, villageMaterial, type VillageSurface } from "./village-surfaces";

type Point = readonly [number, number];
type XYZ = readonly [number, number, number];
type Layer = "ground" | "track" | "rocks" | "details";
type Pigment = string | ((color: THREE.Color, x: number, y: number, z: number) => void);
const surfaces: Partial<Record<Layer, VillageSurface>> = { ground: "turf", track: "silt", rocks: "granite" };
const C = {
  turf: "#a6bc7c", grass: "#759653", grassLight: "#c4d28c", grassDark: "#4b7749",
  leaf: "#397856", leafLight: "#62985e", leafDark: "#265d49", leafTip: "#82aa68",
  sand: "#eddbac", path: "#dec99e", stone: "#a6a895", stoneLight: "#c8c1a6", stoneDark: "#858e80",
  wood: "#9c7145", woodLight: "#c69658", woodDark: "#634d38", ink: "#294942",
  cream: "#fff0ca", teal: "#087f7c", gold: "#edc153", blue: "#82bfcf", flower: "#b5d9dc",
} as const;

/** The static landscape shares one batch per surface. */
class LandscapeParts {
  private batches = new Map<Layer, THREE.BufferGeometry[]>();
  private matrix = new THREE.Matrix4();
  private rotation = new THREE.Quaternion();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private color = new THREE.Color();
  count = 0;

  add(geometry: THREE.BufferGeometry, color: Pigment, at: XYZ, scale: XYZ = [1, 1, 1], rotation: XYZ = [0, 0, 0], layer: Layer = "details") {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (source !== geometry) geometry.dispose();
    source.deleteAttribute("uv");
    this.matrix.compose(this.position.set(...at), this.rotation.setFromEuler(new THREE.Euler(...rotation)), this.scale.set(...scale));
    source.applyMatrix4(this.matrix);
    if (!source.hasAttribute("color")) {
      const positions = source.getAttribute("position");
      const colors = new Float32Array(positions.count * 3);
      if (typeof color === "string") this.color.set(color);
      for (let i = 0; i < positions.count; i++) {
        if (typeof color === "function") color(this.color, positions.getX(i), positions.getY(i), positions.getZ(i));
        this.color.toArray(colors, i * 3);
      }
      source.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    const batch = this.batches.get(layer) ?? [];
    batch.push(source); this.batches.set(layer, batch); this.count++;
  }

  box(color: string, at: XYZ, size: XYZ, angle = 0, layer: Layer = "details") {
    this.add(new THREE.BoxGeometry(...size), color, at, [1, 1, 1], [0, angle, 0], layer);
  }

  sphere(color: string, at: XYZ, radius: number, scale: XYZ = [1, 1, 1]) {
    this.add(new THREE.SphereGeometry(radius, radius < 0.2 ? 7 : 10, radius < 0.2 ? 5 : 7), color, at, scale);
  }

  stone(color: string, at: XYZ, radius: number, scale: XYZ = [1, 0.6, 1], angle = 0, layer: Layer = "details") {
    this.add(new THREE.IcosahedronGeometry(radius, 1), color, at, scale, [0.13, angle, 0.08], layer);
  }

  granite(color: string, at: XYZ, size: XYZ, angle: number, layer: Layer = "rocks") {
    this.add(villageGraniteBlock(angle), color, at, size, [0.1, angle, 0.14], layer);
  }

  foliage(color: string, at: XYZ, size: XYZ, salt: number) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const positions = geometry.getAttribute("position"), shade = new THREE.Color(color), low = new THREE.Color(C.leafDark);
    const rgb = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const cut = 1 + Math.sin(x * 5.6 + y * 8.6 + z * 4.4 + salt) * 0.11;
      positions.setXYZ(i, x * cut, y * cut, z * cut);
      this.color.copy(shade).lerp(low, (1 - y) * 0.21).multiplyScalar(0.96 + cut * 0.055).toArray(rgb, i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    this.add(geometry, color, at, size, [0.04, salt * 0.32, -0.12]);
  }

  beam(color: string, start: XYZ, end: XYZ, radius: number, round = true) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const geometry = round ? new THREE.CylinderGeometry(radius * 0.75, radius, a.distanceTo(b), 7) : new THREE.BoxGeometry(radius, a.distanceTo(b), radius);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    this.add(geometry, color, a.add(b).multiplyScalar(0.5).toArray() as [number, number, number]);
  }

  tube(color: string, points: readonly XYZ[], radius: number, layer: Layer = "details") {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    this.add(new THREE.TubeGeometry(curve, Math.max(10, points.length * 5), radius, 5, false), color, [0, 0, 0], [1, 1, 1], [0, 0, 0], layer);
  }

  finish() {
    const group = new THREE.Group(); group.name = "village-landscape";
    let triangles = 0;
    for (const [layer, geometries] of this.batches) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(part => part.dispose());
      if (!geometry) throw new Error("Unable to merge village terrain " + layer);
      geometry.computeBoundingSphere();
      triangles += geometry.getAttribute("position").count / 3;
      const surface = surfaces[layer];
      if (surface) projectVillageSurface(geometry, surface);
      const mesh = new THREE.Mesh(geometry, villageMaterial({ vertexColors: true, roughness: 0.96 }, surface));
      mesh.name = "landscape-" + layer;
      mesh.castShadow = layer === "details" || layer === "rocks";
      mesh.receiveShadow = true;
      // Decoration cannot mask the buildings/mailbox. Ground keeps the existing
      // raycast and click-to-dismiss behaviour.
      if (layer !== "ground" && layer !== "track") mesh.raycast = () => {};
      group.add(mesh);
    }
    group.userData.detailCount = this.count;
    group.userData.triangles = triangles;
    return group;
  }
}

const COAST: readonly Point[] = [[-40, 195], [70, 70], [260, -5], [500, 5], [700, 60], [930, 115], [1070, 130], [1370, 170], [1510, 275], [1560, 450], [1500, 670], [1340, 770], [1190, 858], [1050, 930], [840, 1015], [660, 1120], [380, 1105], [80, 1025], [-80, 820], [-105, 510]];
const RIVER: readonly Point[] = [[1580, 675], [1495, 712], [1380, 775], [1250, 840], [1120, 920], [940, 1015], [780, 1100], [715, 1200], [1030, 1200], [1100, 1090], [1250, 1010], [1390, 920], [1490, 840], [1600, 790]];
export const VILLAGE_COAST = COAST;
export const VILLAGE_RIVER = RIVER;
export const VILLAGE_SECOND_BANK: readonly Point[] = [[1450, 870], [1530, 806], [1600, 800], [1670, 1050], [1480, 1180], [1030, 1200], [1100, 1100], [1270, 1015]];

function inside(point: Point, polygon: readonly Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, y] = polygon[i], [px, py] = polygon[j];
    if ((y > point[1]) !== (py > point[1]) && point[0] < (px - x) * (point[1] - y) / (py - y) + x) result = !result;
  }
  return result;
}

/** Original painting coordinates stay authoritative for entrances and scenery. */
export function createVillageTerrain() {
  const p = new LandscapeParts();
  let seed = 1039;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const choose = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const ground = ([px, py]: Point, y = 0): XYZ => { const [x, z] = paintingToGround(px, py); return [x, y, z]; };
  const places = VILLAGE_PLACES.map(place => ({ ...place, position: villagePlacePosition(place) }));
  const animatedPlants = MAP_SCENERY.filter(piece => piece.id === "daisies" || piece.id === "hydrangea").map(piece => ground(piece.anchor));
  const paths: { samples: THREE.Vector3[]; width: number }[] = [];
  const groundTiles = new Map<string, number[][]>();
  const groundAprons: { x: number; z: number; radius: number }[] = [];
  const navigationObstacles: { x: number; z: number; radius: number }[] = [];

  function unoccupied(x: number, z: number, margin = 0) {
    if (Math.hypot(x - VILLAGE_MAILBOX_POSITION[0], z - VILLAGE_MAILBOX_POSITION[2]) < 2 + margin) return false;
    if (animatedPlants.some(at => Math.hypot(x - at[0], z - at[2]) < 1 + margin)) return false;
    return !places.some(place => {
      const width = place.id === "missions" ? 1.5 : place.id === "warehouse" ? 3.75 : 3.25;
      return Math.abs(x - place.position[0]) < width * place.scale + margin
        && z > place.position[2] - place.depth * place.scale / 2 - margin - 0.5
        && z < place.position[2] + place.depth * place.scale / 2 + margin + 1;
    });
  }
  function awayFromPaths(x: number, z: number, margin = 0) {
    return !paths.some(path => path.samples.some(at => (x - at.x) ** 2 + (z - at.z) ** 2 < (path.width / 2 + margin) ** 2));
  }
  function free(point: Point, margin = 0) {
    const [x, z] = paintingToGround(...point);
    const pasture = VILLAGE_SHEEP_PASTURE;
    if (x > pasture.minX - margin && x < pasture.maxX + margin && z > pasture.minZ - margin && z < pasture.maxZ + margin) return false;
    return inside(point, COAST) && !inside(point, RIVER) && unoccupied(x, z, margin) && awayFromPaths(x, z, margin);
  }

  function outline(points: readonly Point[], color: string, height: number, thickness = 0, layer: Layer = "ground") {
    const vertices = points.map(point => { const [x, , z] = ground(point); return new THREE.Vector3(x, -z, 0); });
    const shape = new THREE.Shape(new THREE.CatmullRomCurve3(vertices, true, "centripetal").getPoints(160).map(point => new THREE.Vector2(point.x, point.y)));
    const geometry = thickness ? new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 2 }) : new THREE.ShapeGeometry(shape);
    p.add(geometry, color, [0, height, 0], [1, 1, 1], [-Math.PI / 2, 0, 0], layer);
  }
  function indexGround(vertices: readonly number[], floor: number) {
    for (let i = 0; i < vertices.length; i += 9) {
      const [ax, , az, bx, , bz, cx, , cz] = vertices.slice(i, i + 9);
      const triangle = [ax, az, bx, bz, cx, cz, floor];
      for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.floor(Math.max(ax, bx, cx)); x++) {
        for (let z = Math.floor(Math.min(az, bz, cz)); z <= Math.floor(Math.max(az, bz, cz)); z++) {
          const key = `${x},${z}`, tile = groundTiles.get(key);
          if (tile) tile.push(triangle);
          else groundTiles.set(key, [triangle]);
        }
      }
    }
  }
  function groundHeightAt(x: number, z: number) {
    let height = 0.006;
    for (const [ax, az, bx, bz, cx, cz, floor] of groundTiles.get(`${Math.floor(x)},${Math.floor(z)}`) ?? []) {
      if (floor <= height) continue;
      const ab = (bx - ax) * (z - az) - (bz - az) * (x - ax);
      const bc = (cx - bx) * (z - bz) - (cz - bz) * (x - bx);
      const ca = (ax - cx) * (z - cz) - (az - cz) * (x - cx);
      if ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0)) height = floor;
    }
    for (const apron of groundAprons) {
      if ((x - apron.x) ** 2 + ((z - apron.z) / 0.62) ** 2 < apron.radius ** 2) height = Math.max(height, 0.0585);
    }
    return height;
  }
  function ribbon(samples: THREE.Vector3[], width: number, color: string, height: number, layer: Layer, irregular = 0, floor?: number, edge?: string) {
    if (samples.length < 2) return;
    const vertices: number[] = [];
    const pigments: number[] = [];
    const face = new THREE.Color(color), rim = new THREE.Color(edge ?? color), tint = new THREE.Color();
    const lanes = edge ? [-1, -0.69, 0, 0.69, 1] : [-1, 1];
    const offset = (index: number) => {
      const before = samples[Math.max(0, index - 1)], after = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.max(0.0001, Math.hypot(after.x - before.x, after.z - before.z));
      const w = width / 2 * (1 + (Math.sin(index * 0.29) * 0.75 + Math.sin(index * 1.45) * 0.25) * irregular);
      return [(after.z - before.z) / length * w, -(after.x - before.x) / length * w];
    };
    const row = samples.map((at, index) => {
      const [dx, dz] = offset(index);
      return lanes.map(lane => [at.x + dx * lane, height, at.z + dz * lane]);
    });
    const vertex = (index: number, lane: number) => {
      const [x, y, z] = row[index][lane];
      vertices.push(x, y, z);
      const fade = THREE.MathUtils.smoothstep(Math.abs(lanes[lane]), 0.56, 1);
      tint.copy(face).lerp(rim, fade).multiplyScalar(0.96 + Math.sin(x * 1.68 + z * .85) * 0.034 + Math.cos(z * 1.43) * 0.024);
      pigments.push(tint.r, tint.g, tint.b);
    };
    for (let i = 0; i < samples.length - 1; i++) {
      for (let lane = 0; lane < lanes.length - 1; lane++) {
        vertex(i, lane); vertex(i + 1, lane + 1); vertex(i, lane + 1);
        vertex(i, lane); vertex(i + 1, lane); vertex(i + 1, lane + 1);
      }
    }
    if (floor !== undefined) indexGround(vertices, floor);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(pigments, 3));
    p.add(geometry, color, [0, 0, 0], [1, 1, 1], [0, 0, 0], layer);
  }
  function curve(points: readonly Point[], step = 0.45) {
    const line = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...ground(point))), false, "centripetal");
    return line.getSpacedPoints(Math.max(8, Math.ceil(line.getLength() / step)));
  }

  // Exposed granite strata meet the same coastline as the walkable turf above.
  outline(COAST, C.turf, 0.006);
  outline(VILLAGE_SECOND_BANK, C.turf, -0.6, 0.6);
  const coastCurve = new THREE.CatmullRomCurve3(COAST.map(point => new THREE.Vector3(...ground(point))), true, "centripetal");
  const coastLine = coastCurve.getPoints(160);
  const landBoundary = coastLine.map(at => [at.x, at.z] as const);
  const rockRows = coastLine.map((at, i) => {
    const before = coastLine[(i + 159) % 160], after = coastLine[(i + 1) % 160];
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz);
    const cut = Math.sin(i * 0.39) * 0.19 + Math.sin(i * 1.38) * 0.06;
    const point = (height: number, out: number): XYZ => [at.x + out * dz / length, height, at.z - out * dx / length];
    return [point(0.004, 0), point(-0.105, 0.052 + cut * 0.18), point(-0.32 + cut * 0.34, 0.23 + cut), point(-0.62, 0.31 + cut)];
  });
  const cliffGeometry = new THREE.BufferGeometry(), cliffPositions: number[] = [];
  for (let i = 0; i < rockRows.length - 1; i++) {
    const a = rockRows[i], b = rockRows[i + 1];
    for (let band = 0; band < a.length - 1; band++) cliffPositions.push(...a[band], ...b[band], ...a[band + 1], ...a[band + 1], ...b[band], ...b[band + 1]);
  }
  cliffGeometry.setAttribute("position", new THREE.Float32BufferAttribute(cliffPositions, 3));
  cliffGeometry.computeVertexNormals();
  const moss = new THREE.Color(C.grassDark), graniteHighlight = new THREE.Color(C.stoneLight);
  p.add(cliffGeometry, (color, x, y, z) => {
    color.set(y < -0.27 ? "#777e71" : "#999782");
    color.lerp(y > -0.12 ? moss : graniteHighlight, 0.26 + Math.sin(x * 2.7 + z) * 0.16);
  }, [0, 0, 0], [1, 1, 1], [0, 0, 0], "rocks");
  const ledges = coastCurve.getSpacedPoints(Math.ceil(coastCurve.getLength() / 0.56));
  for (let i = 0; i < ledges.length - 1; i += 2) {
    const at = ledges[i], cluster = Math.sin(i * 0.29) + Math.cos(i * 0.57) * 0.52;
    if (cluster < -0.45) continue;
    p.granite(choose([C.stone, C.stoneLight, C.stoneDark]), [at.x, -0.13, at.z], [0.31 + random() * 0.36, 0.22 + random() * 0.21, 0.26 + random() * 0.3], random() * 6.28);
    if (cluster > 0.6) {
      p.granite(C.stoneDark, [at.x + 0.22, -0.26, at.z - 0.22], [0.34, 0.26, 0.45], random() * 6.28);
      p.stone(C.grass, [at.x, 0.02, at.z], 0.48, [1.15, 0.08, 0.85], random() * 6.28);
    }
  }
  const riverBanks: Point[][] = [RIVER.slice(0, 8) as Point[], [...RIVER.slice(8)].reverse() as Point[]];
  for (const points of riverBanks) {
    const samples = curve(points, 0.45);
    ribbon(samples, 0.42, C.sand, 0.027, "track", 0.26);
  }

  function path(points: readonly Point[], width: number) {
    const samples = curve(points, 0.36);
    // Millimetre offsets in the rendered layers avoid depth fighting at crossings.
    const lift = paths.length * 0.0016;
    paths.push({ samples, width });
    const visible = samples.filter(point => inside([point.x, point.z], landBoundary));
    ribbon(visible, width + 0.24, "#bab489", 0.027 + lift, "track", 0.15, 0.029, "#a4b37a");
    ribbon(visible, width, C.path, 0.044 + lift, "track", 0.09, 0.044, "#c3b68b");
    for (let i = 1; i < visible.length - 1; i++) {
      const at = visible[i], before = visible[i - 1], after = visible[i + 1];
      const angle = Math.atan2(after.x - before.x, after.z - before.z);
      for (const side of [-1, 1]) {
        if (random() > 0.34 + Math.sin(i * 0.42 + side) * 0.23) continue;
        const offset = width * (0.46 + random() * 0.065);
        p.granite(choose([C.stone, C.stoneLight, "#c3bd9c"]),
          [at.x + Math.cos(angle) * offset * side, 0.042 + lift, at.z - Math.sin(angle) * offset * side],
          [0.13 + random() * 0.1, 0.037, 0.13 + random() * 0.18], angle + random() * 0.36, "track");
      }
      if (i % 2 === 0 && random() < 0.74) {
        const across = (random() - 0.5) * width * 0.8;
        p.granite(choose(["#c4b592", "#cfc09e", "#dbceae"]), [at.x + Math.cos(angle) * across, 0.048 + lift, at.z - Math.sin(angle) * across],
          [0.08 + random() * 0.1, 0.023, 0.1 + random() * 0.09], angle, "track");
      }
    }
  }
  path([[330, 1150], [530, 930], [555, 735], [615, 580], [600, 405], [660, 305], [905, 290], [1040, 330], [1200, 420], [1460, 430]], 1.85);
  path([[-85, 690], [170, 690], [340, 662], [555, 735], [840, 960], [1040, 1000]], 1.65);
  path([[620, 580], [870, 560], [1060, 655], [1230, 740], [1390, 805]], 1.85);
  path([[350, 326], [430, 375], [600, 405]], 1.6);
  path([[1260, 775], [1270, 850]], 1.55);
  const mainPaths = [...paths];
  for (const [index, place] of places.entries()) {
    const entrance = ground(MAP_ENTRANCES[place.id]);
    const front = new THREE.Vector3(entrance[0], 0, entrance[2] + 0.8);
    const nearest = mainPaths.flatMap(path => path.samples).reduce((best, point) => point.distanceToSquared(front) < best.distanceToSquared(front) ? point : best);
    const line = new THREE.CatmullRomCurve3([new THREE.Vector3(...entrance), front, nearest.clone()], false, "centripetal");
    const samples = line.getSpacedPoints(Math.max(5, Math.ceil(line.getLength() / 0.3)));
    paths.push({ samples, width: 1.5 });
    const lift = index * 0.0011;
    ribbon(samples, 1.5, C.path, 0.049 + lift, "track", 0.07, 0.049, "#c3b68b");
    const radius = place.id === "warehouse" ? 2.6 : 2.2;
    p.add(new THREE.CylinderGeometry(radius, radius, 0.025, 32), C.path, [entrance[0], 0.046 + lift, entrance[2] + 0.5], [1, 1, 0.62], [0, 0, 0], "track");
    groundAprons.push({ x: entrance[0], z: entrance[2] + 0.5, radius });
    for (let row = 0; row < 3; row++) for (let col = -2; col <= 2; col++) {
      const tone = (row + col) % 3 ? C.stoneLight : C.stone;
      p.granite(tone, [entrance[0] + col * 0.36 + row % 2 * 0.12, 0.073 + lift, entrance[2] + 0.25 + row * 0.29],
        [0.18, 0.032, 0.127], Math.sin(row * 4.3 + col) * 0.22, "track");
    }
  }

  function grass(x: number, z: number, size = 1, color: string = C.grassDark) {
    const blades: number[] = [];
    for (let blade = 0; blade < 5; blade++) {
      const angle = random() * Math.PI * 2, w = 0.026 * size, height = (0.12 + random() * 0.2) * size;
      const dx = Math.cos(angle), dz = Math.sin(angle), offset = (blade - 2) * 0.045 * size;
      blades.push(x + dx * offset - dz * w, 0.028, z + dz * offset + dx * w,
        x + dx * (offset + height * 0.45), height, z + dz * (offset + height * 0.45),
        x + dx * offset + dz * w, 0.028, z + dz * offset - dx * w);
      const end = blades.length;
      blades.push(...blades.slice(end - 3, end), ...blades.slice(end - 6, end - 3), ...blades.slice(end - 9, end - 6));
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(blades, 3)); geometry.computeVertexNormals();
    p.add(geometry, color, [0, 0, 0]);
  }
  // Low grass tufts gather above soft pigment patches on the windward turf.
  const dryTurf = new THREE.Color("#bbc98c"), baseTurf = new THREE.Color(C.turf), dampTurf = new THREE.Color("#8eaa6a");
  for (let i = 0; i < 420; i++) {
    const point: Point = [-45 + random() * 1590, 45 + random() * 1050];
    if (!free(point, 0.5)) continue;
    const [x, z] = paintingToGround(...point), radius = 0.42 + random() * 0.65;
    if (i % 3 !== 1) {
      const patch = new THREE.CircleGeometry(radius, 9);
      const positions = patch.getAttribute("position");
      for (let j = 1; j < positions.count; j++) {
        const shape = 1 + Math.sin(j * 2.8 + i) * 0.29;
        positions.setXY(j, positions.getX(j) * shape, positions.getY(j) * shape);
      }
      p.add(patch, (color, px, _y, pz) => {
        const inside = 1 - THREE.MathUtils.smoothstep(Math.hypot(px - x, pz - z), 0, radius * 0.65);
        color.copy(baseTurf).lerp(i % 2 ? dryTurf : dampTurf, inside * 0.77);
      }, [x, 0.014 + i * 0.000005, z], [1.28, 0.8, 1], [-Math.PI / 2, 0, i * 2.4], "ground");
    }
    for (let j = 0; j < 2; j++) grass(x + (random() - 0.5) * radius, z + (random() - 0.5) * radius, 0.52 + random() * 0.62, choose([C.grass, C.grassDark, C.grassLight]));
  }

  function petal(x: number, y: number, z: number, a: number, color: string) {
    const petal = new THREE.IcosahedronGeometry(0.072);
    p.add(petal, color, [x, y, z], [1.2, 0.34, 0.72], [0, -a, 0.09]);
  }

  function flower(x: number, z: number, height: number, color: string = C.gold) {
    p.beam(C.grassDark, [x, 0.04, z], [x + 0.03, height, z], 0.018);
    p.sphere(C.leafLight, [x - 0.05, height * 0.45, z], 0.085, [1.3, 0.23, 0.65]);
    for (let index = 0; index < 5; index++) {
      const a = index * Math.PI * 0.4;
      petal(x + Math.cos(a) * 0.081, height, z + Math.sin(a) * 0.081, a, color);
    }
    p.sphere(color === C.gold ? C.woodLight : C.gold, [x, height + 0.025, z], 0.043, [1, 0.7, 1]);
  }
  function shrub(px: number, py: number, radius = 0.6, hydrangea = false) {
    const [x, z] = paintingToGround(px, py);
    if (!unoccupied(x, z, radius * 0.5) || !awayFromPaths(x, z, radius * 0.3)) return;
    navigationObstacles.push({ x, z, radius: radius * 1.12 });
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, bx = x + Math.cos(a) * radius * 0.47, bz = z + Math.sin(a) * radius * 0.47;
      const spread = radius * (0.49 + random() * 0.13);
      p.foliage(choose([C.leaf, C.leafLight, C.leafDark]), [bx, radius * 0.46 + i % 2 * 0.13, bz], [spread, spread * 0.8, spread], a);
      if (hydrangea && i % 2 === 0) {
        const fy = radius * 0.95 + i % 3 * 0.07;
        p.foliage(C.blue, [bx, fy, bz], [radius * 0.29, radius * 0.26, radius * 0.28], a);
        for (let j = 0; j < 6; j++) {
          const a = j * 2.4;
          p.sphere(j % 3 ? C.flower : C.blue, [bx + Math.cos(a) * radius * 0.22, fy + 0.07 + Math.sin(j) * 0.07, bz + Math.sin(a) * radius * 0.22], radius * 0.09, [1, 0.65, 1]);
        }
      }
    }
    grass(x + radius * 0.8, z, 1.15);
  }
  const shrubs: Point[] = [[35, 180], [90, 190], [530, 155], [550, 215], [1025, 233], [1460, 330], [1430, 400], [70, 475], [45, 540], [485, 545], [920, 365], [640, 450], [1380, 640], [1480, 645], [585, 900], [1000, 820], [1000, 885], [60, 840], [95, 900], [155, 970], [1430, 1000], [1290, 1100], [60, 70], [110, 60], [155, 40], [175, 80], [1000, 95]];
  shrubs.forEach(([px, py], i) => shrub(px, py, i > 19 ? 0.95 : 0.65, i < 20 && i % 2 === 0));
  for (let i = 0; i < 95; i++) {
    const point: Point = [random() * 1480, 110 + random() * 920];
    if (!free(point, 0.7)) continue;
    const [x, z] = paintingToGround(...point);
    for (let j = 0; j < 4; j++) flower(x + (random() - 0.5) * 0.5, z + (random() - 0.5) * 0.5, 0.23 + random() * 0.21, i % 3 === 0 ? C.cream : C.gold);
  }

  function tree(px: number, py: number, size: number) {
    const [x, z] = paintingToGround(px, py);
    if (!unoccupied(x, z, size * 1.6) || !awayFromPaths(x, z, size)) return;
    navigationObstacles.push({ x, z, radius: size * 0.65 });
    p.stone(C.grass, [x, 0.028, z], size * 1.4, [1, 0.035, 0.9]);
    const pine = (px + py) % 7 < 3;
    const lean = pine ? 0.52 : 0.18;
    const footing: XYZ = [x, 0.018, z];
    const fork: XYZ = [x + size * lean * 0.5, size * 1.12, z - size * 0.17];
    const trunk: XYZ = [x + size * lean, size * (pine ? 2.54 : 2.26), z - size * 0.28];
    p.beam(C.woodDark, footing, fork, size * 0.2);
    p.beam(C.wood, fork, trunk, size * 0.135);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      p.beam(C.woodDark, [x, 0.2, z], [x + Math.cos(a) * size * 0.55, 0.03, z + Math.sin(a) * size * 0.55], size * 0.09);
      const branch: XYZ = [fork[0] + Math.cos(a) * size * 0.66, size * (1.78 + i % 3 * 0.2), fork[2] + Math.sin(a) * size * 0.69];
      p.beam(C.wood, fork, branch, size * 0.089);
      p.foliage(i % 3 === 0 ? C.leafDark : C.leaf, branch, [size * 0.86, size * (pine ? 0.47 : 0.78), size * 0.79], a + px);
      if (i % 2 === 0) p.foliage(C.leafLight, [branch[0] + size * 0.14, branch[1] + size * 0.37, branch[2]],
        [size * 0.72, size * (pine ? 0.37 : 0.53), size * 0.61], a + py);
    }
    p.foliage(C.leafLight, trunk, [size * 0.92, size * (pine ? 0.43 : 0.77), size * 0.85], px + py);
    p.foliage(C.leafTip, [trunk[0] + size * 0.28, trunk[1] + size * 0.27, trunk[2] - size * 0.28], [size * 0.55, size * 0.32, size * 0.53], px);
  }
  [[80, 100, 1.05], [150, 65, 1.1], [540, 95, 1.2], [620, 150, 0.9], [985, 165, 0.85], [1470, 555, 0.95], [110, 790, 1.05], [40, 930, 1.1], [170, 1030, 0.8], [1100, 790, 0.72], [1420, 1040, 1.2]].forEach(([px, py, size]) => tree(px, py, size));

  function fence(points: readonly Point[]) {
    const samples = curve(points, 0.9);
    for (const at of samples) navigationObstacles.push({ x: at.x, z: at.z, radius: 0.53 });
    for (let i = 0; i < samples.length; i++) {
      const at = samples[i];
      p.box(C.wood, [at.x, 0.45, at.z], [0.12, 0.9, 0.13]);
      p.add(new THREE.ConeGeometry(0.105, 0.12, 4), C.woodLight, [at.x, 0.94, at.z], [1, 1, 1], [0, Math.PI / 4, 0]);
      if (!i) continue;
      const before = samples[i - 1];
      for (const y of [0.35, 0.67]) p.beam(C.woodLight, [before.x, y, before.z], [at.x, y, at.z], 0.095, false);
      p.sphere(C.ink, [at.x, 0.67, at.z + 0.071], 0.022);
    }
  }
  fence([[20, 360], [55, 375], [90, 390]]);
  fence([[1410, 325], [1470, 345], [1530, 365]]);
  fence([[110, 1020], [170, 1032], [230, 1042], [290, 1052]]);
  for (const points of [[[160, 108], [235, 119]], [[940, 190], [1020, 215]], [[230, 1038], [330, 1054]]] as Point[][]) {
    const line = curve(points, 0.45);
    for (let row = 0; row < 2; row++) for (let i = 0; i < line.length; i++) {
      const at = line[i];
      if (!unoccupied(at.x, at.z, 0.3)) continue;
      if (row === 0) navigationObstacles.push({ x: at.x, z: at.z, radius: 0.48 });
      p.stone((i + row) % 3 ? C.stoneLight : C.stone, [at.x + row * 0.13, 0.15 + row * 0.24, at.z], 0.33, [1.1, 0.5, 0.8], random() * 0.3);
      if (row === 1 && i % 4 === 0) p.stone(C.grass, [at.x, 0.48, at.z], 0.18, [1, 0.1, 0.7]);
    }
  }

  // Garden beds and furniture occupy spare ground only, never the entrances.
  for (const [px, py] of [[430, 165], [125, 440], [1330, 470], [860, 805]] as Point[]) {
    if (!free([px, py], 1.3)) continue;
    const [x, z] = paintingToGround(px, py);
    p.box("#8d8261", [x, 0.07, z], [1.6, 0.12, 1.4]);
    navigationObstacles.push({ x, z, radius: 1.35 });
    for (const side of [-1, 1]) {
      p.box(C.woodLight, [x + side * 0.84, 0.15, z], [0.11, 0.28, 1.62]);
      p.box(C.wood, [x, 0.15, z + side * 0.75], [1.78, 0.28, 0.11]);
    }
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const gx = x - 0.55 + col * 0.36, gz = z - 0.45 + row * 0.45;
      for (let leaf = 0; leaf < 4; leaf++) p.sphere(leaf % 2 ? C.leafLight : C.grassLight, [gx + Math.cos(leaf * 1.57) * 0.07, 0.21, gz + Math.sin(leaf * 1.57) * 0.07], 0.12, [1, 0.4, 1]);
    }
    p.add(new THREE.CylinderGeometry(0.21, 0.16, 0.31, 12), C.teal, [x + 1.1, 0.19, z + 0.3]);
    p.tube(C.ink, [[x + 0.9, 0.32, z + 0.3], [x + 1.1, 0.56, z + 0.3], [x + 1.3, 0.32, z + 0.3]], 0.025);
  }
  for (const point of [[855, 420], [1090, 780], [345, 935]] as Point[]) {
    if (!free(point, 1.1)) continue;
    const [x, z] = paintingToGround(...point);
    navigationObstacles.push({ x, z, radius: 1.0 });
    for (let plank = 0; plank < 3; plank++) {
      p.box(C.woodLight, [x, 0.55, z - 0.22 + plank * 0.19], [1.65, 0.09, 0.16]);
      if (plank < 2) p.box(C.wood, [x, 0.85 + plank * 0.2, z - 0.4], [1.65, 0.14, 0.08]);
    }
    for (const side of [-1, 1]) {
      p.box(C.ink, [x + side * 0.6, 0.27, z], [0.1, 0.54, 0.5]);
      p.box(C.ink, [x + side * 0.6, 0.8, z - 0.37], [0.08, 0.7, 0.08]);
    }
  }

  // Arched timber bridge: edged planks, iron nails, granite abutments,
  // cross-braces and a gently sagging rope along both sides.
  const start = paintingToGround(1270, 850), end = paintingToGround(1400, 945);
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const angle = Math.atan2(end[0] - start[0], end[1] - start[1]);
  const bx = (start[0] + end[0]) / 2, bz = (start[1] + end[1]) / 2;
  const bridgeAt = (x: number, y: number, z: number): XYZ => [bx + Math.cos(angle) * x + Math.sin(angle) * z, y, bz - Math.sin(angle) * x + Math.cos(angle) * z];
  for (const side of [-1, 1]) {
    for (const endpoint of [-1, 1]) for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++)
      p.stone(col % 2 ? C.stone : C.stoneLight, bridgeAt(side * 0.88, 0.02 + row * 0.18, endpoint * length * 0.49 + (col - 1) * 0.25), 0.29, [1.15, 0.6, 0.75], angle);
    p.box(C.woodDark, bridgeAt(side * 0.78, 0.23, 0), [0.18, 0.24, length + 0.45], angle);
    for (const t of [-0.5, 0, 0.5]) {
      p.box(C.wood, bridgeAt(side * 1.05, 0.74, t * length), [0.19, 1.42, 0.19], angle);
      p.add(new THREE.CylinderGeometry(0.16, 0.14, 0.07, 8), C.woodLight, bridgeAt(side * 1.05, 1.48, t * length));
      for (const y of [0.41, 1.22]) p.box(C.ink, bridgeAt(side * 1.05, y, t * length), [0.21, 0.06, 0.21], angle);
    }
    for (const half of [-1, 1]) {
      p.tube(C.cream, [-0.5, -0.25, 0].map(t => bridgeAt(side * 1.05, 1.28 - (t === -0.25 ? 0.16 : 0), (t + (half === 1 ? 0.5 : 0)) * length)), 0.035);
      p.beam(C.woodDark, bridgeAt(side * 1.05, 0.46, half * length * 0.45), bridgeAt(side * 1.05, 1.13, 0), 0.065, false);
    }
  }
  for (let i = 0; i < 19; i++) {
    const t = i / 18 - 0.5, y = 0.38 + Math.sin((t + 0.5) * Math.PI) * 0.11;
    p.box(i % 3 ? C.woodLight : "#b78950", bridgeAt(0, y, t * length), [2.19, 0.13, length / 19 * 0.93], angle);
    for (const side of [-1, 1]) p.add(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 6), C.ink, bridgeAt(side * 0.79, y + 0.072, t * length));
    p.box(C.wood, bridgeAt((i % 3 - 1) * 0.43, y + 0.067, t * length + 0.025), [0.65, 0.007, 0.012], angle);
  }
  for (let i = 0; i < 40; i++) {
    const px = 805 + i * 19, py = 1080 - i * 10 + Math.sin(i * 0.85) * 16;
    const [x, z] = paintingToGround(px, py);
    p.stone(i % 3 ? C.stone : C.stoneLight, [x, 0.12, z], 0.22 + random() * 0.35, [1.25, 0.78, 1], random() * 3);
    if (i % 3 === 0) {
      grass(x + 0.35, z - 0.22, 1.6);
      for (let reed = 0; reed < 3; reed++) {
        const rx = x + 0.38 + reed * 0.08, height = 0.48 + random() * 0.35;
        p.beam(C.grassDark, [rx, 0.04, z - 0.2], [rx + 0.07, height, z - 0.13], 0.015);
        p.add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), C.woodDark, [rx + 0.07, height, z - 0.13]);
      }
    }
  }

  // Lighthouse, keeper's cottage and a ring of granite rise from the sea.
  const [lx, lz] = paintingToGround(1420, 15);
  p.stone(C.stoneLight, [lx, -0.35, lz], 2.1, [1.35, 0.45, 1]);
  p.stone(C.grass, [lx, 0.06, lz], 1.5, [1.35, 0.1, 0.8]);
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4;
    p.stone(i % 2 ? C.stone : C.stoneLight, [lx + Math.cos(a) * 1.7, -0.36, lz + Math.sin(a) * 1.4], 0.4 + random() * 0.35, [1.1, 0.85, 0.9], a);
  }
  p.add(new THREE.CylinderGeometry(0.24, 0.48, 2.7, 16), C.cream, [lx, 1.43, lz]);
  for (const y of [0.32, 0.8, 1.3, 1.8]) p.add(new THREE.CylinderGeometry(0.48 - y * 0.085, 0.485 - y * 0.085, 0.035, 16), C.stoneLight, [lx, y, lz]);
  p.box(C.teal, [lx, 0.35, lz + 0.43], [0.19, 0.45, 0.055]);
  for (const y of [1.1, 1.85]) p.box(C.ink, [lx, y, lz + 0.4 - y * 0.07], [0.085, 0.19, 0.035]);
  p.add(new THREE.CylinderGeometry(0.46, 0.46, 0.15, 16), C.ink, [lx, 2.78, lz]);
  p.add(new THREE.CylinderGeometry(0.27, 0.27, 0.47, 12), C.gold, [lx, 3.04, lz]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    p.beam(C.ink, [lx + Math.cos(a) * 0.31, 2.85, lz + Math.sin(a) * 0.31], [lx + Math.cos(a) * 0.31, 3.29, lz + Math.sin(a) * 0.31], 0.022);
    p.beam(C.ink, [lx + Math.cos(a) * 0.43, 2.85, lz + Math.sin(a) * 0.43], [lx + Math.cos(a) * 0.43, 3.03, lz + Math.sin(a) * 0.43], 0.013);
  }
  p.add(new THREE.TorusGeometry(0.43, 0.018, 5, 20), C.ink, [lx, 3.03, lz], [1, 1, 1], [Math.PI / 2, 0, 0]);
  p.add(new THREE.ConeGeometry(0.43, 0.45, 16), C.ink, [lx, 3.5, lz]);
  p.sphere(C.gold, [lx, 3.77, lz], 0.045);
  p.box(C.cream, [lx + 1.1, 0.37, lz - 0.18], [0.9, 0.6, 0.7]);
  for (const side of [-1, 1]) {
    const roof = new THREE.BoxGeometry(0.61, 0.075, 0.85); roof.rotateZ(side * -0.5);
    p.add(roof, C.ink, [lx + 1.1 + side * 0.25, 0.8, lz - 0.18]);
    p.box(C.teal, [lx + 1.1 + side * 0.23, 0.43, lz + 0.18], [0.12, 0.17, 0.025]);
  }
  p.box(C.woodLight, [lx + 1.1, 0.3, lz + 0.18], [0.15, 0.35, 0.03]);
  const result = p.finish();
  const mainland = createVillageMainland();
  result.add(mainland);
  result.userData.triangles += mainland.geometry.getAttribute("position").count / 3;
  result.userData.navigationObstacles = navigationObstacles;
  result.userData.groundPaths = paths;
  result.userData.groundAprons = groundAprons;
  result.userData.groundHeightAt = groundHeightAt;
  return result;
}

/** Primitives are owned here; R3F intentionally does not dispose them automatically. */
export function disposeVillageObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}
