// Isolated PostgreSQL smoke test; never connects to Supabase or sends a message.
// Usage: node scripts/smoke-test-contest-bundle-rewards.mjs <local-pglite-module>
// Example module: output/mailing-sql/package/dist/index.js (offline package).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

process.on("uncaughtException", error => {
  console.error(error.message, error.where ?? "", error.detail ?? "");
  process.exit(1);
});

if (!process.argv[2]) throw new Error("Pass the local @electric-sql/pglite module path.");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const user = "11111111-1111-4111-8111-111111111111";
const guest = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const passed = [];
const sqlFile = async name => (await readFile(resolve("supabase/migrations", name), "utf8")).replaceAll("\r\n", "\n");
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const functionSql = (sql, name) => {
  const start = sql.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`));
  assert.ok(start >= 0, `Missing function ${name}`);
  return sql.slice(start, sql.indexOf("\n$$;", start) + 4);
};

await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,email_confirmed_at TIMESTAMPTZ,deleted_at TIMESTAMPTZ);
INSERT INTO auth.users VALUES('${user}','client@example.fr',now(),NULL),('${guest}','guest@example.fr',NULL,NULL),('${other}','other@example.fr',now(),NULL);
CREATE TYPE public.lottery_card_rarity AS ENUM('common','silver','gold','epic','legendary');
CREATE TABLE public.products(id TEXT PRIMARY KEY,name TEXT,category TEXT,is_pack BOOLEAN DEFAULT false,variant_options JSONB,weight_grams NUMERIC,price NUMERIC,stock INTEGER DEFAULT 100);
INSERT INTO public.products(id,name,category,weight_grams,price) VALUES('f1','Fleur 1','fleurs',2.5,10),('f2','Fleur 2','fleurs',5,20),('regular','Regular','fleurs',1,2.5);
CREATE TABLE public.contest_seasons(id TEXT PRIMARY KEY,is_active BOOLEAN,is_archived BOOLEAN);
INSERT INTO public.contest_seasons VALUES('current',true,false),('old',false,true);
CREATE TABLE public.contest_entries(id TEXT PRIMARY KEY,product_id TEXT,season_id TEXT,is_published BOOLEAN,track TEXT);
INSERT INTO public.contest_entries VALUES('e1','f1','current',true,'concours'),('e2','f2','current',true,'concours'),('duplicate','f1','current',true,'concours'),('regular','regular','current',true,'regular');
CREATE TABLE public.orders(id TEXT PRIMARY KEY,created_at TIMESTAMPTZ DEFAULT now(),payment_state TEXT DEFAULT 'pending',status TEXT DEFAULT 'new',archived_at TIMESTAMPTZ,payment_review_required BOOLEAN DEFAULT false,paid_at TIMESTAMPTZ,customer_id UUID,customer_email TEXT);
CREATE TABLE public.order_items(id BIGSERIAL PRIMARY KEY,order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,product_id TEXT,product_category TEXT DEFAULT 'fleurs',quantity INTEGER DEFAULT 1,unit_weight_grams NUMERIC(12,1),unit_price NUMERIC DEFAULT 10,line_total NUMERIC DEFAULT 10,parent_pack_id TEXT);
CREATE TABLE public.lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,is_active BOOLEAN DEFAULT true,created_at TIMESTAMPTZ DEFAULT now());
INSERT INTO public.lottery_card_collections(code,created_at) VALUES('HEMP_HEROES_2026','2025-01-01'),('BOTTE_DU_CHANVRIER_2026','2026-01-01');
CREATE TABLE public.lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID REFERENCES public.lottery_card_collections(id),code TEXT,name TEXT,rarity public.lottery_card_rarity,image_url TEXT DEFAULT '',is_active BOOLEAN DEFAULT true,card_number INTEGER);
INSERT INTO public.lottery_card_definitions(collection_id,code,name,rarity,card_number)
 SELECT collection.id,collection.code||':'||rarity,rarity,rarity::public.lottery_card_rarity,number::INTEGER
 FROM public.lottery_card_collections collection CROSS JOIN unnest(ARRAY['common','silver','gold','epic','legendary']) WITH ORDINALITY AS pool(rarity,number);
CREATE TABLE public.lottery_game_config(id INTEGER PRIMARY KEY,is_active BOOLEAN,euros_per_ticket NUMERIC,max_tickets_per_order INTEGER);
INSERT INTO public.lottery_game_config VALUES(1,true,10,100);
CREATE TABLE public.lottery_ticket_counter(id INTEGER PRIMARY KEY,next_number INTEGER NOT NULL);
CREATE TABLE public.lottery_tickets(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,order_id TEXT,ticket_number TEXT UNIQUE,order_amount NUMERIC,status TEXT);
CREATE TABLE public.lottery_audit_log(event_type TEXT,user_id UUID,order_id TEXT,details JSONB);
CREATE TABLE public.lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,card_definition_id UUID REFERENCES public.lottery_card_definitions(id),pack_slot INTEGER,ticket_id UUID,kq_support_entitlement_id UUID,source_bot_battle_id UUID,pioneer_grant_id UUID,producer_purchase_buddie_grant_id UUID,community_mission_reward_id UUID,
 CONSTRAINT lottery_card_instances_source_required CHECK(ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL OR community_mission_reward_id IS NOT NULL));
CREATE TABLE public.kq_support_booster_entitlements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,source TEXT,reward_key TEXT UNIQUE,ticket_id UUID,card_count INTEGER DEFAULT 10 CHECK(card_count BETWEEN 1 AND 10),status TEXT DEFAULT 'available',
 CONSTRAINT kq_support_booster_entitlements_source_check CHECK(source IN('ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack','pvp_win','notebook_flower','mission','achievement','pioneer_pack')),
 CONSTRAINT kq_support_booster_entitlements_source_shape_check CHECK((source='ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR (source<>'ticket' AND ticket_id IS NULL AND reward_key IS NOT NULL)));
CREATE FUNCTION public.lottery_secure_random_int(low INTEGER,high INTEGER) RETURNS INTEGER LANGUAGE sql AS 'SELECT low';
INSERT INTO public.orders(id,customer_id,paid_at,payment_state) VALUES('historical','${user}',now(),'paid');
INSERT INTO public.order_items(order_id,product_id,unit_weight_grams) VALUES('historical','f1',5),('historical','f2',5);
`);
await db.exec(functionSql(await sqlFile("20260228000800_lottery_dynamic_rewards.sql"), "rpc_admin_grant_lottery_tickets"));
await db.exec(functionSql(await sqlFile("20260304143000_loyalty_badge_pack_benefits.sql"), "rpc_mint_lottery_tickets"));
await db.exec(await sqlFile("20261002000200_contest_bundle_rewards.sql"));
await db.exec("UPDATE public.kq_contest_bundle_settings SET starts_at=now()-interval '1 second'");

