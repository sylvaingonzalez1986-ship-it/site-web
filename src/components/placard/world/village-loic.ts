import * as THREE from "three";
import { paintingToGround } from "./village-layout";
import type { VillageNpcPose, VillageNpcRig } from "./village-npc-types";
import { createVillageCharacterGait } from "./village-character-gait";
import {
  Assembly, CHARACTER_COLORS as C, characterDisposer, characterEase, characterMaterial,
  createCharacterFace, createCharacterLimbs,
} from "./village-character-art";

const [x, z] = paintingToGround(620, 580);
export const VILLAGE_LOIC_POSITION: [number, number, number] = [x, 0.04, z];

/** Loïc's existing illustrated guide: two-tone cap, black brim, tan knit and teal trousers. */
export function createVillageLoic(): VillageNpcRig {
  const object = new THREE.Group(); object.name = "village-loic"; object.position.set(...VILLAGE_LOIC_POSITION);
  object.userData = { decorative: true, guide: true, reference: "/placard/tutorial/sylvain-culture-v1.webp" };
  const material = characterMaterial();
  const torso = new THREE.Group(); torso.name = "loic-torso"; object.add(torso);
  const body = new Assembly();
  body.ball([0, 0.985, 0], 0.29, C.tan, [0.96, 1.13, 0.7]);
  body.ball([0, 0.69, 0], 0.23, C.teal, [1.02, 0.43, 0.79]);
  body.rod([0, 1.2, 0], [0, 1.33, 0], 0.083, C.skin);
  body.add(new THREE.CylinderGeometry(0.095, 0.12, 0.065, 16), C.tan, [0, 1.255, 0]);
  body.add(new THREE.CylinderGeometry(0.224, 0.22, 0.065, 20).scale(1, 1, 0.76), C.tan, [0, 0.755, 0.005]);
  for (const side of [-1, 1]) {
    body.ball([side * 0.235, 1.115, 0], 0.104, C.tan);
    body.rod([side * 0.17, 0.85, 0.152], [side * 0.185, 0.92, 0.166], 0.007, "#b58256");
  }
  // A modest pin, legible as a guide's question mark without floating UI artwork.
  body.ball([0.135, 1.035, 0.192], 0.046, C.teal, [1, 1, 0.24]);
  body.rod([0.124, 1.052, 0.208], [0.146, 1.052, 0.208], 0.006, C.cream);
  body.rod([0.146, 1.052, 0.208], [0.138, 1.035, 0.208], 0.006, C.cream);
  body.ball([0.137, 1.017, 0.21], 0.0065, C.gold);
  body.finish("loic-sweater-and-guide-pin", torso, material);

  const face = createCharacterFace(torso, material, "loic", "#202b2a");
  face.head.position.y = 1.275;
  const cap = new Assembly();
  // Complete complementary dome panels; no coplanar coloured overlays.
  cap.add(new THREE.SphereGeometry(0.256, 16, 8, Math.PI / 2, Math.PI, 0, Math.PI / 2), C.teal, [0, 0.37, -0.018]);
  cap.add(new THREE.SphereGeometry(0.256, 16, 8, -Math.PI / 2, Math.PI, 0, Math.PI / 2), C.tan, [0, 0.37, -0.018]);
  // The illustrated cap has a short upward brim. Leave the eyebrows visible
  // from the elevated views used beside the village roofs.
  cap.add(new THREE.SphereGeometry(1, 16, 8).scale(0.265, 0.019, 0.148).rotateX(-0.17), "#202b2a", [0, 0.376, 0.14]);
  cap.ball([0, 0.627, -0.018], 0.024, C.teal, [1, 0.6, 1]);
  cap.finish("loic-teal-tan-baseball-cap", face.head, material);

  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(); hip.name = `loic-leg-${side}`; hip.position.set(side * 0.125, 0.73, 0); object.add(hip);
    const upper = new Assembly(); upper.rod([0, 0, 0], [0, -0.32, 0], 0.094, C.teal, 0.115);
    upper.ball([0, -0.32, 0], 0.096, C.teal); upper.finish("loic-trouser-thigh", hip, material);
    const knee = new THREE.Group(); knee.position.y = -0.32; hip.add(knee);
    const lower = new Assembly(); lower.rod([0, 0, 0], [0, -0.32, 0], 0.081, C.teal, 0.093);
    lower.add(new THREE.CylinderGeometry(0.091, 0.088, 0.065, 12), C.teal, [0, -0.285, 0]);
    lower.finish("loic-cuffed-trouser", knee, material);
    const ankle = new THREE.Group(); ankle.name = `loic-ankle-${side}`; ankle.position.y = -0.32; knee.add(ankle);
    const shoe = new Assembly();
    shoe.ball([0, -0.035, 0.074], 0.13, C.tan, [0.84, 0.48, 1.48]);
    shoe.box([0, -0.0875, 0.079], [0.22, 0.035, 0.3], C.cream);
    for (const y of [0.01, -0.008]) shoe.rod([-0.057, y, 0.137], [0.057, y, 0.137], 0.008, C.cream);
    shoe.finish("loic-grounded-shoe", ankle, material); return { hip, knee, ankle };
  });
  const updateGait = createVillageCharacterGait({ left: legs[0], right: legs[1], upperLength: 0.32, lowerLength: 0.32, soleHeight: 0.105 });
  const sleeves = createCharacterLimbs(torso, 4, C.tan, "loic-sleeve");
  const handFingers: THREE.Mesh[] = [];
  const hands = [-1, 1].map(side => {
    const hand = new THREE.Group(); hand.name = `loic-hand-${side}`; torso.add(hand);
    const art = new Assembly(); art.ball([0, 0, 0], 0.067, C.skin, [0.86, 1.1, 0.77]);
    art.ball([-side * 0.045, 0.025, 0.024], 0.027, C.skin);
    art.finish(`loic-palm-${side}`, hand, material);
    const fingerArt = new Assembly();
    for (let finger = 0; finger < 4; finger++) {
      const x = (finger - 1.5) * 0.024, length = finger === 0 || finger === 3 ? 0.052 : 0.067;
      fingerArt.rod([x, 0, 0.012], [x * 1.2, -length, 0.021], 0.012, C.skin, 0.014);
      fingerArt.ball([x * 1.2, -length, 0.021], 0.012, C.skin);
    }
    const fingers = fingerArt.finish(`loic-fingers-${side}`, hand, material); fingers.position.y = -0.045;
    handFingers.push(fingers); return hand;
  });
  const resources = characterDisposer(object);
  let gait = 0, greeting = 0;
  function animate(time: number, delta: number, reduced: boolean, pose?: VillageNpcPose) {
    const t = reduced ? 0 : time, ease = characterEase(delta, reduced);
    gait += ((!reduced ? Math.min(1, (pose?.speed ?? 0) / 0.55) : 0) - gait) * ease;
    greeting += ((pose?.activity === "greeting" || (pose?.attention ?? 0) > 0.35 ? 1 : 0) - greeting) * ease;
    const stride = pose?.stride ?? 0;
    torso.position.y = updateGait(stride, gait) + Math.sin(t * 1.4) * 0.003;
    const yaw = THREE.MathUtils.clamp(pose?.lookYaw ?? 0, -0.95, 0.95);
    torso.rotation.y += (yaw * 0.24 - torso.rotation.y) * ease;
    face.head.rotation.y += (yaw * 0.76 - face.head.rotation.y) * ease;
    face.head.rotation.x += (THREE.MathUtils.clamp(pose?.lookPitch ?? 0, -0.25, 0.23) + Math.sin(t * 2.3) * 0.025 * greeting - face.head.rotation.x) * ease;
    face.head.rotation.z = Math.sin(t * 1.1) * 0.018 * (1 - gait);
    face.setExpression(t, reduced, pose?.attention ?? greeting, yaw, 0.14 + greeting * 0.45, greeting * 0.16);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const wave = i === 1 ? greeting : 0;
      const swing = Math.sin(stride + i * Math.PI) * 0.16 * gait;
      const hx = side * (0.278 + wave * 0.15);
      const hy = 0.72 + wave * (0.61 + Math.sin(t * 3.1) * 0.025);
      const hz = 0.035 + swing + wave * 0.1;
      const ex = side * (0.303 + wave * 0.12), ey = 0.94 + wave * 0.11, ez = -0.01 + swing * 0.45;
      sleeves.set(i * 2, side * 0.235, 1.115, 0, ex, ey, ez, 0.087);
      sleeves.set(i * 2 + 1, ex, ey, ez, hx, hy + 0.038 * (1 - 2 * wave), hz, 0.068);
      hands[i].position.set(hx, hy, hz);
      hands[i].rotation.z = side * wave * (Math.PI - 0.15 + Math.sin(t * 3.1) * 0.09);
      handFingers[i].scale.y = 0.3 + wave * 0.7;
    }
    object.userData.state = pose?.activity ?? "idle";
  }
  animate(0, 0, true);
  return {
    object,
    update(frame, pose) {
      if (resources.disposed || !frame.visible(object, 2.1)) return;
      animate(frame.time, frame.delta, frame.reduced, pose);
    },
    dispose: resources.dispose,
  };
}
