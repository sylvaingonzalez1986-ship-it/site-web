import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), energy: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: () => ({ insert: mocks.insert }) }) }));
vi.mock("./kanab-quest-market-backend", () => ({ getKqMarketSnapshot: vi.fn() }));
vi.mock("./kanab-quest-energy-backend", () => ({ getKqEnergySummary: mocks.energy }));
import { getKqCommerceSnapshot, handleKqCommerceAction } from "./kanab-quest-commerce-backend";
import { createKqStorageLot, KQ_CURING_DURATION_MS } from "@/lib/kanab-quest-storage";
import { createKqBusinessPreview } from "@/lib/kanab-quest-business";
import { createKqOnlinePreview } from "@/lib/kanab-quest-online";
import { createKqCustomerDemandSnapshot, KQ_CUSTOMER_DEMAND_PERIOD_MS } from "@/lib/kanab-quest-customer-demand";
const user = "00000000-0000-4000-8000-000000000001", stockId = "00000000-0000-4000-8000-000000000002", flowerId = "00000000-0000-4000-8000-000000000003";
const now = Date.parse("2026-10-10T12:00:00Z");
function current() {
  const storageState = createKqStorageLot({ flowerId, harvestedAt: new Date(now - KQ_CURING_DURATION_MS + 60_000).toISOString(),
    baseline: { varietyCode: "KQ-VAR-001", juryScore: 9, aroma: 90, care: { terpenes: 90, cannabinoidExpression: 90, cannabinoidConversion: 5, cannabinoidOxidation: 0 } } });
  return { revision: 3, business: createKqBusinessPreview(now), customerDemand: createKqCustomerDemandSnapshot(now), online: { version: 1 }, cashCents: 100000, reputation: 1500, clients: 100,
    computerOwned: true, internetRenew: true, campaign: { id: "cycle", revision: 4, reputation: 1500, clientsStart: 100, event: "normal", internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 },
    stocks: [{ id: stockId, flowerId, name: "Test", route: "raw", batchRoute: "raw", juryScore: 9, initialUnits: 1200, remainingUnits: 1200, equivalentUnits: 1200, originalUnits: 1200, baseUnitCents: 180, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, storageState, storageRevision: 7 }],
    receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
  };
}
describe("storage-aware server commerce quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: current(), error: null });
    mocks.insert.mockResolvedValue({ error: null }); mocks.energy.mockResolvedValue({ outstandingCents: 0 });
  });
  it("persists the server storage revision and expires before the next storage change", async () => {
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "wholesale", policy: "advised", units: 100,
      storageRevision: 999, readyAt: "past" });
    expect(result.expiresAt).toBe(new Date(now + 60_000).toISOString());
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ storage_revision: 7, expires_at: result.expiresAt, user_id: user }));
  });
  it("stores the authoritative wholesale price and ignores client tariff and quality overrides", async () => {
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "wholesale", policy: "premium", units: 100,
      unitCents: 999999, payoutCents: 999999, juryScore: 10, event: "restock", wholesalePricePercent: 100 });
    expect(result.offer).toMatchObject({ unitCents: 210, payoutCents: 2100, reputationDelta: 0 });
    expect(result.stock).toEqual({ name: "Test", route: "raw", remainingUnits: 1200, quality: 9 });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ offer: expect.objectContaining({ unitCents: 210, payoutCents: 2100 }) }));
  });
  it("does not persist a refused immature retail quote", async () => {
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "cbd-shop", policy: "advised", units: 100 });
    expect(result.offer.reason).toContain("Curing");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each(["commerce_offer_changed", "commerce_storage_changed"])("identifies an authoritative %s rejection for explicit requoting", async code => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: code } });
    await expect(handleKqCommerceAction(user, { action: "sell", quoteId: stockId, expectedPayoutCents: 2100,
      requestKey: flowerId })).rejects.toMatchObject({ name: "KqCommerceOfferChangedError", code });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("fails closed if SQL has not supplied the storage migration data", async () => {
    const value = current();
    mocks.rpc.mockResolvedValue({ data: { ...value, stocks: [{ ...value.stocks[0], storageState: null }] }, error: null });
    await expect(handleKqCommerceAction(user, { action: "quote", stockId, channel: "wholesale", policy: "advised" })).rejects.toThrow("storage_migration_required");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("expires a quote at the demand boundary and ignores client supplied deadlines", async () => {
    const boundary = Math.ceil(now / KQ_CUSTOMER_DEMAND_PERIOD_MS) * KQ_CUSTOMER_DEMAND_PERIOD_MS;
    const at = boundary - 30_000;
    const snapshot = current();
    mocks.rpc.mockResolvedValue({ data: { ...snapshot, business: createKqBusinessPreview(at),
      customerDemand: createKqCustomerDemandSnapshot(at) }, error: null });
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "wholesale", policy: "advised", units: 100,
      expiresAt: "2099-01-01T00:00:00Z", customerDemand: { endsAt: "2099-01-01T00:00:00Z" } });
    expect(result.expiresAt).toBe(new Date(boundary).toISOString());
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ expires_at: new Date(boundary).toISOString() }));
  });
  it("does not store new tariffs if the database still uses the previous market version", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...current(), customerDemand: undefined }, error: null });
    await expect(handleKqCommerceAction(user, { action: "quote", stockId, channel: "wholesale", policy: "advised" }))
      .rejects.toThrow("customer_demand_migration_required");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([6, undefined])("preserves the server website capability %s without inventing one for older snapshots", async maxLevel => {
    const online = createKqOnlinePreview(now);
    if (maxLevel === undefined) delete online.site.maxLevel;
    else online.site.maxLevel = maxLevel;
    mocks.rpc.mockResolvedValue({ data: { ...current(), online }, error: null });
    const snapshot = await getKqCommerceSnapshot(user, true);
    expect(snapshot.online?.site.maxLevel).toBe(maxLevel);
    expect(Object.hasOwn(snapshot.online!.site, "maxLevel")).toBe(maxLevel !== undefined);
    expect(snapshot.online?.site.tier).toBe(online.site.tier);
  });

  it.each([true, false])("preserves the optional studio capability without inventing progression: %s", async supported => {
    const online = createKqOnlinePreview(now);
    if (supported) online.studio = { version: 1, levels: { photography: 2, branding: 1, editorial: 1 }, style: "signature" };
    else delete online.studio;
    mocks.rpc.mockResolvedValue({ data: { ...current(), online }, error: null });
    const snapshot = await getKqCommerceSnapshot(user, true);
    expect(snapshot.online?.studio).toEqual(online.studio);
    expect(Object.hasOwn(snapshot.online!, "studio")).toBe(supported);
  });
});

