"use client";

import type { KeyboardEvent } from "react";
import Image from "next/image";
import { ProducerSocialLinks } from "@/components/boutique/ProducerSocialLinks";
import {
  PRODUCER_CULTURE_LABELS,
  type Producer,
  type ProducerCultureType,
} from "@/types/store";

type ProducerTcgCardProps = {
  producer: Producer;
  isSelected?: boolean;
  onClick?: () => void;
  imagePriority?: boolean;
};

const CULTURE_SHORT_LABELS: Record<ProducerCultureType, string> = {
  indoor: "IN",
  greenhouse: "GH",
  outdoor: "OUT",
};

function computeRarity(producer: Producer): number {
  const score = [
    (producer.cultureType ?? []).length > 0,
    (producer.certifications ?? []).length > 0,
    (producer.climate ?? "").trim().length > 0,
    (producer.soil ?? "").trim().length > 0,
    (producer.experience ?? "").trim().length > 0,
  ].filter(Boolean).length;

  return Math.max(1, Math.min(5, score));
}

export function ProducerTcgCard({
  producer,
  isSelected = false,
  onClick,
  imagePriority = false,
}: ProducerTcgCardProps) {
  const location = [producer.department, producer.region].filter(Boolean).join(", ") || producer.location;
  const cultureTypes = producer.cultureType ?? [];
  const certifications = producer.certifications ?? [];
  const rarity = computeRarity(producer);
  const hasHolo = rarity >= 4;
  const description = producer.philosophy?.trim() || producer.description;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`tcg-card ${hasHolo ? "tcg-card--holographic" : ""} ${isSelected ? "tcg-card--selected" : ""}`}
      aria-pressed={isSelected}
    >
      <div className="tcg-card-inner">
        <header className="tcg-card-header">
          <h3 className="tcg-card-name" title={producer.name}>
            {producer.name}
          </h3>
          <div className="tcg-card-culture-badges" aria-label="Type de culture">
            {cultureTypes.map((cultureType) => (
              <span
                key={cultureType}
                className={`tcg-culture-badge tcg-culture-badge--${cultureType}`}
                title={PRODUCER_CULTURE_LABELS[cultureType]}
              >
                {CULTURE_SHORT_LABELS[cultureType]}
              </span>
            ))}
          </div>
        </header>

        <div className="tcg-card-image-frame">
          <Image
            src={producer.image}
            alt={producer.name}
            fill
            sizes="300px"
            priority={imagePriority}
            className="object-cover"
          />
          <div className="tcg-card-location-ribbon">
            <span className="tcg-card-location-text">{location}</span>
          </div>
        </div>

        <div className="tcg-card-stats">
          <div className="tcg-stat">
            <span className="tcg-stat-label">Climat</span>
            <span className="tcg-stat-value">{producer.climate || "—"}</span>
          </div>
          <div className="tcg-stat">
            <span className="tcg-stat-label">Sol</span>
            <span className="tcg-stat-value">{producer.soil || "—"}</span>
          </div>
        </div>

        {certifications.length > 0 && (
          <div className="tcg-card-certifications">
            {certifications.slice(0, 4).map((certification) => (
              <span key={certification} className="tcg-cert-pill">
                {certification}
              </span>
            ))}
          </div>
        )}

        <div className="tcg-card-description">{description}</div>

        <ProducerSocialLinks
          links={producer.socialLinks}
          producerName={producer.name}
          compact
          stopPropagation
        />

        <footer className="tcg-card-footer">
          <span className="tcg-card-footer-text">
            {producer.founded ? `Depuis ${producer.founded}` : producer.experience || "Producteur"}
          </span>
          <div className="tcg-card-rarity" aria-label={`Rareté ${rarity} sur 5`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className={`tcg-card-rarity-dot ${index < rarity ? "" : "tcg-card-rarity-dot--empty"}`}
              />
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
