import * as THREE from "three";
import type { ChanvrierAppearance } from "@/lib/arena-chanvrier";
import { Assembly } from "./world/village-character-art";
import { chanvrierHeadwearEdge } from "./chanvrier-headwear-fit";

export type ChanvrierScalp = { profile: THREE.Vector2[]; height: number; radius: (y: number) => number; relief: (x: number, y: number, z: number) => number };
type Hair = ChanvrierAppearance["hair"];
type Hat = ChanvrierAppearance["headwear"];
const { lerp, smoothstep } = THREE.MathUtils;
const tau = Math.PI * 2;
const crown = .355;
const headDepth = .91;
type V = THREE.Vector3;
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type Pigment = ReturnType<typeof hairPigment>;
function hairPigment(color: string) {
  const base = new THREE.Color(color);
  return {
    base, shadow: base.clone().multiplyScalar(.61).lerp(new THREE.Color("#433337"), .035),
    light: base.clone().multiplyScalar(1.34).lerp(new THREE.Color("#c99263"), .055),
  };
}

function surfaceMesh(rows: number, columns: number, vertex: (u: number, t: number) => { p: V; color: THREE.Color; }) {
  const coords: number[] = [], rgb: number[] = [], indices: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const { p, color } = vertex(i / columns, j / rows);
    coords.push(p.x, p.y, p.z);
    rgb.push(color.r, color.g, color.b);
    if (i === columns || j === rows) continue;
    const a = j * (columns + 1) + i, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // The two sides of the UV seam are one physical surface.
  const normal = geo.getAttribute("normal"), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let j = 0; j <= rows; j++) {
    const first = j * (columns + 1), last = first + columns;
    a.fromBufferAttribute(normal, first).add(b.fromBufferAttribute(normal, last)).normalize();
    normal.setXYZ(first, a.x, a.y, a.z); normal.setXYZ(last, a.x, a.y, a.z);
  }
  return geo;
}

function strand(art: Assembly, path: V[], widths: number[], depths: number[], pigment: Pigment, outward?: V, fine = false) {
  const curve = new THREE.CatmullRomCurve3(path);
  const frames = (path.length - 1) * (fine ? 2 : 5);
  const rows = Array.from({ length: frames + 1 }, (_, i) => {
    const t = i / frames, p = curve.getPoint(t), axis = curve.getTangent(t);
    const normal = outward?.clone() ?? vec(p.x, (p.y - .17) * .9, p.z / headDepth);
    normal.addScaledVector(axis, -normal.dot(axis));
    if (normal.lengthSq() < .000001) normal.copy(Math.abs(axis.z) < .8 ? vec(0, 0, 1) : vec(1, 0, 0)).addScaledVector(axis, -(Math.abs(axis.z) < .8 ? axis.z : axis.x));
    normal.normalize();
    const across = axis.clone().cross(normal).normalize();
    const k = t * (path.length - 1), idx = Math.min(path.length - 2, Math.floor(k)), fraction = k - idx;
    return { p, across, normal, w: lerp(widths[idx], widths[idx + 1], fraction), d: lerp(depths[idx], depths[idx + 1], fraction) };
  });
  art.add(surfaceMesh(frames, fine ? 8 : 22, (u, t) => {
    const row = rows[Math.round(t * frames)], angle = u * tau, x = Math.cos(angle), y = Math.sin(angle);
    const flute = (.5 + .5 * Math.cos((x * 1.8 + t * .38) * tau)) * Math.max(0, y);
    const p = row.p.clone().addScaledVector(row.across, x * row.w).addScaledVector(row.normal, y * row.d * (.88 + .16 * flute));
    const accent = Math.max(0, 1 - Math.abs(x + .20) * 4) * Math.max(0, y) * Math.sin(t * Math.PI);
    const color = pigment.base.clone().lerp(pigment.shadow, .25 * (1 - y)).lerp(pigment.light, accent * .55 + flute * .24);
    return { p, color };
  }), null);
}

const frontHairline: Record<Hair, number> = {
  bald: .275, buzz: .268, crop: .249, quiff: .261, pixie: .241, mohawk: .278,
  bob: .270, long: .264, waves: .254, curls: .247, afro: .227, braids: .281, bun: .280, ponytail: .276,
};

