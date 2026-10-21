"use client";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { ZoomIn } from "lucide-react";
import { KQ_ACTIVE_CARDS as KQ_CARDS, type KqCardCategory, type KqSupportCard } from "@/lib/kanab-quest-game";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { getKqCardGuide, getKqCardRole, getKqCardRarityLabel, KQ_CARD_RARITY_LABELS } from "@/lib/kanab-quest-card-guide";
import { KqCardCarousel } from "./KqCardCarousel";
import { KqBotteCardDetail } from "./KqBotteCollection";
import shared from "./KqCardCarousel.module.css";
import styles from "./KqInventoryCarousel.module.css";

const CATEGORIES: Record<KqCardCategory, string> = {
  equipment: "Équipement", "know-how": "Savoir-faire", luck: "Chance", pbi: "Anti-ravageurs", substrate: "Culture",
};
const categories = (Object.keys(CATEGORIES) as KqCardCategory[]).filter(category => KQ_CARDS.some(card => card.category === category));

type Props = {
  inventory: Record<string, number>;
  selectedCodes: string[];
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  loading?: boolean;
  error?: string;
};
export function KqInventoryCarousel({ inventory, selectedCodes, onAdd, onRemove, loading = false, error = "" }: Props) {
  const [filter, setFilter] = useState<"owned" | "all" | "missing">("owned");
  const [category, setCategory] = useState<KqCardCategory | "all">("all");
  const [rarity, setRarity] = useState("all");
  const [detail, setDetail] = useState<KqSupportCard | null>(null);
  const owned = KQ_CARDS.filter(card => (inventory[card.code] ?? 0) > 0).length;
  const unavailable = loading || Boolean(error);
  const matchingOwnership = unavailable ? [] : KQ_CARDS.filter(card => filter === "all" || (filter === "owned" ? (inventory[card.code] ?? 0) > 0 : (inventory[card.code] ?? 0) === 0));
  const cards = matchingOwnership.filter(card => (category === "all" || card.category === category) && (rarity === "all" || card.rarity === rarity));
  return <>
    <KqCardCarousel id="inventory-carousel-title" title="Ton inventaire" label="Cartes Botte du Chanvrier de ton inventaire" count={cards.length} resetKey={`${filter}:${category}:${rarity}`}
      intro={<div className={styles.toolbar}>
        <nav className={styles.ownership} aria-label="Filtrer ton inventaire">{([['owned', 'Possédées'], ['all', 'Toutes'], ['missing', 'Manquantes']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</nav>
        <span role="status">{loading ? "Chargement de tes cartes…" : error ? "Stock indisponible" : `${owned}/${KQ_CARDS.length} cartes possédées · ${cards.length} affichée${cards.length > 1 ? "s" : ""} · ${selectedCodes.length} dans ton deck`}</span>
        <details className={styles.filters}>
          <summary>Affiner les cartes <small>{category !== "all" || rarity !== "all" ? [category !== "all" ? CATEGORIES[category] : null, rarity !== "all" ? KQ_CARD_RARITY_LABELS[rarity as keyof typeof KQ_CARD_RARITY_LABELS] : null].filter(Boolean).join(" · ") : "Catégorie · rareté"}</small></summary>
          <nav className={styles.categories} aria-label="Filtrer par catégorie">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>Toutes les catégories <b>{unavailable ? "…" : matchingOwnership.length}</b></button>
          {categories.map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{CATEGORIES[value]} <b>{unavailable ? "…" : matchingOwnership.filter(card => card.category === value).length}</b></button>)}
          </nav>
          <label className={styles.rarityFilter}>Rareté<select aria-label="Filtrer l’inventaire par rareté" value={rarity} onChange={event => setRarity(event.target.value)}><option value="all">Toutes les raretés</option>{Object.entries(KQ_CARD_RARITY_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        </details>
        <p className={styles.epicNotice}>Une seule carte épique peut être jouée par culture. Les intrants et PBI s’utilisent depuis le suivi de santé.</p>
      </div>}
      footer={error ? <p role="alert" className={styles.notice}>{error}</p> : !loading && cards.length === 0 ? <p className={styles.notice}>{category !== "all" || rarity !== "all" ? "Aucune carte ne correspond à ces filtres." : filter === "missing" ? "Tu possèdes toutes les cartes !" : "Aucune carte possédée pour le moment. Tu peux découvrir les cartes à trouver."}{filter !== "all" || category !== "all" || rarity !== "all" ? <button type="button" onClick={() => { setFilter("all"); setCategory("all"); setRarity("all"); }}>Voir toutes les cartes</button> : null}</p> : null}>
      {cards.map(card => {
        const copies = inventory[card.code] ?? 0, selected = selectedCodes.filter(code => code === card.code).length;
        const role = getKqCardRole(card), guide = getKqCardGuide(card), artwork = getKqCardArtwork(card.code);
        return <article key={card.code} role="listitem" className={`${shared.card} ${styles.card}`} data-rarity={card.rarity} data-card-code={card.code} data-selected={selected > 0 || undefined} data-locked={copies === 0 || undefined} style={{ "--card-role": role.color } as CSSProperties}>
          <button type="button" data-carousel-drag className={styles.artwork} aria-label={`Agrandir ${card.name}`} aria-haspopup="dialog" onClick={() => setDetail(card)}>
            {artwork ? <Image src={artwork} alt={`Carte ${card.name}`} width={1024} height={1536} sizes="(max-width: 600px) 74vw, 275px" /> : <span>{card.name}</span>}
            <span className={styles.zoom}><ZoomIn size={15} aria-hidden="true" /> Détails</span>
          </button>
          <span className={styles.role}>{role.label} · {card.xpCost} XP</span>
          <span className={styles.rarity} data-rarity={card.rarity}>{getKqCardRarityLabel(card.rarity)} · {guide.timing}</span>
          <h3>{card.name}</h3><p>{guide.benefit}</p>
          <span className={styles.stock}>{copies > 0 ? `${copies} exemplaire${copies > 1 ? "s" : ""} en stock` : "À trouver"}</span>
          <div className={styles.quantity}>
            <button type="button" disabled={selected === 0} aria-label={`Retirer une copie de ${card.name}`} onClick={() => onRemove(card.code)}>−</button>
            <span><b>{selected}</b> dans le deck</span>
            <button type="button" disabled={selected >= copies} aria-label={`Ajouter une copie de ${card.name}`} onClick={() => onAdd(card.code)}>+</button>
          </div>
        </article>;
      })}
    </KqCardCarousel>
    {detail ? <KqBotteCardDetail card={detail} copies={unavailable ? null : inventory[detail.code] ?? 0} onClose={() => setDetail(null)} /> : null}
  </>;
}
