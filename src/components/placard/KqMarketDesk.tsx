"use client";

import { previewKqEnergyPayment } from "@/lib/kanab-quest-energy";
import Image from "next/image";

import {
  BadgeCheck,
  Banknote,
  Beaker,
  Box,
  CircleDollarSign,
  Flame,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  Check,
  PackageCheck,
  Scale,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildKqEquipmentGoalReceipt,
  formatKqCash,
  type KqEquipmentGoalReceipt,
} from "@/lib/kanab-quest-equipment";
import {
  getKqEquipmentPaybackScenarios,
  getKqEquipmentSaleFundingProjection,
} from "@/lib/kanab-quest-economy-balance";
import {
  getKqMarketEquipmentGoal,
  formatKqReputationDelta,
  getKqMarketReputationLabel,
  previewKqMarketReputation,
  getKqMarketRecommendations,
  getKqPinnedRouteLotStatus,
  getKqRouteExpertiseBonusReputation,
  getKqRouteExpertiseMission,
  getKqRouteExpertiseProgress,
  prioritizeKqPinnedMarketRoute,
  type KqMarketQuote,
  type KqMarketRouteCode,
  type KqPinnedRouteLotStatus,
} from "@/lib/kanab-quest-market";
import {
  didKqReputationTierChange,
  getKqReputationProgress,
} from "@/lib/kanab-quest-reputation";
import { createClientRequestKey } from "@/lib/client-request-key";
import styles from "./KqMarketDesk.module.css";

const COOKING_ART_URL = "/placard/sylvain-cooking-sprites-v1.webp";

// The API can finish before the sprite arrives on a cold cache or slow connection.
// Bound this wait so a broken image can never prevent a confirmed sale's receipt.
function waitForCookingArtwork(): Promise<{ loaded: boolean; visibleAt: number }> {
  return new Promise((resolve) => {
    const artwork = new window.Image();
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      artwork.onload = null;
      artwork.onerror = null;
      resolve({ loaded, visibleAt: performance.now() });
    };
    const timeout = window.setTimeout(() => finish(false), 10000);
    artwork.onload = () => { void artwork.decode().then(() => finish(true), () => finish(false)); };
    artwork.onerror = () => finish(false);
    artwork.src = COOKING_ART_URL;
  });
}

type MarketLot = {
  flowerId: string;
  varietyCode: string;
  varietyName: string;
  cultureSystemCode: string | null;
  cultureSystemName: string | null;
  cultureSystemTechnique: string | null;
  quality: number;
  harvestGrams: number;
  juryScore: number;
  qualityBand: "biomass" | "standard" | "selection" | "premium" | "signature";
  equipmentCodes: string[];
  options: KqMarketQuote[];
  status: "ready" | "sold";
  selectedRoute: KqMarketRouteCode | null;
  payoutCents: number | null;
  electricityPaidCents?: number;
  netPayoutCents?: number;
  reputationGain: number | null;
  burnedAt: string;
  settledAt: string | null;
};

type MarketSnapshot = {
  electricityOutstandingCents?: number;
  cashCents: number;
  reputation: number;
  reputationRank: number;
  ownedCodes: string[];
  equippedCodes: string[];
  routePlan: { route: KqMarketRouteCode; equipmentCode: string } | null;
  routeMasteries: Array<{
    route: KqMarketRouteCode;
    saleCount: number;
    bestJuryScore: number;
    totalPayoutCents: number;
    totalReputation: number;
    masteredAt: string;
  }>;
  equipmentSummary: {
    processingPrecision: number;
    processingCapacityPercent: number;
  };
  lots: MarketLot[];
};

type SaleReceipt = {
  receiptId: string;
  flowerId: string;
  route: KqMarketRouteCode;
  payoutCents: number;
  electricityPaidCents?: number;
  netPayoutCents?: number;
  reputationGain: number;
  cashAfterCents: number;
  reputationAfter: number;
  replayed: boolean;
  routeMastery: {
    matchedPlan: boolean;
    firstMastery: boolean;
    routeSales: number;
    expertiseBonusReputation: number;
    masteredAt: string;
    masteredRoutes: KqMarketRouteCode[];
  } | null;
  nextRouteGoal: {
    route: KqMarketRouteCode;
    name: string;
    minimumJuryScore: number;
    equipmentCode: string;
    equipmentName: string;
    equipmentPriceCents: number;
    investmentRequired: boolean;
  } | null;
  nextEquipmentGoal: KqEquipmentGoalReceipt | null;
  equipmentProgression: {
    catalogComplete: boolean;
    progressionComplete: boolean;
    remainingCount: number;
    alternativeCount: number;
  };
};

function mergeKqRouteMasteryAfterSale(
  routeMasteries: MarketSnapshot["routeMasteries"],
  receipt: SaleReceipt,
  juryScore: number,
) {
  if (!receipt.routeMastery) return routeMasteries;
  const existing = routeMasteries.find((mastery) => mastery.route === receipt.route);
  const countSale = !receipt.replayed || !existing;
  const updated = {
    route: receipt.route,
    saleCount: receipt.routeMastery.routeSales,
    bestJuryScore: Math.max(existing?.bestJuryScore ?? 0, juryScore),
    totalPayoutCents: (existing?.totalPayoutCents ?? 0) + (countSale ? receipt.payoutCents : 0),
    totalReputation: (existing?.totalReputation ?? 0) + (countSale ? receipt.reputationGain : 0),
    masteredAt: existing?.masteredAt || receipt.routeMastery.masteredAt,
  };
  return [updated, ...routeMasteries.filter((mastery) => mastery.route !== receipt.route)]
    .sort((left, right) => right.masteredAt.localeCompare(left.masteredAt));
}

