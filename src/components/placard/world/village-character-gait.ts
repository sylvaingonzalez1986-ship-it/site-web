import type { Object3D } from "three";

const TURN = Math.PI * 2;
export const VILLAGE_CHARACTER_STRIDE_PER_METER = 7.4;

type Leg = { hip: Object3D; knee: Object3D; ankle: Object3D };

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

/** The pivot chain points down at rest. The ankle rotates the sole back to level. */
export function createVillageCharacterGait({ left, right, upperLength, lowerLength, soleHeight }: {
  left: Leg; right: Leg; upperLength: number; lowerLength: number; soleHeight: number;
}) {
  const legs = [left, right];
  const restHips = legs.map(leg => leg.hip.position.y);
  const stance = 0.59;
  const cycleLength = TURN / VILLAGE_CHARACTER_STRIDE_PER_METER;
  const reach = upperLength + lowerLength - 0.003;
  const feetTravel = [0, 0], feetHeight = [0, 0];

  return (stride: number, amount: number, groundY = 0) => {
    let pelvisY = 0;
    for (let i = 0; i < legs.length; i++) {
      const phase = villageFootPhase(stride, i / 2);
      const travel = villageFootTravel(phase, stance, cycleLength) * amount;
      const ankleY = groundY + soleHeight + villageFootLift(phase, stance) * 0.078 * amount;
      feetTravel[i] = travel;
      feetHeight[i] = ankleY;
      pelvisY = Math.min(pelvisY, ankleY + Math.sqrt(reach * reach - travel * travel) - restHips[i]);
    }

    for (let i = 0; i < legs.length; i++) {
      const { hip, knee, ankle } = legs[i];
      hip.position.y = restHips[i] + pelvisY;
      const vertical = hip.position.y - feetHeight[i], forward = feetTravel[i];
      const cosine = (vertical * vertical + forward * forward - upperLength * upperLength - lowerLength * lowerLength) / (2 * upperLength * lowerLength);
      knee.rotation.x = Math.acos(Math.max(-1, Math.min(1, cosine)));
      hip.rotation.x = Math.atan2(-forward, vertical) - Math.atan2(lowerLength * Math.sin(knee.rotation.x), upperLength + lowerLength * Math.cos(knee.rotation.x));
      ankle.rotation.x = -hip.rotation.x - knee.rotation.x;
    }
    return pelvisY;
  };
}
