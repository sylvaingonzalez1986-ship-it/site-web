"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { createKqDiceTable } from "./kq-dice-table";
import styles from "./KanabQuestDicePrototype.module.css";

export type KqDiceMotionPhase = "idle" | "preparing" | "rolling" | "settling";
export type KqPhysicsDiceHandle = {
  roll: (values: number[], onPhase?: (phase: KqDiceMotionPhase) => void, fast?: boolean) => Promise<boolean>;
  sync: (values: number[], animate?: boolean) => Promise<boolean>;
  reveal: (values: number[]) => boolean;
  finish: () => void;
};

export const KqPhysicsDice = forwardRef<KqPhysicsDiceHandle, { onReadyChange?: (ready: boolean) => void }>(
  function KqPhysicsDice({ onReadyChange }, ref) {
    const stage = useRef<HTMLDivElement>(null);
    const table = useRef<ReturnType<typeof createKqDiceTable> | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    useEffect(() => {
      const element = stage.current!;
      let active = true;
      function unavailable() {
        if (!active) return;
        setStatus("error");
        onReadyChange?.(false);
        table.current?.dispose();
        table.current = null;
      }
      const finishHidden = () => { if (document.hidden) table.current?.finish(); };
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const motionChanged = () => { if (media.matches) table.current?.finish(); };
      element.addEventListener("webglcontextlost", unavailable, true);
      document.addEventListener("visibilitychange", finishHidden);
      media.addEventListener("change", motionChanged);
      void import("./kq-dice-table").then(({ createKqDiceTable }) => {
        if (!active) return;
        table.current = createKqDiceTable(element);
        setStatus("ready");
        onReadyChange?.(true);
      }).catch(unavailable);
      return () => {
        active = false;
        element.removeEventListener("webglcontextlost", unavailable, true);
        document.removeEventListener("visibilitychange", finishHidden);
        media.removeEventListener("change", motionChanged);
        table.current?.dispose();
        table.current = null;
        onReadyChange?.(false);
      };
    }, [onReadyChange]);
    useImperativeHandle(ref, () => ({
      roll: (values, phase, fast) => table.current?.roll(values, phase, fast) ?? Promise.resolve(false),
      sync: (values, animate) => table.current?.sync(values, animate) ?? Promise.resolve(false),
      reveal: values => table.current?.reveal(values) ?? false,
      finish: () => table.current?.finish(),
    }), []);
    return <div id="kq-physics-dice-stage" ref={stage} className={styles.physicsDiceStage} data-status={status} aria-hidden="true" />;
  },
);
