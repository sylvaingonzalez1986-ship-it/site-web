"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock3, PackageCheck, RefreshCw, Sprout, Swords } from "lucide-react";
import type { KqOfficialFlower, KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { getKqHarvestRows, type KqHarvestState } from "@/lib/kanab-quest-harvests";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay } from "@/lib/kanab-quest-storage-refresh";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqWarehouseStorage } from "./KqWarehouseStorage";
import { KqStorageStatus } from "./KqStorageStatus";
import styles from "./KqHarvests.module.css";

const labels: Record<KqHarvestState, string> = { jury: "À présenter au jury", queued: "Adversaire recherché", duel: "Duel en cours", overflow: "Du surplus à protéger", curing: "En affinage", ready: "Prête à vendre" };
export function KqHarvests({ section, onSectionChange, onOpenArena, onOpenMarket, onOpenGame }: {
  section: "overview" | "storage";
  onSectionChange: (section: "overview" | "storage") => void;
  onOpenArena: (flowerId?: string) => void;
  onOpenMarket: (flowerId?: string) => void;
  onOpenGame: () => void;
}) {
  const api = useKqTutorialApi();
  const [flowers, setFlowers] = useState<KqOfficialFlower[]>([]);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const polling = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  useEffect(() => {
    if (section !== "overview") return;
    const controller = new AbortController();
    let currentStorage: KqStorageSnapshot | null = null;
    let received = 0;
    const read = async (path: string) => {
      const response = await api.request(path, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Lecture indisponible.");
      return body;
    };
    const refresh = async () => {
      const result = await Promise.allSettled([read("/api/arena/placard/flowers"), read("/api/arena/placard/storage")]);
      if (controller.signal.aborted) return;
      const problems: string[] = [];
      if (result[0].status === "fulfilled" && Array.isArray(result[0].value.flowers)) setFlowers(result[0].value.flowers);
      else { setFlowers([]); problems.push("Les récoltes en attente du jury sont momentanément indisponibles."); }
      if (result[1].status === "fulfilled" && Array.isArray(result[1].value.lots) && typeof result[1].value.serverNow === "string") {
        currentStorage = result[1].value as KqStorageSnapshot;
        received = performance.now();
        setStorage(currentStorage);
      } else { currentStorage = null; setStorage(null); problems.push("Le suivi du stockage est momentanément indisponible."); }
      setErrors(problems); setLoaded(true);
    };
    const stop = startArenaVisiblePolling(refresh, () => getKqStorageRefreshDelay(currentStorage, performance.now() - received));
    polling.current = stop;
    const unsubscribe = api.subscribe(["kq:storage-updated", "kq:equipment-updated", "arena:progress-updated"], () => void stop.refresh());
    return () => { controller.abort(); stop(); unsubscribe(); polling.current = null; };
  }, [api, section]);
  const rows = getKqHarvestRows(flowers, storage);
  const visible = rows.filter(row => filter === "all" || (filter === "jury" ? !row.lot : !!row.lot));
  return <main className={styles.page} data-placard-harvests>
    <header className={styles.heading}><div><small>Du jury à la vente</small><h2>Mes récoltes</h2><p>Retrouve chaque récolte, son état et la prochaine action.</p></div></header>
    <nav className={styles.tabs} aria-label="Parcours des récoltes">
      <button type="button" aria-current={section === "overview" ? "page" : undefined} onClick={() => onSectionChange("overview")}>Toutes mes récoltes</button>
      <button type="button" onClick={() => onOpenArena()}>Jury & duels</button>
      <button type="button" aria-current={section === "storage" ? "page" : undefined} onClick={() => onSectionChange("storage")}>Stockage & affinage</button>
    </nav>
    {section === "storage" ? <KqWarehouseStorage /> : <>
      <div className={styles.toolbar}><label>Afficher<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Toutes les récoltes</option><option value="jury">Jury et duels</option><option value="stock">Stockage et vente</option></select></label><button type="button" aria-label="Actualiser les récoltes" onClick={() => void polling.current?.refresh()}><RefreshCw size={18} /></button></div>
      {errors.map(error => <p role="alert" key={error} className={styles.error}>{error} <button type="button" onClick={() => void polling.current?.refresh()}>Réessayer</button></p>)}
      {!loaded ? <p role="status" className={styles.empty}>Ouverture de tes récoltes…</p> : visible.length ? <ul className={styles.list}>{visible.map(row => <li key={row.id} data-harvest-id={row.id} data-harvest-state={row.state}>
        <div className={styles.harvestIcon} aria-hidden="true">{row.lot ? <PackageCheck size={27} /> : <Sprout size={27} />}</div>
        <div className={styles.identity}><span className={styles.state} data-urgent={row.state === "overflow" || undefined}>{labels[row.state]}</span><h3>{row.name}</h3>
          {row.lot ? <KqStorageStatus storage={row.lot.projection} nowMs={Date.parse(storage!.serverNow)} compact /> : <p>{row.state === "jury" ? "Présente cette Fleur pour obtenir son verdict avant la vente." : row.state === "queued" ? "La recherche est en cours. Tu peux suivre ou quitter la file au jury." : "Retrouve l’adversaire et le verdict dans Jury & duels."}</p>}
        </div>
        <div className={styles.actions}>{!row.lot ? <button type="button" className={styles.primary} onClick={() => onOpenArena(row.id)}><Swords size={16} />{row.state === "jury" ? "Présenter au jury" : "Suivre le duel"}<ArrowRight size={16} /></button> : <>
          {row.state === "overflow" ? <button type="button" className={styles.primary} onClick={() => onSectionChange("storage")}>Protéger le surplus<ArrowRight size={16} /></button> : null}
          <button type="button" className={row.state === "overflow" ? undefined : styles.primary} onClick={() => onOpenMarket(row.id)}>{row.lot.projection.stage === "ready" ? "Préparer ou vendre" : "Voir l’offre grossiste"}<ArrowRight size={16} /></button>
          {row.state !== "overflow" ? <button type="button" onClick={() => onSectionChange("storage")}><Clock3 size={15} /> Gérer le stockage</button> : null}
        </>}</div>
      </li>)}</ul> : !errors.length ? <div className={styles.empty}><Sprout size={32} aria-hidden="true" /><h3>{filter === "all" ? "Ta prochaine récolte commence ici" : "Aucune récolte dans cette catégorie"}</h3><p>{filter === "all" ? "Lance une culture. Tu retrouveras sa récolte ici, jusqu’à sa vente." : "Les autres récoltes restent accessibles dans la liste complète."}</p><button type="button" className={styles.primary} onClick={filter === "all" ? onOpenGame : () => setFilter("all")}>{filter === "all" ? "Commencer une culture" : "Voir toutes mes récoltes"}<ArrowRight size={16} /></button></div> : null}
      <p className={styles.note}>L’affinage (curing) dure 6 heures réelles après le verdict. Pendant ce temps, la vente aux grossistes reste possible.</p>
    </>}
  </main>;
}
