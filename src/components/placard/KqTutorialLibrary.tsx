"use client";

import { AppDialog, useDialogNavigation } from "@/components/ui/AppDialog";
import { FARM_GUIDE_CHAPTERS, type FarmGuideChapter, type FarmGuideAdvice } from "@/lib/kanab-quest-farm-guide";
import { FARM_GUIDE_STEPS, getFarmStepState, type FarmProgress, type FarmEvidence, type FarmStepId } from "@/lib/kanab-quest-farm-progress";
import { ARENA_PLAYABLE_LESSONS, type ArenaPlayableLessonId } from "@/lib/arena-playable-learning";
import styles from "./KqFarmGuide.module.css";

type LibraryProps = {
  state: FarmProgress;
  evidence: FarmEvidence;
  stepId?: FarmStepId;
  replaying: boolean;
  currentChapter: FarmGuideChapter;
  currentAdvice: FarmGuideAdvice;
  harvestChoices: { id: string; label: string }[];
  onChoose: (id: FarmStepId, review: boolean) => void;
  onFollowHarvest: (id: string) => void;
  onPractice: (id: ArenaPlayableLessonId) => void;
  onPause: () => void;
};

// Retire the dialog's history entry before opening a game activity or a practice.
function LibraryContents({ state, evidence, stepId, replaying, currentChapter, currentAdvice, harvestChoices, onChoose, onFollowHarvest, onPractice, onPause }: LibraryProps) {
  const navigate = useDialogNavigation();
  return <div className={styles.notebook}>

        <p><strong>{currentChapter.tab}</strong> · {currentAdvice.instruction}</p><p>{currentChapter.story}</p>
        <p>Tu peux explorer librement pendant une attente. Une visite ne valide pas une culture ou une vente. Aucun achat ni paiement n’est effectué par le guide.</p>
        {harvestChoices.length > 0 && (harvestChoices.length > 1 || harvestChoices[0].id !== state.flowerId) ? <label className={styles.harvestChoice}>Récolte à accompagner<select value={state.flowerId ?? ""} onChange={event => onFollowHarvest(event.target.value)}>{!harvestChoices.some(item => item.id === state.flowerId) ? <option value={state.flowerId ?? ""} disabled>Choisir un lot disponible</option> : null}{harvestChoices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>Tes acquis restent conservés lorsque tu changes de lot.</small></label> : null}
        <ol>{FARM_GUIDE_CHAPTERS.map(item => {
          const goals = FARM_GUIDE_STEPS.filter(goal => goal.chapter === item.id);
          const remaining = goals.filter(goal => !state.completed.includes(goal.id));
          const goal = remaining.find(goal => getFarmStepState(state, goal.id, evidence).status === "available") ?? remaining[0] ?? goals[0];
          if (!goal) return null;
          const status = getFarmStepState(state, goal.id, evidence);
          const label = remaining.length === 0 ? "Terminé" : goal.id === stepId && !replaying ? "En cours" : status.status === "waiting" ? "En attente" : status.status === "locked" ? "Verrouillé" : "À découvrir";
          return <li className={styles.chapterRow} key={item.id} data-tutorial-chapter={item.id}>
            <strong>{item.tab}</strong><span className={styles.chapterStatus}>{label} · {goals.length - remaining.length}/{goals.length}</span>
            {status.reason && remaining.length > 0 ? <small>{status.reason}</small> : null}
            <div className={styles.chapterActions}><button type="button" data-tutorial-select={goal.id} aria-label={`${remaining.length === 0 ? "Revoir" : "Reprendre"} : ${item.tab}`} onClick={() => navigate(() => onChoose(goal.id, remaining.length === 0))}>{remaining.length === 0 ? "Revoir" : "Reprendre"}</button></div>
            <details><summary>Objectifs de {item.tab}</summary><ul className={styles.checklist}>{goals.map(objective => <li key={objective.id}><button type="button" onClick={() => navigate(() => onChoose(objective.id, state.completed.includes(objective.id)))}>{state.completed.includes(objective.id) ? "✓ " : "○ "}{objective.title}</button></li>)}</ul></details>
          </li>;
        })}</ol>
        <details data-tutorial-practice-menu><summary>S’entraîner avec un budget fictif</summary>
          <p>Matériel, cartes, temps et recettes de démonstration. Ces essais séparés permettent de pratiquer pendant une attente ; ils ne valident aucune action de ta partie.</p>
          <ol>{ARENA_PLAYABLE_LESSONS.map(lesson => <li key={lesson.id}><button type="button" data-tutorial-practice={lesson.id} onClick={() => navigate(() => onPractice(lesson.id))}>{lesson.title}</button></li>)}</ol>
        </details>
        <p>Réduis le guide pour garder l’objectif ou suspends-le avec ×. Retrouve-le dans Tutoriel. Ton choix et ta progression sont conservés dans ce navigateur pour ce compte.</p>
        <div className={styles.actions}><button type="button" onClick={() => navigate(onPause)}>Désactiver le tutoriel</button></div>
      
  </div>;
}

export function KqTutorialLibrary({ open, onClose, ...props }: LibraryProps & { open: boolean; onClose: () => void }) {
  return <AppDialog open={open} onClose={onClose} title="Chapitres du tutoriel" closeLabel="Fermer les chapitres" className={styles.library} bodyClassName={styles.libraryBody} dialogProps={{ "data-tutorial-chapters": true }}>
    <LibraryContents {...props} />
  </AppDialog>;
}
