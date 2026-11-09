"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_PLAYER_COUNTRYSIDE_COST_CENTS, KQ_PLAYER_DAILY_HOURS, getKqPlayerSkills, getKqPlayerWorkday } from "@/lib/kanab-quest-player-work";
import { KQ_PROSPECTING_DEPARTMENTS } from "@/lib/kanab-quest-prospecting";
import { KQ_STAFF_CITIES, KQ_STAFF_SKILLS, getKqStaffLevel } from "@/lib/kanab-quest-staff";
import type { KqStaffSkill, KqStaffSnapshot } from "@/lib/kanab-quest-staff-types";
import type { KqStaffConfirmationDraft } from "./KqStaffOperations";
import { KqStaffProspectingMap } from "./KqStaffProspectingMap";
import { KqProgressMeter } from "./KqVisuals";
import { getKqStaffBenefitPreview } from "@/lib/kanab-quest-staff-benefits";
import { getKqStaffBenefitRows, KqStaffBenefits } from "./KqStaffBenefits";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import type { KqPrintedArtKind } from "./KqPrintedArt";
import styles from "./KqStaffDesk.module.css";

type Activity = KqStaffSkill | "countryside";
type Props = { snapshot: KqStaffSnapshot; disabled: boolean; prepare: (confirmation: KqStaffConfirmationDraft) => void; fixedKind: KqStaffSkill };
const skillKeys = Object.keys(KQ_STAFF_SKILLS) as KqStaffSkill[];
const skillArt: Record<KqStaffSkill, KqPrintedArtKind> = { culture: "help-culture", processing: "help-workshop", communication: "help-social", sales: "help-travel", administration: "help-accounts" };
const hoursLabel = (value: number) => `${value.toLocaleString("fr-FR")} h`;
const dateTime = (value: string | number) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const activityLabel = (kind: Activity) => kind === "countryside" ? "Sillonner les campagnes" : KQ_STAFF_SKILLS[kind];
const descriptions: Record<Activity, string> = {
  culture: "Tu soignes une culture en cours. Le bénéfice dépend de ta compétence et sera appliqué à la fin du travail.",
  processing: "Tu aides un lot en séchage ou affinage. Le temps gagné dépend de ton expérience et sera confirmé à la fin.",
  communication: "Tu prépares la communication de la ferme. Les abonnés et la réputation gagnés sont confirmés à la fin.",
  sales: "Tu prospectes les boutiques de la ville choisie. Le trajet est payé au départ ; trouver un partenaire n’est pas garanti.",
  administration: "Tu négocies les nouvelles fournitures de l’Entrepôt. La remise dure 7 jours du jeu, sans changer les anciennes factures.",
  countryside: "Tu consacres ta journée aux boutiques rurales du département choisi. La tournée dure 12 h de jeu, soit 2 h réelles, et peut rapporter de 0 à 2 nouveaux contacts commerciaux. Le résultat n’est pas garanti.",
};

