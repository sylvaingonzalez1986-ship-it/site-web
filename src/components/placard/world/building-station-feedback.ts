import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { InteriorObject } from "./interior-types";

function roundedPlate(path: THREE.Path, w: number, d: number, radius: number) {
  const x = w / 2, y = d / 2;
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius);
  path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y);
  path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius);
  path.quadraticCurveTo(-x, -y, -x + radius, -y);
  return path;
}

function trim(w: number, d: number, thickness: number, color: number) {
  const border = new THREE.Shape();
  roundedPlate(border, w, d, .2);
  border.holes.push(roundedPlate(new THREE.Path(), w - thickness * 2, d - thickness * 2, .13));
  return new THREE.Mesh(new THREE.ShapeGeometry(border, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
}

export function createStationHalo(object: InteriorObject) {
  const group = new THREE.Group();
  const width = object.width + .42, depth = object.depth + .42;
  const rim = trim(width, depth, .17, 0x123e3c);
  const face = trim(width - .086, depth - .086, .085, 0xffdf87);
  face.position.z = .002;
  group.add(rim, face);
  group.rotation.x = -Math.PI / 2;
  group.position.set(object.x, .078, object.z);
  group.visible = false;
  return group;
}

function createContactShadowMaterial() {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distance = Math.hypot((x + .5) * 2 / size - 1, (y + .5) * 2 / size - 1);
    const index = (y * size + x) * 4;
    pixels.fill(255, index, index + 3);
    pixels[index + 3] = Math.round(Math.max(0, 1 - distance * distance) ** 2 * 125);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ color: 0x352812, map: texture, transparent: true, depthWrite: false, toneMapped: false });
}

export function addContactShadows(model: THREE.Group, objects: InteriorObject[]) {
  const planes = objects.filter(object => object.href && object.kind !== "exit").map(object => (
    new THREE.PlaneGeometry(object.width * 1.6, object.depth * 1.63)
      .rotateX(-Math.PI / 2)
      .translate(object.x + .055, .024, object.z + .07)
  ));
  if (!planes.length) return;
  const geometry = mergeGeometries(planes);
  planes.forEach(plane => plane.dispose());
  if (geometry) model.add(new THREE.Mesh(geometry, createContactShadowMaterial()));
}
