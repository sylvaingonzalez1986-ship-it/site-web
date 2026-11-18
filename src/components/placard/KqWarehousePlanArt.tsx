"use client";

import { useId } from "react";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseOption, type KqWarehouseOptionFamily } from "@/lib/kanab-quest-warehouse-options";
import { getKqWarehouseFixturePositions } from "@/lib/kanab-quest-warehouse-fixtures";
import { getKqWarehouseLocalSize, getKqWarehouseOrientation } from "@/lib/kanab-quest-warehouse-spatial";
import type { KqWarehouseZone, KqWarehouseServiceZone } from "@/lib/kanab-quest-warehouse";
import styles from "./KqWarehousePlan.module.css";

type PlanGrid = { x: number; y: number; cell: number; columns: number; rows: number };
type ObjectKind = "plants" | "lighting" | "air" | "pots" | "drying" | "storage" | "panel" | "drum" | "shelf";
const OBJECTS: ObjectKind[] = ["plants", "lighting", "air", "pots", "drying", "storage", "panel", "drum", "shelf"];
const tile = (kind: ObjectKind) => ({ source: `/placard/equipment-sylvain-v1/scene-${kind}.webp`, x: 0, y: 0, width: 512, height: 512 });

/** Individual cartoon sprites preserve their transparent edges at every zoom level. */
export function KqWarehouseObject({ kind, className }: { kind: ObjectKind; className?: string }) {
  const source = tile(kind);
  const clipId = `warehouse-object-${useId().replaceAll(":", "")}`;
  return <svg className={className} viewBox={`${source.x} ${source.y} ${source.width} ${source.height}`} aria-hidden="true" focusable="false">
    <defs><clipPath id={clipId}><rect x={source.x} y={source.y} width={source.width} height={source.height} /></clipPath></defs>
    <image href={source.source} width="512" height="512" clipPath={`url(#${clipId})`} />
  </svg>;
}

export function SceneDefinitions({ id, grid: GRID }: { id: string; grid: PlanGrid }) {
  return <defs>
    <radialGradient id={`${id}-lamplight`}><stop stopColor="#ffdf89" stopOpacity=".7" /><stop offset="1" stopColor="#f5b95c" stopOpacity="0" /></radialGradient>
    {OBJECTS.map(kind => { const source = tile(kind); return <symbol key={kind} id={`${id}-${kind}`} viewBox={`0 0 ${source.width} ${source.height}`} overflow="hidden"><clipPath id={`${id}-${kind}-clip`}><rect width={source.width} height={source.height} /></clipPath><image href={source.source} x={-source.x} y={-source.y} width="512" height="512" clipPath={`url(#${id}-${kind}-clip)`} /></symbol>; })}
    <pattern id={`${id}-grid`} width={GRID.cell} height={GRID.cell} x={GRID.x} y={GRID.y} patternUnits="userSpaceOnUse"><path d={`M${GRID.cell} 0H0V${GRID.cell}`} fill="none" stroke="#3e473d" strokeOpacity=".36" strokeWidth=".8" /></pattern>
    {(["plants", "pots", "drying", "storage", "drum", "shelf"] as const).map(kind => <pattern key={kind} id={`${id}-${kind}-rows`} width={GRID.cell} height={GRID.cell} x="0" y="0" patternUnits="userSpaceOnUse">{kind === "storage" || kind === "drum" ? [0, 1, 2, 3].map(index => <use key={index} href={`#${id}-${kind}`} x={1 + index % 2 * 14} y={1 + Math.floor(index / 2) * 14} width="14" height="14" />) : <use href={`#${id}-${kind}`} x="1" y="1" width="28" height="28" />}</pattern>)}
  </defs>;
}

/** Small workshop props show which systems are assigned; their size is illustrative. */
function ModuleProp({ family, optionCode }: { family: KqWarehouseOptionFamily; optionCode?: string }) {
  const variant = optionCode?.endsWith("-03") ? 3 : optionCode?.endsWith("-02") ? 2 : 1;
  return <image href={`/placard/equipment-sylvain-v1/${family}-${variant}.webp`} x="-1" y="-1" width="16" height="16" preserveAspectRatio="xMidYMid meet" />;
}

export function KqWarehouseModuleObject({ family, optionCode, className }: { family: KqWarehouseOptionFamily; optionCode?: string; className?: string }) {
  return <svg viewBox="-2 -2 18 18" className={className} aria-hidden="true" focusable="false"><ModuleProp family={family} optionCode={optionCode} /></svg>;
}

