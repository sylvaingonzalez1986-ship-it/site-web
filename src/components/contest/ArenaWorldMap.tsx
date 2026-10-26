"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowUpRight, BookOpen, LockKeyhole, Monitor, Scan, Trophy, UserRound, ZoomIn } from "lucide-react";
import { useId, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { ARENA_LOBBY_MODES, ARENA_LOBBY_MODE_ORDER, type ArenaLobbyMode } from "@/lib/arena-lobby";
import type { ArenaProfileAvailability, ArenaProfileLauncherHandle } from "@/lib/arena-profile-launcher";
import { ARENA_MAP_PLACE_IDS, ARENA_MAP_SCENE, getArenaMapPlaceGeometry, type ArenaMapPlaceId } from "./ArenaWorldMap.geometry";
import styles from "./ArenaWorldMap.module.css";

const PLACES = {
  carnet: { Icon: BookOpen },
  jouer: { Icon: Monitor },
  classement: { Icon: Trophy },
} as const;
const coordinates = (place: ReturnType<typeof getArenaMapPlaceGeometry>) => ({
  left: place.left, top: place.top, width: place.width, height: place.height,
  "--label-x": place.labelLeft, "--label-y": place.labelTop, "--silhouette": place.clipPath,
} as CSSProperties);

export function ArenaWorldMap({ activitiesLocked, notebookOpen, initialMode, profileLauncher, profileAvailability }: {
  activitiesLocked: boolean;
  notebookOpen: boolean;
  initialMode: ArenaLobbyMode;
  profileLauncher: RefObject<ArenaProfileLauncherHandle | null>;
  profileAvailability: ArenaProfileAvailability;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [hoveredPlace, setHoveredPlace] = useState<ArenaMapPlaceId | null>(null);
  const [focusedPlace, setFocusedPlace] = useState<ArenaMapPlaceId | null>(null);
  const maskId = `arena-${useId().replace(/:/g, "")}`;
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
  const placeProps = (id: ArenaMapPlaceId) => {
    const geometry = getArenaMapPlaceGeometry(id);
    return {
      "data-arena-place": id,
      "data-arena-hit-point": geometry.hitPoint,
      "data-arena-ground-point": geometry.groundPoint,
      style: coordinates(geometry),
      onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType !== "touch") setHoveredPlace(id); },
      onPointerLeave: () => setHoveredPlace(current => current === id ? null : current),
      onFocus: () => setFocusedPlace(id),
      onBlur: () => setFocusedPlace(current => current === id ? null : current),
    };
  };

  return <section className={styles.map} data-arena-map data-map-zoomed={zoomed || undefined} aria-label="Le bureau de Sylvain">
    <div className={styles.heading}>
      <span>Explore le bureau</span>
      <button type="button" className={styles.zoom} data-arena-map-zoom aria-pressed={zoomed} aria-controls="arena-map-viewport" onClick={toggleZoom}>
        {zoomed ? <Scan size={17} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />}{zoomed ? "Vue d’ensemble" : "Agrandir"}
      </button>
    </div>
    <div ref={viewport} className={styles.viewport} id="arena-map-viewport">
      <div className={styles.terrain} data-arena-scene={initialMode}>
        <Image src={ARENA_MAP_SCENE.image} alt={ARENA_MAP_SCENE.alt} fill sizes="(max-width: 700px) 700px, (max-width: 1400px) 100vw, 1300px" loading="eager" fetchPriority="high" draggable={false} />
        <svg className={styles.lightingLayer} viewBox={`0 0 ${ARENA_MAP_SCENE.width} ${ARENA_MAP_SCENE.height}`} aria-hidden="true" focusable="false">
          <defs>{ARENA_MAP_PLACE_IDS.map(id => <clipPath id={`${maskId}-${id}`} key={id}><polygon points={getArenaMapPlaceGeometry(id).points} /></clipPath>)}</defs>
          {ARENA_MAP_PLACE_IDS.map(id => {
            const available = id === "profil" ? !profilePending : id === "carnet" ? notebookOpen : !activitiesLocked;
            const active = available && (hoveredPlace === id || focusedPlace === id);
            return <g key={id} className={styles.placeLight} data-active={active || undefined}>
              <image href={ARENA_MAP_SCENE.image} width={ARENA_MAP_SCENE.width} height={ARENA_MAP_SCENE.height} clipPath={`url(#${maskId}-${id})`} className={styles.litImage} />
              <polygon points={getArenaMapPlaceGeometry(id).points} className={styles.silhouette} data-arena-silhouette={id} data-active={active || undefined} vectorEffect="non-scaling-stroke" />
            </g>;
          })}
        </svg>
        <nav aria-label="Choisir une activité">
          {ARENA_LOBBY_MODE_ORDER.map(id => {
            const { Icon } = PLACES[id];
            const locked = id === "carnet" ? !notebookOpen : activitiesLocked;
            const content = <>
              <span className={styles.hitArea} data-arena-hit-area={id} aria-hidden="true" />
              <span className={styles.label} data-arena-label={id}>
                <span className={styles.placeIcon}><Icon size={22} aria-hidden="true" /></span>
                <strong>{id === "jouer" ? "JOUER" : ARENA_LOBBY_MODES[id].name}</strong>
                {locked ? <span className={styles.soon}><LockKeyhole size={13} aria-hidden="true" />{id === "carnet" ? "Indisponible" : "Bientôt"}</span> : <ArrowUpRight className={styles.arrow} size={18} aria-hidden="true" />}
              </span>
            </>;
            return locked
              ? <div key={id} data-arena-activity={id} className={styles.place} data-locked aria-disabled="true" {...placeProps(id)}>{content}</div>
              : <Link key={id} data-arena-activity={id} className={styles.place} data-current={initialMode === id || undefined} {...placeProps(id)} href={ARENA_LOBBY_MODES[id].href}>{content}</Link>;
          })}
          <button type="button" data-arena-profile-trigger className={styles.place} {...placeProps("profil")}
            aria-label={profileAvailability === "error" ? "Réessayer le profil joueur" : "Ouvrir mon profil joueur"}
            disabled={profilePending} aria-busy={profileAvailability === "loading"} onClick={event => profileLauncher.current?.open(event.currentTarget)}>
            <span className={styles.hitArea} data-arena-hit-area="profil" aria-hidden="true" />
            <span className={styles.label} data-arena-label="profil">
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