/** Personal work and workshop trim consume the same server-owned daily reserve. */
export function KqPlayerWorkDesk({ snapshot, disabled, prepare, fixedKind }: Props) {
  const [prospectingMode, setProspectingMode] = useState<"city" | "countryside">("city");
  const kind: Activity = fixedKind === "sales" && prospectingMode === "countryside" ? "countryside" : fixedKind;
  const [hourInput, setHourInput] = useState(fixedKind === "administration" ? "0.5" : "2");
  const [runId, setRunId] = useState(snapshot.context.activeRuns[0]?.id ?? "");
  const [flowerId, setFlowerId] = useState(snapshot.context.processingBatches[0]?.flowerId ?? "");
  const [cityId, setCityId] = useState(KQ_STAFF_CITIES[0].id);
  const [department, setDepartment] = useState<string>("35");
  const workday = getKqPlayerWorkday(snapshot);
  const skills = getKqPlayerSkills(snapshot.state);
  const rural = kind === "countryside";
  const hours = rural ? KQ_PLAYER_DAILY_HOURS : Number(hourInput);
  const minimum = kind === "sales" ? 2 : .5;
  const validHours = Number.isFinite(hours) && hours >= minimum && hours <= KQ_PLAYER_DAILY_HOURS && Number.isInteger(hours * 2);
  const benefit = validHours ? getKqStaffBenefitPreview({ actor: { skills }, kind, hours, context: snapshot.context, cityId }) : null;
  const city = KQ_STAFF_CITIES.find(item => item.id === cityId)!;
  const selectedDepartment = KQ_PROSPECTING_DEPARTMENTS.find(item => item.code === department)!;
  const debitCents = rural ? KQ_PLAYER_COUNTRYSIDE_COST_CENTS : kind === "sales" ? city.travelCents : 0;
  const batches = snapshot.context.processingBatches.filter((batch, index, all) => all.findIndex(item => item.flowerId === batch.flowerId) === index);
  const selectedRun = snapshot.context.activeRuns.find(run => run.id === runId);
  const selectedBatch = batches.find(batch => batch.flowerId === flowerId);
  const queuedUntil = Math.max(Date.parse(snapshot.serverNow), ...snapshot.state.tasks.filter(task => task.employeeId === "player" && task.status === "running").map(task => Date.parse(task.completesAt)));
  const estimatedEnd = queuedUntil + (validHours ? hours : 0) * KQ_GAME_DAY_MS / 24;
  const tooLate = validHours && estimatedEnd > Date.parse(workday.nextDayAt);
  const targetMissing = kind === "culture" ? !selectedRun : kind === "processing" ? !selectedBatch : false;
  const batchEndsTooSoon = kind === "processing" && !!selectedBatch && Date.parse(selectedBatch.readyAt) <= estimatedEnd;
  const canStart = !disabled && validHours && hours <= workday.remainingHours && !tooLate && !targetMissing && !batchEndsTooSoon && debitCents <= snapshot.cashCents;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canStart) return;
    const target = kind === "culture" ? selectedRun?.name : kind === "processing" ? selectedBatch?.name : kind === "sales" ? `${city.name} (${city.department})` : rural ? `${selectedDepartment.name} (${department})` : undefined;
    prepare({ title: rural ? "Confirmer la tournée des campagnes" : "Confirmer mon travail", description: descriptions[kind], rows: [
      ["Qui travaille", "Toi"], ["Activité", activityLabel(kind)], ...(target ? [["Destination / objectif", target] as [string, string]] : []),
      ["Temps réservé aujourd’hui", hoursLabel(hours)], ["Heures restant après", hoursLabel(workday.remainingHours - hours)],
      ["Début estimé · heure réelle", dateTime(queuedUntil)], ["Fin estimée · heure réelle", dateTime(estimatedEnd)],
      ...(benefit ? getKqStaffBenefitRows(benefit) : []),
      ["Salaire", "Aucun"], [kind === "sales" || rural ? "Frais de déplacement au départ" : "Paiement immédiat", formatKqCash(debitCents)],
    ], command: { action: "player-assign", kind, hours, expectedCostCents: debitCents, ...(kind === "culture" ? { targetId: runId } : kind === "processing" ? { targetId: flowerId } : kind === "sales" ? { cityId } : rural ? { department } : {}) }, debitCents, confirmLabel: kind === "sales" || rural ? "Payer le trajet et partir" : "Commencer mon travail" });
  }

  if (fixedKind === "processing" && snapshot.context.processingWorkVersion === 1) return <div className={styles.form} data-player-processing-entry>
    <KqProgressMeter label="Tes heures réservées aujourd’hui" value={workday.usedHours} max={workday.dailyHours} valueLabel={`${hoursLabel(workday.usedHours)} / ${hoursLabel(workday.dailyHours)}`} hint={`${hoursLabel(workday.remainingHours)} disponibles.`} />
    <p>Le devis dans Commerce indique les heures nécessaires. Un salarié utilise ses propres heures de transformation.</p>
    <Link href="/arene/placard?view=market&section=sales" prefetch={false} className={styles.primary}>Choisir un lot à transformer</Link>
  </div>;

  return <div className={styles.form} data-player-work-desk>
    <KqProgressMeter label="Tes heures réservées aujourd’hui" value={workday.usedHours} max={workday.dailyHours} valueLabel={`${hoursLabel(workday.usedHours)} / ${hoursLabel(workday.dailyHours)}`} hint={`${hoursLabel(workday.remainingHours)} disponibles, partagées avec ton trim et tes autres gestes dans la ferme.`} />
    <p className={styles.muted}>Aucun salaire personnel. Prochaine journée : <time dateTime={workday.nextDayAt}>{dateTime(workday.nextDayAt)}</time> (heure réelle).</p>
    <form className={styles.form} data-player-work-form onSubmit={submit}>
      <fieldset className={styles.form} disabled={disabled}>
        {fixedKind === "sales" ? <div className={styles.actions} role="group" aria-label="Type de prospection"><button type="button" data-player-prospecting-mode="city" aria-pressed={!rural} onClick={() => setProspectingMode("city")}>En ville</button><button type="button" data-player-prospecting-mode="countryside" aria-pressed={rural} onClick={() => setProspectingMode("countryside")}>Sillonner les campagnes</button></div> : null}
        <dl className={`${styles.numbers} ${styles.workQuote}`}><div><dt>{kind === "sales" || rural ? "Trajet à payer au départ" : "Paiement immédiat"}</dt><dd>{formatKqCash(debitCents)}</dd></div>{validHours ? <div><dt>Fin estimée · heure réelle</dt><dd>{dateTime(estimatedEnd)}</dd></div> : null}</dl>
        <label>Tes heures à réserver<input type="number" min={rural ? KQ_PLAYER_DAILY_HOURS : minimum} max={KQ_PLAYER_DAILY_HOURS} step={.5} value={rural ? KQ_PLAYER_DAILY_HOURS : hourInput} readOnly={rural} required onChange={event => setHourInput(event.target.value)} /></label>
        {kind === "culture" ? <label>Ta culture à accompagner<select value={runId} required onChange={event => setRunId(event.target.value)}><option value="" disabled>Choisir une culture</option>{snapshot.context.activeRuns.map(run => <option value={run.id} key={run.id}>{run.name}</option>)}</select></label> : null}
        {kind === "processing" ? <label>Ton lot en séchage ou affinage<select value={flowerId} required onChange={event => setFlowerId(event.target.value)}><option value="" disabled>Choisir un lot</option>{batches.map(batch => <option value={batch.flowerId} key={batch.flowerId}>{batch.name}</option>)}</select></label> : null}
        {kind === "sales" ? <KqStaffProspectingMap cityId={cityId} onCityChange={setCityId} disabled={disabled} prospecting={snapshot.state.prospecting} networkPartners={snapshot.context.shopPartners} /> : null}
        {rural ? <label>Département à sillonner<select value={department} onChange={event => setDepartment(event.target.value)}>{KQ_PROSPECTING_DEPARTMENTS.map(item => <option value={item.code} key={item.code}>{item.code} · {item.name}</option>)}</select></label> : null}
        <p className={styles.muted}>{descriptions[kind]}</p>
        {benefit ? <KqStaffBenefits preview={benefit} /> : null}
        {kind === "administration" ? <p className={styles.muted}>0,5 h suffit pour la même remise pendant 7 jours. Plus de temps augmente ton XP.</p> : null}
        {queuedUntil > Date.parse(snapshot.serverNow) ? <p className={styles.muted}>Cette mission commencera après ton travail déjà réservé, vers {dateTime(queuedUntil)}. Tes tâches se suivent, trim compris.</p> : null}
        {!validHours ? <p className={styles.muted}>Choisis de {minimum.toLocaleString("fr-FR")} à {KQ_PLAYER_DAILY_HOURS} heures, par demi-heure.</p> : null}
        {hours > workday.remainingHours ? <p className={styles.callout} role="status">{rural ? `Cette tournée demande tes ${KQ_PLAYER_DAILY_HOURS} h complètes. ` : ""}Il reste {hoursLabel(workday.remainingHours)} aujourd’hui.</p> : null}
        {tooLate ? <p className={styles.callout} role="status">Cette mission finirait après la fin de journée, le {dateTime(workday.nextDayAt)}. {rural ? "Reviens au prochain jour pour une tournée complète." : "Réduis la durée ou reprends au prochain jour."}</p> : null}
        {targetMissing ? <p className={styles.muted}>{kind === "culture" ? "Démarre une culture avant de l’accompagner." : "Un lot doit être en séchage ou affinage pour recevoir ton aide."}</p> : null}
        {batchEndsTooSoon ? <p className={styles.muted}>Ce lot serait déjà prêt à la fin de ta mission. Réduis sa durée ou choisis un autre lot.</p> : null}
        {debitCents > snapshot.cashCents ? <p className={styles.error}>Trésorerie insuffisante : {formatKqCash(debitCents)} nécessaires.</p> : null}
        <button type="submit" className={styles.primary} disabled={!canStart}><BriefcaseBusiness size={18} aria-hidden="true" /> Vérifier mon travail</button>
      </fieldset>
    </form>
    <details><summary>Tes compétences</summary><KqHelpDashboard>
      <KqHelpGrid art="help-training" items={skillKeys.map(skill => ({ label: KQ_STAFF_SKILLS[skill], value: `Niv. ${getKqStaffLevel(skills[skill])}`, detail: `${skills[skill].toLocaleString("fr-FR")} XP`, art: skillArt[skill] }))} />
      <KqHelpNote>Mission terminée → XP de la compétence. Trim → Transformation. Ville ou campagnes → Prospection.</KqHelpNote>
    </KqHelpDashboard></details>
  </div>;
}
