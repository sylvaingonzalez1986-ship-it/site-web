"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import { createClientRequestKey } from "@/lib/client-request-key";
import type { KqCommerceReceipt, KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { KqBusinessPanel } from "./KqBusinessPanel";
import styles from "./KqTreasuryManagement.module.css";

type Confirmation = { title: string; description: string; body: Record<string, unknown>; cost: number };
async function request<T>(body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/arena/placard/commerce${body ? "" : "?shop=1"}`, body
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "La gestion est momentanément indisponible.");
  return result as T;
}

function ManagementConfirmation({ confirmation, busy, error, onClose, onConfirm }: {
  confirmation: Confirmation; busy: boolean; error: string; onClose: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className={styles.confirm} aria-labelledby="treasury-management-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <button type="button" className={styles.close} aria-label="Fermer la confirmation" disabled={busy} onClick={onClose}><X size={22} aria-hidden="true" /></button>
    <small>Trésorerie · Gestion de l’entreprise</small><h2 id="treasury-management-title">{confirmation.title}</h2><p>{confirmation.description}</p>
    <strong className={styles.amount}>{confirmation.cost ? formatKqCash(confirmation.cost) : "Aucun débit immédiat"}</strong>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={onClose}>Revenir</button><button type="button" className={styles.primary} disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle size={18} className={styles.spin} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}{busy ? "Validation…" : "Confirmer"}</button></footer>
  </dialog>;
}

export function KqTreasuryManagement({ onOpenShop, onUpdated }: {
  onOpenShop: (equipmentCode?: string) => void; onUpdated?: () => void;
}) {
  const [data, setData] = useState<KqCommerceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [liveNow, setLiveNow] = useState<number | undefined>();
  const clock = useRef<{ server: number; received: number } | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const refreshedEvent = useRef("");
  const load = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const pending = (async () => {
      try {
        const result = await request<KqCommerceSnapshot>();
        if (!result.business) throw new Error("La gestion de ton entreprise est momentanément indisponible.");
        const server = Date.parse(result.business.serverNow);
        clock.current = { server, received: performance.now() };
        setLiveNow(server); setData(result); setError("");
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Gestion indisponible."); }
      finally { setLoading(false); }
    })();
    inFlight.current = pending;
    void pending.finally(() => { if (inFlight.current === pending) inFlight.current = null; });
    return pending;
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("kq:equipment-updated", refresh);
    return () => window.removeEventListener("kq:equipment-updated", refresh);
  }, [load]);
  useEffect(() => {
    const tick = () => { if (!document.hidden && clock.current) setLiveNow(clock.current.server + Math.max(0, performance.now() - clock.current.received)); };
    const resume = () => { tick(); if (!document.hidden) void load(); };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [load]);
  useEffect(() => {
    const next = data?.business?.nextEventAt;
    if (next && liveNow && liveNow >= Date.parse(next) && next !== refreshedEvent.current && !busy && !confirmation) {
      refreshedEvent.current = next;
      void load();
    }
  }, [data?.business?.nextEventAt, liveNow, busy, confirmation, load]);
  function ask(title: string, description: string, body: Record<string, unknown>, cost = 0) {
    setError(""); setNotice("");
    setConfirmation({ title, description, body: { ...body, requestKey: createClientRequestKey() }, cost });
  }
  async function commit() {
    if (!confirmation || busy) return;
    setBusy(true); setError("");
    try {
      await request<KqCommerceReceipt>(confirmation.body);
      setConfirmation(null); setNotice("La gestion de ton entreprise a été mise à jour.");
      if (inFlight.current) await inFlight.current;
      await load();
      window.dispatchEvent(new Event("kq:equipment-updated"));
      window.dispatchEvent(new Event("kq:treasury-updated"));
      onUpdated?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Opération indisponible."); }
    finally { setBusy(false); }
  }
  return <section className={styles.management} aria-label="Gestion de mon entreprise">
    {loading ? <p className={styles.loading} role="status"><LoaderCircle size={19} className={styles.spin} aria-hidden="true" /> Ouverture de la gestion…</p> : null}
    {error && !confirmation ? <p className={styles.error} role="alert">{error}<button type="button" className={styles.secondary} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" /> Actualiser</button></p> : null}
    {notice ? <p className={styles.notice} role="status"><Check size={18} aria-hidden="true" /> {notice}</p> : null}
    {data ? <KqBusinessPanel data={data} now={liveNow} busy={busy} onAsk={ask} onOpenShop={() => onOpenShop()} expanded /> : null}
    {confirmation ? <ManagementConfirmation confirmation={confirmation} busy={busy} error={error} onClose={() => { if (!busy) { setConfirmation(null); setError(""); } }} onConfirm={() => void commit()} /> : null}
  </section>;
}
