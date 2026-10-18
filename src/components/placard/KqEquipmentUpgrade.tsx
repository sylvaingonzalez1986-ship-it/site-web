"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, LoaderCircle } from "lucide-react";
import { formatKqCash, getKqEquipmentAtLevel, getKqEquipmentBuildingNumber, getKqEquipmentImpactLabels, getKqEquipmentUpgradeCost, isKqBuildingEquipment, isKqSharedEquipment } from "@/lib/kanab-quest-equipment";
import { getChanvrierCareerGate, getChanvrierEquipmentUpgradeRequiredLevel, type ChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import { getKqWorkshopMachineSpecification } from "@/lib/kanab-quest-workshop-machines";
import styles from "./KqEquipmentUpgrade.module.css";
import summaryStyles from "./KqMachineSummaryActions.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqWorkshopTiers } from "./KqWorkshopTiers";

export function KqEquipmentUpgrade({ code, level, cashCents, career, productionUnits = 1, tentNumber = 1, equipmentScopeVersion = 2, disabled, onUpdated, onBusyChange, workshopOnly = false, maintenanceDue = false, compact = false }: {
  career?: ChanvrierCareerSnapshot;
  equipmentScopeVersion?: 2 | 3;
  code: string; level: number; cashCents: number; productionUnits?: number; tentNumber?: number; disabled?: boolean;
  onUpdated: () => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  workshopOnly?: boolean;
  maintenanceDue?: boolean;
  compact?: boolean;
}) {
  const api = useKqTutorialApi();
  const [pending, setPending] = useState(false);
  const [tierBusy, setTierBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completedLevel, setCompletedLevel] = useState(0);
  const request = useRef<{ level: number; units: number; tentNumber: number; key: string } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => { onBusyChange?.(pending || tierBusy); }, [pending, tierBusy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const shared = isKqSharedEquipment(code);
  const building = equipmentScopeVersion === 3 && isKqBuildingEquipment(code);
  const targetTent = shared ? 1 : tentNumber;
  const cost = getKqEquipmentUpgradeCost(code, level, 1);
  const current = getKqEquipmentAtLevel(code, level);
  if (!current?.purchasable || cost === null && level < 10) return null;
  const next = level < 10 ? getKqEquipmentAtLevel(code, level + 1) : null;
  const machine = getKqWorkshopMachineSpecification(code, level);
  const nextMachine = next ? getKqWorkshopMachineSpecification(code, level + 1) : null;
  const currentLabels = getKqEquipmentImpactLabels(current);
  const gains = next ? getKqEquipmentImpactLabels(next).filter((label) => !currentLabels.includes(label)) : [];
  const affordable = cost !== null && cashCents >= cost;
  const careerGate = career ? getChanvrierCareerGate(career.xp, getChanvrierEquipmentUpgradeRequiredLevel(code, level + 1)) : null;
  const tier = level >= 10 ? 10 : level >= 5 ? 5 : 1;

  const upgrade = async () => {
    if (inFlight.current || tierBusy || maintenanceDue || !affordable || !careerGate?.allowed || disabled || level < completedLevel) return;
    inFlight.current = true;
    setPending(true); setError(""); setNotice("");
    if (request.current?.level !== level || request.current.units !== productionUnits || request.current.tentNumber !== targetTent) request.current = { level, units: productionUnits, tentNumber: targetTent, key: crypto.randomUUID() };
    try {
      const response = await api.request("/api/arena/placard/equipment", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade", tentNumber: targetTent, equipmentCode: code, expectedLevel: level, expectedUnits: productionUnits, requestKey: request.current.key }),
      });
      const result = await response.json() as { error?: string; level: number };
      if (!response.ok) throw new Error(result.error || "Amélioration impossible.");
      setCompletedLevel(result.level);
      setNotice(`Amélioration terminée · niveau ${result.level}.`);
      api.notify("kq:equipment-updated");
      await onUpdated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Amélioration impossible.");
    } finally { setPending(false); inFlight.current = false; }
  };

  if (compact) return <section className={summaryStyles.card} aria-label={`Niveau de ${current.name}`}>
    <div className={summaryStyles.heading}>
      <h4 className={summaryStyles.title}><ArrowUp size={16} aria-hidden="true" />Niveau</h4>
      <span className={summaryStyles.badge}>{machine?.tier.label ?? (level >= 7 ? "Avancé" : level >= 4 ? "Aménagement" : "Réglages")}</span>
    </div>
    <div className={summaryStyles.overview}>
      <div className={summaryStyles.gauge} style={{ "--gauge-fill": `${level * 10}%` } as CSSProperties} role="progressbar" aria-label="Niveau du matériel" aria-valuemin={1} aria-valuemax={10} aria-valuenow={level}>
        <div className={summaryStyles.gaugeCenter}><strong>{level}</strong><span>/ 10</span></div>
      </div>
      <div className={summaryStyles.overviewCopy}>
        <strong>{next ? `Prochain niveau : ${level + 1}` : "Niveau maximum"}</strong>
        <p>{nextMachine?.improvement ?? (next ? "Améliore les performances." : "Toutes les améliorations acquises.")}</p>
      </div>
    </div>
    {machine ? <dl className={summaryStyles.metrics}>
      <div><dt>Capacité / lot</dt><dd>{machine.capacityGrams.toLocaleString("fr-FR")}{nextMachine ? <><span> → </span><strong>{nextMachine.capacityGrams.toLocaleString("fr-FR")}</strong></> : null} g</dd></div>
      <div><dt>Précision</dt><dd>{machine.precision.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}{nextMachine ? <><span> → </span><strong>{nextMachine.precision.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</strong></> : null} %</dd></div>
    </dl> : gains.length ? <ul className={summaryStyles.gains}>{gains.map((gain) => <li key={gain}>{gain}</li>)}</ul> : null}
    <div className={summaryStyles.actionArea}>
      <button className={summaryStyles.action} data-machine-upgrade type="button" disabled={!next || pending || tierBusy || maintenanceDue || disabled || !affordable || !careerGate?.allowed || level < completedLevel} onClick={() => void upgrade()}>
        {pending ? <LoaderCircle className={summaryStyles.spinner} size={16} aria-hidden="true" /> : next ? <ArrowUp size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
        {pending ? "Amélioration…" : next ? `Améliorer · niv. ${level + 1} · ${formatKqCash(cost!)}` : "Niveau maximum"}
      </button>
      {next && !careerGate?.allowed ? <p className={summaryStyles.hint}>{careerGate?.reason ?? "Chargement de la progression du Chanvrier…"}</p> : null}
      {next && !affordable ? <p className={summaryStyles.hint}>Il manque {formatKqCash(Math.max(0, (cost ?? 0) - cashCents))}.</p> : null}
      {next && maintenanceDue ? <p className={summaryStyles.hint}>Entretiens cette machine avant de l’améliorer.</p> : null}
      {notice ? <p className={summaryStyles.hint} role="status">{notice}</p> : null}
      {error ? <p role="alert" className={summaryStyles.error}>{error} <button className={summaryStyles.retry} type="button" onClick={() => void onUpdated()}>Actualiser</button></p> : null}
    </div>
  </section>;

  const upgrades = <section className={styles.upgrade} data-tier={tier} aria-label={`Niveau de ${current.name}`}>
    <div className={styles.heading}><strong>NIV. {level}<small> / 10</small></strong><span>{level >= 7 ? "Atelier avancé" : level >= 4 ? "Aménagement" : "Réglages"}</span></div>
    <div className={styles.progress} role="progressbar" aria-label="Niveau du matériel" aria-valuemin={1} aria-valuemax={10} aria-valuenow={level}>
      {Array.from({ length: 10 }, (_, index) => <i key={index} data-filled={index < level} />)}
    </div>
    <div className={styles.milestones}><span>1–3 · Réglages</span><span>4–6 · Aménagement</span><span>7–10 · Atelier avancé</span></div>
    {machine ? <p>{machine.name} · configuration {machine.configuration}/3 · {machine.capacityGrams} g par lot.</p> : null}
    {next ? <>
      <p><ArrowUp size={14} aria-hidden="true" /> Au niveau {level + 1}</p>
      {nextMachine ? <p className={styles.evolution}>{nextMachine.improvement}{nextMachine.configuration !== machine?.configuration ? ` · ${nextMachine.name}` : ""}</p> : null}
      <ul>{gains.map((gain) => <li key={gain}>{gain}</li>)}</ul>
      {!careerGate?.allowed ? <p className={styles.gate}>{careerGate?.reason ?? "Chargement de la progression du Chanvrier…"}</p> : null}
      <button type="button" disabled={pending || tierBusy || maintenanceDue || disabled || !affordable || !careerGate?.allowed || level < completedLevel} onClick={() => void upgrade()}>
        {pending ? <LoaderCircle size={18} aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
        {pending ? "Amélioration…" : `Niveau ${level + 1} · ${formatKqCash(cost!)}`}
      </button>
      {!affordable ? <small>Il manque {formatKqCash(Math.max(0, (cost ?? 0) - cashCents))}.</small> : null}
      {maintenanceDue ? <small>Entretiens cette machine avant de l’améliorer.</small> : null}
    </> : <p className={styles.evolution}><Check size={16} aria-hidden="true" /> Niveau maximum atteint</p>}
    <small>{workshopOnly ? "Cette amélioration s’applique à la machine de ton atelier." : shared ? "Cette amélioration bénéficie à toutes les tentes." : building ? `Cette amélioration bénéficie aux tentes de l’entrepôt ${getKqEquipmentBuildingNumber(tentNumber)}.` : `Cette amélioration concerne uniquement la tente ${tentNumber}.`}</small>
    <small>{workshopOnly ? "Effets appliqués après installation, dès la prochaine transformation." : "Bonus appliqués une fois installé, dès la prochaine partie ou transformation."}</small>
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => void onUpdated()}>Actualiser</button></p> : null}
  </section>;
  return workshopOnly && machine ? <>
    {upgrades}
    <KqWorkshopTiers code={code} level={level} cashCents={cashCents} career={career} maintenanceDue={maintenanceDue} disabled={disabled || pending} onUpdated={onUpdated} onBusyChange={setTierBusy} />
  </> : upgrades;
}
