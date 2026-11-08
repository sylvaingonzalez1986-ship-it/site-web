"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_CONTRACTS, KQ_STAFF_ROLES, KQ_STAFF_SKILLS, KQ_STAFF_TRAITS } from "@/lib/kanab-quest-staff";
import type { KqStaffArchiveCursor, KqStaffArchiveKind, KqStaffArchivePage, KqStaffEmployee, KqStaffSkill, KqStaffTask } from "@/lib/kanab-quest-staff-types";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqStaffArchive.module.css";

const money = formatKqCash;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const hours = (value: number) => `${value.toLocaleString("fr-FR")} h`;
const reasons: Record<KqStaffEmployee["reason"], string> = { permanent: "Poste permanent", replacement: "Remplacement", "temporary-increase": "Surcroît temporaire d’activité", harvest: "Récolte" };
type RehireProps = { onRehire?: (contractId: string, origin: HTMLElement) => void; disabled?: boolean };

function useArchivePage<Kind extends KqStaffArchiveKind>(kind: Kind, employeeId?: string) {
  const api = useKqTutorialApi();
  const [page, setPage] = useState<KqStaffArchivePage<Kind> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor: KqStaffArchiveCursor | null) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ kind });
      if (employeeId) params.set("employeeId", employeeId);
      if (cursor) { params.set("afterAt", cursor.at); params.set("afterId", cursor.id); }
      const response = await api.request(`/api/arena/placard/staff/archive?${params}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || !payload || !Array.isArray(payload.items) || !(payload.nextCursor === null || typeof payload.nextCursor?.at === "string" && typeof payload.nextCursor?.id === "string")) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Le registre est momentanément indisponible.");
      }
      if (controller.signal.aborted) return;
      const next = payload as KqStaffArchivePage<Kind>;
      setPage(previous => cursor && previous ? { ...next, items: [...previous.items, ...next.items.filter(item => !previous.items.some(old => old.id === item.id))] } : next);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Le registre est momentanément indisponible.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [api, employeeId, kind]);
  useEffect(() => { void load(null); return () => activeRequest.current?.abort(); }, [load]);
  return { page, loading, error, next: () => void load(page?.nextCursor ?? null) };
}

function PageStatus({ loading, error, hasNext, onNext, label }: { loading: boolean; error: string; hasNext: boolean; onNext: () => void; label: string }) {
  return <div className={styles.pageStatus}>
    {loading ? <p role="status">Chargement {label}…</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {!loading && (error || hasNext) ? <button type="button" onClick={onNext}>{error ? "Réessayer le chargement" : `Afficher la suite ${label}`}</button> : null}
  </div>;
}

function ArchivedPayroll({ employeeId }: { employeeId: string }) {
  const { page, loading, error, next } = useArchivePage("payroll", employeeId);
  return <div aria-busy={loading}>
    <ul className={styles.rows}>{page?.items.map(pay => <li key={pay.id}>
      <div className={styles.rowHeader}><strong>Échéance du <time dateTime={pay.dueAt}>{dateTime(pay.dueAt)}</time></strong><span>{money(pay.paidCents)} réglés</span></div>
      <p>Brut {money(pay.grossCents)} · charges {money(pay.employerCents)} · indemnités {money(pay.indemnityCents)}</p>
      <small className={styles.reference}>Référence : {pay.id}</small>
    </li>)}</ul>
    {page && !page.items.length && !error && !loading ? <p>Aucune paie enregistrée dans ce dossier.</p> : null}
    <PageStatus loading={loading} error={error} hasNext={!!page?.nextCursor} onNext={next} label="des paies" />
  </div>;
}

function taskLabel(task: KqStaffTask) {
  if (task.kind === "training") return `Formation · ${KQ_STAFF_SKILLS[task.skill]}`;
  if (task.kind === "trim") return task.trimMode === "machine" ? "Trim mécanique" : task.trimMode === "manual" ? "Trim manuel" : "Trim";
  if (task.kind === "countryside") return "Tournée des campagnes";
  return KQ_STAFF_SKILLS[task.kind];
}

function ArchivedTasks({ employeeId }: { employeeId: string }) {
  const { page, loading, error, next } = useArchivePage("task", employeeId);
  return <div aria-busy={loading}>
    <ul className={styles.rows}>{page?.items.map(task => <li key={task.id}>
      <div className={styles.rowHeader}><strong>{taskLabel(task)}</strong><span>{hours(task.hours)}</span></div>
      {task.cultureShift ? <small>{task.cultureUsedHours === undefined ? "Consommation non enregistrée" : `${hours(task.cultureUsedHours)} consommées sur ${hours(task.hours)} réservées`} · 0,5 h par étape</small> : null}
      {task.processingShift ? <small>{task.processingUsedHours === undefined ? "Consommation non enregistrée" : `${hours(task.processingUsedHours)} consommées sur ${hours(task.hours)} réservées`} · selon le volume transformé</small> : null}
      <small>{task.cultureShift || task.processingShift ? "Réserve clôturée" : "Terminée"} le <time dateTime={task.completesAt}>{dateTime(task.completesAt)}</time></small>
      <p>{task.outcome || "Résultat détaillé non enregistré."}</p>
      {task.trainingCostCents > 0 ? <small>Coût de formation : {money(task.trainingCostCents)}</small> : null}
    </li>)}</ul>
    {page && !page.items.length && !error && !loading ? <p>Aucune tâche enregistrée dans ce dossier.</p> : null}
    <PageStatus loading={loading} error={error} hasNext={!!page?.nextCursor} onNext={next} label="des tâches" />
  </div>;
}

function ArchivedContract({ employee, close, onRehire, disabled }: { employee: KqStaffEmployee; close: () => void } & RehireProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className={styles.dossier} aria-labelledby="staff-archived-contract-name">
    <div className={styles.rowHeader}><h3 ref={heading} tabIndex={-1} id="staff-archived-contract-name">{employee.name}</h3><button type="button" onClick={close}>Refermer le dossier</button></div>
    <p>{KQ_STAFF_ROLES[employee.role]} · {KQ_STAFF_CONTRACTS[employee.contract]}</p>
    {onRehire ? <button type="button" data-staff-rehire={employee.id} disabled={disabled} onClick={event => onRehire(employee.id, event.currentTarget)}>Réembaucher {employee.name}</button> : null}
    <dl className={styles.terms}>
      <div><dt>Embauche</dt><dd><time dateTime={employee.hiredAt}>{dateTime(employee.hiredAt)}</time></dd></div>
      <div><dt>Fin du contrat</dt><dd>{employee.endsAt ? <time dateTime={employee.endsAt}>{dateTime(employee.endsAt)}</time> : "Date non enregistrée"}</dd></div>
      <div><dt>Temps contractuel</dt><dd>{hours(employee.weeklyHours)} / semaine</dd></div>
      <div><dt>Tarif horaire brut</dt><dd>{money(employee.hourlyCents)} / h</dd></div>
      <div><dt>Brut cumulé</dt><dd>{money(employee.grossEarnedCents)}</dd></div>
      <div><dt>État du solde</dt><dd>Réglé</dd></div>
    </dl>
    <details><summary>Conditions et parcours</summary><div className={styles.contractDetails}>
      <dl className={styles.terms}>
        <div><dt>Motif du contrat</dt><dd>{reasons[employee.reason]}</dd></div>
        <div><dt>Classification</dt><dd>{employee.classification}</dd></div>
        <div><dt>Trait</dt><dd>{KQ_STAFF_TRAITS[employee.trait].label}</dd></div>
        {(Object.keys(KQ_STAFF_SKILLS) as KqStaffSkill[]).map(skill => <div key={skill}><dt>{KQ_STAFF_SKILLS[skill]}</dt><dd>{employee.skills[skill].toLocaleString("fr-FR")} XP</dd></div>)}
      </dl>
      <p>{employee.biography}</p>
      <h4>Congés enregistrés</h4>
      {employee.leave.length ? <ul className={styles.rows}>{employee.leave.map(leave => <li key={leave.id}>Du jour {leave.startDay} au jour {leave.endDay} du jeu · {leave.days.toLocaleString("fr-FR")} jours ouvrés</li>)}</ul> : <p>Aucun congé enregistré.</p>}
    </div></details>
    <details onToggle={event => setPayrollOpen(event.currentTarget.open)}><summary>Paies réglées</summary>{payrollOpen ? <ArchivedPayroll employeeId={employee.id} /> : null}</details>
    <details onToggle={event => setTasksOpen(event.currentTarget.open)}><summary>Tâches et résultats</summary>{tasksOpen ? <ArchivedTasks employeeId={employee.id} /> : null}</details>
  </section>;
}

function ArchiveRegister({ onRehire, disabled }: RehireProps) {
  const { page, loading, error, next } = useArchivePage("contract");
  const [selected, setSelected] = useState<KqStaffEmployee | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  return <div className={styles.register}>
    <div aria-busy={loading}><ul className={styles.rows}>{page?.items.map(employee => <li key={employee.id}>
      <div className={styles.rowHeader}><div><strong>{employee.name}</strong><small>{KQ_STAFF_CONTRACTS[employee.contract]} · {hours(employee.weeklyHours)} / semaine</small><small>{employee.endsAt ? `Terminé le ${dateTime(employee.endsAt)}` : "Contrat terminé"} · solde réglé</small></div>
        <button type="button" aria-expanded={selected?.id === employee.id} onClick={event => { opener.current = event.currentTarget; setSelected(employee); }}>Consulter le dossier<span className={styles.srOnly}> de {employee.name}</span></button>
      </div>
    </li>)}</ul>
      {page && !page.items.length && !loading && !error ? <p>Aucun contrat archivé pour le moment.</p> : null}
      <PageStatus loading={loading} error={error} hasNext={!!page?.nextCursor} onNext={next} label="des contrats" />
    </div>
    {selected ? <ArchivedContract key={selected.id} employee={selected} onRehire={onRehire} disabled={disabled} close={() => { setSelected(null); opener.current?.focus(); }} /> : null}
  </div>;
}

export function KqStaffArchive({ count, onRehire, disabled }: { count: number } & RehireProps) {
  const [open, setOpen] = useState(false);
  return <details className={styles.archive} data-staff-archive onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Anciens contrats ({count.toLocaleString("fr-FR")})</summary>
    {open ? <><p className={styles.hint}>Les contrats terminés et soldés sont conservés ici avec leurs paies et leurs tâches. Les dates affichées correspondent à l’heure réelle.</p>{count ? <ArchiveRegister key={count} onRehire={onRehire} disabled={disabled} /> : <p>Aucun contrat archivé pour le moment.</p>}</> : null}
  </details>;
}
