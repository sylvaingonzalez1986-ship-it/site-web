import * as THREE from "three";
import { getKqWarehouseLocalSize, getKqWarehouseOrientation, type WarehouseSpatialItem } from "@/lib/kanab-quest-warehouse-spatial";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqZonePalette } from "@/lib/kanab-quest-zone-identity";
import { RoomBatch, type RoomResources } from "./KqGrowRoomGeometry";
import { type KqGrowRoomZone } from "./KqGrowRoomModel";
import { cultivation } from "./KqGrowRoomCultivation";
export { makeGrowBuilding } from "./KqGrowRoomShell";

const timber = "#aa733a", edge = "#45362a", teal = "#007f82", clasp = "#e3ad42";

// The plan's drying icon is a rectangular mesh tray with timber rails and teal corner shoes.
function dryingRack(a: RoomBatch, code: string | undefined, filled: boolean, distant: boolean) {
  const top = 1.08, w = .82, d = .68;
  for (const x of [-w / 2, w / 2]) {
    for (const z of [-d / 2, d / 2]) {
      a.box("wood", timber, x, top / 2, z, .053, top, .053);
      a.box("steel", teal, x, top + .034, z, .093, .09, .093);
    }
  }
  const levels = code === "SIM-DRYING-03" ? [.25, .51, .78, top] : code === "SJ-DRYIT90" ? [.47, top] : [.29, .69, top];
  for (const y of distant ? [levels[0], top] : levels) {
    a.box("net", "#423c32", 0, y, 0, w, .016, d);
    for (const z of [-d / 2, d / 2])
      a.box("wood", timber, 0, y + .01, z, w, .058, .055, y === top && z > 0 ? "service-drying" : undefined);
    for (const x of [-w / 2, w / 2])
      a.box("wood", "#be9056", x, y + .01, 0, .045, .057, d);
    if (filled)
      for (const x of [-.24, 0, .24])
        a.part("cola", "flower", "#977941", [x, y + .027, .04], [.11, .21, .11], [1.4, x, .2]);
  }
  for (const z of [-.19, .19]) a.box("wood", edge, 0, top + .012, z, w, .026, .027);
  // The back stops the trays. Each tray slides out on the opposite, open face.
  a.box("wood", "#9b7041", 0, top - .10, -d / 2, w - .02, .21, .045);
  for (const y of [levels[0], top]) {
    a.box("wood", "#c69961", 0, y - .045, d / 2 + .012, w * .91, .106, .052);
    for (const x of [-.13, .13]) a.box("steel", teal, x, y - .045, d / 2 + .063, .043, .058, .085);
    a.box("steel", "#324c4b", 0, y - .041, d / 2 + .106, .30, .037, .042);
  }
  a.shadow(0, 0, 1, .90);
}

function drum(a: RoomBatch, x: number, z: number, distant: boolean) {
  const size = .395;
  a.part("drum", "plastic", "#008b90", [x, .375, z], [size, .72, size], undefined, "service-drum");
  a.part("tube", "plastic", "#14545b", [x, .741, z], [size * 1.04, .055, size * 1.04]);
  a.part("tube", "plastic", "#00999c", [x, .774, z], [size * .91, .023, size * .91]);
  for (const sign of [-1, 1]) {
    a.box("steel", clasp, x + sign * size * .46, .753, z, .055, .066, .064);
    a.box("steel", clasp, x, .753, z + sign * size * .46, .064, .066, .055);
  }
  if (!distant) for (const y of [.17, .56]) a.part("ring", "plastic", "#10666b", [x, y, z], [size, .55, size]);
  a.box("plastic", "#ecce82", x, .53, z + size * .46, .11, .085, .015);
}

function jarCase(a: RoomBatch, x: number, z: number, filled: boolean, distant: boolean) {
  const w = .435, d = .40;
  a.box("wood", edge, x, .05, z, w, .09, d, "service-case");
  for (const side of [-1, 1]) {
    a.box("wood", timber, x + side * w / 2, .125, z, .023, .195, d);
  }
  a.box("wood", "#bd8b4a", x, .191, z - d / 2, w, .27, .031);
  a.box("wood", "#caa468", x, .114, z + d / 2, w, .156, .031);
  a.box("wood", edge, x, .135, z + d / 2 + .016, .115, .038, .014);
  for (const dx of [-.132, 0, .132]) for (const dz of [-.095, .095]) {
    const px = x + dx, pz = z + dz;
    if (!distant) {
      a.part("drum", "jar", "#a8d9c4", [px, .181, pz], [.12, .18, .12]);
      if (filled) a.part("oval", "plastic", "#678441", [px, .152, pz], [.092, .111, .091]);
    }
    a.part("tube", "steel", "#e4b34e", [px, .28, pz], [.113, .032, .113]);
  }
}

