import * as THREE from "three";
import { Assembly, type CharacterPoint } from "./village-character-art";
import { createPortraitEar, portraitIrisTint, portraitPatch } from "./village-portrait-sculpt";

export const KORRIGAN_PALETTES = [
  { name: "garance", cap: "#aa3e3c", seam: "#79302b", vest: "#613735", skin: "#ebae7c", flush: "#ce785a", hair: "#573420", shorts: "#4a4a35" },
  { name: "canard", cap: "#298681", seam: "#185754", vest: "#195f5a", skin: "#e1a471", flush: "#bd6c51", hair: "#422c20", shorts: "#45483b" },
  { name: "ocre", cap: "#d4962f", seam: "#93601e", vest: "#886032", skin: "#efba87", flush: "#d58b63", hair: "#715034", shorts: "#584e36" },
] as const;

type Palette = typeof KORRIGAN_PALETTES[number];
const CREAM = "#ffebc5", BRASS = "#eab95b", WOOD = "#a06332", WOOD_DARK = "#6a3d27";
export const KORRIGAN_THIGH = .277, KORRIGAN_SHIN = .249, KORRIGAN_SOLE = .103;
export const KORRIGAN_HIP_X = .105, KORRIGAN_HIP_Y = .585;
const LIP_Y = .646, LIP_Z = .263;
const profiles = {
  garance: {
    skull: [0, .089, .149, .205, .243, .267, .271, .262, .233, .173, .106, 0],
    chin: .509, crown: 1.019, depth: .88, cheek: .024, cheekY: .728, nose: [.757, .067, .054, .082],
    eye: [.102, .823, .051, .043], slant: .004, almond: 1.08, iris: "#4e392f", brow: [.057, .020], mouth: [.069, .034],
    ear: [.224, .746, .128, .065, .076], waist: .243, shoulder: .241, sleeve: .103,
    cap: {
      path: [[0, -.019, 0], [-.022, .093, -.013], [-.103, .191, -.042], [-.251, .208, -.076], [-.380, .143, -.117], [-.459, .069, -.147]],
      radii: [.268, .251, .189, .141, .082, .012], depth: .95,
    },
  },
  canard: {
    skull: [0, .065, .113, .151, .188, .220, .236, .237, .214, .168, .097, 0],
    chin: .479, crown: 1.055, depth: .89, cheek: .019, cheekY: .733, nose: [.774, .052, .064, .071],
    eye: [.091, .838, .046, .029], slant: .014, almond: 1.25, iris: "#343c31", brow: [.055, .014], mouth: [.059, .027],
    ear: [.206, .760, .139, .055, .098], waist: .198, shoulder: .215, sleeve: .087,
    cap: {
      path: [[0, -.018, 0], [.001, .115, -.009], [.026, .242, -.031], [.072, .366, -.056], [.154, .426, -.081], [.220, .397, -.096]],
      radii: [.239, .220, .157, .105, .054, .010], depth: .94,
    },
  },
  ocre: {
    skull: [0, .092, .153, .212, .249, .256, .242, .225, .195, .149, .088, 0],
    chin: .513, crown: 1.000, depth: .96, cheek: .026, cheekY: .711, nose: [.756, .068, .050, .069],
    eye: [.111, .813, .050, .025], slant: -.004, almond: 1.10, iris: "#574232", brow: [.050, .017], mouth: [.078, .038],
    ear: [.224, .728, .115, .064, .061], waist: .257, shoulder: .248, sleeve: .105,
    cap: {
      path: [[0, -.021, 0], [.009, .079, -.016], [.055, .154, -.034], [.150, .207, -.073], [.258, .211, -.104], [.319, .163, -.133]],
      radii: [.253, .231, .177, .122, .070, .012], depth: 1.01,
    },
  },
} as const;
type Profile = typeof profiles[Palette["name"]];

function part(art: Assembly, name: string, parent: THREE.Object3D, material: THREE.MeshStandardMaterial) {
  const mesh = art.finish(name, parent, material);
  mesh.castShadow = false;
  return mesh;
}

