import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLotteryInventoryForCustomerFromSupabase } from "./lottery-backend";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
const userId = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const reward = (id: string, owner = userId, status = "available") => ({
  id, user_id: owner, status, created_at: "2026-11-01T00:00:00Z", gift_weight_grams: 10,
  reward_snapshot: { kind: "gift_weight_grams", title: "Tirage du Carnet · 10 g", giftWeightGrams: 10 },
});

function mockInventory(claims: Array<Record<string, unknown>>, failure = false) {
  const queriedTables: string[] = [];
  const client = { from: vi.fn((table: string) => {
    queriedTables.push(table);
    const filters: Array<[string, unknown]> = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
      order: vi.fn(() => query), limit: vi.fn(() => query), maybeSingle: vi.fn(() => query),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({
        data: table === "lottery_reward_claims" ? claims.filter((row) => filters.every(([column, value]) => row[column] === value)) : table === "lottery_card_collections" ? null : [],
        error: table === "lottery_reward_claims" && failure ? { message: "database unavailable" } : null,
      }).then(resolve),
    };
    return query;
  }) };
  mocks.client.mockReturnValue(client);
  return queriedTables;
}

beforeEach(() => vi.clearAllMocks());

describe("checkout reward inventory", () => {
  it("includes a monthly prize without any collection completion or burn", async () => {
    const tables = mockInventory([reward("monthly-prize"), reward("collection-prize")]);
    const inventory = await getLotteryInventoryForCustomerFromSupabase(userId);
    expect(inventory.availableClaims.map((claim) => claim.id)).toEqual(["monthly-prize", "collection-prize"]);
    expect(inventory.availableClaims[0]).toMatchObject({ userId, status: "available", giftWeightGrams: 10 });
    expect(tables).not.toContain("lottery_collection_burn_log");
    expect(tables).not.toContain("lottery_collection_page_completions");
  });

  it("excludes another customer's prize and used or reserved prizes", async () => {
    mockInventory([reward("mine"), reward("other", otherUser), reward("spent", userId, "used"), reward("reserved", userId, "reserved")]);
    const inventory = await getLotteryInventoryForCustomerFromSupabase(userId);
    expect(inventory.availableClaims.map((claim) => claim.id)).toEqual(["mine"]);
  });

  it("reports a failed reward lookup instead of silently presenting no prizes", async () => {
    mockInventory([], true);
    await expect(getLotteryInventoryForCustomerFromSupabase(userId)).rejects.toThrow("available lottery_reward_claims inventory");
  });

  it("does not query another inventory for an invalid identity", async () => {
    mockInventory([reward("monthly-prize")]);
    expect((await getLotteryInventoryForCustomerFromSupabase("invalid")).availableClaims).toEqual([]);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
