"use client";

import { RefreshCcw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminReferralOverview } from "@/types/referral";

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }

  return new Date(parsed).toLocaleString("fr-FR");
}

export function AdminReferralsPanel() {
  const [overview, setOverview] = useState<AdminReferralOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/referrals", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setStatus(payload.error || "Impossible de charger le parrainage.");
        setOverview(null);
        return;
      }

      const payload = (await response.json()) as { overview?: AdminReferralOverview };
      setOverview(payload.overview ?? null);
      setStatus("Donnees parrainage chargees.");
    } catch {
      setStatus("Erreur reseau sur le parrainage.");
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
        <h2 className="font-display text-3xl text-ink">Parrainage</h2>
        <button type="button" className="btn-cartoon btn-secondary" onClick={loadOverview}>
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>

      {status && <p className="mt-2 text-sm text-charcoal">{status}</p>}

      {loading || !overview ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Chargement parrainage...</div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Comptes avec code</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.totalUsersWithCode}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Filleuls lies</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.totalBoundReferrals}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Parrainages recompenses</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.totalRewardedReferrals}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">En attente 1re commande</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.pendingBoundReferrals}</p>
            </article>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Points parrains</p>
              <p className="mt-1 text-xl font-bold text-ink">{overview.totalPointsAwardedReferrer}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Points filleuls</p>
              <p className="mt-1 text-xl font-bold text-ink">{overview.totalPointsAwardedReferee}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Points distribues</p>
              <p className="mt-1 text-xl font-bold text-ink">{overview.totalPointsAwarded}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Config rewards</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {overview.config.referrerPoints} pts parrain / {overview.config.refereePoints} pts filleul
              </p>
            </article>
          </div>

          <article className="card-cartoon bg-white p-4">
            <h3 className="font-display text-2xl text-ink">Top parrains</h3>
            {overview.topReferrers.length === 0 ? (
              <p className="mt-3 text-sm text-charcoal">Aucun parrainage recompense pour le moment.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {overview.topReferrers.map((referrer) => (
                  <div
                    key={referrer.userId}
                    className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">
                        {referrer.firstName || referrer.lastName
                          ? `${referrer.firstName} ${referrer.lastName}`.trim()
                          : "Client"}
                      </p>
                      <p className="text-xs font-semibold text-charcoal">{referrer.email || "-"}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-charcoal">
                      <span className="pill-cartoon px-3 py-1 inline-flex items-center gap-1">
                        <Users size={12} /> {referrer.rewardedReferrals} filleul(s)
                      </span>
                      <span className="pill-cartoon px-3 py-1">{referrer.pointsEarnedAsReferrer} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="card-cartoon bg-white p-4">
            <h3 className="font-display text-2xl text-ink">Dernieres recompenses</h3>
            {overview.recentRewards.length === 0 ? (
              <p className="mt-3 text-sm text-charcoal">Aucun gain de parrainage enregistre.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#f4f1ea]">
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Date</th>
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Commande</th>
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Parrain</th>
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Filleul</th>
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Pts parrain</th>
                      <th className="border border-[#1a1a1a] px-2 py-2 font-semibold">Pts filleul</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentRewards.map((reward) => (
                      <tr key={reward.id}>
                        <td className="border border-[#1a1a1a] px-2 py-2">{formatDate(reward.createdAt)}</td>
                        <td className="border border-[#1a1a1a] px-2 py-2">{reward.orderId || "-"}</td>
                        <td className="border border-[#1a1a1a] px-2 py-2">
                          <p className="font-semibold text-ink">{reward.referrerName}</p>
                          <p className="text-[11px] text-charcoal">{reward.referrerEmail || reward.referrerId}</p>
                        </td>
                        <td className="border border-[#1a1a1a] px-2 py-2">
                          <p className="font-semibold text-ink">{reward.refereeName}</p>
                          <p className="text-[11px] text-charcoal">{reward.refereeEmail || reward.refereeId}</p>
                        </td>
                        <td className="border border-[#1a1a1a] px-2 py-2">{reward.referrerPoints}</td>
                        <td className="border border-[#1a1a1a] px-2 py-2">{reward.refereePoints}</td>
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
