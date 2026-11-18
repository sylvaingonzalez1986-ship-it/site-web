import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createVillageContactShadowGeometry } from "./village-contact-shadow";
import { VILLAGE_LIGHT } from "./village-lighting";

type XYZ = [number, number, number];
type Shape = { at: XYZ; size: XYZ; color: string; tilt?: number; resolution?: [number, number] };

const CHARCOAL = "#383942";
const FLEECE_SHADOW = "#2a292d";
const SKIN = "#484a54";
const HOOF = "#23242a";
export const SHEEP_HIP_Y = 0.45;
export const SHEEP_HIPS: readonly [number, number][] = [[-0.23, 0.34], [0.23, 0.34], [-0.23, -0.36], [0.23, -0.36]];
const HEAD_PIVOT: XYZ = [0, 0.66, 0.31];
const EAR_HINGE: XYZ = [0.126, 0.128, 0.2];
const JAW_HINGE: XYZ = [0, -0.055, 0.28];
const [LIGHT_X, LIGHT_HEIGHT, LIGHT_Z] = VILLAGE_LIGHT.key.position;
const SHADE_X = -LIGHT_X / LIGHT_HEIGHT, SHADE_Z = -LIGHT_Z / LIGHT_HEIGHT;
const SHADOW_INSTANCES = SHEEP_HIPS.length + 1;

function sculpt(shapes: readonly Shape[]) {
  const parts = shapes.map(({ at, size, color, tilt = 0, resolution = [8, 6] }) => {
    const geometry = new THREE.SphereGeometry(1, ...resolution);
    geometry.deleteAttribute("uv");
    const tint = new THREE.Color(color);
    const normals = geometry.getAttribute("normal"), colors = new Float32Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++) {
      const light = 0.91 + normals.getY(i) * 0.095;
      colors.set([tint.r * light, tint.g * light, tint.b * light], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry.scale(...size).rotateZ(tilt).translate(...at);
  });
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  return geometry;
}

function fleece(near: boolean) {
  const meridians = near ? 38 : 22, parallels = near ? 24 : 14;
  const shell = new THREE.SphereGeometry(1, meridians, parallels);
  shell.deleteAttribute("uv");
  const positions = shell.getAttribute("position"), colors = new Float32Array(positions.count * 3);
  const shadows = new THREE.Color(FLEECE_SHADOW), charcoal = new THREE.Color(CHARCOAL);
  const slate = new THREE.Color("#737b8a"), warmGrey = new THREE.Color("#746369");
  const pigment = new THREE.Color(), crestColor = new THREE.Color();
  const tufts = Array.from({ length: 27 }, (_, i) => {
    const z = 1 - 2 * (i + 0.5) / 27, r = Math.sqrt(1 - z * z), angle = i * 2.399963 + Math.sin(i * 1.6) * 0.14;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, z, relief: 0.77 + (i % 4) * 0.075, tint: (i % 7) / 6 };
  });
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    let nearest = -1, next = -1, relief = 0, woolTint = 0;
    for (const tuft of tufts) {
      const likeness = x * tuft.x + y * tuft.y + z * tuft.z;
      if (likeness > nearest) {
        next = nearest;
        nearest = likeness;
        relief = tuft.relief;
        woolTint = tuft.tint;
      } else next = Math.max(next, likeness);
    }
    // Each crest follows one lock of wool. The gap to its closest neighbour
    // carves a soft valley into the shared surface.
    const lock = THREE.MathUtils.smoothstep(nearest, 0.905, 0.985);
    const edge = THREE.MathUtils.smoothstep(nearest - next, 0, 0.066);
    const loft = lock * (0.22 + 0.78 * edge) * relief;
    const lit = THREE.MathUtils.smoothstep(y, -0.44, 0.9);
    const size = 0.945 + loft * (0.205 + lit * 0.063);
    const shoulder = THREE.MathUtils.smoothstep(z, 0.06, 0.83) * 0.047;
    positions.setXYZ(i, x * 0.395 * size, 0.651 + y * 0.351 * size + shoulder, -0.027 + z * 0.601 * size);
    crestColor.copy(slate).lerp(warmGrey, woolTint);
    const tint = 0.045 + 0.11 * lit + Math.min(0.69, loft * (0.64 + lit * 0.1));
    pigment.copy(shadows).lerp(charcoal, 0.48 + 0.32 * lit).lerp(crestColor, tint);
    pigment.toArray(colors, i * 3);
  }
  shell.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  shell.computeVertexNormals();
  // Equalize duplicated sphere vertices at the longitude seam and the poles.
  const normals = shell.getAttribute("normal"), normal = new THREE.Vector3();
  for (let row = 0; row <= parallels; row++) {
    const first = row * (meridians + 1), last = first + meridians;
    const pole = row === 0 || row === parallels, stride = pole ? 1 : meridians;
    normal.set(0, 0, 0);
    for (let index = first; index <= last; index += stride) {
      normal.x += normals.getX(index);
      normal.y += normals.getY(index);
      normal.z += normals.getZ(index);
    }
    normal.normalize();
    for (let index = first; index <= last; index += stride) normals.setXYZ(index, normal.x, normal.y, normal.z);
  }
  const tail = sculpt([{ at: [0, 0.629, -0.596], size: [0.105, 0.115, 0.126], color: "#444550", tilt: -0.24 }]);
  const geometry = mergeGeometries([shell, tail], false)!;
  shell.dispose();
  tail.dispose();
  return geometry;
}

