import * as THREE from "three";
import type { ChanvrierAppearance } from "@/lib/arena-chanvrier";
import { createChanvrierScalp } from "../chanvrier-head";
import { Assembly, characterMaterial, type CharacterPoint } from "./village-character-art";
import { addCapVisor, garmentVolume } from "./village-npc-tailoring";
import { createPortraitEar, portraitMoustache, portraitPatch } from "./village-portrait-sculpt";

type Portrait = {
  face: ChanvrierAppearance["face"];
  nose: ChanvrierAppearance["nose"];
  skin: string;
  flush: string;
  hair: string;
  hairLight: string;
  style: "swept" | "curls" | "cap";
  expression: "smile" | "grin" | "intent";
  scale: number;
  pitch: number;
};

export const INTERIOR_SKIN = {
  bankerSkin: "#e0af91",
  clerkSkin: "#d3a174",
  accountantSkin: "#e4ad7b",
  judgeSkin: "#cf966c",
} as const;

const portraits = {
  banker: {
    face: "pear", nose: "wide", skin: INTERIOR_SKIN.bankerSkin, flush: "#c77565", hair: "#aaaab0",
    hairLight: "#f4e7d6", style: "swept", expression: "smile", scale: 1.46, pitch: -.16,
  },
  clerk: {
    face: "oval", nose: "round", skin: INTERIOR_SKIN.clerkSkin, flush: "#c57557", hair: "#965733",
    hairLight: "#bd8455", style: "curls", expression: "grin", scale: 1.31, pitch: -.13,
  },
  accountant: {
    face: "round", nose: "small", skin: INTERIOR_SKIN.accountantSkin, flush: "#d57c62", hair: "#4e382e",
    hairLight: "#785241", style: "cap", expression: "smile", scale: 1.34, pitch: -.17,
  },
  judge: {
    face: "square", nose: "round", skin: INTERIOR_SKIN.judgeSkin, flush: "#b96d60", hair: "#50433c",
    hairLight: "#96807a", style: "cap", expression: "intent", scale: 1.50, pitch: -.19,
  },
  host: {
    face: "oval", nose: "small", skin: "#edbd89", flush: "#d88763", hair: "#654539",
    hairLight: "#a47654", style: "cap", expression: "grin", scale: 1.23, pitch: 0,
  },
} as const satisfies Record<string, Portrait>;

type Resident = keyof typeof portraits;
type Scalp = ReturnType<typeof createChanvrierScalp>;
type Front = (x: number, y: number) => number;
const { lerp, smoothstep } = THREE.MathUtils;
const DEPTH = .91;
const INK = "#362822";

function tintWeight(x: number, y: number, cx: number, cy: number, w: number, h: number) {
  return Math.max(0, 1 - ((x - cx) / w) ** 2 - ((y - cy) / h) ** 2) ** 2;
}

function skinVolume(scalp: Scalp, look: Portrait) {
  const sides = 36;
  const geometry = new THREE.LatheGeometry(scalp.profile, sides).scale(1, 1, DEPTH);
  const vertices = geometry.getAttribute("position"), colors = new Float32Array(vertices.count * 3);
  const skin = new THREE.Color(look.skin), flush = new THREE.Color(look.flush);
  const warmLight = skin.clone().lerp(new THREE.Color("#ffd4ad"), .3);
  const shadow = skin.clone().multiplyScalar(.76);
  const tint = new THREE.Color();
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i) / scalp.height, z = vertices.getZ(i);
    vertices.setZ(i, scalp.relief(x, y, z));
    const forward = smoothstep(z, .025, .12);
    const cheek = tintWeight(Math.abs(x), y, .126, .076, .097, .076);
    const nose = tintWeight(x, y, 0, .079, .057, .04);
    const eyes = tintWeight(Math.abs(x), y, .075, .151, .077, .06);
    const brow = tintWeight(Math.abs(x), y, .108, .215, .096, .064);
    tint.copy(skin).lerp(flush, (.58 * cheek + .35 * nose) * forward)
      .lerp(shadow, (.23 * eyes + .14 * brow) * forward)
      .lerp(warmLight, .3 * forward * tintWeight(x, y, 0, .104, .048, .038));
    tint.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal"), a = new THREE.Vector3(), b = new THREE.Vector3();
  const rows = scalp.profile.length;
  for (let i = 1; i < rows - 1; i++) {
    const other = sides * rows + i;
    a.fromBufferAttribute(normals, i).add(b.fromBufferAttribute(normals, other)).normalize();
    normals.setXYZ(i, a.x, a.y, a.z);
    normals.setXYZ(other, a.x, a.y, a.z);
  }
  return geometry;
}

