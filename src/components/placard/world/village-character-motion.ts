export function villageAngleDifference(target: number, current: number) {
  const angle = target - current;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function approachVillageValue(value: number, target: number, distance: number) {
  return value + Math.sign(target - value) * Math.min(Math.abs(target - value), distance);
}

export function villageApproachSpeed(speed: number, target: number, delta: number, accelerate: number, brake: number) {
  return approachVillageValue(speed, target, delta * (target > speed ? accelerate : brake));
}

/** Balance follows the distance actually accepted by collision and path checks. */
export function villageWalkBlend(blend: number, speed: number, delta: number) {
  return villageApproachSpeed(blend, Math.min(1, speed / 0.48), delta, 6, 5);
}
