"use client";

import { useRef, useState } from "react";
import { ArrowUp, Check, LoaderCircle, Sparkles } from "lucide-react";
import { formatKqCash, getKqEquipmentAtLevel, getKqEquipmentImpactLabels, getKqEquipmentUpgradeCost } from "@/lib/kanab-quest-equipment";
import styles from "./KqEquipmentUpgrade.module.css";

export function KqEquipmentUpgrade({ code, level, cashCents, disabled, onUpdated }: {
  code: string; level: number; cashCents: number; disabled?: boolean;
  onUpdated: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completedLevel, setCompletedLevel] = useState(0);
  const request = useRef<{ level: number; key: string } | null>(null);
  const inFlight = useRef(false);
  const cost = getKqEquipmentUpgradeCost(code, level);
  const current = getKqEquipmentAtLevel(code, level);
  if (!current?.purchasable || cost === null && level < 10) return null;
  const next = level < 10 ? getKqEquipmentAtLevel(code, level + 1) : null;
  const currentLabels = getKqEquipmentImpactLabels(current);
  const gains = next ? getKqEquipmentImpactLabels(next).filter((label) => !currentLabels.includes(label)) : [];
  const affordable = cost !== null && cashCents >= cost;
  const tier = level >= 10 ? 10 : level >= 5 ? 5 : 1;

  const upgrade = async () => {
    if (inFlight.current || !affordable || disabled || level < completedLevel) return;
    inFlight.current = true;
    setPending(true); setError(""); setNotice("");
    if (request.current?.level !== level) request.current = { level, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade", equipmentCode: code, expectedLevel: level, requestKey: request.current.key }),
      });
      const result = await response.json() as { error?: string; level: number };
      if (!response.ok) throw new Error(result.error || "Amélioration impossible.");
      setCompletedLevel(result.level);
      setNotice(`Niveau ${result.level} atteint${result.level === 5 || result.level === 10 ? " · nouvelle apparence débloquée !" : " !"}`);
      window.dispatchEvent(new Event("kq:equipment-updated"));
      await onUpdated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Amélioration impossible.");
    } finally { setPending(false); inFlight.current = false; }
  };

  return <section className={styles.upgrade} data-tier={tier} aria-label={`Niveau de ${current.name}`}>
    <div className={styles.heading}><strong>NIV. {level}<small> / 10</small></strong><span>{tier === 10 ? "Expert" : tier === 5 ? "Amélioré" : "Standard"}</span></div>
    <div className={styles.progress} role="progressbar" aria-label="Niveau du matériel" aria-valuemin={1} aria-valuemax={10} aria-valuenow={level}>
      {Array.from({ length: 10 }, (_, index) => <i key={index} data-filled={index < level} />)}
    </div>
    <div className={styles.milestones}><span>1 · Standard</span><span>5 · Nouveau look</span><span>10 · Expert</span></div>
    {next ? <>
      <p><ArrowUp size={14} aria-hidden="true" /> Au niveau {level + 1}</p>
      <ul>{gains.map((gain) => <li key={gain}>{gain}</li>)}</ul>
      {level === 4 || level === 9 ? <p className={styles.evolution}><Sparkles size={16} aria-hidden="true" /> L’apparence évolue au prochain niveau</p> : null}
      <button type="button" disabled={pending || disabled || !affordable || level < completedLevel} onClick={() => void upgrade()}>
        {pending ? <LoaderCircle size={18} aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
        {pending ? "Amélioration…" : `Niveau ${level + 1} · ${formatKqCash(cost!)}`}
      </button>
      {!affordable ? <small>Il manque {formatKqCash(Math.max(0, (cost ?? 0) - cashCents))}.</small> : null}
    </> : <p className={styles.evolution}><Check size={16} aria-hidden="true" /> Niveau maximum atteint</p>}
    <small>Bonus appliqués une fois installé, dès la prochaine partie ou transformation.</small>
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => void onUpdated()}>Actualiser</button></p> : null}
  </section>;
}
