import * as THREE from "three";
import type { ChanvrierAppearance, getChanvrierColors } from "@/lib/arena-chanvrier";
import { CHANVRIER_EXPRESSION_TARGETS, CHANVRIER_FACE_POSES, type ChanvrierExpression } from "./chanvrier-expression";
import { recomputeLatheNormals } from "./chanvrier-geometry";
import { createChanvrierHair, type ChanvrierScalp } from "./chanvrier-hair";
import { Assembly, type CharacterPoint } from "./world/village-character-art";
import { createPortraitEar, portraitMoustache } from "./world/village-portrait-sculpt";

type Colors = ReturnType<typeof getChanvrierColors>;
type Face = ChanvrierAppearance["face"];
const eyeHeight = .158;
const eyeSpacing = .076;
const ink = "#3c261e";
const ivory = "#f7e6c9";
const sections = [-.101, -.087, -.062, -.030, .014, .066, .122, .184, .235, .283, .322, .348, .355];
const oval = [0, .072, .115, .145, .171, .190, .198, .194, .182, .157, .117, .065, 0];
const contours: Record<Face, { radii: number[]; height: number }> = {
  oval: { radii: oval, height: 1 },
  round: { radii: [0, .081, .124, .153, .174, .198, .205, .199, .185, .156, .114, .062, 0], height: 1 },
  square: { radii: [0, .090, .147, .171, .183, .190, .195, .195, .183, .158, .117, .065, 0], height: .98 },
  heart: { radii: [0, .055, .091, .126, .158, .182, .194, .198, .188, .159, .117, .063, 0], height: 1 },
  long: { radii: [0, .063, .102, .131, .154, .171, .181, .184, .176, .152, .112, .063, 0], height: 1.06 },
  angular: { radii: [0, .066, .111, .146, .164, .176, .197, .187, .177, .155, .118, .064, 0], height: 1 },
  pear: { radii: [0, .082, .144, .181, .197, .201, .194, .186, .172, .147, .110, .059, 0], height: .99 },
  cheeked: { radii: [0, .059, .104, .133, .164, .197, .210, .199, .182, .155, .114, .062, 0], height: .99 },
};

const reliefByFace: Record<Face, { cheekY: number; cheek: number; jaw: number; chin: number }> = {
  oval: { cheekY: .099, cheek: .020, jaw: -.002, chin: .013 },
  round: { cheekY: .085, cheek: .020, jaw: .003, chin: .012 },
  square: { cheekY: .091, cheek: .017, jaw: .013, chin: .016 },
  heart: { cheekY: .112, cheek: .022, jaw: -.008, chin: .017 },
  long: { cheekY: .101, cheek: .013, jaw: -.004, chin: .018 },
  angular: { cheekY: .119, cheek: .027, jaw: .011, chin: .012 },
  pear: { cheekY: .072, cheek: .023, jaw: .011, chin: .013 },
  cheeked: { cheekY: .076, cheek: .030, jaw: -.005, chin: .011 },
};

const noseShapes = {
  small: { width: .030, height: .030, depth: .041, bridge: .010, y: .093 },
  round: { width: .037, height: .034, depth: .050, bridge: .009, y: .095 },
  wide: { width: .049, height: .030, depth: .047, bridge: .014, y: .091 },
};