const state = id => scalar("SELECT public.rpc_kq_get_contest_bundle_rewards($1)", [id ?? null]);
const sync = id => scalar("SELECT public.rpc_kq_sync_contest_bundle_rewards($1)", [id]);
const receipt = id => scalar("SELECT count(*)::INTEGER FROM public.kq_contest_bundle_reward_grants WHERE order_id=$1", [id]);
const create = async (id, customer = user, email = null, paid = false) => db.query(
  "INSERT INTO public.orders(id,customer_id,customer_email,payment_state,paid_at) VALUES($1,$2,$3,$4,CASE WHEN $4='paid' THEN now() ELSE NULL END)",
  [id, customer, email, paid ? "paid" : "pending"],
);
const line = (id, product, weight, quantity = 1, price = 10, parent = null) => db.query(
  "INSERT INTO public.order_items(order_id,product_id,unit_weight_grams,quantity,unit_price,line_total,parent_pack_id) VALUES($1,$2,$3,$4,$5,$5::NUMERIC*$4::INTEGER,$6)",
  [id, product, weight, quantity, price, parent],
);
const lines = async (id, weight = 3, parent = null) => { await line(id, "f1", weight, 1, 10, parent); await line(id, "f2", weight, 1, 10, parent); };
const pay = id => db.query("UPDATE public.orders SET payment_state='paid',paid_at=now() WHERE id=$1", [id]);
const qualifies = async (id, weight = 3) => { await create(id); await lines(id, weight); await pay(id); };

assert.equal((await state()).available, true);
assert.equal((await state()).minGrams, 5, "the already-deployed v1 migration must stay unchanged");
assert.equal((await state()).flowers.length, 2, "duplicate entries must be deduplicated");
await sync(user);
assert.equal(await receipt("historical"), 0);
await create("exact");
await line("exact", "f1", 2.5, 2);
await line("exact", "f2", 5);
await pay("exact");
assert.equal(await receipt("exact"), 1);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets"), 3);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets WHERE order_id IS NOT NULL"), 0);
assert.equal(await scalar("SELECT count(*)::int FROM kq_support_booster_entitlements WHERE card_count=10"), 5);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_card_instances instance JOIN lottery_card_definitions card ON card.id=instance.card_definition_id WHERE card.rarity='epic'"), 1);
assert.equal((await state(user)).receipts[0].card.rarity, "epic");
await Promise.all([sync(user), sync(user)]);
await pay("exact");
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets"), 3);
assert.equal(await scalar("SELECT rpc_mint_lottery_tickets($1,'exact',20,0)", [user]), 2, "bonus must preserve ordinary loyalty mint");
await qualifies("double", 10);
assert.equal(await receipt("double"), 1);
assert.equal(await scalar("SELECT count(*)::int FROM kq_support_booster_entitlements WHERE reward_key LIKE 'contest-bundle:double:%'"), 5);
passed.push("historical v1: prospective orders; exact 5g; unique epic + 3 Buddies + 5 ten-card Botte; idempotent replay; 10g not doubled; standard mint preserved");

