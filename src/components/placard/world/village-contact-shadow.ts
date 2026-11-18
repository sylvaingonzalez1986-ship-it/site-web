import { BufferAttribute, RingGeometry } from "three";

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
