"use client";
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BrushCleaning, Camera, Check, ChevronDown, Focus, Minus, Pause, Play, Plus, Siren } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { getKqZonePalette } from "@/lib/kanab-quest-zone-identity";
import { getKqWarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { isKqWarehouseHandlingCode, KQ_WAREHOUSE_HANDLING, type KqWarehouseHandlingPlacement } from "@/lib/kanab-quest-warehouse-handling";
import { getKqWarehouseProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { getKqWarehouseDevice, getKqWarehouseDeviceQualityBonus } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseAirCoverage, getKqWarehouseAirMounts, getKqWarehouseAirReach } from "@/lib/kanab-quest-warehouse-air";
import { getKqWarehouseStationCoverage, getKqWarehouseStationEntrance, getKqWarehouseStationReach, KQ_WAREHOUSE_STATIONS } from "@/lib/kanab-quest-warehouse-stations";
import { KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT } from "@/lib/kanab-quest-warehouse-preparations";
import { getKqWarehouseSecurityCoverage, KQ_WAREHOUSE_CAMERA_BEARINGS } from "@/lib/kanab-quest-warehouse-security";
import { isGrowRoomInspectionZone, roomSectorKey, type KqAffectedPlant, type KqGrowRoomEvent, type KqGrowRoomZone, type KqPbiTargeting } from "./KqGrowRoomModel";
import { KqGrowRoomCareOverlay } from "./KqGrowRoomCareOverlay";
import type { WorldInput, WorldPose, createRoomRenderer } from "./KqGrowRoomRenderer";
import { OVERVIEW, cameraScale, clampCamera, projectedFootprint, projectRoomPoint, unprojectFloor, type GrowCamera } from "./KqGrowRoomProjection";
import styles from "./KqGrowRoom.module.css";
import { getGrowRoomShellRegistration } from "./KqGrowRoomShellRegistration";
import { airAnchor, RoomAirFlow, RoomAirModel, RoomStationModel, stationAnchor } from "./KqGrowRoomEquipmentOverlay";
import { findLightingAt, getRoomLightingRows, projectLightingHit, RoomLightingOverlay, type LightingZone } from "./KqGrowRoomLightingOverlay";
import { useGrowRoomWarehouseEditor, WarehouseEditControls, type KqGrowRoomWarehouseEditor } from "./KqGrowRoomWarehouseEditor";

const FallbackPlan = lazy(() => import("./KqGrowRoomFallbackPlan"));

type Point = { x: number; y: number };
type DragPoint = Point & { origin: Point; cell?: string };
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cellKey = (cell: Point) => `${cell.x},${cell.y}`;
const markerOffsets = [0, -44, 44, -88, 88].flatMap(x => [0, -44, 44, -88, 88].map(y => [x, y]))
  .sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
export function KqGrowRoomIsometric({ plan, zones, selected, onSelect, profile, event, motion, visible, staticCare, onKey, affectedPlants, pbiTargeting, warehouseEditor, paused, onTogglePause }: {
  plan: KqWarehouseState; zones: readonly KqGrowRoomZone[]; selected: string | null; onSelect: (index: number) => void;
  profile?: ChanvrierAvatarProfile | null; event?: KqGrowRoomEvent | null; motion: boolean; visible: boolean; staticCare?: boolean;
  onKey: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  affectedPlants?: readonly KqAffectedPlant[]; pbiTargeting?: KqPbiTargeting | null;
  warehouseEditor?: KqGrowRoomWarehouseEditor;
  paused?: boolean; onTogglePause?: () => void;
}) {
  const layout = useMemo(() => getKqWarehouseSpatialLayout(plan), [plan]);
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), proxy = useRef<HTMLSpanElement>(null), warning = useRef<HTMLParagraphElement>(null);
  const runtime = useRef<ReturnType<typeof createRoomRenderer> | null>(null), current = useRef<WorldInput | null>(null);
  const lastPosition = useRef<WorldPose | null>(null);
  const [fallbackPosition, setFallbackPosition] = useState<WorldPose | null>(null);
  const [camera, setCamera] = useState<GrowCamera>(OVERVIEW), [size, setSize] = useState({ width: 640, height: 365 });
  const [renderMode, setMode] = useState<"loading" | "webgl" | "plan">("loading"), [generation, setGeneration] = useState(0);
  const [delivered, setDelivered] = useState<KqGrowRoomEvent | null>(null);
  const [stationsExpanded, setStationsExpanded] = useState(false);
  const stationsId = useId();
  const pointers = useRef(new Map<number, DragPoint>()), dragged = useRef(false);
  const inspectionReady = useRef<{ point: Point; endedAt: number } | null>(null);
  const activeItem = layout.items.find(x => x.id === selected);
  const observing = !warehouseEditor?.managing && !pbiTargeting;
  const actorTargetId = event?.zoneId ?? selected ?? (observing ? zones.find(isGrowRoomInspectionZone)?.id : null) ?? null;
  const actorZone = zones.find(zone => zone.id === actorTargetId);
  const inspectAtRest = observing && !!actorZone && isGrowRoomInspectionZone(actorZone);
  const scale = cameraScale(layout, size.width, size.height, camera.zoom);
  const shell = useMemo(() => getGrowRoomShellRegistration(layout), [layout]);
  const editor = useGrowRoomWarehouseEditor(warehouseEditor, plan, layout);
  const security = warehouseEditor?.security;
  const { cameras, selectedCameraId, showCoverage } = security ?? {};
  const focusedCamera = cameras?.find(camera => camera.id === selectedCameraId);
  const securityCoverage = useMemo(() => {
    if (!showCoverage || !cameras) return null;
    return getKqWarehouseSecurityCoverage(plan, focusedCamera ? [focusedCamera] : cameras);
  }, [plan, cameras, focusedCamera, showCoverage]);
  const securityCells = useMemo(() => {
    if (!securityCoverage) return [];
    const cells = new Map<string, Point & { filmed: boolean }>(Array.from(securityCoverage.visible, key => {
      const [x, y] = key.split(",").map(Number);
      return [key, { x, y, filmed: true }] as const;
    }));
    for (const zone of plan.zones) {
      for (let y = zone.y; y < zone.y + zone.height; y++) for (let x = zone.x; x < zone.x + zone.width; x++) {
        const key = cellKey({ x, y });
        if (!cells.has(key)) cells.set(key, { x, y, filmed: false });
      }
    }
    return [...cells.values()];
  }, [securityCoverage, plan.zones]);
  const dimensions = { columns: layout.width, rows: layout.depth };
  const installedAirCoverage = useMemo(() => getKqWarehouseAirCoverage(plan), [plan]);
  const operatingCultures = useMemo(() => {
    const active = new Set(plan.zones.filter(zone => zone.active).map(zone => zone.id));
    return new Set(zones.filter(zone => active.has(zone.id) && zone.status === "growing" && zone.powered !== false
      && typeof zone.stageIndex === "number" && zone.stageIndex < 5).map(zone => zone.id));
  }, [plan.zones, zones]);
  const runningAir = useMemo(() => new Set(installedAirCoverage?.cells.flatMap(cell =>
    cell.placementId && operatingCultures.has(cell.zoneId) ? [cell.placementId] : [])), [installedAirCoverage, operatingCultures]);
  const animateActivity = motion && visible && !paused;
  const airCursor = warehouseEditor?.airTarget ? editor.cursor : null;
  const airPreview = airCursor ? warehouseEditor?.previewAir?.(airCursor) : undefined;
  const airCoverage = airPreview?.coverage ?? warehouseEditor?.airCoverage
    ?? (warehouseEditor?.selectedAirId ? installedAirCoverage : undefined);
  const visibleAir = airPreview?.coverage?.placements ?? warehouseEditor?.airPlacements ?? plan.airPlacements ?? [];
  const previewPlacement = airPreview?.coverage?.placements.find(item => item.id === warehouseEditor?.airTarget?.id);
  const focusedAir = (airPreview?.error ? undefined : airPreview?.placement) ?? previewPlacement ?? visibleAir.find(item => item.id === warehouseEditor?.selectedAirId);
  const airWithReach = airCoverage || focusedAir ? visibleAir.map(item => ({
    item, cells: getKqWarehouseAirReach(item, dimensions, plan.partitions),
  })) : [];
  const reachCount = new Map<string, number>();
  for (const { cells } of airWithReach) for (const point of cells) {
    const key = cellKey(point);
    reachCount.set(key, (reachCount.get(key) ?? 0) + 1);
  }
  const reach = focusedAir ? airWithReach.find(({ item }) => item.id === focusedAir.id)?.cells
    ?? getKqWarehouseAirReach(focusedAir, dimensions, plan.partitions)
    : [...new Map(airWithReach.flatMap(({ cells }) => cells.map(cell => [cellKey(cell), cell] as const))).values()];
  const focusedReach = new Set(reach.map(cellKey));
  const hasOverlap = reach.some(cell => (reachCount.get(cellKey(cell)) ?? 0) > 1);
  const airMount = warehouseEditor?.airTarget?.mount;
  const airAnchors = airMount ? Array.from({ length: layout.width * layout.depth }, (_, index) => ({
    x: index % layout.width, y: Math.floor(index / layout.width),
  })).filter(cell => getKqWarehouseAirMounts(cell, dimensions, plan.partitions).some(mount =>
    mount.face === airMount.face && mount.partitionId === airMount.partitionId)) : [];
  const stationCursor = warehouseEditor?.stationTarget ? editor.cursor : null;
  const handlingCursor: KqWarehouseHandlingPlacement | null = warehouseEditor?.handlingTarget && editor.cursor ? { code: warehouseEditor.handlingTarget.code, ...editor.cursor } : null;
  const handlingIssue = handlingCursor ? warehouseEditor?.previewHandling?.(handlingCursor) : undefined;
  const visibleHandling = (plan.handlingPlacements ?? []).filter(item => item.code !== handlingCursor?.code);
  if (handlingCursor) visibleHandling.push(handlingCursor);
  const stationPreview = stationCursor ? warehouseEditor?.previewStation?.(stationCursor) : undefined;
  const visibleStations = stationPreview?.coverage?.placements ?? plan.stationPlacements ?? [];
  const focusedStation = stationPreview?.error ? undefined
    : stationPreview?.placement ?? visibleStations.find(item => item.id === (warehouseEditor?.stationTarget?.id ?? warehouseEditor?.selectedStationId));
  const airlockFocused = focusedStation?.code === "SIM-HYGIENE-03";
  const irrigation = focusedStation?.code === "SIM-WATER-03" ? focusedStation : undefined;
  const stationCoverage = irrigation ? stationPreview?.coverage ?? getKqWarehouseStationCoverage(plan) : undefined;
  const stationReach = irrigation ? getKqWarehouseStationReach(irrigation, dimensions, plan.partitions) : [];
  const stationCells = new Set(stationCoverage?.cells.filter(cell => cell.placementId === focusedStation?.id).map(cellKey));
  const stationEffect = airlockFocused ? `Tout l’entrepôt · Risque sanitaire −${KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT} %`
    : `${stationCells.size} m² servis · ${stationReach.length} m² à portée`;
  const entrance = warehouseEditor?.stationTarget?.code === "SIM-HYGIENE-03" ? getKqWarehouseStationEntrance(dimensions) : null;
  const projectEquipment = (x: number, elevation: number, y: number) => projectRoomPoint(
    x - layout.width / 2, elevation, y - layout.depth / 2, camera, scale, size.width, size.height);
  const lightingRows = useMemo(() => plan.zones.map(zone => ({ zone, lamps: getRoomLightingRows(zone) })), [plan.zones]);
  const pendingLight = warehouseEditor?.placementCode && getKqWarehouseDevice(warehouseEditor.placementCode);
  const resizeZone = editor.activeTool === "resize" && editor.preview && editor.selected
    ? plan.zones.find(zone => zone.id === editor.selected?.id) : undefined;
  const hoveredZone = editor.cursor && editor.zoneAt({ x: editor.cursor.x + .5, y: editor.cursor.y + .5 });
  const targetLightZone = pendingLight && pendingLight.kind === "lighting" && hoveredZone
    && warehouseEditor?.targetZoneIds?.includes(hoveredZone.id) ? plan.zones.find(zone => zone.id === hoveredZone.id) : undefined;
  let lightingPreview: LightingZone | undefined;
  if (editor.valid && editor.preview && resizeZone) {
    lightingPreview = { ...resizeZone, ...editor.preview };
  } else if (targetLightZone && pendingLight) {
    lightingPreview = { ...targetLightZone, lightingCode: pendingLight.code };
  } else if (pendingLight && pendingLight.kind === "lighting" && editor.valid) {
    const rectangle = editor.preview ?? editor.cursorRectangle;
    if (rectangle) lightingPreview = { ...rectangle, id: "preview", active: true, lightingCode: pendingLight.code };
  }
  const anchorPoints = airMount ? airAnchors.map(cell => ({
    cell, screen: projectEquipment(...airAnchor({ ...cell, mount: airMount })),
  })) : [];
  const hitTargets = !pbiTargeting && !warehouseEditor?.onChooseCell && !editor.drawing ? [
    ...(warehouseEditor?.onMoveHandling ? visibleHandling.map(item => ({ item: { ...item, id: item.code }, center: projectEquipment(item.x + .5, .45, item.y + .5),
      active: false, label: KQ_WAREHOUSE_HANDLING[item.code].name, inspect: warehouseEditor.onMoveHandling })) : []),
    ...(warehouseEditor?.onInspectAir ? visibleAir.map(item => ({ item, center: projectEquipment(...airAnchor(item)),
      active: item.id === warehouseEditor.selectedAirId, label: getKqWarehouseDevice(item.code)?.name ?? "Extracteur", inspect: warehouseEditor.onInspectAir })) : []),
    ...(warehouseEditor?.onInspectStation ? visibleStations.map(item => ({ item, center: projectEquipment(...stationAnchor(item)),
      active: item.id === warehouseEditor.selectedStationId, label: KQ_WAREHOUSE_STATIONS[item.code].name, inspect: warehouseEditor.onInspectStation })) : []),
  ] : [];
  const securityMarkers = security?.cameras.flatMap(({ id, placement }, index) => {
    if (!placement) return [];
    const bearing = KQ_WAREHOUSE_CAMERA_BEARINGS.find((_, index) => index === placement.bearing);
    const x = placement.x + .5, y = placement.y + .5;
    return [{ id, anchor: projectEquipment(x, .85, y), direction: bearing && projectEquipment(x + bearing.x * .65, .85, y + bearing.y * .65),
      label: `Caméra ${index + 1} · colonne ${placement.x + 1}, ligne ${placement.y + 1}${bearing ? ` · ${bearing.name}` : ""}`,
      bearingGlyph: bearing?.arrow, alarm: false, action: () => security.onCameraPick(id) }];
  }) ?? [];
  if (security?.alarmInstalled) {
    const threshold = getKqWarehouseStationEntrance(dimensions);
    securityMarkers.push({ id: "alarm", anchor: projectEquipment(threshold.x + .5, 1.72, threshold.y + .5),
      direction: undefined, label: "Alarme active · porte sud", bearingGlyph: undefined, alarm: true, action: security.onAlarmPick });
  }
  const canInspectLighting = !!warehouseEditor?.onInspectLighting && !pbiTargeting && !warehouseEditor.onChooseCell
    && !editor.drawing && editor.activeTool === "inspect";
  const occupiedCenters = hitTargets.map(hit => hit.center);
  if (canInspectLighting && securityMarkers.length) for (const { lamps } of lightingRows) {
    const lamp = lamps[Math.floor(lamps.length / 2)];
    if (lamp) occupiedCenters.push(projectLightingHit(lamp, projectEquipment));
  }
  const canInspectSecurity = !pbiTargeting && !warehouseEditor?.onChooseCell && !editor.drawing && editor.activeTool === "inspect";
  const markerButtons = canInspectSecurity ? securityMarkers.flatMap(marker => {
    const { anchor } = marker;
    if (anchor.x < 0 || anchor.x > size.width || anchor.y < 0 || anchor.y > size.height) return [];
    const candidates = markerOffsets.map(([dx, dy]) => ({
      x: Math.max(23, Math.min(size.width - 23, anchor.x + dx)),
      y: Math.max(23, Math.min(size.height - 23, anchor.y + dy)),
    }));
    const location = candidates.find(point => occupiedCenters.every(other => Math.abs(other.x - point.x) >= 44 || Math.abs(other.y - point.y) >= 44)) ?? candidates[0];
    occupiedCenters.push(location);
    return [{ ...marker, location }];
  }) : [];
  function inspectNearbyLamp(point: Point) {
    if (!canInspectLighting || hitTargets.some(hit => Math.abs(hit.center.x - point.x) < 22 && Math.abs(hit.center.y - point.y) < 22)) return false;
    const hit = findLightingAt(lightingRows, point, projectEquipment, Math.max(8, Math.min(16, scale * .28)));
    if (!hit) return false;
    warehouseEditor?.onInspectLighting?.(hit.zoneId, hit.index);
    return true;
  }
  const servedZones = previewPlacement ? new Set(airPreview?.coverage?.cells.filter(cell => cell.placementId === previewPlacement.id).map(cell => cell.zoneId)).size : 0;
  const inspectedAir = airCoverage?.placements.find(item => item.id === warehouseEditor?.selectedAirId);
  const areaDifference = airPreview?.coverage && warehouseEditor?.airCoverage
    ? airPreview.coverage.cells.filter(cell => cell.placementId !== null).length
      - warehouseEditor.airCoverage.cells.filter(cell => cell.placementId !== null).length
    : 0;
  const areaChange = areaDifference
    ? `${areaDifference > 0 ? "+" : "−"}${Math.abs(areaDifference)} m² sur le plan.`
    : "Surface totale couverte inchangée.";
  let equipmentNotice: string | undefined;
  if (airCursor) {
    const details = previewPlacement ? `${previewPlacement.coveredAreaM2} / ${previewPlacement.capacityM2} m² · ${servedZones} zone${servedZones > 1 ? "s" : ""} · +${getKqWarehouseDeviceQualityBonus(previewPlacement.code)} pts par m² servi · ${previewPlacement.powerWatts} W. ${areaChange} ${reach.length} m² à portée.` : "Choisis une case.";
    equipmentNotice = `Colonne ${airCursor.x + 1}, ligne ${airCursor.y + 1} · ${airPreview?.error ?? details}`;
  } else if (handlingCursor) {
    equipmentNotice = `Colonne ${handlingCursor.x + 1}, ligne ${handlingCursor.y + 1} · ${handlingIssue ?? "Emplacement disponible."}`;
  } else if (stationCursor) {
    const details = focusedStation ? stationEffect : "Choisis une case.";
    equipmentNotice = `Colonne ${stationCursor.x + 1}, ligne ${stationCursor.y + 1} · ${stationPreview?.error ?? details}`;
  } else if (inspectedAir) {
    equipmentNotice = `${getKqWarehouseDevice(inspectedAir.code)?.name ?? "Extracteur"} · ${inspectedAir.coveredAreaM2} m² servis · ${reach.length} m² à portée`;
  } else if (focusedStation) {
    equipmentNotice = `${KQ_WAREHOUSE_STATIONS[focusedStation.code].name} · ${stationEffect}`;
  } else if (warehouseEditor?.lightingZoneId) {
    const lighting = lightingRows.find(({ zone }) => zone.id === warehouseEditor.lightingZoneId);
    if (lighting) {
      const { zone, lamps } = lighting;
      const lamp = lamps[warehouseEditor.lightingIndex ?? -1];
      const status = zones.find(zoneStatus => zoneStatus.id === zone.id);
      const pausedLighting = !zone.active || status?.status === "paused" || status?.powered === false;
      const area = (lamp?.area ?? zone.width * zone.height).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
      const surfaceLabel = pausedLighting ? "m² affectés · Éclairage en pause" : "m² couverts";
      equipmentNotice = !lamps.length ? "Aucun éclairage installé dans cette zone."
        : lamp ? `Lampe ${lamp.index + 1} · Rangée ${lamp.row + 1} · ${area} ${surfaceLabel}`
          : `${lamps.length} lampe${lamps.length > 1 ? "s" : ""} · ${area} ${surfaceLabel}`;
    }
  }
  const focusMap = () => host.current?.focus({ preventScroll: true });
  const labels = useMemo(() => {
    const crops = new Map(plan.zones.map(zone => [zone.id, zone]));
    const states = new Map(zones.map(zone => [zone.id, zone]));
    const placed: { x: number; y: number; halfWidth: number }[] = [];
    return layout.items.flatMap((item, index) => {
      if (item.kind === "partition") return [];
      const point = projectRoomPoint(item.x - item.width / 2 + .17, .32, item.z - item.depth / 2 + .17, camera, scale, size.width, size.height);
      const code = crops.get(item.id)?.buddieCode;
      const portrait = code && states.get(item.id)?.status !== "reserved" ? getBuddieArtwork(code) : "";
      const halfWidth = portrait ? 18 : 10;
      if (point.x < halfWidth || point.x > size.width - halfWidth || point.y < 15 || point.y > size.height) return [];
      return [{ ...point, halfWidth, id: item.id, index, portrait, selected: item.id === selected }];
    }).sort((a, b) => Number(b.selected) - Number(a.selected)).filter(label => {
      // Keep the selected identifier first when adjacent cells coincide on a small screen.
      if (placed.some(other => Math.abs(other.y - label.y) < 16 && Math.abs(other.x - label.x) < other.halfWidth + label.halfWidth)) return false;
      placed.push(label);
      return true;
    });
  }, [plan.zones, zones, layout.items, camera, scale, size, selected]);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const resize = () => { const width = el.clientWidth, height = el.clientHeight; if (width && height) setSize(s => s.width === width && s.height === height ? s : { width, height }); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(el); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const picture = canvas.current, node = host.current; if (!picture || !node) return;
    let active = true, loading = false;
    let lastDelivery: KqGrowRoomEvent | null = null;
    const pose = (p: WorldPose) => {
      lastPosition.current = p;
      const el = proxy.current; if (!el) return;
      el.dataset.worldX = p.x.toFixed(3); el.dataset.worldZ = p.z.toFixed(3); el.dataset.facing = p.yaw.toFixed(3);
      el.dataset.actorState = p.state; el.dataset.actorTarget = p.targetId ?? ""; el.dataset.personalized = String(p.personalized); el.dataset.actorVisible = String(p.visible);
      if (p.deposited !== lastDelivery) { lastDelivery = p.deposited; setDelivered(p.deposited); }
      if (warning.current) { warning.current.hidden = p.state !== "blocked"; if (p.state === "blocked") warning.current.textContent = "Passage obstrué vers " + p.name + "."; }
    };
    async function init() {
      if (loading || !picture) return; loading = true;
      try {
        const { createRoomRenderer } = await import("./KqGrowRoomRenderer"); if (!active) return;
        const engine = createRoomRenderer(picture, pose); runtime.current = engine; if (current.current) engine.update(current.current); setMode("webgl");
      } catch {
        if (active) { runtime.current?.dispose(); runtime.current = null; setMode("plan"); }
      }
    }
    const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { intersection?.disconnect(); void init(); } });
    if (intersection) intersection.observe(node); else void init();
    function lost(e: Event) { e.preventDefault(); setFallbackPosition(lastPosition.current); setMode("plan"); }
    function restored() { setGeneration(g => g + 1); }
    picture.addEventListener("webglcontextlost", lost); picture.addEventListener("webglcontextrestored", restored);
    return () => { active = false; intersection?.disconnect(); picture.removeEventListener("webglcontextlost", lost); picture.removeEventListener("webglcontextrestored", restored); runtime.current?.dispose(); runtime.current = null; };
  }, [generation]);
  useEffect(() => {
    const input = { layout, zones, selected, actorTargetId, inspectAtRest, profile, event, motion, visible, camera, ...size };
    current.current = input; runtime.current?.update(input);
  }, [layout, zones, selected, actorTargetId, inspectAtRest, profile, event, motion, visible, camera, size]);
  function cameraGesture(from: Point, to: Point, factor: number) {
    setCamera(old => {
      const zoom = Math.max(1, Math.min(6, old.zoom * factor));
      const before = unprojectFloor(from.x, from.y, old, cameraScale(layout, size.width, size.height, old.zoom), size.width, size.height);
      const after = unprojectFloor(to.x, to.y, old, cameraScale(layout, size.width, size.height, zoom), size.width, size.height);
      return clampCamera({ zoom, x: old.x + before.x - after.x, z: old.z + before.z - after.z }, layout);
    });
  }
  function zoomBy(factor: number) { const c = { x: size.width / 2, y: size.height / 2 }; cameraGesture(c, c, factor); }
  function local(e: PointerEvent<HTMLDivElement>): Point { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function floorPoint(p: Point): Point {
    const closest = anchorPoints.reduce<{ cell: Point; distance: number } | null>((best, anchor) => {
      const distance = dist(anchor.screen, p);
      return distance < (best?.distance ?? 12) ? { cell: anchor.cell, distance } : best;
    }, null);
    if (closest) return { x: closest.cell.x + .5, y: closest.cell.y + .5 };
    const ground = unprojectFloor(p.x, p.y, camera, scale, size.width, size.height);
    return { x: ground.x + layout.width / 2, y: ground.z + layout.depth / 2 };
  }
  function footprint(rectangle: { x: number; y: number; width: number; height: number }) {
    return projectedFootprint({
      x: rectangle.x + (rectangle.width - layout.width) / 2, z: rectangle.y + (rectangle.height - layout.depth) / 2,
      width: rectangle.width, depth: rectangle.height,
    }, camera, scale, size.width, size.height, 0);
  }
  function gridLine(ax: number, ay: number, bx: number, by: number) {
    const a = projectRoomPoint(ax - layout.width / 2, 0, ay - layout.depth / 2, camera, scale, size.width, size.height);
    const b = projectRoomPoint(bx - layout.width / 2, 0, by - layout.depth / 2, camera, scale, size.width, size.height);
    return `M${a.x} ${a.y}L${b.x} ${b.y}`;
  }
  const resizeHandle = editor.activeTool === "resize" && editor.selected ? projectRoomPoint(
    editor.selected.x + editor.selected.width - layout.width / 2, 0,
    editor.selected.y + editor.selected.height - layout.depth / 2, camera, scale, size.width, size.height,
  ) : null;
  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return; const p = local(e);
    inspectionReady.current = null;
    if (!pointers.current.size) {
      dragged.current = false;
      if (warehouseEditor) {
        focusMap();
        editor.begin(e.pointerId, p, floorPoint(p), !!resizeHandle && dist(p, resizeHandle) <= 22);
      }
    } else {
      dragged.current = true;
      if (warehouseEditor) editor.clearGesture();
    }
    const cell = (e.target as Element).closest<SVGPolygonElement>("[data-pbi-cell]")?.dataset.pbiCell;
    pointers.current.set(e.pointerId, { ...p, origin: p, cell }); e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const p = local(e);
    const old = pointers.current.get(e.pointerId);
    if (!old) {
      if (warehouseEditor && e.pointerType === "mouse") editor.movePointer(e.pointerId, p, floorPoint(p));
      return;
    }
    const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
    if (dist(p, old.origin) > 5) dragged.current = true;
    pointers.current.set(e.pointerId, { ...old, ...p });
    if (warehouseEditor && !other && editor.movePointer(e.pointerId, p, floorPoint(p))) return;
    if (other) cameraGesture(midpoint(old, other), midpoint(p, other), dist(p, other) / Math.max(1, dist(old, other)));
    else if (dragged.current && camera.zoom > 1) cameraGesture(old, p, 1);
  }
  function select(index: number) {
    if (editor.drawing) return;
    if (editor.managing && warehouseEditor && zones[index]) warehouseEditor.onOpenZoneMenu(zones[index].id);
    else onSelect(index);
  }
  function inspectFloor(point: Point) {
    if (!warehouseEditor || editor.drawing) return;
    if (!editor.inside(point)) {
      if (!warehouseEditor.locked && !warehouseEditor.placingBuddie && !warehouseEditor.onChooseCell) warehouseEditor.onDeselect?.();
      return;
    }
    if (!editor.disabled && warehouseEditor.onChooseCell) {
      warehouseEditor.onChooseCell({ x: Math.floor(point.x), y: Math.floor(point.y) });
      return;
    }
    const zone = editor.zoneAt(point);
    if (zone) {
      const index = zones.findIndex(entry => entry.id === zone.id);
      if (index >= 0) select(index);
      return;
    }
    if (editor.disabled) {
      if (!warehouseEditor.locked && !warehouseEditor.placingBuddie) warehouseEditor.onDeselect?.();
      return;
    }
    const wall = (plan.partitions ?? []).find(wall => wall.axis === "x"
      ? Math.floor(point.y) === wall.y && point.x >= wall.x && point.x < wall.x + wall.length
      : Math.floor(point.x) === wall.x && point.y >= wall.y && point.y < wall.y + wall.length);
    if (wall) warehouseEditor.onSelectPartition?.(wall.id);
    else warehouseEditor.onDeselect?.();
  }
  function selectAt(p: Point) {
    if (warehouseEditor) {
      const point = floorPoint(p);
      if (editor.activeTool !== "inspect") return;
      if (inspectNearbyLamp(p)) return;
      const id = renderMode === "webgl" ? runtime.current?.pick(p.x / size.width * 2 - 1, 1 - p.y / size.height * 2) : null;
      const index = zones.findIndex(zone => zone.id === id);
      if (index >= 0 && !warehouseEditor.onChooseCell && !warehouseEditor.placingBuddie) select(index);
      else inspectFloor(point);
      return;
    }
    const ground = unprojectFloor(p.x, p.y, camera, scale, size.width, size.height);
    const hit = (renderMode === "webgl" ? runtime.current?.pick(p.x / size.width * 2 - 1, 1 - p.y / size.height * 2) : null) ??
      layout.items.find(i => i.kind !== "partition" && Math.abs(ground.x - i.x) <= i.width / 2 && Math.abs(ground.z - i.z) <= i.depth / 2)?.id;
    const index = zones.findIndex(z => z.id === hit); if (index >= 0) onSelect(index);
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    const pointer = pointers.current.get(e.pointerId);
    if (!pointer) return;
    const p = local(e);
    const read = !dragged.current && pointers.current.size === 1 && dist(p, pointer.origin) <= 5;
    const edited = warehouseEditor && editor.end(e.pointerId, p, floorPoint(p));
    pointers.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!read || edited) return;
    if (pbiTargeting) {
      if (!pointer.cell || pbiTargeting.busy) return;
      const released = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGPolygonElement>("[data-pbi-cell]");
      const sector = pbiTargeting.eligible.find(cell => roomSectorKey(cell) === pointer.cell);
      if (sector && released?.dataset.pbiCell === pointer.cell) pbiTargeting.onSelect(sector);
    } else if (!pointer.cell) {
      if (warehouseEditor) inspectionReady.current = { point: p, endedAt: performance.now() };
      else selectAt(p);
    }
  }
  function cameraKey(e: KeyboardEvent<HTMLDivElement>) {
    if (warehouseEditor && !(e.repeat && (e.key === "Enter" || e.key === " ")) &&
      editor.key(e.key, e.shiftKey, point => inspectFloor({ x: point.x + .5, y: point.y + .5 }))) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const c = { x: size.width / 2, y: size.height / 2 };
    if (e.key === "+" || e.key === "=") zoomBy(1.35);
    else if (e.key === "-") zoomBy(1 / 1.35);
    else if (e.key === "Home") setCamera(OVERVIEW);
    else if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) cameraGesture(c, { x: c.x + (e.key === "ArrowLeft" ? 45 : e.key === "ArrowRight" ? -45 : 0), y: c.y + (e.key === "ArrowUp" ? 45 : e.key === "ArrowDown" ? -45 : 0) }, 1);
    else return; e.preventDefault();
  }
  const receipt = event?.target && event.target.zoneId === event.zoneId ? event : null;
  const hasDelivery = receipt && delivered?.id === receipt.id && delivered.zoneId === receipt.zoneId;
  const staticResult = renderMode === "plan" || staticCare;
  const deposit = staticResult ? receipt?.target : hasDelivery ? delivered.target : undefined;
  const broom = event?.gesture === "sweep" && staticResult
    ? projectRoomPoint(layout.entry.x, 0, layout.entry.z, camera, scale, size.width, size.height) : null;
  const cleaning = warehouseEditor?.cleaning && projectRoomPoint(layout.entry.x, .8, layout.entry.z, camera, scale, size.width, size.height);
  return <div data-grow-isometric="" className={styles.iso} data-warehouse-map-viewport={warehouseEditor ? "" : undefined}
    data-warehouse-iso-viewport={warehouseEditor ? "" : undefined}>
    <WarehouseEditControls room={editor} focusMap={focusMap} />
    <div className={styles.isoFrame} ref={host} data-grow-camera="" data-zoomed={camera.zoom > 1} data-zoom={camera.zoom.toFixed(3)} data-pan-x={camera.x.toFixed(3)} data-pan-z={camera.z.toFixed(3)} data-renderer={renderMode}
      data-warehouse-overview={warehouseEditor?.managing === false || undefined}
      tabIndex={0} role="group" aria-label={warehouseEditor?.airTarget || warehouseEditor?.stationTarget || warehouseEditor?.handlingTarget
        ? "Emplacement de l’équipement. Toucher une case ou utiliser les flèches puis Entrée. Échap annule."
        : pbiTargeting ? "Cases à traiter. Toucher une case hachurée pour y appliquer le produit, ou utiliser la liste Case à traiter." : "Vue de l’entrepôt. Toucher un poste pour le sélectionner. Pincer pour agrandir. Au clavier, utiliser plus, moins et les flèches."}
      data-warehouse-map={warehouseEditor ? "" : undefined} data-warehouse-iso-map={warehouseEditor ? "" : undefined}
      data-warehouse-editor-tool={warehouseEditor ? editor.activeTool : undefined} data-drawing={warehouseEditor ? !!editor.drawing : undefined}
      aria-describedby={warehouseEditor ? stationsId + "-help" : undefined}
      onClick={warehouseEditor ? () => {
        const ready = inspectionReady.current;
        inspectionReady.current = null;
        if (ready && performance.now() - ready.endedAt < 1000) selectAt(ready.point);
      } : undefined}
      onKeyDown={cameraKey} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={e => {
        pointers.current.delete(e.pointerId); dragged.current = true; if (warehouseEditor) editor.clearGesture();
      }}
      onLostPointerCapture={e => {
        if (e.target === e.currentTarget && pointers.current.delete(e.pointerId)) {
          dragged.current = true; if (warehouseEditor) editor.clearGesture();
        }
      }}>
      <canvas ref={canvas} data-grow-canvas="" className={styles.worldCanvas} aria-hidden="true" />
      <svg viewBox={"0 0 " + size.width + " " + size.height} className={styles.isoOverlay} aria-hidden="true" data-alt-plan={renderMode !== "webgl"}>
        <defs>
          <pattern id={stationsId + "-air-potential"} patternUnits="userSpaceOnUse" width={7} height={7}>
            <path d="M-1 1 1-1M0 7 7 0M6 8 8 6" stroke="#546248" strokeWidth="1" opacity=".72" />
          </pattern>
          <pattern id={stationsId + "-air-overlap"} patternUnits="userSpaceOnUse" width={7} height={7}>
            <path d="M-1 1 1-1M0 7 7 0M6 8 8 6M-1 6 1 8M0 0 7 7M6-1 8 1" stroke="#29453c" strokeWidth="1" opacity=".72" />
          </pattern>
        </defs>
        <polygon className={styles.floorFallback} points={projectedFootprint(shell.slab, camera, scale, size.width, size.height)} />
        {renderMode === "plan" && <Suspense fallback={null}><FallbackPlan profile={profile} position={fallbackPosition} targetId={actorTargetId} event={event} plan={plan} layout={layout} zones={zones} camera={camera}
          scale={scale} width={size.width} height={size.height}/></Suspense>}
        {shell.landmarks.map(id => {
          const at = shell.landmark(id), screen = projectRoomPoint(at.x, 0, at.z, camera, scale, size.width, size.height);
          return <circle key={id} data-grow-landmark={id} data-world-x={at.x} data-world-z={at.z} cx={screen.x} cy={screen.y} r={0}/>;
        })}
        {(editor.drawing || warehouseEditor?.onChooseCell) && <path className={styles.editorGrid} d={[
          ...Array.from({ length: layout.width + 1 }, (_, x) => gridLine(x, 0, x, layout.depth)),
          ...Array.from({ length: layout.depth + 1 }, (_, y) => gridLine(0, y, layout.width, y)),
        ].join("")} />}
        {layout.items.map(item => <polygon key={item.id} data-grow-footprint={item.id} data-kind={item.kind} data-world-x={item.x} data-world-z={item.z}
          data-width={item.width} data-depth={item.depth} data-rotation={item.rotation}
          data-selected={(item.kind === "partition" ? warehouseEditor?.selectedPartitionId : selected) === item.id}
          data-grow-bay={item.kind === "partition" ? undefined : item.id} data-grow-floor-zone={item.kind === "partition" ? undefined : item.id}
          data-buddie-target={warehouseEditor?.placingBuddie && item.kind === "culture" ? !warehouseEditor.lockedZoneIds?.includes(item.id) : undefined}
          data-warehouse-effect-zone={warehouseEditor?.effectZoneId === item.id || undefined}
          data-equipment-target={warehouseEditor?.targetZoneIds?.includes(item.id) || undefined}
          data-buddie-drop={warehouseEditor?.placingBuddie && warehouseEditor.buddieDrop?.zoneId === item.id ? warehouseEditor.buddieDrop.allowed ? "valid" : "invalid" : undefined}
          points={projectedFootprint(item, camera, scale, size.width, size.height)} />)}
        {securityCells.map(cell => <polygon key={cellKey(cell)} data-security-coverage-cell={cellKey(cell)}
          data-security-filmed={cell.filmed} points={footprint({ ...cell, width: 1, height: 1 })} />)}
        {lightingRows.filter(({ zone }) => zone.id !== lightingPreview?.id).map(({ zone, lamps }) => {
          const status = zones.find(item => item.id === zone.id);
          const state = !lamps.length ? "unlit" : !zone.active || status?.status === "paused" || status?.powered === false ? "paused" : "lit";
          const index = warehouseEditor?.lightingIndex;
          return <RoomLightingOverlay key={zone.id} zoneId={zone.id} lamps={lamps} state={state}
            showCoverage={warehouseEditor?.lightingZoneId === zone.id}
            lightingIndex={warehouseEditor?.lightingZoneId === zone.id && index !== undefined && index >= 0 && index < lamps.length ? index : undefined}
            flat={renderMode === "plan"} working={operatingCultures.has(zone.id) && state === "lit"} project={projectEquipment} zoom={camera.zoom} />;
        })}
        {lightingPreview && <RoomLightingOverlay zoneId={lightingPreview.id} lamps={getRoomLightingRows(lightingPreview)}
          state="preview" showCoverage flat={renderMode === "plan"} project={projectEquipment} zoom={camera.zoom} />}
        {reach.map(cell => {
          const key = cellKey(cell);
          const overlap = (reachCount.get(key) ?? 0) > 1;
          const projected = footprint({ ...cell, width: 1, height: 1 });
          return <g key={key} data-air-reach-cell={key} data-air-overlap={overlap || undefined}>
            <polygon className={styles.airReach} points={projected} />
            <polygon points={projected} style={{ fill: `url(#${stationsId}-air-${overlap ? "overlap" : "potential"})` }} />
          </g>;
        })}
        {airCoverage?.cells.map(cell => <polygon key={cellKey(cell)} data-air-coverage-cell data-covered={cell.placementId !== null}
          data-air-zone={cell.zoneId} data-air-device={cell.placementId ?? undefined}
          data-air-coverage-state={cell.placementId && (!focusedAir || cell.placementId === focusedAir.id) ? "served"
            : focusedReach.has(cellKey(cell)) ? "potential" : "unserved"}
          points={footprint({ ...cell, width: 1, height: 1 })} />)}
        {airAnchors.map(cell => <polygon key={cellKey(cell)} data-air-anchor-cell={cellKey(cell)}
          points={footprint({ ...cell, width: 1, height: 1 })} />)}
        {anchorPoints.map(({ cell, screen }) => <circle key={cellKey(cell)} data-air-anchor-point={cellKey(cell)}
          data-current={airCursor?.x === cell.x && airCursor?.y === cell.y || undefined} cx={screen.x} cy={screen.y} r={3.5} />)}
        {airlockFocused && <polygon data-airlock-protection="building"
          points={footprint({ x: 0, y: 0, width: layout.width, height: layout.depth })} />}
        {stationReach.map(cell => {
          const served = stationCells.has(cellKey(cell));
          const projected = footprint({ ...cell, width: 1, height: 1 });
          return <g key={cellKey(cell)}>
            <polygon data-station-reach-cell={cellKey(cell)} data-station-served={served} points={projected} />
            {!served && <polygon points={projected} style={{ fill: `url(#${stationsId}-air-potential)` }} />}
          </g>;
        })}
        {entrance && <polygon data-station-entrance={cellKey(entrance)} points={footprint({ ...entrance, width: 1, height: 1 })} />}
        {airWithReach.filter(({ item }) => !focusedAir || item.id === focusedAir.id).map(({ item, cells }) =>
          <RoomAirFlow key={item.id} item={item} cells={cells} project={projectEquipment} moving={animateActivity && runningAir.has(item.id) && item.id !== warehouseEditor?.airTarget?.id} />)}
        {visibleAir.map(item => <g key={item.id} data-air-marker={item.id} data-air-mount={item.mount?.kind ?? "floor"} data-air-elevation={airAnchor(item)[1]}
          data-air-face={item.mount?.face} data-air-partition={item.mount?.partitionId}
          data-equipment-ghost={item.id === warehouseEditor?.airTarget?.id && !!previewPlacement || undefined}
          data-air-ghost={item.id === warehouseEditor?.airTarget?.id && !!previewPlacement || undefined}>
          <RoomAirModel item={item} project={projectEquipment} flat={renderMode === "plan"}
            running={runningAir.has(item.id) && item.id !== warehouseEditor?.airTarget?.id} animate={animateActivity} />
        </g>)}
        {visibleStations.map(item => <g key={item.id} data-station-marker={item.id} data-station-model={item.code}
          data-equipment-ghost={item.id === warehouseEditor?.stationTarget?.id || undefined}>
          <RoomStationModel item={item} project={projectEquipment}
            preparing={item.id === warehouseEditor?.irrigationPreparing && item.id !== warehouseEditor?.stationTarget?.id} animate={animateActivity} />
        </g>)}
        {visibleHandling.map(item => {
          const floor = projectEquipment(item.x + .5, .02, item.y + .5);
          const side = Math.max(36, scale * 1.35);
          return <g key={item.code} data-handling-marker={item.code} data-x={item.x} data-y={item.y}
            data-equipment-ghost={handlingCursor?.code === item.code || undefined}>
            <polygon points={footprint({ ...item, width: 1, height: 1 })} fill="#f8e9b7" stroke="#38534b" strokeWidth="1.2" />
            <image href={getKqWarehouseProductArtwork(item.code)?.src} x={floor.x - side / 2} y={floor.y - side * .88} width={side} height={side} />
          </g>;
        })}
        {editor.cursorRectangle && <polygon data-warehouse-cursor="" data-air-invalid={!!airPreview?.error || !!stationPreview?.error || !!handlingIssue || undefined} points={footprint(editor.cursorRectangle)} />}
        {editor.preview && <polygon data-warehouse-preview="" data-valid={editor.valid} points={footprint(editor.preview)} />}
        {resizeHandle && <g data-warehouse-resize-handle="" transform={`translate(${resizeHandle.x} ${resizeHandle.y})`}>
          <circle r={12}/><path d="M-5 5 5-5 M0-5h5v5 M-5 0v5h5" />
        </g>}
        <KqGrowRoomCareOverlay layout={layout} zones={zones} camera={camera} scale={scale} {...size} flat={renderMode !== "webgl"}
          affected={affectedPlants} eligible={pbiTargeting?.eligible} deposit={deposit} depositKind={receipt?.gesture === "pbi" ? "pbi" : "input"}
          pending={receipt && !deposit ? receipt.target : undefined}/>
        {broom && !cleaning && <g data-grow-static-gesture="sweep" className={styles.deposit} transform={`translate(${broom.x} ${broom.y})`}>
          <path d="m-8-3 15-22" stroke="#412f27" strokeWidth="4" strokeLinecap="round"/>
          <path d="m-8-3 15-22" stroke="#ca9a57" strokeWidth="2" strokeLinecap="round"/>
          <path d="m-13-7 11 6-3 5-14-6Z" fill="#e8bd65" stroke="#4d412e" strokeWidth="1.5"/>
          <path d="m-14-4-2 3m5-2-2 3m5-1-2 3" stroke="#966934" strokeWidth="1.3"/>
        </g>}
        {cleaning && <g data-cleaning-activity={warehouseEditor?.cleaning} className={styles.cleaningActivity} transform={`translate(${cleaning.x} ${cleaning.y})`}>
          <circle r={12} />
          <BrushCleaning x={-8} y={-8} size={16} />
        </g>}
        {markerButtons.map(({ id, anchor, direction, location }) => <g key={id} className={styles.securityLeader}>
          {dist(anchor, location) > 2 && <line x1={anchor.x} y1={anchor.y} x2={location.x} y2={location.y} />}
          {direction && <line x1={anchor.x} y1={anchor.y} x2={direction.x} y2={direction.y} />}
          <circle cx={anchor.x} cy={anchor.y} r={2.8} />
        </g>)}
      </svg>
      {markerButtons.map(({ id, location, label, bearingGlyph, alarm, action }) => {
        const Icon = alarm ? Siren : Camera;
        return <button key={id} type="button" className={styles.securityMarker} style={{ left: location.x, top: location.y }}
          aria-label={label} aria-pressed={alarm ? undefined : security?.selectedCameraId === id}
          data-security-camera-hit={alarm ? undefined : id} data-security-alarm-hit={alarm || undefined}
          onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); action(); }}><Icon size={16} aria-hidden="true" />{bearingGlyph && <span aria-hidden="true">{bearingGlyph}</span>}</button>;
      })}
      {canInspectLighting &&
        lightingRows.map(({ zone, lamps }) => {
          const lamp = lamps[Math.floor(lamps.length / 2)];
          if (!lamp) return null;
          const center = projectLightingHit(lamp, projectEquipment);
          if (center.x < 22 || center.x > size.width - 22 || center.y < 22 || center.y > size.height - 22
            || hitTargets.some(hit => dist(hit.center, center) < 27)) return null;
          return <button key={zone.id} type="button" className={styles.equipmentHotspot} style={{ left: center.x, top: center.y }}
            aria-label={`Examiner l’éclairage · ${zones.find(item => item.id === zone.id)?.name ?? zone.name}`}
            aria-pressed={zone.id === warehouseEditor?.lightingZoneId} data-lighting-hit={zone.id}
            data-lighting-hotspot-selected={zone.id === warehouseEditor?.lightingZoneId && lamp.index === warehouseEditor?.lightingIndex || undefined}
            onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation();
              const bounds = host.current?.getBoundingClientRect();
              if (event.detail > 0 && bounds && inspectNearbyLamp({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })) return;
              warehouseEditor?.onInspectLighting?.(zone.id);
            }} />;
        })}
      {hitTargets.map(({ item, center, active, label, inspect }) => center.x >= 22 && center.x <= size.width - 22
        && center.y >= 22 && center.y <= size.height - 22 &&
        <button key={item.id} type="button" className={styles.equipmentHotspot} style={{ left: center.x, top: center.y }}
          aria-label={`${isKqWarehouseHandlingCode(item.code) ? "Déplacer" : "Voir la portée"} · ${label} · colonne ${item.x + 1}, ligne ${item.y + 1}`} aria-pressed={isKqWarehouseHandlingCode(item.code) ? undefined : active}
          data-warehouse-equipment-hit={item.id}
          onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); inspect?.(item.id); }} />)}
      {renderMode !== "loading" && !pbiTargeting && labels.filter(label => label.id !== warehouseEditor?.lightingZoneId).map(label => <span key={label.id} aria-hidden="true" data-grow-zone-label={label.id} data-selected={label.selected}
        className={styles.isoLabel} style={{ left: label.x, top: label.y, backgroundColor: getKqZonePalette(label.index).color }}>
        {String(label.index + 1).padStart(2, "0")}{label.portrait && <span className={styles.zonePortrait} style={{ backgroundImage: `url("${label.portrait}")` }} />}
      </span>)}
      <span hidden ref={proxy} data-grow-actor={profile ? "player" : "visitor"} />
    </div>
    <div className={styles.cameraBar}>
      <span>{layout.width} × {layout.depth} m{renderMode === "plan" ? " · Vue illustrée" : ""}
        {cleaning && ` · ${warehouseEditor?.cleaning === "vacuum" ? "Aspiration" : "Lavage"} en cours`}
        {warehouseEditor?.irrigationPreparing && " · Mélange en préparation"}</span>
      <div className={styles.tools}>
        <button data-grow-zoom-out="" type="button" disabled={camera.zoom <= 1.001} aria-label="Dézoomer" onClick={() => zoomBy(1 / 1.4)}><Minus size={16} /></button>
        <button data-grow-zoom-in="" type="button" disabled={camera.zoom >= 5.999} aria-label="Zoomer" onClick={() => zoomBy(1.4)}><Plus size={16} /></button>
        <button data-grow-reset="" type="button" aria-label="Revenir à la vue générale" onClick={() => setCamera(OVERVIEW)}><Focus size={16} /></button>
        {onTogglePause && <button type="button" aria-label={paused ? "Reprendre l’animation de l’entrepôt" : "Mettre l’animation de l’entrepôt en pause"}
          aria-pressed={paused} onClick={onTogglePause}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>}
      </div>
    </div>
    {(airCoverage || focusedStation) && <ul className={styles.coverageLegend} aria-label="Légende de la couverture">
      {airlockFocused && <li><span data-swatch="airlock" />Tout l’entrepôt protégé par le sas</li>}
      {(irrigation || airCoverage) && <><li><span data-swatch="served" />Surface servie</li>
        <li><span data-swatch="potential" />Portée possible</li></>}
      {airCoverage && <li><span data-swatch="unserved" />Culture non desservie</li>}
      {airCoverage && hasOverlap && <li><span data-swatch="overlap" />Portées superposées</li>}
    </ul>}
    {securityCoverage && <ul className={styles.coverageLegend} aria-label="Légende de la couverture des caméras">
      <li><span data-swatch="filmed" />{focusedCamera && cameras ? `Caméra ${cameras.indexOf(focusedCamera) + 1} · ` : ""}
        {focusedCamera?.placement === null ? "En réserve" : `${securityCoverage.visible.size} m² filmés`}</li>
      {securityCoverage.zones.some(zone => zone.covered < zone.area) && <li><span data-swatch="unfilmed" />Culture hors champ</li>}
    </ul>}
    {warehouseEditor && <p id={stationsId + "-help"} className={styles.editorHint} role="status">
      {equipmentNotice ?? warehouseEditor.interactionHint ?? (editor.preview
        ? `${editor.preview.width} × ${editor.preview.height} m · ${editor.preview.width * editor.preview.height} m²${editor.valid ? "" : " · Chevauchement"}`
        : editor.notice || (editor.drawing
          ? "Un clic pose 1 m². Glisse pour tracer une surface. Au clavier, marque les deux coins avec Entrée et les flèches."
          : editor.activeTool === "move" ? "Glisse la zone ou déplace-la avec les flèches."
          : editor.activeTool === "resize" ? "Glisse la poignée ou ajuste la surface avec les flèches."
          : zones.length ? "Sélectionne un poste dans la vue ou dans la liste." : visibleHandling.length ? "Touche un équipement pour le déplacer." : "Ouvre Aménager pour choisir ton premier équipement."))}
    </p>}
    {zones.length > 4 && !pbiTargeting && <button type="button" data-grow-toggle-posts="" className={`${styles.stationChoice} ${styles.stationDisclosure}`}
      aria-expanded={stationsExpanded} aria-controls={stationsId} onClick={() => setStationsExpanded(!stationsExpanded)}>
      {zones.length} postes <ChevronDown size={16} aria-hidden="true"/>
    </button>}
    {zones.length > 0 && !pbiTargeting && <div id={stationsId} className={styles.posts} data-grow-posts="" data-collapsed={zones.length > 4 && !stationsExpanded} role="group" aria-label="Postes de l’entrepôt">
      {zones.map((zone, i) => <button type="button" key={zone.id} data-grow-pick={zone.id} data-warehouse-zone-chip={warehouseEditor ? zone.id : undefined} data-station-kind={zone.kind ?? "culture"}
        className={styles.stationChoice} aria-pressed={selected === zone.id} aria-label={zone.name + " · " + (zone.kind === "drying" ? "Séchoir" : zone.kind === "storage" ? "Stockage" : "Culture")}
        disabled={!!editor.drawing || !!warehouseEditor?.onChooseCell} onClick={() => select(i)}
        onKeyDown={warehouseEditor ? undefined : e => onKey(e, i)}>{selected === zone.id && <Check size={13} aria-hidden="true" />}{zone.name}</button>)}
    </div>}
    {editor.managing && warehouseEditor?.onSelectPartition && !!plan.partitions?.length && <div className={styles.posts} role="group" aria-label="Parois de l’entrepôt">
      {plan.partitions.map((wall, i) => <button key={wall.id} type="button" className={styles.stationChoice}
        data-warehouse-partition={wall.id} disabled={editor.disabled || !!editor.drawing || !!warehouseEditor.onChooseCell} aria-pressed={wall.id === warehouseEditor.selectedPartitionId}
        onClick={() => warehouseEditor.onSelectPartition?.(wall.id)}>Paroi {i + 1} · {wall.length} m</button>)}
    </div>}
    {!editor.managing && <p ref={warning} hidden className={styles.blocked} role="status" />}
    {activeItem && <span hidden data-selected-world-id={activeItem.id} />}
  </div>;
}
