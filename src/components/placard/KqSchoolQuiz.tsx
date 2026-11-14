"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, Check, CircleHelp, LockKeyhole, RotateCcw, X } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KqSchoolQuizProgress } from "@/lib/kanab-quest-school";
import type { KqSchoolSource } from "@/lib/kanab-quest-school-content";
import { nextQuizQuestion, quizQuestionLocked, shortQuizExplanation, type KqSchoolQuizDraft } from "@/lib/kanab-quest-school-quiz-state";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqSchoolQuiz.module.css";

type Props = {
  draft: KqSchoolQuizDraft; title: string; busy: boolean; error: string; obsolete: boolean; conflicted: boolean;
  rewardLabel: string; progress?: KqSchoolQuizProgress; onChange: (draft: KqSchoolQuizDraft) => void;
  onCheck: () => void; onSubmit: () => void; onRestart: () => void; onRecover: () => void;
  onRead: (moduleId: string, passage?: string) => void; onOtherQuizzes: () => void;
  sources: (sources: readonly KqSchoolSource[]) => ReactNode;
  buddies: (codes: readonly string[], passage: string) => ReactNode;
};
export function KqSchoolQuiz({ draft, title, busy, error, obsolete, conflicted, rewardLabel, progress, onChange, onCheck, onSubmit, onRestart, onRecover, onRead, onOtherQuizzes, sources, buddies }: Props) {
  const question = draft.quiz.questions[draft.index], feedback = draft.checks?.[question.id], result = draft.completion?.result;
  const feedbackRef = useRef<HTMLDivElement>(null), questionRef = useRef<HTMLLegendElement>(null);
  const checked = draft.quiz.questions.filter(q => draft.checks?.[q.id]).length;
  const locked = quizQuestionLocked(draft, question.id);
  useEffect(() => { if (!result) questionRef.current?.focus(); }, [question.id, result]);
  useEffect(() => { if (feedback && !result) feedbackRef.current?.focus(); }, [feedback, result]);
  if (result) return <section className={styles.quiz} data-school-quiz-result aria-label="Résultat du quiz">
    <div className={styles.score}><span aria-hidden>{result.passed ? <Check size={40}/> : <CircleHelp size={40}/>}</span><h3>{result.score}<small>/10</small></h3><p>{result.passed ? "Quiz réussi" : "Continue à explorer"}</p></div>
    <KqProgressMeter label="Réponses justes" value={result.score} max={10} valueLabel={result.score + " / 10"}/>
    <dl className={styles.metrics}><div><dt>Gain versé</dt><dd>{formatKqCash(result.gainCents)}</dd></div><div><dt>Meilleur score</dt><dd>{progress?.bestScore ?? result.bestScore}/10</dd></div></dl>
    <p>{draft.completion?.replayed ? "Tentative retrouvée : ce gain avait déjà été versé." : result.gainCents > 0 ? "Le gain a rejoint ton portefeuille." : result.paidCents > 0 ? "Les gains déjà reçus restent acquis." : "Le premier gain commence à 7/10."}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.actions}><button type="button" className={styles.primary} data-quiz-restart disabled={busy} onClick={onRestart}><RotateCcw size={18} aria-hidden/>{(progress?.remainingCents ?? result.remainingCents) === 0 ? "S’entraîner" : "Rejouer"}</button><button type="button" onClick={onOtherQuizzes}>Autres quiz</button></div>
    <details><summary>Portefeuille après cette tentative</summary><p>{formatKqCash(result.cashCents)} au moment du versement.</p><p>{rewardLabel}</p></details>
    <details className={styles.complete} data-quiz-full-review><summary>Revoir les dix réponses</summary>{result.corrections.map((correction, index) => {
      const item = draft.quiz.questions.find(q => q.id === correction.questionId);
      return <details key={correction.questionId} data-school-correction={correction.questionId} open={draft.openCorrectionId === correction.questionId}
        onToggle={event => { const open = event.currentTarget.open; if (open !== (draft.openCorrectionId === correction.questionId)) onChange({ ...draft, openCorrectionId: open ? correction.questionId : undefined }); }}>
        <summary><span>{correction.isCorrect ? <Check size={18} aria-label="Juste"/> : <X size={18} aria-label="À revoir"/>}{index + 1}. {item?.prompt}</span></summary>
        <p><strong>Bonne réponse :</strong> {item?.options.find(option => option.id === correction.correctOptionId)?.text}</p><p>{correction.explanation}</p>
        {correction.optionExplanations ? <details><summary>Comprendre chaque proposition</summary><ul>{item?.options.map(option => <li key={option.id}><strong>{option.text}</strong><p>{correction.optionExplanations?.[option.id]}</p></li>)}</ul></details> : null}
        <button type="button" onClick={() => onRead(correction.lessonId, correction.sectionId)}>Revoir ce passage</button>{correction.buddyCodes?.length ? buddies(correction.buddyCodes, correction.sectionId) : null}{sources(correction.sources)}
      </details>;
    })}</details>
  </section>;
  return <section className={styles.quiz} data-school-quiz aria-label={"Quiz " + title}>
    <div className={styles.top}><strong>Question {draft.index + 1} <span>/ 10</span></strong><span>{checked} validée{checked > 1 ? "s" : ""}</span></div>
    <ol className={styles.steps} aria-label="Progression du quiz">{draft.quiz.questions.map((q, index) => <li key={q.id} data-state={draft.checks?.[q.id] ? draft.checks[q.id].isCorrect ? "correct" : "incorrect" : index === draft.index ? "current" : "waiting"} aria-current={index === draft.index ? "step" : undefined}><span>{index + 1}</span>{draft.checks?.[q.id] ? draft.checks[q.id].isCorrect ? <Check size={14} aria-label="Juste"/> : <X size={14} aria-label="À revoir"/> : null}</li>)}</ol>
    <fieldset className={styles.question} disabled={busy || locked || obsolete}><legend ref={questionRef} id="school-quiz-question" tabIndex={-1}>{question.prompt}</legend>
      <div className={styles.options}>{question.options.map((option, index) => {
        const selected = draft.answers[question.id] === option.id;
        const state = feedback ? option.id === feedback.correctOptionId ? "correct" : selected ? "incorrect" : "neutral" : selected ? "selected" : "neutral";
        return <label key={option.id} className={styles.option} data-quiz-option={option.id} data-state={state}>
          <input type="radio" name={question.id} value={option.id} checked={selected} onChange={() => { if (!locked) onChange({ ...draft, answers: { ...draft.answers, [question.id]: option.id } }); }}/>
          <span className={styles.letter} aria-hidden>{String.fromCharCode(65 + index)}</span><span>{option.text}</span>
          {state === "correct" ? <Check size={22} aria-label="Bonne réponse"/> : state === "incorrect" ? <X size={22} aria-label="Ta réponse incorrecte"/> : null}
        </label>;
      })}</div>
    </fieldset>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {feedback ? <div ref={feedbackRef} tabIndex={-1} className={styles.feedback} role="status" data-quiz-feedback={feedback.isCorrect ? "correct" : "incorrect"}>
      <h4>{feedback.isCorrect ? <Check size={24} aria-hidden/> : <X size={24} aria-hidden/>}{feedback.isCorrect ? "Bonne réponse" : "Réponse incorrecte"}</h4>
      {!feedback.isCorrect ? <p><strong>Bonne réponse :</strong> {question.options.find(option => option.id === feedback.correctOptionId)?.text}</p> : null}<p>{shortQuizExplanation(feedback.explanation)}</p>
      <details><summary>Comprendre et vérifier</summary><p>{feedback.explanation}</p>{feedback.optionExplanations ? <ul>{question.options.map(option => <li key={option.id}><strong>{option.text}</strong><p>{feedback.optionExplanations?.[option.id]}</p></li>)}</ul> : null}{sources(feedback.sources)}{feedback.buddyCodes?.length ? buddies(feedback.buddyCodes, feedback.sectionId) : null}<button type="button" onClick={() => onRead(feedback.lessonId, feedback.sectionId)}>Revoir ce passage</button></details>
    </div> : null}
    <div className={styles.actions}>
      {draft.submitted ? <button type="button" className={styles.primary} data-quiz-submit disabled={busy || obsolete} onClick={onSubmit}>{busy ? "Enregistrement…" : "Réessayer la validation"}</button>
        : feedback ? <button type="button" className={styles.primary} data-quiz-next disabled={busy || obsolete} onClick={() => { const index = nextQuizQuestion(draft); if (index === null) onSubmit(); else onChange({ ...draft, index }); }}>{nextQuizQuestion(draft) === null ? "Voir mon résultat" : "Suivant"}<ArrowRight size={18} aria-hidden/></button>
        : <button type="button" className={styles.primary} data-quiz-check disabled={busy || obsolete || !draft.answers[question.id]} onClick={onCheck}>{busy ? "Vérification…" : draft.pendingCheckId ? "Réessayer cette réponse" : "Valider ma réponse"}</button>}
    </div>
    <p className={styles.caption} data-quiz-budget>{rewardLabel}</p>
    {draft.pendingCheckId && !feedback ? <p className={styles.caption}><LockKeyhole size={14} aria-hidden/>Réponse conservée. Le nouvel essai retrouve la même validation.</p> : null}
    {obsolete ? <button type="button" onClick={onRestart}>Charger le quiz actualisé</button> : null}
    {conflicted ? <button type="button" onClick={onRecover}>Recommencer cette tentative</button> : null}
    <details className={styles.secondary}><summary>Budget, sources et cours</summary><p>{rewardLabel}. Le résultat final détermine le complément éventuel.</p>{sources(question.sources)}{question.buddyCodes?.length ? buddies(question.buddyCodes, question.sectionId) : null}<button type="button" onClick={() => onRead(draft.quiz.quizId)}>Revoir le cours</button></details>
  </section>;
}
