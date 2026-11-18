import * as THREE from "three";
import type { ChanvrierAppearance, getChanvrierColors } from "@/lib/arena-chanvrier";
import { createChanvrierScalp } from "./chanvrier-head";
import { chanvrierHeadwearEdge, chanvrierHeadwearFit, type WornHeadwear } from "./chanvrier-headwear-fit";
import { createCharacterLimbSurface, type CharacterLimbRing } from "./world/character-limb-surface";
import { Assembly, type CharacterPoint } from "./world/village-character-art";

type Colors = ReturnType<typeof getChanvrierColors>;
type Profile = ReadonlyArray<readonly [radius: number, height: number]>;
type FabricDrape = { chest: number; folds: number; neckline: number };
type GarmentFit = FabricDrape & { waist: number; hem: number; shoulder: number };
type FrontSurface = (x: number, y: number, lift?: number) => CharacterPoint;
type Rig = {
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  hips: readonly THREE.Group[];
  knees: readonly THREE.Group[];
  ankles: readonly THREE.Group[];
  shoulders: THREE.Group;
};

const cream = "#f3dfb5";
const navy = "#284653";
const ink = "#302d33";
const brass = "#c79953";
const TAU = Math.PI * 2;
const sides = [-1, 1] as const;

function tint(color: string, target: string, amount: number) {
  return `#${new THREE.Color(color).lerp(new THREE.Color(target), amount).getHexString()}`;
}

function seam(color: string) {
  return tint(color, ink, .38);
}

function striping(color: string) {
  const tone = new THREE.Color(color);
  return tone.r * .213 + tone.g * .715 + tone.b * .072 > .36 ? navy : cream;
}

function turn(profile: Profile, depth = 1, segments = 22) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments).scale(1, 1, depth);
}

function radiusAt(profile: Profile, y: number) {
  for (let i = 1; i < profile.length; i++) {
    const [r, h] = profile[i], [lower, base] = profile[i - 1];
    if (y <= h) return THREE.MathUtils.lerp(lower, r, THREE.MathUtils.clamp((y - base) / Math.max(.0001, h - base), 0, 1));
  }
  return profile[profile.length - 1][0];
}

function front(profile: Profile, depth: number, x: number, y: number, lift = .003): CharacterPoint {
  return [x, y, depth * Math.sqrt(Math.max(0, radiusAt(profile, y) ** 2 - x ** 2)) + lift];
}

function fabricPoint(radius: number, y: number, angle: number, depth: number, drape: FabricDrape): CharacterPoint {
  const c = Math.cos(angle), s = Math.sin(angle);
  const chest = THREE.MathUtils.smoothstep(y, .14, .35) * (1 - THREE.MathUtils.smoothstep(y, .38, .49));
  const lower = (1 - THREE.MathUtils.smoothstep(y, -.093, .15)) * THREE.MathUtils.smoothstep(radius, .085, .16);
  const fold = drape.folds * lower * (Math.cos(angle * 4 + y * 14) * .63 + Math.sin(angle * 7 + y * 9) * .37);
  const neck = drape.neckline * THREE.MathUtils.smoothstep(y, .39, .50) * THREE.MathUtils.smoothstep(radius, .01, .085) * c * c;
  return [radius * s, y + fold * .36 - neck, c * (radius * depth + fold + drape.chest * chest * Math.abs(c))];
}

function tailoredFront(profile: Profile, depth: number, drape: FabricDrape): FrontSurface {
  return (x, y, lift = .004) => {
    const radius = radiusAt(profile, y);
    const angle = Math.asin(THREE.MathUtils.clamp(x / Math.max(.001, radius), -1, 1));
    const [, height, z] = fabricPoint(radius, y, angle, depth, drape);
    return [x, height, z + lift];
  };
}

function stripe(art: Assembly, profile: Profile, depth: number, y: number, width: number, color: string, drape?: FabricDrape) {
  const end = y + width;
  const band: Profile = [
    [radiusAt(profile, y) + .0015, y],
    ...profile.filter(([, h]) => h > y && h < end).map(([r, h]) => [r + .0015, h] as const),
    [radiusAt(profile, end) + .0015, end],
  ];
  art.add(drape ? openShell(band, depth, () => 0, drape) : turn(band, depth), color);
}

