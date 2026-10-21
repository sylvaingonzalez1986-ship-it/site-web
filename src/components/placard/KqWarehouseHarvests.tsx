"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Clock3, Package, RefreshCw, ShieldCheck, ShoppingBag } from "lucide-react";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqStorageHarvestOverview } from "@/lib/kanab-quest-harvests";
import { KQ_STORAGE_CONTAINER_ARTWORK } from "@/lib/kanab-quest-storage-artwork";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqWarehouseHarvests.module.css";

const known = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const mass = (grams: number) => grams >= 1_000
  ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`
  : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const score = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const dateLabel = (value: string) => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
  : null;

function remainingLabel(remainingMs: number) {
  if (!Number.isFinite(remainingMs)) return "Durée à confirmer";
  if (remainingMs <= 0) return "Actualisation en cours…";
  const minutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(minutes / 60);
  return `Encore ${hours ? `${hours} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")}` : ""}` : `${minutes} min`}`;
}

type Props = {
  storage: KqStorageSnapshot | null;
  stockGrams?: number | null;
  storageReservedGrams?: number | null;
  storageCapacityGrams?: number | null;
  disabled?: boolean;
  error?: string;
  onRetry?: () => void;
  onOpenWorkshop: (flowerId: string) => void;
  onSellOverflow: (flowerId: string) => void;
};

