"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ProducerTcgModal } from "@/components/boutique/ProducerTcgModal";
import { ProducerTcgCard } from "@/components/boutique/ProducerTcgCard";
import { ProducerCarousel } from "@/components/boutique/ProducerCarousel";
import type { Product } from "@/data/products";
import type { Producer } from "@/types/store";

type ProducerBarProps = {
  producers: Producer[];
  products: Product[];
  addButtonLabel: string;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  onOpenQuickView?: (productId: string, sourceProducts: Product[]) => void;
};

export function ProducerBar({
  producers,
  products,
  addButtonLabel,
  producerPartnerLabel,
  producerWebsiteLabel,
  onOpenQuickView,
}: ProducerBarProps) {
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);

  const producerById = useMemo(
    () => new Map(producers.map((producer) => [producer.id, producer])),
    [producers],
  );

  const productsByProducerId = useMemo(() => {
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

  const producersWithProducts = useMemo(
    () => producers.filter((producer) => productsByProducerId.has(producer.id)),
    [producers, productsByProducerId],
  );

  const onBadgeClick = (producerId: string) => {
    setSelectedProducerId((current) => (current === producerId ? null : producerId));
  };

  if (producersWithProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <ProducerCarousel itemCount={producersWithProducts.length}>
        {/* Real items */}
        {producersWithProducts.map((producer) => (
          <ProducerTcgCard
            key={producer.id}
            producer={producer}
            isSelected={selectedProducerId === producer.id}
            onClick={() => onBadgeClick(producer.id)}
          />
        ))}
        {/* Cloned items for infinite loop on desktop */}
        {producersWithProducts.map((producer) => (
          <ProducerTcgCard
            key={`clone-${producer.id}`}
            producer={producer}
            isSelected={selectedProducerId === producer.id}
            onClick={() => onBadgeClick(producer.id)}
          />
        ))}
      </ProducerCarousel>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            producer={
              product.producerId ? producerById.get(product.producerId) : undefined
            }
            addButtonLabel={addButtonLabel}
            onOpenQuickView={
              onOpenQuickView
                ? () => onOpenQuickView(product.id, products)
                : undefined
            }
          />
        ))}
      </div>

      <ProducerTcgModal
        open={selectedProducerId !== null}
        producers={producersWithProducts}
        selectedProducerId={selectedProducerId}
        productsByProducerId={productsByProducerId}
        addButtonLabel={addButtonLabel}
        producerPartnerLabel={producerPartnerLabel}
        producerWebsiteLabel={producerWebsiteLabel}
        onOpenQuickView={onOpenQuickView}
        onClose={() => setSelectedProducerId(null)}
        onSelectProducer={setSelectedProducerId}
      />
    </div>
  );
}
