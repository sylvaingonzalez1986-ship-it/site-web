"use client";

import { Check, ChevronDown, ChevronRight, CircleAlert, PackageOpen, Settings2, Tent, Warehouse } from "lucide-react";
import { buildKqTentEquipmentSummary, getKqEquipmentAtLevel, getKqEquipmentBuildingNumber, isKqSharedEquipmentSlot, KQ_BUILDING_EQUIPMENT_SLOTS, KQ_EQUIPMENT_SLOT_LABELS, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import type { KqBuildingEquipmentOverview, KqSharedEquipmentOverview, KqTentOverview } from "./KqTentSelector";
import styles from "./KqWarehouseOverview.module.css";

const WORKSHOP_SLOTS: KqEquipmentSlot[] = ["sifting", "washing", "filtration", "static-separation", "press", "drying"];
const STATUS_LABELS = { installed: "Installé", missing: "Manquant · essentiel", optional: "Option non installée", available: "En réserve · à installer", worn: "Hors service · à remplacer" };

export function KqWarehouseOverview({ tents, buildings = [], equipmentScopeVersion = 2, sharedEquipment, selectedTentNumber, selectedSlot, disabled, loading, error, onRetry, onSelect }: {
  tents: KqTentOverview[];
  buildings?: KqBuildingEquipmentOverview[];
  equipmentScopeVersion?: 2 | 3;
  sharedEquipment?: KqSharedEquipmentOverview;
  selectedTentNumber: number;
  selectedSlot: KqEquipmentSlot;
  disabled: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (tentNumber: number, slot: KqEquipmentSlot) => void;
}) {
  const summaries = tents.map(tent => ({ tent, summary: buildKqTentEquipmentSummary({ ownedCodes: tent.ownedCodes ?? tent.equippedCodes, equippedCodes: tent.equippedCodes, levels: tent.levels, cultureWear: tent.cultureWear, equipmentScopeVersion }) }));
  const attentionCount = summaries.filter(({ summary }) => !summary.ready || summary.wornCount > 0).length;
  return <section className={styles.overview} tabIndex={-1} aria-labelledby="warehouse-overview-title" aria-busy={loading}>
    {error ? <p className={styles.feedback} role="alert">{error}<button type="button" onClick={onRetry}>Réessayer</button></p>
      : loading && !tents.length ? <p className={styles.feedback} role="status">Chargement du matériel des tentes…</p> : null}
    <details className={styles.disclosure} data-warehouse-recap>
      <summary id="warehouse-overview-title" className={styles.heading}>
        <span className={styles.headingIcon}><PackageOpen size={20} aria-hidden="true"/></span>
        <span>Matériel de l’entrepôt<small>{tents.length} tente{tents.length > 1 ? "s" : ""}{equipmentScopeVersion===3?" · Services par bâtiment":""} · Atelier commun{attentionCount > 0 ? ` · ${attentionCount} tente${attentionCount > 1 ? "s" : ""} à vérifier` : ""}</small></span>
        <span className={styles.toggleLabel} aria-hidden="true"><span className={styles.whenClosed}>Afficher</span><span className={styles.whenOpen}>Masquer</span></span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true"/>
      </summary>
      <div className={styles.tents} aria-label="Récapitulatif par tente">
      {summaries.map(({ tent, summary }) => {
        return <details key={tent.tentNumber} className={styles.tent} data-tent-recap={tent.tentNumber} data-selected={selectedTentNumber === tent.tentNumber}>
          <summary><Tent size={19} aria-hidden="true"/><span className={styles.tentLabel}>Tente {tent.tentNumber}<small>{summary.installedCount} équipement{summary.installedCount > 1 ? "s" : ""} installé{summary.installedCount > 1 ? "s" : ""}{tents.length > 4 ? ` · Entrepôt ${Math.floor((tent.tentNumber - 1) / 4) + 1}` : ""}{selectedTentNumber === tent.tentNumber ? " · sélectionnée" : ""}</small></span>
            <span className={styles.tentStatus} data-attention={!summary.ready || summary.wornCount > 0}>{summary.missingRequiredCount > 0 ? `${summary.missingRequiredCount} essentiel${summary.missingRequiredCount > 1 ? "s" : ""} à installer` : summary.wornCount > 0 ? "Entretien à prévoir" : "Essentiels en place"}</span>
            <ChevronDown size={14} className={styles.chevron} aria-hidden="true"/>
          </summary>
          <ul>{summary.slots.map(item => <li key={item.slot}>
            <button type="button" data-recap-slot={item.slot} data-status={item.status} disabled={disabled} aria-pressed={selectedTentNumber === tent.tentNumber && selectedSlot === item.slot}
              aria-label={`Tente ${tent.tentNumber} · ${item.label} · ${item.equipment?.name ?? item.ownedAlternatives[0]?.name ?? "Aucun équipement"} · ${STATUS_LABELS[item.status]}`}
              onClick={() => onSelect(tent.tentNumber, item.slot)}>
              <span className={styles.slotName}>{item.label}</span>
              <span className={styles.model}>{item.equipment?.name ?? item.ownedAlternatives[0]?.name ?? "Aucun équipement"}{item.equipment?.purchasable ? ` · niv. ${item.level}` : item.equipment ? " · fourni" : ""}</span>
              <small className={styles.status}>{item.status === "installed" ? <Check size={13} aria-hidden="true"/> : item.status === "worn" || item.status === "missing" ? <CircleAlert size={13} aria-hidden="true"/> : <PackageOpen size={13} aria-hidden="true"/>}{STATUS_LABELS[item.status]}</small>
              <ChevronRight size={14} className={styles.arrow} aria-hidden="true"/>
            </button>
          </li>)}</ul>
        </details>;
      })}
      </div>
    {equipmentScopeVersion === 3 ? buildings.map(building => <details key={building.buildingNumber} className={styles.shared} data-building-recap={building.buildingNumber}>
      <summary className={styles.sharedHeading}><Warehouse size={19} aria-hidden="true"/><span>Services de l’entrepôt {building.buildingNumber}<small>Un équipement pour les tentes {building.anchorTentNumber} à {building.anchorTentNumber + 3}</small></span><ChevronDown size={14} className={styles.chevron} aria-hidden="true"/></summary>
      <ul>{KQ_BUILDING_EQUIPMENT_SLOTS.map(slot => {
        const code = building.equippedCodes.find(code => getKqEquipmentAtLevel(code)?.slot === slot);
        const reservedCode = building.ownedCodes.find(code => getKqEquipmentAtLevel(code)?.slot === slot);
        const equipment = getKqEquipmentAtLevel(code ?? reservedCode ?? "", building.levels[code ?? reservedCode ?? ""]);
        const due = code ? building.cultureWear?.[code]?.due || building.maintenance[code]?.due : false;
        const status = due ? "Hors service · à remplacer" : code ? "Installé · bâtiment" : reservedCode ? "En réserve · à installer" : "Non acquis";
        const selectedBuilding = getKqEquipmentBuildingNumber(selectedTentNumber) === building.buildingNumber;
        return <li key={slot}><button type="button" data-building-recap-slot={slot} disabled={disabled} data-status={due ? "worn" : code ? "installed" : reservedCode ? "available" : "optional"}
          aria-pressed={selectedBuilding && selectedSlot === slot} onClick={() => onSelect(selectedBuilding ? selectedTentNumber : building.anchorTentNumber, slot)}>
          <span className={styles.slotName}>{KQ_EQUIPMENT_SLOT_LABELS[slot]}</span><strong>{equipment?.name ?? "À aménager selon tes besoins"}{equipment && code ? ` · niv. ${building.levels[code] ?? 1}` : ""}</strong><small className={styles.status}>{due ? <CircleAlert size={13} aria-hidden="true"/> : code ? <Check size={13} aria-hidden="true"/> : <PackageOpen size={13} aria-hidden="true"/>}{status}</small><ChevronRight size={14} className={styles.arrow} aria-hidden="true"/>
        </button></li>;
      })}</ul>
    </details>) : null}
    <details className={styles.shared} data-shared-recap>
      <summary className={styles.sharedHeading}><Settings2 size={19} aria-hidden="true"/><span>Atelier de transformation<small>Machines communes à toutes les tentes</small></span><ChevronDown size={14} className={styles.chevron} aria-hidden="true"/></summary>
      <ul>{WORKSHOP_SLOTS.filter(isKqSharedEquipmentSlot).map(slot => {
        const code = sharedEquipment?.equippedCodes.find(code => getKqEquipmentAtLevel(code)?.slot === slot);
        const reservedCode = sharedEquipment?.ownedCodes.find(code => getKqEquipmentAtLevel(code)?.slot === slot);
        const equipment = getKqEquipmentAtLevel(code ?? reservedCode ?? "", sharedEquipment?.levels[code ?? reservedCode ?? ""]);
        const due = code ? sharedEquipment?.maintenance[code]?.due : false;
        const status = due ? "À réparer" : code ? "Installé · commun" : reservedCode ? "En réserve · à installer" : "Non acquis";
        return <li key={slot}><button type="button" data-workshop-recap={slot} disabled={disabled} data-status={due ? "worn" : code ? "installed" : reservedCode ? "available" : "optional"}
          aria-pressed={isKqSharedEquipmentSlot(selectedSlot) && selectedSlot === slot} onClick={() => onSelect(selectedTentNumber, slot)}>
          <span className={styles.slotName}>{KQ_EQUIPMENT_SLOT_LABELS[slot]}</span><strong>{equipment?.name ?? "À acheter selon ta filière"}{equipment && code ? ` · niv. ${sharedEquipment?.levels[code] ?? 1}` : ""}</strong><small className={styles.status}>{due ? <CircleAlert size={13} aria-hidden="true"/> : code ? <Check size={13} aria-hidden="true"/> : <PackageOpen size={13} aria-hidden="true"/>}{status}</small><ChevronRight size={14} className={styles.arrow} aria-hidden="true"/>
        </button></li>;
      })}</ul>
    </details>
    </details>
  </section>;
}
