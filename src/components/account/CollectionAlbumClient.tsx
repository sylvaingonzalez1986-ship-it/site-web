"use client";

import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft, ArrowUpRight, ChevronRight, Gift, Recycle, Sparkles, Ticket } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCart } from "@/context/CartContext";
import { PackOpeningFlowModal } from "@/components/account/PackOpeningFlowModal";
import { PioneerPackReward } from "@/components/account/PioneerPackReward";
import { BotteAlbumCollection } from "@/components/account/BotteAlbumCollection";
import { QuantitySelector } from "@/components/QuantitySelector";
import { AlbumPage } from "@/components/lottery/AlbumPage";
import { AlbumPager } from "@/components/lottery/AlbumPager";
import { AlbumShell } from "@/components/lottery/AlbumShell";
import { CardDetailModal } from "@/components/lottery/CardDetailModal";
import { DuplicateBurnDrawer } from "@/components/lottery/DuplicateBurnDrawer";
import { PageRewardDrawer } from "@/components/lottery/PageRewardDrawer";
import { useLotteryExperience } from "@/hooks/useLotteryExperience";
import { AppDialog } from "@/components/ui/AppDialog";
import {
  LOTTERY_DUPLICATE_BURN_RULES,
  LOTTERY_POINTS_PACK_COST,
  LOTTERY_POINTS_PACK_MAX_PER_PURCHASE,
} from "@/lib/lottery-collection";
import type {
  LotteryCollectionCardSlot,
  LotteryDuplicateBurnChoice,
  LotteryCollectionPageRarity,
  LotteryCollectionPageState,
  LotteryDuplicateGroup,
  LotteryTicket,
} from "@/types/lottery";
import albumStyles from "@/components/lottery/AlbumExperience.module.css";
import { AlbumArenaLobby, ALBUM_DESTINATIONS, type AlbumDestination } from "@/components/lottery/AlbumArenaLobby";
import arenaStyles from "@/components/lottery/AlbumArena.module.css";
import lobbyStyles from "@/components/contest/ArenaLobby.module.css";

export function CollectionAlbumClient() {
  return <CollectionAlbumContent embedded={false} />;
}

type CollectionAlbumContentProps = {
  embedded?: boolean;
};

type BurnableAlbumGroup = {
  page: LotteryCollectionPageState;
  group: LotteryDuplicateGroup;
};

type AlbumUrlState = {
  screen: "lobby" | AlbumDestination;
  collection: "buddies" | "placard";
  page: string;
};
type AlbumScroll = { x: number; y: number; focus: boolean };
const ALBUM_URL_EVENT = "album:navigation";
const ALBUM_SCROLL_KEY = "lcbAlbumScroll";
const readAlbumUrl = () => window.location.search;
const serverAlbumUrl = () => "";

function readAlbumState(search: string): AlbumUrlState {
  const params = new URLSearchParams(search);
  const requestedScreen = params.get("albumScreen");
  return {
    screen: ALBUM_DESTINATIONS.some(({ id }) => id === requestedScreen) ? requestedScreen as AlbumDestination : "lobby",
    collection: params.get("albumCollection") === "placard" ? "placard" : "buddies",
    page: params.get("albumPage") ?? "",
  };
}

function readAlbumScroll(): AlbumScroll {
  const saved = window.history.state?.[ALBUM_SCROLL_KEY];
  return {
    x: Number.isFinite(saved?.x) ? Math.max(0, saved.x) : 0,
    y: Number.isFinite(saved?.y) ? Math.max(0, saved.y) : 0,
    focus: false,
  };
}

