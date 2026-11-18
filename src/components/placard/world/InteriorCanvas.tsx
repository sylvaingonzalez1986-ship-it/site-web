"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { createInteriorObjectArt, createInteriorRoomArt, disposeInteriorArt } from "./interior-art";
import { findInteriorSpawn, interiorFloorCell, INTERIOR_EYE_HEIGHT, interiorMovementVector, interiorPositionIsFree, moveInteriorPlayer, type InteriorPoint } from "./interior-movement";
import type { InteriorSceneProps } from "./interior-types";
import styles from "./InteriorCanvas.module.css";

type Runtime = {
  sync: (props: InteriorSceneProps) => void;
  move: (direction: string, active: boolean) => void;
  interact: () => void;
  view: (action: "in" | "out" | "reset") => void;
  destroy: () => void;
};
const movementKeys: Record<string, string> = { w: "forward", z: "forward", s: "back", a: "left", q: "left", d: "right", ArrowUp: "forward", ArrowDown: "back", ArrowLeft: "left", ArrowRight: "right" };

function createRuntime(canvas: HTMLCanvasElement, initial: InteriorSceneProps): Runtime {
  let props = initial, disposed = false, frame = 0, previousFrame = 0, lastRender = 0, renders = 0;
  let yaw = 0, pitch = 0, autoLow = false, slowFrames = 0, focused = true;
  let planZoom = 1;
  const planPan = { x: 0, z: 0 };
  let visible = document.visibilityState !== "hidden", inViewport = true;
  let point = findInteriorSpawn({ x: props.room.spawn[0], z: props.room.spawn[1] }, props.room);
  const context = canvas.getContext("webgl2", { antialias: true, powerPreference: "low-power" });
  // A lost/unavailable context returns null shader capabilities. Keep this on the
  // normal fallback path instead of entering Three's capability initialization.
  if (!context || context.isContextLost()
    || [context.VERTEX_SHADER, context.FRAGMENT_SHADER].some(shader =>
      [context.HIGH_FLOAT, context.MEDIUM_FLOAT].some(precision => !context.getShaderPrecisionFormat(shader, precision)))) {
    throw new Error("Le contexte WebGL de cet intérieur est indisponible.");
  }
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4dfb8");
  scene.add(new THREE.HemisphereLight("#fff7de", "#ad9a74", 2.4));
  const sunlight = new THREE.DirectionalLight("#fff2cf", 2.3);
  sunlight.position.set(-4, 9, 6); scene.add(sunlight);
  const fill = new THREE.DirectionalLight("#b8e3e2", 0.8);
  fill.position.set(5, 4, -4); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.06, 150);
  camera.rotation.order = "YXZ";
  const roomArt = createInteriorRoomArt(props.room);
  scene.add(roomArt);
  const objects = new Map<string, { signature: string; art: THREE.Group }>();
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), floorHit = new THREE.Vector3();
  const keys = new Set<string>();
  const preview = new THREE.Group(); scene.add(preview);
  let previewSignature = "";
  function cellMarker(color: string, opacity: number) {
    const group = new THREE.Group(), square = new THREE.PlaneGeometry(1, 1);
    const sheet = new THREE.Mesh(square, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    sheet.rotation.x = -Math.PI / 2; group.add(sheet);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(square), new THREE.LineBasicMaterial({ color: "#173f3a", depthTest: false }));
    outline.rotation.x = -Math.PI / 2; outline.position.y = 0.008; group.add(outline);
    group.visible = false; scene.add(group); return group;
  }
  const hoverMarker = cellMarker("#efb63d", 0.2), selectedCellMarker = cellMarker("#078d87", 0.36);
  let hoveredCell: InteriorPoint | null = null;
  function showCell(marker: THREE.Group, cell: InteriorPoint | null) {
    marker.visible = props.editing && !!cell;
    if (cell) marker.position.set(cell.x, 0.035, cell.z);
  }
  function setHoveredCell(cell: InteriorPoint | null) {
    if (cell?.x === hoveredCell?.x && cell?.z === hoveredCell?.z) return;
    hoveredCell = cell; showCell(hoverMarker, cell);
    if (cell) canvas.dataset.hoverCell = `${cell.x},${cell.z}`; else delete canvas.dataset.hoverCell;
    canvas.style.cursor = cell ? "cell" : props.overhead ? "default" : "grab";
    request();
  }
  const grid = new THREE.Group(); scene.add(grid);
  const gridWidth = props.room.workArea?.width ?? props.room.width, gridDepth = props.room.workArea?.depth ?? props.room.depth;
  const gridPoints: number[] = [];
  for (let x = -gridWidth / 2; x <= gridWidth / 2; x += 1) gridPoints.push(x, 0.021, -gridDepth / 2, x, 0.021, gridDepth / 2);
  for (let z = -gridDepth / 2; z <= gridDepth / 2; z += 1) gridPoints.push(-gridWidth / 2, 0.021, z, gridWidth / 2, 0.021, z);
  grid.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(gridPoints, 3)), new THREE.LineBasicMaterial({ color: "#476e68", transparent: true, opacity: 0.33 })));
  const boundary = [-gridWidth / 2, 0.018, -gridDepth / 2, gridWidth / 2, 0.018, -gridDepth / 2, gridWidth / 2, 0.018, -gridDepth / 2, gridWidth / 2, 0.018, gridDepth / 2, gridWidth / 2, 0.018, gridDepth / 2, -gridWidth / 2, 0.018, gridDepth / 2, -gridWidth / 2, 0.018, gridDepth / 2, -gridWidth / 2, 0.018, -gridDepth / 2];
  grid.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(boundary, 3)), new THREE.LineBasicMaterial({ color: "#16786c" })));
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;
  let handledTouch: { x: number; y: number; at: number } | null = null;

  function active() { return !disposed && !props.suspended && visible && inViewport && focused; }
  function request() { if (active() && !frame) frame = requestAnimationFrame(draw); }
  function stop() {
    keys.clear(); drag = null; previousFrame = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  function setCamera() {
    if (props.overhead) {
      const distance = Math.max(props.room.depth, props.room.width / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.12;
      camera.position.set(planPan.x, distance / planZoom, planPan.z); camera.up.set(0, 0, -1); camera.lookAt(planPan.x, 0, planPan.z);
    } else {
      camera.up.set(0, 1, 0); camera.position.set(point.x, INTERIOR_EYE_HEIGHT, point.z);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    }
    camera.updateMatrixWorld();
  }
  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, props.quality === "low" || (props.quality === "auto" && autoLow) ? 0.8 : props.quality === "high" ? 2 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix();
    canvas.dataset.dpr = String(dpr); request();
  }
  function draw(now: number, staticOnly = false) {
    frame = 0;
    const canPaintStatic = staticOnly && renders > 0 && !disposed && visible && inViewport && focused && canvas.getClientRects().length > 0;
    if (!active() && !canPaintStatic) { previousFrame = 0; return; }
    const dt = previousFrame ? Math.min((now - previousFrame) / 1000, 0.05) : 1 / 60;
    previousFrame = now;
    const sideways = Number(keys.has("right")) - Number(keys.has("left"));
    const forward = Number(keys.has("forward")) - Number(keys.has("back"));
    if (!staticOnly && !props.overhead && (sideways || forward)) point = moveInteriorPlayer(point, interiorMovementVector(sideways, forward, yaw, 2.5 * dt), props.room);
    setCamera();
    const started = performance.now();
    renderer.render(scene, camera);
    const duration = performance.now() - started;
    const interval = lastRender ? now - lastRender : 0;
    lastRender = now;
    canvas.dataset.renderCount = String(++renders);
    canvas.dataset.frameMs = duration.toFixed(2);
    canvas.dataset.renderSubmitMs = duration.toFixed(2);
    canvas.dataset.frameInterval = interval.toFixed(2);
    canvas.dataset.fps = interval > 0 ? (1000 / interval).toFixed(1) : "";
    canvas.dataset.calls = String(renderer.info.render.calls);
    canvas.dataset.triangles = String(renderer.info.render.triangles);
    canvas.dataset.geometries = String(renderer.info.memory.geometries);
    canvas.dataset.textures = String(renderer.info.memory.textures);
    canvas.dataset.position = `${point.x.toFixed(3)},${INTERIOR_EYE_HEIGHT},${point.z.toFixed(3)}`;
    canvas.dataset.x = point.x.toFixed(3); canvas.dataset.z = point.z.toFixed(3);
    canvas.dataset.yaw = yaw.toFixed(4); canvas.dataset.pitch = pitch.toFixed(4);
    canvas.dataset.planZoom = String(planZoom); canvas.dataset.planPan = `${planPan.x.toFixed(3)},${planPan.z.toFixed(3)}`;
    canvas.dataset.quality = props.quality === "auto" ? (autoLow ? "auto-low" : "auto-high") : props.quality;
    if (canvas.dataset.ready !== "true") { canvas.dataset.ready = "true"; props.onReady(); }
    if (props.quality === "auto" && !autoLow) {
      const slow = duration > 28 || ((sideways || forward) && interval > 38 && interval < 250);
      slowFrames = slow ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames >= 6) { autoLow = true; resize(); }
    }
    if (!staticOnly && (sideways || forward)) request(); else previousFrame = 0;
  }
  function sync(next: InteriorSceneProps) {
    const old = props; props = next;
    if (next.editing && !old.editing) { planZoom = 1; planPan.x = 0; planPan.z = 0; }
    const oldPreviewSignature = previewSignature;
    roomArt.traverse(child => { if (child.userData.interiorRoof) child.visible = !next.overhead; });
    for (const [id, entry] of objects) if (!next.room.objects.some(object => object.id === id)) { scene.remove(entry.art); disposeInteriorArt(entry.art); objects.delete(id); }
    for (const object of next.room.objects) {
      // Position is applied separately, so moving a draft never rebuilds its artwork.
      const signature = JSON.stringify({ ...object, x: 0, z: 0 });
      let entry = objects.get(object.id);
      if (!entry || entry.signature !== signature) {
        if (entry) { scene.remove(entry.art); disposeInteriorArt(entry.art); }
        const art = createInteriorObjectArt(object); art.userData.interiorId = object.id;
        entry = { art, signature }; objects.set(object.id, entry); scene.add(art);
      }
      entry.art.position.set(object.x, 0, object.z);
      if (entry.art.userData.interiorPartition) entry.art.scale.y = next.overhead ? 0.16 : 1;
    }
    // A new confirmed layout may occupy the old player position. Draft previews never do.
    if (!interiorPositionIsFree(point, next.room)) point = findInteriorSpawn(point, next.room);
    const footprint = next.preview ?? next.room.objects.find(object => object.id === next.selectedId);
    const nextPreviewSignature = JSON.stringify([next.editing, footprint, next.previewValid, !!next.preview, next.overhead]);
    if (previewSignature !== nextPreviewSignature) {
      previewSignature = nextPreviewSignature;
      disposeInteriorArt(preview);
      if (next.editing && footprint) {
        if (next.preview) {
          const ghost = createInteriorObjectArt(next.preview);
          if (ghost.userData.interiorPartition) ghost.scale.y = next.overhead ? 0.16 : 1;
          ghost.traverse(child => {
            if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return;
            for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
              material.transparent = true; material.opacity = 0.42; material.depthWrite = false;
            }
          });
          ghost.position.set(footprint.x, 0.03, footprint.z); preview.add(ghost);
        }
        const color = next.preview && !next.previewValid ? "#ae3b35" : "#16786c";
        const geometry = new THREE.PlaneGeometry(footprint.width, footprint.depth);
        const sheet = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
        sheet.rotation.x = -Math.PI / 2; sheet.position.set(footprint.x, 0.025, footprint.z); preview.add(sheet);
        const box = new THREE.BoxGeometry(footprint.width, 0.035, footprint.depth);
        const border = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color }));
        box.dispose();
        border.position.set(footprint.x, 0.045, footprint.z); preview.add(border);
        canvas.dataset.previewValid = String(next.previewValid);
      } else delete canvas.dataset.previewValid;
    }
    grid.visible = next.editing && next.grid;
    const selectedCell = next.selectedCell ? interiorFloorCell(next.selectedCell, next.room) : null;
    showCell(selectedCellMarker, selectedCell);
    if (selectedCell && next.editing) canvas.dataset.selectedCell = `${selectedCell.x},${selectedCell.z}`; else delete canvas.dataset.selectedCell;
    if (!next.editing || next.suspended) setHoveredCell(null);
    canvas.dataset.overhead = String(next.overhead); canvas.dataset.suspended = String(next.suspended);
    if (next.suspended || next.overhead !== old.overhead) stop();
    if (next.quality !== old.quality) resize();
    const visualChange = old.room !== next.room || oldPreviewSignature !== nextPreviewSignature || old.overhead !== next.overhead || old.grid !== next.grid
      || old.selectedCell?.x !== next.selectedCell?.x || old.selectedCell?.z !== next.selectedCell?.z;
    // Modal edits can update their visible ghost once while movement stays suspended.
    if (next.suspended && visualChange) draw(performance.now(), true); else request();
  }
  function aim(clientX?: number, clientY?: number) {
    setCamera();
    scene.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect();
    pointer.set(clientX === undefined ? 0 : (clientX - rect.left) / rect.width * 2 - 1, clientY === undefined ? 0 : -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function target() {
    const hits = raycaster.intersectObjects([roomArt, ...Array.from(objects.values(), value => value.art)], true);
    for (const hit of hits) {
      // Ink outlines have a world-space ray threshold and must never steal a click.
      if (!(hit.object instanceof THREE.Mesh)) continue;
      let ancestor: THREE.Object3D | null = hit.object, hidden = false;
      while (ancestor) { if (!ancestor.visible) hidden = true; ancestor = ancestor.parent; }
      if (hidden) continue;
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.interiorId) object = object.parent;
      if (!object) return null; // A wall or floor occludes the target.
      return { id: object.userData.interiorId as string, distance: hit.distance };
    }
    return null;
  }
  function interact() {
    if (!active() || props.overhead) return;
    aim(); const hit = target();
    if (hit && hit.distance <= 3.2) {
      const object = props.room.objects.find(item => item.id === hit.id);
      if (object?.kind === "exit") props.onExit(); else props.onInteract(hit.id);
      return;
    }
    // Door opening is not solid geometry. Facing it nearby is also an interaction.
    if (Math.abs(point.x) <= 1.05 && props.room.depth / 2 - point.z < 2.1 && Math.cos(yaw) < -0.65 && Math.abs(pitch) < 0.65) props.onExit();
  }
  function click(clientX: number, clientY: number) {
    if (!active()) return;
    aim(document.pointerLockElement === canvas ? undefined : clientX, document.pointerLockElement === canvas ? undefined : clientY);
    const hit = target();
    if (hit && (props.overhead || hit.distance <= 4.5)) { props.onSelect(hit.id); return; }
    if (props.editing && raycaster.ray.intersectPlane(floor, floorHit)) {
      const cell = interiorFloorCell(floorHit, props.room);
      if (cell) {
        showCell(selectedCellMarker, cell); setHoveredCell(null);
        canvas.dataset.selectedCell = `${cell.x},${cell.z}`;
        // Paint the chosen cell before its HTML popup suspends the scene.
        if (frame) cancelAnimationFrame(frame);
        frame = 0; draw(performance.now());
        props.onPlace(cell.x, cell.z);
      }
    }
  }
  function hover(clientX?: number, clientY?: number) {
    if (!active() || !props.editing) { setHoveredCell(null); return; }
    aim(clientX, clientY);
    setHoveredCell(raycaster.ray.intersectPlane(floor, floorHit) ? interiorFloorCell(floorHit, props.room) : null);
  }
  function look(dx: number, dy: number) {
    if (!active() || props.overhead) return;
    const speed = 0.0022 * Math.max(0.2, Math.min(3, props.sensitivity));
    yaw -= dx * speed; pitch = Math.max(-1.35, Math.min(1.25, pitch - dy * speed)); request();
  }
  function clampPlanPan() {
    const maxX = props.room.width / 2 * (1 - 1 / planZoom), maxZ = props.room.depth / 2 * (1 - 1 / planZoom);
    planPan.x = Math.max(-maxX, Math.min(maxX, planPan.x)); planPan.z = Math.max(-maxZ, Math.min(maxZ, planPan.z));
  }
  function view(action: "in" | "out" | "reset") {
    if (!active() || !props.overhead) return;
    planZoom = action === "reset" ? 1 : Math.max(1, Math.min(3, planZoom + (action === "in" ? 0.5 : -0.5)));
    if (action === "reset") { planPan.x = 0; planPan.z = 0; }
    clampPlanPan(); setHoveredCell(null); request();
  }
  function down(event: PointerEvent) {
    if (!active() || event.button !== 0) return;
    if (drag && drag.id !== event.pointerId) return;
    if (event.pointerType === "touch") event.preventDefault();
    canvas.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    if (document.pointerLockElement !== canvas) canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (document.pointerLockElement === canvas) return;
    if (!drag || drag.id !== event.pointerId) { hover(event.clientX, event.clientY); return; }
    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (props.overhead && drag.moved) {
      const metresPerPixel = 2 * camera.position.y * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.clientHeight);
      planPan.x -= dx * metresPerPixel; planPan.z -= dy * metresPerPixel; clampPlanPan(); request();
    } else look(dx, dy);
    drag.x = event.clientX; drag.y = event.clientY;
    hover(event.clientX, event.clientY);
  }
  function up(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved; drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!moved) {
      if (event.pointerType === "touch") { event.preventDefault(); handledTouch = { x: event.clientX, y: event.clientY, at: performance.now() }; }
      click(event.clientX, event.clientY);
    }
  }
  const consumeHandledTouchClick = (event: MouseEvent) => {
    if (!handledTouch || performance.now() - handledTouch.at > 600
      || Math.hypot(event.clientX - handledTouch.x, event.clientY - handledTouch.y) > 8) return;
    // Opening the modal on pointerup must not activate a choice under the
    // browser's compatibility click for that same canvas tap.
    handledTouch = null; event.preventDefault(); event.stopImmediatePropagation();
  };
  const newPointer = () => { handledTouch = null; };
  const lockedMove = (event: MouseEvent) => { if (document.pointerLockElement === canvas) { look(event.movementX, event.movementY); hover(); } };
  const pointerLeave = () => { if (!drag) setHoveredCell(null); };
  const wheel = (event: WheelEvent) => { if (active() && props.overhead) { event.preventDefault(); view(event.deltaY < 0 ? "in" : "out"); } };
  const cancelDrag = () => { drag = null; };
  const cancel = () => { drag = null; keys.clear(); };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") { if (document.pointerLockElement === canvas) document.exitPointerLock(); cancel(); return; }
    if (!active() || props.overhead || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = movementKeys[event.key] ?? movementKeys[event.key.toLowerCase()];
    if (direction) { event.preventDefault(); keys.add(direction); request(); }
    if (event.key.toLowerCase() === "e") { event.preventDefault(); if (!event.repeat) interact(); }
  };
  const keyUp = (event: KeyboardEvent) => { const direction = movementKeys[event.key] ?? movementKeys[event.key.toLowerCase()]; if (direction) keys.delete(direction); };
  const visibility = () => { visible = document.visibilityState !== "hidden"; if (!visible) stop(); else request(); };
  const blur = () => { focused = false; stop(); };
  const focus = () => { focused = true; request(); };
  const contextLost = (event: Event) => { event.preventDefault(); stop(); props.onUnavailable(); };
  const pointerLockChange = () => { if (document.pointerLockElement !== canvas) cancel(); };
  const canvasBlur = () => { if (document.pointerLockElement !== canvas) cancel(); };
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", pointerMove); canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancelDrag); canvas.addEventListener("lostpointercapture", cancelDrag);
  canvas.addEventListener("pointerleave", pointerLeave);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", keyDown); canvas.addEventListener("blur", canvasBlur); canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("mousemove", lockedMove); document.addEventListener("visibilitychange", visibility);
  document.addEventListener("pointerlockchange", pointerLockChange);
  document.addEventListener("click", consumeHandledTouchClick, true);
  document.addEventListener("pointerdown", newPointer, true);
  window.addEventListener("keyup", keyUp); window.addEventListener("blur", blur); window.addEventListener("focus", focus);
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  const intersection = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
    inViewport = entries.some(entry => entry.isIntersecting); if (!inViewport) stop(); else request();
  }) : null;
  intersection?.observe(canvas);
  sync(initial); resize();
  return {
    sync, interact, view,
    move(direction, pressed) { if (pressed && active() && !props.overhead) { keys.add(direction); request(); } else keys.delete(direction); },
    destroy() {
      if (disposed) return;
      stop(); disposed = true; observer.disconnect(); intersection?.disconnect();
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancelDrag); canvas.removeEventListener("lostpointercapture", cancelDrag);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyDown); canvas.removeEventListener("blur", canvasBlur); canvas.removeEventListener("webglcontextlost", contextLost);
      document.removeEventListener("mousemove", lockedMove); document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", pointerLockChange);
      document.removeEventListener("click", consumeHandledTouchClick, true);
      document.removeEventListener("pointerdown", newPointer, true);
      window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); window.removeEventListener("focus", focus);
      disposeInteriorArt(roomArt); disposeInteriorArt(preview); disposeInteriorArt(grid); disposeInteriorArt(hoverMarker); disposeInteriorArt(selectedCellMarker);
      objects.forEach(entry => disposeInteriorArt(entry.art)); renderer.dispose(); renderer.forceContextLoss();
      delete canvas.dataset.ready;
    },
  };
}

