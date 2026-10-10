"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowUpRight, BookOpen, LockKeyhole, Monitor, Scan, Trophy, UserRound, ZoomIn } from "lucide-react";
import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { ARENA_LOBBY_MODES, ARENA_LOBBY_MODE_ORDER, type ArenaLobbyMode } from "@/lib/arena-lobby";
import type { ArenaProfileAvailability, ArenaProfileLauncherHandle } from "@/lib/arena-profile-launcher";
import styles from "./ArenaWorldMap.module.css";

const PLACES = {
  carnet: { Icon: BookOpen, x: 28, y: 72, width: 40, height: 22 },
  jouer: { Icon: Monitor, x: 62, y: 41, width: 29, height: 30 },
  classement: { Icon: Trophy, x: 66, y: 3, width: 28, height: 34 },
} as const;
const coordinates = (place: { x: number; y: number; width: number; height: number }) => ({
  "--x": `${place.x}%`, "--y": `${place.y}%`, "--width": `${place.width}%`, "--height": `${place.height}%`,
} as CSSProperties);

export function ArenaWorldMap({ activitiesLocked, initialMode, profileLauncher, profileAvailability }: {
  activitiesLocked: boolean;
  initialMode: ArenaLobbyMode;
  profileLauncher: RefObject<ArenaProfileLauncherHandle | null>;
  profileAvailability: ArenaProfileAvailability;
}) {
  const [zoomed, setZoomed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const toggleZoom = () => {
    setZoomed(value => !value);
    requestAnimationFrame(() => {
      const container = viewport.current;
      const place = container?.querySelector<HTMLElement>(`[data-arena-activity="${initialMode}"]`);
      if (container && place) container.scrollTo({ left: place.offsetLeft + place.offsetWidth / 2 - container.clientWidth / 2, behavior: "instant" });
    });
  };
  const profilePending = profileAvailability === "loading" || profileAvailability === "blocked";
  const profileStatus = profileAvailability === "loading" ? "Chargement…" : profileAvailability === "error" ? "Réessayer" : profileAvailability === "blocked" ? "Indisponible" : null;

  return <section className={styles.map} data-arena-map data-map-zoomed={zoomed || undefined} aria-label="Le bureau de Sylvain">
    <div className={styles.heading}>
      <button type="button" className={styles.zoom} data-arena-map-zoom aria-pressed={zoomed} aria-controls="arena-map-viewport" onClick={toggleZoom}>
        {zoomed ? <Scan size={17} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />}{zoomed ? "Vue d’ensemble" : "Agrandir"}
      </button>
    </div>
    <div ref={viewport} className={styles.viewport} id="arena-map-viewport">
      <div className={styles.terrain} data-arena-scene={initialMode}>
        <Image src="/contest/map/arena-desk-v4.webp" alt="Sylvain assis à son bureau, le carnet de dégustation ouvert sur une photo de fleur et ses notes manuscrites, à côté des bocaux de fleurs de cannabis. À droite, un ordinateur et le tableau des classements ; à gauche, un miroir." fill sizes="(max-width: 700px) 700px, (max-width: 1400px) 100vw, 1300px" loading="eager" fetchPriority="high" draggable={false} />
        <nav aria-label="Choisir une activité">
          {ARENA_LOBBY_MODE_ORDER.map(id => {
            const { Icon, ...place } = PLACES[id];
            const content = <>
              <span className={styles.label}>
                <span className={styles.placeIcon}><Icon size={22} aria-hidden="true" /></span>
                <strong>{id === "jouer" ? "JOUER" : ARENA_LOBBY_MODES[id].name}</strong>
                {activitiesLocked ? <span className={styles.soon}><LockKeyhole size={13} aria-hidden="true" />Bientôt</span> : <ArrowUpRight className={styles.arrow} size={18} aria-hidden="true" />}
              </span>
            </>;
            return activitiesLocked
              ? <div key={id} data-arena-activity={id} className={styles.place} data-locked aria-disabled="true" style={coordinates(place)}>{content}</div>
              : <Link key={id} data-arena-activity={id} className={styles.place} data-current={initialMode === id || undefined} style={coordinates(place)} href={ARENA_LOBBY_MODES[id].href}>{content}</Link>;
          })}
          <button type="button" data-arena-profile-trigger className={styles.place} style={coordinates({ x: 3, y: 2, width: 23, height: 51 })}
            aria-label={profileAvailability === "error" ? "Réessayer le profil joueur" : "Ouvrir mon profil joueur"}
            disabled={profilePending} aria-busy={profileAvailability === "loading"} onClick={event => profileLauncher.current?.open(event.currentTarget)}>
            <span className={styles.label}>
              <span className={styles.placeIcon}><UserRound size={22} aria-hidden="true" /></span>
              <span><strong>Profil</strong>{profileStatus && <small>{profileStatus}</small>}</span>
              <ArrowUpRight className={styles.arrow} size={18} aria-hidden="true" />
            </span>
          </button>
        </nav>
      </div>
    </div>
  </section>;
}