describe("persistent online commerce commands", () => {
  const requestKey = "00000000-0000-4000-8000-000000000004";
  const listingId = "00000000-0000-4000-8000-000000000005";
  const listing = { stockId, formatGrams: 5, packagingCode: "kraft-5", packets: 3, packetPriceCents: 1273 };
  const run = (command: string, payload: unknown) => handleKqCommerceAction(user, { action: "online", command, payload, requestKey });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: { action: "online", cashAfterCents: 12000 }, error: null });
  });

  it("passes exact packet cents to the dedicated RPC without trusting calculated fields", async () => {
    await run("create-listing", { ...listing, userId: "other-player", unitCents: 1, projectedOrders: 99999, reputationGain: 1000 });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_command", {
      p_user_id: user, p_action: "create-listing", p_payload: listing, p_request_key: requestKey,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["buy-merch-module", { code: "textile" }],
    ["buy-merch-stock", { code: "tshirt", quantity: 12 }],
    ["update-merch", { code: "tshirt", priceCents: 2999, active: true }],
  ])("passes only the explicit merchandise choices for %s", async (command, payload) => {
    await run(command, { ...payload, userId: "someone-else", costCents: 0, sold: 999, followers: 100000, progress: 1, unitsPerDay: 200 });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_command", {
      p_user_id: user, p_action: command, p_payload: payload, p_request_key: requestKey,
    });
  });

  it.each([
    ["buy-studio-level", { track: "photography", level: 2 }],
    ["buy-studio-level", { track: "branding", level: 3 }],
    ["buy-studio-level", { track: "editorial", level: 1 }],
    ["choose-studio-style", { style: "clear" }],
    ["choose-studio-style", { style: "craft" }],
    ["choose-studio-style", { style: "signature" }],
  ])("passes only the explicit studio choices for %s", async (command, payload) => {
    await run(command, { ...payload, userId: "someone-else", costCents: 0, orders: 999, confidence: 100, levels: { photography: 3 }, multiplier: 999 });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_command", {
      p_user_id: user, p_action: command, p_payload: payload, p_request_key: requestKey,
    });
  });

  it.each([0, -1, 1.1, 4, Infinity, NaN, "1", null, undefined])("rejects invalid studio level %s", async level => {
    await expect(run("buy-studio-level", { track: "photography", level })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects unknown studio tracks and artistic directions before the RPC", async () => {
    for (const track of ["free", "__proto__", null, 1]) await expect(run("buy-studio-level", { track, level: 1 })).rejects.toThrow();
    for (const style of ["free", "__proto__", null, 1]) await expect(run("choose-studio-style", { style })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["online_studio_unknown", "direction artistique"],
    ["online_studio_sequence", "niveau précédent"],
    ["online_studio_progression_required", "ateliers requis"],
    ["online_studio_style_required", "atelier éditorial"],
  ])("explains the authoritative studio rejection %s", async (code, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(run("buy-studio-level", { track: "photography", level: 1 })).rejects.toThrow(message);
  });

  it.each([0, -1, 1.1, 501, Infinity, NaN, "10", null])("rejects invalid merchandise quantity %s", async quantity => {
    await expect(run("buy-merch-stock", { code: "stickers", quantity })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.1, 100001, Infinity, NaN, "10", null])("rejects invalid merchandise price %s", async priceCents => {
    await expect(run("update-merch", { code: "stickers", priceCents, active: true })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects unknown merchandise choices and non-boolean publication flags", async () => {
    await expect(run("buy-merch-module", { code: "free" })).rejects.toThrow();
    await expect(run("buy-merch-stock", { code: "free", quantity: 1 })).rejects.toThrow();
    for (const active of ["true", 1, null, undefined]) {
      await expect(run("update-merch", { code: "mug", priceCents: 1600, active })).rejects.toThrow();
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["online_merch_module_required", "Installe l’atelier"],
    ["online_merch_slots", "emplacements"],
    ["online_merch_stock_limit", "500"],
  ])("explains the authoritative merchandise rejection %s", async (code, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(run("buy-merch-stock", { code: "stickers", quantity: 10 })).rejects.toThrow(message);
  });

  it.each([0, -1, 1.001, 1_000_001, Infinity, NaN, "1273", Number.MAX_SAFE_INTEGER])("rejects invalid packet price %s before reaching SQL", async value => {
    await expect(run("create-listing", { ...listing, packetPriceCents: value })).rejects.toThrow();
    await expect(run("update-listing", { listingId, packetPriceCents: value })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 100_001, "3", null])("rejects invalid packaging and listing quantities %s", async value => {
    await expect(run("buy-packaging", { code: "kraft-5", quantity: value })).rejects.toThrow();
    await expect(run("create-listing", { ...listing, packets: value })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires an existing packaging reference matching the packet format", async () => {
    for (const payload of [{ ...listing, formatGrams: "5" }, { ...listing, formatGrams: 7 },
      { ...listing, packagingCode: "kraft-10" }, { ...listing, packagingCode: "free-pack" }]) {
      await expect(run("create-listing", payload)).rejects.toThrow();
    }
    await expect(run("buy-packaging", { code: "free-pack", quantity: 10 })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("validates identities, payload objects and unknown commands before calling SQL", async () => {
    for (const command of ["update-listing", "pause-listing", "resume-listing", "close-listing", "discard-listing"]) {
      await expect(run(command, { listingId: "not-a-uuid", packetPriceCents: 100 })).rejects.toThrow();
    }
    for (const payload of [null, [], "bad-payload"]) await expect(run("buy-packaging", payload)).rejects.toThrow();
    await expect(run("advance-online-time", { hours: 24 })).rejects.toThrow();
    await expect(run("set-reputation", { reputation: 1000 })).rejects.toThrow();
    await expect(handleKqCommerceAction(user, { action: "online", command: "buy-packaging", payload: { code: "kraft-5", quantity: 1 }, requestKey: "invalid" })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts only catalog upgrades and requires a listing and budget for prepared campaigns", async () => {
    await expect(run("upgrade-site", { tier: "free-unlimited" })).rejects.toThrow();
    await expect(run("buy-upgrade", { code: "instant-clients" })).rejects.toThrow();
    await expect(run("start-marketing", { code: "harvest", angle: "craft" })).rejects.toThrow();
    await expect(run("start-marketing", { code: "introduction", angle: ["craft"] })).rejects.toThrow();
    await expect(run("start-marketing", { code: "fake-reviews", angle: "craft" })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await expect(run("start-marketing", { version: 2, code: "harvest", angle: "craft", budgetCode: "regional" })).rejects.toThrow();
    await expect(run("start-marketing", { version: 2, code: "harvest", angle: "craft", listingId, budgetCode: "free" })).rejects.toThrow();
    await run("start-marketing", { version: 2, code: "harvest", angle: "craft", listingId, budgetCode: "regional", stockId, followersReward: 1_000_000, costCents: 0 });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_online_command", expect.objectContaining({ p_action: "start-marketing", p_payload: { version: 2, code: "harvest", angle: "craft", listingId, budgetCode: "regional" } }));
  });

  it.each(["studio", "signature", "flagship"])("passes only the %s identity to SQL and discards forged progress and tariffs", async tier => {
    await run("upgrade-site", { tier, costCents: 0, monthlyCents: 0, conversion: 999, level: 6,
      orders: 999999, confidence: 100, followers: 999999, photography: true, branding: true, userId: "another-player" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_command", {
      p_user_id: user, p_action: "upgrade-site", p_payload: { tier }, p_request_key: requestKey,
    });
  });

  it.each([
    ["buy-packaging", { code: "glass-10", quantity: 100_000 }],
    ["update-listing", { listingId, packetPriceCents: 1_000_000 }],
    ["pause-listing", { listingId }], ["resume-listing", { listingId }], ["close-listing", { listingId }], ["discard-listing", { listingId }],
    ["upgrade-site", { tier: "basic" }], ["upgrade-site", { tier: "pro" }],
    ["buy-upgrade", { code: "branding" }], ["buy-upgrade", { code: "photography" }],
    ["start-marketing", { version: 2, code: "introduction", angle: "value", listingId, budgetCode: "local" }],
  ])("dispatches supported command %s with a stable idempotency key", async (command, payload) => {
    await run(command, payload);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_command", { p_user_id: user, p_action: command, p_payload: payload, p_request_key: requestKey });
  });

  it("refuses the former immediate online quote after the migration", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...current(), online: { version: 1 } }, error: null });
    await expect(handleKqCommerceAction(user, { action: "quote", stockId, channel: "online", policy: "advised" })).rejects.toThrow("annonces");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("normalizes an optional site name and rejects malformed names before the RPC", async () => {
    for (const name of ["ab", "<b>shop</b>", 3, "a".repeat(41)]) await expect(run("upgrade-site", { tier: "basic", name })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await run("upgrade-site", { tier: "basic", name: "  Chez   Sylvain  " });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_online_command", expect.objectContaining({ p_payload: { tier: "basic", name: "Chez Sylvain" } }));
  });

  it("discards only the identified listing and ignores requested refunds and reputation changes", async () => {
    await run("discard-listing", { listingId, refundCents: 99999, restoreStock: true, reputationGain: 1000 });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_command", {
      p_user_id: user, p_action: "discard-listing", p_payload: { listingId }, p_request_key: requestKey,
    });
  });

  it.each([
    ["commerce_shop_required", "gratuitement"], ["commerce_shop_inactive", "tarif de ta formule"],
  ])("describes the current site model for %s", async (message, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(run("resume-listing", { listingId })).rejects.toThrow(expected);
  });

  it("converts authoritative reservation and replay failures into actionable messages", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "online_stock_reserved" } });
    await expect(run("create-listing", listing)).rejects.toThrow("conditionnée");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "online_request_mismatch" } });
    await expect(run("create-listing", listing)).rejects.toThrow("autre opération");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "online_legacy_sale" } });
    await expect(handleKqCommerceAction(user, { action: "sell", quoteId: listingId, expectedPayoutCents: 100, requestKey })).rejects.toThrow("annonces");
  });
});
