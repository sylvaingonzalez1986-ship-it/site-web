import { ExtrudeGeometry, Shape, ShapeGeometry, SphereGeometry } from "three";
import type { Art } from "./interior-art";

type Pigment = Parameters<Art["box"]>[6];

function silhouette(a: Art, points: readonly [number, number][], x: number, y: number, z: number, paint: Pigment) {
  const shape = new Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();
  a.add(new ShapeGeometry(shape), paint, [x, y, z]);
}

function loic(a: Art, x: number, z: number, pose: "parcel" | "cards") {
  for (const side of [-1, 1]) {
    const leg = x + .18 * side;
    a.sphere(.23, leg, .43, z, "darkTeal", [.9, 1.75, .9]);
    a.sphere(.25, leg, .14, z + .13, "earth", [.9, .48, 1.27]);
    a.box(.095, .42, .045, x + .22 * side, 1.13, z + .22, "teal", [0, 0, side * .17]);
  }
  a.sphere(.38, x, .95, z, "apricot", [1.28, 1.4, .8]);
  a.box(.58, .56, .16, x, .83, z + .225, "darkTeal");
  for (const side of [-1, 1]) {
    a.box(.09, .44, .045, x + .22 * side, 1.12, z + .26, "teal", [0, 0, side * .17]);
    a.sphere(.052, x + .18 * side, 1.01, z + .304, "gold", [1, 1, .37]);
  }
  const key = pose === "parcel" ? "market-loic" : "shop-loic";
  const head = a.pivot(`${key}-head`, [x, 1.3, z]);
  head.sphere(.34, 0, .26, 0, "skin", [1.04, 1.1, .89]);
  head.sphere(.125, -.32, .23, 0, "skin", [1, 1, .7]);
  head.sphere(.337, 0, .44, -.025, "teal", [1.11, .72, 1]);
  head.sphere(.24, -.16, .455, -.05, "honey", [.89, .86, 1.16]);
  head.sphere(.337, .085, .42, .16, "ink", [1.03, .22, .92]);
  for (const eye of [-.09, .11]) head.sphere(.034, eye, .285, .286, "ink", [1, 1.33, .65]);
  head.sphere(.055, .034, .215, .296, "skin", [1, .74, .95]);
  head.sphere(.066, .041, .14, .287, "ink", [1.2, .58, .32]);
  head.sphere(.033, .055, .126, .308, "red", [1.08, .56, .44]);
  a.rod([x - .31, 1.16, z], [x - .44, .99, z + .24], .24, "apricot");
  a.rod([x - .44, .99, z + .24], [x - .28, 1.05, z + .49], .21, "apricot");
  a.sphere(.125, x - .24, 1.06, z + .54, "skin", [1.1, .8, 1.17]);
  const palm: [number, number, number] = pose === "cards" ? [.06, .4, .11] : [-.2, .01, .32];
  a.rod([x + .31, 1.16, z], [x + .47, 1.03, z + .18], .24, "apricot");
  const hand = a.pivot(`${key}-hand`, [x + .47, 1.03, z + .18]);
  hand.rod([0, 0, 0], palm, .2, "apricot");
  hand.sphere(.125, ...palm, "skin", [1, 1, .8]);
  if (pose === "cards") {
    card(hand, .01, .59, .11, "teal", "star", .85);
    card(hand, .17, .57, .14, "gold", "sail", .85);
  } else hand.rod([-.21, .02, .29], [-.26, .15, .45], .033, "wood");
}

