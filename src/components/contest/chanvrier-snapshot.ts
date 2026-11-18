import * as THREE from "three";
import { getChanvrierAppearance, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createGrowWorker } from "../placard/kq-grow-worker-model";
import type { KqGrowRoomEvent } from "../placard/KqGrowRoomModel";
import { paintChanvrierMesh } from "./chanvrier-paper-render";
import { VILLAGE_LIGHT } from "../placard/world/village-lighting";
import { CHANVRIER_STUDIO_CAMERA_POSITION, CHANVRIER_STUDIO_LIGHT } from "./chanvrier-studio-light";

type View = "full" | "portrait";
export type ChanvrierStampPose = { distance: number; walking: number; gesture: KqGrowRoomEvent["gesture"] | null; phase: number; stage: number | null };
type Snapshot = { profile: ChanvrierAvatarProfile; view: View; width: number; pose?: ChanvrierStampPose };

function createStudio(profile: ChanvrierAvatarProfile, tools: boolean) {
  const light = tools ? VILLAGE_LIGHT : CHANVRIER_STUDIO_LIGHT;
  const scene = new THREE.Scene();
  const model = createGrowWorker(profile, { tools });
  scene.add(model.object, new THREE.AmbientLight(0xffffff, light.ambient), new THREE.HemisphereLight(light.sky, light.ground, light.hemi));
  const sun = new THREE.DirectionalLight(light.key.color, light.key.power);
  sun.position.fromArray(light.key.position);
  const rim = new THREE.DirectionalLight(light.rim.color, light.rim.power);
  rim.position.fromArray(light.rim.position);
  scene.add(sun, rim);
  return { scene, model, light };
}

let studio: ReturnType<typeof createStudio> | undefined;
let withTools = false;
let renderer: THREE.WebGLRenderer | undefined;
let software = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 20);
const bounds = new THREE.Box3(), centre = new THREE.Vector3();
const cache = new Map<string, HTMLCanvasElement>();
let pixels = 0;
const pixelBudget = 2_100_000;

function releaseStudio() {
  studio?.model.dispose();
  studio = undefined;
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = undefined;
  software = false;
}

function render({ profile, view, width, pose }: Snapshot) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(releaseStudio, 20_000);
  if (!renderer && !software) {
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setClearColor(0, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } catch { software = true; }
  }
  if (!studio || withTools !== !!pose) {
    studio?.model.dispose();
    withTools = !!pose;
    studio = createStudio(profile, withTools);
  } else studio.model.updateAppearance(profile);
  const { model, scene } = studio;
  model.pose(pose?.distance ?? 0, pose?.walking ?? 0, pose?.gesture ?? null, pose?.phase ?? 0, pose?.stage ?? null);
  const height = view === "full" ? Math.round(width * 1.48) : width;
  const head = model.object.getObjectByName("chanvrier-head")!;
  model.object.updateMatrixWorld(true);
  bounds.setFromObject(head);
  bounds.getCenter(centre);
  const headSize = bounds.getSize(new THREE.Vector3());
  const span = view === "portrait" ? Math.max(headSize.x * 1.28, headSize.y * 1.35, .68) : bounds.max.y + .16;
  if (view === "full") centre.set(0, span * .48, 0);
  else centre.y -= span * .055;
  camera.top = span / 2;
  camera.bottom = -camera.top;
  camera.right = camera.top * width / height;
  camera.left = -camera.right;
  const offset = pose ? new THREE.Vector3(-3.1, .32, 4.6) : new THREE.Vector3(...CHANVRIER_STUDIO_CAMERA_POSITION);
  camera.position.copy(centre).add(offset);
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
  const copy = document.createElement("canvas");
  copy.width = width;
  copy.height = height;
  if (renderer && !renderer.getContext().isContextLost()) {
    renderer.toneMappingExposure = studio.light.exposure;
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    copy.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
  } else {
    camera.updateMatrixWorld();
    paintChanvrierMesh(copy, model.object, camera, studio.light);
  }
  return copy;
}

type Job = { snapshot: Snapshot; signal: AbortSignal; resolve: (value: HTMLCanvasElement) => void; reject: (reason?: unknown) => void };
const jobs: Job[] = [];
let scheduled = false;
function advance() {
  scheduled = false;
  while (jobs.length) {
    const job = jobs.shift()!;
    if (job.signal.aborted) { job.reject(job.signal.reason); continue; }
    try {
      const { profile, view, width, pose } = job.snapshot;
      const key = JSON.stringify([profile.gender, profile.clothing, profile.skin, getChanvrierAppearance(profile), view, width, pose]);
      let stamp = cache.get(key);
      if (stamp) cache.delete(key);
      else {
        stamp = render(job.snapshot);
        pixels += stamp.width * stamp.height;
      }
      cache.set(key, stamp);
      while (pixels > pixelBudget && cache.size > 1) {
        const oldest = cache.entries().next().value!;
        pixels -= oldest[1].width * oldest[1].height;
        cache.delete(oldest[0]);
      }
      job.resolve(stamp);
    } catch (error) { job.reject(error); }
    break;
  }
  if (jobs.length) { scheduled = true; requestAnimationFrame(advance); }
}

/** All rankings and visible option cards share one context and a bounded LRU of finished images. */
export function renderChanvrierSnapshot(snapshot: Snapshot, signal: AbortSignal) {
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    jobs.push({ snapshot, signal, resolve, reject });
    if (!scheduled) { scheduled = true; requestAnimationFrame(advance); }
  });
}
