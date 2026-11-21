"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import Image from "next/image";
import type { createKqTrimRoomRenderer, KqTrimRoomActor } from "./KqTrimRoomRenderer";
import board from "./KqWarehousePilotage.module.css";
import styles from "./KqTrimScene.module.css";

export function KqTrimWorld({ actors, mode, motion, viewportRef }: {
  actors: readonly KqTrimRoomActor[];
  mode: "manual" | "machine" | "mixed";
  motion: boolean;
  viewportRef: Ref<HTMLDivElement>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createKqTrimRoomRenderer> | null>(null);
  const current = useRef({ actors, motion });
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    current.current = { actors, motion };
    renderer.current?.update(actors, motion);
  }, [actors, motion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    import("./KqTrimRoomRenderer").then(({ createKqTrimRoomRenderer }) => {
      if (cancelled) return;
      const room = createKqTrimRoomRenderer(canvas, () => setState("fallback"));
      renderer.current = room;
      room.update(current.current.actors, current.current.motion);
      setState("ready");
    }).catch(() => {
      if (cancelled) return;
      renderer.current?.dispose();
      renderer.current = null;
      setState("fallback");
    });
    return () => {
      cancelled = true;
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, []);

  return <div ref={viewportRef} className={`${board.sceneFrame} ${styles.frame}`} data-trim-renderer={state} aria-hidden="true">
    <div className={styles.stage}>
      {state !== "ready" ? <Image className={styles.still} src={`/placard/atelier-motion/trim-${mode}-iso-v1.webp`} fill unoptimized alt="" draggable={false} /> : null}
      <canvas ref={canvasRef} className={styles.canvas} data-trim-canvas />
    </div>
  </div>;
}
