"use client";

import Image from "next/image";
import { ArrowRight, BookOpen, Check, MapPin, Pause, X } from "lucide-react";
import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KQ_FARM_GUIDE_OPEN_EVENT, type FarmGuideDestination } from "@/lib/kanab-quest-guide-navigation";
import {
  getSylvainGuide, readSylvainState, sylvainStorageKey, SYLVAIN_INVITATION, SYLVAIN_LESSONS, updateSylvainGuide, writeSylvainState,
  type SylvainObservations,
} from "@/lib/kanab-quest-sylvain-guide";
import { getLoicHistoricalAchievements, readSylvainObservations } from "@/lib/kanab-quest-sylvain-observations";
import { KqTutorialLibrary } from "./KqTutorialLibrary";
import styles from "./KqFarmGuide.module.css";

const browserStorage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
const emptyObservations: SylvainObservations = { achieved: [], relevant: [], hints: {} };
const initialLessons = SYLVAIN_LESSONS.filter(lesson => lesson.kind === "initial");
const dialogSelector = 'dialog[open], [role="dialog"][aria-modal="true"]';
const focusableSelector = 'button, a[href], input, select, textarea, summary, [tabindex]';

type Guide = ReturnType<typeof getSylvainGuide>;
type Lesson = NonNullable<Guide["current"]>;
type GuideAction = Parameters<typeof updateSylvainGuide>[1];

function visible(node: HTMLElement) {
  return !node.closest('[inert], [hidden], [aria-hidden="true"]') && node.getClientRects().length > 0
    && window.getComputedStyle(node).visibility === "visible";
}

function activeDialog() {
  const openDialogs = Array.from(document.querySelectorAll<HTMLElement>(dialogSelector)).filter(visible);
  const focused = document.activeElement?.closest<HTMLElement>(dialogSelector);
  return focused && openDialogs.includes(focused) ? focused : openDialogs.at(-1);
}

function findTarget(lesson: Lesson, root: ParentNode) {
  for (const target of lesson.targets) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(`[data-sylvain-target~="${target}"]`));
    const control = candidates.find(node => visible(node) && !node.matches(':disabled, [aria-disabled="true"]'));
    if (control) return control;
  }
  return null;
}

function portrait(lesson?: Lesson | null) {
  const view = lesson?.destination.view;
  if (view === "school") return "savoir";
  if (lesson?.id === "next" || lesson?.id === "quarter") return "defi";
  if (view === "workshop" || view === "harvests" || view === "staff") return "atelier";
  return "culture";
}

