import * as THREE from "three";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { RoomBatch, type Metal, type Point3, type RoomResources } from "./KqGrowRoomGeometry";
import { getGrowRoomShellRegistration, type ShellLandmark } from "./KqGrowRoomShellRegistration";

const PAINT = {
  resin: "#c6cdd0", panels: "#e6e2d3", seam: "#a7ada5", gasket: "#394849",
  turquoise: "#087d82", bracket: "#188d91", bright: "#bfd0ca", metal: "#899a99", black: "#354345",
  yellow: "#eca92e",
};
type Side = "north" | "south" | "west" | "east";
type Registration = ReturnType<typeof getGrowRoomShellRegistration>;

/** The wall plates in the overhead drawing are folded outwards. Mount
 * services at those measured floor coordinates, with local v facing inwards. */
function fixtureFace(a: RoomBatch, side: Side, cx: number, cz: number) {
  const horizontal = side === "north" || side === "south";
  const inward = side === "north" || side === "west" ? 1 : -1;
  function point(u: number, y: number, v: number): Point3 {
    return horizontal ? [cx + u, y, cz + inward * v] : [cx + inward * v, y, cz + u];
  }
  function panel(u: number, y: number, v: number, w: number, h: number, depth: number, color: string, material: Metal = "steel") {
    const [x, height, z] = point(u, y, v);
    a.box(material, color, x, height, z, horizontal ? w : depth, h, horizontal ? depth : w);
  }
  function bolt(u: number, y: number, v: number, r = .018) {
    a.rod("steel", PAINT.black, point(u, y, v), point(u, y, v + .014), r);
  }
  function rod(u1: number, y1: number, v1: number, u2: number, y2: number, v2: number, r: number, tint: string, material: Metal = "steel") {
    a.rod(material, tint, point(u1, y1, v1), point(u2, y2, v2), r);
  }
  return { panel, bolt, rod };
}

