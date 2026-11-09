"use client";

import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import Link from "next/link";
import { useState } from "react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { Scissors, Settings2, UserRound } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqStaffCapacity, getKqStaffLevel } from "@/lib/kanab-quest-staff";
import { KQ_STAFF_TRIMMER_COST_CENTS, getKqStaffSharedTrimQuote } from "@/lib/kanab-quest-staff-trim";
import { KQ_PLAYER_DAILY_HOURS, getKqPlayerSkills, getKqPlayerWorkday } from "@/lib/kanab-quest-player-work";
import type { KqStaffSnapshot, KqStaffTrimLot, KqStaffTrimMode } from "@/lib/kanab-quest-staff-types";
import type { KqStaffConfirmationDraft } from "./KqStaffOperations";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import { KqTrimScene } from "./KqTrimScene";
import { ChanvrierAvatar } from "../contest/ChanvrierAvatar";
import { KqStaffPortrait } from "./KqStaffPortrait";
import { KqWorkActorSelector } from "./KqWorkActorSelector";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqStaffDesk.module.css";

type Props = { snapshot: KqStaffSnapshot; prepare: (confirmation: KqStaffConfirmationDraft) => void; disabled: boolean; stale?: boolean; snapshotReceivedAt?: number; playerProfile?: ChanvrierAvatarProfile | null };
const hoursLabel = (value: number) => `${value.toLocaleString("fr-FR")} h`;
const grams = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} g`;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hasWeight = (lot: KqStaffTrimLot) => typeof lot.totalGrams === "number" && Number.isFinite(lot.totalGrams) && lot.totalGrams >= 0 && typeof lot.completedGrams === "number" && Number.isFinite(lot.completedGrams) && lot.completedGrams >= 0 && lot.completedGrams <= lot.totalGrams;
const finished = (lot: KqStaffTrimLot) => !!lot.completedAt || hasWeight(lot) && lot.completedGrams! >= lot.totalGrams!;

function SharedTrimForm({ snapshot, prepare, disabled, stale, snapshotReceivedAt, playerProfile, initialEmployeeId }: Props & { initialEmployeeId?: string }) {
  const [worker, setWorker] = useState(initialEmployeeId ?? "player");
  const [mode, setMode] = useState<KqStaffTrimMode>("manual");
  const [hourInput, setHourInput] = useState("0.5");
  const [motionPaused, setMotionPaused] = useState(false);
  const employees = snapshot.state.employees.filter(employee => employee.status === "active");
  const employee = employees.find(person => person.id === worker), player = worker === "player";
  const workday = getKqPlayerWorkday(snapshot);
  const level = getKqStaffLevel(player ? getKqPlayerSkills(snapshot.state).processing : employee?.skills.processing ?? 0);
  const effectiveLevel = Math.min(10, level + (employee?.trait === "versatile" ? 1 : 0));
  const remainingHours = player ? workday.remainingHours : employee ? getKqStaffCapacity(employee, snapshot.calendar).remainingHours : 0;
  const hours = Number(hourInput);
  let quote: ReturnType<typeof getKqStaffSharedTrimQuote> | null = null, quoteError = "";
  try { quote = getKqStaffSharedTrimQuote({ mode, hours, level: effectiveLevel, trait: employee?.trait }); }
  catch (cause) { quoteError = cause instanceof Error ? cause.message : "Prévision de trim indisponible."; }
  const queuedUntil = Math.max(Date.parse(snapshot.serverNow), ...snapshot.state.tasks.filter(task => task.employeeId === worker && task.status === "running").map(task => Date.parse(task.completesAt)));
  const estimatedEnd = queuedUntil + (quote?.durationMs ?? 0);
  const tooLate = !!quote && estimatedEnd > Date.parse(snapshot.calendar.nextDayAt);
  const beyondContract = !!employee?.endsAt && estimatedEnd > Date.parse(employee.endsAt);
  const unfinished = (snapshot.context.trimLots ?? []).filter(lot => !finished(lot));
  const legacyBusy = new Set(snapshot.state.tasks.filter(task => task.kind === "trim" && !task.trimQueue && task.status === "running").map(task => task.targetId));
  const compatible = unfinished.filter(lot => hasWeight(lot) && (!lot.mode || lot.mode === mode) && !legacyBusy.has(lot.flowerId));
  const canStart = !disabled && !!quote && compatible.length > 0 && !tooLate && !beyondContract && hours <= remainingHours && (player || (!!employee && snapshot.outstandingCents === 0)) && (mode === "manual" || snapshot.state.trimmerOwned);
  const quality = quote ? `${quote.qualityDelta > 0 ? "+" : ""}${quote.qualityDelta} point${Math.abs(quote.qualityDelta) > 1 ? "s" : ""} / 100` : "";
  const duration = quote ? `${(quote.durationMs / 60000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} min réelles` : "";
  function start() {
    if (!canStart || !quote) return;
    prepare({ title: mode === "manual" ? "Rejoindre le trim manuel" : "Rejoindre le trim à la machine", description: "L’atelier traite automatiquement les récoltes compatibles, des plus anciennes aux plus récentes. Les autres travailleurs continuent en parallèle. Les heures choisies sont entièrement réservées, même si les fleurs disponibles sont épuisées avant la fin.", rows: [
      ["Qui travaille", player ? "Toi" : employee!.name], ["Méthode", mode === "manual" ? "Manuel" : "Machine"], ["Cadence", `${grams(quote.gramsPerHour)} / h de jeu`], ["Heures réservées", hoursLabel(hours)], ["Quantité maximale prévue", grams(quote.grams)], ["Durée de cette tâche", duration], ["Début prévu · heure réelle", dateTime(new Date(queuedUntil).toISOString())], ["Fin prévue · heure réelle", dateTime(new Date(estimatedEnd).toISOString())], ["Contribution à la présentation · estimation", quality], ["Paiement immédiat", formatKqCash(0)],
    ], command: { action: "trim", employeeId: player ? null : employee!.id, mode, hours, expectedCostCents: 0 }, debitCents: 0, confirmLabel: "Confirmer le trim" });
  }
  return <div className={styles.form}>
    <KqTrimScene snapshot={snapshot} workerId={worker} mode={mode} stale={stale} snapshotReceivedAt={snapshotReceivedAt} playerProfile={playerProfile} paused={motionPaused} onPausedChange={setMotionPaused} />
    <form className={styles.panel} data-trim-shared-form onSubmit={event => { event.preventDefault(); start(); }}>
      <h3>Rejoindre l’atelier</h3>
      <div className={styles.actorSelection} data-trim-worker={worker}><KqWorkActorSelector label="Qui fait le trim ?" value={worker} onChange={setWorker} disabled={disabled} options={[
        { id: "player", name: "Toi", portrait: playerProfile ? <ChanvrierAvatar profile={playerProfile} view="portrait" /> : <UserRound size={30} aria-hidden="true" />,
          detail: `Niv. ${getKqStaffLevel(getKqPlayerSkills(snapshot.state).processing)} · ${hoursLabel(workday.remainingHours)}`,
          disabledReason: workday.remainingHours < .5 ? "Heures épuisées" : undefined },
        ...employees.map(person => {
          const capacity = getKqStaffCapacity(person, snapshot.calendar);
          return { id: person.id, name: person.name, portrait: <KqStaffPortrait person={person} />,
            detail: `Niv. ${getKqStaffLevel(person.skills.processing)} · ${hoursLabel(capacity.remainingHours)}`,
            disabledReason: snapshot.outstandingCents > 0 ? "Paie à régulariser" : capacity.remainingHours < .5 ? "Aucune heure disponible" : undefined };
        }),
      ]} /></div>
      <div className={styles.fields}><label>Heures de trim<input type="number" min={.5} max={Math.min(player ? KQ_PLAYER_DAILY_HOURS : 10, remainingHours)} step={.5} value={hourInput} disabled={disabled} required onChange={event => setHourInput(event.target.value)} /></label></div>
      <p className={styles.muted}>{player ? `${hoursLabel(remainingHours)} disponibles aujourd’hui, week-end compris. Tes activités partagent les mêmes ${KQ_PLAYER_DAILY_HOURS} h quotidiennes.` : employee ? `${hoursLabel(remainingHours)} disponibles aujourd’hui sur le planning commun de ${employee.name}.` : "Choisis une personne disponible."}</p>
      <div className={styles.actions} role="group" aria-label="Méthode de trim"><button type="button" aria-pressed={mode === "manual"} disabled={disabled} onClick={() => setMode("manual")}><Scissors size={18} aria-hidden="true" /> Manuel</button><button type="button" aria-pressed={mode === "machine"} disabled={disabled} onClick={() => setMode("machine")}><Settings2 size={18} aria-hidden="true" /> Machine</button></div>
      {quote ? <dl className={styles.numbers}><div><dt>Cadence de {player ? "ton travail" : employee?.name ?? "cette personne"}</dt><dd>{grams(quote.gramsPerHour)} / h de jeu</dd></div><div><dt>Quantité maximale prévue</dt><dd>{grams(quote.grams)}</dd></div><div><dt>Durée de cette tâche</dt><dd>{duration}</dd></div></dl> : <p className={styles.muted}>{quoteError}</p>}
      <p className={styles.muted}>{mode === "manual" ? "Le travail manuel améliore la présentation des fleurs." : "La machine traite quatre fois plus de fleurs par heure, mais réduit leur présentation."} Les récoltes gardent la méthode avec laquelle elles ont commencé.</p>
      {mode === "machine" && !snapshot.state.trimmerOwned ? <p className={styles.callout}>La trimeuse doit être achetée avant cette méthode : {formatKqCash(KQ_STAFF_TRIMMER_COST_CENTS)} pour toute la ferme. Son achat se confirme ci-dessous.</p> : null}
      {!player && snapshot.outstandingCents > 0 ? <p className={styles.callout}>Règle les salaires échus avant de confier du trim à un employé.</p> : null}
      {hours > remainingHours ? <p className={styles.callout}>Le planning ne contient pas assez d’heures disponibles.</p> : null}
      {tooLate ? <p className={styles.callout}>Cette tâche finirait après la fin de journée, le {dateTime(snapshot.calendar.nextDayAt)}. Réduis la durée ou reprends au prochain jour.</p> : null}
      {beyondContract ? <p className={styles.callout}>Cette tâche dépasserait la fin du contrat. Réduis sa durée ou choisis une autre personne.</p> : null}
      {!compatible.length ? <p className={styles.muted}>{!unfinished.length ? "Aucune récolte en attente de trim." : "Aucune récolte disponible pour cette méthode : les lots déjà commencés gardent leur mode et les anciennes tâches réservées doivent se terminer."}</p> : null}
      {queuedUntil > Date.parse(snapshot.serverNow) ? <p className={styles.callout}>Cette personne rejoindra l’atelier après ses missions déjà réservées, vers {dateTime(new Date(queuedUntil).toISOString())}.</p> : null}
      <button type="submit" className={styles.primary} disabled={!canStart}>Vérifier le trim</button>
      <details><summary>Cadence, temps et qualité</summary><KqHelpDashboard>
        <KqBarChart title="Cadence selon le niveau de Transformation" items={[
          { label: "Manuel · niveau 1", value: 60, displayValue: "60 g/h de jeu" },
          { label: "Manuel · niveau 10", value: 150, displayValue: "150 g/h de jeu" },
          { label: "Machine · niveau 1", value: 240, displayValue: "240 g/h de jeu", tone: "gold" },
          { label: "Machine · niveau 10", value: 600, displayValue: "600 g/h de jeu", tone: "gold" },
        ]} />
        <KqHelpGrid art="help-workshop" items={[
          { label: "Progression manuelle", value: "+10 g/h par niveau", detail: "Machine : cadence × 4.", art: "help-training" },
          { label: "1 h de jeu", value: "10 min réelles", art: "help-time" },
          { label: "Présentation · manuel", value: "+1 à +3 points", detail: "Selon compétence et caractère.", art: "help-quality" },
          { label: "Présentation · machine", value: "−3 à −1 point", detail: "Selon compétence et caractère.", art: "help-workshop" },
          { label: "Travail d’équipe", value: "En parallèle", detail: "Un planning par personne.", art: "help-team" },
          { label: "Ajustement du lot", value: "Une fois, à la fin", detail: "Selon le travail réellement effectué.", art: "harvest" },
        ]} />
        <KqHelpNote>Le serveur confirme les grammes selon les fleurs disponibles. Les heures réservées restent consommées si aucune fleur compatible ne reste.</KqHelpNote>
      </KqHelpDashboard></details>
    </form>
  </div>;
}

export function KqTrimWorkbench({ snapshot, prepare, disabled, stale, snapshotReceivedAt, playerProfile, initialFlowerId, initialEmployeeId, onOpenHarvests }: Props & { initialFlowerId?: string; initialEmployeeId?: string; onOpenHarvests?: (flowerId: string) => void }) {
  const api = useKqTutorialApi();
  const lots = snapshot.context.trimLots;
  if (snapshot.context.trimQueueVersion !== 2 || !lots) return <section className={styles.panel}><h2>Le trim des récoltes</h2><p role="status">L’atelier commun n’est pas encore disponible. Actualise après sa mise à jour pour retrouver le trim et ses quantités confirmées.</p></section>;
  const unfinished = lots.filter(lot => !finished(lot)), completed = lots.filter(finished);
  const remaining = unfinished.every(hasWeight) ? unfinished.reduce((total, lot) => total + Math.max(0, lot.totalGrams! - lot.completedGrams!), 0) : null;
  const guideState = (lot: KqStaffTrimLot) => {
    if (stale || disabled) return undefined;
    if (finished(lot)) return "complete";
    const tasks = snapshot.state.tasks.filter(task => task.kind === "trim" && task.status === "running" && (task.targetId === lot.flowerId || task.trimContributions?.some(part => part.flowerId === lot.flowerId)));
    if (tasks.some(task => Date.parse(task.startedAt) <= Date.parse(snapshot.serverNow))) return "running";
    return tasks.length ? "queued" : "required";
  };
  const requestedEmployee = snapshot.state.employees.find(employee => employee.id === initialEmployeeId && employee.status === "active");
  return <section className={styles.form} aria-label="Atelier de trim" data-guide-trim-ready={!stale && !disabled}>
    <header className={styles.sectionHeader}><div><h2>Trim des récoltes</h2><p className={styles.muted}>Les récoltes compatibles sont traitées des plus anciennes aux plus récentes.</p></div></header>
    <dl className={styles.numbers} aria-label="Récoltes en attente de trim"><div><dt>Reste à préparer</dt><dd>{remaining === null ? "Quantité à vérifier" : grams(remaining)}</dd></div><div><dt>Récoltes à préparer</dt><dd>{unfinished.length}</dd></div></dl>
    {initialEmployeeId && initialEmployeeId !== "player" ? <p className={styles.callout} data-trim-assigned-employee={initialEmployeeId}>{requestedEmployee ? <><strong>{requestedEmployee.name}</strong> est présélectionné. Choisis sa méthode et ses heures avant de confirmer.</> : "Le salarié choisi n’est plus disponible. Choisis une autre personne avant de confirmer."}</p> : null}
    <SharedTrimForm snapshot={snapshot} prepare={prepare} disabled={disabled} stale={stale} snapshotReceivedAt={snapshotReceivedAt} playerProfile={playerProfile} initialEmployeeId={initialEmployeeId} />
    <section className={styles.panel}><h3>Suivi des récoltes</h3>
      {initialFlowerId && !lots.some(lot => lot.flowerId === initialFlowerId) ? <p data-guide-trim-flower-id={initialFlowerId} data-guide-trim-state={!stale && !disabled ? "not-required" : undefined}>La récolte suivie n’a plus de trim requis dans l’atelier.</p> : null}
      {!lots.length ? <p className={styles.empty}>Aucune récolte à préparer pour le moment.</p> : null}
      <ul className={styles.taskList}>{[...unfinished, ...completed].map(lot => <li key={lot.flowerId} data-guide-trim-flower-id={lot.flowerId} data-guide-trim-state={guideState(lot)} data-trim-followed={lot.flowerId === initialFlowerId || undefined}><div><strong>{lot.name}</strong>{hasWeight(lot) ? <KqProgressMeter label={`Trim confirmé · ${lot.name}`} value={lot.completedGrams!} max={lot.totalGrams!} valueLabel={`${grams(lot.completedGrams!)} / ${grams(lot.totalGrams!)}`} /> : <small>Quantité en grammes indisponible.</small>}<small>{lot.mode ? `Méthode : ${lot.mode === "manual" ? "manuelle" : "machine"}.` : "La première contribution fixe la méthode."}</small>{lot.completedAt ? <small>Terminé le {dateTime(lot.completedAt)}</small> : null}
        {finished(lot) ? onOpenHarvests ? <button type="button" disabled={disabled} onClick={() => onOpenHarvests(lot.flowerId)}>Retrouver cette récolte →</button> : !api.isTutorial && !disabled ? <Link className={styles.textLink} href={`/arene/placard?view=harvests&flower=${encodeURIComponent(lot.flowerId)}`}>Retrouver cette récolte →</Link> : <small>Retrouve les prochaines étapes dans tes récoltes.</small> : null}</div><span className={styles.status}>{finished(lot) ? "Trim terminé" : "À préparer"}</span></li>)}</ul>
    </section>
    <section className={styles.panel}><header className={styles.sectionHeader}><h3>La trimeuse de la ferme</h3><Settings2 size={24} aria-hidden="true" /></header>{snapshot.state.trimmerOwned ? <p>La machine est disponible pour toi et toute ton équipe. Le trim manuel reste possible pour les récoltes compatibles.</p> : <><p><strong>{formatKqCash(KQ_STAFF_TRIMMER_COST_CENTS)}</strong> · achat unique partagé par toute la ferme.</p><p className={styles.muted}>Elle accélère le travail au prix de la présentation des fleurs. Le travail manuel reste gratuit hors salaires habituels.</p><div className={styles.actions}><button type="button" disabled={disabled || snapshot.cashCents < KQ_STAFF_TRIMMER_COST_CENTS} onClick={() => prepare({ title: "Acheter la trimeuse", description: "Cet achat unique rend la machine disponible pour toi et les employés. Les récoltes déjà commencées gardent leur méthode.", rows: [["Achat de la trimeuse", formatKqCash(KQ_STAFF_TRIMMER_COST_CENTS)], ["Coût des tâches ensuite", "Aucun frais supplémentaire hors salaires"], ["Effet de la machine", "Cadence multipliée par quatre ; présentation réduite"]], command: { action: "buy-trimmer", expectedCostCents: KQ_STAFF_TRIMMER_COST_CENTS }, debitCents: KQ_STAFF_TRIMMER_COST_CENTS, confirmLabel: "Acheter la trimeuse" })}>Vérifier cet achat</button></div>{snapshot.cashCents < KQ_STAFF_TRIMMER_COST_CENTS ? <p className={styles.muted}>Il manque {formatKqCash(KQ_STAFF_TRIMMER_COST_CENTS - snapshot.cashCents)} pour acheter la machine.</p> : null}</>}</section>
  </section>;
}
