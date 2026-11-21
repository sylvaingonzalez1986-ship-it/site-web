import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paintingToGround, VILLAGE_SEA_LEVEL } from "./village-layout";
import type { VillageLifeController, VillageLifeFrame } from "./village-life-types";

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const smoothstep = THREE.MathUtils.smoothstep;
type Point = readonly [number, number];

function seaLoop(name: string, period: number, phase: number, altitude: number, points: readonly Point[]) {
  const curve = new THREE.CatmullRomCurve3(points.map(([px, py]) => {
    const [x, z] = paintingToGround(px, py);
    return new THREE.Vector3(x, 0, z);
  }), true, "centripetal");
  curve.arcLengthDivisions = 480;
  return { name, period, phase, altitude, curve, length: curve.getLength() };
}

// Painting-space coordinates keep the loops legible against the island outline.
// The channel lies between the island and the mainland, west of the lighthouse.
const routes = [
  seaLoop("channel", 26, .12, 2.8, [
    [60, -140], [350, -138], [660, -75], [975, 12], [1170, 21], [1230, -36],
    [1080, -49], [785, -104], [620, -135], [480, -175], [190, -208], [28, -216], [-96, -208],
    [-141, -176], [-75, -146],
  ]),
  seaLoop("western-cove", 27, .13, 1.72, [
    [-185, 112], [-192, 335], [-232, 560], [-214, 815], [-87, 1040], [-240, 1085],
    [-378, 870], [-420, 600], [-367, 323], [-320, 145],
  ]),
  seaLoop("eastern-headland", 25, .24, 2.3, [
    [1570, 172], [1715, 402], [1695, 611], [1760, 739], [1900, 725],
    [1950, 515], [1845, 275], [1680, 153],
  ]),
];

const birds = [
  { route: routes[0], rank: -1, height: -.28, phase: .4, size: .95 },
  { route: routes[0], rank: 0, height: .48, phase: 1.9, size: .82 },
  { route: routes[0], rank: 1, height: .08, phase: 4.2, size: 1.02 },
  { route: routes[1], rank: -1, height: .32, phase: 1.1, size: .9 },
  { route: routes[1], rank: 0, height: .04, phase: 3.7, size: 1.05 },
  { route: routes[1], rank: 1, height: -.24, phase: 5.6, size: .86 },
  { route: routes[2], rank: -.75, height: -.21, phase: 2.2, size: 1.01 },
  { route: routes[2], rank: .75, height: .25, phase: 4.8, size: .87 },
];

function flightPosition(bird: typeof birds[number], time: number, point: THREE.Vector3) {
  const { route, rank, phase, height } = bird;
  const bunching = (1 + Math.cos(time * TAU / 19 + route.phase * TAU)) / 2;
  const spacing = 5 - 2.45 * bunching;
  const drift = .29 * Math.sin(time * .46 + phase);
  const progress = THREE.MathUtils.euclideanModulo(route.phase + time / route.period + (rank * spacing + drift) / route.length, 1);
  route.curve.getPointAt(progress, point);
  point.x += .22 * Math.sin(time * .57 + phase);
  point.z += .26 * Math.cos(time * .53 + phase);
  point.y = VILLAGE_SEA_LEVEL + route.altitude + height + .24 * Math.sin(time * .55 + phase) + .19 * Math.sin(progress * TAU);
  return point;
}

const cream = "#fff9e9";
const paleGrey = "#d1d4cf";
const grey = "#a6b3b5";
const ink = "#293940";
const gold = "#eac15a";

function paint(geometry: THREE.BufferGeometry, color: string) {
  const tint = new THREE.Color(color);
  const colors = new Float32Array(geometry.getAttribute("position").count * 3);
  for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.deleteAttribute("uv");
  return geometry;
}

