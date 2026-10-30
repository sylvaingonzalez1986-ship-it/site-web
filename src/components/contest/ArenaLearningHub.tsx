"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Check, Compass, KeyRound, Sprout, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ARENA_RELEVE_CHAPTERS, ARENA_RELEVE_LABELS, ARENA_RELEVE_MEETINGS, ARENA_RELEVE_SCENES, type ArenaReleveMeetingId } from "@/lib/arena-releve";
import { readArenaReleveResume } from "@/lib/arena-releve-session";
import { readArenaQuickTrialResume } from "@/lib/arena-quick-trial";
import { ARENA_RELEVE_VISITS_KEY, type ArenaLearningStorage } from "@/lib/arena-introduction";
import { useArenaLearningStorage } from "./ArenaLearningStorage";
import { KQ_WAREHOUSE_ROOM_ARTWORK } from "@/lib/kanab-quest-warehouse-artwork";
import styles from "./ArenaLearningHub.module.css";

const Story = dynamic(() => import("./ArenaReleve").then(module => module.ArenaReleve), {
  ssr: false,
  loading: () => <p role="status">Sylvain prépare ta ferme d’essai…</p>,
});
const Meeting = dynamic(() => import("./ArenaReleve").then(module => module.ArenaReleveMeeting), {
  ssr: false,
  loading: () => <p role="status">Ouverture de cette rencontre…</p>,
});
const QuickTrial = dynamic(() => import("./ArenaQuickTrial").then(module => module.ArenaQuickTrial), {
  ssr: false,
  loading: () => <p role="status">Préparation de ta première récolte…</p>,
});

const MEETING_PLACES: Record<ArenaReleveMeetingId, { label: string; image: string }> = {
  expansion: { label: "Entrepôt", image: KQ_WAREHOUSE_ROOM_ARTWORK },
  workshop: { label: "Atelier", image: "/placard/market-workshop-sylvain-v2.webp" },
  business: { label: "Commerce", image: "/placard/commerce-office-sylvain-v3.webp" },
  social: { label: "Réseaux", image: "/app/kanab-quest/social/scenes/producer-journal-v3.webp" },
  merch: { label: "Produits dérivés", image: "/placard/market-brand-studio-sylvain-v3.webp" },
  bank: { label: "Banque", image: "/placard/bureau-bank-sylvain-v2.webp" },
  community: { label: "Missions & personnage", image: "/placard/market-social-missions-sylvain-v3.webp" },
  notebook: { label: "Collection", image: "/app/lottery/album-booster-mascot-v3.webp" },
};
type CompletedVisits = { story: boolean; meetings: ArenaReleveMeetingId[] };
function readCompleted(storage?: ArenaLearningStorage): { visits: CompletedVisits; warning: boolean } {
  try {
    const raw = (storage ?? localStorage).getItem(ARENA_RELEVE_VISITS_KEY);
    if (raw === null) return { visits: { story: false, meetings: [] }, warning: false };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { visits: { story: false, meetings: [] }, warning: true };
    const row = value as Record<string, unknown>;
    const meetings = Array.isArray(row.meetings) ? row.meetings : [];
    return { visits: { story: row.story === true, meetings: ARENA_RELEVE_MEETINGS.filter(item => meetings.includes(item.id)).map(item => item.id) }, warning: typeof row.story !== 'boolean' || !Array.isArray(row.meetings) };
  } catch { return { visits: { story: false, meetings: [] }, warning: true }; }
}

