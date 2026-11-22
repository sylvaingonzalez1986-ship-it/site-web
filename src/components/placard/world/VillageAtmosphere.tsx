"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createVillageAnimation, type AnimatedVillageBuilding, type VillageActivityState } from "./village-animation";
import type { VillageBuildingKind } from "./village-buildings";
import { createVillageAnimals } from "./village-animals";
import { createVillageGulls } from "./village-gulls";
import { createVillageSheep } from "./village-sheep";
import { createVillageBreton } from "./village-breton";
import { createVillageFisherman, VILLAGE_FISHERMAN_YAW } from "./village-fisherman";
import { createVillageLoic } from "./village-loic";
import { createVillageMarine } from "./village-marine";
import { createCharacterContactShadow } from "./village-contact-shadow";
import type { VillageGrazingSurface } from "./village-walk-surface";
import { createVillageNpcRoutine, findVillageNpcPathSpawn } from "./village-npc-routine";
import { createVillageNpcTapGate } from "./village-npc-pointer";
import type { NpcPoint, VillageNpcId, VillageNpcRig } from "./village-npc-types";
import type { RefObject } from "react";
import { createVillageSeasonMotion, getVillageSeason } from "./village-seasons";
import { createVillageKorrigans, fadeVillageCharacter, type VillageKorriganReaction } from "./village-korrigans";

export type VillageMotionProps = {
  activity: VillageActivityState;
  motion: { reduced: boolean; hidden: boolean; paused: boolean };
  focusBuilding: VillageBuildingKind | null;
  reaction: { building: VillageBuildingKind; sequence: number } | null;
  korriganReaction?: VillageKorriganReaction;
};

