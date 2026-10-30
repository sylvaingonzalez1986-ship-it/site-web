"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Check, CircleAlert, Clock3, Package, RefreshCw, ShieldCheck, ShoppingBag, Swords } from "lucide-react";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqHarvestStep, getKqStorageHarvestOverview, isKqHarvestBeforeJury, type KqHarvestMarketSection } from "@/lib/kanab-quest-harvests";
import { KQ_STORAGE_CONTAINER_ARTWORK } from "@/lib/kanab-quest-storage-artwork";
import { getKqStoragePlacementAvailability } from "@/lib/kanab-quest-storage-placement";
import { KqProgressMeter } from "./KqVisuals";
import { KqStoragePlacement, openKqStoragePlacement } from "./KqStoragePlacement";
import { KqLotSummary } from "./KqLotSummary";
import styles from "./KqWarehouseHarvests.module.css";

const known = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const mass = (grams: number) => grams >= 1_000
  ? `${(grams / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`
  : `${grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const score = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const dateLabel = (value: string) => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
  : null;

type Props = {
  storage: KqStorageSnapshot | null;
  stockGrams?: number | null;
  storageReservedGrams?: number | null;
  storageCapacityGrams?: number | null;
  initialFlowerId?: string;
  disabled?: boolean;
  error?: string;
  onRetry?: () => void;
  onOpenWorkshop: (flowerId: string, section?: KqHarvestMarketSection) => void;
  onOpenArena?: (flowerId: string) => void;
  juryReturnView?: "harvests" | "workshop";
  onSellOverflow: (flowerId: string) => void;
  onPlace?: (flowerId: string, containerCode: string) => Promise<boolean>;
  onProtectOverflow?: (flowerId: string) => void;
  onOpenHarvests?: (flowerId?: string) => void;
  warehouseHref?: (flowerId: string) => string;
  showOverviewLink?: boolean;
};

export function KqWarehouseHarvests({ storage, stockGrams, storageReservedGrams, storageCapacityGrams, initialFlowerId, disabled = false, error, onRetry, onOpenWorkshop, onOpenArena, juryReturnView = "harvests", onSellOverflow, onPlace, onProtectOverflow, onOpenHarvests, warehouseHref, showOverviewLink = true }: Props) {
  const section = useRef<HTMLElement>(null);
  const selectionNotice = useRef<HTMLDivElement>(null);
  const requestedFlower = useRef(initialFlowerId);
  const focusedFlower = useRef<string | null>(null);
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
  const selectedLot = initialFlowerId ? lots.find(lot => lot.flowerId === initialFlowerId) : undefined;
  const selection = !initialFlowerId ? "none" : error ? "unavailable" : !storage ? "loading" : selectedLot ? "selected" : "missing";

  useEffect(() => {
    if (requestedFlower.current !== initialFlowerId) {
      requestedFlower.current = initialFlowerId;
      focusedFlower.current = null;
    }
    if (!initialFlowerId || selection === "loading" || focusedFlower.current === initialFlowerId) return;
    const frame = requestAnimationFrame(() => {
      const target = selection === "selected"
        ? Array.from(section.current?.querySelectorAll<HTMLElement>("[data-conservation-lot]") ?? []).find(node => node.dataset.conservationLot === initialFlowerId)
        : selectionNotice.current;
      if (!target) return;
      focusedFlower.current = initialFlowerId;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialFlowerId, selection, storage]);

  function retrySelection() {
    // An explicit retry may move back to the requested lot; routine polling
    // must never take focus away from a quantity, button or equipment choice.
    focusedFlower.current = null;
    onRetry?.();
  }

  return <section ref={section} className={styles.section} aria-label="Récoltes en conservation" data-conservation-summary>
    <header className={styles.heading}>
      <div><h3>Mes fleurs stockées</h3>
        {storage && lots.length > 0 && <div className={styles.counts} aria-label="État des lots">
          {known(lotMass) && <span><Package size={14} aria-hidden="true" /><b>{mass(lotMass)}</b></span>}
          <span><Check size={14} aria-hidden="true" /><b>{readyCount}</b> {readyCount > 1 ? "lots affinés" : "lot affiné"}</span>
          <span><Clock3 size={14} aria-hidden="true" /><b>{curingCount}</b> en affinage</span>
          {overflow > 0 && <span data-warning><CircleAlert size={14} aria-hidden="true" /><b>{mass(overflow)}</b> sans contenant</span>}
        </div>}
      </div>
      {showOverviewLink && (onOpenHarvests ? <button type="button" onClick={() => onOpenHarvests(initialFlowerId)}>Toutes mes récoltes <ArrowRight size={16} aria-hidden="true" /></button> : <Link href={`/arene/placard?view=harvests${initialFlowerId ? `&flower=${encodeURIComponent(initialFlowerId)}` : ""}`}>Toutes mes récoltes <ArrowRight size={16} aria-hidden="true" /></Link>)}
    </header>

    {error && !initialFlowerId && <div className={styles.error} role="alert"><CircleAlert size={18} aria-hidden="true" /><span>{error}</span>{onRetry && <button type="button" disabled={disabled} onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Réessayer</button>}</div>}
    {initialFlowerId && selection !== "selected" ? <div ref={selectionNotice} className={styles.selectionNotice} data-storage-selection={selection} tabIndex={-1} role={selection === "unavailable" ? "alert" : "status"}>
      <div><strong>Lot {initialFlowerId.slice(0, 8)}</strong><p>{selection === "loading" ? "Recherche dans le stockage…" : selection === "missing" ? "Ce lot n’apparaît plus dans le stockage. Il a pu être vendu ou transformé." : "Impossible de vérifier ce lot pour le moment."}</p>{selection === "unavailable" && error ? <small>{error}</small> : null}</div>
      {onRetry && selection !== "loading" ? <button type="button" data-storage-selection-retry disabled={disabled} onClick={retrySelection}><RefreshCw size={15} aria-hidden="true" /> Réessayer</button> : null}
    </div> : null}

    <div className={styles.lots}>
      {lots.map(lot => {
        const { projection } = lot;
        const ready = projection.stage === "ready";
        const beforeJury = isKqHarvestBeforeJury(lot);
        const step = getKqHarvestStep(lot.flowerStatus, projection);
        const inDuel = step === "duel" || step === "queued";
        const juryLabel = inDuel ? "Suivre le duel" : "Présenter au jury";
        const juryHref = `/arene/placard?view=arena&flower=${encodeURIComponent(lot.flowerId)}&from=${juryReturnView}&fromSection=storage&fromFlower=${encodeURIComponent(lot.flowerId)}`;
        const lotCapacity = projection.capacity;
        const total = known(lotCapacity?.totalUnits) ? lotCapacity.totalUnits / 10 : null;
        const surplus = lotCapacity?.overflowUnits ?? 0;
        const protectedGrams = known(lotCapacity?.protectedUnits) ? lotCapacity.protectedUnits / 10 : null;
        const readyDate = dateLabel(projection.readyAt);
        const allocations = lotCapacity?.allocations ?? [];
        const representative = [...allocations].sort((a, b) => b.storedUnits - a.storedUnits)[0];
        const artwork = representative ? KQ_STORAGE_CONTAINER_ARTWORK[representative.containerCode] : null;
        const containerCount = allocations.reduce((sum, item) => sum + item.quantity, 0);
        const placement = getKqStoragePlacementAvailability(storage, lot.flowerId);

        const selected = selection === "selected" && lot.flowerId === initialFlowerId;
        return <article key={lot.flowerId} className={styles.lot} data-conservation-lot={lot.flowerId} data-ready={ready && lotCapacity?.overflowUnits === 0} data-selected={selected || undefined} data-storage-selection={selected ? "selected" : undefined} aria-label={`Lot ${lot.varietyName} · ${lot.flowerId.slice(0, 8)}`} tabIndex={-1}>
          <div className={styles.lotSheet}>
            <KqLotSummary source={{ kind: "storage", lot }} level={4} selected={selected} artwork={artwork ? <Image src={artwork.src} alt="" width={64} height={64} sizes="48px" /> : <Package size={30} />}>
            <div className={styles.lotAction}>
              {step === "storage" ? onRetry ? <button type="button" className={styles.action} disabled={actionsDisabled} onClick={onRetry}>Vérifier le lot <RefreshCw size={16} aria-hidden="true" /></button> : <span>État du lot à vérifier</span> : beforeJury ? step === "jury" || inDuel ? <>
                {onOpenArena ? <button type="button" className={styles.action} data-open-jury={lot.flowerId} disabled={actionsDisabled} onClick={() => onOpenArena(lot.flowerId)}><Swords size={16} aria-hidden="true" />{juryLabel}<ArrowRight size={16} aria-hidden="true" /></button>
                  : <Link className={styles.action} data-open-jury={lot.flowerId} href={juryHref} aria-disabled={actionsDisabled || undefined} onClick={event => { if (actionsDisabled) event.preventDefault(); }}><Swords size={16} aria-hidden="true" />{juryLabel}<ArrowRight size={16} aria-hidden="true" /></Link>}
              </> : null : surplus > 0 ? null : <>
                <button type="button" className={styles.action} data-open-workshop={lot.flowerId} data-open-commerce={lot.flowerId} disabled={actionsDisabled} onClick={() => onOpenWorkshop(lot.flowerId, step === "empty" ? "dashboard" : "sales")}><ShoppingBag size={16} aria-hidden="true" />{step === "empty" ? "Voir mon stock en vente" : ready ? "Préparer la vente" : "Voir l’offre grossiste"}<ArrowRight size={16} aria-hidden="true" /></button>
              </>}
            </div></KqLotSummary>
          </div>

          {surplus > 0 && <div className={styles.overflow}>
            <div><strong>{mass(surplus / 10)} {beforeJury ? "à protéger avant le jury" : "à stocker ou à vendre"}</strong><p>{beforeJury ? "Range ces fleurs dans des contenants pour profiter des gains d’affinage. La vente sera disponible après le jury." : "Range le surplus dans tes contenants ou consulte l’offre du grossiste. Le reste du lot demeure stocké."}</p>
              {placement.status === 'insufficient' ? <p>Aucun modèle installé n’a assez de contenants disponibles pour ranger ce lot entier.</p> : placement.status === 'unknown' ? <p>La disponibilité des contenants reste à confirmer.</p> : null}
              {!beforeJury && lotCapacity?.overflowDeadlineAt && dateLabel(lotCapacity.overflowDeadlineAt) && <p data-overflow-deadline>Vente automatique le {dateLabel(lotCapacity.overflowDeadlineAt)}.</p>}
            </div>
            <div className={styles.overflowActions}>
              {placement.status === 'insufficient' ? onProtectOverflow ? <button type="button" className={styles.action} data-protect-overflow={lot.flowerId} disabled={actionsDisabled} onClick={() => onProtectOverflow(lot.flowerId)}><Package size={17} aria-hidden="true" />Ajouter des contenants<ArrowRight size={17} aria-hidden="true" /></button> : warehouseHref ? <Link className={styles.action} data-protect-overflow={lot.flowerId} aria-disabled={actionsDisabled || undefined} onClick={event => { if (actionsDisabled) event.preventDefault(); }} href={warehouseHref(lot.flowerId)}><Package size={17} aria-hidden="true" />Ajouter des contenants<ArrowRight size={17} aria-hidden="true" /></Link> : null : null}
              {onPlace ? <button type="button" className={placement.status === 'insufficient' ? styles.protect : styles.action} data-open-placement={lot.flowerId} disabled={actionsDisabled} onClick={() => openKqStoragePlacement(section.current, lot.flowerId)}><Package size={17} aria-hidden="true" />{placement.status === 'available' ? 'Choisir un contenant' : 'Vérifier les contenants'}<ArrowRight size={17} aria-hidden="true" /></button> : null}
              {!beforeJury && lot.overflowOffer ? <>
              <button type="button" className={styles.action} data-sell-overflow={lot.flowerId} disabled={actionsDisabled} onClick={() => onSellOverflow(lot.flowerId)}>Vendre le surplus · {mass(lot.overflowOffer.units / 10)} <ArrowRight size={17} aria-hidden="true" /></button>
              <small>{formatKqCash(lot.overflowOffer.payoutCents)} TTC · environ {formatKqCash(lot.overflowOffer.netPayoutCents)} nets après TVA et charges. Montant recalculé à la vente, selon le quota grossiste.</small>
            </> : !beforeJury ? <small>Aucune offre de reprise disponible pour le moment.</small> : null}</div>
          </div>}

          {storage && onPlace && step !== "empty" && <KqStoragePlacement snapshot={storage} flowerId={lot.flowerId} disabled={actionsDisabled} onPlace={onPlace} onRetry={onRetry} />}
          <details className={styles.lotDetails} data-lot-details>
            <summary><span>Détails du lot</span><small>{known(protectedGrams) ? <><ShieldCheck size={13} aria-hidden="true" />{mass(protectedGrams)} en contenant</> : "Répartition à confirmer"}</small></summary>
            <div className={styles.detailsBody}>
              <div><strong>{projection.methodName}</strong><p>{total === 0 ? "Aucun vrac à ranger" : containerCount > 0 ? `${containerCount} contenant${containerCount > 1 ? "s" : ""} occupé${containerCount > 1 ? "s" : ""}` : "Contenants à attribuer"} · Lot {lot.flowerId.slice(0, 8)}</p>
                <p>Récolte initiale : {known(lot.harvestGrams) ? mass(lot.harvestGrams) : "à confirmer"}.{!known(total) && " Quantité restante à confirmer."}</p>
                {!ready && <><p>{readyDate ? <>Maturité prévue le <time dateTime={projection.readyAt}>{readyDate}</time>.</> : "Date de maturité à confirmer."}</p><p>{beforeJury ? "L’affinage avance aussi hors connexion. Sa fin permet de présenter le lot au jury, puis de vendre après le verdict." : "L’affinage avance aussi hors connexion. Les boutiques attendent sa fin ; le grossiste peut reprendre plus tôt, selon son quota."}</p></>}
              </div>
              <div className={styles.detailMeters}>
                {known(total) && known(protectedGrams) && total > 0 && <KqProgressMeter label="Fleurs en contenant" value={protectedGrams} max={total} valueLabel={`${mass(protectedGrams)} / ${mass(total)}`} tone={surplus > 0 ? "gold" : "teal"} />}
                {projection.postHarvest && <p>Séchage <b>+{score(projection.postHarvest.dryingQualityBonus)}</b> · Affinage acquis <b>+{score(projection.postHarvest.curingQualityBonus)}</b></p>}
              </div>
            </div>
          </details>
        </article>;
      })}
    </div>
    {!lots.length && !initialFlowerId && <div className={styles.empty} role="status"><Package size={28} aria-hidden="true" /><strong>{storage ? "Aucune récolte en conservation" : error ? "Les lots ne sont pas disponibles" : "Chargement des récoltes…"}</strong><p>{storage ? "Tes prochaines récoltes apparaîtront ici : choisis leurs contenants, suis leur affinage, puis présente leur Fleur d’Arène au jury avant la vente." : error ? "Réessaie pour retrouver leur état de conservation." : "Le stock et l’avancement de chaque lot arrivent ici."}</p></div>}

    <details className={styles.storageDetails} data-storage-summary-details>
      <summary><span>Stock et capacité</span><small>{known(free) ? `${mass(free)} de capacité disponible` : "Capacité à confirmer"}</small></summary>
      <div className={styles.detailsBody}>
        {stockGrams !== undefined ? <div><span className={styles.label}>Stock de l’entrepôt</span><strong className={styles.stockValue}>{known(stockGrams) ? mass(stockGrams) : "À confirmer"}</strong><p>Le total inclut les autres produits stockés. Quantités en équivalent fleurs après transformation.</p></div> : <div><strong>Une place réservée pour chaque lot</strong><p>La capacité réservée inclut les contenants partiellement remplis et les autres produits stockés. Elle diffère du poids de fleurs restant.</p></div>}
        <div data-conservation-capacity data-full={hasCapacity && reserved > capacity}>
          {hasCapacity && capacity > 0 ? <KqProgressMeter label="Capacité réservée" value={reserved} max={capacity} valueLabel={`${mass(reserved)} / ${mass(capacity)}`} tone={reserved > capacity ? "red" : "teal"} /> : <strong>{hasCapacity ? "Aucun contenant installé" : "Capacité à confirmer"}</strong>}
          <p>{hasCapacity && reserved > capacity ? "Capacité dépassée : agrandis le stockage." : "La capacité de l’entrepôt accueille les contenants réservés aux lots et les paquets déjà préparés pour Commerce. Un contenant entamé reste réservé à son lot."}</p>
        </div>
      </div>
    </details>
  </section>;
}
