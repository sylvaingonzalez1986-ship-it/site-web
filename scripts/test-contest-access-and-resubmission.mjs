// Isolated PostgreSQL tests: real contest migrations, synthetic prerequisite
// shop/auth tables, no credentials, network, or deployed database writes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const customer = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const reviewId = "33333333-3333-4333-8333-333333333333";
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const expectedGrants = {
  contest_seasons: ["SELECT", "INSERT", "UPDATE"],
  contest_entries: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  contest_profiles: ["SELECT", "INSERT", "UPDATE"],
  contest_reviews: ["SELECT", "UPDATE"],
  contest_review_scores: ["SELECT"],
  contest_review_aroma_tags: ["SELECT"],
  contest_review_terpene_guesses: ["SELECT"],
  contest_tester_points: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  contest_badges: ["SELECT", "INSERT", "UPDATE"],
  contest_profile_badges: ["SELECT", "INSERT", "DELETE"],
  contest_rewards: [],
  contest_reward_unlocks: [],
  contest_beta_testers: ["SELECT", "INSERT", "UPDATE"],
  contest_review_votes: ["SELECT", "INSERT", "UPDATE"],
  contest_entry_stats: ["SELECT"],
  contest_rankings_current: ["SELECT"],
  contest_review_vote_summary: ["SELECT"],
  contest_tester_points_summary: ["SELECT"],
  contest_tester_rankings_global: ["SELECT"],
  contest_tester_rankings_by_season: ["SELECT"],
};
const viewNames = Object.keys(expectedGrants).slice(-6);
const writableSequences = ["contest_tester_points_id_seq", "contest_profile_badges_id_seq", "contest_review_votes_id_seq"];
const rpcNames = [
  "rpc_create_contest_review_atomic(text,text,text,uuid,text,contest_consumption_method,text,text,jsonb,jsonb,jsonb)",
  "rpc_update_contest_review_atomic(uuid,uuid,timestamptz,text,contest_consumption_method,text,text,jsonb,jsonb,jsonb)",
  "rpc_claim_contest_badge_reward(uuid,text)",
  "rpc_get_contest_paid_guest_orders(text,integer)",
];

