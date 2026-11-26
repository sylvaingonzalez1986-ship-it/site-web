"use client";

import { useMemo } from "react";
import type { ShopCardOrigin } from "@/components/ProductCard";
import { ProducerCarousel } from "@/components/boutique/ProducerCarousel";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import { ProducerTcgModal } from "@/components/boutique/ProducerTcgModal";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import { rotateProductsForDay } from "@/lib/product-rotation";
import type { Producer } from "@/types/store";

type ProducerTcgShowcaseProps = {
  producers: Producer[];
  products: Product[];
  rotationDay: number;
  productsByProducerId?: Map<string, Product[]>;
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  tastingSummariesByProductId?: Record<string, PublicContestProductTastingSummary>;
  className?: string;
  origin: ShopCardOrigin;
  selectedProducerId: string | null;
  onSelectProducer: (producerId: string | null) => void;
};

export function ProducerTcgShowcase({
  producers,
  products,
  rotationDay,
  productsByProducerId: productsByProducerIdOverride,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  tastingSummariesByProductId = {},
  className = "",
  origin,
  selectedProducerId,
  onSelectProducer,
}: ProducerTcgShowcaseProps) {

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

    for (const [producerId, producerProducts] of grouped) {
      grouped.set(
        producerId,
        rotateProductsForDay(producerProducts, rotationDay, `producer:${producerId}`),
      );
    }

    return grouped;
  }, [products, rotationDay]);

  const productsByProducerId = productsByProducerIdOverride ?? groupedProductsByProducerId;

  if (producers.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <ProducerCarousel itemCount={producers.length}>
        {producers.map((producer) => (
          <ProducerTcgCard
            key={producer.id}
            producer={producer}
            isSelected={selectedProducerId === producer.id}
            onClick={() => onSelectProducer(producer.id)}
          />
        ))}
      </ProducerCarousel>

      <ProducerTcgModal
        origin={origin.surface === "region" ? origin : { ...origin, surface: "producer" }}
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
    </div>
  );
}
