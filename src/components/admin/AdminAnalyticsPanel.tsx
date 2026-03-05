"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminAnalyticsOverview } from "@/types/analytics";

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return new Date(parsed).toLocaleString("fr-FR");
}

export function AdminAnalyticsPanel() {
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/analytics", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setStatus(payload.error || "Impossible de charger les analytics.");
        setOverview(null);
        return;
      }
      const payload = (await response.json()) as { overview?: AdminAnalyticsOverview };
      setOverview(payload.overview ?? null);
      setStatus("Analytics chargees.");
    } catch {
      setStatus("Erreur reseau sur les analytics.");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-ink">Analytics (local)</h2>
        <button type="button" className="btn-cartoon btn-secondary" onClick={loadOverview}>
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>

      {status && <p className="mt-2 text-sm text-charcoal">{status}</p>}

      {loading || !overview ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Chargement analytics...</div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Pages vues (7j)</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.pageViews7d}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Pages vues (30j)</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.pageViews30d}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Events tutoriel (7j)</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.tutorialEvents7d}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Dernier event</p>
              <p className="mt-1 text-sm font-semibold text-ink">{formatDate(overview.lastEventAt)}</p>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="card-cartoon bg-white p-4">
              <h3 className="font-display text-2xl text-ink">Top pages (7 jours)</h3>
              {overview.topPages7d.length === 0 ? (
                <p className="mt-3 text-sm text-charcoal">Aucune page vue sur 7 jours.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {overview.topPages7d.map((item) => (
                    <div
                      key={`7d-${item.pathname}`}
                      className="flex items-center justify-between gap-3 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-2"
                    >
                      <p className="truncate text-sm text-ink">{item.pathname}</p>
                      <span className="pill-cartoon px-2 py-1 text-xs">{item.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="card-cartoon bg-white p-4">
              <h3 className="font-display text-2xl text-ink">Top pages (30 jours)</h3>
              {overview.topPages30d.length === 0 ? (
                <p className="mt-3 text-sm text-charcoal">Aucune page vue sur 30 jours.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {overview.topPages30d.map((item) => (
                    <div
                      key={`30d-${item.pathname}`}
                      className="flex items-center justify-between gap-3 rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] px-3 py-2"
                    >
                      <p className="truncate text-sm text-ink">{item.pathname}</p>
                      <span className="pill-cartoon px-2 py-1 text-xs">{item.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>

          <article className="card-cartoon bg-white p-4">
            <h3 className="font-display text-2xl text-ink">Evenements (30 jours)</h3>
            {overview.eventsByName30d.length === 0 ? (
              <p className="mt-3 text-sm text-charcoal">Aucun evenement enregistre.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#f4f1ea]">
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Event</th>
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.eventsByName30d.map((eventRow) => (
                      <tr key={eventRow.eventName}>
                        <td className="border border-[#1a1a1a] px-2 py-2">{eventRow.eventName}</td>
                        <td className="border border-[#1a1a1a] px-2 py-2">{eventRow.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