function card(a: Art, x: number, y: number, z: number, paint: Pigment, mark: "star" | "sail", scale = 1) {
  a.bevelBox(.3 * scale, .42 * scale, .034, .013, x, y, z, "paper");
  a.box(.26 * scale, .38 * scale, .014, x, y, z + .018, paint);
  if (mark === "sail") {
    silhouette(a, [[-.072 * scale, -.045 * scale], [.007 * scale, .113 * scale], [.073 * scale, -.045 * scale]], x, y, z + .027, "paper");
    a.box(.19 * scale, .025 * scale, .01, x, y - .08 * scale, z + .028, "darkTeal");
  } else {
    const points = Array.from({ length: 10 }, (_, i): [number, number] => {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const radius = (i % 2 ? .043 : .1) * scale;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
    silhouette(a, points, x, y, z + .027, "paper");
  }
}

function crate(a: Art, x: number, y: number, z: number, w: number, d: number) {
  a.box(w, .085, d, x, y + .043, z, "wood");
  for (const side of [-1, 1]) {
    a.box(w, .21, .08, x, y + .14, z + side * d / 2, "honey");
    a.box(.08, .21, d, x + side * w / 2, y + .14, z, "wood");
    for (const dx of [-w * .37, w * .37]) a.sphere(.025, x + dx, y + .155, z + side * (d / 2 + .045), "ink");
  }
}

function flowers(a: Art, x: number, y: number, z: number, color: "blue" | "gold", scale: number) {
  a.cylinder(.2 * scale, .27 * scale, x, y + .135 * scale, z, "honey", .25 * scale);
  a.cylinder(.255 * scale, .05 * scale, x, y + .27 * scale, z, "wood");
  for (let i = 0; i < 6; i++) {
    const angle = i * 2.4;
    const dx = Math.sin(angle) * .22 * scale;
    const dz = Math.cos(angle) * .22 * scale;
    const h = (.48 + i % 3 * .095) * scale;
    a.rod([x, y + .26 * scale, z], [x + dx, y + h, z + dz], .032, "green");
    a.sphere(.13 * scale, x + dx * .75, y + h - .13 * scale, z + dz * .75, "green", [1.35, .35, 1.1]);
    for (let n = 0; n < 5; n++) {
      const theta = n * Math.PI * .4;
      a.sphere(.072 * scale, x + dx + Math.cos(theta) * .07 * scale, y + h + Math.sin(theta) * .07 * scale, z + dz, color);
    }
    a.sphere(.036 * scale, x + dx, y + h, z + dz + .06 * scale, "paper");
  }
}

function shopWindow(a: Art) {
  const x = .08, y = 2.12, z = -4.37;
  const arch = (radius: number, height: number): [number, number][] => [
    [-radius, -height], [radius, -height],
    ...Array.from({ length: 17 }, (_, i): [number, number] => [Math.cos(i * Math.PI / 16) * radius, Math.sin(i * Math.PI / 16) * radius]),
  ];
  const jamb = new Shape();
  arch(1.01, .76).forEach(([xx, yy], i) => { if (i === 0) jamb.moveTo(xx, yy); else jamb.lineTo(xx, yy); });
  jamb.closePath();
  a.add(new ExtrudeGeometry(jamb, { depth: .09, bevelThickness: .033, bevelSize: .025, bevelSegments: 1, steps: 1 }), "stone", [x, y, z - .11]);
  silhouette(a, arch(.83, .67), x, y, z + .028, "darkTeal");
  silhouette(a, arch(.72, .6), x, y, z + .04, "windowGlass");
  a.box(1.42, .12, .018, x, y - .53, z + .054, "blue");
  silhouette(a, [[-.71, -.47], [-.71, -.29], [-.47, -.21], [-.2, -.33], [.12, -.26], [.35, -.1], [.56, -.15], [.71, -.31], [.71, -.52]], x, y, z + .061, "green");
  a.box(.1, .37, .023, x + .37, y - .12, z + .078, "paper");
  a.box(.13, .09, .024, x + .37, y + .08, z + .08, "ink");
  silhouette(a, [[-.084, 0], [.084, 0], [0, .103]], x + .37, y + .125, z + .096, "red");
  a.box(.055, 1.28, .08, x, y + .02, z + .099, "teal");
  a.box(1.46, .055, .08, x, y - .24, z + .099, "teal");
  a.bevelBox(2.02, .15, .36, .035, x, y - .73, z + .17, "limestone");
  for (let i = 1; i < 8; i++) {
    const at = i * Math.PI / 8;
    a.rod([x + Math.cos(at) * .85, y + Math.sin(at) * .85, z + .033],
      [x + Math.cos(at) * 1.01, y + Math.sin(at) * 1.01, z + .033], .026, "earth");
  }
}

function decorateShop(a: Art) {
  shopWindow(a);
  a.box(3.3, .029, 2.45, -.65, .026, 1.16, "earth");
  for (let i = 0; i < 9; i++) a.box(.345, .016, 2.35, -.65 + (i - 4) * .35, .047, 1.16, i % 2 ? "paper" : "teal");
  for (const x of [-4.04, 3.97]) {
    const z = -4.11;
    a.box(2.15, 2.82, .13, x, 1.51, z - .19, "darkTeal");
    for (const side of [-1, 1]) a.box(.13, 2.9, .52, x + side * 1.08, 1.49, z, "teal");
    for (let row = 0; row < 4; row++) {
      const y = .31 + row * .67;
      a.box(2.16, .11, .51, x, y, z, "teal");
      a.box(2.1, .065, .07, x, y + .035, z + .253, "honey");
      for (let col = 0; col < 5; col++) card(a, x + (col - 2) * .39, y + .26, z + .15,
        (col + row) % 3 === 0 ? "gold" : "teal", (col + row) % 3 === 0 ? "sail" : "star");
    }
    a.box(2.36, .13, .57, x, 2.98, z, "wood");
  }
  const flagZ = -4.27;
  a.rod([1.44, 2.96, flagZ], [2.58, 2.96, flagZ], .071, "wood");
  const cloth = a.pivot("shop-flag", [1.576,2.96,flagZ]);
  for (let row = 0; row < 9; row++) for (let col = 0; col < 8; col++) {
    const fold = Math.cos(col * 1.46 + row * .18);
    cloth.box(.13, .087, .025, col * .124, -.09 - row * .083, fold * .035, row % 2 ? "ink" : "paper", [0, fold * .15, 0], 1 + fold * .095);
  }
  cloth.box(.42, .41, .041, .149, -.24, .023, "paper");
  for (let i = 0; i < 8; i++) {
    const x = -.006 + i % 3 * .15, y = -.11 - Math.floor(i / 3) * .12;
    silhouette(cloth, [[0, .043], [.015, .01], [.044, -.025], [0, -.013], [-.044, -.025], [-.015, .01]], x, y, .047, "ink");
  }
  const z = -4.0;
  const height = (x: number) => 3.47 + .014 * x * x;
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 1.01;
    a.rod([x - .54, height(x - .54), z], [x + .54, height(x + .54), z], .022, "earth");
    silhouette(a, [[-.26, 0], [.26, 0], [.018, -.48]], x, height(x), z + .014, i % 2 ? "gold" : "teal");
  }
  for (const side of [-1, 1]) flowers(a, .08 + side * .68, 1.47, -4.06, "blue", .68);
  for (const z of [-1.65, -.55, .55]) {
    a.bevelBox(.105, .72, .66, .026, -5.34, 1.54, z, "walnut");
    a.box(.026, .57, .49, -5.284, 1.54, z, "paper");
    a.box(.02, .51, .42, -5.263, 1.54, z, z < -1 ? "gold" : "teal");
    a.sphere(.13, -5.25, 1.57, z, "paper", [.12, 1.13, .67]);
    a.box(.021, .036, .25, -5.245, 1.36, z, "paper");
  }
  loic(a, -2.36, -3.19, "cards");
  for (const x of [-4.78, 4.55]) {
    const barrelZ = x < 0 ? .34 : -.55;
    a.cylinder(.47, .72, x, .36, barrelZ, "wood", .49);
    for (const y of [.13, .62]) a.cylinder(.5, .085, x, y, barrelZ, "slate");
    flowers(a, x, .72, barrelZ, x < 0 ? "blue" : "gold", 1.03);
  }
  crate(a, 3.56, 0, 2.63, 1.1, .75);
  for (let i = 0; i < 4; i++) card(a, 3.21 + i * .23, .32, 2.7, i % 2 ? "gold" : "teal", i % 2 ? "sail" : "star", .73);
}

function lamp(a: Art, x: number, y: number, z: number, paint: Pigment) {
  a.cylinder(.36, .28, x, y, z, paint, .15);
  a.cylinder(.37, .035, x, y - .15, z, "earth");
  a.cylinder(.322, .019, x, y - .176, z, "paper");
  a.sphere(.095, x, y - .19, z, "paper");
  a.cylinder(.115, .19, x, y + .22, z, paint);
}

function jar(a: Art, x: number, y: number, z: number, tone: "green" | "leaf" | "gold") {
  a.cylinder(.134, .29, x, y + .155, z, "windowGlass");
  a.cylinder(.12, .25, x, y + .134, z + .018, tone);
  a.cylinder(.146, .06, x, y + .318, z, "bronze");
  a.rod([x + .068, y + .082, z + .113], [x + .068, y + .25, z + .119], .012, "paper");
  a.box(.135, .105, .02, x, y + .138, z + .13, "paper");
}

function parcel(a: Art, x: number, y: number, z: number, size: number) {
  a.box(size, size * .67, size * .82, x, y + size * .335, z, "honey");
  a.box(size * 1.008, size * .678, size * .24, x, y + size * .335, z, "paper");
  a.box(size * .18, size * .682, size * .828, x, y + size * .335, z, "paper");
  a.torus(size * .15, .017, x - size * .12, y + size * .74, z, "earth", [0, .3, .4]);
  a.torus(size * .15, .017, x + size * .12, y + size * .74, z, "earth", [0, -.3, -.4]);
}

function dryingBundle(a: Art, x: number, y: number, z: number, pigment: "leaf" | "gold" | "blue") {
  a.rod([x, y + .41, z], [x, y, z], .026, "earth");
  for (let n = 0; n < 9; n++) {
    const dx = Math.cos(n * 2.4) * (.07 + n % 3 * .039);
    const dz = Math.sin(n * 2.4) * .14;
    const drop = .32 + n % 4 * .067;
    a.rod([x, y, z], [x + dx, y - drop, z + dz], .024, "green");
    for (const fraction of [.53, .74, .93]) {
      const leaf = new SphereGeometry(1, 5, 4);
      leaf.scale(.048, .118, .027);
      a.add(leaf, pigment, [x + dx * fraction, y - drop * fraction, z + dz * fraction], [0, n * .58, Math.atan2(dx, drop) * 1.5]);
    }
  }
  a.cylinder(.086, .046, x, y - .058, z, "honey");
}

function decorateMarket(a: Art) {
  const shelfZ = -4.09, shelfX = -3.72;
  a.box(3.14, 2.86, .1, shelfX, 1.52, shelfZ - .19, "darkTeal");
  for (const dx of [-1.53, 0, 1.53]) a.box(.13, 2.93, .56, shelfX + dx, 1.53, shelfZ, "teal");
  for (const y of [.23, .82, 1.41, 2, 2.59]) {
    a.box(3.16, .11, .56, shelfX, y, shelfZ, "wood");
    for (let i = 0; i < 7; i++) {
      const x = shelfX + (i - 3) * .382 + (i >= 3 ? .17 : 0);
      if (i % 3 === 2 && y < 1.5) parcel(a, x, y + .055, shelfZ, .29);
      else jar(a, x, y + .054, shelfZ + .06, i % 3 === 1 ? "gold" : i % 3 === 2 ? "leaf" : "green");
    }
  }
  a.box(3.77, .16, .62, 3.25, 3.21, -4.07, "darkTeal", [.18, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const x = 1.68 + i * .63;
    silhouette(a, [[-.32, .08], [.32, .08], [.32, -.035], [.26, -.105], [.14, -.16], [0, -.18], [-.14, -.16], [-.26, -.105], [-.32, -.035]], x, 3.11, -3.751, "darkTeal");
  }
  a.rod([1.37, 3.28, -3.75], [5.11, 3.28, -3.75], .06, "honey");
  a.box(2.6, .16, .19, -.58, 3.47, -3.87, "wood");
  for (const [i, color] of (["leaf", "blue", "gold", "leaf"] as const).entries()) {
    const x = -1.77 + i*.55, y = 3.04 - i%2*.14;
    if (i === 3) dryingBundle(a.pivot("market-herbs", [x,y+.41,-3.82]),0,-.41,0,color);
    else dryingBundle(a,x,y,-3.82,color);
  }
  a.rod([-.92, 3.53, -4.41], [-.92, 3.44, -2.87], .098, "wood");
  a.rod([-.92, 3.13, -4.38], [-.92, 3.44, -3.76], .082, "wood");
  a.rod([-.92, 3.44, -2.92], [-.92, 3.17, -2.92], .042, "ink");
  lamp(a, -.92, 2.96, -2.92, "honey");
  loic(a, -3.02, -2.68, "parcel");

  const pressX = .05, pressZ = -3.09;
  for (const x of [pressX - .66, pressX + .66]) {
    a.box(.16, .77, .15, x, .39, pressZ - .36, "wood");
    a.box(.16, .77, .15, x, .39, pressZ + .36, "wood");
    a.cylinder(.071, .67, x, 1.44, pressZ, "steel");
  }
  a.box(1.65, .14, 1, pressX, .82, pressZ, "honey");
  a.box(1.43, .24, .82, pressX, 1.01, pressZ, "teal");
  a.box(.98, .13, .62, pressX, 1.17, pressZ, "steel");
  a.box(.94, .15, .62, pressX, 1.61, pressZ, "steel");
  a.box(1.49, .3, .67, pressX, 1.84, pressZ, "teal");
  a.cylinder(.33, .1, pressX, 1.92, pressZ + .35, "darkTeal", .33, [Math.PI / 2, 0, 0]);
  a.cylinder(.263, .038, pressX, 1.92, pressZ + .415, "paper", .263, [Math.PI / 2, 0, 0]);
  for (const [dx, dy] of [[-.17, 0], [-.135, .11], [0, .172], [.135, .11], [.17, 0]]) a.sphere(.02, pressX + dx, 1.92 + dy, pressZ + .438, "ink");
  a.rod([pressX, 1.89, pressZ + .442], [pressX + .115, 2.05, pressZ + .442], .032, "ink");

  // Order desk alcove and packing area leave the central aisle open from the threshold.
  a.box(.13, .72, .58, -4.08, .47, 1.52, "earth");
  a.box(.53, .12, .61, -3.83, .56, 1.52, "wood");
  crate(a, 3.49, 0, 2.81, 1.37, .83);
  for (const x of [3.1, 3.51, 3.92]) parcel(a, x, .086, 2.8, .38);
  parcel(a, 4.47, 0, 2.44, .66);
  parcel(a, 4.46, .48, 2.44, .48);
  flowers(a, -3.95, 0, 3.25, "gold", 1.25);
}

export function furnishMarket(a: Art, room: "market" | "shop") {
  if (room === "market") decorateMarket(a);
  else decorateShop(a);
}

function counter(a: Art, w: number, d: number, pigment: "darkTeal" | "teal" | "wood") {
  a.box(w * .88, .79, d * .86, 0, .49, 0, pigment);
  a.bevelBox(w, .139, d, .04, 0, .944, 0, "honey");
  a.bevelBox(w * .95, .13, d * .9, .026, 0, .083, 0, "walnut");
  for (const x of [-w * .43, 0, w * .43]) a.box(.1, .75, .07, x, .48, d * .442, "wood");
  for (const sign of [-1, 1]) {
    a.box(w * .39, .48, .035, sign * w * .225, .485, d * .443, pigment);
    a.frame(w * .38, .48, sign * w * .225, .485, d * .465, "honey", .034);
  }
}

export function furnishMarketStation(a: Art, objectId: string, w: number, d: number): boolean {
  if (objectId === "sales") {
    counter(a, w, d, "darkTeal");
    crate(a, -w * .275, 1.007, -.06, w * .36, d * .64);
    for (let i = 0; i < 3; i++) {
      const x = -w * .385 + i * .26;
      a.box(.21, .38 + i % 2 * .08, .116, x, 1.265, -.1, "paper", [0, 0, (.08 - i * .071)]);
      a.box(.123, .035, .012, x, 1.28, -.039, "green");
    }
    for (const x of [.09, .42]) jar(a, x, 1.006, d * .25, "leaf");
    parcel(a, .29, 1.009, -d * .25, .45);
    a.cylinder(.2, .05, w * .35, 1.038, -.085, "slate");
    a.rod([w * .35, 1.06, -.085], [w * .35, 1.53, -.085], .054, "honey");
    a.rod([w * .35 - .23, 1.45, -.085], [w * .35 + .23, 1.5, -.085], .041, "gold");
    for (const side of [-1, 1]) {
      const x = w * .35 + side * .21;
      a.rod([x, 1.47, -.085], [x, 1.26, -.085], .017, "ink");
      a.cylinder(.11, .04, x, 1.24, -.085, "gold", .14);
    }
  } else if (objectId === "stock") {
    for (const x of [-w * .47, w * .47]) for (const z of [-d * .43, d * .43]) a.box(.11, 1.81, .11, x, .92, z, "darkTeal");
    a.box(w * .91, 1.61, .085, 0, .94, -d * .38, "teal");
    for (const y of [.28, .83, 1.39]) {
      a.box(w, .09, d * .91, 0, y, 0, "wood");
      a.box(w * .95, .05, .046, 0, y + .01, d * .46, "honey");
      for (const x of [-w * .32, 0, w * .32]) parcel(a, x, y + .05, 0, y < .5 ? .45 : .32);
    }
    a.box(w, .13, d, 0, 1.81, 0, "darkTeal");
    a.box(w * .35, .12, .036, 0, 1.81, d * .505, "paper");
  } else if (objectId === "communication") {
    for (const x of [-w * .43, w * .43]) {
      a.box(.095, 2.22, .11, x, 1.12, 0, "wood");
      a.box(.15, .075, d * .96, x, .04, 0, "earth");
    }
    a.box(w, 1.31, .12, 0, 1.51, 0, "honey");
    a.frame(w, 1.32, 0, 1.51, .043, "wood", .073);
    const notes: readonly (readonly [number, number, number, number])[] = [[-.32, 1.62, .34, .53], [-.08, 1.76, .43, .37], [.17, 1.67, .4, .54], [.36, 1.8, .25, .33], [.35, 1.24, .27, .35], [-.08, 1.22, .34, .29]];
    for (const [dx, y, width, height] of notes) {
      const x = dx * w;
      a.box(width, height, .026, x, y, .077, "paper", [0, 0, dx * .26]);
      a.sphere(.029, x, y + height * .37, .097, "gold");
      for (let i = 0; i < 3; i++) a.box(width * (.73 - i * .09), .024, .011, x, y + .065 - i * .061, .098, i ? "stone" : "darkTeal");
    }
  } else if (objectId === "business") {
    counter(a, w, d, "wood");
    const x = w * .185, z = d * -.245;
    a.box(.57, .08, .41, x, 1.041, z, "slate");
    a.box(.65, .49, .14, x, 1.34, z, "darkTeal", [-.13, 0, 0]);
    a.box(.54, .38, .018, x, 1.35, z + .076, "glass", [-.13, 0, 0]);
    a.box(.56, .043, .17, x, 1.027, z + .29, "teal");
    const bookX = -w * .2;
    a.box(.65, .042, .31, bookX, 1.028, .12, "teal", [0, .1, 0]);
    for (const side of [-1, 1]) {
      a.box(.315, .036, .29, bookX + side * .157, 1.055, .12, "paper", [0, .1, side * -.08]);
      for (let line = 0; line < 4; line++) a.box(.245, .008, .015, bookX + side * .157, 1.08, .035 + line * .05, "stone", [0, .1, side * -.08]);
    }
    parcel(a, -w * .33, 1.01, -d * .27, .32);
  } else if (objectId === "packs" || objectId === "buddies") {
    const buddy = objectId === "buddies";
    counter(a, w, d, buddy ? "teal" : "darkTeal");
    for (const side of [-1, 1]) {
      const center = side * w * .26;
      crate(a, center, 1.007, d * -.08, w * .405, d * .66);
      for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) {
        card(a, center + (column - 1) * w * .105, 1.31 + row * .125, d * (.12 - row * .26),
          buddy ? "gold" : "teal", buddy && column === 1 ? "star" : buddy ? "sail" : "star", .8);
      }
    }
  } else if (objectId === "collection") {
    counter(a, w, d, "teal");
    for (const side of [-1, 1]) {
      const x = side * w * .2;
      a.box(w * .399, .07, d * .69, x, 1.062, 0, "darkTeal");
      a.box(w * .385, .065, d * .66, x, 1.115, 0, "paper", [0, 0, -.06 * side]);
      for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
        const z = d * (row ? .156 : -.156), cardX = x + (column ? .22 : -.22);
        a.box(.32, .022, .4, cardX, 1.158, z, row === column ? "gold" : "teal");
        a.box(.19, .007, .072, cardX, 1.172, z - .11, "paper");
        a.sphere(.081, cardX, 1.17, z + .048, "cream", [1, .14, 1]);
      }
    }
  } else {
    return false;
  }
  return true;
}
