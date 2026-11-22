import * as THREE from "three";
import { createPortraitEar, createVillagePortraitShape, fishermanMoustache, portraitPatch, type VillagePortrait } from "./village-portrait-sculpt";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type CharacterPoint = [number, number, number];
export const CHARACTER_COLORS = {
  ink: "#294942", dark: "#263734", cream: "#fff0ca", skin: "#edbd89",
  teal: "#087f7c", wood: "#c69658", gold: "#e9b54b", hair: "#655247",
  tan: "#cfa173", blush: "#d99575", wine: "#672d40",
};
export const noCharacterHit: THREE.Object3D["raycast"] = () => {};
const UP = new THREE.Vector3(0, 1, 0);

/** One vertex-coloured draw call per articulated part. Consumes all source geometry. */
export class Assembly {
  private pieces: THREE.BufferGeometry[] = [];

  get vertexCount() { return this.pieces.reduce((n, piece) => n + piece.getAttribute("position").count, 0); }
  get indexCount() { return this.pieces.reduce((n, piece) => n + piece.index!.count, 0); }

  add(geometry: THREE.BufferGeometry, color: string | null, at: CharacterPoint = [0, 0, 0]) {
    geometry.translate(...at);
    geometry.deleteAttribute("uv");
    const count = geometry.getAttribute("position").count;
    if (!geometry.index) {
      const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++) indices[i] = i;
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    if (color !== null) {
      const pigment = new THREE.Color(color);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) pigment.toArray(colors, i * 3);
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    this.pieces.push(geometry);
  }

  ball(at: CharacterPoint, radius: number, color: string, scale: CharacterPoint = [1, 1, 1]) {
    this.add(new THREE.SphereGeometry(radius, 12, 8).scale(...scale), color, at);
  }

  box(at: CharacterPoint, size: CharacterPoint, color: string) {
    this.add(new THREE.BoxGeometry(...size), color, at);
  }

  rod(from: CharacterPoint, to: CharacterPoint, radius: number, color: string, top = radius) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const geometry = new THREE.CylinderGeometry(top, radius, a.distanceTo(b), 10);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
    this.add(geometry, color, a.add(b).multiplyScalar(0.5).toArray() as CharacterPoint);
  }

  /** A tapered continuous stroke for cloth folds, fingers and ink lines. */
  sweep(points: CharacterPoint[], radii: number[], color: string, sides = 10) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const segments = (points.length - 1) * 3;
    const frames = curve.computeFrenetFrames(segments, false), length = curve.getLength();
    const vertices: number[] = [], indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const distance = i / segments, t = curve.getUtoTmapping(distance, distance * length);
      const knot = t * (points.length - 1), j = Math.min(points.length - 2, Math.floor(knot));
      const radius = THREE.MathUtils.lerp(radii[j], radii[j + 1], knot - j);
      const center = curve.getPoint(t);
      for (let k = 0; k < sides; k++) {
        const angle = 2 * Math.PI * k / sides;
        const vertex = center.clone().addScaledVector(frames.normals[i], radius * Math.cos(angle))
          .addScaledVector(frames.binormals[i], radius * Math.sin(angle));
        vertices.push(vertex.x, vertex.y, vertex.z);
        if (!i) continue;
        const a = (i - 1) * sides + k, b = (i - 1) * sides + (k + 1) % sides;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    this.add(geometry, color);
  }

  finish(name: string, parent: THREE.Object3D, material: THREE.Material) {
    const geometry = mergeGeometries(this.pieces, false);
    this.pieces.forEach(piece => piece.dispose()); this.pieces = [];
    if (!geometry) throw new Error(`Cannot merge ${name}`);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.raycast = noCharacterHit;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
}

export function characterMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 });
}

