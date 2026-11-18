import type { Object3D } from "three";
import { villageAngleDifference } from "./village-character-motion";

const TURN = Math.PI * 2;
export const VILLAGE_CHARACTER_STRIDE_PER_METER = 7.4;

type Leg = { hip: Object3D; knee: Object3D; ankle: Object3D };
export type VillageGroundHeight = (x: number, z: number) => number;
type Grounding = { root: Object3D; heightAt: VillageGroundHeight };
const STANCE = 0.59;
const CYCLE = TURN / VILLAGE_CHARACTER_STRIDE_PER_METER;
const LIFT = 0.078;
const START_PHASE = 0.25;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (t: number) => t * t * (3 - 2 * t);

export function villageFootPhase(stride: number, offset = 0) {
  const cycles = stride / TURN + offset;
  return cycles - Math.floor(cycles);
}

export function villageFootTravel(phase: number, stance: number, cycleLength: number) {
  const swing = Math.max(0, (phase - stance) / (1 - stance));
  const reset = swing * swing * (3 - 2 * swing);
  // During stance the foot retreats by the distance the root travels.
  return cycleLength * (stance / 2 - phase + reset);
}

export function villageFootLift(phase: number, stance: number) {
  const swing = Math.max(0, (phase - stance) / (1 - stance));
  const arch = 4 * swing * (1 - swing);
  return arch * arch;
}

/** World contact for live rigs. Portraits and manually sampled poses use the analytical cycle. */
function createFootContacts({ root, heightAt }: Grounding, legs: Leg[]) {
  const feet = legs.map(() => ({
    x: 0, y: 0, z: 0, fromX: 0, fromY: 0, fromZ: 0, landingX: 0, landingZ: 0, phase: 0, swingStart: STANCE,
    yaw: 0, fromYaw: 0, landingYaw: 0, localX: 0, localY: 0, localZ: 0, localYaw: 0,
  }));
  const sample = { feet, stride: 0 };
  const hipX = [NaN, NaN];
  let previousStride = NaN, phaseOrigin = 0, lastAmount = 0, rootX = 0, rootY = 0, rootZ = 0, rootYaw = 0;
  let stopping = 0, firstFoot = 0, wasMoving = false;

  return (stride: number, amount: number) => {
    const { x, y, z } = root.position;
    const yaw = root.rotation.y;
    if (stride === previousStride && amount === lastAmount && x === rootX && y === rootY && z === rootZ && yaw === rootYaw &&
        hipX[0] === legs[0].hip.position.x && hipX[1] === legs[1].hip.position.x) return sample;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const displacement = Math.hypot(x - rootX, z - rootZ);
    const advance = villageFootPhase(stride - previousStride) * CYCLE;
    const reset = !Number.isFinite(advance) || displacement > 0.19 || advance > 0.19;
    const moving = !reset && advance > 1e-6 && amount > 0;
    if (reset) stopping = 0;
    if (moving) stopping = 0;
    else if (!reset && lastAmount > 0 && stopping === 0) {
      stopping = lastAmount;
      firstFoot = feet[0].y - heightAt(feet[0].x, feet[0].z) > feet[1].y - heightAt(feet[1].x, feet[1].z) ? 0 : 1;
      for (const foot of feet) { foot.fromX = foot.x; foot.fromY = foot.y; foot.fromZ = foot.z; foot.fromYaw = foot.yaw; }
    }

    for (let i = 0; i < feet.length; i++) {
      const foot = feet[i], hip = legs[i].hip.position;
      const homeX = x + hip.x * cos + hip.z * sin;
      const homeZ = z - hip.x * sin + hip.z * cos;
      const phase = villageFootPhase(stride - phaseOrigin, i / 2);
      if (moving) {
        if (phase > STANCE) {
          if (foot.phase <= STANCE || !wasMoving) {
            foot.fromX = foot.x; foot.fromY = foot.y; foot.fromZ = foot.z; foot.fromYaw = foot.yaw;
            foot.swingStart = wasMoving ? STANCE : START_PHASE + i / 2;
          }
          const lead = CYCLE * (1 - phase + STANCE / 2);
          foot.landingX = homeX + lead * sin;
          foot.landingZ = homeZ + lead * cos;
          foot.landingYaw = yaw;
          const progress = unit((phase - foot.swingStart) / (1 - foot.swingStart));
          const swing = smooth(progress);
          const arch = 4 * progress * (1 - progress);
          foot.x = mix(foot.fromX, foot.landingX, swing);
          foot.z = mix(foot.fromZ, foot.landingZ, swing);
          foot.yaw = foot.fromYaw + villageAngleDifference(foot.landingYaw, foot.fromYaw) * swing;
          foot.y = mix(foot.fromY, heightAt(foot.landingX, foot.landingZ), swing) + LIFT * arch * arch;
        } else {
          if (foot.phase > STANCE) { foot.x = foot.landingX; foot.z = foot.landingZ; foot.yaw = foot.landingYaw; }
          foot.y = heightAt(foot.x, foot.z);
        }
      } else if (stopping > 0 && amount > 0) {
        const step = unit(2 * (1 - amount / stopping) - Number(i !== firstFoot));
        const settle = smooth(step);
        foot.x = mix(foot.fromX, homeX, settle);
        foot.z = mix(foot.fromZ, homeZ, settle);
        foot.yaw = foot.fromYaw + villageAngleDifference(yaw, foot.fromYaw) * settle;
        const gap = Math.hypot(homeX - foot.fromX, homeZ - foot.fromZ);
        const arch = Math.min(0.04, gap * 0.22) * 4 * step * (1 - step);
        foot.y = mix(foot.fromY, heightAt(homeX, homeZ), settle) + arch;
      } else {
        foot.x = homeX; foot.z = homeZ;
        foot.yaw = yaw;
        foot.y = heightAt(homeX, homeZ);
      }
      foot.y = Math.max(foot.y, heightAt(foot.x, foot.z));
      foot.phase = moving ? phase : START_PHASE + i / 2;
      const dx = foot.x - x, dz = foot.z - z;
      foot.localX = dx * cos - dz * sin - hip.x;
      foot.localZ = dx * sin + dz * cos - hip.z;
      foot.localY = foot.y - y;
      foot.localYaw = villageAngleDifference(foot.yaw, yaw);
      hipX[i] = hip.x;
    }
    if (!moving) phaseOrigin = stride - START_PHASE * TURN;
    if (amount === 0) stopping = 0;
    rootX = x; rootY = y; rootZ = z; rootYaw = yaw;
    previousStride = stride; lastAmount = amount; wasMoving = moving;
    if (moving) sample.stride = stride - phaseOrigin;
    else if (amount === 0) sample.stride = START_PHASE * TURN;
    return sample;
  };
}

