"use client";

import Image from "next/image";
import { KqHelpDashboard, KqHelpGrid, KqHelpSteps } from "./KqHelpDashboard";
import { ArrowRight, BookOpen, ChevronDown, CircleHelp, Landmark, Megaphone, PackageCheck, Pause, Play, Scan, ShoppingBag, Sprout, Store, Swords, Target, UsersRound, Wallet, Warehouse, X, ZoomIn } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getPlacardMapBuildingGeometry, KQ_PLACARD_MAP_SCENE } from "./KqPlacardMap.geometry";
import { KqPlacardMapActivity } from "./KqPlacardMapActivity";
import { KqPlacardMapAtmosphere } from "./KqPlacardMapAtmosphere";
import { KqMailbox } from "./KqMailbox";
import styles from "./KqPlacardMap.module.css";

export type PlacardMapView = "game" | "harvests" | "market" | "treasury" | "shop" | "arena" | "missions" | "workshop" | "staff" | "social";
export type PlacardMapOpen = (view: PlacardMapView, options?: { treasuryPole?: "accounting" | "bank"; marketSection?: "sales" | "dashboard" | "management"; warehouseSection?: "storage" | "processing"; harvestSection?: "storage"; catalog?: boolean; equipmentCode?: string; listingId?: string }) => void;

const BUILDINGS = [
  { id: "warehouse", name: "La ferme", action: "Culture, récoltes et atelier", Icon: Warehouse },
  { id: "bank", name: "Finances", action: "Factures, banque et comptabilité", Icon: Landmark },
  { id: "office", name: "Personnel", action: "Ma journée, mon équipe et les recrutements", Icon: UsersRound },
  { id: "market", name: "Commerce", action: "Vendre, développer ma boutique et communiquer", Icon: Store },
  { id: "shop", name: "Packs de cartes", action: "Acheter et ouvrir des packs Buddies et Botte du Chanvrier", Icon: ShoppingBag },
  { id: "arena", name: "Jury & duels", action: "Présenter mes Fleurs et participer aux duels", Icon: Swords },
  { id: "missions", name: "Missions", action: "Voir mes défis et récompenses", Icon: Target },
  { id: "collection", name: "Collections", action: "Ouvrir mes albums Buddies et Botte du Chanvrier", Icon: BookOpen },
] as const;
type BuildingId = typeof BUILDINGS[number]["id"];

