"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Mail, Pause, Plus, RefreshCw, Save, Send, Users } from "lucide-react";
import { AdminNewsletterPanel } from "@/components/admin/AdminNewsletterPanel";
import { isMailingContactEligible, personalizeMailingText } from "@/lib/mailing-policy";
import type {
  MailingCampaign,
  MailingCampaignDetail,
  MailingContact,
  MailingDraftInput,
  MailingKind,
  MailingRecipientStatus,
  MailingSettings,
} from "@/types/mailing";
import styles from "./AdminMailingPanel.module.css";

type MailingOverview = {
  contacts: MailingContact[];
  campaigns: MailingCampaign[];
  settings: MailingSettings;
};

const recipientLabels: Record<MailingRecipientStatus, string> = {
  pending: "En attente",
  processing: "En cours",
  sent: "Envoyé",
  failed: "Échec",
  skipped: "Écarté",
  uncertain: "Résultat incertain",
};

function emptyDraft(): MailingDraftInput {
  return { id: "", name: "", subject: "", body: "", kind: "marketing", recipientEmails: [] };
}

function campaignLabel(campaign: MailingCampaign): string {
  return campaign.status === "draft" ? "Brouillon" : campaign.status === "completed" ? "Terminée" : "À poursuivre";
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "La requête a échoué. Rechargez les données pour vérifier son résultat.");
  }
  if (!payload) throw new Error("Réponse illisible. Rechargez les données pour vérifier le résultat.");
  return payload as T;
}

