import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createVillageFisherman, VILLAGE_FISHERMAN_POSITION, VILLAGE_FISHERMAN_YAW } from "./village-fisherman";
import { createVillageLoic } from "./village-loic";
import { sampleVillageWaves } from "./village-marine";
import type { VillageNpcPose, VillageNpcRig } from "./village-npc-types";
import type { VillageLifeFrame } from "./village-life-types";

const pose = (overrides: Partial<VillageNpcPose> = {}): VillageNpcPose => ({
  activity: "idle", speed: 0, stride: 0, lookYaw: 0, lookPitch: 0, emphasis: 0.8,
  attention: 0, fishingPhase: "wait", phaseProgress: 0, ...overrides,
});
const frame = (time = 0, overrides: Partial<VillageLifeFrame> = {}): VillageLifeFrame => ({
  time, delta: 1 / 30, reduced: false, quality: "high", visible: () => true, ...overrides,
});
function settle(rig: VillageNpcRig, state: VillageNpcPose) {
  for (let i = 0; i < 70; i++) rig.update(frame(i / 30), state);
  rig.object.updateMatrixWorld(true);
}
const world = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3());

describe("village character models", () => {
  it.each([createVillageFisherman, createVillageLoic])("keeps finite merged decoration and disposes late hit resources exactly once: %s", create => {
    const rig = create();
    const meshes: THREE.Mesh[] = []; const hits: THREE.Intersection[] = [];
    rig.object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      meshes.push(child); child.raycast(new THREE.Raycaster(), hits);
      expect(Array.from(child.geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    });
    expect(hits).toEqual([]); expect(meshes.length).toBeLessThanOrEqual(25);
    const hit = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1), new THREE.MeshBasicMaterial({ visible: false }));
    rig.object.add(hit);
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    rig.object.traverse(child => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
      resources.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) resources.add(material);
    });
    const spies = [...resources].map(resource => vi.spyOn(resource, "dispose"));
    rig.dispose(); rig.dispose(); rig.update(frame());
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(rig.object.children).toHaveLength(0);
  });

  it("keeps bottle/lip, hand/grip, crate and supported-rod contacts through interruption", () => {
    const rig = createVillageFisherman(), { object } = rig;
    expect(object.position.toArray()).toEqual(VILLAGE_FISHERMAN_POSITION);
    expect(object.rotation.y).toBe(VILLAGE_FISHERMAN_YAW);
    const bottle = object.getObjectByName("fisherman-wine-bottle")!;
    const hand = object.getObjectByName("fisherman-hand-1")!;
    settle(rig, pose({ activity: "drinking", fishingPhase: "sip", phaseProgress: 0.8 }));
    const mouth = object.getObjectByName("fisherman-mouth")!;
    expect(world(bottle).distanceTo(world(mouth))).toBeLessThan(0.001);
    expect(world(hand).distanceTo(bottle.localToWorld(new THREE.Vector3(0, -0.205, 0)))).toBeLessThan(0.001);
    settle(rig, pose({ activity: "greeting", fishingPhase: "sip", phaseProgress: 0.8, attention: 1, lookYaw: 0.75 }));
    expect(object.userData.bottleLift).toBeLessThan(0.001);
    const contact = object.worldToLocal(bottle.localToWorld(new THREE.Vector3(0, -0.365, 0)));
    expect(contact.x).toBeCloseTo(0.53, 3); expect(contact.y).toBeCloseTo(0.28, 3); expect(contact.z).toBeCloseTo(0.02, 3);
    const rodHand = object.worldToLocal(world(object.getObjectByName("fisherman-hand--1")!));
    expect(rodHand.x).toBeCloseTo(-0.196, 3); expect(rodHand.y).toBeCloseTo(0.785, 3); expect(rodHand.z).toBeCloseTo(0.71, 3);
    expect(object.rotation.y).toBe(VILLAGE_FISHERMAN_YAW);
    rig.dispose();
  });

  it("puts the float on the same shared sea waves and skips offscreen updates", () => {
    const rig = createVillageFisherman(), float = rig.object.getObjectByName("fisherman-water-float")!;
    rig.update(frame(9)); rig.object.updateMatrixWorld(true);
    const point = world(float), wave = sampleVillageWaves(point.x, point.z, 9);
    expect(point.y).toBeCloseTo(wave.height, 6);
    const before = float.position.y;
    rig.update(frame(20, { visible: () => false })); expect(float.position.y).toBe(before);
    rig.update(frame(5, { reduced: true })); const reduced = float.position.y;
    rig.update(frame(15, { reduced: true })); expect(float.position.y).toBe(reduced);
    rig.dispose();
  });

  it("gives Loïc a gait, bounded attentive look and a stable reduced-motion greeting", () => {
    const rig = createVillageLoic(), { object } = rig, initial = object.position.clone();
    expect(object.getObjectByName("loic-teal-tan-baseball-cap")).toBeDefined();
    settle(rig, pose({ activity: "walking", speed: 0.8, stride: Math.PI / 2 }));
    const ankles = [-1, 1].map(side => object.getObjectByName(`loic-ankle-${side}`)!);
    for (let step = 0; step < 48; step++) {
      rig.update(frame(step / 30), pose({ activity: "walking", speed: 0.8, stride: step / 48 * Math.PI * 2 }));
      object.updateMatrixWorld(true);
      const soles = ankles.map(ankle => object.worldToLocal(ankle.localToWorld(new THREE.Vector3(0, -0.105, 0))).y);
      expect(Math.min(...soles)).toBeCloseTo(0, 5);
      expect(Math.max(...soles)).toBeLessThan(0.079);
      for (const ankle of ankles) {
        const heel = object.worldToLocal(ankle.localToWorld(new THREE.Vector3(0, -0.105, -0.07)));
        const toe = object.worldToLocal(ankle.localToWorld(new THREE.Vector3(0, -0.105, 0.22)));
        expect(heel.y).toBeCloseTo(toe.y, 5);
      }
    }
    expect(object.position.equals(initial)).toBe(true);
    settle(rig, pose({ activity: "greeting", attention: 1, lookYaw: 4 }));
    expect(object.getObjectByName("loic-head")!.rotation.y).toBeLessThan(0.75);
    expect(object.getObjectByName("loic-hand-1")!.position.y).toBeGreaterThan(1.25);
    const greeting = pose({ activity: "greeting", attention: 1 });
    rig.update(frame(5, { reduced: true }), greeting); object.updateMatrixWorld(true);
    const before = object.getObjectByName("loic-head")!.matrixWorld.clone();
    rig.update(frame(15, { reduced: true }), greeting); object.updateMatrixWorld(true);
    expect(object.getObjectByName("loic-head")!.matrixWorld.equals(before)).toBe(true);
    rig.dispose();
  });

  it("carries the bottle continuously through pickup, sip, an interrupted sip and replacement", () => {
    const rig = createVillageFisherman(), { object } = rig;
    const bottle = object.getObjectByName("fisherman-wine-bottle")!;
    const hand = object.getObjectByName("fisherman-hand-1")!;
    settle(rig, pose());
    let previousBottle = world(bottle), previousHand = world(hand), time = 0;
    for (const phase of ["reach", "sip", "interrupt", "resume", "replace"] as const) {
      for (let step = 0; step < 60; step++) {
        const progress = step / 59;
        const interrupted = phase === "interrupt" || phase === "resume";
        rig.update(frame(time += 1 / 30), pose({
          activity: phase === "interrupt" ? "greeting" : "drinking",
          fishingPhase: interrupted ? "sip" : phase,
          phaseProgress: interrupted ? 0.8 : progress,
          attention: phase === "interrupt" ? 1 - Math.exp(-progress * 8) : phase === "resume" ? Math.exp(-progress * 8) : 0,
          lookYaw: interrupted ? 0.6 : 0,
        }));
        object.updateMatrixWorld(true);
        const currentBottle = world(bottle), currentHand = world(hand);
        expect(currentBottle.distanceTo(previousBottle), `${phase} frame ${step}: bottle`).toBeLessThan(0.09);
        expect(currentHand.distanceTo(previousHand), `${phase} frame ${step}: hand`).toBeLessThan(0.09);
        previousBottle = currentBottle; previousHand = currentHand;
      }
    }
    rig.dispose();
  });
});
