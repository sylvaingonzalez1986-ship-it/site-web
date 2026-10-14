"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripHorizontal, LockKeyhole, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { BuddieCard } from "@/components/lottery/BuddieCard";
import { KQ_BUDDIES, type KqBuddie } from "@/lib/kanab-quest-game";
import { getKqBuddieRotationRemaining } from "@/lib/kanab-quest-buddie-rotation";
import type { KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import type { KqWarehouseBuddies, KqWarehouseCultureSummary } from "./KqWarehouseCulture";
import styles from "./KqWarehouseBuddieDock.module.css";

export type KqWarehouseBuddiePoint = { x: number; y: number };
type Props = {
  buddies: KqWarehouseBuddies | null;
  runs: KqWarehouseCultureSummary[];
  zones: KqWarehouseZone[];
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCode?: string | null;
  onPick: (code: string | null) => void;
  /** Viewport coordinates, identical to PointerEvent.clientX/clientY. */
  onDragPoint: (point: KqWarehouseBuddiePoint | null) => void;
  onDrop: (code: string, point: KqWarehouseBuddiePoint) => void;
};
type CardGesture = {
  pointerId: number; code: string; origin: KqWarehouseBuddiePoint;
  target: HTMLButtonElement; dragging: boolean;
};
type ScrollGesture = { pointerId: number; x: number; scrollLeft: number; target: HTMLDivElement };

function releasePointer(gesture: { pointerId: number; target: HTMLElement } | null) {
  if (gesture?.target.hasPointerCapture(gesture.pointerId)) gesture.target.releasePointerCapture(gesture.pointerId);
}

function Artwork({ buddie }: { buddie: KqBuddie }) {
  return <BuddieCard code={buddie.code} name={buddie.name} rarity={buddie.rarity} cardNumber={buddie.cardNumber} sizes="88px" />;
}

export function KqWarehouseBuddieDock({ buddies, runs, zones, disabled, open, onOpenChange, selectedCode = null, onPick, onDragPoint, onDrop }: Props) {
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cardGesture = useRef<CardGesture | null>(null);
  const scrollGesture = useRef<ScrollGesture | null>(null);
  const suppressedClick = useRef<{ code: string; until: number } | null>(null);
  const callbacks = useRef({ onPick, onDragPoint, onDrop, selectedCode });
  const [ghost, setGhost] = useState<{ code: string; point: KqWarehouseBuddiePoint } | null>(null);
  const [scroll, setScroll] = useState({ previous: false, next: false, percent: 0 });
  const owned = KQ_BUDDIES.filter(buddie => buddies?.ownedBuddieCodes.includes(buddie.code));
  const draggedBuddie = ghost ? KQ_BUDDIES.find(buddie => buddie.code === ghost.code) : undefined;

  useEffect(() => { callbacks.current = { onPick, onDragPoint, onDrop, selectedCode }; }, [onPick, onDragPoint, onDrop, selectedCode]);

  const cancel = useCallback((updateView = true) => {
    const current = cardGesture.current;
    const scrolling = scrollGesture.current;
    cardGesture.current = null;
    scrollGesture.current = null;
    if (current) suppressedClick.current = { code: current.code, until: performance.now() + 600 };
    releasePointer(current);
    releasePointer(scrolling);
    if (updateView) setGhost(null);
    if (current?.dragging) callbacks.current.onDragPoint(null);
    if (current?.dragging || callbacks.current.selectedCode) callbacks.current.onPick(null);
  }, []);

  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || (!cardGesture.current && !scrollGesture.current && !callbacks.current.selectedCode)) return;
      event.preventDefault(); event.stopPropagation(); cancel();
    };
    const blur = () => cancel();
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", blur);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", blur);
      cancel(false);
    };
  }, [cancel]);

  // A refresh or lock acquired during a gesture cannot commit the old drag.
  useEffect(() => {
    const code = cardGesture.current?.code ?? selectedCode;
    if (!code) return;
    if (!open || disabled || !buddies?.ownedBuddieCodes.includes(code)
      || runs.some(run => run.buddieCode === code)
      || getKqBuddieRotationRemaining(code, buddies?.buddieRotation?.recentBuddieCodes ?? []) > 0) cancel();
  }, [buddies, cancel, disabled, open, runs, selectedCode]);

  const measureScroll = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
    const left = Math.max(0, Math.min(maximum, element.scrollLeft));
    setScroll({ previous: left > 2, next: left < maximum - 2, percent: maximum ? Math.round(left / maximum * 100) : 0 });
  }, []);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const frame = requestAnimationFrame(measureScroll);
    const observer = new ResizeObserver(measureScroll);
    observer.observe(element);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [measureScroll, open, owned.length]);

  const changeOpen = () => {
    cancel();
    onOpenChange(!open);
    toggle.current?.focus({ preventScroll: true });
  };

  const scrollBy = (direction: -1 | 1) => {
    if (!track.current) return;
    track.current.scrollBy({ left: direction * Math.max(110, track.current.clientWidth * .7), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const scrollKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || !track.current) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); scrollBy(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); track.current.scrollTo({ left: event.key === "Home" ? 0 : track.current.scrollWidth, behavior: "instant" });
    }
  };

  const startCard = (event: PointerEvent<HTMLButtonElement>, code: string) => {
    if (!open || disabled || !event.isPrimary || event.button !== 0 || cardGesture.current || scrollGesture.current) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    cardGesture.current = { pointerId: event.pointerId, code, origin: { x: event.clientX, y: event.clientY }, target: event.currentTarget, dragging: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { cardGesture.current = null; }
  };
  const moveCard = (event: PointerEvent<HTMLButtonElement>) => {
    const current = cardGesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && !(event.buttons & 1)) { cancel(); return; }
    const point = { x: event.clientX, y: event.clientY };
    if (!current.dragging && Math.hypot(point.x - current.origin.x, point.y - current.origin.y) < 6) return;
    event.preventDefault(); event.stopPropagation();
    if (!current.dragging) { current.dragging = true; callbacks.current.onPick(current.code); }
    setGhost({ code: current.code, point });
    callbacks.current.onDragPoint(point);
  };
  const finishCard = (event: PointerEvent<HTMLButtonElement>) => {
    const current = cardGesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    cardGesture.current = null;
    suppressedClick.current = { code: current.code, until: performance.now() + 600 };
    releasePointer(current); setGhost(null);
    if (current.dragging) {
      try { callbacks.current.onDrop(current.code, { x: event.clientX, y: event.clientY }); }
      finally { callbacks.current.onDragPoint(null); callbacks.current.onPick(null); }
    } else callbacks.current.onPick(callbacks.current.selectedCode === current.code ? null : current.code);
  };
  const cancelCard = (event: PointerEvent<HTMLButtonElement>) => {
    if (cardGesture.current?.pointerId === event.pointerId) cancel();
  };

  const startScroll = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || !track.current || cardGesture.current || scrollGesture.current) return;
    event.preventDefault();
    scrollGesture.current = { pointerId: event.pointerId, x: event.clientX, scrollLeft: track.current.scrollLeft, target: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { scrollGesture.current = null; }
  };
  const moveScroll = (event: PointerEvent<HTMLDivElement>) => {
    const current = scrollGesture.current;
    if (!current || current.pointerId !== event.pointerId || !track.current) return;
    track.current.scrollLeft = current.scrollLeft + current.x - event.clientX;
  };
  const finishScroll = (event: PointerEvent<HTMLDivElement>) => {
    const current = scrollGesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    scrollGesture.current = null; releasePointer(current);
  };

  return <section className={styles.dock} data-warehouse-buddie-dock data-open={open} aria-labelledby={`${id}-title`}>
    <header className={styles.header}>
      <div><h3 id={`${id}-title`}><button ref={toggle} type="button" className={styles.toggle} data-warehouse-buddie-toggle aria-expanded={open} aria-controls={`${id}-panel`} aria-label={`${open ? "Replier" : "Ouvrir"} le carrousel des Buddies`} onClick={changeOpen}><span>Mes Buddies <small>{owned.length}</small></span>{open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}</button></h3>{open && <p role="status" aria-live="polite">{!buddies ? "Chargement…" : ghost ? "Relâche dans une zone" : selectedCode ? "Choisis une zone" : "Glisse une carte sur le plan"}</p>}</div>
      {open && <div className={styles.actions}>
        {selectedCode && <button type="button" aria-label="Annuler la sélection du Buddie" onClick={() => cancel()}><X size={16} /></button>}
        <button type="button" data-warehouse-buddie-scroll-by="previous" aria-label="Buddies précédents" aria-controls={`${id}-cards`} disabled={!scroll.previous} onClick={() => scrollBy(-1)}><ChevronLeft size={19} /></button>
        <button type="button" data-warehouse-buddie-scroll-by="next" aria-label="Buddies suivants" aria-controls={`${id}-cards`} disabled={!scroll.next} onClick={() => scrollBy(1)}><ChevronRight size={19} /></button>
      </div>}
    </header>
    <div id={`${id}-panel`} hidden={!open}>
    <div ref={track} className={styles.track} id={`${id}-cards`} data-warehouse-buddie-carousel role="region" aria-roledescription="carrousel" aria-label="Tes cartes Buddies" tabIndex={0} onKeyDown={scrollKey} onScroll={measureScroll}>
      <div className={styles.cards} role="list">{owned.map(buddie => {
        const run = runs.find(item => item.buddieCode === buddie.code);
        const remaining = getKqBuddieRotationRemaining(buddie.code, buddies?.buddieRotation?.recentBuddieCodes ?? []);
        const assigned = zones.find(zone => zone.buddieCode === buddie.code);
        const blocked = disabled ? "disabled" : run ? "active" : remaining ? "rotation" : undefined;
        const status = run ? "En culture" : remaining ? `Rotation · ${remaining}` : assigned ? assigned.name : "Disponible";
        const reason = disabled ? "Indisponible pour le moment" : run ? "Déjà en culture" : remaining ? `Joue ${remaining} autre${remaining > 1 ? "s" : ""} Buddie${remaining > 1 ? "s" : ""}` : status;
        return <div key={buddie.code} role="listitem" className={styles.slot}>
          <button type="button" className={styles.card} data-warehouse-buddie-card={buddie.code} data-buddie-blocked={blocked} data-selected={selectedCode === buddie.code && !blocked || undefined} data-dragging={ghost?.code === buddie.code || undefined}
            disabled={!!blocked} aria-pressed={selectedCode === buddie.code && !blocked} aria-label={`${blocked ? "Indisponible" : "Prendre"} : ${buddie.name}`} aria-describedby={`${id}-${buddie.code}-status`} title={`${buddie.name} · ${reason}`}
            onPointerDown={event => { if (!blocked) startCard(event, buddie.code); }} onPointerMove={moveCard} onPointerUp={finishCard} onPointerCancel={cancelCard} onLostPointerCapture={cancelCard}
            onDragStart={event => event.preventDefault()} onContextMenu={event => event.preventDefault()}
            onClick={event => {
              if (event.detail > 0 && suppressedClick.current?.code === buddie.code && performance.now() < suppressedClick.current.until) { suppressedClick.current = null; event.preventDefault(); event.stopPropagation(); return; }
              onPick(selectedCode === buddie.code ? null : buddie.code);
            }}>
            <span className={styles.artwork} aria-hidden="true"><Artwork buddie={buddie} /></span>
            <strong>{buddie.name}</strong><span className={styles.status} id={`${id}-${buddie.code}-status`}>{blocked && <LockKeyhole size={10} aria-hidden="true" />}{status}</span>
          </button>
        </div>;
      })}</div>
      {!owned.length && <p className={styles.empty}>{buddies ? "Tes cartes de collection apparaîtront ici." : "Chargement de tes cartes…"}</p>}
    </div>
    <div className={styles.scrollBand} data-warehouse-buddie-scroll role="scrollbar" aria-label="Faire défiler les Buddies" aria-controls={`${id}-cards`} aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scroll.percent} tabIndex={owned.length ? 0 : -1}
      onKeyDown={scrollKey} onPointerDown={startScroll} onPointerMove={moveScroll} onPointerUp={finishScroll} onPointerCancel={finishScroll} onLostPointerCapture={finishScroll}>
      <GripHorizontal size={15} aria-hidden="true" /><span>Défiler</span><span className={styles.scrollMeter} aria-hidden="true"><i style={{ left: `${scroll.percent * .8}%` }} /></span>
    </div>
    </div>
    {ghost && draggedBuddie && typeof document !== "undefined" ? createPortal(<div className={styles.ghost} data-warehouse-buddie-ghost={ghost.code} aria-hidden="true" style={{ left: Math.max(8, Math.min(ghost.point.x + 16, window.innerWidth - 96)), top: Math.max(8, ghost.point.y - 144) }}><Artwork buddie={draggedBuddie} /></div>, document.fullscreenElement ?? document.body) : null}
  </section>;
}
