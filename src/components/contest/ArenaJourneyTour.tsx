"use client";

import { useRouter } from "@/components/navigation/NavigationFeedback";
import { UserRound } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import type { ArenaProfileAvailability, ArenaProfileLauncherHandle, ArenaProfileLauncherProps } from "@/lib/arena-profile-launcher";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ChanvrierPlayerCard } from "./ChanvrierPlayerCard";
import styles from "./ArenaJourneyTour.module.css";

function ProfileLauncher({ launcherRef, onOpen }: Pick<ArenaProfileLauncherProps, "launcherRef"> & { onOpen: (origin: HTMLElement) => boolean }) {
  const router = useRouter();
  useImperativeHandle(launcherRef, () => ({
    open: origin => { if (onOpen(origin)) router.push("/compte/connexion?next=%2Farene"); },
  }), [onOpen, router]);
  return null;
}

export function ArenaJourneyTour({ launcherRef, onProfileAvailabilityChange }: ArenaProfileLauncherProps = {}) {
  const [chanvrier, setChanvrier] = useState<ChanvrierProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { showBanner } = useCookieConsent();
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const controls = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const profileOrigin = useRef<HTMLElement | null>(null);
  const playerCard = useRef<ArenaProfileLauncherHandle | null>(null);
  const profileAvailability: ArenaProfileAvailability = showBanner
    ? "blocked" : loading ? "loading" : error && !userId ? "error" : "ready";

  useEffect(() => { onProfileAvailabilityChange?.(profileAvailability); }, [onProfileAvailabilityChange, profileAvailability]);
  useEffect(() => {
    const updateProfile = (event: Event) => {
      const profile = parseChanvrierProfile((event as CustomEvent).detail);
      if (profile) setChanvrier(profile);
    };
    window.addEventListener("arena:profile-updated", updateProfile);
    return () => window.removeEventListener("arena:profile-updated", updateProfile);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let cancelled = false;
    void (async () => {
      try {
        // This launcher only reads identity/profile. The game entry owns the
        // one-time introduction preference; playable saves remain isolated.
        const response = await fetch("/api/arena/tutorial", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) {
          if (!cancelled) { setUserId(null); setChanvrier(null); }
          return;
        }
        if (!response.ok) throw new Error("Le personnage est momentanément indisponible.");
        const body = await response.json();
        if (typeof body.userId !== "string") throw new Error("Profil indisponible.");
        if (!cancelled) {
          setUserId(body.userId);
          setError("");
          setChanvrier(parseChanvrierProfile(body.chanvrier));
        }
      } catch {
        if (!cancelled) setError("Le personnage est momentanément indisponible. Réessaie de charger ton profil.");
      } finally {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [retry]);

  const focusProfile = () => {
    const button = profileOrigin.current?.isConnected ? profileOrigin.current
      : controls.current?.querySelector<HTMLButtonElement>("[data-chanvrier-card] button")
        ?? profileButton.current;
    profileOrigin.current = null;
    button?.focus({ preventScroll: true });
  };
  const editProfile = (origin?: HTMLElement) => {
    profileOrigin.current = origin ?? null;
    setProfileOpen(true);
  };
  const requestProfile = (origin: HTMLElement): boolean => {
    // The native modal makes the map inert. Keep its opener enabled so closing
    // the editor can restore focus before any parent availability update.
    if (profileOpen || profileAvailability === "blocked" || profileAvailability === "loading") return false;
    if (profileAvailability === "error") {
      setError("");
      setLoading(true);
      setRetry(value => value + 1);
      return false;
    }
    if (!userId) return true;
    if (chanvrier) {
      playerCard.current?.open(origin);
    } else {
      editProfile(origin);
    }
    return false;
  };
  const closeProfile = () => {
    setProfileOpen(false);
    requestAnimationFrame(focusProfile);
  };

  if (showBanner) return null;
  return <div ref={controls} className={styles.controls} data-arena-account-controls>
    {launcherRef ? <ProfileLauncher launcherRef={launcherRef} onOpen={requestProfile} /> : null}
    {userId ? chanvrier
      ? <ChanvrierPlayerCard inline profile={chanvrier} showTrigger={!launcherRef} launcherRef={playerCard} onEdit={editProfile} />
      : <button ref={profileButton} type="button" className={styles.profileButton} onClick={event => editProfile(event.currentTarget)}>
          <UserRound size={17} aria-hidden="true" />Créer mon personnage
        </button>
      : null}
    {loading ? <p role="status">Chargement du personnage…</p> : null}
    {error ? <div className={styles.loadError} role="status">
      <p>{error}</p>
      <button type="button" disabled={loading} onClick={() => { setError(""); setLoading(true); setRetry(value => value + 1); }}>Réessayer le profil</button>
    </div> : null}
    {profileOpen && userId ? <ChanvrierProfileEditor profile={chanvrier} onClose={closeProfile} onSaved={profile => {
      setChanvrier(profile);
      setProfileOpen(false);
      requestAnimationFrame(focusProfile);
    }} /> : null}
  </div>;
}
