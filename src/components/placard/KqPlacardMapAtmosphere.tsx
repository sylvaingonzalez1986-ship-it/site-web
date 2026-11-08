"use client";

import { useEffect, useId, useRef } from "react";
import type { gsap } from "gsap";
import type { PlacardMapBuildingId } from "./KqPlacardMap.geometry";
import styles from "./KqPlacardMapAtmosphere.module.css";

type Props = {
  paused: boolean;
  culture: boolean;
  market: boolean;
  jury: boolean;
  focusBuilding: PlacardMapBuildingId | null;
};

// Thresholds in the original 1536 × 1024 painting; never move its scenery crops.
const ENTRANCES: Record<PlacardMapBuildingId, readonly [number, number]> = {
  warehouse: [365, 326], bank: [799, 278], office: [1178, 375],
  market: [264, 604], shop: [714, 871], arena: [1244, 696],
  missions: [752, 515], collection: [429, 892],
};

const WATER_GLINTS = [
  "M491 110q10-2 21-1", "M1035 132q15-4 32-1", "M1245 119q12-3 25-1", "M1457 166q15-4 30-1",
  "M1438 777q15-7 28-12", "M1144 891q15-7 29-10", "M952 974q17-5 35-7",
] as const;

/** Decoration only: the map's HTML buttons, camera and game state remain authoritative. */
export function KqPlacardMapAtmosphere({ paused, culture, market, jury, focusBuilding }: Props) {
  const root = useRef<SVGSVGElement>(null);
  const pausedRef = useRef(paused);
  const focusRef = useRef(focusBuilding);
  const controller = useRef<{ sync: () => void; react: () => void } | null>(null);
  const lightId = `map-atmosphere-${useId().replace(/:/g, "")}`;
  const entrance = focusBuilding ? ENTRANCES[focusBuilding] : null;

  useEffect(() => {
    const changedFocus = focusRef.current !== focusBuilding;
    pausedRef.current = paused;
    focusRef.current = focusBuilding;
    controller.current?.sync();
    if (changedFocus) controller.current?.react();
  }, [paused, focusBuilding]);

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
    const animations: gsap.core.Animation[] = [];
    const canRun = () => !disposed && !pausedRef.current && !media.matches && !document.hidden && inView;

    function react() {
      intent?.progress(1).pause();
      if (!canRun() || !focusRef.current || !runtime || !context) return;
      const light = element!.querySelector("[data-doorway-intent]");
      if (!light) return;
      // Added to this component's context even when invoked by a later focus event.
      context.add(() => {
        intent = runtime!.fromTo(light,
          { opacity: .65, scaleX: .78, transformOrigin: "50% 50%" },
          { opacity: 0, scaleX: 1.14, duration: .65, ease: "power2.out", overwrite: true });
      });
    }

    function sync() {
      if (disposed) return;
      const state = media.matches ? "reduced" : pausedRef.current ? "paused" : document.hidden ? "hidden"
        : !inView ? "offscreen" : unavailable ? "unavailable" : runtime ? "running" : "loading";
      element!.dataset.motionState = state;
      const running = canRun();
      for (const animation of animations) animation.paused(!running);
      if (!running) intent?.progress(1).pause();
      if (!running || loading || runtime || unavailable) return;
      loading = true;
      // The static SVG remains usable if the optional animation chunk cannot load.
      void import("gsap").then(module => {
        if (disposed) return;
        runtime = module.gsap;
        context = runtime.context(() => {
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
          const gull = element!.querySelector("[data-gull-flight]");
          const passage = module.gsap.timeline({ paused: true, repeat: -1, repeatDelay: 8, delay: 1.2 });
          passage.fromTo(gull, { x: 1010, y: 73, opacity: 0 },
            { x: 1370, y: 46, duration: 12, ease: "sine.inOut" }, 0)
            .to(gull, { opacity: .9, duration: 1.4 }, .3)
            .to(gull, { opacity: 0, duration: 1.8 }, 9.8);
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
      observer?.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      context?.revert();
    };
  }, [culture, market, jury]);

  return <svg ref={root} className={styles.atmosphere} viewBox="0 0 1536 1024" aria-hidden="true" focusable="false"
    data-map-atmosphere data-motion-state="static">
    <defs>
      <radialGradient id={lightId}>
        <stop offset="0" stopColor="#ffe7a0" stopOpacity=".9" />
        <stop offset=".5" stopColor="#f6c456" stopOpacity=".4" />
        <stop offset="1" stopColor="#f6c456" stopOpacity="0" />
      </radialGradient>
    </defs>
    <g className={styles.water} fill="none" stroke="#fff7da" strokeWidth="3" strokeLinecap="round">
      {WATER_GLINTS.map(path => <path key={path} d={path} data-water-glint />)}
    </g>
    <g className={styles.gull} data-gull-flight>
      <path d="M-17 3Q-11-5-1 1Q6-7 17-2Q8-1 0 5Q-9 0-17 3Z" fill="#fff7e3" stroke="#334b43" strokeWidth="1.3" strokeLinejoin="round" />
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
  </svg>;
}
