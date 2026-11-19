import * as THREE from "three";
import { lightBuildingRoom } from "./building-room-lighting";
import { addContactShadows, createStationHalo } from "./building-station-feedback";
import { addBuildingWallPrint } from "./building-wall-prints";
import { createInteriorObjectArt, createInteriorRoomArt, disposeInteriorArt } from "./interior-art";
import type { InteriorRoom } from "./interior-types";
import { VILLAGE_LIGHT } from "./village-lighting";
import { createVillageLoic } from "./village-loic";
import type { VillageNpcRig } from "./village-npc-types";

type BuildingRendererCallbacks = {
  choose: (id: string) => void;
  ready: () => void;
  unavailable: () => void;
  hover?: (id: string | null) => void;
};

type BuildingIsometricRenderer = {
  dispose: () => void;
  setFocus: (id: string | null) => void;
  activate: (id: string) => void;
  setMotion: (enabled: boolean) => void;
};

const ROOM_GESTURES: Partial<Record<InteriorRoom["id"], { pivot: string; pitch: number; yaw: number; hand: number; rest: number }>> = {
  bank: { pivot: "bank-banker", pitch: .10, yaw: .16, hand: .14, rest: 4300 },
  office: { pivot: "office-clerk", pitch: .13, yaw: .12, hand: .1, rest: 4600 },
  market: { pivot: "market-loic", pitch: .14, yaw: .14, hand: -.28, rest: 4500 },
  shop: { pivot: "shop-loic", pitch: -.035, yaw: .23, hand: -.24, rest: 5100 },
  arena: { pivot: "arena-judge", pitch: .18, yaw: .20, hand: -.15, rest: 5100 },
  missions: { pivot: "", pitch: .05, yaw: .28, hand: .0, rest: 6600 },
};

function frameRoom(camera: THREE.OrthographicCamera, meshes: THREE.Mesh[]) {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  const toCamera = new THREE.Matrix4();
  camera.position.set(1, 1, 1).setLength(32);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box || box.isEmpty()) continue;
    toCamera.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          bounds.expandByPoint(point.set(x, y, z).applyMatrix4(toCamera));
        }
      }
    }
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  camera.translateX(center.x);
  camera.translateY(center.y);
  camera.updateMatrixWorld();
  return size.multiplyScalar(1.09);
}

