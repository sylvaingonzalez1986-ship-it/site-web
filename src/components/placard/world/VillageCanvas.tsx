"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { useVillagePlayer } from "./useVillagePlayer";
import { createVillageWalkSurface } from "./village-walk-surface";
import { applyVillageEmissives, sampleVillageLighting, VILLAGE_LIGHT as light } from "./village-lighting";
import type { VillageCalendar } from "./village-calendar";
import { applyVillageWaterLight } from "./village-marine";
import { applyVillageSeason } from "./village-seasons";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createVillageBuilding, createVillageHempFarm, createVillageMailbox } from "./village-buildings";
import { createVillageTerrain, disposeVillageObject } from "./village-terrain";
import { HEMP_FARM, HEMP_FARM_ID, VILLAGE_KORRIGAN_GLADE, VILLAGE_MAILBOX_POSITION, VILLAGE_PLACES, villagePlacePosition, type VillagePlaceId } from "./village-layout";
import { createVillageHempFarmCollider } from "./village-hemp-farm";
import { consumeVillageSupportView, saveVillageSupportView } from "./village-support-view";
import { positionVillageBubble } from "./village-bubble";
import { placeVillageLabel, type VillageLabelBounds } from "./village-labels";
import { VillageAtmosphere, type VillageMotionProps } from "./VillageAtmosphere";
import type { VillageNpcBridge } from "./VillageNpcDialogue";
import { VILLAGE_KORRIGANS_NAME } from "./village-korrigans";

export type VillageLifeSubject = "player" | "sheep" | "wolf" | "fox" | "weasel" | "boat" | "breton" | "fisherman" | "loic" | "korrigans";
export type VillageCameraRequest = { rotation: number; zoom: number; reset: number; observe?: VillageLifeSubject };
const VILLAGE_VIEW_CENTER = new THREE.Vector3(-4.3, 1.2, -1.8);
const VILLAGE_NARROW_VIEW_CENTER = VILLAGE_VIEW_CENTER.clone().add(new THREE.Vector3(0, 3.15, 0));
const LIFE_NAMES: Record<VillageLifeSubject, string> = { player: "chanvrier", sheep: "village-sheep-pasture", wolf: "village-animal-wolf", fox: "village-animal-fox", weasel: "village-animal-weasel", boat: "fishing-boat", breton: "village-breton", fisherman: "village-fisherman", loic: "village-loic", korrigans: VILLAGE_KORRIGANS_NAME };
const RESIDENT_EYE_HEIGHT: Partial<Record<VillageLifeSubject, number>> = { player: 1.57, breton: 1.65, fisherman: 1.35, loic: 1.66 };
type Props = VillageMotionProps & {
  calendar?: VillageCalendar | null;
  profile: ChanvrierAvatarProfile | null;
  playerIndoors: boolean;
  npc: VillageNpcBridge;
  controlsBlocked: boolean;
  supportOpen?: boolean;
  restoreSupportView?: boolean;
  selected: VillagePlaceId | null;
  keyboardFocus: VillagePlaceId | "mailbox" | null;
  onSelect: (id: VillagePlaceId) => void;
  onHover: (id: VillagePlaceId | null) => void;
  onOpenMailbox: () => void;
  cameraRequest: VillageCameraRequest;
  labelNodes: RefObject<Map<string, HTMLButtonElement>>;
  bubbleNode: RefObject<HTMLElement | null>;
  headerNode: RefObject<HTMLElement | null>;
  bubbleTail: RefObject<SVGPathElement | null>;
  onCloseActivities: () => void;
  onReady: () => void;
  onUnavailable: () => void;
};

type CameraTransition = {
  startedAt: number;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromOrbit: THREE.Spherical;
  toOrbit: THREE.Spherical;
  fromZoom: number;
  toZoom: number;
};

/** An orthographic sightline from the feet also clears the upper body when a
 * roof is in front of the resident. Check only when the player selects them. */