function openShell(profile: Profile, depth: number, opening: (y: number) => number, drape?: FabricDrape) {
  const segments = 24;
  const positions: number[] = [], indices: number[] = [];
  for (const [r, y] of profile) {
    const edge = opening(y);
    for (let i = 0; i <= segments; i++) {
      const a = edge + i / segments * (TAU - 2 * edge);
      positions.push(...(drape ? fabricPoint(r, y, a, depth, drape) : [Math.sin(a) * r, y, Math.cos(a) * r * depth]));
    }
  }
  for (let row = 0; row < profile.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal"), normal = new THREE.Vector3(), opposite = new THREE.Vector3();
  for (const [row, [, y]] of profile.entries()) {
    if (opening(y)) continue;
    const first = row * (segments + 1), last = first + segments;
    normal.fromBufferAttribute(normals, first).add(opposite.fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z);
    normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}

function patch(art: Assembly, points: CharacterPoint[], color: string, offset: CharacterPoint = [0, 0, .004]) {
  const start = new THREE.Vector3(...points[0]);
  const a = new THREE.Vector3(...points[1]).sub(start), b = new THREE.Vector3(...points[2]).sub(start);
  if (a.cross(b).dot(new THREE.Vector3(...offset)) < 0) points = [...points].reverse();
  const n = points.length, positions = [...points.flat(), ...points.flatMap(p => p.map((coordinate, i) => coordinate + offset[i]))];
  const indices: number[] = [];
  for (let i = 1; i < n - 1; i++) indices.push(0, i + 1, i, n, n + i, n + i + 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, j, n + i, j, n + j, n + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, color);
}

const torsoDepth = .78;
const shirtCut: Profile = [[0, -.107], [.178, -.106], [.201, -.077], [.191, -.022], [.183, .066],
  [.191, .177], [.210, .270], [.231, .33], [.245, .394], [.233, .437], [.191, .478], [.132, .508],
  [.097, .510], [.088, .493], [0, .481]];

const topFits: Record<ChanvrierAppearance["top"], GarmentFit> = {
  tee: { waist: -.009, shoulder: .005, hem: 0, chest: .009, folds: .006, neckline: .013 },
  overalls: { waist: -.006, shoulder: .002, hem: -.004, chest: .006, folds: .005, neckline: .009 },
  apron: { waist: -.006, shoulder: .002, hem: -.004, chest: .006, folds: .008, neckline: .009 },
  hoodie: { waist: .010, shoulder: .008, hem: .008, chest: .018, folds: .013, neckline: .006 },
  jacket: { waist: .012, shoulder: .013, hem: .010, chest: .009, folds: .004, neckline: .006 },
  shirt: { waist: -.003, shoulder: .003, hem: .004, chest: .009, folds: .010, neckline: .010 },
  "linen-shirt": { waist: .004, shoulder: .003, hem: .008, chest: .012, folds: .016, neckline: .012 },
  mariniere: { waist: .007, shoulder: .003, hem: .002, chest: .011, folds: .008, neckline: .024 },
  vareuse: { waist: .019, shoulder: .012, hem: .012, chest: .010, folds: .010, neckline: .010 },
  "fisher-knit": { waist: .016, shoulder: .014, hem: -.009, chest: .019, folds: .014, neckline: .004 },
  "embroidered-vest": { waist: -.008, shoulder: -.005, hem: -.003, chest: .004, folds: .004, neckline: .006 },
  "sailor-blouse": { waist: .008, shoulder: .009, hem: -.008, chest: .018, folds: .011, neckline: .018 },
};

function topCut(fit: GarmentFit): Profile {
  return shirtCut.map(([r, y]) => {
    const ease = fit.waist * Math.max(0, 1 - Math.abs(y - .095) / .24)
      + fit.hem * (1 - THREE.MathUtils.smoothstep(y, -.08, .11))
      + fit.shoulder * Math.max(0, 1 - Math.abs(y - .391) / .105);
    return [r + ease * THREE.MathUtils.smoothstep(r, .085, .175), y];
  });
}

function shirtCollarFlap(art: Assembly, side: -1 | 1, color: string, surface: FrontSurface) {
  const rows = 7, positions: number[] = [], indices: number[] = [];
  const index = (row: number, column: number) => row * (rows + 1) - row * (row - 1) / 2 + column;
  const triangle = (a: number, b: number, c: number) => {
    if (side > 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  };
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= rows - row; column++) {
      // Map intermediate points as well as the corners so the lapel stays above the curved shirt.
      const u = row / rows, v = column / rows;
      const x = side * (.022 + .055 * u + .086 * v);
      const y = .465 - .048 * u + .031 * v;
      positions.push(...surface(x, y, .007 + .004 * u));
      const a = index(row, column);
      if (row + column < rows) triangle(a, index(row + 1, column), a + 1);
      if (row + column < rows - 1) triangle(a + 1, index(row + 1, column), index(row + 1, column + 1));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, color);
}

function pocket(art: Assembly, surface: FrontSurface, x: number, y: number, w: number, h: number, color: string) {
  const columns = 6, rows = 5, positions: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const v = row / rows, u = column / columns * 2 - 1;
    const bottom = y - h * (.51 - .14 * u * u);
    const height = THREE.MathUtils.lerp(bottom, y + h / 2, v);
    const fullness = (1 - u * u) * Math.sin(v * Math.PI / 2);
    positions.push(...surface(x + w * u * (.44 + .06 * v), height, .003 + fullness * .008));
    if (row < rows && column < columns) {
      const a = row * (columns + 1) + column, b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, tint(color, seam(color), .38));
  art.sweep([surface(x - w / 2, y + h / 2), surface(x, y + h / 2, .013), surface(x + w / 2, y + h / 2)], [.003, .0035, .003], seam(color), 6);
}

function bib(art: Assembly, coverall: boolean, color: string) {
  const profile: Profile = [[.126, -.115], [.188, -.106], [.174, .01], [.159, .225], [.108, .268]];
  const depth = 1.05;
  art.add(openShell(profile, depth, () => 1.15).rotateY(Math.PI), color, [0, 0, .018]);
  patch(art, [[-.12, .248, .142], [-.17, -.1, .126], [-.085, -.126, .178], [.085, -.126, .178], [.17, -.1, .126], [.12, .248, .142], [0, .263, .182]], color);
  pocket(art, (x, y, lift) => front([[.177, .03], [.179, .148]], 1.07, x, y, lift), 0, .1, .129, .079, color);
  for (const side of sides) {
    art.sweep([
      [side * .116, .228, .153], [side * .139, .39, .155], [side * .132, .476, .081],
      [side * .133, .483, -.078], [side * .125, .23, -.133],
    ], [.018, .021, .020, .023, .018], color, 7);
    art.ball([side * .116, .234, .174], .014, coverall ? brass : seam(color), [1, 1, .44]);
  }
  art.sweep([[-.172, -.071, .109], [-.125, -.072, .142], [0, -.068, .194], [.125, -.072, .142], [.172, -.071, .109]], [.011, .011, .011, .011, .011], seam(color), 7);
}

function embroidery(art: Assembly, point: CharacterPoint, color: string, size: number) {
  const [x, y, z] = point;
  for (const side of sides) {
    art.ball([x + side * size * .54, y + size * .20, z], size * .48, color, [1, .46, .3]);
    art.ball([x, y + side * size * .50, z], size * .47, color, [.45, 1, .3]);
  }
  art.ball(point, size * .30, cream, [1, 1, .4]);
}

function blouse(art: Assembly, color: string, profile: Profile, drape: FabricDrape, surface: FrontSurface) {
  const trim = striping(color);
  for (const side of sides) {
    const flap = [surface(0, .31, .021), surface(side * .158, .394, .019), surface(side * .190, .446, .017),
      surface(side * .084, .500, .017), surface(side * .042, .423, .021)];
    patch(art, flap, trim);
    art.sweep([flap[0], surface(side * .097, .359, .024), flap[1], flap[2]], [.003, .004, .004, .003], color, 7);
  }
  const back = (x: number, y: number, lift: number): CharacterPoint => {
    const radius = radiusAt(profile, y);
    const point = fabricPoint(radius, y, Math.PI - Math.asin(x / radius), torsoDepth, drape);
    return [point[0], point[1], point[2] - lift];
  };
  patch(art, [back(-.147, .372, .014), back(0, .369, .02), back(.147, .372, .014), back(.105, .493, .017), back(-.105, .493, .017)], trim, [0, 0, -.007]);
  art.sweep([back(-.139, .384, .022), back(0, .380, .025), back(.139, .384, .022)], [.0035, .0035, .0035], color, 7);
}

function topArt(art: Assembly, look: ChanvrierAppearance, colors: Colors) {
  const style = look.top, cloth = colors.top;
  const drape = topFits[style], cut = topCut(drape);
  const surface = tailoredFront(cut, torsoDepth, drape);
  const bodyColor = style === "embroidered-vest" ? striping(cloth) : cloth;
  art.add(openShell(cut, torsoDepth, () => 0, drape), bodyColor);
  const collarColor = style === "shirt" || style === "linen-shirt" ? tint(cloth, cream, .22) : seam(bodyColor);
  const neckWidth = style === "mariniere" ? .132 : .115;
  const binding: Profile = [[.090, .504], [neckWidth, .501], [neckWidth + .005, .509], [neckWidth - .006, .519], [.092, .521]];
  art.add(openShell(binding, .85, () => 0, drape), collarColor);
  stripe(art, cut, torsoDepth, -.077, style === "fisher-knit" || style === "hoodie" ? .035 : .018, seam(bodyColor), drape);

  const stitched = (points: ReadonlyArray<readonly [x: number, y: number]>, color: string, size = .006) =>
    art.sweep(points.map(([x, y]) => surface(x, y, .006)), points.map(() => size), color, 7);
  if (style === "mariniere") {
    for (const y of [-.038, .029, .096, .163, .23, .297, .364]) stripe(art, cut, torsoDepth, y, .022, striping(cloth), drape);
  } else if (style === "overalls" || style === "apron") {
    bib(art, style === "overalls", style === "overalls" ? colors.bottom : tint(colors.accent, "#b59469", .47));
  } else if (style === "hoodie") {
    if (look.jacket !== "raincoat" && look.jacket !== "kabig") {
      art.ball([0, .454, -.09], .178, seam(cloth), [1, .59, .74]);
      art.ball([0, .46, -.11], .157, cloth, [1, .56, .72]);
    }
    for (const side of sides) stitched([[side * .043, .472], [side * .052, .407], [side * .055, .339]], cream, .006);
    pocket(art, surface, 0, .05, .239, .138, cloth);
  } else if (style === "jacket" || style === "shirt" || style === "linen-shirt" || style === "vareuse") {
    const placket = style === "vareuse" ? .30 : -.077;
    stitched([[0, .468], [0, .367], [0, .303], [0, placket]], seam(cloth), style === "vareuse" ? .013 : .008);
    for (const y of (style === "vareuse" ? [.324, .387] : [.07, .168, .263, .356])) {
      art.ball(surface(.015, y, .006), .009, style === "jacket" ? brass : collarColor, [1, 1, .64]);
    }
    if (style === "vareuse") {
      for (const side of sides) stitched([[0, .306], [side * .039, .39], [side * .087, .473]], collarColor, .008);
      pocket(art, surface, -.105, .221, .093, .092, cloth);
    } else {
      for (const side of sides) shirtCollarFlap(art, side, collarColor, surface);
      pocket(art, surface, -.107, .267, .086, .075, cloth);
    }
  } else if (style === "fisher-knit") {
    art.add(turn([[.091, .501], [.116, .498], [.118, .537], [.101, .547], [.088, .544]], .86), cloth);
    for (const x of [-.106, -.052, 0, .052, .106]) {
      for (const y of [.03, .14, .25, .36]) {
        stitched([[x - .012, y - .039], [x + .012, y], [x - .012, y + .039]], tint(cloth, cream, .27), .006);
        stitched([[x + .012, y - .038], [x - .012, y], [x + .012, y + .039]], seam(cloth), .004);
      }
    }
  } else if (style === "embroidered-vest") {
    const vest: Profile = [
      [.207, -.09], [.213, -.073], [.202, .06], [.204, .19], [.232, .30],
      [.253, .394], [.231, .456], [.141, .511], [.12, .521],
    ];
    art.add(openShell(vest, .807, y => Math.max(.14, .14 + (y - .27) * 2.15)), cloth);
    for (const side of sides) {
      const points = vest.map(([r, y]): CharacterPoint => {
        const a = Math.max(.14, .14 + (y - .27) * 2.15);
        return [side * r * Math.sin(a), y, (r + .004) * .807 * Math.cos(a)];
      });
      art.sweep(points, points.map(() => .008), colors.accent, 7);
      for (const y of [.044, .112, .18, .248, .316]) {
        const p = front(vest, .807, side * .082, y, .01);
        embroidery(art, p, colors.accent, .014);
      }
    }
  } else if (style === "sailor-blouse") {
    blouse(art, cloth, cut, drape, surface);
  } else {
    pocket(art, surface, -.102, .268, .088, .073, cloth);
  }
}

function coatCut(style: ChanvrierAppearance["jacket"]): Profile {
  const vest = style === "wool-vest", trim = style === "chupenn", long = style === "pea-coat" || style === "raincoat" || style === "kabig";
  const hem = long ? -.139 : trim ? -.065 : -.097;
  const fullness = style === "raincoat" ? .023 : style === "kabig" ? .014 : style === "pea-coat" ? .010 : 0;
  const waist = trim ? .213 : style === "kabig" ? .239 : .224;
  return [
    [.196 + fullness, hem - .009], [.219 + fullness, hem], [.223 + fullness, hem + .027],
    [waist + fullness * .42, -.014], [waist, .097], [.227, .206], [.245, .318],
    [vest ? .252 : .271, .394], [vest ? .237 : .258, .432], [vest ? .220 : .232, .465], [.163, .506], [.119, .529],
  ];
}

const coatDrapes: Record<Exclude<ChanvrierAppearance["jacket"], "none">, FabricDrape> = {
  "pea-coat": { chest: .018, folds: .006, neckline: .007 },
  raincoat: { chest: .017, folds: .012, neckline: .009 },
  chupenn: { chest: .017, folds: .005, neckline: .009 },
  kabig: { chest: .024, folds: .010, neckline: .006 },
  "wool-vest": { chest: .013, folds: .006, neckline: .011 },
};

function jacketArt(art: Assembly, style: Exclude<ChanvrierAppearance["jacket"], "none">, cloth: string, accent: string) {
  const cut = coatCut(style), depth = .825;
  const drape = coatDrapes[style], surface = tailoredFront(cut, depth, drape);
  const open = (y: number) => style === "chupenn" ? .20 + Math.max(0, y - .24) * 1.6
    : style === "wool-vest" ? .12 + Math.max(0, y - .19) * 2.3
    : style === "pea-coat" ? Math.max(0, y - .29) * 2.65 : .025;
  const edgeColor = style === "chupenn" ? accent : seam(cloth);
  art.add(openShell(cut, depth, open, drape), cloth);
  const hem = cut.slice(0, 3);
  art.add(openShell(hem.map(([r, y]) => [r + .003, y]), depth, open, drape), seam(cloth));
  if (style === "raincoat" || style === "kabig") {
    // The reinforced shoulder panel lies over the coat, with its own folded edge.
    const seamHeight = style === "raincoat" ? .345 : .364;
    const radius = radiusAt(cut, seamHeight);
    const yoke: Profile = [[radius + .0015, seamHeight], [radiusAt(cut, seamHeight + .012) + .006, seamHeight + .012],
      ...cut.filter(([, y]) => y > seamHeight + .012).map(([r, y]) => [r + .003, y] as const)];
    const panel = style === "raincoat" ? tint(cloth, cream, .10) : tint(cloth, ink, .12);
    art.add(openShell(yoke, depth, open, drape), panel);
    art.add(openShell(yoke.slice(0, 2), depth + .005, open, drape), tint(panel, ink, .14));
  }
  for (const side of sides) {
    const edge = cut.map(([r, y]) => fabricPoint(r + .006, y, side * open(y), depth, drape));
    art.sweep(edge, edge.map(() => .007), edgeColor, 7);
    if (style === "pea-coat") {
      const lapel: CharacterPoint[] = [
        surface(side * .034, .294, .018), surface(side * .174, .412, .019),
        [side * .117, .502, .096], surface(side * .064, .447, .026),
      ];
      patch(art, side < 0 ? lapel : lapel.reverse(), seam(cloth));
      for (const y of [-.009, .092, .193]) art.ball(surface(side * .068, y, .009), .012, brass, [1, 1, .52]);
    } else if (style === "chupenn") {
      for (const y of [.109, .174, .239, .304, .37]) embroidery(art, surface(side * .104, y, .014), accent, .015);
      art.sweep([[.070, .067], [.072, .145], [.075, .219], [.104, .297], [.132, .369]].map(([x, y]) => surface(side * x, y, .009)), [.004, .004, .004, .004, .004], tint(accent, ink, .38), 6);
    }
    pocket(art, surface, side * .13, style === "chupenn" ? .018 : -.016, .085, .082, cloth);
  }
  if (style === "raincoat" || style === "kabig") {
    if (style === "kabig") {
      const hood: Profile = [[0, .312], [.049, .36], [.096, .402], [.151, .46], [.147, .494], [.106, .528], [.065, .53], [0, .528]];
      art.add(turn(hood, .66), cloth, [0, 0, -.148]);
      art.sweep([[-.095, .49, -.221], [-.067, .431, -.235], [0, .36, -.205], [.067, .431, -.235], [.095, .49, -.221]], [.005, .007, .007, .007, .005], accent, 7);
      pocket(art, surface, -.123, .31, .103, .066, cloth);
      embroidery(art, surface(-.122, .310, .018), accent, .015);
    } else {
      art.ball([0, .466, -.138], .158, seam(cloth), [1.12, .67, .72]);
      art.ball([0, .483, -.149], .155, cloth, [1.04, .59, .73]);
    }
    for (const y of [.083, .19, .298]) {
      const p = surface(.026, y, .010);
      art.ball(p, style === "raincoat" ? .009 : .014, accent, [1.4, .65, .47]);
      if (style === "kabig") art.rod(surface(-.052, y, .012), surface(.052, y, .012), .005, seam(cloth));
    }
  }
}

function accessoryArt(art: Assembly, look: ChanvrierAppearance, color: string) {
  const { accessory: style, jacket: coat } = look;
  const overCoat = coat !== "none";
  const drape = overCoat ? coatDrapes[coat] : topFits[look.top];
  const profile = overCoat ? coatCut(coat) : topCut(topFits[look.top]), depth = overCoat ? .825 : torsoDepth;
  const surface = tailoredFront(profile, depth, drape);
  if (style === "scarf" || style === "neckerchief") {
    art.add(turn([[.09, .497], [.117, .497], [.121, .533], [.111, .55], [.09, .547]], .96), color);
    const knotX = style === "scarf" ? -.051 : 0;
    const knot = surface(knotX, .475, .019);
    art.ball(knot, .034, color, [1, .76, .66]);
    for (const side of sides) {
      const end = .335 + (side > 0 ? .033 : 0), x = knotX + side * (style === "scarf" ? .012 : .038);
      const tail = [knot, surface(x - .021, end + .016, .023), surface(x, end, .021), surface(x + .021, end + .009, .023)];
      patch(art, tail, side < 0 ? color : seam(color), [0, 0, .009]);
    }
  } else if (style === "sash") {
    const y = overCoat ? profile[1][1] + .006 : -.089;
    const base = radiusAt(profile, y + .021) + .011;
    art.add(openShell([[base - .006, y - .022], [base + .003, y - .015], [base + .001, y + .017], [base - .006, y + .023]], .851, () => 0, drape), color);
    const z = .851 * Math.sqrt(base ** 2 - .125 ** 2) + .014;
    art.ball([-.125, y, z], .027, seam(color), [.75, .78, .63]);
    patch(art, [[-.145, y + .011, z], [-.151, y - .078, z + .011], [-.115, y - .066, z + .016], [-.115, y + .011, z]], color);
  } else if (style === "brooch") {
    const p = surface(-.119, .328, .023);
    art.ball(p, .027, brass, [1, 1, .34]);
    embroidery(art, [p[0], p[1], p[2] + .009], color, .015);
  } else if (style === "satchel") {
    const leather = tint(color, "#734932", .56);
    const strap = [surface(-.153, .447, .016), surface(-.075, .328, .016), surface(0, .22, .014), surface(.089, .098, .012), surface(.178, -.035, .013)];
    art.sweep(strap, strap.map(() => .014), seam(leather), 7);
    art.sweep([[.17, -.045, -.101], [.05, .191, -.195], [-.112, .445, -.139], [-.151, .478, -.049], strap[0]], [.013, .014, .014, .015, .014], seam(leather), 7);
    art.ball([.196, -.043, .085], .093, leather, [.81, .82, .42]);
    art.ball([.199, -.018, .119], .075, tint(leather, cream, .12), [1, .49, .17]);
    art.box([.19, -.036, .134], [.026, .038, .008], seam(leather));
    art.ball([.19, -.038, .14], .010, brass, [1, 1, .5]);
  }
}

type LimbCut = ReadonlyArray<readonly [at: number, width: number, depth: number]>;
type LimbBand = readonly [from: number, to: number, color: string, lift?: number];
type LimbSurface = ReturnType<typeof createCharacterLimbSurface>;

function section(cut: LimbCut, at: number) {
  const index = cut.findIndex(([next]) => next >= at);
  if (index <= 0) return index === 0 ? cut[0] : cut[cut.length - 1];
  const [a, wa, da] = cut[index - 1], [b, wb, db] = cut[index];
  const t = (at - a) / (b - a);
  return [at, THREE.MathUtils.lerp(wa, wb, t), THREE.MathUtils.lerp(da, db, t)];
}

function finishCut(cut: LimbCut, color: string, bands: readonly LimbBand[] = []): CharacterLimbRing[] {
  const positions = new Set(cut.map(([at]) => at));
  for (const [from, to] of bands) {
    positions.add(from - .004); positions.add(from);
    positions.add(to); positions.add(to + .004);
  }
  return [...positions].sort((a, b) => a - b).map(at => {
    const [, width, depth] = section(cut, at);
    const band = bands.find(([from, to]) => at >= from && at <= to);
    const lift = band?.[3] ?? 0;
    return { at, width: width + lift, depth: depth + lift, color: band?.[2] ?? color };
  });
}

const bareArm: LimbCut = [
  [.58, .054, .048], [.70, .064, .056], [.82, .060, .054], [.92, .055, .050],
  [1, .054, .049], [1.13, .055, .047], [1.28, .058, .049], [1.47, .054, .046],
  [1.69, .046, .039], [1.87, .037, .031], [2.045, .031, .026],
];
const sleeve: LimbCut = [
  [-.27, .012, .016], [-.14, .046, .049], [.08, .079, .074], [.29, .086, .076], [.52, .079, .071],
  [.77, .072, .065], [.92, .066, .061], [1.02, .064, .058], [1.16, .065, .060],
  [1.32, .067, .062], [1.53, .062, .057], [1.73, .056, .048], [1.91, .050, .044],
];
const shortSleeve: LimbCut = [
  ...sleeve.slice(0, 5), [.655, .075, .066], [.694, .073, .064], [.710, .063, .055],
];
const shortArm: LimbCut = [[.714, .063, .055], [.745, .062, .055], ...bareArm.slice(2)];

function armRings(style: ChanvrierAppearance["top"], jacket: ChanvrierAppearance["jacket"], colors: Colors) {
  const long = style !== "tee" && style !== "overalls" && style !== "apron" && style !== "sailor-blouse";
  const fullCoat = jacket !== "none" && jacket !== "wool-vest";
  const cloth = fullCoat ? colors.jacket : style === "embroidered-vest" ? striping(colors.top) : colors.top;
  if (!fullCoat && !long) {
    return [
      ...finishCut(shortSleeve, cloth, [[.635, .691, seam(cloth), .002]]),
      ...finishCut(shortArm, colors.skin),
    ];
  }
  const coatScale = { none: 1, "wool-vest": 1, chupenn: 1.095, "pea-coat": 1.15, raincoat: 1.135, kabig: 1.17 }[jacket];
  const cut: LimbCut = [
    ...sleeve.map(([at, width, depth]): [number, number, number] => {
      const loose = (jacket === "kabig" || !fullCoat && style === "fisher-knit") && at < 1.8;
      const ease = loose ? .011 * THREE.MathUtils.smoothstep(at, .05, .34) * (1 - THREE.MathUtils.smoothstep(at, 1.44, 1.79)) : 0;
      return [at, width * coatScale + ease, depth * coatScale + ease * .7];
    }),
    [1.927, .036, .030], [1.94, .035, .029], [2.045, .031, .026],
  ];
  const bands: LimbBand[] = [];
  if (style === "mariniere" && !fullCoat) {
    for (const at of [.18, .47, .76, 1.05, 1.34, 1.63]) bands.push([at, at + .082, striping(cloth), .001]);
  } else if (style === "fisher-knit" && !fullCoat) {
    for (const at of [.22, .52, .82, 1.13, 1.42]) bands.push([at, at + .045, tint(cloth, cream, .19), .002]);
  }
  if (jacket === "kabig") {
    bands.push([1.646, 1.715, seam(cloth), .001], [1.721, 1.776, colors.accent, .003], [1.782, 1.923, seam(cloth), .003]);
  } else bands.push([1.755, 1.923, seam(cloth), .003]);
  bands.push([1.937, 2.041, colors.skin]);
  return finishCut(cut, cloth, bands).map(ring => ring.at > 2.041 ? { ...ring, color: colors.skin } : ring);
}

const trouserCut: LimbCut = [
  [-.16, 0, 0], [-.09, .040, .038], [.015, .070, .065], [.17, .078, .075], [.28, .085, .078],
  [.34, .098, .088], [.39, .096, .088], [.64, .088, .079],
  [.82, .079, .070], [1, .077, .066], [1.18, .073, .067], [1.37, .077, .075], [1.58, .069, .067],
  [1.73, .056, .055], [1.88, .051, .052], [2.02, .047, .048],
];
const bareLeg: LimbCut = [
  [-.16, 0, 0], [-.02, .081, .074], [.18, .091, .080], [.46, .088, .076], [.65, .077, .068],
  [.81, .071, .061], [1, .069, .061], [1.22, .069, .068], [1.41, .072, .072],
  [1.59, .062, .062], [1.78, .049, .050], [2.05, .042, .047],
];
const breeches: LimbCut = [
  [-.16, 0, 0], [-.07, .060, .053], [.05, .100, .082], [.22, .122, .098], [.44, .132, .113], [.62, .130, .107],
  [.77, .111, .091], [.89, .085, .069], [1.015, .070, .061], [1.04, .067, .059], ...trouserCut.filter(([at]) => at > 1.04),
];
const shortsCut: LimbCut = [
  [-.16, 0, 0], [-.075, .046, .041], [.025, .074, .067], [.18, .081, .078],
  [.33, .098, .090], [.47, .103, .092], [.58, .098, .088], [.635, .097, .085],
  [.675, .104, .089], [.723, .105, .091], [.745, .102, .087], [.749, .082, .072],
  [.756, .076, .067], [.778, .074, .065], ...bareLeg.slice(5),
];
const sailorCut: LimbCut = [
  [-.16, 0, 0], [-.09, .042, .037], [.015, .074, .068], [.17, .090, .082],
  [.34, .102, .090], [.45, .103, .092], [.64, .098, .090], [.82, .090, .082],
  [1, .084, .080], [1.17, .082, .078], [1.34, .085, .080], [1.56, .089, .083],
  [1.78, .090, .083], [1.94, .092, .085], [2.015, .091, .085],
];

function legPattern(style: ChanvrierAppearance["bottom"], colors: Colors) {
  const skirt = style === "skirt" || style === "pleated-skirt";
  if (skirt) return { cut: bareLeg, color: colors.skin, bands: [] };
  if (style === "shorts") {
    return { cut: shortsCut, color: colors.bottom, bands: [
      [.665, .734, tint(colors.bottom, cream, .105), .002], [.741, .752, seam(colors.bottom)],
      [.756, 2.045, colors.skin],
    ] as LimbBand[] };
  }
  const sailor = style === "sailor-trousers", gaiter = style === "bragou-braz";
  const cut = gaiter ? breeches : sailor ? sailorCut : trouserCut;
  const gaiterColor = tint(colors.bottom, ink, .72);
  const bands: LimbBand[] = gaiter ? [
    [.905, 1.019, seam(colors.bottom), .002], [1.025, 1.115, seam(gaiterColor), .002],
    [1.12, 1.875, gaiterColor], [1.881, 2.016, seam(gaiterColor), .003],
  ] : sailor ? [[1.929, 1.991, tint(colors.bottom, cream, .12), .002], [2.001, 2.016, seam(colors.bottom)]]
    : [[1.862, 2.016, seam(colors.bottom), .002]];
  return { cut, color: colors.bottom, bands };
}

function trouserDetails(art: Assembly, cut: LimbCut, style: ChanvrierAppearance["bottom"], colors: Colors, side: -1 | 1) {
  function point(at: number, angle: number, offset: number): CharacterPoint {
    const [, width, depth] = section(cut, at);
    return [Math.sin(angle * side) * (width + offset), -.35 * at, Math.cos(angle) * (depth + offset)];
  }
  if (style === "cargo" || style === "work-trousers") {
    const color = tint(colors.bottom, cream, .10);
    const a = .58, b = 1.52;
    patch(art, [point(.39, a, .005), point(.70, a, .005), point(.72, b, .005), point(.39, b, .005)], color, [side * .008, 0, .006]);
    art.sweep([point(.40, a, .012), point(.437, 1.05, .016), point(.40, b, .012)], [.004, .005, .004], seam(color), 6);
    art.ball(point(.451, 1.07, .014), .008, brass, [.65, 1, 1]);
  }
  if (style === "shorts" || style === "sailor-trousers") {
    const sailor = style === "sailor-trousers";
    // Each pocket is cut into the side front panel and inclines toward the hip.
    const thigh: FrontSurface = (angle, y, lift = .003) => {
      const at = -y / .35;
      const tilt = side * angle - (at - .51) * .42;
      return point(at, tilt, lift);
    };
    pocket(art, thigh, side * .86, sailor ? -.180 : -.177, .86, sailor ? .093 : .081, tint(colors.bottom, cream, .046));
    art.sweep([point(.29, 1.49, .005), point(.45, 1.51, .005), point(sailor ? .74 : .657, 1.50, .005)],
      [.003, .004, .003], tint(colors.bottom, cream, .18), 6);
  } else {
    const seamLine = [.09, .25, .43, .69].map(at => point(at, 1.43, .003));
    art.sweep(seamLine, seamLine.map(() => .0025), seam(colors.bottom), 6);
  }
}

function trouserWaist(art: Assembly, style: ChanvrierAppearance["bottom"], color: string) {
  const sailor = style === "sailor-trousers";
  if (sailor || style === "shorts") {
    // A single pelvis covers the two articulated thighs and narrows into the rise.
    const cut: Profile = [[0, -.185], [.052, -.178], [.092, -.161], [.141, -.139], [.173, -.115],
      [.196, -.091], [.190, -.057], [.176, -.016], [.159, .033], [.144, .048], [0, .049]];
    const depth = .655;
    art.add(turn(cut, depth), color);
    stripe(art, cut, depth, -.094, .028, tint(color, ink, .23));
    stripe(art, cut, depth, -.091, .006, tint(color, cream, .16));
    const surface: FrontSurface = (x, y, lift) => front(cut, depth, x, y, lift);
    if (sailor) {
      const panel: FrontSurface = (x, y, lift = .006) => surface(x * THREE.MathUtils.lerp(.57, 1, THREE.MathUtils.smoothstep(y, -.171, -.083)), y, lift);
      pocket(art, panel, 0, -.106, .205, .124, tint(color, cream, .10));
      for (const side of sides) {
        const edge = [panel(side * .097, -.046, .012), panel(side * .098, -.102, .013), panel(side * .089, -.156, .011)];
        art.sweep(edge, [.004, .005, .003], tint(color, cream, .23), 6);
        for (const y of [-.073, -.120, -.151]) art.add(new THREE.SphereGeometry(.011, 8, 5).scale(1, 1, .54), brass, panel(side * .094, y, .015));
      }
    } else {
      for (const side of sides) {
        const loop = [surface(side * .098, -.106, .006), surface(side * .104, -.081, .009), surface(side * .113, -.051, .008)];
        art.sweep(loop, [.003, .006, .003], tint(color, cream, .27), 6);
      }
      art.sweep([surface(.020, -.079, .006), surface(.020, -.114, .009), surface(.015, -.154, .007), surface(-.009, -.173, .005)],
        [.004, .004, .004, .003], seam(color), 6);
      art.add(new THREE.SphereGeometry(.010, 8, 5).scale(1, 1, .55), brass, surface(.003, -.077, .009));
    }
    return;
  }
  const cut: Profile = [[0, -.147], [.078, -.140], [.142, -.120], [.181, -.088], [.174, -.045], [.161, .004], [.144, .048], [0, .050]];
  art.add(turn(cut, .68), color);
  stripe(art, cut, .68, .023, .018, seam(color));
}

function foldedSkirt(profile: Profile, pleated: boolean, lift = 0) {
  const facets = pleated ? 56 : 32;
  const positions: number[] = [], indices: number[] = [];
  for (const [radius, y] of profile) {
    for (let i = 0; i <= facets; i++) {
      const angle = i / facets * TAU;
      const fold = Math.cos(angle * (pleated ? 14 : 7)) * (pleated ? .011 : .004) * THREE.MathUtils.clamp((-.033 - y) / .153, 0, 1);
      positions.push(Math.sin(angle) * (radius + fold + lift), y, Math.cos(angle) * (radius * .83 + fold + lift));
      if (i < facets && positions.length / 3 > facets + 1) {
        const b = positions.length / 3 - 1, a = b - facets - 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function skirtArt(color: string, pleated: boolean) {
  const art = new Assembly(), hem = pleated ? -.298 : -.247, width = pleated ? .271 : .242;
  const cut: Profile = [
    [width * .86, hem + .013], [width * .985, hem], [width, hem + .018],
    [Math.max(.231, width - .023), hem * .69], [.229, -.094], [.216, .023],
  ];
  art.add(foldedSkirt(cut, pleated), color);
  art.add(foldedSkirt(cut.slice(1, 3), pleated, .002), seam(color));
  art.add(foldedSkirt([[.216, .01], [.220, .027], [.214, .042]], pleated, .001), seam(color));
  return { art, hem };
}

type ShoeStation = readonly [z: number, width: number, height: number];

function shoeLast(stations: readonly ShoeStation[], side: -1 | 1, base: number, sole = false) {
  const sides = 12, positions: number[] = [], indices: number[] = [];
  for (const [row, [depth, radius, top]] of stations.entries()) {
    const shift = -side * .009 * THREE.MathUtils.smoothstep(depth, .063, .18);
    const height = top - base;
    for (let k = 0; k < sides; k++) {
      const angle = k / sides * TAU, vertical = Math.cos(angle);
      const contour = sole ? Math.sign(vertical) * Math.sqrt(Math.abs(vertical)) : vertical;
      positions.push(shift + radius * Math.sin(angle), base + height * (.5 + .5 * contour), depth);
      if (row === 0) continue;
      const a = (row - 1) * sides + k, b = (row - 1) * sides + (k + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function shoes(style: ChanvrierAppearance["shoes"], color: string, side: -1 | 1) {
  const art = new Assembly();
  const stitch = seam(color), welt = tint(color, cream, .36);
  const sole = style === "sneakers" ? cream : style === "clogs" ? "#8f6844" : "#473c36";
  const rugged = style === "boots" || style === "work";
  const toe = style === "clogs" ? .228 : .216;
  const last: ShoeStation[] = [
    [-.090, 0, -.056], [-.083, .037, -.027], [-.065, .064, .007], [-.019, .074, .038],
    [.034, .076, .043], [.084, .071, .038], [.135, .086, .019], [.174, .087, .011],
    [.204, .069, -.010], [toe, 0, -.045],
  ];
  art.add(shoeLast(last.map(([z, width]): ShoeStation => [z, width * 1.04, -.059]), side, -.089, true), sole);
  art.add(shoeLast(last.map(([z, width]): ShoeStation => [z, width * 1.055, -.053]), side, -.070, true), rugged ? stitch : welt);
  if (style === "clogs") {
    const carving = last.map(([z, width, height]): ShoeStation => [z, width, z < .034 ? Math.min(height, -.021) : height + .012]);
    art.add(shoeLast(carving, side, -.057), color);
    art.sweep([[-.063, -.023, .040], [-.036, .020, .047], [0, .038, .061], [.036, .02, .047], [.063, -.023, .040]], [.004, .005, .006, .005, .004], welt, 7);
    return art;
  }
  const upper = shoeLast(last, side, -.058);
  if (style === "sneakers" || style === "work") {
    const cap = new THREE.Color(style === "sneakers" ? cream : tint(color, cream, .19)), leather = new THREE.Color(color);
    const position = upper.getAttribute("position"), pigments = new Float32Array(position.count * 3);
    const paint = new THREE.Color();
    for (let i = 0; i < position.count; i++) paint.copy(leather).lerp(cap, THREE.MathUtils.smoothstep(position.getZ(i), .139, .181)).toArray(pigments, i * 3);
    upper.setAttribute("color", new THREE.BufferAttribute(pigments, 3));
    art.add(upper, null);
  } else art.add(upper, color);
  if (style === "boots" || style === "high-tops") {
    const height = style === "boots" ? .165 : .082;
    const collar: Profile = [[.065, -.044], [.078, -.015], [.077, height * .56], [.078, height - .014], [.073, height], [.062, height - .003]];
    art.add(turn(collar, .99), color);
    stripe(art, collar, .99, height - .022, .015, stitch);
    if (style === "boots") {
      stripe(art, collar, .99, .037, .011, welt);
      art.rod([0, .071, -.063], [0, height - .022, -.072], .008, stitch);
      return art;
    }
  }
  if (style === "deck-shoes") {
    art.sweep([[-.060, .008, .065], [-.060 - side * .006, .005, .160], [-side * .009, .008, .184], [.058 - side * .006, .005, .160], [.060, .008, .065]], [.004, .005, .005, .005, .004], welt, 7);
    art.sweep([[-.062, .016, .049], [-.059, .014, -.025], [0, .032, -.046], [.059, .014, -.025], [.062, .016, .049]], [.003, .004, .004, .004, .003], welt, 7);
  }
  for (const z of (style === "deck-shoes" ? [.061, .083] : [.046, .076, .106])) {
    const y = .035 - Math.max(0, z - .05) * .22;
    for (const edge of sides) art.ball([edge * .038, y, z], .007, stitch, [1, .62, 1]);
    art.sweep([[-.038, y + .002, z], [0, y + .009, z + .002], [.038, y + .002, z + .004]], [.004, .004, .004], style === "sneakers" ? cream : welt, 6);
  }
  return art;
}

function hatPoint(profile: Profile, depth: number, y: number, angle: number, lift = .003): CharacterPoint {
  const r = radiusAt(profile, y) + lift;
  return [Math.sin(angle) * r, y, Math.cos(angle) * r * depth];
}

function hatArt(style: WornHeadwear, cloth: string, accent: string) {
  const art = new Assembly(), shadow = seam(cloth), thread = tint(cloth, cream, .28), depth = .93;
  if (style === "watch-cap") {
    const knit: Profile = [[.168, .263], [.195, .267], [.211, .311], [.210, .348], [.181, .403], [.126, .444], [.062, .463], [0, .465]];
    art.add(turn(knit, depth), cloth);
    stripe(art, knit, depth, .270, .044, shadow);
    const wool = tint(cloth, cream, .11);
    for (let i = 0; i < 20; i++) {
      const angle = i / 20 * TAU;
      art.sweep([.275, .287, .309].map(y => hatPoint(knit, depth, y, angle)), [.002, .0033, .002], thread, 5);
      if (i % 2 === 0) {
        const seam = [.316, .355, .393, .431, .453].map((y, j) => hatPoint(knit, depth, y, angle + j * .009, .001));
        art.sweep(seam, [.001, .0025, .0024, .0015, .0009], wool, 5);
      }
    }
  } else if (style === "sailor-cap" || style === "bachi") {
    const bachi = style === "bachi";
    const crown: Profile = [[.155, .274], [.191, .270], [.203, .305], [.235, .34], [.222, .401], [.158, .426], [.085, .421], [0, .415]];
    art.add(turn(crown, depth), cloth);
    stripe(art, crown, depth, .277, .043, shadow);
    stripe(art, crown, depth, .38, .009, thread);
    if (bachi) {
      art.ball([0, .436, -.004], .043, tint(accent, "#aa342b", .42), [1.12, .86, 1.07]);
      for (const side of sides) {
        art.sweep([[side * .021, .294, -.178], [side * .035, .237, -.195], [side * .042, .185, -.191]], [.007, .007, .005], shadow, 6);
      }
    } else {
      art.add(new THREE.SphereGeometry(.19, 22, 10).scale(1, .103, .67).rotateX(.12), shadow, [0, .278, .15]);
      art.sweep([[-.135, .285, .213], [-.079, .289, .255], [0, .290, .274], [.079, .289, .255], [.135, .285, .213]], [.001, .0024, .0028, .0024, .001], tint(cloth, cream, .21), 6);
      art.ball([0, .309, .193], .013, brass, [1.2, .95, .46]);
      art.ball([0, .31, .198], .006, navy, [1.12, .84, .30]);
    }
  } else if (style === "round-hat" || style === "souwester") {
    const rain = style === "souwester";
    const brim: Profile = [[.157, .286], [.210, .267], [rain ? .260 : .294, .256], [rain ? .292 : .321, rain ? .258 : .278], [rain ? .291 : .318, rain ? .270 : .291], [.242, .283], [.179, .300]];
    const crown: Profile = [[.172, .278], [.209, .285], [.206, .34], [.191, .400], [.139, .436], [0, .444]];
    const brimGeometry = turn(brim, rain ? 1.12 : depth);
    if (rain) brimGeometry.rotateX(-.19).translate(0, .014, -.037);
    art.add(brimGeometry, cloth);
    art.add(turn(crown, depth), cloth);
    stripe(art, crown, depth, .289, .033, rain ? shadow : tint(cloth, accent, .30));
    if (!rain) {
      art.ball([-.081, .306, -.176], .026, accent, [1.4, .6, .46]);
      for (const side of sides) {
        const x = -.079 + side * .021;
        patch(art, [[x - .015, .310, -.181], [x - .011, .117 + side * .031, -.201], [x + .014, .127 + side * .031, -.205], [x + .010, .312, -.181]], side < 0 ? shadow : accent, [0, 0, -.005]);
      }
    } else {
      for (const side of sides) {
        const seamLine = [.325, .363, .398, .426, .438].map(y => hatPoint(crown, depth, y, side * .88, .002));
        art.sweep(seamLine, [.0015, .0025, .0029, .0025, .001], shadow, 6);
      }
    }
  } else if (style === "bigouden-coif" || style === "lace-coif") {
    const high = style === "bigouden-coif";
    const cut: Profile = high
      ? [[.151, .282], [.185, .286], [.188, .325], [.148, .371], [.129, .462], [.128, .546], [.117, .557], [.086, .555], [0, .55]]
      : [[.16, .257], [.185, .272], [.194, .307], [.173, .366], [.139, .395], [.073, .417], [0, .419]];
    art.add(turn(cut, depth), cloth);
    stripe(art, cut, depth, high ? .332 : .285, .025, thread);
    const trim = tint(cloth, "#a48978", .28);
    for (const side of sides) {
      art.sweep([[side * .120, .32, -.098], [side * .155, .218, -.105], [side * .182, .121, -.073], [side * .152, high ? .063 : .101, -.059]], [.013, .016, .013, .006], cloth, 8);
      if (!high) art.ball([side * .133, .242, -.112], .067, cloth, [.90, .90, .49]);
    }
    for (const [row, y] of (high ? [.391, .438, .477, .516] : [.305, .343, .370]).entries()) {
      for (const [column, angle] of [-.79, -.38, 0, .38, .79].entries()) {
        const drift = row % 2 ? .12 : 0;
        const point = hatPoint(cut, depth, y + .006 * Math.cos(column * 1.5), angle + drift);
        const eyelet = new THREE.TorusGeometry(row % 2 ? .007 : .0085, .0019, 4, 10).scale(.78, 1.15, .75).rotateY(angle + drift);
        art.add(eyelet, trim, point);
        if ((column + row) % 3 === 0) art.ball([point[0] + .007, point[1] + .004, point[2]], .0036, thread, [.76, 1.02, .57]);
      }
    }
  } else {
    const kerchief: Profile = [[.157, .24], [.177, .253], [.195, .28], [.196, .321], [.164, .378], [.097, .398], [0, .404]];
    const drape: Profile = [[.171, .151], [.177, .170], [.183, .197], [.188, .228], [.187, .251], [.186, .270]];
    art.add(turn(kerchief, depth), cloth);
    stripe(art, kerchief, depth, .267, .018, accent);
    art.add(openShell(drape, .95, y => 1.65 + Math.max(0, .249 - y) * 9), cloth);
    art.sweep([[-.113, .235, -.146], [-.073, .206, -.171], [-.027, .188, -.177], [.039, .209, -.177]], [.002, .0028, .0033, .002], shadow, 6);
    art.ball([.041, .207, -.178], .026, shadow, [1, .55, .52]);
    patch(art, [[.043, .215, -.177], [-.041, .192, -.177], [-.035, .152, -.172], [.015, .173, -.190]], cloth, [0, 0, -.005]);
    patch(art, [[.052, .214, -.185], [.037, .154, -.185], [.104, .169, -.174], [.086, .203, -.178]], thread, [0, 0, -.005]);
  }
  return art;
}

function fitHeadwear(mesh: THREE.Mesh, style: WornHeadwear, face: ChanvrierAppearance["face"]) {
  const scalp = createChanvrierScalp(face);
  const { sourceHeight, sourceRadius } = chanvrierHeadwearFit[style];
  const position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal");
  const direction = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const angle = Math.atan2(x, z / .93);
    const edge = chanvrierHeadwearEdge(style, angle)! * scalp.height;
    const fit = (scalp.radius(edge) + .010) / sourceRadius;
    const weight = 1 - THREE.MathUtils.smoothstep(y, sourceHeight + .023, sourceHeight + .145);
    const width = THREE.MathUtils.lerp(1, fit, .75 + weight * .25);
    const height = y * scalp.height + (edge - sourceHeight * scalp.height) * weight;
    position.setXYZ(i, x * width, height, z * width);
    direction.set(normal.getX(i) / width, normal.getY(i) / scalp.height, normal.getZ(i) / width).normalize();
    normal.setXYZ(i, direction.x, direction.y, direction.z);
  }
}

export function createChanvrierWardrobe(rig: Rig, material: THREE.Material) {
  const parts = new Map<string, { key: string; meshes: THREE.Mesh[] }>();
  const hems = new Map<THREE.Mesh, { points: number[]; source: Float32Array; normals: Float32Array; fitted: boolean; flare: number; forward: number }>();
  let skirt: { mesh: THREE.Mesh; hem: number; rest: Float32Array } | undefined;
  let arms: LimbSurface[] = [], legs: LimbSurface[] = [], thighPanels: THREE.Mesh[] = [], waist: THREE.Mesh | undefined;
  const left = new THREE.Vector3(), right = new THREE.Vector3(), inverseTorso = new THREE.Matrix4();
  const kneePoint = new THREE.Vector3(), anklePoint = new THREE.Vector3(), acrossBody = new THREE.Vector3(1, 0, 0);
  const hemNormal = new THREE.Vector3();

  function clear(meshes: THREE.Mesh[]) {
    for (const mesh of meshes) {
      hems.delete(mesh);
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
  }

  function fitHem(mesh: THREE.Mesh, fitted: boolean) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
    const points: number[] = [];
    for (let i = 0; i < position.count; i++) if (position.getY(i) < .14) points.push(i);
    if (!points.length) return mesh;
    position.setUsage(THREE.DynamicDrawUsage);
    normal.setUsage(THREE.DynamicDrawUsage);
    geometry.computeBoundingBox();
    geometry.boundingBox!.expandByVector(new THREE.Vector3(.085, .065, .12));
    geometry.boundingSphere = geometry.boundingBox!.getBoundingSphere(new THREE.Sphere());
    hems.set(mesh, { points, source: Float32Array.from(position.array), normals: Float32Array.from(normal.array), fitted, flare: NaN, forward: NaN });
    return mesh;
  }

  function replace(slot: string, values: readonly string[], make: () => THREE.Mesh[]) {
    const key = values.join("/");
    const old = parts.get(slot);
    if (old?.key === key) return;
    if (old) clear(old.meshes);
    const meshes = make();
    // Moving clothes must stay out of the room's baked furniture shadow map.
    for (const mesh of meshes) mesh.castShadow = false;
    parts.set(slot, { key, meshes });
  }

  function update(look: ChanvrierAppearance, colors: Colors) {
    const closedCoat = look.jacket === "raincoat" || look.jacket === "kabig";
    const layered = look.jacket !== "none";
    replace("torso", [look.top, colors.top, look.top === "overalls" ? colors.bottom : "", colors.accent, closedCoat ? "closed" : layered ? "layered" : "single"], () => {
      const art = new Assembly();
      topArt(art, look, colors);
      const mesh = art.finish(`haut-${look.top}`, rig.torso, material);
      if (closedCoat) mesh.scale.set(.925, 1, .83);
      else if (layered) mesh.scale.set(.972, 1, .955);
      return [fitHem(mesh, layered)];
    });
    replace("jacket", [look.jacket, colors.jacket, colors.accent], () => {
      if (look.jacket === "none") return [];
      const art = new Assembly();
      jacketArt(art, look.jacket, colors.jacket, colors.accent);
      return [fitHem(art.finish(`veste-${look.jacket}`, rig.torso, material), true)];
    });
    replace("accessory", [look.accessory, look.jacket, look.top, colors.accent], () => {
      if (look.accessory === "none" || look.accessory === "glasses" || look.accessory === "round-glasses" || look.accessory === "earrings") return [];
      const art = new Assembly();
      accessoryArt(art, look, colors.accent);
      return [fitHem(art.finish(`accessoire-${look.accessory}`, rig.torso, material), look.jacket !== "none")];
    });
    replace("arms", [look.top, look.jacket, colors.skin, colors.top, colors.jacket, look.jacket === "kabig" ? colors.accent : ""], () => {
      const rings = armRings(look.top, look.jacket, colors);
      const coveredElbow = look.jacket !== "none" && look.jacket !== "wool-vest" || !["tee", "overalls", "apron", "sailor-blouse"].includes(look.top);
      arms = sides.map(side => createCharacterLimbSurface(rig.shoulders, material, `chanvrier-arm-${side}`, rings, 14, .23, coveredElbow));
      return arms.map(({ mesh }) => mesh);
    });
    replace("legs", [look.bottom, colors.bottom, colors.skin], () => {
      const { cut, color, bands } = legPattern(look.bottom, colors);
      const rings = finishCut(cut, color, bands).map(ring => {
        const tipColor = look.bottom === "shorts" ? colors.skin : look.bottom === "bragou-braz" ? bands.at(-1)![2] : color;
        return ring.at > 2.016 ? { ...ring, color: tipColor } : ring;
      });
      const coveredKnee = !["shorts", "skirt", "pleated-skirt"].includes(look.bottom);
      legs = sides.map(side => createCharacterLimbSurface(rig.body, material, `chanvrier-leg-${side}`, rings, 14, .23, coveredKnee));
      const meshes: THREE.Mesh[] = legs.map(({ mesh }) => mesh);
      skirt = undefined;
      waist = undefined;
      thighPanels = [];
      if (look.bottom === "skirt" || look.bottom === "pleated-skirt") {
        const { art, hem } = skirtArt(colors.bottom, look.bottom === "pleated-skirt");
        const mesh = art.finish(`jupe-${look.bottom}`, rig.torso, material);
        mesh.frustumCulled = false;
        skirt = { mesh, hem, rest: Float32Array.from(mesh.geometry.getAttribute("position").array) };
        meshes.push(mesh);
      } else {
        const waistArt = new Assembly();
        trouserWaist(waistArt, look.bottom, colors.bottom);
        waist = waistArt.finish("chanvrier-waistband", rig.body, material);
        meshes.push(waist);
        for (const [i, side] of sides.entries()) {
          const details = new Assembly();
          trouserDetails(details, cut, look.bottom, colors, side);
          const detail = details.finish("stitching-and-pockets", rig.hips[i], material);
          meshes.push(detail);
          if (look.bottom === "shorts" || look.bottom === "sailor-trousers") thighPanels.push(detail);
          if (look.bottom === "bragou-braz") {
            const buttons = new Assembly();
            for (const at of [1.32, 1.46, 1.60, 1.74]) {
              const [, width, depth] = section(cut, at);
              buttons.ball([side * width * .59, (1 - at) * .35, depth * .82 + .003], .0075, brass, [1, 1, .54]);
            }
            meshes.push(buttons.finish("gaiter-buttons", rig.knees[i], material));
          }
        }
      }
      return meshes;
    });
    replace("shoes", [look.shoes, colors.shoes], () =>
      rig.ankles.map((group, index) => shoes(look.shoes, colors.shoes, sides[index]).finish("shoe-and-sole", group, material)));
    replace("headwear", [look.headwear, look.face, colors.headwear, colors.accent], () => {
      if (look.headwear === "none") return [];
      const mesh = hatArt(look.headwear, colors.headwear, colors.accent).finish(`coiffe-${look.headwear}`, rig.head, material);
      fitHeadwear(mesh, look.headwear, look.face);
      return [mesh];
    });
  }

  function poseArm(index: number, shoulder: THREE.Vector3, elbow: THREE.Vector3, wrist: THREE.Vector3, width: number) {
    arms[index]?.pose(shoulder, elbow, wrist, acrossBody, width);
  }

  function poseLowerBody(depth: number) {
    for (const panel of thighPanels) panel.scale.z = depth;
    for (const [i, surface] of legs.entries()) {
      const hip = rig.hips[i], knee = rig.knees[i], ankle = rig.ankles[i];
      hip.updateMatrix();
      knee.updateMatrix();
      kneePoint.copy(knee.position).applyMatrix4(hip.matrix);
      anklePoint.copy(ankle.position).applyMatrix4(knee.matrix).applyMatrix4(hip.matrix);
      surface.pose(hip.position, kneePoint, anklePoint, acrossBody, hip.scale.x, depth);
    }
    if (waist) {
      waist.position.set(0, rig.hips[0].position.y, rig.shoulders.position.z * .36);
      waist.rotation.set(rig.shoulders.rotation.x * .35, rig.shoulders.rotation.y * .25, rig.shoulders.rotation.z * .56);
      waist.scale.set(rig.hips[0].scale.x, 1, depth);
    }
    const build = rig.hips[0].scale.x / rig.torso.scale.x;
    const pitch = rig.shoulders.rotation.x;
    const lean = Math.sin(pitch) * THREE.MathUtils.smoothstep(Math.abs(pitch), .012, .028);
    for (const [mesh, hem] of hems) {
      const flare = THREE.MathUtils.clamp((hem.fitted ? .095 : .205) + (build - 1) * .28, .07, .30);
      const forward = lean * .176 / (depth * mesh.scale.z);
      if (flare === hem.flare && forward === hem.forward) continue;
      hem.flare = flare;
      hem.forward = forward;
      const position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal");
      const room = hem.fitted ? .033 : .15;
      const lift = Math.max(0, lean) * (hem.fitted ? .072 : .138);
      for (const i of hem.points) {
        const offset = i * 3, x = hem.source[offset], y = hem.source[offset + 1], z = hem.source[offset + 2];
        const t = THREE.MathUtils.clamp((y + .112) / .252, 0, 1);
        const weight = 1 - t * t * (3 - 2 * t), slope = -6 * t * (1 - t) / .252;
        const width = 1 + flare * weight, front = 1 + room * weight;
        position.setXYZ(i, x * width, y + lift * weight, z * front + forward * weight);
        const nx = hem.normals[offset] / width, nz = hem.normals[offset + 2] / front;
        const ny = (hem.normals[offset + 1] - slope * (nx * x * flare + nz * (z * room + forward))) / (1 + lift * slope);
        hemNormal.set(nx, ny, nz).normalize();
        normal.setXYZ(i, hemNormal.x, hemNormal.y, hemNormal.z);
      }
      position.needsUpdate = true;
      normal.needsUpdate = true;
    }
    poseSkirt();
  }

  function poseSkirt() {
    if (!skirt) return;
    const { mesh, rest, hem } = skirt, vertices = mesh.geometry.getAttribute("position");
    rig.torso.updateWorldMatrix(true, false);
    inverseTorso.copy(rig.torso.matrixWorld).invert();
    for (const [i, thigh] of [left, right].entries()) {
      const hip = rig.hips[i];
      hip.updateWorldMatrix(true, false);
      thigh.set(0, hem, 0).applyMatrix4(hip.matrixWorld).applyMatrix4(inverseTorso);
    }
    const midX = (left.x + right.x) * .5, midZ = (left.z + right.z) * .5;
    const extraX = Math.max(0, Math.abs(left.x - right.x) / 2 - .126) * 2;
    const extraZ = Math.max(0, Math.abs(left.z - right.z) / 2 - .08) * 4;
    const waist = -.11;
    for (let i = 0; i < vertices.count; i++) {
      const offset = i * 3, x = rest[offset], y = rest[offset + 1], z = rest[offset + 2];
      const bend = THREE.MathUtils.clamp((waist - y) / (waist - hem), 0, 1);
      vertices.setXYZ(i, x * (1 + extraX * bend) + midX * bend, y, z * (1 + extraZ * bend) + midZ * bend);
    }
    vertices.needsUpdate = true;
  }

  function dispose() {
    for (const { meshes } of parts.values()) clear(meshes);
    parts.clear();
    skirt = undefined;
  }

  return { update, poseArm, poseLowerBody, dispose };
}
