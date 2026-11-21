import * as THREE from "three";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqStaffTrimMode } from "@/lib/kanab-quest-staff-types";
import { createGrowWorker } from "./kq-grow-worker-model";
import { addTrimRoom, createTrimMachine, createTrimScissors, createTrimTray, trimTableHeight } from "./KqTrimRoomArt";
import { characterMaterial } from "./world/village-character-art";

export type KqTrimRoomActor = {
  id: string;
  mode?: KqStaffTrimMode;
  profile?: ChanvrierAvatarProfile | null;
  working: boolean;
};

type Worker = { model: ReturnType<typeof createGrowWorker>; profile: ChanvrierAvatarProfile; hand?: THREE.Object3D };

const frameCorners = [
  [-2.27, -.22, -1.28], [2.27, -.22, -1.28], [-2.27, -.22, 1.19], [2.27, -.22, 1.19],
  [-2.27, 1.83, -1.28], [2.27, 1.83, -1.28], [-2.27, 1.83, .16],
] as const;

export function createKqTrimRoomRenderer(canvas: HTMLCanvasElement, onContextLost: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  const world = new THREE.Scene();
  const room = new THREE.Group(), material = characterMaterial();
  world.add(room, new THREE.HemisphereLight("#fff5de", "#b79877", 2.25));
  const sun = new THREE.DirectionalLight("#fff1d4", 2.15);
  sun.position.set(-3, 7, 4);
  world.add(sun);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 32);
  camera.position.set(8, 8, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const bounds = new THREE.Box3().setFromPoints(frameCorners.map(point => new THREE.Vector3(...point).applyMatrix4(camera.matrixWorldInverse)));
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  addTrimRoom(room, material);

  const machine = createTrimMachine(room, material);
  const stations = Array.from({ length: 3 }, () => ({
    tray: createTrimTray(room, material),
    scissors: createTrimScissors(room, material),
  }));
  const workers = new Map<string, Worker>();
  const handPosition = new THREE.Vector3();
  let actors: readonly KqTrimRoomActor[] = [];
  let frame = 0, previous = 0, elapsed = 0;
  let machineWorking = false;
  let machineAngle = 0;
  let width = 0, height = 0, pixelRatio = 0;
  let disposed = false, lost = false;

  function positionStations(time: number, step: number) {
    actors.forEach((actor, index) => {
      const { tray, scissors } = stations[index];
      const x = (index - (actors.length - 1) / 2) * 1.31;
      const worker = workers.get(actor.id);
      const manual = actor.mode !== "machine";
      const cycle = time * (manual ? 4.9 : 2.35) + index * .75;
      const snip = (.5 + .5 * Math.cos(cycle)) ** 3;
      if (worker) {
        worker.model.object.position.x = x;
        worker.model.pose(0, 0, actor.working ? "harvest" : null, .49 + Math.sin(cycle) * .093, 2);
      }
      if (manual) {
        scissors.object.position.set(x + .16, trimTableHeight + .036, .29);
        scissors.object.rotation.y = -.58;
        if (actor.working && worker?.hand) {
          worker.hand.getWorldPosition(handPosition);
          scissors.object.position.set(handPosition.x - .03, Math.max(trimTableHeight + .054, handPosition.y + .006), handPosition.z + .158);
          scissors.object.rotation.y = -.36 + .078 * Math.sin(cycle);
        }
        scissors.open(actor.working ? .12 + snip * .83 : .57);
      }
      tray.position.set(x - .39, trimTableHeight, .53);
    });
    if (machineWorking) machineAngle += step * 2.65;
    machine.rotor.rotation.y = machineAngle;
  }

  function resize() {
    if (lost || disposed) return;
    const nextWidth = canvas.clientWidth, nextHeight = canvas.clientHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height && nextRatio === pixelRatio)) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = Math.max(size.y, size.x / aspect) * .53;
    camera.left = center.x - halfHeight * aspect;
    camera.right = center.x + halfHeight * aspect;
    camera.top = center.y + halfHeight;
    camera.bottom = center.y - halfHeight;
    camera.updateProjectionMatrix();
    renderer.render(world, camera);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }

  function tick(now: number) {
    if (lost || disposed) return;
    frame = requestAnimationFrame(tick);
    const delta = now - previous;
    if (previous && delta < 32) return;
    const step = previous ? Math.min(delta / 1000, .09) : 0;
    previous = now;
    elapsed += step;
    positionStations(elapsed, step);
    renderer.render(world, camera);
  }

  function handleContextLost(event: Event) {
    event.preventDefault();
    lost = true;
    stopFrame();
    onContextLost();
  }

  canvas.addEventListener("webglcontextlost", handleContextLost);

  function removeWorker(worker: Worker) {
    worker.model.object.removeFromParent();
    worker.model.dispose();
  }

  return {
    update(nextActors: readonly KqTrimRoomActor[], motion: boolean) {
      if (lost || disposed) return;
      const changed = actors.length !== nextActors.length || nextActors.some((actor, index) => {
        const before = actors[index];
        return actor.id !== before.id || actor.mode !== before.mode || actor.profile !== before.profile || actor.working !== before.working;
      });
      if (changed) {
        actors = nextActors;
        for (const [id, worker] of workers) {
          if (actors.some(actor => actor.id === id && actor.profile)) continue;
          removeWorker(worker);
          workers.delete(id);
        }
        actors.forEach(({ id, profile }, index) => {
          if (!profile) return;
          const worker = workers.get(id);
          if (!worker) {
            const model = createGrowWorker(profile, { tools: false });
            model.object.position.z = -.423;
            world.add(model.object);
            workers.set(id, { model, profile, hand: model.object.getObjectByName("working-hand") });
          } else if (worker.profile !== profile) {
            worker.model.updateAppearance(profile);
            worker.profile = profile;
          }
          stations[index].tray.visible = true;
        });
        stations.forEach(({ tray, scissors }, index) => {
          tray.visible = index < actors.length;
          scissors.object.visible = index < actors.length && actors[index].mode !== "machine";
        });
        const machineIndex = actors.findIndex(actor => actor.mode === "machine");
        machine.object.visible = machineIndex !== -1;
        machine.object.position.set((machineIndex - (actors.length - 1) / 2) * 1.31 + .29, trimTableHeight, .375);
        machineWorking = actors.some(actor => actor.mode === "machine" && actor.working);
        positionStations(elapsed, 0);
        resize();
        renderer.render(world, camera);
      }
      const running = motion && actors.some(actor => actor.working);
      if (running && !frame) frame = requestAnimationFrame(tick);
      if (!running && frame) stopFrame();
    },
    dispose() {
      disposed = true;
      stopFrame();
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      for (const worker of workers.values()) removeWorker(worker);
      room.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
      material.dispose();
      renderer.dispose();
      if (!lost) renderer.forceContextLoss();
    },
  };
}
