import { useRef, useState } from "react";
import { MousePointer2, Move, Scaling } from "lucide-react";
import { doKqWarehouseZonesOverlap, type KqWarehouseState, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import type { getKqWarehouseAirCoverage, getKqWarehouseAirPlacements, KqWarehouseAirPlacement } from "@/lib/kanab-quest-warehouse-air";
import { getKqWarehouseStationEntrance, type getKqWarehouseStationCoverage, type KqWarehouseStationPlacement } from "@/lib/kanab-quest-warehouse-stations";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import type { KqWarehouseHandlingCode } from "@/lib/kanab-quest-warehouse-handling";
import type { KqWarehouseCamera } from "@/lib/kanab-quest-warehouse-security";
import styles from "./KqGrowRoom.module.css";

export type RoomPoint = { x: number; y: number };
type Rectangle = Pick<KqWarehouseZone, "x" | "y" | "width" | "height">;
type ZoneKind = "culture" | "drying" | "storage";
type Tool = "inspect" | "move" | "resize";
type Gesture = { id: number; floor: RoomPoint; screen: RoomPoint; moved: boolean } &
  ({ kind: "draw"; zoneKind: ZoneKind } | { kind: "move" | "resize"; origin: Rectangle & { id: string } });
export type KqGrowRoomWarehouseEditor = {
  selectedId: string | null;
  drawingKind?: ZoneKind | null;
  placementCode?: string;
  targetZoneIds?: readonly string[];
  effectZoneId?: string | null;
  lightingZoneId?: string | null;
  lightingIndex?: number;
  onInspectLighting?: (zoneId: string, index?: number) => void;
  onTargetZone?: (id: string) => boolean;
  locked: boolean;
  managing?: boolean;
  lockedZoneIds?: readonly string[];
  selectedPartitionId?: string | null;
  placingBuddie?: boolean;
  buddieDrop?: { zoneId: string | null; allowed: boolean } | null;
  interactionHint?: string;
  handlingTarget?: { id: string; code: KqWarehouseHandlingCode; initialCell?: RoomPoint };
  previewHandling?: (point: RoomPoint) => string | undefined;
  onMoveHandling?: (code: string) => void;
  airPlacements?: ReturnType<typeof getKqWarehouseAirPlacements>;
  airCoverage?: ReturnType<typeof getKqWarehouseAirCoverage>;
  airTarget?: Pick<KqWarehouseAirPlacement, "id" | "code" | "mount"> & { initialCell?: RoomPoint };
  previewAir?: (point: RoomPoint) => { placement?: KqWarehouseAirPlacement; coverage?: ReturnType<typeof getKqWarehouseAirCoverage>; error?: string };
  selectedAirId?: string | null;
  onInspectAir?: (id: string) => void;
  stationTarget?: Pick<KqWarehouseStationPlacement, "id" | "code"> & { initialCell?: RoomPoint };
  previewStation?: (point: RoomPoint) => { placement?: KqWarehouseStationPlacement; coverage?: ReturnType<typeof getKqWarehouseStationCoverage>; error?: string };
  selectedStationId?: string | null;
  onInspectStation?: (id: string) => void;
  security?: {
    cameras: readonly KqWarehouseCamera[];
    alarmInstalled: boolean;
    selectedCameraId: string | null;
    showCoverage: boolean;
    onCameraPick: (id: string) => void;
    onAlarmPick: () => void;
  };
  cleaning?: "vacuum" | "mop";
  cleaningPlayer?: boolean;
  cleaningStartedAt?: string;
  irrigationPreparing?: string;
  onOpenZoneMenu: (id: string) => void;
  onDrawZone: (start: RoomPoint, end: RoomPoint, kind: ZoneKind) => boolean;
  onTransformZone: (id: string, patch: Rectangle) => boolean;
  onSelectPartition?: (id: string) => void;
  onChooseCell?: (point: RoomPoint) => void;
  onDeselect?: () => void;
  onCancel?: () => void;
};

const tools = [
  { code: "inspect", label: "Voir", name: "Observer les zones", icon: MousePointer2 },
  { code: "move", label: "Déplacer", name: "Déplacer la zone", icon: Move },
  { code: "resize", label: "Taille", name: "Redimensionner la zone", icon: Scaling },
] as const;
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
const rectangleBetween = (a: RoomPoint, b: RoomPoint): Rectangle => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1,
});
const sameRectangle = (a: Rectangle, b: Rectangle) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function useGrowRoomWarehouseEditor(editor: KqGrowRoomWarehouseEditor | undefined, plan: KqWarehouseState, layout: WarehouseSpatialLayout) {
  const [tool, setTool] = useState<Tool>("inspect");
  const [anchor, setAnchor] = useState<RoomPoint | null>(null);
  const [cursor, setCursor] = useState<RoomPoint | null>(null);
  const [pointerPreview, setPointerPreview] = useState<Rectangle | null>(null);
  const [notice, setNotice] = useState("");
  const gesture = useRef<Gesture | null>(null);
  const zones = [...plan.zones, ...(plan.serviceZones ?? [])];
  const selected = zones.find(zone => zone.id === editor?.selectedId);
  const managing = !!editor && editor.managing !== false;
  const disabled = !managing || editor.locked || !!editor.placingBuddie;
  const transformDisabled = disabled || !!editor?.onChooseCell || !selected || !!editor?.lockedZoneIds?.includes(selected.id);
  const drawing = disabled ? null : editor?.drawingKind;
  const activeTool = drawing ? "draw" : transformDisabled ? "inspect" : tool;
  const cellEquipment = editor?.airTarget ?? editor?.stationTarget ?? editor?.handlingTarget;
  const mount = editor?.airTarget?.mount;
  const mode = cellEquipment ? `${cellEquipment.id}:${mount?.face ?? ""}:${mount?.partitionId ?? ""}` : editor?.placementCode;
  const [previousMode, setPreviousMode] = useState(mode);
  if (previousMode !== mode) {
    setPreviousMode(mode);
    setNotice("");
    setAnchor(null);
    const moving = [...(editor?.airPlacements ?? []), ...(plan.stationPlacements ?? [])].find(item => item.id === cellEquipment?.id);
    const entrance = editor?.stationTarget?.code === "SIM-HYGIENE-03"
      ? getKqWarehouseStationEntrance({ columns: layout.width, rows: layout.depth }) : null;
    setCursor(cellEquipment?.initialCell ?? (moving ? { x: moving.x, y: moving.y } : entrance ?? (cellEquipment ? { x: 0, y: 0 } : null)));
    setPointerPreview(null);
    setTool("inspect");
  }
  const cell = (point: RoomPoint) => ({ x: clamp(Math.floor(point.x), layout.width - 1), y: clamp(Math.floor(point.y), layout.depth - 1) });
  const inside = (point: RoomPoint) => point.x >= 0 && point.x < layout.width && point.y >= 0 && point.y < layout.depth;
  const zoneAt = (point: RoomPoint) => zones.find(z => point.x >= z.x && point.x < z.x + z.width && point.y >= z.y && point.y < z.y + z.height);
  const overlaps = (rectangle: Rectangle, ignore?: string) =>
    zones.some(zone => zone.id !== ignore && doKqWarehouseZonesOverlap(rectangle, zone)) ||
    layout.items.some(wall => wall.kind === "partition" && doKqWarehouseZonesOverlap(rectangle, {
      x: wall.x + (layout.width - wall.width) / 2, y: wall.z + (layout.depth - wall.depth) / 2,
      width: wall.width, height: wall.depth,
    }));

  function transform(origin: Rectangle, dx: number, dy: number): Rectangle {
    if (activeTool === "move") return {
      x: clamp(origin.x + dx, layout.width - origin.width), y: clamp(origin.y + dy, layout.depth - origin.height),
      width: origin.width, height: origin.height,
    };
    return { x: origin.x, y: origin.y, width: 1 + clamp(origin.width + dx - 1, layout.width - origin.x - 1),
      height: 1 + clamp(origin.height + dy - 1, layout.depth - origin.y - 1) };
  }
  function clearGesture() {
    gesture.current = null;
    setPointerPreview(null);
    setAnchor(null);
    setCursor(null);
  }
  function chooseTool(next: Tool) {
    clearGesture();
    setNotice("");
    setTool(next);
  }
  function cancel() {
    chooseTool("inspect");
    editor?.onCancel?.();
  }
  function commitDraw(start: RoomPoint, end: RoomPoint) {
    if (!editor || !drawing) return;
    clearGesture();
    const target = start.x === end.x && start.y === end.y ? zoneAt(start) : undefined;
    if (target && editor.onTargetZone) {
      if (!editor.onTargetZone(target.id)) setNotice("Choisis une zone disponible du même type ou une case libre.");
      return;
    }
    if (overlaps(rectangleBetween(start, end))) {
      setNotice("Le tracé chevauche une zone ou une paroi.");
      return;
    }
    editor.onDrawZone(start, end, drawing);
  }
  function commitTransform(rectangle: Rectangle) {
    if (!editor || transformDisabled || !selected || sameRectangle(rectangle, selected)) return;
    if (overlaps(rectangle, selected.id)) {
      setNotice("Le nouvel emplacement chevauche une zone ou une paroi.");
      return;
    }
    if (editor.onTransformZone(selected.id, rectangle)) {
      setNotice(activeTool === "move" ? "Zone déplacée. Enregistre pour confirmer." : "Surface modifiée. Vérifie le devis.");
    }
  }
  function begin(id: number, screen: RoomPoint, floor: RoomPoint, handle: boolean) {
    const at = { id, floor, screen, moved: false };
    if (!disabled && cellEquipment && inside(floor)) setCursor(cell(floor));
    if (drawing && inside(floor)) {
      gesture.current = { ...at, kind: "draw", zoneKind: drawing };
      setPointerPreview(rectangleBetween(anchor ?? cell(floor), cell(floor)));
    } else if (selected && (activeTool === "move" && zoneAt(floor)?.id === selected.id || activeTool === "resize" && handle)) {
      gesture.current = { ...at, kind: activeTool, origin: selected };
    } else return false;
    return true;
  }
  function stillEditable(current: Gesture) {
    if (activeTool !== current.kind) return false;
    if (current.kind === "draw") return current.zoneKind === drawing;
    return selected?.id === current.origin.id && sameRectangle(selected, current.origin);
  }
  function movePointer(id: number, screen: RoomPoint, floor: RoomPoint) {
    const current = gesture.current;
    if (!current || current.id !== id) {
      if (!current && (drawing || cellEquipment) && inside(floor)) {
        const next = cell(floor);
        setCursor(old => old?.x === next.x && old.y === next.y ? old : next);
      }
      return false;
    }
    if (!stillEditable(current)) {
      clearGesture();
      return true;
    }
    current.moved ||= Math.hypot(current.screen.x - screen.x, current.screen.y - screen.y) > 5;
    if (current.kind === "draw") setPointerPreview(rectangleBetween(anchor ?? cell(current.floor), cell(floor)));
    else if (current.moved) setPointerPreview(transform(current.origin, Math.round(floor.x - current.floor.x), Math.round(floor.y - current.floor.y)));
    return true;
  }
  function end(id: number, screen: RoomPoint, floor: RoomPoint) {
    const current = gesture.current;
    if (!current || current.id !== id) return false;
    gesture.current = null;
    setPointerPreview(null);
    if (!stillEditable(current)) return true;
    const moved = current.moved || Math.hypot(current.screen.x - screen.x, current.screen.y - screen.y) > 5;
    if (current.kind === "draw") {
      const start = cell(current.floor), end = cell(floor);
      if (inside(floor)) commitDraw(start, end);
    } else if (moved) {
      commitTransform(transform(current.origin, Math.round(floor.x - current.floor.x), Math.round(floor.y - current.floor.y)));
    }
    return true;
  }
  const keyboardCell = cursor ?? anchor ?? { x: 0, y: 0 };
  function key(key: string, shift: boolean, inspect: (point: RoomPoint) => void) {
    if (!editor) return false;
    if (key === "Escape") { cancel(); return true; }
    const step = shift ? 5 : 1;
    const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
    const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
    if (dx || dy) {
      if (activeTool === "inspect" && (!editor.onChooseCell || disabled)) return false;
      if (selected && (activeTool === "move" || activeTool === "resize")) commitTransform(transform(selected, dx, dy));
      else setCursor(cell({ x: keyboardCell.x + dx, y: keyboardCell.y + dy }));
      return true;
    }
    if (key !== "Enter" && key !== " ") return false;
    if (drawing) {
      if (anchor) commitDraw(anchor, keyboardCell);
      else { setNotice(""); setAnchor(keyboardCell); }
    } else if (activeTool === "inspect" && selected && !cursor && !editor.onChooseCell) editor.onOpenZoneMenu(selected.id);
    else if (activeTool === "inspect") inspect(keyboardCell);
    return true;
  }
  const preview = activeTool === "inspect" ? null : pointerPreview ??
    (drawing && anchor ? rectangleBetween(anchor, keyboardCell) : null);
  const cursorRectangle = drawing || cursor && activeTool === "inspect" && editor?.onChooseCell ? rectangleBetween(keyboardCell, keyboardCell) : null;
  const previewTarget = drawing && preview?.width === 1 && preview.height === 1 ? zoneAt(preview) : undefined;
  const valid = previewTarget ? !!editor?.targetZoneIds?.includes(previewTarget.id) : !preview || !overlaps(preview, drawing ? undefined : selected?.id);
  return { activeTool, drawing, disabled, transformDisabled, managing, selected, preview, valid, cursorRectangle, cursor, anchor, notice,
    chooseTool, cancel, clearGesture, begin, movePointer, end, key, zoneAt, inside };
}

export function WarehouseEditControls({ room, focusMap }: { room: ReturnType<typeof useGrowRoomWarehouseEditor>; focusMap: () => void }) {
  if (!room.managing || !room.selected || room.drawing || room.transformDisabled) return null;
  return <div className={styles.warehouseEditor}>
    <div className={styles.editorGroup} role="group" aria-label="Outils du plan">
      {tools.map(({ code, label, name, icon: Icon }) => <button key={code}
        type="button" data-warehouse-tool={code} className={styles.stationChoice} aria-label={name}
          disabled={code !== "inspect" && room.transformDisabled} aria-pressed={room.activeTool === code}
          onClick={() => { room.chooseTool(code); focusMap(); }}><Icon size={15} aria-hidden="true" />{label}</button>)}
    </div>
  </div>;
}
