// Local products migration regression checks. The original reward RPC executes
// unchanged; unrelated accounting initialization/posting are explicit fixtures.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite(), checks = [];
const scalar = async (sql, values = []) => Object.values((await db.query(sql, values)).rows[0])[0];
const check = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks.push(label); };
const products = (user, command = null) => scalar("SELECT rpc_kq_school_products($1,$2::jsonb)", [user, command ? JSON.stringify(command) : null]);
const school = (user, command = null, grading = null) => scalar("SELECT rpc_kq_school($1,$2::jsonb,$3::jsonb)", [user, command ? JSON.stringify(command) : null, grading ? JSON.stringify(grading) : null]);
const command = (quiz = "profiles", version = "2026-11-11.1", key = randomUUID()) => ({ action: "submit", quizId: quiz, contentVersion: version, requestKey: key,
  answers: Array.from({ length: 10 }, (_, index) => ({ questionId: `${quiz}-q${index + 1}`, optionId: "a" })) });
const grade = score => ({ score, corrections: Array.from({ length: 10 }, (_, index) => ({ questionId: `q${index + 1}`, isCorrect: index < score })) });
const progress = (overrides = {}) => ({ lessonIds: [], checkpointIds: [], activityIds: [], ...overrides });
const chapters = ["seeds", "fibres", "materials", "resins", "labels", "food", "exposure", "quality", "origins", "traceability"];
const financialState = user => scalar(`SELECT jsonb_build_object('wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
  'rewards',(SELECT jsonb_agg(to_jsonb(p) ORDER BY reward_id) FROM kq_school_quiz_progress p WHERE user_id=$1),
  'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_school_receipts r WHERE user_id=$1),
  'legacy',(SELECT to_jsonb(p) FROM kq_school_progress p WHERE user_id=$1),
  'commerce',(SELECT to_jsonb(c) FROM kq_commerce_accounts c WHERE user_id=$1))`, [user]);