export function VillageAtmosphere({ terrain, surface, buildings, activity, motion, focusBuilding, reaction, korriganReaction = "idle", night, dragging, quality, onOpenGuide, labelNodes }: VillageMotionProps & { terrain: THREE.Group; surface: VillageGrazingSurface; buildings: readonly AnimatedVillageBuilding[]; night: boolean; dragging: boolean; quality: "low" | "high"; onOpenGuide: () => void; labelNodes: RefObject<Map<string, HTMLButtonElement>> }) {
  const controller = useMemo(() => createVillageAnimation(buildings), [buildings]);
  const seasonMotion = useMemo(() => createVillageSeasonMotion(terrain), [terrain]);
  const hydrangea = useMemo(() => controller.object.getObjectByName("motion-hydrangea"), [controller]);
  const daisies = useMemo(() => controller.object.getObjectByName("motion-daisies"), [controller]);
  const { life, npcs, korrigans } = useMemo(() => {
    const rigs: [VillageNpcId, VillageNpcRig][] = [
      ["breton", createVillageBreton(surface.heightAt)], ["fisherman", createVillageFisherman()], ["loic", createVillageLoic(surface.heightAt)],
    ];
    const actors = rigs.map(([id, rig], index) => {
      const initial = rig.object.position.toArray() as NpcPoint;
      const spawn = id === "fisherman" ? initial : findVillageNpcPathSpawn(surface, terrain.userData.groundPaths, initial) ?? initial;
      rig.object.position.set(...spawn);
      // The landscape shadow map is static. A small moving contact shadow avoids
      // baking a villager's initial pose permanently onto the path.
      const pigments = new Set<THREE.Material>();
      rig.object.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = false;
          if (child.material instanceof THREE.Material && !child.material.transparent) pigments.add(child.material);
        }
      });
      const ankles = [-1, 1].map(side => rig.object.getObjectByName(`${id}-ankle-${side}`)!);
      const contact = createCharacterContactShadow(rig.object, ankles, .105, id === "fisherman" ? 1 : .76, surface.heightAt);
      contact.mesh.name = `npc-contact-${id}`;
      const others = rigs.filter(([otherId]) => otherId !== id && otherId !== "fisherman");
      return { id, rig, contact, pigments, lastPoseTime: -1, posePhase: index / rigs.length, routine: createVillageNpcRoutine(id, surface, terrain.userData.groundPaths, spawn, id === "fisherman" ? VILLAGE_FISHERMAN_YAW : rig.object.rotation.y,
        () => others.map(([, other]) => ({ x: other.object.position.x, z: other.object.position.z, radius: 0.4 }))) };
    });
    return { life: [createVillageAnimals(surface), createVillageMarine(), createVillageGulls(), createVillageSheep(surface)], npcs: actors, korrigans: createVillageKorrigans(surface) };
  }, [terrain, surface]);
  const ownership = useMemo(() => {
    let leases = 0, disposed = false;
    return {
      acquire() { leases++; },
      release() {
        leases--;
        queueMicrotask(() => {
          if (!leases && !disposed) { disposed = true; controller.dispose(); seasonMotion.dispose(); life.forEach(part => part.dispose()); korrigans.dispose(); npcs.forEach(({ rig, contact }) => { contact.mesh.dispose(); rig.dispose(); }); }
        });
      },
    };
  }, [controller, korrigans, life, npcs, seasonMotion]);
  const { gl, invalidate, camera, size } = useThree();
  const tapGate = useMemo(() => createVillageNpcTapGate(), []);
  const projection = useMemo(() => new THREE.Vector3(), []);
  const visibility = useMemo(() => {
    const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4(), sphere = new THREE.Sphere();
    return { frustum, matrix, visible: (object: THREE.Object3D, radius: number) => { object.getWorldPosition(sphere.center); sphere.radius = radius; return frustum.intersectsSphere(sphere); } };
  }, []);
  const time = useRef(0);
  const nightMix = useRef(Number(night));
  const diagnosticsAt = useRef(-Infinity);
  const [inView, setInView] = useState(false);
  const state = motion.reduced ? "reduced" : motion.paused ? "paused" : motion.hidden ? "hidden" : dragging ? "dragging" : !inView ? "offscreen" : "running";
  const running = state === "running";
  useLayoutEffect(() => {
    tapGate.cancel();
    if (night) gl.domElement.style.removeProperty("cursor");
    invalidate();
  }, [gl, invalidate, night, tapGate]);
  useEffect(() => {
    ownership.acquire();
    return () => {
      // React StrictMode reconnects effects immediately. Dispose only after a
      // real detach, so its development probe cannot permanently stop a rig.
      ownership.release();
    };
  }, [controller, life, ownership]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)));
    observer.observe(gl.domElement); return () => observer.disconnect();
  }, [gl]);
  useEffect(() => {
    const node = gl.domElement;
    const down = (e: PointerEvent) => tapGate.down(e.pointerId, e.clientX, e.clientY);
    const move = (e: PointerEvent) => tapGate.move(e.pointerId, e.clientX, e.clientY);
    const up = (e: PointerEvent) => { tapGate.move(e.pointerId, e.clientX, e.clientY); tapGate.up(e.pointerId); };
    const cancel = () => tapGate.cancel();
    node.addEventListener("pointerdown", down, true); node.addEventListener("pointermove", move, true);
    node.addEventListener("pointerup", up, true); node.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", cancel);
    return () => {
      node.removeEventListener("pointerdown", down, true); node.removeEventListener("pointermove", move, true);
      node.removeEventListener("pointerup", up, true); node.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", cancel); cancel();
    };
  }, [gl, tapGate]);
  useEffect(() => {
    gl.domElement.setAttribute("data-motion-state", state);
    gl.domElement.setAttribute("data-life-quality", quality);
    gl.domElement.setAttribute("data-motion-parts", controller.parts.join(","));
    gl.domElement.setAttribute("data-active-activities", Object.entries(activity).filter(([, active]) => active).map(([name]) => name).join(","));
    invalidate();
  }, [activity, controller, gl, invalidate, quality, state]);
  useEffect(() => { invalidate(); }, [invalidate, korriganReaction]);
  const greet = useEffectEvent((building: VillageBuildingKind | null) => {
    if (running && building) controller.react(building, time.current);
    invalidate();
  });
  useEffect(() => { greet(focusBuilding); }, [focusBuilding]);
  useEffect(() => { greet(reaction?.building ?? null); }, [reaction]);
  useEffect(() => {
    if (!running) return;
    let frame = 0, last = performance.now();
    const interval = 1000 / (quality === "low" ? 30 : 60);
    const tick = (now: number) => {
      const elapsed = now - last;
      if (elapsed >= interval - 0.75) { last += Math.max(1, Math.floor((elapsed + 0.75) / interval)) * interval; invalidate(); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, invalidate, quality]);
  useFrame((_, delta) => {
    const step = running ? Math.min(delta, 0.05) : 0;
    time.current += step;
    controller.update(time.current, activity, motion.reduced);
    const season = getVillageSeason(terrain);
    if (hydrangea) hydrangea.visible = season === "summer";
    if (daisies) daisies.visible = season === "spring" || season === "summer";
    seasonMotion.update(time.current, motion.reduced, quality);
    visibility.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    visibility.frustum.setFromProjectionMatrix(visibility.matrix);
    const detail = camera instanceof THREE.OrthographicCamera
      ? THREE.MathUtils.smoothstep(size.height * camera.zoom / (camera.top - camera.bottom), 22, 72) : 1;
    const frame = { time: time.current, delta: step, reduced: motion.reduced, quality, detail, visible: visibility.visible };
    life.forEach(part => part.update(frame));
    const targetMix = Number(night);
    nightMix.current = running && step > 0 ? THREE.MathUtils.clamp(targetMix, nightMix.current - step / .38, nightMix.current + step / .38) : targetMix;
    const presence = THREE.MathUtils.smoothstep(nightMix.current, 0, 1);
    korrigans.update(frame, korriganReaction, presence);
    const now = performance.now();
    const targets: Record<string, { x: number; y: number; visible: boolean }> | null =
      now >= diagnosticsAt.current || !running ? {} : null;
    const distantPoseRate = quality === "low" ? 20 : 24;
    for (const actor of npcs) {
      const { id, rig, contact, pigments, routine } = actor;
      rig.object.visible = presence < 1;
      pigments.forEach(material => fadeVillageCharacter(material, 1 - presence));
      (contact.mesh.material as THREE.MeshBasicMaterial).opacity = .36 * (1 - presence);
      if (!rig.object.visible) continue;
      const state = routine.update(frame);
      rig.object.position.set(...state.position); rig.object.rotation.y = state.yaw;
      // Small figures keep a continuous trajectory while distant joints update in turns.
      const poseDue = Math.floor(frame.time * distantPoseRate + actor.posePhase) !== Math.floor(actor.lastPoseTime * distantPoseRate + actor.posePhase);
      if (!running || detail > 0.25 || poseDue) {
        const dt = Math.min(0.08, frame.time - Math.max(0, actor.lastPoseTime));
        rig.update(running && dt > step + 0.0001 ? { ...frame, delta: dt } : frame, state.pose);
        if (visibility.visible(rig.object, 1.6)) actor.contact.update();
        actor.lastPoseTime = frame.time;
      }
      rig.object.userData.destination = state.destination;
      rig.object.userData.routine = state.pose.activity;
      rig.object.userData.attention = state.pose.attention;
      rig.object.userData.lookYaw = state.pose.lookYaw;
      rig.object.userData.speed = state.pose.speed;
      rig.object.userData.fishingPhase = state.pose.fishingPhase;
      rig.object.userData.phaseProgress = state.pose.phaseProgress;
      const label = id === "loic" ? labelNodes.current.get("npc-loic") : undefined;
      if (!targets && !label) continue;
      projection.copy(rig.object.position); projection.y += 1; projection.project(camera);
      const x = (projection.x + 1) * size.width / 2, y = (1 - projection.y) * size.height / 2;
      const onScreen = Math.abs(projection.x) <= 1 && Math.abs(projection.y) <= 1 && projection.z <= 1;
      if (targets && !night) targets[id] = { x, y, visible: onScreen };
      if (label) {
        projection.copy(rig.object.position).project(camera);
        const feetY = (1 - projection.y) * size.height / 2;
        const labelX = Math.max(75, Math.min(size.width - 75, x));
        const labelY = Math.max(10, Math.min(size.height - 50, feetY + 8));
        label.style.transform = `translate(${labelX}px, ${labelY}px) translate(-50%, 0)`;
        label.dataset.offscreen = String(!onScreen);
      }
    }
    gl.domElement.setAttribute("data-motion-time", time.current.toFixed(3));
    // Small bounded snapshots at 4 Hz, rather than serializing rigs every frame.
    if (targets) {
      diagnosticsAt.current = now + 250;
      gl.domElement.setAttribute("data-life-animals", JSON.stringify(life[0].object.children.map(animal => ({ ...animal.userData, x: animal.position.x, z: animal.position.z }))));
      const boat = life[1].object.getObjectByName("fishing-boat");
      gl.domElement.setAttribute("data-life-boat", JSON.stringify(boat?.userData ?? {}));
      gl.domElement.setAttribute("data-life-breton", JSON.stringify(npcs[0].rig.object.userData));
      gl.domElement.setAttribute("data-life-npcs", JSON.stringify(Object.fromEntries(npcs.map(({ id, rig }) => [id, { ...rig.object.userData, visible: rig.object.visible, x: rig.object.position.x, y: rig.object.position.y, z: rig.object.position.z }]))));
      gl.domElement.setAttribute("data-npc-targets", JSON.stringify(targets));
      gl.domElement.setAttribute("data-life-korrigans", JSON.stringify({ visible: korrigans.object.visible, reaction: korriganReaction, dancers: korrigans.object.visible ? korrigans.sample() : [] }));
    }
  });
  return <><primitive object={controller.object} /><primitive object={seasonMotion.object} /><primitive object={korrigans.object} />{life.map(part => <primitive key={part.object.uuid} object={part.object} />)}
    {npcs.map(({ id, rig }) => <primitive key={id} object={rig.object}>
      {id === "loic" && !night && <mesh name="npc-hit-loic" position-y={1} userData={{ npc: id }}
        onPointerDown={event => { event.stopPropagation(); tapGate.claim(event.pointerId, id); }}
        onClick={event => { event.stopPropagation(); if (event.delta <= 6 && tapGate.consume(id)) onOpenGuide(); }}
        onPointerOver={event => { event.stopPropagation(); gl.domElement.style.cursor = "pointer"; }}
        onPointerOut={() => gl.domElement.style.removeProperty("cursor")}>
        <capsuleGeometry args={[0.36, 1.05, 4, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>}
    </primitive>)}
  </>;
}
