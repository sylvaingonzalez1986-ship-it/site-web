"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  COOKIE_CATEGORIES,
  type CookieCategory,
  type CookieConsentSelections,
} from "@/components/cookies/cookie-consent-config";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import styles from "@/components/FirstVisitExperience.module.css";

type CookieConsentModalProps = {
  open: boolean;
  dismissible: boolean;
  initialDetailed: boolean;
  initialSelections: CookieConsentSelections;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: (selections: CookieConsentSelections) => void;
  onRequestClose: () => void;
};

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  const selector = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
  );
}

function ToggleRow({
  category,
  checked,
  onToggle,
}: {
  category: (typeof COOKIE_CATEGORIES)[number];
  checked: boolean;
  onToggle: (category: CookieCategory) => void;
}) {
  const disabled = category.required;

  return (
    <div
      className={`${styles.option} ${disabled ? "bg-[#ece7d8]" : "bg-white/80"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-ink">
            {category.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-charcoal">{category.description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={category.label}
          disabled={disabled}
          onClick={() => onToggle(category.key)}
          className={`relative inline-flex h-11 w-20 shrink-0 items-center rounded-full border-2 border-[#1a1a1a] px-1 transition-colors ${
            checked ? "bg-[#254f40]" : "bg-[#d7d2c2]"
          } ${disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
        >
          <span
            className={`h-8 w-8 rounded-full border-2 border-[#1a1a1a] bg-white transition-transform ${
              checked ? "translate-x-8" : "translate-x-0"
            }`}
          />
          <span className="sr-only">
            {checked ? "Active" : "Inactif"}
            {disabled ? ", obligatoire" : ""}
          </span>
        </button>
      </div>
    </div>
  );
}

export function CookieConsentModal({
  open,
  dismissible,
  initialDetailed,
  initialSelections,
  onAcceptAll,
  onRejectAll,
  onSave,
  onRequestClose,
}: CookieConsentModalProps) {
  useBodyScrollLock(open);

  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [detailed, setDetailed] = useState(initialDetailed);
  const [draftSelections, setDraftSelections] =
    useState<CookieConsentSelections>(initialSelections);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const frameId = window.requestAnimationFrame(() => {
      primaryActionRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (dismissible) {
          event.preventDefault();
          onRequestClose();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !modalRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !modalRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedElementRef.current?.focus?.();
    };
  }, [dismissible, onRequestClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={styles.dialog}
      >
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Votre visite, vos choix</p>
            <h2 id={titleId} className={styles.title}>Des cookies sans cachotterie.</h2>
          </div>
          <Image className={styles.heroVisual} src="/mascots/home-thinking.png" alt="" width={150} height={150} />
          {dismissible ? (
            <button type="button" onClick={onRequestClose} className={styles.close} aria-label="Fermer les preferences cookies">×</button>
          ) : null}
        </div>
        <div className={styles.content}>
            <p id={descriptionId} className={styles.intro}>
              Les cookies strictement necessaires restent actifs pour assurer la securite, la
              session, le panier et la verification d&apos;age. Les autres categories ne sont activees
              qu&apos;apres votre choix.
            </p>

        {!detailed ? (
          <>
            <div className={`${styles.notice} text-sm leading-relaxed text-ink`}>
              <p>
                Vous pouvez accepter, refuser ou personnaliser les cookies non necessaires. Votre
                choix reste modifiable a tout moment depuis le bouton cookies en bas de
                l&apos;ecran.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                ref={primaryActionRef}
                type="button"
                onClick={onAcceptAll}
                className={`${styles.primary} text-sm`}
              >
                Tout accepter
              </button>
              <button
                type="button"
                onClick={onRejectAll}
                className={`${styles.secondary} text-sm`}
              >
                Tout refuser
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDetailed(true)}
                className={styles.textLink}
              >
                Personnaliser
              </button>
              <Link
                href="/politique-cookies"
                className={styles.textLink}
              >
                Lire la politique cookies
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 grid gap-3">
              {COOKIE_CATEGORIES.map((category) => (
                <ToggleRow
                  key={category.key}
                  category={category}
                  checked={draftSelections[category.key]}
                  onToggle={(key) =>
                    setDraftSelections((current) => ({
                      ...current,
                      [key]: !current[key],
                    }))
                  }
                />
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onAcceptAll}
                  className={`${styles.secondary} min-h-[48px] text-xs`}
                >
                  Tout accepter
                </button>
                <button
                  type="button"
                  onClick={onRejectAll}
                  className={`${styles.secondary} min-h-[48px] text-xs`}
                >
                  Tout refuser
                </button>
              </div>
              <button
                ref={primaryActionRef}
                type="button"
                onClick={() => onSave(draftSelections)}
                className={`${styles.primary} text-sm`}
              >
                Enregistrer
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {!initialDetailed ? (
                <button
                  type="button"
                  onClick={() => setDetailed(false)}
                  className={styles.textLink}
                >
                  Retour
                </button>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
                  Vous pourrez modifier ce choix a tout moment.
                </span>
              )}
              <Link
                href="/politique-cookies"
                className={styles.textLink}
              >
                Politique cookies
              </Link>
            </div>
          </>
        )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