/** Background source: public/placard/warehouse-v4/overhead-room-renovated-v1.webp. */
export function makeGrowBuilding(res: RoomResources, layout: WarehouseSpatialLayout) {
  const s = getGrowRoomShellRegistration(layout), a = new RoomBatch(res);
  const { x, z, unitX, unitZ, slab, resin, wallHeight: h } = s;
  const { panels, seam, gasket, metal, bright } = PAINT;
  const px = (n: number) => n * unitX;
  const pz = (n: number) => n * unitZ;
  const floorBand = (x0: number, y0: number, x1: number, y1: number, top: number, color: string, material: Metal) => {
    const part = s.bounds(x0, y0, x1, y1);
    a.box(material, color, part.x, top - .022, part.z, part.width, .044, part.depth);
  };
  // One uninterrupted, lightly mottled cool resin pour, surrounded by the off-white service band.
  a.box("stone", "#9da5a2", slab.x, -.13, slab.z, slab.width, .23, slab.depth);
  floorBand(18, 12, 1006, 990, -.004, panels, "wall");
  floorBand(102, 110, 922, 892, .004, "#9ba5a4", "plastic");
  a.box("floor", PAINT.resin, resin.x, -.013, resin.z, resin.width, .040, resin.depth);
  for (const rawX of [167, 305, 473, 589, 747, 881]) {
    a.box("plastic", seam, x(rawX), -.001, z(75), .013, .003, pz(70));
    a.box("plastic", seam, x(rawX), -.001, z(922), .013, .003, pz(61));
  }
  for (const rawZ of [295, 425, 568, 658, 840]) {
    a.box("plastic", seam, x(74), -.001, z(rawZ), px(56), .003, .013);
    a.box("plastic", seam, x(952), -.001, z(rawZ), px(56), .003, .013);
  }
  walls(a, s);
  // Galvanised duct at the rear. Rolled collars and elbow segments follow its curved route.
  const radius = Math.min(.31, pz(12));
  const ductY = h - .41;
  function duct(path: Point3[]) {
    for (let i = 1; i < path.length; i++) {
      const start = new THREE.Vector3(...path[i - 1]), end = new THREE.Vector3(...path[i]);
      const delta = end.clone().sub(start), length = delta.length();
      a.rod("steel", "#b0bcb9", path[i - 1], path[i], radius);
      const count = Math.max(1, Math.ceil(length / .70));
      for (let j = 0; j < count; j++) {
        const at = start.clone().addScaledVector(delta, (j + .45) / count);
        const step = delta.clone().normalize().multiplyScalar(.018);
        a.rod("steel", metal, at.clone().sub(step).toArray() as Point3, at.clone().add(step).toArray() as Point3, radius * 1.055);
      }
    }
  }
  duct([[x(93), h - .95, z(97)], [x(87), h - .71, z(83)], [x(74), ductY, z(56)], [x(346), ductY, z(56)], [x(383), ductY - .07, z(67)]]);
  duct([[x(469), ductY - .07, z(67)], [x(539), ductY - .07, z(67)], [x(563), ductY, z(58)], [x(568), ductY, z(34)]]);
  duct([[x(946), ductY, z(52)], [x(931), h - .60, z(77)], [x(911), h - .92, z(96)]]);
  const vent = s.landmark("north-extractor");
  const vf = fixtureFace(a, "north", vent.x, vent.z);
  const vw = px(95), vh = .63;
  vf.panel(0, ductY - .06, 0, vw, vh, .31, metal);
  vf.panel(0, ductY - .055, .17, vw * .84, vh * .73, .035, gasket, "plastic");
  for (let i = 0; i < 7; i++) vf.panel(0, ductY - .26 + i * .061, .202, vw * .77, .026, .045, "#8a9c9b");
  for (const u of [-1, 1]) for (const v of [-1, 1]) vf.bolt(u * vw * .455, ductY - .055 + v * vh * .42, .163);
  switchboard(a, "north", s.landmark("north-power"), px(72), h - .63, .81);
  switchboard(a, "west", s.landmark("west-power"), Math.min(.82, pz(92)), 1.37, .99);
  for (const id of ["north-light-west", "north-light-east"] as const) {
    const pt = s.landmark(id), f = fixtureFace(a, "north", pt.x, pt.z);
    const w = px(129), py = h - .58;
    for (const u of [-1, 1]) f.rod(u * w * .40, py + .09, -.035, u * w * .40, py + .40, z(38) - pt.z, .026, gasket);
    f.panel(0, py + .027, 0, w, .145, .21, gasket);
    f.panel(0, py + .045, .04, w * .98, .096, .22, bright);
    f.panel(0, py - .013, .15, w * .93, .071, .045, "#fff3c8", "light");
    f.panel(0, py - .062, .03, w * .90, .014, .155, "#f6e7bc", "light");
  }
  sideServices(a, s, "west");
  sideServices(a, s, "east");
  southDoor(a, s);
  const group = a.finish();
  group.name = "renovated-warehouse-shell";
  for (const child of group.children) {
    if (child instanceof THREE.Mesh && child.material === res.materials.jar) child.castShadow = false;
  }
  for (const id of s.landmarks) {
    const plane = s.landmark(id);
    const locator = new THREE.Object3D();
    locator.name = id;
    locator.position.set(plane.x, 0, plane.z);
    group.add(locator);
  }
  return group;
}

