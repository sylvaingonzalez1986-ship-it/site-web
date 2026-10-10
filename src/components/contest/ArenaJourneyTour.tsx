"use client";

import dynamic from "next/dynamic";
import Link from "@/components/navigation/NavigationLink";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { ChevronDown, CircleHelp, Compass, UserRound } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { useCookieConsent } from "@/components/cookies/CookieConsentProvider";
import { ARENA_JOURNEY_STEP_COUNT, advanceArenaJourney, arenaJourneyStorageKey, parseArenaJourneyProgress, type ArenaJourneyAction, type ArenaJourneyProgress } from "@/lib/arena-journey";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import type { ArenaProfileAvailability, ArenaProfileLauncherHandle, ArenaProfileLauncherProps } from "@/lib/arena-profile-launcher";
import { ArenaFirstVisitTutorial } from "./ArenaFirstVisitTutorial";
import { ArenaLearningLauncher } from "./ArenaLearningLauncher";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import { ChanvrierPlayerCard } from "./ChanvrierPlayerCard";
import styles from "./ArenaJourneyTour.module.css";

const Trial = dynamic(() => import("../placard/KqGuidedTrial").then(module => module.KqGuidedTrial), {
  ssr: false,
  loading: () => <p role="status">Chargement de la partie d’essai…</p>,
});

