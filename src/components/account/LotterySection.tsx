﻿"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LotteryResultModal } from "@/components/account/LotteryResultModal";
import { ScratchTicketModal } from "@/components/account/ScratchTicketModal";
import type { ScratchResult } from "@/types/lottery";
import type { LotteryConfig, LotteryTicket } from "@/types/lottery";

type LotterySectionProps = {
  tickets: LotteryTicket[];
  config: LotteryConfig | null;
  loading?: boolean;
  onRefresh: (options: { silent: boolean }) => Promise<void> | void;
};

export function LotterySection({ tickets, config, loading = false, onRefresh }: LotterySectionProps) {
  const [localTickets, setLocalTickets] = useState<LotteryTicket[]>(tickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<ScratchResult | null>(null);

  useEffect(() => {
    setLocalTickets(tickets);
  }, [tickets]);

  const availableTickets = useMemo(
    () => localTickets.filter((ticket) => ticket.status === "available"),
    [localTickets],
  );

  const scratchedTickets = useMemo(
    () => localTickets.filter((ticket) => ticket.status === "scratched"),
    [localTickets],
  );

  const activeTicket = useMemo(() => {
    if (!selectedTicketId) {
      return null;
    }

    return availableTickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  }, [availableTickets, selectedTicketId]);

  const scratchTicket = async (ticketId: string) => {
    const response = await fetch(`/api/account/tickets/${encodeURIComponent(ticketId)}/scratch`, {
      method: "POST",
    });

    const payload = (await response.json()) as {
      ticketId: string;
      ticketNumber: string;
      isWin: boolean;
      scratchedAt: string;
      prize: LotteryTicket["prize"];
      error: string;
    };

    if (!response.ok || !payload.ticketId) {
      throw new Error(payload.error ?? "Impossible de gratter ce ticket.");
    }

    setLocalTickets((current) =>
      current.map((ticket) => {
        if (ticket.id !== payload.ticketId) {
          return ticket;
        }

        return {
          ...ticket,
          status: "scratched",
          isWin: payload.isWin ?? false,
          scratchedAt: payload.scratchedAt,
          prize: payload.prize,
        };
      }),
    );

    const scratchResult = {
      ticketId: payload.ticketId,
      ticketNumber: payload.ticketNumber ?? "",
      isWin: payload.isWin ?? false,
      scratchedAt: payload.scratchedAt ?? new Date().toISOString(),
      prize: payload.prize,
    };

    setResultModal(scratchResult);
    setSelectedTicketId(null);
    setStatus(payload.isWin ? "Ticket gagnant !" : "Dommage, ce sera pour la prochaine fois.");
    void onRefresh({ silent: true });
    return scratchResult;
  };

  const openResultRecap = (ticket: LotteryTicket) => {
    setResultModal({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      isWin: ticket.isWin === true,
      scratchedAt: ticket.scratchedAt ?? ticket.createdAt ?? new Date().toISOString(),
      prize: ticket.prize,
    });
  };

  return (
    <div className="cartoon-border bg-cream p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Ticket de grattage</h2>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-charcoal">
          <span className="pill-cartoon px-3 py-1">Disponibles: {availableTickets.length}</span>
          <span className="pill-cartoon px-3 py-1">Total: {localTickets.length}</span>
        </div>
      </div>

      <p className="mt-2 text-sm text-charcoal">
        Operation promotionnelle réservée aux personnes majeures (18+). 1 ticket attribué par tranche de{" "}
        {config ? `${config.ticketThresholdEuros.toFixed(2)} EUR TTC` : "X EUR TTC"} de commande payée.
      </p>
      <p className="mt-1 text-xs text-charcoal">
        Résultat déterminé cété serveur au moment du grattage. Règlement complet: {" "}
        <Link href="/reglement-jeu-promo" className="underline hover:text-[#d35400]">
          Règlement du jeu
        </Link>
        .
      </p>

      {!config?.isActive && (
        <p className="mt-3 text-sm font-semibold text-ink">
          La loterie est actuellement désactivée.
        </p>
      )}

      {loading && <p className="mt-4 text-sm text-charcoal">Chargement des tickets...</p>}

      {status && <p className="mt-3 text-sm font-semibold text-ink">{status}</p>}

      {!loading && config?.isActive && availableTickets.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {availableTickets.map((ticket) => (
            <article key={ticket.id} className="card-cartoon flex items-center justify-between bg-white p-3">
              <div>
                <p className="font-mono text-xs text-ink">{ticket.ticketNumber}</p>
                <p className="text-xs text-charcoal">1 grattage unique</p>
              </div>
              <button
                type="button"
                className="btn-cartoon btn-primary h-10 px-3 text-xs"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                Gratter
              </button>
            </article>
          ))}
        </div>
      )}

      {!loading && availableTickets.length === 0 && (
        <p className="mt-4 text-sm text-charcoal">
          Aucun ticket disponible pour le moment.
        </p>
      )}

      <div className="mt-6">
        <h3 className="font-display text-2xl">Historique des tickets</h3>
        {scratchedTickets.length === 0 ? (
          <p className="mt-2 text-sm text-charcoal">Aucun ticket gratte.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {scratchedTickets.map((ticket) => (
              <article key={ticket.id} className="card-cartoon bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs text-ink">{ticket.ticketNumber}</p>
                  <p className="text-xs text-charcoal">
                    {ticket.scratchedAt
                      ? new Date(ticket.scratchedAt).toLocaleString("fr-FR")
                      : "Date inconnue"}
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {ticket.isWin ? `Gagne: ${ticket.prize?.name ?? "Lot"}` : "Perdu"}
                </p>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-9 px-3 text-xs"
                    onClick={() => openResultRecap(ticket)}
                  >
                    Voir recap
                  </button>
                </div>
                {ticket.isWin && (
                  <p className="mt-1 text-xs text-charcoal">
                    {ticket.redeemedAt
                      ? `Utilise le ${new Date(ticket.redeemedAt).toLocaleString("fr-FR")}${
                          ticket.redeemedOrderId ? ` sur la commande ${ticket.redeemedOrderId}` : ""
                        }.`
                      : "Gain non utilise pour le moment."}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <LotteryResultModal result={resultModal} onClose={() => setResultModal(null)} />
      <ScratchTicketModal
        ticket={activeTicket}
        onClose={() => setSelectedTicketId(null)}
        onScratch={scratchTicket}
      />
    </div>
  );
}



