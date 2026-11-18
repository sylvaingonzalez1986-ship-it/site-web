import * as THREE from "three";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createGrowRoomPaths, type GrowPoint } from "@/lib/kanab-quest-grow-room-path";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { growRoomGestureDuration, type KqGrowRoomEvent } from "./KqGrowRoomModel";
import { createGrowWorker } from "./kq-grow-worker-model";

type Gesture = KqGrowRoomEvent["gesture"];
type ActorState = "idle" | "walking" | "turning" | "blocked" | Gesture;
type ActorInput = {
  layout: WarehouseSpatialLayout; targetId: string | null; stage: number | null; event?: KqGrowRoomEvent | null;
  profile?: ChanvrierAvatarProfile | null; motion: boolean; visible: boolean
};
const speeds = { walk: 1.48, turn: 4.6 };

export function createGrowRoomActor(world: THREE.Group, requestFrame: () => void) {
  let input: ActorInput | null = null;
  let worker: ReturnType<typeof createGrowWorker> | null = null;
  let paths: ReturnType<typeof createGrowRoomPaths> | null = null;
  let layoutKey = "", profileKey = "";
  const seenEvents = new Set<string>();
  let pos: GrowPoint = { x: 0, z: 0 }, yaw = 0, distance = 0, targetYaw = 0, speed = 0;
  let route: GrowPoint[] = [], waypoint = 0, acting: Gesture | null = null, elapsed = 0;
  let workReceipt: KqGrowRoomEvent | null = null, deposited: KqGrowRoomEvent | null = null;
  let state: ActorState = "idle", time: number | null = null, settling = 0;
  let name = "", blockedUnderFurniture = false, deviceCode: string | undefined;

  function update(next: ActorInput) {
    const prev = input;
    const look = JSON.stringify(next.profile ?? null);
    if (!worker || profileKey !== look) {
      worker?.dispose();
      worker = createGrowWorker(next.profile ?? undefined);
      profileKey = look;
      world.add(worker.object);
    }
    const key = prev?.layout === next.layout ? layoutKey : JSON.stringify([next.layout.width, next.layout.depth,
      ...next.layout.items.map(i => [i.id, i.name, i.kind, i.x, i.z, i.width, i.depth, i.rotation, i.deviceCode])]);
    const rebuilt = !paths || key !== layoutKey;
    if (rebuilt) {
      paths = createGrowRoomPaths(next.layout);
      layoutKey = key;
      if (!prev) pos = { ...next.layout.entry };
      else {
        // A floor extension preserves cell addresses measured from its back-left corner.
        pos = { x: pos.x + (prev.layout.width - next.layout.width) / 2, z: pos.z + (prev.layout.depth - next.layout.depth) / 2 };
      }
    }
    input = next;
    const e = next.event?.zoneId === next.targetId ? next.event : null;
    const eventToken = e ? JSON.stringify([e.zoneId, e.id, e.gesture]) : "";
    const newEvent = !!e && !seenEvents.has(eventToken);
    const targetChanged = prev?.targetId !== next.targetId;
    if (rebuilt || targetChanged || newEvent) {
      if (targetChanged || newEvent) {
        workReceipt = newEvent ? e : null;
        deposited = null;
      }
      const routeTo = workReceipt?.gesture === "sweep" ? paths!.sweep(pos)
        : next.targetId ? paths!.route(pos, next.targetId, workReceipt?.target) : null;
      const station = next.layout.items.find(item => item.id === next.targetId);
      name = workReceipt?.gesture === "sweep" ? "l’allée" : station?.name ?? "";
      deviceCode = station?.deviceCode;
      blockedUnderFurniture = !paths!.canWalk(pos, pos);
      route = routeTo?.points ?? [];
      waypoint = 0;
      targetYaw = routeTo?.yaw ?? yaw;
      // On redirection, keep the actual feet position and replace the abandoned
      // route. Inspecting a plant is visual. Work gestures follow receipts.
      if (e && newEvent) {
        acting = e.gesture;
        seenEvents.add(eventToken);
        if (seenEvents.size > 32) seenEvents.delete(seenEvents.values().next().value!);
      } else if (targetChanged) {
        acting = prev && station?.kind === "culture" && next.stage !== null && next.stage < 5 ? "inspect" : null;
      }
      elapsed = 0;
      settling = 0;
      speed = 0;
      state = next.targetId && !routeTo ? "blocked" : "idle";
      if (!routeTo) worker.pose(distance, 0, null, 0, next.stage);
    }
    if (!prev || prev.motion !== next.motion || prev.visible !== next.visible) time = null;
    worker.object.visible = !blockedUnderFurniture;
    worker.object.position.set(pos.x, 0, pos.z);
    worker.object.rotation.y = yaw;
    if (!next.motion) worker.pose(distance, 0, null, 0, next.stage);
    requestFrame();
  }

  function turn(to: number, dt: number) {
    const diff = Math.atan2(Math.sin(to - yaw), Math.cos(to - yaw));
    yaw += THREE.MathUtils.clamp(diff, -speeds.turn * dt, speeds.turn * dt);
    return Math.abs(diff) > speeds.turn * dt + .003;
  }

  function tick(now: number) {
    if (!worker || !input || !input.motion || !input.visible || state === "blocked") {
      time = null;
      return false;
    }
    const dt = time === null ? 0 : THREE.MathUtils.clamp((now - time) / 1000, 0, .09);
    time = now;
    while (waypoint < route.length && Math.hypot(route[waypoint].x - pos.x, route[waypoint].z - pos.z) < .001) waypoint++;
    let more = true, activity: Gesture | null = null, phase = 0, walk = 0;
    if (waypoint < route.length) {
      const next = route[waypoint], dx = next.x - pos.x, dz = next.z - pos.z, remaining = Math.hypot(dx, dz);
      if (turn(Math.atan2(dx, dz), dt)) {
        state = "turning";
        speed = 0;
      }
      else {
        state = "walking";
        speed = Math.min(speeds.walk, speed + dt * 3.7, Math.max(.18, Math.sqrt(remaining * 6)));
        const step = Math.min(remaining, speed * dt);
        pos.x += dx / remaining * step;
        pos.z += dz / remaining * step;
        distance += step;
        walk = Math.min(1, speed / .45);
        settling = walk;
      }
    } else if (turn(targetYaw, dt)) { state = "turning"; }
    else if (settling > .01) {
      settling = Math.max(0, settling - dt * 6);
      walk = settling;
      state = "idle";
    }
    else if (acting) {
      state = acting;
      activity = acting;
      elapsed += dt;
      phase = Math.min(1, elapsed / growRoomGestureDuration(acting));
      if (workReceipt?.target && phase >= .55) deposited = workReceipt;
      if (phase === 1) {
        acting = null;
        state = "idle";
        more = false;
      }
    } else {
      state = "idle";
      more = false;
    }
    worker.object.position.set(pos.x, 0, pos.z);
    worker.object.rotation.y = yaw;
    worker.pose(distance, walk, activity, phase, input.stage, deviceCode);
    if (!more) time = null;
    return more;
  }
  return {
    update, tick, getPose: () => ({ x: pos.x, z: pos.z, yaw, state, deposited, targetId: input?.targetId ?? null, name, personalized: !!input?.profile, visible: !blockedUnderFurniture }),
    dispose: () => {
      worker?.dispose();
      worker = null;
      input = null;
      paths = null;
    }
  };
}