export function createBuildingIsometricRenderer(
  canvas: HTMLCanvasElement,
  room: InteriorRoom,
  callbacks: BuildingRendererCallbacks,
): BuildingIsometricRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  const model = new THREE.Group();
  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(VILLAGE_LIGHT.key.color, VILLAGE_LIGHT.key.power);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const meshes: THREE.Mesh[] = [];
  const destinations = new Map<THREE.Object3D, string>();
  const halos = new Map<string, THREE.Group>();
  const bank = room.id === "bank";
  let guide: VillageNpcRig | undefined;
  let span: THREE.Vector3;
  let printSettled = false;
  let invalidatePrint: (() => void) | undefined;
  try {
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lightBuildingRoom(scene, key, room);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    scene.add(model);
    model.add(createInteriorRoomArt(room, { cutaway: true }));
    if (room.id === "missions") {
      guide = createVillageLoic();
      guide.object.position.set(1.52, .023, 2.18);
      guide.object.rotation.y = .58;
      model.add(guide.object);
    }
    for (const object of room.objects) {
      const furniture = createInteriorObjectArt(object, room.id);
      furniture.position.set(object.x, .016 + (object.elevation ?? 0), object.z);
      model.add(furniture);
      if (object.href || object.kind === "exit") {
        furniture.traverseVisible(child => {
          if (child instanceof THREE.Mesh) destinations.set(child, object.id);
        });
      }
    }
    addBuildingWallPrint(model, room.id, () => {
      printSettled = true;
      invalidatePrint?.();
    });
    model.updateMatrixWorld(true);
    model.traverseVisible(child => {
      if (!(child instanceof THREE.Mesh)) return;
      meshes.push(child);
      if (bank && child.name.endsWith("-gold") && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.roughness = .42;
        child.material.metalness = .28;
      }
    });
    span = frameRoom(camera, meshes);
    addContactShadows(model, room.objects);
    for (const object of room.objects) {
      if (!object.href && object.kind !== "exit") continue;
      const halo = createStationHalo(object);
      halos.set(object.id, halo);
      model.add(halo);
    }
  } catch (error) {
    disposeModel();
    key.shadow.dispose();
    renderer.dispose();
    throw error;
  }

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const gesture = ROOM_GESTURES[room.id];
  const head = gesture?.pivot ? model.getObjectByName(`${gesture.pivot}-head`) : undefined;
  const hand = gesture?.pivot ? model.getObjectByName(`${gesture.pivot}-hand`) : undefined;
  const wheel = bank ? model.getObjectByName("bank-vault-wheel") : undefined;
  const herbs = model.getObjectByName("market-herbs");
  const flag = model.getObjectByName("shop-flag");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let motion = true;
  let hovered: string | null = null;
  let focused: string | null = null;
  let active: { id: string; at: number } | null = null;
  let timer = 0;
  let nextGesture = performance.now() + 2200;
  let guidePosing = false;
  let press: { pointerId: number; id: string; x: number; y: number } | undefined;
  let released: typeof press;
  let frame = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 0;
  let dirty = true;
  let visible = false;
  let ready = false;
  let lost = false;
  let disposed = false;

  function schedule() {
    if (!frame && dirty && canDraw()) {
      frame = requestAnimationFrame(draw);
    }
  }

  function canDraw() {
    return printSettled && visible && !document.hidden && !lost && !disposed;
  }

  function stopTimer() {
    window.clearTimeout(timer);
    timer = 0;
  }

  function disposeModel() {
    guide?.object.removeFromParent();
    guide?.dispose();
    disposeInteriorArt(model);
  }

  function pose(now: number) {
    stopTimer();
    const enabled = motion && !reduced.matches;
    const activationDuration = enabled ? 440 : 180;
    if (active && now - active.at >= activationDuration) active = null;
    const activationProgress = active ? Math.max(0, (now - active.at) / activationDuration) : 0;
    const currentHalo = active?.id ?? focused ?? hovered;
    for (const [id, halo] of halos) {
      halo.visible = id === currentHalo;
      if (!halo.visible) continue;
      const scale = active ? 1 + (enabled ? .08 * (1 - activationProgress) : .08) : 1;
      halo.scale.set(scale, scale, 1);
    }

    let delay = active ? Math.max(0, active.at + activationDuration - now) : Infinity;
    if (active && enabled) delay = Math.min(delay, 65);
    if (wheel) {
      const progress = enabled && active?.id === "bank" ? activationProgress : 0;
      wheel.rotation.z = Math.sin(Math.PI * progress) * -.36;
    }
    if (gesture && (head || hand || guide)) {
      // Short working gestures run at 15 Hz, with no frames drawn through the longer rest.
      const duration = guide ? 3200 : 2200;
      if (now >= nextGesture + duration) nextGesture = now + gesture.rest;
      const progress = enabled ? Math.max(0, (now - nextGesture) / duration) : 0;
      const weight = Math.sin(Math.PI * progress) ** 2;
      if (herbs) herbs.rotation.z = .115 * weight * Math.sin(progress * 3 * Math.PI);
      if (flag) flag.rotation.x = -.105 * weight * (.62 + .38 * Math.sin(progress * 2 * Math.PI));
      const acknowledges = active && enabled && active.id !== "exit" ? Math.sin(Math.PI * activationProgress) : 0;
      if (head) {
        head.rotation.x = weight * gesture.pitch - acknowledges * .05;
        head.rotation.y = Math.sin(progress * Math.PI * 2) * weight * gesture.yaw + acknowledges * .12;
      }
      if (hand) hand.rotation.x = weight * (gesture.hand + .07 * Math.sin(progress * 6 * Math.PI));
      const guideGreeting = progress > 0 || acknowledges > 0;
      if (guide && (guideGreeting || guidePosing)) {
        guide.update({ time: now / 1000, delta: .066, reduced: !guideGreeting, quality: "low", visible: () => true }, {
          activity: guideGreeting ? "greeting" : "idle",
          speed: 0, stride: 0, lookYaw: gesture.yaw * weight, lookPitch: -gesture.pitch * weight,
          emphasis: acknowledges, attention: weight, fishingPhase: "wait", phaseProgress: progress,
        });
        guidePosing = guideGreeting;
      }
      if (enabled) delay = Math.min(delay, progress ? 66 : Math.max(0, nextGesture - now));
    }
    if (Number.isFinite(delay)) timer = window.setTimeout(invalidate, delay);
  }

  function draw(now: number) {
    frame = 0;
    if (!canDraw()) return;
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 1.65);
    if (!nextWidth || !nextHeight) return;
    dirty = false;
    // A transparent canvas can be resized by CSS without rebuilding scene geometry.
    try {
      pose(now);
      if (width !== nextWidth || height !== nextHeight || pixelRatio !== nextRatio) {
        width = nextWidth;
        height = nextHeight;
        pixelRatio = nextRatio;
        renderer.setDrawingBufferSize(width, height, pixelRatio);
        const aspect = width / height;
        const halfHeight = Math.max(span.y, span.x / aspect) / 2;
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    } catch {
      lost = true;
      ready = false;
      stopTimer();
      cancelPress();
      callbacks.unavailable();
      return;
    }
    if (!ready) {
      ready = true;
      callbacks.ready();
    }
  }

  function invalidate() {
    dirty = true;
    schedule();
  }

  function pick(event: PointerEvent) {
    if (!ready || lost || disposed) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (!bounds.width || !bounds.height || x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return;
    pointer.set(2 * x / bounds.width - 1, 1 - 2 * y / bounds.height);
    ray.setFromCamera(pointer, camera);
    const [hit] = ray.intersectObjects(meshes, false);
    return hit && destinations.get(hit.object);
  }

  function hover(id: string | null) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? "pointer" : "";
    invalidate();
    callbacks.hover?.(id);
  }

  function activate(id: string) {
    if (!halos.has(id) || disposed) return;
    active = { id, at: performance.now() };
    invalidate();
  }

  function pointerDown(event: PointerEvent) {
    press = undefined;
    released = undefined;
    if (!event.isPrimary || event.button !== 0) return;
    const id = pick(event);
    if (id) press = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function moved(event: MouseEvent, start: NonNullable<typeof press>) {
    return Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8;
  }

  function pointerMove(event: PointerEvent) {
    if (press?.pointerId === event.pointerId && moved(event, press)) press = undefined;
    if (event.pointerType === "mouse" || event.pointerType === "pen") hover(pick(event) ?? null);
  }

  function pointerUp(event: PointerEvent) {
    if (!press || press.pointerId !== event.pointerId) return;
    const start = press;
    press = undefined;
    if (event.button === 0 && !moved(event, start) && pick(event) === start.id) {
      released = { ...start, x: event.clientX, y: event.clientY };
      activate(start.id);
    }
  }

  function click(event: MouseEvent) {
    const candidate = released;
    released = undefined;
    if (!candidate || !event.isTrusted || event.detail === 0 || event.button !== 0 || moved(event, candidate)) return;
    if (event instanceof PointerEvent && event.pointerId >= 0 && event.pointerId !== candidate.pointerId) return;
    // Keep the canvas in place until the gesture's compatibility click has been dispatched.
    callbacks.choose(candidate.id);
  }

  function pointerLeave() {
    press = undefined;
    hover(null);
  }

  function cancelPress() {
    released = undefined;
    pointerLeave();
  }

  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    ready = false;
    cancelAnimationFrame(frame);
    frame = 0;
    stopTimer();
    cancelPress();
    callbacks.unavailable();
  }

  function contextRestored() {
    lost = false;
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }

  const resize = new ResizeObserver(invalidate);
  function updateVisibility() {
    if (canDraw()) invalidate();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
      stopTimer();
    }
  }
  const visibility = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.intersectionRatio > 0);
    updateVisibility();
  }, { threshold: [0, .001] });
  resize.observe(canvas);
  visibility.observe(canvas);
  window.addEventListener("resize", invalidate);
  document.addEventListener("visibilitychange", updateVisibility);
  reduced.addEventListener("change", invalidate);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("click", click);
  canvas.addEventListener("pointercancel", cancelPress);
  canvas.addEventListener("pointerleave", pointerLeave);
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", contextRestored);
  invalidatePrint = invalidate;
  schedule();

  return {
    activate,
    setFocus(id) {
      if (disposed || focused === id) return;
      focused = id;
      invalidate();
    },
    setMotion(enabled) {
      if (disposed || motion === enabled) return;
      motion = enabled;
      nextGesture = performance.now() + 2200;
      invalidate();
    },
    dispose() {
      disposed = true;
      invalidatePrint = undefined;
      cancelAnimationFrame(frame);
      stopTimer();
      canvas.style.cursor = "";
      resize.disconnect();
      visibility.disconnect();
      window.removeEventListener("resize", invalidate);
      document.removeEventListener("visibilitychange", updateVisibility);
      reduced.removeEventListener("change", invalidate);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("pointercancel", cancelPress);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      disposeModel();
      key.shadow.dispose();
      renderer.dispose();
      if (!canvas.isConnected) renderer.forceContextLoss();
    },
  };
}