/** The pivot chain points down at rest. The ankle rotates the sole back to level. */
export function createVillageCharacterGait({ left, right, upperLength, lowerLength, soleHeight, ground }: {
  left: Leg; right: Leg; upperLength: number; lowerLength: number; soleHeight: number; ground?: Grounding;
}) {
  const legs = [left, right];
  const restHips = legs.map(leg => leg.hip.position.y);
  const contacts = ground && createFootContacts(ground, legs);
  const reach = upperLength + lowerLength - 0.003;
  const targets = legs.map(() => ({ lateral: 0, forward: 0, y: 0 }));
  const shoeYaw = legs.map(leg => leg.ankle.rotation.y);
  const lastYaw = [...shoeYaw];

  function pose(stride: number, amount: number, groundY = 0) {
    const walking = unit(amount);
    const grounded = contacts?.(stride, walking);
    pose.stride = grounded?.stride ?? stride;
    // A brief dip as the load passes from heel to heel keeps the hips from
    // hanging at a constant height during the double-support portion.
    const transfer = (1 + Math.cos(pose.stride * 2 - (STANCE - 0.5) * TURN)) * 0.5;
    let pelvisY = -0.016 * walking * transfer ** 3;
    for (let i = 0; i < legs.length; i++) {
      const phase = villageFootPhase(stride, i / 2);
      const contact = grounded?.feet[i], target = targets[i];
      const lateral = contact?.localX ?? 0;
      const forward = contact?.localZ ?? villageFootTravel(phase, STANCE, CYCLE) * walking;
      const horizontal = Math.hypot(lateral, forward);
      const scale = horizontal > reach * 0.81 ? reach * 0.81 / horizontal : 1;
      target.lateral = lateral * scale;
      target.forward = forward * scale;
      target.y = soleHeight + (contact?.localY ?? (groundY + villageFootLift(phase, STANCE) * LIFT * walking));
      pelvisY = Math.min(pelvisY, target.y + Math.sqrt(reach ** 2 - (horizontal * scale) ** 2) - restHips[i]);
    }

    for (let i = 0; i < legs.length; i++) {
      const { hip, knee, ankle } = legs[i];
      const { lateral, forward, y } = targets[i];
      hip.position.y = restHips[i] + pelvisY;
      const height = hip.position.y - y;
      const vertical = Math.hypot(height, lateral);
      const roll = Math.atan2(lateral, height);
      const cosine = (vertical * vertical + forward * forward - upperLength * upperLength - lowerLength * lowerLength) / (2 * upperLength * lowerLength);
      knee.rotation.x = Math.acos(Math.max(-1, Math.min(1, cosine)));
      const pitch = Math.atan2(-forward, vertical) - Math.atan2(lowerLength * Math.sin(knee.rotation.x), upperLength + lowerLength * Math.cos(knee.rotation.x));
      hip.rotation.set(pitch, 0, roll, "ZXY");
      // Wardrobe fittings can change the neutral toe-out while the gait holds a turn.
      if (ankle.rotation.y !== lastYaw[i]) shoeYaw[i] = ankle.rotation.y;
      lastYaw[i] = shoeYaw[i] + (grounded?.feet[i].localYaw ?? 0);
      ankle.rotation.set(-pitch - knee.rotation.x, lastYaw[i], -roll, "XZY");
    }
    return pelvisY;
  }
  pose.stride = 0;
  return pose;
}
