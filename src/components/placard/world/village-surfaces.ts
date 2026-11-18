import * as THREE from "three";

export type VillageSurface = "granite" | "slate" | "timber" | "silt" | "turf";

const tiles = new Map<VillageSurface, THREE.DataTexture>();
const size = 128;

function noise(x: number, y: number, period: number, salt: number, periodY = period) {
  const hash = (col: number, row: number) => {
    let code = Math.imul(col % period + 1, 0x75152f39) ^ Math.imul(row % periodY + 1, 0x5c17d941) ^ salt;
    code = Math.imul(code ^ (code >>> 16), 0x21f0aaad);
    return ((code ^ (code >>> 15)) >>> 0) / 4294967295 - 0.5;
  };
  const col = Math.floor(x), row = Math.floor(y);
  const tx = THREE.MathUtils.smoothstep(x - col, 0, 1), ty = THREE.MathUtils.smoothstep(y - row, 0, 1);
  const upper = THREE.MathUtils.lerp(hash(col, row), hash(col + 1, row), tx);
  const lower = THREE.MathUtils.lerp(hash(col, row + 1), hash(col + 1, row + 1), tx);
  return THREE.MathUtils.lerp(upper, lower, ty);
}

function pigment(surface: VillageSurface, u: number, v: number) {
  const broad = noise(u * 4, v * 4, 4, 42);
  const patches = noise(u * 18, v * 18, 18, 78);
  const grain = noise(u * size, v * size, size, 13);
  switch (surface) {
    case "granite": return 236 + broad * 21 + patches * 25 + grain * 33 - (grain > 0.38 ? 24 : 0);
    case "slate": return 247 + broad * 13 + noise(u * 7, v * 42, 7, 61, 42) * 16 + grain * 13;
    case "timber": {
      const waviness = noise(u * 3, v * 3, 3, 77) * 0.13;
      const fibers = Math.sin((u + waviness) * 28 * Math.PI * 2);
      return 241 + broad * 14 + Math.min(0.18, fibers) * 24 + grain * 9;
    }
    case "silt": return 242 + broad * 11 + patches * 18 + grain * 21 - (grain > 0.42 ? 18 : 0);
    case "turf": return 242 + broad * 21 + patches * 13 + grain * 14;
  }
}

function surfaceTile(surface: VillageSurface) {
  let tile = tiles.get(surface);
  if (tile) return tile;
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const shade = THREE.MathUtils.clamp(pigment(surface, x / size, y / size), 0, 255);
    const offset = (y * size + x) * 4;
    bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = shade;
    bytes[offset + 3] = 255;
  }
  tile = new THREE.DataTexture(bytes, size, size);
  tile.colorSpace = THREE.SRGBColorSpace;
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  tile.generateMipmaps = true;
  tile.magFilter = THREE.LinearFilter;
  tile.minFilter = THREE.LinearMipmapLinearFilter;
  tiles.set(surface, tile);
  return tile;
}

/** Each mesh owns its map handle. Three.js shares the pixel source across all of them. */
export function villageMaterial(parameters: THREE.MeshStandardMaterialParameters, surface?: VillageSurface) {
  const material = new THREE.MeshStandardMaterial(parameters);
  if (surface) {
    const map = surfaceTile(surface).clone();
    material.map = map;
    material.addEventListener("dispose", () => map.dispose());
  }
  return material;
}

const repeat: Record<VillageSurface, number> = { granite: 1.8, slate: 2, timber: 1.35, silt: 3.4, turf: 5.5 };

/** Project onto each face after assembly, so grain keeps its scale across panes and boards. */
export function projectVillageSurface(geometry: THREE.BufferGeometry, surface: VillageSurface) {
  const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
  const texels = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i += 3) {
    const nx = Math.abs(normals.getX(i) + normals.getX(i + 1) + normals.getX(i + 2));
    const ny = Math.abs(normals.getY(i) + normals.getY(i + 1) + normals.getY(i + 2));
    const nz = Math.abs(normals.getZ(i) + normals.getZ(i + 1) + normals.getZ(i + 2));
    for (let vertex = i; vertex < i + 3; vertex++) {
      texels[vertex * 2] = (nx > ny && nx > nz ? positions.getZ(vertex) : positions.getX(vertex)) / repeat[surface];
      texels[vertex * 2 + 1] = (ny >= nx && ny >= nz ? positions.getZ(vertex) : positions.getY(vertex)) / repeat[surface];
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(texels, 2));
}

export function villageGraniteBlock(salt: number) {
  const block = new THREE.DodecahedronGeometry(1), positions = block.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const fracture = Math.sin(x * 5.1 + y * 6.7 + z * 3.9 + salt) * 0.16;
    positions.setXYZ(i, x * (0.94 + fracture), THREE.MathUtils.clamp(y + fracture, -0.77, 0.69), z + fracture * 0.65);
  }
  block.computeVertexNormals();
  return block;
}
