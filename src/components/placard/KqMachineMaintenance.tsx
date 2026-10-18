"use client";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Wrench } from "lucide-react";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { formatKqCash, isKqSharedEquipment } from "@/lib/kanab-quest-equipment";
import styles from "./KqEquipmentUpgrade.module.css";
import summaryStyles from "./KqMachineSummaryActions.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";
export function KqMachineMaintenance({ code, condition, cashCents, tentNumber = 1, productionUnits = 1, disabled, onUpdated, onBusyChange, compact = false }: { code: string; tentNumber?: number; productionUnits?: number; condition: KqMachineCondition; cashCents: number; disabled?: boolean; onUpdated: () => void; onBusyChange?: (busy: boolean) => void; compact?: boolean }) {
  const api = useKqTutorialApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ version: number; tentNumber: number; key: string } | null>(null);
  const locked = useRef(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const targetTent = isKqSharedEquipment(code) ? 1 : tentNumber;
  const repair = async () => {
    if (locked.current || condition.cycles <= 0 || cashCents < condition.repairCents || disabled) return;
    locked.current = true; setBusy(true); setError("");
    if (request.current?.version !== condition.version || request.current.tentNumber !== targetTent) request.current = { version: condition.version, tentNumber: targetTent, key: crypto.randomUUID() };
    try {
      const response = await api.request("/api/arena/placard/equipment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "repair", tentNumber: targetTent, expectedUnits: productionUnits, equipmentCode: code, requestKey: request.current.key, expectedVersion: condition.version, expectedCostCents: condition.repairCents,
      }), signal: AbortSignal.timeout(15000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Réparation impossible.");
      api.notify("kq:equipment-updated"); onUpdated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Réparation impossible."); }
    finally { locked.current = false; setBusy(false); }
  };
  if (compact) {
    const health = condition.interval > 0 ? Math.max(0, Math.min(100, Math.round(condition.remaining / condition.interval * 100))) : 0;
    return <section className={summaryStyles.card} data-due={condition.due} aria-label="Entretien de la machine">
      <div className={summaryStyles.heading}>
        <h4 className={summaryStyles.title}><Wrench size={16} aria-hidden="true" />Entretien</h4>
        <span className={summaryStyles.badge}>{condition.due ? "À réparer" : condition.cycles === 0 ? "À jour" : "En service"}</span>
      </div>
      <div className={summaryStyles.overview}>
        <div className={summaryStyles.gauge} style={{ "--gauge-fill": `${health}%` } as CSSProperties} role="progressbar" aria-label="État de la machine" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health} aria-valuetext={`${condition.remaining} lots avant entretien`}>
          <div className={summaryStyles.gaugeCenter}><strong>{health}<small>%</small></strong><span>état</span></div>
        </div>
        <div className={summaryStyles.overviewCopy}>
          <strong>{condition.due ? "Machine à l’arrêt" : `${condition.remaining} lot${condition.remaining > 1 ? "s" : ""} avant entretien`}</strong>
          <p>{condition.due ? "Répare-la pour reprendre." : condition.cycles === 0 ? "Prête pour les prochains lots." : "L’entretien remet l’usure à zéro."}</p>
        </div>
      </div>
      <dl className={summaryStyles.metrics}>
        <div><dt>Lots transformés</dt><dd><strong>{condition.cycles}</strong> / {condition.interval}</dd></div>
        <div><dt>Après entretien</dt><dd><strong>100 %</strong> d’état</dd></div>
      </dl>
      <div className={summaryStyles.actionArea}>
        <button className={summaryStyles.action} data-machine-maintenance type="button" onClick={() => void repair()} disabled={busy || disabled || condition.cycles <= 0 || cashCents < condition.repairCents}>
          {busy ? <LoaderCircle className={summaryStyles.spinner} size={16} aria-hidden="true" /> : condition.cycles === 0 ? <Check size={16} aria-hidden="true" /> : <Wrench size={16} aria-hidden="true" />}
          {busy ? "Entretien…" : condition.cycles === 0 ? "À jour" : `${condition.due ? "Réparer" : "Entretenir"} · ${condition.repairCents === 0 ? "gratuit" : formatKqCash(condition.repairCents)}`}
        </button>
        {condition.cycles > 0 && cashCents < condition.repairCents ? <p className={summaryStyles.hint}>Il manque {formatKqCash(condition.repairCents - cashCents)}.</p> : null}
        {condition.repairCents === 0 ? <p className={summaryStyles.hint}>Entretien gratuit grâce à Bricoleur.</p> : null}
        {error ? <p role="alert" className={summaryStyles.error}>{error} <button className={summaryStyles.retry} type="button" onClick={onUpdated}>Actualiser</button></p> : null}
      </div>
    </section>;
  }
  return <section className={styles.upgrade} aria-label="Entretien de la machine">
    <p><Wrench size={16} />{condition.due ? "Machine à l’arrêt" : `Entretien dans ${condition.remaining} lot${condition.remaining > 1 ? "s" : ""} transformé${condition.remaining > 1 ? "s" : ""}`}</p>
    <progress aria-label="Usure de la machine" value={Math.min(condition.cycles, condition.interval)} max={condition.interval} style={{ width: "100%", accentColor: condition.due ? "#efc451" : "#149b8b" }} />
    <small>{condition.cycles} / {condition.interval} lots transformés · entretien {condition.repairCents === 0 ? "gratuit grâce à Bricoleur" : formatKqCash(condition.repairCents)}.</small>
    {condition.cycles > 0 ? <><p>{condition.due ? "Répare-la pour reprendre les transformations. Tes stocks déjà préparés restent vendables." : "Un entretien maintenant remet le compteur d’usure à zéro, au même prix qu’une réparation."}</p><button type="button" onClick={() => void repair()} disabled={busy || disabled || cashCents < condition.repairCents}>{busy ? "Entretien…" : `${condition.due ? "Réparer" : "Entretenir"} · ${condition.repairCents === 0 ? "gratuit" : formatKqCash(condition.repairCents)}`}</button>{cashCents < condition.repairCents ? <small>Il manque {formatKqCash(condition.repairCents - cashCents)}.</small> : null}</> : null}
    {error ? <p role="alert" className={styles.error}>{error}<button type="button" onClick={onUpdated}>Actualiser</button></p> : null}
  </section>;
}
