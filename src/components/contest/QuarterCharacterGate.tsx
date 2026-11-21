"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "@/components/navigation/NavigationLink";
import { parseChanvrierProfile, type ChanvrierProfile } from "@/lib/arena-chanvrier";
import { QuarterCharacterContext, QuarterAppearanceEditorContext } from "./QuarterCharacterContext";
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
export function QuarterCharacterGate({ ownerId, enabled = true, children }: { ownerId: string; enabled?: boolean; children: ReactNode }) {
  const [state, setState] = useState<"loading" | "story" | "create" | "paused" | "ready" | "error" | "signed-out">("loading");
  const [retry, setRetry] = useState(0);
  const [character, setCharacter] = useState<ChanvrierProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
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
        if (!cancelled) {
          setCharacter(profile);
          setState(profile ? "ready" : "story");
        }
      } catch { if (!cancelled) setState("error"); }
      finally { clearTimeout(timeout); }
    })();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [enabled, ownerId, retry]);

  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => {
      if (state === "paused") createButton.current?.focus();
      else if (state === "story") heading.current?.focus({ preventScroll: true });
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

  if (enabled && state === "ready") return <QuarterCharacterContext.Provider value={character}>
    <QuarterAppearanceEditorContext.Provider value={{ open: () => setEditing(true), editing }}>
      {children}
      {character && editing && <ChanvrierProfileEditor profile={character} onClose={() => setEditing(false)}
        onSaved={saved => { setCharacter(saved); setEditing(false); }} />}
    </QuarterAppearanceEditorContext.Provider>
  </QuarterCharacterContext.Provider>;
  if (enabled && ["story", "create", "paused"].includes(state)) return <main className={`${styles.entry} ${styles.arrival}`} data-quarter-character-gate data-quarter-arrival="story">
    <picture className={styles.scene}>
      <source media="(max-width: 850px)" srcSet="/contest/releve/arrival-sylvain-portrait-v1.webp" />
      <Image src={ARENA_RELEVE_SCENES.arrival} alt="La vieille grange du Quartier, aux portes turquoise." fill sizes="100vw" loading="eager" fetchPriority="high" />
    </picture>
    <div className={styles.content}>
      <h1 ref={heading} tabIndex={-1}>Les clés de la grange</h1>
      <p>Ton grand-père t’a laissé sa grange. De l’autre côté de la cour, Loïc te fait signe. Ta première récolte commence ici.</p>
        <div className={styles.actions}><button ref={createButton} type="button" className={styles.primary} data-arrival-create onClick={() => setState("create")}>
          Créer mon personnage<ArrowRight size={18} aria-hidden="true" />
        </button></div>
      <Link className={styles.returnLink} href="/arene">Retour à l’Arène</Link>
    </div>
    {state === "create" ? <ChanvrierProfileEditor profile={null} skipInheritance onClose={() => setState("paused")} onSaved={profile => {
      setCharacter(profile);
      setState("ready");
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
