"use client";
import dynamic from "next/dynamic";
import Link from "@/components/navigation/NavigationLink";
import { useEffect, useState } from "react";
import { UserRound, Pencil, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import styles from "./ArenaPrelaunch.module.css";
const Editor = dynamic(() => import("./ChanvrierProfileEditor").then(module => module.ChanvrierProfileEditor), { ssr: false });

export function ArenaPrelaunchCharacter() {
  const { user, authLoading } = useCart();
  const [profile, setProfile] = useState<ChanvrierProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    async function load() {
      setProfile(null); setOpen(false); setError(""); setLoading(true);
      if (!user?.id) { setLoading(false); return; }
      try {
        const response = await fetch("/api/arena/chanvrier", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ton personnage est momentanément indisponible.");
        if (!controller.signal.aborted) setProfile(parseChanvrierProfile(data.profile));
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ton personnage est momentanément indisponible."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [user?.id, authLoading, attempt]);
  return <div className={styles.character}>
    {authLoading || loading ? <span role="status">Chargement du personnage…</span> : !user ?
      <Link href="/compte/connexion?next=%2Farene" className={styles.characterButton}><UserRound size={18} aria-hidden="true" />Créer mon personnage</Link>
      : error ? <div role="alert"><p>{error}</p><button type="button" className={styles.characterButton} onClick={() => setAttempt(value => value + 1)}>Réessayer</button></div>
      : <>
        {profile && <span className={styles.saved}><Check size={15} aria-hidden="true" />{profile.nickname}, ton personnage est prêt.</span>}
        <button type="button" className={styles.characterButton} onClick={() => setOpen(true)}>{profile ? <Pencil size={18} aria-hidden="true" /> : <UserRound size={18} aria-hidden="true" />}{profile ? "Modifier mon personnage" : "Créer mon personnage"}</button>
      </>}
    {open && user && <Editor key={user.id} profile={profile} onClose={() => setOpen(false)} onSaved={value => { setProfile(value); setOpen(false); }} />}
  </div>;
}
