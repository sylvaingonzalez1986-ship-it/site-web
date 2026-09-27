"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft, ArrowUpRight, Banknote, BookOpen, ChevronDown, CircleHelp, Gamepad2, Swords, Target, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { getKqNextEquipmentGoal } from "@/lib/kanab-quest-equipment";
import { getKqPlacardNextAction } from "@/lib/kanab-quest-hub";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import { useKqTentSelection } from "./KqTentSelector";
import styles from "./KqPlacardLobby.module.css";

type LobbySnapshot = {
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  productionUnits?: number;
  ownedCodes: string[];
  cashCents: number;
};

export function KqPlacardLobby({ onOpen, onOpenCollection }: {
  onOpen: (view: "game" | "market" | "treasury" | "shop" | "arena" | "missions" | "workshop") => void;
  onOpenCollection: () => void;
}) {
  const tentNumber = useKqTentSelection();
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/arena/placard/equipment?tentNumber=${tentNumber}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Résumé indisponible");
        const data = await response.json() as LobbySnapshot;
        if (typeof data.activeRun !== "boolean" || !Array.isArray(data.ownedCodes) || !Number.isFinite(data.cashCents) || !Number.isFinite(data.readyLotCount) || !Number.isFinite(data.availableFlowerCount)) throw new Error("Résumé incomplet");
        if (!controller.signal.aborted) { setSnapshot(data); setError(false); }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [revision, tentNumber]);

  const nextGoal = snapshot ? getKqNextEquipmentGoal({ ownedCodes: snapshot.ownedCodes, cashCents: snapshot.cashCents, productionUnits: 1 }) : null;
  const nextAction = snapshot ? getKqPlacardNextAction({ ...snapshot, equipmentGoalAffordable: nextGoal?.affordable ?? false }) : null;
  const recommended = nextAction?.destination === "shop" ? "workshop" : nextAction?.destination;
  const tents = snapshot ? getKqProductionUnits(snapshot.productionUnits) : null;
  const activities = [
    { id: "game", place: "La culture", title: snapshot?.activeRun ? "Reprendre ma culture" : "Cultiver", description: snapshot?.activeRun ? "Ta culture est sauvegardée. À toi de jouer." : "Fais grandir ta prochaine récolte.", Icon: Gamepad2 },
    { id: "workshop", place: "L’entrepôt", title: "Aménager", description: tents ? `${tents} tente${tents > 1 ? "s" : ""} · culture commune` : "Équipe et entretiens tes tentes.", Icon: Warehouse },
    { id: "market", place: "Le marché", title: "Vendre", description: snapshot?.readyLotCount ? `${snapshot.readyLotCount} lot${snapshot.readyLotCount > 1 ? "s" : ""} prêt${snapshot.readyLotCount > 1 ? "s" : ""} · transforme ou vends ta récolte.` : "Tes lots, tes ventes et ton bureau.", Icon: Banknote },
  ] as const;

  return <main className={styles.lobby} data-placard-lobby>
    <div className={styles.backdrop} aria-hidden="true">
      <Image src="/contest/mascot/arena-scene-placard-v1.png" alt="" fill sizes="100vw" priority />
    </div>
    <header className={styles.header}>
      <div><Link className={styles.back} href="/arene"><ArrowLeft size={16} aria-hidden="true" /> L’Arène</Link><h1>Le Placard.</h1></div>
      <details className={styles.help}>
        <summary><CircleHelp size={17} aria-hidden="true" /> Aide <ChevronDown size={14} aria-hidden="true" /></summary>
        <div className={styles.helpContent}>
          <strong>Une récolte, plusieurs possibilités.</strong>
          <p>Cultive, présente ta Fleur au jury, puis retrouve ton lot au marché pour le transformer ou le vendre.</p>
          <p>Dans l’entrepôt, chaque tente possède son matériel. Toutes participent à la même culture.</p>
          <p>Retrouve les comptes et le banquier dans le Bureau, depuis le marché. Les packs t’attendent à la Boutique, depuis ta collection.</p>
        </div>
      </details>
    </header>
    <div className={styles.breathingRoom} aria-hidden="true" />
    <section className={styles.activities} aria-labelledby="placard-activities-title">
      <div className={styles.intro}><h2 id="placard-activities-title">À toi de cultiver.</h2><p>Fais grandir ton placard, à ton rythme.</p></div>
      <nav className={styles.activityGrid} aria-label="Activités du Placard">
        {activities.map(({ id, place, title, description, Icon }) => <button key={id} type="button" className={styles.activity} data-placard-activity={id} data-recommended={recommended === id || undefined} onClick={() => onOpen(id)}>
          <span className={styles.activityIcon}><Icon size={23} aria-hidden="true" /></span>
          <span className={styles.activityText}><span className={styles.place}>{place}{recommended === id ? <span className={styles.next}> · À poursuivre</span> : null}</span><strong>{title}</strong><span className={styles.description}>{description}</span></span>
          <ArrowUpRight className={styles.arrow} size={22} aria-hidden="true" />
        </button>)}
      </nav>
      <nav className={styles.secondary} aria-label="Fleurs, missions et collection">
        <button type="button" onClick={() => onOpen("arena")} data-recommended={recommended === "arena" || undefined}><Swords size={17} aria-hidden="true" /><span>Jury & duels{snapshot && snapshot.availableFlowerCount > 0 ? <small>{snapshot.availableFlowerCount} Fleur{snapshot.availableFlowerCount > 1 ? "s" : ""} disponible{snapshot.availableFlowerCount > 1 ? "s" : ""}</small> : null}</span></button>
        <button type="button" onClick={() => onOpen("missions")}><Target size={17} aria-hidden="true" /><span>Missions</span></button>
        <button type="button" data-arena-tour="collection" onClick={onOpenCollection} aria-haspopup="dialog"><BookOpen size={17} aria-hidden="true" /><span>Collection</span></button>
      </nav>
      {error ? <p className={styles.status} role="status">Ton résumé est indisponible. Les activités restent accessibles. <button type="button" onClick={() => { setError(false); setRevision(value => value + 1); }}>Réessayer</button></p> : null}
    </section>
  </main>;
}
