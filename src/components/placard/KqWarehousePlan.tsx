"use client";

import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Focus, Grid2X2, Maximize2, Minimize2, Plus, Minus, Move, MousePointer2, Scaling, Scan, CircleHelp, Sprout, Wind, Package } from "lucide-react";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseOption, type KqWarehouseOptionFamily } from "@/lib/kanab-quest-warehouse-options";
import { doKqWarehouseZonesOverlap, getKqWarehouseServiceZoneQuote, type KqWarehouseZone, type KqWarehouseServiceZone } from "@/lib/kanab-quest-warehouse";
import styles from "./KqWarehousePlan.module.css";

const COMPACT_ROOM = "/placard/warehouse-v4/overhead-room-100m2-sylvain-v1.webp";
const LEGACY_ROOM = "/placard/warehouse-v4/overhead-room-sylvain-v1.webp";
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
type PlanGesture = { pointerId: number; client: Point; moved: boolean } & (
  | { kind: "pan"; scroll: Point }
  | { kind: "move" | "resize"; origin: PlanZone; point: Point; preview: TransformPreview }
);
type CameraTarget = { x: number; y: number; offsetX: number; offsetY: number };
const MIN_ZOOM = 100, MAX_ZOOM = 1000, ZOOM_STEP = 25;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const ZONE_TYPES = [{ code: "culture", label: "Culture", icon: Sprout }, { code: "drying", label: "Séchage", icon: Wind }, { code: "storage", label: "Stockage", icon: Package }] as const;
const kindOf = (zone: PlanZone): ZoneKind => "kind" in zone ? zone.kind : "culture";
const zoneLabel = (zone: PlanZone) => ZONE_TYPES.find(type => type.code === kindOf(zone))!.label;
const zoneColor = (zone: PlanZone) => "kind" in zone ? zone.kind === "drying" ? "#98631a" : "#326b88" : "#08766b";
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

