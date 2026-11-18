import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { VILLAGE_SEA_LEVEL, VILLAGE_SEA_SIZE } from "./village-layout";
import { projectVillageSurface, villageGraniteBlock, villageMaterial } from "./village-surfaces";

type Point = readonly [number, number];
type Vertex = readonly [number, number, number];

// Across and behind the village in its opening isometric view. Keeping the
// shoreline in this frame leaves room for the full fishing circuit in front.
const halfDiagonal = VILLAGE_SEA_SIZE * Math.SQRT1_2;
const shore: readonly Point[] = [
  [40 - halfDiagonal, -40],
  [-67, -39], [-64, -33], [-57, -28], [-48, -29], [-42, -33], [-37, -36], [-32, -35],
  [-27, -31], [-23, -29], [-20, -27.4], [-17, -28], [-14, -30.5],
  [-10, -33.5], [-6, -34], [-2, -32], [0, -30.6], [2, -29.2], [5, -27.7],
  [8, -28.6], [11, -30.5], [13, -33.3], [17, -35.4], [22, -36],
  [27, -35.1], [31, -32.3], [35, -30.8], [40, -31.9], [46, -35],
  [52, -37], [57, -36], [62, -38], [66, -43], [halfDiagonal - 44, -44],
];

const granite = ["#7d8a82", "#9ca89c", "#ada894", "#778980", "#bbc0a8"];
const colors = {
  wet: "#acaa93", beach: "#d8c59e", rock: "#92998b", rockLight: "#b9b39d",
  meadow: "#a2b580", heath: "#81986b", glade: "#96a571", shade: "#65826b",
  wood: "#766448", needles: "#367c5b", needlesLight: "#5d9566", needlesDark: "#286654",
  gorse: "#6a8c56", gorseLight: "#85a360", blooms: "#d7af45", marram: "#b4ba79",
};

function ground(across: number, depth: number): Point {
  return [(depth + across) * Math.SQRT1_2, (depth - across) * Math.SQRT1_2];
}

// Sampling each span includes the zero-across column that ends at the square's corner.
const shoreline = new THREE.CatmullRomCurve3(shore.map(([across, depth]) =>
  new THREE.Vector3(across, 0, depth)), false, "centripetal").getPoints((shore.length - 1) * 4);

const waterlineHeight = -.29;
const edgeHeight = VILLAGE_SEA_LEVEL + .08;
const groves = [
  { across: -43, inland: 12, trees: [[-46, 7.8, 1.62], [-42.5, 8.1, 2.05], [-39.8, 7.7, 1.44]] },
  { across: -18, inland: 7, trees: [[-22, 6.7, 1.91], [-19.1, 7.0, 2.35], [-16.4, 6.8, 1.77], [-14, 7.4, 1.4]] },
  { across: -5, inland: 23, trees: [[-9.3, 9.4, 1.66], [-6.2, 9.3, 2.09], [-3.4, 9.6, 2.23], [-.9, 9.8, 1.55]] },
  { across: 7, inland: 9, trees: [[2.3, 6.8, 1.67], [5.6, 7.3, 2.17], [8.2, 7.2, 2.36], [11, 7.6, 1.58]] },
  { across: 29, inland: 17, trees: [[25.9, 8.4, 1.62], [29.3, 8.7, 2.07], [32.1, 8.5, 1.93], [35.2, 8.1, 1.54]] },
];

export const VILLAGE_MAINLAND_SHORE: readonly Point[] = shoreline.map(point => ground(point.x, point.z));

