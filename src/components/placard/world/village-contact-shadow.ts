import { BufferAttribute, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, RingGeometry, Sphere, Vector3 } from "three";

/** A unit-diameter footprint with its opacity fading to zero at the rim. */
export function createVillageContactShadowGeometry() {
  const geometry = new RingGeometry(0, 0.5, 16, 4);
  const positions = geometry.getAttribute("position"), colors = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i++) {
    const radial = 1 - 4 * (positions.getX(i) ** 2 + positions.getY(i) ** 2);
    colors.set([1, 1, 1, radial < 1e-6 ? 0 : radial ** 3], i * 4);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  return geometry;
}

/** One soft shadow beneath the body and one under each sole, drawn together. */
export function createCharacterContactShadow(root: Object3D, ankles: readonly Object3D[], soleHeight: number, diameter: number, heightAt?: (x: number, z: number) => number) {
  const material = new MeshBasicMaterial({ color: "#364338", vertexColors: true, transparent: true, opacity: .36, depthWrite: false });
  const mesh = new InstancedMesh(createVillageContactShadowGeometry(), material, 1 + ankles.length);
  mesh.name = root.name + "-contact";
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.boundingSphere = new Sphere(new Vector3(), 1.3);
  mesh.raycast = () => {};
  root.add(mesh);
  const disk = new Object3D(), inverse = new Matrix4(), sole = new Vector3(), forward = new Vector3();
  const previousRoot = new Matrix4(), previousFeet = ankles.map(() => new Matrix4());
  let initialized = false;
  disk.rotation.order = "YXZ";
  disk.rotation.x = -Math.PI / 2;
  disk.scale.set(diameter, diameter * .82, 1);
  disk.position.set(0, .009, .025);
  disk.updateMatrix();
  mesh.setMatrixAt(0, disk.matrix);
  const update = () => {
    root.updateWorldMatrix(true, false);
    const rootChanged = !initialized || !root.matrixWorld.equals(previousRoot);
    if (rootChanged) {
      inverse.copy(root.matrixWorld).invert();
      previousRoot.copy(root.matrixWorld);
    }
    let dirty = false;
    const base = root.matrixWorld.elements[13];
    for (let i = 0; i < ankles.length; i++) {
      const ankle = ankles[i];
      ankle.updateWorldMatrix(true, false);
      if (!rootChanged && ankle.matrixWorld.equals(previousFeet[i])) continue;
      previousFeet[i].copy(ankle.matrixWorld);
      dirty = true;
      sole.set(0, -soleHeight, .047).applyMatrix4(ankle.matrixWorld);
      const floor = heightAt ? heightAt(sole.x, sole.z) : base;
      const contact = Math.max(0, 1 - Math.max(0, sole.y - floor) / .16);
      sole.y = floor;
      disk.position.copy(sole.applyMatrix4(inverse));
      disk.position.y += .012;
      forward.set(0, 0, 1).transformDirection(ankle.matrixWorld).transformDirection(inverse);
      disk.rotation.y = Math.atan2(forward.x, forward.z);
      disk.scale.set(.26 * contact, .38 * contact, 1);
      disk.updateMatrix();
      mesh.setMatrixAt(i + 1, disk.matrix);
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
    initialized = true;
  };
  update();
  return { mesh, update };
}
