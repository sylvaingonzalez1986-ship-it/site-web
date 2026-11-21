import { useId } from "react";
import { KQ_WAREHOUSE_UNLIT_CODE, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import { getKqWarehouseZoneLightingLayout } from "@/lib/kanab-quest-warehouse-fixtures";

type Point = { x: number; y: number };
type Project = (x: number, elevation: number, y: number) => Point;
export type LightingZone = Pick<KqWarehouseZone, "id" | "x" | "y" | "width" | "height" | "rotation" | "lightingCode" | "active">;

const FLOOR_ELEVATION = .017;
const LAMP_ELEVATION = 1.78;

export function getRoomLightingRows(zone: LightingZone) {
  if (zone.lightingCode === KQ_WAREHOUSE_UNLIT_CODE) return [];
  const turned = zone.rotation === 90 || zone.rotation === 270;
  const halfWidth = turned ? .11 : .22, halfDepth = turned ? .22 : .11;
  const world = (x: number, z: number): Point => ({ x: zone.x + x, y: zone.y + z });
  return getKqWarehouseZoneLightingLayout(zone).map((lamp, index) => {
    const { left, top, width, depth, row } = lamp;
    const center = world(lamp.x, lamp.z);
    const footprint = [world(left, top), world(left + width, top), world(left + width, top + depth), world(left, top + depth)];
    const rim = [world(lamp.x - halfWidth, lamp.z - halfDepth), world(lamp.x + halfWidth, lamp.z - halfDepth),
      world(lamp.x + halfWidth, lamp.z + halfDepth), world(lamp.x - halfWidth, lamp.z + halfDepth)];
    return { center, footprint, rim, row, index, area: width * depth };
  });
}

type Lamp = ReturnType<typeof getRoomLightingRows>[number];
const svgPoints = (points: Point[]) => points.map(point => `${point.x},${point.y}`).join(" ");
const PATH_BATCH_THRESHOLD = 80;

export function RoomLightingOverlay({ zoneId, lamps, state, showCoverage, flat, project, zoom, lightingIndex, working }: {
  zoneId: string; lamps: Lamp[]; state: "lit" | "paused" | "unlit" | "preview";
  showCoverage: boolean; flat: boolean; project: Project; zoom: number; lightingIndex?: number; working?: boolean;
}) {
  const gradientId = useId();
  const rows = new Map<number, Lamp[]>();
  for (const lamp of lamps) {
    const row = rows.get(lamp.row);
    if (row) row.push(lamp);
    else rows.set(lamp.row, [lamp]);
  }
  const batched = lamps.length > PATH_BATCH_THRESHOLD && zoom < 2;
  const polygons = (vertices: Point[], height: number) => vertices.map(point => project(point.x, height, point.y));
  const path = (vertices: Point[], height: number) => `M${svgPoints(polygons(vertices, height)).replaceAll(" ", "L")}Z`;
  const drawBodies = flat || state === "preview";
  return <g data-lighting-zone={zoneId} data-lighting-state={state} data-lighting-count={lamps.length}
    data-lighting-working={working || undefined} data-lighting-resting={flat && !working && !showCoverage || undefined}>
    {showCoverage && <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#fff1b6" stopOpacity=".76" /><stop offset="1" stopColor="#f6c65f" stopOpacity=".14" />
    </linearGradient></defs>}
    {[...rows].map(([row, entries]) => <g key={row} data-lighting-row={row}>
      {showCoverage && batched && <path data-lighting-footprint data-lighting-batch={entries.length}
        d={entries.filter(lamp => lamp.index !== lightingIndex).map(lamp => path(lamp.footprint, FLOOR_ELEVATION)).join("")} />}
      {drawBodies && batched && <path data-lighting-body data-lighting-batch={entries.length}
        d={entries.map(lamp => path(lamp.rim, LAMP_ELEVATION)).join("")} />}
      {(showCoverage || drawBodies && !batched) && entries.map((lamp, index) => {
        const focused = lamp.index === lightingIndex;
        if (batched && !focused && index !== Math.floor(entries.length / 2)) return null;
        const floor = polygons(lamp.footprint, FLOOR_ELEVATION);
        const rim = polygons(lamp.rim, LAMP_ELEVATION);
        const widest = (points: Point[]) => [...points].sort((a, b) => a.x - b.x);
        const baseEdges = widest(floor), lampEdges = widest(rim);
        const center = projectLightingHit(lamp, project);
        return <g key={lamp.index} data-lighting-lamp={lamp.index} data-lighting-focused={focused || undefined}
          data-lighting-center-x={center.x} data-lighting-center-y={center.y}>
          {showCoverage && (!batched || focused) && <polygon data-lighting-footprint data-lighting-index={lamp.index} data-lighting-area={lamp.area} points={svgPoints(floor)} />}
          {showCoverage && state !== "paused" && (lightingIndex === undefined || focused) &&
            <polygon data-lighting-beam data-lighting-index={lamp.index} style={{ fill: `url(#${gradientId})` }} points={svgPoints([lampEdges[0], lampEdges.at(-1)!, baseEdges.at(-1)!, baseEdges[0]])} />}
          {drawBodies && !batched && <polygon data-lighting-body points={svgPoints(rim)} />}
        </g>;
      })}
    </g>)}
  </g>;
}

export function projectLightingHit(lamp: Lamp, project: Project) {
  return project(lamp.center.x, LAMP_ELEVATION, lamp.center.y);
}

export function findLightingAt(rows: readonly { zone: Pick<LightingZone, "id">; lamps: Lamp[] }[], point: Point, project: Project, radius: number) {
  let closest: { zoneId: string; index: number } | undefined;
  let distance = radius;
  for (const { zone, lamps } of rows) for (const lamp of lamps) {
    const center = projectLightingHit(lamp, project);
    const candidate = Math.hypot(point.x - center.x, point.y - center.y);
    if (candidate >= distance) continue;
    distance = candidate;
    closest = { zoneId: zone.id, index: lamp.index };
  }
  return closest;
}
