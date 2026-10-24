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
let sectionsFailures = 0;
let missingUpdatedAt = false;

beforeEach(() => {
  vi.useFakeTimers();
  reads.length = 0;
  sectionsFailures = 0;
  missingUpdatedAt = false;
  fetchMock.mockReset().mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1)!;
    const columns = (url.searchParams.get("select") ?? "").split(",");
    reads.push({ table, columns, signal: init?.signal });
    expect(init?.method).toBe("GET");
    if (table === "page_sections" && sectionsFailures-- > 0) {
      throw new TypeError("fetch failed", { cause: new Error("socket closed") });
    }
    if (table === "products" && missingUpdatedAt && columns.includes("updated_at")) {
      return Response.json({ code: "42703", message: "column products.updated_at does not exist" }, { status: 400 });
    }
    const data = table === "site_content"
      ? [{ id: 1, updated_at: "2026-10-24T10:00:00Z" }]
      : table === "page_sections"
        ? [{ id: 1, home: [{ id: "custom-section", type: "hero", visible: true }] }]
        : [];
    return Response.json(data);
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("public store Supabase transport", () => {
  it("recovers a page_sections fetch failure without re-reading the other tables", async () => {
    sectionsFailures = 1;
    const pending = readPublicStoreFromSupabase();
    await vi.advanceTimersByTimeAsync(250);

    const store = await pending;
    expect(store.updatedAt).toBe("2026-10-24T10:00:00.000Z");
    expect(store.sections.home).toEqual([{ id: "custom-section", type: "hero", visible: true }]);
    expect(reads.filter((read) => read.table === "page_sections")).toHaveLength(2);
    expect(reads.filter((read) => read.table !== "page_sections").map((read) => read.table).sort())
      .toEqual(["blog_posts", "pack_components", "producers", "products", "site_content"]);
    expect(reads.every((read) => read.signal instanceof AbortSignal)).toBe(true);
    expect(new Set(reads.map((read) => read.signal)).size).toBe(7);
  });

  it("rejects a persistent sections outage instead of returning default store data", async () => {
    sectionsFailures = Infinity;
    const pending = readPublicStoreFromSupabase().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(750);

    expect(await pending).toMatchObject({
      message: "[supabase:read public page_sections] TypeError: fetch failed",
      cause: { message: "TypeError: fetch failed", details: expect.stringContaining("socket closed") },
    });
    expect(reads.filter((read) => read.table === "page_sections")).toHaveLength(3);
    expect(reads).toHaveLength(8);
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
