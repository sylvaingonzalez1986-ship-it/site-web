"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, Hourglass } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import { navigateWithDraftGuard } from "@/lib/navigation-guard";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KqPlacardLobby } from "./KqPlacardLobby";
import { KqPlacardNavigation, type PlacardNavKey } from "./KqPlacardNavigation";
import { useGameViewport } from "@/hooks/useGameViewport";
import retro from "../contest/ArenaRetro.module.css";
import styles from "./PlacardPlayerShell.module.css";
import type { KqMarketSection } from "./KqMarketHub";

const NAVIGATION_FEEDBACK_MS = 420;

function PlacardViewLoading() {
  return (
    <div className="mx-auto grid min-h-[55vh] max-w-6xl place-items-center px-4 py-12" role="status">
      <span className="inline-flex items-center gap-3 border-2 border-ink bg-white px-5 py-4 font-black uppercase shadow-[4px_4px_0_#111]">
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

type PlacardView = "harvests" | "hub" | "shop" | "game" | "arena" | "market" | "treasury" | "missions" | "workshop";
type TreasuryPole = "accounting" | "bank";
type CardSection = "botte" | "buddies";
type PlacardNavigationOptions = { equipmentCode?: string; catalog?: boolean; shopSection?: CardSection; from?: PlacardView; fromMarketSection?: KqMarketSection; treasuryPole?: TreasuryPole; marketSection?: KqMarketSection; warehouseSection?: "storage"; harvestSection?: "storage"; flowerId?: string; zoneId?: string; runId?: string; campaign?: boolean };
const LOCATION_EVENT = "kq:placard-location";

function isPlacardView(value: string | null): value is PlacardView {
  return value === "harvests" || value === "hub" || value === "shop" || value === "game" || value === "arena" || value === "market" || value === "treasury" || value === "missions" || value === "workshop";
}

function isTreasuryPole(value: string | null): value is TreasuryPole {
  return value === "accounting" || value === "bank";
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
  shop: "de la Boutique",
  game: "de la Culture",
  arena: "du Jury et des duels",
  market: "du Marché",
  treasury: "du Bureau",
  missions: "des Missions",
};

const PLACARD_RETURN_LABELS: Record<PlacardView, { label: string; accessibleLabel: string }> = {
  hub: { label: "Quartier", accessibleLabel: "Retour au quartier" },
  workshop: { label: "Entrepôt", accessibleLabel: "Retour à l’entrepôt" },
  game: { label: "Culture", accessibleLabel: "Retour à la culture" },
  harvests: { label: "Récoltes", accessibleLabel: "Retour à mes récoltes" },
  arena: { label: "Jury & duels", accessibleLabel: "Retour au jury et aux duels" },
  market: { label: "Commerce", accessibleLabel: "Retour à mon commerce" },
  treasury: { label: "Finances", accessibleLabel: "Retour à mes finances" },
  missions: { label: "Missions", accessibleLabel: "Retour aux missions" },
  shop: { label: "Boutique", accessibleLabel: "Retour à la boutique" },
};

export function PlacardPlayerShell({ draftOwnerId }: { draftOwnerId?: string } = {}) {
  const location = useSyncExternalStore(subscribePlacardLocation, getPlacardLocation, () => "");
  const params = new URLSearchParams(location);
  const guidedVisit = params.get("guide") === "1";
  const requestedView = params.get("view");
  const requestedTreasuryPole = params.get("pole");
  const legacyManagement = requestedView === "treasury" && requestedTreasuryPole === "management";
  const legacyEquipmentShop = requestedView === "shop" && params.get("catalog") === "equipment";
  const view: PlacardView = legacyEquipmentShop ? "workshop" : legacyManagement ? "market" : isPlacardView(requestedView) ? requestedView : "hub";
  const treasuryPole: TreasuryPole = view === "treasury" && isTreasuryPole(requestedTreasuryPole) ? requestedTreasuryPole : "accounting";
  const marketSection: KqMarketSection = legacyManagement || params.get("section") === "management" ? "management"
    : params.get("section") === "dashboard" ? "dashboard" : params.get("section") === "demands" ? "demands"
      : params.get("section") === "sales" || params.get("flower") ? "sales" : "demands";
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionSection, setCollectionSection] = useState<CardSection>("botte");
  const [progressOpen, setProgressOpen] = useState(false);
  const [pendingView, setPendingView] = useState<PlacardView | null>(null);
  const navigationTimerRef = useRef<number | null>(null);
  const [highlightedBuilding, setHighlightedBuilding] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestedFlowerId = params.get("flower") ?? undefined;
  const requestedZoneId = params.get("zone") ?? undefined;
  const requestedRunId = params.get("run") ?? undefined;
  const requestedCampaign = params.get("campaign") === "1";
  const harvestSection = params.get("section") === "storage" ? "storage" : "overview";
  const requestedEquipmentCode = params.get("equipment");
  const warehouseSection = !legacyEquipmentShop && params.get("section") === "storage" ? "storage" : "equipment";
  const autoOpenEquipmentCatalog = view === "workshop" && params.get("catalog") === "equipment";
  const shopSection: CardSection = params.get("section") === "buddies" ? "buddies" : "botte";
  const from = params.get("from");
  const shopReturnView: PlacardView = isPlacardView(from) && from !== "shop" ? from : "hub";
  const shopReturnMarketSection: KqMarketSection = params.get("fromSection") === "management" ? "management"
    : params.get("fromSection") === "dashboard" ? "dashboard" : params.get("fromSection") === "sales" ? "sales" : "demands";

  const surfaceRef = useGameViewport<HTMLDivElement>(`${view}:${params.get("section") ?? ""}:${treasuryPole}`, { restoreOnBack: true });

  const openView = useCallback((nextView: PlacardView, options: PlacardNavigationOptions = {}) => {
    navigateWithDraftGuard(() => navigateAfterOverlays(() => {
    if (nextView === "shop" && options.catalog) nextView = "workshop";
    const url = new URL(window.location.href);
    for (const key of ["view", "catalog", "equipment", "from", "fromSection", "pole", "section", "flower", "zone", "run", "campaign"]) url.searchParams.delete(key);
    if (nextView !== "hub") url.searchParams.set("view", nextView);
    if (nextView === "treasury" && options.treasuryPole) url.searchParams.set("pole", options.treasuryPole);
    if (nextView === "market" && options.marketSection && options.marketSection !== "demands") url.searchParams.set("section", options.marketSection);
    if (nextView === "workshop" && options.warehouseSection) url.searchParams.set("section", options.warehouseSection);
    if (nextView === "shop" && options.shopSection === "buddies") url.searchParams.set("section", "buddies");
    if (nextView === "harvests" && options.harvestSection) url.searchParams.set("section", options.harvestSection);
    if (options.flowerId && (nextView === "arena" || nextView === "market")) url.searchParams.set("flower", options.flowerId);
    if (options.zoneId && (nextView === "game" || nextView === "workshop")) url.searchParams.set("zone", options.zoneId);
    if (options.runId && nextView === "game") url.searchParams.set("run", options.runId);
    if (options.campaign && nextView === "game") url.searchParams.set("campaign", "1");
    if (options.catalog && nextView === "workshop") url.searchParams.set("catalog", "equipment");
    if (options.equipmentCode) url.searchParams.set("equipment", options.equipmentCode);
    if (options.from && nextView === "shop") url.searchParams.set("from", options.from);
    if (nextView === "shop" && options.from === "market" && options.fromMarketSection && options.fromMarketSection !== "demands") url.searchParams.set("fromSection", options.fromMarketSection);
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

  const openEquipmentCatalog = useCallback((equipmentCode?: string) => {
    openView("workshop", { catalog: true, equipmentCode });
  }, [openView]);
  const openPacks = (section: CardSection = "botte") => {
    openView("shop", { shopSection: section, from: view === "shop" ? shopReturnView : view, fromMarketSection: view === "shop" ? shopReturnMarketSection : marketSection });
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
      className="pointer-events-none fixed left-1/2 top-20 z-[120] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 whitespace-nowrap border-2 border-ink bg-yellow px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0_#111]">
        <Hourglass className="animate-spin motion-reduce:animate-none" aria-hidden="true" size={16} strokeWidth={3} />
        Ouverture {pendingView === "treasury" && treasuryPole === "bank" ? "de la Banque" : PLACARD_VIEW_LABELS[pendingView]}…
      </span>
    </div>
  ) : null;

  const activeNav: PlacardNavKey = collectionOpen ? "collection" : view === "arena" || (view === "workshop" && warehouseSection === "storage") ? "harvests" : view;
  const currentTitle =
    view === "hub" ? "Mon quartier" : view === "harvests" ? "Mes récoltes" : view === "workshop" ? (warehouseSection === "storage" ? "Mes récoltes · Stockage" : "L’Entrepôt") : view === "shop" ? "Boutique" : view === "game" ? "Ma culture" : view === "market" ? "Mon commerce" : view === "treasury" ? "Mes finances" : view === "missions" ? "Mes missions" : "Mes récoltes · Jury & duels";

  const returnView: PlacardView = view === "game" ? "workshop"
    : view === "arena" || (view === "workshop" && warehouseSection === "storage") ? "harvests"
      : view === "shop" ? shopReturnView : "hub";
  const returnLabel = PLACARD_RETURN_LABELS[returnView];
  const returnToParent = () => openView(returnView, view === "game" ? { zoneId: requestedZoneId }
    : view === "shop" ? { marketSection: shopReturnMarketSection } : {});

  const navigate = (key: PlacardNavKey) => {
    if (key === "collection") openCollection();
    else if (key === "shop") openPacks();
    else openView(key);
  };

  useEffect(() => {
    if (view !== "hub") headingRef.current?.focus({ preventScroll: true });
  }, [view, treasuryPole, harvestSection]);

  return (
    <div ref={surfaceRef} className={`${retro.surface} ${styles.shell}`} data-placard-view={view}>
      <a className={styles.skipLink} href="#placard-content">Aller à l’activité</a>
      <KqPlacardNavigation active={activeNav} onNavigate={navigate} onHighlight={setHighlightedBuilding} />
      {collectionOpen ? <KqBotteCollection initialSection={collectionSection} onClose={() => setCollectionOpen(false)} onOpenShop={openPacks} /> : null}
      {navigationFeedback}
      <div className={styles.content} id="placard-content">
        {view === "hub" ? <header className={styles.exitHeader}><Link href="/arene"><ArrowLeft size={18} aria-hidden="true" /> Retour à l’Arène</Link><span>{currentTitle}</span></header> : <header className={styles.sectionHeader}>
          <button type="button" data-placard-back={returnView} aria-label={returnLabel.accessibleLabel} onClick={returnToParent}><ArrowLeft size={18} aria-hidden="true" />{returnLabel.label}</button>
          <h1 ref={headingRef} tabIndex={-1}>{currentTitle}</h1>
        </header>}
        {view === "hub" ? (
          <KqPlacardLobby onOpen={openView} onOpenCollection={() => openCollection()} highlightedBuilding={highlightedBuilding} />
        ) : view === "harvests" ? (
          <KqHarvests section={harvestSection} onSectionChange={section => openView("harvests", { harvestSection: section === "storage" ? "storage" : undefined })}
            onOpenArena={flowerId => openView("arena", { flowerId })} onOpenMarket={flowerId => openView("market", { flowerId })} onOpenGame={() => openView("game")} />
        ) : view === "shop" ? (
          <KqSupportBoosterShop
            autoOpen embedded autoClaimWelcome={!guidedVisit}
            initialSection={shopSection} onSectionChange={section => openPacks(section)} onOpenCollection={openCollection}
            onExit={() => openView(shopReturnView, { marketSection: shopReturnMarketSection })}
          />
        ) : view === "workshop" ? (
          <KqWarehouseEntry key={`${warehouseSection}:${requestedZoneId ?? ""}:${autoOpenEquipmentCatalog}:${requestedEquipmentCode ?? ""}`} embedded draftOwnerId={draftOwnerId} initialZoneId={requestedZoneId} initialShopOpen={autoOpenEquipmentCatalog} initialEquipmentCode={requestedEquipmentCode} initialSection={warehouseSection} onClose={() => openView("hub")} onOpenShop={openEquipmentCatalog} />
        ) : view === "missions" ? (
          <>
            <KqMissionCenter onOpen={next => openView(next, next === "shop" ? { from: "missions" } : {})} />
            <details className={styles.progress} open={progressOpen} onToggle={event => setProgressOpen(event.currentTarget.open)}>
              <summary>Mes objectifs d’atelier <span>Investissements, filières et réputation</span></summary>
              {progressOpen ? <KqPlacardHud mode="progression" onOpenShop={openEquipmentCatalog} onOpenGame={() => openView("game")} onOpenArena={() => openView("arena")} onOpenMarket={() => openView("market")} /> : null}
            </details>
          </>
        ) : view === "treasury" ? (
          <KqTreasuryDesk key={treasuryPole} initialPole={treasuryPole} onOpenShop={openEquipmentCatalog} onPoleChange={pole => openView("treasury", { treasuryPole: pole })} />
        ) : view === "market" ? (
          <KqMarketDesk section={marketSection} initialFlowerId={requestedFlowerId} onSectionChange={next => openView("market", { marketSection: next })} onOpenShop={openEquipmentCatalog} onOpenTreasury={() => openView("treasury", { treasuryPole: "accounting" })} onOpenStorage={() => openView("harvests", { harvestSection: "storage" })} onOpenCulture={() => openView("game")} />
        ) : (
          <>
            {view === "arena" ? <nav className={styles.localNav} aria-label="Parcours des récoltes"><button type="button" onClick={() => openView("harvests")}>Toutes mes récoltes</button><span aria-current="page">Jury & duels</span><button type="button" onClick={() => openView("harvests", { harvestSection: "storage" })}>Stockage & affinage</button></nav> : null}
            <KanabQuestDicePrototype apiScope="player" viewMode={view === "arena" ? "arena" : "game"} showWarehouseNavigation={false} initialFlowerId={requestedFlowerId}
              initialZoneId={requestedZoneId} initialRunId={requestedRunId} initialCampaign={requestedCampaign}
              onOpenRun={selection => openView("game", selection)} onOpenWarehouse={zoneId => openView("workshop", { zoneId })}
              onOpenArena={() => openView("arena")} onOpenMarket={() => openView("market")} onOpenGame={() => openView("game", { zoneId: requestedZoneId, runId: requestedRunId })} />
          </>
        )}
      </div>
    </div>
  );
}
