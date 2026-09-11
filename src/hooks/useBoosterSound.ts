"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Local synthesis, created only after an explicit sound toggle. */
export function useBoosterSound() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const last = useRef(0);
  useEffect(() => () => { const audio = context.current; context.current = null; if (audio && audio.state !== "closed") void audio.close().catch(() => {}); }, []);
  const toggle = useCallback(() => {
    if (enabled) { setEnabled(false); void context.current?.suspend().catch(() => {}); return; }
    try {
      const audio = context.current ?? new AudioContext(); context.current = audio;
      void audio.resume().then(() => setEnabled(audio.state === "running")).catch(() => setEnabled(false));
    } catch { setEnabled(false); }
  }, [enabled]);
  const play = useCallback((frequency: number) => {
    const audio = context.current;
    if (!enabled || !audio || audio.state !== "running" || performance.now() - last.current < 100) return;
    last.current = performance.now();
    const opening = frequency < 300;
    const notes = opening ? [1, 1.5, 2] : frequency >= 550 ? [1, 1.25, 1.5, 2] : [1, 1.5, 2];
    for (const [index, ratio] of notes.entries()) {
      const tone = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + index * (opening ? .13 : .08), duration = opening ? .45 : .75;
      tone.type = opening ? "triangle" : "sine";
      tone.frequency.setValueAtTime(frequency * ratio, start);
      if (opening) tone.frequency.exponentialRampToValueAtTime(frequency * ratio * 1.4, start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.035 / notes.length, start + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      tone.connect(gain); gain.connect(audio.destination);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(start); tone.stop(start + duration);
    }
  }, [enabled]);
  return { enabled, toggle, play };
}
