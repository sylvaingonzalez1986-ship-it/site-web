import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn<typeof fetch>() }));
vi.mock("./admin", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient("https://store.test", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchMock },
  });
  return { createSupabaseServiceClient: () => client };
});
vi.mock("./contest-backend", () => ({ deleteContestEntry: vi.fn() }));

import { readPublicStoreFromSupabase } from "./store-backend";

const reads: { table: string; signal: AbortSignal | null | undefined; columns: string[] }[] = [];
const failures = { page_sections: 0, producers: 0 };
let producerBodyFailure = false;
let missingUpdatedAt = false;

const closedSocket = () => Object.assign(new Error("other side closed"), { name: "SocketError", code: "UND_ERR_SOCKET" });

beforeEach(() => {
  vi.useFakeTimers();
  reads.length = 0;
  failures.page_sections = 0;
  failures.producers = 0;
  producerBodyFailure = false;
  missingUpdatedAt = false;
  vi.spyOn(Math, "random").mockReturnValue(0);
  fetchMock.mockReset().mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    const columns = (url.searchParams.get("select") ?? "").split(",");
    reads.push({ table, columns, signal: init?.signal });
    expect(init?.method).toBe("GET");
    if ((table === "page_sections" || table === "producers") && failures[table]-- > 0) {
      throw new TypeError("fetch failed", { cause: closedSocket() });
    }
    if (table === "producers" && producerBodyFailure) {
      producerBodyFailure = false;
      return new Response(new ReadableStream({
        start(controller) {
          controller.error(new TypeError("terminated", { cause: closedSocket() }));
        },
      }));
    }
    if (table === "products" && missingUpdatedAt && columns.includes("updated_at")) {
      return Response.json({ code: "42703", message: "column products.updated_at does not exist" }, { status: 400 });
    }
    const data = table === "site_content"
      ? [{ id: 1, updated_at: "2026-10-24T10:00:00Z" }]
      : table === "page_sections"
        ? [{ id: 1, home: [{ id: "custom-section", type: "hero", visible: true }] }]
        : table === "producers" ? [{ id: "producer-test", name: "Test producer" }] : [];
    return Response.json(data);
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("public store Supabase transport", () => {
  it("recovers a page_sections fetch failure without re-reading the other tables", async () => {
    failures.page_sections = 1;
    const pending = readPublicStoreFromSupabase();
    await vi.advanceTimersByTimeAsync(500);

    const store = await pending;
    expect(store.updatedAt).toBe("2026-10-24T10:00:00.000Z");
    expect(store.sections.home).toEqual([{ id: "custom-section", type: "hero", visible: true }]);
    expect(reads.filter((read) => read.table === "page_sections")).toHaveLength(2);
    expect(reads.filter((read) => read.table !== "page_sections").map((read) => read.table).sort())
      .toEqual(["blog_posts", "pack_components", "producers", "products", "site_content"]);
    expect(reads.every((read) => read.signal instanceof AbortSignal)).toBe(true);
    expect(new Set(reads.map((read) => read.signal)).size).toBe(7);
  });

  it.each(["page_sections", "producers"] as const)("rejects a persistent %s outage instead of returning default store data", async (table) => {
    failures[table] = Infinity;
    const pending = readPublicStoreFromSupabase().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(3_500);

    expect(await pending).toMatchObject({
      message: `[supabase:read public ${table}] TypeError: fetch failed`,
      cause: { message: "TypeError: fetch failed", details: expect.stringContaining("other side closed (UND_ERR_SOCKET)") },
      attempts: 4,
      elapsedMs: 3_500,
    });
    expect(reads.filter((read) => read.table === table)).toHaveLength(4);
    expect(reads).toHaveLength(9);
  });

  it("recovers three successive producers socket closures without repeating successful reads", async () => {
    failures.producers = 3;
    const pending = readPublicStoreFromSupabase();

    await vi.advanceTimersByTimeAsync(3_500);

    expect((await pending).producers).toEqual([expect.objectContaining({ id: "producer-test", name: "Test producer" })]);
    expect(reads.filter((read) => read.table === "producers")).toHaveLength(4);
    expect(reads.filter((read) => read.table !== "producers")).toHaveLength(5);
    expect(new Set(reads.map((read) => read.signal)).size).toBe(9);
  });

  it("recovers when the producers connection closes after HTTP headers arrive", async () => {
    producerBodyFailure = true;
    const pending = readPublicStoreFromSupabase();

    await vi.advanceTimersByTimeAsync(500);

    expect((await pending).producers).toEqual([expect.objectContaining({ id: "producer-test" })]);
    expect(reads.filter((read) => read.table === "producers")).toHaveLength(2);
    expect(reads.filter((read) => read.table !== "producers")).toHaveLength(5);
  });

  it("preserves the product schema fallback within the same read deadline", async () => {
    missingUpdatedAt = true;
    await readPublicStoreFromSupabase();

    const products = reads.filter((read) => read.table === "products");
    expect(products).toHaveLength(2);
    expect(products[0].columns).toContain("updated_at");
    expect(products[1].columns).not.toContain("updated_at");
    expect(products[1].signal).toBe(products[0].signal);
    expect(reads).toHaveLength(7);
  });
});
