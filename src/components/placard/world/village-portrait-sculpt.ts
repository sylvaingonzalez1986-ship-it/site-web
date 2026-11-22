import * as THREE from "three";

const levels = [-.064, -.054, -.024, .018, .072, .122, .167, .218, .267, .315, .357, .394, .42, .437];
const portraits = {
  breton: {
    outline: [0, .099, .157, .201, .234, .252, .260, .253, .238, .223, .198, .155, .103, 0],
    skin: "#efbc90", flush: "#d98762", shade: "#ae7961", depth: .94,
    cheek: [.132, .124, .123, .117, .043], jaw: [.124, .021, .099, .081, .010],
    eye: [.099, .233, .041, .050, .039, .0041, 1.04],
    nose: [.157, .058, .052, .043, .031, .018],
  },
  fisherman: {
    outline: [0, .102, .168, .216, .242, .255, .261, .258, .249, .235, .202, .149, .098, 0],
    skin: "#e9b68d", flush: "#ce805e", shade: "#ad7863", depth: .921,
    cheek: [.162, .132, .116, .110, .029], jaw: [.132, .041, .128, .093, .017],
    eye: [.107, .225, .046, .015, .034, -.003, 1.17],
    nose: [.147, .079, .070, .056, .037, .022],
  },
  loic: {
    outline: [0, .080, .139, .178, .212, .229, .241, .240, .240, .234, .205, .158, .106, 0],
    skin: "#efbc91", flush: "#d98462", shade: "#b67d63", depth: .959,
    cheek: [.133, .123, .126, .105, .037], jaw: [.111, .02, .103, .081, -.004],
    eye: [.087, .234, .039, .050, .046, .0037, 1.04],
    nose: [.157, .055, .054, .046, .027, .018],
  },
} as const;

function bump(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2) ** 2;
}

export type VillagePortrait = keyof typeof portraits;

