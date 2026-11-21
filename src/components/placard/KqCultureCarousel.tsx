"use client";

import { useId, useRef, type CSSProperties, type ReactNode, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import { KqActionBadge } from "./KqActionBadge";
import styles from "./KqCultureCarousel.module.css";

export type KqCulturePanelId = "play" | "care" | "cards" | "harvest" | "journal" | "rules" | "charges";
export type KqCulturePanel = { id: KqCulturePanelId; label: string; detail?: string; actionCount?: number | null; content: ReactNode };

const panelArt: Record<KqCulturePanelId, KqPrintedArtKind> = {
  play: "culture-tab-play",
  care: "culture-tab-care",
  cards: "culture-tab-cards",
  harvest: "culture-tab-harvest",
  journal: "culture-tab-journal",
  rules: "culture-tab-rules",
  charges: "help-accounts",
};

/** One visible sheet; hidden sheets remain mounted to preserve forms and receipts. */
export function KqCultureCarousel({ panels, activeId, onChange, disabled = false }: {
  panels: KqCulturePanel[];
  activeId: KqCulturePanelId;
  onChange: (id: KqCulturePanelId) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const currentIndex = Math.max(0, panels.findIndex(panel => panel.id === activeId));
  const current = panels[currentIndex];
  const select = (index: number, focus = false) => {
    if (disabled) return;
    const next = panels[(index + panels.length) % panels.length];
    onChange(next.id);
    const tab = root.current?.querySelector<HTMLButtonElement>(`[data-culture-tab="${next.id}"]`);
    if (focus) tab?.focus({ preventScroll: true });
  };
  const startTouch = (event: TouchEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (disabled || event.touches.length !== 1 || target?.closest("button, a, input, select, textarea, summary, [role=slider], [role=switch], [role=tablist], [data-culture-hand], [data-culture-decision], [data-no-culture-swipe]")) {
      touch.current = null;
      return;
    }
    touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };
  const endTouch = (event: TouchEvent<HTMLElement>) => {
    const start = touch.current;
    touch.current = null;
    if (!start || disabled || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const focusWasInside = !!root.current?.querySelector('[role="tabpanel"]:not([hidden])')?.contains(document.activeElement);
    select(currentIndex + (dx < 0 ? 1 : -1), focusWasInside);
  };
  return <section ref={root} className={styles.carousel} data-culture-carousel aria-label="Parcourir la culture" aria-roledescription="carrousel"
    onTouchStart={startTouch} onTouchEnd={endTouch} onTouchCancel={() => { touch.current = null; }}>
    <div data-culture-navigation>
      <div className={styles.tabs} role="tablist" aria-label="Panneaux de la culture" style={{ "--culture-panel-count": panels.length } as CSSProperties}>
        {panels.map((panel, index) => <button key={panel.id} type="button" role="tab" id={`${id}-tab-${panel.id}`} aria-controls={`${id}-panel-${panel.id}`}
          aria-selected={index === currentIndex} tabIndex={index === currentIndex ? 0 : -1} disabled={disabled}
          data-culture-tab={panel.id} data-sylvain-target={panel.id === "care" && panel.id !== current.id ? "care" : undefined}
          onClick={() => select(index)} onKeyDown={event => {
            const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? panels.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            select(next, true);
          }}>
          <KqPrintedArt kind={panelArt[panel.id]} className={styles.tabArt} sizes="(max-width: 520px) 36px, 56px" />
          <span className={styles.tabText}>
            <span className={styles.tabHeading}><strong>{panel.label}</strong><KqActionBadge count={disabled ? null : panel.actionCount} /></span>
            {panel.detail ? <small>{panel.detail}</small> : null}
          </span>
        </button>)}
      </div>
      <div className={styles.navigation}>
        <button type="button" aria-label="Panneau précédent" data-culture-carousel-prev disabled={disabled} onClick={() => select(currentIndex - 1)}><ChevronLeft aria-hidden="true" /><span>Précédent</span></button>
        <span aria-live="polite" aria-atomic="true"><b>{current.label}</b><small>{currentIndex + 1} / {panels.length}</small></span>
        <button type="button" aria-label="Panneau suivant" data-culture-carousel-next disabled={disabled} onClick={() => select(currentIndex + 1)}><span>Suivant</span><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
    {panels.map((panel, index) => <div key={panel.id} id={`${id}-panel-${panel.id}`} role="tabpanel" aria-labelledby={`${id}-tab-${panel.id}`}
      className={styles.panel} data-culture-panel={panel.id} hidden={index !== currentIndex} inert={index !== currentIndex} tabIndex={0}>
      {panel.content}
    </div>)}
  </section>;
}