function reliefWeight(x: number, y: number, centerX: number, centerY: number, width: number, height: number) {
  return Math.max(0, 1 - ((x - centerX) / width) ** 2 - ((y - centerY) / height) ** 2) ** 2;
}

function sculptHead(art: Assembly, palette: Palette, profile: Profile) {
  const centerZ = -.035, [tipY, tipW, tipH, tipDepth] = profile.nose;
  const [eyeX, eyeY] = profile.eye;
  const outline = new THREE.SplineCurve(profile.skull.map((width, i) => new THREE.Vector2(
    width, THREE.MathUtils.lerp(profile.chin, profile.crown, i / (profile.skull.length - 1)),
  ))).getPoints(38);
  function radius(y: number) {
    const row = outline.findIndex(point => point.y >= y);
    if (row <= 0) return 0;
    const a = outline[row - 1], b = outline[row];
    return Math.max(0, THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y)));
  }
  function relief(x: number, y: number) {
    const side = Math.abs(x);
    const jaw = .103 * Math.exp(-(((y - .642) / .107) ** 2)) * Math.max(0, 1 - (x / .266) ** 2);
    return jaw + profile.cheek * reliefWeight(side, y, .148, profile.cheekY, .178, .117)
      - .017 * reliefWeight(side, y, eyeX, eyeY, .084, .068)
      + .016 * reliefWeight(side, y, eyeX, eyeY + .059, .091, .061)
      + .021 * reliefWeight(x, y, 0, tipY + .051, tipW * .85, .105)
      + tipDepth * reliefWeight(x, y, 0, tipY, tipW, tipH)
      + .011 * reliefWeight(side, y, tipW * .57, tipY - .013, .033, .034)
      + .014 * reliefWeight(x, y, 0, profile.chin + .064, .139, .068);
  }
  const lipRelief = LIP_Z - (centerZ + radius(LIP_Y) * profile.depth + relief(0, LIP_Y));
  function surface(x: number, y: number, depth: number) {
    return centerZ + depth + THREE.MathUtils.smoothstep(depth, .025, .139)
      * (relief(x, y) + lipRelief * reliefWeight(x, y, 0, LIP_Y, .111, .074));
  }
  const front = (x: number, y: number) => surface(x, y, profile.depth * Math.sqrt(Math.max(0, radius(y) ** 2 - x * x)));
  // Columns wrap around the back, so the continuous skin shares its seam normals.
  const columns = 34, vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const skin = new THREE.Color(palette.skin), flush = new THREE.Color(palette.flush);
  const underpaint = new THREE.Color("#aa6d54"), rubbed = new THREE.Color("#f6d1a4"), tint = new THREE.Color();
  for (let row = 0; row < outline.length; row++) for (let col = 0; col < columns; col++) {
    const { x: width, y } = outline[row], turn = 2 * Math.PI * col / columns - Math.PI;
    const angle = turn - .53 * Math.sin(turn);
    const x = width * Math.sin(angle), z = profile.depth * width * Math.cos(angle), side = Math.abs(x);
    vertices.push(x, y, surface(x, y, z));
    const lit = THREE.MathUtils.smoothstep(z, .045, .185);
    const blush = .47 * reliefWeight(side, y, .161, profile.cheekY - .007, .137, .090);
    const noseShade = .27 * reliefWeight(x, y, 0, tipY - .015, tipW * 1.13, .045);
    const shade = .22 * reliefWeight(side, y, eyeX, eyeY + .004, .097, .067)
      + .24 * reliefWeight(side, y, .186, profile.chin + .088, .154, .098);
    const light = .23 * reliefWeight(x, y, 0, tipY + .010, tipW * .91, .044)
      + .21 * reliefWeight(side, y, .145, profile.cheekY + .028, .116, .058);
    tint.copy(skin).lerp(flush, (blush + noseShade) * lit).lerp(underpaint, shade * lit).lerp(rubbed, light * lit);
    colors.push(tint.r, tint.g, tint.b);
    if (row === outline.length - 1) continue;
    const a = row * columns + col, b = row * columns + (col + 1) % columns;
    indices.push(a, b, a + columns, b, b + columns, a + columns);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, null);
  return { front, radius, centerZ };
}

