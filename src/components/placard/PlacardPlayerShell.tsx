"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, Hourglass, Volume2, VolumeX } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import { navigateWithDraftGuard } from "@/lib/navigation-guard";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KqPlacardLobby } from "./KqPlacardLobby";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import printedArt from "./KqPrintedArt.module.css";
import { KqPlacardNavigation, type PlacardNavKey } from "./KqPlacardNavigation";
import { useGameViewport } from "@/hooks/useGameViewport";
import retro from "../contest/ArenaRetro.module.css";
import styles from "./PlacardPlayerShell.module.css";
import type { KqMarketSection } from "./KqMarketHub";
import type { KqOnlineBusinessTab } from "./KqOnlineBusiness";
import { KqGameSoundProvider, useKqGameSound } from "./KqGameSound";
import { kqPreparationStorage, readKqPreparationDraft, writeKqPreparationDraft } from "@/lib/kanab-quest-preparation-draft";
import type { KqPreparationSelection } from "@/lib/kanab-quest-preparation-selection";
import { getKqMissionTarget } from "@/lib/kanab-quest-pinned-mission";
import { KqMissionFocusProvider, KqPinnedMission } from "./KqPinnedMission";

const NAVIGATION_FEEDBACK_MS = 420;

function PlacardViewLoading() {
  return (
    <div className={styles.loadingView} role="status">
      <span className={styles.statusSign}>
        <Hourglass className="animate-spin motion-reduce:animate-none" aria-hidden="true" size={20} strokeWidth={2.7} />
        Chargement…
      </span>
    </div>
  );
}

const KanabQuestDicePrototype = dynamic(
  () => import("./KanabQuestDicePrototype").then((module) => module.KanabQuestDicePrototype),
  { loading: PlacardViewLoading },
);
const KqSupportBoosterShop = dynamic(
  () => import("./KqSupportBoosterShop").then((module) => module.KqSupportBoosterShop),
  { loading: PlacardViewLoading },
);
const KqMarketDesk = dynamic(
  () => import("./KqMarketDesk").then((module) => module.KqMarketDesk),
  { loading: PlacardViewLoading },
);
const KqSocialNetworks = dynamic(
  () => import("./KqSocialNetworks").then((module) => module.KqSocialNetworks),
  { loading: PlacardViewLoading },
);
const KqTreasuryDesk = dynamic(
  () => import("./KqTreasuryDesk").then((module) => module.KqTreasuryDesk),
  { loading: PlacardViewLoading },
);
const KqMissionCenter = dynamic(
  () => import("./KqMissionCenter").then((module) => module.KqMissionCenter),
  { loading: PlacardViewLoading },
);
const KqBotteCollection = dynamic(() => import("./KqBotteCollection").then((module) => module.KqBotteCollection), { ssr: false });
const KqWarehouseEntry = dynamic(() => import("./KqWarehouseEntry").then((module) => module.KqWarehouseEntry), { loading: PlacardViewLoading });
const KqPlacardHud = dynamic(() => import("./KqPlacardHud").then((module) => module.KqPlacardHud), { loading: PlacardViewLoading });

const KqHarvests = dynamic(() => import("./KqHarvests").then(module => module.KqHarvests), { loading: PlacardViewLoading });

type PlacardView = "harvests" | "hub" | "shop" | "game" | "arena" | "market" | "social" | "treasury" | "missions" | "workshop";
const VIEW_ART: Record<PlacardView, KqPrintedArtKind> = {
  hub: "quarter", game: "culture", harvests: "harvest", workshop: "warehouse",
  market: "commerce", social: "social", treasury: "accounts", missions: "missions", arena: "achievements", shop: "card-shop",
};
type TreasuryPole = "accounting" | "bank";
type CardSection = "botte" | "buddies";
type PlacardNavigationOptions = { equipmentCode?: string; catalog?: boolean; shopSection?: CardSection; from?: PlacardView; fromMarketSection?: KqMarketSection; fromSection?: KqMarketSection | "storage"; fromFlowerId?: string; fromLotId?: string; fromListingId?: string; fromBusinessView?: KqOnlineBusinessTab; fromGame?: "missions"; treasuryPole?: TreasuryPole; marketSection?: KqMarketSection; businessView?: KqOnlineBusinessTab; warehouseSection?: "storage"; configureStorage?: boolean; harvestSection?: "storage"; flowerId?: string; lotId?: string; listingId?: string; zoneId?: string; runId?: string; campaign?: boolean };
const LOCATION_EVENT = "kq:placard-location";

