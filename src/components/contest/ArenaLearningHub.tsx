"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Check, Compass, KeyRound, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ARENA_RELEVE_LABELS, ARENA_RELEVE_MEETINGS, ARENA_RELEVE_SCENES, type ArenaReleveMeetingId } from "@/lib/arena-releve";
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

const MEETING_PLACES: Record<ArenaReleveMeetingId, { label: string; image: string }> = {
  expansion: { label: "Entrepôt", image: KQ_WAREHOUSE_ROOM_ARTWORK },
  workshop: { label: "Atelier", image: "/placard/market-workshop-sylvain-v2.webp" },
  business: { label: "Commerce", image: "/placard/commerce-office-sylvain-v3.webp" },
  bank: { label: "Banque", image: "/placard/bureau-bank-sylvain-v2.webp" },
  community: { label: "Missions & personnage", image: "/placard/market-social-missions-sylvain-v3.webp" },
  notebook: { label: "Collection", image: "/app/lottery/album-booster-mascot-v3.webp" },
};
type CompletedVisits = { story: boolean; meetings: ArenaReleveMeetingId[] };
function readCompleted(storage?: ArenaLearningStorage): CompletedVisits {
  try {
    const value: unknown = JSON.parse((storage ?? localStorage).getItem(ARENA_RELEVE_VISITS_KEY) ?? "null");
    if (!value || typeof value !== "object") return { story: false, meetings: [] };
    const row = value as Record<string, unknown>;
    const meetings = Array.isArray(row.meetings) ? row.meetings : [];
    return { story: row.story === true, meetings: ARENA_RELEVE_MEETINGS.filter(item => meetings.includes(item.id)).map(item => item.id) };
  } catch { return { story: false, meetings: [] }; }
}

export function ArenaLearningHub({ onClose }: { onClose: () => void }) {
  const storage = useArenaLearningStorage();
  const [active, setActive] = useState<"story" | ArenaReleveMeetingId | null>(null);
  const [group, setGroup] = useState<"story" | "meetings">("story");
  const [completed, setCompleted] = useState(() => readCompleted(storage));
  const [warning, setWarning] = useState(false);
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const tourComplete = completed.story && ARENA_RELEVE_MEETINGS.every(item => completed.meetings.includes(item.id));

  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  useEffect(() => {
    try { (storage ?? localStorage).setItem(ARENA_RELEVE_VISITS_KEY, JSON.stringify(completed)); }
    // A failed storage write must be visible; the story remains accessible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setWarning(true); }
  }, [completed, storage]);
  const finishStory = useCallback(() => setCompleted(current => ({ ...current, story: true })), []);
  const finishMeeting = useCallback((id: ArenaReleveMeetingId) => {
    setCompleted(current => current.meetings.includes(id) ? current : { ...current, meetings: [...current.meetings, id] });
  }, []);
  const returnToHub = () => {
    setActive(null);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };

  return <>
    <dialog ref={dialog} className={styles.dialog} data-arena-learning aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!active) onClose(); }}>
      <header className={styles.top}>
        <span><Compass size={20} aria-hidden="true" />KANAB QUEST · AVEC SYLVAIN</span>
        <button type="button" onClick={onClose} aria-label="Fermer le didacticiel"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className={styles.content}>
        <div className={styles.heading}>
          <h2 id={titleId}>{ARENA_RELEVE_LABELS.title}</h2>
          <span className={styles.sandbox}>Partie d’essai · cartes et budget fictifs</span>
        </div>
        <nav className={styles.shortcuts} aria-label="Choisir son aventure">
          <button type="button" data-learning-group="story" aria-pressed={group === "story"} onClick={() => setGroup("story")}><KeyRound size={17} aria-hidden="true" />Ma ferme</button>
          <button type="button" data-learning-group="meetings" aria-pressed={group === "meetings"} onClick={() => setGroup("meetings")}><Compass size={17} aria-hidden="true" />Les 6 rencontres<span className={styles.count}>{completed.meetings.length}/6</span></button>
        </nav>
        {group === "story" ? <>
          <section className={styles.story} aria-labelledby="releve-story-heading">
            <div className={styles.heroImage}><Image src={ARENA_RELEVE_SCENES.arrival} alt="Sylvain te tend les clés devant la grange aux portes turquoise." fill sizes="(max-width: 1140px) 100vw, 1100px" priority /></div>
            <div className={styles.storyBody}>
              <span className={styles.eyebrow}>9 CHAPITRES À JOUER</span>
              <h3 id="releve-story-heading">La ferme t’attend.</h3>
              <p>Grand-père t’a confié les clés. Sylvain t’accompagne, à toi de jouer.</p>
              <button type="button" className={styles.primary} data-releve-start onClick={event => { trigger.current = event.currentTarget; setActive("story"); }}>
                {completed.story ? <Check size={19} aria-hidden="true" /> : <KeyRound size={19} aria-hidden="true" />}
                {completed.story ? "Revenir à ma ferme" : "Jouer l’histoire"}<ArrowRight size={19} aria-hidden="true" />
              </button>
              {completed.story ? <span className={styles.done}><Check size={16} aria-hidden="true" />{ARENA_RELEVE_LABELS.storyComplete}</span> : null}
            </div>
          </section>
          <ol className={styles.acts} aria-label="Les trois actes de ton aventure">
            {[
              { image: ARENA_RELEVE_SCENES.renovation, label: "Aménage ta chambre de culture" },
              { image: ARENA_RELEVE_SCENES.culture, label: "Accompagne tes Buddies" },
              { image: ARENA_RELEVE_SCENES.packing, label: "Prépare ta première vente" },
            ].map((act, index) => <li key={act.label}><Image src={act.image} alt="" width={192} height={128} sizes="(max-width: 700px) 30vw, 100px" /><span>{index + 1}</span><strong>{act.label}</strong></li>)}
          </ol>
          <p className={styles.hint}>Ta progression est gardée dans ce navigateur.</p>
        </> : <>
          <h3 className={styles.sectionTitle}>Où allons-nous ?</h3>
          <div className={styles.grid}>{ARENA_RELEVE_MEETINGS.map(item => <button type="button" key={item.id}
            className={styles.meeting} data-releve-meeting={item.id}
            onClick={event => { trigger.current = event.currentTarget; setActive(item.id); }}>
            <span className={styles.thumbnail}><Image src={MEETING_PLACES[item.id].image} alt="" fill sizes="(max-width:700px) 100vw, 350px" /></span>
            <span className={styles.meetingCaption}><strong>{MEETING_PLACES[item.id].label}</strong><span>{item.title}</span></span>
            <span className={styles.cardAction}>{completed.meetings.includes(item.id) ? <><Check size={17} aria-hidden="true" />Rejouer</> : <>Entrer<ArrowRight size={17} aria-hidden="true" /></>}</span>
          </button>)}</div>
        </>}
        {tourComplete ? <p className={styles.completion}><Check size={19} aria-hidden="true" />{ARENA_RELEVE_LABELS.tourComplete}</p> : null}
        {warning ? <p role="status" className={styles.warning}>Ce navigateur ne peut pas mémoriser les rencontres terminées. Tu peux continuer à jouer ; garde la page ouverte.</p> : null}
      </div>
    </dialog>
    {active === "story" ? <Story onClose={returnToHub} onCompleted={finishStory} onExplore={() => { setGroup("meetings"); setActive(null); requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>('[data-learning-group="meetings"]')?.focus()); }} /> : active ? <Meeting key={active} meeting={active} onClose={returnToHub} onCompleted={() => finishMeeting(active)} /> : null}
  </>;
}