function addPointedEar(art: Assembly, palette: Palette, profile: Profile, side: number) {
  const [x, y, length, height, lift] = profile.ear;
  const ear = createPortraitEar(palette.skin, palette.flush, length, height, .128, side);
  const vertices = ear.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const horizontal = side * vertices.getX(i);
    const taper = THREE.MathUtils.smoothstep(horizontal, -length * .55, length);
    vertices.setXYZ(i, side * horizontal, vertices.getY(i) * (1 - .45 * taper) + lift * taper, vertices.getZ(i) - .045 * taper);
  }
  ear.computeVertexNormals();
  art.add(ear, null, [side * x, y, .013]);
}

function addFace(art: Assembly, palette: Palette, profile: Profile) {
  const { front, radius, centerZ } = sculptHead(art, palette, profile);
  const ink = new THREE.Color("#352423").lerp(new THREE.Color(palette.hair), .34);
  const eyelid = "#" + ink.getHexString();
  const brow = "#" + ink.lerp(new THREE.Color(palette.hair), .57).getHexString();
  const iris = portraitIrisTint(profile.iris);
  const [eyeX, eyeY, eyeW, eyeH] = profile.eye;
  const [browLift, browWidth] = profile.brow;
  const sclera = new THREE.Color("#f7e9cf"), scleraShade = new THREE.Color("#cbaa90"), eyeTint = new THREE.Color();
  for (const side of [-1, 1]) {
    addPointedEar(art, palette, profile, side);
    const x = side * eyeX, slant = side * profile.slant;
    const eyeFront = (px: number, py: number) => front(px, py) + .004
      + .011 * Math.max(0, 1 - ((px - x) / eyeW) ** 2 - ((py - eyeY) / eyeH) ** 2);
    const irisFront = (px: number, py: number) => eyeFront(px, py) + .0033;
    const gazeX = x - .009;
    art.add(portraitPatch(x, eyeY, eyeW, eyeH, eyeFront, slant, profile.almond, 0, 16, 3,
      (r, a) => eyeTint.copy(sclera).lerp(scleraShade, r * (.13 + .35 * Math.max(0, Math.sin(a))))), null);
    art.add(portraitPatch(gazeX, eyeY - .001, eyeW * .64, eyeH * .88, irisFront, slant * .19, 1, 0, 16, 5, iris), null);
    art.add(portraitPatch(gazeX - .007, eyeY + eyeH * .31, .007, .008,
      (px, py) => irisFront(px, py) + .0027, 0, 1, 0, 10, 1), "#fff4dc");
    const lid = Array.from({ length: 6 }, (_, i): CharacterPoint => {
      const a = i * Math.PI / 5, px = x + Math.cos(a) * eyeW;
      const py = eyeY + eyeH * Math.sin(a) ** profile.almond + slant * Math.cos(a);
      return [px, py, eyeFront(px, py) + .0018];
    });
    art.sweep(lid, [.0013, .0049, .0066, .0069, .0052, .0013], eyelid, 6);
    const arch: [number, number][] = [[.044, -.003], [.071, .009], [.103, .012], [.134, .004], [.163, -.012]];
    const eyebrow = arch.map(([dx, dy]): CharacterPoint => {
      const px = side * dx * eyeX / .102, py = eyeY + browLift + dy + (side === 1 ? .004 : 0);
      return [px, py, front(px, py) + .005];
    });
    art.sweep(eyebrow, [.003, browWidth * .79, browWidth, browWidth * .70, .0028], brow, 8);
    if (palette.name !== "canard") {
      for (let point = 0; point < (palette.name === "garance" ? 5 : 3); point++) {
        const fx = side * (.120 + point * .016), fy = profile.cheekY + .024 + Math.sin(point * 2.4 + side) * .009;
        art.add(portraitPatch(fx, fy, .0034 + point % 2 * .0012, .0033,
          (px, py) => front(px, py) + .0029, 0, 1, 0, 7, 1), "#b47754");
      }
    }
  }
  const [mouthWidth, cornerLift] = profile.mouth;
  const lip = (u: number, lower = 0): CharacterPoint => {
    const x = u * mouthWidth, y = LIP_Y + cornerLift * u * u + .004 * u - lower * (1 - u * u);
    return [x, y, front(x, y) + .0037];
  };
  art.sweep([-1, -.65, -.3, 0, .3, .65, 1].map(u => lip(u, .008)),
    [.0026, .0061, .008, .0087, .008, .006, .0021], palette.flush, 7);
  art.sweep([-1, -.65, -.3, 0, .3, .65, 1].map(u => lip(u)),
    [.0013, .0038, .0052, .0057, .0052, .0038, .0013], "#62352c", 7);
  addHair(art, palette, profile, radius, centerZ);
}