function frameResident(scene: THREE.Scene, subject: THREE.Object3D, orbit: THREE.Spherical) {
  const buildings: THREE.Box3[] = [];
  scene.traverse(node => {
    if (node.userData.buildingKind) buildings.push(new THREE.Box3().setFromObject(node).expandByScalar(0.35));
  });
  const origin = subject.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Ray(origin), angles = [0.36, -0.36, 0.85, -0.85];
  for (const phi of [1.14, 0.95, 0.78, 0.65]) {
    for (const angle of angles) {
      const theta = subject.rotation.y + angle;
      ray.direction.setFromSphericalCoords(1, phi, theta);
      if (buildings.every(box => !ray.intersectsBox(box))) {
        orbit.theta = theta; orbit.phi = phi;
        return;
      }
    }
  }
  orbit.theta = subject.rotation.y + angles[0]; orbit.phi = 0.65;
}

function CameraRig({ request, focus, onDrag, motion, night, controlsBlocked, supportOpen, restoreSupportView }: { request: VillageCameraRequest; focus?: THREE.Vector3; onDrag: (dragging: boolean) => void; motion: VillageMotionProps["motion"]; night: boolean } & Pick<Props, "controlsBlocked" | "supportOpen" | "restoreSupportView">) {
  const { camera, gl, invalidate, size, scene } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const previous = useRef<{ request?: VillageCameraRequest; focus?: THREE.Vector3; night?: boolean; width?: number; height?: number }>({});
  const transition = useRef<CameraTransition | null>(null);
  const support = useRef<{ open: boolean; restored: boolean; pose?: ReturnType<typeof consumeVillageSupportView>; orbit?: OrbitControls }>({ open: false, restored: false });
  const restoredZoomRatio = useRef(1);
  const stopped = motion.reduced || motion.paused || motion.hidden || controlsBlocked;
  const tracking = useRef(false);
  const observation = useMemo(() => new THREE.Vector3(), []);
  const viewZoom = Math.min(size.width / 38, size.height / 36);
  const eyeHeight = request.observe && RESIDENT_EYE_HEIGHT[request.observe];
  const roundRequested = request.observe === "korrigans";
  const subjectAvailable = roundRequested ? night : !night || request.observe === "player" || !eyeHeight;
  // At full length centre the torso. A deliberate close-up moves towards the eyes.
  const closeUp = THREE.MathUtils.smoothstep(request.zoom, 1, 2.5);
  const observationHeight = roundRequested ? THREE.MathUtils.lerp(3.04, 1.24, closeUp) : eyeHeight ? THREE.MathUtils.lerp(eyeHeight * .59, eyeHeight, closeUp) : .4;

  // Run before the labels/bubble project their anchors, using only demand frames.
  useFrame((_, delta) => {
    const tween = transition.current, orbit = controls.current;
    if (tracking.current && subjectAvailable && request.observe && !focus && orbit && !stopped) {
      const subject = scene.getObjectByName(LIFE_NAMES[request.observe]);
      if (subject) {
        subject.getWorldPosition(observation); observation.y += observationHeight;
        if (tween) tween.toTarget.copy(observation);
        else {
          observation.sub(orbit.target).multiplyScalar(-Math.expm1(-14 * Math.min(delta, .06)));
          camera.position.add(observation); orbit.target.add(observation); orbit.update(); camera.updateMatrixWorld();
        }
      }
    }
    if (!tween || !orbit || !(camera instanceof THREE.OrthographicCamera)) return;
    if (stopped || document.hidden) {
      transition.current = null;
      gl.domElement.dataset.cameraTransition = "idle";
      return;
    }
    const progress = Math.min(1, Math.max(0, (performance.now() - tween.startedAt) / 450));
    const eased = progress * progress * (3 - 2 * progress);
    orbit.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
    const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(
      THREE.MathUtils.lerp(tween.fromOrbit.radius, tween.toOrbit.radius, eased),
      THREE.MathUtils.lerp(tween.fromOrbit.phi, tween.toOrbit.phi, eased),
      THREE.MathUtils.lerp(tween.fromOrbit.theta, tween.toOrbit.theta, eased),
    ));
    camera.position.copy(orbit.target).add(offset);
    camera.zoom = THREE.MathUtils.lerp(tween.fromZoom, tween.toZoom, eased);
    camera.updateProjectionMatrix();
    orbit.update();
    camera.updateMatrixWorld();
    if (progress < 1) invalidate();
    else {
      transition.current = null;
      gl.domElement.dataset.cameraTransition = "idle";
    }
  }, -1);

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.target.copy(VILLAGE_VIEW_CENTER);
    orbit.enableDamping = false;
    orbit.minPolarAngle = Math.PI / 7;
    orbit.maxPolarAngle = Math.PI / 2.6;
    orbit.minZoom = 4;
    orbit.maxZoom = 110;
    orbit.screenSpacePanning = true;
    const redraw = () => { camera.updateMatrixWorld(); invalidate(); };
    const start = () => {
      tracking.current = false;
      transition.current = null;
      gl.domElement.dataset.cameraTransition = "idle";
      onDrag(true);
    }, end = () => onDrag(false);
    orbit.addEventListener("start", start); orbit.addEventListener("end", end);
    orbit.addEventListener("change", redraw);
    orbit.update();
    controls.current = orbit;
    return () => {
      transition.current = null;
      previous.current = {};
      orbit.removeEventListener("change", redraw); orbit.removeEventListener("start", start); orbit.removeEventListener("end", end);
      orbit.dispose(); controls.current = null;
    };
  }, [camera, gl, invalidate, onDrag]);

  useEffect(() => {
    if (controls.current) controls.current.enabled = !controlsBlocked;
    gl.domElement.dataset.cameraControls = controlsBlocked ? "suspended" : "enabled";
    if (controlsBlocked) { transition.current = null; onDrag(false); }
  }, [controlsBlocked, gl, onDrag]);

  useEffect(() => {
    if (!stopped) return;
    transition.current = null;
    gl.domElement.dataset.cameraTransition = "idle";
  }, [gl, stopped]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !(camera instanceof THREE.OrthographicCamera)) return;
    const prior = previous.current.request;
    const focusChanged = !!focus && focus !== previous.current.focus;
    const resized = size.width !== previous.current.width || size.height !== previous.current.height;
    const presenceChanged = night !== previous.current.night && !!(request.observe ?? prior?.observe);
    const roundRequestedNow = roundRequested && prior !== request;
    const roundLeaving = presenceChanged && prior?.observe === "korrigans";
    // The anchored invitation can open in the same update as its framing. The
    // manual controls stay inactive while the panel is open.
    if (controlsBlocked && prior && !resized && !roundRequestedNow && !roundLeaving) return;
    if (prior && !focusChanged && request === prior && !resized && !presenceChanged) {
      previous.current.focus = focus;
      return;
    }
    const pending = transition.current;
    const target = pending?.toTarget.clone() ?? orbit.target.clone();
    const offset = pending?.toOrbit.clone() ?? new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
    if (focusChanged) {
      // Keep the viewing angle, and make room above the roof for its activities.
      target.copy(focus).add(new THREE.Vector3(0, 3.5, 0));
    }
    const subject = request.observe && subjectAvailable && !focus ? scene.getObjectByName(LIFE_NAMES[request.observe]) : null;
    const observingResident = !!subject && !!eyeHeight;
    const observingRound = !!subject && roundRequested;
    if (subject) { subject.getWorldPosition(target); target.y += observationHeight; }
    tracking.current = !!subject && !observingRound;
    gl.domElement.dataset.lifeObserve = subject ? request.observe! : "";
    const reset = !prior || request.reset !== prior.reset;
    if (observingRound && (reset || prior?.observe !== request.observe || presenceChanged)) {
      offset.theta = 1.90;
      offset.phi = 1.17;
    } else if (reset || (presenceChanged && !subjectAvailable)) {
      restoredZoomRatio.current = 1;
      if (!focus || prior) target.copy(size.width <= 380 ? VILLAGE_NARROW_VIEW_CENTER : VILLAGE_VIEW_CENTER);
      const angle = Math.PI / 4 + request.rotation * Math.PI / 4;
      offset.setFromVector3(new THREE.Vector3(Math.sin(angle) * 46, 32.527, Math.cos(angle) * 46));
    } else if (request.rotation !== prior.rotation) {
      offset.theta += (request.rotation - prior.rotation) * Math.PI / 4;
    } else if (subject && observingResident && request !== prior && (request.observe !== prior?.observe || request.zoom === prior?.zoom)) {
      // Approach the face once on selection. The player keeps control of the
      // angle afterwards, even when a resident changes direction on the path.
      frameResident(scene, subject, offset);
    }
    const fromOrbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
    // Cross the -PI/PI seam through the nearest angle instead of orbiting all the way around.
    offset.theta = fromOrbit.theta + Math.atan2(Math.sin(offset.theta - fromOrbit.theta), Math.cos(offset.theta - fromOrbit.theta));
    const subjectZoom = observingResident ? Math.min(size.width / 3.1, size.height / 4.1)
      : observingRound ? Math.min(size.width / 6.34, size.height / 7.55) : Math.min(size.width / 8, size.height / 6);
    orbit.maxZoom = observingResident || observingRound ? Math.max(110, subjectZoom * 2.5) : 110;
    if (subject) restoredZoomRatio.current = 1;
    const toZoom = subject ? THREE.MathUtils.clamp(subjectZoom * request.zoom, orbit.minZoom, orbit.maxZoom) : reset || resized || request.zoom !== prior?.zoom || prior?.observe
      ? THREE.MathUtils.clamp(viewZoom * request.zoom * restoredZoomRatio.current, orbit.minZoom, orbit.maxZoom)
      : pending?.toZoom ?? camera.zoom;
    const changed = target.distanceToSquared(orbit.target) > 0.000001 || Math.abs(offset.theta - fromOrbit.theta) > 0.000001 || Math.abs(offset.phi - fromOrbit.phi) > 0.000001 || Math.abs(toZoom - camera.zoom) > 0.000001;
    if (prior && changed && !stopped && !document.hidden) {
      transition.current = { startedAt: performance.now(), fromTarget: orbit.target.clone(), toTarget: target, fromOrbit, toOrbit: offset, fromZoom: camera.zoom, toZoom };
      gl.domElement.dataset.cameraTransition = "running";
    } else {
      transition.current = null;
      orbit.target.copy(target);
      camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(offset));
      // Three owns this mutable camera; React state is not modified.
      camera.zoom = toZoom;
      camera.updateProjectionMatrix(); orbit.update(); camera.updateMatrixWorld();
      gl.domElement.dataset.cameraTransition = "idle";
    }
    invalidate();
    previous.current = { request, focus, night, width: size.width, height: size.height };
    // Motion changes cancel separately; resuming must not restart an old camera command.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, eyeHeight, focus, gl, invalidate, night, observationHeight, request, roundRequested, scene, size.width, size.height, subjectAvailable, viewZoom]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || !(camera instanceof THREE.OrthographicCamera) || viewZoom <= 0) return;
    const opened = supportOpen === true && !support.current.open;
    support.current.open = supportOpen === true;
    if (restoreSupportView && support.current.orbit !== orbit) {
      if (!support.current.restored) {
        support.current.pose = consumeVillageSupportView();
        support.current.restored = true;
      }
      support.current.orbit = orbit;
      const pose = support.current.pose;
      if (!pose) return;
      transition.current = null;
      tracking.current = false;
      restoredZoomRatio.current = pose.zoomRatio / request.zoom;
      orbit.target.set(...pose.target);
      camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(pose.radius, pose.phi, pose.theta)));
      camera.zoom = THREE.MathUtils.clamp(viewZoom * pose.zoomRatio, orbit.minZoom, orbit.maxZoom);
      camera.updateProjectionMatrix();
      orbit.update();
      camera.updateMatrixWorld();
      gl.domElement.dataset.cameraTransition = "idle";
      invalidate();
    } else if (opened) {
      const offset = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
      saveVillageSupportView({ target: orbit.target.toArray(), radius: offset.radius, phi: offset.phi, theta: offset.theta, zoomRatio: camera.zoom / viewZoom });
    }
  }, [camera, gl, invalidate, request.zoom, restoreSupportView, supportOpen, viewZoom]);
  return null;
}

