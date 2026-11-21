import * as THREE from "three";
import { Assembly, type CharacterPoint } from "./world/village-character-art";

const ink = "#2e453c";
const teal = "#30796d";
const tealLight = "#67a399";
const wood = "#ca8946";
const woodLight = "#e5ae64";
const woodDark = "#96603e";
const gold = "#efb342";
const steel = "#b8cec4";
const leaves = ["#558047", "#8b9e4c", "#b0b764", "#4b6b41"];
export const trimTableHeight = .89;

function cylinder(art: Assembly, at: CharacterPoint, top: number, bottom: number, height: number, color: string) {
  art.add(new THREE.CylinderGeometry(top, bottom, height, 36), color, at);
}

function rim(art: Assembly, at: CharacterPoint, radius: number, thickness: number, color: string, scale: CharacterPoint = [1, 1, 1]) {
  art.add(new THREE.TorusGeometry(radius, thickness, 8, 36).rotateX(Math.PI / 2).scale(...scale), color, at);
}

function flowers(art: Assembly, x: number, y: number, z: number, scale = 1) {
  const offsets = [[-.074, .01], [-.033, -.062], [.015, .04], [.052, -.045], [.085, .028], [.004, -.009]];
  offsets.forEach(([dx, dz], index) => {
    const radius = (.031 + (index % 3) * .006) * scale;
    art.ball([x + dx * scale, y + radius * .42, z + dz * scale], radius, leaves[index % leaves.length], [1, .83, 1.18]);
    art.ball([x + (dx + .012) * scale, y + radius * 1.10, z + dz * scale], radius * .47, leaves[(index + 2) % leaves.length]);
  });
}

function addShell(art: Assembly) {
  art.box([0, -.122, -.05], [4.54, .19, 2.45], ink);
  art.box([0, -.072, -.05], [4.50, .10, 2.41], "#bf8b58");
  art.box([0, -.019, -.05], [4.49, .022, 2.40], "#ba9a76");
  const tiles = ["#eacfa3", "#f2dbb5", "#e6c69b", "#ecd2ad"];
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 10; column++) {
      art.box([(column - 4.5) * .446, -.005, -.05 + (row - 2) * .476], [.435, .015, .465], tiles[(row * 7 + column * 5) % tiles.length]);
    }
  }

  const bricks = ["#ecd2a6", "#e3c197", "#f0d8b0", "#e9c99e", "#edd0a3"];
  const spans = [{ length: 4.50, edge: -1.19, center: 0, side: false }, { length: 1.33, edge: -2.18, center: -.52, side: true }];
  for (const { length, edge, center, side } of spans) {
    const stone = (along: number, y: number, width: number, height: number, depth: number, color: string, inset = 0) => {
      art.box(side ? [edge + inset, y, along] : [along, y, edge + inset], side ? [depth, height, width] : [width, height, depth], color);
    };
    stone(center, .89, length, 1.78, .10, "#bf9d78");
    for (let row = 0; row < 8; row++) {
      const end = center + length / 2;
      for (let start = center - length / 2 - (row % 2) * .215, index = 0; start < end; start += .43, index++) {
        const left = Math.max(start, center - length / 2);
        const width = Math.min(start + .43, end) - left;
        stone(left + width / 2, .12 + row * .222, width - .011, .207, .031, bricks[(row * 3 + index * 7) % bricks.length], .052);
      }
    }
    for (const y of [.07, .55, 1.782]) {
      stone(center, y, length + .033, y === 1.782 ? .084 : .057, .123, teal);
      stone(center, y + .018, length + .014, .012, .132, tealLight);
    }
    for (const end of [center - length / 2, center + length / 2]) {
      stone(end, .92, .086, 1.77, .15, ink);
      stone(end, .92, .044, 1.77, .157, teal, .024);
      for (const y of [.16, .57, 1.27, 1.70]) stone(end, y, .029, .029, .027, "#93ada0", .104);
    }
  }
}

