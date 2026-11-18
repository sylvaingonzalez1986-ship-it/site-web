import { describe, expect, it } from "vitest";
import { createVillageBuilding } from "./village-buildings";
import { VILLAGE_CHARACTER_STRIDE_PER_METER } from "./village-character-gait";
import { paintingToGround, VILLAGE_PLACES, villagePlacePosition } from "./village-layout";
import type { VillageLifeFrame, VillageWalkSurface } from "./village-life-types";
import { createVillageNpcRoutine, createVillagePlayerRoute, findVillageNpcPathSpawn, VILLAGE_NPC_WALK_RADIUS } from "./village-npc-routine";
import { createVillageTerrain, disposeVillageObject } from "./village-terrain";
import { createVillageWalkSurface, type VillageGroundPath } from "./village-walk-surface";
import type { FishingPhase, NpcPoint } from "./village-npc-types";

const frame = (time: number, overrides: Partial<VillageLifeFrame> = {}): VillageLifeFrame => ({ time, delta: 1 / 30, reduced: false, quality: "high", visible: () => true, ...overrides });

describe("village NPC routines", () => {
  it("uses connected real paths and avoids buildings, mailbox, river and terrain props over several visits", () => {
    const terrain = createVillageTerrain();
    const buildings = VILLAGE_PLACES.map(place => ({ place, object: createVillageBuilding(place.id), position: villagePlacePosition(place) }));
    const surface = createVillageWalkSurface(terrain, buildings), paths: VillageGroundPath[] = terrain.userData.groundPaths;
    const [bx, bz] = paintingToGround(1030, 640), [lx, lz] = paintingToGround(620, 580);
    try {
      const pathHeights = new Set(paths.flatMap(path => path.samples.map(({ x, z }) => surface.heightAt(x, z))));
      expect(pathHeights).toContain(0.044);
      expect(pathHeights).toContain(0.049);
      expect(pathHeights).toContain(0.0585);
      for (const [id, preferred] of [["breton", [bx, 0.08, bz]], ["loic", [lx, 0.08, lz]]] as const) {
        const spawn = findVillageNpcPathSpawn(surface, paths, [...preferred])!;
        expect(spawn).not.toBeNull();
        const routine = createVillageNpcRoutine(id, surface, paths, spawn);
        let previous = [...spawn], travelled = 0, maxRange = 0;
        const destinations = new Set<number>(), activities = new Set<string>();
        for (let tick = 0; tick < 30 * 250; tick++) {
          const state = routine.update(frame(tick / 30));
          const step = Math.hypot(state.position[0] - previous[0], state.position[2] - previous[2]);
          if (step > 0.028) throw new Error(`${id} jumped ${step}`);
          if (!surface.isWalkable(state.position[0], state.position[2], VILLAGE_NPC_WALK_RADIUS)) throw new Error(`${id} hit scenery at ${state.position}`);
          for (let sample = 0; sample <= 3; sample++) {
            const t = sample / 3;
            if (!surface.isWalkable(previous[0] + (state.position[0] - previous[0]) * t, previous[2] + (state.position[2] - previous[2]) * t, VILLAGE_NPC_WALK_RADIUS)) throw new Error(`${id} cut a collision corner`);
          }
          const onPath = paths.some(path => path.samples.some(point => Math.hypot(point.x - state.position[0], point.z - state.position[2]) < path.width / 2));
          if (!onPath) throw new Error(`${id} left the existing path network`);
          travelled += step; maxRange = Math.max(maxRange, Math.hypot(state.position[0] - spawn[0], state.position[2] - spawn[2]));
          if (state.pose.activity === "walking") destinations.add(state.destination);
          activities.add(state.pose.activity); previous = [...state.position];
        }
        expect(travelled, `${id} travelled`).toBeGreaterThan(35);
        expect(maxRange, `${id} range`).toBeGreaterThan(5);
        expect(destinations.size, `${id} entrance stops`).toBeGreaterThanOrEqual(3);
        expect(activities.has("walking")).toBe(true); expect(activities.has("observing")).toBe(true);
        if (id === "breton") expect(activities.has("playing")).toBe(true);
      }
      const pairPositions = [[bx, 0.08, bz], [lx, 0.08, lz]].map(point => findVillageNpcPathSpawn(surface, paths, point as NpcPoint)!);
      const pair = (["breton", "loic"] as const).map((id, index) => createVillageNpcRoutine(id, surface, paths, pairPositions[index], 0,
        () => pairPositions.filter((_position, other) => other !== index).map(position => ({ x: position[0], z: position[2], radius: 0.4 }))));
      const pairTravel = [0, 0];
      for (let tick = 0; tick < 30 * 160; tick++) pair.forEach((routine, index) => {
        const before = [...pairPositions[index]], state = routine.update(frame(tick / 30));
        pairPositions[index] = [...state.position];
        pairTravel[index] += Math.hypot(state.position[0] - before[0], state.position[2] - before[2]);
        if (!surface.isWalkable(state.position[0], state.position[2], 0.3)) throw new Error("Avoidance left real walk surface");
        if (Math.hypot(pairPositions[0][0] - pairPositions[1][0], pairPositions[0][2] - pairPositions[1][2]) < 0.715 - 1e-6) throw new Error("Real-world residents intersected");
      });
      expect(pairTravel[0]).toBeGreaterThan(20); expect(pairTravel[1]).toBeGreaterThan(20);
    } finally { buildings.forEach(building => disposeVillageObject(building.object)); disposeVillageObject(terrain); }
  }, 30000);

  it("slows for attention, preserves its goal and position, clamps gaze and resumes without catchup", () => {
    const surface: VillageWalkSurface = { isWalkable: () => true, heightAt: () => 0.08 };
    const paths = [{ samples: Array.from({ length: 35 }, (_, i) => ({ x: i * 0.4, z: 0 })), width: 1.6 }];
    const routine = createVillageNpcRoutine("loic", surface, paths, [0, 0.08, 0]);
    let state = routine.update(frame(0));
    for (let i = 0; i < 120; i++) state = routine.update(frame(i / 30));
    expect(state.pose.speed).toBeGreaterThan(0.1);
    expect(state.pose.walkBlend).toBeGreaterThan(0.9);
    const goal = state.destination, start = [...state.position];
    const walkingYaw = state.yaw, walkingSpeed = state.pose.speed, originalLook = state.pose.lookYaw;
    const interruption = { type: "tutorial", emphasis: 0.5 } as const;
    for (let i = 0; i < 8; i++) {
      const previousBlend = state.pose.walkBlend!;
      state = routine.update(frame(4 + i / 30), [-10, 5, -10], interruption);
      expect(state.yaw).toBe(walkingYaw);
      expect(Math.abs(state.pose.walkBlend! - previousBlend)).toBeLessThanOrEqual(5 / 30 + 1e-8);
    }
    expect(state.pose.speed).toBeLessThan(walkingSpeed);
    expect(Math.abs(state.pose.lookYaw - originalLook)).toBeGreaterThan(0.1);
    for (let i = 8; i < 90; i++) state = routine.update(frame(4 + i / 30), [-10, 5, -10], interruption);
    expect(state.destination).toBe(goal); expect(state.pose.speed).toBeLessThan(0.01);
    expect(state.pose.walkBlend).toBe(0);
    expect(Math.hypot(state.position[0] - start[0], state.position[2] - start[2])).toBeLessThan(0.2);
    expect(Math.abs(state.pose.lookYaw)).toBeLessThanOrEqual(0.75); expect(Math.abs(state.pose.lookPitch)).toBeLessThanOrEqual(0.3);
    const paused = [...state.position];
    routine.update(frame(900, { delta: 800, visible: () => false }));
    expect(state.position).toEqual(paused);
    for (let i = 0; i < 90; i++) state = routine.update(frame(901 + i / 30));
    expect(state.destination).toBe(goal); expect(state.position[0]).toBeGreaterThan(paused[0]);
    const frozen = [...state.position];
    for (let i = 0; i < 90; i++) routine.update(frame(5000 + i, { delta: 100, reduced: true }));
    expect(state.position).toEqual(frozen); expect(state.pose.speed).toBe(0);
  });

  it("never crosses an unconnected barrier or shares another resident's state", () => {
    const surface: VillageWalkSurface = { isWalkable: (x, _z, radius) => Math.abs(x - 5) > radius + 0.02, heightAt: () => 0.08 };
    const paths = [{ samples: Array.from({ length: 30 }, (_, i) => ({ x: i * 0.4, z: 0 })), width: 1.7 }];
    const a = createVillageNpcRoutine("loic", surface, paths, [0, 0.08, 0]);
    const b = createVillageNpcRoutine("breton", surface, paths, [10, 0.08, 0]);
    const before = structuredClone(b.update(frame(0, { delta: 0 })));
    for (let i = 0; i < 4500; i++) {
      const state = a.update(frame(i / 30)); expect(state.position[0]).toBeLessThan(4.7);
    }
    expect(b.update(frame(0, { delta: 0 }))).toEqual(before);
    expect(findVillageNpcPathSpawn({ ...surface, isWalkable: () => false }, paths, [0, 0, 0])).toBeNull();
  });

  it("pivots before moving and advances its walk cycle only by the accepted distance", () => {
    const surface: VillageWalkSurface = { isWalkable: () => true, heightAt: () => 0.08 };
    const paths = [{ samples: Array.from({ length: 35 }, (_, i) => ({ x: i * 0.4, z: 0 })), width: 0.65 }];
    const routine = createVillageNpcRoutine("loic", surface, paths, [0, 0.08, 0], -Math.PI / 2);
    let x = 0, z = 0, yaw = -Math.PI / 2, stride = 0;
    let moving = 0, pivoting = 0, steppedForward = false, steppedBack = false;
    let turnAnticipation = 0;
    const turn = Math.PI * 2;
    for (let i = 0; i < 1500; i++) {
      const state = routine.update(frame(i / 30));
      const dx = state.position[0] - x, dz = state.position[2] - z, distance = Math.hypot(dx, dz);
      const yawChange = Math.abs(state.yaw - yaw), change = (state.pose.stride - stride + turn) % turn;
      expect(change).toBeCloseTo(distance * VILLAGE_CHARACTER_STRIDE_PER_METER, 8);
      expect(yawChange).toBeLessThanOrEqual(3.4 / 30 + 1e-8);
      turnAnticipation = Math.max(turnAnticipation, Math.abs(state.pose.turnLean ?? 0));
      if (distance > 1e-8) {
        const facing = Math.atan2(dx, dz) - state.yaw;
        expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing)))).toBeLessThanOrEqual(0.3 + 1e-8);
        expect(state.pose.speed).toBeCloseTo(distance * 30, 8);
        moving++;
        steppedForward ||= dx > 0;
        steppedBack ||= dx < 0;
      } else if (yawChange > 0.01) {
        expect(state.pose.speed).toBe(0);
        pivoting++;
      }
      [x, , z] = state.position; yaw = state.yaw; stride = state.pose.stride;
    }
    expect(pivoting).toBeGreaterThan(20);
    expect(turnAnticipation).toBeGreaterThan(0.5);
    expect(moving).toBeGreaterThan(300);
    expect(steppedForward && steppedBack).toBe(true);
  });

  it("smooths the player's detour only where its complete footprint fits", () => {
    const surface: VillageWalkSurface = {
      isWalkable: (x, z, radius) => Math.hypot(x - 2, z) > 0.6 + radius,
      heightAt: () => 0.08,
    };
    const paths = [{ samples: Array.from({ length: 11 }, (_, i) => ({ x: i * 0.4, z: -1.4 })), width: 0.9 }];
    const spawn = { x: 0, z: 0 }, target = { x: 4, z: 0 };
    const route = createVillagePlayerRoute(surface, paths, spawn)(spawn, target);
    expect(route.length).toBeGreaterThan(1);
    expect(route.length).toBeLessThan(6);
    expect(route.at(-1)).toEqual(target);
    let previous = spawn;
    for (const point of route) {
      for (let i = 0; i <= 100; i++) {
        const x = previous.x + (point.x - previous.x) * i / 100;
        const z = previous.z + (point.z - previous.z) * i / 100;
        expect(surface.isWalkable(x, z, VILLAGE_NPC_WALK_RADIUS)).toBe(true);
      }
      previous = point;
    }
  });

  it("waits safely for a transient obstruction and resumes the retained route", () => {
    let barrier: number | null = null;
    const surface: VillageWalkSurface = {
      isWalkable: (x, _z, radius) => barrier === null || Math.abs(x - barrier) > radius + 0.04,
      heightAt: () => 0.08,
    };
    const paths = [{ samples: Array.from({ length: 35 }, (_, i) => ({ x: i * 0.4, z: 0 })), width: 1.6 }];
    const routine = createVillageNpcRoutine("loic", surface, paths, [0, 0.08, 0]);
    let state = routine.update(frame(0));
    for (let i = 0; i < 120; i++) state = routine.update(frame(i / 30));
    const goal = state.destination;
    barrier = state.position[0] + 0.8;
    for (let i = 0; i < 100; i++) {
      state = routine.update(frame(4 + i / 30));
      expect(surface.isWalkable(state.position[0], state.position[2], 0.3)).toBe(true);
    }
    expect(state.pose.speed).toBe(0); expect(state.destination).toBe(goal);
    const stopped = state.position[0]; barrier = null;
    for (let i = 0; i < 60; i++) state = routine.update(frame(8 + i / 30));
    expect(state.position[0]).toBeGreaterThan(stopped + 0.5); expect(state.destination).toBe(goal);
  });

  it("keeps two walkers apart, steps into a path lane and resumes both entrance routes", () => {
    const surface: VillageWalkSurface = { isWalkable: (_x, z, radius) => Math.abs(z) + radius < 0.93, heightAt: () => 0.08 };
    const paths = [{ samples: Array.from({ length: 36 }, (_, i) => ({ x: i * 0.4, z: 0 })), width: 1.85 }];
    const positions: NpcPoint[] = [[0, 0.08, 0], [9, 0.08, 0]];
    const routines = (["breton", "loic"] as const).map((id, index) => createVillageNpcRoutine(id, surface, paths, positions[index], 0,
      () => positions.filter((_position, other) => other !== index).map(position => ({ x: position[0], z: position[2], radius: 0.4 }))));
    const travelled = [0, 0], goals = [new Set<number>(), new Set<number>()];
    let closest = Infinity, laneChange = false;
    for (let tick = 0; tick < 30 * 140; tick++) {
      routines.forEach((routine, index) => {
        const before = [...positions[index]], state = routine.update(frame(tick / 30));
        positions[index] = [...state.position];
        const step = Math.hypot(state.position[0] - before[0], state.position[2] - before[2]);
        if (step > 0.028) throw new Error("Resident jumped while avoiding another resident");
        travelled[index] += step; goals[index].add(state.destination);
        laneChange ||= Math.abs(state.position[2]) > 0.25;
        const separation = Math.hypot(positions[0][0] - positions[1][0], positions[0][2] - positions[1][2]);
        closest = Math.min(closest, separation);
        if (separation < 0.715 - 1e-6) throw new Error(`Residents intersected at ${separation}`);
      });
    }
    expect(closest).toBeLessThan(0.9); expect(laneChange).toBe(true);
    expect(travelled[0]).toBeGreaterThan(20); expect(travelled[1]).toBeGreaterThan(20);
    expect(goals[0].size).toBeGreaterThan(2); expect(goals[1].size).toBeGreaterThan(2);
  });

  it("looks up toward a raised camera using a negative Three.js head pitch", () => {
    const routine = createVillageNpcRoutine("fisherman", { isWalkable: () => false, heightAt: () => 0 }, [], [0, 0, 0]);
    let state = routine.update(frame(0));
    for (let i = 0; i < 60; i++) state = routine.update(frame(i / 30), [0, 8, 8], { type: "speech", emphasis: 0.4 });
    expect(state.pose.lookPitch).toBeLessThan(-0.25);
    for (let i = 0; i < 60; i++) state = routine.update(frame(2 + i / 30), [0, -2, 8], { type: "speech", emphasis: 0.4 });
    expect(state.pose.lookPitch).toBeGreaterThan(0.25);
  });

  it("runs unequal fishing phases, lowers for attention and resumes the same phase with fixed tackle", () => {
    const surface: VillageWalkSurface = { isWalkable: () => false, heightAt: () => 0 };
    const initial: NpcPoint = [31, 0.04, 12], routine = createVillageNpcRoutine("fisherman", surface, [], initial, 1.1);
    const phases = new Set<FishingPhase>(), durations = new Map<FishingPhase, number>();
    let state = routine.update(frame(0));
    for (let i = 0; i < 1000; i++) {
      state = routine.update(frame(i / 30)); phases.add(state.pose.fishingPhase);
      durations.set(state.pose.fishingPhase, (durations.get(state.pose.fishingPhase) ?? 0) + 1);
      expect(state.position).toEqual(initial); expect(state.yaw).toBe(1.1);
    }
    expect(phases.size).toBe(6); expect(durations.get("wait")!).toBeGreaterThan(durations.get("sip")! * 2);
    const phase = state.pose.fishingPhase, progress = state.pose.phaseProgress;
    for (let i = 0; i < 120; i++) state = routine.update(frame(40 + i / 30), [0, 8, -20], { type: "speech", emphasis: 0.6 });
    expect(state.pose.fishingPhase).toBe(phase); expect(state.pose.phaseProgress).toBe(progress);
    expect(state.pose.attention).toBeGreaterThan(0.99); expect(state.yaw).toBe(1.1);
    for (let i = 0; i < 60; i++) state = routine.update(frame(44 + i / 30));
    expect(state.pose.attention).toBeLessThan(0.01);
    const frozen = structuredClone(state);
    for (let i = 0; i < 60; i++) state = routine.update(frame(900 + i, { delta: Number.NaN, reduced: true }));
    expect(state.position).toEqual(frozen.position); expect(state.pose.phaseProgress).toBe(frozen.pose.phaseProgress);
    expect(Object.values(state.pose).every(value => typeof value !== "number" || Number.isFinite(value))).toBe(true);
  });
});
