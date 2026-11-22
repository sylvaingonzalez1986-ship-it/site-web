import * as THREE from "three";
import { Assembly, type CharacterPoint } from "./village-character-art";

export const KORRIGAN_PALETTES = [
  { name: "garance", cap: "#aa3e3c", seam: "#79302b", vest: "#613735", skin: "#ebae7c", flush: "#ce785a", hair: "#573420", shorts: "#4a4a35" },
  { name: "canard", cap: "#298681", seam: "#185754", vest: "#195f5a", skin: "#e1a471", flush: "#bd6c51", hair: "#422c20", shorts: "#45483b" },
  { name: "ocre", cap: "#d4962f", seam: "#93601e", vest: "#886032", skin: "#efba87", flush: "#d58b63", hair: "#715034", shorts: "#584e36" },
] as const;

type Palette = typeof KORRIGAN_PALETTES[number];
const CREAM = "#ffebc5", BRASS = "#eab95b", WOOD = "#a06332", WOOD_DARK = "#6a3d27";
export const KORRIGAN_THIGH = .277, KORRIGAN_SHIN = .249, KORRIGAN_SOLE = .103;
export const KORRIGAN_HIP_X = .105, KORRIGAN_HIP_Y = .585;

function part(art: Assembly, name: string, parent: THREE.Object3D, material: THREE.MeshStandardMaterial) {
  const mesh = art.finish(name, parent, material);
  mesh.castShadow = false;
  return mesh;
}

function ears(art: Assembly, palette: Palette, side: number) {
  const shape = new THREE.SphereGeometry(1, 12, 8), vertices = shape.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), tip = (x + 1) * .5;
    vertices.setXYZ(i, x * .117, vertices.getY(i) * (.069 - .033 * tip) + .047 * tip, vertices.getZ(i) * (.058 - .022 * tip) - .038 * tip);
  }
  shape.computeVertexNormals();
  if (side < 0) shape.rotateY(Math.PI);
  art.add(shape, palette.skin, [side * .269, .766, .01]);
  const innerEar = new THREE.SphereGeometry(1, 10, 6).scale(.079, .026, .013).rotateZ(side * .22);
  art.add(innerEar, palette.flush, [side * .285, .785, .048]);
}

