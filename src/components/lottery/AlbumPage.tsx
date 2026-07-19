"use client";

import Image from "next/image";
import { AlbumCardSlot } from "@/components/lottery/AlbumCardSlot";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor } from "@/lib/lottery-card-ui";
import { repairLikelyMojibake } from "@/lib/text-encoding-repair";
import type {
  LotteryCollectionCardSlot,
  LotteryCollectionPageRewardOption,
  LotteryCollectionPageState,
  LotteryDuplicateGroup,
} from "@/types/lottery";
import styles from "./AlbumExperience.module.css";

type AlbumPageProps = {
  page: LotteryCollectionPageState;
  onSlotClick: (slot: LotteryCollectionCardSlot) => void;
  onClaimClick: () => void;
  onBurnClick: (group: LotteryDuplicateGroup) => void;
  isPreview?: boolean;
};

export function AlbumPage({ page, onSlotClick, onClaimClick, onBurnClick, isPreview = false }: AlbumPageProps) {
  const accent = rarityAccentColor[page.rarity];
  const burnableGroups = page.duplicateGroups.filter(
    (group) => group.burnableInstanceIds.length >= (page.burnOffer?.duplicatesRequired ?? 10),
  );
  const selectedReward = page.rewardOptions.find(
    (option) => option.rewardDefinitionId === page.selectedRewardDefinitionId,
  );
  const showRewardTeaser = page.rewardOptions.length > 0 || Boolean(page.burnOffer);

  return (
    <article className={styles.albumPage}>
      <header className={styles.pageHeader}>
        <div>
          <h2 style={{ color: accent }}>{repairLikelyMojibake(page.title)}</h2>
          <p>
            {page.missingCount > 0
              ? `${page.missingCount} carte${page.missingCount > 1 ? "s" : ""} à trouver`
              : "Toutes les cartes sont réunies"}
          </p>
        </div>
        <strong className={styles.pageCounter}>{page.ownedUnique}/{page.totalSlots}</strong>
      </header>

      <div className={styles.pageProgress} aria-label={`Page complétée à ${page.completionPercent}%`}>
        <span style={{ width: `${Math.min(100, page.completionPercent)}%`, backgroundColor: accent }} />
      </div>

      <div className={styles.pageLayout}>
        <div className={styles.cardGrid}>
          {page.slots.map((slot) => (
            <AlbumCardSlot
              key={slot.cardDefinitionId}
              slot={slot}
              interactive={!isPreview}
              onClick={() => {
                if (!isPreview) onSlotClick(slot);
              }}
            />
          ))}
        </div>

        <aside className={styles.pageSidebar} aria-label="Récompenses et doublons de la page">
          {showRewardTeaser ? (
            <section className={`${styles.contextCard} ${page.rewardStatus === "claimable" ? styles.contextCardClaimable : ""}`}>
              <span className={styles.contextBadge}>
                {page.rewardStatus === "claimed"
                  ? "Réclamé"
                  : page.rewardStatus === "claimable"
                    ? "Disponible"
                    : "À débloquer"}
              </span>
              <h3>
                {page.rewardStatus === "claimed"
                  ? "Lot réclamé"
                  : page.rewardStatus === "claimable"
                    ? "Page complète"
                    : "Récompense de page"}
              </h3>
              <p>
                {page.rewardStatus === "claimed"
                  ? "Cette récompense fait maintenant partie de tes gains."
                  : page.rewardStatus === "claimable"
                    ? "Choisis maintenant la récompense que tu souhaites recevoir."
                    : "Complète cette page pour pouvoir choisir ton lot."}
              </p>

              {selectedReward ? (
                <div className={styles.rewardPreview}>
                  <RewardOptionPreview option={selectedReward} interactive={false} onClick={onClaimClick} />
                </div>
              ) : page.rewardOptions.length > 0 ? (
                <div className={styles.rewardPreview}>
                  <RewardOptionPreview
                    option={page.rewardOptions[0]}
                    interactive={false}
                    dimmed={page.rewardStatus === "locked"}
                    onClick={onClaimClick}
                  />
                </div>
              ) : null}

              {page.rewardStatus === "claimable" && page.rewardOptions.length > 0 ? (
                <button
                  type="button"
                  className={styles.contextButton}
                  disabled={isPreview}
                  onClick={() => !isPreview && onClaimClick()}
                >
                  Choisir ma récompense
                </button>
              ) : null}
            </section>
          ) : null}

          {page.burnOffer ? (
            <section className={styles.contextCard}>
              <span className={styles.contextBadge}>Doublons</span>
              <h3>Recycler</h3>
              <p>
                {page.burnOffer.duplicatesRequired} doublons identiques contre -{page.burnOffer.discountPercent}% ou {page.burnOffer.giftWeightGrams}g offerts.
              </p>
              {burnableGroups.length > 0 ? (
                <div className={styles.burnList}>
                  {burnableGroups.map((group) => (
                    <button
                      key={group.cardDefinitionId}
                      type="button"
                      className={styles.burnButton}
                      disabled={isPreview}
                      onClick={() => !isPreview && onBurnClick(group)}
                    >
                      <span>{group.name}</span>
                      <strong>x{group.duplicateCount}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p>Continue à ouvrir des boosters pour réunir assez de doublons.</p>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </article>
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

  const className = `group w-full border border-ink/15 bg-white/70 p-2 text-left transition-all ${
    dimmed ? "opacity-70" : "opacity-100"
  } ${interactive ? "hover:-translate-y-0.5 hover:border-ink/20 hover:bg-white hover:shadow-sm" : ""}`;

  const content = (
    <div className="flex items-start gap-3">
      {hasRenderableImage && (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-[#efe7d8]">
          <Image src={normalizedImageUrl} alt={repairLikelyMojibake(option.title)} fill className="object-cover" sizes="64px" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-display text-sm text-ink">{repairLikelyMojibake(option.title)}</p>
        <p className="mt-1 line-clamp-2 text-xs text-charcoal">{repairLikelyMojibake(option.description)}</p>
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


