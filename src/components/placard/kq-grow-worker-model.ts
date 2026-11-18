import * as THREE from "three";
import { CHANVRIER_APPEARANCE_OPTIONS as choices, CHANVRIER_CLOTHES, CHANVRIER_SKINS, getChanvrierAppearance, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { Assembly, characterDisposer, characterMaterial, createCharacterLimbs } from "./world/village-character-art";
import { createVillageCharacterGait, VILLAGE_CHARACTER_STRIDE_PER_METER } from "./world/village-character-gait";
import type { KqGrowRoomEvent } from "./KqGrowRoomModel";

type Gesture = KqGrowRoomEvent["gesture"];
const visitor: ChanvrierAvatarProfile = { gender: "male", clothing: "sage", skin: "peach" };
const fabric = (code: string) => CHANVRIER_CLOTHES.find(item => item.code === code)!.color;
const ink = "#2b3736";
const turned = (points: number[][], depth = 1, segments = 18) =>
  new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments).scale(1, 1, depth);

export function createGrowWorker(profile = visitor) {
  const look = getChanvrierAppearance(profile);
  const skin = CHANVRIER_SKINS.find(item => item.code === profile.skin)!.color;
  const hair = choices.hairColor.find(item => item.code === look.hairColor)!.color;
  const eyes = choices.eyeColor.find(item => item.code === look.eyeColor)!.color;
  const shirt = fabric(profile.clothing), trousers = fabric(look.bottomColor), shoe = fabric(look.shoeColor);
  const object = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
  object.name = "chanvrier";
  torso.position.y = .79;
  head.position.set(0, .65, .01);
  object.add(torso);
  torso.add(head);
  const material = characterMaterial();
  const body = new Assembly();
  body.add(turned([[0, -.11], [.18, -.10], [.205, -.03], [.184, .09], [.19, .22], [.245, .39], [.23, .47], [.14, .51], [.09, .5], [0, .48]], .76), shirt);
  body.rod([0, .48, 0], [0, .65, .01], .078, skin, .069);
  body.add(turned([[.08, .495], [.118, .48], [.124, .505], [.09, .53]], .85), look.accessory === "scarf" ? "#c98255" : shirt);
  const bib = look.top === "overalls" || look.top === "apron";
  if (bib) {
    const bibColor = look.top === "apron" ? "#ab8d66" : trousers;
    body.ball([0, .09, .136], .164, bibColor, [1, 1.14, .28]);
    body.box([0, .085, .179], [.135, .08, .012], bibColor);
    for (const side of [-1, 1]) {
      body.sweep([[side * .118, .24, .14], [side * .133, .40, .13], [side * .139, .492, .076], [side * .145, .49, -.07], [side * .107, .23, -.132]], [.018, .022, .025, .025, .02], bibColor);
      body.ball([side * .115, .24, .154], .017, "#bdab77", [1, 1, .45]);
    }
  } else if (look.top === "hoodie") {
    body.ball([0, .45, -.085], .18, shirt, [1, .58, .74]);
    for (const side of [-1, 1]) body.rod([side * .045, .47, .113], [side * .055, .34, .15], .009, "#d7c8a3");
  } else if (look.top === "jacket" || look.top === "shirt") {
    body.sweep([[0, .46, .145], [0, .29, .157], [0, .11, .145], [0, -.07, .144]], [.008, .006, .006, .008], ink);
    for (const y of [.15, .25, .35]) body.ball([.014, y, .155], .009, "#d8c6a3");
  }
  if (look.bottom === "skirt") body.add(turned([[0, -.25], [.24, -.25], [.205, -.04], [.18, .02], [0, .02]], .83), trousers);
  body.finish("workwear-seams-and-pocket", torso, material);

  const face = new Assembly();
  const jaw = look.face === "square" || look.face === "angular" ? .151 : look.face === "heart" ? .105 : .131;
  face.add(turned([[0, -.066], [jaw * .62, -.05], [jaw, .012], [.164, .09], [.171, .18], [.16, .244], [.113, .307], [0, .333]], .91), skin);
  head.scale.set(look.face === "round" ? 1.1 : 1, look.face === "long" ? 1.1 : 1, 1);
  for (const s of [-1, 1]) {
    face.ball([s * .162, .106, 0], .039, skin, [.62, 1.12, .68]);
    const open = look.eyes === "bright" ? 1.3 : look.eyes === "relaxed" ? .72 : 1;
    face.ball([s * .065, .151, .139], .027, "#faedd3", [1, .78 * open, .33]);
    face.ball([s * .062, .15, .148], .016, eyes, [1, open, .48]);
    face.ball([s * .06, .15, .154], .008, ink);
    face.sweep([[s * .035, .194, .146], [s * .065, .204, .143], [s * .096, .19, .128]], [.005, look.eyebrows === "thick" ? .012 : .008, .004], hair);
    if (look.accessory.includes("glasses")) {
      face.add(new THREE.TorusGeometry(.043, .006, 5, 14).scale(1, look.accessory === "glasses" ? .70 : 1, 1), ink, [s * .066, .154, .154]);
      face.rod([s * .11, .16, .15], [s * .164, .143, .018], .005, ink);
    }
    if (look.accessory === "earrings") face.add(new THREE.TorusGeometry(.018, .005, 5, 12), "#c99a4b", [s * .178, .077, .013]);
  }
  if (look.accessory.includes("glasses")) face.rod([-.024, .162, .158], [.024, .162, .158], .005, ink);
  face.ball([0, .111, .155], look.nose === "wide" ? .031 : .024, skin, [1, .9, 1]);
  face.sweep([[-.05, .058, .131], [0, look.mouth === "calm" ? .056 : .046, .145], [.05, .06, .131]], [.004, .006, .003], "#885c53");
  if (look.facialHair === "beard" || look.facialHair === "stubble") face.sweep([[-.139, .093, .065], [-.114, .034, .104], [0, -.016, .115], [.114, .035, .104], [.139, .093, .065]], [.012, .024, look.facialHair === "beard" ? .049 : .019, .024, .012], hair);
  if (look.facialHair === "moustache" || look.facialHair === "beard") face.sweep([[-.065, .076, .134], [-.026, .082, .148], [0, .078, .152], [.026, .082, .148], [.065, .076, .134]], [.005, .011, .008, .011, .005], hair);
  if (look.hair !== "bald") {
    const vol = look.hair === "afro" ? 1.27 : look.hair === "buzz" ? .98 : 1.06;
    face.add(new THREE.SphereGeometry(.17, 20, 10, 0, Math.PI * 2, 0, Math.PI * .56).scale(vol, vol, .94 * vol), hair, [0, .208, -.009]);
    if (["bob", "long", "braids", "ponytail", "bun"].includes(look.hair)) {
      face.ball([0, .143, -.094], .14, hair, [1.15, look.hair === "long" ? 1.6 : 1.06, .70]);
      if (look.hair === "bun" || look.hair === "ponytail") face.ball([0, look.hair === "bun" ? .293 : .105, -.18], .087, hair, [.85, look.hair === "ponytail" ? 1.6 : .9, 1]);
      if (look.hair === "braids") for (const s of [-1, 1]) for (let i = 0; i < 5; i++) face.ball([s * .14, .16 - i * .045, -.055], .039 - i * .003, hair);
    }
    if (look.hair === "afro" || look.hair === "curls") for (let i = 0; i < 18; i++) {
      const angle = i * Math.PI * 2 / 18;
      face.ball([Math.cos(angle) * .142, .24 + .033 * Math.sin(angle * 4), Math.sin(angle) * .136], look.hair === "afro" ? .07 : .047, hair);
    }
    if (look.hair === "quiff" || look.hair === "mohawk") face.ball([0, .319, .037], .099, hair, [look.hair === "mohawk" ? .55 : 1.06, .83, 1.32]);
  }
  face.finish("custom-face-hair-and-accessories", head, material);

  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(), knee = new THREE.Group(), ankle = new THREE.Group();
    hip.position.set(s * .105, .79, 0);
    knee.position.y = -.35;
    ankle.position.y = -.35;
    object.add(hip);
    hip.add(knee);
    knee.add(ankle);
    const upper = new Assembly(), lower = new Assembly(), boot = new Assembly();
    upper.add(turned([[0, -.37], [.081, -.35], [.092, -.21], [.108, -.04], [.098, .03], [0, .05]], .91), trousers);
    if (look.bottom === "cargo") upper.box([s * .085, -.20, .018], [.05, .095, .085], trousers);
    const bare = look.bottom === "shorts" || look.bottom === "skirt";
    lower.add(turned([[0, -.35], [.057, -.35], [.065, -.24], [.078, -.13], [.083, -.04], [.065, .026], [0, .03]], .91), bare ? skin : trousers);
    if (look.shoes === "boots" || look.shoes === "high-tops") boot.add(turned([[.064, -.02], [.077, .0], [.075, .13], [.064, .145]], .92), shoe);
    boot.ball([0, -.039, .051], .094, shoe, [.88, .54, 1.59]);
    boot.ball([0, -.074, .055], .097, "#473f35", [.9, .18, 1.6]);
    for (const z of [.059, .095]) boot.rod([-.045, .001, z], [.046, .001, z], .006, "#ccbda5");
    upper.finish("trouser-leg", hip, material);
    lower.finish("calf-and-cuff", knee, material);
    boot.finish("shoe-and-sole", ankle, material);
    return { hip, knee, ankle };
  });
  const gait = createVillageCharacterGait({ left: legs[0], right: legs[1], upperLength: .35, lowerLength: .35, soleHeight: .09 });
  const upperArms = createCharacterLimbs(torso, 2, shirt, "sleeve");
  const forearms = createCharacterLimbs(torso, 2, ["hoodie", "jacket"].includes(look.top) ? shirt : skin, "forearm");
  const hands = [-1, 1].map(s => {
    const hand = new THREE.Group();
    hand.name = s > 0 ? "working-hand" : "supporting-hand";
    torso.add(hand);
    const art = new Assembly();
    art.ball([0, 0, 0], .053, skin, [.78, 1, .67]);
    art.ball([-s * .032, .011, .024], .02, skin);
    for (let i = 0; i < 4; i++)art.ball([(i - 1.5) * .017, -.043, .011], .016, skin, [.63, 1.4, .72]);
    art.finish("palm-and-fingers", hand, material);
    return hand;
  });
  const props = new Map<Gesture | "jar", THREE.Mesh>();
  function tool(kind: Gesture | "jar", build: (a: Assembly) => void) {
    const a = new Assembly();
    build(a);
    const m = a.finish(kind, hands[1], material);
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
  object.add(broom);
  const shaftArt = new Assembly();
  shaftArt.rod([0, 0, 0], [0, 1.26, 0], .018, "#b88959");
  shaftArt.rod([0, 1.13, 0], [0, 1.28, 0], .022, "#387769");
  const shaft = shaftArt.finish("broom-handle", broom, material);
  shaft.position.y = .125;
  const up = new THREE.Vector3(0, 1, 0), shaftDirection = new THREE.Vector3(), gripPoint = new THREE.Vector3(), torsoInverse = new THREE.Matrix4();
  tool("spread", a => {
    a.rod([0, 0, -.045], [0, -.025, .13], .024, "#a77749");
    a.ball([0, -.028, .19], .10, "#9eafa4", [.84, .31, 1.25]);
    a.ball([0, .006, .19], .077, "#744d33", [.91, .48, 1.15]);
  });
  const grains = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.024), new THREE.MeshStandardMaterial(), 9);
  grains.name = "falling-input";
  grains.frustumCulled = false;
  object.add(grains);
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
  // The room bakes the static furniture shadow map. A moving worker must not
  // leave that map stamped at their previous station.
  object.traverse(node => { node.castShadow = false; });
  const shadowGeometry = new THREE.RingGeometry(.004, .30, 20, 4);
  const shadowPosition = shadowGeometry.getAttribute("position");
  const shade = new Float32Array(shadowPosition.count * 4);
  for (let i = 0; i < shadowPosition.count; i++) {
    const radius = Math.hypot(shadowPosition.getX(i), shadowPosition.getY(i)) / .30;
    shade.set([.085, .095, .06, .31 * (1 - Math.min(1, radius)) ** .8], i * 4);
  }
  shadowGeometry.setAttribute("color", new THREE.BufferAttribute(shade, 4));
  const shadow = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.y = .76;
  shadow.position.set(0, .013, .02);
  object.add(shadow);
  const resources = characterDisposer(object);
  const cropHandHeight = [-.04, .035, .16, .29, .41, .36];
  function pose(distance: number, walking: number, gesture: Gesture | null, phase: number, stage: number | null, deviceCode?: string) {
    const stride = distance * VILLAGE_CHARACTER_STRIDE_PER_METER;
    const reach = gesture ? Math.sin(Math.PI * phase) ** .72 : 0;
    const work = reach * Math.sin(phase * Math.PI * 4);
    const jarTray = gesture === "store" && deviceCode === "LP-SUPER-1L";
    const barrel = gesture === "store" && (deviceCode === "CURTEC-60L" || deviceCode === "SIM-STORAGE-03");
    const spreading = gesture === "spread", pouring = gesture === "pour";
    const low = jarTray || gesture === "water" || gesture === "pbi" || spreading || pouring || ((gesture === "inspect" || gesture === "tend") && (stage ?? 2) <= 1);
    const bend = low ? .38 : gesture === "harvest" ? .18 : .10;
    const crouch = reach * (low ? .105 : .024);
    torso.position.y = .79 + gait(stride, walking) - crouch;
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
    torso.rotation.x = reach * bend;
    const sweeping = gesture === "sweep";
    const stroke = Math.sin(phase * Math.PI * 6);
    torso.rotation.y = sweeping ? stroke * .20 * reach : .038 * walking * Math.sin(stride);
    head.rotation.x = reach * (low ? .39 : gesture === "dry" ? -.14 : .13);
    const held = jarTray ? "jar" : barrel ? null : pouring ? "water" : gesture;
    for (const [kind, mesh] of props) mesh.visible = held === kind && reach > .12 && (kind !== "pbi" || phase < .55);
    if (sweeping) {
      broom.position.set(.02 + stroke * .34 * reach, 0, .49 + .05 * Math.cos(phase * Math.PI * 6));
      shaftDirection.set(-.09 - broom.position.x * .57, 1.09, .12 - broom.position.z).normalize();
      shaft.quaternion.setFromUnitVectors(up, shaftDirection);
      torso.updateMatrix();
      torsoInverse.copy(torso.matrix).invert();
    }
    const goalY = gesture === "dry" ? .34 : gesture === "water" || pouring || spreading ? -.13 : gesture === "pbi" || jarTray ? -.23 : barrel ? .064 : gesture === "store" ? .13
      : gesture === "repair" ? .34 : gesture === "dice" || gesture === "card" ? .13 : cropHandHeight[stage ?? 2] ?? .16;
    const supporting = gesture === "harvest" || gesture === "tend" ? .83 : .20;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, hand = hands[i], swing = Math.sin(stride + i * Math.PI) * walking;
      const grip = i || gesture === "dry" || gesture === "store" ? reach : reach * supporting;
      let handX = s * (.234 - grip * (gesture === "store" || gesture === "harvest" ? .10 : .034)) + (gesture === "harvest" && i ? work * .043 : 0);
      let handY = -.045 + grip * (goalY + .045) + work * (gesture === "dry" ? .040 * s : .022);
      let handZ = .06 + swing * .136 + grip * (jarTray || gesture === "pbi" ? .45 : low ? .31 : .38) + (gesture === "dice" || (spreading && i) ? work * .11 : 0);
      if (sweeping) {
        gripPoint.copy(broom.position).add(shaft.position).addScaledVector(shaftDirection, i ? .64 : .98).applyMatrix4(torsoInverse);
        handX = gripPoint.x; handY = gripPoint.y; handZ = gripPoint.z;
      } else if (spreading && i) handX += work * .14;
      const elbowX = s * (.257 + grip * .038), elbowY = .19 + grip * (goalY * .57 - .06), elbowZ = -.01 + swing * .072 + grip * .16;
      upperArms.set(i, s * .21, .401, 0, elbowX, elbowY, elbowZ, .077);
      forearms.set(i, elbowX, elbowY, elbowZ, handX, handY + .027, handZ, .055);
      hand.position.set(handX, handY, handZ);
      hand.rotation.x = pouring ? .72 * reach : spreading ? work * .56 : gesture === "water" ? -.9 * reach + work * .23 : -.28 * grip;
      hand.rotation.z = gesture === "repair" ? work * .52 : gesture === "harvest" ? work * .16 : 0;
    }
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
  pose(0, 0, null, 0, null);
  return { object, pose, dispose: () => {
    grains.dispose();
    resources.dispose();
  } };
}
