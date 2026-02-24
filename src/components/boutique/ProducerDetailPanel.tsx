"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/data/products";
import { isRemoteImageUrl } from "@/lib/image-source";
import type { Producer } from "@/types/store";

type ProducerDetailPanelProps = {
  producer: Producer;
  products: Product[];
  addButtonLabel: string;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  onOpenQuickView?: (productId: string, sourceProducts: Product[]) => void;
  onClose: () => void;
};

export function ProducerDetailPanel({
  producer,
  products,
  addButtonLabel,
  producerPartnerLabel,
  producerWebsiteLabel,
  onOpenQuickView,
  onClose,
}: ProducerDetailPanelProps) {
  const producerLocation =
    [producer.department, producer.region].filter(Boolean).join(", ") ||
    producer.location;

  return (
    <section
      id={`producer-panel-${producer.id}`}
      className="producer-detail-enter cartoon-border mx-auto mt-6 bg-cream p-6 md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border-2 border-[#1a1a1a] bg-white md:h-28 md:w-28">
            <Image
              src={producer.image}
              alt={producer.name}
              fill
              sizes="112px"
              unoptimized={isRemoteImageUrl(producer.image)}
              className="object-cover"
            />
          </div>
          <div>
            <p className="pill-cartoon bg-yellow px-3 py-1 text-xs uppercase tracking-[0.12em]">
              {producerPartnerLabel}
            </p>
            <h3 className="mt-2 font-display text-3xl leading-none text-ink md:text-4xl">
              {producer.name}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-charcoal">
              {producer.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="pill-cartoon bg-white px-3 py-1 text-xs text-ink">
                {producerLocation}
              </span>
              {producer.website && (
                <a
                  href={producer.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-cartoon btn-secondary px-3 py-1 text-xs"
                >
                  {producerWebsiteLabel}
                </a>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0"
          aria-label="Fermer la fiche producteur"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            producer={producer}
            addButtonLabel={addButtonLabel}
            onOpenQuickView={
              onOpenQuickView
                ? () => onOpenQuickView(product.id, products)
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
