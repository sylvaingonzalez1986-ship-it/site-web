"use client";

import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, GraduationCap, UserRoundPlus, UsersRound } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_STAFF_CITIES, KQ_STAFF_CONTRACTS, KQ_STAFF_ROLES, KQ_STAFF_SKILLS, KQ_STAFF_TRAITS, canKqStaffAssignWithOutstandingPayroll, getKqStaffCapacity, getKqStaffExtraQuote, getKqStaffLeave, getKqStaffLeavePeriod, getKqStaffLevel, getKqStaffMonthlyCost, getKqStaffTrainingCost } from "@/lib/kanab-quest-staff";
import type { KqStaffCandidate, KqStaffCommand, KqStaffContractKind, KqStaffEmployee, KqStaffSkill, KqStaffSkills, KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import { getKqStaffRoleContractBlock } from "@/lib/kanab-quest-staff-contracts";
import { KqProgressMeter } from "./KqVisuals";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import { useKqSocialPlayer } from "./useKqSocialPlayer";
import { KqStaffMoment, type KqStaffMoment as StaffMoment } from "./KqStaffMoment";
import { KqStaffOperationsConfirmation, KqStaffOperationsStatus, KqStaffTaskList, useKqStaffOperations, type KqStaffConfirmationDraft } from "./KqStaffOperations";
import { KqChapterHeading } from "./KqChapterHeading";
import { KqStaffHandbook } from "./KqStaffHandbook";
import { KqStaffWorkPlan, type KqStaffStation } from "./KqStaffWorkPlan";
import { KqStaffProspectingMap } from "./KqStaffProspectingMap";
import { KqPlayerWorkDesk } from "./KqPlayerWorkDesk";
import { KqStaffArchive } from "./KqStaffArchive";
import { KqStaffEmployeeSheet } from "./KqStaffEmployeeSheet";
import { KqStaffContractPlanner } from "./KqStaffContractPlanner";
import { KqStaffDashboard } from "./KqStaffDashboard";
import { KqStaffAdministrationRules } from "./KqStaffAdministrationRules";
import { getKqStaffBenefitPreview } from "@/lib/kanab-quest-staff-benefits";
import { getKqStaffBenefitRows, KqStaffBenefits } from "./KqStaffBenefits";
import { KqStaffWeeklyPlanner, KqStaffWeeklyPlanStatus, KqStaffWeeklyPause } from "./KqStaffWeeklyPlanner";
import styles from "./KqStaffDesk.module.css";

const money = formatKqCash;
const skillKeys = Object.keys(KQ_STAFF_SKILLS) as KqStaffSkill[];
const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hoursLabel = (value: number) => `${value.toLocaleString("fr-FR")} h`;
type Prepare = (confirmation: KqStaffConfirmationDraft) => void;

function Profile({ person }: { person: KqStaffCandidate }) {
  const trait = KQ_STAFF_TRAITS[person.trait];
  return <><header className={styles.personHeader}><div className={styles.portrait} aria-hidden="true"><KqStaffPortrait person={person} /></div><div><h3>{person.name}</h3><small>{KQ_STAFF_ROLES[person.role]}</small></div></header><p className={styles.trait}><strong>{trait.label}</strong> · {trait.description}</p></>;
}

function Skills({ skills }: { skills: KqStaffSkills }) {
  return <ul className={styles.skills} aria-label="Compétences et expérience">{skillKeys.map(skill => {
    const level = getKqStaffLevel(skills[skill]);
    return <li className={styles.skillLine} key={skill}><span>{KQ_STAFF_SKILLS[skill]}</span><strong>Niv. {level} · {skills[skill].toLocaleString("fr-FR")} XP</strong><span className={styles.skillTrack} aria-hidden="true"><span style={{ width: `${level * 10}%` }} /></span></li>;
  })}</ul>;
}

function Schedule({ weeklyHours, weekday }: { weeklyHours: number; weekday?: number }) {
  return <ul className={styles.schedule} aria-label={`Semaine de ${hoursLabel(weeklyHours)}, sept heures par jour travaillé, week-end au repos`}>{weekdays.map((day, index) => {
    const working = index < weeklyHours / 7 && index < 5;
    return <li key={day} data-working={working} data-today={weekday === index}><span>{day}</span><strong>{working ? "7 h" : "Repos"}</strong></li>;
  })}</ul>;
}

function LeaveForm({ employee, snapshot, prepare, disabled }: { employee: KqStaffEmployee; snapshot: KqStaffSnapshot; prepare: Prepare; disabled: boolean }) {
  const [startDay, setStartDay] = useState(snapshot.calendar.day + 1);
  const [endDay, setEndDay] = useState(snapshot.calendar.day + 1);
  const leave = getKqStaffLeave(employee, snapshot.serverNow);
  const validDates = Number.isSafeInteger(startDay) && Number.isSafeInteger(endDay) && startDay > snapshot.calendar.day && endDay >= startDay;
  let workDays = 0, normalizedEnd = endDay, resumeDay = endDay + 1, periodError = "";
  if (validDates) {
    try { const period = getKqStaffLeavePeriod(employee, startDay, endDay); workDays = period.days; normalizedEnd = period.endDay; resumeDay = period.resumeDay; }
    catch (cause) { periodError = cause instanceof Error ? cause.message : "Période de congés invalide."; }
  }
  const overlaps = employee.leave.some(period => startDay <= period.endDay && normalizedEnd >= period.startDay);
  const canBook = !disabled && validDates && !periodError && workDays > 0 && workDays <= leave.availableDays && !overlaps;
  return <details><summary>Congés payés · {leave.availableDays.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours disponibles</summary><div className={styles.form}>
    <p className={styles.muted}>{leave.earnedDays.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours acquis · {leave.bookedDays.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours réservés ou pris. Le salaire est maintenu pendant les congés.</p>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); if (canBook) prepare({ title: "Planifier des congés payés", description: "L’employé ne pourra pas recevoir de travail pendant cette période. Son salaire est maintenu. Les jours ouvrés de la ferme sont décomptés avant la prochaine reprise, même à temps partiel. Les samedis et dimanches ne consomment pas de droits.", rows: [["Employé", employee.name], ["Période", `Du jour ${startDay} au jour ${normalizedEnd} inclus · reprise jour ${resumeDay}`], ["Jours ouvrés réservés", `${workDays} jours`], ["Solde estimé après réservation", `${(leave.availableDays - workDays).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} jours`]], command: { action: "leave", employeeId: employee.id, startDay, endDay }, debitCents: 0, confirmLabel: "Confirmer les congés" }); }}>
      <fieldset className={styles.fields} disabled={disabled}><label>Premier jour du jeu<input type="number" min={snapshot.calendar.day + 1} step={1} max={snapshot.calendar.day + 365} value={startDay} required onChange={event => setStartDay(Number(event.target.value))} /></label><label>Dernier jour inclus<input type="number" min={Math.max(startDay, snapshot.calendar.day + 1)} step={1} max={startDay + 60} value={endDay} required onChange={event => setEndDay(Number(event.target.value))} /></label></fieldset>
      <p className={styles.muted}>Aujourd’hui : jour {snapshot.calendar.day}. {validDates ? `${workDays} jour${workDays > 1 ? "s" : ""} ouvré${workDays > 1 ? "s" : ""} à réserver.` : "Choisis une période qui commence demain ou plus tard."}{periodError ? ` ${periodError}` : validDates ? ` Reprise prévue jour ${resumeDay}.` : ""}{overlaps ? " Cette période recoupe des congés déjà enregistrés." : ""}{workDays > leave.availableDays ? " Le solde acquis ne couvre pas cette période." : ""}</p>
      <button type="submit" disabled={!canBook}>Vérifier les congés</button>
    </form>
    {employee.leave.length ? <ul className={styles.taskList}>{employee.leave.map(period => <li key={period.id}><div><strong>Jours {period.startDay} à {period.endDay}</strong><small>{period.days} jour{period.days > 1 ? "s" : ""} ouvré{period.days > 1 ? "s" : ""} · {period.endDay < snapshot.calendar.day ? "Congés pris" : period.startDay <= snapshot.calendar.day ? "En congé" : "À venir"}</small>{period.startDay > snapshot.calendar.day ? <button type="button" disabled={disabled} onClick={() => prepare({ title: "Annuler ces congés", description: "Ces jours seront rendus au solde disponible et l’employé pourra de nouveau recevoir du travail à ces dates.", rows: [["Employé", employee.name], ["Période", `Du jour ${period.startDay} au jour ${period.endDay}`], ["Droits rendus", `${period.days} jours`]], command: { action: "cancel-leave", employeeId: employee.id, leaveId: period.id }, debitCents: 0, confirmLabel: "Annuler les congés" })}>Annuler cette période</button> : null}</div></li>)}</ul> : null}
  </div></details>;
}

function HireForm({ candidate, snapshot, prepare, disabled }: { candidate: KqStaffCandidate; snapshot: KqStaffSnapshot; prepare: Prepare; disabled: boolean }) {
  const [contract, setContract] = useState<KqStaffContractKind>(candidate.contracts[0]);
  const [weeklyHours, setWeeklyHours] = useState(35);
  const [months, setMonths] = useState(3);
  const [reason, setReason] = useState<"replacement" | "temporary-increase">("temporary-increase");
  const cost = getKqStaffMonthlyCost(candidate, weeklyHours);
  const durationMonths = contract === "cdi" ? 0 : months;
  const contractBlock = getKqStaffRoleContractBlock(snapshot, candidate.role, contract);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || contractBlock) return;
    prepare({ title: `Embaucher ${candidate.name}`, description: "Le contrat démarre maintenant. Le salaire s’accumule au fil du temps du jeu et sera à régler à l’échéance ; aucun salaire n’est prélevé à la signature.", rows: [
      ["Contrat", `${KQ_STAFF_CONTRACTS[contract]} · ${hoursLabel(weeklyHours)} / semaine`],
      ["Durée", contract === "cdi" ? "Sans terme prévu" : `${durationMonths} mois de jeu`],
      ["Motif", contract === "cdi" ? "Emploi permanent" : contract === "seasonal" ? "Récolte saisonnière" : reason === "replacement" ? "Remplacement" : "Surcroît temporaire d’activité"],
      ["Brut mensuel", money(cost.grossCents)], ["Charges employeur estimées", money(cost.employerCents)], ["Coût mensuel récurrent estimé", money(cost.totalCents)],
      ...(contract !== "cdi" ? [["Fin du contrat", contract === "cdd" ? "Prime de 10 % du brut cumulé, plus les congés non pris et les charges estimées" : "Congés non pris indemnisés et charges estimées ; pas de prime de précarité"] as [string, string]] : []),
      ["Débit à la signature", money(0)],
    ], command: { action: "hire", candidateCode: candidate.code, contract, weeklyHours, durationMonths, reason: contract === "cdi" ? "permanent" : contract === "seasonal" ? "harvest" : reason, expectedMonthlyCostCents: cost.totalCents }, debitCents: 0, confirmLabel: "Signer ce contrat" });
  }
  return <form className={styles.formSection} data-staff-hire-form onSubmit={submit}><h4>Préparer le contrat</h4><fieldset className={styles.form} disabled={disabled}>
    <div className={styles.fields}><label>Contrat<select value={contract} onChange={event => { setContract(event.target.value as KqStaffContractKind); setMonths(3); }}>{candidate.contracts.map(kind => <option key={kind} value={kind}>{KQ_STAFF_CONTRACTS[kind]}</option>)}</select></label><label>Temps hebdomadaire<select value={weeklyHours} onChange={event => setWeeklyHours(Number(event.target.value))}>{(candidate.role === "grower" ? [35] : [7, 14, 21, 28, 35]).map(hours => <option value={hours} key={hours}>{hoursLabel(hours)} / semaine</option>)}</select></label></div>
    {contract !== "cdi" ? <div className={styles.fields}><label>Durée du contrat<select value={months} onChange={event => setMonths(Number(event.target.value))}>{(contract === "cdd" ? [3, 6, 12] : [1, 2, 3, 6]).map(duration => <option key={duration} value={duration}>{duration} mois de jeu</option>)}</select></label>{contract === "cdd" ? <label>Motif du CDD<select value={reason} onChange={event => setReason(event.target.value as typeof reason)}><option value="temporary-increase">Surcroît temporaire d’activité</option><option value="replacement">Remplacement</option></select></label> : <p className={styles.muted}>Contrat réservé aux travaux de récolte.</p>}</div> : null}
    <Schedule weeklyHours={weeklyHours} />
    <dl className={styles.numbers}><div><dt>Brut par mois</dt><dd>{money(cost.grossCents)}</dd></div><div><dt>Coût employeur estimé / mois</dt><dd>{money(cost.totalCents)}</dd></div></dl>
    {contractBlock ? <p className={styles.callout} role="status" data-staff-hire-contract-block>{contractBlock}</p> : null}
    <button type="submit" className={styles.primary} disabled={!!contractBlock}><UserRoundPlus size={18} aria-hidden="true" /> Vérifier le contrat</button>
  </fieldset></form>;
}

