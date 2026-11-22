import * as THREE from "three";
import { characterDisposer, characterMaterial } from "./village-character-art";
import { createCharacterContactShadow } from "./village-contact-shadow";
import { VILLAGE_KORRIGAN_GLADE } from "./village-layout";
import { createKorriganModel, KORRIGAN_HIP_X, KORRIGAN_HIP_Y, KORRIGAN_PALETTES, KORRIGAN_SHIN, KORRIGAN_SOLE, KORRIGAN_THIGH } from "./village-korrigan-art";
import type { VillageLifeFrame, VillageWalkSurface } from "./village-life-types";

export type VillageKorriganReaction = "idle" | "invite" | "offer" | "loss" | "reward" | "rare";
export const VILLAGE_KORRIGANS_NAME = "village-korrigans";

const { x, z, orbitRadius } = VILLAGE_KORRIGAN_GLADE;
const turn = Math.PI * 2;
const orbitRate = .435, beat = .84, stance = .55;
const reach = KORRIGAN_THIGH + KORRIGAN_SHIN - .005;
const music = {
  idle: { tilt: .008, step: .13, lift: .005, light: 0 },
  invite: { tilt: .13, step: .17, lift: .015, light: 2 },
  offer: { tilt: .092, step: .092, lift: .005, light: 1 },
  loss: { tilt: .21, step: .07, lift: -.013, light: -4 },
  reward: { tilt: -.095, step: .23, lift: .032, light: 8 },
  rare: { tilt: -.125, step: .29, lift: .041, light: 10 },
} as const;

function footAt(angle: number, side: number, target: THREE.Vector3) {
  // Along the tangent local +Z points towards the next beat, local +X outwards.
  const radius = orbitRadius + side * KORRIGAN_HIP_X;
  return target.set(x + Math.cos(angle) * radius, 0, z + Math.sin(angle) * radius);
}

/** An opaque vertex-coloured rig can fade without sorting intersecting body parts. */
export function fadeVillageCharacter(material: THREE.Material, amount: number) {
  const fading = amount > 0 && amount < 1;
  material.opacity = fading ? amount : 1;
  if (material.alphaHash !== fading) {
    material.alphaHash = fading;
    material.needsUpdate = true;
  }
}

