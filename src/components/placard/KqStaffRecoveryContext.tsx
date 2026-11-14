"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { KqStaffRecoveryStorage } from "@/lib/kanab-quest-staff-recovery";
import type { KqTutorialApi } from "./KqTutorialApiContext";

const OwnerContext = createContext<string | undefined>(undefined);
/** The server supplies this identity. The POST also checks it against the current session. */
export function KqStaffRecoveryProvider({ ownerId, children }: { ownerId?: string; children: ReactNode }) {
  return <OwnerContext.Provider value={ownerId}>{children}</OwnerContext.Provider>;
}
export const useKqStaffRecoveryOwner = () => useContext(OwnerContext);

const lessons = new WeakMap<KqTutorialApi, Map<string, string>>();
/** A lesson's attempts survive its screen changes, never its API instance or the real account. */
export function kqStaffRecoveryStorage(api: KqTutorialApi): KqStaffRecoveryStorage {
  if (!api.isTutorial) return window.localStorage;
  let saved = lessons.get(api);
  if (!saved) { saved = new Map(); lessons.set(api, saved); }
  return { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value); }, removeItem: key => { saved.delete(key); } };
}