export function ArenaLearningHub({ onClose, onOpenQuarter }: { onClose: () => void; onOpenQuarter?: () => void }) {
  const storage = useArenaLearningStorage();
  const [initial] = useState(() => ({ ...readCompleted(storage), story: readArenaReleveResume(storage), quick: readArenaQuickTrialResume(storage) }));
  const [active, setActive] = useState<"quick" | "story" | ArenaReleveMeetingId | null>(null);
  const [group, setGroup] = useState<"quick" | "story" | "meetings">(() => initial.story && !initial.story.completed && (!initial.quick || initial.quick.completed) ? 'story' : 'quick');
  const [completed, setCompleted] = useState(initial.visits);
  const [resume, setResume] = useState(initial.story);
  const [quickResume, setQuickResume] = useState(initial.quick);
  const [warning, setWarning] = useState(initial.warning);
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef('[data-learning-group]');
  const storyComplete = resume?.completed ?? completed.story;
  const resumeChapter = resume ? ARENA_RELEVE_CHAPTERS[resume.chapter] : null;
  const tourComplete = storyComplete && ARENA_RELEVE_MEETINGS.every(item => completed.meetings.includes(item.id));

  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>(trigger.current)?.focus({ preventScroll: true });
    return () => { element?.close(); };
  }, [active]);
  const saveCompleted = (next: CompletedVisits) => {
    setCompleted(next);
    // Do not replace an unreadable register with only the visits found this time.
    if (initial.warning) return;
    try { (storage ?? localStorage).setItem(ARENA_RELEVE_VISITS_KEY, JSON.stringify(next)); }
    catch { setWarning(true); }
  };
  const finishStory = () => saveCompleted({ ...completed, story: true });
  const finishMeeting = (id: ArenaReleveMeetingId) => {
    if (!completed.meetings.includes(id)) saveCompleted({ ...completed, meetings: [...completed.meetings, id] });
  };
  const returnToHub = () => {
    setResume(readArenaReleveResume(storage));
    setQuickResume(readArenaQuickTrialResume(storage));
    setActive(null);
  };

  return <>
    {active === null ? <dialog ref={dialog} className={styles.dialog} data-arena-learning aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!active) onClose(); }}>
      <header className={styles.top}>
        <button type="button" className={styles.quarter} onClick={onOpenQuarter ?? onClose}>Mon quartier<ArrowRight size={17} aria-hidden="true" /></button>
        <button type="button" onClick={onClose} aria-label="Fermer le didacticiel"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className={styles.content}>
        <div className={styles.heading}>
          <h2 id={titleId}>Apprendre à jouer</h2>
          <span className={styles.sandbox}>Partie d’essai · cartes et budget fictifs</span>
        </div>
        <nav className={styles.shortcuts} aria-label="Choisir son aventure">
          <button type="button" data-learning-group="quick" aria-pressed={group === "quick"} onClick={() => setGroup("quick")}><Sprout size={17} aria-hidden="true" />Essai court</button>
          <button type="button" data-learning-group="story" aria-pressed={group === "story"} onClick={() => setGroup("story")}><KeyRound size={17} aria-hidden="true" />La Relève{resume && !resume.completed ? <span className={styles.count}>En cours</span> : null}</button>
          <button type="button" data-learning-group="meetings" aria-pressed={group === "meetings"} onClick={() => setGroup("meetings")}><Compass size={17} aria-hidden="true" />Les rencontres<span className={styles.count}>{initial.warning ? 'À vérifier' : `${completed.meetings.length}/${ARENA_RELEVE_MEETINGS.length}`}</span></button>
        </nav>
        {group === "quick" ? <section className={styles.quick} aria-labelledby="quick-trial-heading">
          <div className={styles.quickBody}>
            <h3 id="quick-trial-heading">{quickResume && !quickResume.completed ? quickResume.label : 'Ma première récolte'}</h3>
            <p>{quickResume?.completed ? 'Ton essai est terminé. Retrouve son bilan ou explore une autre activité.' : 'Pars d’une culture déjà installée. Choisis un contenant, laisse mûrir ta récolte, passe le jury et réalise ta première vente.'}</p>
            <p className={styles.quickNote}>Temps accéléré, achats et recettes fictifs. Rien ne passe dans ta partie.</p>
            <button type="button" className={styles.primary} data-quick-trial-start onClick={() => { trigger.current = '[data-quick-trial-start]'; setActive('quick'); }}>
              <Sprout size={19} aria-hidden="true" />{quickResume ? quickResume.completed ? 'Revoir mon essai' : `Reprendre · ${quickResume.label}` : 'Essayer la première récolte'}<ArrowRight size={19} aria-hidden="true" />
            </button>
          </div>
        </section> : group === "story" ? <>
          <section className={styles.story} aria-labelledby="releve-story-heading">
            <div className={styles.heroImage}><div className={styles.imageWindow}><Image src={ARENA_RELEVE_SCENES[resumeChapter?.scene ?? "arrival"]} alt="Sylvain t’accompagne dans ta ferme d’essai." fill sizes="(max-width: 700px) 100vw, 700px" priority /></div></div>
            <div className={styles.storyBody}>
              <span className={styles.eyebrow}>{resume && !storyComplete ? `Chapitre ${resume.chapter + 1} / ${ARENA_RELEVE_CHAPTERS.length} · En cours` : `${ARENA_RELEVE_CHAPTERS.length} chapitres à jouer`}</span>
              <h3 id="releve-story-heading">{resumeChapter && !storyComplete ? resumeChapter.title : storyComplete ? "Ta ferme a pris vie." : "La ferme t’attend."}</h3>
              <p>{resume && !storyComplete ? resume.objective : storyComplete ? "Retrouve ta ferme ou choisis une rencontre pour apprendre une autre activité du quartier." : "Grand-père t’a confié les clés. Apprends à cultiver, vendre et suivre tes comptes avec Sylvain."}</p>
              <button type="button" className={styles.primary} data-releve-start onClick={() => { trigger.current = '[data-releve-start]'; setActive("story"); }}>
                {storyComplete ? <Check size={19} aria-hidden="true" /> : <KeyRound size={19} aria-hidden="true" />}
                {storyComplete ? "Retrouver ma ferme d’essai" : resumeChapter ? `Reprendre · ${resumeChapter.title}` : "Jouer l’histoire complète"}<ArrowRight size={19} aria-hidden="true" />
              </button>
              {storyComplete ? <span className={styles.done}><Check size={16} aria-hidden="true" />{ARENA_RELEVE_LABELS.storyComplete}</span> : null}
            </div>
          </section>
          <details className={styles.storyDetails}><summary>Les étapes de l’histoire</summary><ol className={styles.acts} aria-label="Les trois actes de ton aventure">
            {[
              { image: ARENA_RELEVE_SCENES.renovation, label: "Aménage ta chambre de culture" },
              { image: ARENA_RELEVE_SCENES.culture, label: "Accompagne tes Buddies" },
              { image: ARENA_RELEVE_SCENES.packing, label: "Prépare ta première vente" },
            ].map((act, index) => <li key={act.label}><span className={styles.actImage}><span className={styles.imageWindow}><Image src={act.image} alt="" width={192} height={128} sizes="112px" /></span></span><span className={styles.actNumber}>{index + 1}</span><strong>{act.label}</strong></li>)}
          </ol></details>
          {!warning ? <p className={styles.hint}>Ta progression est gardée dans ce navigateur.</p> : null}
        </> : <>
          <h3 className={styles.sectionTitle}>Où allons-nous ?</h3>
          <p className={styles.meetingsIntro}>Choisis ce que tu veux apprendre. Chaque rencontre prête le nécessaire : tu peux commencer directement, sans terminer la ferme.</p>
          <div className={styles.grid}>{ARENA_RELEVE_MEETINGS.map(item => <button type="button" key={item.id}
            className={styles.meeting} data-releve-meeting={item.id}
            onClick={() => { trigger.current = `[data-releve-meeting="${item.id}"]`; setActive(item.id); }}>
            <span className={styles.thumbnail}><span className={styles.imageWindow}><Image src={MEETING_PLACES[item.id].image} alt="" fill sizes="(max-width:700px) 100vw, 350px" /></span></span>
            <span className={styles.meetingCaption}><strong>{MEETING_PLACES[item.id].label}</strong><span>{item.description}</span></span>
            <span className={styles.cardAction}>{completed.meetings.includes(item.id) ? <><Check size={17} aria-hidden="true" />Revoir</> : <>Découvrir<ArrowRight size={17} aria-hidden="true" /></>}</span>
          </button>)}</div>
        </>}
        {tourComplete ? <p className={styles.completion}><Check size={19} aria-hidden="true" />{ARENA_RELEVE_LABELS.tourComplete}</p> : null}
        {warning ? <p role="status" className={styles.warning}>La progression enregistrée dans ce navigateur n’est pas entièrement disponible. Tu peux continuer à jouer ; garde l’essai ouvert pour conserver ta progression.</p> : null}
      </div>
    </dialog> : null}
    {active === 'quick' ? <QuickTrial onClose={returnToHub} onOpenQuarter={onOpenQuarter ?? onClose} onContinueLearning={() => { returnToHub(); setGroup('story'); trigger.current = '[data-learning-group="story"]'; }} />
      : active === "story" ? <Story onClose={returnToHub} onCompleted={finishStory} onExplore={() => { returnToHub(); setGroup("meetings"); trigger.current = '[data-learning-group="meetings"]'; }} />
      : active ? <Meeting key={active} meeting={active} onClose={returnToHub} onCompleted={() => finishMeeting(active)} /> : null}
  </>;
}
