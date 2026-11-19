import * as THREE from "three";
import type { KqTournamentPlayer } from "@/lib/kanab-quest-school-tournament";
import type { createQuizzShowCandidates } from "./quizzshow-candidates";
import { disposeInteriorArt } from "./interior-art";
import { makeQuizzShowSet, QUIZZSHOW_VIEWS, type QuizzShowMode } from "./quizzshow-set";

export type QuizzShowDestination = "tournament" | "learn" | "ranking";
type Events = { choose: (destination: QuizzShowDestination) => void; ready: () => void; unavailable: () => void };

export function createQuizzShowRenderer(canvas: HTMLCanvasElement, mode: QuizzShowMode, events: Events) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  const set = makeQuizzShowSet(mode);
  const signals = mode === "tournament" ? Array.from({ length: 4 }, (_, i) => set.getObjectByName(`reponse-${i + 1}`)) : [];
  const people = new THREE.Group();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const view = QUIZZSHOW_VIEWS[mode];
  const target = new THREE.Vector3().fromArray(view.target);
  camera.position.fromArray(view.direction).normalize().multiplyScalar(32).add(target);
  camera.lookAt(target);
  const key = new THREE.DirectionalLight("#ffe1ab", 2.05);
  key.position.set(-3,9,8);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 60 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = .023;
  key.shadow.bias = -.00035;
  const rim = new THREE.DirectionalLight("#c3e1ee", 1.04);
  rim.position.set(6,5,-4);
  scene.add(set, people, key, rim, new THREE.HemisphereLight("#e1e9ea", "#ab8364", 1.25));
  const stage = mode === "hall" || mode === "tournament";
  const globe = set.getObjectByName("globe-de-lecture");
  if (stage) {
    // The two inner lamps of the overhead batten throw overlapping pools onto the lecterns.
    for (const [x, aimX] of [[-4.12,-4.7],[-1.38,-1.0]]) {
      const light = new THREE.SpotLight("#ffdfa0", 21, 5.8, .69, .72, 2);
      light.position.set(x,2.83,-1.21); light.target.position.set(aimX,.45,.52);
      set.add(light,light.target);
    }
  }
  if (globe) {
    const readingLamp = new THREE.PointLight("#ffd594", 2.1, 2.2);
    readingLamp.position.set(5.03,1.16,.27);
    set.add(readingLamp);
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let candidates: ReturnType<typeof createQuizzShowCandidates> | undefined;
  let loadingCandidates = false;
  let seats: readonly (KqTournamentPlayer | null)[] = [];
  let width = 0, height = 0, frame = 0, lastDraw = 0;
  let motion = true, visible = true, lost = false, disposed = false;
  let idleTimer = 0, poseStart = 0, focused: QuizzShowDestination | null = null;
  function stop() {
    cancelAnimationFrame(frame); frame = 0;
    clearTimeout(idleTimer); idleTimer = 0;
  }
  function schedule() {
    if (!frame && !disposed && !lost && visible && !document.hidden && width && height) frame = requestAnimationFrame(draw);
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || lost || !visible || document.hidden) return;
    const moving = motion && !reduced.matches;
    const progress = poseStart ? Math.min(1,(now - poseStart) / 2400) : 1;
    const turning = !!globe && moving && progress < 1;
    const animate = moving && (candidates?.moving || turning);
    if (!animate || now - lastDraw >= 1000 / 24) {
      candidates?.pose(animate ? now / 1000 : undefined);
      if (globe) globe.rotation.y = turning ? .69 * Math.sin(progress * Math.PI) ** 2 : 0;
      renderer.render(scene, camera);
      lastDraw = now;
      events.ready();
    }
    if (animate) schedule();
    else if (globe && moving && !idleTimer) {
      idleTimer = window.setTimeout(() => { idleTimer = 0; poseStart = performance.now(); schedule(); }, 5500);
    }
  }
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const ratio = width / height;
    const span = Math.max(view.height, view.width / ratio);
    camera.left = -span * ratio / 2;
    camera.right = -camera.left;
    camera.top = span / 2;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    schedule();
  }
  const size = new ResizeObserver(resize);
  size.observe(canvas);
  const visibility = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible) schedule();
    else stop();
  });
  visibility.observe(canvas);

  const ray = new THREE.Raycaster();
  function pick(event: PointerEvent | MouseEvent): QuizzShowDestination | null {
    const bounds = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2), camera);
    for (const hit of ray.intersectObject(set, true)) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const destination = node.userData.destination;
        if (destination === "tournament" || destination === "learn" || destination === "ranking") return destination;
        node = node.parent;
      }
    }
    return null;
  }
  function focus(id: QuizzShowDestination | null) {
    if (focused === id) return;
    focused = id;
    // Each destination owns its material so keyboard and pointer illuminate the same prop.
    for (const node of set.children) {
      if (!(node instanceof THREE.Mesh) || !node.userData.destination) continue;
      const material = node.material as THREE.MeshStandardMaterial;
      if (material.userData.highlightable) material.emissive.setHex(node.userData.destination === id ? 0x49300e : 0);
    }
    if (id === "learn") { clearTimeout(idleTimer); idleTimer = 0; poseStart = performance.now(); }
    schedule();
  }
  function hover(event: PointerEvent) { const id = pick(event); canvas.style.cursor = id ? "pointer" : ""; focus(id); }
  function leave() { focus(null); canvas.style.cursor = ""; }
  function choose(event: MouseEvent) { const destination = pick(event); if (destination) events.choose(destination); }
  if (mode === "hall") {
    canvas.addEventListener("pointermove", hover);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("click", choose);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    stop();
    events.unavailable();
  }
  function restored() {
    lost = false;
    renderer.shadowMap.needsUpdate = true;
    schedule();
  }
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", restored);
  function resume() { stop(); poseStart = 0; schedule(); }
  reduced.addEventListener("change", resume);
  document.addEventListener("visibilitychange", resume);
  resize();

  return {
    focus,
    update(next: readonly (KqTournamentPlayer | null)[], nextMotion: boolean) {
      motion = nextMotion;
      if (!motion) { stop(); poseStart = 0; }
      seats = next;
      signals.forEach((light, i) => { if (light) light.visible = Boolean(seats[i]?.answered); });
      if (candidates) candidates.update(seats);
      else if (!loadingCandidates && seats.some(Boolean)) {
        loadingCandidates = true;
        void import("./quizzshow-candidates").then(module => {
          if (disposed) return;
          candidates = module.createQuizzShowCandidates(people);
          candidates.update(seats);
          schedule();
        }).catch(() => { loadingCandidates = false; });
      }
      schedule();
    },
    dispose() {
      disposed = true;
      stop();
      size.disconnect();
      visibility.disconnect();
      reduced.removeEventListener("change", resume);
      document.removeEventListener("visibilitychange", resume);
      canvas.removeEventListener("pointermove", hover);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("click", choose);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", restored);
      candidates?.dispose();
      disposeInteriorArt(set);
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
