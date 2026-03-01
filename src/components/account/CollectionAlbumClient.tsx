"use client";

import { useMemo, useState } from "react";
import { PackOpeningFlowModal } from "@/components/account/PackOpeningFlowModal";
import { AlbumPage } from "@/components/lottery/AlbumPage";
import { AlbumPager } from "@/components/lottery/AlbumPager";
import { AlbumShell } from "@/components/lottery/AlbumShell";
import { CardDetailModal } from "@/components/lottery/CardDetailModal";
import { DuplicateBurnDrawer } from "@/components/lottery/DuplicateBurnDrawer";
import { PageRewardDrawer } from "@/components/lottery/PageRewardDrawer";
import { useLotteryExperience } from "@/hooks/useLotteryExperience";
import type {
  LotteryCollectionCardSlot,
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
  const {
    album,
    tickets,
    config,
    loading,
    error,
    acting,
    refreshAll,
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

  const handleBurnDuplicates = async (group: LotteryDuplicateGroup) => {
    const ids = group.burnableInstanceIds.slice(0, 5);
    await burnDuplicates(group.rarity, ids);
    setBurnDrawerGroup(null);
  };

  const albumBody = (
    <>
      <div className="space-y-4">
        {availableTickets.length > 0 && (
          <div className="cartoon-border bg-[#fff8e8] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-charcoal">Boosters disponibles</p>
                <h2 className="mt-1 font-display text-2xl text-ink">
                  {availableTickets.length} {config?.albumBoosterTitle?.trim() || `pack${availableTickets.length > 1 ? "s" : ""} a ouvrir`}
                </h2>
                <p className="mt-1 text-sm text-charcoal">
                  {config?.albumBoosterDescription?.trim() || "Ouvre un booster depuis l'album pour reveler les 3 cartes sans quitter cette page."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTickets.slice(0, 3).map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center px-4 text-xs leading-none"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    Ouvrir {ticket.ticketNumber}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(() => {
          const claimablePages = album.pages.filter((p) => p.rewardStatus === "claimable");
          if (claimablePages.length === 0) return null;
          return (
            <div className="cartoon-border bg-[#e7f4e8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#1f6f3a]">Recompenses disponibles</p>
              <p className="mt-1 text-sm text-charcoal">
                {claimablePages.length} page{claimablePages.length > 1 ? "s" : ""} complete{claimablePages.length > 1 ? "s" : ""} — reclame tes lots !
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {claimablePages.map((page) => (
                  <button
                    key={page.rarity}
                    type="button"
                    className="btn-cartoon inline-flex items-center gap-2 border-2 border-[#2d9e5b] bg-[#d4f5dc] px-3 py-1.5 text-xs text-[#1a5c32] hover:bg-[#c0eeca]"
                    onClick={() => {
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
                {allBurnableGroups.length} carte{allBurnableGroups.length > 1 ? "s" : ""} recyclable{allBurnableGroups.length > 1 ? "s" : ""} — echange 5 doublons contre un code promo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {allBurnableGroups.slice(0, 6).map(({ page, group }) => (
                  <button
                    key={group.cardDefinitionId}
                    type="button"
                    className="btn-cartoon inline-flex items-center gap-2 border-2 border-[#e0bc67] bg-[#ffe7a8] px-3 py-1.5 text-xs text-[#6f4b00] hover:bg-[#ffdf8e]"
                    onClick={() => setBurnDrawerGroup({ page, group })}
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
        >
          <AlbumPager pages={album.pages} activeIndex={activePageIndex} onPageChange={setActivePageIndex} />

          <AlbumPage
            page={activePage}
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
    </>
  );

  if (embedded) {
    return albumBody;
  }

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36 pb-20">
      <div className="retro-container max-w-5xl">{albumBody}</div>
    </section>
  );
}
