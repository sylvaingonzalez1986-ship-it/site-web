import * as THREE from "three";
import type { ChanvrierAppearance, getChanvrierColors } from "@/lib/arena-chanvrier";
import { createChanvrierHair, type ChanvrierScalp } from "./chanvrier-hair";
import { Assembly, type CharacterPoint } from "./world/village-character-art";
import { createPortraitEar, portraitIrisTint, portraitMoustache } from "./world/village-portrait-sculpt";

type Colors = ReturnType<typeof getChanvrierColors>;
type Face = ChanvrierAppearance["face"];
const eyeHeight = .156;
const ink = "#36282b";
const ivory = "#fff3dd";
const sections = [-.101, -.087, -.062, -.030, .014, .066, .122, .184, .235, .283, .322, .348, .355];
const oval = [0, .072, .115, .145, .171, .190, .198, .194, .182, .157, .117, .065, 0];
const contours: Record<Face, { radii: number[]; height: number }> = {
  oval: { radii: oval, height: 1 },
  round: { radii: [0, .083, .129, .163, .194, .207, .209, .202, .184, .155, .113, .061, 0], height: .95 },
  square: { radii: [0, .090, .147, .171, .183, .190, .195, .195, .183, .158, .117, .065, 0], height: .98 },
  heart: { radii: [0, .055, .091, .126, .158, .182, .194, .198, .188, .159, .117, .063, 0], height: 1 },
  long: { radii: [0, .063, .102, .131, .154, .171, .181, .184, .176, .152, .112, .063, 0], height: 1.06 },
  angular: { radii: [0, .066, .111, .146, .164, .176, .197, .187, .177, .155, .118, .064, 0], height: 1 },
  pear: { radii: [0, .082, .144, .181, .197, .201, .194, .186, .172, .147, .110, .059, 0], height: .99 },
  cheeked: { radii: [0, .059, .104, .133, .164, .197, .210, .199, .182, .155, .114, .062, 0], height: .99 },
};

const reliefByFace: Record<Face, { cheekY: number; cheek: number; jaw: number; chin: number }> = {
  oval: { cheekY: .098, cheek: .028, jaw: -.002, chin: .022 },
  round: { cheekY: .083, cheek: .036, jaw: .005, chin: .016 },
  square: { cheekY: .091, cheek: .022, jaw: .017, chin: .026 },
  heart: { cheekY: .112, cheek: .035, jaw: -.011, chin: .028 },
  long: { cheekY: .101, cheek: .018, jaw: -.004, chin: .030 },
  angular: { cheekY: .119, cheek: .042, jaw: .014, chin: .021 },
  pear: { cheekY: .072, cheek: .030, jaw: .014, chin: .023 },
  cheeked: { cheekY: .073, cheek: .042, jaw: -.007, chin: .017 },
};

export function createChanvrierScalp(face: Face): ChanvrierScalp {
  const { radii, height } = contours[face];
  const feature = reliefByFace[face];
  const curve = new THREE.CatmullRomCurve3(sections.map((y, index) => new THREE.Vector3(radii[index], y * height, 0)));
  const profile = curve.getPoints(54).map(point => new THREE.Vector2(Math.max(0, point.x), point.y));
  return {
    profile,
    height,
    relief(x, y, z) {
      if (z <= 0 || y > .241) return z;
      const side = Math.abs(x);
      const cheek = feature.cheek * ovalWeight(side, y, .117, feature.cheekY, .111, .095);
      const corner = feature.jaw * ovalWeight(side, y, .108, -.009, .080, .061);
      const socket = .020 * ovalWeight(side, y, .073, eyeHeight, .071, .061);
      const brow = .012 * ovalWeight(side, y, .073, .207, .077, .039);
      const chin = feature.chin * ovalWeight(x, y, 0, -.042, .115, .075);
      const muzzle = .018 * ovalWeight(x, y, 0, .028, .108, .067);
      const philtrum = .006 * ovalWeight(x, y, 0, .052, .022, .032);
      return z + (cheek + corner - socket + brow + chin + muzzle - philtrum) * THREE.MathUtils.smoothstep(z, .036, .116);
    },
    radius(y) {
      const index = profile.findIndex(p => p.y >= y);
      if (index < 1) return 0;
      const from = profile[index - 1], to = profile[index];
      return THREE.MathUtils.lerp(from.x, to.x, (y - from.y) / (to.y - from.y));
    },
  };
}