await create("v1-paid-under"); await lines("v1-paid-under"); await pay("v1-paid-under");
await create("v1-pending"); await lines("v1-pending");
assert.equal(await receipt("v1-paid-under"), 0);
const originalStartsAt = (await state()).startsAt;
const originalReceipts = (await state(user)).receipts;
const originalSnapshots = await scalar("SELECT jsonb_agg(to_jsonb(snapshot) ORDER BY order_id) FROM kq_contest_bundle_order_snapshots snapshot");
await db.exec(await sqlFile("20261003000100_contest_bundle_three_grams.sql"));
assert.equal((await state()).minGrams, 3);
assert.equal((await state()).startsAt, originalStartsAt, "lowering the threshold must not move the original offer start");
assert.deepEqual((await state(user)).receipts, originalReceipts);
assert.deepEqual(await scalar("SELECT jsonb_agg(to_jsonb(snapshot) ORDER BY order_id) FROM kq_contest_bundle_order_snapshots snapshot"), originalSnapshots);
await sync(user);
await pay("v1-pending");
assert.equal(await receipt("v1-paid-under"), 0, "old paid orders must not become retroactively eligible at 3g");
assert.equal(await receipt("v1-pending"), 0, "old unpaid checkouts retain their original 5g threshold");
await db.exec("DELETE FROM orders WHERE id='v1-paid-under'");
await create("v1-paid-under"); await lines("v1-paid-under"); await pay("v1-paid-under");
assert.equal(await receipt("v1-paid-under"), 0, "reimporting the same order must retain its original version");
for (const id of ["v1-paid-under", "v1-pending"]) {
  await line(id, "f1", 2); await line(id, "f2", 2);
  assert.equal(await receipt(id), 1, "v1 still qualifies at 5g after the migration");
  assert.equal(await scalar("SELECT rule_version FROM kq_contest_bundle_reward_grants WHERE order_id=$1", [id]), "contest-bundle-v1");
}
await create("exact-three");
await line("exact-three", "f1", 1.5, 2); await line("exact-three", "f2", 0.1, 30); await pay("exact-three");
assert.equal(await receipt("exact-three"), 1);
assert.equal(await scalar("SELECT rule_version FROM kq_contest_bundle_order_snapshots WHERE order_id='exact-three'"), "contest-bundle-v2");
assert.equal(await scalar("SELECT rule_version FROM kq_contest_bundle_reward_grants WHERE order_id='exact-three'"), "contest-bundle-v2");
assert.deepEqual(await scalar("SELECT purchased_grams FROM kq_contest_bundle_reward_grants WHERE order_id='exact-three'"), { f1: 3, f2: 3 });
assert.equal(await scalar("SELECT count(*)::int FROM kq_support_booster_entitlements WHERE reward_key LIKE 'contest-bundle:exact-three:%' AND card_count=10"), 5);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_card_instances WHERE contest_bundle_order_id='exact-three'"), 1);
const newTickets = await scalar("SELECT count(*)::int FROM lottery_tickets");
await Promise.all([sync(user), sync(user)]); await pay("exact-three");
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets"), newTickets, "3g rewards also remain idempotent");
for (const originalReceipt of originalReceipts) {
  assert.deepEqual((await state(user)).receipts.find(current => current.orderId === originalReceipt.orderId), originalReceipt);
}
await qualifies("double-three", 6);
assert.equal(await scalar("SELECT count(*)::int FROM kq_support_booster_entitlements WHERE reward_key LIKE 'contest-bundle:double-three:%'"), 5);
passed.push("incremental 3g migration; v1 snapshots/receipts/start preserved; old unpaid and reimported orders remain at 5g; exact decimal 3g and 6g give one unchanged reward");

await create("under"); await line("under", "f1", 2.9); await line("under", "f2", 3); await pay("under");
assert.equal(await receipt("under"), 0);
await line("under", "f1", 0.1);
assert.equal(await receipt("under"), 1);
await create("split-a"); await line("split-a", "f1", 3); await pay("split-a");
await create("split-b"); await line("split-b", "f2", 3); await pay("split-b");
assert.equal(await receipt("split-a"), 0); assert.equal(await receipt("split-b"), 0);
await create("gift"); await line("gift", "f1", 3, 1, 0); await line("gift", "f2", 3); await pay("gift");
assert.equal(await receipt("gift"), 0);
await create("variant"); await line("variant", "f1::3g", 3); await line("variant", "f2", 3); await pay("variant");
assert.equal(await receipt("variant"), 0);
await create("pack-components"); await lines("pack-components", 3, "paid-pack"); await pay("pack-components");
assert.equal(await receipt("pack-components"), 1);
await create("paid-first", user, null, true); await lines("paid-first");
assert.equal(await receipt("paid-first"), 1);
passed.push("precise decimal threshold; no cross-order sum; gifts/variant IDs excluded; paid pack components counted; paid-before-lines handled");

