"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Gift, LockKeyhole, RefreshCw, Sprout, Store, Trophy, Users } from "lucide-react";
import { KQ_MISSION_COPY, KQ_MISSION_TRACKS, type KqMission, type KqMissionClaim, type KqMissionSnapshot } from "@/lib/kanab-quest-missions";
import styles from "./KqMissionCenter.module.css";

const TRACKS = {
  culture: { title: "Culture", image: "/contest/mascot/arena-scene-placard-v1.png", icon: Sprout, unit: "objectif" },
  online: { title: "Vente en ligne", image: "/placard/channel-online-v1.webp", icon: Users, unit: "clients fidèles" },
  shops: { title: "Boutiques partenaires", image: "/placard/channel-cbd-shop-v1.webp", icon: Store, unit: "partenaires" },
};
const PACK_IMAGE = "/placard/shop-item-packs-v2.webp";

export function KqMissionCenter({ onOpen }: { onOpen: (view: "game" | "market" | "shop") => void }) {
  const [data, setData] = useState<KqMissionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [reward, setReward] = useState<KqMissionClaim | null>(null);
  const claiming = useRef(false);
  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const response = await fetch("/api/arena/placard/missions", { cache: "no-store" });
      const payload = await response.json();
      if (version !== requestVersion.current) return;
      setSignedOut(response.status === 401);
      if (!response.ok) throw new Error(payload.error || "Impossible de charger tes missions.");
      setData(payload); setError("");
    } catch (failure) {
      if (version === requestVersion.current) setError(failure instanceof Error ? failure.message : "Connexion interrompue. Réessaie.");
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const update = () => { if (!claiming.current) void refresh(); };
    window.addEventListener("focus", update);
    window.addEventListener("kq:market-updated", update);
    window.addEventListener("kq:boosters-updated", update);
    return () => {
      invalidateRequests();
      window.removeEventListener("focus", update);
      window.removeEventListener("kq:market-updated", update);
      window.removeEventListener("kq:boosters-updated", update);
    };
  }, [refresh, invalidateRequests]);

  async function claim(mission: KqMission) {
    if (claiming.current) return;
    claiming.current = true; setBusy(mission.code); setError(""); setReward(null);
    try {
      const response = await fetch("/api/arena/placard/missions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: mission.code }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de récupérer ce pack.");
      setReward(payload);
      window.dispatchEvent(new Event("kq:boosters-updated"));
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Connexion interrompue. Tu peux réessayer sans perdre ton pack.");
    } finally { claiming.current = false; setBusy(null); }
  }

  const claimed = data?.missions.filter((mission) => mission.claimed).length ?? 0;
  const availablePacks = data?.missions.filter((mission) => mission.packAvailable).length ?? 0;

  return <main className={styles.center}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Centre de missions</span><h1 data-arena-tour="missions">Tes défis, tes cartes.</h1><p>Cultive, fidélise et développe ton réseau. Chaque objectif atteint te rapporte un pack La Botte.</p></div>
      <Image src={PACK_IMAGE} alt="Packs de cartes La Botte à gagner" width={140} height={140} sizes="140px" />
    </header>
    <div className={styles.toolbar}>
      <span><Trophy size={19} aria-hidden="true" /> {claimed} / {data?.missions.length ?? 9} missions accomplies</span>
      <button type="button" disabled={loading || busy !== null} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />{loading ? "Actualisation…" : "Actualiser"}</button>
    </div>
    {error ? <div className={styles.error} role="alert"><p>{error}</p>{signedOut ? <Link href="/compte/connexion?next=%2Farene%2Fplacard%3Fview%3Dmissions">Me connecter</Link> : <button type="button" disabled={loading || busy !== null} onClick={() => void refresh()}>Réessayer</button>}</div> : null}
    {reward ? <div className={styles.receipt} role="status"><Gift aria-hidden="true" /><div><strong>{reward.replayed ? "Ton pack est déjà récupéré." : `Bravo ! Un pack de ${reward.cardCount} cartes gagné.`}</strong><p>Retrouve-le à la boutique La Botte pour découvrir tes cartes.</p></div><button type="button" onClick={() => onOpen("shop")}>Ouvrir la boutique <ArrowRight size={18} aria-hidden="true" /></button></div> : null}
    {loading && !data ? <p role="status" className={styles.loading}>On retrouve ta progression…</p> : null}
    {data ? <>
      {!data.collectionActive ? <p className={styles.error}>Les récompenses La Botte sont momentanément indisponibles. Ta progression reste conservée.</p> : null}
      <div className={styles.tracks}>
        {KQ_MISSION_TRACKS.map((track) => {
          const info = TRACKS[track];
          const missions = data.missions.filter((mission) => mission.track === track).sort((a, b) => a.step - b.step);
          const current = missions.find((mission) => !mission.claimed);
          const copy = current ? KQ_MISSION_COPY[current.code] : null;
          return <section key={track} className={styles.track} aria-label={info.title} data-ready={current?.claimable || undefined}>
            <div className={styles.art}><Image src={info.image} alt="" fill sizes="(max-width: 760px) 100vw, 360px" /><span><info.icon size={18} aria-hidden="true" />{info.title}</span></div>
            <div className={styles.body}>
              {current && copy ? <>
                <span className={styles.eyebrow}>Étape {current.step} / {missions.length}{current.claimable ? " · Objectif atteint !" : ""}</span>
                <h2>{copy.title}</h2><p className={styles.description}>{copy.description}</p>
                <div className={styles.progressLabel}><span>{track === "culture" ? current.code === "three-varieties" ? "Variétés récoltées" : "Fleurs récoltées" : info.unit}</span><b>{current.progress} / {current.target}</b></div>
                <progress aria-label={`Progression : ${copy.title}`} value={current.progress} max={current.target} />
                <div className={styles.reward}><Image src={PACK_IMAGE} alt="" width={52} height={52} /><span><small>À gagner</small><strong>1 {current.cardCount === 10 ? "booster" : "pack"} · {current.cardCount} cartes</strong></span></div>
                {current.claimable ? <button type="button" className={styles.claim} disabled={!data.collectionActive || busy !== null || loading} onClick={() => void claim(current)}><Gift size={18} aria-hidden="true" />{busy === current.code ? "Récupération…" : "Récupérer mon pack"}</button>
                  : <button type="button" className={styles.action} disabled={busy !== null} onClick={() => onOpen(copy.destination)}>{copy.action}<ArrowRight size={18} aria-hidden="true" /></button>}
              </> : <div className={styles.complete}><Trophy size={38} aria-hidden="true" /><h2>Parcours terminé !</h2><p>Tu as remporté tous les packs de ce parcours.</p></div>}
              <details className={styles.journey}><summary>Voir les étapes du parcours</summary><ol>{missions.map((mission) => <li key={mission.code} aria-current={mission.code === current?.code ? "step" : undefined}>
                {mission.claimed ? <Check size={16} aria-label="Accomplie" /> : mission.unlocked ? <span>{mission.step}</span> : <LockKeyhole size={16} aria-label="À débloquer" />}
                <div><strong>{KQ_MISSION_COPY[mission.code].title}</strong><small>{mission.claimed ? "Pack récupéré" : `${mission.cardCount} cartes à gagner`}</small></div>
              </li>)}</ol></details>
            </div>
          </section>;
        })}
      </div>
      <footer className={styles.footer}>
        {availablePacks > 0 ? <button type="button" onClick={() => onOpen("shop")}><Gift size={19} aria-hidden="true" />{availablePacks} pack{availablePacks > 1 ? "s" : ""} de mission à ouvrir<ArrowRight size={18} aria-hidden="true" /></button> : null}
        <details><summary>Comment progressent mes missions ?</summary><p>Une mission active par parcours, sans limite de temps. Récupère son pack pour débloquer la suivante. Chaque récompense se gagne une seule fois par compte.</p><p>Tes cultures déjà terminées comptent, même si leurs fleurs ont été vendues ou utilisées en duel. Pour la vente en ligne et les boutiques, garde le nombre de clients ou de partenaires demandé jusqu’à la réclamation du pack. Une mission récompensée reste acquise.</p><p>La vente en ligne nécessite l’ordinateur et un accès Internet actif, disponibles dans le jeu. Les packs de mission rejoignent les packs disponibles à la boutique La Botte.</p></details>
      </footer>
    </> : null}
  </main>;
}
