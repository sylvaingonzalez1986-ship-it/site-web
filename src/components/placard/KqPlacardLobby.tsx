"use client";

import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft, BookOpen, ChevronDown, CircleHelp, Map, Tent, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { formatKqCash, getKqNextEquipmentGoal } from "@/lib/kanab-quest-equipment";
import { getKqPlacardNextAction } from "@/lib/kanab-quest-hub";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import { useKqTentSelection } from "./KqTentSelector";
import { KqPlacardMap, type PlacardMapOpen } from "./KqPlacardMap";
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
  onOpen: PlacardMapOpen;
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

  return <main className={styles.lobby} data-placard-lobby>
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link className={styles.back} href="/arene"><ArrowLeft size={15} aria-hidden="true" /> L’Arène <span>/</span> Kanab Quest</Link>
        <h1>Le Placard<span>.</span></h1>
        <p>Ton quartier. Tes cultures. Tes affaires.</p>
      </div>
      <div className={styles.headerTools}>
        <details className={styles.help}>
          <summary><CircleHelp size={17} aria-hidden="true" /> Aide <ChevronDown size={14} aria-hidden="true" /></summary>
          <div className={styles.helpContent}>
            <strong>Tout commence dans ton quartier.</strong>
            <p>Sélectionne un bâtiment sur la carte, puis choisis ce que tu veux y faire. Sur mobile, touche un numéro ou utilise le sélecteur de lieux. Agrandis la carte pour explorer le quartier en faisant glisser le décor.</p>
            <p>L’entrepôt abrite ton Placard : entre pour cultiver, ou aménage et entretiens tes tentes. Le marché accueille tes récoltes, le jury et les duels tes Fleurs.</p>
            <p>Le Bureau réunit la comptabilité et la gestion. La Banque donne directement accès aux prêts, à l’épargne et aux placements. Passe à la Boutique pour tes packs et ton matériel.</p>
          </div>
        </details>
        <div className={styles.wallet} aria-label="Résumé de ton Placard">
          <span><Wallet size={15} aria-hidden="true" /><span><small>Argent du jeu</small><strong>{snapshot ? formatKqCash(snapshot.cashCents) : "—"}</strong></span></span>
          <span><Tent size={16} aria-hidden="true" /><span><small>Ton installation</small><strong>{tents ? tents + " tente" + (tents > 1 ? "s" : "") : "—"}</strong></span></span>
        </div>
      </div>
    </header>
    <div className={styles.intro}><span><Map size={16} aria-hidden="true" /> Bienvenue dans ton quartier</span><p>Un lieu pour chaque envie. À toi de choisir le chemin.</p></div>
    <KqPlacardMap onOpen={onOpen} activeRun={snapshot?.activeRun} tents={tents} readyLotCount={snapshot?.readyLotCount} availableFlowerCount={snapshot?.availableFlowerCount} recommended={recommended} />
    {error ? <p className={styles.status} role="status">Ton résumé est indisponible. Les activités restent accessibles. <button type="button" onClick={() => { setError(false); setRevision(value => value + 1); }}>Réessayer</button></p> : null}
    <footer className={styles.footer}>
      <span>Kanab Quest <i /> Cultive ton aventure.</span>
      <button type="button" className={styles.collectionLink} data-arena-tour="collection" onClick={onOpenCollection} aria-haspopup="dialog"><BookOpen size={16} aria-hidden="true" /> Ma collection Botte du Chanvrier</button>
    </footer>
  </main>;
}
