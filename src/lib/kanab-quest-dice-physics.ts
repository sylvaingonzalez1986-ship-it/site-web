import { Body, Box, Plane, Vec3, World } from "cannon-es";
import { Quaternion, Vector3 } from "three";

// BoxGeometry's material order. Opposite faces of a D6 always total seven.
export const KQ_DIE_FACES = [3, 4, 1, 6, 2, 5] as const;
const normals = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0),
  new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
const up = new Vector3(0, 1, 0);
// Wrist angles with room for all three or four dice to settle flat and apart.
const castAngles = [.03125, .75, 3.5625, 4.4375, 5.25];
export const KQ_DIE_SIDE = .92;
export const KQ_DICE_HZ = 90;
export const KQ_DICE_CAST_COUNT = castAngles.length * 2;
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
    position: new Vector3((index - (values.length - 1) / 2) * 1.48, KQ_DIE_SIDE / 2, [.12, -.24, .27, -.08][index]),
    orientation: new Quaternion().setFromAxisAngle(up, [-.29, .16, -.11, .32][index]).multiply(faceRotation(value, 1)),
  }));
}

export function retargetKqDie(orientation: Quaternion, value: number) {
  return orientation.clone().multiply(faceRotation(value, readKqTopFace(orientation).face));
}

function releasePosition(index: number, count: number) {
  return new Vector3(-2.95 + 1.28 * Math.floor(index / 2), .81 + .17 * index / (count - 1), index % 2 === 0 ? -.71 : .71);
}

function castHeading(variation: number) {
  return new Quaternion().setFromAxisAngle(up, variation % 2 === 0 ? 0 : Math.PI);
}

export function gatherKqDice(count: number, variation: number) {
  const heading = castHeading(variation);
  return Array.from({ length: count }, (_, index) => releasePosition(index, count).applyQuaternion(heading))
    .sort((a, b) => a.x - b.x || a.z - b.z);
}

/** Solve actual rigid-body contacts at a fixed rate. Labels are oriented once,
 * before playback, against the saved result. Presentation never generates a face. */
export function simulateKqDice(values: number[], variation: number) {
  const world = new World({ gravity: new Vec3(0, -21, 0), allowSleep: true });
  world.defaultContactMaterial.friction = .38;
  world.defaultContactMaterial.restitution = .43;
  const surface = (position: Vec3, axis: Vec3, angle: number) => {
    const plane = new Body({ mass: 0, shape: new Plane(), position });
    plane.quaternion.setFromAxisAngle(axis, angle);
    world.addBody(plane);
    return plane;
  };
  const floor = surface(new Vec3(), new Vec3(1, 0, 0), -Math.PI / 2);
  surface(new Vec3(-3.65, 0, 0), new Vec3(0, 1, 0), Math.PI / 2);
  surface(new Vec3(3.65, 0, 0), new Vec3(0, 1, 0), -Math.PI / 2);
  surface(new Vec3(0, 0, -1.65), new Vec3(0, 1, 0), 0);
  surface(new Vec3(0, 0, 1.65), new Vec3(0, 1, 0), Math.PI);

  const angle = castAngles[Math.floor((variation >>> 0) / 2) % castAngles.length];
  const heading = castHeading(variation);
  const bodies = values.map((_, index) => {
    const lane = index % 2 === 0 ? -1 : 1;
    const twist = Math.sin(angle * (index + 1));
    const rank = index / (values.length - 1);
    const release = releasePosition(index, values.length);
    const body = new Body({
      mass: 1, shape: new Box(new Vec3(KQ_DIE_SIDE / 2, KQ_DIE_SIDE / 2, KQ_DIE_SIDE / 2)),
      position: new Vec3(release.x, release.y, release.z),
      velocity: new Vec3(2.7 + rank * 3.2 + twist * .35, 4.2 + rank * 1.15 + twist * .32, -lane * (.7 + twist * .55)),
      angularVelocity: new Vec3(lane * (3.4 + twist), 2.6 * lane + twist, -(6.4 + 2.7 * rank + twist)),
      linearDamping: .18, angularDamping: .22, sleepSpeedLimit: .12, sleepTimeLimit: .13,
    });
    body.quaternion.setFromEuler(.35 + twist * .47, lane * .34, .19 + rank * .55);
    world.addBody(body);
    return body;
  });
  const frames: KqDiePose[][] = [];
  let firstContact = 0;
  const impactPoint = new Vector3();
  for (let step = 0; step <= KQ_DICE_HZ * 4; step++) {
    frames.push(bodies.map(({ position: p, quaternion: q }) => ({
      position: new Vector3(p.x, p.y, p.z).applyQuaternion(heading),
      orientation: new Quaternion(q.x, q.y, q.z, q.w).premultiply(heading),
    })));
    if (bodies.every(body => body.sleepState === Body.SLEEPING)) break;
    world.step(1 / KQ_DICE_HZ);
    if (!firstContact) {
      const contact = world.contacts.find(hit => hit.bi === floor || hit.bj === floor);
      if (contact) {
        const offset = contact.bi === floor ? contact.ri : contact.rj;
        impactPoint.set(offset.x, 0, offset.z).applyQuaternion(heading);
        firstContact = step + 1;
      }
    }
  }
  const landed = frames[frames.length - 1];
  const order = landed.map((_, index) => index).sort((a, b) => landed[a].position.x - landed[b].position.x);
  const labels = order.map((body, index) => faceRotation(values[index], readKqTopFace(landed[body].orientation).face));
  const poses = frames.map(frame => order.map((body, index) => {
    const pose = frame[body];
    pose.orientation.multiply(labels[index]);
    return pose;
  }));
  return { frames: poses, firstContact, impactPoint };
}
