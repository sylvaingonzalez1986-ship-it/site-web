"use client";

import type { KqHarvestMarketSection } from "@/lib/kanab-quest-harvests";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw, Warehouse } from "lucide-react";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { createClientRequestKey } from "@/lib/client-request-key";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay, KQ_STORAGE_REFRESH_MS } from "@/lib/kanab-quest-storage-refresh";
import { KqWarehouseHarvests } from "./KqWarehouseHarvests";
import { KqStorageInventory } from "./KqStorageInventory";
import { openKqStoragePlacement } from "./KqStoragePlacement";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqHarvestStorage.module.css";

function isStorageSnapshot(value: KqStorageSnapshot | null): value is KqStorageSnapshot {
  return !!value && Array.isArray(value.lots) && Number.isFinite(Date.parse(value.serverNow))
    && !!value.capacity && [value.capacity.totalUnits, value.capacity.reservedUnits].every(Number.isFinite);
}

/** Shared stock manager, whether entered from a harvest or from the warehouse. */
export function KqHarvestStorage({ initialFlowerId, onOpenMarket, onOpenArena, onOpenOverview, onOpenWarehouse, juryReturnView = "harvests", showOverviewLink = true, showWarehouseLink = true, disabled = false, onBusyChange, onStorageChange, onErrorChange }: {
  initialFlowerId?: string;
  onOpenMarket: (flowerId?: string, section?: KqHarvestMarketSection) => void;
  onOpenArena?: (flowerId?: string) => void;
  onOpenOverview: (flowerId?: string) => void;
  onOpenWarehouse?: (flowerId?: string) => void;
  juryReturnView?: "harvests" | "workshop";
  showOverviewLink?: boolean;
  showWarehouseLink?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onStorageChange?: (storage: KqStorageSnapshot) => void;
  onErrorChange?: (error: string) => void;
}) {
  const api = useKqTutorialApi();
  const root = useRef<HTMLDivElement>(null);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const poll = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  const current = useRef<{ storage: KqStorageSnapshot; received: number } | null>(null);
  const failed = useRef(false);
  const mounted = useRef(false);
  const version = useRef(0);
  const mutation = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const callbacks = useRef({ onBusyChange, onStorageChange });
  useEffect(() => { callbacks.current = { onBusyChange, onStorageChange }; }, [onBusyChange, onStorageChange]);
  useEffect(() => { onErrorChange?.(error); }, [error, onErrorChange]);

  function accept(value: KqStorageSnapshot) {
    current.current = { storage: value, received: performance.now() };
    failed.current = false;
    setStorage(value); setError("");
    callbacks.current.onStorageChange?.(value);
  }

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const stop = startArenaVisiblePolling(async () => {
      if (mutation.current || controller.signal.aborted) return;
      const readVersion = ++version.current;
      try {
        const response = await api.request("/api/arena/placard/storage", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Le stockage est momentanément indisponible.");
        if (!isStorageSnapshot(body)) throw new Error("Les informations de conservation sont incomplètes.");
        if (!controller.signal.aborted && readVersion === version.current && !mutation.current) accept(body);
      } catch (reason) {
        if (!controller.signal.aborted && readVersion === version.current && !mutation.current) {
          failed.current = true;
          setError(reason instanceof Error ? reason.message : "Lecture du stockage impossible.");
        }
      }
    }, () => failed.current || mutation.current ? KQ_STORAGE_REFRESH_MS : getKqStorageRefreshDelay(current.current?.storage ?? null, current.current ? performance.now() - current.current.received : 0));
    poll.current = stop;
    const unsubscribe = api.subscribe(["kq:storage-updated", "kq:equipment-updated", "arena:progress-updated"], () => void stop.refresh());
    return () => { mounted.current = false; version.current += 1; controller.abort(); stop(); unsubscribe(); poll.current = null; callbacks.current.onBusyChange?.(false); };
  }, [api]);

  async function act(action: { action: "sell-overflow"; flowerId: string } | { action: "place"; flowerId: string; containerCode: string }): Promise<boolean> {
    const lot = current.current?.storage.lots.find(lot => lot.flowerId === action.flowerId);
    if (disabled || mutation.current || failed.current || !lot || (action.action === "sell-overflow" && !lot.overflowOffer)) return false;
    mutation.current = true; version.current += 1;
    callbacks.current.onBusyChange?.(true);
    setPending(true); setError(""); setNotice("");
    const fingerprint = JSON.stringify(action);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: createClientRequestKey() };
    try {
      const response = await api.request("/api/arena/placard/storage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...action, requestKey: request.current.key }), signal: AbortSignal.timeout(20_000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "La modification du stockage est indisponible.");
      if (!isStorageSnapshot(body)) throw new Error("Le reçu est incomplet. Actualise le stockage avant de réessayer.");
      if (mounted.current) { accept(body); setNotice(action.action === "place" ? `${lot.varietyName} : rangement enregistré. Les autres lots restent dans leurs contenants.` : "Surplus vendu au grossiste. Le reste du lot est conservé."); }
      request.current = null;
      api.notify("kq:storage-updated"); api.notify("kq:equipment-updated");
      return true;
    } catch (reason) {
      failed.current = true;
      if (mounted.current) setError(reason instanceof Error ? reason.message : "Modification impossible.");
      return false;
    } finally {
      mutation.current = false;
      callbacks.current.onBusyChange?.(false);
      if (mounted.current) setPending(false);
      poll.current?.reschedule();
    }
  }

  const warehouseHref = (flowerId?: string) => `/arene/placard?view=workshop&section=storage&configure=storage&from=harvests&fromSection=storage${flowerId ? `&flower=${encodeURIComponent(flowerId)}&fromFlower=${encodeURIComponent(flowerId)}` : ""}`;
  function openLot(flowerId: string) {
    if (openKqStoragePlacement(root.current, flowerId)) return;
    const target = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-conservation-lot]") ?? [])
      .find(lot => lot.dataset.conservationLot === flowerId);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return <div ref={root} data-harvest-storage>
    <KqStorageInventory snapshot={storage} selectedFlowerId={initialFlowerId} onOpenLot={openLot} />
    <div className={styles.storageTools}>
      <div>
        {showWarehouseLink && (onOpenWarehouse ? <button type="button" data-harvest-open-warehouse disabled={pending || disabled} onClick={() => onOpenWarehouse(initialFlowerId)}><Warehouse size={16} aria-hidden="true" />Augmenter la capacité<ArrowRight size={16} aria-hidden="true" /></button>
          : <Link data-harvest-open-warehouse aria-disabled={pending || disabled || undefined} onClick={event => { if (pending || disabled) event.preventDefault(); }} href={warehouseHref(initialFlowerId)}><Warehouse size={16} aria-hidden="true" />Augmenter la capacité<ArrowRight size={16} aria-hidden="true" /></Link>)}
        <button type="button" aria-label="Actualiser le stockage" disabled={pending} onClick={() => void poll.current?.refresh()}><RefreshCw size={16} aria-hidden="true" /></button>
      </div>
    </div>
    {notice ? <p className={styles.storageNotice} role="status">{notice}</p> : null}
    <KqWarehouseHarvests storage={storage} initialFlowerId={initialFlowerId} disabled={pending || disabled} error={error} showOverviewLink={showOverviewLink}
      onRetry={() => void poll.current?.refresh()} onOpenHarvests={onOpenOverview}
      onOpenWorkshop={onOpenMarket} onOpenArena={onOpenArena} juryReturnView={juryReturnView} onSellOverflow={flowerId => void act({ action: "sell-overflow", flowerId })}
      onPlace={(flowerId, containerCode) => act({ action: "place", flowerId, containerCode })}
      onProtectOverflow={onOpenWarehouse} warehouseHref={warehouseHref} />
    <details className={styles.help} data-storage-curing-help><summary>Comment fonctionne l’affinage ?</summary><p>L’affinage dure 6 heures réelles dès la récolte et continue hors connexion. Choisis les contenants de chaque variété, puis présente sa Fleur d’Arène au jury une fois le lot affiné. Le jury consomme la Fleur d’Arène ; le stock récolté est conservé pour la vente.</p></details>
  </div>;
}
