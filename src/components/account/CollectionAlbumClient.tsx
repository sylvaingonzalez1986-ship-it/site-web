"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Gift, Recycle, Sparkles, Ticket, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCart } from "@/context/CartContext";
import { PackOpeningFlowModal } from "@/components/account/PackOpeningFlowModal";
import { QuantitySelector } from "@/components/QuantitySelector";
import { AlbumPage } from "@/components/lottery/AlbumPage";
import { AlbumPager } from "@/components/lottery/AlbumPager";
import { AlbumShell } from "@/components/lottery/AlbumShell";
import { CardDetailModal } from "@/components/lottery/CardDetailModal";
import { DuplicateBurnDrawer } from "@/components/lottery/DuplicateBurnDrawer";
import { PageRewardDrawer } from "@/components/lottery/PageRewardDrawer";
import { useLotteryExperience } from "@/hooks/useLotteryExperience";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
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

function DuplicateManagerModal({
  items,
  onSelect,
  onClose,
}: {
  items: BurnableAlbumGroup[];
  onSelect: (item: BurnableAlbumGroup) => void;
  onClose: () => void;
}) {
  useBodyScrollLock(true);

  return (
    <div className={albumStyles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="duplicate-manager-title" onClick={onClose}>
      <div className={albumStyles.modalShell} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={albumStyles.modalClose} onClick={onClose} aria-label="Fermer">
          <X aria-hidden="true" />
        </button>
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
              <button
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
      </div>
    </div>
  );
}

export function CollectionAlbumContent({ embedded = false }: CollectionAlbumContentProps) {
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

  const [activePageIndex, setActivePageIndex] = useState(0);
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
      <div className="relative flex justify-center px-4 pt-6 md:px-6 md:pt-10">
        <div className={`${albumStyles.modalShell} p-6 text-center`}>
          <p className="font-display text-2xl leading-tight text-ink">Crée ton compte pour commencer ta collection</p>
          <p className="mt-3 text-sm text-charcoal">
            Ouvre tes boosters, collectionne tes cartes et suis ta progression dans ton album.
          </p>
          <Link
            href="/compte/inscription?next=/profil/collection"
            className={`${albumStyles.primaryButton} mt-5`}
          >
            Créer mon compte
          </Link>
          <Link
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
          <div className={albumStyles.statusCard}>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-forest border-t-transparent" />
            <p className="mt-3 font-display text-ink">Chargement de ta collection...</p>
          </div>
        </div>
      );
    }

    return (
      <section className={albumStyles.pageShell}>
        <div className={albumStyles.pageInner}>
          <div className={albumStyles.statusCard}>
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
          <div className={albumStyles.statusCard}>
            <p className="font-display text-lg text-red-600">{error}</p>
            <button className={`${albumStyles.primaryButton} mt-4`} onClick={() => refreshAll()}>
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    return (
      <section className={albumStyles.pageShell}>
        <div className={albumStyles.pageInner}>
          <div className={albumStyles.statusCard}>
            <p className="font-display text-lg text-red-600">{error}</p>
            <button
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

  const albumBody = (
    <div className={`${albumStyles.experience} ${isAlbumPreview ? "pointer-events-none opacity-80 grayscale" : ""}`}>
      <header className={albumStyles.hero}>
        <div className={albumStyles.heroCopy}>
          <p className={albumStyles.kicker}>Kanab Quest · collection à compléter</p>
          {embedded ? (
            <h2 className={albumStyles.heroTitle}>Mon <span>album.</span></h2>
          ) : (
            <h1 className={albumStyles.heroTitle}>Mon <span>album.</span></h1>
          )}
          <p className={albumStyles.heroLead}>
            Ouvre tes boosters, complète chaque page et débloque les récompenses de la collection.
          </p>
        </div>
        <div className={albumStyles.heroArt} aria-hidden="true">
          <span className={albumStyles.heroCircle} />
          <Image
            src="/app/lottery/charles-booster-presentation-v2.png"
            alt=""
            width={1024}
            height={1536}
            sizes="(max-width: 767px) 160px, 315px"
            className={albumStyles.heroPresentation}
          />
        </div>
      </header>

      <section className={albumStyles.summaryBar} aria-label="Résumé de la collection">
        <div className={albumStyles.summaryStat}>
          <span>Cartes</span>
          <strong>{album.summary.ownedUnique}/{album.summary.totalCards}</strong>
        </div>
        <div className={albumStyles.summaryStat}>
          <span>Album complété</span>
          <strong>{album.summary.completionPercent}%</strong>
        </div>
        <div className={albumStyles.summaryStat}>
          <span>Boosters</span>
          <strong>{availableTickets.length}</strong>
        </div>
        <div className={`${albumStyles.summaryStat} ${claimablePages.length > 0 ? albumStyles.summaryStatHighlight : ""}`}>
          <span>Récompenses</span>
          <strong>{claimablePages.length}</strong>
        </div>
      </section>

      <div>
        {isAuthenticated && welcomeEligible && !welcomeJustClaimed && (
          <button
            type="button"
            disabled={welcomeClaiming}
            onClick={handleClaimWelcomePack}
            className={albumStyles.notice}
          >
            <span className={albumStyles.noticeIcon}>🎁</span>
            <div>
              <p>Cadeau de bienvenue</p>
              <strong>{welcomeClaiming ? "Attribution en cours…" : "Récupérer mon booster gratuit"}</strong>
            </div>
          </button>
        )}

        {welcomeJustClaimed && (
          <div className={albumStyles.notice}>
            <span className={albumStyles.noticeIcon}>✓</span>
            <div>
              <p>Booster ajouté</p>
              <strong>Ton cadeau est prêt à être ouvert.</strong>
            </div>
          </div>
        )}
      </div>

      <section className={albumStyles.actionGrid} aria-label="Actions de l'album">
        <button
          type="button"
          className={`${albumStyles.actionCard} ${availableTickets.length === 0 ? albumStyles.actionCardMuted : ""}`}
          disabled={isAlbumPreview || availableTickets.length === 0}
          onClick={() => availableTickets[0] && setSelectedTicketId(availableTickets[0].id)}
        >
          <span>
            <span className={albumStyles.actionHeader}>
              <span className={albumStyles.actionIcon}><Ticket aria-hidden="true" /></span>
              <strong className={albumStyles.actionValue}>{availableTickets.length}</strong>
            </span>
            <h2>Mes boosters</h2>
            <p>{availableTickets.length > 0 ? "Un booster est prêt à être ouvert." : "Aucun booster disponible actuellement."}</p>
          </span>
          <span className={albumStyles.actionLink}>Ouvrir maintenant <ChevronRight aria-hidden="true" /></span>
        </button>

        <div className={albumStyles.actionCard}>
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
            <button
              type="button"
              disabled={isAlbumPreview || acting || maxPurchasablePacks < 1}
              onClick={() => void handlePurchasePacks()}
            >
              Acheter {effectivePackPurchaseQty}
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`${albumStyles.actionCard} ${claimablePages.length === 0 ? albumStyles.actionCardMuted : ""}`}
          disabled={isAlbumPreview || claimablePages.length === 0}
          onClick={() => {
            const page = claimablePages[0];
            if (!page) return;
            const pageIndex = album.pages.findIndex((candidate) => candidate.rarity === page.rarity);
            if (pageIndex >= 0) setActivePageIndex(pageIndex);
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

        <button
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
      </section>

      <AlbumShell
        album={album}
        embedded={embedded}
        subtitle={config?.albumSubtitle}
        seasonLabel={config?.seasonLabel}
      >
        <AlbumPager
          pages={album.pages}
          activeIndex={activePageIndex}
          isPreview={isAlbumPreview}
          onPageChange={setActivePageIndex}
        />

        <AlbumPage
          page={activePage}
          isPreview={isAlbumPreview}
          onSlotClick={setSelectedSlot}
          onClaimClick={() => setRewardDrawerPage(activePage)}
          onBurnClick={(group: LotteryDuplicateGroup) => setBurnDrawerGroup({ page: activePage, group })}
        />
      </AlbumShell>

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

  if (embedded) {
    return (
      <div className="relative">
        {albumBody}
        {previewOverlay}
      </div>
    );
  }

  return (
    <section data-world="album" className={albumStyles.pageShell}>
      <div className={albumStyles.pageInner}>
        <div className="relative">
          {albumBody}
          {previewOverlay}
        </div>
      </div>
    </section>
  );
}