async function asRole(role, callback) {
  await db.exec(`SET ROLE ${role}`);
  try { return await callback(); } finally { await db.exec("RESET ROLE"); }
}
const readVersion = async () => (await db.query("SELECT updated_at::text AS version FROM public.contest_reviews WHERE id=$1", [reviewId])).rows[0]?.version;
const updateReview = async (owner = customer, score = 82, expectedVersion) => db.query(
  "SELECT public.rpc_update_contest_review_atomic($1,$2,$3::timestamptz,'Testeur','vaporizer','190 C','Version corrigee',$4::jsonb,$5::jsonb,$6::jsonb) AS id",
  [reviewId, owner, expectedVersion ?? await readVersion(), JSON.stringify([{ criterion: "appearance", score }]), JSON.stringify([{ tag: "citrus" }]), JSON.stringify(["beta-myrcene"])],
);
const readReview = async () => (await db.query("SELECT * FROM public.contest_reviews WHERE id = $1", [reviewId])).rows[0];

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE ROLE only_public;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role, only_public;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY);
    CREATE TABLE public.products (id text PRIMARY KEY);
    CREATE TABLE public.producers (id text PRIMARY KEY);
    CREATE TABLE public.orders (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), customer_id uuid, customer_email text, payment_state text, status text);
    GRANT SELECT ON public.orders TO service_role;
  `);
  const history = [
    "20260421000100_bete_de_concours.sql",
    "20260426000100_contest_review_terpene_guesses.sql",
    "20260426000200_contest_points_badges_rewards.sql",
    "20260426000300_contest_badge_reward_claims.sql",
    "20260502000100_contest_scores_100_scale.sql",
    "20260506000100_contest_views_security_invoker.sql",
    "20260509000100_contest_tester_votes_rankings.sql",
    "20260509000200_contest_entry_tracks.sql",
    "20260525000100_contest_concours_only_terpenes_rewards.sql",
    "20260606000100_restrict_contest_profile_badges_rls.sql",
    "20260606000200_contest_paid_only_vote_guard.sql",
    "20260623000100_contest_beta_testers.sql",
    "20260719000100_contest_review_atomic_writes.sql",
    "20260719000110_contest_review_atomic_update.sql",
    "20260719000120_contest_review_atomic_permissions.sql",
    "20260810000200_all_approved_reviews_tester_points.sql",
  ];
  for (const name of history) await db.exec(await migration(name));

  const relations = (await db.query("SELECT relname, relkind FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname LIKE 'contest_%' AND relkind IN ('r','v','S')")).rows;
  assert.deepEqual(relations.filter(row => row.relkind !== "S").map(row => row.relname).sort(), Object.keys(expectedGrants).sort());
  // Start from a permissive legacy installation to prove that rights are
  // removed, rather than accidentally passing against an already private DB.
  for (const { relname, relkind } of relations) {
    await db.exec(`GRANT ALL ON ${relkind === "S" ? "SEQUENCE" : "TABLE"} public.${relname} TO PUBLIC, anon, authenticated, service_role`);
  }
  await db.exec(await migration("20261004000100_contest_data_api_hardening.sql"));
  await db.exec(await migration("20261004000300_contest_review_resubmission.sql"));
  await db.exec(await migration("20261004000400_contest_entry_review_identity.sql"));
  await db.exec(await migration("20261004000500_contest_review_create_identity.sql"));
  const oldCreateSignature = "public.rpc_create_contest_review_atomic(text,text,uuid,text,contest_consumption_method,text,text,jsonb,jsonb,jsonb)";
  assert.equal((await db.query("SELECT to_regprocedure($1) AS legacy_rpc", [oldCreateSignature])).rows[0].legacy_rpc, null);
  const oldUpdateSignature = "public.rpc_update_contest_review_atomic(uuid,uuid,text,contest_consumption_method,text,text,jsonb,jsonb,jsonb)";
  assert.equal((await db.query("SELECT to_regprocedure($1) AS legacy_rpc", [oldUpdateSignature])).rows[0].legacy_rpc, null);
  for (const role of ["anon", "authenticated", "only_public", "service_role"]) {
    for (const { relname, relkind } of relations) {
      const sequence = relkind === "S";
      for (const privilege of sequence ? ["SELECT", "UPDATE", "USAGE"] : ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        const expected = role === "service_role" && (sequence
          ? writableSequences.includes(relname) && privilege === "USAGE"
          : expectedGrants[relname].includes(privilege));
        const [{ allowed }] = (await db.query(`SELECT has_${sequence ? "sequence" : "table"}_privilege($1, $2, $3) AS allowed`, [role, `public.${relname}`, privilege])).rows;
        assert.equal(allowed, expected, `${role} ${privilege} ${relname}`);
      }
    }
    for (const signature of rpcNames) {
      const [{ allowed }] = (await db.query("SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [role, `public.${signature}`])).rows;
      assert.equal(allowed, role === "service_role", `${role} EXECUTE ${signature}`);
    }
  }

  await db.query("INSERT INTO auth.users VALUES ($1,'alice@example.com'),($2,'other@example.com')", [customer, other]);
  await db.exec("INSERT INTO public.products VALUES ('flower'); INSERT INTO public.contest_seasons (id,code,label,year) VALUES ('season','2026','Saison 2026',2026)");
  await db.exec("INSERT INTO public.contest_entries (id,slug,title,product_id,season_id,category,track,is_published) VALUES ('entry','fleur-test','Fleur test','flower','season','outdoor','concours',true)");
  await db.query("INSERT INTO public.contest_profiles (customer_id,pseudo) VALUES ($1,'Testeur')", [customer]);
  await db.query("INSERT INTO public.contest_reviews (id,entry_id,season_id,customer_id,pseudo_snapshot,consumption_method,comment,status,admin_note,reviewed_by,reviewed_at,quality_mark) VALUES ($1,'entry','season',$2,'Testeur','vaporizer','Ancienne version','rejected','A corriger','moderator@example.com',now(),'excellent')", [reviewId, customer]);
  await db.query("INSERT INTO public.contest_review_scores (review_id,criterion,score) VALUES ($1,'appearance',40)", [reviewId]);
  await db.query("INSERT INTO public.contest_review_aroma_tags (review_id,tag) VALUES ($1,'earthy')", [reviewId]);
  await db.query("INSERT INTO public.contest_review_terpene_guesses (review_id,terpene) VALUES ($1,'limonene')", [reviewId]);

  for (const role of ["anon", "authenticated", "only_public"]) {
    await asRole(role, async () => {
      await assert.rejects(() => db.query("SELECT customer_id, admin_note, reviewed_by FROM public.contest_reviews"), /permission denied/);
      await assert.rejects(() => db.query("INSERT INTO public.contest_reviews DEFAULT VALUES"), /permission denied/);
      await assert.rejects(() => updateReview(customer, 82, "2026-10-04T00:00:00Z"), /permission denied/);
      await assert.rejects(() => db.query("SELECT * FROM public.rpc_get_contest_paid_guest_orders('alice@example.com')"), /permission denied/);
    });
  }

  const before = await readReview();
  const originalVersion = await readVersion();
  await asRole("service_role", async () => {
    // The real security-invoker views must read every underlying dependency.
    for (const name of viewNames) await db.query(`SELECT * FROM public.${name} LIMIT 1`);
    await assert.rejects(() => updateReview(other), /contest_review_not_found/);
    await assert.rejects(() => updateReview(customer, 101), /check constraint/);
  });
  assert.deepEqual(await readReview(), before, "An invalid correction must not erase rejection or partially update the review");
  assert.equal((await db.query("SELECT score FROM public.contest_review_scores WHERE review_id=$1", [reviewId])).rows[0].score, 40);
  assert.equal((await db.query("SELECT tag FROM public.contest_review_aroma_tags WHERE review_id=$1", [reviewId])).rows[0].tag, "earthy");

  await asRole("service_role", () => updateReview());
  const corrected = await readReview();
  assert.equal(corrected.status, "pending");
  assert.equal(corrected.comment, "Version corrigee");
  assert.equal(corrected.quality_mark, "");
  assert.equal(corrected.admin_note, "");
  assert.equal(corrected.reviewed_at, null);
  assert.equal(corrected.reviewed_by, null);
  assert.equal((await db.query("SELECT score FROM public.contest_review_scores WHERE review_id=$1", [reviewId])).rows[0].score, 82);
  assert.equal((await db.query("SELECT tag FROM public.contest_review_aroma_tags WHERE review_id=$1", [reviewId])).rows[0].tag, "citrus");
  assert.equal((await db.query("SELECT terpene FROM public.contest_review_terpene_guesses WHERE review_id=$1", [reviewId])).rows[0].terpene, "beta-myrcene");
  await asRole("service_role", () => assert.rejects(() => updateReview(customer, 99, originalVersion), /contest_review_version_conflict/));
  assert.equal((await db.query("SELECT score FROM public.contest_review_scores WHERE review_id=$1", [reviewId])).rows[0].score, 82);
  await asRole("service_role", () => updateReview(customer, 81));
  await db.query("UPDATE public.contest_reviews SET status='approved' WHERE id=$1", [reviewId]);
  await asRole("service_role", async () => {
    await assert.rejects(() => updateReview(), /contest_review_not_editable/);
    const stats = (await db.query("SELECT average_score, approved_review_count FROM public.contest_entry_stats WHERE entry_id='entry'")).rows[0];
    assert.equal(Number(stats.average_score), 81);
    assert.equal(Number(stats.approved_review_count), 1);
  });

  // Simulate the gap between the server purchase check for flower and the RPC:
  // an admin reassigns a still-empty lot to another product in the same season.
  await db.exec("INSERT INTO public.products VALUES ('other-flower'); INSERT INTO public.contest_entries (id,slug,title,product_id,season_id,category,is_published) VALUES ('empty','empty-flower','Empty flower','flower','season','outdoor',true)");
  await db.exec("UPDATE public.contest_entries SET product_id='other-flower' WHERE id='empty'");
  const createReview = (product, season = "season", score = 75) => db.query(
    "SELECT public.rpc_create_contest_review_atomic('empty',$1,$2,$3,'Testeur','vaporizer','','Premiere note',$4::jsonb) AS id",
    [season, product, customer, JSON.stringify([{ criterion: "appearance", score }])],
  );
  await asRole("service_role", async () => {
    await assert.rejects(() => createReview("flower"), /Le lot a changé/);
    await assert.rejects(() => createReview("other-flower", "old-season"), /Le lot a changé/);
    await assert.rejects(() => createReview("other-flower", "season", 101), /check constraint/);
  });
  assert.equal((await db.query("SELECT count(*)::int AS count FROM public.contest_reviews WHERE entry_id='empty'")).rows[0].count, 0);
  await db.exec("UPDATE public.contest_entries SET is_published=false WHERE id='empty'");
  await asRole("service_role", () => assert.rejects(() => createReview("other-flower"), /pas disponible/));
  await db.exec("UPDATE public.contest_entries SET is_published=true WHERE id='empty'");
  await asRole("service_role", () => createReview("other-flower"));
  assert.equal((await db.query("SELECT status FROM public.contest_reviews WHERE entry_id='empty'")).rows[0].status, "pending");
  await assert.rejects(() => db.exec("UPDATE public.contest_entries SET product_id='flower' WHERE id='empty'"), /possède déjà des avis/);

  for (const [id, email] of [["plain", "alice@example.com"], ["underscore", "a_ice@example.com"], ["percent", "%@example.com"], ["star", "a*ice@example.com"], ["uppercase", "UpperCase@Example.com"]]) {
    await db.query("INSERT INTO public.orders (id,customer_email,payment_state,status) VALUES ($1,$2,'paid','completed')", [id, email]);
  }
  await db.query("INSERT INTO public.orders (id,customer_email,customer_id,payment_state,status) VALUES ('bound','alice@example.com',$1,'paid','completed'),('pending','alice@example.com',NULL,'pending','completed'),('cancelled','alice@example.com',NULL,'paid','cancelled')", [other]);
  await asRole("service_role", async () => {
    for (const [email, ids] of [["a_ice@example.com", ["underscore"]], ["%@example.com", ["percent"]], ["a*ice@example.com", ["star"]], [" ALICE@EXAMPLE.COM ", ["plain"]], ["uppercase@example.com", ["uppercase"]], ["missing@example.com", []], [null, []], ["", []]]) {
      assert.deepEqual((await db.query("SELECT * FROM public.rpc_get_contest_paid_guest_orders($1)", [email])).rows.map(row => row.id), ids, `Literal email lookup: ${email}`);
    }
  });
  console.log(`PASS: ${history.length} historical + 4 new contest migrations replayed; exact ACLs for 20 relations, 7 sequences and 4 RPCs; real invoker views; literal guest emails; atomic rejected/pending correction; first-review identity/publication guard and removed legacy RPC.`);
} finally {
  await db.close();
}
