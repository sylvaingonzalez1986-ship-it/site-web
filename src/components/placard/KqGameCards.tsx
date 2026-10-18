import Image from "next/image";
import { Flame } from "lucide-react";
import { getBuddieArtwork, hasModernBuddieArtwork } from "@/lib/buddie-artwork";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { doesKqCardMatchSituation, getKqSituation, KQ_BUDDIES, type KqGameState, type KqSupportCard } from "@/lib/kanab-quest-game";
import type { KqOfficialFlower } from "@/lib/kanab-quest-api";
import { getKqPlayerCardPermission } from "@/lib/kanab-quest-player-feedback";
import { KqCardEffectGuide as CardEffectGuide } from "./KqCardEffectGuide";
import styles from "./KanabQuestDicePrototype.module.css";

export const KQ_SUPPORT_CATEGORY_LABELS: Record<KqSupportCard["category"], string> = {
  substrate: "Mode de culture", pbi: "Auxiliaire PBI", equipment: "Équipement", "know-how": "Savoir-faire", luck: "Coup de chance",
};

export const KQ_FLOWER_STAT_LABELS = { appearance: "Apparence", aroma: "Terpènes & arômes", vigor: "Vigueur", mastery: "Maîtrise", regularity: "Régularité", cannabinoids: "Potentiel cannabinoïde" } as const;
const BUDDIE_RARITY_LABELS = { common: "Commun", silver: "Argent", gold: "Or", epic: "Épique", legendary: "Légendaire" } as const;
const formatKqScore = (value: number) => value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
type FlowerStatKey = keyof typeof KQ_FLOWER_STAT_LABELS;
export type KqFlowerTcgStatus = KqOfficialFlower["status"] | "new";

const FLOWER_TCG_STATUS_COPY: Record<KqFlowerTcgStatus, { label: string; note: string }> = {
  new: { label: "Nouvelle Fleur", note: "Usage unique · brûlée après son duel" },
  available: { label: "Prête à jouer", note: "Usage unique · brûlée après son duel" },
  queued: { label: "Dans la file", note: "Retirable avant le tirage aléatoire" },
  locked: { label: "Duel engagé", note: "Verrouillée · burn au verdict" },
  burned: { label: "Brûlée", note: "Carte consommée définitivement" },
};

export function KqFlowerTcgCard({
  varietyName,
  varietyCode,
  tier,
  quality,
  stats,
  imageUrl,
  reference,
  status = "available",
  selected = false,
}: {
  varietyName: string;
  varietyCode?: string;
  tier: string;
  quality: number;
  stats: Record<string, number>;
  imageUrl?: string;
  reference: string;
  status?: KqFlowerTcgStatus;
  selected?: boolean;
}) {
  const buddie = KQ_BUDDIES.find((item) => item.code === varietyCode || item.name === varietyName);
  const buddieArtwork = getBuddieArtwork(buddie?.code ?? varietyCode ?? "", imageUrl);
  const statusCopy = FLOWER_TCG_STATUS_COPY[status];
  const statKeys = (Object.keys(KQ_FLOWER_STAT_LABELS) as FlowerStatKey[]).filter(key => typeof stats[key] === "number");

  return (
    <article
      className={styles.flowerTcgCard}
      data-status={status}
      data-selected={selected || undefined}
      aria-label={`Carte Fleur ${varietyName}, qualité ${quality}, ${statusCopy.label}`}
    >
      <header className={styles.flowerTcgHeader}>
        <span>Kanab Quest · Carte Fleur</span>
        <em>#{String(buddie?.cardNumber ?? 0).padStart(3, "0")}</em>
      </header>
      <div className={styles.flowerTcgArtwork} data-buddie-scene={hasModernBuddieArtwork(buddie?.code ?? varietyCode ?? "") || undefined}>
        {buddieArtwork ? (
          <Image
            src={buddieArtwork}
            alt={`Illustration du Buddie ${varietyName}`}
            fill
            sizes="(max-width: 700px) 82vw, 310px"
          />
        ) : (
          <span className={styles.flowerTcgArtworkFallback} aria-hidden="true">
            {varietyName.slice(0, 1)}
          </span>
        )}
        <span className={styles.flowerTcgTier}>{tier}</span>
        <span className={styles.flowerTcgQuality}><strong>{quality}</strong><small>Qualité</small></span>
      </div>
      <div className={styles.flowerTcgIdentity}>
        <span>{buddie ? BUDDIE_RARITY_LABELS[buddie.rarity] : "Fleur officielle"}</span>
        <h3>{varietyName}</h3>
        <small>{reference}</small>
      </div>
      <dl className={styles.flowerTcgStats}>
        {statKeys.map((stat) => (
          <div key={stat}>
            <dt>{KQ_FLOWER_STAT_LABELS[stat]}</dt>
            <dd>{formatKqScore(stats[stat] ?? 0)}</dd>
          </div>
        ))}
      </dl>
      <footer className={styles.flowerTcgFooter}>
        <span><Flame /> {statusCopy.label}</span>
        <small>{statusCopy.note}</small>
      </footer>
    </article>
  );
}
const dieKind = (value: number | undefined) => value === 1 ? "danger" : value === 6 ? "spark" : value && value >= 4 ? "success" : value ? "neutral" : undefined;
const DIE_PIP_POSITIONS: Record<number, readonly number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};
const DIE_SIDES = ["front", "back", "right", "left", "top", "bottom"] as const;