/** One low-poly, vertex-coloured mesh for the mainland and its distant outcrops. */
export function createVillageMainland() {
  const positions: number[] = [], pigments: number[] = [], indices: number[] = [];
  const paint = new THREE.Color();
  const accent = new THREE.Color();

  const rows = shoreline.map(({ x: across, z: depth }) => {
    const rock = Math.sin(across * .31) * .55 + Math.cos(across * .79) * .24 + Math.sin(across * 2.3) * .13;
    const height = 1.65 + Math.sin(across * .16) * .58 + rock * .43;
    const cove = THREE.MathUtils.smoothstep(depth, -36, -28);
    const beach = .26 + (1 - cove) * (2.5 + Math.sin(across * .62) * .66);
    // In this 45° frame the two back edges of the sea are depth = |across| − halfDiagonal.
    const landWidth = Math.max(0, depth - (Math.abs(across) - halfDiagonal));
    const coastalBand = 36;
    const profileEnd = 72;
    const coastalScale = Math.min(1, landWidth / (coastalBand + 10));
    const vertex = (up: number, offset: number, base: string, tint: string, mix: number): Vertex => {
      const inland = offset <= coastalBand ? offset * coastalScale
        : THREE.MathUtils.lerp(coastalBand * coastalScale, landWidth, (offset - coastalBand) / (profileEnd - coastalBand));
      const [x, z] = ground(across, depth - inland);
      const ridge = 1.12 * Math.exp(-(((across + 8 + inland * .22) / 12) ** 2 + ((inland - 16) / 7) ** 2))
        + 1.07 * Math.exp(-(((across - 16) / 9) ** 2 + ((inland - 25 + across * .35) / 7) ** 2));
      const relief = up + ridge * THREE.MathUtils.smoothstep(inland, 2, 7);
      const y = THREE.MathUtils.lerp(Math.min(up, edgeHeight), relief, THREE.MathUtils.smoothstep(landWidth - inland, 0, 12));
      positions.push(x, y, z);
      paint.set(base).lerp(accent.set(tint), mix);
      if (base === colors.meadow) {
        let cover = 0;
        for (const grove of groves) {
          const edge = Math.sin(across * .98 + inland * .61) * .25;
          const distance = Math.hypot((across - grove.across) / 7, (inland - grove.inland) / 4.7);
          cover = Math.max(cover, 1 - THREE.MathUtils.smoothstep(distance + edge, .5, 1.28));
        }
        paint.lerp(accent.set(colors.glade), cover * .49).lerp(accent.set(colors.shade), cover * cover * .32);
      }
      pigments.push(paint.r, paint.g, paint.b);
      return [x, y, z];
    };
    const soil = (inland: number) => THREE.MathUtils.clamp(.42 + Math.sin(across * .32 + inland * .57) * .22
      + Math.cos(across * .18 - inland * .24) * .26, 0, 1);
    return [
      vertex(-.68, -.15, colors.wet, colors.rock, cove * .72),
      vertex(waterlineHeight, 0, colors.wet, colors.rock, cove * .78),
      vertex(-.09 + rock * .08, beach, colors.beach, colors.rock, cove),
      vertex(height * .38, beach + .3 + rock * .22, colors.rock, colors.rockLight, .28 + rock * .29),
      vertex(height * .83, beach + .86 + rock * .41, colors.rock, colors.rockLight, .62 + rock * .33),
      vertex(height + .23 + rock * .32, beach + 1.86, colors.rock, colors.meadow, .78 + rock * .17),
      vertex(height + .57 + Math.sin(across * .35) * .38, beach + 3.51, colors.meadow, colors.heath, soil(4)),
      vertex(height + 1.11 + Math.sin(across * .26 + 1) * .63, beach + 7.5, colors.meadow, colors.heath, soil(8)),
      vertex(3.58 + Math.sin(across * .12 + 1) * .82 + rock * .26, beach + 13.5, colors.meadow, colors.heath, soil(14)),
      vertex(3.92 + Math.sin(across * .21) * .87, beach + 21, colors.meadow, colors.heath, soil(21)),
      vertex(4.05 + Math.sin(across * .15) * 1.03, beach + 31, colors.meadow, colors.heath, soil(31)),
      vertex(3.45 + Math.sin(across * .14 + 2) * .7, 43, colors.meadow, colors.heath, soil(43)),
      vertex(2.4 + Math.cos(across * .16) * .65, 57, colors.meadow, colors.heath, soil(57)),
      vertex(edgeHeight, profileEnd, colors.heath, colors.meadow, soil(profileEnd)),
    ];
  });
  const width = rows[0].length;
  for (let index = 0; index < rows.length - 1; index++) {
    for (let layer = 0; layer < width - 1; layer++) {
      const a = index * width + layer, b = a + width;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const land = new THREE.BufferGeometry();
  land.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  land.setAttribute("color", new THREE.Float32BufferAttribute(pigments, 3));
  land.setIndex(indices);
  land.computeVertexNormals();

  const parts = [land.toNonIndexed()];
  land.dispose();

  function add(source: THREE.BufferGeometry, color: string, [x, y, z]: Vertex, size: Vertex, yaw = 0, lean = 0) {
    const part = source.index ? source.toNonIndexed() : source;
    if (part !== source) source.dispose();
    part.deleteAttribute("uv");
    part.scale(...size).rotateY(yaw).rotateZ(lean).translate(x, y, z);
    const vertex = part.getAttribute("position"), shades = new Float32Array(vertex.count * 3);
    paint.set(color);
    for (let i = 0; i < vertex.count; i++) {
      const light = THREE.MathUtils.clamp((vertex.getY(i) - y) / size[1], -.4, .6);
      accent.copy(paint).multiplyScalar(.97 + light * .19).toArray(shades, i * 3);
    }
    part.setAttribute("color", new THREE.BufferAttribute(shades, 3));
    parts.push(part);
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const at = (across: number, layer: number): Vertex => {
    const right = shoreline.findIndex(point => point.x >= across), left = right - 1;
    const fraction = (across - shoreline[left].x) / (shoreline[right].x - shoreline[left].x);
    const low = Math.floor(layer), high = low + 1;
    a.set(...rows[left][low]).lerp(b.set(...rows[right][low]), fraction);
    c.set(...rows[left][high]).lerp(d.set(...rows[right][high]), fraction);
    return a.lerp(c, layer - low).toArray();
  };
  const ico = (color: string, point: Vertex, radius: number, size: Vertex, yaw: number, detail = 0) =>
    add(new THREE.IcosahedronGeometry(radius, detail), color, point, size, yaw);
  const graniteBlock = (color: string, point: Vertex, radius: number, stretch: Vertex, salt: number) =>
    add(villageGraniteBlock(salt), color, point, [radius * stretch[0], radius * stretch[1], radius * stretch[2]], salt, .16);
  // Angular shelves establish headlands while the sandy coves stay open.
  for (const [across, depth, radius, height, tint] of [
    [-21.4, -27.55, .69, .88, 2], [-20.6, -27.24, .41, .61, 1], [-19.3, -27.45, .5, .76, 4],
    [-17.7, -27.98, .72, 1.04, 3], [-15.2, -29.96, .48, .74, 2], [-14.8, -30.18, .4, .85, 4],
    [3.5, -28.38, .58, .83, 1], [4.3, -27.69, .35, .8, 3], [5.4, -27.25, .61, .95, 2],
    [6.4, -27.55, .41, .66, 3], [7.5, -28.2, .65, .76, 4], [10.2, -30.07, .66, .93, 2],
    [31.9, -31.62, .65, .76, 1], [33.7, -30.68, .51, .84, 4], [35.4, -30.51, .7, .83, 3],
    [36.6, -31.01, .47, .71, 1], [37.1, -30.72, .36, .84, 2],
  ]) {
    const [x, z] = ground(across, depth);
    graniteBlock(granite[tint], [x, -.13, z], radius, [1.3, height, .92], across);
  }

  for (const [across, layer, scale] of groves.flatMap(grove => grove.trees)) {
    const [x, y, z] = at(across, layer);
    // Wind bends the tapered trunks and flattens their rounded crowns.
    add(new THREE.CylinderGeometry(.06, .115, 1.26, 6), colors.wood, [x + .19 * scale, y + .53 * scale, z],
      [scale, scale, scale], 0, -.35);
    add(new THREE.CylinderGeometry(.043, .07, .73, 6), colors.wood, [x + .49 * scale, y + 1.28 * scale, z],
      [scale, scale, scale], 0, -.56);
    ico(colors.needlesDark, [x + .32 * scale, y + 1.5 * scale, z], .71 * scale, [1.05, .52, .93], across, 1);
    ico(colors.needles, [x + .68 * scale, y + 1.73 * scale, z + .16 * scale], .68 * scale, [1.2, .55, .8], across, 1);
    ico(colors.needlesLight, [x + .93 * scale, y + 1.66 * scale, z - .35 * scale], .48 * scale, [1.3, .5, .71], across);
    ico(colors.needles, [x + .03 * scale, y + 1.57 * scale, z + .23 * scale], .55 * scale, [1.05, .52, .85], across);
  }

  for (const [across, layer, scale] of [
    [-46, 6, 1.6], [-43, 6.4, 1.8], [-25, 6.6, 1.24], [-22, 5.7, 1.62], [-20.2, 5.7, 1.41], [-18, 5.5, 1.7],
    [-13.1, 8.3, 1.67], [-11, 8.8, 1.49], [-9.1, 8.7, 1.59], [-6.9, 8.5, 1.35], [-4.9, 8.7, 1.78],
    [1.5, 5.8, 1.57], [3.4, 5.9, 1.23], [4.8, 6.1, 1.55], [7, 6, 1.59], [9, 6.2, 1.33],
    [14, 7.9, 1.56], [16.3, 7.9, 1.37], [18, 7.8, 1.69], [25, 7.8, 1.67],
    [29, 7.9, 1.26], [31, 6.1, 1.49], [33, 6.1, 1.71], [35, 6.3, 1.29], [40, 7.2, 1.6],
  ]) {
    const [x, y, z] = at(across, layer);
    ico(colors.gorse, [x, y + .13 * scale, z], .56 * scale, [1.18, .57, .9], across);
    ico(colors.gorseLight, [x + .39 * scale, y + .19 * scale, z - .22 * scale], .42 * scale, [1.24, .55, .94], across);
    for (const [dx, dy, dz] of [[-.23, .35, -.11], [.12, .37, .13], [.41, .41, -.17]]) {
      ico(colors.blooms, [x + dx * scale, y + dy * scale, z + dz * scale], .12 * scale, [1, .77, .88], across);
    }
  }
  for (const [across, layer, scale] of [
    [-23, 4.6, .98], [-20.8, 3, 1.35], [-19.1, 2.7, .92], [-17.8, 4.7, 1.26],
    [-13.2, 7, 1.43], [-11.3, 7.3, 1.19], [-9.9, 7.2, .94],
    [4.1, 3.7, 1.32], [5.5, 3, 1], [6.6, 3.6, 1.57], [7.9, 4.8, 1.1],
    [15.3, 8.6, 1.43], [17.4, 8.7, 1.1], [18.9, 8.9, 1.13], [34.1, 5.1, 1.11], [35.8, 5.2, .92],
  ]) {
    const [x, y, z] = at(across, layer);
    graniteBlock(granite[0], [x, y + scale * .13, z], scale, [1.19, .56, .83], across);
    graniteBlock(granite[2], [x + .38 * scale, y + .28 * scale, z - .15 * scale], scale, [.81, .52, .68], across * .61);
  }
  for (const [across, layer] of [[-40, 5], [-32, 6], [-24, 5], [-16, 6], [-6, 5], [-2, 6], [3, 5], [11, 5], [16, 6], [26, 7], [33, 5], [46, 6]]) {
    const [x, y, z] = at(across, layer);
    ico(granite[1], [x, y + .02, z], .44, [1.7, .45, .86], across);
    for (const [dx, dz, lean] of [[-.22, .24, -.29], [-.04, .15, .14], [-.11, .38, .42]]) {
      add(new THREE.ConeGeometry(.079, .39, 4), colors.marram, [x + dx, y + .12, z + dz], [1, 1, 1], across, lean);
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error("Unable to merge the village mainland");
  projectVillageSurface(geometry, "granite");
  const mesh = new THREE.Mesh(geometry, villageMaterial({ vertexColors: true, roughness: .96 }, "granite"));
  mesh.name = "village-mainland";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.raycast = () => {};
  return mesh;
}
