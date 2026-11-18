import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeDistantPlantCrown } from "./KqGrowRoomCanopy";
export type Point3 = [
  number,
  number,
  number
];
export type Metal = "steel" | "wood" | "plastic" | "soil" | "leaf" | "flower" | "stone" | "glass" | "light" | "shadow" | "wall" | "floor" | "net" | "jar";
type Shape = "box" | "tube" | "pot" | "drum" | "ring" | "disk" | "oval" | "fan" | "crown" | "cola" | "sleeve";
const up = new THREE.Vector3(0, 1, 0);
const identity = new THREE.Quaternion();
export function randomFrom(seed: number) {
  let cursor = seed >>> 0;
  return () => { cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0; return cursor / 4294967296; };
}
function leafFan() {
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  // Leaflets fold from a raised midrib, taper into serrated teeth and droop near the tip.
  for (let leaflet = -3; leaflet <= 3; leaflet++) {
    const angle = leaflet * .31, length = 1 - Math.abs(leaflet) * .16, base = vertices.length / 3;
    for (let segment = 0; segment <= 16; segment++) {
      const t = segment / 16, breadth = Math.pow(Math.sin(t * Math.PI), .84) * (.116 - Math.abs(leaflet) * .007) * (segment % 2 === 0 ? .77 : 1);
      for (const side of [-1, 0, 1]) {
        const along = t * length, across = side * breadth;
        vertices.push(Math.sin(angle) * along + Math.cos(angle) * across, .21 * Math.sin(t * Math.PI) - .24 * t * t - (Math.abs(side) * breadth * .65), Math.cos(angle) * along - Math.sin(angle) * across);
        const value = side === 0 ? 1.16 : side < 0 ? .87 : .98;
        colors.push(value, value, value * .94);
      }
      if (segment < 16)
        for (let strip = 0; strip < 2; strip++) {
          const a = base + segment * 3 + strip;
          indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
        }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function flowerColumn() {
  const parts: THREE.BufferGeometry[] = [];
  for (let ring = 0; ring < 5; ring++) {
    const t = ring / 5, radius = .29 * (1 - t * .8);
    for (let side = 0; side < 5; side++) {
      const a = side * Math.PI * 2 / 5 + ring * 1.3, size = .20 * (1 - t * .6);
      const part = new THREE.IcosahedronGeometry(size, 0);
      part.scale(1, 1.55, .82);
      part.rotateZ(Math.cos(a) * .35);
      part.translate(Math.sin(a) * radius, t + .15, Math.cos(a) * radius);
      const colors = new Float32Array(part.attributes.position.count * 3);
      const value = .80 + .18 * Math.sin(a * 1.2 + ring);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = value * 1.08;
        colors[i + 1] = value;
        colors[i + 2] = value * .86;
      }
      part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      parts.push(part);
    }
  }
  const shape = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return shape;
}
function texture(kind: "wood" | "wall" | "floor" | "shadow" | "net") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!, rng = randomFrom(kind === "wood" ? 82 : kind === "wall" ? 9 : 47);
  if (kind === "net") {
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#e3e3e3";
    ctx.lineWidth = 2.8;
    for (let i = -256; i < 512; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  }
  else if (kind === "shadow") {
    const grad = ctx.createRadialGradient(128, 128, 3, 128, 128, 123);
    grad.addColorStop(0, "rgba(36,43,35,.46)");
    grad.addColorStop(.55, "rgba(42,46,34,.24)");
    grad.addColorStop(1, "rgba(53,47,29,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  else {
    ctx.fillStyle = kind === "floor" ? "#e9e8df" : "#faf8ee";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = rng() > .45 ? "rgba(87,72,50,.06)" : "rgba(255,255,249,.26)";
      ctx.fillRect(rng() * 256, rng() * 256, rng() * 2 + .5, rng() * 1.7 + .5);
    }
    if (kind === "wood")
      for (let j = 0; j < 80; j++) {
        const y = rng() * 256;
        ctx.strokeStyle = "rgba(113,79,53," + (.08 + rng() * .16) + ")";
        ctx.lineWidth = rng() * 1.3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(62, y + rng() * 9, 156, y - rng() * 13, 256, y + rng() * 5);
        ctx.stroke();
      }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
export function createRoomResources() {
  const floor = texture("floor"), timber = texture("wood"), plaster = texture("wall"), contact = texture("shadow"), net = texture("net");
  const standard = (props: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: .79, ...props });
  const materials: Record<Metal, THREE.Material> = {
    steel: standard({ metalness: .49, roughness: .37 }), wood: standard({ map: timber, roughness: .88 }), plastic: standard({ roughness: .51 }),
    soil: standard({ roughness: 1 }), leaf: standard({ side: THREE.DoubleSide, vertexColors: true, roughness: .74 }),
    flower: standard({ vertexColors: true, roughness: 1 }), stone: standard({ roughness: .95 }), wall: standard({ map: plaster, roughness: .96 }),
    floor: standard({ map: floor, roughness: .94 }), glass: standard({ metalness: .18, roughness: .23 }), light: new THREE.MeshBasicMaterial({ color: "#fff6ca" }),
    net: standard({ side: THREE.DoubleSide, alphaMap: net, transparent: true, opacity: .53, depthWrite: false }),
    jar: standard({ side: THREE.FrontSide, transparent: true, opacity: .30, roughness: .16, metalness: .14, depthWrite: false }),
    shadow: new THREE.MeshBasicMaterial({ map: contact, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  };
  const shapes: Record<Shape, THREE.BufferGeometry> = {
    box: new THREE.BoxGeometry(1, 1, 1), tube: new THREE.CylinderGeometry(.5, .5, 1, 12),
    pot: new THREE.CylinderGeometry(.52, .39, 1, 16), drum: new THREE.CylinderGeometry(.48, .46, 1, 18),
    ring: new THREE.TorusGeometry(.5, .035, 5, 20).rotateX(Math.PI / 2), disk: new THREE.CircleGeometry(.5, 20).rotateX(-Math.PI / 2),
    oval: new THREE.IcosahedronGeometry(.5, 1), fan: leafFan(), crown: makeDistantPlantCrown(), cola: flowerColumn(), sleeve: new THREE.CylinderGeometry(.5, .5, 1, 24, 1, true)
  };
  const shadowPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  return { materials, shapes, floor, shadowPlane, dispose() { Object.values(shapes).forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose()); [floor, timber, plaster, contact, net].forEach(t => t.dispose()); shadowPlane.dispose(); } };
}
export type RoomResources = ReturnType<typeof createRoomResources>;
/** Static parts share geometry, material and per-instance pigment. Changes to one station leave its neighbours intact. */
export class RoomBatch {
  private batches = new Map<string, {
    shape: Shape;
    material: Metal;
    feature?: string;
    matrices: THREE.Matrix4[];
    colors: THREE.Color[];
  }>();
  private offset: Point3 = [0, 0, 0];
  constructor(private res: RoomResources) { }
  at(x: number, z: number) { this.offset = [x, 0, z]; }
  part(shape: Shape, material: Metal, color: string, position: Point3, size: Point3, rotation?: Point3 | THREE.Quaternion, feature?: string) {
    const key = [shape, material, feature].join(":");
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { shape, material, feature, matrices: [], colors: [] };
      this.batches.set(key, batch);
    }
    const q = Array.isArray(rotation) ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)) : rotation ?? identity;
    batch.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(position[0] + this.offset[0], position[1], position[2] + this.offset[2]), q, new THREE.Vector3(...size)));
    batch.colors.push(new THREE.Color(color));
  }
  box(material: Metal, color: string, x: number, y: number, z: number, w: number, h: number, d: number, feature?: string) { this.part("box", material, color, [x, y, z], [w, h, d], undefined, feature); }
  rod(material: Metal, color: string, a: Point3, b: Point3, r: number) {
    const aa = new THREE.Vector3(...a), bb = new THREE.Vector3(...b), vec = bb.clone().sub(aa), length = vec.length();
    if (length < .001)
      return;
    this.part("tube", material, color, aa.add(bb).multiplyScalar(.5).toArray() as Point3, [r * 2, length, r * 2], new THREE.Quaternion().setFromUnitVectors(up, vec.normalize()));
  }
  shadow(x: number, z: number, width: number, depth: number, y = .018) { this.part("disk", "shadow", "#ffffff", [x, y, z], [width, 1, depth]); }
  finish() {
    const group = new THREE.Group();
    for (const batch of this.batches.values()) {
      const shade = batch.material === "shadow";
      const mesh = new THREE.InstancedMesh(shade ? this.res.shadowPlane : this.res.shapes[batch.shape], this.res.materials[batch.material], batch.matrices.length);
      mesh.name = batch.feature ?? "";
      batch.matrices.forEach((matrix, i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, batch.colors[i]); });
      mesh.castShadow = !shade && batch.material !== "glass" && batch.material !== "light";
      mesh.receiveShadow = !shade;
      mesh.renderOrder = shade ? 1 : 0;
      group.add(mesh);
    }
    return group;
  }
}