await create("catalogue-snapshot");
await db.exec("UPDATE products SET name='Renamed',stock=0,weight_grams=999 WHERE id='f2'; UPDATE contest_entries SET is_published=false WHERE product_id='f2'");
await line("catalogue-snapshot", "f1", 3); await pay("catalogue-snapshot");
assert.equal(await receipt("catalogue-snapshot"), 0, "unpublication cannot shrink existing requirements");
await line("catalogue-snapshot", "f2", 3);
assert.equal(await receipt("catalogue-snapshot"), 1);
const frozen = await scalar("SELECT required_flowers FROM kq_contest_bundle_reward_grants WHERE order_id='catalogue-snapshot'");
assert.equal(frozen.find(f => f.productId === "f2").title, "Fleur 2");
assert.equal(frozen.find(f => f.productId === "f2").unitWeightGrams, 5);
await db.exec("UPDATE contest_entries SET is_published=true WHERE product_id='f2'; UPDATE products SET weight_grams=5 WHERE id='f2'");
assert.equal((await state()).flowers.length, 2, "out of stock flower stays required");
await db.exec("UPDATE products SET variant_options='[{}]' WHERE id='f2'");
assert.equal((await state()).available, false, "unsupported flower disables offer");
await create("unsupported");
await db.exec("UPDATE products SET variant_options=NULL WHERE id='f2'");
await lines("unsupported"); await pay("unsupported");
assert.equal(await receipt("unsupported"), 0, "disabled checkout cannot gain a retroactive offer");
await db.exec("UPDATE contest_seasons SET is_active=false");
assert.equal((await state()).available, false);
await create("no-active-season"); await lines("no-active-season"); await pay("no-active-season");
assert.equal(await receipt("no-active-season"), 0);
await db.exec("UPDATE contest_seasons SET is_active=true WHERE id='current'");
passed.push("checkout catalogue/name/weight snapshot survives changes; stock-zero still required; unsupported flower and no active season fail closed");

await create("guest", null, "GUEST@example.fr"); await lines("guest"); await pay("guest");
assert.equal(await receipt("guest"), 0);
await db.exec(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${guest}'`);
await sync(guest);
assert.equal(await receipt("guest"), 1);
await create("linked-owner", other, "client@example.fr"); await lines("linked-owner"); await pay("linked-owner");
assert.equal(await scalar("SELECT user_id FROM kq_contest_bundle_reward_grants WHERE order_id='linked-owner'"), other);
await create("review"); await lines("review");
await db.exec("BEGIN; UPDATE orders SET payment_state='paid',paid_at=now() WHERE id='review'; UPDATE orders SET payment_review_required=true WHERE id='review'; COMMIT");
assert.equal(await receipt("review"), 0);
await db.exec("UPDATE orders SET payment_review_required=false WHERE id='review'");
assert.equal(await receipt("review"), 1);
for (const kind of ["cancelled", "archived"]) {
  await create(kind); await lines(kind);
  await db.query(`UPDATE orders SET ${kind === "cancelled" ? "status='cancelled'" : "archived_at=now()"} WHERE id=$1`, [kind]);
  await pay(kind); assert.equal(await receipt(kind), 0);
}
passed.push("verified guest recovery and linked owner precedence; final payment-review state; cancelled/archived excluded");

await create("atomic-failure"); await lines("atomic-failure");
await db.exec("CREATE FUNCTION reject_botte() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.reward_key LIKE 'contest-bundle:atomic-failure:%' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END; $$; CREATE TRIGGER reject_botte BEFORE INSERT ON kq_support_booster_entitlements FOR EACH ROW EXECUTE FUNCTION reject_botte()");
const ticketsBefore = await scalar("SELECT count(*)::int FROM lottery_tickets");
await pay("atomic-failure");
assert.equal(await scalar("SELECT payment_state FROM orders WHERE id='atomic-failure'"), "paid");
assert.equal(await receipt("atomic-failure"), 0);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets"), ticketsBefore);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_card_instances WHERE contest_bundle_order_id='atomic-failure'"), 0);
await db.exec("DROP TRIGGER reject_botte ON kq_support_booster_entitlements");
await sync(user);
assert.equal(await receipt("atomic-failure"), 1);
await create("catalogue-retry"); await lines("catalogue-retry");
await db.exec("UPDATE lottery_card_collections SET is_active=false WHERE code='BOTTE_DU_CHANVRIER_2026'");
await pay("catalogue-retry");
assert.equal(await receipt("catalogue-retry"), 0);
assert.equal((await state(user)).available, false);
assert.ok((await state(user)).receipts.length > 0, "catalogue closure must not hide receipts");
await db.exec("UPDATE lottery_card_collections SET is_active=true WHERE code='BOTTE_DU_CHANVRIER_2026'");
await sync(user);
assert.equal(await receipt("catalogue-retry"), 1);
passed.push("partial reward rollback never rolls back payment; sync repairs transient failure; catalogue closure preserves promises and receipts");

