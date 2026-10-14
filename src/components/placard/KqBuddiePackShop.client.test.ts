import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEmptyLoyaltySummary } from "@/lib/loyalty";
import type { LotteryCollectedCard, ScratchResult } from "@/types/lottery";
import { createBuddiePackOpener, getBuddiePackRecap, isBuddiePackPurchaseConfirmed, purchaseBuddiePacks, readBuddiePackPurchaseCheck, readBuddiePackSnapshot, saveBuddiePackPurchaseCheck, type BuddiePackSnapshot } from "./KqBuddiePackShop.client";
import { LOTTERY_POINTS_PACK_COST } from "@/lib/lottery-collection";

const card: LotteryCollectedCard = {
  id: "card-1", collectionId: "collection", collectionCode: "BUDDIES", collectionTitle: "Buddies", code: "BUD-003",
  cardNumber: 3, name: "Buddie", rarity: "common", visualPrompt: "", description: "", imageUrl: "",
  isActive: true, createdAt: "2026-10-13", updatedAt: "2026-10-13", ownedCount: 1, isOwned: true, isDuplicate: false,
};
const snapshot = (): BuddiePackSnapshot => ({
  tickets: [{ id: "ticket-1", ticketNumber: "PACK-1", userId: "user-1", orderAmount: 0, createdAt: "2026-10-13", status: "scratched", scratchedAt: "2026-10-13T15:00:00Z", cardDefinitionId: card.id, cards: [card] }],
  inventory: null, loyalty: { ...buildEmptyLoyaltySummary(), spendablePoints: 400 },
});

afterEach(() => vi.unstubAllGlobals());