function addHair(art: Assembly, scalp: Scalp, look: Portrait) {
  const { style } = look;
  const frontHem = style === "cap" ? .259 : style === "curls" ? .238 : .226;
  const curl = style === "curls";
  const rows = 13, sides = 56;
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  const base = new THREE.Color(look.hair), light = new THREE.Color(look.hairLight), tint = new THREE.Color();
  for (let row = 0; row <= rows; row++) for (let col = 0; col < sides; col++) {
    const angle = col * Math.PI * 2 / sides, turn = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    const t = Math.min(1, row / (rows - 1)), edge = row === rows;
    const forehead = 1 - smoothstep(turn, .68, 1.28);
    const nape = smoothstep(turn, 1.48, 2.25);
    const sideburn = .045 * Math.exp(-((turn - 1.17) ** 2) / .033);
    const part = Math.sin(angle * 2.3 + .54) * forehead * .021;
    const low = style === "cap" ? .067 : curl ? .087 : .041;
    const hem = lerp(.157, low, nape) + (frontHem - .157) * forehead - sideburn + part
      + (curl ? .009 * Math.cos(angle * 13) : .002 * Math.sin(angle * 17));
    const y = lerp(.354, hem, 1 - Math.cos(t * Math.PI / 2));
    const volume = Math.sin(Math.PI * t * .88);
    const grain = .5 + .5 * Math.cos((angle + .68 * (1 - t) + .19 * Math.sin(angle * 2 + t * 4)) * (curl ? 15 : 10));
    const roll = curl ? .013 * grain * (.35 + .65 * Math.sin(t * 11 + angle * 3) ** 2) : grain * .006;
    const radius = row === 0 ? 0 : (scalp.radius(y * scalp.height) + .003
      + volume * ((curl ? .028 : .01) + roll)) * (edge ? .82 : 1);
    const loft = style === "cap" ? .004 : .033;
    const rise = loft * (1 - t) ** .7;
    const x = radius * Math.sin(angle) - rise * .36, z = radius * Math.cos(angle) * DEPTH;
    const py = (y + rise + (edge ? .009 : 0)) * scalp.height;
    vertices.push(x, py, scalp.relief(x, py / scalp.height, z));
    tint.copy(base).lerp(light, .09 + .54 * grain ** 2 * volume).multiplyScalar(edge ? .75 : .95);
    colors.push(tint.r, tint.g, tint.b);
    if (row === rows) continue;
    const a = row * sides + col, b = row * sides + (col + 1) % sides;
    indices.push(a, a + sides, b, b, a + sides, b + sides);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  art.add(geometry, null);
  if (style === "swept") {
    art.sweep([[.137, .279, .092], [.106, .329, .117], [.034, .356, .133],
      [-.046, .340, .151], [-.132, .280, .125], [-.169, .254, .096]],
    [.012, .027, .040, .046, .035, .007], "#c7c3bd", 10);
    art.sweep([[-.151, .208, .096], [-.166, .261, .087], [-.142, .308, .064],
      [-.111, .330, .021]], [.009, .022, .024, .004], "#b5b4b2", 9);
  }
  if (curl) {
    for (let i = 0; i < 9; i++) {
      const angle = (i - 4) * .41;
      const x = Math.sin(angle), z = Math.cos(angle);
      const radius = .066 + .008 * Math.cos(i * 2.2);
      const lock = new THREE.SphereGeometry(radius, 12, 9).scale(.97, 1.13, .73)
        .rotateZ(x * -.54 + .21).rotateY(angle);
      art.add(lock, i % 3 === 0 ? "#ac6b40" : "#a0623c", [x * .165, .292 + z * .010, z * .142]);
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i + .2) * Math.PI / 3;
      art.ball([Math.sin(angle) * .113, .344, Math.cos(angle) * .093], .070,
        i % 2 ? "#a96b3f" : "#a1623b", [1.06, .82, 1.1]);
    }
  }
}

