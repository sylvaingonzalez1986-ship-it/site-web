import * as THREE from "three";
import { noCharacterHit } from "./village-character-art";

export type CharacterLimbRing = {
  at: number;
  width: number;
  depth?: number;
  color: string;
};

/** A tapered surface with one continuous bend. Ring coordinates 0, 1 and 2 are the three pivots. */
export function createCharacterLimbSurface(
  parent: THREE.Object3D,
  material: THREE.Material,
  name: string,
  rings: readonly CharacterLimbRing[],
  sides = 12,
  jointBlend = .20,
  fabricAtJoint = true,
) {
  const geometry = new THREE.BufferGeometry();
  const count = rings.length * sides;
  const vertex = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const normal = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const colors = new Float32Array(count * 3);
  const pigment = new THREE.Color();
  const indices: number[] = [];
  const cos = new Float32Array(sides), sin = new Float32Array(sides);
  const folds = rings.map(({ at }) => fabricAtJoint ? Math.exp(-((at - 1) ** 2) / .052) * Math.cos((at - 1) * 24) : 0);
  for (let side = 0; side < sides; side++) {
    const angle = side * 2 * Math.PI / sides;
    cos[side] = Math.cos(angle);
    sin[side] = Math.sin(angle);
  }
  for (const [row, ring] of rings.entries()) {
    pigment.set(ring.color);
    for (let side = 0; side < sides; side++) {
      const a = row * sides + side;
      pigment.toArray(colors, a * 3);
      if (row + 1 === rings.length) continue;
      const b = row * sides + (side + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  geometry.setAttribute("position", vertex);
  geometry.setAttribute("normal", normal);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.boundingBox = new THREE.Box3();
  geometry.boundingSphere = new THREE.Sphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.raycast = noCharacterHit;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  const upper = new THREE.Vector3(), lower = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const center = new THREE.Vector3(), axis = new THREE.Vector3(), previousAxis = new THREE.Vector3();
  const widthAxis = new THREE.Vector3(), depthAxis = new THREE.Vector3(), point = new THREE.Vector3();
  const meridian = new THREE.Vector3(), parallel = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const compression = new THREE.Vector3(), lowerDirection = new THREE.Vector3();
  const previous = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let previousWidth = NaN, previousDepth = NaN;

  function pose(start: THREE.Vector3, joint: THREE.Vector3, end: THREE.Vector3, reference: THREE.Vector3, widthScale = 1, depthScale = widthScale) {
    if (previousWidth === widthScale && previousDepth === depthScale && start.equals(previous[0]) &&
        joint.equals(previous[1]) && end.equals(previous[2]) && reference.equals(previous[3])) return;
    previous[0].copy(start); previous[1].copy(joint); previous[2].copy(end); previous[3].copy(reference);
    previousWidth = widthScale;
    previousDepth = depthScale;
    const bounds = geometry.boundingBox!.makeEmpty();
    upper.subVectors(joint, start);
    lower.subVectors(end, joint);
    // Fabric gathers on the inside of a bent knee or elbow. Opposite fibres stay taut.
    compression.copy(upper).normalize().negate().add(lowerDirection.copy(lower).normalize());
    a.copy(joint).addScaledVector(upper, -jointBlend);
    b.copy(joint).addScaledVector(lower, jointBlend);
    for (const [row, ring] of rings.entries()) {
      const { at, width, depth = width } = ring;
      if (at <= 1 - jointBlend) {
        center.copy(start).addScaledVector(upper, at);
        axis.copy(upper);
      } else if (at >= 1 + jointBlend) {
        center.copy(joint).addScaledVector(lower, at - 1);
        axis.copy(lower);
      } else {
        const t = (at - 1 + jointBlend) / (2 * jointBlend), u = 1 - t;
        center.copy(a).multiplyScalar(u * u).addScaledVector(joint, 2 * u * t).addScaledVector(b, t * t);
        axis.copy(upper).multiplyScalar(u).addScaledVector(lower, t);
      }
      if (axis.lengthSq() < 1e-10) axis.copy(upper.lengthSq() > 1e-10 ? upper : lower);
      if (axis.lengthSq() < 1e-10) axis.set(0, -1, 0);
      axis.normalize();
      if (row === 0) {
        widthAxis.copy(reference).addScaledVector(axis, -reference.dot(axis));
        if (widthAxis.lengthSq() < 1e-8) {
          widthAxis.set(Math.abs(axis.x) < .8 ? 1 : 0, 0, Math.abs(axis.x) < .8 ? 0 : 1);
          widthAxis.addScaledVector(axis, -widthAxis.dot(axis));
        }
        widthAxis.normalize();
      } else widthAxis.applyQuaternion(rotation.setFromUnitVectors(previousAxis, axis));
      previousAxis.copy(axis);
      depthAxis.crossVectors(axis, widthAxis);
      const pressWidth = compression.dot(widthAxis), pressDepth = compression.dot(depthAxis);
      for (let side = 0; side < sides; side++) {
        const facing = Math.min(1, Math.max(0, cos[side] * pressWidth + sin[side] * pressDepth));
        const thickness = 1 - .18 * folds[row] * facing;
        point.copy(center).addScaledVector(widthAxis, cos[side] * width * widthScale * thickness)
          .addScaledVector(depthAxis, sin[side] * depth * depthScale * thickness);
        point.set(Math.fround(point.x), Math.fround(point.y), Math.fround(point.z));
        vertex.setXYZ(row * sides + side, point.x, point.y, point.z);
        bounds.expandByPoint(point);
      }
    }
    for (let row = 0; row < rings.length; row++) {
      const top = Math.max(0, row - 1) * sides, bottom = Math.min(rings.length - 1, row + 1) * sides;
      const rim = row * sides;
      for (let side = 0; side < sides; side++) {
        const before = rim + (side + sides - 1) % sides, after = rim + (side + 1) % sides;
        parallel.fromBufferAttribute(vertex, after).sub(point.fromBufferAttribute(vertex, before));
        if (parallel.lengthSq() < 1e-12) {
          const adjacent = row === 0 ? bottom : top;
          parallel.fromBufferAttribute(vertex, adjacent + (side + 1) % sides)
            .sub(point.fromBufferAttribute(vertex, adjacent + (side + sides - 1) % sides));
        }
        meridian.fromBufferAttribute(vertex, bottom + side).sub(point.fromBufferAttribute(vertex, top + side));
        point.crossVectors(parallel, meridian).normalize();
        normal.setXYZ(rim + side, point.x, point.y, point.z);
      }
    }
    vertex.needsUpdate = true;
    normal.needsUpdate = true;
    bounds.getBoundingSphere(geometry.boundingSphere!);
  }

  return { mesh, pose };
}