describe("Buddie pack opening recovery", () => {
  it("shares an in-flight opening and its result without opening another ticket", async () => {
    let resolve!: (value: ScratchResult) => void;
    const receipt = getBuddiePackRecap(snapshot(), "ticket-1")!;
    const open = vi.fn(() => new Promise<ScratchResult>(done => { resolve = done; }));
    const request = vi.fn();
    const once = createBuddiePackOpener(open, request as unknown as typeof fetch);
    const first = once("ticket-1"), second = once("ticket-1");
    await Promise.resolve();
    resolve(receipt);
    expect(await first).toEqual(receipt);
    expect(await second).toEqual(receipt);
    expect(await once("ticket-1")).toEqual(receipt);
    expect(open).toHaveBeenCalledExactlyOnceWith("ticket-1");
    expect(request).not.toHaveBeenCalled();
  });

  it("recovers awarded cards with a GET when the opening response is lost", async () => {
    const open = vi.fn().mockRejectedValue(new Error("Réponse perdue"));
    const request = vi.fn().mockResolvedValue(Response.json(snapshot()));
    const once = createBuddiePackOpener(open, request as unknown as typeof fetch);
    const result = await once("ticket-1");
    expect(result.ticketId).toBe("ticket-1");
    expect(result.cards).toEqual([card]);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/account/tickets", { cache: "no-store" });
    await once("ticket-1");
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("does not replace a failed opening with another ticket or unawarded cards", async () => {
    const data = snapshot();
    data.tickets[0].status = "available";
    expect(getBuddiePackRecap(data, "ticket-1")).toBeNull();
    expect(getBuddiePackRecap(snapshot(), "another-ticket")).toBeNull();
    const error = new Error("Ouverture refusée");
    const open = vi.fn().mockRejectedValue(error);
    const request = vi.fn().mockResolvedValue(Response.json(data));
    const once = createBuddiePackOpener(open, request as unknown as typeof fetch);
    await expect(once("ticket-1")).rejects.toBe(error);
    await expect(once("ticket-1")).rejects.toBe(error);
    expect(open.mock.calls).toEqual([["ticket-1"], ["ticket-1"]]);
  });

  it("retains a bonus already awarded to this ticket in a recovered recap", () => {
    const data = snapshot();
    const bonus = { id: "bonus", code: "BONUS-1", title: "Carte bonus", description: "Récompense", imageUrl: "", quotaPerCycle: 1, isActive: true, createdAt: "2026-10-13", updatedAt: "2026-10-13", options: [] };
    data.bonuses = [
      { id: "award-1", userId: "user-1", ticketId: "ticket-1", cycleId: 1, bonusDefinitionId: bonus.id, status: "available", createdAt: "2026-10-13", bonus },
      { id: "award-2", userId: "user-1", ticketId: "ticket-2", cycleId: 1, bonusDefinitionId: bonus.id, status: "available", createdAt: "2026-10-13", bonus },
    ];
    const result = getBuddiePackRecap(data, "ticket-1")!;
    expect(result.cards).toHaveLength(2);
    expect(result.cards[1]).toMatchObject({ isBonus: true, bonusInstanceId: "award-1", name: "Carte bonus" });
    expect(result.card.id).toBe(card.id);
  });

  it("requires a successful, complete balance read before an uncertain purchase is verified", async () => {
    const failed = vi.fn().mockResolvedValue(Response.json({ error: "Session expirée" }, { status: 401 }));
    await expect(readBuddiePackSnapshot(failed as unknown as typeof fetch)).rejects.toThrow("Session expirée");
    const incomplete = vi.fn().mockResolvedValue(Response.json({ tickets: [] }));
    await expect(readBuddiePackSnapshot(incomplete as unknown as typeof fetch)).rejects.toThrow("Impossible de vérifier");
  });
});

describe("uncertain Buddie pack purchases", () => {
  it("keeps an unchanged or partial snapshot unconfirmed until both grant and debit are visible", () => {
    const check = { packCount: 1, pointsBefore: 400, availableBefore: 0, ticketIdsBefore: ["ticket-1"] };
    const data = snapshot();
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(false);
    data.loyalty.spendablePoints = 400 - LOTTERY_POINTS_PACK_COST;
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(false);
    data.tickets.push({ ...data.tickets[0], id: "new-ticket", status: "available" });
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(true);
    data.loyalty.spendablePoints = 400;
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(false);
  });

  it("recognizes newly granted tickets even after they are opened, without counting repeated IDs twice", () => {
    const check = { packCount: 2, pointsBefore: 1000, availableBefore: 0, ticketIdsBefore: ["ticket-1"] };
    const data = snapshot();
    data.loyalty.spendablePoints = 1000 - 2 * LOTTERY_POINTS_PACK_COST;
    data.tickets.push({ ...data.tickets[0], id: "new-ticket" }, { ...data.tickets[0], id: "new-ticket" });
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(false);
    data.tickets.push({ ...data.tickets[0], id: "second-ticket" });
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(true);
  });

  it("requires both changes when recovering checks saved before ticket IDs were recorded", () => {
    const check = { packCount: 1, pointsBefore: 400, availableBefore: 0 };
    const data = snapshot();
    data.loyalty.spendablePoints = 400 - LOTTERY_POINTS_PACK_COST;
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(false);
    data.tickets[0].status = "available";
    expect(isBuddiePackPurchaseConfirmed(check, data)).toBe(true);
  });

  it("distinguishes definitive purchase refusals from uncertain HTTP responses", async () => {
    for (const status of [400, 401, 403, 404, 408, 429, 500]) {
      const request = vi.fn().mockResolvedValue(Response.json({ error: "Refus" }, { status }));
      await expect(purchaseBuddiePacks(1, request as unknown as typeof fetch)).rejects.toMatchObject({
        message: "Refus", definitive: status < 500 && status !== 408,
      });
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it("never repeats a lost purchase and accepts only a valid purchase receipt", async () => {
    const failed = vi.fn().mockRejectedValue(new Error("Réponse perdue"));
    await expect(purchaseBuddiePacks(2, failed as unknown as typeof fetch)).rejects.toThrow("Réponse perdue");
    expect(failed).toHaveBeenCalledTimes(1);
    const incomplete = vi.fn().mockResolvedValue(Response.json({ success: true }));
    await expect(purchaseBuddiePacks(2, incomplete as unknown as typeof fetch)).rejects.toMatchObject({ definitive: false });
    const success = vi.fn().mockResolvedValue(Response.json({ granted: 2 }));
    await expect(purchaseBuddiePacks(2, success as unknown as typeof fetch)).resolves.toBe(2);
    expect(success).toHaveBeenCalledWith("/api/account/tickets", expect.objectContaining({ method: "POST", body: JSON.stringify({ packCount: 2 }) }));
  });

  it("preserves the verification lock across remounts and scopes it to the account", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const check = { packCount: 2, pointsBefore: 500, availableBefore: 1, ticketIdsBefore: ["ticket-1"] };
    saveBuddiePackPurchaseCheck("user-1", check);
    expect(readBuddiePackPurchaseCheck("user-1")).toEqual(check);
    expect(readBuddiePackPurchaseCheck("user-2")).toBeNull();
    saveBuddiePackPurchaseCheck("user-1", null);
    expect(readBuddiePackPurchaseCheck("user-1")).toBeNull();
  });
});