function DuplicateManagerModal({
  items,
  onSelect,
  onClose,
}: {
  items: BurnableAlbumGroup[];
  onSelect: (item: BurnableAlbumGroup) => void;
  onClose: () => void;
}) {
  return (
    <AppDialog open onClose={onClose} title="Mes doublons" labelledBy="duplicate-manager-title" className={albumStyles.dialogShell}>
        <div className="p-5 sm:p-6">
          <p className={albumStyles.kicker}>Recyclage des doublons</p>
          <h2 id="duplicate-manager-title" className="pr-12 font-display text-3xl uppercase leading-none text-ink">
            Choisis une carte.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-charcoal">
            Chaque ligne peut être recyclée contre une réduction ou des grammes offerts.
          </p>
          <div className={albumStyles.managerList}>
            {items.map((item) => (
              <button data-ui-account="manager-item" data-ui-shape="control"
                key={`${item.page.rarity}-${item.group.cardDefinitionId}`}
                type="button"
                className={albumStyles.managerItem}
                onClick={() => onSelect(item)}
              >
                <span>
                  <strong className="block text-sm text-ink">{item.group.name}</strong>
                  <small className="mt-1 block text-xs text-charcoal">Page {item.page.label}</small>
                </span>
                <strong>x{item.group.duplicateCount}</strong>
              </button>
            ))}
          </div>
        </div>
    </AppDialog>
  );
}

