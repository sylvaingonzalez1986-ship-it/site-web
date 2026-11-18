import * as THREE from "three";
import { paintingToGround } from "./village-layout";
import type { VillageNpcRig, VillageNpcPose } from "./village-npc-types";
import { createVillageCharacterGait } from "./village-character-gait";
import { villageBreezeStrength } from "./village-wind";
import { Assembly, CHARACTER_COLORS as C, characterDisposer, characterEase, characterMaterial, createCharacterFace, noCharacterHit as noHit } from "./village-character-art";

const [x, z] = paintingToGround(1030, 640);
/** Open junction verge, clear of the jury hydrangea, doorway, mailbox and bench. */
export const VILLAGE_BRETON_POSITION: [number, number, number] = [x, 0.04, z];
export const VILLAGE_BRETON_RADIUS = 0.64;

type Point = [number, number, number];

/**
 * Visual biniou kozh: a compact bag, short levriad, blowpipe and ONE shoulder drone.
 * Primary collection reference: https://catalogue.bnf.fr/ark:/12148/cb166906596
 * The museum's three nested cylinders form one drone, not three separate drones:
 * https://musee-breton.finistere.fr/fr/notice/1956-1-401-biniou-musee-departemental-breton-671c4329-2362-4309-8472-318ca937ccc3
 * No audio, own clock, network access or interaction targets.
 */
