import * as THREE from "three";
import { villageFootLift, villageFootPhase, villageFootTravel } from "./village-character-gait";
import { approachVillageValue, villageAngleDifference, villageApproachSpeed } from "./village-character-motion";
import type { VillageLifeController } from "./village-life-types";
import { createVillageSheepBatch, SHEEP_HIPS } from "./village-sheep-art";
import { VILLAGE_SHEEP_PASTURE } from "./village-sheep-pasture";
import { disposeVillageObject } from "./village-terrain";
import type { VillageGrazingSurface } from "./village-walk-surface";

type Point = { x: number; z: number };
type Activity = "grazing" | "watching" | "walking";
type Foot = { point: THREE.Vector3; from: THREE.Vector3; landing: THREE.Vector3; lift: number; swinging: boolean };
const FLOCK = [
  { x: -14.78, z: 5.22, yaw: -0.77, scale: 0.95, state: "grazing", duration: 5.7 },
  { x: -12.77, z: 5.71, yaw: 0.48, scale: 1.04, state: "watching", duration: 2.6 },
  { x: -11.13, z: 5.05, yaw: 2.22, scale: 0.9, state: "grazing", duration: 8.4 },
] as const;
const CYCLE = 0.39, STANCE = 0.78, TURN = Math.PI * 2;
const FOOTFALLS = [0, 0.5, 0.75, 0.25];
const { minX, maxX, minZ, maxZ } = VILLAGE_SHEEP_PASTURE;
const insidePasture = (x: number, z: number) => x >= minX && x <= maxX && z >= minZ && z <= maxZ;

function makeSheep(spec: typeof FLOCK[number], index: number, surface: VillageGrazingSurface) {
  const root = new THREE.Group();
  const id = `sheep-${index + 1}`;
  root.name = `village-animal-${id}`;
  const { scale, x, z } = spec;
  const clearance = 0.89 * scale;
  root.rotation.y = spec.yaw;
  root.position.set(x, surface.heightAt(x, z), z);
  root.visible = surface.isGrazable(x, z, clearance);
  const feet = SHEEP_HIPS.map((): Foot => ({
    point: new THREE.Vector3(), from: new THREE.Vector3(), landing: new THREE.Vector3(), lift: 0, swinging: false,
  }));
  let seed = 1381 + index * 6927;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  Object.assign(root.userData, {
    id, species: "sheep", active: root.visible, radius: clearance, position: [x, z], visible: root.visible,
    state: spec.state, detail: "low", speed: 0, headPitch: 0, jawPitch: 0, earAngles: [0, 0], groundedFeet: 4,
  });
  return {
    root, feet, scale, clearance, random, home: spec, bob: 0,
    state: spec.state as Activity, time: index * 0.93, remaining: spec.duration as number, speed: 0, stride: 0, target: null as Point | null,
    headPitch: spec.state === "grazing" ? 1.42 : 0.07, headYaw: 0, jawPitch: 0, earAngles: [0.17, -0.17] as [number, number],
  };
}

type Sheep = ReturnType<typeof makeSheep>;

function hoofHome(sheep: Sheep, index: number, lead: number, out: THREE.Vector3) {
  const [side, front] = SHEEP_HIPS[index], { position, rotation } = sheep.root;
  const x = side * sheep.scale, z = front * sheep.scale + lead;
  const sin = Math.sin(rotation.y), cos = Math.cos(rotation.y);
  return out.set(position.x + x * cos + z * sin, position.y, position.z + z * cos - x * sin);
}

function plantFeet(sheep: Sheep, surface: VillageGrazingSurface) {
  for (let i = 0; i < sheep.feet.length; i++) {
    const foot = sheep.feet[i];
    hoofHome(sheep, i, 0, foot.point);
    foot.point.y = surface.heightAt(foot.point.x, foot.point.z);
    foot.lift = 0;
    foot.swinging = false;
  }
}

/** Phase uses actual travel plus the short stepping arc during a turn. Stance
 * keeps its point in the terrain's frame until the next swing. */
