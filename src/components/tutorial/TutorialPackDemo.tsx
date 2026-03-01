"use client";

import { useCallback } from "react";
import { PackOpeningAnimation } from "@/components/lottery/PackOpeningAnimation";
import type { ScratchResult } from "@/types/lottery";

export function TutorialPackDemo() {
  const onOpenDemo = useCallback(async (): Promise<ScratchResult> => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 280);
    });

    return {
      ticketId: "tutorial-demo",
      ticketNumber: "LCB-PACK-DEMO-0001",
      scratchedAt: new Date().toISOString(),
      card: {
        id: "demo-card-5",
        collectionId: "demo-collection",
        collectionCode: "HEMP_HEROES_2026",
        collectionTitle: "Hemp Heroes 2026 Collection",
        code: "HH2026-005",
        cardNumber: 5,
        name: "ACDC",
        rarity: "gold",
        visualPrompt: "",
        description: "Carte premium revelee dans le booster demo.",
        imageUrl: "",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownedCount: 1,
        isOwned: true,
        isDuplicate: false,
      },
      cards: [
        {
          id: "demo-card-5",
          collectionId: "demo-collection",
          collectionCode: "HEMP_HEROES_2026",
          collectionTitle: "Hemp Heroes 2026 Collection",
          code: "HH2026-005",
          cardNumber: 5,
          name: "ACDC",
          rarity: "gold",
          visualPrompt: "",
          description: "Carte premium revelee dans le booster demo.",
          imageUrl: "",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownedCount: 1,
          isOwned: true,
          isDuplicate: false,
        },
        {
          id: "demo-card-22",
          collectionId: "demo-collection",
          collectionCode: "HEMP_HEROES_2026",
          collectionTitle: "Hemp Heroes 2026 Collection",
          code: "HH2026-022",
          cardNumber: 22,
          name: "White Widow CBD",
          rarity: "common",
          visualPrompt: "",
          description: "Exemple de carte commune revelee dans la collection.",
          imageUrl: "",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownedCount: 1,
          isOwned: true,
          isDuplicate: false,
        },
        {
          id: "demo-card-18",
          collectionId: "demo-collection",
          collectionCode: "HEMP_HEROES_2026",
          collectionTitle: "Hemp Heroes 2026 Collection",
          code: "HH2026-018",
          cardNumber: 18,
          name: "Sweet and Sour Widow",
          rarity: "silver",
          visualPrompt: "",
          description: "Exemple de carte silver revelee dans la collection.",
          imageUrl: "",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownedCount: 2,
          isOwned: true,
          isDuplicate: true,
        },
      ],
      inventory: {
        totalCards: 52,
        uniqueOwned: 12,
        totalOwnedCopies: 17,
        duplicateCopies: 5,
        byRarity: {
          common: 10,
          silver: 4,
          gold: 2,
          epic: 1,
          legendary: 0,
        },
      },
    };
  }, []);

  return (
    <div className="mt-4">
      <PackOpeningAnimation
        packNumber="LCB-PACK-DEMO-0001"
        onOpen={onOpenDemo}
        disabled={false}
        demo
        compact
      />
    </div>
  );
}