function gullBody() {
  const ovoid = (x: number, y: number, z: number) => new THREE.SphereGeometry(1, 8, 5).scale(x, y, z);
  const parts = [
    paint(ovoid(.133, .122, .29), cream),
    paint(ovoid(.103, .108, .134).translate(0, .065, .227), cream),
    paint(ovoid(.133, .032, .168).translate(0, .072, -.079), paleGrey),
    paint(ovoid(.142, .028, .144).translate(0, -.009, -.28), cream),
    paint(new THREE.ConeGeometry(.043, .156, 6).rotateX(Math.PI / 2).scale(.92, .65, 1).translate(0, .055, .353), gold),
    ...[-1, 1].map(side => paint(ovoid(.018, .021, .022).translate(side * .086, .101, .282), ink)),
  ];
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return geometry;
}

type WingSection = readonly [x: number, front: number, back: number, thickness: number];

/** A narrow airfoil with separate pigment strips for the wing coverts and primaries. */
function gullWing(sections: readonly WingSection[], tints: readonly (readonly [front: string, coverts: string, trailing: string])[]) {
  const positions: number[] = [], colors: number[] = [];
  const texture = new THREE.Color();
  const ribs = sections.map(([x, front, back, thickness]) => {
    const chord = front - back;
    return [[x, 0, front], [x, thickness, front - chord * .3], [x, thickness * .65, front - chord * .62], [x, 0, back],
      [x, -thickness * .65, front - chord * .62], [x, -thickness, front - chord * .3]];
  });
  const triangle = (a: number[], b: number[], c: number[], color: string) => {
    texture.set(color);
    positions.push(...a, ...b, ...c);
    for (let j = 0; j < 3; j++) colors.push(texture.r, texture.g, texture.b);
  };
  const stripes = [0, 1, 2, 2, 1, 0] as const;
  for (let i = 1; i < sections.length; i++) {
    for (let face = 0; face < 6; face++) {
      const next = (face + 1) % 6;
      const near = ribs[i - 1], far = ribs[i];
      const color = tints[i - 1][stripes[face]];
      triangle(near[face], far[face], near[next], color);
      triangle(near[next], far[face], far[next], color);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createVillageGulls(): VillageLifeController {
  const object = new THREE.Group();
  object.name = "village-gulls";
  object.userData = { decorative: true, birds: birds.length, drawCalls: 3 };
  const anchors = new THREE.Group();
  anchors.name = "gull-flight-poses";
  object.add(anchors);
  const poses = birds.map((bird, index) => {
    const pose = new THREE.Object3D();
    pose.name = `gull-flight-${index + 1}`;
    pose.scale.setScalar(bird.size);
    pose.userData = { route: bird.route.name, bank: 0, wing: 0, glide: true };
    pose.rotation.order = "YXZ";
    anchors.add(pose);
    return pose;
  });

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .89 });
  const batch = (name: string, geometry: THREE.BufferGeometry, capacity: number) => {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = name;
    mesh.frustumCulled = false; // The per-bird visibility check fills a compact prefix.
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.raycast = () => {};
    object.add(mesh);
    return mesh;
  };
  const body = batch("gull-flight-body", gullBody(), birds.length);
  const hinge = .49;
  const inner = batch("gull-flight-inner-wings", gullWing([
    [-.035, .155, -.14, .029], [.19, .192, -.249, .047], [hinge, .13, -.178, .026],
  ], [[paleGrey, grey, cream], [paleGrey, grey, cream]]), birds.length * 2);
  const outer = batch("gull-flight-outer-wings", gullWing([
    [0, .132, -.183, .027], [.16, .07, -.222, .019], [.275, -.008, -.254, .014], [.35, -.086, -.232, .009],
    [.38, -.12, -.224, .006], [.41, -.154, -.214, .004], [.43, -.19, -.193, .001],
  ], [[paleGrey, grey, grey], [grey, grey, ink], [grey, ink, ink], [ink, cream, ink], [ink, ink, ink], [ink, ink, ink]]), birds.length * 2);

  const before = new THREE.Vector3(), after = new THREE.Vector3(), shoulder = new THREE.Object3D();
  const shoulderMatrix = new THREE.Matrix4(), wrist = new THREE.Matrix4(), wristMatrix = new THREE.Matrix4();
  const h = .05;
  let lastTime = -Infinity;
  let lastDetail = -1;
  let lastReduced = false;
  let disposed = false;
  const lastVisibility = poses.map(() => false);

  function update(frame: VillageLifeFrame) {
    if (disposed) return;
    const time = frame.reduced ? 0 : frame.time;
    const detail = frame.reduced || frame.quality === "low" ? 0 : clamp(frame.detail ?? 1, 0, 1);
    let count = 0;
    let dirty = time !== lastTime || detail !== lastDetail || frame.reduced !== lastReduced;
    birds.forEach((bird, index) => {
      const pose = poses[index];
      if (time !== lastTime) flightPosition(bird, time, pose.position);
      pose.visible = frame.visible(pose, 1.2 * bird.size);
      dirty ||= pose.visible !== lastVisibility[index];
      lastVisibility[index] = pose.visible;
    });
    if (!dirty) return;
    birds.forEach((bird, index) => {
      const pose = poses[index];
      if (!pose.visible) return;
      flightPosition(bird, time - h, before);
      flightPosition(bird, time + h, after);
      const dx = after.x - before.x, dy = after.y - before.y, dz = after.z - before.z;
      const speedSquared = dx * dx + dz * dz;
      const yaw = Math.atan2(dx, dz);
      const pitch = -Math.atan2(dy, Math.sqrt(speedSquared));
      const bank = clamp(1.4 * (dx * (after.z + before.z - 2 * pose.position.z) - dz * (after.x + before.x - 2 * pose.position.x)) / speedSquared / h, -.55, .55);
      // The envelope eases into bursts, giving long, continuous patches of gliding.
      const burst = smoothstep(Math.cos(time * TAU / (3.5 + bird.phase * .24) + bird.phase), .12, .8);
      const cycle = time * TAU * (2.25 + .1 * bird.phase) + bird.phase;
      const flap = frame.reduced ? 0 : burst * Math.sin(cycle);
      const shoulderAngle = .075 + (.32 + .28 * detail) * flap;
      const wristAngle = -.075 + (detail > 0 ? .22 * burst * Math.sin(cycle - .85) * detail : 0);
      pose.rotation.set(pitch, yaw, bank);
      pose.updateMatrix();
      pose.userData.bank = bank;
      pose.userData.wing = shoulderAngle;
      pose.userData.glide = frame.reduced || burst < .05;
      body.setMatrixAt(count, pose.matrix);
      for (let side = 1; side >= -1; side -= 2) {
        const slot = count * 2 + Number(side < 0);
        shoulder.position.set(side * .105, .028, 0);
        shoulder.rotation.z = side * shoulderAngle + (side < 0 ? Math.PI : 0);
        shoulder.updateMatrix();
        wrist.makeRotationZ(side * wristAngle).setPosition(hinge, 0, 0);
        shoulderMatrix.multiplyMatrices(pose.matrix, shoulder.matrix);
        wristMatrix.multiplyMatrices(shoulderMatrix, wrist);
        inner.setMatrixAt(slot, shoulderMatrix);
        outer.setMatrixAt(slot, wristMatrix);
      }
      count++;
    });
    body.count = count;
    inner.count = outer.count = count * 2;
    for (const mesh of [body, inner, outer]) mesh.instanceMatrix.needsUpdate = count > 0;
    lastTime = time;
    lastDetail = detail;
    lastReduced = frame.reduced;
  }

  update({ time: 0, delta: 0, reduced: true, quality: "high", visible: () => true });
  return { object, update, dispose() {
    if (disposed) return;
    disposed = true;
    for (const mesh of [body, inner, outer]) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    material.dispose();
    object.clear();
  } };
}
