import * as THREE from "three";

/** The distant plant preserves the pointed silhouette and folded midribs of
 * the plan sprite with four triangles per leaf. Its origin is the crown. */
export function makeDistantPlantCrown() {
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let leaf = 0; leaf < 7; leaf++) {
    const angle = leaf * Math.PI * 2 / 7;
    const dx = Math.sin(angle), dz = Math.cos(angle), length = leaf % 2 ? .85 : 1;
    const base = vertices.length / 3;
    for (const [along, across, height, shade] of [
      [0, 0, 0, 1.04], [.48, -.18, -.16, .71], [.5, 0, .12, 1.20],
      [.48, .18, -.16, .89], [1, 0, -.58, .86],
    ]) {
      vertices.push(dx * along * length + dz * across, height * length, dz * along * length - dx * across);
      colors.push(shade, shade, shade * .94);
    }
    for (const index of [0, 1, 2, 0, 2, 3, 2, 1, 4, 3, 2, 4]) indices.push(base + index);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
