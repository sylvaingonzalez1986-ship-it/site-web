"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ShopCardOrigin } from "@/components/ProductCard";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import { ProducerTcgModal } from "@/components/boutique/ProducerTcgModal";
import { restoreShopPanelBeforePaint } from "@/components/boutique/ShopResultsRestore";
import { REGION_RESULTS_ID } from "@/components/boutique/ShopResultsRestore";
import { FRENCH_REGION_LABELS, type FrenchRegion } from "@/data/france-geo";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import type { Producer } from "@/types/store";

type RegionCarouselOverlayProps = {
  origin: ShopCardOrigin;
  region: FrenchRegion;
  producers: Producer[];
  selectedProducerId: string | null;
  onSelectProducer: (producerId: string | null) => void;
  productGrid: ReactNode;
  productsShortcut: ReactNode;
  productsByProducerId: Map<string, Product[]>;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId: Record<string, PublicContestProductTastingSummary>;
  onClose: () => void;
};

export function RegionCarouselOverlay({
  origin,
  region,
  producers,
  selectedProducerId: requestedProducerId,
  onSelectProducer,
  productGrid,
  productsShortcut,
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
  const selectedIndex = producers.findIndex(producer => producer.id === requestedProducerId);
  const selectedProducerId = selectedIndex >= 0 ? requestedProducerId : null;
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));

  useBodyScrollLock(true);

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

    onSelectProducer(producerId);
    const nextIndex = producers.findIndex((producer) => producer.id === producerId);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
    }
  }, [onSelectProducer, producers]);

  useEffect(() => {
    if (selectedIndex >= 0) syncViewportToIndex(selectedIndex, "auto");
  }, [selectedIndex, syncViewportToIndex]);

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

  useLayoutEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
    restoreShopPanelBeforePaint();
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || selectedProducerId !== null) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!(event.target instanceof Element) || !event.target.closest(".region-carousel-overlay__showcase")) return;

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
  }, [goToNext, goToPrevious, onClose, selectedProducerId]);

  useEffect(() => {
    return () => {
      if (scrollSettleTimeoutRef.current !== null) {
        window.clearTimeout(scrollSettleTimeoutRef.current);
      }
    };
  }, []);

  const regionLabel = FRENCH_REGION_LABELS[region];
  return (
    <>
      <div
        className="region-carousel-overlay"
        data-shop-scroll-container
        role="dialog"
        aria-modal="true"
        aria-label={`Producteurs en ${regionLabel}`}
        onClick={onClose}
        onKeyDown={event => {
          if (event.key !== "Tab" || event.defaultPrevented) return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex='0']",
          )).filter(control => control.getClientRects().length && control.tabIndex >= 0);
          const first = controls[0];
          const last = controls.at(-1);
          const target = event.shiftKey && event.target === first ? last : !event.shiftKey && event.target === last ? first : undefined;
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
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
            <h3 id={productGrid ? undefined : REGION_RESULTS_ID} data-shop-panel-results tabIndex={-1} className="region-carousel-overlay__title">{regionLabel}</h3>
            <p className="region-carousel-overlay__count">
              {producerCount} producteur{producerCount > 1 ? "s" : ""}
            </p>
          </div>
          {productsShortcut}

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
          {productGrid || (producerCount > 0 && (
            <p className="region-carousel-overlay__empty">Aucun produit dans cette région actuellement.</p>
          ))}
        </div>
      </div>

      <ProducerTcgModal
        origin={origin}
        open={selectedProducerId !== null}
        producers={producers}
        selectedProducerId={selectedProducerId}
        productsByProducerId={productsByProducerId}
        addButtonLabel={addButtonLabel}
        lowStockThresholdGrams={lowStockThresholdGrams}
        producerPartnerLabel={producerPartnerLabel}
        producerWebsiteLabel={producerWebsiteLabel}
        tastingSummariesByProductId={tastingSummariesByProductId}
        onClose={() => onSelectProducer(null)}
        onSelectProducer={onSelectProducer}
      />
    </>
  );
}