/** Face landmarks and the skin derive from the same actor-specific cross sections. */
export function createVillagePortraitShape(name: VillagePortrait) {
  const older = name === "fisherman", young = name === "loic";
  const shape = portraits[name];
  const curve = new THREE.SplineCurve(levels.map((y, i) => new THREE.Vector2(shape.outline[i], y)));
  const outline = curve.getPoints(50);
  function radius(y: number) {
    const i = outline.findIndex(p => p.y >= y);
    if (i <= 0) return 0;
    const a = outline[i - 1], b = outline[i];
    return Math.max(0, THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y)));
  }
  const [cheekX, cheekY, cheekW, cheekH, cheekRelief] = shape.cheek;
  const [jawX, jawY, jawW, jawH, jawRelief] = shape.jaw;
  const [tipY, tipW, tipH, tipRelief, wingX, bridgeRelief] = shape.nose;
  const [eyeX, eyeY] = shape.eye;
  function relief(x: number, y: number) {
    const side = Math.abs(x);
    const cheek = cheekRelief * bump(side, y, cheekX, cheekY, cheekW, cheekH);
    const jaw = jawRelief * bump(side, y, jawX, jawY, jawW, jawH);
    const socket = (older ? .012 : .006) * bump(side, y, eyeX, eyeY, .078, .067);
    const brow = (older ? .014 : .009) * bump(side, y, eyeX, .294, .087, .044);
    const bridge = bridgeRelief * bump(x, y, older ? -.003 : 0, .197, .058, .111);
    const tipRadius = ((x - (older ? .004 : 0)) / tipW) ** 2 + ((y - tipY) / tipH) ** 2;
    const tip = tipRelief * Math.max(0, 1 - tipRadius * (.62 + .38 * tipRadius)) ** 1.7;
    const wings = (older ? .018 : .009) * bump(side, y, wingX, tipY - .012, .032, .036);
    const philtrum = (older ? .004 : .002) * bump(x, y, 0, .106, .023, .032);
    const muzzle = .015 * bump(x, y, 0, .088, .113, .069);
    const chin = (older ? .031 : .019) * bump(x, y, 0, .016, .121, .061);
    return cheek + jaw - socket + brow + bridge + tip + wings - philtrum + muzzle + chin;
  }
  // The bottle and blowpipe meet this seat in the head's unchanged coordinates.
  const mouthSeat = .218 - shape.depth * radius(.078) - relief(0, .078);
  function modelFront(x: number, y: number, z: number) {
    return z + THREE.MathUtils.smoothstep(z, .024, .13) * (relief(x, y) + mouthSeat * bump(x, y, 0, .078, .083, .05));
  }
  function front(x: number, y: number) {
    return modelFront(x, y, shape.depth * Math.sqrt(Math.max(0, radius(y) ** 2 - x * x)));
  }
  const geom = new THREE.LatheGeometry(outline.map(p => new THREE.Vector2(radius(p.y), p.y)), 56).scale(1, 1, shape.depth);
  const pos = geom.getAttribute("position"), colors = new Float32Array(pos.count * 3);
  const skin = new THREE.Color(shape.skin), blush = new THREE.Color(shape.flush), shadow = new THREE.Color(shape.shade);
  const tone = new THREE.Color(), stubble = new THREE.Color("#9a8677");
  const rim = new THREE.Color("#f7cca4"), noseLight = new THREE.Color("#f6c397"), noseShade = new THREE.Color("#bd8064");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setZ(i, modelFront(x, y, z));
    const side = Math.abs(x), face = THREE.MathUtils.smoothstep(z, .045, .16);
    const warm = (older ? .42 : young ? .35 : .43) * bump(side, y, cheekX, cheekY, .114, .091);
    const socket = (older ? .19 : .09) * bump(side, y, eyeX, eyeY, .083, .076);
    const jawShade = .13 * bump(side, y, .15, .011, .146, .073);
    const temple = .15 * bump(side, y, .195, .264, .098, .09);
    const underHat = .21 * bump(x, y, 0, .338, .226, .048);
    const highlight = .24 * bump(side, y, .135, .173, .120, .084) + .22 * bump(x, y, 0, .272, .136, .102);
    const litTip = (older ? .21 : .38) * bump(x, y, 0, tipY + .010, tipW * 1.13, .044);
    const shadedTip = (older ? .29 : .5) * bump(x, y, 0, tipY - .031, tipW, .030);
    tone.copy(skin).lerp(blush, warm * face).lerp(shadow, (socket + jawShade + temple + underHat) * face)
      .lerp(rim, highlight * face).lerp(noseLight, litTip * face).lerp(noseShade, shadedTip * face);
    if (older) {
      const sideburn = bump(side, y, .214, .146, .092, .136) * THREE.MathUtils.smoothstep(z, -.15, .09);
      const jaw = (1 - THREE.MathUtils.smoothstep(y, .032 + side * .23, .078 + side * .38)) * THREE.MathUtils.smoothstep(z, -.14, .15);
      const grain = .96 + .04 * Math.sin(x * 58 + z * 31) * Math.cos(y * 74 + z * 57);
      tone.lerp(stubble, Math.min(.48, jaw * .34 + sideburn * .51) * grain);
    }
    tone.toArray(colors, 3 * i);
  }
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  // LatheGeometry duplicates its seam. Average the two normals after sculpting.
  const normals = geom.getAttribute("normal"), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < outline.length; i++) {
    const last = 56 * outline.length + i;
    a.fromBufferAttribute(normals, i).add(b.fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(i, a.x, a.y, a.z); normals.setXYZ(last, a.x, a.y, a.z);
  }
  return { geometry: geom, radius, front, tone: shape, skin: shape.skin, depth: shape.depth };
}

