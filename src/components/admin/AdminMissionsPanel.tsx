"use client";

import { Check, Loader2, RefreshCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminMissionsOverview, AdminMissionSubmissionView } from "@/types/missions";

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return new Date(parsed).toLocaleString("fr-FR");
}

const statusLabels: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function AdminMissionsPanel() {
  const [overview, setOverview] = useState<AdminMissionsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const loadData = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/missions", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setStatus(payload.error || "Erreur chargement missions.");
        return;
      }

      const payload = (await response.json()) as { overview?: AdminMissionsOverview };
      setOverview(payload.overview ?? null);
    } catch {
      setStatus("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleReview = async (submission: AdminMissionSubmissionView, action: "approve" | "reject") => {
    setProcessingId(submission.id);
    try {
      const response = await fetch("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          action,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setStatus(payload.error || "Erreur traitement.");
        return;
      }

      setStatus(
        action === "approve"
          ? `Mission approuvée pour ${submission.userName}.`
          : `Mission refusée pour ${submission.userName}.`,
      );
      await loadData();
    } catch {
      setStatus("Erreur réseau.");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSubmissions =
    overview?.submissions.filter((s) => filter === "all" || s.status === filter) ?? [];

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-ink">Missions sociales</h2>
        <button type="button" className="btn-cartoon btn-secondary" onClick={loadData}>
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>

      {status && <p className="mt-2 text-sm text-charcoal">{status}</p>}

      {loading || !overview ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">
          Chargement missions...
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Missions</p>
              <p className="mt-1 text-2xl font-bold text-ink">{overview.totalMissions}</p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">En attente</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">
                {overview.pendingSubmissions}
              </p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Approuvées</p>
              <p className="mt-1 text-2xl font-bold text-green-700">
                {overview.approvedSubmissions}
              </p>
            </article>
            <article className="card-cartoon bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-charcoal">Refusées</p>
              <p className="mt-1 text-2xl font-bold text-red-700">
                {overview.rejectedSubmissions}
              </p>
            </article>
          </div>

          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            {(["pending", "all", "approved", "rejected"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`pill-cartoon flex min-h-[36px] items-center px-3 py-1 text-xs font-bold uppercase tracking-[0.09em] ${
                  filter === f
                    ? "bg-[#1a1a1a] text-white"
                    : "border-2 border-[#1a1a1a] bg-white text-ink hover:bg-[#f0f0f0]"
                }`}
              >
                {f === "all"
                  ? "Toutes"
                  : f === "pending"
                    ? "En attente"
                    : f === "approved"
                      ? "Approuvées"
                      : "Refusées"}
              </button>
            ))}
          </div>

          {/* Submissions */}
          {filteredSubmissions.length === 0 ? (
            <p className="text-sm text-charcoal">Aucune soumission dans cette catégorie.</p>
          ) : (
            <div className="grid gap-3">
              {filteredSubmissions.map((sub) => (
                <article key={sub.id} className="card-cartoon bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {sub.missionTitle}
                      </p>
                      <p className="text-xs text-charcoal">
                        {sub.userName} ({sub.userEmail})
                      </p>
                      <p className="text-xs text-charcoal">{formatDate(sub.createdAt)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${statusColors[sub.status] ?? "bg-gray-100 text-gray-800"}`}
                    >
                      {statusLabels[sub.status] ?? sub.status}
                    </span>
                  </div>

                  {sub.proofText && (
                    <div className="mt-2 rounded border border-[#ccc] bg-[#f7f4ee] p-2">
                      <p className="text-xs text-charcoal">{sub.proofText}</p>
                    </div>
                  )}

                  {sub.proofUrl && (
                    <p className="mt-1 text-xs">
                      <a
                        href={sub.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline"
                      >
                        Voir la preuve
                      </a>
                    </p>
                  )}

                  {sub.adminNote && (
                    <p className="mt-1 text-xs text-charcoal">
                      Note admin: {sub.adminNote}
                    </p>
                  )}

                  {sub.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReview(sub, "approve")}
                        disabled={processingId === sub.id}
                        className="btn-cartoon inline-flex h-8 items-center justify-center gap-1 bg-green-600 px-3 text-xs text-white leading-none hover:bg-green-700"
                      >
                        {processingId === sub.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        Approuver
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(sub, "reject")}
                        disabled={processingId === sub.id}
                        className="btn-cartoon inline-flex h-8 items-center justify-center gap-1 bg-red-600 px-3 text-xs text-white leading-none hover:bg-red-700"
                      >
                        {processingId === sub.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                        Refuser
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