function shade(color: string, toward: string, amount: number) {
  return `#${new THREE.Color(color).lerp(new THREE.Color(toward), amount).getHexString()}`;
}

function ovalWeight(x: number, y: number, centerX: number, centerY: number, width: number, height: number) {
  const radius = ((x - centerX) / width) ** 2 + ((y - centerY) / height) ** 2;
  return Math.max(0, 1 - radius) ** 2;
}

function surface(scalp: ChanvrierScalp, x: number, y: number) {
  const z = Math.sqrt(Math.max(0, scalp.radius(y * scalp.height) ** 2 - x * x)) * .91;
  return scalp.relief(x, y, z);
}

function createPart(parent: THREE.Group, name: string, material: THREE.Material) {
  let key: string | undefined;
  let mesh: THREE.Mesh | undefined;
  return (dependencies: string[], draw: (a: Assembly) => void, visible = true) => {
    const nextKey = dependencies.join("|");
    if (nextKey === key) return;
    key = nextKey;
    mesh?.removeFromParent();
    mesh?.geometry.dispose();
    mesh = undefined;
    if (!visible) return;
    const art = new Assembly();
    draw(art);
    mesh = art.finish(name, parent, material);
    mesh.castShadow = false;
    return mesh;
  };
}

function drawSkin(art: Assembly, scalp: ChanvrierScalp, skin: string) {
  const sides = 64, rows = scalp.profile.length;
  const skull = new THREE.LatheGeometry(scalp.profile, sides, Math.PI).scale(1, 1, .91);
  const vertices = skull.getAttribute("position"), normals = skull.getAttribute("normal");
  for (let i = 0; i < vertices.count; i++) vertices.setZ(i, scalp.relief(vertices.getX(i), vertices.getY(i) / scalp.height, vertices.getZ(i)));
  skull.computeVertexNormals();
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 1; i < rows - 1; i++) {
    const seam = sides * rows + i;
    a.fromBufferAttribute(normals, i).add(b.fromBufferAttribute(normals, seam)).normalize();
    normals.setXYZ(i, a.x, a.y, a.z);
    normals.setXYZ(seam, a.x, a.y, a.z);
  }
  paintSkin(skull, scalp, skin);
  art.add(skull, null);
  const cartilage = shade(skin, "#9b4a4d", .45);
  for (const side of [-1, 1]) {
    const x = side * (scalp.radius(.093 * scalp.height) + .006), h = scalp.height;
    const ear = createPortraitEar(skin, cartilage, .042, .053 * h, .059, side);
    ear.rotateY(side * .16);
    art.add(ear, null, [x, .078 * h, .008]);
  }
}

function paintSkin(geometry: THREE.BufferGeometry, scalp: ChanvrierScalp, skin: string) {
  const vertices = geometry.getAttribute("position"), colors = new Float32Array(vertices.count * 3);
  const base = new THREE.Color(skin), tint = new THREE.Color();
  const rouge = base.clone().lerp(new THREE.Color("#c96a56"), .47).multiplyScalar(.91);
  const shadow = base.clone().lerp(new THREE.Color("#915e58"), .35).multiplyScalar(.84);
  const light = base.clone().lerp(new THREE.Color("#f9d0ad"), .26);
  for (let i = 0; i < vertices.count; i++) {
    const x = Math.abs(vertices.getX(i)), y = vertices.getY(i) / scalp.height, z = vertices.getZ(i);
    const front = THREE.MathUtils.smoothstep(z, .022, .123);
    const cheeks = .58 * ovalWeight(x, y, .128, .082, .089, .075);
    const temple = .28 * ovalWeight(x, y, .142, .181, .095, .101);
    const eyes = .47 * ovalWeight(x, y, .074, eyeHeight, .073, .067);
    const jaw = .26 * ovalWeight(x, y, .123, -.029, .102, .073);
    const edgeLight = .20 * ovalWeight(x, y, .121, .118, .078, .061) + .18 * ovalWeight(x, y, .056, .238, .111, .068);
    tint.copy(base).lerp(rouge, cheeks * front).lerp(shadow, (temple + eyes + jaw) * front).lerp(light, edgeLight * front);
    tint.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

type FacePoint = [x: number, y: number];
type Depth = (x: number, y: number, r: number) => number;

function patch(
  art: Assembly, scalp: ChanvrierScalp, center: FacePoint,
  edge: (angle: number) => FacePoint, depth: Depth, color: string | ((radius: number, angle: number) => THREE.Color), origin = 0,
  resolution: readonly [spokes: number, rows: number] = [24, 4],
) {
  const [x, y] = center;
  const positions: number[] = [x, (y - origin) * scalp.height, surface(scalp, x, y) + depth(x, y, 0)];
  const indices: number[] = [], colors: number[] = [];
  const [segments, rings] = resolution;
  const shade = (t: number, angle: number) => {
    if (typeof color === "string") return;
    const paint = color(t, angle);
    colors.push(paint.r, paint.g, paint.b);
  };
  shade(0, 0);
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 0; i < segments; i++) {
      const r = ring / rings, angle = i * Math.PI * 2 / segments;
      const [edgeX, edgeY] = edge(angle);
      const px = THREE.MathUtils.lerp(x, edgeX, r), py = THREE.MathUtils.lerp(y, edgeY, r);
      positions.push(px, (py - origin) * scalp.height, surface(scalp, px, py) + depth(px, py, r));
      shade(r, angle);
      const a = 1 + (ring - 1) * segments + i, b = 1 + (ring - 1) * segments + (i + 1) % segments;
      if (ring === 1) indices.push(0, a, b);
      else indices.push(a - segments, a, b, b, b - segments, a - segments);
    }
  }
  addPatch(art, positions, indices, typeof color === "string" ? color : null, colors);
}