const earShapes: Shape[] = [
  { at: [0.136, 0, 0], size: [0.176, 0.065, 0.052], color: "#575661", tilt: -0.08 },
  { at: [0.139, 0, 0.037], size: [0.132, 0.036, 0.019], color: "#8b737b", tilt: -0.08, resolution: [7, 5] },
];
const jawShapes: Shape[] = [
  { at: [0, -0.025, 0.158], size: [0.095, 0.052, 0.138], color: "#38353a", resolution: [8, 5] },
];

function face(near: boolean) {
  const shapes: Shape[] = [
    { at: [0, 0.005, 0.055], size: [0.157, 0.168, 0.226], color: CHARCOAL },
    { at: [0, 0.064, 0.239], size: [0.157, 0.159, 0.209], color: SKIN, resolution: near ? [11, 8] : [8, 6] },
    { at: [0, -0.032, 0.414], size: [0.107, 0.085, 0.169], color: "#635d65" },
    { at: [0, -0.064, 0.548], size: [0.099, 0.062, 0.067], color: HOOF },
    { at: [0, 0.186, 0.21], size: [0.148, 0.092, 0.174], color: "#565963" },
  ];
  for (const side of [-1, 1]) {
    shapes.push({ at: [side * 0.126, 0.09, 0.329], size: [0.039, 0.041, 0.038], color: "#242228", resolution: [7, 5] });
    if (near) {
      shapes.push(
        { at: [side * 0.149, 0.094, 0.349], size: [0.021, 0.023, 0.019], color: "#b2946f", resolution: [7, 5] },
        { at: [side * 0.161, 0.094, 0.359], size: [0.014, 0.009, 0.013], color: "#241f22", resolution: [6, 4] },
        { at: [side * 0.164, 0.101, 0.363], size: [0.006, 0.006, 0.006], color: "#e2d7bd", resolution: [5, 3] },
      );
    }
  }
  if (near) return sculpt(shapes);
  const posedFace = sculpt(shapes);
  const ear = sculpt(earShapes);
  const otherEar = ear.clone().rotateZ(Math.PI - 0.17).translate(-EAR_HINGE[0], EAR_HINGE[1], EAR_HINGE[2]);
  ear.rotateZ(0.17).translate(...EAR_HINGE);
  const jaw = sculpt(jawShapes).translate(...JAW_HINGE);
  const coarse = mergeGeometries([posedFace, ear, otherEar, jaw], false)!;
  [posedFace, ear, otherEar, jaw].forEach(part => part.dispose());
  return coarse;
}

type SheepPose = {
  root: THREE.Object3D;
  scale: number;
  bob: number;
  headPitch: number;
  headYaw: number;
  jawPitch: number;
  earAngles: readonly [number, number];
  feet: readonly { point: THREE.Vector3; lift: number }[];
};

