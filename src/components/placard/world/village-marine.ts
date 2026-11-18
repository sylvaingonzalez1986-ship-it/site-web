import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paintingToGround } from "./village-layout";
import { VILLAGE_COAST, VILLAGE_RIVER } from "./village-terrain";
import type { VillageLifeController } from "./village-life-types";

type Point = readonly [number, number];
type XYZ = readonly [number, number, number];
const SEA_LEVEL = -0.32;
const RIVER_LEVEL = 0.018;
const TAU = Math.PI * 2;
const C = { teal: "#087f7c", wood: "#c69658", darkWood: "#825d3c", cream: "#fff0ca", ink: "#294942", gold: "#dca642", stone: "#b3b29a", kelp: "#427c64", fish: "#acd1bd" };

/** These three directional waves are also used verbatim by the water shader. */
export function sampleVillageWaves(x: number, z: number, time: number, river = false) {
  const scale = river ? 0.16 : 1;
  const a = x * 0.63 + z * 0.31 - time * 0.72;
  const b = x * -0.33 + z * 0.91 - time * 1.09;
  const c = x * 1.71 + z * 0.64 - time * 1.62;
  return {
    height: (river ? RIVER_LEVEL : SEA_LEVEL) + scale * (0.025 * Math.sin(a) + 0.012 * Math.sin(b) + 0.005 * Math.sin(c)),
    dx: scale * (0.025 * 0.63 * Math.cos(a) - 0.012 * 0.33 * Math.cos(b) + 0.005 * 1.71 * Math.cos(c)),
    dz: scale * (0.025 * 0.31 * Math.cos(a) + 0.012 * 0.91 * Math.cos(b) + 0.005 * 0.64 * Math.cos(c)),
  };
}

