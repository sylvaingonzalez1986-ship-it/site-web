"use client";

import { useState } from "react";
import Image from "next/image";
import { isRemoteImageUrl } from "@/lib/image-source";
import { ProductVideoModal } from "./ProductVideoModal";

type ProductImageGalleryProps = {
  images: string[];
  videoUrl?: string;
  productName: string;
  badge?: string;
  bonusPoints?: number;
};

export function ProductImageGallery({
  images,
  videoUrl,
  productName,
  badge,
  bonusPoints,
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const mediaItems = images.map((src) => ({ type: "image" as const, src }));
  const current = mediaItems[selectedIndex] ?? mediaItems[0];
  const safeBonusPoints =
    Number.isFinite(Number(bonusPoints)) && Number(bonusPoints) > 0
      ? Math.floor(Number(bonusPoints))
      : 0;

  return (
    <div className="space-y-4">
      {videoUrl && (
        <ProductVideoModal
          open={videoOpen}
          videoUrl={videoUrl}
          productName={productName}
          onClose={() => setVideoOpen(false)}
        />
      )}
      <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-[#1a1a1a]">
        <Image
          src={current?.src ?? images[0] ?? ""}
          alt={productName}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized={isRemoteImageUrl(current?.src ?? "")}
          className="object-cover"
        />
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-ink">
            {badge}
          </span>
        )}
        {safeBonusPoints > 0 && (
          <span className="pill-cartoon absolute bottom-3 left-3 border-[#1a1a1a] bg-yellow px-3 py-1 text-xs font-bold text-ink">
            +{safeBonusPoints} pts {"\u2605"}
          </span>
        )}
      </div>

      {mediaItems.length > 1 && (
        <div className="flex gap-2 overflow-x-auto justify-center">
          {mediaItems.map((item, idx) => (
            <button
              key={item.src}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                idx === selectedIndex
                  ? "border-[#d35400] ring-2 ring-[#d35400]"
                  : "border-[#1a1a1a] hover:border-[#d35400]"
              }`}
            >
              <Image
                src={item.src}
                alt={`${productName} — vue ${idx + 1}`}
                fill
                sizes="80px"
                unoptimized={isRemoteImageUrl(item.src)}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {videoUrl && (
        <button
          type="button"
          onClick={() => setVideoOpen(true)}
          className="btn-cartoon btn-primary mt-1 inline-flex w-full items-center justify-center gap-2"
        >
          <span aria-hidden="true">▶</span>
          Regarder en vidéo
        </button>
      )}
    </div>
  );
}
