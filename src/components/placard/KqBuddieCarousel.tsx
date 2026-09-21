"use client";
import Image from "next/image";
import { Check, Leaf } from "lucide-react";
import { BuddieCard } from "@/components/lottery/BuddieCard";
import { hasModernBuddieArtwork } from "@/lib/buddie-artwork";
import { rarityLabels } from "@/lib/lottery-card-ui";
import type { KqBuddie } from "@/lib/kanab-quest-game";
import { KqCardCarousel } from "./KqCardCarousel";
import shared from "./KqCardCarousel.module.css";
import styles from "./KqBuddieCarousel.module.css";

type Props = {
  buddies: readonly KqBuddie[];
  artwork: Record<string, { imageUrl: string; ownedCopies: number }>;
  selectedCode: string;
  onSelect: (code: string) => void;
};
export function KqBuddieCarousel({ buddies, artwork, selectedCode, onSelect }: Props) {
  return <KqCardCarousel id="placard-preparation" title="1. Ton Buddie" label="Tes cartes Buddies" count={buddies.length} tourStep="culture"
    footer={!buddies.length ? <p className={shared.empty}>Tes Buddies disponibles apparaîtront ici.</p> : null}>
    {buddies.map(buddie => {
      const illustration = artwork[buddie.code], selected = selectedCode === buddie.code;
      return <article key={buddie.code} role="listitem" className={shared.card} data-selected={selected || undefined}>
        <div className={shared.artwork}>
          <button type="button" data-carousel-drag className={styles.picture} aria-label={`Choisir ${buddie.name}`} aria-pressed={selected} onClick={() => onSelect(buddie.code)}>
            {hasModernBuddieArtwork(buddie.code) ? <BuddieCard code={buddie.code} name={buddie.name} rarity={buddie.rarity} cardNumber={buddie.cardNumber} imageUrl={illustration?.imageUrl} sizes="(max-width: 600px) 74vw, 275px" />
              : illustration?.imageUrl ? <Image src={illustration.imageUrl} alt={`Carte ${buddie.name}`} width={1024} height={1536} sizes="(max-width: 600px) 74vw, 275px" />
              : <span className={styles.placeholder}><Leaf size={48} aria-hidden="true" /><strong>{buddie.name}</strong><span>Buddie #{buddie.cardNumber}</span></span>}
          </button>
        </div>
        <div className={styles.metadata}>
          <span className={shared.timing}>#{buddie.cardNumber} · {rarityLabels[buddie.rarity]}{illustration?.ownedCopies ? ` · ×${illustration.ownedCopies}` : ""}</span>
          {selected ? <span className={styles.selected}><Check size={14} aria-hidden="true" /> Choisi</span> : null}
        </div>
        <h3>{buddie.name}</h3><p>{buddie.ability}</p>
        <button type="button" aria-label={`${selected ? "Sélectionné" : "Choisir"} : ${buddie.name}`} aria-pressed={selected} onClick={() => onSelect(buddie.code)}>{selected ? "Sélectionné" : "Choisir ce Buddie"}</button>
      </article>;
    })}
  </KqCardCarousel>;
}