const taskDescriptions: Record<KqStaffSkill | "training", string> = {
  culture: "L’employé soigne une culture en cours. Le bénéfice dépend de sa compétence et sera appliqué à la fin du travail.",
  processing: "L’employé accélère un lot déjà en transformation à l’atelier. Le temps gagné dépend de son expérience et sera confirmé en fin de tâche.",
  communication: "L’employé prépare la communication de la ferme : les abonnés et la réputation gagnés sont confirmés à la fin.",
  sales: "L’employé prospecte des boutiques en Bretagne. Le trajet est payé au départ ; obtenir un partenaire n’est pas garanti.",
  administration: "L’employé négocie les nouvelles fournitures de l’Entrepôt. La remise dure 7 jours du jeu ; elle ne modifie pas les anciennes factures.",
  training: "La formation fait progresser une compétence et utilise les mêmes heures disponibles que les autres tâches.",
};

function EmployeeWork({ employee, snapshot, prepare, disabled, fixedKind, onOpenWeekly }: { employee: KqStaffEmployee; snapshot: KqStaffSnapshot; prepare: Prepare; disabled: boolean; fixedKind?: KqStaffSkill | "training"; onOpenWeekly?: () => void }) {
  const [kind, setKind] = useState<KqStaffSkill | "training">(fixedKind ?? "culture");
  const [skill, setSkill] = useState<KqStaffSkill>("culture");
  const [hourInput, setHourInput] = useState(fixedKind === "administration" ? "0.5" : "2");
  const hours = Number(hourInput);
  const cultureReservations = snapshot.context.cultureWorkVersion === 1;
  const processingReservations = snapshot.context.processingWorkVersion === 1;
  const [runId, setRunId] = useState(cultureReservations ? "" : snapshot.context.activeRuns[0]?.id ?? "");
  const [flowerId, setFlowerId] = useState(processingReservations ? "" : snapshot.context.processingBatches[0]?.flowerId ?? "");
  const [cityId, setCityId] = useState<string>(KQ_STAFF_CITIES[0].id);
  const [extraHours, setExtraHours] = useState(.5);
  const [invoiceId, setInvoiceId] = useState(snapshot.context.supplierInvoices[0]?.id ?? "");
  const capacity = getKqStaffCapacity(employee, snapshot.calendar);
  const unavailable = employee.leave.some(period => period.startDay <= snapshot.calendar.day && period.endDay >= snapshot.calendar.day) ? "Ce salarié est en congé aujourd’hui."
    : snapshot.calendar.weekend ? "Samedi et dimanche : ce salarié est au repos."
    : capacity.baseHours === 0 ? "Ce jour n’est pas travaillé dans son contrat."
    : capacity.remainingHours === 0 ? "Toutes ses heures sont déjà réservées aujourd’hui." : "";
  const city = KQ_STAFF_CITIES.find(item => item.id === cityId)!;
  const invoice = snapshot.context.supplierInvoices.find(item => item.id === invoiceId);
  const processingBatches = snapshot.context.processingBatches.filter((batch, index, all) => all.findIndex(item => item.flowerId === batch.flowerId) === index);
  const targetMissing = kind === "culture" ? !(cultureReservations && !runId) && !snapshot.context.activeRuns.some(run => run.id === runId) : kind === "processing" ? !(processingReservations && !flowerId) && !processingBatches.some(batch => batch.flowerId === flowerId) : false;
  const description = kind === "culture" && cultureReservations ? "Réserve de Culture pour aujourd’hui : chaque étape jouée utilise 0,5 h de ce budget et les bonus de l’employé, sans prendre tes heures. Les heures non consommées expirent à la fin du jour." : kind === "processing" && processingReservations ? "Réserve de Transformation pour aujourd’hui : les lots utilisent les heures de l’employé selon leur volume et la cadence des machines. Tes heures restent intactes. À épuisement, le lot attend une nouvelle réserve, sans relais automatique du joueur. Les heures inutilisées expirent en fin de journée." : taskDescriptions[kind];
  const minimumHours = kind === "training" || kind === "sales" ? 2 : .5;
  const validHours = Number.isFinite(hours) && hours >= minimumHours && hours <= 7 && Number.isInteger(hours * 2);
  const benefit = validHours ? getKqStaffBenefitPreview({ actor: employee, kind, hours, context: snapshot.context, cityId, skill }) : null;
  const trainingCost = kind === "training" && validHours ? getKqStaffTrainingCost(hours) : 0;
  const debitCents = kind === "sales" ? city.travelCents : trainingCost;
  const skillMaxed = kind === "training" && getKqStaffLevel(employee.skills[skill]) >= 10;
  const hasRunningTask = snapshot.state.tasks.some(task => task.employeeId === employee.id && task.status === "running");
  const weeklyLocked = employee.weeklyPlan?.enabled === true;
  const payrollAdministration = snapshot.context.staffBenefitsVersion === 1 && canKqStaffAssignWithOutstandingPayroll(snapshot.state, employee.id, kind);
  const canAssign = !disabled && !weeklyLocked && (snapshot.outstandingCents === 0 || payrollAdministration) && !skillMaxed && validHours && hours <= capacity.remainingHours && !targetMissing && debitCents <= snapshot.cashCents;
  let extraGross = 0, extraError = "";
  try { extraGross = getKqStaffExtraQuote(employee, snapshot.calendar, extraHours); } catch (cause) { extraError = cause instanceof Error ? cause.message : "Heures supplémentaires indisponibles."; }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canAssign) return;
    const command: KqStaffCommand = kind === "training" ? { action: "train", employeeId: employee.id, skill, hours, expectedCostCents: trainingCost }
      : { action: "assign", employeeId: employee.id, kind, hours, ...(kind === "culture" ? runId ? { targetId: runId } : {} : kind === "processing" ? flowerId ? { targetId: flowerId } : {} : kind === "sales" ? { cityId, expectedCostCents: city.travelCents } : {}) };
    const target = kind === "culture" ? runId ? snapshot.context.activeRuns.find(run => run.id === runId)?.name : "Toutes les cultures" : kind === "processing" ? flowerId ? processingBatches.find(batch => batch.flowerId === flowerId)?.name : "Toutes les transformations" : kind === "sales" ? `${city.name} (${city.department})` : kind === "training" ? KQ_STAFF_SKILLS[skill] : undefined;
    prepare({ title: kind === "training" ? "Confirmer la formation" : "Confirmer le travail", description, rows: [["Employé", employee.name], ["Activité", kind === "training" ? "Formation" : KQ_STAFF_SKILLS[kind]], ...(target ? [["Destination / objectif", target] as [string, string]] : []), ["Temps réservé aujourd’hui", hoursLabel(hours)], ...(kind === "culture" && cultureReservations ? [["Étapes couvertes", `${hours * 2} étapes à 0,5 h`], ["Fin de la réserve", dateTime(snapshot.calendar.nextDayAt)]] as [string, string][] : []), ...(benefit ? getKqStaffBenefitRows(benefit) : []), ["Heures restant après", hoursLabel(capacity.remainingHours - hours)], [kind === "sales" ? "Frais de déplacement au départ" : "Paiement immédiat", money(debitCents)]], command, debitCents, confirmLabel: kind === "training" ? "Payer et commencer" : kind === "sales" ? "Payer le trajet et partir" : "Confier ce travail" });
  }
  return <div className={fixedKind ? styles.form : styles.formSection}>
    {weeklyLocked ? <div className={styles.form}><p className={styles.callout}>La semaine type est active. Mets-la en pause avant de réserver une mission à la journée. Les tâches déjà réservées continueront.</p><div className={styles.actions}><KqStaffWeeklyPause employee={employee} snapshot={snapshot} prepare={prepare} disabled={disabled} />{onOpenWeekly ? <button type="button" disabled={disabled} onClick={onOpenWeekly}>Voir la semaine type</button> : null}</div></div> : null}
    {unavailable ? <p className={styles.callout} role="status">{unavailable} Consulte son planning avant de lui confier une nouvelle tâche.</p> : null}
    <form className={styles.form} data-staff-work-form={employee.id} data-staff-work-kind={kind} onSubmit={submit}>{!fixedKind ? <h4>Confier du travail</h4> : null}<fieldset className={styles.form} disabled={disabled || weeklyLocked || capacity.remainingHours === 0}>
      <dl className={`${styles.numbers} ${styles.workQuote}`}><div><dt>{kind === "sales" ? "Trajet à payer au départ" : "Paiement immédiat"}</dt><dd>{kind === "training" && !validHours ? "Durée à préciser" : money(debitCents)}</dd></div><div><dt>Heures disponibles aujourd’hui</dt><dd>{hoursLabel(capacity.remainingHours)}</dd></div></dl>
      <div className={fixedKind ? styles.form : styles.fields}>{!fixedKind ? <label>Activité<select value={kind} onChange={event => { const next = event.target.value as KqStaffSkill | "training"; setKind(next); if (next === "administration") setHourInput("0.5"); else if ((next === "training" || next === "sales") && hours < 2) setHourInput("2"); }}>{skillKeys.map(item => <option value={item} key={item}>{KQ_STAFF_SKILLS[item]}</option>)}<option value="training">Formation</option></select></label> : null}<label>Temps à réserver<input type="number" min={minimumHours} max={Math.min(7, capacity.remainingHours)} step={.5} value={hourInput} required onChange={event => setHourInput(event.target.value)} /></label></div>
      {kind === "culture" ? <label>Culture à accompagner<select value={runId} onChange={event => setRunId(event.target.value)} required={!cultureReservations}><option value="" disabled={!cultureReservations}>{cultureReservations ? "Toutes les cultures" : "Choisir une culture"}</option>{snapshot.context.activeRuns.map(run => <option value={run.id} key={run.id}>{run.name}</option>)}</select></label> : null}
      {kind === "processing" ? <label>{processingReservations ? "Transformation à accompagner" : "Lot en séchage ou affinage"}<select value={flowerId} onChange={event => setFlowerId(event.target.value)} required={!processingReservations}><option value="" disabled={!processingReservations}>{processingReservations ? "Toutes les transformations" : "Choisir un lot"}</option>{processingBatches.map(batch => <option value={batch.flowerId} key={batch.flowerId}>{batch.name}</option>)}</select></label> : null}
      {kind === "training" ? <label>Compétence à apprendre<select value={skill} onChange={event => setSkill(event.target.value as KqStaffSkill)}>{skillKeys.map(item => <option value={item} key={item}>{KQ_STAFF_SKILLS[item]} · niveau {getKqStaffLevel(employee.skills[item])}</option>)}</select></label> : null}
      {kind === "sales" ? <KqStaffProspectingMap cityId={cityId} onCityChange={setCityId} disabled={disabled || capacity.remainingHours === 0} prospecting={snapshot.state.prospecting} networkPartners={snapshot.context.shopPartners} /> : null}
      <p className={styles.muted}>{description}</p>
      {benefit ? <KqStaffBenefits preview={benefit} /> : null}
      {kind === "administration" ? <p className={styles.muted}>0,5 h suffit pour la remise. Une mission plus longue apporte davantage d’XP et laisse du temps pour les paiements autorisés dans les règles de gestion.</p> : null}
      {kind === "processing" && processingReservations ? <p className={styles.muted}>Tu peux réserver avant de préparer un lot. Le devis de transformation indiquera le volume couvert et les heures consommées, par demi-heure.</p> : null}
      {!validHours ? <p className={styles.muted}>Choisis de {minimumHours.toLocaleString("fr-FR")} à 7 heures, par demi-heure.</p> : null}
      {snapshot.outstandingCents > 0 ? <p className={payrollAdministration ? styles.callout : styles.error}>{payrollAdministration ? "Cette mission Administration reste disponible pour traiter les paies autorisées, sous les plafonds et la réserve de tes règles de gestion." : `Règle les ${money(snapshot.outstandingCents)} de salaires échus avant de confier du travail.`}</p> : null}
      {skillMaxed ? <p className={styles.muted}>Cette compétence est déjà au niveau 10. Choisis une autre formation.</p> : null}
      {targetMissing ? <p className={styles.muted}>{kind === "culture" ? "Démarre une culture pour y affecter un employé." : "Un lot doit être en séchage ou affinage pour recevoir de l’aide."}</p> : null}
      {hours > capacity.remainingHours ? <p className={styles.muted}>Il reste {hoursLabel(capacity.remainingHours)} aujourd’hui.</p> : null}
      {debitCents > snapshot.cashCents ? <p className={styles.error}>Trésorerie insuffisante : {money(debitCents)} nécessaires.</p> : null}
      <button className={styles.primary} type="submit" disabled={!canAssign}>{kind === "training" ? <GraduationCap size={18} aria-hidden="true" /> : <BriefcaseBusiness size={18} aria-hidden="true" />} Vérifier l’affectation</button>
    </fieldset></form>
    {!fixedKind ? <details><summary>Ajouter des heures aujourd’hui</summary><p className={styles.muted}>Les heures complémentaires ou supplémentaires sont ajoutées à la paie. Les plafonds du contrat et le repos hebdomadaire restent applicables.</p><div className={styles.form}><label>Heures à ajouter<select value={extraHours} disabled={disabled} onChange={event => setExtraHours(Number(event.target.value))}>{[.5, 1, 1.5, 2, 2.5, 3].map(value => <option value={value} key={value}>{hoursLabel(value)}</option>)}</select></label>{extraError ? <p className={styles.muted}>{extraError}</p> : <p>Brut supplémentaire : <strong>{money(extraGross)}</strong>, charges employeur en plus.</p>}<button type="button" disabled={disabled || !!extraError} onClick={() => prepare({ title: "Ajouter des heures de travail", description: "Ces heures deviennent disponibles aujourd’hui et leur salaire s’ajoute à la prochaine paie. Les charges employeur sont calculées en plus du brut.", rows: [["Employé", employee.name], ["Heures ajoutées", hoursLabel(extraHours)], ["Brut ajouté à la paie", money(extraGross)], ["Paiement immédiat", money(0)]], command: { action: "extra-hours", employeeId: employee.id, hours: extraHours, expectedGrossCents: extraGross }, debitCents: 0, confirmLabel: "Autoriser ces heures" })}>Vérifier les heures</button></div></details> : null}
    {(!fixedKind || fixedKind === "administration") && snapshot.context.supplierInvoices.length ? <details><summary>Régler une facture fournisseur</summary><p className={styles.muted}>Cette démarche réserve 30 minutes de la journée et paie la totalité du reste dû. Les missions en cours doivent être terminées.</p><div className={styles.form}><label>Facture à régler<select value={invoiceId} disabled={disabled} onChange={event => setInvoiceId(event.target.value)}><option value="" disabled>Choisir une facture</option>{snapshot.context.supplierInvoices.map((item, index) => <option value={item.id} key={item.id}>Facture {index + 1} · {money(item.remainingCents)} · échéance {dateTime(item.dueAt)}</option>)}</select></label><button type="button" disabled={disabled || hasRunningTask || snapshot.outstandingCents > 0 || !invoice || capacity.remainingHours < .5 || invoice.remainingCents > snapshot.cashCents} onClick={() => { if (invoice) prepare({ title: "Régler la facture fournisseur", description: "Le paiement est débité immédiatement de ta trésorerie. Cette tâche administrative consomme 30 minutes de travail.", rows: [["Employé", employee.name], ["Échéance", dateTime(invoice.dueAt)], ["Référence", invoice.id], ["À payer", money(invoice.remainingCents)]], command: { action: "pay-invoice", employeeId: employee.id, invoiceId: invoice.id, expectedCents: invoice.remainingCents }, debitCents: invoice.remainingCents, confirmLabel: "Confirmer le paiement" }); }}>Vérifier le paiement</button>{invoice && invoice.remainingCents > snapshot.cashCents ? <p className={styles.muted}>Trésorerie insuffisante pour régler cette facture.</p> : null}{capacity.remainingHours < .5 ? <p className={styles.muted}>Il faut 30 minutes disponibles aujourd’hui.</p> : null}</div></details> : null}
    {!fixedKind ? <LeaveForm employee={employee} snapshot={snapshot} prepare={prepare} disabled={disabled} /> : null}
  </div>;
}