function addHair(art: Assembly, palette: Palette, profile: Profile, radius: (y: number) => number, centerZ: number) {
  const strands = palette.name === "canard" ? 19 : palette.name === "garance" ? 13 : 15;
  const frontHairline = palette.name === "canard" ? .948 : palette.name === "garance" ? .928 : .914;
  const nape = palette.name === "canard" ? .684 : .644;
  const columns = 36, rows = 8, vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const pigment = new THREE.Color(palette.hair), fiber = new THREE.Color(palette.name === "canard" ? "#765743" : "#b38150");
  const tint = new THREE.Color();
  for (let row = 0; row <= rows; row++) for (let col = 0; col < columns; col++) {
    const t = row / rows, angle = (col / columns - .5) * Math.PI * 2;
    const face = 1 - THREE.MathUtils.smoothstep(Math.abs(angle), .58, 1.23);
    const aboveEar = .068 * reliefWeight(Math.abs(angle), 0, 1.52, 0, .39, 1);
    const temple = .037 * reliefWeight(Math.abs(angle), 0, 1.02, 0, .28, 1);
    const wave = (palette.name === "canard" ? .026 : .013) * Math.sin(angle * 2.4 + .8);
    const hem = THREE.MathUtils.lerp(nape, frontHairline + wave, face) + aboveEar - temple;
    const y = THREE.MathUtils.lerp(hem, profile.crown - .009, t);
    const grain = .5 + .5 * Math.cos((angle + .16 * t * Math.cos(angle * 2.1)) * strands + .81 * Math.sin(t * 5 + angle * 3));
    const lip = Math.sin(Math.PI * .86 * t);
    const width = radius(y) + .003 + lip * (.010 + .014 * grain);
    vertices.push(Math.sin(angle) * width, y, centerZ + Math.cos(angle) * width * profile.depth);
    tint.copy(pigment).multiplyScalar(.84 + .19 * grain).lerp(fiber, (.05 + .17 * grain) * lip);
    colors.push(tint.r, tint.g, tint.b);
    if (row === rows) continue;
    const a = row * columns + col, b = row * columns + (col + 1) % columns;
    indices.push(a, b, a + columns, b, b + columns, a + columns);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, null);
  if (palette.name === "garance") {
    for (const side of [-1, 1]) for (let curl = 0; curl < 2; curl++) {
      const x = side * (.171 + curl * .037), y = .896 - curl * .047;
      art.sweep([[x - side * .021, y + .064, .127], [x, y + .029, .152], [x + side * .023, y, .131], [x + side * .012, y - .026, .116], [x - side * .016, y - .023, .122]],
        [.022, .034, .031, .025, .006], palette.hair, 9);
    }
  } else if (palette.name === "canard") {
    art.sweep([[-.163, .984, .115], [-.143, .947, .153], [-.074, .927, .175], [.012, .941, .186]],
      [.019, .035, .031, .005], palette.hair, 9);
    art.sweep([[.134, .961, .142], [.192, .910, .119], [.215, .842, .086], [.213, .795, .104]],
      [.024, .031, .023, .005], palette.hair, 8);
  } else {
    art.sweep([[-.151, .957, .125], [-.082, .923, .175], [-.008, .933, .175], [.043, .960, .154]],
      [.016, .027, .027, .004], palette.hair, 9);
    art.sweep([[.015, .959, .155], [.081, .936, .155], [.141, .913, .136], [.178, .880, .113]],
      [.017, .027, .023, .006], palette.hair, 8);
  }
}

