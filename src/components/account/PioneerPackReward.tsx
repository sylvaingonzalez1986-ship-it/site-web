"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { Check, Gift, ArrowUpRight, Coins, Layers, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { PIONEER_CARD_IMAGE, type PioneerPackState } from "@/lib/pioneer-pack";
import { isArenaPrelaunch, ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";
import styles from "./PioneerPackReward.module.css";

export function PioneerPackReward({ onClaimed }: { onClaimed?: () => void | Promise<void> }) {
  const { isAuthenticated, authLoading, user, refreshSession } = useCart();
  const [state, setState] = useState<PioneerPackState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    async function load() {
      setState(null); setError(""); setLoading(true);
      if (!isAuthenticated) { setLoading(false); return; }
      try {
        const response = await fetch("/api/account/pioneer-pack", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible de retrouver ton pack.");
        if (!controller.signal.aborted) setState(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Impossible de retrouver ton pack.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [authLoading, isAuthenticated, user?.id, attempt]);

  const claim = useCallback(async () => {
    if (claiming || !state?.eligible || !state.available || state.claimed) return;
    setClaiming(true); setError("");
    try {
      const response = await fetch("/api/account/pioneer-pack", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ton pack n’a pas pu être attribué.");
      setState(data);
      for (const event of ["kq:boosters-updated", "kq:collection-updated", "kq:equipment-updated"]) window.dispatchEvent(new Event(event));
      // A refresh failure must never turn a successful credit into a failed claim.
      await Promise.allSettled([refreshSession({ force: true }), Promise.resolve().then(() => onClaimed?.())]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Réessaie dans un instant."); }
    finally { setClaiming(false); }
  }, [claiming, state, refreshSession, onClaimed]);

  return <section id="pack-pionniers" className={styles.panel} aria-labelledby="pioneer-title" aria-busy={loading || claiming}>
    <div className={styles.art}>
      <Image src={PIONEER_CARD_IMAGE} alt="Carte exclusive Les Pionniers : Sylvain et sa jeune pousse dans un pot doré." width={1024} height={1536} sizes="(max-width: 640px) 190px, 240px" />
      <span>{state?.claimed ? <><Check size={14} aria-hidden="true" /> Dans ta collection</> : "Carte exclusive · Édition 2026"}</span>
    </div>
    <div className={styles.content}>
      <p className={styles.eyebrow}><Gift size={16} aria-hidden="true" /> Merci d’être là depuis le début</p>
      <h2 id="pioneer-title">Le Pack des Pionniers.</h2>
      <p className={styles.intro}>Une édition spéciale pour celles et ceux qui font grandir l’aventure.</p>
      <ul className={styles.rewards}>
        <li><Sparkles aria-hidden="true" /><span><strong>Les Pionniers</strong><small>Ta carte souvenir exclusive</small></span></li>
        <li><Coins aria-hidden="true" /><span><strong>1 000 € de jeu</strong><small>Crédités dans ta trésorerie</small></span></li>
        <li><Sparkles aria-hidden="true" /><span><strong>1 Buddie or</strong><small>Tiré au hasard, ajouté à ton album</small></span></li>
        <li><Layers aria-hidden="true" /><span><strong>10 packs La Botte</strong><small>10 cartes par pack, à découvrir</small></span></li>
      </ul>
      <p className={styles.terms}>Offert une seule fois par compte pour une commande payée et non annulée, passée depuis l’ouverture du site jusqu’au <strong>10 octobre 2026 inclus</strong> (heure de Paris).</p>
      <div className={styles.action} aria-live="polite">
        {loading ? <p>Recherche de ton pack…</p> : !isAuthenticated ? <Link className={styles.button} href="/compte/connexion?next=/profil/collection%23pack-pionniers">Me connecter <ArrowUpRight size={18} aria-hidden="true" /></Link>
          : state?.claimed ? <div className={styles.success}>
            <strong><Check size={18} aria-hidden="true" /> Ton pack a rejoint ta collection.</strong>
            {state.goldCard && <p>Ton Buddie or : <b>{state.goldCard.name}</b>.</p>}
            <Link href="/arene/placard?view=shop">Ouvrir mes packs La Botte <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div> : state?.eligible ? <>
            <button type="button" className={styles.button} disabled={isArenaPrelaunch() || claiming || !state.available} onClick={() => void claim()}>{isArenaPrelaunch() ? ARENA_OPENING_MESSAGE : claiming ? "Ton pack arrive…" : "Recevoir mon pack offert"}<Gift size={18} aria-hidden="true" /></button>
            {!state.available && <p>Ton pack est réservé. Son contenu est momentanément indisponible.</p>}
          </> : state ? <p>Aucune commande éligible pour le moment. Si tu as commandé sans compte, utilise la même adresse e-mail et vérifie-la.</p> : null}
      </div>
      {error && <div className={styles.error} role="alert"><p>{error}</p>{!state && <button type="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button>}</div>}
    </div>
  </section>;
}
