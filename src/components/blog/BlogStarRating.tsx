"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import type { BlogRatingStats } from "@/types/blog";

type BlogStarRatingProps = {
  postId: string;
};

const DEFAULT_STATS: BlogRatingStats = {
  postId: "",
  averageRating: 0,
  totalRatings: 0,
  userRating: null,
};

export function BlogStarRating({ postId }: BlogStarRatingProps) {
  const { user } = useCustomerSession();
  const [stats, setStats] = useState<BlogRatingStats>(DEFAULT_STATS);
  const [hovered, setHovered] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch(`/api/blog/ratings?postId=${encodeURIComponent(postId)}`, {
        cache: "no-store",
      });
      if (!response.ok || !active) {
        return;
      }
      const payload = (await response.json()) as BlogRatingStats;
      if (active) {
        setStats(payload);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [postId]);

  const submitRating = async (rating: number) => {
    if (!user || saving) {
      return;
    }
    setSaving(true);
    setStatus(null);

    const previous = stats;
    const optimisticTotal = previous.userRating ? previous.totalRatings : previous.totalRatings + 1;
    const optimisticAverage =
      optimisticTotal > 0
        ? Number(
            (
              ((previous.averageRating * previous.totalRatings) -
                (previous.userRating ?? 0) +
                rating) /
              optimisticTotal
            ).toFixed(2),
          )
        : rating;

    setStats((current) => ({
      ...current,
      postId,
      userRating: rating,
      totalRatings: optimisticTotal,
      averageRating: optimisticAverage,
    }));

    try {
      const response = await fetch("/api/blog/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId, rating }),
      });
      if (!response.ok) {
        setStats(previous);
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus(payload?.error || "Impossible d'enregistrer la note.");
        return;
      }

      const next = (await response.json()) as BlogRatingStats;
      setStats(next);
      setStatus("Merci pour votre avis.");
    } finally {
      setSaving(false);
    }
  };

  const displayedRating = hovered ?? stats.userRating ?? Math.round(stats.averageRating);

  return (
    <div className="cartoon-border bg-white p-5">
      <h2 className="font-display text-2xl text-ink">Note de l&apos;article</h2>
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => {
          const active = value <= displayedRating;
          return (
            <button
              key={value}
              type="button"
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => void submitRating(value)}
              disabled={!user || saving}
              className="disabled:cursor-not-allowed"
              aria-label={`Noter ${value} sur 5`}
            >
              <Star
                size={20}
                className={active ? "fill-[#f4c26f] text-[#f4c26f]" : "text-[#9a968d]"}
              />
            </button>
          );
        })}
        <p className="ml-3 text-sm text-charcoal">
          {stats.averageRating.toFixed(1)}/5 - {stats.totalRatings} avis
        </p>
      </div>
      {!user && (
        <p className="mt-2 text-xs text-charcoal">Connectez-vous pour noter cet article.</p>
      )}
      {status && <p className="mt-2 text-xs font-semibold text-ink">{status}</p>}
    </div>
  );
}
