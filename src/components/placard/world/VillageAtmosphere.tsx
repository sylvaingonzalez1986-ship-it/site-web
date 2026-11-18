"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
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
import { positionVillageBubble } from "./village-bubble";
import type { VillageNpcBridge } from "./VillageNpcDialogue";
import type { NpcPoint, VillageNpcId, VillageNpcRig } from "./village-npc-types";
import type { RefObject } from "react";

export type VillageMotionProps = {
  activity: VillageActivityState;
  motion: { reduced: boolean; hidden: boolean; paused: boolean };
  focusBuilding: VillageBuildingKind | null;
  reaction: { building: VillageBuildingKind; sequence: number } | null;
};

export function VillageAtmosphere({ terrain, surface, buildings, activity, motion, focusBuilding, reaction, dragging, quality, npc, labelNodes }: VillageMotionProps & { terrain: THREE.Group; surface: VillageGrazingSurface; buildings: readonly AnimatedVillageBuilding[]; dragging: boolean; quality: "low" | "high"; npc: VillageNpcBridge; labelNodes: RefObject<Map<string, HTMLButtonElement>> }) {
  const controller = useMemo(() => createVillageAnimation(buildings), [buildings]);
  const { life, npcs } = useMemo(() => {
    const rigs: [VillageNpcId, VillageNpcRig][] = [
      ["breton", createVillageBreton(surface.heightAt)], ["fisherman", createVillageFisherman()], ["loic", createVillageLoic(surface.heightAt)],
    ];
    const actors = rigs.map(([id, rig], index) => {
      const initial = rig.object.position.toArray() as NpcPoint;
      const spawn = id === "fisherman" ? initial : findVillageNpcPathSpawn(surface, terrain.userData.groundPaths, initial) ?? initial;
      rig.object.position.set(...spawn);
      // The landscape shadow map is static. A small moving contact shadow avoids
      // baking a villager's initial pose permanently onto the path.
      rig.object.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = false; });
      const ankles = [-1, 1].map(side => rig.object.getObjectByName(`${id}-ankle-${side}`)!);
      const contact = createCharacterContactShadow(rig.object, ankles, .105, id === "fisherman" ? 1 : .76, surface.heightAt);
      contact.mesh.name = `npc-contact-${id}`;
      const hit = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.05, 4, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.name = `npc-hit-${id}`; hit.position.y = id === "fisherman" ? 0.85 : 1; hit.userData.npc = id;
      rig.object.add(hit);
      const others = rigs.filter(([otherId]) => otherId !== id && otherId !== "fisherman");
      return { id, rig, contact, lastPoseTime: -1, posePhase: index / rigs.length, routine: createVillageNpcRoutine(id, surface, terrain.userData.groundPaths, spawn, id === "fisherman" ? VILLAGE_FISHERMAN_YAW : rig.object.rotation.y,
        () => others.map(([, other]) => ({ x: other.object.position.x, z: other.object.position.z, radius: 0.4 }))) };
    });
    return { life: [createVillageAnimals(surface), createVillageMarine(), createVillageGulls(), createVillageSheep(surface)], npcs: actors };
  }, [terrain, surface]);
  const ownership = useMemo(() => {
    let leases = 0, disposed = false;
    return {
      acquire() { leases++; },
      release() {
        leases--;
        queueMicrotask(() => {
          if (!leases && !disposed) { disposed = true; controller.dispose(); life.forEach(part => part.dispose()); npcs.forEach(({ rig, contact }) => { contact.mesh.dispose(); rig.dispose(); }); }
        });
      },
    };
  }, [controller, life, npcs]);
  const { gl, invalidate, camera, size } = useThree();
  const tapGate = useMemo(() => createVillageNpcTapGate(), []);
  const projection = useMemo(() => new THREE.Vector3(), []);
  const gaze = useMemo<NpcPoint>(() => [0, 0, 0], []);
  const visibility = useMemo(() => {
    const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4(), sphere = new THREE.Sphere();
    return { frustum, matrix, visible: (object: THREE.Object3D, radius: number) => { object.getWorldPosition(sphere.center); sphere.radius = radius; return frustum.intersectsSphere(sphere); } };
  }, []);
  const time = useRef(0);
  const diagnosticsAt = useRef(-Infinity);
  const [inView, setInView] = useState(false);
  const state = motion.reduced ? "reduced" : motion.paused ? "paused" : motion.hidden ? "hidden" : dragging ? "dragging" : !inView ? "offscreen" : "running";
  const running = state === "running";
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
    invalidate();
    const bubble = npc.bubbleNode.current;
    if (!bubble) return;
    const observer = new ResizeObserver(() => invalidate()); observer.observe(bubble);
    return () => observer.disconnect();
  }, [npc.active, npc.interaction, npc.bubbleNode, invalidate]);
  useEffect(() => {
    gl.domElement.setAttribute("data-motion-state", state);
    gl.domElement.setAttribute("data-life-quality", quality);
    gl.domElement.setAttribute("data-motion-parts", controller.parts.join(","));
    gl.domElement.setAttribute("data-active-activities", Object.entries(activity).filter(([, active]) => active).map(([name]) => name).join(","));
    invalidate();
  }, [activity, controller, gl, invalidate, quality, state]);
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
    visibility.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    visibility.frustum.setFromProjectionMatrix(visibility.matrix);
    const detail = camera instanceof THREE.OrthographicCamera
      ? THREE.MathUtils.smoothstep(size.height * camera.zoom / (camera.top - camera.bottom), 22, 72) : 1;
    const frame = { time: time.current, delta: step, reduced: motion.reduced, quality, detail, visible: visibility.visible };
    life.forEach(part => part.update(frame));
    gaze[0] = camera.position.x; gaze[1] = camera.position.y; gaze[2] = camera.position.z;
    const now = performance.now();
    const targets: Record<string, { x: number; y: number; visible: boolean }> | null =
      now >= diagnosticsAt.current || !running ? {} : null;
    const distantPoseRate = quality === "low" ? 20 : 24;
    for (const actor of npcs) {
      const { id, rig, routine } = actor;
      const state = routine.update(frame, gaze, npc.active === id ? npc.interaction : undefined);
      rig.object.position.set(...state.position); rig.object.rotation.y = state.yaw;
      // Small figures keep a continuous trajectory while distant joints update in turns.
      const poseDue = Math.floor(frame.time * distantPoseRate + actor.posePhase) !== Math.floor(actor.lastPoseTime * distantPoseRate + actor.posePhase);
      if (!running || detail > 0.25 || npc.active === id || poseDue) {
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
      projection.copy(rig.object.position); projection.y += 1; projection.project(camera);
      const x = (projection.x + 1) * size.width / 2, y = (1 - projection.y) * size.height / 2;
      const onScreen = Math.abs(projection.x) <= 1 && Math.abs(projection.y) <= 1 && projection.z <= 1;
      if (targets) targets[id] = { x, y, visible: onScreen };
      const label = labelNodes.current.get(`npc-${id}`);
      projection.copy(rig.object.position).project(camera);
      const feetY = (1 - projection.y) * size.height / 2;
      if (label) {
        const labelX = Math.max(75, Math.min(size.width - 75, x));
        const labelY = Math.max(10, Math.min(size.height - 50, feetY + 8));
        label.style.transform = `translate(${labelX}px, ${labelY}px) translate(-50%, 0)`;
        label.dataset.offscreen = String(!onScreen);
      }
      if (npc.active === id && npc.bubbleNode.current) {
        projection.copy(rig.object.position); projection.y += 2.15; projection.project(camera);
        positionVillageBubble(npc.bubbleNode.current, npc.bubbleTail.current, (projection.x + 1) * size.width / 2, (1 - projection.y) * size.height / 2, size.width, size.height, true, feetY);
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
      gl.domElement.setAttribute("data-life-npcs", JSON.stringify(Object.fromEntries(npcs.map(({ id, rig }) => [id, { ...rig.object.userData, x: rig.object.position.x, y: rig.object.position.y, z: rig.object.position.z }]))));
      gl.domElement.setAttribute("data-npc-targets", JSON.stringify(targets));
    }
  });
  return <><primitive object={controller.object} />{life.map(part => <primitive key={part.object.uuid} object={part.object} />)}
    {npcs.map(({ id, rig }) => <primitive key={id} object={rig.object}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); tapGate.claim(event.pointerId, id); }}
      onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.delta <= 6 && tapGate.consume(id)) { npc.onInteract(id); invalidate(); } }}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); gl.domElement.style.cursor = "pointer"; }}
      onPointerOut={() => gl.domElement.style.removeProperty("cursor")} />)}
  </>;
}
