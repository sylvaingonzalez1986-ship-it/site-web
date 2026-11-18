import { Body, Box, Plane, Vec3, World } from "cannon-es";
import { Quaternion, Vector3 } from "three";

// BoxGeometry's material order. Opposite faces of a D6 always total seven.
export const KQ_DIE_FACES = [3, 4, 1, 6, 2, 5] as const;
const normals = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0),
  new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
const up = new Vector3(0, 1, 0);
export const KQ_DIE_SIDE = .92;
export const KQ_DICE_HZ = 90;
export type KqDiePose = { position: Vector3; orientation: Quaternion };

export function readKqTopFace(orientation: Quaternion) {
  let highest = -Infinity;
  let face = 0;
  const normal = new Vector3();
  for (const [index, axis] of normals.entries()) {
    const height = normal.copy(axis).applyQuaternion(orientation).y;
    if (height > highest) { highest = height; face = KQ_DIE_FACES[index]; }
  }
  return { face, height: highest };
}

// Restrict label rotations to symmetries of a cube, including 180° turns.
// A general shortest-arc quaternion for antiparallel axes can turn the cube
// diagonally, causing its visible corners to penetrate the collision body.
function faceRotation(from: number, to: number) {
  const a = normals[KQ_DIE_FACES.indexOf(from as typeof KQ_DIE_FACES[number])];
  const b = normals[KQ_DIE_FACES.indexOf(to as typeof KQ_DIE_FACES[number])];
  return new Quaternion().setFromUnitVectors(a, b);
}

export function restKqDice(values: number[]): KqDiePose[] {
  return values.map((value, index) => ({
    position: new Vector3((index - (values.length - 1) / 2) * 1.52, KQ_DIE_SIDE / 2, index % 2 === 0 ? .15 : -.15),
    orientation: new Quaternion().setFromAxisAngle(up, [-.13, .17, -.19, .13][index]).multiply(faceRotation(value, 1)),
  }));
}

export function retargetKqDie(orientation: Quaternion, value: number) {
  return orientation.clone().multiply(faceRotation(value, readKqTopFace(orientation).face));
}

/** Solve actual rigid-body contacts at a fixed rate. Labels are oriented once,
 * before playback, against the saved result. Presentation never generates a face. */
export function simulateKqDice(values: number[], variation: number) {
  const world = new World({ gravity: new Vec3(0, -21, 0), allowSleep: true });
  world.defaultContactMaterial.friction = .46;
  world.defaultContactMaterial.restitution = .34;
  const surface = (position: Vec3, axis: Vec3, angle: number) => {
    const plane = new Body({ mass: 0, shape: new Plane(), position });
    plane.quaternion.setFromAxisAngle(axis, angle);
    world.addBody(plane);
    return plane;
  };
  const floor = surface(new Vec3(), new Vec3(1, 0, 0), -Math.PI / 2);
  surface(new Vec3(-3.6, 0, 0), new Vec3(0, 1, 0), Math.PI / 2);
  surface(new Vec3(3.6, 0, 0), new Vec3(0, 1, 0), -Math.PI / 2);
  surface(new Vec3(0, 0, -1.65), new Vec3(0, 1, 0), 0);
  surface(new Vec3(0, 0, 1.65), new Vec3(0, 1, 0), Math.PI);

  const bodies = values.map((_, index) => {
    const lane = index - (values.length - 1) / 2;
    const variant = ((variation >>> 0) % 7) / 6;
    const side = index % 2 ? -1 : 1;
    const body = new Body({
      mass: 1, shape: new Box(new Vec3(KQ_DIE_SIDE / 2, KQ_DIE_SIDE / 2, KQ_DIE_SIDE / 2)),
      position: new Vec3(lane * 1.49 - .28, 1.8 + .18 * index, -.83 + .1 * side),
      velocity: new Vec3(.6 + .28 * side, 1.15 + variant * .55, 3.4 + .24 * index),
      angularVelocity: new Vec3(7.3 + index * .8, side * (3 + variant), side * (1.9 + index * .6)),
      linearDamping: .16, angularDamping: .25, sleepSpeedLimit: .12, sleepTimeLimit: .13,
    });
    body.quaternion.setFromEuler(.2 + variant * .36, side * .26, .1 + index * .14);
    world.addBody(body);
    return body;
  });
  const frames: KqDiePose[][] = [];
  let firstContact = 0;
  for (let step = 0; step <= KQ_DICE_HZ * 4; step++) {
    frames.push(bodies.map(({ position: p, quaternion: q }) => ({
      position: new Vector3(p.x, p.y, p.z), orientation: new Quaternion(q.x, q.y, q.z, q.w),
    })));
    if (bodies.every(body => body.sleepState === Body.SLEEPING)) break;
    world.step(1 / KQ_DICE_HZ);
    if (!firstContact && world.contacts.some(contact => contact.bi === floor || contact.bj === floor)) firstContact = step + 1;
  }
  const landed = frames[frames.length - 1];
  const order = landed.map((_, index) => index).sort((a, b) => landed[a].position.x - landed[b].position.x);
  const labels = order.map((body, index) => faceRotation(values[index], readKqTopFace(landed[body].orientation).face));
  const poses = frames.map(frame => order.map((body, index) => {
    const pose = frame[body];
    pose.orientation.multiply(labels[index]);
    return pose;
  }));
  return { frames: poses, firstContact };
}
