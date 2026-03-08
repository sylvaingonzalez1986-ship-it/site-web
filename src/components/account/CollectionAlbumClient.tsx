"use client";

import Image from "next/image";
import Link from "next/link";
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

export function CollectionAlbumClient() {
  return <CollectionAlbumContent embedded={false} />;
}

type CollectionAlbumContentProps = {
  embedded?: boolean;
};

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
        <div className="cartoon-border w-full max-w-md bg-cream p-6 text-center shadow-[8px_8px_0_rgba(26,26,26,0.12)]">
          <p className="font-display text-2xl leading-tight text-ink">Crée ton compte pour commencer ta collection</p>
          <p className="mt-3 text-sm text-charcoal">
            Ouvre tes boosters, collectionne tes cartes et suis ta progression dans ton album.
          </p>
          <Link
            href="/compte/inscription?next=/profil/collection"
            className="btn-cartoon btn-primary mt-5 inline-flex min-h-[44px] items-center justify-center px-5"
          >
            Créer mon compte
          </Link>
          <Link
            href="/compte/connexion?next=/profil/collection"
            className="btn-cartoon btn-secondary mt-3 inline-flex min-h-[44px] items-center justify-center px-5"
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
        <div className="cartoon-border bg-cream p-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-forest border-t-transparent" />
          <p className="mt-3 font-display text-ink">Chargement de ta collection...</p>
        </div>
      );
    }

    return (
      <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
        <div className="retro-container max-w-5xl">
          <div className="cartoon-border bg-cream p-10 text-center">
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
        <div className="cartoon-border bg-cream p-8 text-center">
          <p className="font-display text-lg text-red-600">{error}</p>
          <button
            className="btn-cartoon btn-primary mt-4 inline-flex min-h-[44px] items-center px-4"
            onClick={() => refreshAll()}
          >
            Reessayer
          </button>
        </div>
      );
    }

    return (
      <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
        <div className="retro-container max-w-5xl">
          <div className="cartoon-border bg-cream p-8 text-center">
            <p className="font-display text-lg text-red-600">{error}</p>
            <button
              className="btn-cartoon btn-primary mt-4 inline-flex min-h-[44px] items-center px-4"
              onClick={() => refreshAll()}
            >
              Reessayer
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
    <div className={isAlbumPreview ? "pointer-events-none opacity-80 grayscale" : ""}>
      <div className="space-y-4">
        {/* — Welcome pack one-shot CTA — */}
        {isAuthenticated && welcomeEligible && !welcomeJustClaimed && (
          <button
            type="button"
            disabled={welcomeClaiming}
            onClick={handleClaimWelcomePack}
            className="group flex w-full items-center gap-4 rounded-2xl border-[3px] border-dashed border-[#27ae60] bg-[#eafaf1] p-3 pr-6 shadow-[4px_4px_0_rgba(39,174,96,0.15)] transition-transform hover:-translate-y-0.5 hover:shadow-[4px_6px_0_rgba(39,174,96,0.22)] active:translate-y-0"
          >
            <span className="text-4xl leading-none">🎁</span>
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#27ae60]">Cadeau de bienvenue</p>
              <p className="mt-1 font-display text-xl leading-tight text-ink">
                {welcomeClaiming ? "Attribution en cours…" : "Récupérer mon pack gratuit"}
              </p>
              <p className="mt-0.5 text-xs text-charcoal">1 booster offert pour ton inscription !</p>
            </div>
          </button>
        )}

        {welcomeJustClaimed && (
          <div className="flex w-full items-center gap-4 rounded-2xl border-[3px] border-[#27ae60] bg-[#eafaf1] p-3 pr-6">
            <span className="text-4xl leading-none">✅</span>
            <div className="text-left">
              <p className="font-display text-lg text-[#27ae60]">Pack récupéré !</p>
              <p className="text-xs text-charcoal">Ouvre-le ci-dessous pour découvrir tes cartes.</p>
            </div>
          </div>
        )}

        {availableTickets.length > 0 && (
          <button
            type="button"
            className="group flex w-full items-center gap-4 rounded-2xl border-[3px] border-[#1a1a1a] bg-[#fff8e8] p-3 pr-6 shadow-[4px_4px_0_rgba(26,26,26,0.12)] transition-transform hover:-translate-y-0.5 hover:shadow-[4px_6px_0_rgba(26,26,26,0.16)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isAlbumPreview}
            onClick={() => {
              if (!isAlbumPreview) {
                setSelectedTicketId(availableTickets[0].id);
              }
            }}
          >
            <div className="relative h-20 w-14 shrink-0">
              <Image
                src="/app/lottery/sealed-booster-pack.png"
                alt="Booster scellé"
                fill
                sizes="56px"
                className="object-contain drop-shadow-md transition-transform group-hover:scale-105"
              />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-charcoal">Boosters disponibles</p>
              <p className="mt-1 font-display text-2xl leading-tight text-ink">
                {availableTickets.length} pack{availableTickets.length > 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-xs text-charcoal">Appuyez pour ouvrir</p>
            </div>
          </button>
        )}

        <div className="cartoon-border bg-[#eef6ff] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#24508a]">
                Boutique de packs
              </p>
              <p className="mt-1 font-display text-2xl leading-tight text-ink">
                {loyalty.spendablePoints} pts disponibles
              </p>
              <p className="mt-1 text-sm text-charcoal">
                {LOTTERY_POINTS_PACK_COST} pts par pack. Maximum{" "}
                {LOTTERY_POINTS_PACK_MAX_PER_PURCHASE} packs par achat.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#1a1a1a] bg-white px-3 py-2 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-charcoal">
                Points cumules
              </p>
              <p className="mt-1 text-lg font-bold text-ink">{loyalty.points}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
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
              className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center justify-center px-4 disabled:opacity-50"
              disabled={isAlbumPreview || acting || maxPurchasablePacks < 1}
              onClick={() => void handlePurchasePacks()}
            >
              Acheter {effectivePackPurchaseQty} pack{effectivePackPurchaseQty > 1 ? "s" : ""} -{" "}
              {effectivePackPurchaseQty * LOTTERY_POINTS_PACK_COST} pts
            </button>
          </div>

          <p className="mt-3 text-xs text-charcoal">
            {maxPurchasablePacks > 0
              ? `Tu peux acheter jusqu'a ${maxPurchasablePacks} pack${maxPurchasablePacks > 1 ? "s" : ""} maintenant.`
              : `Il te faut au moins ${LOTTERY_POINTS_PACK_COST} points disponibles pour acheter un pack.`}
          </p>
        </div>

        {(() => {
          const claimablePages = album.pages.filter((p) => p.rewardStatus === "claimable");
          if (claimablePages.length === 0) return null;
          return (
            <div className="cartoon-border bg-[#e7f4e8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#1f6f3a]">Récompenses disponibles</p>
              <p className="mt-1 text-sm text-charcoal">
                {claimablePages.length} page{claimablePages.length > 1 ? "s" : ""} complète{claimablePages.length > 1 ? "s" : ""} — réclame tes lots !
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {claimablePages.map((page) => (
                  <button
                    key={page.rarity}
                    type="button"
                    disabled={isAlbumPreview}
                    className={`btn-cartoon inline-flex items-center gap-2 border-2 border-[#2d9e5b] bg-[#d4f5dc] px-3 py-1.5 text-xs text-[#1a5c32] ${
                      isAlbumPreview ? "cursor-not-allowed opacity-70" : "hover:bg-[#c0eeca]"
                    }`}
                    onClick={() => {
                      if (isAlbumPreview) return;
                      const pageIndex = album.pages.findIndex((p) => p.rarity === page.rarity);
                      if (pageIndex >= 0) setActivePageIndex(pageIndex);
                      setRewardDrawerPage(page);
                    }}
                  >
                    <span className="font-semibold">{page.title}</span>
                    <span className="rounded bg-white/55 px-1.5 py-0.5 text-[10px] font-bold">
                      {page.rewardOptions.length} lot{page.rewardOptions.length > 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {(() => {
          const allBurnableGroups: Array<{ page: LotteryCollectionPageState; group: LotteryDuplicateGroup }> = [];
          for (const page of album.pages) {
            if (!page.burnOffer) continue;
            for (const group of page.duplicateGroups) {
              if (group.burnableInstanceIds.length >= page.burnOffer.duplicatesRequired) {
                allBurnableGroups.push({ page, group });
              }
            }
          }
          if (allBurnableGroups.length === 0) return null;
          return (
            <div className="cartoon-border bg-[#fff5da] p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#9a6700]">Recyclage de doublons</p>
              <p className="mt-1 text-sm text-charcoal">
                {allBurnableGroups.length} carte{allBurnableGroups.length > 1 ? "s" : ""} recyclables{allBurnableGroups.length > 1 ? "s" : ""} — échange 10 doublons d&apos;une même carte contre une réduction ou des grammes offerts.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {allBurnableGroups.slice(0, 6).map(({ page, group }) => (
                  <button
                    key={group.cardDefinitionId}
                    type="button"
                    disabled={isAlbumPreview}
                    className={`btn-cartoon inline-flex items-center gap-2 border-2 border-[#e0bc67] bg-[#ffe7a8] px-3 py-1.5 text-xs text-[#6f4b00] ${
                      isAlbumPreview ? "cursor-not-allowed opacity-70" : "hover:bg-[#ffdf8e]"
                    }`}
                    onClick={() => {
                      if (!isAlbumPreview) {
                        setBurnDrawerGroup({ page, group });
                      }
                    }}
                  >
                    <span className="max-w-[10rem] truncate font-semibold">{group.name}</span>
                    <span className="rounded bg-white/55 px-1.5 py-0.5 text-[10px] font-bold">x{group.duplicateCount}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

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
      </div>

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
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36 pb-20">
      <div className="retro-container max-w-5xl">
        <div className="relative">
          {albumBody}
          {previewOverlay}
        </div>
      </div>
    </section>
  );
}