export function CollectionAlbumContent({ embedded = false }: CollectionAlbumContentProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<AlbumScroll | null>(null);
  const subscribeToAlbumUrl = useCallback((notify: () => void) => {
    let previousSearch = window.location.search;
    const onChange = () => {
      previousSearch = window.location.search;
      notify();
    };
    const onBack = () => {
      // Closing a dialog adds no album navigation and must keep its scroll position.
      if (window.location.search !== previousSearch) pendingScroll.current = readAlbumScroll();
      onChange();
    };
    window.addEventListener("popstate", onBack);
    window.addEventListener(ALBUM_URL_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onBack);
      window.removeEventListener(ALBUM_URL_EVENT, onChange);
    };
  }, []);
  const search = useSyncExternalStore(subscribeToAlbumUrl, readAlbumUrl, serverAlbumUrl);
  const { screen, collection, page: requestedPage } = readAlbumState(search);
  const { isAuthenticated, authLoading } = useCart();
  const {
    album,
    tickets,
    config,
    loyalty,
    loading,
    error,
    acting,
    refreshAll,
    purchasePacksWithPoints,
    openPack,
    claimPageReward,
    burnDuplicates,
  } = useLotteryExperience();

  const activePageIndex = Math.max(0, album?.pages.findIndex((page) => page.rarity === requestedPage) ?? 0);
  const navigateAlbum = (change: Partial<AlbumUrlState>, replace = false) => {
    const next = { screen, collection, page: album?.pages[activePageIndex]?.rarity ?? "", ...change };
    const url = new URL(window.location.href);
    for (const [key, value, fallback] of [
      ["albumScreen", next.screen, "lobby"],
      ["albumCollection", next.collection, "buddies"],
      ["albumPage", next.page, ""],
    ]) {
      if (value === fallback) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    if (url.href === window.location.href) return;
    const currentScroll = { x: window.scrollX, y: window.scrollY };
    const screenChanged = next.screen !== screen;
    const nextScroll = {
      x: currentScroll.x,
      y: screenChanged ? (embedded ? Math.max(0, (screenRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 96) : 0) : currentScroll.y,
      focus: screenChanged,
    };
    // Native history integrates with Next. Keep the profile tab, hash and router state.
    window.history.replaceState({ ...window.history.state, [ALBUM_SCROLL_KEY]: currentScroll }, "");
    window.history[replace ? "replaceState" : "pushState"](
      { ...window.history.state, [ALBUM_SCROLL_KEY]: nextScroll }, "", url.pathname + url.search + url.hash,
    );
    pendingScroll.current = nextScroll;
    window.dispatchEvent(new Event(ALBUM_URL_EVENT));
  };
  const setScreen = (value: "lobby" | AlbumDestination) => navigateAlbum({ screen: value });
  const setCollection = (value: "buddies" | "placard") => navigateAlbum({ collection: value });
  const setActivePageIndex = (index: number, replace = false) => {
    const page = album?.pages[Math.max(0, Math.min(index, album.pages.length - 1))];
    if (page) navigateAlbum({ page: page.rarity }, replace);
  };
  useEffect(() => {
    if (!album || !pendingScroll.current) return;
    const position = pendingScroll.current;
    pendingScroll.current = null;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ left: position.x, top: position.y, behavior: "instant" });
      if (position.focus) screenRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [search, album]);
  const [selectedSlot, setSelectedSlot] = useState<LotteryCollectionCardSlot | null>(null);
  const [rewardDrawerPage, setRewardDrawerPage] = useState<LotteryCollectionPageState | null>(null);
  const [burnDrawerGroup, setBurnDrawerGroup] = useState<{
    page: LotteryCollectionPageState;
    group: LotteryDuplicateGroup;
  } | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [packPurchaseQty, setPackPurchaseQty] = useState(1);
  const [isDuplicateManagerOpen, setIsDuplicateManagerOpen] = useState(false);

  /* — Welcome pack one-shot CTA — */
  const [welcomeEligible, setWelcomeEligible] = useState(false);
  const [welcomeClaiming, setWelcomeClaiming] = useState(false);
  const [welcomeJustClaimed, setWelcomeJustClaimed] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;
    fetch("/api/account/welcome-pack")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.eligible) {
          setWelcomeEligible(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const handleClaimWelcomePack = useCallback(async () => {
    if (welcomeClaiming || !welcomeEligible) return;
    setWelcomeClaiming(true);
    try {
      const res = await fetch("/api/account/welcome-pack", { method: "POST" });
      const data = await res.json();
      if (data?.granted) {
        setWelcomeJustClaimed(true);
        setWelcomeEligible(false);
        window.dispatchEvent(new Event("welcome-pack-claimed"));
        refreshAll();
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setWelcomeClaiming(false);
    }
  }, [welcomeClaiming, welcomeEligible, refreshAll]);

  const availableTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === "available"),
    [tickets],
  );

  const activeTicket = useMemo<LotteryTicket | null>(() => {
    if (!selectedTicketId) {
      return null;
    }

    // Keep the opening flow alive while the selected pack transitions from
    // available to scratched, otherwise the reveal step unmounts immediately.
    return tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  }, [tickets, selectedTicketId]);

  const maxPurchasablePacks = useMemo(
    () =>
      Math.min(
        LOTTERY_POINTS_PACK_MAX_PER_PURCHASE,
        Math.floor(loyalty.spendablePoints / LOTTERY_POINTS_PACK_COST),
      ),
    [loyalty.spendablePoints],
  );

  const effectivePackPurchaseQty =
    maxPurchasablePacks < 1 ? 1 : Math.min(packPurchaseQty, maxPurchasablePacks);

  const isAlbumPreview = !authLoading && !isAuthenticated;

  const previewOverlay = isAlbumPreview ? (
    <div className="absolute inset-0 z-10">
      <div className="absolute inset-0 bg-[#f6efe2]/45 backdrop-blur-[1.5px]" />
      <div className="relative flex justify-center px-4 pt-28 md:px-6 md:pt-32">
        <div data-ui-account="paper" data-ui-shape="panel" className={`${albumStyles.modalShell} p-6 text-center`}>
          <p className="font-display text-2xl leading-tight text-ink">Crée ton compte pour commencer ta collection</p>
          <p className="mt-3 text-sm text-charcoal">
            Ouvre tes boosters, collectionne tes cartes et suis ta progression dans ton album.
          </p>
          <Link data-ui-account="green" data-ui-shape="control"
            href="/compte/inscription?next=/profil/collection"
            className={`${albumStyles.primaryButton} mt-5`}
          >
            Créer mon compte
          </Link>
          <Link data-ui-account="gold" data-ui-shape="control"
            href="/compte/connexion?next=/profil/collection"
            className={`${albumStyles.secondaryButton} mt-3`}
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  ) : null;

  if (loading && !album) {
    if (embedded) {
      return (
        <div className={albumStyles.experience}>
          <div data-ui-account="paper" data-ui-shape="panel" className={albumStyles.statusCard}>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-forest border-t-transparent" />
            <p className="mt-3 font-display text-ink">Chargement de ta collection...</p>
          </div>
        </div>
      );
    }

    return (
      <section className={albumStyles.pageShell}>
        <div className={albumStyles.pageInner}>
          <div data-ui-account="paper" data-ui-shape="panel" className={albumStyles.statusCard}>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-forest border-t-transparent" />
            <p className="mt-3 font-display text-ink">Chargement de ta collection...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error && !album) {
    if (embedded) {
      return (
        <div className={albumStyles.experience}>
          <div data-ui-account="paper" data-ui-shape="panel" className={albumStyles.statusCard}>
            <p className="font-display text-lg text-red-600">{error}</p>
            <button data-ui-account="green" data-ui-shape="control" className={`${albumStyles.primaryButton} mt-4`} onClick={() => refreshAll()}>
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    return (
      <section className={albumStyles.pageShell}>
        <div className={albumStyles.pageInner}>
          <div data-ui-account="paper" data-ui-shape="panel" className={albumStyles.statusCard}>
            <p className="font-display text-lg text-red-600">{error}</p>
            <button data-ui-account="green" data-ui-shape="control"
              className={`${albumStyles.primaryButton} mt-4`}
              onClick={() => refreshAll()}
            >
              Réessayer
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!album) {
    return null;
  }

  const activePage = album.pages[activePageIndex] ?? album.pages[0];
  if (!activePage) {
    return null;
  }

  const claimablePages = album.pages.filter((page) => page.rewardStatus === "claimable");
  const allBurnableGroups: BurnableAlbumGroup[] = album.pages.flatMap((page) => {
    if (!page.burnOffer) return [];
    return page.duplicateGroups
      .filter((group) => group.burnableInstanceIds.length >= page.burnOffer!.duplicatesRequired)
      .map((group) => ({ page, group }));
  });

  const handleClaimReward = async (pageRarity: LotteryCollectionPageRarity, rewardDefinitionId: string) => {
    await claimPageReward(pageRarity, rewardDefinitionId);
    setRewardDrawerPage(null);
  };

  const handleBurnDuplicates = async (group: LotteryDuplicateGroup, rewardChoice: LotteryDuplicateBurnChoice) => {
    const ids = group.burnableInstanceIds.slice(0, LOTTERY_DUPLICATE_BURN_RULES[group.rarity].duplicatesRequired);
    await burnDuplicates(group.rarity, ids, rewardChoice);
    setBurnDrawerGroup(null);
  };

  const handlePurchasePacks = async () => {
    if (maxPurchasablePacks < 1) {
      return;
    }

    await purchasePacksWithPoints(effectivePackPurchaseQty);
  };

  const welcome = (welcomeEligible || welcomeJustClaimed) ? <div className={arenaStyles.welcome}>
    <p>Ton pack de bienvenue offert contient 3 Buddies communs différents pour commencer à cultiver.</p>
    {welcomeJustClaimed ? <span role="status">Ton booster gratuit est prêt à être ouvert.</span> :
      <button data-ui-account="dark" data-ui-shape="control" type="button" disabled={welcomeClaiming} onClick={handleClaimWelcomePack}>
        {welcomeClaiming ? "Attribution en cours…" : "Récupérer mon booster gratuit"}
      </button>}
  </div> : null;
  const openAvailablePack = () => availableTickets[0] && setSelectedTicketId(availableTickets[0].id);
  const screenTitle = screen === "cards" ? "Mes cartes." : screen === "boosters" ? "Mes boosters." : "Mes récompenses.";

  const buddiesAlbumBody = (
    <div ref={screenRef} tabIndex={-1} className={arenaStyles.root} data-album-screen={screen} inert={isAlbumPreview}>
      {screen === "lobby" ? <AlbumArenaLobby
        packs={availableTickets.length} owned={album.summary.ownedUnique} total={album.summary.totalCards}
        rewards={claimablePages.length} points={loyalty.spendablePoints}
        onNavigate={setScreen} onOpenPack={openAvailablePack} welcome={welcome}
      /> : <div className={arenaStyles.workspace}>
        <header className={`${lobbyStyles.topBar} ${arenaStyles.workspaceTop}`}>
          <div className={lobbyStyles.brand}><span>Kanab Quest · Mon album</span><h1>{screenTitle}</h1></div>
          <button data-album-return type="button" className={arenaStyles.returnLink} onClick={() => setScreen("lobby")}><ArrowLeft aria-hidden="true" /><span>Retour à l’album</span></button>
        </header>
        <nav className={`${lobbyStyles.modeSelector} ${arenaStyles.workspaceNav}`} aria-label="Espaces de l’album">
          {ALBUM_DESTINATIONS.map(({ id, label, icon: Icon }) => <button data-ui-account="album-mode" data-ui-shape="control" key={id} type="button" aria-pressed={screen === id} onClick={() => setScreen(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
        </nav>
        <div className={arenaStyles.workspaceBody}>
          {screen === "cards" && <nav className={arenaStyles.collectionNav} aria-label="Collections">
            <button data-ui-account="collection-tab" data-ui-shape="control" type="button" aria-pressed={collection === "buddies"} onClick={() => setCollection("buddies")}>Les Buddies</button>
            <button data-ui-account="collection-tab" data-ui-shape="control" type="button" aria-pressed={collection === "placard"} onClick={() => setCollection("placard")}>Botte du Chanvrier & Héritages</button>
          </nav>}
          {screen === "cards" && collection === "placard" && <BotteAlbumCollection isAuthenticated={isAuthenticated} />}
          {screen === "cards" && collection === "buddies" &&
      <div className={albumStyles.collectionAnchor} aria-label="Mes cartes">
        <AlbumShell
          album={album}
          embedded={embedded}
          subtitle={config?.albumSubtitle}
          seasonLabel={config?.seasonLabel}
        >
          <AlbumPager pages={album.pages} activeIndex={activePageIndex} isPreview={isAlbumPreview} onPageChange={setActivePageIndex} />
          <AlbumPage
            page={activePage}
            isPreview={isAlbumPreview}
            onSlotClick={setSelectedSlot}
            onClaimClick={() => setRewardDrawerPage(activePage)}
            onBurnClick={(group: LotteryDuplicateGroup) => setBurnDrawerGroup({ page: activePage, group })}
          />
        </AlbumShell>
      </div>}

      {screen === "boosters" && <>
        <div className={arenaStyles.toolIntro}><Ticket aria-hidden="true" /><div><h2>La prochaine découverte.</h2><p>Ouvre tes boosters ou échange tes points pour agrandir ta collection.</p></div></div>
        <div className={arenaStyles.boosterActions}>
          {availableTickets.length > 0 && <button data-ui-account="gold" data-ui-shape="control" type="button" className={lobbyStyles.enter} onClick={openAvailablePack}>Ouvrir un booster <ArrowUpRight aria-hidden="true" /></button>}
          <span>{availableTickets.length} booster{availableTickets.length > 1 ? "s" : ""} disponible{availableTickets.length > 1 ? "s" : ""}</span>
          {welcome}
        </div>
      </>}
      {screen === "rewards" && <div className={arenaStyles.toolIntro}><Gift aria-hidden="true" /><div><h2>À toi de choisir.</h2><p>Les pages complètes et les doublons réunis débloquent tes récompenses.</p></div></div>}
      {screen !== "cards" && <section className={albumStyles.actionGrid} aria-label="Actions de l'album">
        {screen === "boosters" && <div data-ui-account="album-action" data-ui-shape="panel" className={albumStyles.actionCard}>
          <span>
            <span className={albumStyles.actionHeader}>
              <span className={albumStyles.actionIcon}><Sparkles aria-hidden="true" /></span>
              <strong className={albumStyles.actionValue}>{loyalty.spendablePoints}</strong>
            </span>
            <h2>Points disponibles</h2>
            <p>{LOTTERY_POINTS_PACK_COST} points permettent d’obtenir un booster.</p>
          </span>
          <div className={albumStyles.pointsControls}>
            <QuantitySelector
              value={effectivePackPurchaseQty}
              min={1}
              max={Math.max(1, maxPurchasablePacks)}
              onChange={setPackPurchaseQty}
              disabled={isAlbumPreview}
              compact
            />
            <button data-ui-account="points-action" data-ui-shape="control"
              type="button"
              disabled={isAlbumPreview || acting || maxPurchasablePacks < 1}
              onClick={() => void handlePurchasePacks()}
            >
              Acheter {effectivePackPurchaseQty}
            </button>
          </div>
        </div>}

        {screen === "rewards" && <><button data-ui-account="album-action" data-ui-shape="control" data-ui-account-muted={claimablePages.length === 0}
          type="button"
          className={`${albumStyles.actionCard} ${claimablePages.length === 0 ? albumStyles.actionCardMuted : ""}`}
          disabled={isAlbumPreview || claimablePages.length === 0}
          onClick={() => {
            const page = claimablePages[0];
            if (!page) return;
            const pageIndex = album.pages.findIndex((candidate) => candidate.rarity === page.rarity);
            if (pageIndex >= 0) setActivePageIndex(pageIndex, true);
            setRewardDrawerPage(page);
          }}
        >
          <span>
            <span className={albumStyles.actionHeader}>
              <span className={albumStyles.actionIcon}><Gift aria-hidden="true" /></span>
              <strong className={albumStyles.actionValue}>{claimablePages.length}</strong>
            </span>
            <h2>Récompenses</h2>
            <p>{claimablePages.length > 0 ? "Une page complète attend ton choix." : "Complète une page pour débloquer son lot."}</p>
          </span>
          <span className={albumStyles.actionLink}>Voir mes gains <ChevronRight aria-hidden="true" /></span>
        </button>

        <button data-ui-account="album-action" data-ui-shape="control" data-ui-account-muted={allBurnableGroups.length === 0}
          type="button"
          className={`${albumStyles.actionCard} ${allBurnableGroups.length === 0 ? albumStyles.actionCardMuted : ""}`}
          disabled={isAlbumPreview || allBurnableGroups.length === 0}
          onClick={() => setIsDuplicateManagerOpen(true)}
        >
          <span>
            <span className={albumStyles.actionHeader}>
              <span className={albumStyles.actionIcon}><Recycle aria-hidden="true" /></span>
              <strong className={albumStyles.actionValue}>{allBurnableGroups.length}</strong>
            </span>
            <h2>Doublons recyclables</h2>
            <p>{allBurnableGroups.length > 0 ? "Transforme tes copies en réduction ou en cadeau." : "Continue à collectionner pour recycler tes copies."}</p>
          </span>
          <span className={albumStyles.actionLink}>Gérer mes doublons <ChevronRight aria-hidden="true" /></span>
        </button>
        </>}
      </section>}
        </div>
      </div>}

      {(screen === "lobby" || screen === "cards" || screen === "rewards") && <PioneerPackReward onClaimed={refreshAll} />}

      {selectedSlot && <CardDetailModal slot={selectedSlot} onClose={() => setSelectedSlot(null)} />}

      {rewardDrawerPage && (
        <PageRewardDrawer
          page={rewardDrawerPage}
          acting={acting}
          onClaim={handleClaimReward}
          onClose={() => setRewardDrawerPage(null)}
        />
      )}

      {burnDrawerGroup && (
        <DuplicateBurnDrawer
          page={burnDrawerGroup.page}
          group={burnDrawerGroup.group}
          acting={acting}
          onBurn={handleBurnDuplicates}
          onClose={() => setBurnDrawerGroup(null)}
        />
      )}

      {isDuplicateManagerOpen && allBurnableGroups.length > 0 ? (
        <DuplicateManagerModal
          items={allBurnableGroups}
          onClose={() => setIsDuplicateManagerOpen(false)}
          onSelect={(item) => {
            setIsDuplicateManagerOpen(false);
            setBurnDrawerGroup(item);
          }}
        />
      ) : null}

      <PackOpeningFlowModal
        ticket={activeTicket}
        onClose={() => setSelectedTicketId(null)}
        onOpen={openPack}
      />
    </div>
  );

  return (
    <section data-world="album" className="relative">
      {buddiesAlbumBody}
      {previewOverlay}
    </section>
  );
}
