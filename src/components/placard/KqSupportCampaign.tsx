"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Heart, LockKeyhole, RefreshCw } from "lucide-react";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { parseSupportEuros, parseSupportForm, supportEuros, type SupportAttempt, type SupportStatus, type SupportSummary } from "@/lib/support-campaign";
import { clearSupportAttempt, createSupportToken, goToSupportPayment, readSupportAttempt, rememberSupportAttempt, supportRequest, validateSupportSummary } from "@/lib/support-client";
import { KqPrintedArt } from "./KqPrintedArt";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqFinancialSupport.module.css";

export function KqSupportCampaign({ standalone = false }: { standalone?: boolean }) {
  const Heading = standalone ? "h1" : "h2";
  const id = useId();
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pseudonym, setPseudonym] = useState("");
  const [amount, setAmount] = useState("5");
  const [publishName, setPublishName] = useState(false);
  const [publishAmount, setPublishAmount] = useState(false);
  const [attempt, setAttempt] = useState<SupportAttempt | null>(null);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const inFlight = useRef(false);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const amountCents = parseSupportEuros(amount);
  const refresh = useCallback(async () => {
    try {
      const result = validateSupportSummary(await supportRequest<SupportSummary>("/api/support"));
      if (mounted.current) { setSummary(result); setError(""); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Cagnotte indisponible."); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    try {
      const saved = readSupportAttempt();
      if (saved) {
        setAttempt(saved); setPseudonym(saved.pseudonym); setAmount(String(saved.amountCents / 100));
        setPublishName(saved.publishName); setPublishAmount(saved.publishAmount); setShowForm(true);
        void supportRequest<SupportStatus>("/api/support/status", { id: saved.id, token: saved.token })
          .then(result => { if (mounted.current) setStatus(result); })
          .catch(cause => { if (mounted.current) setFormError(cause.message); });
      }
    } catch { setFormError("La fiche enregistrée est inaccessible. Vérifie le stockage de ce navigateur avant de payer."); }
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  async function openForm() {
    setShowForm(true); requestAnimationFrame(() => formHeading.current?.focus());
    if (attempt || pseudonym) return;
    try {
      const profile = await supportRequest<{ pseudonym: string }>("/api/support/profile");
      if (mounted.current) setPseudonym(current => current || profile.pseudonym);
    } catch { /* Optional profile: guests can use the same form. */ }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setFormError("");
    try {
      const form = parseSupportForm({ pseudonym, amountCents, publishName, publishAmount });
      const current = attempt ?? { ...form, id: crypto.randomUUID(), token: createSupportToken() };
      rememberSupportAttempt(current); setAttempt(current);
      const result = await supportRequest<SupportStatus>("/api/support/checkout", current);
      if (!mounted.current) return;
      setStatus(result);
      if (!goToSupportPayment(result) && result.state === "creating") setFormError("La préparation est en cours. Vérifie son état dans quelques instants.");
    } catch (cause) { if (mounted.current) setFormError(cause instanceof Error ? cause.message : "Paiement indisponible."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function checkStatus(cancel = false) {
    if (!attempt || inFlight.current) return;
    inFlight.current = true; setBusy(true); setFormError("");
    try {
      const result = await supportRequest<SupportStatus>(cancel ? "/api/support/cancel" : "/api/support/status", { id: attempt.id, token: attempt.token });
      if (mounted.current) { setStatus(result); await refresh(); }
    } catch (cause) { if (mounted.current) setFormError(cause instanceof Error ? cause.message : "Vérification indisponible."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  function newSupport() {
    try { clearSupportAttempt(); setAttempt(null); setStatus(null); setFormError(""); }
    catch { setFormError("Impossible de préparer une nouvelle fiche dans ce navigateur."); }
  }
  async function more() {
    if (!summary || summary.nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = validateSupportSummary(await supportRequest<SupportSummary>(`/api/support?offset=${summary.nextOffset}`));
      if (mounted.current) setSummary(current => current ? { ...result, contributions: [...current.contributions, ...result.contributions.filter(item => !current.contributions.some(old => old.id === item.id))] } : result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Liste indisponible."); }
    finally { if (mounted.current) setLoadingMore(false); }
  }
  const confirmed = status?.state === "paid" || status?.state === "refunded";
  const waiting = status?.state === "uncertain" || status?.state === "creating" || status?.state === "review";
  return <aside className={styles.support} aria-labelledby={`${id}-title`} data-financial-support>
    <div className={styles.overview}>
      <KqPrintedArt kind="producer-support" className={styles.art} sizes="(max-width: 600px) 150px, 220px" />
      <div className={styles.summary}>
        <Heading id={`${id}-title`}>Soutenir les producteurs</Heading>
        <p>Bon, on n’est pas là pour faire la manche… mais la tréso, ça ne pousse pas sous les lampes.</p>
        <p>Chez nous, dès qu’on parle de chanvre à actifs, les banques rangent le chéquier.
          Quand t’as les poches pleines, c’est plus facile de grandir.
          Nous, petits producteurs, on fait avec les moyens du bord.</p>
        <p>Tu peux nous aider en achetant notre CBD. Mais si c’est pas ton truc et que tu kiffes le game,
          tu peux aussi nous glisser un ou deux euros de temps en temps, seulement si l’envie te prend et si tu peux.
          Ça nous aide à faire grandir le projet. Dans tous les cas, un grand merci !</p>
        {!summary ? <p role="status">{error ? "Le montant collecté est momentanément indisponible." : "Chargement de la cagnotte…"}</p> : <>
          {summary.needsReconciliation ? <p className={styles.amount} role="status">Total en cours de vérification</p> : <>
            <p className={styles.amount}>{supportEuros(summary.collectedCents)} <span>collectés</span></p>
            <p>{summary.contributionCount} contribution{summary.contributionCount > 1 ? "s" : ""} confirmée{summary.contributionCount > 1 ? "s" : ""}</p>
            {summary.campaign.goalCents !== null && <KqProgressMeter label="Objectif de la cagnotte" value={summary.collectedCents} max={summary.campaign.goalCents} valueLabel={`${supportEuros(summary.collectedCents)} sur ${supportEuros(summary.campaign.goalCents)}`} />}
          </>}
          <small>Versements confirmés, remboursements déduits, avant frais Viva.{error ? " Dernières données reçues." : ""}</small>
          <small>Suivi depuis le {new Date(summary.campaign.createdAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.</small>
          {!summary.checkoutAvailable && <p>Les nouvelles contributions sont actuellement fermées.</p>}
        </>}
        <div className={styles.actions}>
          {!showForm && <button ref={opener} type="button" className={styles.primary} disabled={!summary?.checkoutAvailable && !attempt} onClick={() => void openForm()}><Heart size={18} aria-hidden="true" /> {attempt ? "Mon soutien" : "Je soutiens"}</button>}
          <button type="button" onClick={() => void refresh()} aria-label="Actualiser la cagnotte"><RefreshCw size={16} aria-hidden="true" /> Actualiser</button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </div>
    {showForm && <section className={styles.formSection} aria-labelledby={`${id}-form`}>
      <h3 id={`${id}-form`} tabIndex={-1} ref={formHeading}>Mon coup de pouce</h3>
      {confirmed ? <div role="status"><p className={styles.thanks}>{status.state === "refunded" ? "Ton soutien a été remboursé." : `Merci pour ton soutien de ${supportEuros(status.amountCents)} !`}</p>
        {status.refundedCents > 0 && <p>Montant remboursé : {supportEuros(status.refundedCents)}.</p>}<button type="button" onClick={newSupport}>Faire un autre soutien</button></div>
        : status?.state === "cancelled" ? <div role="status"><p>La session de paiement a été annulée.</p><button type="button" onClick={newSupport}>Préparer une nouvelle fiche</button></div>
        : <form onSubmit={submit}>
          <fieldset disabled={busy || Boolean(attempt)} className={styles.fields}>
            <legend className={styles.srOnly}>Ta fiche de soutien</legend>
            <label htmlFor={`${id}-pseudo`}>Ton pseudo<input id={`${id}-pseudo`} name="pseudonym" value={pseudonym} onChange={event => setPseudonym(event.target.value)} required maxLength={32} autoComplete="nickname" /></label>
            <div><label htmlFor={`${id}-amount`}>Montant en euros<input id={`${id}-amount`} name="amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} required aria-describedby={`${id}-bounds`} /></label>
              <small id={`${id}-bounds`}>De {supportEuros(summary?.campaign.minCents ?? 100)} à {supportEuros(summary?.campaign.maxCents ?? 100_000)}.</small>
              <div className={styles.presets} aria-label="Montants proposés">{[2, 5, 10, 20].map(value => <button key={value} type="button" aria-pressed={amountCents === value * 100} onClick={() => setAmount(String(value))}>{value} €</button>)}</div>
            </div>
            <label className={styles.check}><input type="checkbox" checked={publishName} onChange={event => setPublishName(event.target.checked)} />Afficher mon pseudo dans la liste publique</label>
            <label className={styles.check}><input type="checkbox" checked={publishAmount} onChange={event => setPublishAmount(event.target.checked)} />Afficher aussi le montant de mon soutien</label>
          </fieldset>
          <p className={styles.preview}>Dans la liste : <strong>{publishName ? pseudonym || "Ton pseudo" : "Anonyme"}</strong> · {publishAmount && amountCents !== null ? supportEuros(amountCents) : "montant masqué"}.</p>
          {waiting && <p role="status">{status.state === "review" ? "Ce versement nécessite une vérification par l’équipe." : "La préparation ou la confirmation du paiement est en cours. Ne recommence pas le versement."}</p>}
          <div className={styles.actions}>
            {!waiting && <button className={styles.primary} type="submit" disabled={busy || (!attempt && !summary?.checkoutAvailable) || (Boolean(attempt) && status?.checkoutUrl === null)}><LockKeyhole size={17} aria-hidden="true" />{busy ? "Préparation…" : attempt ? "Reprendre sur Viva" : `Donner ${amountCents !== null ? supportEuros(amountCents) : ""} avec Viva`}</button>}
            {attempt && <button type="button" disabled={busy} onClick={() => void checkStatus()}>Vérifier mon paiement</button>}
            {attempt && status?.state === "ready" && <button type="button" disabled={busy} onClick={() => void checkStatus(true)}>Annuler cette session</button>}
          </div>
          <p className={styles.hint}>Paiement ponctuel, sans contrepartie. Viva peut demander ton nom et ton e-mail : ils ne seront jamais affichés ici.</p>
        </form>}
      {formError && <p className={styles.error} role="alert">{formError}</p>}
      {attempt && <small className={styles.reference}>Référence de ton soutien : {attempt.id}. Conserve-la pour toute demande à l’équipe.</small>}
      <button className={styles.close} type="button" disabled={busy} onClick={() => { setShowForm(false); requestAnimationFrame(() => opener.current?.focus()); }}>Fermer la fiche</button>
    </section>}
    <section className={styles.donors} aria-labelledby={`${id}-donors`}>
      <h3 id={`${id}-donors`}>Merci pour vos soutiens</h3>
      {summary ? summary.contributions.length ? <ul>{summary.contributions.map(item => <li key={item.id}><span><strong>{item.pseudonym}</strong><time dateTime={item.paidAt}>{new Date(item.paidAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</time></span><span>{item.amountCents === null ? "Montant masqué" : supportEuros(item.amountCents)}</span></li>)}</ul> : <p>Les contributions confirmées apparaîtront ici.</p> : <p>La liste sera affichée après chargement.</p>}
      {summary?.nextOffset !== null && summary?.nextOffset !== undefined && <button type="button" disabled={loadingMore} onClick={() => void more()}>{loadingMore ? "Chargement…" : "Voir les soutiens précédents"}</button>}
    </section>
    <details className={styles.details}><summary>À qui va mon soutien ?</summary>
      <p>Les fonds sont reçus par la SASU {BUSINESS_IDENTITY.legalName}, pour développer le projet.</p>
      <p>Aucun objet, bonus, accès privilégié ou avantage dans les concours en échange. Aucun reçu fiscal ni réduction d’impôt.</p>
      <p>Le cumul comprend les contributions anonymes. Les frais ne sont pas estimés. Le détail de l’utilisation des fonds viendra plus tard.</p>
      {summary && !summary.needsReconciliation && <p>{summary.feesCents === null ? "Les frais Viva sont en cours de rapprochement." : `Frais Viva vérifiés : ${supportEuros(summary.feesCents)}. Après frais : ${supportEuros(summary.collectedCents - summary.feesCents)}, avant les dépenses du projet.`}</p>}
      <p>Pour modifier l’affichage de ton soutien, contacte <a href={`mailto:${BUSINESS_IDENTITY.email}`}>{BUSINESS_IDENTITY.email}</a> avec sa référence.</p>
    </details>
  </aside>;
}