const BAND_LABELS: Record<MarketLot["qualityBand"], string> = {
  biomass: "Déclassé",
  standard: "Standard",
  selection: "Sélection",
  premium: "Premium",
  signature: "Signature",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function RouteIcon({ family }: { family: KqMarketQuote["family"] }) {
  if (family === "salvage") return <Box aria-hidden="true" />;
  if (family === "flower") return <Sparkles aria-hidden="true" />;
  if (family === "hash") return <Beaker aria-hidden="true" />;
  return <Gauge aria-hidden="true" />;
}

function getPinnedRouteStatusLabel(status: KqPinnedRouteLotStatus) {
  if (status.state === "ready") return "Ce lot est prêt";
  if (status.state === "quality") return `Encore +${status.qualityGap.toFixed(1)} au jury`;
  if (status.state === "equipment") return "Chaîne à compléter";
  return `+${status.qualityGap.toFixed(1)} au jury et chaîne à compléter`;
}

export function KqMarketDesk({ onOpenShop }: { onOpenShop: (equipmentCode?: string) => void }) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [selectedFlowerId, setSelectedFlowerId] = useState<string | null>(null);
  const [pendingQuote, setPendingQuote] = useState<KqMarketQuote | null>(null);
  const [saleReceipt, setSaleReceipt] = useState<SaleReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<KqMarketRouteCode | null>(null);
  const [transformation, setTransformation] = useState<"idle" | "working" | "complete">("idle");
  const [cookingArtFailed, setCookingArtFailed] = useState(false);
  const transformationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saleInFlight = useRef(false);
  const [savingRouteGoal, setSavingRouteGoal] = useState(false);
  const [routeGoalError, setRouteGoalError] = useState("");
  const [error, setError] = useState("");
  const saleRequestKeyRef = useRef<string | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const modalOpen = Boolean(pendingQuote || saleReceipt || transformation !== "idle");

  useEffect(() => {
    if (!modalOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const modal = pageRef.current?.querySelector<HTMLElement>(transformation !== "idle" ? '[data-transformation]' : '[role="dialog"]');
    const controls = () => Array.from(modal?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)') ?? []).filter((el) => el.getClientRects().length > 0);
    (controls()[0] ?? modal)?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (selling || transformation !== "idle") return;
        saleRequestKeyRef.current = null;
        setPendingQuote(null);
        setSaleReceipt(null);
      }
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) { event.preventDefault(); modal?.focus(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [modalOpen, selling, transformation]);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/arena/placard/market", { cache: "no-store" });
      const payload = await response.json() as MarketSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le bureau des lots ne répond pas.");
      setSnapshot(payload);
      setSelectedFlowerId((current) => (
        current && payload.lots.some((lot) => lot.flowerId === current)
          ? current
          : payload.lots.find((lot) => lot.status === "ready")?.flowerId ?? payload.lots[0]?.flowerId ?? null
      ));
    } catch (marketError) {
      setError(marketError instanceof Error ? marketError.message : "Marché indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  useEffect(() => () => { if (transformationTimer.current) clearTimeout(transformationTimer.current); }, []);

  const selectedLot = useMemo(
    () => snapshot?.lots.find((lot) => lot.flowerId === selectedFlowerId) ?? null,
    [selectedFlowerId, snapshot?.lots],
  );
  const readyCount = snapshot?.lots.filter((lot) => lot.status === "ready").length ?? 0;
  const recommendation = useMemo(
    () => selectedLot ? getKqMarketRecommendations(selectedLot.options) : null,
    [selectedLot],
  );
  const pinnedRouteStatus = useMemo(() => (
    snapshot?.routePlan && selectedLot
      ? getKqPinnedRouteLotStatus({
        route: snapshot.routePlan.route,
        juryScore: selectedLot.juryScore,
        quotes: selectedLot.options,
      })
      : null
  ), [selectedLot, snapshot?.routePlan]);
  const expertiseMission = useMemo(() => getKqRouteExpertiseMission({
    masteries: snapshot?.routeMasteries ?? [],
    pinnedRoute: snapshot?.routePlan?.route ?? null,
  }), [snapshot?.routeMasteries, snapshot?.routePlan?.route]);
  const displayedOptions = useMemo(() => (
    selectedLot
      ? prioritizeKqPinnedMarketRoute(selectedLot.options, snapshot?.routePlan?.route ?? expertiseMission?.route ?? null)
      : []
  ), [expertiseMission?.route, selectedLot, snapshot?.routePlan?.route]);
  const activeQuote = displayedOptions.find((quote) => quote.route === selectedRoute)
    ?? displayedOptions.find((quote) => quote.route === snapshot?.routePlan?.route)
    ?? recommendation?.bestPayout ?? displayedOptions[0];
  const reputationProgress = useMemo(
    () => getKqReputationProgress(snapshot?.reputation ?? 0),
    [snapshot?.reputation],
  );
  const routeGoalScenario = useMemo(() => snapshot?.routePlan
    ? getKqEquipmentPaybackScenarios(snapshot.routePlan.equipmentCode, {
      ownedCodes: snapshot.ownedCodes,
    }).find((scenario) => scenario.route === snapshot.routePlan?.route) ?? null
    : null, [snapshot]);
  const pendingSalePreview = useMemo(() => {
    if (!snapshot || !pendingQuote) return null;
    const energyPayment = previewKqEnergyPayment(pendingQuote.payoutCents, snapshot.electricityOutstandingCents ?? 0);
    const cashAfterCents = snapshot.cashCents + energyPayment.netPayoutCents;
    const nextRouteSaleCount = (snapshot.routeMasteries.find((mastery) => mastery.route === pendingQuote.route)?.saleCount ?? 0) + 1;
    const expertiseBonusReputation = getKqRouteExpertiseBonusReputation(pendingQuote.route, nextRouteSaleCount, pendingQuote.reputationGain);
    const { reputationGain, reputationAfter } = previewKqMarketReputation(snapshot.reputation, pendingQuote.reputationGain, expertiseBonusReputation);
    const nextEquipmentGoal = buildKqEquipmentGoalReceipt({
      ownedCodes: snapshot.ownedCodes,
      cashCents: cashAfterCents,
    });
    const routeFunding = routeGoalScenario && routeGoalScenario.remainingInvestmentCents > 0
      ? {
        scenario: routeGoalScenario,
        projection: getKqEquipmentSaleFundingProjection({
          investmentCents: routeGoalScenario.remainingInvestmentCents,
          cashBeforeCents: snapshot.cashCents,
          payoutCents: energyPayment.netPayoutCents,
        }),
      }
      : null;
    return {
      ...energyPayment,
      cashAfterCents,
      reputationAfter,
      reputationGain,
      expertiseBonusReputation,
      nextRouteSaleCount,
      reputationProgress: getKqReputationProgress(reputationAfter),
      reputationPromoted: reputationGain > 0 && didKqReputationTierChange(snapshot.reputation, reputationAfter),
      routeFunding,
      nextEquipmentGoal,
      equipmentNewlyAffordable: Boolean(
        nextEquipmentGoal?.affordable
        && snapshot.cashCents < nextEquipmentGoal.priceCents
      ),
    };
  }, [pendingQuote, routeGoalScenario, snapshot]);
  const receiptReputationProgress = useMemo(
    () => saleReceipt ? getKqReputationProgress(saleReceipt.reputationAfter) : null,
    [saleReceipt],
  );
  const receiptPromoted = saleReceipt && saleReceipt.reputationGain > 0
    ? didKqReputationTierChange(
      saleReceipt.reputationAfter - saleReceipt.reputationGain,
      saleReceipt.reputationAfter,
    )
    : false;
  const receiptRouteExpertise = saleReceipt?.routeMastery
    ? getKqRouteExpertiseProgress(saleReceipt.routeMastery.routeSales)
    : null;
  const receiptExpertisePromoted = saleReceipt?.routeMastery && !saleReceipt.replayed
    ? getKqRouteExpertiseProgress(Math.max(0, saleReceipt.routeMastery.routeSales - 1)).tier.code
      !== receiptRouteExpertise?.tier.code
    : false;
  const receiptRouteFunding = useMemo(() => (
    saleReceipt && !saleReceipt.routeMastery?.matchedPlan && routeGoalScenario && snapshot?.routePlan && routeGoalScenario.remainingInvestmentCents > 0
      ? {
        scenario: routeGoalScenario,
        equipmentCode: snapshot.routePlan.equipmentCode,
        projection: getKqEquipmentSaleFundingProjection({
          investmentCents: routeGoalScenario.remainingInvestmentCents,
          cashBeforeCents: saleReceipt.cashAfterCents - (saleReceipt.netPayoutCents ?? saleReceipt.payoutCents),
          payoutCents: saleReceipt.netPayoutCents ?? saleReceipt.payoutCents,
        }),
      }
      : null
  ), [routeGoalScenario, saleReceipt, snapshot?.routePlan]);

  const confirmSale = async () => {
    if (!selectedLot || !pendingQuote || selling || saleInFlight.current) return;
    saleInFlight.current = true;
    const requestKey = saleRequestKeyRef.current ?? createClientRequestKey();
    saleRequestKeyRef.current = requestKey;
    setSelling(true);
    setCookingArtFailed(false);
    const cookingArtworkReady = waitForCookingArtwork();
    setTransformation("working");
    setError("");
    setRouteGoalError("");
    try {
      const response = await fetch("/api/arena/placard/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          flowerId: selectedLot.flowerId,
          route: pendingQuote.route,
          requestKey,
        }),
      });
      const payload = await response.json() as SaleReceipt & { error?: string };
      if (!response.ok) throw new Error(payload.error || "La vente n’a pas été enregistrée.");
      const artwork = await cookingArtworkReady;
      setCookingArtFailed(!artwork.loaded);
      setSaleReceipt(payload);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Let a short stirring loop finish even when the API answers immediately.
      transformationTimer.current = setTimeout(() => {
        setTransformation("complete");
        transformationTimer.current = setTimeout(() => setTransformation("idle"), reducedMotion ? 500 : 1400);
      }, reducedMotion || !artwork.loaded ? 0 : Math.max(0, 2000 - (performance.now() - artwork.visibleAt)));
      setSnapshot((current) => current ? {
        ...current,
        cashCents: payload.cashAfterCents,
        electricityOutstandingCents: Math.max(0, (current.electricityOutstandingCents ?? 0) - (payload.electricityPaidCents ?? 0)),
        reputation: payload.reputationAfter,
        routePlan: payload.routeMastery?.matchedPlan ? null : current.routePlan,
        routeMasteries: mergeKqRouteMasteryAfterSale(current.routeMasteries, payload, selectedLot.juryScore),
        lots: current.lots.map((lot) => lot.flowerId === payload.flowerId ? {
          ...lot,
          status: "sold",
          selectedRoute: payload.route,
          payoutCents: payload.payoutCents,
          electricityPaidCents: payload.electricityPaidCents,
          netPayoutCents: payload.netPayoutCents,
          reputationGain: payload.reputationGain,
          settledAt: new Date().toISOString(),
        } : lot),
      } : current);
      setPendingQuote(null);
      saleRequestKeyRef.current = null;
      window.dispatchEvent(new Event("kq:market-updated"));
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (saleError) {
      setTransformation("idle");
      setError(saleError instanceof Error ? saleError.message : "Vente impossible.");
    } finally {
      saleInFlight.current = false;
      setSelling(false);
    }
  };

  const adoptNextRouteGoal = async () => {
    const goal = saleReceipt?.nextRouteGoal;
    if (!goal || savingRouteGoal) return;
    setSavingRouteGoal(true);
    setRouteGoalError("");
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "route-plan",
          route: goal.route,
          equipmentCode: goal.equipmentCode,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le prochain palier n’a pas pu être épinglé.");
      setSnapshot((current) => current ? {
        ...current,
        routePlan: { route: goal.route, equipmentCode: goal.equipmentCode },
      } : current);
      window.dispatchEvent(new Event("kq:equipment-updated"));
      setSaleReceipt(null);
      if (goal.investmentRequired) onOpenShop(goal.equipmentCode);
    } catch (goalError) {
      setRouteGoalError(goalError instanceof Error ? goalError.message : "Objectif indisponible.");
    } finally {
      setSavingRouteGoal(false);
    }
  };

  return (
    <main ref={pageRef} className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>Le Placard · Atelier & marché</span>
          <h1>Le Marché</h1>
          <p>Ta récolte. Tes machines. Ton prochain palier.</p>
        </div>
        <div className={styles.walletGrid}>
          <article><CircleDollarSign /><span><small>Trésorerie</small><strong>{formatKqCash(snapshot?.cashCents ?? 0)}</strong></span></article>
          <article><Trophy /><span><small>Réputation · {reputationProgress.tier.name}</small><strong>{reputationProgress.reputation}</strong><em>{reputationProgress.nextTier ? `${reputationProgress.pointsToNext} avant ${reputationProgress.nextTier.name}` : "Palier maximal"}</em></span></article>
          <article><BadgeCheck /><span><small>Rang qualité</small><strong>#{snapshot?.reputationRank ?? "—"}</strong></span></article>
        </div>
      </section>

      <details className={styles.marketHelp}>
        <summary>Comment vendre un lot ?</summary>
        <div className={styles.explainer}>
        <span><Flame /><b>1</b> La Fleur passe au jury puis brûle dans son duel.</span>
        <span><Scale /><b>2</b> La note fixe les transformations et le prix.</span>
        <span><Banknote /><b>3</b> La vente rapporte de l’argent. La qualité fait monter, stagner ou baisser ta réputation.</span>
        </div>
      </details>

      {error ? <div className={styles.errorBanner} role="alert">{error}<button type="button" onClick={() => void loadMarket()}>Réessayer</button></div> : null}
      {loading ? <div className={styles.loading}><LoaderCircle aria-hidden="true" /><strong>Le jury ouvre les dossiers…</strong></div> : null}

      {!loading && snapshot && snapshot.lots.length === 0 ? (
        <section className={styles.emptyState}>
          <Image className={styles.emptyArt} src="/placard/market-workshop-v1.webp" alt="Atelier de transformation prêt à accueillir une récolte" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 900px" />
          <Flame aria-hidden="true" />
          <span>Aucun lot à valoriser</span>
          <h2>Le jury t’attend</h2>
          <p>Termine une culture et un duel. La Fleur brûle ; son lot arrive ici.</p>
        </section>
      ) : null}

      {!loading && snapshot && snapshot.lots.length > 0 ? (
        <div className={styles.marketLayout}>
          <aside className={styles.lotRail} aria-label="Lots disponibles">
            <header><div><small>Dossiers du jury</small><h2>{readyCount} lot{readyCount > 1 ? "s" : ""} à décider</h2></div><PackageCheck /></header>
            <div>
              {snapshot.lots.map((lot) => (
                <button key={lot.flowerId} type="button" data-selected={lot.flowerId === selectedLot?.flowerId || undefined} data-sold={lot.status === "sold" || undefined} onClick={() => setSelectedFlowerId(lot.flowerId)}>
                  <span data-band={lot.qualityBand}>{lot.juryScore.toFixed(1)}</span>
                  <div><strong>{lot.varietyName}</strong><small>{lot.harvestGrams.toLocaleString("fr-FR")} g · {BAND_LABELS[lot.qualityBand]}</small><em>{lot.cultureSystemName ?? "Mode non archivé"} · {lot.status === "sold" ? `vendu ${formatKqCash(lot.payoutCents ?? 0)}` : `verdict du ${formatDate(lot.burnedAt)}`}</em></div>
                </button>
              ))}
            </div>
          </aside>

          {selectedLot ? <section className={styles.lotWorkspace}>
            <header className={styles.lotHeader}>
              <div><small>Lot #{selectedLot.flowerId.slice(0, 8)}</small><h2>{selectedLot.varietyName}</h2><span data-band={selectedLot.qualityBand}>{BAND_LABELS[selectedLot.qualityBand]}</span></div>
              <div className={styles.juryScore}><Trophy /><strong>{selectedLot.juryScore.toFixed(1)}</strong><small>note jury / 10</small></div>
              <div className={styles.harvestWeight}><Scale /><strong>{selectedLot.harvestGrams.toLocaleString("fr-FR")} g</strong><small>lot disponible</small></div>
            </header>
            <details className={styles.cultureDetails}><summary>Origine du lot · {selectedLot.cultureSystemName ?? "Mode non archivé"}</summary><p>{selectedLot.cultureSystemTechnique ?? "Cette ancienne récolte ne contient pas encore le détail technique."}</p><p>Aucun bonus caché : le mode de culture décrit l’origine du lot.</p></details>

            {selectedLot.status === "sold" ? (
              <div className={styles.soldSummary}><PackageCheck /><div><small>Lot valorisé le {formatDate(selectedLot.settledAt)}</small><h3>{selectedLot.options.find((option) => option.route === selectedLot.selectedRoute)?.name ?? selectedLot.selectedRoute}</h3><p><strong>+{formatKqCash(selectedLot.netPayoutCents ?? selectedLot.payoutCents ?? 0)}</strong><span>{formatKqReputationDelta(selectedLot.reputationGain ?? 0)} réputation</span></p></div></div>
            ) : (
              <>
                <div className={styles.routeHeading}><div><small>Choisis ton poste</small><h3>L’atelier de transformation</h3></div><button type="button" onClick={() => onOpenShop()}><ShoppingBag /> Équiper l’atelier</button></div>
                <section className={styles.workshopScene} aria-label="Atelier du lot sélectionné" data-family={activeQuote?.family}>
                  <Image src="/placard/market-workshop-v1.webp" alt="Atelier de jeu avec une presse, des tamis et une laveuse" fill sizes="(max-width: 900px) 100vw, 900px" priority />
                  <div className={styles.sceneCaption}><span>{activeQuote?.available ? <><Check size={15} /> Poste disponible</> : <><LockKeyhole size={15} /> Conditions à remplir</>}</span><strong>{activeQuote?.name}</strong><small>{activeQuote?.available ? "Prêt pour ce lot" : activeQuote?.blockedReason}</small></div>
                </section>
                <div className={styles.machineCount}><span>{displayedOptions.filter((quote) => quote.available).length} postes disponibles sur {displayedOptions.length}</span><span>Faire défiler →</span></div>
                <nav className={styles.machineMenu} aria-label="Machines et filières">
                  {displayedOptions.map((quote) => <button key={quote.route} type="button" aria-pressed={activeQuote?.route === quote.route} aria-label={`${quote.name} · ${quote.available ? "Disponible" : "Verrouillé"}`} data-available={quote.available} onClick={() => setSelectedRoute(quote.route)} aria-controls="market-machine-detail">
                    <RouteIcon family={quote.family} /><strong>{quote.name}</strong><small>{quote.available ? <><Check size={12} /> Disponible</> : <><LockKeyhole size={12} /> Verrouillé</>}</small>
                  </button>)}
                </nav>
                {recommendation ? (
                  <details className={styles.comparison}><summary>Comparer les revenus et la réputation</summary><section className={styles.decisionGuide} data-has-pinned={pinnedRouteStatus ? true : undefined} aria-label="Comparaison des voies disponibles">
                    <header>
                      <small>Conseil d’atelier</small>
                      <strong>{recommendation.oneClearWinner ? "Un choix se détache" : recommendation.bestReputation ? "Argent ou réputation ?" : "Sauver ce qui peut l’être"}</strong>
                    </header>
                    <article>
                      <Banknote aria-hidden="true" />
                      <span><small>Meilleur revenu</small><strong>{recommendation.bestPayout?.name ?? "Aucune voie"}</strong><b>{formatKqCash(recommendation.bestPayout?.payoutCents ?? 0)}</b></span>
                    </article>
                    <article>
                      <Trophy aria-hidden="true" />
                      <span><small>Meilleure réputation</small><strong>{recommendation.bestReputation?.name ?? "Qualité insuffisante"}</strong><b>+{recommendation.bestReputation?.reputationGain ?? 0}</b></span>
                    </article>
                    {pinnedRouteStatus ? (
                      <article className={styles.pinnedDecision} data-state={pinnedRouteStatus.state}>
                        <Target aria-hidden="true" />
                        <span><small>Filière épinglée</small><strong>{pinnedRouteStatus.name}</strong><b>{getPinnedRouteStatusLabel(pinnedRouteStatus)}</b></span>
                      </article>
                    ) : null}
                  </section></details>
                ) : null}
                <div className={styles.routeGrid} id="market-machine-detail" aria-live="polite">
                  {displayedOptions.filter((quote) => quote.route === activeQuote?.route).map((quote) => {
                    const bestPayout = quote.available && recommendation?.bestPayout?.route === quote.route;
                    const bestReputation = quote.available && recommendation?.bestReputation?.route === quote.route;
                    const pinnedRoute = snapshot.routePlan?.route === quote.route;
                    const missionRoute = expertiseMission?.route === quote.route;
                    const routeMastery = snapshot.routeMasteries.find((mastery) => mastery.route === quote.route);
                    const routeExpertise = routeMastery ? getKqRouteExpertiseProgress(routeMastery.saleCount) : null;
                    const expertiseBonusReputation = getKqRouteExpertiseBonusReputation(quote.route, (routeMastery?.saleCount ?? 0) + 1, quote.reputationGain);
                    const rawDeltaCents = recommendation?.rawBaseline && quote.route !== "raw"
                      ? quote.payoutCents - recommendation.rawBaseline.payoutCents
                      : null;
                    const juryScoreGap = Math.max(0, Math.round((quote.minimumJuryScore - selectedLot.juryScore) * 10) / 10);
                    const pinnedRouteNeedsEquipment = pinnedRoute && quote.missingUnlocks.length > 0;
                    const pinnedEquipmentCode = pinnedRoute ? snapshot.routePlan?.equipmentCode ?? null : null;
                    const equipmentGoal = juryScoreGap === 0 || pinnedRouteNeedsEquipment ? getKqMarketEquipmentGoal({
                      quote,
                      ownedCodes: snapshot.ownedCodes,
                      equippedCodes: snapshot.equippedCodes,
                      cashCents: snapshot.cashCents,
                    }) : null;
                    return (
                    <article key={quote.route} data-available={quote.available || undefined} data-family={quote.family} data-recommended={bestPayout || bestReputation || pinnedRoute || missionRoute || undefined} data-pinned={pinnedRoute || undefined} data-mission={missionRoute || undefined} data-mastered={routeMastery ? true : undefined}>
                      {bestPayout || bestReputation || pinnedRoute || missionRoute || routeMastery ? <div className={styles.routeBadges}>{missionRoute ? <span data-mission>Mission d’atelier</span> : null}{routeExpertise ? <span data-mastered>Expertise {routeExpertise.tier.name} · ×{routeExpertise.saleCount}</span> : null}{pinnedRoute ? <span data-pinned>Filière épinglée</span> : null}{bestPayout ? <span>Meilleur revenu</span> : null}{bestReputation ? <span>Meilleure réputation</span> : null}</div> : null}
                      <header><span><RouteIcon family={quote.family} /></span><div><small>{quote.family === "salvage" ? "Dernier recours" : quote.family === "flower" ? "Vente directe" : "Transformation"}</small><h4>{quote.name}</h4></div></header>
                      <p>{quote.description}</p>
                      <dl>
                        <div><dt>Produit fini</dt><dd>{quote.productGrams.toLocaleString("fr-FR")} g</dd></div>
                        <div><dt>Capacité utilisée</dt><dd>{quote.processingCapacityPercent} %</dd></div>
                        <div><dt>Prix du lot</dt><dd>{formatKqCash(quote.payoutCents)}</dd></div>
                        <div><dt>Réputation</dt><dd data-loss={quote.reputationGain < 0 || undefined}>{quote.available ? formatKqReputationDelta(quote.reputationGain) : "—"}</dd></div>
                      </dl>
                      <small className={styles.reputationRule}>{getKqMarketReputationLabel(quote.route)}</small>
                      {routeMastery ? <small className={styles.masteryRecord}>Record personnel · jury {routeMastery.bestJuryScore.toFixed(1)}/10 · {formatKqCash(routeMastery.totalPayoutCents)} cumulés</small> : null}
                      {routeExpertise ? <small className={styles.expertiseProgress} data-complete={!routeExpertise.nextTier || undefined}><span><b>{routeExpertise.tier.name}</b><em>{routeExpertise.nextTier ? `${routeExpertise.saleCount}/${routeExpertise.nextTier.minimumSales} ventes` : `${routeExpertise.saleCount} ventes`}</em></span><i><b style={{ width: `${routeExpertise.progressPercent}%` }} /></i><em>{routeExpertise.nextTier ? `Encore ${routeExpertise.salesToNext} pour ${routeExpertise.nextTier.name}` : "Rang maximal de cette filière"}</em></small> : null}
                      {expertiseBonusReputation > 0 ? <small className={styles.expertiseBonus}>Prime de palier sur cette vente · +{expertiseBonusReputation} réputation</small> : null}
                      {missionRoute && expertiseMission ? <small className={styles.missionStatus}>Mission · encore {expertiseMission.salesRemaining} vente{expertiseMission.salesRemaining > 1 ? "s" : ""} pour {expertiseMission.targetTier.name}{expertiseMission.bonusReputation > 0 ? ` · prime +${expertiseMission.bonusReputation} si qualité suffisante` : ""}</small> : null}
                      {quote.available && rawDeltaCents !== null ? <small className={rawDeltaCents >= 0 ? styles.positiveDelta : styles.negativeDelta}>{rawDeltaCents >= 0 ? "+" : ""}{formatKqCash(rawDeltaCents)} par rapport au lot brut</small> : null}
                      {quote.remainderGrams > 0 ? <small className={styles.remainder}>{quote.remainderGrams.toLocaleString("fr-FR")} g restants valorisés {quote.remainderDestination === "raw" ? "en lot brut" : "en biomasse"}</small> : null}
                      {quote.blockedReason ? <small className={styles.blocked}>{quote.blockedReason}</small> : null}
                      {juryScoreGap > 0 ? <small className={styles.qualityGoal}>Objectif prochaine récolte · +{juryScoreGap.toFixed(1)} au jury</small> : null}
                      {pinnedRoute && quote.available ? <small className={styles.pinnedStatus}>Objectif atteint · ce lot est compatible avec ta filière</small> : null}
                      {quote.available ? <button type="button" onClick={() => { saleRequestKeyRef.current = createClientRequestKey(); setError(""); setPendingQuote(quote); }}>Choisir · {formatKqCash(quote.payoutCents)}</button> : pinnedRouteNeedsEquipment && pinnedEquipmentCode ? <button type="button" className={styles.unlockButton} data-pinned data-affordable={equipmentGoal?.affordable || undefined} onClick={() => onOpenShop(pinnedEquipmentCode)}><Target /> Poursuivre la filière<small>{juryScoreGap > 0 ? `Chaîne à compléter · encore +${juryScoreGap.toFixed(1)} au jury` : equipmentGoal ? `${equipmentGoal.kind === "install" ? "À installer" : "Prochaine pièce"} · ${equipmentGoal.name}` : "Ouvrir la chaîne d’équipement"}</small></button> : equipmentGoal ? <button type="button" className={styles.unlockButton} data-affordable={equipmentGoal.affordable || undefined} onClick={() => onOpenShop(equipmentGoal.code)}><ShoppingBag /> {equipmentGoal.kind === "install" ? "Installer" : equipmentGoal.kind === "prerequisite" ? "Commencer par" : "Voir"} · {equipmentGoal.name}<small>{equipmentGoal.kind === "prerequisite" ? `Prérequis de ${equipmentGoal.targetEquipmentName}` : equipmentGoal.affordable ? formatKqCash(equipmentGoal.priceCents) : `Manque ${formatKqCash(equipmentGoal.remainingCents)}`}</small></button> : <button type="button" disabled>Indisponible</button>}
                    </article>
                  );})}
                </div>
              </>
            )}
          </section> : null}
        </div>
      ) : null}

      {pendingQuote && selectedLot ? <div className={styles.modalBackdrop} role="presentation" onClick={() => { if (!selling) { saleRequestKeyRef.current = null; setPendingQuote(null); } }}>
        <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="market-confirm-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" disabled={selling} onClick={() => { saleRequestKeyRef.current = null; setPendingQuote(null); }} aria-label="Fermer"><X /></button>
          <span><RouteIcon family={pendingQuote.family} /></span>
          <small>Bon de transformation définitif</small>
          <h2 id="market-confirm-title">{pendingQuote.name}</h2>
          <p>Le lot {selectedLot.varietyName} sera entièrement valorisé par cette filière. Ce choix ne pourra pas être annulé.</p>
          {error ? <p className={styles.modalError} role="alert">{error}</p> : null}
          <div><span><small>Vente brute</small><strong>{formatKqCash(pendingQuote.payoutCents)}</strong></span><span><small>Réputation{pendingSalePreview?.expertiseBonusReputation ? " · prime de rang" : ""}</small><strong>{formatKqReputationDelta(pendingSalePreview?.reputationGain ?? pendingQuote.reputationGain)}</strong></span></div>
          {pendingSalePreview && pendingSalePreview.electricityPaidCents > 0 ? <p className={styles.energySettlement}>Électricité réglée : −{formatKqCash(pendingSalePreview.electricityPaidCents)} · Dans ta caisse : <b>{formatKqCash(pendingSalePreview.netPayoutCents)}</b><br />Reste à payer : {formatKqCash(pendingSalePreview.electricityRemainingCents)}. Au maximum la moitié de cette vente rembourse tes factures.</p> : null}
          {pendingQuote.reputationGain < 0 ? <p className={styles.reputationWarning} role="alert">Qualité insuffisante pour cette filière : pénalité de {Math.abs(pendingQuote.reputationGain)} points, limitée à ta réputation disponible. La biomasse préserve ta réputation.</p> : null}
          {pendingSalePreview ? (
            <section className={styles.salePreview} aria-label="Progression après cette vente">
              <header><Sparkles aria-hidden="true" /><span><small>Projection</small><strong>Après cette vente</strong></span></header>
              <div className={styles.salePreviewStats}>
                <article><Banknote aria-hidden="true" /><span><small>Trésorerie</small><strong>{formatKqCash(pendingSalePreview.cashAfterCents)}</strong></span></article>
                <article data-promoted={pendingSalePreview.reputationPromoted || undefined}><Trophy aria-hidden="true" /><span><small>{pendingSalePreview.reputationPromoted ? "Nouveau titre" : "Réputation"}</small><strong>{pendingSalePreview.reputationAfter} · {pendingSalePreview.reputationProgress.tier.name}</strong></span></article>
              </div>
              {pendingSalePreview.routeFunding ? (
                <article className={styles.routeFundingPreview} data-newly-affordable={pendingSalePreview.routeFunding.projection.newlyAffordable || undefined}>
                  <Target aria-hidden="true" />
                  <div>
                    <small>{pendingSalePreview.routeFunding.projection.newlyAffordable ? "Filière débloquée par cette vente" : "Filière épinglée"}</small>
                    <strong>{pendingSalePreview.routeFunding.scenario.name}</strong>
                    <span><i style={{ width: `${pendingSalePreview.routeFunding.projection.after.progressPercent}%` }} /></span>
                    <em>+{formatKqCash(pendingSalePreview.routeFunding.projection.contributionCents)} vers l’objectif · {pendingSalePreview.routeFunding.projection.before.progressPercent} → {pendingSalePreview.routeFunding.projection.after.progressPercent} %</em>
                    <b>{pendingSalePreview.routeFunding.projection.newlyAffordable
                      ? "Budget complet après cette vente"
                      : pendingSalePreview.routeFunding.projection.comparableSalesRemaining
                        ? `Encore environ ${pendingSalePreview.routeFunding.projection.comparableSalesRemaining} vente${pendingSalePreview.routeFunding.projection.comparableSalesRemaining > 1 ? "s" : ""} comparable${pendingSalePreview.routeFunding.projection.comparableSalesRemaining > 1 ? "s" : ""}`
                        : "Budget déjà atteint"}</b>
                  </div>
                </article>
              ) : pendingSalePreview.nextEquipmentGoal ? (
                <p data-affordable={pendingSalePreview.nextEquipmentGoal.affordable || undefined} data-newly-affordable={pendingSalePreview.equipmentNewlyAffordable || undefined}>
                  <ShoppingBag aria-hidden="true" />
                  <span>
                    <small>{pendingSalePreview.equipmentNewlyAffordable ? "Objectif débloqué par cette vente" : pendingSalePreview.nextEquipmentGoal.affordable ? "Investissement accessible" : "Prochain investissement"}</small>
                    <strong>{pendingSalePreview.nextEquipmentGoal.name}</strong>
                    <em>{pendingSalePreview.nextEquipmentGoal.affordable ? `Disponible à ${formatKqCash(pendingSalePreview.nextEquipmentGoal.priceCents)}` : `Encore ${formatKqCash(pendingSalePreview.nextEquipmentGoal.remainingCents)} à réunir`}</em>
                  </span>
                </p>
              ) : <p data-complete><PackageCheck aria-hidden="true" /><span><small>Atelier principal terminé</small><strong>Tous les investissements de progression sont acquis.</strong></span></p>}
            </section>
          ) : null}
          <footer><button type="button" disabled={selling} onClick={() => { saleRequestKeyRef.current = null; setPendingQuote(null); }}>Retour</button><button type="button" disabled={selling} onClick={() => void confirmSale()}>{selling ? <><LoaderCircle /> Validation…</> : <><Banknote /> Valider la vente</>}</button></footer>
        </section>
      </div> : null}

      {saleReceipt && transformation === "idle" ? <div className={styles.modalBackdrop} role="presentation" onClick={() => setSaleReceipt(null)}>
        <section className={styles.receiptModal} role="dialog" aria-modal="true" aria-labelledby="market-receipt-title" onClick={(event) => event.stopPropagation()}>
          <PackageCheck />
          <small>Reçu #{saleReceipt.receiptId.slice(0, 8)}</small>
          <h2 id="market-receipt-title">Lot vendu</h2>
          <strong>+{formatKqCash(saleReceipt.netPayoutCents ?? saleReceipt.payoutCents)}</strong>
          {(saleReceipt.electricityPaidCents ?? 0) > 0 ? <p className={styles.energySettlement}>Vente brute : {formatKqCash(saleReceipt.payoutCents)} · Électricité réglée : −{formatKqCash(saleReceipt.electricityPaidCents ?? 0)}</p> : null}
          <span>{formatKqReputationDelta(saleReceipt.reputationGain)} réputation · solde {formatKqCash(saleReceipt.cashAfterCents)}</span>
          {receiptReputationProgress ? (
            <section className={`${styles.receiptGoal} ${styles.reputationGoal}`} data-promoted={receiptPromoted || undefined}>
              <Trophy aria-hidden="true" />
              <div>
                <small>{saleReceipt.reputationGain < 0 ? "Réputation en baisse" : receiptPromoted ? "Nouveau palier de réputation" : "Réputation après vente"}</small>
                <h3>{receiptReputationProgress.tier.name}</h3>
                <span><i style={{ width: `${receiptReputationProgress.progressPercent}%` }} /></span>
                <b>{receiptReputationProgress.nextTier ? `Encore ${receiptReputationProgress.pointsToNext} avant ${receiptReputationProgress.nextTier.name}` : "Réputation maximale atteinte"}</b>
              </div>
            </section>
          ) : null}
          {receiptRouteExpertise ? (
            <section className={`${styles.receiptGoal} ${styles.expertiseGoal}`} data-promoted={receiptExpertisePromoted || undefined} data-complete={!receiptRouteExpertise.nextTier || undefined}>
              <Gauge aria-hidden="true" />
              <div>
                <small>{receiptExpertisePromoted ? "Nouveau rang de filière" : "Expertise de filière"}</small>
                <h3>{selectedLot?.options.find((option) => option.route === saleReceipt.route)?.name ?? saleReceipt.route} · {receiptRouteExpertise.tier.name}</h3>
                {saleReceipt.routeMastery?.expertiseBonusReputation ? <p className={styles.expertiseReward}>Prime de rang · +{saleReceipt.routeMastery.expertiseBonusReputation} réputation incluse dans le versement</p> : null}
                <span><i style={{ width: `${receiptRouteExpertise.progressPercent}%` }} /></span>
                <b>{receiptRouteExpertise.nextTier ? `Encore ${receiptRouteExpertise.salesToNext} vente${receiptRouteExpertise.salesToNext > 1 ? "s" : ""} avant ${receiptRouteExpertise.nextTier.name}` : "Rang maximal de cette filière atteint"}</b>
              </div>
            </section>
          ) : null}
          {saleReceipt.routeMastery?.matchedPlan ? (
            <section className={`${styles.receiptGoal} ${styles.masteryGoal}`} data-first={saleReceipt.routeMastery.firstMastery || undefined} data-complete={!saleReceipt.nextRouteGoal || undefined}>
              <BadgeCheck aria-hidden="true" />
              <div>
                <small>{saleReceipt.routeMastery.firstMastery ? "Nouvelle filière maîtrisée" : "Objectif de filière accompli"}</small>
                <h3>{selectedLot?.options.find((option) => option.route === saleReceipt.route)?.name ?? saleReceipt.route}</h3>
                <p>{saleReceipt.routeMastery.firstMastery ? "Première vente homologuée sur cette voie." : `${saleReceipt.routeMastery.routeSales} ventes homologuées sur cette voie.`}</p>
                {saleReceipt.nextRouteGoal ? <><b>Prochain palier · {saleReceipt.nextRouteGoal.name} · jury ≥ {saleReceipt.nextRouteGoal.minimumJuryScore.toFixed(1)}/10</b><p>{saleReceipt.nextRouteGoal.investmentRequired ? `${saleReceipt.nextRouteGoal.equipmentName} · ${formatKqCash(saleReceipt.nextRouteGoal.equipmentPriceCents)}` : `${saleReceipt.nextRouteGoal.equipmentName} est déjà dans ton atelier : le défi porte sur la qualité.`}</p></> : <b>Sommet de cette branche atteint · vise maintenant la réputation</b>}
                {routeGoalError ? <em role="alert">{routeGoalError}</em> : null}
              </div>
              {saleReceipt.nextRouteGoal ? <button type="button" disabled={savingRouteGoal} onClick={() => void adoptNextRouteGoal()}>{savingRouteGoal ? <><LoaderCircle /> Enregistrement…</> : saleReceipt.nextRouteGoal.investmentRequired ? "Préparer le palier" : "Épingler le palier"}</button> : null}
            </section>
          ) : receiptRouteFunding ? (
            <section className={`${styles.receiptGoal} ${styles.routeFundingGoal}`} data-affordable={receiptRouteFunding.projection.after.affordable || undefined}>
              <Target aria-hidden="true" />
              <div>
                <small>{receiptRouteFunding.projection.newlyAffordable ? "Filière financée par cette vente" : "Progression de la filière épinglée"}</small>
                <h3>{receiptRouteFunding.scenario.name}</h3>
                <p>+{formatKqCash(receiptRouteFunding.projection.contributionCents)} consacré au budget de la chaîne.</p>
                <span><i style={{ width: `${receiptRouteFunding.projection.after.progressPercent}%` }} /></span>
                <b>{receiptRouteFunding.projection.after.affordable
                  ? "Budget complet · la chaîne peut être achetée"
                  : `Encore ${formatKqCash(receiptRouteFunding.projection.after.remainingCents)} · environ ${receiptRouteFunding.projection.comparableSalesRemaining ?? "—"} vente${receiptRouteFunding.projection.comparableSalesRemaining === 1 ? "" : "s"} comparable${receiptRouteFunding.projection.comparableSalesRemaining === 1 ? "" : "s"}`}</b>
              </div>
              <button type="button" onClick={() => { setSaleReceipt(null); onOpenShop(receiptRouteFunding.equipmentCode); }}>Poursuivre</button>
            </section>
          ) : saleReceipt.nextEquipmentGoal ? (
            <section className={styles.receiptGoal} data-affordable={saleReceipt.nextEquipmentGoal.affordable || undefined}>
              <ShoppingBag aria-hidden="true" />
              <div>
                <small>Prochain investissement</small>
                <h3>{saleReceipt.nextEquipmentGoal.name}</h3>
                <p>{saleReceipt.nextEquipmentGoal.benefit}</p>
                <span><i style={{ width: `${saleReceipt.nextEquipmentGoal.progressPercent}%` }} /></span>
                <b>{saleReceipt.nextEquipmentGoal.affordable ? `Disponible · ${formatKqCash(saleReceipt.nextEquipmentGoal.priceCents)}` : `Encore ${formatKqCash(saleReceipt.nextEquipmentGoal.remainingCents)} à réunir`}</b>
              </div>
              <button type="button" onClick={() => { setSaleReceipt(null); onOpenShop(saleReceipt.nextEquipmentGoal?.code); }}>Voir la fiche</button>
            </section>
          ) : (
            <section className={styles.receiptGoal} data-complete>
              <Sparkles aria-hidden="true" />
              <div><small>{saleReceipt.equipmentProgression.catalogComplete ? "Atelier complet" : "Progression principale bouclée"}</small><h3>{saleReceipt.equipmentProgression.catalogComplete ? "Tout le catalogue est acquis" : `${saleReceipt.equipmentProgression.alternativeCount} modèle${saleReceipt.equipmentProgression.alternativeCount > 1 ? "s" : ""} alternatif${saleReceipt.equipmentProgression.alternativeCount > 1 ? "s" : ""}`}</h3><p>{saleReceipt.equipmentProgression.catalogComplete ? "Le prochain objectif se joue désormais sur la qualité et la réputation." : "Aucun déclassement n’est conseillé, mais ces modèles restent disponibles pour composer un atelier différent."}</p></div>
              {!saleReceipt.equipmentProgression.catalogComplete ? <button type="button" onClick={() => { setSaleReceipt(null); onOpenShop(); }}>Explorer</button> : null}
            </section>
          )}
          <button type="button" onClick={() => setSaleReceipt(null)}>Continuer</button>
        </section>
      </div> : null}
      <link rel="preload" as="image" href={COOKING_ART_URL} />
      {transformation !== "idle" ? <div className={styles.transformation} role="status" tabIndex={-1} aria-live="polite" aria-atomic="true" data-transformation data-phase={transformation}>
        <div className={styles.cookingScene} aria-hidden="true">
          {cookingArtFailed ? <div className={styles.cookingFallback}><PackageCheck /></div> : <div className={styles.cookingFrame}><Image className={styles.cookingSprite} src={COOKING_ART_URL} alt="" width={1254} height={1254} unoptimized loading="eager" /></div>}
          <div className={styles.cookingSteam}><i /><i /><i /></div>
          <span className={styles.cookingSeal}>{transformation === "complete" ? <Check /> : <Flame />}</span>
        </div>
        <span className={styles.cookingRoute}>{activeQuote?.name}</span>
        <strong>{transformation === "complete" ? "Lot valorisé !" : pendingQuote?.family === "flower" || pendingQuote?.family === "salvage" ? "Préparation du lot…" : "Sylvain aux fourneaux…"}</strong>
        <p>{transformation === "complete" ? `+${formatKqCash(saleReceipt?.netPayoutCents ?? saleReceipt?.payoutCents ?? 0)} · Vente confirmée` : "Il remue, il peaufine… ton lot se prépare."}</p>
      </div> : null}
    </main>
  );
}
