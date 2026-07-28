"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Readiness = {
  contentReady: boolean;
  safelyDormant: boolean;
  readyForActivation: boolean;
  blockers: string[];
  checks: Array<{ code: string; label: string; ready: boolean }>;
  activationStillRequired: string[];
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
};
type BotDashboard = {
  dayKey: string; dailyLimit: number; battlesToday: number; activePlayersToday: number;
  playersAtLimit: number; experienceAwardedToday: number; totalArenaExperience: number;
  players: Array<{ userId: string; count: number; remaining: number; atLimit: boolean }>;
  recent: Array<{ id: string; userId: string; botCode: string; winner: string; experienceAwarded: number; verdictAt: string }>;
};

async function readJson(response: Response) {
  return await response.json() as Bootstrap & {
    error?: string;
    nextCursor?: number | null;
    granted?: number;
    alreadyGranted?: number;
    awarded?: number;
    alreadyAwarded?: number;
  };
}

export function AdminPlacardOperationsPanel() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [botDashboard, setBotDashboard] = useState<BotDashboard | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"" | "notebook" | "heritage" | "season">("");
  const [notebookCursor, setNotebookCursor] = useState<number | null>(0);
  const [heritageCursor, setHeritageCursor] = useState<number | null>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const [response, botResponse] = await Promise.all([
        fetch("/api/admin/placard/bootstrap", { cache: "no-store" }),
        fetch("/api/admin/placard/bot-battles", { cache: "no-store" }),
      ]);
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Pilotage Placard indisponible.");
      setData(payload);
      if (botResponse.ok) setBotDashboard(await botResponse.json() as BotDashboard);
      else setBotDashboard(null);
      const warnings = [...(payload.warnings ?? [])];
      if (!botResponse.ok) warnings.push("Suivi des entraînements indisponible.");
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
  ) => {
    if (action) return;
    const labels = {
      notebook: "la rétro-attribution du Carnet",
      heritage: "les tirages Héritage rétroactifs",
      season: "la distribution des récompenses de saison",
    };
    if (!window.confirm(`Confirmer ${labels[kind]} ? Cette opération écrit dans Supabase.`)) return;
    setAction(kind);
    setStatus("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "Opération impossible.");
      if (kind === "notebook") setNotebookCursor(payload.nextCursor ?? null);
      if (kind === "heritage") setHeritageCursor(payload.nextCursor ?? null);
      setStatus(`Opération terminée · ${Number(payload.granted ?? payload.awarded ?? 0)} nouvelle(s) attribution(s) · ${Number(payload.alreadyGranted ?? payload.alreadyAwarded ?? 0)} déjà traitée(s).`);
      await load();
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
  const supportCards = collection?.cards ?? [];
  const heritageCards = heritage?.cards ?? [];

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
          <div className="mt-4 grid gap-2">
            {readiness?.checks.map((check) => (
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
              <b className="border-2 border-ink bg-white p-3">{Number(heritage?.pendingPurchaseUnits ?? 0)}<small className="block font-normal">tirages en attente</small></b>
            </div>
            <p className="mt-3 text-sm">La Botte : {collection?.collectionActive ? "active" : "dormante"} · Héritages : {heritage?.collectionActive ? "actifs" : "dormants"}</p>
            <button className="btn-cartoon btn-secondary mt-4" type="button" disabled={!heritage?.purchaseDrawsLive || heritageCursor === null || Boolean(action)} onClick={() => void runAction("heritage", "/api/admin/placard/heritage/retro", { cursor: heritageCursor })}>
              {action === "heritage" ? "Traitement…" : heritageCursor === null ? "Rétro-attribution terminée" : "Traiter les tirages Héritage"}
            </button>
          </article>

          <article className="cartoon-border bg-[#eaf4df] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-green">Carnet → Placard</p>
            <h4 className="mt-1 font-display text-2xl">{Number(notebook?.pendingBadges ?? 0)} badge(s) en attente</h4>
            <p className="mt-2 text-sm">{Number(notebook?.pendingSupportBoosters ?? 0)} booster(s) · {Number(notebook?.pendingCultureTokens ?? 0)} jeton(s) · {Number(notebook?.alreadyGranted ?? 0)} déjà traité(s)</p>
            <button className="btn-cartoon btn-secondary mt-4" type="button" disabled={!notebook?.rewardsLive || notebookCursor === null || Boolean(action)} onClick={() => void runAction("notebook", "/api/admin/placard/notebook-rewards", { cursor: notebookCursor })}>
              {action === "notebook" ? "Traitement…" : notebookCursor === null ? "Rétro-attribution terminée" : "Traiter les récompenses Carnet"}
            </button>
          </article>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
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
