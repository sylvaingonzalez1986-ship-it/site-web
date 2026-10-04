"use client";

import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { PublicContestReview } from "@/lib/contest-public-api";

export function useContestReviewPages(initialReviews: PublicContestReview[], initialCursor: string | null | undefined, endpoint: string) {
  const snapshot = useMemo(() => JSON.stringify([endpoint, initialCursor, initialReviews]), [endpoint, initialCursor, initialReviews]);
  const initialState = { snapshot, reviews: initialReviews, nextCursor: initialCursor ?? null, loading: false, error: "" };
  const [state, setState] = useState(initialState);
  // A route refresh or another entry replaces the entire server snapshot. Never
  // merge a late page from the previous entry into its replacement.
  if (state.snapshot !== snapshot) setState(initialState);
  const active = state.snapshot === snapshot ? state : initialState;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    return () => { controller.current?.abort(); };
  }, [snapshot]);

  function setReviews(update: SetStateAction<PublicContestReview[]>) {
    setState((current) => current.snapshot === snapshot ? {
      ...current, reviews: typeof update === "function" ? update(current.reviews) : update,
    } : current);
  }

  async function loadMore() {
    if (!active.nextCursor || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch(`${endpoint}?cursor=${encodeURIComponent(active.nextCursor)}`, { signal: request.signal, cache: "no-store" });
      const payload = await response.json() as { reviews?: PublicContestReview[]; nextReviewCursor?: string | null; error?: string };
      if (!response.ok || !Array.isArray(payload.reviews)) throw new Error(payload.error ?? "Impossible de charger les avis.");
      const incoming = payload.reviews;
      setState((current) => {
        if (current.snapshot !== snapshot) return current;
        const existingIds = new Set(current.reviews.map((review) => review.id));
        return { ...current, reviews: [...current.reviews, ...incoming.filter((review) => !existingIds.has(review.id))], nextCursor: payload.nextReviewCursor ?? null };
      });
    } catch (failure) {
      if (!request.signal.aborted) setState((current) => current.snapshot === snapshot ? {
        ...current, error: failure instanceof Error ? failure.message : "Erreur réseau. Réessaie dans un instant.",
      } : current);
    } finally {
      if (controller.current === request) controller.current = null;
      if (!request.signal.aborted) setState((current) => current.snapshot === snapshot ? { ...current, loading: false } : current);
    }
  }

  return { reviews: active.reviews, setReviews, hasMore: Boolean(active.nextCursor), loading: active.loading, error: active.error, loadMore };
}