function ZoneIllustration({ zone, id, growing, grid: GRID }: { zone: KqWarehouseZone; id: string; growing: boolean; grid: PlanGrid }) {
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
  const modules = (zone.optionCodes ?? []).map(getKqWarehouseOption).filter(option => option !== undefined);
  const moduleColumns = Math.max(1, Math.floor((width - 4) / 16));
  const visibleModules = modules.slice(0, Math.min(8, moduleColumns * Math.max(1, Math.floor(height / 32))));
  return <g pointerEvents="none" opacity={zone.active ? 1 : .58} data-culture-running={running}>
    <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill="#eceddf" fillOpacity=".88" stroke="#4a5147" strokeWidth="1.5" />
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

function ServiceZoneIllustration({ zone, id, grid: GRID }: { zone: KqWarehouseServiceZone; id: string; grid: PlanGrid }) {
  const quote = getKqWarehouseServiceZoneQuote(zone);
  const art = getKqWarehouseDevice(zone.deviceCode)?.zoneLayout?.art;
  const kind: ObjectKind = art === "jars" ? "storage" : art ?? zone.kind;
  return <g pointerEvents="none" data-equipment-code={zone.deviceCode} data-equipment-count={quote.devices.reduce((sum, item) => sum + item.quantity, 0)}>
    <rect x={GRID.x + zone.x * GRID.cell + 1} y={GRID.y + zone.y * GRID.cell + 1} width={zone.width * GRID.cell - 2} height={zone.height * GRID.cell - 2} fill={zone.kind === "drying" ? "#f2e5c9" : "#dce8e9"} fillOpacity=".94" />
    <rect x={GRID.x + zone.x * GRID.cell + 1} y={GRID.y + zone.y * GRID.cell + 1} width={zone.width * GRID.cell - 2} height={zone.height * GRID.cell - 2} fill={`url(#${id}-${kind}-rows)`} />
  </g>;
}

export function KqWarehousePlan({ zones, serviceZones, dimensions, selectedId, drawing, drawingKind, anchor, cursor, zoom, locked, growing, managing = true, activeZoneIds, lockedZoneIds = [], placingBuddie = false, buddieDrop, onZoom, onDrawingKind, onToggleDrawing, onSelectPoint, onCursor, onKeyDown, onTransformZone }: {
  zones: KqWarehouseZone[]; serviceZones: KqWarehouseServiceZone[]; selectedId: string | null; drawing: boolean; drawingKind: ZoneKind; anchor: Point | null; cursor: Point;
  dimensions?: { columns: number; rows: number };
  managing?: boolean; activeZoneIds?: string[]; lockedZoneIds?: string[];
  placingBuddie?: boolean; buddieDrop?: { zoneId: string | null; allowed: boolean } | null;
  zoom: number; locked: boolean; growing: boolean; onZoom: (zoom: number) => void; onToggleDrawing: () => void;
  onDrawingKind: (kind: ZoneKind) => void;
  onSelectPoint: (point: Point) => void; onCursor: (point: Point) => void; onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
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
  const pendingCamera = useRef<CameraTarget | null>(null);
  const framedSelection = useRef<{ initialized: boolean; id: string | null; layout: string }>({ initialized: false, id: null, layout: layoutKey });
  const suppressClick = useRef(false);
  const [grid, setGrid] = useState(false);
  const [tool, setTool] = useState<PlanTool>("inspect");
  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [panning, setPanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [notice, setNotice] = useState("");
  const allZones: PlanZone[] = [...zones, ...serviceZones];
  const selected = allZones.find(zone => zone.id === selectedId);
  const validZones = allZones.filter(zone => [zone.x, zone.y, zone.width, zone.height].every(Number.isSafeInteger) && zone.width > 0 && zone.height > 0 && zone.x >= 0 && zone.y >= 0 && zone.x + zone.width <= GRID.columns && zone.y + zone.height <= GRID.rows);
  const selectedValid = selected && validZones.includes(selected) ? selected : null;
  const selectedLocked = locked || placingBuddie || !managing || !!selectedId && lockedZoneIds.includes(selectedId);
  const selectionArea = anchor ? (Math.abs(anchor.x - cursor.x) + 1) * (Math.abs(anchor.y - cursor.y) + 1) : 1;
  const baseScale = Math.max(1 / sceneWidth, Math.min(viewportSize.width / sceneWidth, viewportSize.height / sceneHeight));
  const renderedWidth = sceneWidth * baseScale * zoom / 100;
  const renderedHeight = sceneHeight * baseScale * zoom / 100;
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
  function pointerCell(event: Pick<MouseEvent<SVGSVGElement>, "clientX" | "clientY">): Point | null {
    const point = scenePoint(event.clientX, event.clientY);
    if (!point) return null;
    const x = Math.floor(point.x), y = Math.floor(point.y);
    return x >= 0 && x < GRID.columns && y >= 0 && y < GRID.rows ? { x, y } : null;
  }
  const applyCamera = useCallback(() => {
    const node = viewport.current, svg = map.current, target = pendingCamera.current;
    if (!node || !svg || !target) return;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const viewportBounds = node.getBoundingClientRect();
    const originX = bounds.left - viewportBounds.left - node.clientLeft + node.scrollLeft;
    const originY = bounds.top - viewportBounds.top - node.clientTop + node.scrollTop;
    node.scrollTo({ left: originX + target.x * bounds.width - target.offsetX, top: originY + target.y * bounds.height - target.offsetY, behavior: "instant" });
    pendingCamera.current = null;
  }, []);
  useLayoutEffect(() => {
    // The centered SVG's pixel dimensions and scroll range must settle together.
    const frame = requestAnimationFrame(applyCamera);
    return () => cancelAnimationFrame(frame);
  }, [zoom, renderedWidth, renderedHeight, applyCamera]);

  const changeZoom = useCallback((value: number, client?: Point) => {
    const node = viewport.current, svg = map.current;
    if (!node || !svg || gesture.current) return;
    const next = clamp(Math.round(value / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
    if (next === zoom) return;
    const bounds = node.getBoundingClientRect();
    const offsetX = client ? client.x - bounds.left - node.clientLeft : node.clientWidth / 2;
    const offsetY = client ? client.y - bounds.top - node.clientTop : node.clientHeight / 2;
    const boundsSvg = svg.getBoundingClientRect();
    pendingCamera.current = { x: (bounds.left + node.clientLeft + offsetX - boundsSvg.left) / boundsSvg.width, y: (bounds.top + node.clientTop + offsetY - boundsSvg.top) / boundsSvg.height, offsetX, offsetY };
    onZoom(next);
  }, [onZoom, zoom]);

  const frameZone = useCallback((zone: PlanZone) => {
    const node = viewport.current;
    if (!node || gesture.current) return;
    const baseScale = Math.min(node.clientWidth / sceneWidth, node.clientHeight / sceneHeight);
    const scale = Math.min(node.clientWidth * .72 / (zone.width * GRID.cell), node.clientHeight * .72 / (zone.height * GRID.cell),
      Math.max(baseScale, 120 / (Math.min(zone.width, zone.height) * GRID.cell)));
    const next = clamp(Math.round(scale / baseScale * 100 / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
    pendingCamera.current = { x: (GRID.x + (zone.x + zone.width / 2) * GRID.cell) / sceneWidth,
      y: (GRID.y + (zone.y + zone.height / 2) * GRID.cell) / sceneHeight, offsetX: node.clientWidth / 2, offsetY: node.clientHeight / 2 };
    if (next === zoom) applyCamera(); else onZoom(next);
  }, [GRID, applyCamera, onZoom, sceneWidth, sceneHeight, zoom]);

  useEffect(() => {
    // Identity, rather than geometry, owns automatic framing: a drag never moves the camera.
    if (!viewportSize.width || !viewportSize.height) return;
    const zone = selectedValid ?? (!framedSelection.current.initialized ? validZones[0] : null);
    if (!legacy && (!framedSelection.current.initialized || framedSelection.current.layout !== layoutKey)) {
      const frame = requestAnimationFrame(() => {
        framedSelection.current = { initialized: true, id: zone?.id ?? null, layout: layoutKey };
        pendingCamera.current = { x: .5, y: .5, offsetX: viewportSize.width / 2, offsetY: viewportSize.height / 2 };
        if (zoom === MIN_ZOOM) applyCamera(); else onZoom(MIN_ZOOM);
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!zone) { if (selectedId === null) framedSelection.current.id = null; return; }
    if (framedSelection.current.initialized && framedSelection.current.id === zone.id && framedSelection.current.layout === layoutKey) return;
    const frame = requestAnimationFrame(() => { framedSelection.current = { initialized: true, id: zone.id, layout: layoutKey }; frameZone(zone); });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, selectedValid, validZones, frameZone, layoutKey, legacy, zoom, applyCamera, onZoom, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || !event.deltaY || gesture.current) return;
      event.preventDefault();
      changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), { x: event.clientX, y: event.clientY });
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [changeZoom, zoom]);

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

  const cancelGesture = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (current && map.current?.hasPointerCapture(current.pointerId)) map.current.releasePointerCapture(current.pointerId);
    suppressClick.current = Boolean(current);
    setPreview(null);
    setPanning(false);
  }, []);

  useEffect(() => {
    if (!locked && !drawing) return;
    // Reject a pending commit immediately if server state or the selected tool changes.
    const current = gesture.current;
    gesture.current = null;
    if (current && map.current?.hasPointerCapture(current.pointerId)) map.current.releasePointerCapture(current.pointerId);
    const frame = requestAnimationFrame(() => { setPreview(null); setPanning(false); setTool("inspect"); });
    return () => cancelAnimationFrame(frame);
  }, [locked, drawing]);

  function setPlanTool(next: PlanTool) {
    cancelGesture();
    setTool(next);
    setNotice("");
    if (drawing) onToggleDrawing();
  }

  function beginGesture(event: PointerEvent<SVGSVGElement>) {
    suppressClick.current = false;
    if (event.button !== 0 || drawing || gesture.current) return;
    const target = event.target as Element;
    const zoneId = target.closest("[data-zone-id]")?.getAttribute("data-zone-id");
    const resizeHandle = target.closest("[data-warehouse-resize-handle]");
    const point = scenePoint(event.clientX, event.clientY);
    if (!selectedLocked && selectedValid && point && ((tool === "move" && zoneId === selectedId) || (tool === "resize" && resizeHandle))) {
      const rectangle = { x: selectedValid.x, y: selectedValid.y, width: selectedValid.width, height: selectedValid.height };
      const initial = { zoneId: selectedValid.id, rectangle, valid: true };
      gesture.current = { kind: tool as "move" | "resize", origin: selectedValid, point, preview: initial, pointerId: event.pointerId,
        client: { x: event.clientX, y: event.clientY }, moved: false };
      setPreview(initial);
      setNotice("");
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (event.pointerType === "mouse" && !zoneId && !resizeHandle && viewport.current) {
      gesture.current = { kind: "pan", pointerId: event.pointerId, client: { x: event.clientX, y: event.clientY }, moved: false,
        scroll: { x: viewport.current.scrollLeft, y: viewport.current.scrollTop } };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function movePointer(event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current;
    if (!current) {
      if (!drawing || !anchor) return;
      const point = pointerCell(event);
      if (point && (point.x !== cursor.x || point.y !== cursor.y)) onCursor(point);
      return;
    }
    if (event.pointerId !== current.pointerId) return;
    if (Math.hypot(event.clientX - current.client.x, event.clientY - current.client.y) > 4) current.moved = true;
    if (!current.moved) return;
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
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    suppressClick.current = current.moved || current.kind !== "pan";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setPanning(false);
    setPreview(null);
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
    if (!node || !svg || document.activeElement !== svg) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(GRID.x + (cursor.x + .5) * GRID.cell, GRID.y + (cursor.y + .5) * GRID.cell).matrixTransform(matrix);
    const rect = node.getBoundingClientRect();
    node.scrollBy({ left: point.x < rect.left + 25 ? point.x - rect.left - 25 : point.x > rect.right - 25 ? point.x - rect.right + 25 : 0,
      top: point.y < rect.top + 25 ? point.y - rect.top - 25 : point.y > rect.bottom - 25 ? point.y - rect.bottom + 25 : 0 });
  }, [GRID, cursor.x, cursor.y]);

  const transform = !selectedLocked && !drawing ? preview : null;
  const handleZone = transform && transform.zoneId === selectedValid?.id ? transform.rectangle : selectedValid;
  const contextMessage = placingBuddie ? buddieDrop?.zoneId ? buddieDrop.allowed ? "Relâche pour affecter ton Buddie." : "Cette zone ne peut pas recevoir ton Buddie." : "Dépose la carte dans une zone libre." : !managing ? "Glisse un Buddie sur une zone, puis ouvre sa culture." : notice || (drawing ? anchor ? `${selectionArea} m² · Choisis le second coin.` : "Choisis le premier coin de la zone."
    : locked ? growing ? "Culture en cours : plan verrouillé." : "Plan verrouillé pour le moment."
    : selectedLocked && selectedValid ? "Culture en cours : cette zone est verrouillée."
    : tool === "move" ? "Glisse la zone pour la déplacer."
    : tool === "resize" ? "Glisse le coin doré pour ajuster la taille."
    : selectedValid ? "Choisis un outil pour ajuster cette zone." : "Sélectionne une zone sur le plan.");

  return <section ref={section} className={styles.plan} aria-label="Plan illustré de l’entrepôt" data-warehouse-plan data-fullscreen={fullscreen}
    onKeyDownCapture={event => {
      if (event.key !== "Escape" || (!gesture.current && tool === "inspect")) return;
      event.preventDefault(); event.stopPropagation(); cancelGesture(); setTool("inspect"); setNotice("Manipulation annulée.");
    }}>
    {managing && <><div className={styles.heading}><div><h3>La chambre</h3></div><button type="button" data-warehouse-action="draw" aria-pressed={drawing} disabled={locked} onClick={() => { cancelGesture(); setTool("inspect"); setNotice(""); onToggleDrawing(); }}><Plus size={16} />{drawing ? "Annuler" : "Nouvelle zone"}</button></div>
    <div className={styles.zoneTypes} role="group" aria-label="Usage de la nouvelle zone">{ZONE_TYPES.map(type => <button key={type.code} type="button" data-warehouse-draw-kind={type.code} aria-pressed={drawingKind === type.code} disabled={locked} onClick={() => { setNotice(""); onDrawingKind(type.code); }}><type.icon size={16} />{type.label}</button>)}</div></>}
    <div className={styles.toolbar}>
      <div className={styles.cameraControls}><button type="button" data-warehouse-action="zoom-out" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(zoom - ZOOM_STEP)} aria-label="Réduire le zoom"><Minus size={15} /></button><output aria-label="Niveau de zoom">{zoom}%</output><button type="button" data-warehouse-action="zoom-in" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(zoom + ZOOM_STEP)} aria-label="Augmenter le zoom"><Plus size={15} /></button><span className={styles.divider} /><button type="button" data-warehouse-action="focus" disabled={!selectedValid} onClick={() => selectedValid && frameZone(selectedValid)} aria-label="Centrer la zone sélectionnée" title="Centrer la zone sélectionnée"><Focus size={15} /><span>Ma zone</span></button><button type="button" data-warehouse-action="overview" onClick={overview} aria-label="Voir tout l’entrepôt" title="Voir tout l’entrepôt"><Scan size={15} /><span>Ensemble</span></button></div>
      <div><button type="button" aria-pressed={grid} aria-label="Afficher la grille" onClick={() => setGrid(value => !value)} title="Afficher la grille"><Grid2X2 size={15} /><span>Grille</span></button><button type="button" data-warehouse-action="fullscreen" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Quitter le plein écran" : "Afficher l’entrepôt en plein écran"} title={fullscreen ? "Quitter le plein écran" : "Plein écran"}>{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div>
    </div>
    <div className={styles.scene}>
    <div ref={viewport} className={styles.viewport} data-warehouse-map-viewport data-panning={panning}>
      <div className={styles.canvas} style={{ width: Math.max(viewportSize.width, renderedWidth), height: Math.max(viewportSize.height, renderedHeight) }}>
      <svg ref={map} className={styles.map} style={{ width: renderedWidth, height: renderedHeight }} viewBox={`0 0 ${sceneWidth} ${sceneHeight}`} role="img" aria-label={`Entrepôt illustré vu du dessus, ${(GRID.columns * GRID.rows).toLocaleString("fr-FR")} cases de 1 m² pour culture, séchage et stockage. Flèches pour se déplacer, Entrée pour sélectionner ou tracer.`} aria-describedby={`${id}-help`} tabIndex={0}
        data-warehouse-map data-grid-origin-x={GRID.x} data-grid-origin-y={GRID.y} data-grid-cell-size={GRID.cell} data-grid-columns={GRID.columns} data-grid-rows={GRID.rows} data-drawing={drawing} data-tool={!selectedLocked && !drawing ? tool : "inspect"}
        onKeyDown={onKeyDown} onClick={event => { if (suppressClick.current) { suppressClick.current = false; return; } const point = pointerCell(event); if (point) onSelectPoint(point); }}
        onPointerDown={beginGesture} onPointerMove={movePointer} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancelGesture(); }}>
        <SceneDefinitions id={id} grid={GRID} />
        <image href={legacy ? LEGACY_ROOM : COMPACT_ROOM} width={sceneWidth} height={sceneHeight} pointerEvents="none" />
        <rect x={GRID.x} y={GRID.y} width={GRID.columns * GRID.cell} height={GRID.rows * GRID.cell} fill="none" stroke="#645d42" strokeOpacity=".45" strokeWidth="1" strokeDasharray="8 8" pointerEvents="none" />
        <g pointerEvents="none" className={styles.measurements} style={{ fontSize: 12 * markerScale }}>{axisMarks(GRID.columns).map(n => <text key={n} x={GRID.x + n * GRID.cell} y={GRID.y - 14} textAnchor="middle">{n} m</text>)}{axisMarks(GRID.rows).map(n => <text key={n} x={GRID.x - 18} y={GRID.y + n * GRID.cell + 4 * markerScale} textAnchor="end">{n}</text>)}</g>
        {validZones.map((zone, index) => <g key={zone.id} className={styles.zone} data-zone-id={zone.id} data-zone-kind={kindOf(zone)} data-selected={zone.id === selectedId} data-buddie-drop={placingBuddie && buddieDrop?.zoneId === zone.id ? buddieDrop.allowed ? "valid" : "invalid" : undefined} data-buddie-target={placingBuddie && !("kind" in zone) && !lockedZoneIds.includes(zone.id) || undefined}>
          <title>{zone.name} · {zoneLabel(zone)} · {zone.width * zone.height} m²{"active" in zone && !zone.active ? " · en pause" : ""}</title>
          {"kind" in zone ? <ServiceZoneIllustration zone={zone} id={id} grid={GRID} /> : <ZoneIllustration zone={zone} id={id} grid={GRID} growing={activeZoneIds ? activeZoneIds.includes(zone.id) : growing} />}
          <rect className={styles.zoneOutline} x={GRID.x + zone.x * GRID.cell} y={GRID.y + zone.y * GRID.cell} width={zone.width * GRID.cell} height={zone.height * GRID.cell} fill="transparent" stroke={zone.id === selectedId ? "#e8b141" : zoneColor(zone)} strokeWidth={zone.id === selectedId ? 2.5 : 1.2} vectorEffect="non-scaling-stroke" />
          <g pointerEvents="none">{!("kind" in zone) && zone.buddieCode && getBuddieArtwork(zone.buddieCode) && <g data-zone-buddie={zone.buddieCode}><defs><clipPath id={`${id}-buddie-${index}`}><circle cx={GRID.x + (zone.x + zone.width / 2) * GRID.cell} cy={GRID.y + (zone.y + zone.height / 2) * GRID.cell} r={Math.min(zone.width, zone.height) * GRID.cell * .36} /></clipPath></defs><image href={getBuddieArtwork(zone.buddieCode)} x={GRID.x + (zone.x + zone.width / 2) * GRID.cell - Math.min(zone.width, zone.height) * GRID.cell * .36} y={GRID.y + (zone.y + zone.height / 2) * GRID.cell - Math.min(zone.width, zone.height) * GRID.cell * .36} width={Math.min(zone.width, zone.height) * GRID.cell * .72} height={Math.min(zone.width, zone.height) * GRID.cell * .72} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-buddie-${index})`} /><circle cx={GRID.x + (zone.x + zone.width / 2) * GRID.cell} cy={GRID.y + (zone.y + zone.height / 2) * GRID.cell} r={Math.min(zone.width, zone.height) * GRID.cell * .36} fill="none" stroke={activeZoneIds?.includes(zone.id) ? "#e8b141" : "#f8f1da"} strokeWidth="2" vectorEffect="non-scaling-stroke" /></g>}<circle cx={GRID.x + zone.x * GRID.cell + 3} cy={GRID.y + zone.y * GRID.cell + 3} r={10 * markerScale} fill={zone.id === selectedId ? "#e8b141" : zoneColor(zone)} stroke="#f8f1da" strokeWidth="1.2" vectorEffect="non-scaling-stroke" /><text x={GRID.x + zone.x * GRID.cell + 3} y={GRID.y + zone.y * GRID.cell + 3 + 3.5 * markerScale} textAnchor="middle" fill={zone.id === selectedId ? "#292c21" : "#fff8e9"} fontSize={10 * markerScale} fontWeight="700">{index + 1}</text></g>
        </g>)}
        {(grid || drawing) && <rect x={GRID.x} y={GRID.y} width={GRID.columns * GRID.cell} height={GRID.rows * GRID.cell} fill={`url(#${id}-grid)`} pointerEvents="none" />}
        {transform && <g pointerEvents="none" data-warehouse-transform-preview data-valid={transform.valid}><rect x={GRID.x + transform.rectangle.x * GRID.cell} y={GRID.y + transform.rectangle.y * GRID.cell} width={transform.rectangle.width * GRID.cell} height={transform.rectangle.height * GRID.cell} fill={transform.valid ? "#c9d7a842" : "#ec735b55"} stroke={transform.valid ? "#f4cf80" : "#ff8f76"} strokeWidth="3" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" /></g>}
        {handleZone && tool === "resize" && !selectedLocked && !drawing && <g data-warehouse-resize-handle className={styles.resizeHandle}><title>Glisser pour redimensionner la zone sélectionnée</title><rect x={GRID.x + (handleZone.x + handleZone.width) * GRID.cell - 12 * markerScale} y={GRID.y + (handleZone.y + handleZone.height) * GRID.cell - 12 * markerScale} width={24 * markerScale} height={24 * markerScale} rx={3 * markerScale} fill="#f1cd86" stroke="#283c30" strokeWidth="2" vectorEffect="non-scaling-stroke" /><path d={`M${GRID.x + (handleZone.x + handleZone.width) * GRID.cell - 5 * markerScale} ${GRID.y + (handleZone.y + handleZone.height) * GRID.cell + 5 * markerScale}l${10 * markerScale} ${-10 * markerScale}`} stroke="#283c30" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" /></g>}
        {drawing && anchor && <rect x={GRID.x + Math.min(anchor.x, cursor.x) * GRID.cell} y={GRID.y + Math.min(anchor.y, cursor.y) * GRID.cell} width={(Math.abs(anchor.x - cursor.x) + 1) * GRID.cell} height={(Math.abs(anchor.y - cursor.y) + 1) * GRID.cell} fill="#efc86755" stroke="#6b4613" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 3" pointerEvents="none" />}
        <rect className={styles.cursor} data-visible={drawing} x={GRID.x + cursor.x * GRID.cell} y={GRID.y + cursor.y * GRID.cell} width={GRID.cell} height={GRID.cell} fill="#f7d88e33" stroke="#60441c" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </svg>
      </div>
    </div>
    </div>
    {managing && <div className={styles.tools} role="group" aria-label="Outils de la zone sélectionnée"><div className={styles.selectedName}><strong>{selectedValid?.name ?? "Aucune zone"}</strong>{selectedValid && <span>{selectedValid.width * selectedValid.height} m²</span>}</div><div>{([{ code: "inspect", label: "Voir", icon: MousePointer2 }, { code: "move", label: "Déplacer", icon: Move }, { code: "resize", label: "Taille", icon: Scaling }] as const).map(item => <button key={item.code} type="button" data-warehouse-tool={item.code} aria-label={item.code === "resize" ? "Redimensionner la zone" : item.code === "move" ? "Déplacer la zone" : "Observer la zone"} aria-pressed={tool === item.code && !drawing} disabled={item.code !== "inspect" && (selectedLocked || !selectedValid)} onClick={() => setPlanTool(item.code)}><item.icon size={16} />{item.label}</button>)}</div></div>}
    <div className={styles.support}><p className={styles.help} id={`${id}-help`} role="status">{contextMessage}</p><details className={styles.helpDetails} data-warehouse-plan-help><summary><CircleHelp size={16} />Aide</summary><div className={styles.helpBody}>
      <p>Glisse le sol pour déplacer la vue. La molette ajuste le zoom.</p>
      <p><strong>Nouvelle zone :</strong> choisis deux coins. <strong>Déplacer :</strong> glisse la zone. <strong>Taille :</strong> glisse son coin doré.</p>
      <p><strong>Clavier :</strong> flèches pour avancer, Entrée pour choisir, Échap pour annuler. Les changements attendent ton enregistrement.</p>
      <div className={styles.footer}><div className={styles.legend}><span><i />Culture</span><span><i />Séchage</span><span><i />Stockage</span></div><small>{GRID.columns} × {GRID.rows} m · 1 case = 1 m²</small></div>
      <label className={styles.zoomRange}>Zoom<input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={ZOOM_STEP} value={zoom} onChange={event => changeZoom(Number(event.target.value))} aria-label="Zoom du plan" /><output>{zoom}%</output></label>
    </div></details></div>
    <span className={styles.srOnly} role="status" aria-live="polite">Case {cursor.x + 1} sur {GRID.columns}, rangée {cursor.y + 1} sur {GRID.rows}{drawing && anchor ? `, surface ${selectionArea} m²` : ""}.</span>
  </section>;
}
