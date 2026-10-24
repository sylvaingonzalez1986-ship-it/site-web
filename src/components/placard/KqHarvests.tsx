"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock3, PackageCheck, RefreshCw, Sprout, Swords } from "lucide-react";
import type { KqOfficialFlower, KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { getKqHarvestRows, type KqHarvestState } from "@/lib/kanab-quest-harvests";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay } from "@/lib/kanab-quest-storage-refresh";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqWarehouseEntry } from "./KqWarehouseEntry";
import { KqStorageStatus } from "./KqStorageStatus";
import { KqAllocationBar } from "./KqVisuals";
import { KqChapterHeading } from "./KqChapterHeading";
import styles from "./KqHarvests.module.css";

const labels: Record<KqHarvestState, string> = { jury: "À présenter au jury", queued: "Adversaire recherché", duel: "Duel en cours", overflow: "Du surplus à protéger", curing: "En affinage", ready: "Prête à vendre" };
export function KqHarvests({ section, initialFlowerId, draftOwnerId, onSectionChange, onOpenArena, onOpenMarket, onOpenGame, onOpenCulture }: {
  section: "overview" | "storage";
  initialFlowerId?: string;
  draftOwnerId?: string;
  onSectionChange: (section: "overview" | "storage", flowerId?: string) => void;
  onOpenArena: (flowerId?: string) => void;
  onOpenMarket: (flowerId?: string) => void;
  onOpenGame: () => void;
  onOpenCulture?: (href: string) => void;
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
  const visible = rows.filter(row => filter === "all" || (filter === "jury" ? !row.lot : !!row.lot));
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
  const harvestCounts = [
    ...(flowers !== null ? [{ label: "Jury et duels", value: rows.filter(row => !row.lot).length, tone: "ink" as const }] : []),
    ...(storage !== null ? [
      { label: "En affinage", value: rows.filter(row => row.state === "curing").length, tone: "gold" as const },
      { label: "Prêtes à vendre", value: rows.filter(row => row.state === "ready").length, tone: "teal" as const },
      { label: "Surplus à protéger", value: rows.filter(row => row.state === "overflow").length, tone: "red" as const },
    ] : []),
  ];
  return <main ref={page} className={styles.page} data-placard-harvests>
    <KqChapterHeading art="harvest" title="Mes récoltes" eyebrow="Du jury à la vente" />
    <nav className={styles.tabs} aria-label="Parcours des récoltes">
      <button type="button" data-harvest-overview aria-current={section === "overview" ? "page" : undefined} onClick={() => onSectionChange("overview", targetFlowerId)}>Toutes mes récoltes</button>
      <button type="button" onClick={() => onOpenArena()}>Jury & duels</button>
      <button type="button" aria-current={section === "storage" ? "page" : undefined} onClick={() => onSectionChange("storage", targetFlowerId)}>Stockage & affinage</button>
    </nav>
    {section === "storage" ? <KqWarehouseEntry embedded initialSection="storage" initialFlowerId={targetFlowerId} draftOwnerId={draftOwnerId} onOpenCulture={onOpenCulture} onClose={() => onSectionChange("overview", targetFlowerId)} /> : <>
      {loaded && rows.length > 0 ? <div className={styles.visualSummary}><KqAllocationBar label={errors.length ? "Récoltes disponibles · données partielles" : `${rows.length} récolte${rows.length > 1 ? "s" : ""} par étape`} items={harvestCounts.map(item => ({ ...item, displayValue: String(item.value) }))} />{errors.length ? <p className={styles.partialSummary} data-harvest-summary-unavailable>{flowers === null ? "Jury et duels : données indisponibles." : "Affinage, vente et surplus : données indisponibles."}</p> : null}</div> : null}
      <div className={styles.toolbar}><label>Afficher<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Toutes les récoltes</option><option value="jury">Jury et duels</option><option value="stock">Stockage et vente</option></select></label><button type="button" aria-label="Actualiser les récoltes" onClick={() => void polling.current?.refresh()}><RefreshCw size={18} /></button></div>
      {errors.map(error => <p role="alert" key={error} className={styles.error}>{error} <button type="button" onClick={() => void polling.current?.refresh()}>Réessayer</button></p>)}
      {targetFlowerId && selection !== "selected" ? <div ref={selectionNotice} className={styles.selectionNotice} data-harvest-selection={selection} tabIndex={-1} role={selection === "unavailable" ? "alert" : "status"}><div><strong>Lot {targetFlowerId.slice(0, 8)}</strong><p>{selection === "loading" ? "Recherche dans tes récoltes…" : selection === "unavailable" ? "Impossible de retrouver ce lot tant que les données sont indisponibles." : "Ce lot n’apparaît plus dans tes récoltes. Il a pu être vendu ou transformé."}</p></div>{selection !== "loading" ? <button type="button" data-harvest-selection-retry onClick={retrySelection}><RefreshCw size={15} aria-hidden="true" /> Réessayer</button> : null}</div> : null}
      {!loaded ? <p role="status" className={styles.empty}>Ouverture de tes récoltes…</p> : visible.length ? <ul className={styles.list}>{visible.map(row => <li key={row.id} data-harvest-id={row.id} data-harvest-state={row.state} data-selected={row.id === targetFlowerId || undefined} tabIndex={-1} aria-label={`Lot ${row.name} · ${row.id.slice(0, 8)}`}>
        <div className={styles.harvestIcon} aria-hidden="true">{row.lot ? <PackageCheck size={27} /> : <Sprout size={27} />}</div>
        <div className={styles.identity}><span className={styles.state} data-urgent={row.state === "overflow" || undefined}>{labels[row.state]}</span><h3>{row.name}</h3>{row.id === targetFlowerId ? <small className={styles.selectionBadge} data-harvest-selection="selected">Lot sélectionné · {row.id.slice(0, 8)}</small> : null}
          {row.lot ? <KqStorageStatus storage={row.lot.projection} nowMs={Date.parse(storage!.serverNow)} compact /> : null}
        </div>
        <div className={styles.actions}>{!row.lot ? <button type="button" className={styles.primary} onClick={() => onOpenArena(row.id)}><Swords size={16} />{row.state === "jury" ? "Présenter au jury" : "Suivre le duel"}<ArrowRight size={16} /></button> : <>
          {row.state === "overflow" ? <button type="button" className={styles.primary} data-harvest-open-storage={row.id} onClick={() => openStorage(row.id)}>Protéger le surplus<ArrowRight size={16} /></button> : null}
          <button type="button" className={row.state === "overflow" ? undefined : styles.primary} onClick={() => onOpenMarket(row.id)}>{row.lot.projection.stage === "ready" ? "Préparer ou vendre" : "Voir l’offre grossiste"}<ArrowRight size={16} /></button>
          {row.state !== "overflow" ? <button type="button" data-harvest-open-storage={row.id} onClick={() => openStorage(row.id)}><Clock3 size={15} /> Gérer le stockage</button> : null}
        </>}</div>
      </li>)}</ul> : !errors.length ? <div className={styles.empty}><Sprout size={32} aria-hidden="true" /><h3>{filter === "all" ? "Ta prochaine récolte commence ici" : "Aucune récolte dans cette catégorie"}</h3><p>{filter === "all" ? "Lance une culture. Tu retrouveras sa récolte ici, jusqu’à sa vente." : "Les autres récoltes restent accessibles dans la liste complète."}</p><button type="button" className={styles.primary} onClick={filter === "all" ? onOpenGame : () => setFilter("all")}>{filter === "all" ? "Commencer une culture" : "Voir toutes mes récoltes"}<ArrowRight size={16} /></button></div> : null}
      <details className={styles.note}><summary>Préparer la vente</summary><p>Le verdict du jury ouvre la vente. Tu peux suivre un duel ou quitter sa file dans Jury & duels. L’affinage (curing) dure 6 heures réelles après le verdict ; la vente aux grossistes reste possible pendant ce temps.</p></details>
    </>}
  </main>;
}
