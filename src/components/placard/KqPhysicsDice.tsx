"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { createKqDiceTable } from "./kq-dice-table";
import styles from "./KanabQuestDicePrototype.module.css";

export type KqDiceMotionPhase = "idle" | "preparing" | "rolling" | "settling";
export type KqDiceTableStatus = "loading" | "ready" | "error";
type DiceTable = ReturnType<typeof createKqDiceTable>;
const restingFaces = [2, 3, 5];

export type KqPhysicsDiceHandle = {
  gather: (fast: boolean) => void;
  rest: () => void;
  roll: (values: number[], onPhase?: (phase: KqDiceMotionPhase) => void, fast?: boolean, signal?: AbortSignal) => Promise<boolean>;
  sync: (values: number[], animate?: boolean) => Promise<boolean>;
  reveal: (values: number[]) => boolean;
  finish: () => void;
};

export const KqPhysicsDice = forwardRef<KqPhysicsDiceHandle, { onStatusChange?: (status: KqDiceTableStatus) => void }>(
  function KqPhysicsDice({ onStatusChange }, ref) {
    const stage = useRef<HTMLDivElement>(null);
    const table = useRef<DiceTable | null>(null);
    const loading = useRef<Promise<DiceTable | null> | null>(null);
    const pendingGather = useRef<boolean | null>(null);
    const [status, setStatus] = useState<KqDiceTableStatus>("loading");
    useEffect(() => {
      const element = stage.current!;
      let active = true;
      function unavailable() {
        if (!active) return;
        setStatus("error");
        onStatusChange?.("error");
        pendingGather.current = null;
        loading.current = null;
        table.current?.dispose();
        table.current = null;
      }
      const finishHidden = () => { if (document.hidden) table.current?.finish(); };
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const motionChanged = () => { if (media.matches) table.current?.finish(); };
      element.addEventListener("webglcontextlost", unavailable, true);
      document.addEventListener("visibilitychange", finishHidden);
      media.addEventListener("change", motionChanged);
      loading.current = import("./kq-dice-table").then(async ({ createKqDiceTable }) => {
        if (!active) return null;
        const created = createKqDiceTable(element);
        table.current = created;
        await created.sync(restingFaces, false);
        if (!active || created !== table.current) return null;
        if (pendingGather.current !== null && !document.hidden && !media.matches) created.gather(pendingGather.current);
        pendingGather.current = null;
        setStatus("ready");
        onStatusChange?.("ready");
        return created;
      }).catch(() => {
        unavailable();
        return null;
      });
      return () => {
        active = false;
        element.removeEventListener("webglcontextlost", unavailable, true);
        document.removeEventListener("visibilitychange", finishHidden);
        media.removeEventListener("change", motionChanged);
        table.current?.dispose();
        table.current = null;
        loading.current = null;
        pendingGather.current = null;
        onStatusChange?.("loading");
      };
    }, [onStatusChange]);
    useImperativeHandle(ref, () => ({
      gather: fast => {
        if (table.current) table.current.gather(fast);
        else pendingGather.current = fast;
      },
      rest: () => {
        pendingGather.current = null;
        void table.current?.sync(restingFaces, false);
      },
      roll: async (values, phase, fast, signal) => {
        const ready = table.current ?? await loading.current;
        if (!ready || ready !== table.current || signal?.aborted) return false;
        return ready.roll(values, phase, fast);
      },
      sync: (values, animate) => table.current?.sync(values, animate) ?? Promise.resolve(false),
      reveal: values => table.current?.reveal(values) ?? false,
      finish: () => {
        pendingGather.current = null;
        table.current?.finish();
      },
    }), []);
    return <div id="kq-physics-dice-stage" ref={stage} className={styles.physicsDiceStage} data-status={status} aria-hidden="true" />;
  },
);