// Keep clear of the island, the lighthouse's entire rock ring, and the second bank.
// Closed centripetal interpolation avoids overshoot at the four fishing stations.
const route = new THREE.CatmullRomCurve3([
  [-12, -15], [-8, -24], [-1, -27], [8, -23], [20, -14], [29, -6], [33, 5], [30, 17],
  [17, 25], [5, 30], [-8, 26], [-21, 14], [-26, 1], [-24, -9], [-19, -14],
].map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
route.arcLengthDivisions = 640;
const routeLength = route.getLength();
export const VILLAGE_FISHING_CYCLE_SECONDS = 376;
/** Begin approaching the visible north-west station; the first cast is after 10 s. */
export const VILLAGE_MARINE_PRESENTATION_OFFSET = 54;
export const VILLAGE_FISHING_ROUTE_LENGTH = routeLength;
export type VillageFishingPhase = "depart" | "cruise" | "approach" | "lower" | "fishing" | "haul" | "stow";

/** Absolute clock sampling makes pause/resume and low-frame-rate motion deterministic. */
export function sampleFishingCycle(time: number) {
  const lapTime = ((time % VILLAGE_FISHING_CYCLE_SECONDS) + VILLAGE_FISHING_CYCLE_SECONDS) % VILLAGE_FISHING_CYCLE_SECONDS;
  const station = Math.floor(lapTime / 94);
  const local = lapTime % 94;
  let phase: VillageFishingPhase;
  let travel: number;
  let speedFactor: number;
  let phaseProgress: number;
  // Integral of a cosine speed ramp: zero acceleration at the joins, gradual turns.
  if (local < 10) {
    phase = "depart"; phaseProgress = local / 10;
    travel = (local / 2 - 5 / Math.PI * Math.sin(Math.PI * local / 10)) / 54;
    speedFactor = 0.5 - 0.5 * Math.cos(Math.PI * local / 10);
  } else if (local < 54) {
    phase = "cruise"; phaseProgress = (local - 10) / 44;
    travel = (local - 5) / 54; speedFactor = 1;
  } else if (local < 64) {
    phase = "approach"; phaseProgress = (local - 54) / 10;
    const t = local - 54;
    travel = (49 + t / 2 + 5 / Math.PI * Math.sin(Math.PI * t / 10)) / 54;
    speedFactor = 0.5 + 0.5 * Math.cos(Math.PI * t / 10);
  } else {
    travel = 1; speedFactor = 0;
    if (local < 69) { phase = "lower"; phaseProgress = (local - 64) / 5; }
    else if (local < 82) { phase = "fishing"; phaseProgress = (local - 69) / 13; }
    else if (local < 89) { phase = "haul"; phaseProgress = (local - 82) / 7; }
    else { phase = "stow"; phaseProgress = (local - 89) / 5; }
  }
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const gearDepth = phase === "lower" ? smooth(phaseProgress) : phase === "fishing" ? 1 : phase === "haul" ? 1 - smooth(phaseProgress) : 0;
  return { phase, phaseProgress, station, progress: ((station + travel) / 4) % 1, speed: speedFactor * routeLength / 216, gearDepth, catchVisible: phase === "haul" && phaseProgress > 0.42 || phase === "stow" };
}

export function sampleFishingRoute(progress: number) {
  const u = ((progress % 1) + 1) % 1;
  const point = route.getPointAt(u);
  // Cyclic neighbours also keep the tangent continuous across the lap seam.
  const before = route.getPointAt((u + 1 - .00001) % 1), after = route.getPointAt((u + .00001) % 1);
  return { x: point.x, z: point.z, heading: Math.atan2(after.x - before.x, after.z - before.z) };
}

/** Same closed curve, sample count and coordinate transform as terrain outline(). */
export function sampleMarineCoast(points: readonly Point[] = VILLAGE_COAST): Point[] {
  return new THREE.CatmullRomCurve3(points.map(point => {
    const [x, z] = paintingToGround(...point); return new THREE.Vector3(x, 0, z);
  }), true, "centripetal").getPoints(160).map(point => [point.x, point.z]);
}

function segmentDistance(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / Math.max(0.000001, dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

function distanceToCoast(x: number, z: number, coast: readonly Point[]) {
  let distance = 80;
  for (let i = 0; i < coast.length - 1; i++) distance = Math.min(distance, segmentDistance(x, z, coast[i], coast[i + 1]));
  return distance;
}

const waveGLSL = `
  vec3 wave(vec2 p) {
    float a = dot(p, vec2(.63, .31)) - uTime * .72;
    float b = dot(p, vec2(-.33, .91)) - uTime * 1.09;
    float c = dot(p, vec2(1.71, .64)) - uTime * 1.62;
    return mix(1., .16, uRiver) * vec3(
      .025*sin(a) + .012*sin(b) + .005*sin(c),
      .025*.63*cos(a) - .012*.33*cos(b) + .005*1.71*cos(c),
      .025*.31*cos(a) + .012*.91*cos(b) + .005*.64*cos(c));
  }
`;

function waterMaterial(river = false, foam = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uRiver: { value: river ? 1 : 0 }, uFoam: { value: foam ? 1 : 0 }, uDetail: { value: 1 },
      uDeepColor: { value: new THREE.Color(river ? "#168e8e" : "#148c95") },
      uShallowColor: { value: new THREE.Color("#6abca6") }, uFoamColor: { value: new THREE.Color("#d5e8cb") },
    },
    vertexShader: `
      uniform float uTime; uniform float uRiver;
      attribute float coastDistance;
      varying vec2 vWater; varying float vCoast;
      ${waveGLSL}
      void main() {
        vWater = position.xz; vCoast = coastDistance;
        vec3 p = position; p.y += wave(p.xz).x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }
    `,
    fragmentShader: `
      uniform float uTime; uniform float uRiver; uniform float uFoam; uniform float uDetail;
      uniform vec3 uDeepColor; uniform vec3 uShallowColor; uniform vec3 uFoamColor;
      varying vec2 vWater; varying float vCoast;
      ${waveGLSL}
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 cell = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hash21(cell), hash21(cell+vec2(1.,0.)), f.x),
          mix(hash21(cell+vec2(0.,1.)), hash21(cell+vec2(1.,1.)), f.x), f.y);
      }
      void main() {
        vec3 waves = wave(vWater);
        float shallows = exp(-max(0., vCoast) * .65);
        vec3 color = mix(uDeepColor, uShallowColor, shallows * .38);
        float ripple = sin(dot(vWater, vec2(5.4, 2.1)) - uTime * 1.42)
          * sin(dot(vWater, vec2(-1.7, 4.2)) - uTime * .65);
        vec3 normal = normalize(vec3(-waves.y - ripple*.005*uDetail, 1., -waves.z));
        float light = dot(normal, normalize(vec3(-.4, 1., .2)));
        color *= .91 + light * .12;
        // Broad travelling crests bend with spatial noise. Independently hashed
        // patches break them into sparse, unequal highlights instead of tiled dashes.
        float warp = noise(vWater*.22 + vec2(uTime*.008, 0.));
        float crest = sin(dot(vWater, vec2(.92, .42)) - uTime*.74 + warp*1.2);
        float patches = noise(vWater*vec2(.31,.49) + vec2(-uTime*.012,0.));
        float glint = pow(max(0., crest), 36.) * smoothstep(.66,.85,patches);
        color += vec3(.12, .18, .14) * glint * .24 * uDetail;
        float fineCrest = sin(dot(vWater,vec2(2.1,.87))-uTime*.97+warp*2.4);
        float streak = pow(max(0.,fineCrest),28.) * smoothstep(.43,.73,patches);
        color = mix(color,uFoamColor,streak*.055*uDetail);
        float waterEdge = 1. - smoothstep(.07, .34, vCoast);
        float broken = .65 + .35*sin(dot(vWater, vec2(4.1, 3.7)) + uTime*.82);
        float wash = smoothstep(.28, .87, sin(vCoast*22. - uTime*.92 + sin(vWater.x*2.2)));
        float foam = uFoam * waterEdge * broken * (.48 + wash*.30);
        // The river's bank line remains quiet and its current runs diagonally downstream.
        float current = pow(max(0., sin(dot(vWater, vec2(4.5, 4.7)) - uTime*1.3 + warp)), 28.);
        current *= smoothstep(.65, .9, patches);
        color = mix(color, uFoamColor, max(foam, current*.20*uRiver));
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function setCoastDistances(geometry: THREE.BufferGeometry, coast: readonly Point[], lighthouse: Point, river = false) {
  const vertices = geometry.getAttribute("position"), distances = new Float32Array(vertices.count);
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i);
    distances[i] = Math.min(distanceToCoast(x, z, coast), river ? 80 : Math.abs(Math.hypot((x - lighthouse[0]) / 1.12, z - lighthouse[1]) - 2.3));
  }
  geometry.setAttribute("coastDistance", new THREE.BufferAttribute(distances, 1));
}

function subdivideRiver(source: THREE.BufferGeometry) {
  let geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  // Interior samples are necessary: a ShapeGeometry has boundary vertices only,
  // which would make the whole river look like shallow bank water.
  for (let pass = 0; pass < 2; pass++) {
    const positions = geometry.getAttribute("position"), values: number[] = [];
    for (let i = 0; i < positions.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, i);
      const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
      const ab = a.clone().add(b).multiplyScalar(.5), bc = b.clone().add(c).multiplyScalar(.5), ca = c.clone().add(a).multiplyScalar(.5);
      for (const point of [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca]) values.push(point.x, point.y, point.z);
    }
    geometry.dispose(); geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  }
  return geometry;
}

function foamRibbon(coast: readonly Point[], outward: boolean, height: number, width = 0.48) {
  const positions: number[] = [], distances: number[] = [];
  const count = coast.length - 1;
  const pairs = coast.slice(0, count).map((point, i) => {
    const prev = coast[(i + count - 1) % count], next = coast[(i + 1) % count];
    const tangent = new THREE.Vector2(next[0] - prev[0], next[1] - prev[1]).normalize();
    const sign = outward ? 1 : -1;
    return [[point[0], height, point[1]], [point[0] + tangent.y * width * sign, height, point[1] - tangent.x * width * sign]] as const;
  });
  for (let i = 0; i < count; i++) {
    const a = pairs[i], b = pairs[(i + 1) % count];
    for (const [point, distance] of [[a[0], 0], [b[1], width], [a[1], width], [a[0], 0], [b[0], 0], [b[1], width]] as const) {
      positions.push(...point); distances.push(distance);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("coastDistance", new THREE.Float32BufferAttribute(distances, 1));
  // Winding follows the sampled contour; double-sided also handles inset river rings.
  geometry.computeVertexNormals();
  return geometry;
}

/** Small coloured parts merge once; moving gear stays separate from the hull. */
class MarineParts {
  private parts: THREE.BufferGeometry[] = [];
  add(geometry: THREE.BufferGeometry, color: string, position: XYZ = [0, 0, 0], rotation: XYZ = [0, 0, 0]) {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part !== geometry) geometry.dispose();
    part.deleteAttribute("uv");
    part.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
    const colors = new Float32Array(part.getAttribute("position").count * 3), value = new THREE.Color(color);
    for (let i = 0; i < colors.length; i += 3) value.toArray(colors, i);
    part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.parts.push(part);
  }
  box(color: string, position: XYZ, size: XYZ, rotation: XYZ = [0, 0, 0]) { this.add(new THREE.BoxGeometry(...size), color, position, rotation); }
  ball(color: string, position: XYZ, radius: number, scale: XYZ = [1, 1, 1]) {
    const geometry = new THREE.SphereGeometry(radius, 8, 6); geometry.scale(...scale); this.add(geometry, color, position);
  }
  beam(color: string, a: XYZ, b: XYZ, radius: number) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const geometry = new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 6);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()));
    this.add(geometry, color, start.add(end).multiplyScalar(0.5).toArray() as [number, number, number]);
  }
  tube(color: string, points: XYZ[], radius: number, closed = false) {
    this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed), points.length * 3, radius, 5, closed), color);
  }
  geometry() {
    const geometry = mergeGeometries(this.parts, false);
    this.parts.forEach(part => part.dispose()); this.parts = [];
    if (!geometry) throw new Error("Unable to merge marine props");
    geometry.computeBoundingSphere(); return geometry;
  }
  finish(name: string, material: THREE.MeshStandardMaterial) {
    const mesh = new THREE.Mesh(this.geometry(), material); mesh.name = name; mesh.raycast = () => {}; return mesh;
  }
}

function createBoat(material: THREE.MeshStandardMaterial) {
  const boat = new THREE.Group(); boat.name = "fishing-boat";
  const p = new MarineParts();
  const sections = [[-1.45, .38, -.10], [-1.08, .60, -.23], [-.25, .63, -.26], [.65, .52, -.22], [1.24, .28, -.05], [1.58, .025, .30]];
  const hull: number[] = [], stripe: number[] = [];
  const quad = (array: number[], a: XYZ, b: XYZ, c: XYZ, d: XYZ) => array.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < sections.length - 1; i++) {
    const [az, aw, ay] = sections[i], [bz, bw, by] = sections[i + 1];
    for (const side of [-1, 1]) {
      quad(hull, [side*aw, .38, az], [side*bw, .38, bz], [side*bw*.56, by, bz], [side*aw*.56, ay, az]);
      quad(stripe, [side*(aw+.006), .24, az], [side*(bw+.006), .24, bz], [side*(bw*.94+.006), .15, bz], [side*(aw*.94+.006), .15, az]);
    }
    quad(hull, [-aw*.56, ay, az], [-bw*.56, by, bz], [bw*.56, by, bz], [aw*.56, ay, az]);
  }
  quad(hull, [-.38,.38,-1.45], [.38,.38,-1.45], [.21,-.1,-1.45], [-.21,-.1,-1.45]);
  const hullGeometry = new THREE.BufferGeometry(); hullGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hull,3)); hullGeometry.computeVertexNormals(); p.add(hullGeometry,C.teal);
  const stripeGeometry = new THREE.BufferGeometry(); stripeGeometry.setAttribute("position",new THREE.Float32BufferAttribute(stripe,3)); stripeGeometry.computeVertexNormals(); p.add(stripeGeometry,C.cream);
  const rim: XYZ[] = [...sections.map(([z,w])=>[-w,.40,z] as XYZ), ...sections.slice().reverse().map(([z,w])=>[w,.40,z] as XYZ)];
  const deckShape = new THREE.Shape(rim.map(([x,,z])=>new THREE.Vector2(x,-z)));
  p.add(new THREE.ShapeGeometry(deckShape), C.wood, [0,.385,0], [-Math.PI/2,0,0]);
  p.tube(C.darkWood,rim,.035,true);
  for (let i=0;i<9;i++) p.box(C.darkWood,[0,.395,-1.22+i*.27],[i>6?.5:1.02,.01,.014]);
  // Cream wheelhouse, ochre roof, dark glazed windows, side rails and a wooden stern.
  p.box(C.cream,[0,.82,.35],[.87,.88,.88]);
  p.box(C.gold,[0,1.30,.34],[1.04,.12,1.04]);
  p.box(C.ink,[0,1.02,.802],[.66,.34,.025]);
  p.box(C.teal,[0,1.02,.82],[.035,.35,.025]);
  for (const side of [-1,1]) {
    p.box(C.ink,[side*.448,1.01,.45],[.025,.33,.45]);
    p.box(C.cream,[side*.465,1.01,.45],[.027,.35,.027]);
    p.beam(C.darkWood,[side*.53,.43,-1.2],[side*.53,.76,-1.2],.025);
    p.beam(C.cream,[side*.53,.76,-1.2],[side*.56,.76,-.5],.024);
    p.add(new THREE.TorusGeometry(.14,.038,5,12),C.ink,[side*.60,.29,-.85],[0,Math.PI/2,0]);
  }
  p.box(C.darkWood,[0,.52,-1.23],[.94,.08,.29]);
  p.box(C.teal,[-.23,.53,-.73],[.42,.24,.4]);
  for (let i=0;i<3;i++) p.box(C.cream,[-.23,.64,-.84+i*.11],[.39,.025,.018]);
  p.beam(C.darkWood,[.40,.44,.62],[.40,2.03,.62],.024);
  p.beam(C.ink,[.40,1.88,.62],[.40,2.18,.62],.012);
  p.box(C.cream,[.60,1.84,.62],[.40,.20,.018],[0,0,-.10]);
  p.box(C.gold,[.60,1.83,.633],[.05,.19,.01]);
  // Work on the port side: the initial camera can see the line and catch over water.
  p.ball(C.gold,[-.22,.91,-.61],.16,[.83,1.5,.85]);
  p.ball("#e7bc87",[-.22,1.18,-.61],.115);
  p.add(new THREE.CylinderGeometry(.14,.13,.065,10),C.cream,[-.22,1.29,-.61]);
  p.beam(C.ink,[-.16,.70,-.61],[-.13,.43,-.64],.045); p.beam(C.ink,[-.29,.70,-.61],[-.31,.43,-.64],.045);
  p.beam(C.gold,[-.32,1.02,-.61],[-.64,.94,-.63],.046);
  p.beam(C.darkWood,[-.58,.42,-.53],[-.58,1.22,-.53],.032);
  p.beam(C.darkWood,[-.58,1.22,-.53],[-1.12,1.31,-.53],.029);
  p.add(new THREE.TorusGeometry(.07,.019,5,10),C.ink,[-1.12,1.29,-.53]);
  p.add(new THREE.TorusGeometry(.15,.035,5,12),C.wood,[-.31,.46,-1.03],[Math.PI/2,0,0]);
  // Water shades itself. Moving decoration does not dirty the static village shadow map.
  const body=p.finish("fishing-boat-hull-and-crew",material); boat.add(body);

  const potParts=new MarineParts();
  for (const y of [-.13,.13]) {
    potParts.tube(C.darkWood,[[-.18,y,-.16],[.18,y,-.16],[.18,y,.16],[-.18,y,.16]],.015,true);
    for (let i=-1;i<=1;i++) potParts.beam(C.wood,[i*.11,y,-.15],[i*.11,y,.15],.009);
  }
  for (const x of [-.18,0,.18]) for (const z of [-.16,.16]) potParts.beam(C.darkWood,[x,-.13,z],[x,.13,z],.012);
  const pot=potParts.finish("fishing-pot",material); boat.add(pot);
  const line=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,1,5),material); line.name="fishing-line"; line.raycast=()=>{}; boat.add(line);
  // Vertex colours are required by the shared material, including the animated rope.
  const lineColors=new Float32Array(line.geometry.getAttribute("position").count*3); const ropeColor=new THREE.Color(C.cream);
  for(let i=0;i<lineColors.length;i+=3) ropeColor.toArray(lineColors,i);
  line.geometry.setAttribute("color",new THREE.BufferAttribute(lineColors,3));
  const catchParts=new MarineParts();
  catchParts.ball(C.fish,[0,0,0],.105,[.65,.8,1.7]);
  catchParts.add(new THREE.ConeGeometry(.09,.14,3),C.fish,[0,0,-.20],[Math.PI/2,0,0]);
  catchParts.ball(C.ink,[.059,.027,.10],.015);
  catchParts.ball(C.ink,[-.059,.027,.10],.015);
  const catchFish=catchParts.finish("fishing-catch",material); boat.add(catchFish);
  const floatParts=new MarineParts();
  floatParts.ball(C.gold,[0,.033,0],.052,[1,1.2,1]);
  floatParts.ball(C.cream,[0,.078,0],.043,[1,.68,1]);
  floatParts.beam(C.ink,[0,.10,0],[0,.15,0],.009);
  floatParts.add(new THREE.TorusGeometry(.16,.006,4,22),"#a2cfc0",[0,.006,0],[Math.PI/2,0,0]);
  floatParts.add(new THREE.TorusGeometry(.25,.005,4,22,Math.PI*1.35),"#a2cfc0",[0,.006,0],[Math.PI/2,.35,0]);
  const fishingFloat=floatParts.finish("fishing-line-contact-float",material); boat.add(fishingFloat);
  return {boat,pot,line,catchFish,fishingFloat};
}

export function createVillageMarine(): VillageLifeController {
  const object=new THREE.Group(); object.name="village-marine";
  const coast=sampleMarineCoast(), riverCoast=sampleMarineCoast(VILLAGE_RIVER);
  const lighthouse=paintingToGround(1420,15);
  const seaMaterial=waterMaterial(), riverMaterial=waterMaterial(true), foamMaterial=waterMaterial(false,true);
  foamMaterial.side=THREE.DoubleSide;
  const seaGeometry=new THREE.PlaneGeometry(160,160,96,96); seaGeometry.rotateX(-Math.PI/2); seaGeometry.translate(0,SEA_LEVEL,0);
  setCoastDistances(seaGeometry,coast,lighthouse);
  const sea=new THREE.Mesh(seaGeometry,seaMaterial); sea.name="sea-directional-swells"; sea.raycast=()=>{}; sea.frustumCulled=false; object.add(sea);
  const riverShape=new THREE.Shape(riverCoast.map(([x,z])=>new THREE.Vector2(x,-z)));
  const riverGeometry=subdivideRiver(new THREE.ShapeGeometry(riverShape)); riverGeometry.rotateX(-Math.PI/2); riverGeometry.translate(0,RIVER_LEVEL,0);
  setCoastDistances(riverGeometry,riverCoast,lighthouse,true);
  const river=new THREE.Mesh(riverGeometry,riverMaterial); river.name="river-current"; river.raycast=()=>{}; object.add(river);
  // Coast matches the terrain's exact curve. The foam is on the seaward side only.
  const coastFoam=new THREE.Mesh(foamRibbon(coast,true,SEA_LEVEL+.004),foamMaterial); coastFoam.name="coast-contact-foam"; coastFoam.raycast=()=>{}; object.add(coastFoam);
  const islandRing: Point[]=Array.from({length:65},(_,i)=>[lighthouse[0]+Math.cos(i/64*TAU)*2.52,lighthouse[1]+Math.sin(i/64*TAU)*2.16]);
  const islandFoam=new THREE.Mesh(foamRibbon(islandRing,true,SEA_LEVEL+.005,.35),foamMaterial); islandFoam.name="lighthouse-rock-foam"; islandFoam.raycast=()=>{}; object.add(islandFoam);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,flatShading:true,side:THREE.DoubleSide});
  const props=new MarineParts();
  // Sparse shore outcrops and kelp follow the actual contour, away from entrances.
  for(const index of [8,22,49,65,81,109,127,146]) {
    const at=coast[index], prev=coast[index-1], next=coast[index+1];
    const dx=next[0]-prev[0],dz=next[1]-prev[1],length=Math.hypot(dx,dz);
    const x=at[0]+dz/length*.66,z=at[1]-dx/length*.66;
    const rock=new THREE.IcosahedronGeometry(.30,1); rock.scale(1.3,.72,1); props.add(rock,C.stone,[x,-.28,z],[.1,index,.1]);
    for(let blade=0;blade<3;blade++) {
      const px=x+.23+blade*.06,pz=z-.18;
      const geometry=new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute([px-.025,-.41,pz,px+.025,-.41,pz,px+.10,-.05-blade*.045,pz+.06],3)); geometry.computeVertexNormals(); props.add(geometry,C.kelp);
    }
  }
  const mooring=coast[16], previous=coast[15], next=coast[17];
  const angle=Math.atan2(next[0]-previous[0],next[1]-previous[1]);
  const shoreAt=(x:number,y:number,z:number):XYZ=>[mooring[0]+Math.cos(angle)*x+Math.sin(angle)*z,y,mooring[1]-Math.sin(angle)*x+Math.cos(angle)*z];
  for(let i=0;i<6;i++) props.box(i%2?C.wood:C.darkWood,shoreAt(-.7+i*.22,.02,0),[.20,.08,.94],[0,angle,0]);
  for(const x of [-.68,.36]) for(const z of [-.36,.36]) {
    props.beam(C.darkWood,shoreAt(x,-.55,z),shoreAt(x,.25,z),.055);
    props.add(new THREE.TorusGeometry(.072,.018,5,10),C.cream,shoreAt(x,.18,z),[Math.PI/2,0,0]);
  }
  props.box(C.wood,shoreAt(.75,.13,.15),[.35,.26,.3],[0,angle,0]);
  props.tube(C.cream,[shoreAt(.36,.17,.36),shoreAt(.0,.08,.47),shoreAt(-.68,.17,.36)],.016);
  object.add(props.finish("shore-kelp-rocks-and-mooring",material));

  const buoyParts=new MarineParts();
  buoyParts.ball(C.teal,[0,.07,0],.13,[1,1.3,1]);
  buoyParts.add(new THREE.CylinderGeometry(.127,.127,.07,8),C.cream,[0,.11,0]);
  buoyParts.beam(C.darkWood,[0,.19,0],[0,.55,0],.015);
  buoyParts.box(C.gold,[.08,.46,0],[.15,.10,.014]);
  const buoys=new THREE.InstancedMesh(buoyParts.geometry(),material,4); buoys.name="fishing-marker-buoys"; buoys.raycast=()=>{}; buoys.instanceMatrix.setUsage(THREE.DynamicDrawUsage); object.add(buoys);
  const buoyLocations=[sampleFishingRoute(.25),sampleFishingRoute(.50),sampleFishingRoute(.75),sampleFishingRoute(.97)].map(p=>({x:p.x+Math.cos(p.heading)*2.25,z:p.z-Math.sin(p.heading)*2.25}));
  const {boat,pot,line,catchFish,fishingFloat}=createBoat(material); object.add(boat);

  // Instanced, opaque broken wake strokes: short lifetimes, no accumulated meshes.
  const wakeGeometry=new THREE.PlaneGeometry(1,.035); wakeGeometry.rotateX(-Math.PI/2);
  const wakeMaterial=new THREE.MeshBasicMaterial({color:"#a6d6bf",side:THREE.DoubleSide});
  const wake=new THREE.InstancedMesh(wakeGeometry,wakeMaterial,24); wake.name="fishing-boat-wake"; wake.raycast=()=>{}; wake.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wake.frustumCulled=false; object.add(wake);
  const matrix=new THREE.Matrix4(), quaternion=new THREE.Quaternion(), position=new THREE.Vector3(), scale=new THREE.Vector3(), euler=new THREE.Euler();
  const floatBase=new THREE.Vector3(),floatUp=new THREE.Vector3();
  const wakeColor=new THREE.Color(), wakeWaterColor=new THREE.Color("#258e8c"), wakeFoamColor=new THREE.Color("#c0dfc9");
  const setInstance=(mesh:THREE.InstancedMesh,index:number,x:number,y:number,z:number,rotation:XYZ,size:XYZ)=>{
    matrix.compose(position.set(x,y,z),quaternion.setFromEuler(euler.set(...rotation)),scale.set(...size)); mesh.setMatrixAt(index,matrix);
  };
  let disposed=false;
  object.userData={decorative:true,drawCalls:12,seaLevel:SEA_LEVEL,routeLength,cycleSeconds:VILLAGE_FISHING_CYCLE_SECONDS};
  const update:VillageLifeController["update"]=(frame)=>{
    if(disposed) return;
    const time=frame.reduced?0:frame.time;
    for(const water of [seaMaterial,riverMaterial,foamMaterial]) {water.uniforms.uTime.value=time; water.uniforms.uDetail.value=frame.quality==="low"?.55:1;}
    const cycleTime=time+VILLAGE_MARINE_PRESENTATION_OFFSET;
    const cycle=sampleFishingCycle(cycleTime), routeProgress=(cycle.progress+.75)%1, location=sampleFishingRoute(routeProgress);
    const wave=sampleVillageWaves(location.x,location.z,time);
    boat.position.set(location.x,wave.height+.025,location.z);
    const forwardX=Math.sin(location.heading),forwardZ=Math.cos(location.heading);
    const pitch=Math.atan(wave.dx*forwardX+wave.dz*forwardZ);
    const roll=Math.atan(wave.dx*forwardZ-wave.dz*forwardX);
    boat.rotation.set(-pitch,location.heading,roll,"YXZ");
    boat.userData={phase:cycle.phase,phaseProgress:cycle.phaseProgress,speed:cycle.speed,station:cycle.station,routeProgress,gearDepth:cycle.gearDepth,catchVisible:cycle.catchVisible,waterHeight:wave.height,time,cycleTime};
    const visible=frame.visible(boat,3.5); boat.visible=visible;
    if(visible) {
      const stow=cycle.phase==="stow"?cycle.phaseProgress:cycle.phase==="approach"?1-cycle.phaseProgress:cycle.phase==="depart"||cycle.phase==="cruise"?1:0;
      const gearX=THREE.MathUtils.lerp(-1.12,-.38,stow),gearZ=THREE.MathUtils.lerp(-.53,-1.0,stow);
      const gearY=THREE.MathUtils.lerp(.56,.58,stow)-cycle.gearDepth*1.13;
      pot.position.set(gearX,gearY,gearZ); pot.rotation.y=Math.sin(time*.65)*.06*cycle.gearDepth;
      const lineLength=1.29-gearY-.14;
      line.position.set(-1.12,1.29-lineLength/2,-.53); line.scale.y=Math.max(.01,lineLength); line.visible=stow<.02;
      catchFish.visible=cycle.catchVisible;
      catchFish.position.set(gearX,gearY+.15,gearZ+.05); catchFish.rotation.set(0,Math.sin(time*3)*.2,Math.sin(time*4)*.18);
      if(cycle.phase==="stow") {catchFish.position.x=THREE.MathUtils.lerp(-1.12,-.23,cycle.phaseProgress); catchFish.position.y=.60+Math.sin(cycle.phaseProgress*Math.PI)*.23; catchFish.position.z=THREE.MathUtils.lerp(-.53,-.73,cycle.phaseProgress);}
      // Solve the local line contact against the same wave field as the sea.
      // This stays attached to the tilted boat without burying the float in a crest.
      floatBase.set(-1.12,0,-.53).applyQuaternion(boat.quaternion).add(boat.position);
      floatUp.set(0,1,0).applyQuaternion(boat.quaternion);
      const contactWave=sampleVillageWaves(floatBase.x,floatBase.z,time);
      const contactY=(contactWave.height+.01-floatBase.y)/floatUp.y;
      fishingFloat.position.set(-1.12,contactY,-.53);
      fishingFloat.visible=stow<.02&&gearY<contactY-.04;
      fishingFloat.userData.waterHeight=contactWave.height;
    }
    for(let i=0;i<buoyLocations.length;i++) {
      const at=buoyLocations[i],water=sampleVillageWaves(at.x,at.z,time);
      setInstance(buoys,i,at.x,water.height,at.z,[Math.atan(water.dz),0,-Math.atan(water.dx)],[1,1,1]);
    }
    buoys.instanceMatrix.needsUpdate=true;
    const wakeCount=frame.quality==="low"?12:24; wake.count=wakeCount;
    wake.visible=!frame.reduced&&visible&&(cycle.speed>.01||sampleFishingCycle(cycleTime-6).speed>.01);
    for(let i=0;i<(wake.visible?wakeCount:0);i++) {
      const age=(i>>1)*.55+.25, oldCycle=sampleFishingCycle(cycleTime-age),old=sampleFishingRoute(oldCycle.progress+.75);
      const speed=oldCycle.speed/(routeLength/216), fade=(1-age/7)*speed;
      const side=i%2?1:-1, spread=.32+age*.15;
      const x=old.x-Math.sin(old.heading)*1.48+Math.cos(old.heading)*spread*side;
      const z=old.z-Math.cos(old.heading)*1.48-Math.sin(old.heading)*spread*side;
      setInstance(wake,i,x,sampleVillageWaves(x,z,time).height+.009,z,[0,old.heading+Math.PI/2+side*.38,0],[Math.max(.001,fade*.52),1,Math.max(.001,fade)]);
      wake.setColorAt(i,wakeColor.lerpColors(wakeWaterColor,wakeFoamColor,Math.max(0,fade)*.63));
    }
    wake.instanceMatrix.needsUpdate=true; if(wake.instanceColor) wake.instanceColor.needsUpdate=true;
  };
  update({time:0,delta:0,reduced:false,quality:"high",visible:()=>true});
  return {object,update,dispose:()=>{
    if(disposed)return; disposed=true;
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    object.traverse(child=>{if(child instanceof THREE.Mesh){geometries.add(child.geometry);for(const value of Array.isArray(child.material)?child.material:[child.material])materials.add(value);}});
    geometries.forEach(geometry=>geometry.dispose()); materials.forEach(value=>value.dispose());
    buoys.dispose(); wake.dispose(); object.clear(); object.userData.disposed=true;
  }};
}
