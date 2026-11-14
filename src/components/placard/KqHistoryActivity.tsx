"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, CircleHelp, RotateCcw, Save } from "lucide-react";
import type { HistoryActivity, HistoryChoice } from "@/lib/kanab-quest-school-history-types";
import {
  activityStepStatus, isActivityStepReady, isActivityValidated, lastReachableActivityStep,
  restoreSchoolActivityDraft, updateSchoolActivityDraft, type SchoolActivityAction,
} from "@/lib/kanab-quest-school-activity-state";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolActivity.module.css";

type ActivityProps = {
  activity: HistoryActivity; completed?: boolean; busy?: boolean; onComplete: () => void; storageKey?: string;
};
const subscribeToHydration = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;
function readActivity(activity: HistoryActivity, key?: string) {
  try { return restoreSchoolActivityDraft(activity, key ? JSON.parse(sessionStorage.getItem(key) || "null") : undefined); }
  catch { return restoreSchoolActivityDraft(activity); }
}
function OptionFeedback({ option, label }: { option: HistoryChoice; label: string }) {
  const Icon = option.correct ? CircleCheck : CircleHelp;
  return <div className={styles.feedbackPart}>
    <strong><Icon size={18} aria-hidden="true"/>{label} · {option.correct ? "Juste" : "À revoir"}</strong>
    <p>{option.feedback}</p>
    <details className={styles.selectedAnswer}><summary>Votre choix</summary><p>{option.text}</p></details>
  </div>;
}