function storageShelf(a: RoomBatch, filled: boolean, distant: boolean) {
  const w = .84, d = .62;
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) {
    a.box("wood", timber, x, .70, z, .063, 1.4, .063);
    a.box("steel", teal, x, 1.41, z, .09, .085, .09);
  }
  for (const y of distant ? [.24, 1.15] : [.21, .68, 1.15]) {
    a.box("wood", edge, 0, y, 0, w, .055, d, y === 1.15 ? "service-shelf" : undefined);
    a.box("wood", "#b68149", 0, y + .12, -d / 2, w, .235, .033);
    for (const x of [-.275, 0, .275]) for (const z of [-.152, .152]) {
      a.box("wood", "#dfbc85", x, y + .13, z, .251, .208, .274);
      if (z > 0) a.box("wood", edge, x, y + .18, z + .142, .093, .038, .012);
      if (!distant) a.box("wood", filled ? "#a57a40" : "#c19658", x, y + .237, z - .10, .071, .008, .060);
    }
  }
  a.shadow(0, 0, 1, .89);
}

function storageCell(a: RoomBatch, code: string | undefined, filled: boolean, distant: boolean) {
  const layout = code && getKqWarehouseDevice(code)?.zoneLayout;
  if (!layout || layout.art === "shelf") { storageShelf(a, filled, distant); return; }
  const columns = Math.ceil(Math.sqrt(layout.unitsPerM2)), rows = Math.ceil(layout.unitsPerM2 / columns);
  for (let i = 0; i < layout.unitsPerM2; i++) {
    const x = (i % columns + .5) / columns - .5, z = (Math.floor(i / columns) + .5) / rows - .5;
    if (layout.art === "drum") drum(a, x, z, distant);
    else jarCase(a, x, z, filled, distant);
  }
  a.shadow(0, 0, 1.02, 1.02);
}

function zoneMarking(a: RoomBatch, width: number, depth: number, index: number) {
  const palette = getKqZonePalette(index), stroke = .058;
  a.box("stone", palette.tint, 0, .006, 0, width - .012, .012, depth - .012);
  for (const sign of [-1, 1]) {
    a.box("plastic", palette.color, 0, .015, sign * (depth - stroke) / 2, width, .009, stroke);
    a.box("plastic", palette.color, sign * (width - stroke) / 2, .015, 0, stroke, .009, depth - stroke * 2);
  }
}

export function makeGrowStation(res: RoomResources, item: WarehouseSpatialItem, zone: KqGrowRoomZone | undefined, budget: number, low: boolean, zoneIndex = 0) {
  const a = new RoomBatch(res);
  const { width: w, depth: d } = getKqWarehouseLocalSize(item.width, item.depth, item.rotation);
  if (item.kind !== "partition") zoneMarking(a, w, d, zoneIndex);
  if (item.kind === "partition") {
    // The low cutaway follows the entire saved wall, including its end posts.
    a.box("steel", "#404f4e", 0, .31, 0, w, .62, d);
    a.box("wall", "#f5e8ca", 0, .32, 0, w - .04, .56, d + .006);
    a.box("plastic", "#f6eace", 0, .632, 0, w, .028, d);
    for (const x of [-w * .49, w * .49])
      a.box("steel", "#5d706d", x, .323, 0, .034, .65, d + .015);
  } else if (item.kind === "culture" && zone) {
    cultivation(a, w, d, zone, low, budget);
    if (zone.attention || zone.effects?.length) {
      a.at(0, 0);
      const x = w * .40, z = d * .43;
      a.rod("wood", "#826a4a", [x, .08, z], [x, .52, z], .014);
      a.box("plastic", zone.attention ? "#dab344" : "#3e8571", x, .49, z, .16, .115, .022);
      a.box("plastic", "#37483b", x, .495, z + .014, .019, .061, .008);
    }
  } else if (item.kind === "drying" || item.kind === "storage") {
    const distant = low || w * d > 24;
    const filled = zone?.contentState === "occupied";
    for (let row = 0; row < d; row++) for (let col = 0; col < w; col++) {
      a.at(col + .5 - w / 2, row + .5 - d / 2);
      if (item.kind === "drying") dryingRack(a, item.deviceCode, filled, distant);
      else storageCell(a, item.deviceCode, filled, distant);
    }
  }
  const group = a.finish();
  group.name = item.id;
  group.position.set(item.x, 0, item.z);
  group.rotation.y = getKqWarehouseOrientation(item.rotation).yaw;
  group.userData.stationId = item.id;
  return group;
}
export function releaseStation(group: THREE.Group) { group.traverse(obj => { if (obj instanceof THREE.InstancedMesh)
  obj.dispose(); }); group.removeFromParent(); }
