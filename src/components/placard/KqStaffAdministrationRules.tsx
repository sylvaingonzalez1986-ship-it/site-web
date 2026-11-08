"use client";

import { useState, type FormEvent } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import type { KqStaffConfirmationDraft } from "./KqStaffOperations";
import { KqPrintedArt } from "./KqPrintedArt";
import styles from "./KqStaffAdministrationRules.module.css";

type Props = { snapshot: KqStaffSnapshot; prepare: (draft: KqStaffConfirmationDraft) => void; disabled: boolean };
const eurosToCents = (value: string) => /^\d+(?:[.,]\d{1,2})?$/.test(value) ? Math.round(Number(value.replace(",", ".")) * 100) : NaN;

/** Editing is a draft. Recurring payments start only after the existing confirmation dialog. */
function RulesForm({ snapshot, prepare, disabled }: Props) {
  const saved = snapshot.state.administrationRules;
  const employees = snapshot.state.employees.filter(employee => employee.status === "active");
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [employeeId, setEmployeeId] = useState(saved?.employeeId ?? employees[0]?.id ?? "");
  const [paySuppliers, setPaySuppliers] = useState(saved?.paySuppliers ?? true);
  const [payPayroll, setPayPayroll] = useState(saved?.payPayroll ?? false);
  const [budget, setBudget] = useState(String((saved?.maxDailyCents ?? 100_000) / 100));
  const [reserve, setReserve] = useState(String((saved?.cashReserveCents ?? 100_000) / 100));
  const [supplierDueDays, setSupplierDueDays] = useState(saved?.supplierDueDays ?? 1);
  const maxDailyCents = eurosToCents(budget), cashReserveCents = eurosToCents(reserve);
  const employee = employees.find(person => person.id === employeeId);
  const validAmounts = Number.isSafeInteger(maxDailyCents) && maxDailyCents >= (enabled ? 1 : 0) && maxDailyCents <= 100_000_000
    && Number.isSafeInteger(cashReserveCents) && cashReserveCents >= 0 && cashReserveCents <= 100_000_000;
  const valid = validAmounts && (!enabled || !!employee && (paySuppliers || payPayroll));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || disabled) return;
    prepare({
      title: enabled ? "Autoriser les paiements délégués" : "Désactiver les paiements délégués",
      description: enabled
        ? "Pendant ses futures missions Administration, ce salarié pourra régler les documents autorisés. Chaque document mobilise 0,5 h de sa mission. Les paiements complets respectent ton plafond quotidien et le solde minimum ; les autres restent en attente."
        : "Les missions continueront à négocier des remises. Le salarié ne lancera plus de paiement délégué avec ces règles.",
      rows: [["Responsable", employee?.name ?? "Aucun"], ["Factures fournisseurs", enabled && paySuppliers ? `Échéances d’ici ${supplierDueDays} jour${supplierDueDays > 1 ? "s" : ""} du jeu` : "Non autorisées"],
        ["Salaires échus", enabled && payPayroll ? "Autorisés" : "Non autorisés"], ["Plafond / jour du jeu", formatKqCash(maxDailyCents)],
        ["Solde à conserver après paiement", formatKqCash(cashReserveCents)], ["Débit à cette confirmation", formatKqCash(0)]],
      command: { action: "set-administration-rules", enabled, employeeId: employee?.id ?? null, paySuppliers, payPayroll, maxDailyCents, cashReserveCents, supplierDueDays },
      debitCents: 0, confirmLabel: enabled ? "Autoriser ces règles" : "Désactiver",
    });
  }
  return <form onSubmit={submit} data-staff-admin-rules-form>
    <fieldset disabled={disabled} className={styles.form}>
      <div className={styles.choices}>
        <button type="button" aria-pressed={enabled} onClick={() => setEnabled(!enabled)} data-staff-admin-toggle>{enabled ? "Paiements autorisés" : "Paiements désactivés"}</button>
      </div>
      <label>Responsable<select value={employeeId} onChange={event => setEmployeeId(event.target.value)} data-staff-admin-employee>
        <option value="">Choisir un salarié</option>{employees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select></label>
      <div className={styles.choices} role="group" aria-label="Documents autorisés">
        <button type="button" aria-pressed={paySuppliers} onClick={() => setPaySuppliers(!paySuppliers)} data-staff-admin-suppliers>Factures fournisseurs</button>
        <button type="button" aria-pressed={payPayroll} onClick={() => setPayPayroll(!payPayroll)} data-staff-admin-payroll>Salaires échus</button>
      </div>
      <div className={styles.fields}>
        <label>Plafond par jour du jeu (€)<input value={budget} onChange={event => setBudget(event.target.value)} inputMode="decimal" required data-staff-admin-budget /></label>
        <label>Solde minimum à garder (€)<input value={reserve} onChange={event => setReserve(event.target.value)} inputMode="decimal" required data-staff-admin-reserve /></label>
        <label>Factures à traiter<select value={supplierDueDays} onChange={event => setSupplierDueDays(Number(event.target.value))} disabled={disabled || !paySuppliers}>
          {[0, 1, 3, 7].map(days => <option value={days} key={days}>{days === 0 ? "Déjà échues" : `D’ici ${days} jour${days > 1 ? "s" : ""} du jeu`}</option>)}
        </select></label>
      </div>
      <div className={styles.notes}>
        <p><strong>0,5 h = 1 document.</strong> Prévois un créneau Administration à la journée ou dans la semaine type. Les nouveaux réglages concernent les missions démarrées après confirmation.</p>
        <p>Le plafond couvre factures et salaires ensemble. Le solde minimum concerne ces paiements délégués ; les prélèvements habituels du jeu continuent selon leurs propres règles.</p>
      </div>
      {!validAmounts ? <p role="status" className={styles.error}>Indique un plafond de 0,01 à 1 000 000 € et un solde minimum de 0 à 1 000 000 €, avec deux décimales au maximum.</p> : null}
      {enabled && !employee ? <p role="status" className={styles.error}>Choisis un salarié en poste.</p> : null}
      {enabled && !paySuppliers && !payPayroll ? <p role="status" className={styles.error}>Autorise au moins une catégorie de documents.</p> : null}
      <button type="submit" disabled={disabled || !valid} data-staff-admin-review>Vérifier les règles</button>
    </fieldset>
  </form>;
}

