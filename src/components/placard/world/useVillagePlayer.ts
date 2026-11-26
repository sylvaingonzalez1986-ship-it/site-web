import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, Vector3, type Group } from "three";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createGrowWorker } from "../kq-grow-worker-model";
import type { VillageWalkSurface } from "./village-life-types";
import { createVillagePlayerRoute, findVillageNpcPathSpawn } from "./village-npc-routine";
import { approachVillageValue, villageAngleDifference, villageApproachSpeed, villageWalkBlend } from "./village-character-motion";

type Point = { x: number; z: number };
const WALK_SPEED = 1.55;
const TURN_RATE = 4.6;
const HEADING_LIMIT = 0.22;
const BRAKE = 3;

function createResident(profile: ChanvrierAvatarProfile, terrain: Group, surface: VillageWalkSurface) {
  const paths = terrain.userData.groundPaths;
  const spawn = findVillageNpcPathSpawn(surface, paths, [1, 0, 4]);
  if (!spawn) return null;
  const model = createGrowWorker(profile, { tools: false, groundAt: surface.heightAt });
  model.object.position.set(...spawn);
  model.object.rotation.y = .45;
  model.object.traverse(part => { part.castShadow = false; });
  return {
    model, surface, route: createVillagePlayerRoute(surface, paths, model.object.position),
    steps: [] as Point[], distance: 0, time: 0, posedAt: -1, screenPoint: new Vector3(), speed: 0, walk: 0, turnYaw: 0, groundY: spawn[1],
  };
}

function finishReducedWalk(resident: NonNullable<ReturnType<typeof createResident>>) {
  const { model, surface, steps } = resident;
  const last = steps.at(-1);
  if (last) {
    resident.groundY = surface.heightAt(last.x, last.z);
    model.object.position.set(last.x, resident.groundY, last.z);
    resident.steps = [];
  }
  resident.speed = 0;
  resident.walk = 0;
  resident.turnYaw = 0;
  model.pose(resident.distance, 0, null, 0, null);
}

export function useVillagePlayer(profile: ChanvrierAvatarProfile | null, layer: RefObject<Group | null>, terrain: Group, surface: VillageWalkSurface, frozen: boolean, reduced: boolean) {
  const { invalidate } = useThree();
  const actor = useRef<ReturnType<typeof createResident>>(null);
  useEffect(() => () => { actor.current?.model.dispose(); actor.current = null; }, [layer, terrain, surface]);
  useEffect(() => {
    if (!profile) { actor.current?.model.dispose(); actor.current = null; }
    else if (actor.current) actor.current.model.updateAppearance(profile);
    else if (layer.current) {
      actor.current = createResident(profile, terrain, surface);
      if (actor.current) layer.current.add(actor.current.model.object);
    }
    invalidate();
  }, [profile, layer, terrain, surface, invalidate]);
  useFrame(({ camera, size }, delta) => {
    const resident = actor.current;
    if (!resident || frozen) return;
    if (reduced) {
      finishReducedWalk(resident);
      return;
    }
    const { object } = resident.model;
    while (resident.steps.length && Math.hypot(resident.steps[0].x - object.position.x, resident.steps[0].z - object.position.z) < 1e-5) resident.steps.shift();
    const next = resident.steps[0];
    const dt = Math.min(0.05, delta);
    resident.time += dt;
    let step = 0;
    let lookAhead = 0;
    if (next && dt > 0) {
      const dx = next.x - object.position.x, dz = next.z - object.position.z, length = Math.hypot(dx, dz);
      const heading = Math.atan2(dx, dz);
      const turn = villageAngleDifference(heading, object.rotation.y);
      lookAhead = Math.max(-.46, Math.min(.46, turn));
      object.rotation.y += approachVillageValue(0, turn, TURN_RATE * dt);
      if (Math.abs(villageAngleDifference(heading, object.rotation.y)) <= HEADING_LIMIT) {
        const following = resident.steps[1];
        const corner = following ? villageAngleDifference(Math.atan2(following.x - next.x, following.z - next.z), heading) : 0;
        const cruise = !following || Math.abs(corner) > HEADING_LIMIT ? Math.min(WALK_SPEED, Math.sqrt(2 * BRAKE * length)) : WALK_SPEED;
        const speed = villageApproachSpeed(resident.speed, cruise, dt, 3.8, BRAKE);
        step = Math.min(length, speed * dt);
        if (step === length) {
          object.position.x = next.x;
          object.position.z = next.z;
          resident.steps.shift();
        } else {
          object.position.x += dx / length * step;
          object.position.z += dz / length * step;
        }
        resident.groundY = resident.surface.heightAt(object.position.x, object.position.z);
        resident.distance += step;
      }
    }
    object.position.y = approachVillageValue(object.position.y, resident.groundY, dt * 0.9);
    if (dt > 0) resident.speed = step / dt;
    resident.walk = villageWalkBlend(resident.walk, resident.speed, dt);
    const previousYaw = resident.turnYaw;
    resident.turnYaw = approachVillageValue(previousYaw, lookAhead, dt * 3.2);
    const projected = resident.screenPoint.copy(object.position);
    projected.y += 1;
    projected.project(camera);
    if (Math.abs(projected.x) < 1.25 && Math.abs(projected.y) < 1.25) {
      const pixelsPerUnit = camera instanceof OrthographicCamera ? size.height * camera.zoom / (camera.top - camera.bottom) : Infinity;
      // Keep navigation at frame rate. At map scale a breathing idle rarely moves a full pixel.
      const interval = pixelsPerUnit >= 52 ? 0 : resident.walk > .01 ? 1 / 30 : 1 / 12;
      if (resident.time - resident.posedAt >= interval || (previousYaw !== 0 && resident.turnYaw === 0)) {
        resident.model.pose(resident.distance, resident.walk, null, 0, null, undefined, resident.time, resident.turnYaw);
        resident.posedAt = resident.time;
      }
    }
    if (next || resident.walk > 0 || resident.turnYaw !== 0 || object.position.y !== resident.groundY) invalidate();
  });
  return (destination: Point) => {
    const resident = actor.current;
    if (!resident || frozen) return;
    resident.steps = resident.route(resident.model.object.position, { x: destination.x, z: destination.z });
    if (reduced) finishReducedWalk(resident);
    invalidate();
  };
}
