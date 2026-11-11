"use client";

import { useId, useRef, useState } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqProductionFacilities } from "@/lib/kanab-quest-staff-production";
import { KQ_STAFF_PRODUCTION_STEPS } from "@/lib/kanab-quest-staff-weekly";
import type { KqProductionRoute, KqProductionStep } from "@/lib/kanab-quest-staff-production-types";
import type { KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import type { KqStaffConfirmationDraft } from "./KqStaffOperations";
import { KqChapterHeading } from "./KqChapterHeading";
import { KqProgressMeter } from "./KqVisuals";
import { KqStaffProductionFlow } from "./KqStaffProductionFlow";
import styles from "./KqStaffDesk.module.css";
import layout from "./KqStaffProduction.module.css";

const n = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function KqStaffProduction({ snapshot, disabled, prepare, onWeekly }: {
  snapshot: KqStaffSnapshot; disabled: boolean; prepare: (draft: KqStaffConfirmationDraft) => void; onWeekly: (employeeId: string) => void;
}) {
  const production = snapshot.state.production;
  const settings = production?.settings;
  const options = getKqProductionFacilities(snapshot.context);
  const [zoneId, setZone] = useState(settings?.zoneId ?? options.find(zone => zone.available)?.zoneId ?? "");
  const [route, setRoute] = useState<KqProductionRoute>(settings?.route ?? "flower");
  const [budget, setBudget] = useState(String((settings?.maxDailyCostCents ?? 100_000) / 100));
  const [reserve, setReserve] = useState(String((settings?.cashReserveCents ?? 100_000) / 100));
  const employees = snapshot.state.employees.filter(employee => employee.status === "active");
  const [employeeId, setEmployee] = useState(employees[0]?.id ?? "");
  const [step, setStep] = useState<KqProductionStep>("auto");
  const [hours, setHours] = useState("2");
  const workRef = useRef<HTMLDetailsElement>(null);
  const titleId = useId();
  if (snapshot.context.productionVersion !== 1) return null;
  const selected = options.find(zone => zone.zoneId === zoneId);
  const maxDailyCostCents = Math.round(Number(budget) * 100), cashReserveCents = Math.round(Number(reserve) * 100);
  const valid = budget.trim() !== "" && reserve.trim() !== "" && [maxDailyCostCents, cashReserveCents].every(amount => Number.isSafeInteger(amount) && amount >= 0 && amount <= 100_000_000);
  const stats = production?.stats;
  const net = stats ? stats.salesCents - stats.vatCents - stats.costCents : 0;
  const margin = stats ? net - stats.salaryCostCents : 0;
  function configure(enabled: boolean) {
    if (disabled || enabled && (!valid || !selected) || !enabled && !settings) return;
    const rules = enabled ? { zoneId, route, maxDailyCostCents, cashReserveCents }
      : { zoneId: settings!.zoneId, route: settings!.route, maxDailyCostCents: settings!.maxDailyCostCents, cashReserveCents: settings!.cashReserveCents };
    const facility = enabled ? selected : production?.facility;
    if (!facility || !snapshot.context.productionFacility) return;
    prepare({ title: enabled ? "Configurer la production autonome" : "Suspendre les nouveaux cycles",
      description: "Les créneaux utilisent les heures communes du personnel. Les lots restent commerciaux, sans jury, points, XP joueur ni défis. La suspension laisse finir et vendre les lots engagés ; leur espace reste réservé jusqu’au vidage.",
      rows: [["Zone réservée", `${facility.name} · ${n(facility.areaM2)} m²`], ["Filière", rules.route === "flower" ? "Fleurs préparées" : "Hash tamisé"],
        ["Lancement d’un cycle", formatKqCash(facility.cycleCostCents)], ["Dépenses maximum / jour du jeu", formatKqCash(rules.maxDailyCostCents)], ["Trésorerie minimale", formatKqCash(rules.cashReserveCents)],
        ["Séchage réservé", `${n(facility.dryingCapacityGrams)} g`], ["Stockage réservé", `${n(facility.storageCapacityGrams)} g`], ["Débit à la confirmation", formatKqCash(0)]],
      command: { action: "set-production-rules", enabled, ...rules, expectedRevision: snapshot.context.productionFacility.warehouseRevision },
      debitCents: 0, confirmLabel: "Confirmer les règles" });
  }
  function assign() {
    const duration = Number(hours), employee = employees.find(person => person.id === employeeId);
    if (!employee || disabled || !Number.isFinite(duration) || duration < .5 || duration > 7 || !Number.isInteger(duration * 2)) return;
    prepare({ title: "Réserver un créneau autonome", description: "Le salarié travaille selon les lots et les délais disponibles. Les heures réservées ne peuvent pas servir à une autre activité. Les dépenses suivent les limites du circuit.",
      rows: [["Employé", employee.name], ["Activité", KQ_STAFF_PRODUCTION_STEPS[step]], ["Heures réservées", `${n(duration)} h`], ["Durée réelle du créneau", `${n(duration * 10)} min`]],
      command: { action: "assign-production", employeeId, hours: duration, productionStep: step }, debitCents: 0, confirmLabel: "Réserver le créneau" });
  }
  function openAssignment(nextStep: KqProductionStep) {
    setStep(nextStep);
    if (!workRef.current) return;
    workRef.current.open = true;
    requestAnimationFrame(() => workRef.current?.querySelector<HTMLSelectElement>("[data-production-assignment-employee]")?.focus());
  }
  return <section className={`${styles.panel} ${layout.production}`} aria-labelledby={titleId} data-staff-production>
    <KqChapterHeading art="staff" title="Production autonome" titleId={titleId} compact />
    <p>{settings?.enabled ? "Nouveaux cycles autorisés" : production?.lots.length ? "Nouveaux cycles suspendus · lots à terminer" : "Circuit en pause"}{production?.facility ? ` · ${production.facility.name}` : " · une zone de l’Entrepôt est nécessaire"}.</p>
    {stats ? <><dl className={styles.numbers}>
      <div><dt>Ventes encaissées après TVA</dt><dd>{formatKqCash(stats.salesCents - stats.vatCents)}</dd></div>
      <div><dt>Dépenses de production</dt><dd>{formatKqCash(stats.costCents)}</dd></div>
      <div><dt>Marge après salaires imputés</dt><dd>{formatKqCash(margin)}</dd></div>
    </dl><details className={styles.history}><summary>Détail de la marge</summary><p className={styles.muted}>Depuis le {date(stats.startedAt)}. Salaires imputés estimés : {formatKqCash(stats.salaryCostCents)} ; hors amortissement et autres charges de l’entreprise. Le règlement de la paie reste dans Personnel.</p></details></> : null}
    <KqStaffProductionFlow snapshot={snapshot} disabled={disabled} employeeId={employeeId} onEmployee={setEmployee} onAssign={openAssignment} onWeekly={onWeekly} />
    {snapshot.state.tasks.filter(task => task.kind === "production" && task.day === snapshot.calendar.day).map(task => <div key={task.id} className={layout.shift}>
      <KqProgressMeter label={`${snapshot.state.employees.find(employee => employee.id === task.employeeId)?.name ?? "Employé"} · ${KQ_STAFF_PRODUCTION_STEPS[task.productionStep ?? "auto"]}`} value={task.productionWorkedHours ?? 0} max={task.hours} valueLabel={`${n(task.productionWorkedHours ?? 0)} / ${n(task.hours)} h effectuées`} />
      {task.productionReason ? <p role="status">{task.productionReason}</p> : null}
    </div>)}
    <details open={!production} className={styles.history}><summary>Configurer le circuit</summary>
      <fieldset disabled={disabled} className={styles.form}>
        <div className={styles.fields}><label>Zone dédiée<select value={zoneId} onChange={event => setZone(event.target.value)}><option value="">Choisir une zone</option>{options.map(zone => <option key={zone.zoneId} value={zone.zoneId}>{zone.name} · {n(zone.areaM2)} m²{!zone.available ? " · indisponible" : ""}</option>)}</select></label>
          <label>Produit vendu<select value={route} onChange={event => setRoute(event.target.value as KqProductionRoute)}><option value="flower">Fleurs préparées</option><option value="dry-sift">Hash tamisé · tamis réservé</option></select></label></div>
        <div className={styles.fields}><label>Plafond de dépenses / jour (€ du jeu)<input type="number" min="0" max="1000000" step="0.01" value={budget} onChange={event => setBudget(event.target.value)} /></label><label>Trésorerie minimale (€ du jeu)<input type="number" min="0" max="1000000" step="0.01" value={reserve} onChange={event => setReserve(event.target.value)} /></label></div>
        {selected ? <p>Cycle : {formatKqCash(selected.cycleCostCents)} de fournitures et énergie, hors salaires et transformation. Capacité réservée : {n(selected.harvestGrams)} g ; la récolte dépend de la compétence.</p> : <p>Aménage une zone disponible dans l’Entrepôt pour commencer.</p>}
        {selected?.reason ? <p className={styles.callout}>{selected.reason}</p> : null}
        {route === "dry-sift" && !selected?.processingAvailable ? <p className={styles.callout}>Un tamis disponible est nécessaire pour cette filière.</p> : null}
        <div className={styles.actions}><button type="button" disabled={!valid || !selected?.available || route === "dry-sift" && !selected.processingAvailable} onClick={() => configure(true)}>Vérifier et activer</button>{settings?.enabled ? <button type="button" onClick={() => configure(false)}>Suspendre les nouveaux cycles</button> : null}</div>
      </fieldset>
    </details>
    {production?.facility ? <details ref={workRef} className={styles.history} data-production-assignment><summary>Organiser le travail</summary><fieldset disabled={disabled} className={styles.form}>
      <div className={styles.fields}><label>Employé<select data-production-assignment-employee value={employeeId} onChange={event => setEmployee(event.target.value)}><option value="">Choisir un employé</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label>Activité<select value={step} onChange={event => setStep(event.target.value as KqProductionStep)}>{Object.entries(KQ_STAFF_PRODUCTION_STEPS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Heures aujourd’hui<input type="number" min="0.5" max="7" step="0.5" value={hours} onChange={event => setHours(event.target.value)} /></label></div>
      <div className={styles.actions}><button type="button" disabled={!employeeId || !hours || Number(hours) < .5 || Number(hours) > 7 || !Number.isInteger(Number(hours) * 2)} onClick={assign}>Vérifier le créneau</button><button type="button" disabled={!employeeId} onClick={() => onWeekly(employeeId)}>Organiser la semaine</button></div>
    </fieldset></details> : null}
    <details className={styles.history}><summary>Durées, compétences et débouchés</summary><p>Une heure de travail du jeu dure 10 minutes réelles. Les gestes utilisent les heures réservées ; les temps de maturation continuent hors horaires. Un travail inachevé reprend au prochain créneau. Une même personne ne travaille jamais sur deux gestes en parallèle.</p>
      <p>La chaîne complète vend d’abord les produits prêts, assure les gestes de culture arrivés à échéance et les nouveaux cycles autorisés, puis prépare les récoltes. Les spécialistes suivent uniquement leur poste. Les compétences de chaque intervenant déterminent la qualité, la cadence et le prix.</p>
      <p>La demande est limitée à 500 g équivalent fleur par jour du jeu pour toute l’entreprise. Les lots restent commerciaux : aucune entrée au jury, aucun point, aucune XP joueur ni progression de défi.</p>
    </details>
  </section>;
}