export function createKorriganModel(palette: Palette, material: THREE.MeshStandardMaterial) {
  const object = new THREE.Group();
  object.name = `korrigan-${palette.name}`;
  const upper = new THREE.Group(); object.add(upper);
  const cap = new THREE.Group(); cap.position.set(0, .943, -.035); upper.add(cap);
  const art = new Assembly();
  art.ball([0, .241, -.005], .245, palette.vest, [1, 1.16, .69]);
  art.ball([0, .067, .001], .22, palette.vest, [1.07, .50, .81]);
  art.ball([0, .375, .119], .128, CREAM, [.49, .91, .38]);
  art.sweep([[0, .083, .167], [0, .206, .166], [0, .335, .156], [0, .453, .116]], [.009, .011, .013, .023], CREAM, 7);
  for (const y of [.145, .249, .342]) {
    art.rod([-.052, y, .173], [.052, y + .006, .177], .011, BRASS);
    for (const side of [-1, 1]) art.ball([side * .065, y, .169], .026, BRASS, [1, 1, .57]);
  }
  art.ball([0, .497, 0], .101, palette.skin, [1, 1.35, 1]);
  art.ball([0, .746, -.052], .277, palette.hair, [1.04, 1.03, .91]);
  art.ball([0, .734, .004], .266, palette.skin, [1.04, .98, .92]);
  art.ball([0, .61, .104], .166, palette.skin, [1.16, .79, .94]);
  for (const side of [-1, 1]) {
    ears(art, palette, side);
    art.ball([side * .151, .724, .177], .105, palette.skin, [1, .82, .61]);
    art.ball([side * .164, .719, .229], .042, palette.flush, [1.06, .62, .23]);
    for (let dot = 0; dot < 3; dot++) {
      art.ball([side * (.137 + dot * .021), .746 - Math.abs(dot - 1) * .012, .239 - dot * .007], .006, "#aa6346");
    }
    art.ball([side * .100, .814, .220], .055, "#493225", [1.17, .86, .35]);
    art.ball([side * .100, .815, .233], .051, "#fff0cf", [1.13, .85, .37]);
    art.ball([side * .100 - .012, .812, .250], .031, "#714030", [.80, 1, .40]);
    art.ball([side * .100 - .014, .811, .262], .018, "#2a211b", [.82, 1, .38]);
    art.ball([side * .100 - .020, .826, .267], .008, "#fff6dc", [1, 1, .57]);
    art.sweep([[side * .044, .868, .229], [side * .103, .886, .228], [side * .17, .871, .183]], [.017, .022, .015], palette.hair, 7);
    art.sweep([[side * .179, .901, .156], [side * .230, .850, .128], [side * .242, .759, .118], [side * .226, .697, .148]], [.047, .039, .031, .009], palette.hair, 8);
    for (let curl = 0; curl < 3; curl++) {
      const x = side * (.092 + curl * .062);
      art.sweep([[x, .956 - curl * .010, -.10], [x, .806, -.214], [x, .653 + curl * .013, -.202], [x + side * .027, .624 + curl * .014, -.181]],
        [.062, .070, .045, .009], palette.hair, 8);
    }
  }
  art.ball([0, .759, .257], .069, palette.skin, [.95, .84, .87]);
  art.ball([-.013, .764, .289], .037, palette.flush, [1.15, .85, .69]);
  art.sweep([[-.078, .662, .247], [-.037, .642, .265], [.018, .642, .270], [.063, .659, .252]], [.009, .010, .010, .006], "#84452f", 7);
  art.sweep([[-.15, .954, .146], [-.072, .916, .203], [.022, .961, .176]], [.038, .043, .009], palette.hair, 8);
  art.sweep([[.015, .959, .175], [.112, .929, .186], [.193, .950, .143], [.216, .994, .145]], [.036, .041, .031, .008], palette.hair, 8);

  // The head, hands and transverse flute share a transform at the player's lips.
  const fluteY = (x: number) => .646 + x * .12;
  const fluteZ = (x: number) => .290 - x * .19;
  const flutePoint = (x: number, lift = 0): CharacterPoint => [x, fluteY(x) + lift, fluteZ(x)];
  art.rod(flutePoint(-.568), flutePoint(.245), .029, WOOD, .027);
  art.rod(flutePoint(-.573), flutePoint(-.535), .033, "#ba7c42");
  art.rod(flutePoint(.225), flutePoint(.252), .032, "#b8763c");
  art.rod(flutePoint(-.579), flutePoint(-.572), .021, "#47291b");
  for (const x of [-.491, -.420, -.345, -.268, -.190, -.124, .025]) {
    art.ball(flutePoint(x, .027), .014, "#57331e", [1, .28, .82]);
  }
  for (const [shoulder, elbow, grip] of [
    [[-.200, .390, -.006], [-.341, .260, .143], -.393],
    [[.202, .375, -.014], [.215, .260, .236], -.124],
  ] as const) {
    const [x, y, z] = flutePoint(grip), wrist: CharacterPoint = [x + .044, y - .092, z + .053];
    art.ball([...shoulder], .100, CREAM, [1, 1.08, 1]);
    art.sweep([[...shoulder], [...elbow], wrist], [.102, .088, .056], CREAM, 10);
    art.ball(wrist, .058, "#f4d4a1", [1.09, .67, 1.04]);
    art.ball([x + .022, y - .046, z + .028], .065, palette.skin, [1.02, 1, .68]);
    for (let finger = 0; finger < 4; finger++) {
      const fx = x + (finger - 1.4) * .023;
      art.sweep([[fx + .019, y - .029, z + .054], [fx, y + .028, z + .035], [fx - .014, y + .032, z - .005]],
        [.015, .014, .011], palette.skin, 6);
    }
    art.ball([x + .056, y - .024, z - .023], .024, palette.skin, [.83, 1.25, .78]);
  }
  part(art, `${object.name}-upper`, upper, material);

  const hat = new Assembly();
  const rim = new THREE.TorusGeometry(.254, .035, 8, 24).rotateX(Math.PI / 2).scale(1.09, 1, .96);
  rim.rotateZ(-.09);
  hat.add(rim, palette.seam, [0, .006, 0]);
  hat.sweep([[0, .010, 0], [-.022, .116, -.010], [-.104, .211, -.043], [-.253, .224, -.089], [-.383, .152, -.127], [-.461, .055, -.139]],
    [.263, .244, .189, .132, .079, .027], palette.cap, 20);
  hat.ball([-.465, .048, -.140], .034, palette.cap, [1.09, .87, 1]);
  const stitching = new THREE.TorusGeometry(.252, .009, 5, 24).rotateX(Math.PI / 2).scale(1.08, 1, .96);
  stitching.rotateZ(-.09);
  hat.add(stitching, palette.cap, [0, .025, 0]);
  part(hat, `${object.name}-bonnet`, cap, material);

  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(), knee = new THREE.Group(), ankle = new THREE.Group();
    hip.position.set(side * KORRIGAN_HIP_X, KORRIGAN_HIP_Y, 0);
    knee.position.y = -KORRIGAN_THIGH; ankle.position.y = -KORRIGAN_SHIN;
    hip.add(knee); knee.add(ankle); object.add(hip);
    ankle.name = `${object.name}-ankle-${side}`;
    const thigh = new Assembly();
    thigh.ball([0, -.086, 0], .112, palette.shorts, [1, 1.45, 1.12]);
    thigh.rod([0, -.105, 0], [0, -.266, 0], .105, palette.shorts, .092);
    part(thigh, `${object.name}-thigh-${side}`, hip, material);
    const shin = new Assembly();
    shin.ball([0, -.102, 0], .063, palette.skin, [1, 1.76, 1]);
    shin.rod([0, -.080, 0], [0, -.246, 0], .058, palette.skin, .044);
    shin.ball([0, -.019, 0], .094, palette.shorts, [1, .66, 1.08]);
    shin.rod([0, -.052, 0], [0, -.071, 0], .087, palette.shorts, .082);
    part(shin, `${object.name}-shin-${side}`, knee, material);
    const shoe = new Assembly();
    shoe.ball([0, -.083, .050], .091, WOOD_DARK, [1.03, .22, 1.98]);
    shoe.ball([0, -.044, .055], .094, "#93512e", [1, .57, 1.68]);
    shoe.ball([0, -.024, .115], .087, "#a86238", [1.03, .67, 1.15]);
    shoe.rod([0, -.045, -.050], [0, .018, -.043], .074, "#804426", .062);
    part(shoe, `${object.name}-sabot-${side}`, ankle, material);
    return { hip, knee, ankle };
  });
  return { object, upper, cap, legs };
}
