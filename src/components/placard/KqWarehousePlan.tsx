"use client";

import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { KQ_WAREHOUSE_ROOM_ARTWORK } from "@/lib/kanab-quest-warehouse-artwork";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Focus, Grid2X2, Maximize2, Minimize2, Plus, Minus, Move, MousePointer2, Scaling, Scan, CircleHelp, Sprout, Wind, Package } from "lucide-react";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseOption, type KqWarehouseOptionFamily } from "@/lib/kanab-quest-warehouse-options";
import { doKqWarehouseZonesOverlap, getKqWarehouseServiceZoneQuote, type KqWarehouseZone, type KqWarehouseServiceZone } from "@/lib/kanab-quest-warehouse";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import styles from "./KqWarehousePlan.module.css";

const COMPACT_GRID = { x: 50, y: 50, cell: 30, columns: 10, rows: 10 } as const;
const LEGACY_GRID = { x: 168, y: 120, cell: 30, columns: 40, rows: 25 } as const;
type PlanGrid = { x: number; y: number; cell: number; columns: number; rows: number };
const axisMarks = (limit: number) => {
  const step = limit <= 10 ? 2 : Math.ceil(limit / 5);
  return [...new Set([...Array.from({ length: Math.floor(limit / step) + 1 }, (_, index) => index * step), limit])];
};
type Point = { x: number; y: number };
type ZoneKind = "culture" | "drying" | "storage";
type PlanZone = KqWarehouseZone | KqWarehouseServiceZone;
type ZoneRectangle = Pick<PlanZone, "x" | "y" | "width" | "height">;
type PlanTool = "inspect" | "move" | "resize";
type TransformPreview = { zoneId: string; rectangle: ZoneRectangle; valid: boolean };
type DrawPreview = { start: Point; end: Point; rectangle: ZoneRectangle; valid: boolean };
type InspectionTap = { pointerId: number; pointerType: string; zoneId: string; client: Point; startedAt: number; moved: boolean };
type PlanGesture = { pointerId: number; client: Point; moved: boolean } & (
  | { kind: "pan"; scroll: Point }
  | { kind: "move" | "resize"; origin: PlanZone; point: Point; preview: TransformPreview }
  | { kind: "draw"; preview: DrawPreview }
);
type CameraTarget = { x: number; y: number; offsetX: number; offsetY: number };
const MIN_ZOOM = 100, MAX_ZOOM = 1000, ZOOM_STEP = 25;
const TAP_MAX_DURATION = 500, TAP_MAX_TRAVEL = 12;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const ZONE_TYPES = [{ code: "culture", label: "Culture", icon: Sprout }, { code: "drying", label: "Séchage", icon: Wind }, { code: "storage", label: "Stockage", icon: Package }] as const;
const kindOf = (zone: PlanZone): ZoneKind => "kind" in zone ? zone.kind : "culture";
const zoneLabel = (zone: PlanZone) => ZONE_TYPES.find(type => type.code === kindOf(zone))!.label;
type ObjectKind = "plants" | "lighting" | "air" | "pots" | "drying" | "storage" | "panel" | "drum" | "shelf";
const OBJECTS: ObjectKind[] = ["plants", "lighting", "air", "pots", "drying", "storage", "panel", "drum", "shelf"];
const tile = (kind: ObjectKind) => ({ source: `/placard/equipment-sylvain-v1/scene-${kind}.webp`, x: 0, y: 0, width: 512, height: 512 });

/** Freeze user scrolling without removing scrollbars or changing the SVG's size. */
function lockGestureScrolling() {
  const preventScroll = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  const preventScrollKey = (event: globalThis.KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) preventScroll(event);
  };
  // Capture also covers scrollable parents, fullscreen, and a second finger outside the plan.
  document.addEventListener("touchmove", preventScroll, { capture: true, passive: false });
  document.addEventListener("wheel", preventScroll, { capture: true, passive: false });
  document.addEventListener("keydown", preventScrollKey, true);
  return () => {
    document.removeEventListener("touchmove", preventScroll, true);
    document.removeEventListener("wheel", preventScroll, true);
    document.removeEventListener("keydown", preventScrollKey, true);
  };
}

/** Individual cartoon sprites preserve their transparent edges at every zoom level. */
export function KqWarehouseObject({ kind, className }: { kind: ObjectKind; className?: string }) {
  const source = tile(kind);
  const clipId = `warehouse-object-${useId().replaceAll(":", "")}`;
  return <svg className={className} viewBox={`${source.x} ${source.y} ${source.width} ${source.height}`} aria-hidden="true" focusable="false">
    <defs><clipPath id={clipId}><rect x={source.x} y={source.y} width={source.width} height={source.height} /></clipPath></defs>
    <image href={source.source} width="512" height="512" clipPath={`url(#${clipId})`} />
  </svg>;
}

