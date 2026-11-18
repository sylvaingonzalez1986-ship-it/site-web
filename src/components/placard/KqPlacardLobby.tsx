"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getKqPlacardResume } from "@/lib/kanab-quest-hub";
import type { KqPlacardResumeAttention } from "@/lib/kanab-quest-hub";
import type { KqPlayerWorkAvailability } from "@/lib/kanab-quest-player-work";
import { getKqHubFinanceAttention } from "@/lib/kanab-quest-hub-finance";
import { getKqHubSalesAttention } from "@/lib/kanab-quest-hub-sales";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqStorageRefreshDelay, KQ_STORAGE_REFRESH_MS } from "@/lib/kanab-quest-storage-refresh";
import { useKqTentSelection } from "./KqTentSelector";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqPlacardMap, type PlacardMapOpen } from "./KqPlacardMap";
import { KqFinancialSupport } from "./KqFinancialSupport";
import styles from "./KqPlacardLobby.module.css";

type LobbySnapshot = {
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  curingFlowerCount?: number;
  trimFlowerCount?: number;
  productionUnits?: number;
  ownedCodes: string[];
  cashCents: number;
};

export function KqPlacardLobby({ onOpen, onOpenCollection, highlightedBuilding, workAvailability, children, teamPanel, showMap = true }: {
  onOpen: PlacardMapOpen;
  onOpenCollection: () => void;
  highlightedBuilding?: string | null;
  workAvailability?: KqPlayerWorkAvailability;
  children?: ReactNode;
  teamPanel?: ReactNode;
  showMap?: boolean;
}) {
  const api = useKqTutorialApi();
  const tentNumber = useKqTentSelection();
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const resumeHeading = useRef<HTMLHeadingElement>(null);
  const activityPolling = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  const storagePolling = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
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
          || (data.curingFlowerCount !== undefined && (!Number.isSafeInteger(data.curingFlowerCount) || data.curingFlowerCount < 0))
          || (data.trimFlowerCount !== undefined && (!Number.isSafeInteger(data.trimFlowerCount) || data.trimFlowerCount < 0))) throw new Error("Résumé incomplet");
        if (!controller.signal.aborted) { setSnapshot(data); setError(false); }
      } catch {
        if (!controller.signal.aborted) { setSnapshot(null); setError(true); }
      }
    };
    const polling = startArenaVisiblePolling(refresh, KQ_STORAGE_REFRESH_MS);
    activityPolling.current = polling;
    const unsubscribe = api.subscribe(["kq:equipment-updated", "kq:storage-updated", "arena:progress-updated"], () => void polling.refresh());
    return () => { controller.abort(); polling(); unsubscribe(); activityPolling.current = null; };
  }, [api, tentNumber]);

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
    storagePolling.current = polling;
    const unsubscribe = api.subscribe(["kq:storage-updated", "kq:equipment-updated", "arena:progress-updated"], () => void polling.refresh());
    return () => { controller.abort(); polling(); unsubscribe(); storagePolling.current = null; };
  }, [api]);

  const resume = getKqPlacardResume(snapshot, storage, attention, workAvailability);
  const nextAction = resume.primary;
  const loading = !storageLoaded || (!snapshot && !error);
  const recommended = resume.kind === "storage" ? "harvests" : nextAction?.destination === "shop" || nextAction?.destination === "storage" ? "workshop" : nextAction?.destination;
  const tents = snapshot ? getKqProductionUnits(snapshot.productionUnits) : null;
  const openResumeView = onOpen;
  const retrySummary = async () => {
    if (refreshing) return;
    const origin = document.activeElement instanceof HTMLElement && document.activeElement.hasAttribute("data-resume-retry") ? document.activeElement : null;
    setRefreshing(true);
    await Promise.all([activityPolling.current?.refresh(), storagePolling.current?.refresh(), attentionPolling.current?.refresh()]);
    // Recovery controls may disappear after success. Keep keyboard users in the summary.
    if (origin && (document.activeElement === origin || (!origin.isConnected && document.activeElement === document.body))) resumeHeading.current?.focus({ preventScroll: true });
    setRefreshing(false);
  };
  const renderFact = (fact: string) => {
    const action = resume.factActions.find(notice => notice.summary === fact);
    return <li key={fact}>{action?.href ? <a className={styles.factAction} data-resume-notice={action.id} href={action.href}>{fact}<ArrowRight size={15} aria-hidden="true" /></a> : action ? <button className={styles.factAction} type="button" data-resume-notice={action.id} onClick={() => openResumeView(action.destination, action.options)}>{fact}<ArrowRight size={15} aria-hidden="true" /></button> : <>{fact}{fact === resume.attentionStatus && resume.canRefreshAttention ? <button className={styles.factAction} type="button" data-resume-refresh onClick={() => void attentionPolling.current?.refresh()}>Actualiser le suivi<ArrowRight size={15} aria-hidden="true" /></button> : null}</>}</li>;
  };

  return <main className={styles.lobby} data-placard-lobby aria-label="Mon quartier" tabIndex={-1}>
    <div className={styles.quarterLayout} data-summary-only={!showMap || undefined}>
    <div className={styles.dayBrief}>
    {teamPanel}
    {loading ? <div className={styles.loading} role="status">Vérification de tes activités et de ton stockage…</div> : <section className={styles.nextAction} aria-label={resume.tone === "attention" ? "À faire maintenant" : resume.tone === "waiting" ? "Attente automatique" : "Reprendre ma partie"} data-placard-next-action data-priority={resume.kind} data-tone={resume.tone}>
      <span className={styles.guidePortrait} aria-hidden="true"><Image src="/sylvain.png" alt="" width={88} height={88} /></span>
      <div className={styles.actionCopy}><span>{nextAction?.eyebrow ?? "Informations à vérifier"}</span><h2 ref={resumeHeading} tabIndex={-1}>{nextAction?.title ?? "Ton résumé est indisponible"}</h2></div>
      {nextAction?.href ? <a href={nextAction.href} data-resume-trim>{nextAction.buttonLabel}<ArrowRight size={17} aria-hidden="true" /></a> : nextAction ? <button type="button" onClick={() => resume.kind === "storage" ? onOpen("harvests", { harvestSection: "storage" }) : openResumeView(nextAction.destination === "shop" || nextAction.destination === "storage" ? "workshop" : nextAction.destination, nextAction.options ?? (nextAction.destination === "storage" ? { warehouseSection: "storage" } : nextAction.destination === "shop" ? { catalog: true } : nextAction.destination === "market" ? { marketSection: "sales" } : undefined))}>{nextAction.buttonLabel}<ArrowRight size={17} aria-hidden="true" /></button> : <button type="button" data-resume-retry disabled={refreshing} onClick={() => void retrySummary()}>{refreshing ? "Vérification…" : "Réessayer"}<ArrowRight size={17} aria-hidden="true" /></button>}
      <p className={styles.actionDescription} data-village-reply>{nextAction?.description ?? "Les activités restent accessibles. Réessaie pour confirmer ce qui est prêt et ce qui demande une intervention."}</p>
      {resume.workNotice ? <p className={styles.actionDescription} data-resume-work-notice>{resume.workNotice}</p> : null}
      {nextAction && (error || !storage || refreshing) ? <div className={styles.recovery}><p>Résumé partiel : {error ? "les activités" : "le stockage"} {error ? "restent" : "reste"} à vérifier.</p><button type="button" data-resume-retry disabled={refreshing} onClick={() => void retrySummary()}>{refreshing ? "Vérification…" : "Actualiser le résumé"}</button></div> : null}
      {resume.facts.length ? <ul className={styles.resumeFacts} aria-label="Autres informations utiles">{resume.facts.map(renderFact)}</ul> : null}
      {resume.additionalFacts.length ? <details className={styles.moreActivities} data-resume-details><summary>Autres activités ({resume.additionalFacts.length})</summary><ul className={styles.resumeFacts}>{resume.additionalFacts.map(renderFact)}</ul></details> : null}
    </section>}
    {children}
    </div>
    {showMap ? <KqPlacardMap onOpen={onOpen} onOpenCollection={onOpenCollection} activeRun={snapshot?.activeRun} cashCents={snapshot?.cashCents ?? null} tents={tents} readyLotCount={snapshot?.readyLotCount} availableFlowerCount={snapshot?.availableFlowerCount} curingFlowerCount={snapshot?.curingFlowerCount} recommended={recommended} highlightedBuilding={highlightedBuilding} /> : null}
    </div>
    {!api.isTutorial ? <KqFinancialSupport /> : null}
  </main>;
}
