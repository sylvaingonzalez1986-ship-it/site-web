"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./KqCardCarousel.module.css";

type Props = { id: string; title: string; label: string; count: number; children: ReactNode; intro?: ReactNode; footer?: ReactNode; resetKey?: string; tourStep?: string; className?: string; preservePosition?: boolean; showPosition?: boolean };
export function KqCardCarousel({ id, title, label, count, children, intro, footer, resetKey, tourStep, className = "", preservePosition = false, showPosition = false }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: true, position: count ? 1 : 0 });

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const update = () => {
      const start = node.scrollLeft < 2, end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 2;
      const children = Array.from(node.children) as HTMLElement[];
      const first = children[0];
      const position = first ? children.reduce((best, child, index) => Math.abs(child.offsetLeft - first.offsetLeft - node.scrollLeft) < Math.abs(children[best].offsetLeft - first.offsetLeft - node.scrollLeft) ? index : best, 0) + 1 : 0;
      setEdges(previous => previous.start === start && previous.end === end && previous.position === position ? previous : { start, end, position });
    };
    if (!preservePosition) node.scrollTo({ left: 0, behavior: "instant" });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); node.removeEventListener("scroll", update); };
  }, [count, resetKey, preservePosition]);

  function move(direction: number) {
    const node = track.current;
    if (!node) return;
    const first = node.children[0] as HTMLElement | undefined;
    const second = node.children[1] as HTMLElement | undefined;
    const step = first && second ? second.offsetLeft - first.offsetLeft : node.clientWidth;
    node.scrollBy({ left: direction * step * Math.max(1, Math.floor(node.clientWidth / step)), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <section className={`${styles.section} ${className}`} aria-labelledby={id}>
    <header className={styles.header}>
      <h2 id={id} tabIndex={-1} data-arena-tour={tourStep}>{title}</h2>
      <nav aria-label={`Faire défiler ${label}`}>
        <button type="button" aria-label={`Voir les cartes précédentes : ${label}`} disabled={edges.start} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
        {showPosition ? <span className={styles.position} role="status" aria-label={`Carte ${edges.position} sur ${count}`}>{edges.position} / {count}</span> : null}
        <button type="button" aria-label={`Voir les cartes suivantes : ${label}`} disabled={edges.end} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
      </nav>
    </header>
    {intro}
    <div ref={track} className={styles.track} role="list" tabIndex={0} aria-label={label}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
      }}
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => {
        suppressClick.current = false;
        if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest("button:not([data-carousel-drag]), a, input, select, textarea, summary")) return;
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
      {children}
    </div>
    {footer}
  </section>;
}
