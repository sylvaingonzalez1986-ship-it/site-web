// Real PostgreSQL migrations, synthetic accounts only. No credentials/network.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const resetSql = await migration("20261025000100_reset_notebook_for_public_opening.sql");
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const customer = uuid(1), voter = uuid(2), review = uuid(3), entitlement = uuid(4), grant = uuid(5);
const db = new PGlite();
const count = async table => Number((await db.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
const rows = async table => (await db.query(`SELECT to_jsonb(row) AS row FROM ${table} row ORDER BY to_jsonb(row)::text`)).rows;
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE only_public;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.products(id text PRIMARY KEY);
    CREATE TABLE public.producers(id text PRIMARY KEY);
    CREATE TABLE public.orders(id text PRIMARY KEY, customer_id uuid, customer_email text, payment_state text, status text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.kq_heritage_card_definitions(code text PRIMARY KEY);
    CREATE TABLE public.kq_heritage_draws(id uuid PRIMARY KEY);
    CREATE TABLE public.kq_support_booster_entitlements(id uuid PRIMARY KEY, user_id uuid, reward_key text UNIQUE);
    CREATE TABLE public.kq_seasons(season_code text PRIMARY KEY, status text);
    CREATE TABLE public.kq_equipment_wallets(user_id uuid PRIMARY KEY, cash_cents integer);
    CREATE TABLE public.kq_runs(id uuid PRIMARY KEY, user_id uuid, state jsonb);
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, only_public;
  `);
  for (const file of [
    "20260421000100_bete_de_concours.sql",
    "20260426000300_contest_badge_reward_claims.sql",
    "20260502000100_contest_scores_100_scale.sql",
    "20260509000100_contest_tester_votes_rankings.sql",
    "20260509000200_contest_entry_tracks.sql",
    "20260525000100_contest_concours_only_terpenes_rewards.sql",
    "20260606000200_contest_paid_only_vote_guard.sql",
    "20260810000200_all_approved_reviews_tester_points.sql",
    "20261004000400_contest_entry_review_identity.sql",
  ]) await db.exec(await migration(file));

  // Replay real receipt/credit DDL, leaving unrelated game RPC dependencies out.
  await db.exec((await migration("20260725001000_kq_dormant_notebook_rewards.sql")).split("INSERT INTO public.kq_notebook_reward_rules")[0] + "COMMIT;");
  await db.exec((await migration("20260802000100_kq_producer_notebook_rewards.sql")).split("ALTER TABLE public.kq_support_booster_entitlements")[0] + "COMMIT;");
  if (process.argv.includes("--cascade")) await db.exec(await migration("20260803000200_allow_admin_contest_entry_delete.sql"));
  await db.exec((await migration("20260808000100_kq_five_contest_flower_packs.sql")).split("CREATE OR REPLACE FUNCTION")[0] + "COMMIT;");
  const ranking = await migration("20261011000100_arena_ranking_budget.sql");
  await db.exec(ranking.slice(ranking.indexOf("CREATE TABLE public.kq_arena_leaderboard_snapshots"), ranking.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_get_arena_leaderboard")));
  await db.exec((await migration("20261018000300_arena_tasting_first_rankings.sql")).split("CREATE INDEX idx_kq_arena_bot_points")[0] + "COMMIT;");

  await db.exec(`
    INSERT INTO auth.users VALUES ('${customer}','customer@example.test'),('${voter}','voter@example.test');
    INSERT INTO public.products VALUES ('flower'),('other-flower');
    INSERT INTO public.producers VALUES ('producer');
    INSERT INTO public.orders(id,customer_id,customer_email,payment_state,status) VALUES ('order','${voter}','voter@example.test','paid','delivered');
    INSERT INTO public.contest_seasons(id,code,label,year) VALUES ('notebook','2026','Carnet 2026',2026);
    INSERT INTO public.contest_entries(id,slug,title,product_id,season_id,category,track,is_published)
      VALUES ('entry','fleur-test','Fleur test','flower','notebook','outdoor','concours',true),
      ('other-entry','autre-fleur','Autre fleur','other-flower','notebook','indoor','regular',true);
    INSERT INTO public.contest_profiles(customer_id,pseudo) VALUES ('${customer}','Client'),('${voter}','Votant');
    INSERT INTO public.contest_reviews(id,entry_id,season_id,customer_id,pseudo_snapshot,consumption_method,status,comment)
      VALUES ('${review}','entry','notebook','${customer}','Client','vaporizer','approved','Test approved'),
      ('${uuid(6)}','other-entry','notebook','${customer}','Client','vaporizer','pending','Test pending'),
      ('${uuid(7)}','entry','notebook','${voter}','Votant','vaporizer','rejected','Test rejected');
    INSERT INTO public.contest_review_scores(review_id,criterion,score) VALUES ('${review}','appearance',88),('${uuid(6)}','appearance',75);
    INSERT INTO public.contest_review_aroma_tags(review_id,tag) VALUES ('${review}','citrus');
    INSERT INTO public.contest_review_terpene_guesses(review_id,terpene) VALUES ('${review}','limonene');
    INSERT INTO public.contest_review_votes(review_id,voter_customer_id,value) VALUES ('${review}','${voter}',1);
    INSERT INTO public.contest_tester_points(customer_id,review_id,season_id,reason,points,source_key)
      VALUES ('${customer}','${review}','notebook','review_approved',20,'review:${review}:approved'),
      ('${customer}',NULL,'notebook','terpene_match',5,'legacy:terpene'),
      ('${voter}',NULL,NULL,'manual_award',7,'manual:unrelated');
    INSERT INTO public.contest_badges(id,code,label) VALUES
      ('unclaimed','premier-carnet','Premier carnet'),('claimed','nez-absolu','Nez absolu'),
      ('granted','combo-aromatique','Combo aromatique'),('voting','validateur-serieux','Validateur'),
      ('season-rank','jury-saisonnier-notebook','Jury saisonnier'),('manual','manual-badge','Manual badge');
    INSERT INTO public.contest_profile_badges(id,customer_id,badge_id,review_id,reward_claimed_at) VALUES
      (1,'${customer}','unclaimed','${review}',NULL),(2,'${customer}','claimed','${review}',now()),
      (3,'${customer}','granted','${review}',NULL),(4,'${voter}','voting',NULL,NULL),
      (5,'${customer}','season-rank',NULL,NULL),(6,'${voter}','manual',NULL,NULL);
    INSERT INTO public.kq_notebook_reward_rules(badge_code,support_boosters) VALUES ('combo-aromatique',1);
    INSERT INTO public.kq_notebook_reward_grants(user_id,profile_badge_id,badge_code,support_boosters,culture_tokens)
      VALUES ('${customer}',3,'combo-aromatique',1,0);
    INSERT INTO public.contest_rewards(id,code,label,required_points) VALUES ('reward','reward','Reward',10),('manual-reward','manual-reward','Manual reward',5);
    INSERT INTO public.contest_reward_unlocks(customer_id,reward_id,status,claimed_at) VALUES
      ('${customer}','reward','unlocked',NULL),('${voter}','reward','claimed',now()),('${voter}','manual-reward','unlocked',NULL);
    INSERT INTO public.kq_support_booster_entitlements VALUES ('${entitlement}','${customer}','notebook-flower:${customer}:entry');
    INSERT INTO public.kq_notebook_flower_reward_grants(id,user_id,entry_id,review_id,producer_id,entitlement_id)
      VALUES ('${grant}','${customer}','entry','${review}','producer','${entitlement}');
    INSERT INTO public.kq_notebook_flower_reward_packs(flower_grant_id,pack_index,entitlement_id) VALUES ('${grant}',1,'${entitlement}');
    INSERT INTO public.kq_seasons VALUES ('active','active'),('closed','closed');
    INSERT INTO public.kq_arena_tasting_transition_credits(customer_id,product_id,notebook_season_id,review_id,arena_season_code)
      VALUES ('${customer}','flower','notebook','${review}','active');
    INSERT INTO public.kq_arena_leaderboard_snapshots(season_code,leaderboard) VALUES
      ('active','[{"notebookScore":10}]'),('closed','[{"notebookScore":20}]');
    INSERT INTO public.kq_equipment_wallets VALUES ('${customer}',123400);
    INSERT INTO public.kq_runs VALUES ('${uuid(8)}','${customer}','{"phase":"complete"}');
  `);

  const preservedTables = ["auth.users", "public.products", "public.producers", "public.orders", "public.contest_profiles",
    "public.contest_entries", "public.contest_seasons", "public.contest_badges", "public.contest_rewards",
    "public.kq_notebook_reward_grants", "public.kq_support_booster_entitlements", "public.kq_notebook_flower_reward_packs",
    "public.kq_equipment_wallets", "public.kq_runs", "public.kq_seasons"];
  const preserved = new Map(await Promise.all(preservedTables.map(async table => [table, await rows(table)])));
  const beforeNotes = await rows("public.contest_reviews");
  const beforePoints = await rows("public.contest_tester_points");
  const beforeBadges = await rows("public.contest_profile_badges");

  // An error near the end must roll back the archive, FK changes and all deletes.
  await db.exec(`CREATE FUNCTION public.fail_reset_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_reset_failure'; END $$;
    CREATE TRIGGER fail_reset_fixture BEFORE DELETE ON public.contest_reviews FOR EACH ROW EXECUTE FUNCTION public.fail_reset_fixture();`);
  await assert.rejects(() => db.exec(resetSql), /fixture_reset_failure/);
  await db.exec("ROLLBACK;");
  assert.equal((await db.query("SELECT to_regclass('public.contest_notebook_reset_archive') AS archive")).rows[0].archive, null);
  assert.deepEqual(await rows("public.contest_reviews"), beforeNotes);
  assert.deepEqual(await rows("public.contest_tester_points"), beforePoints);
  assert.deepEqual(await rows("public.contest_profile_badges"), beforeBadges);
  assert.equal((await db.query("SELECT is_nullable FROM information_schema.columns WHERE table_name='kq_notebook_flower_reward_grants' AND column_name='review_id'")).rows[0].is_nullable, "NO");
  await db.exec("DROP TRIGGER fail_reset_fixture ON public.contest_reviews; DROP FUNCTION public.fail_reset_fixture();");
  await db.exec(resetSql);

  for (const table of ["contest_reviews", "contest_review_scores", "contest_review_aroma_tags", "contest_review_terpene_guesses", "contest_review_votes", "kq_arena_tasting_transition_credits"]) {
    assert.equal(await count(`public.${table}`), 0, `${table} resets completely`);
  }
  for (const [table, previous] of preserved) assert.deepEqual(await rows(table), previous, `${table} is preserved`);
  assert.deepEqual((await db.query("SELECT badge_id,review_id FROM public.contest_profile_badges ORDER BY badge_id")).rows,
    [{ badge_id: "claimed", review_id: null }, { badge_id: "granted", review_id: null }, { badge_id: "manual", review_id: null }]);
  assert.deepEqual((await db.query("SELECT reason,points FROM public.contest_tester_points")).rows, [{ reason: "manual_award", points: 7 }]);
  assert.equal(await count("public.contest_reward_unlocks"), 2);
  assert.equal((await db.query("SELECT review_id FROM public.kq_notebook_flower_reward_grants WHERE id=$1", [grant])).rows[0].review_id, null);
  assert.deepEqual((await db.query("SELECT season_code FROM public.kq_arena_leaderboard_snapshots")).rows, [{ season_code: "closed" }]);
  for (const row of (await db.query("SELECT approved_review_count,appearance_avg FROM public.contest_entry_stats")).rows) {
    assert.equal(Number(row.approved_review_count), 0);
    assert.equal(row.appearance_avg, null);
  }
  const [{ snapshot, deleted_counts: deletedCounts }] = (await db.query("SELECT snapshot,deleted_counts FROM public.contest_notebook_reset_archive")).rows;
  assert.equal(snapshot.contest_reviews.length, 3);
  assert.equal(snapshot.contest_review_scores.length, 2);
  assert.equal(snapshot.kq_arena_tasting_transition_credits.length, 1);
  assert.equal(snapshot.kq_notebook_flower_reward_grants[0].review_id, review);
  assert.deepEqual(deletedCounts, { contest_reviews: 3, contest_tester_points: 2, contest_profile_badges: 3,
    contest_reward_unlocks: 1, kq_arena_leaderboard_snapshots: 1 });
  for (const role of ["only_public", "anon", "authenticated", "service_role"]) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
      assert.equal((await db.query("SELECT has_table_privilege($1,'public.contest_notebook_reset_archive',$2) AS allowed", [role, privilege])).rows[0].allowed, false);
    }
  }

  // A real customer can immediately note the same flower. Subsequent deploys
  // neither remove that new note nor replace the recovery snapshot/receipt.
  await db.query("INSERT INTO public.contest_reviews(id,entry_id,season_id,customer_id,pseudo_snapshot,consumption_method,status) VALUES ($1,'entry','notebook',$2,'Client','vaporizer','approved')", [uuid(10), customer]);
  await db.query("INSERT INTO public.contest_review_scores(review_id,criterion,score) VALUES ($1,'appearance',91)", [uuid(10)]);
  await db.query("INSERT INTO public.contest_tester_points(customer_id,review_id,reason,points) VALUES ($1,$2,'review_approved',20)", [customer, uuid(10)]);
  await db.exec(resetSql);
  assert.equal(await count("public.contest_reviews"), 1);
  assert.equal((await db.query("SELECT score FROM public.contest_review_scores")).rows[0].score, 91);
  assert.equal(await count("public.contest_tester_points"), 2);
  assert.deepEqual((await db.query("SELECT snapshot FROM public.contest_notebook_reset_archive")).rows[0].snapshot, snapshot);
  await assert.rejects(() => db.query("INSERT INTO public.kq_notebook_flower_reward_grants(user_id,entry_id,review_id,producer_id,entitlement_id) VALUES ($1,'entry',$2,'producer',$3)", [customer, uuid(10), entitlement]), /duplicate key/);
  console.log(`PASS (${process.argv.includes("--cascade") ? "CASCADE" : "RESTRICT"} legacy FK): all note statuses, scores/votes/eligibility reset; rollback and replay; fresh customer notes; owner-only backup; claimed rewards, flower receipts, packs, orders, catalogue, cash, games and closed rankings preserved.`);
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error : `${error.message}${error.detail ? `: ${error.detail}` : ""}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
