import { Object3D } from "three";
import { MAP_ENTRANCES } from "../KqPlacardMap.scene";
import { VILLAGE_CHARACTER_STRIDE_PER_METER } from "./village-character-gait";
import { paintingToGround } from "./village-layout";
import type { VillageLifeFrame, VillageWalkSurface } from "./village-life-types";
import type { FishingPhase, NpcActivity, NpcPoint, VillageNpcId, VillageNpcInteraction, VillageNpcRoutineState } from "./village-npc-types";
import type { VillageGroundPath } from "./village-walk-surface";

export const VILLAGE_NPC_WALK_RADIUS = 0.3;
type Point = { x: number; z: number };
export type VillageNpcObstacle = Point & { radius: number };
type Node = Point & { edges: number[] };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const phaseNames: readonly FishingPhase[] = ["adjust", "wait", "watch", "reach", "sip", "replace"];
const phaseDurations = [3.2, 12.5, 5.4, 1.5, 3.1, 1.8];
const walkHeadingLimit = 0.3;
const brake = 2.4;

function clearSegment(surface: VillageWalkSurface, a: Point, b: Point) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 0.09));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!surface.isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, VILLAGE_NPC_WALK_RADIUS)) return false;
  }
  return true;
}

/** Exact segment/circle test also catches a collision between frame endpoints. */
function clearResidents(a: Point, b: Point, obstacles: readonly VillageNpcObstacle[]) {
  const dx = b.x - a.x, dz = b.z - a.z, lengthSquared = dx * dx + dz * dz;
  return obstacles.every(obstacle => {
    const t = lengthSquared ? clamp(((obstacle.x - a.x) * dx + (obstacle.z - a.z) * dz) / lengthSquared, 0, 1) : 0;
    return Math.hypot(obstacle.x - a.x - dx * t, obstacle.z - a.z - dz * t) >= VILLAGE_NPC_WALK_RADIUS + obstacle.radius + 0.015;
  });
}

/** Three narrow lanes retain the real paths while allowing safe passage around props. */
function pathCandidates(paths: readonly VillageGroundPath[]) {
  const result: Point[] = [];
  for (const path of paths) for (let i = 0; i < path.samples.length; i++) {
    const p = path.samples[i], before = path.samples[Math.max(0, i - 1)], after = path.samples[Math.min(path.samples.length - 1, i + 1)];
    const length = Math.max(1e-6, distance(before, after));
    const offset = Math.min(0.46, Math.max(0, path.width / 2 - VILLAGE_NPC_WALK_RADIUS - 0.18));
    for (const side of [0, -1, 1]) result.push({ x: p.x + (after.z - before.z) / length * offset * side, z: p.z - (after.x - before.x) / length * offset * side });
  }
  return result;
}

/** Choose a safe initial transform before adding the rig; routines never teleport. */
export function findVillageNpcPathSpawn(surface: VillageWalkSurface, paths: readonly VillageGroundPath[], preferred: NpcPoint): NpcPoint | null {
  let best: Point | undefined, nearest = Infinity;
  for (const point of pathCandidates(paths)) {
    const d = Math.hypot(point.x - preferred[0], point.z - preferred[2]);
    if (d < nearest && surface.isWalkable(point.x, point.z, VILLAGE_NPC_WALK_RADIUS)) { best = point; nearest = d; }
  }
  return best ? [best.x, surface.heightAt(best.x, best.z), best.z] : null;
}

