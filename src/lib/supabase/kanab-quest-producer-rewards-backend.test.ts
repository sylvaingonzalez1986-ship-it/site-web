import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
import {
  claimKqProducerCompletionForCustomer, claimKqProducerHeritageForCustomer,
  claimKqProducerPurchaseBuddieForCustomer, getKqProducerRewardProgressForCustomer,
  claimKqProducerQuantityBonusForCustomer,
  previewKqProducerNotebookRewardBatch, syncKqProducerNotebookRewardsForReview,
} from "@/lib/supabase/kanab-quest-producer-rewards-backend";
const customerId = "11111111-1111-1111-1111-111111111111";
const reviewId = "22222222-2222-2222-2222-222222222222";
const state = { producerId: "p1", selectedSeasonId: "season-current", qualifyingProductIds: ["a", "b"],
  reviewedProductIds: ["a"], purchasedProductIds: ["a", "b"], completionGranted: false,
  purchaseGranted: false, purchaseCard: null };
const quantityState = {
  quantityRewardsAvailable: true,
  quantityRewards: [
    { productId: "a", bestOrderGrams: 5, totalCashCents: 60_000, bonusCashCents: 50_000, grantedCashCents: 23_000, availableCashCents: 27_000 },
    { productId: "b", bestOrderGrams: 1, totalCashCents: 10_000, bonusCashCents: 0, grantedCashCents: 0, availableCashCents: 0 },
  ],
  purchaseOdds: { common: 88.75, silver: 10, gold: 1.25 },
};

type Rows = Record<string, Array<Record<string, unknown>>>;
function clientWithRows(rows: Rows, states: Array<Record<string, unknown>> = [state]) {
  const rpc = vi.fn().mockResolvedValue({ data: states, error: null });
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn(), eq: vi.fn(), in: vi.fn(), not: vi.fn(), order: vi.fn(), range: vi.fn(),
      then: (resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) =>
        Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve),
    };
    for (const method of [query.select, query.eq, query.in, query.not, query.order, query.range]) method.mockReturnValue(query);
    return query;
  });
  const client = { rpc, from };
  mocks.client.mockReturnValue(client);
  return client;
}

function catalogueRows(productIds: string[]): Rows {
  return {
    producers: [{ id: "p1", name: "Ferme" }],
    contest_entries: productIds.map((id) => ({
      id: `${id}-entry`, title: id, product_id: id, producer_id: "p1", season_id: "season-current", track: "regular",
    })),
  };
}

