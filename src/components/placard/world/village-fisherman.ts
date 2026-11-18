import * as THREE from "three";
import { paintingToGround } from "./village-layout";
import { sampleVillageWaves } from "./village-marine";
import type { VillageNpcPose, VillageNpcRig } from "./village-npc-types";
import {
  Assembly, CHARACTER_COLORS as C, characterDisposer, characterEase, characterMaterial,
  createCharacterFace, createCharacterLimbs, noCharacterHit,
} from "./village-character-art";

const [x, z] = paintingToGround(1560, 1090);
/** Outer bank of the small island, clear of the bridge landing and its path. */
export const VILLAGE_FISHERMAN_POSITION: [number, number, number] = [x, 0.04, z];
export const VILLAGE_FISHERMAN_YAW = 1.1;

/** Seated Breton, supported rod and contact-driven wine routine; no private clock. */
export function createVillageFisherman(): VillageNpcRig {
  const object = new THREE.Group(); object.name = "village-fisherman";
  object.position.set(...VILLAGE_FISHERMAN_POSITION); object.rotation.y = VILLAGE_FISHERMAN_YAW;
  object.userData = { decorative: true, state: "fishing", fishingPhase: "wait" };
  const material = characterMaterial();
  const equipment = new Assembly();
  // Low folding stool and stable crate: both remain on the bank during attention.
  equipment.box([0, 0.51, -0.025], [0.54, 0.075, 0.43], C.wood);
  for (const side of [-1, 1]) {
    equipment.rod([side * 0.23, 0.49, -0.17], [side * 0.26, 0.025, 0.2], 0.027, C.dark);
    equipment.rod([side * 0.23, 0.49, 0.17], [side * 0.26, 0.025, -0.2], 0.027, C.dark);
    equipment.ball([side * 0.245, 0.26, 0], 0.034, C.gold);
  }
  equipment.box([0.53, 0.14, 0.02], [0.37, 0.28, 0.34], C.wood);
  for (const y of [0.065, 0.15, 0.235]) equipment.box([0.53, y, 0.195], [0.38, 0.013, 0.008], "#825d3c");
  equipment.rod([-0.15, 0.02, 0.93], [-0.15, 0.84, 0.93], 0.026, C.wood);
  equipment.rod([-0.15, 0.78, 0.93], [-0.215, 0.88, 0.93], 0.018, C.wood);
  equipment.rod([-0.15, 0.78, 0.93], [-0.085, 0.88, 0.93], 0.018, C.wood);
  equipment.finish("fisherman-stool-crate-rod-rest", object, material);

  const legs = new Assembly();
  for (const side of [-1, 1]) {
    legs.rod([side * 0.145, 0.6, -0.005], [side * 0.2, 0.43, 0.39], 0.11, C.dark, 0.13);
    legs.ball([side * 0.2, 0.43, 0.39], 0.113, C.dark);
    legs.rod([side * 0.2, 0.43, 0.39], [side * 0.21, 0.13, 0.43], 0.088, C.dark, 0.108);
    legs.ball([side * 0.21, 0.085, 0.5], 0.14, C.ink, [0.88, 0.6, 1.35]);
    legs.box([side * 0.21, 0.04, 0.51], [0.23, 0.035, 0.3], C.wood);
  }
  legs.finish("fisherman-seated-trousers-boots", object, material);
  const torso = new THREE.Group(); torso.name = "fisherman-torso"; torso.position.y = 0.56; object.add(torso);
  const shirt = new Assembly();
  // The stripes are cloth bands on one continuous volume, not bars laid in
  // front of a sphere. Shared latitude boundaries prevent gaps and shimmer.
  const shirtRadii = [0.29 * 1.08, 0.29 * 1.09, 0.29 * 0.79] as const;
  const levels = [-1, -0.78, -0.5, -0.38, -0.26, -0.14, -0.02, 0.1, 0.22, 0.34, 0.46, 0.65, 0.84, 1];
  for (let index = 0; index < levels.length - 1; index++) {
    const theta = Math.acos(levels[index + 1]);
    const band = new THREE.SphereGeometry(1, 20, 2, 0, Math.PI * 2, theta, Math.acos(levels[index]) - theta);
    band.scale(...shirtRadii);
    shirt.add(band, index >= 3 && index <= 9 && index % 2 === 1 ? C.cream : C.ink, [0, 0.25, -0.025]);
  }
  shirt.ball([0, 0.035, 0], 0.25, C.dark, [1.05, 0.5, 0.8]);
  for (const side of [-1, 1]) {
    shirt.ball([side * 0.26, 0.42, -0.015], 0.105, C.ink);
    const strapPoint = (t: number): [number, number, number] => {
      const x = side * (0.15 + t * 0.03), y = 0.49 - t * 0.4;
      return [x, y, -0.025 + shirtRadii[2] * Math.sqrt(Math.max(0, 1 - (x / shirtRadii[0]) ** 2 - ((y - 0.25) / shirtRadii[1]) ** 2)) + 0.012];
    };
    for (let segment = 0; segment < 7; segment++) shirt.rod(strapPoint(segment / 7), strapPoint((segment + 1) / 7), 0.018, C.gold);
    shirt.ball(strapPoint(0.76), 0.025, C.wood, [1, 1.1, 0.4]);
  }
  shirt.rod([0, 0.49, 0], [0, 0.68, 0], 0.091, C.skin);
  shirt.finish("fisherman-striped-knit-and-braces", torso, material);
  const face = createCharacterFace(torso, material, "fisherman", "#b6ad91"); face.head.position.set(0, 0.63, 0);
  const hat = new Assembly();
  hat.ball([0, 0.41, -0.045], 0.285, C.teal, [1.07, 0.48, 1.05]);
  hat.ball([0, 0.366, 0.115], 0.236, C.dark, [1.16, 0.105, 1.14]);
  hat.ball([0, 0.39, 0.197], 0.034, C.gold, [1, 0.8, 0.4]);
  for (const side of [-1, 1]) hat.ball([side * 0.048, 0.108, 0.213], 0.053, "#d3c7a8", [1.2, 0.42, 0.34]);
  hat.finish("fisherman-cap-and-silver-moustache", face.head, material);
  const sleeves = createCharacterLimbs(torso, 4, C.ink, "fisherman-sleeve");
  const hands = [-1, 1].map(side => {
    const art = new Assembly();
    if (side === 1) {
      // The pivot follows the bottle axis, while the palm and curled fingers
      // wrap its surface. A visible grip must not disappear inside the glass.
      art.ball([0.061, 0, -0.005], 0.057, C.skin, [0.65, 0.96, 0.8]);
      art.sweep([[0.068, 0.031, 0], [0.045, 0.052, -0.037], [0.005, 0.044, -0.05]], [0.019, 0.021, 0.012], C.skin);
      for (const y of [-0.027, 0, 0.027]) art.sweep([[0.067, y, 0.022], [0.045, y, 0.057], [0.005, y, 0.065], [-0.027, y - 0.005, 0.044]], [0.014, 0.015, 0.014, 0.01], C.skin);
    } else {
      art.ball([0, 0, 0], 0.064, C.skin, [0.93, 0.92, 0.8]);
      art.ball([side * 0.039, 0.025, 0.015], 0.027, C.skin);
      for (let i = 0; i < 3; i++) art.ball([-0.02 + i * 0.02, -0.025, 0.035], 0.018, C.skin);
    }
    return art.finish(`fisherman-hand-${side}`, torso, material);
  });

  const rod = new Assembly();
  rod.rod([-0.21, 0.71, 0.38], [-0.1, 1.3, 2.95], 0.014, C.wood, 0.006);
  rod.rod([-0.21, 0.71, 0.38], [-0.196, 0.786, 0.71], 0.028, C.dark);
  rod.ball([-0.237, 0.735, 0.57], 0.052, C.gold, [0.45, 1, 1]);
  rod.rod([-0.258, 0.73, 0.57], [-0.29, 0.73, 0.57], 0.012, C.ink);
  rod.finish("fisherman-supported-fishing-rod", object, material);
  const floatArt = new Assembly();
  floatArt.ball([0, 0, 0], 0.051, C.cream, [0.75, 1.1, 0.75]);
  floatArt.ball([0, 0.035, 0], 0.042, "#b94b3b", [0.75, 0.85, 0.75]);
  floatArt.rod([0, 0.04, 0], [0, 0.12, 0], 0.008, C.ink);
  const float = floatArt.finish("fisherman-water-float", object, material); float.position.set(-0.09, -0.35, 3.28);
  const lineGeometry = new THREE.BufferGeometry();
  const linePositions = new Float32Array([-0.1, 1.3, 2.95, -0.095, 0.4, 3.12, -0.09, -0.25, 3.28]);
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-0.1, 0.6, 3.1), 1.2);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: C.cream, transparent: true, opacity: 0.88 }));
  line.name = "fisherman-fishing-line"; line.raycast = noCharacterHit; object.add(line);

  // The bottle pivot is its lip. This keeps the full sip attached to the animated mouth.
  const bottle = new THREE.Group(); bottle.name = "fisherman-wine-bottle"; torso.add(bottle);
  const wine = new Assembly();
  wine.add(new THREE.CylinderGeometry(0.055, 0.06, 0.23, 12), "#334b35", [0, -0.25, 0]);
  wine.ball([0, -0.13, 0], 0.056, "#334b35", [1, 0.65, 1]);
  wine.rod([0, -0.14, 0], [0, -0.015, 0], 0.024, "#334b35");
  wine.add(new THREE.CylinderGeometry(0.029, 0.028, 0.035, 12), C.wine, [0, -0.018, 0]);
  wine.add(new THREE.CylinderGeometry(0.057, 0.059, 0.09, 12), C.cream, [0, -0.245, 0]);
  wine.ball([0, -0.245, 0.06], 0.027, C.wine, [0.7, 1.1, 0.13]);
  wine.finish("fisherman-red-wine-labelled-glass", bottle, material);

  const resources = characterDisposer(object);
  const rest = new THREE.Vector3(), lip = new THREE.Vector3(), grip = new THREE.Vector3(), leftGrip = new THREE.Vector3();
  const worldFloat = new THREE.Vector3(), wrist = new THREE.Vector3(), inverseBust = new THREE.Quaternion();
  // Present the bottle in profile, clear of the forearm, with its lip fixed.
  const sipRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.82, 0, 0.26))
    .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.75));
  const identity = new THREE.Quaternion();
  let lift = 0, gripAmount = 0;
  function animate(time: number, delta: number, reduced: boolean, pose?: VillageNpcPose) {
    const t = reduced ? 0 : time, ease = characterEase(delta, reduced);
    const phase = pose?.fishingPhase ?? "wait", progress = THREE.MathUtils.clamp(pose?.phaseProgress ?? 0, 0, 1);
    const attention = pose?.attention ?? 0, smooth = THREE.MathUtils.smoothstep(progress, 0, 1);
    const targetLift = (phase === "sip" ? THREE.MathUtils.smoothstep(progress, 0, 0.36) : phase === "replace" ? 1 - smooth : 0) * (1 - attention);
    const liftStep = reduced ? 1 : Math.min(0.1, Math.max(0, delta)) * 0.85;
    lift += THREE.MathUtils.clamp((targetLift - lift) * ease, -liftStep, liftStep);
    const targetGrip = phase === "reach" ? smooth : phase === "sip" ? 1 : phase === "replace" ? 1 - THREE.MathUtils.smoothstep(progress, 0.75, 1) : 0;
    gripAmount += (Math.max(targetGrip, lift > 0.01 ? 1 : 0) - gripAmount) * ease;
    const yaw = THREE.MathUtils.clamp(pose?.lookYaw ?? 0, -0.85, 0.85);
    torso.rotation.y += (yaw * 0.18 * attention - torso.rotation.y) * ease;
    inverseBust.copy(torso.quaternion).invert();
    face.head.rotation.y += ((attention ? yaw * 0.82 : phase === "watch" ? -0.11 : -0.04) - face.head.rotation.y) * ease;
    const adjustment = phase === "adjust" && !reduced ? Math.sin(progress * Math.PI) ** 2 * (1 - attention) : 0;
    const tilt = (pose?.lookPitch ?? 0) * attention - lift * 0.13 + (phase === "watch" && !attention ? 0.085 : 0) + adjustment * 0.13;
    face.head.rotation.x += (tilt + Math.sin(t * 1.4) * 0.012 - face.head.rotation.x) * ease;
    face.head.rotation.z = Math.sin(t * 0.8) * 0.018 + attention * (pose?.emphasis ?? 0) * 0.025;
    face.setExpression(t, reduced, attention, yaw, (0.08 + attention * (0.16 + (pose?.emphasis ?? 0) * 0.3)) * (1 - lift * 0.95), attention * 0.45);
    rest.set(0.53, 0.085, 0.02).applyQuaternion(inverseBust);
    lip.set(0, 0.078, 0.218).applyEuler(face.head.rotation).add(face.head.position);
    bottle.position.copy(rest).lerp(lip, lift);
    // Carry the bottle around the chest; the lip and crate endpoints stay exact.
    bottle.position.x += Math.sin(lift * Math.PI) * 0.13;
    bottle.position.z += Math.sin(lift * Math.PI) * 0.11;
    bottle.quaternion.copy(identity).slerp(sipRotation, lift);
    grip.set(0, -0.205, 0).applyQuaternion(bottle.quaternion).add(bottle.position);
    // The idle hand rests on the thigh, then wraps the same point on the bottle.
    hands[1].position.set(0.245, 0.04, 0.305).lerp(grip, gripAmount);
    hands[1].quaternion.copy(bottle.quaternion);
    wrist.set(0.085, 0.02, -0.005).applyQuaternion(hands[1].quaternion).add(hands[1].position);
    const ex = 0.41 - lift * 0.25, ey = 0.18 + lift * 0.31, ez = 0.08 + lift * 0.19;
    sleeves.set(2, 0.26, 0.42, -0.015, ex, ey, ez, 0.09);
    sleeves.set(3, ex, ey, ez, wrist.x, wrist.y, wrist.z, 0.071);
    // Convert the supported rod's contact back into bust space as shoulders turn.
    leftGrip.set(-0.196 - adjustment * 0.094, 0.225 - adjustment * 0.055, 0.71 - adjustment * 0.14).applyQuaternion(inverseBust);
    hands[0].position.copy(leftGrip);
    hands[0].rotation.x = Math.sin(t * 4.5) * adjustment * 0.22;
    sleeves.set(0, -0.26, 0.42, -0.015, -0.36, 0.19, 0.24, 0.092);
    sleeves.set(1, -0.36, 0.19, 0.24, leftGrip.x, leftGrip.y, leftGrip.z, 0.073);
    // Sample the exact sea shader at the float's world location, including the shared clock.
    object.updateWorldMatrix(true, false);
    worldFloat.set(-0.09, 0, 3.28).applyMatrix4(object.matrixWorld);
    const wave = sampleVillageWaves(worldFloat.x, worldFloat.z, t);
    float.position.y = wave.height - object.position.y;
    float.rotation.set(wave.dz, 0, -wave.dx);
    linePositions[4] = 0.5 + float.position.y * 0.3; linePositions[7] = float.position.y + 0.09;
    lineGeometry.getAttribute("position").needsUpdate = true;
    object.userData.state = pose?.activity ?? "fishing";
    object.userData.fishingPhase = phase; object.userData.bottleLift = lift;
  }
  animate(0, 0, true);
  return {
    object,
    update(frame, pose) {
      if (resources.disposed || !frame.visible(object, 4.1)) return;
      animate(frame.time, frame.delta, frame.reduced, pose);
    },
    dispose: resources.dispose,
  };
}
