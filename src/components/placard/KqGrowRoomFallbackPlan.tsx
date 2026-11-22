import { useId, useMemo } from "react";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import { GROW_ROOM_VISITOR } from "./kq-grow-worker-profile";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createGrowRoomPaths, type GrowPoint } from "@/lib/kanab-quest-grow-room-path";
import styles from "./KqGrowRoom.module.css";
import type { KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getKqWarehousePartitionBounds } from "@/lib/kanab-quest-warehouse";
import { KQ_WAREHOUSE_ROOM_ARTWORK } from "@/lib/kanab-quest-warehouse-artwork";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { getKqZonePalette } from "@/lib/kanab-quest-zone-identity";
import { KqWarehousePlanFixtures, SceneDefinitions } from "./KqWarehousePlanArt";
import { plantStage, type KqGrowRoomEvent, type KqGrowRoomZone } from "./KqGrowRoomModel";
import { projectRoomPoint, type GrowCamera } from "./KqGrowRoomProjection";
import { getGrowRoomShellRegistration } from "./KqGrowRoomShellRegistration";

export default function KqGrowRoomFallbackPlan({ profile, position, targetId, event, plan, layout, zones, camera, scale, width, height }: {
  profile?: ChanvrierAvatarProfile | null; position?: (GrowPoint & { targetId: string | null }) | null;
  targetId?: string | null; event?: KqGrowRoomEvent | null;
  plan: KqWarehouseState; layout: WarehouseSpatialLayout; zones: readonly KqGrowRoomZone[];
  camera: GrowCamera; scale: number; width: number; height: number;
}) {
  const id = "projected-plan-" + useId().replace(/[^a-z0-9_-]/gi, "");
  const { frame } = getGrowRoomShellRegistration(layout);
  const grid = frame.grid;
  // Three points determine the affine map from original SVG units to the
  // orthographic floor, including the genuine border around the editable cells.
  const worldX = -grid.x / grid.cell - layout.width / 2;
  const worldZ = -grid.y / grid.cell - layout.depth / 2;
  const at = (dx: number, dz: number) => projectRoomPoint(worldX + dx / grid.cell, 0, worldZ + dz / grid.cell, camera, scale, width, height);
  const origin = at(0, 0), horizontal = at(1, 0), vertical = at(0, 1);
  const matrix = [horizontal.x - origin.x, horizontal.y - origin.y, vertical.x - origin.x, vertical.y - origin.y, origin.x, origin.y].join(" ");
  const stations = useMemo(() => {
    const occupied = new Set(zones.filter(zone => typeof plantStage(zone) === "number" && zone.stageIndex !== 5).map(zone => zone.id));
    return [...plan.zones, ...(plan.serviceZones ?? [])].map((zone, index) => (
      <KqWarehousePlanFixtures key={zone.id} id={id} grid={grid} zone={zone} tint={getKqZonePalette(index).tint} growing={occupied.has(zone.id)} showLighting={false} />
    ));
  }, [zones, plan, grid, id]);
  const paths = useMemo(() => createGrowRoomPaths(layout), [layout]);
  const location = useMemo(() => {
    const origin = position && paths.canWalk(position, position) ? position : layout.entry;
    if (!targetId || (origin === position && targetId === position?.targetId)) return origin;
    const receipt = event?.zoneId === targetId ? event : null;
    const route = receipt?.gesture === "sweep" ? paths.sweep(origin) : paths.route(origin, targetId, receipt?.target);
    return route?.points.at(-1) ?? origin;
  }, [event, layout.entry, paths, position, targetId]);
  const foot = projectRoomPoint(location.x, 0, location.z, camera, scale, width, height);
  const top = projectRoomPoint(location.x, 1.9, location.z, camera, scale, width, height);
  const spriteHeight = foot.y - top.y;
  return <><g data-grow-fallback-plan="" transform={`matrix(${matrix})`} pointerEvents="none">
    <SceneDefinitions id={id} grid={grid} />
    <image data-warehouse-room-artwork="" href={KQ_WAREHOUSE_ROOM_ARTWORK} width={frame.width} height={frame.height} preserveAspectRatio="none" />
    {stations}
    {plan.partitions?.map(partition => {
      const wall = getKqWarehousePartitionBounds(partition, grid);
      return <rect key={partition.id} data-plan-partition={partition.id}
        x={grid.x + (wall.x + grid.columns / 2 - wall.width / 2) * grid.cell} y={grid.y + (wall.z + grid.rows / 2 - wall.depth / 2) * grid.cell}
        width={wall.width * grid.cell} height={wall.depth * grid.cell} fill="#ebe9d3" stroke="#5f6254" strokeWidth=".8" />;
    })}
  </g><foreignObject data-grow-fallback-actor={profile ? "player" : "visitor"} pointerEvents="none"
    x={foot.x - spriteHeight / 2} y={top.y} width={spriteHeight} height={spriteHeight}>
    <ChanvrierAvatar profile={profile ?? GROW_ROOM_VISITOR} label={profile ? undefined : "Visiteur de la serre"} className={styles.fallbackFigure} />
  </foreignObject></>;
}
