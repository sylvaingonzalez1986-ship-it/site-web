"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CircleHelp,
  Trophy,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ARENA_TUTORIAL_STEPS, ARENA_TUTORIAL_REPUTATION_ROWS } from "@/lib/arena-tutorial";
import styles from "./ArenaFirstVisitTutorial.module.css";

export const ARENA_TUTORIAL_STORAGE_KEY = "lcb_arena_tutorial_v2";

type TutorialStorage = Pick<Storage, "getItem" | "setItem">;

export function shouldShowArenaTutorial(storage: TutorialStorage): boolean {
  try {
    return storage.getItem(ARENA_TUTORIAL_STORAGE_KEY) !== "seen";
  } catch {
    return true;
  }
}

export function markArenaTutorialSeen(storage: TutorialStorage): void {
  try {
    storage.setItem(ARENA_TUTORIAL_STORAGE_KEY, "seen");
  } catch {
    // Le tutoriel reste utilisable même si le stockage privé est bloqué.
  }
}

export { ARENA_TUTORIAL_STEPS };

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>([
    "button:not([disabled])",
    "a[href]",
    "summary",
    "[tabindex]:not([tabindex='-1'])",
  ].join(","))).filter((element) => !element.hasAttribute("hidden"));
}

export function ArenaFirstVisitTutorial() {
  const { showBanner } = useCookieConsent();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stepTitleRef = useRef<HTMLHeadingElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const checkedFirstVisitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const step = ARENA_TUTORIAL_STEPS[stepIndex] ?? ARENA_TUTORIAL_STEPS[0];
  const StepIcon = step.Icon;

  const changeStep = (index: number) => {
    setStepIndex(Math.max(0, Math.min(ARENA_TUTORIAL_STEPS.length - 1, index)));
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    stepTitleRef.current?.focus({ preventScroll: true });
  };

  const dismiss = useCallback(() => {
    markArenaTutorialSeen(window.localStorage);
    setOpen(false);
  }, []);

  const reopen = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (showBanner || checkedFirstVisitRef.current) return;
    const openTimer = window.setTimeout(() => {
      checkedFirstVisitRef.current = true;
      if (shouldShowArenaTutorial(window.localStorage)) {
        setStepIndex(0);
        setOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(openTimer);
  }, [showBanner]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const activeIndex = focusable.findIndex((element) => element === document.activeElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && activeIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActive?.isConnected) previousActive.focus({ preventScroll: true });
    };
  }, [dismiss, open]);

  const modal = open ? (
    <div className={styles.backdrop}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={styles.dialog}
      >
        <header className={styles.header}>
          <div>
            <span>Le guide de l’Arène · nouvelle édition</span>
            <h2 id={titleId}>De la carte à la réputation.</h2>
            <p id={descriptionId}>Huit étapes. Tu peux aller directement au sujet qui t’intéresse.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={dismiss} aria-label="Fermer le tutoriel de l’Arène">
            <X aria-hidden="true" />
          </button>
        </header>

        <nav className={styles.stepTabs} aria-label="Étapes du tutoriel">
          {ARENA_TUTORIAL_STEPS.map((tutorialStep, index) => (
            <button
              key={tutorialStep.id}
              type="button"
              aria-current={stepIndex === index ? "step" : undefined}
              onClick={() => changeStep(index)}
            >
              <b>{tutorialStep.number}</b>
              <span>{tutorialStep.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.scrollArea} ref={scrollRef} data-tutorial-scroll>
        <div className={styles.stepBody} data-tutorial-step={step.id}>
          <aside className={styles.stepMarker} aria-hidden="true">
            <StepIcon />
            <strong>{step.number}</strong>
          </aside>
          <div className={styles.stepContent}>
            <span aria-live="polite">Étape {step.number} / {ARENA_TUTORIAL_STEPS.length} · {step.eyebrow}</span>
            <h3 ref={stepTitleRef} tabIndex={-1}>{step.title}</h3>
            <p>{step.lead}</p>
            <div className={styles.features}>
              {step.features.map(({ title, description, Icon }) => (
                <article key={title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
            {step.id === "reputation" ? (
              <div className={styles.reputationTable}>
                <table>
                  <caption>Note du jury / 10 · effet sur la réputation</caption>
                  <thead><tr><th scope="col">Filière</th><th scope="col">Baisse</th><th scope="col">Stable</th><th scope="col">Hausse</th></tr></thead>
                  <tbody>{ARENA_TUTORIAL_REPUTATION_ROWS.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.loss}</td><td>{row.neutral}</td><td>{row.gain}</td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
            <p className={styles.tip}>{step.tip}</p>
            {step.details ? <details key={step.id} className={styles.details}><summary>{step.details.title}</summary>{step.details.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</details> : null}
            <Link href={step.href} onClick={dismiss} className={styles.stepAction}>
              {step.action}<ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>

        {step.id === "reputation" ? <div className={styles.scoreBand}>
          <Trophy aria-hidden="true" />
          <p>
            <strong>La boucle du Placard</strong>
            Équipe → cultive → duel → vends → réinvestis. La qualité fait la différence.
          </p>
        </div> : null}
        </div>

        <footer className={styles.footer}>
          {stepIndex > 0 ? (
            <button type="button" onClick={() => changeStep(stepIndex - 1)}>
              <ArrowLeft aria-hidden="true" />Retour
            </button>
          ) : (
            <button type="button" onClick={dismiss}>Voir plus tard</button>
          )}
          {stepIndex < ARENA_TUTORIAL_STEPS.length - 1 ? (
            <button type="button" className={styles.primaryButton} onClick={() => changeStep(stepIndex + 1)}>
              Étape suivante<ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className={styles.primaryButton} onClick={dismiss}>
              J’ai compris<Boxes aria-hidden="true" />
            </button>
          )}
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className={styles.replayButton} onClick={reopen}>
        <CircleHelp aria-hidden="true" />Comment fonctionne l’Arène ?
      </button>
      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : modal}
    </>
  );
}
