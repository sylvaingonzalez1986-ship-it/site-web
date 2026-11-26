import * as THREE from "three";

export function recomputeLatheNormals(geometry: THREE.LatheGeometry) {
  geometry.computeVertexNormals();
  const { points, segments } = geometry.parameters;
  const normals = geometry.getAttribute("normal");
  const first = new THREE.Vector3(), last = new THREE.Vector3();
  // Three stores an extra ring at 2π for the UV seam. Rejoin the normals
  // after reshaping the revolved surface so the join does not catch light.
  for (let row = 1; row < points.length - 1; row++) {
    const seam = segments * points.length + row;
    first.fromBufferAttribute(normals, row).add(last.fromBufferAttribute(normals, seam)).normalize();
    normals.setXYZ(row, first.x, first.y, first.z);
    normals.setXYZ(seam, first.x, first.y, first.z);
  }
}
