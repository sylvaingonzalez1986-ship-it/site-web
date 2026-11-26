"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Focus, Footprints, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { ChanvrierExpression } from "../placard/kq-grow-worker-model";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import type { ChanvrierWorkshopView, createChanvrierWorkshopRenderer } from "./chanvrier-workshop-renderer";
import styles from "./ChanvrierProfileEditor.module.css";

const VIEWS = [{ code: "portrait", label: "Visage", title: "Zoom visage" }, { code: "full", label: "En pied", title: "En pied" }, { code: "village", label: "Quartier", title: "Vue du Quartier en isométrie" }] as const;
const TURN = Math.PI / 8;
const ZOOM = [.85, 1, 1.15, 1.3, 1.45] as const;

export function ChanvrierWorkshopPreview({ profile, view, onViewChange, disabled, expression }: {
  profile: ChanvrierAvatarProfile;
  view: ChanvrierWorkshopView;
  onViewChange: (view: ChanvrierWorkshopView) => void;
  disabled: boolean;
  expression: ChanvrierExpression;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createChanvrierWorkshopRenderer> | null>(null);
  const latest = useRef(profile);
  const drag = useRef<{ id: number; x: number }>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [rotation, setRotation] = useState(0);
  const [viewZoom, setViewZoom] = useState({ view, step: 1 });
  const [walking, setWalking] = useState(false);
  const instructions = useId();
  const ready = status === "ready";
  const activeWalk = walking && !disabled && ready;
  const canZoom = ready && !disabled && view !== "village";
  const zoomStep = viewZoom.view === view ? viewZoom.step : 1;
  const zoom = view === "village" ? 1 : ZOOM[zoomStep];
  const centered = (Math.abs(rotation) < .001 || 2 * Math.PI - Math.abs(rotation) < .001) && zoom === 1;
  const frameControls = [
    { Icon: RotateCcw, label: "Tourner à gauche", action: () => turn(-TURN) },
    { Icon: RotateCw, label: "Tourner à droite", action: () => turn(TURN) },
    { Icon: Focus, label: "Recentrer la vue", action: resetFrame, inactive: centered },
  ];

  function turn(amount: number) {
    setRotation(current => (current + amount) % (2 * Math.PI));
  }

  function resetFrame() {
    setRotation(0);
    setViewZoom({ view, step: 1 });
  }

  function changeZoom(amount: number) {
    setViewZoom(current => {
      const currentStep = current.view === view ? current.step : 1;
      return { view, step: Math.max(0, Math.min(ZOOM.length - 1, currentStep + amount)) };
    });
  }

  function changeView(next: ChanvrierWorkshopView) {
    setViewZoom({ view: next, step: 1 });
    onViewChange(next);
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
    if (ready) renderer.current?.updateFrame({ view, rotation, zoom, expression, walking: walking && !disabled });
  }, [view, rotation, zoom, expression, walking, ready, disabled]);

  function toggleWalking() {
    if (!walking && view === "portrait") changeView("full");
    setWalking(!walking);
  }

  return <aside className={styles.workshopPreview} aria-label="Aperçu du personnage">
    <div ref={host} className={styles.stage} data-preview-state={status} data-preview-view={view} data-preview-rotation={rotation.toFixed(3)} data-preview-zoom={zoom} data-preview-walking={activeWalk}
      tabIndex={ready && !disabled ? 0 : undefined} role="group" aria-label={!ready ? "Aperçu du personnage" : activeWalk ? "Personnage en 3D en marche" : "Personnage en 3D au repos"} aria-describedby={instructions}
      onKeyDown={event => {
        if (disabled || !ready || event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft") turn(-TURN);
        else if (event.key === "ArrowRight") turn(TURN);
        else if (event.key === "Home") resetFrame();
        else if (canZoom && (event.key === "+" || event.key === "=")) changeZoom(1);
        else if (canZoom && event.key === "-") changeZoom(-1);
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
      {status === "fallback" && <ChanvrierAvatar profile={profile} className={styles.stageCanvas} view={view === "portrait" ? "portrait" : "full"} expression={expression} />}
      {ready && (view === "village" || activeWalk) && <p className={styles.stageMode}>
        {view === "village" ? "Échelle en jeu" : null}{view === "village" && activeWalk ? " · " : null}{activeWalk ? "En marche" : null}
      </p>}
      {ready && view !== "village" && <div className={styles.zoomControls} role="group" aria-label="Zoom du personnage" onPointerDown={event => event.stopPropagation()}>
        <button type="button" aria-label="Dézoomer" title="Dézoomer" disabled={!canZoom} aria-disabled={zoomStep === 0 || undefined} onClick={() => changeZoom(-1)}><ZoomOut size={17} aria-hidden="true" /></button>
        <span className={styles.zoomLevel} aria-live="polite">{Math.round(zoom * 100)} %</span>
        <button type="button" aria-label="Zoomer" title="Zoomer" disabled={!canZoom} aria-disabled={zoomStep === ZOOM.length - 1 || undefined} onClick={() => changeZoom(1)}><ZoomIn size={17} aria-hidden="true" /></button>
      </div>}
    </div>
    <div className={styles.previewTools}>
      <div className={styles.viewControls} role="group" aria-label="Cadrage du personnage">
        {VIEWS.map(({ code, label, title }) => <button key={code} type="button" aria-label={title} title={title} aria-pressed={view === code} disabled={disabled || (code === "village" && !ready)} onClick={() => changeView(code)}>{label}</button>)}
      </div>
      <div className={styles.rotationControls} role="group" aria-label="Orientation du personnage">
        {frameControls.map(({ Icon, label, action, inactive }) => <button key={label} type="button" title={label} aria-label={label} aria-disabled={inactive || undefined} disabled={disabled || !ready} onClick={inactive ? undefined : action}><Icon size={18} aria-hidden="true" /></button>)}
      </div>
      <button type="button" className={styles.walkButton} disabled={disabled || !ready} aria-label={walking ? "Au repos" : "Faire marcher"} aria-pressed={walking} title={walking ? "Au repos" : "Faire marcher"} onClick={toggleWalking}><Footprints size={17} aria-hidden="true" /><span>{walking ? "Au repos" : "Faire marcher"}</span></button>
    </div>
    <p id={instructions} className={styles.stageHint} data-notice={status === "fallback" || undefined} role="status">{status === "fallback" ? "3D indisponible · aperçu fixe" : "Glisse ou utilise les flèches pour tourner. + et − pour zoomer. Origine pour recentrer."}</p>
  </aside>;
}
