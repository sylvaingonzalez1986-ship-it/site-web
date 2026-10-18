"use client";

import Image from "next/image";
import { ArrowRight, BookOpen, BriefcaseBusiness, ChevronDown, CircleHelp, Landmark, MapPin, Move, PackageCheck, Scan, ShoppingBag, Sprout, Store, Swords, Target, Wallet, Warehouse, X, ZoomIn } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getPlacardMapBuildingGeometry, KQ_PLACARD_MAP_SCENE } from "./KqPlacardMap.geometry";
import styles from "./KqPlacardMap.module.css";

export type PlacardMapView = "game" | "harvests" | "market" | "treasury" | "shop" | "arena" | "missions" | "workshop";
export type PlacardMapOpen = (view: PlacardMapView, options?: { treasuryPole?: "accounting" | "bank"; marketSection?: "sales" | "dashboard" | "management"; warehouseSection?: "storage"; harvestSection?: "storage"; catalog?: boolean; equipmentCode?: string }) => void;

const BUILDINGS = [
  { id: "warehouse", name: "Entrepôt", action: "Cultiver, aménager et suivre mes récoltes", Icon: Warehouse },
  { id: "bank", name: "Banque", action: "Prêts, épargne et placements", Icon: Landmark },
  { id: "office", name: "Bureau", action: "Factures et comptabilité", Icon: BriefcaseBusiness },
  { id: "market", name: "Marché", action: "Transformer, vendre et gérer mon commerce", Icon: Store },
  { id: "shop", name: "Boutique", action: "Acheter et ouvrir des packs Buddies et Botte du Chanvrier", Icon: ShoppingBag },
  { id: "arena", name: "Jury & duels", action: "Présenter mes Fleurs et participer aux duels", Icon: Swords },
  { id: "missions", name: "Missions", action: "Voir mes défis et récompenses", Icon: Target },
  { id: "collection", name: "Collections", action: "Ouvrir mes albums Buddies et Botte du Chanvrier", Icon: BookOpen },
] as const;
type BuildingId = typeof BUILDINGS[number]["id"];

type MapSnapshot = { selected: BuildingId | null; zoomed: boolean };
const INITIAL_MAP: MapSnapshot = { selected: null, zoomed: false };
let savedMap = INITIAL_MAP;
const savedViewport = { left: 0, top: 0 };
const mapListeners = new Set<() => void>();
function subscribeMap(listener: () => void) { mapListeners.add(listener); return () => { mapListeners.delete(listener); }; }
const getMapSnapshot = () => savedMap;
const getServerMapSnapshot = () => INITIAL_MAP;
const subscribeIsolatedMap = () => () => {};
function rememberMap(patch: Partial<MapSnapshot>) {
  savedMap = { ...savedMap, ...patch };
  mapListeners.forEach(listener => listener());
}
function resolveBuilding(value?: string | null) {
  return value === "game" || value === "workshop" || value === "harvests" ? "warehouse" : value === "treasury" ? "office" : value;
}