function hairline(style: Hair, angle: number) {
  const a = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  const front = frontHairline[style];
  // A short temple point, an arch above the ear, then a lower line at the nape.
  const angles = [0, .42, .78, 1.08, 1.23, 1.52, 1.78, 2.12, Math.PI];
  const y = [front, front + .006, front - .024, .183, .119, .147, .141, .078, .047];
  let i = 0;
  while (i < angles.length - 2 && a > angles[i + 1]) i++;
  const profile = lerp(y[i], y[i + 1], smoothstep(a, angles[i], angles[i + 1]));
  if (style === "buzz" || style === "mohawk") return profile;
  const temple = Math.exp(-((a - .80) ** 2) / .047) * .014;
  const grain = Math.cos(angle * 22 + 1.1 * Math.sin(angle * 6)) * .0029;
  return profile + temple + grain * (1 - smoothstep(a, 1.7, Math.PI));
}

// Sculpt overlapping curved locks into a continuous skin. Each lock has a raised
// outer arc and a recessed centre, including where the silhouette crosses a lock.
function curlyRelief(afro: boolean) {
  const tiers = afro ? [3, 6, 9, 13, 17, 19] : [3, 6, 9, 12, 15];
  const locks = tiers.flatMap((count, row) => Array.from({ length: count }, (_, column) => {
    const seed = column * 4.13 + row * 2.79;
    return {
      angle: ((column + row * .42 + .16 * Math.sin(seed)) / count) * tau,
      t: .10 + row * (.89 / (tiers.length - 1)) + .023 * Math.sin(seed * 1.7),
      angleWidth: tau / count * (.69 + .09 * Math.cos(seed)),
      height: (afro ? .147 : .18) * (1 + .16 * Math.sin(seed)),
      tilt: .50 * Math.sin(seed + 2), phase: .8 * Math.cos(seed * 1.2),
    };
  }));
  return (a: number, t: number) => {
    let relief = 0;
    for (const lock of locks) {
      const y = (t - lock.t) / lock.height;
      if (Math.abs(y) > 1.6) continue;
      const delta = a - lock.angle;
      const x = (delta - tau * Math.round(delta / tau)) / lock.angleWidth + lock.tilt * y;
      const r2 = x * x + y * y;
      if (r2 > 2.6) continue;
      const arc = .5 + .5 * Math.cos(6.7 * Math.sqrt(r2) - Math.atan2(y, x) + lock.phase);
      const crest = Math.exp(-1.37 * r2) * (afro ? .83 + .17 * arc : .59 + .41 * arc);
      const blend = Math.max(0, .18 - Math.abs(relief - crest));
      relief = Math.max(relief, crest) + blend * blend / .72;
    }
    return relief;
  };
}

