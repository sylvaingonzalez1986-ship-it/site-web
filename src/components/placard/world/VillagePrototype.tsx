"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Binoculars, BookOpen, House, ImageIcon, Landmark, Mail, Minus, NotebookPen, Pause, Play, Plus, RotateCcw, RotateCw, Scan, ShoppingBag, Store, Swords, Target, UsersRound } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { navigateWithDraftGuard } from "@/lib/navigation-guard";
import type { VillageBuildingKind } from "./village-buildings";
import { VILLAGE_PLACES } from "./village-layout";
import { KQ_PLACARD_MAP_SCENE } from "../KqPlacardMap.geometry";
import { MAP_ENTRANCES } from "../KqPlacardMap.scene";
import { KqMailbox } from "../KqMailbox";
import { KqPlacardNavigation, type PlacardNavKey } from "../KqPlacardNavigation";
import type { VillageCameraRequest, VillageLifeSubject } from "./VillageCanvas";
import { VillageActivities } from "./VillageActivities";
import { VillageNpcDialogue, useVillageNpcDialogue, VILLAGE_NPC_NAMES } from "./VillageNpcDialogue";
import type { VillageNpcId } from "./village-npc-types";
import { useVillageActivity, useVillageMotionPreference, villageBuildingStatus } from "./useVillageActivity";
import retro from "../../contest/ArenaRetro.module.css";
import styles from "./VillagePrototype.module.css";

