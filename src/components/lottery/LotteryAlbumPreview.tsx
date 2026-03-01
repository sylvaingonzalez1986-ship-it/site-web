"use client";

import type { LotteryAlbumCard, LotteryStickerRarity } from "@/types/lottery";

type LotteryAlbumPreviewSlot = {
  key: string;
  slotIndex: number;
  label?: string;
  card?: Pick<LotteryAlbumCard, "title" | "subtitle" | "imageUrl" | "seriesLabel" | "cardNumber">;
};

type LotteryAlbumPreviewProps = {
  rarity: LotteryStickerRarity;
  pageLabel: string;
  collectionTitle: string;
  title: string;
  slots: LotteryAlbumPreviewSlot[];
  filledSlots?: number;
  revealAssignedCards?: boolean;
  badge?: string;
  note?: string;
  className?: string;
};

const rarityShellClasses = {
  common: "border-[#1a1a1a] bg-[#f7edd7]",
  rare: "border-[#1a1a1a] bg-[#eef7f1]",
  epic: "border-[#1a1a1a] bg-[#fff0d5]",
} as const;

export function LotteryAlbumPreview({
  rarity,
  pageLabel,
  collectionTitle,
  title,
  slots,
  filledSlots = slots.length,
  revealAssignedCards = false,
  badge,
  note,
  className = "",
}: LotteryAlbumPreviewProps) {
  return (
    <article
      className={`relative overflow-hidden rounded-[36px] border-[3px] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] ${rarityShellClasses[rarity]} ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.18) 100%), radial-gradient(circle at 20% 20%, rgba(122,75,36,0.08), transparent 42%), radial-gradient(circle at 80% 75%, rgba(122,75,36,0.06), transparent 36%)",
      }}
    >
      <div className="pointer-events-none absolute left-4 top-5 h-12 w-12 rotate-[-12deg] rounded-sm bg-[#c8b48b]/70 opacity-70" />
      <div className="pointer-events-none absolute right-6 top-4 h-10 w-10 rotate-[16deg] rounded-sm bg-[#d5c19d]/70 opacity-70" />
      <div className="pointer-events-none absolute bottom-4 left-5 h-10 w-10 rotate-[12deg] rounded-sm bg-[#ccb48a]/60 opacity-70" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="relative inline-flex items-center px-5 py-2 font-display text-2xl uppercase tracking-[0.06em] text-ink">
            <span className="absolute inset-0 rounded-[22px] border-[3px] border-[#1a1a1a] bg-[#f5dfad]" />
            <span className="absolute left-[-20px] top-[14px] h-0 w-0 border-b-[16px] border-l-[20px] border-t-[16px] border-b-transparent border-l-transparent border-t-transparent border-r-[20px] border-r-[#f1c87a]" />
            <span className="absolute right-[-20px] top-[14px] h-0 w-0 border-b-[16px] border-r-[20px] border-t-[16px] border-b-transparent border-r-transparent border-t-transparent border-l-[20px] border-l-[#f1c87a]" />
            <span className="relative">{pageLabel}</span>
          </div>
          {badge ? (
            <span className="pill-cartoon px-3 py-1 text-xs uppercase tracking-[0.08em] text-charcoal">
              {badge}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="font-display text-4xl leading-none text-ink md:text-5xl">{collectionTitle}</p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-charcoal/80">
            {title}
          </p>
          {note ? <p className="mt-1 text-sm text-charcoal">{note}</p> : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-5">
          {slots.map((slot, index) => {
            const isFilled = index < filledSlots;
            const shouldRevealCard = slot.card && (revealAssignedCards || isFilled);
            const card = shouldRevealCard ? slot.card : undefined;

            return (
              <div key={slot.key} className="relative aspect-[0.72]">
                <div className="absolute inset-0 rounded-[22px] border-[4px] border-[#1a1a1a] bg-[#fbf7ea]" />
                <div
                  className="absolute inset-0 rounded-[22px]"
                  style={{
                    clipPath:
                      "polygon(0% 6%, 4% 2%, 8% 6%, 12% 2%, 16% 6%, 20% 2%, 24% 6%, 28% 2%, 32% 6%, 36% 2%, 40% 6%, 44% 2%, 48% 6%, 52% 2%, 56% 6%, 60% 2%, 64% 6%, 68% 2%, 72% 6%, 76% 2%, 80% 6%, 84% 2%, 88% 6%, 92% 2%, 96% 6%, 100% 10%, 100% 94%, 96% 98%, 92% 94%, 88% 98%, 84% 94%, 80% 98%, 76% 94%, 72% 98%, 68% 94%, 64% 98%, 60% 94%, 56% 98%, 52% 94%, 48% 98%, 44% 94%, 40% 98%, 36% 94%, 32% 98%, 28% 94%, 24% 98%, 20% 94%, 16% 98%, 12% 94%, 8% 98%, 4% 94%, 0% 90%)",
                    border: "4px solid #1a1a1a",
                  }}
                />
                <div className="absolute inset-[14px] overflow-hidden rounded-[14px] border-2 border-black/20 bg-[#f8f2e3]">
                  {card ? (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={
                          card.imageUrl
                            ? { backgroundImage: `url(${card.imageUrl})` }
                            : {
                                backgroundImage:
                                  "linear-gradient(145deg, rgba(130,220,215,0.65), rgba(255,218,140,0.65) 45%, rgba(203,189,255,0.55)), linear-gradient(180deg, #cdeef4 0%, #ffe0a8 55%, #f3d3b1 100%)",
                              }
                        }
                      />
                      {!card.imageUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
                          <span className="font-display text-lg leading-none text-ink">{card.title}</span>
                          {card.subtitle ? (
                            <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-charcoal/80">
                              {card.subtitle}
                            </span>
                          ) : null}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-white/88 px-2 py-2">
                        <div className="flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-ink">
                              {card.seriesLabel}
                            </p>
                            <p className="truncate text-[11px] font-semibold text-charcoal">
                              {card.title}
                            </p>
                          </div>
                          <span className="text-sm font-black text-ink">#{card.cardNumber}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center px-3 text-center">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-charcoal/70">
                        Case a coller
                      </span>
                      <span className="mt-2 font-display text-4xl leading-none text-ink">
                        #{slot.slotIndex}
                      </span>
                      {slot.label ? (
                        <span className="mt-2 text-xs font-semibold text-charcoal/80">{slot.label}</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
