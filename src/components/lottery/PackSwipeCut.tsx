"use client";
import Image from "next/image";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import styles from "./PackOpening.module.css";

export function PackSwipeCut({ onThresholdReached, disabled = false, splitting = false }: {
  onThresholdReached: () => void; disabled?: boolean; splitting?: boolean;
}) {
  const gesture = useRef<{ id: number; x: number; width: number } | null>(null);
  const fired = useRef(false);
  const [progress, setProgress] = useState(0);
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || splitting || gesture.current || !event.isPrimary) return;
    gesture.current = { id: event.pointerId, x: event.clientX, width: event.currentTarget.clientWidth };
    fired.current = false; setProgress(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId || disabled || fired.current) return;
    const next = Math.min(1, Math.abs(event.clientX - drag.x) / (drag.width * .6));
    setProgress(next);
    if (next >= 1) { fired.current = true; onThresholdReached(); }
  };
  const end = () => { gesture.current = null; if (!fired.current) setProgress(0); };
  return <div className={styles.foil} data-splitting={splitting || undefined} style={{ "--tear": progress } as CSSProperties}
    onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
    role="button" aria-label="Glissez pour ouvrir le booster" aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
    onKeyDown={event => { if (!disabled && !fired.current && ["Enter", " "].includes(event.key)) { event.preventDefault(); fired.current = true; onThresholdReached(); } }}>
    <div className={styles.foilTop}><Image src="/app/lottery/sealed-booster-pack.png" alt="" fill priority sizes="320px" draggable={false} /></div>
    <div className={styles.foilBody}><Image src="/app/lottery/sealed-booster-pack.png" alt="" fill priority sizes="320px" draggable={false} /></div>
    <div className={styles.foilShine} aria-hidden="true" />
    <div className={styles.tearLine} aria-hidden="true"><span /></div>
    {!splitting && <span className={styles.tearHint} aria-hidden="true">← Tire pour déchirer →</span>}
  </div>;
}
