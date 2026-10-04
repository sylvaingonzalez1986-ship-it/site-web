import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContestEntryInput, ContestSeason } from "@/types/contest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import { createContestEntry, syncContestEntriesForShopFlowers, updateContestEntry } from "@/lib/supabase/contest-backend";

type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; error: { message: string } | null };
const season: ContestSeason = { id: "season", code: "2026", label: "Saison", year: 2026, isActive: true, isArchived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const product = (id: string, price = 2.5, extra: Row = {}): Row => ({ id, name: `Fleur ${id}`, category: "fleurs", price, weight_grams: 1, is_pack: false, variant_options: null, image: "/flower.webp", culture_type: "outdoor", ...extra });
const entry = (id: string, productId: string, track = "regular", published = true, extra: Row = {}): Row => ({ id, product_id: productId, season_id: season.id, track, is_published: published, title: `Fleur ${productId}`, slug: id, category: "outdoor", image_url: "/flower.webp", gallery_urls: [], technical_sheet: {}, ...extra });

function fixture(products: Row[], entries: Row[], failure?: { table: string; offset: number }) {
  const rows: Record<string, Row[]> = { products, contest_entries: entries, contest_seasons: [{ id: season.id, code: season.code, is_active: true }, { id: "archived", code: "2025", is_active: false, is_archived: true }] };
  const writes: Array<{ table: string; action: string; value: Row | Row[]; ids: unknown[] }> = [];
  const reads: Array<{ table: string; offset: number }> = [];
  class Query implements PromiseLike<Result> {
    filters: Array<(row: Row) => boolean> = [];
    action = "select";
    value: Row | Row[] = {};
    offset = 0;
    end = Number.POSITIVE_INFINITY;
    paged = false;
    ignoreDuplicates = false;
    constructor(readonly table: string) {}
    select() { return this; }
    eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
    neq(key: string, value: unknown) { this.filters.push(row => row[key] !== value); return this; }
    in(key: string, values: unknown[]) { this.filters.push(row => values.includes(row[key])); return this; }
    order() { return this; }
    range(start: number, end: number) { this.offset = start; this.end = end; this.paged = true; return this; }
    limit(limit: number) { this.end = limit - 1; return this; }
    update(value: Row) { this.action = "update"; this.value = value; return this; }
    insert(value: Row) { this.action = "insert"; this.value = value; return this; }
    upsert(value: Row[], options: { ignoreDuplicates?: boolean }) { this.action = "upsert"; this.value = value; this.ignoreDuplicates = options.ignoreDuplicates === true; return this; }
    execute(single = false): Result {
      const tableRows = rows[this.table] ?? [];
      let matching = tableRows.filter(row => this.filters.every(filter => filter(row)));
      if (this.action === "select") {
        reads.push({ table: this.table, offset: this.offset });
        if (failure?.table === this.table && failure.offset === this.offset) return { data: null, error: { message: "read failed" } };
        // The API may return fewer rows than requested; the sync must continue.
        matching = matching.slice(this.offset, Math.min(this.end + 1, this.paged ? this.offset + 2 : Number.POSITIVE_INFINITY));
      } else {
        writes.push({ table: this.table, action: this.action, value: structuredClone(this.value), ids: matching.map(row => row.id) });
        if (this.action === "update") {
          for (const row of matching) Object.assign(row, this.value);
        } else {
          const values = Array.isArray(this.value) ? this.value : [this.value];
          for (const value of values) {
            const found = tableRows.find(row => row.id === value.id);
            if (!found) tableRows.push({ ...value });
            else if (!this.ignoreDuplicates) Object.assign(found, value);
          }
          matching = values;
        }
      }
      return { data: single ? matching[0] ?? null : matching, error: null };
    }
    maybeSingle() { return Promise.resolve(this.execute(true)); }
    single() { return Promise.resolve(this.execute(true)); }
    then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
    }
  }
  const from = vi.fn((table: string) => new Query(table));
  mocks.client.mockReturnValue({ from });
  return { rows, writes, reads, from };
}

beforeEach(() => vi.clearAllMocks());

