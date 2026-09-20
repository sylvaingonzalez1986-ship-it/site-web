"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { createClientRequestKey } from "@/lib/client-request-key";
import styles from "./KqWarehouseInventory.module.css";

export function KqCultureEquipmentWear({ code, name, condition, cashCents, activeRun, disabled, onUpdated }: {
  code: string;
  name: string;
  condition: KqCultureEquipmentCondition;
  cashCents: number;
  activeRun: boolean;
  disabled?: boolean;
  onUpdated: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replacedVersion, setReplacedVersion] = useState<number | null>(null);
  const request = useRef<{ version: number; costCents: number; key: string } | null>(null);
  const locked = useRef(false);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const replaceButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const unavailable = disabled || activeRun || cashCents < condition.replacementCents || replacedVersion === condition.version;
  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
    else if (wasConfirming.current) replaceButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const replace = async () => {
    if (locked.current || unavailable || !condition.due || !confirming) return;
    locked.current = true;
    setBusy(true);
    setError("");
    if (request.current?.version !== condition.version || request.current.costCents !== condition.replacementCents) {
      request.current = { version: condition.version, costCents: condition.replacementCents, key: createClientRequestKey() };
    }
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replace", equipmentCode: code, requestKey: request.current.key,
          expectedVersion: condition.version, expectedCostCents: condition.replacementCents }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Remplacement impossible.");
      setReplacedVersion(condition.version);
      setConfirming(false);
      window.dispatchEvent(new Event("kq:equipment-updated"));
      onUpdated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Remplacement impossible.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  return <section className={styles.cultureWear} aria-label={`État de ${name}`} data-due={condition.due}>
    <strong>{condition.due ? "Hors service · à remplacer" : `État : ${condition.conditionPercent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}</strong>
    <progress value={condition.conditionPercent} max={100} aria-label={`État de ${name}`} />
    <small>Remplacement : {formatKqCash(condition.replacementCents)} · niveaux conservés.</small>
    {condition.due ? <p>Ses bonus sont désactivés. Le matériel de départ assure le dépannage aux emplacements qui en disposent.</p>
      : <p>L’usure est définitive. Le mode éco ralentit l’usure ; l’intensif l’accélère, encore davantage sous 30 % d’état. En réserve, ce matériel ne s’use pas.</p>}
    {condition.due && replacedVersion !== condition.version ? <>
      {confirming ? <div className={styles.replaceConfirm} role="group" aria-label={`Confirmer le remplacement de ${name}`}>
        <p>Racheter {name} pour <strong>{formatKqCash(condition.replacementCents)}</strong> ? Son état revient à 100 % et ses niveaux sont conservés.</p>
        <button ref={confirmButton} type="button" disabled={busy || unavailable} onClick={() => void replace()}>{busy ? "Remplacement…" : `Confirmer · ${formatKqCash(condition.replacementCents)}`}</button>
        <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Annuler</button>
      </div> : <button ref={replaceButton} type="button" disabled={busy || unavailable} onClick={() => setConfirming(true)}><RefreshCw size={16} aria-hidden="true" />Remplacer · {formatKqCash(condition.replacementCents)}</button>}
      {activeRun ? <small>Termine la culture en cours pour remplacer le matériel.</small> : null}
      {cashCents < condition.replacementCents ? <small>Il manque {formatKqCash(condition.replacementCents - cashCents)}.</small> : null}
    </> : null}
    {replacedVersion === condition.version ? <p role="status">Matériel remplacé. Actualisation de son état…</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}<button type="button" onClick={onUpdated}>Actualiser</button></p> : null}
  </section>;
}
