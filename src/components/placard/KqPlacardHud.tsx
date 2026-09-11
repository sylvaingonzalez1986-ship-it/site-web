"use client";

import {
  Banknote,
  ArrowRight,
  CircleAlert,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildKqEquipmentHudSummary,
  formatKqCash,
  getKqEquipmentProgressionStatus,
  getKqNextEquipmentGoal,
} from "@/lib/kanab-quest-equipment";
import {
  getKqEquipmentInvestmentProgress,
  getKqEquipmentPaybackScenarios,
} from "@/lib/kanab-quest-economy-balance";
import { getKqPlacardNextAction, type KqPlacardHubDestination } from "@/lib/kanab-quest-hub";
import {
  getKqRouteExpertiseProgress,
  getKqRouteExpertiseMission,
  getKqRoutePlanEquipmentGoal,
  KQ_MARKET_ROUTES,
  type KqMarketRouteCode,
} from "@/lib/kanab-quest-market";
import { getKqReputationProgress } from "@/lib/kanab-quest-reputation";
import { KqEnergyPanel } from "./KqEnergyPanel";
import { KqEquipmentInventoryModal } from "./KqEquipmentInventoryModal";
import styles from "./KqPlacardHud.module.css";

type EquipmentHudSnapshot = {
  cashCents: number;
  levels: Record<string, number>;
  reputation: number;
  ownedCodes: string[];
  purchasedCodes: string[];
  equippedCodes: string[];
  activeRun: boolean;
  readyLotCount: number;
  availableFlowerCount: number;
  routePlan: { route: KqMarketRouteCode; equipmentCode: string } | null;
  routeMasteries: Array<{
    route: KqMarketRouteCode;
    saleCount: number;
    bestJuryScore: number;
    totalPayoutCents: number;
    totalReputation: number;
    masteredAt: string;
  }>;
};

const HUD_PREVIEW_LIMIT = 5;
const KQ_TRANSFORMATION_ROUTE_COUNT = KQ_MARKET_ROUTES.filter((route) => route.family === "hash" || route.family === "rosin").length;

