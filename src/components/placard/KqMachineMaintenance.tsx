"use client";
import { useRef, useState } from "react";
import { Wrench } from "lucide-react";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import styles from "./KqEquipmentUpgrade.module.css";
export function KqMachineMaintenance({ code, condition, cashCents, disabled, onUpdated }: { code: string; condition: KqMachineCondition; cashCents: number; disabled?: boolean; onUpdated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ version: number; key: string } | null>(null);
  const locked = useRef(false);
  const repair = async () => {
    if (locked.current || !condition.due || disabled) return;
    locked.current = true; setBusy(true); setError("");
    if (request.current?.version !== condition.version) request.current = { version: condition.version, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/arena/placard/equipment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "repair", equipmentCode: code, requestKey: request.current.key, expectedVersion: condition.version, expectedCostCents: condition.repairCents,
      }), signal: AbortSignal.timeout(15000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Réparation impossible.");
      window.dispatchEvent(new Event("kq:equipment-updated")); onUpdated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Réparation impossible."); }
    finally { locked.current = false; setBusy(false); }
  };
  return <section className={styles.upgrade} aria-label="Entretien de la machine">
    <p><Wrench size={16} />{condition.due ? "Machine à l’arrêt" : `Entretien dans ${condition.remaining} cycle${condition.remaining > 1 ? "s" : ""}`}</p>
    <progress aria-label="Usure de la machine" value={Math.min(condition.cycles, condition.interval)} max={condition.interval} style={{ width: "100%", accentColor: condition.due ? "#e39164" : "#4dddd0" }} />
    <small>{condition.cycles} / {condition.interval} cultures équipée · réparation {condition.repairCents === 0 ? "gratuite grâce à Bricoleur" : formatKqCash(condition.repairCents)}.</small>
    {condition.due ? <><p>Répare-la pour reprendre les transformations. Tes stocks déjà préparés restent vendables.</p><button type="button" onClick={() => void repair()} disabled={busy || disabled || cashCents < condition.repairCents}>{busy ? "Réparation…" : condition.repairCents === 0 ? "Remettre en route gratuitement" : `Réparer · ${formatKqCash(condition.repairCents)}`}</button>{cashCents < condition.repairCents ? <small>Il manque {formatKqCash(condition.repairCents - cashCents)}.</small> : null}</> : null}
    {error ? <p role="alert" className={styles.error}>{error}<button type="button" onClick={onUpdated}>Actualiser</button></p> : null}
  </section>;
}