export function AdminMailingPanel() {
  const [contacts, setContacts] = useState<MailingContact[]>([]);
  const [campaigns, setCampaigns] = useState<MailingCampaign[]>([]);
  const [settings, setSettings] = useState<MailingSettings | null>(null);
  const [draft, setDraft] = useState<MailingDraftInput>(emptyDraft);
  const [activeCampaign, setActiveCampaign] = useState<MailingCampaign | null>(null);
  const [detail, setDetail] = useState<MailingCampaignDetail | null>(null);
  const [review, setReview] = useState<MailingCampaign | null>(null);
  const [busy, setBusy] = useState<string | null>("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [page, setPage] = useState(0);
  const [testEmail, setTestEmail] = useState("");
  const [pauseRequested, setPauseRequested] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const runningRef = useRef(false);
  const draftIdRef = useRef("");
  const reviewRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    busyRef.current = true;
    let cancelled = false;
    void request<MailingOverview>("/api/admin/mailing")
      .then((payload) => {
        if (cancelled) return;
        setContacts(payload.contacts);
        setCampaigns(payload.campaigns);
        setSettings(payload.settings);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Impossible de charger le centre de mailing.");
      })
      .finally(() => {
        if (!cancelled) { busyRef.current = false; setBusy(null); }
      });
    return () => { cancelled = true; mountedRef.current = false; runningRef.current = false; };
  }, []);

  useEffect(() => {
    if (!review) return;
    reviewRef.current?.focus();
  }, [review]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (busy !== "sending") return;
    const warnOnLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warnOnLeave);
    return () => window.removeEventListener("beforeunload", warnOnLeave);
  }, [busy]);

  const editable = !activeCampaign || activeCampaign.status === "draft";
  const locked = Boolean(busy) || !editable || Boolean(review);
  const eligibleContacts = useMemo(() => contacts.filter((contact) => isMailingContactEligible(contact, draft.kind)), [contacts, draft.kind]);
  const selectedEmails = useMemo(() => {
    const eligible = new Set(eligibleContacts.map((contact) => contact.email.toLowerCase()));
    return [...new Set(draft.recipientEmails.map((email) => email.toLowerCase()).filter((email) => eligible.has(email)))];
  }, [draft.recipientEmails, eligibleContacts]);
  const selection = useMemo(() => new Set(selectedEmails), [selectedEmails]);
  const filteredContacts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr");
    return contacts.filter((contact) => {
      if (group === "customers" && !contact.customer) return false;
      if (group === "subscribers" && !contact.subscribed) return false;
      return !search || `${contact.firstName} ${contact.lastName} ${contact.email}`.toLocaleLowerCase("fr").includes(search);
    });
  }, [contacts, query, group]);
  const pageCount = Math.max(1, Math.ceil(filteredContacts.length / 50));
  const visiblePage = Math.min(page, pageCount - 1);
  const visibleContacts = filteredContacts.slice(visiblePage * 50, (visiblePage + 1) * 50);
  const filteredEligible = filteredContacts.filter((contact) => isMailingContactEligible(contact, draft.kind));
  const selectedCount = editable ? selectedEmails.length : activeCampaign.counts.total;

  function updateDraft(patch: Partial<MailingDraftInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setReview(null);
    setNotice("");
  }

  function upsertCampaign(campaign: MailingCampaign) {
    setCampaigns((current) => [campaign, ...current.filter((item) => item.id !== campaign.id)].slice(0, 50));
    setActiveCampaign(campaign);
  }

  function showError(cause: unknown) {
    if (mountedRef.current) setError(cause instanceof Error ? cause.message : "Une erreur est survenue. Vérifiez l’état de la campagne avant de réessayer.");
  }

  async function perform(label: string, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try { await action(); } catch (cause) { showError(cause); }
    finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(null);
    }
  }

  async function saveDraft(): Promise<MailingCampaign> {
    validateMessage();
    if (!draft.name.trim()) throw new Error("Donnez un nom à la campagne pour la retrouver dans l’historique.");
    if (!draftIdRef.current) draftIdRef.current = crypto.randomUUID();
    if (selectedEmails.length > 10000) throw new Error("Une campagne est limitée à 10 000 adresses. Réduisez la sélection.");
    const input: MailingDraftInput = { ...draft, id: draftIdRef.current, recipientEmails: selectedEmails };
    const payload = await request<{ campaign: MailingCampaign }>("/api/admin/mailing", input);
    if (mountedRef.current) {
      setDraft(payload.campaign);
      upsertCampaign(payload.campaign);
    }
    return payload.campaign;
  }

  function validateMessage(): void {
    if (!draft.subject.trim() || !draft.body.trim()) throw new Error("Renseignez l’objet et le message avant de continuer.");
  }

  async function reload() {
    await perform("loading", async () => {
      const payload = await request<MailingOverview>("/api/admin/mailing");
      if (!mountedRef.current) return;
      setContacts(payload.contacts);
      setCampaigns(payload.campaigns);
      setSettings(payload.settings);
      setReview(null);
      if (activeCampaign) {
        const result = await request<MailingCampaignDetail>(`/api/admin/mailing/${activeCampaign.id}`);
        if (!mountedRef.current) return;
        setDetail(result);
        setActiveCampaign(result.campaign);
        if (result.campaign.status !== "draft") setDraft(result.campaign);
      }
      setNotice("Données actualisées.");
    });
  }

  function newCampaign() {
    if (busyRef.current) return;
    draftIdRef.current = "";
    setDraft(emptyDraft());
    setActiveCampaign(null);
    setDetail(null);
    setReview(null);
    setError("");
    setNotice("");
    setQuery("");
    setGroup("all");
    setPage(0);
    headingRef.current?.focus();
  }

  async function openCampaign(campaign: MailingCampaign) {
    await perform("opening", async () => {
      const payload = await request<MailingCampaignDetail>(`/api/admin/mailing/${campaign.id}`);
      if (!mountedRef.current) return;
      draftIdRef.current = campaign.id;
      setDraft(payload.campaign);
      setActiveCampaign(payload.campaign);
      setDetail(payload);
      setReview(null);
      headingRef.current?.focus();
    });
  }

  async function processCampaign(id: string) {
    runningRef.current = true;
    setPauseRequested(false);
    setBusy("sending");
    try {
      while (runningRef.current && mountedRef.current) {
        const result = await request<MailingCampaignDetail>(`/api/admin/mailing/${id}/process`, {});
        if (!mountedRef.current) return;
        setDetail(result);
        upsertCampaign(result.campaign);
        if (result.campaign.status === "completed") {
          setNotice("Campagne terminée. Consultez le bilan des envois ci-dessous.");
          return;
        }
        if (runningRef.current) await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
      }
      if (mountedRef.current) setNotice("Envoi en pause. Vous pourrez le reprendre depuis cette campagne.");
    } catch (cause) {
      if (mountedRef.current) {
        setNotice("L’envoi est arrêté. Actualisez pour vérifier le dernier message avant de reprendre. Les résultats incertains ne sont pas renvoyés automatiquement.");
      }
      throw cause;
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setPauseRequested(false);
    }
  }

  async function startCampaign() {
    if (!review) return;
    const campaignId = review.id;
    const expectedUpdatedAt = review.updatedAt;
    await perform("starting", async () => {
      const result = await request<{ campaign: MailingCampaign }>(`/api/admin/mailing/${campaignId}/start`, { confirmed: true, expectedUpdatedAt });
      if (!mountedRef.current) return;
      upsertCampaign(result.campaign);
      setDraft(result.campaign);
      setReview(null);
      setDetail({ campaign: result.campaign, recipients: [] });
      await processCampaign(campaignId);
    });
  }

  return (
    <section className={styles.panel} aria-labelledby="mailing-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}><Mail size={15} aria-hidden="true" /> La communauté</p>
          <h2 id="mailing-title">Centre de mailing</h2>
          <p>Préparez vos messages, choisissez vos contacts et suivez chaque envoi.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => void reload()} disabled={Boolean(busy)}><RefreshCw size={16} aria-hidden="true" /> Actualiser</button>
          <button type="button" className={styles.primary} onClick={newCampaign} disabled={Boolean(busy)}><Plus size={16} aria-hidden="true" /> Nouvelle campagne</button>
        </div>
      </header>

      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {busy === "loading" && <p role="status" className={styles.hint}>Chargement du centre de mailing…</p>}
      {settings && !settings.configured && <div className={styles.warning}><strong>Envoi indisponible</strong><p>{settings.error || "La configuration d’envoi des e-mails est incomplète."} Les brouillons restent disponibles.</p></div>}
      {settings?.configured && <p className={styles.sender}>Expéditeur : <strong>{settings.fromName}</strong> &lt;{settings.fromEmail}&gt;{settings.replyTo && <> · Réponses : {settings.replyTo}</>}</p>}

      <div className={styles.composerHeader}>
        <h3 ref={headingRef} tabIndex={-1}>{editable ? "Préparer une campagne" : activeCampaign?.name || "Détail de la campagne"}</h3>
        <span className={styles.badge}>{activeCampaign ? campaignLabel(activeCampaign) : "Nouveau brouillon"}</span>
      </div>
      <div className={styles.composer}>
        <div className={styles.editor}>
          <div className={styles.fields}>
            <label htmlFor="mailing-name">Nom de la campagne <span>Visible uniquement dans l’admin</span><input id="mailing-name" value={draft.name} maxLength={120} disabled={locked} placeholder="Les nouvelles d’octobre" onChange={(event) => updateDraft({ name: event.target.value })} /></label>
            <label htmlFor="mailing-kind">Type de message<select id="mailing-kind" value={draft.kind} disabled={locked} onChange={(event) => {
              const kind = event.target.value as MailingKind;
              const eligible = new Set(contacts.filter((contact) => isMailingContactEligible(contact, kind)).map((contact) => contact.email.toLowerCase()));
              updateDraft({ kind, recipientEmails: draft.recipientEmails.filter((email) => eligible.has(email.toLowerCase())) });
            }}><option value="marketing">Newsletter / offre commerciale</option><option value="information">Information client (sans promotion)</option></select></label>
          </div>
          <label className={styles.field} htmlFor="mailing-subject">Objet du mail<input id="mailing-subject" value={draft.subject} maxLength={200} disabled={locked} placeholder="Des nouvelles des Chanvriers Bretons" onChange={(event) => updateDraft({ subject: event.target.value })} /></label>
          <label className={styles.field} htmlFor="mailing-body">Message<textarea id="mailing-body" value={draft.body} maxLength={20000} rows={12} disabled={locked} placeholder={"Bonjour {{prenom}},\n\nÉcrivez votre message ici…"} onChange={(event) => updateDraft({ body: event.target.value })} /></label>
          <p className={styles.hint}>Texte simple, retours à la ligne conservés. <code>{"{{prenom}}"}</code> devient le prénom du contact, ou « cher client » s’il est inconnu. Le lien de désinscription est ajouté automatiquement.</p>
        </div>

        <aside className={styles.previewArea} aria-label="Aperçu du mail">
          <div className={styles.previewHeading}><h4>Aperçu</h4><span>Exemple avec Camille</span></div>
          <div className={styles.preview}>
            <div className={styles.previewBrand}>LES CHANVRIERS BRETONS</div>
            <div className={styles.previewContent}><h4>{personalizeMailingText(draft.subject, "Camille") || "L’objet de votre mail"}</h4><p>{personalizeMailingText(draft.body, "Camille") || "Votre message apparaîtra ici."}</p></div>
            <div className={styles.previewFooter}>Vous recevez ce message des Chanvriers Bretons.<br /><span>Se désinscrire</span></div>
          </div>
          <form className={styles.testForm} onSubmit={(event) => {
            event.preventDefault();
            void perform("testing", async () => {
              validateMessage();
              await request("/api/admin/mailing/test", { subject: draft.subject, body: draft.body, email: testEmail.trim() });
              if (mountedRef.current) setNotice(`Un e-mail de test a été envoyé à ${testEmail.trim()}.`);
            });
          }}>
            <label className={styles.field} htmlFor="mailing-test">Adresse de test<input id="mailing-test" type="email" required value={testEmail} disabled={Boolean(busy)} autoComplete="email" placeholder="votre.adresse@exemple.fr" onChange={(event) => setTestEmail(event.target.value)} /></label>
            <button className={styles.secondary} type="submit" disabled={Boolean(busy) || !settings?.configured || !draft.subject.trim() || !draft.body.trim()}><Send size={15} aria-hidden="true" />{busy === "testing" ? "Envoi du test…" : "Envoyer le test"}</button>
            <p className={styles.hint}>Envoie uniquement à cette adresse, sans lancer la campagne.</p>
          </form>
        </aside>
      </div>

      {editable && <section className={styles.contacts} aria-labelledby="mailing-contacts-title">
        <div className={styles.sectionHeading}><h3 id="mailing-contacts-title"><Users size={18} aria-hidden="true" /> Destinataires</h3><span className={styles.count}>{selectedCount} adresse{selectedCount > 1 ? "s" : ""} sélectionnée{selectedCount > 1 ? "s" : ""}</span></div>
        <p className={styles.hint}>{draft.kind === "marketing" ? "Les newsletters et offres sont réservées aux abonnés actifs. La création d’un compte client ne constitue pas un abonnement marketing." : "Ce message s’adresse aux clients et doit rester informatif, sans offre commerciale."} Les contacts désinscrits sont exclus. Chaque adresse ne reçoit qu’un seul message.</p>
        <div className={styles.filters}>
          <label className={styles.field} htmlFor="mailing-search">Rechercher un contact<input id="mailing-search" type="search" value={query} placeholder="Nom ou e-mail" disabled={locked} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>
          <label className={styles.field} htmlFor="mailing-group">Groupe de contacts<select id="mailing-group" value={group} disabled={locked} onChange={(event) => { setGroup(event.target.value); setPage(0); }}><option value="all">Tous les contacts</option><option value="customers">Clients</option><option value="subscribers">Abonnés newsletter</option></select></label>
        </div>
        <div className={styles.selectionActions}>
          <span>{filteredContacts.length} contact{filteredContacts.length > 1 ? "s" : ""} · {filteredEligible.length} éligible{filteredEligible.length > 1 ? "s" : ""}</span>
          <button type="button" disabled={locked || !filteredEligible.length} onClick={() => updateDraft({ recipientEmails: [...new Set([...selectedEmails, ...filteredEligible.map((contact) => contact.email.toLowerCase())])] })}>Sélectionner les résultats</button>
          <button type="button" disabled={locked || !selectedCount} onClick={() => updateDraft({ recipientEmails: [] })}>Tout désélectionner</button>
        </div>
        <div className={styles.contactList}>
          {visibleContacts.length === 0 ? <p className={styles.empty}>Aucun contact ne correspond à cette recherche.</p> : visibleContacts.map((contact) => {
            const eligible = isMailingContactEligible(contact, draft.kind);
            const email = contact.email.toLowerCase();
            return <label className={styles.contact} key={email} data-excluded={!eligible || undefined}>
              <input type="checkbox" aria-label={`Sélectionner ${contact.email}`} checked={selection.has(email)} disabled={locked || !eligible} onChange={(event) => updateDraft({ recipientEmails: event.target.checked ? [...selectedEmails, email] : selectedEmails.filter((selected) => selected !== email) })} />
              <span className={styles.contactIdentity}><strong>{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email}</strong><span>{contact.email}</span></span>
              <span className={styles.contactTag}>{contact.unsubscribed ? "Désinscrit" : !eligible ? draft.kind === "marketing" ? "Non abonné" : "Sans compte client" : contact.customer && contact.subscribed ? "Client · Abonné" : contact.customer ? "Client" : "Abonné"}</span>
            </label>;
          })}
        </div>
        {pageCount > 1 && <div className={styles.pagination}><button type="button" className={styles.secondary} aria-label="Contacts précédents" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}><ChevronLeft size={16} /></button><span>Page {visiblePage + 1} sur {pageCount}</span><button type="button" className={styles.secondary} aria-label="Contacts suivants" disabled={visiblePage === pageCount - 1} onClick={() => setPage(visiblePage + 1)}><ChevronRight size={16} /></button></div>}
        <div className={styles.draftActions}>
          <button type="button" className={styles.secondary} disabled={locked || !settings} onClick={() => void perform("saving", async () => { await saveDraft(); if (mountedRef.current) setNotice("Brouillon enregistré. Retrouvez-le dans l’historique."); })}><Save size={16} aria-hidden="true" />{busy === "saving" ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
          <button type="button" className={styles.primary} disabled={locked || !settings?.configured || !selectedCount} onClick={() => void perform("reviewing", async () => {
            validateMessage();
            if (!draft.name.trim()) throw new Error("Donnez un nom à la campagne pour la retrouver dans l’historique.");
            const campaign = await saveDraft();
            if (mountedRef.current) setReview(campaign);
          })}><Send size={16} aria-hidden="true" />{busy === "reviewing" ? "Préparation…" : "Vérifier l’envoi"}</button>
        </div>
      </section>}

      {review && <div ref={reviewRef} tabIndex={-1} className={styles.confirmation} role="region" aria-labelledby="mailing-confirm-title">
        <h3 id="mailing-confirm-title">Confirmer l’envoi groupé</h3>
        <p><strong>{review.recipientEmails.length} destinataire{review.recipientEmails.length > 1 ? "s" : ""}</strong> recevront ce message, individuellement.</p>
        <p>Objet : <strong>{review.subject}</strong></p>
        <p className={styles.hint}>Le contenu et la liste seront figés au lancement. Les désinscriptions seront à nouveau vérifiées avant chaque envoi. Gardez cet onglet ouvert pendant l’envoi.</p>
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={() => setReview(null)}>Revenir au brouillon</button><button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={() => void startCampaign()}><Check size={17} aria-hidden="true" />{busy === "starting" ? "Lancement…" : "Confirmer et envoyer"}</button></div>
      </div>}

      {activeCampaign && !editable && <section className={styles.progressSection} aria-labelledby="mailing-progress-title">
        <div className={styles.sectionHeading}><h3 id="mailing-progress-title">Suivi de l’envoi</h3><span className={styles.badge}>{busy === "sending" ? pauseRequested ? "Pause demandée" : "Envoi en cours" : campaignLabel(activeCampaign)}</span></div>
        <progress max={Math.max(1, activeCampaign.counts.total)} value={activeCampaign.counts.sent + activeCampaign.counts.failed + activeCampaign.counts.skipped + activeCampaign.counts.uncertain} aria-label="Progression de la campagne" />
        <dl className={styles.stats}>{([
          ["sent", "Envoyés"], ["failed", "Échecs"], ["skipped", "Écartés"], ["uncertain", "Incertains"], ["pending", "En attente"],
        ] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{activeCampaign.counts[key]}</dd></div>)}</dl>
        <p className={styles.hint}>{activeCampaign.counts.total} destinataire{activeCampaign.counts.total > 1 ? "s" : ""} au total{activeCampaign.counts.processing > 0 ? ` · ${activeCampaign.counts.processing} message en cours de traitement` : ""}. Un message « envoyé » a été accepté par le serveur de messagerie, sans garantie de réception.</p>
        {(activeCampaign.counts.failed > 0 || activeCampaign.counts.uncertain > 0) && <p className={styles.warning}>Les échecs et résultats incertains ne sont pas renvoyés automatiquement. Consultez leurs détails avant toute nouvelle campagne.</p>}
        {activeCampaign.status === "sending" && <>
          <p className={styles.hint}>Changer de rubrique ou fermer cet onglet met l’envoi en pause après le message en cours. La reprise est toujours manuelle.</p>
          {busy === "sending" ? <button type="button" className={styles.secondary} disabled={pauseRequested} onClick={() => { runningRef.current = false; setPauseRequested(true); }}><Pause size={16} aria-hidden="true" />{pauseRequested ? "Fin du message en cours…" : "Mettre en pause"}</button> : <button type="button" className={styles.primary} disabled={Boolean(busy) || !settings?.configured} onClick={() => void perform("sending", () => processCampaign(activeCampaign.id))}><Send size={16} aria-hidden="true" />Reprendre l’envoi</button>}
        </>}
        {detail && <details className={styles.recipientDetails}><summary>Voir le détail des destinataires ({detail.recipients.length}{activeCampaign.counts.total > detail.recipients.length ? ` sur ${activeCampaign.counts.total}` : ""})</summary>{detail.recipients.length === 0 ? <p className={styles.hint}>Actualisez pour consulter les destinataires.</p> : <ul>{detail.recipients.map((recipient) => <li key={recipient.id}><div><strong>{recipient.email}</strong><span className={styles.badge} data-status={recipient.status}>{recipientLabels[recipient.status]}</span></div>{recipient.error && <p>{recipient.error}</p>}{recipient.sentAt && <small>{dateLabel(recipient.sentAt)}</small>}</li>)}</ul>}{activeCampaign.counts.total > detail.recipients.length && <p className={styles.hint}>Les compteurs portent sur tous les destinataires. Le détail affiche les 100 premières entrées.</p>}</details>}
      </section>}

      <section className={styles.history} aria-labelledby="mailing-history-title">
        <div className={styles.sectionHeading}><h3 id="mailing-history-title">Historique des campagnes</h3><span className={styles.hint}>Les 50 dernières campagnes</span></div>
        {campaigns.length === 0 ? <p className={styles.empty}>Vos brouillons et campagnes apparaîtront ici.</p> : <div className={styles.historyList}>{campaigns.map((campaign) => <button type="button" className={styles.historyItem} key={campaign.id} disabled={Boolean(busy)} aria-current={activeCampaign?.id === campaign.id ? "true" : undefined} onClick={() => void openCampaign(campaign)}><span><strong>{campaign.name || "Campagne sans nom"}</strong><span>{campaign.subject || "Sans objet"}</span><small>{dateLabel(campaign.createdAt)} · {campaign.status === "draft" ? campaign.recipientEmails.length : campaign.counts.total} destinataire{campaign.recipientEmails.length > 1 ? "s" : ""}{campaign.status !== "draft" ? ` · ${campaign.counts.sent} envoyé(s)` : ""}</small></span><span className={styles.badge}>{campaignLabel(campaign)}</span><ChevronRight size={18} aria-hidden="true" /></button>)}</div>}
      </section>
      <details className={styles.exports} onToggle={(event) => setShowExports(event.currentTarget.open)}><summary>Gestion et export des inscriptions newsletter</summary>{showExports && <AdminNewsletterPanel />}</details>
    </section>
  );
}