describe("notebook catalogue synchronization", () => {
  it("keeps the migrated 22 identities unchanged without recreating premium Regular entries or Small Bud Mix", async () => {
    const products = Array.from({ length: 12 }, (_, i) => product(`regular-${i}`));
    const entries = products.map(row => entry(String(row.id), String(row.id)));
    for (let i = 0; i < 4; i++) {
      products.push(product(`premium-${i}`, i === 3 ? 4.5 : 4));
      entries.push(entry(`old-regular-${i}`, `premium-${i}`, "regular", false), entry(`concours-${i}`, `premium-${i}`, "concours"));
    }
    products.push(product("white-cbg", 4), product("small-bud", 1));
    entries.push(entry("white-original-id", "white-cbg", "concours"), entry("small-original-id", "small-bud", "regular", false));
    const state = fixture(products, entries);
    const original = structuredClone(entries);
    await syncContestEntriesForShopFlowers(season);
    await syncContestEntriesForShopFlowers(season);
    expect(state.rows.contest_entries).toEqual(original);
    expect(state.writes).toEqual([]);
    expect(state.rows.contest_entries).toHaveLength(22);
    expect(state.rows.contest_entries.filter(row => row.is_published)).toHaveLength(17);
    expect(state.reads.some(read => read.table === "contest_entries" && read.offset === 22)).toBe(true);
  });

  it("creates each missing eligible flower in its own track and skips cheap, unknown and out-of-stock flowers", async () => {
    const state = fixture([product("regular"), product("premium", 4), product("cheap", 1), product("unknown", 4, { variant_options: [{ label: "10 g", price: 20 }] }), product("sold-out", 4, { track_stock: true, stock_quantity: 0 })], []);
    await syncContestEntriesForShopFlowers(season);
    expect(state.rows.contest_entries.map(row => [row.product_id, row.track, row.is_published])).toEqual([["regular", "regular", true], ["premium", "concours", true]]);
    expect(state.writes).toHaveLength(1);
    await syncContestEntriesForShopFlowers(season);
    expect(state.writes).toHaveLength(1);
  });

  it("preserves a unique entry ID and the unpublished state of a manual draft when correcting its track", async () => {
    const state = fixture([product("premium", 4)], [entry("manual-draft", "premium", "regular", false)]);
    await syncContestEntriesForShopFlowers(season);
    expect(state.rows.contest_entries[0]).toMatchObject({ id: "manual-draft", track: "concours", is_published: false });
    expect(state.writes[0].value).not.toHaveProperty("is_published");
  });

  it("reclassifies the single published entry when its correct-track counterpart is only a draft", async () => {
    const state = fixture([product("premium", 4)], [entry("published", "premium"), entry("draft", "premium", "concours", false)]);
    await syncContestEntriesForShopFlowers(season);
    expect(state.rows.contest_entries).toEqual([
      expect.objectContaining({ id: "published", track: "concours", is_published: true }),
      expect.objectContaining({ id: "draft", track: "concours", is_published: false }),
    ]);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].value).not.toHaveProperty("is_published");
  });

  it("hides only an incorrect published duplicate when a correct published counterpart exists", async () => {
    const state = fixture([product("premium", 4)], [entry("old", "premium"), entry("correct", "premium", "concours")]);
    await syncContestEntriesForShopFlowers(season);
    expect(state.rows.contest_entries).toEqual([
      expect.objectContaining({ id: "old", track: "regular", is_published: false }),
      expect.objectContaining({ id: "correct", track: "concours", is_published: true }),
    ]);
  });

  it("leaves multiple ambiguous published rows for review instead of hiding every representation", async () => {
    const state = fixture([product("premium", 4)], [entry("one", "premium"), entry("two", "premium"), entry("draft", "premium", "concours", false)]);
    await syncContestEntriesForShopFlowers(season);
    expect(state.writes).toEqual([]);
  });

  it("unpublishes a flower below 2.50 without deleting its entry or changing its historical track", async () => {
    const state = fixture([product("small", 1)], [entry("small-note", "small", "regular")]);
    await syncContestEntriesForShopFlowers(season);
    expect(state.rows.contest_entries[0]).toMatchObject({ id: "small-note", track: "regular", is_published: false });
    expect(state.writes.map(write => write.action)).toEqual(["update"]);
  });

  it.each([{ ...season, isActive: false }, { ...season, isArchived: true }, null])("does not modify inactive or archived seasons", async (target) => {
    const state = fixture([product("premium", 4)], [entry("old", "premium")]);
    await syncContestEntriesForShopFlowers(target);
    expect(state.from).not.toHaveBeenCalled();
  });

  it("does not write when a later catalogue page cannot be read", async () => {
    const state = fixture([product("a"), product("b"), product("c")], [], { table: "products", offset: 2 });
    await expect(syncContestEntriesForShopFlowers(season)).rejects.toThrow("read failed");
    expect(state.writes).toEqual([]);
  });
});