function VillageWorld({ calendar, profile, playerIndoors, selected, keyboardFocus, onSelect, onHover, onOpenMailbox, labelNodes, headerNode, bubbleNode, bubbleTail, onCloseActivities, cameraRequest, onReady, activity, motion, focusBuilding, reaction, korriganReaction, npc, controlsBlocked, supportOpen, restoreSupportView }: Omit<Props, "onUnavailable">) {
  const [dragging, setDragging] = useState(false);
  const terrain = useMemo(() => createVillageTerrain(), []);
  const mailbox = useMemo(() => createVillageMailbox(), []);
  const hempFarm = useMemo(() => createVillageHempFarm(), []);
  const hempFarmCollider = useMemo(() => createVillageHempFarmCollider(), []);
  const hempFarmFocus = useMemo(() => new THREE.Vector3(...HEMP_FARM.position).add(new THREE.Vector3(0, 1.6, 0)), []);
  const mailboxFocus = useMemo(() => new THREE.Vector3(...VILLAGE_MAILBOX_POSITION).add(new THREE.Vector3(0, 2, 0)), []);
  const buildings = useMemo(() => VILLAGE_PLACES.map(place => {
    const object = createVillageBuilding(place.id), position = villagePlacePosition(place);
    const roof = new THREE.Box3().setFromObject(object).max.y * place.scale;
    return { place, object, position, anchor: new THREE.Vector3(position[0], position[1] + roof + 0.25, position[2]) };
  }), []);
  const surface = useMemo(() => createVillageWalkSurface(terrain, buildings), [terrain, buildings]);
  const playerLayer = useRef<THREE.Group>(null);
  const walkTo = useVillagePlayer(profile, playerLayer, terrain, surface, controlsBlocked || motion.paused || motion.hidden, motion.reduced);
  const active = buildings.find(({ place }) => place.id === selected);
  const { camera, size, gl, invalidate, get } = useThree();
  const quality = Math.min(size.width, size.height) < 600 ? "low" : "high";
  const labelPosition = useMemo(() => new THREE.Vector3(), []);
  const compactSigns = useMemo(() => window.matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 540px)"), []);
  const signSizes = useRef(new Map<string, { width: number; height: number }>());
  const labelCamera = useMemo(() => new THREE.Matrix4(), []);
  const projectedCamera = useMemo(() => new THREE.Matrix4(), []);
  const layoutDirty = useRef(true);
  const ready = useRef(false);
  const season = calendar?.season;
  const night = calendar?.phase === "night";
  useLayoutEffect(() => {
    if (!season) return;
    applyVillageSeason(terrain, season);
    get().gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [get, invalidate, season, terrain]);
  useEffect(() => () => {
    disposeVillageObject(terrain);
    disposeVillageObject(mailbox);
    disposeVillageObject(hempFarm);
    hempFarmCollider.dispose();
    buildings.forEach(({ object }) => disposeVillageObject(object));
    gl.domElement.style.removeProperty("cursor");
  }, [buildings, terrain, mailbox, hempFarm, hempFarmCollider, gl]);
  useEffect(() => {
    layoutDirty.current = true;
    const observer = new ResizeObserver(() => { layoutDirty.current = true; invalidate(); });
    if (bubbleNode.current) observer.observe(bubbleNode.current);
    if (headerNode.current) observer.observe(headerNode.current);
    for (const [id, label] of labelNodes.current) {
      if (label.dataset.villageBuilding || id === "korrigans") observer.observe(label);
    }
    invalidate();
    return () => observer.disconnect();
  }, [bubbleNode, headerNode, labelNodes, night, selected, invalidate, size.width, size.height]);
  useFrame(() => {
    projectedCamera.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!layoutDirty.current && projectedCamera.equals(labelCamera)) return;
    labelCamera.copy(projectedCamera);
    const compact = compactSigns.matches;
    if (compact && layoutDirty.current) {
      for (const [id, label] of labelNodes.current) {
        if (label.dataset.villageBuilding || id === "korrigans") signSizes.current.set(id, { width: label.offsetWidth, height: label.offsetHeight });
      }
    }
    layoutDirty.current = false;
    const occupied: VillageLabelBounds[] = [];
    if (compact) {
      const [mailboxX, groundY, mailboxZ] = VILLAGE_MAILBOX_POSITION;
      labelPosition.set(mailboxX, groundY + 1.75, mailboxZ).project(camera);
      const x = (labelPosition.x + 1) * size.width / 2, y = (1 - labelPosition.y) * size.height / 2;
      occupied.push({ left: x - 10, right: x + 10, top: y - 10, bottom: y + 10 });
    }
    const positionLabel = (id: string, x3: number, z3: number, groundY = .4) => {
      const label = labelNodes.current.get(id);
      if (!label) return;
      label.style.removeProperty("visibility");
      labelPosition.set(x3, groundY, z3).project(camera);
      const x = (labelPosition.x + 1) * size.width / 2, y = (1 - labelPosition.y) * size.height / 2;
      const offscreen = labelPosition.z > 1 || Math.abs(labelPosition.x) > 1 || Math.abs(labelPosition.y) > 1;
      const dimensions = compact && !offscreen ? signSizes.current.get(id) : undefined;
      if (dimensions) {
        const sign = placeVillageLabel(x, y, dimensions.width, dimensions.height, size, occupied);
        label.style.transform = `translate(${sign.x}px, ${sign.y}px)`;
      } else {
        label.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
      }
      label.dataset.offscreen = String(offscreen);
    };
    for (const { place, position } of buildings) {
      positionLabel(place.id, position[0], position[2] + place.depth * place.scale / 2 + 0.75);
    }
    positionLabel(HEMP_FARM_ID, HEMP_FARM.position[0], HEMP_FARM.position[2] + HEMP_FARM.footprint.depth * HEMP_FARM.scale / 2 + .52, HEMP_FARM.position[1] + .28);
    positionLabel("mailbox", VILLAGE_MAILBOX_POSITION[0], VILLAGE_MAILBOX_POSITION[2] + 0.9);
    if (night) positionLabel("korrigans", VILLAGE_KORRIGAN_GLADE.x + 1.54, VILLAGE_KORRIGAN_GLADE.z + 1.4, .10);
    if (active && bubbleNode.current) {
      labelPosition.copy(active.anchor).project(camera);
      const headerBottom = headerNode.current?.getBoundingClientRect().bottom ?? 0;
      const clearHeader = headerBottom - gl.domElement.getBoundingClientRect().top + 8;
      positionVillageBubble(bubbleNode.current, bubbleTail.current,
        (labelPosition.x + 1) * size.width / 2, (1 - labelPosition.y) * size.height / 2, size.width, size.height, { clearHeader });
    }
    if (!ready.current) {
      ready.current = true;
      gl.domElement.setAttribute("data-village-ready", "true");
      onReady();
    }
  });
  const choose = (event: ThreeEvent<MouseEvent>, id: VillagePlaceId) => {
    if (event.delta > 5) return;
    event.stopPropagation(); onSelect(id);
  };
  return <>
    <group ref={playerLayer} visible={!playerIndoors} />
    <CameraRig request={cameraRequest} focus={keyboardFocus === "mailbox" ? mailboxFocus : keyboardFocus === HEMP_FARM_ID ? hempFarmFocus : buildings.find(({ place }) => place.id === keyboardFocus)?.anchor ?? active?.anchor} onDrag={setDragging} motion={motion} night={night} controlsBlocked={controlsBlocked} supportOpen={supportOpen} restoreSupportView={restoreSupportView} />
    <VillageAtmosphere terrain={terrain} surface={surface} buildings={buildings} activity={activity} motion={motion} focusBuilding={focusBuilding} reaction={reaction} korriganReaction={korriganReaction} night={night} dragging={dragging} quality={quality} npc={npc} labelNodes={labelNodes} />
    <primitive object={terrain} onClick={(event: ThreeEvent<MouseEvent>) => { if (event.delta <= 5) { event.stopPropagation(); onCloseActivities(); walkTo(event.point); } }} />
    <group position={VILLAGE_MAILBOX_POSITION}
      onClick={event => { if (event.delta > 5) return; event.stopPropagation(); onOpenMailbox(); }}
      onPointerOver={event => { event.stopPropagation(); gl.domElement.style.setProperty("cursor", "pointer"); }}
      onPointerOut={() => { gl.domElement.style.removeProperty("cursor"); }}>
      <primitive object={mailbox} />
    </group>
    <group position={HEMP_FARM.position} scale={HEMP_FARM.scale}>
      <primitive object={hempFarm} />
      {!controlsBlocked && <mesh name="village-hemp-farm-collider" geometry={hempFarmCollider}
        onClick={event => choose(event, HEMP_FARM_ID)}
        onPointerOver={event => { event.stopPropagation(); gl.domElement.style.setProperty("cursor", "pointer"); onHover(HEMP_FARM_ID); }}
        onPointerOut={() => { gl.domElement.style.removeProperty("cursor"); onHover(null); }}>
        <meshBasicMaterial visible={false} />
      </mesh>}
    </group>
    {buildings.map(({ place, object, position }) => <group key={place.id} position={position} scale={place.scale}
      onClick={event => choose(event, place.id)}
      onPointerOver={event => { event.stopPropagation(); gl.domElement.style.setProperty("cursor", "pointer"); onHover(place.id); }}
      onPointerOut={() => { gl.domElement.style.removeProperty("cursor"); onHover(null); }}>
      <primitive object={object} />
      {selected === place.id ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[place.id === "missions" ? 1.4 : 3, place.id === "missions" ? 1.55 : 3.13, 64]} />
        <meshBasicMaterial color="#f8cb57" side={THREE.DoubleSide} />
      </mesh> : null}
    </group>)}
  </>;
}