export function KqWarehouseHarvests({ storage, stockGrams, storageReservedGrams, storageCapacityGrams, disabled = false, error, onRetry, onOpenWorkshop, onSellOverflow }: Props) {
  // Container reservations and global stock are different quantities. Neither
  // substitutes for a lot's remaining stock when that information is missing.
  const capacity = storage ? storage.capacity.totalUnits / 10 : storageCapacityGrams;
  const reserved = storage ? storage.capacity.reservedUnits / 10 : storageReservedGrams;
  const hasCapacity = known(capacity) && known(reserved);
  const free = hasCapacity ? Math.max(0, capacity - reserved) : null;
  const { lots } = getKqStorageHarvestOverview(storage);
  const actionsDisabled = disabled || Boolean(error);
  const lotMass = lots.every(lot => known(lot.projection.capacity?.totalUnits))
    ? lots.reduce((sum, lot) => sum + lot.projection.capacity!.totalUnits / 10, 0) : null;
  const readyCount = lots.filter(lot => lot.projection.stage === "ready").length;
  const curingCount = lots.filter(lot => lot.projection.stage === "curing").length;
  const overflow = lots.reduce((sum, lot) => sum + (lot.projection.capacity?.overflowUnits ?? 0) / 10, 0);

  return <section className={styles.section} aria-label="Récoltes en conservation" data-conservation-summary>
    <header className={styles.heading}>
      <div><h3>Mes fleurs stockées</h3>
        {storage && lots.length > 0 && <div className={styles.counts} aria-label="État des lots">
          {known(lotMass) && <span><Package size={14} aria-hidden="true" /><b>{mass(lotMass)}</b></span>}
          <span><Check size={14} aria-hidden="true" /><b>{readyCount}</b> {readyCount > 1 ? "lots affinés" : "lot affiné"}</span>
          <span><Clock3 size={14} aria-hidden="true" /><b>{curingCount}</b> en affinage</span>
          {overflow > 0 && <span data-warning><CircleAlert size={14} aria-hidden="true" /><b>{mass(overflow)}</b> sans contenant</span>}
        </div>}
      </div>
      <Link href="/arene/placard?view=harvests">Toutes mes récoltes <ArrowRight size={16} aria-hidden="true" /></Link>
    </header>

    {error && <div className={styles.error} role="alert"><CircleAlert size={18} aria-hidden="true" /><span>{error}</span>{onRetry && <button type="button" disabled={disabled} onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Réessayer</button>}</div>}

    <div className={styles.lots}>
      {lots.map(lot => {
        const { projection } = lot;
        const ready = projection.stage === "ready";
        const lotCapacity = projection.capacity;
        const total = known(lotCapacity?.totalUnits) ? lotCapacity.totalUnits / 10 : null;
        const surplus = lotCapacity?.overflowUnits ?? 0;
        const protectedGrams = known(lotCapacity?.protectedUnits) ? lotCapacity.protectedUnits / 10 : null;
        const readyDate = dateLabel(projection.readyAt);
        const progress = ready ? 100 : known(projection.progressPercent) ? Math.max(0, Math.min(99.9, projection.progressPercent)) : null;
        const allocations = lotCapacity?.allocations ?? [];
        const representative = [...allocations].sort((a, b) => b.storedUnits - a.storedUnits)[0];
        const artwork = representative ? KQ_STORAGE_CONTAINER_ARTWORK[representative.containerCode] : null;
        const containerCount = allocations.reduce((sum, item) => sum + item.quantity, 0);
        const quality = known(projection.conditionScore) ? Math.max(0, Math.min(10, projection.conditionScore)) : null;

        return <article key={lot.flowerId} className={styles.lot} data-conservation-lot={lot.flowerId} data-ready={ready && lotCapacity?.overflowUnits === 0}>
          <div className={styles.lotRow}>
            <div className={styles.identity}>
              <div className={styles.containerArt}>{artwork ? <Image src={artwork.src} alt="" width={64} height={64} sizes="(max-width: 600px) 44px, 60px" /> : <Package size={30} aria-hidden="true" />}</div>
              <div><h4>{lot.varietyName}</h4><span className={styles.badge} data-state={surplus > 0 ? "warning" : ready ? "ready" : "curing"} data-curing-status>
                {surplus > 0 ? <CircleAlert size={13} aria-hidden="true" /> : ready ? <Check size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
                {surplus > 0 ? "Contenant manquant" : ready ? "Affinage terminé" : "Curing en cours"}
              </span></div>
            </div>
            <dl className={styles.numbers}>
              <div><dt>Stock restant</dt><dd>{known(total) ? mass(total) : "À confirmer"}</dd></div>
              <div data-lot-quality><dt>Qualité actuelle</dt><dd>{known(quality) ? <>{score(quality)}<small>/10</small></> : "À confirmer"}</dd></div>
            </dl>
            <div className={styles.curing} data-curing-progress>
              {known(progress) ? <KqProgressMeter label="Affinage" value={progress} max={100} valueLabel={`${Math.floor(progress)} %`} /> : <p>Affinage à confirmer</p>}
              <small>{ready ? "Lot affiné · prêt pour le comptoir" : remainingLabel(projection.remainingMs)}</small>
            </div>
            <div className={styles.lotAction}>
              {surplus > 0 ? <strong className={styles.warning}><CircleAlert size={16} aria-hidden="true" />{mass(surplus / 10)} à protéger</strong> : <>
                <button type="button" className={styles.action} data-open-workshop={lot.flowerId} disabled={actionsDisabled} onClick={() => onOpenWorkshop(lot.flowerId)}><ShoppingBag size={16} aria-hidden="true" />{ready ? "Préparer ou vendre" : "Voir au comptoir"}<ArrowRight size={16} aria-hidden="true" /></button>
                <small>{ready ? "Selon les conditions du comptoir" : "Grossiste possible, selon son quota"}</small>
              </>}
            </div>
          </div>

          {surplus > 0 && <div className={styles.overflow}>
            <div><strong>{mass(surplus / 10)} à stocker ou à vendre</strong><p>Ajoute des contenants ou vends le surplus. Le reste du lot demeure stocké.</p>
              {lotCapacity?.overflowDeadlineAt && dateLabel(lotCapacity.overflowDeadlineAt) && <p data-overflow-deadline>Vente automatique le {dateLabel(lotCapacity.overflowDeadlineAt)}.</p>}
            </div>
            <div>{lot.overflowOffer ? <>
              <button type="button" className={styles.action} data-sell-overflow={lot.flowerId} disabled={actionsDisabled} onClick={() => onSellOverflow(lot.flowerId)}>Vendre le surplus · {mass(lot.overflowOffer.units / 10)} <ArrowRight size={17} aria-hidden="true" /></button>
              <small>{formatKqCash(lot.overflowOffer.payoutCents)} TTC · environ {formatKqCash(lot.overflowOffer.netPayoutCents)} nets après TVA et charges. Montant recalculé à la vente, selon le quota grossiste.</small>
            </> : <small>Aucune offre de reprise disponible pour le moment.</small>}</div>
          </div>}

          <details className={styles.lotDetails} data-lot-details>
            <summary><span>Détails du lot</span><small>{known(protectedGrams) ? <><ShieldCheck size={13} aria-hidden="true" />{mass(protectedGrams)} en contenant</> : "Répartition à confirmer"}</small></summary>
            <div className={styles.detailsBody}>
              <div><strong>{projection.methodName}</strong><p>{containerCount > 0 ? `${containerCount} contenant${containerCount > 1 ? "s" : ""} occupé${containerCount > 1 ? "s" : ""}` : "Contenants à attribuer"} · Lot {lot.flowerId.slice(0, 8)}</p>
                <p>Récolte initiale : {known(lot.harvestGrams) ? mass(lot.harvestGrams) : "à confirmer"}.{!known(total) && " Quantité restante à confirmer."}</p>
                {!ready && <><p>{readyDate ? <>Maturité prévue le <time dateTime={projection.readyAt}>{readyDate}</time>.</> : "Date de maturité à confirmer."}</p><p>L’affinage avance aussi hors connexion. Les boutiques attendent sa fin ; le grossiste peut reprendre plus tôt, selon son quota.</p></>}
              </div>
              <div className={styles.detailMeters}>
                {known(total) && known(protectedGrams) && total > 0 && <KqProgressMeter label="Fleurs en contenant" value={protectedGrams} max={total} valueLabel={`${mass(protectedGrams)} / ${mass(total)}`} tone={surplus > 0 ? "gold" : "teal"} />}
                {known(quality) && <KqProgressMeter label="Qualité commerciale" value={quality} max={10} valueLabel={`${score(quality)} / 10`} />}
                {projection.postHarvest && <p>Séchage <b>+{score(projection.postHarvest.dryingQualityBonus)}</b> · Curing acquis <b>+{score(projection.postHarvest.curingQualityBonus)}</b></p>}
              </div>
            </div>
          </details>
        </article>;
      })}
    </div>
    {!lots.length && <div className={styles.empty} role="status"><Package size={28} aria-hidden="true" /><strong>{storage ? "Aucune récolte en conservation" : error ? "Les lots ne sont pas disponibles" : "Chargement des récoltes…"}</strong><p>{storage ? "Tes prochains lots apparaîtront ici pour suivre leur affinage et les envoyer au comptoir." : error ? "Réessaie pour retrouver leur état de conservation." : "Le stock et l’avancement de chaque lot arrivent ici."}</p></div>}

    <details className={styles.storageDetails} data-storage-summary-details>
      <summary><span>Stock et capacité</span><small>{known(free) ? `${mass(free)} libres en contenants` : "Capacité à confirmer"}</small></summary>
      <div className={styles.detailsBody}>
        <div><span className={styles.label}>Stock de l’entrepôt</span><strong className={styles.stockValue}>{known(stockGrams) ? mass(stockGrams) : "À confirmer"}</strong><p>Le total inclut les autres produits stockés. Quantités en équivalent fleurs après transformation.</p></div>
        <div data-conservation-capacity data-full={hasCapacity && reserved > capacity}>
          {hasCapacity && capacity > 0 ? <KqProgressMeter label="Capacité réservée" value={reserved} max={capacity} valueLabel={`${mass(reserved)} / ${mass(capacity)}`} tone={reserved > capacity ? "red" : "teal"} /> : <strong>{hasCapacity ? "Aucun contenant installé" : "Capacité à confirmer"}</strong>}
          <p>{hasCapacity && reserved > capacity ? "Capacité dépassée : ajoute des contenants." : "Un contenant entamé reste réservé à son lot."}</p>
        </div>
      </div>
    </details>
  </section>;
}
