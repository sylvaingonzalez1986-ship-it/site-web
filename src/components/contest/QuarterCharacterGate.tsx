"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "@/components/navigation/NavigationLink";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { QuarterCharacterContext } from "./QuarterCharacterContext";
import { ARENA_RELEVE_SCENES } from "@/lib/arena-releve";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import { ChanvrierProfileEditor } from "./ChanvrierProfileEditor";
import styles from "./ArenaGameEntry.module.css";

function reconnectHref() {
  const query = typeof window === "undefined" ? "" : window.location.search;
  const next = sanitizeNextPath(`/arene/placard${query}`, "/arene/placard");
  return `/compte/connexion?next=${encodeURIComponent(next)}`;
}

/** Server profile existence, rather than a browser flag, controls first arrival. */
export function QuarterCharacterGate({ ownerId, enabled = true, onArrivalComplete, children }: { ownerId: string; enabled?: boolean; onArrivalComplete?: () => void; children: ReactNode }) {
  const [state, setState] = useState<"loading" | "story" | "create" | "paused" | "meeting" | "ready" | "error" | "signed-out">("loading");
  const [retry, setRetry] = useState(0);
  const [character, setCharacter] = useState<ChanvrierProfile | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const continuationKey = `quarter-arrival-meeting-v1:${ownerId}`;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/arena/tutorial", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { if (!cancelled) setState("signed-out"); return; }
        if (!response.ok) throw new Error("Profile unavailable");
        const body = await response.json();
        if (body.userId !== ownerId) { if (!cancelled) setState("signed-out"); return; }
        const profile = parseChanvrierProfile(body.chanvrier);
        if (body.chanvrier !== null && !profile) throw new Error("Invalid profile");
        let meetingPending = false;
        try { meetingPending = sessionStorage.getItem(continuationKey) === "pending"; } catch { /* Continue without browser persistence. */ }
        if (!cancelled) {
          setCharacter(profile);
          setState(profile ? meetingPending ? "meeting" : "ready" : "story");
        }
      } catch { if (!cancelled) setState("error"); }
      finally { clearTimeout(timeout); }
    })();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [enabled, ownerId, retry, continuationKey]);

  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => {
      if (state === "paused") createButton.current?.focus();
      else if (state === "story" || state === "meeting") {
        heading.current?.focus({ preventScroll: true });
        if (state === "meeting") window.scrollTo({ top: 0, behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, state]);

  useEffect(() => {
    const refreshAppearance = (event: Event) => {
      const profile = parseChanvrierProfile((event as CustomEvent).detail);
      if (profile) setCharacter(profile);
    };
    window.addEventListener("arena:profile-updated", refreshAppearance);
    return () => window.removeEventListener("arena:profile-updated", refreshAppearance);
  }, []);

  if (enabled && state === "ready") return <QuarterCharacterContext.Provider value={character}>{children}</QuarterCharacterContext.Provider>;
  if (enabled && ["story", "create", "paused", "meeting"].includes(state)) return <main className={`${styles.entry} ${styles.arrival}`} data-quarter-character-gate data-quarter-arrival={state === "meeting" ? "meeting" : "story"}>
    <picture className={styles.scene}>
      <source media="(max-width: 850px)" srcSet="/contest/releve/arrival-sylvain-portrait-v1.webp" />
      <Image src={ARENA_RELEVE_SCENES.arrival} alt="Loïc t’attend devant la vieille grange aux portes turquoise." fill sizes="100vw" loading="eager" fetchPriority="high" />
    </picture>
    <div className={styles.content}>
      <h1 ref={heading} tabIndex={-1}>{state === "meeting" ? "Une place pour ta première installation" : "Tout commence dans une grange"}</h1>
      {state === "meeting" ? <>
        <p>Loïc est sur le pas de la porte. Il regarde la grange, puis esquisse un sourire.</p>
        <p className={styles.dialogue}>— Bon, y’a du boulot. Mais on a vu de belles aventures commencer avec moins que ça. Allez, viens. On va lui trouver une place, à ta première installation.</p>
        <div className={styles.actions}><button type="button" className={styles.primary} data-arrival-start onClick={() => {
          try { sessionStorage.removeItem(continuationKey); } catch { /* The in-memory transition still works. */ }
          onArrivalComplete?.();
          setState("ready");
        }}>Aménager ma grange<ArrowRight size={18} aria-hidden="true" /></button></div>
      </> : <>
        <p>Ton grand-père t’a laissé sa maison et la vieille grange qui va avec. Tu reviens au Quartier, les clés en poche, avec un projet bien en tête : y monter ta ferme indoor et devenir le meilleur grower du coin.</p>
        <p>La porte grince. À l’intérieur, quelques toiles d’araignée et beaucoup de place. Pour l’instant, ce sont surtout les courants d’air qui occupent les lieux. Mais tu vois déjà où installer ta première chambre de culture, faire sécher tes récoltes et ranger ta production.</p>
        <p>Tout reste à construire. Tes premières cultures financeront tes premières améliorations. À toi de faire les bons choix pour produire de belles récoltes, développer ton activité et réinvestir tes gains. Tu veux une ferme qui tourne, un business qui grandit et des récoltes qui deviennent la référence du Quartier.</p>
        <p>Une voix te tire de tes plans.</p>
        <p className={styles.dialogue}>— Alors, le futur meilleur grower du Quartier, c’est toi ?</p>
        <div className={styles.actions}><button ref={createButton} type="button" className={styles.primary} data-arrival-create onClick={() => setState("create")}>
          Créer mon personnage<ArrowRight size={18} aria-hidden="true" />
        </button></div>
      </>}
      <Link className={styles.returnLink} href="/arene">Retour à l’Arène</Link>
    </div>
    {state === "create" ? <ChanvrierProfileEditor profile={null} skipInheritance onClose={() => setState("paused")} onSaved={profile => {
      setCharacter(profile);
      try { sessionStorage.setItem(continuationKey, "pending"); } catch { /* Keep the scene available in this visit. */ }
      setState("meeting");
    }} /> : null}
  </main>;
  return <main className={styles.characterWelcome} data-quarter-character-gate>
    <h1>Bienvenue au Quartier</h1>
    {!enabled || state === "loading" ? <p role="status">Ton accueil se prépare…</p>
      : state === "signed-out" ? <><p>Reconnecte-toi pour retrouver ton personnage.</p><Link href={reconnectHref()}>Me reconnecter</Link></>
      : state === "error" ? <><p role="alert">Impossible de charger ton personnage pour le moment.</p><button type="button" onClick={() => { setState("loading"); setRetry(value => value + 1); }}>Réessayer</button></>
      : null}
    <Link href="/arene">Retour à l’Arène</Link>
  </main>;
}