function addFixtures(art: Assembly) {
  // A shaded work light and jars on the wall keep the bench clear.
  art.box([-.53, 1.54, -1.116], [.14, .19, .07], teal);
  art.sweep([[-.53, 1.57, -1.07], [-.53, 1.68, -.96], [-.53, 1.66, -.79], [-.53, 1.55, -.71]], [.028, .028, .025, .025], teal);
  cylinder(art, [-.53, 1.515, -.71], .058, .162, .13, teal);
  cylinder(art, [-.53, 1.449, -.71], .164, .151, .021, ink);
  cylinder(art, [-.53, 1.436, -.71], .142, .142, .012, "#ffe394");

  art.box([-1.44, 1.15, -.987], [1.05, .066, .32], woodDark);
  art.box([-1.44, 1.188, -.987], [1.06, .030, .32], woodLight);
  for (const x of [-1.77, -1.10]) art.rod([x, .975, -1.125], [x, 1.15, -.89], .027, teal);
  for (const [index, x] of [-1.77, -1.42, -1.085].entries()) {
    const base = 1.205, height = .226 + .025 * index;
    cylinder(art, [x, base + height / 2, -.962], .107, .109, height, index === 1 ? "#a1a165" : "#779271");
    cylinder(art, [x, base + height + .017, -.962], .099, .109, .040, gold);
    art.box([x, base + .077, -.857], [.137, .086, .015], "#f7e4ba");
    art.box([x, base + .077, -.846], [.069, .012, .010], teal);
  }

  art.sweep([[1.48, 1.69, -1.04], [1.48, 1.69, -.99], [1.42, 1.61, -.96], [1.28, 1.61, -.96], [.96, 1.61, -.96]], [.068, .068, .062, .060, .060], tealLight);
  art.rod([1.31, 1.61, -.96], [1.355, 1.61, -.96], .078, teal);
  art.box([.82, 1.56, -1.062], [.49, .35, .12], ink);
  art.box([.82, 1.56, -.99], [.45, .31, .045], teal);
  for (const y of [1.46, 1.53, 1.60, 1.67]) art.box([.82, y, -.958], [.37, .027, .043], tealLight);
}

function addBench(art: Assembly) {
  const tableZ = .38;
  for (const x of [-1.74, 1.74]) {
    for (const z of [.061, .716]) {
      art.box([x, .409, z], [.135, .795, .141], woodDark);
      art.box([x + .009, .409, z + .055], [.096, .745, .052], wood);
      art.box([x, .046, z], [.155, .07, .170], ink);
      art.ball([x, .721, z + .084], .026, gold, [1, 1, .40]);
    }
    art.rod([x, .242, .061], [x, .242, .716], .049, woodDark);
    art.rod([x, .502, .69], [x, .754, .39], .051, wood);
  }
  art.box([0, .243, tableZ], [3.48, .091, .102], woodDark);
  art.box([0, .781, tableZ], [3.83, .097, .835], woodDark);
  art.box([0, .824, tableZ], [4.02, .099, .96], ink);
  art.box([0, .84, tableZ], [3.993, .076, .943], wood);
  for (const [index, z] of [.02, .257, .494, .731].entries()) {
    art.box([0, .878, z], [3.982, .023, .229], index % 2 ? woodLight : "#e0a45b");
    for (const x of [-1.19, -.06, 1.14]) {
      const start = x + Math.sin(index * 3 + x) * .14;
      art.sweep([[start - .33, .891, z + .029], [start, .891, z + .018], [start + .31, .891, z + .039]], [.002, .005, .002], "#c3884e", 4);
    }
  }
  art.box([0, .832, .855], [3.97, .020, .014], woodLight);

  const x = -1.44, z = .46;
  art.box([x, .145, z], [.53, .254, .41], teal);
  art.box([x, .277, z], [.588, .056, .459], ink);
  art.box([x, .311, z], [.566, .034, .439], tealLight);
  art.box([x, .155, z + .209], [.234, .050, .018], ink);
  for (const offset of [-.164, 0, .164]) art.box([x + offset, .087, z + .211], [.018, .062, .020], tealLight);
  flowers(art, x, .329, z, 1.4);
}

