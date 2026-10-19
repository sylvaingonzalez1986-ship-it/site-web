"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Coins, FlaskConical, Gift, LockKeyhole, RefreshCw, Sparkles, Sprout, Store, Trophy, Users } from "lucide-react";
import { KQ_MISSION_COPY, KQ_MISSION_DIFFICULTIES, KQ_MISSION_TRACKS, getKqMissionRewardLabel, type KqMission, type KqMissionClaim, type KqMissionDestination, type KqMissionReward, type KqMissionSnapshot, type KqMissionTrack } from "@/lib/kanab-quest-missions";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { CommunityMissionWelcome, CommunityMissionsBoard } from "@/components/missions/CommunityMissionsBoard";
import styles from "./KqMissionCenter.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqSupportPackOpening, requestKqSupportPackOpening, type KqOpenedSupportCard } from "./KqSupportPackOpening";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";

const TRACKS = {
  culture: { title: "Culture & Buddies", image: "/contest/mascot/arena-scene-placard-v1.png", icon: Sprout },
  quality: { title: "Qualité & savoir-faire", image: "/placard/map/culture-barn-sylvain-v1.webp", icon: Sparkles },
  preparation: { title: "Entrepôt & atelier", image: "/placard/market-workshop-sylvain-v2.webp", icon: FlaskConical },
  online: { title: "Vente en ligne", image: "/placard/channel-online-sylvain-v2.webp", icon: Users },
  shops: { title: "Boutiques partenaires", image: "/placard/channel-cbd-shop-sylvain-v2.webp", icon: Store },
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

export function KqMissionCenter({ onOpen }: { onOpen: (view: KqMissionDestination) => void }) {
  const api = useKqTutorialApi();
  const [section, setSection] = useState<"community" | "challenges">("challenges");
  const [selectedTrack, setSelectedTrack] = useState<KqMissionTrack | "all">("all");
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
    void refresh();
    const update = () => { if (!claiming.current && !openingLock.current) void refresh(); };
    const unsubscribe = api.subscribe(["focus", "kq:market-updated", "kq:boosters-updated", "kq:storage-updated", "arena:progress-updated"], update);
    return () => {
      invalidateRequests();
      unsubscribe();
    };
  }, [refresh, invalidateRequests, api]);

  async function claim(mission: KqMission) {
    if (claiming.current || openingLock.current) return;
    claiming.current = true; setBusy(mission.code); setError(""); setReward(null);
    try {
      const response = await api.request("/api/arena/placard/missions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: mission.code }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de récupérer cette récompense.");
      const receivedReward = missionReward(payload);
      setReward({ ...payload, reward: receivedReward, code: mission.code });
      if (receivedReward.kind === "cash") {
        api.notify("kq:equipment-updated");
        api.notify("kq:treasury-updated");
      } else if (receivedReward.kind === "card") api.notify("kq:collection-updated");
      else api.notify("kq:boosters-updated");
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
      api.notify("kq:collection-updated");
      api.notify("kq:boosters-updated");
    } catch (failure) {
      setPackError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "Connexion interrompue. Actualise tes missions avant de réessayer.");
    } finally {
      // Reconcile after an ambiguous response too: the server may have opened
      // the pack even if its response did not reach this browser.
      await refresh();
      openingLock.current = false; setOpening(false);
    }
  }

  const packIsOpened = (entitlementId: string) => openedEntitlements.includes(entitlementId) || data?.missions.some(mission => mission.entitlementId === entitlementId && mission.packAvailable === false) === true;
  const continueActivity = (pack: { code: KqMission["code"] }) => {
    setActivePack(null);
    setReward(null);
    if (!api.isTutorial) onOpen(KQ_MISSION_COPY[pack.code].destination);
  };

  const claimed = data?.missions.filter((mission) => mission.claimed).length ?? 0;
  const ready = data?.missions.filter(mission => !mission.claimed && mission.claimable).length ?? 0;
  const total = data?.missions.length ?? Object.keys(KQ_MISSION_COPY).length;
  const availableMissions = data?.missions.filter((mission) => mission.packAvailable && mission.entitlementId && !openedEntitlements.includes(mission.entitlementId)) ?? [];
  const availablePacks = availableMissions.length;
  const nextPack = availableMissions[0];
  const receivedReward = reward ? missionReward(reward) : null;
  const rewardOpened = reward?.entitlementId ? packIsOpened(reward.entitlementId) : false;
  const receiptPack = receivedReward?.kind === "pack" && reward?.entitlementId ? { entitlementId: reward.entitlementId, cardCount: reward.cardCount, code: reward.code } : null;
  const rewardTitle = reward && receivedReward ? receivedReward.kind === "cash"
    ? `${getKqMissionRewardLabel(receivedReward)} ${reward.replayed ? "déjà crédités" : "crédités"} !`
    : receivedReward.kind === "card"
      ? `${receivedReward.name} ${reward.replayed ? "a déjà été reçue" : "rejoint ta collection"} !`
      : rewardOpened ? "Ton pack est ouvert." : reward.replayed ? "Ton pack est déjà récupéré." : `Bravo ! Un pack de ${reward.cardCount} cartes gagné.`
    : "";

  return <main className={styles.center}>
    <header className={styles.header}><div><h1>Mes objectifs</h1><p>De ta première récolte aux défis de maître chanvrier : {total} missions pour développer tes cultures, ton atelier et ton commerce.</p></div></header>
    <nav className={styles.sections} aria-label="Parcours des missions"><button type="button" aria-pressed={section === "challenges"} onClick={() => setSection("challenges")}><Trophy size={18} aria-hidden="true" />Mes défis{availablePacks > 0 ? <span>{availablePacks} pack{availablePacks > 1 ? "s" : ""}</span> : null}</button><button type="button" aria-pressed={section === "community"} onClick={() => setSection("community")}><Users size={18} aria-hidden="true" />Communauté</button></nav>
    {section === "community" ? <><CommunityMissionWelcome /><CommunityMissionsBoard /></> : <>
    <section className={styles.overview} aria-label="Progression de tes défis">
      <div className={styles.overviewHeading}><small>Le parcours du chanvrier</small><strong>{data ? `${claimed} / ${total} missions accomplies` : "Tes cinq parcours"}</strong></div>
      {ready > 0 ? <span className={styles.readyCount}><Gift size={20} aria-hidden="true" />{ready} récompense{ready > 1 ? "s" : ""} à récupérer</span> : null}
      {data ? <div className={styles.overviewVisual}><KqAllocationBar label="État des missions" items={[
        { label: "Accomplies", value: claimed, displayValue: String(claimed), tone: "teal" },
        { label: "À récupérer", value: ready, displayValue: String(ready), tone: "gold" },
        { label: "À accomplir", value: total - claimed - ready, displayValue: String(total - claimed - ready), tone: "ink" },
      ]} /></div> : null}
    </section>
    <ul className={styles.rewardLegend} aria-label="Types de récompenses"><li><Coins size={16} aria-hidden="true" />Argent du jeu</li><li><Sparkles size={16} aria-hidden="true" />Cartes rares garanties</li><li><Gift size={16} aria-hidden="true" />Packs Botte du Chanvrier</li></ul>
    <div className={styles.toolbar}>
      <span><Trophy size={19} aria-hidden="true" />Une mission active par parcours</span>
      <button type="button" disabled={loading || busy !== null || opening} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />{loading ? "Actualisation…" : "Actualiser"}</button>
    </div>
    {error ? <div className={styles.error} role="alert"><p>{error}</p>{signedOut ? <Link href="/compte/connexion?next=%2Farene%2Fplacard%3Fview%3Dmissions">Me connecter</Link> : <button type="button" disabled={loading || busy !== null} onClick={() => void refresh()}>Réessayer</button>}</div> : null}
    {reward && receivedReward ? <div className={styles.receipt} role="status" data-mission-receipt>
      <RewardArtwork reward={receivedReward} large />
      <div><strong>{rewardTitle}</strong><p>{receivedReward.kind === "cash" ? "Ta trésorerie du jeu est à jour. La prochaine étape du parcours est débloquée." : receivedReward.kind === "card" ? "Ta carte rare Botte du Chanvrier est prête à être utilisée. La prochaine étape est débloquée." : rewardOpened ? "Tes cartes ont rejoint ta collection. La suite de ton aventure t’attend." : "Découvre tes cartes ici, puis reprends ton activité."}</p></div>
      {receiptPack && !rewardOpened ? <button type="button" disabled={opening || busy !== null} onClick={() => void openPack(receiptPack)}>Ouvrir mon pack<ArrowRight size={18} aria-hidden="true" /></button> : <button type="button" onClick={() => continueActivity(reward)}>{api.isTutorial ? "Continuer mes défis" : KQ_MISSION_COPY[reward.code].action}<ArrowRight size={18} aria-hidden="true" /></button>}
    </div> : null}
    {loading && !data ? <p role="status" className={styles.loading}>On retrouve ta progression…</p> : null}
    {data ? <>
      {!data.collectionActive ? <p className={styles.error}>Les cartes et packs Botte du Chanvrier sont momentanément indisponibles. Tu peux toujours récupérer l’argent du jeu ; toute ta progression est conservée.</p> : null}
      <nav className={styles.trackNav} aria-label="Filtrer les parcours">
        <button type="button" aria-pressed={selectedTrack === "all"} onClick={() => setSelectedTrack("all")}>Tous les parcours</button>
        {KQ_MISSION_TRACKS.map(track => {
          const missions = data.missions.filter(mission => mission.track === track);
          return <button key={track} type="button" aria-pressed={selectedTrack === track} onClick={() => setSelectedTrack(track)}>{TRACKS[track].title}<small>{missions.filter(mission => mission.claimed).length}/{missions.length}</small></button>;
        })}
      </nav>
      <div className={styles.tracks}>
        {KQ_MISSION_TRACKS.filter(track => selectedTrack === "all" || selectedTrack === track).map((track) => {
          const info = TRACKS[track];
          const missions = data.missions.filter((mission) => mission.track === track).sort((a, b) => a.step - b.step);
          if (!missions.length) return null;
          const current = missions.find((mission) => !mission.claimed);
          const copy = current ? KQ_MISSION_COPY[current.code] : null;
          const currentReward = current ? missionReward(current) : null;
          const rewardUnavailable = current?.rewardAvailable === false || (current?.rewardAvailable === undefined && currentReward?.kind !== "cash" && !data.collectionActive);
          return <section key={track} className={styles.track} aria-label={info.title} data-ready={current?.claimable || undefined}>
            <div className={styles.art}><Image src={info.image} alt="" fill sizes="(max-width: 760px) 100vw, 360px" /><span><info.icon size={18} aria-hidden="true" />{info.title}</span></div>
            <div className={styles.body}>
              <div className={styles.trackProgress} aria-label={`${missions.filter(mission => mission.claimed).length} étapes accomplies sur ${missions.length}`} role="img">{missions.map(mission => <span key={mission.code} data-complete={mission.claimed || undefined} data-current={mission.code === current?.code || undefined} />)}</div>
              {current && copy && currentReward ? <>
                <div className={styles.stepHeading}><span className={styles.eyebrow}>Étape {current.step} / {missions.length}</span><span className={styles.difficulty} data-level={copy.difficulty}>{KQ_MISSION_DIFFICULTIES[copy.difficulty]}</span></div>
                <h2>{copy.title}</h2><p className={styles.description}>{copy.description}</p>
                {current.claimable ? <span className={styles.reached}><Check size={16} aria-hidden="true" />Objectif atteint !</span> : null}
                <div className={styles.missionMeter}><KqProgressMeter label={copy.progressLabel} value={current.progress} max={current.target}
                  valueLabel={`${current.progress.toLocaleString("fr-FR")} / ${current.target.toLocaleString("fr-FR")}`}
                  tone={current.claimable ? "gold" : "teal"} /></div>
                <div className={styles.reward} data-kind={currentReward.kind}><RewardArtwork reward={currentReward} /><span><small>À gagner</small><strong>{getKqMissionRewardLabel(currentReward)}</strong>{currentReward.kind === "card" ? <em>Carte précise garantie · Botte du Chanvrier</em> : currentReward.kind === "cash" ? <em>Crédité dans ta trésorerie du jeu</em> : <em>À ouvrir ici ou à la boutique</em>}</span></div>
                {current.claimable ? <button type="button" className={styles.claim} disabled={rewardUnavailable || busy !== null || loading || opening} onClick={() => void claim(current)}><Gift size={18} aria-hidden="true" />{busy === current.code ? "Récupération…" : currentReward.kind === "pack" ? "Récupérer mon pack" : currentReward.kind === "card" ? "Récupérer ma carte" : "Récupérer ma récompense"}</button>
                  : <button type="button" className={styles.action} disabled={busy !== null || opening} onClick={() => onOpen(copy.destination)}>{copy.action}<ArrowRight size={18} aria-hidden="true" /></button>}
                {current.claimable && rewardUnavailable ? <p className={styles.unavailable}>Récompense temporairement indisponible. Ton objectif reste enregistré.</p> : null}
              </> : <div className={styles.complete}><Trophy size={38} aria-hidden="true" /><h2>Parcours terminé !</h2><p>Tu as remporté toutes les récompenses de ce parcours.</p></div>}
              <details className={styles.journey}><summary>Voir les {missions.length} étapes et récompenses</summary><ol>{missions.map(mission => {
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
        {nextPack?.entitlementId ? <button type="button" disabled={opening || busy !== null} onClick={() => void openPack({ entitlementId: nextPack.entitlementId!, cardCount: nextPack.cardCount, code: nextPack.code })}><Gift size={19} aria-hidden="true" />{availablePacks} pack{availablePacks > 1 ? "s" : ""} de mission à ouvrir<ArrowRight size={18} aria-hidden="true" /></button> : null}
        <details><summary>Comment progressent mes missions ?</summary><p>Une mission active par parcours, sans limite de temps. Récupère sa récompense pour débloquer la suivante. Chaque récompense se gagne une seule fois par compte.</p><p>Tes cultures terminées et tes actions enregistrées comptent aussi avant le déblocage d’une étape. Les Buddies différents correspondent aux variétés récoltées. Les objectifs de clientèle et de boutiques demandent de conserver le nombre indiqué jusqu’à la récupération de la récompense.</p><p>Les objectifs d’arômes comptent les nouvelles ventes depuis cette mise à jour. Les deux arômes demandés doivent être réunis sur la même fleur vendue en ligne, selon les tendances au moment de la vente. Le dernier défi demande de réussir sur trois périodes de tendances différentes.</p><p>L’argent est ajouté à ta trésorerie du jeu et les cartes garanties à ta collection Botte du Chanvrier. Ouvre les packs ici ou à la boutique. Les packs déjà remportés avant la mise à jour restent disponibles.</p></details>
      </footer>
    </> : null}
    </>}
    {activePack ? <KqSupportPackOpening cards={packCards} cardCount={activePack.cardCount} busy={opening} error={packIsOpened(activePack.entitlementId) && !packCards.length ? "Ce pack a déjà été ouvert. Ses cartes sont dans ta collection." : packError} canRetry={!opening && !packIsOpened(activePack.entitlementId)} onRetry={() => void openPack(activePack)} onClose={() => { if (!openingLock.current || packCards.length) setActivePack(null); }} onContinue={() => continueActivity(activePack)} continueLabel={api.isTutorial ? "Retour aux missions" : KQ_MISSION_COPY[activePack.code].action} /> : null}
  </main>;
}
