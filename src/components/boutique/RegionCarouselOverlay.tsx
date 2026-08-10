"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import { ProducerTcgModal } from "@/components/boutique/ProducerTcgModal";
import { FRENCH_REGION_LABELS, type FrenchRegion } from "@/data/france-geo";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import type { Producer } from "@/types/store";

type RegionCarouselOverlayProps = {
  open: boolean;
  region: FrenchRegion;
  producers: Producer[];
  productsByProducerId: Map<string, Product[]>;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId: Record<string, PublicContestProductTastingSummary>;
  onClose: () => void;
};

export function RegionCarouselOverlay({
  open,
  region,
  producers,
  productsByProducerId,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  tastingSummariesByProductId,
  onClose,
}: RegionCarouselOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scrollSettleTimeoutRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);

  useBodyScrollLock(open);

  const producerCount = producers.length;
  const visibleIndex =
    producerCount === 0 ? 0 : Math.min(activeIndex, producerCount - 1);
  const canGoPrevious = visibleIndex > 0;
  const canGoNext = visibleIndex < producerCount - 1;

  const syncViewportToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      viewport.scrollTo({
        left: viewport.clientWidth * index,
        behavior,
      });
    },
    [],
  );

  const goToIndex = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(producerCount - 1, index));
      setActiveIndex(clampedIndex);
      syncViewportToIndex(clampedIndex);
    },
    [producerCount, syncViewportToIndex],
  );

  const goToPrevious = useCallback(() => {
    if (!canGoPrevious || producerCount === 0) {
      return;
    }

    goToIndex(visibleIndex - 1);
  }, [canGoPrevious, goToIndex, producerCount, visibleIndex]);

  const goToNext = useCallback(() => {
    if (!canGoNext || producerCount === 0) {
      return;
    }

    goToIndex(visibleIndex + 1);
  }, [canGoNext, goToIndex, producerCount, visibleIndex]);

  const handleSelectProducer = useCallback((producerId: string) => {
    if (Date.now() < suppressClickUntilRef.current) {
      return;
    }

    setSelectedProducerId(producerId);
    const nextIndex = producers.findIndex((producer) => producer.id === producerId);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
    }
  }, [producers]);

  useEffect(() => {
    if (!open) {
      return;
    }

    syncViewportToIndex(0, "auto");
  }, [open, syncViewportToIndex]);

  const handleViewportScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    suppressClickUntilRef.current = Date.now() + 160;

    if (scrollSettleTimeoutRef.current !== null) {
      window.clearTimeout(scrollSettleTimeoutRef.current);
    }

    scrollSettleTimeoutRef.current = window.setTimeout(() => {
      scrollSettleTimeoutRef.current = null;
      const nextIndex = Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth));
      const clampedIndex = Math.max(0, Math.min(producerCount - 1, nextIndex));
      setActiveIndex((current) => (current === clampedIndex ? current : clampedIndex));
    }, 90);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedProducerId !== null) {
          setSelectedProducerId(null);
          return;
        }

        onClose();
        return;
      }

      if (selectedProducerId !== null) {
        return;
      }

      if (event.key === "ArrowLeft") {
        goToPrevious();
        return;
      }

      if (event.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goToNext, goToPrevious, onClose, open, selectedProducerId, producers.length]);

  useEffect(() => {
    return () => {
      if (scrollSettleTimeoutRef.current !== null) {
        window.clearTimeout(scrollSettleTimeoutRef.current);
      }
    };
  }, []);

  if (!open) {
    return null;
  }

  const regionLabel = FRENCH_REGION_LABELS[region];
  return (
    <>
      <div
        className="region-carousel-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={`Producteurs en ${regionLabel}`}
        onClick={onClose}
      >
        <div className="region-carousel-overlay__backdrop" aria-hidden="true" />
        <div className="region-carousel-overlay__stage" onClick={(event) => event.stopPropagation()}>
          <button
            ref={closeButtonRef}
            type="button"
            className="region-carousel-overlay__close"
            onClick={onClose}
            aria-label={`Fermer la selection ${regionLabel}`}
          >
            <X size={18} strokeWidth={2.4} />
          </button>

          <div className="region-carousel-overlay__header">
            <p className="region-carousel-overlay__title">{regionLabel}</p>
            <p className="region-carousel-overlay__count">
              {producerCount} producteur{producerCount > 1 ? "s" : ""}
            </p>
          </div>

          {producerCount === 0 ? (
            <p className="region-carousel-overlay__empty">
              Aucun producteur ici pour le moment...
            </p>
          ) : (
            <div className="region-carousel-overlay__showcase">
              <div className="region-carousel-overlay__card-shell">
                <button
                  type="button"
                  className="region-carousel-overlay__nav region-carousel-overlay__nav--left"
                  onClick={goToPrevious}
                  disabled={!canGoPrevious}
                  aria-label="Producteur precedent"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>

                <div
                  ref={viewportRef}
                  className="region-carousel-overlay__viewport"
                  onScroll={handleViewportScroll}
                >
                  <div className="region-carousel-overlay__track">
                    {producers.map((producer) => (
                      <div key={producer.id} className="region-carousel-overlay__slide">
                        <ProducerTcgCard
                          producer={producer}
                          isSelected={selectedProducerId === producer.id}
                          onClick={() => handleSelectProducer(producer.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="region-carousel-overlay__nav region-carousel-overlay__nav--right"
                  onClick={goToNext}
                  disabled={!canGoNext}
                  aria-label="Producteur suivant"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>

              <p className="region-carousel-overlay__index">
                {visibleIndex + 1} / {producerCount}
              </p>
            </div>
          )}
        </div>
      </div>

      <ProducerTcgModal
        open={selectedProducerId !== null}
        producers={producers}
        selectedProducerId={selectedProducerId}
        productsByProducerId={productsByProducerId}
        addButtonLabel={addButtonLabel}
        lowStockThresholdGrams={lowStockThresholdGrams}
        producerPartnerLabel={producerPartnerLabel}
        producerWebsiteLabel={producerWebsiteLabel}
        tastingSummariesByProductId={tastingSummariesByProductId}
        onClose={() => setSelectedProducerId(null)}
        onSelectProducer={handleSelectProducer}
      />
    </>
  );
}
