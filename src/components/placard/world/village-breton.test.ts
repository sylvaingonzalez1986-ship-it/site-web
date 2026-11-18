import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createVillageBreton, VILLAGE_BRETON_POSITION, VILLAGE_BRETON_RADIUS } from "./village-breton";
import type { VillageLifeFrame } from "./village-life-types";
import type { VillageNpcPose } from "./village-npc-types";

const frame = (time: number, overrides: Partial<VillageLifeFrame> = {}): VillageLifeFrame => ({
  time, delta: 1 / 30, reduced: false, quality: "high", visible: () => true, ...overrides,
});
const pose = (overrides: Partial<VillageNpcPose> = {}): VillageNpcPose => ({
  activity: "idle", speed: 0, stride: 0, lookYaw: 0, lookPitch: 0, emphasis: 0.8,
  attention: 0, fishingPhase: "wait", phaseProgress: 0, ...overrides,
});

describe("village Breton decoration", () => {
  it("fits a standing villager, stays within its reserved footprint and never intercepts rays", () => {
    const controller = createVillageBreton(), { object } = controller;
    expect(object.position.toArray()).toEqual(VILLAGE_BRETON_POSITION);
    object.position.set(0, 0, 0); object.rotation.y = 0;
    // Musical glyphs are an effect above the body, outside the walking footprint.
    const music = object.getObjectByName("breton-music")!; music.removeFromParent();
    const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(1.8); expect(size.y).toBeLessThan(2.1);
    expect(Math.max(Math.abs(bounds.min.x), bounds.max.x, Math.abs(bounds.min.z), bounds.max.z)).toBeLessThan(VILLAGE_BRETON_RADIUS);
    const meshes: THREE.Mesh[] = [];
    object.traverse(child => { if (child instanceof THREE.Mesh) meshes.push(child); });
    expect(meshes.length).toBeLessThanOrEqual(28);
    object.getObjectByName("breton-playing-rig")!.add(music);
    const hits: THREE.Intersection[] = [];
    meshes.forEach(mesh => mesh.raycast(new THREE.Raycaster(), hits));
    expect(hits).toEqual([]);
    meshes.forEach(mesh => expect(Array.from(mesh.geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true));
    expect(object.userData.droneCount).toBe(1);
    controller.dispose();
  });

  it("takes its walk from the routine, carries the instrument and pools expressive musical notes", () => {
    const controller = createVillageBreton(), { object } = controller;
    const position = object.position.clone();
    for (let i = 0; i < 30; i++) controller.update(frame(i / 30), pose({ activity: "walking", speed: 0.8, stride: Math.PI / 2 }));
    expect(object.position.equals(position)).toBe(true);
    const left = object.getObjectByName("breton-ankle--1")!, right = object.getObjectByName("breton-ankle-1")!;
    const leftSole = object.worldToLocal(left.localToWorld(new THREE.Vector3(0, -0.105, 0)));
    const rightSole = object.worldToLocal(right.localToWorld(new THREE.Vector3(0, -0.105, 0)));
    expect(leftSole.y).toBeCloseTo(0, 5);
    expect(rightSole.y).toBeGreaterThan(0.035);
    const music = object.getObjectByName("breton-music")!;
    expect(music.children).toHaveLength(4);
    expect(music.children.every(child => !child.visible)).toBe(true);
    for (let i = 0; i < 30; i++) controller.update(frame(i / 30), pose({ activity: "playing" }));
    expect(music.children.filter(child => child.visible)).toHaveLength(4);
    const blownMouth = object.getObjectByName("breton-mouth")!.scale.y;
    const mouth = object.getObjectByName("breton-mouth")!, pipe = object.getObjectByName("breton-blowpipe")!;
    const pipeTip = () => pipe.localToWorld(new THREE.Vector3(0.2, 0.255, 0.08));
    expect(pipeTip().distanceTo(mouth.getWorldPosition(new THREE.Vector3()))).toBeLessThan(0.001);
    for (let i = 0; i < 30; i++) controller.update(frame(i / 30), pose({ activity: "singing", attention: 1, lookYaw: 0.6 }));
    expect(object.getObjectByName("breton-mouth")!.scale.y).toBeGreaterThan(blownMouth);
    expect(object.getObjectByName("breton-blowpipe")!.rotation.x).toBeGreaterThan(0.9);
    expect(pipeTip().distanceTo(mouth.getWorldPosition(new THREE.Vector3()))).toBeGreaterThan(0.22);
    expect(object.getObjectByName("breton-head")!.rotation.y).toBeGreaterThan(0.3);
    controller.update(frame(2, { quality: "low" }), pose({ activity: "singing" }));
    expect(music.children.filter(child => child.visible)).toHaveLength(2);
    controller.update(frame(3, { reduced: true }), pose({ activity: "singing" }));
    expect(music.children.every(child => !child.visible)).toBe(true);
    controller.dispose();
  });

  it("uses the shared visible clock, pauses between phrases and holds a reduced-motion pose", () => {
    const controller = createVillageBreton(), { object } = controller;
    controller.update(frame(4));
    const compression = object.userData.bagCompression;
    controller.update(frame(16, { visible: () => false }));
    expect(object.userData.bagCompression).toBe(compression);
    controller.update(frame(16));
    expect(object.userData.state).toBe("phrase-breath");
    controller.update(frame(3, { reduced: true }));
    object.updateMatrixWorld(true);
    const before = object.getObjectByName("breton-head")!.matrixWorld.clone();
    controller.update(frame(8, { reduced: true })); object.updateMatrixWorld(true);
    expect(object.getObjectByName("breton-head")!.matrixWorld.equals(before)).toBe(true);
    expect(object.userData.bagCompression).toBe(0);
    controller.dispose();
  });

  it("keeps notes continuous across a late phrase change, pause and zoom", () => {
    const controller = createVillageBreton();
    const note = controller.object.getObjectByName("breton-note-2") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const first = pose({ activity: "playing", emphasis: 0.23 }), next = pose({ activity: "playing", emphasis: 0.87 });
    const time = 1200.43;
    controller.update(frame(time), first);
    const before = note.position.clone();
    controller.update(frame(time + 1 / 30), next);
    expect(note.position.distanceTo(before)).toBeLessThan(0.02);
    const paused = note.position.clone(), opacity = note.material.opacity;
    controller.update(frame(time + 1 / 30, { delta: 0, detail: 0.5 }), first);
    expect(note.position.equals(paused)).toBe(true);
    expect(note.material.opacity).toBeCloseTo(opacity / 2, 6);
    controller.update(frame(time + 1 / 30, { reduced: true }), first);
    expect(note.visible).toBe(false);
    controller.update(frame(time + 1 / 30, { delta: 0 }), next);
    expect(note.position.equals(paused)).toBe(true);
    controller.update(frame(time + 1 / 30, { delta: 0, detail: 0 }), next);
    expect(note.visible).toBe(false);
    expect(controller.object.getObjectByName("breton-note-1")!.visible).toBe(true);
    controller.dispose();
  });

  it("disposes shared resources exactly once and detaches from its scene", () => {
    const controller = createVillageBreton(), scene = new THREE.Scene(); scene.add(controller.object);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    controller.object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    });
    const spies = [...geometries, ...materials].map(resource => vi.spyOn(resource, "dispose"));
    controller.dispose(); controller.dispose(); controller.update(frame(10));
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(controller.object.parent).toBeNull(); expect(controller.object.children).toHaveLength(0);
  });
});
