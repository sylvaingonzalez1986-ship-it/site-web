"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, PackageCheck, RefreshCw, Sprout, Swords } from "lucide-react";
import type { KqOfficialFlower, KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { getKqHarvestActions, getKqHarvestRows, isKqHarvestAtJury, type KqHarvestMarketSection } from "@/lib/kanab-quest-harvests";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay } from "@/lib/kanab-quest-storage-refresh";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqHarvestStorage } from "./KqHarvestStorage";
import { KqLotSummary } from "./KqLotSummary";
import { KqAllocationBar } from "./KqVisuals";
import { KqChapterHeading } from "./KqChapterHeading";
import styles from "./KqHarvests.module.css";

export function KqHarvests({ section, initialFlowerId, onSectionChange, onOpenArena, onOpenMarket, onOpenGame, onOpenWarehouse }: {
  section: "overview" | "storage";
  initialFlowerId?: string;
  draftOwnerId?: string;
  onSectionChange: (section: "overview" | "storage", flowerId?: string) => void;
  onOpenArena: (flowerId?: string) => void;
  onOpenMarket: (flowerId?: string, section?: KqHarvestMarketSection) => void;
  onOpenGame: () => void;
  onOpenCulture?: (href: string) => void;
  onOpenWarehouse?: (flowerId?: string) => void;
}) {
  const api = useKqTutorialApi();
  const [flowers, setFlowers] = useState<KqOfficialFlower[] | null>(null);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [lastOpenedFlower, setLastOpenedFlower] = useState<string>();
  const targetFlowerId = initialFlowerId ?? lastOpenedFlower;
  const page = useRef<HTMLElement>(null);
  const selectionNotice = useRef<HTMLDivElement>(null);
  const requestedFlower = useRef(targetFlowerId);
  const focusedFlower = useRef<string | null>(null);
  const overviewReady = useRef(false);
  const polling = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  useEffect(() => {
    if (section !== "overview") return;
    overviewReady.current = false;
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
      else { setFlowers(null); problems.push("Les récoltes en attente du jury sont momentanément indisponibles."); }
      if (result[1].status === "fulfilled" && Array.isArray(result[1].value.lots) && typeof result[1].value.serverNow === "string") {
        currentStorage = result[1].value as KqStorageSnapshot;
        received = performance.now();
        setStorage(currentStorage);
      } else { currentStorage = null; setStorage(null); problems.push("Le suivi du stockage est momentanément indisponible."); }
      overviewReady.current = true;
      setErrors(problems); setLoaded(true);
    };
    const stop = startArenaVisiblePolling(refresh, () => getKqStorageRefreshDelay(currentStorage, performance.now() - received));
    polling.current = stop;
    const unsubscribe = api.subscribe(["kq:storage-updated", "kq:equipment-updated", "arena:progress-updated"], () => void stop.refresh());
    return () => { controller.abort(); stop(); unsubscribe(); polling.current = null; };
  }, [api, section]);
  const rows = getKqHarvestRows(flowers ?? [], storage);
  const visible = rows.filter(row => filter === "all" || (filter === "jury" ? isKqHarvestAtJury(row) : !isKqHarvestAtJury(row)));
  const selectedExists = rows.some(row => row.id === targetFlowerId);
  const selectedVisible = visible.some(row => row.id === targetFlowerId);
  const selection = !targetFlowerId ? "none" : !loaded ? "loading" : selectedExists ? "selected" : errors.length ? "unavailable" : "missing";
  useEffect(() => {
    if (requestedFlower.current !== targetFlowerId || section !== "overview") {
      requestedFlower.current = targetFlowerId;
      focusedFlower.current = null;
    }
    if (section !== "overview" || !overviewReady.current || !targetFlowerId || focusedFlower.current === targetFlowerId) return;
    const frame = requestAnimationFrame(() => {
      if (selectedExists && !selectedVisible) {
        setFilter("all");
        return;
      }
      const target = selectedExists
        ? Array.from(page.current?.querySelectorAll<HTMLElement>("[data-harvest-id]") ?? []).find(node => node.dataset.harvestId === targetFlowerId)
        : selectionNotice.current;
      if (!target) return;
      focusedFlower.current = targetFlowerId;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [section, targetFlowerId, selectedExists, selectedVisible, storage, flowers, errors]);
  function openStorage(flowerId: string) {
    setLastOpenedFlower(flowerId);
    onSectionChange("storage", flowerId);
  }
  function retrySelection() {
    focusedFlower.current = null;
    void polling.current?.refresh();
  }
  const juryCount = rows.filter(row => isKqHarvestAtJury(row)).length;
  const filterLabel = (label: string, count: number) => !loaded ? label
    : `${label} · ${count}${errors.length ? ` connue${count > 1 ? "s" : ""}` : ""}`;
  const harvestCounts = [
      { label: "Jury et duels", value: rows.filter(row => ["jury", "queued", "duel"].includes(row.state)).length, tone: "ink" as const },
      { label: "Stockage à vérifier", value: rows.filter(row => row.state === "storage").length, tone: "ink" as const },
      { label: "En affinage", value: rows.filter(row => row.state === "curing").length, tone: "gold" as const },
      { label: "Prêtes à vendre", value: rows.filter(row => row.state === "ready").length, tone: "teal" as const },
      { label: "Sans vrac restant", value: rows.filter(row => row.state === "empty").length, tone: "ink" as const },
      { label: "Surplus à protéger", value: rows.filter(row => row.state === "overflow").length, tone: "red" as const },
  ].filter(item => item.value > 0);
  return <main ref={page} className={styles.page} data-placard-harvests>
    <KqChapterHeading art="harvest" title="Mes récoltes" />
    <nav className={styles.tabs} aria-label="Parcours des récoltes">
      <button type="button" data-harvest-overview aria-current={section === "overview" ? "page" : undefined} onClick={() => onSectionChange("overview", targetFlowerId)}>Toutes mes récoltes</button>
      <button type="button" aria-current={section === "storage" ? "page" : undefined} onClick={() => onSectionChange("storage", targetFlowerId)}>Stockage & affinage</button>
      <button type="button" onClick={() => onOpenArena()}>Jury & duels</button>
    </nav>
    {section === "storage" ? <KqHarvestStorage initialFlowerId={targetFlowerId} onOpenMarket={onOpenMarket} onOpenArena={onOpenArena} onOpenOverview={flowerId => onSectionChange("overview", flowerId)} onOpenWarehouse={onOpenWarehouse} showOverviewLink={false} /> : <>
      <div className={styles.toolbar}><label className={styles.filterControl}><span className={styles.visuallyHidden}>Filtrer les récoltes</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{filterLabel("Toutes les récoltes", rows.length)}</option><option value="jury">{filterLabel("Jury et duels", juryCount)}</option><option value="stock">{filterLabel("Stockage et vente", rows.length - juryCount)}</option></select><ChevronDown size={18} className={styles.filterChevron} aria-hidden="true" /></label><button type="button" aria-label="Actualiser les récoltes" onClick={() => void polling.current?.refresh()}><RefreshCw size={18} aria-hidden="true" /></button></div>
      {loaded && rows.length > 0 && errors.length ? <p className={styles.partialSummary} data-harvest-summary-unavailable>Liste partielle : seules les récoltes retrouvées sont comptées.</p> : null}
      {errors.map(error => <p role="alert" key={error} className={styles.error}>{error} <button type="button" onClick={() => void polling.current?.refresh()}>Réessayer</button></p>)}
      {targetFlowerId && selection !== "selected" ? <div ref={selectionNotice} className={styles.selectionNotice} data-harvest-selection={selection} tabIndex={-1} role={selection === "unavailable" ? "alert" : "status"}><div><strong>Lot {targetFlowerId.slice(0, 8)}</strong><p>{selection === "loading" ? "Recherche dans tes récoltes…" : selection === "unavailable" ? "Impossible de retrouver ce lot tant que les données sont indisponibles." : "Ce lot n’apparaît plus dans tes récoltes. Il a pu être vendu ou transformé."}</p></div>{selection !== "loading" ? <button type="button" data-harvest-selection-retry onClick={retrySelection}><RefreshCw size={15} aria-hidden="true" /> Réessayer</button> : null}</div> : null}
      {!loaded ? <p role="status" className={styles.empty}>Ouverture de tes récoltes…</p> : visible.length ? <ul className={styles.list}>{visible.map(row => <li key={row.id} data-harvest-id={row.id} data-harvest-state={row.state} data-selected={row.id === targetFlowerId || undefined} tabIndex={-1} aria-label={`Lot ${row.name} · ${row.id.slice(0, 8)}`}>
        <KqLotSummary source={{ kind: "harvest", row }} selected={row.id === targetFlowerId} artwork={row.lot ? <PackageCheck size={27} /> : <Sprout size={27} />}>
        <div className={styles.actions}>{getKqHarvestActions(row).map((action, index) => <button key={action.destination} type="button" className={index === 0 ? styles.primary : undefined}
          data-harvest-open-storage={action.destination === "storage" ? row.id : undefined}
          data-harvest-action={action.destination}
          onClick={() => action.destination === "storage" ? openStorage(row.id) : action.destination === "arena" ? onOpenArena(row.id) : onOpenMarket(row.id, action.section)}>
          {action.destination === "arena" ? <Swords size={16} aria-hidden="true" /> : null}{action.label}{index === 0 ? <ArrowRight size={16} aria-hidden="true" /> : null}
        </button>)}</div></KqLotSummary>
      </li>)}</ul> : !errors.length ? <div className={styles.empty}><Sprout size={32} aria-hidden="true" /><h3>{filter === "all" ? "Ta prochaine récolte commence ici" : "Aucune récolte dans cette catégorie"}</h3><p>{filter === "all" ? "Lance une culture. Tu retrouveras sa récolte ici, jusqu’à sa vente." : "Les autres récoltes restent accessibles dans la liste complète."}</p><button type="button" className={styles.primary} onClick={filter === "all" ? onOpenGame : () => setFilter("all")}>{filter === "all" ? "Commencer une culture" : "Voir toutes mes récoltes"}<ArrowRight size={16} /></button></div> : null}
      {loaded && rows.length > 0 ? <details className={styles.distribution} data-harvest-distribution><summary>Répartition par étape</summary><KqAllocationBar label={errors.length ? "Récoltes disponibles · données partielles" : `${rows.length} récolte${rows.length > 1 ? "s" : ""} par étape`} items={harvestCounts.map(item => ({ ...item, displayValue: String(item.value) }))} />{rows.some(row => row.state === "overflow" && isKqHarvestAtJury(row)) ? <p>Chaque récolte est comptée une seule fois. Un lot avec surplus figure dans « Surplus à protéger », même pendant son passage au jury.</p> : null}</details> : null}
      <details className={styles.note}><summary>De la récolte à la vente</summary><p>Range tes fleurs par variété. L’affinage dure 6 heures réelles dès la récolte, même hors connexion. Présente ensuite la Fleur d’Arène au jury : sa conservation compte dans l’évaluation. La Fleur d’Arène est consommée, mais le stock récolté reste disponible pour la vente, sans recommencer l’affinage.</p></details>
    </>}
  </main>;
}
