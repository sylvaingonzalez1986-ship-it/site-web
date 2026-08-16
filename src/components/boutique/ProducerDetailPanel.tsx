"use client";

import Image from "next/image";
import { ChevronDown, ExternalLink, MapPin, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProducerSocialLinks } from "@/components/boutique/ProducerSocialLinks";
import {
  PRODUCER_CLIMATE_DETAILS,
  PRODUCER_CLIMATE_OPTIONS,
  PRODUCER_SOIL_DETAILS,
  PRODUCER_SOIL_OPTIONS,
} from "@/data/producer-taxonomies";
import type { Product } from "@/data/products";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import { PRODUCER_CULTURE_LABELS, type Producer } from "@/types/store";
import styles from "./ProducerDetailPanel.module.css";

type ProducerDetailPanelProps = {
  producer: Producer;
  products: Product[];
  addButtonLabel: string;
  lowStockThresholdGrams: number;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  onClose: () => void;
  showCloseButton?: boolean;
  tastingSummariesByProductId?: Record<string, PublicContestProductTastingSummary>;
};

type ProducerFactProps = {
  title: string;
  value: string;
  details: string[];
};

function ProducerFact({ title, value, details }: ProducerFactProps) {
  if (details.length === 0) {
    return (
      <div className={styles.fact}>
        <div className={styles.factSummary}>
          <span>
            <span className={styles.factTitle}>{title}</span>
            <span className={styles.factValue}>{value}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <details className={`group ${styles.fact}`}>
      <summary className={styles.factSummary}>
        <span>
          <span className={styles.factTitle}>{title}</span>
          <span className={styles.factValue}>{value}</span>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2.5}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className={styles.factBody}>
        {details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </details>
  );
}

export function ProducerDetailPanel({
  producer,
  products,
  addButtonLabel,
  lowStockThresholdGrams,
  producerPartnerLabel,
  producerWebsiteLabel,
  onClose,
  showCloseButton = true,
  tastingSummariesByProductId = {},
}: ProducerDetailPanelProps) {
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
      className={`producer-detail-enter ${styles.panel}`}
      aria-labelledby={`producer-title-${producer.id}`}
    >
      <div className={styles.hero}>
        <div
          className={styles.image}
          style={{ backgroundImage: `url("${producer.image}")` }}
        >
          <Image
            src={producer.image}
            alt={producer.name}
            fill
            sizes="(max-width: 900px) 100vw, 42vw"
            className={styles.photo}
          />
        </div>

        <div className={styles.copy}>
          <p className={styles.eyebrow}>{producerPartnerLabel}</p>
          <h2 id={`producer-title-${producer.id}`} className={styles.title}>
            {producer.name}
          </h2>

          <p className={styles.location}>
            <MapPin size={16} strokeWidth={2.5} aria-hidden="true" />
            {producerLocation}
          </p>

          {cultureTypes.length > 0 && (
            <div className={styles.tags} aria-label="Types de culture">
              {cultureTypes.map((cultureType) => (
                <span key={cultureType} className={styles.tag}>
                  {PRODUCER_CULTURE_LABELS[cultureType]}
                </span>
              ))}
            </div>
          )}

          <p className={styles.description}>{longDescription}</p>

          {certifications.length > 0 && (
            <div className={styles.tags} aria-label="Certifications">
              {certifications.map((certification) => (
                <span key={certification} className={`${styles.tag} bg-yellow`}>
                  {certification}
                </span>
              ))}
            </div>
          )}

          {(producer.website || producer.socialLinks) && (
            <div className={styles.links}>
              {producer.website && (
                <a
                  href={producer.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-cartoon btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
                >
                  {producerWebsiteLabel}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              <ProducerSocialLinks
                links={producer.socialLinks}
                producerName={producer.name}
              />
            </div>
          )}
        </div>

        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className={`btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 ${styles.close}`}
            aria-label="Fermer la fiche producteur"
          >
            <X size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>

      {(producer.climate || producer.soil) && (
        <div className={styles.facts}>
          {producer.climate && (
            <ProducerFact title="Climat" value={climateLabel} details={climateDetails} />
          )}
          {producer.soil && (
            <ProducerFact title="Sol" value={soilLabel} details={soilDetails} />
          )}
        </div>
      )}

      <div className={styles.products}>
        <div className={styles.productsHeader}>
          <div>
            <p className={styles.eyebrow}>La sélection de</p>
            <h3 className={styles.productsTitle}>{producer.name}</h3>
          </div>
          <p className={styles.eyebrow}>
            {products.length} produit{products.length > 1 ? "s" : ""}
          </p>
        </div>

        {products.length > 0 ? (
          <div className={styles.productGrid}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                producer={producer}
                addButtonLabel={addButtonLabel}
                lowStockThresholdGrams={lowStockThresholdGrams}
                tastingSummary={tastingSummariesByProductId[product.id]}
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>Aucun produit disponible pour le moment.</p>
        )}
      </div>
    </section>
  );
}