function VillageLighting({ minute }: { minute: number | null }) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const get = useThree(state => state.get);
  useLayoutEffect(() => {
    if (!ambient.current || !hemi.current || !rim.current || !key.current) return;
    const { gl, invalidate, scene } = get();
    const palette = sampleVillageLighting(minute);
    ambient.current.intensity = palette.ambient;
    hemi.current.intensity = palette.hemi;
    hemi.current.color.copy(palette.sky);
    hemi.current.groundColor.copy(palette.ground);
    rim.current.intensity = palette.rim.power;
    rim.current.color.copy(palette.rim.color);
    key.current.intensity = palette.key.power;
    key.current.color.copy(palette.key.color);
    gl.toneMappingExposure = palette.exposure;
    gl.setClearColor(palette.clear, 1);
    const marine = scene.getObjectByName("village-marine");
    if (marine) applyVillageWaterLight(marine, palette.water);
    applyVillageEmissives(scene, palette.lamps);
    invalidate();
  }, [get, minute]);
  return <>
    <ambientLight ref={ambient} />
    <hemisphereLight ref={hemi} />
    <directionalLight ref={rim} position={light.rim.position} />
    <directionalLight ref={key} position={light.key.position} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-33} shadow-camera-right={33}
      shadow-camera-top={33} shadow-camera-bottom={-33} shadow-camera-near={1} shadow-camera-far={100}
      shadow-bias={-0.0005} shadow-normalBias={0.04} />
  </>;
}

