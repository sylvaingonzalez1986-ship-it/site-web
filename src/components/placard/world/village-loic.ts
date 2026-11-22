import * as THREE from "three";
import { paintingToGround } from "./village-layout";
import type { VillageGroundHeight } from "./village-character-gait";
import type { VillageNpcPose, VillageNpcRig } from "./village-npc-types";
import { addCapVisor, addVillageNeck, clothPoint, clothSectionAt, createVillageSleeve, createVillageTrousers, garmentPanel, garmentVolume, knitRib, reshapeGarment, type ClothSection } from "./village-npc-tailoring";
import {
  Assembly, CHARACTER_COLORS as C, characterDisposer, characterEase, characterMaterial,
  createCharacterFace,
} from "./village-character-art";

const [x, z] = paintingToGround(620, 580);
export const VILLAGE_LOIC_POSITION: [number, number, number] = [x, 0.04, z];

export function createVillageLoicHead(parent: THREE.Object3D, material: THREE.Material) {
  const face = createCharacterFace(parent, material, "loic", "#202b2a");
  const cap = new Assembly();
  const crown: readonly ClothSection[] = [[.369, .242, .218, -.007], [.391, .255, .230, -.009],
    [.439, .252, .230, -.010], [.491, .231, .213, -.014], [.538, .188, .181, -.019],
    [.576, .125, .127, -.022], [.596, .065, .065, -.021], [.604, 0, 0, -.021]];
  const panelStart = -.12, panelWidth = Math.PI / 3;
  const canvas = (y: number, a: number) => .006 * (1 - Math.cos((a - panelStart) * 6)) * Math.sin(Math.PI * (y - .369) / .235);
  const leanCrown = (point: THREE.Vector3) => {
    const height = THREE.MathUtils.smoothstep(point.y, .38, .602);
    point.x -= .019 * height;
    point.y += point.z * .046 * (1 - height) - .013 * height * Math.cos(point.x * 5);
  };
  const colors = ["#12716c", "#087b75", "#196863", "#bd8e60", "#c99e6f", "#d2aa79"];
  for (const [i, color] of colors.entries()) {
    const edge = panelStart + i * panelWidth;
    const panel = garmentPanel(crown, 6, () => [edge, edge + panelWidth], canvas);
    cap.add(reshapeGarment(panel, leanCrown), color);
    const seam = crown.slice(1, -1).map(row => {
      const point = new THREE.Vector3(...clothPoint(row, edge + .015, (y, a) => canvas(y, a) + .002));
      leanCrown(point);
      return point.toArray();
    });
    cap.sweep(seam, [.001, .0028, .003, .003, .0028, .001], i < 3 ? "#548c7e" : "#a57853", 5);
  }
  cap.add(reshapeGarment(garmentVolume([[.361, .235, .215, -.006], [.366, .245, .223, -.006],
    [.381, .248, .224, -.007], [.389, .245, .219, -.008]], 30), leanCrown), "#315753");
  addCapVisor(cap, .394, .241, .228, .082, "#315253", "#253938");
  cap.ball([-.019, .595, -.021], .019, "#166760", [1, .54, 1]);
  cap.finish("loic-teal-tan-baseball-cap", face.head, material);
  return face;
}

