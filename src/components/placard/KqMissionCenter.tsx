"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Coins, FlaskConical, Gift, LockKeyhole, RefreshCw, Sparkles, Trophy, Users } from "lucide-react";
import { KQ_MISSION_COPY, KQ_MISSION_DIFFICULTIES, KQ_MISSION_TRACKS, getKqMissionContinuation, getKqMissionRewardLabel, type KqMission, type KqMissionClaim, type KqMissionCode, type KqMissionDestination, type KqMissionReward, type KqMissionSnapshot, type KqMissionTrack } from "@/lib/kanab-quest-missions";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { CommunityMissionWelcome, CommunityMissionsBoard } from "@/components/missions/CommunityMissionsBoard";
import styles from "./KqMissionCenter.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqSupportPackOpening, requestKqSupportPackOpening, type KqOpenedSupportCard } from "./KqSupportPackOpening";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import { KqCultureContract } from "./KqCultureContract";
import { useKqGameSound } from "./KqGameSound";
import { KqChapterHeading } from "./KqChapterHeading";
import { KqMissionFocusNotice, KqMissionPinButton } from "./KqPinnedMission";
import { getKqMissionOverview, isKqMissionRewardUnavailable as isRewardUnavailable } from "@/lib/kanab-quest-mission-overview";

const TRACKS = {
  culture: { title: "Culture & Buddies", image: "/contest/mascot/arena-scene-placard-v1.png" },
  quality: { title: "Qualité & savoir-faire", image: "/placard/map/culture-barn-sylvain-v1.webp" },
  preparation: { title: "Entrepôt & atelier", image: "/placard/market-workshop-sylvain-v2.webp" },
  online: { title: "Vente en ligne", image: "/placard/channel-online-sylvain-v2.webp" },
  shops: { title: "Boutiques partenaires", image: "/placard/channel-cbd-shop-sylvain-v2.webp" },
};
const PACK_IMAGE = "/placard/shop-item-packs-v2.webp";
type MissionReceipt = KqMissionClaim & { code: KqMission["code"] };
type MissionPack = { entitlementId: string; cardCount: number; code: KqMission["code"] };

// Older already-earned packs retain their original reward when the catalog evolves.
function missionReward(mission: { reward?: KqMissionReward; cardCount: number }): KqMissionReward {
  return mission.reward ?? { kind: "pack", cardCount: mission.cardCount };
}

function RewardArtwork({ reward, large = false }: { reward: KqMissionReward; large?: boolean }) {
  if (reward.kind === "cash") return <span className={styles.rewardIcon}><Coins size={large ? 34 : 28} aria-hidden="true" /></span>;
  const artwork = reward.kind === "card" ? getKqCardArtwork(reward.code) : PACK_IMAGE;
  return artwork ? <Image src={artwork} alt="" width={large ? 64 : 52} height={reward.kind === "card" ? (large ? 96 : 78) : (large ? 64 : 52)} /> : <span className={styles.rewardIcon}><Sparkles size={28} aria-hidden="true" /></span>;
}

