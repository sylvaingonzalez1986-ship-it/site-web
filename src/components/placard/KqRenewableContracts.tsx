"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Coins, Feather, Leaf, RefreshCw, Sparkles } from "lucide-react";
import { createClientRequestKey } from "@/lib/client-request-key";
import {
  KQ_RENEWABLE_CONTRACTS, parseKqContractBoard, parseKqContractBoardResult,
  type KqContractBoard, type KqRenewableAttempt, type KqRenewableCode, type KqRenewableCommand, type KqRenewableOffer,
} from "@/lib/kanab-quest-renewable-contracts";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { useKqGameSound } from "./KqGameSound";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqRenewableContracts.module.css";

const money = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
const icons = { "steady-hand": Feather, "pure-grower": Leaf, "fine-flower": Sparkles };
function CardRule({ offer }: { offer: KqRenewableOffer }) {
  return <>{offer.maxCardsUsed === null ? "Cartes Botte libres" : offer.maxCardsUsed === 0 ? "Aucune carte Botte" : `${offer.maxCardsUsed} cartes Botte maximum`}</>;
}

export function KqRenewableContracts({ mode = "preparation", runId, refreshKey, disabled = false, onBusyChange, onOpenGame }: {
  mode?: "preparation" | "run" | "missions";
  runId?: string | null;
  refreshKey?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onOpenGame?: () => void;
}) {
  const api = useKqTutorialApi(), sound = useKqGameSound();
  const [board, setBoard] = useState<KqContractBoard | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<KqRenewableCommand["action"] | null>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ attempt: KqRenewableAttempt; fresh: boolean } | null>(null);
  const mounted = useRef(false), pending = useRef(false), sequence = useRef(0);
  const acceptance = useRef<{ code: KqRenewableCode; id: string } | null>(null);
  const lastRunId = useRef<string | null>(null);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; busyCallback.current?.(false); }; }, []);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    const version = ++sequence.current;
    setLoading(true);
    try {
      const response = await api.request("/api/arena/placard/contracts/board", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (response.status === 404) {
        if (mounted.current && version === sequence.current) { setUnavailable(true); setBoard(null); setError(""); }
        return;
      }
      if (!response.ok) throw new Error("Le comptoir est momentanément indisponible. Ta culture reste accessible.");
      const next = parseKqContractBoard(await response.json());
      if (!next) throw new Error("Le suivi des contrats est incomplet. Actualise avant de choisir.");
      if (mounted.current && version === sequence.current) {
        setBoard(next); setError(""); setUnavailable(false); lastRunId.current = next.current?.runId ?? null;
        // Resolve an uncertain acceptance only once the server has observed it.
        if (acceptance.current?.id === next.current?.id) acceptance.current = null;
        setReceipt(previous => previous?.attempt.id === next.current?.id ? previous : null);
      }
    } catch (failure) {
      if (mounted.current && version === sequence.current) {
        setUnavailable(false); setBoard(null); setError(failure instanceof Error ? failure.message : "Impossible de retrouver tes contrats.");
      }
    } finally { if (mounted.current && version === sequence.current) setLoading(false); }
  }, [api]);
  useEffect(() => {
    void refresh();
    return api.subscribe(["kq:contracts-updated", "arena:progress-updated", "focus"], () => void refresh());
  }, [api, refresh]);
  useEffect(() => { if (mode === "run" && runId) void refresh(); }, [mode, runId, refreshKey, refresh]);

  async function act(action: KqRenewableCommand["action"], offerCode?: KqRenewableCode) {
    if (!board || pending.current || disabled || loading) return;
    let command: KqRenewableCommand;
    if (action === "accept") {
      if (!offerCode || !board.canAccept) return;
      if (!acceptance.current || acceptance.current.code !== offerCode) acceptance.current = { code: offerCode, id: createClientRequestKey() };
      command = { action, code: offerCode, attemptId: acceptance.current.id };
    } else {
      if (!board.current) return;
      command = { action, attemptId: board.current.id };
    }
    pending.current = true; sequence.current++;
    setBusy(action); setError(""); busyCallback.current?.(true);
    try {
      const response = await api.request("/api/arena/placard/contracts/board", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command), signal: AbortSignal.timeout(15_000),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Le contrat n’a pas pu être mis à jour.");
      const result = parseKqContractBoardResult(body);
      if (!result || (action === "claim" && result.receipt?.id !== command.attemptId)
        || (action !== "claim" && result.receipt !== null)) throw new Error("Réponse incomplète. Actualise pour vérifier ton contrat.");
      if (!mounted.current) return;
      acceptance.current = null;
      setBoard(result.board); lastRunId.current = result.board.current?.runId ?? null;
      setReceipt(result.receipt ? { attempt: result.receipt, fresh: !result.replayed } : null);
      if (result.receipt && !result.replayed) sound.playOnce("reward", `renewable-contract:${result.receipt.id}`);
      api.notify("kq:contracts-updated");
      if (result.receipt) { api.notify("kq:equipment-updated"); api.notify("arena:progress-updated"); }
    } catch (failure) {
      if (mounted.current) {
        // A lost response can follow a committed payment. Require an authoritative GET.
        setBoard(null); setReceipt(null);
        setError(failure instanceof Error ? failure.message : "Connexion interrompue. Actualise avant de réessayer.");
      }
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(null); busyCallback.current?.(false); }
    }
  }

  const current = board?.current;
  if (unavailable || board?.unlocked === false) return null;
  if (mode === "run" && (!runId || (board ? current?.runId !== runId : !error || lastRunId.current !== runId))) return null;
  const choices = board && (!current || ["claimed", "failed", "cancelled"].includes(current.status));
  const actionDisabled = disabled || loading || busy !== null;
  const receiptAttempt = receipt?.attempt ?? (current?.status === "claimed" ? current : null);
  const exceeded = current?.maxCardsUsed != null && current.cardsUsed != null && current.cardsUsed > current.maxCardsUsed;
  const title = current && !choices ? KQ_RENEWABLE_CONTRACTS[current.code].title : "Les commandes du comptoir";
  const subtitle = current?.status === "accepted" ? "Pour ta prochaine culture" : current?.status === "active" ? exceeded ? "Limite de cartes dépassée" : "Contrat en cours"
    : current?.status === "succeeded" ? "Contrat réussi · prime à récupérer" : choices ? "Choisis ton prochain défi" : loading ? "Lecture des commandes…" : "Suivi à actualiser";

  return <section className={styles.board} data-kq-renewable-contracts data-contract-status={current?.status ?? (error ? "error" : board ? "available" : "loading")} aria-label="Contrats du comptoir">
    <header className={styles.header}><div><p className={styles.eyebrow}>Le comptoir des chanvriers</p><h3>{title}</h3><p>{subtitle}</p></div>
      {current && !choices ? <strong className={styles.prize}>{money(current.rewardCents)}<small>à gagner</small></strong>
        : board && board.completedCount > 0 ? <span className={styles.count}>{board.completedCount}<small>contrat{board.completedCount > 1 ? "s" : ""} honoré{board.completedCount > 1 ? "s" : ""}</small></span> : null}
    </header>
    {receiptAttempt ? <div className={styles.receipt} role="status" data-renewable-receipt data-receipt-fresh={receipt?.fresh || undefined}>
      <Coins size={30} aria-hidden="true" /><div><strong>+{money(receiptAttempt.rewardCents)} de jeu</strong>
        <p>{receipt?.fresh ? "Contrat honoré. La prime est créditée et ta récolte reste à toi." : "Prime déjà reçue. Aucun nouveau versement."}</p></div><Check size={20} aria-hidden="true" />
    </div> : null}
    {current?.status === "failed" ? <p className={styles.result} role="status"><strong>{KQ_RENEWABLE_CONTRACTS[current.code].title} : contrat non rempli.</strong> {current.reason ?? "La récolte n’a pas rempli les conditions."} Aucune pénalité : choisis ta prochaine tentative.</p> : null}
    {current && !choices ? <div className={styles.attempt}>
      <p>Une récolte vivante à <strong>{current.minimumQuality} points de Qualité minimum</strong>. <strong><CardRule offer={current} />.</strong></p>
      {current.quality !== null ? <KqProgressMeter label={current.status === "active" ? "Meilleure Qualité en cours" : "Meilleure Qualité à la récolte"} value={current.quality} max={current.minimumQuality} valueLabel={`${current.quality} / ${current.minimumQuality} points`} hint={current.status === "active" ? "La Qualité peut encore évoluer. Le résultat sera vérifié à la récolte." : undefined} /> : current.status !== "accepted" ? <p>Qualité : en attente de confirmation.</p> : null}
      {current.status !== "accepted" ? <p className={styles.cardCount} data-limit-exceeded={exceeded || undefined}>Cartes jouées : <strong>{current.cardsUsed ?? "—"}{current.maxCardsUsed !== null ? ` / ${current.maxCardsUsed}` : ""}</strong>{exceeded ? " · limite dépassée" : current.maxCardsUsed === null ? " · sans limite contractuelle" : ""}</p> : null}
      {current.reason ? <p className={styles.hint}>{current.reason}</p> : null}
      <div className={styles.actions}>
        {current.status === "accepted" ? <button type="button" className={styles.secondary} data-renewable-action="cancel" disabled={actionDisabled} onClick={() => void act("cancel")}>Renoncer avant le départ</button> : null}
        {current.status === "succeeded" ? <button type="button" data-renewable-action="claim" disabled={actionDisabled} onClick={() => void act("claim")}>{busy === "claim" ? "Attribution…" : `Récupérer mes ${money(current.rewardCents)}`}<ArrowRight size={17} aria-hidden="true" /></button> : null}
        {onOpenGame && ["accepted", "active"].includes(current.status) ? <button type="button" disabled={actionDisabled} onClick={onOpenGame}>{current.status === "active" ? "Reprendre ma culture" : "Préparer ma culture"}<ArrowRight size={17} aria-hidden="true" /></button> : null}
      </div>
    </div> : null}
    {choices ? <div className={styles.offers}>{board.offers.map(offer => {
      const copy = KQ_RENEWABLE_CONTRACTS[offer.code], Icon = icons[offer.code];
      return <article key={offer.code} className={styles.offer} data-renewable-offer={offer.code}>
        <div className={styles.offerTop}><Icon size={25} aria-hidden="true" /><strong>{money(offer.rewardCents)}<small>de jeu à gagner</small></strong></div>
        <h4>{copy.title}</h4><p className={styles.approach}>{copy.approach}</p>
        <p className={styles.target}><b>{offer.minimumQuality}</b> points de Qualité minimum</p><p className={styles.rule}><CardRule offer={offer} /></p>
        <p className={styles.hint}>{copy.hint}</p>
        <button type="button" data-renewable-action="accept" disabled={actionDisabled || !board.canAccept} onClick={() => void act("accept", offer.code)} aria-label={`Choisir ${copy.title} pour ${money(offer.rewardCents)} de jeu`}>Choisir ce contrat<ArrowRight size={17} aria-hidden="true" /></button>
      </article>;
    })}</div> : null}
    {board?.reason ? <p className={styles.hint}>{board.reason}</p> : null}
    {error ? <div className={styles.error} role="alert"><p>{error}</p><button type="button" className={styles.secondary} data-renewable-action="retry" disabled={actionDisabled} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />Actualiser les contrats</button></div> : null}
    {board ? <details className={styles.rules}><summary>Comment ça marche<ChevronDown size={15} aria-hidden="true" /></summary>
      <p>Choisis avant de lancer ta culture. Une récolte vivante qui atteint l’objectif suffit ; les cartes Botte jouées sont comptées sur toute la campagne, tous Buddies confondus. Le sol vivant et l’Héritage ne comptent pas comme des cartes Botte.</p>
      <p>Un seul contrat par culture, sans frais ni date limite. Tu gardes ta récolte. Après une réussite, récupère ta prime pour choisir de nouveau. Après un échec, tu peux changer de contrat. Tu peux toujours jouer sans contrat.</p>
    </details> : null}
  </section>;
}
