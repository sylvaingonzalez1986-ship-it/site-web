import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KqTreasurySnapshot } from "../kanab-quest-treasury";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqTreasurySnapshot, parseKqTreasuryQuery } from "./kanab-quest-treasury-backend";
const owner = "11111111-1111-4111-8111-111111111111";
const query = { period: "current" as const, offset: 0, limit: 25 };
const date = "2026-09-21T12:00:00Z";
function snapshot(): KqTreasurySnapshot {
  return { version: 1, serverNow: date, startedAt: date, businessStartedAt: date,
    period: { key: "current", from: date, to: date },
    openingBalances: { cash: 35000, opening_equity: -35000 }, closingBalances: { cash: 35000, opening_equity: -35000 },
    series: [], journal: { items: [], total: 0, offset: 0, limit: 25 },
    checks: { walletCashCents: 35000, vatReserveCents: 0, savingsCents: 0, labDebtCents: 0, energyDebtCents: 0, vatDebtCents: 0 } };
}
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: snapshot(), error: null }); });

describe("treasury query boundary", () => {
  it("defaults to the current game month and a bounded journal page", () => {
    expect(parseKqTreasuryQuery(new URLSearchParams())).toEqual(query);
    expect(parseKqTreasuryQuery(new URLSearchParams("period=previous&offset=25&limit=50"))).toEqual({ period: "previous", offset: 25, limit: 50 });
  });
  it.each(["period=constructor", "period=year", "offset=-1", "offset=1.5", "offset=1e5", "offset=10000000", "limit=0", "limit=101", "limit=NaN"])("rejects invalid input %s", value => {
    expect(() => parseKqTreasuryQuery(new URLSearchParams(value))).toThrow("invalide");
  });
  it("ignores supplied ownership and dates", () => {
    expect(parseKqTreasuryQuery(new URLSearchParams("userId=victim&from=2000-01-01&to=2100-01-01"))).toEqual(query);
  });
});

describe("treasury snapshot backend", () => {
  it("requests the authoritative owner's complete aggregate and bounded journal", async () => {
    expect(await getKqTreasurySnapshot(owner, query)).toEqual(snapshot());
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_treasury_snapshot", { p_user_id: owner, p_period: "current", p_offset: 0, p_limit: 25 });
  });
  it("does not query invalid ownership or pagination", async () => {
    await expect(getKqTreasurySnapshot("invalid", query)).rejects.toThrow("Compte");
    await expect(getKqTreasurySnapshot(owner, { ...query, offset: -1 })).rejects.toThrow("page");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, { version: 0 }, { ...snapshot(), closingBalances: { cash: "35000" } }, { ...snapshot(), period: { key: "all", from: date, to: date } }, { ...snapshot(), journal: { items: [], total: 0, offset: 25, limit: 25 } }])("fails closed on old, malformed or mismatched schemas", async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(getKqTreasurySnapshot(owner, query)).rejects.toThrow("[supabase:treasury]");
  });
  it("reports unavailable SQL rather than returning an empty financial report", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private database detail" } });
    await expect(getKqTreasurySnapshot(owner, query)).rejects.toThrow("[supabase:treasury]");
  });
});