function addBonnet(art: Assembly, palette: Palette, profile: Profile) {
  const { path, radii, depth } = profile.cap;
  const curve = new THREE.CatmullRomCurve3(path.map(point => new THREE.Vector3(...point)));
  const columns = 24, rows = 24, vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const front = new THREE.Vector3(0, 0, 1), across = new THREE.Vector3(), normal = new THREE.Vector3();
  const body = new THREE.Color(palette.cap), band = new THREE.Color(palette.seam), tint = new THREE.Color();
  const point = new THREE.Vector3();
  for (let row = -3; row <= rows; row++) {
    const t = Math.max(0, row) / rows, knot = t * (path.length - 1), i = Math.min(Math.floor(knot), path.length - 2);
    const center = curve.getPoint(t), axis = curve.getTangent(t);
    if (row < 0) center.y += row === -3 ? .009 : row === -2 ? -.023 : -.024;
    across.crossVectors(axis, front).normalize();
    normal.crossVectors(across, axis).normalize();
    const rib = .027 * reliefWeight(t, 0, .034, 0, .078, 1);
    const radius = (THREE.MathUtils.lerp(radii[i], radii[i + 1], knot - i) + rib)
      * (row === -3 ? .41 : row === -2 ? .78 : row === -1 ? .93 : row === rows ? 0 : 1);
    const cuff = 1 - THREE.MathUtils.smoothstep(t, .095, .14);
    for (let col = 0; col < columns; col++) {
      const angle = 2 * Math.PI * col / columns;
      const gather = Math.cos(angle * 7 + t * 3) * Math.sin(Math.PI * t) * .030;
      const fold = Math.cos(angle * 3 - t * 7) * .045;
      const scale = 1 + gather + fold * Math.sin(Math.PI * t);
      const snug = .84 + .16 * THREE.MathUtils.smoothstep(t, .12, .38);
      point.copy(center).addScaledVector(across, radius * Math.cos(angle) * scale)
        .addScaledVector(normal, radius * depth * snug * Math.sin(angle) * scale);
      vertices.push(point.x, point.y, point.z);
      tint.copy(body).lerp(band, cuff * .27).multiplyScalar(.94 + .12 * Math.sin(angle) + gather * 1.4 + fold);
      colors.push(tint.r, tint.g, tint.b);
      if (row === rows) continue;
      const a = (row + 3) * columns + col, b = (row + 3) * columns + (col + 1) % columns;
      indices.push(a, a + columns, b, b, a + columns, b + columns);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, null);
}

function addVest(art: Assembly, palette: Palette, profile: Profile) {
  const geometry = new THREE.LatheGeometry([
    [0, .010], [.69, .007], [.91, .026], [1, .067], [.97, .124], [.94, .202], [.96, .291],
    [profile.shoulder / profile.waist, .358], [.72, .424], [.50, .474], [.35, .507], [0, .507],
  ].map(([fraction, y]) => new THREE.Vector2(profile.waist * fraction, y)), 28).scale(1, 1, .76);
  const positions = geometry.getAttribute("position"), colors = new Float32Array(positions.count * 3);
  const vest = new THREE.Color(palette.vest), dye = new THREE.Color(palette.cap), binding = new THREE.Color(palette.seam), cloth = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), angle = Math.atan2(x, z);
    const hem = 1 - THREE.MathUtils.smoothstep(y, .027, .077);
    const lapel = reliefWeight(Math.abs(x), y, .072, .381, .081, .107) * THREE.MathUtils.smoothstep(z, .02, .15);
    cloth.copy(vest).lerp(dye, .09 + .27 * lapel).lerp(binding, .43 * hem);
    cloth.multiplyScalar(.94 + .09 * Math.cos(angle * 3 + y * 15) + .055 * Math.sin(angle * 11 - y * 8));
    cloth.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  art.add(geometry, null);
  art.ball([0, .378, .122], .124, CREAM, [.49, .86, .39]);
  art.add(new THREE.SphereGeometry(.105, 10, 6).scale(1, .34, 1), CREAM, [0, .479, .006]);
  for (const side of [-1, 1]) {
    art.sweep([[side * .092, .455, .085], [side * .066, .385, .146], [side * .037, .316, .162], [side * .022, .220, .175], [side * .019, .057, profile.waist * .75]],
      [.008, .012, .011, .008, .004], palette.seam, 7);
  }
  const front = profile.waist * .76;
  for (const y of [.129, .225, .319]) {
    const z = y > .27 ? front * .96 : front;
    if (palette.name === "garance") {
      art.rod([-.046, y, z], [.046, y + .008, z + .002], .010, BRASS);
      for (const side of [-1, 1]) art.ball([side * .054, y, z], .022, BRASS, [1, .88, .56]);
    } else {
      const width = palette.name === "canard" ? .021 : .025;
      const color = palette.name === "canard" ? "#c5ad73" : "#c89252";
      art.ball([0, y, z], width, color, [1, palette.name === "canard" ? 1 : .68, .54]);
    }
  }
}

