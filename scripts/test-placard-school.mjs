// Full school migration in local PostgreSQL/WASM, with the real treasury posting
// and wallet observer. Only unrelated opening assets and deferred refresh are
// fixture boundaries. PGlite serializes requests on one connection; simultaneous
// promises below test retries/interleavings, not multi-connection lock contention.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const scalar = async (sql, values = []) => Object.values((await db.query(sql, values)).rows[0])[0];
const rpc = (userId, command = null, grading = null) => scalar("SELECT public.rpc_kq_school($1,$2::jsonb,$3::jsonb)", [userId, command ? JSON.stringify(command) : null, grading ? JSON.stringify(grading) : null]);
const command = (quizId = "plant", key = randomUUID(), version = "2026-11-11.1") => ({ action: "submit", quizId, requestKey: key, contentVersion: version,
  answers: Array.from({ length: 10 }, (_, index) => ({ questionId: `${quizId}-q${String(index + 1).padStart(2, "0")}`, optionId: "a" })) });
const grading = score => ({ score, corrections: Array.from({ length: 10 }, (_, index) => ({ questionId: `q${index}`, isCorrect: index < score })) });
const player = async (cash = 100000) => {
  const id = randomUUID();
  await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
  await db.query("INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,$2)", [id, cash]);
  await db.query("INSERT INTO kq_commerce_accounts(user_id) VALUES($1)", [id]);
  return id;
};
const persisted = user => scalar(`SELECT jsonb_build_object(
  'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
  'progress',(SELECT to_jsonb(p) FROM kq_school_progress p WHERE user_id=$1),
  'quizzes',(SELECT jsonb_agg(to_jsonb(p) ORDER BY reward_id) FROM kq_school_quiz_progress p WHERE user_id=$1),
  'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_school_receipts r WHERE user_id=$1),
  'journal',(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM kq_treasury_journal j WHERE user_id=$1),
  'balances',(SELECT jsonb_agg(to_jsonb(b) ORDER BY account) FROM kq_treasury_balances b WHERE user_id=$1),
  'commerce',(SELECT to_jsonb(c) FROM kq_commerce_accounts c WHERE user_id=$1))`, [user]);
