"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowUpRight, BookOpen, Compass, Dices, LockKeyhole, MapPin, Scan, Trophy, UserRound, ZoomIn } from "lucide-react";
import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { ARENA_LOBBY_MODES, ARENA_LOBBY_MODE_ORDER, type ArenaLobbyMode } from "@/lib/arena-lobby";
import type { ArenaProfileAvailability, ArenaProfileLauncherHandle } from "@/lib/arena-profile-launcher";
import styles from "./ArenaWorldMap.module.css";

const PLACES = {
  carnet: { Icon: BookOpen, x: 8, y: 8, width: 34, height: 39 },
  jouer: { Icon: Dices, x: 54, y: 6, width: 38, height: 41 },
  classement: { Icon: Trophy, x: 9, y: 49, width: 35, height: 40 },
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

  return <section className={styles.map} data-arena-map data-map-zoomed={zoomed || undefined} aria-label="Carte de l’Arène">
    <div className={styles.heading}>
      <button type="button" className={styles.zoom} data-arena-map-zoom aria-pressed={zoomed} aria-controls="arena-map-viewport" onClick={toggleZoom}>
        {zoomed ? <Scan size={17} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />}{zoomed ? "Vue d’ensemble" : "Agrandir"}
      </button>
    </div>
    <div ref={viewport} className={styles.viewport} id="arena-map-viewport">
      <div className={styles.terrain} data-arena-scene={initialMode}>
        <Image src="/contest/map/arena-world-v1.webp" alt="Le village isométrique de l’Arène, entouré de forêt et d’une rivière : la maison du Carnet, l’atelier du Placard, le pavillon des trophées et la maison du joueur." fill sizes="(max-width: 700px) 700px, (max-width: 1400px) 100vw, 1300px" loading="eager" fetchPriority="high" draggable={false} />
        <nav aria-label="Choisir une activité">
          {ARENA_LOBBY_MODE_ORDER.map(id => {
            const { Icon, ...place } = PLACES[id];
            const content = <>
              <span className={styles.pin} aria-hidden="true"><MapPin size={20} /></span>
              <span className={styles.label}>
                <span className={styles.placeIcon}><Icon size={22} aria-hidden="true" /></span>
                <strong>{ARENA_LOBBY_MODES[id].name}</strong>
                {activitiesLocked ? <span className={styles.soon}><LockKeyhole size={13} aria-hidden="true" />Bientôt</span> : <ArrowUpRight className={styles.arrow} size={18} aria-hidden="true" />}
              </span>
            </>;
            return activitiesLocked
              ? <div key={id} data-arena-activity={id} className={styles.place} data-locked aria-disabled="true" style={coordinates(place)}>{content}</div>
              : <Link key={id} data-arena-activity={id} className={styles.place} data-current={initialMode === id || undefined} style={coordinates(place)} href={ARENA_LOBBY_MODES[id].href}>{content}</Link>;
          })}
          <button type="button" data-arena-profile-trigger className={styles.place} style={coordinates({ x: 55, y: 49, width: 37, height: 40 })}
            aria-label={profileAvailability === "error" ? "Réessayer le profil joueur" : "Ouvrir mon profil joueur"}
            disabled={profilePending} aria-busy={profileAvailability === "loading"} onClick={event => profileLauncher.current?.open(event.currentTarget)}>
            <span className={styles.pin} aria-hidden="true"><MapPin size={20} /></span>
            <span className={styles.label}>
              <span className={styles.placeIcon}><UserRound size={22} aria-hidden="true" /></span>
              <span><strong>Profil joueur</strong>{profileStatus && <small>{profileStatus}</small>}</span>
              <ArrowUpRight className={styles.arrow} size={18} aria-hidden="true" />
            </span>
          </button>
        </nav>
        <span className={styles.compass} aria-hidden="true"><span>N</span><Compass size={40} strokeWidth={1} /><small>KQ</small></span>
      </div>
    </div>
  </section>;
}
