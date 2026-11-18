"use client";
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Check, ChevronDown, Focus, Minus, Pause, Play, Plus } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { getKqZonePalette } from "@/lib/kanab-quest-zone-identity";
import { getKqWarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { roomSectorKey, type KqAffectedPlant, type KqGrowRoomEvent, type KqGrowRoomZone, type KqPbiTargeting } from "./KqGrowRoomModel";
import { KqGrowRoomCareOverlay } from "./KqGrowRoomCareOverlay";
import type { WorldInput, WorldPose, createRoomRenderer } from "./KqGrowRoomRenderer";
import { OVERVIEW, cameraScale, clampCamera, projectedFootprint, projectRoomPoint, unprojectFloor, type GrowCamera } from "./KqGrowRoomProjection";
import styles from "./KqGrowRoom.module.css";
import { getGrowRoomShellRegistration } from "./KqGrowRoomShellRegistration";
import { useGrowRoomWarehouseEditor, WarehouseEditControls, type KqGrowRoomWarehouseEditor } from "./KqGrowRoomWarehouseEditor";

const FallbackPlan = lazy(() => import("./KqGrowRoomFallbackPlan"));

type Point = { x: number; y: number };
type DragPoint = Point & { origin: Point; cell?: string };
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
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
  const scale = cameraScale(layout, size.width, size.height, camera.zoom);
  const shell = useMemo(() => getGrowRoomShellRegistration(layout), [layout]);
  const editor = useGrowRoomWarehouseEditor(warehouseEditor, plan, layout);
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
    const input = { layout, zones, selected, profile, event, motion, visible, camera, ...size };
    current.current = input; runtime.current?.update(input);
  }, [layout, zones, selected, profile, event, motion, visible, camera, size]);
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
  return <div data-grow-isometric="" className={styles.iso} data-warehouse-map-viewport={warehouseEditor ? "" : undefined}
    data-warehouse-iso-viewport={warehouseEditor ? "" : undefined}>
    <WarehouseEditControls room={editor} focusMap={focusMap} />
    <div className={styles.isoFrame} ref={host} data-grow-camera="" data-zoomed={camera.zoom > 1} data-zoom={camera.zoom.toFixed(3)} data-pan-x={camera.x.toFixed(3)} data-pan-z={camera.z.toFixed(3)} data-renderer={renderMode}
      tabIndex={0} role="group" aria-label={pbiTargeting ? "Cases à traiter. Toucher une case hachurée pour y appliquer le produit, ou utiliser la liste Case à traiter." : "Vue de l’entrepôt. Toucher un poste pour le sélectionner. Pincer pour agrandir. Au clavier, utiliser plus, moins et les flèches."}
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
        <polygon className={styles.floorFallback} points={projectedFootprint(shell.slab, camera, scale, size.width, size.height)} />
        {renderMode === "plan" && <Suspense fallback={null}><FallbackPlan profile={profile} position={fallbackPosition ?? layout.entry} plan={plan} layout={layout} zones={zones} camera={camera}
          scale={scale} width={size.width} height={size.height}/></Suspense>}
        {shell.landmarks.map(id => {
          const at = shell.landmark(id), screen = projectRoomPoint(at.x, 0, at.z, camera, scale, size.width, size.height);
          return <circle key={id} data-grow-landmark={id} data-world-x={at.x} data-world-z={at.z} cx={screen.x} cy={screen.y} r={0}/>;
        })}
        {editor.drawing && <path className={styles.editorGrid} d={[
          ...Array.from({ length: layout.width + 1 }, (_, x) => gridLine(x, 0, x, layout.depth)),
          ...Array.from({ length: layout.depth + 1 }, (_, y) => gridLine(0, y, layout.width, y)),
        ].join("")} />}
        {layout.items.map(item => <polygon key={item.id} data-grow-footprint={item.id} data-kind={item.kind} data-world-x={item.x} data-world-z={item.z}
          data-width={item.width} data-depth={item.depth} data-rotation={item.rotation}
          data-selected={(item.kind === "partition" ? warehouseEditor?.selectedPartitionId : selected) === item.id}
          data-grow-bay={item.kind === "partition" ? undefined : item.id} data-grow-floor-zone={item.kind === "partition" ? undefined : item.id}
          data-buddie-target={warehouseEditor?.placingBuddie && item.kind === "culture" ? !warehouseEditor.lockedZoneIds?.includes(item.id) : undefined}
          data-buddie-drop={warehouseEditor?.placingBuddie && warehouseEditor.buddieDrop?.zoneId === item.id ? warehouseEditor.buddieDrop.allowed ? "valid" : "invalid" : undefined}
          points={projectedFootprint(item, camera, scale, size.width, size.height)} />)}
        {editor.cursorRectangle && <polygon data-warehouse-cursor="" points={footprint(editor.cursorRectangle)} />}
        {editor.preview && <polygon data-warehouse-preview="" data-valid={editor.valid} points={footprint(editor.preview)} />}
        {resizeHandle && <g data-warehouse-resize-handle="" transform={`translate(${resizeHandle.x} ${resizeHandle.y})`}>
          <circle r={12}/><path d="M-5 5 5-5 M0-5h5v5 M-5 0v5h5" />
        </g>}
        <KqGrowRoomCareOverlay layout={layout} zones={zones} camera={camera} scale={scale} {...size} flat={renderMode !== "webgl"}
          affected={affectedPlants} eligible={pbiTargeting?.eligible} deposit={deposit} depositKind={receipt?.gesture === "pbi" ? "pbi" : "input"}
          pending={receipt && !deposit ? receipt.target : undefined}/>
        {broom && <g data-grow-static-gesture="sweep" className={styles.deposit} transform={`translate(${broom.x} ${broom.y})`}>
          <path d="m-8-3 15-22" stroke="#412f27" strokeWidth="4" strokeLinecap="round"/>
          <path d="m-8-3 15-22" stroke="#ca9a57" strokeWidth="2" strokeLinecap="round"/>
          <path d="m-13-7 11 6-3 5-14-6Z" fill="#e8bd65" stroke="#4d412e" strokeWidth="1.5"/>
          <path d="m-14-4-2 3m5-2-2 3m5-1-2 3" stroke="#966934" strokeWidth="1.3"/>
        </g>}
      </svg>
      {renderMode !== "loading" && !pbiTargeting && labels.map(label => <span key={label.id} aria-hidden="true" data-grow-zone-label={label.id} data-selected={label.selected}
        className={styles.isoLabel} style={{ left: label.x, top: label.y, backgroundColor: getKqZonePalette(label.index).color }}>
        {String(label.index + 1).padStart(2, "0")}{label.portrait && <span className={styles.zonePortrait} style={{ backgroundImage: `url("${label.portrait}")` }} />}
      </span>)}
      <span hidden ref={proxy} data-grow-actor={profile ? "player" : "visitor"} />
    </div>
    <div className={styles.cameraBar}>
      <span>{layout.width} × {layout.depth} m{renderMode === "plan" ? " · Vue illustrée" : ""}</span>
      <div className={styles.tools}>
        <button data-grow-zoom-out="" type="button" disabled={camera.zoom <= 1.001} aria-label="Dézoomer" onClick={() => zoomBy(1 / 1.4)}><Minus size={16} /></button>
        <button data-grow-zoom-in="" type="button" disabled={camera.zoom >= 5.999} aria-label="Zoomer" onClick={() => zoomBy(1.4)}><Plus size={16} /></button>
        <button data-grow-reset="" type="button" aria-label="Revenir à la vue générale" onClick={() => setCamera(OVERVIEW)}><Focus size={16} /></button>
        {onTogglePause && <button type="button" aria-label={paused ? "Reprendre l’animation de l’entrepôt" : "Mettre l’animation de l’entrepôt en pause"}
          aria-pressed={paused} onClick={onTogglePause}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>}
      </div>
    </div>
    {warehouseEditor && <p id={stationsId + "-help"} className={styles.editorHint} role="status">
      {warehouseEditor.interactionHint ?? (editor.preview
        ? `${editor.preview.width} × ${editor.preview.height} m · ${editor.preview.width * editor.preview.height} m²${editor.valid ? "" : " · Chevauchement"}`
        : editor.notice || (editor.drawing
          ? "Glisse pour tracer, ou choisis deux coins. Au clavier, utilise les flèches et Entrée."
          : editor.activeTool === "move" ? "Glisse la zone ou déplace-la avec les flèches."
          : editor.activeTool === "resize" ? "Glisse la poignée ou ajuste la surface avec les flèches."
          : "Sélectionne un poste dans la vue ou dans la liste."))}
    </p>}
    {zones.length > 4 && !pbiTargeting && <button type="button" data-grow-toggle-posts="" className={`${styles.stationChoice} ${styles.stationDisclosure}`}
      aria-expanded={stationsExpanded} aria-controls={stationsId} onClick={() => setStationsExpanded(!stationsExpanded)}>
      {zones.length} postes <ChevronDown size={16} aria-hidden="true"/>
    </button>}
    {zones.length > 0 && !pbiTargeting && <div id={stationsId} className={styles.posts} data-grow-posts="" data-collapsed={zones.length > 4 && !stationsExpanded} role="group" aria-label="Postes de l’entrepôt">
      {zones.map((zone, i) => <button type="button" key={zone.id} data-grow-pick={zone.id} data-warehouse-zone-chip={warehouseEditor ? zone.id : undefined} data-station-kind={zone.kind ?? "culture"}
        className={styles.stationChoice} aria-pressed={selected === zone.id} aria-label={zone.name + " · " + (zone.kind === "drying" ? "Séchoir" : zone.kind === "storage" ? "Stockage" : "Culture")}
        disabled={!!editor.drawing} onClick={() => select(i)}
        onKeyDown={warehouseEditor ? undefined : e => onKey(e, i)}>{selected === zone.id && <Check size={13} aria-hidden="true" />}{zone.name}</button>)}
    </div>}
    {editor.managing && warehouseEditor?.onSelectPartition && !!plan.partitions?.length && <div className={styles.posts} role="group" aria-label="Parois de l’entrepôt">
      {plan.partitions.map((wall, i) => <button key={wall.id} type="button" className={styles.stationChoice}
        data-warehouse-partition={wall.id} disabled={editor.disabled || !!editor.drawing} aria-pressed={wall.id === warehouseEditor.selectedPartitionId}
        onClick={() => warehouseEditor.onSelectPartition?.(wall.id)}>Paroi {i + 1} · {wall.length} m</button>)}
    </div>}
    {!editor.managing && <p ref={warning} hidden className={styles.blocked} role="status" />}
    {activeItem && <span hidden data-selected-world-id={activeItem.id} />}
  </div>;
}
