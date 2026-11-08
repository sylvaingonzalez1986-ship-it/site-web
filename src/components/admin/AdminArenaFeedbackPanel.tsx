"use client";

import { Gift, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ARENA_FEEDBACK_KIND_LABELS,
  ARENA_FEEDBACK_LIMITS,
  ARENA_FEEDBACK_STATUS_LABELS,
  type AdminArenaFeedback,
  type ArenaFeedbackKind,
  type ArenaFeedbackStatus,
} from "@/lib/arena-feedback";

type Inbox = { items: AdminArenaFeedback[]; total: number; hasMore: boolean };
type ReviewDraft = { status: ArenaFeedbackStatus; reply: string; rewardPacks: number };
const PAGE_SIZE = 30;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date indisponible" : dateFormat.format(date);
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Session admin expirée. Reconnecte-toi via /admin/login.");
    }
    if (response.status === 409) {
      throw new Error(`${payload?.error || "Ce message a été modifié."} Ton brouillon reste visible. Conserve ta réponse, actualise la liste, puis clique sur Examiner pour rouvrir le dernier suivi de ce message.`);
    }
    if (response.status === 409) {
      throw new Error(`${payload?.error || "Ce message a été modifié."} Ton brouillon reste visible. Conserve ta réponse, actualise la liste, puis clique sur Examiner pour rouvrir le dernier suivi de ce message.`);
    }
    throw new Error(payload?.error || "La boîte aux lettres est indisponible. Réessaie.");
  }
  if (!payload) throw new Error("Réponse du serveur illisible. Actualise la boîte aux lettres.");
  return payload;
}

