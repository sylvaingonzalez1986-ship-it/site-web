import * as THREE from "three";
import type { KqTournamentPlayer } from "@/lib/kanab-quest-school-tournament";
import type { createQuizzShowCandidates } from "./quizzshow-candidates";
import { disposeInteriorArt } from "./interior-art";
import { makeQuizzShowSet, QUIZZSHOW_VIEWS, type QuizzShowMode } from "./quizzshow-set";
import { VILLAGE_LIGHT } from "./village-lighting";

export type QuizzShowDestination = "tournament" | "learn" | "ranking";
type Events = { choose: (destination: QuizzShowDestination) => void; ready: () => void; unavailable: () => void };

export function createQuizzShowRenderer(canvas: HTMLCanvasElement, mode: QuizzShowMode, events: Events) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = VILLAGE_LIGHT.exposure;
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
  const key = new THREE.DirectionalLight(VILLAGE_LIGHT.key.color, VILLAGE_LIGHT.key.power);
  key.position.fromArray(VILLAGE_LIGHT.key.position);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 60 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = .023;
  key.shadow.bias = -.00035;
  const rim = new THREE.DirectionalLight(VILLAGE_LIGHT.rim.color, VILLAGE_LIGHT.rim.power);
  rim.position.fromArray(VILLAGE_LIGHT.rim.position);
  scene.add(set, people, key, rim, new THREE.HemisphereLight(VILLAGE_LIGHT.sky, VILLAGE_LIGHT.ground, VILLAGE_LIGHT.hemi), new THREE.AmbientLight(0xffffff, VILLAGE_LIGHT.ambient));

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let candidates: ReturnType<typeof createQuizzShowCandidates> | undefined;
  let loadingCandidates = false;
  let seats: readonly (KqTournamentPlayer | null)[] = [];
  let width = 0, height = 0, frame = 0, lastDraw = 0;
  let motion = true, visible = true, lost = false, disposed = false;
  function schedule() {
    if (!frame && !disposed && !lost && visible && !document.hidden && width && height) frame = requestAnimationFrame(draw);
  }
  function draw(now: number) {
    frame = 0;
    const animate = motion && !reduced.matches && candidates?.moving;
    if (!animate || now - lastDraw >= 1000 / 24) {
      candidates?.pose(animate ? now / 1000 : undefined);
      renderer.render(scene, camera);
      lastDraw = now;
      events.ready();
    }
    if (animate) schedule();
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
    else { cancelAnimationFrame(frame); frame = 0; }
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
  function hover(event: PointerEvent) { canvas.style.cursor = pick(event) ? "pointer" : ""; }
  function choose(event: MouseEvent) { const destination = pick(event); if (destination) events.choose(destination); }
  if (mode === "hall") {
    canvas.addEventListener("pointermove", hover);
    canvas.addEventListener("click", choose);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    events.unavailable();
  }
  function restored() {
    lost = false;
    renderer.shadowMap.needsUpdate = true;
    schedule();
  }
  canvas.addEventListener("webglcontextlost", contextLost);
  canvas.addEventListener("webglcontextrestored", restored);
  reduced.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", schedule);
  resize();

  return {
    update(next: readonly (KqTournamentPlayer | null)[], nextMotion: boolean) {
      motion = nextMotion;
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
      cancelAnimationFrame(frame);
      size.disconnect();
      visibility.disconnect();
      reduced.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
      canvas.removeEventListener("pointermove", hover);
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