function isPlacardView(value: string | null): value is PlacardView {
  return value === "harvests" || value === "hub" || value === "shop" || value === "game" || value === "arena" || value === "market" || value === "social" || value === "treasury" || value === "missions" || value === "workshop";
}

function isTreasuryPole(value: string | null): value is TreasuryPole {
  return value === "accounting" || value === "bank";
}

function businessTab(value: string | null): KqOnlineBusinessTab {
  return value === "brand" || value === "merch" || value === "marketing" ? value : "site";
}

function sourceSection(value: string | null): KqMarketSection | "storage" | undefined {
  return value === "overview" || value === "demands" || value === "sales" || value === "dashboard" || value === "management" || value === "storage" ? value : undefined;
}

const getPlacardLocation = () => window.location.search;

function subscribePlacardLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(LOCATION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(LOCATION_EVENT, onStoreChange);
  };
}

const PLACARD_VIEW_LABELS: Record<PlacardView, string> = {
  harvests: "de tes récoltes",
  workshop: "de l’Entrepôt",
  hub: "de Kanab Quest",
  shop: "des packs de cartes",
  game: "de la Culture",
  arena: "du Jury et des duels",
  market: "du Commerce",
  social: "de tes réseaux",
  treasury: "des Finances",
  missions: "des Missions",
};

const PLACARD_RETURN_LABELS: Record<PlacardView, { label: string; accessibleLabel: string }> = {
  hub: { label: "Quartier", accessibleLabel: "Retour au quartier" },
  workshop: { label: "Entrepôt", accessibleLabel: "Retour à l’entrepôt" },
  game: { label: "Culture", accessibleLabel: "Retour à la culture" },
  harvests: { label: "Récoltes", accessibleLabel: "Retour à mes récoltes" },
  arena: { label: "Jury & duels", accessibleLabel: "Retour au jury et aux duels" },
  market: { label: "Commerce", accessibleLabel: "Retour à mon commerce" },
  social: { label: "Réseaux", accessibleLabel: "Retour à mes réseaux" },
  treasury: { label: "Finances", accessibleLabel: "Retour à mes finances" },
  missions: { label: "Missions", accessibleLabel: "Retour aux missions" },
  shop: { label: "Packs", accessibleLabel: "Retour aux packs de cartes" },
};

export function PlacardPlayerShell({ draftOwnerId }: { draftOwnerId?: string } = {}) {
  return <KqGameSoundProvider><KqMissionFocusProvider key={draftOwnerId ?? "guest"} ownerId={draftOwnerId}><PlacardPlayerShellContent draftOwnerId={draftOwnerId} /></KqMissionFocusProvider></KqGameSoundProvider>;
}

