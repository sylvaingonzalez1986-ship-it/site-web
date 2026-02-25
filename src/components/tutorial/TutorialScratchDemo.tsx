"use client";

import { useCallback } from "react";
import { ScratchCard } from "@/components/account/ScratchCard";
import type { ScratchResult } from "@/types/lottery";

export function TutorialScratchDemo() {
  const onScratchDemo = useCallback(async (): Promise<ScratchResult> => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 280);
    });

    return {
      ticketId: "tutorial-demo",
      ticketNumber: "LCB-DEMO-0001",
      isWin: true,
      scratchedAt: new Date().toISOString(),
      prize: {
        id: "demo-common",
        name: "5% sur ta prochaine commande",
        description: "Lot fictif de demonstration",
        rarity: "common",
        imageUrl: "",
        valueEuros: 0,
      },
    };
  }, []);

  return (
    <div className="mt-4">
      <ScratchCard
        ticketNumber="LCB-DEMO-0001"
        onScratch={onScratchDemo}
        disabled={false}
        demo
        compact
      />
    </div>
  );
}