function addPatch(art: Assembly, positions: number[], indices: number[], color: string | null, colors: number[] = []) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, color);
}

function ellipse(x: number, y: number, width: number, height: number) {
  return (angle: number): FacePoint => [x + Math.cos(angle) * width, y + Math.sin(angle) * height];
}

const eyeShapes = {
  almond: { width: .034, top: .029, bottom: .022, taper: 1.31 },
  round: { width: .031, top: .031, bottom: .026, taper: 1.02 },
  relaxed: { width: .035, top: .020, bottom: .017, taper: 1.46 },
  bright: { width: .035, top: .035, bottom: .027, taper: 1.12 },
};

function drawEyes(art: Assembly, look: ChanvrierAppearance, colors: Colors, scalp: ChanvrierScalp, layer: "iris" | "lids") {
  const { width, top, bottom, taper } = eyeShapes[look.eyes];
  const lid = shade(colors.skin, "#69463e", .42), rim = shade(colors.skin, "#bc7565", .32);
  const upperInk = "#402c25";
  const irisTint = portraitIrisTint(colors.eyes);
  const skin = new THREE.Color(colors.skin);
  const lightness = .2126 * skin.r + .7152 * skin.g + .0722 * skin.b;
  const contrast = .10 * (1 - THREE.MathUtils.smoothstep(lightness, .06, .56));
  const white = new THREE.Color("#f5e9d4").lerp(skin, contrast);
  const shadeWhite = new THREE.Color("#b19d87").lerp(skin, contrast + .05), tint = new THREE.Color();
  for (const side of [-1, 1]) {
    const x = side * .073;
    const edge = (angle: number): FacePoint => {
      const c = Math.cos(angle), s = Math.sin(angle);
      const h = s < 0 ? bottom : top;
      return [x + c * width, eyeHeight + Math.sign(s) * Math.abs(s) ** taper * h + side * c * .004];
    };
    const bulge = (px: number, py: number) => {
      const r = ((px - x) / width) ** 2 + ((py - eyeHeight) / (py < eyeHeight ? bottom : top)) ** 2;
      return .0030 + .0075 * Math.max(0, 1 - r);
    };
    if (layer === "iris") {
      const irisX = x + .0021, irisY = eyeHeight + (top - bottom) * .34;
      const irisW = width * .54, irisH = (top + bottom) * .41;
      patch(art, scalp, [irisX, irisY], ellipse(irisX, irisY, irisW, irisH),
        (px, py) => bulge(px, py) + .0029, irisTint, eyeHeight, [24, 7]);
      const catchlightX = irisX - irisW * .3, catchlightY = irisY + irisH * .35;
      patch(art, scalp, [catchlightX, catchlightY], ellipse(catchlightX, catchlightY, .0038, .0044),
        (px, py) => bulge(px, py) + .0052, "#fff5e0", eyeHeight, [12, 1]);
      continue;
    }
    patch(art, scalp, [x, eyeHeight], edge, bulge, (r, a) => tint.copy(white).lerp(shadeWhite, .39 * r * (.3 + .7 * Math.max(0, Math.sin(a)))), eyeHeight);
    for (const upper of [true, false]) {
      const lidPoints = Array.from({ length: 7 }, (_, i): CharacterPoint => {
        const [px, py] = edge(i * Math.PI / 6 * (upper ? 1 : -1));
        return [px, (py - eyeHeight) * scalp.height, surface(scalp, px, py) + bulge(px, py) + .0008];
      });
      art.sweep(lidPoints, upper ? [.001, .0021, .0035, .0039, .0033, .0020, .0007] : [.0006, .0017, .0022, .0025, .0021, .0014, .0007],
        upper ? upperInk : rim, 6);
      const fold = lidPoints.slice(1, -1).map(([px, y], i): CharacterPoint => {
        const rise = Math.sin((i + 1) * Math.PI / 6) * (upper ? .010 : -.007);
        const py = eyeHeight + y / scalp.height + rise;
        return [px, (py - eyeHeight) * scalp.height, surface(scalp, px, py) + .0023];
      });
      art.sweep(fold, upper ? [.0005, .0018, .0022, .0019, .0005] : [.0004, .0011, .0014, .0009, .0004], lid, 6);
    }
  }
}