function ContextRecovery({ onUnavailable }: Pick<Props, "onUnavailable">) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onUnavailable(); };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onUnavailable]);
  return null;
}

/** Bounded diagnostics: CPU submission, not GPU execution time. */
function RenderMetrics({ onDprChange }: { onDprChange: (value: number) => void }) {
  const { gl, size } = useThree();
  const smallViewport = Math.min(size.width, size.height) < 600;
  useEffect(() => {
    const original = gl.render;
    const preferred = Math.min(window.devicePixelRatio || 1, smallViewport ? 1.25 : 1.5);
    onDprChange(preferred);
    let last = 0, frames = 0, lateFrames = 0, adapted = false;
    gl.render = function (scene, camera) {
      const started = performance.now();
      original.call(gl, scene, camera);
      // Buildings and terrain are static. Ambient actors use contact shapes;
      // regenerating the entire 2048² shadow map every wave frame is unnecessary.
      gl.shadowMap.autoUpdate = false;
      const data = gl.domElement.dataset;
      data.renderSubmitMs = (performance.now() - started).toFixed(3);
      data.frameInterval = (last ? started - last : 0).toFixed(3);
      data.renderFrames = String(++frames);
      if (frames === 1 || frames % 8 === 0) {
        data.drawCalls = String(gl.info.render.calls);
        data.triangles = String(gl.info.render.triangles);
        data.geometries = String(gl.info.memory.geometries);
        data.textures = String(gl.info.memory.textures);
        data.dpr = String(gl.getPixelRatio());
      }
      if (smallViewport && preferred > 1 && !adapted && data.motionState === "running") {
        const interval = started - last;
        lateFrames = interval > 42 && interval < 160 ? lateFrames + 1 : Math.max(0, lateFrames - 1);
        if (lateFrames >= 12) { adapted = true; onDprChange(1); }
      }
      last = started;
    };
    return () => { gl.render = original; };
  }, [gl, onDprChange, smallViewport]);
  return null;
}

export default function VillageCanvas(props: Props) {
  const [dpr, setDpr] = useState<number | [number, number]>([1, 1.5]);
  return <Canvas orthographic frameloop="demand" shadows={{ type: THREE.PCFShadowMap }} dpr={dpr}
    camera={{ position: [34, 33, 36], near: 0.1, far: 180, zoom: 20 }}
    gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    fallback={<p>La vue 3D est indisponible sur ce navigateur.</p>}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}>
    <ContextRecovery onUnavailable={props.onUnavailable} />
    <RenderMetrics onDprChange={setDpr} />
    <VillageWorld {...props} />
    <VillageLighting minute={props.calendar?.minuteOfDay ?? null} />
  </Canvas>;
}
