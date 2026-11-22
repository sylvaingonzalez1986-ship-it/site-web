import * as THREE from "three";
import { paintingToGround } from "./village-layout";
import { addCapVisor, addVillageNeck, addVillageShoe, clothPoint, clothSectionAt, createVillageSleeve, garmentPanel, garmentVolume, reshapeGarment, villageTrouserPattern, type ClothSection } from "./village-npc-tailoring";
import { createCharacterLimbSurface } from "./character-limb-surface";
import { sampleVillageWaves } from "./village-marine";
import type { VillageNpcPose, VillageNpcRig } from "./village-npc-types";
import {
  Assembly, CHARACTER_COLORS as C, characterDisposer, characterEase, characterMaterial,
  createCharacterFace, noCharacterHit,
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

  const oilskin = "#31473e", knit = "#2f504b";
  const legs = new Assembly();
  for (const side of [-1, 1]) {
    const trouser = createCharacterLimbSurface(object, material, "fisherman-seated-leg-" + side,
      villageTrouserPattern(oilskin, "#354b41", "fisherman"), 14, .36);
    trouser.pose(new THREE.Vector3(side * .117, .595, -.075), new THREE.Vector3(side * .199, .427, .374),
      new THREE.Vector3(side * .208, .139, .431), new THREE.Vector3(1, 0, 0));
    const ankle = new THREE.Group();
    ankle.name = `fisherman-ankle-${side}`;
    ankle.position.set(side * .208, .105, .434);
    ankle.rotation.y = side * .068;
    object.add(ankle);
    const shoe = new Assembly();
    addVillageShoe(shoe, "fisherman");
    shoe.finish("fisherman-leather-boot", ankle, material);
  }
  legs.add(garmentVolume([[.516, .144, .124, -.035], [.524, .209, .161, -.036],
    [.55, .232, .181, -.03], [.602, .237, .179, -.013], [.654, .21, .155]]), oilskin);
  legs.finish("fisherman-seated-trousers-boots", object, material);
  const torso = new THREE.Group(); torso.name = "fisherman-torso"; torso.position.y = 0.56; object.add(torso);
  const shirt = new Assembly();
  const pattern: readonly ClothSection[] = [
    [-.030, .162, .135, -.015], [.015, .236, .183, -.015], [.085, .270, .205, -.008],
    [.160, .284, .215, -.002], [.235, .292, .214, 0], [.310, .293, .207, -.005],
    [.388, .285, .185, -.011], [.443, .273, .164, -.016], [.486, .221, .134, -.017],
    [.521, .147, .108, -.010], [.544, .101, .084, -.006], [.548, .082, .073, -.005]];
  const section = (y: number) => clothSectionAt(pattern, y);
  const drape = (y: number, angle: number) => .009 * Math.cos(angle * 4 + y * 7) * (1 - THREE.MathUtils.smoothstep(y, .20, .45));
  const stripes = [.085, .158, .231, .304, .377], stripeHeight = .029;
  const seams = Array.from(new Set([...pattern.map(row => row[0]), ...stripes.flatMap(y => [y, y + stripeHeight])])).sort((a, b) => a - b);
  shirt.add(garmentVolume(seams.map(section), 24, y => stripes.some(start => y >= start && y < start + stripeHeight) ? "#ead7ae" : knit, drape), null);
  shirt.add(garmentVolume([[.515, .156, .112, -.010], [.530, .142, .108, -.010], [.550, .107, .089, -.006], [.550, .084, .074, -.005]]), "#3c6860");

  // Tough canvas rises over the lap. A darker chest pocket and welt are formed in the bib.
  const bibAngle = (y: number) => THREE.MathUtils.lerp(1.34, .78, THREE.MathUtils.smoothstep(y, .033, .222));
  const bibDrape = (y: number, a: number) => drape(y, a) + .015 + .006 * Math.cos(a * 2.6);
  shirt.add(garmentPanel([-.024, .015, .067, .133, .180, .213, .227].map(section), 16, y => [-bibAngle(y), bibAngle(y)], bibDrape), oilskin);
  shirt.add(garmentPanel([.083, .098, .156, .175].map(section), 8, () => [-.369, .369], (y, a) => bibDrape(y, a) + .008), "#496658");
  shirt.sweep([-.37, 0, .37].map(a => clothPoint(section(.174), a, (y, angle) => bibDrape(y, angle) + .011)),
    [.003, .006, .003], "#718476", 6);

  for (const side of [-1, 1]) {
    const strapCenter = (y: number) => side * THREE.MathUtils.lerp(.68, .92, THREE.MathUtils.smoothstep(y, .409, .518));
    const lift = (y: number, a: number) => .027 + drape(y, a);
    const rows = [.173, .204, .227, .268, .321, .388, .443, .486, .521].map(section);
    for (const rear of [false, true]) {
      shirt.add(garmentPanel(rows, 4, y => {
        const angle = rear ? Math.PI - strapCenter(y) : strapCenter(y);
        return [angle - .081, angle + .081];
      }, lift), rear ? "#b98c55" : "#d0a366");
    }
    const buckle = clothPoint(section(.283), strapCenter(.283), (y, a) => lift(y, a) + .008);
    shirt.add(new THREE.TorusGeometry(.022, .0043, 5, 14).scale(.87, 1.15, .7).rotateY(side * .27), C.gold, buckle);
    const shoulder = clothPoint(section(.515), side * Math.PI / 2, (y, a) => lift(y, a) + .005);
    shirt.sweep([clothPoint(section(.515), strapCenter(.515), lift), shoulder,
      clothPoint(section(.515), side * Math.PI - strapCenter(.515), lift)], [.013, .017, .013], "#bc9159", 7);
  }
  addVillageNeck(shirt, .49, .184, .083);
  shirt.finish("fisherman-striped-knit-and-braces", torso, material);
  const face = createCharacterFace(torso, material, "fisherman", "#bbb1a3"); face.head.position.set(0, 0.63, 0);
  const hat = new Assembly();
  const crown: readonly ClothSection[] = [[.388, .242, .217, -.015], [.405, .275, .236, -.018], [.430, .288, .243, -.018],
    [.463, .283, .241, -.026], [.482, .260, .225, -.034], [.497, .208, .180, -.041], [.505, .119, .114, -.046], [.511, 0, 0, -.046]];
  hat.add(reshapeGarment(garmentVolume(crown, 36, undefined, (y, a) => {
    const cloth = Math.sin(Math.PI * (y - .388) / .123);
    return cloth * (.011 * Math.sin(a * 3 + .65) + .006 * Math.cos(a * 5 - .5));
  }), point => {
    const rise = THREE.MathUtils.smoothstep(point.y, .389, .479);
    point.y += rise * (.057 * point.x + .036 * point.z - .017 * Math.exp(-((point.x + .12) ** 2 / .008)));
    point.x += rise * .024;
  }), "#126e65");
  const band: readonly ClothSection[] = [[.350, .232, .210, -.008], [.358, .247, .224, -.009], [.394, .255, .228, -.010], [.408, .252, .225, -.012]];
  hat.add(garmentVolume(band, 32, y => y > .392 ? "#49665a" : "#294a43"), null);
  addCapVisor(hat, .370, .245, .218, .086, "#294941", "#213631");
  const cord = Array.from({ length: 7 }, (_, i) => clothPoint(clothSectionAt(band, .380 - .009 * Math.sin(i * Math.PI / 6)), -1.36 + 2.72 * i / 6, () => .006));
  hat.sweep(cord, [.006, .007, .007, .008, .007, .007, .006], "#ac9363", 7);
  for (const point of [cord[0], cord[cord.length - 1]]) hat.ball(point, .014, "#b6a270", [1, 1, .64]);
  hat.finish("fisherman-cap", face.head, material);
  const sleeves = [-1, 1].map(side => createVillageSleeve(torso, material, "fisherman-sleeve-" + side, "fisherman", knit, "#396157"));
  const hands = [-1, 1].map(side => {
    const art = new Assembly();
    if (side === 1) {
      // The pivot follows the bottle axis, while the palm and curled fingers
      // wrap its surface. A visible grip must not disappear inside the glass.
      art.ball([0.061, 0, -0.005], 0.057, C.skin, [0.65, 0.96, 0.8]);
      art.sweep([[0.068, 0.031, 0], [0.045, 0.052, -0.037], [0.005, 0.044, -0.05]], [0.019, 0.021, 0.012], C.skin);
      for (const y of [-0.027, 0, 0.027]) art.sweep([[0.067, y, 0.022], [0.045, y, 0.057], [0.005, y, 0.065], [-0.027, y - 0.005, 0.044]], [0.014, 0.015, 0.014, 0.01], C.skin);
    } else {
      // The rod runs almost along +Z. Fingers cross under its handle, the thumb opposes them.
      art.ball([-.031, -.004, .003], .052, C.skin, [.68, .82, 1.12]);
      art.sweep([[-.043, .013, .026], [-.030, .032, .041], [-.007, .033, .045], [.012, .020, .041]],
        [.015, .016, .013, .008], C.skin, 7);
      for (const z of [-.028, 0, .026]) art.sweep([[-.045, -.008, z], [-.028, -.027, z + .002], [.004, -.030, z + .004], [.024, -.009, z + .004]],
        [.013, .015, .013, .008], C.skin, 7);
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
  function animate(time: number, delta: number, reduced: boolean, pose?: VillageNpcPose, detail = 1) {
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
    const idleYaw = phase === "watch" ? -0.11 : -0.04;
    face.head.rotation.y += (THREE.MathUtils.lerp(idleYaw, yaw * 0.82, attention) - face.head.rotation.y) * ease;
    const adjustment = phase === "adjust" && !reduced ? Math.sin(progress * Math.PI) ** 2 * (1 - attention) : 0;
    const idlePitch = phase === "watch" ? 0.085 : 0;
    const tilt = THREE.MathUtils.lerp(idlePitch, pose?.lookPitch ?? 0, attention) - lift * 0.13 + adjustment * 0.13;
    face.head.rotation.x += (tilt + Math.sin(t * 1.4) * 0.012 - face.head.rotation.x) * ease;
    face.head.rotation.z = Math.sin(t * 0.8) * 0.018 + attention * (pose?.emphasis ?? 0) * 0.025;
    face.setExpression(t, reduced, attention, yaw, (0.08 + attention * (0.16 + (pose?.emphasis ?? 0) * 0.3)) * (1 - lift * 0.95), attention * 0.45, detail);
    rest.set(0.53, 0.085, 0.02).applyQuaternion(inverseBust);
    lip.copy(face.mouth.position).applyEuler(face.head.rotation).add(face.head.position);
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
    sleeves[1](.225, .448, -.031, ex, ey, ez, wrist.x, wrist.y, wrist.z);
    // Convert the supported rod's contact back into bust space as shoulders turn.
    leftGrip.set(-0.196 - adjustment * 0.094, 0.225 - adjustment * 0.055, 0.71 - adjustment * 0.14).applyQuaternion(inverseBust);
    hands[0].position.copy(leftGrip);
    hands[0].rotation.x = -.226 + Math.sin(t * 4.5) * adjustment * .12;
    sleeves[0](-.226, .443, -.03, -.343, .185, .241, leftGrip.x, leftGrip.y, leftGrip.z);
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
      animate(frame.time, frame.delta, frame.reduced, pose, frame.detail);
    },
    dispose: resources.dispose,
  };
}