function poseFeet(sheep: Sheep, surface: VillageGrazingSurface, travel: number, dt: number) {
  if (!travel) {
    for (const foot of sheep.feet) {
      if (!foot.lift) continue;
      const floor = foot.point.y - foot.lift;
      foot.lift = Math.max(0, foot.lift - dt * 0.45);
      foot.point.y = floor + foot.lift;
      if (!foot.lift) foot.swinging = false;
    }
    return;
  }
  const cycle = CYCLE * sheep.scale;
  sheep.stride = (sheep.stride + travel / cycle * TURN) % TURN;
  for (let i = 0; i < sheep.feet.length; i++) {
    const foot = sheep.feet[i], phase = villageFootPhase(sheep.stride, FOOTFALLS[i]);
    if (phase > STANCE) {
      if (!foot.swinging) { foot.from.copy(foot.point); foot.swinging = true; }
      const progress = (phase - STANCE) / (1 - STANCE);
      const lead = villageFootTravel(0, STANCE, cycle) * Math.min(1, sheep.speed / 0.23);
      hoofHome(sheep, i, lead, foot.landing);
      foot.point.lerpVectors(foot.from, foot.landing, progress * progress * (3 - 2 * progress));
      foot.lift = villageFootLift(phase, STANCE) * 0.078 * sheep.scale;
      foot.point.y = surface.heightAt(foot.point.x, foot.point.z) + foot.lift;
    } else if (foot.swinging) {
      foot.point.copy(foot.landing);
      foot.point.y = surface.heightAt(foot.point.x, foot.point.z);
      foot.lift = 0;
      foot.swinging = false;
    }
  }
}

function clearOfFlock(flock: Sheep[], sheep: Sheep, from: Point, target: Point) {
  const dx = target.x - from.x, dz = target.z - from.z, lengthSquared = dx ** 2 + dz ** 2;
  return flock.every(other => {
    if (other === sheep || !other.root.visible) return true;
    const { x, z } = other.root.position;
    const t = lengthSquared ? THREE.MathUtils.clamp(((x - from.x) * dx + (z - from.z) * dz) / lengthSquared, 0, 1) : 0;
    const gap = 0.65 * (sheep.scale + other.scale);
    return Math.hypot(x - from.x - dx * t, z - from.z - dz * t) >= gap;
  });
}

/** The strip in front of the farm's west wing is readable from both overview
 * and farm selection. Movement is limited to its grass and checked against
 * the generated paths, aprons, garden beds and solid props. */
function pickTarget(sheep: Sheep, flock: Sheep[], surface: VillageGrazingSurface): Point | null {
  const p = sheep.root.position;
  for (let attempt = 0; attempt < 12; attempt++) {
    const dx = (sheep.random() - 0.5) * 3.2, dz = (sheep.random() - 0.5) * 1.72;
    const x = p.x + dx, z = p.z + dz, length = Math.hypot(dx, dz);
    if (length < 0.48 || Math.abs(x - sheep.home.x) > 1.42 || !insidePasture(x, z)) continue;
    const target = { x, z };
    if (!clearOfFlock(flock, sheep, p, target)) continue;
    const steps = Math.ceil(length / 0.085);
    let clear = true;
    for (let i = 1; i <= steps; i++) {
      if (!surface.isGrazable(p.x + dx * i / steps, p.z + dz * i / steps, sheep.clearance)) { clear = false; break; }
    }
    if (clear) return target;
  }
  return null;
}

function graze(sheep: Sheep) {
  sheep.target = null;
  sheep.state = "grazing";
  sheep.remaining = 4.1 + sheep.random() * 5.3;
}

function updateSheep(sheep: Sheep, flock: Sheep[], surface: VillageGrazingSurface, dt: number, detail: 0 | 1) {
  const p = sheep.root.position, rotation = sheep.root.rotation;
  sheep.time += dt;
  sheep.remaining -= dt;
  if (sheep.state === "grazing" && sheep.remaining <= 0) {
    sheep.state = "watching";
    sheep.remaining = 1.45 + sheep.random() * 2.1;
  } else if (sheep.state === "watching" && sheep.remaining <= 0) {
    sheep.target = pickTarget(sheep, flock, surface);
    if (sheep.target) { sheep.state = "walking"; sheep.stride = 0; }
    else graze(sheep);
  }

  let moved = 0, turned = 0;
  const target = sheep.target;
  if (target) {
    const dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz);
    if (distance < 0.013) graze(sheep);
    else {
      const difference = villageAngleDifference(Math.atan2(dx, dz), rotation.y);
      turned = THREE.MathUtils.clamp(difference, -dt * 2.15, dt * 2.15);
      rotation.y += turned;
      const desired = Math.min(0.36 + sheep.scale * 0.065, Math.sqrt(distance * 0.9)) * (1 - THREE.MathUtils.smoothstep(Math.abs(difference), 0.15, 0.8));
      const speed = villageApproachSpeed(sheep.speed, desired, dt, 1.1, 2.6);
      const step = Math.min(distance, speed * dt);
      const x = p.x + dx / distance * step, z = p.z + dz / distance * step;
      if (step > 0 && clearOfFlock(flock, sheep, p, { x, z })) {
        p.set(x, surface.heightAt(x, z), z);
        moved = step;
      } else if (step > 0) graze(sheep);
    }
  }
  sheep.speed = moved / dt;
  const travel = moved + Math.abs(turned) * 0.45 * sheep.scale;
  poseFeet(sheep, surface, travel, dt);
  const walk = Math.min(1, travel / (dt * 0.3));
  sheep.bob += (Math.abs(Math.sin(sheep.stride * 2)) * 0.017 * walk - sheep.bob) * (1 - Math.exp(-dt * 7));
  const { state, time } = sheep;
  const bent = state === "grazing";
  const pitch = bent ? 1.43 + Math.sin(time * 5.1) * 0.04 : 0.045 + Math.sin(time * (state === "watching" ? 1.6 : 5.4)) * 0.04;
  const yaw = Math.sin(time * (bent ? 0.79 : 1.26)) * (bent ? 0.18 : state === "watching" ? 0.38 : 0.07);
  sheep.headPitch += (pitch - sheep.headPitch) * (1 - Math.exp(-dt * 4.8));
  sheep.headYaw += (yaw - sheep.headYaw) * (1 - Math.exp(-dt * 6));
  if (detail) {
    const chew = THREE.MathUtils.smoothstep(sheep.headPitch, 0.88, 1.36) * (0.02 + (1 - Math.cos(time * 15.1)) * 0.105);
    sheep.jawPitch = approachVillageValue(sheep.jawPitch, chew, dt * 2.8);
    for (let i = 0; i < 2; i++) {
      const beat = Math.max(0, Math.sin(time * (i ? 1.63 : 2.1) + i * 1.3));
      const angle = (i ? -1 : 1) * (0.15 - sheep.headPitch * 0.079 + 0.34 * beat ** 14);
      sheep.earAngles[i] += (angle - sheep.earAngles[i]) * (1 - Math.exp(-dt * 14));
    }
  }
}

