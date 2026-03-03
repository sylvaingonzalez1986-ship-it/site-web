"use client";

import Image from "next/image";
import { useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { isRemoteImageUrl } from "@/lib/image-source";

type ProductImageCarouselProps = {
  images: string[];
  alt: string;
  badge?: string;
  bonusPoints?: number;
  promoText?: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
};

const SWIPE_THRESHOLD_PX = 50;
const MAX_DRAG_OFFSET_PX = 96;
const FALLBACK_IMAGE_SRC = "/product_flower.jpg";

export function ProductImageCarousel({
  images,
  alt,
  badge,
  bonusPoints,
  promoText,
  priority = false,
  className = "",
  sizes = "(max-width: 768px) 94vw, 33vw",
}: ProductImageCarouselProps) {
  const sanitizedImages = useMemo(() => {
    const seen = new Set<string>();
    const next: string[] = [];

    for (const image of images) {
      const value = image?.trim();
      if (!value || seen.has(value)) {
        continue;
      }
      seen.add(value);
      next.push(value);
    }

    return next.length > 0 ? next : ["/product_flower.jpg"];
  }, [images]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [failedRemoteImages, setFailedRemoteImages] = useState<Set<string>>(new Set());
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const hasMultipleImages = sanitizedImages.length > 1;
  const safeBonusPoints =
    Number.isFinite(Number(bonusPoints)) && Number(bonusPoints) > 0
      ? Math.floor(Number(bonusPoints))
      : 0;

  const activeIndex = Math.max(0, Math.min(currentIndex, sanitizedImages.length - 1));

  const goToIndex = (nextIndex: number) => {
    if (!hasMultipleImages) {
      return;
    }
    const bounded = Math.max(0, Math.min(sanitizedImages.length - 1, nextIndex));
    setCurrentIndex(bounded);
  };

  const goPrev = () => goToIndex(activeIndex - 1);
  const goNext = () => goToIndex(activeIndex + 1);

  const resetSwipe = () => {
    setIsSwiping(false);
    setDragOffset(0);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!hasMultipleImages) {
      return;
    }
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    setIsSwiping(false);
    setDragOffset(0);
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!hasMultipleImages || touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (!isSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    setIsSwiping(true);
    setDragOffset(Math.max(-MAX_DRAG_OFFSET_PX, Math.min(MAX_DRAG_OFFSET_PX, deltaX)));
  };

  const onTouchEnd = () => {
    if (!hasMultipleImages) {
      return;
    }

    if (isSwiping) {
      if (dragOffset <= -SWIPE_THRESHOLD_PX) {
        goNext();
      } else if (dragOffset >= SWIPE_THRESHOLD_PX) {
        goPrev();
      }
    }

    resetSwipe();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!hasMultipleImages) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  };

  const trackTransform = `translate3d(calc(${-activeIndex * 100}% + ${dragOffset}px), 0, 0)`;

  return (
    <div
      className={`product-carousel group/product-carousel relative aspect-square overflow-hidden ${className}`}
      role={hasMultipleImages ? "group" : undefined}
      aria-roledescription={hasMultipleImages ? "Carrousel" : undefined}
      aria-label={hasMultipleImages ? `Images de ${alt}` : undefined}
      tabIndex={hasMultipleImages ? 0 : undefined}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={resetSwipe}
    >
      <div
        className={`product-carousel-track ${isSwiping ? "swiping" : ""}`}
        style={{ transform: trackTransform }}
      >
        {sanitizedImages.map((image, index) => (
          <div key={`${image}-${index}`} className="relative min-w-full">
            {(() => {
              const shouldPrioritizeFrame = priority && index === 0;
              const imageSrc = failedRemoteImages.has(image) ? FALLBACK_IMAGE_SRC : image;

              if (isRemoteImageUrl(imageSrc)) {
                return (
                  <img
                    src={imageSrc}
                    alt={hasMultipleImages ? `${alt} - photo ${index + 1}` : alt}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/product-carousel:scale-105"
                    loading={shouldPrioritizeFrame ? "eager" : "lazy"}
                    fetchPriority={shouldPrioritizeFrame ? "high" : "auto"}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      setFailedRemoteImages((current) => {
                        if (current.has(image)) {
                          return current;
                        }
                        const next = new Set(current);
                        next.add(image);
                        return next;
                      });
                    }}
                  />
                );
              }

              return (
                <Image
                  src={imageSrc}
                  alt={hasMultipleImages ? `${alt} - photo ${index + 1}` : alt}
                  fill
                  sizes={sizes}
                  priority={shouldPrioritizeFrame}
                  className="object-cover transition-transform duration-300 group-hover/product-carousel:scale-105"
                  onError={() => {
                    setFailedRemoteImages((current) => {
                      if (current.has(image)) {
                        return current;
                      }
                      const next = new Set(current);
                      next.add(image);
                      return next;
                    });
                  }}
                />
              );
            })()}
          </div>
        ))}
      </div>

      {badge && (
        <span className="absolute left-3 top-3 z-10 border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-1 text-xs font-bold uppercase tracking-wide">
          {badge}
        </span>
      )}
      {promoText && (
        <span className="promo-banner absolute right-3 top-3 z-10 px-3 py-1 text-xs">
          {promoText}
        </span>
      )}
      {safeBonusPoints > 0 && (
        <span className="pill-cartoon absolute bottom-3 left-3 z-10 border-[#1a1a1a] bg-yellow px-3 py-1 text-xs font-bold text-ink">
          +{safeBonusPoints} pts {"\u2605"}
        </span>
      )}

      {hasMultipleImages && activeIndex > 0 && (
        <button
          type="button"
          className="product-carousel-arrow product-carousel-arrow--left text-xl font-bold leading-none"
          onClick={(event) => {
            event.stopPropagation();
            goPrev();
          }}
          aria-label="Photo precedente"
        >
          ‹
        </button>
      )}

      {hasMultipleImages && activeIndex < sanitizedImages.length - 1 && (
        <button
          type="button"
          className="product-carousel-arrow product-carousel-arrow--right text-xl font-bold leading-none"
          onClick={(event) => {
            event.stopPropagation();
            goNext();
          }}
          aria-label="Photo suivante"
        >
          ›
        </button>
      )}

      {hasMultipleImages && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
          {sanitizedImages.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              className="product-carousel-dot-btn"
              onClick={(event) => {
                event.stopPropagation();
                goToIndex(index);
              }}
              aria-label={`Afficher photo ${index + 1}`}
              aria-current={index === activeIndex ? "true" : "false"}
            >
              <span
                className={`product-carousel-dot ${index === activeIndex ? "product-carousel-dot--active" : ""}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
