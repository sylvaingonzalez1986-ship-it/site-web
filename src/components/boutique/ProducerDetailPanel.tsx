"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/data/products";
import { isRemoteImageUrl } from "@/lib/image-source";
import { PRODUCER_CULTURE_LABELS, type Producer } from "@/types/store";

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
  const cultureTypes = producer.cultureType ?? [];
  const certifications = producer.certifications ?? [];
  const longDescription = producer.philosophy?.trim() || producer.description;

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
            {cultureTypes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {cultureTypes.map((cultureType) => (
                  <span
                    key={cultureType}
                    className="pill-cartoon bg-white px-3 py-1 text-xs uppercase tracking-[0.08em] text-ink"
                  >
                    {PRODUCER_CULTURE_LABELS[cultureType]}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-charcoal">
              {longDescription}
            </p>
            <div className="mt-3 grid gap-2 text-xs text-charcoal md:grid-cols-2">
              {(producer.climate || producer.soil || producer.altitude || producer.speciality) && (
                <>
                  <p>
                    <span className="font-semibold text-ink">Climat :</span> {producer.climate || "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Sol :</span> {producer.soil || "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Altitude :</span> {producer.altitude || "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Spécialité :</span> {producer.speciality || "—"}
                  </p>
                </>
              )}
            </div>
            {certifications.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {certifications.map((certification) => (
                  <span
                    key={certification}
                    className="pill-cartoon bg-yellow px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink"
                  >
                    {certification}
                  </span>
                ))}
              </div>
            )}
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
