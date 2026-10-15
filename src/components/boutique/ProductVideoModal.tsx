"use client";

import { useState } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import styles from "./ProductMediaDialog.module.css";

type ProductVideoModalProps = {
  open: boolean;
  videoUrl: string;
  productName: string;
  onClose: () => void;
};

export function ProductVideoModal({ open, videoUrl, productName, onClose }: ProductVideoModalProps) {
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  return <AppDialog open={open} onClose={() => { setPlaybackError(null); onClose(); }} title={productName} label={`Vidéo ${productName}`} className={styles.video}>
    <video key={videoUrl} src={videoUrl} controls autoPlay loop playsInline className={styles.player}
      onError={() => setPlaybackError("La vidéo n’a pas pu être lue. Tu peux l’ouvrir dans un nouvel onglet ou la télécharger.")}
      onLoadedData={() => setPlaybackError(null)} />
    {playbackError ? <div className="border-t-2 border-ink bg-cream p-4">
      <p className="text-sm font-semibold text-red-700" role="alert">{playbackError}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={videoUrl} target="_blank" rel="noreferrer" className="btn-cartoon btn-secondary inline-flex min-h-[44px] items-center px-3 text-sm">Ouvrir la vidéo</a>
        <a href={videoUrl} download className="btn-cartoon btn-primary inline-flex min-h-[44px] items-center px-3 text-sm">Télécharger</a>
      </div>
    </div> : null}
  </AppDialog>;
}
