// Isolated PostgreSQL test of the deployed trigger SQL; no Supabase connection.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.contest_entries(id text PRIMARY KEY, product_id text NOT NULL, season_id text NOT NULL, title text);
    CREATE TABLE public.contest_reviews(id int PRIMARY KEY, entry_id text REFERENCES contest_entries, season_id text NOT NULL, status text NOT NULL);
    INSERT INTO public.contest_entries VALUES ('reviewed','flower','2026','Original'),('empty','flower','2026','Empty');
  `);
  const migration = await readFile(resolve("supabase/migrations/20261004000400_contest_entry_review_identity.sql"), "utf8");
  await db.exec(migration);
  await db.exec(migration); // Safe replay of deployment.

  await assert.rejects(db.exec("INSERT INTO contest_reviews VALUES(1,'reviewed','2025','pending')"), /Le lot a changé/);
  await db.exec("INSERT INTO contest_reviews VALUES(1,'reviewed','2026','pending')");
  for (const status of ["pending", "approved", "rejected"]) {
    await db.query("UPDATE contest_reviews SET status=$1 WHERE id=1", [status]);
    await assert.rejects(db.exec("UPDATE contest_entries SET product_id='another-flower' WHERE id='reviewed'"), /possède déjà des avis/);
    await assert.rejects(db.exec("UPDATE contest_entries SET season_id='2027' WHERE id='reviewed'"), /possède déjà des avis/);
  }
  await db.exec("UPDATE contest_entries SET title='New description', product_id='flower', season_id='2026' WHERE id='reviewed'");
  assert.equal((await db.query("SELECT title FROM contest_entries WHERE id='reviewed'")).rows[0].title, "New description");

  await db.exec("UPDATE contest_entries SET product_id='other',season_id='2027' WHERE id='empty'");
  await assert.rejects(db.exec("INSERT INTO contest_reviews VALUES(2,'empty','2026','pending')"), /Le lot a changé/);
  await db.exec("INSERT INTO contest_reviews VALUES(2,'empty','2027','pending')");
  await assert.rejects(db.exec("UPDATE contest_reviews SET season_id='2026' WHERE id=2"), /Le lot a changé/);
  for (const role of ["anon", "authenticated", "service_role"]) {
    const result = await db.query("SELECT has_function_privilege($1,'public.guard_contest_entry_review_identity()','EXECUTE') AS allowed", [role]);
    assert.equal(result.rows[0].allowed, false);
  }
  console.log("Contest lot identity: product/season protected for pending, approved and rejected reviews; editorial changes and empty lots supported; stale submissions rejected; trigger helpers private.");
} finally {
  await db.close();
}
