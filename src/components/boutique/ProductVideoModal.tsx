"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type ProductVideoModalProps = {
  open: boolean;
  videoUrl: string;
  productName: string;
  onClose: () => void;
};

export function ProductVideoModal({
  open,
  videoUrl,
  productName,
  onClose,
}: ProductVideoModalProps) {
  const [mounted, setMounted] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fermer la vidéo"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="cartoon-border relative w-full max-w-2xl bg-[#1a1a1a]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] bg-cream px-4 py-3">
          <p className="truncate pr-4 text-sm font-bold uppercase tracking-wide text-ink">
            {productName}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn-cartoon btn-secondary flex-shrink-0 px-3 py-1 text-sm"
          >
            ✕ Fermer
          </button>
        </div>

        {/* Video */}
        <div className="aspect-video w-full bg-black">
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