function drawClosedEyes(art: Assembly, scalp: ChanvrierScalp) {
  for (const side of [-1, 1]) {
    const x = side * .073;
    lineOnFace(art, scalp, [[x - .025, eyeHeight + .001], [x - .011, eyeHeight - .005],
      [x + .009, eyeHeight - .006], [x + .024, eyeHeight + .002]], [.0005, .0019, .0021, .0007], ink, .0027);
  }
}

function lineOnFace(art: Assembly, scalp: ChanvrierScalp, points: [number, number][], widths: number[], color: string, offset = .003) {
  art.sweep(points.map(([x, y]) => [x, y * scalp.height, surface(scalp, x, y) + offset]), widths, color, 8);
}

function mouthStrip(
  art: Assembly, scalp: ChanvrierScalp, width: number, range: number,
  top: (u: number) => number, bottom: (u: number) => number, color: string, offset: number, relief = 0,
) {
  const positions: number[] = [], indices: number[] = [];
  const columns = 24, rows = 4;
  for (let col = 0; col <= columns; col++) {
    const u = (col / columns * 2 - 1) * range, x = width * u;
    const upper = top(u), lower = bottom(u);
    for (let row = 0; row <= rows; row++) {
      const y = THREE.MathUtils.lerp(lower, upper, row / rows);
      const roll = relief * Math.sin(Math.PI * row / rows) * (1 - (u / range) ** 2);
      positions.push(x, y * scalp.height, surface(scalp, x, y) + offset + roll);
      if (col === columns || row === rows) continue;
      const a = col * (rows + 1) + row, b = a + rows + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  addPatch(art, positions, indices, color);
}

function drawMouth(art: Assembly, scalp: ChanvrierScalp, mouth: ChanvrierAppearance["mouth"], skin: string) {
  const calm = mouth === "calm", grin = mouth === "grin";
  const width = calm ? .046 : grin ? .070 : .063;
  const lip = shade(skin, "#ac625b", .38), lowerLip = shade(skin, "#d88c75", .30);
  const crease = shade(skin, "#42262c", .68);
  const upper = (u: number) => .026 + (calm ? .003 : grin ? .021 : .015) * u ** 2 + .0033 * u;
  const opening = calm ? .0035 : grin ? .035 : .018;
  const lower = (u: number) => upper(u) - opening * Math.max(0, 1 - u * u) ** .97;
  const bow = (u: number) => Math.max(0, 1 - u * u) * (.0029 + .0041 * Math.exp(-((Math.abs(u) - .27) ** 2) / .05));
  mouthStrip(art, scalp, width, 1, u => upper(u) + bow(u), upper, lip, .0023, .0035);
  mouthStrip(art, scalp, width, .97, lower, u => lower(u) - .0077 * (1 - (u / .97) ** 2), lowerLip, .0018, .0037);
  if (!calm) {
    const teethWidth = grin ? .75 : .68, teethHeight = grin ? .0105 : .0055;
    const tongueWidth = grin ? .54 : .48, tongueHeight = grin ? .010 : .0055;
    mouthStrip(art, scalp, width, 1, upper, lower, "#542d33", .0027);
    mouthStrip(art, scalp, width, teethWidth, u => upper(u) - .0018,
      u => upper(u) - .0018 - teethHeight * Math.max(0, 1 - (u / teethWidth) ** 2) ** .56, ivory, .0042);
    const tongueTop = (u: number) => lower(u) + tongueHeight * Math.max(0, 1 - (u / tongueWidth) ** 2) ** .62;
    mouthStrip(art, scalp, width, tongueWidth, tongueTop, u => lower(u) + Math.min(.0018, tongueTop(u) - lower(u)), "#b77168", .0040);
  } else {
    mouthStrip(art, scalp, width, .94, upper, lower, crease, .0032);
  }
  const angles = [-1, -.83, -.63, -.40, -.18, .05, .31, .55, .77, .92, 1];
  lineOnFace(art, scalp, angles.map(u => [u * width, upper(u)]),
    [.0005, .0012, .0013, .0015, .0017, .0017, .0015, .0013, .0011, .0008, .0004], crease, .0030);
  if (!calm) for (const side of [-1, 1]) {
    lineOnFace(art, scalp, [[side * (width - .003), upper(side) - .007],
      [side * (width + .001), upper(side)], [side * (width - .003), upper(side) + .006]],
    [.0006, .0015, .0006], crease, .0016);
  }
}

const noseShapes = {
  small: { width: .047, tip: .021, depth: .032, wing: .019, bridge: .016, y: .092 },
  round: { width: .054, tip: .029, depth: .046, wing: .023, bridge: .018, y: .094 },
  wide: { width: .067, tip: .033, depth: .038, wing: .032, bridge: .024, y: .090 },
};

const noseResolution = [28, 6] as const;

function drawNose(art: Assembly, scalp: ChanvrierScalp, nose: ChanvrierAppearance["nose"], skin: string) {
  const { width, tip, depth, wing, bridge, y: tipY } = noseShapes[nose];
  const center = .113, height = .079;
  const depthAt: Depth = (x, y, r) => {
    const tipShape = Math.exp(-((x / tip) ** 2 + ((y - tipY) / .033) ** 2)) * depth;
    const nasalBridge = Math.exp(-((x / bridge) ** 2 + ((y - .139) / .044) ** 2)) * .014;
    const alae = Math.exp(-(((Math.abs(x) - wing) / .016) ** 2 + ((y - tipY + .008) / .018) ** 2)) * (nose === "wide" ? .014 : .010);
    return (tipShape + nasalBridge + alae) * THREE.MathUtils.smoothstep(1 - r, 0, .36) - .0014;
  };
  const base = new THREE.Color(skin), tint = new THREE.Color();
  const red = base.clone().lerp(new THREE.Color("#ce8068"), .38), warmLight = base.clone().lerp(new THREE.Color("#f2c6a3"), .21);
  patch(art, scalp, [0, center], ellipse(0, center, width, height), depthAt, (r, a) =>
    tint.copy(base).lerp(red, (1 - r) * .56 * Math.max(0, -Math.sin(a)))
      .lerp(warmLight, (1 - r) * .26 * Math.max(0, Math.sin(a))), 0, noseResolution);
  const nostril = shade(skin, "#51302b", .58);
  for (const side of [-1, 1]) {
    const contours: FacePoint[] = [[side * (wing - .008), tipY - .014], [side * (wing - .002), tipY - .017],
      [side * (wing + .004), tipY - .014], [side * (wing + .008), tipY - .009]];
    const points = contours.map(([x, y]): CharacterPoint => {
      const r = Math.hypot(x / width, (y - center) / height);
      return [x, y * scalp.height, surface(scalp, x, y) + depthAt(x, y, r) + .0007];
    });
    art.sweep(points, [.0005, .0017, .0015, .0004], nostril, 7);
  }
}

function softenNoseShading(mesh: THREE.Mesh) {
  const surfaceCount = 1 + noseResolution[0] * noseResolution[1];
  const normals = mesh.geometry.getAttribute("normal"), normal = new THREE.Vector3();
  // The underside catches reflected light from the cheeks and the lower lip.
  for (let i = 0; i < surfaceCount; i++) {
    const down = -normals.getY(i);
    if (down < .19) continue;
    normal.fromBufferAttribute(normals, i);
    normal.y *= 1 - .57 * THREE.MathUtils.smoothstep(down, .19, .82);
    normal.normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
}

function drawBrows(art: Assembly, scalp: ChanvrierScalp, brow: ChanvrierAppearance["eyebrows"], hair: string, skin: string) {
  const arch = brow === "arched" ? .241 : brow === "thick" ? .226 : .230;
  const width = brow === "thick" ? .0065 : .0042;
  const color = shade(shade(hair, "#432c28", .18), skin, .10);
  for (const side of [-1, 1]) {
    lineOnFace(art, scalp, [[side * .033, .202], [side * .052, arch - .006], [side * .075, arch], [side * .100, arch - .008], [side * .124, .199]],
      [.0013, width * .88, width, width * .66, .0008], color, .002);
  }
}

function drawFacialHair(art: Assembly, scalp: ChanvrierScalp, kind: ChanvrierAppearance["facialHair"], hair: string, skin: string) {
  const dark = shade(hair, "#332526", .26), highlight = shade(hair, "#dfac83", .13);
  const width = Math.min(.166, scalp.radius(.072 * scalp.height) - .014);
  const beardTop = (x: number) => -.016 + .135 * Math.abs(x) ** 2.04 + .003 * Math.cos(x * 27);
  const beardBottom = (x: number) => -.097 + .148 * Math.abs(x) ** 1.55;
  if (kind === "beard") {
    mouthStrip(art, scalp, width, 1, beardTop, beardBottom, hair, .0030, .0095);
    for (let i = 0; i < 18; i++) {
      const u = (i - 8.5) / 10, x = u * width;
      const y = THREE.MathUtils.lerp(beardTop(u), beardBottom(u), .36 + .17 * Math.sin(i * 3.6));
      lineOnFace(art, scalp, [[x, y], [x * .97, y - .009], [x * .93, y - .015]], [.0003, .0010, .0003], i % 2 ? dark : highlight, .010);
    }
  }
  if (kind === "stubble") {
    const pigments = [.32, .45, .50].map(mix => shade(skin, hair, mix));
    for (let i = 0; i < 86; i++) {
      const u = Math.sin(i * 2.39996) * .97, x = u * width;
      const y = THREE.MathUtils.lerp(beardTop(u), beardBottom(u), .5 + .42 * Math.sin(i * 4.14));
      patch(art, scalp, [x, y], ellipse(x, y, .0012 + (i % 3) * .0003, .0016), () => .0014, pigments[i % 3], 0, [7, 1]);
    }
  }
  if (kind === "moustache" || kind === "beard") {
    for (const side of [-1, 1]) {
      const h = scalp.height;
      art.add(portraitMoustache(side, .066, .065 * h, h, hair, (x, y) => surface(scalp, x, y / h)), null);
    }
  }
}

function drawAccessory(art: Assembly, scalp: ChanvrierScalp, kind: "glasses" | "round-glasses" | "earrings", dye?: string) {
  if (kind === "earrings") {
    const x = scalp.radius(.057 * scalp.height) + .020;
    for (const side of [-1, 1]) {
      art.ball([side * x, .044 * scalp.height, .034], .0088, dye ?? "#e1af55", [.85, .82, .55]);
      art.add(new THREE.TorusGeometry(.016, .0032, 8, 20).rotateY(side * .64), dye ?? "#c99743", [side * x, .024 * scalp.height, .037]);
    }
    return;
  }
  const round = kind === "round-glasses";
  const h = eyeHeight * scalp.height;
  for (const side of [-1, 1]) {
    const x = side * .075, z = surface(scalp, x, eyeHeight) + .039;
    const color = dye ?? (round ? "#6a4b38" : "#3c4039");
    if (round) art.add(new THREE.TorusGeometry(.0535, .0039, 8, 28).scale(.94, 1, 1).rotateY(side * .30), color, [x, h + .002, z]);
    else {
      const points: CharacterPoint[] = [[-.047, .035, .012], [.046, .037, -.012], [.057, .019, -.017],
        [.049, -.030, -.013], [0, -.040, 0], [-.046, -.030, .010], [-.053, .017, .014], [-.047, .035, .012]];
      art.sweep(points.map(([dx, dy, dz]) => [x + side * dx, h + dy, z + dz]), points.map(() => .0039), color, 8);
    }
    art.sweep([[side * .124, h + .021, z - .015], [side * .161, h + .015, .103], [side * .202, h - .033, .028]], [.0037, .004, .0028], color, 7);
  }
  const centerZ = surface(scalp, .075, eyeHeight) + .053;
  art.sweep([[-.027, h + .001, centerZ], [0, h + .010, centerZ + .004], [.027, h + .001, centerZ]], [.003, .0038, .003], dye ?? "#51443a", 7);
}

export function createChanvrierHead(parent: THREE.Group, material: THREE.Material) {
  const skull = createPart(parent, "chanvrier-skin", material);
  const eyes = new THREE.Group();
  const lids = new THREE.Group();
  lids.visible = false;
  parent.add(eyes, lids);
  const eyeArt = createPart(eyes, "chanvrier-eyes", material);
  const sclera = createPart(eyes, "chanvrier-eyelids", material);
  let irisMesh: THREE.Mesh | undefined, browMesh: THREE.Mesh | undefined;
  const lidArt = createPart(lids, "chanvrier-closed-eyes", material);
  const nose = createPart(parent, "chanvrier-nose", material);
  const mouth = createPart(parent, "chanvrier-mouth", material);
  const brows = createPart(parent, "chanvrier-brows", material);
  const facialHair = createPart(parent, "chanvrier-facial-hair", material);
  const accessory = createPart(parent, "chanvrier-face-accessory", material);
  const hair = createPart(parent, "chanvrier-hair", material);
  let face: Face = "oval";
  let scalp = createChanvrierScalp(face);
  return {
    update(look: ChanvrierAppearance, colors: Colors) {
      if (look.face !== face) {
        face = look.face;
        scalp = createChanvrierScalp(face);
      }
      const { skin } = colors;
      eyes.position.y = eyeHeight * scalp.height;
      skull([face, skin], art => drawSkin(art, scalp, skin));
      sclera([face, look.eyes, skin], art => drawEyes(art, look, colors, scalp, "lids"));
      irisMesh = eyeArt([face, look.eyes, colors.eyes], art => drawEyes(art, look, colors, scalp, "iris")) ?? irisMesh;
      lidArt([face], art => drawClosedEyes(art, scalp));
      const noseMesh = nose([face, look.nose, skin], art => drawNose(art, scalp, look.nose, skin));
      if (noseMesh) softenNoseShading(noseMesh);
      mouth([face, look.mouth, skin], art => drawMouth(art, scalp, look.mouth, skin));
      browMesh = brows([face, look.eyebrows, colors.hair, skin], art => drawBrows(art, scalp, look.eyebrows, colors.hair, skin)) ?? browMesh;
      facialHair([face, look.facialHair, colors.hair, skin], art => drawFacialHair(art, scalp, look.facialHair, colors.hair, skin), look.facialHair !== "none");
      const { accessory: item } = look;
      if (item === "glasses" || item === "round-glasses" || item === "earrings") {
        const dye = look.dyes?.accent || (look.accentColor === "cream" ? undefined : colors.accent);
        accessory([face, item, dye ?? ""], art => drawAccessory(art, scalp, item, dye));
      } else accessory([], () => {}, false);
      hair([face, look.hair, colors.hair, skin, look.headwear],
        art => createChanvrierHair(art, scalp, look.hair, colors.hair, look.headwear, skin), look.hair !== "bald");
    },
    blink(elapsedSeconds?: number, walking = 0, reach = 0, yaw = 0) {
      const cycle = (elapsedSeconds ?? 0) % 4.35;
      const blink = Math.max(0, 1 - Math.abs(cycle - 2.58) / .115);
      const time = elapsedSeconds ?? 0;
      // A brief glance holds between saccades. A working character instead looks
      // down along the hand trajectory without shifting the eyelid off the socket.
      const glance = Math.tanh(3.2*Math.sin(time*.94)) * Math.sin(time*.40);
      if (irisMesh) {
        irisMesh.rotation.y = .024*glance*(1-reach)*(1-walking*.68) + .035*yaw;
        irisMesh.position.y = -.0039*reach + .0012*Math.sin(time*.83)*(1-reach);
        irisMesh.position.z = .00055*(reach+Math.abs(glance));
      }
      if (browMesh) {
        browMesh.position.y = .0016*Math.sin(time*1.09) - .0029*reach;
        browMesh.rotation.z = .007*glance*(1-reach);
      }
      eyes.scale.y = (1 - blink * .94) * (1 - .035*reach);
      eyes.position.y = (eyeHeight - .0031*blink)*scalp.height;
      eyes.visible = blink < .83;
      lids.visible = !eyes.visible;
    },
  };
}