export function addTrimRoom(parent: THREE.Object3D, material: THREE.Material) {
  const art = new Assembly();
  addShell(art);
  addFixtures(art);
  addBench(art);
  art.finish("atelier", parent, material);
}

export function createTrimTray(parent: THREE.Object3D, material: THREE.Material) {
  const art = new Assembly();
  art.box([0, .032, 0], [.392, .050, .243], "#aa8056");
  art.box([0, .059, 0], [.350, .021, .211], "#dfbe8a");
  for (const x of [-.203, .203]) art.box([x, .068, 0], [.030, .059, .267], "#f3dcb1");
  for (const z of [-.129, .129]) art.box([0, .068, z], [.400, .059, .029], "#f3dcb1");
  flowers(art, 0, .078, 0, 1.14);
  return art.finish("bac", parent, material);
}

export function createTrimScissors(parent: THREE.Object3D, material: THREE.Material) {
  const scissors = new THREE.Group();
  const makeBlade = (side: number) => {
    const art = new Assembly();
    const shape = new THREE.Shape();
    shape.moveTo(-.048 * side, -.036);
    shape.lineTo(.047 * side, .022);
    shape.quadraticCurveTo(.052 * side, .16, .007 * side, .295);
    shape.lineTo(-.022 * side, .160);
    shape.closePath();
    art.add(new THREE.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: true, bevelSegments: 1, bevelSize: .004, bevelThickness: .004, steps: 1, curveSegments: 9 }).rotateX(Math.PI / 2), side > 0 ? steel : "#8daaa1");
    art.rod([.018 * side, -.01, -.007], [.081 * side, -.01, -.12], .019, gold);
    rim(art, [.088 * side, -.009, -.172], .052, .017, gold, [1, .9, 1.27]);
    return art.finish("lame", scissors, material);
  };
  const upper = makeBlade(1), lower = makeBlade(-1);
  upper.position.y = .012;
  const joint = new Assembly();
  cylinder(joint, [0, .018, 0], .034, .035, .023, ink);
  cylinder(joint, [0, .032, 0], .021, .021, .012, gold);
  joint.finish("pivot", scissors, material);
  parent.add(scissors);
  return {
    object: scissors,
    open(amount: number) {
      upper.rotation.y = amount * .29;
      lower.rotation.y = -amount * .25;
    },
  };
}

export function createTrimMachine(parent: THREE.Object3D, material: THREE.Material) {
  const object = new THREE.Group();
  const body = new Assembly(), rotor = new THREE.Group(), art = new Assembly();
  cylinder(body, [0, .033, 0], .302, .282, .066, ink);
  cylinder(body, [0, .153, 0], .307, .274, .213, teal);
  cylinder(body, [0, .273, 0], .319, .298, .069, "#8aaca1");
  cylinder(body, [0, .310, 0], .294, .294, .019, ink);
  rim(body, [0, .334, 0], .297, .024, steel);
  body.box([0, .164, .288], [.226, .106, .076], ink);
  body.box([0, .166, .329], [.184, .067, .015], "#4e9e89");
  body.ball([.045, .166, .342], .020, gold, [1, 1, .50]);
  body.finish("carter", object, material);
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    art.add(new THREE.BoxGeometry(.081, .026, .198).rotateY(angle), steel, [Math.sin(angle) * .148, .328, Math.cos(angle) * .148]);
  }
  cylinder(art, [0, .345, 0], .073, .084, .054, gold);
  art.finish("rotor", rotor, material);
  object.add(rotor);
  parent.add(object);
  return { object, rotor };
}
