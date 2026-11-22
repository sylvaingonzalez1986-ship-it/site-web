"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, CreditCard, LockKeyhole, RefreshCw, Zap } from "lucide-react";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { parseSupportEuros, parseSupportForm, supportEuros, type SupportAttempt, type SupportProvider, type SupportStatus, type SupportSummary } from "@/lib/support-campaign";
import {
  clearSupportAttempt, createSupportToken, goToSupportPayment, readSupportAttempt, rememberSupportAttempt,
  SUPPORT_PROVIDER_LABELS, supportRequest, supportStatusIsFinal, supportStatusMessage,
  validateSupportStatus, validateSupportSummary,
} from "@/lib/support-client";
import { KqChapterHeading } from "./KqChapterHeading";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqFinancialSupport.module.css";

const paymentMethods = [
  { provider: "viva", service: "Viva", Icon: CreditCard },
  { provider: "swiss-bitcoin-pay", service: "Swiss Bitcoin Pay", Icon: Zap },
] as const;

function supportDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

export function KqSupportCampaign({ standalone = false, gameReturnHref }: { standalone?: boolean; gameReturnHref?: string }) {
  const id = useId();
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [work, setWork] = useState<"creating" | "checking" | "cancelling" | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pseudonym, setPseudonym] = useState("");
  const [amount, setAmount] = useState("5");
  const [provider, setProvider] = useState<SupportProvider>("viva");
  const [publishName, setPublishName] = useState(false);
  const [publishAmount, setPublishAmount] = useState(false);
  const [attempt, setAttempt] = useState<SupportAttempt | null>(null);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const pseudoInput = useRef<HTMLInputElement>(null);
  const amountCents = parseSupportEuros(amount);
  const available = summary?.checkoutAvailable ? summary.providers ?? ["viva" as const] : [];
  const chosenProvider = available.includes(provider) ? provider : available[0];
  const attemptedProvider = attempt?.provider ?? "viva";
  const final = supportStatusIsFinal(status);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = validateSupportSummary(await supportRequest<SupportSummary>("/api/support", undefined, signal));
      if (mounted.current && !signal?.aborted) {
        setSummary(result);
        setError("");
      }
    } catch (cause) {
      if (mounted.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : "Cagnotte indisponible.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const { signal } = controller;
    void refresh(signal);
    async function restore() {
      let saved: SupportAttempt | null;
      try {
        saved = readSupportAttempt();
        setStorageReady(true);
      } catch {
        setFormError("La fiche enregistrée est inaccessible. Vérifie le stockage de ce navigateur avant de payer.");
        return;
      }
      if (!saved) {
        try {
          const profile = await supportRequest<{ pseudonym: string }>("/api/support/profile", undefined, signal);
          if (!signal.aborted && typeof profile.pseudonym === "string") setPseudonym(current => current || profile.pseudonym);
        } catch { /* Le formulaire accepte aussi les visiteurs. */ }
        return;
      }
      setAttempt(saved);
      setPseudonym(saved.pseudonym);
      setAmount(String(saved.amountCents / 100).replace(".", ","));
      setProvider(saved.provider ?? "viva");
      setPublishName(saved.publishName);
      setPublishAmount(saved.publishAmount);
      setWork("checking");
      inFlight.current = true;
      try {
        const result = await supportRequest<SupportStatus>("/api/support/status", { id: saved.id, token: saved.token }, signal);
        if (!signal.aborted) setStatus(validateSupportStatus(result, saved));
      } catch (cause) {
        if (!signal.aborted) setFormError(cause instanceof Error ? cause.message : "Vérification indisponible.");
      } finally {
        if (!signal.aborted) {
          setWork(null);
          inFlight.current = false;
        }
      }
    }
    void restore();
    const visible = () => { if (document.visibilityState === "visible") void refresh(signal); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      controller.abort();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (inFlight.current || !storageReady) return;
    inFlight.current = true;
    setWork("creating");
    setFormError("");
    try {
      let current = attempt;
      if (!current) {
        if (!chosenProvider || !summary) return;
        if (amountCents === null || amountCents < summary.campaign.minCents || amountCents > summary.campaign.maxCents) {
          throw new Error(`Choisis un montant entre ${supportEuros(summary.campaign.minCents)} et ${supportEuros(summary.campaign.maxCents)} avec deux décimales au maximum.`);
        }
        const form = parseSupportForm({ pseudonym, amountCents, publishName, publishAmount });
        current = { ...form, provider: chosenProvider, id: crypto.randomUUID(), token: createSupportToken() };
      }
      rememberSupportAttempt(current, gameReturnHref);
      setAttempt(current);
      if (!attempt) requestAnimationFrame(() => formHeading.current?.focus());
      const result = await supportRequest<SupportStatus>("/api/support/checkout", current);
      if (!mounted.current) return;
      const verified = validateSupportStatus(result, current);
      setStatus(verified);
      if (supportStatusIsFinal(verified)) void refresh();
      if (verified.provider !== "swiss-bitcoin-pay") goToSupportPayment(verified);
    } catch (cause) {
      if (mounted.current) setFormError(cause instanceof Error ? cause.message : "Paiement indisponible.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setWork(null);
    }
  }

  async function checkStatus(cancel = false) {
    if (!attempt || inFlight.current) return;
    inFlight.current = true;
    setWork(cancel ? "cancelling" : "checking");
    setFormError("");
    try {
      const result = await supportRequest<SupportStatus>(cancel ? "/api/support/cancel" : "/api/support/status", { id: attempt.id, token: attempt.token });
      if (mounted.current) {
        setStatus(validateSupportStatus(result, attempt));
        void refresh();
      }
    } catch (cause) {
      if (mounted.current) setFormError(cause instanceof Error ? cause.message : "Vérification indisponible.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setWork(null);
    }
  }

  function newSupport() {
    try {
      clearSupportAttempt();
      setAttempt(null);
      setStatus(null);
      setFormError("");
      requestAnimationFrame(() => (pseudoInput.current ?? formHeading.current)?.focus());
    } catch { setFormError("Impossible de préparer une nouvelle fiche dans ce navigateur."); }
  }

  async function more() {
    if (!summary || summary.nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = validateSupportSummary(await supportRequest<SupportSummary>(`/api/support?offset=${summary.nextOffset}`));
      if (mounted.current) {
        if (result.nextOffset === null && document.activeElement === moreButton.current) {
          historyHeading.current?.focus({ preventScroll: true });
        }
        setSummary(current => current ? {
          ...result,
          contributions: [...current.contributions, ...result.contributions.filter(item => !current.contributions.some(old => old.id === item.id))],
        } : result);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Liste indisponible.");
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }

  const amountLabel = amountCents === null ? "" : ` ${supportEuros(amountCents)}`;
  const payLabel = chosenProvider === "swiss-bitcoin-pay" ? `Préparer le don${amountLabel ? " de" + amountLabel : ""} en Bitcoin` : `Payer${amountLabel} par carte`;
  const workLabel = work === "creating" ? "Création de la session de paiement…" : work === "cancelling" ? "Annulation en cours…" : "Vérification auprès du prestataire…";

  return <section className={styles.support} aria-labelledby={standalone ? id + "-title" : undefined} data-financial-support>
    {standalone && <KqChapterHeading title="Soutenir les producteurs" level={1} titleId={id + "-title"} />}
    <div className={styles.overview}>
      <section className={styles.formSection} aria-labelledby={id + "-form"}>
        <h2 id={id + "-form"} tabIndex={-1} ref={formHeading}>Ta contribution</h2>
        <p className={styles.purpose}>La SASU {BUSINESS_IDENTITY.legalName} reçoit ton soutien pour développer le projet. <a href={'#' + id + '-appel'}>Lire notre appel au don</a></p>
        {attempt ? <>
          <div role="status" aria-live="polite">
            <p className={styles.receiptAmount}><strong>{supportEuros(attempt.amountCents)}</strong> · {SUPPORT_PROVIDER_LABELS[attemptedProvider]}</p>
            <p>{work ? workLabel : status ? supportStatusMessage(status) : "L’état de ton paiement reste à vérifier."}</p>
            {status?.refundedCents ? <p>Montant remboursé de {supportEuros(status.refundedCents)}.</p> : null}
          </div>
          <div className={styles.actions}>
            {final ? <button type="button" onClick={newSupport} disabled={!chosenProvider}>Préparer une nouvelle contribution</button> : <>
              {status?.state === "ready" && status.checkoutUrl && !work && (attemptedProvider === "swiss-bitcoin-pay"
                ? <a href={status.checkoutUrl} className={`${styles.buttonLink} ${styles.primary}`}>Ouvrir Swiss Bitcoin Pay</a>
                : <button type="button" className={styles.primary} onClick={() => void submit()}>Reprendre sur Viva</button>)}
              {(!status || status.state === "creating") && !work && <button type="button" onClick={() => void submit()}>Reprendre la préparation</button>}
              <button type="button" disabled={Boolean(work)} onClick={() => void checkStatus()}>Vérifier mon paiement</button>
              {attemptedProvider === "viva" && status?.state === "ready" && <button type="button" disabled={Boolean(work)} onClick={() => void checkStatus(true)}>Annuler cette session</button>}
            </>}
          </div>
          <small className={styles.reference}>Référence de ton soutien&nbsp;: {attempt.id}</small>
        </> : !chosenProvider || !summary ? <p role="status">{summary ? "Les nouvelles contributions sont actuellement fermées." : error ? "Moyens de paiement momentanément indisponibles." : "Vérification des moyens de paiement…"}</p>
          : <form onSubmit={submit}>
            <fieldset disabled={!storageReady || Boolean(work)} className={styles.fields}>
              <legend className={styles.srOnly}>Ta fiche de soutien</legend>
              <div className={styles.amountField}>
                <label htmlFor={id + "-amount"}>Montant (€)<input id={id + "-amount"} name="amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} required aria-describedby={id + "-bounds"} /></label>
                <small id={id + "-bounds"}>De {supportEuros(summary.campaign.minCents)} à {supportEuros(summary.campaign.maxCents)}.</small>
              </div>
              <label className={styles.pseudonymField} htmlFor={id + "-pseudo"}>Ton pseudo<input ref={pseudoInput} id={id + "-pseudo"} name="pseudonym" value={pseudonym} onChange={event => setPseudonym(event.target.value)} required maxLength={32} autoComplete="nickname" /></label>
              <div className={styles.presets} role="group" aria-label="Montants proposés">
                {[2, 5, 10, 20].filter(value => value * 100 >= summary.campaign.minCents && value * 100 <= summary.campaign.maxCents).map(value => <button key={value} type="button" aria-pressed={amountCents === value * 100} onClick={() => setAmount(String(value))}>{value} €</button>)}
              </div>
              <fieldset className={styles.methods}>
                <legend>Moyen de paiement</legend>
                <div className={styles.methodOptions}>
                  {paymentMethods.map(({ provider: method, service, Icon }) => <label key={method}>
                    <input className={styles.methodInput} aria-label={SUPPORT_PROVIDER_LABELS[method]} type="radio" name="provider" value={method} checked={chosenProvider === method} disabled={!available.includes(method)} onChange={() => setProvider(method)} />
                    <span className={styles.methodPlate}>{chosenProvider === method ? <Check size={20} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}<span>{SUPPORT_PROVIDER_LABELS[method]}<small>{available.includes(method) ? service : "Indisponible"}</small></span></span>
                  </label>)}
                </div>
              </fieldset>
              <p className={styles.hint}>Paiement ponctuel en argent réel, sans contrepartie dans le jeu.</p>
              <button className={styles.primary} type="submit"><LockKeyhole size={17} aria-hidden="true" />{payLabel}</button>
              <details className={styles.privacy}>
                <summary>Affichage public · {publishName ? "pseudo visible" : "anonyme"}, {publishAmount ? "montant visible" : "montant masqué"}</summary>
                <label className={styles.check}><input type="checkbox" checked={publishName} onChange={event => setPublishName(event.target.checked)} />Afficher mon pseudo dans la liste publique</label>
                <label className={styles.check}><input type="checkbox" checked={publishAmount} onChange={event => setPublishAmount(event.target.checked)} />Afficher le montant de mon soutien</label>
                <p className={styles.preview}>Dans la liste&nbsp;: <strong>{publishName ? pseudonym || "Ton pseudo" : "Anonyme"}</strong> · {publishAmount && amountCents !== null ? supportEuros(amountCents) : "montant masqué"}.</p>
                {chosenProvider === "viva" && <p className={styles.hint}>Viva peut demander ton nom et ton e-mail. Ces informations restent privées.</p>}
              </details>
            </fieldset>
          </form>}
        {formError && <p className={styles.error} role="alert">{formError}</p>}
      </section>
      <section className={styles.summary} aria-labelledby={id + "-total"}>
        <h2 id={id + "-total"}>La cagnotte</h2>
        <div role="status">
          {!summary ? <p>{error ? "Montant collecté momentanément indisponible." : "Chargement de la cagnotte…"}</p>
            : summary.needsReconciliation ? <p className={styles.pendingTotal}>Total en cours de vérification</p>
            : <>
              <p className={styles.amount}>{supportEuros(summary.collectedCents)} <span>collectés</span></p>
              <p className={styles.count}>{summary.contributionCount} contribution{summary.contributionCount > 1 ? "s" : ""} confirmée{summary.contributionCount > 1 ? "s" : ""}</p>
            </>}
        </div>
        {summary && <>
          {!summary.needsReconciliation && summary.campaign.goalCents !== null && <KqProgressMeter label="Objectif" value={summary.collectedCents} max={summary.campaign.goalCents} valueLabel={`${supportEuros(summary.collectedCents)} sur ${supportEuros(summary.campaign.goalCents)}`} />}
          <small>Remboursements déduits, avant frais.{error ? " Dernières données reçues." : ""}</small>
        </>}
        {error && <div className={styles.actions}>
          <p className={styles.error} role="alert">{error}</p>
          <button type="button" onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" /> Actualiser</button>
        </div>}
      </section>
    </div>
    <section className={styles.presentation} aria-labelledby={id + "-appel"} data-support-presentation>
      <h2 id={id + "-appel"} tabIndex={-1}>Pourquoi on fait appel aux dons</h2>
      <p>Bon, on n’est pas là pour faire la manche… mais la tréso, ça ne pousse pas sous les lampes.</p>
      <p>Chez nous, dès qu’on parle de chanvre à actifs, les banques rangent le chéquier.
        Quand t’as les poches pleines, c’est plus facile de grandir.
        Nous, petits producteurs, on fait avec les moyens du bord.</p>
      <p>Tu peux nous aider en achetant notre CBD. Mais si c’est pas ton truc et que tu kiffes le game,
        tu peux aussi nous glisser un ou deux euros de temps en temps, seulement si l’envie te prend et si tu peux.
        Ça nous aide à faire grandir le projet. Dans tous les cas, un grand merci !</p>
    </section>
    <section className={styles.donors} aria-labelledby={id + "-donors"}>
      <h2 id={id + "-donors"} ref={historyHeading} tabIndex={-1}>Historique des soutiens</h2>
      {summary ? summary.contributions.length ? <ul>{summary.contributions.map(item => <li key={item.id}>
        <span><strong>{item.pseudonym}</strong><time dateTime={item.paidAt}>{supportDate(item.paidAt)}</time></span>
        <span>{item.amountCents === null ? "Montant masqué" : supportEuros(item.amountCents)}</span>
      </li>)}</ul> : <p>Les contributions confirmées apparaîtront ici.</p> : <p>{error ? "Historique momentanément indisponible." : "Chargement de l’historique…"}</p>}
      {summary?.nextOffset != null && <button type="button" ref={moreButton} aria-disabled={loadingMore} onClick={() => void more()}>{loadingMore ? "Chargement…" : "Voir les soutiens précédents"}</button>}
    </section>
    <details className={styles.details}><summary>Utilisation des fonds et confidentialité</summary>
      <p>Le soutien est facultatif, sans objet, bonus, accès privilégié ou avantage dans les concours. Aucun reçu fiscal ni réduction d’impôt.</p>
      <p>Le cumul comprend les contributions anonymes. Le détail de l’utilisation des fonds viendra plus tard.</p>
      {summary && <p>Suivi depuis le {supportDate(summary.campaign.createdAt)}.</p>}
      {summary && !summary.needsReconciliation && <p>{summary.feesCents === null ? "Les frais sont en cours de rapprochement." : `Frais vérifiés de ${supportEuros(summary.feesCents)}. Reste après frais, avant les dépenses du projet : ${supportEuros(summary.collectedCents - summary.feesCents)}.`}</p>}
      <p>Pour modifier l’affichage de ton soutien, contacte <a href={`mailto:${BUSINESS_IDENTITY.email}`}>{BUSINESS_IDENTITY.email}</a> avec sa référence.</p>
    </details>
  </section>;
}
