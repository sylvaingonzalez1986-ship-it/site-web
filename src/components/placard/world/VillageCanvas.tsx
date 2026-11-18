"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createVillageBuilding, createVillageMailbox, type VillageBuildingKind } from "./village-buildings";
import { createVillageTerrain, disposeVillageObject } from "./village-terrain";
import { VILLAGE_MAILBOX_POSITION, VILLAGE_PLACES, villagePlacePosition } from "./village-layout";
import { positionVillageBubble } from "./village-bubble";
import { VillageAtmosphere, type VillageMotionProps } from "./VillageAtmosphere";
import type { VillageNpcBridge } from "./VillageNpcDialogue";

export type VillageLifeSubject = "wolf" | "fox" | "weasel" | "boat" | "breton" | "fisherman" | "loic";
export type VillageCameraRequest = { rotation: number; zoom: number; reset: number; observe?: VillageLifeSubject };
const LIFE_NAMES: Record<VillageLifeSubject, string> = { wolf: "village-animal-wolf", fox: "village-animal-fox", weasel: "village-animal-weasel", boat: "fishing-boat", breton: "village-breton", fisherman: "village-fisherman", loic: "village-loic" };
type Props = VillageMotionProps & {
  npc: VillageNpcBridge;
  controlsBlocked: boolean;
  selected: VillageBuildingKind | null;
  keyboardFocus: VillageBuildingKind | "mailbox" | null;
  onSelect: (id: VillageBuildingKind) => void;
  onHover: (id: VillageBuildingKind | null) => void;
  onOpenMailbox: () => void;
  cameraRequest: VillageCameraRequest;
  labelNodes: RefObject<Map<string, HTMLButtonElement>>;
  bubbleNode: RefObject<HTMLElement | null>;
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
  for (const phi of [1.06, 0.82, 0.65]) {
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

function CameraRig({ request, focus, onDrag, motion, controlsBlocked }: { request: VillageCameraRequest; focus?: THREE.Vector3; onDrag: (dragging: boolean) => void; motion: VillageMotionProps["motion"]; controlsBlocked: boolean }) {
  const { camera, gl, invalidate, size, scene } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const previous = useRef<{ request?: VillageCameraRequest; focus?: THREE.Vector3; width?: number; height?: number }>({});
  const transition = useRef<CameraTransition | null>(null);
  const stopped = motion.reduced || motion.paused || motion.hidden || controlsBlocked;
  const tracking = useRef(false);
  const observation = useMemo(() => new THREE.Vector3(), []);

  // Run before the labels/bubble project their anchors, using only demand frames.
  useFrame(() => {
    const tween = transition.current, orbit = controls.current;
    if (tracking.current && request.observe && !focus && orbit && !stopped) {
      const subject = scene.getObjectByName(LIFE_NAMES[request.observe]);
      if (subject) {
        subject.getWorldPosition(observation); observation.y += ["breton", "loic", "fisherman"].includes(request.observe) ? 0.9 : 0.4;
        if (tween) tween.toTarget.copy(observation);
        else {
          observation.sub(orbit.target).multiplyScalar(0.2);
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
    orbit.target.set(1.5, 1.2, 4);
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
    return () => { transition.current = null; orbit.removeEventListener("change", redraw); orbit.removeEventListener("start", start); orbit.removeEventListener("end", end); orbit.dispose(); controls.current = null; };
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
    if (controlsBlocked) return;
    const prior = previous.current.request;
    const focusChanged = !!focus && focus !== previous.current.focus;
    const resized = size.width !== previous.current.width || size.height !== previous.current.height;
    if (prior && !focusChanged && request === prior && !resized) {
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
    const subject = request.observe && !focus ? scene.getObjectByName(LIFE_NAMES[request.observe]) : null;
    const observingResident = !!subject && (request.observe === "breton" || request.observe === "loic" || request.observe === "fisherman");
    if (subject) { subject.getWorldPosition(target); target.y += observingResident ? 0.9 : 0.4; }
    tracking.current = !!subject;
    gl.domElement.dataset.lifeObserve = subject ? request.observe! : "";
    const reset = !prior || request.reset !== prior.reset;
    if (reset) {
      if (!focus || prior) target.set(1.5, 1.2, 4);
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
    const subjectZoom = observingResident ? Math.min(size.width / 3.6, size.height / 4.6) : Math.min(size.width / 8, size.height / 6);
    const toZoom = subject ? THREE.MathUtils.clamp(subjectZoom * request.zoom, orbit.minZoom, orbit.maxZoom) : reset || resized || request.zoom !== prior?.zoom || prior?.observe
      ? THREE.MathUtils.clamp(Math.min(size.width / 38, size.height / 30) * request.zoom, orbit.minZoom, orbit.maxZoom)
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
    previous.current = { request, focus, width: size.width, height: size.height };
    // Motion changes cancel separately; resuming must not restart an old camera command.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, focus, gl, invalidate, request, scene, size.width, size.height]);
  return null;
}

function VillageWorld({ selected, keyboardFocus, onSelect, onHover, onOpenMailbox, labelNodes, bubbleNode, bubbleTail, onCloseActivities, cameraRequest, onReady, activity, motion, focusBuilding, reaction, npc, controlsBlocked }: Omit<Props, "onUnavailable">) {
  const [dragging, setDragging] = useState(false);
  const terrain = useMemo(() => createVillageTerrain(), []);
  const mailbox = useMemo(() => createVillageMailbox(), []);
  const mailboxFocus = useMemo(() => new THREE.Vector3(...VILLAGE_MAILBOX_POSITION).add(new THREE.Vector3(0, 2, 0)), []);
  const buildings = useMemo(() => VILLAGE_PLACES.map(place => {
    const object = createVillageBuilding(place.id), position = villagePlacePosition(place);
    const roof = new THREE.Box3().setFromObject(object).max.y * place.scale;
    return { place, object, position, anchor: new THREE.Vector3(position[0], position[1] + roof + 0.25, position[2]) };
  }), []);
  const active = buildings.find(({ place }) => place.id === selected);
  const { camera, size, gl, invalidate } = useThree();
  const quality = Math.min(size.width, size.height) < 600 ? "low" : "high";
  const labelPosition = useMemo(() => new THREE.Vector3(), []);
  const ready = useRef(false);
  useEffect(() => () => {
    disposeVillageObject(terrain);
    disposeVillageObject(mailbox);
    buildings.forEach(({ object }) => disposeVillageObject(object));
    gl.domElement.style.removeProperty("cursor");
  }, [buildings, terrain, mailbox, gl]);
  useEffect(() => {
    const node = bubbleNode.current;
    if (!node) return;
    const observer = new ResizeObserver(() => invalidate());
    observer.observe(node);
    return () => observer.disconnect();
  }, [bubbleNode, selected, invalidate]);
  useFrame(() => {
    const positionLabel = (id: string, x3: number, z3: number) => {
      const label = labelNodes.current.get(id);
      if (!label) return;
      label.style.removeProperty("visibility");
      labelPosition.set(x3, 0.4, z3).project(camera);
      const x = (labelPosition.x + 1) * size.width / 2, y = (1 - labelPosition.y) * size.height / 2;
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
      label.dataset.offscreen = String(labelPosition.z > 1 || Math.abs(labelPosition.x) > 1 || Math.abs(labelPosition.y) > 1);
    };
    for (const { place, position } of buildings) {
      positionLabel(place.id, position[0], position[2] + place.depth * place.scale / 2 + 0.75);
    }
    positionLabel("mailbox", VILLAGE_MAILBOX_POSITION[0], VILLAGE_MAILBOX_POSITION[2] + 0.9);
    if (active && bubbleNode.current) {
      labelPosition.copy(active.anchor).project(camera);
      positionVillageBubble(bubbleNode.current, bubbleTail.current,
        (labelPosition.x + 1) * size.width / 2, (1 - labelPosition.y) * size.height / 2, size.width, size.height);
    }
    if (!ready.current) {
      ready.current = true;
      gl.domElement.setAttribute("data-village-ready", "true");
      onReady();
    }
  });
  const choose = (event: ThreeEvent<MouseEvent>, id: VillageBuildingKind) => {
    if (event.delta > 5) return;
    event.stopPropagation(); onSelect(id);
  };
  return <>
    <CameraRig request={cameraRequest} focus={keyboardFocus === "mailbox" ? mailboxFocus : buildings.find(({ place }) => place.id === keyboardFocus)?.anchor ?? active?.anchor} onDrag={setDragging} motion={motion} controlsBlocked={controlsBlocked} />
    <VillageAtmosphere terrain={terrain} buildings={buildings} activity={activity} motion={motion} focusBuilding={focusBuilding} reaction={reaction} dragging={dragging} quality={quality} npc={npc} labelNodes={labelNodes} />
    <primitive object={terrain} onClick={(event: ThreeEvent<MouseEvent>) => { if (event.delta <= 5) { event.stopPropagation(); onCloseActivities(); } }} />
    <group position={VILLAGE_MAILBOX_POSITION}
      onClick={event => { if (event.delta > 5) return; event.stopPropagation(); onOpenMailbox(); }}
      onPointerOver={event => { event.stopPropagation(); gl.domElement.style.setProperty("cursor", "pointer"); }}
      onPointerOut={() => { gl.domElement.style.removeProperty("cursor"); }}>
      <primitive object={mailbox} />
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
function RenderMetrics() {
  const { gl } = useThree();
  useEffect(() => {
    const original = gl.render;
    let last = 0, frames = 0;
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
      data.drawCalls = String(gl.info.render.calls);
      data.triangles = String(gl.info.render.triangles);
      data.geometries = String(gl.info.memory.geometries);
      data.textures = String(gl.info.memory.textures);
      data.dpr = String(gl.getPixelRatio());
      last = started;
    };
    return () => { gl.render = original; };
  }, [gl]);
  return null;
}

export default function VillageCanvas(props: Props) {
  return <Canvas orthographic frameloop="demand" shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.5]}
    camera={{ position: [34, 33, 36], near: 0.1, far: 180, zoom: 20 }}
    gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    fallback={<p role="alert">La 3D n’est pas disponible. La carte d’origine reste accessible.</p>}
    onCreated={({ gl }) => { gl.setClearColor("#f4e8ce", 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.12; }}>
    <ambientLight intensity={0.28} />
    <hemisphereLight args={["#fff3dd", "#708d7c", 1.25]} />
    <directionalLight position={[15, 14, -20]} intensity={0.55} color="#c7e9ed" />
    <directionalLight position={[-12, 28, 18]} intensity={2.7} color="#fff0cc" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-33} shadow-camera-right={33}
      shadow-camera-top={33} shadow-camera-bottom={-33} shadow-camera-near={1} shadow-camera-far={100}
      shadow-bias={-0.0005} shadow-normalBias={0.04} />
    <ContextRecovery onUnavailable={props.onUnavailable} />
    <RenderMetrics />
    <VillageWorld {...props} />
  </Canvas>;
}