describe("admin notebook publication validation", () => {
  const input: ContestEntryInput = { title: "Fleur test", productId: "p", seasonId: season.id, category: "outdoor", track: "regular", isPublished: true };

  it("rejects creating a Regular entry for a premium flower", async () => {
    const state = fixture([product("p", 4)], []);
    await expect(createContestEntry(input)).rejects.toThrow("carnet Concours");
    expect(state.writes).toEqual([]);
  });

  it("rejects publishing an ineligible cheap flower", async () => {
    const state = fixture([product("p", 1)], [entry("hidden", "p", "regular", false)]);
    await expect(updateContestEntry("hidden", { isPublished: true })).rejects.toThrow("pas éligible");
    expect(state.writes).toEqual([]);
  });

  it("rejects changing a published premium entry to Regular", async () => {
    const state = fixture([product("p", 4)], [entry("published", "p", "concours")]);
    await expect(updateContestEntry("published", { track: "regular" })).rejects.toThrow("carnet Concours");
    expect(state.writes).toEqual([]);
  });

  it("rejects a second published entry for the same product and season", async () => {
    const state = fixture([product("p")], [entry("published", "p"), entry("hidden", "p", "regular", false)]);
    await expect(updateContestEntry("hidden", { isPublished: true })).rejects.toThrow("déjà une fiche publiée");
    await expect(createContestEntry(input)).rejects.toThrow("déjà une fiche publiée");
    expect(state.writes).toEqual([]);
  });

  it("keeps historical published notes editable when only editorial fields change", async () => {
    const state = fixture([product("p", 1)], [entry("historical", "p", "regular", true, { season_id: "archived" })]);
    const result = await updateContestEntry("historical", { title: "Histoire préservée", productId: "p", seasonId: "archived", track: "regular", isPublished: true });
    expect(result).toMatchObject({ id: "historical", title: "Histoire préservée", isPublished: true, track: "regular" });
    expect(state.rows.contest_entries).toHaveLength(1);
  });

  it.each(["pending", "approved", "rejected"])("keeps a lot's product and season attached to its %s review", async status => {
    const state = fixture([product("p"), product("other")], [entry("reviewed", "p")]);
    state.rows.contest_reviews = [{ id: "review", entry_id: "reviewed", status }];
    await expect(updateContestEntry("reviewed", { productId: "other" })).rejects.toThrow("possède déjà des avis");
    await expect(updateContestEntry("reviewed", { seasonId: "archived" })).rejects.toThrow("possède déjà des avis");
    expect(state.writes).toEqual([]);
    await expect(updateContestEntry("reviewed", { title: "Description améliorée" })).resolves.toMatchObject({ title: "Description améliorée" });
  });

  it("allows publishing a valid entry when its old counterpart is hidden", async () => {
    const state = fixture([product("p", 4)], [entry("old-hidden", "p", "regular", false), entry("new-hidden", "p", "concours", false)]);
    const result = await updateContestEntry("new-hidden", { isPublished: true });
    expect(result).toMatchObject({ id: "new-hidden", track: "concours", isPublished: true });
    expect(state.rows.contest_entries[0]).toMatchObject({ id: "old-hidden", track: "regular", is_published: false });
  });
});
