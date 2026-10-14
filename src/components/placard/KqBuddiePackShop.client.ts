import type { LotteryBonusInstance, LotteryCollectedCard, LotteryInventory, LotteryTicket, ScratchResult } from "@/types/lottery";
import type { LoyaltySummary } from "@/types/loyalty";
import { LOTTERY_POINTS_PACK_COST } from "@/lib/lottery-collection";

export type BuddiePackSnapshot = {
  tickets: LotteryTicket[];
  inventory: LotteryInventory | null;
  loyalty: LoyaltySummary;
  bonuses?: LotteryBonusInstance[];
};

export class BuddiePackPurchaseError extends Error {
  constructor(message: string, readonly definitive: boolean) { super(message); this.name = "BuddiePackPurchaseError"; }
}

/** Preserve definitive HTTP refusals; connection loss still requires a read-only verification. */
export async function purchaseBuddiePacks(packCount: number, request: typeof fetch = fetch): Promise<number> {
  const response = await request("/api/account/tickets", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packCount }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null) as { granted?: number; error?: string } | null;
  if (!response.ok) {
    // This route rejects 429 before invoking the purchase; no debit can follow it.
    throw new BuddiePackPurchaseError(payload?.error || "Achat packs impossible.", response.status >= 400 && response.status < 500 && response.status !== 408);
  }
  const granted = payload?.granted;
  if (typeof granted !== "number" || !Number.isInteger(granted) || granted < 0) throw new BuddiePackPurchaseError("La réponse d’achat n’a pas pu être confirmée.", false);
  return granted;
}

export async function readBuddiePackSnapshot(request: typeof fetch = fetch): Promise<BuddiePackSnapshot> {
  const response = await request("/api/account/tickets", { cache: "no-store" });
  const payload = await response.json() as BuddiePackSnapshot & { error?: string };
  if (!response.ok || !Array.isArray(payload.tickets) || !Number.isFinite(payload.loyalty?.spendablePoints)) {
    throw new Error(payload.error || "Impossible de vérifier tes packs et tes points.");
  }
  return payload;
}

/** Read the already awarded cards after a lost scratch response; never draw a second pack. */
export function getBuddiePackRecap(snapshot: BuddiePackSnapshot, ticketId: string): ScratchResult | null {
  const ticket = snapshot.tickets.find(item => item.id === ticketId);
  if (ticket?.status !== "scratched" || !ticket.scratchedAt || !ticket.cards?.length) return null;
  const cards = [...ticket.cards];
  // The tickets endpoint stores card instances separately from bonus instances.
  // A recovered recap keeps all awarded items, with the bonus after the cards.
  for (const instance of snapshot.bonuses ?? []) {
    if (instance.ticketId !== ticketId || cards.some(card => card.bonusInstanceId === instance.id)) continue;
    const bonus = instance.bonus;
    const bonusCard: LotteryCollectedCard = {
      id: bonus.id, collectionId: cards[0].collectionId, collectionCode: "BONUS", collectionTitle: "Cartes Bonus",
      code: bonus.code, cardNumber: 0, name: bonus.title, rarity: "legendary", visualPrompt: "",
      description: bonus.description, imageUrl: bonus.imageUrl, isActive: bonus.isActive,
      createdAt: bonus.createdAt, updatedAt: bonus.updatedAt, ownedCount: 1, isOwned: true, isDuplicate: false,
      isBonus: true, bonusInstanceId: instance.id, bonusOptions: bonus.options,
    };
    cards.push(bonusCard);
  }
  const inventory = snapshot.inventory;
  return {
    ticketId: ticket.id, ticketNumber: ticket.ticketNumber, scratchedAt: ticket.scratchedAt,
    card: cards.find(card => card.id === ticket.cardDefinitionId) ?? cards[0], cards,
    inventory: {
      totalCards: inventory?.totalCards ?? 0, uniqueOwned: inventory?.uniqueOwned ?? 0,
      totalOwnedCopies: inventory?.totalOwnedCopies ?? 0, duplicateCopies: inventory?.duplicateCopies ?? 0,
      byRarity: {
        common: inventory?.byRarity.find(item => item.rarity === "common")?.ownedCopies ?? 0,
        silver: inventory?.byRarity.find(item => item.rarity === "silver")?.ownedCopies ?? 0,
        gold: inventory?.byRarity.find(item => item.rarity === "gold")?.ownedCopies ?? 0,
        epic: inventory?.byRarity.find(item => item.rarity === "epic")?.ownedCopies ?? 0,
        legendary: inventory?.byRarity.find(item => item.rarity === "legendary")?.ownedCopies ?? 0,
      },
    },
  };
}

/** Share an in-flight opening and retain its result if the animation is closed/reopened. */
export function createBuddiePackOpener(open: (ticketId: string) => Promise<ScratchResult>, request: typeof fetch = fetch) {
  const results = new Map<string, Promise<ScratchResult>>();
  return (ticketId: string): Promise<ScratchResult> => {
    const existing = results.get(ticketId);
    if (existing) return existing;
    const result = Promise.resolve().then(() => open(ticketId)).catch(async cause => {
      try {
        const recovered = getBuddiePackRecap(await readBuddiePackSnapshot(request), ticketId);
        if (recovered) return recovered;
      } catch { /* Preserve the opening error; a failed read cannot authorize a new draw. */ }
      throw cause;
    }).catch(cause => {
      results.delete(ticketId);
      throw cause;
    });
    results.set(ticketId, result);
    return result;
  };
}

export type BuddiePackPurchaseCheck = { packCount: number; pointsBefore: number; availableBefore: number; ticketIdsBefore?: string[] };

/** An unchanged or partial read cannot settle an uncertain, non-idempotent purchase. */
export function isBuddiePackPurchaseConfirmed(check: BuddiePackPurchaseCheck, snapshot: BuddiePackSnapshot): boolean {
  const debited = snapshot.loyalty.spendablePoints <= check.pointsBefore - check.packCount * LOTTERY_POINTS_PACK_COST;
  const previousIds = check.ticketIdsBefore ? new Set(check.ticketIdsBefore) : null;
  const granted = previousIds
    ? new Set(snapshot.tickets.filter(ticket => !previousIds.has(ticket.id)).map(ticket => ticket.id)).size >= check.packCount
    : snapshot.tickets.filter(ticket => ticket.status === "available").length >= check.availableBefore + check.packCount;
  return debited && granted;
}
const pendingKey = (userId: string) => `kq:buddie-pack-purchase-check:${userId}`;

export function readBuddiePackPurchaseCheck(userId: string): BuddiePackPurchaseCheck | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey(userId)) || "null") as BuddiePackPurchaseCheck | null;
    return value && Number.isInteger(value.packCount) && value.packCount > 0
      && Number.isFinite(value.pointsBefore) && Number.isInteger(value.availableBefore)
      && (value.ticketIdsBefore === undefined || (Array.isArray(value.ticketIdsBefore) && value.ticketIdsBefore.every(id => typeof id === "string"))) ? value : null;
  } catch { return null; }
}

export function saveBuddiePackPurchaseCheck(userId: string, value: BuddiePackPurchaseCheck | null) {
  try {
    if (value) sessionStorage.setItem(pendingKey(userId), JSON.stringify(value));
    else sessionStorage.removeItem(pendingKey(userId));
  } catch { /* The mounted shop still retains the pending check if storage is unavailable. */ }
}
