"use client";

import { useState } from "react";
import Image from "next/image";
import { ProductVideoModal } from "./ProductVideoModal";
import styles from "./ProductImageGallery.module.css";

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
  const currentSrc = current?.src ?? images[0] ?? "";
  const safeBonusPoints =
    Number.isFinite(Number(bonusPoints)) && Number(bonusPoints) > 0
      ? Math.floor(Number(bonusPoints))
      : 0;

  return (
    <div className={styles.gallery}>
      {videoUrl && (
        <ProductVideoModal
          open={videoOpen}
          videoUrl={videoUrl}
          productName={productName}
          onClose={() => setVideoOpen(false)}
        />
      )}
      <div className={styles.main}>
        <Image
          src={currentSrc}
          alt={productName}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        {badge && (
          <span className={styles.badge}>
            {badge}
          </span>
        )}
        {safeBonusPoints > 0 && (
          <span className={styles.points}>
            +{safeBonusPoints} pts {"\u2605"}
          </span>
        )}
      </div>

      {mediaItems.length > 1 && (
        <div className={styles.thumbs}>
          {mediaItems.map((item, idx) => (
            <button
              key={item.src}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`${styles.thumb} ${idx === selectedIndex ? styles.thumbActive : ""}`}
            >
              <Image
                src={item.src}
                alt={`${productName} - vue ${idx + 1}`}
                fill
                sizes="80px"
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
          Regarder en video
        </button>
      )}
    </div>
  );
}
