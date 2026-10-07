// Isolated PostgreSQL integration checks: no credentials or remote writes.
// PGlite has one backend: bursts exercise replay/uniqueness, not a claim of
// measuring contention between separate production PostgreSQL connections.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const migration = name => readFile(`supabase/migrations/${name}`, "utf8");
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const one = async (sql, args = []) => (await query(sql, args))[0];
const value = async (sql, args = []) => (await one(`SELECT ${sql} AS value`, args)).value;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const rejects = async (operation, message) => {
  await assert.rejects(operation, error => error.message.includes(message)); checks++;
};
const user = randomUUID(), other = randomUUID(), historical = randomUUID();
const card = randomUUID(), otherCard = randomUUID();
const submit = (missionId, options = {}) => {
  const owner = options.owner ?? user;
  return value("rpc_submit_social_mission($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
    owner, missionId, options.key ?? randomUUID(), options.url === undefined ? "https://example.org/fleur" : options.url,
    options.text ?? "Ma championne", options.path === undefined ? `${owner}/${randomUUID()}.png` : options.path,
    options.mime === undefined ? "image/png" : options.mime, options.size === undefined ? 1200 : options.size,
    options.submissionId ?? null, options.revision ?? null,
  ]);
};
const review = (id, options = {}) => value("rpc_review_social_mission($1,$2,$3,$4,$5,$6)", [
  id, options.revision ?? 1, options.decision ?? "approved", options.actor ?? "admin@example.org",
  options.key ?? randomUUID(), options.note ?? null,
]);
const create = async (type, amount = 1, options = {}) => {
  const row = await one(`INSERT INTO social_missions(slug,title,description,reward_type,reward_amount,reward_card_id,
    max_completions_per_user,is_active,requires_proof) VALUES($1,$2,'Description',$3,$4,$5,$6,$7,$8) RETURNING id`,
  [randomUUID(), options.title ?? "Défi original", type, amount, options.cardId ?? (type === "buddies" ? card : null),
    options.limit ?? 1, options.active ?? true, options.proof ?? true]);
  return row.id;
};
const row = id => one("SELECT * FROM social_mission_submissions WHERE id=$1", [id]);
const counts = async owner => ({
  tickets: await value("(SELECT count(*)::INT FROM lottery_tickets WHERE user_id=$1)", [owner]),
  packs: await value("(SELECT count(*)::INT FROM kq_support_booster_entitlements WHERE user_id=$1)", [owner]),
  cards: await value("(SELECT count(*)::INT FROM lottery_card_instances WHERE user_id=$1)", [owner]),
  points: await value("(SELECT loyalty_points FROM profiles WHERE id=$1)", [owner]),
  cash: await value("(SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1)", [owner]),
  rewards: await value("(SELECT count(*)::INT FROM social_mission_reward_receipts WHERE user_id=$1)", [owner]),
  journals: await value("(SELECT count(*)::INT FROM kq_treasury_journal WHERE user_id=$1)", [owner]),
});

