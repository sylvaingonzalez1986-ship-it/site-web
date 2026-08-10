"use client";

import { useMemo, useState } from "react";
import { ProducerCarousel } from "@/components/boutique/ProducerCarousel";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import { ProducerTcgModal } from "@/components/boutique/ProducerTcgModal";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import type { Producer } from "@/types/store";

type ProducerTcgShowcaseProps = {
  producers: Producer[];
  products: Product[];
  productsByProducerId?: Map<string, Product[]>;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId?: Record<string, PublicContestProductTastingSummary>;
  className?: string;
};

export function ProducerTcgShowcase({
  producers,
  products,
  productsByProducerId: productsByProducerIdOverride,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  tastingSummariesByProductId = {},
  className = "",
}: ProducerTcgShowcaseProps) {
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);

  const groupedProductsByProducerId = useMemo(() => {
    const grouped = new Map<string, Product[]>();

    for (const product of products) {
      if (!product.producerId) {
        continue;
      }

      const list = grouped.get(product.producerId) ?? [];
      list.push(product);
      grouped.set(product.producerId, list);
    }

    return grouped;
  }, [products]);

  const productsByProducerId = productsByProducerIdOverride ?? groupedProductsByProducerId;

  if (producers.length === 0) {
    return null;
  }

  const needsLoop = producers.length > 4;

  return (
    <div className={className}>
      <ProducerCarousel itemCount={producers.length} loop={needsLoop}>
        {producers.map((producer) => (
          <ProducerTcgCard
            key={producer.id}
            producer={producer}
            isSelected={selectedProducerId === producer.id}
            onClick={() =>
              setSelectedProducerId((current) => (current === producer.id ? null : producer.id))
            }
          />
        ))}
        {needsLoop &&
          producers.map((producer) => (
            <ProducerTcgCard
              key={`clone-${producer.id}`}
              producer={producer}
              isSelected={selectedProducerId === producer.id}
              onClick={() =>
                setSelectedProducerId((current) => (current === producer.id ? null : producer.id))
              }
            />
          ))}
      </ProducerCarousel>

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
        onSelectProducer={setSelectedProducerId}
      />
    </div>
  );
}
