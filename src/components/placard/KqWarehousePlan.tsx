"use client";

import { KqHelpDashboard, KqHelpGrid } from "./KqHelpDashboard";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { KQ_WAREHOUSE_ART_FRAMES, KQ_WAREHOUSE_ROOM_ARTWORK } from "@/lib/kanab-quest-warehouse-artwork";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Focus, Grid2X2, Maximize2, Minimize2, Plus, Minus, Move, MousePointer2, Scaling, Scan, CircleHelp, Sprout, Wind, Package } from "lucide-react";
import { doKqWarehouseZonesOverlap, getKqWarehousePartitionBounds, type KqWarehousePartition, type KqWarehouseZone, type KqWarehouseServiceZone } from "@/lib/kanab-quest-warehouse";
import { getKqZoneIdentity } from "@/lib/kanab-quest-zone-identity";
import { getKqWarehouseAirCoverage, getKqWarehouseAirReach, type KqWarehouseAirPlacement } from "@/lib/kanab-quest-warehouse-air";
import { KQ_WAREHOUSE_HANDLING, type KqWarehouseHandlingPlacement } from "@/lib/kanab-quest-warehouse-handling";
import { getKqWarehouseStationCoverage, getKqWarehouseStationReach, KQ_WAREHOUSE_STATIONS, type KqWarehouseStationPlacement } from "@/lib/kanab-quest-warehouse-stations";
import { KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT } from "@/lib/kanab-quest-warehouse-preparations";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { KqWarehousePlanFixtures, SceneDefinitions } from "./KqWarehousePlanArt";
export { KqWarehouseObject, KqWarehouseModuleObject } from "./KqWarehousePlanArt";
import styles from "./KqWarehousePlan.module.css";

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
type CellTap = { pointerId: number; point: Point; partitionId?: string; client: Point; startedAt: number; moved: boolean };
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