function PlacardPlayerShellContent({ draftOwnerId }: { draftOwnerId?: string }) {
  const sound = useKqGameSound();
  const location = useSyncExternalStore(subscribePlacardLocation, getPlacardLocation, () => "");
  const params = new URLSearchParams(location);
  const guidedVisit = params.get("guide") === "1";
  const requestedView = params.get("view");
  const requestedTreasuryPole = params.get("pole");
  const legacyManagement = requestedView === "treasury" && requestedTreasuryPole === "management";
  const legacyEquipmentShop = requestedView === "shop" && params.get("catalog") === "equipment";
  const legacySocial = requestedView === "market" && params.get("section") === "social";
  const view: PlacardView = legacySocial ? "social" : legacyEquipmentShop ? "workshop" : legacyManagement ? "market" : isPlacardView(requestedView) ? requestedView : "hub";
  const treasuryPole: TreasuryPole = view === "treasury" && isTreasuryPole(requestedTreasuryPole) ? requestedTreasuryPole : "accounting";
  const marketSection: KqMarketSection = legacyManagement || params.get("section") === "management" ? "management"
    : params.get("section") === "dashboard" || (!params.get("section") && params.get("listing")) ? "dashboard" : params.get("section") === "demands" ? "demands"
      : params.get("section") === "overview" ? "overview" : params.get("section") === "sales" || params.get("flower") || params.get("lot") ? "sales" : "overview";
  const managementView = businessTab(params.get("business"));
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionSection, setCollectionSection] = useState<CardSection>("botte");
  const [progressOpen, setProgressOpen] = useState(false);
  const [preparation, setPreparation] = useState<KqPreparationSelection | null>(() => readKqPreparationDraft(kqPreparationStorage(), draftOwnerId));
  const [pendingView, setPendingView] = useState<PlacardView | null>(null);
  const navigationTimerRef = useRef<number | null>(null);
  const [highlightedBuilding, setHighlightedBuilding] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestedFlowerId = params.get("flower") ?? undefined;
  const requestedLotId = params.get("lot") ?? undefined;
  const requestedListingId = params.get("listing") ?? undefined;
  const requestedZoneId = params.get("zone") ?? undefined;
  const requestedRunId = params.get("run") ?? undefined;
  const requestedCampaign = params.get("campaign") === "1";
  const harvestSection = params.get("section") === "storage" ? "storage" : "overview";
  const requestedEquipmentCode = params.get("equipment");
  const warehouseSection = !legacyEquipmentShop && params.get("section") === "storage" ? "storage" : "equipment";
  const autoOpenEquipmentCatalog = view === "workshop" && params.get("catalog") === "equipment";
  const autoOpenStorageEquipment = view === "workshop" && warehouseSection === "storage" && params.get("configure") === "storage";
  const shopSection: CardSection = params.get("section") === "buddies" ? "buddies" : "botte";
  const from = params.get("from");
  const fromGame = params.get("fromGame") === "missions" ? "missions" : undefined;
  const fromSection = params.get("fromSection");
  const fromFlowerId = params.get("fromFlower") ?? undefined;
  const fromLotId = params.get("fromLot") ?? undefined;
  const fromListingId = params.get("fromListing") ?? undefined;
  const fromBusinessView = params.has("fromBusiness") ? businessTab(params.get("fromBusiness")) : undefined;
  const shopReturnView: PlacardView = from === "market" && params.get("fromSection") === "social" ? "social" : isPlacardView(from) && from !== "shop" ? from : "hub";
  const shopReturnMarketSection: KqMarketSection = params.get("fromSection") === "management" ? "management"
    : params.get("fromSection") === "dashboard" ? "dashboard" : params.get("fromSection") === "sales" ? "sales"
      : params.get("fromSection") === "demands" ? "demands" : "overview";

  const surfaceRef = useGameViewport<HTMLDivElement>(`${view}:${params.get("section") ?? ""}:${treasuryPole}`, { restoreOnBack: true });

  const openView = useCallback((nextView: PlacardView, options: PlacardNavigationOptions = {}) => {
    navigateWithDraftGuard(() => navigateAfterOverlays(() => {
    if (nextView === "shop" && options.catalog) nextView = "workshop";
    const url = new URL(window.location.href);
    for (const key of ["view", "catalog", "configure", "equipment", "from", "fromSection", "fromFlower", "fromLot", "fromListing", "fromBusiness", "fromGame", "pole", "section", "business", "flower", "lot", "listing", "zone", "run", "campaign"]) url.searchParams.delete(key);
    if (nextView !== "hub") url.searchParams.set("view", nextView);
    if (nextView === "treasury" && options.treasuryPole) url.searchParams.set("pole", options.treasuryPole);
    if (nextView === "market" && options.marketSection) url.searchParams.set("section", options.marketSection);
    if (nextView === "market" && options.businessView) url.searchParams.set("business", options.businessView);
    if (nextView === "workshop" && options.warehouseSection) url.searchParams.set("section", options.warehouseSection);
    if (nextView === "workshop" && options.warehouseSection === "storage" && options.configureStorage) url.searchParams.set("configure", "storage");
    if (nextView === "shop" && options.shopSection === "buddies") url.searchParams.set("section", "buddies");
    if (nextView === "harvests" && options.harvestSection) url.searchParams.set("section", options.harvestSection);
    if (options.flowerId && (nextView === "arena" || nextView === "market" || nextView === "harvests" || nextView === "workshop")) url.searchParams.set("flower", options.flowerId);
    if (options.lotId && nextView === "market") url.searchParams.set("lot", options.lotId);
    if (options.listingId && nextView === "market") url.searchParams.set("listing", options.listingId);
    if (options.zoneId && (nextView === "game" || nextView === "workshop" || (nextView === "shop" && options.from === "game"))) url.searchParams.set("zone", options.zoneId);
    if (options.runId && (nextView === "game" || (nextView === "shop" && options.from === "game"))) url.searchParams.set("run", options.runId);
    if (options.campaign && (nextView === "game" || ((nextView === "workshop" || nextView === "shop") && options.from === "game"))) url.searchParams.set("campaign", "1");
    if (options.catalog && nextView === "workshop") url.searchParams.set("catalog", "equipment");
    if (options.equipmentCode) url.searchParams.set("equipment", options.equipmentCode);
    if (options.from && options.from !== nextView && ["shop", "workshop", "market", "arena", "harvests", "game"].includes(nextView)) {
      url.searchParams.set("from", options.from);
      const sourceSection = options.fromSection ?? options.fromMarketSection;
      if (sourceSection) url.searchParams.set("fromSection", sourceSection);
      if (options.fromFlowerId) url.searchParams.set("fromFlower", options.fromFlowerId);
      if (options.fromLotId) url.searchParams.set("fromLot", options.fromLotId);
      if (options.fromListingId) url.searchParams.set("fromListing", options.fromListingId);
      if (options.fromBusinessView) url.searchParams.set("fromBusiness", options.fromBusinessView);
      if ((nextView === "workshop" || nextView === "shop") && options.from === "game" && options.fromGame === "missions") url.searchParams.set("fromGame", "missions");
    }
    if (url.search === window.location.search) return;
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    setCollectionOpen(false);
    setProgressOpen(false);
    setPendingView(nextView);
    window.dispatchEvent(new Event("game:navigate"));
    window.history.pushState({ ...window.history.state }, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(LOCATION_EVENT));
    navigationTimerRef.current = window.setTimeout(() => {
      setPendingView(null);
      navigationTimerRef.current = null;
    }, NAVIGATION_FEEDBACK_MS);
    }));
  }, [setCollectionOpen, setProgressOpen, setPendingView]);

  const rememberPreparation = useCallback((next: KqPreparationSelection) => {
    setPreparation(current => current?.heritageCode === next.heritageCode && current.deckCodes.length === next.deckCodes.length
      && current.deckCodes.every((code, index) => code === next.deckCodes[index]) ? current : { deckCodes: [...next.deckCodes], heritageCode: next.heritageCode });
    writeKqPreparationDraft(kqPreparationStorage(), draftOwnerId, next);
  }, [draftOwnerId, setPreparation]);
  const consumePreparation = useCallback(() => {
    setPreparation(null);
    writeKqPreparationDraft(kqPreparationStorage(), draftOwnerId, null);
  }, [draftOwnerId, setPreparation]);
  const openWarehouseFromCulture = (zoneId?: string) => openView("workshop", {
    zoneId, ...(view === "game" && !requestedRunId && preparation ? { from: "game", campaign: requestedCampaign, fromGame: from === "missions" ? "missions" : undefined } : {}),
  });
  const openWarehouseCulture = useCallback((href: string) => {
    const target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin || target.searchParams.get("view") !== "game") return;
    openView("game", { zoneId: target.searchParams.get("zone") ?? undefined,
      runId: target.searchParams.get("run") ?? undefined, campaign: target.searchParams.get("campaign") === "1", from: from === "game" ? fromGame : undefined });
  }, [openView, from, fromGame]);

  const openEquipmentCatalog = useCallback((equipmentCode?: string, flowerId?: string) => {
    openView("workshop", {
      catalog: true, equipmentCode, flowerId: flowerId ?? requestedFlowerId ?? fromFlowerId,
      from: view === "workshop" ? isPlacardView(from) ? from : undefined : view,
      fromSection: view === "workshop" ? fromSection === "storage" ? "storage" : from === "market" ? shopReturnMarketSection : undefined
        : view === "market" ? marketSection : view === "harvests" && harvestSection === "storage" ? "storage" : undefined,
      fromFlowerId: view === "workshop" ? fromFlowerId : flowerId ?? requestedFlowerId,
      fromLotId: view === "workshop" ? fromLotId : requestedLotId,
      fromListingId: view === "workshop" ? fromListingId : requestedListingId,
      fromBusinessView: view === "workshop" ? fromBusinessView : view === "market" ? managementView : undefined,
      fromGame: view === "workshop" ? fromGame : undefined,
    });
  }, [openView, view, from, fromSection, shopReturnMarketSection, marketSection, harvestSection, fromFlowerId, fromLotId, fromListingId, fromBusinessView, requestedFlowerId, requestedLotId, requestedListingId, managementView, fromGame]);
  const openPacks = (section: CardSection = "botte") => {
    const fromCulture = view === "game" || (view === "shop" && shopReturnView === "game");
    openView("shop", { shopSection: section, from: view === "shop" ? shopReturnView : view,
      ...(fromCulture ? { zoneId: requestedZoneId, runId: requestedRunId, campaign: requestedCampaign,
        fromGame: view === "shop" ? fromGame : from === "missions" ? "missions" : undefined } : {}),
      fromSection: view === "shop" ? sourceSection(fromSection) : view === "market" ? marketSection
        : (view === "harvests" && harvestSection === "storage") || (view === "workshop" && warehouseSection === "storage") ? "storage" : undefined,
      fromFlowerId: view === "shop" ? fromFlowerId : requestedFlowerId, fromLotId: view === "shop" ? fromLotId : requestedLotId,
      fromListingId: view === "shop" ? fromListingId : requestedListingId, fromBusinessView: view === "shop" ? fromBusinessView : view === "market" ? managementView : undefined });
  };
  const openCollection = (section: CardSection = "botte") => { setCollectionSection(section); setCollectionOpen(true); };

  useEffect(() => () => {
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
  }, []);

  useEffect(() => {
    if (!legacyManagement) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", "market");
    url.searchParams.set("section", "management");
    url.searchParams.delete("pole");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  }, [legacyManagement]);

  useEffect(() => {
    if (!legacySocial) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", "social");
    url.searchParams.delete("section");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  }, [legacySocial]);

  useEffect(() => {
    if (!legacyEquipmentShop) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", "workshop");
    for (const key of ["section", "from", "fromSection"]) url.searchParams.delete(key);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  }, [legacyEquipmentShop]);

  useEffect(() => {
    const closeTransientUi = () => {
      setProgressOpen(false);
      setPendingView(null);
    };
    window.addEventListener("popstate", closeTransientUi);
    return () => window.removeEventListener("popstate", closeTransientUi);
  }, []);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  const navigationFeedback = pendingView ? (
    <div
      className={styles.navigationFeedback}
      role="status"
      aria-live="polite"
    >
      <span className={styles.statusSign}>
        <Hourglass className="animate-spin motion-reduce:animate-none" aria-hidden="true" size={16} strokeWidth={3} />
        Ouverture {pendingView === "treasury" && treasuryPole === "bank" ? "de la Banque" : PLACARD_VIEW_LABELS[pendingView]}…
      </span>
    </div>
  ) : null;

  const activeNav: PlacardNavKey = collectionOpen ? "collection" : view === "arena" ? "harvests" : view;
  const currentTitle =
    view === "hub" ? "Mon quartier" : view === "harvests" ? "Mes récoltes" : view === "workshop" ? (warehouseSection === "storage" ? "Entrepôt · Stockage" : "L’Entrepôt") : view === "shop" ? "Packs de cartes" : view === "game" ? "Ma culture" : view === "market" ? "Mon commerce" : view === "social" ? "Mes réseaux" : view === "treasury" ? "Mes finances" : view === "missions" ? "Mes missions" : "Jury & duels";

  const returnToCulture = (view === "workshop" || view === "shop") && from === "game";
  const returnToPreparation = returnToCulture && !requestedRunId && !!preparation;
  const contextualReturn = ["shop", "workshop", "market", "arena", "harvests", "game"].includes(view) && isPlacardView(from) && from !== view ? from : null;
  const returnView: PlacardView = returnToPreparation ? "game" : contextualReturn ?? (view === "game" ? "workshop" : view === "arena" ? "harvests"
      : view === "shop" ? shopReturnView : "hub");
  const returnLabel = returnToPreparation ? { label: "Préparation", accessibleLabel: "Revenir à ma préparation" } : PLACARD_RETURN_LABELS[returnView];
  const returnToParent = () => {
    if (view === "game" && !contextualReturn) openWarehouseFromCulture(requestedZoneId);
    else openView(returnView, returnToCulture ? { zoneId: requestedZoneId, runId: requestedRunId, campaign: requestedCampaign, from: fromGame }
      : returnView === "market" ? { marketSection: shopReturnMarketSection, businessView: fromBusinessView, flowerId: fromFlowerId, lotId: fromLotId, listingId: fromListingId }
        : returnView === "harvests" ? { flowerId: fromFlowerId ?? requestedFlowerId, harvestSection: fromSection === "storage" ? "storage" : undefined }
          : returnView === "workshop" ? { flowerId: fromFlowerId, warehouseSection: fromSection === "storage" ? "storage" : undefined }
            : returnView === "arena" ? { flowerId: fromFlowerId ?? requestedFlowerId } : {});
  };

  const navigate = (key: PlacardNavKey) => {
    if (key === "collection") openCollection();
    else if (key === "shop") openPacks();
    else openView(key);
  };

  const marketContext: PlacardNavigationOptions = {
    marketSection, businessView: managementView, flowerId: requestedFlowerId, lotId: requestedLotId, listingId: requestedListingId,
    from: isPlacardView(from) ? from : undefined, fromSection: sourceSection(fromSection),
    fromFlowerId, fromLotId, fromListingId, fromBusinessView,
  };

  useEffect(() => {
    if (view !== "hub" && !(requestedFlowerId && (view === "harvests" || (view === "workshop" && warehouseSection === "storage")))) headingRef.current?.focus({ preventScroll: true });
  }, [view, treasuryPole, harvestSection, requestedFlowerId, warehouseSection]);

  return (
    <div ref={surfaceRef} className={`${retro.gameSurface} ${styles.shell}`} data-placard-view={view}>
      <a className={styles.skipLink} href="#placard-content">Aller à l’activité</a>
      <KqPlacardNavigation active={activeNav} onNavigate={navigate} onHighlight={setHighlightedBuilding} />
      {collectionOpen ? <KqBotteCollection initialSection={collectionSection} onClose={() => setCollectionOpen(false)} onOpenShop={openPacks} /> : null}
      {navigationFeedback}
      <div className={styles.content} id="placard-content">
        {view === "hub" ? <header className={styles.exitHeader}><Link href="/arene"><ArrowLeft size={18} aria-hidden="true" /> Retour à l’Arène</Link><span>{currentTitle}</span></header> : <header className={styles.sectionHeader}>
          <button type="button" data-placard-back={returnView} aria-label={returnLabel.accessibleLabel} onClick={returnToParent}><ArrowLeft size={18} aria-hidden="true" />{returnLabel.label}</button>
          <KqPrintedArt kind={VIEW_ART[view]} className={printedArt.sectionMark} />
          <h1 ref={headingRef} tabIndex={-1}>{currentTitle}</h1>
          <button type="button" className={styles.soundButton} data-game-sound aria-label="Son du jeu" title={sound.enabled ? "Couper le son du jeu" : "Activer le son du jeu"} aria-pressed={sound.enabled} onClick={sound.toggle}>
            {sound.enabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}<span>Son {sound.enabled ? "activé" : "coupé"}</span>
          </button>
        </header>}
        {view === "hub" ? (
          <KqPlacardLobby onOpen={openView} onOpenCollection={() => openCollection()} highlightedBuilding={highlightedBuilding}>
            <KqPinnedMission onChoose={() => openView("missions")} onContinue={code => { const target = getKqMissionTarget(code); openView(target.view, target.options); }} />
          </KqPlacardLobby>
        ) : view === "harvests" ? (
          <KqHarvests section={harvestSection} draftOwnerId={draftOwnerId} initialFlowerId={requestedFlowerId} onOpenCulture={openWarehouseCulture} onSectionChange={(section, flowerId) => openView("harvests", { harvestSection: section === "storage" ? "storage" : undefined, flowerId,
            from: isPlacardView(from) ? from : undefined, fromSection: sourceSection(fromSection), fromFlowerId, fromLotId, fromListingId, fromBusinessView })}
            onOpenArena={flowerId => openView("arena", { flowerId, from: "harvests", fromSection: harvestSection === "storage" ? "storage" : undefined, fromFlowerId: flowerId })}
            onOpenMarket={(flowerId, marketSection = "sales") => openView("market", { flowerId, marketSection, from: "harvests", fromSection: harvestSection === "storage" ? "storage" : undefined, fromFlowerId: flowerId })}
            onOpenWarehouse={flowerId => openView("workshop", { warehouseSection: "storage", configureStorage: true, flowerId, from: "harvests", fromSection: "storage", fromFlowerId: flowerId })} onOpenGame={() => openView("game")} />
        ) : view === "shop" ? (
          <KqSupportBoosterShop
            autoOpen embedded autoClaimWelcome={!guidedVisit}
            initialSection={shopSection} onSectionChange={section => openPacks(section)} onOpenCollection={openCollection}
            onExit={returnToParent}
          />
        ) : view === "workshop" ? (
          <KqWarehouseEntry key={`${warehouseSection}:${requestedZoneId ?? ""}:${requestedFlowerId ?? ""}:${autoOpenEquipmentCatalog}:${autoOpenStorageEquipment}:${requestedEquipmentCode ?? ""}`} embedded draftOwnerId={draftOwnerId} initialZoneId={requestedZoneId} initialFlowerId={requestedFlowerId} initialShopOpen={autoOpenEquipmentCatalog} initialStorageEquipmentOpen={autoOpenStorageEquipment} initialEquipmentCode={requestedEquipmentCode} initialSection={warehouseSection} onClose={returnToParent} onOpenShop={openEquipmentCatalog} onOpenCulture={openWarehouseCulture}
            onOpenMarket={(flowerId, marketSection = "sales") => openView("market", { marketSection, flowerId, from: "workshop", fromFlowerId: flowerId, fromSection: warehouseSection === "storage" ? "storage" : undefined })}
            onOpenHarvests={flowerId => openView("harvests", { harvestSection: "storage", flowerId })} />
        ) : view === "missions" ? (
          <>
            <KqMissionCenter onOpen={(next, code) => { const target = code ? getKqMissionTarget(code) : { view: next }; openView(target.view, { ...target.options, from: "missions" }); }} />
            <details className={styles.progress} open={progressOpen} onToggle={event => setProgressOpen(event.currentTarget.open)}>
              <summary>Mes objectifs d’atelier <span>Investissements, filières et réputation</span></summary>
              {progressOpen ? <KqPlacardHud mode="progression" onOpenShop={openEquipmentCatalog} onOpenGame={() => openView("game")} onOpenStorage={() => openView("workshop", { warehouseSection: "storage" })} onOpenArena={() => openView("arena")} onOpenMarket={() => openView("market")} /> : null}
            </details>
          </>
        ) : view === "treasury" ? (
          <KqTreasuryDesk key={treasuryPole} initialPole={treasuryPole} onOpenShop={openEquipmentCatalog} onPoleChange={pole => openView("treasury", { treasuryPole: pole })} />
        ) : view === "market" ? (
          <KqMarketDesk section={marketSection} managementView={managementView} initialFlowerId={requestedFlowerId} initialLotId={requestedLotId} initialListingId={requestedListingId}
            onSectionChange={(next, listingId, businessView) => openView("market", { ...marketContext, marketSection: next,
              listingId: next === "dashboard" ? listingId : requestedListingId, businessView: businessView ?? managementView })}
            onManagementViewChange={businessView => openView("market", { ...marketContext, marketSection: "management", businessView })}
            onLotSelectionChange={(lotId, flowerId) => openView("market", { ...marketContext, marketSection: "sales", lotId, flowerId })}
            onOpenShop={openEquipmentCatalog} onOpenTreasury={() => openView("treasury", { treasuryPole: "accounting" })}
            onOpenStorage={(flowerId, lotId) => openView("harvests", { harvestSection: "storage", flowerId: flowerId ?? requestedFlowerId,
              from: "market", fromSection: marketSection, fromBusinessView: managementView,
              fromFlowerId: flowerId ?? requestedFlowerId, fromLotId: lotId ?? requestedLotId, fromListingId: requestedListingId })}
            onOpenCulture={() => openView("game")} />
        ) : view === "social" ? (
          <div className={styles.socialPage}><KqSocialNetworks /></div>
        ) : (
          <KanabQuestDicePrototype key={view} apiScope="player" viewMode={view === "arena" ? "arena" : "game"} showWarehouseNavigation={false} initialFlowerId={requestedFlowerId}
            initialZoneId={requestedZoneId} initialRunId={requestedRunId} initialCampaign={requestedCampaign}
            initialPreparation={view === "game" && !requestedRunId ? preparation ?? undefined : undefined}
            onPreparationChange={view === "game" && !requestedRunId ? rememberPreparation : undefined}
            onPreparationConsumed={view === "game" ? consumePreparation : undefined}
            onOpenBuddiePacks={() => openPacks("buddies")}
            onOpenRun={selection => openView("game", { ...selection, from: view === "game" ? contextualReturn ?? undefined : undefined })} onOpenWarehouse={openWarehouseFromCulture}
            onOpenStorage={flowerId => openView("workshop", { warehouseSection: "storage", flowerId, from: view, fromFlowerId: flowerId })}
            onOpenArena={() => openView("arena")} onOpenMarket={flowerId => openView("market", { flowerId, marketSection: flowerId ? "sales" : undefined, from: view === "arena" ? "arena" : "harvests", fromFlowerId: flowerId })} onOpenGame={() => openView("game", { zoneId: requestedZoneId, runId: requestedRunId, from: view === "game" ? contextualReturn ?? undefined : undefined })} />
        )}
      </div>
    </div>
  );
}
