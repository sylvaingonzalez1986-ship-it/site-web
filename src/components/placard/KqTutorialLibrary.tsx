"use client";

import { AppDialog, useDialogNavigation } from "@/components/ui/AppDialog";
import {
  SYLVAIN_INVITATION, type SylvainLessonId, type SylvainState, type getSylvainGuide,
} from "@/lib/kanab-quest-sylvain-guide";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqFarmGuide.module.css";

type LibraryProps = {
  mode: SylvainState["mode"];
  guide: ReturnType<typeof getSylvainGuide>;
  onAction: (action: { type: "start" | "pause" | "resume" | "off" | "skip" | "follow" }) => void;
  onSelect: (id: SylvainLessonId) => void;
};

const statusLabels = {
  completed: "Validée",
  skipped: "Passée",
  available: "Disponible",
  later: "Pour plus tard",
};

function LibraryContents({ mode, guide, onAction, onSelect }: LibraryProps) {
  const navigate = useDialogNavigation();
  const active = mode === "active";
  const completed = guide.lessons.filter(item => item.status === "completed").length;
  return <>
    <KqProgressMeter label="Étapes validées" value={completed} max={guide.lessons.length} />
    {guide.current && active ? <div className={styles.current}>
      <h3>{guide.current.title}</h3>
      <p>{guide.current.body}</p>
      <p><strong>{guide.current.action}</strong></p>
      {!guide.replay && guide.hint && <p className={styles.hint}>{guide.hint}</p>}
      {!guide.recovery && <div className={styles.actions}>
        {guide.replay ? <button type="button" data-sylvain-control="follow" onClick={() => navigate(() => onAction({ type: "follow" }))}>Suivre ma partie</button>
          : <button type="button" data-sylvain-control="skip" onClick={() => navigate(() => onAction({ type: "skip" }))}>Passer l’étape</button>}
      </div>}
    </div> : null}
    {mode === "invited" ? <p>{SYLVAIN_INVITATION.body}</p> : null}
    <div className={styles.actions}>
      {active ? <button type="button" data-sylvain-control="pause" onClick={() => navigate(() => onAction({ type: "pause" }))}>Mettre en pause</button>
        : <button type="button" className={styles.primary} data-sylvain-control={mode === "invited" ? "start" : "resume"}
          onClick={() => navigate(() => onAction({ type: mode === "invited" ? "start" : "resume" }))}>{mode === "invited" ? SYLVAIN_INVITATION.action : "Reprendre le guide"}</button>}
      {mode !== "off" && <button type="button" data-sylvain-control="off" onClick={() => navigate(() => onAction({ type: "off" }))}>Fermer le guide</button>}
    </div>
    <details className={styles.help}>
      <summary data-sylvain-control="help">Fonctionnement du guide</summary>
      <p>« Me montrer » repère le geste à faire dans le jeu. Tu peux passer une étape, explorer à ton rythme et relire une fiche ici. Tes étapes sont conservées dans ce navigateur pour ce compte.</p>
    </details>
    <ol className={styles.register}>
      {guide.lessons.map(({ lesson, status }) => <li key={lesson.id} data-sylvain-lesson={lesson.id} data-status={status}>
        <details>
          <summary>
            <strong>{lesson.title}</strong>
            <span className={styles.lessonStatus}>{statusLabels[status]}</span>
          </summary>
          <p>{lesson.body}</p>
          <p><strong>{lesson.action}</strong></p>
          {guide.current?.id !== lesson.id && active && status === "available"
            && <button type="button" className={styles.primary} data-sylvain-select={lesson.id}
              onClick={() => navigate(() => onSelect(lesson.id))}>Suivre cette étape</button>}
        </details>
      </li>)}
    </ol>
  </>;
}

export function KqTutorialLibrary({ open, onClose, ...props }: LibraryProps & { open: boolean; onClose: () => void }) {
  return <AppDialog open={open} onClose={onClose} title="Carnet de Loïc" closeLabel="Fermer le carnet"
    className={styles.library} bodyClassName={styles.libraryBody} dialogProps={{ "data-sylvain-library": true }}>
    <LibraryContents {...props} />
  </AppDialog>;
}