export function KqStaffAdministrationRules(props: Props) {
  const { snapshot } = props;
  if (snapshot.context.staffBenefitsVersion !== 1) return null;
  const saved = snapshot.state.administrationRules;
  const employee = snapshot.state.employees.find(person => person.id === saved?.employeeId && person.status === "active");
  const last = snapshot.benefits?.lastAdministration;
  const reasons = { "no-eligible-documents": "Aucun document à régler dans la période choisie.", "budget-or-reserve": "Des documents attendent : plafond quotidien ou solde minimum atteint.", "capacity-reached": "Créneau utilisé. Les documents restants attendent une prochaine mission." };
  return <details className={styles.panel} data-staff-admin-rules>
    <summary><span className={styles.art} aria-hidden="true"><KqPrintedArt kind="help-accounts" /></span><span><strong>Paiements délégués</strong><small>{saved?.enabled ? employee ? `${employee.name} · ${formatKqCash(saved.maxDailyCents)} maximum / jour` : "Responsable à remplacer" : "Désactivés · à configurer"}</small></span></summary>
    {last ? <div className={styles.lastResult} data-staff-admin-last-result><strong>{last.paidCount} document{last.paidCount === 1 ? "" : "s"} réglé{last.paidCount === 1 ? "" : "s"} · {formatKqCash(last.paidCents)}</strong><small>Dernier traitement : <time dateTime={last.at}>{new Date(last.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time> (heure réelle)</small>{last.skippedReason ? <p>{reasons[last.skippedReason]}</p> : null}</div> : null}
    <RulesForm {...props} key={saved?.updatedAt ?? "unconfigured"} />
  </details>;
}
