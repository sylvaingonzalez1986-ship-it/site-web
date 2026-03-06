"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PackOpeningFlowModal } from "@/components/account/PackOpeningFlowModal";
import { LotteryResultModal } from "@/components/account/LotteryResultModal";
import { useLotteryExperience } from "@/hooks/useLotteryExperience";
import { isRemoteImageUrl, isRenderableImageSource } from "@/lib/image-source";
import { rarityCardClasses, rarityLabels } from "@/lib/lottery-card-ui";
import type { LotteryCollectedCard, LotteryTicket, ScratchResult } from "@/types/lottery";

function findTicketCard(ticket: LotteryTicket, inventory: ReturnType<typeof useLotteryExperience>["inventory"]): LotteryCollectedCard | null {
  if (ticket.cardDefinitionId && inventory) {
    const ownedCard = inventory.cards.find((card) => card.id === ticket.cardDefinitionId);
    if (ownedCard) {
      return ownedCard;
    }
  }

  if (ticket.cardDefinitionId && ticket.cards && ticket.cards.length > 0) {
    const matchingCard = ticket.cards.find((card) => card.id === ticket.cardDefinitionId);
    if (matchingCard) {
      return matchingCard;
    }
  }

  if (ticket.cards && ticket.cards.length > 0) {
    return ticket.cards[0] ?? null;
  }

  if (!ticket.card) {
    return null;
  }

  return {
    ...ticket.card,
    ownedCount: 1,
    isOwned: true,
    isDuplicate: false,
  };
}

function findTicketCards(ticket: LotteryTicket, inventory: ReturnType<typeof useLotteryExperience>["inventory"]): LotteryCollectedCard[] {
  if (ticket.cards && ticket.cards.length > 0) {
    return ticket.cards;
  }

  const singleCard = findTicketCard(ticket, inventory);
  return singleCard ? [singleCard] : [];
}

function buildTicketRecap(ticket: LotteryTicket, inventory: ReturnType<typeof useLotteryExperience>["inventory"]): ScratchResult | null {
  const cards = findTicketCards(ticket, inventory);
  const card = findTicketCard(ticket, inventory);
  if (!ticket.scratchedAt || !card || cards.length === 0) {
    return null;
  }

  return {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    scratchedAt: ticket.scratchedAt,
    card,
    cards,
    inventory: {
      totalCards: inventory?.totalCards ?? 0,
      uniqueOwned: inventory?.uniqueOwned ?? 0,
      totalOwnedCopies: inventory?.totalOwnedCopies ?? 0,
      duplicateCopies: inventory?.duplicateCopies ?? 0,
      byRarity: {
        common: inventory?.byRarity.find((entry) => entry.rarity === "common")?.ownedCopies ?? 0,
        silver: inventory?.byRarity.find((entry) => entry.rarity === "silver")?.ownedCopies ?? 0,
        gold: inventory?.byRarity.find((entry) => entry.rarity === "gold")?.ownedCopies ?? 0,
        epic: inventory?.byRarity.find((entry) => entry.rarity === "epic")?.ownedCopies ?? 0,
        legendary: inventory?.byRarity.find((entry) => entry.rarity === "legendary")?.ownedCopies ?? 0,
      },
    },
  };
}

