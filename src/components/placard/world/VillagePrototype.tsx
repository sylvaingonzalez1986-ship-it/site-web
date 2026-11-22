"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Binoculars, BookOpen, House, Landmark, Mail, Minus, NotebookPen, Pause, Play, Plus, RotateCcw, RotateCw, Scan, Settings, ShoppingBag, Sprout, Store, Swords, Target, UsersRound } from "lucide-react";
import { QuarterAppearanceEditorContext, QuarterCharacterContext } from "../../contest/QuarterCharacterContext";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KorriganReaction } from "@/lib/kanab-quest-korrigan";
import { navigateWithDraftGuard } from "@/lib/navigation-guard";
import type { VillageBuildingKind } from "./village-buildings";
import { HEMP_FARM, HEMP_FARM_ID, VILLAGE_PLACES, type VillagePlaceId } from "./village-layout";
import { KqMailbox } from "../KqMailbox";
import { KqPlacardNavigation, type PlacardNavKey } from "../KqPlacardNavigation";
import type { VillageCameraRequest } from "./VillageCanvas";
import { VillageActivities } from "./VillageActivities";
import { VillageNpcDialogue, useVillageNpcDialogue, VILLAGE_NPC_NAMES } from "./VillageNpcDialogue";
import type { VillageNpcId } from "./village-npc-types";
import { useVillageActivity, useVillageMotionPreference, villageBuildingStatus } from "./useVillageActivity";
import { useVillageCalendar } from "./useVillageCalendar";
import { VillageCalendarSign } from "./VillageCalendarSign";
import { VillageNightContext } from "./VillageNightContext";
import retro from "../../contest/ArenaRetro.module.css";
import styles from "./VillagePrototype.module.css";

const Scene = dynamic(() => import("./VillageCanvas"), { ssr: false });
const KorriganMarket = dynamic(() => import("./KorriganMarket").then(module => module.KorriganMarket), { ssr: false });
const ICONS = { warehouse: House, bank: Landmark, office: UsersRound, market: Store, shop: ShoppingBag, arena: Swords, missions: Target, collection: BookOpen, [HEMP_FARM_ID]: Sprout };
const DESTINATIONS = [...VILLAGE_PLACES, HEMP_FARM];
const DEFAULT_CAMERA: VillageCameraRequest = { rotation: 0, zoom: 1, reset: 0 };
const HIDDEN_LABELS_KEY = "kq:village:building-labels-hidden";
const OBSERVER_NAMES: Record<VillageNpcId, string> = {
  breton: "Le sonneur de biniou",
  fisherman: "Le pêcheur près du pont",
  loic: "Loïc, le guide",
};
const NPC_IDS = Object.keys(OBSERVER_NAMES) as VillageNpcId[];

function closeVillageMenu(element: HTMLElement) {
  const menu = element.closest("details");
  if (menu) {
    menu.open = false;
    menu.querySelector("summary")?.focus();
  }
}

function handleMenuKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key === "Escape" && event.currentTarget.open) {
    event.stopPropagation();
    closeVillageMenu(event.currentTarget);
  }
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function VillagePrototype({ onNavigateHref, onNavigate: navigateGame, activeNav = "hub", activityOpen = false, onOpenOverview, onOpenSupport, onCloseActivity, supportOpen, restoreSupportView, children }: {
  onNavigateHref?: (href: string) => void;
  onNavigate?: (key: PlacardNavKey) => void;
  activeNav?: PlacardNavKey;
  activityOpen?: boolean;
  onOpenOverview?: () => void;
  onOpenSupport?: () => void;
  onCloseActivity?: () => void;
  supportOpen?: boolean;
  restoreSupportView?: boolean;
  children?: ReactNode;
} = {}) {
  const router = useRouter();
  const profile = useContext(QuarterCharacterContext);
  const editor = useContext(QuarterAppearanceEditorContext);
  const editingAppearance = editor?.editing === true;
  const { snapshot, status, retry, clock } = useVillageActivity();
  const calendar = useVillageCalendar(clock);
  const isNight = calendar?.phase === "night";
  const awaitingCalendar = !calendar && status === "loading";
  const { reduced, hidden } = useVillageMotionPreference();
  const [paused, setPaused] = useState(false);
  const [motionOverride, setMotionOverride] = useState(false);
  const [hovered, setHovered] = useState<VillagePlaceId | null>(null);
  const [focused, setFocused] = useState<VillagePlaceId | null>(null);
  const [mailboxFocused, setMailboxFocused] = useState(false);
  const [reaction, setReaction] = useState<{ building: VillageBuildingKind; sequence: number } | null>(null);
  const [selected, setSelected] = useState<VillagePlaceId | null>(null);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [marketOpen, setMarketOpen] = useState(false);
  const [korriganReaction, setKorriganReaction] = useState<KorriganReaction>("idle");
  const [ready, setReady] = useState(false);
  const [labelsHidden, setLabelsHidden] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const headerNode = useRef<HTMLElement>(null);
  const mailboxTrigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLElement>(null);
  const bubbleTail = useRef<SVGPathElement>(null);
  const restoringFocus = useRef(false);
  const previousActivityOpen = useRef(activityOpen);
  const selectedPlace = VILLAGE_PLACES.find(place => place.id === selected);
  const onReady = useCallback(() => {
    try { setLabelsHidden(localStorage.getItem(HIDDEN_LABELS_KEY) === "true"); }
    catch { /* The map still works without browser storage. */ }
    setReady(true);
  }, []);
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  const beforeNpcInteraction = useCallback(() => { setSelected(null); setFocused(null); setMailboxFocused(false); }, []);
  const npc = useVillageNpcDialogue(hidden, beforeNpcInteraction);
  const closeNpc = npc.close;
  const observeKorrigans = () => {
    closeNpc();
    setSelected(null);
    setFocused(null);
    setMailboxFocused(false);
    setCamera(previous => ({ ...previous, zoom: 1, observe: "korrigans" }));
  };
  const closeMarket = useCallback(() => {
    setMarketOpen(false);
    setKorriganReaction("idle");
    requestAnimationFrame(() => (labels.current.get("korrigans") ?? headerNode.current?.querySelector<HTMLElement>("summary"))?.focus({ preventScroll: true }));
  }, []);
  useEffect(() => {
    if (isNight) closeNpc();
  }, [isNight, closeNpc]);
  // Drop an observation when its inhabitants leave. Returning to night starts from the village view.
  const [previousNight, setPreviousNight] = useState(isNight);
  if (isNight !== previousNight) {
    setPreviousNight(isNight);
    if (camera.observe) setCamera({ ...DEFAULT_CAMERA, reset: camera.reset + 1 });
  }
  const select = useCallback((id: VillagePlaceId) => {
    if (id === HEMP_FARM_ID && activityOpen) return;
    closeNpc();
    setSelected(id);
    if (id === HEMP_FARM_ID) {
      if (onOpenSupport) onOpenSupport();
      else if (onNavigateHref) onNavigateHref(HEMP_FARM.href);
      else router.push(HEMP_FARM.href, { scroll: false });
      return;
    }
    setCamera(previous => previous.observe ? { ...previous, observe: undefined } : previous);
    setReaction(previous => ({ building: id, sequence: (previous?.sequence ?? 0) + 1 }));
  }, [activityOpen, closeNpc, onNavigateHref, onOpenSupport, router]);
  const motion = useMemo(() => ({ reduced: reduced && !motionOverride, hidden, paused: paused || activityOpen || editingAppearance }), [reduced, motionOverride, hidden, paused, activityOpen, editingAppearance]);
  const activity = useMemo(() => ({ culture: snapshot?.activeRun === true, market: (snapshot?.readyLotCount ?? 0) > 0, jury: (snapshot?.availableFlowerCount ?? 0) > 0 }), [snapshot]);
  const motionStopped = paused || motion.reduced;
  const toggleMotion = () => { if (motionStopped) { setPaused(false); setMotionOverride(reduced); } else setPaused(true); };
  const closeActivities = useCallback(() => {
    closeNpc();
    setSelected(null);
    if (selected) requestAnimationFrame(() => labels.current.get(selected)?.focus({ preventScroll: !unavailable }));
  }, [selected, closeNpc, unavailable]);
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
  const openDestination = (href: string) => onNavigateHref ? onNavigateHref(href) : router.push(href);

  useEffect(() => {
    if (previousActivityOpen.current && !activityOpen) {
      const target = unavailable && selectedPlace ? bubble.current?.querySelector("a") : labels.current.get(selected ?? "warehouse");
      restoringFocus.current = selected === HEMP_FARM_ID;
      target?.focus({ preventScroll: !unavailable });
      restoringFocus.current = false;
    }
    previousActivityOpen.current = activityOpen;
  }, [activityOpen, selected, selectedPlace, unavailable]);

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
    <header ref={headerNode} className={styles.header}>
      <h1 className={styles.srOnly} hidden={activityOpen}>Mon quartier</h1>
      <div className={styles.headerActions}>
        <KqPlacardNavigation active={activeNav} onNavigate={navigate} onHighlight={highlight} drawerOnly triggerClassName={styles.control} />
        {onOpenOverview ? <button className={styles.control} type="button" data-village-toolbar-return={activityOpen || undefined} aria-label={activityOpen ? "Revenir au village 3D" : "Ouvrir le bilan de ma partie"} onClick={() => { closeNpc(); if (activityOpen) onCloseActivity?.(); else navigateWithDraftGuard(onOpenOverview); }}>
          {activityOpen ? <ArrowLeft size={18} /> : <NotebookPen size={18} />}<span>{activityOpen ? "Au village" : "Ma partie"}</span>
        </button> : <Link className={styles.control} href="/arene/placard" prefetch={false} aria-label="Retour au quartier"><ArrowLeft size={18} /><span>Retour au jeu</span></Link>}
      </div>
      <div className={styles.gameSummary} data-village-activity-state={status} hidden={activityOpen}>
        {calendar && <VillageCalendarSign calendar={calendar} />}
        <div className={styles.walletRow}>
          {snapshot ? <span className={styles.cash}>Argent du jeu <strong>{formatKqCash(snapshot.cashCents)}</strong></span>
            : status === "loading" ? <span role="status">Chargement de ta partie…</span>
              : status === "signed-out" ? <Link href="/compte/connexion?next=%2Farene%2Fplacard" prefetch={false}>Me connecter pour retrouver ma partie</Link>
                : <><span role="status">État de la partie indisponible.</span><button type="button" className={styles.control} onClick={retry}>Réessayer</button></>}
          {!unavailable && <>
            <details name="village-toolbar" className={styles.lifeMenu} onKeyDown={handleMenuKeyDown}>
              <summary className={styles.control}><Binoculars size={16} aria-hidden="true" /><span>Observer</span></summary>
              <div className={styles.lifeChoices} role="group" aria-label="Personnages du village">
                {isNight ? <button type="button" className={styles.control} data-observe-life="korrigans" aria-pressed={camera.observe === "korrigans"} onClick={event => {
                  observeKorrigans(); closeVillageMenu(event.currentTarget);
                }}>La ronde des korrigans</button> : NPC_IDS.map(id => <button key={id} type="button" className={styles.control} data-observe-life={id} aria-pressed={camera.observe === id} onClick={event => {
                  closeNpc(); setSelected(null); setFocused(null); setMailboxFocused(false); setCamera(previous => ({ ...previous, zoom: 1, observe: id }));
                  closeVillageMenu(event.currentTarget);
                }}>{OBSERVER_NAMES[id]}</button>)}
              </div>
            </details>
            <details name="village-toolbar" className={styles.lifeMenu} data-village-settings onKeyDown={handleMenuKeyDown}>
              <summary className={styles.control} aria-label="Réglages du village" title="Réglages du village"><Settings size={16} aria-hidden="true" /><span className={styles.settingsText}>Réglages</span></summary>
              <div className={styles.lifeChoices} role="group" aria-label="Réglages du village">
                <button type="button" className={styles.control} data-village-toggle-labels onClick={event => {
                  setLabelsHidden(!labelsHidden);
                  try { localStorage.setItem(HIDDEN_LABELS_KEY, String(!labelsHidden)); }
                  catch { /* Keep the choice for this visit. */ }
                  closeVillageMenu(event.currentTarget);
                }}>{labelsHidden ? "Afficher les noms des bâtiments" : "Masquer les noms des bâtiments"}</button>
                {editor && profile && <button className={styles.control} type="button" aria-label="Modifier mon personnage" onClick={event => {
                  closeVillageMenu(event.currentTarget);
                  editor.open();
                }}>Modifier mon personnage</button>}
              </div>
            </details>
          </>}
        </div>
        {!calendar && snapshot && <small>Calendrier indisponible</small>}
      </div>
    </header>

    <section className={styles.stage} data-village-unavailable={unavailable || undefined} data-clock-pending={awaitingCalendar || undefined} inert={activityOpen} aria-hidden={activityOpen || undefined} aria-label={unavailable ? "Activités du quartier" : "Vue 3D du quartier"}>
      {unavailable ? <p className={styles.notice} role="alert">La vue 3D est indisponible. Choisis un bâtiment pour accéder à ses activités.</p>
        : <SceneBoundary onError={onUnavailable}>
          <Scene calendar={calendar} profile={profile} playerIndoors={activityOpen && (activeNav === "workshop" || activeNav === "game")} selected={selected} onSelect={select} onOpenMailbox={openMailbox} cameraRequest={camera} labelNodes={labels}
            headerNode={headerNode} bubbleNode={bubble} bubbleTail={bubbleTail} onCloseActivities={closeActivities} onReady={onReady} onUnavailable={onUnavailable}
            npc={npc.bridge} korriganReaction={korriganReaction} controlsBlocked={activityOpen || marketOpen} supportOpen={supportOpen} restoreSupportView={restoreSupportView}
            activity={activity} motion={motion} onHover={setHovered} focusBuilding={hovered === HEMP_FARM_ID || focused === HEMP_FARM_ID ? null : hovered ?? focused ?? selectedPlace?.id ?? null} keyboardFocus={mailboxFocused ? "mailbox" : focused} reaction={reaction} />
        </SceneBoundary>}
      {!unavailable && (!ready || awaitingCalendar) ? <div className={styles.loading} role="status">Chargement du village…</div> : null}
      <nav className={unavailable ? styles.destinations : styles.labels} data-hide-labels={!unavailable && labelsHidden || undefined} hidden={unavailable && !!selectedPlace} aria-label="Les bâtiments du village">
        {DESTINATIONS.map(place => {
          const Icon = ICONS[place.id];
          const support = place.id === HEMP_FARM_ID;
          const status = villageBuildingStatus(place.id, snapshot);
          return <button type="button" key={place.id} ref={node => { if (node) labels.current.set(place.id, node); else labels.current.delete(place.id); }}
            className={unavailable ? styles.control : styles.label} data-village-building={place.id} data-selected={selected === place.id || undefined} data-highlighted={support && hovered === place.id || undefined} aria-label={place.name}
            aria-haspopup={support ? "dialog" : undefined}
            aria-expanded={support ? undefined : selected === place.id} aria-controls={!support && selected === place.id ? "village-building-activities" : undefined}
            onClick={() => select(place.id)} onPointerEnter={() => setHovered(place.id)} onPointerLeave={() => setHovered(null)}
            onFocus={event => {
              if (event.currentTarget.matches(":focus-visible") && (!support || (!restoringFocus.current && event.currentTarget.dataset.offscreen === "true"))) setFocused(place.id);
            }} onBlur={() => setFocused(null)}>
            <Icon className={styles.labelIcon} size={18} aria-hidden="true" /><span>{place.name}{status ? <small>{status}</small> : null}</span>
          </button>;
        })}
        <KqMailbox onOpenPacks={() => openDestination("/arene/placard?view=shop")} renderTrigger={open =>
          <button ref={node => { mailboxTrigger.current = node; if (node) labels.current.set("mailbox", node); else labels.current.delete("mailbox"); }}
            className={unavailable ? styles.control : `${styles.label} ${styles.mailboxTrigger}`} type="button" aria-label="Ouvrir la boîte aux lettres" aria-haspopup="dialog" onClick={() => { closeNpc(); open(); }}
            onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setMailboxFocused(true); }} onBlur={() => setMailboxFocused(false)}>
            <Mail className={styles.labelIcon} size={18} aria-hidden="true" /><span>Courrier</span>
          </button>
        } />
        {isNight && <button type="button" ref={node => {
          if (node) labels.current.set("korrigans", node); else labels.current.delete("korrigans");
        }} className={unavailable ? styles.control : `${styles.label} ${styles.korriganAccess}`} data-korrigan-access
          onFocus={event => { if (event.currentTarget.matches(":focus-visible") && !unavailable) observeKorrigans(); }}
          onClick={() => { observeKorrigans(); setKorriganReaction("invite"); setMarketOpen(true); }}>Parler aux korrigans</button>}
      </nav>
      {!unavailable && !isNight ? <nav className={styles.labels} aria-label="Les habitants du village">
        {NPC_IDS.map(id => <button key={id} type="button"
          ref={node => { if (node) labels.current.set(`npc-${id}`, node); else labels.current.delete(`npc-${id}`); }}
          className={`${styles.label} ${styles.npcAccess}`} data-npc-access={id}
          aria-label={id === "loic" ? "Ouvrir le tutoriel avec Loïc" : `Parler avec ${VILLAGE_NPC_NAMES[id].toLowerCase()}`}
          onFocus={event => { if (event.currentTarget.matches(":focus-visible")) { setFocused(null); setCamera(previous => ({ ...previous, zoom: 1, observe: id })); } }}
          onClick={() => npc.bridge.onInteract(id)}>{id === "loic" ? "Loïc · Tutoriel" : VILLAGE_NPC_NAMES[id]}</button>)}
      </nav> : null}

      {!unavailable ? <fieldset className={styles.cameraControls} aria-label="Caméra du village">
        <button className={styles.iconControl} type="button" aria-label="Tourner à gauche" onClick={() => rotate(-1)}><RotateCcw size={19} /></button>
        <button className={styles.iconControl} type="button" aria-label="Tourner à droite" onClick={() => rotate(1)}><RotateCw size={19} /></button>
        <span />
        <button className={styles.iconControl} type="button" aria-label="Agrandir le village" onClick={() => zoom(0.2)} disabled={camera.zoom >= 2.5}><Plus size={20} /></button>
        <button className={styles.iconControl} type="button" aria-label="Réduire le village" onClick={() => zoom(-0.2)} disabled={camera.zoom <= 0.7}><Minus size={20} /></button>
        <button className={styles.iconControl} type="button" aria-label="Recentrer la vue isométrique" onClick={reset}><Scan size={19} /></button>
        <button className={styles.iconControl} type="button" data-village-motion-toggle aria-label={motionStopped ? "Lancer les animations" : "Mettre les animations en pause"} aria-pressed={!motionStopped} onClick={toggleMotion}>{motionStopped ? <Play size={18} /> : <Pause size={18} />}</button>
      </fieldset> : null}

      {selectedPlace ? <>
        {!unavailable ? <svg className={styles.bubbleTail} data-village-bubble-tail aria-hidden="true"><path ref={bubbleTail} /></svg> : null}
        <VillageActivities key={selectedPlace.id} id={selectedPlace.id} name={selectedPlace.name} nodeRef={bubble} fallback={unavailable} onClose={closeActivities} snapshot={snapshot} onNavigate={onNavigateHref} />
      </> : null}
      {!unavailable && !isNight && npc.dialogue ? <VillageNpcDialogue dialogue={npc.dialogue} bridge={npc.bridge} onClose={() => closeNpc(true)} onReading={npc.setReading} /> : null}
    </section>
    {marketOpen && !activityOpen && <KorriganMarket isNight={isNight} onClose={closeMarket} onReaction={setKorriganReaction} />}
    <VillageNightContext.Provider value={isNight}>{children}</VillageNightContext.Provider>
    <span className={styles.srOnly} role="status">{selectedPlace ? `${selectedPlace.name} sélectionné. ${selectedPlace.description}` : unavailable ? null : ready ? "Village 3D prêt. Choisis un bâtiment dans le village ou avec la touche Tab." : "Chargement du village."}</span>
  </div>;
}