/** A closed ear with a raised outer rim, central concha and the small fold at its root. */
export function createPortraitEar(skin: string, warmth: string, width: number, height: number, depth: number, side: number) {
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  const base = new THREE.Color(skin), hollow = new THREE.Color(warmth), color = new THREE.Color();
  const spokes = 20, levels = [0, .32, .59, .77, .91, 1, .66, 0], seams = levels.length - 1;
  for (let ring = 0; ring <= seams; ring++) for (let i = 0; i < spokes; i++) {
    const theta = i / spokes * Math.PI * 2;
    const r = levels[ring], y = Math.sin(theta) * r, x = Math.cos(theta) * r;
    const rim = Math.exp(-((r - .79) ** 2) / .017), bowl = Math.exp(-(((x - .13) / .53) ** 2 + ((y + .03) / .63) ** 2));
    const tragus = Math.exp(-(((x + .61) / .22) ** 2 + ((y + .11) / .22) ** 2));
    const lobe = Math.exp(-(((x + .03) / .47) ** 2 + ((y + .72) / .27) ** 2));
    const wrapped = ring > 5;
    const front = wrapped ? -.39 * Math.sqrt(1 - r * r) : (.45 * rim + .37 * (1 - r * r) - .15 * bowl + .3 * tragus + .14 * lobe);
    vertices.push(side * width * (x * (1 + .12 * y) + .18 * y), y * height, front * depth);
    color.copy(base).lerp(hollow, wrapped ? .10 : .10 + .48 * bowl + .08 * (1 - rim));
    colors.push(color.r, color.g, color.b);
    if (ring === seams) continue;
    const a = ring * spokes + i, b = ring * spokes + (i + 1) % spokes;
    if (side > 0) indices.push(a, a + spokes, b + spokes, a, b + spokes, b);
    else indices.push(a, b + spokes, a + spokes, a, b, b + spokes);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** One tapered wing of a moustache, moulded to the skin above the mouth. */
export function portraitMoustache(side: number, width: number, y: number, scaleY: number, hair: string, front: (x: number, y: number) => number) {
  return moustacheWing(side, hair, front, (u, t) => {
    const swell = Math.sin(Math.PI * u) ** .76 * (1 - .46 * u);
    const roll = Math.sin(Math.PI * t) * swell;
    return [(.003 + u * width), y + ((.51 - u) * .018 + (2 * t - 1) * .016 * swell) * scaleY,
      .0017 + .0068 * roll, .16 + .80 * roll + .08 * Math.sin(u * 34 + t * 3) ** 2];
  }, .61);
}

export function fishermanMoustache(side: number, front: (x: number, y: number) => number) {
  return moustacheWing(side, "#c9beb0", front, (u, t) => {
    const swell = .52 * (1 - u) ** 4 + .91 * Math.sin(Math.PI * u ** .68) ** .62 * (1 - .21 * u);
    const y = .113 - .031 * Math.sin(Math.PI * u ** .72) + .013 * u ** 3;
    const roll = Math.sin(Math.PI * t) * swell;
    const groove = Math.cos(t * 29 + 2.8 * u + .4 * Math.sin(u * 7));
    return [u * .112, y + (2 * t - 1) * .028 * swell,
      .0014 + (.054 + .0017 * groove) * roll, .25 + .69 * roll + .065 * groove];
  }, .72);
}

function moustacheWing(side: number, hair: string, front: (x: number, y: number) => number,
  profile: (u: number, t: number) => [x: number, y: number, relief: number, highlight: number], shade: number) {
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  const root = new THREE.Color(hair).multiplyScalar(shade), ridge = new THREE.Color(hair), tone = new THREE.Color();
  const steps = 16, rows = 4, stride = rows + 1;
  for (let col = 0; col <= steps; col++) for (let row = 0; row <= rows; row++) {
    const [width, y, relief, highlight] = profile(col / steps, row / rows);
    const x = side * width;
    vertices.push(x, y, front(x, y) + relief);
    tone.copy(root).lerp(ridge, highlight);
    colors.push(tone.r, tone.g, tone.b);
    if (col === steps || row === rows) continue;
    const a = col * stride + row, b = a + stride;
    if (side > 0) indices.push(a, b, a + 1, a + 1, b, b + 1);
    else indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Closed contour sampled on facial relief. The coloured surface stays seated
 * against the cheek when seen from the side, even for the wide fisherman. */
export function portraitPatch(centerX: number, centerY: number, width: number, height: number | readonly [number, number],
  zAt: (x: number, y: number) => number, slope: number, almond: number, originY: number, steps = 22, rings = 4,
  tint?: (radius: number, angle: number) => THREE.Color) {
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  for (let row = 0; row <= rings; row++) for (let col = 0; col < steps; col++) {
    const a = col / steps * 2 * Math.PI, r = row / rings, c = Math.cos(a), s = Math.sin(a);
    const x = centerX + width * r * c;
    const halfHeight = typeof height === "number" ? height : height[s < 0 ? 1 : 0];
    const y = centerY + halfHeight * r * Math.sign(s) * Math.abs(s) ** almond + slope * r * c;
    vertices.push(x, y - originY, zAt(x, y));
    if (tint) {
      const color = tint(r, a);
      colors.push(color.r, color.g, color.b);
    }
    if (!row) continue;
    const from = (row - 1) * steps + col, to = (row - 1) * steps + (col + 1) % steps;
    indices.push(from, from + steps, to + steps, from, to + steps, to);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  if (tint) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function portraitIrisTint(hue: string) {
  const iris = new THREE.Color(hue), pupil = new THREE.Color("#211e20"), ink = new THREE.Color("#3f302b");
  const edge = iris.clone().lerp(ink, .62), light = iris.clone().lerp(new THREE.Color("#d4a67e"), .25);
  const result = new THREE.Color();
  return (radius: number, angle: number) => {
    const rays = .5 + .5 * Math.cos(angle * 14 + .55 * Math.sin(angle * 5));
    const reflected = 1 - THREE.MathUtils.smoothstep(Math.sin(angle), -.98, -.17);
    return result.copy(iris).lerp(light, (.13 + .25 * rays) * (.26 + .74 * reflected))
      .lerp(edge, THREE.MathUtils.smoothstep(radius, .82, 1)).lerp(pupil, 1 - THREE.MathUtils.smoothstep(radius, .45, .61));
  };
}
