import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { characterDisposer, characterMaterial, createCharacterFace } from "./village-character-art";
import { createVillageFisherman } from "./village-fisherman";
import { createVillageLoic } from "./village-loic";
import type { VillageLifeFrame } from "./village-life-types";
import type { VillageNpcPose } from "./village-npc-types";

describe("shared illustrated village face", () => {
  it.each(["loic", "breton", "fisherman"] as const)("keeps the eyes of %s readable when approaching from the map", name => {
    const rig = new THREE.Group(), material = characterMaterial();
    const face = createCharacterFace(rig, material, name);
    const lids = face.eyes.getObjectByName(`${name}-eyelids`) as THREE.Mesh;
    const gaze = face.eyes.getObjectByName(`${name}-gaze`)!;
    const nearCount = lids.geometry.drawRange.count;
    face.setExpression(1, false, 1, -.4, .2, 0, .10);
    expect(gaze.visible).toBe(false);
    expect(lids.geometry.drawRange.start).toBe(nearCount);
    expect(lids.geometry.drawRange.count).toBeGreaterThan(0);
    face.setExpression(1, false, 1, .4, .2, 0, 1);
    expect(lids.geometry.drawRange).toEqual({ start: 0, count: nearCount });
    expect(gaze.visible).toBe(true);
    expect(gaze.rotation.y).toBeGreaterThan(face.eyes.rotation.y);
    characterDisposer(rig).dispose();
  });

  it("blinks on the shared clock, holds the reduced pose and keeps its mouth contact anchor", () => {
    const rig = new THREE.Group(), material = characterMaterial();
    const face = createCharacterFace(rig, material, "breton");
    const mouthAnchor = face.mouth.position.clone();
    const offset = ("breton".charCodeAt(0) % 11) * 0.25;
    face.setExpression(2.58 - offset, false, 0, 0, 0.1);
    expect(face.eyes.scale.y).toBeLessThan(0.1);
    const closedMouth = face.mouth.scale.y;
    face.setExpression(2.58 - offset, true, 1, 0.7, 1, 0.8);
    expect(face.eyes.scale.y).toBeGreaterThan(0.9);
    expect(face.mouth.scale.y).toBeGreaterThan(closedMouth * 2);
    expect(face.mouth.position.equals(mouthAnchor)).toBe(true);
    expect(face.brows[0].position.y).toBeGreaterThan(face.brows[1].position.y);
    expect(face.eyes.rotation.y).toBeGreaterThan(0);
    expect(material.flatShading).toBe(false);
    characterDisposer(rig).dispose();
  });
});

describe("village character transitions", () => {
  const frame: VillageLifeFrame = { time: 0, delta: 1 / 60, quality: "high", reduced: false, visible: () => true };
  const dialogue: VillageNpcPose = {
    activity: "greeting", speed: 0, stride: 0, walkBlend: 0, lookYaw: 0.48, lookPitch: -0.08,
    attention: 1, emphasis: 0.68, fishingPhase: "watch", phaseProgress: 0.54,
  };

  it("lets Loïc finish slowing down, wave once, and lower his hand during a long conversation", () => {
    const rig = createVillageLoic();
    const hand = rig.object.getObjectByName("loic-hand-1")!;
    let maxHeight = 0, maxFrameDifference = 0, previousY = hand.position.y;
    for (let i = 0; i < 270; i++) {
      rig.update({ ...frame, time: i / 60 }, { ...dialogue, walkBlend: Math.max(0, 1 - i / 34) });
      if (i < 16) expect(hand.position.y).toBeCloseTo(0.72, 4);
      maxHeight = Math.max(maxHeight, hand.position.y);
      maxFrameDifference = Math.max(maxFrameDifference, Math.abs(hand.position.y - previousY));
      previousY = hand.position.y;
    }
    expect(maxHeight).toBeGreaterThan(1.26);
    expect(hand.position.y).toBeLessThan(0.9);
    expect(maxFrameDifference).toBeLessThan(0.035);
    rig.dispose();
  });

  it("returns the fisherman's gaze to the float as residual attention fades", () => {
    const rig = createVillageFisherman();
    const head = rig.object.getObjectByName("fisherman-head")!;
    for (let i = 0; i < 60; i++) rig.update({ ...frame, time: i / 60 }, dialogue);
    expect(head.rotation.y).toBeGreaterThan(0.35);
    for (let i = 0; i < 72; i++) {
      rig.update({ ...frame, time: 1 + i / 60 }, { ...dialogue, activity: "fishing", attention: Math.exp(-i / 14) });
    }
    expect(head.rotation.y).toBeLessThan(-0.09);
    expect(head.rotation.x).toBeGreaterThan(0.06);
    expect(rig.object.userData.fishingPhase).toBe("watch");
    rig.dispose();
  });
});
