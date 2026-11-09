import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261109000100_contest_flower_rankings.sql", "utf8");
type Category = "outdoor" | "greenhouse" | "indoor";
type Ranking = {
  entry_id: string; season_id: string; category: Category; track: "regular" | "concours";
  approved_review_count: number; average_score: string; season_baseline_score: string;
  smoothed_score: string; is_rank_eligible: boolean; season_rank_overall: number; season_category_rank: number;
};
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE outsider;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, outsider;
    CREATE TYPE public.contest_entry_category AS ENUM ('outdoor','greenhouse','indoor');
    CREATE TABLE public.contest_seasons(id TEXT PRIMARY KEY, is_active BOOLEAN, is_archived BOOLEAN);
    CREATE TABLE public.products(id TEXT PRIMARY KEY, category TEXT, culture_type TEXT);
    CREATE TABLE public.contest_entries(
      id TEXT PRIMARY KEY, slug TEXT UNIQUE, product_id TEXT REFERENCES public.products(id),
      season_id TEXT REFERENCES public.contest_seasons(id), category public.contest_entry_category,
      is_published BOOLEAN DEFAULT true, position INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT '2026-01-01Z');
    CREATE TABLE public.contest_reviews(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), entry_id TEXT REFERENCES public.contest_entries(id),
      season_id TEXT REFERENCES public.contest_seasons(id), status TEXT, consumption_method TEXT DEFAULT 'vaporizer',
      comment TEXT DEFAULT 'Original review');
    CREATE TABLE public.contest_review_scores(
      review_id UUID REFERENCES public.contest_reviews(id), criterion TEXT,
      score SMALLINT CHECK (score BETWEEN 1 AND 10), PRIMARY KEY(review_id,criterion));
  `);
  await db.exec(readFileSync("supabase/migrations/20260509000200_contest_entry_tracks.sql", "utf8"));
  // Existing service-role grants from the historical Data API grant migration.
  await db.exec(`GRANT SELECT ON public.contest_entries, public.contest_reviews,
    public.contest_review_scores, public.contest_entry_stats TO service_role;`);
  await db.exec(migration);
}, 30_000);

beforeEach(async () => {
  await db.exec(`TRUNCATE public.contest_review_scores, public.contest_reviews, public.contest_entries,
    public.products, public.contest_seasons;
    INSERT INTO public.contest_seasons VALUES ('current',true,false),('old',false,false),('archived',true,true);`);
});
afterAll(async () => { await db?.close(); });

async function entry(id: string, options: {
  season?: string; category?: Category; track?: "regular" | "concours"; published?: boolean;
  culture?: string | null; productCategory?: string;
} = {}) {
  const category = options.category ?? "outdoor";
  await db.query("INSERT INTO public.products VALUES($1,$2,$3)",
    [id, options.productCategory ?? "fleurs", options.culture === undefined ? category : options.culture]);
  await db.query(`INSERT INTO public.contest_entries(id,slug,product_id,season_id,category,track,is_published)
    VALUES($1,$2,$1,$3,$4,$5,$6)`,
  [id, `slug-${id}`, options.season ?? "current", category, options.track ?? "regular", options.published ?? true]);
}

async function review(entryId: string, score: number | null, status = "approved") {
  const result = await db.query<{ id: string }>(`INSERT INTO public.contest_reviews(entry_id,season_id,status)
    SELECT id,season_id,$2 FROM public.contest_entries WHERE id=$1 RETURNING id`, [entryId, status]);
  if (score !== null) {
    await db.query(`INSERT INTO public.contest_review_scores(review_id,criterion,score)
      VALUES($1,'appearance',$2),($1,'flavor',$2)`, [result.rows[0].id, score]);
  }
}

async function rankings() {
  return (await db.query<Ranking>(`SELECT * FROM public.contest_rankings_current
    ORDER BY season_id,season_rank_overall`)).rows;
}

describe("published flower rankings in PostgreSQL", () => {
  it("ranks the first approved scored review and excludes pending, rejected and unscored entries", async () => {
    await entry("rated");
    await review("rated", 8);
    await review("rated", 1, "pending");
    await review("rated", 2, "rejected");
    await review("rated", null);
    for (const id of ["unrated", "pending", "rejected", "no-scores"]) await entry(id);
    await review("pending", 10, "pending");
    await review("rejected", 10, "rejected");
    await review("no-scores", null);

    expect(await rankings()).toMatchObject([{
      entry_id: "rated", approved_review_count: 1, average_score: "8.00", smoothed_score: "8.00",
      is_rank_eligible: true, season_rank_overall: 1, season_category_rank: 1,
    }]);
    expect((await db.query("SELECT id FROM public.contest_entries")).rows).toHaveLength(5);
  });

  it("ranks all price tracks together overall and within each cultivation category", async () => {
    await entry("outdoor-regular"); await review("outdoor-regular", 9);
    await entry("outdoor-concours", { track: "concours" }); await review("outdoor-concours", 10);
    await entry("greenhouse", { category: "greenhouse" }); await review("greenhouse", 6);
    await entry("indoor", { category: "indoor", track: "concours" }); await review("indoor", 8);

    expect(await rankings()).toMatchObject([
      { entry_id: "outdoor-concours", season_rank_overall: 1, season_category_rank: 1, season_baseline_score: "9.00", smoothed_score: "9.17" },
      { entry_id: "indoor", season_rank_overall: 2, season_category_rank: 1, season_baseline_score: "9.00", smoothed_score: "8.83" },
      { entry_id: "outdoor-regular", season_rank_overall: 3, season_category_rank: 2, season_baseline_score: "7.50", smoothed_score: "7.75" },
      { entry_id: "greenhouse", season_rank_overall: 4, season_category_rank: 1, season_baseline_score: "7.50", smoothed_score: "7.25" },
    ]);
  });

  it("removes unpublished flowers from ranks and the smoothing baseline without deleting their reviews", async () => {
    await entry("published"); await review("published", 2);
    await entry("hidden", { published: false }); await review("hidden", 10);
    const visibleOnly = await rankings();
    expect(visibleOnly).toMatchObject([
      { entry_id: "published", season_rank_overall: 1, season_baseline_score: "2.00", smoothed_score: "2.00" },
    ]);
    await db.exec("UPDATE public.contest_entries SET is_published=true WHERE id='hidden'");
    expect(await rankings()).toMatchObject([
      { entry_id: "hidden", season_rank_overall: 1, season_baseline_score: "6.00" },
      { entry_id: "published", season_rank_overall: 2, season_baseline_score: "6.00" },
    ]);
    await db.exec("UPDATE public.contest_entries SET is_published=false WHERE id='hidden'");
    expect(await rankings()).toEqual(visibleOnly);
    expect((await db.query("SELECT id FROM public.contest_reviews")).rows).toHaveLength(2);
  });

  it("keeps seasons independent and preserves smoothing weighted by distinct reviews", async () => {
    await entry("current-high");
    for (let index = 0; index < 5; index++) await review("current-high", 9);
    await entry("current-low"); await review("current-low", 3);
    await entry("old-high", { season: "old" }); await review("old-high", 10);
    await entry("old-low", { season: "old" }); await review("old-low", 6);

    expect(await rankings()).toMatchObject([
      { entry_id: "current-high", approved_review_count: 5, season_rank_overall: 1, season_baseline_score: "6.00", smoothed_score: "7.50" },
      { entry_id: "current-low", approved_review_count: 1, season_rank_overall: 2, season_baseline_score: "6.00", smoothed_score: "5.50" },
      { entry_id: "old-high", season_rank_overall: 1, season_baseline_score: "8.00", smoothed_score: "8.33" },
      { entry_id: "old-low", season_rank_overall: 2, season_baseline_score: "8.00", smoothed_score: "7.67" },
    ]);
  });

  it("retains every rated flower beyond fifty and orders equal scores deterministically", async () => {
    await db.exec(`
      INSERT INTO public.products SELECT 'flower-'||lpad(n::text,3,'0'),'fleurs','outdoor' FROM generate_series(1,61) n;
      INSERT INTO public.contest_entries(id,slug,product_id,season_id,category)
        SELECT id,'slug-'||id,id,'current','outdoor' FROM public.products;
      INSERT INTO public.contest_reviews(entry_id,season_id,status)
        SELECT id,season_id,'approved' FROM public.contest_entries;
      INSERT INTO public.contest_review_scores SELECT id,'flavor',6 FROM public.contest_reviews;
    `);
    const rows = await rankings();
    expect(rows).toHaveLength(61);
    expect(rows.map(row => row.season_rank_overall)).toEqual(Array.from({ length: 61 }, (_, index) => index + 1));
    expect(rows[60]).toMatchObject({ entry_id: "flower-061", season_category_rank: 61, approved_review_count: 1, is_rank_eligible: true });
  });

  it("reconciles only active published flower categories while preserving identities and reviews", async () => {
    for (const culture of ["outdoor", "greenhouse", "indoor"] as const) {
      await entry(culture, { culture, category: culture === "outdoor" ? "indoor" : "outdoor" });
    }
    await entry("old", { season: "old", culture: "indoor" });
    await entry("archived", { season: "archived", culture: "indoor" });
    await entry("draft", { published: false, culture: "indoor" });
    await entry("invalid", { culture: "unknown" });
    await entry("missing", { culture: null });
    await entry("non-flower", { productCategory: "accessoires", culture: "indoor" });
    for (const row of (await db.query<{ id: string }>("SELECT id FROM public.contest_entries")).rows) {
      await review(row.id, 7);
    }
    const entriesBefore = (await db.query<{ id: string; category: Category; unchanged: unknown }>(`
      SELECT id,category,to_jsonb(e)-'category'-'updated_at' AS unchanged FROM public.contest_entries e ORDER BY id`)).rows;
    const reviewsBefore = (await db.query("SELECT * FROM public.contest_reviews ORDER BY id")).rows;
    const scoresBefore = (await db.query("SELECT * FROM public.contest_review_scores ORDER BY review_id,criterion")).rows;

    await db.exec(migration);

    const entriesAfter = (await db.query<{ id: string; category: Category; unchanged: unknown }>(`
      SELECT id,category,to_jsonb(e)-'category'-'updated_at' AS unchanged FROM public.contest_entries e ORDER BY id`)).rows;
    expect(entriesAfter).toEqual(entriesBefore.map(row => ({
      ...row, category: ["outdoor", "greenhouse", "indoor"].includes(row.id) ? row.id : row.category,
    })));
    expect((await db.query("SELECT * FROM public.contest_reviews ORDER BY id")).rows).toEqual(reviewsBefore);
    expect((await db.query("SELECT * FROM public.contest_review_scores ORDER BY review_id,criterion")).rows).toEqual(scoresBefore);
  });

  it("allows real service-role SELECT only and enforces invoker permissions on underlying tables", async () => {
    await entry("readable"); await review("readable", 8);
    const rights = (await db.query(`SELECT
      has_table_privilege('service_role','public.contest_rankings_current','SELECT') AS service_read,
      has_table_privilege('service_role','public.contest_rankings_current','INSERT,UPDATE,DELETE') AS service_write,
      has_table_privilege('anon','public.contest_rankings_current','SELECT') AS anonymous,
      has_table_privilege('authenticated','public.contest_rankings_current','SELECT') AS authenticated,
      has_table_privilege('outsider','public.contest_rankings_current','SELECT') AS inherited_public`)).rows[0];
    expect(rights).toEqual({ service_read: true, service_write: false, anonymous: false, authenticated: false, inherited_public: false });
    expect((await db.query<{ reloptions: string[] }>(`SELECT reloptions FROM pg_class
      WHERE oid='public.contest_rankings_current'::regclass`)).rows[0].reloptions).toContain("security_invoker=true");
    try {
      await db.exec("SET ROLE service_role");
      expect(await rankings()).toMatchObject([{ entry_id: "readable", season_rank_overall: 1 }]);
    } finally {
      await db.exec("RESET ROLE");
    }
    for (const role of ["anon", "authenticated", "outsider"]) {
      try {
        await db.exec(`SET ROLE ${role}`);
        await expect(rankings()).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("RESET ROLE");
      }
    }
    await db.exec("REVOKE SELECT ON public.contest_entries FROM service_role");
    try {
      await db.exec("SET ROLE service_role");
      await expect(rankings()).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE; GRANT SELECT ON public.contest_entries TO service_role");
    }
  });
});
