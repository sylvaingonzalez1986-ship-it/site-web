// Real PostgreSQL execution of review pagination SQL with synthetic rows only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const readPage = async (entries, limit, cursor = null) => (await db.query(`
  SELECT id, entry_id, coalesce(reviewed_at,created_at)::text AS published_at
  FROM public.rpc_contest_public_review_page($1::text[], $2::int, $3::timestamptz, $4::uuid)
`, [entries, limit, cursor?.published_at ?? null, cursor?.id ?? null])).rows;

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TYPE public.contest_review_status AS ENUM ('pending','approved','rejected');
    CREATE TABLE public.contest_entries(id text PRIMARY KEY, is_published boolean NOT NULL);
    CREATE TABLE public.contest_reviews(
      id uuid PRIMARY KEY, entry_id text REFERENCES contest_entries(id),
      status public.contest_review_status NOT NULL,
      reviewed_at timestamptz, created_at timestamptz NOT NULL,
      customer_id uuid, admin_note text, reviewed_by text
    );
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT SELECT ON public.contest_entries, public.contest_reviews TO service_role;
    INSERT INTO contest_entries VALUES ('popular',true), ('other',true), ('private',false), ('micros',true);
    INSERT INTO contest_reviews(id,entry_id,status,created_at,reviewed_at)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'popular', 'approved',
        '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute',
        '2026-01-01T00:00:00Z'::timestamptz + n * interval '1 minute'
      FROM generate_series(1,55) n;
    INSERT INTO contest_reviews(id,entry_id,status,created_at,reviewed_at) VALUES
      ('${uuid(100)}','popular','pending','2026-02-01', '2026-02-01'),
      ('${uuid(101)}','popular','rejected','2026-02-01', '2026-02-01'),
      ('${uuid(102)}','other','approved','2026-01-01',NULL),
      ('${uuid(103)}','private','approved','2026-01-01','2026-01-01'),
      ('${uuid(104)}','micros','approved','2026-01-01','2026-01-01T00:00:00.123456Z'),
      ('${uuid(105)}','micros','approved','2026-01-01','2026-01-01T00:00:00.123457Z'),
      ('${uuid(106)}','micros','approved','2026-01-01','2026-01-01T00:00:00.123457Z');
  `);
  const migration = await readFile(resolve("supabase/migrations/20261004000200_contest_public_review_pages.sql"), "utf8");
  await db.exec(migration);
  await db.exec(migration);
  for (const role of ["anon", "authenticated", "service_role"]) {
    const result = await db.query("SELECT has_function_privilege($1,'public.rpc_contest_public_review_page(text[],integer,timestamptz,uuid)','EXECUTE') AS allowed", [role]);
    assert.equal(result.rows[0].allowed, role === "service_role");
  }
  await db.exec("SET ROLE anon");
  await assert.rejects(readPage(["popular"], 2), /permission denied/);
  await db.exec("RESET ROLE; SET ROLE service_role");

  const grouped = await readPage(["popular", "other", "private"], 2);
  assert.equal(grouped.filter((review) => review.entry_id === "popular").length, 2);
  assert.equal(grouped.filter((review) => review.entry_id === "other").length, 1);
  assert.equal(grouped.filter((review) => review.entry_id === "private").length, 0);
  assert.deepEqual(grouped.filter((review) => review.entry_id === "popular").map((review) => review.id), [uuid(55), uuid(54)]);
  assert.equal((await readPage(["missing"], 12)).length, 0);

  let page = await readPage(["popular"], 12);
  const ids = page.map((review) => review.id);
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO contest_reviews(id,entry_id,status,created_at,reviewed_at) VALUES ($1,'popular','approved','2026-03-01','2026-03-01')", [uuid(110)]);
  await db.exec("SET ROLE service_role");
  while (page.length) {
    page = await readPage(["popular"], 12, page.at(-1));
    ids.push(...page.map((review) => review.id));
  }
  assert.equal(ids.length, 55);
  assert.equal(new Set(ids).size, 55);
  assert.equal(ids.at(-1), uuid(1));
  assert(!ids.includes(uuid(100)) && !ids.includes(uuid(101)) && !ids.includes(uuid(110)));

  const firstMicro = await readPage(["micros"], 1);
  assert.equal(firstMicro[0].id, uuid(106));
  assert(firstMicro[0].published_at.includes(".123457"));
  const secondMicro = await readPage(["micros"], 1, firstMicro[0]);
  assert.equal(secondMicro[0].id, uuid(105));
  const thirdMicro = await readPage(["micros"], 1, secondMicro[0]);
  assert.equal(thirdMicro[0].id, uuid(104));
  assert(thirdMicro[0].published_at.includes(".123456"));
  assert.equal((await readPage(["micros"], 1, thirdMicro[0])).length, 0);

  await assert.rejects(readPage(Array(21).fill("popular"), 2), /invalid_review_page/);
  await assert.rejects(readPage(["popular"], 42), /invalid_review_page/);
  await assert.rejects(readPage(["popular","other"], 2, firstMicro[0]), /invalid_review_cursor/);
  console.log("Public review SQL: latest per entry, 55 reviews without skips or repeats, concurrent publication, UUID ties, microseconds, legacy null dates, unpublished/rejected filtering, bounded input, service-only ACL and replay verified.");
} finally {
  await db.close();
}
