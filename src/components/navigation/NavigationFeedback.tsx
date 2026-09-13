"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { Hourglass } from "lucide-react";
import styles from "./NavigationFeedback.module.css";

const NavigationContext = createContext<{ register: (id: string, active: boolean) => void; navigate: (action: () => void) => void }>({
  register: () => {},
  navigate: (action: () => void) => action(),
});

export function NavigationFeedbackProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const register = useCallback((id: string, active: boolean) => {
    setSources(previous => {
      if (previous.has(id) === active) return previous;
      const next = new Set(previous);
      if (active) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ register, navigate: startTransition }), [register, startTransition]);
  return <NavigationContext.Provider value={value}>
    {children}
    <div className={styles.indicator} role="status" aria-live="polite" aria-atomic="true" data-navigation-pending={pending || sources.size > 0 || undefined}>
      {pending || sources.size > 0 ? <><Hourglass aria-hidden="true" /><span>Chargement de la page…</span></> : null}
    </div>
  </NavigationContext.Provider>;
}

/** Registers both Link transitions and streamed route loading fallbacks. */
export function NavigationPending({ active = true }: { active?: boolean }) {
  const id = useId();
  const { register } = useContext(NavigationContext);
  useEffect(() => {
    if (!active) return;
    register(id, true);
    return () => register(id, false);
  }, [active, id, register]);
  return null;
}

/** Button-driven navigations share the same real React transition as links. */
export function useRouter() {
  const router = useNextRouter();
  const { navigate } = useContext(NavigationContext);
  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => navigate(() => router.push(...args)),
    replace: (...args: Parameters<typeof router.replace>) => navigate(() => router.replace(...args)),
    back: () => navigate(() => router.back()),
    forward: () => navigate(() => router.forward()),
    refresh: () => navigate(() => router.refresh()),
  }), [router, navigate]);
}