function hairSurface(scalp: ChanvrierScalp, style: Hair, hat: Hat) {
  const draped = style === "bob" || style === "long" || style === "waves";
  const tied = style === "braids" || style === "bun" || style === "ponytail";
  const shorn = style === "buzz" || style === "mohawk";
  const coiled = style === "curls" || style === "afro";
  const swept = style === "crop" || style === "quiff", quiff = style === "quiff";
  const ringlets = coiled ? curlyRelief(style === "afro") : undefined;
  const parted = draped || tied;
  const loft = shorn ? .002 : style === "afro" ? .088 : coiled ? .032 : style === "quiff" ? .048 : draped ? .028 : .022;
  const bulk = shorn ? .0024 : style === "afro" ? .070 : coiled ? .035 : draped ? .025 : .014;
  return (angle: number, t: number) => {
    const a = Math.atan2(Math.sin(angle), Math.cos(angle)), abs = Math.abs(a), front = Math.cos(a);
    const fringe = swept ? .012 * Math.sin(a * 2.1 + .4) - .011 * Math.exp(-((a + .70) ** 2) / .085) : 0;
    const asym = (parted ? .006 : .009) * Math.sin(3 * a + .4) * Math.max(front, 0);
    const roots = hairline(style, a) + fringe + asym;
    const behindEar = smoothstep(abs + .047 * Math.sin(a * 2.4), .92, 1.70);
    const length = style === "bob" ? .108 : style === "waves" ? .19 : .223;
    // The sides of loose cuts tuck behind the ear and then open out toward the nape.
    const tips = draped ? behindEar * (length + .014 * Math.sin(8 * a) + .008 * Math.sin(13 * a + .5)) : 0;
    const scallop = coiled ? .010 * Math.cos(14 * a + .65 * Math.sin(4 * a)) + .0035 * Math.sin(23 * a) : 0;
    const edge = roots - tips + scallop;
    const y = lerp(crown, edge, 1 - Math.cos(t * Math.PI / 2));
    const freeFall = draped ? behindEar * (1 - smoothstep(y, .075, .215)) : 0;
    let radius = lerp(scalp.radius(y * scalp.height), scalp.radius(.116 * scalp.height), freeFall);
    if (draped) {
      const tip = smoothstep(t, .78, 1) * behindEar;
      radius += freeFall * (.014 + (style === "waves" ? .016 * Math.sin(y * 39 + a * 1.7) : 0)) - tip * (style === "bob" ? .021 : .008);
    }
    const brim = chanvrierHeadwearEdge(hat, a);
    // Dense curls compress downwards as well as inwards. Start below the physical
    // brim so a high point on a lock cannot emerge through its sloped rear edge.
    const room = brim === null ? 1 : coiled
      ? .60 * (1 - smoothstep(y, brim - .122, brim - .042))
      : 1 - smoothstep(y, brim - .034, brim + .005);
    // Channels sweep away from the part. Their relief is part of the silhouette.
    const flow = parted ? abs + .38 * (1 - t) ** 1.3 + .10 * Math.sin(2.4 * t + a) :
      a + .79 * (1 - t) + .13 * Math.sin(a * 1.5 + t * 2.9);
    const ring = Math.sin(t * Math.PI * .51);
    const across = Math.sin(a) * ring, forward = Math.cos(a) * ring;
    const partLine = -.24 - .22 * forward + .09 * forward ** 2;
    const fromPart = across - partLine;
    const trough = swept ? Math.exp(-((fromPart / .073) ** 2)) * smoothstep(forward, -.62, -.11) * (1 - smoothstep(t, .88, 1)) : 0;
    const trail = forward - (.55 * Math.max(0, fromPart) ** .86 + .38 * Math.max(0, -fromPart) ** .86) + .09 * across ** 2;
    const bend = smoothstep(forward, .13, .58) * smoothstep(t, .18, .44);
    const templeSweep = t + .142 * a + .040 * Math.sin(a * 2.4);
    // Lines travel across the dome from the displaced part, with the lift
    // folded into the same mesh where the forelock meets the temple.
    const channel = swept ? Math.cos(lerp(trail * 18 - .8 * across, templeSweep * 28 - 8.7, bend) + .29 * Math.sin(trail * 8))
      : Math.cos(flow * (draped ? 14 : 12) + .55 * Math.sin(flow * 3) + .37 * Math.sin(t * 5.7 - 3 * a));
    const curl = ringlets?.(a, t) ?? 0;
    const ridge = coiled ? curl : (channel + 1) / 2;
    const fullness = Math.sin(t * Math.PI * .70) * (coiled ? 1 - .48 * smoothstep(t, .91, 1) : 1);
    radius += .0018 + room * fullness * (bulk + (shorn ? 0 : coiled ? (style === "afro" ? .046 : .040) * curl : .0065 * (ridge - .4)));
    const frontLock = swept ? smoothstep(a, -1.32, -.44) * (1 - smoothstep(a, .76, 1.51))
      * Math.exp(-((t - (.87 - .26 * smoothstep(a, -.89, .92))) ** 2) / .023) * (.90 + .10 * ridge) * (1 - trough * .63) : 0;
    radius += room * ((quiff ? .038 : .025) * frontLock - .0038 * trough);
    const yLift = room * (loft * (1 - t) ** .85 + (coiled ? .034 * curl * Math.sin(t * Math.PI) ** .6 : 0)
      + (quiff ? .072 : .032) * frontLock - .0055 * trough);
    const partShift = shorn ? 0 : (parted ? -.033 : .018) * (1 - t) ** 2;
    const drift = draped ? .012 * Math.sin(5 * a + 2.4 * t) * freeFall : 0;
    const x = Math.sin(a) * radius + partShift * room, rawZ = Math.cos(a) * radius * headDepth + drift;
    const p = vec(x, y * scalp.height + yLift, scalp.relief(x, y + yLift / scalp.height, rawZ));
    return { p, ridge, room, y, edge, trough };
  };
}
type Surface = ReturnType<typeof hairSurface>;

