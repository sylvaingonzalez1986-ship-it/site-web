"use client";

import { useMemo, type ReactNode } from "react";
import { ProductCard, type ShopCardOrigin } from "@/components/ProductCard";
import { ProducerTcgShowcase } from "@/components/boutique/ProducerTcgShowcase";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import type { Producer } from "@/types/store";

type ProducerBarProps = {
  producers: Producer[];
  products: Product[];
  rotationDay: number;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId: Record<string, PublicContestProductTastingSummary>;
  resultsHeading: ReactNode;
  origin: ShopCardOrigin;
  selectedProducerId: string | null;
  onSelectProducer: (producerId: string | null) => void;
};

export function ProducerBar({
  producers,
  products,
  rotationDay,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  tastingSummariesByProductId,
  resultsHeading,
  origin,
  selectedProducerId,
  onSelectProducer,
}: ProducerBarProps) {
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

  return (
    <div className="mt-6">
      <ProducerTcgShowcase
        origin={origin}
        selectedProducerId={selectedProducerId}
        onSelectProducer={onSelectProducer}
        producers={producersWithProducts}
        products={products}
        rotationDay={rotationDay}
        addButtonLabel={addButtonLabel}
        lowStockThresholdGrams={lowStockThresholdGrams}
        producerPartnerLabel={producerPartnerLabel}
        producerWebsiteLabel={producerWebsiteLabel}
        tastingSummariesByProductId={tastingSummariesByProductId}
      />

      {resultsHeading}
      <div data-shop-list-view="market" className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            origin={origin}
            producer={product.producerId ? producerById.get(product.producerId) : undefined}
            addButtonLabel={addButtonLabel}
            lowStockThresholdGrams={lowStockThresholdGrams}
            tastingSummary={tastingSummariesByProductId[product.id]}
          />
        ))}
      </div>
    </div>
  );
}
