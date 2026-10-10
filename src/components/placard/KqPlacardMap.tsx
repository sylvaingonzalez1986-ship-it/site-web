"use client";

import Image from "next/image";
import { ArrowRight, BookOpen, BriefcaseBusiness, ChevronDown, CircleHelp, Compass, Landmark, MapPin, MoveHorizontal, Scan, ShoppingBag, Sprout, Store, Swords, Target, Tent, Wallet, Warehouse, ZoomIn } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import styles from "./KqPlacardMap.module.css";

export type PlacardMapView = "game" | "market" | "treasury" | "shop" | "arena" | "missions" | "workshop";
export type PlacardMapOpen = (view: PlacardMapView, options?: { treasuryPole?: "accounting" | "bank" | "management" }) => void;

const BUILDINGS = [
  { id: "warehouse", name: "L’Entrepôt", number: "01", category: "Le cœur de ta culture", description: "Derrière les grandes portes, ton placard prend vie. Fais pousser ta prochaine récolte et prends soin de ton installation.", Icon: Warehouse, x: 24, y: 25, width: 32, height: 37 },
  { id: "bank", name: "La Banque", number: "02", category: "De quoi voir plus grand", description: "Pousse la porte du banquier pour financer tes projets, mettre de côté et suivre tes placements.", Icon: Landmark, x: 53, y: 18, width: 20, height: 31 },
  { id: "office", name: "Le Bureau", number: "03", category: "Les affaires en ordre", description: "Les factures sur le bureau, les projets dans les tiroirs. Pilote tes comptes et développe ton activité.", Icon: BriefcaseBusiness, x: 79, y: 29, width: 21, height: 37 },
  { id: "market", name: "Le Marché", number: "04", category: "De la récolte au comptoir", description: "C’est ici que tes récoltes trouvent leur prochaine vie. Transforme tes lots et choisis comment les vendre.", Icon: Store, x: 22, y: 58, width: 25, height: 27 },
  { id: "shop", name: "La Boutique", number: "05", category: "Un coup de pouce pour la suite", description: "Du matériel pour ton installation et des packs Botte du Chanvrier pour tes prochaines cultures.", Icon: ShoppingBag, x: 48, y: 73, width: 23, height: 33 },
  { id: "arena", name: "Jury & duels", number: "06", category: "Fais pousser ta réputation", description: "Entre dans les gradins, présente tes Fleurs au jury et mesure tes récoltes à celles des autres joueurs.", Icon: Swords, x: 77, y: 66, width: 27, height: 36 },
  { id: "missions", name: "Les Missions", number: "07", category: "Toujours une nouvelle aventure", description: "Passe au tableau des missions. Des défis t’attendent, avec des packs, des Buddies et de l’argent du jeu à gagner.", Icon: Target, x: 48, y: 45, width: 15, height: 23 },
  { id: "collection", name: "La Collection", number: "08", category: "Botte du Chanvrier", description: "Retrouve tes cartes, tes doublons et celles qui te manquent. Ouvre une carte pour découvrir ses effets.", Icon: BookOpen, x: 27.5, y: 82, width: 17, height: 21 },
] as const;
type BuildingId = typeof BUILDINGS[number]["id"];

