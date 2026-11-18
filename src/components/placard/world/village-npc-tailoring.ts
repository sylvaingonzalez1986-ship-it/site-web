import * as THREE from "three";
import { Assembly, CHARACTER_COLORS as C, type CharacterPoint } from "./village-character-art";
import { createCharacterLimbSurface } from "./character-limb-surface";
import { createVillageCharacterGait, type VillageGroundHeight } from "./village-character-gait";

export type ClothSection = readonly [height: number, width: number, depth: number, forward?: number];
type Drape = (height: number, angle: number) => number;

export function clothSectionAt(sections: readonly ClothSection[], y: number): ClothSection {
  const at = sections.findIndex(row => row[0] >= y);
  if (at <= 0) {
    const [, width, depth, forward] = at === 0 ? sections[0] : sections[sections.length - 1];
    return [y, width, depth, forward];
  }
  const a = sections[at - 1], b = sections[at], t = (y - a[0]) / (b[0] - a[0]);
  return [y, THREE.MathUtils.lerp(a[1], b[1], t), THREE.MathUtils.lerp(a[2], b[2], t), THREE.MathUtils.lerp(a[3] ?? 0, b[3] ?? 0, t)];
}

export function clothPoint([y, width, depth, forward = 0]: ClothSection, angle: number, drape?: Drape): CharacterPoint {
  const billow = drape?.(y, angle) ?? 0;
  return [(width + billow) * Math.sin(angle), y, forward + (depth + billow) * Math.cos(angle)];
}

