import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type CharacterPoint = [number, number, number];
export const CHARACTER_COLORS = {
  ink: "#294942", dark: "#263734", cream: "#fff0ca", skin: "#edbd89",
  teal: "#087f7c", wood: "#c69658", gold: "#e9b54b", hair: "#655247",
  tan: "#cfa173", blush: "#d99575", wine: "#672d40",
};
export const noCharacterHit: THREE.Object3D["raycast"] = () => {};
const UP = new THREE.Vector3(0, 1, 0);

/** One vertex-coloured draw call per articulated part. Consumes all source geometry. */
export class Assembly {
  private pieces: THREE.BufferGeometry[] = [];

  add(geometry: THREE.BufferGeometry, color: string, at: CharacterPoint = [0, 0, 0]) {
    geometry.translate(...at);
    geometry.deleteAttribute("uv");
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    const pigment = new THREE.Color(color), count = flat.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pigment.toArray(colors, i * 3);
    flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.pieces.push(flat);
  }

  ball(at: CharacterPoint, radius: number, color: string, scale: CharacterPoint = [1, 1, 1]) {
    this.add(new THREE.SphereGeometry(radius, 12, 8).scale(...scale), color, at);
  }

  box(at: CharacterPoint, size: CharacterPoint, color: string) {
    this.add(new THREE.BoxGeometry(...size), color, at);
  }

  rod(from: CharacterPoint, to: CharacterPoint, radius: number, color: string, top = radius) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const geometry = new THREE.CylinderGeometry(top, radius, a.distanceTo(b), 10);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
    this.add(geometry, color, a.add(b).multiplyScalar(0.5).toArray() as CharacterPoint);
  }

  /** A tapered continuous stroke for cloth folds, fingers and ink lines. */
  sweep(points: CharacterPoint[], radii: number[], color: string, sides = 10) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const segments = (points.length - 1) * 3;
    const frames = curve.computeFrenetFrames(segments, false), length = curve.getLength();
    const vertices: number[] = [], indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const distance = i / segments, t = curve.getUtoTmapping(distance, distance * length);
      const knot = t * (points.length - 1), j = Math.min(points.length - 2, Math.floor(knot));
      const radius = THREE.MathUtils.lerp(radii[j], radii[j + 1], knot - j);
      const center = curve.getPoint(t);
      for (let k = 0; k < sides; k++) {
        const angle = 2 * Math.PI * k / sides;
        const vertex = center.clone().addScaledVector(frames.normals[i], radius * Math.cos(angle))
          .addScaledVector(frames.binormals[i], radius * Math.sin(angle));
        vertices.push(vertex.x, vertex.y, vertex.z);
        if (!i) continue;
        const a = (i - 1) * sides + k, b = (i - 1) * sides + (k + 1) % sides;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    this.add(geometry, color);
  }

  finish(name: string, parent: THREE.Object3D, material: THREE.Material) {
    const geometry = mergeGeometries(this.pieces, false);
    this.pieces.forEach(piece => piece.dispose()); this.pieces = [];
    if (!geometry) throw new Error(`Cannot merge ${name}`);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.raycast = noCharacterHit;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
}

export function characterMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 });
}

/** A single turned sleeve per segment, with rounded ends overlapping at the elbow. */
export function createCharacterLimbs(parent: THREE.Object3D, count: number, color: string, prefix: string) {
  const profile = [[0, -0.67], [0.58, -0.63], [0.94, -0.54], [1.06, -0.37], [1.01, -0.16],
    [0.93, 0.12], [0.82, 0.35], [0.86, 0.41], [0.83, 0.48], [0.65, 0.55], [0, 0.59]];
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.94 });
  const parts = Array.from({ length: count }, (_, index) => {
    const bone = new THREE.Mesh(geometry, material);
    bone.name = `${prefix}-${index}`; bone.raycast = noCharacterHit; bone.castShadow = true;
    parent.add(bone); return bone;
  });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), direction = new THREE.Vector3();
  return {
    set(index: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number) {
      const bone = parts[index];
      a.set(ax, ay, az); b.set(bx, by, bz); direction.subVectors(b, a);
      bone.position.copy(a).add(b).multiplyScalar(0.5);
      bone.scale.set(radius, Math.max(0.0001, direction.length()), radius);
      bone.quaternion.setFromUnitVectors(UP, direction.normalize());
    },
  };
}

