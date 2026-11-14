"use client";

import { useEffect, useId, useRef } from "react";
import type { gsap } from "gsap";
import type { PlacardMapBuildingId } from "./KqPlacardMap.geometry";
import { MAP_ENTRANCES, MAP_SCENERY } from "./KqPlacardMap.scene";
import sprites from "./KqPlacardMap.sprites.json";
import { KqPlacardMapScenery } from "./KqPlacardMapScenery";
import styles from "./KqPlacardMapAtmosphere.module.css";

type Props = {
  paused: boolean;
  motionOverride: boolean;
  culture: boolean;
  market: boolean;
  jury: boolean;
  focusBuilding: PlacardMapBuildingId | null;
  reaction?: { building: PlacardMapBuildingId; sequence: number };
};

const WATER_GLINTS = [
  "M491 110q10-2 21-1", "M1035 132q15-4 32-1", "M1245 119q12-3 25-1", "M1457 166q15-4 30-1",
  "M1438 777q15-7 28-12", "M1144 891q15-7 29-10", "M952 974q17-5 35-7",
] as const;

/** Decoration only: the map's HTML buttons, camera and game state remain authoritative. */
export function KqPlacardMapAtmosphere({ paused, motionOverride, culture, market, jury, focusBuilding, reaction }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const motionOverrideRef = useRef(motionOverride);
  const focusRef = useRef(focusBuilding);
  const reactionRef = useRef(reaction);
  const reactionTarget = useRef<string | null>(focusBuilding);
  const controller = useRef<{ sync: () => void; react: () => void } | null>(null);
  const lightId = `map-atmosphere-${useId().replace(/:/g, "")}`;
  const entrance = focusBuilding ? MAP_ENTRANCES[focusBuilding] : null;

  useEffect(() => {
    const changedFocus = focusRef.current !== focusBuilding;
    const requested = reactionRef.current !== reaction;
    if (requested) reactionTarget.current = reaction?.building ?? focusBuilding;
    else if (changedFocus) reactionTarget.current = focusBuilding;
    pausedRef.current = paused;
    motionOverrideRef.current = motionOverride;
    focusRef.current = focusBuilding;
    reactionRef.current = reaction;
    controller.current?.sync();
    if (changedFocus || requested) controller.current?.react();
  }, [paused, motionOverride, focusBuilding, reaction]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let inView = typeof IntersectionObserver === "undefined";
    let loading = false;
    let unavailable = false;
    let context: gsap.Context | null = null;
    let runtime: typeof gsap | null = null;
    let intent: gsap.core.Tween | null = null;
    const reactions = new Map<string, gsap.core.Timeline>();
    let lastReaction: gsap.core.Timeline | undefined;
    const animations: gsap.core.Animation[] = [];
    const reduced = () => media.matches && !motionOverrideRef.current;
    const canRun = () => !disposed && !pausedRef.current && !reduced() && !document.hidden && inView;

    function react() {
      intent?.progress(1).pause();
      lastReaction?.progress(1).pause();
      if (!canRun() || !runtime || !context) return;
      const target = reactionTarget.current;
      lastReaction = target ? reactions.get(target) : undefined;
      lastReaction?.restart();
      if (!focusRef.current) return;
      intent?.restart();
    }

    function sync() {
      if (disposed) return;
      const state = reduced() ? "reduced" : pausedRef.current ? "paused" : document.hidden ? "hidden"
        : !inView ? "offscreen" : unavailable ? "unavailable" : runtime ? "running" : "loading";
      element!.dataset.motionState = state;
      const running = canRun();
      for (const animation of animations) animation.paused(!running);
      if (running && lastReaction && lastReaction.progress() < 1) lastReaction.resume();
      if (!running) intent?.progress(1).pause();
      if (!running) lastReaction?.pause();
      if (!running || loading || runtime || unavailable) return;
      loading = true;
      // The original painting remains usable if the optional animation chunk cannot load.
      void import("gsap").then(module => {
        if (disposed) return;
        runtime = module.gsap;
        context = runtime.context(() => {
          intent = module.gsap.fromTo(element!.querySelector("[data-doorway-intent]"),
            { opacity: .65, scaleX: .78, transformOrigin: "50% 50%" },
            { opacity: 0, scaleX: 1.14, duration: .65, ease: "power2.out", paused: true, immediateRender: false });
          for (const piece of MAP_SCENERY) {
            const art = element!.querySelector(`[data-scenery-motion="${piece.id}"]`);
            if (!art) continue;
            const pivot = art.getAttribute("data-scenery-origin")!;
            const movement = piece.id === "flag" ? "skewY" : piece.building === "warehouse" ? "skewX" : "rotation";
            module.gsap.set(art, { transformOrigin: pivot });
            if (piece.building === "missions") {
              // A gust lifts the pinned corners, then leaves a long quiet interval.
              animations.push(module.gsap.timeline({ paused: true, repeat: -1, repeatDelay: 11.7, delay: piece.delay })
                .to(art, { rotation: piece.amplitude, duration: .55, ease: "power2.out" })
                .to(art, { rotation: -piece.amplitude * .6, duration: .8, ease: "sine.inOut" })
                .to(art, { rotation: 0, duration: 1.1, ease: "sine.out" }));
            } else {
              animations.push(module.gsap.fromTo(art, { [movement]: -piece.amplitude },
                { [movement]: piece.amplitude, duration: piece.duration, delay: piece.delay, repeat: -1, yoyo: true, ease: "sine.inOut", paused: true }));
            }
            const parent = art.parentElement!;
            module.gsap.set(parent, { transformOrigin: pivot });
            let greeting = reactions.get(piece.building);
            if (!greeting) { greeting = module.gsap.timeline({ paused: true }); reactions.set(piece.building, greeting); }
            greeting.to(parent, { [movement]: piece.amplitude * (piece.building === "warehouse" ? .6 : 1.9), duration: .18, ease: "power2.out" }, 0)
              .to(parent, { [movement]: -piece.amplitude * .9, duration: .3, ease: "sine.inOut" }, .18)
              .to(parent, { [movement]: 0, duration: .65, ease: "elastic.out(1, .5)" }, .48);
          }
          element!.querySelectorAll("[data-water-glint]").forEach((glint, index) => {
            animations.push(module.gsap.fromTo(glint,
              { opacity: .18, x: 0, y: 0 },
              { opacity: .72, x: index < 4 ? 9 : -7, y: index < 4 ? 0 : 3,
                duration: 2.8 + index * .35, delay: index * .31, repeat: -1, yoyo: true,
                ease: "sine.inOut", paused: true }));
          });
          element!.querySelectorAll("[data-activity-glow]").forEach((light, index) => {
            animations.push(module.gsap.fromTo(light, { opacity: .12 },
              { opacity: .33, duration: 3.2 + index * .6, repeat: -1, yoyo: true, ease: "sine.inOut", paused: true }));
          });
          element!.querySelectorAll("[data-smoke-puff]").forEach((puff, index) => {
            const breath = module.gsap.timeline({ paused: true, repeat: -1, delay: index % 3 * 1.7 });
            breath.fromTo(puff, { x: 0, y: 0, scale: .35, opacity: 0, transformOrigin: "50% 50%" },
              { x: index < 3 ? 24 : 17, y: -72, scale: 1.65, duration: index < 3 ? 5.2 : 5.85, ease: "sine.out" }, 0)
              .to(puff, { opacity: .6, duration: 1.3, ease: "sine.inOut" }, 0)
              .to(puff, { opacity: 0, duration: 2.2, ease: "sine.in" }, 3);
            // Pre-roll separates the puffs and makes the breeze visible on arrival.
            breath.totalTime(index % 3 * 1.7 + (index < 3 ? .5 : 1.35)).pause();
            animations.push(breath);
          });
          const gull = element!.querySelector("[data-gull-flight]");
          const passage = module.gsap.timeline({ paused: true, repeat: -1, repeatDelay: 18.7, delay: 3 });
          passage.fromTo(gull, { x: 995, y: 69, opacity: 0, scale: 1.35 },
            { x: 1470, y: 39, duration: 10, ease: "sine.inOut" }, 0)
            .to(gull, { opacity: 1, duration: .8 }, .2)
            .to(gull, { opacity: 0, duration: 1.2 }, 8.8);
          for (const [index, wing] of [...element!.querySelectorAll("[data-gull-wing]")].entries()) {
            passage.fromTo(wing, { rotation: index ? 12 : -12, svgOrigin: "0 2" },
              { rotation: index ? -22 : 22, duration: .32, yoyo: true, repeat: 7, ease: "sine.inOut" }, .2);
            passage.to(wing, { rotation: 0, duration: .7, ease: "sine.out" }, 2.8);
          }
          animations.push(passage);
        }, element!);
        sync();
        react();
      }).catch(() => {
        if (disposed) return;
        context?.revert();
        context = null;
        runtime = null;
        unavailable = true;
        sync();
      });
    }

    controller.current = { sync, react };
    // Asset failure leaves the complete original illustration usable.
    const backing = new window.Image();
    const showScenery = () => {
      if (!disposed && backing.naturalWidth > 0) element.dataset.sceneryReady = "true";
    };
    backing.onload = showScenery;
    backing.onerror = () => { if (!disposed) delete element.dataset.sceneryReady; };
    backing.src = sprites.asset;
    // A loaded image is usable even when an iOS decode() promise rejects.
    if (backing.complete) showScenery();
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0);
      sync();
    }, { threshold: 0 });
    observer?.observe(element);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true;
      controller.current = null;
      backing.onload = backing.onerror = null;
      observer?.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      context?.revert();
    };
  }, [culture, market, jury]);

  return <div ref={root} className={styles.atmosphere} aria-hidden="true"
    data-map-atmosphere data-motion-state="static" data-motion-override={motionOverride || undefined}>
    <KqPlacardMapScenery />
    <svg className={styles.effects} viewBox="0 0 1536 1024" focusable="false">
    <defs>
      <radialGradient id={lightId}>
        <stop offset="0" stopColor="#ffe7a0" stopOpacity=".9" />
        <stop offset=".5" stopColor="#f6c456" stopOpacity=".4" />
        <stop offset="1" stopColor="#f6c456" stopOpacity="0" />
      </radialGradient>
    </defs>
    {[[1156, 101], [690, 597]].map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`}>
      {[0, 1, 2].map(index => <g key={index} className={styles.smoke} data-smoke-puff>
        <path d="M-9 1C-17-1-15-10-9-11C-11-19 1-22 6-16C15-20 22-10 16-5C21 3 10 7 4 4C-3 10-12 8-9 1Z" fill="#f8ebce" stroke="#6e7969" strokeWidth="1.3" />
      </g>)}
    </g>)}
    <g className={styles.water} fill="none" stroke="#fff7da" strokeWidth="3" strokeLinecap="round">
      {WATER_GLINTS.map(path => <path key={path} d={path} data-water-glint />)}
    </g>
    <g className={styles.gull} data-gull-flight>
      <g data-gull-wing><path d="M0 2Q-10-10-21-4Q-10-4-1 6Z" fill="#fff7e3" stroke="#334b43" strokeWidth="1.4" strokeLinejoin="round" /></g>
      <g data-gull-wing><path d="M-1 2Q9-10 21-6Q12-5 1 6Z" fill="#fff7e3" stroke="#334b43" strokeWidth="1.4" strokeLinejoin="round" /></g>
      <path d="M-3 3Q0 0 4 2L7 3L3 5L-1 7Z" fill="#fff7e3" stroke="#334b43" strokeWidth="1.2" />
    </g>
    {culture ? <g className={styles.activityGlow} data-activity-glow="culture" fill={`url(#${lightId})`}>
      <ellipse cx="365" cy="216" rx="39" ry="30" /><ellipse cx="365" cy="264" rx="65" ry="48" />
    </g> : null}
    {market ? <g className={styles.activityGlow} data-activity-glow="market" fill={`url(#${lightId})`}>
      <ellipse cx="229" cy="516" rx="46" ry="28" />
    </g> : null}
    {jury ? <g className={styles.activityGlow} data-activity-glow="jury" fill={`url(#${lightId})`}>
      <ellipse cx="1198" cy="579" rx="24" ry="30" /><ellipse cx="1383" cy="579" rx="24" ry="30" />
    </g> : null}
    <g transform={entrance ? `translate(${entrance[0]} ${entrance[1]})` : undefined} data-intent-building={focusBuilding ?? undefined}>
      <g className={styles.intent} data-doorway-intent>
        <ellipse rx="29" ry="6" fill="#ffe5a0" opacity=".55" />
        <path d="M-29 0Q0 11 29 0" fill="none" stroke="#fff3c4" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
    </svg>
  </div>;
}
