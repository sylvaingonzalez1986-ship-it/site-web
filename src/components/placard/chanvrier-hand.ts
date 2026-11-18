import * as THREE from "three";
import { Assembly, type CharacterPoint } from "./world/village-character-art";

type HandPose = "relaxed" | "pinch" | "grip";
type Side = -1 | 1;

function palm() {
  const profile = [[0, -.052], [.023, -.049], [.042, -.036], [.047, -.010], [.043, .017],
    [.033, .041], [.030, .058], [.030, .075], [0, .079]];
  return new THREE.LatheGeometry(profile.map(([width, y]) => new THREE.Vector2(width, y)), 14).scale(1, 1, .70);
}

function roundedDigit(art: Assembly, skin: string, points: CharacterPoint[], radius: number) {
  const weights = points.map((_, i) => i === 0 ? .83 : i === points.length - 1 ? .09 : i === points.length - 2 ? .72 : 1);
  art.sweep(points, weights.map(weight => radius * weight), skin, 7);
}

function handArt(side: Side, skin: string, pose: HandPose) {
  const art = new Assembly();
  const nail = `#${new THREE.Color(skin).lerp(new THREE.Color("#efbca8"), .23).getHexString()}`;
  if (pose === "grip") {
    art.add(palm().rotateZ(-side * Math.PI / 2), skin, [side * .017, 0, -.028]);
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
  art.add(palm(), skin, [0, pinching ? .017 : 0, -.010]);
  for (let digit = 0; digit < 4; digit++) {
    const index = side > 0 ? digit : 3 - digit;
    const x = side * (-.033 + digit * .024);
    const length = [.045, .054, .050, .038][digit], radius = [.0125, .0125, .0115, .010][digit];
    if (pinching) {
      roundedDigit(art, skin, [[x, -.011, -.002], [x, -.032, .004], [x, -.041, .023],
        [x * .98, -.030, .039], [x * .91, -.014, .034]], radius);
    } else {
      const spread = x + (index - 1.5) * .004;
      roundedDigit(art, skin, [[x, -.024, -.007], [x * 1.12, -.041, -.008],
        [spread, -.031 - length * .71, .000], [spread, -.034 - length * .91, .013],
        [spread, -.036 - length, .021]], radius);
      art.ball([spread, -.032 - length * .87, .005], radius, nail, [.64, .59, .21]);
    }
  }
  if (pinching) {
    roundedDigit(art, skin, [[-side * .027, .012, -.006], [-side * .050, -.002, .013],
      [-side * .048, -.015, .033], [-side * .031, -.023, .048], [-side * .021, -.022, .043]], .014);
  } else {
    roundedDigit(art, skin, [[-side * .025, .020, .000], [-side * .048, .001, .013],
      [-side * .055, -.021, .026], [-side * .051, -.039, .037], [-side * .047, -.047, .041]], .015);
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
