"use client";
import dynamic from "next/dynamic";
import Link from "@/components/navigation/NavigationLink";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { UserRound, Pencil, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { CHANVRIER_OWNER_HEADER, parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { observeChanvrierAdventure, type ChanvrierDraftScope } from "@/lib/chanvrier-profile-draft";
import type { ArenaProfileAvailability, ArenaProfileLauncherProps } from "@/lib/arena-profile-launcher";
import styles from "./ArenaPrelaunch.module.css";
const Editor = dynamic(() => import("./ChanvrierProfileEditor").then(module => module.ChanvrierProfileEditor), { ssr: false });

function ProfileLauncher({ launcherRef, onOpen }: Pick<ArenaProfileLauncherProps, "launcherRef"> & { onOpen: (origin: HTMLElement) => boolean }) {
  const router = useRouter();
  useImperativeHandle(launcherRef, () => ({
    open: origin => { if (onOpen(origin)) router.push("/compte/connexion?next=%2Farene"); },
  }), [onOpen, router]);
  return null;
}

export function ArenaPrelaunchCharacter({ launcherRef, onProfileAvailabilityChange }: ArenaProfileLauncherProps = {}) {
  const { user, authLoading } = useCart();
  const { showBanner } = useCookieConsent();
  const [profile, setProfile] = useState<ChanvrierProfile | null>(null);
  const [draftAccess, setDraftAccess] = useState<{ ownerId: string; scope?: ChanvrierDraftScope }>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const profileOrigin = useRef<HTMLElement | null>(null);
  const profileAvailability: ArenaProfileAvailability = showBanner ? "blocked" : authLoading || loading ? "loading" : error ? "error" : "ready";
  useEffect(() => { onProfileAvailabilityChange?.(profileAvailability); }, [onProfileAvailabilityChange, profileAvailability]);
  useEffect(() => {
    const updateProfile = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.ownerId && detail.ownerId !== user?.id) return;
      const saved = parseChanvrierProfile(detail);
      if (saved) setProfile(saved);
    };
    window.addEventListener("arena:profile-updated", updateProfile);
    return () => window.removeEventListener("arena:profile-updated", updateProfile);
  }, [user?.id]);
  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    async function load() {
      setProfile(null); setDraftAccess(undefined); setOpen(false); setError(""); setLoading(true);
      if (!user?.id) { setLoading(false); return; }
      try {
        const response = await fetch("/api/arena/chanvrier", { headers: { [CHANVRIER_OWNER_HEADER]: user.id }, cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ton personnage est momentanément indisponible.");
        if (!controller.signal.aborted) {
          const createdAt = data.profile === null ? null : data.profile?.createdAt;
          const scope = createdAt === null || typeof createdAt === "string" ? observeChanvrierAdventure(user.id, createdAt) : undefined;
          setDraftAccess({ ownerId: user.id, scope });
          setProfile(parseChanvrierProfile(data.profile));
        }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ton personnage est momentanément indisponible."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [user?.id, authLoading, attempt]);
  const closeProfile = () => {
    setOpen(false);
    const origin = profileOrigin.current;
    profileOrigin.current = null;
    requestAnimationFrame(() => { if (origin?.isConnected) origin.focus({ preventScroll: true }); });
  };
  const requestProfile = (origin: HTMLElement): boolean => {
    if (profileAvailability === "blocked" || profileAvailability === "loading" || open) return false;
    if (profileAvailability === "error") {
      setError("");
      setLoading(true);
      setAttempt(value => value + 1);
      return false;
    }
    if (!user) return true;
    profileOrigin.current = origin;
    setOpen(true);
    return false;
  };
  return <div className={styles.character}>
    {launcherRef ? <ProfileLauncher launcherRef={launcherRef} onOpen={requestProfile} /> : null}
    {authLoading || loading ? <span role="status">Chargement du personnage…</span> : !user ?
      <Link href="/compte/connexion?next=%2Farene" className={styles.characterButton}><UserRound size={18} aria-hidden="true" />Créer mon personnage</Link>
      : error ? <div role="alert"><p>{error}</p><button type="button" className={styles.characterButton} onClick={() => setAttempt(value => value + 1)}>Réessayer</button></div>
      : <>
        {profile && <span className={styles.saved}><Check size={15} aria-hidden="true" />{profile.nickname}, ton personnage est prêt.</span>}
        <button type="button" className={styles.characterButton} onClick={event => { profileOrigin.current = event.currentTarget; setOpen(true); }}>{profile ? <Pencil size={18} aria-hidden="true" /> : <UserRound size={18} aria-hidden="true" />}{profile ? "Modifier mon personnage" : "Créer mon personnage"}</button>
      </>}
    {open && user && draftAccess?.ownerId === user.id && <Editor key={user.id} ownerId={user.id} profile={profile} draftScope={draftAccess.scope} onClose={closeProfile} onSaved={(value, createdAt) => {
      if (!profile) setDraftAccess({ ownerId: user.id, scope: createdAt ? observeChanvrierAdventure(user.id, createdAt) : undefined });
      setProfile(value);
      closeProfile();
    }} />}
  </div>;
}