async function rejectUnchanged(name, owner, action, pattern) {
  const before = await persisted(owner);
  await assert.rejects(action, pattern, name);
  check(`${name}: rollback`, await persisted(owner), before);
}
const extract = (source, first, end) => {
  const start = source.indexOf(first), last = source.indexOf(end, start + first.length);
  assert(start >= 0 && last > start, "treasury fixture anchors remain exact");
  return source.slice(start, last);
};
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER NOT NULL DEFAULT 100000,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision INTEGER DEFAULT 0);`);
  const treasury = await readFile("supabase/migrations/20260921000200_kq_treasury_accounting.sql", "utf8");
  await db.exec(extract(treasury, "CREATE TABLE public.kq_treasury_accounts", "-- Actual production cost"));
  await db.exec(`CREATE FUNCTION public.kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
    DECLARE inserted UUID; cash BIGINT; BEGIN
      INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING RETURNING user_id INTO inserted;
      IF inserted IS NOT NULL THEN SELECT cash_cents INTO cash FROM kq_equipment_wallets WHERE user_id=p_user;
        PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',cash); END IF;
    END $$;
    CREATE FUNCTION public.kq_treasury_queue(p_user UUID) RETURNS VOID LANGUAGE sql AS $$ SELECT; $$;`);
  await db.exec(extract(treasury, "CREATE FUNCTION public.kq_treasury_observe()", "-- Snapshot every existing account"));
  await db.exec("CREATE TRIGGER kq_treasury_wallet AFTER INSERT OR UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe()");
  await db.exec(await readFile("supabase/migrations/20261111000400_kq_school.sql", "utf8"));

  const owner = await player();
  const initial = await rpc(owner);
  check("ten quiz budgets total 100 game euros", [initial.quizzes.length, initial.totalBudgetCents, initial.totalPaidCents], [10, 10000, 0]);
  check("new players have no invented zero score", initial.quizzes.every(quiz => quiz.bestScore === null && quiz.attempts === 0), true);
  check("snapshot identifies its owner", initial.ownerId, owner);
  await assert.rejects(() => rpc(randomUUID()), /school_profile/); checks.push("missing player cannot create a wallet");
  let result = await rpc(owner, command(), grading(6));
  check("below threshold persists attempt with no payout", [result.result.score, result.result.gainCents, result.snapshot.totalPaidCents], [6, 0, 0]);
  const first = command();
  result = await rpc(owner, first, grading(7));
  check("seven correct pays 70 percent", [result.result.gainCents, result.result.paidCents, result.snapshot.cashCents], [700, 700, 100700]);
  const beforeReplay = await persisted(owner);
  const replay = await rpc(owner, first, grading(7));
  check("network retry returns identical immutable result", [replay.replayed, replay.result], [true, result.result]);
  check("network retry changes no stored state", await persisted(owner), beforeReplay);
  check("old editorial version can retrieve existing receipt", (await rpc(owner, first, null)).result, result.result);
  await rejectUnchanged("obsolete unsaved attempt", owner, () => rpc(owner, command("plant", randomUUID(), "old"), null), /school_version/);
  const changed = structuredClone(first); changed.answers[0].optionId = "b";
  await rejectUnchanged("same key changed answers", owner, () => rpc(owner, changed, grading(10)), /school_request_mismatch/);
  await rejectUnchanged("same key different quiz", owner, () => rpc(owner, command("uses", first.requestKey), grading(10)), /school_request_mismatch/);
  for (const score of [7, 4]) check(`score ${score} pays no duplicate`, (await rpc(owner, command(), grading(score))).result.gainCents, 0);
  result = await rpc(owner, command(), grading(9));
  check("improvement pays only complement", [result.result.gainCents, result.result.paidCents, result.result.bestScore], [200, 900, 9]);
  result = await rpc(owner, command("plant", randomUUID(), "next-editorial-version"), grading(10));
  check("editorial changes preserve stable reward cap", [result.result.gainCents, result.result.paidCents], [100, 1000]);
  result = await rpc(owner, command(), grading(10));
  check("perfect score training has no new payout", [result.result.gainCents, result.result.remainingCents], [0, 0]);

  const progress = { action: "progress", lessonIds: ["plant", "history"], workshopIds: ["timeline-history"] };
  await rpc(owner, progress);
  result = await rpc(owner, { action: "progress", lessonIds: ["plant", "uses"], workshopIds: ["crossword-plant"] });
  check("batch progress unions with prior tabs", [result.lessonIds, result.workshopIds], [["history", "plant", "uses"], ["crossword-plant", "timeline-history"]]);
  const paidBefore = result.totalPaidCents;
  check("lessons and workshops never credit money", (await rpc(owner, progress)).totalPaidCents, paidBefore);
  await rejectUnchanged("unknown workshop", owner, () => rpc(owner, { ...progress, workshopIds: ["invented"] }), /school_invalid/);
  await rejectUnchanged("unknown lesson", owner, () => rpc(owner, { ...progress, lessonIds: ["invented"] }), /school_invalid/);
  await rejectUnchanged("client-supplied money fields", owner, () => rpc(owner, { ...command(), gainCents: 1000000 }, grading(10)), /school_invalid/);
  await rejectUnchanged("score outside range", owner, () => rpc(owner, command(), grading(11)), /school_invalid_grade/);
  const duplicates = command(); duplicates.answers[1] = duplicates.answers[0];
  await rejectUnchanged("duplicate question IDs", owner, () => rpc(owner, duplicates, grading(10)), /school_invalid/);
  await rejectUnchanged("unknown quiz", owner, () => rpc(owner, command("unknown"), grading(10)), /school_invalid/);
  const saturated = await player(2147483640);
  await rejectUnchanged("wallet ceiling", saturated, () => rpc(saturated, command(), grading(7)), /school_wallet_limit/);

  const concurrentOwner = await player();
  const double = command();
  const doubleResults = await Promise.all([rpc(concurrentOwner, double, grading(7)), rpc(concurrentOwner, double, grading(7))]);
  check("simultaneous same-key requests finalize once", doubleResults.map(item => item.replayed), [false, true]);
  await Promise.all([rpc(concurrentOwner, command(), grading(9)), rpc(concurrentOwner, command(), grading(10))]);
  await Promise.all([rpc(concurrentOwner, command("uses"), grading(10)), rpc(concurrentOwner, command("history"), grading(7))]);
  result = await rpc(concurrentOwner);
  check("same-quiz improvements and different quizzes preserve all credits", [result.totalPaidCents, result.cashCents], [2700, 102700]);
  const balances = (await db.query("SELECT account,balance_cents FROM kq_treasury_balances WHERE user_id=$1", [concurrentOwner])).rows;
  const accounting = Object.fromEntries(balances.map(row => [row.account, Number(row.balance_cents)]));
  check("treasury matches school rewards without suspense", [accounting.cash, accounting.revenue_rewards, accounting.suspense, Object.values(accounting).reduce((sum, amount) => sum + amount, 0)], [102700, -2700, 0, 0]);

  await db.exec(`CREATE FUNCTION test_fail_school_receipt() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt_failure'; END $$;
    CREATE TRIGGER test_fail_receipt BEFORE INSERT ON kq_school_receipts FOR EACH ROW EXECUTE FUNCTION test_fail_school_receipt();`);
  await rejectUnchanged("failure after wallet update rolls back wallet, ledger and quiz", owner, () => rpc(owner, command("uses"), grading(10)), /receipt_failure/);
  await db.exec("DROP TRIGGER test_fail_receipt ON kq_school_receipts");
  await db.query("UPDATE kq_school_catalog SET budget_cents=1001 WHERE quiz_id='uses'");
  result = await rpc(owner, command("uses"), grading(7));
  check("fractional cents round down", result.result.gainCents, 700);
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_school_catalog", "kq_school_progress", "kq_school_quiz_progress", "kq_school_receipts"]) {
      check(`${role} has no direct access to ${table}`, await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, `public.${table}`]), false);
    }
    check(`${role} RPC privilege`, await scalar("SELECT has_function_privilege($1,'public.rpc_kq_school(uuid,jsonb,jsonb)','EXECUTE')", [role]), role === "service_role");
    check(`${role} cannot call snapshot helper`, await scalar("SELECT has_function_privilege($1,'public.kq_school_snapshot(uuid)','EXECUTE')", [role]), false);
  }
  check("all school tables enforce RLS", await scalar("SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN ('kq_school_catalog','kq_school_progress','kq_school_quiz_progress','kq_school_receipts')"), true);
  console.log(`PASS: ${checks.length} school SQL checks; local PGlite only. Lock contention across independent PostgreSQL connections was not exercised.`);
} finally { await db.close(); }
