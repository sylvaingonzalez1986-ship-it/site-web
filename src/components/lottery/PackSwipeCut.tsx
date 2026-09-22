"use client";

import Image from "next/image";
import { useRef, type PointerEvent } from "react";
import styles from "./PackOpening.module.css";

/** Scrub CSS variables directly: no React render on pointermove. */
export function PackSwipeCut({ onThresholdReached, disabled = false, splitting = false }: {
  onThresholdReached: () => void; disabled?: boolean; splitting?: boolean;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; width: number } | null>(null);
  const fired = useRef(false);
  const open = () => {
    if (disabled || splitting || fired.current) return;
    fired.current = true;
    surface.current?.setAttribute("data-released", "true");
    onThresholdReached();
  };
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || splitting || fired.current || gesture.current || !event.isPrimary) return;
    gesture.current = { id: event.pointerId, x: event.clientX, width: event.currentTarget.clientWidth };
    event.currentTarget.setAttribute("data-dragging", "true");
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId || disabled || fired.current) return;
    const progress = Math.min(1, Math.abs(event.clientX - drag.x) / (drag.width * .52));
    event.currentTarget.style.setProperty("--tear", String(progress));
    if (progress >= 1) open();
  };
  const end = () => {
    gesture.current = null;
    surface.current?.removeAttribute("data-dragging");
    if (!fired.current) surface.current?.style.setProperty("--tear", "0");
  };
  return <div ref={surface} className={styles.foil} data-splitting={splitting || undefined}
    onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
    role="button" aria-label="Glissez pour ouvrir le booster" aria-disabled={disabled || splitting} tabIndex={disabled || splitting ? -1 : 0}
    onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); open(); } }}>
    <div className={styles.foilTop} data-foil-top><Image src="/app/lottery/sealed-booster-pack-sylvain-v3.webp" alt="" fill loading="eager" sizes="(max-width: 700px) 85vw, 440px" draggable={false} /></div>
    <div className={styles.foilBody} data-foil-body><Image src="/app/lottery/sealed-booster-pack-sylvain-v3.webp" alt="" fill loading="eager" sizes="(max-width: 700px) 85vw, 440px" draggable={false} /></div>
    <div className={styles.foilShine} aria-hidden="true" />
    <div className={styles.tearLine} aria-hidden="true"><span /><i /></div>
  </div>;
}
