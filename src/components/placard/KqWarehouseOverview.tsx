"use client";

import { Check, ChevronRight, CircleAlert, PackageOpen, Settings2, Tent } from "lucide-react";
import { useEffect, useRef } from "react";
import { buildKqTentEquipmentSummary, getKqEquipmentAtLevel, isKqSharedEquipmentSlot, KQ_EQUIPMENT_SLOT_LABELS, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import type { KqSharedEquipmentOverview, KqTentOverview } from "./KqTentSelector";
import styles from "./KqWarehouseOverview.module.css";

const WORKSHOP_SLOTS: KqEquipmentSlot[] = ["sifting", "washing", "filtration", "static-separation", "press", "drying"];
const STATUS_LABELS = { installed: "Installé", missing: "Manquant · nécessaire", optional: "Non installé · optionnel", available: "En réserve · à installer", worn: "Hors service · à remplacer" };

export function KqWarehouseOverview({ tents, sharedEquipment, selectedTentNumber, selectedSlot, disabled, loading, error, onRetry, onSelect }: {
  tents: KqTentOverview[];
  sharedEquipment?: KqSharedEquipmentOverview;
  selectedTentNumber: number;
  selectedSlot: KqEquipmentSlot;
  disabled: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (tentNumber: number, slot: KqEquipmentSlot) => void;
}) {
  const tentList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tentList.current;
    const selected = list?.querySelector<HTMLElement>(`[data-tent-recap="${selectedTentNumber}"]`);
    if (!list || !selected || list.scrollWidth <= list.clientWidth) return;
    const bounds = list.getBoundingClientRect(), card = selected.getBoundingClientRect();
    if (card.left < bounds.left || card.right > bounds.right) list.scrollLeft += card.left - bounds.left;
  }, [tents.length, selectedTentNumber]);
  return <section className={styles.overview} tabIndex={-1} aria-labelledby="warehouse-overview-title" aria-busy={loading}>
    <div className={styles.heading}>
      <div><small>Qui possède quoi ?</small><h3 id="warehouse-overview-title">Le matériel de chaque tente</h3></div>
      <span>{tents.length} tente{tents.length > 1 ? "s" : ""}</span>
    </div>
    <p className={styles.intro}>Chaque tente a son matériel, ses niveaux et son usure. Les machines de transformation sont communes à toutes les tentes.</p>
    {error ? <p className={styles.feedback} role="alert">{error}<button type="button" onClick={onRetry}>Réessayer</button></p>
      : loading && !tents.length ? <p className={styles.feedback} role="status">Chargement du matériel des tentes…</p> : null}
    {tents.length > 1 ? <p className={styles.mobileHint}>Fais défiler les fiches pour comparer tes tentes.</p> : null}
    <div ref={tentList} className={styles.tents} aria-label="Récapitulatif par tente">
      {tents.map(tent => {
        const summary = buildKqTentEquipmentSummary({ ownedCodes: tent.ownedCodes ?? tent.equippedCodes, equippedCodes: tent.equippedCodes, levels: tent.levels, cultureWear: tent.cultureWear });
        return <article key={tent.tentNumber} className={styles.tent} data-tent-recap={tent.tentNumber} data-selected={selectedTentNumber === tent.tentNumber}>
          <header><Tent size={21} aria-hidden="true"/><div><h4>Tente {tent.tentNumber}</h4><small>Entrepôt {Math.floor((tent.tentNumber - 1) / 4) + 1}</small></div>
            <span data-attention={!summary.ready || summary.wornCount > 0}>{summary.missingRequiredCount > 0 ? `${summary.missingRequiredCount} essentiel${summary.missingRequiredCount > 1 ? "s" : ""} à installer` : summary.wornCount > 0 ? "Entretien à prévoir" : "Essentiels en place"}</span>
          </header>
          <ul>{summary.slots.map(item => <li key={item.slot}>
            <button type="button" data-recap-slot={item.slot} data-status={item.status} disabled={disabled} aria-pressed={selectedTentNumber === tent.tentNumber && selectedSlot === item.slot}
              aria-label={`Tente ${tent.tentNumber} · ${item.label} · ${item.equipment?.name ?? item.ownedAlternatives[0]?.name ?? "Aucun équipement"} · ${STATUS_LABELS[item.status]}`}
              onClick={() => onSelect(tent.tentNumber, item.slot)}>
              <span className={styles.slotName}>{item.label}</span>
              <span className={styles.model}>{item.equipment?.name ?? item.ownedAlternatives[0]?.name ?? "Aucun équipement"}{item.equipment?.purchasable ? ` · niv. ${item.level}` : item.equipment ? " · fourni" : ""}</span>
              <small>{item.status === "installed" ? <Check size={12} aria-hidden="true"/> : item.status === "worn" || item.status === "missing" ? <CircleAlert size={12} aria-hidden="true"/> : <PackageOpen size={12} aria-hidden="true"/>}{STATUS_LABELS[item.status]}</small>
              <ChevronRight size={14} className={styles.arrow} aria-hidden="true"/>
            </button>
          </li>)}</ul>
        </article>;
      })}
    </div>
    <section className={styles.shared} aria-labelledby="warehouse-shared-title">
      <div className={styles.sharedHeading}><Settings2 size={22} aria-hidden="true"/><div><h4 id="warehouse-shared-title">Atelier de transformation commun</h4><p>Un seul achat, une installation et un entretien pour toutes les tentes.</p></div></div>
      <ul>{WORKSHOP_SLOTS.filter(isKqSharedEquipmentSlot).map(slot => {
        const code = sharedEquipment?.equippedCodes.find(code => getKqEquipmentAtLevel(code)?.slot === slot);
        const reservedCode = sharedEquipment?.ownedCodes.find(code => getKqEquipmentAtLevel(code)?.slot === slot);
        const equipment = getKqEquipmentAtLevel(code ?? reservedCode ?? "", sharedEquipment?.levels[code ?? reservedCode ?? ""]);
        const due = code ? sharedEquipment?.maintenance[code]?.due : false;
        const status = due ? "À réparer" : code ? "Installé · commun" : reservedCode ? "En réserve · à installer" : "Non acquis";
        return <li key={slot}><button type="button" data-workshop-recap={slot} disabled={disabled} data-status={due ? "worn" : code ? "installed" : "optional"}
          aria-pressed={isKqSharedEquipmentSlot(selectedSlot) && selectedSlot === slot} onClick={() => onSelect(selectedTentNumber, slot)}>
          <span className={styles.slotName}>{KQ_EQUIPMENT_SLOT_LABELS[slot]}</span><strong>{equipment?.name ?? "À acheter selon ta filière"}</strong><small>{status}{equipment && code ? ` · niv. ${sharedEquipment?.levels[code] ?? 1}` : ""}</small><ChevronRight size={14} className={styles.arrow} aria-hidden="true"/>
        </button></li>;
      })}</ul>
    </section>
  </section>;
}
