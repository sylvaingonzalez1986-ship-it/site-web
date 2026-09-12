"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./ProducerCarousel.module.css";

export function ProducerCarousel({ itemCount, children }: { itemCount: number; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState({ index: 0, overflowing: false, start: true, end: false });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const cards = Array.from(track.children) as HTMLElement[];
      const offset = cards[0]?.offsetLeft ?? 0;
      let index = 0;
      cards.forEach((card, i) => {
        if (card.offsetLeft - offset <= track.scrollLeft + 8) index = i;
      });
      setPosition({ index, overflowing: track.scrollWidth > track.clientWidth + 2,
        start: track.scrollLeft <= 2, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 });
    };
    const observer = new ResizeObserver(update);
    observer.observe(track);
    Array.from(track.children).forEach((child) => observer.observe(child));
    track.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); track.removeEventListener("scroll", update); };
  }, [itemCount]);

  function move(direction: number) {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    const target = cards[Math.max(0, Math.min(cards.length - 1, position.index + direction))];
    if (target) track.scrollTo({ left: target.offsetLeft - cards[0].offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return (
    <section className={styles.carousel} aria-label="Les producteurs">
      <div className={styles.header}>
        <div><p className={styles.eyebrow}>Du champ à la boutique</p>
          <p className={styles.heading}>Rencontrez les producteurs</p></div>
        <span className={styles.count}>{itemCount} producteur{itemCount > 1 ? "s" : ""}</span>
      </div>
      <div id={id} ref={trackRef} className={`${styles.track} ${itemCount < 3 ? styles.few : ""}`}
        tabIndex={position.overflowing ? 0 : undefined} aria-label="Fiches des producteurs"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}>
        {children}
      </div>
      {position.overflowing && <div className={styles.controls}>
        <span>Faites défiler pour découvrir les producteurs</span>
        <div className={styles.buttons}>
          <button type="button" aria-label="Producteur précédent" aria-controls={id} disabled={position.start} onClick={() => move(-1)}><ArrowLeft size={20} /></button>
          <button type="button" aria-label="Producteur suivant" aria-controls={id} disabled={position.end} onClick={() => move(1)}><ArrowRight size={20} /></button>
        </div>
      </div>}
    </section>
  );
}
