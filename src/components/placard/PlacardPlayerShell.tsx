"use client";

import dynamic from "next/dynamic";
import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft, BookOpen, Hourglass } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KqPlacardLobby } from "./KqPlacardLobby";
import { useGameViewport } from "@/hooks/useGameViewport";
import retro from "../contest/ArenaRetro.module.css";
import styles from "./PlacardPlayerShell.module.css";

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

type PlacardView = "hub" | "shop" | "game" | "arena" | "market" | "treasury" | "missions" | "workshop";
type PlacardNavigationOptions = { equipmentCode?: string; catalog?: boolean; from?: PlacardView };
const LOCATION_EVENT = "kq:placard-location";

function isPlacardView(value: string | null): value is PlacardView {
  return value === "hub" || value === "shop" || value === "game" || value === "arena" || value === "market" || value === "treasury" || value === "missions" || value === "workshop";
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
  workshop: "de l’Entrepôt",
  hub: "du Placard",
  shop: "de la Boutique",
  game: "de la Culture",
  arena: "du Jury et des duels",
  market: "du Marché",
  treasury: "du Bureau",
  missions: "des Missions",
};

export function PlacardPlayerShell() {
  const location = useSyncExternalStore(subscribePlacardLocation, getPlacardLocation, () => "");
  const params = new URLSearchParams(location);
  const guidedVisit = params.get("guide") === "1";
  const requestedView = params.get("view");
  const view: PlacardView = isPlacardView(requestedView) ? requestedView : "hub";
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [pendingView, setPendingView] = useState<PlacardView | null>(null);
  const navigationTimerRef = useRef<number | null>(null);
  const requestedEquipmentCode = params.get("equipment");
  const autoOpenEquipmentCatalog = view === "shop" && params.get("catalog") === "equipment";
  const from = params.get("from");
  const shopReturnView: PlacardView = isPlacardView(from) && from !== "shop" ? from : "hub";

  const surfaceRef = useGameViewport<HTMLDivElement>(view);

  const openView = useCallback((nextView: PlacardView, options: PlacardNavigationOptions = {}) => {
    const url = new URL(window.location.href);
    for (const key of ["view", "catalog", "equipment", "from"]) url.searchParams.delete(key);
    if (nextView !== "hub") url.searchParams.set("view", nextView);
    if (options.catalog && nextView === "shop") url.searchParams.set("catalog", "equipment");
    if (options.equipmentCode) url.searchParams.set("equipment", options.equipmentCode);
    if (options.from) url.searchParams.set("from", options.from);
    if (url.search === window.location.search) return;
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    setCollectionOpen(false);
    setProgressOpen(false);
    setPendingView(nextView);
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(LOCATION_EVENT));
    navigationTimerRef.current = window.setTimeout(() => {
      setPendingView(null);
      navigationTimerRef.current = null;
    }, NAVIGATION_FEEDBACK_MS);
  }, [setCollectionOpen, setProgressOpen, setPendingView]);

  const openEquipmentCatalog = useCallback((equipmentCode?: string) => {
    openView("shop", { catalog: true, equipmentCode, from: view === "shop" ? shopReturnView : view });
  }, [openView, view, shopReturnView]);
  const openWorkshop = useCallback((equipmentCode?: string) => openView("workshop", { equipmentCode }), [openView]);
  const openPacks = () => {
    setCollectionOpen(false);
    openView("shop", { from: view === "shop" ? shopReturnView : view });
  };

  useEffect(() => () => {
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
  }, []);

  useEffect(() => {
    const closeTransientUi = () => {
      setCollectionOpen(false);
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
        Ouverture {PLACARD_VIEW_LABELS[pendingView]}…
      </span>
    </div>
  ) : null;

  if (view !== "hub") {
    const currentTitle =
      view === "workshop" ? "L’Entrepôt · Aménager" : view === "shop" ? "La Boutique · Botte du Chanvrier" : view === "game" ? "La Culture" : view === "market" ? "Le Marché · Vendre" : view === "treasury" ? "Le Bureau" : view === "missions" ? "Les Missions" : "Jury & duels";

    return (
      <div ref={surfaceRef} className={`${retro.surface} ${retro.shell}`} data-placard-view={view}>
        {collectionOpen ? <KqBotteCollection onClose={() => setCollectionOpen(false)} onOpenShop={openPacks} /> : null}
        {navigationFeedback}
        <nav className={`${retro.shellNav} sticky top-0 z-[80] border-b-2 border-ink bg-cream/95 px-3 py-3 backdrop-blur sm:px-5`} aria-label="Navigation du Placard">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => openView("hub")}
              className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center gap-2 border-2 border-ink bg-white px-3 font-black uppercase shadow-[3px_3px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111]"
            >
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Retour au Placard</span>
              <span className="sm:hidden">Placard</span>
            </button>
            <p className="hidden min-w-0 flex-1 truncate text-center text-sm font-bold uppercase tracking-wide md:block">{currentTitle}</p>
            <button type="button" onClick={() => setCollectionOpen(true)} aria-haspopup="dialog" aria-label="Ouvrir ma collection Botte du Chanvrier" className="inline-flex min-h-11 shrink-0 items-center gap-2 border-2 border-ink bg-yellow px-3 text-xs font-black text-ink shadow-[3px_3px_0_#111]"><BookOpen size={18} aria-hidden="true" /><span>Collection</span></button>
            <Link
              href="/arene"
              className="hidden min-h-11 items-center border-2 border-ink bg-white px-3 font-black uppercase shadow-[3px_3px_0_#111] transition hover:-translate-y-0.5 sm:inline-flex"
            >
              L’Arène
            </Link>
          </div>
        </nav>

        {view === "shop" ? (
          <KqSupportBoosterShop
            key={`${autoOpenEquipmentCatalog ? "equipment" : "packs"}:${requestedEquipmentCode ?? ""}`}
            autoOpen
            autoClaimWelcome={!guidedVisit}
            onOpenWorkshop={openWorkshop}
            onOpenCollection={() => setCollectionOpen(true)}
            autoOpenEquipment={autoOpenEquipmentCatalog}
            initialEquipmentCode={requestedEquipmentCode}
            onExit={() => openView(shopReturnView)}
          />
        ) : view === "workshop" ? (
          <KqWarehouseEntry initialEquipmentCode={requestedEquipmentCode} onClose={()=>openView("hub")} onOpenShop={openEquipmentCatalog}/>
        ) : view === "missions" ? (
          <>
            <KqMissionCenter onOpen={(next) => openView(next, next === "shop" ? { from: "missions" } : {})} />
            <details className={styles.progress} open={progressOpen} onToggle={event => setProgressOpen(event.currentTarget.open)}>
              <summary>Mes objectifs d’atelier <span>Investissements, filières et réputation</span></summary>
              {progressOpen ? <KqPlacardHud mode="progression" onOpenShop={openEquipmentCatalog} onOpenGame={() => openView("game")} onOpenArena={() => openView("arena")} onOpenMarket={() => openView("market")} /> : null}
            </details>
          </>
        ) : view === "treasury" ? (
          <KqTreasuryDesk onOpenShop={openEquipmentCatalog} onOpenMarket={() => openView("market")} />
        ) : view === "market" ? (
          <KqMarketDesk onOpenShop={openEquipmentCatalog} onOpenTreasury={() => openView("treasury")} />
        ) : (
          <KanabQuestDicePrototype
            apiScope="player"
            viewMode={view === "arena" ? "arena" : "game"}
            onOpenArena={() => openView("arena")}
            onOpenMarket={() => openView("market")}
            onOpenGame={() => openView("game")}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={surfaceRef} className={`${retro.surface} ${retro.shell}`} data-placard-view={view}>
      {collectionOpen ? <KqBotteCollection onClose={() => setCollectionOpen(false)} onOpenShop={openPacks} /> : null}
      {navigationFeedback}
      <KqPlacardLobby onOpen={openView} onOpenCollection={() => setCollectionOpen(true)} />
    </div>
  );
}
