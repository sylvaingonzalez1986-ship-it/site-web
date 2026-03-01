"use client";

import { useEffect, useMemo, useState } from "react";
import { PackOpeningAnimation } from "@/components/lottery/PackOpeningAnimation";
import { LotteryResultSummary } from "@/components/account/LotteryResultModal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { LotteryTicket, ScratchResult } from "@/types/lottery";

type PackOpeningFlowModalProps = {
  ticket: LotteryTicket | null;
  onClose: () => void;
  onOpen: (ticketId: string) => Promise<ScratchResult>;
};

export function PackOpeningFlowModal({ ticket, onClose, onOpen }: PackOpeningFlowModalProps) {
  const [summaryState, setSummaryState] = useState<{
    ticketId: string | null;
    result: ScratchResult | null;
  }>({
    ticketId: null,
    result: null,
  });

  useBodyScrollLock(Boolean(ticket));

  useEffect(() => {
    if (!ticket) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ticket, onClose]);

  const summaryResult =
    ticket && summaryState.ticketId === ticket.id ? summaryState.result : null;

  const headline = useMemo(() => {
    if (!summaryResult) {
      return ticket ? `Pack ${ticket.ticketNumber}` : "Ouverture de booster";
    }

    return summaryResult.cards.some((card) => card.rarity === "legendary")
      ? "Pack legendaire !"
      : "Resume du booster";
  }, [summaryResult, ticket]);

  if (!ticket) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative z-10 w-full max-w-6xl cartoon-border bg-cream p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">
              {summaryResult ? "Booster revele" : "Booster scelle"}
            </p>
            <h3 className="font-display text-3xl text-ink">{headline}</h3>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0 text-2xl font-bold leading-none"
            onClick={onClose}
            aria-label="Fermer"
          >
            x
          </button>
        </div>

        {summaryResult ? (
          <div className="space-y-4">
            <LotteryResultSummary result={summaryResult} />
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-cartoon btn-primary inline-flex h-11 items-center justify-center px-4 text-xs leading-none"
                onClick={onClose}
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <PackOpeningAnimation
            key={ticket.id}
            packNumber={ticket.ticketNumber}
            onOpen={() => onOpen(ticket.id)}
            onContinue={(result) => setSummaryState({ ticketId: ticket.id, result })}
          />
        )}
      </div>
    </div>
  );
}
