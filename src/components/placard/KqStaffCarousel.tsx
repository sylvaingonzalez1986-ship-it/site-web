"use client";

import { useId, useLayoutEffect, useRef, type ReactNode, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import { KqActionBadge } from "./KqActionBadge";
import styles from "./KqStaffCarousel.module.css";

export type KqStaffPanelId = "overview" | "team" | "planning" | "production" | "candidates" | "payroll";
export type KqStaffPanel = { id: KqStaffPanelId; label: string; art: KqPrintedArtKind; actionCount?: number; content: ReactNode };

/** Keep drafts mounted; only the current sheet participates in layout and focus. */
export function KqStaffCarousel({ panels, activeId, onChange, disabled }: {
  panels: KqStaffPanel[]; activeId: KqStaffPanelId; onChange: (id: KqStaffPanelId) => void; disabled: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const previous = useRef(activeId);
  const currentIndex = Math.max(0, panels.findIndex(panel => panel.id === activeId));
  const current = panels[currentIndex];

  useLayoutEffect(() => {
    const shell = root.current?.closest("[data-placard-view]");
    if (!shell) return;
    const content = root.current?.closest("[data-placard-stage]")?.parentElement ?? shell;
    const header = content.querySelector<HTMLElement>(":scope > header");
    const guide = shell.querySelector<HTMLElement>("[data-farm-guide-anchor]");
    const update = () => {
      let top = header && ["sticky", "fixed"].includes(getComputedStyle(header).position) ? Math.ceil(header.getBoundingClientRect().height) + 8 : 8;
      if (guide?.checkVisibility() && getComputedStyle(guide).position === "sticky") {
        top = Math.max(top, (parseFloat(getComputedStyle(guide).top) || 0) + Math.ceil(guide.getBoundingClientRect().height) + 8);
      }
      root.current?.style.setProperty("--staff-carousel-top", `${top}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    if (header) observer.observe(header);
    if (guide) observer.observe(guide);
    const changes = new MutationObserver(update);
    if (guide) changes.observe(guide, { attributes: true, attributeFilter: ["data-expanded", "style"], childList: true });
    return () => { observer.disconnect(); changes.disconnect(); };
  }, []);

  useLayoutEffect(() => {
    const tab = root.current?.querySelector<HTMLButtonElement>(`[data-staff-tab="${current.id}"]`);
    const row = tab?.parentElement;
    if (tab && row) {
      const left = tab.offsetLeft - row.scrollLeft;
      const right = left + tab.offsetWidth;
      if (left < 8) row.scrollLeft += left - 8;
      else if (right > row.clientWidth - 8) row.scrollLeft += right - row.clientWidth + 8;
    }
    // A short new sheet must not leave the reader at the former sheet's bottom.
    if (previous.current !== current.id && root.current && controls.current) {
      const top = parseFloat(getComputedStyle(controls.current).top) || 8;
      if (root.current.getBoundingClientRect().top < top) root.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
    previous.current = current.id;
  }, [current.id]);

  function select(index: number, focus = false) {
    if (disabled) return;
    const next = panels[(index + panels.length) % panels.length];
    onChange(next.id);
    if (focus) root.current?.querySelector<HTMLButtonElement>(`[data-staff-tab="${next.id}"]`)?.focus({ preventScroll: true });
  }
  function startTouch(event: TouchEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;
    touch.current = null;
    // These areas already use gestures, scrolling or editable controls.
    if (disabled || event.touches.length !== 1 || target?.closest("button, a, input, select, textarea, summary, form, dialog, [role=tablist], [role=slider], [data-staff-work-plan], [data-production-flow], [data-staff-weekly-planner], [data-no-staff-swipe]")) return;
    for (let node = target; node && node !== root.current; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
    }
    touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  function endTouch(event: TouchEvent<HTMLElement>) {
    const start = touch.current;
    touch.current = null;
    if (!start || disabled || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    select(currentIndex + (dx < 0 ? 1 : -1), !!root.current?.querySelector(`[data-staff-panel="${current.id}"]`)?.contains(document.activeElement));
  }

  return <section ref={root} className={styles.carousel} data-staff-carousel aria-label="Parcourir le personnel" aria-roledescription="carrousel"
    onTouchStart={startTouch} onTouchEnd={endTouch} onTouchCancel={() => { touch.current = null; }}>
    <div ref={controls} className={styles.controls} data-staff-carousel-controls>
      <div className={styles.tabs} role="tablist" aria-label="Panneaux du personnel">
        {panels.map((panel, index) => <button key={panel.id} type="button" role="tab" id={`${id}-tab-${panel.id}`} aria-controls={`${id}-panel-${panel.id}`}
          data-staff-tab={panel.id} aria-selected={index === currentIndex} tabIndex={index === currentIndex ? 0 : -1} disabled={disabled}
          onClick={() => select(index)} onKeyDown={event => {
            const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? panels.length - 1 : null;
            if (next === null) return;
            event.preventDefault(); select(next, true);
          }}>
          <KqPrintedArt kind={panel.art} className={styles.art} sizes="48px" /><strong>{panel.label}</strong><KqActionBadge count={panel.actionCount} />
        </button>)}
      </div>
      <div className={styles.navigation}>
        <button type="button" data-staff-carousel-prev aria-label="Panneau précédent" disabled={disabled} onClick={() => select(currentIndex - 1)}><ChevronLeft aria-hidden="true" /><span>Précédent</span></button>
        <span aria-live="polite" aria-atomic="true"><b>{current.label}</b><small>{currentIndex + 1} / {panels.length}</small></span>
        <button type="button" data-staff-carousel-next aria-label="Panneau suivant" disabled={disabled} onClick={() => select(currentIndex + 1)}><span>Suivant</span><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
    {panels.map((panel, index) => <div key={panel.id} id={`${id}-panel-${panel.id}`} role="tabpanel" aria-labelledby={`${id}-tab-${panel.id}`}
      className={styles.panel} data-staff-panel={panel.id} hidden={index !== currentIndex} inert={index !== currentIndex} tabIndex={0}>
      {panel.content}
    </div>)}
  </section>;
}
