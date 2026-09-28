"use client";

import { Check, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import { formatMissionReward, getMissionRewardDestination } from "@/lib/community-missions";
import type { AdminMissionSubmissionView, MissionReviewInput, MissionSubmissionStatus } from "@/types/missions";

type Filter = "all" | MissionSubmissionStatus;
const labels: Record<Filter, string> = {
  all: "Toutes", pending: "À vérifier", changes_requested: "À corriger",
  approved: "Validées", rejected: "Refusées",
};

export function AdminMissionReviews({ submissions, busy, notes, onNote, onReview }: {
  submissions: AdminMissionSubmissionView[];
  busy: boolean;
  notes: Record<string, string>;
  onNote: (id: string, note: string) => void;
  onReview: (submission: AdminMissionSubmissionView, action: MissionReviewInput["action"]) => void;
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [page, setPage] = useState(0);
  const filtered = submissions.filter((item) => filter === "all" || item.status === filter);
  const lastPage = Math.max(0, Math.ceil(filtered.length / 10) - 1);
  const currentPage = Math.min(page, lastPage);
  return (
    <article className="card-cartoon min-w-0 bg-white p-4">
      <h3 className="font-display text-2xl text-ink">Les preuves à vérifier</h3>
      <p className="mt-1 text-sm text-charcoal">Vérifiez la capture et le lien. Valider crédite automatiquement le gain affiché.</p>
      <p className="mt-1 text-xs text-charcoal">Tous les dossiers à traiter et les 300 dernières décisions.</p>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrer les participations">
        {(["pending", "changes_requested", "approved", "rejected", "all"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={filter === value}
            onClick={() => { setFilter(value); setPage(0); }}
            className={`min-h-11 rounded-full border-2 border-[#1a1a1a] px-3 text-xs font-bold ${filter === value ? "bg-[#1a1a1a] text-white" : "bg-white text-ink"}`}>
            {labels[value]} {value === "all" ? submissions.length : submissions.filter((item) => item.status === value).length}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p className="py-8 text-sm text-charcoal">Aucune participation dans cette catégorie.</p>}
      <div className="mt-4 grid gap-4">
        {filtered.slice(currentPage * 10, currentPage * 10 + 10).map((submission) => (
          <article key={submission.id} className="min-w-0 rounded-xl border-2 border-ink bg-[#f7f4ee] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 break-words">
                <h4 className="font-bold text-ink">{submission.missionTitle}</h4>
                <p className="text-sm text-charcoal">{submission.userName} · {submission.userEmail}</p>
                <p className="mt-1 text-xs text-charcoal">{new Date(submission.createdAt).toLocaleString("fr-FR")} · version {submission.revision}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink">{labels[submission.status]}</span>
            </div>
            <div className="mt-3 rounded-lg bg-[#f4c43d] p-3 text-[#003f30]">
              <p className="font-bold">{submission.rewardGranted ? "Gain attribué : " : "Gain à valider : "}{formatMissionReward(submission)}</p>
              <p className="text-xs">{getMissionRewardDestination(submission.rewardType).label} · fixé au dépôt de cette participation</p>
            </div>
            {submission.proofText && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-charcoal">{submission.proofText}</p>}
            {submission.proofSignedUrl ? (
              <a href={submission.proofSignedUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block overflow-hidden rounded-lg border border-ink bg-white">
                {/* Proofs are private signed URLs with a short lifetime. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={submission.proofSignedUrl} alt={`Capture de ${submission.userName} pour ${submission.missionTitle}`} loading="lazy" referrerPolicy="no-referrer" className="h-64 w-full object-contain" />
                <span className="block p-2 text-center text-xs text-ink underline">Ouvrir la capture en grand</span>
              </a>
            ) : <p className="mt-3 text-sm text-charcoal">{submission.proofStoragePath ? "Capture indisponible : rechargez les missions pour renouveler son accès." : "Aucune capture jointe à cette participation."}</p>}
            {submission.proofUrl && /^https:\/\//i.test(submission.proofUrl) && <a href={submission.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm text-blue-800 underline">Voir la publication ou le profil ↗</a>}
            {submission.adminNote && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-charcoal"><strong>Message au joueur :</strong> {submission.adminNote}</p>}
            {submission.reviewedAt && <p className="mt-2 text-xs text-charcoal">Dernière décision le {new Date(submission.reviewedAt).toLocaleString("fr-FR")}{submission.reviewedBy ? ` par ${submission.reviewedBy}` : ""}.</p>}
            {submission.legacyReview && submission.status === "pending" && <p className="mt-3 rounded-lg border border-amber-700 bg-amber-50 p-3 text-sm text-amber-950">Ancien dossier : vérifiez qu’aucun gain n’a déjà été attribué avant validation.</p>}
            {submission.status === "pending" && (
              <div className="mt-4">
                <label htmlFor={`review-note-${submission.id}`} className="text-sm font-semibold text-ink">Message au joueur</label>
                <p id={`review-help-${submission.id}`} className="text-xs text-charcoal">Obligatoire pour demander une correction ou refuser. Ce message est visible par le joueur.</p>
                <textarea id={`review-note-${submission.id}`} aria-describedby={`review-help-${submission.id}`} maxLength={1000} value={notes[submission.id] ?? ""} onChange={(event) => onNote(submission.id, event.target.value)} disabled={busy} className="mt-2 min-h-20 w-full rounded border-2 border-ink bg-white p-3 text-sm text-ink" placeholder="Ex. Le nom du compte doit être visible sur la capture." />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onReview(submission, "approve")} disabled={busy} className="btn-cartoon inline-flex min-h-11 items-center gap-2 bg-[#003f30] px-4 text-sm text-white disabled:opacity-50"><Check size={16} /> Valider et attribuer</button>
                  <button type="button" onClick={() => onReview(submission, "request_changes")} disabled={busy} className="btn-cartoon inline-flex min-h-11 items-center gap-2 bg-[#f4c43d] px-4 text-sm text-ink disabled:opacity-50"><MessageSquare size={16} /> Demander une correction</button>
                  <button type="button" onClick={() => onReview(submission, "reject")} disabled={busy} className="btn-cartoon inline-flex min-h-11 items-center gap-2 bg-white px-4 text-sm text-red-800 disabled:opacity-50"><X size={16} /> Refuser</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      {lastPage > 0 && <nav aria-label="Pages des participations" className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-ink">
        <button type="button" className="btn-cartoon min-h-11 px-3" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Précédent</button>
        <span>Page {currentPage + 1} / {lastPage + 1}</span>
        <button type="button" className="btn-cartoon min-h-11 px-3" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Suivant</button>
      </nav>}
    </article>
  );
}