function sculpture(art: Assembly, surface: Surface, style: Hair, pigment: Pigment, skin: string) {
  const shorn = style === "buzz" || style === "mohawk";
  const skinColor = new THREE.Color(skin);
  const colorAt = (a: number, t: number, ridge: number, trough = 0) => {
    const depth = smoothstep(t, .91, 1);
    const color = pigment.base.clone().lerp(pigment.shadow, .18 + (1 - ridge) * .32 + depth * .18);
    if (shorn) {
      const stubble = .5 + .5 * Math.sin(231 * a + 122 * t) * Math.sin(177 * t - 87 * a);
      return color.lerp(skinColor, .17 + .44 * depth + .10 * stubble);
    }
    const crest = Math.pow(ridge, 2.5) * (.76 - .20 * depth) * (.38 + .62 * Math.sin(Math.PI * t) ** .65);
    const root = .16 * depth * (1 - ridge) * (style === "curls" || style === "afro" ? .3 : 1);
    return color.lerp(pigment.light, crest * (1 - trough * .55)).lerp(skinColor, root + .21 * trough);
  };
  const coiled = style === "curls" || style === "afro";
  art.add(surfaceMesh(coiled ? 54 : 33, coiled ? 144 : 96, (u, t) => {
    const a = (u - .5) * tau, { p, ridge, trough } = surface(a, t);
    return { p, color: colorAt(a, t, ridge, trough) };
  }), null);
  // Round the lower edge inward. A back view must never reveal an open wig shell.
  art.add(surfaceMesh(3, coiled ? 144 : 96, (u, t) => {
    const a = (u - .5) * tau, { p, ridge } = surface(a, 1);
    const inset = lerp(1, .81, t);
    p.x *= inset; p.z *= inset; p.y += .011 * t;
    return { p, color: colorAt(a, 1, ridge) };
  }), null);
  if (style === "long" || style === "bob" || style === "waves") {
    // The camera can see the inside of the hair between the shoulders and the nape.
    art.add(surfaceMesh(16, 96, (u, t) => {
      const a = (.5 - u) * tau, { p, ridge } = surface(a, lerp(.48, 1, t));
      const inset = lerp(.94, .81, t);
      p.x *= inset; p.z *= inset; p.y += .011 * t;
      return { p, color: colorAt(a, t, ridge).lerp(pigment.shadow, .44) };
    }), null);
  }
}

function bangs(art: Assembly, surface: Surface, pigment: Pigment) {
  for (let i = 0; i < 5; i++) {
    const a = -.83 + i * .36;
    const path = [[a + .35, .31], [a + .30, .56], [a + .18, .81], [a, .96], [a - .08, 1]].map(([u, t]) => surface(u, t).p);
    path[4].y -= .011 + (i % 2) * .008;
    strand(art, path, [0, .015, .022, .011, 0], [0, .003, .008, .005, 0], pigment);
  }
}

function curlAccents(art: Assembly, surface: Surface, pigment: Pigment, afro: boolean) {
  // Each curl tracks the actual sculpted skin, so it stays attached around the temples
  // and withdraws below a brim. Stagger the hooks instead of making a row of loops.
  for (let tier = 0; tier < 2; tier++) {
    const count = (afro ? 12 : 10) - tier * 4;
    for (let i = 0; i < count; i++) {
      const centre = tau * (i + tier * .46 + .13 * Math.sin(2.3 * i)) / count;
      const band = (tier ? .56 : .83) + .039 * Math.sin(3.1 * i);
      const base = surface(centre, band);
      if (base.room < .90) continue;
      const width = (afro ? .010 : .013) * (.90 + .15 * Math.sin(3 * i));
      const path: V[] = [], widths: number[] = [];
      for (let k = 0; k <= 9; k++) {
        const f = k / 9, phase = f * 4.9 + .82 * Math.sin(i + tier);
        const a = centre + (.17 - .09 * f) * Math.cos(phase);
        const t = band + .13 * Math.sin(phase) + .026 * f;
        const knot = surface(a, t);
        path.push(knot.p);
        widths.push(width * Math.sin(Math.PI * f) ** .62 * knot.room);
      }
      strand(art, path, widths, widths.map(w => w * .65), pigment, undefined, true);
    }
  }
}

