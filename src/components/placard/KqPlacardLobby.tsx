"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getKqPlacardResume } from "@/lib/kanab-quest-hub";
import type { KqPlacardResumeAttention } from "@/lib/kanab-quest-hub";
import { getKqHubFinanceAttention } from "@/lib/kanab-quest-hub-finance";
import { getKqHubSalesAttention } from "@/lib/kanab-quest-hub-sales";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay, KQ_STORAGE_REFRESH_MS } from "@/lib/kanab-quest-storage-refresh";
import { ArenaLearningLauncher } from "../contest/ArenaLearningLauncher";
import { useKqTentSelection } from "./KqTentSelector";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqPlacardMap, type PlacardMapOpen } from "./KqPlacardMap";
import styles from "./KqPlacardLobby.module.css";

type LobbySnapshot = {
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  curingFlowerCount?: number;
  productionUnits?: number;
  ownedCodes: string[];
  cashCents: number;
};

export function KqPlacardLobby({ onOpen, onOpenCollection, highlightedBuilding, children }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
  highlightedBuilding?: string | null;
  children?: ReactNode;
}) {
  const api = useKqTutorialApi();
  const tentNumber = useKqTentSelection();
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [attentionState, setAttentionState] = useState<{ api: typeof api; value: KqPlacardResumeAttention } | null>(null);
  const attentionPolling = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  const attention = attentionState?.api === api ? attentionState.value : { finance: null, sales: null, loading: true };

  useEffect(() => {
    const controller = new AbortController();
    const polling = startArenaVisiblePolling(async () => {
      try {
        // The existing snapshot applies the game's ordinary time-based settlements.
        // This advice issues no manual payment, purchase, listing or sale command.
        const response = await api.request("/api/arena/placard/commerce?shop=1", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new Error("Suivi indisponible");
        const data: unknown = await response.json();
        const value = { finance: getKqHubFinanceAttention(data), sales: getKqHubSalesAttention(data), loading: false };
        if (!controller.signal.aborted) setAttentionState({ api, value });
      } catch {
        if (!controller.signal.aborted) setAttentionState({ api, value: { finance: null, sales: null, loading: false } });
      }
    }, 60_000);
    attentionPolling.current = polling;
    const unsubscribe = api.subscribe(["kq:commerce-updated", "kq:treasury-updated", "kq:equipment-updated"], () => void polling.refresh());
    return () => { controller.abort(); polling(); unsubscribe(); attentionPolling.current = null; };
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await api.request(`/api/arena/placard/equipment?tentNumber=${tentNumber}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new Error("Résumé indisponible");
        const data = await response.json() as LobbySnapshot;
        if (typeof data.activeRun !== "boolean" || !Array.isArray(data.ownedCodes) || !Number.isFinite(data.cashCents)
          || !Number.isSafeInteger(data.readyLotCount) || data.readyLotCount < 0
          || !Number.isSafeInteger(data.availableFlowerCount) || data.availableFlowerCount < 0
          || (data.curingFlowerCount !== undefined && (!Number.isSafeInteger(data.curingFlowerCount) || data.curingFlowerCount < 0))) throw new Error("Résumé incomplet");
        if (!controller.signal.aborted) { setSnapshot(data); setError(false); }
      } catch {
        if (!controller.signal.aborted) { setSnapshot(null); setError(true); }
      }
    };
    const polling = startArenaVisiblePolling(refresh, KQ_STORAGE_REFRESH_MS);
    const unsubscribe = api.subscribe(["kq:equipment-updated", "kq:storage-updated", "arena:progress-updated"], () => void polling.refresh());
    return () => { controller.abort(); polling(); unsubscribe(); };
  }, [api, revision, tentNumber]);

  useEffect(() => {
    const controller = new AbortController();
    let latest: KqStorageSnapshot | null = null;
    let received = 0;
    const refresh = async () => {
      try {
        const response = await api.request("/api/arena/placard/storage", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new Error("Stockage indisponible");
        const data = await response.json() as KqStorageSnapshot;
        if (!Array.isArray(data.lots) || typeof data.serverNow !== "string" || !Number.isFinite(Date.parse(data.serverNow)) || data.lots.some(lot => {
          const projection = lot?.projection;
          const capacity = projection?.capacity;
          return !projection || typeof projection.nextChangeAt !== "string" || !Number.isFinite(Date.parse(projection.nextChangeAt))
            || typeof lot.flowerStatus !== "string" || !["curing", "ready"].includes(projection.stage)
            || typeof projection.readyAt !== "string" || !Number.isFinite(Date.parse(projection.readyAt))
            || (capacity != null && (!Number.isFinite(capacity.overflowUnits) || capacity.overflowUnits < 0
              || (capacity.overflowDeadlineAt != null && (typeof capacity.overflowDeadlineAt !== "string" || !Number.isFinite(Date.parse(capacity.overflowDeadlineAt))))));
        })) throw new Error("Résumé du stockage incomplet");
        if (controller.signal.aborted) return;
        latest = data;
        received = performance.now();
        setStorage(data);
      } catch {
        if (controller.signal.aborted) return;
        latest = null;
        setStorage(null);
      } finally {
        if (!controller.signal.aborted) setStorageLoaded(true);
      }
    };
    const polling = startArenaVisiblePolling(refresh, () => getKqStorageRefreshDelay(latest, performance.now() - received));
    const unsubscribe = api.subscribe(["kq:storage-updated", "kq:equipment-updated", "arena:progress-updated"], () => void polling.refresh());
    return () => { controller.abort(); polling(); unsubscribe(); };
  }, [api, revision]);

  const resume = getKqPlacardResume(snapshot, storage, attention);
  const nextAction = resume.primary;
  const loading = !storageLoaded || (!snapshot && !error);
  const recommended = resume.kind === "storage" ? "harvests" : nextAction?.destination === "shop" || nextAction?.destination === "storage" ? "workshop" : nextAction?.destination;
  const tents = snapshot ? getKqProductionUnits(snapshot.productionUnits) : null;

  return <main className={styles.lobby} data-placard-lobby>
    {loading ? <div className={styles.loading} role="status">Vérification de tes activités et de ton stockage…</div> : <section className={styles.nextAction} aria-label={resume.tone === "attention" ? "À faire maintenant" : resume.tone === "waiting" ? "Attente automatique" : "Reprendre ma partie"} data-placard-next-action data-priority={resume.kind} data-tone={resume.tone}>
      <span className={styles.guidePortrait} aria-hidden="true"><Image src="/sylvain.png" alt="" width={88} height={88} /></span>
      <div className={styles.actionCopy}><span>{nextAction?.eyebrow ?? "Informations à vérifier"}</span><h2>{nextAction?.title ?? "Ton résumé est indisponible"}</h2><p data-village-reply>{nextAction?.description ?? "Les activités restent accessibles. Réessaie pour confirmer ce qui est prêt et ce qui demande une intervention."}</p></div>
      {nextAction ? <button type="button" onClick={() => resume.kind === "storage" ? onOpen("harvests", { harvestSection: "storage" }) : onOpen(nextAction.destination === "shop" || nextAction.destination === "storage" ? "workshop" : nextAction.destination, nextAction.options ?? (nextAction.destination === "storage" ? { warehouseSection: "storage" } : nextAction.destination === "shop" ? { catalog: true } : nextAction.destination === "market" ? { marketSection: "sales" } : undefined))}>{nextAction.buttonLabel}<ArrowRight size={17} aria-hidden="true" /></button> : <button type="button" onClick={() => { setError(false); setStorageLoaded(false); setRevision(value => value + 1); void attentionPolling.current?.refresh(); }}>Réessayer<ArrowRight size={17} aria-hidden="true" /></button>}
      {nextAction && resume.facts.length ? <ul className={styles.resumeFacts} aria-label="Autres informations utiles">{resume.facts.map(fact => {
        const action = resume.factActions.find(notice => notice.summary === fact);
        return <li key={fact}>{action ? <button className={styles.factAction} type="button" data-resume-notice={action.id} onClick={() => onOpen(action.destination, action.options)}>{fact}<ArrowRight size={15} aria-hidden="true" /></button> : <>{fact}{fact === resume.attentionStatus && resume.canRefreshAttention ? <button className={styles.factAction} type="button" data-resume-refresh onClick={() => void attentionPolling.current?.refresh()}>Actualiser le suivi<ArrowRight size={15} aria-hidden="true" /></button> : null}</>}</li>;
      })}</ul> : null}
    </section>}
    {children}
    <KqPlacardMap onOpen={onOpen} onOpenCollection={onOpenCollection} activeRun={snapshot?.activeRun} cashCents={snapshot?.cashCents ?? null} tents={tents} readyLotCount={snapshot?.readyLotCount} availableFlowerCount={snapshot?.availableFlowerCount} curingFlowerCount={snapshot?.curingFlowerCount} recommended={recommended} highlightedBuilding={highlightedBuilding} />
    <div className={styles.learning} data-placard-learning-entry><ArenaLearningLauncher className={styles.learningButton} /></div>
  </main>;
}