function paintPortraitHair(art: Assembly, sculpt: ReturnType<typeof createVillagePortraitShape>, hair: string, fisherman: boolean, guide: boolean) {
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  const pigment = new THREE.Color(hair), skin = new THREE.Color(sculpt.skin);
  const glint = new THREE.Color(fisherman ? "#e6d4b8" : guide ? "#695447" : "#bb8458");
  const color = new THREE.Color();
  const sides = 44, rows = 9;
  for (let j = 0; j <= rows; j++) for (let i = 0; i < sides; i++) {
    const angle = (i / sides - .5) * Math.PI * 2, turn = Math.abs(angle), t = j / rows;
    const brow = 1 - THREE.MathUtils.smoothstep(turn, .64, 1.33);
    const part = Math.sin(angle * 2.4 + (guide ? .54 : 1.17)) * brow * (fisherman ? .009 : .021);
    const arch = (fisherman ? .056 : .066) * Math.exp(-((turn - 1.57) ** 2) / .052);
    const sideburn = (fisherman ? .051 : .042) * Math.exp(-((turn - 1.22) ** 2) / .034);
    const hem = (fisherman ? .106 : .084) + brow * (fisherman ? .246 : .252) + part + arch - sideburn + .005 * Math.sin(9 * angle + .7);
    const y = THREE.MathUtils.lerp(hem, .436, t);
    const flow = angle + Math.sin(angle * .78 + t * 3.2) * .34 + t * (guide ? .49 : .67);
    const lock = .5 + .5 * Math.cos(flow * (fisherman ? 7 : 6) + .62 * Math.sin(flow * 3));
    const grain = .5 + .5 * Math.cos(flow * 23 + .74 * Math.sin(flow * 4));
    const volume = (.0057 + lock * (fisherman ? .0094 : .0107) + grain * .0016) * Math.sin(Math.PI * (.17 + .83 * t));
    const radius = sculpt.radius(y) + .0017 + volume;
    vertices.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius * sculpt.depth);
    const silver = fisherman ? .18 * Math.sin(angle * 13.0 + t * 2.3) ** 8 : 0;
    color.copy(pigment).multiplyScalar(.88 + .23 * lock).lerp(glint, .08 + .15 * lock ** 2 + silver)
      .lerp(skin, (1 - THREE.MathUtils.smoothstep(t, 0, .12)) * (fisherman ? .11 : .052));
    colors.push(color.r, color.g, color.b);
    if (j < rows) { const a = j * sides + i, b = j * sides + (i + 1) % sides; indices.push(a, b, a + sides, b, b + sides, a + sides); }
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  crown.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  crown.setIndex(indices); crown.computeVertexNormals();
  art.add(crown, null);
}