function SceneDefinitions({ id, grid: GRID }: { id: string; grid: PlanGrid }) {
  return <defs>
    <radialGradient id={`${id}-lamplight`}><stop stopColor="#ffdf89" stopOpacity=".7" /><stop offset="1" stopColor="#f5b95c" stopOpacity="0" /></radialGradient>
    {OBJECTS.map(kind => { const source = tile(kind); return <symbol key={kind} id={`${id}-${kind}`} viewBox={`0 0 ${source.width} ${source.height}`} overflow="hidden"><clipPath id={`${id}-${kind}-clip`}><rect width={source.width} height={source.height} /></clipPath><image href={source.source} x={-source.x} y={-source.y} width="512" height="512" clipPath={`url(#${id}-${kind}-clip)`} /></symbol>; })}
    <pattern id={`${id}-grid`} width={GRID.cell} height={GRID.cell} x={GRID.x} y={GRID.y} patternUnits="userSpaceOnUse"><path d={`M${GRID.cell} 0H0V${GRID.cell}`} fill="none" stroke="#3e473d" strokeOpacity=".36" strokeWidth=".8" /></pattern>
    {(["plants", "pots", "drying", "storage", "drum", "shelf"] as const).map(kind => <pattern key={kind} id={`${id}-${kind}-rows`} width={GRID.cell} height={GRID.cell} x={GRID.x} y={GRID.y} patternUnits="userSpaceOnUse">{kind === "storage" || kind === "drum" ? [0, 1, 2, 3].map(index => <use key={index} href={`#${id}-${kind}`} x={1 + index % 2 * 14} y={1 + Math.floor(index / 2) * 14} width="14" height="14" />) : <use href={`#${id}-${kind}`} x="1" y="1" width="28" height="28" />}</pattern>)}
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
  const x = GRID.x + zone.x * GRID.cell, y = GRID.y + zone.y * GRID.cell;
  const area = zone.width * zone.height;
  const lightCoverage = getKqWarehouseDevice(zone.lightingCode)?.gameCapacity.value ?? 1;
  const airCoverage = getKqWarehouseDevice(zone.airCode)?.gameCapacity.value ?? 20;
  const lights = Math.ceil(area / lightCoverage), extractors = Math.ceil(area / airCoverage);
  // The drawn units follow the same whole-device rule as the purchase quote.
  const placement = (index: number, coverage: number) => {
    const cell = Math.min(area - 1, Math.floor(index * coverage));
    return { x: x + (cell % zone.width) * GRID.cell, y: y + Math.floor(cell / zone.width) * GRID.cell };
  };
  const running = growing && zone.active;
  const modules = (zone.optionCodes ?? []).map(code => getKqWarehouseOption(code)).filter(option => option !== undefined);
  const moduleColumns = Math.max(1, Math.floor((width - 4) / 16));
  const visibleModules = modules.slice(0, Math.min(8, moduleColumns * Math.max(1, Math.floor(height / 32))));
  return <g pointerEvents="none" opacity={zone.active ? 1 : .58} data-culture-running={running}>
    <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={tint} fillOpacity=".88" stroke="#4a5147" strokeWidth="1.5" />
    <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={`url(#${id}-${growing && zone.active ? "plants" : "pots"}-rows)`} />
    {running && <rect className={styles.lampGlow} data-warehouse-activity="lighting" x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={`url(#${id}-lamplight)`} />}
    <g data-equipment-code={zone.lightingCode} data-equipment-count={lights}>{Array.from({ length: lights }, (_, index) => {
      const point = placement(index, lightCoverage);
      return <use key={index} href={`#${id}-${zone.lightingCode === "MH-TS1000" ? "panel" : "lighting"}`} x={point.x + 4} y={point.y + 1} width="20" height="13" opacity=".9" />;
    })}</g>
    <g data-equipment-code={zone.airCode} data-equipment-count={extractors}>{Array.from({ length: extractors }, (_, index) => {
      const point = placement(index, airCoverage);
      return <g key={index}><use href={`#${id}-air`} x={point.x + 19} y={point.y + 19} width="11" height="11" />{running && <path className={styles.airFlow} data-warehouse-activity="air" d={`M${point.x + 23} ${point.y + 21}q-9-3-15 0m15 3q-9-3-15 0`} fill="none" stroke="#e7efc5" strokeWidth=".85" strokeDasharray="3 4" />}</g>;
    })}</g>
    {visibleModules.map((option, index) => <g key={option.code} data-warehouse-module={option.code} transform={`translate(${x + 2 + index % moduleColumns * 16} ${y + height - 15 - Math.floor(index / moduleColumns) * 15})`}><title>{option.name} · affecté à {area} m²</title><ModuleProp family={option.family} optionCode={option.code} /></g>)}
    {modules.length > visibleModules.length && <g><rect x={x + width - 12} y={y + height - 10} width="11" height="8" rx="2" fill="#24493e" /><text x={x + width - 6.5} y={y + height - 4} textAnchor="middle" fill="#f7e8b9" fontSize="6">+{modules.length - visibleModules.length}</text></g>}
  </g>;
}

function ServiceZoneIllustration({ zone, id, grid: GRID, tint }: { zone: KqWarehouseServiceZone; id: string; grid: PlanGrid; tint: string }) {
  const quote = getKqWarehouseServiceZoneQuote(zone);
  const art = getKqWarehouseDevice(zone.deviceCode)?.zoneLayout?.art;
  const kind: ObjectKind = art === "jars" ? "storage" : art ?? zone.kind;
  return <g pointerEvents="none" data-equipment-code={zone.deviceCode} data-equipment-count={quote.devices.reduce((sum, item) => sum + item.quantity, 0)}>
    <rect x={GRID.x + zone.x * GRID.cell + 1} y={GRID.y + zone.y * GRID.cell + 1} width={zone.width * GRID.cell - 2} height={zone.height * GRID.cell - 2} fill={tint} fillOpacity=".94" />
    <rect x={GRID.x + zone.x * GRID.cell + 1} y={GRID.y + zone.y * GRID.cell + 1} width={zone.width * GRID.cell - 2} height={zone.height * GRID.cell - 2} fill={`url(#${id}-${kind}-rows)`} />
  </g>;
}

