import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import { KQ_ACTIVE_CARDS, KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { getKqPlayerCollectionBundle, getKqPlayerCollectionSnapshot, getKqPlayerHeritageSnapshot, getKqPlayerOwnedBuddies } from "./kanab-quest-backend";

const ownerId = "11000000-0000-4000-8000-000000000001";
const supportId = "22000000-0000-4000-8000-000000000001";
const buddieId = "22000000-0000-4000-8000-000000000002";
const missingId = "22000000-0000-4000-8000-000000000003";
const supportDefinitions = [
  { id: supportId, code: KQ_ACTIVE_CARDS[0].code, name: "Support", rarity: "common", description: "support", image_url: "/support.webp", is_active: true },
  { id: missingId, code: KQ_ACTIVE_CARDS[1].code, name: "Missing support", rarity: "common", description: "support", image_url: "", is_active: true },
  { id: "inactive", code: KQ_ACTIVE_CARDS[2].code, name: "Inactive", is_active: false },
];
const buddieDefinitions = [
  { id: buddieId, code: KQ_BUDDIES[0].code, name: "Buddie", rarity: "common", card_number: 1, image_url: "/buddie.webp" },
];

function database() {
  mocks.client.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.from.mockImplementation((table: string) => {
    if (table === "lottery_card_instances") throw new Error("Must aggregate copies in SQL");
    let data: unknown = table === "lottery_card_collections" ? { id: "collection", is_active: true }
      : table === "kq_culture_token_wallets" ? { balance: 9 }
      : table === "kq_heritage_card_definitions" ? [{ code: "HERITAGE-001", name: "Heritage", timing: "passive", effect_code: "starting-xp", description: "heritage", image_url: "", is_active: true, producer_id: "p1", producer_name: "Producer", producer_image: "" }]
      : supportDefinitions;
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder, maybeSingle: () => builder,
      in: () => { data = buddieDefinitions; return builder; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return builder;
  });
  mocks.rpc.mockImplementation(async name => ({ data: name === "rpc_kq_reserved_cards" ? [] : { [supportId]: 1505, [buddieId]: 1201 }, error: null }));
}

describe("bounded collection reads", () => {
  beforeEach(() => { vi.clearAllMocks(); database(); });

  it("loads support and Buddie ownership with a single aggregate request at bootstrap", async () => {
    const result = await getKqPlayerCollectionBundle(ownerId);
    expect(result.collection).toMatchObject({ ownerFound: true, cultureTokenBalance: 9, inventory: { [KQ_ACTIVE_CARDS[0].code]: 1505, [KQ_ACTIVE_CARDS[1].code]: 0 } });
    expect(result.collection.cards).toHaveLength(2);
    expect(result.ownedBuddies).toEqual([{ code: KQ_BUDDIES[0].code, name: "Buddie", rarity: "common", cardNumber: 1, imageUrl: "/buddie.webp", ownedCopies: 1201 }]);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_card_copy_counts", { p_user_id: ownerId, p_definition_ids: [supportId, missingId, buddieId] });
  });

  it("keeps standalone readers compatible and never caches an owner's mutable counts", async () => {
    expect((await getKqPlayerCollectionSnapshot(ownerId)).inventory[KQ_ACTIVE_CARDS[0].code]).toBe(1505);
    mocks.rpc.mockImplementation(async name => ({ data: name === "rpc_kq_reserved_cards" ? [] : { [supportId]: "1504" }, error: null }));
    expect((await getKqPlayerCollectionSnapshot(ownerId)).inventory[KQ_ACTIVE_CARDS[0].code]).toBe(1504);
    expect(await getKqPlayerOwnedBuddies(ownerId)).toEqual([]);
  });

  it("fails closed on a missing migration or invalid ownership count", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "function missing" } });
    await expect(getKqPlayerCollectionBundle(ownerId)).rejects.toThrow("rpc_kq_card_copy_counts");
    mocks.rpc.mockResolvedValue({ data: { [supportId]: -1 }, error: null });
    await expect(getKqPlayerCollectionSnapshot(ownerId)).rejects.toThrow("Invalid copy count");
  });

  it("maps exact heritage counts independently of optional history", async () => {
    const summary = { totalPulls: 1206, eligiblePurchaseUnits: 2410, attributedPurchaseUnits: 1205, ownedCounts: { "HERITAGE-001": 1205 }, producerNamesByCard: { "HERITAGE-001": ["Producer", "Other"] }, fragmentBalance: 14, fragmentHistory: [{ id: "ledger", amount: 1, reason: "duplicate", created_at: "2026-10-11" }], draws: [] };
    mocks.rpc.mockResolvedValue({ data: summary, error: null });
    const result = await getKqPlayerHeritageSnapshot(ownerId, { includeDraws: false });
    expect(result).toMatchObject({ totalPulls: 1206, pendingPurchaseUnits: 1205, fragmentBalance: 14, draws: [], cards: [{ ownedCopies: 1205, producerNames: ["Producer", "Other"] }] });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_heritage_snapshot", { p_user_id: ownerId, p_include_draws: false });
    await getKqPlayerHeritageSnapshot(ownerId);
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_heritage_snapshot", { p_user_id: ownerId, p_include_draws: true });
  });

  it("rejects invalid owners before any database request", async () => {
    await expect(getKqPlayerCollectionBundle("invalid")).rejects.toThrow("Compte Placard invalide");
    await expect(getKqPlayerHeritageSnapshot("invalid")).rejects.toThrow("Profil Héritage invalide");
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("keeps owned copies visible while excluding active reservations from new decks", async () => {
    mocks.rpc.mockImplementation(async name => ({ data: name === "rpc_kq_reserved_cards"
      ? [{ cardInstanceId: "copy-one", runId: "run-one", cardCode: KQ_ACTIVE_CARDS[0].code }]
      : { [supportId]: 2 }, error: null }));
    const result = await getKqPlayerCollectionBundle(ownerId);
    expect(result.collection.inventory[KQ_ACTIVE_CARDS[0].code]).toBe(2);
    expect(result.collection.availableInventory?.[KQ_ACTIVE_CARDS[0].code]).toBe(1);
    expect(result.collection.cards[0].ownedCopies).toBe(2);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_reserved_cards", { p_user_id: ownerId });
  });
});
