"use client";

import Image from "next/image";
import { Recycle } from "lucide-react";
import { useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityAccentColor, rarityLabels } from "@/lib/lottery-card-ui";
import type {
  LotteryCollectionPageState,
  LotteryDuplicateBurnChoice,
  LotteryDuplicateGroup,
} from "@/types/lottery";
import styles from "./AlbumExperience.module.css";

type DuplicateBurnDrawerProps = {
  page: LotteryCollectionPageState;
  group: LotteryDuplicateGroup;
  acting: boolean;
  onBurn: (group: LotteryDuplicateGroup, rewardChoice: LotteryDuplicateBurnChoice) => Promise<void>;
  onClose: () => void;
};

export function DuplicateBurnDrawer({ page, group, acting, onBurn, onClose }: DuplicateBurnDrawerProps) {
  useBodyScrollLock(true);
  const [rewardChoice, setRewardChoice] = useState<LotteryDuplicateBurnChoice>("discount");
  const accent = rarityAccentColor[page.rarity];
  const burnOffer = page.burnOffer;
  const normalizedImageUrl = group.imageUrl.startsWith("/") || isRemoteImageUrl(group.imageUrl)
    ? group.imageUrl
    : `/${group.imageUrl}`;

  if (!burnOffer) {
    return null;
  }

  const canBurn = group.burnableInstanceIds.length >= burnOffer.duplicatesRequired;

  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-burn-title"
      onClick={onClose}
    >
      <div
        className={styles.modalShell}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={styles.modalClose}
          aria-label="Fermer"
        >
          x
        </button>

        <div className="space-y-5 p-6">
          <div className="text-center">
            <Recycle className="mx-auto h-10 w-10 text-forest" aria-hidden="true" />
            <h3 id="duplicate-burn-title" className="mt-2 font-display text-xl text-ink">Recycler des doublons</h3>
            <p className="mt-1 text-sm text-charcoal">
              Échange <span className="font-bold">{burnOffer.duplicatesRequired} doublons</span> de{" "}
              <span className="font-semibold" style={{ color: accent }}>
                {group.name}
              </span>{" "}
              contre, au choix, <span className="font-bold text-forest">-{burnOffer.discountPercent}%</span> ou{" "}
              <span className="font-bold text-amber-700">{burnOffer.giftWeightGrams}g offerts</span>.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-xl border-2 border-ink/10 bg-cream-dark/15 p-4">
            {isRenderableImageSource(normalizedImageUrl) ? (
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={normalizedImageUrl}
                  alt={group.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-20 w-16 items-center justify-center rounded-lg bg-cream-dark/30">
                <span className="text-3xl">[]</span>
              </div>
            )}

            <div>
              <p className="font-display text-sm text-ink">{group.name}</p>
              <p className="text-xs text-charcoal">
                #{group.cardNumber} - {rarityLabels[group.rarity]}
              </p>
              <p className="mt-1 text-sm font-bold" style={{ color: accent }}>
                {group.duplicateCount} doublon{group.duplicateCount > 1 ? "s" : ""} disponible
                {group.duplicateCount > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setRewardChoice("discount")}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                rewardChoice === "discount"
                  ? "border-forest bg-forest/10 shadow-sm"
                  : "border-ink/10 bg-cream-dark/10 hover:border-ink/20"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.08em] text-forest">Option 1</p>
              <p className="mt-1 font-display text-sm text-ink">Code promo de réduction</p>
              <p className="mt-1 text-sm text-charcoal">
                Reçois un code personnel de <span className="font-bold text-forest">-{burnOffer.discountPercent}%</span>.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRewardChoice("gift")}
              className={`rounded-xl border-2 p-3 text-left transition-all ${
                rewardChoice === "gift"
                  ? "border-amber-500 bg-amber-50 shadow-sm"
                  : "border-ink/10 bg-cream-dark/10 hover:border-ink/20"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.08em] text-amber-700">Option 2</p>
              <p className="mt-1 font-display text-sm text-ink">Cadeau en grammes</p>
              <p className="mt-1 text-sm text-charcoal">
                Reçois <span className="font-bold text-amber-700">{burnOffer.giftWeightGrams}g offerts</span>.
              </p>
            </button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
            <p className="text-sm text-amber-800">
              <span className="font-bold">{burnOffer.duplicatesRequired}</span> cartes seront détruites -&gt;
              {rewardChoice === "discount" ? (
                <>
                  {" "}tu reçois un code <span className="font-bold text-forest">-{burnOffer.discountPercent}%</span>
                </>
              ) : (
                <>
                  {" "}tu reçois <span className="font-bold text-amber-700">{burnOffer.giftWeightGrams}g offerts</span>
                </>
              )}
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-cartoon btn-secondary min-h-[44px] flex-1 text-sm">
              Annuler
            </button>
            <button
              onClick={() => onBurn(group, rewardChoice)}
              disabled={acting || !canBurn}
              className="btn-cartoon btn-primary min-h-[44px] flex-1 text-sm disabled:opacity-50"
            >
              {acting ? "Recyclage..." : `Recycler x${burnOffer.duplicatesRequired}`}
            </button>
          </div>

          {!canBurn && (
            <p className="text-center text-xs text-red-500">
              Il faut au moins {burnOffer.duplicatesRequired} doublons pour recycler.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
