"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Focus, Footprints, RotateCcw, RotateCw } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import type { ChanvrierWorkshopView, createChanvrierWorkshopRenderer } from "./chanvrier-workshop-renderer";
import styles from "./ChanvrierProfileEditor.module.css";

const VIEWS = [{ code: "portrait", label: "Visage", title: "Zoom visage" }, { code: "full", label: "En pied", title: "En pied" }, { code: "village", label: "Quartier", title: "Vue du Quartier en isométrie" }] as const;
const TURN = Math.PI / 8;

export function ChanvrierWorkshopPreview({ profile, view, onViewChange, disabled }: {
  profile: ChanvrierAvatarProfile;
  view: ChanvrierWorkshopView;
  onViewChange: (view: ChanvrierWorkshopView) => void;
  disabled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createChanvrierWorkshopRenderer> | null>(null);
  const latest = useRef(profile);
  const drag = useRef<{ id: number; x: number }>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [rotation, setRotation] = useState(0);
  const [walking, setWalking] = useState(false);
  const instructions = useId();
  const ready = status === "ready";
  const frameControls = [{ Icon: RotateCcw, label: "Tourner à gauche", action: () => turn(-TURN) }, { Icon: RotateCw, label: "Tourner à droite", action: () => turn(TURN) }, { Icon: Focus, label: "Recentrer la vue", action: () => setRotation(0) }];

  function turn(amount: number) {
    setRotation(current => (current + amount) % (2 * Math.PI));
  }

  useEffect(() => {
    const target = canvas.current;
    const container = host.current;
    if (!target || !container) return;
    let cancelled = false;
    let stopObserving: (() => void) | undefined;
    void import("./chanvrier-workshop-renderer").then(({ createChanvrierWorkshopRenderer }) => {
      if (cancelled) return;
      const instance = createChanvrierWorkshopRenderer(target, latest.current, () => {
        instance.dispose();
        renderer.current = null;
        setStatus("fallback");
      });
      renderer.current = instance;
      const resize = () => instance.resize(container.clientWidth, container.clientHeight);
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      window.addEventListener("resize", resize);
      stopObserving = () => {
        observer.disconnect();
        window.removeEventListener("resize", resize);
      };
      resize();
      setStatus("ready");
    }).catch(() => {
      if (!cancelled) setStatus("fallback");
    });
    return () => {
      cancelled = true;
      stopObserving?.();
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    const previous = latest.current;
    latest.current = profile;
    if (previous !== profile) renderer.current?.updateAppearance(profile);
  }, [profile]);

  useEffect(() => {
    if (ready) renderer.current?.updateFrame({ view, rotation, walking: walking && !disabled });
  }, [view, rotation, walking, ready, disabled]);

  function toggleWalking() {
    if (!walking && view === "portrait") onViewChange("full");
    setWalking(!walking);
  }

  return <aside className={styles.workshopPreview} aria-label="Aperçu du personnage">
    <div ref={host} className={styles.stage} data-preview-state={status} data-preview-view={view} data-preview-rotation={rotation.toFixed(3)} data-preview-walking={walking && !disabled}
      tabIndex={ready && !disabled ? 0 : undefined} role="group" aria-label={!ready ? "Aperçu du personnage" : walking && !disabled ? "Personnage en 3D en marche" : "Personnage en 3D au repos"} aria-describedby={instructions}
      onKeyDown={event => {
        if (disabled || !ready) return;
        if (event.key === "ArrowLeft") turn(-TURN);
        else if (event.key === "ArrowRight") turn(TURN);
        else if (event.key === "Home") setRotation(0);
        else return;
        event.preventDefault();
      }}
      onPointerDown={event => {
        if (disabled || !ready || !event.isPrimary || event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (drag.current?.id !== event.pointerId || disabled || !ready) return;
        turn((event.clientX - drag.current.x) * .014);
        drag.current.x = event.clientX;
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}>
      <canvas ref={canvas} className={styles.stageCanvas} aria-hidden="true" hidden={!ready} />
      {status === "loading" && <p className={styles.previewStatus} role="status">Chargement de l’aperçu…</p>}
      {status === "fallback" && <ChanvrierAvatar profile={profile} className={styles.stageCanvas} view={view === "portrait" ? "portrait" : "full"} />}
    </div>
    <div className={styles.previewTools}>
      <div className={styles.viewControls} role="group" aria-label="Cadrage du personnage">
        {VIEWS.map(({ code, label, title }) => <button key={code} type="button" aria-label={title} title={title} aria-pressed={view === code} disabled={disabled || (code === "village" && !ready)} onClick={() => onViewChange(code)}>{label}</button>)}
      </div>
      <div className={styles.rotationControls} role="group" aria-label="Orientation du personnage">
        {frameControls.map(({ Icon, label, action }) => <button key={label} type="button" title={label} aria-label={label} disabled={disabled || !ready} onClick={action}><Icon size={18} aria-hidden="true" /></button>)}
      </div>
      <button type="button" className={styles.walkButton} disabled={disabled || !ready} aria-label={walking ? "Au repos" : "Faire marcher"} aria-pressed={walking} title={walking ? "Au repos" : "Faire marcher"} onClick={toggleWalking}><Footprints size={17} aria-hidden="true" /><span>{walking ? "Au repos" : "Faire marcher"}</span></button>
    </div>
    <p id={instructions} className={styles.stageHint} data-notice={status === "fallback" || undefined} role="status">{status === "fallback" ? "3D indisponible · aperçu fixe" : view === "village" ? "Angle, éclairage et échelle du Quartier." : "Glisse ou utilise les flèches pour tourner."}</p>
  </aside>;
}