function addClog(art: Assembly, width: number) {
  const shoe = new THREE.SphereGeometry(1, 16, 12);
  const vertices = shoe.getAttribute("position"), colors = new Float32Array(vertices.count * 3);
  const sole = new THREE.Color(WOOD_DARK), toe = new THREE.Color("#b07445"), stain = new THREE.Color("#824b2d"), tint = new THREE.Color();
  for (let i = 0; i < vertices.count; i++) {
    const nx = vertices.getX(i), ny = vertices.getY(i), nz = vertices.getZ(i);
    const y = Math.max(-KORRIGAN_SOLE, -.044 + ny * (.068 + .019 * (1 - nz * nz)));
    const z = .049 + nz * .155 + .021 * ny * Math.max(0, nz);
    const heel = THREE.MathUtils.smoothstep(nz, -.9, .35);
    const x = nx * width * (.82 + .21 * heel);
    vertices.setXYZ(i, x, y, z);
    const grain = .5 + .5 * Math.sin(38 * nx + 10 * nz + 2.7 * Math.cos(ny * 4.1));
    const leather = THREE.MathUtils.smoothstep(y, -.093, -.070);
    tint.copy(stain).lerp(toe, heel * (.50 + .20 * grain)).lerp(sole, 1 - leather).toArray(colors, i * 3);
  }
  shoe.computeVertexNormals();
  shoe.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  art.add(shoe, null);
}

function addTrouserLeg(art: Assembly, palette: Palette, profile: Profile) {
  const geometry = new THREE.LatheGeometry([
    [0, -.276], [.71, -.276], [.90, -.222], [1, -.130], [.96, -.053], [.72, .019], [0, .021],
  ].map(([radius, y]) => new THREE.Vector2(radius * (profile.waist * .34 + .027), y)), 12).scale(1, 1, 1.12);
  art.add(geometry, palette.shorts);
}

function addStocking(art: Assembly, palette: Palette) {
  const geometry = new THREE.LatheGeometry([
    [0, -.251], [.039, -.251], [.050, -.209], [.060, -.159], [.063, -.112], [.058, -.078],
    [.082, -.075], [.089, -.062], [.093, -.027], [.089, .006], [.064, .030], [0, .032],
  ].map(([radius, y]) => new THREE.Vector2(radius, y)), 12);
  const positions = geometry.getAttribute("position"), colors = new Float32Array(positions.count * 3);
  const wool = new THREE.Color("#e7cea1"), binding = new THREE.Color("#ad8f6b"), dye = new THREE.Color(palette.shorts), shade = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const trouser = THREE.MathUtils.smoothstep(y, -.078, -.073), angle = Math.atan2(x, z);
    const hem = reliefWeight(y, 0, -.066, 0, .022, 1);
    shade.copy(wool).lerp(binding, .22 + .09 * Math.cos(angle * 6))
      .lerp(dye, trouser).multiplyScalar(1 - .14 * hem).toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  art.add(geometry, null);
}