await db.exec("DELETE FROM orders WHERE id='exact'; UPDATE contest_entries SET is_published=false WHERE product_id='f2'");
await create("exact"); await line("exact", "f1", 5); await pay("exact");
assert.equal(await receipt("exact"), 1);
assert.equal(await scalar("SELECT jsonb_array_length(required_flowers) FROM kq_contest_bundle_order_snapshots WHERE order_id='exact'"), 2);
await db.exec("UPDATE orders SET payment_state='failed' WHERE id='double'"); await pay("double");
assert.equal(await receipt("double"), 1);
assert.equal(await scalar("SELECT count(*)::int FROM kq_support_booster_entitlements WHERE reward_key LIKE 'contest-bundle:double:%'"), 5);
await db.exec("UPDATE contest_entries SET is_published=true WHERE product_id='f2'");
passed.push("delete/reimport preserves snapshots and receipts; failed-to-paid replay cannot multiply rewards");

await db.exec("GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated; SET ROLE service_role");
assert.ok(await state(user));
await assert.rejects(db.exec("SELECT * FROM public.kq_contest_bundle_reward_grants"), /permission denied/);
await assert.rejects(db.exec("SELECT public.kq_grant_contest_bundle_reward('exact')"), /permission denied/);
await assert.rejects(db.exec("UPDATE public.kq_contest_bundle_settings SET starts_at=now()"), /permission denied/);
await db.exec("RESET ROLE; SET ROLE anon");
await assert.rejects(db.exec("SELECT public.rpc_kq_get_contest_bundle_rewards(NULL)"), /permission denied/);
await db.exec("RESET ROLE");
passed.push("private tables and internal helpers inaccessible; service_role only named read/sync RPCs; anonymous denied");

let customerNumber = 100;
const customer = async (email = null, confirmed = true) => {
  const id = `44444444-4444-4444-8444-${String(++customerNumber).padStart(12, "0")}`;
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,CASE WHEN $3 THEN now() ELSE NULL END)", [id, email ?? `${customerNumber}@example.fr`, confirmed]);
  return id;
};
const rewardsFor = id => scalar("SELECT count(*)::int FROM kq_contest_bundle_reward_grants WHERE user_id=$1", [id]);
const progressFor = async id => (await state(id)).progress;
const cumulativeHistorical = await customer();
await create("cum-history-a", cumulativeHistorical); await line("cum-history-a", "f1", 1, 2); await line("cum-history-a", "f2", 1); await pay("cum-history-a");
await create("cum-history-b", cumulativeHistorical); await line("cum-history-b", "f1", 1); await line("cum-history-b", "f2", 1, 2); await pay("cum-history-b");
await db.exec("UPDATE orders SET created_at='2020-01-01',paid_at='2020-01-02' WHERE id='cum-history-a'; UPDATE orders SET created_at='2021-01-01',paid_at='2021-01-02' WHERE id='cum-history-b'");
assert.equal(await rewardsFor(cumulativeHistorical), 0, "v2 cannot combine distinct orders");
const oldPendingCustomer = await customer();
for (const id of ["cum-old-pending-a", "cum-old-pending-b"]) {
  await create(id, oldPendingCustomer); await lines(id);
}
const oldReceipts = (await state(user)).receipts;
const oldStart = (await state()).startsAt;
const receiptsBeforeCumulative = await scalar("SELECT count(*)::int FROM kq_contest_bundle_reward_grants");
await db.exec(await sqlFile("20261003000200_contest_bundle_cumulative_rewards.sql"));
assert.equal(await scalar("SELECT count(*)::int FROM kq_contest_bundle_reward_grants"), receiptsBeforeCumulative, "migration never grants historical rewards automatically");
assert.equal((await state()).startsAt, oldStart);
assert.equal((await state()).progress, null);
assert.deepEqual((await state()).receipts, []);
assert.deepEqual((await state(user)).receipts, oldReceipts);
assert.equal((await progressFor(user)).rewarded, true);
const historicalPreview = await progressFor(cumulativeHistorical);
assert.deepEqual(historicalPreview, {
  flowers: [{ productId: "f1", purchasedGrams: 3, complete: true }, { productId: "f2", purchasedGrams: 3, complete: true }],
  completedCount: 2, requiredCount: 2, eligible: true, rewarded: false, grantedAt: null,
});
assert.equal(await scalar("SELECT count(*)::int FROM kq_contest_bundle_reward_grants"), receiptsBeforeCumulative, "GET must remain strictly read-only even when eligible");
await sync(cumulativeHistorical);
assert.equal(await rewardsFor(cumulativeHistorical), 1);
assert.equal(await receipt("cum-history-b"), 1, "latest paid contributing order anchors the permanent receipt");
assert.equal(await scalar("SELECT rule_version FROM kq_contest_bundle_reward_grants WHERE order_id='cum-history-b'"), "contest-bundle-v3");
assert.deepEqual(await scalar("SELECT purchased_grams FROM kq_contest_bundle_reward_grants WHERE order_id='cum-history-b'"), { f1: 3, f2: 3 });
assert.deepEqual((await scalar("SELECT contributing_orders FROM kq_contest_bundle_reward_grants WHERE order_id='cum-history-b'")).map(order => ({ id: order.orderId, grams: order.purchasedGrams })), [
  { id: "cum-history-a", grams: { f1: 2, f2: 1 } }, { id: "cum-history-b", grams: { f1: 1, f2: 2 } },
]);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets WHERE user_id=$1 AND order_id IS NULL", [cumulativeHistorical]), 3);
assert.equal(await scalar("SELECT count(*)::int FROM kq_support_booster_entitlements WHERE user_id=$1 AND card_count=10", [cumulativeHistorical]), 5);
await Promise.all(Array.from({ length: 8 }, () => sync(cumulativeHistorical)));
assert.equal(await rewardsFor(cumulativeHistorical), 1);
await pay("cum-old-pending-a"); await pay("cum-old-pending-b");
assert.equal(await rewardsFor(oldPendingCustomer), 1, "older snapshots now follow one cumulative award, not parallel per-order rules");
await sync(user);
await create("cum-prior-beneficiary", user); await lines("cum-prior-beneficiary", 30); await pay("cum-prior-beneficiary");
assert.deepEqual((await state(user)).receipts, oldReceipts, "any v1/v2 beneficiary is already rewarded forever");
passed.push("v3 migration grants nothing; GET anonymous/private progress is read-only; pre-launch paid orders cumulatively qualify; immutable totals/contributing-order audit; former beneficiaries and pending snapshots cannot receive twice");