function FeedbackReview({ item, onSaved, onBusyChange }: {
  item: AdminArenaFeedback;
  onSaved: (item: AdminArenaFeedback, rewarded: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState<ReviewDraft>({ status: item.status, reply: item.reply ?? "", rewardPacks: 0 });
  const [confirmation, setConfirmation] = useState<ReviewDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const replyId = `feedback-reply-${item.id}`;
  const statusId = `feedback-status-${item.id}`;
  const packsId = `feedback-packs-${item.id}`;
  const rewardAllowed = draft.status !== "new" && draft.status !== "declined";

  useEffect(() => {
    if (confirmation) confirmationRef.current?.focus();
  }, [confirmation]);

  async function save(value: ReviewDraft) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    onBusyChange(true);
    setError("");
    try {
      const response = await fetch("/api/admin/arena/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status: value.status,
          reply: value.reply,
          expectedUpdatedAt: item.updatedAt,
          ...(value.rewardPacks > 0 ? { rewardPacks: value.rewardPacks } : {}),
        }),
      });
      const payload = await readResponse<{ item: AdminArenaFeedback; rewardGranted: boolean }>(response);
      onSaved(payload.item, payload.rewardGranted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur réseau. Le suivi n’a pas pu être confirmé.");
    } finally {
      pending.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (draft.rewardPacks > 0) setConfirmation({ ...draft });
    else void save(draft);
  }

  return (
    <form className="mt-4 grid gap-4 border-t border-green/25 pt-4" onSubmit={submit}>
      <fieldset className="grid gap-4" disabled={saving || Boolean(confirmation)}>
        <legend className="mb-3 font-bold">Suivi du message</legend>
        <label className="grid gap-1 text-sm font-semibold" htmlFor={statusId}>
          Statut
          <select id={statusId} className="w-full px-3 py-2" value={draft.status} onChange={(event) => {
            const status = event.target.value as ArenaFeedbackStatus;
            setDraft((current) => ({ ...current, status, rewardPacks: status === "new" || status === "declined" ? 0 : current.rewardPacks }));
          }}>
            {Object.entries(ARENA_FEEDBACK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold" htmlFor={replyId}>
          Réponse au joueur
          <textarea id={replyId} rows={4} maxLength={ARENA_FEEDBACK_LIMITS.replyMax} value={draft.reply} onChange={(event) => setDraft((current) => ({ ...current, reply: event.target.value }))} aria-describedby={`${replyId}-help`} />
        </label>
        <p id={`${replyId}-help`} className="-mt-2 text-xs text-charcoal">Visible dans sa boîte aux lettres. {draft.reply.length}/{ARENA_FEEDBACK_LIMITS.replyMax} caractères.</p>
        {item.rewardPacks > 0 ? (
          <p className="flex items-start gap-2 text-sm font-semibold"><Gift size={18} aria-hidden="true" />
            <span>{item.rewardPacks} pack(s) déjà offert(s){item.rewardGrantedAt ? ` le ${displayDate(item.rewardGrantedAt)}` : ""}. Une seule récompense par message.</span>
          </p>
        ) : (
          <label className="grid gap-1 text-sm font-semibold" htmlFor={packsId}>
            Récompenser cette aide
            <select id={packsId} className="w-full px-3 py-2" value={draft.rewardPacks} disabled={!rewardAllowed} onChange={(event) => setDraft((current) => ({ ...current, rewardPacks: Number(event.target.value) }))} aria-describedby={`${packsId}-help`}>
              <option value={0}>Aucune récompense</option>
              {Array.from({ length: ARENA_FEEDBACK_LIMITS.maxRewardPacks }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} pack(s) Botte du Chanvrier · {count * 10} cartes</option>)}
            </select>
            <span id={`${packsId}-help`} className="text-xs font-normal text-charcoal">{rewardAllowed ? "À attribuer après examen de l’aide apportée. Aucun pack automatique lors du dépôt." : "Passe le message en cours de lecture, prévu ou traité avant de proposer une récompense."}</span>
          </label>
        )}
      </fieldset>
      {error ? <p role="alert" className="text-sm font-semibold text-red-800">{error}</p> : null}
      {confirmation ? (
        <div ref={confirmationRef} tabIndex={-1} role="group" aria-labelledby={`feedback-confirm-${item.id}`} className="rounded border-2 border-green bg-white p-4">
          <h5 id={`feedback-confirm-${item.id}`} className="font-bold">Confirmer la récompense</h5>
          <p className="mt-2 text-sm">Envoyer <strong>{confirmation.rewardPacks} pack(s) Botte du Chanvrier ({confirmation.rewardPacks * 10} cartes)</strong> au joueur <strong className="break-all">{item.userId}</strong> pour « {item.subject} ».</p>
          <p className="mt-2 text-sm">Attribution définitive, une seule fois pour ce message. Le statut « {ARENA_FEEDBACK_STATUS_LABELS[confirmation.status]} » et la réponse seront aussi enregistrés.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-cartoon btn-primary" disabled={saving} onClick={() => void save(confirmation)}>{saving ? "Enregistrement…" : `Confirmer l’envoi de ${confirmation.rewardPacks} pack(s)`}</button>
            <button type="button" className="btn-cartoon btn-secondary" disabled={saving} onClick={() => { setConfirmation(null); requestAnimationFrame(() => document.getElementById(packsId)?.focus()); }}>Revenir au suivi</button>
          </div>
        </div>
      ) : (
        <button type="submit" className="btn-cartoon btn-primary justify-self-start" disabled={saving}>
          {saving ? "Enregistrement…" : draft.rewardPacks > 0 ? "Vérifier la récompense" : "Enregistrer le suivi"}
        </button>
      )}
    </form>
  );
}

export function AdminArenaFeedbackPanel() {
  const [kind, setKind] = useState<ArenaFeedbackKind | "all">("all");
  const [filter, setFilter] = useState<ArenaFeedbackStatus | "all">("new");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<AdminArenaFeedback | null>(null);
  const [saving, setSaving] = useState(false);
  const sequence = useRef(0);
  const reviewRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ kind, status: filter, offset: String(offset) });
      const payload = await readResponse<Inbox>(await fetch(`/api/admin/arena/feedback?${query}`, { cache: "no-store" }));
      if (request === sequence.current) setData(payload);
    } catch (cause) {
      if (request === sequence.current) {
        setData(null);
        setError(cause instanceof Error ? cause.message : "Erreur réseau. Impossible de lire les messages.");
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [kind, filter, offset]);

  useEffect(() => { void load(); }, [load]);

  function openReview(item: AdminArenaFeedback) {
    setSelected(item);
    setNotice("");
    requestAnimationFrame(() => reviewRef.current?.focus());
  }

  return (
    <section className="grid min-w-0 gap-5" aria-labelledby="admin-feedback-heading">
      <div className="cartoon-border bg-cream p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="admin-feedback-heading" className="font-display text-3xl">Boîte aux lettres</h3>
            <p className="mt-2 text-sm text-charcoal">Examine les bugs et les idées du Quartier, réponds aux joueurs et remercie les contributions utiles.</p>
          </div>
          <button type="button" className="btn-cartoon btn-secondary" disabled={loading || saving} onClick={() => void load()}><RefreshCcw size={15} aria-hidden="true" /> Actualiser les messages</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold" htmlFor="admin-feedback-kind">Type
            <select id="admin-feedback-kind" className="w-full px-3 py-2" value={kind} disabled={saving} onChange={(event) => { setKind(event.target.value as ArenaFeedbackKind | "all"); setOffset(0); setData(null); }}>
              <option value="all">Bugs et idées</option>
              {Object.entries(ARENA_FEEDBACK_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold" htmlFor="admin-feedback-filter">État du suivi
            <select id="admin-feedback-filter" className="w-full px-3 py-2" value={filter} disabled={saving} onChange={(event) => { setFilter(event.target.value as ArenaFeedbackStatus | "all"); setOffset(0); setData(null); }}>
              <option value="all">Tous les statuts</option>
              {Object.entries(ARENA_FEEDBACK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm" role="status">{loading ? "Lecture des messages…" : data ? `${data.total} message(s) correspondant aux filtres` : "Messages indisponibles"}</p>
        {error ? <p className="mt-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm font-semibold text-green" role="status">{notice}</p> : null}
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
        <div className="cartoon-border bg-cream p-5" aria-busy={loading}>
          {data?.items.length === 0 ? <p className="text-sm">Aucun message pour ces filtres.</p> : null}
          {data ? <ul className="divide-y divide-green/20">
            {data.items.map((item) => <li key={item.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-charcoal"><span>{ARENA_FEEDBACK_KIND_LABELS[item.kind]}</span><span>{ARENA_FEEDBACK_STATUS_LABELS[item.status]}</span>{item.rewardPacks > 0 ? <span>{item.rewardPacks} pack(s) offert(s)</span> : null}</div>
              <h4 className="mt-2 font-bold">{item.subject}</h4>
              <p className="mt-1 text-xs text-charcoal">{displayDate(item.createdAt)}</p>
              <button type="button" className={`btn-cartoon mt-3 ${selected?.id === item.id ? "btn-primary" : "btn-secondary"}`} disabled={saving} aria-controls="admin-feedback-review" aria-pressed={selected?.id === item.id} onClick={() => openReview(item)}>Examiner<span className="sr-only"> : {item.subject}</span></button>
            </li>)}
          </ul> : null}
          {data && (offset > 0 || data.hasMore) ? <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-green/20 pt-4">
            <button type="button" className="btn-cartoon btn-secondary" disabled={loading || saving || offset === 0} onClick={() => { setOffset((value) => Math.max(0, value - PAGE_SIZE)); setData(null); }}>Précédents</button>
            <span className="text-xs">Page {Math.floor(offset / PAGE_SIZE) + 1}</span>
            <button type="button" className="btn-cartoon btn-secondary" disabled={loading || saving || !data.hasMore} onClick={() => { setOffset((value) => value + PAGE_SIZE); setData(null); }}>Suivants</button>
          </div> : null}
        </div>
        <article id="admin-feedback-review" ref={reviewRef} tabIndex={-1} className="cartoon-border bg-cream p-5" aria-label="Examen du message">
          {selected ? <>
            <h4 className="font-display text-2xl">{selected.subject}</h4>
            <p className="mt-2 text-xs text-charcoal">{ARENA_FEEDBACK_KIND_LABELS[selected.kind]} · {displayDate(selected.createdAt)}</p>
            <p className="mt-2 break-all text-xs">Joueur : {selected.userId}</p>
            {selected.pagePath ? <p className="mt-1 break-all text-xs">Page concernée : {selected.pagePath}</p> : null}
            <p className="mt-4 whitespace-pre-wrap text-sm">{selected.message}</p>
            <FeedbackReview key={`${selected.id}:${selected.updatedAt}`} item={selected} onBusyChange={setSaving} onSaved={(item, rewarded) => {
              setSelected(item);
              setNotice(rewarded ? `Suivi enregistré. ${item.rewardPacks} pack(s) offert(s) au joueur.` : "Suivi enregistré.");
              void load();
              requestAnimationFrame(() => reviewRef.current?.focus());
            }} />
          </> : <p className="text-sm text-charcoal">Choisis un message pour lire le détail, répondre ou proposer une récompense.</p>}
        </article>
      </div>
    </section>
  );
}
