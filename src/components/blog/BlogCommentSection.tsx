"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import type { BlogComment } from "@/types/blog";

type BlogCommentSectionProps = {
  postId: string;
};

function formatInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "U";
}

function formatDate(dateValue: string): string {
  const parsed = Date.parse(dateValue);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return new Date(parsed).toLocaleDateString("fr-FR");
}

export function BlogCommentSection({ postId }: BlogCommentSectionProps) {
  const { user } = useCustomerSession();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch(`/api/blog/comments?postId=${encodeURIComponent(postId)}`, {
        cache: "no-store",
      });
      if (!response.ok || !active) {
        return;
      }
      const payload = (await response.json()) as { comments?: BlogComment[] };
      if (active) {
        setComments(payload.comments ?? []);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [postId]);

  const visibleComments = useMemo(() => comments.slice(0, visibleCount), [comments, visibleCount]);

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || saving) {
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId, content }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setStatus(payload?.error || "Impossible d'envoyer le commentaire.");
        return;
      }
      setContent("");
      setStatus(payload?.message || "Commentaire envoye.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cartoon-border bg-white p-5">
      <h2 className="font-display text-2xl text-ink">Commentaires</h2>

      <div className="mt-4 grid gap-3">
        {visibleComments.length === 0 && (
          <p className="text-sm text-charcoal">Aucun commentaire approuve pour le moment.</p>
        )}
        {visibleComments.map((comment) => (
          <article key={comment.id} className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-white text-xs font-bold text-ink">
                {formatInitials(comment.customerFirstName, comment.customerLastName)}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {(comment.customerFirstName || comment.customerLastName
                    ? `${comment.customerFirstName} ${comment.customerLastName}`.trim()
                    : "Client")}
                </p>
                <p className="text-xs text-charcoal">{formatDate(comment.createdAt)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-charcoal">{comment.content}</p>
          </article>
        ))}
      </div>

      {comments.length > visibleCount && (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + 10)}
          className="btn-cartoon btn-secondary mt-3 inline-flex h-10 items-center px-4 text-xs"
        >
          Voir plus
        </button>
      )}

      <div className="mt-6">
        {!user ? (
          <p className="text-sm text-charcoal">
            <Link href="/compte/connexion?next=%2Fblog" className="underline">
              Connectez-vous
            </Link>{" "}
            pour commenter cet article.
          </p>
        ) : (
          <form onSubmit={submitComment} className="grid gap-2">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-24 border-2 border-[#1a1a1a] bg-white p-3 text-sm"
              placeholder="Votre commentaire..."
              maxLength={2000}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-charcoal">Votre commentaire sera visible apres moderation.</p>
              <button
                type="submit"
                disabled={saving}
                className="btn-cartoon btn-primary inline-flex h-10 items-center px-4 text-xs"
              >
                {saving ? "Envoi..." : "Publier"}
              </button>
            </div>
          </form>
        )}
      </div>

      {status && <p className="mt-3 text-xs font-semibold text-ink">{status}</p>}
    </div>
  );
}
