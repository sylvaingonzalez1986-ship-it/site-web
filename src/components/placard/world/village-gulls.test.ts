import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createVillageGulls } from "./village-gulls";
import { VILLAGE_MAINLAND_SHORE } from "./village-mainland";
import { sampleMarineCoast } from "./village-marine";
import { paintingToGround } from "./village-layout";
import { VILLAGE_SECOND_BANK } from "./village-terrain";
import type { VillageLifeFrame } from "./village-life-types";

const frame = (time: number, options: Partial<VillageLifeFrame> = {}): VillageLifeFrame => ({
  time, delta: 1 / 30, reduced: false, quality: "high", visible: () => true, ...options,
});
const position = (object: THREE.Object3D) => new THREE.Vector2(object.position.x, object.position.z);
const poses = (root: THREE.Group) => root.getObjectByName("gull-flight-poses")!.children;
const batches = (root: THREE.Group) => root.children.filter(child => child instanceof THREE.InstancedMesh);

type Point = readonly [number, number];
function clearance(x: number, z: number, coast: readonly Point[]) {
  let distance = Infinity;
  let inside = false;
  for (let i = 1; i < coast.length; i++) {
    const [ax, az] = coast[i - 1], [bx, bz] = coast[i];
    const dx = bx - ax, dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
    if ((az > z) !== (bz > z) && x < ax + dx * (z - az) / dz) inside = !inside;
  }
  return inside ? -distance : distance;
}

