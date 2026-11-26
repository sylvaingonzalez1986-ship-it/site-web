"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { shopCardId, shopResultsHref, type ShopOrigin } from "@/lib/shop-origin";

export type ShopProductControl = "title" | "view" | "format" | "reviews";

const SNAPSHOTS = "lcbShopResultsSnapshots";
const ENTRY_SNAPSHOT = "lcbShopResultsSnapshot";
const CARD_PREFIX = "shop-card-";
const PANEL_SCROLL_SELECTOR = "[data-shop-scroll-container], [data-app-dialog-body]";
const CONTROL_SELECTOR = "[data-shop-product-control]";
export const REGION_RESULTS_ID = "boutique-resultats-region";

type Snapshot = {
  id: string;
  source: string;
  results: string;
  cardId: string;
  control: ShopProductControl;
  inPanel: boolean;
  offset: number;
  pageY: number;
};

function resultsUrl(url: URL) {
  const search = new URLSearchParams(url.search);
  search.delete("resume");
  search.sort();
  return `${url.pathname}?${search}`;
}

function readSnapshots(): Snapshot[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SNAPSHOTS) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveShopResults(control: HTMLAnchorElement, origin: ShopOrigin, name: ShopProductControl): string | undefined {
  if (!globalThis.crypto?.randomUUID) return;
  const id = crypto.randomUUID();
  const cardId = shopCardId(origin);
  const source = new URL(window.location.href);
  if (source.hash.startsWith(`#${CARD_PREFIX}`)) {
    // Keep shared or reloaded list URLs aligned with the latest departure from this entry.
    source.hash = cardId;
    source.searchParams.set("resume", id);
  }
  const container = control.closest<HTMLElement>(PANEL_SCROLL_SELECTOR);
  const snapshot: Snapshot = {
    id,
    source: source.href,
    results: resultsUrl(new URL(shopResultsHref(origin), window.location.origin)),
    cardId,
    control: name,
    inPanel: !!container,
    offset: control.getBoundingClientRect().top - (container?.getBoundingClientRect().top ?? 0),
    pageY: window.scrollY,
  };
  try {
    // Retain the App Router's state for native Back and Forward navigation.
    window.history.replaceState({ ...window.history.state, [ENTRY_SNAPSHOT]: snapshot }, "", source.href);
    sessionStorage.setItem(SNAPSHOTS, JSON.stringify([snapshot, ...readSnapshots().slice(0, 23)]));
    return id;
  } catch {
    return undefined;
  }
}

function restoreRequest() {
  const url = new URL(window.location.href);
  const cardHash = url.hash.startsWith(`#${CARD_PREFIX}`) ? url.hash.slice(1) : undefined;
  const resume = url.searchParams.get("resume");
  const historySnapshot: Snapshot | undefined = window.history.state?.[ENTRY_SNAPSHOT];
  const explicit = cardHash && resume && readSnapshots().find(snapshot => snapshot.id === resume
    && snapshot.cardId === cardHash && snapshot.results === resultsUrl(url));
  const snapshot = (historySnapshot?.source === url.href ? historySnapshot : undefined) ?? (explicit || undefined);
  const cardId = snapshot?.cardId ?? cardHash;
  return cardId ? { cardId, snapshot } : undefined;
}

export function hasShopResultsRestore() {
  return Boolean(restoreRequest());
}

function positionControl(control: HTMLElement, snapshot?: Snapshot) {
  const container = control.closest<HTMLElement>(PANEL_SCROLL_SELECTOR);
  const previousPosition = snapshot && snapshot.inPanel === Boolean(container) ? snapshot.offset : undefined;
  const minimum = container
    ? 12
    : (document.querySelector("header[data-tutorial='navbar']")?.getBoundingClientRect().height ?? 0) + 12;
  const height = container?.clientHeight ?? window.innerHeight;
  const wanted = Math.min(Math.max(minimum, previousPosition ?? minimum), Math.max(minimum, height - 48));
  const relativeTop = control.getBoundingClientRect().top - (container?.getBoundingClientRect().top ?? 0);
  if (Math.abs(relativeTop - wanted) > 2) {
    if (container) container.scrollBy({ top: relativeTop - wanted, behavior: "instant" });
    else window.scrollBy({ top: relativeTop - wanted, behavior: "instant" });
  }
  control.focus({ preventScroll: true });
}

function restoreCard(request: NonNullable<ReturnType<typeof restoreRequest>>, panelOnly = false) {
  const card = document.getElementById(request.cardId);
  const control = card?.querySelector<HTMLElement>(request.snapshot
    ? `[data-shop-product-control="${request.snapshot.control}"]`
    : '[data-shop-product-control="title"]') ?? card?.querySelector<HTMLElement>(CONTROL_SELECTOR);
  if (!control || control.closest("dialog:not([open])")) return;

  const panel = control.closest<HTMLElement>(PANEL_SCROLL_SELECTOR);
  if ((panelOnly && !panel) || (panel && panel.clientHeight === 0)) return;
  if (request.snapshot?.control === "reviews") {
    const details = control.closest("details");
    if (details) details.open = true;
  }
  if (!control.getClientRects().length) return;

  if (request.snapshot?.inPanel && Math.abs(window.scrollY - request.snapshot.pageY) > 2) {
    window.scrollTo({ top: request.snapshot.pageY, behavior: "instant" });
  }
  positionControl(control, request.snapshot);
  return control;
}

export function restoreShopPanelBeforePaint() {
  const request = restoreRequest();
  if (request) restoreCard(request, true);
}

export function focusShopResults(id: string): boolean {
  const heading = document.getElementById(id);
  if (!heading?.getClientRects().length) return false;
  positionControl(heading);
  return true;
}

export function ShopResultsRestore() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    let frame = 0;
    let start = 0;
    const cancel = () => cancelAnimationFrame(frame);
    const schedule = () => {
      cancel();
      const request = restoreRequest();
      if (!request) return;
      start = performance.now();

      const apply = () => {
        const control = restoreCard(request);
        if (control) {
          frame = requestAnimationFrame(() => {
            if (document.activeElement === document.body && control.isConnected) control.focus({ preventScroll: true });
          });
          return;
        }
        if (performance.now() - start < 1400) {
          frame = requestAnimationFrame(apply);
          return;
        }
        const heading = document.querySelector<HTMLElement>("dialog[open] [data-shop-panel-results]")
          ?? document.querySelector<HTMLElement>("[data-shop-panel-results]")
          ?? document.getElementById("boutique-resultats");
        if (heading) positionControl(heading);
      };

      // Give the browser and Next their initial scroll before correcting a stale position.
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(apply); });
    };

    const interactions = ["pointerdown", "keydown", "wheel", "touchstart"];
    for (const interaction of interactions) window.addEventListener(interaction, cancel, { capture: true, passive: true });
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
    schedule();
    return () => {
      cancel();
      for (const interaction of interactions) window.removeEventListener(interaction, cancel, true);
      window.removeEventListener("popstate", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [pathname, search]);

  return null;
}
