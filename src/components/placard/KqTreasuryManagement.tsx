"use client";

import { useKqTutorialApi, type KqTutorialApi } from "./KqTutorialApiContext";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, LoaderCircle, RefreshCw } from "lucide-react";
import { createClientRequestKey } from "@/lib/client-request-key";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import type { KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { KqBusinessPanel } from "./KqBusinessPanel";
import type { KqOnlineBusinessTab, KqOnlineBusinessView, KqOnlineUpgradeView } from "./KqOnlineBusiness";
import { KqTreasuryInvoices } from "./KqTreasuryInvoices";
import styles from "./KqTreasuryManagement.module.css";

type Confirmation = { title: string; description: string; body: Record<string, unknown>; cost: number; endpoint: "commerce" | "energy" };
async function request<T>(api: KqTutorialApi, body?: Record<string, unknown>, endpoint: "commerce" | "energy" = "commerce"): Promise<T> {
  const response = await api.request(`/api/arena/placard/${endpoint}${body || endpoint === "energy" ? "" : "?shop=1"}`, body
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "La gestion est momentanément indisponible.");
  return result as T;
}

function ManagementConfirmation({ confirmation, busy, error, onClose, onConfirm }: {
  confirmation: Confirmation; busy: boolean; error: string; onClose: () => void; onConfirm: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useBodyScrollLock(true);
  useLayoutEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    cancel.current?.focus({ preventScroll: true });
    return () => {
      if (element?.open) element.close();
      if (previous?.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  return <dialog ref={dialog} className={styles.confirm} aria-labelledby={`${id}-title`} aria-describedby={`${id}-cost`} tabIndex={-1}
    data-management-confirmation
    onCancel={event => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    }}
    onKeyDown={event => {
      if (event.key === "Escape") event.stopPropagation();
      if (event.key !== "Tab") return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary',
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0
        && getComputedStyle(element).visibility !== "hidden" && !element.closest("[inert]")
        && element.closest("dialog") === event.currentTarget);
      const first = focusable[0], last = focusable.at(-1);
      const active = document.activeElement;
      const insideSequence = focusable.some(element => element === active);
      if (!first || !last) {
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      } else if (event.shiftKey && (active === first || !insideSequence)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (active === last || !insideSequence)) {
        event.preventDefault(); first.focus();
      }
    }}>
    <header className={styles.confirmHeader}><h2 id={`${id}-title`}>{confirmation.title}</h2></header>
    <div className={styles.confirmBody} tabIndex={0} role="region" aria-label="Détails de l’opération" data-management-confirmation-body>
      <p>{confirmation.description}</p>
      {error ? <p ref={errorMessage} className={styles.error} id={`${id}-error`} role="alert" tabIndex={-1} data-management-confirmation-error>{error}</p> : null}
    </div>
    <footer className={styles.confirmFooter}>
      <p className={styles.amount} id={`${id}-cost`} data-management-confirmation-cost>{confirmation.cost
        ? <><span>Débit immédiat</span><strong>{formatKqCash(confirmation.cost)}</strong></>
        : <strong>Aucun débit immédiat</strong>}</p>
      <div className={styles.confirmActions}>
        <button ref={cancel} type="button" className={styles.secondary} disabled={busy} onClick={onClose} data-management-cancel>Revenir</button>
        <button type="button" className={styles.primary} disabled={busy} onClick={onConfirm} aria-busy={busy || undefined}
          aria-describedby={`${id}-cost${error ? ` ${id}-error` : ""}`} data-management-confirm>
          {busy ? <LoaderCircle size={18} className={styles.spin} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}{busy ? "Validation…" : "Confirmer"}
        </button>
      </div>
    </footer>
  </dialog>;
}

export function KqTreasuryManagement({ onOpenShop, onUpdated, onPrepareStock, onViewSales, view, onViewChange, initialView, initialUpgradeView, section = "management" }: {
  onOpenShop: (equipmentCode?: string) => void; onUpdated?: () => void; onPrepareStock?: () => void; onViewSales?: (listingId?: string) => void; view?: KqOnlineBusinessTab; onViewChange?: (view: KqOnlineBusinessTab) => void; initialView?: KqOnlineBusinessView; initialUpgradeView?: KqOnlineUpgradeView; section?: "invoices" | "management";
}) {
  const api = useKqTutorialApi();
  const [data, setData] = useState<KqCommerceSnapshot | null>(null);
  const [energy, setEnergy] = useState<KqEnergySnapshot | null>(null);
  const [energyError, setEnergyError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [liveNow, setLiveNow] = useState<number | undefined>();
  const clock = useRef<{ server: number; received: number } | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const refreshedEvents = useRef(new Set<string>());
  const committing = useRef(false);
  const hasOnline = Boolean(data?.online);
  const load = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const pending = (async () => {
      try {
        const [commerceResult, energyResult] = await Promise.allSettled([
          request<KqCommerceSnapshot>(api),
          section === "invoices" ? request<KqEnergySnapshot>(api, undefined, "energy") : Promise.resolve(null),
        ]);
        if (commerceResult.status === "rejected") throw commerceResult.reason;
        const result = commerceResult.value;
        if (!result.business) throw new Error("La gestion de ton entreprise est momentanément indisponible.");
        const server = Date.parse(result.business.serverNow);
        clock.current = { server, received: performance.now() };
        setLiveNow(server); setData(result); setError("");
        if (energyResult.status === "fulfilled" && (section === "management" || (energyResult.value
          && Array.isArray(energyResult.value.invoices) && Number.isSafeInteger(energyResult.value.outstandingCents)
          && energyResult.value.outstandingCents >= 0))) { setEnergy(energyResult.value); setEnergyError(""); }
        else { setEnergy(null); setEnergyError("Le détail des factures d’électricité et de soins n’a pas pu être chargé."); }
        // Reading the business calendar can settle due invoices and subscriptions.
        api.notify("kq:treasury-updated");
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Gestion indisponible."); }
      finally { setLoading(false); }
    })();
    inFlight.current = pending;
    void pending.finally(() => { if (inFlight.current === pending) inFlight.current = null; });
    return pending;
  }, [api, section]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !busy && !confirmation) void load(); };
    return api.subscribe(["kq:equipment-updated", "kq:commerce-updated"], refresh);
  }, [api, load, busy, confirmation]);
  useEffect(() => {
    const tick = () => { if (!document.hidden && clock.current) setLiveNow(clock.current.server + Math.max(0, performance.now() - clock.current.received)); };
    const resume = () => { tick(); if (!document.hidden && !busy && !confirmation) void load(); };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [load, busy, confirmation]);
  useEffect(() => {
    if (section !== "management" || !hasOnline || busy || confirmation) return;
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => window.clearInterval(timer);
  }, [section, hasOnline, busy, confirmation, load]);
  useEffect(() => {
    if (liveNow === undefined || document.hidden || busy || confirmation) return;
    const next = data?.business?.nextEventAt;
    const mission = data?.online?.marketing.active;
    const events = [
      ...(next ? [{ key: `business:${next}`, at: next }] : []),
      ...(mission?.version === 2 ? [{ key: `marketing-launch:${mission.id}:${mission.launchesAt}`, at: mission.launchesAt }] : []),
      ...(mission ? [{ key: `marketing:${mission.id}:${mission.endsAt}`, at: mission.endsAt }] : []),
    ];
    const due = events.filter(event => liveNow >= Date.parse(event.at) && !refreshedEvents.current.has(event.key));
    if (!due.length) return;
    // A stale response can retain an elapsed event. Refresh each event once;
    // regular polling can retry without a render/request loop.
    due.forEach(event => refreshedEvents.current.add(event.key));
    void load();
  }, [data?.business?.nextEventAt, data?.online?.marketing.active, liveNow, busy, confirmation, load]);
  function ask(title: string, description: string, body: Record<string, unknown>, cost = 0, endpoint: "commerce" | "energy" = "commerce") {
    setError(""); setNotice("");
    setConfirmation({ title, description, body: { ...body, requestKey: createClientRequestKey() }, cost, endpoint });
  }
  async function commit() {
    if (!confirmation || committing.current) return;
    committing.current = true; setBusy(true); setError("");
    try {
      await request(api, confirmation.body, confirmation.endpoint);
      setConfirmation(null); setNotice(confirmation.body.action === "pay-all-invoices" ? "Règlement global enregistré. Tes factures ont été actualisées." : confirmation.endpoint === "energy" || confirmation.body.action === "pay-lab" || confirmation.body.action === "pay-supplier" ? "Règlement enregistré. Tes factures ont été actualisées." : "La gestion de ton entreprise a été mise à jour.");
      if (inFlight.current) await inFlight.current;
      await load();
      api.notify("kq:equipment-updated");
      api.notify("kq:treasury-updated");
      onUpdated?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Opération indisponible."); }
    finally { committing.current = false; setBusy(false); }
  }
  return <section className={styles.management} aria-label={section === "invoices" ? "Factures et échéances" : "Gestion de mon entreprise"}>
    {loading ? <p className={styles.loading} role="status"><LoaderCircle size={19} className={styles.spin} aria-hidden="true" /> {section === "invoices" ? "Ouverture des factures…" : "Ouverture de la gestion…"}</p> : null}
    {error && !confirmation ? <p className={styles.error} role="alert">{error}<button type="button" className={styles.secondary} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" /> Actualiser</button></p> : null}
    {notice ? <p className={styles.notice} role="status"><Check size={18} aria-hidden="true" /> {notice}</p> : null}
    {data ? section === "invoices" ? <KqTreasuryInvoices data={data} energy={energy} energyError={energyError} now={liveNow} busy={busy} onAsk={ask} onRetry={() => void load()} onPayEnergy={amount => ask("Régler l’électricité et les soins", `Le solde de ${formatKqCash(amount)} sera débité de ta trésorerie disponible pour acquitter les factures d’électricité et de soins. Les factures de laboratoire et fournisseur sont réglées séparément.`, { expectedCents: amount }, amount, "energy")} /> : <KqBusinessPanel data={data} now={liveNow} busy={busy} onAsk={ask} onOpenShop={() => onOpenShop("COMPUTER")} onPrepareStock={onPrepareStock} onViewSales={onViewSales} view={view} onViewChange={onViewChange} initialView={initialView} initialUpgradeView={initialUpgradeView} expanded showAccounting={false} /> : null}
    {confirmation ? <ManagementConfirmation confirmation={confirmation} busy={busy} error={error} onClose={() => { if (!busy) { setConfirmation(null); setError(""); } }} onConfirm={() => void commit()} /> : null}
  </section>;
}
