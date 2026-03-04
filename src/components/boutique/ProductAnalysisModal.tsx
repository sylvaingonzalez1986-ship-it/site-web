"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type ProductAnalysisModalProps = {
  open: boolean;
  productName: string;
  analysisUrl: string;
  onClose: () => void;
};

function normalizeAnalysisUrl(value: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function ProductAnalysisModal({
  open,
  productName,
  analysisUrl,
  onClose,
}: ProductAnalysisModalProps) {
  const safeUrl = useMemo(() => normalizeAnalysisUrl(analysisUrl), [analysisUrl]);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !safeUrl || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fermer l'analyse produit"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Analyse ${productName}`}
        className="relative z-10 flex h-[min(92vh,820px)] w-full max-w-5xl flex-col cartoon-border bg-cream p-4 md:p-6"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-charcoal">
              Analyse laboratoire
            </p>
            <h3 className="font-display text-2xl text-ink md:text-3xl">{productName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] border-2 border-[#1a1a1a] bg-white">
          <iframe
            title={`Analyse PDF ${productName}`}
            src={safeUrl}
            className="h-full w-full"
          />
        </div>

        <div className="mt-3 text-right">
          <a
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0a7b61] underline"
          >
            Ouvrir le PDF dans un nouvel onglet
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