function ZoneIllustration({ zone, id, growing, grid: GRID, tint }: { zone: KqWarehouseZone; id: string; growing: boolean; grid: PlanGrid; tint: string }) {
  const width = zone.width * GRID.cell, height = zone.height * GRID.cell;
  const x = 0, y = 0;
  const area = zone.width * zone.height;
  const lights = getKqWarehouseFixturePositions(zone.width, zone.height, "lighting", zone.lightingCode);
  const extractors = getKqWarehouseFixturePositions(zone.width, zone.height, "air", zone.airCode);
  const running = growing && zone.active;
  const modules = (zone.optionCodes ?? []).map(code => getKqWarehouseOption(code)).filter(option => option !== undefined);
  const moduleColumns = Math.max(1, Math.floor((width - 4) / 16));
  const visibleModules = modules.slice(0, Math.min(8, moduleColumns * Math.max(1, Math.floor(height / 32))));
  return <g pointerEvents="none" opacity={zone.active ? 1 : .58} data-culture-running={running}>
    <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={tint} fillOpacity=".88" stroke="#4a5147" strokeWidth="1.5" />
    <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={`url(#${id}-${growing && zone.active ? "plants" : "pots"}-rows)`} />
    {running && <rect className={styles.lampGlow} data-warehouse-activity="lighting" x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={`url(#${id}-lamplight)`} />}
    <g data-equipment-code={zone.lightingCode} data-equipment-count={lights.length}>{lights.map((point, index) =>
      <use key={index} data-plan-fixture="lighting" href={`#${id}-${zone.lightingCode === "MH-TS1000" ? "panel" : "lighting"}`} x={point.x * GRID.cell - 10} y={point.z * GRID.cell - 6.5} width="20" height="13" opacity=".9" />)}</g>
    <g data-equipment-code={zone.airCode} data-equipment-count={extractors.length}>{extractors.map((point, index) => {
      const cx = point.x * GRID.cell, cy = point.z * GRID.cell;
      return <g key={index}><use data-plan-fixture="air" href={`#${id}-air`} x={cx - 5.5} y={cy - 5.5} width="11" height="11" />{running && <path className={styles.airFlow} data-warehouse-activity="air" d={`M${cx - 1.5} ${cy - 3.5}q-9-3-15 0m15 3q-9-3-15 0`} fill="none" stroke="#e7efc5" strokeWidth=".85" strokeDasharray="3 4" />}</g>;
    })}</g>
    {visibleModules.map((option, index) => <g key={option.code} data-warehouse-module={option.code} transform={`translate(${x + 2 + index % moduleColumns * 16} ${y + height - 15 - Math.floor(index / moduleColumns) * 15})`}><title>{option.name} · affecté à {area} m²</title><ModuleProp family={option.family} optionCode={option.code} /></g>)}
    {modules.length > visibleModules.length && <g><rect x={x + width - 12} y={y + height - 10} width="11" height="8" rx="2" fill="#24493e" /><text x={x + width - 6.5} y={y + height - 4} textAnchor="middle" fill="#f7e8b9" fontSize="6">+{modules.length - visibleModules.length}</text></g>}
  </g>;
}

function ServiceZoneIllustration({ zone, id, grid: GRID, tint }: { zone: KqWarehouseServiceZone; id: string; grid: PlanGrid; tint: string }) {
  const layout = getKqWarehouseDevice(zone.deviceCode)?.zoneLayout;
  const art = layout?.art;
  const quantity = layout && zone.width * zone.height * layout.unitsPerM2;
  const kind: ObjectKind = art === "jars" ? "storage" : art ?? zone.kind;
  return <g pointerEvents="none" data-equipment-code={zone.deviceCode} data-equipment-count={quantity}>
    <rect x="1" y="1" width={zone.width * GRID.cell - 2} height={zone.height * GRID.cell - 2} fill={tint} fillOpacity=".94" />
    <rect x="1" y="1" width={zone.width * GRID.cell - 2} height={zone.height * GRID.cell - 2} fill={`url(#${id}-${kind}-rows)`} />
  </g>;
}

export function KqWarehousePlanFixtures({ zone, id, grid: GRID, tint, growing }: {
  zone: KqWarehouseZone | KqWarehouseServiceZone; id: string; grid: PlanGrid; tint: string; growing: boolean;
}) {
  const x = GRID.x + zone.x * GRID.cell, y = GRID.y + zone.y * GRID.cell;
  const local = getKqWarehouseLocalSize(zone.width, zone.height, zone.rotation);
  const localZone = { ...zone, x: 0, y: 0, width: local.width, height: local.depth };
  const angle = getKqWarehouseOrientation(zone.rotation).planDegrees;
  const cell = GRID.cell;
  return <g data-plan-fixtures={zone.id} transform={`translate(${x + zone.width * cell / 2} ${y + zone.height * cell / 2}) rotate(${angle}) translate(${-local.width * cell / 2} ${-local.depth * cell / 2})`}>
    {"deviceCode" in localZone
      ? <ServiceZoneIllustration zone={localZone} id={id} grid={GRID} tint={tint} />
      : <ZoneIllustration zone={localZone} id={id} grid={GRID} tint={tint} growing={growing} />}
  </g>;
}
