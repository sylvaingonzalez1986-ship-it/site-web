"use client";

import Image from "next/image";
import { ArenaSceneHeader } from "../contest/ArenaSceneHeader";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Banknote, Gamepad2, Hourglass, ShoppingBag, Swords } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { KqPlacardHud } from "./KqPlacardHud";
import retro from "../contest/ArenaRetro.module.css";

const NAVIGATION_FEEDBACK_MS = 420;
const SCROLL_SETTLE_MS = 120;

function resetPlacardScrollPosition() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

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

const HUB_DESTINATIONS = [
  {
    id: "shop" as const,
    number: "01",
    eyebrow: "Collection",
    title: "La Boutique",
    image: "/placard/booster-shop-front-v2.webp",
    imageClassName: "object-cover object-center",
    icon: ShoppingBag,
    accent: "bg-yellow",
  },
  {
    id: "game" as const,
    number: "02",
    eyebrow: "Culture",
    title: "Le Jeu",
    image: "/sylvain-culture-hero.webp",
    imageClassName: "object-contain object-center p-3 sm:p-5",
    icon: Gamepad2,
    accent: "bg-mint",
  },
  {
    id: "arena" as const,
    number: "03",
    eyebrow: "Compétition",
    title: "Fleur vs Fleur",
    image: "/contest/mascot/arena-duo.webp",
    imageClassName: "object-contain object-center p-3 sm:p-5",
    icon: Swords,
    accent: "bg-[#167d6b]",
  },
  {
    id: "market" as const,
    number: "04",
    eyebrow: "Après jury",
    title: "Le Marché",
    image: "/mascots/boutique-market.png",
    imageClassName: "object-contain object-center p-3 sm:p-5",
    icon: Banknote,
    accent: "bg-[#ef6f31]",
  },
];

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
  const scrollFrameRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const view: PlacardView = selectedView ?? (deepLink === "shop-equipment" ? "shop" : deepLink);
  const autoOpenEquipmentCatalog = equipmentCatalogRequested
    || (selectedView === null && deepLink === "shop-equipment");

  const resetScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    resetPlacardScrollPosition();
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      resetPlacardScrollPosition();
      scrollFrameRef.current = null;
      scrollTimerRef.current = window.setTimeout(() => {
        resetPlacardScrollPosition();
        scrollTimerRef.current = null;
      }, SCROLL_SETTLE_MS);
    });
  }, []);

  const openView = useCallback((nextView: PlacardView) => {
    resetScroll();
    if (nextView === view) return;
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    setPendingView(nextView);
    setSelectedView(nextView);
    navigationTimerRef.current = window.setTimeout(() => {
      setPendingView(null);
      navigationTimerRef.current = null;
    }, NAVIGATION_FEEDBACK_MS);
  }, [resetScroll, view]);

  const openEquipmentCatalog = useCallback((equipmentCode?: string) => {
    setShopReturnView(view === "shop" ? "hub" : view);
    setRequestedEquipmentCode(equipmentCode ?? null);
    setEquipmentCatalogRequested(true);
    openView("shop");
  }, [openView, view]);

  useEffect(() => () => {
    if (navigationTimerRef.current !== null) window.clearTimeout(navigationTimerRef.current);
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    resetScroll();
  }, [resetScroll, view]);

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
      <div className={`${retro.surface} ${retro.shell}`} data-placard-view={view}>
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
    <div className={`${retro.surface} ${retro.shell}`} data-placard-view={view}>
      {navigationFeedback}
      <ArenaSceneHeader mode="jouer" />

      <main className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
        <KqPlacardHud
          onOpenShop={openEquipmentCatalog}
          onOpenGame={() => openView("game")}
          onOpenArena={() => openView("arena")}
          onOpenMarket={() => openView("market")}
        />
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl uppercase leading-none sm:text-4xl">
              Sélection du mode
            </h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {HUB_DESTINATIONS.map((destination) => {
            const Icon = destination.icon;
            return (
              <button
                key={destination.id}
                type="button"
                onClick={() => openView(destination.id)}
                aria-busy={pendingView === destination.id || undefined}
                className={`${retro.destination} group grid grid-cols-[118px_1fr] overflow-hidden border-2 bg-white text-left transition duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#167d6b] sm:grid-cols-[160px_1fr] md:block`}
                aria-label={`Ouvrir ${destination.title}`}
              >
                <span className={`relative block min-h-36 overflow-hidden border-r-2 border-ink md:aspect-[16/10] md:min-h-0 md:border-b-2 md:border-r-0 ${destination.accent}`}>
                  <Image
                    src={destination.image}
                    alt=""
                    fill
                    loading={destination.id === "shop" ? "eager" : "lazy"}
                    sizes="(max-width: 767px) 100vw, 33vw"
                    className={`${destination.imageClassName} transition duration-300 group-hover:scale-[1.04]`}
                  />
                  <span className="absolute left-2 top-2 grid h-9 w-9 place-items-center border-2 border-ink bg-white shadow-[2px_2px_0_#111] md:left-3 md:top-3 md:h-11 md:w-11 md:shadow-[3px_3px_0_#111]">
                    <Icon aria-hidden="true" size={20} strokeWidth={2.7} />
                  </span>
                  <span className="absolute bottom-2 left-2 border-2 border-ink bg-ink px-2 py-1 text-[10px] font-black text-white md:bottom-auto md:left-auto md:right-3 md:top-3 md:text-xs">
                    {destination.number}
                  </span>
                </span>

                <span className="flex min-h-36 flex-col p-3 sm:p-4 md:min-h-40 md:p-5">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[#167d6b]">
                    {destination.eyebrow}
                  </span>
                  <span className="mt-1 font-display text-2xl uppercase leading-none md:text-3xl">
                    {destination.title}
                  </span>
                  <span className="mt-auto pt-2 text-xs font-black uppercase md:pt-4 md:text-sm">
                    Ouvrir <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
