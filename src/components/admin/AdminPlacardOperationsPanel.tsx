"use client";

import Link from "next/link";
import { Download, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminProducerRewardCampaigns } from "@/components/admin/AdminProducerRewardCampaigns";
import { AdminBotteCatalogEditor } from "@/components/admin/AdminBotteCatalogEditor";
import { AdminHeritageCatalogEditor } from "@/components/admin/AdminHeritageCatalogEditor";
import { AdminPlacardArtworkReview } from "@/components/admin/AdminPlacardArtworkReview";
import { AdminPlacardEconomyReview } from "@/components/admin/AdminPlacardEconomyReview";
import { AdminPlacardLaunchDossierBuilder } from "@/components/admin/AdminPlacardLaunchDossierBuilder";
import { AdminPlacardLaunchEvidence } from "@/components/admin/AdminPlacardLaunchEvidence";
import { AdminPlacardMobileReview } from "@/components/admin/AdminPlacardMobileReview";
import type { KqLaunchDossier } from "@/lib/kanab-quest-launch-approvals";
import {
  buildKqRetroEvidence,
  downloadKqRetroEvidence,
  type KqRetroEvidence,
} from "@/lib/kanab-quest-retro-evidence";

type Readiness = {
  contentReady: boolean;
  safelyDormant: boolean;
  readyForActivation: boolean;
  blockers: string[];
  checks: Array<{ code: string; label: string; ready: boolean; detail?: string }>;
  activationStillRequired: string[];
  launchDossier: KqLaunchDossier;
};

type Bootstrap = {
  warnings?: string[];
  readiness?: Readiness | null;
  collection?: {
    collectionActive?: boolean;
    ownerFound?: boolean;
    cards?: Array<{ isActive?: boolean; ownedCopies?: number }>;
  } | null;
  heritage?: {
    collectionActive?: boolean;
    purchaseDrawsLive?: boolean;
    cards?: Array<{ isActive?: boolean; ownedCopies?: number }>;
    eligiblePurchaseUnits?: number;
    attributedPurchaseUnits?: number;
    pendingPurchaseUnits?: number;
  } | null;
  notebookRewards?: {
    rewardsLive?: boolean;
    pendingBadges?: number;
    pendingSupportBoosters?: number;
    pendingCultureTokens?: number;
    alreadyGranted?: number;
  } | null;
  seasonRewards?: {
    rewardsLive?: boolean;
    eligiblePlayers?: number;
    pendingGrants?: number;
    alreadyGranted?: number;
    totalSupportBoosters?: number;
    totalHeritageFragments?: number;
  } | null;
  seasonRollover?: {
    fromSeason?: string;
    toSeason?: string | null;
    ready?: boolean;
    players?: number;
    eligiblePlayers?: number;
    missingRewardGrants?: number;
    lockedBattles?: number;
    blockers?: string[];
  } | null;
  randomBattleQueue?: {
    generatedAt: string;
    status: "healthy" | "watch" | "critical";
    waitingCount: number;
    oldestQueuedAt: string | null;
    oldestWaitMinutes: number;
    waitingOver15Minutes: number;
    waitingOver60Minutes: number;
    qualityBands: {
      artisanale: number;
      bellePousse: number;
      concours: number;
      legendaire: number;
      unknown: number;
    };
    truncated: boolean;
  } | null;
};
type BotDashboard = {
  dayKey: string; dailyLimit: number; battlesToday: number; activePlayersToday: number;
  playersAtLimit: number; experienceAwardedToday: number; totalArenaExperience: number;
  players: Array<{ userId: string; count: number; remaining: number; atLimit: boolean }>;
  recent: Array<{ id: string; userId: string; botCode: string; winner: string; experienceAwarded: number; verdictAt: string }>;
};
type CustomerRewardPool = {
  seasonCode: string;
  status: "active" | "frozen" | "settled" | string;
  poolGrams: number;
  wholePoolGrams: number;
  currentWeekGrams: number;
  contributionRateBps: number;
  weeklyDice: { rollCount: number; average: number | null; rateBps: number };
  eligiblePlayers: number;
  minimumHumanBattles: number;
  topRewards: Array<{ leaderboardRank: number; pseudo: string; estimatedGrams: number }>;
  surpriseReward: { estimatedGrams: number; eligiblePlayers: number };
};
type CustomerRewardPreview = {
  rankingWinners?: number;
  rankingGrams?: number;
  surpriseCandidates?: number;
  surpriseGrams?: number;
  ready?: boolean;
  seasonStatus?: string;
};
type RetroBatchPreview = {
  mode?: "preview" | "execute";
  cursor?: number;
  nextCursor?: number | null;
  previewFingerprint?: string;
  writeAllowed?: boolean;
  live?: boolean;
  processed?: number;
  pending?: number;
  alreadyGranted?: number;
  processedItems?: number;
  eligibleUnits?: number;
  pendingUnits?: number;
  alreadyAwarded?: number;
};
type AdminAction = "" | "notebook" | "heritage" | "season" | "reward-preview" | "reward-freeze" | "reward-settle";