const cumulativePartial = await customer();
await create("cum-f1-first", cumulativePartial); await line("cum-f1-first", "f1", 1); await pay("cum-f1-first");
await create("cum-f2", cumulativePartial); await line("cum-f2", "f2", 3); await pay("cum-f2");
await create("cum-f1-under", cumulativePartial); await line("cum-f1-under", "f1", 1.9); await pay("cum-f1-under");
assert.deepEqual((await progressFor(cumulativePartial)).flowers, [
  { productId: "f1", purchasedGrams: 2.9, complete: false }, { productId: "f2", purchasedGrams: 3, complete: true },
]);
assert.equal((await progressFor(cumulativePartial)).completedCount, 1);
assert.equal(await rewardsFor(cumulativePartial), 0);
await create("cum-final-tenth", cumulativePartial); await line("cum-final-tenth", "f1", .1); await pay("cum-final-tenth");
assert.equal(await rewardsFor(cumulativePartial), 1);
assert.equal((await progressFor(cumulativePartial)).eligible, true);
assert.equal((await progressFor(cumulativePartial)).rewarded, true);
const permanentReceipt = (await state(cumulativePartial)).receipts[0];
assert.ok(permanentReceipt.grantedAt);
await create("cum-extra-purchase", cumulativePartial); await lines("cum-extra-purchase", 30); await pay("cum-extra-purchase");
await sync(cumulativePartial);
assert.deepEqual((await state(cumulativePartial)).receipts, [permanentReceipt]);
await assert.rejects(db.query("INSERT INTO kq_contest_bundle_reward_grants(order_id,user_id,required_flowers,purchased_grams,card_snapshot,rule_version,contributing_orders) SELECT 'forced-duplicate',user_id,required_flowers,purchased_grams,card_snapshot,rule_version,contributing_orders FROM kq_contest_bundle_reward_grants WHERE order_id=$1", [permanentReceipt.orderId]), /unique|duplicate/i);
await db.query("UPDATE orders SET status='cancelled' WHERE customer_id=$1", [cumulativePartial]);
assert.equal((await progressFor(cumulativePartial)).eligible, false);
assert.equal((await progressFor(cumulativePartial)).rewarded, true);
assert.deepEqual((await state(cumulativePartial)).receipts, [permanentReceipt], "refund/cancellation never recreates the already-paid gift");
passed.push("split flowers and quantities across four orders; 2.9g rejected and exact 3g credited automatically; extra orders/concurrent sync/unique constraint prevent a second gift; cancellations preserve historical reward");

