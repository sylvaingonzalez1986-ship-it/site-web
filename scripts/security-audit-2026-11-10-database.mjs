// Regression for the audited Data API boundaries. No credentials, network, or live DB.
// These reduced relation fixtures preserve the columns/constraints used by the
// exact repository functions, but are not a complete Supabase migration replay.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const burnFile = "supabase/migrations/20260302001300_lottery_all_burn_10.sql";
const collectionFile = "supabase/migrations/20260302000300_tcg_collection_album_rewards.sql";
const burnSql = await readFile(burnFile, "utf8");
const collectionSql = await readFile(collectionFile, "utf8");
const securitySql = await readFile("supabase/migrations/20261110000200_security_data_api_boundaries.sql", "utf8");
function extract(sql, name) {
  const match = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"));
  assert.ok(match, `Missing real function ${name}`);
  return match[0];
}
const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const card = "00000000-0000-4000-8000-000000000002";
const reward = "00000000-0000-4000-8000-000000000003";
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TYPE public.lottery_card_rarity AS ENUM ('common','silver','gold','epic','legendary');
    CREATE TYPE public.lottery_reward_kind AS ENUM ('discount_percent','gift_weight_grams');
    CREATE TABLE public.lottery_card_definitions(id uuid PRIMARY KEY, rarity public.lottery_card_rarity, is_active boolean DEFAULT true);
    CREATE TABLE public.lottery_card_instances(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, card_definition_id uuid REFERENCES public.lottery_card_definitions);
    CREATE TABLE public.lottery_reward_claims(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, reward_snapshot jsonb, status text,
      reward_line_id uuid, source_ticket_id uuid, reward_definition_id uuid, generated_code text,
      discount_percent integer CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 80),
      gift_weight_grams integer CHECK (gift_weight_grams IS NULL OR gift_weight_grams>0),
      gift_product_sku text, gift_label text, reserved_order_id text, reserved_at timestamptz,
      reserved_until timestamptz, used_order_id text, used_at timestamptz, fulfilled_at timestamptz,
      created_at timestamptz DEFAULT now());
    CREATE TABLE public.lottery_collection_burn_log(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, rarity public.lottery_card_rarity,
      burned_instance_ids uuid[], reward_claim_id uuid REFERENCES public.lottery_reward_claims,
      reward_kind public.lottery_reward_kind, discount_percent integer CHECK(discount_percent BETWEEN 1 AND 80),
      gift_weight_grams integer CHECK(gift_weight_grams IS NULL OR gift_weight_grams>0), gift_label text);
    CREATE TABLE public.lottery_collection_page_completions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, page_rarity public.lottery_card_rarity,
      completed_at timestamptz, claimed_at timestamptz, reward_claim_id uuid,
      selected_reward_definition_id uuid, UNIQUE(user_id,page_rarity));
    CREATE TABLE public.lottery_collection_page_reward_options(
      page_rarity public.lottery_card_rarity, reward_definition_id uuid, is_active boolean);
    CREATE TABLE public.lottery_reward_definitions(
      id uuid PRIMARY KEY, title text, description text, level text, kind public.lottery_reward_kind,
      image_url text, discount_percent integer, gift_weight_grams integer, gift_product_sku text,
      gift_label text, custom_payload jsonb, is_active boolean, deleted_at timestamptz);
    ALTER TABLE public.lottery_card_definitions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lottery_card_instances ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lottery_reward_claims ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lottery_collection_burn_log ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lottery_collection_page_completions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lottery_collection_page_reward_options ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.lottery_reward_definitions ENABLE ROW LEVEL SECURITY;
    INSERT INTO public.lottery_card_definitions(id,rarity) VALUES('${card}','common');
    INSERT INTO public.lottery_card_instances(user_id,card_definition_id) SELECT '${user}','${card}' FROM generate_series(1,11);
    INSERT INTO public.lottery_reward_definitions(id,title,kind,discount_percent,is_active)
      VALUES('${reward}','Fixture reward','discount_percent',5,true);
    INSERT INTO public.lottery_collection_page_reward_options VALUES('common','${reward}',true);
  `);
  await db.exec(extract(collectionSql, "rpc_claim_collection_page_reward"));
  await db.exec(extract(collectionSql, "rpc_burn_duplicate_cards"));
  await db.exec(burnSql);
  const signatures = [
    "public.rpc_burn_duplicate_cards(uuid,lottery_card_rarity,uuid[],lottery_reward_kind,integer,integer,text)",
    "public.rpc_claim_collection_page_reward(uuid,lottery_card_rarity,uuid)",
    "public.rpc_burn_duplicate_cards(uuid,lottery_card_rarity,uuid[],integer)",
  ];
  const initSql = await readFile("supabase/migrations/20260215_0001_init.sql", "utf8");
  await db.exec(`
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, loyalty_points integer NOT NULL DEFAULT 0,
      loyalty_points_spent integer NOT NULL DEFAULT 0, first_name text DEFAULT 'Fixture');
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    INSERT INTO public.profiles(id) VALUES('${user}');
    CREATE TABLE public.orders(id text PRIMARY KEY, customer_id uuid, legacy_customer_id text,
      customer_email text, customer_name text, shipping_address text, shipping_city text,
      shipping_postal_code text, shipping_country text, shipping_phone text,
      relay_id text, relay_name text, relay_address text, relay_postal_code text,
      relay_city text, relay_country text, created_at timestamptz DEFAULT now());
    GRANT SELECT,UPDATE ON public.orders TO service_role;
  `);
  for (const policy of ["profiles_user_read_own", "profiles_user_update_own"]) {
    const match = initSql.match(new RegExp(`CREATE POLICY ${policy}\\b[^;]*;`, "i"));
    assert.ok(match);
    await db.exec(match[0]);
  }
  // Historical table AND per-column grants must be removed, regardless of origin.
  await db.exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles TO authenticated;
    GRANT UPDATE(loyalty_points),INSERT(loyalty_points),REFERENCES(id) ON public.profiles TO PUBLIC,anon,authenticated;
    SET request.jwt.claim.sub='${user}'`);
  for (const signature of signatures) await db.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO anon,authenticated,service_role`);
  await db.exec(securitySql);
  await db.exec(securitySql); // Reapplying definitions/ACLs must be harmless.

  const ids = (await db.query("SELECT id FROM public.lottery_card_instances ORDER BY id LIMIT 10")).rows.map(row => row.id);
  const otherUser = "00000000-0000-4000-8000-000000000099";
  const calls = [
    ["SELECT public.rpc_claim_collection_page_reward($1,'common',$2)", [user, reward]],
    ["SELECT public.rpc_burn_duplicate_cards($1,'common',$2::uuid[],80)", [user, ids]],
    ["SELECT public.rpc_burn_duplicate_cards($1,'common',$2::uuid[],'gift_weight_grams',NULL,1000000,'audit fixture')", [user, ids]],
    ["SELECT public.rpc_burn_duplicate_cards($1,'common',$2::uuid[],'discount_percent',10,NULL,NULL)", [otherUser, ids]],
    ["SELECT * FROM public.rpc_get_customer_guest_orders($1)", ["a_b@example.invalid"]],
    ["SELECT public.rpc_anonymize_customer_orders($1,$2)", [user, "a_b@example.invalid"]],
  ];
  for (const role of ["anon", "authenticated"]) {
    for (const signature of signatures) {
      assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, signature])).rows[0].allowed, false);
    }
    for (const privilege of ["INSERT", "UPDATE", "REFERENCES"]) {
      assert.equal((await db.query("SELECT has_any_column_privilege($1,'public.profiles',$2) AS allowed", [role, privilege])).rows[0].allowed, false);
    }
    await db.exec(`SET ROLE ${role}`);
    for (const [sql, params] of calls) await assert.rejects(() => db.query(sql, params), error => error.code === "42501");
    await assert.rejects(() => db.query("UPDATE public.profiles SET loyalty_points=1000000 WHERE id=$1", [user]), error => error.code === "42501");
    await assert.rejects(() => db.query("UPDATE public.profiles SET loyalty_points_spent=0 WHERE id=$1", [user]), error => error.code === "42501");
    await db.exec("RESET ROLE");
  }
  assert.equal((await db.query("SELECT count(*)::int AS total FROM public.lottery_card_instances")).rows[0].total, 11);
  assert.equal((await db.query("SELECT count(*)::int AS total FROM public.lottery_reward_claims")).rows[0].total, 0);
  assert.equal((await db.query("SELECT loyalty_points FROM public.profiles")).rows[0].loyalty_points, 0);
  await db.exec("SET ROLE service_role");
  await assert.rejects(() => db.query("SELECT public.rpc_burn_duplicate_cards($1,'common',$2::uuid[],80)", [user, ids]), error => error.code === "42501");
  await assert.rejects(() => db.query("SELECT public.rpc_burn_duplicate_cards($1,'common',$2::uuid[],'discount_percent',80,NULL,NULL)", [user, ids]), /burn_discount_invalid/);
  await assert.rejects(() => db.query("SELECT public.rpc_burn_duplicate_cards($1,'common',$2::uuid[],'gift_weight_grams',NULL,1000000,NULL)", [user, ids]), /burn_gift_invalid/);
  const claim = (await db.query("SELECT public.rpc_claim_collection_page_reward($1,'common',$2) AS claim", [user, reward])).rows[0].claim;
  assert.equal(claim.user_id, user);
  assert.equal(claim.discount_percent, 5);
  await db.query("UPDATE public.profiles SET first_name='Updated safely' WHERE id=$1", [user]);
  await db.exec("RESET ROLE");
  // Parse the independent application schedule so SQL cannot silently drift.
  const schedule = await readFile("src/lib/lottery-collection.ts", "utf8");
  const rules = [...schedule.matchAll(/(common|silver|gold|epic): \{ duplicatesRequired: (\d+), discountPercent: (\d+), giftWeightGrams: (\d+) \}/g)];
  assert.equal(rules.length, 4);
  for (const [, rarity, quantity, discount, grams] of rules) {
    await db.query("UPDATE public.lottery_card_definitions SET rarity=$1 WHERE id=$2", [rarity, card]);
    await db.exec(`INSERT INTO public.lottery_card_instances(user_id,card_definition_id) SELECT '${user}','${card}' FROM generate_series(1,20)`);
    for (const kind of ["discount_percent", "gift_weight_grams"]) {
      const burnIds = (await db.query("SELECT id FROM public.lottery_card_instances ORDER BY id LIMIT $1", [Number(quantity)])).rows.map(row => row.id);
      await db.exec("SET ROLE service_role");
      const receipt = (await db.query("SELECT public.rpc_burn_duplicate_cards($1,$2,$3::uuid[],$4,$5,$6,$7) AS claim", [user, rarity, burnIds, kind, Number(discount), Number(grams), "untrusted fulfillment note"])).rows[0].claim;
      assert.equal(receipt.user_id, user);
      assert.equal(receipt.burned_count, Number(quantity));
      if (kind === "discount_percent") assert.equal(receipt.discount_percent, Number(discount));
      else { assert.equal(receipt.gift_weight_grams, Number(grams)); assert.equal(receipt.gift_label, `${grams}g offerts`); }
      await db.exec("RESET ROLE");
    }
  }
  console.log("Data API security regression passed: all 3 reward signatures + guest RPCs deny clients; obsolete server overload denied; profile table/column writes revoked; legitimate service profile, collection and all 8 burn schedules pass; hostile amounts rejected; migration idempotent.");
} finally {
  await db.close();
}