export function KqMissionCenter({ onOpen, initialTrack = "all", focusInitialTrack = false }: { onOpen: (view: KqMissionDestination, missionCode?: KqMissionCode) => void; initialTrack?: KqMissionTrack | "all"; focusInitialTrack?: boolean }) {
  const api = useKqTutorialApi();
  const sound = useKqGameSound();
  const [section, setSection] = useState<"community" | "challenges" | "contracts">("challenges");
  const [selectedTrack, setSelectedTrack] = useState<KqMissionTrack | "all" | "ready">(initialTrack);
  const [data, setData] = useState<KqMissionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [reward, setReward] = useState<MissionReceipt | null>(null);
  const [activePack, setActivePack] = useState<MissionPack | null>(null);
  const [packCards, setPackCards] = useState<KqOpenedSupportCard[]>([]);
  const [packError, setPackError] = useState("");
  const [opening, setOpening] = useState(false);
  const [openedEntitlements, setOpenedEntitlements] = useState<string[]>([]);
  const openingLock = useRef(false);
  const claiming = useRef(false);
  const mounted = useRef(false);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const trackFilter = useRef<HTMLSelectElement>(null);
  const entryHeading = useRef<HTMLHeadingElement>(null);
  const entryFocused = useRef(false);
  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const response = await api.request("/api/arena/placard/missions", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const payload = await response.json();
      if (version !== requestVersion.current) return;
      setSignedOut(response.status === 401);
      if (!response.ok) throw new Error(payload.error || "Impossible de charger tes missions.");
      setData(payload); setError("");
    } catch (failure) {
      if (version === requestVersion.current) setError(failure instanceof Error ? failure.message : "Connexion interrompue. Réessaie.");
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const update = () => { if (!claiming.current && !openingLock.current) void refresh(); };
    const unsubscribe = api.subscribe(["focus", "kq:market-updated", "kq:boosters-updated", "kq:storage-updated", "arena:progress-updated"], update);
    return () => {
      mounted.current = false;
      invalidateRequests();
      unsubscribe();
    };
  }, [refresh, invalidateRequests, api]);

  useEffect(() => {
    if (reward) receiptHeading.current?.focus();
  }, [reward]);

  useEffect(() => {
    if (!focusInitialTrack || entryFocused.current || loading || !data || !entryHeading.current) return;
    entryFocused.current = true;
    entryHeading.current.focus({ preventScroll: true });
    entryHeading.current.scrollIntoView({ block: "start", behavior: "instant" });
  }, [data, focusInitialTrack, loading]);

  async function claim(mission: KqMission) {
    if (claiming.current || openingLock.current || loading || error || !mission.unlocked || !mission.claimable || isRewardUnavailable(mission, data?.collectionActive === true)) return;
    claiming.current = true; setBusy(mission.code); setError(""); setReward(null);
    try {
      const response = await api.request("/api/arena/placard/missions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: mission.code }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de récupérer cette récompense.");
      const receivedReward = missionReward(payload);
      api.notify("kq:missions-updated");
      if (receivedReward.kind === "cash") {
        api.notify("kq:equipment-updated");
        api.notify("kq:treasury-updated");
      } else if (receivedReward.kind === "card") api.notify("kq:collection-updated");
      else api.notify("kq:boosters-updated");
      // A successful claim still refreshes the parent collection if its dialog
      // was closed while the server confirmed the reward.
      if (!mounted.current) return;
      setReward({ ...payload, reward: receivedReward, code: mission.code });
      if (payload.replayed === false) sound.playOnce("reward", `mission:${mission.code}`);
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Connexion interrompue. Tu peux réessayer sans perdre ta récompense.");
    } finally { claiming.current = false; setBusy(null); }
  }

  async function openPack(pack: MissionPack) {
    if (openingLock.current || openedEntitlements.includes(pack.entitlementId)) return;
    openingLock.current = true;
    setActivePack(pack); setOpening(true); setPackCards([]); setPackError("");
    try {
      const cards = await requestKqSupportPackOpening(api.request, pack.entitlementId);
      setPackCards(cards);
      setOpenedEntitlements(current => [...current, pack.entitlementId]);
      setData(current => current ? { ...current, missions: current.missions.map(mission => mission.entitlementId === pack.entitlementId ? { ...mission, packAvailable: false } : mission) } : current);
    } catch (failure) {
      setPackError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Connexion interrompue. Actualise tes missions avant de réessayer.");
    } finally {
      // Reconcile after an ambiguous response too: the server may have opened
      // the pack even if its response did not reach this browser.
      await refresh();
      api.notify("kq:collection-updated");
      api.notify("kq:boosters-updated");
      openingLock.current = false; setOpening(false);
    }
  }

  const packIsOpened = (entitlementId: string) => openedEntitlements.includes(entitlementId) || data?.missions.some(mission => mission.entitlementId === entitlementId && mission.packAvailable === false) === true;
  const returnFromPack = (pack: MissionPack) => {
    setActivePack(null);
    // Existing packs need the same next-objective receipt as newly won packs.
    // Closing the reveal never claims another reward or skips its explanation.
    setReward(current => current?.code === pack.code ? current : {
      ...pack, reward: { kind: "pack", cardCount: pack.cardCount }, replayed: true,
    });
    requestAnimationFrame(() => receiptHeading.current?.focus());
  };

  const chooseAnotherTrack = () => {
    setSelectedTrack("all");
    setReward(null);
    requestAnimationFrame(() => trackFilter.current?.focus());
  };

  const overview = data ? getKqMissionOverview(data) : null;
  const claimed = overview?.claimed ?? 0;
  const ready = overview?.ready ?? 0;
  const unavailable = overview?.unavailable ?? 0;
  const total = overview?.total ?? 0;
  const visibleTracks = overview?.tracks.filter(item => selectedTrack === "all" || (selectedTrack === "ready" ? item.state === "ready" : item.track === selectedTrack)) ?? [];
  const availableMissions = data?.missions.filter((mission) => mission.packAvailable && mission.entitlementId && !openedEntitlements.includes(mission.entitlementId)) ?? [];
  const availablePacks = availableMissions.length;
  const nextPack = availableMissions[0];
  const receivedReward = reward ? missionReward(reward) : null;
  const rewardOpened = reward?.entitlementId ? packIsOpened(reward.entitlementId) : false;
  const receiptPack = receivedReward?.kind === "pack" && reward?.entitlementId ? { entitlementId: reward.entitlementId, cardCount: reward.cardCount, code: reward.code } : null;
  const continuation = reward && !loading && !error ? getKqMissionContinuation(data, reward.code) : { status: "pending" as const };
  const nextMission = continuation.status === "next" ? continuation.mission : null;
  const nextCopy = nextMission ? KQ_MISSION_COPY[nextMission.code] : null;
  const nextRewardUnavailable = nextMission ? isRewardUnavailable(nextMission, data?.collectionActive === true) : false;
  const rewardTitle = reward && receivedReward ? receivedReward.kind === "cash"
    ? `${getKqMissionRewardLabel(receivedReward)} ${reward.replayed ? "déjà crédités" : "crédités"} !`
    : receivedReward.kind === "card"
      ? `${receivedReward.name} ${reward.replayed ? "a déjà été reçue" : "rejoint ta collection"} !`
      : rewardOpened ? "Ton pack est ouvert." : reward.replayed ? "Ton pack est déjà récupéré." : `Bravo ! Un pack de ${reward.cardCount} cartes gagné.`
    : "";

  return <main className={styles.center}>
    <KqChapterHeading art="missions" title="Mes objectifs" level={1} compact />
    <nav className={styles.sections} aria-label="Parcours des missions"><button type="button" aria-pressed={section === "challenges"} onClick={() => setSection("challenges")}><Trophy size={18} aria-hidden="true" />Mes défis{availablePacks > 0 ? <span>{availablePacks} pack{availablePacks > 1 ? "s" : ""}</span> : null}</button>{!api.isTutorial ? <button type="button" aria-pressed={section === "contracts"} onClick={() => setSection("contracts")}><FlaskConical size={18} aria-hidden="true" />Contrats</button> : null}<button type="button" aria-pressed={section === "community"} onClick={() => setSection("community")}><Users size={18} aria-hidden="true" />Communauté</button></nav>
    {section === "community" ? <><CommunityMissionWelcome /><CommunityMissionsBoard /></> : section === "contracts" ? <KqCultureContract mode="missions" onOpenGame={() => onOpen("game")} /> : <>
    {overview ? <p className={styles.summary} data-mission-summary>{claimed} / {total} étapes accomplies{ready > 0 ? <> · <strong>{ready} récompense{ready > 1 ? "s" : ""} prête{ready > 1 ? "s" : ""}</strong></> : null}{unavailable > 0 ? <> · {unavailable} récompense{unavailable > 1 ? "s" : ""} temporairement indisponible{unavailable > 1 ? "s" : ""}</> : null}{error ? " · Dernier état connu" : null}</p> : null}
    <div className={styles.toolbar}>
      <label className={styles.trackFilter}><select ref={trackFilter} aria-label="Filtrer les parcours" value={selectedTrack} disabled={!data} onChange={event => setSelectedTrack(event.target.value as typeof selectedTrack)}>
        <option value="all">Tous les parcours</option>
        <option value="ready">Récompenses prêtes{overview ? ` (${ready})` : ""}</option>
        {KQ_MISSION_TRACKS.map(track => <option key={track} value={track}>{TRACKS[track].title}</option>)}
      </select><ChevronDown size={18} aria-hidden="true" /></label>
      <button type="button" aria-label={loading ? "Actualisation des objectifs" : "Actualiser les objectifs"} disabled={loading || busy !== null || opening} onClick={() => void refresh()}><RefreshCw size={18} aria-hidden="true" /></button>
    </div>
    <KqMissionFocusNotice />
    {error ? <div className={styles.error} role="alert"><p>{error}</p>{signedOut ? <Link href="/compte/connexion?next=%2Farene%2Fplacard%3Fview%3Dmissions">Me connecter</Link> : <button type="button" disabled={loading || busy !== null} onClick={() => void refresh()}>Réessayer</button>}</div> : null}
    {nextPack?.entitlementId && !(receiptPack && !rewardOpened) ? <div className={styles.packs} data-mission-packs><p>Déjà gagné{availablePacks > 1 ? "s" : ""} · à ouvrir</p><button type="button" disabled={opening || busy !== null || loading || !!error} onClick={() => void openPack({ entitlementId: nextPack.entitlementId!, cardCount: nextPack.cardCount, code: nextPack.code })}><Gift size={19} aria-hidden="true" />{availablePacks} pack{availablePacks > 1 ? "s" : ""} de mission à ouvrir<ArrowRight size={18} aria-hidden="true" /></button></div> : null}
    {reward && receivedReward ? <section className={styles.receipt} aria-label="Ta récompense et la suite" data-mission-receipt data-receipt-fresh={reward.replayed === false || undefined}>
      <div className={styles.receiptHeader}>
        <RewardArtwork reward={receivedReward} large />
        <div role="status"><span className={styles.receiptEyebrow}>{reward.replayed ? "Reçu retrouvé" : "Mission accomplie"}</span><h2 ref={receiptHeading} tabIndex={-1}>{rewardTitle}</h2><p>{receivedReward.kind === "cash" ? "Ta trésorerie du jeu est à jour." : receivedReward.kind === "card" ? "Ta carte rare Botte du Chanvrier est prête à être utilisée." : rewardOpened ? "Tes cartes ont rejoint ta collection." : "Découvre tes cartes ici, puis retrouve ton prochain objectif."}</p></div>
      </div>
      {receiptPack && !rewardOpened ? <button type="button" disabled={opening || busy !== null} onClick={() => void openPack(receiptPack)}>Ouvrir mon pack<ArrowRight size={18} aria-hidden="true" /></button> : <div className={styles.continuation} data-mission-continuation>
        {nextMission && nextCopy ? <>
          <div className={styles.continuationHeading}><small>Ton prochain objectif · {TRACKS[nextMission.track].title}</small><h3>{nextCopy.title}</h3><p>{nextCopy.description}</p></div>
          <KqProgressMeter label={nextCopy.progressLabel} value={nextMission.progress} max={nextMission.target}
            valueLabel={`${nextMission.progress.toLocaleString("fr-FR")} / ${nextMission.target.toLocaleString("fr-FR")}`}
            tone={nextMission.claimable ? "gold" : "teal"} />
          <p className={styles.continuationReward}><Gift size={17} aria-hidden="true" /><span>{nextMission.claimable ? "Objectif atteint · " : "À gagner · "}<strong>{getKqMissionRewardLabel(missionReward(nextMission))}</strong></span></p>
          {nextMission.claimable ? <button type="button" disabled={nextRewardUnavailable || busy !== null || opening || loading || !!error} onClick={() => void claim(nextMission)}>Récupérer cette récompense<ArrowRight size={18} aria-hidden="true" /></button>
            : <button type="button" disabled={busy !== null || opening} onClick={() => onOpen(nextCopy.destination, nextMission.code)}>{nextCopy.action}<ArrowRight size={18} aria-hidden="true" /></button>}
          <KqMissionPinButton mission={nextMission} disabled={busy !== null || opening || loading || !!error} />
          {nextMission.claimable && nextRewardUnavailable ? <p className={styles.unavailable}>Récompense temporairement indisponible. Ton objectif reste enregistré.</p> : null}
        </> : continuation.status === "complete" ? <>
          <h3>{TRACKS[continuation.track].title} : parcours terminé !</h3><p>Tu as récupéré toutes les récompenses de ce parcours. Les autres objectifs t’attendent, à ton rythme.</p>
          <button type="button" onClick={chooseAnotherTrack}>Choisir un autre parcours<ArrowRight size={18} aria-hidden="true" /></button>
        </> : <><p role="status">{loading ? "Actualisation de ton prochain objectif…" : "Ta récompense est acquise. Actualise pour retrouver la suite de ton parcours."}</p>
          <button type="button" disabled={loading || busy !== null || opening} onClick={() => void refresh()}><RefreshCw size={17} aria-hidden="true" />Actualiser mes objectifs</button></>}
      </div>}
    </section> : null}
    {loading && !data ? <p role="status" className={styles.loading}>On retrouve ta progression…</p> : null}
    {data ? <>
      {!data.collectionActive ? <p className={styles.error}>Les cartes et packs Botte du Chanvrier sont momentanément indisponibles. Tu peux toujours récupérer l’argent du jeu ; toute ta progression est conservée.</p> : null}
      {total === 0 ? <p className={styles.empty} data-mission-empty>Aucun défi n’est disponible dans les données reçues. Tu peux actualiser tes objectifs.</p> : visibleTracks.length === 0 ? <div className={styles.empty} data-mission-empty-filter><p>{selectedTrack === "ready" ? "Aucune récompense prête à récupérer dans le dernier état reçu." : "Aucun défi disponible dans ce parcours."}</p><button type="button" onClick={chooseAnotherTrack}>Voir tous les parcours</button></div> : null}
      <div className={styles.tracks}>
        {visibleTracks.map(({ track, missions, current, state }) => {
          const info = TRACKS[track];
          const copy = current ? KQ_MISSION_COPY[current.code] : null;
          const currentReward = current ? missionReward(current) : null;
          const rewardUnavailable = current ? isRewardUnavailable(current, data.collectionActive) : false;
          return <section key={track} className={styles.track} aria-label={info.title} data-mission-track={track} data-ready={state === "ready" || undefined}>
            <div className={styles.trackHeading}><Image src={info.image} alt="" width={72} height={60} sizes="72px" /><span>{info.title}</span></div>
            <div className={styles.body}>
              {current && copy && currentReward ? <>
                <div className={styles.stepHeading}><span className={styles.eyebrow}>Étape {current.step} / {missions.length}</span><span className={styles.difficulty} data-level={copy.difficulty}>{KQ_MISSION_DIFFICULTIES[copy.difficulty]}</span></div>
                <h2 ref={track === initialTrack ? entryHeading : undefined} tabIndex={-1}>{copy.title}</h2><p className={styles.description}>{copy.description}</p>
                {state === "locked" ? <p className={styles.unavailable}>Étape verrouillée. Récupère la récompense précédente pour la débloquer.</p> : current.claimable ? <span className={styles.reached}><Check size={16} aria-hidden="true" />{rewardUnavailable ? "Objectif atteint · récompense indisponible" : "Récompense prête à récupérer"}</span> : null}
                <div className={styles.missionMeter}><KqProgressMeter label={copy.progressLabel} value={current.progress} max={current.target}
                  valueLabel={`${current.progress.toLocaleString("fr-FR")} / ${current.target.toLocaleString("fr-FR")}`}
                  tone={current.claimable ? "gold" : "teal"} /></div>
                <div className={styles.reward} data-kind={currentReward.kind}><RewardArtwork reward={currentReward} /><span><small>{current.claimable ? "Récompense" : "À gagner"}</small><strong>{getKqMissionRewardLabel(currentReward)}</strong></span></div>
                {state === "locked" ? null : current.claimable ? <button type="button" data-mission-claim={current.code} className={styles.claim} disabled={rewardUnavailable || busy !== null || loading || opening || !!error} onClick={() => void claim(current)}><Gift size={18} aria-hidden="true" />{busy === current.code ? "Récupération…" : currentReward.kind === "pack" ? "Récupérer mon pack" : currentReward.kind === "card" ? "Récupérer ma carte" : "Récupérer ma récompense"}</button>
                  : <button type="button" className={styles.action} disabled={busy !== null || opening} onClick={() => onOpen(copy.destination, current.code)}>{copy.action}<ArrowRight size={18} aria-hidden="true" /></button>}
                <KqMissionPinButton mission={current} disabled={busy !== null || opening || loading || !!error} />
                {current.claimable && rewardUnavailable ? <p className={styles.unavailable}>Récompense temporairement indisponible. Ton objectif reste enregistré.</p> : null}
              </> : <div className={styles.complete}><Trophy size={38} aria-hidden="true" /><h2 ref={track === initialTrack ? entryHeading : undefined} tabIndex={-1}>Parcours terminé !</h2><p>Tu as remporté toutes les récompenses de ce parcours.</p></div>}
              <details className={styles.journey}><summary>Étapes et récompenses · {missions.filter(mission => mission.claimed).length}/{missions.length}<ChevronDown size={18} aria-hidden="true" /></summary><ol>{missions.map(mission => {
                const missionCopy = KQ_MISSION_COPY[mission.code];
                return <li key={mission.code} aria-current={mission.code === current?.code ? "step" : undefined} data-complete={mission.claimed || undefined}>
                  {mission.claimed ? <Check size={16} aria-label="Accomplie" /> : mission.unlocked ? <span>{mission.step}</span> : <LockKeyhole size={16} aria-label="À débloquer" />}
                  <div><strong>{missionCopy.title}</strong><small>{KQ_MISSION_DIFFICULTIES[missionCopy.difficulty]} · Étape {mission.step}</small><p>{missionCopy.description}</p><small className={styles.journeyReward}>{getKqMissionRewardLabel(missionReward(mission))}</small><small className={styles.journeyStatus}>{mission.claimed ? "Récompense récupérée" : mission.claimable ? "À récupérer" : mission.unlocked ? `${mission.progress} / ${mission.target} · En cours` : "Récupère la récompense précédente pour débloquer cette étape"}</small></div>
                </li>;
              })}</ol></details>
            </div>
          </section>;
        })}
      </div>
      <footer className={styles.footer}>
        <details data-mission-overview><summary>Bilan des défis<ChevronDown size={18} aria-hidden="true" /></summary>
          <section className={styles.overview} aria-label="Progression de tes défis">
            <KqAllocationBar label={`${claimed} / ${total} étapes accomplies`} items={[
              { label: "Accomplies", value: claimed, displayValue: String(claimed), tone: "teal" },
              { label: "À récupérer", value: ready, displayValue: String(ready), tone: "gold" },
              ...(unavailable > 0 ? [{ label: "Récompenses indisponibles", value: unavailable, displayValue: String(unavailable), tone: "red" as const }] : []),
              { label: "À accomplir", value: total - claimed - ready - unavailable, displayValue: String(total - claimed - ready - unavailable), tone: "ink" },
            ]} />
          </section>
          <ul className={styles.rewardLegend} aria-label="Types de récompenses"><li><Coins size={16} aria-hidden="true" />Argent du jeu</li><li><Sparkles size={16} aria-hidden="true" />Cartes rares garanties</li><li><Gift size={16} aria-hidden="true" />Packs Botte du Chanvrier</li></ul>
        </details>
        <details><summary>Comment progressent mes missions ?<ChevronDown size={18} aria-hidden="true" /></summary><p>Une mission active par parcours, sans limite de temps. Récupère sa récompense pour débloquer la suivante. Chaque récompense se gagne une seule fois par compte.</p><p>Tes cultures terminées et tes actions enregistrées comptent aussi avant le déblocage d’une étape. Les Buddies différents correspondent aux variétés récoltées. Les objectifs de clientèle et de boutiques demandent de conserver le nombre indiqué jusqu’à la récupération de la récompense.</p><p>Les objectifs d’arômes comptent les nouvelles ventes depuis cette mise à jour. Les deux arômes demandés doivent être réunis sur la même fleur vendue en ligne, selon les tendances au moment de la vente. Le dernier défi demande de réussir sur trois périodes de tendances différentes.</p><p>L’argent est ajouté à ta trésorerie du jeu et les cartes garanties à ta collection Botte du Chanvrier. Ouvre les packs ici ou à la boutique. Les packs déjà remportés avant la mise à jour restent disponibles.</p></details>
      </footer>
    </> : null}
    </>}
    {activePack ? <KqSupportPackOpening cards={packCards} cardCount={activePack.cardCount} busy={opening || loading && !packCards.length}
      busyLabel={opening ? "Ouverture de ton pack…" : "Vérification du statut de ce pack…"}
      error={packIsOpened(activePack.entitlementId) && !packCards.length ? "Ce pack a déjà été ouvert. Ses cartes sont dans ta collection." : packError}
      canRetry={!opening && !loading && !packIsOpened(activePack.entitlementId)}
      onRetry={() => { if (error) void refresh(); else void openPack(activePack); }} retryLabel={error ? "Actualiser le statut" : "Réessayer l’ouverture"}
      onClose={() => { if (!openingLock.current || packCards.length) setActivePack(null); }} onContinue={() => returnFromPack(activePack)} continueLabel={api.isTutorial ? "Retour aux missions" : "Voir mon prochain objectif"} /> : null}
  </main>;
}