describe("the coastal gulls", () => {
  it("keeps all eight birds and their flight envelopes above water on three coastal loops", () => {
    const gulls = createVillageGulls();
    const birds = poses(gulls.object);
    const island = sampleMarineCoast();
    const secondBank = sampleMarineCoast(VILLAGE_SECOND_BANK);
    const mainland: Point[] = [...VILLAGE_MAINLAND_SHORE, [-80, -80], VILLAGE_MAINLAND_SHORE[0]];
    const [lighthouseX, lighthouseZ] = paintingToGround(1420, 15);
    expect(birds).toHaveLength(8);
    expect(new Set(birds.map(bird => bird.userData.route)).size).toBe(3);
    const margins = [Infinity, Infinity, Infinity, Infinity];
    const spacingRange = [Infinity, 0];
    let nearestFlockmates = Infinity;
    let nearestAt = "";
    for (let t = 0; t < 115; t += .13) {
      gulls.update(frame(t));
      for (const bird of birds) {
        const { x, y, z } = bird.position;
        expect(y).toBeGreaterThan(.62);
        margins[0] = Math.min(margins[0], clearance(x, z, island));
        margins[1] = Math.min(margins[1], clearance(x, z, mainland));
        margins[2] = Math.min(margins[2], clearance(x, z, secondBank));
        margins[3] = Math.min(margins[3], Math.hypot(x - lighthouseX, z - lighthouseZ));
      }
      const spacing = birds[0].position.distanceTo(birds[2].position);
      spacingRange[0] = Math.min(spacingRange[0], spacing);
      spacingRange[1] = Math.max(spacingRange[1], spacing);
      for (let i = 0; i < birds.length; i++) for (let j = i + 1; j < birds.length; j++) {
        const gap = birds[i].position.distanceTo(birds[j].position);
        if (gap < nearestFlockmates) {
          nearestFlockmates = gap;
          nearestAt = `${birds[i].name} and ${birds[j].name} at ${t.toFixed(2)} s (${birds[i].position.toArray().join(", ")})`;
        }
      }
    }
    expect(margins[0], "island margin").toBeGreaterThan(1.15);
    expect(margins[1], "mainland margin").toBeGreaterThan(1.15);
    expect(margins[2], "second bank margin").toBeGreaterThan(1.15);
    expect(margins[3], "lighthouse margin").toBeGreaterThan(3.5);
    expect(spacingRange[1] - spacingRange[0]).toBeGreaterThan(3);
    expect(nearestFlockmates, nearestAt).toBeGreaterThan(.9);
    gulls.dispose();
  });

  it("heads along the trajectory, banks on turns and alternates flapping and gliding", () => {
    const gulls = createVillageGulls();
    const birds = poses(gulls.object);
    const prior = birds.map(bird => position(bird));
    const direction = new THREE.Vector2();
    for (let t = 0; t < 35; t += .16) {
      gulls.update(frame(t));
      for (let i = 0; i < birds.length; i++) prior[i].copy(position(birds[i]));
      gulls.update(frame(t + .04));
      birds.forEach((bird, i) => {
        direction.set(bird.position.x, bird.position.z).sub(prior[i]).normalize();
        expect(direction.dot(new THREE.Vector2(Math.sin(bird.rotation.y), Math.cos(bird.rotation.y))), `${bird.name} at ${t.toFixed(2)} s (${bird.position.toArray().join(", ")})`).toBeGreaterThan(.985);
      });
    }
    const observed = new Set<boolean>();
    let largestBank = 0;
    for (let t = 0; t < 8; t += .1) {
      gulls.update(frame(t));
      for (const { userData } of birds) {
        largestBank = Math.max(largestBank, Math.abs(userData.bank));
        observed.add(userData.glide);
      }
    }
    expect(largestBank).toBeGreaterThan(.15);
    expect(observed).toEqual(new Set([false, true]));
    gulls.dispose();
  });

  it("draws the visible birds in three shared batches and releases their resources", () => {
    const gulls = createVillageGulls();
    const birds = poses(gulls.object);
    const [body, inner, outer] = batches(gulls.object);
    expect(batches(gulls.object)).toHaveLength(3);
    expect(new Set([body.material, inner.material, outer.material]).size).toBe(1);
    expect([body.count, inner.count, outer.count]).toEqual([8, 16, 16]);
    expect(new Set(outer.geometry.getAttribute("color").array)).toContain(Math.fround(new THREE.Color("#293940").r));
    gulls.update(frame(7, { visible: bird => bird.name === "gull-flight-2" }));
    expect(birds.filter(bird => bird.visible)).toEqual([birds[1]]);
    expect([body.count, inner.count, outer.count]).toEqual([1, 2, 2]);
    const transform = new THREE.Matrix4();
    body.getMatrixAt(0, transform);
    expect(new THREE.Vector3().setFromMatrixPosition(transform).distanceTo(birds[1].position)).toBeLessThan(.00001);
    gulls.update(frame(7, { visible: () => false }));
    expect([body.count, inner.count, outer.count]).toEqual([0, 0, 0]);
    const dispose = vi.fn();
    for (const batch of [body, inner, outer]) {
      const hits: THREE.Intersection[] = [];
      batch.raycast(new THREE.Raycaster(), hits);
      expect(hits).toEqual([]);
      batch.geometry.addEventListener("dispose", dispose);
      batch.addEventListener("dispose", dispose);
    }
    (body.material as THREE.Material).addEventListener("dispose", dispose);
    gulls.dispose();
    gulls.dispose();
    expect(dispose).toHaveBeenCalledTimes(7);
  });

  it("lowers wing articulation at overview scale and holds the pose when time stops", () => {
    const gulls = createVillageGulls();
    const [body, inner, outer] = batches(gulls.object);
    const matrices = () => [body, inner, outer].map(batch => Array.from(batch.instanceMatrix.array));
    gulls.update(frame(1.28));
    const high = matrices();
    gulls.update(frame(1.28, { delta: 0 }));
    expect(matrices()).toEqual(high);
    gulls.update(frame(1.28, { quality: "low" }));
    const low = matrices();
    expect(low[0]).toEqual(high[0]);
    expect(low[2]).not.toEqual(high[2]);
    gulls.update(frame(2, { reduced: true }));
    const reduced = matrices();
    gulls.update(frame(100, { reduced: true, quality: "low" }));
    expect(matrices()).toEqual(reduced);
    expect(poses(gulls.object).every(bird => bird.userData.glide)).toBe(true);
    gulls.dispose();
  });

  it("mirrors the tips of the primaries in the body frame during glides and wingbeats", () => {
    const gulls = createVillageGulls();
    const birds = poses(gulls.object);
    const [body, , outer] = batches(gulls.object);
    const positions = outer.geometry.getAttribute("position");
    const tip = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) === 0 && positions.getX(i) > tip.x) tip.fromBufferAttribute(positions, i);
    }
    expect(tip.x).toBeGreaterThan(0);

    const bodyInverse = new THREE.Matrix4(), transform = new THREE.Matrix4();
    const rightTip = new THREE.Vector3(), leftTip = new THREE.Vector3();
    const highQualityGlides = new Set<boolean>();
    for (const step of [frame(.34), frame(1.36), frame(2.19), frame(.34, { quality: "low" }), frame(8, { reduced: true })]) {
      gulls.update(step);
      for (let i = 0; i < body.count; i++) {
        body.getMatrixAt(i, bodyInverse);
        bodyInverse.invert();
        outer.getMatrixAt(i * 2, transform);
        rightTip.copy(tip).applyMatrix4(transform).applyMatrix4(bodyInverse);
        outer.getMatrixAt(i * 2 + 1, transform);
        leftTip.copy(tip).applyMatrix4(transform).applyMatrix4(bodyInverse);
        expect(leftTip.x).toBeLessThan(0);
        leftTip.x *= -1;
        expect(leftTip.distanceTo(rightTip)).toBeLessThan(.00001);
        if (!step.reduced && step.quality === "high") highQualityGlides.add(birds[i].userData.glide);
      }
    }
    expect(highQualityGlides).toEqual(new Set([true, false]));
    gulls.dispose();
  });
});