export function KqFarmGuide({ ownerId, initialOpen = false, destination, onNavigate, onActiveChange }: {
  ownerId?: string;
  initialOpen?: boolean;
  destination: FarmGuideDestination;
  onNavigate: (destination: FarmGuideDestination & { flowerId?: string }) => void;
  onActiveChange: (active: boolean, started: boolean, completed: boolean) => void;
}) {
  const accountId = ownerId ?? "guest";
  const [state, setState] = useState(() => readSylvainState(browserStorage, accountId));
  const stateRef = useRef(state);
  const [observations, setObservations] = useState(emptyObservations);
  const observationsKey = useRef("");
  const [bookOpen, setBookOpen] = useState(initialOpen);
  const [feedback, setFeedback] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [hasTarget, setHasTarget] = useState(false);
  const [dialogHost, setDialogHost] = useState<HTMLElement | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLElement | null>(null);
  const focusFrame = useRef(0);
  const titleId = useId();

  const guide = getSylvainGuide(state, observations);
  const { current, replay, hint } = guide;
  const active = state.mode === "active";
  const invite = state.mode === "invited" && destination.view === "hub";
  const shown = active || invite || state.mode === "paused";
  const started = state.mode !== "invited";

  const apply = useCallback((action: GuideAction) => {
    const before = stateRef.current;
    const next = updateSylvainGuide(before, action);
    if (before === next) return next;
    stateRef.current = next;
    setState(next);
    if (writeSylvainState(browserStorage, accountId, next) === false) setStorageUnavailable(true);
    if (action.type === "observe") {
      const finished = next.completed.filter(id => !before.completed.includes(id));
      if (finished.length) {
        const nextGuide = getSylvainGuide(next, action.observations);
        const names = nextGuide.lessons
          .filter(({ lesson }) => finished.includes(lesson.id)).map(({ lesson }) => lesson.title);
        setFeedback(nextGuide.initialComplete && !getSylvainGuide(before, action.observations).initialComplete
          ? "Parcours de départ terminé."
          : names.length === 1 ? `Étape validée — ${names[0]}.` : `${names.length} étapes validées.`);
      }
    } else {
      setFeedback(action.type === "skip" ? "Étape passée. Elle reste dans le carnet." : "");
    }
    return next;
  }, [accountId]);

  const mark = useCallback((target: HTMLElement | null) => {
    if (marker.current && marker.current !== target) {
      marker.current.classList.remove(styles.target);
      marker.current.removeAttribute("data-sylvain-highlight");
    }
    if (target) {
      if (!target.classList.contains(styles.target)) target.classList.add(styles.target);
      if (!target.hasAttribute("data-sylvain-highlight")) target.setAttribute("data-sylvain-highlight", "");
    }
    marker.current = target;
  }, []);

  const scan = useEffectEvent(() => {
    const root = anchor.current?.closest("[data-placard-view]");
    if (!root) return;
    const dialog = activeDialog();
    const shell = readSylvainObservations(root);
    const modal = dialog && !dialog.matches("[data-sylvain-library]") ? readSylvainObservations(dialog) : emptyObservations;
    const fresh: SylvainObservations = {
      achieved: Array.from(new Set([...shell.achieved, ...modal.achieved])),
      relevant: Array.from(new Set([...shell.relevant, ...modal.relevant])),
      hints: { ...shell.hints, ...modal.hints },
      recovery: modal.recovery ?? shell.recovery,
    };
    const key = JSON.stringify(fresh);
    if (key !== observationsKey.current) {
      observationsKey.current = key;
      setObservations(fresh);
    }
    const next = active && !bookOpen ? apply({ type: "observe", observations: fresh }) : stateRef.current;
    const recommendation = getSylvainGuide(next, fresh);
    const target = active && recommendation.current && !recommendation.replay && !bookOpen
      ? findTarget(recommendation.current, dialog ?? root) : null;
    mark(target);
    setHasTarget(Boolean(target));
    setDialogHost(target && dialog ? dialog.querySelector<HTMLElement>("[data-farm-guide-host]") : null);
  });

  useEffect(() => {
    onActiveChange(active, started, guide.initialComplete);
  }, [active, started, guide.initialComplete, onActiveChange]);

  useEffect(() => {
    if (!active || !ownerId) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
    // A past harvest can establish the first launch even from the village.
    // Each response stands alone when the other register is unavailable.
    for (const register of ["runs", "flowers"]) {
      void fetch(`/api/arena/placard/${register}`, { cache: "no-store", signal }).then(async response => {
        if (!response.ok) return;
        const achieved = getLoicHistoricalAchievements(await response.json());
        if (!signal.aborted && achieved.length) apply({ type: "observe", observations: { ...emptyObservations, achieved } });
      }).catch(() => { /* Visible, confirmed game state remains available to the guide. */ });
    }
    return () => controller.abort();
  }, [active, ownerId, apply]);

  useEffect(() => {
    const open = () => setBookOpen(true);
    window.addEventListener(KQ_FARM_GUIDE_OPEN_EVENT, open);
    return () => {
      window.removeEventListener(KQ_FARM_GUIDE_OPEN_EVENT, open);
      cancelAnimationFrame(focusFrame.current);
    };
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== null && event.key !== sylvainStorageKey(accountId)) return;
      const next = readSylvainState(browserStorage, accountId);
      if (JSON.stringify(next) === JSON.stringify(stateRef.current)) return;
      stateRef.current = next;
      setState(next);
      setFeedback("");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [accountId]);

  useEffect(() => {
    if (!active && !bookOpen) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    };
    const observer = new MutationObserver(records => {
      if (records.some(({ target, attributeName }) => {
        const element = target instanceof Element ? target : target.parentElement;
        if (element?.closest("[data-sylvain-guide], [data-sylvain-library], [data-sylvain-dialog-tip]")) return false;
        if (attributeName === "class") return element === marker.current && !element?.classList.contains(styles.target);
        return attributeName !== "data-sylvain-highlight" && attributeName !== "style";
      })) schedule();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("popstate", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("popstate", schedule);
      cancelAnimationFrame(frame);
      mark(null);
    };
  }, [active, bookOpen, current?.id, destination.view, destination.section, mark, replay]);

  const moveFocusToGuide = () => {
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const dialog = activeDialog();
      const dialogControl = dialog && Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .find(node => visible(node) && !node.matches(':disabled, [aria-disabled="true"]'));
      const control = anchor.current?.querySelector<HTMLElement>(`.${styles.actions} button`);
      const menu = Array.from(document.querySelectorAll<HTMLElement>(
        'button[aria-label="Ouvrir le menu du quartier"], [data-arena-learning-trigger]',
      )).find(visible);
      const destination = dialogControl ?? (control && visible(control) ? control : menu);
      destination?.focus({ preventScroll: true });
    });
  };

  const toggleMode = (action: GuideAction) => {
    apply(action);
    moveFocusToGuide();
  };

  const here = current?.destination.view === destination.view
    && (!current?.destination.section || current.destination.section === destination.section);

  const locate = () => {
    if (!current || replay) return;
    const root = activeDialog() ?? anchor.current?.closest("[data-placard-view]");
    const target = root && findTarget(current, root);
    if (target) {
      if (current.id === "prepare" && target.matches('[data-warehouse-zone-prepare], [data-sylvain-target="prepare-open"]')) {
        target.click();
        return;
      }
      target.scrollIntoView({ block: "center", inline: "nearest" });
      if (target.matches(focusableSelector)) target.focus({ preventScroll: true });
      return;
    }
    if (!here) onNavigate(current.destination);
  };

  const title = invite ? SYLVAIN_INVITATION.title : state.mode === "paused" ? "Guide en pause"
    : current?.title ?? (guide.initialComplete ? "Tes premiers gestes sont faits" : "À toi de jouer");
  const stage = current?.kind === "initial" ? initialLessons.indexOf(current) + 1 : 0;
  const instruction = current && (hint ?? current.instruction ?? current.body.split(/(?<=\.)\s/, 1)[0]);
  const canLocate = Boolean(current && !replay && (hasTarget || !here));
  const status = storageUnavailable ? "Ce navigateur n’a pas pu enregistrer la progression." : guide.recovery ? "" : feedback;
  const closeButton = <button type="button" className={styles.closeGuide} data-sylvain-control="close"
    aria-label="Fermer le guide" title="Fermer le guide" onClick={() => toggleMode({ type: "off" })}>
    <X size={20} aria-hidden="true" />
  </button>;

  return <>
    <div ref={anchor} className={styles.anchor} data-farm-guide-anchor data-sylvain-guide
      data-mode={state.mode} data-lesson={current?.id} hidden={!shown}>
      {shown && <section className={styles.guide} aria-labelledby={titleId} data-invitation={invite || undefined}>
        {invite && closeButton}
        <div className={styles.dialogue}>
          <Image src={`/placard/tutorial/sylvain-${portrait(current)}-v1.webp`} alt="" width={76} height={76} unoptimized className={styles.portrait} />
          <div className={styles.copy}>
            {!invite && closeButton}
            {!invite && <span className={styles.speaker}>Loïc{replay ? " · Relecture" : stage ? ` · Étape ${stage} sur ${initialLessons.length}` : ""}</span>}
            <h2 id={titleId}>{title}</h2>
            {invite ? <p>{SYLVAIN_INVITATION.body}</p> : active && instruction ? <p className={hint ? styles.hint : undefined}>{instruction}</p> : null}
            {active && !current ? <p>Retrouve les gestes de ta ferme dans le carnet.</p> : null}
            <p className={status ? styles.status : styles.srOnly} role="status">
              {!storageUnavailable && status && <Check size={14} aria-hidden="true" />}
              {status || (active && current ? `Étape proposée — ${current.title}.` : "")}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          {invite ? <button type="button" className={styles.primary} data-sylvain-control="start" onClick={() => toggleMode({ type: "start" })}><ArrowRight size={16} aria-hidden="true" />{SYLVAIN_INVITATION.action}</button> : null}
          {invite ? <button type="button" data-sylvain-control="off" onClick={() => toggleMode({ type: "off" })}>Jouer librement</button> : null}
          {state.mode === "paused" ? <button type="button" className={styles.primary} data-sylvain-control="resume" onClick={() => toggleMode({ type: "resume" })}>Reprendre</button> : null}
          {canLocate ? <button type="button" className={styles.primary} data-sylvain-control="locate" onClick={locate}><MapPin size={16} aria-hidden="true" />{hasTarget ? "Me montrer" : "Y aller"}</button> : null}
          {active && replay ? <button type="button" className={styles.primary} data-sylvain-control="follow" onClick={() => toggleMode({ type: "follow" })}>Suivre ma partie</button> : null}
          {!invite && <button type="button" data-sylvain-control="book" onClick={() => setBookOpen(true)}><BookOpen size={16} aria-hidden="true" />Carnet</button>}
          {active && <button type="button" data-sylvain-control="pause" aria-label="Mettre le guide en pause" onClick={() => toggleMode({ type: "pause" })}><Pause size={16} aria-hidden="true" /><span>Pause</span></button>}
        </div>
      </section>}
    </div>
    {active && dialogHost?.isConnected && current && !bookOpen && createPortal(
      <div className={styles.dialogTip} data-sylvain-dialog-tip><span><strong>Loïc</strong> {instruction}</span>{closeButton}</div>, dialogHost,
    )}
    <KqTutorialLibrary open={bookOpen} onClose={() => setBookOpen(false)} mode={state.mode} guide={guide}
      onAction={action => {
        if (action.type !== "skip") toggleMode(action);
        else if (getSylvainGuide(stateRef.current, observations).current?.id === current?.id) toggleMode({ ...action, observations });
      }}
      onSelect={id => toggleMode({ type: "select", id, observations })} />
  </>;
}