export function KqWarehousePlan({ zones, serviceZones, dimensions, roomArtwork, interactionHint, selectedId, drawing, drawingKind, anchor, cursor, zoom, locked, growing, managing = true, activeZoneIds, lockedZoneIds = [], placingBuddie = false, buddieDrop, onZoom, onDrawingKind, onToggleDrawing, onSelectPoint, onDrawZone, onConfigureZone, onOpenZoneMenu, onCursor, onKeyDown, onTransformZone }: {
  zones: KqWarehouseZone[]; serviceZones: KqWarehouseServiceZone[]; selectedId: string | null; drawing: boolean; drawingKind: ZoneKind; anchor: Point | null; cursor: Point;
  dimensions?: { columns: number; rows: number };
  roomArtwork?: string;
  interactionHint?: string;
  managing?: boolean; activeZoneIds?: string[]; lockedZoneIds?: string[];
  placingBuddie?: boolean; buddieDrop?: { zoneId: string | null; allowed: boolean } | null;
  zoom: number; locked: boolean; growing: boolean; onZoom: (zoom: number) => void; onToggleDrawing: () => void;
  onDrawingKind: (kind: ZoneKind) => void;
  onSelectPoint: (point: Point) => void; onCursor: (point: Point) => void; onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
  onDrawZone: (start: Point, end: Point) => boolean;
  onConfigureZone: (zoneId: string) => void;
  /** Read-only menu access; edit actions retain their own lock checks. */
  onOpenZoneMenu?: (zoneId: string) => void;
  onTransformZone: (zoneId: string, patch: ZoneRectangle) => void;
}) {
  const legacy = dimensions?.columns === 40 && dimensions.rows === 25;
  const GRID = legacy ? LEGACY_GRID : COMPACT_GRID;
  const sceneWidth = legacy ? 1536 : 400, sceneHeight = legacy ? 1024 : 400;
  const layoutKey = `${GRID.columns}x${GRID.rows}`;
  const id = `warehouse-plan-${useId().replaceAll(":", "")}`;
  const section = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const map = useRef<SVGSVGElement>(null);
  const gesture = useRef<PlanGesture | null>(null);
  const inspectionTap = useRef<InspectionTap | null>(null);
  const inspectionReady = useRef<{ zoneId: string; endedAt: number } | null>(null);
  const releaseScrollLock = useRef<(() => void) | null>(null);
  const pendingCamera = useRef<CameraTarget | null>(null);
  const framedSelection = useRef<{ initialized: boolean; id: string | null; layout: string }>({ initialized: false, id: null, layout: layoutKey });
  const suppressClick = useRef(false);
  const [grid, setGrid] = useState(false);
  const [tool, setTool] = useState<PlanTool>("inspect");
  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);
  const [panning, setPanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [notice, setNotice] = useState("");
  const allZones: PlanZone[] = [...zones, ...serviceZones];
  const selected = allZones.find(zone => zone.id === selectedId);
  const validZones = allZones.filter(zone => [zone.x, zone.y, zone.width, zone.height].every(Number.isSafeInteger) && zone.width > 0 && zone.height > 0 && zone.x >= 0 && zone.y >= 0 && zone.x + zone.width <= GRID.columns && zone.y + zone.height <= GRID.rows);
  const selectedValid = selected && validZones.includes(selected) ? selected : null;
  const selectedIdentity = selectedValid ? getKqZoneIdentity({ zones, serviceZones }, selectedValid.id) : null;
  const selectedLocked = locked || placingBuddie || !managing || !!selectedId && lockedZoneIds.includes(selectedId);
  const manipulating = managing && !locked && !placingBuddie && (drawing || !selectedLocked && tool !== "inspect");
  const drawingRectangle = drawPreview?.rectangle ?? (anchor ? {
    x: Math.min(anchor.x, cursor.x), y: Math.min(anchor.y, cursor.y),
    width: Math.abs(anchor.x - cursor.x) + 1, height: Math.abs(anchor.y - cursor.y) + 1,
  } : null);
  const selectionArea = drawingRectangle ? drawingRectangle.width * drawingRectangle.height : 1;
  const baseScale = Math.max(1 / sceneWidth, Math.min(viewportSize.width / sceneWidth, viewportSize.height / sceneHeight));
  const renderedWidth = sceneWidth * baseScale * (legacy ? zoom / 100 : 1);
  const renderedHeight = sceneHeight * baseScale * (legacy ? zoom / 100 : 1);
  const markerScale = sceneWidth / renderedWidth;

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => setViewportSize(previous => previous.width === node.clientWidth && previous.height === node.clientHeight ? previous : { width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function scenePoint(clientX: number, clientY: number): Point | null {
    const matrix = map.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: (point.x - GRID.x) / GRID.cell, y: (point.y - GRID.y) / GRID.cell };
  }
  function pointerCell(event: Pick<MouseEvent<SVGSVGElement>, "clientX" | "clientY">, constrain = false): Point | null {
    const point = scenePoint(event.clientX, event.clientY);
    if (!point) return null;
    const x = Math.floor(point.x), y = Math.floor(point.y);
    if (constrain) return { x: clamp(x, 0, GRID.columns - 1), y: clamp(y, 0, GRID.rows - 1) };
    return x >= 0 && x < GRID.columns && y >= 0 && y < GRID.rows ? { x, y } : null;
  }
  function drawingPreview(start: Point, end: Point): DrawPreview {
    const rectangle = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(start.x - end.x) + 1, height: Math.abs(start.y - end.y) + 1 };
    return { start, end, rectangle, valid: !validZones.some(zone => doKqWarehouseZonesOverlap(rectangle, zone)) };
  }
  function zoneAtCell(point: Point | null) {
    return point ? validZones.find(zone => point.x >= zone.x && point.x < zone.x + zone.width && point.y >= zone.y && point.y < zone.y + zone.height) : undefined;
  }
  function canConfigureZone(zoneId: string) {
    return managing && !locked && !placingBuddie && !drawing && !gesture.current
      && !lockedZoneIds.includes(zoneId) && validZones.some(zone => zone.id === zoneId);
  }
  function canInspectZone(zoneId: string) {
    return !!onOpenZoneMenu && !placingBuddie && !drawing && !gesture.current && validZones.some(zone => zone.id === zoneId);
  }
  const resetInspection = useCallback(() => {
    inspectionTap.current = null;
    inspectionReady.current = null;
  }, []);
  function configureZone(zoneId: string, focusPlan = false) {
    if (canInspectZone(zoneId)) {
      resetInspection(); setTool("inspect"); setNotice("");
      if (focusPlan) map.current?.focus({ preventScroll: true });
      onOpenZoneMenu?.(zoneId);
      return;
    }
    if (!canConfigureZone(zoneId)) return;
    resetInspection();
    setTool("inspect");
    setNotice("");
    if (focusPlan) map.current?.focus({ preventScroll: true });
    onConfigureZone(zoneId);
  }
  function finishInspection(event: PointerEvent<SVGSVGElement>) {
    const current = inspectionTap.current;
    if (!current || current.pointerId !== event.pointerId) return;
    inspectionTap.current = null;
    const now = performance.now();
    if (current.moved || now - current.startedAt > TAP_MAX_DURATION
      || !(canInspectZone(current.zoneId) || canConfigureZone(current.zoneId)) || zoneAtCell(pointerCell(event))?.id !== current.zoneId
      || Math.hypot(event.clientX - current.client.x, event.clientY - current.client.y) > TAP_MAX_TRAVEL) {
      suppressClick.current = true;
      resetInspection(); return;
    }
    // Open from the following click, whose target is still the plan. Opening on
    // pointerup can send a delayed compatibility click into the new dialog.
    inspectionReady.current = { zoneId: current.zoneId, endedAt: now };
  }

  useEffect(() => {
    const reset = () => { if (inspectionTap.current || inspectionReady.current) suppressClick.current = true; resetInspection(); };
    window.addEventListener("scroll", reset, { capture: true, passive: true });
    window.addEventListener("wheel", reset, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", reset, true);
      window.removeEventListener("wheel", reset, true);
    };
  }, [resetInspection]);
  useEffect(() => { resetInspection(); }, [locked, drawing, drawingKind, managing, placingBuddie, layoutKey, resetInspection]);
  const applyCamera = useCallback(() => {
    const node = viewport.current, svg = map.current, target = pendingCamera.current;
    if (!legacy) { pendingCamera.current = null; return; }
    if (!node || !svg || !target) return;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const viewportBounds = node.getBoundingClientRect();
    const originX = bounds.left - viewportBounds.left - node.clientLeft + node.scrollLeft;
    const originY = bounds.top - viewportBounds.top - node.clientTop + node.scrollTop;
    node.scrollTo({ left: originX + target.x * bounds.width - target.offsetX, top: originY + target.y * bounds.height - target.offsetY, behavior: "instant" });
    pendingCamera.current = null;
  }, [legacy]);
  useLayoutEffect(() => {
    // The centered SVG's pixel dimensions and scroll range must settle together.
    const frame = requestAnimationFrame(applyCamera);
    return () => cancelAnimationFrame(frame);
  }, [zoom, renderedWidth, renderedHeight, applyCamera]);

  const changeZoom = useCallback((value: number, client?: Point) => {
    const node = viewport.current, svg = map.current;
    if (!legacy || !node || !svg || gesture.current) return;
    const next = clamp(Math.round(value / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
    if (next === zoom) return;
    const bounds = node.getBoundingClientRect();
    const offsetX = client ? client.x - bounds.left - node.clientLeft : node.clientWidth / 2;
    const offsetY = client ? client.y - bounds.top - node.clientTop : node.clientHeight / 2;
    const boundsSvg = svg.getBoundingClientRect();
    pendingCamera.current = { x: (bounds.left + node.clientLeft + offsetX - boundsSvg.left) / boundsSvg.width, y: (bounds.top + node.clientTop + offsetY - boundsSvg.top) / boundsSvg.height, offsetX, offsetY };
    onZoom(next);
  }, [legacy, onZoom, zoom]);

  const frameZone = useCallback((zone: PlanZone) => {
    const node = viewport.current;
    if (!legacy || !node || gesture.current) return;
    const baseScale = Math.min(node.clientWidth / sceneWidth, node.clientHeight / sceneHeight);
    const scale = Math.min(node.clientWidth * .72 / (zone.width * GRID.cell), node.clientHeight * .72 / (zone.height * GRID.cell),
      Math.max(baseScale, 120 / (Math.min(zone.width, zone.height) * GRID.cell)));
    const next = clamp(Math.round(scale / baseScale * 100 / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
    pendingCamera.current = { x: (GRID.x + (zone.x + zone.width / 2) * GRID.cell) / sceneWidth,
      y: (GRID.y + (zone.y + zone.height / 2) * GRID.cell) / sceneHeight, offsetX: node.clientWidth / 2, offsetY: node.clientHeight / 2 };
    if (next === zoom) applyCamera(); else onZoom(next);
  }, [GRID, applyCamera, legacy, onZoom, sceneWidth, sceneHeight, zoom]);

  useEffect(() => {
    // Identity, rather than geometry, owns automatic framing: a drag never moves the camera.
    if (!viewportSize.width || !viewportSize.height || !legacy) return;
    const zone = selectedValid ?? (!framedSelection.current.initialized ? validZones[0] : null);
    if (!zone) { if (selectedId === null) framedSelection.current.id = null; return; }
    if (framedSelection.current.initialized && framedSelection.current.id === zone.id && framedSelection.current.layout === layoutKey) return;
    const frame = requestAnimationFrame(() => { framedSelection.current = { initialized: true, id: zone.id, layout: layoutKey }; frameZone(zone); });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, selectedValid, validZones, frameZone, layoutKey, legacy, zoom, applyCamera, onZoom, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    const node = viewport.current;
    if (!legacy || !node) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || !event.deltaY || gesture.current) return;
      event.preventDefault();
      changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), { x: event.clientX, y: event.clientY });
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [changeZoom, legacy, zoom]);

  useEffect(() => {
    const changed = () => {
      const target = section.current?.closest<HTMLElement>("[data-warehouse-v4]") ?? section.current;
      setFullscreen(document.fullscreenElement === target);
      if (selectedValid) requestAnimationFrame(() => frameZone(selectedValid));
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [frameZone, selectedValid]);

  async function toggleFullscreen() {
    setNotice("");
    try {
      const target = section.current?.closest<HTMLElement>("[data-warehouse-v4]") ?? section.current;
      if (document.fullscreenElement === target) await document.exitFullscreen();
      else if (target?.requestFullscreen) await target.requestFullscreen();
      else setNotice("Plein écran indisponible. Le zoom reste accessible.");
    } catch {
      setNotice("Le navigateur a refusé le plein écran.");
    }
  }

  const unlockScrolling = useCallback(() => {
    releaseScrollLock.current?.();
    releaseScrollLock.current = null;
  }, []);

  const cancelGesture = useCallback(() => {
    const current = gesture.current;
    const wasInspecting = !!inspectionTap.current || !!inspectionReady.current;
    gesture.current = null;
    resetInspection();
    unlockScrolling();
    if (current && map.current?.hasPointerCapture(current.pointerId)) map.current.releasePointerCapture(current.pointerId);
    suppressClick.current = Boolean(current) || wasInspecting;
    setPreview(null);
    setDrawPreview(null);
    setPanning(false);
  }, [resetInspection, unlockScrolling]);

  useEffect(() => {
    const hidden = () => { if (document.hidden) cancelGesture(); };
    window.addEventListener("blur", cancelGesture);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancelGesture);
      document.removeEventListener("visibilitychange", hidden);
      unlockScrolling();
    };
  }, [cancelGesture, unlockScrolling]);

  useEffect(() => {
    // Reject a pending commit immediately if server state or the selected tool changes.
    const current = gesture.current;
    gesture.current = null;
    unlockScrolling();
    if (current && map.current?.hasPointerCapture(current.pointerId)) map.current.releasePointerCapture(current.pointerId);
    const frame = requestAnimationFrame(() => {
      if (gesture.current) return;
      setPreview(null); setDrawPreview(null); setPanning(false); setTool("inspect");
      if (drawing) setNotice("");
    });
    return () => cancelAnimationFrame(frame);
  }, [locked, drawing, drawingKind, managing, placingBuddie, selectedId, selectedLocked, layoutKey, unlockScrolling]);

  function setPlanTool(next: PlanTool) {
    cancelGesture();
    setTool(next);
    setNotice("");
    if (drawing) onToggleDrawing();
  }

  function beginGesture(event: PointerEvent<SVGSVGElement>) {
    suppressClick.current = false;
    if (event.button !== 0 || gesture.current || (event.pointerType === "touch" && !event.isPrimary)) { resetInspection(); return; }
    // An interrupted inspection (for example mouse release outside the SVG) is not a tap.
    if (inspectionTap.current) resetInspection();
    inspectionReady.current = null;
    if (drawing) {
      resetInspection();
      if (locked || placingBuddie || !managing) return;
      const point = pointerCell(event);
      if (!point) return;
      const initial = drawingPreview(point, point);
      gesture.current = { kind: "draw", preview: initial, pointerId: event.pointerId,
        client: { x: event.clientX, y: event.clientY }, moved: false };
      releaseScrollLock.current ??= lockGestureScrolling();
      setDrawPreview(initial);
      setNotice("");
      onCursor(point);
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const target = event.target as Element;
    const zoneId = target.closest("[data-zone-id]")?.getAttribute("data-zone-id");
    const resizeHandle = target.closest("[data-warehouse-resize-handle]");
    const point = scenePoint(event.clientX, event.clientY);
    const inspectedZone = zoneAtCell(pointerCell(event));
    if ((tool === "inspect" || tool === "resize" && !resizeHandle) && inspectedZone && (canInspectZone(inspectedZone.id) || canConfigureZone(inspectedZone.id))) {
      inspectionTap.current = { pointerId: event.pointerId, pointerType: event.pointerType, zoneId: inspectedZone.id,
        client: { x: event.clientX, y: event.clientY }, startedAt: performance.now(), moved: false };
      return;
    }
    if (!selectedLocked && selectedValid && point && ((tool === "move" && zoneId === selectedId) || (tool === "resize" && resizeHandle))) {
      if (tool === "move") {
        // A stationary press can open equipment; an actual move clears this candidate.
        inspectionTap.current = { pointerId: event.pointerId, pointerType: event.pointerType, zoneId: selectedValid.id,
          client: { x: event.clientX, y: event.clientY }, startedAt: performance.now(), moved: false };
      } else resetInspection();
      const rectangle = { x: selectedValid.x, y: selectedValid.y, width: selectedValid.width, height: selectedValid.height };
      const initial = { zoneId: selectedValid.id, rectangle, valid: true };
      gesture.current = { kind: tool as "move" | "resize", origin: selectedValid, point, preview: initial, pointerId: event.pointerId,
        client: { x: event.clientX, y: event.clientY }, moved: false };
      releaseScrollLock.current ??= lockGestureScrolling();
      setPreview(initial);
      setNotice("");
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (legacy && event.pointerType === "mouse" && !zoneId && !resizeHandle && viewport.current) {
      resetInspection();
      gesture.current = { kind: "pan", pointerId: event.pointerId, client: { x: event.clientX, y: event.clientY }, moved: false,
        scroll: { x: viewport.current.scrollLeft, y: viewport.current.scrollTop } };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else resetInspection();
  }

  function movePointer(event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current;
    if (!current) {
      const tap = inspectionTap.current;
      if (tap?.pointerId === event.pointerId && Math.hypot(event.clientX - tap.client.x, event.clientY - tap.client.y) > TAP_MAX_TRAVEL) {
        tap.moved = true;
        inspectionReady.current = null;
      }
      if (!drawing || !anchor) return;
      const point = pointerCell(event);
      if (point && (point.x !== cursor.x || point.y !== cursor.y)) onCursor(point);
      return;
    }
    if (event.pointerId !== current.pointerId) return;
    if (current.kind === "draw") {
      if (locked || placingBuddie || !managing || !drawing) { cancelGesture(); return; }
      const point = pointerCell(event, true);
      if (!point) return;
      event.preventDefault();
      current.preview = drawingPreview(current.preview.start, point);
      setDrawPreview(current.preview);
      if (point.x !== cursor.x || point.y !== cursor.y) onCursor(point);
      return;
    }
    if (Math.hypot(event.clientX - current.client.x, event.clientY - current.client.y) > 4) current.moved = true;
    if (!current.moved) return;
    resetInspection();
    event.preventDefault();
    if (current.kind === "pan") {
      setPanning(true);
      viewport.current?.scrollTo({ left: current.scroll.x - (event.clientX - current.client.x), top: current.scroll.y - (event.clientY - current.client.y), behavior: "instant" });
      return;
    }
    if (selectedLocked) { cancelGesture(); return; }
    const point = scenePoint(event.clientX, event.clientY);
    if (!point) return;
    const origin = current.origin;
    const dx = Math.round(point.x - current.point.x), dy = Math.round(point.y - current.point.y);
    const rectangle = current.kind === "move"
      ? { x: clamp(origin.x + dx, 0, GRID.columns - origin.width), y: clamp(origin.y + dy, 0, GRID.rows - origin.height), width: origin.width, height: origin.height }
      : { x: origin.x, y: origin.y, width: clamp(origin.width + dx, 1, GRID.columns - origin.x), height: clamp(origin.height + dy, 1, GRID.rows - origin.y) };
    const valid = !validZones.some(zone => zone.id !== origin.id && doKqWarehouseZonesOverlap(rectangle, zone));
    current.preview = { zoneId: origin.id, rectangle, valid };
    setPreview(current.preview);
  }

  function finishGesture(event: PointerEvent<SVGSVGElement>) {
    let current = gesture.current;
    if (!current) { finishInspection(event); return; }
    if (current.pointerId !== event.pointerId) return;
    // Include the release position even when the browser coalesces the final move.
    movePointer(event);
    current = gesture.current;
    if (!current) return;
    gesture.current = null;
    unlockScrolling();
    suppressClick.current = current.moved || current.kind !== "pan";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setPanning(false);
    setPreview(null);
    setDrawPreview(null);
    if (current.kind === "draw") {
      if (locked || placingBuddie || !managing || !drawing) return;
      if (!current.preview.valid) { setNotice("Cette zone chevauche une zone existante. Trace-la dans un espace libre."); return; }
      if (onDrawZone(current.preview.start, current.preview.end)) setNotice("Zone tracée. Appuie dessus pour l’aménager ou choisir un Buddie.");
      else setNotice("Cette zone ne peut pas être créée ici. Ajuste ton tracé.");
      return;
    }
    if (current.kind === "move" && !current.moved) { finishInspection(event); return; }
    if (current.kind === "pan" || selectedLocked || !current.moved) return;
    if (!current.preview.valid) { setNotice("Chevauchement : la zone reste à sa place."); return; }
    const rectangle = current.preview.rectangle;
    if (rectangle.x === current.origin.x && rectangle.y === current.origin.y && rectangle.width === current.origin.width && rectangle.height === current.origin.height) return;
    onTransformZone(current.origin.id, rectangle);
    setNotice(current.kind === "move" ? "Zone déplacée. Enregistre pour confirmer." : "Surface modifiée. Vérifie le devis.");
  }

  function overview() {
    cancelGesture();
    pendingCamera.current = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
    if (zoom === MIN_ZOOM) applyCamera(); else onZoom(MIN_ZOOM);
  }
  useEffect(() => {
    const node = viewport.current, svg = map.current;
    if (!legacy || !node || !svg || document.activeElement !== svg) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(GRID.x + (cursor.x + .5) * GRID.cell, GRID.y + (cursor.y + .5) * GRID.cell).matrixTransform(matrix);
    const rect = node.getBoundingClientRect();
    node.scrollBy({ left: point.x < rect.left + 25 ? point.x - rect.left - 25 : point.x > rect.right - 25 ? point.x - rect.right + 25 : 0,
      top: point.y < rect.top + 25 ? point.y - rect.top - 25 : point.y > rect.bottom - 25 ? point.y - rect.bottom + 25 : 0 });
  }, [GRID, legacy, cursor.x, cursor.y]);

  const transform = !selectedLocked && !drawing ? preview : null;
  const handleZone = transform && transform.zoneId === selectedValid?.id ? transform.rectangle : selectedValid;
  const contextMessage = interactionHint ?? (placingBuddie ? buddieDrop?.zoneId ? buddieDrop.allowed ? "Relâche pour affecter ton Buddie." : "Cette zone ne peut pas recevoir ton Buddie." : "Dépose la carte dans une zone libre." : !managing ? "Glisse un Buddie sur une zone, puis ouvre sa culture." : notice || (drawing ? drawingRectangle ? `${drawingRectangle.width} × ${drawingRectangle.height} m · ${selectionArea} m² · ${drawPreview ? drawPreview.valid ? "Relâche pour tracer la zone." : "Chevauchement : choisis un espace libre." : "Choisis le second coin avec Entrée."}` : "Appuie sur le plan, glisse sans lever le doigt, puis relâche pour tracer."
    : locked ? growing ? "Culture en cours : plan verrouillé." : "Plan verrouillé pour le moment."
    : selectedLocked && selectedValid ? "Culture en cours : cette zone est verrouillée."
    : tool === "move" ? "Glisse la zone pour la déplacer."
    : tool === "resize" ? "Glisse le coin doré pour ajuster la taille."
    : onOpenZoneMenu ? "Appuie sur une zone pour l’aménager ou choisir un Buddie." : "Appuie sur une zone pour la sélectionner."));

  const dimensionRectangle = drawing ? drawingRectangle : transform?.rectangle;
  const dimensionX = dimensionRectangle ? clamp(GRID.x + (dimensionRectangle.x + dimensionRectangle.width / 2) * GRID.cell - 70 * markerScale, 4 * markerScale, sceneWidth - 144 * markerScale) : 0;
  const dimensionY = dimensionRectangle ? Math.max(4 * markerScale, GRID.y + dimensionRectangle.y * GRID.cell - 28 * markerScale) : 0;

  return <section ref={section} className={styles.plan} aria-label="Plan illustré de l’entrepôt" data-warehouse-plan data-fullscreen={fullscreen} data-compact={!legacy} data-fixed-camera={!legacy}
    onKeyDownCapture={event => {
      if (event.key !== "Escape" || (!gesture.current && tool === "inspect" && !drawing)) return;
      event.preventDefault(); event.stopPropagation(); cancelGesture(); setTool("inspect"); setNotice("Manipulation annulée.");
      if (drawing) onToggleDrawing();
    }}>
    {managing && <div className={styles.zoneCreation}><span>Tracer une nouvelle zone</span><div className={styles.zoneTypes} role="group" aria-label="Tracer une nouvelle zone">{ZONE_TYPES.map(type => <button key={type.code} type="button" data-warehouse-action={type.code === "culture" ? "draw" : undefined} data-warehouse-draw-kind={type.code} aria-pressed={drawing && drawingKind === type.code} disabled={locked} onClick={() => { cancelGesture(); setTool("inspect"); setNotice(""); onDrawingKind(type.code); }}><type.icon size={16} />{type.label}</button>)}</div></div>}
    <div className={styles.toolbar}>
      {!legacy && <strong>10 × 10 m · 100 m²</strong>}
      {legacy && <div className={styles.cameraControls}><button type="button" data-warehouse-action="zoom-out" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(zoom - ZOOM_STEP)} aria-label="Réduire le zoom"><Minus size={15} /></button><output aria-label="Niveau de zoom">{zoom}%</output><button type="button" data-warehouse-action="zoom-in" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(zoom + ZOOM_STEP)} aria-label="Augmenter le zoom"><Plus size={15} /></button><span className={styles.divider} /><button type="button" data-warehouse-action="focus" disabled={!selectedValid} onClick={() => selectedValid && frameZone(selectedValid)} aria-label="Centrer la zone sélectionnée" title="Centrer la zone sélectionnée"><Focus size={15} /><span>Ma zone</span></button><button type="button" data-warehouse-action="overview" onClick={overview} aria-label="Voir tout l’entrepôt" title="Voir tout l’entrepôt"><Scan size={15} /><span>Ensemble</span></button></div>}
      <div><button type="button" aria-pressed={grid} aria-label="Afficher la grille" onClick={() => setGrid(value => !value)} title="Afficher la grille"><Grid2X2 size={15} /><span>Grille</span></button>{legacy && <button type="button" data-warehouse-action="fullscreen" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Quitter le plein écran" : "Afficher l’entrepôt en plein écran"} title={fullscreen ? "Quitter le plein écran" : "Plein écran"}>{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}</div>
    </div>
    <div className={styles.scene}>
    <div ref={viewport} className={styles.viewport} data-warehouse-map-viewport data-panning={panning} data-fixed-camera={!legacy} data-manipulating={manipulating}>
      <div className={styles.canvas} style={{ width: Math.max(viewportSize.width, renderedWidth), height: Math.max(viewportSize.height, renderedHeight) }}>
      <svg ref={map} className={styles.map} style={{ width: renderedWidth, height: renderedHeight }} viewBox={`0 0 ${sceneWidth} ${sceneHeight}`} role="img" aria-label={`Entrepôt illustré vu du dessus, ${(GRID.columns * GRID.rows).toLocaleString("fr-FR")} cases de 1 m² pour culture, séchage et stockage. Flèches pour se déplacer, Entrée pour ouvrir la zone ou tracer.`} aria-describedby={`${id}-help`} tabIndex={0}
        data-warehouse-map data-grid-origin-x={GRID.x} data-grid-origin-y={GRID.y} data-grid-cell-size={GRID.cell} data-grid-columns={GRID.columns} data-grid-rows={GRID.rows} data-drawing={drawing} data-tool={!selectedLocked && !drawing ? tool : "inspect"}
        onKeyDown={event => {
          if (!gesture.current) {
            if (event.key === "Enter" && !drawing && selectedValid && zoneAtCell(cursor)?.id === selectedValid.id && (canInspectZone(selectedValid.id) || canConfigureZone(selectedValid.id))) {
              event.preventDefault();
              if (!event.repeat) configureZone(selectedValid.id);
              return;
            }
            onKeyDown(event); return;
          }
          // Finish the pointer gesture before accepting another way to edit or leave the plan.
          if (event.key === "Tab") cancelGesture();
          if (event.key === "Enter" || event.key === " ") event.preventDefault();
        }} onClick={event => {
          const ready = inspectionReady.current;
          inspectionReady.current = null;
          const point = pointerCell(event);
          if (ready && performance.now() - ready.endedAt <= 1000 && zoneAtCell(point)?.id === ready.zoneId && (canInspectZone(ready.zoneId) || canConfigureZone(ready.zoneId))) {
            event.preventDefault(); event.stopPropagation();
            suppressClick.current = false;
            configureZone(ready.zoneId, true);
            return;
          }
          if (suppressClick.current) { suppressClick.current = false; return; }
          if (drawing && event.detail > 0) return;
          if (point) onSelectPoint(point);
        }}
        onPointerDown={beginGesture} onPointerMove={movePointer} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancelGesture(); }}>
        <SceneDefinitions id={id} grid={GRID} />
        <image data-warehouse-room-artwork href={roomArtwork ?? KQ_WAREHOUSE_ROOM_ARTWORK} width={sceneWidth} height={sceneHeight} preserveAspectRatio="none" pointerEvents="none" />
        <rect x={GRID.x} y={GRID.y} width={GRID.columns * GRID.cell} height={GRID.rows * GRID.cell} fill="none" stroke="#645d42" strokeOpacity=".45" strokeWidth="1" strokeDasharray="8 8" pointerEvents="none" />
        <g pointerEvents="none" className={styles.measurements} style={{ fontSize: 12 * markerScale }}>{axisMarks(GRID.columns).map(n => <text key={n} x={GRID.x + n * GRID.cell} y={GRID.y - 14} textAnchor="middle">{n} m</text>)}{axisMarks(GRID.rows).map(n => <text key={n} x={GRID.x - 18} y={GRID.y + n * GRID.cell + 4 * markerScale} textAnchor="end">{n}</text>)}</g>
        {validZones.map((zone, index) => {
          const identity = getKqZoneIdentity({ zones, serviceZones }, zone.id)!;
          const x = GRID.x + zone.x * GRID.cell, y = GRID.y + zone.y * GRID.cell;
          const area = zone.width * zone.height;
          const badgeWidth = Math.max(26, String(area).length * 5 + 14);
          // Keep adjacent small zones distinct; the controls repeat their
          // number and surface at full size below the plan.
          const badgeScale = Math.min(markerScale, zone.width * GRID.cell / (badgeWidth + 2), zone.height * GRID.cell / 28);
          return <g key={zone.id} className={styles.zone} data-zone-id={zone.id} data-zone-kind={kindOf(zone)} data-zone-color={identity.color} style={{ "--zone-color": identity.color, "--zone-tint": identity.tint } as CSSProperties} data-selected={zone.id === selectedId} data-buddie-drop={placingBuddie && buddieDrop?.zoneId === zone.id ? buddieDrop.allowed ? "valid" : "invalid" : undefined} data-buddie-target={placingBuddie && !("kind" in zone) && !lockedZoneIds.includes(zone.id) || undefined}>
            <title>{identity.label} · {zoneLabel(zone)} · {area} m²{"active" in zone && !zone.active ? " · en pause" : ""}</title>
            {"kind" in zone ? <ServiceZoneIllustration zone={zone} id={id} grid={GRID} tint={identity.tint} /> : <ZoneIllustration zone={zone} id={id} grid={GRID} tint={identity.tint} growing={activeZoneIds ? activeZoneIds.includes(zone.id) : growing} />}
            {zone.id === selectedId && <rect className={styles.selectionOutline} x={x - 2 * markerScale} y={y - 2 * markerScale} width={zone.width * GRID.cell + 4 * markerScale} height={zone.height * GRID.cell + 4 * markerScale} rx={2 * markerScale} fill="none" stroke="#172923" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            <rect className={styles.zoneOutline} x={x} y={y} width={zone.width * GRID.cell} height={zone.height * GRID.cell} fill="transparent" stroke={identity.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <g pointerEvents="none">
              {!("kind" in zone) && zone.buddieCode && getBuddieArtwork(zone.buddieCode) && <g data-zone-buddie={zone.buddieCode}><defs><clipPath id={`${id}-buddie-${index}`}><circle cx={GRID.x + (zone.x + zone.width / 2) * GRID.cell} cy={GRID.y + (zone.y + zone.height / 2) * GRID.cell} r={Math.min(zone.width, zone.height) * GRID.cell * .36} /></clipPath></defs><image href={getBuddieArtwork(zone.buddieCode)} x={GRID.x + (zone.x + zone.width / 2) * GRID.cell - Math.min(zone.width, zone.height) * GRID.cell * .36} y={GRID.y + (zone.y + zone.height / 2) * GRID.cell - Math.min(zone.width, zone.height) * GRID.cell * .36} width={Math.min(zone.width, zone.height) * GRID.cell * .72} height={Math.min(zone.width, zone.height) * GRID.cell * .72} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-buddie-${index})`} /><circle cx={GRID.x + (zone.x + zone.width / 2) * GRID.cell} cy={GRID.y + (zone.y + zone.height / 2) * GRID.cell} r={Math.min(zone.width, zone.height) * GRID.cell * .36} fill="none" stroke={activeZoneIds?.includes(zone.id) ? "#e8b141" : "#f8f1da"} strokeWidth="2" vectorEffect="non-scaling-stroke" /></g>}
              <g data-zone-number={identity.number} transform={`translate(${x + badgeScale} ${y + badgeScale}) scale(${badgeScale})`}>
                <rect data-zone-badge-background width={badgeWidth} height="25" rx="4" fill={identity.color} stroke="#172923" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
                <text x={badgeWidth / 2} y="11" textAnchor="middle" fill="#172923" fontSize="11" fontWeight="800">{identity.number}</text>
                <text x={badgeWidth / 2} y="21" textAnchor="middle" fill="#172923" fontSize="8.5" fontWeight="700">{area} m²</text>
              </g>
            </g>
          </g>;
        })}
        {(grid || drawing) && <rect x={GRID.x} y={GRID.y} width={GRID.columns * GRID.cell} height={GRID.rows * GRID.cell} fill={`url(#${id}-grid)`} pointerEvents="none" />}
        {transform && <g pointerEvents="none" data-warehouse-transform-preview data-valid={transform.valid}><rect x={GRID.x + transform.rectangle.x * GRID.cell} y={GRID.y + transform.rectangle.y * GRID.cell} width={transform.rectangle.width * GRID.cell} height={transform.rectangle.height * GRID.cell} fill={transform.valid ? "#c9d7a842" : "#ec735b55"} stroke={transform.valid ? "#f4cf80" : "#ff8f76"} strokeWidth="3" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" /></g>}
        {handleZone && tool === "resize" && !selectedLocked && !drawing && <g data-warehouse-resize-handle className={styles.resizeHandle}><title>Glisser pour redimensionner la zone sélectionnée</title><rect x={GRID.x + (handleZone.x + handleZone.width) * GRID.cell - 22 * markerScale} y={GRID.y + (handleZone.y + handleZone.height) * GRID.cell - 22 * markerScale} width={44 * markerScale} height={44 * markerScale} rx={6 * markerScale} fill="#f1cd86" stroke="#283c30" strokeWidth="2" vectorEffect="non-scaling-stroke" /><path d={`M${GRID.x + (handleZone.x + handleZone.width) * GRID.cell - 8 * markerScale} ${GRID.y + (handleZone.y + handleZone.height) * GRID.cell + 8 * markerScale}l${16 * markerScale} ${-16 * markerScale}`} stroke="#283c30" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" /></g>}
        {drawing && drawingRectangle && <g data-warehouse-draw-preview data-valid={drawPreview?.valid ?? true} data-width={drawingRectangle.width} data-height={drawingRectangle.height} data-area={selectionArea} pointerEvents="none"><rect x={GRID.x + drawingRectangle.x * GRID.cell} y={GRID.y + drawingRectangle.y * GRID.cell} width={drawingRectangle.width * GRID.cell} height={drawingRectangle.height * GRID.cell} fill={drawPreview?.valid === false ? "#ec735b55" : "#efc86755"} stroke={drawPreview?.valid === false ? "#a62d20" : "#6b4613"} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 3" /></g>}
        {dimensionRectangle && <g data-warehouse-preview-dimensions pointerEvents="none"><rect x={dimensionX} y={dimensionY} width={140 * markerScale} height={24 * markerScale} rx={5 * markerScale} fill="#fff1d6" stroke="#172923" strokeWidth="1" vectorEffect="non-scaling-stroke" /><text x={dimensionX + 70 * markerScale} y={dimensionY + 16 * markerScale} textAnchor="middle" fontSize={12 * markerScale} fontWeight="800" fill="#172923">{dimensionRectangle.width} × {dimensionRectangle.height} m · {dimensionRectangle.width * dimensionRectangle.height} m²</text></g>}
        <rect className={styles.cursor} data-visible={drawing} x={GRID.x + cursor.x * GRID.cell} y={GRID.y + cursor.y * GRID.cell} width={GRID.cell} height={GRID.cell} fill="#f7d88e33" stroke="#60441c" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </svg>
      </div>
    </div>
    </div>
    {managing && (tool !== "inspect" || drawing) && <button className={styles.finishManipulation} type="button" data-warehouse-action="finish-manipulation" onClick={() => { cancelGesture(); setTool("inspect"); if (drawing) onToggleDrawing(); setNotice("Tu peux à nouveau faire défiler la page."); }}>Terminer la manipulation</button>}
    {managing && <div className={styles.tools} role="group" aria-label="Outils de la zone sélectionnée"><div className={styles.selectedName}><strong className={styles.selectedLabel} style={selectedIdentity ? { borderColor: selectedIdentity.color } : undefined}>{selectedIdentity?.label ?? "Aucune zone"}</strong>{selectedValid && <span>{selectedValid.width * selectedValid.height} m²</span>}</div><div className={styles.toolActions}>{([{ code: "inspect", label: "Voir", icon: MousePointer2 }, { code: "move", label: "Déplacer", icon: Move }, { code: "resize", label: "Taille", icon: Scaling }] as const).map(item => <button key={item.code} type="button" data-warehouse-tool={item.code} aria-label={item.code === "resize" ? "Redimensionner la zone" : item.code === "move" ? "Déplacer la zone" : "Observer la zone"} aria-pressed={tool === item.code && !drawing} disabled={item.code !== "inspect" && (selectedLocked || !selectedValid)} onClick={() => setPlanTool(item.code)}><item.icon size={16} />{item.label}</button>)}</div></div>}
    <div className={styles.support}><p className={styles.help} id={`${id}-help`} role="status">{contextMessage}</p><details className={styles.helpDetails} data-warehouse-plan-help><summary><CircleHelp size={16} />Aide</summary><div className={styles.helpBody}>
      {legacy && <p>Glisse le sol pour déplacer la vue. La molette ajuste le zoom.</p>}
      <p><strong>Nouvelle zone :</strong> appuie, glisse sans lever le doigt, puis relâche pour valider. <strong>Déplacer :</strong> glisse la zone. <strong>Taille :</strong> glisse son coin doré.</p>
      <p>{onOpenZoneMenu ? <><strong>Menu de la zone :</strong> un clic ou un appui ouvre Aménager, Buddies et Supprimer.</> : <><strong>Sélection :</strong> un clic ou un appui choisit la zone.</>} Au clavier, utilise les boutons numérotés ou les flèches puis Entrée sur le plan.</p>
      <p><strong>Clavier :</strong> flèches pour avancer, Entrée pour ouvrir la zone. Pendant le dessin, Entrée choisit les deux coins. Échap annule. Les changements attendent ton enregistrement.</p>
      <div className={styles.footer}><div className={styles.legend}>{ZONE_TYPES.map(type => <span key={type.code}><type.icon size={14} aria-hidden="true" />{type.label}</span>)}</div><small>{GRID.columns} × {GRID.rows} m · 1 case = 1 m²</small></div>
      {legacy && <label className={styles.zoomRange}>Zoom<input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={ZOOM_STEP} value={zoom} onChange={event => changeZoom(Number(event.target.value))} aria-label="Zoom du plan" /><output>{zoom}%</output></label>}
    </div></details></div>
    <span className={styles.srOnly} role="status" aria-live="polite">Case {cursor.x + 1} sur {GRID.columns}, rangée {cursor.y + 1} sur {GRID.rows}{drawing && drawingRectangle ? `, surface ${selectionArea} m²` : ""}.</span>
  </section>;
}
