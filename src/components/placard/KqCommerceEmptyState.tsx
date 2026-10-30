"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { getKqCommercePackagedStock, getKqCommerceWaitingHarvest, isKqCommerceWaitingStorage } from "@/lib/kanab-quest-commerce-guidance";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqCommerceEmptyState.module.css";

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
function navigate(event: MouseEvent<HTMLAnchorElement>, action?: () => void) {
  if (action && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); action(); }
}

/** Mounted only when the comptoir has no loose lot. Reading never places or sells a harvest. */
export function KqCommerceEmptyState({ data, onOpenStorage, onOpenCulture, onViewSales }: {
  data: KqCommerceSnapshot;
  onOpenStorage?: (flowerId?: string, lotId?: string) => void;
  onOpenCulture?: () => void;
  onViewSales: () => void;
}) {
  const api = useKqTutorialApi();
  const [storage, setStorage] = useState<KqStorageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const poll = useRef<ReturnType<typeof startArenaVisiblePolling> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const stop = startArenaVisiblePolling(async () => {
      try {
        const response = await api.request("/api/arena/placard/storage", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
        const payload = await response.json();
        if (!response.ok) throw new Error("Stockage indisponible : impossible de vérifier les récoltes en attente.");
        if (!isKqCommerceWaitingStorage(payload)) throw new Error("Stockage incomplet : impossible de confirmer la prochaine étape.");
        if (!controller.signal.aborted) { setStorage(payload); setError(""); }
      } catch (reason) {
        if (!controller.signal.aborted) { setStorage(null); setError(reason instanceof Error ? reason.message : "Stockage indisponible."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 60_000);
    poll.current = stop;
    const unsubscribe = api.subscribe(["kq:storage-updated", "arena:progress-updated"], () => void stop.refresh());
    return () => { controller.abort(); stop(); unsubscribe(); poll.current = null; };
  }, [api]);
  const advice = getKqCommerceWaitingHarvest(storage);
  const packets = getKqCommercePackagedStock(data);
  const hasPackets = packets !== null && packets.packets > 0;
  const storageHref = `/arene/placard?view=harvests&section=storage&from=market&fromSection=sales${advice ? `&flower=${encodeURIComponent(advice.lot.flowerId)}` : ""}`;
  const awaitingJury = advice && ["queued", "locked"].includes(advice.lot.flowerStatus);
  const title = advice ? advice.kind === "overflow" ? "Une récolte attend son contenant" : awaitingJury ? "Une récolte attend son verdict" : advice.kind === "ready" ? "Une récolte est prête pour le jury" : advice.kind === "curing" ? "Une récolte est en affinage" : "Une récolte est encore au stockage"
    : hasPackets ? "Tes paquets sont déjà préparés" : "Aucun lot en vrac au comptoir";
  return <section className={styles.empty} data-commerce-empty aria-label="La prochaine étape pour vendre">
    <h3>{title}</h3>
    {advice ? <>
      <p><strong>{advice.lot.varietyName}</strong>{Number.isFinite(advice.lot.harvestGrams) ? ` · ${number(advice.lot.harvestGrams)} g récoltés` : ""}</p>
      <p>{advice.kind === "overflow" ? `${number(advice.lot.projection.capacity!.overflowUnits / 10)} g sans contenant. Range ce surplus pour le protéger ; son délai et sa reprise éventuelle sont indiqués dans le stockage.`
        : awaitingJury ? "La vente s’ouvrira après le verdict. Retrouve cette récolte pour suivre son passage au jury."
        : advice.kind === "ready" ? "L’affinage est terminé. Retrouve cette récolte pour la présenter au jury avant de la vendre."
        : advice.kind === "curing" ? `Affinage prévu jusqu’au ${new Date(advice.readyAt!).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Le jury vient ensuite, avant la vente.`
        : "Vérifie son rangement et son affinage avant le jury. Son état exact reste à confirmer."}</p>
      <Link className={styles.primary} href={storageHref} prefetch={false} onClick={event => navigate(event, onOpenStorage ? () => onOpenStorage(advice.lot.flowerId) : undefined)}>{advice.kind === "overflow" ? "Ranger cette récolte" : "Retrouver cette récolte"}<ArrowRight size={18} aria-hidden="true" /></Link>
    </> : null}
    {hasPackets ? <div className={styles.packets}><p><strong>{number(packets.packets)} paquets · {number(packets.grams)} g</strong> déjà conditionnés. Leurs annonces, prix et états de vente sont dans « Mon stock en vente ».</p><Link className={advice ? styles.secondary : styles.primary} href="/arene/placard?view=market&section=dashboard" prefetch={false} onClick={event => navigate(event, onViewSales)}>Voir mon stock en vente<ArrowRight size={18} aria-hidden="true" /></Link></div> : null}
    {loading ? <p role="status">Vérification des récoltes en stockage…</p> : null}
    {error ? <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void poll.current?.refresh()}><RefreshCw size={15} aria-hidden="true" />Réessayer</button></p> : null}
    {packets === null ? <p className={styles.error}>Le suivi des paquets est indisponible. Leur absence n’est pas confirmée.</p> : null}
    {!advice && !hasPackets ? <>
      <p>{storage ? "Retrouve une culture en cours ou lance la suivante." : "Vérifie d’abord les récoltes en attente dans ton stockage."} Après la récolte : rangement, {api.isTutorial ? "6 heures d’affinage avec l’horloge fictive de l’essai" : "6 heures réelles d’affinage, même hors connexion"}, puis jury. Le verdict ouvre la vente.</p>
      <div className={styles.actions}>{!storage ? <Link className={styles.primary} href={storageHref} prefetch={false} onClick={event => navigate(event, onOpenStorage)}>Vérifier mon stockage<ArrowRight size={18} aria-hidden="true" /></Link> : null}<Link className={storage ? styles.primary : styles.secondary} href="/arene/placard?view=game" prefetch={false} onClick={event => navigate(event, onOpenCulture)}>Voir mes cultures{storage ? <ArrowRight size={18} aria-hidden="true" /> : null}</Link>{storage ? <Link className={styles.secondary} href={storageHref} prefetch={false} onClick={event => navigate(event, onOpenStorage)}>Vérifier mon stockage</Link> : null}{packets === null ? <Link className={styles.secondary} href="/arene/placard?view=market&section=dashboard" prefetch={false} onClick={event => navigate(event, onViewSales)}>Voir mon stock en vente</Link> : null}</div>
    </> : null}
  </section>;
}
