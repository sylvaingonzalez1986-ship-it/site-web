"use client";

import type { KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowUpRight, Leaf } from "lucide-react";
import { ProducerSocialLinks } from "@/components/boutique/ProducerSocialLinks";
import {
  PRODUCER_CULTURE_LABELS,
  type Producer,
  type ProducerCultureType,
} from "@/types/store";
import styles from "./ProducerTcgCard.module.css";

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

export function ProducerTcgCard({
  producer,
  isSelected = false,
  onClick,
  imagePriority = false,
}: ProducerTcgCardProps) {
  const location =
    [producer.department, producer.region].filter(Boolean).join(", ") ||
    producer.location;
  const cultureTypes = producer.cultureType ?? [];
  const certifications = producer.certifications ?? [];
  const description = producer.philosophy?.trim() || producer.description;
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`group ${styles.card} ${isSelected ? styles.selected : ""}`}
      aria-pressed={isSelected}
      aria-label={`Découvrir la fiche de ${producer.name}`}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.identity}>
            <h3 className={styles.title} title={producer.name}>
              {producer.name}
            </h3>
          </div>

          <div className={styles.energyBadges} aria-label="Types de culture">
            {cultureTypes.slice(0, 3).map((cultureType) => (
              <span
                key={cultureType}
                className={styles.energy}
                title={PRODUCER_CULTURE_LABELS[cultureType]}
              >
                {CULTURE_SHORT_LABELS[cultureType]}
              </span>
            ))}
            {cultureTypes.length === 0 && (
              <span className={styles.energy} title="Producteur">
                <Leaf size={13} aria-hidden="true" />
              </span>
            )}
          </div>
        </header>

        <div
          className={styles.imageFrame}
          style={{ backgroundImage: `url("${producer.image}")` }}
        >
          <Image
            src={producer.image}
            alt={producer.name}
            fill
            sizes="330px"
            priority={imagePriority}
            className={styles.photo}
          />
          <p className={styles.location}>{location}</p>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Climat</span>
            <span className={styles.statValue}>{producer.climate || "—"}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Sol</span>
            <span className={styles.statValue}>{producer.soil || "—"}</span>
          </div>
        </div>

        <div className={styles.certifications} aria-label="Certifications">
          {certifications.length > 0 ? (
            certifications.slice(0, 3).map((certification) => (
              <span key={certification} className={styles.certification}>
                {certification}
              </span>
            ))
          ) : (
            <span className={styles.certificationMuted}>Production locale</span>
          )}
        </div>

        <div className={styles.textBox}>
          <span className={styles.textLabel}>Portrait</span>
          <p className={styles.description}>{description}</p>
        </div>

        <footer className={styles.footer}>
          <span className={styles.experience}>
            {producer.founded
              ? `Depuis ${producer.founded}`
              : producer.experience || "Producteur"}
          </span>
          <ProducerSocialLinks
            links={producer.socialLinks}
            producerName={producer.name}
            compact
            stopPropagation
          />
          <span className={styles.discover}>
            Fiche <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </footer>
      </div>
    </article>
  );
}
