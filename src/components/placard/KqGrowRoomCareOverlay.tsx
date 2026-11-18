import { useId, useMemo } from "react";
import type { KqCareSector } from "@/lib/kanab-quest-care-spatial";
import { growRoomSectorCenter } from "@/lib/kanab-quest-grow-room-path";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { growRoomDeckHeight, roomSectorKey, type KqAffectedPlant, type KqGrowRoomZone } from "./KqGrowRoomModel";
import { projectedFootprint, projectRoomPoint, type GrowCamera } from "./KqGrowRoomProjection";
import styles from "./KqGrowRoom.module.css";

export function KqGrowRoomCareOverlay({ layout, zones, camera, scale, width, height, flat, affected, eligible, deposit, pending, depositKind = "pbi" }: {
  layout: WarehouseSpatialLayout; zones: readonly KqGrowRoomZone[]; camera: GrowCamera; scale: number; width: number; height: number;
  flat: boolean; affected?: readonly KqAffectedPlant[]; eligible?: readonly KqCareSector[]; deposit?: KqCareSector; pending?: KqCareSector; depositKind?: "pbi" | "input";
}) {
  const hatch = "pbi-hatch-" + useId().replace(/[^a-z0-9_-]/gi, "");
  const items = useMemo(() => new Map(layout.items.map(item => [item.id, item])), [layout]);
  const decks = useMemo(() => new Map(zones.map(zone => [zone.id, growRoomDeckHeight(zone) + .16])), [zones]);
  const position = (sector: KqCareSector) => {
    const center = growRoomSectorCenter(items.get(sector.zoneId), sector);
    return center && { ...center, y: flat ? 0 : decks.get(sector.zoneId) ?? 0 };
  };
  const markedCells = useMemo(() => {
    const marked = { pbi: new Map<string, KqCareSector>(), input: new Map<string, KqCareSector>() };
    for (const zone of zones) {
      for (const cell of zone.protectedSectors ?? []) marked.pbi.set(roomSectorKey(cell), cell);
      for (const cell of zone.inputSectors ?? []) marked.input.set(roomSectorKey(cell), cell);
    }
    if (deposit) marked[depositKind].set(roomSectorKey(deposit), deposit);
    if (pending) marked[depositKind].delete(roomSectorKey(pending));
    return marked;
  }, [zones, deposit, pending, depositKind]);
  return <g>
    {!!eligible?.length && <defs><pattern id={hatch} patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" fill="#ffe49f" fillOpacity=".28"/>
      <path d="m-2 2 4-4M0 8l8-8m-2 10 4-4" stroke="#ffedb6" strokeWidth="1.6"/>
    </pattern></defs>}
    {eligible?.map(sector => {
      const center = position(sector);
      if (!center) return null;
      const key = roomSectorKey(sector);
      return <polygon key={key} data-pbi-cell={key} style={{fill: "url(#" + hatch + ")"}} points={projectedFootprint({ ...center, width: 1, depth: 1 }, camera, scale, width, height, center.y)} />;
    })}
    {affected?.map(plant => {
      const center = position(plant);
      if (!center) return null;
      const x = center.x + (plant.slot % 2 ? .215 : -.215), z = center.z + (plant.slot < 2 ? -.215 : .215);
      const p = projectRoomPoint(x, center.y, z, camera, scale, width, height);
      const radius = Math.max(5, Math.min(15, scale * .18));
      const key = roomSectorKey(plant) + ":" + plant.slot;
      return <g key={key} data-affected-plant={key} transform={`translate(${p.x} ${p.y}) scale(${radius})`} className={styles.affectedPlant}>
        <circle r="1.15" fill="#fff4d7"/>
        <circle r="1" fill="#ffad56" stroke="#482e26" strokeWidth=".23"/>
        <path d="m-.42-.42.84.84m0-.84-.84.84" fill="none" stroke="#482e26" strokeWidth=".28" strokeLinecap="round"/>
      </g>;
    })}
    {(["pbi", "input"] as const).map(kind => Array.from(markedCells[kind], ([key, cell]) => {
      const parcel = position(cell);
      if (!parcel) return null;
      const drop = projectRoomPoint(parcel.x, parcel.y, parcel.z, camera, scale, width, height);
      const packet = kind === "pbi", latest = depositKind === kind && deposit && roomSectorKey(deposit) === key ? key : undefined;
      const stampScale = Math.max(.55, Math.min(1.8, scale * .025));
      const offset = markedCells.pbi.has(key) && markedCells.input.has(key) ? (packet ? -7 : 7) * stampScale : 0;
      return <g key={kind + key} data-pbi-covered={packet ? key : undefined} data-pbi-deposit={packet ? latest : undefined}
        data-input-applied={packet ? undefined : key} data-input-deposit={packet ? undefined : latest} className={styles.deposit}
        transform={`translate(${drop.x + offset} ${drop.y}) scale(${stampScale})`}>
        {packet ? <>
          <path d="m-7-11 14 1-1 14-13-1Z" fill="#fae4a6" stroke="#244b3d" strokeWidth="1.7" strokeLinejoin="round"/>
          <path d="m-6-8 12 1m-10 5 2 2 4-5" fill="none" stroke="#326a50" strokeWidth="1.8" strokeLinecap="round"/>
        </> : <>
          <circle r="8.5" cy="-3" fill="#fff3cf" stroke="#584331" strokeWidth="1.6"/>
          <path d="M-5 0 0-2 5 0M0-2v-3q-4 0-4-4 4 0 4 4 1-4 5-4-1 4-5 4" fill="#619478" stroke="#315e46" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="m-4 2 1 .4m4-.5 1 .3" stroke="#875e36" strokeWidth="1.6" strokeLinecap="round"/>
        </>}
      </g>;
    }))}
  </g>;
}
