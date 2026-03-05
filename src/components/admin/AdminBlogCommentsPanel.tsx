"use client";

import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BlogComment, BlogCommentStatus } from "@/types/blog";

type FilterValue = "all" | BlogCommentStatus;

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return new Date(parsed).toLocaleString("fr-FR");
}

export function AdminBlogCommentsPanel() {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadComments = useCallback(async (nextFilter: FilterValue) => {
    setLoading(true);
    setStatus(null);
    try {
      const search = nextFilter === "all" ? "" : `?status=${nextFilter}`;
      const response = await fetch(`/api/admin/blog/comments${search}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setStatus(payload.error || "Impossible de charger les commentaires.");
        setComments([]);
        return;
      }
      const payload = (await response.json()) as { comments?: BlogComment[] };
      setComments(payload.comments ?? []);
    } catch {
      setStatus("Erreur reseau.");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComments(filter);
  }, [filter, loadComments]);

  const pendingCount = useMemo(
    () => comments.filter((comment) => comment.status === "pending").length,
    [comments],
  );

  const moderate = async (commentId: string, nextStatus: "approved" | "rejected") => {
    setBusyId(commentId);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/blog/comments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId, status: nextStatus }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setStatus(payload.error || "Moderation impossible.");
        return;
      }
      setStatus("Commentaire mis a jour.");
      await loadComments(filter);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-ink">Commentaires blog</h2>
        <button type="button" className="btn-cartoon btn-secondary" onClick={() => void loadComments(filter)}>
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as FilterValue[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.09em] ${
              filter === value ? "bg-[#1a1a1a] text-white" : "bg-white text-ink"
            }`}
          >
            {value === "all" ? "Tous" : value}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-charcoal">En attente: {pendingCount}</p>
      {status && <p className="mt-2 text-sm text-charcoal">{status}</p>}

      {loading ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Chargement commentaires...</div>
      ) : comments.length === 0 ? (
        <div className="mt-4 card-cartoon bg-white p-4 text-charcoal">Aucun commentaire.</div>
      ) : (
        <div className="mt-4 grid gap-3">
          {comments.map((comment) => (
            <article key={comment.id} className="card-cartoon bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {(comment.customerFirstName || comment.customerLastName
                    ? `${comment.customerFirstName} ${comment.customerLastName}`.trim()
                    : "Client")}{" "}
                  - <span className="font-mono text-xs">{comment.postId}</span>
                </p>
                <span className="pill-cartoon px-3 py-1 text-xs uppercase tracking-[0.09em]">
                  {comment.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-charcoal">{formatDate(comment.createdAt)}</p>
              <p className="mt-3 text-sm text-charcoal">{comment.content}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === comment.id}
                  onClick={() => void moderate(comment.id, "approved")}
                  className="btn-cartoon btn-secondary inline-flex h-10 items-center px-4 text-xs"
                >
                  Approuver
                </button>
                <button
                  type="button"
                  disabled={busyId === comment.id}
                  onClick={() => void moderate(comment.id, "rejected")}
                  className="btn-cartoon btn-primary inline-flex h-10 items-center px-4 text-xs"
                >
                  Rejeter
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