try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE orders(id TEXT PRIMARY KEY);
    CREATE TABLE profiles(id UUID PRIMARY KEY REFERENCES auth.users(id),loyalty_points INTEGER NOT NULL DEFAULT 0);
    CREATE TYPE lottery_ticket_status AS ENUM ('available','scratched');
    CREATE TYPE lottery_sticker_rarity AS ENUM ('common','rare','epic','legendary');
    CREATE TYPE lottery_card_rarity AS ENUM ('common','silver','gold','epic','legendary');`);
  const lottery = await migration("20260228000800_lottery_dynamic_rewards.sql");
  await db.exec(lottery.slice(lottery.indexOf("CREATE TABLE public.lottery_ticket_counter"), lottery.indexOf("CREATE TABLE public.lottery_reward_lines")));
  await db.exec(`CREATE TABLE lottery_audit_log(id BIGSERIAL PRIMARY KEY,event_type TEXT NOT NULL,user_id UUID,details JSONB);
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  const issuer = lottery.indexOf("CREATE OR REPLACE FUNCTION public.rpc_admin_grant_lottery_tickets");
  await db.exec(lottery.slice(issuer, lottery.indexOf("CREATE OR REPLACE FUNCTION public.rpc_scratch_ticket", issuer)));
  const collection = await migration("20260228001200_lottery_tcg_collection.sql");
  await db.exec(collection.slice(collection.indexOf("CREATE TABLE IF NOT EXISTS public.lottery_card_collections"), collection.indexOf("ALTER TABLE public.lottery_tickets")));
  await db.exec(`ALTER TABLE lottery_card_instances ALTER COLUMN ticket_id DROP NOT NULL;
    ALTER TABLE lottery_card_instances ADD COLUMN pack_slot INTEGER CHECK(pack_slot BETWEEN 1 AND 13),
      ADD COLUMN kq_support_entitlement_id UUID, ADD COLUMN source_bot_battle_id UUID,
      ADD COLUMN pioneer_grant_id UUID, ADD COLUMN producer_purchase_buddie_grant_id UUID;
    ALTER TABLE lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required CHECK(
      ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL
      OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL);`);
  const foundation = await migration("20260722000100_kanab_quest_game_foundation.sql");
  await db.exec(foundation.slice(foundation.indexOf("CREATE TABLE IF NOT EXISTS public.kq_support_booster_entitlements"), foundation.indexOf("ALTER TABLE public.lottery_card_instances ALTER COLUMN ticket_id")));
  await db.exec(`ALTER TABLE kq_support_booster_entitlements RENAME CONSTRAINT kq_support_booster_entitlements_check TO kq_support_booster_entitlements_source_shape_check;
    ALTER TABLE kq_support_booster_entitlements ADD COLUMN card_count INTEGER NOT NULL DEFAULT 3 CHECK(card_count IN (3,10));`);
  const missions = await migration("20260913000500_kq_mission_center.sql");
  await db.exec(missions.slice(0, missions.indexOf("-- Permanent account milestones")) + "COMMIT;");
  const equipment = await migration("20260830000100_kq_durable_equipment_shop.sql");
  await db.exec(equipment.slice(equipment.indexOf("CREATE TABLE IF NOT EXISTS public.kq_equipment_wallets"), equipment.indexOf("CREATE TABLE IF NOT EXISTS public.kq_player_equipment")));
  const treasury = await migration("20260921000200_kq_treasury_accounting.sql");
  await db.exec(treasury.slice(0, treasury.indexOf("-- Actual production cost only")) + "COMMIT;");
  // The opening fixture has no assets/debts. Real journal/pair/observer routines
  // below still validate balanced accounting, the cash observer and rollback.
  await db.exec(`CREATE FUNCTION kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
    BEGIN INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING; END $$;
    CREATE FUNCTION kq_treasury_queue(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END $$;`);
  const processing = await migration("20260927000600_kq_shared_processing_workshop.sql");
  const observer = processing.indexOf("CREATE OR REPLACE FUNCTION public.kq_treasury_observe()");
  await db.exec(processing.slice(observer, processing.indexOf("END $$;", observer) + 7));
  await db.exec(`CREATE TRIGGER test_wallet_observer AFTER INSERT OR UPDATE OF cash_cents ON kq_equipment_wallets
    FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();`);
  await db.exec(await migration("20260302001000_social_missions.sql"));
  await db.exec(`ALTER TABLE social_mission_submissions ADD COLUMN proof_storage_path TEXT,ADD COLUMN proof_content_type TEXT,
    ADD COLUMN proof_file_size INTEGER,ADD COLUMN proof_uploaded_at TIMESTAMPTZ;
    GRANT SELECT,INSERT,UPDATE ON social_missions,social_mission_submissions TO service_role;
    GRANT SELECT,INSERT,UPDATE ON social_mission_submissions TO authenticated;`);
  for (const owner of [user, other, historical]) {
    await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
    await db.query("INSERT INTO profiles(id) VALUES($1)", [owner]);
    await db.query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [owner]);
  }
  const buddyCollection = (await one("INSERT INTO lottery_card_collections(code,title) VALUES('HEMP_HEROES_2026','Buddies') RETURNING id")).id;
  const supportCollection = (await one("INSERT INTO lottery_card_collections(code,title) VALUES('BOTTE_DU_CHANVRIER_2026','Botte du Chanvrier') RETURNING id")).id;
  await db.query(`INSERT INTO lottery_card_definitions(id,collection_id,code,card_number,name,rarity)
    VALUES($1,$2,'BUDDY-001',1,'Buddy promis','silver'),($3,$2,'BUDDY-002',2,'Autre Buddy','gold')`, [card, buddyCollection, otherCard]);
  const legacyMission = (await one("INSERT INTO social_missions(slug,title,description,reward_type,reward_amount,max_completions_per_user) VALUES('legacy','Ancienne','Ancienne','points',5,1) RETURNING id")).id;
  const legacyApproved = (await one("INSERT INTO social_mission_submissions(user_id,mission_id,status,reward_granted) VALUES($1,$2,'approved',false) RETURNING id", [historical, legacyMission])).id;
  const legacyWithoutProof = (await one("INSERT INTO social_mission_submissions(user_id,mission_id) VALUES($1,$2) RETURNING id", [user, legacyMission])).id;
  const duplicates = [];
  for (let i = 0; i < 2; i++) duplicates.push((await one("INSERT INTO social_mission_submissions(user_id,mission_id) VALUES($1,$2) RETURNING id", [other, legacyMission])).id);
  await db.exec(await migration("20260928000200_kq_community_mission_review.sql"));
  check((await row(legacyApproved)).status === "approved" && !(await row(legacyApproved)).reward_granted, "historical approval remains unchanged");
  check(await value("(SELECT count(*)::INT FROM social_mission_submissions WHERE user_id=$1)", [other]) === 2, "historical duplicate dossiers preserved");
  check((await one("SELECT is_active,reward_type,reward_amount FROM social_missions WHERE slug='fleur-en-arene'")).is_active === false, "starter mission remains an unpublished draft");
  await rejects(() => review(legacyApproved), "mission_already_reviewed");
  await rejects(() => submit(legacyMission, { owner: historical }), "mission_completion_limit");
  await rejects(() => submit(legacyMission, { owner: other }), "mission_already_pending");
  await review(duplicates[0]);
  await rejects(() => review(duplicates[1]), "mission_completion_limit");
  await review(duplicates[1], { decision: "rejected", note: "Dossier déjà validé." });
  check((await counts(other)).points === 5, "duplicate legacy dossiers cannot exceed the reward limit");
  await review(legacyWithoutProof, { decision: "changes_requested", note: "La capture est manquante." });
  await rejects(() => submit(legacyMission, { submissionId: legacyWithoutProof, revision: 1, path: null, mime: null, size: null }), "mission_proof_required");

  const cashMission = await create("game_cash", 12000);
  const firstKey = randomUUID();
  const first = await submit(cashMission, { key: firstKey });
  check(first.submission.revision === 1 && first.submission.reward_amount_snapshot === 12000, "new submission freezes its reward");
  const duplicate = await submit(cashMission, { key: firstKey });
  check(duplicate.replayed && duplicate.submission.id === first.submission.id, "HTTP replay tolerates a freshly uploaded path without replacing proof");
  await rejects(() => submit(cashMission, { key: firstKey, text: "Autre texte" }), "mission_request_key_reused");
  await rejects(() => submit(cashMission, { key: firstKey, owner: other }), "mission_request_key_reused");
  await rejects(() => submit(cashMission), "mission_already_pending");
  await rejects(() => review(first.submission.id, { decision: "rejected" }), "mission_note_required");
  await rejects(() => review(first.submission.id, { decision: "changes_requested" }), "mission_note_required");
  const changesKey = randomUUID();
  await review(first.submission.id, { decision: "changes_requested", note: "Montre le nom de la Fleur.", key: changesKey });
  check((await counts(user)).cash === 35000, "correction request does not credit the wallet");
  await db.query("UPDATE social_missions SET reward_amount=100,title='Nouveau titre',is_active=false,requires_proof=false WHERE id=$1", [cashMission]);
  await rejects(() => submit(cashMission, { owner: other }), "mission_inactive");
  await rejects(() => submit(cashMission, { submissionId: first.submission.id, revision: 2 }), "mission_stale_revision");
  await rejects(() => submit(cashMission, { submissionId: first.submission.id, revision: 1, owner: other }), "mission_submission_not_found");
  const corrected = await submit(cashMission, { submissionId: first.submission.id, revision: 1, url: null });
  check(corrected.submission.revision === 2 && corrected.submission.status === "pending", "inactive mission accepts requested correction and a screenshot without URL");
  check(corrected.submission.reward_amount_snapshot === 12000 && corrected.submission.mission_title_snapshot === "Défi original", "editing the mission does not rewrite the promise");
  await rejects(() => review(first.submission.id), "mission_stale_revision");
  check((await review(first.submission.id, { decision: "changes_requested", note: "Montre le nom de la Fleur.", key: changesKey })).replayed, "old review retry replays without modifying corrected evidence");
  const approveKey = randomUUID();
  const approval = await review(first.submission.id, { revision: 2, key: approveKey });
  check(approval.submission.reward_granted && approval.reward.amount === 12000, "approval atomically credits the promised amount");
  const burst = await Promise.all(Array.from({ length: 12 }, () => review(first.submission.id, { revision: 2, key: approveKey })));
  check(burst.every(result => result.replayed), "duplicate approval burst replays one result");
  check((await counts(user)).cash === 47000 && (await counts(user)).rewards === 1, "exactly one wallet credit and receipt");
  const accounting = await query("SELECT account,balance_cents FROM kq_treasury_balances WHERE user_id=$1 ORDER BY account", [user]);
  check(Number(accounting.find(entry => entry.account === "cash").balance_cents) === 12000 && Number(accounting.find(entry => entry.account === "revenue_rewards").balance_cents) === -12000 && Number(accounting.find(entry => entry.account === "suspense").balance_cents) === 0, "cash movement and reward classification balance without suspense");
  await rejects(() => review(first.submission.id, { revision: 2 }), "mission_already_reviewed");
  await rejects(() => review(first.submission.id, { revision: 2, key: approveKey, decision: "rejected", note: "Autre décision" }), "mission_request_key_reused");
  check(await value("(SELECT count(*)::INT FROM social_mission_request_receipts WHERE submission_id=$1)", [first.submission.id]) === 4, "audit preserves original evidence, correction request, corrected evidence and final approval");

  const linkMission = await create("points");
  const linkSubmission = await submit(linkMission);
  await review(linkSubmission.submission.id, { decision: "changes_requested", note: "Corrige le lien uniquement." });
  const linkCorrection = await submit(linkMission, { submissionId: linkSubmission.submission.id, revision: 1,
    path: null, mime: null, size: null, url: "https://example.org/lien-corrige" });
  check(linkCorrection.submission.proof_storage_path === linkSubmission.submission.proof_storage_path &&
    linkCorrection.submission.proof_uploaded_at === linkSubmission.submission.proof_uploaded_at &&
    linkCorrection.submission.proof_content_type === "image/png" && linkCorrection.submission.proof_file_size === 1200,
  "link-only correction preserves the same private screenshot and upload metadata");

  for (const [type, amount, field, delta] of [["packs", 2, "tickets", 2], ["points", 23, "points", 23], ["support_pack", 2, "packs", 2], ["buddies", 1, "cards", 1]]) {
    const missionId = await create(type, amount);
    const submitted = await submit(missionId);
    if (type === "buddies") await db.query("UPDATE social_missions SET reward_card_id=$2 WHERE id=$1", [missionId, otherCard]);
    const before = await counts(user);
    const key = randomUUID();
    const granted = await review(submitted.submission.id, { key });
    await review(submitted.submission.id, { key });
    check((await counts(user))[field] === before[field] + delta, `${type} grants exactly once`);
    if (type === "support_pack") check((await query("SELECT card_count FROM kq_support_booster_entitlements WHERE id=ANY($1::UUID[])", [granted.reward.entitlementIds])).every(item => item.card_count === 3), "each Botte du Chanvrier pack contains three cards");
    if (type === "buddies") check((await one("SELECT card_definition_id FROM lottery_card_instances WHERE id=$1", [granted.reward.cardInstanceId])).card_definition_id === card, "fixed Buddy uses the deposited snapshot, not the edited catalogue");
  }

  // Fail AFTER a native issuer / wallet mutation. A review failure must undo
  // all rewards, counters, journal entries, status changes and request receipts.
  await db.exec(`CREATE FUNCTION test_reject_approval() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.status='approved' THEN RAISE EXCEPTION 'injected_review_failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_reject_approval BEFORE UPDATE ON social_mission_submissions FOR EACH ROW EXECUTE FUNCTION test_reject_approval();`);
  for (const type of ["packs", "points", "support_pack", "buddies", "game_cash"]) {
    const missionId = await create(type, type === "game_cash" ? 700 : 1);
    const submitted = await submit(missionId);
    const before = await counts(user);
    const key = randomUUID();
    await rejects(() => review(submitted.submission.id, { key }), "injected_review_failure");
    assert.deepEqual(await counts(user), before); checks++;
    check((await row(submitted.submission.id)).status === "pending" && !(await row(submitted.submission.id)).reward_granted, `${type} failed review leaves dossier pending`);
    check(!await value("EXISTS(SELECT 1 FROM social_mission_request_receipts WHERE request_key=$1)", [key]), `${type} failed review leaves no success receipt`);
  }
  await db.exec("DROP TRIGGER test_reject_approval ON social_mission_submissions");

  const bounded = await create("points", 2, { limit: 2 });
  const pendingBurst = await Promise.allSettled(Array.from({ length: 8 }, () => submit(bounded)));
  check(pendingBurst.filter(result => result.status === "fulfilled").length === 1, "different concurrent request keys still produce one active dossier");
  const current = pendingBurst.find(result => result.status === "fulfilled").value.submission;
  const opposing = await Promise.allSettled([review(current.id), review(current.id, { decision: "rejected", note: "Autre examen" })]);
  check(opposing.filter(result => result.status === "fulfilled").length === 1, "opposing decisions cannot both succeed");
  await review((await submit(bounded)).submission.id);
  await rejects(() => submit(bounded), "mission_completion_limit");
  const missingProfileMission = await create("points");
  const withoutProfile = randomUUID(); await db.query("INSERT INTO auth.users VALUES($1)", [withoutProfile]);
  const missingProfile = await submit(missingProfileMission, { owner: withoutProfile });
  await rejects(() => review(missingProfile.submission.id), "mission_profile_missing");
  check(!(await row(missingProfile.submission.id)).reward_granted, "missing profile cannot falsely mark loyalty reward paid");
  const overflow = await submit(await create("game_cash", 1000), { owner: other });
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=2147483640 WHERE user_id=$1", [other]);
  await rejects(() => review(overflow.submission.id), "mission_wallet_limit");
  const inactivePack = await submit(await create("support_pack"));
  await db.query("UPDATE lottery_card_collections SET is_active=false WHERE id=$1", [supportCollection]);
  await rejects(() => review(inactivePack.submission.id), "mission_collection_inactive");
  const inactiveBuddy = await submit(await create("buddies"));
  await db.query("UPDATE lottery_card_definitions SET is_active=false WHERE id=$1", [card]);
  await rejects(() => review(inactiveBuddy.submission.id), "mission_buddy_unavailable");

  const proofMission = await create("points");
  for (const options of [{ url: "javascript:alert(1)" }, { url: "http://example.org" }, { path: `${other}/${randomUUID()}.png` }, { mime: "image/svg+xml" }, { size: 8388609 }, { size: 0 }])
    await rejects(() => submit(proofMission, options), "mission_invalid_proof");
  await rejects(() => submit(proofMission, { path: null, mime: null, size: null }), "mission_proof_required");
  for (const [type, amount] of [["packs", 21], ["support_pack", 6], ["buddies", 2], ["points", 1001], ["game_cash", 100001]])
    await rejects(() => create(type, amount), "social_missions_reward_budget_check");
  await rejects(() => create("points", 1, { limit: 21 }), "social_missions_completion_budget_check");

  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["social_mission_request_receipts", "social_mission_reward_receipts"])
      check(!await value("has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, table]), `${role} cannot read or mutate private ${table}`);
    check(!await value("has_table_privilege($1,'social_mission_submissions','INSERT,UPDATE,DELETE')", [role]), `${role} cannot bypass submission RPCs`);
    for (const fn of ["rpc_submit_social_mission(uuid,uuid,uuid,text,text,text,text,integer,uuid,integer)", "rpc_review_social_mission(uuid,integer,text,text,uuid,text)"])
      check(await value("has_function_privilege($1,$2,'EXECUTE')", [role, fn]) === (role === "service_role"), `${role} RPC execute permissions are explicit`);
  }
  check(await value("has_table_privilege('service_role','social_mission_submissions','SELECT')"), "server can render its authorized submissions");
  console.log(`Community missions: ${checks} PostgreSQL checks passed (isolated PGlite).`);
} finally {
  await db.close();
}