describe("producer notebook reward backend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the approved-review completion receipt without inventing flower packs", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { heritageGranted: 1, heritageCodes: ["HERITAGE-001"],
      completionGranted: true, cashCents: 10_000, producerId: "p1" }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(syncKqProducerNotebookRewardsForReview({ customerId, reviewId })).resolves.toEqual({
      live: true, flowerBoosterGranted: false, flowerBoostersGranted: 0, flowerBoostersTotal: 0,
      boosterCardCount: 0, heritageGranted: 1, heritageCodes: ["HERITAGE-001"], completionGranted: 1, cashCents: 10_000, producerId: "p1",
    });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_grant_producer_notebook_rewards", { p_user_id: customerId, p_review_id: reviewId });
  });

  it("loads current published products without requiring a campaign and only reads eligibility", async () => {
    const client = clientWithRows({
      producers: [{ id: "p1", name: "Ferme", image: "/farm.webp" }],
      contest_entries: [
        { id: "a-regular", title: "A", product_id: "a", producer_id: "p1", season_id: "season-current", track: "regular" },
        { id: "a-concours", title: "A concours", product_id: "a", producer_id: "p1", season_id: "season-current", track: "concours" },
        { id: "b", title: "B", product_id: "b", producer_id: "p1", season_id: "season-current", track: "concours" },
        { id: "a-old", title: "Old A", product_id: "a", producer_id: "p1", season_id: "season-old", track: "regular" },
        { id: "hidden", title: "Outside authoritative set", product_id: "hidden", producer_id: "p1", season_id: "season-current", track: "regular" },
      ],
      kq_heritage_card_definitions: [{ code: "HERITAGE-019", name: "Floraison", description: "+3", producer_id: "p1", is_active: true }],
      kq_producer_heritage_reward_grants: [{ producer_id: "p1" }],
      kq_notebook_flower_reward_grants: [{ id: "old-grant", entry_id: "a-concours", entitlement_id: "old-pack" }],
      kq_support_booster_entitlements: [{ id: "old-pack", status: "available" }],
    });
    const progress = await getKqProducerRewardProgressForCustomer(customerId);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ campaignId: "", requiredCount: 2, reviewedCount: 1, purchasedCount: 2,
      completed: false, heritageGranted: true, heritageEligible: false, purchaseReward: { eligible: true, granted: false } });
    expect(progress[0].entries[0].entryIds).toEqual(["a-regular", "a-concours"]);
    expect(progress[0].entries[0].packReward).toMatchObject({ availablePacks: 1, availableEntitlementIds: ["old-pack"], eligible: false });
    expect(client.rpc.mock.calls).toEqual([["rpc_kq_get_producer_notebook_progress", { p_user_id: customerId }]]);
  });

  it("fails closed on malformed authoritative progress", async () => {
    const client = clientWithRows({});
    client.rpc.mockResolvedValue({ data: null, error: null });
    await expect(getKqProducerRewardProgressForCustomer(customerId)).rejects.toThrow("indisponible");
  });

  it("exposes authoritative quantity top-ups and Buddie probabilities without any write", async () => {
    const client = clientWithRows(catalogueRows(["a", "b"]), [{ ...state, ...quantityState }]);
    const [progress] = await getKqProducerRewardProgressForCustomer(customerId);
    expect(progress).toMatchObject({ quantityRewardsAvailable: true,
      quantityReward: { bonusCashCents: 50_000, grantedCashCents: 23_000, availableCashCents: 27_000 },
      purchaseReward: { odds: quantityState.purchaseOdds } });
    expect(progress.entries.map(entry => entry.quantityReward)).toEqual(quantityState.quantityRewards);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_get_producer_notebook_progress", { p_user_id: customerId });
  });

  it.each([undefined, false])("disables new rewards when the migration marker is %s", async quantityRewardsAvailable => {
    clientWithRows(catalogueRows(["a", "b"]), [{ ...state, ...quantityState, quantityRewardsAvailable }]);
    const [progress] = await getKqProducerRewardProgressForCustomer(customerId);
    expect(progress).toMatchObject({ quantityRewardsAvailable: false,
      quantityReward: { bonusCashCents: 0, grantedCashCents: 0, availableCashCents: 0 },
      purchaseReward: { odds: null } });
    expect(progress.entries[0].quantityReward.bestOrderGrams).toBe(0);
  });

  it("preserves historical quantity payments after a cancelled purchase, and unknown historic odds", async () => {
    clientWithRows(catalogueRows(["a", "b"]), [{ ...state, ...quantityState, purchaseOdds: null,
      quantityRewards: [{ ...quantityState.quantityRewards[0], bestOrderGrams: 0, totalCashCents: 0, bonusCashCents: 0, availableCashCents: 0 }, quantityState.quantityRewards[1]] }]);
    const [progress] = await getKqProducerRewardProgressForCustomer(customerId);
    expect(progress).toMatchObject({ quantityReward: { grantedCashCents: 23_000, availableCashCents: 0 }, purchaseReward: { odds: null } });
  });

  it.each([
    { quantityRewardsAvailable: "true" }, { quantityRewards: null }, { quantityRewards: [] },
    { quantityRewards: [quantityState.quantityRewards[0], quantityState.quantityRewards[0]] },
    { quantityRewards: [{ ...quantityState.quantityRewards[0], productId: "other" }, quantityState.quantityRewards[1]] },
    { purchaseOdds: undefined }, { purchaseOdds: { common: 99, silver: 10, gold: 1 } },
    { purchaseOdds: { common: 89, silver: 10, gold: "1" } },
    { purchaseOdds: { common: 91, silver: 10, gold: -1 } },
    { purchaseOdds: { common: Number.NaN, silver: 10, gold: 1 } },
  ])("rejects invalid authoritative quantity fields: %j", async invalid => {
    clientWithRows({}, [{ ...state, ...quantityState, ...invalid }]);
    await expect(getKqProducerRewardProgressForCustomer(customerId)).rejects.toThrow("indisponible");
  });

  it.each([
    { bestOrderGrams: -1 }, { bestOrderGrams: Number.POSITIVE_INFINITY }, { bestOrderGrams: "5" },
    { totalCashCents: 1.5 }, { bonusCashCents: -1 }, { grantedCashCents: 2_147_483_648 },
    { grantedCashCents: null }, { availableCashCents: "27000" }, { availableCashCents: 27_001 },
    { totalCashCents: 49_999 },
  ])("rejects malformed quantity money and grams: %j", async invalid => {
    clientWithRows({}, [{ ...state, ...quantityState,
      quantityRewards: [{ ...quantityState.quantityRewards[0], ...invalid }, quantityState.quantityRewards[1]] }]);
    await expect(getKqProducerRewardProgressForCustomer(customerId)).rejects.toThrow("indisponible");
  });

  it.each([
    { products: ["a", "b"], cashCents: 20_000 },
    { products: ["a", "b", "c"], cashCents: 30_000 },
  ])("exposes the authoritative $cashCents-cent completion reward", async ({ products, cashCents }) => {
    const rows = catalogueRows(products);
    rows.contest_entries.push({ ...rows.contest_entries[0], id: "a-concours", track: "concours" });
    clientWithRows(rows, [{ ...state, qualifyingProductIds: products, reviewedProductIds: products, completionCashCents: cashCents }]);
    const [progress] = await getKqProducerRewardProgressForCustomer(customerId);
    expect(progress).toMatchObject({ requiredCount: products.length, completed: true,
      completionReward: { cashCents, granted: false } });
    expect(progress.entries[0].entryIds).toEqual(["a-entry", "a-concours"]);
  });

  it.each([10_000, 20_000])("keeps a received %i-cent bonus after the catalogue grows to three flowers", async cashCents => {
    const products = ["a", "b", "c"];
    clientWithRows(catalogueRows(products), [{ ...state, qualifyingProductIds: products,
      completionGranted: true, completionCashCents: cashCents }]);
    expect((await getKqProducerRewardProgressForCustomer(customerId))[0].completionReward).toEqual({
      kind: "cash", cashCents, granted: true,
    });
  });

  it.each([false, true])("uses the old fixed bonus while the database lacks the new field (granted=%s)", async completionGranted => {
    const products = ["a", "b", "c"];
    clientWithRows(catalogueRows(products), [{ ...state, qualifyingProductIds: products, completionGranted }]);
    expect((await getKqProducerRewardProgressForCustomer(customerId))[0].completionReward).toEqual({
      kind: "cash", cashCents: 10_000, granted: completionGranted,
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648, "20000", null, undefined])(
    "rejects a malformed authoritative completion amount: %s", async completionCashCents => {
      clientWithRows({}, [{ ...state, completionCashCents }]);
      await expect(getKqProducerRewardProgressForCustomer(customerId)).rejects.toThrow("indisponible");
    },
  );

  it.each([
    { completionGranted: false, completionCashCents: 0 },
    { completionGranted: true, completionCashCents: 10_000 },
    { completionGranted: false },
    { completionGranted: true },
  ])("accepts empty requirements without inventing a new reward: %j", async completion => {
    clientWithRows(catalogueRows([]), [{ ...state, qualifyingProductIds: [], ...completion }]);
    await expect(getKqProducerRewardProgressForCustomer(customerId)).resolves.toEqual([]);
  });

  it.each([
    { completionGranted: false, completionCashCents: 10_000 },
    { completionGranted: true, completionCashCents: 0 },
  ])("rejects inconsistent empty-catalogue amounts: %j", async completion => {
    clientWithRows({}, [{ ...state, qualifyingProductIds: [], ...completion }]);
    await expect(getKqProducerRewardProgressForCustomer(customerId)).rejects.toThrow("indisponible");
  });

  it("does not report a completed catalogue from incomplete metadata", async () => {
    clientWithRows({ producers: [{ id: "p1", name: "Farm" }], contest_entries: [
      { id: "a", product_id: "a", producer_id: "p1", season_id: "season-current" },
    ] });
    await expect(getKqProducerRewardProgressForCustomer(customerId)).rejects.toThrow("catalogue");
  });

  it("does not unlock legacy Heritage from a review outside its configured campaign", async () => {
    const rows = {
      producers: [{ id: "p1", name: "Farm" }],
      contest_entries: [{ id: "a", product_id: "a", producer_id: "p1", season_id: "season-current" },
        { id: "b", product_id: "b", producer_id: "p1", season_id: "season-current" }],
      kq_producer_reward_campaigns: [{ id: "campaign-1", producer_id: "p1" }],
      kq_producer_reward_entries: [{ campaign_id: "campaign-1", entry_id: "b" }],
      contest_reviews: [{ entry_id: "a" }],
    };
    clientWithRows(rows);
    expect((await getKqProducerRewardProgressForCustomer(customerId))[0].heritageEligible).toBe(false);
    clientWithRows({ ...rows, contest_reviews: [{ entry_id: "b" }] });
    expect((await getKqProducerRewardProgressForCustomer(customerId))[0].heritageEligible).toBe(true);
  });

  it("claims completion through the atomic RPC and preserves replay information", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { producerId: "p1", cashCents: 10_000,
      alreadyGranted: true, qualifyingProductIds: ["a", "b"] }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerCompletionForCustomer({ customerId, producerId: "p1" })).resolves.toMatchObject({
      cashCents: 10_000, alreadyGranted: true,
    });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_claim_producer_completion", { p_user_id: customerId, p_producer_id: "p1" });
  });

  it.each([
    { cashCents: 20_000, qualifyingProductIds: ["a", "b"] },
    { cashCents: 30_000, qualifyingProductIds: ["a", "b", "c"] },
  ])("returns the persisted $cashCents-cent claim without rereading the catalogue", async receipt => {
    const rpc = vi.fn().mockResolvedValue({ data: { producerId: "p1", alreadyGranted: false, ...receipt }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerCompletionForCustomer({ customerId, producerId: "p1" })).resolves.toEqual({
      producerId: "p1", alreadyGranted: false, ...receipt,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_claim_producer_completion", { p_user_id: customerId, p_producer_id: "p1" });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648, "20000", null, undefined])(
    "rejects an invalid claim amount: %s", async cashCents => {
      const rpc = vi.fn().mockResolvedValue({ data: { producerId: "p1", alreadyGranted: false, cashCents, qualifyingProductIds: ["a", "b"] }, error: null });
      mocks.client.mockReturnValue({ rpc });
      await expect(claimKqProducerCompletionForCustomer({ customerId, producerId: "p1" })).rejects.toThrow("indisponible");
    },
  );

  it.each([[], null, undefined, "a", [""], ["  "], ["a", 123]])("rejects a claim without a valid historical product snapshot: %j", async qualifyingProductIds => {
    const rpc = vi.fn().mockResolvedValue({ data: { producerId: "p1", alreadyGranted: true, cashCents: 10_000, qualifyingProductIds }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerCompletionForCustomer({ customerId, producerId: "p1" })).rejects.toThrow("indisponible");
  });

  it("only accepts a persisted common, silver or gold Buddie from the purchase RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { producerId: "p1", cardCode: "HH2026-005", cardName: "ACDC",
      cardRarity: "gold", cardImageUrl: "/acdc.webp", cardInstanceId: "instance-1", alreadyGranted: false,
      qualifyingProductIds: ["a", "b"] }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerPurchaseBuddieForCustomer({ customerId, producerId: "p1" })).resolves.toMatchObject({ cardRarity: "gold", cardInstanceId: "instance-1" });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_claim_producer_purchase_buddie", { p_user_id: customerId, p_producer_id: "p1" });
    rpc.mockResolvedValue({ data: { producerId: "p1", cardCode: "HH2026-001", cardName: "Legend", cardRarity: "legendary", cardInstanceId: "instance-2", alreadyGranted: false }, error: null });
    await expect(claimKqProducerPurchaseBuddieForCustomer({ customerId, producerId: "p1" })).rejects.toThrow("indisponible");
  });

  it.each([false, true])("accepts a common Buddie receipt including a recycled card (replay=%s)", async alreadyGranted => {
    const receipt = { producerId: "p1", cardCode: "HH2026-025", cardName: "Commun", cardRarity: "common",
      cardImageUrl: "/common.webp", cardInstanceId: alreadyGranted ? null : "instance-common", alreadyGranted, qualifyingProductIds: ["a", "b"] };
    const rpc = vi.fn().mockResolvedValue({ data: receipt, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerPurchaseBuddieForCustomer({ customerId, producerId: "p1" })).resolves.toEqual(receipt);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_claim_producer_purchase_buddie", { p_user_id: customerId, p_producer_id: "p1" });
  });

  it("keeps an already granted common Buddie visible in notebook progress", async () => {
    const purchaseCard = { code: "HH2026-025", name: "Commun", rarity: "common", imageUrl: "/common.webp" };
    clientWithRows(catalogueRows(["a", "b"]), [{ ...state, purchaseGranted: true, purchaseCard }]);
    expect((await getKqProducerRewardProgressForCustomer(customerId))[0].purchaseReward.card).toEqual(purchaseCard);
  });

  it("claims the server-computed quantity delta once and returns zero when retried", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { producerId: "p1", cashCents: 27_000, alreadyGranted: false }, error: null })
      .mockResolvedValueOnce({ data: { producerId: "p1", cashCents: 0, alreadyGranted: true }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerQuantityBonusForCustomer({ customerId, producerId: " p1 " })).resolves.toEqual({
      producerId: "p1", cashCents: 27_000, alreadyGranted: false,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_claim_producer_quantity_bonus", { p_user_id: customerId, p_producer_id: "p1" });
    await expect(claimKqProducerQuantityBonusForCustomer({ customerId, producerId: "p1" })).resolves.toEqual({
      producerId: "p1", cashCents: 0, alreadyGranted: true,
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it.each([
    { cashCents: -1 }, { cashCents: 1.5 }, { cashCents: Number.NaN }, { cashCents: 2_147_483_648 },
    { cashCents: "27000" }, { cashCents: null }, { cashCents: undefined }, { producerId: "other" },
    { alreadyGranted: "false" }, { alreadyGranted: true }, { cashCents: 0 },
  ])("rejects invalid quantity claim receipts: %j", async invalid => {
    const rpc = vi.fn().mockResolvedValue({ data: { producerId: "p1", cashCents: 27_000, alreadyGranted: false, ...invalid }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerQuantityBonusForCustomer({ customerId, producerId: "p1" })).rejects.toThrow("indisponible");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns the historical purchase receipt after its Buddie was consumed", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { producerId: "p1", cardCode: "HH2026-005", cardName: "ACDC",
      cardRarity: "gold", cardImageUrl: "/acdc.webp", cardInstanceId: null, alreadyGranted: true,
      qualifyingProductIds: ["a", "b"] }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerPurchaseBuddieForCustomer({ customerId, producerId: "p1" })).resolves.toMatchObject({
      cardInstanceId: null, alreadyGranted: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid claim identities before persistence and hides database failures", async () => {
    await expect(claimKqProducerCompletionForCustomer({ customerId: "bad", producerId: "p1" })).rejects.toThrow("invalide");
    await expect(claimKqProducerPurchaseBuddieForCustomer({ customerId, producerId: "" })).rejects.toThrow("invalide");
    await expect(claimKqProducerQuantityBonusForCustomer({ customerId: "bad", producerId: "p1" })).rejects.toThrow("invalide");
    await expect(claimKqProducerQuantityBonusForCustomer({ customerId, producerId: " " })).rejects.toThrow("invalide");
    expect(mocks.client).not.toHaveBeenCalled();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "private table detail" } });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerCompletionForCustomer({ customerId, producerId: "p1" })).rejects.toThrow("momentanément indisponible");
    await expect(claimKqProducerQuantityBonusForCustomer({ customerId, producerId: "p1" })).rejects.toThrow("momentanément indisponible");
    rpc.mockResolvedValue({ data: null, error: { message: "kq_producer_purchase_incomplete" } });
    await expect(claimKqProducerPurchaseBuddieForCustomer({ customerId, producerId: "p1" })).rejects.toThrow("Achète chaque fleur");
  });

  it("preserves the legacy Heritage claim endpoint", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { cardCode: "HERITAGE-001", alreadyGranted: false }, error: null });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerHeritageForCustomer({ customerId, campaignId: reviewId, entryId: "flower-1" })).resolves.toEqual({ cardCode: "HERITAGE-001", alreadyGranted: false });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_claim_producer_heritage", { p_user_id: customerId, p_campaign_id: reviewId, p_entry_id: "flower-1" });
  });

  it("previews one completion per producer despite repeated reviews and never plans new flower packs", async () => {
    const client = clientWithRows({
      contest_reviews: [{ id: "r1", customer_id: customerId, entry_id: "a" }, { id: "r2", customer_id: customerId, entry_id: "a" }],
      contest_entries: [{ id: "a", product_id: "a", producer_id: "p1" }],
      kq_producer_reward_campaigns: [{ id: "campaign-1", producer_id: "p1", heritage_code: "HERITAGE-001" }],
      kq_producer_reward_entries: [{ campaign_id: "campaign-1", entry_id: "a" }],
      kq_heritage_card_definitions: [{ code: "HERITAGE-001", is_active: true }],
    }, [{ ...state, reviewedProductIds: ["a", "b"] }]);
    await expect(previewKqProducerNotebookRewardBatch()).resolves.toEqual({
      live: true, processed: 2, eligibleReviews: 2, pendingFlowerBoosters: 0, pendingHeritages: 1,
      pendingCompletions: 1, pendingCashCents: 10_000, alreadyComplete: 1, nextCursor: null,
    });
    expect(client.rpc.mock.calls.every(([name]) => name === "rpc_kq_get_producer_notebook_progress")).toBe(true);
  });

  it("previews 500 euros for producers with two and three flowers, deduplicating repeated reviews", async () => {
    const client = clientWithRows({
      contest_reviews: [
        { id: "r1", customer_id: customerId, entry_id: "a" },
        { id: "r2", customer_id: customerId, entry_id: "a" },
        { id: "r3", customer_id: customerId, entry_id: "c" },
        { id: "r4", customer_id: customerId, entry_id: "c" },
        { id: "r5", customer_id: customerId, entry_id: "legacy" },
      ],
      contest_entries: [{ id: "a", product_id: "a", producer_id: "p1" },
        { id: "c", product_id: "c", producer_id: "p2" }, { id: "legacy", product_id: "legacy", producer_id: "p3" }],
    }, [
      { ...state, reviewedProductIds: ["a", "b"], completionCashCents: 20_000 },
      { ...state, producerId: "p2", qualifyingProductIds: ["c", "d", "e"], reviewedProductIds: ["c", "d", "e"], completionCashCents: 30_000 },
      { ...state, producerId: "p3", qualifyingProductIds: ["legacy"], reviewedProductIds: ["legacy"], completionGranted: true, completionCashCents: 10_000 },
    ]);
    await expect(previewKqProducerNotebookRewardBatch()).resolves.toMatchObject({
      processed: 5, eligibleReviews: 5, pendingCompletions: 2, pendingCashCents: 50_000, alreadyComplete: 3,
    });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_get_producer_notebook_progress", { p_user_id: customerId });
  });

  it("previews a quantity top-up before producer completion and deduplicates repeated reviews", async () => {
    const client = clientWithRows({
      contest_reviews: [{ id: "r1", customer_id: customerId, entry_id: "a" }, { id: "r2", customer_id: customerId, entry_id: "a" }],
      contest_entries: [{ id: "a", product_id: "a", producer_id: "p1" }],
    }, [{ ...state, ...quantityState }]);
    await expect(previewKqProducerNotebookRewardBatch()).resolves.toMatchObject({
      processed: 2, eligibleReviews: 2, pendingCashCents: 27_000, pendingCompletions: 0, alreadyComplete: 1,
    });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_get_producer_notebook_progress", { p_user_id: customerId });
  });
});