export function createKorriganModel(palette: Palette, material: THREE.MeshStandardMaterial) {
  const object = new THREE.Group();
  object.name = `korrigan-${palette.name}`;
  const profile = profiles[palette.name];
  const upper = new THREE.Group(); object.add(upper);
  const cap = new THREE.Group(); cap.position.set(0, .943, -.052); upper.add(cap);
  const art = new Assembly();
  addVest(art, palette, profile);
  art.ball([0, .497, 0], .096, palette.skin, [1, 1.34, .96]);
  addFace(art, palette, profile);

  // The head, hands and transverse flute share a transform at the player's lips.
  const fluteY = (x: number) => LIP_Y + x * .12;
  const fluteZ = (x: number) => LIP_Z + .028 - x * .19;
  const flutePoint = (x: number, lift = 0): CharacterPoint => [x, fluteY(x) + lift, fluteZ(x)];
  art.rod(flutePoint(-.568), flutePoint(.245), .029, WOOD, .027);
  art.rod(flutePoint(-.573), flutePoint(-.535), .033, "#ba7c42");
  art.rod(flutePoint(.225), flutePoint(.252), .032, "#b8763c");
  art.rod(flutePoint(-.579), flutePoint(-.572), .021, "#47291b");
  for (const x of [-.491, -.420, -.345, -.268, -.190, -.124, .025]) {
    art.ball(flutePoint(x, .027), .014, "#57331e", [1, .28, .82]);
  }
  for (const [side, elbow, grip] of [
    [-1, [-.341, .260, .143], -.393],
    [1, [.215, .260, .236], -.124],
  ] as const) {
    const shoulder: CharacterPoint = [side * profile.shoulder * .86, side < 0 ? .390 : .375, -.010];
    const [x, y, z] = flutePoint(grip), wrist: CharacterPoint = [x + .044, y - .092, z + .053];
    const sleeveRoot: CharacterPoint = [side * profile.shoulder * .39, shoulder[1], shoulder[2]];
    const cuff: CharacterPoint = [x + .049, y - .111, z + .060], palm: CharacterPoint = [x + .022, y - .046, z + .028];
    art.sweep([sleeveRoot, shoulder, [...elbow], cuff, wrist],
      [.045, profile.sleeve, profile.sleeve * .86, .061, .045], CREAM, 9);
    art.add(new THREE.SphereGeometry(.055, 10, 5).scale(1, .92, 1), "#f0d1a4", wrist);
    art.sweep([cuff, wrist, palm], [.033, .044, .052], palette.skin, 10);
    art.ball(palm, .060, palette.skin, [1.05, 1, .70]);
    for (let finger = 0; finger < 4; finger++) {
      const fx = x + (finger - 1.4) * .023;
      const fingerY = fluteY(fx), fingerZ = fluteZ(fx), knuckle = .021 + .008 * Math.sin((finger + 1) * .73);
      art.sweep([[fx + .019, y - .041, z + .051], [fx + .010, fingerY - .006, fingerZ + .036],
        [fx, fingerY + knuckle, fingerZ + .020], [fx - .007, fingerY + .025, fingerZ - .006]],
        [.015, .015, .013, .003], palette.skin, 7);
    }
    art.sweep([[x + .056, y - .054, z + .027], [x + .055, y - .034, z - .010], [x + .029, y - .020, z - .020]],
      [.024, .022, .012], palette.skin, 8);
  }
  part(art, `${object.name}-upper`, upper, material);

  const hat = new Assembly();
  addBonnet(hat, palette, profile);
  part(hat, `${object.name}-bonnet`, cap, material);

  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(), knee = new THREE.Group(), ankle = new THREE.Group();
    hip.position.set(side * KORRIGAN_HIP_X, KORRIGAN_HIP_Y, 0);
    knee.position.y = -KORRIGAN_THIGH; ankle.position.y = -KORRIGAN_SHIN;
    hip.add(knee); knee.add(ankle); object.add(hip);
    ankle.name = `${object.name}-ankle-${side}`;
    const thigh = new Assembly();
    addTrouserLeg(thigh, palette, profile);
    part(thigh, `${object.name}-thigh-${side}`, hip, material);
    const shin = new Assembly();
    addStocking(shin, palette);
    part(shin, `${object.name}-shin-${side}`, knee, material);
    const shoe = new Assembly();
    addClog(shoe, palette.name === "canard" ? .084 : .097);
    part(shoe, `${object.name}-sabot-${side}`, ankle, material);
    return { hip, knee, ankle };
  });
  return { object, upper, cap, legs };
}