function buildGraph(surface: VillageWalkSurface, paths: readonly VillageGroundPath[], initial: Point) {
  const nodes: Node[] = [], buckets = new Map<string, number[]>();
  const key = (x: number, z: number) => `${x},${z}`;
  const size = 0.72;
  for (const point of [initial, ...pathCandidates(paths)]) {
    if (!surface.isWalkable(point.x, point.z, VILLAGE_NPC_WALK_RADIUS)) continue;
    const bx = Math.floor(point.x / size), bz = Math.floor(point.z / size);
    const candidates: number[] = [];
    for (let x = bx - 1; x <= bx + 1; x++) for (let z = bz - 1; z <= bz + 1; z++) candidates.push(...(buckets.get(key(x, z)) ?? []));
    if (candidates.some(index => distance(nodes[index], point) < 0.08)) continue;
    const index = nodes.length, node: Node = { ...point, edges: [] };
    for (const other of candidates) if (distance(nodes[other], point) < size && clearSegment(surface, nodes[other], point)) {
      node.edges.push(other); nodes[other].edges.push(index);
    }
    nodes.push(node);
    const own = key(bx, bz); buckets.set(own, [...(buckets.get(own) ?? []), index]);
  }
  // Initial roots may stand just beside a path, but every approach is collision checked.
  if (nodes.length && distance(nodes[0], initial) < 0.01 && !nodes[0].edges.length) {
    const nearby = nodes.map((node, index) => ({ index, d: distance(node, initial) })).filter(item => item.index && item.d < 2.5).sort((a, b) => a.d - b.d);
    for (const { index } of nearby) if (clearSegment(surface, initial, nodes[index])) { nodes[0].edges.push(index); nodes[index].edges.push(0); break; }
  }
  return nodes;
}

