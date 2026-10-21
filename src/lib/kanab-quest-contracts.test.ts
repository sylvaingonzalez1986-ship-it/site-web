import { describe, expect, it } from "vitest";
import { KQ_LIGHT_HAND_CONTRACT, parseKqContractCommand, parseKqContractSnapshot, readKqContractProgress, type KqContractSnapshot } from "./kanab-quest-contracts";

const runId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const available: KqContractSnapshot = { code: "light-hand", status: "available", runId: null, quality: null,
  cardsUsed: null, rewardCents: 3000, canAccept: true, reason: null };

describe("production contract protocol", () => {
  it("counts actual played copies, including duplicates, rather than the deck or other actions", () => {
    expect(readKqContractProgress({ quality: 5, deckCodes: ["BOTTE-001"], usedCards: ["BOTTE-002", "BOTTE-002"], care: {}, heritageUsed: true })).toEqual({ quality: 5, cardsUsed: 2 });
    expect(readKqContractProgress({ quality: 5, usedCards: [] }, [{ quality: 8, usedCards: ["BOTTE-001"] }, { quality: 7 }])).toEqual({ quality: 8, cardsUsed: 0 });
  });
  it("preserves absent or malformed metrics as unknown, without converting them to zero", () => {
    for (const value of [null, {}, { quality: "8", usedCards: null }, { quality: Infinity, usedCards: [null] }, { quality: 2 ** 32, usedCards: ["HH2026-001"] }]) {
      expect(readKqContractProgress(value)).toEqual({ quality: null, cardsUsed: null });
    }
    expect(readKqContractProgress({ quality: -3, usedCards: [] })).toEqual({ quality: -3, cardsUsed: 0 });
  });
  it("retains authoritative claimability even when current metrics reach both thresholds", () => {
    const active = { ...available, status: "active", runId, quality: 8, cardsUsed: 2, canAccept: false };
    expect(parseKqContractSnapshot(active)).toEqual(active);
    expect(parseKqContractSnapshot({ ...active, status: "succeeded" })?.status).toBe("succeeded");
    expect(KQ_LIGHT_HAND_CONTRACT).toMatchObject({ minimumQuality: 8, maxCardsUsed: 2, rewardCents: 3000 });
  });
  it.each([
    { rewardCents: 100000 }, { status: "invented" }, { canAccept: "yes" }, { quality: undefined },
    { quality: "8" }, { cardsUsed: -1 }, { cardsUsed: undefined }, { reason: undefined },
    { runId: "not-a-uuid" }, { cashAfterCents: -1 }, { replayed: "true" },
    { status: "accepted", runId }, { status: "active" }, { quality: 8 },
  ])("rejects an incomplete or incoherent server response: %j", patch => {
    expect(parseKqContractSnapshot({ ...available, ...patch })).toBeNull();
  });
  it("requires fulfilled metrics and a bound run for successful or claimed results", () => {
    const success = { ...available, status: "succeeded", runId, quality: 8, cardsUsed: 2, canAccept: false };
    expect(parseKqContractSnapshot(success)).toEqual(success);
    for (const patch of [{ quality: 7 }, { cardsUsed: 3 }, { quality: null }, { cardsUsed: null }, { canAccept: true }, { runId: null }]) {
      expect(parseKqContractSnapshot({ ...success, ...patch })).toBeNull();
    }
    expect(parseKqContractSnapshot({ ...success, status: "claimed", cashAfterCents: 103000, replayed: true })).toMatchObject({ status: "claimed", cashAfterCents: 103000, replayed: true });
  });
  it("allows only the named contract and defined commands, never ownership or reward input", () => {
    for (const action of ["accept", "cancel", "claim"] as const) expect(parseKqContractCommand({ action, code: "light-hand" })).toEqual({ action, code: "light-hand" });
    for (const input of [null, [], { action: "accept" }, { action: "win", code: "light-hand" }, { action: "claim", code: "other" },
      { action: "claim", code: "light-hand", userId: runId }, { action: "claim", code: "light-hand", rewardCents: 100000 }]) {
      expect(parseKqContractCommand(input)).toBeNull();
    }
  });
});
