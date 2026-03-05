"use client";

import { useEffect } from "react";
import { useState } from "react";
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
  useBodyScrollLock(open);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

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

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fermer la vidéo"
        onClick={() => {
          setPlaybackError(null);
          onClose();
        }}
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
            onClick={() => {
              setPlaybackError(null);
              onClose();
            }}
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
            loop
            playsInline
            className="h-full w-full"
            onError={() =>
              setPlaybackError(
                "Lecture impossible sur cet appareil. Utilise une video MP4 (H.264/AAC).",
              )
            }
            onLoadedData={() => setPlaybackError(null)}
          />
          {playbackError && (
            <div className="border-t-2 border-[#1a1a1a] bg-cream p-3">
              <p className="text-xs font-semibold text-red-700">{playbackError}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-cartoon btn-secondary inline-flex h-9 items-center px-3 text-xs"
                >
                  Ouvrir la video
                </a>
                <a
                  href={videoUrl}
                  download
                  className="btn-cartoon btn-primary inline-flex h-9 items-center px-3 text-xs"
                >
                  Telecharger
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