const getDieFaceValues = (value: number | undefined) => {
  if (!value) return [undefined, 6, 3, 4, 2, 5];
  const opposite = 7 - value;
  const remainingPairs = [[1, 6], [2, 5], [3, 4]].filter((pair) => !pair.includes(value));
  return [value, opposite, remainingPairs[0][0], remainingPairs[0][1], remainingPairs[1][0], remainingPairs[1][1]];
};

export function KqGameDie({ value, index, rolling = false, validated = false }: { value: number | undefined; index: number; rolling?: boolean; validated?: boolean }) {
  const rollingFaces = [2, 5, 6] as const;
  const renderedValue = rolling ? rollingFaces[index % rollingFaces.length] : value;
  const faceValues = getDieFaceValues(renderedValue);

  return (
    <span
      className={styles.gameDie}
      data-kind={rolling ? "rolling" : validated ? dieKind(value) : undefined}
      data-die-index={index + 1}
      aria-hidden="true"
    >
      <span className={styles.dieCube}>
        {DIE_SIDES.map((side, faceIndex) => {
          const faceValue = faceValues[faceIndex];
          const pips = faceValue ? DIE_PIP_POSITIONS[faceValue] ?? [] : [];
          return (
            <span key={side} className={styles.dieFace} data-side={side}>
              {pips.length > 0
                ? pips.map((position) => <i key={position} data-position={position} />)
                : <em className={styles.dieQuestion}>?</em>}
              <span className={styles.dieShine} />
            </span>
          );
        })}
      </span>
    </span>
  );
}
export function KqCardArtwork({ code, name, producerName, imageUrl }: { code: string; name: string; producerName?: string; imageUrl?: string }) {
  const src = imageUrl || getKqCardArtwork(code);
  return src ? (
    <span className={styles.cardArtwork} data-game-card-artwork>
      <Image src={src} alt={`Illustration de la carte ${name}`} fill sizes="(max-width: 760px) 190px, 220px" />
      {producerName ? <b className={styles.cardArtworkProducer}>{producerName}</b> : null}
    </span>
  ) : null;
}

export function KqSupportCardView({ card, state, copies, handCopies, deckCopies, onPlay, compact = false }: { card: KqSupportCard; state: KqGameState; copies: number; handCopies: number; deckCopies: number; onPlay: (code: string) => void; compact?: boolean }) {
  const permission = getKqPlayerCardPermission(state, card, copies);
  const currentSituation = getKqSituation(state);
  const matchesSituation = Boolean(currentSituation && doesKqCardMatchSituation(card, currentSituation));
  const exhausted = card.category !== "pbi"
    && state.usedCards.filter((code) => code === card.code).length >= state.deckCodes.filter((code) => code === card.code).length;
  const active = state.playedThisStage.includes(card.code);
  const unavailable = copies <= 0;
  return (
    <button
      type="button"
      className={styles.supportCard}
      data-category={card.category}
      data-rarity={card.rarity}
      data-action-card={card.code}
      data-card-playable={permission.allowed}
      data-situation-match={matchesSituation}
      data-active={active || undefined}
      disabled={!permission.allowed || unavailable}
      onClick={() => onPlay(card.code)}
      aria-label={`${card.name}. ${card.description} ${active ? "Active pour cette étape." : exhausted ? "Toutes les copies du deck ont été brûlées." : unavailable ? "Aucune copie restante." : permission.reason}`}
    >
      <KqCardArtwork code={card.code} name={card.name} />
      <span className={styles.cardCost}>{card.xpCost === 0 ? "∞" : card.xpCost}<small>XP</small></span>
      <span className={styles.cardCollection}>{card.category === "pbi" ? `Réserve PBI · album ×${copies}` : `Main ×${handCopies} · deck ×${deckCopies} · album ×${copies}`}</span>
      <strong>{card.name}</strong>
      {!compact && <><em>{KQ_SUPPORT_CATEGORY_LABELS[card.category]}</em>
      <span className={styles.cardCompatibility} data-matches={matchesSituation}>{matchesSituation ? "Adaptée à cet incident" : "Pour un autre incident"}</span>
      <CardEffectGuide card={card} /></>}
      <small className={styles.cardReason}>{active ? "Active puis brûlée" : exhausted ? "🔥 Copies du deck brûlées" : unavailable ? "Aucune copie restante" : permission.reason}</small>
    </button>
  );
}