/** Each NPC keeps a fixed lip socket for held objects. The gaze moves inside the eyelids. */
export function createCharacterFace(parent: THREE.Object3D, material: THREE.Material, name: VillagePortrait, hair = CHARACTER_COLORS.hair) {
  const head = new THREE.Group(); head.name = name + "-head"; parent.add(head);
  const art = new Assembly(), sculpt = createVillagePortraitShape(name);
  const fisherman = name === "fisherman", guide = name === "loic";
  art.add(sculpt.geometry, null);
  paintPortraitHair(art, sculpt, hair, fisherman, guide);
  for (const side of [-1, 1]) {
    const earY = fisherman ? .139 : guide ? .152 : .155, earX = side * (sculpt.radius(earY) - .003);
    const ear = createPortraitEar(sculpt.skin, sculpt.tone.flush, fisherman ? .048 : .043, fisherman ? .063 : .055, .063, side);
    ear.rotateY(side * .18);
    art.add(ear, null, [earX, earY, .006]);
    if (fisherman) {
      art.add(fishermanMoustache(side, sculpt.front), null);
    } else if (guide) {
      for (let point = 0; point < 5; point++) {
        const x = side * (.076 + point * .014), y = .132 + .012 * Math.sin(point * 3.1 + side);
        art.add(portraitPatch(x, y, .0016 + (point % 3) * .00035, .00165, (px, py) => sculpt.front(px, py) + .0014, 0, 1, 0, 7, 1), "#c5936f");
      }
    }
  }
  art.finish(name + "-face", head, material);
  const [eyeX, eyeY, w, top, bottom, slant, almond] = sculpt.tone.eye;
  const eyes = new THREE.Group(); eyes.name = name + "-eyes"; eyes.position.y = eyeY; head.add(eyes);
  const whites = new Assembly(), pupils = new Assembly();
  const irisColor = new THREE.Color(fisherman ? "#665242" : guide ? "#6b432b" : "#835132");
  const irisTint = new THREE.Color(), pupil = new THREE.Color("#2c1d18"), reflectedLight = new THREE.Color("#b77c4e");
  const iris = (radius: number, angle: number) => {
    const reflected = 1 - THREE.MathUtils.smoothstep(Math.sin(angle), -.87, .40);
    const ring = THREE.MathUtils.smoothstep(radius, .44, .82) * (1 - .69 * THREE.MathUtils.smoothstep(radius, .84, 1));
    return irisTint.copy(pupil).lerp(irisColor, ring * (.34 + .43 * reflected)).lerp(reflectedLight, ring * reflected * .10);
  };
  const scleraTone = new THREE.Color("#fff0d9"), scleraShade = new THREE.Color("#e4c6ac"), scleraTint = new THREE.Color();
  const drawEye = (side: number, distant: boolean) => {
    const x = side * eyeX, tilt = side * slant;
    const eyeField = (px: number, py: number) => {
      const horizontal = (px - x) / w, vertical = py - eyeY - tilt * horizontal;
      const height = vertical < 0 ? bottom : top;
      return sculpt.front(px, py) + .0027 + .0064 * Math.max(0, 1 - horizontal ** 2 - (vertical / height) ** 2);
    };
    const irisField = (px: number, py: number) => eyeField(px, py) + .0025;
    whites.add(portraitPatch(x, eyeY, w, [top, bottom], eyeField, tilt, almond, eyeY, distant ? 16 : 24, distant ? 2 : 4,
      (r, a) => scleraTint.copy(scleraTone).lerp(scleraShade, .29 * r * (.38 + .62 * Math.max(0, Math.sin(a))))), null);
    const gazeArt = distant ? whites : pupils;
    const irisX = x - side * w * .07, irisY = eyeY - .0008;
    gazeArt.add(portraitPatch(irisX, irisY, w * (fisherman ? .71 : .78), [top * .89, bottom * .94], irisField, tilt * .71,
      almond, eyeY, distant ? 18 : 24, distant ? 4 : 6, iris), null);
    gazeArt.add(portraitPatch(irisX - .009, irisY + top * .40, .0060, fisherman ? .0034 : .0067,
      (px, py) => irisField(px, py) + .0021, 0, 1, eyeY, 12, 1), "#fff8e7");
    const lid = Array.from({ length: 7 }, (_, k): CharacterPoint => {
      const a = k * Math.PI / 6;
      const px = x + w * Math.cos(a), py = eyeY + top * Math.sin(a) ** almond + tilt * Math.cos(a);
      return [px, py - eyeY, eyeField(px, py) + .0010];
    });
    whites.sweep(lid, fisherman ? [.0001, .0018, .0034, .0037, .0034, .0018, .0001]
      : [.0001, .0017, .0030, .0036, .0031, .0017, .0001], "#4b3225", distant ? 5 : 6);
  };
  for (const side of [-1, 1]) drawEye(side, false);
  const nearCount = whites.indexCount;
  // At map scale a printed iris and eyelid fit in one draw call.
  for (const side of [-1, 1]) drawEye(side, true);
  const distantCount = whites.indexCount - nearCount;
  const sclera = whites.finish(name + "-eyelids", eyes, material);
  sclera.geometry.setDrawRange(0, nearCount);
  const gaze = pupils.finish(name + "-gaze", eyes, material);
  const mouthArt = new Assembly();
  // Densely sample only the curve. The mouth opens about the upper lip;
  // its contact socket is also the end of the blowpipe and bottle.
  const mouthWidth = fisherman ? .051 : guide ? .074 : .069;
  const upper = (u: number) => (fisherman ? .016 : guide ? .035 : .029) * (1 - Math.sqrt(1 - .96 * u * u)) + .0029 * u;
  const lower = (u: number) => upper(u) - (fisherman ? .016 : guide ? .017 : .022) * Math.sqrt(1 - u * u);
  const mouthVertices: number[] = [], mouthIndices: number[] = [];
  for (let col = 0; col <= 24; col++) {
    const u = 2 * col / 24 - 1, x = u * mouthWidth;
    for (let row = 0; row <= 2; row++) {
      const y = THREE.MathUtils.lerp(lower(u), upper(u), row / 2);
      mouthVertices.push(x, y, sculpt.front(x, .078 + y) - .218 + .0045);
    }
    if (col < 24) for (let row = 0; row < 2; row++) {
      const a = col * 3 + row;
      mouthIndices.push(a, a + 3, a + 1, a + 3, a + 4, a + 1);
    }
  }
  const mouthGeometry = new THREE.BufferGeometry();
  mouthGeometry.setAttribute("position", new THREE.Float32BufferAttribute(mouthVertices, 3));
  mouthGeometry.setIndex(mouthIndices);
  mouthGeometry.computeVertexNormals();
  mouthArt.add(mouthGeometry, "#4d2d21");
  const mouth = mouthArt.finish(name + "-mouth", head, material); mouth.position.set(0, .078, .218);
  const positions = mouth.geometry.getAttribute("position");
  // Correct both opening and width on the GPU: the outer mesh can stretch around
  // the fixed socket, while its lip surface continues to follow the jaw's slope.
  const contourX = new Float32Array(3 * positions.count), contourY = new Float32Array(3 * positions.count);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i) + .078;
    contourX[3 * i + 2] = x * (sculpt.front(x + .001, y) - sculpt.front(x - .001, y)) / .002;
    contourY[3 * i + 2] = (y - .078) * (sculpt.front(x, y + .001) - sculpt.front(x, y - .001)) / .002;
  }
  mouth.geometry.morphTargetsRelative = true;
  mouth.geometry.morphAttributes.position = [new THREE.BufferAttribute(contourX, 3), new THREE.BufferAttribute(contourY, 3)];
  mouth.updateMorphTargets();
  const browY = fisherman ? .278 : guide ? .311 : .304, browX = eyeX + .001;
  const browDepth = sculpt.front(browX, browY) + .003;
  const browSlope = (sculpt.front(browX, browY + .001) - sculpt.front(browX, browY - .001)) / .002;
  const brows = [-1, 1].map(side => {
    const brow = new Assembly();
    const shape = [[-.047, -.004], [-.035, fisherman ? .005 : .008], [-.006, guide ? .013 : .011],
      [.019, (guide ? .009 : .007) + (side === -1 ? .0025 : 0)], [.033, -.002], [.045, -.015]];
    const points = shape.map(([dx, dy]): CharacterPoint => {
      const px = side * (browX + dx), py = browY + dy;
      return [side * dx, dy, sculpt.front(px, py) - browDepth + .0034];
    });
    brow.sweep(points, fisherman ? [.001, .009, .011, .009, .006, .001] : [.001, .0093, .0116, .0084, .0044, .001],
      fisherman ? "#a49787" : guide ? "#493020" : "#663f29", 8);
    const mesh = brow.finish(`${name}-brow-${side}`, head, material);
    mesh.position.set(side * browX, browY, browDepth);
    return mesh;
  });
  const blinkOffset = (name.charCodeAt(0) % 11) * 0.25;
  function setExpression(time: number, reduced: boolean, attention: number, lookYaw: number, opening: number, accent = 0, detail = 1, mouthWidthScale = 1) {
    const distant = detail < .16;
    sclera.geometry.setDrawRange(distant ? nearCount : 0, distant ? distantCount : nearCount);
    gaze.visible = !distant;
    const phase = (time + blinkOffset) % 4.35;
    const blink = reduced ? 0 : Math.max(0, 1 - Math.abs(phase - 2.58) / 0.115);
    eyes.scale.y = (1 - blink * 0.94) * (1 - accent * 0.09);
    const gazeYaw = THREE.MathUtils.clamp(lookYaw, -.9, .9);
    eyes.rotation.y = gazeYaw * .004;
    gaze.rotation.y = .017 * gazeYaw;
    const liftA = attention * .008 + accent * .003, liftB = attention * .003;
    brows[0].position.y = browY + liftA;
    brows[1].position.y = browY + liftB;
    brows[0].position.z = browDepth + liftA * browSlope;
    brows[1].position.z = browDepth + liftB * browSlope;
    brows[0].rotation.z = -attention * 0.12 - accent * 0.08;
    brows[1].rotation.z = accent * 0.16;
    mouth.scale.set((.92 + opening * .14) * mouthWidthScale, .38 + opening * 1.40, 1);
    mouth.morphTargetInfluences![0] = mouth.scale.x - 1;
    mouth.morphTargetInfluences![1] = mouth.scale.y - 1;
  }
  return { head, mouth, brows, eyes, setExpression };
}

/** Late traversal deliberately includes invisible hit targets added by the owner. */
export function characterDisposer(object: THREE.Group) {
  let disposed = false;
  return {
    get disposed() { return disposed; },
    dispose() {
      if (disposed) return; disposed = true;
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      object.traverse(child => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
        geometries.add(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
      });
      geometries.forEach(resource => resource.dispose()); materials.forEach(resource => resource.dispose());
      object.removeFromParent(); object.clear();
    },
  };
}

/** Exponential interpolation stays stable across the shared 15/30 Hz quality levels. */
export function characterEase(delta: number, reduced: boolean) {
  return reduced ? 1 : 1 - Math.exp(-Math.min(0.1, Math.max(0, delta)) * 9);
}