type MapSnapshot = { selected: BuildingId | null; zoomed: boolean | null; motionPaused: boolean };
const INITIAL_MAP: MapSnapshot = { selected: null, zoomed: null, motionPaused: false };
let savedMap = INITIAL_MAP;
const savedViewport = { left: 0, top: 0, initialized: false };
const mapListeners = new Set<() => void>();
function subscribeMap(listener: () => void) { mapListeners.add(listener); return () => { mapListeners.delete(listener); }; }
const getMapSnapshot = () => savedMap;
const getServerMapSnapshot = () => INITIAL_MAP;
const subscribeIsolatedMap = () => () => {};
function subscribeCompactMap(listener: () => void) {
  const query = window.matchMedia("(max-width: 700px)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const getCompactMap = () => window.matchMedia("(max-width: 700px)").matches;
const getServerCompactMap = () => false;
function rememberMap(patch: Partial<MapSnapshot>) {
  savedMap = { ...savedMap, ...patch };
  mapListeners.forEach(listener => listener());
}
function resolveBuilding(value?: string | null) {
  return value === "game" || value === "workshop" || value === "harvests" ? "warehouse" : value === "treasury" ? "bank" : value === "staff" ? "office" : value === "social" ? "market" : value;
}

export function KqPlacardMap({ onOpen, onOpenCollection, activeRun, cashCents, readyLotCount, availableFlowerCount, curingFlowerCount, recommended, highlightedBuilding, isolated = false }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
  activeRun?: boolean;
  cashCents: number | null;
  tents: number | null;
  readyLotCount?: number;
  availableFlowerCount?: number;
  curingFlowerCount?: number;
  recommended?: string;
  highlightedBuilding?: string | null;
  isolated?: boolean;
}) {
  const sharedMap = useSyncExternalStore(isolated ? subscribeIsolatedMap : subscribeMap, isolated ? getServerMapSnapshot : getMapSnapshot, getServerMapSnapshot);
  const [localMap, setLocalMap] = useState(INITIAL_MAP);
  const localViewport = useRef({ left: 0, top: 0, initialized: false });
  const { selected, zoomed: rememberedZoom, motionPaused } = isolated ? localMap : sharedMap;
  const compact = useSyncExternalStore(subscribeCompactMap, getCompactMap, getServerCompactMap);
  const zoomed = rememberedZoom ?? compact;
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
  const initialFocus = useRef(selected ?? resolveBuilding(highlightedBuilding) ?? recommendedBuilding);
  const highlighted = resolveBuilding(highlightedBuilding);
  const contextualBuilding = selected === "warehouse" || selected === "market" ? selected : null;
  const hasCulture = activeRun === true;
  const hasReadyLots = typeof readyLotCount === "number" && Number.isSafeInteger(readyLotCount) && readyLotCount > 0;
  const hasAvailableFlowers = typeof availableFlowerCount === "number" && Number.isSafeInteger(availableFlowerCount) && availableFlowerCount > 0;
  const hasCuringFlowers = typeof curingFlowerCount === "number" && Number.isSafeInteger(curingFlowerCount) && curingFlowerCount > 0;

  useEffect(() => {
    const node = viewport.current;
    const position = isolated ? localViewport.current : savedViewport;
    if (!node || (rememberedZoom === null && compact !== getCompactMap())) return;
    if (zoomed && rememberedZoom === null && !position.initialized) {
      const destination = BUILDINGS.find(item => item.id === initialFocus.current) ?? BUILDINGS[0];
      const [x, y] = getPlacardMapBuildingGeometry(destination.id).focusPoint;
      const terrain = node.firstElementChild as HTMLElement | null;
      if (terrain) node.scrollTo({ left: terrain.offsetWidth * x / KQ_PLACARD_MAP_SCENE.width - node.clientWidth / 2, top: terrain.offsetHeight * y / KQ_PLACARD_MAP_SCENE.height - node.clientHeight / 2, behavior: "instant" });
    } else node.scrollTo({ left: position.left, top: position.top, behavior: "instant" });
    position.left = node.scrollLeft; position.top = node.scrollTop; position.initialized = true;
  }, [compact, isolated, rememberedZoom, zoomed]);

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
  function revealFocusedLabel(button: HTMLButtonElement) {
    const node = viewport.current;
    const label = button.querySelector<HTMLElement>("[data-map-label]");
    if (!node || !label || !button.isConnected) return;
    const frame = node.getBoundingClientRect(), bounds = label.getBoundingClientRect();
    // A building's illustrated bounds and its HTML sign are deliberately separate.
    // Native focus scrolls the former; keep the sign and its focus ring in view too.
    const inset = 8;
    const left = bounds.left < frame.left + inset ? bounds.left - frame.left - inset
      : Math.max(0, bounds.right - frame.left - node.clientWidth + inset);
    const top = bounds.top < frame.top + inset ? bounds.top - frame.top - inset
      : Math.max(0, bounds.bottom - frame.top - node.clientHeight + inset);
    node.scrollBy({ left, top, behavior: "instant" });
  }
  function visit(id: BuildingId, origin: HTMLButtonElement) {
    updateMap({ selected: id });
    if (id === "warehouse" || id === "market") {
      requestAnimationFrame(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); });
    } else if (id === "collection") {
      origin.focus({ preventScroll: true });
      onOpenCollection();
    } else if (id === "bank") {
      onOpen("treasury", { treasuryPole: "accounting" });
    } else if (id === "office") {
      onOpen("staff");
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
    if (id === "warehouse") return hasCulture ? "En culture" : hasCuringFlowers ? `${curingFlowerCount} lot${curingFlowerCount > 1 ? "s" : ""} en affinage` : activeRun === false ? "À cultiver" : null;
    if (id === "market" && hasReadyLots) return `${readyLotCount} lot${readyLotCount > 1 ? "s" : ""} à vendre`;
    if (id === "market" && readyLotCount === 0) return "Aucun lot prêt";
    if (id === "arena" && hasAvailableFlowers) return `${availableFlowerCount} Fleur${availableFlowerCount > 1 ? "s prêtes" : " prête"}`;
    if (id === "arena" && availableFlowerCount === 0) return "Aucune Fleur prête";
    return null;
  }
  function buildingState(id: BuildingId) {
    if (id === "warehouse") return hasCulture || hasCuringFlowers ? "active" : activeRun === false ? "idle" : "unknown";
    if (id === "market") return hasReadyLots ? "active" : readyLotCount === 0 ? "idle" : "unknown";
    if (id === "arena") return hasAvailableFlowers ? "active" : availableFlowerCount === 0 ? "idle" : "unknown";
    return undefined;
  }

  return <section className={styles.world} aria-label="Carte de Kanab Quest" data-placard-map data-map-zoomed={zoomed || undefined} data-map-motion-paused={motionPaused || undefined}>
    <header className={styles.mapHeading}>
      <div className={styles.mapIdentity}><h1>Mon quartier</h1></div>
      <div className={styles.wallet} aria-label="Résumé de ta partie Kanab Quest">
        <span><Wallet size={17} aria-hidden="true" /><span><small>Argent du jeu</small><strong>{cashCents !== null ? formatKqCash(cashCents) : "—"}</strong></span></span>
      </div>
      <div className={styles.mapTools}>
        <button type="button" className={styles.zoomButton} data-map-zoom-toggle aria-label={zoomed ? "Voir tout le quartier" : "Agrandir la carte"} aria-pressed={zoomed} aria-controls={viewportId} onClick={toggleZoom}>{zoomed ? <Scan size={18} aria-hidden="true" /> : <ZoomIn size={18} aria-hidden="true" />}<span>{zoomed ? "Tout le quartier" : "Agrandir"}</span></button>
        <details className={styles.help} onKeyDown={event => {
          if (event.key !== "Escape" || !event.currentTarget.open) return;
          event.preventDefault(); event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus({ preventScroll: true });
        }}>
          <summary aria-label="Aide du quartier"><CircleHelp size={18} aria-hidden="true" /><span>Aide</span><ChevronDown size={13} aria-hidden="true" /></summary>
          <div className={styles.helpContent}><KqHelpDashboard>
            <button type="button" className={styles.motionButton} data-map-motion-toggle aria-label="Mettre les animations du quartier en pause" aria-pressed={motionPaused} title={motionPaused ? "Reprendre les animations du quartier" : "Mettre les animations du quartier en pause"} onClick={() => updateMap({ motionPaused: !motionPaused })}>{motionPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<span>{motionPaused ? "Reprendre les animations" : "Mettre les animations en pause"}</span></button>
            <KqHelpGrid items={[
              { label: "Ferme", value: "Culture et atelier", detail: "Récoltes et transformation.", art: "help-culture" },
              { label: "Personnel", value: "Ton équipe", detail: "Journées et plannings.", art: "help-team" },
              { label: "Commerce", value: "Ventes et communication", art: "help-social" },
              { label: "Finances", value: "Factures et banque", art: "help-accounts" },
            ]} />
            <KqHelpSteps steps={[
              { label: "Ouvrir un lieu", detail: "Touche le bâtiment ou utilise le menu au clavier.", art: "quarter" },
              { label: "Explorer", detail: "Agrandis la carte ; packs, collections et défis ont leur lieu.", art: "help-travel" },
            ]} />
          </KqHelpDashboard></div>
        </details>
      </div>
    </header>
    <div ref={viewport} id={viewportId} className={styles.viewport} data-dragging={dragging || undefined}
      onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}
      onScroll={event => {
        const left = event.currentTarget.scrollLeft, top = event.currentTarget.scrollTop;
        if (isolated) localViewport.current = { left, top, initialized: true };
        else { savedViewport.left = left; savedViewport.top = top; savedViewport.initialized = true; }
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
        <KqPlacardMapActivity idPrefix={maskId} culture={hasCulture} market={hasReadyLots} jury={hasAvailableFlowers} />
        <KqPlacardMapAtmosphere paused={motionPaused || dragging} culture={hasCulture} market={hasReadyLots} jury={hasAvailableFlowers} focusBuilding={dragging ? null : focusedBuilding ?? hoveredBuilding ?? BUILDINGS.find(building => building.id === highlighted)?.id ?? selected} />
        <nav aria-label="Les bâtiments de Kanab Quest">
          {!isolated ? <KqMailbox onOpenPacks={() => onOpen("shop")} onReveal={button => { if (zoomed) requestAnimationFrame(() => revealFocusedLabel(button)); }} /> : null}
          {BUILDINGS.map(({ id, name, action, Icon }) => {
            const contextual = id === "warehouse" || id === "market";
            const status = buildingStatus(id);
            const geometry = getPlacardMapBuildingGeometry(id);
            return <button key={id} type="button" className={styles.building} data-map-building={id} data-map-state={buildingState(id)} data-selected={selected === id || undefined} data-highlighted={highlighted === id || undefined} data-recommended={recommendedBuilding === id || undefined} data-arena-tour={id === "collection" ? "collection" : undefined}
              data-map-hit-point={geometry.hitPoint} data-map-ground-point={geometry.groundPoint}
              style={{ left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height, "--label-x": geometry.labelLeft, "--label-y": geometry.labelTop, "--silhouette": geometry.clipPath } as CSSProperties}
              onPointerEnter={event => { if (event.pointerType !== "touch") setHoveredBuilding(id); }} onPointerLeave={() => setHoveredBuilding(current => current === id ? null : current)}
              onFocus={event => {
                setFocusedBuilding(id);
                if (zoomed) { const button = event.currentTarget; requestAnimationFrame(() => revealFocusedLabel(button)); }
              }} onBlur={() => setFocusedBuilding(current => current === id ? null : current)}
              aria-label={`${name} · ${action}${status ? ` · ${status}` : ""}`} aria-expanded={contextual ? selected === id : undefined} aria-controls={contextual ? panelId : undefined} aria-haspopup={id === "collection" ? "dialog" : undefined} onClick={event => visit(id, event.currentTarget)}>
              <span className={styles.buildingHitArea} data-map-hit-area={id} aria-hidden="true" />
              <span className={styles.buildingLabel} data-map-label={id}><span className={styles.buildingName}><Icon size={15} aria-hidden="true" /><span className={styles.buildingNameText}>{name}</span>{recommendedBuilding === id ? <i className={styles.recommendation} aria-label="Activité conseillée" /> : null}</span>{status ? <span className={styles.buildingStatus} data-map-status={id}>{status}</span> : null}</span>
            </button>;
          })}
        </nav>
      </div>
    </div>
    {contextualBuilding ? <aside key={contextualBuilding} ref={panel} tabIndex={-1} className={styles.details} id={panelId} aria-labelledby={panelTitleId} onKeyDown={event => { if (event.key === "Escape") { if (isolated) { event.preventDefault(); event.stopPropagation(); } closePanel(); } }}>
      <div className={styles.detailHeading}><div><h2 id={panelTitleId}>{contextualBuilding === "warehouse" ? "La ferme" : "Commerce"}</h2></div><button type="button" className={styles.closePanel} aria-label="Fermer les activités du bâtiment" onClick={closePanel}><X size={18} aria-hidden="true" /></button></div>
      <nav className={styles.actions} aria-label={`Activités · ${contextualBuilding === "warehouse" ? "La ferme" : "Commerce"}`}>
        {contextualBuilding === "warehouse" ? <>
          <button type="button" data-placard-activity="game" onClick={() => onOpen("game")}><Sprout size={20} aria-hidden="true" /><span>{activeRun ? "Reprendre ma culture" : "Commencer une culture"}<small>Cultiver et récolter</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="workshop" onClick={() => onOpen("workshop", { warehouseSection: "processing" })}><Warehouse size={20} aria-hidden="true" /><span>Ouvrir l’Atelier<small>Trim et machines</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="storage" onClick={() => onOpen("harvests")}><PackageCheck size={20} aria-hidden="true" /><span>Mes récoltes<small>Stockage, affinage et jury</small></span><ArrowRight size={17} aria-hidden="true" /></button>
        </> : <>
          <button type="button" data-placard-activity="market" onClick={() => onOpen("market", { marketSection: "sales" })}><Store size={20} aria-hidden="true" /><span>Préparer mes ventes<small>{readyLotCount ? `${readyLotCount} lot${readyLotCount > 1 ? "s" : ""} à valoriser` : "Formats, prix et débouchés"}</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="dashboard" onClick={() => onOpen("market", { marketSection: "dashboard" })}><PackageCheck size={20} aria-hidden="true" /><span>Mon stock en vente<small>Paquets, annonces et commandes</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="management" onClick={() => onOpen("market", { marketSection: "management" })}><Target size={20} aria-hidden="true" /><span>Développer mon commerce<small>Boutique en ligne, marque et audience</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="social" onClick={() => onOpen("social")}><Megaphone size={20} aria-hidden="true" /><span>Communiquer<small>Réseaux sociaux et partenariats</small></span><ArrowRight size={17} aria-hidden="true" /></button>
        </>}
      </nav>
    </aside> : null}
  </section>;
}