export function KqPlacardMap({ onOpen, onOpenCollection, activeRun, cashCents, readyLotCount, availableFlowerCount, recommended, highlightedBuilding, isolated = false }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
  activeRun?: boolean;
  cashCents: number | null;
  tents: number | null;
  readyLotCount?: number;
  availableFlowerCount?: number;
  recommended?: string;
  highlightedBuilding?: string | null;
  isolated?: boolean;
}) {
  const sharedMap = useSyncExternalStore(isolated ? subscribeIsolatedMap : subscribeMap, isolated ? getServerMapSnapshot : getMapSnapshot, getServerMapSnapshot);
  const [localMap, setLocalMap] = useState(INITIAL_MAP);
  const localViewport = useRef({ left: 0, top: 0 });
  const { selected, zoomed } = isolated ? localMap : sharedMap;
  const [dragging, setDragging] = useState(false);
  const [hoveredBuilding, setHoveredBuilding] = useState<BuildingId | null>(null);
  const [focusedBuilding, setFocusedBuilding] = useState<BuildingId | null>(null);
  const maskId = useId().replace(/:/g, "");
  const viewportId = isolated ? `placard-map-viewport-${maskId}` : "placard-map-viewport";
  const panelId = isolated ? `placard-building-details-${maskId}` : "placard-building-details";
  const panelTitleId = isolated ? `placard-building-title-${maskId}` : "placard-building-title";
  const viewport = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const recommendedBuilding = resolveBuilding(recommended);
  const highlighted = resolveBuilding(highlightedBuilding);
  const contextualBuilding = selected === "warehouse" || selected === "market" ? selected : null;

  useEffect(() => {
    const node = viewport.current;
    const position = isolated ? localViewport.current : savedViewport;
    if (node) node.scrollTo({ left: position.left, top: position.top, behavior: "instant" });
  }, [isolated]);

  function updateMap(patch: Partial<MapSnapshot>) {
    if (isolated) setLocalMap(current => ({ ...current, ...patch }));
    else rememberMap(patch);
  }

  function centerBuilding(id: string | null | undefined) {
    const node = viewport.current;
    const destination = BUILDINGS.find(item => item.id === id) ?? BUILDINGS[0];
    const [x, y] = getPlacardMapBuildingGeometry(destination.id).focusPoint;
    const terrain = node?.firstElementChild as HTMLElement | null;
    if (node && terrain) node.scrollTo({ left: terrain.offsetWidth * x / KQ_PLACARD_MAP_SCENE.width - node.clientWidth / 2, top: terrain.offsetHeight * y / KQ_PLACARD_MAP_SCENE.height - node.clientHeight / 2, behavior: "instant" });
  }
  function toggleZoom() {
    updateMap({ zoomed: !zoomed });
    requestAnimationFrame(() => centerBuilding(selected ?? recommendedBuilding));
  }
  function visit(id: BuildingId, origin: HTMLButtonElement) {
    updateMap({ selected: id });
    if (id === "warehouse" || id === "market") {
      requestAnimationFrame(() => panel.current?.focus({ preventScroll: false }));
    } else if (id === "collection") {
      origin.focus({ preventScroll: true });
      onOpenCollection();
    } else if (id === "bank" || id === "office") {
      onOpen("treasury", { treasuryPole: id === "bank" ? "bank" : "accounting" });
    } else onOpen(id);
  }
  function closePanel() {
    const previous = selected;
    updateMap({ selected: null });
    viewport.current?.querySelector<HTMLButtonElement>(`[data-map-building="${previous}"]`)?.focus({ preventScroll: true });
  }
  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (!zoomed || event.pointerType !== "mouse" || event.button !== 0) return;
    suppressClick.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false };
  }
  function movePan(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    if (!current.moved) {
      current.moved = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = current.left - dx;
    event.currentTarget.scrollTop = current.top - dy;
  }
  function stopPan(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function buildingStatus(id: BuildingId) {
    if (id === "warehouse" && activeRun) return "Culture en cours";
    if (id === "market" && readyLotCount) return `${readyLotCount} lot${readyLotCount > 1 ? "s" : ""} à vendre`;
    if (id === "arena" && availableFlowerCount) return `${availableFlowerCount} Fleur${availableFlowerCount > 1 ? "s" : ""} pour le jury`;
    return null;
  }

  return <section className={styles.world} aria-label="Carte de Kanab Quest" data-placard-map data-map-zoomed={zoomed || undefined}>
    <header className={styles.mapHeading}>
      <div className={styles.mapIdentity}><span>Les Chanvriers Bretons</span><h1>Mon quartier<span>.</span></h1></div>
      <div className={styles.wallet} aria-label="Résumé de ta partie Kanab Quest">
        <span><Wallet size={17} aria-hidden="true" /><span><small>Argent du jeu</small><strong>{cashCents !== null ? formatKqCash(cashCents) : "—"}</strong></span></span>
      </div>
      <div className={styles.mapTools}>
        <button type="button" className={styles.zoomButton} data-map-zoom-toggle aria-label={zoomed ? "Voir tout le quartier" : "Agrandir la carte"} aria-pressed={zoomed} aria-controls={viewportId} onClick={toggleZoom}>{zoomed ? <Scan size={18} aria-hidden="true" /> : <ZoomIn size={18} aria-hidden="true" />}<span>{zoomed ? "Tout le quartier" : "Agrandir"}</span></button>
        <details className={styles.help}>
          <summary aria-label="Aide du quartier"><CircleHelp size={18} aria-hidden="true" /><span>Aide</span><ChevronDown size={13} aria-hidden="true" /></summary>
          <div className={styles.helpContent}><strong>Entre dans ton quartier.</strong><p>Touche un bâtiment pour l’ouvrir. L’Entrepôt et le Marché proposent plusieurs activités juste sous la carte.</p><p>Agrandis pour explorer le décor en le faisant glisser. Les noms restent visibles ; le menu de Kanab Quest donne aussi accès à tous les lieux.</p><p>La Boutique propose les packs de cartes. Collections réunit tes albums. Pour le matériel, ouvre l’Entrepôt. Le Marché sert à vendre ; le Bureau et la Banque s’occupent des finances.</p></div>
        </details>
      </div>
    </header>
    <div ref={viewport} id={viewportId} className={styles.viewport} data-dragging={dragging || undefined}
      onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}
      onScroll={event => {
        const left = event.currentTarget.scrollLeft, top = event.currentTarget.scrollTop;
        if (isolated) localViewport.current = { left, top };
        else { savedViewport.left = left; savedViewport.top = top; }
      }}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      <div className={styles.terrain}>
        <Image src={KQ_PLACARD_MAP_SCENE.image} alt={KQ_PLACARD_MAP_SCENE.alt} fill unoptimized loading="eager" fetchPriority="high" draggable={false} />
        <svg className={styles.lightingLayer} viewBox={`0 0 ${KQ_PLACARD_MAP_SCENE.width} ${KQ_PLACARD_MAP_SCENE.height}`} aria-hidden="true" focusable="false">
          <defs>{BUILDINGS.map(({ id }) => <clipPath id={`${maskId}-${id}`} key={id}><polygon points={getPlacardMapBuildingGeometry(id).points} /></clipPath>)}</defs>
          {BUILDINGS.map(({ id }) => {
            const active = selected === id || highlighted === id || (!dragging && (hoveredBuilding === id || focusedBuilding === id));
            const geometry = getPlacardMapBuildingGeometry(id);
            return <g key={id} className={styles.buildingLight} data-active={active || undefined}>
              <image href={KQ_PLACARD_MAP_SCENE.image} width={KQ_PLACARD_MAP_SCENE.width} height={KQ_PLACARD_MAP_SCENE.height} clipPath={`url(#${maskId}-${id})`} className={styles.litImage} />
              <polygon points={geometry.points} className={styles.silhouette} data-map-silhouette={id} data-active={active || undefined} vectorEffect="non-scaling-stroke" />
            </g>;
          })}
        </svg>
        <nav aria-label="Les bâtiments de Kanab Quest">
          {BUILDINGS.map(({ id, name, action, Icon }) => {
            const contextual = id === "warehouse" || id === "market";
            const status = buildingStatus(id);
            const geometry = getPlacardMapBuildingGeometry(id);
            return <button key={id} type="button" className={styles.building} data-map-building={id} data-selected={selected === id || undefined} data-highlighted={highlighted === id || undefined} data-recommended={recommendedBuilding === id || undefined} data-arena-tour={id === "collection" ? "collection" : undefined}
              data-map-hit-point={geometry.hitPoint} data-map-ground-point={geometry.groundPoint}
              style={{ left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height, "--label-x": geometry.labelLeft, "--label-y": geometry.labelTop, "--silhouette": geometry.clipPath } as CSSProperties}
              onPointerEnter={event => { if (event.pointerType !== "touch") setHoveredBuilding(id); }} onPointerLeave={() => setHoveredBuilding(current => current === id ? null : current)}
              onFocus={() => setFocusedBuilding(id)} onBlur={() => setFocusedBuilding(current => current === id ? null : current)}
              aria-label={`${name} · ${action}${status ? ` · ${status}` : ""}`} aria-expanded={contextual ? selected === id : undefined} aria-controls={contextual ? panelId : undefined} aria-haspopup={id === "collection" ? "dialog" : undefined} onClick={event => visit(id, event.currentTarget)}>
              <span className={styles.buildingHitArea} data-map-hit-area={id} aria-hidden="true" />
              <span className={styles.buildingLabel} data-map-label={id}><span className={styles.buildingName}><Icon size={15} aria-hidden="true" />{name}{recommendedBuilding === id ? <i className={styles.recommendation} aria-label="Activité conseillée" /> : null}</span>{status ? <span className={styles.buildingStatus}>{status}</span> : null}</span>
            </button>;
          })}
        </nav>
      </div>
    </div>
    <div className={styles.mapFoot}><span><MapPin size={15} aria-hidden="true" /> Choisis un lieu pour continuer.</span>{zoomed ? <span><Move size={15} aria-hidden="true" /> Fais glisser pour explorer</span> : <span className={styles.legend}><i /> Ta prochaine action</span>}</div>
    {contextualBuilding ? <aside ref={panel} tabIndex={-1} className={styles.details} id={panelId} aria-labelledby={panelTitleId} onKeyDown={event => { if (event.key === "Escape") { if (isolated) { event.preventDefault(); event.stopPropagation(); } closePanel(); } }}>
      <div className={styles.detailHeading}><div><span>{contextualBuilding === "warehouse" ? "Tes cultures et ton installation" : "Tes récoltes deviennent des ventes"}</span><h2 id={panelTitleId}>{contextualBuilding === "warehouse" ? "L’Entrepôt" : "Le Marché"}</h2></div><button type="button" className={styles.closePanel} aria-label="Fermer les activités du bâtiment" onClick={closePanel}><X size={18} aria-hidden="true" /></button></div>
      <nav className={styles.actions} aria-label={`Activités · ${contextualBuilding === "warehouse" ? "L’Entrepôt" : "Le Marché"}`}>
        {contextualBuilding === "warehouse" ? <>
          <button type="button" data-placard-activity="game" onClick={() => onOpen("game")}><Sprout size={20} aria-hidden="true" /><span>{activeRun ? "Reprendre ma culture" : "Commencer une culture"}<small>Cultiver et récolter</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="workshop" onClick={() => onOpen("workshop")}><Warehouse size={20} aria-hidden="true" /><span>Aménager l’entrepôt<small>Zones, matériel et entretien</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="storage" onClick={() => onOpen("harvests")}><PackageCheck size={20} aria-hidden="true" /><span>Mes récoltes<small>Stockage, affinage et jury</small></span><ArrowRight size={17} aria-hidden="true" /></button>
        </> : <>
          <button type="button" data-placard-activity="market" onClick={() => onOpen("market")}><Store size={20} aria-hidden="true" /><span>Transformer et vendre<small>{readyLotCount ? `${readyLotCount} lot${readyLotCount > 1 ? "s" : ""} à valoriser` : "Préparer mes ventes"}</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="dashboard" onClick={() => onOpen("market", { marketSection: "dashboard" })}><PackageCheck size={20} aria-hidden="true" /><span>Suivre mes ventes<small>Paquets, annonces et commandes</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="management" onClick={() => onOpen("market", { marketSection: "management" })}><Target size={20} aria-hidden="true" /><span>Développer mon commerce<small>Boutique en ligne, marque et audience</small></span><ArrowRight size={17} aria-hidden="true" /></button>
        </>}
      </nav>
    </aside> : null}
  </section>;
}