type SavedJourney = { progress: ArenaJourneyProgress; pending: boolean };
function readSaved(userId: string): SavedJourney | null {
  try {
    const row = JSON.parse(localStorage.getItem(arenaJourneyStorageKey(userId)) ?? "null");
    const progress = parseArenaJourneyProgress(row?.progress);
    return progress ? { progress, pending: row.pending === true } : null;
  } catch { return null; }
}
function remember(userId: string, progress: ArenaJourneyProgress, pending: boolean) {
  try {
    localStorage.setItem(arenaJourneyStorageKey(userId), JSON.stringify({ progress, pending }));
    return true;
  } catch { return false; }
}

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
  const [startAfterProfile, setStartAfterProfile] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { showBanner } = useCookieConsent();
  const [progress, setProgress] = useState<ArenaJourneyProgress | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const helpId = useId();
  const controls = useRef<HTMLDivElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const profileOrigin = useRef<HTMLElement | null>(null);
  const playerCard = useRef<ArenaProfileLauncherHandle | null>(null);
  const help = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  // Saved progress is a preference, never permission to open an overlay.
  const active = trialOpen && !!userId && !showBanner && !profileOpen;
  const profileAvailability: ArenaProfileAvailability = showBanner || busy || trialOpen
    ? "blocked" : loading ? "loading" : error && !userId ? "error" : "ready";

  useEffect(() => { onProfileAvailabilityChange?.(profileAvailability); }, [onProfileAvailabilityChange, profileAvailability]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
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
        const response = await fetch("/api/arena/tutorial", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) return;
        if (!response.ok) throw new Error("Le profil et l’essai sont momentanément indisponibles.");
        const body = await response.json();
        const remote = parseArenaJourneyProgress(body.progress);
        if (!remote || typeof body.userId !== "string") throw new Error("Parcours indisponible.");
        if (cancelled) return;
        const local = readSaved(body.userId);
        const next = local && (local.pending || !body.persisted) ? local.progress : remote;
        if (local?.pending && body.persisted) {
          try {
            const sync = await fetch("/api/arena/tutorial", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(next), signal: controller.signal,
            });
            if (sync.ok && (await sync.json()).persisted) remember(body.userId, next, false);
          } catch { /* Keep the pending browser copy for the next visit. */ }
        }
        if (!cancelled) {
          setUserId(body.userId);
          setProgress(next);
          setError("");
          setChanvrier(parseChanvrierProfile(body.chanvrier));
        }
      } catch {
        if (!cancelled) setError("Le profil et l’essai sont momentanément indisponibles.");
      } finally {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [retry]);

  const act = useCallback(async (action: ArenaJourneyAction | "complete"): Promise<boolean> => {
    if (!progress || !userId || inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const next: ArenaJourneyProgress = action === "complete"
      ? { step: ARENA_JOURNEY_STEP_COUNT, status: "completed" }
      : advanceArenaJourney(progress, action);
    let saved = remember(userId, next, true);
    try {
      const response = await fetch("/api/arena/tutorial", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next), signal: AbortSignal.timeout(5000),
      });
      if (response.status === 401 || response.status === 404) {
        if (alive.current) {
          setProgress(null);
          setUserId(null);
          setTrialOpen(false);
          setHelpOpen(true);
          setError(response.status === 401 ? "Reconnecte-toi pour reprendre l’essai." : "L’essai est momentanément indisponible.");
        }
        return false;
      }
      if (response.ok && (await response.json()).persisted) {
        saved = true;
        remember(userId, next, false);
      }
      if (!saved) throw new Error("Impossible de mémoriser cette étape.");
    } catch {
      if (!saved) {
        if (alive.current) setError("Impossible de mémoriser cette étape. Réessaie.");
        return false;
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
    if (!alive.current) return false;
    setProgress(next);
    if (next.status === "completed" || next.status === "skipped") {
      setTrialOpen(false);
      requestAnimationFrame(() => helpButton.current?.focus());
    }
    return true;
  }, [progress, userId]);

  const launchTrial = async () => {
    if (await act("restart")) {
      setHelpOpen(false);
      setTrialOpen(true);
    } else if (alive.current) {
      setHelpOpen(true);
    }
  };
  const requestTrial = () => {
    if (busy || !userId || !progress) return;
    if (!chanvrier) {
      profileOrigin.current = null;
      setHelpOpen(false);
      setStartAfterProfile(true);
      setProfileOpen(true);
    } else {
      void launchTrial();
    }
  };
  const focusProfile = () => {
    const button = profileOrigin.current?.isConnected ? profileOrigin.current
      : controls.current?.querySelector<HTMLButtonElement>("[data-chanvrier-card] button")
        ?? profileButton.current ?? helpButton.current;
    profileOrigin.current = null;
    button?.focus({ preventScroll: true });
  };
  const editProfile = (origin?: HTMLElement) => {
    profileOrigin.current = origin ?? null;
    setStartAfterProfile(false);
    setHelpOpen(false);
    setProfileOpen(true);
  };
  const requestProfile = (origin: HTMLElement): boolean => {
    if (profileAvailability === "blocked" || profileAvailability === "loading" || profileOpen) return false;
    if (profileAvailability === "error") {
      setError("");
      setLoading(true);
      setHelpOpen(true);
      setRetry(value => value + 1);
      return false;
    }
    if (!userId) return true;
    if (chanvrier) {
      setHelpOpen(false);
      playerCard.current?.open(origin);
    } else {
      editProfile(origin);
    }
    return false;
  };
  const closeProfile = () => {
    const returnToHelp = startAfterProfile;
    setStartAfterProfile(false);
    setProfileOpen(false);
    requestAnimationFrame(() => { if (returnToHelp) helpButton.current?.focus(); else focusProfile(); });
  };

  useEffect(() => {
    if (!active) return;
    document.documentElement.dataset.arenaJourney = "active";
    return () => { delete document.documentElement.dataset.arenaJourney; };
  }, [active]);

  useEffect(() => {
    if (!helpOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || help.current?.contains(event.target)) return;
      // The editorial guide is portalled outside its trigger's DOM subtree.
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      setHelpOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [helpOpen]);

  if (showBanner) return null;
  return <div ref={controls} className={styles.controls} data-arena-account-controls>
    {launcherRef ? <ProfileLauncher launcherRef={launcherRef} onOpen={requestProfile} /> : null}
    {userId ? chanvrier
      ? <ChanvrierPlayerCard inline profile={chanvrier} launcherRef={playerCard} onEdit={editProfile} />
      : <button ref={profileButton} type="button" className={styles.profileButton} onClick={event => editProfile(event.currentTarget)}>
          <UserRound size={17} aria-hidden="true" />Créer mon personnage
        </button>
      : null}
    <div ref={help} className={styles.help} onKeyDown={event => {
      if (event.key === "Escape" && event.currentTarget.contains(event.target as Node)) {
        event.preventDefault();
        setHelpOpen(false);
        helpButton.current?.focus();
      }
    }}>
      <button ref={helpButton} type="button" className={styles.helpButton} data-arena-help-trigger
        aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen(value => !value)}>
        <CircleHelp size={17} aria-hidden="true" />Aide<ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id={helpId} className={styles.helpPanel} hidden={!helpOpen}>
        <ArenaLearningLauncher className={styles.helpAction} />
        <ArenaFirstVisitTutorial label="Lire le guide" className={styles.helpAction} />
        {loading ? <p role="status">Chargement de ton parcours…</p>
          : userId && progress ? <button type="button" className={styles.helpAction} data-arena-trial-trigger disabled={busy} onClick={requestTrial}>
              <Compass size={17} aria-hidden="true" />{busy ? "Ouverture de l’essai…" : "Approfondir avec le parcours complet"}
            </button>
          : !error ? <Link className={styles.helpAction} href="/compte/connexion?next=%2Farene"><UserRound size={17} aria-hidden="true" />Parcours complet avec mon compte</Link>
          : null}
        {error ? <div className={styles.loadError} role="status">
          <p>{error}</p>
          {!progress ? <button type="button" disabled={loading} onClick={() => { setError(""); setLoading(true); setRetry(value => value + 1); }}>Réessayer</button> : null}
        </div> : null}
      </div>
    </div>
    {profileOpen && userId ? <ChanvrierProfileEditor profile={chanvrier} onClose={closeProfile} onSaved={profile => {
      setChanvrier(profile);
      setProfileOpen(false);
      setStartAfterProfile(false);
      if (startAfterProfile) {
        setHelpOpen(true);
        requestAnimationFrame(() => helpButton.current?.focus());
        void launchTrial();
      } else {
        requestAnimationFrame(focusProfile);
      }
    }} /> : null}
    {active && userId ? createPortal(<Trial key={userId} userId={userId} busy={busy} error={error}
      onPause={() => void act("skip")} onComplete={() => void act("complete")} />, document.body) : null}
  </div>;
}
