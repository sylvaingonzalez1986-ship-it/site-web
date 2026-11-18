import { createHash } from "node:crypto";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { CHANVRIER_APPEARANCE_OPTIONS, DEFAULT_CHANVRIER_APPEARANCE, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createGrowWorker } from "./kq-grow-worker-model";
import { createChanvrierScalp } from "./chanvrier-head";
import { chanvrierHeadwearEdge } from "./chanvrier-headwear-fit";

const profile: ChanvrierAvatarProfile = { gender: "male", clothing: "sage", skin: "peach", appearance: DEFAULT_CHANVRIER_APPEARANCE };
const mesh = (worker: ReturnType<typeof createGrowWorker>, name: string) => worker.object.getObjectByName(name) as THREE.Mesh;

describe("3D Chanvrier", () => {
  it("uses each hair and face option as a distinct mesh and accepts a hat", () => {
    const worker = createGrowWorker(profile, { tools: false });
    const hairstyles = new Set<string>();
    for (const { code: hair } of CHANVRIER_APPEARANCE_OPTIONS.hair) {
      worker.updateAppearance({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, hair } });
      const hairMesh = mesh(worker, "chanvrier-hair");
      if (hair === "bald") expect(hairMesh).toBeUndefined();
      else {
        const vertices = hairMesh.geometry.getAttribute("position");
        expect(vertices.array.every(Number.isFinite)).toBe(true);
        const bytes = new Uint8Array(vertices.array.buffer, vertices.array.byteOffset, vertices.array.byteLength);
        hairstyles.add(createHash("sha256").update(bytes).digest("hex"));
      }
    }
    expect(hairstyles.size).toBe(CHANVRIER_APPEARANCE_OPTIONS.hair.length - 1);
    const faces = new Set<number>();
    for (const { code: face } of CHANVRIER_APPEARANCE_OPTIONS.face) {
      worker.updateAppearance({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, face, headwear: "watch-cap" } });
      const skin = mesh(worker, "chanvrier-skin");
      skin.geometry.computeBoundingBox();
      faces.add(skin.geometry.boundingBox!.max.x);
      expect(worker.object.getObjectByName("coiffe-watch-cap")).toBeDefined();
    }
    expect(faces.size).toBe(CHANVRIER_APPEARANCE_OPTIONS.face.length);
    expect(worker.object.getObjectByName("falling-input")).toBeUndefined();
    expect(worker.object.getObjectByName("sweep")).toBeUndefined();
    expect(() => worker.pose(0, 0, "sweep", .5, null)).not.toThrow();
    worker.dispose();
  });

  it("fits close-cut roots to the brow and nape on all eight skulls", () => {
    const worker = createGrowWorker(profile, { tools: false });
    for (const { code: face } of CHANVRIER_APPEARANCE_OPTIONS.face) {
      const scalp = createChanvrierScalp(face);
      worker.updateAppearance({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, face, hair: "buzz", headwear: "none" } });
      const hair = mesh(worker, "chanvrier-hair");
      // Gameplay meshes skip pointer hits. Cast against the same geometry in head-local space.
      const probe = new THREE.Mesh(hair.geometry, hair.material);
      for (const [angle, level] of [[.013, .302], [.85, .290], [2.7, .138], [3.12, .083]]) {
        const y = level * scalp.height;
        const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle) * .91);
        const skinRadius = scalp.radius(y) * direction.length();
        direction.normalize();
        const origin = direction.clone().multiplyScalar(.8).setY(y);
        const hit = new THREE.Raycaster(origin, direction.clone().negate()).intersectObject(probe)[0];
        expect(hit, `${face} at angle ${angle}, height ${level}`).toBeDefined();
        const clearance = .8 - hit.distance - skinRadius;
        expect(clearance, face).toBeGreaterThanOrEqual(-.0004);
        expect(clearance, face).toBeLessThan(.014);
      }
    }
    worker.dispose();
  });

  it("tucks dense curls below sloping brims at the back of the head", () => {
    const worker = createGrowWorker(profile, { tools: false });
    for (const headwear of ["sailor-cap", "souwester", "round-hat"] as const) {
      worker.updateAppearance({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, hair: "afro", headwear } });
      const hat = mesh(worker, `coiffe-${headwear}`), hair = mesh(worker, "chanvrier-hair");
      const probes = [hat, hair].map(part => new THREE.Mesh(part.geometry, part.material));
      for (const angle of [2.88, 3.14, 3.67, 3.93]) {
        const y = chanvrierHeadwearEdge(headwear, angle)! + .022;
        const origin = new THREE.Vector3(Math.sin(angle), y, .91 * Math.cos(angle));
        const direction = new THREE.Vector3(0, y, 0).sub(origin).normalize();
        expect(new THREE.Raycaster(origin, direction).intersectObjects(probes)[0]?.object).toBe(probes[0]);
      }
    }
    worker.dispose();
  });

  it("replaces only the dyed feature and disposes its geometry once", () => {
    const first = createGrowWorker(profile, { tools: false }), second = createGrowWorker(profile, { tools: false });
    const skin = mesh(first, "chanvrier-skin"), firstEyes = mesh(first, "chanvrier-eyes"), secondEyes = mesh(second, "chanvrier-eyes");
    const firstDispose = vi.fn(), secondDispose = vi.fn();
    firstEyes.geometry.addEventListener("dispose", firstDispose);
    secondEyes.geometry.addEventListener("dispose", secondDispose);
    const dyed = { ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, dyes: { eyes: "#dd41a2" } } };
    first.updateAppearance(dyed);
    const dyedEyes = mesh(first, "chanvrier-eyes");
    expect(dyedEyes.geometry).not.toBe(firstEyes.geometry);
    expect(mesh(first, "chanvrier-skin")).toBe(skin);
    first.updateAppearance(dyed);
    expect(mesh(first, "chanvrier-eyes")).toBe(dyedEyes);
    expect(mesh(second, "chanvrier-eyes")).toBe(secondEyes);
    first.updateAppearance();
    expect(mesh(first, "chanvrier-eyes").geometry.getAttribute("color").array).toEqual(secondEyes.geometry.getAttribute("color").array);
    first.dispose();
    first.dispose();
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).not.toHaveBeenCalled();
    second.dispose();
  });

  it("blinks and shifts weight at rest from elapsed time while keeping the feet planted", () => {
    const worker = createGrowWorker(profile, { tools: false });
    const eye = mesh(worker, "chanvrier-eyes"), head = worker.object.getObjectByName("chanvrier-head")!;
    const shoes: THREE.Object3D[] = [];
    worker.object.traverse(part => { if (part.name === "shoe-and-sole") shoes.push(part); });
    expect(shoes).toHaveLength(2);
    worker.pose(0, 0, null, 0, null, undefined, 2.58);
    expect(eye.parent!.scale.y).toBeLessThan(.15);
    const idle = head.quaternion.clone();
    worker.pose(0, 0, null, 0, null, undefined, 3.1);
    expect(eye.parent!.scale.y).toBe(1);
    expect(head.quaternion.equals(idle)).toBe(false);
    for (const { code: body } of CHANVRIER_APPEARANCE_OPTIONS.body) {
      worker.updateAppearance({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, body } });
      worker.object.updateMatrixWorld(true);
      for (const shoe of shoes) expect(new THREE.Box3().setFromObject(shoe, true).min.y).toBeCloseTo(0, 2);
    }
    worker.dispose();
  });

  it("keeps both silhouettes distinct across all three builds with the same haircut", () => {
    const worker = createGrowWorker(profile, { tools: false });
    const chest = worker.object.getObjectByName("chanvrier-chest")!, hair = mesh(worker, "chanvrier-hair");
    const shoe = mesh(worker, "shoe-and-sole"), hand = worker.object.getObjectByName("working-hand")!;
    const builds = new Set<number>();
    for (const { code: body } of CHANVRIER_APPEARANCE_OPTIONS.body) {
      const appearance = { ...DEFAULT_CHANVRIER_APPEARANCE, body };
      worker.updateAppearance({ ...profile, gender: "male", appearance });
      worker.pose(0, 0, "store", .5, null, "LP-SUPER-1L");
      const maleHand = hand.getWorldPosition(new THREE.Vector3()), maleWidth = chest.scale.x;
      const maleStance = Math.abs(shoe.getWorldPosition(new THREE.Vector3()).x);
      builds.add(maleWidth);
      worker.updateAppearance({ ...profile, gender: "female", appearance });
      expect(chest.scale.x).toBeLessThan(maleWidth * .95);
      expect(Math.abs(shoe.getWorldPosition(new THREE.Vector3()).x)).toBeGreaterThan(maleStance * 1.10);
      expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(maleHand)).toBeLessThan(.001);
      expect(mesh(worker, "chanvrier-hair")).toBe(hair);
      builds.add(chest.scale.x);
    }
    expect(builds.size).toBe(6);
    worker.dispose();
  });

  it("deforms the same continuous surfaces through a walking step and a deep reach", () => {
    const worker = createGrowWorker({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, top: "tee", bottom: "shorts" } });
    const limbs = ["arm-1", "arm--1", "leg-1", "leg--1"].map(name => mesh(worker, `chanvrier-${name}`));
    const positions = limbs.map(limb => limb.geometry.getAttribute("position"));
    const atRest = positions.map(position => Array.from(position.array));
    worker.pose(.35, 1, null, 0, null);
    for (const [i, position] of positions.entries()) expect(position.array).not.toEqual(atRest[i]);
    worker.pose(0, 0, "water", .50, 0);
    worker.object.updateMatrixWorld(true);
    for (const [i, limb] of limbs.entries()) {
      const { geometry } = limb, position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
      expect(position).toBe(positions[i]);
      expect(position.array.every(Number.isFinite)).toBe(true);
      expect(normal.array.every(Number.isFinite)).toBe(true);
      expect(geometry.index!.count).toBe((position.count / 14 - 1) * 14 * 6);
      const point = new THREE.Vector3();
      for (let vertex = 0; vertex < position.count; vertex++) {
        point.fromBufferAttribute(position, vertex);
        expect(geometry.boundingBox!.containsPoint(point)).toBe(true);
        expect(geometry.boundingSphere!.distanceToPoint(point)).toBeLessThan(.000001);
      }
    }
    for (const side of [-1, 1]) {
      const hip = worker.object.getObjectByName(`chanvrier-hip-${side}`)!.getWorldPosition(new THREE.Vector3());
      const knee = worker.object.getObjectByName(`chanvrier-knee-${side}`)!.getWorldPosition(new THREE.Vector3());
      const ankle = worker.object.getObjectByName(`chanvrier-ankle-${side}`)!.getWorldPosition(new THREE.Vector3());
      expect(hip.distanceTo(knee)).toBeCloseTo(.35, 5);
      expect(knee.distanceTo(ankle)).toBeCloseTo(.35, 5);
    }
    worker.dispose();
  });

  it("closes both palms around the broom shaft and reopens them at rest", () => {
    const worker = createGrowWorker(profile);
    const shaft = worker.object.getObjectByName("broom-handle")!;
    for (const phase of [.22, .37, .54, .77]) {
      worker.pose(0, 0, "sweep", phase, null);
      const shaftAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
      for (const [side, height] of [[-1, .98], [1, .64]]) {
        const palm = worker.object.getObjectByName(`chanvrier-palm-${side}`)!;
        expect(palm.getObjectByName("chanvrier-fingers-grip")!.visible).toBe(true);
        expect(palm.getObjectByName("chanvrier-fingers-relaxed")!.visible).toBe(false);
        const gripCenter = shaft.worldToLocal(palm.getWorldPosition(new THREE.Vector3()));
        expect(gripCenter.distanceTo(new THREE.Vector3(0, height, 0))).toBeLessThan(.001);
        const palmAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(palm.getWorldQuaternion(new THREE.Quaternion()));
        expect(palmAxis.dot(shaftAxis)).toBeCloseTo(1, 5);
      }
    }
    worker.pose(0, 0, null, 0, null);
    const palm = worker.object.getObjectByName("chanvrier-palm-1")!;
    expect(palm.getObjectByName("chanvrier-fingers-relaxed")!.visible).toBe(true);
    worker.dispose();
  });
});