try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER DEFAULT 100000,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision BIGINT DEFAULT 0);
    CREATE FUNCTION kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS $$ SELECT; $$;
    CREATE FUNCTION kq_treasury_pair(UUID,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,BIGINT,TEXT DEFAULT NULL) RETURNS VOID LANGUAGE sql AS $$ SELECT; $$;`);
  await db.exec(await readFile("supabase/migrations/20261111000400_kq_school.sql", "utf8"));
  const owner = randomUUID(), other = randomUUID();
  for (const user of [owner, other]) {
    await db.query("INSERT INTO auth.users VALUES($1)", [user]);
    await db.query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [user]);
    await db.query("INSERT INTO kq_commerce_accounts(user_id) VALUES($1)", [user]);
  }
  await db.exec(await readFile("supabase/migrations/20261112000100_kq_school_history_progress.sql", "utf8"));
  const historyState = await scalar("SELECT rpc_kq_school_history($1,$2::jsonb)", [owner, JSON.stringify(progress({ lessonIds: ["history-evidence-1"], resumeLessonId: "history-evidence-2", expectedRevision: 0 }))]);
  await db.exec(await readFile("supabase/migrations/20261112000200_kq_school_botany_progress.sql", "utf8"));
  const botanyState = await scalar("SELECT rpc_kq_school_botany($1,$2::jsonb)", [owner, JSON.stringify(progress({ lessonIds: ["botany-anatomy-1"], resumeLessonId: "botany-anatomy-2", expectedRevision: 0 }))]);
  await db.exec(await readFile("supabase/migrations/20261112000300_kq_school_terpenes_progress.sql", "utf8"));
  const terpenesState = await scalar("SELECT rpc_kq_school_terpenes($1,$2::jsonb)", [owner, JSON.stringify(progress({ lessonIds: ["terpenes-vocabulary-1"], resumeLessonId: "terpenes-vocabulary-2", expectedRevision: 0 }))]);
  await db.exec(await readFile("supabase/migrations/20261112000400_kq_school_cannabinoids_progress.sql", "utf8"));
  const cannabinoidsState = await scalar("SELECT rpc_kq_school_cannabinoids($1,$2::jsonb)", [owner, JSON.stringify(progress({ lessonIds: ["cannabinoids-origins-1"], resumeLessonId: "cannabinoids-origins-2", expectedRevision: 0 }))]);
  await db.exec(await readFile("supabase/migrations/20261112000500_kq_school_cultivation_progress.sql", "utf8"));
  const cultivationState = await scalar("SELECT rpc_kq_school_cultivation($1,$2::jsonb)", [owner, JSON.stringify(progress({ lessonIds: ["cultivation-axes-1"], resumeLessonId: "cultivation-axes-2", expectedRevision: 0 }))]);
  await db.exec(await readFile("supabase/migrations/20261112000600_kq_school_health_progress.sql", "utf8"));
  const healthState = await scalar("SELECT rpc_kq_school_health($1,$2::jsonb)", [owner, JSON.stringify(progress({ lessonIds: ["health-observation-1"], resumeLessonId: "health-observation-2", expectedRevision: 0 }))]);
  await db.exec(await readFile("supabase/migrations/20261112000700_kq_school_soil_progress.sql", "utf8"));
  const soilState = await scalar("SELECT rpc_kq_school_soil($1,$2::jsonb)", [owner, JSON.stringify(progress({ lessonIds: ["soil-physical-1"], resumeLessonId: "soil-physical-2", expectedRevision: 0 }))]);
  const legacyAttempt = command();
  const legacyReceipt = await school(owner, legacyAttempt, grade(7));
  await school(owner, { action: "progress", lessonIds: ["profiles"], workshopIds: [] });
  const original = await financialState(owner);
  const financialDefinition = await scalar("SELECT pg_get_functiondef('rpc_kq_school(uuid,jsonb,jsonb)'::regprocedure)");
  await db.exec(await readFile("supabase/migrations/20261112000800_kq_school_products_progress.sql", "utf8"));
  check("products migration preserves existing Soil progress", await scalar("SELECT rpc_kq_school_soil($1)", [owner]), soilState);
  check("products migration preserves existing Health progress", await scalar("SELECT rpc_kq_school_health($1)", [owner]), healthState);
  check("products migration preserves existing Cultivation progress", await scalar("SELECT rpc_kq_school_cultivation($1)", [owner]), cultivationState);
  check("products migration preserves existing Cannabinoids progress", await scalar("SELECT rpc_kq_school_cannabinoids($1)", [owner]), cannabinoidsState);
  check("products migration preserves existing Terpenes progress", await scalar("SELECT rpc_kq_school_terpenes($1)", [owner]), terpenesState);
  check("products migration preserves existing Botany progress", await scalar("SELECT rpc_kq_school_botany($1)", [owner]), botanyState);
  check("products migration preserves existing History progress", await scalar("SELECT rpc_kq_school_history($1)", [owner]), historyState);
  check("products migration preserves every financial byte", await financialState(owner), original);
  check("products migration never rewrites the reward function", await scalar("SELECT pg_get_functiondef('rpc_kq_school(uuid,jsonb,jsonb)'::regprocedure)"), financialDefinition);
  let view = await products(owner);
  check("legacy products completion never completes the new 20 lessons", [view.lessonIds, view.checkpointIds, view.activityIds, view.resumeLessonId, view.revision], [[], [], [], null, 0]);
  check("read does not create a progress row", await scalar("SELECT count(*) FROM kq_school_products_progress"), 0);
  check("receipt survives editorial migration exactly", (await school(owner, legacyAttempt, null)).result, legacyReceipt.result);
  view = await products(owner, progress({ lessonIds: ["products-seeds-1"], activityIds: ["products-seeds-activity-1"], resumeLessonId: "products-seeds-2", expectedRevision: 0 }));
  check("first useful learning step is saved", [view.lessonIds, view.activityIds, view.resumeLessonId, view.revision, view.resumeConflict], [["products-seeds-1"], ["products-seeds-activity-1"], "products-seeds-2", 1, false]);
  const firstView = view;
  check("exact retry leaves revision and updatedAt unchanged", await products(owner, progress({ lessonIds: ["products-seeds-1"], activityIds: ["products-seeds-activity-1"], resumeLessonId: "products-seeds-2", expectedRevision: 0 })), firstView);
  view = await products(owner, progress({ lessonIds: ["products-fibres-1"], checkpointIds: ["products-seeds-checkpoint"], resumeLessonId: "products-fibres-2", expectedRevision: 0 }));
  check("stale tab merges completion but cannot move reading position backwards", [view.lessonIds, view.checkpointIds, view.resumeLessonId, view.revision, view.resumeConflict],
    [["products-fibres-1", "products-seeds-1"], ["products-seeds-checkpoint"], "products-seeds-2", 2, true]);
  view = await products(owner, progress({ resumeLessonId: "products-fibres-2", expectedRevision: 2 }));
  check("latest revision may deliberately update position", [view.resumeLessonId, view.revision, view.resumeConflict], ["products-fibres-2", 3, false]);
  view = await products(owner, progress());
  check("an empty batch never deletes completions or position", [view.lessonIds.length, view.resumeLessonId, view.revision], [2, "products-fibres-2", 3]);
  check("different player has independent progress", (await products(other)).lessonIds, []);
  check("learning operations never touch money or old progress", await financialState(owner), original);
  const beforeInvalid = await products(owner);
  for (const [label, invalid] of [
    ["old products id", progress({ lessonIds: ["profiles"] })], ["invented lesson", progress({ lessonIds: ["products-fake-1"] })],
    ["invented activity", progress({ activityIds: ["products-seeds-activity-3"] })], ["invalid checkpoint", progress({ checkpointIds: ["products-seeds-1"] })],
    ["soil lesson rejected", progress({ lessonIds: ["soil-physical-1"] })],
    ["health lesson rejected", progress({ lessonIds: ["health-observation-1"] })],
    ["cultivation lesson rejected", progress({ lessonIds: ["cultivation-axes-1"] })],
    ["cannabinoids lesson rejected", progress({ lessonIds: ["cannabinoids-origins-1"] })],
    ["terpenes lesson rejected", progress({ lessonIds: ["terpenes-vocabulary-1"] })],
    ["botany lesson rejected", progress({ lessonIds: ["botany-anatomy-1"] })],
    ["other course lesson", progress({ lessonIds: ["history-evidence-1"] })],
    ["unknown money field", { ...progress(), gainCents: 1000 }], ["missing expected revision", progress({ resumeLessonId: "products-seeds-1" })],
    ["negative expected revision", progress({ resumeLessonId: null, expectedRevision: -1 })], ["oversized batch", progress({ lessonIds: Array(21).fill("products-seeds-1") })],
    ["invalid value type", progress({ activityIds: [null] })], ["revision without position", progress({ expectedRevision: 3 })]
  ]) {
    await assert.rejects(() => products(owner, invalid), /school_products_invalid/, label);
    check(`${label} rolls back all learning data`, await products(owner), beforeInvalid);
  }
  view = await products(owner, progress({ lessonIds: chapters.flatMap(id => [`products-${id}-1`, `products-${id}-2`]),
    checkpointIds: chapters.map(id => `products-${id}-checkpoint`), activityIds: chapters.flatMap(id => [`products-${id}-activity-1`, `products-${id}-activity-2`]) }));
  check("all real learning IDs fit the whitelist", [view.lessonIds.length, view.checkpointIds.length, view.activityIds.length], [20, 10, 20]);
  check("full learning completion still pays nothing", await financialState(owner), original);
  check("products learning never changes Soil", await scalar("SELECT rpc_kq_school_soil($1)", [owner]), soilState);
  check("products learning never changes Health", await scalar("SELECT rpc_kq_school_health($1)", [owner]), healthState);
  check("products learning never changes Cultivation", await scalar("SELECT rpc_kq_school_cultivation($1)", [owner]), cultivationState);
  check("products learning never changes Cannabinoids", await scalar("SELECT rpc_kq_school_cannabinoids($1)", [owner]), cannabinoidsState);
  check("products learning never changes Terpenes", await scalar("SELECT rpc_kq_school_terpenes($1)", [owner]), terpenesState);
  check("products learning never changes Botany", await scalar("SELECT rpc_kq_school_botany($1)", [owner]), botanyState);
  check("products learning never changes History", await scalar("SELECT rpc_kq_school_history($1)", [owner]), historyState);
  const newAttempt = command("profiles", "2026-11-12.products1");
  const improvement = await school(owner, newAttempt, grade(9));
  check("new synthesis retains old products reward identity and pays only its complement", [improvement.result.gainCents, improvement.result.paidCents, improvement.snapshot.totalPaidCents], [200, 900, 900]);
  const perfect = await school(owner, command("profiles", "2026-11-12.products1"), grade(10));
  check("new synthesis cannot reopen the 10 euro products budget", [perfect.result.gainCents, perfect.result.paidCents, perfect.result.remainingCents], [100, 1000, 0]);
  check("new synthesis repeated perfect score pays zero", (await school(owner, command("profiles", "2026-11-12.products1"), grade(10))).result.gainCents, 0);
  check("old immutable receipt still replays after later improvements", (await school(owner, legacyAttempt, null)).result, legacyReceipt.result);
  check("other nine quizzes retain their own budget", (await school(owner, command("law"), grade(7))).result.gainCents, 700);
  check("total school configured cap remains 100 euros", (await school(owner)).totalBudgetCents, 10000);
  const paidBeforeReplay = await financialState(owner);
  check("new receipt retry is idempotent", (await school(owner, newAttempt, null)).result, improvement.result);
  check("retry changes no reward state", await financialState(owner), paidBeforeReplay);
  await assert.rejects(() => school(owner, command("profiles", "2026-11-12.products1"), null), /school_version/);
  check("ungraded or invalid-selection new attempt earns nothing", await financialState(owner), paidBeforeReplay);
  check("products score six pays nothing", (await school(other, command("profiles", "2026-11-12.products1"), grade(6))).result.gainCents, 0);
  const threshold = command("profiles", "2026-11-12.products1");
  check("products score seven reaches the existing threshold", (await school(other, threshold, grade(7))).result.gainCents, 700);
  const afterThreshold = await financialState(other);
  await school(other, threshold, null);
  check("products threshold retry never credits twice", await financialState(other), afterThreshold);
  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`${role} has no table privilege`, await scalar("SELECT has_table_privilege($1,'kq_school_products_progress','SELECT,INSERT,UPDATE,DELETE')", [role]), false);
    check(`${role} RPC privilege`, await scalar("SELECT has_function_privilege($1,'rpc_kq_school_products(uuid,jsonb)','EXECUTE')", [role]), role === "service_role");
    check(`${role} cannot execute private snapshot helper`, await scalar("SELECT has_function_privilege($1,'kq_school_products_snapshot(uuid)','EXECUTE')", [role]), false);
  }
  check("new table RLS enabled", await scalar("SELECT relrowsecurity FROM pg_class WHERE oid='kq_school_products_progress'::regclass"), true);
  console.log(`PASS: ${checks.length} products SQL checks; existing rewards and receipts preserved; local PGlite only.`);
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, position: error.position, where: error.where, actual: error.actual, expected: error.expected }));
  process.exitCode = 1;
} finally { await db.close(); }