export function LotterySection() {
  const { tickets, inventory, config, loading, error, openPack } = useLotteryExperience();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<ScratchResult | null>(null);

  const availableTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === "available"),
    [tickets],
  );

  const scratchedTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === "scratched"),
    [tickets],
  );

  const activeTicket = useMemo(() => {
    if (!selectedTicketId) {
      return null;
    }

    // Keep the modal mounted after the server marks the pack as scratched,
    // otherwise the reveal animation disappears before the card backs render.
    return tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  }, [tickets, selectedTicketId]);

  const handleOpenPack = async (ticketId: string) => {
    const payload = await openPack(ticketId);
    const newCardsCount = payload.cards.filter((card) => card.ownedCount <= 1).length;
    const duplicateCardsCount = payload.cards.length - newCardsCount;

    setStatus(
      `Booster ouvert: ${payload.cards.length} cartes revelees, ${newCardsCount} nouvelle(s), ${duplicateCardsCount} doublon(s).`,
    );

    return payload;
  };

  const collectionTitle = inventory?.collection?.title || config?.collectionTitle || "Kanab Quest Collection";

  return (
    <div className="cartoon-border bg-cream p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Collection TCG</h2>
          <p className="mt-2 text-sm text-charcoal">
            Operation promotionnelle reservee aux personnes majeures (18+). 1 pack par tranche de{" "}
            {config ? `${config.eurosPerTicket.toFixed(2)} EUR TTC` : "X EUR TTC"}, dans la limite de{" "}
            {config?.maxTicketsPerOrder ?? "X"} packs de base par commande, hors bonus lies au badge fidelite.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.08em] text-charcoal">
          <span className="pill-cartoon px-3 py-1">Packs: {availableTickets.length}</span>
          <span className="pill-cartoon px-3 py-1">
            Uniques: {inventory?.uniqueOwned ?? 0}/{inventory?.totalCards ?? 0}
          </span>
          <span className="pill-cartoon px-3 py-1">Doublons: {inventory?.duplicateCopies ?? 0}</span>
        </div>
      </div>

      <p className="mt-1 text-xs text-charcoal">
        Chaque booster revele 3 cartes de la collection {collectionTitle}. Reglement complet:{" "}
        <Link href="/reglement-jeu-promo" className="underline hover:text-[#d35400]">
          Reglement du jeu
        </Link>
        .
      </p>

      {!config?.isActive && (
        <p className="mt-3 text-sm font-semibold text-ink">La loterie est actuellement desactivee.</p>
      )}

      {loading && <p className="mt-4 text-sm text-charcoal">Chargement loterie...</p>}
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}

      <section
        className="mt-6 card-cartoon bg-white p-4 md:p-5"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,247,232,0.95) 0%, rgba(255,255,255,0.98) 100%), repeating-linear-gradient(0deg, rgba(122,75,36,0.06) 0px, rgba(122,75,36,0.06) 1px, transparent 1px, transparent 36px)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">Album {collectionTitle}</h3>
            <p className="mt-1 text-sm text-charcoal">
              52 cartes a collectionner, avec doublons et cartes manquantes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(inventory?.byRarity ?? []).map((entry) => (
              <span key={entry.rarity} className="pill-cartoon px-3 py-1 text-xs">
                {rarityLabels[entry.rarity]}: {entry.ownedUnique}/{entry.totalCards}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {(inventory?.cards ?? []).map((card) => (
            <article
              key={card.id}
              className={`relative overflow-hidden rounded-[18px] border-[3px] border-[#1a1a1a] p-3 shadow-[6px_6px_0_rgba(26,26,26,0.16)] ${
                card.isOwned ? rarityCardClasses[card.rarity] : "bg-[#f6ead5] text-[#7a6a57]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.1em]">#{card.cardNumber}</p>
                <span className="rounded-full border-2 border-current px-2 py-1 text-[10px] font-black uppercase">
                  {rarityLabels[card.rarity]}
                </span>
              </div>

              <div className="mt-3 rounded-[14px] border-2 border-current/40 bg-white/55 p-3">
                <div className="relative flex min-h-[112px] items-center justify-center overflow-hidden rounded-[10px] border-2 border-current/25 bg-white/45 p-3 text-center">
                  {card.isOwned && isRenderableImageSource(card.imageUrl) ? (
                    isRemoteImageUrl(card.imageUrl) ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Image src={card.imageUrl} alt={card.name} fill sizes="220px" className="object-cover" />
                    )
                  ) : null}
                  <div
                    className={`relative z-10 ${
                      card.isOwned && isRenderableImageSource(card.imageUrl)
                        ? "rounded bg-black/45 px-2 py-1 text-white"
                        : ""
                    }`}
                  >
                    {card.isOwned ? (
                      <div>
                        <p className="text-lg font-black leading-tight">{card.name}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.08em]">Case vide</p>
                        <p className="mt-2 text-lg font-black leading-tight">Carte #{card.cardNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm font-semibold leading-tight">{card.isOwned ? card.name : "Carte a decouvrir"}</p>
              <p className="mt-1 text-xs leading-relaxed">
                {card.isOwned ? card.description : "Cette carte n'a pas encore ete obtenue."}
              </p>

              {card.ownedCount > 1 && (
                <span className="absolute right-3 top-12 rounded-full border-2 border-[#1a1a1a] bg-white px-2 py-1 text-[11px] font-black text-ink">
                  x{card.ownedCount}
                </span>
              )}
            </article>
          ))}
        </div>
      </section>

      {!loading && config?.isActive && availableTickets.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            className="group flex items-center gap-4 rounded-2xl border-[3px] border-[#1a1a1a] bg-white p-3 pr-6 shadow-[4px_4px_0_rgba(26,26,26,0.12)] transition-transform hover:-translate-y-0.5 hover:shadow-[4px_6px_0_rgba(26,26,26,0.16)] active:translate-y-0"
            onClick={() => setSelectedTicketId(availableTickets[0].id)}
          >
            <div className="relative h-20 w-14 shrink-0">
              <Image
                src="/app/lottery/sealed-booster-pack.png"
                alt="Booster scelle"
                fill
                sizes="56px"
                className="object-contain drop-shadow-md transition-transform group-hover:scale-105"
              />
            </div>
            <div className="text-left">
              <p className="font-display text-xl leading-tight text-ink">
                {availableTickets.length} pack{availableTickets.length > 1 ? "s" : ""} disponible{availableTickets.length > 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-xs text-charcoal">Appuyez pour ouvrir</p>
            </div>
          </button>
        </section>
      )}

      {!loading && availableTickets.length === 0 && (
        <p className="mt-6 text-sm text-charcoal">Aucun pack disponible pour le moment.</p>
      )}

      <section className="mt-6">
        <h3 className="font-display text-2xl">Historique des ouvertures</h3>
        {scratchedTickets.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal">Aucun pack ouvert.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {scratchedTickets.map((ticket) => {
              const cards = findTicketCards(ticket, inventory);
              const cardSummary = cards
                .slice(0, 3)
                .map((entry) => `#${entry.cardNumber} ${entry.name}`)
                .join(" - ");

              return (
                <article key={ticket.id} className="card-cartoon bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-ink">{ticket.ticketNumber}</p>
                    <p className="text-xs text-charcoal">
                      {ticket.scratchedAt ? new Date(ticket.scratchedAt).toLocaleString("fr-FR") : "Date inconnue"}
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {cards.length > 0 ? `${cards.length} cartes revelees` : "Cartes revelees"}
                  </p>
                  {cards.length > 0 && <p className="mt-1 text-xs text-charcoal">{cardSummary}</p>}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      className="btn-cartoon btn-secondary h-9 px-3 text-xs"
                      onClick={() => setResultModal(buildTicketRecap(ticket, inventory))}
                      disabled={!ticket.scratchedAt || cards.length === 0}
                    >
                      Voir recap
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <LotteryResultModal result={resultModal} onClose={() => setResultModal(null)} />
      <PackOpeningFlowModal
        ticket={activeTicket}
        onClose={() => setSelectedTicketId(null)}
        onOpen={handleOpenPack}
      />
    </div>
  );
}