function addCap(art: Assembly, part: Resident) {
  const judge = part === "judge";
  const teal = judge ? "#177a75" : "#227a78";
  const seam = part === "accountant" ? "#293a38" : "#286965";
  const crown = garmentVolume([[.248, .167, .155], [.257, .183, .169], [.277, judge ? .195 : .190, .178],
    [.294, judge ? .205 : .187, .175], [.306, judge ? .208 : .181, .170],
    [.321, judge ? .202 : .171, .162, -.003], [.335, judge ? .188 : .158, .152, -.006],
    [.369, .115, .119, -.014], [.391, .064, .071, -.021], [.402, 0, 0, -.024]], 32);
  art.add(crown, teal);
  art.add(garmentVolume([[.246, .169, .157], [.254, .184, .171], [.267, .190, .177]], 32), seam);
  addCapVisor(art, .263, .171, .164, part === "accountant" ? .071 : .055, seam, "#29413c");
  if (judge) art.ball([0, .401, -.024], .023, "#d7a64d", [1, .67, 1]);
}

function addGlasses(art: Assembly, front: Front) {
  const eyewire = "#aa733c";
  const y = .151;
  for (const side of [-1, 1]) {
    const center = side * .075, z = front(center, y) + .015;
    const frameDepth = (x: number, py: number) => Math.max(front(x, py) + .009, z - (x - center) * side * .30);
    const sockets = Array.from({ length: 16 }, (_, i) => {
      const a = i * Math.PI / 8, x = center + .044 * Math.cos(a), py = y + .050 * Math.sin(a);
      return new THREE.Vector3(x, py, frameDepth(x, py));
    });
    art.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sockets, true), 32, .0055, 7, true), eyewire);
    const hinge = frameDepth(side * .12, y + .008);
    art.sweep([[side * .12, y + .008, hinge], [side * .168, y + .013, .129],
      [side * .188, y + .002, .043], [side * .193, .116, .004]], [.0045, .0038, .004, .002], eyewire, 6);
    art.ball([side * .12, y + .008, hinge], .007, "#c89a55", [.72, .9, .8]);
  }
  const bridge = [-.032, 0, .032].map((x): CharacterPoint => {
    const py = y + (x === 0 ? .016 : .006);
    return [x, py, front(x, py) + .013];
  });
  art.sweep(bridge, [.005, .0045, .005], eyewire, 7);
}

