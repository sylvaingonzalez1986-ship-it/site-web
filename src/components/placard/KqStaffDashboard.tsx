"use client";

import { ArrowRight, CalendarDays, Clock3, ReceiptText, UsersRound, Wallet } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqPlayerWorkday } from "@/lib/kanab-quest-player-work";
import { canKqStaffAssignWithOutstandingPayroll, getKqStaffCapacity } from "@/lib/kanab-quest-staff";
import type { KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import { KqStaffImpactDashboard } from "./KqStaffImpactDashboard";
import styles from "./KqStaffDashboard.module.css";

const hours = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;

export function KqStaffDashboard({ snapshot, disabled, stale, onOpenTeam, onRecruit, onPayroll, onOpenWeekly, onOpenDay }: {
  snapshot: KqStaffSnapshot; disabled: boolean; stale: boolean;
  onOpenTeam: () => void; onRecruit: () => void; onPayroll: () => void; onOpenWeekly: (id: string) => void; onOpenDay: (id: string) => void;
}) {
  const player = getKqPlayerWorkday(snapshot);
  const team = snapshot.state.employees.filter(employee => employee.status === "active");
  const capacities = team.map(employee => getKqStaffCapacity(employee, snapshot.calendar));
  const total = capacities.reduce((sum, capacity) => sum + capacity.baseHours + capacity.extraHours, 0);
  const remaining = capacities.reduce((sum, capacity) => sum + capacity.remainingHours, 0);
  const available = capacities.filter(capacity => capacity.remainingHours > 0).length;
  const weekly = team.filter(employee => employee.weeklyPlan?.enabled).length;
  const weeklySupported = snapshot.context.weeklyPlanVersion === 1;
  const weeklyEmployee = team.find(employee => !employee.weeklyPlan?.enabled) ?? team[0];
  const payrollDue = snapshot.outstandingCents > 0;
  const payrollAdministrator = snapshot.context.staffBenefitsVersion === 1 ? team.find(employee => canKqStaffAssignWithOutstandingPayroll(snapshot.state, employee.id, "administration")) : undefined;
  const discountUntil = snapshot.state.supplierDiscountUntil;
  const discountActive = !!discountUntil && Date.parse(discountUntil) > Date.parse(snapshot.serverNow) && snapshot.state.supplierDiscountPercent > 0;
  const benefits = snapshot.benefits;
  const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const rest = snapshot.calendar.weekend ? "Repos du week-end" : "Repos au contrat ou congé prévu aujourd’hui";
  const next = payrollDue
    ? { title: "La paie attend ton règlement", description: `${formatKqCash(snapshot.outstandingCents)} de salaires échus. ${payrollAdministrator ? `Tu peux confier une mission Administration à ${payrollAdministrator.name} pour appliquer les règles de paiement autorisées.` : "Règle-les pour confier de nouveaux travaux aux salariés. Tu peux travailler toi-même."}`, label: "Voir la paie", run: onPayroll }
    : !team.length
      ? { title: "Construis ton équipe", description: "Tu peux travailler seul ou recruter pour partager les tâches de la ferme.", label: "Voir les candidats", run: onRecruit }
      : snapshot.calendar.weekend || (remaining === 0 && player.remainingHours === 0)
        ? { title: snapshot.calendar.weekend ? "L’équipe est au repos ce week-end" : "Toutes les heures sont réservées", description: weeklySupported ? "Prépare la semaine type : elle organisera les prochains jours travaillés." : "Consulte les contrats et les travaux déjà réservés avant la prochaine journée.", label: weeklySupported ? "Organiser la semaine" : "Voir l’équipe", run: () => weeklySupported ? onOpenWeekly(weeklyEmployee.id) : onOpenTeam() }
        : { title: available ? `${available} salarié${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}` : "Ta journée peut continuer", description: "Choisis une personne, puis son poste. Les heures sont réservées après confirmation.", label: "Répartir le travail", run: onOpenTeam };

  return <section className={styles.dashboard} aria-label="Tableau de bord du personnel" data-staff-dashboard data-stale={stale || undefined}>
    {stale ? <p className={styles.stale}>Dernières données reçues · actualise pour connaître les disponibilités actuelles.</p> : null}
    <dl className={styles.metrics}>
      <div className={styles.metric} data-staff-metric="player">
        <dt><Clock3 size={18} aria-hidden="true" />Ton temps</dt>
        <dd className={styles.metricBody}><div className={styles.value}><strong data-staff-metric-value>{hours(player.remainingHours)}</strong><span> / {hours(player.dailyHours)}</span></div>
        <div className={styles.meter}><KqProgressMeter label="Ta réserve personnelle" value={player.remainingHours} max={player.dailyHours} valueLabel={`${hours(player.usedHours)} réservées ou utilisées`} /></div>
        <small>{player.remainingHours > 0 ? "Disponibles pour tes gestes et missions" : "Ta journée est entièrement réservée"}</small></dd>
      </div>
      <div className={styles.metric} data-staff-metric="team">
        <dt><UsersRound size={18} aria-hidden="true" />Temps des salariés</dt>
        <dd className={styles.metricBody}><div className={styles.value}><strong data-staff-metric-value>{!team.length ? "À recruter" : total === 0 ? "Repos" : hours(remaining)}</strong>{total > 0 ? <span> / {hours(total)}</span> : null}</div>
        {total > 0 ? <div className={styles.meter}><KqProgressMeter label="Heures salariées non réservées" value={remaining} max={total} valueLabel={`${team.length} salarié${team.length > 1 ? "s" : ""} dans l’équipe`} /></div> : null}
        <small>{!team.length ? "Aucun salarié dans ton équipe" : total === 0 ? rest : payrollDue ? payrollAdministrator ? "Administration autorisée pour régler la paie" : "Affectations bloquées jusqu’au règlement de la paie" : `${available} salarié${available > 1 ? "s" : ""} avec des heures disponibles`}</small></dd>
      </div>
      <div className={styles.metric} data-staff-metric="monthly">
        <dt><Wallet size={18} aria-hidden="true" />Coût de l’équipe</dt>
        <dd className={styles.metricBody}><div className={styles.value}><strong data-staff-metric-value>{formatKqCash(snapshot.monthlyEmployerCostCents)}</strong></div>
        <small>Estimation mensuelle, charges comprises</small></dd>
      </div>
      <div className={styles.metric} data-staff-metric="payroll" data-attention={payrollDue || undefined}>
        <dt><ReceiptText size={18} aria-hidden="true" />Paie à régler</dt>
        <dd className={styles.metricBody}><div className={styles.value}><strong data-staff-metric-value>{formatKqCash(snapshot.outstandingCents)}</strong></div>
        <small>{payrollDue ? "Salaires échus · règlement à vérifier" : "À jour · aucune échéance impayée"}</small></dd>
      </div>
    </dl>
    <div className={styles.nextAction} data-staff-next-action>
      <div><h2>{stale ? "Actualise le tableau de bord" : next.title}</h2><p>{stale ? "Les chiffres ci-dessus correspondent au dernier chargement réussi." : next.description}</p></div>
      <button type="button" disabled={disabled || stale} onClick={next.run}>{next.label}<ArrowRight size={17} aria-hidden="true" /></button>
    </div>
    <div className={styles.footer}>
      <span><CalendarDays size={16} aria-hidden="true" />{!team.length ? "Semaine type après recrutement" : weeklySupported ? `${weekly} / ${team.length} semaines types actives` : "Semaines types à vérifier"}</span>
      <span>Trésorerie disponible <strong>{formatKqCash(snapshot.cashCents)}</strong></span>
    </div>
    <KqStaffImpactDashboard snapshot={snapshot} disabled={disabled} stale={stale} onOpenTeam={onOpenTeam} onOpenDay={onOpenDay} onOpenWeekly={onOpenWeekly} onRecruit={onRecruit}>
      <details className={styles.benefitHistory} data-staff-benefits-history><summary>Bilan global enregistré</summary>
      <p className={styles.benefitScope}>Toute l’entreprise, joueur et salariés, depuis le début du suivi. Ce bilan n’est pas filtré par personne ou par planning.</p>
      <dl className={styles.benefitNumbers}>
        <div data-staff-supplier-discount><dt>Remise fournisseur active</dt><dd>{discountActive ? `${snapshot.state.supplierDiscountPercent.toLocaleString("fr-FR")} %` : "Aucune"}</dd><small>{discountActive && discountUntil ? <>Jusqu’au <time dateTime={discountUntil}>{date(discountUntil)}</time> · heure réelle</> : "À négocier en Administration"}</small></div>
        <div data-staff-supplier-savings><dt>Économies enregistrées</dt><dd>{benefits ? formatKqCash(benefits.supplierSavingsCents) : "Indisponible"}</dd><small>{benefits ? `${benefits.discountedInvoices.toLocaleString("fr-FR")} facture${benefits.discountedInvoices === 1 ? "" : "s"} avec remise depuis le début du suivi` : "Le serveur ne fournit pas encore ce suivi."}</small></div>
      </dl>
      <p className={styles.benefitScope}>Remise sur les nouvelles fournitures au lancement d’une culture dans l’Entrepôt. Les anciennes factures, soins, machines, énergie et salaires sont exclus.</p>
        {benefits ? <>
          <p className={styles.benefitScope}>Suivi depuis le <time dateTime={benefits.trackedSince}>{date(benefits.trackedSince)}</time> (heure réelle). Résultats reçus du serveur, joueur et salariés ; les opérations antérieures ne sont pas reconstituées.</p>
          {benefits.supplierBaseCents > 0 ? <KqAllocationBar label="Fournitures enregistrées sous remise" items={[{ label: "Facturé après remise", value: benefits.supplierNetCents, displayValue: formatKqCash(benefits.supplierNetCents), tone: "teal" }, { label: "Économisé", value: benefits.supplierSavingsCents, displayValue: formatKqCash(benefits.supplierSavingsCents), tone: "gold" }]} /> : null}
          <dl className={styles.benefitResults}>
            <div><dt>Culture déléguée</dt><dd>{hours(benefits.cultureHoursDelegated)}</dd></div>
            <div><dt>Transformation déléguée</dt><dd>{hours(benefits.processingHoursDelegated)}</dd></div>
            {benefits.processingSecondsSaved > 0 ? <div><dt>Attente des lots raccourcie</dt><dd>{hours(benefits.processingSecondsSaved / 3600)} réelles</dd></div> : null}
            <div><dt>Trim effectué</dt><dd>{benefits.trimGrams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g</dd></div>
            <div><dt>Abonnés gagnés</dt><dd>{benefits.followersGained.toLocaleString("fr-FR")}</dd></div>
            <div><dt>Partenaires gagnés</dt><dd>{benefits.partnersGained.toLocaleString("fr-FR")}</dd></div>
            <div><dt>Factures réglées par gestion</dt><dd>{benefits.invoicesPaidCount.toLocaleString("fr-FR")} · {formatKqCash(benefits.invoicesPaidCents)}</dd></div>
            <div><dt>Paies réglées par gestion</dt><dd>{benefits.payrollPaidCount.toLocaleString("fr-FR")} · {formatKqCash(benefits.payrollPaidCents)}</dd></div>
          </dl>
          <p className={styles.benefitScope}>Les abonnés et partenaires ne sont pas des recettes garanties. Les paiements sont des dépenses prises en charge, pas des économies.</p>
        </> : <p className={styles.benefitScope}>Données chiffrées indisponibles. Les résultats déjà reçus restent consultables dans « Travaux & résultats ».</p>}
      </details>
    </KqStaffImpactDashboard>
  </section>;
}
