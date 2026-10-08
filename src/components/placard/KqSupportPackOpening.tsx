"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { Gift, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import styles from "./KqSupportPackOpening.module.css";

export type KqOpenedSupportCard = { code: string; name: string; rarity: string; imageUrl?: string };

/** The authenticated endpoint owns the draw and accepts each entitlement once. */
export async function requestKqSupportPackOpening(request: typeof fetch, entitlementId: string): Promise<KqOpenedSupportCard[]> {
  if (!entitlementId.trim()) throw new Error("Ce pack est introuvable. Actualise tes missions.");
  const response = await request("/api/arena/placard/boosters", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entitlementId }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Impossible d’ouvrir ce pack. Réessaie dans un instant.");
  if (!Array.isArray(body?.cards) || body.cards.length < 1 || body.cards.length > 10 || !body.cards.every(card =>
    card && typeof card === "object" && typeof card.code === "string" && typeof card.name === "string" && typeof card.rarity === "string")) {
    throw new Error("L’ouverture n’a pas pu être confirmée. Actualise tes missions avant de réessayer.");
  }
  return body.cards.map(card => ({ code: card.code, name: card.name, rarity: card.rarity, ...(typeof card.imageUrl === "string" ? { imageUrl: card.imageUrl } : {}) }));
}

/** The same card reveal is used by the shop and direct mission rewards. */
export function KqSupportPackReveal({ cards, onClose, onContinue = onClose, continueLabel = "Retour à la boutique", titleId }: {
  cards: readonly KqOpenedSupportCard[]; onClose: () => void; onContinue?: () => void; continueLabel?: string; titleId?: string;
}) {
  return <div className="absolute inset-0 z-50 flex flex-col bg-[#081a14]/95 p-3 backdrop-blur-sm sm:p-6" data-support-pack-reveal>
    <button type="button" aria-label="Fermer le pack ouvert" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center border-2 border-ink bg-white text-ink shadow-[3px_3px_0_#f4c43d]"><X /></button>
    <header className="shrink-0 pr-14 text-center text-white"><small className="font-black uppercase tracking-[.14em] text-yellow">Pack débloqué · {cards.length} cartes</small><h3 id={titleId} className="font-display text-3xl uppercase sm:text-5xl">Tes nouvelles cartes</h3></header>
    <div className="my-3 flex min-h-0 flex-1 items-center gap-2 overflow-x-auto px-1 pb-2 sm:gap-3" aria-label="Les cartes de ton pack">
      {cards.map((card, index) => { const src = getKqCardArtwork(card.code) ?? card.imageUrl; return <article key={`${card.code}-${index}`} className="w-28 shrink-0 border-2 border-[#d5a72d] bg-white p-1 text-ink shadow-[3px_3px_0_#d5a72d] sm:w-40">{src ? <div className="relative aspect-[2/3] overflow-hidden"><Image src={src} alt={card.name} fill sizes="160px" className="object-cover" /></div> : null}<small className="mt-1 block text-[9px] font-black uppercase text-green sm:text-xs">{card.rarity}</small><strong className="block text-[10px] sm:text-sm">{card.name}</strong></article>; })}
    </div>
    <button type="button" onClick={onContinue} className="mx-auto min-h-12 shrink-0 border-2 border-ink bg-yellow px-6 font-black uppercase text-ink shadow-[4px_4px_0_#fff]">{continueLabel}</button>
  </div>;
}

export function KqSupportPackOpening({ cards, cardCount, busy, error, canRetry, onRetry, onClose, onContinue, continueLabel }: {
  cards: readonly KqOpenedSupportCard[]; cardCount: number; busy: boolean; error: string; canRetry: boolean;
  onRetry: () => void; onClose: () => void; onContinue: () => void; continueLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const missionCenter = element?.closest("main");
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
      else missionCenter?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (cards.length) dialog.current?.querySelector<HTMLButtonElement>('[aria-label="Fermer le pack ouvert"]')?.focus({ preventScroll: true });
  }, [cards.length]);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} data-mission-pack-opening onCancel={event => { event.preventDefault(); if (!busy || cards.length) onClose(); }}>
    <div className={styles.content}>
      {cards.length ? <KqSupportPackReveal cards={cards} titleId={titleId} onClose={onClose} onContinue={onContinue} continueLabel={continueLabel} /> : <div className={styles.status}>
        <Gift size={42} aria-hidden="true" /><h2 id={titleId}>Ton pack de {cardCount} cartes</h2>
        {busy ? <p role="status">Ouverture de ton pack…</p> : <>
          <p role="alert">{error}</p>
          {canRetry ? <button type="button" onClick={onRetry}>Réessayer l’ouverture</button> : null}
          <button type="button" onClick={onClose}>Retour aux missions</button>
        </>}
      </div>}
    </div>
  </dialog>;
}
