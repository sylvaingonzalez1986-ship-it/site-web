"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, DoorOpen, Pause, Play } from "lucide-react";
import type { IsometricBuilding } from "@/lib/kanab-quest-world-mode";
import { KqChapterHeading } from "../KqChapterHeading";
import { createInteriorRoom } from "./interior-rooms";
import type { createBuildingIsometricRenderer } from "./building-isometric-renderer";
import styles from "./BuildingRoom.module.css";

const ROOM_DESCRIPTIONS: Record<IsometricBuilding, string> = {
  bank: "Le banquier reçoit les demandes de prêt. Une tirelire cochon repose sur son bureau, un panneau CAC 40 est accroché au mur et un ordinateur affiche le signe Bitcoin.",
  office: "Le personnel dispose d’un bureau, d’un plan de travail et d’un panneau de recrutement. Le comptable tient son registre près de la machine à calculer.",
  market: "Entre les herbes suspendues et les rayonnages de bocaux, Loïc prépare un colis. La réserve et le bureau de vente bordent son comptoir.",
  missions: "Deux tableaux à toit de bois présentent les défis et les missions de la communauté. Loïc accueille le joueur près du coffre aux packs.",
  arena: "Sous les fanions et les lanternes du kiosque, le juge examine trois bocaux sur une nappe rayée. La caisse de Fleurs se trouve à droite de l’estrade.",
  shop: "Dans la boutique de Loïc, les packs et l’album ouvert entourent le comptoir, sous la fenêtre en arcade et le drapeau breton.",
};
const VILLAGE_HREF = "/arene/placard?view=hub";

export default function BuildingRoom({ id, onNavigate }: { id: IsometricBuilding; onNavigate: (href: string) => void }) {
  const room = useMemo(() => createInteriorRoom(id), [id]);
  const destinations = useMemo(() => room.objects.flatMap(object => object.href
    ? [{ ...object, href: `${object.href}&fromRoom=${id}` }] : []), [room, id]);
  const entry = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<ReturnType<typeof createBuildingIsometricRenderer> | null>(null);
  const [paused, setPaused] = useState(false);
  const playback = useRef(true);
  useEffect(() => {
    playback.current = !paused;
    runtime.current?.setMotion(!paused);
  }, [paused]);

  useEffect(() => {
    entry.current?.focus({ preventScroll: true });
    const node = canvas.current;
    if (!node) return;
    let mounted = true;
    const section = entry.current;
    let highlighted: HTMLElement | null = null;
    const hover = (id: string | null) => {
      if (!section) return;
      section.dataset.roomHover = id ?? "";
      highlighted?.removeAttribute("data-highlighted");
      highlighted = id ? section.querySelector(`[data-building-object="${id}"]`) : null;
      highlighted?.setAttribute("data-highlighted", "");
    };
    const unavailable = () => { node.dataset.live = "false"; hover(null); };
    void import("./building-isometric-renderer").then(({ createBuildingIsometricRenderer }) => {
      if (!mounted) return;
      runtime.current = createBuildingIsometricRenderer(node, room, {
        ready: () => { node.dataset.live = "true"; },
        unavailable,
        hover,
        choose: objectId => {
          const href = objectId === "exit" ? VILLAGE_HREF : destinations.find(object => object.id === objectId)?.href;
          if (href) onNavigate(href);
        },
      });
      runtime.current.setMotion(playback.current);
      runtime.current.setFocus(section?.querySelector<HTMLElement>("a:focus-visible")?.dataset.buildingObject ?? null);
    }).catch(() => { if (mounted) unavailable(); });
    return () => { mounted = false; runtime.current?.dispose(); runtime.current = null; unavailable(); };
  }, [room, destinations, onNavigate]);

  return <section ref={entry} tabIndex={-1} aria-labelledby="building-room-title" data-building-room={id} className={styles.room}>
    <KqChapterHeading title={room.name} titleId="building-room-title" level={1} />
    <div className={styles.layout}>
      <div className={styles.stage} role="img" aria-label={ROOM_DESCRIPTIONS[id]}>
        <div className={styles.poster} style={{ backgroundImage: `url("/placard/building-rooms/${id}.webp")` }} />
        <canvas ref={canvas} aria-hidden="true" data-live="false" />
      </div>
      <nav aria-label={`Activités · ${room.name}`} className={styles.signs}>
        {destinations.map(object => <a className={styles.sign} key={object.id} href={object.href} data-building-object={object.id}
          onFocus={() => runtime.current?.setFocus(object.id)} onBlur={() => runtime.current?.setFocus(null)}
          onPointerEnter={event => { if (event.pointerType === "mouse") runtime.current?.setFocus(object.id); }}
          onPointerLeave={event => { if (!event.currentTarget.matches(":focus-visible")) runtime.current?.setFocus(null); }}
          onPointerDown={() => runtime.current?.activate(object.id)}
          onKeyDown={event => { if (event.key === "Enter") runtime.current?.activate(object.id); }}>
          <span><strong>{object.label}</strong>{object.detail && <small>{object.detail}</small>}</span><ArrowRight size={18} aria-hidden="true" />
        </a>)}
        <a className={styles.exit} href={VILLAGE_HREF}><DoorOpen size={18} aria-hidden="true" /> Sortir au village</a>
        <button type="button" className={`${styles.exit} ${styles.motion}`} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />} Pause des animations
        </button>
      </nav>
    </div>
  </section>;
}