export function createVillageSheepBatch(maxSheep: number) {
  const object = new THREE.Group();
  object.name = "village-sheep-instances";
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 });
  const shade = new THREE.MeshBasicMaterial({ color: "#304a36", vertexColors: true, transparent: true, opacity: 0.48, depthWrite: false });
  const batches: THREE.InstancedMesh[] = [];
  function batch(name: string, geometry: THREE.BufferGeometry, capacity = maxSheep, ink: THREE.Material = material) {
    const mesh = new THREE.InstancedMesh(geometry, ink, capacity);
    mesh.name = name;
    mesh.count = 0;
    mesh.frustumCulled = false; // The controller packs only camera-visible sheep.
    mesh.raycast = () => {};
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batches.push(mesh);
    object.add(mesh);
    return mesh;
  }
  const bodies = [batch("sheep-fleece-low", fleece(false)), batch("sheep-fleece-high", fleece(true))];
  const heads = [batch("sheep-face-low", face(false)), batch("sheep-face-high", face(true))];
  const ears = batch("sheep-ears", sculpt(earShapes), maxSheep * 2);
  const jaw = batch("sheep-jaw", sculpt(jawShapes));
  const legs = batch("sheep-legs", sculpt([
    { at: [0, -0.097, 0], size: [0.077, 0.151, 0.082], color: CHARCOAL },
    { at: [0, -0.235, -0.009], size: [0.052, 0.16, 0.052], color: SKIN, resolution: [6, 5] },
    { at: [0, -0.403, 0], size: [0.061, 0.047, 0.067], color: HOOF, resolution: [7, 5] },
  ]), maxSheep * 4);
  const shadow = batch("sheep-contact-shadow", createVillageContactShadowGeometry(), maxSheep * SHADOW_INSTANCES, shade);

  const art = new THREE.Object3D(), rootMatrix = new THREE.Matrix4(), headMatrix = new THREE.Matrix4(), legMatrix = new THREE.Matrix4();
  return {
    object,
    write(index: number, pose: SheepPose, detail: 0 | 1) {
      const { root, scale, bob, headPitch, headYaw, jawPitch, earAngles, feet } = pose;
      const { x, y, z } = root.position;
      const yaw = root.rotation.y, sin = Math.sin(yaw), cos = Math.cos(yaw);
      art.position.copy(root.position);
      art.rotation.set(0, yaw, 0);
      art.scale.setScalar(scale);
      art.updateMatrix();
      rootMatrix.copy(art.matrix);

      art.position.set(0, bob, 0);
      art.rotation.set(0, 0, 0);
      art.scale.setScalar(1);
      art.updateMatrix();
      bodies[detail].setMatrixAt(index, art.matrix.premultiply(rootMatrix));

      art.position.set(HEAD_PIVOT[0], HEAD_PIVOT[1] + bob, HEAD_PIVOT[2]);
      art.rotation.set(headPitch, headYaw, 0, "YXZ");
      art.updateMatrix();
      headMatrix.multiplyMatrices(rootMatrix, art.matrix);
      heads[detail].setMatrixAt(index, headMatrix);
      if (detail) {
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 1 : -1;
          art.position.set(side * EAR_HINGE[0], EAR_HINGE[1], EAR_HINGE[2]);
          art.rotation.set(0, 0, (side > 0 ? 0 : Math.PI) + earAngles[i]);
          art.updateMatrix();
          ears.setMatrixAt(index * 2 + i, art.matrix.premultiply(headMatrix));
        }
        art.position.set(...JAW_HINGE);
        art.rotation.set(jawPitch, 0, Math.sin(jawPitch * 12) * 0.018);
        art.updateMatrix();
        jaw.setMatrixAt(index, art.matrix.premultiply(headMatrix));
      }

      const shadowIndex = index * SHADOW_INSTANCES;
      const projectedHeight = (0.64 + bob) * scale;
      art.position.set(x + SHADE_X * projectedHeight, y + 0.006, z + SHADE_Z * projectedHeight);
      art.rotation.set(-Math.PI / 2, yaw, 0, "YXZ");
      art.scale.set(1.43 * scale, 1.87 * scale, 1);
      art.updateMatrix();
      shadow.setMatrixAt(shadowIndex, art.matrix);

      for (let i = 0; i < SHEEP_HIPS.length; i++) {
        const [hipX, hipZ] = SHEEP_HIPS[i], { point: foot, lift } = feet[i];
        const dx = (foot.x - x) / scale, dz = (foot.z - z) / scale;
        const soleX = dx * cos - dz * sin, soleZ = dx * sin + dz * cos, soleY = (foot.y - y) / scale;
        legMatrix.set(
          1, (hipX - soleX) / SHEEP_HIP_Y, 0, hipX,
          0, (SHEEP_HIP_Y + bob - soleY) / SHEEP_HIP_Y, 0, SHEEP_HIP_Y + bob,
          0, (hipZ - soleZ) / SHEEP_HIP_Y, 1, hipZ,
          0, 0, 0, 1,
        );
        legs.setMatrixAt(index * 4 + i, legMatrix.premultiply(rootMatrix));

        const contact = scale * (1 - THREE.MathUtils.smoothstep(lift, 0, 0.04));
        art.position.set(foot.x, foot.y - lift + 0.008, foot.z);
        art.scale.set(0.23 * contact, 0.27 * contact, 1);
        art.updateMatrix();
        shadow.setMatrixAt(shadowIndex + i + 1, art.matrix);
      }
    },
    commit(count: number, detail: 0 | 1) {
      bodies[1 - detail].count = heads[1 - detail].count = 0;
      bodies[detail].count = heads[detail].count = count;
      shadow.count = count * SHADOW_INSTANCES;
      legs.count = count * 4;
      ears.count = detail ? count * 2 : 0;
      jaw.count = detail ? count : 0;
      for (const mesh of batches) {
        mesh.visible = mesh.count > 0;
        if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of batches) mesh.dispose();
    },
  };
}