/** Loïc's existing illustrated guide: two-tone cap, black brim, tan knit and teal trousers. */
export function createVillageLoic(groundAt?: VillageGroundHeight): VillageNpcRig {
  const object = new THREE.Group(); object.name = "village-loic"; object.position.set(...VILLAGE_LOIC_POSITION);
  object.userData = { decorative: true, guide: true, reference: "/placard/tutorial/sylvain-culture-v1.webp" };
  const material = characterMaterial();
  const torso = new THREE.Group(); torso.name = "loic-torso"; object.add(torso);
  const body = new Assembly();
  body.add(garmentVolume([[.598, .082, .084], [.630, .165, .120], [.68, .207, .148], [.715, .212, .151], [.77, .183, .132]]), C.teal);
  const knit: readonly ClothSection[] = [[.700, .209, .156], [.712, .221, .166], [.762, .225, .169],
    [.790, .245, .186], [.839, .247, .186], [.915, .251, .195], [1.003, .257, .193],
    [1.087, .268, .187], [1.136, .274, .168], [1.174, .247, .150], [1.211, .184, .118],
    [1.236, .118, .096], [1.241, .088, .080]];
  const folds = (y: number, angle: number) => {
    const blousing = THREE.MathUtils.smoothstep(y, .748, .813) * (1 - THREE.MathUtils.smoothstep(y, .865, 1.012));
    return blousing * (.011 * Math.cos(angle * 5 + (y - .75) * 7) + .005 * Math.sin(angle * 9 - y * 14));
  };
  body.add(garmentVolume(knit, 32, undefined, folds), C.tan);
  body.add(garmentVolume([[.702, .22, .170], [.711, .228, .175], [.748, .232, .176], [.761, .225, .173]], 24), "#ab7753");
  knitRib(body, .715, .230, .177, .033, "#c19365");
  addVillageNeck(body, 1.201, .146, .076);
  body.add(garmentVolume([[1.215, .135, .104], [1.226, .138, .107], [1.248, .114, .099], [1.258, .093, .082]]), "#a87350");

  // The raglan yoke wraps across the back and joins the sleeves under the shoulder.
  const yokeRows = knit.filter(row => row[0] >= 1.087);
  const yokeEdge = (y: number) => THREE.MathUtils.lerp(1.57, .64, THREE.MathUtils.smoothstep(y, 1.087, 1.231));
  body.add(garmentPanel(yokeRows, 24, y => [yokeEdge(y), Math.PI * 2 - yokeEdge(y)], (y, a) => folds(y, a) + .004), "#be8b60");
  const pocketRows: readonly [number, number][] = [[.786, .715], [.810, .862], [.866, .875], [.911, .642], [.950, .465]];
  const pocketEdge = (y: number) => pocketRows.find(row => row[0] === y)![1];
  const pocketDrape = (y: number, a: number) => folds(y, a) + .008 + .016 * Math.cos(a * 1.24) * Math.sin((y - .778) / .185 * Math.PI);
  body.add(garmentPanel(pocketRows.map(([y]) => clothSectionAt(knit, y)), 16, y => [-pocketEdge(y), pocketEdge(y)], pocketDrape), "#bf865b");
  for (const side of [-1, 1]) {
    body.sweep(yokeRows.slice(0, 5).map(row => clothPoint(row, side * yokeEdge(row[0]), (y, a) => folds(y, a) + .005)),
      [.002, .005, .006, .004, .002], "#ab7753", 6);
    body.sweep(pocketRows.slice(2).map(([y, angle]) => clothPoint(clothSectionAt(knit, y), side * angle, (y, a) => pocketDrape(y, a) + .006)),
      [.005, .010, .003], "#966244", 7);
  }
  // A modest pin, legible as a guide's question mark without floating UI artwork.
  body.ball([0.135, 1.035, 0.192], 0.046, C.teal, [1, 1, 0.24]);
  body.rod([0.124, 1.052, 0.208], [0.146, 1.052, 0.208], 0.006, C.cream);
  body.rod([0.146, 1.052, 0.208], [0.138, 1.035, 0.208], 0.006, C.cream);
  body.ball([0.137, 1.017, 0.21], 0.0065, C.gold);
  body.finish("loic-sweater-and-guide-pin", torso, material);

  const face = createVillageLoicHead(torso, material);
  face.head.position.y = 1.275;

  const updateGait = createVillageTrousers(object, material, "loic", groundAt);
  const sleeves = [-1, 1].map(side => createVillageSleeve(torso, material, "loic-sleeve-" + side, "loic", C.tan, "#a87350"));
  const handFingers: THREE.Mesh[] = [];
  const hands = [-1, 1].map(side => {
    const hand = new THREE.Group(); hand.name = `loic-hand-${side}`; torso.add(hand);
    const art = new Assembly(); art.ball([0, 0, 0], 0.067, C.skin, [0.86, 1.1, 0.77]);
    art.sweep([[-side*.031,.025,.006],[-side*.052,.013,.024],[-side*.065,-.002,.037],[-side*.060,-.019,.044]],
      [.022,.023,.017,.005],C.skin,8);
    art.finish(`loic-palm-${side}`, hand, material);
    const fingerArt = new Assembly();
    for (let finger = 0; finger < 4; finger++) {
      const x = (finger - 1.5) * 0.024, length = finger === 0 || finger === 3 ? 0.052 : 0.067;
      fingerArt.sweep([[x*.88,.012,.008],[x,-.015,.011],[x*1.15,-length*.66,.016],[x*1.22,-length,.031]],
        [.014,.015,.012,.004],C.skin,8);
    }
    const fingers = fingerArt.finish(`loic-fingers-${side}`, hand, material); fingers.position.y = -0.045;
    handFingers.push(fingers); return hand;
  });
  const resources = characterDisposer(object);
  const wrist = new THREE.Vector3();
  let gait = 0, greeting = 0, greetingAge = 0, greetingActive = false, raisedHand = 0, wristWave = 0;
  function animate(time: number, delta: number, reduced: boolean, pose?: VillageNpcPose, detail = 1) {
    const t = reduced ? 0 : time, ease = characterEase(delta, reduced);
    gait = reduced ? 0 : pose?.walkBlend ?? gait + (Math.min(1, (pose?.speed ?? 0) / .55) - gait) * ease;
    const greets = pose?.activity === "greeting";
    if (greets && !greetingActive) greetingAge = 0;
    greetingActive = greets;
    const step = Math.min(0.05, Math.max(0, delta));
    if (greets && !reduced) greetingAge = Math.min(3.05, greetingAge + step);
    greeting += ((greets ? 1 : pose?.attention ?? 0) - greeting) * ease;
    const hello = greets
      ? THREE.MathUtils.smoothstep(greetingAge, 0.05, 0.63) * (1 - THREE.MathUtils.smoothstep(greetingAge, 2.36, 3.05))
      : 0;
    const speech = greets ? 0.12 + (pose?.emphasis ?? 0) * 0.19 : 0;
    const settled = 1 - THREE.MathUtils.smoothstep(gait, 0.05, 0.55);
    const handTarget = reduced ? Number(greets) * 0.54 : Math.max(hello, speech) * settled;
    const handStep = reduced ? 1 : step * 2.2;
    raisedHand += THREE.MathUtils.clamp((handTarget - raisedHand) * ease, -handStep, handStep);
    wristWave += ((reduced ? 0 : Math.sin((greetingAge - 0.36) * 9.3) * hello * settled) - wristWave) * ease;
    torso.position.y = updateGait(pose?.stride ?? 0, gait) + Math.sin(t * 1.4) * 0.003;
    const stride = updateGait.stride;
    torso.rotation.z = reduced ? 0 : .018 * Math.sin(stride) * gait - .043 * (pose?.turnLean ?? 0);
    const yaw = THREE.MathUtils.clamp(pose?.lookYaw ?? 0, -0.95, 0.95);
    torso.rotation.y += (yaw * 0.24 - torso.rotation.y) * ease;
    face.head.rotation.y += (yaw * 0.76 - face.head.rotation.y) * ease;
    face.head.rotation.x += (THREE.MathUtils.clamp(pose?.lookPitch ?? 0, -0.25, 0.23) + Math.sin(t * 2.3) * 0.025 * greeting - face.head.rotation.x) * ease;
    face.head.rotation.z = Math.sin(t * 1.1) * 0.018 * (1 - gait);
    face.setExpression(t, reduced, pose?.attention ?? greeting, yaw, 0.14 + greeting * 0.45, greeting * 0.16, detail);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const wave = i === 1 ? raisedHand : 0;
      const accent = i === 1 ? wristWave : 0;
      const swing = Math.sin(stride + i * Math.PI) * 0.16 * gait;
      const hx = side * (0.278 + wave * 0.15);
      const hy = 0.72 + wave * 0.61 + accent * 0.025;
      const hz = 0.035 + swing + wave * 0.1;
      const ex = side * (0.303 + wave * 0.12), ey = 0.94 + wave * 0.11, ez = -0.01 + swing * 0.45;
      const open = THREE.MathUtils.smoothstep(wave,.16,.93);
      hands[i].position.set(hx, hy, hz);
      hands[i].rotation.set(-.19*(1-open), side*.12*open, side*(wave*(Math.PI-.15)+accent*.25));
      wrist.set(0,.044,-.006).applyQuaternion(hands[i].quaternion).add(hands[i].position);
      sleeves[i](side*.178,1.151,-.012,ex,ey,ez,wrist.x,wrist.y,wrist.z);
      handFingers[i].rotation.x = -.78*(1-open);
    }
    object.userData.state = pose?.activity ?? "idle";
  }
  animate(0, 0, true);
  return {
    object,
    update(frame, pose) {
      if (resources.disposed || !frame.visible(object, 2.1)) return;
      animate(frame.time, frame.delta, frame.reduced, pose, frame.detail);
    },
    dispose: resources.dispose,
  };
}
