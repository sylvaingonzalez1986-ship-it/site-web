"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bug, Gift, Lightbulb, Mail, Send } from "lucide-react";
import { AppDialog, useDialogNavigation } from "@/components/ui/AppDialog";
import { ARENA_FEEDBACK_KIND_LABELS, ARENA_FEEDBACK_STATUS_LABELS, ARENA_FEEDBACK_LIMITS, type ArenaFeedback, type ArenaFeedbackKind } from "@/lib/arena-feedback";
import { createClientRequestKey } from "@/lib/client-request-key";
import { KqPrintedArt } from "./KqPrintedArt";
import { KqChapterHeading } from "./KqChapterHeading";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqMailbox.module.css";

type Submission = { requestId: string; kind: ArenaFeedbackKind; subject: string; message: string; pagePath: string };
const dateLabel = (date: string) => new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function OpenPacks({ onOpen }: { onOpen: () => void }) {
  const navigate = useDialogNavigation();
  return <button type="button" className={styles.button} onClick={() => navigate(onOpen)}><Gift size={17} aria-hidden="true" />Voir mes packs</button>;
}

/** The map prop and its private correspondence stay together across modal closes. */
export function KqMailbox({ onOpenPacks, onReveal }: { onOpenPacks: () => void; onReveal: (button: HTMLButtonElement) => void }) {
  const api = useKqTutorialApi();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ArenaFeedbackKind>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [sendError, setSendError] = useState("");
  const [success, setSuccess] = useState("");
  const [items, setItems] = useState<ArenaFeedback[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const request = useRef<Submission | null>(null);
  const sendLock = useRef(false);
  const historySequence = useRef(0);
  const alive = useRef(true);
  const id = useId();
  const titleId = `${id}-title`;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function loadHistory(offset = 0) {
    const sequence = ++historySequence.current;
    setLoading(true); setHistoryError("");
    try {
      const response = await api.request(`/api/arena/feedback?offset=${offset}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tes courriers ne sont pas disponibles pour le moment.");
      if (!Array.isArray(data.items) || typeof data.total !== "number") throw new Error("Impossible de lire tes courriers. Réessaie.");
      if (!alive.current || sequence !== historySequence.current) return;
      setItems(previous => offset ? [...previous, ...data.items.filter((item: ArenaFeedback) => !previous.some(known => known.id === item.id))] : data.items);
      setTotal(data.total); setHasMore(data.hasMore === true);
    } catch (error) {
      if (alive.current && sequence === historySequence.current) setHistoryError(error instanceof Error ? error.message : "Impossible de lire tes courriers.");
    } finally {
      if (alive.current && sequence === historySequence.current) setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendLock.current || api.isTutorial) return;
    sendLock.current = true;
    setSending(true); setSendError(""); setSuccess("");
    request.current ??= { requestId: createClientRequestKey(), kind, subject: subject.trim(), message: message.trim(), pagePath: window.location.pathname };
    try {
      const response = await api.request("/api/arena/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.current) });
      // A lost response keeps the original key and body for a safe verification.
      // A rate limit or expired session on a retry cannot disprove a previous commit.
      if (!uncertain && !response.ok && response.status < 500) { request.current = null; setUncertain(false); }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "L’envoi n’a pas pu être confirmé.");
      if (!data.item?.id) throw new Error("L’envoi n’a pas pu être confirmé.");
      request.current = null;
      if (!alive.current) return;
      setUncertain(false); setSubject(""); setMessage("");
      setSuccess("Courrier reçu ! Tu retrouveras la réponse de l’équipe ci-dessous.");
      void loadHistory();
    } catch (error) {
      if (!alive.current) return;
      setUncertain(request.current !== null);
      setSendError(error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError) ? error.message : "Connexion interrompue. Vérifie l’envoi pour retrouver sa confirmation.");
    } finally {
      sendLock.current = false;
      if (alive.current) setSending(false);
    }
  }

  if (api.isTutorial) return null;
  return <>
    <button type="button" className={styles.mailbox} data-map-mailbox aria-label="Boîte aux lettres · Signaler un bug ou proposer une idée" aria-haspopup="dialog"
      onFocus={event => onReveal(event.currentTarget)} onClick={() => { setOpen(true); void loadHistory(); }}>
      <KqPrintedArt kind="mailbox" className={styles.mapArt} sizes="180px" />
      <span className={styles.sign} data-map-label="mailbox"><Mail size={16} aria-hidden="true" /><span>Boîte aux lettres</span></span>
    </button>
    {open ? createPortal(<AppDialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} className={styles.dialog} bodyClassName={styles.body} closeLabel="Fermer la boîte aux lettres" dialogProps={{ "data-mailbox-dialog": true }}>
      <KqChapterHeading art="mailbox" title="Boîte aux lettres" titleId={titleId} compact>
        <p>Un bug ou une idée pour le quartier ? Écris à l’équipe.</p>
      </KqChapterHeading>
      <p className={styles.reward}><Gift size={22} aria-hidden="true" /><span>Les contributions utiles peuvent recevoir des <strong>packs Botte du Chanvrier</strong> après validation de l’équipe.</span></p>
      <form onSubmit={submit} className={styles.form} data-mailbox-form>
        <fieldset disabled={sending || uncertain} className={styles.fields}>
          <legend>Ton courrier</legend>
          <div className={styles.kinds}>
            {(["bug", "idea"] as const).map(value => <label key={value} className={styles.kind} data-selected={kind === value || undefined}>
              <input type="radio" name={`${id}-kind`} value={value} checked={kind === value} onChange={() => { setKind(value); setSuccess(""); }} />
              {value === "bug" ? <Bug size={18} aria-hidden="true" /> : <Lightbulb size={18} aria-hidden="true" />}<span>{value === "bug" ? "Signaler un bug" : "Proposer une idée"}</span>
            </label>)}
          </div>
          <label className={styles.label} htmlFor={`${id}-subject`}>Sujet<input id={`${id}-subject`} name="subject" value={subject} onChange={event => { setSubject(event.target.value); setSuccess(""); }} required minLength={ARENA_FEEDBACK_LIMITS.subjectMin} maxLength={ARENA_FEEDBACK_LIMITS.subjectMax} placeholder={kind === "bug" ? "Ex. : ma récolte ne s’affiche plus" : "Ex. : trier mes cartes par rareté"} /></label>
          <label className={styles.label} htmlFor={`${id}-message`}>{kind === "bug" ? "Que s’est-il passé ?" : "Quelle est ton idée ?"}
            <textarea id={`${id}-message`} name="message" value={message} onChange={event => { setMessage(event.target.value); setSuccess(""); }} required minLength={ARENA_FEEDBACK_LIMITS.messageMin} maxLength={ARENA_FEEDBACK_LIMITS.messageMax} rows={5} aria-describedby={`${id}-hint ${id}-length`} />
          </label>
          <p className={styles.hint} id={`${id}-hint`}>{kind === "bug" ? "Indique l’écran, les étapes et le résultat attendu. Ton appareil et ton navigateur peuvent aider." : "Explique ce que tu aimerais faire et en quoi cela t’aiderait à jouer."} Ne joins aucun mot de passe ni donnée de paiement.</p>
          <p className={styles.counter} id={`${id}-length`}>{message.length} / {ARENA_FEEDBACK_LIMITS.messageMax} caractères · {ARENA_FEEDBACK_LIMITS.messageMin} minimum</p>
        </fieldset>
        {sendError ? <p role="alert" className={styles.error}>{sendError}{uncertain ? " Ton courrier est conservé : vérifie l’envoi avant de le modifier." : ""}</p> : null}
        <div className={styles.sendRow}><button type="submit" className={`${styles.button} ${styles.send}`} disabled={sending}><Send size={17} aria-hidden="true" />{sending ? "Envoi en cours…" : uncertain ? "Vérifier l’envoi" : "Envoyer mon courrier"}</button><small>{ARENA_FEEDBACK_LIMITS.dailySubmissions} courriers maximum sur 24 h</small></div>
        {success ? <p role="status" className={styles.success}>{success}</p> : null}
      </form>
      <section className={styles.history} aria-labelledby={`${id}-history`}>
        <div className={styles.historyHeading}><h2 id={`${id}-history`}>Mes courriers{total !== null ? ` (${total})` : ""}</h2><button type="button" className={styles.button} disabled={loading} onClick={() => void loadHistory()}>Actualiser</button></div>
        {loading ? <p role="status">Chargement des courriers…</p> : null}
        {historyError ? <p role="alert" className={styles.error}>{historyError} Utilise Actualiser pour réessayer.</p> : null}
        {total === 0 && !historyError && !loading ? <p>Ton premier courrier apparaîtra ici, avec son suivi et la réponse de l’équipe.</p> : null}
        {items.map(item => <article key={item.id} className={styles.letter}>
          <div className={styles.meta}><span>{ARENA_FEEDBACK_KIND_LABELS[item.kind]} · <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></span><strong>{ARENA_FEEDBACK_STATUS_LABELS[item.status]}</strong></div>
          <h3>{item.subject}</h3>
          <details className={styles.details}><summary>Relire mon courrier</summary><p>{item.message}</p></details>
          {item.reply ? <div className={styles.reply}><strong>Réponse de l’équipe</strong><p>{item.reply}</p></div> : null}
          {item.rewardGrantedAt && item.rewardPacks > 0 ? <div className={styles.granted}><p><Gift size={18} aria-hidden="true" /><strong>{item.rewardPacks} pack{item.rewardPacks > 1 ? "s" : ""} Botte du Chanvrier offert{item.rewardPacks > 1 ? "s" : ""}</strong></p><OpenPacks onOpen={onOpenPacks} /></div> : null}
        </article>)}
        {hasMore ? <button type="button" className={styles.button} disabled={loading} onClick={() => void loadHistory(items.length)}>Voir les courriers précédents</button> : null}
      </section>
    </AppDialog>, document.body) : null}
  </>;
}
