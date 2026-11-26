import * as THREE from "three";
import { recomputeLatheNormals } from "./chanvrier-geometry";
import { Assembly, type CharacterPoint } from "./world/village-character-art";

type HandPose = "relaxed" | "pinch" | "grip";
type Side = -1 | 1;

function palm(side: Side) {
  const rings = [[0, -.058], [.025, -.052], [.043, -.037], [.047, -.012], [.041, .019],
    [.032, .043], [.030, .060], [.030, .074], [0, .080]];
  const profile = new THREE.CatmullRomCurve3(rings.map(([width, y]) => new THREE.Vector3(width, y, 0)));
  const geometry = new THREE.LatheGeometry(profile.getPoints(20).map(point => new THREE.Vector2(Math.max(0, point.x), point.y)), 16).scale(1, 1, .63);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const thenar = THREE.MathUtils.smoothstep(-side * x, -.004, .036) * Math.exp(-(((y - .009) / .039) ** 2));
    const knuckle = Math.exp(-(((y + .045) / .017) ** 2));
    position.setX(i, x - side * .0055 * thenar);
    position.setZ(i, z + .009 * thenar + .0042 * knuckle);
  }
  recomputeLatheNormals(geometry);
  return geometry;
}

function roundedDigit(art: Assembly, skin: string, points: CharacterPoint[], radius: number) {
  const weights = points.map((_, i) => i === 0 ? .83 : i === points.length - 1 ? .09 : i === points.length - 2 ? .72 : 1);
  art.sweep(points, weights.map(weight => radius * weight), skin, 7);
}

function handArt(side: Side, skin: string, pose: HandPose) {
  const art = new Assembly();
  if (pose === "grip") {
    art.add(palm(side).rotateZ(-side * Math.PI / 2), skin, [side * .017, 0, -.028]);
    for (let digit = 0; digit < 4; digit++) {
      const y = .036 - digit * .024, radius = [.0124, .0127, .0119, .010][digit];
      const width = 1 - digit * .039;
      roundedDigit(art, skin, [[side * .021, y, -.034], [-side * .012 * width, y, -.035],
        [-side * .033 * width, y, -.013], [-side * .027 * width, y, .014],
        [-side * .009, y - .002, .024], [side * .006, y - .003, .021]], radius);
    }
    roundedDigit(art, skin, [[side * .039, .029, -.030], [side * .035, .047, -.009],
      [side * .022, .049, .013], [side * .004, .037, .025], [-side * .006, .036, .021]], .014);
    return art;
  }

  const pinching = pose === "pinch";
  art.add(palm(side), skin, [0, pinching ? .017 : 0, -.010]);
  for (let digit = 0; digit < 4; digit++) {
    const x = side * (-.033 + digit * .024);
    const length = [.044, .050, .044, .032][digit], radius = [.0140, .0136, .0125, .0107][digit];
    if (pinching) {
      roundedDigit(art, skin, [[x, -.011, -.002], [x, -.032, .004], [x, -.041, .023],
        [x * .98, -.030, .039], [x * .91, -.014, .034]], radius);
    } else {
      const spread = x + side * (digit - 1.5) * .0031;
      const curl = .020 + digit * .0034;
      roundedDigit(art, skin, [[x * .90, -.026, -.011], [x * 1.07, -.044, -.009],
        [spread, -.037 - length * .56, .002], [spread - side * .003, -.042 - length * .83, curl * .62],
        [spread - side * .007, -.045 - length * .88, curl]], radius);
    }
  }
  if (pinching) {
    roundedDigit(art, skin, [[-side * .027, .012, -.006], [-side * .050, -.002, .013],
      [-side * .048, -.015, .033], [-side * .031, -.023, .048], [-side * .021, -.022, .043]], .014);
  } else {
    roundedDigit(art, skin, [[-side * .023, .017, .003], [-side * .045, -.002, .013],
      [-side * .056, -.018, .022], [-side * .057, -.034, .032], [-side * .050, -.045, .040]], .017);
  }
  return art;
}

export function createChanvrierHand(parent: THREE.Group, material: THREE.Material, side: Side) {
  const frame = new THREE.Group();
  frame.name = `chanvrier-palm-${side}`;
  parent.add(frame);
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
  const wrist = new THREE.Vector3(), basis = new THREE.Matrix4();
  const shapes: Partial<Record<HandPose, THREE.Mesh>> = {};
  let active: THREE.Mesh | undefined;
  let skin = "#edbd89";

  function update(color: string) {
    if (skin === color) return;
    skin = color;
    for (const kind of ["relaxed", "pinch", "grip"] as const) {
      const mesh = shapes[kind];
      if (!mesh) continue;
      mesh.removeFromParent();
      mesh.geometry.dispose();
      delete shapes[kind];
    }
    active = undefined;
  }

  function pose(kind: HandPose, contact: THREE.Vector3, elbow: THREE.Vector3, gripAxis: THREE.Vector3, gripScale = 1) {
    let mesh = shapes[kind];
    if (!mesh) {
      mesh = handArt(side, skin, kind).finish(`chanvrier-fingers-${kind}`, frame, material);
      mesh.castShadow = false;
      shapes[kind] = mesh;
    }
    if (active !== mesh) {
      if (active) active.visible = false;
      mesh.visible = true;
      active = mesh;
    }
    const gripping = kind === "grip";
    frame.position.copy(contact);
    frame.scale.setScalar(gripScale);
    if (gripping) {
      y.copy(gripAxis).normalize();
      x.subVectors(elbow, contact).multiplyScalar(side);
    } else {
      y.subVectors(elbow, contact).normalize();
      x.set(1, 0, 0);
    }
    x.addScaledVector(y, -x.dot(y));
    if (x.lengthSq() < 1e-6) {
      x.set(Math.abs(y.x) < .8 ? 1 : 0, Math.abs(y.x) < .8 ? 0 : 1, 0);
      x.addScaledVector(y, -x.dot(y));
    }
    x.normalize();
    z.crossVectors(x, y);
    frame.quaternion.setFromRotationMatrix(basis.makeBasis(x, y, z));
    if (!gripping) frame.rotateY(-side * (kind === "pinch" ? .19 : .37));
    if (gripping) wrist.set(side * .081, 0, -.028);
    else wrist.set(0, kind === "pinch" ? .077 : .062, -.01);
    return wrist.multiplyScalar(gripScale).applyQuaternion(frame.quaternion).add(contact);
  }

  return { update, pose };
}
