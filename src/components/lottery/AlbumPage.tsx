"use client";

import { AlbumCardSlot } from "@/components/lottery/AlbumCardSlot";
import { rarityAccentColor } from "@/lib/lottery-card-ui";
import type {
  LotteryCollectionCardSlot,
  LotteryCollectionPageState,
  LotteryDuplicateGroup,
} from "@/types/lottery";

type AlbumPageProps = {
  page: LotteryCollectionPageState;
  onSlotClick: (slot: LotteryCollectionCardSlot) => void;
  onClaimClick: () => void;
  onBurnClick: (group: LotteryDuplicateGroup) => void;
};

export function AlbumPage({ page, onSlotClick, onClaimClick, onBurnClick }: AlbumPageProps) {
  const accent = rarityAccentColor[page.rarity];
  const burnableGroups = page.duplicateGroups.filter(
    (group) => group.burnableInstanceIds.length >= (page.burnOffer?.duplicatesRequired ?? 5),
  );

  return (
    <div className="cartoon-border space-y-6 bg-cream p-5 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink md:text-3xl" style={{ color: accent }}>
            {page.title}
          </h2>
          <p className="mt-1 text-sm text-charcoal">
            {page.ownedUnique} / {page.totalSlots} cartes - {page.completionPercent}% complete
          </p>
          {page.missingCount > 0 && (
            <p className="mt-1 text-xs font-semibold text-[#b45309]">
              {page.missingCount} carte{page.missingCount > 1 ? "s" : ""} manquante{page.missingCount > 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {page.rewardStatus === "claimable" && (
            <button
              type="button"
              onClick={onClaimClick}
              className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center px-4 text-sm"
            >
              Reclamer ma recompense
            </button>
          )}
          {page.rewardStatus === "claimed" && (
            <span className="pill-cartoon bg-[#e7f4e8] px-3 py-1 text-sm text-[#1f6f3a]">Recompense reclamee</span>
          )}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full border border-ink/10 bg-[#e9ddcb]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, page.completionPercent)}%`, backgroundColor: accent }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {page.slots.map((slot) => (
          <AlbumCardSlot key={slot.cardDefinitionId} slot={slot} onClick={() => onSlotClick(slot)} />
        ))}
      </div>

      {page.burnOffer && burnableGroups.length > 0 && (
        <div className="rounded-[18px] border-2 border-dashed border-[#d4a835]/55 bg-[#fff5da] p-4">
          <h3 className="font-display text-lg text-[#9a6700]">
            Recycler des doublons ({page.burnOffer.discountPercent}% de remise)
          </h3>
          <p className="mt-1 text-xs text-[#8b6d2b]">
            Echange {page.burnOffer.duplicatesRequired} copies en trop d&apos;une meme carte contre un code promo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {burnableGroups.map((group) => (
              <button
                key={group.cardDefinitionId}
                type="button"
                onClick={() => onBurnClick(group)}
                className="btn-cartoon inline-flex items-center gap-2 border-2 border-[#e0bc67] bg-[#ffe7a8] px-3 py-1.5 text-xs text-[#6f4b00] hover:bg-[#ffdf8e]"
              >
                <span className="max-w-[10rem] truncate font-semibold">{group.name}</span>
                <span className="rounded bg-white/55 px-1.5 py-0.5 text-[10px] font-bold">x{group.duplicateCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
