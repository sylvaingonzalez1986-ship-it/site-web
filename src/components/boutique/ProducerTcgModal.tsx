"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ProducerDetailPanel } from "@/components/boutique/ProducerDetailPanel";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { Product } from "@/data/products";
import type { Producer } from "@/types/store";

type ProducerTcgModalProps = {
  open: boolean;
  producers: Producer[];
  selectedProducerId: string | null;
  productsByProducerId: Map<string, Product[]>;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  onClose: () => void;
  onSelectProducer: (producerId: string) => void;
};

export function ProducerTcgModal({
  open,
  producers,
  selectedProducerId,
  productsByProducerId,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  onClose,
  onSelectProducer,
}: ProducerTcgModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useBodyScrollLock(open);

  const selectedIndex = useMemo(() => {
    if (!selectedProducerId) {
      return -1;
    }
    return producers.findIndex((producer) => producer.id === selectedProducerId);
  }, [producers, selectedProducerId]);

  const selectedProducer = selectedIndex >= 0 ? producers[selectedIndex] : null;
  const selectedProducts = selectedProducer
    ? productsByProducerId.get(selectedProducer.id) ?? []
    : [];

  const goToPrevious = useCallback(() => {
    if (selectedIndex < 0 || producers.length === 0) {
      return;
    }
    const previousIndex = (selectedIndex - 1 + producers.length) % producers.length;
    onSelectProducer(producers[previousIndex].id);
  }, [onSelectProducer, producers, selectedIndex]);

  const goToNext = useCallback(() => {
    if (selectedIndex < 0 || producers.length === 0) {
      return;
    }
    const nextIndex = (selectedIndex + 1) % producers.length;
    onSelectProducer(producers[nextIndex].id);
  }, [onSelectProducer, producers, selectedIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
  }, [goToNext, goToPrevious, onClose, open]);

  if (!open || !selectedProducer || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="producer-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche producteur ${selectedProducer.name}`}
      onClick={onClose}
    >
      <div
        className="producer-modal-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="producer-modal-controls"
          onTouchStart={(event) => {
            touchStartXRef.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartXRef.current === null) {
              return;
            }

            const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
            const diffX = endX - touchStartXRef.current;
            touchStartXRef.current = null;

            if (Math.abs(diffX) < 50) {
              return;
            }

            if (diffX > 0) {
              goToPrevious();
            } else {
              goToNext();
            }
          }}
        >
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={goToPrevious}
            aria-label="Producteur precedent"
          >
            {"<"}
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
            {selectedIndex + 1} / {producers.length}
          </p>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={goToNext}
            aria-label="Producteur suivant"
          >
            {">"}
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className="producer-modal-close btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={onClose}
            aria-label="Fermer la fiche producteur"
          >
            ×
          </button>
        </div>

        <div className="producer-modal-content">
          <ProducerDetailPanel
            producer={selectedProducer}
            products={selectedProducts}
            addButtonLabel={addButtonLabel}
            lowStockThresholdGrams={lowStockThresholdGrams}
            producerPartnerLabel={producerPartnerLabel}
            producerWebsiteLabel={producerWebsiteLabel}
            onClose={onClose}
            showCloseButton={false}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
