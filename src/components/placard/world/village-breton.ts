import * as THREE from "three";
import { paintingToGround } from "./village-layout";
import type { VillageGroundHeight } from "./village-character-gait";
import type { VillageNpcRig, VillageNpcPose } from "./village-npc-types";
import { addVillageNeck, clothPoint, clothSectionAt, createVillageTrousers, garmentPanel, garmentVolume, reshapeGarment, type ClothSection } from "./village-npc-tailoring";
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
export function createVillageBreton(groundAt?: VillageGroundHeight): VillageNpcRig {
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

  const updateGait = createVillageTrousers(object, material, "breton", groundAt);

  const body = new Assembly();
  const shirt: readonly ClothSection[] = [
    [-.062, .151, .121], [-.019, .201, .137], [.052, .216, .147], [.130, .223, .163],
    [.219, .243, .180], [.306, .252, .177], [.380, .247, .159], [.422, .205, .139],
    [.451, .160, .115], [.475, .107, .092], [.488, .084, .081],
  ];
  body.add(garmentVolume(shirt, 24), "#f6e8c6");
  const opening = (y: number) => .28 + .91 * THREE.MathUtils.smoothstep(y, .078, .455);
  const clothEdge = (y: number, a: number) => .015 + .008 * Math.cos(a * 3) * (1 - THREE.MathUtils.smoothstep(y, .21, .44));
  const vest = shirt.slice(1, -1);
  body.add(garmentPanel(vest, 28, y => [opening(y), Math.PI * 2 - opening(y)], clothEdge), "#344840");
  body.add(garmentVolume([[-.054, .205, .141], [-.046, .221, .153], [-.011, .228, .158],
    [.007, .226, .155], [.013, .219, .152]], 28, y => y < -.044 || y > .007 ? "#1a5e56" : "#107a70"), null);
  for (const side of [-1, 1]) {
    const lapel: readonly ClothSection[] = vest.slice(1);
    body.add(garmentPanel(lapel, 6, y => {
      const a = opening(y), lapelWidth = .15 + .08 * THREE.MathUtils.smoothstep(y, .23, .445);
      return side === 1 ? [a - .04, a + lapelWidth] : [-a - lapelWidth, -a + .04];
    }, (y, a) => clothEdge(y, a) + .009), "#8a6940");
    body.sweep(lapel.map(row => clothPoint(row, side * (opening(row[0]) - .042), (y, a) => clothEdge(y, a) + .009)),
      [.004, .007, .008, .011, .012, .010, .003, .002], "#e4b762", 6);

    const collar = garmentPanel(shirt.slice(-4), 6, y => {
      const angle = THREE.MathUtils.lerp(.73, 1.02, THREE.MathUtils.smoothstep(y, .422, .486));
      return side === 1 ? [angle - .15, angle + .24] : [-angle - .24, -angle + .15];
    }, (y) => .014 + (.488 - y) * .11);
    body.add(collar, "#ffedc5");
    for (const y of [.127, .204, .277]) {
      const a = side * (opening(y) + .28);
      body.ball(clothPoint(clothSectionAt(shirt, y), a, (height, angle) => clothEdge(height, angle) + .011), .015, C.gold);
    }
  }
  addVillageNeck(body, .455, .175, .081);
  body.finish("breton-waistcoat", rig, material);

  // Rotate around the lips so that every playing pose seals the blowpipe.
  const head = new THREE.Group(); head.name = "breton-head"; head.position.set(0, 0.685, 0.23); rig.add(head);
  const face = createCharacterFace(head, material, "breton", "#6b3c25");
  face.head.name = "breton-face-pivot";
  face.head.position.copy(face.mouth.position).multiplyScalar(-1);
  const hat = new Assembly();
  const feltProfile = [[0, .365], [.224, .354], [.323, .352], [.379, .358], [.391, .369],
    [.389, .377], [.377, .380], [.327, .370], [.252, .371], [.237, .384], [.224, .420],
    [.225, .473], [.209, .507], [.185, .523], [.122, .526], [.058, .518], [0, .514]];
  const crownPinch = (point: THREE.Vector3) => {
    const { x, y, z } = point;
    const radius = Math.hypot(x, z), a = Math.atan2(x, z);
    const brim = THREE.MathUtils.smoothstep(radius, .253, .385);
    const crown = THREE.MathUtils.smoothstep(y, .404, .518);
    const front = THREE.MathUtils.smoothstep(z, -.04, .175);
    point.x = x * (1 - .22 * crown * front) - .017 * crown;
    point.z = z * (1 + .127 * crown) + .024 * crown;
    const liftFront = .039 * THREE.MathUtils.smoothstep(z, .06, .34);
    point.y += .054 * x + .062 * z + brim * (.032 * Math.sin(a - .27) ** 2 + liftFront - .006 * Math.cos(a));
    point.y -= crown * .028 * Math.exp(-((x + .021) ** 2) / .007);
  };
  const felt = new THREE.LatheGeometry(feltProfile.map(([r, y]) => new THREE.Vector2(r, y)), 36);
  hat.add(reshapeGarment(felt, crownPinch), "#293b35");
  const hatBand: readonly ClothSection[] = [[.382, .240, .241], [.388, .242, .243], [.414, .232, .235], [.421, .228, .231]];
  hat.add(reshapeGarment(garmentVolume(hatBand, 36, y => y > .413 ? "#45877a" : "#12766d"), crownPinch), null);
  hat.add(new THREE.SphereGeometry(1, 10, 6).scale(.033, .023, .029).rotateZ(-.18), "#234b42", [-.212, .401, -.096]);
  hat.finish("breton-felt-hat", face.head, material);
  const ribbon = new Assembly();
  ribbon.sweep([[-0.02, 0, 0], [-0.029, -0.058, -0.008], [-0.054, -0.126, -0.014], [-0.063, -0.178, 0]],
    [0.026, 0.029, 0.025, 0.009], C.dark);
  ribbon.sweep([[0.017, 0, 0], [0.017, -0.073, 0.018], [0.008, -0.134, 0.033]], [0.018, 0.023, 0.009], C.teal);
  const tails = ribbon.finish("breton-wind-ribbons", face.head, material);
  tails.position.set(-.206, .399, -.111);

  const bagArt = new Assembly();
  const bagPattern: readonly ClothSection[] = [[-.154, 0, 0, .011], [-.148, .095, .075, .016],
    [-.120, .169, .109, .007], [-.080, .216, .126, .001], [-.026, .228, .143, -.001],
    [.036, .206, .147, -.002], [.090, .169, .124, -.005], [.133, .110, .098, -.010],
    [.157, .055, .045, -.003], [.166, 0, 0, -.002]];
  const hideFold = (y: number, a: number) => .011 * Math.sin(Math.PI * (y + .154) / .32) * Math.cos(a * 4 - .5);
  const tuck = (point: THREE.Vector3) => {
    const gather = THREE.MathUtils.smoothstep(point.y, .027, .162);
    point.x += .034 * gather;
    point.y -= point.x * .15;
    point.z *= 1 - .14 * (1 - THREE.MathUtils.smoothstep(point.x, -.20, -.095));
  };
  bagArt.add(reshapeGarment(garmentVolume(bagPattern, 28, undefined, hideFold), tuck), "#176f63");
  const seam = bagPattern.slice(1, -1).map(row => {
    const angle = .71 + .31 * Math.sin((row[0] + .15) * 8);
    const point = new THREE.Vector3(...clothPoint(row, angle, (y, a) => hideFold(y, a) + .003));
    tuck(point);
    return point.toArray();
  });
  bagArt.sweep(seam, [.002, .004, .006, .007, .007, .006, .004, .002], "#c9a66c", 7);
  const bag = bagArt.finish("breton-air-bag", rig, material);
  bag.position.set(-0.22, 0.29, 0.15);

  const pipes = new Assembly();
  // Short chanter, directly attached to the forward bag stock.
  const chanterA: Point = [-0.1, 0.34, 0.27], chanterB: Point = [0.04, 0.015, 0.43];
  pipes.rod(chanterA, chanterB, 0.022, C.dark, 0.035);
  pipes.rod([-.116, .373, .249], [-.088, .311, .283], .050, "#ad7546", .039);
  pipes.rod([-.101, .345, .266], [-.094, .328, .275], .046, C.wood, .042);
  pipes.rod([0.025, 0.05, 0.413], [0.055, -0.02, 0.448], 0.046, C.wood, 0.025);
  // Mouth to bag. The little pale ferrule marks the separate blowpipe clearly.
  const blowpipeArt = new Assembly();
  blowpipeArt.rod([0, 0, 0], [0.2, 0.255, 0.08], 0.021, C.dark);
  blowpipeArt.rod([0.175, 0.223, 0.07], [0.2, 0.255, 0.08], 0.025, C.cream);
  const blowpipe = blowpipeArt.finish("breton-blowpipe", rig, material); blowpipe.position.set(-0.2, 0.43, 0.15);
  pipes.rod([-.214, .408, .150], [-.189, .443, .157], .039, "#ab7347", .032);
  const droneA = new THREE.Vector3(-0.3, 0.42, 0.04), droneB = new THREE.Vector3(-0.47, 1.25, -0.33);
  pipes.rod(droneA.toArray() as Point, droneB.toArray() as Point, 0.027, C.dark, 0.038);
  pipes.rod([-.287, .371, .087], [-.302, .440, .030], .044, "#b7834d", .034);
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
    const digitStarts: number[] = [];
    for (let digit = 0; digit < 3; digit++) {
      digitStarts.push(art.vertexCount);
      const y = 0.026 - digit * 0.025;
      art.sweep([[side * 0.003, y, 0.022], [side * 0.021, y - 0.002, 0.044],
      [side * 0.041, y - 0.008, 0.049], [side * 0.059, y - 0.014, 0.033]],
        [0.015, 0.017, 0.015, 0.009], "#f2c69c");
    }
    const mesh = art.finish(`breton-fingers-${index}`, rig, material); mesh.position.set(...at);
    const vertices = mesh.geometry.getAttribute("position");
    mesh.geometry.morphTargetsRelative = true;
    mesh.geometry.morphAttributes.position = digitStarts.map((from, digit) => {
      const offsets = new Float32Array(vertices.count * 3);
      for (let i = from; i < (digitStarts[digit + 1] ?? vertices.count); i++) {
        const fromKnuckle = THREE.MathUtils.smoothstep(side * vertices.getX(i), .011, .057);
        offsets[3 * i] = side * .005 * fromKnuckle;
        offsets[3 * i + 1] = .011 * fromKnuckle;
        offsets[3 * i + 2] = .022 * fromKnuckle;
      }
      return new THREE.BufferAttribute(offsets, 3);
    });
    mesh.updateMorphTargets();
    return mesh;
  });
  const sleeves = hands.map((hand, index) => {
    const side = index === 0 ? -1 : 1, sleeve = new Assembly();
    const points: Point[] = [[side * 0.151, 0.39, -0.012], [side * 0.232, 0.39, -0.002],
    [side * 0.287, 0.307, 0.054], [side * (index ? 0.326 : 0.391), index ? 0.186 : 0.217, 0.161],
    [side * (index ? 0.255 : 0.307), index ? 0.139 : 0.203, 0.236],
    [hand[0] + side * 0.091, hand[1] - 0.014, hand[2] - 0.040], [hand[0] + side * 0.029, hand[1], hand[2] - 0.014]];
    sleeve.sweep(points, [0.066, 0.109, 0.095, 0.084, 0.078, 0.063, 0.047], C.cream, 12);
    const cuffFrom = points[5], cuffTo = points[6];
    sleeve.rod(cuffFrom, cuffTo, 0.070, "#d2b285", 0.054);
    const binding = cuffFrom.map((n, j) => THREE.MathUtils.lerp(n, cuffTo[j], .76)) as Point;
    sleeve.rod(binding, cuffTo, 0.058, "#f3ddb0", 0.055);
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
    gait = reduced ? 0 : pose?.walkBlend ?? gait + (Math.min(1, (pose?.speed ?? 0) / .55) - gait) * ease;
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
    rig.rotation.z += reduced ? 0 : Math.sin(updateGait.stride) * gait * .023 - .054 * (pose?.turnLean ?? 0);
    const yaw = THREE.MathUtils.clamp(pose?.lookYaw ?? 0, -0.78, 0.78);
    rig.rotation.y += (yaw * 0.22 * (pose?.attention ?? 0) - rig.rotation.y) * ease;
    head.rotation.y += (yaw * (1 - playingBlend) - head.rotation.y) * ease;
    head.rotation.x += ((pose ? THREE.MathUtils.clamp(pose.lookPitch, -0.27, 0.25) * (1 - playingBlend) : (1 - playing) * 0.055) + Math.sin(t * 1.3) * 0.018 * (singingBlend * emphasis + playingBlend) - head.rotation.x) * ease;
    head.rotation.z = reduced ? 0 : THREE.MathUtils.lerp(Math.sin(t * 0.73) * 0.012, Math.sin(t * 2.3) * 0.03 * emphasis, singingBlend);
    const opening = 0.28 - 0.16 * playingBlend + singingBlend * (0.46 + Math.sin(t * 5.1) * 0.21 * emphasis);
    face.setExpression(t, reduced, pose?.attention ?? 0, yaw, opening,
      THREE.MathUtils.lerp(0.18, emphasis, singingBlend), detail, 1 - playingBlend * 0.59);
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
      // The palm and thumb keep the chanter anchored while individual fingertips vent the holes.
      for (let digit = 0; digit < 3; digit++) {
        finger.morphTargetInfluences![digit] = !reduced && quality === "high" && (lift || digit === 1) && digit === (note + index) % 3
          ? playingBlend * articulation * detail : 0;
      }
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