function softPart(art: Assembly, surface: Surface, pigment: Pigment, style: Hair) {
  // Two tapered sweeps meet at the part and break up the edge near the temples.
  for (const side of [-1, 1]) {
    const loc = [[.085, .35], [.22, .51], [.57, .67], [.89, .78], [1.15, .88], [1.34, .97]];
    const path = loc.map(([a, t]) => surface(side * a - (style === "waves" ? .21 : .08), t).p);
    strand(art, path, [0, .013, .023, .020, .012, 0], [0, .004, .008, .006, .004, 0], pigment);
  }
}

function faceFramingLocks(art: Assembly, scalp: ChanvrierScalp, surface: Surface, style: Hair, pigment: Pigment) {
  for (const side of [-1, 1]) {
    const short = style === "bob", wavy = style === "waves";
    const upper = [[.70, .61], [.84, .75], [1.02, .88], [1.17, .98]].map(([a, t]) => surface(side * a, t));
    const path = upper.map(knot => knot.p);
    const root = path[path.length - 1], width = scalp.radius(.11 * scalp.height);
    const end = short ? -.040 : wavy ? -.131 : -.173;
    path.push(vec(side * (width + .022), .060 * scalp.height, .081),
      vec(side * (width + (wavy ? .045 : .027)), end * .26, .076),
      vec(side * (width + (wavy ? .021 : .030)), end * .72, .057),
      vec(side * (width + (short ? -.009 : wavy ? .041 : .008)), end, .039));
    root.x += side * .006;
    const widths = [0, .013, .027, .032].map((w, i) => w * upper[i].room);
    widths.push(.029, .033, .022, 0);
    strand(art, path, widths, widths.map(w => w * .51), pigment, vec(side * .60, 0, .80));
  }
}

function braids(art: Assembly, scalp: ChanvrierScalp, surface: Surface, pigment: Pigment) {
  for (const side of [-1, 1]) {
    const root = surface(side * 1.90, .91).p;
    const centre = (f: number) => vec(root.x + side * (.013 + .028 * f + .014 * Math.sin(f * Math.PI)),
      root.y - .239 * f * scalp.height, root.z + .164 * f + .013 * Math.sin(f * Math.PI));
    for (let braid = 0; braid < 3; braid++) {
      const points = Array.from({ length: 26 }, (_, i) => {
        const t = i / 25, loop = t * tau * 3.15 + braid * tau / 3, r = lerp(.019, .010, t);
        return centre(t).add(vec(side * Math.sin(loop) * r, 0, Math.cos(loop) * r));
      });
      const widths = points.map((_, i) => lerp(.016, .009, i / 25));
      strand(art, points, widths, widths.map(w => w * .86), pigment, vec(side * .3, .1, 1), true);
    }
    const end = centre(1);
    art.add(new THREE.TorusGeometry(.014, .004, 7, 18).rotateX(Math.PI * .66), "#ad844f", end.toArray());
    strand(art, [end, end.clone().add(vec(side * .003, -.018, .008)), end.clone().add(vec(side * .010, -.040, .008))],
      [.010, .015, 0], [.009, .010, 0], pigment, vec(0, 0, 1));
  }
}

