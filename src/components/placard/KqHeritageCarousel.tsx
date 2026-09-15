"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { KqCardCarousel } from "./KqCardCarousel";
import type { KqHeritageCard } from "@/lib/kanab-quest-heritage";
import styles from "./KqCardCarousel.module.css";

type Props = {
  cards: readonly KqHeritageCard[];
  ownedCodes: string[];
  ownershipRequired: boolean;
  producerNames: Record<string, string[]>;
  selectedCode: string;
  onSelect: (code: string) => void;
  renderArtwork: (card: KqHeritageCard, producerLabel?: string) => ReactNode;
};

export function KqHeritageCarousel({ cards, ownedCodes, ownershipRequired, producerNames, selectedCode, onSelect, renderArtwork }: Props) {
  return <KqCardCarousel id="heritage-carousel-title" title="Héritage" label="Cartes Héritage producteur" count={cards.length}
    footer={<>
      {!cards.length ? <p className={styles.empty}>Les cartes Héritage seront bientôt disponibles.</p> : null}
      <button type="button" className={styles.classic} aria-pressed={!selectedCode} onClick={() => onSelect("")}>{!selectedCode ? <Check size={16} aria-hidden="true" /> : null} Sans Héritage</button>
    </>}>
      {cards.map(card => {
        const owned = ownedCodes.includes(card.code), locked = ownershipRequired && !owned, selected = selectedCode === card.code;
        const names = producerNames[card.code] ?? [];
        const producer = names.length ? names.join(" · ") : card.producerName || (owned ? "Héritage assemblé" : undefined);
        return <article key={card.code} role="listitem" className={styles.card} data-selected={selected || undefined} data-locked={locked || undefined}>
          <div className={styles.artwork}>{renderArtwork(card, producer)}{selected ? <span className={styles.equipped}><Check size={14} aria-hidden="true" /> Équipé</span> : null}</div>
          <span className={styles.timing}>{card.timing === "passive" ? "Pouvoir permanent" : "1 fois par culture"}</span>
          <h3>{card.name}</h3>
          <p>{card.description}</p>
          <button type="button" disabled={locked} aria-pressed={selected} aria-label={`${locked ? "Non possédée" : selected ? "Équipée" : "Équiper"} : ${producer ?? card.name}`} onClick={() => onSelect(card.code)}>{locked ? "Non possédée" : selected ? "Équipée" : "Équiper"}</button>
        </article>;
      })}
  </KqCardCarousel>;
}
