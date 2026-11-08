"use client";

import { KqHelpDashboard, KqHelpGrid, KqHelpNote, KqHelpSteps } from "./KqHelpDashboard";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_CONTRACTS, KQ_STAFF_EMPLOYER_RATE, KQ_STAFF_ROLES, KQ_STAFF_SKILLS, KQ_STAFF_TRAITS, getKqStaffCapacity, getKqStaffLeave, getKqStaffLevel, getKqStaffMonthlyCost } from "@/lib/kanab-quest-staff";
import type { KqStaffEmployee, KqStaffSkill, KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { KqProgressMeter } from "./KqVisuals";
import { KqStaffWeeklyPlanStatus } from "./KqStaffWeeklyPlanner";
import desk from "./KqStaffDesk.module.css";
import styles from "./KqStaffEmployeeSheet.module.css";

const skills = Object.keys(KQ_STAFF_SKILLS) as KqStaffSkill[];
const reasons: Record<KqStaffEmployee["reason"], string> = { permanent: "Emploi permanent", replacement: "Remplacement", "temporary-increase": "Surcroît temporaire d’activité", harvest: "Récolte saisonnière" };
const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const hours = (value: number) => `${number(value)} h`;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Props = {
  employee?: KqStaffEmployee;
  employeeName: string;
  snapshot: KqStaffSnapshot;
  origin: HTMLElement | null;
  stale: boolean;
  planningDisabled: boolean;
  onClose: () => void;
  onOpenPlanning: () => void;
  onOpenWeeklyPlanning: () => void;
  onOpenContract?: () => void;
  onOpenPayroll?: () => void;
};

/** Read-only dossier: opening it never submits work, a contract or a payment. */
export function KqStaffEmployeeSheet({ employee, employeeName, snapshot, origin, stale, planningDisabled, onClose, onOpenPlanning, onOpenWeeklyPlanning, onOpenContract, onOpenPayroll }: Props) {
  useBodyScrollLock(true);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (restoreFocus.current) requestAnimationFrame(() => {
        const target = origin?.isConnected ? origin : document.querySelector<HTMLElement>('[data-staff-tab="team"]');
        target?.focus({ preventScroll: true });
      });
    };
  }, [origin]);
  function close() { restoreFocus.current = true; onClose(); }

  const cost = employee ? getKqStaffMonthlyCost(employee, employee.weeklyHours) : null;
  const leave = employee ? getKqStaffLeave(employee, snapshot.serverNow) : null;
  const capacity = employee ? getKqStaffCapacity(employee, snapshot.calendar) : null;
  const currentLeave = employee?.leave.find(period => snapshot.calendar.day >= period.startDay && snapshot.calendar.day <= period.endDay);
  const outstanding = employee ? snapshot.state.payroll.filter(pay => pay.employeeId === employee.id).reduce((sum, pay) => sum + Math.max(0, pay.totalCents - pay.paidCents), 0) : null;
  const trait = employee ? KQ_STAFF_TRAITS[employee.trait] : null;

  return <dialog ref={dialogRef} className={`${desk.dialog} ${styles.sheet}`} aria-labelledby={titleId} data-staff-employee-sheet onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.content}>
      <header className={styles.header}>
        {employee ? <div className={styles.portrait} aria-hidden="true"><KqStaffPortrait person={employee} /></div> : null}
        <div className={styles.identity}><h2 ref={titleRef} id={titleId} tabIndex={-1}>{employee?.name ?? employeeName}</h2>{employee ? <><p>{KQ_STAFF_ROLES[employee.role]}</p><small>{employee.status === "active" ? "En poste" : "Contrat terminé"} · {employee.completedTasks} tâche{employee.completedTasks > 1 ? "s" : ""} terminée{employee.completedTasks > 1 ? "s" : ""}</small></> : null}</div>
        <button type="button" className={styles.close} aria-label="Fermer la fiche" onClick={close}><X size={20} aria-hidden="true" /></button>
      </header>

      {stale ? <p role="status" className={desk.callout} data-staff-sheet-stale>Actualisation indisponible. Cette fiche affiche les dernières données reçues le {dateTime(snapshot.serverNow)}. Ferme-la et actualise Personnel avant d’organiser du travail.</p> : null}

      {employee && cost && leave && capacity && trait ? <>
        <KqStaffWeeklyPlanStatus employee={employee} available={snapshot.context.weeklyPlanVersion === 1} />
        <div className={styles.cost}>
          <div className={styles.costHeading}><span>{employee.status === "ended" ? "Coût mensuel estimé du contrat terminé" : "Coût mensuel estimé"}</span><strong data-staff-sheet-cost="total">{formatKqCash(cost.totalCents)}</strong></div>
          <dl className={styles.breakdown}>
            <div><dt>Salaire brut</dt><dd data-staff-sheet-cost="gross">{formatKqCash(cost.grossCents)}</dd></div>
            <div><dt>Charges employeur</dt><dd data-staff-sheet-cost="employer">{formatKqCash(cost.employerCents)}</dd></div>
          </dl>
          <small>Base de {hours(employee.weeklyHours)} / semaine, hors heures ajoutées et indemnités.</small>
        </div>
        <div className={styles.columns}>
          <section className={styles.section} aria-label="Compétences">
            <h3>Compétences</h3>
            <ul className={styles.skills}>{skills.map(skill => <li key={skill} data-staff-sheet-skill={skill}>
              <KqProgressMeter label={KQ_STAFF_SKILLS[skill]} value={getKqStaffLevel(employee.skills[skill])} max={10} valueLabel={`Niv. ${getKqStaffLevel(employee.skills[skill])} / 10`} hint={`${number(employee.skills[skill])} XP`} />
            </li>)}</ul>
            <p className={styles.trait}><strong>{trait.label}</strong> · {trait.description}</p>
            <details><summary>Parcours</summary><p>{employee.biography}</p><KqHelpNote art="help-training">Tâches et formations → progression des compétences.</KqHelpNote></details>
          </section>

          <section className={styles.section} aria-label="Contrat et rémunération">
            <h3>Contrat & rémunération</h3>
            <dl className={styles.facts}>
              <div><dt>Contrat</dt><dd>{KQ_STAFF_CONTRACTS[employee.contract]}</dd></div>
              <div><dt>Temps de travail</dt><dd>{hours(employee.weeklyHours)} / semaine</dd></div>
              <div><dt>Tarif brut</dt><dd>{formatKqCash(employee.hourlyCents)} / h</dd></div>
              <div><dt>Embauche</dt><dd><time dateTime={employee.hiredAt}>{dateTime(employee.hiredAt)}</time></dd></div>
              <div><dt>Fin du contrat</dt><dd>{employee.endsAt ? <time dateTime={employee.endsAt}>{dateTime(employee.endsAt)}</time> : "Sans date de fin"}</dd></div>
            </dl>
            {snapshot.context.contractLifecycleVersion === 1 ? employee.status === "active" ? employee.contract === "cdi" ? <p className={styles.note}>Ce CDI est sans date de fin.</p> : <button type="button" data-staff-manage-contract={employee.id} disabled={planningDisabled} onClick={onOpenContract}>Prolonger / CDI</button> : employee.finalPaid ? <button type="button" data-staff-rehire={employee.id} disabled={planningDisabled} onClick={onOpenContract}>Réembaucher</button> : <><p className={styles.note}>Réembauche disponible après règlement du solde et fin des tâches.</p><button type="button" disabled={planningDisabled} onClick={onOpenPayroll}>Voir la paie à régler</button></> : null}
            <details><summary>Conditions et calcul du coût</summary><KqHelpDashboard>
              <KqHelpGrid art="help-team" items={[
                { label: "Motif", value: reasons[employee.reason], art: "help-team" },
                { label: "Classification", value: `Palier ${employee.classification}`, art: "help-training" },
                { label: "Charges estimées du jeu", value: `${number(KQ_STAFF_EMPLOYER_RATE * 100)} %`, art: "help-accounts" },
                { label: "Un mois de paie", value: "5 jours réels", art: "help-time" },
              ]} />
              <KqHelpSteps art="help-accounts" steps={[
                { label: "Tarif horaire brut", detail: formatKqCash(employee.hourlyCents), art: "help-accounts" },
                { label: "Heures par semaine", detail: `× ${number(employee.weeklyHours)} h`, art: "help-plan" },
                { label: "Brut mensuel", detail: `× 52 / 12 = ${formatKqCash(cost.grossCents)}`, art: "help-accounts" },
              ]} />
            </KqHelpDashboard></details>
          </section>
        </div>

        <details className={styles.planning}>
          <summary>Planning, congés et paie</summary>
          <div className={styles.section}>
            {employee.status === "active" ? <>
              <p><strong>{snapshot.calendar.label}</strong> · {currentLeave ? `Congé payé jusqu’au jour ${currentLeave.endDay}` : snapshot.calendar.weekend ? "Repos du week-end" : !capacity.baseHours ? "Repos prévu au contrat" : `${hours(capacity.remainingHours)} disponibles`}</p>
              <KqProgressMeter label="Heures utilisées ou réservées" value={capacity.usedHours} max={capacity.baseHours + capacity.extraHours} valueLabel={`${hours(capacity.usedHours)} / ${hours(capacity.baseHours + capacity.extraHours)}`} hint={capacity.extraHours ? `${hours(capacity.extraHours)} ajoutées à la journée.` : undefined} />
            </> : null}
            <ul className={desk.schedule} aria-label={`Semaine contractuelle de ${hours(employee.weeklyHours)}, week-end au repos`}>{weekdays.map((day, index) => <li key={day} data-working={index < employee.weeklyHours / 7 && index < 5}><span>{day}</span><strong>{index < employee.weeklyHours / 7 && index < 5 ? "7 h" : "Repos"}</strong></li>)}</ul>
            <dl className={styles.facts}>
              <div><dt>{employee.status === "active" ? "Congés disponibles" : "Congés restants avant indemnisation"}</dt><dd>{number(leave.availableDays)} jours</dd></div>
              <div><dt>Congés acquis</dt><dd>{number(leave.earnedDays)} jours</dd></div>
              <div><dt>Congés réservés ou pris</dt><dd>{number(leave.bookedDays)} jours</dd></div>
              <div><dt>Paie à régler</dt><dd>{formatKqCash(outstanding ?? 0)}</dd></div>
              {employee.status === "active" ? <div><dt>Prochaine paie</dt><dd><time dateTime={employee.nextPayrollAt}>{dateTime(employee.nextPayrollAt)}</time></dd></div> : <div><dt>Solde du contrat</dt><dd>{outstanding ? "À régler" : employee.finalPaid ? "Réglé" : "À vérifier"}</dd></div>}
            </dl>
            {employee.leave.length ? <ul className={styles.leave}>{employee.leave.map(period => <li key={period.id}>Jours {period.startDay} à {period.endDay} · {number(period.days)} jours de congé</li>)}</ul> : null}
            <p className={styles.note}>Les paies dues tiennent compte des heures ajoutées et des indemnités enregistrées. Règlement dans « Paie & contrats ». Les dates affichées sont en heure réelle.</p>
          </div>
        </details>
      </> : <p className={desk.callout}>Ce dossier n’est plus dans le registre courant. Les contrats soldés sont consultables dans les archives de « Paie & contrats ».</p>}

      <footer className={styles.actions}>
        {employee?.status === "active" ? <button type="button" className={desk.primary} disabled={planningDisabled} onClick={onOpenPlanning}>Organiser sa journée</button> : null}
        {employee?.status === "active" ? <button type="button" data-staff-open-weekly disabled={planningDisabled} onClick={onOpenWeeklyPlanning}>Organiser sa semaine</button> : null}
        <button type="button" onClick={close}>Fermer</button>
      </footer>
    </div>
  </dialog>;
}
