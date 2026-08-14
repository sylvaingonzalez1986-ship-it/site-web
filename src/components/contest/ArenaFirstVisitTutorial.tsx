"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  CircleHelp,
  Gift,
  Layers3,
  MessageSquareText,
  ShoppingBag,
  Sparkles,
  Sprout,
  Swords,
  Trophy,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import styles from "./ArenaFirstVisitTutorial.module.css";

export const ARENA_TUTORIAL_STORAGE_KEY = "lcb_arena_tutorial_v1";

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

type TutorialFeature = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

type TutorialStep = {
  id: "carnet" | "placard";
  number: string;
  eyebrow: string;
  title: string;
  lead: string;
  href: string;
  action: string;
  Icon: LucideIcon;
  features: TutorialFeature[];
};

export const ARENA_TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "carnet",
    number: "01",
    eyebrow: "Carnet de dégustation",
    title: "Note les fleurs que tu as achetées.",
    lead: "Retrouve tes fleurs dans le Carnet, goûte-les et attribue tes notes.",
    href: "/arene/carnet/regular",
    action: "Ouvrir mon Carnet",
    Icon: BookOpenCheck,
    features: [
      {
        title: "Donne tes notes",
        description: "Évalue chaque fleur depuis sa fiche de dégustation.",
        Icon: Sparkles,
      },
      {
        title: "Laisse un avis",
        description: "C’est optionnel, mais un avis validé peut débloquer des packs.",
        Icon: MessageSquareText,
      },
      {
        title: "Débloque les Héritages",
        description: "Goûte les fleurs de chaque producteur pour obtenir sa carte Héritage.",
        Icon: Gift,
      },
    ],
  },
  {
    id: "placard",
    number: "02",
    eyebrow: "Le Placard Kanab Quest",
    title: "Cultive, affronte et grimpe.",
    lead: "Transforme ta collection en stratégie et tente de cultiver la meilleure Fleur.",
    href: "/arene/placard",
    action: "Jouer dans le Placard",
    Icon: Sprout,
    features: [
      {
        title: "Choisis ton Buddie",
        description: "Sélectionne une carte Kanab Quest que tu possèdes.",
        Icon: UserRound,
      },
      {
        title: "Prépare ton deck",
        description: "Compose une main stratégique adaptée à ta culture.",
        Icon: Layers3,
      },
      {
        title: "Achète des packs",
        description: "Utilise les points gagnés lors de tes achats dans la boutique.",
        Icon: ShoppingBag,
      },
      {
        title: "Affronte les joueurs",
        description: "Engage tes Fleurs en duel pour progresser au classement.",
        Icon: Swords,
      },
    ],
  },
] as const;

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>([
    "button:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(","))).filter((element) => !element.hasAttribute("hidden"));
}

export function ArenaFirstVisitTutorial() {
  const { showBanner } = useCookieConsent();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const checkedFirstVisitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const step = ARENA_TUTORIAL_STEPS[stepIndex] ?? ARENA_TUTORIAL_STEPS[0];
  const StepIcon = step.Icon;

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
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
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
      previousActive?.focus();
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
            <span>Première visite · mode d’emploi</span>
            <h2 id={titleId}>Bienvenue dans l’Arène.</h2>
            <p id={descriptionId}>Deux espaces alimentent une seule progression.</p>
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
              onClick={() => setStepIndex(index)}
            >
              <b>{tutorialStep.number}</b>
              <span>{tutorialStep.id === "carnet" ? "Le Carnet" : "Le Placard"}</span>
            </button>
          ))}
        </nav>

        <div className={styles.stepBody} key={step.id}>
          <aside className={styles.stepMarker} aria-hidden="true">
            <StepIcon />
            <strong>{step.number}</strong>
          </aside>
          <div className={styles.stepContent}>
            <span>{step.eyebrow}</span>
            <h3>{step.title}</h3>
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
            <Link href={step.href} onClick={dismiss} className={styles.stepAction}>
              {step.action}<ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className={styles.scoreBand}>
          <Trophy aria-hidden="true" />
          <p>
            <strong>Classement final</strong>
            Les points du Carnet et tes performances dans le Placard comptent ensemble.
            Des coffrets dégustation et des goodies sont à gagner en fin de saison.
          </p>
        </div>

        <footer className={styles.footer}>
          {stepIndex > 0 ? (
            <button type="button" onClick={() => setStepIndex((current) => current - 1)}>
              <ArrowLeft aria-hidden="true" />Retour
            </button>
          ) : (
            <button type="button" onClick={dismiss}>Voir plus tard</button>
          )}
          {stepIndex < ARENA_TUTORIAL_STEPS.length - 1 ? (
            <button type="button" className={styles.primaryButton} onClick={() => setStepIndex((current) => current + 1)}>
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
