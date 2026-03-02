"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

const SEALED_BOOSTER_IMAGE_SRC = "/app/lottery/sealed-booster-pack.png";
const CUT_THRESHOLD = 0.65;

type PackSwipeCutProps = {
  onThresholdReached: () => void;
  disabled?: boolean;
  splitting?: boolean;
};

export function PackSwipeCut({
  onThresholdReached,
  disabled = false,
  splitting = false,
}: PackSwipeCutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const firedRef = useRef(false);
  const startXRef = useRef(0);
  const widthRef = useRef(1);
  const pointerIdRef = useRef<number | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Pointer handlers (direction-lock: vertical scroll still works)     */
  /* ------------------------------------------------------------------ */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || splitting) return;
      const el = containerRef.current;
      if (!el) return;
      startXRef.current = e.clientX;
      widthRef.current = el.offsetWidth || 1;
      firedRef.current = false;
      pointerIdRef.current = e.pointerId;
      // Capture immediately — touch-action:none ensures no browser gesture conflict
      try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
      setActive(true);
      setProgress(0);
    },
    [disabled, splitting],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || splitting || pointerIdRef.current !== e.pointerId) return;

      const dx = e.clientX - startXRef.current;

      // --- tracking horizontal progress ---
      const deltaX = Math.abs(dx);
      const pct = Math.min(deltaX / widthRef.current, 1);
      setProgress(pct);
      if (pct >= CUT_THRESHOLD && !firedRef.current) {
        firedRef.current = true;
        onThresholdReached();
      }
    },
    [disabled, splitting, onThresholdReached],
  );

  const handlePointerEnd = useCallback(() => {
    if (!firedRef.current) {
      setProgress(0);
    }
    setActive(false);
    pointerIdRef.current = null;
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Derived visual values                                              */
  /* ------------------------------------------------------------------ */

  const splitGap = splitting ? 42 : progress * 18;
  const tilt = splitting ? 6 : progress * 4;
  const glow = Math.min(progress / CUT_THRESHOLD, 1);
  const cutLineY = active || splitting ? 50 : -10;

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div
      ref={containerRef}
      className="relative z-10 h-full w-full select-none"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      role="slider"
      aria-label="Glissez pour ouvrir le booster"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={disabled ? -1 : 0}
    >
      {/* ---------- top half ---------- */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px] transition-transform"
        style={{
          clipPath: "polygon(0 0, 100% 0, 100% 52%, 0 52%)",
          transform: `translateY(-${splitGap}%) rotate(-${tilt}deg)`,
          transitionDuration: splitting ? "700ms" : "0ms",
        }}
      >
        <Image
          src={SEALED_BOOSTER_IMAGE_SRC}
          alt="Booster scellé — moitié haute"
          fill
          sizes="(max-width: 768px) 240px, 280px"
          className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.32)]"
          priority
          draggable={false}
        />
      </div>

      {/* ---------- bottom half ---------- */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px] transition-transform"
        style={{
          clipPath: "polygon(0 48%, 100% 48%, 100% 100%, 0 100%)",
          transform: `translateY(${splitGap}%) rotate(${tilt}deg)`,
          transitionDuration: splitting ? "700ms" : "0ms",
        }}
      >
        <Image
          src={SEALED_BOOSTER_IMAGE_SRC}
          alt="Booster scellé — moitié basse"
          fill
          sizes="(max-width: 768px) 240px, 280px"
          className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.32)]"
          priority
          draggable={false}
        />
      </div>

      {/* ---------- cut-line SVG ---------- */}
      {(active || splitting) && (
        <svg
          className="pointer-events-none absolute inset-0 z-20 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1={cutLineY}
            x2="100"
            y2={cutLineY}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="0.8"
            strokeDasharray="3 2"
            style={{
              filter: `drop-shadow(0 0 ${4 + glow * 8}px rgba(255,240,200,${0.5 + glow * 0.5}))`,
            }}
          />
        </svg>
      )}

      {/* ---------- glow overlay ---------- */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[30px] transition-opacity"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(255,240,200,${glow * 0.35}) 0%, transparent 70%)`,
          opacity: active || splitting ? 1 : 0,
          transitionDuration: active ? "0ms" : "400ms",
        }}
      />

      {/* ---------- hint ---------- */}
      {!active && !splitting && !disabled && progress === 0 && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-charcoal/70">
            ← Glissez pour couper →
          </p>
        </div>
      )}
    </div>
  );
}
