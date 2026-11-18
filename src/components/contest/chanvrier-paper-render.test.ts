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
