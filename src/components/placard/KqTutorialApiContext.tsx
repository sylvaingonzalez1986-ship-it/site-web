"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { KqWarehouseState } from "@/lib/kanab-quest-warehouse";

export type KqTutorialApi = {
  request: typeof fetch;
  notify: (name: string, detail?: unknown) => void;
  subscribe: (names: readonly string[], listener: () => void) => () => void;
  isTutorial: boolean;
  nativeWarehouse?: boolean;
  warehouseDraftStore?: { read: (revision: number) => KqWarehouseState | null; write: (state: KqWarehouseState) => void };
  onOpenCulture?: (href: string) => void;
};

const liveApi: KqTutorialApi = {
  request: (...args) => fetch(...args),
  notify: (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail })),
  subscribe: (names, listener) => {
    names.forEach(name => window.addEventListener(name, listener));
    return () => names.forEach(name => window.removeEventListener(name, listener));
  },
  isTutorial: false,
};

const KqTutorialApiContext = createContext<KqTutorialApi>(liveApi);

/** Create once per lesson. Local notifications never reach the live page. */
export function createKqTutorialApi(request: typeof fetch, options: { nativeWarehouse?: boolean; onOpenCulture?: (href: string) => void } = {}): KqTutorialApi {
  const events = new EventTarget();
  let draft: { revision: number; state: KqWarehouseState } | null = null;
  let revision = 0;
  return {
    request,
    notify: (name, detail) => events.dispatchEvent(new CustomEvent(name, { detail })),
    subscribe: (names, listener) => {
      names.forEach(name => events.addEventListener(name, listener));
      return () => names.forEach(name => events.removeEventListener(name, listener));
    },
    isTutorial: true,
    ...options,
    ...(options.nativeWarehouse ? { warehouseDraftStore: {
      read: (nextRevision: number) => { revision = nextRevision; return draft?.revision === revision ? structuredClone(draft.state) : null; },
      write: (state: KqWarehouseState) => { draft = { revision, state: structuredClone(state) }; },
    } } : {}),
  };
}

export function KqTutorialApiProvider({ api, children }: { api: KqTutorialApi; children: ReactNode }) {
  return <KqTutorialApiContext.Provider value={api}>{children}</KqTutorialApiContext.Provider>;
}

export function useKqTutorialApi() {
  return useContext(KqTutorialApiContext);
}
