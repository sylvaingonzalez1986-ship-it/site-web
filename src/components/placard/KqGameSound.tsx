"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createKqSoundController, type KqSoundCue } from "@/lib/kanab-quest-sound";

export type { KqSoundCue } from "@/lib/kanab-quest-sound";

type GameSound = {
  enabled: boolean;
  toggle: () => void;
  playNavigation: (frequency: number) => void;
  playOnce: (cue: KqSoundCue, id: string) => void;
};
const SILENT: GameSound = { enabled: false, toggle() {}, playNavigation() {}, playOnce() {} };
const SoundContext = createContext<GameSound | null>(null);

/** Standalone previews share the shell's context when one is already present. */
export function KqGameSoundProvider({ children }: { children: ReactNode }) {
  const inherited = useContext(SoundContext);
  return inherited ? children : <SoundSession>{children}</SoundSession>;
}

function SoundSession({ children }: { children: ReactNode }) {
  const controller = useRef<ReturnType<typeof createKqSoundController> | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const current = createKqSoundController({ onEnabledChange: setEnabled });
    controller.current = current;
    const visibility = () => { if (document.hidden) current.hide(); };
    const pagehide = () => current.hide();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    return () => {
      controller.current = null;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      current.dispose();
    };
  }, []);

  const toggle = useCallback(() => controller.current?.toggle(), []);
  const playNavigation = useCallback((frequency: number) => controller.current?.playNavigation(frequency), []);
  const playOnce = useCallback((cue: KqSoundCue, id: string) => controller.current?.playOnce(cue, id), []);
  const sound = useMemo(() => ({ enabled, toggle, playNavigation, playOnce }), [enabled, toggle, playNavigation, playOnce]);
  return <SoundContext.Provider value={sound}>{children}</SoundContext.Provider>;
}

export function useKqGameSound() {
  return useContext(SoundContext) ?? SILENT;
}