export function KqPlacardHud({
  onOpenShop,
  onOpenGame,
  onOpenArena,
  onOpenMarket,
}: {
  onOpenShop: (equipmentCode?: string) => void;
  onOpenGame: () => void;
  onOpenArena: () => void;
  onOpenMarket: () => void;
}) {
  const [snapshot, setSnapshot] = useState<EquipmentHudSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missionError, setMissionError] = useState("");
  const [savingMission, setSavingMission] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "equipment" | "goals" | "energy">("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRefresh = useCallback(() => {
    setLoading(true);
    setError("");
    setRefreshKey((current) => current + 1);
  }, []);
  const closeInventory = useCallback(() => setInventoryOpen(false), []);
  const openInventoryShop = useCallback(() => onOpenShop(), [onOpenShop]);

  useEffect(() => {
    const handleEquipmentUpdate = () => requestRefresh();
    window.addEventListener("kq:equipment-updated", handleEquipmentUpdate);
    return () => window.removeEventListener("kq:equipment-updated", handleEquipmentUpdate);
  }, [requestRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/arena/placard/equipment", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json() as EquipmentHudSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Ton atelier est momentanément indisponible.");
      setSnapshot(payload);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Ton atelier est momentanément indisponible.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refreshKey]);

  const summary = useMemo(() => buildKqEquipmentHudSummary({
    ownedCodes: snapshot?.purchasedCodes ?? [],
    equippedCodes: snapshot?.equippedCodes ?? [],
  }), [snapshot]);
  const preview = summary.purchased.slice(0, HUD_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, summary.purchased.length - preview.length);
  const masteredRoutes = useMemo(() => (snapshot?.routeMasteries ?? []).flatMap((mastery) => {
    const route = KQ_MARKET_ROUTES.find((candidate) => candidate.code === mastery.route);
    return route && (route.family === "hash" || route.family === "rosin")
      ? [{ ...mastery, name: route.name, expertise: getKqRouteExpertiseProgress(mastery.saleCount) }]
      : [];
  }).sort((left, right) => right.masteredAt.localeCompare(left.masteredAt)), [snapshot?.routeMasteries]);
  const masteredRouteSales = masteredRoutes.reduce((total, mastery) => total + mastery.saleCount, 0);
  const expertiseMission = useMemo(() => getKqRouteExpertiseMission({
    masteries: snapshot?.routeMasteries ?? [],
    pinnedRoute: snapshot?.routePlan?.route ?? null,
  }), [snapshot?.routeMasteries, snapshot?.routePlan?.route]);
  const missionEquipmentGoal = useMemo(() => expertiseMission ? getKqRoutePlanEquipmentGoal({
    route: expertiseMission.route,
    ownedCodes: snapshot?.ownedCodes ?? [],
  }) : null, [expertiseMission, snapshot?.ownedCodes]);
  const nextGoal = useMemo(() => getKqNextEquipmentGoal({
    ownedCodes: snapshot?.ownedCodes ?? [],
    cashCents: snapshot?.cashCents ?? 0,
  }), [snapshot]);
  const routeGoalScenario = useMemo(() => snapshot?.routePlan
    ? getKqEquipmentPaybackScenarios(snapshot.routePlan.equipmentCode, {
      ownedCodes: snapshot.ownedCodes,
    }).find((scenario) => scenario.route === snapshot.routePlan?.route) ?? null
    : null, [snapshot]);
  const routeGoalProgress = useMemo(() => routeGoalScenario ? getKqEquipmentInvestmentProgress({
    investmentCents: routeGoalScenario.remainingInvestmentCents,
    cashCents: snapshot?.cashCents ?? 0,
  }) : null, [routeGoalScenario, snapshot?.cashCents]);
  const equipmentProgression = useMemo(
    () => getKqEquipmentProgressionStatus(snapshot?.ownedCodes ?? []),
    [snapshot?.ownedCodes],
  );
  const nextAction = useMemo(() => getKqPlacardNextAction({
    activeRun: snapshot?.activeRun ?? false,
    readyLotCount: snapshot?.readyLotCount ?? 0,
    availableFlowerCount: snapshot?.availableFlowerCount ?? 0,
    equipmentGoalAffordable: routeGoalProgress?.affordable ?? nextGoal?.affordable ?? false,
  }), [nextGoal?.affordable, routeGoalProgress?.affordable, snapshot?.activeRun, snapshot?.availableFlowerCount, snapshot?.readyLotCount]);
  const reputationProgress = useMemo(
    () => getKqReputationProgress(snapshot?.reputation ?? 0),
    [snapshot?.reputation],
  );
  const openDestination: Record<KqPlacardHubDestination, () => void> = {
    game: onOpenGame,
    arena: onOpenArena,
    market: onOpenMarket,
    shop: () => onOpenShop(snapshot?.routePlan?.equipmentCode ?? nextGoal?.equipment.code),
  };
  const NextActionIcon = nextAction.destination === "market"
    ? Banknote
    : nextAction.destination === "arena"
      ? Trophy
      : nextAction.destination === "shop"
        ? ShoppingBag
        : Target;

  const pinExpertiseMission = async () => {
    if (!expertiseMission || !missionEquipmentGoal || savingMission) return;
    setSavingMission(true);
    setMissionError("");
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "route-plan",
          route: expertiseMission.route,
          equipmentCode: missionEquipmentGoal.equipmentCode,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "La mission n’a pas pu être épinglée.");
      setSnapshot((current) => current ? {
        ...current,
        routePlan: { route: expertiseMission.route, equipmentCode: missionEquipmentGoal.equipmentCode },
      } : current);
      window.dispatchEvent(new Event("kq:equipment-updated"));
      if (missionEquipmentGoal.investmentRequired) onOpenShop(missionEquipmentGoal.equipmentCode);
    } catch (missionFailure) {
      setMissionError(missionFailure instanceof Error ? missionFailure.message : "Mission indisponible.");
    } finally {
      setSavingMission(false);
    }
  };

  const actionArtwork = {
    game: "/contest/mascot/arena-scene-placard-v1.png",
    market: "/placard/market-workshop-v1.webp",
    arena: "/contest/mascot/arena-scene-classement-v1.png",
    shop: "/placard/booster-shop-interior-v4.webp",
  };
  const tabs = [{ id: "overview", label: "En bref" }, { id: "equipment", label: "Matériel" }, { id: "goals", label: "Objectifs" }, { id: "energy", label: "Électricité" }] as const;
  const progressBar = (label: string, value: number) => <div className={styles.progressBar} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></div>;

  return (
    <>
    <section className={styles.dashboard} aria-labelledby="placard-hud-title" aria-busy={loading || undefined} data-placard-dashboard>
      <header className={styles.header}>
        <div><p>Tableau de bord</p><h2 id="placard-hud-title">Ton atelier</h2></div>
        <button type="button" onClick={requestRefresh} disabled={loading} aria-label="Actualiser le tableau de bord"><RefreshCw size={18} aria-hidden="true" /></button>
      </header>
      {error ? <div className={styles.error} role="alert"><CircleAlert size={22} aria-hidden="true" /><p>{error}</p><button type="button" onClick={requestRefresh}>Réessayer</button></div> : loading && !snapshot ? <p className={styles.loading} role="status">Ouverture de ton atelier…</p> : snapshot ? <>
        <div className={styles.stats} aria-label="Résumé de l’atelier">
          <div><Banknote size={21} aria-hidden="true" /><span><small>Disponible</small><strong>{formatKqCash(snapshot.cashCents)}</strong></span></div>
          <div><Trophy size={21} aria-hidden="true" /><span><small>Réputation · {reputationProgress.tier.name}</small><strong>{reputationProgress.reputation}</strong></span></div>
        </div>
        <nav className={styles.tabs} aria-label="Vues du tableau de bord">{tabs.map((tab) => <button key={tab.id} id={`hud-tab-${tab.id}`} type="button" aria-pressed={activeTab === tab.id} aria-controls="placard-hud-content" onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
        <div id="placard-hud-content" className={styles.content} role="region" aria-labelledby={`hud-tab-${activeTab}`}>
          {activeTab === "overview" ? <>
            <article className={styles.nextAction}>
              <Image src={actionArtwork[nextAction.destination]} alt="" fill sizes="(max-width: 700px) 100vw, 850px" />
              <div className={styles.actionCopy}><p><NextActionIcon size={15} aria-hidden="true" /> {nextAction.eyebrow}</p><h3>{nextAction.title}</h3><span>{nextAction.description}</span><button type="button" className={styles.primary} onClick={openDestination[nextAction.destination]}>{nextAction.buttonLabel}<ArrowRight size={18} aria-hidden="true" /></button></div>
            </article>
            <nav className={styles.cycle} aria-label="Cycle de production">
              <button type="button" onClick={onOpenGame}><small>Étape 1 · Culture</small><strong>{snapshot?.activeRun ? "En cours" : "À démarrer"}</strong></button>
              <button type="button" onClick={onOpenArena}><small>Étape 2 · Jury</small><strong>{snapshot?.availableFlowerCount ?? 0} fleur{snapshot.availableFlowerCount > 1 ? "s" : ""}</strong></button>
              <button type="button" onClick={onOpenMarket}><small>Étape 3 · Vente</small><strong>{snapshot?.readyLotCount ?? 0} lot{snapshot.readyLotCount > 1 ? "s" : ""}</strong></button>
            </nav>
          </> : null}
          {activeTab === "energy" ? <KqEnergyPanel /> : null}
          {activeTab === "equipment" ? <>
            <div className={styles.sectionIntro}><Image src="/placard/collection-chest.png" alt="" width={100} height={100} sizes="80px" /><div><p>Ton matériel durable</p><h3>{summary.installed.length} équipement{summary.installed.length > 1 ? "s" : ""} installé{summary.installed.length > 1 ? "s" : ""}</h3><span>{summary.purchased.length ? `${summary.purchased.length} investissement${summary.purchased.length > 1 ? "s" : ""} acquis` : "Ton kit de départ est opérationnel."}</span></div></div>
            {preview.length ? <ul className={styles.equipmentList}>{preview.map((equipment) => <li key={equipment.code}><span>{equipment.name} · Niv. {snapshot?.levels?.[equipment.code] ?? 1}</span><small data-installed={equipment.equipped}>{equipment.equipped ? "Installé" : "En réserve"}</small></li>)}</ul> : <p className={styles.hint}>Retrouve tes équipements de base dans l’inventaire et choisis ceux à installer.</p>}
            {hiddenCount > 0 ? <p className={styles.hint}>Et {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} dans ton inventaire.</p> : null}
            <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => setInventoryOpen(true)}><PackageCheck size={18} aria-hidden="true" /> Ouvrir l’Inventaire</button><button type="button" className={styles.secondary} onClick={() => onOpenShop()}><ShoppingBag size={17} aria-hidden="true" /> Boutique</button></div>
          </> : null}
          {activeTab === "goals" ? <>
            <div className={styles.sectionIntro}><Image src="/contest/mascot/tasting/tasting-verdict.png" alt="" width={100} height={120} sizes="75px" /><div><p>Un palier à la fois</p><h3>Ton prochain objectif</h3><span>Construis ton atelier à ton rythme.</span></div></div>
            <section className={styles.goal} aria-label="Prochain investissement">
              {routeGoalScenario && routeGoalProgress && snapshot?.routePlan ? <>
                <p>Filière épinglée · objectif sauvegardé</p><h4>{routeGoalScenario.name}</h4><span>Jury ≥ {routeGoalScenario.minimumJuryScore.toFixed(1)}/10</span>
                {progressBar("Progression du budget pour la filière épinglée", routeGoalProgress.progressPercent)}
                <p>{routeGoalScenario.remainingInvestmentCents === 0 ? "Chaîne acquise · vérifie les installations" : routeGoalProgress.affordable ? `Budget atteint · ${formatKqCash(routeGoalScenario.remainingInvestmentCents)} à investir` : `Encore ${formatKqCash(routeGoalProgress.remainingCents)} à réunir`}</p>
                <button type="button" className={styles.primary} onClick={() => onOpenShop(snapshot.routePlan?.equipmentCode)}>Poursuivre la filière <ArrowRight size={17} aria-hidden="true" /></button>
                <details className={styles.fundingDetails}><summary>Détails de l’investissement</summary><p>{routeGoalScenario.projectedEquipmentNames.join(" · ")}</p><p>{formatKqCash(routeGoalScenario.comparisonDeltaCents)} par lot témoin par rapport à la vente brute.</p></details>
              </> : nextGoal ? <>
                <h4>{nextGoal.equipment.name}</h4><span>{formatKqCash(nextGoal.equipment.priceCents)}</span>
                {progressBar("Progression du budget pour le prochain investissement", nextGoal.progressPercent)}
                <p>{nextGoal.affordable ? "Budget atteint · disponible dans le catalogue" : `Encore ${formatKqCash(nextGoal.remainingCents)} à réunir`}</p>
                <button type="button" className={styles.primary} onClick={() => onOpenShop(nextGoal.equipment.code)}>Voir l’équipement <ArrowRight size={17} aria-hidden="true" /></button>
                <details className={styles.fundingDetails}><summary>Ce que cet équipement apporte</summary><p>{nextGoal.equipment.benefit}</p></details>
              </> : <><Sparkles size={26} aria-hidden="true" /><h4>Progression principale terminée</h4><p>{equipmentProgression.catalogComplete ? "Tout le catalogue durable est acquis." : `${equipmentProgression.alternativeCount} modèles alternatifs restent disponibles.`}</p>{!equipmentProgression.catalogComplete ? <button type="button" className={styles.secondary} onClick={() => onOpenShop()}>Voir les alternatives</button> : null}</>}
            </section>
            <details className={styles.detail} aria-label="Mission d’atelier"><summary>Mission d’atelier <small>{expertiseMission?.name ?? "Toutes terminées"}</small></summary>
              {expertiseMission ? <div className={styles.detailBody}><h4>{expertiseMission.name} · {expertiseMission.targetTier.name}</h4>{progressBar(`Mission ${expertiseMission.name}`, expertiseMission.progressPercent)}<p>Encore {expertiseMission.salesRemaining} vente{expertiseMission.salesRemaining > 1 ? "s" : ""}{expertiseMission.bonusReputation > 0 ? ` · prime +${expertiseMission.bonusReputation} réputation si qualité suffisante` : " pour une première maîtrise"}.</p>
                {missionEquipmentGoal ? <p>{missionEquipmentGoal.equipmentName} · {missionEquipmentGoal.investmentRequired ? "à financer" : "déjà possédé"}</p> : null}
                {expertiseMission.source === "pinned" ? <button type="button" className={styles.secondary} onClick={onOpenMarket}>Voir les lots</button> : <button type="button" className={styles.secondary} disabled={savingMission || !missionEquipmentGoal} onClick={() => void pinExpertiseMission()}>{savingMission ? "Enregistrement…" : missionEquipmentGoal?.investmentRequired ? "Épingler et équiper" : "Épingler la mission"}</button>}
                {missionError ? <p role="alert">{missionError}</p> : null}
              </div> : <p className={styles.hint}>Les huit filières sont au rang Maîtrise.</p>}
            </details>
            <details className={styles.detail} aria-label="Filières maîtrisées"><summary>Palmarès permanent <small>{masteredRoutes.length}/{KQ_TRANSFORMATION_ROUTE_COUNT} filières</small></summary><div className={styles.detailBody}>
              <p>{masteredRouteSales} vente{masteredRouteSales > 1 ? "s" : ""} en transformation.</p>
              {masteredRoutes.length ? <ul className={styles.masteries}>{masteredRoutes.map((mastery) => <li key={mastery.route}><strong>{mastery.name}</strong><span>{mastery.expertise.tier.name} · {mastery.saleCount} ventes · record {mastery.bestJuryScore.toFixed(1)}/10</span>{progressBar(`Expertise ${mastery.name}`, mastery.expertise.progressPercent)}<small>{mastery.expertise.nextTier ? `Encore ${mastery.expertise.salesToNext} pour ${mastery.expertise.nextTier.name}` : "Rang maximal"}</small></li>)}</ul> : <p>Ta première transformation ouvrira ce palmarès.</p>}
              <button type="button" className={styles.secondary} onClick={onOpenMarket}>Aller au marché</button>
            </div></details>
            <details className={styles.detail}><summary>Réputation <small>{reputationProgress.tier.name}</small></summary><div className={styles.detailBody}>{progressBar("Progression de réputation", reputationProgress.progressPercent)}<p>{reputationProgress.nextTier ? `${reputationProgress.pointsToNext} points avant ${reputationProgress.nextTier.name}.` : "Palier maximal atteint."}</p></div></details>
          </> : null}
        </div>
      </> : null}
    </section>
    {inventoryOpen ? (
      <KqEquipmentInventoryModal
        ownedCodes={snapshot?.ownedCodes ?? []}
        purchasedCodes={snapshot?.purchasedCodes ?? []}
        equippedCodes={snapshot?.equippedCodes ?? []}
        levels={snapshot?.levels ?? {}}
        cashCents={snapshot?.cashCents ?? 0}
        loading={loading && !snapshot}
        loadError={error}
        onClose={closeInventory}
        onOpenShop={openInventoryShop}
        onRetry={requestRefresh}
      />
    ) : null}
    </>
  );
}