export function KqPlacardMap({ onOpen, onOpenCollection, activeRun, cashCents, tents, readyLotCount, availableFlowerCount, recommended }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
  activeRun?: boolean;
  cashCents: number | null;
  tents: number | null;
  readyLotCount?: number;
  availableFlowerCount?: number;
  recommended?: string;
}) {
  const [selected, setSelected] = useState<BuildingId>("warehouse");
  const [zoomed, setZoomed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const building = BUILDINGS.find(item => item.id === selected)!;
  const recommendedBuilding = recommended === "game" || recommended === "workshop" ? "warehouse" : recommended;
  const centerBuilding = (id: BuildingId) => {
    const container = viewport.current;
    const node = container?.querySelector<HTMLElement>(`[data-map-building="${id}"]`);
    if (container && node) container.scrollTo({ left: node.offsetLeft + node.offsetWidth / 2 - container.clientWidth / 2, behavior: "instant" });
  };
  const selectBuilding = (id: BuildingId) => {
    setSelected(id);
    centerBuilding(id);
  };
  const openCollection = (origin: HTMLButtonElement) => {
    origin.focus({ preventScroll: true });
    onOpenCollection();
  };
  const toggleZoom = () => {
    setZoomed(!zoomed);
    // Recenter after the CSS layout has switched between the full map and details.
    requestAnimationFrame(() => centerBuilding(selected));
  };
  const status = selected === "warehouse"
    ? activeRun ? "Ta culture est en cours." : tents ? `${tents} tente${tents > 1 ? "s" : ""} dans ton entrepôt.` : "Ton prochain départ se prépare ici."
    : selected === "market" && readyLotCount ? `${readyLotCount} lot${readyLotCount > 1 ? "s prêts" : " prêt"} à valoriser.`
    : selected === "arena" && availableFlowerCount ? `${availableFlowerCount} Fleur${availableFlowerCount > 1 ? "s disponibles" : " disponible"} pour le jury.` : null;

  return <section className={styles.world} aria-label="Carte du Placard" data-placard-map data-map-zoomed={zoomed || undefined}>
    <div className={styles.mapColumn}>
      <div className={styles.mapHeading}>
        <div className={styles.mapIdentity}>
          <h1>Mon quartier<span>.</span></h1>
          <p>Ton quartier. Tes cultures. Tes affaires.</p>
        </div>
        <button type="button" className={styles.zoomButton} data-map-zoom-toggle aria-pressed={zoomed} aria-controls="placard-map-viewport" onClick={toggleZoom}>
          {zoomed ? <Scan size={17} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />}{zoomed ? "Vue d’ensemble" : "Agrandir"}
        </button>
        <div className={styles.mapTools}>
          <div className={styles.wallet} aria-label="Résumé de ton Placard">
            <span><Wallet size={16} aria-hidden="true" /><span><small>Argent du jeu</small><strong>{cashCents !== null ? formatKqCash(cashCents) : "—"}</strong></span></span>
            <span><Tent size={16} aria-hidden="true" /><span><small>Ton installation</small><strong>{tents ? tents + " tente" + (tents > 1 ? "s" : "") : "—"}</strong></span></span>
          </div>
          <details className={styles.help}>
            <summary><CircleHelp size={17} aria-hidden="true" /> Aide <ChevronDown size={14} aria-hidden="true" /></summary>
            <div className={styles.helpContent}>
              <strong>Tout commence dans ton quartier.</strong>
              <p>Sélectionne un bâtiment sur la carte, puis choisis ce que tu veux y faire. Sur mobile, touche un numéro ou utilise le sélecteur de lieux. Agrandis la carte pour explorer le quartier en faisant glisser le décor.</p>
              <p>L’entrepôt abrite ton Placard : entre pour cultiver, ou aménage et entretiens tes tentes. Le marché accueille tes récoltes, le jury et les duels tes Fleurs.</p>
              <p>Le Bureau réunit la comptabilité et la gestion. La Banque donne directement accès aux prêts, à l’épargne et aux placements. Passe à la Boutique pour tes packs et ton matériel.</p>
            </div>
          </details>
        </div>
      </div>
      <div ref={viewport} id="placard-map-viewport" className={styles.viewport}>
        <div className={styles.terrain}>
          <Image src="/placard/map/placard-world-v2.webp" alt="Un quartier isométrique au milieu des bois : un entrepôt de culture, une banque, un bureau, un marché, une boutique, un amphithéâtre, un pavillon des missions et une maison de collection de cartes reliés par des chemins." fill sizes="(max-width: 760px) 760px, (max-width: 1100px) 100vw, 1100px" loading="eager" fetchPriority="high" draggable={false} />
          <nav aria-label="Les bâtiments du Placard">
            {BUILDINGS.map(({ id, name, number, Icon, x, y, width, height }) => <button key={id} type="button"
              className={styles.building} data-map-building={id} data-selected={selected === id || undefined}
              data-recommended={recommendedBuilding === id || undefined}
              data-arena-tour={id === "collection" ? "collection" : undefined}
              style={{ "--x": `${x}%`, "--y": `${y}%`, "--width": `${width}%`, "--height": `${height}%` } as CSSProperties}
              aria-label={id === "collection" ? "Ouvrir ma collection Botte du Chanvrier" : `Explorer ${name}`} aria-pressed={selected === id} aria-controls="placard-building-details"
              aria-haspopup={id === "collection" ? "dialog" : undefined}
              onClick={event => { selectBuilding(id); if (id === "collection") openCollection(event.currentTarget); }}>
              <span className={styles.mobileNumber} aria-hidden="true">{number}</span>
              <span className={styles.marker}><MapPin size={19} aria-hidden="true" /></span>
              <span className={styles.buildingLabel}><Icon size={15} aria-hidden="true" />{name}<span className={styles.recommendation} aria-label={recommendedBuilding === id ? "Activité conseillée" : undefined} /></span>
            </button>)}
          </nav>
          <span className={styles.compass} aria-hidden="true"><span>N</span><Compass strokeWidth={1} size={42} /><small>KQ</small></span>
        </div>
      </div>
      <div className={styles.mapFoot}><span className={styles.mapHint}><MapPin size={14} aria-hidden="true" /> Choisis un bâtiment pour y entrer.</span><span className={styles.panHint}><MoveHorizontal size={16} aria-hidden="true" /> Fais glisser la carte</span><span className={styles.mobileHint}>Touche un numéro pour découvrir le lieu.</span><span className={styles.legend}><i /> À poursuivre</span></div>
    </div>

    <aside className={styles.details} id="placard-building-details" aria-labelledby="placard-building-title">
      <label className={styles.mobileSelect}>Aller à un lieu
        <select value={selected} onChange={event => selectBuilding(event.target.value as BuildingId)} aria-label="Choisir un bâtiment">
          {BUILDINGS.map(item => <option key={item.id} value={item.id}>{item.number} · {item.name}</option>)}
        </select>
      </label>
      <div className={styles.detailHeading} aria-live="polite" aria-atomic="true">
        <div className={styles.detailTop}><building.Icon size={24} aria-hidden="true" /></div>
        <span className={styles.category}>{building.category}</span>
        <h2 id="placard-building-title">{building.name}</h2>
        <p>{building.description}</p>
        {status ? <div className={styles.status}><i />{status}</div> : null}
      </div>
      <nav className={styles.actions} aria-label={`Activités · ${building.name}`}>
        <span className={styles.actionEyebrow}>À l’intérieur</span>
        {selected === "warehouse" ? <>
          <button type="button" data-placard-activity="game" onClick={() => onOpen("game")}><Sprout size={20} aria-hidden="true" /><span>{activeRun ? "Reprendre ma culture" : "Entrer dans le Placard"}<small>Cultiver et récolter</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" data-placard-activity="workshop" onClick={() => onOpen("workshop")}><Warehouse size={20} aria-hidden="true" /><span>Aménager l’entrepôt<small>Tentes, matériel et entretien</small></span><ArrowRight size={17} aria-hidden="true" /></button>
        </> : selected === "bank" ? <button type="button" data-placard-activity="bank" onClick={() => onOpen("treasury", { treasuryPole: "bank" })}><Landmark size={20} aria-hidden="true" /><span>Rencontrer le banquier<small>Prêts, épargne et placements</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          : selected === "office" ? <>
            <button type="button" data-placard-activity="treasury" onClick={() => onOpen("treasury", { treasuryPole: "accounting" })}><BriefcaseBusiness size={20} aria-hidden="true" /><span>Ouvrir mes comptes<small>Factures et comptabilité</small></span><ArrowRight size={17} aria-hidden="true" /></button>
            <button type="button" data-placard-activity="management" onClick={() => onOpen("treasury", { treasuryPole: "management" })}><Target size={20} aria-hidden="true" /><span>Gérer mon activité<small>Site, publicité et domiciliation</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          </> : selected === "collection" ? <button type="button" data-placard-activity="collection" aria-haspopup="dialog" onClick={event => openCollection(event.currentTarget)}><BookOpen size={20} aria-hidden="true" /><span>Ma collection Botte du Chanvrier<small>Cartes, doublons et effets</small></span><ArrowRight size={17} aria-hidden="true" /></button>
          : <button type="button" data-placard-activity={selected} onClick={() => onOpen(selected)}><building.Icon size={20} aria-hidden="true" /><span>{selected === "market" ? "Ouvrir le marché" : selected === "shop" ? "Entrer dans la boutique" : selected === "arena" ? "Présenter mes Fleurs" : "Voir mes missions"}<small>{selected === "market" ? "Transformer et vendre" : selected === "shop" ? "Packs et matériel" : selected === "arena" ? "Jury et duels" : "Défis et récompenses"}</small></span><ArrowRight size={17} aria-hidden="true" /></button>}
      </nav>
      <div className={styles.note}><Compass size={21} aria-hidden="true" /><p>Une récolte, plusieurs chemins.<br /><strong>À toi de tracer le tien.</strong></p></div>
    </aside>
  </section>;
}
