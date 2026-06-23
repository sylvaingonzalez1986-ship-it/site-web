"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type ContestTickerItem = {
  id: string;
  pseudo: string;
  excerpt: string;
  methodLabel?: string;
  stamp?: string;
  entryTitle?: string;
  entryImageUrl?: string;
  href?: string;
};

type ContestReviewTickerProps = {
  items: ContestTickerItem[];
  title?: string;
  emptyLabel?: string;
};

export function ContestReviewTicker({
  items,
  title = "Critiques en gare",
  emptyLabel = "Les premiers carnets approuvés défileront ici.",
}: ContestReviewTickerProps) {
  const safeItems = useMemo(
    () => items.filter((item) => item.excerpt.trim().length > 0),
    [items],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const effectiveActiveIndex =
    activeIndex >= 0 && activeIndex < safeItems.length ? activeIndex : 0;

  useEffect(() => {
    if (safeItems.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeItems.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [safeItems.length]);

  const activeItem = safeItems[effectiveActiveIndex] ?? null;

  return (
    <div className="cartoon-border bg-[#101010] p-4 text-[#f2efe9]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-2xl leading-none text-[#f4c26f]">{title}</p>
        {safeItems.length > 0 ? (
          <span className="self-start rounded-full border border-[#f4c26f]/60 bg-[#1f1f1f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#f4c26f]">
            Flux live
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded border border-[#f4c26f]/35 bg-[#151515] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        {activeItem ? (
          <div className="grid min-h-[9rem] gap-4 animate-[fadeScaleIn_220ms_ease] sm:grid-cols-[112px_minmax(0,1fr)]">
            {activeItem.entryImageUrl ? (
              <div className="relative min-h-[112px] overflow-hidden rounded border border-[#f4c26f]/50 bg-[#202020]">
                <Image
                  src={activeItem.entryImageUrl}
                  alt={activeItem.entryTitle ?? "Produit testé"}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="flex flex-col justify-between">
              <p className="font-mono text-[11px] font-bold uppercase leading-relaxed tracking-[0.16em] text-[#9eb27f]">
                {activeItem.pseudo}
                {activeItem.methodLabel ? ` / ${activeItem.methodLabel}` : ""}
                {activeItem.stamp ? ` / ${activeItem.stamp}` : ""}
              </p>
              <p className="mt-3 text-lg leading-relaxed text-[#f7f4ee]">
                &quot;{activeItem.excerpt}&quot;
              </p>
              {(activeItem.entryTitle || activeItem.href) && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs uppercase leading-relaxed tracking-[0.12em] text-[#d9d4ca]">
                    {activeItem.entryTitle ?? "Lot premium"}
                  </span>
                  {activeItem.href ? (
                    <Link
                      href={activeItem.href}
                      className="rounded-full border border-[#f4c26f]/65 bg-[#202020] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#f4c26f]"
                    >
                      Lire la fiche
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[8.5rem] items-center justify-center text-center">
            <p className="max-w-sm text-sm leading-relaxed text-[#d9d4ca]">{emptyLabel}</p>
          </div>
        )}
      </div>

      {safeItems.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {safeItems.slice(0, 8).map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 w-2.5 rounded-full border ${
                index === effectiveActiveIndex
                  ? "border-[#f4c26f] bg-[#f4c26f]"
                  : "border-[#f4c26f]/45 bg-transparent"
              }`}
              aria-label={`Afficher la critique ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
