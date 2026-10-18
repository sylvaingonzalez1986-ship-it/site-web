"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Clock3, Factory, Leaf, Package, RefreshCw, ShieldCheck } from "lucide-react";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STORAGE_CONTAINER_ARTWORK } from "@/lib/kanab-quest-storage-artwork";
import styles from "./KqWarehouseHarvests.module.css";

const mass = (grams: number) => grams >= 1_000
  ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`
  : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const percent = (value: number) => Math.max(0, Math.min(100, value));
const dateLabel = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function remainingLabel(remainingMs: number) {
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
  // Global stock includes other products. Only container reservations share the
  // same denominator as installed capacity; neither is the sum of visible lots.
  const capacity = storage ? storage.capacity.totalUnits / 10 : storageCapacityGrams;
  const reserved = storage ? storage.capacity.reservedUnits / 10 : storageReservedGrams;
  const hasCapacity = typeof capacity === "number" && typeof reserved === "number";
  const capacityPercent = hasCapacity && capacity > 0 ? reserved / capacity * 100 : 0;
  const free = hasCapacity ? Math.max(0, capacity - reserved) : 0;
  const lots = storage?.lots ?? [];
  const lotMass = lots.reduce((sum, lot) => sum + (lot.projection.capacity?.totalUnits ?? lot.harvestGrams * 10) / 10, 0);
  const readyCount = lots.filter(lot => lot.projection.stage === "ready" && (lot.projection.capacity?.overflowUnits ?? 0) === 0).length;
  const curingCount = lots.filter(lot => lot.projection.stage === "curing").length;
  const overflow = lots.reduce((sum, lot) => sum + (lot.projection.capacity?.overflowUnits ?? 0) / 10, 0);

  return <section className={styles.section} aria-label="Récoltes en conservation" data-conservation-summary>
    <header className={styles.heading}>
      <div><span className={styles.eyebrow}>Du stockage à l’atelier</span><h3>Récoltes en conservation</h3></div>
      <Link href="/arene/placard?view=harvests">Toutes mes récoltes <ArrowRight size={16} aria-hidden="true" /></Link>
    </header>

    <div className={styles.overview}>
      <div className={styles.stock}>
        <div className={styles.stockIcon}><Package size={28} aria-hidden="true" /></div>
        <div><span className={styles.label}>Stock de l’entrepôt</span><strong className={styles.stockValue}>{typeof stockGrams === "number" ? mass(stockGrams) : "—"}</strong>
          <span className={styles.stockDetail}>{storage ? <>Dans ces lots : <b>{mass(lotMass)}</b></> : "Actualisation du stock…"}</span></div>
        <p>Le total inclut les autres produits stockés. Quantités en équivalent fleurs après transformation.</p>
      </div>

      <div className={styles.capacity}>
        <div className={styles.ring} style={{ "--fill": `${percent(capacityPercent)}%` } as CSSProperties}
          role={hasCapacity && capacity > 0 ? "meter" : "img"} aria-label={hasCapacity && capacity > 0 ? "Capacité réservée" : hasCapacity ? "Aucun contenant installé" : "Capacité en cours d’actualisation"}
          aria-valuemin={hasCapacity && capacity > 0 ? 0 : undefined} aria-valuemax={hasCapacity && capacity > 0 ? 100 : undefined}
          aria-valuenow={hasCapacity && capacity > 0 ? percent(capacityPercent) : undefined}
          aria-valuetext={hasCapacity && capacity > 0 ? `${mass(reserved)} réservés sur ${mass(capacity)} de capacité installée` : undefined}
          data-conservation-capacity data-full={hasCapacity && reserved > capacity}>
          <div><strong>{hasCapacity && capacity > 0 ? `${Math.round(capacityPercent)} %` : "—"}</strong><small>réservé</small></div>
        </div>
        <div className={styles.capacityDetail}>
          <span className={styles.label}>Place dans les contenants</span>
          <strong>{hasCapacity ? <>{mass(reserved)} <span>/ {mass(capacity)}</span></> : "Actualisation…"}</strong>
          <div className={styles.legend}><span><i />Réservée</span><span><i />{hasCapacity ? `${mass(free)} libres` : "Libre"}</span></div>
          <p>{hasCapacity && reserved > capacity ? "Capacité dépassée : ajoute des contenants." : hasCapacity && capacity === 0 ? "Aucun contenant installé." : "Un contenant entamé reste réservé à son lot."}</p>
        </div>
      </div>
    </div>

    {error && <div className={styles.error} role="alert"><CircleAlert size={18} aria-hidden="true" /><span>{error}</span>{onRetry && <button type="button" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Réessayer</button>}</div>}
    {storage && lots.length > 0 && <div className={styles.counts} aria-label="État des lots">
      <span><Check size={15} aria-hidden="true" /><b>{readyCount}</b> {readyCount > 1 ? "lots prêts pour l’atelier" : "lot prêt pour l’atelier"}</span>
      <span><Clock3 size={15} aria-hidden="true" /><b>{curingCount}</b> en curing</span>
      {overflow > 0 && <span data-warning><CircleAlert size={15} aria-hidden="true" /><b>{mass(overflow)}</b> sans contenant</span>}
    </div>}

    <div className={styles.lots}>
      {lots.map(lot => {
        const { projection } = lot;
        const ready = projection.stage === "ready";
        const lotCapacity = projection.capacity;
        const total = lotCapacity?.totalUnits ?? lot.harvestGrams * 10;
        const surplus = lotCapacity?.overflowUnits ?? 0;
        const canProcess = ready && surplus === 0;
        const progress = ready ? 100 : percent(projection.progressPercent);
        const allocations = lotCapacity?.allocations ?? [];
        const representative = [...allocations].sort((a, b) => b.storedUnits - a.storedUnits)[0];
        const artwork = representative ? KQ_STORAGE_CONTAINER_ARTWORK[representative.containerCode] : null;
        const containerCount = allocations.reduce((sum, item) => sum + item.quantity, 0);
        const protectedPercent = lotCapacity && total > 0 ? percent(lotCapacity.protectedUnits / total * 100) : 0;
        const quality = Math.max(0, Math.min(10, projection.conditionScore));

        return <article key={lot.flowerId} className={styles.lot} data-conservation-lot={lot.flowerId} data-ready={canProcess}>
          <div className={styles.containerArt}>
            {artwork ? <Image src={artwork.src} alt="" width={220} height={220} sizes="(max-width: 600px) 96px, 160px" /> : <Package className={styles.placeholderArt} size={64} aria-hidden="true" />}
            <div><strong>{projection.methodName}</strong><small>{containerCount > 0 ? `${containerCount} contenant${containerCount > 1 ? "s" : ""} occupé${containerCount > 1 ? "s" : ""}` : "Contenants à attribuer"}</small></div>
          </div>
          <div className={styles.lotBody}>
            <header className={styles.lotHeader}>
              <div><small>Lot {lot.flowerId.slice(0, 8)}</small><h4>{lot.varietyName}</h4></div>
              <span className={styles.badge} data-state={surplus > 0 ? "warning" : ready ? "ready" : "curing"} data-curing-status>
                {surplus > 0 ? <CircleAlert size={15} aria-hidden="true" /> : ready ? <Check size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
                {surplus > 0 ? "Contenant manquant" : ready ? "Prêt pour l’atelier" : "Curing en cours"}
              </span>
            </header>
            <div className={styles.lotMetrics}>
              <div className={styles.lotMass}><span>Stock restant</span><strong>{mass(total / 10)}</strong><small>Récolte initiale : {mass(lot.harvestGrams)}</small></div>
              <div className={styles.curing}>
                <div className={styles.curingTitle}><strong>{ready ? "Curing terminé" : "Affinage (curing)"}</strong><span>{ready ? 100 : Math.min(99, Math.floor(progress))} %</span></div>
                <div className={styles.track} role="progressbar" aria-label={`Affinage du lot ${lot.varietyName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} data-curing-progress><span style={{ width: `${progress}%` }} /></div>
                <ol className={styles.steps} aria-label="Parcours de la récolte">
                  <li data-done><Check size={13} aria-hidden="true" />Récolté</li>
                  <li data-done={ready} data-current={!ready}>{ready ? <Check size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}Curing</li>
                  <li data-done={ready}><Leaf size={13} aria-hidden="true" />Affiné</li>
                </ol>
                {!ready && <p className={styles.remaining}>{remainingLabel(projection.remainingMs)}<span>Prêt le {dateLabel(projection.readyAt)}</span></p>}
              </div>
            </div>

            {lotCapacity && <div className={styles.protection}>
              <div><span><ShieldCheck size={14} aria-hidden="true" />{mass(lotCapacity.protectedUnits / 10)} en contenant</span>{surplus > 0 ? <span data-warning>{mass(surplus / 10)} sans contenant</span> : <span>Tout le lot est protégé</span>}</div>
              <div className={styles.protectionTrack} role="meter" aria-label={`Part du lot ${lot.varietyName} en contenant`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={protectedPercent} aria-valuetext={`${mass(lotCapacity.protectedUnits / 10)} en contenant sur ${mass(total / 10)}`}><span style={{ width: `${protectedPercent}%` }} /></div>
            </div>}

            <div className={styles.quality} data-lot-quality>
              <div><span>{ready ? "Qualité en sortie" : "Qualité actuelle"}</span><strong>{quality.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}<small>/10</small></strong></div>
              <div>
                <div className={styles.qualityScale} role="meter" aria-label={`Qualité commerciale du lot ${lot.varietyName}`} aria-valuemin={0} aria-valuemax={10} aria-valuenow={quality}>{Array.from({ length: 10 }, (_, index) => <i key={index} style={{ "--quality-fill": `${percent((quality - index) * 100)}%` } as CSSProperties} />)}</div>
                {projection.postHarvest ? <p><span>Séchage <b>+{projection.postHarvest.dryingQualityBonus.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</b></span><span>Curing acquis <b>+{projection.postHarvest.curingQualityBonus.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</b></span></p> : <p>Qualité commerciale du lot, après conservation.</p>}
              </div>
            </div>

            {surplus > 0 ? <div className={styles.overflow}>
              <p><CircleAlert size={17} aria-hidden="true" /><strong>{mass(surplus / 10)} à stocker ou à vendre</strong></p>
              <p>Ajoute des contenants ou vends le surplus au grossiste. Le reste du lot demeure stocké.</p>
              {lotCapacity?.overflowDeadlineAt && <p data-overflow-deadline>Vente automatique le {dateLabel(lotCapacity.overflowDeadlineAt)}.</p>}
              {lot.overflowOffer ? <>
                <button type="button" className={styles.action} data-sell-overflow={lot.flowerId} disabled={disabled} onClick={() => onSellOverflow(lot.flowerId)}>Vendre le surplus · {mass(lot.overflowOffer.units / 10)} <ArrowRight size={17} aria-hidden="true" /></button>
                <small>{formatKqCash(lot.overflowOffer.payoutCents)} TTC · environ {formatKqCash(lot.overflowOffer.netPayoutCents)} nets après TVA et charges. Montant recalculé à la vente, selon le quota grossiste.</small>
              </> : <small>Aucune offre de reprise disponible pour le moment.</small>}
            </div> : <footer className={styles.lotFooter}>
              <span>{ready ? <><Check size={16} aria-hidden="true" />Ton lot peut être transformé.</> : <><Clock3 size={16} aria-hidden="true" />L’atelier s’ouvre à la fin du curing.</>}</span>
              <button type="button" className={styles.action} data-open-workshop={lot.flowerId} disabled={!canProcess} onClick={() => onOpenWorkshop(lot.flowerId)}><Factory size={17} aria-hidden="true" />{ready ? "Utiliser ce lot à l’atelier" : "Curing en cours"}{ready && <ArrowRight size={17} aria-hidden="true" />}</button>
            </footer>}
          </div>
        </article>;
      })}
    </div>
    {!lots.length && <div className={styles.empty} role="status"><Package size={32} aria-hidden="true" /><strong>{storage ? "Aucune récolte en conservation" : error ? "Les lots ne sont pas disponibles" : "Chargement des récoltes…"}</strong><p>{storage ? "Tes prochains lots apparaîtront ici pour suivre leur curing et les envoyer à l’atelier." : error ? "Réessaie pour retrouver leur état de conservation." : "Le stock et l’avancement de chaque lot arrivent ici."}</p></div>}
  </section>;
}
