"use client";

import { useMemo } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ProducerTcgShowcase } from "@/components/boutique/ProducerTcgShowcase";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import type { Producer } from "@/types/store";

type ProducerBarProps = {
  producers: Producer[];
  products: Product[];
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId: Record<string, PublicContestProductTastingSummary>;
};

export function ProducerBar({
  producers,
  products,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  tastingSummariesByProductId,
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
        producers={producersWithProducts}
        products={products}
        addButtonLabel={addButtonLabel}
        lowStockThresholdGrams={lowStockThresholdGrams}
        producerPartnerLabel={producerPartnerLabel}
        producerWebsiteLabel={producerWebsiteLabel}
        tastingSummariesByProductId={tastingSummariesByProductId}
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
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
