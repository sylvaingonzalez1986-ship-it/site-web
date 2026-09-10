import { describe, expect, it } from "vitest";
import {
  buildKqHeritageAdminState,
  filterAndSortKqHeritageAdminCards,
  getKqHeritageAdminCardStatus,
  isKqHeritagePendingEditorialEffect,
} from "@/lib/kanab-quest-heritage-admin";

describe("Kanab Quest Heritage admin state", () => {
  it("exposes assigned and available powers without hiding the producer identity", () => {
    const state = buildKqHeritageAdminState([
      { code: "HERITAGE-001", effect: "starting-xp-two", isActive: true, producerId: "p1", producerName: "Ferme Alpha" },
      { code: "HERITAGE-002", effect: "pending-editorial-HERITAGE-002", isActive: false, producerId: "p2", producerName: "Ferme Bêta" },
    ]);

    expect(state.effectOptions).toHaveLength(24);
    expect(state.effectOptions.find((option) => option.effect === "starting-xp-two")).toMatchObject({
      isAvailable: false,
      assignedCardCode: "HERITAGE-001",
      assignedProducerName: "Ferme Alpha",
    });
    expect(state.effectOptions.find((option) => option.effect === "calm-target-relief")?.isAvailable).toBe(true);
    expect(state.summary).toMatchObject({
      activeCards: 1,
      pendingEditorialCards: 1,
      availableEffects: 23,
      duplicateActiveEffects: 0,
    });
  });

  it("distinguishes hidden, archived and editorially pending cards", () => {
    const state = buildKqHeritageAdminState([
      { code: "HERITAGE-001", effect: "starting-xp-two", isActive: false, producerId: "p1", producerName: "Alpha" },
      { code: "HERITAGE-002", effect: "unknown-effect", isActive: false, producerId: "p2", producerName: "Bêta" },
      { code: "HERITAGE-003", effect: "root-danger-to-spark", isActive: false, producerId: null, producerName: "Ancienne ferme" },
    ]);

    expect(state.summary).toMatchObject({ hiddenCards: 1, pendingEditorialCards: 1, archivedCards: 1 });
    expect(isKqHeritagePendingEditorialEffect("pending-editorial-HERITAGE-025")).toBe(true);
    expect(isKqHeritagePendingEditorialEffect("root-danger-to-spark")).toBe(false);
  });

  it("reports legacy duplicate assignments defensively", () => {
    const state = buildKqHeritageAdminState([
      { code: "HERITAGE-001", effect: "starting-xp-two", isActive: true, producerId: "p1", producerName: "Alpha" },
      { code: "HERITAGE-002", effect: "starting-xp-two", isActive: true, producerId: "p2", producerName: "Bêta" },
    ]);

    expect(state.summary.duplicateActiveEffects).toBe(1);
  });

  it("prioritizes pending cards and supports accent-insensitive producer search", () => {
    const cards = [
      { code: "HERITAGE-004", effect: "root-danger-to-spark", isActive: false, producerId: null, producerName: "Ancienne ferme" },
      { code: "HERITAGE-003", effect: "starting-xp-two", isActive: true, producerId: "p3", producerName: "Écume verte" },
      { code: "HERITAGE-002", effect: "root-danger-to-spark", isActive: false, producerId: "p2", producerName: "Bêta" },
      { code: "HERITAGE-001", effect: "pending-editorial-HERITAGE-001", isActive: false, producerId: "p1", producerName: "Alpha" },
    ];

    expect(filterAndSortKqHeritageAdminCards(cards, "", "all").map((card) => card.code)).toEqual([
      "HERITAGE-001", "HERITAGE-003", "HERITAGE-002", "HERITAGE-004",
    ]);
    expect(filterAndSortKqHeritageAdminCards(cards, "ecume", "all").map((card) => card.code)).toEqual(["HERITAGE-003"]);
    expect(filterAndSortKqHeritageAdminCards(cards, "", "hidden").map((card) => card.code)).toEqual(["HERITAGE-002"]);
    expect(getKqHeritageAdminCardStatus(cards[0])).toBe("archived");
  });
});
