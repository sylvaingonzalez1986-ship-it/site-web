import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createGrowRoomActor } from "./KqGrowRoomActorWorld";
import { createGrowWorker } from "./kq-grow-worker-model";
import { createGrowRoomPaths } from "@/lib/kanab-quest-grow-room-path";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";

const layout: WarehouseSpatialLayout = {
  version: 1, width: 10, depth: 10, entry: { x: 0, z: 5.7 }, items: [
    { id: "herbes", name: "Culture", kind: "culture", x: -2, z: 0, width: 1, depth: 1, rotation: 0 },
    { id: "sechoir", name: "Séchoir", kind: "drying", x: 2, z: -1, width: 2, depth: 1, rotation: 90 },
    { id: "stock", name: "Stockage", kind: "storage", x: -1, z: 2, width: 1, depth: 1, rotation: 180 },
  ]
};
const base = { layout, stage: 1, motion: true, visible: true, profile: { gender: "female" as const, skin: "brown" as const, clothing: "berry" as const } };
describe("player in the shared grow room renderer", () => {
  it("reaches the service counter when the renderer can only deliver five frames per second", () => {
    const actor = createGrowRoomActor(new THREE.Group(), () => {});
    try {
      actor.update({ ...base, targetId: "sechoir" });
      let moving = true;
      for (let t = 0; moving && t <= 14000; t += 200) moving = actor.tick(t);
      expect(moving).toBe(false);
      expect(actor.getPose().state).toBe("idle");
    } finally { actor.dispose(); }
  });
  it.each(["pbi", "spread", "pour"] as const)("finishes the accepted %s on the aisle facing the selected cell", gesture => {
    const actor = createGrowRoomActor(new THREE.Group(), () => {});
    const bed = { ...layout.items[0], width: 3, depth: 3 };
    const plan = { ...layout, items: [bed] };
    const target = { zoneId: bed.id, x: 1, y: 0 };
    const input = { ...base, layout: plan, targetId: bed.id };
    const event = { zoneId: bed.id, gesture, id: 46, target };
    actor.update(input);
    expect(actor.getPose().deposited).toBeNull();
    actor.update({ ...input, event });
    let gestured = false, deposited = false;
    for (let t = 0; t < 30000; t += 33) {
      const more = actor.tick(t), pose = actor.getPose();
      if (pose.state === "walking" || pose.state === "turning") expect(pose.deposited).toBeNull();
      if (pose.state === gesture) {
        expect(pose.x).toBeCloseTo(-2);
        expect(pose.z).toBeCloseTo(-1.83);
        gestured = true;
      }
      if (pose.deposited) { expect(gestured).toBe(true); expect(pose.deposited).toBe(event); deposited = true; }
      if (!more) break;
    }
    expect(deposited).toBe(true);
    actor.update({ ...input, event });
    expect(actor.tick(32000)).toBe(false);
    actor.dispose();
  });
  it("walks to an open aisle and sweeps the floor several times with both hands on the handle", () => {
    const world = new THREE.Group(), actor = createGrowRoomActor(world, () => {});
    const graph = createGrowRoomPaths(layout);
    const input = { ...base, targetId: "herbes", event: { id: "maintenance", zoneId: "herbes", gesture: "sweep" as const } };
    actor.update(input);
    const broom = world.getObjectByName("sweep")!, shaft = world.getObjectByName("broom-handle")!;
    const strokes: number[] = [], seen = new Set<string>();
    let previous = actor.getPose();
    for (let t = 0; t < 30000; t += 33) {
      const more = actor.tick(t), pose = actor.getPose();
      expect(graph.canWalk(previous, pose)).toBe(true);
      seen.add(pose.state);
      if (pose.state === "sweep" && broom.visible) {
        expect(seen.has("walking")).toBe(true);
        expect(Math.hypot(pose.x - layout.entry.x, pose.z - layout.entry.z)).toBeGreaterThan(.7);
        expect(broom.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0);
        for (const [i, name] of ["working-hand", "supporting-hand"].entries()) {
          const hand = world.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
          expect(shaft.worldToLocal(hand).distanceTo(new THREE.Vector3(0, i ? .98 : .64, 0))).toBeLessThan(.001);
        }
        const side = Math.sign(broom.position.x);
        if (Math.abs(broom.position.x) > .10 && side !== strokes.at(-1)) strokes.push(side);
      }
      previous = pose;
      if (!more) break;
    }
    expect(strokes.length).toBeGreaterThanOrEqual(5);
    expect(actor.getPose().state).toBe("idle");
    actor.dispose();
  });
  it.each([["spread", "spread"], ["pour", "water"]] as const)("shows the %s tool and falling product during application", (gesture, tool) => {
    const model = createGrowWorker(), grains = model.object.getObjectByName("falling-input") as THREE.InstancedMesh;
    model.pose(0, 0, gesture, .46, 3);
    expect(model.object.getObjectByName(tool)?.visible).toBe(true);
    expect(model.object.getObjectByName("pbi")?.visible).toBe(false);
    const before = new THREE.Matrix4();
    grains.getMatrixAt(0, before);
    model.pose(0, 0, gesture, .49, 3);
    expect(grains.visible).toBe(true);
    const after = new THREE.Matrix4();
    grains.getMatrixAt(0, after);
    expect(after.equals(before)).toBe(false);
    model.pose(0, 0, null, 0, 3);
    expect(grains.visible).toBe(false);
    model.dispose();
  });
  it("puts the watering can low, reaches the upper rail to dry, and keeps both soles on the floor", () => {
    const model = createGrowWorker(base.profile);
    const hand = model.object.getObjectByName("working-hand")!;
    const soles: THREE.Object3D[] = [];
    model.object.traverse(part => { if (part.name === "shoe-and-sole") soles.push(part); });
    const heights = [];
    for (const [kind, stage] of [["water", 0], ["harvest", 5], ["dry", 5]] as const) {
      model.pose(0, 0, kind, .5, stage);
      model.object.updateMatrixWorld(true);
      heights.push(hand.getWorldPosition(new THREE.Vector3()).y);
      expect(model.object.getObjectByName(kind)?.visible).toBe(true);
      for (const sole of soles) expect(new THREE.Box3().setFromObject(sole, true).min.y).toBeCloseTo(0, 2);
    }
    expect(heights[1]).toBeGreaterThan(heights[0] + .35);
    expect(heights[2]).toBeCloseTo(1.08, 1);
    model.pose(0, 0, "store", .5, null, "LP-SUPER-1L");
    expect(model.object.getObjectByName("jar")?.visible).toBe(true);
    expect(hand.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(.28, 1);
    model.pose(0, 0, "store", .5, null, "CURTEC-60L");
    expect(model.object.getObjectByName("jar")?.visible).toBe(false);
    expect(hand.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(.774, 1);
    model.dispose();
  });
  it("redirects at the current feet, approaches the real front, turns and performs the receipt once", () => {
    const world = new THREE.Group(), actor = createGrowRoomActor(world, () => { }), graph = createGrowRoomPaths(layout);
    const dry = { ...base, targetId: "sechoir", event: { zoneId: "sechoir", id: 7, gesture: "dry" as const } };
    actor.update({ ...base, targetId: "herbes", event: { zoneId: "herbes", id: 6, gesture: "water" } });
    let time = 0;
    while (time < 1500) {
      actor.tick(time);
      time += 33;
    }
    const before = actor.getPose();
    actor.update(dry);
    expect(actor.getPose()).toMatchObject({ x: before.x, z: before.z, targetId: "sechoir", personalized: true });
    actor.update({ ...dry, event: null });
    let didWork = false, previous = before;
    for (let i = 0; i < 650; i++) {
      const more = actor.tick(time);
      time += 33;
      const pose = actor.getPose();
      expect(graph.canWalk(previous, pose)).toBe(true);
      expect(Math.hypot(pose.x - previous.x, pose.z - previous.z)).toBeLessThan(.051);
      if (pose.state === "dry") {
        didWork = true;
        expect(pose.x).toBeCloseTo(3.33);
        expect(Math.sin(pose.yaw)).toBeCloseTo(-1);
      }
      previous = pose;
      if (!more) break;
    }
    expect(didWork).toBe(true);
    expect(actor.getPose().state).toBe("idle");
    actor.update(dry);
    expect(actor.tick(time)).toBe(false);
    actor.dispose();
    expect(world.children).toHaveLength(0);
  });
  it("recomputes routes on a saved plan edit, and performs no remote gesture at a blocked front", () => {
    const actor = createGrowRoomActor(new THREE.Group(), () => { });
    const input = { ...base, targetId: "stock", event: { id: "receipt", zoneId: "stock", gesture: "store" as const } };
    actor.update(input);
    for (let t = 0; t < 440; t += 33)actor.tick(t);
    const feet = actor.getPose();
    const blocked = { ...layout, items: [...layout.items, { id: "wall", name: "Paroi", kind: "partition" as const, x: -1, z: 1.5, width: 2, depth: .12, rotation: 0 as const }] };
    actor.update({ ...input, layout: blocked });
    expect(actor.getPose()).toMatchObject({ x: feet.x, z: feet.z, state: "blocked" });
    expect(actor.tick(9000)).toBe(false);
    actor.update(input);
    const states = new Set<string>();
    for (let t = 9000; t < 26000; t += 40) {
      const more = actor.tick(t);
      states.add(actor.getPose().state);
      if (!more) break;
    }
    expect(states.has("store")).toBe(true);
    actor.dispose();
  });
  it("looks at a selected seedling only after arriving, without a work receipt", () => {
    const actor = createGrowRoomActor(new THREE.Group(), () => {});
    actor.update({ ...base, targetId: "stock" });
    actor.update({ ...base, targetId: "herbes", stage: 0 });
    const states: string[] = [];
    for (let time = 0; time < 25000; time += 33) {
      const moving = actor.tick(time);
      const { state } = actor.getPose();
      if (states.at(-1) !== state) states.push(state);
      if (!moving) break;
    }
    expect(states.indexOf("walking")).toBeGreaterThanOrEqual(0);
    expect(states.indexOf("inspect")).toBeGreaterThan(states.lastIndexOf("walking"));
    expect(states.at(-1)).toBe("idle");
    actor.dispose();
  });
  it("freezes offscreen and with motion reduced, without advancing the gesture clock", () => {
    const actor = createGrowRoomActor(new THREE.Group(), () => { });
    const next = { ...base, targetId: "herbes" };
    actor.update(next);
    actor.tick(10);
    actor.tick(50);
    const feet = actor.getPose();
    actor.update({ ...next, visible: false });
    expect(actor.tick(90000)).toBe(false);
    actor.update({ ...next, motion: false });
    expect(actor.tick(91200)).toBe(false);
    expect(actor.getPose()).toMatchObject({ x: feet.x, z: feet.z });
    actor.update(next);
    actor.tick(91210);
    expect(actor.getPose()).toMatchObject({ x: feet.x, z: feet.z });
    actor.dispose();
  });
});
