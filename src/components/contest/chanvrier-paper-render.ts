import * as THREE from "three";
import { CHANVRIER_STUDIO_LIGHT } from "./chanvrier-studio-light";

type PortraitLight = {
  ambient: number; hemi: number; sky: string; ground: string; exposure: number;
  key: { color: string; power: number; position: readonly [number, number, number] };
  rim: { color: string; power: number; position: readonly [number, number, number] };
};

/** Static portrait fallback when the browser cannot open a WebGL context.
 * Orthographic projection and depth testing use the same posed meshes as the studio. */
export function paintChanvrierMesh(canvas: HTMLCanvasElement, root: THREE.Group, camera: THREE.Camera, light: PortraitLight = CHANVRIER_STUDIO_LIGHT) {
  const context = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const image = context.createImageData(width, height);
  const depth = new Float32Array(width * height).fill(Infinity);
  const sky = new THREE.Color(light.sky), ground = new THREE.Color(light.ground);
  const key = new THREE.Vector3(...light.key.position).normalize(), rim = new THREE.Vector3(...light.rim.position).normalize();
  const sunlight = new THREE.Color(light.key.color), rimlight = new THREE.Color(light.rim.color);
  const illumination = new THREE.Color(), pigment = new THREE.Color();
  const projected = new THREE.Matrix4(), view = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const normalMatrix = new THREE.Matrix3(), normal = new THREE.Vector3(), targetNormal = new THREE.Vector3();
  const vertex = new THREE.Vector3(), tint = new THREE.Color();
  root.traverseVisible(node => {
    if (!(node instanceof THREE.Mesh) || node instanceof THREE.InstancedMesh || Array.isArray(node.material) || node.material.transparent) return;
    const { geometry, material } = node;
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), colors = geometry.getAttribute("color");
    if (!positions || !normals) return;
    projected.multiplyMatrices(view, node.matrixWorld);
    normalMatrix.getNormalMatrix(node.matrixWorld);
    const coords = new Float32Array(positions.count * 3);
    const shades = new Uint8ClampedArray(positions.count * 3);
    const influences = node.morphTargetInfluences;
    const morphNormals: readonly (THREE.BufferAttribute | THREE.InterleavedBufferAttribute)[] = geometry.morphAttributes.normal ?? [];
    const activeNormals = morphNormals
      .map((attribute, index) => ({ attribute, weight: influences?.[index] ?? 0 }))
      .filter(target => target.weight !== 0);
    const baseWeight = geometry.morphTargetsRelative ? 1 : 1 - activeNormals.reduce((sum, target) => sum + target.weight, 0);
    for (let i = 0; i < positions.count; i++) {
      node.getVertexPosition(i, vertex).applyMatrix4(projected);
      coords[3*i] = (vertex.x + 1) * width / 2;
      coords[3*i+1] = (1 - vertex.y) * height / 2;
      coords[3*i+2] = vertex.z;
      normal.fromBufferAttribute(normals, i).multiplyScalar(baseWeight);
      for (const { attribute, weight } of activeNormals) {
        normal.addScaledVector(targetNormal.fromBufferAttribute(attribute, i), weight);
      }
      normal.applyNormalMatrix(normalMatrix);
      const sun = light.key.power * Math.max(0, normal.dot(key));
      const edge = light.rim.power * Math.max(0, normal.dot(rim));
      illumination.lerpColors(ground, sky, .5 + .5 * normal.y).multiplyScalar(light.hemi);
      illumination.r += light.ambient + sunlight.r * sun + rimlight.r * edge;
      illumination.g += light.ambient + sunlight.g * sun + rimlight.g * edge;
      illumination.b += light.ambient + sunlight.b * sun + rimlight.b * edge;
      tint.copy(material.color);
      if (colors && material.vertexColors) tint.multiply(pigment.fromBufferAttribute(colors, i));
      tint.multiply(illumination).multiplyScalar(light.exposure / Math.PI).convertLinearToSRGB();
      shades[3*i] = tint.r * 255;
      shades[3*i+1] = tint.g * 255;
      shades[3*i+2] = tint.b * 255;
    }
    const index = geometry.index;
    const count = index?.count ?? positions.count;
    const end = Math.min(count, geometry.drawRange.start + geometry.drawRange.count);
    for (let i = geometry.drawRange.start; i + 2 < end; i += 3) {
      const a = index?.getX(i) ?? i, b = index?.getX(i+1) ?? i+1, c = index?.getX(i+2) ?? i+2;
      const ax = coords[3*a], ay = coords[3*a+1], bx = coords[3*b], by = coords[3*b+1], cx = coords[3*c], cy = coords[3*c+1];
      const dx = bx-ax, dy = by-ay, ex = cx-ax, ey = cy-ay, area = dx*ey - ex*dy;
      if (area >= -.00001) continue;
      const left = Math.max(0, Math.floor(Math.min(ax,bx,cx))), right = Math.min(width-1, Math.ceil(Math.max(ax,bx,cx)));
      const top = Math.max(0, Math.floor(Math.min(ay,by,cy))), bottom = Math.min(height-1, Math.ceil(Math.max(ay,by,cy)));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        const px = x + .5 - ax, py = y + .5 - ay, u = (px*ey - py*ex)/area, v = (dx*py - dy*px)/area;
        if (u < 0 || v < 0 || u+v > 1) continue;
        const z = coords[3*a+2]*(1-u-v) + coords[3*b+2]*u + coords[3*c+2]*v;
        const pixel = y * width + x;
        if (z >= depth[pixel]) continue;
        depth[pixel] = z;
        const w = 1 - u - v;
        for (let channel = 0; channel < 3; channel++) {
          image.data[pixel*4+channel] = shades[a*3+channel]*w + shades[b*3+channel]*u + shades[c*3+channel]*v;
        }
        image.data[pixel*4+3] = 255;
      }
    }
  });
  context.putImageData(image, 0, 0);
}
