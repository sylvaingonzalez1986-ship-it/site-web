"use client";

import Image from "next/image";
import { AlbumCardSlot } from "@/components/lottery/AlbumCardSlot";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor } from "@/lib/lottery-card-ui";
import type {
  LotteryCollectionCardSlot,
  LotteryCollectionPageRewardOption,
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
    (group) => group.burnableInstanceIds.length >= (page.burnOffer?.duplicatesRequired ?? 10),
  );
  const selectedReward = page.rewardOptions.find(
    (option) => option.rewardDefinitionId === page.selectedRewardDefinitionId,
  );
  const showRewardTeaser = page.rewardOptions.length > 0 || Boolean(page.burnOffer);

  return (
    <div className="cartoon-border space-y-6 bg-cream p-5 md:p-8">
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

      <div className="h-2 overflow-hidden rounded-full border border-ink/10 bg-[#e9ddcb]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, page.completionPercent)}%`, backgroundColor: accent }}
        />
      </div>

      {showRewardTeaser && (
        <div
          className={`rounded-[18px] border-2 p-4 ${
            page.rewardStatus === "locked"
              ? "border-ink/10 bg-white/55"
              : page.rewardStatus === "claimable"
                ? "border-[#7ac48b] bg-[#e7f4e8]"
                : "border-[#96d3a4] bg-[#f2fbf4]"
          }`}
        >
          {page.rewardStatus === "claimed" ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#d8f1dd] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#1f6f3a]">
                  Réclamé
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#1f6f3a]">Lot réclamé</p>
                  <p className="truncate text-sm font-semibold text-ink">
                    {selectedReward?.title ?? "Récompense de page réclamée"}
                  </p>
                </div>
              </div>
              {selectedReward && (
                <RewardOptionPreview
                  option={selectedReward}
                  interactive={false}
                  onClick={onClaimClick}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p
                    className={`text-[11px] font-black uppercase tracking-[0.1em] ${
                      page.rewardStatus === "claimable" ? "text-[#1f6f3a]" : "text-charcoal/60"
                    }`}
                  >
                    {page.rewardStatus === "claimable" ? "Page complète" : "Lot à débloquer"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {page.rewardStatus === "claimable"
                      ? "Choisis ton lot :"
                      : "Complète cette page pour débloquer :"}
                  </p>
                </div>
                {page.rewardStatus === "claimable" && page.rewardOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={onClaimClick}
                    className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center justify-center px-4 text-sm"
                  >
                    Réclamer ma récompense
                  </button>
                )}
              </div>

              {page.rewardOptions.length > 0 && (
                <div className="grid gap-3">
                  {page.rewardOptions.map((option) => (
                    <RewardOptionPreview
                      key={option.rewardDefinitionId}
                      option={option}
                      interactive={page.rewardStatus === "claimable"}
                      dimmed={page.rewardStatus === "locked"}
                      onClick={onClaimClick}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {page.burnOffer && (
            <div
              className={`mt-4 border-t border-dashed pt-4 text-sm ${
                page.rewardStatus === "locked" ? "border-ink/10 text-charcoal/70" : "border-ink/15 text-charcoal/80"
              }`}
            >
              <p className="font-semibold">
                Recycle {page.burnOffer.duplicatesRequired} doublons d&apos;une même carte contre -{page.burnOffer.discountPercent}%
                ou {page.burnOffer.giftWeightGrams}g offerts.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {page.slots.map((slot) => (
          <AlbumCardSlot key={slot.cardDefinitionId} slot={slot} onClick={() => onSlotClick(slot)} />
        ))}
      </div>

      {page.burnOffer && burnableGroups.length > 0 && (
        <div className="rounded-[18px] border-2 border-dashed border-[#d4a835]/55 bg-[#fff5da] p-4">
          <h3 className="font-display text-lg text-[#9a6700]">
            Recycler des doublons (-{page.burnOffer.discountPercent}% ou {page.burnOffer.giftWeightGrams}g)
          </h3>
          <p className="mt-1 text-xs text-[#8b6d2b]">
            Échange {page.burnOffer.duplicatesRequired} copies en trop d&apos;une même carte contre une réduction ou des grammes offerts.
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

function RewardOptionPreview({
  option,
  interactive,
  dimmed = false,
  onClick,
}: {
  option: LotteryCollectionPageRewardOption;
  interactive: boolean;
  dimmed?: boolean;
  onClick: () => void;
}) {
  const rawImageUrl = option.imageUrl.trim();
  const normalizedImageUrl = rawImageUrl
    ? rawImageUrl.startsWith("/") || isRemoteImageUrl(rawImageUrl)
      ? rawImageUrl
      : `/${rawImageUrl}`
    : "";
  const hasRenderableImage = isRenderableImageSource(normalizedImageUrl);

  const className = `group w-full rounded-[16px] border-2 border-ink/10 bg-white/70 p-3 text-left transition-all ${
    dimmed ? "opacity-70" : "opacity-100"
  } ${interactive ? "hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white hover:shadow-sm" : ""}`;

  const content = (
    <div className="flex items-start gap-3">
      {hasRenderableImage && (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-[#efe7d8]">
          {isRemoteImageUrl(normalizedImageUrl) ? (
            <img
              src={normalizedImageUrl}
              alt={option.title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Image src={normalizedImageUrl} alt={option.title} fill className="object-cover" sizes="64px" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-display text-sm text-ink">{option.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-charcoal">{option.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {option.discountPercent && (
            <span className="rounded bg-forest/15 px-1.5 py-0.5 text-[10px] font-bold text-forest">
              -{option.discountPercent}%
            </span>
          )}
          {option.giftWeightGrams && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              {option.giftWeightGrams}g offerts
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (!interactive) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
