"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Optional local UI feedback only. No audio exists before the user enables it. */
export function useArenaMenuSound() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const lastPlayed = useRef(0);

  useEffect(() => () => {
    const audio = context.current;
    context.current = null;
    if (audio && audio.state !== "closed") void audio.close().catch(() => {});
  }, []);

  const play = useCallback((frequency: number) => {
    const audio = context.current;
    if (!enabled || !audio || audio.state !== "running" || performance.now() - lastPlayed.current < 90) return;
    lastPlayed.current = performance.now();
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, audio.currentTime + 0.065);
    volume.gain.setValueAtTime(0.0001, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.025, audio.currentTime + 0.01);
    volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.09);
    oscillator.connect(volume);
    volume.connect(audio.destination);
    oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.1);
  }, [enabled]);

  const toggle = useCallback(() => {
    if (enabled) {
      setEnabled(false);
      void context.current?.suspend().catch(() => {});
      return;
    }
    try {
      if (!context.current) context.current = new AudioContext();
      const audio = context.current;
      // Resume inside the explicit click gesture. Failure leaves the menu fully usable.
      void audio.resume().then(() => setEnabled(audio.state === "running")).catch(() => setEnabled(false));
    } catch {
      setEnabled(false);
    }
  }, [enabled]);

  return { enabled, toggle, play };
}
