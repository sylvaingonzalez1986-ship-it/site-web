"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ScratchCard } from "@/components/account/ScratchCard";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { LotteryTicket, ScratchResult } from "@/types/lottery";

type ScratchTicketModalProps = {
  ticket: LotteryTicket | null;
  onClose: () => void;
  onScratch: (ticketId: string) => Promise<ScratchResult>;
};

export function ScratchTicketModal({ ticket, onClose, onScratch }: ScratchTicketModalProps) {
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

  if (!ticket) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative z-10 w-full max-w-3xl cartoon-border bg-cream p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">Ticket de grattage</p>
            <h3 className="font-display text-3xl text-ink">Ticket {ticket.ticketNumber}</h3>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <ScratchCard ticketNumber={ticket.ticketNumber} onScratch={() => onScratch(ticket.id)} disabled={false} />
      </div>
    </div>
  );
}



