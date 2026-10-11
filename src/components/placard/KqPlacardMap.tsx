"use client";

import Image from "next/image";
import { ArrowRight, BookOpen, BriefcaseBusiness, ChevronDown, CircleHelp, Landmark, MapPin, Move, PackageCheck, Scan, ShoppingBag, Sprout, Store, Swords, Target, Tent, Wallet, Warehouse, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import styles from "./KqPlacardMap.module.css";

export type PlacardMapView = "game" | "harvests" | "market" | "treasury" | "shop" | "arena" | "missions" | "workshop";
export type PlacardMapOpen = (view: PlacardMapView, options?: { treasuryPole?: "accounting" | "bank"; marketSection?: "sales" | "dashboard" | "management"; warehouseSection?: "storage"; harvestSection?: "storage"; catalog?: boolean; equipmentCode?: string }) => void;

const BUILDINGS = [
  { id: "warehouse", name: "Entrepôt", action: "Cultiver, aménager et suivre mes récoltes", Icon: Warehouse, x: 24, y: 25, width: 32, height: 37 },
  { id: "bank", name: "Banque", action: "Prêts, épargne et placements", Icon: Landmark, x: 53, y: 18, width: 20, height: 31 },
  { id: "office", name: "Bureau", action: "Factures et comptabilité", Icon: BriefcaseBusiness, x: 79, y: 29, width: 21, height: 37 },
  { id: "market", name: "Marché", action: "Transformer, vendre et gérer mon commerce", Icon: Store, x: 22, y: 58, width: 25, height: 27 },
  { id: "shop", name: "Boutique", action: "Acheter des packs et du matériel", Icon: ShoppingBag, x: 48, y: 73, width: 23, height: 33 },
  { id: "arena", name: "Jury & duels", action: "Présenter mes Fleurs et participer aux duels", Icon: Swords, x: 77, y: 66, width: 27, height: 36 },
  { id: "missions", name: "Missions", action: "Voir mes défis et récompenses", Icon: Target, x: 48, y: 45, width: 15, height: 23 },
  { id: "collection", name: "Collection", action: "Ouvrir ma collection Botte du Chanvrier", Icon: BookOpen, x: 27.5, y: 82, width: 17, height: 21 },
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
function rememberMap(patch: Partial<MapSnapshot>) {
  savedMap = { ...savedMap, ...patch };
  mapListeners.forEach(listener => listener());
}
function resolveBuilding(value?: string | null) {
  return value === "game" || value === "workshop" || value === "harvests" ? "warehouse" : value === "treasury" ? "office" : value;
}

export function KqPlacardMap({ onOpen, onOpenCollection, activeRun, cashCents, tents, readyLotCount, availableFlowerCount, recommended, highlightedBuilding }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
  activeRun?: boolean;
  cashCents: number | null;
  tents: number | null;
  readyLotCount?: number;
  availableFlowerCount?: number;
  recommended?: string;
  highlightedBuilding?: string | null;
}) {
  const { selected, zoomed } = useSyncExternalStore(subscribeMap, getMapSnapshot, getServerMapSnapshot);
  const [dragging, setDragging] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const recommendedBuilding = resolveBuilding(recommended);
  const highlighted = resolveBuilding(highlightedBuilding);
  const contextualBuilding = selected === "warehouse" || selected === "market" ? selected : null;

  useEffect(() => {
    const node = viewport.current;
    if (node) node.scrollTo({ left: savedViewport.left, top: savedViewport.top, behavior: "instant" });
  }, []);

  function centerBuilding(id: string | null | undefined) {
    const node = viewport.current;
    const destination = BUILDINGS.find(item => item.id === id) ?? BUILDINGS[0];
    const terrain = node?.firstElementChild as HTMLElement | null;
    if (node && terrain) node.scrollTo({ left: terrain.offsetWidth * destination.x / 100 - node.clientWidth / 2, top: terrain.offsetHeight * destination.y / 100 - node.clientHeight / 2, behavior: "instant" });
  }
  function toggleZoom() {
    rememberMap({ zoomed: !zoomed });
    requestAnimationFrame(() => centerBuilding(selected ?? recommendedBuilding));
  }
  function visit(id: BuildingId, origin: HTMLButtonElement) {
    rememberMap({ selected: id });
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
    rememberMap({ selected: null });
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

  return <section className={styles.world} aria-label="Carte du Placard" data-placard-map data-map-zoomed={zoomed || undefined}>
    <header className={styles.mapHeading}>
      <div className={styles.mapIdentity}><span>Les Chanvriers Bretons</span><h1>Mon quartier<span>.</span></h1></div>
      <div className={styles.wallet} aria-label="Résumé de ton Placard">
        <span><Wallet size={17} aria-hidden="true" /><span><small>Argent du jeu</small><strong>{cashCents !== null ? formatKqCash(cashCents) : "—"}</strong></span></span>
        <span><Tent size={17} aria-hidden="true" /><span><small>Installation</small><strong>{tents ? `${tents} tente${tents > 1 ? "s" : ""}` : "—"}</strong></span></span>
      </div>
      <div className={styles.mapTools}>
        <button type="button" className={styles.zoomButton} data-map-zoom-toggle aria-label={zoomed ? "Voir tout le quartier" : "Agrandir la carte"} aria-pressed={zoomed} aria-controls="placard-map-viewport" onClick={toggleZoom}>{zoomed ? <Scan size={18} aria-hidden="true" /> : <ZoomIn size={18} aria-hidden="true" />}<span>{zoomed ? "Tout le quartier" : "Agrandir"}</span></button>
        <details className={styles.help}>
          <summary aria-label="Aide du quartier"><CircleHelp size={18} aria-hidden="true" /><span>Aide</span><ChevronDown size={13} aria-hidden="true" /></summary>
          <div className={styles.helpContent}><strong>Entre dans ton quartier.</strong><p>Touche un bâtiment pour l’ouvrir. L’Entrepôt et le Marché proposent plusieurs activités juste sous la carte.</p><p>Agrandis pour explorer le décor en le faisant glisser. Les noms restent visibles ; le menu du Placard donne aussi accès à tous les lieux.</p><p>Le Marché sert à vendre. La Boutique permet d’acheter tes packs et ton matériel. Le Bureau réunit tes factures ; la Banque, tes financements et placements.</p></div>
        </details>
      </div>
    </header>
    <div ref={viewport} id="placard-map-viewport" className={styles.viewport} data-dragging={dragging || undefined}
      onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}
      onScroll={event => { savedViewport.left = event.currentTarget.scrollLeft; savedViewport.top = event.currentTarget.scrollTop; }}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      <div className={styles.terrain}>
        <Image src="/placard/map/placard-world-breton-v3.webp" alt="Le quartier des Chanvriers Bretons vu en isométrie : huit lieux en granit et ardoise, reliés par des chemins bordés d’hortensias, au bord d’une rivière." fill sizes="(max-width: 700px) 900px, (max-width: 1200px) 1200px, 1536px" loading="eager" fetchPriority="high" draggable={false} />
        <nav aria-label="Les bâtiments du Placard">
          {BUILDINGS.map(({ id, name, action, Icon, x, y, width, height }) => {
            const contextual = id === "warehouse" || id === "market";
            const status = buildingStatus(id);
            return <button key={id} type="button" className={styles.building} data-map-building={id} data-selected={selected === id || undefined} data-highlighted={highlighted === id || undefined} data-recommended={recommendedBuilding === id || undefined} data-arena-tour={id === "collection" ? "collection" : undefined}
              style={{ "--x": `${x}%`, "--y": `${y}%`, "--width": `${width}%`, "--height": `${height}%` } as CSSProperties}
              aria-label={`${name} · ${action}${status ? ` · ${status}` : ""}`} aria-expanded={contextual ? selected === id : undefined} aria-controls={contextual ? "placard-building-details" : undefined} aria-haspopup={id === "collection" ? "dialog" : undefined} onClick={event => visit(id, event.currentTarget)}>
              <span className={styles.buildingLabel}><span className={styles.buildingName}><Icon size={15} aria-hidden="true" />{name}{recommendedBuilding === id ? <i className={styles.recommendation} aria-label="Activité conseillée" /> : null}</span>{status ? <span className={styles.buildingStatus}>{status}</span> : null}</span>
            </button>;
          })}
        </nav>
      </div>
    </div>
    <div className={styles.mapFoot}><span><MapPin size={15} aria-hidden="true" /> Choisis un lieu pour continuer.</span>{zoomed ? <span><Move size={15} aria-hidden="true" /> Fais glisser pour explorer</span> : <span className={styles.legend}><i /> Ta prochaine action</span>}</div>
    {contextualBuilding ? <aside ref={panel} tabIndex={-1} className={styles.details} id="placard-building-details" aria-labelledby="placard-building-title" onKeyDown={event => { if (event.key === "Escape") closePanel(); }}>
      <div className={styles.detailHeading}><div><span>{contextualBuilding === "warehouse" ? "Tes cultures et ton installation" : "Tes récoltes deviennent des ventes"}</span><h2 id="placard-building-title">{contextualBuilding === "warehouse" ? "L’Entrepôt" : "Le Marché"}</h2></div><button type="button" className={styles.closePanel} aria-label="Fermer les activités du bâtiment" onClick={closePanel}><X size={18} aria-hidden="true" /></button></div>
      <nav className={styles.actions} aria-label={`Activités · ${contextualBuilding === "warehouse" ? "L’Entrepôt" : "Le Marché"}`}>
        {contextualBuilding === "warehouse" ? <>
          <button type="button" data-placard-activity="game" onClick={() => onOpen("game")}><Sprout size={20} aria-hidden="true" /><span>{activeRun ? "Reprendre ma culture" : "Commencer une culture"}<small>Cultiver et récolter</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="workshop" onClick={() => onOpen("workshop")}><Warehouse size={20} aria-hidden="true" /><span>Aménager l’entrepôt<small>Matériel, tentes et entretien</small></span><ArrowRight size={17} aria-hidden="true" /></button>
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