/** Rounded, cleanly joined face. Hats and hair accents belong to each character. */
export function createCharacterFace(parent: THREE.Object3D, material: THREE.Material, name: string, hair = CHARACTER_COLORS.hair) {
  const head = new THREE.Group(); head.name = `${name}-head`; parent.add(head);
  const art = new Assembly();
  const profile = [[0, -0.06], [0.098, -0.045], [0.175, 0.006], [0.221, 0.073],
    [0.249, 0.148], [0.253, 0.214], [0.244, 0.277], [0.226, 0.326],
    [0.181, 0.378], [0.111, 0.42], [0, 0.437]];
  art.add(new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 28).scale(1, 1, 0.94), "#f3c99f");
  art.ball([0, 0.292, -0.076], 0.244, hair, [0.99, 0.72, 0.78]);
  for (const side of [-1, 1]) {
    art.ball([side * 0.241, 0.145, 0.003], 0.062, "#ecc098", [0.76, 1, 0.68]);
    art.ball([side * 0.253, 0.149, 0.032], 0.03, "#cd9172", [0.58, 0.78, 0.27]);
    art.sweep([[side * 0.22, 0.287, 0.058], [side * 0.239, 0.247, 0.027], [side * 0.235, 0.192, 0.009]],
      [0.018, 0.025, 0.006], hair);
  }
  art.ball([0, 0.163, 0.231], 0.05, "#efbc90", [1.06, 0.78, 0.84]);
  art.finish(`${name}-face`, head, material);
  const eyeArt = new Assembly();
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(1, 14, 8).scale(0.030, 0.047, 0.014)
      .rotateZ(side * 0.09).rotateY(side * 0.34);
    eyeArt.add(eye, "#201c1a", [side * 0.092, 0, 0.219]);
    eyeArt.ball([side * 0.092 - 0.005, 0.017, 0.232], 0.008, "#fff4db", [1, 0.92, 0.45]);
  }
  const eyes = eyeArt.finish(`${name}-eyes`, head, material); eyes.position.y = 0.227;
  const mouthArt = new Assembly();
  const smile = new THREE.Shape();
  smile.moveTo(-0.073, 0.014);
  smile.quadraticCurveTo(0.006, -0.003, 0.069, 0.022);
  smile.bezierCurveTo(0.048, -0.036, -0.031, -0.049, -0.073, 0.014);
  mouthArt.add(new THREE.ShapeGeometry(smile, 9), "#382329");
  const tongue = new THREE.Shape();
  tongue.moveTo(-0.033, -0.018); tongue.quadraticCurveTo(0, -0.002, 0.03, -0.017);
  tongue.quadraticCurveTo(0, -0.036, -0.033, -0.018);
  mouthArt.add(new THREE.ShapeGeometry(tongue, 7), "#d87a65", [0, 0, 0.001]);
  const mouth = mouthArt.finish(`${name}-mouth`, head, material); mouth.position.set(0, 0.078, 0.218);
  // Lay the printed smile against the slope of the chin, including its corners.
  const lips = mouth.geometry.getAttribute("position");
  for (let i = 0; i < lips.count; i++) {
    lips.setZ(i, lips.getZ(i) + lips.getY(i) * 0.54 - lips.getX(i) ** 2 * 1.9);
  }
  mouth.geometry.computeVertexNormals();
  const brows = [-1, 1].map(side => {
    const brow = new Assembly();
    brow.sweep([[side * -0.043, -0.002, 0.012], [side * -0.012, 0.009, 0.005],
      [side * 0.022, 0.011, -0.008], [side * 0.047, -0.002, -0.021]], [0.008, 0.015, 0.013, 0.004], "#44342c");
    const mesh = brow.finish(`${name}-brow-${side}`, head, material);
    mesh.position.set(side * 0.092, 0.301, 0.201); return mesh;
  });
  const blinkOffset = (name.charCodeAt(0) % 11) * 0.25;
  function setExpression(time: number, reduced: boolean, attention: number, lookYaw: number, opening: number, accent = 0) {
    const phase = (time + blinkOffset) % 4.35;
    const blink = reduced ? 0 : Math.max(0, 1 - Math.abs(phase - 2.58) / 0.115);
    eyes.scale.y = (1 - blink * 0.94) * (1 - accent * 0.09);
    eyes.rotation.y = THREE.MathUtils.clamp(lookYaw, -0.9, 0.9) * 0.10;
    brows[0].position.y = 0.301 + attention * 0.019 + accent * 0.007;
    brows[1].position.y = 0.301 + attention * 0.009;
    brows[0].rotation.z = -attention * 0.12 - accent * 0.08;
    brows[1].rotation.z = accent * 0.16;
    mouth.scale.set(0.9 + opening * 0.16, 0.52 + opening * 1.28, 1);
    mouth.rotation.x = (1 - mouth.scale.y) * 0.44;
  }
  return { head, mouth, brows, eyes, setExpression };
}

/** Late traversal deliberately includes invisible hit targets added by the owner. */
export function characterDisposer(object: THREE.Group) {
  let disposed = false;
  return {
    get disposed() { return disposed; },
    dispose() {
      if (disposed) return; disposed = true;
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      object.traverse(child => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
        geometries.add(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
      });
      geometries.forEach(resource => resource.dispose()); materials.forEach(resource => resource.dispose());
      object.removeFromParent(); object.clear();
    },
  };
}

/** Exponential interpolation stays stable across the shared 15/30 Hz quality levels. */
export function characterEase(delta: number, reduced: boolean) {
  return reduced ? 1 : 1 - Math.exp(-Math.min(0.1, Math.max(0, delta)) * 9);
}
