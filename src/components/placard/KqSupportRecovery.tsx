"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { KQ_HAND_SIZE } from "@/lib/kanab-quest-game";
import { getKqSupportContinuity, getKqSupportContinuityInventory, parseKqSupportContinuityBoosters, parseKqSupportWelcomeReceipt } from "@/lib/kanab-quest-support-continuity";
import { KQ_MISSION_COPY, getKqMissionRewardLabel, type KqMissionDestination, type KqMissionTrack } from "@/lib/kanab-quest-missions";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqProgressMeter } from "./KqVisuals";
import { KqSupportPackOpening, requestKqSupportPackOpening, type KqOpenedSupportCard } from "./KqSupportPackOpening";
import styles from "./KqSupportRecovery.module.css";

const KqMissionCenter = dynamic(() => import("./KqMissionCenter").then(module => module.KqMissionCenter), {
  loading: () => <p role="status">Ouverture de tes missions…</p>,
});

/** This is a route to existing rewards. Looking at it never claims, buys or opens a pack. */
export function KqSupportRecovery({ inventory, onReturnToCards, onOpenDestination }: {
  inventory: Record<string, number> | null;
  onReturnToCards: () => void;
  onOpenDestination?: (destination: KqMissionDestination) => void;
}) {
  const api = useKqTutorialApi();
  const stock = getKqSupportContinuityInventory(inventory);
  const lowStock = stock.copies !== null && stock.copies < KQ_HAND_SIZE;
  const [boosters, setBoosters] = useState<unknown>(undefined);
  const [missions, setMissions] = useState<unknown>(undefined);
  const [revision, setRevision] = useState(0);
  const [operation, setOperation] = useState<"welcome" | "pack" | null>(null);
  const [notice, setNotice] = useState("");
  const [pack, setPack] = useState<{ id: string; cardCount: number } | null>(null);
  const [cards, setCards] = useState<KqOpenedSupportCard[]>([]);
  const [packError, setPackError] = useState("");
  const [missionTrack, setMissionTrack] = useState<KqMissionTrack | "all" | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const readEnabled = lowStock || pack !== null || missionTrack !== null;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!readEnabled) return;
    const controller = new AbortController();
    setBoosters(undefined); setMissions(undefined);
    const read = async (path: string, receive: (data: unknown) => void) => {
      try {
        const response = await api.request(path, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        const body: unknown = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) receive(body);
      } catch { if (!controller.signal.aborted) receive(null); }
    };
    void Promise.allSettled([
      read("/api/arena/placard/boosters", setBoosters),
      read("/api/arena/placard/missions", setMissions),
    ]);
    return () => controller.abort();
  }, [api, readEnabled, revision]);
  useEffect(() => {
    if (!lowStock) return;
    return api.subscribe(["kq:boosters-updated", "kq:collection-updated", "arena:progress-updated"], () => { if (!lock.current) refresh(); });
  }, [api, lowStock, refresh]);

  const continuity = getKqSupportContinuity({ inventory, boosters, missions });
  const action = continuity.action;
  const mission = action?.kind === "mission-goal" || action?.kind === "mission-reward" ? action.mission : null;
  const missionCopy = mission ? KQ_MISSION_COPY[mission.code] : null;
  const packSnapshot = parseKqSupportContinuityBoosters(boosters);
  const packStillAvailable = pack && packSnapshot?.collectionActive === true && packSnapshot.availableEntitlements.some(item => item.id === pack.id);
  const packStatusKnown = packSnapshot !== null;
  const openingError = !cards.length && packError && packStatusKnown && !packStillAvailable
    ? "Ce pack n’est plus disponible à l’ouverture. Retrouve l’état de tes cartes dans la préparation."
    : packError;

  async function openPack(target: { id: string; cardCount: number }) {
    if (lock.current) return;
    lock.current = true; setOperation("pack"); setPack(target); setPackError(""); setCards([]);
    try {
      const received = await requestKqSupportPackOpening(api.request, target.id);
      if (mounted.current) setCards(received);
    } catch (failure) {
      if (mounted.current) setPackError(failure instanceof Error ? failure.message : "Ouverture à confirmer. Vérifie son statut avant de réessayer.");
    } finally {
      // An interrupted response may follow a completed draw. Reconcile actual
      // ownership even on failure; the opening RPC does not replay spent packs.
      api.notify("kq:collection-updated");
      api.notify("kq:boosters-updated");
      lock.current = false;
      if (mounted.current) { setOperation(null); setBoosters(undefined); refresh(); }
    }
  }

  async function claimWelcome() {
    if (lock.current) return;
    lock.current = true; setOperation("welcome"); setNotice("");
    try {
      const response = await api.request("/api/arena/placard/boosters", { method: "PUT", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("Ton pack de bienvenue n’a pas pu être confirmé. Réessaie : il ne sera attribué qu’une fois.");
      const receipt = parseKqSupportWelcomeReceipt(await response.json().catch(() => null));
      if (!receipt) throw new Error("Attribution à confirmer. Vérifie les récompenses disponibles après actualisation.");
      if (mounted.current) setNotice(receipt.status === "opened" ? "Ton pack de bienvenue a déjà été ouvert. Vérifie tes cartes dans la préparation."
        : receipt.replayed ? "Ton pack de bienvenue était déjà récupéré. Retrouve-le ci-dessous pour l’ouvrir."
          : "Pack de bienvenue récupéré. Retrouve-le ci-dessous pour l’ouvrir.");
    } catch (failure) {
      if (mounted.current) setNotice(failure instanceof Error ? failure.message : "Attribution à confirmer. Actualise tes récompenses.");
    } finally {
      api.notify("kq:boosters-updated");
      api.notify("kq:collection-updated");
      lock.current = false;
      if (mounted.current) { setOperation(null); setBoosters(undefined); refresh(); }
    }
  }

  function returnToCards() {
    if (lock.current) return;
    setPack(null); setCards([]); setMissionTrack(null); refresh();
    requestAnimationFrame(onReturnToCards);
  }
  function followMission(destination: KqMissionDestination) {
    setMissionTrack(null); refresh();
    if (destination === "game" || !onOpenDestination) requestAnimationFrame(onReturnToCards);
    else onOpenDestination(destination);
  }

  // A refresh that fills the album must not dismiss an open pack or its receipt.
  if (!lowStock && !pack && missionTrack === null) return null;
  const title = action?.kind === "pack" ? `${action.availablePacks} pack${action.availablePacks > 1 ? "s" : ""} déjà disponible${action.availablePacks > 1 ? "s" : ""}`
    : action?.kind === "welcome" ? "Ton pack de bienvenue t’attend"
      : missionCopy ? missionCopy.title : continuity.status === "closed" ? "Récompenses momentanément fermées"
        : continuity.status === "pending" ? "Recherche de tes récompenses…"
          : continuity.status === "unavailable" ? "Récompenses à vérifier" : "Des soutiens pour la suite";

  return <>
    {lowStock ? <aside className={styles.recovery} data-support-recovery data-support-recovery-status={continuity.status} aria-label="Retrouver des cartes de soutien">
      <Image className={styles.art} src="/placard/shop-item-packs-v2.webp" alt="" width={64} height={64} sizes="64px" />
      <div className={styles.content}>
        <small className={styles.stock} data-support-stock>{stock.copies} copie{stock.copies === 1 ? "" : "s"} de soutien en stock · {stock.varieties} référence{stock.varieties === 1 ? "" : "s"}</small>
        <h3>{title}</h3>
        {action?.kind === "pack" ? <p>Le prochain contient {action.cardCount} carte{action.cardCount > 1 ? "s" : ""}. Aucun achat nécessaire.</p>
          : action?.kind === "welcome" ? <p>Récupère ton pack offert, puis découvre ses cartes ici.</p>
            : mission && missionCopy ? <><p>{action?.kind === "mission-reward" ? "Objectif atteint · " : "À gagner · "}{getKqMissionRewardLabel(mission.reward)}</p>
              {action?.kind === "mission-goal" ? <KqProgressMeter label={missionCopy.progressLabel} value={mission.progress} max={mission.target} valueLabel={`${mission.progress.toLocaleString("fr-FR")} / ${mission.target.toLocaleString("fr-FR")}`} /> : null}</>
              : continuity.status === "unavailable" ? <p>Impossible de confirmer les packs et objectifs disponibles.</p>
                : continuity.status === "ready" ? <p>Aucun pack à ouvrir ni récompense de cartes à récupérer pour le moment. Consulte les autres objectifs à ton rythme.</p>
                  : continuity.status === "closed" ? <p>Tes droits restent enregistrés. Tu peux poursuivre ta culture.</p> : null}
        <div className={styles.actions}>
          {action?.kind === "pack" ? <button type="button" data-support-recovery-action="pack" disabled={operation !== null} onClick={() => void openPack({ id: action.entitlementId, cardCount: action.cardCount })}>Ouvrir mon pack<ArrowRight size={16} aria-hidden="true" /></button>
            : action?.kind === "welcome" ? <button type="button" data-support-recovery-action="welcome" disabled={operation !== null} onClick={() => void claimWelcome()}>{operation === "welcome" ? "Récupération…" : "Récupérer mon pack offert"}<ArrowRight size={16} aria-hidden="true" /></button>
              : continuity.status === "ready" ? <button type="button" data-support-recovery-action="missions" onClick={() => setMissionTrack(mission?.track ?? "all")}>{action?.kind === "mission-reward" ? "Récupérer ma récompense" : action?.kind === "mission-goal" ? "Voir cet objectif" : "Voir mes missions"}<ArrowRight size={16} aria-hidden="true" /></button>
                : continuity.status === "unavailable" || continuity.status === "closed" ? <button type="button" data-support-recovery-retry onClick={refresh}><RefreshCw size={15} aria-hidden="true" />Actualiser</button> : null}
        </div>
        {continuity.status === "ready" && !action ? <details className={styles.sources}><summary>Gagner des cartes avec les duels</summary><p>Une victoire d’entraînement rapporte 1 carte Botte. Chaque duel consomme ta Fleur, même en cas de défaite ; tu peux jouer jusqu’à 10 entraînements par jour.</p><p>Après une récolte, retrouve l’entraînement dans Jury & duels.</p></details> : null}
        {notice ? <p role="status">{notice}</p> : null}
        <p className={styles.optional}>Tu peux aussi cultiver sans soutien. Les nouvelles cartes ne sont pas ajoutées automatiquement à ta sélection.</p>
      </div>
    </aside> : null}
    {pack ? <KqSupportPackOpening cards={cards} cardCount={pack.cardCount} busy={operation === "pack" || boosters === undefined && cards.length === 0 && Boolean(packError)} error={openingError}
      busyLabel={operation === "pack" ? "Ouverture de ton pack…" : "Vérification du statut de ce pack…"}
      canRetry={operation === null && cards.length === 0 && (!packStatusKnown || Boolean(packStillAvailable))}
      onRetry={() => { if (packStillAvailable) void openPack(pack); else { setBoosters(undefined); refresh(); } }} retryLabel={packStillAvailable ? "Réessayer l’ouverture" : "Actualiser le statut"}
      onClose={returnToCards} onContinue={returnToCards} continueLabel="Revenir à mes cartes" returnLabel="Revenir à mes cartes" /> : null}
    <AppDialog open={missionTrack !== null} onClose={returnToCards} title="Mes récompenses de culture" closeLabel="Revenir à mes cartes" className={styles.dialog} dialogProps={{ "data-support-missions": true }}>
      {missionTrack !== null ? <KqMissionCenter initialTrack={missionTrack} focusInitialTrack={missionTrack !== "all"} onOpen={followMission} /> : null}
    </AppDialog>
  </>;
}