export function createVillageKorrigans(surface: Pick<VillageWalkSurface, "heightAt">) {
  const object = new THREE.Group(); object.name = VILLAGE_KORRIGANS_NAME;
  const floor = surface.heightAt(x, z);
  object.position.set(x, floor, z);
  object.visible = false;
  const material = characterMaterial();
  material.emissive.set("#26382f");
  material.emissiveIntensity = .32;
  const dancers = KORRIGAN_PALETTES.map((palette, index) => {
    const model = createKorriganModel(palette, material);
    const contact = createCharacterContactShadow(model.object, model.legs.map(leg => leg.ankle), KORRIGAN_SOLE, .62, surface.heightAt);
    object.add(model.object);
    return { ...model, contact, orbitPhase: -.33 + index * turn / 3, beatPhase: [.17, .51, .84][index] };
  });
  const lantern = new THREE.PointLight("#ffc484", 0, 8.4, 2);
  lantern.name = "korrigan-lantern-light";
  lantern.position.set(3.65, 3.14, .93);
  object.add(lantern);
  const foot = new THREE.Vector3(), landing = new THREE.Vector3(), ankleYaw = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let lastReaction: VillageKorriganReaction = "idle", started = -10;

  function update(frame: VillageLifeFrame, reaction: VillageKorriganReaction, presence: number) {
    object.visible = presence > 0;
    if (!object.visible) { fadeVillageCharacter(material, 1); return; }
    fadeVillageCharacter(material, presence);
    if (reaction !== lastReaction) { lastReaction = reaction; started = frame.time; }
    const age = frame.time - started;
    const accent = frame.reduced ? 0 : THREE.MathUtils.smoothstep(age, 0, .24) * (1 - THREE.MathUtils.smoothstep(age, .49, 1.85));
    const gesture = music[reaction];
    lantern.intensity = (15 + gesture.light * accent) * presence;
    const time = frame.reduced ? 0 : frame.time;
    for (const { object: dancer, upper, cap, legs, contact, orbitPhase, beatPhase } of dancers) {
      const angle = time * orbitRate + orbitPhase;
      footAt(angle, 0, foot);
      const floorY = surface.heightAt(foot.x, foot.z);
      dancer.position.set(foot.x - x, floorY - floor, foot.z - z);
      dancer.rotation.y = -angle;
      const beatCount = time / beat + beatPhase;
      const stepLength = beat * orbitRate;
      const swingY = THREE.MathUtils.lerp(music.idle.step, gesture.step, accent);
      const pelvis = KORRIGAN_HIP_Y - .016 * Math.cos(beatCount * 2 * turn) + accent * gesture.lift;
      for (const [i, { hip, knee, ankle }] of legs.entries()) {
        const side = 2 * i - 1;
        const cycle = beatCount + i / 2;
        const phase = cycle - Math.floor(cycle);
        // Fix the supporting sole in world space from contact to toe-off. The
        // other sole swings to the next tangent point and lands on actual terrain.
        const plant = angle + (stance * .5 - phase) * stepLength;
        const swing = THREE.MathUtils.smoothstep(phase, stance, 1);
        footAt(plant, side, foot);
        footAt(plant + stepLength, side, landing);
        foot.lerp(landing, swing);
        const lift = 4 * swing * (1 - swing) * (frame.reduced ? .04 : swingY);
        const dx = foot.x - (dancer.position.x + x), dz = foot.z - (dancer.position.z + z);
        const lateral = dx * Math.cos(angle) + dz * Math.sin(angle) - hip.position.x;
        const forward = -dx * Math.sin(angle) + dz * Math.cos(angle);
        const ankleHeight = surface.heightAt(foot.x, foot.z) - floorY + KORRIGAN_SOLE + lift;
        hip.position.y = Math.min(pelvis, ankleHeight + Math.sqrt(Math.max(0, reach ** 2 - lateral ** 2 - forward ** 2)));
        const height = hip.position.y - ankleHeight;
        const vertical = Math.hypot(height, lateral);
        const bend = Math.acos(THREE.MathUtils.clamp((vertical ** 2 + forward ** 2 - KORRIGAN_THIGH ** 2 - KORRIGAN_SHIN ** 2) / (2 * KORRIGAN_THIGH * KORRIGAN_SHIN), -1, 1));
        const pitch = Math.atan2(-forward, vertical) - Math.atan2(KORRIGAN_SHIN * Math.sin(bend), KORRIGAN_THIGH + KORRIGAN_SHIN * Math.cos(bend));
        hip.rotation.set(pitch, 0, Math.atan2(lateral, height), "ZXY");
        knee.rotation.x = bend;
        ankleYaw.setFromAxisAngle(up, angle - plant - stepLength * swing + side * .07);
        ankle.quaternion.copy(hip.quaternion).multiply(knee.quaternion).invert().multiply(ankleYaw);
      }
      const rhythm = Math.sin(beatCount * turn);
      upper.position.y = (legs[0].hip.position.y + legs[1].hip.position.y) * .5 - .022;
      upper.rotation.set(.03 + rhythm * .035 + accent * gesture.tilt, .19 + rhythm * .075, -.046 + rhythm * .045, "YXZ");
      cap.rotation.set(rhythm * .023, 0, rhythm * .043);
      (contact.mesh.material as THREE.MeshBasicMaterial).opacity = .36 * presence;
      if (frame.visible(dancer, 1.45)) contact.update();
    }
  }

  function sample() {
    return dancers.map(({ object: dancer, legs }) => ({
      name: dancer.name,
      x: dancer.position.x + x, z: dancer.position.z + z, yaw: dancer.rotation.y,
      feet: legs.map(({ ankle }) => ankle.getWorldPosition(foot).toArray()),
    }));
  }

  const resources = characterDisposer(object);
  return { object, update, sample, dispose: () => { dancers.forEach(({ contact }) => contact.mesh.dispose()); resources.dispose(); } };
}
