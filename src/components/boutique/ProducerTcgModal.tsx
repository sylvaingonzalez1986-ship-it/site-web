"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  onOpenQuickView?: (productId: string, sourceProducts: Product[]) => void;
  onClose: () => void;
  onSelectProducer: (producerId: string) => void;
};

export function ProducerTcgModal({
  open,
  producers,
  selectedProducerId,
  productsByProducerId,
  addButtonLabel,
  producerPartnerLabel,
  producerWebsiteLabel,
  onOpenQuickView,
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

  const goToPrevious = () => {
    if (selectedIndex < 0 || producers.length === 0) {
      return;
    }
    const previousIndex = (selectedIndex - 1 + producers.length) % producers.length;
    onSelectProducer(producers[previousIndex].id);
  };

  const goToNext = () => {
    if (selectedIndex < 0 || producers.length === 0) {
      return;
    }
    const nextIndex = (selectedIndex + 1) % producers.length;
    onSelectProducer(producers[nextIndex].id);
  };

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
  }, [open, onClose, selectedIndex, producers]);

  if (!open || !selectedProducer) {
    return null;
  }

  return (
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
        <div className="producer-modal-controls">
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0"
            onClick={goToPrevious}
            aria-label="Producteur précédent"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
            {selectedIndex + 1} / {producers.length}
          </p>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0"
            onClick={goToNext}
            aria-label="Producteur suivant"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          className="producer-modal-close btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0"
          onClick={onClose}
          aria-label="Fermer la fiche producteur"
        >
          <X size={18} />
        </button>

        <div className="producer-modal-content">
          <ProducerDetailPanel
            producer={selectedProducer}
            products={selectedProducts}
            addButtonLabel={addButtonLabel}
            producerPartnerLabel={producerPartnerLabel}
            producerWebsiteLabel={producerWebsiteLabel}
            onOpenQuickView={onOpenQuickView}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