export function createVillageBreton(): VillageNpcRig {
  const object = new THREE.Group();
  object.name = "village-breton";
  object.position.set(...VILLAGE_BRETON_POSITION);
  object.rotation.y = 0.46;
  object.userData = { decorative: true, instrument: "biniou-kozh", droneCount: 1, state: "playing", phrase: 0 };
  const material = characterMaterial();
  const rig = new THREE.Group();
  rig.name = "breton-playing-rig";
  rig.position.y = 0.72;
  object.add(rig);

  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(); hip.position.set(side * 0.125, 0.69, 0); object.add(hip);
    hip.name = `breton-leg-${side}`;
    const upper = new Assembly();
    upper.sweep([[0, 0.042, 0], [0, -0.055, 0], [0, -0.16, 0.003], [0, -0.25, 0.006], [0, -0.30, 0]],
      [0.076, 0.111, 0.104, 0.094, 0.081], C.dark, 14);
    upper.finish("breton-trouser-thigh", hip, material);
    const knee = new THREE.Group(); knee.position.y = -0.28; hip.add(knee);
    const lower = new Assembly();
    lower.sweep([[0, 0.036, 0], [0, -0.018, 0], [0, -0.118, -0.005], [0, -0.23, 0], [0, -0.279, 0]],
      [0.075, 0.092, 0.084, 0.078, 0.081], C.dark, 14);
    lower.rod([0, -0.265, 0], [0, -0.301, 0], 0.082, "#35463e", 0.079);
    lower.finish("breton-cuffed-trouser", knee, material);
    const ankle = new THREE.Group(); ankle.name = `breton-ankle-${side}`; ankle.position.y = -0.32; knee.add(ankle);
    const shoe = new Assembly();
    shoe.ball([0, -0.080, 0.066], 1, "#977345", [0.104, 0.025, 0.179]);
    shoe.ball([0, -0.044, 0.066], 1, C.ink, [0.104, 0.054, 0.174]);
    shoe.ball([0, 0.004, -0.005], 0.084, C.ink, [1.03, 0.75, 1.33]);
    shoe.rod([-0.046, 0.016, 0.091], [0.046, 0.016, 0.091], 0.010, "#b99a65");
    shoe.finish("breton-grounded-foot", ankle, material);
    return { hip, knee, ankle };
  });
  const updateGait = createVillageCharacterGait({ left: legs[0], right: legs[1], upperLength: 0.28, lowerLength: 0.32, soleHeight: 0.105 });

  const body = new Assembly();
  // Cloth panels share the same horizontal rings. The cream shirt shows through
  // the widening V, while the dark waistcoat follows the belly all the way round.
  const torsoRows = [
    [-0.061, 0.147, 0.12], [-0.02, 0.2, 0.139], [0.052, 0.229, 0.153], [0.144, 0.249, 0.177],
    [0.24, 0.255, 0.189], [0.33, 0.25, 0.175], [0.402, 0.23, 0.156], [0.451, 0.178, 0.128], [0.482, 0.09, 0.084],
  ];
  const frontAngle = (y: number) => 0.22 + 0.68 * THREE.MathUtils.smoothstep(y, 0.03, 0.48);
  const clothPoint = ([y, rx, rz]: number[], angle: number): Point => [Math.sin(angle) * rx, y, Math.cos(angle) * rz];
  for (const front of [true, false]) {
    const positions: number[] = [], indices: number[] = [];
    torsoRows.forEach((row, i) => {
      const cut = frontAngle(row[0]), steps = 24;
      for (let j = 0; j <= steps; j++) {
        const angle = front ? -cut + 2 * cut * j / steps : cut + (Math.PI * 2 - 2 * cut) * j / steps;
        positions.push(...clothPoint(row, angle));
        if (i && j) {
          const c = i * (steps + 1) + j;
          indices.push(c - steps - 2, c - steps - 1, c, c - steps - 2, c, c - 1);
        }
      }
    });
    const surface = new THREE.BufferGeometry();
    surface.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); surface.setIndex(indices);
    surface.computeVertexNormals(); body.add(surface, front ? C.cream : "#394940");
  }
  for (const side of [-1, 1]) {
    const trim = torsoRows.slice(2).map(row => clothPoint(row, side * frontAngle(row[0])));
    body.sweep(trim, [0.008, 0.009, 0.009, 0.010, 0.011, 0.012, 0.009], "#bc9153", 8);
    body.sweep([[side * 0.044, 0.489, 0.067], [side * 0.074, 0.462, 0.108], [side * 0.099, 0.419, 0.127]],
      [0.03, 0.028, 0.004], "#f3e3be");
  }
  for (const y of [0.13, 0.21, 0.29]) body.ball([0.085, y, 0.172], 0.014, C.gold);
  body.rod([0, 0.455, 0], [0, 0.615, 0], 0.088, C.skin);
  body.add(new THREE.LatheGeometry([new THREE.Vector2(0.20, -0.02), new THREE.Vector2(0.232, 0.004),
    new THREE.Vector2(0.24, 0.039), new THREE.Vector2(0.23, 0.061)], 24).scale(1, 1, 0.71), C.teal);
  body.finish("breton-waistcoat", rig, material);

  // Rotate around the lips so that every playing pose seals the blowpipe.
  const head = new THREE.Group(); head.name = "breton-head"; head.position.set(0, 0.685, 0.23); rig.add(head);
  const face = createCharacterFace(head, material, "breton");
  face.head.name = "breton-face-pivot";
  face.head.position.copy(face.mouth.position).multiplyScalar(-1);
  const hat = new Assembly();
  const feltProfile = [[0, 0.365], [0.228, 0.354], [0.335, 0.352], [0.386, 0.363], [0.391, 0.372],
    [0.385, 0.380], [0.337, 0.372], [0.249, 0.376], [0.235, 0.386], [0.222, 0.49],
    [0.21, 0.521], [0.178, 0.53], [0.08, 0.525], [0, 0.516]];
  const felt = new THREE.LatheGeometry(feltProfile.map(([r, y]) => new THREE.Vector2(r, y)), 36);
  const hatVerts = felt.getAttribute("position");
  for (let i = 0; i < hatVerts.count; i++) {
    const x = hatVerts.getX(i), z = hatVerts.getZ(i);
    hatVerts.setY(i, hatVerts.getY(i) + 0.076 * x + 0.095 * z);
  }
  felt.computeVertexNormals();
  hat.add(felt, C.dark);
  hat.add(new THREE.CylinderGeometry(0.235, 0.243, 0.041, 36, 1, true).rotateZ(0.075).rotateX(-0.095), C.teal, [0, 0.398, 0]);
  hat.finish("breton-felt-hat", face.head, material);
  const ribbon = new Assembly();
  ribbon.sweep([[-0.02, 0, 0], [-0.029, -0.058, -0.008], [-0.054, -0.126, -0.014], [-0.063, -0.178, 0]],
    [0.026, 0.029, 0.025, 0.009], C.dark);
  ribbon.sweep([[0.017, 0, 0], [0.017, -0.073, 0.018], [0.008, -0.134, 0.033]], [0.018, 0.023, 0.009], C.teal);
  const tails = ribbon.finish("breton-wind-ribbons", face.head, material);
  tails.position.set(-0.182, 0.369, -0.145);

  const bagArt = new Assembly();
  bagArt.add(new THREE.SphereGeometry(1, 22, 14).scale(0.227, 0.177, 0.153).rotateZ(-0.24), "#0a7b76");
  bagArt.sweep([[-0.214, 0.003, 0.033], [-0.159, -0.091, 0.084], [-0.039, -0.14, 0.081], [0.068, -0.14, 0.064],
    [0.151, -0.092, 0.063], [0.196, -0.047, 0.056]], [0.003, 0.007, 0.008, 0.008, 0.006, 0.003], "#ceb270", 8);
  const bag = bagArt.finish("breton-air-bag", rig, material);
  bag.position.set(-0.22, 0.29, 0.15);

  const pipes = new Assembly();
  // Short chanter, directly attached to the forward bag stock.
  const chanterA: Point = [-0.1, 0.34, 0.27], chanterB: Point = [0.04, 0.015, 0.43];
  pipes.rod(chanterA, chanterB, 0.022, C.dark, 0.035);
  pipes.ball(chanterA, 0.045, C.wood);
  pipes.rod([0.025, 0.05, 0.413], [0.055, -0.02, 0.448], 0.046, C.wood, 0.025);
  // Mouth to bag. The little pale ferrule marks the separate blowpipe clearly.
  const blowpipeArt = new Assembly();
  blowpipeArt.rod([0, 0, 0], [0.2, 0.255, 0.08], 0.021, C.dark);
  blowpipeArt.rod([0.175, 0.223, 0.07], [0.2, 0.255, 0.08], 0.025, C.cream);
  const blowpipe = blowpipeArt.finish("breton-blowpipe", rig, material); blowpipe.position.set(-0.2, 0.43, 0.15);
  const droneA = new THREE.Vector3(-0.3, 0.42, 0.04), droneB = new THREE.Vector3(-0.47, 1.25, -0.33);
  pipes.rod(droneA.toArray() as Point, droneB.toArray() as Point, 0.027, C.dark, 0.038);
  for (const t of [0.06, 0.38, 0.72, 0.96]) {
    const low = droneA.clone().lerp(droneB, t - 0.018), high = droneA.clone().lerp(droneB, t + 0.018);
    pipes.rod(low.toArray() as Point, high.toArray() as Point, 0.043, C.cream);
  }
  pipes.ball(droneB.toArray() as Point, 0.049, C.wood, [1, 0.7, 1]);
  pipes.finish("breton-biniou-pipes-one-drone", rig, material);
  // Notes leave the short chanter below the face, clear of the overhead speech bubble.
  const music = new THREE.Group(); music.name = "breton-music"; music.position.set(0.055, -0.02, 0.448); rig.add(music);
  const noteArt = new Assembly();
  noteArt.ball([0, 0, 0], 0.043, C.ink, [1.2, 0.65, 0.4]);
  noteArt.rod([0.039, 0, 0], [0.039, 0.17, 0], 0.012, C.ink);
  noteArt.rod([0.039, 0.17, 0], [0.11, 0.13, 0], 0.018, C.gold);
  const noteMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, depthWrite: false });
  const firstNote = noteArt.finish("breton-note-0", music, noteMaterial);
  const notes = [firstNote, ...Array.from({ length: 3 }, (_, index) => {
    const note = new THREE.Mesh(firstNote.geometry, noteMaterial.clone()); note.name = `breton-note-${index + 1}`;
    note.raycast = noHit; music.add(note); return note;
  })];
  notes.forEach(note => { note.castShadow = false; note.receiveShadow = false; note.visible = false; });

  // Fingers curl across the front of the chanter from opposite sides. Each
  // hand articulates around its own grip, keeping the thumb and wrist seated.
  const hands: Point[] = [[-0.098, 0.253, 0.313], [0.035, 0.122, 0.365]];
  const fingers = hands.map((at, index) => {
    const side = index === 0 ? 1 : -1, art = new Assembly();
    art.ball([0, 0, 0], 0.057, "#edbd93", [0.80, 1, 0.73]);
    art.sweep([[side * -0.012, 0.017, -0.008], [side * 0.012, 0.039, -0.017], [side * 0.035, 0.037, -0.012]],
      [0.018, 0.021, 0.01], "#edbd93");
    for (let digit = 0; digit < 3; digit++) {
      const y = 0.026 - digit * 0.025;
      art.sweep([[side * 0.003, y, 0.022], [side * 0.021, y - 0.002, 0.044],
        [side * 0.041, y - 0.008, 0.049], [side * 0.059, y - 0.014, 0.033]],
        [0.015, 0.017, 0.015, 0.009], "#f2c69c");
    }
    const mesh = art.finish(`breton-fingers-${index}`, rig, material); mesh.position.set(...at);
    return mesh;
  });
  const sleeves = hands.map((hand, index) => {
    const side = index === 0 ? -1 : 1, sleeve = new Assembly();
    const points: Point[] = [[side * 0.151, 0.39, -0.012], [side * 0.232, 0.39, -0.002],
      [side * 0.287, 0.307, 0.054], [side * (index ? 0.326 : 0.391), index ? 0.186 : 0.217, 0.161],
      [side * (index ? 0.255 : 0.307), index ? 0.139 : 0.203, 0.236],
      [hand[0] + side * 0.091, hand[1] - 0.014, hand[2] - 0.040], [hand[0] + side * 0.029, hand[1], hand[2] - 0.014]];
    sleeve.sweep(points, [0.06, 0.106, 0.088, 0.079, 0.076, 0.065, 0.049], C.cream, 14);
    const cuffFrom = points[5], cuffTo = points[6];
    sleeve.rod(cuffFrom, cuffTo, 0.072, "#e2cea5", 0.055);
    sleeve.ball([cuffFrom[0], cuffFrom[1] + 0.056, cuffFrom[2] + 0.017], 0.01, C.gold);
    return sleeve.finish(`breton-folded-sleeve-${index}`, rig, material);
  });
  // The outside of the pressing sleeve moves against the air bag. Both ends
  // stay at zero weight so the seam and the grip remain connected.
  const pressed = sleeves[0];
  const sleevePositions = pressed.geometry.getAttribute("position");
  const weights = new Float32Array(sleevePositions.count * 3);
  for (let i = 0; i < sleevePositions.count; i++) {
    weights[i * 3] = 0.027 * THREE.MathUtils.smoothstep(-sleevePositions.getX(i), 0.24, 0.4);
  }
  pressed.geometry.morphTargetsRelative = true;
  pressed.geometry.morphAttributes.position = [new THREE.BufferAttribute(weights, 3)];
  pressed.updateMorphTargets();
  const resources = characterDisposer(object);
  let gait = 0, playingBlend = 1, singingBlend = 0, noteTravel = 0, fingerBeat = 0;
  function animate(time: number, reduced: boolean, quality: "low" | "high", delta = 1 / 30, pose?: VillageNpcPose, detail = 1) {
    const t = reduced ? 0 : time;
    const phase = t % 18;
    // Two unequal phrases, a held cadence, then a short breath before the repeat.
    const pause = phase > 14.7;
    const phrasePlaying = 1 - THREE.MathUtils.smoothstep(phase, 14.5, 15.3) + THREE.MathUtils.smoothstep(phase, 17.2, 18);
    const playing = pose ? Number(pose.activity === "playing") : phrasePlaying;
    const singing = pose?.activity === "singing";
    const ease = characterEase(delta, reduced);
    playingBlend += (playing - playingBlend) * ease;
    singingBlend += (Number(singing) - singingBlend) * ease;
    gait += ((!reduced ? Math.min(1, (pose?.speed ?? 0) / 0.55) : 0) - gait) * ease;
    rig.position.y = 0.72 + updateGait(pose?.stride ?? 0, gait);
    const breathCycle = (t % 3.6) / 3.6;
    const breath = breathCycle < 0.28
      ? THREE.MathUtils.smoothstep(breathCycle, 0, 0.28)
      : 1 - THREE.MathUtils.smoothstep(breathCycle, 0.28, 1);
    const squeeze = reduced ? 0 : playingBlend * (1 - breath) * 0.025;
    bag.scale.set(1 - squeeze, 1 + breath * 0.035 * playingBlend, 1 - squeeze * 0.5);
    pressed.morphTargetInfluences![0] = squeeze / 0.025;
    const emphasis = pose?.emphasis ?? 0.35;
    rig.rotation.z = reduced ? 0 : THREE.MathUtils.lerp(Math.sin(t * 0.57) * 0.012, Math.sin(t * 2.4) * 0.035 * emphasis, singingBlend);
    const yaw = THREE.MathUtils.clamp(pose?.lookYaw ?? 0, -0.78, 0.78);
    rig.rotation.y += (yaw * 0.22 * (pose?.attention ?? 0) - rig.rotation.y) * ease;
    head.rotation.y += (yaw * (1 - playingBlend) - head.rotation.y) * ease;
    head.rotation.x += ((pose ? THREE.MathUtils.clamp(pose.lookPitch, -0.27, 0.25) * (1 - playingBlend) : (1 - playing) * 0.055) + Math.sin(t * 1.3) * 0.018 * (singingBlend * emphasis + playingBlend) - head.rotation.x) * ease;
    head.rotation.z = reduced ? 0 : THREE.MathUtils.lerp(Math.sin(t * 0.73) * 0.012, Math.sin(t * 2.3) * 0.03 * emphasis, singingBlend);
    const opening = 0.28 - 0.16 * playingBlend + singingBlend * (0.46 + Math.sin(t * 5.1) * 0.21 * emphasis);
    face.setExpression(t, reduced, pose?.attention ?? 0, yaw, opening, THREE.MathUtils.lerp(0.18, emphasis, singingBlend));
    face.mouth.scale.x *= 1 - playingBlend * 0.59;
    // The hinged blowpipe rests away from the mouth during speech and singing.
    blowpipe.rotation.x += ((pose ? (1 - playingBlend) * 1.05 : 0) - blowpipe.rotation.x) * ease;
    tails.rotation.x = reduced ? 0 : Math.sin(t * 1.9 + Math.sin(t * 0.43)) * 0.16 * villageBreezeStrength(t);
    const elapsed = reduced ? 0 : Math.max(0, delta);
    noteTravel = (noteTravel + elapsed * (0.38 + emphasis * 0.15)) % 1;
    fingerBeat = (fingerBeat + elapsed * (phase < 7 ? 3.7 : 4.3)) % 5;
    fingers.forEach((finger, index) => {
      const notePhase = fingerBeat + index * 1.73;
      const note = Math.floor(notePhase) % 5;
      const lift = note === 0 || note === 3;
      const articulation = Math.sin((notePhase % 1) * Math.PI) ** 2;
      finger.rotation.y = !reduced && quality === "high" && lift ? (index === 0 ? -0.17 : 0.17) * playingBlend * articulation * detail : 0;
    });
    const musical = pose ? Math.min(1, playingBlend + singingBlend) : Number(!pause) * phrasePlaying;
    notes.forEach((note, index) => {
      const weight = index < 2 ? 1 : quality === "high" ? detail : 0;
      const visibility = musical * weight;
      const visible = !reduced && visibility > 0.005;
      note.visible = visible;
      if (!visible) return;
      const life = (noteTravel + index / notes.length) % 1;
      note.position.set(Math.sin(life * 3 + index) * 0.06 + life * 0.62, life * 0.52, life * 0.16 + 0.04);
      note.rotation.set(0, -object.rotation.y - rig.rotation.y, Math.sin(life * 4 + index) * 0.18);
      note.scale.setScalar((0.65 + emphasis * 0.3) * Math.min(1, life * 8));
      (note.material as THREE.MeshStandardMaterial).opacity = Math.sin(life * Math.PI) * 0.88 * visibility;
    });
    object.userData.state = pose?.activity ?? (reduced ? "resting" : pause ? "phrase-breath" : "playing");
    object.userData.phrase = phase < 7 ? 0 : phase < 14.7 ? 1 : 2;
    object.userData.bagCompression = squeeze;
  }
  animate(0, true, "high");

  return {
    object,
    update(frame, pose) {
      if (resources.disposed || !frame.visible(object, 2.6)) return;
      animate(frame.time, frame.reduced, frame.quality, frame.delta, pose, frame.detail);
    },
    dispose: resources.dispose,
  };
}
