import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { KQ_WAREHOUSE_UNLIT_CODE, type KqWarehouseState, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import { KQ_WAREHOUSE_ROOM_ARTWORK } from "@/lib/kanab-quest-warehouse-artwork";
import { createGrowRoomPaths, type GrowPoint } from "@/lib/kanab-quest-grow-room-path";
import { getKqWarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import KqGrowRoomFallbackPlan from "./KqGrowRoomFallbackPlan";
import { KqGrowRoomCareOverlay } from "./KqGrowRoomCareOverlay";
import { KqGrowRoom } from "./KqGrowRoom";
import { projectRoomPoint } from "./KqGrowRoomProjection";
import { getGrowRoomShellRegistration } from "./KqGrowRoomShellRegistration";
import { KqWarehousePlanFixtures } from "./KqWarehousePlanArt";

it("keeps the support sprite without fixtures and stops painting legacy fans in shared air mode", () => {
  const lit: KqWarehouseZone = { id: "bed", name: "Nord", x: 0, y: 0, width: 1, height: 1,
    active: true, lightingCode: "MH-TS1000", airCode: "SIM-AIR-01", optionCodes: ["SIM-SUBSTRATE-01"] };
  const render = (zone: KqWarehouseZone, sharedAir: boolean) => renderToStaticMarkup(createElement("svg", {},
    createElement(KqWarehousePlanFixtures, { zone, sharedAir, id: "plan", tint: "#adede0", growing: false,
      grid: { x: 0, y: 0, cell: 30, columns: 10, rows: 10 } })));
  const unlit = render({ ...lit, active: false, lightingCode: KQ_WAREHOUSE_UNLIT_CODE }, false);
  expect(unlit).toContain('data-warehouse-module="SIM-SUBSTRATE-01"');
  expect(unlit).not.toContain("data-plan-fixture=");
  expect(render(lit, true)).toContain('data-plan-fixture="lighting"');
  expect(render(lit, true)).not.toContain('data-plan-fixture="air"');
  expect(render(lit, false)).toContain('data-plan-fixture="air"');
});

it("counts and marks a pot once while preserving each distinct problem name", () => {
  const plan: KqWarehouseState = { version: 1, floor: { columns: 10, rows: 10 }, equipment: [], preparedAreaM2: 0,
    zones: [{ id: "bed", name: "Nord", x: 0, y: 0, width: 2, height: 1, active: true, lightingCode: "MH-TS1000", airCode: "SIM-AIR-01" }] };
  const sector = { zoneId: "bed", x: 1, y: 0 };
  const pot = { ...sector, slot: 2 as const };
  const html = renderToStaticMarkup(createElement(KqGrowRoom, { plan, zones: [{ id: "bed", name: "Nord" }],
    affectedPlants: [{...pot}, {...pot, label: "Pucerons"}, {...pot, label: "Pucerons"}, {...pot, label: "Thrips"}],
    pbiTargeting: { eligible: [sector], onSelect: () => {} },
  }));
  expect(html.match(/data-affected-plant=/g)).toHaveLength(1);
  expect(html).toContain("Pucerons, Thrips");
  expect(html).toContain('Nord · 2, 1 · 1 plante atteinte');
});

it.each([true, false])("pins the same eligible cell, affected pots and delivered packet to the rotated bed with flat=%s", flat => {
  const layout = { version: 1 as const, width: 10, depth: 10, entry: { x: 0, z: 5.7 }, items: [{
    id: "bed", name: "Semis", x: -1, z: -2, width: 3, depth: 2, rotation: 90 as const, kind: "culture" as const,
  }] };
  const eligible = [{ zoneId: "bed", x: 2, y: 1 }], camera = { x: 0, z: 0, zoom: 1 };
  const affected = ([0, 1, 2, 3] as const).map(slot => ({...eligible[0], slot}));
  const view = { layout, zones: [{ id: "bed", name: "Semis", supportCode: "SIM-SUBSTRATE-02" }], camera, scale: 30, width: 640, height: 360, flat, eligible, affected };
  const render = (deposit?: typeof eligible[number]) => renderToStaticMarkup(createElement("svg", {}, createElement(KqGrowRoomCareOverlay, { ...view, deposit })));
  const html = render();
  expect(html).toContain('data-pbi-cell="bed:2:1"');
  expect(html).not.toContain("data-pbi-deposit");
  for (const plant of affected) {
    const x = plant.slot % 2 ? .215 : -.215;
    const z = -1.5 + (plant.slot < 2 ? -.215 : .215);
    const point = projectRoomPoint(x, flat ? 0 : .27 + .16, z, camera, 30, 640, 360);
    expect(html).toContain(`data-affected-plant="bed:2:1:${plant.slot}" transform="translate(${point.x} ${point.y})`);
  }
  expect(render(eligible[0])).toContain('data-pbi-deposit="bed:2:1"');
  expect(render({zoneId:"bed", x:3, y:1})).not.toContain("data-pbi-deposit");
  const applied = (pending: boolean) => renderToStaticMarkup(createElement("svg", {}, createElement(KqGrowRoomCareOverlay, {
    ...view, zones: [{ ...view.zones[0], protectedSectors: eligible, inputSectors: eligible }],
    depositKind: "input", ...(pending ? { pending: eligible[0] } : { deposit: eligible[0] }),
  })));
  expect(applied(true)).toContain('data-pbi-covered="bed:2:1"');
  expect(applied(true)).not.toContain("data-input-applied");
  expect(applied(false)).toContain('data-input-deposit="bed:2:1"');
  expect(applied(false)).not.toContain("data-pbi-deposit");
});

it("places the fallback avatar along a reachable aisle and preserves its feet on context loss", () => {
  const plan: KqWarehouseState = { version: 1, floor: { columns: 10, rows: 10 }, equipment: [], preparedAreaM2: 0,
    zones: [{ id: "bed", name: "Semis", x: 2, y: 2, width: 2, height: 1, active: true, lightingCode: "MH-TS1000", airCode: "SIM-AIR-01" }] };
  const layout = getKqWarehouseSpatialLayout(plan);
  const camera = { x: 0, z: 0, zoom: 1 };
  const profile = { gender: "female", skin: "brown", clothing: "berry" } as const;
  const render = (targetId: string, position?: GrowPoint & { targetId: string }) => renderToStaticMarkup(createElement("svg", {},
    createElement(KqGrowRoomFallbackPlan, { plan, layout, zones: [], camera, scale: 18, width: 320, height: 300,
      position, targetId, profile: position ? profile : null })));
  const atFeet = (p: GrowPoint) => {
    const foot = projectRoomPoint(p.x, 0, p.z, camera, 18, 320, 300);
    const top = projectRoomPoint(p.x, 1.9, p.z, camera, 18, 320, 300);
    return `x="${foot.x - (foot.y - top.y) / 2}" y="${top.y}"`;
  };
  const spot = createGrowRoomPaths(layout).route(layout.entry, "bed")!.points.at(-1)!;
  const cold = render("bed");
  expect(spot).not.toEqual(layout.entry);
  expect(cold).toContain('data-grow-fallback-actor="visitor"');
  expect(cold).toContain(atFeet(spot));
  expect(render("missing")).toContain(atFeet(layout.entry));
  const interrupted = { x: 0, z: 2.75, targetId: "bed" };
  const lost = render("bed", interrupted);
  expect(lost).toContain('data-grow-fallback-actor="player"');
  expect(lost).toContain(atFeet(interrupted));
});

it.each([false, true])("registers plan sprites and partitions to the camera with historical floor = %s", historical => {
  const length = historical ? 40 : 10;
  const plan: KqWarehouseState = {
    version: 1, floor: historical ? undefined : { columns: 10, rows: 10 },
    zones: [{ id: "bed", name: "Semis", x: 1, y: 1, width: 2, height: 3, rotation: 270, active: true, lightingCode: "MH-TS1000", airCode: "SIM-AIR-01" }],
    serviceZones: [{ id: "jars", kind: "storage", name: "Bocaux", x: 0, y: 6, width: length, height: 1, deviceCode: "LP-SUPER-1L", rotation: 90 }],
    partitions: [{ id: "wall", axis: "y", x: 4, y: 0, length: 3 }], equipment: [], preparedAreaM2: 0,
  };
  const layout = getKqWarehouseSpatialLayout(plan);
  const { grid } = getGrowRoomShellRegistration(layout).frame;
  const camera = { x: 1.4, z: -.3, zoom: 2 };
  const html = renderToStaticMarkup(createElement("svg", {}, createElement(KqGrowRoomFallbackPlan, {
    plan, layout, zones: [{ id: "bed", name: "Semis", stageIndex: 1, status: "growing" }], camera, scale: 22, width: 640, height: 360,
  })));
  expect(html).toContain(KQ_WAREHOUSE_ROOM_ARTWORK);
  expect(html).toContain('data-plan-fixtures="bed"');
  expect(html).toContain('data-culture-running="true"');
  expect(html).toContain('data-plan-partition="wall"');
  expect(html).toContain('data-plan-fixtures="jars"');
  expect(html).toContain('rotate(-90)');
  expect(html).toContain(`data-equipment-count="${length * 4}"`);
  const [a,b,c,d,e,f] = /data-grow-fallback-plan="" transform="matrix\(([^)]+)\)/.exec(html)![1].split(" ").map(Number);
  for (const [column, row] of [[0,0],[grid.columns,0],[grid.columns,grid.rows],[0,grid.rows]]) {
    const sourceX = grid.x + column * grid.cell, sourceY = grid.y + row * grid.cell;
    const projected = projectRoomPoint(column - grid.columns / 2, 0, row - grid.rows / 2, camera, 22, 640, 360);
    expect(a * sourceX + c * sourceY + e).toBeCloseTo(projected.x, 7);
    expect(b * sourceX + d * sourceY + f).toBeCloseTo(projected.y, 7);
  }
});
