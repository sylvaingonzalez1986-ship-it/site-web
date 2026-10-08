"use client";

import { useEffect, useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { ArrowRight, Gift, Sprout, Trophy, Wallet } from "lucide-react";
import { getArenaResumeActions, parseArenaPlayerSummary, type ArenaPlayerSummary } from "@/lib/arena-player-summary";
import styles from "./ArenaPlayerResume.module.css";

const ICONS = { culture: Sprout, market: Wallet, jury: Trophy, buddies: Gift, support: Gift };
type Status = "loading" | "ready" | "error" | "hidden";

export function ArenaPlayerResume() {
  const [summary, setSummary] = useState<ArenaPlayerSummary | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false;
    let inFlight: AbortController | null = null;
    let lastFetch = 0;
    let accessDenied = false;
    const refresh = async (force = false) => {
      if (disposed || inFlight || document.hidden || accessDenied || (!force && Date.now() - lastFetch < 15_000)) return;
      const controller = new AbortController();
      inFlight = controller;
      lastFetch = Date.now();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/arena/placard/summary", { cache: "no-store", signal: controller.signal });
        if (disposed) return;
        if ([401, 403, 404].includes(response.status)) {
          accessDenied = true; setSummary(null); setStatus("hidden"); return;
        }
        if (!response.ok) throw new Error("Résumé indisponible");
        const parsed = parseArenaPlayerSummary(await response.json());
        if (!parsed) throw new Error("Résumé invalide");
        if (!disposed) { setSummary(parsed); setStatus("ready"); }
      } catch {
        if (!disposed) { setSummary(null); setStatus("error"); }
      } finally { clearTimeout(timeout); if (inFlight === controller) inFlight = null; }
    };
    const resume = () => { void refresh(); };
    const changed = () => { void refresh(true); };
    const events = ["kq:boosters-updated", "kq:collection-updated", "kq:market-updated", "kq:equipment-updated"];
    void refresh(true);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    events.forEach(event => window.addEventListener(event, changed));
    return () => {
      disposed = true; inFlight?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      events.forEach(event => window.removeEventListener(event, changed));
    };
  }, [revision]);

  if (status === "hidden") return null;
  if (!summary) return <section className={styles.resume} data-arena-player-resume data-resume-status={status} aria-label="Ton activité dans l’Arène">
    <p role="status">{status === "error" ? "Ton activité est momentanément indisponible. Tu peux toujours rejoindre le Placard." : "On retrouve ton aventure…"}</p>
    {status === "error" ? <div className={styles.fallback}><button type="button" onClick={() => { setStatus("loading"); setRevision(value => value + 1); }}>Réessayer</button><Link href="/arene/placard" prefetch={false}>Ouvrir mon placard <ArrowRight size={16} aria-hidden="true" /></Link></div> : null}
  </section>;
  const [primary, ...shortcuts] = getArenaResumeActions(summary);
  const Icon = ICONS[primary.id];
  return <section className={styles.resume} data-arena-player-resume data-resume-status="ready" aria-label="Ton activité dans l’Arène">
    <div className={styles.main}>
      <div className={styles.copy}><span className={styles.icon}><Icon size={25} aria-hidden="true" /></span><div><small>TON AVENTURE CONTINUE</small><h3>{primary.title}</h3><p>{primary.description}</p></div></div>
      <Link className={styles.primary} data-resume-primary={primary.id} href={primary.href} prefetch={false}>{primary.label}<ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
    {shortcuts.length ? <nav className={styles.shortcuts} aria-label="Également disponible">{shortcuts.map(action => <Link key={action.id} href={action.href} prefetch={false} data-resume-shortcut={action.id}>{action.title}<ArrowRight size={15} aria-hidden="true" /></Link>)}</nav> : null}
  </section>;
}
