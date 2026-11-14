import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn<typeof fetch>() }));
vi.mock("./admin", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient("https://lottery.test", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchMock },
  });
  return { createSupabaseServiceClient: () => client };
});

import { getLotteryTicketsForCustomerFromSupabase } from "./lottery-backend";

const userId = "11111111-1111-4111-8111-111111111111";
const tables = ["lottery_tickets", "lottery_card_instances", "lottery_card_definitions"] as const;
type Table = typeof tables[number];
const reads: Array<{ table: string; url: URL; signal?: AbortSignal | null }> = [];
let failedTable: Table | null;
let failures: number;
let denied: boolean;
let empty: boolean;
let failedOffset: number | null;
let data: typeof fixtures;

const fixtures: Record<Table, Record<string, unknown>[]> = {
  lottery_tickets: [
    { id: "opened-ticket", user_id: userId, ticket_number: "PACK-1", status: "scratched", card_definition_id: "card-1" },
    { id: "sealed-ticket", user_id: userId, ticket_number: "PACK-2", status: "available" },
  ],
  lottery_card_instances: [
    { ticket_id: "opened-ticket", pack_slot: 2, card_definition_id: "card-2" },
    { ticket_id: "opened-ticket", pack_slot: 1, card_definition_id: "card-1" },
  ],
  lottery_card_definitions: [
    { id: "card-1", code: "HH2026-020", name: "Strawberry CBD", rarity: "common", card_number: 20 },
    { id: "card-2", code: "HH2026-011", name: "Cherry Wine", rarity: "silver", card_number: 11 },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  reads.length = 0;
  failedTable = null; failures = 0; denied = false; empty = false; failedOffset = null;
  data = fixtures;
  fetchMock.mockReset().mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1) as Table;
    reads.push({ table, url, signal: init?.signal });
    expect(init?.method).toBe("GET");
    expect(tables).toContain(table);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    if (table === failedTable && (failedOffset === null || offset === failedOffset)) {
      if (denied) return Response.json({ message: "permission denied", code: "42501" }, { status: 403 });
      if (failures-- > 0) throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
      });
    }
    let rows = empty ? [] : data[table];
    const filterColumn = table === "lottery_card_instances" ? "ticket_id" : table === "lottery_card_definitions" ? "id" : null;
    if (filterColumn) {
      const ids = url.searchParams.get(filterColumn)?.slice(4, -1).split(",") ?? [];
      rows = rows.filter(row => ids.includes(String(row[filterColumn])));
    }
    const limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 1000));
    return Response.json(rows.slice(offset, offset + limit));
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("lottery ticket read recovery", () => {
  it.each(tables)("recovers a %s fetch failure without replaying successful reads or changing the pack", async (table) => {
    failedTable = table; failures = 1;
    const pending = getLotteryTicketsForCustomerFromSupabase(userId);
    await vi.advanceTimersByTimeAsync(500);
    const tickets = await pending;

    expect(tickets.map(ticket => [ticket.id, ticket.status])).toEqual([
      ["opened-ticket", "scratched"], ["sealed-ticket", "available"],
    ]);
    expect(tickets[0].cards?.map(card => [card.id, card.ownedCount])).toEqual([["card-1", 1], ["card-2", 1]]);
    expect(tickets[1].cards).toBeUndefined();
    expect(reads.filter(read => read.table === table)).toHaveLength(2);
    expect(reads.filter(read => read.table !== table)).toHaveLength(2);
    expect(reads.every(read => read.signal instanceof AbortSignal)).toBe(true);
    expect(new Set(reads.map(read => read.signal)).size).toBe(4);
    for (const read of reads) {
      if (read.table !== "lottery_card_definitions") expect(read.url.searchParams.get("user_id")).toBe(`eq.${userId}`);
      if (read.table === "lottery_card_instances") expect(read.url.searchParams.get("ticket_id")).toBe("in.(opened-ticket,sealed-ticket)");
      if (read.table === "lottery_card_definitions") expect(read.url.searchParams.get("id")).toBe("in.(card-1,card-2)");
    }
  });

  it("keeps a persistent instance lookup failure instead of returning a partial or empty pack", async () => {
    failedTable = "lottery_card_instances"; failures = Infinity;
    const pending = getLotteryTicketsForCustomerFromSupabase(userId).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(3_500);
    expect(await pending).toMatchObject({
      message: "[supabase:list lottery_card_instances for tickets] TypeError: fetch failed",
      attempts: 4, elapsedMs: 3_500,
      cause: { details: expect.stringContaining("UND_ERR_SOCKET") },
    });
    expect(reads.map(read => read.table)).toEqual(["lottery_tickets", ...Array(4).fill("lottery_card_instances")]);
  });

  it("does not retry a database permission refusal", async () => {
    failedTable = "lottery_card_instances"; denied = true;
    await expect(getLotteryTicketsForCustomerFromSupabase(userId)).rejects.toMatchObject({
      message: "[supabase:list lottery_card_instances for tickets] permission denied", attempts: 1,
    });
    expect(reads.map(read => read.table)).toEqual(["lottery_tickets", "lottery_card_instances"]);
  });

  it("skips card lookups for a confirmed empty ticket list", async () => {
    empty = true;
    expect(await getLotteryTicketsForCustomerFromSupabase(userId)).toEqual([]);
    expect(reads.map(read => read.table)).toEqual(["lottery_tickets"]);
  });

  it("does not read tickets with an invalid customer identity", async () => {
    expect(await getLotteryTicketsForCustomerFromSupabase("invalid")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an old sealed pack beyond 1000 tickets and loads every card through bounded queries", async () => {
    const ticketId = (index: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`;
    data = {
      lottery_tickets: Array.from({ length: 1003 }, (_, index) => ({
        id: ticketId(1002 - index), user_id: userId, ticket_number: `PACK-${1002 - index}`,
        status: index === 1002 ? "available" : "scratched",
      })),
      lottery_card_instances: Array.from({ length: 1002 * 6 }, (_, index) => ({
        ticket_id: ticketId(1002 - Math.floor(index / 6)), pack_slot: index % 6 + 1,
        card_definition_id: `card-${index % 110}`,
      })),
      lottery_card_definitions: Array.from({ length: 110 }, (_, index) => ({
        id: `card-${index}`, code: `CARD-${index}`, name: `Card ${index}`, rarity: "common", card_number: index + 1,
      })),
    };
    const tickets = await getLotteryTicketsForCustomerFromSupabase(userId);
    expect(tickets).toHaveLength(1003);
    expect(tickets.at(-1)).toMatchObject({ id: ticketId(0), status: "available" });
    expect(tickets.filter(ticket => ticket.status === "scratched").every(ticket => ticket.cards?.length === 6)).toBe(true);
    expect(tickets.flatMap(ticket => ticket.cards ?? [])).toHaveLength(6012);
    expect(tickets[0].cards?.map(card => card.id)).toEqual(Array.from({ length: 6 }, (_, i) => `card-${i}`));
    expect(tickets[0].cards?.[0].ownedCount).toBe(55);
    expect(reads.filter(read => read.table === "lottery_tickets").map(read => read.url.searchParams.get("offset"))).toEqual(["0", "500", "1000"]);
    expect(reads.filter(read => read.table === "lottery_card_definitions")).toHaveLength(2);
    expect(reads.some(read => read.table === "lottery_card_instances" && read.url.searchParams.get("offset") === "500")).toBe(true);
    for (const read of reads) {
      expect(read.url.toString().length).toBeLessThan(8000);
      if (read.table !== "lottery_card_definitions") expect(read.url.searchParams.get("user_id")).toBe(`eq.${userId}`);
      if (read.table === "lottery_card_instances") expect(read.url.searchParams.get("ticket_id")?.slice(4, -1).split(",").length).toBeLessThanOrEqual(100);
    }
  });

  it("retries a later ticket page without repeating the first page", async () => {
    data = { ...fixtures, lottery_tickets: Array.from({ length: 501 }, (_, i) => ({
      id: `sealed-${i}`, user_id: userId, ticket_number: `PACK-${i}`, status: "available",
    })) };
    failedTable = "lottery_tickets"; failedOffset = 500; failures = 1;
    const pending = getLotteryTicketsForCustomerFromSupabase(userId);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toHaveLength(501);
    expect(reads.filter(read => read.table === "lottery_tickets").map(read => read.url.searchParams.get("offset"))).toEqual(["0", "500", "500"]);
  });

  it("does not publish partial ticket history when a later page is denied", async () => {
    data = { ...fixtures, lottery_tickets: Array.from({ length: 501 }, (_, i) => ({
      id: `sealed-${i}`, user_id: userId, ticket_number: `PACK-${i}`, status: "available",
    })) };
    failedTable = "lottery_tickets"; failedOffset = 500; denied = true;
    await expect(getLotteryTicketsForCustomerFromSupabase(userId)).rejects.toMatchObject({
      message: "[supabase:list lottery_tickets by user] permission denied", attempts: 1,
    });
    expect(reads.map(read => read.table)).toEqual(["lottery_tickets", "lottery_tickets"]);
  });
});
