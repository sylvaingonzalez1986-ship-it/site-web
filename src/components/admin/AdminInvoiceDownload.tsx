"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  INVOICE_PERSONAL_MESSAGE_MAX_LENGTH,
  INVOICE_PERSONAL_MESSAGE_MAX_LINES,
  validateInvoicePersonalMessage,
} from "@/lib/invoice-message";

type AdminInvoiceDownloadProps = { orderId: string; eligible: boolean };

class InvoiceRequestError extends Error {}

export function AdminInvoiceDownload(props: AdminInvoiceDownloadProps) {
  // A different order always gets a fresh draft and cancels the old request.
  return <InvoiceDownloadForm key={`${props.orderId}-${props.eligible}`} {...props} />;
}

function InvoiceDownloadForm({ orderId, eligible }: AdminInvoiceDownloadProps) {
  const [message, setMessage] = useState("");
  const [messageLoaded, setMessageLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const downloadRequest = useRef<AbortController | null>(null);
  const requestInFlight = useRef(false);
  const endpoint = `/api/admin/orders/${encodeURIComponent(orderId)}/invoice`;
  const validation = validateInvoicePersonalMessage(message);

  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    setLoadError(null);
    setMessageLoaded(false);
    void (async () => {
      try {
        const response = await fetch(`${endpoint}/message`, {
          cache: "no-store", credentials: "include", signal: controller.signal,
        });
        const data = await response.json().catch(() => null) as { personalMessage?: unknown; error?: unknown } | null;
        if (!response.ok) throw new InvoiceRequestError(typeof data?.error === "string" ? data.error : "Impossible de charger le message de cette facture.");
        const result = validateInvoicePersonalMessage(data?.personalMessage);
        if (!result.ok) throw new InvoiceRequestError("Le message enregistré n’a pas pu être chargé. Réessaie avant de télécharger la facture.");
        if (controller.signal.aborted) return;
        setMessage(result.message);
        setMessageLoaded(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof InvoiceRequestError ? error.message : "Impossible de charger le message. Vérifie ta connexion, puis réessaie.");
      }
    })();
    return () => controller.abort();
  }, [eligible, endpoint, loadAttempt]);

  useEffect(() => () => downloadRequest.current?.abort(), []);

  const downloadInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!eligible || !messageLoaded || !validation.ok || requestInFlight.current) return;

    requestInFlight.current = true;
    const controller = new AbortController();
    downloadRequest.current = controller;
    setDownloadError(null);
    setNotice("");
    setDownloading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalMessage: validation.message }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new InvoiceRequestError(typeof data?.error === "string" ? data.error : "Impossible de télécharger la facture. Ton texte est conservé : réessaie.");
      }
      if (!(response.headers.get("content-type") || "").toLowerCase().includes("application/pdf")) {
        throw new InvoiceRequestError("Le serveur n’a pas renvoyé une facture PDF. Ton texte est conservé : réessaie.");
      }
      const blob = await response.blob();
      if (blob.size < 100 || await blob.slice(0, 5).text() !== "%PDF-") {
        throw new InvoiceRequestError("Le PDF reçu est vide ou invalide. Ton texte est conservé : réessaie.");
      }
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      const filename = response.headers.get("content-disposition")?.match(/filename="(facture-[a-zA-Z0-9_-]+\.pdf)"/)?.[1]
        || `facture-${orderId.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage(validation.message);
      setNotice("Facture prête. Le message est enregistré pour les prochains téléchargements.");
    } catch (error) {
      if (!controller.signal.aborted) {
        setDownloadError(error instanceof InvoiceRequestError ? error.message : "Le téléchargement a échoué. Vérifie ta connexion puis réessaie ; ton texte est conservé.");
      }
    } finally {
      requestInFlight.current = false;
      if (!controller.signal.aborted) setDownloading(false);
    }
  };

  return (
    <form onSubmit={downloadInvoice} className="mt-6 card-cartoon bg-white p-4" aria-label="Préparer la facture" aria-busy={downloading}>
      <h4 className="font-display text-2xl text-ink">Un petit mot sur la facture</h4>
      {eligible ? <>
        <p id="invoice-message-help" className="mt-2 text-sm leading-relaxed text-charcoal">
          Ajoute un message personnel pour ce client. Il sera enregistré au téléchargement
          et visible sur sa facture, y compris dans son espace client. Laisse le champ vide pour ne pas ajouter de message.
        </p>
        {!messageLoaded && !loadError && <p className="mt-3 text-sm text-charcoal" role="status">Chargement du message…</p>}
        {loadError && <div className="mt-3 rounded border border-red-700 bg-red-50 p-3">
          <p role="alert" className="text-sm text-red-800">{loadError}</p>
          <button type="button" className="btn-cartoon btn-secondary mt-3" onClick={() => setLoadAttempt((value) => value + 1)}>Réessayer</button>
        </div>}
        <label htmlFor="invoice-personal-message" className="mt-4 block text-sm font-semibold text-ink">Message personnalisé <span className="font-normal text-charcoal">(facultatif)</span></label>
        <textarea
          id="invoice-personal-message"
          name="personalMessage"
          className="mt-2 min-h-28 w-full border border-[#00563f] bg-white p-3 text-base"
          rows={4}
          maxLength={INVOICE_PERSONAL_MESSAGE_MAX_LENGTH}
          disabled={!messageLoaded || downloading}
          value={message}
          onChange={(event) => { setMessage(event.target.value); setDownloadError(null); setNotice(""); }}
          placeholder="Merci pour ta commande, Camille ! Bonne dégustation et à bientôt."
          aria-describedby={`invoice-message-help invoice-message-count${!validation.ok ? " invoice-message-validation" : ""}`}
          aria-invalid={!validation.ok || undefined}
        />
        <p id="invoice-message-count" className="mt-1 text-xs text-charcoal">{message.length} / {INVOICE_PERSONAL_MESSAGE_MAX_LENGTH} caractères · {INVOICE_PERSONAL_MESSAGE_MAX_LINES} lignes maximum</p>
        {!validation.ok && <p id="invoice-message-validation" role="alert" className="mt-2 text-sm font-semibold text-red-700">{validation.error}</p>}
        {messageLoaded && validation.ok && validation.message && <div className="mt-4 rounded border border-[#00563f]/25 bg-[#f6f0e6] p-3" data-invoice-message-preview>
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal">Aperçu du message</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{validation.message}</p>
        </div>}
      </> : <p className="mt-2 text-sm text-charcoal">Facture disponible uniquement pour les commandes payées.</p>}
      <button type="submit" className="btn-cartoon btn-primary mt-4 w-full sm:w-auto" disabled={!eligible || !messageLoaded || downloading || !validation.ok}>
        {downloading ? "Préparation de la facture…" : "Télécharger la facture"}
      </button>
      {downloadError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{downloadError}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-[#00563f]">{notice}</p>}
    </form>
  );
}
