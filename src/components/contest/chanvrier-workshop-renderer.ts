import * as THREE from "three";
import { villageApproachSpeed, villageWalkBlend } from "../placard/world/village-character-motion";
import { createGrowWorker, type ChanvrierExpression } from "../placard/kq-grow-worker-model";
import { VILLAGE_LIGHT } from "../placard/world/village-lighting";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { CHANVRIER_STUDIO_LIGHT, frameChanvrierStudio } from "./chanvrier-studio-light";

export type ChanvrierWorkshopView = "portrait" | "full" | "village";
export type ChanvrierWorkshopFrame = { view: ChanvrierWorkshopView; rotation: number; walking: boolean; zoom?: number; expression?: ChanvrierExpression };

export function createChanvrierWorkshopRenderer(canvas: HTMLCanvasElement, profile: ChanvrierAvatarProfile, onUnavailable: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor("#f4e8ce", 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight();
  const rim = new THREE.DirectionalLight();
  const ambient = new THREE.AmbientLight();
  const fill = new THREE.HemisphereLight();
  scene.add(ambient, fill, key, rim);

  function setLighting(inVillage: boolean) {
    const light = inVillage ? VILLAGE_LIGHT : CHANVRIER_STUDIO_LIGHT;
    renderer.toneMappingExposure = light.exposure;
    ambient.intensity = light.ambient;
    fill.intensity = light.hemi;
    fill.color.set(light.sky);
    fill.groundColor.set(light.ground);
    key.intensity = light.key.power;
    key.color.set(light.key.color);
    key.position.fromArray(light.key.position);
    rim.intensity = light.rim.power;
    rim.color.set(light.rim.color);
    rim.position.fromArray(light.rim.position);
  }
  setLighting(false);

  const character = createGrowWorker(profile, { tools: false });
  scene.add(character.object);
  const head = character.object.getObjectByName("chanvrier-head")!;
  const headBounds = new THREE.Box3();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 180);
  const target = new THREE.Vector3();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame: ChanvrierWorkshopFrame = { view: "portrait", rotation: 0, walking: false };
  let width = 0;
  let height = 0;
  let elapsed = 0;
  let distance = 0;
  let speed = 0;
  let walk = 0;
  let lastTime: number | undefined;
  let request = 0;
  let contextLost = false;
  let disposed = false;

  function schedule() {
    if (request || contextLost || disposed || !width || !height || document.hidden) return;
    request = requestAnimationFrame(render);
  }

  function render(now: number) {
    request = 0;
    const walking = frame.walking;
    const animate = walking || !reducedMotion.matches;
    const delta = animate && lastTime !== undefined ? Math.min(.05, (now - lastTime) / 1000) : 0;
    elapsed += delta;
    speed = animate ? villageApproachSpeed(speed, walking ? 1.48 : 0, delta, 4, 6) : 0;
    distance += speed * delta;
    walk = animate ? villageWalkBlend(walk, speed, delta) : 0;
    lastTime = animate ? now : undefined;
    character.object.rotation.y = frame.rotation;
    character.pose(distance, walk, null, 0, null, undefined, animate ? elapsed : undefined);
    renderer.render(scene, camera);
    if (animate) schedule();
  }

  function alignCamera() {
    if (!width || !height) return;
    if (frame.view === "village") {
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      target.set(0, .8, 0);
      camera.position.set(34, 33, 36).add(target);
      camera.zoom = THREE.MathUtils.clamp(Math.min(window.innerWidth / 38, window.innerHeight / 30), 4, 110);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    } else {
      character.object.rotation.y = 0;
      character.object.updateMatrixWorld(true);
      headBounds.setFromObject(head);
      character.object.rotation.y = frame.rotation;
      frameChanvrierStudio(camera, headBounds, frame.view, width, height);
      camera.zoom = frame.zoom ?? 1;
      camera.updateProjectionMatrix();
    }
  }

  const lost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(request);
    onUnavailable();
  };
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(request);
      request = 0;
      lastTime = undefined;
    } else schedule();
  };
  canvas.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", visibility);
  reducedMotion.addEventListener("change", schedule);

  return {
    resize(nextWidth: number, nextHeight: number) {
      width = nextWidth;
      height = nextHeight;
      if (width && height) renderer.setSize(width, height, false);
      alignCamera();
      schedule();
    },
    updateAppearance(next: ChanvrierAvatarProfile) {
      character.updateAppearance(next);
      alignCamera();
      schedule();
    },
    updateFrame(next: ChanvrierWorkshopFrame) {
      const framingChanged = next.view !== frame.view || next.zoom !== frame.zoom;
      const inVillage = next.view === "village";
      if (inVillage !== (frame.view === "village")) setLighting(inVillage);
      if (next.expression !== frame.expression) character.setExpression(next.expression ?? "neutral");
      frame = next;
      if (framingChanged) alignCamera();
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(request);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", lost);
      reducedMotion.removeEventListener("change", schedule);
      character.dispose();
      renderer.dispose();
      if (!contextLost) renderer.forceContextLoss();
    },
  };
}