function walls(a: RoomBatch, s: Registration) {
  const { x, z, wallHeight: h } = s;
  const { panels, turquoise, bracket, seam, gasket, metal } = PAINT;
  const north = z(36), south = z(949), west = x(37), east = x(986);
  const width = east - west, depth = south - north;
  // The east and south sides are sectioned below eye level to keep the foreground readable.
  a.box("wall", panels, (west + east) / 2, h / 2, north, width, h, .15);
  a.box("wall", "#dbdaca", west, h / 2, (north + south) / 2, .15, h, depth);
  a.box("wall", panels, east, .13, (north + south) / 2, .15, .26, depth);
  for (const [edge, limit] of [[west, x(412)], [x(614), east]]) {
    a.box("wall", panels, (edge + limit) / 2, .14, south, limit - edge, .28, .15);
    a.box("steel", turquoise, (edge + limit) / 2, .30, south, limit - edge + .02, .085, .19);
  }
  a.box("steel", turquoise, east, .29, (north + south) / 2, .19, .086, depth);
  for (const [y, height, tint] of [[.09, .12, "#536f70"], [h - .12, .19, turquoise]] as const) {
    a.box("steel", tint, (west + east) / 2, y, north + .02, width, height, .20);
    a.box("steel", tint, west + .02, y, (north + south) / 2, .20, height, depth);
  }
  for (const rx of [38, 312, 506, 711, 986]) {
    const f = fixtureFace(a, "north", x(rx), north), w = Math.min(.39, 17 * s.unitX);
    f.panel(0, h / 2, .075, w, h + .055, .19, turquoise);
    for (const y of [.17, h - .19]) {
      f.panel(0, y, .16, w * 1.50, .26, .12, bracket);
      for (const side of [-1, 1]) f.bolt(w * .46 * side, y, .229, .021);
    }
  }
  for (const side of ["west", "east"] as const) {
    const high = side === "west";
    const sideX = high ? west : east;
    for (const rz of [36, 216, 458, 625, 810, 949]) {
      const height = high ? h : .35, f = fixtureFace(a, side, sideX, z(rz));
      f.panel(0, height / 2, .05, .16, height + .04, .16, turquoise);
      f.panel(0, height - .10, .13, .31, .20, .09, bracket);
      for (const dz of [-.09, .09]) f.bolt(dz, height - .09, .179, .018);
    }
  }
  for (const rx of [142, 271, 380, 588, 691, 752, 880]) {
    a.box("plastic", seam, x(rx), h / 2, north + .078, .012, h - .22, .009);
  }
  for (const rz of [145, 295, 425, 568, 660, 843]) {
    a.box("plastic", seam, west + .079, h / 2, z(rz), .009, h - .22, .011);
  }
  for (const rx of [37, 275, 391, 631, 751, 986]) {
    const f = fixtureFace(a, "south", x(rx), south);
    f.panel(0, .21, .035, .24, .42, .23, turquoise);
    f.panel(0, .32, .15, .29, .18, .06, bracket);
    f.bolt(-.079, .32, .18); f.bolt(.079, .32, .18);
  }
  for (const [rawX, rawZ, dx, dz] of [[37, 36, 1, 1], [986, 36, -1, 1], [37, 949, 1, -1], [986, 949, -1, -1]]) {
    const top = rawZ === 36 && rawX === 37 ? h : .40;
    a.box("steel", bracket, x(rawX), top + .02, z(rawZ), Math.min(.55, 35*s.unitX), .075, Math.min(.55, 38*s.unitZ));
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      const xx = x(rawX) + sx * Math.min(.18, 10*s.unitX), zz = z(rawZ) + sz * Math.min(.18, 12*s.unitZ);
      a.rod("steel", gasket, [xx,top+.057,zz], [xx,top+.068,zz], .018);
    }
    a.rod("steel", turquoise, [x(rawX + 10*dx),.075,z(rawZ + 46*dz)], [x(rawX + 46*dx),.075,z(rawZ + 10*dz)], .064);
  }
  const railY = .17;
  for (const [from, to] of [[64, 393], [630, 955]]) {
    a.rod("steel", metal, [x(from), railY, south + .105], [x(to), railY, south + .105], .042);
    a.rod("plastic", gasket, [x(from), railY - .07, south + .11], [x(to), railY - .07, south + .11], .019);
  }
}

function switchboard(a: RoomBatch, side: Side, at: {x: number; z: number}, width: number, y: number, height: number) {
  const f = fixtureFace(a, side, at.x, at.z);
  f.panel(0, y, 0, width, height, .23, PAINT.gasket);
  f.panel(0, y, .11, width * .95, height * .96, .09, "#adb7b2");
  f.panel(-width * .13, y, .166, width * .59, height * .88, .048, "#c6cbc0");
  f.panel(width * .20, y + height * .12, .174, .115, .17, .029, "#293e3b", "plastic");
  f.panel(width * .20, y + height * .12, .194, .061, .061, .012, "#86b492", "plastic");
  f.panel(width * .20, y - height * .17, .178, .085, .085, .025, "#ac6147", "plastic");
  for (const u of [-1, 1]) for (const v of [-1, 1]) f.bolt(u * width * .44, y + v * height * .40, .167, .013);
}