export function garmentPanel(sections: readonly ClothSection[], sides: number, span: (height: number) => [number, number], drape?: Drape) {
  const vertices: number[] = [], indices: number[] = [], stride = sides + 1;
  for (const [row, section] of sections.entries()) {
    const [left, right] = span(section[0]);
    for (let i = 0; i <= sides; i++) {
      vertices.push(...clothPoint(section, THREE.MathUtils.lerp(left, right, i / sides), drape));
      if (!row || i === sides) continue;
      const a = (row - 1) * stride + i;
      indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function reshapeGarment(geometry: THREE.BufferGeometry, sculpt: (point: THREE.Vector3) => void) {
  const vertices = geometry.getAttribute("position"), point = new THREE.Vector3();
  for (let i = 0; i < vertices.count; i++) {
    point.fromBufferAttribute(vertices, i);
    sculpt(point);
    vertices.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function addCapVisor(a: Assembly, height: number, width: number, depth: number, extension: number, top: string, lining: string) {
  const point = (theta: number, panel: number, layer: number): CharacterPoint => {
    const fan = Math.abs(theta) / 1.32;
    const reach = extension * Math.cos(fan * Math.PI / 2) ** .8;
    return [(width + panel * reach * .35) * Math.sin(theta), height - .021 * fan ** 2 - .017 * panel + theta * .007 + layer,
      (depth + reach * panel) * Math.cos(theta)];
  };
  const rimDepth = .012, steps = 16, rows = 4;
  for (const layer of [0, -rimDepth]) {
    const vertices: number[] = [], triangles: number[] = [];
    for (let row = 0; row <= rows; row++) for (let j = 0; j <= steps; j++) {
      const theta = -1.32 + 2.64 * j / steps;
      vertices.push(...point(theta, row / rows, layer));
      if (row > 0 && j > 0) {
        const right = row * (steps + 1) + j, left = right - 1, previous = right - steps - 1;
        triangles.push(previous - 1, left, right, previous - 1, right, previous);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(layer === 0 ? triangles : triangles.reverse());
    geometry.computeVertexNormals();
    a.add(geometry, layer === 0 ? top : lining);
  }
  const hem = Array.from({ length: 7 }, (_, i) => point(-1.32 + i * .44, 1, -.005));
  a.sweep(hem, [.003, .006, .007, .007, .007, .006, .003], top, 6);
}

/** Elliptical pattern sections, e.g. a full heel and a raised, narrower instep. */
export function garmentVolume(sections: readonly ClothSection[], sides = 28, bandColor?: (height: number) => string, drape?: Drape) {
  const vertices: number[] = [], indices: number[] = [];
  for (const [row, section] of sections.entries()) {
    for (let col = 0; col < sides; col++) {
      const a = col * Math.PI * 2 / sides;
      vertices.push(...clothPoint(section, a, drape));
      if (!row) continue;
      const i = (row - 1) * sides + col, j = (row - 1) * sides + (col + 1) % sides;
      indices.push(i, j, i + sides, j, j + sides, i + sides);
    }
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  mesh.setIndex(indices);
  mesh.computeVertexNormals();
  if (!bandColor) return mesh;
  // Copy a ring only where the dye changes, keeping smooth normals at both edges.
  const sourceNormals = mesh.getAttribute("normal"), points: number[] = [], normals: number[] = [];
  const triangles: number[] = [], colors: number[] = [], color = new THREE.Color();
  const addRing = (row: number) => {
    const first = points.length / 3;
    for (let i = row * sides; i < (row + 1) * sides; i++) {
      points.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
      normals.push(sourceNormals.getX(i), sourceNormals.getY(i), sourceNormals.getZ(i));
      colors.push(color.r, color.g, color.b);
    }
    return first;
  };
  let dye = "", ring = 0;
  for (let band = 0; band < sections.length - 1; band++) {
    const nextDye = bandColor((sections[band][0] + sections[band + 1][0]) * .5);
    if (nextDye !== dye) {
      dye = nextDye;
      color.set(dye);
      ring = addRing(band);
    }
    const next = addRing(band + 1);
    for (let side = 0; side < sides; side++) {
      const adjacent = (side + 1) % sides;
      triangles.push(ring + side, ring + adjacent, next + side, ring + adjacent, next + adjacent, next + side);
    }
    ring = next;
  }
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  mesh.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  mesh.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  mesh.setIndex(triangles);
  return mesh;
}

type Costume = "loic" | "breton" | "fisherman";

export function addVillageShoe(a: Assembly, costume: Costume) {
  const rubberBoot = costume === "fisherman", shoe = costume === "loic";
  const welt = shoe ? "#e3c59c" : rubberBoot ? "#907044" : "#774e39";
  const toeFlatten = (_y: number, angle: number) => .009 * Math.cos(angle * 4) + (rubberBoot ? .005 : 0);
  a.add(garmentVolume([[-.105, 0, 0, .059], [-.105, .096, .151, .059], [-.101, .111, .164, .061],
    [-.079, .111, .167, .061], [-.072, .104, .161, .061]], 20, y => y < -.100 ? "#685740" : welt,
  (y, angle) => y <= -.105 ? 0 : toeFlatten(y, angle)), null);
  const profile: ClothSection[] = [[-.078, .104, .161, .061], [-.059, .110, .166, .063], [-.036, .106, .161, .060],
    [-.008, .098, .138, .049], [.014, .087, .109, .025], [.039, .082, .081, -.001]];
  if (rubberBoot) {
    profile.push([.081, .085, .088, -.005], [.113, .084, .087, -.009], [.167, .092, .087, -.011],
      [.172, .096, .089, -.010], [.190, .097, .091, -.011], [.199, .086, .083, -.011]);
  } else {
    profile.push([.056, .079, .073, -.002], [.069, .069, .064, -.002]);
  }
  a.add(garmentVolume(profile, 22, y => {
    if (rubberBoot) return y > .168 ? "#a98053" : "#32554a";
    if (shoe) return y < -.035 ? "#795e47" : "#b68b63";
    return y > .016 ? "#384235" : "#222e2b";
  }, (y, angle) => toeFlatten(y, angle) * (1 - THREE.MathUtils.smoothstep(y, -.027, .05))), null);
  if (shoe) for (let i = 0; i < 2; i++) {
    const y = .001 + i * .016, z = .144 - i * .020;
    a.sweep([[-.038, y, z], [0, y + .004, z + .025], [.038, y, z]], [.003, .005, .003], C.cream, 6);
  }
  if (costume === "breton") {
    a.sweep([[-.058, .003, .137], [0, .013, .177], [.058, .003, .137]], [.003, .008, .003], "#536250", 6);
  }
}

const widthAxis = new THREE.Vector3(1, 0, 0);
export function createVillageSleeve(parent: THREE.Object3D, material: THREE.Material, name: string, cut: "loic" | "fisherman", cloth: string, cuff: string) {
  const fisher = cut === "fisherman";
  const pattern = fisher
    ? [[-.12, 0, 0], [-.05, .058, .057], [.13, .101, .099], [.41, .113, .112], [.62, .103, .100], [.83, .099, .094],
      [.96, .099, .093], [1.12, .095, .092], [1.26, .092, .090], [1.28, .092, .090], [1.42, .086, .084], [1.44, .085, .084],
      [1.58, .082, .081], [1.60, .082, .081], [1.72, .074, .073], [1.74, .073, .072], [1.78, .067, .067],
      [1.80, .071, .070], [1.97, .064, .060], [2, .047, .046]]
    : [[-.12, 0, 0], [-.08, .041, .040], [.04, .097, .095], [.26, .112, .100], [.50, .098, .094],
      [.76, .087, .084], [.91, .078, .077], [1, .081, .081], [1.12, .085, .083], [1.35, .078, .074],
      [1.59, .076, .068], [1.71, .067, .061], [1.76, .060, .055], [1.78, .068, .062],
      [1.91, .066, .060], [1.97, .059, .053], [2, .042, .039]];
  const rings = pattern.map(([at, width, depth]) => ({
    at, width, depth, color: at >= 1.78 ? cuff : fisher && ((at >= 1.28 && at <= 1.42) || (at >= 1.60 && at <= 1.72)) ? "#ead7ae" : cloth,
  }));
  const sleeve = createCharacterLimbSurface(parent, material, name, rings, 12, .27);
  const start = new THREE.Vector3(), elbow = new THREE.Vector3(), wrist = new THREE.Vector3();
  return (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) =>
    sleeve.pose(start.set(ax, ay, az), elbow.set(bx, by, bz), wrist.set(cx, cy, cz), widthAxis);
}

export function villageTrouserPattern(cloth: string, hem: string, cut: Costume) {
  // Loïc's pullover extends over the seat. Taper the hidden thigh into the
  // pelvis so that turning the knit around the stationary hips keeps a clean hem.
  const seat = cut === "loic"
    ? [[-.14, .042, .050], [-.03, .059, .068], [.18, .085, .092], [.34, .102, .108]]
    : [[-.18, .081, .085], [-.03, .117, .132], [.18, .117, .125]];
  const legs = cut === "fisherman"
    ? [[.47, .126, .131], [.75, .117, .115], [.92, .115, .120], [1.04, .117, .111],
      [1.17, .103, .097], [1.42, .091, .089], [1.73, .079, .077], [1.96, .064, .064]]
    : [[.47, .106, .112], [.74, .099, .101], [.93, .095, .102], [1.05, .090, .093], [1.23, .086, .087],
      [1.55, .083, .080], [1.72, .078, .072], [1.80, .084, .079], [1.94, .080, .073], [1.97, .071, .066]];
  return [...seat, ...legs].map(([at, width, depth]) => ({ at, width, depth, color: at >= 1.8 ? hem : cloth }));
}

export function createVillageTrousers(object: THREE.Group, material: THREE.Material, name: "breton" | "loic", groundAt?: VillageGroundHeight) {
  const guide = name === "loic", cloth = guide ? C.teal : C.dark;
  const upperLength = guide ? .32 : .28, lowerLength = .32;
  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(), knee = new THREE.Group(), ankle = new THREE.Group();
    hip.name = name + "-leg-" + side;
    ankle.name = name + "-ankle-" + side;
    hip.position.set(side * .119, guide ? .73 : .69, 0);
    knee.position.y = -upperLength; ankle.position.y = -lowerLength;
    object.add(hip); hip.add(knee); knee.add(ankle);
    const clothLeg = createCharacterLimbSurface(object, material, name + "-trouser-" + side,
      villageTrouserPattern(cloth, guide ? "#37766e" : "#3a4841", name), 12, .23);
    const shoe = new Assembly();
    addVillageShoe(shoe, name);
    shoe.finish(guide ? "loic-grounded-shoe" : "breton-grounded-foot", ankle, material);
    return { hip, knee, ankle, clothLeg };
  });
  const ground = groundAt && { root: object, heightAt: groundAt };
  const gait = createVillageCharacterGait({ left: legs[0], right: legs[1], upperLength, lowerLength, soleHeight: .105, ground });
  const kneePos = new THREE.Vector3(), anklePos = new THREE.Vector3();
  function update(stride: number, amount: number) {
    const height = gait(stride, amount);
    update.stride = gait.stride;
    for (const leg of legs) {
      kneePos.copy(leg.knee.position).applyQuaternion(leg.hip.quaternion).add(leg.hip.position);
      anklePos.copy(leg.ankle.position).applyQuaternion(leg.knee.quaternion).applyQuaternion(leg.hip.quaternion).add(kneePos);
      leg.clothLeg.pose(leg.hip.position, kneePos, anklePos, widthAxis);
    }
    return height;
  }
  update.stride = 0;
  return update;
}

/** Flared base slips under the collar and a narrower throat enters the jaw. */
export function addVillageNeck(body: Assembly, y: number, height: number, width: number) {
  const shape: ClothSection[] = [[0, 1.48, 1.11], [.18, 1.08, 1.03], [.46, .93, .96], [.78, .99, .97], [1, 1.09, 1.02]];
  body.add(garmentVolume(shape.map(([h, x, z]) => [y + h * height, width * x, width * z, -.005 * (1 - h)])), C.skin);
}

export function knitRib(a: Assembly, y: number, rx: number, rz: number, height: number, color: string) {
  // Paired stitches follow the knit band and catch grazing light at portrait distance.
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, points: CharacterPoint[] = [];
    for (const [f, drift] of [[0, -.012], [.50, .014], [1, -.018]]) {
      points.push([rx * Math.sin(angle + drift), y + f * height, rz * Math.cos(angle + drift)]);
    }
    a.sweep(points, [.0016, .0032, .0016], color, 5);
  }
}
