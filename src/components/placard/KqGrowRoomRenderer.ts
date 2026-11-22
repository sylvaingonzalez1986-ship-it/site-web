import * as THREE from "three";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import type { KqGrowRoomEvent, KqGrowRoomZone } from "./KqGrowRoomModel";
import { createGrowRoomActor } from "./KqGrowRoomActorWorld";
import { createRoomResources } from "./KqGrowRoomGeometry";
import { makeGrowBuilding, makeGrowStation, releaseStation } from "./KqGrowRoomWorldArt";
import { CAMERA_HEIGHT, cameraScale, type GrowCamera } from "./KqGrowRoomProjection";
export type WorldInput = {
  layout: WarehouseSpatialLayout;
  zones: readonly KqGrowRoomZone[];
  selected: string | null;
  actorTargetId: string | null;
  inspectAtRest: boolean;
  event?: KqGrowRoomEvent | null;
  profile?: ChanvrierAvatarProfile | null;
  motion: boolean;
  reducedMotion: boolean;
  visible: boolean;
  camera: GrowCamera;
  width: number;
  height: number;
};
export type WorldPose = ReturnType<ReturnType<typeof createGrowRoomActor>["getPose"]>;
const direction = new THREE.Vector3(12, 12, 16).normalize();
type Station = {
  group: THREE.Group;
  key: string;
  box: THREE.Box3;
  ghost: boolean;
  rotor?: { mesh: THREE.InstancedMesh; rests: THREE.Matrix4[] };
  serviceFaces: THREE.Object3D[] | null;
  lastProbe?: {
    x: number;
    z: number;
    covered: boolean;
  };
};
export function createRoomRenderer(canvas: HTMLCanvasElement, onPose: (pose: WorldPose) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor("#eee3cd", 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 230);
  scene.add(new THREE.HemisphereLight("#deedf5", "#81908b", 1.26));
  const key = new THREE.DirectionalLight("#fff0ce", 2.23);
  key.position.set(-6, 13, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -.00045;
  key.shadow.normalBias = .018;
  key.shadow.radius = 2.5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight("#c8e6ee", 1.00);
  fill.position.set(4, 5, 8);
  scene.add(fill);
  const res = createRoomResources(), stations = new Map<string, Station>(), ghosts = new Map<THREE.Material, THREE.Material>();
  let building: THREE.Group | null = null, lastFloor = "", lastSignature = "", frame = 0, disposed = false, latest: WorldInput | null = null;
  let prevWidth = 0, prevHeight = 0;
  let ventTimer = 0, ventPhase = 0, lastVentDraw = -Infinity;
  const turn = new THREE.Matrix4(), bladeMatrix = new THREE.Matrix4();
  const actorWorld = new THREE.Group();
  scene.add(actorWorld);
  const actor = createGrowRoomActor(actorWorld, requestFrame);
  const ray = new THREE.Ray(), aim = new THREE.Vector3(), intersection = new THREE.Vector3(), pointerRay = new THREE.Raycaster();
  const sight = new THREE.Raycaster(), sightHits: THREE.Intersection[] = [];
  sight.near = .16;
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#ffcf58", transparent: true, opacity: .94, depthTest: false });
  const marker = new THREE.Group();
  marker.renderOrder = 5;
  scene.add(marker);
  const rail = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 4; i++) {
    const edge = new THREE.Mesh(rail, ringMaterial);
    edge.renderOrder = 5;
    marker.add(edge);
  }
  function requestFrame() { if (!frame && !disposed && latest?.visible)
    frame = requestAnimationFrame(render); }
  const translucent = (m: THREE.Material) => {
    let copy = ghosts.get(m);
    if (!copy) {
      copy = m.clone();
      copy.transparent = true;
      copy.opacity = .28;
      copy.depthWrite = false;
      ghosts.set(m, copy);
    }
    return copy;
  };
  function fade(s: Station, next: boolean) {
    if (s.ghost === next)
      return;
    s.ghost = next;
    for (const child of s.group.children)
      if (child instanceof THREE.Mesh) {
        const mat = (child.userData.solidMaterial ??= child.material) as THREE.Material;
        if (mat !== res.materials.shadow)
          child.material = next ? translucent(mat) : mat;
      }
  }
  function obstruction(box: THREE.Box3, x: number, y: number, z: number) {
    ray.set(aim.set(x, y, z), direction);
    const hit = ray.intersectBox(box, intersection);
    return !!hit && hit.distanceTo(aim) > .17;
  }
  function serviceCoversWorker(s: Station, x: number, z: number) {
    if (!s.serviceFaces)
      return true;
    if (s.lastProbe && Math.hypot(s.lastProbe.x - x, s.lastProbe.z - z) < .10)
      return s.lastProbe.covered;
    // Open racks and nets have large empty spaces inside their bounds. Only fade
    // the selected fixture if solid pieces actually cover two points on the figure.
    let covered = 0;
    for (const [side, y] of [[0, 1.54], [-.12, 1.03], [.12, 1.03]]) {
      sight.set(aim.set(x + .8 * side, y, z - .6 * side), direction);
      sightHits.length = 0;
      sight.intersectObjects(s.serviceFaces, false, sightHits);
      if (sightHits.length && ++covered === 2)
        break;
    }
    s.lastProbe = { x, z, covered: covered >= 2 };
    return s.lastProbe.covered;
  }
  function render(time: number) {
    frame = 0;
    if (!latest || !latest.visible || disposed)
      return;
    const moving = actor.tick(time), pose = actor.getPose();
    onPose(pose);
    const focus = latest.selected ? stations.get(latest.selected) : undefined;
    const cx = focus?.group.position.x ?? 0, cz = focus?.group.position.z ?? 0;
    for (const s of stations.values()) {
      const hideActor = pose.visible && obstruction(s.box, pose.x, .99, pose.z) && (s !== focus || serviceCoversWorker(s, pose.x, pose.z));
      fade(s, hideActor || Boolean(focus && s !== focus && obstruction(s.box, cx, .44, cz)));
    }
    // Ventilation cycles briefly. Between cycles the camera and the entire room sleep.
    const rotors = latest.motion && Array.from(stations.values()).some(station => station.rotor);
    if (rotors && time >= lastVentDraw + 90) {
      const t = Math.max(0, (time-ventPhase)/1450);
      if (t < 1) {
        const phase = 2*Math.PI*(t-Math.sin(t*2*Math.PI)/(2*Math.PI));
        turn.makeRotationY(phase);
        for (const s of stations.values()) if (s.rotor) {
          s.rotor.rests.forEach((rest,i) => s.rotor!.mesh.setMatrixAt(i,bladeMatrix.multiplyMatrices(rest,turn)));
          s.rotor.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      lastVentDraw=time;
    }
    renderer.render(scene, camera);
    if (moving)
      requestFrame();
    if (rotors && !ventTimer) {
      const resting = time-ventPhase >= 1450;
      ventTimer = window.setTimeout(() => {
        ventTimer=0;
        if (resting) ventPhase=performance.now();
        requestFrame();
      }, resting ? 4700 : 110);
    }
  }
  function update(input: WorldInput) {
    const previous = latest;
    latest = input;
    const { layout, width, height } = input;
    if (!width || !height)
      return;
    if (width !== prevWidth || height !== prevHeight) {
      renderer.setSize(width, height, false);
      prevWidth = width;
      prevHeight = height;
    }
    const scale = cameraScale(layout, width, height, input.camera.zoom);
    camera.left = -width / (2 * scale);
    camera.right = -camera.left;
    camera.top = height / (2 * scale);
    camera.bottom = -camera.top;
    camera.position.copy(direction).multiplyScalar(85).add(new THREE.Vector3(input.camera.x, CAMERA_HEIGHT, input.camera.z));
    camera.lookAt(input.camera.x, CAMERA_HEIGHT, input.camera.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const floorKey = layout.width + "/" + layout.depth;
    if (lastFloor !== floorKey) {
      if (building)
        releaseStation(building);
      building = makeGrowBuilding(res, layout);
      scene.add(building);
      lastFloor = floorKey;
      const reach = Math.hypot(layout.width + 3, layout.depth + 3) * .58;
      Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, far: reach * 4 + 40 });
      key.position.set(-reach * .61, reach * 1.28, -reach * .54);
      key.shadow.camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate = true;
    }
    // Navigating and playing an animation never rebuild static meshes.
    const signature = lastSignature && previous?.layout === layout && previous.zones === input.zones ? lastSignature :
      JSON.stringify([layout.items, input.zones.map(z => [z.id, z.status, z.stageIndex, z.variety, z.lightingCode, z.airCode, z.powered, z.optionCodes, z.supportCode, z.contentState, z.deviceCode, !!z.attention, z.effects?.length])]);
    if (signature !== lastSignature) {
      const zoneMap = new Map(input.zones.map(z => [z.id, z])), active = new Set<string>();
      const low = layout.items.length > 24 || layout.width * layout.depth > 200;
      const budget = Math.max(1, Math.min(low ? 8 : 24, Math.floor(160 / Math.max(1, layout.items.filter(z => z.kind === "culture").length))));
      for (const [zoneIndex, item] of layout.items.entries()) {
        active.add(item.id);
        const zone = zoneMap.get(item.id);
        const key = JSON.stringify([item, zoneIndex, zone?.status, zone?.stageIndex, zone?.variety, zone?.lightingCode, zone?.airCode, zone?.powered, zone?.supportCode, zone?.optionCodes, zone?.contentState, !!zone?.attention, zone?.effects?.length, budget, low]);
        const old = stations.get(item.id);
        if (old?.key === key)
          continue;
        if (old)
          releaseStation(old.group);
        const group = makeGrowStation(res, item, zone, budget, low, zoneIndex);
        scene.add(group);
        const serviceFaces = item.kind === "drying" || item.kind === "storage" ? group.children.filter(child => child instanceof THREE.Mesh &&
          child.material !== res.materials.net && child.material !== res.materials.jar && child.material !== res.materials.shadow) : null;
        const blades=group.getObjectByName("rotor-running");
        const rotor = blades instanceof THREE.InstancedMesh ? {mesh:blades,rests:Array.from({length:blades.count},(_,i)=>{
          const rest=new THREE.Matrix4(); blades.getMatrixAt(i,rest); return rest;
        })} : undefined;
        stations.set(item.id, { group, key, box: new THREE.Box3().setFromObject(group), ghost: false, serviceFaces, rotor });
      }
      for (const [id, station] of stations)
        if (!active.has(id)) {
          releaseStation(station.group);
          stations.delete(id);
        }
      lastSignature = signature;
      renderer.shadowMap.needsUpdate = true;
    }
    const target = layout.items.find(z => z.id === input.selected);
    marker.visible = !!target;
    if (target) {
      marker.position.set(target.x, .035, target.z);
      const w = target.width + .025, d = target.depth + .025;
      marker.children.forEach((edge, i) => { const horizontal = i < 2; edge.scale.set(horizontal ? w : .042, .012, horizontal ? .042 : d); edge.position.set(horizontal ? 0 : (i === 2 ? -w : w) / 2, 0, horizontal ? (i === 0 ? -d : d) / 2 : 0); });
    }
    const activeZone = input.zones.find(z => z.id === input.actorTargetId);
    actor.update({ layout, targetId: input.actorTargetId, stage: activeZone?.stageIndex ?? null, inspectAtRest: input.inspectAtRest,
      event: input.event, profile: input.profile, motion: input.motion, visible: input.visible, reducedMotion: input.reducedMotion });
    if (!input.visible || !input.motion) { clearTimeout(ventTimer); ventTimer=0; }
    else if (!previous?.visible || !previous.motion) ventPhase=performance.now();
    if (!input.visible && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    requestFrame();
  }
  function pick(nx: number, ny: number) {
    pointerRay.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const results = pointerRay.intersectObjects(Array.from(stations.values()).filter(s => !s.ghost).map(s => s.group), true);
    for (const hit of results) {
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.stationId)
        object = object.parent;
      const id = object?.userData.stationId;
      if (id && latest?.zones.some(z => z.id === id))
        return String(id);
    }
    return null;
  }
  function dispose() { disposed = true; clearTimeout(ventTimer); cancelAnimationFrame(frame); actor.dispose(); if (building)
    releaseStation(building); stations.forEach(s => releaseStation(s.group)); ghosts.forEach(m => m.dispose()); rail.dispose(); ringMaterial.dispose(); key.shadow.dispose(); res.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  return { update, pick, dispose };
}
