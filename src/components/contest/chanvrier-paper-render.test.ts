import * as THREE from "three";
import { expect, it } from "vitest";
import { paintChanvrierMesh } from "./chanvrier-paper-render";

it("preserves the sculpted portrait's vertex pigments in its software projection", () => {
  const image = { data: new Uint8ClampedArray(12 * 12 * 4) };
  const canvas = { width: 12, height: 12, getContext: () => ({
    createImageData: () => image, putImageData: () => {},
  }) } as unknown as HTMLCanvasElement;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-.9, -.9, 0, .9, -.9, 0, 0, .9, 0], 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const root = new THREE.Group().add(new THREE.Mesh(geometry, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 2;
  camera.updateMatrixWorld();
  paintChanvrierMesh(canvas, root, camera);
  const centre = 4 * (7 * 12 + 6);
  expect(image.data[centre + 3]).toBe(255);
  expect(Array.from(image.data.slice(centre, centre + 3)).every(channel => channel > 30)).toBe(true);
  expect(image.data[3]).toBe(0);
  geometry.dispose();
  material.dispose();
});

it("uses the posed silhouette and normals for expressions in the software portrait", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-.95, -.65, 0, -.05, -.65, 0, -.5, .65, 0], 3));
  geometry.computeVertexNormals();
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3)];
  geometry.morphAttributes.normal = [new THREE.Float32BufferAttribute([0, 0, -2, 0, 0, -2, 0, 0, -2], 3)];
  const material = new THREE.MeshStandardMaterial({ color: "#888888" });
  const mesh = new THREE.Mesh(geometry, material);
  const root = new THREE.Group().add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 2;
  camera.updateMatrixWorld();
  let pixels = new Uint8ClampedArray(0);
  const canvas = { width: 32, height: 32, getContext: () => ({
    createImageData: () => ({ data: pixels = new Uint8ClampedArray(32 * 32 * 4) }), putImageData: () => {},
  }) } as unknown as HTMLCanvasElement;
  const left = (18 * 32 + 8) * 4, right = left + 16 * 4;
  paintChanvrierMesh(canvas, root, camera);
  expect(pixels[left + 3]).toBe(255);
  const lit = pixels[left];
  mesh.morphTargetInfluences![0] = 1;
  paintChanvrierMesh(canvas, root, camera);
  expect(pixels[left + 3]).toBe(0);
  expect(pixels[right + 3]).toBe(255);
  expect(pixels[right]).toBeLessThan(lit);
  geometry.dispose();
  material.dispose();
});
