"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Hourglass } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KqPlacardLobby } from "./KqPlacardLobby";
import { useGameViewport } from "@/hooks/useGameViewport";
import retro from "../contest/ArenaRetro.module.css";

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

type PlacardView = "hub" | "shop" | "game" | "arena" | "market";
type PlacardDeepLink = PlacardView | "shop-equipment";

function isPlacardView(value: string | null): value is PlacardView {
  return value === "hub" || value === "shop" || value === "game" || value === "arena" || value === "market";
}

function getPlacardDeepLink(): PlacardDeepLink {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  if (!isPlacardView(requestedView)) return "hub";
  return requestedView === "shop" && params.get("catalog") === "equipment"
    ? "shop-equipment"
    : requestedView;
}

function subscribePlacardLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

const PLACARD_VIEW_LABELS: Record<PlacardView, string> = {
  hub: "du Placard",
  shop: "de la Boutique",
  game: "du Jeu",
  arena: "de Fleur vs Fleur",
  market: "du Comptoir des lots",
};

export function PlacardPlayerShell() {
  const deepLink = useSyncExternalStore<PlacardDeepLink>(
    subscribePlacardLocation,
    getPlacardDeepLink,
    () => "hub",
  );
  const [selectedView, setSelectedView] = useState<PlacardView | null>(null);
  const [pendingView, setPendingView] = useState<PlacardView | null>(null);
  const [equipmentCatalogRequested, setEquipmentCatalogRequested] = useState(false);
  const [requestedEquipmentCode, setRequestedEquipmentCode] = useState<string | null>(null);
  const [shopReturnView, setShopReturnView] = useState<PlacardView>("hub");
  const navigationTimerRef = useRef<number | null>(null);
  const view: PlacardView = selectedView ?? (deepLink === "shop-equipment" ? "shop" : deepLink);
  const autoOpenEquipmentCatalog = equipmentCatalogRequested
    || (selectedView === null && deepLink === "shop-equipment");

  const surfaceRef = useGameViewport<HTMLDivElement>(view);

  const openView = useCallback((nextView: PlacardView) => {
    if (nextView === view) return;
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    setPendingView(nextView);
    setSelectedView(nextView);
    navigationTimerRef.current = window.setTimeout(() => {
      setPendingView(null);
      navigationTimerRef.current = null;
    }, NAVIGATION_FEEDBACK_MS);
  }, [view]);

  const openEquipmentCatalog = useCallback((equipmentCode?: string) => {
    setShopReturnView(view === "shop" ? "hub" : view);
    setRequestedEquipmentCode(equipmentCode ?? null);
    setEquipmentCatalogRequested(true);
    openView("shop");
  }, [openView, view]);

  useEffect(() => () => {
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
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
      view === "shop" ? "La Boutique" : view === "game" ? "Le Jeu" : view === "market" ? "Le Marché" : "Fleur vs Fleur";

    return (
      <div ref={surfaceRef} className={`${retro.surface} ${retro.shell}`} data-placard-view={view}>
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
            <p className="truncate font-display text-xl uppercase sm:text-2xl">{currentTitle}</p>
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
            autoOpen
            autoOpenEquipment={autoOpenEquipmentCatalog}
            initialEquipmentCode={requestedEquipmentCode}
            onExit={() => {
              setEquipmentCatalogRequested(false);
              setRequestedEquipmentCode(null);
              openView(shopReturnView);
            }}
          />
        ) : view === "market" ? (
          <KqMarketDesk onOpenShop={openEquipmentCatalog} />
        ) : (
          <KanabQuestDicePrototype
            apiScope="player"
            viewMode={view === "arena" ? "arena" : "game"}
            onOpenArena={() => openView("arena")}
            onOpenMarket={() => openView("market")}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={surfaceRef} className={`${retro.surface} ${retro.shell}`} data-placard-view={view}>
      {navigationFeedback}
      <KqPlacardLobby onOpen={openView} onOpenEquipment={openEquipmentCatalog} />
    </div>
  );
}
