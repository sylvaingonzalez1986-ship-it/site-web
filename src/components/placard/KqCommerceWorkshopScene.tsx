"use client";

import Image from "next/image";
import { Check, Clock3, Pause, Play } from "lucide-react";
import { useState } from "react";
import type { KqCommerceStock } from "@/lib/kanab-quest-commerce";
import { getKqEquipmentArtwork } from "@/lib/kanab-quest-equipment-artwork";
import { KQ_MARKET_ROUTES, type KqMarketQuote } from "@/lib/kanab-quest-market";
import { useKqSceneMotion } from "./useKqSceneMotion";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqCommerceWorkshopScene.module.css";

type Props = { quote: KqMarketQuote; stock?: never; now?: never } | { stock: KqCommerceStock; now?: number; quote?: never };

/** Only a confirmed availability deadline can animate waiting; selection never starts work. */
export function KqCommerceWorkshopScene({ quote, stock, now }: Props) {
  const [paused, setPaused] = useState(false);
  const { ref, motionEnabled, status, reducedMotion } = useKqSceneMotion<HTMLElement>(paused);
  const route = quote?.route ?? stock!.route;
  const definition = KQ_MARKET_ROUTES.find(item => item.code === route)!;
  const transformed = definition.family === "hash" || definition.family === "rosin";
  const job = stock?.processingWork;
  const deadline = job ? job.status === "passive" || job.status === "completed" ? job.finalReadyAt : job.status === "running" ? job.readyAt : null : stock?.processingReadyAt;
  const readyAt = deadline ? Date.parse(deadline) : undefined;
  const hasClock = now !== undefined && Number.isFinite(now);
  const validDeadline = readyAt !== undefined && Number.isFinite(readyAt) && new Date(readyAt).getUTCFullYear() < 9999;
  const phase = quote ? "preview" : job ? !hasClock ? "unknown" : job.status === "completed" ? "ready" : job.status === "blocked" ? "blocked" : "pending" : !validDeadline || !hasClock ? "unknown" : readyAt > now! ? "pending" : "ready";
  const minutes = phase === "pending" && validDeadline ? Math.max(0, Math.ceil((readyAt! - now!) / 60000)) : null;
  // A route illustration, never a claim that this particular machine is installed or running.
  const illustrationCode = definition.family === "rosin" ? "PRESS-0600" : route === "static-sift" ? "STATIC-PLASMA" : route === "ice-water-hash" || route === "hash-signature" ? "WASHER-25L" : "SIFT-TRAY";
  const equipmentCodes = job?.plan.machines.map(machine => machine.code) ?? (quote?.processingEquipmentCodes?.length ? quote.processingEquipmentCodes : [illustrationCode]);
  const equipment = equipmentCodes.map(code => getKqEquipmentArtwork(code)).filter(item => item !== null).slice(0, 3);
  if (!transformed) return null;

  return <aside ref={ref} className={styles.scene} data-commerce-workshop-scene data-phase={phase} data-processing-status={job?.status} data-motion-state={status} data-motion-enabled={motionEnabled || undefined} aria-label={quote ? "Aperçu de la transformation" : "Disponibilité du produit transformé"}>
    <div key={route} className={styles.art} aria-hidden="true">
      {equipment.map(item => <Image key={item.src} src={item.src} alt="" width={160} height={160} sizes="88px" />)}
      <span className={styles.signal}>
        {phase === "ready" ? <Check size={22} /> : <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" /><path d="M20 7v3M33 20h-3M20 33v-3M7 20h3" /><path className={styles.clockHand} data-commerce-waiting-hand d="M20 20V12M20 20h7" /><circle cx="20" cy="20" r="1.5" /></svg>}
      </span>
    </div>
    <div className={styles.copy}>
      <strong>{phase === "preview" ? "Avant confirmation" : phase === "unknown" ? "Disponibilité à confirmer" : job ? job.status === "running" ? "Transformation en cours" : job.status === "passive" ? "Attente autonome" : job.status === "blocked" ? "Transformation en attente d’heures" : "Transformation terminée" : phase === "pending" ? "En attente de disponibilité" : "Délai de transformation écoulé"}</strong>
      <span>{definition.name}{stock ? ` · ${(stock.remainingUnits / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g dans ce lot` : ""}</span>
      {job ? <>
        <KqProgressMeter label="Fleurs transformées" value={job.completedGrams} max={job.inputGrams} valueLabel={`${job.completedGrams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g / ${job.inputGrams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`} />
        <small>{job.actor ? `${job.actor.name} · 0 h joueur` : job.delegated ? "Réserve salariée · 0 h joueur" : "Travail du joueur"}{job.status === "running" ? ` · ${job.bookedHours.toLocaleString("fr-FR")} h de jeu réservées` : ""}</small>
        {job.status === "blocked" ? <small>{job.delegated ? "Ajoute des heures Transformation dans Personnel ou attends le prochain jour travaillé. Aucun relais joueur." : "Reprends avec tes heures disponibles ou au prochain jour."}</small> : null}
        {job.status !== "completed" ? <small>Vente disponible après tout le travail et l’attente autonome.</small> : null}
      </> : null}
      {validDeadline ? <small><Clock3 size={14} aria-hidden="true" /><span>{job?.status === "running" ? "Fin de cette tranche : " : phase === "ready" ? "Échéance : " : "Disponibilité prévue : "}<time dateTime={deadline!}>{new Date(readyAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>{minutes !== null ? ` · encore ${minutes.toLocaleString("fr-FR")} min` : ""}</span></small> : null}
      {phase === "unknown" ? <small>Actualise le stock pour connaître sa disponibilité.</small> : null}
    </div>
    {phase === "pending" && !reducedMotion ? <button type="button" className={styles.pause} aria-label={paused ? "Reprendre l’animation d’attente" : "Mettre en pause l’animation d’attente"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}<span>{paused ? "Reprendre" : "Pause"}</span></button> : null}
  </aside>;
}