export function KqStaffDesk({ embedded = false, onOpenTrim }: { embedded?: boolean; onOpenTrim?: (employeeId: string) => void } = {}) {
  const router = useRouter();
  const player = useKqSocialPlayer();
  const [planMotionPaused, setPlanMotionPaused] = useState(false);
  const [tab, setTab] = useState<"team" | "candidates" | "payroll">("team");
  const [candidateCode, setCandidateCode] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [planningMode, setPlanningMode] = useState<"day" | "week">("day");
  const [employeeSheet, setEmployeeSheet] = useState<{ id: string; name: string; origin: HTMLElement | null } | null>(null);
  const [contractTarget, setContractTarget] = useState<{ id: string; mode: "manage" | "rehire"; origin: HTMLElement | null } | null>(null);
  const [assignment, setAssignment] = useState<{ employeeId: string; station: Exclude<KqStaffStation, "trim"> } | null>(null);
  const [moment, setMoment] = useState<StaffMoment | null>(null);
  const assignmentHeading = useRef<HTMLHeadingElement>(null);
  const controller = useKqStaffOperations("Personnel", (command, receipt) => {
    setCandidateCode(null);
    if (["hire", "renew-contract", "convert-cdi", "rehire"].includes(command.action)) { setTab("team"); setContractTarget(null); }
    setAssignment(null);
    // Only the response to this explicit confirmation can create a reaction.
    // GETs and remounts never recreate one from the saved employee/task history.
    const { snapshot: confirmed, previousSnapshot } = receipt;
    setMoment(null);
    if (command.action === "hire") {
      const employee = confirmed.state.employees.find(person => person.code === command.candidateCode && person.status === "active" && !previousSnapshot?.state.employees.some(previous => previous.id === person.id));
      if (employee) setMoment({ id: `hire:${employee.id}`, kind: "hire", employee, serverNow: confirmed.serverNow });
    } else if (command.action === "rehire") {
      const employee = confirmed.state.employees.find(person => person.previousContractId === command.sourceContractId && person.status === "active" && !previousSnapshot?.state.employees.some(previous => previous.id === person.id));
      if (employee) setMoment({ id: `hire:${employee.id}`, kind: "hire", employee, serverNow: confirmed.serverNow });
    } else if (command.action === "train") {
      const employee = confirmed.state.employees.find(person => person.id === command.employeeId);
      const task = confirmed.state.tasks.find(item => item.kind === "training" && item.employeeId === command.employeeId && item.skill === command.skill && item.hours === command.hours && !previousSnapshot?.state.tasks.some(previous => previous.id === item.id));
      if (employee && task) setMoment({ id: `training:${task.id}`, kind: "training", employee, task, serverNow: confirmed.serverNow });
    }
  }, { refreshRecruitment: true });
  const { snapshot, loading, error, busy, prepare } = controller;
  const locked = busy || loading || !!error || !!controller.pending;
  const active = snapshot?.state.employees.filter(employee => employee.status === "active") ?? [];
  const candidates = snapshot?.candidates.filter(candidate => !active.some(employee => employee.code === candidate.code)) ?? [];
  const payable = snapshot?.state.payroll.filter(pay => pay.totalCents > pay.paidCents) ?? [];
  const ended = snapshot?.state.employees.filter(employee => employee.status === "ended") ?? [];
  const assignedEmployee = active.find(employee => employee.id === assignment?.employeeId);
  const currentMoment = moment && snapshot ? { ...moment, employee: snapshot.state.employees.find(person => person.id === moment.employee.id) ?? moment.employee, task: moment.task ? snapshot.state.tasks.find(task => task.id === moment.task?.id) ?? moment.task : undefined, serverNow: snapshot.serverNow } : moment;
  function openContract(id: string, mode: "manage" | "rehire", origin: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
    if (locked || snapshot?.context.contractLifecycleVersion !== 1) return;
    setContractTarget({ id, mode, origin: employeeSheet?.origin ?? origin });
    setEmployeeSheet(null); setAssignment(null); setMoment(null); controller.dismissNotice();
  }
  function closeContract() {
    if (locked) return;
    const origin = contractTarget?.origin;
    setContractTarget(null);
    requestAnimationFrame(() => (origin?.isConnected ? origin : document.querySelector<HTMLElement>(`[data-staff-tab="${tab}"]`))?.focus());
  }
  function openPayroll() {
    if (locked) return;
    setEmployeeSheet(null); setContractTarget(null); setAssignment(null); setTab("payroll");
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-staff-tab="payroll"]')?.focus());
  }
  function openEmployeeSheet(id: string, origin: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
    if (busy || controller.pending) return;
    const employee = snapshot?.state.employees.find(person => person.id === id);
    if (employee) setEmployeeSheet({ id, name: employee.name, origin });
  }
  function openEmployeePlanning(mode: "day" | "week" = "day", id = employeeSheet?.id) {
    if (locked || !id || !active.some(employee => employee.id === id)) return;
    setEmployeeSheet(null);
    setTab("team");
    setContractTarget(null);
    setMoment(null);
    controller.dismissNotice();
    setAssignment(null);
    setEmployeeId(id);
    setPlanningMode(mode);
    requestAnimationFrame(() => {
      const files = document.querySelector<HTMLDetailsElement>("[data-staff-team-files]");
      if (files) files.open = true;
      const dossier = [...document.querySelectorAll<HTMLElement>("[data-staff-employee-id]")].find(node => node.dataset.staffEmployeeId === id);
      dossier?.querySelector<HTMLButtonElement>(`[data-staff-planning-mode="${mode}"]`)?.focus();
    });
  }
  function dismissMoment(openEmployee = false) {
    if (locked) return;
    const id = moment?.employee.id;
    if (openEmployee && id) { openEmployeeSheet(id); return; }
    setMoment(null);
    controller.dismissNotice();
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-staff-tab="${tab}"]`)?.focus();
    });
  }
  useEffect(() => {
    if (!assignment) return;
    assignmentHeading.current?.focus({ preventScroll: true });
    assignmentHeading.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [assignment]);
  function assignToPost(selectedId: string, station: KqStaffStation) {
    if (locked || (selectedId !== "player" && !active.some(employee => employee.id === selectedId)) || (selectedId === "player" && station === "training")) return;
    if (station === "trim") {
      if (onOpenTrim) onOpenTrim(selectedId);
      else router.push(`/arene/placard?view=workshop&section=processing&workshop=trim&employee=${encodeURIComponent(selectedId)}&from=staff`);
      return;
    }
    setEmployeeId(null);
    setAssignment({ employeeId: selectedId, station });
  }
  function openTeamOverview() {
    if (locked) return;
    setTab("team");
    setContractTarget(null);
    setAssignment(null);
    requestAnimationFrame(() => {
      const plan = document.querySelector<HTMLElement>("[data-staff-work-plan]");
      plan?.scrollIntoView({ block: "start", behavior: "instant" });
      plan?.querySelector<HTMLButtonElement>("[data-staff-work-employee]")?.focus({ preventScroll: true });
    });
  }


  return <main className={styles.page}>{!embedded ? <KqChapterHeading art="staff" title="Personnel" level={1} /> : null}<div className={styles.desk} data-staff-desk data-guide-staff-ready={!!snapshot && !locked}>
    <div className={styles.overview} data-staff-overview><div className={styles.overviewStatus}><KqStaffOperationsStatus controller={controller} label="Personnel" disabled={!!controller.pending} suppressNotice={!!currentMoment} /></div></div>
    {snapshot ? <KqStaffDashboard snapshot={snapshot} disabled={locked} stale={!!error} onOpenTeam={openTeamOverview} onRecruit={() => { setTab("candidates"); setAssignment(null); setContractTarget(null); }} onPayroll={openPayroll} onOpenWeekly={id => openEmployeePlanning("week", id)} /> : null}
    {currentMoment ? <KqStaffMoment key={currentMoment.id} moment={currentMoment} disabled={locked} onDismiss={() => dismissMoment()} onOpenEmployee={() => dismissMoment(true)} /> : null}
    {active.length >= 8 && tab === "candidates" ? <p className={styles.callout}>Les huit postes de ton équipe sont occupés. Tu peux consulter les dossiers ; aucune nouvelle embauche n’est disponible.</p> : null}

    {snapshot ? <>
      <nav className={styles.tabs} aria-label="Dossiers du personnel"><button type="button" data-staff-tab="team" aria-pressed={tab === "team"} disabled={locked} onClick={() => { setTab("team"); setAssignment(null); setContractTarget(null); }}><UsersRound size={18} aria-hidden="true" /> Équipe ({active.length})</button><button type="button" data-staff-tab="candidates" aria-pressed={tab === "candidates"} disabled={locked} onClick={() => { setTab("candidates"); setAssignment(null); setContractTarget(null); }}><UserRoundPlus size={18} aria-hidden="true" /> Recruter</button><button type="button" data-staff-tab="payroll" aria-pressed={tab === "payroll"} disabled={locked} onClick={openPayroll}><CalendarDays size={18} aria-hidden="true" /> Paie & contrats{payable.length ? ` (${payable.length})` : ""}</button></nav>
      {contractTarget && snapshot.context.contractLifecycleVersion === 1 ? <KqStaffContractPlanner key={`${contractTarget.mode}:${contractTarget.id}`} contractId={contractTarget.id} mode={contractTarget.mode} snapshot={snapshot} disabled={locked} prepare={prepare} onSnapshot={controller.acceptSnapshot} onClose={closeContract} onPayroll={openPayroll} /> : null}
      {tab === "candidates" ? <section data-staff-panel="candidates" className={styles.form} aria-label="Candidatures"><header className={styles.sectionHeader}><div><h2>Les candidatures</h2><p className={styles.muted}>Compare l’expérience et le tarif. Chaque employé peut apprendre tous les métiers.</p></div></header>
        {snapshot.recruitment ? <p className={styles.callout} data-recruitment-cycle={snapshot.recruitment.cycle}>Offres des jours {snapshot.recruitment.startDay} à {snapshot.recruitment.nextDay - 1} du jeu. <strong>Prochaine relève : jour {snapshot.recruitment.nextDay}, le <time dateTime={snapshot.recruitment.refreshAt}>{dateTime(snapshot.recruitment.refreshAt)}</time></strong> (heure réelle). Les candidatures changent tous les 15 jours de jeu ; les employés recrutés restent dans ton équipe.</p> : null}
        {candidateCode && !snapshot.candidates.some(candidate => candidate.code === candidateCode) ? <p className={styles.callout} role="status">Ce dossier ne fait plus partie des offres disponibles. Choisis un nouveau profil pour préparer un autre contrat.</p> : null}
        <div className={styles.grid}>{candidates.map(candidate => {
        const cost = getKqStaffMonthlyCost(candidate, 35);
        return <article key={candidate.code} data-candidate-code={candidate.code} className={styles.dossier} data-selected={candidateCode === candidate.code}><Profile person={candidate} /><dl className={styles.numbers}><div><dt>Tarif horaire brut</dt><dd>{money(candidate.hourlyCents)} / h</dd></div><div><dt>Coût mensuel estimé à 35 h</dt><dd>{money(cost.totalCents)}</dd></div></dl><small className={styles.muted}>{candidate.contracts.map(contract => KQ_STAFF_CONTRACTS[contract]).join(" · ")}{candidate.role === "grower" ? " · 35 h uniquement" : " · de 7 à 35 h par semaine"}</small><details><summary>Parcours et compétences</summary><div className={styles.form}><p className={styles.biography}>{candidate.biography}</p><Skills skills={candidate.skills} /></div></details><button type="button" data-staff-profile aria-expanded={candidateCode === candidate.code} disabled={locked} onClick={() => setCandidateCode(candidateCode === candidate.code ? null : candidate.code)}>{candidateCode === candidate.code ? "Refermer le contrat" : "Choisir ce profil"}</button>{candidateCode === candidate.code ? <HireForm candidate={candidate} snapshot={snapshot} prepare={prepare} disabled={locked || snapshot.outstandingCents > 0 || active.length >= 8} /> : null}</article>;
      })}</div>{!candidates.length ? <p data-staff-candidates-empty="true" className={styles.empty}>Tous les profils disponibles ont déjà rejoint ton équipe.</p> : null}</section> : null}
      {tab === "team" ? <section data-staff-panel="team" className={styles.form} aria-label="Ton équipe">
        <KqStaffAdministrationRules snapshot={snapshot} prepare={prepare} disabled={locked} />
        <KqStaffWorkPlan snapshot={snapshot} snapshotReceivedAt={controller.snapshotReceivedAt} disabled={locked} motionPaused={planMotionPaused || !!employeeSheet} onToggleMotion={() => setPlanMotionPaused(value => !value)} selectedStation={assignment?.station} onSelectActor={() => { if (!locked) { setAssignment(null); setEmployeeId(null); } }} onOpenEmployee={openEmployeeSheet} onOpenPlanning={(id, mode) => openEmployeePlanning(mode, id)} employeeSheetDisabled={busy || !!controller.pending} onAssign={assignToPost} renderPortrait={employee => <KqStaffPortrait person={employee} />} renderScenePortrait={employee => <KqStaffPortrait person={employee} view="full" />} renderPlayerPortrait={player.profile ? <ChanvrierAvatar profile={player.profile} view="portrait" /> : undefined} renderPlayerScenePortrait={player.profile ? <ChanvrierAvatar profile={player.profile} view="full" /> : undefined} />
        {assignment ? <section className={styles.panel} data-staff-assignment-panel data-assignment-station={assignment.station} aria-labelledby="staff-assignment-heading">
          <header className={styles.sectionHeader}><h3 ref={assignmentHeading} id="staff-assignment-heading" tabIndex={-1}>{assignment.employeeId === "player" ? "Toi" : assignedEmployee?.name ?? "Salarié indisponible"} · {assignment.station === "training" ? "Formation" : KQ_STAFF_SKILLS[assignment.station]}</h3><button type="button" disabled={locked} onClick={() => { const station = assignment.station; setAssignment(null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-staff-station="${station}"]`)?.focus()); }}>Annuler l’affectation</button></header>
          {assignment.employeeId === "player" && assignment.station !== "training" ? <KqPlayerWorkDesk key={`player:${assignment.station}`} snapshot={snapshot} prepare={prepare} disabled={locked} fixedKind={assignment.station} /> : assignedEmployee ? <EmployeeWork key={`${assignedEmployee.id}:${assignment.station}`} employee={assignedEmployee} snapshot={snapshot} prepare={prepare} disabled={locked} fixedKind={assignment.station} onOpenWeekly={() => openEmployeePlanning("week", assignedEmployee.id)} /> : <p>Ce salarié ne fait plus partie de l’équipe active. Choisis une autre personne sur le plan.</p>}
        </section> : null}
        <KqStaffHandbook />
        <details className={styles.panel} data-staff-team-files><summary>Fiches et contrats de l’équipe ({active.length})</summary>{!active.length ? <p className={styles.empty}>Les dossiers de candidature t’attendent. Commence par le métier dont ta ferme a besoin.</p> : null}<div className={styles.grid}>{active.map(employee => {
        const capacity = getKqStaffCapacity(employee, snapshot.calendar);
        return <article className={styles.dossier} key={employee.id} data-staff-employee-id={employee.id} data-selected={employeeId === employee.id} data-planning-mode={employeeId === employee.id ? planningMode : undefined}><Profile person={employee} /><KqStaffWeeklyPlanStatus employee={employee} available={snapshot.context.weeklyPlanVersion === 1} /><p className={styles.muted}>{KQ_STAFF_CONTRACTS[employee.contract]} · {hoursLabel(employee.weeklyHours)} / semaine{employee.endsAt ? ` · fin le ${dateTime(employee.endsAt)}` : ""}</p><Schedule weeklyHours={employee.weeklyHours} weekday={snapshot.calendar.weekday} /><KqProgressMeter label={`Journée de ${employee.name}`} value={capacity.usedHours} max={capacity.baseHours + capacity.extraHours} valueLabel={`${hoursLabel(capacity.usedHours)} / ${hoursLabel(capacity.baseHours + capacity.extraHours)}`} hint={`${hoursLabel(capacity.remainingHours)} disponibles${capacity.extraHours ? `, dont ${hoursLabel(capacity.extraHours)} ajoutées à la journée` : ""}.`} /><div className={styles.actions}><button type="button" data-staff-open-employee={employee.id} aria-haspopup="dialog" disabled={busy || !!controller.pending} onClick={event => openEmployeeSheet(employee.id, event.currentTarget)}>Voir la fiche</button><button type="button" data-staff-open-planning aria-expanded={employeeId === employee.id} disabled={locked} onClick={() => { setAssignment(null); setPlanningMode("day"); setEmployeeId(employeeId === employee.id ? null : employee.id); }}>{employeeId ===employee.id ? "Refermer le planning" : "Organiser sa journée"}</button></div>{employeeId === employee.id ? <div className={styles.formSection}><div className={styles.actions} role="group" aria-label={`Mode de planning de ${employee.name}`}><button type="button" data-staff-planning-mode="day" aria-pressed={planningMode === "day"} disabled={locked} onClick={() => setPlanningMode("day")}>Journée</button><button type="button" data-staff-planning-mode="week" aria-pressed={planningMode === "week"} disabled={locked} onClick={() => setPlanningMode("week")}>Semaine type</button></div>{planningMode === "week" ? <KqStaffWeeklyPlanner key={employee.weeklyPlan?.updatedAt ?? "new"} employee={employee} snapshot={snapshot} prepare={prepare} disabled={locked} /> : <EmployeeWork employee={employee} snapshot={snapshot} prepare={prepare} disabled={locked} onOpenWeekly={() => setPlanningMode("week")} />}</div> : null}</article>;
      })}</div></details></section> : null}
      {tab === "payroll" ? <section data-staff-panel="payroll" className={styles.panel}><header className={styles.sectionHeader}><div><h2>Paie & contrats</h2><p className={styles.muted}>Les échéances et montants ci-dessous sont confirmés par le serveur.</p></div></header><dl className={styles.numbers}><div><dt>Brut mensuel contractuel</dt><dd>{money(snapshot.monthlyGrossCents)}</dd></div><div><dt>Coût employeur mensuel estimé</dt><dd>{money(snapshot.monthlyEmployerCostCents)}</dd></div><div><dt>Total à régler maintenant</dt><dd>{money(snapshot.outstandingCents)}</dd></div></dl>{snapshot.outstandingCents > 0 ? <><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy || loading || !!error || snapshot.outstandingCents > snapshot.cashCents} onClick={() => prepare({ title: "Régler les salaires échus", description: "Ce règlement paie l’intégralité des salaires, charges et indemnités actuellement dus. Le montant est débité de la trésorerie du jeu.", rows: [["Échéances", `${payable.length} paie${payable.length > 1 ? "s" : ""}`], ["Montant total", money(snapshot.outstandingCents)], ["Disponible avant", money(snapshot.cashCents)]], command: { action: "payroll", expectedCents: snapshot.outstandingCents }, debitCents: snapshot.outstandingCents, confirmLabel: "Payer les salaires" })}>Vérifier le règlement</button></div>{snapshot.outstandingCents > snapshot.cashCents ? <p className={styles.error}>Il manque {money(snapshot.outstandingCents - snapshot.cashCents)} pour régler la paie complète.</p> : null}</> : <p className={styles.muted}>Aucune paie à régler pour le moment.</p>}<ul className={styles.taskList}>{payable.map(pay => <li key={pay.id}><div><strong>{snapshot.state.employees.find(employee => employee.id === pay.employeeId)?.name ?? "Ancien employé"}</strong><small>Échéance : {dateTime(pay.dueAt)}</small><small>Brut {money(pay.grossCents)} · charges {money(pay.employerCents)}{pay.indemnityCents ? ` · indemnités ${money(pay.indemnityCents)}` : ""}</small></div><span className={styles.status}>{money(pay.totalCents - pay.paidCents)} dus</span></li>)}</ul><details><summary>Contrats et prochaines échéances ({snapshot.state.employees.length})</summary><ul className={styles.taskList}>{snapshot.state.employees.map(employee => <li key={employee.id}><div><strong>{employee.name}</strong><small>{KQ_STAFF_CONTRACTS[employee.contract]} · {hoursLabel(employee.weeklyHours)} / semaine · embauché le {dateTime(employee.hiredAt)}</small><small>{employee.endsAt ? `Fin du contrat : ${dateTime(employee.endsAt)}` : "Contrat à durée indéterminée"}</small><small>{employee.status === "active" ? `Prochaine paie : ${dateTime(employee.nextPayrollAt)}` : "Contrat terminé"}</small>{snapshot.context.contractLifecycleVersion === 1 ? employee.status === "active" ? employee.contract !== "cdi" ? <button type="button" data-staff-manage-contract={employee.id} disabled={locked} onClick={event => openContract(employee.id, "manage", event.currentTarget)}>Prolonger / CDI</button> : <small>CDI sans date de fin.</small> : employee.finalPaid ? <button type="button" data-staff-rehire={employee.id} disabled={locked} onClick={event => openContract(employee.id, "rehire", event.currentTarget)}>Réembaucher</button> : <small data-staff-rehire-unsettled>Réembauche après règlement du solde et fin des tâches.</small> : null}</div><span className={styles.status}>{employee.status === "active" ? "En poste" : payable.some(pay => pay.employeeId === employee.id) ? "Solde à régler" : employee.finalPaid ? "Solde réglé" : "Solde à vérifier"}</span></li>)}</ul>{ended.length ? <p className={styles.muted}>{snapshot.archiveCount === undefined ? "Les contrats terminés restent dans ce registre." : "Les contrats terminés restent ici tant que leur solde ou leurs tâches ne sont pas terminés."}</p> : null}</details>{snapshot.archiveCount !== undefined ? <KqStaffArchive count={snapshot.archiveCount} disabled={locked} onRehire={snapshot.context.contractLifecycleVersion === 1 ? (id, origin) => openContract(id, "rehire", origin) : undefined} /> : null}</section> : null}
      {tab === "team" && snapshot.state.tasks.length ? <details className={styles.history} data-staff-work-history><summary>Travaux & résultats ({snapshot.state.tasks.length}) · {snapshot.state.tasks.filter(task => task.status === "running").length} en cours ou à venir</summary><KqStaffTaskList snapshot={snapshot} tasks={snapshot.state.tasks} /></details> : null}
      {tab !== "team" ? <KqStaffHandbook /> : null}
      <details className={styles.panel}><summary>Comment fonctionnent les contrats et la progression ?</summary><KqHelpDashboard>
        <KqHelpGrid art="help-team" items={[
          { label: "Un jour de jeu", value: "4 h réelles", detail: "Paie : 1 mois = 5 jours réels. Dates en heure réelle.", art: "help-time" },
          { label: "Semaine salariée", value: "7 h / jour travaillé", detail: "7 h : lundi ; 14 h : lundi–mardi ; jusqu’à 35 h : lundi–vendredi. Week-end au repos.", art: "help-plan" },
          { label: "Brut mensuel", value: "Tarif × heures × 52 / 12", detail: "Heures contractuelles par semaine. Charges du jeu estimées à 35 %.", art: "help-accounts" },
          { label: "Paie due", value: "Montant du serveur", detail: "Heures ajoutées et indemnités enregistrées incluses.", art: "help-accounts" },
          { label: "Contrats", value: "CDI, CDD ou saisonnier", detail: "Chef de culture : CDI 35 h. CDD : remplacement ou surcroît. Saisonnier : ouvriers/transformation aux récoltes.", art: "help-team" },
          { label: "Compétences · tous métiers", value: "Niveau 10 max", detail: "XP : tâches et formations. Réserve quotidienne commune. Compétence et caractère influent ; succès commercial non garanti.", art: "help-training" },
          { label: "Congés annuels du jeu", value: "25 jours ouvrés · 5 semaines", detail: "Temps partiel inclus. Salaire maintenu ; solde indemnisé en fin de contrat.", art: "help-rest" },
          { label: "Décompte des congés", value: "Jours ouvrés de la ferme", detail: "Du premier jour de congé travaillé à la veille de la reprise.", art: "help-plan" },
        ]} />
        <KqHelpNote>Salaire maintenu en congé : règle simplifiée du jeu, pas une paie réelle complète. Montants et résultats du serveur font foi.</KqHelpNote>
      </KqHelpDashboard></details>
    </> : null}
    <KqStaffOperationsConfirmation controller={controller} />
    {employeeSheet && snapshot ? <KqStaffEmployeeSheet employee={snapshot.state.employees.find(employee => employee.id === employeeSheet.id)} employeeName={employeeSheet.name} snapshot={snapshot} origin={employeeSheet.origin} stale={!!error} planningDisabled={locked} onClose={() => setEmployeeSheet(null)} onOpenPlanning={() => openEmployeePlanning("day")} onOpenWeeklyPlanning={() => openEmployeePlanning("week")} onOpenContract={() => openContract(employeeSheet.id, active.some(employee => employee.id === employeeSheet.id) ? "manage" : "rehire")} onOpenPayroll={openPayroll} /> : null}
  </div></main>;
}
