import * as THREE from "three";
import type { Art } from "./interior-art";
import { createInteriorPortrait } from "./interior-residents";

// The jury kiosk, mission noticeboard, harvest crate and reward chest are the
// ones depicted on the village map and on the activity's printed sheets.
type Paint = Parameters<Art["box"]>[6];

function stool(a: Art, x: number, z: number, y = 0) {
  a.cylinder(.36, .12, x, y + .55, z, "honey");
  a.torus(.28, .022, x, y + .26, z, "wood", [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const dx = Math.cos(i * Math.PI * 2 / 3), dz = Math.sin(i * Math.PI * 2 / 3);
    a.rod([x + dx * .32, y + .03, z + dz * .32], [x + dx * .2, y + .53, z + dz * .2], .09, "wood");
  }
}

function trestle(a: Art, x: number, z: number, width: number, depth: number, top: number) {
  for (const end of [-1, 1]) for (const side of [-1, 1]) {
    a.rod([x + end * width * .37, .03, z + side * depth * .46], [x + end * width * .37, top, z + side * depth * .23], .12, "wood");
  }
  a.box(width * .81, .1, .12, x, top * .38, z, "wood");
  for (let i = 0; i < 4; i++) a.box(width, .105, depth / 4 - .011, x, top, z + (i - 1.5) * depth / 4, i % 2 ? "honey" : "wood");
}

function fieldJar(a: Art, x: number, y: number, z: number, scale: number) {
  const r = .24 * scale, height = .58 * scale;
  a.cylinder(r, height * .79, x, y + height * .405, z, "windowGlass", r);
  a.cylinder(r, height * .14, x, y + height * .861, z, "windowGlass", r * .82);
  a.cylinder(r * .86, height * .11, x, y + height * .987, z, "brass");
  a.torus(r * .82, .014 * scale, x, y + height * 1.042, z, "gold", [Math.PI / 2, 0, 0]);
  a.rod([x + r * .58, y + height * .2, z + r * .8], [x + r * .58, y + height * .72, z + r * .8], .017 * scale, "paper");
  a.torus(r * .92, .023 * scale, x, y + height * .12, z, "teal", [Math.PI / 2, 0, 0]);
  a.box(.22 * scale, .24 * scale, .03, x + .049 * scale, y + height * .52, z + r * .91, "paper", [0, .1, -.11]);
  a.sphere(.062 * scale, x + .045 * scale, y + height * .51, z + r, "green", [.7, 1.35, .23]);
  a.box(.025 * scale, .24 * scale, .018, x + r * .72, y + height * .53, z + r * .7, "paper", [0, .67, 0]);
}

function lantern(a: Art, x: number, z: number, beam: number) {
  a.torus(.115, .023, x, beam - .17, z, "ink");
  a.cylinder(.23, .11, x, beam - .29, z, "ink", .1);
  a.cylinder(.16, .35, x, beam - .505, z, "gold", .207);
  a.sphere(.11, x, beam - .49, z + .075, "paper", [.65, 1.3, .62]);
  for (const dx of [-.13, .13]) a.rod([x + dx * .8, beam - .68, z + .09], [x + dx, beam - .35, z + .115], .025, "ink");
  a.cylinder(.18, .06, x, beam - .69, z, "ink");
}

function foliage(a: Art, x: number, z: number, scale: number) {
  a.cylinder(.38 * scale, .6 * scale, x, .32 * scale, z, "apricot", .51 * scale);
  a.cylinder(.53 * scale, .1 * scale, x, .63 * scale, z, "wood");
  for (let i = 0; i < 11; i++) {
    const angle = 2.4 * i, radius = (.18 + i % 3 * .09) * scale;
    const xx = x + Math.cos(angle) * radius, zz = z + Math.sin(angle) * radius;
    const h = (.95 + Math.sin(i * 4) * .14) * scale;
    a.rod([x, .68 * scale, z], [xx, h, zz], .035 * scale, "green");
    a.sphere(.24 * scale, xx, h, zz, i % 3 ? "leaf" : "green", [1, 1.35, .69]);
    if (!(i % 3)) a.sphere(.073 * scale, xx, h + .19 * scale, zz, "gold");
  }
}

function awardCup(a: Art, x: number, y: number, z: number, scale: number) {
  const s = scale;
  a.box(.64 * s, .14 * s, .57 * s, x, y + .07 * s, z, "wood");
  a.cylinder(.23 * s, .13 * s, x, y + .2 * s, z, "gold", .13 * s);
  a.cylinder(.071 * s, .26 * s, x, y + .35 * s, z, "gold");
  a.cylinder(.1 * s, .47 * s, x, y + .69 * s, z, "gold", .32 * s);
  a.torus(.315 * s, .033 * s, x, y + .93 * s, z, "gold", [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) a.torus(.16 * s, .032 * s, x + side * .286 * s, y + .73 * s, z, "gold");
}

function pennantRope(a: Art, first: number, last: number, y: number, z: number) {
  const point = (t: number): [number, number, number] => [first + t * (last - first), y - .44 * Math.sin(t * Math.PI), z];
  for (let i = 0; i < 12; i++) {
    const start = point(i / 12), end = point((i + 1) / 12);
    a.rod(start, end, .032, "wood");
    const flag = new THREE.Shape().moveTo(0, 0).lineTo((end[0] - start[0]) * .83, end[1] - start[1]).lineTo((end[0] - start[0]) * .42, -.43).closePath();
    a.add(new THREE.ShapeGeometry(flag), i % 2 ? "teal" : "paper", [start[0] + .04, start[1], z + .015]);
  }
}

function juryHall(a: Art) {
  // Open timber pavilion with a dark backing behind the bright sample table.
  a.box(7.25, 2.68, .14, -.65, 1.43, -4.31, "slate");
  for (const x of [-4.45, -.65, 3.15]) {
    a.box(.23, 3.18, .28, x, 1.61, -4, "wood");
    for (const s of [-1, 1]) a.rod([x, 2.25, -3.95], [x + s * .6, 3, -3.95], .17, "honey");
  }
  a.box(8.65, .21, .32, -.65, 3.14, -4, "honey");
  const roof = .28;
  for (let i = 0; i < 29; i++) {
    const x = -4.9 + i * .306;
    a.box(.321, .091, 1.18, x, 3.31, -3.97, i % 3 ? "slate" : "darkTeal", [roof, 0, 0]);
  }
  pennantRope(a, -4.38, 3.06, 3.05, -3.55);
  for (const x of [-3.75, 2.4]) lantern(a, x, -3.45, 3.04);
  // Shallow proscenium and two rounded lips leave the judge and tabletop in view.
  a.box(5.93, .17, 3.43, -.65, .094, -1.69, "wood");
  for (let i = 0; i < 13; i++) a.box(.448, .055, 3.44, -3.42 + i * .462, .193, -1.69, i % 3 ? "honey" : "wood");
  a.bevelBox(5.98, .075, .36, .021, -.65, .073, .15, "honey");
  for (const x of [-2.15, .85]) stool(a, x, .52);
  // Trophy cabinet and the two seating banks frame the public aisle.
  trestle(a, 3.95, -3.45, 2.13, 1.04, .78);
  awardCup(a, 3.83, .84, -3.48, 1.19);
  for (const x of [3.28, 4.65]) awardCup(a, x, .84, -3.39, .59);
  for (const z of [.1, 2.08]) {
    trestle(a, -3.79, z, 2.02, .74, .53);
    a.box(2.05, .33, .09, -3.79, .86, z - .34, "darkTeal");
    for (const s of [-1, 1]) a.box(.075, .58, .07, -3.79 + s * .8, .73, z - .34, "wood");
  }
  foliage(a, 4.35, 2.68, .86);
  for (const x of [-2.1, 2.13]) {
    a.cylinder(.2, .055, x, .048, 2.74, "slate");
    a.cylinder(.048, .7, x, .39, 2.74, "gold");
    a.sphere(.11, x, .81, 2.74, "gold");
  }
  // Runner with a double woven edge. The path to the village remains open.
  a.bevelBox(2.53, .022, 3.65, .009, 0, .027, 2.35, "velvet");
  for (const x of [-1.13, 1.13]) a.box(.048, .01, 3.65, x, .043, 2.35, "gold");

  addJudge(a.pivot("daytime-resident", [0, 0, 0]));
}

function addJudge(a: Art) {
  // The judge in the Quartier's illustration wears a bow tie and reads a
  // clipboard into a ribbed microphone, behind the samples under the lanterns.
  const x = -.65, z = -2.65;
  a.sphere(.36, x, 1.13, z, "paper", [1.04, 1.18, .71]);
  a.box(.48, .42, .09, x, 1.08, z+.19, "darkTeal");
  a.sphere(.137, x, 1.46, z, "judgeSkin", [1, .82, .85]);
  a.sphere(.187, x, 1.378, z + .012, "paper", [1.15, .52, 1.10]);
  a.cylinder(.137, .064, x, 1.428, z + .016, "paper", .117);
  const head = a.pivot("arena-judge-head", [x, 1.475, z]);
  head.attach(createInteriorPortrait("judge"));
  a.bevelBox(.09, .096, .072, .024, x, 1.403, z + .201, "darkTeal");
  for (const side of [-1, 1]) {
    a.bevelBox(.151, .109, .074, .027, x + side * .092, 1.412, z + .183, "teal", [0, side * .26, side * .22]);
    a.sphere(.026, x, 1.21 + side * .046, z + .236, "brass", [1, 1, .59]);
    const elbow = [x + side*.38, 1.04, z+.16] as const;
    a.rod([x + side*.27, 1.29, z], elbow, .15, "paper");
    if (side < 0) {
      a.rod(elbow, [x - .32, 1.164, z+.26], .126, "paper");
      a.sphere(.089, x - .32, 1.25, z+.31, "judgeSkin", [.87, 1.13, .88]);
    }
  }
  const hand = a.pivot("arena-judge-hand", [x+.38, 1.04, z+.16]);
  hand.rod([0, 0, 0], [-.06, .153, .11], .125, "paper");
  hand.sphere(.09, -.06,.21,.15, "judgeSkin", [.88, 1.04, .84]);
  hand.bevelBox(.33,.46,.046,.016,-.13,.28,.16,"honey",[-.17,0,-.09]);
  hand.box(.275,.354,.03,-.13,.28,.191,"paper",[-.17,0,-.09]);
  hand.box(.1,.044,.025,-.13,.47,.218,"brass");
  a.cylinder(.045,.25,x-.32,1.39,z+.32,"ink");
  a.sphere(.105,x-.32,1.58,z+.32,"steel",[.82,1.32,.77]);
  for (const dy of [-.043,.018,.075]) a.box(.141,.013,.018,x-.32,1.58+dy,z+.389,"slate");
}

function missionHouse(a: Art) {
  // A dispatch room lined with open pigeonholes, tied bundles and field maps.
  a.box(4.47, 2.28, .55, -2.53, 1.21, -4.04, "earth");
  for (let row = 0; row < 3; row++) {
    const y = .52 + row * .74;
    a.box(4.57, .09, .64, -2.53, y -.27, -4.01, "honey");
    for (let col = 0; col < 6; col++) {
      const x = -4.4 + col * .75;
      a.box(.063, .69, .58, x - .35, y + .08, -4.01, "wood");
      for (let sheet = 0; sheet < 2 + (col + row) % 3; sheet++) {
        a.box(.49, .075, .37, x + .023 * Math.sin(sheet + col), y - .17 + sheet * .084, -3.77, sheet % 2 ? "cream" : "paper", [0, .05 * Math.sin(sheet), 0]);
      }
    }
  }
  a.box(4.65, .13, .74, -2.53, 2.33, -4.01, "wood");
  // Expedition map framed like the small chart pinned to the illustrated kiosk.
  a.box(3.8, 1.58, .09, 2.36, 1.85, -4.31, "honey");
  a.box(3.57, 1.36, .055, 2.36, 1.85, -4.24, "paper");
  const trail = [[.86, 1.49], [1.38, 1.97], [1.92, 1.79], [2.31, 2.14], [2.98, 1.91], [3.66, 2.25]];
  for (let i = 1; i < trail.length; i++) {
    const [x, y] = trail[i], [px, py] = trail[i - 1];
    a.rod([px, py, -4.19], [x, y, -4.19], .043, "wood");
    a.sphere(.075, x, y, -4.15, i % 2 ? "red" : "teal", [1, 1, .38]);
  }
  a.box(2.68, .11, .58, 2.42, .81, -3.89, "honey");
  for (const x of [1.32, 3.54]) a.box(.14, .78, .46, x, .4, -3.89, "wood");
  for (let i = 0; i < 5; i++) {
    const x = 1.61 + i * .35;
    a.cylinder(.125, .46, x, 1, -3.75, "cream", .12, [Math.PI / 2, 0, .02]);
    a.torus(.125, .023, x, 1, -3.69, "red");
  }
  // Open chest from the reward sheet: curved lid, brass clasps and teal-capped packs.
  const x = 2.96, z = 2.09;
  trestle(a, x, z, 2.5, 1.31, .61);
  a.bevelBox(1.65, .52, .82, .045, x, .94, z, "honey");
  a.box(1.48, .055, .68, x, 1.218, z, "earth");
  a.box(1.64, .75, .13, x, 1.51, z - .48, "wood", [-.26, 0, 0]);
  a.box(1.44, .55, .12, x, 1.5, z - .39, "teal", [-.26, 0, 0]);
  for (const s of [-1, 1]) {
    a.box(.14, .52, .86, x + s * .64, .95, z, "darkTeal");
    a.bevelBox(.16, .18, .055, .021, x + s * .64, 1.09, z + .46, "brass");
    a.sphere(.023, x + s * .64, 1.09, z + .492, "forgedIron");
    a.box(.44, .4, .12, x + s * .31, 1.38, z + s * .08, "gold", [-.14, 0, s * .09]);
    a.box(.46, .17, .14, x + s * .31, 1.55, z + s * .08 - .02, "teal", [-.14, 0, s * .09]);
  }
  for (const xx of [-4, -2.7]) a.box(.14, .48, .55, xx, .25, 2.03, "wood");
  for (const dz of [-.19, .19]) a.box(1.98, .12, .34, -3.35, .53, 2.03 + dz, "honey");
  foliage(a, -4.51, 2.99, .92);
  foliage(a, 4.44, -3.32, .91);
  for (let i = 0; i < 5; i++) {
    const zz = 3.58 - i * .78, xx = -.42 - .11 * i;
    a.cylinder(.43, .047, xx, .045, zz, "stone", .47, [0, i * .57, 0]);
    a.cylinder(.27, .038, xx + .74, .04, zz + .09, "cream");
  }
}

export function furnishCivic(a: Art, room: "arena" | "missions") {
  if (room === "arena") juryHall(a);
  else missionHouse(a);
}

/** Shallow fluted cloth follows the front and both returns of the judging table. */
function juryTable(a: Art, w: number, d: number) {
  trestle(a, 0, 0, w, d, 1.04);
  for (let i = 0; i < 5; i++) {
    const paint = i % 2 ? "paper" : "teal", right = -w / 2 + w * i / 5;
    a.box(w / 5 + .008, .04, d + .05, right + w / 10, 1.115, 0, paint);
    for (let j = 0; j < 5; j++) {
      const x = right + w * (j + .5) / 25, wave = Math.sin(j / 4 * Math.PI * 2);
      a.box(w / 25 + .01, .664 + wave * .035, .055, x, .775, d / 2 + wave * .043, paint, [0, wave * .11, 0], .96 + wave * .038);
    }
  }
  for (const x of [-w * .32, 0, w * .32]) {
    fieldJar(a, x, 1.145, -.07, 1.23);
    a.cylinder(.118, .045, x + .2, 1.177, d * .33, "gold");
  }
}

export function furnishCivicStation(a: Art, id: string, w: number, d: number) {
  if (id === "jury") {
    juryTable(a, w, d);
  } else if (id === "arena-storage") {
    for (const x of [-w * .47, w * .47]) a.box(.085, 1.17, d, x, .6, 0, "honey");
    for (const s of [-1, 1]) for (const y of [.21, .49, .77]) a.box(w, .23, .065, 0, y, s * d * .46, "wood");
    a.box(w, .08, d, 0, .62, 0, "honey");
    for (const x of [-w * .23, w * .23]) fieldJar(a, x, .68, 0, 1.48);
    for (let i = 0; i < 4; i++) a.box(.085, .43, .043, w * .17 + i * .083, .71, d * .51, i % 2 ? "teal" : "cream");
  } else if (id === "missions" || id === "community") {
    const trim: Paint = id === "missions" ? "teal" : "honey";
    a.bevelBox(w * .87, 1.42, .14, .035, 0, 1.54, 0, "wood");
    a.frame(w * .82, 1.32, 0, 1.54, .078, "honey", .046);
    for (const side of [-1, 1]) {
      a.box(.14, 2.28, .18, side * w * .43, 1.14, 0, "wood");
      a.bevelBox(.34, .11, d * .86, .032, side * w * .43, .064, 0, "stone");
      a.cylinder(.031, .058, side * w * .43, 2.17, .089, "bronze", .031, [Math.PI / 2,0,0]);
      a.box(w * .53, .11, d, side * w * .25, 2.54, 0, trim, [0, 0, -side * .27]);
      for (let i = 0; i < 5; i++) {
        const t = (i + .64) * .1;
        a.box(w * .125, .075, d * 1.02, side * w * t, 2.87 - t * w * .28, 0, i % 2 ? trim : "darkTeal", [0, 0, -side * .27]);
      }
    }
    a.box(w * .9, .1, .22, 0, .81, 0, "honey");
    if (id === "missions") {
      // Oversized tacked checklist and curling map, as on the navigation illustration.
      a.box(w * .49, 1.32, .045, -w * .11, 1.61, .112, "cream", [0, 0, -.045]);
      for (let n = 0; n < 3; n++) {
        const y = 1.94 - n * .34, x = -w * .265;
        a.frame(.16, .16, x, y, .153, "teal", .019);
        if (n < 2) { a.rod([x-.06,y,.175],[x-.015,y-.049,.175],.03,"teal"); a.rod([x-.015,y-.049,.175],[x+.105,y+.11,.175],.03,"teal"); }
        a.box(w * .24, .028, .02, -w * .063, y + .013, .16, "ink");
        a.box(w * .15, .018, .02, -w * .1, y - .07, .16, "stone");
      }
      a.box(w * .23, .85, .048, w * .26, 1.35, .14, "paper", [0, 0, .12]);
      for (let n = 0; n < 6; n++) a.sphere(.046, w * .26 + Math.sin(n * 2) * .15, 1.09 + n * .099, .18, n % 2 ? "green" : "honey", [1, 1.25, .2]);
    } else {
      for (let n = 0; n < 5; n++) {
        const x = (n % 3 - 1) * w * .25 + (n >= 3 ? w * .08 : 0), y = n < 3 ? 1.8 : 1.22;
        a.box(w * .21, .52, .04, x, y, .13, n % 2 ? "paper" : "cream", [0, 0, .06 * Math.sin(n)]);
        a.sphere(.032, x, y+.21, .162, "red");
        a.box(w * .13, .022, .018, x, y+.06, .164, "slate");
        a.box(w * .11, .022, .018, x-.02, y-.025, .164, "stone");
        a.sphere(.054, x+.09, y-.14, .171, "red", [1, 1, .22]);
      }
    }
  } else return false;
  return true;
}