function tiedHair(art: Assembly, scalp: ChanvrierScalp, surface: Surface, style: Hair, pigment: Pigment, hat: Hat) {
  const bun = style === "bun", covered = hat !== "none";
  const a = Math.PI + .22, anchor = surface(a, bun && !covered ? .55 : .84).p;
  if (bun) {
    if (hat === "bigouden-coif" || hat === "lace-coif" || hat === "headscarf") return;
    const r = covered ? .051 : .078;
    const centre = anchor.clone().add(vec(-.009, covered ? -.017 : .018, -r * .52));
    art.add(surfaceMesh(22, 48, (u, t) => {
      const a = u * tau, b = t * Math.PI;
      const twist = a + 1.45 * b, ridge = (1 + Math.cos(7 * twist + .5 * Math.sin(2 * a))) / 2;
      const radius = r * (1 + .079 * ridge * Math.sin(b));
      const p = centre.clone().add(vec(Math.sin(a) * Math.sin(b) * radius * 1.06, Math.cos(b) * radius * .90, Math.cos(a) * Math.sin(b) * radius));
      return { p, color: pigment.base.clone().lerp(pigment.shadow, (1 - ridge) * .40).lerp(pigment.light, .4 * ridge ** 3) };
    }), null);
    return;
  }
  const path = [anchor.clone().add(vec(0, 0, .012)), anchor.clone().add(vec(-.010, .009, -.043)), anchor.clone().add(vec(-.029, -.017, -.082)),
  anchor.clone().add(vec(-.053, -.081, -.106)), anchor.clone().add(vec(-.081, -.160, -.095)), anchor.clone().add(vec(-.126, -.186, -.066)),
  anchor.clone().add(vec(-.161, -.167, -.049))];
  const width = [.018, .019, .037, .052, .039, .021, 0], depth = [.018, .020, .031, .038, .034, .016, 0];
  strand(art, path, width, depth, pigment, vec(-.25, .2, -1));
  const band = new THREE.TorusGeometry(.019, .004, 8, 18);
  band.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 0, 1), path[2].clone().sub(path[0]).normalize()));
  art.add(band, "#a67d4f", path[1].toArray());
}

function crest(art: Assembly, surface: Surface, pigment: Pigment) {
  // A fan of swept hair rises from a wide root, thinning both at the ridge and at the nape.
  const swept = (t: number) => surface(t < .47 ? 0 : Math.PI, t < .47 ? (1 - t / .47) * .97 : (t - .47) / .53 * .94).p;
  art.add(surfaceMesh(48, 40, (u, t) => {
    const along = swept(Math.min(1, t + .002)).sub(swept(Math.max(0, t - .002))).normalize();
    const normal = vec(0, -along.z, along.y).normalize();
    const angle = u * tau, across = -Math.sin(angle), upper = (1 + Math.cos(angle)) * .5;
    const envelope = Math.sin(Math.PI * t) ** .72;
    const flow = across * 3.5 + t * 3.8;
    const groove = (1 + Math.cos(flow * Math.PI * 2)) * .5;
    const height = envelope * (.090 - .056 * t) * upper ** 1.30 * (.84 + .16 * groove);
    const p = swept(t).addScaledVector(normal, height - .003);
    p.x += envelope * (across * (.067 - .037 * t) + upper * .014);
    p.z -= upper * envelope * .033;
    const color = pigment.base.clone().lerp(pigment.shadow, .50 * (1 - groove)).lerp(pigment.light, .55 * groove * upper);
    return { p, color };
  }), null);
}

export function createChanvrierHair(art: Assembly, scalp: ChanvrierScalp, style: Hair, color: string, hat: Hat, skin: string) {
  if (style === "bald") return;
  const pigment = hairPigment(color), surface = hairSurface(scalp, style, hat);
  sculpture(art, surface, style, pigment, skin);
  switch (style) {
    case "pixie": if (hat === "none") bangs(art, surface, pigment); break;
    case "mohawk": if (hat === "none") crest(art, surface, pigment); break;
    case "curls": case "afro": curlAccents(art, surface, pigment, style === "afro"); break;
    case "bob": case "waves": case "long": case "braids": case "bun": case "ponytail":
      if (hat === "none") softPart(art, surface, pigment, style);
      if (style === "bob" || style === "long" || style === "waves") faceFramingLocks(art, scalp, surface, style, pigment);
      if (style === "braids") braids(art, scalp, surface, pigment);
      if (style === "bun" || style === "ponytail") tiedHair(art, scalp, surface, style, pigment, hat);
      break;
  }
}