const Scene = dynamic(() => import("./VillageCanvas"), { ssr: false, loading: () => <div className={styles.loading} role="status">Le quartier prend du relief…</div> });
const ICONS = { warehouse: House, bank: Landmark, office: UsersRound, market: Store, shop: ShoppingBag, arena: Swords, missions: Target, collection: BookOpen };
const DEFAULT_CAMERA: VillageCameraRequest = { rotation: 0, zoom: 1, reset: 0 };
const LIFE_SUBJECTS: readonly [VillageLifeSubject, string][] = [["wolf", "Le loup"], ["fox", "Le renard"], ["weasel", "La belette"], ["boat", "Le bateau de pêche"], ["breton", "Le sonneur de biniou"], ["fisherman", "Le pêcheur près du pont"], ["loic", "Loïc, le guide"]];

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function VillagePrototype({ onNavigateHref, onNavigate: navigateGame, activeNav = "hub", activityOpen = false, tutorialActive = false, onOpenOverview, onCloseActivity, onSwitchTo2D, children }: {
  onNavigateHref?: (href: string) => void;
  onNavigate?: (key: PlacardNavKey) => void;
  activeNav?: PlacardNavKey;
  activityOpen?: boolean;
  tutorialActive?: boolean;
  onOpenOverview?: () => void;
  onCloseActivity?: () => void;
  onSwitchTo2D?: () => void;
  children?: ReactNode;
} = {}) {
  const router = useRouter();
  const { snapshot, status, retry } = useVillageActivity();
  const { reduced, hidden } = useVillageMotionPreference();
  const [paused, setPaused] = useState(false);
  const [motionOverride, setMotionOverride] = useState(false);
  const [hovered, setHovered] = useState<VillageBuildingKind | null>(null);
  const [focused, setFocused] = useState<VillageBuildingKind | null>(null);
  const [mailboxFocused, setMailboxFocused] = useState(false);
  const [reaction, setReaction] = useState<{ building: VillageBuildingKind; sequence: number } | null>(null);
  const [selected, setSelected] = useState<VillageBuildingKind | null>(null);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [original, setOriginal] = useState(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const mailboxTrigger = useRef<HTMLButtonElement>(null);
  const painting = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLElement>(null);
  const bubbleTail = useRef<SVGPathElement>(null);
  const previousActivityOpen = useRef(activityOpen);
  const selectedPlace = VILLAGE_PLACES.find(place => place.id === selected);
  const onReady = useCallback(() => setReady(true), []);
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  const beforeNpcInteraction = useCallback(() => { setSelected(null); setFocused(null); setMailboxFocused(false); }, []);
  const npc = useVillageNpcDialogue(tutorialActive, hidden, beforeNpcInteraction);
  const closeNpc = npc.close;
  const select = useCallback((id: VillageBuildingKind) => { closeNpc(); setCamera(previous => previous.observe ? { ...previous, observe: undefined } : previous); setSelected(id); setReaction(previous => ({ building: id, sequence: (previous?.sequence ?? 0) + 1 })); }, [closeNpc]);
  const motion = useMemo(() => ({ reduced: reduced && !motionOverride, hidden, paused: paused || activityOpen }), [reduced, motionOverride, hidden, paused, activityOpen]);
  const activity = useMemo(() => ({ culture: snapshot?.activeRun === true, market: (snapshot?.readyLotCount ?? 0) > 0, jury: (snapshot?.availableFlowerCount ?? 0) > 0 }), [snapshot]);
  const motionStopped = paused || motion.reduced;
  const toggleMotion = () => { if (motionStopped) { setPaused(false); setMotionOverride(reduced); } else setPaused(true); };
  const closeActivities = useCallback(() => {
    closeNpc();
    setSelected(null);
    if (selected) labels.current.get(selected)?.focus({ preventScroll: true });
  }, [selected, closeNpc]);
  const openMailbox = useCallback(() => {
    closeNpc();
    setSelected(null);
    // Return focus to the keyboard-accessible opener when the dialog closes.
    mailboxTrigger.current?.focus({ preventScroll: true });
    mailboxTrigger.current?.click();
  }, [closeNpc]);
  const reset = () => { closeNpc(); setSelected(null); setCamera(previous => ({ ...DEFAULT_CAMERA, reset: previous.reset + 1 })); };
  const navigate = (key: PlacardNavKey) => {
    closeNpc();
    if (navigateGame) { navigateGame(key); return; }
    if (key === "hub") { reset(); return; }
    router.push(key === "collection" ? "/arene/placard?view=shop&tab=collection" : `/arene/placard?view=${key}`);
  };
  const highlight = (building: string | null) => {
    const id = building === "school" ? "collection" : building;
    setHovered(VILLAGE_PLACES.find(place => place.id === id)?.id ?? null);
  };
  const zoom = (amount: number) => setCamera(previous => ({ ...previous, zoom: Math.max(0.7, Math.min(2.5, previous.zoom + amount)) }));
  const rotate = (amount: number) => setCamera(previous => ({ ...previous, rotation: previous.rotation + amount }));
  const showPainting = original || unavailable;
  const openDestination = (href: string) => onNavigateHref ? onNavigateHref(href) : router.push(href);

  useEffect(() => {
    if (previousActivityOpen.current && !activityOpen) labels.current.get(selected ?? "warehouse")?.focus({ preventScroll: true });
    previousActivityOpen.current = activityOpen;
  }, [activityOpen, selected]);

  useEffect(() => {
    const frame = painting.current;
    if (!showPainting || !frame) return;
    const positionLabels = () => {
      const scale = Math.min(frame.clientWidth / 1536, frame.clientHeight / 1024);
      const left = frame.offsetLeft + (frame.clientWidth - 1536 * scale) / 2;
      const top = frame.offsetTop + (frame.clientHeight - 1024 * scale) / 2;
      const anchors = { ...MAP_ENTRANCES, mailbox: [998, 533] };
      for (const [id, [x, y]] of Object.entries(anchors)) {
        const label = labels.current.get(id);
        if (!label) continue;
        label.style.removeProperty("visibility");
        label.style.transform = `translate(${left + x * scale}px, ${top + y * scale}px) translate(-50%, 0)`;
        label.dataset.offscreen = "false";
      }
    };
    positionLabels();
    const observer = new ResizeObserver(positionLabels); observer.observe(frame);
    return () => observer.disconnect();
  }, [showPainting]);

  useEffect(() => {
    // This local full-screen viewer covers the site's navigation, so it must not keep its hidden tab stops.
    const main = document.getElementById("main-content");
    const siblings = [...(main?.parentElement?.children ?? [])].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== main);
    const previous = siblings.map(node => ({ node, inert: node.inert }));
    previous.forEach(({ node }) => { node.inert = true; });
    return () => previous.forEach(({ node, inert }) => { node.inert = inert; });
  }, []);

  return <div className={`${styles.root} ${retro.surface}`} data-village-prototype data-village-integrated={!!navigateGame || undefined} data-activity-open={activityOpen || undefined} onKeyDown={event => {
    if (event.key === "Escape" && !event.defaultPrevented && !(event.target as Element).closest("dialog")) {
      if (activityOpen) { event.stopPropagation(); onCloseActivity?.(); }
      else if (npc.dialogue) { event.stopPropagation(); closeNpc(true); }
      else if (selected) { event.stopPropagation(); closeActivities(); }
    }
  }}>
    <header className={styles.header}>
      <div className={styles.headerActions}>
        <KqPlacardNavigation active={activeNav} onNavigate={navigate} onHighlight={highlight} drawerOnly triggerClassName={styles.control} />
        {onOpenOverview ? <button className={styles.control} type="button" aria-label={activityOpen ? "Revenir au village 3D" : "Ouvrir le bilan de ma partie"} onClick={() => { closeNpc(); if (activityOpen) onCloseActivity?.(); else navigateWithDraftGuard(onOpenOverview); }}>
          {activityOpen ? <ArrowLeft size={18} /> : <NotebookPen size={18} />}<span>{activityOpen ? "Au village" : "Ma partie"}</span>
        </button> : <Link className={styles.control} href="/arene/placard" prefetch={false} aria-label="Retour au quartier"><ArrowLeft size={18} /><span>Retour au jeu</span></Link>}
      </div>
      <div className={styles.title} hidden={activityOpen}><h1>Mon quartier</h1><span>Village 3D</span></div>
      <button className={styles.control} type="button" onClick={() => onSwitchTo2D ? onSwitchTo2D() : navigateWithDraftGuard(() => setOriginal(value => !value))} aria-label={onSwitchTo2D ? "Passer à la carte 2D" : original ? "Voir le village en 3D" : "Voir la carte d’origine"} aria-pressed={onSwitchTo2D ? undefined : original} disabled={!onSwitchTo2D && unavailable}>
        {original ? <House size={18} /> : <ImageIcon size={18} />}<span>{onSwitchTo2D ? "Vue 2D" : original ? "Voir en 3D" : "Carte d’origine"}</span>
      </button>
    </header>

    <section className={styles.stage} inert={activityOpen} aria-hidden={activityOpen || undefined} aria-label={showPainting ? "Carte illustrée du quartier" : "Vue 3D du quartier"}>
      <div className={styles.gameSummary} data-village-activity-state={status}>
        {snapshot ? <span>Argent du jeu <strong>{formatKqCash(snapshot.cashCents)}</strong></span>
          : status === "loading" ? <span role="status">Chargement de ta partie…</span>
            : status === "signed-out" ? <Link href="/compte/connexion?next=%2Farene%2Fplacard%3Fworld%3D3d" prefetch={false}>Me connecter pour retrouver ma partie</Link>
              : <><span role="status">État de la partie indisponible.</span><button type="button" className={styles.control} onClick={retry}>Réessayer</button></>}
        {!showPainting ? <details className={styles.lifeMenu} inert={tutorialActive} onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
        }}>
          <summary className={styles.control}><Binoculars size={16} aria-hidden="true" /><span>Observer</span></summary>
          <div className={styles.lifeChoices} aria-label="Vie de l’île">
            {LIFE_SUBJECTS.map(([id, label]) => <button key={id} type="button" className={styles.control} data-observe-life={id} aria-pressed={camera.observe === id} onClick={event => {
              closeNpc(); setSelected(null); setFocused(null); setMailboxFocused(false); setCamera(previous => ({ ...previous, zoom: 1, observe: id }));
              const menu = event.currentTarget.closest("details"); if (menu) { menu.open = false; menu.querySelector("summary")?.focus(); }
            }}>{label}</button>)}
          </div>
        </details> : null}
      </div>
      {showPainting ? <div ref={painting} className={styles.painting}><Image src={KQ_PLACARD_MAP_SCENE.image} alt={KQ_PLACARD_MAP_SCENE.alt} fill sizes="100vw" priority unoptimized /></div>
        : <SceneBoundary onError={onUnavailable} fallback={<p role="alert">La carte d’origine reste disponible.</p>}>
          <Scene selected={selected} onSelect={select} onOpenMailbox={openMailbox} cameraRequest={camera} labelNodes={labels}
            bubbleNode={bubble} bubbleTail={bubbleTail} onCloseActivities={closeActivities} onReady={onReady} onUnavailable={onUnavailable}
            npc={npc.bridge} controlsBlocked={tutorialActive || activityOpen}
            activity={activity} motion={motion} onHover={setHovered} focusBuilding={hovered ?? focused ?? selected} keyboardFocus={mailboxFocused ? "mailbox" : focused} reaction={reaction} />
        </SceneBoundary>}
      {!showPainting && !ready ? <div className={styles.loading} role="status">Construction du village…</div> : null}
      <nav className={styles.labels} data-painting={showPainting || undefined} aria-label="Les bâtiments du village">
        {VILLAGE_PLACES.map(place => {
          const Icon = ICONS[place.id];
          return <button type="button" key={place.id} ref={node => { if (node) labels.current.set(place.id, node); else labels.current.delete(place.id); }}
            className={styles.label} data-village-building={place.id} data-selected={selected === place.id || undefined} aria-label={place.name}
            aria-expanded={selected === place.id} aria-controls={selected === place.id ? "village-building-activities" : undefined}
            onClick={() => select(place.id)} onPointerEnter={() => setHovered(place.id)} onPointerLeave={() => setHovered(null)}
            onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setFocused(place.id); }} onBlur={() => setFocused(null)}>
            <Icon className={styles.labelIcon} size={18} aria-hidden="true" /><span>{place.name}{villageBuildingStatus(place.id, snapshot) ? <small>{villageBuildingStatus(place.id, snapshot)}</small> : null}</span>
          </button>;
        })}
        <KqMailbox onOpenPacks={() => openDestination("/arene/placard?view=shop")} renderTrigger={open =>
          <button ref={node => { mailboxTrigger.current = node; if (node) labels.current.set("mailbox", node); else labels.current.delete("mailbox"); }}
            className={`${styles.label} ${styles.mailboxTrigger}`} type="button" aria-label="Ouvrir la boîte aux lettres" aria-haspopup="dialog" onClick={() => { closeNpc(); open(); }}
            onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setMailboxFocused(true); }} onBlur={() => setMailboxFocused(false)}>
            <Mail className={styles.labelIcon} size={18} aria-hidden="true" /><span>Courrier</span>
          </button>
        } />
      </nav>
      {!showPainting ? <nav className={styles.labels} aria-label="Les habitants du village">
        {(Object.keys(VILLAGE_NPC_NAMES) as VillageNpcId[]).map(id => <button key={id} type="button"
          ref={node => { if (node) labels.current.set(`npc-${id}`, node); else labels.current.delete(`npc-${id}`); }}
          className={`${styles.label} ${styles.npcAccess}`} data-npc-access={id} disabled={tutorialActive}
          aria-label={id === "loic" ? "Ouvrir le tutoriel avec Loïc" : `Parler avec ${VILLAGE_NPC_NAMES[id].toLowerCase()}`}
          onFocus={event => { if (event.currentTarget.matches(":focus-visible")) { setFocused(null); setCamera(previous => ({ ...previous, zoom: 1, observe: id })); } }}
          onClick={() => npc.bridge.onInteract(id)}>{id === "loic" ? "Loïc · Tutoriel" : VILLAGE_NPC_NAMES[id]}</button>)}
      </nav> : null}

      {!showPainting ? <fieldset className={styles.cameraControls} disabled={tutorialActive} aria-label="Caméra du village">
        <button className={styles.iconControl} type="button" aria-label="Tourner à gauche" onClick={() => rotate(-1)}><RotateCcw size={19} /></button>
        <button className={styles.iconControl} type="button" aria-label="Tourner à droite" onClick={() => rotate(1)}><RotateCw size={19} /></button>
        <span />
        <button className={styles.iconControl} type="button" aria-label="Agrandir le village" onClick={() => zoom(0.2)} disabled={camera.zoom >= 2.5}><Plus size={20} /></button>
        <button className={styles.iconControl} type="button" aria-label="Réduire le village" onClick={() => zoom(-0.2)} disabled={camera.zoom <= 0.7}><Minus size={20} /></button>
        <button className={styles.iconControl} type="button" aria-label="Recentrer la vue isométrique" onClick={reset}><Scan size={19} /></button>
        <button className={styles.iconControl} type="button" data-village-motion-toggle aria-label={motionStopped ? "Lancer les animations" : "Mettre les animations en pause"} aria-pressed={!motionStopped} onClick={toggleMotion}>{motionStopped ? <Play size={18} /> : <Pause size={18} />}</button>
      </fieldset> : null}

      {selectedPlace ? <>
        {!showPainting ? <svg className={styles.bubbleTail} data-village-bubble-tail aria-hidden="true"><path ref={bubbleTail} /></svg> : null}
        <VillageActivities key={selectedPlace.id} id={selectedPlace.id} name={selectedPlace.name} nodeRef={bubble} fallback={showPainting} onClose={closeActivities} snapshot={snapshot} onNavigate={onNavigateHref} />
      </> : null}
      {!showPainting && !tutorialActive && npc.dialogue ? <VillageNpcDialogue dialogue={npc.dialogue} bridge={npc.bridge} onClose={() => closeNpc(true)} onReading={npc.setReading} /> : null}
      {unavailable ? <p className={styles.notice} role="alert">La 3D est indisponible sur ce navigateur. Les accès sur la carte restent utilisables.</p> : null}
    </section>
    {children}
    <span className={styles.srOnly} role="status">{selectedPlace ? `${selectedPlace.name} sélectionné. ${selectedPlace.description}` : ready ? "Village 3D prêt. Choisis un bâtiment sur la carte ou avec la touche Tab." : "Chargement du village."}</span>
  </div>;
}