const frozenProgramme = (await state()).flowers;
await db.exec("UPDATE contest_entries SET is_published=false; UPDATE contest_seasons SET is_active=false; UPDATE products SET name='Changed after snapshot',stock=0,weight_grams=99");
assert.equal((await state()).available, true);
assert.deepEqual((await state()).flowers, frozenProgramme, "unpublication, season changes, weights and stock cannot shrink the frozen programme");
assert.equal((await progressFor(cumulativeHistorical)).flowers[0].purchasedGrams, 3, "historic line weights are authoritative");
await db.exec("INSERT INTO products(id,name,category,weight_grams,price) VALUES('f3','New flower','fleurs',1,5); INSERT INTO contest_entries VALUES('new-entry','f3','current',true,'concours'); UPDATE contest_seasons SET is_active=true WHERE id='current'");
assert.deepEqual((await state()).flowers, frozenProgramme, "later additions cannot silently change the checklist");
await db.exec("UPDATE kq_contest_bundle_settings SET required_flowers='[]'");
assert.equal((await state()).available, false);
assert.equal((await progressFor(cumulativeHistorical)).eligible, false);
assert.equal((await progressFor(cumulativeHistorical)).rewarded, true);
await db.query("UPDATE kq_contest_bundle_settings SET required_flowers=$1::jsonb", [JSON.stringify(frozenProgramme)]);
passed.push("programme flowers frozen globally; publication/season/stock/catalogue weights cannot rewrite checklist; empty programme never qualifies; acquired receipt survives closure");

const reassignedCustomer = await customer();
await db.query("UPDATE orders SET customer_id=$1 WHERE id='cum-history-a'", [reassignedCustomer]);
assert.deepEqual((await progressFor(reassignedCustomer)).flowers.map(f => f.purchasedGrams), [0, 0], "a non-anchor order already credited to someone else cannot count again");
await create("cum-reassigned-own", reassignedCustomer); await line("cum-reassigned-own", "f1", 1); await line("cum-reassigned-own", "f2", 2); await pay("cum-reassigned-own");
await sync(reassignedCustomer);
assert.equal(await rewardsFor(reassignedCustomer), 0, "reassigned contributor must not complete a different customer's programme");
assert.deepEqual((await progressFor(reassignedCustomer)).flowers.map(f => f.purchasedGrams), [1, 2]);
assert.equal(await scalar("SELECT jsonb_array_length(contributing_orders) FROM kq_contest_bundle_reward_grants WHERE order_id='cum-history-b'"), 2);
passed.push("reassigning a credited non-anchor contribution cannot reuse another customer's purchase; immutable original contribution audit survives reassignment");

const cumulativeGuest = await customer("cumulative-guest@example.fr", false);
await create("cum-guest", null, " CUMULATIVE-GUEST@example.fr "); await lines("cum-guest"); await pay("cum-guest");
assert.equal((await progressFor(cumulativeGuest)).completedCount, 0);
await db.query("UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1", [cumulativeGuest]);
assert.equal((await progressFor(cumulativeGuest)).eligible, true);
assert.equal(await rewardsFor(cumulativeGuest), 0, "read-only recovery must not grant");
await sync(cumulativeGuest);
assert.equal(await rewardsFor(cumulativeGuest), 1);
const ambiguousOne = await customer("duplicate-cumulative@example.fr");
const ambiguousTwo = await customer("duplicate-cumulative@example.fr");
await create("cum-ambiguous", null, "duplicate-cumulative@example.fr"); await lines("cum-ambiguous"); await pay("cum-ambiguous");
assert.equal((await progressFor(ambiguousOne)).completedCount, 0);
assert.equal((await progressFor(ambiguousTwo)).completedCount, 0);
await sync(ambiguousOne); assert.equal(await rewardsFor(ambiguousOne), 0);
const explicitOwner = await customer();
await create("cum-linked-owner", explicitOwner, "cumulative-guest@example.fr"); await lines("cum-linked-owner"); await pay("cum-linked-owner");
assert.equal(await rewardsFor(explicitOwner), 1);
assert.equal((await progressFor(cumulativeGuest)).flowers[0].purchasedGrams, 3, "guest email must not steal an explicitly owned order");
await db.query("UPDATE auth.users SET deleted_at=now() WHERE id=$1", [ambiguousOne]);
assert.equal((await progressFor(ambiguousOne)).completedCount, 0);
passed.push("guest purchases recover only after unique confirmed ownership; ambiguous and deleted accounts excluded; explicit order owner wins over email");

