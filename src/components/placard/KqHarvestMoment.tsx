"use client";

import Image from "next/image";
import { ArrowRight, Scale, Sprout } from "lucide-react";
import { useId } from "react";
import type { KqOfficialFlower } from "@/lib/kanab-quest-api";
import { getKqRunProjection, type KqGameState } from "@/lib/kanab-quest-game";
import { getKqHarvestMoment } from "@/lib/kanab-quest-harvest-moment";
import styles from "./KqHarvestMoment.module.css";

export type KqHarvestMomentProps = {
  state: KqGameState;
  flowers?: readonly KqOfficialFlower[];
  runId?: string | null;
  artwork?: { src: string; alt: string };
  /** True only for a completion received in this visit, never a restored run. */
  fresh: boolean;
  onContinue?: () => void;
};

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Replaces the harvest hero; the detailed campaign and card sheets stay below. */
export function KqHarvestMoment({ state, flowers, runId, artwork, fresh, onContinue }: KqHarvestMomentProps) {
  const titleId = useId();
  const result = getKqHarvestMoment(state, flowers, runId);
  if (!result) return null;
  const alive = result.outcome === "harvest";
  const lost = result.outcome === "dead" || result.outcome === "empty";
  const campaign = result.rows.length > 1;
  const quality = result.qualityRange;
  const soloTier = alive && !campaign && quality && Number.isFinite(state.quality)
    ? getKqRunProjection(state).tier
    : null;
  const qualityText = quality
    ? quality.min === quality.max ? number(quality.min) : `${number(quality.min)}–${number(quality.max)}`
    : "—";
  const illustration = artwork ?? {
    src: lost ? "/app/kanab-quest/reactions/stages-v3/recolte-dead.webp" : "/app/kanab-quest/stages/sylvain-recolte-v1.webp",
    alt: lost ? "" : "Sylvain présente la récolte",
  };
  const reserveConfirmed = alive && result.confirmedFlowers === result.rows.length;
  const description = lost
    ? "Prends le temps de lire le bilan avant la prochaine culture."
    : reserveConfirmed
      ? `${result.confirmedFlowers === 1 ? "Ta Fleur est enregistrée" : `${result.confirmedFlowers} Fleurs sont enregistrées`}. La suite se joue dans ta réserve.`
      : alive
        ? "Le fruit de tes choix. Retrouve le détail de chaque récolte ci-dessous."
        : "Les valeurs de cette récolte ne sont pas encore disponibles.";
  return <section
    className={styles.moment}
    data-harvest-moment
    data-outcome={result.outcome}
    data-fresh={fresh && alive || undefined}
    aria-labelledby={titleId}
  >
    <div className={styles.illustration}>
      <Image src={illustration.src} alt={illustration.alt} width={280} height={280}
        sizes="(max-width: 480px) 110px, (max-width: 760px) 150px, 230px" />
    </div>
    <div className={styles.content}>
      <span className={styles.eyebrow}>{campaign ? `${result.rows.length} Buddies · campagne terminée` : "Culture terminée"}</span>
      <h1 id={titleId}>{alive ? "La récolte est là." : lost ? "Aucune récolte cette fois." : "Le temps du bilan."}</h1>
      {soloTier ? <p className={styles.identity} data-harvest-identity>
        {result.rows[0].varietyName} · <strong>{soloTier}</strong>
      </p> : null}
      <p>{description}</p>
      {!lost ? <dl className={styles.metrics}>
        <div>
          <dt><Scale aria-hidden="true" />{campaign ? "Récolte totale" : "Récolte"}</dt>
          <dd>{result.totalGrams === null ? "—" : <>{number(result.totalGrams)} <small>g</small></>}</dd>
          {result.totalGrams === null ? <span>Quantité indisponible</span> : null}
        </div>
        <div>
          <dt><Sprout aria-hidden="true" />Qualité{campaign ? " par récolte" : ""}</dt>
          <dd>{qualityText}{quality ? <small> points</small> : null}</dd>
          {!quality ? <span>Qualité indisponible</span> : null}
        </div>
      </dl> : null}
      {alive && onContinue ? <button type="button" className={styles.continue} onClick={onContinue}>
        Voir ma réserve <ArrowRight aria-hidden="true" />
      </button> : null}
    </div>
  </section>;
}
