"use client";

import { useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ProducerTcgShowcase } from "@/components/boutique/ProducerTcgShowcase";
import type { Product } from "@/data/products";
import type { Producer } from "@/types/store";

type ProducerBarProps = {
  producers: Producer[];
  products: Product[];
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
};

export function ProducerBar({
  producers,
  products,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
}: ProducerBarProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const producerById = useMemo(
    () => new Map(producers.map((producer) => [producer.id, producer])),
    [producers],
  );

  const producersWithProducts = useMemo(() => {
    const availableProducerIds = new Set(
      products
        .map((product) => product.producerId)
        .filter((producerId): producerId is string => Boolean(producerId)),
    );

    return producers.filter((producer) => availableProducerIds.has(producer.id));
  }, [producers, products]);

  if (producersWithProducts.length === 0) {
    return null;
  }

  const goToSlide = (index: number) => {
    const viewport = carouselRef.current;
    if (!viewport) return;

    const nextIndex = Math.max(0, Math.min(index, products.length - 1));
    const slide = viewport.children.item(nextIndex) as HTMLElement | null;
    if (!slide) return;

    viewport.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    setCurrentSlide(nextIndex);
  };

  const syncSlide = () => {
    const viewport = carouselRef.current;
    if (!viewport || viewport.children.length === 0) return;

    const slides = Array.from(viewport.children) as HTMLElement[];
    const closestIndex = slides.reduce((bestIndex, slide, index) =>
      Math.abs(slide.offsetLeft - viewport.scrollLeft) <
      Math.abs(slides[bestIndex].offsetLeft - viewport.scrollLeft)
        ? index
        : bestIndex, 0);
    setCurrentSlide(closestIndex);
  };

  return (
    <div className="mt-6">
      <ProducerTcgShowcase
        producers={producersWithProducts}
        products={products}
        addButtonLabel={addButtonLabel}
        lowStockThresholdGrams={lowStockThresholdGrams}
        producerPartnerLabel={producerPartnerLabel}
        producerWebsiteLabel={producerWebsiteLabel}
      />

      <div
        ref={carouselRef}
        onScroll={syncSlide}
        aria-label="Carrousel des produits partenaires"
        className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 pr-[12vw] touch-pan-x sm:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div key={product.id} className="min-w-[82vw] snap-start">
            <ProductCard
              product={product}
              producer={product.producerId ? producerById.get(product.producerId) : undefined}
              addButtonLabel={addButtonLabel}
              lowStockThresholdGrams={lowStockThresholdGrams}
            />
          </div>
        ))}
      </div>

      {products.length > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3 sm:hidden" aria-label="Navigation du carrousel">
          <button
            type="button"
            onClick={() => goToSlide(currentSlide - 1)}
            disabled={currentSlide === 0}
            aria-label="Produit précédent"
            className="btn-cartoon btn-secondary inline-flex h-11 w-11 items-center justify-center text-xl disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-charcoal" aria-live="polite">
            Produit {currentSlide + 1} sur {products.length}
          </span>
          <button
            type="button"
            onClick={() => goToSlide(currentSlide + 1)}
            disabled={currentSlide === products.length - 1}
            aria-label="Produit suivant"
            className="btn-cartoon btn-secondary inline-flex h-11 w-11 items-center justify-center text-xl disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      <div className="mt-6 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            producer={product.producerId ? producerById.get(product.producerId) : undefined}
            addButtonLabel={addButtonLabel}
            lowStockThresholdGrams={lowStockThresholdGrams}
          />
        ))}
      </div>
    </div>
  );
}
