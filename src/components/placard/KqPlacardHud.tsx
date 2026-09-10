"use client";

import {
  Banknote,
  ChevronDown,
  CircleAlert,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Wrench,
} from "lucide-react";
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
import { KqEquipmentInventoryModal } from "./KqEquipmentInventoryModal";
import retro from "../contest/ArenaRetro.module.css";

type EquipmentHudSnapshot = {
  cashCents: number;
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
  const [hudExpanded, setHudExpanded] = useState(false);
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

  return (
    <>
    <section
      className={`${retro.hud} mb-6 overflow-hidden border-2 bg-[#e3f0e8]`}
      aria-labelledby="placard-hud-title"
      aria-busy={loading || undefined}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-green px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center border-2 border-white bg-yellow text-ink shadow-[2px_2px_0_#fff]">
            <Wrench aria-hidden="true" size={20} strokeWidth={2.8} />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow">Tableau de bord</p>
            <h2 id="placard-hud-title" className="font-display text-2xl uppercase leading-none">Ton atelier</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setInventoryOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-2 border-white bg-yellow px-2 text-xs font-black uppercase text-ink shadow-[3px_3px_0_#fff] transition hover:-translate-y-0.5 sm:px-3"
            title="Ouvrir l’inventaire"
          >
            <PackageCheck aria-hidden="true" size={17} strokeWidth={2.8} />
            <span className="hidden sm:inline">Inventaire</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenShop()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-2 border-white bg-white px-2 text-xs font-black uppercase text-ink shadow-[3px_3px_0_#f4c43d] transition hover:-translate-y-0.5 sm:px-3"
            title="Ouvrir la boutique"
          >
            <ShoppingBag aria-hidden="true" size={16} strokeWidth={2.8} />
            <span className="hidden sm:inline">Boutique</span>
          </button>
          <button
            type="button"
            aria-expanded={hudExpanded}
            aria-controls="placard-hud-details"
            onClick={() => setHudExpanded((current) => !current)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-2 border-white bg-[#20251c] px-2 text-xs font-black uppercase text-white shadow-[3px_3px_0_#f4c43d] transition hover:-translate-y-0.5 sm:px-3"
            title={hudExpanded ? "Replier le tableau de bord" : "Dérouler le tableau de bord"}
          >
            <ChevronDown className={`transition-transform ${hudExpanded ? "rotate-180" : ""}`} aria-hidden="true" size={18} strokeWidth={3} />
            <span className="hidden sm:inline">{hudExpanded ? "Replier" : "Dérouler"}</span>
          </button>
        </div>
      </header>

      {!hudExpanded ? error ? (
        <div className="flex min-h-16 items-center justify-between gap-3 bg-[#fff1dc] px-3 py-2" role="alert">
          <span className="flex min-w-0 items-center gap-2 truncate text-xs font-bold"><CircleAlert aria-hidden="true" size={17} />Tableau de bord indisponible</span>
          <button type="button" onClick={requestRefresh} className="inline-flex min-h-11 shrink-0 items-center gap-2 border-2 border-ink bg-white px-3 text-[10px] font-black uppercase shadow-[2px_2px_0_#111]"><RefreshCw aria-hidden="true" size={15} />Réessayer</button>
        </div>
      ) : (
        <div className={`${retro.hudSummary} grid min-h-16 border-ink bg-white`} aria-label="Résumé de l’atelier">
          <span className="flex min-w-0 items-center gap-2 border-r-2 border-ink px-3 py-2">
            <Banknote className="shrink-0 text-[#167d6b]" aria-hidden="true" size={19} />
            <span className="min-w-0"><small className="block text-[8px] font-black uppercase text-charcoal">Disponible</small><strong className="block truncate text-sm font-black sm:text-base">{loading ? "…" : formatKqCash(snapshot?.cashCents ?? 0)}</strong></span>
          </span>
          <span className="flex min-w-0 items-center gap-2 border-r-2 border-ink px-3 py-2">
            <Trophy className="shrink-0 text-[#d58b00]" aria-hidden="true" size={18} />
            <span className="min-w-0"><small className="block text-[8px] font-black uppercase text-charcoal">Réputation</small><strong className="block truncate text-sm font-black sm:text-base">{loading ? "…" : reputationProgress.reputation}</strong></span>
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={openDestination[nextAction.destination]}
            className="inline-flex min-h-16 items-center justify-center gap-2 bg-yellow px-3 text-[10px] font-black uppercase transition hover:bg-[#ffd95b] disabled:cursor-wait disabled:opacity-60 sm:px-5"
            aria-label={`${nextAction.title} · ${nextAction.buttonLabel}`}
          >
            <NextActionIcon aria-hidden="true" size={18} strokeWidth={2.8} />
            <span className="hidden sm:inline">{nextAction.buttonLabel}</span>
            <span className="sm:hidden">Continuer</span>
          </button>
        </div>
      ) : null}

      <div id="placard-hud-details" hidden={!hudExpanded}>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fff1dc] px-4 py-4" role="alert">
          <span className="flex items-center gap-2 text-sm font-bold"><CircleAlert aria-hidden="true" size={19} />{error}</span>
          <button type="button" onClick={requestRefresh} className="inline-flex items-center gap-2 border-2 border-ink bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0_#111]"><RefreshCw aria-hidden="true" size={15} />Réessayer</button>
        </div>
      ) : (
        <div>
          {!loading ? (
            <div className="grid gap-3 border-b-2 border-ink bg-yellow p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <span className="grid h-12 w-12 place-items-center border-2 border-ink bg-white shadow-[3px_3px_0_#111]">
                <NextActionIcon aria-hidden="true" size={24} strokeWidth={2.7} />
              </span>
              <div>
                <small className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#76510b]">{nextAction.eyebrow} · action conseillée</small>
                <strong className="block font-display text-xl uppercase leading-tight sm:text-2xl">{nextAction.title}</strong>
                <p className="mt-1 max-w-3xl text-xs font-bold text-charcoal sm:text-sm">{nextAction.description}</p>
              </div>
              <button type="button" onClick={openDestination[nextAction.destination]} className="min-h-11 border-2 border-ink bg-white px-4 text-xs font-black uppercase shadow-[3px_3px_0_#111] transition hover:-translate-y-0.5">{nextAction.buttonLabel}</button>
            </div>
          ) : null}
          {!loading ? (
            <nav className="grid border-b-2 border-ink bg-[#d8e4d0] sm:grid-cols-3" aria-label="Cycle de production">
              <button
                type="button"
                onClick={onOpenGame}
                className={`group flex min-h-24 items-center gap-3 border-b-2 border-ink p-3 text-left transition hover:bg-yellow sm:border-b-0 sm:border-r-2 ${snapshot?.activeRun ? "bg-[#fff7cf]" : "bg-white"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-yellow shadow-[2px_2px_0_#111]"><Target aria-hidden="true" size={19} strokeWidth={2.8} /></span>
                <span className="min-w-0"><small className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#76510b]">Étape 1 · Culture</small><strong className="block font-display text-lg uppercase leading-none">{snapshot?.activeRun ? "En cours" : "Placard libre"}</strong><em className="mt-1 block text-[10px] font-bold not-italic text-charcoal">{snapshot?.activeRun ? "Reprendre la prochaine étape" : "Lancer une nouvelle récolte"}</em></span>
              </button>
              <button
                type="button"
                onClick={onOpenArena}
                className={`group flex min-h-24 items-center gap-3 border-b-2 border-ink p-3 text-left transition hover:bg-yellow sm:border-b-0 sm:border-r-2 ${(snapshot?.availableFlowerCount ?? 0) > 0 ? "bg-[#fff7cf]" : "bg-white"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-[#167d6b] text-white shadow-[2px_2px_0_#111]"><Trophy aria-hidden="true" size={19} strokeWidth={2.8} /></span>
                <span className="min-w-0"><small className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#167d6b]">Étape 2 · Jury</small><strong className="block font-display text-lg uppercase leading-none">{snapshot?.availableFlowerCount ?? 0} Fleur{(snapshot?.availableFlowerCount ?? 0) > 1 ? "s" : ""} prête{(snapshot?.availableFlowerCount ?? 0) > 1 ? "s" : ""}</strong><em className="mt-1 block text-[10px] font-bold not-italic text-charcoal">Déposer une Fleur, adversaire tiré au hasard</em></span>
              </button>
              <button
                type="button"
                onClick={onOpenMarket}
                className={`group flex min-h-24 items-center gap-3 p-3 text-left transition hover:bg-yellow ${(snapshot?.readyLotCount ?? 0) > 0 ? "bg-[#fff7cf]" : "bg-white"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-[#ef6f31] text-white shadow-[2px_2px_0_#111]"><Banknote aria-hidden="true" size={19} strokeWidth={2.8} /></span>
                <span className="min-w-0"><small className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#9b3e24]">Étape 3 · Vente</small><strong className="block font-display text-lg uppercase leading-none">{snapshot?.readyLotCount ?? 0} lot{(snapshot?.readyLotCount ?? 0) > 1 ? "s" : ""} à décider</strong><em className="mt-1 block text-[10px] font-bold not-italic text-charcoal">Vendre, transformer ou sauver en biomasse</em></span>
              </button>
            </nav>
          ) : null}
          <div className="grid gap-0 lg:grid-cols-[1fr_1.65fr]">
          <div className="grid grid-cols-2 border-b-2 border-ink bg-white lg:border-b-0 lg:border-r-2">
            <article className="flex min-h-24 items-center gap-3 border-b-2 border-r-2 border-ink p-3">
              <Banknote className="shrink-0 text-[#167d6b]" aria-hidden="true" size={25} strokeWidth={2.4} />
              <span className="min-w-0"><small className="block text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Disponible</small><strong className="block truncate text-xl font-black sm:text-2xl">{loading ? "…" : formatKqCash(snapshot?.cashCents ?? 0)}</strong></span>
            </article>
            <article className="flex min-h-24 items-center gap-3 border-b-2 border-ink p-3">
              <Trophy className="shrink-0 text-[#d58b00]" aria-hidden="true" size={24} strokeWidth={2.4} />
              <div className="min-w-0 flex-1">
                <small className="block text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Réputation</small>
                <strong className="block text-xl font-black sm:text-2xl">{loading ? "…" : reputationProgress.reputation}</strong>
                {!loading ? <><em className="block truncate text-[9px] font-black not-italic uppercase text-[#9a5b17]">{reputationProgress.tier.name}</em><span className="mt-1 block h-1.5 overflow-hidden border border-ink bg-white" role="progressbar" aria-label="Progression de réputation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={reputationProgress.progressPercent}><i className="block h-full bg-yellow" style={{ width: `${reputationProgress.progressPercent}%` }} /></span></> : null}
              </div>
            </article>
            <article className="flex min-h-20 items-center gap-3 border-r-2 border-ink p-3">
              <PackageCheck className="shrink-0 text-[#167d6b]" aria-hidden="true" size={22} />
              <span><small className="block text-[10px] font-black uppercase text-charcoal">Investissements</small><strong className="text-lg font-black">{loading ? "…" : summary.purchased.length}</strong></span>
            </article>
            <article className="flex min-h-20 items-center gap-3 p-3">
              <Sparkles className="shrink-0 text-[#167d6b]" aria-hidden="true" size={22} />
              <span><small className="block text-[10px] font-black uppercase text-charcoal">Installés</small><strong className="text-lg font-black">{loading ? "…" : summary.installed.length}</strong></span>
            </article>
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div><small className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#167d6b]">Matériel acheté</small><strong className="font-display text-xl uppercase">Ton inventaire durable</strong></div>
              {!loading && summary.purchased.length > 0 ? <span className="border-2 border-ink bg-yellow px-2 py-1 text-[10px] font-black uppercase">{summary.purchased.length} pièce{summary.purchased.length > 1 ? "s" : ""}</span> : null}
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><i className="h-14 animate-pulse border-2 border-ink/30 bg-white/70 motion-reduce:animate-none" /><i className="h-14 animate-pulse border-2 border-ink/30 bg-white/70 motion-reduce:animate-none" /><i className="hidden h-14 animate-pulse border-2 border-ink/30 bg-white/70 motion-reduce:animate-none sm:block" /></div>
            ) : summary.purchased.length === 0 ? (
              <div className="border-2 border-dashed border-ink bg-white/70 p-3 text-sm"><strong className="block">Kit de départ opérationnel.</strong><span className="text-charcoal">Aucun investissement acheté pour le moment. Tu disposes déjà de {summary.installed.length} équipements de base installés.</span></div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {preview.map((equipment) => (
                  <span key={equipment.code} className="min-w-0 max-w-full border-2 border-ink bg-white px-3 py-2 shadow-[2px_2px_0_#111]">
                    <strong className="block max-w-52 truncate text-xs">{equipment.name}</strong>
                    <small className={`block text-[9px] font-black uppercase ${equipment.equipped ? "text-[#167d6b]" : "text-[#9a5b17]"}`}>{equipment.equipped ? "Installé" : "En réserve"}</small>
                  </span>
                ))}
                {hiddenCount > 0 ? <button type="button" onClick={() => setInventoryOpen(true)} className="min-h-11 border-2 border-ink bg-yellow px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0_#111]">+{hiddenCount} autre{hiddenCount > 1 ? "s" : ""} · voir l’inventaire</button> : null}
              </div>
            )}
            {!loading ? (
              <section className="mt-4 border-2 border-ink bg-[#d9f3ef] p-3 shadow-[3px_3px_0_#111]" aria-label="Filières maîtrisées">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Trophy className="shrink-0 text-[#167d6b]" aria-hidden="true" size={21} strokeWidth={2.7} />
                    <span className="min-w-0"><small className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#167d6b]">Palmarès permanent</small><strong className="block font-display text-lg uppercase leading-none">Filières maîtrisées</strong></span>
                  </span>
                  <button type="button" onClick={onOpenMarket} className="border-2 border-ink bg-white px-2 py-1 text-[9px] font-black uppercase shadow-[2px_2px_0_#111]">{masteredRoutes.length}/{KQ_TRANSFORMATION_ROUTE_COUNT} · {masteredRouteSales} vente{masteredRouteSales > 1 ? "s" : ""}</button>
                </header>
                {expertiseMission ? (
                  <article className="mt-3 grid gap-3 border-2 border-ink bg-[#fff7cf] p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center" aria-label="Mission d’atelier">
                    <Target className="text-[#d58b00]" aria-hidden="true" size={23} strokeWidth={2.7} />
                    <div className="min-w-0">
                      <small className="block text-[9px] font-black uppercase tracking-[0.1em] text-[#9a5b17]">{expertiseMission.source === "pinned" ? "Mission épinglée" : "Palier le plus proche"}</small>
                      <strong className="block truncate text-xs uppercase">{expertiseMission.name} · viser {expertiseMission.targetTier.name}</strong>
                      <span className="mt-2 block h-2 overflow-hidden border border-ink bg-white" role="progressbar" aria-label={`Mission ${expertiseMission.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={expertiseMission.progressPercent}><i className="block h-full bg-yellow" style={{ width: `${expertiseMission.progressPercent}%` }} /></span>
                      <p className="mt-1 text-[9px] font-bold text-charcoal">Encore {expertiseMission.salesRemaining} vente{expertiseMission.salesRemaining > 1 ? "s" : ""}{expertiseMission.bonusReputation > 0 ? ` · prime +${expertiseMission.bonusReputation} réputation si qualité suffisante` : " · première maîtrise de la voie"}</p>
                      {expertiseMission.source !== "pinned" && missionEquipmentGoal ? <p className="mt-1 text-[9px] font-black text-[#167d6b]">Pivot · {missionEquipmentGoal.equipmentName}{missionEquipmentGoal.investmentRequired ? " · à financer" : " · déjà possédé"}</p> : null}
                    </div>
                    {expertiseMission.source === "pinned" ? <button type="button" onClick={onOpenMarket} className="border-2 border-ink bg-white px-3 py-2 text-[9px] font-black uppercase shadow-[2px_2px_0_#111]">Voir les lots</button> : <button type="button" disabled={savingMission || !missionEquipmentGoal} onClick={() => void pinExpertiseMission()} className="border-2 border-ink bg-[#167d6b] px-3 py-2 text-[9px] font-black uppercase text-white shadow-[2px_2px_0_#111] disabled:cursor-wait disabled:opacity-60">{savingMission ? "Enregistrement…" : missionEquipmentGoal?.investmentRequired ? "Épingler et équiper" : "Épingler la mission"}</button>}
                    {missionError ? <p className="text-[9px] font-black text-red-800 sm:col-span-3" role="alert">{missionError}</p> : null}
                  </article>
                ) : <p className="mt-3 border-2 border-ink bg-yellow p-3 text-[10px] font-black uppercase">Palmarès total · les huit filières sont au rang Maîtrise.</p>}
                {masteredRoutes.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {masteredRoutes.map((mastery) => (
                      <span key={mastery.route} className="border-2 border-ink bg-white px-2 py-1.5 shadow-[2px_2px_0_#167d6b]">
                        <strong className="block max-w-44 truncate text-[10px] uppercase">{mastery.name}</strong>
                        <small className="block text-[8px] font-black uppercase text-[#167d6b]">{mastery.expertise.tier.name} · ×{mastery.saleCount} · record {mastery.bestJuryScore.toFixed(1)}/10</small>
                        <span className="mt-1 block h-1.5 overflow-hidden border border-ink bg-[#eee7d6]" role="progressbar" aria-label={`Expertise ${mastery.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={mastery.expertise.progressPercent}><i className="block h-full bg-yellow" style={{ width: `${mastery.expertise.progressPercent}%` }} /></span>
                        <em className="mt-1 block text-[8px] font-bold not-italic text-charcoal">{mastery.expertise.nextTier ? `Encore ${mastery.expertise.salesToNext} pour ${mastery.expertise.nextTier.name}` : "Rang maximal"}</em>
                      </span>
                    ))}
                  </div>
                ) : <p className="mt-2 text-[10px] font-bold text-charcoal">Épingle une filière, atteins sa note au jury puis signe ta première vente pour ouvrir ce palmarès.</p>}
              </section>
            ) : null}
            {!loading ? (
              <div className="mt-4 border-2 border-ink bg-[#fff7cf] p-3">
                {routeGoalScenario && routeGoalProgress && snapshot?.routePlan ? (
                  <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <Target className="text-[#d58b00]" aria-hidden="true" size={24} strokeWidth={2.6} />
                    <div className="min-w-0">
                      <small className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#9a5b17]">Filière épinglée · objectif sauvegardé</small>
                      <strong className="block truncate text-sm">{routeGoalScenario.name} · jury ≥ {routeGoalScenario.minimumJuryScore.toFixed(1)}/10</strong>
                      <p className="mt-1 text-[10px] font-bold leading-snug text-charcoal">+{formatKqCash(routeGoalScenario.comparisonDeltaCents)} par lot témoin face à la vente brute · {routeGoalScenario.projectedEquipmentNames.join(" · ")}</p>
                      <div
                        className="mt-2 h-2 overflow-hidden border border-ink bg-white"
                        role="progressbar"
                        aria-label="Progression du budget pour la filière épinglée"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={routeGoalProgress.progressPercent}
                      >
                        <i className="block h-full bg-yellow" style={{ width: `${routeGoalProgress.progressPercent}%` }} />
                      </div>
                      <small className="mt-1 block text-[10px] font-bold text-charcoal">
                        {routeGoalScenario.remainingInvestmentCents === 0
                          ? "Chaîne acquise · vérifie maintenant les installations"
                          : routeGoalProgress.affordable
                            ? `Budget atteint · ${formatKqCash(routeGoalScenario.remainingInvestmentCents)} à investir`
                            : `Encore ${formatKqCash(routeGoalProgress.remainingCents)} à réunir`}
                      </small>
                    </div>
                    <button type="button" onClick={() => onOpenShop(snapshot.routePlan?.equipmentCode)} className="border-2 border-ink bg-white px-3 py-2 text-[10px] font-black uppercase shadow-[2px_2px_0_#111]">Poursuivre la filière</button>
                  </div>
                ) : nextGoal ? (
                  <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <Target className="text-[#d58b00]" aria-hidden="true" size={24} strokeWidth={2.6} />
                    <div className="min-w-0">
                      <small className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#9a5b17]">Prochain investissement</small>
                      <strong className="block truncate text-sm">{nextGoal.equipment.name} · {formatKqCash(nextGoal.equipment.priceCents)}</strong>
                      <p className="mt-1 text-[10px] font-bold leading-snug text-charcoal">{nextGoal.equipment.benefit}</p>
                      <div
                        className="mt-2 h-2 overflow-hidden border border-ink bg-white"
                        role="progressbar"
                        aria-label="Progression du budget pour le prochain investissement"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={nextGoal.progressPercent}
                      >
                        <i className="block h-full bg-yellow" style={{ width: `${nextGoal.progressPercent}%` }} />
                      </div>
                      <small className="mt-1 block text-[10px] font-bold text-charcoal">
                        {nextGoal.affordable ? "Budget atteint · disponible dans le catalogue" : `Encore ${formatKqCash(nextGoal.remainingCents)} à réunir`}
                      </small>
                    </div>
                    <button type="button" onClick={() => onOpenShop(nextGoal.equipment.code)} className="border-2 border-ink bg-white px-3 py-2 text-[10px] font-black uppercase shadow-[2px_2px_0_#111]">Voir la fiche</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-bold"><Sparkles aria-hidden="true" size={18} />{equipmentProgression.catalogComplete ? "Atelier complet : tout le catalogue durable est acquis." : `Progression principale terminée : ${equipmentProgression.alternativeCount} modèle${equipmentProgression.alternativeCount > 1 ? "s" : ""} alternatif${equipmentProgression.alternativeCount > 1 ? "s" : ""} reste${equipmentProgression.alternativeCount > 1 ? "nt" : ""} disponible${equipmentProgression.alternativeCount > 1 ? "s" : ""}.`}</p>
                    {!equipmentProgression.catalogComplete ? <button type="button" onClick={() => onOpenShop()} className="border-2 border-ink bg-white px-3 py-2 text-[10px] font-black uppercase shadow-[2px_2px_0_#111]">Voir les alternatives</button> : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        </div>
      )}
      </div>
    </section>
    {inventoryOpen ? (
      <KqEquipmentInventoryModal
        ownedCodes={snapshot?.ownedCodes ?? []}
        purchasedCodes={snapshot?.purchasedCodes ?? []}
        equippedCodes={snapshot?.equippedCodes ?? []}
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
