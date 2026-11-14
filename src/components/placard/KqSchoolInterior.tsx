"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import styles from "./KqSchoolInterior.module.css";

export type KqSchoolInteriorSection = "learn" | "quiz" | "workshops";
export type KqSchoolInteriorSprite = Readonly<{
  id: string;
  src: string;
  /** Coordinates in the original 1536 × 1024 illustration. */
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "sway" | "float";
  duration?: number;
}>;
export type KqSchoolInteriorMotion = Readonly<{ baseSrc: string; sprites: readonly KqSchoolInteriorSprite[] }>;

const destinations = [
  { key: "learn", label: "Apprendre", total: 10, unit: "cours parcourus" },
  { key: "quiz", label: "Quiz", total: 10, unit: "quiz réussis" },
  { key: "workshops", label: "Ateliers", total: 6, unit: "ateliers terminés" },
] as const;
const illustration = "/placard/school/interior-v4.webp";
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const serverReducedMotion = () => true;
function subscribeVisibility(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
const getVisibility = () => document.visibilityState === "visible";
const serverVisibility = () => false;
const knownCount = (value: number | undefined, total: number) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= total ? value : undefined;

/** Illustrated destinations remain ordinary HTML buttons, with no canvas hit targets. */
export function KqSchoolInterior({ onChoose, active, completedLessons, passedQuizzes, completedWorkshops, motion }: {
  onChoose: (section: KqSchoolInteriorSection) => void;
  active?: KqSchoolInteriorSection;
  completedLessons?: number;
  passedQuizzes?: number;
  completedWorkshops?: number;
  motion?: KqSchoolInteriorMotion;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [playback, setPlayback] = useState<"auto" | "playing" | "paused">("auto");
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, serverReducedMotion);
  const visible = useSyncExternalStore(subscribeVisibility, getVisibility, serverVisibility);
  const requested = playback === "playing" || (playback === "auto" && !reduced);
  const running = requested && visible && inView;
  const motionState = !requested ? playback === "auto" && reduced ? "reduced" : "paused" : !visible ? "hidden" : !inView ? "offscreen" : "running";
  const spritesReady = Boolean(motion?.sprites.length && loaded[motion.baseSrc] && !failed[motion.baseSrc]
    && motion.sprites.every(sprite => loaded[sprite.src] && !failed[sprite.src]));
  const counts = { learn: completedLessons, quiz: passedQuizzes, workshops: completedWorkshops };
  const imageReady = (src: string) => setLoaded(current => current[src] ? current : { ...current, [src]: true });
  const imageFailed = (src: string) => setFailed(current => current[src] ? current : { ...current, [src]: true });

  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <section className={styles.interior} aria-label="Les trois espaces de l’école" data-school-interior data-motion-state={motionState} data-running={running} data-motion-override={playback === "playing" || undefined}>
    <div ref={scene} className={styles.picture}>
      <Image className={styles.illustration} src={illustration} alt="L’école du chanvre vue en coupe : herbier de chanvre à gauche, pupitre des quiz au centre, semis, graines, fibres et textile de chanvre à l’atelier à droite." width={1536} height={1024} sizes="(max-width: 1000px) 100vw, 1200px" loading="eager" fetchPriority="high" unoptimized />
      {motion ? <div className={styles.spriteLayer} aria-hidden="true" data-school-sprite-layer data-ready={spritesReady}>
        <Image className={styles.cleanImage} src={motion.baseSrc} alt="" fill unoptimized sizes="(max-width: 1000px) 100vw, 1200px" onLoad={() => imageReady(motion.baseSrc)} onError={() => imageFailed(motion.baseSrc)} />
        {motion.sprites.map(sprite => <span key={sprite.id} data-school-sprite={sprite.id} className={`${styles.sprite} ${sprite.kind === "sway" ? styles.sway : styles.float}`} style={{ left: `${sprite.x / 1536 * 100}%`, top: `${sprite.y / 1024 * 100}%`, width: `${sprite.width / 1536 * 100}%`, height: `${sprite.height / 1024 * 100}%`, "--sprite-duration": `${sprite.duration ?? 4}s` } as CSSProperties}>
          <Image src={sprite.src} alt="" fill unoptimized sizes="200px" onLoad={() => imageReady(sprite.src)} onError={() => imageFailed(sprite.src)} />
        </span>)}
      </div> : null}
      <div className={styles.atmosphere} aria-hidden="true"><span className={styles.lampGlow} />{[0, 1, 2, 3].map(index => <span key={index} className={styles.mote} style={{ "--mote-index": index } as CSSProperties} />)}</div>
    </div>
    <nav className={styles.destinations} aria-label="Choisir un espace de l’école">
      {destinations.map(destination => {
        const count = knownCount(counts[destination.key], destination.total);
        return <button key={destination.key} type="button" className={styles.destination} data-school-destination={destination.key} aria-current={active === destination.key ? "page" : undefined} aria-label={count === undefined ? destination.label : `${destination.label} · ${count} sur ${destination.total} ${destination.unit}`} onClick={() => onChoose(destination.key)}>
          <span className={styles.sign}><strong>{destination.label}</strong>{count !== undefined ? <small>{count} / {destination.total}<span className={styles.countUnit}> {destination.key === "learn" ? "cours" : destination.key === "quiz" ? "réussis" : "terminés"}</span></small> : null}</span>
        </button>;
      })}
    </nav>
    <button type="button" className={styles.motionButton} aria-label={requested ? "Mettre les animations de l’école en pause" : "Animer l’école"} title={requested ? "Mettre les animations en pause" : "Animer l’école"} onClick={() => setPlayback(requested ? "paused" : "playing")}>
      {requested ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}
    </button>
  </section>;
}
