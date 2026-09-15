"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { KqHeritageCard } from "@/lib/kanab-quest-heritage";
import styles from "./KqHeritageCarousel.module.css";

type Props = {
  cards: readonly KqHeritageCard[];
  ownedCodes: string[];
  ownershipRequired: boolean;
  producerNames: Record<string, string[]>;
  selectedCode: string;
  onSelect: (code: string) => void;
  renderArtwork: (card: KqHeritageCard, producerLabel?: string) => ReactNode;
};

export function KqHeritageCarousel({ cards, ownedCodes, ownershipRequired, producerNames, selectedCode, onSelect, renderArtwork }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const update = () => {
      const start = node.scrollLeft < 2, end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 2;
      setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); node.removeEventListener("scroll", update); };
  }, [cards.length]);

  function move(direction: number) {
    const node = track.current;
    if (!node) return;
    const first = node.children[0] as HTMLElement | undefined;
    const second = node.children[1] as HTMLElement | undefined;
    const step = first && second ? second.offsetLeft - first.offsetLeft : node.clientWidth;
    node.scrollBy({ left: direction * step * Math.max(1, Math.floor(node.clientWidth / step)), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <section className={styles.section} aria-labelledby="heritage-carousel-title">
    <header className={styles.header}>
      <h2 id="heritage-carousel-title">Héritage</h2>
      <nav aria-label="Faire défiler les cartes Héritage">
        <button type="button" aria-label="Voir les cartes Héritage précédentes" disabled={edges.start} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
        <button type="button" aria-label="Voir les cartes Héritage suivantes" disabled={edges.end} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
      </nav>
    </header>
    <div ref={track} className={styles.track} role="list" tabIndex={0} aria-label="Cartes Héritage producteur"
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
      }}
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => {
        suppressClick.current = false;
        if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
        drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={event => {
        const gesture = drag.current;
        if (!gesture) return;
        const distance = event.clientX - gesture.x;
        if (!gesture.moved && Math.abs(distance) < 6) return;
        if (!gesture.moved) { gesture.moved = true; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.dragging = "true"; }
        event.currentTarget.scrollLeft = gesture.scroll - distance;
      }}
      onPointerUp={event => {
        suppressClick.current = Boolean(drag.current?.moved);
        drag.current = null; delete event.currentTarget.dataset.dragging;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={event => { drag.current = null; delete event.currentTarget.dataset.dragging; }}
      onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      {cards.map(card => {
        const owned = ownedCodes.includes(card.code), locked = ownershipRequired && !owned, selected = selectedCode === card.code;
        const names = producerNames[card.code] ?? [];
        const producer = names.length ? names.join(" · ") : card.producerName || (owned ? "Héritage assemblé" : undefined);
        return <article key={card.code} role="listitem" className={styles.card} data-selected={selected || undefined} data-locked={locked || undefined}>
          <div className={styles.artwork}>{renderArtwork(card, producer)}{selected ? <span className={styles.equipped}><Check size={14} aria-hidden="true" /> Équipé</span> : null}</div>
          <span className={styles.timing}>{card.timing === "passive" ? "Pouvoir permanent" : "1 fois par culture"}</span>
          <h3>{card.name}</h3>
          <p>{card.description}</p>
          <button type="button" disabled={locked} aria-pressed={selected} aria-label={`${locked ? "Non possédée" : selected ? "Équipée" : "Équiper"} : ${producer ?? card.name}`} onClick={() => onSelect(card.code)}>{locked ? "Non possédée" : selected ? "Équipée" : "Équiper"}</button>
        </article>;
      })}
    </div>
    {!cards.length ? <p className={styles.empty}>Les cartes Héritage seront bientôt disponibles.</p> : null}
    <button type="button" className={styles.classic} aria-pressed={!selectedCode} onClick={() => onSelect("")}>{!selectedCode ? <Check size={16} aria-hidden="true" /> : null} Sans Héritage</button>
  </section>;
}
