"use client";

import Link from "@/components/navigation/NavigationLink";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCustomerSession } from "@/hooks/useCustomerSession";
import type { BlogComment } from "@/types/blog";
import styles from "./Blog.module.css";

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
  const pathname = usePathname();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/blog/comments?postId=${encodeURIComponent(postId)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Commentaires indisponibles");
        const payload = (await response.json()) as { comments?: BlogComment[] };
        if (active) {
          setComments(payload.comments ?? []);
          setLoadError(false);
        }
      } catch {
        if (active) setLoadError(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [postId, loadAttempt]);

  const visibleComments = useMemo(() => comments.slice(0, visibleCount), [comments, visibleCount]);

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || saving) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setSubmitFailed(false);
    try {
      const response = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId, content }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        setSubmitFailed(true);
        setStatus(payload?.error || "Impossible d'envoyer le commentaire.");
        return;
      }
      setContent("");
      setStatus(payload?.message || "Commentaire envoye.");
    } catch {
      setSubmitFailed(true);
      setStatus("L’envoi n’a pas abouti. Ton texte est conservé : vérifie ta connexion puis réessaie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="commentaires" className={styles.panel} style={{ scrollMarginTop: "7rem" }}>
      <h2 className={styles.panelTitle}>Commentaires</h2>
      {loadError && <div className="mt-3 text-sm" role="status">
        <p>Les commentaires n’ont pas pu être chargés.</p>
        <button type="button" className="btn-cartoon btn-secondary mt-2 min-h-11" onClick={() => setLoadAttempt((value) => value + 1)}>Réessayer le chargement</button>
      </div>}

      <div className="mt-4 grid gap-3">
        {!loadError && visibleComments.length === 0 && (
          <p className="text-sm text-charcoal">Aucun commentaire approuvé pour le moment.</p>
        )}
        {visibleComments.map((comment) => (
          <article key={comment.id} className={styles.comment}>
            <div className="flex items-center gap-3">
              <span className={styles.initials}>
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
            <Link href={`/compte/connexion?next=${encodeURIComponent(`${pathname}#commentaires`)}`} className="underline">
              Connectez-vous
            </Link>{" "}
            pour commenter cet article.
          </p>
        ) : (
          <form onSubmit={submitComment} className="grid gap-2">
            <label htmlFor={`comment-${postId}`} className="text-sm font-bold">Votre commentaire</label>
            <textarea
              id={`comment-${postId}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className={styles.commentField}
              aria-label="Votre commentaire"
              placeholder="Votre commentaire..."
              maxLength={2000}
              required
              aria-describedby={status ? `comment-status-${postId}` : undefined}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-charcoal">Votre commentaire sera visible après modération.</p>
              <button
                type="submit"
                disabled={saving}
                className="btn-cartoon btn-primary inline-flex min-h-11 items-center px-4 text-sm"
              >
                {saving ? "Envoi..." : submitFailed ? "Réessayer l’envoi" : "Publier"}
              </button>
            </div>
          </form>
        )}
      </div>

      {status && <p id={`comment-status-${postId}`} role={submitFailed ? "alert" : "status"} className="mt-3 text-sm font-semibold text-ink">{status}</p>}
    </div>
  );
}