export function createChanvrierScalp(face: Face, nose: ChanvrierAppearance["nose"] = "small"): ChanvrierScalp {
  const { radii, height } = contours[face];
  const feature = reliefByFace[face];
  const tip = noseShapes[nose];
  const curve = new THREE.CatmullRomCurve3(sections.map((y, index) => new THREE.Vector3(radii[index], y * height, 0)));
  const profile = curve.getPoints(54).map(point => new THREE.Vector2(Math.max(0, point.x), point.y));
  return {
    profile,
    height,
    relief(x, y, z) {
      // The mandible projects in front of the throat. Moving the entire section
      // brings the underside toward the chin while leaving room for the nape.
      const jawSet = (face === "round" ? .044 : .031) * (1 - THREE.MathUtils.smoothstep(y, -.112, .084));
      if (z <= 0 || y > .260) return z + jawSet;
      const side = Math.abs(x);
      const cheek = feature.cheek * softWeight(side, y, .113, feature.cheekY, .078, .076);
      const corner = feature.jaw * ovalWeight(side, y, .108, -.009, .080, .061);
      const socket = .013 * ovalWeight(side, y, eyeSpacing, eyeHeight, .065, .055);
      const brow = .014 * ovalWeight(side, y, eyeSpacing, .214, .081, .046);
      const chin = feature.chin * softWeight(x, y, 0, -.051, .094, .050);
      const muzzle = .010 * softWeight(x, y, 0, .031, .071, .040);
      const philtrum = .0016 * ovalWeight(x, y, 0, .051, .020, .027);
      const tipRadius = (x / (tip.width * 1.38)) ** 2 + ((y - tip.y) / (tip.height * 1.38)) ** 2;
      const noseTip = tip.depth * Math.max(0, 1 - tipRadius * (.57 + .43 * tipRadius)) ** 1.65;
      const bridge = tip.bridge * ovalWeight(x, y, 0, .137, tip.width * .93, .058);
      return z + jawSet + (cheek + corner - socket + brow + chin + muzzle - philtrum + noseTip + bridge)
        * THREE.MathUtils.smoothstep(z, .018, .112);
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

function softWeight(x: number, y: number, centerX: number, centerY: number, width: number, height: number) {
  return Math.exp(-(((x - centerX) / width) ** 2 + ((y - centerY) / height) ** 2));
}

function surface(scalp: ChanvrierScalp, x: number, y: number) {
  const z = Math.sqrt(Math.max(0, scalp.radius(y * scalp.height) ** 2 - x * x)) * .91;
  return scalp.relief(x, y, z);
}

type FaceTargets = Pick<THREE.BufferGeometry["morphAttributes"], "position" | "normal">;
const faceTargets = new Map<string, FaceTargets>();
const faceTargetLimit = 24;

function createPart(parent: THREE.Group, name: string, material: THREE.Material) {
  let key: string | undefined;
  let mesh: THREE.Mesh | undefined;
  return (dependencies: string[], draw: (art: Assembly, expression: ChanvrierExpression) => void, visible = true, morphShape?: string[] | null) => {
    const nextKey = dependencies.join("|");
    if (nextKey === key) return;
    key = nextKey;
    mesh?.removeFromParent();
    mesh?.geometry.dispose();
    mesh = undefined;
    if (!visible) return;
    const art = new Assembly();
    draw(art, "neutral");
    mesh = art.finish(name, parent, material);
    if (morphShape !== undefined) {
      const morphKey = morphShape && [name, ...morphShape].join("|");
      let targets = morphKey ? faceTargets.get(morphKey) : undefined;
      if (!targets) {
        const geometries = CHANVRIER_EXPRESSION_TARGETS.map(expression => {
          draw(art, expression);
          const target = art.finish(expression, parent, material);
          target.removeFromParent();
          return target.geometry;
        });
        targets = {
          position: geometries.map(geometry => geometry.getAttribute("position")),
          normal: geometries.map(geometry => geometry.getAttribute("normal")),
        };
        for (const geometry of geometries) geometry.dispose();
      }
      if (morphKey) {
        faceTargets.delete(morphKey);
        faceTargets.set(morphKey, targets);
        const oldest = faceTargets.keys().next().value;
        if (faceTargets.size > faceTargetLimit && oldest !== undefined) faceTargets.delete(oldest);
      }
      // Each mesh keeps its own geometry, materials and expression weights.
      // Only read-only pose attributes are shared between matching shapes.
      mesh.geometry.morphAttributes.position = targets.position?.slice();
      mesh.geometry.morphAttributes.normal = targets.normal?.slice();
      mesh.updateMorphTargets();
    }
    mesh.castShadow = false;
    return mesh;
  };
}

function drawSkin(art: Assembly, scalp: ChanvrierScalp, face: Face, skin: string, nose: ChanvrierAppearance["nose"]) {
  const skull = new THREE.LatheGeometry(scalp.profile, 80, Math.PI).scale(1, 1, .91);
  const vertices = skull.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) vertices.setZ(i, scalp.relief(vertices.getX(i), vertices.getY(i) / scalp.height, vertices.getZ(i)));
  recomputeLatheNormals(skull);
  paintSkin(skull, scalp, skin, nose);
  art.add(skull, null);
  const cartilage = shade(skin, "#a35440", .42);
  for (const side of [-1, 1]) {
    const x = side * (scalp.radius(.083 * scalp.height) + .003), h = scalp.height;
    const ear = createPortraitEar(skin, cartilage, .044, .057 * h, .058, side);
    ear.rotateZ(side * -.16).rotateY(side * (face === "round" ? .27 : .52));
    art.add(ear, null, [x, .076 * h, .001]);
  }
}

function paintSkin(geometry: THREE.BufferGeometry, scalp: ChanvrierScalp, skin: string, nose: ChanvrierAppearance["nose"]) {
  const vertices = geometry.getAttribute("position"), colors = new Float32Array(vertices.count * 3);
  const base = new THREE.Color(skin), tint = new THREE.Color();
  const rouge = base.clone().lerp(new THREE.Color("#e97859"), .41);
  const shadow = base.clone().lerp(new THREE.Color("#915e58"), .25).multiplyScalar(.91);
  const light = base.clone().lerp(new THREE.Color("#f9d0ad"), .24);
  const tip = noseShapes[nose];
  const tipLight = base.clone().multiplyScalar(1.17).lerp(new THREE.Color("#f8b985"), .042);
  const tipShade = base.clone().lerp(new THREE.Color("#b0714c"), .16).multiplyScalar(.98);
  for (let i = 0; i < vertices.count; i++) {
    const x = Math.abs(vertices.getX(i)), y = vertices.getY(i) / scalp.height, z = vertices.getZ(i);
    const front = THREE.MathUtils.smoothstep(z, .022, .123);
    const cheeks = .55 * softWeight(x, y, .132, .085, .067, .060);
    const noseLight = ovalWeight(x, y, 0, tip.y + .009, tip.width * 1.08, .031);
    const noseShade = .50 * ovalWeight(x, y, 0, tip.y - .025, tip.width * 1.08, .025);
    const temple = .16 * ovalWeight(x, y, .142, .181, .095, .101);
    const eyes = .13 * ovalWeight(x, y, .074, eyeHeight, .073, .067);
    const jaw = .08 * softWeight(x, y, .126, -.025, .076, .063);
    const edgeLight = .17 * ovalWeight(x, y, .119, .123, .087, .060) + .17 * ovalWeight(x, y, .056, .238, .111, .068);
    tint.copy(base).lerp(rouge, cheeks * front).lerp(shadow, (temple + eyes + jaw) * front).lerp(light, edgeLight * front);
    tint.lerp(tipShade, noseShade * front).lerp(tipLight, noseLight * front);
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
  almond: { width: .032, top: .043, bottom: .040, taper: 1.05 },
  round: { width: .032, top: .035, bottom: .034, taper: 1 },
  relaxed: { width: .032, top: .025, bottom: .026, taper: 1.23 },
  bright: { width: .032, top: .044, bottom: .040, taper: 1.03 },
};

function drawEyes(art: Assembly, look: ChanvrierAppearance, color: string, scalp: ChanvrierScalp, layer: "iris" | "lids", expression: ChanvrierExpression) {
  const eye = eyeShapes[look.eyes];
  const pose = CHANVRIER_FACE_POSES[expression];
  const { width, taper } = eye, top = eye.top * pose.eyeTop, bottom = eye.bottom * pose.eyeBottom;
  const pupil = new THREE.Color("#2b1c16"), irisColor = new THREE.Color(color), tint = new THREE.Color();
  for (const side of [-1, 1]) {
    const x = side * eyeSpacing;
    const shape = (angle: number, centerX: number, sizeX: number, sizeY: number): FacePoint => {
      const c = Math.cos(angle), s = Math.sin(angle);
      const h = s < 0 ? bottom : top;
      return [centerX + c * width * sizeX, eyeHeight + (Math.sign(s) * Math.abs(s) ** taper * h + side * c * (.003 + pose.eyeTilt)) * sizeY];
    };
    const bulge = (px: number, py: number) => {
      const r = ((px - x) / width) ** 2 + ((py - eyeHeight) / (py < eyeHeight ? bottom : top)) ** 2;
      return .0014 + .0068 * Math.max(0, 1 - r);
    };
    if (layer === "iris") {
      const irisX = x - side * width * .115;
      patch(art, scalp, [irisX, eyeHeight], a => shape(a, irisX, .80, .92), (px, py) => bulge(px, py) + .0013, (r, a) => {
        const lowerLight = 1 - THREE.MathUtils.smoothstep(Math.sin(a), -.85, .3);
        const ring = THREE.MathUtils.smoothstep(r, .52, .85) * (1 - .65 * THREE.MathUtils.smoothstep(r, .88, 1));
        return tint.copy(pupil).lerp(irisColor, ring * (.18 + .48 * lowerLight));
      }, eyeHeight, [28, 7]);
      const catchlightX = irisX - width * .21, catchlightY = eyeHeight + top * .48;
      patch(art, scalp, [catchlightX, catchlightY], ellipse(catchlightX, catchlightY, .0049, .0058),
        (px, py) => bulge(px, py) + .0027, "#fff8e9", eyeHeight, [14, 1]);
      continue;
    }
    patch(art, scalp, [x, eyeHeight], a => shape(a, x, 1, 1), bulge, ivory, eyeHeight, [28, 5]);
    const lidPoints = Array.from({ length: 9 }, (_, i): CharacterPoint => {
      const [px, py] = shape(i * Math.PI / 8, x, 1, 1);
      return [px, (py - eyeHeight) * scalp.height, surface(scalp, px, py) + bulge(px, py) + .0004];
    });
    art.sweep(lidPoints, [0, .0008, .0017, .0022, .0024, .0022, .0017, .0008, 0], ink, 7);
  }
}

function drawClosedEyes(art: Assembly, scalp: ChanvrierScalp) {
  for (const side of [-1, 1]) {
    const x = side * eyeSpacing;
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

function drawMouth(art: Assembly, scalp: ChanvrierScalp, mouth: ChanvrierAppearance["mouth"], skin: string, expression: ChanvrierExpression) {
  const calm = mouth === "calm", grin = mouth === "grin";
  const parameters = {
    neutral: { width: calm ? .043 : grin ? .074 : .065, y: .017, arc: calm ? .006 : .036, top: grin ? .004 : .0030, bottom: grin ? .016 : .0032 },
    smile: { width: .082, y: .021, arc: .048, top: grin ? .006 : .0042, bottom: grin ? .020 : .006 },
    surprise: { width: .024, y: .014, arc: .001, top: .020, bottom: .027 },
    focus: { width: .050, y: .016, arc: -.007, top: .0021, bottom: .0026 },
  }[expression];
  const arc = (u: number) => parameters.y + parameters.arc * (1 - Math.sqrt(1 - .90 * u * u)) + .0014 * u;
  const taper = (u: number) => Math.sqrt(1 - u * u);
  const upper = (u: number) => arc(u) + parameters.top * taper(u);
  const lower = (u: number) => arc(u) - parameters.bottom * taper(u);
  // A shallow roll catches light at the lower lip. Both skin-coloured edges
  // follow the underlying cheek so the expression still reads in profile.
  mouthStrip(art, scalp, parameters.width, 1, u => upper(u) + .0038 * taper(u), upper, shade(skin, "#9f5140", .085), .0003, .0014);
  mouthStrip(art, scalp, parameters.width, 1, lower, u => lower(u) - .0065 * taper(u), shade(skin, "#efaa83", .12), .0004, .0023);
  mouthStrip(art, scalp, parameters.width, 1, upper, lower, ink, .0022);
  if (grin) {
    const teeth = expression === "neutral" || expression === "smile" ? .0062 : 0;
    mouthStrip(art, scalp, parameters.width, .77, u => upper(u) - .0022, u => upper(u) - .0022 - teeth * taper(u / .77), ivory, .0031);
  }
}

function drawBrows(art: Assembly, scalp: ChanvrierScalp, brow: ChanvrierAppearance["eyebrows"], hair: string, skin: string, expression: ChanvrierExpression) {
  const pose = CHANVRIER_FACE_POSES[expression];
  const arch = (brow === "arched" ? .235 : .230) + pose.browHeight;
  const thickness = brow === "thick" ? .015 : brow === "arched" ? .010 : .012;
  const color = shade(shade(hair, "#43271b", .54), skin, .028);
  for (const side of [-1, 1]) {
    const x = side * eyeSpacing;
    const edge = (angle: number): FacePoint => {
      const u = Math.cos(angle), outward = side * u;
      const y = arch - (.016 + pose.browCurve) * outward ** 2 - (.008 - pose.browTilt) * outward;
      return [x + u * .045, y + Math.sin(angle) * thickness * (1 - .43 * outward)];
    };
    patch(art, scalp, [x, arch], edge, (_, __, r) => .0011 + .0048 * (1 - r * r), color, 0, [28, 4]);
  }
}

function drawFacialHair(art: Assembly, scalp: ChanvrierScalp, kind: ChanvrierAppearance["facialHair"], hair: string, skin: string, expression: ChanvrierExpression) {
  const dark = shade(hair, "#332526", .26), highlight = shade(hair, "#dfac83", .13);
  const width = Math.min(.166, scalp.radius(.072 * scalp.height) - .014);
  const lipSpace = expression === "surprise" ? .033 : expression === "smile" ? .027 : .023;
  const beardTop = (u: number) => .001 + .134 * Math.abs(u) ** 2.26 + .0021 * Math.cos(u * 27)
    - lipSpace * (1 - THREE.MathUtils.smoothstep(Math.abs(u), .21, .68));
  const beardBottom = (u: number) => -.096 + .152 * Math.abs(u) ** 1.60;
  if (kind === "beard") {
    mouthStrip(art, scalp, width, 1, beardTop, beardBottom, hair, .0020, .0105);
    for (let i = 0; i < 18; i++) {
      const u = (i - 8.5) / 10, x = u * width;
      const y = THREE.MathUtils.lerp(beardTop(u), beardBottom(u), .36 + .17 * Math.sin(i * 3.6));
      lineOnFace(art, scalp, [[x, y], [x * .97, y - .009], [x * .93, y - .015]], [.0003, .0010, .0003], i % 2 ? dark : highlight, .0107);
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
    const height = expression === "surprise" ? .075 : expression === "smile" ? .069 : .065;
    for (const side of [-1, 1]) {
      const h = scalp.height;
      art.add(portraitMoustache(side, .066, height * h, h, hair, (x, y) => surface(scalp, x, y / h)), null);
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
    const x = side * .075, z = surface(scalp, x, eyeHeight) + (round ? .026 : .039);
    const color = dye ?? (round ? "#6a4b38" : "#3c4039");
    if (round) art.add(new THREE.TorusGeometry(.0535, .0039, 8, 28).scale(.94, 1, 1).rotateY(side * .30), color, [x, h + .002, z]);
    else {
      const points: CharacterPoint[] = [[-.047, .035, .012], [.046, .037, -.012], [.057, .019, -.017],
        [.049, -.030, -.013], [0, -.040, 0], [-.046, -.030, .010], [-.053, .017, .014], [-.047, .035, .012]];
      art.sweep(points.map(([dx, dy, dz]) => [x + side * dx, h + dy, z + dz]), points.map(() => .0039), color, 8);
    }
    const temple = scalp.radius(.152 * scalp.height), ear = scalp.radius(.104 * scalp.height);
    art.sweep([[side * .124, h + .021, z - .015], [side * (temple - .018), h + .011, .106],
      [side * (ear + .009), .104 * scalp.height, .031]], [.0037, .0037, .0028], color, 7);
  }
  const centerZ = surface(scalp, .075, eyeHeight) + (round ? .040 : .053);
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
  let irisMesh: THREE.Mesh | undefined, scleraMesh: THREE.Mesh | undefined;
  let browMesh: THREE.Mesh | undefined, mouthMesh: THREE.Mesh | undefined, facialHairMesh: THREE.Mesh | undefined;
  const lidArt = createPart(lids, "chanvrier-closed-eyes", material);
  const mouth = createPart(parent, "chanvrier-mouth", material);
  const brows = createPart(parent, "chanvrier-brows", material);
  const facialHair = createPart(parent, "chanvrier-facial-hair", material);
  const accessory = createPart(parent, "chanvrier-face-accessory", material);
  const hair = createPart(parent, "chanvrier-hair", material);
  let face: Face = "oval";
  let nose: ChanvrierAppearance["nose"] = "small";
  let scalp = createChanvrierScalp(face, nose);
  let targetIndex = -1;
  let expressionStrength = 0;

  function applyExpression() {
    for (const mesh of [irisMesh, scleraMesh, browMesh, mouthMesh, facialHairMesh]) {
      const weights = mesh?.morphTargetInfluences;
      if (!weights) continue;
      weights.fill(0);
      if (targetIndex >= 0) weights[targetIndex] = expressionStrength;
    }
  }

  return {
    setExpression(expression: ChanvrierExpression, strength = 1) {
      const index = CHANVRIER_EXPRESSION_TARGETS.findIndex(target => target === expression);
      const amount = Number.isFinite(strength) ? THREE.MathUtils.clamp(strength, 0, 1) : 1;
      if (targetIndex === index && expressionStrength === amount) return;
      targetIndex = index;
      expressionStrength = amount;
      applyExpression();
    },
    update(look: ChanvrierAppearance, colors: Colors) {
      if (look.face !== face || look.nose !== nose) {
        face = look.face;
        nose = look.nose;
        scalp = createChanvrierScalp(face, nose);
      }
      const { skin } = colors;
      eyes.position.y = eyeHeight * scalp.height;
      skull([face, skin, nose], art => drawSkin(art, scalp, face, skin, nose));
      const eyeShape = [face, nose, look.eyes], mouthShape = [face, nose, look.mouth], browShape = [face, nose, look.eyebrows];
      scleraMesh = sclera(eyeShape, (art, expression) => drawEyes(art, look, colors.eyes, scalp, "lids", expression), true, eyeShape) ?? scleraMesh;
      irisMesh = eyeArt([...eyeShape, colors.eyes], (art, expression) => drawEyes(art, look, colors.eyes, scalp, "iris", expression), true, eyeShape) ?? irisMesh;
      lidArt([face, nose], art => drawClosedEyes(art, scalp));
      mouthMesh = mouth([...mouthShape, skin], (art, expression) => drawMouth(art, scalp, look.mouth, skin, expression), true, mouthShape) ?? mouthMesh;
      browMesh = brows([...browShape, colors.hair, skin], (art, expression) => drawBrows(art, scalp, look.eyebrows, colors.hair, skin, expression), true, browShape) ?? browMesh;
      const hairStyle = look.facialHair;
      const facialHairPart = facialHair([face, nose, hairStyle, colors.hair, skin],
        (art, expression) => drawFacialHair(art, scalp, hairStyle, colors.hair, skin, expression), hairStyle !== "none",
        hairStyle === "beard" || hairStyle === "moustache" ? null : undefined);
      facialHairMesh = hairStyle === "none" ? undefined : facialHairPart ?? facialHairMesh;
      const { accessory: item } = look;
      if (item === "glasses" || item === "round-glasses" || item === "earrings") {
        const dye = look.dyes?.accent || (look.accentColor === "cream" ? undefined : colors.accent);
        accessory([face, nose, item, dye ?? ""], art => drawAccessory(art, scalp, item, dye));
      } else accessory([], () => {}, false);
      hair([face, look.hair, colors.hair, skin, look.headwear],
        art => createChanvrierHair(art, scalp, look.hair, colors.hair, look.headwear, skin), look.hair !== "bald");
      applyExpression();
    },
    blink(elapsedSeconds?: number, walking = 0, reach = 0, yaw = 0) {
      const cycle = (elapsedSeconds ?? 0) % 4.35;
      const blink = Math.max(0, 1 - Math.abs(cycle - 2.58) / .115);
      const time = elapsedSeconds ?? 0;
      // A brief glance holds between saccades. A working character instead looks
      // down along the hand trajectory without shifting the eyelid off the socket.
      const glance = Math.tanh(3.2*Math.sin(time*.94)) * Math.sin(time*.40);
      if (irisMesh) {
        irisMesh.rotation.y = .008*glance*(1-reach)*(1-walking*.68) + .012*yaw;
        irisMesh.position.y = -.0010*reach + .0005*Math.sin(time*.83)*(1-reach);
        irisMesh.position.z = .00035*(reach+Math.abs(glance));
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
