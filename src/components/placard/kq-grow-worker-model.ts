import * as THREE from "three";
import { getChanvrierAppearance, getChanvrierColors, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createChanvrierHand } from "./chanvrier-hand";
import { createCharacterContactShadow } from "./world/village-contact-shadow";
import { createChanvrierHead } from "./chanvrier-head";
import { createChanvrierWardrobe } from "./chanvrier-wardrobe";
import { Assembly, characterDisposer, characterMaterial } from "./world/village-character-art";
import { createVillageCharacterGait, VILLAGE_CHARACTER_STRIDE_PER_METER, type VillageGroundHeight } from "./world/village-character-gait";
import type { KqGrowRoomEvent } from "./KqGrowRoomModel";

type Gesture = KqGrowRoomEvent["gesture"];
const visitor: ChanvrierAvatarProfile = { gender: "male", clothing: "sage", skin: "peach" };
const ink = "#2b3736";
const turned = (points: number[][], depth = 1, segments = 18) =>
  new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments).scale(1, 1, depth);

const bodyShapes = {
  regular: { chest: 1.05, height: .85, depth: 1.03, stance: 1, arm: 1, head: 1 },
  compact: { chest: .91, height: .81, depth: .93, stance: .91, arm: .93, head: 1.015 },
  broad: { chest: 1.17, height: .88, depth: 1.11, stance: 1.07, arm: 1.08, head: 1 },
};
const silhouettes = {
  male: { shoulder: 1, waist: 1, hip: 1, neck: 1, headWidth: 1 },
  female: { shoulder: .91, waist: .93, hip: 1.12, neck: .91, headWidth: .98 },
};

function createGrowWorkerTools(root: THREE.Group, hand: THREE.Group, material: THREE.Material) {
  const props = new Map<Gesture | "jar", THREE.Mesh>();
  function tool(kind: Gesture | "jar", build: (a: Assembly) => void) {
    const a = new Assembly();
    build(a);
    const m = a.finish(kind, hand, material);
    m.visible = false;
    props.set(kind, m);
    return m;
  }
  const broom = tool("sweep", a => {
    a.box([0, .105, 0], [.46, .045, .105], "#937044");
    for (let i = -7; i <= 7; i++) {
      const x = i * .029;
      a.rod([x, .09, 0], [x * 1.07, .01, .016], .019, i % 3 ? "#d6ac57" : "#ad8342", .024);
    }
  });
  root.add(broom);
  const shaftArt = new Assembly();
  shaftArt.rod([0, 0, 0], [0, 1.26, 0], .018, "#b88959");
  shaftArt.rod([0, 1.13, 0], [0, 1.28, 0], .022, "#387769");
  const shaft = shaftArt.finish("broom-handle", broom, material);
  shaft.position.y = .125;
  tool("spread", a => {
    a.rod([0, 0, -.045], [0, -.025, .13], .024, "#a77749");
    a.ball([0, -.028, .19], .10, "#9eafa4", [.84, .31, 1.25]);
    a.ball([0, .006, .19], .077, "#744d33", [.91, .48, 1.15]);
  });
  const grains = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.024), new THREE.MeshStandardMaterial(), 9);
  grains.name = "falling-input";
  grains.frustumCulled = false;
  root.add(grains);
  const particle = new THREE.Object3D(), outlet = new THREE.Vector3();
  tool("water", a => {
    a.add(turned([[0, -.20], [.081, -.19], [.087, -.045], [.061, -.032]], .78), "#728f86", [0, 0, .052]);
    a.rod([0, -.14, .10], [0, -.057, .255], .023, "#899c92", .014);
    a.add(new THREE.TorusGeometry(.052, .009, 6, 14).rotateY(Math.PI / 2), "#778d82", [0, -.032, .04]);
  });
  tool("harvest", a => {
    for (const s of [-1, 1]) {
      a.add(new THREE.TorusGeometry(.024, .006, 5, 12).rotateY(Math.PI / 2), "#bd7953", [0, -.02 + s * .018, .02]);
      a.rod([0, -.015, .045], [0, -.015 + s * .026, .12], .007, "#a2afa4", .002);
    }
  });
  tool("inspect", a => {
    a.rod([0, 0, 0], [0, .07, .04], .009, ink);
    a.add(new THREE.TorusGeometry(.044, .008, 6, 16).rotateX(-.45), "#847b64", [0, .099, .055]);
  });
  tool("repair", a => {
    a.rod([0, -.03, 0], [0, .06, .05], .014, "#ac6f46");
    a.rod([0, .06, .05], [0, .14, .09], .006, "#8b9997");
  });
  tool("card", a => {
    a.box([0, .033, .014], [.07, .095, .008], "#efda9a");
    a.ball([0, .036, .019], .021, "#488779", [.9, 1, .2]);
  });
  tool("pbi", a => {
    a.box([0, -.047, .028], [.090, .133, .032], "#f1db9e");
    a.box([0, .014, .028], [.09, .018, .034], "#577d63");
    a.ball([0, -.045, .047], .023, "#577d63", [1, 1.2, .25]);
  });
  tool("dice", a => {
    a.box([0, -.017, .03], [.04, .04, .04], "#f3e6c9");
    a.ball([.005, -.014, .051], .005, ink);
  });
  tool("store", a => {
    a.box([-.106, -.005, .04], [.28, .16, .19], "#b19974");
    a.box([-.106, .076, .04], [.28, .012, .19], "#cbaf84");
    a.box([-.106, .016, .137], [.081, .05, .004], "#eedfb9");
  });
  tool("jar", a => {
    a.add(turned([[0, -.07], [.038, -.067], [.042, -.054], [.042, .033], [.032, .047]], 1, 14), "#9ba887");
    a.add(new THREE.CylinderGeometry(.036, .036, .013, 14), "#b3b39c", [0, .055, 0]);
    a.box([0, -.009, .041], [.049, .032, .004], "#ecddbd");
  });
  tool("dry", a => {
    a.rod([0, .025, -.02], [0, .025, .14], .008, "#977452");
    for (let i = 0; i < 3; i++) {
      a.rod([0, .022, .03 + i * .038], [0, -.096, .044 + i * .038], .003, "#859961");
      a.ball([0, -.063, .044 + i * .038], .024, "#84965e", [.74, 1.8, .85]);
    }
  });
  return { props, broom, shaft, grains, particle, outlet };
}