function sideServices(a: RoomBatch, s: Registration, side: "west" | "east") {
  const { x, z } = s, west = side === "west", rawX = west ? 79 : 948;
  const xx = x(rawX), yy = 1.62;
  a.rod("steel", PAINT.metal, [xx, yy, z(95)], [xx, yy, z(887)], .047);
  if (!west) a.rod("plastic", "#995347", [xx - .064, yy - .06, z(259)], [xx - .064, yy - .06, z(840)], .020);
  for (const coordinate of [158, 264, 351, 420, 555, 681, 805, 849]) {
    const at = fixtureFace(a, side, xx, z(coordinate));
    at.panel(0, yy, 0, .092, .15, .14, PAINT.gasket);
    at.panel(0, yy, .07, .067, .12, .034, PAINT.bright);
    // Physical brackets return from the service gear to the actual side wall.
    const backing = west ? xx - x(37) : x(986) - xx;
    at.panel(0, yy - .036, -backing / 2, .045, .06, backing, PAINT.metal);
    if (!west && [264, 555, 849].includes(coordinate)) at.panel(0, yy/2, -backing, .073, yy, .065, PAINT.bracket);
  }
  const id: ShellLandmark = west ? "west-lamp" : "east-lamp";
  const p = s.landmark(id), f = fixtureFace(a, side, p.x, p.z);
  const y = 1.50;
  f.panel(0, y, -.03, .30, .46, .15, PAINT.gasket);
  f.panel(0, y, .075, .225, .375, .11, "#f7edba", "light");
  for (const u of [-.12, 0, .12]) f.rod(u, y - .205, .14, u, y + .205, .14, .012, PAINT.metal);
  for (const v of [-.14, .14]) f.panel(0, y + v, .147, .27, .018, .015, PAINT.metal);
}

function southDoor(a: RoomBatch, s: Registration) {
  const pt = s.landmark("south-door");
  const f = fixtureFace(a, "south", pt.x, pt.z);
  const width = (615 - 409) * s.unitX, doorHeight = Math.min(2.45, s.wallHeight - .22);
  f.panel(0, .022, .018, width, .040, .26, "#94a8a4");
  // Keep the double door legible in section: solid skirting and stiles enclose
  // the translucent upper panels, where the player can be seen entering.
  const stile = Math.min(.13, width * .037);
  f.panel(0, doorHeight + .032, -.035, width + 2 * stile, .105, .14, PAINT.turquoise);
  f.panel(0, doorHeight + .094, -.03, width + 2 * stile, .026, .16, PAINT.bright);
  f.panel(0, doorHeight / 2, -.079, stile * .80, doorHeight, .092, PAINT.turquoise);
  const windowW = Math.min(width * .23, 1.7), windowH = .43, windowY = doorHeight * .72;
  for (const sign of [-1, 1]) {
    const center = sign * width * .25, leaf = width * .485;
    f.panel(center, doorHeight / 2, -.032, leaf, doorHeight, .045, "#168d91", "jar");
    f.panel(center, .345, -.038, leaf - .025, .63, .092, PAINT.bracket);
    f.panel(center, .653, -.09, leaf - .027, .045, .038, PAINT.turquoise);
    f.panel(center, .102, -.09, leaf - .027, .085, .025, "#99aca9");
    f.panel(center, windowY, -.067, windowW, windowH, .035, "#8ebfc2", "jar");
    for (const k of [-1, 1]) {
      f.panel(center, windowY + k * windowH / 2, -.080, windowW + .027, .023, .020, PAINT.turquoise);
      f.panel(center + k * windowW / 2, windowY, -.080, .019, windowH, .020, PAINT.turquoise);
    }
    f.panel(sign * width * .055, .98, -.082, .049, .20, .044, PAINT.gasket);
    f.panel(sign * width * .50, doorHeight / 2, -.038, stile, doorHeight, .15, PAINT.turquoise);
    f.panel(sign * (width * .50 + stile * .60), doorHeight / 2, -.043, stile * .31, doorHeight, .16, PAINT.bright);
    const xx = pt.x + sign * width * .51;
    a.rod("steel", PAINT.yellow, [xx, .036, pt.z + .15], [xx, .65, pt.z + .15], .064);
    a.rod("plastic", PAINT.gasket, [xx, .07, pt.z + .15], [xx, .12, pt.z + .15], .070);
  }
}
