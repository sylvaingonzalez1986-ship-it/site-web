"use client";

import { useEffect } from "react";
import { PackOpeningAnimation } from "@/components/lottery/PackOpeningAnimation";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { LotteryTicket, ScratchResult } from "@/types/lottery";

type PackOpeningFlowModalProps = {
  ticket: LotteryTicket | null;
  onClose: () => void;
  onOpen: (ticketId: string) => Promise<ScratchResult>;
};

export function PackOpeningFlowModal({ ticket, onClose, onOpen }: PackOpeningFlowModalProps) {
  useBodyScrollLock(Boolean(ticket));

  useEffect(() => {
    if (!ticket) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ticket, onClose]);

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-[220] bg-black">
      {/* Close — always visible */}
      <button
        type="button"
        className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20"
        onClick={onClose}
        aria-label="Fermer"
      >
        ✕
      </button>

      <PackOpeningAnimation
        key={ticket.id}
        packNumber={ticket.ticketNumber}
        onOpen={() => onOpen(ticket.id)}
        onContinue={onClose}
      />
    </div>
  );
}
