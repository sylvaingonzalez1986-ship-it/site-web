"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  COOKIE_CATEGORIES,
  type CookieCategory,
  type CookieConsentSelections,
} from "@/components/cookies/cookie-consent-config";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

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
      className={`rounded-[0.2rem] border-2 border-[#1a1a1a] p-4 ${
        disabled ? "bg-[#ece7d8]" : "bg-white"
      }`}
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
            checked ? "bg-[#0a7b61]" : "bg-[#d7d2c2]"
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="cartoon-border relative w-full max-w-2xl bg-[#fff9ef] p-5 shadow-[10px_10px_0_rgba(26,26,26,0.28)] md:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal">
              Preferences cookies
            </p>
            <h2 id={titleId} className="mt-1 font-display text-3xl leading-tight text-ink md:text-4xl">
              Choisissez vos cookies
            </h2>
            <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-charcoal md:text-base">
              Les cookies strictement necessaires restent actifs pour assurer la securite, la
              session, le panier et la verification d&apos;age. Les autres categories ne sont activees
              qu&apos;apres votre choix.
            </p>
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={onRequestClose}
              className="cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3 text-xl font-bold"
              aria-label="Fermer les preferences cookies"
            >
              X
            </button>
          ) : null}
        </div>

        {!detailed ? (
          <>
            <div className="mt-5 rounded-[0.2rem] border-2 border-[#1a1a1a] bg-white p-4 text-sm leading-relaxed text-ink">
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
                className="btn-cartoon btn-primary min-h-[52px] text-sm"
              >
                Tout accepter
              </button>
              <button
                type="button"
                onClick={onRejectAll}
                className="btn-cartoon btn-secondary min-h-[52px] text-sm"
              >
                Tout refuser
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDetailed(true)}
                className="text-sm font-bold uppercase tracking-[0.08em] text-[#0a7b61] underline underline-offset-4"
              >
                Personnaliser
              </button>
              <Link
                href="/politique-cookies"
                className="text-sm font-semibold text-charcoal underline underline-offset-4"
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
                  className="btn-cartoon btn-secondary min-h-[48px] px-4 text-xs"
                >
                  Tout accepter
                </button>
                <button
                  type="button"
                  onClick={onRejectAll}
                  className="btn-cartoon btn-secondary min-h-[48px] px-4 text-xs"
                >
                  Tout refuser
                </button>
              </div>
              <button
                ref={primaryActionRef}
                type="button"
                onClick={() => onSave(draftSelections)}
                className="btn-cartoon btn-primary min-h-[52px] px-5 text-sm"
              >
                Enregistrer
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {!initialDetailed ? (
                <button
                  type="button"
                  onClick={() => setDetailed(false)}
                  className="text-sm font-semibold text-charcoal underline underline-offset-4"
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
                className="text-sm font-semibold text-charcoal underline underline-offset-4"
              >
                Politique cookies
              </Link>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