async function readJson(response: Response) {
  return await response.json() as Bootstrap & {
    error?: string;
    nextCursor?: number | null;
    granted?: number;
    alreadyGranted?: number;
    awarded?: number;
    alreadyAwarded?: number;
    mode?: "preview" | "execute";
    cursor?: number;
    previewFingerprint?: string;
    writeAllowed?: boolean;
    live?: boolean;
    processed?: number;
    pending?: number;
    processedItems?: number;
    eligibleUnits?: number;
    pendingUnits?: number;
  };
}

export function AdminPlacardOperationsPanel() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [botDashboard, setBotDashboard] = useState<BotDashboard | null>(null);
  const [customerRewards, setCustomerRewards] = useState<CustomerRewardPool | null>(null);
  const [customerRewardPreview, setCustomerRewardPreview] = useState<CustomerRewardPreview | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<AdminAction>("");
  const [notebookCursor, setNotebookCursor] = useState<number | null>(0);
  const [heritageCursor, setHeritageCursor] = useState<number | null>(0);
  const [notebookRetroPreview, setNotebookRetroPreview] = useState<RetroBatchPreview | null>(null);
  const [heritageRetroPreview, setHeritageRetroPreview] = useState<RetroBatchPreview | null>(null);
  const [notebookRetroEvidence, setNotebookRetroEvidence] = useState<KqRetroEvidence | null>(null);
  const [heritageRetroEvidence, setHeritageRetroEvidence] = useState<KqRetroEvidence | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const [response, botResponse, rewardResponse] = await Promise.all([
        fetch("/api/admin/placard/bootstrap", { cache: "no-store" }),
        fetch("/api/admin/placard/bot-battles", { cache: "no-store" }),
        fetch("/api/admin/arena/customer-rewards", { cache: "no-store" }),
      ]);
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Pilotage Placard indisponible.");
      setData(payload);
      if (botResponse.ok) setBotDashboard(await botResponse.json() as BotDashboard);
      else setBotDashboard(null);
      const warnings = [...(payload.warnings ?? [])];
      if (!botResponse.ok) warnings.push("Suivi des entraînements indisponible.");
      if (rewardResponse.ok) setCustomerRewards(await rewardResponse.json() as CustomerRewardPool);
      else {
        setCustomerRewards(null);
        const rewardError = await rewardResponse.json().catch(() => ({})) as { error?: string };
        warnings.push(rewardError.error || "Pilotage du Pot de la Canopée indisponible.");
      }
      if (warnings.length > 0) setStatus(warnings.join(" · "));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pilotage Placard indisponible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (
    kind: "notebook" | "heritage" | "season",
    url: string,
    body?: Record<string, unknown>,
    execute = true,
  ) => {
    if (action) return;
    const labels = {
      notebook: "la rétro-attribution du Carnet",
      heritage: "les tirages Héritage rétroactifs",
      season: "la distribution des récompenses de saison",
    };
    if (execute && !window.confirm(`Confirmer ${labels[kind]} ? Cette opération modifie les données enregistrées.`)) return;
    setAction(kind);
    setStatus("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify({
          ...body,
          ...(kind === "season" ? {} : {
            execute,
            ...(execute ? { confirmation: "EXECUTE_RETRO_BATCH" } : {}),
          }),
        }) : undefined,
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Opération impossible.");
      if (kind === "notebook") setNotebookRetroEvidence(buildKqRetroEvidence("notebook", payload));
      if (kind === "heritage") setHeritageRetroEvidence(buildKqRetroEvidence("heritage", payload));
      if (!execute && kind !== "season") {
        if (kind === "notebook") setNotebookRetroPreview(payload);
        if (kind === "heritage") setHeritageRetroPreview(payload);
        setStatus(kind === "notebook"
          ? `Simulation Carnet · ${Number(payload.pending ?? 0)} attribution(s) à créer · ${Number(payload.alreadyGranted ?? 0)} déjà traitée(s).`
          : `Simulation Héritage · ${Number(payload.pendingUnits ?? 0)} tirage(s) à créer · ${Number(payload.alreadyAwarded ?? 0)} déjà traité(s).`);
        return;
      }
      if (kind === "notebook") setNotebookCursor(payload.nextCursor ?? null);
      if (kind === "heritage") setHeritageCursor(payload.nextCursor ?? null);
      if (kind === "notebook") setNotebookRetroPreview(null);
      if (kind === "heritage") setHeritageRetroPreview(null);
      setStatus(`Opération terminée · ${Number(payload.granted ?? payload.awarded ?? 0)} nouvelle(s) attribution(s) · ${Number(payload.alreadyGranted ?? payload.alreadyAwarded ?? 0)} déjà traitée(s).`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Opération impossible.");
    } finally {
      setAction("");
    }
  };

  const advanceRetroPreview = (kind: "notebook" | "heritage", cursor: number | null | undefined) => {
    if (kind === "notebook") {
      setNotebookCursor(cursor ?? null);
      setNotebookRetroPreview(null);
    } else {
      setHeritageCursor(cursor ?? null);
      setHeritageRetroPreview(null);
    }
  };

  const runCustomerRewardAction = async (kind: "preview" | "freeze" | "settle") => {
    if (action) return;
    const nextAction: AdminAction = `reward-${kind}`;
    if (kind === "freeze" && !window.confirm(
      "Geler le Pot de la Canopée ? Les achats payés après cet instant n’entreront plus dans cette saison.",
    )) return;
    if (kind === "settle" && !window.confirm(
      "Attribuer maintenant les grammes au Top 10 et à une Fleur Surprise ? Cette opération crée les récompenses client et ne peut pas être rejouée.",
    )) return;
    setAction(nextAction);
    setStatus("");
    try {
      const response = await fetch("/api/admin/arena/customer-rewards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: kind, execute: kind !== "preview" }),
      });
      const payload = await response.json() as CustomerRewardPreview & {
        error?: string;
        granted?: number;
        alreadySettled?: boolean;
      };
      if (!response.ok) throw new Error(payload.error || "Opération impossible.");
      if (kind === "preview") {
        setCustomerRewardPreview(payload);
        setStatus(
          `Simulation prête · ${Number(payload.rankingWinners ?? 0)} place(s) récompensée(s) · ${Number(payload.surpriseCandidates ?? 0)} candidat(s) à la Fleur Surprise.`,
        );
      } else {
        await load();
        setStatus(kind === "freeze"
          ? "Pot gelé : les grammes et la liste des participants sont maintenant figés."
          : `Attribution terminée · ${Number(payload.granted ?? 0)} récompense(s) client créée(s).`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Opération impossible.");
    } finally {
      setAction("");
    }
  };

  const readiness = data?.readiness;
  const collection = data?.collection;
  const heritage = data?.heritage;
  const notebook = data?.notebookRewards;
  const season = data?.seasonRewards;
  const rollover = data?.seasonRollover;
  const randomBattleQueue = data?.randomBattleQueue;
  const supportCards = collection?.cards ?? [];
  const heritageCards = heritage?.cards ?? [];
  const approvalChecks = readiness?.checks.filter((check) => check.code.endsWith("-approved")) ?? [];
  const technicalChecks = readiness?.checks.filter((check) => !check.code.endsWith("-approved")) ?? [];

  return (
    <section className="grid gap-5">
      <div className="cartoon-border bg-[#e8f4e7] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-green">Kanab Quest</p>
            <h3 className="mt-1 font-display text-3xl text-ink">Pilotage du Placard</h3>
            <p className="mt-2 max-w-2xl text-sm text-charcoal">
              Collections, récompenses, saisons et contrôles de lancement sont centralisés ici.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-cartoon btn-secondary" type="button" disabled={loading} onClick={() => void load()}>
              <RefreshCcw size={14} /> {loading ? "Chargement…" : "Actualiser"}
            </button>
            <Link className="btn-cartoon btn-primary" href="/admin/placard">Tester le jeu</Link>
          </div>
        </div>
        {status ? <p className="mt-4 border-2 border-ink bg-white p-3 text-sm font-semibold" role="status">{status}</p> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="cartoon-border bg-cream p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Préflight de lancement</p>
          <h4 className="mt-1 font-display text-2xl">{readiness ? `${readiness.blockers.length} blocage(s)` : "Indisponible"}</h4>
          <p className="mt-2 text-sm">{readiness?.contentReady ? "Contenu complet" : "Contenu incomplet"} · {readiness?.safelyDormant ? "Tous les verrous sont fermés" : "Un verrou est déjà ouvert"}</p>
          <div className="mt-4 border-2 border-ink bg-[#fff0c9] p-3">
            <div className="flex items-center justify-between gap-3">
              <h5 className="font-display text-lg">Dossier commercial</h5>
              <b className="text-xs uppercase tracking-wider">
                {approvalChecks.filter((check) => check.ready).length}/{approvalChecks.length} validé(s)
              </b>
            </div>
            <p className="mt-1 text-xs text-charcoal">
              Calendrier, lots, territoire, probabilités et règlement disposent chacun de leur propre verrou.
            </p>
            <div className="mt-3 grid gap-2">
              {approvalChecks.map((check) => (
                <div className="grid gap-1 border-2 border-ink bg-white px-3 py-2 text-sm" key={check.code}>
                  <div className="flex items-center justify-between gap-3">
                    <span>{check.ready ? "✓" : "○"} {check.label}</span>
                    <b>{check.ready ? "Validé" : "À décider"}</b>
                  </div>
                  {check.detail ? <small className="text-charcoal">{check.detail}</small> : null}
                </div>
              ))}
            </div>
          </div>
          <h5 className="mt-4 font-display text-lg">Contrôles techniques</h5>
          <div className="mt-2 grid gap-2">
            {technicalChecks.map((check) => (
              <div className="flex items-center justify-between gap-3 border-2 border-ink bg-white px-3 py-2 text-sm" key={check.code}>
                <span>{check.ready ? "✓" : "○"} {check.label}</span>
                <b>{check.ready ? "Prêt" : "À traiter"}</b>
              </div>
            ))}
          </div>
          <details className="mt-4 border-2 border-ink bg-white p-3">
            <summary className="cursor-pointer font-bold">Séquence d’activation</summary>
            <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm">
              {readiness?.activationStillRequired.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </details>
        </article>

        <div className="grid gap-5">
          <article className="cartoon-border bg-[#fff0c9] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Collections</p>
            <h4 className="mt-1 font-display text-2xl">La Botte & Héritages</h4>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <b className="border-2 border-ink bg-white p-3">{supportCards.length}<small className="block font-normal">cartes La Botte</small></b>
              <b className="border-2 border-ink bg-white p-3">{supportCards.reduce((sum, card) => sum + Number(card.ownedCopies ?? 0), 0)}<small className="block font-normal">copies admin</small></b>
              <b className="border-2 border-ink bg-white p-3">{heritageCards.length}<small className="block font-normal">Héritages</small></b>
              <b className="border-2 border-ink bg-white p-3">{Number(heritage?.pendingPurchaseUnits ?? 0)}<small className="block font-normal">tirages admin en attente</small></b>
            </div>
            <p className="mt-3 text-sm">La Botte : {collection?.collectionActive ? "active" : "dormante"} · Héritages : {heritage?.collectionActive ? "actifs" : "dormants"}</p>
            {heritageRetroPreview ? (
              <p className="mt-4 border-2 border-ink bg-white p-3 text-sm">
                Lot simulé : {Number(heritageRetroPreview.processedItems ?? 0)} ligne(s) · {Number(heritageRetroPreview.pendingUnits ?? 0)} tirage(s) à créer · {Number(heritageRetroPreview.alreadyAwarded ?? 0)} déjà traité(s).
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-cartoon btn-secondary" type="button" disabled={heritageCursor === null || Boolean(action)} onClick={() => void runAction("heritage", "/api/admin/placard/heritage/retro", { cursor: heritageCursor }, false)}>
                {action === "heritage" ? "Analyse…" : heritageCursor === null ? "Analyse terminée" : "Simuler le lot"}
              </button>
              {heritageRetroPreview && Number(heritageRetroPreview.pendingUnits ?? 0) === 0 && heritageRetroPreview.nextCursor != null ? (
                <button className="btn-cartoon btn-secondary" type="button" disabled={Boolean(action)} onClick={() => advanceRetroPreview("heritage", heritageRetroPreview.nextCursor)}>
                  Analyser le lot suivant
                </button>
              ) : null}
              <button
                className="btn-cartoon btn-primary"
                type="button"
                disabled={
                  !heritage?.purchaseDrawsLive
                  || !heritageRetroPreview?.writeAllowed
                  || !heritageRetroPreview?.previewFingerprint
                  || Number(heritageRetroPreview?.pendingUnits ?? 0) <= 0
                  || heritageRetroPreview?.cursor !== heritageCursor
                  || Boolean(action)
                }
                onClick={() => void runAction("heritage", "/api/admin/placard/heritage/retro", {
                  cursor: heritageCursor,
                  previewFingerprint: heritageRetroPreview?.previewFingerprint,
                }, true)}
              >
                Exécuter ce lot
              </button>
              {heritageRetroEvidence ? (
                <button className="btn-cartoon btn-secondary" type="button" onClick={() => downloadKqRetroEvidence(heritageRetroEvidence)}>
                  <Download size={14} /> Preuve {heritageRetroEvidence.mode === "execute" ? "d’exécution" : "de simulation"}
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-charcoal">
              L’exécution exige la simulation du même curseur, les tirages actifs et le verrou serveur de recette.
            </p>
          </article>

          <article className="cartoon-border bg-[#eaf4df] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Carnet → Placard</p>
            <h4 className="mt-1 font-display text-2xl">Compte admin · {Number(notebook?.pendingBadges ?? 0)} badge(s) en attente</h4>
            <p className="mt-2 text-sm">{Number(notebook?.pendingSupportBoosters ?? 0)} booster(s) · {Number(notebook?.pendingCultureTokens ?? 0)} jeton(s) · {Number(notebook?.alreadyGranted ?? 0)} déjà traité(s)</p>
            {notebookRetroPreview ? (
              <p className="mt-4 border-2 border-ink bg-white p-3 text-sm">
                Lot simulé : {Number(notebookRetroPreview.processed ?? 0)} badge(s) · {Number(notebookRetroPreview.pending ?? 0)} attribution(s) à créer · {Number(notebookRetroPreview.alreadyGranted ?? 0)} déjà traitée(s).
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-cartoon btn-secondary" type="button" disabled={notebookCursor === null || Boolean(action)} onClick={() => void runAction("notebook", "/api/admin/placard/notebook-rewards", { cursor: notebookCursor }, false)}>
                {action === "notebook" ? "Analyse…" : notebookCursor === null ? "Analyse terminée" : "Simuler le lot"}
              </button>
              {notebookRetroPreview && Number(notebookRetroPreview.pending ?? 0) === 0 && notebookRetroPreview.nextCursor != null ? (
                <button className="btn-cartoon btn-secondary" type="button" disabled={Boolean(action)} onClick={() => advanceRetroPreview("notebook", notebookRetroPreview.nextCursor)}>
                  Analyser le lot suivant
                </button>
              ) : null}
              <button
                className="btn-cartoon btn-primary"
                type="button"
                disabled={
                  !notebook?.rewardsLive
                  || !notebookRetroPreview?.writeAllowed
                  || !notebookRetroPreview?.previewFingerprint
                  || Number(notebookRetroPreview?.pending ?? 0) <= 0
                  || notebookRetroPreview?.cursor !== notebookCursor
                  || Boolean(action)
                }
                onClick={() => void runAction("notebook", "/api/admin/placard/notebook-rewards", {
                  cursor: notebookCursor,
                  previewFingerprint: notebookRetroPreview?.previewFingerprint,
                }, true)}
              >
                Exécuter ce lot
              </button>
              {notebookRetroEvidence ? (
                <button className="btn-cartoon btn-secondary" type="button" onClick={() => downloadKqRetroEvidence(notebookRetroEvidence)}>
                  <Download size={14} /> Preuve {notebookRetroEvidence.mode === "execute" ? "d’exécution" : "de simulation"}
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-charcoal">
              L’exécution exige la simulation du même curseur, les règles actives et le verrou serveur de recette.
            </p>
          </article>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminBotteCatalogEditor />
        <AdminHeritageCatalogEditor />
        <AdminProducerRewardCampaigns />
        <article className="cartoon-border bg-[#e8f4e7] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Récompenses clients · Arène</p>
              <h4 className="mt-1 font-display text-2xl">Pot de la Canopée</h4>
            </div>
            <b className="border-2 border-ink bg-white px-3 py-1 text-xs uppercase tracking-wider">
              {customerRewards?.status === "active" ? "En cours" : customerRewards?.status === "frozen" ? "Gelé" : customerRewards?.status === "settled" ? "Attribué" : "Indisponible"}
            </b>
          </div>
          <p className="mt-3 font-display text-4xl text-green">
            {Number(customerRewards?.poolGrams ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g
          </p>
          <p className="mt-1 text-sm">
            Le dé collectif fixe chaque semaine la part des grammes réellement payés · hors cadeaux, annulations et commandes archivées.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <b className="border-2 border-ink bg-white p-3">{Number(customerRewards?.currentWeekGrams ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g<small className="block font-normal">cette semaine</small></b>
            <b className="border-2 border-ink bg-[#fff0ae] p-3">{Math.round(Number(customerRewards?.weeklyDice?.rateBps ?? 100) / 100)} %<small className="block font-normal">palier du dé · {customerRewards?.weeklyDice?.rollCount ?? 0} lancer(s)</small></b>
            <b className="border-2 border-ink bg-white p-3">{customerRewards?.eligiblePlayers ?? 0}<small className="block font-normal">joueurs éligibles</small></b>
            <b className="border-2 border-ink bg-white p-3">{Math.max(0, Number(customerRewards?.wholePoolGrams ?? 0) - Number(customerRewards?.surpriseReward.estimatedGrams ?? 0))} g<small className="block font-normal">Top 10</small></b>
            <b className="border-2 border-ink bg-white p-3">{customerRewards?.surpriseReward.estimatedGrams ?? 0} g<small className="block font-normal">Fleur Surprise</small></b>
          </div>
          {customerRewardPreview ? (
            <p className="mt-3 border-2 border-ink bg-[#fff0c9] p-3 text-sm">
              Simulation : {Number(customerRewardPreview.rankingWinners ?? 0)} gagnant(s) classés pour {Number(customerRewardPreview.rankingGrams ?? 0)} g · {Number(customerRewardPreview.surpriseCandidates ?? 0)} candidat(s) hors Top 10 pour {Number(customerRewardPreview.surpriseGrams ?? 0)} g.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-charcoal">
            Éligibilité : {customerRewards?.minimumHumanBattles ?? 3} duels officiels minimum. Une seule chance par client pour la Fleur Surprise.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-cartoon btn-secondary" type="button" disabled={!customerRewards || customerRewards.status === "settled" || Boolean(action)} onClick={() => void runCustomerRewardAction("preview")}>
              {action === "reward-preview" ? "Calcul…" : "Simuler l’attribution"}
            </button>
            <button className="btn-cartoon btn-secondary" type="button" disabled={customerRewards?.status !== "active" || Boolean(action)} onClick={() => void runCustomerRewardAction("freeze")}>
              {action === "reward-freeze" ? "Gel…" : "Geler le pot"}
            </button>
            <button className="btn-cartoon btn-primary" type="button" disabled={customerRewards?.status !== "frozen" || Boolean(action)} onClick={() => void runCustomerRewardAction("settle")}>
              {action === "reward-settle" ? "Attribution…" : "Attribuer les récompenses"}
            </button>
          </div>
        </article>
        <article className="cartoon-border bg-[#fff0c9] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Fin de saison</p>
          <h4 className="mt-1 font-display text-2xl">{Number(season?.eligiblePlayers ?? 0)} joueur(s) éligible(s)</h4>
          <p className="mt-2 text-sm">{Number(season?.pendingGrants ?? 0)} attribution(s) en attente · {Number(season?.totalSupportBoosters ?? 0)} booster(s) · {Number(season?.totalHeritageFragments ?? 0)} fragment(s)</p>
          <button className="btn-cartoon btn-secondary mt-4" type="button" disabled={!season?.rewardsLive || Number(season?.pendingGrants ?? 0) <= 0 || Boolean(action)} onClick={() => void runAction("season", "/api/admin/placard/season-rewards")}>
            {action === "season" ? "Distribution…" : "Distribuer les récompenses"}
          </button>
        </article>

        <article className="cartoon-border bg-cream p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Passage de saison</p>
          <h4 className="mt-1 font-display text-2xl">{rollover?.fromSeason ?? "—"} → {rollover?.toSeason ?? "à planifier"}</h4>
          <p className="mt-2 text-sm">{Number(rollover?.players ?? 0)} joueur(s) · {Number(rollover?.missingRewardGrants ?? 0)} récompense(s) manquante(s) · {Number(rollover?.lockedBattles ?? 0)} duel(s) verrouillé(s)</p>
          <p className="mt-3 border-2 border-ink bg-white p-3 text-sm">{rollover?.ready ? "Clôture techniquement prête." : (rollover?.blockers ?? []).join(" · ") || "Clôture non prête."}</p>
        </article>
      </div>

      <AdminPlacardLaunchDossierBuilder
        key={readiness ? "launch-dossier-loaded" : "launch-dossier-loading"}
        initialDossier={readiness?.launchDossier}
      />

      <AdminPlacardEconomyReview />

      <AdminPlacardArtworkReview />

      <AdminPlacardMobileReview />

      <AdminPlacardLaunchEvidence
        serverReadinessAvailable={Boolean(readiness)}
        serverReadyForActivation={readiness?.readyForActivation === true}
        serverBlockers={readiness?.blockers ?? []}
      />

      <article className={`cartoon-border p-6 ${randomBattleQueue?.status === "critical" ? "bg-[#f8d8cc]" : randomBattleQueue?.status === "watch" ? "bg-[#fff0c9]" : "bg-[#d9f3ef]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">File de duels aléatoires</p>
            <h4 className="mt-1 font-display text-2xl">Santé du matchmaking</h4>
          </div>
          <b className="border-2 border-ink bg-white px-3 py-2 text-xs uppercase">
            {!randomBattleQueue ? "Indisponible" : randomBattleQueue.status === "critical" ? "Alerte" : randomBattleQueue.status === "watch" ? "À surveiller" : "Fluide"}
          </b>
        </div>
        {randomBattleQueue ? <>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <b className="border-2 border-ink bg-white p-3">{randomBattleQueue.waitingCount}<small className="block font-normal">Fleur(s) en attente</small></b>
            <b className="border-2 border-ink bg-white p-3">{randomBattleQueue.oldestWaitMinutes} min<small className="block font-normal">attente la plus longue</small></b>
            <b className="border-2 border-ink bg-white p-3">{randomBattleQueue.waitingOver15Minutes}<small className="block font-normal">au-delà de 15 min</small></b>
            <b className="border-2 border-ink bg-white p-3">{randomBattleQueue.waitingOver60Minutes}<small className="block font-normal">au-delà de 60 min</small></b>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <span className="border border-ink bg-white px-3 py-2"><b>{randomBattleQueue.qualityBands.artisanale}</b> Récolte artisanale</span>
            <span className="border border-ink bg-white px-3 py-2"><b>{randomBattleQueue.qualityBands.bellePousse}</b> Belle pousse</span>
            <span className="border border-ink bg-white px-3 py-2"><b>{randomBattleQueue.qualityBands.concours}</b> Qualité concours</span>
            <span className="border border-ink bg-white px-3 py-2"><b>{randomBattleQueue.qualityBands.legendaire}</b> Fleur légendaire</span>
          </div>
          <p className="mt-3 text-xs">Vue strictement anonyme · aucun compte ni identifiant de Fleur n’est exposé.{randomBattleQueue.qualityBands.unknown > 0 ? ` ${randomBattleQueue.qualityBands.unknown} entrée(s) sans qualité exploitable.` : ""}{randomBattleQueue.truncated ? " Affichage limité aux 1 000 plus anciennes entrées." : ""}</p>
        </> : <p className="mt-4 border-2 border-ink bg-white p-3 text-sm">Les métriques de la file n’ont pas pu être chargées. Consulte l’avertissement de préflight avant l’ouverture.</p>}
      </article>

      <article className="cartoon-border bg-[#e8f4e7] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Entraînements bots · {botDashboard?.dayKey ?? "aujourd’hui"}</p>
        <h4 className="mt-1 font-display text-2xl">Suivi des duels automatiques</h4>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <b className="border-2 border-ink bg-white p-3">{botDashboard?.battlesToday ?? 0}<small className="block font-normal">duels aujourd’hui</small></b>
          <b className="border-2 border-ink bg-white p-3">{botDashboard?.activePlayersToday ?? 0}<small className="block font-normal">joueurs actifs</small></b>
          <b className="border-2 border-ink bg-white p-3">{botDashboard?.playersAtLimit ?? 0}<small className="block font-normal">à la limite 10/10</small></b>
          <b className="border-2 border-ink bg-white p-3">{Number(botDashboard?.experienceAwardedToday ?? 0).toLocaleString("fr-FR")}<small className="block font-normal">EXP bots aujourd’hui</small></b>
          <b className="border-2 border-ink bg-white p-3">{Number(botDashboard?.totalArenaExperience ?? 0).toLocaleString("fr-FR")}<small className="block font-normal">EXP Arène totale</small></b>
        </div>
        {(botDashboard?.players.length ?? 0) > 0 ? <details className="mt-4 border-2 border-ink bg-white p-3">
          <summary className="cursor-pointer font-bold">Consommation quotidienne par joueur</summary>
          <div className="mt-3 grid gap-2">{botDashboard?.players.map((player) => <div className="flex items-center justify-between gap-3 border border-ink px-3 py-2 text-sm" key={player.userId}><span>Joueur {player.userId.slice(0, 8)}</span><b className={player.atLimit ? "text-red-700" : ""}>{player.count}/{botDashboard.dailyLimit} · {player.remaining} restant(s)</b></div>)}</div>
        </details> : <p className="mt-4 border-2 border-ink bg-white p-3 text-sm">Aucun entraînement joué aujourd’hui.</p>}
        {(botDashboard?.recent.length ?? 0) > 0 ? <details className="mt-3 border-2 border-ink bg-white p-3">
          <summary className="cursor-pointer font-bold">20 derniers verdicts bots</summary>
          <div className="mt-3 grid gap-2">{botDashboard?.recent.map((battle) => <div className="grid gap-1 border border-ink px-3 py-2 text-sm md:grid-cols-[1fr_auto_auto]" key={battle.id}><span>Joueur {battle.userId.slice(0, 8)} · {battle.botCode.replace("bot-", "")}</span><b>{battle.winner === "player" ? "Victoire" : "Défaite"}</b><small>+{battle.experienceAwarded.toLocaleString("fr-FR")} EXP · {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(new Date(battle.verdictAt))}</small></div>)}</div>
        </details> : null}
      </article>
    </section>
  );
}
