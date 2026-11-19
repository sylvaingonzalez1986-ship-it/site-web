"use client";

import { useEffect, useRef } from "react";
import type { KqTournamentPlayer } from "@/lib/kanab-quest-school-tournament";
import type { QuizzShowMode } from "./world/quizzshow-set";
import type { createQuizzShowRenderer, QuizzShowDestination } from "./world/quizzshow-renderer";
import styles from "./KqQuizzShowScene.module.css";

const emptySeats: readonly (KqTournamentPlayer | null)[] = [];
const descriptions: Record<QuizzShowMode, string> = {
  hall: "La salle de QuizzShow en vue isométrique, avec quatre pupitres à buzzer, une grande bibliothèque et le tableau du classement.",
  tournament: "Le plateau du tournoi et ses quatre pupitres numérotés. Les participants sont indiqués dans la liste des places.",
  library: "La grande bibliothèque de QuizzShow en vue isométrique.",
  ranking: "Le tableau du classement dans la salle de QuizzShow.",
};

type Props = {
  mode: QuizzShowMode;
  seats?: readonly (KqTournamentPlayer | null)[];
  motion?: boolean;
  focus?: QuizzShowDestination | null;
  onChoose?: (destination: QuizzShowDestination) => void;
};

export function KqQuizzShowScene({ mode, seats = emptySeats, motion = true, focus = null, onChoose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<ReturnType<typeof createQuizzShowRenderer> | null>(null);
  const latest = useRef({ seats, motion, onChoose, focus });
  useEffect(() => {
    latest.current = { seats, motion, onChoose, focus };
    runtime.current?.update(seats, motion);
    runtime.current?.focus(focus);
  }, [seats, motion, onChoose, focus]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    let mounted = true;
    const unavailable = () => { node.dataset.live = "false"; };
    async function open(target: HTMLCanvasElement) {
      try {
        const { createQuizzShowRenderer } = await import("./world/quizzshow-renderer");
        if (!mounted) return;
        runtime.current = createQuizzShowRenderer(target, mode, {
          choose: destination => latest.current.onChoose?.(destination),
          ready: () => { target.dataset.live = "true"; },
          unavailable,
        });
        runtime.current.update(latest.current.seats, latest.current.motion);
        runtime.current.focus(latest.current.focus);
      } catch {
        unavailable();
      }
    }
    void open(node);
    return () => {
      mounted = false;
      runtime.current?.dispose();
      runtime.current = null;
      unavailable();
    };
  }, [mode]);

  return <div className={styles.frame} data-quizzshow-scene={mode} role="img" aria-label={descriptions[mode]}>
    <div className={styles.poster} style={{ backgroundImage: `url('/placard/school/isometric/${mode}.webp')` }}>
      {mode === "tournament" ? seats.map((player, index) => player &&
        <div key={index} className={styles.poster} style={{ backgroundImage: `url('/placard/school/isometric/seat-${index + 1}.webp')` }} />
      ) : null}
    </div>
    <canvas ref={canvas} aria-hidden="true" />
  </div>;
}