export default function InteriorCanvas(props: InteriorSceneProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null), runtime = useRef<Runtime | null>(null);
  const latest = useRef(props);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    latest.current = props;
    if (canvas.current) canvas.current.tabIndex = props.suspended ? -1 : 0;
    runtime.current?.sync(props);
  }, [props]);
  useEffect(() => {
    const host = viewport.current;
    if (!host) return;
    // Each effect owns its canvas and context. Strict Mode, Fast Refresh and a
    // room resize can restart effects without replacing React's DOM container.
    // Reusing its previous canvas after forceContextLoss would reuse a lost GL.
    const node = document.createElement("canvas");
    node.className = styles.canvas;
    node.tabIndex = latest.current.suspended ? -1 : 0;
    node.setAttribute("aria-label", `${latest.current.room.name}, vue 3D. Avancer avec Z ou W, reculer avec S, tourner en glissant, E pour interagir.`);
    host.appendChild(node);
    canvas.current = node;
    let ownedRuntime: Runtime | null = null;
    try { ownedRuntime = createRuntime(node, latest.current); runtime.current = ownedRuntime; }
    catch {
      try { node.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext(); }
      catch { /* Context creation itself can fail; the accessible fallback still applies. */ }
      node.remove();
      if (canvas.current === node) canvas.current = null;
      latest.current.onUnavailable();
    }
    return () => {
      ownedRuntime?.destroy();
      node.remove();
      if (runtime.current === ownedRuntime) runtime.current = null;
      if (canvas.current === node) canvas.current = null;
    };
  }, [props.room.id, props.room.width, props.room.depth, props.room.height]);
  useEffect(() => {
    const change = () => setLocked(document.pointerLockElement === canvas.current);
    document.addEventListener("pointerlockchange", change);
    return () => document.removeEventListener("pointerlockchange", change);
  }, []);
  function lockMouse() {
    const node = canvas.current;
    if (!node || props.suspended || props.overhead) return;
    if (document.pointerLockElement === node) { document.exitPointerLock(); return; }
    node.focus({ preventScroll: true });
    try { const result = node.requestPointerLock?.(); if (result) void result.catch(() => { /* Drag look remains available. */ }); } catch { /* Unsupported contexts retain drag look. */ }
  }
  function touchDirection(event: ReactPointerEvent<HTMLButtonElement>, direction: string, pressed: boolean) {
    event.preventDefault();
    if (pressed) event.currentTarget.setPointerCapture(event.pointerId);
    runtime.current?.move(direction, pressed);
  }
  return <div className={styles.scene} data-interior-scene={props.room.id}>
    <div ref={viewport} className={styles.viewport} />
    {!props.suspended && props.overhead && <div className={styles.viewControls} aria-label="Vue du plan">
      <button type="button" aria-label="Agrandir le plan" onClick={() => runtime.current?.view("in")}>+</button>
      <button type="button" aria-label="Réduire le plan" onClick={() => runtime.current?.view("out")}>−</button>
      <button type="button" aria-label="Recentrer le plan" onClick={() => runtime.current?.view("reset")}>⌖</button>
    </div>}
    {!props.suspended && !props.overhead && <>
      <span className={styles.crosshair} aria-hidden="true">+</span>
      <div className={styles.actions}>
        <button type="button" onClick={lockMouse} aria-pressed={locked}>{locked ? "Libérer la souris (Échap)" : "Activer la souris"}</button>
        <button type="button" onClick={() => runtime.current?.interact()}>Interagir (E)</button>
      </div>
      <div className={styles.movement} aria-label="Déplacement tactile">
        {([ ["forward", "Avancer", "↑"], ["left", "Aller à gauche", "←"], ["back", "Reculer", "↓"], ["right", "Aller à droite", "→"] ] as const).map(([direction, label, symbol]) => <button key={direction} type="button" aria-label={label} data-direction={direction}
          onPointerDown={event => touchDirection(event, direction, true)} onPointerUp={event => touchDirection(event, direction, false)} onPointerCancel={event => touchDirection(event, direction, false)} onLostPointerCapture={() => runtime.current?.move(direction, false)}
          onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); runtime.current?.move(direction, true); } }}
          onKeyUp={() => runtime.current?.move(direction, false)} onBlur={() => runtime.current?.move(direction, false)}>{symbol}</button>)}
      </div>
    </>}
  </div>;
}