const invalidCustomer = await customer();
for (const kind of ["pending", "failed", "cancelled", "archived", "review", "future-created", "future-paid"]) {
  const id = `cum-invalid-${kind}`;
  await create(id, invalidCustomer); await lines(id);
  const assignments = {
    pending: "payment_state='pending'", failed: "payment_state='failed'",
    cancelled: "payment_state='paid',paid_at=now(),status='cancelled'",
    archived: "payment_state='paid',paid_at=now(),archived_at=now()",
    review: "payment_state='paid',paid_at=now(),payment_review_required=true",
    "future-created": "payment_state='paid',paid_at=now(),created_at=now()+interval '1 day'",
    "future-paid": "payment_state='paid',paid_at=now()+interval '1 day'",
  }[kind];
  await db.query(`UPDATE orders SET ${assignments} WHERE id=$1`, [id]);
}
assert.deepEqual((await progressFor(invalidCustomer)).flowers.map(f => f.purchasedGrams), [0, 0]);
await sync(invalidCustomer); assert.equal(await rewardsFor(invalidCustomer), 0);
const invalidLines = await customer();
await create("cum-invalid-lines", invalidLines);
await line("cum-invalid-lines", "f1::3g", 3); await line("cum-invalid-lines", "f1", null);
await line("cum-invalid-lines", "f1", 3, 1, 0); await line("cum-invalid-lines", "f1", "NaN");
await line("cum-invalid-lines", "f1", 3, 0); await line("cum-invalid-lines", "f2", 3, -1);
await pay("cum-invalid-lines");
assert.deepEqual((await progressFor(invalidLines)).flowers.map(f => f.purchasedGrams), [0, 0]);
const paidBeforeLines = await customer();
await create("cum-paid-first", paidBeforeLines, null, true);
await line("cum-paid-first", "f1", 3, 1, 10, "expanded-pack");
assert.equal(await rewardsFor(paidBeforeLines), 0);
await line("cum-paid-first", "f2", 3, 1, 10, "expanded-pack");
assert.equal(await rewardsFor(paidBeforeLines), 1);
passed.push("unpaid/failed/cancelled/archived/review/future orders excluded; missing weights, variants, NaN, zero prices/quantities rejected; paid-before-lines and paid pack components complete cumulative reward");

const failureCustomer = await customer();
await create("cum-failure-a", failureCustomer); await line("cum-failure-a", "f1", 3); await pay("cum-failure-a");
await create("cum-failure-b", failureCustomer); await line("cum-failure-b", "f2", 3);
await db.exec("CREATE FUNCTION reject_cumulative_botte() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.reward_key LIKE 'contest-bundle:cum-failure-b:%' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END; $$; CREATE TRIGGER reject_cumulative_botte BEFORE INSERT ON kq_support_booster_entitlements FOR EACH ROW EXECUTE FUNCTION reject_cumulative_botte()");
await pay("cum-failure-b");
assert.equal(await scalar("SELECT payment_state FROM orders WHERE id='cum-failure-b'"), "paid");
assert.equal(await rewardsFor(failureCustomer), 0);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets WHERE user_id=$1", [failureCustomer]), 0);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_card_instances WHERE user_id=$1", [failureCustomer]), 0);
assert.equal((await progressFor(failureCustomer)).eligible, true);
await db.exec("DROP TRIGGER reject_cumulative_botte ON kq_support_booster_entitlements");
await Promise.all(Array.from({ length: 12 }, () => sync(failureCustomer)));
assert.equal(await rewardsFor(failureCustomer), 1);
assert.equal(await scalar("SELECT count(*)::int FROM lottery_tickets WHERE user_id=$1", [failureCustomer]), 3);
assert.equal(await scalar("SELECT count(*)::int FROM kq_support_booster_entitlements WHERE user_id=$1", [failureCustomer]), 5);
await db.exec("DELETE FROM orders WHERE id IN ('cum-failure-a','cum-failure-b')");
await create("cum-failure-a", failureCustomer); await lines("cum-failure-a"); await pay("cum-failure-a");
assert.equal(await rewardsFor(failureCustomer), 1);
assert.equal(await scalar("SELECT jsonb_array_length(contributing_orders) FROM kq_contest_bundle_reward_grants WHERE user_id=$1", [failureCustomer]), 2);
passed.push("three gifts and cumulative receipt roll back together without rolling back payment; queued concurrent sync requests grant once; deleted/reimported orders preserve permanent customer award and proof");

await db.exec("SET ROLE service_role");
assert.equal((await state()).progress, null);
assert.equal((await state(cumulativeHistorical)).progress.rewarded, true);
assert.equal((await sync(cumulativeHistorical)).progress.rewarded, true);
await assert.rejects(db.exec("SELECT * FROM public.kq_contest_bundle_settings"), /permission denied/);
await assert.rejects(db.exec("SELECT contributing_orders FROM public.kq_contest_bundle_reward_grants"), /permission denied/);
await assert.rejects(db.query("SELECT public.kq_contest_bundle_purchase_progress($1)", [cumulativeHistorical]), /permission denied/);
await assert.rejects(db.query("SELECT public.kq_grant_contest_bundle_customer_reward($1)", [cumulativeHistorical]), /permission denied/);
await db.exec("RESET ROLE; SET ROLE authenticated");
await assert.rejects(db.query("SELECT public.rpc_kq_sync_contest_bundle_rewards($1)", [cumulativeHistorical]), /permission denied/);
await db.exec("RESET ROLE; SET ROLE anon");
await assert.rejects(db.exec("SELECT public.rpc_kq_get_contest_bundle_rewards(NULL)"), /permission denied/);
await db.exec("RESET ROLE");
passed.push("cumulative proof/settings/attribution helpers remain private; service_role only read/sync; anonymous/authenticated direct RPC access denied");

console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
await db.close();