export function KqWarehousePlan({ zones, serviceZones, dimensions, roomArtwork, interactionHint, selectedId, drawing, drawingKind, anchor, cursor, zoom, locked, growing, managing = true, activeZoneIds, lockedZoneIds = [], productionReservedZoneId, placingBuddie = false, buddieDrop, airPlacements, stationPlacements, handlingPlacements, partitions = [], selectedPartitionId, onChooseCell, onSelectPartition, onZoom, onDrawingKind, onToggleDrawing, onSelectPoint, onDrawZone, onConfigureZone, onOpenZoneMenu, onCursor, onKeyDown, onTransformZone }: {
  zones: KqWarehouseZone[]; serviceZones: KqWarehouseServiceZone[]; selectedId: string | null; drawing: boolean; drawingKind: ZoneKind; anchor: Point | null; cursor: Point;
  dimensions?: { columns: number; rows: number };
  roomArtwork?: string;
  interactionHint?: string;
  managing?: boolean; activeZoneIds?: string[]; lockedZoneIds?: string[]; productionReservedZoneId?: string;
  placingBuddie?: boolean; buddieDrop?: { zoneId: string | null; allowed: boolean } | null;
  zoom: number; locked: boolean; growing: boolean; onZoom: (zoom: number) => void; onToggleDrawing: () => void;
  onDrawingKind: (kind: ZoneKind) => void;
  onSelectPoint: (point: Point) => void; onCursor: (point: Point) => void; onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
  onDrawZone: (start: Point, end: Point) => boolean;
  onConfigureZone: (zoneId: string) => void;
  /** Read-only menu access; edit actions retain their own lock checks. */
  onOpenZoneMenu?: (zoneId: string) => void;
  /** Opt-in single-cell construction; historical drawing/tutorial consumers keep their controls. */
  onChooseCell?: (point: Point) => void;
  partitions?: KqWarehousePartition[];
  airPlacements?: KqWarehouseAirPlacement[];
  stationPlacements?: KqWarehouseStationPlacement[];
  handlingPlacements?: KqWarehouseHandlingPlacement[];
  selectedPartitionId?: string | null;
  onSelectPartition?: (id: string) => void;
  onTransformZone: (zoneId: string, patch: ZoneRectangle) => void;
}) {
  const legacy = dimensions?.columns === 40 && dimensions.rows === 25;
  const choosingCells = !!onChooseCell && managing && !placingBuddie;
  const zoomEnabled = legacy || choosingCells;
  const maxZoom = legacy ? MAX_ZOOM : 300;
  const { grid: GRID, width: sceneWidth, height: sceneHeight } = legacy ? KQ_WAREHOUSE_ART_FRAMES.legacy : KQ_WAREHOUSE_ART_FRAMES.compact;
  const layoutKey = `${GRID.columns}x${GRID.rows}`;
  const id = `warehouse-plan-${useId().replaceAll(":", "")}`;
  const section = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const map = useRef<SVGSVGElement>(null);
  const gesture = useRef<PlanGesture | null>(null);
  const inspectionTap = useRef<InspectionTap | null>(null);
  const inspectionReady = useRef<{ zoneId: string; endedAt: number } | null>(null);
  const cellTap = useRef<CellTap | null>(null);
  const cellReady = useRef<{ point: Point; partitionId?: string; endedAt: number } | null>(null);
  const releaseScrollLock = useRef<(() => void) | null>(null);
  const pendingCamera = useRef<CameraTarget | null>(null);
  const framedSelection = useRef<{ initialized: boolean; id: string | null; layout: string }>({ initialized: false, id: null, layout: layoutKey });
  const suppressClick = useRef(false);
  const [grid, setGrid] = useState(!!onChooseCell);
  const [coverageId, setCoverageId] = useState("");
  const fan = airPlacements?.find(item => item.id === coverageId);
  const station = stationPlacements?.find(item => item.id === coverageId);
  const airlockFocused = station?.code === "SIM-HYGIENE-03";
  const irrigation = station?.code === "SIM-WATER-03" ? station : undefined;
  const reach = fan ? getKqWarehouseAirReach(fan, GRID, partitions) : irrigation ? getKqWarehouseStationReach(irrigation, GRID, partitions) : [];
  const servedCells = fan ? getKqWarehouseAirCoverage({ zones, airPlacements, partitions })?.cells
    : irrigation ? getKqWarehouseStationCoverage({ zones, serviceZones, partitions, airPlacements, stationPlacements })?.cells : undefined;
  const served = new Set(servedCells?.filter(item => item.placementId === coverageId).map(item => `${item.x},${item.y}`));
  const [hoverCell, setHoverCell] = useState<Point | null>(null);
  const [tool, setTool] = useState<PlanTool>("inspect");
  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);
  const [panning, setPanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [notice, setNotice] = useState("");
  const allZones: PlanZone[] = [...zones, ...serviceZones];
  const selectedPartition = partitions.find(partition => partition.id === selectedPartitionId);
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
  const renderedWidth = sceneWidth * baseScale * (zoomEnabled ? clamp(zoom, MIN_ZOOM, maxZoom) / 100 : 1);
  const renderedHeight = sceneHeight * baseScale * (zoomEnabled ? clamp(zoom, MIN_ZOOM, maxZoom) / 100 : 1);
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
  function canChooseCell() {
    return choosingCells && !locked && !drawing && tool === "inspect" && !gesture.current;
  }
  function canSelectPartition(partitionId: string) {
    return managing && !!onSelectPartition && !placingBuddie && !drawing && !gesture.current && partitions.some(partition => partition.id === partitionId);
  }
  function partitionAtCell(point: Point) {
    return partitions.find(partition => partition.axis === "x"
      ? point.y === partition.y && point.x >= partition.x && point.x < partition.x + partition.length
      : point.x === partition.x && point.y >= partition.y && point.y < partition.y + partition.length);
  }
  const resetInspection = useCallback(() => {
    inspectionTap.current = null;
    inspectionReady.current = null;
    cellTap.current = null;
    cellReady.current = null;
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
  function finishCellInspection(event: PointerEvent<SVGSVGElement>) {
    const current = cellTap.current;
    if (!current || current.pointerId !== event.pointerId) return;
    cellTap.current = null;
    const point = pointerCell(event), now = performance.now();
    const available = current.partitionId ? canSelectPartition(current.partitionId) : canChooseCell() && !zoneAtCell(point);
    if (!point || point.x !== current.point.x || point.y !== current.point.y || !available || current.moved
      || now - current.startedAt > TAP_MAX_DURATION || Math.hypot(event.clientX - current.client.x, event.clientY - current.client.y) > TAP_MAX_TRAVEL) {
      suppressClick.current = true; cellReady.current = null; return;
    }
    // The compatibility click must finish on the plan before a dialog is mounted.
    cellReady.current = { point, partitionId: current.partitionId, endedAt: now };
  }

  useEffect(() => {
    const reset = () => { if (inspectionTap.current || inspectionReady.current || cellTap.current || cellReady.current) suppressClick.current = true; resetInspection(); };
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
    if (!zoomEnabled) { pendingCamera.current = null; return; }
    if (!node || !svg || !target) return;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const viewportBounds = node.getBoundingClientRect();
    const originX = bounds.left - viewportBounds.left - node.clientLeft + node.scrollLeft;
    const originY = bounds.top - viewportBounds.top - node.clientTop + node.scrollTop;
    node.scrollTo({ left: originX + target.x * bounds.width - target.offsetX, top: originY + target.y * bounds.height - target.offsetY, behavior: "instant" });
    pendingCamera.current = null;
  }, [zoomEnabled]);
  useLayoutEffect(() => {
    // The centered SVG's pixel dimensions and scroll range must settle together.
    const frame = requestAnimationFrame(applyCamera);
    return () => cancelAnimationFrame(frame);
  }, [zoom, renderedWidth, renderedHeight, applyCamera]);

  const changeZoom = useCallback((value: number, client?: Point) => {
    const node = viewport.current, svg = map.current;
    if (!zoomEnabled || !node || !svg || gesture.current) return;
    const next = clamp(Math.round(value / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, maxZoom);
    if (next === zoom) return;
    const bounds = node.getBoundingClientRect();
    const offsetX = client ? client.x - bounds.left - node.clientLeft : node.clientWidth / 2;
    const offsetY = client ? client.y - bounds.top - node.clientTop : node.clientHeight / 2;
    const boundsSvg = svg.getBoundingClientRect();
    pendingCamera.current = { x: (bounds.left + node.clientLeft + offsetX - boundsSvg.left) / boundsSvg.width, y: (bounds.top + node.clientTop + offsetY - boundsSvg.top) / boundsSvg.height, offsetX, offsetY };
    onZoom(next);
  }, [maxZoom, onZoom, zoom, zoomEnabled]);

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
    const wasInspecting = !!inspectionTap.current || !!inspectionReady.current || !!cellTap.current || !!cellReady.current;
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
    if (inspectionTap.current || cellTap.current) resetInspection();
    inspectionReady.current = null;
    cellReady.current = null;
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
    const cell = pointerCell(event);
    const partitionId = target.closest("[data-partition-id]")?.getAttribute("data-partition-id");
    if (tool === "inspect" && cell && !inspectedZone && (partitionId ? canSelectPartition(partitionId) : canChooseCell())) {
      cellTap.current = { pointerId: event.pointerId, point: cell, partitionId: partitionId ?? undefined,
        client: { x: event.clientX, y: event.clientY }, startedAt: performance.now(), moved: false };
      if (zoomEnabled && zoom > MIN_ZOOM && event.pointerType === "mouse" && viewport.current) {
        gesture.current = { kind: "pan", pointerId: event.pointerId, client: { x: event.clientX, y: event.clientY }, moved: false,
          scroll: { x: viewport.current.scrollLeft, y: viewport.current.scrollTop } };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
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
    } else if (zoomEnabled && event.pointerType === "mouse" && !zoneId && !resizeHandle && viewport.current) {
      resetInspection();
      gesture.current = { kind: "pan", pointerId: event.pointerId, client: { x: event.clientX, y: event.clientY }, moved: false,
        scroll: { x: viewport.current.scrollLeft, y: viewport.current.scrollTop } };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else resetInspection();
  }

  function movePointer(event: PointerEvent<SVGSVGElement>) {
    if (choosingCells && !gesture.current && !drawing) {
      const point = pointerCell(event);
      setHoverCell(previous => previous?.x === point?.x && previous?.y === point?.y ? previous : point);
    }
    const current = gesture.current;
    if (!current) {
      const tap = inspectionTap.current;
      if (tap?.pointerId === event.pointerId && Math.hypot(event.clientX - tap.client.x, event.clientY - tap.client.y) > TAP_MAX_TRAVEL) {
        tap.moved = true;
        inspectionReady.current = null;
      }
      const cell = cellTap.current;
      if (cell?.pointerId === event.pointerId && Math.hypot(event.clientX - cell.client.x, event.clientY - cell.client.y) > TAP_MAX_TRAVEL) {
        cell.moved = true; cellReady.current = null;
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
    if (!current) { finishInspection(event); finishCellInspection(event); return; }
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
    if (current.kind === "pan" && !current.moved) { finishCellInspection(event); return; }
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
    if (!zoomEnabled || !node || !svg || document.activeElement !== svg) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(GRID.x + (cursor.x + .5) * GRID.cell, GRID.y + (cursor.y + .5) * GRID.cell).matrixTransform(matrix);
    const rect = node.getBoundingClientRect();
    node.scrollBy({ left: point.x < rect.left + 25 ? point.x - rect.left - 25 : point.x > rect.right - 25 ? point.x - rect.right + 25 : 0,
      top: point.y < rect.top + 25 ? point.y - rect.top - 25 : point.y > rect.bottom - 25 ? point.y - rect.bottom + 25 : 0 });
  }, [GRID, zoomEnabled, cursor.x, cursor.y]);

  const transform = !selectedLocked && !drawing ? preview : null;
  const handleZone = transform && transform.zoneId === selectedValid?.id ? transform.rectangle : selectedValid;
  const contextMessage = interactionHint ?? (placingBuddie ? buddieDrop?.zoneId ? buddieDrop.allowed ? "Relâche pour affecter ton Buddie." : "Cette zone ne peut pas recevoir ton Buddie." : "Dépose la carte dans une zone libre." : selectedValid && selectedId === productionReservedZoneId ? "Production autonome : zone réservée au personnel." : !managing ? "Glisse un Buddie sur une zone, puis ouvre sa culture." : notice || (drawing ? drawingRectangle ? `${drawingRectangle.width} × ${drawingRectangle.height} m · ${selectionArea} m² · ${drawPreview ? drawPreview.valid ? "Relâche pour tracer la zone." : "Chevauchement : choisis un espace libre." : "Choisis le second coin avec Entrée."}` : "Appuie sur le plan, glisse sans lever le doigt, puis relâche pour tracer."
    : locked ? growing ? "Culture en cours : plan verrouillé." : "Plan verrouillé pour le moment."
    : selectedLocked && selectedValid ? "Culture en cours : cette zone est verrouillée."
    : tool === "move" ? "Glisse la zone pour la déplacer."
    : tool === "resize" ? "Glisse le coin doré pour ajuster la taille."
    : choosingCells ? "Clique sur une case pour l’aménager."
    : onOpenZoneMenu ? "Appuie sur une zone pour l’aménager ou choisir un Buddie." : "Appuie sur une zone pour la sélectionner."));
  const cellMarker = choosingCells && tool === "inspect" ? hoverCell ?? cursor : cursor;
  const creationControls = <div className={styles.zoneCreation}>{!choosingCells && <span>Tracer une nouvelle zone</span>}<div className={styles.zoneTypes} role="group" aria-label="Tracer une nouvelle zone">{ZONE_TYPES.map(type => <button key={type.code} type="button" data-warehouse-action={type.code === "culture" ? "draw" : undefined} data-warehouse-draw-kind={type.code} aria-pressed={drawing && drawingKind === type.code} disabled={locked} onClick={() => { cancelGesture(); setTool("inspect"); setNotice(""); onDrawingKind(type.code); }}><type.icon size={16} />{type.label}</button>)}</div></div>;

  const dimensionRectangle = drawing ? drawingRectangle : transform?.rectangle;
  const dimensionX = dimensionRectangle ? clamp(GRID.x + (dimensionRectangle.x + dimensionRectangle.width / 2) * GRID.cell - 70 * markerScale, 4 * markerScale, sceneWidth - 144 * markerScale) : 0;
  const dimensionY = dimensionRectangle ? Math.max(4 * markerScale, GRID.y + dimensionRectangle.y * GRID.cell - 28 * markerScale) : 0;

  return <section ref={section} className={styles.plan} aria-label="Plan illustré de l’entrepôt" data-warehouse-plan data-fullscreen={fullscreen} data-compact={!legacy} data-fixed-camera={!zoomEnabled} data-cell-builder={choosingCells || undefined}
    onKeyDownCapture={event => {
      if (event.key !== "Escape" || (!gesture.current && tool === "inspect" && !drawing)) return;
      event.preventDefault(); event.stopPropagation(); cancelGesture(); setTool("inspect"); setNotice("Manipulation annulée.");
      if (drawing) onToggleDrawing();
    }}>
    {managing && (choosingCells ? <details className={styles.advanced}><summary>Outils avancés : tracer une zone</summary>{creationControls}</details> : creationControls)}
    {(!!airPlacements?.length || !!stationPlacements?.length) && <label className={styles.coverageChoice}>Couverture d’un équipement
      <select value={fan?.id ?? station?.id ?? ""} onChange={event => setCoverageId(event.target.value)}><option value="">Vue d’ensemble</option>
        {airPlacements?.map(item => <option key={item.id} value={item.id}>{getKqWarehouseDevice(item.code)?.name} · {item.x + 1}, {item.y + 1}</option>)}
        {stationPlacements?.map(item => <option key={item.id} value={item.id}>{KQ_WAREHOUSE_STATIONS[item.code].name} · {item.x + 1}, {item.y + 1}</option>)}
      </select>
      {airlockFocused && <small>Porte sud · Tout l’entrepôt · Risque d’infections, de ravageurs et de virus −{KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT} %</small>}
      {(fan || irrigation) && <small>{served.size} m² desservis en trait plein · portée en pointillés</small>}
    </label>}
    <div className={styles.toolbar}>
      {!legacy && <strong>10 × 10 m · 100 m²</strong>}
      {zoomEnabled && <div className={styles.cameraControls}><button type="button" data-warehouse-action="zoom-out" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(zoom - ZOOM_STEP)} aria-label="Réduire le zoom"><Minus size={15} /></button><output aria-label="Niveau de zoom">{clamp(zoom, MIN_ZOOM, maxZoom)}%</output><button type="button" data-warehouse-action="zoom-in" disabled={zoom >= maxZoom} onClick={() => changeZoom(zoom + ZOOM_STEP)} aria-label="Augmenter le zoom"><Plus size={15} /></button>{legacy && <><span className={styles.divider} /><button type="button" data-warehouse-action="focus" disabled={!selectedValid} onClick={() => selectedValid && frameZone(selectedValid)} aria-label="Centrer la zone sélectionnée" title="Centrer la zone sélectionnée"><Focus size={15} /><span>Ma zone</span></button><button type="button" data-warehouse-action="overview" onClick={overview} aria-label="Voir tout l’entrepôt" title="Voir tout l’entrepôt"><Scan size={15} /><span>Ensemble</span></button></>}</div>}
      <div><button type="button" aria-pressed={grid} aria-label="Afficher la grille" onClick={() => setGrid(value => !value)} title="Afficher la grille"><Grid2X2 size={15} /><span>Grille</span></button>{legacy && <button type="button" data-warehouse-action="fullscreen" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Quitter le plein écran" : "Afficher l’entrepôt en plein écran"} title={fullscreen ? "Quitter le plein écran" : "Plein écran"}>{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}</div>
    </div>
    <div className={styles.scene}>
    <div ref={viewport} className={styles.viewport} data-warehouse-map-viewport data-panning={panning} data-fixed-camera={!zoomEnabled} data-manipulating={manipulating}>
      <div className={styles.canvas} style={{ width: Math.max(viewportSize.width, renderedWidth), height: Math.max(viewportSize.height, renderedHeight) }}>
      <svg ref={map} className={styles.map} style={{ width: renderedWidth, height: renderedHeight }} viewBox={`0 0 ${sceneWidth} ${sceneHeight}`} role={choosingCells || onSelectPartition ? "group" : "img"} aria-label={`Entrepôt illustré vu du dessus, ${(GRID.columns * GRID.rows).toLocaleString("fr-FR")} cases de 1 m² pour culture, séchage et stockage. Flèches pour se déplacer, Entrée pour ${choosingCells ? "aménager la case ou ouvrir ses actions" : "ouvrir la zone ou tracer"}.`} aria-describedby={`${id}-help`} tabIndex={0}
        data-warehouse-map data-grid-origin-x={GRID.x} data-grid-origin-y={GRID.y} data-grid-cell-size={GRID.cell} data-grid-columns={GRID.columns} data-grid-rows={GRID.rows} data-drawing={drawing} data-tool={!selectedLocked && !drawing ? tool : "inspect"}
        onKeyDown={event => {
          setHoverCell(null);
          if (!gesture.current) {
            if (choosingCells && !drawing && tool === "inspect" && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              if (event.repeat) return;
              const zone = zoneAtCell(cursor), partition = partitionAtCell(cursor);
              if (zone) { if (canInspectZone(zone.id) || canConfigureZone(zone.id)) configureZone(zone.id); }
              else if (partition && canSelectPartition(partition.id)) onSelectPartition?.(partition.id);
              else if (!partition && canChooseCell()) onChooseCell?.({ ...cursor });
              return;
            }
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
          if (suppressClick.current) { suppressClick.current = false; cellReady.current = null; return; }
          const readyCell = cellReady.current;
          cellReady.current = null;
          // Touch compatibility clicks round coordinates. For a wall, keep the
          // actual hit target instead of requiring the same side of a grid line.
          const sameCellTarget = readyCell?.partitionId
            ? (event.target as Element).closest("[data-partition-id]")?.getAttribute("data-partition-id") === readyCell.partitionId
            : !!readyCell && !!point && point.x === readyCell.point.x && point.y === readyCell.point.y;
          if (readyCell && sameCellTarget && performance.now() - readyCell.endedAt <= 1000) {
            event.preventDefault(); event.stopPropagation();
            if (readyCell.partitionId) { if (canSelectPartition(readyCell.partitionId)) onSelectPartition?.(readyCell.partitionId); }
            else if (point && canChooseCell() && !zoneAtCell(point)) { onCursor(point); onChooseCell?.({ ...point }); }
            return;
          }
          if (choosingCells && !drawing) return;
          if (drawing && event.detail > 0) return;
          if (point) onSelectPoint(point);
        }}
        onPointerDown={beginGesture} onPointerMove={movePointer} onPointerLeave={() => setHoverCell(null)} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancelGesture(); }}>
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
            <title>{identity.label} · {zone.id === productionReservedZoneId ? "Production autonome" : zoneLabel(zone)} · {area} m²{"active" in zone && !zone.active ? " · en pause" : ""}</title>
            <KqWarehousePlanFixtures zone={zone} grid={GRID} id={id} tint={identity.tint} sharedAir={airPlacements !== undefined}
              inspectLighting={zone.id === selectedId && !placingBuddie && !drawing} growing={activeZoneIds ? activeZoneIds.includes(zone.id) : growing} />
            {zone.id === selectedId && <rect className={styles.selectionOutline} x={x - 2 * markerScale} y={y - 2 * markerScale} width={zone.width * GRID.cell + 4 * markerScale} height={zone.height * GRID.cell + 4 * markerScale} rx={2 * markerScale} fill="none" stroke="#172923" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            <rect className={styles.zoneOutline} x={x} y={y} width={zone.width * GRID.cell} height={zone.height * GRID.cell} fill="transparent" stroke={identity.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <g pointerEvents="none">
              {zone.id !== productionReservedZoneId && !("kind" in zone) && zone.buddieCode && getBuddieArtwork(zone.buddieCode) && <g data-zone-buddie={zone.buddieCode}><defs><clipPath id={`${id}-buddie-${index}`}><circle cx={GRID.x + (zone.x + zone.width / 2) * GRID.cell} cy={GRID.y + (zone.y + zone.height / 2) * GRID.cell} r={Math.min(zone.width, zone.height) * GRID.cell * .36} /></clipPath></defs><image href={getBuddieArtwork(zone.buddieCode)} x={GRID.x + (zone.x + zone.width / 2) * GRID.cell - Math.min(zone.width, zone.height) * GRID.cell * .36} y={GRID.y + (zone.y + zone.height / 2) * GRID.cell - Math.min(zone.width, zone.height) * GRID.cell * .36} width={Math.min(zone.width, zone.height) * GRID.cell * .72} height={Math.min(zone.width, zone.height) * GRID.cell * .72} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-buddie-${index})`} /><circle cx={GRID.x + (zone.x + zone.width / 2) * GRID.cell} cy={GRID.y + (zone.y + zone.height / 2) * GRID.cell} r={Math.min(zone.width, zone.height) * GRID.cell * .36} fill="none" stroke={activeZoneIds?.includes(zone.id) ? "#e8b141" : "#f8f1da"} strokeWidth="2" vectorEffect="non-scaling-stroke" /></g>}
              <g data-zone-number={identity.number} transform={`translate(${x + badgeScale} ${y + badgeScale}) scale(${badgeScale})`}>
                <rect data-zone-badge-background width={badgeWidth} height="25" rx="4" fill={identity.color} stroke="#172923" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
                <text x={badgeWidth / 2} y="11" textAnchor="middle" fill="#172923" fontSize="11" fontWeight="800">{identity.number}</text>
                <text x={badgeWidth / 2} y="21" textAnchor="middle" fill="#172923" fontSize="8.5" fontWeight="700">{area} m²</text>
              </g>
            </g>
          </g>;
        })}
        {(grid || drawing) && <rect x={GRID.x} y={GRID.y} width={GRID.columns * GRID.cell} height={GRID.rows * GRID.cell} fill={`url(#${id}-grid)`} pointerEvents="none" />}
        {partitions.map((partition, index) => {
          if (![partition.x, partition.y, partition.length].every(Number.isFinite) || partition.length < 1) return null;
          const bounds = getKqWarehousePartitionBounds(partition, { columns: GRID.columns, rows: GRID.rows });
          const x = GRID.x + (bounds.x + GRID.columns / 2) * GRID.cell, y = GRID.y + (bounds.z + GRID.rows / 2) * GRID.cell;
          const width = bounds.width * GRID.cell, height = bounds.depth * GRID.cell;
          const targetWidth = Math.max(width, 24 * markerScale), targetHeight = Math.max(height, 24 * markerScale);
          const label = `Paroi ${index + 1}, ${partition.length} m, ${partition.axis === "x" ? "horizontale" : "verticale"}, colonne ${partition.x + 1}, ligne ${partition.y + 1}`;
          return <g key={partition.id} className={styles.partition} data-partition-id={partition.id} data-selected={selectedPartitionId === partition.id}
            role={managing && onSelectPartition ? "button" : undefined} tabIndex={managing && onSelectPartition ? 0 : undefined} aria-label={label} aria-pressed={managing && onSelectPartition ? selectedPartitionId === partition.id : undefined}
            onKeyDown={event => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault(); event.stopPropagation();
              if (!event.repeat && canSelectPartition(partition.id)) onSelectPartition?.(partition.id);
            }} onClick={event => {
              if (event.detail !== 0 || !canSelectPartition(partition.id)) return;
              event.preventDefault(); event.stopPropagation(); onSelectPartition?.(partition.id);
            }}>
            <title>{label}</title>
            {selectedPartitionId === partition.id && <rect x={x - width / 2 - 3 * markerScale} y={y - height / 2 - 3 * markerScale} width={width + 6 * markerScale} height={height + 6 * markerScale} fill="#efc45160" stroke="#172923" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            <rect x={x - width / 2} y={y - height / 2} width={width} height={height} fill="#fff1d6" stroke="#172923" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            <rect className={styles.partitionFocus} x={x - targetWidth / 2 - 3 * markerScale} y={y - targetHeight / 2 - 3 * markerScale} width={targetWidth + 6 * markerScale} height={targetHeight + 6 * markerScale} fill="none" stroke="#08766b" strokeWidth="3" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            <rect data-warehouse-partition-hit x={x - targetWidth / 2} y={y - targetHeight / 2} width={targetWidth} height={targetHeight} fill="transparent" />
          </g>;
        })}
        {airlockFocused && <rect data-airlock-protection="building" x={GRID.x} y={GRID.y}
          width={GRID.columns * GRID.cell} height={GRID.rows * GRID.cell} fill="#0d685b25" stroke="#0b5b4f" strokeWidth="2.5"
          vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        {reach.map(cell => {
          const key = `${cell.x},${cell.y}`, covered = served.has(key);
          return <rect key={key} x={GRID.x + cell.x * GRID.cell} y={GRID.y + cell.y * GRID.cell} width={GRID.cell} height={GRID.cell}
            fill={covered ? "#00bba85e" : "#f6cb4d26"} stroke={covered ? "#075c55" : "#81641b"} strokeWidth="1" strokeDasharray={covered ? undefined : "3 3"} pointerEvents="none" />;
        })}
        {airPlacements?.map(placement => <use key={placement.id} data-air-marker={placement.id} data-equipment-code={placement.code}
          href={`#${id}-air`} x={GRID.x + (placement.x + .3) * GRID.cell} y={GRID.y + (placement.y + .3) * GRID.cell}
          width={GRID.cell * .4} height={GRID.cell * .4} pointerEvents="none" />)}
        {handlingPlacements?.map(item => <image key={item.code} data-handling-marker={item.code} href={getKqWarehouseProductArtwork(item.code)?.src}
          x={GRID.x + item.x * GRID.cell} y={GRID.y + item.y * GRID.cell} width={GRID.cell} height={GRID.cell} pointerEvents="none">
          <title>{KQ_WAREHOUSE_HANDLING[item.code].name}</title></image>)}
        {stationPlacements?.map(item => <image key={item.id} data-station-marker={item.id} href={getKqWarehouseProductArtwork(item.code)?.src}
          x={GRID.x + item.x * GRID.cell} y={GRID.y + item.y * GRID.cell} width={GRID.cell} height={GRID.cell} pointerEvents="none">
          <title>{KQ_WAREHOUSE_STATIONS[item.code].name}</title></image>)}
        {transform && <g pointerEvents="none" data-warehouse-transform-preview data-valid={transform.valid}><rect x={GRID.x + transform.rectangle.x * GRID.cell} y={GRID.y + transform.rectangle.y * GRID.cell} width={transform.rectangle.width * GRID.cell} height={transform.rectangle.height * GRID.cell} fill={transform.valid ? "#c9d7a842" : "#ec735b55"} stroke={transform.valid ? "#f4cf80" : "#ff8f76"} strokeWidth="3" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" /></g>}
        {handleZone && tool === "resize" && !selectedLocked && !drawing && <g data-warehouse-resize-handle className={styles.resizeHandle}><title>Glisser pour redimensionner la zone sélectionnée</title><rect x={GRID.x + (handleZone.x + handleZone.width) * GRID.cell - 22 * markerScale} y={GRID.y + (handleZone.y + handleZone.height) * GRID.cell - 22 * markerScale} width={44 * markerScale} height={44 * markerScale} rx={6 * markerScale} fill="#f1cd86" stroke="#283c30" strokeWidth="2" vectorEffect="non-scaling-stroke" /><path d={`M${GRID.x + (handleZone.x + handleZone.width) * GRID.cell - 8 * markerScale} ${GRID.y + (handleZone.y + handleZone.height) * GRID.cell + 8 * markerScale}l${16 * markerScale} ${-16 * markerScale}`} stroke="#283c30" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" /></g>}
        {drawing && drawingRectangle && <g data-warehouse-draw-preview data-valid={drawPreview?.valid ?? true} data-width={drawingRectangle.width} data-height={drawingRectangle.height} data-area={selectionArea} pointerEvents="none"><rect x={GRID.x + drawingRectangle.x * GRID.cell} y={GRID.y + drawingRectangle.y * GRID.cell} width={drawingRectangle.width * GRID.cell} height={drawingRectangle.height * GRID.cell} fill={drawPreview?.valid === false ? "#ec735b55" : "#efc86755"} stroke={drawPreview?.valid === false ? "#a62d20" : "#6b4613"} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 3" /></g>}
        {dimensionRectangle && <g data-warehouse-preview-dimensions pointerEvents="none"><rect x={dimensionX} y={dimensionY} width={140 * markerScale} height={24 * markerScale} rx={5 * markerScale} fill="#fff1d6" stroke="#172923" strokeWidth="1" vectorEffect="non-scaling-stroke" /><text x={dimensionX + 70 * markerScale} y={dimensionY + 16 * markerScale} textAnchor="middle" fontSize={12 * markerScale} fontWeight="800" fill="#172923">{dimensionRectangle.width} × {dimensionRectangle.height} m · {dimensionRectangle.width * dimensionRectangle.height} m²</text></g>}
        <rect className={styles.cursor} data-warehouse-cell-cursor={choosingCells || undefined} data-visible={drawing || choosingCells && tool === "inspect"} x={GRID.x + cellMarker.x * GRID.cell} y={GRID.y + cellMarker.y * GRID.cell} width={GRID.cell} height={GRID.cell} fill="#f7d88e33" stroke="#60441c" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </svg>
      </div>
    </div>
    </div>
    {managing && (tool !== "inspect" || drawing) && <button className={styles.finishManipulation} type="button" data-warehouse-action="finish-manipulation" onClick={() => { cancelGesture(); setTool("inspect"); if (drawing) onToggleDrawing(); setNotice("Tu peux à nouveau faire défiler la page."); }}>Terminer la manipulation</button>}
    {managing && <div className={styles.tools} role="group" aria-label={selectedPartition ? "Outils de la paroi sélectionnée" : "Outils de la zone sélectionnée"}><div className={styles.selectedName}><strong className={styles.selectedLabel} style={selectedIdentity && !selectedPartition ? { borderColor: selectedIdentity.color } : undefined}>{selectedPartition ? "Paroi" : selectedIdentity?.label ?? (choosingCells ? "Choisis une case" : "Aucune zone")}</strong>{selectedPartition ? <span>{selectedPartition.length} m</span> : selectedValid && <span>{selectedValid.width * selectedValid.height} m²</span>}</div><div className={styles.toolActions}>{selectedPartition && onSelectPartition ? <button type="button" onClick={() => { if (canSelectPartition(selectedPartition.id)) onSelectPartition(selectedPartition.id); }}>Modifier la paroi</button> : ([{ code: "inspect", label: "Voir", icon: MousePointer2 }, { code: "move", label: "Déplacer", icon: Move }, { code: "resize", label: "Taille", icon: Scaling }] as const).map(item => <button key={item.code} type="button" data-warehouse-tool={item.code} aria-label={item.code === "resize" ? "Redimensionner la zone" : item.code === "move" ? "Déplacer la zone" : "Observer la zone"} aria-pressed={tool === item.code && !drawing} disabled={item.code !== "inspect" && (selectedLocked || !selectedValid)} onClick={() => setPlanTool(item.code)}><item.icon size={16} />{item.label}</button>)}</div></div>}
    <div className={styles.support}><p className={styles.help} id={`${id}-help`} role="status">{contextMessage}</p><details className={styles.helpDetails} data-warehouse-plan-help><summary><CircleHelp size={16} />Aide</summary><div className={styles.helpBody}>
      <KqHelpDashboard>
        <KqHelpGrid art="help-plan" items={[
          { label: "Nouvelle zone", value: choosingCells ? "Cliquer sur une case" : "Appuyer → glisser → relâcher", detail: choosingCells ? "Choisir Culture, Stockage, Séchage ou Paroi dans le menu." : "Garder le doigt posé jusqu’au second coin.", art: "help-plan" },
          { label: "Déplacer", value: "Glisser la zone", art: "warehouse" },
          { label: "Redimensionner", value: "Glisser le coin doré", art: "help-plan" },
          { label: onOpenZoneMenu ? "Menu de la zone" : "Sélection", value: "Clic ou appui", detail: onOpenZoneMenu ? "Aménager, Buddies et Supprimer." : "Choisir la zone.", art: "warehouse" },
          { label: "Clavier", value: "Flèches puis Entrée", detail: "Ou choisir une zone par son bouton numéroté.", art: "help-plan" },
          { label: "Dessin au clavier", value: "Entrée aux deux coins", detail: "Échap annule.", art: "help-plan" },
          ...(legacy ? [{ label: "Déplacer la vue", value: "Glisser le sol", detail: "Molette pour le zoom.", art: "warehouse" as const }] : []),
        ]} />
      </KqHelpDashboard>
      <div className={styles.footer}><div className={styles.legend}>{ZONE_TYPES.map(type => <span key={type.code}><type.icon size={14} aria-hidden="true" />{type.label}</span>)}</div><small>{GRID.columns} × {GRID.rows} m · 1 case = 1 m²</small></div>
      {legacy && <label className={styles.zoomRange}>Zoom<input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={ZOOM_STEP} value={zoom} onChange={event => changeZoom(Number(event.target.value))} aria-label="Zoom du plan" /><output>{zoom}%</output></label>}
    </div></details></div>
    <span className={styles.srOnly} role="status" aria-live="polite">Case {cursor.x + 1} sur {GRID.columns}, rangée {cursor.y + 1} sur {GRID.rows}{drawing && drawingRectangle ? `, surface ${selectionArea} m²` : ""}.</span>
  </section>;
}
