"use client";

import { useSyncExternalStore } from "react";
import { getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import type { KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";
import styles from "./KqTentSelector.module.css";

export type KqTentOverview = {
  tentNumber: number;
  equippedCodes: string[];
  levels: Record<string, number>;
  ownedCodes?: string[];
  purchasedCodes?: string[];
  maintenance?: Record<string, KqMachineCondition>;
  cultureWear?: Record<string, KqCultureEquipmentCondition>;
};

const STORAGE_KEY = "kq:selected-tent";
export type KqSharedEquipmentOverview = {
  ownedCodes: string[];
  purchasedCodes: string[];
  equippedCodes: string[];
  levels: Record<string, number>;
  maintenance: Record<string, KqMachineCondition>;
  cultureWear?: Record<string, KqCultureEquipmentCondition>;
};

const CHANGE_EVENT = "kq:tent-selected";
let selectedInMemory = 1;

function readSelectedTent() {
  try {
    const value = Number(window.sessionStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value >= 1 && value <= 8 ? value : selectedInMemory;
  } catch { return selectedInMemory; }
}

export function selectKqTent(tentNumber: number) {
  if (!Number.isInteger(tentNumber) || tentNumber < 1 || tentNumber > 8) return;
  selectedInMemory = tentNumber;
  try { window.sessionStorage.setItem(STORAGE_KEY, String(tentNumber)); } catch { /* Selection still works for this page. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useKqTentSelection() {
  return useSyncExternalStore(subscribe, readSelectedTent, () => 1);
}

export function KqTentSelector({ tents, tentNumber, disabled, onSelect = selectKqTent }: {
  tents: KqTentOverview[];
  tentNumber: number;
  disabled?: boolean;
  onSelect?: (tentNumber: number) => void;
}) {
  return <div className={styles.selector}>
    <label><span>Tente à équiper</span><select aria-label="Tente à équiper" value={tentNumber} disabled={disabled || tents.length < 2} onChange={event => onSelect(Number(event.target.value))}>
      {tents.length ? tents.map(tent => {
        const code = tent.equippedCodes.find(item => getKqEquipmentDefinition(item)?.slot === "tent");
        const equipment = code ? getKqEquipmentDefinition(code) : null;
        return <option key={tent.tentNumber} value={tent.tentNumber}>Tente {tent.tentNumber} · {equipment?.purchasable ? equipment.name + " · niv. " + (tent.levels[code!] ?? 1) : tent.equippedCodes.some(item => getKqEquipmentDefinition(item)?.purchasable) ? "Tente de départ aménagée" : "Kit de départ"}</option>;
      }) : <option value={tentNumber}>Tente {tentNumber}</option>}
    </select></label>
    <p>Chaque tente a son matériel, ses niveaux et son usure. Seules les machines de transformation sont communes.</p>
  </div>;
}