export function createGrowWorker(profile = visitor, options?: { tools?: boolean; groundAt?: VillageGroundHeight }) {
  const object = new THREE.Group(), torso = new THREE.Group(), chest = new THREE.Group(), head = new THREE.Group();
  const neckAnchor = new THREE.Group();
  object.name = "chanvrier";
  torso.name = "chanvrier-torso";
  chest.name = "chanvrier-chest";
  head.name = "chanvrier-head";
  torso.position.y = .79;
  head.position.z = .019;
  object.add(torso);
  torso.add(chest, head, neckAnchor);

  const material = characterMaterial();
  const face = createChanvrierHead(head, material);
  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(), knee = new THREE.Group(), ankle = new THREE.Group();
    hip.name = `chanvrier-hip-${side}`;
    knee.name = `chanvrier-knee-${side}`;
    ankle.name = `chanvrier-ankle-${side}`;
    hip.position.set(side * .105, .79, 0);
    knee.position.y = -.35;
    ankle.position.y = -.35;
    object.add(hip);
    hip.add(knee);
    knee.add(ankle);
    return { hip, knee, ankle };
  });
  const ground = options?.groundAt && { root: object, heightAt: options.groundAt };
  const gait = createVillageCharacterGait({ left: legs[0], right: legs[1], upperLength: .35, lowerLength: .35, soleHeight: .09, ground });
  const hands = [new THREE.Group(), new THREE.Group()];
  hands[0].name = "supporting-hand";
  hands[1].name = "working-hand";
  torso.add(...hands);
  const palms = [createChanvrierHand(torso, material, -1), createChanvrierHand(torso, material, 1)];

  const wardrobe = createChanvrierWardrobe({
    body: object,
    torso: chest,
    head,
    hips: legs.map(leg => leg.hip),
    knees: legs.map(leg => leg.knee),
    ankles: legs.map(leg => leg.ankle),
    shoulders: torso,
  }, material);
  const tools = options?.tools === false ? null : createGrowWorkerTools(object, hands[1], material);
  const armUp = new THREE.Vector3(0, 1, 0), shoulder = new THREE.Vector3(), elbowGuide = new THREE.Vector3();
  const upperArm = new THREE.Vector3(), elbow = new THREE.Vector3(), gripAxis = new THREE.Vector3();
  let neckMesh: THREE.Mesh | undefined;
  let lastSkin: string | undefined;
  let shape = bodyShapes.regular;
  let silhouette = silhouettes.male;
  function updateAppearance(next: ChanvrierAvatarProfile = visitor) {
    if (resources.disposed) return;
    const look = getChanvrierAppearance(next), colors = getChanvrierColors(next);
    shape = bodyShapes[look.body];
    silhouette = silhouettes[next.gender];
    chest.scale.set(shape.chest * silhouette.waist, shape.height, shape.depth);
    neckAnchor.position.set(0, shape.height * .528, .016);
    neckAnchor.scale.x = silhouette.neck;
    head.position.y = neckAnchor.position.y + .141;
    head.scale.set(1.22 * shape.head * silhouette.headWidth, 1.21 * shape.head, 1.12 * shape.head);
    for (let i = 0; i < legs.length; i++) {
      const side = i ? 1 : -1;
      legs[i].hip.position.x = side * .114 * shape.stance * silhouette.hip;
      legs[i].hip.scale.x = 1.04 * shape.stance * silhouette.hip;
      legs[i].ankle.rotation.y = side * .075;
    }
    face.update(look, colors);
    wardrobe.update(look, colors);
    if (lastSkin !== colors.skin) {
      lastSkin = colors.skin;
      neckMesh?.removeFromParent();
      neckMesh?.geometry.dispose();
      const neck = new Assembly();
      neck.add(turned([[0, -.065], [.102, -.059], [.096, -.016], [.094, .035], [.106, .068], [.111, .084], [0, .090]], .91), colors.skin);
      neckMesh = neck.finish("chanvrier-neck", neckAnchor, material);
      neckMesh.castShadow = false;
      for (const palm of palms) palm.update(colors.skin);
    }
    pose(...lastPose);
  }

  // The room bakes the static furniture shadow map. A moving worker must not
  // leave that map stamped at their previous station.
  object.traverse(node => { node.castShadow = false; });
  const shadow = createCharacterContactShadow(object, legs.map(leg => leg.ankle), .09, .68, options?.groundAt);
  const resources = characterDisposer(object);
  const cropHandHeight = [-.04, .035, .16, .29, .41, .36];
  const shaftDirection = new THREE.Vector3(), broomPosition = new THREE.Vector3(), gripPoint = new THREE.Vector3();
  const torsoInverse = new THREE.Matrix4();
  let lastPose: Parameters<typeof pose> = [0, 0, null, 0, null];
  function pose(distance: number, walking: number, gesture: Gesture | null, phase: number, stage: number | null, deviceCode?: string, elapsedSeconds?: number) {
    lastPose = [distance, walking, gesture, phase, stage, deviceCode, elapsedSeconds];
    const gaitHeight = gait(distance * VILLAGE_CHARACTER_STRIDE_PER_METER, walking);
    const stride = gait.stride;
    const reach = gesture ? Math.sin(Math.PI * phase) ** .72 : 0;
    const work = reach * Math.sin(phase * Math.PI * 4);
    const time = elapsedSeconds ?? 0;
    const idle = elapsedSeconds === undefined || gesture ? 0 : 1 - walking;
    const breath = Math.sin(time * 2.16) * idle;
    const shift = Math.sin(time * 1.37) * idle;
    const jarTray = gesture === "store" && deviceCode === "LP-SUPER-1L";
    const barrel = gesture === "store" && (deviceCode === "CURTEC-60L" || deviceCode === "SIM-STORAGE-03");
    const spreading = gesture === "spread", pouring = gesture === "pour";
    const low = jarTray || gesture === "water" || gesture === "pbi" || spreading || pouring || ((gesture === "inspect" || gesture === "tend") && (stage ?? 2) <= 1);
    const bend = low ? .38 : gesture === "harvest" ? .18 : .10;
    const crouch = reach * (low ? .105 : .024);
    torso.position.y = .79 + gaitHeight - crouch + breath * .007;
    torso.position.z = jarTray ? reach * .13 : 0;
    if (crouch > .001) {
      // Bending equal-length legs symmetrically keeps both soles planted.
      for (const { hip, knee, ankle } of legs) {
        hip.position.y -= crouch;
        const angle = Math.acos(THREE.MathUtils.clamp((hip.position.y - .09) / .70, -1, 1));
        hip.rotation.x = -angle;
        knee.rotation.x = 2 * angle;
        ankle.rotation.x = -angle;
      }
    }
    torso.rotation.x = reach * bend + breath * .009;
    torso.rotation.z = shift * .022;
    const sweeping = gesture === "sweep";
    const stroke = Math.sin(phase * Math.PI * 6);
    torso.rotation.y = sweeping ? stroke * .20 * reach : .038 * walking * Math.sin(stride) - shift * .011;
    head.rotation.x = reach * (low ? .39 : gesture === "dry" ? -.14 : .13) - breath * .025;
    head.rotation.y = shift * .080;
    head.rotation.z = -shift * .035;
    face.blink(elapsedSeconds, walking, reach, -head.rotation.y);
    const held = jarTray ? "jar" : barrel ? null : pouring ? "water" : gesture;
    const holding = reach > .12 && (held !== "pbi" || phase < .55);
    if (tools) for (const [kind, mesh] of tools.props) mesh.visible = held === kind && holding;
    if (sweeping) {
      broomPosition.set(.02 + stroke * .34 * reach, 0, .49 + .05 * Math.cos(phase * Math.PI * 6));
      shaftDirection.set(-.09 - broomPosition.x * .57, 1.09, .265 - broomPosition.z).normalize();
      if (tools) {
        tools.broom.position.copy(broomPosition);
        tools.shaft.quaternion.setFromUnitVectors(armUp, shaftDirection);
      }
      torso.updateMatrix();
      torsoInverse.copy(torso.matrix).invert();
    }
    const goalY = gesture === "dry" ? .34 : gesture === "water" || pouring || spreading ? -.13 : gesture === "pbi" || jarTray ? -.23 : barrel ? .064 : gesture === "store" ? .13
      : gesture === "repair" ? .34 : gesture === "dice" || gesture === "card" ? .13 : cropHandHeight[stage ?? 2] ?? .16;
    const supporting = gesture === "harvest" || gesture === "tend" ? .83 : .20;
    const shoulderWidth = shape.chest * silhouette.shoulder;
    const handRest = Math.max(.246 + (shoulderWidth - 1) * .21, .252 + (shape.stance * silhouette.hip - 1) * .21);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, hand = hands[i], swing = Math.sin(stride + i * Math.PI) * walking;
      const grip = i || gesture === "dry" || gesture === "store" ? reach : reach * supporting;
      const handGoal = gesture === "store" || gesture === "harvest" ? .134 : .20;
      let handX = s * THREE.MathUtils.lerp(handRest, handGoal, grip)
        + (gesture === "harvest" && i ? work * .043 : 0);
      let handY = -.045 + grip * (goalY + .045) + work * (gesture === "dry" ? .040 * s : .022);
      let handZ = .06 + swing * .136 + grip * (jarTray || gesture === "pbi" ? .45 : low ? .31 : .38) + (gesture === "dice" || (spreading && i) ? work * .11 : 0);
      if (sweeping) {
        gripPoint.copy(broomPosition);
        gripPoint.y += .125;
        gripPoint.addScaledVector(shaftDirection, i ? .64 : .98).applyMatrix4(torsoInverse);
        handX = gripPoint.x; handY = gripPoint.y; handZ = gripPoint.z;
      } else if (spreading && i) handX += work * .14;
      const elbowX = s * (.255 * shoulderWidth + grip * .038), elbowY = .207 * shape.height + grip * (goalY * .57 - .06);
      const elbowZ = -.01 + swing * .072 + grip * .16;
      hand.position.set(handX, handY, handZ);
      hand.rotation.x = pouring ? .72 * reach : spreading ? work * .56 : gesture === "water" ? -.9 * reach + work * .23 : -.28 * grip;
      hand.rotation.z = gesture === "repair" ? work * .52 : gesture === "harvest" ? work * .16 : 0;

      shoulder.set(s * .199 * shoulderWidth, .414 * shape.height, .003);
      elbowGuide.set(elbowX, elbowY, elbowZ);
      const carried = holding && i && held;
      const wrapping = (sweeping && holding) || carried === "spread" || carried === "water" || carried === "inspect" || carried === "repair" || carried === "jar";
      if (sweeping) gripAxis.copy(shaftDirection).transformDirection(torsoInverse);
      else {
        if (spreading) gripAxis.set(0, -.14, 1);
        else if (carried === "water") gripAxis.set(0, .80, .60);
        else if (carried === "inspect" || carried === "repair") gripAxis.set(0, 1, .56);
        else gripAxis.copy(armUp);
        gripAxis.applyQuaternion(hand.quaternion);
      }
      const pinch = carried === "harvest" || carried === "card" || carried === "dry" || carried === "dice" || carried === "pbi" || carried === "store";
      const handScale = (carried === "jar" ? 1.16 : 1) * THREE.MathUtils.lerp(1, shape.arm, .45);
      const wrist = palms[i].pose(wrapping ? "grip" : pinch ? "pinch" : "relaxed", hand.position, elbowGuide, gripAxis, handScale);
      upperArm.subVectors(wrist, shoulder);
      const distance = Math.max(.0001, upperArm.length());
      upperArm.multiplyScalar(1 / distance);
      // Preserve the authored contact when an extreme gesture exceeds the resting arm length.
      const extension = Math.max(shape.arm, (distance + .006) / .395);
      const upperLength = .205 * extension, lowerLength = .190 * extension;
      const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
      const rise = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
      elbow.subVectors(elbowGuide, shoulder).addScaledVector(upperArm, -elbow.dot(upperArm)).normalize();
      elbow.multiplyScalar(rise).addScaledVector(upperArm, along).add(shoulder);
      wardrobe.poseArm(i, shoulder, elbow, wrist, shape.arm);
    }
    wardrobe.poseLowerBody(shape.depth);
    shadow.update();
    if (!tools) return;
    const { grains, particle, outlet } = tools;
    grains.visible = (pouring || spreading) && phase > .22 && phase < .83;
    if (grains.visible) {
      torso.updateMatrix(); hands[1].updateMatrix();
      outlet.set(0, pouring ? -.057 : -.01, pouring ? .255 : .27).applyMatrix4(hands[1].matrix).applyMatrix4(torso.matrix);
      grains.material.color.set(pouring ? "#73bab8" : "#865638");
      for (let i = 0; i < grains.count; i++) {
        const fall = (phase * 5 + i / grains.count) % 1;
        particle.position.copy(outlet);
        particle.position.x += spreading ? fall * Math.sin(i * 4) * .19 : 0;
        particle.position.z += fall * (spreading ? .43 : .13);
        particle.position.y += (spreading ? .13 * Math.sin(fall * Math.PI) : 0) - fall * fall * Math.max(.06, outlet.y - .13);
        particle.scale.set(1, pouring ? 1.7 : .8, 1);
        particle.updateMatrix();
        grains.setMatrixAt(i, particle.matrix);
      }
      grains.instanceMatrix.needsUpdate = true;
    }
  }
  updateAppearance(profile);
  return { object, pose, updateAppearance, dispose: () => {
    if (resources.disposed) return;
    tools?.grains.dispose();
    shadow.mesh.dispose();
    wardrobe.dispose();
    resources.dispose();
  } };
}
