// Real PostgreSQL connections, entirely local: cached image, no network, port or host mount.
// Setup follows test-placard-school-concurrency.mjs; only this script's random container is stopped.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const docker = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const base = ["--config", "C:\\lesiteinternetquitue\\output\\school-sql\\docker-config", "--host", "npipe:////./pipe/docker_engine"];
const container = `kq-school-feedback-test-${randomUUID().slice(0, 8)}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.075";
const checks = [];
let started = false;
assert.equal(process.argv.length, 2, "This isolated test takes no arguments");
function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, [...base, ...args], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", part => { output += part; });
    child.stderr.on("data", part => { error += part; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error.trim() || `docker exit ${code}`)));
    child.stdin.end(input);
  });
}
const sql = text => run(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], text);
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const extract = (source, first, end) => {
  const start = source.indexOf(first), last = source.indexOf(end, start + first.length);
  assert(start >= 0 && last > start);
  return source.slice(start, last);
};
const attempt = () => ({ requestKey: randomUUID(), selectionId: `l1.${randomUUID()}.${"a".repeat(64)}` });
const questionIds = Array.from({ length: 10 }, (_, index) => `law-q${String(index + 1).padStart(2, "0")}`);
const feedback = (run, index = 0, optionId = "b") => ({ ...run, quizId: "law", contentVersion: "2026-11-11.1", questionId: questionIds[index], optionId });
const correction = (input, explanation = "Original authoritative correction.") => ({ questionId: input.questionId, optionId: input.optionId, correctOptionId: "a", isCorrect: input.optionId === "a", explanation });
const save = (user, input, result = correction(input)) => `SELECT rpc_kq_school_check('${user}',${literal(input)},${literal(result)});`;
const answers = questionIds.map((questionId, index) => ({ questionId, optionId: index === 0 ? "b" : "a" }));
const grading = { score: 9, corrections: answers.map(answer => correction(answer)) };
const complete = (user, run) => `SELECT rpc_kq_school_submit_checked('${user}',${literal({ action: "submit", requestKey: run.requestKey, quizId: "law", contentVersion: "2026-11-11.1", answers })},${literal(grading)},'${run.selectionId}');`;
const money = user => sql(`SELECT json_build_object('cash',(SELECT cash_cents FROM kq_equipment_wallets WHERE user_id='${user}'),'receipts',(SELECT count(*) FROM kq_school_receipts WHERE user_id='${user}'));`).then(JSON.parse);
async function player() {
  const id = randomUUID();
  await sql(`INSERT INTO auth.users VALUES('${id}'); INSERT INTO kq_equipment_wallets(user_id) VALUES('${id}'); INSERT INTO kq_commerce_accounts(user_id) VALUES('${id}');`);
  return id;
}
async function racing(name, firstSql, secondSql, expectedError = null) {
  const tag = randomUUID();
  // Both outcomes are caught immediately, so an expected rejection never becomes unhandled.
  const outcome = text => sql(text).then(value => ({ value: JSON.parse(value) }), error => ({ error }));
  const first = outcome(`SET application_name='feedback-first-${tag}'; SET school.test_pause='hold'; ${firstSql}`);
  let holding = false;
  for (let index = 0; index < 40; index++) {
    holding = await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='feedback-first-${tag}' AND wait_event='PgSleep');`) === "t";
    if (holding) break;
    await wait(25);
  }
  assert(holding, `${name}: first connection must hold the transaction inside the test trigger`);
  const second = outcome(`SET application_name='feedback-second-${tag}'; ${secondSql}`);
  let blocked = false;
  for (let index = 0; index < 20; index++) {
    blocked = await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='feedback-second-${tag}' AND wait_event_type='Lock');`) === "t";
    if (blocked) break;
    await wait(25);
  }
  const [left, right] = await Promise.all([first, second]);
  check(`${name}: independent second connection waits on a PostgreSQL lock`, blocked, true);
  if (left.error) throw left.error;
  if (expectedError) {
    assert.match(right.error?.message ?? "", expectedError, `${name}: expected rejection after waiting`);
    checks.push(`${name}: rejected after the first transaction commits`);
  } else if (right.error) throw right.error;
  return [left.value, right.value];
}

try {
  await run(["run", "--detach", "--rm", "--pull=never", "--name", container, "--network", "none", "--read-only", "--user", "postgres", "--tmpfs", "/tmp:rw,mode=1777", "--entrypoint", "/bin/sh", image, "-c",
    "/usr/bin/initdb -D /tmp/school-db --auth=trust --encoding=UTF8 --no-locale >/tmp/school-init.log && exec /usr/bin/postgres -D /tmp/school-db -c listen_addresses='' -c unix_socket_directories=/tmp"]);
  started = true;
  let ready = false;
  for (let index = 0; index < 50; index++) {
    try { await sql("SELECT 1;"); ready = true; break; } catch { await wait(100); }
  }
  assert(ready, "isolated local PostgreSQL starts");
  const [treasury, school, feedbackMigration] = await Promise.all([
    readFile("supabase/migrations/20260921000200_kq_treasury_accounting.sql", "utf8"),
    readFile("supabase/migrations/20261111000400_kq_school.sql", "utf8"),
    readFile("supabase/migrations/20261112001000_kq_school_question_feedback.sql", "utf8"),
  ]);
  await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER DEFAULT 100000,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision INTEGER DEFAULT 0);
    ${extract(treasury, "CREATE TABLE public.kq_treasury_accounts", "-- Actual production cost")}
    CREATE FUNCTION kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ DECLARE inserted UUID; cash BIGINT; BEGIN
      INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING RETURNING user_id INTO inserted;
      IF inserted IS NOT NULL THEN SELECT cash_cents INTO cash FROM kq_equipment_wallets WHERE user_id=p_user;
        PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',cash); END IF; END $$;
    CREATE FUNCTION kq_treasury_queue(p_user UUID) RETURNS VOID LANGUAGE sql AS $$ SELECT; $$;
    ${extract(treasury, "CREATE FUNCTION public.kq_treasury_observe()", "-- Snapshot every existing account")}
    CREATE TRIGGER kq_treasury_wallet AFTER INSERT OR UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();
    ${school}
    ${feedbackMigration}
    CREATE FUNCTION test_school_feedback_hold() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('school.test_pause',true)='hold' THEN PERFORM pg_sleep(3); END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER test_school_feedback_hold BEFORE UPDATE ON kq_school_question_feedback FOR EACH ROW EXECUTE FUNCTION test_school_feedback_hold();
    CREATE TRIGGER test_school_receipt_hold BEFORE INSERT ON kq_school_receipts FOR EACH ROW EXECUTE FUNCTION test_school_feedback_hold();`);

  const owner = await player(), firstAttempt = attempt(), input = feedback(firstAttempt);
  const [first, retry] = await racing("first check and simultaneous retry", save(owner, input), save(owner, input, correction(input, "Later editorial text must not replace the stored correction.")));
  check("retry returns the original immutable correction", [first.replayed, retry.replayed, retry.correction], [false, true, first.correction]);
  check("simultaneous feedback creates one attempt row", await sql(`SELECT count(*) FROM kq_school_question_feedback WHERE user_id='${owner}';`), "1");
  check("disclosing feedback does not pay", await money(owner), { cash: 100000, receipts: 0 });

  let anotherOwner = await player(), anotherAttempt = attempt();
  await racing("competing answer after disclosure", save(anotherOwner, feedback(anotherAttempt)), save(anotherOwner, feedback(anotherAttempt, 0, "a")), /school_feedback_locked/);
  check("rejected answer leaves the original wrong choice", await sql(`SELECT checks->'law-q01'->>'optionId' FROM kq_school_question_feedback WHERE user_id='${anotherOwner}';`), "b");

  anotherOwner = await player(); anotherAttempt = attempt();
  await racing("same selection with another request key", save(anotherOwner, feedback(anotherAttempt)), save(anotherOwner, feedback({ ...anotherAttempt, requestKey: randomUUID() }, 0, "a")), /school_feedback_mismatch/);
  check("selection-key conflict creates no extra attempt", await sql(`SELECT count(*) FROM kq_school_question_feedback WHERE user_id='${anotherOwner}';`), "1");

  anotherOwner = await player(); anotherAttempt = attempt();
  await racing("check versus completion with another request key", save(anotherOwner, feedback(anotherAttempt)), complete(anotherOwner, { ...anotherAttempt, requestKey: randomUUID() }), /school_feedback_mismatch/);
  check("conflicting final submission cannot create money or receipt", await money(anotherOwner), { cash: 100000, receipts: 0 });

  const freshAttempt = attempt();
  const fresh = JSON.parse(await sql(save(owner, feedback(freshAttempt, 0, "a"))));
  check("genuinely new selection accepts a new answer", [fresh.replayed, fresh.correction.isCorrect], [false, true]);
  check("new selection remains a separate attempt", await sql(`SELECT count(*) FROM kq_school_question_feedback WHERE user_id='${owner}';`), "2");
  check("starting another selection still pays nothing", await money(owner), { cash: 100000, receipts: 0 });

  for (let index = 1; index < questionIds.length; index++) await sql(save(owner, feedback(firstAttempt, index, "a")));
  const [paid, replayed] = await racing("concurrent final completion", complete(owner, firstAttempt), complete(owner, firstAttempt));
  check("concurrent completion returns one new receipt and one exact replay", [paid.replayed, replayed.replayed, replayed.result], [false, true, paid.result]);
  check("the checked wrong answer remains in the final grade", [paid.result.score, paid.result.gainCents], [9, 900]);
  check("final completion pays once and creates one receipt", await money(owner), { cash: 100900, receipts: 1 });
  check("treasury contains one reward without suspense", JSON.parse(await sql(`SELECT json_build_object('cash',(SELECT balance_cents FROM kq_treasury_balances WHERE user_id='${owner}' AND account='cash'),
    'rewards',(SELECT balance_cents FROM kq_treasury_balances WHERE user_id='${owner}' AND account='revenue_rewards'),
    'suspense',(SELECT balance_cents FROM kq_treasury_balances WHERE user_id='${owner}' AND account='suspense'));`)), { cash: 100900, rewards: -900, suspense: 0 });

  anotherOwner = await player(); anotherAttempt = attempt();
  await racing("direct final completion versus another check key", complete(anotherOwner, anotherAttempt), save(anotherOwner, feedback({ ...anotherAttempt, requestKey: randomUUID() }, 0, "a")), /school_feedback_mismatch/);
  check("direct completion consumes the selection and retains all corrections", JSON.parse(await sql(`SELECT json_build_object('requestKey',request_key,'count',(SELECT count(*) FROM jsonb_object_keys(checks)),'first',checks->'law-q01') FROM kq_school_question_feedback WHERE user_id='${anotherOwner}';`)), { requestKey: anotherAttempt.requestKey, count: 10, first: grading.corrections[0] });
  check("check racing with direct completion cannot add a second payment", await money(anotherOwner), { cash: 100900, receipts: 1 });
  console.log(`PASS: ${checks.length} real PostgreSQL feedback concurrency checks; PostgreSQL 17, no network, ports or host mounts.`);
} finally {
  if (started) await run(["stop", "--time", "2", container]).catch(error => {
    if (!error.message.includes("No such container")) throw error;
  });
}
