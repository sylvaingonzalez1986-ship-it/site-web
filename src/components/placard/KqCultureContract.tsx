"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Coins, Hand, RefreshCw } from "lucide-react";
import { KQ_LIGHT_HAND_CONTRACT, parseKqContractSnapshot, type KqContractAction, type KqContractSnapshot } from "@/lib/kanab-quest-contracts";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { useKqGameSound } from "./KqGameSound";
import { KqRenewableContracts } from "./KqRenewableContracts";
import styles from "./KqCultureContract.module.css";

/** A voluntary commitment belongs beside preparation and its result, never above the village. */
export function KqCultureContract({ mode = "preparation", runId, refreshKey, disabled = false, onBusyChange, onOpenGame }: {
  mode?: "preparation" | "run" | "missions";
  runId?: string | null;
  refreshKey?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onOpenGame?: () => void;
}) {
  const api = useKqTutorialApi();
  const sound = useKqGameSound();
  const [snapshot, setSnapshot] = useState<KqContractSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<KqContractAction | null>(null);
  const [error, setError] = useState("");
  const [claimReceipt, setClaimReceipt] = useState<"fresh" | "replayed" | null>(null);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const pending = useRef(false);
  const lastRunId = useRef<string | null>(null);
  const busyCallback = useRef(onBusyChange);

  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; busyCallback.current?.(false); };
  }, []);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    const version = ++sequence.current;
    setLoading(true);
    try {
      const response = await api.request("/api/arena/placard/contracts", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("Le contrat est momentanément indisponible. Ta culture reste accessible.");
      const next = parseKqContractSnapshot(body);
      if (!next) throw new Error("Le suivi du contrat est incomplet. Actualise avant de choisir.");
      if (mounted.current && version === sequence.current) { lastRunId.current = next.runId; setSnapshot(next); setError(""); }
    } catch (failure) {
      if (mounted.current && version === sequence.current) {
        setSnapshot(null);
        setError(failure instanceof Error ? failure.message : "Impossible de retrouver ton contrat.");
      }
    } finally { if (mounted.current && version === sequence.current) setLoading(false); }
  }, [api]);

  useEffect(() => {
    void refresh();
    return api.subscribe(["kq:contracts-updated", "arena:progress-updated", "focus"], () => void refresh());
  }, [api, refresh]);
  useEffect(() => { if (mode === "run" && runId) void refresh(); }, [mode, runId, refreshKey, refresh]);

  async function act(action: KqContractAction) {
    if (pending.current || disabled || loading) return;
    pending.current = true;
    sequence.current++;
    setBusy(action); setError(""); busyCallback.current?.(true);
    try {
      const response = await api.request("/api/arena/placard/contracts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code: KQ_LIGHT_HAND_CONTRACT.code }), signal: AbortSignal.timeout(15_000),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Le contrat n’a pas pu être mis à jour.");
      const next = parseKqContractSnapshot(body);
      if (!next) throw new Error("La réponse du contrat est incomplète. Actualise pour vérifier son état.");
      if (!mounted.current) return;
      lastRunId.current = next.runId;
      setSnapshot(next);
      if (action === "claim" && next.status === "claimed") {
        setClaimReceipt(next.replayed === false ? "fresh" : "replayed");
        if (next.replayed === false) sound.playOnce("reward", `contract:${next.code}:${next.runId}`);
      } else setClaimReceipt(null);
      api.notify("kq:contracts-updated");
      if (action === "claim") { api.notify("kq:equipment-updated"); api.notify("arena:progress-updated"); }
    } catch (failure) {
      if (mounted.current) {
        // A timed-out request may have committed. Disable mutations until an authoritative refresh.
        setSnapshot(null);
        setError(failure instanceof Error ? failure.message : "Connexion interrompue. Actualise le contrat avant de réessayer.");
      }
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(null); busyCallback.current?.(false); }
    }
  }

  const renewable = snapshot?.status === "claimed" ? <KqRenewableContracts mode={mode} runId={runId} refreshKey={refreshKey} disabled={disabled} onBusyChange={onBusyChange} onOpenGame={onOpenGame} /> : null;
  if (mode === "run" && (!runId || (snapshot ? snapshot.runId !== runId : !error || lastRunId.current !== runId))) return renewable;
  if (mode === "preparation" && snapshot?.status === "claimed" && claimReceipt === null) return renewable;
  const status = snapshot?.status;
  const exceeded = snapshot?.cardsUsed != null && snapshot.cardsUsed > KQ_LIGHT_HAND_CONTRACT.maxCardsUsed;
  const reward = `${((snapshot?.rewardCents ?? KQ_LIGHT_HAND_CONTRACT.rewardCents) / 100).toLocaleString("fr-FR")} €`;
  const label = status === "accepted" ? "Accepté pour ta prochaine culture"
    : status === "active" ? exceeded ? "Limite de cartes dépassée" : "Contrat en cours"
      : status === "succeeded" ? "Contrat réussi" : status === "failed" ? "Contrat non rempli"
        : status === "claimed" ? "Prime reçue" : "Contrat facultatif";
  const actionDisabled = disabled || busy !== null || loading;

  return <><details className={styles.contract} data-kq-contract data-contract-status={status ?? (error ? "error" : "loading")}
    data-mode={mode} open={(mode === "missions" && status !== "claimed") || status === "succeeded" || status === "failed" || (status === "claimed" && claimReceipt !== null)}>
    <summary>
      <Hand size={20} aria-hidden="true" />
      <span><strong>{KQ_LIGHT_HAND_CONTRACT.title}</strong><small>{loading && !snapshot ? "Lecture du contrat…" : error && !snapshot ? "Suivi à actualiser" : label}</small></span>
      <span className={styles.summaryMetrics}>{status === "active" ? <><b data-limit-exceeded={exceeded || undefined}>{snapshot?.cardsUsed ?? "—"} / 2 cartes</b><small>{snapshot?.quality ?? "—"} / 8 Qualité</small></> : <b>{status === "claimed" ? "+" : ""}{reward}{status === "failed" ? " non gagnés" : status === "claimed" ? " reçus" : " à gagner"}</b>}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </summary>
    <div className={styles.body}>
      <p className={styles.issuer}>L’essai du comptoir</p>
      <p>Obtiens au moins une récolte vivante à <strong>8 points de Qualité</strong>, avec <strong>2 cartes Botte jouées maximum</strong> sur toute la culture.</p>
      <p className={styles.hint}>Garde tes cartes pour les étapes décisives. Le sol vivant et l’Héritage ne comptent pas dans cette limite. Le reste de ton deck reste disponible.</p>
      {status === "accepted" ? <p className={styles.state} role="status"><Check size={17} aria-hidden="true" />Le contrat sera lié à la prochaine culture lancée.</p> : null}
      {status === "active" ? <p className={styles.state}>{exceeded ? "La prime ne peut plus être gagnée sur cette culture. Tu peux continuer ta partie normalement." : "Le résultat sera vérifié à la récolte. Pour une campagne, une récolte qualifiée suffit ; les deux cartes sont partagées entre tous les Buddies."}</p> : null}
      {status === "failed" ? <p className={styles.state}>La culture est terminée sans remplir toutes les conditions. Aucune pénalité : tu peux retenter le contrat sur une prochaine culture.</p> : null}
      {status === "succeeded" || status === "failed" || status === "claimed" ? <p className={styles.result}>Meilleure récolte : <strong>{snapshot?.quality ?? "—"} points de Qualité</strong> · <strong>{snapshot?.cardsUsed ?? "—"} carte{snapshot?.cardsUsed === 1 ? "" : "s"} jouée{snapshot?.cardsUsed === 1 ? "" : "s"}</strong>.</p> : null}
      {status === "claimed" ? <div className={styles.receipt} role="status" data-contract-receipt data-receipt-fresh={claimReceipt === "fresh" || undefined}>
        <span className={styles.receiptSeal} aria-hidden="true"><Coins size={30} /></span>
        <div><span className={styles.receiptLabel}>{claimReceipt === "fresh" ? "Contrat honoré" : "Prime enregistrée"}</span><strong>+{reward} de jeu</strong><p>{claimReceipt === "fresh" ? "La prime est créditée. Ta récolte reste à toi." : "Cette prime a déjà été reçue. Aucun nouveau versement."}</p></div>
        <Check className={styles.receiptCheck} size={22} aria-hidden="true" />
      </div> : null}
      {error ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" data-contract-action="retry" disabled={loading || busy !== null || disabled} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />Actualiser le contrat</button></div> : null}
      {snapshot ? <div className={styles.actions}>
        {status === "available" || status === "failed" ? <button type="button" data-contract-action="accept" disabled={actionDisabled || !snapshot.canAccept} onClick={() => void act("accept")}>{busy === "accept" ? "Acceptation…" : status === "failed" ? "Retenter sur la prochaine culture" : "Accepter pour ma prochaine culture"}<ArrowRight size={17} aria-hidden="true" /></button> : null}
        {status === "accepted" ? <button type="button" className={styles.secondary} data-contract-action="cancel" disabled={actionDisabled} onClick={() => void act("cancel")}>{busy === "cancel" ? "Annulation…" : "Renoncer avant le départ"}</button> : null}
        {status === "succeeded" ? <button type="button" data-contract-action="claim" disabled={actionDisabled} onClick={() => void act("claim")}>{busy === "claim" ? "Attribution…" : `Récupérer mes ${reward} de jeu`}<ArrowRight size={17} aria-hidden="true" /></button> : null}
        {onOpenGame && (status === "accepted" || status === "active") ? <button type="button" className={styles.secondary} disabled={actionDisabled} onClick={onOpenGame}>{status === "active" ? "Reprendre ma culture" : "Préparer ma culture"}<ArrowRight size={17} aria-hidden="true" /></button> : null}
        {onOpenGame && status === "claimed" ? <button type="button" className={styles.secondary} disabled={actionDisabled} onClick={onOpenGame}>Préparer ma prochaine culture<ArrowRight size={17} aria-hidden="true" /></button> : null}
      </div> : null}
      {snapshot?.reason ? <p className={styles.hint}>{snapshot.reason}</p> : null}
      <small className={styles.terms}>Sans frais d’inscription ni date limite. Prime unique par compte. Ta récolte reste à toi.</small>
    </div>
  </details>{renewable}</>;
}
