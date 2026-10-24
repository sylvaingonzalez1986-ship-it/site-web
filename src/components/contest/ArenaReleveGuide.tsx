"use client";

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Compass, MousePointer2, ScanLine } from 'lucide-react';
import type { ReleveGuideStep } from '@/lib/arena-releve-guide';
import styles from './ArenaReleveGuide.module.css';

type Target = { step: ReleveGuideStep; element: HTMLElement; host: HTMLDialogElement; ready: boolean };
type Rect = { left: number; top: number; width: number; height: number };
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');
const GuideMode = createContext<{ free: boolean; setFree: (free: boolean) => void } | null>(null);

/** Keep the player's free-exploration choice when the coach enters a nested dialog. */
export function ReleveGuideProvider({ children }: { children: ReactNode }) {
  const [free, setFree] = useState(false);
  return <GuideMode value={{ free, setFree }}>{children}</GuideMode>;
}

function findTarget(host: HTMLDialogElement, steps: ReleveGuideStep[]): Target | null {
  const foreground = Array.from(host.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(element => element.getClientRects().length && !element.closest('[hidden]')).at(-1);
  for (const step of steps) {
    const scopes = step.scope && !host.closest(step.scope) ? Array.from(host.querySelectorAll(step.scope)) : [host];
    for (const scope of scopes) {
      const selector = step.selector ?? (step.kind === 'element' ? '[tabindex],button,summary,input,select' : step.kind ?? 'button');
      const element = Array.from(scope.querySelectorAll<HTMLElement>(selector)).find(candidate => {
        if (foreground && !foreground.contains(candidate)) return false;
        if (!candidate.getClientRects().length || candidate.closest(':disabled,[aria-disabled="true"],[inert],[hidden]')) return false;
        if (typeof candidate.checkVisibility === 'function' && !candidate.checkVisibility()) return false;
        for (let parent = candidate.parentElement; parent && parent !== host; parent = parent.parentElement) {
          if (parent.matches('details:not([open])') && !parent.querySelector(':scope > summary')?.contains(candidate)) return false;
        }
        if (candidate.closest('dialog') !== host || getComputedStyle(candidate).visibility === 'hidden') return false;
        if (!step.selector && candidate.closest('[data-releve-guide-card]')) return false;
        return !step.text || normalize(`${candidate.textContent ?? ''} ${candidate.getAttribute('aria-label') ?? ''}`).includes(normalize(step.text));
      });
      if (element) return { step, element, host, ready: !step.checkpoint?.readySelector || !!scope.querySelector(step.checkpoint.readySelector) };
    }
  }
  return null;
}

/** Follows the actual game UI, including its native confirmation dialogs. */
export function ArenaReleveGuide({ steps, instruction, complete = false, children, enabled = true, compact = false, paced = false, onAcknowledgeStep }: {
  steps: ReleveGuideStep[]; instruction: string; complete?: boolean; children?: ReactNode; enabled?: boolean; compact?: boolean;
  paced?: boolean; onAcknowledgeStep?: (id: string) => void;
}) {
  const anchor = useRef<HTMLElement>(null);
  const latest = useRef(steps);
  const [target, setTarget] = useState<Target | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const mode = useContext(GuideMode);
  const [localFree, setLocalFree] = useState(false);
  const free = mode?.free ?? localFree, setFree = mode?.setFree ?? setLocalFree;
  useEffect(() => { latest.current = steps; });
  useEffect(() => {
    const floating = anchor.current?.closest<HTMLElement>('[data-releve-floating-guide]');
    if (!floating) return;
    floating.dataset.guideFree = String(free && !complete);
    return () => { delete floating.dataset.guideFree; };
  }, [free, complete]);

  useEffect(() => {
    const owner = anchor.current?.closest('dialog');
    if (!owner || !enabled) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
        const host = dialogs.at(-1);
        const next = !free && host && (host === owner || owner.contains(host)) ? findTarget(host, latest.current) : null;
        setTarget(current => current?.element === next?.element && current?.host === next?.host
          && current?.step.id === next?.step.id && current?.step.instruction === next?.step.instruction && current?.ready === next?.ready ? current : next);
      });
    };
    const observer = new MutationObserver(records => {
      if (records.every(record => record.target instanceof Element && record.target.closest('[data-releve-guide-card],[data-releve-spotlight]'))) return;
      sync();
    });
    // Journal dialogs live outside the game dialog. beforetoggle also catches
    // their close before React unmounts them and the queued toggle loses its document path.
    const syncDialog = (event: Event) => { if (event.target instanceof HTMLDialogElement) sync(); };
    observer.observe(owner, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['open', 'disabled', 'aria-disabled', 'aria-expanded', 'aria-pressed', 'data-screen', 'data-releve-workshop', 'value', 'class', 'hidden', 'checked', 'data-notebook-mode-confirmed', 'data-notebook-evaluated', 'data-notebook-filled'] });
    owner.addEventListener('input', sync);
    owner.addEventListener('change', sync);
    owner.addEventListener('toggle', sync, true);
    owner.addEventListener('click', sync);
    document.addEventListener('beforetoggle', syncDialog, true);
    document.addEventListener('toggle', syncDialog, true);
    sync();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); owner.removeEventListener('input', sync); owner.removeEventListener('change', sync); owner.removeEventListener('toggle', sync, true); owner.removeEventListener('click', sync); document.removeEventListener('beforetoggle', syncDialog, true); document.removeEventListener('toggle', syncDialog, true); };
  }, [steps, free, enabled]);

  useEffect(() => {
    if (!target || !enabled || free) return;
    const { element, host, step } = target;
    const notebookViewport = paced ? element.closest<HTMLElement>('[data-tasting-scroll]') : null;
    element.setAttribute('data-releve-guide-active', step.id);
    let frame = 0;
    let revealFrame = 0;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      // Stay out of the native dialog's grid/flex layout. The floating coach
      // moves to the other edge when the player uses a low confirmation button.
      const floating = anchor.current?.closest<HTMLElement>('[data-releve-floating-guide]');
      if (floating) floating.dataset.side = !anchor.current?.contains(element) && bounds.top + bounds.height / 2 > innerHeight / 2 ? 'top' : 'bottom';
      const card = anchor.current?.getBoundingClientRect();
      const headerElement = host.querySelector('header'), hudElement = host.querySelector('[data-releve-hud]');
      const header = element.closest(':popover-open') || headerElement?.contains(element) ? null : headerElement?.getBoundingClientRect();
      const hud = element.closest(':popover-open') || hudElement?.contains(element) ? null : hudElement?.getBoundingClientRect();
      const coachAbove = card && card.bottom <= bounds.top;
      const top = Math.max(bounds.top - 5, (header?.bottom ?? 0) + 2, hud?.bottom ?? 0, coachAbove ? card.bottom + 5 : 4);
      const bottom = Math.min(bounds.bottom + 5, card && !coachAbove && !anchor.current?.contains(element) ? card.top - 5 : innerHeight - 4);
      const left = Math.max(4, bounds.left - 5), right = Math.min(innerWidth - 4, bounds.right + 5);
      const next = bottom > top && right > left ? { top, left, width: right - left, height: bottom - top } : null;
      setRect(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    // The Carnet has its own clipped page between a tab bar and a footer.
    // Keep the target inside that page after the coach changes height. Scrolling
    // every ancestor smoothly can otherwise leave it underneath the footer.
    const revealNotebookTarget = () => {
      if (!notebookViewport || document.activeElement?.matches('textarea,input[type="text"]')) return;
      const bounds = element.getBoundingClientRect(), viewport = notebookViewport.getBoundingClientRect();
      const footer = element.closest('[data-notebook-page]')?.querySelector('[data-notebook-footer]')?.getBoundingClientRect();
      const card = anchor.current?.getBoundingClientRect();
      const above = anchor.current?.closest<HTMLElement>('[data-releve-floating-guide]')?.dataset.side === 'top';
      const top = Math.max(0, viewport.top, above ? card?.bottom ?? 0 : 0) + 12;
      const bottom = Math.min(innerHeight, viewport.bottom, footer?.top ?? innerHeight, !above ? card?.top ?? innerHeight : innerHeight) - 12;
      if (bottom <= top || (bounds.top >= top && bounds.bottom <= bottom)) return;
      const destination = bounds.height <= bottom - top ? (top + bottom - bounds.height) / 2 : top;
      notebookViewport.scrollBy({ top: bounds.top - destination, behavior: 'instant' });
    };
    // Scroll events may arrive during a resize. They must not cancel the
    // correction scheduled for the new viewport or coach dimensions.
    const resized = () => { cancelAnimationFrame(revealFrame); revealFrame = requestAnimationFrame(() => { measure(); if (notebookViewport) { revealNotebookTarget(); measure(); } }); };
    // Keep typing uninterrupted. The next control is still highlighted as it becomes available.
    const typing = document.activeElement?.matches('textarea,select,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])');
    if (!typing && !notebookViewport && !anchor.current?.contains(element)) {
      const bounds = element.getBoundingClientRect();
      const header = host.querySelector('header'), hud = host.querySelector('[data-releve-hud]');
      const top = element.closest(':popover-open') ? 0 : Math.max(0, header?.contains(element) ? 0 : header?.getBoundingClientRect().bottom ?? 0, hud?.contains(element) ? 0 : hud?.getBoundingClientRect().bottom ?? 0);
      const floating = anchor.current?.closest('[data-releve-floating-guide]');
      const fixedBars = Array.from(host.querySelectorAll<HTMLElement>('[data-culture-actionbar],nav[aria-label="Accès rapides de Kanab Quest"]'))
        .filter(bar => bar.getClientRects().length && getComputedStyle(bar).position === 'fixed' && !bar.contains(element));
      const bottom = Math.min(floating ? innerHeight : anchor.current?.getBoundingClientRect().top ?? innerHeight, ...fixedBars.map(bar => bar.getBoundingClientRect().top));
      const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      // Center horizontal card carousels so their snap points cannot pull the
      // next card back out of view; keep vertical movement to the minimum.
      const covered = !!hit && !element.contains(hit);
      const outside = bounds.top < top + 12 || bounds.bottom > bottom - 12;
      if (outside || bounds.left < 8 || bounds.right > innerWidth - 8 || !hit || covered) element.scrollIntoView({ block: covered || outside ? 'center' : 'nearest', inline: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    const observer = new ResizeObserver(resized);
    observer.observe(element);
    if (anchor.current) observer.observe(anchor.current);
    if (notebookViewport) observer.observe(notebookViewport);
    window.addEventListener('resize', resized);
    if (notebookViewport) window.visualViewport?.addEventListener('resize', resized);
    document.addEventListener('scroll', schedule, true);
    host.addEventListener('animationend', schedule, true);
    host.addEventListener('transitionend', schedule, true);
    resized();
    return () => { if (element.getAttribute('data-releve-guide-active') === step.id) element.removeAttribute('data-releve-guide-active'); cancelAnimationFrame(frame); cancelAnimationFrame(revealFrame); observer.disconnect(); window.removeEventListener('resize', resized); window.visualViewport?.removeEventListener('resize', resized); document.removeEventListener('scroll', schedule, true); host.removeEventListener('animationend', schedule, true); host.removeEventListener('transitionend', schedule, true); };
  }, [target, enabled, free, paced]);

  const show = () => {
    if (free) { setFree(false); return; }
    if (!target) return;
    target.element.scrollIntoView({ block: 'center', inline: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    (target.element.closest<HTMLElement>('button,a[href],input,select,summary') ?? target.element).focus({ preventScroll: true });
  };
  const active = enabled && !free ? target : null;
  return <>
    <aside ref={anchor} className={`${styles.coach}${compact ? ` ${styles.compact}` : ''}${paced ? ` ${styles.paced}` : ''}`} data-releve-guide-card data-releve-coach data-guide-step={active?.step.id ?? (complete ? 'complete' : 'waiting')} data-complete={complete || undefined} data-free={free || undefined}>
      <div className={styles.portrait}><Image src="/sylvain.png" alt="Sylvain, ton guide" width={96} height={96} sizes={compact ? '48px' : '80px'} /></div>
      <div className={styles.message}>
        {compact ? <><strong>{paced && active ? active.step.title : 'Sylvain'}</strong>{paced && active?.step.progressLabel ? <span className={styles.lessonProgress}>Sylvain · {active.step.progressLabel}</span> : null}</> : <><span className={styles.eyebrow}>{complete ? <Check size={14} aria-hidden="true" /> : <MousePointer2 size={14} aria-hidden="true" />} Sylvain · {complete ? 'Bien joué !' : free ? 'À ton rythme' : 'On joue ensemble'}</span>
          <strong>{active?.step.title ?? (complete ? 'Cette étape est réussie' : 'À toi de jouer')}</strong></>}
        <p role="status" aria-live="polite">{free ? compact ? 'Explore à ton rythme. Je reste là pour te guider.' : 'Explore librement. Je garde ta progression ; reprends le guidage quand tu veux.' : active?.step.instruction ?? instruction}</p>
      </div>
      <div className={styles.actions}>
        {active?.step.checkpoint && onAcknowledgeStep ? <button type="button" className={styles.acknowledge} data-releve-acknowledge disabled={!active.ready} onClick={() => onAcknowledgeStep(active.step.id)}>{active.ready ? active.step.checkpoint.label : active.step.checkpoint.pendingLabel ?? 'À toi de remplir'}<ArrowRight size={16} aria-hidden="true" /></button> : null}
        {!complete ? <button type="button" className={styles.show} onClick={show} disabled={!active && !free} aria-label={compact ? free ? 'Reprendre le guidage' : 'Aide : me montrer' : undefined} title={free ? 'Reprendre le guidage' : 'Me montrer'}><ScanLine size={17} aria-hidden="true" /><span className={compact ? styles.controlLabel : undefined}>{free ? 'Reprendre le guidage' : compact ? 'Aide' : 'Me montrer'}</span></button> : null}
        {!complete && !free ? <button type="button" className={compact ? styles.freeIcon : styles.free} onClick={() => setFree(true)} aria-label="Explorer librement" title="Explorer librement">{compact ? <Compass size={17} aria-hidden="true" /> : null}<span className={compact ? styles.controlLabel : undefined}>{compact ? 'Explorer' : 'Explorer librement'}</span></button> : null}
        {children}
      </div>
    </aside>
    {active && rect ? createPortal(<div className={styles.spotlight} data-releve-spotlight aria-hidden="true" style={rect}><span><MousePointer2 size={17} />À toi</span></div>, active.element.closest(':popover-open') ?? active.host) : null}
  </>;
}