function addFeatures(art: Assembly, part: Resident, look: Portrait, scalp: Scalp, front: Front) {
  const tall = look.expression === "grin", elderly = part === "banker";
  const y = .153 * scalp.height, x = .076;
  const w = .026, h = (tall ? .039 : elderly ? .030 : .035) * scalp.height;
  for (const side of [-1, 1]) {
    const earY = .087 * scalp.height;
    const ear = createPortraitEar(look.skin, look.flush, .039, .050, .054, side);
    art.add(ear.rotateY(side * .21), null, [side * (scalp.radius(earY) - .003), earY, .007]);
    const eye = (px: number, py: number) => front(px, py) + .0035
      + .008 * tintWeight(px, py, side * x, y, w, h);
    const patch = (cx: number, cy: number, width: number, height: number, offset: number, tint: string) =>
      art.add(portraitPatch(cx, cy, width, height, (px, py) => eye(px, py) + offset, side * .002, 1, 0, 16, 3), tint);
    patch(side * x, y, w, h, 0, "#f9ead9");
    patch(side * x + .003, y - .001, w * .70, h * .93, .0016, "#402d24");
    patch(side * x - .003, y + h * .53, .0056, .0060, .003, "#fff4e5");
    const upperLid = Array.from({ length: 5 }, (_, i): CharacterPoint => {
      const a = Math.PI * i / 4, px = side * x + w * Math.cos(a), py = y + h * Math.sin(a);
      return [px, py, eye(px, py) + .0015];
    });
    art.sweep(upperLid, [.001, .0027, .0037, .0027, .001], INK, 6);
    const browY = (elderly ? .208 : .216) * scalp.height;
    const brow = [[-.027, -.003], [-.016, .006], [0, .009], [.017, .003], [.033, -.011]]
      .map(([dx, dy]): CharacterPoint => {
        const px = side * (x + dx), py = browY + dy + (side === 1 ? .003 : 0);
        return [px, py, front(px, py) + .004];
      });
    art.sweep(brow, [.002, .006, .0075, .005, .0015], elderly ? "#a29a97" : look.hair, 7);
    if (elderly) {
      art.add(portraitMoustache(side, .081, .041, 1.22, "#543d36", front), null);
      const fold = [[.103, .115], [.117, .112], [.132, .114]].map(([dx, dy]): CharacterPoint =>
        [side * dx, dy, front(side * dx, dy) + .0023]);
      art.sweep(fold, [.0008, .0021, .0008], "#bb8c79", 6);
    }
  }
  const lineY = elderly ? -.008 : .017;
  const smile = [-1, -.62, -.27, .12, .51, 1].map((u): CharacterPoint => {
    const px = u * (elderly ? .046 : .056), py = lineY + (tall ? .024 : .017) * u * u
      + (look.expression === "intent" ? .005 : .003) * u;
    return [px, py, front(px, py) + .004];
  });
  art.sweep(smile, [.0014, .0034, tall ? .006 : .0043, tall ? .006 : .0043, .0034, .0014], "#52312a", 6);
  if (tall) {
    art.add(portraitPatch(0, .028, .043, .012, (x, y) => front(x, y) + .0038, .002, 1.35, 0, 18, 3), "#682f29");
    art.add(portraitPatch(0, .022, .028, .0048, (x, y) => front(x, y) + .0048, .001, 1.25, 0, 16, 2), "#ba6952");
  }
  if (elderly) addGlasses(art, front);
  if (look.style === "cap") addCap(art, part);
}

/** A full sculpted head, merged into a single mesh for a room-scale portrait. */
export function createInteriorPortrait(part: Resident) {
  const profile = portraits[part];
  const base = createChanvrierScalp(profile.face, profile.nose);
  const scalp: Scalp = {
    ...base,
    relief(x, y, z) {
      const nose = tintWeight(x, y, 0, .092, .046, .04);
      return base.relief(x, y, z) + nose * .023 * smoothstep(z, .04, .13);
    },
  };
  const front = (x: number, y: number) => {
    const z = Math.sqrt(Math.max(0, scalp.radius(y) ** 2 - x * x)) * DEPTH;
    return scalp.relief(x, y / scalp.height, z);
  };
  const portrait = new THREE.Group();
  portrait.position.y = .092 * profile.scale;
  portrait.scale.setScalar(profile.scale);
  portrait.rotation.set(profile.pitch, part === "host" ? 0 : .48, 0, "YXZ");
  const art = new Assembly();
  art.add(skinVolume(scalp, profile), null);
  addHair(art, scalp, profile);
  addFeatures(art, part, profile, scalp, front);
  const mesh = art.finish(`${part}-interior-portrait`, portrait, characterMaterial());
  mesh.raycast = THREE.Mesh.prototype.raycast;
  return portrait;
}
