"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ProducerSocialLinks } from "@/components/boutique/ProducerSocialLinks";
import {
  PRODUCER_CLIMATE_DETAILS,
  PRODUCER_CLIMATE_OPTIONS,
  PRODUCER_SOIL_DETAILS,
  PRODUCER_SOIL_OPTIONS,
} from "@/data/producer-taxonomies";
import type { Product } from "@/data/products";
import { isRemoteImageUrl } from "@/lib/image-source";
import { PRODUCER_CULTURE_LABELS, type Producer } from "@/types/store";

type ProducerDetailPanelProps = {
  producer: Producer;
  products: Product[];
  addButtonLabel: string;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  onClose: () => void;
  showCloseButton?: boolean;
};

export function ProducerDetailPanel({
  producer,
  products,
  addButtonLabel,
  producerPartnerLabel,
  producerWebsiteLabel,
  onClose,
  showCloseButton = true,
}: ProducerDetailPanelProps) {
  const [openMobilePopover, setOpenMobilePopover] = useState<"climate" | "soil" | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setOpenMobilePopover(null);
        return;
      }

      if (target.closest("[data-producer-popover='trigger']") || target.closest("[data-producer-popover='content']")) {
        return;
      }

      setOpenMobilePopover(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const producerLocation =
    [producer.department, producer.region].filter(Boolean).join(", ") ||
    producer.location;
  const cultureTypes = producer.cultureType ?? [];
  const certifications = producer.certifications ?? [];
  const longDescription = producer.philosophy?.trim() || producer.description;
  const climateOption = PRODUCER_CLIMATE_OPTIONS.find(
    (option) => option.value === producer.climate,
  );
  const soilOption = PRODUCER_SOIL_OPTIONS.find(
    (option) => option.value === producer.soil,
  );
  const climateLabel = climateOption?.label ?? producer.climate ?? "—";
  const soilLabel = soilOption?.label ?? producer.soil ?? "—";
  const climateDetails = PRODUCER_CLIMATE_DETAILS[producer.climate] ?? [];
  const soilDetails = PRODUCER_SOIL_DETAILS[producer.soil] ?? [];

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
            <div className="producer-detail-description mt-3 w-full">
              {longDescription}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-charcoal sm:grid-cols-2">
              {(producer.climate || producer.soil) && (
                <>
                  <p className="producer-detail-metric">
                    <span className="font-semibold text-ink">Climat :</span>{" "}
                    {climateDetails.length > 0 ? (
                      <span className="group relative inline-flex items-center gap-1">
                        <span className="font-medium text-ink">{climateLabel}</span>
                        <button
                          type="button"
                          data-producer-popover="trigger"
                          onClick={() =>
                            setOpenMobilePopover((current) =>
                              current === "climate" ? null : "climate",
                            )
                          }
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#1a1a1a] text-[10px] leading-none text-ink md:hidden"
                          aria-label="Afficher le détail du climat"
                        >
                          i
                        </button>
                        <span
                          aria-hidden="true"
                          className="hidden h-4 w-4 cursor-help items-center justify-center rounded-full border border-[#1a1a1a] text-[10px] leading-none text-ink md:inline-flex"
                        >
                          i
                        </span>
                        <span className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 hidden w-80 max-w-[85vw] rounded-md border-2 border-[#1a1a1a] bg-cream p-3 text-xs text-charcoal shadow-[4px_4px_0_#1a1a1a] group-hover:block">
                          <span className="font-semibold text-ink">{climateLabel}</span>
                          <span className="mt-2 block space-y-1">
                            {climateDetails.map((detail) => (
                              <span key={detail} className="block">
                                • {detail}
                              </span>
                            ))}
                          </span>
                        </span>
                        {openMobilePopover === "climate" && (
                          <span
                            data-producer-popover="content"
                            className="absolute left-0 top-[calc(100%+6px)] z-20 w-80 max-w-[85vw] rounded-md border-2 border-[#1a1a1a] bg-cream p-3 text-xs text-charcoal shadow-[4px_4px_0_#1a1a1a] md:hidden"
                          >
                            <span className="font-semibold text-ink">{climateLabel}</span>
                            <span className="mt-2 block space-y-1">
                              {climateDetails.map((detail) => (
                                <span key={detail} className="block">
                                  • {detail}
                                </span>
                              ))}
                            </span>
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>{climateLabel}</span>
                    )}
                  </p>
                  <p className="producer-detail-metric">
                    <span className="font-semibold text-ink">Sol :</span>{" "}
                    {soilDetails.length > 0 ? (
                      <span className="group relative inline-flex items-center gap-1">
                        <span className="font-medium text-ink">{soilLabel}</span>
                        <button
                          type="button"
                          data-producer-popover="trigger"
                          onClick={() =>
                            setOpenMobilePopover((current) =>
                              current === "soil" ? null : "soil",
                            )
                          }
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#1a1a1a] text-[10px] leading-none text-ink md:hidden"
                          aria-label="Afficher le détail du sol"
                        >
                          i
                        </button>
                        <span
                          aria-hidden="true"
                          className="hidden h-4 w-4 cursor-help items-center justify-center rounded-full border border-[#1a1a1a] text-[10px] leading-none text-ink md:inline-flex"
                        >
                          i
                        </span>
                        <span className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 hidden w-80 max-w-[85vw] rounded-md border-2 border-[#1a1a1a] bg-cream p-3 text-xs text-charcoal shadow-[4px_4px_0_#1a1a1a] group-hover:block">
                          <span className="font-semibold text-ink">{soilLabel}</span>
                          <span className="mt-2 block space-y-1">
                            {soilDetails.map((detail) => (
                              <span key={detail} className="block">
                                • {detail}
                              </span>
                            ))}
                          </span>
                        </span>
                        {openMobilePopover === "soil" && (
                          <span
                            data-producer-popover="content"
                            className="absolute left-0 top-[calc(100%+6px)] z-20 w-80 max-w-[85vw] rounded-md border-2 border-[#1a1a1a] bg-cream p-3 text-xs text-charcoal shadow-[4px_4px_0_#1a1a1a] md:hidden"
                          >
                            <span className="font-semibold text-ink">{soilLabel}</span>
                            <span className="mt-2 block space-y-1">
                              {soilDetails.map((detail) => (
                                <span key={detail} className="block">
                                  • {detail}
                                </span>
                              ))}
                            </span>
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>{soilLabel}</span>
                    )}
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
              <ProducerSocialLinks
                links={producer.socialLinks}
                producerName={producer.name}
              />
            </div>
          </div>
        </div>
        {showCloseButton && (
          <button
          type="button"
          onClick={onClose}
          className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
          aria-label="Fermer la fiche producteur"
        >
          ✕
        </button>
          )}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            producer={producer}
            addButtonLabel={addButtonLabel}
          />
        ))}
      </div>
    </section>
  );
}
