"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import styles from "./ProductImageZoom.module.css";

type ProductImageZoomProps = {
  src: string;
  productName: string;
};

/** Overlays the photo, leaving its badges and carousel controls in place. */
export function ProductImageZoom({ src, productName }: ProductImageZoomProps) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  if (!src) return null;

  return <>
    <button
      type="button"
      className={styles.trigger}
      data-product-image-zoom
      aria-label={`Agrandir la photo de ${productName}`}
      aria-haspopup="dialog"
      onPointerDown={event => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
        moved.current = false;
      }}
      onPointerMove={event => {
        const start = pointerStart.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
          moved.current = true;
        }
      }}
      onPointerCancel={() => { moved.current = true; pointerStart.current = null; }}
      onPointerUp={() => { pointerStart.current = null; }}
      onClick={event => {
        event.stopPropagation();
        // A swipe changes the carousel image; only a tap opens the photo.
        if (event.detail > 0 && moved.current) return;
        setFailed(false);
        setOpen(true);
      }}
    >
      <span className={styles.hint} aria-hidden="true"><Maximize2 size={18} /></span>
    </button>
    {open && createPortal(
      <AppDialog
        open
        onClose={() => setOpen(false)}
        title={productName}
        label={`Photo de ${productName}`}
        closeLabel="Fermer la photo agrandie"
        className={styles.dialog}
        bodyClassName={styles.body}
        dialogProps={{ "data-product-image-dialog": true }}
      >
        <div className={styles.photo}>
          {failed ? <p className={styles.error} role="alert">La photo n’a pas pu être chargée.</p> : <Image
            src={src}
            alt={productName}
            fill
            unoptimized
            loading="eager"
            className={styles.image}
            onError={() => setFailed(true)}
          />}
        </div>
      </AppDialog>,
      document.body,
    )}
  </>;
}