function reachable(nodes: Node[], start: number) {
  const visited = new Set<number>([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const next of nodes[queue[i]]?.edges ?? []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
  return queue;
}

function routeTo(nodes: Node[], start: number, destination: number, allowed: (a: Point, b: Point) => boolean = () => true) {
  const cost = new Map<number, number>([[start, 0]]), previous = new Map<number, number>(), open = new Set([start]);
  while (open.size) {
    let current = -1, lowest = Infinity;
    for (const node of open) { const value = cost.get(node)! + distance(nodes[node], nodes[destination]); if (value < lowest) { current = node; lowest = value; } }
    if (current === destination) {
      const result = [current]; while (previous.has(current)) { current = previous.get(current)!; result.unshift(current); } return result.slice(1);
    }
    open.delete(current);
    for (const next of nodes[current].edges) {
      if (!allowed(nodes[current], nodes[next])) continue;
      const value = cost.get(current)! + distance(nodes[current], nodes[next]);
      if (value < (cost.get(next) ?? Infinity)) { cost.set(next, value); previous.set(next, current); open.add(next); }
    }
  }
  return [];
}

export function createVillageNpcRoutine(id: VillageNpcId, surface: VillageWalkSurface, paths: readonly VillageGroundPath[], initial: NpcPoint, initialYaw = 0.46, dynamicObstacles: () => readonly VillageNpcObstacle[] = () => []) {
  const state: VillageNpcRoutineState = {
    position: [...initial], yaw: initialYaw, destination: 0,
    pose: { activity: id === "fisherman" ? "fishing" : "observing", speed: 0, stride: 0, lookYaw: 0, lookPitch: 0, emphasis: 0, attention: 0, fishingPhase: "adjust", phaseProgress: 0 },
  };
  const probe = new Object3D();
  const nodes = id === "fisherman" ? [] : buildGraph(surface, paths, { x: initial[0], z: initial[2] });
  const connected = nodes.length && distance(nodes[0], { x: initial[0], z: initial[2] }) < 0.01 ? reachable(nodes, 0) : [];
  const stops: number[] = [];
  for (const entrance of Object.values(MAP_ENTRANCES)) {
    const [x, z] = paintingToGround(...entrance);
    const nearest = connected.reduce((best, index) => Math.hypot(nodes[index].x - x, nodes[index].z - z - 1.25) < Math.hypot(nodes[best].x - x, nodes[best].z - z - 1.25) ? index : best, connected[0]);
    if (nearest !== undefined && stops.every(other => distance(nodes[nearest], nodes[other]) > 2)) stops.push(nearest);
  }
  if (stops.length < 3) for (const index of connected) if (stops.every(other => distance(nodes[index], nodes[other]) > 3)) stops.push(index);
  let current = 0, route: number[] = [], pause = id === "loic" ? 1.7 : 2.3, visit = id === "loic" ? 2 : 0, clock = 0;
  let blockedFor = 0, replanIn = 0, yielding = false;
  let ground = initial[1];
  let fishingIndex = 0, fishingElapsed = 0, fishingCycle = 0;
  const calmActivity = (): NpcActivity => id === "breton" && visit % 3 === 1 ? "playing" : visit % 2 ? "idle" : "observing";

  return { update(frame: VillageLifeFrame, target?: NpcPoint, interaction?: VillageNpcInteraction): VillageNpcRoutineState {
    const pose = state.pose;
    const dt = clamp(Number.isFinite(frame.delta) ? frame.delta : 0, 0, 0.05);
    probe.position.set(...state.position); probe.updateMatrixWorld(true);
    if (!interaction && !frame.visible(probe, 2.7)) return state;
    if (frame.reduced) {
      pose.speed = 0; pose.activity = interaction ? interaction.type === "song" ? "singing" : "greeting" : id === "fisherman" ? "fishing" : "idle";
      pose.attention = interaction ? 1 : 0; pose.emphasis = interaction?.emphasis ?? 0;
      pose.lookYaw = 0; pose.lookPitch = 0;
      return state;
    }
    clock += dt;
    pose.attention += ((interaction ? 1 : 0) - pose.attention) * (1 - Math.exp(-dt * 5));
    pose.emphasis += ((interaction?.emphasis ?? (pose.activity === "playing" ? 0.5 : 0)) - pose.emphasis) * (1 - Math.exp(-dt * 7));

    if (id === "fisherman") {
      // Pause the exact fishing phase; attention lowers the bottle in the rig.
      if (!interaction && pose.attention < 0.04) {
        fishingElapsed += dt;
        const duration = phaseDurations[fishingIndex] * (1 + Math.sin(fishingCycle * 1.7) * 0.12);
        if (fishingElapsed >= duration) { fishingElapsed -= duration; fishingIndex = (fishingIndex + 1) % phaseNames.length; if (!fishingIndex) fishingCycle++; }
        pose.fishingPhase = phaseNames[fishingIndex];
        pose.phaseProgress = clamp(fishingElapsed / (phaseDurations[fishingIndex] * (1 + Math.sin(fishingCycle * 1.7) * 0.12)), 0, 1);
      }
      pose.activity = interaction ? "greeting" : ["reach", "sip", "replace"].includes(pose.fishingPhase) ? "drinking" : "fishing";
    } else {
      const obstacles = dynamicObstacles();
      const point = { x: state.position[0], z: state.position[2] };
      const safe = (a: Point, b: Point) => clearResidents(a, b, obstacles);
      replanIn = Math.max(0, replanIn - dt);
      const replan = () => {
        const connectors = connected.filter(index => distance(point, nodes[index]) < 0.85 && clearSegment(surface, point, nodes[index]) && safe(point, nodes[index]));
        const virtual = [...nodes, { ...point, edges: connectors }];
        return routeTo(virtual, nodes.length, state.destination, safe);
      };
      if (!interaction && pose.attention < 0.04 && yielding && !route.length && replanIn <= 0) {
        route = replan(); replanIn = 0.6;
        if (route.length) yielding = false;
      }
      if (!interaction && pose.attention < 0.04 && !route.length && !yielding) {
        pause -= dt;
        if (pause <= 0 && stops.length > 1 && connected.length) {
          const choices = stops.filter(node => distance(nodes[node], { x: state.position[0], z: state.position[2] }) > 2);
          if (choices.length) {
            state.destination = choices[(visit * (id === "loic" ? 3 : 5) + Math.floor(visit / 3)) % choices.length];
            route = routeTo(nodes, current, state.destination); visit++;
          }
          if (!route.length) pause = 3;
        }
      }
      // Different retry delays give Loïc the first chance to step aside. The
      // destination remains the original entrance throughout this local detour.
      if (!interaction && pose.attention < 0.04 && route.length && blockedFor > (id === "loic" ? 0.42 : 0.85) && replanIn <= 0) {
        const alternate = replan();
        if (alternate.length) { route = alternate; yielding = false; }
        else if (!yielding) {
          const next = nodes[route[0]], dx = next.x - point.x, dz = next.z - point.z, length = Math.max(0.001, Math.hypot(dx, dz));
          const clearance = (p: Point) => Math.min(...obstacles.map(other => distance(p, other)), 2);
          const candidates = connected.map(index => {
            const node = nodes[index], x = node.x - point.x, z = node.z - point.z;
            const lateral = (dx * z - dz * x) / length, forward = (dx * x + dz * z) / length;
            return { index, lateral, forward, d: distance(point, node), score: Math.abs(lateral) * 2 + clearance(node) - clearance(point) + lateral * (id === "loic" ? 0.1 : -0.1) };
          }).filter(candidate => candidate.d > 0.12 && candidate.d < 0.85 && Math.abs(candidate.forward) < 0.35 && Math.abs(candidate.lateral) > 0.12
            && clearSegment(surface, point, nodes[candidate.index]) && safe(point, nodes[candidate.index]));
          candidates.sort((a, b) => b.score - a.score || a.index - b.index);
          if (candidates.length) { route = [candidates[0].index]; yielding = true; }
        }
        replanIn = id === "loic" ? 0.6 : 0.95; blockedFor = 0;
      }
      // A replanned route may start at the node the resident already occupies.
      while (route.length && distance(nodes[route[0]], point) < 0.00001) current = route.shift()!;
      const next = nodes[route[0]];
      if (next) {
        const dx = next.x - point.x, dz = next.z - point.z;
        const remaining = Math.hypot(dx, dz), heading = Math.atan2(dx, dz);
        const canResume = !interaction && pose.attention < 0.1;
        const turn = angleDifference(heading, state.yaw);
        if (canResume) state.yaw += clamp(turn, -dt * 3.4, dt * 3.4);
        const aligned = Math.abs(angleDifference(heading, state.yaw)) <= walkHeadingLimit;
        const following = nodes[route[1]];
        const corner = following ? Math.abs(angleDifference(Math.atan2(following.x - next.x, following.z - next.z), heading)) : Math.PI;
        const topSpeed = id === "loic" ? 0.82 : 0.7;
        const approachSpeed = corner > walkHeadingLimit ? Math.min(topSpeed, Math.sqrt(2 * 1.4 * remaining)) : topSpeed;
        const wanted = canResume && aligned ? approachSpeed : 0;
        const speed = pose.speed + clamp(wanted - pose.speed, -dt * brake, dt * 1.25);
        const step = aligned ? Math.min(remaining, speed * dt) : 0;
        if (step > 0) {
          const factor = step / remaining;
          const moved = { x: point.x + dx * factor, z: point.z + dz * factor };
          if (clearSegment(surface, point, moved) && safe(point, moved)) {
            blockedFor = 0;
            state.position[0] = moved.x; state.position[2] = moved.z;
            ground = surface.heightAt(moved.x, moved.z);
            pose.stride = (pose.stride + step * VILLAGE_CHARACTER_STRIDE_PER_METER) % (Math.PI * 2);
            pose.speed = step / dt;
            if (step === remaining) {
              current = route.shift()!;
              if (!route.length && !yielding) pause = (id === "loic" ? 3.8 : 6.5) + (Math.sin(visit * 1.9) + 1) * 1.6;
            }
          } else { pose.speed = 0; blockedFor += dt; }
        } else if (dt > 0) pose.speed = 0;
      } else pose.speed = 0;
      state.position[1] += clamp(ground - state.position[1], -dt * 0.7, dt * 0.7);
      pose.activity = interaction ? interaction.type === "song" ? "singing" : "greeting" : pose.speed > 0.04 ? "walking" : calmActivity();
    }

    let wantedLook = Math.sin(clock * 0.4 + visit) * 0.19, wantedPitch = -0.035;
    if (interaction && target) {
      const dx = target[0] - state.position[0], dz = target[2] - state.position[2];
      const gaze = Math.atan2(dx, dz);
      // The musician/guide accompany a wide gaze with shoulders/body; the seated fisherman keeps his tackle anchored.
      if (id !== "fisherman" && pose.speed < 0.025) {
        const excess = angleDifference(gaze, state.yaw);
        if (Math.abs(excess) > 0.65) state.yaw += clamp(excess - Math.sign(excess) * 0.65, -dt * 1.7, dt * 1.7);
      }
      wantedLook = clamp(angleDifference(gaze, state.yaw), -0.75, 0.75);
      wantedPitch = clamp(-Math.atan2(target[1] - state.position[1] - 1.55, Math.max(0.1, Math.hypot(dx, dz))), -0.3, 0.3);
    }
    pose.lookYaw += (wantedLook - pose.lookYaw) * (1 - Math.exp(-dt * 5));
    pose.lookPitch += (wantedPitch - pose.lookPitch) * (1 - Math.exp(-dt * 5));
    return state;
  } };
}
