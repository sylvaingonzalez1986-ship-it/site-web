"use client";

import { ExternalLink, Sprout, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getKqBuddieVariety } from "@/lib/kanab-quest-buddie-varieties";
import type { KqBuddie } from "@/lib/kanab-quest-game";
import { rarityLabels } from "@/lib/lottery-card-ui";
import { KqBuddieFlavors } from "./KqBuddieFlavors";
import styles from "./KqBuddieVarietyPopover.module.css";

type Props = {
  id: string;
  buddie: KqBuddie;
  anchor: HTMLElement;
  trigger: HTMLElement;
  onClose: () => void;
  onChoose?: () => void;
  chooseLabel?: string;
  unavailableReason?: string;
};

/** A non-modal reading card. The carousel remains usable underneath it. */
export function KqBuddieVarietyPopover({ id, buddie, anchor, trigger, onClose, onChoose, chooseLabel = "Choisir ce Buddie", unavailableReason }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeCallback = useRef(onClose);
  const variety = getKqBuddieVariety(buddie.code);

  useLayoutEffect(() => { closeCallback.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;

    // A scrolled preparation carousel may be at the very top of the screen.
    // Reveal a little space above it without locking page or fullscreen scrolling.
    const desiredSpace = Math.min(520, window.innerHeight * .65);
    if (anchor.getBoundingClientRect().top < desiredSpace) {
      let parent = anchor.parentElement;
      while (parent && anchor.getBoundingClientRect().top < desiredSpace) {
        if (parent.scrollTop > 0 && /(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
          parent.scrollBy({ top: anchor.getBoundingClientRect().top - desiredSpace, behavior: "instant" });
        }
        parent = parent.parentElement;
      }
      if (anchor.getBoundingClientRect().top < desiredSpace && window.scrollY > 0) {
        window.scrollBy({ top: anchor.getBoundingClientRect().top - desiredSpace, behavior: "instant" });
      }
    }

    const place = () => {
      if (!anchor.isConnected || !trigger.isConnected) { closeCallback.current(); return; }
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const bounds = anchor.getBoundingClientRect();
      const width = Math.min(490, viewportWidth - 16);
      const bottom = Math.min(bounds.top - 8, viewportTop + viewportHeight - 8);
      const availableHeight = Math.max(80, bottom - viewportTop - 8);
      element.style.width = `${width}px`;
      element.style.maxHeight = `${Math.min(580, availableHeight)}px`;
      element.dataset.compactHeight = String(availableHeight < 230);
      element.style.left = `${Math.max(viewportLeft + 8, Math.min(bounds.left + bounds.width / 2 - width / 2, viewportLeft + viewportWidth - width - 8))}px`;
      element.style.top = `${Math.max(viewportTop + 8, bottom - element.getBoundingClientRect().height)}px`;
      element.style.visibility = "visible";
    };
    // Top-layer rendering also works above the warehouse's fullscreen plan.
    if (typeof element.showPopover === "function" && !element.matches(":popover-open")) element.showPopover();
    place();
    closeButton.current?.focus({ preventScroll: true });

    const outside = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !element.contains(target) && !trigger.contains(target)) closeCallback.current();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeCallback.current();
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    };
    const fullscreen = () => closeCallback.current();
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    observer.observe(element);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", escape, true);
    document.addEventListener("fullscreenchange", fullscreen);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", escape, true);
      document.removeEventListener("fullscreenchange", fullscreen);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchor, trigger]);

  if (typeof document === "undefined") return null;

  const close = () => {
    onClose();
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  };

  return createPortal(<div ref={panel} id={id} popover="manual" role="dialog" aria-labelledby={`${id}-title`} className={styles.popover} data-buddie-variety-popover={buddie.code}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>La fiche du Buddie · {rarityLabels[buddie.rarity]}</span><h3 id={`${id}-title`}>{buddie.name}</h3></div>
      <button ref={closeButton} type="button" className={styles.close} data-buddie-variety-close aria-label={`Fermer la fiche de ${buddie.name}`} onClick={close}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className={styles.body}>
      <section className={styles.flavors} aria-label="Les goûts du Buddie">
        <KqBuddieFlavors varietyCode={buddie.code} compact />
        <p className={styles.flavorNote}>Deux notes retenues pour le jeu. Le profil varie selon la sélection.</p>
      </section>
      {variety ? <>
        <span className={styles.identity}>{variety.identity === "documented" ? "Variété documentée" : variety.identity === "commercial-name" ? "Nom commercial" : "Création de Kanab Quest"}</span>
        <p className={styles.summary}>{variety.summary}</p>
        <section className={styles.story}><h4>Son histoire</h4><p>{variety.history}</p></section>
        <dl className={styles.origins}><div><dt>Origine</dt><dd>{variety.origin}</dd></div><div><dt>Lignée</dt><dd>{variety.lineage}</dd></div></dl>
        <section className={styles.traits}><h4>Ce qui la caractérise</h4><ul>{variety.characteristics.map(characteristic => <li key={characteristic}><Sprout size={15} aria-hidden="true" /><span>{characteristic}</span></li>)}</ul></section>
        {variety.caveat && <p className={styles.caveat}>{variety.caveat}</p>}
        {variety.sources.length > 0 && <details className={styles.sources}><summary>Sources de la fiche</summary><ul>{variety.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={12} aria-hidden="true" /></a></li>)}</ul></details>}
      </> : <p className={styles.summary}>L’histoire de cette variété arrive bientôt dans le carnet du village.</p>}
    </div>
    <footer className={styles.footer}>
      {unavailableReason ? <p>{unavailableReason}</p> : onChoose && <button type="button" data-buddie-variety-choose onClick={() => { close(); onChoose(); }}><Sprout size={18} aria-hidden="true" />{chooseLabel}</button>}
    </footer>
  </div>, trigger.closest("dialog[open]") ?? document.fullscreenElement ?? document.body);
}