export function createVillageSheep(surface: VillageGrazingSurface): VillageLifeController {
  const object = new THREE.Group();
  object.name = "village-sheep";
  const pasture = new THREE.Object3D();
  pasture.name = "village-sheep-pasture";
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
  pasture.position.set(centerX, surface.heightAt(centerX, centerZ), centerZ);
  object.add(pasture);
  const flock = FLOCK.map((spec, index) => {
    const sheep = makeSheep(spec, index, surface);
    plantFeet(sheep, surface);
    object.add(sheep.root);
    return sheep;
  });
  const batch = createVillageSheepBatch(flock.length);
  object.add(batch.object);
  const visible: Sheep[] = [];
  let disposed = false, reduced = false, detail: 0 | 1 = 0, visibility = -1;

  function render() {
    visible.forEach((sheep, index) => {
      const data = sheep.root.userData, p = sheep.root.position;
      data.state = sheep.state;
      data.position[0] = p.x; data.position[1] = p.z;
      data.speed = sheep.speed;
      data.headPitch = sheep.headPitch;
      data.jawPitch = detail ? sheep.jawPitch : 0;
      data.earAngles[0] = detail ? sheep.earAngles[0] : 0.17; data.earAngles[1] = detail ? sheep.earAngles[1] : -0.17;
      data.groundedFeet = sheep.feet.reduce((count, foot) => count + Number(foot.lift < 1e-6), 0);
      data.detail = detail ? "high" : "low";
      batch.write(index, sheep, detail);
    });
    batch.commit(visible.length, detail);
  }
  flock.forEach(sheep => { if (sheep.root.visible) visible.push(sheep); });
  render();

  return {
    object,
    update(frame) {
      if (disposed) return;
      const dt = frame.reduced ? 0 : THREE.MathUtils.clamp(Number.isFinite(frame.delta) ? frame.delta : 0, 0, 0.05);
      const fine = frame.detail ?? Number(frame.quality === "high");
      const nextDetail = fine >= (frame.quality === "low" ? 0.69 : 0.43) ? 1 : 0;
      let mask = 0;
      visible.length = 0;
      for (let i = 0; i < flock.length; i++) {
        const sheep = flock[i], shown = sheep.root.visible && frame.visible(sheep.root, 1.3);
        sheep.root.userData.visible = shown;
        if (!shown) continue;
        mask |= 1 << i;
        visible.push(sheep);
        if (dt) updateSheep(sheep, flock, surface, dt, nextDetail);
        else if (frame.reduced && (!reduced || !(visibility & (1 << i)))) {
          sheep.speed = sheep.bob = sheep.jawPitch = 0;
          plantFeet(sheep, surface);
        }
      }
      const dirty = mask !== visibility || nextDetail !== detail || (!!dt && mask !== 0) || frame.reduced !== reduced;
      visibility = mask;
      detail = nextDetail;
      reduced = frame.reduced;
      if (dirty) render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      batch.dispose();
      disposeVillageObject(object);
    },
  };
}