function ActivitySession({ activity, completed, busy, onComplete, storageKey }: ActivityProps) {
  const [draft, setDraft] = useState(() => readActivity(activity, storageKey));
  const [documentIndex, setDocumentIndex] = useState(0);
  const focusRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLFieldSetElement>(null);
  const focusIntent = useRef<"panel" | "reason" | null>(null);
  const step = activity.steps[draft.stepIndex];
  const status = step ? activityStepStatus(step, draft) : "pending";
  const selectedChoice = step?.choices.find(choice => choice.id === draft.choices[step.id]);
  const selectedReason = step?.reasons?.find(reason => reason.id === draft.reasons[step.id]);
  const validated = activity.steps.filter(item => activityStepStatus(item, draft) === "correct").length;
  const passed = isActivityValidated(activity, draft);
  const showingSummary = passed && draft.summary;
  useEffect(() => {
    const intent = focusIntent.current;
    focusIntent.current = null;
    if (!intent) return;
    const element = intent === "reason" ? reasonRef.current : focusRef.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "start", behavior: "instant" });
  }, [draft]);
  function update(action: SchoolActivityAction, focus: "panel" | "reason" | null = null) {
    const next = updateSchoolActivityDraft(activity, draft, action);
    if (next === draft) return;
    focusIntent.current = focus;
    setDraft(next);
    if (storageKey) try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* A blocked local draft never blocks server progress. */ }
  }
  const correctChoices = step?.choices.filter(choice => choice.correct) ?? [];
  const correctReasons = step?.reasons?.filter(reason => reason.correct) ?? [];
  const documentsAreEvidence = activity.kind === "documents" || activity.kind === "dossier";
  const documents = activity.documents ?? [];

  return <section className={styles.activity} data-history-activity={activity.id} aria-labelledby={activity.id + "-title"}>
    <header className={styles.heading}>
      <h4 id={activity.id + "-title"}>{activity.title}</h4>
      {completed ? <span className={styles.recorded}><CircleCheck size={17} aria-hidden="true"/>Activité enregistrée</span> : null}
    </header>
    <div className={styles.progress} aria-label={validated + " étapes validées sur " + activity.steps.length}>
      <div className={styles.track} aria-hidden="true">{activity.steps.map(item => <span key={item.id} data-validated={activityStepStatus(item, draft) === "correct"}>{activityStepStatus(item, draft) === "correct" ? <Check size={13}/> : null}</span>)}</div>
      <span>{validated} / {activity.steps.length} validée{activity.steps.length > 1 ? "s" : ""}</span>
    </div>
    {!showingSummary ? <>
      <div className={styles.context}>
        {activity.fictional ? <span className={styles.fiction}>Situation fictive</span> : null}
        <p>{activity.scenario}</p>
        <details><summary>Objectif de l’activité</summary><p>{activity.evaluates}</p></details>
      </div>
      {documents.length ? <div className={styles.documents}>
        {documentsAreEvidence ? <p className={styles.documentHint}><BookOpen size={18} aria-hidden="true"/>Les documents ci-dessous servent à répondre.</p> : null}
        {documentsAreEvidence && documents.length > 1 ? <nav className={styles.documentTabs} aria-label="Documents du dossier">{documents.map((document, index) => <button key={index} type="button" aria-pressed={documentIndex === index} aria-label={document.title} onClick={() => setDocumentIndex(index)}>Document {index + 1}</button>)}</nav> : null}
        {documents.map((document, index) => (!documentsAreEvidence || index === documentIndex) ? <details key={index} className={styles.document} open={documentsAreEvidence ? true : undefined}>
          <summary>{document.title}</summary><p>{document.text}</p><small>{document.status}</small><KqHistorySources ids={document.sourceIds}/>
        </details> : null)}
      </div> : null}
    </> : null}
    {activity.steps.length > 1 ? <nav className={styles.steps} aria-label="Étapes de l’activité">
      {activity.steps.map((item, index) => {
        const done = activityStepStatus(item, draft) === "correct";
        return <button key={item.id} type="button" data-activity-step={item.id}
          aria-current={!showingSummary && draft.stepIndex === index ? "step" : undefined}
          aria-label={"Étape " + (index + 1) + ", " + (done ? "validée" : index === draft.stepIndex ? "en cours" : "à faire")}
          disabled={index > lastReachableActivityStep(activity, draft)} onClick={() => update({ type: "go", index }, "panel")}>
          {done ? <Check size={16} aria-hidden="true"/> : null}{index + 1}
        </button>;
      })}
    </nav> : null}
    <div ref={focusRef} tabIndex={-1} className={styles.stage} data-activity-stage={showingSummary ? "summary" : status === "pending" ? "answer" : "feedback"}
      aria-labelledby={activity.id + (showingSummary ? "-summary-title" : "-step-title")}>
      {showingSummary ? <div className={styles.summary} data-activity-summary="true">
        <CircleCheck size={48} aria-hidden="true" className={styles.successIcon}/>
        <h5 id={activity.id + "-summary-title"}>Toutes les étapes sont validées</h5>
        <p>{activity.takeaway}</p>
        <div className={styles.summaryChecks} aria-label={validated + " étapes validées"}>{activity.steps.map((item, index) => <span key={item.id}><CircleCheck size={18} aria-hidden="true"/>Étape {index + 1}</span>)}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={completed || busy} onClick={() => { if (isActivityValidated(activity, draft)) onComplete(); }}>
            {completed ? <Check size={19} aria-hidden="true"/> : <Save size={19} aria-hidden="true"/>}
            {completed ? "Activité enregistrée" : busy ? "Enregistrement indisponible…" : "Enregistrer cette activité"}
          </button>
          <button type="button" onClick={() => update({ type: "go", index: 0 }, "panel")}>Revoir mes réponses</button>
        </div>
        <small>Cette activité ne verse pas de monnaie du jeu.</small>
      </div> : step ? <>
        <p className={styles.stepCount}>Étape {draft.stepIndex + 1} / {activity.steps.length}</p>
        <h5 id={activity.id + "-step-title"}>{step.prompt}</h5>
        {status === "pending" ? <>
          {draft.answerStage === "reason" && selectedChoice ? <div className={styles.chosenAnswer}>
            <span>Votre réponse</span><p>{selectedChoice.text}</p>
            <button type="button" onClick={() => update({ type: "edit-choice" }, "panel")}>Modifier ce choix</button>
          </div> :
          <fieldset className={styles.options} aria-labelledby={activity.id + "-step-title"}>
            <legend className={styles.srOnly}>Votre réponse</legend>
            {step.choices.map((choice, index) => <label key={choice.id} className={styles.option} data-selected={selectedChoice?.id === choice.id}>
              <input type="radio" name={activity.id + "-" + step.id} value={choice.id} checked={selectedChoice?.id === choice.id} onChange={() => update({ type: "choice", id: choice.id })}/>
              <span className={styles.optionLetter} aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{choice.text}</span>
            </label>)}
          </fieldset>}
          {draft.answerStage === "reason" && selectedChoice && step.reasons?.length ? <fieldset ref={reasonRef} tabIndex={-1} className={styles.reasons} data-activity-reasons="true">
            <legend>{step.reasonPrompt || "Sur quelle preuve t’appuies-tu ?"}</legend>
            {step.reasons.map((reason, index) => <label key={reason.id} className={styles.option} data-selected={selectedReason?.id === reason.id}>
              <input type="radio" name={activity.id + "-" + step.id + "-reason"} value={reason.id} checked={selectedReason?.id === reason.id} onChange={() => update({ type: "reason", id: reason.id })}/>
              <span className={styles.optionLetter} aria-hidden="true">{index + 1}</span><span>{reason.text}</span>
            </label>)}
          </fieldset> : null}
          <div className={styles.actions}>
            {step.reasons?.length && draft.answerStage === "choice" ? <button type="button" className={styles.primary} disabled={!selectedChoice} onClick={() => update({ type: "justify" }, "reason")}>
              Justifier ce choix<ArrowRight size={19} aria-hidden="true"/>
            </button> :
            <button type="button" className={styles.primary} disabled={!isActivityStepReady(step, draft)} onClick={() => update({ type: "verify" }, "panel")}><Check size={19} aria-hidden="true"/>Vérifier cette réponse</button>
            }
          </div>
          {!selectedChoice ? <p className={styles.hint}>Choisissez une réponse pour continuer.</p> : draft.answerStage === "reason" && !selectedReason ? <p className={styles.hint}>Choisissez aussi une justification.</p> : null}
        </> : <div className={styles.feedback} data-activity-feedback={status}>
          <div className={styles.verdict} role="status">
            {status === "correct" ? <CircleCheck size={35} aria-hidden="true"/> : <CircleHelp size={35} aria-hidden="true"/>}
            <div><strong>{status === "correct" ? "Juste" : "À revoir"}</strong><span>{status === "correct" ? "Cette étape est validée." : selectedChoice?.correct ? "La réponse est juste. Revoyez la justification." : "Revoyez la réponse avant de continuer."}</span></div>
          </div>
          {selectedChoice ? <OptionFeedback option={selectedChoice} label="Réponse"/> : null}
          {selectedReason ? <OptionFeedback option={selectedReason} label="Justification"/> : null}
          <div className={styles.actions}>
            {status === "correct" ? <button type="button" className={styles.primary} onClick={() => update(draft.stepIndex < activity.steps.length - 1 ? { type: "go", index: draft.stepIndex + 1 } : { type: "summary" }, "panel")}>
              {draft.stepIndex < activity.steps.length - 1 ? "Étape suivante" : "Voir le bilan"}<ArrowRight size={19} aria-hidden="true"/>
            </button> : <button type="button" className={styles.primary} onClick={() => update({ type: "retry" }, selectedChoice?.correct && step.reasons?.length ? "reason" : "panel")}><RotateCcw size={18} aria-hidden="true"/>Réessayer cette étape</button>}
            {status === "correct" ? <button type="button" onClick={() => update({ type: "retry" }, "panel")}>Modifier ma réponse</button> : null}
          </div>
          <details className={styles.correction}><summary>Voir les réponses et raisons justifiées</summary>
            <strong>Réponse{correctChoices.length > 1 ? "s" : ""} recevable{correctChoices.length > 1 ? "s" : ""}</strong>
            <ul>{correctChoices.map(choice => <li key={choice.id}><strong>{choice.text}</strong><p>{choice.feedback}</p></li>)}</ul>
            {correctReasons.length ? <><strong>Justification{correctReasons.length > 1 ? "s" : ""} recevable{correctReasons.length > 1 ? "s" : ""}</strong><ul>{correctReasons.map(reason => <li key={reason.id}><strong>{reason.text}</strong><p>{reason.feedback}</p></li>)}</ul></> : null}
          </details>
          <details className={styles.correction}><summary>Comprendre les autres choix</summary><ul>{[...step.choices, ...(step.reasons ?? [])].filter(option => !option.correct).map((option, index) => <li key={index}><strong>{option.text}</strong><p>{option.feedback}</p></li>)}</ul></details>
          <KqHistorySources ids={step.sourceIds}/>
        </div>}
        {draft.stepIndex > 0 ? <div className={styles.previous}><button type="button" onClick={() => update({ type: "go", index: draft.stepIndex - 1 }, "panel")}><ArrowLeft size={17} aria-hidden="true"/>Étape précédente</button></div> : null}
      </> : <p>Aucune étape disponible.</p>}
    </div>
  </section>;
}

export function KqHistoryActivity(props: ActivityProps) {
  // Read browser drafts after hydration; owner/version changes always start a fresh session.
  const hydrated = useSyncExternalStore(subscribeToHydration, browserSnapshot, serverSnapshot);
  return hydrated ? <ActivitySession key={(props.storageKey ?? "session") + ":" + props.activity.id} {...props}/>
    : <section className={styles.activity} aria-busy="true"><h4>{props.activity.title}</h4><p>Préparation de l’activité…</p></section>;
}
