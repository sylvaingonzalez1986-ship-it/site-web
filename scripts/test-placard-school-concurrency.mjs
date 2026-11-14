// No remote DB, published port, network, host data mount or image pull.
// Uses an already-cached PostgreSQL image and destroys only its own container.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const docker = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const base = ["--config", "C:\\lesiteinternetquitue\\output\\school-sql\\docker-config", "--host", "npipe:////./pipe/docker_engine"];
const container = `kq-school-test-${randomUUID().slice(0, 8)}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.075";
let started = false;
const checks = [];
const historyOnly = process.argv.includes("--history"), botanyOnly = process.argv.includes("--botany"), terpenesOnly = process.argv.includes("--terpenes"), cannabinoidsOnly = process.argv.includes("--cannabinoids"), cultivationOnly = process.argv.includes("--cultivation"), healthOnly = process.argv.includes("--health"), soilOnly = process.argv.includes("--soil"), productsOnly = process.argv.includes("--products"), harvestOnly = process.argv.includes("--harvest");
assert(process.argv.slice(2).length <= 1 && process.argv.slice(2).every(argument => ["--history", "--botany", "--terpenes", "--cannabinoids", "--cultivation", "--health", "--soil", "--products", "--harvest"].includes(argument)), "Use one curriculum flag at a time");
function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, [...base, ...args], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", part => { output += part; }); child.stderr.on("data", part => { error += part; });
    child.on("error", reject); child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error.trim() || `docker exit ${code}`)));
    child.stdin.end(input);
  });
}
const sql = text => run(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], text);
const wait = delay => new Promise(resolve => setTimeout(resolve, delay));
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const command = (quiz = "plant", key = randomUUID()) => ({ action: "submit", quizId: quiz, requestKey: key, contentVersion: "2026-11-11.1",
  answers: Array.from({ length: 10 }, (_, index) => ({ questionId: `${quiz}-q${index + 1}`, optionId: "a" })) });
const grade = score => ({ score, corrections: Array.from({ length: 10 }, (_, index) => ({ isCorrect: index < score })) });
const call = (user, value, score) => `SELECT rpc_kq_school('${user}',${literal(value)},${literal(grade(score))});`;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const extract = (source, first, end) => { const start = source.indexOf(first), last = source.indexOf(end, start + first.length); assert(start >= 0 && last > start); return source.slice(start, last); };
async function player() {
  const id = randomUUID();
  await sql(`INSERT INTO auth.users VALUES('${id}'); INSERT INTO kq_equipment_wallets(user_id) VALUES('${id}'); INSERT INTO kq_commerce_accounts(user_id) VALUES('${id}');`);
  return id;
}
async function racing(firstSql, secondSql, shouldFail = false) {
  const tag = randomUUID();
  const first = sql(`SET application_name='school-first-${tag}'; SET school.test_pause='${shouldFail ? "fail" : "hold"}'; ${firstSql}`)
    .then(value => ({ value }), error => ({ error }));
  let holding = false;
  for (let index = 0; index < 40; index++) {
    holding = await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='school-first-${tag}' AND wait_event='PgSleep');`) === "t";
    if (holding) break;
    await wait(25);
  }
  assert(holding, "first connection must hold wallet while inside receipt trigger");
  const second = sql(`SET application_name='school-second-${tag}'; ${secondSql}`);
  let blocked = false;
  for (let index = 0; index < 20; index++) {
    blocked = await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='school-second-${tag}' AND wait_event_type='Lock');`) === "t";
    if (blocked) break;
    await wait(25);
  }
  check("second independent connection waits on a real PostgreSQL lock", blocked, true);
  const [left, right] = await Promise.all([first, second]);
  if (shouldFail) assert.match(left.error?.message ?? "", /test_receipt_failure/);
  else if (left.error) throw left.error;
  return [left.value ? JSON.parse(left.value) : null, right ? JSON.parse(right) : null];
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
  const treasury = await readFile("supabase/migrations/20260921000200_kq_treasury_accounting.sql", "utf8");
  const migration = await readFile("supabase/migrations/20261111000400_kq_school.sql", "utf8");
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
    ${migration}
    CREATE FUNCTION test_school_hold() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('school.test_pause',true) IN ('hold','fail') THEN PERFORM pg_sleep(3); END IF;
      IF current_setting('school.test_pause',true)='fail' THEN RAISE EXCEPTION 'test_receipt_failure'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER test_school_hold BEFORE INSERT ON kq_school_receipts FOR EACH ROW EXECUTE FUNCTION test_school_hold();`);

  if (historyOnly || botanyOnly || terpenesOnly || cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) {
    await sql(await readFile("supabase/migrations/20261112000100_kq_school_history_progress.sql", "utf8"));
    if (botanyOnly || terpenesOnly || cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) await sql(await readFile("supabase/migrations/20261112000200_kq_school_botany_progress.sql", "utf8"));
    if (terpenesOnly || cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) await sql(await readFile("supabase/migrations/20261112000300_kq_school_terpenes_progress.sql", "utf8"));
    if (cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) await sql(await readFile("supabase/migrations/20261112000400_kq_school_cannabinoids_progress.sql", "utf8"));
    if (cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) await sql(await readFile("supabase/migrations/20261112000500_kq_school_cultivation_progress.sql", "utf8"));
    if (healthOnly || soilOnly || productsOnly || harvestOnly) await sql(await readFile("supabase/migrations/20261112000600_kq_school_health_progress.sql", "utf8"));
    if (soilOnly || productsOnly || harvestOnly) await sql(await readFile("supabase/migrations/20261112000700_kq_school_soil_progress.sql", "utf8"));
    if (productsOnly || harvestOnly) await sql(await readFile("supabase/migrations/20261112000800_kq_school_products_progress.sql", "utf8"));
    if (harvestOnly) await sql(await readFile("supabase/migrations/20261112000900_kq_school_harvest_progress.sql", "utf8"));
    const course = harvestOnly ? "harvest" : productsOnly ? "products" : soilOnly ? "soil" : healthOnly ? "health" : cultivationOnly ? "cultivation" : cannabinoidsOnly ? "cannabinoids" : terpenesOnly ? "terpenes" : botanyOnly ? "botany" : "history", quiz = harvestOnly ? "prevention" : productsOnly ? "profiles" : soilOnly ? "uses" : healthOnly ? "biodiversity" : cultivationOnly ? "genetics" : cannabinoidsOnly ? "evidence" : terpenesOnly ? "molecules" : botanyOnly ? "plant" : "history";
    const firstChapter = harvestOnly ? "outcomes" : productsOnly ? "seeds" : soilOnly ? "physical" : healthOnly ? "observation" : cultivationOnly ? "axes" : cannabinoidsOnly ? "origins" : terpenesOnly ? "vocabulary" : botanyOnly ? "anatomy" : "evidence", nextChapter = harvestOnly ? "units" : productsOnly ? "fibres" : soilOnly ? "rhizosphere" : healthOnly ? "causes" : cultivationOnly ? "light" : cannabinoidsOnly ? "identity" : terpenesOnly ? "chemistry" : botanyOnly ? "life-cycle" : "prehistory", lastChapter = harvestOnly ? "tips" : productsOnly ? "traceability" : soilOnly ? "hemp" : healthOnly ? "verification" : cultivationOnly ? "decisions" : cannabinoidsOnly ? "reading-studies" : terpenesOnly ? "claims" : botanyOnly ? "taxonomy" : "brittany";
    await sql(`CREATE TRIGGER test_school_learning_hold BEFORE UPDATE ON kq_school_${course}_progress FOR EACH ROW EXECUTE FUNCTION test_school_hold();`);
    const learning = (user, lesson, revision = 0) => `SELECT rpc_kq_school_${course}('${user}',${literal({ lessonIds: [lesson], checkpointIds: [], activityIds: [], resumeLessonId: lesson, expectedRevision: revision })});`;
    let user = await player();
    let [first, second] = await racing(learning(user, `${course}-${firstChapter}-1`), learning(user, `${course}-${firstChapter}-2`));
    check("concurrent learning tabs retain both completed lessons", second.lessonIds, [`${course}-${firstChapter}-1`, `${course}-${firstChapter}-2`]);
    check("stale concurrent resume cannot replace the first writer", [first.revision, second.revision, second.resumeConflict, second.resumeLessonId], [1, 2, true, `${course}-${firstChapter}-1`]);
    check("concurrent learning has no monetary side effect", await sql(`SELECT cash_cents FROM kq_equipment_wallets WHERE user_id='${user}';`), "100000");
    user = await player();
    [first, second] = await racing(learning(user, `${course}-${nextChapter}-1`), learning(user, `${course}-${nextChapter}-1`));
    check("parallel duplicate completion returns the exact same stable state", second, first);

    user = await player();
    if (botanyOnly || terpenesOnly || cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) await sql(call(user, command(quiz), 7));
    const tag = randomUUID();
    const slowLearning = sql(`SET application_name='history-no-wallet-${tag}'; SET school.test_pause='hold'; ${learning(user, `${course}-${lastChapter}-1`)}`);
    let holding = false;
    for (let index = 0; index < 40; index++) {
      holding = await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='history-no-wallet-${tag}' AND wait_event='PgSleep');`) === "t";
      if (holding) break;
      await wait(25);
    }
    assert(holding, "history row is intentionally held by a different connection");
    const reward = JSON.parse(await sql(call(user, { ...command(quiz), contentVersion: harvestOnly ? "2026-11-12.harvest1" : productsOnly ? "2026-11-12.products1" : soilOnly ? "2026-11-12.soil1" : healthOnly ? "2026-11-12.health1" : cultivationOnly ? "2026-11-12.cultivation1" : cannabinoidsOnly ? "2026-11-12.cannabinoids1" : terpenesOnly ? "2026-11-12.terpenes1" : botanyOnly ? "2026-11-12.botany1" : "2026-11-12.history1" }, 10)));
    check("reward completes while history progress still holds its separate row", await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='history-no-wallet-${tag}' AND wait_event='PgSleep');`), "t");
    const saved = JSON.parse(await slowLearning);
    check("independent history progress and reward both survive", [saved.lessonIds, reward.result.gainCents, reward.snapshot.cashCents], [[`${course}-${lastChapter}-1`], historyOnly ? 1000 : 300, 101000]);

    if (botanyOnly || terpenesOnly || cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) {
      const untouched = JSON.parse(await sql(`SELECT rpc_kq_school_history('${user}');`));
      check("new course progress does not imply any History completion", [untouched.lessonIds, untouched.revision], [[], 0]);
      if (terpenesOnly || cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) {
        const botany = JSON.parse(await sql(`SELECT rpc_kq_school_botany('${user}');`));
        check("terpenes progress does not imply any Botany completion", [botany.lessonIds, botany.revision], [[], 0]);
      }
      if (cannabinoidsOnly || cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) {
        const terpenes = JSON.parse(await sql(`SELECT rpc_kq_school_terpenes('${user}');`));
        check("cannabinoids progress does not imply any Terpenes completion", [terpenes.lessonIds, terpenes.revision], [[], 0]);
      }
      if (cultivationOnly || healthOnly || soilOnly || productsOnly || harvestOnly) {
        const cannabinoids = JSON.parse(await sql(`SELECT rpc_kq_school_cannabinoids('${user}');`));
        check("cultivation progress does not imply any Cannabinoids completion", [cannabinoids.lessonIds, cannabinoids.revision], [[], 0]);
      }
      if (healthOnly || soilOnly || productsOnly || harvestOnly) {
        const cultivation = JSON.parse(await sql(`SELECT rpc_kq_school_cultivation('${user}');`));
        check("health progress does not imply any Cultivation completion", [cultivation.lessonIds, cultivation.revision], [[], 0]);
      }
      if (soilOnly || productsOnly || harvestOnly) {
        const health = JSON.parse(await sql(`SELECT rpc_kq_school_health('${user}');`));
        check("soil progress does not imply any Health completion", [health.lessonIds, health.revision], [[], 0]);
      }
      if (productsOnly || harvestOnly) {
        const soil = JSON.parse(await sql(`SELECT rpc_kq_school_soil('${user}');`));
        check("products progress does not imply any Soil completion", [soil.lessonIds, soil.revision], [[], 0]);
      }
      if (harvestOnly) {
        const products = JSON.parse(await sql(`SELECT rpc_kq_school_products('${user}');`));
        check("harvest progress does not imply any Products completion", [products.lessonIds, products.revision], [[], 0]);
      }
      user = await player();
      await sql(call(user, command(quiz), 7));
      const nextAttempt = () => ({ ...command(quiz), contentVersion: harvestOnly ? "2026-11-12.harvest1" : productsOnly ? "2026-11-12.products1" : soilOnly ? "2026-11-12.soil1" : healthOnly ? "2026-11-12.health1" : cultivationOnly ? "2026-11-12.cultivation1" : cannabinoidsOnly ? "2026-11-12.cannabinoids1" : terpenesOnly ? "2026-11-12.terpenes1" : "2026-11-12.botany1" });
      [first, second] = await racing(call(user, nextAttempt(), 10), call(user, nextAttempt(), 9));
      check("concurrent new attempts retain old payments and their total cap", [first.result.gainCents + second.result.gainCents, second.result.paidCents, second.result.bestScore, second.snapshot.cashCents], [300, 1000, 10, 101000]);
    }
  } else {
  let user = await player(), key = command();
  let [first, second] = await racing(call(user, key, 7), call(user, key, 7));
  check("double send returns one new reward and one immutable replay", [first.replayed, second.replayed, first.result.gainCents, second.result.gainCents], [false, true, 700, 700]);
  check("double send produces one receipt", await sql(`SELECT count(*) FROM kq_school_receipts WHERE user_id='${user}';`), "1");
  for (const [low, high] of [[7, 10], [10, 7]]) {
    user = await player();
    [first, second] = await racing(call(user, command(), low), call(user, command(), high));
    check(`scores ${low} then ${high} preserve cap and best`, [first.result.gainCents + second.result.gainCents, second.result.bestScore, second.snapshot.cashCents], [1000, 10, 101000]);
  }
  user = await player();
  [first, second] = await racing(call(user, command("plant"), 10), call(user, command("uses"), 9));
  check("different quiz rewards both survive", [second.snapshot.totalPaidCents, second.snapshot.cashCents], [1900, 101900]);
  check("treasury records both credits with zero suspense", JSON.parse(await sql(`SELECT json_build_object('cash',(SELECT balance_cents FROM kq_treasury_balances WHERE user_id='${user}' AND account='cash'),
    'rewards',(SELECT balance_cents FROM kq_treasury_balances WHERE user_id='${user}' AND account='revenue_rewards'),
    'suspense',(SELECT balance_cents FROM kq_treasury_balances WHERE user_id='${user}' AND account='suspense'));`)), { cash: 101900, rewards: -1900, suspense: 0 });
  user = await player();
  await racing(call(user, command(), 7), `UPDATE kq_equipment_wallets SET cash_cents=cash_cents-4000 WHERE user_id='${user}'; SELECT json_build_object('cashCents',cash_cents) FROM kq_equipment_wallets WHERE user_id='${user}';`);
  check("unrelated concurrent debit and school credit both survive", await sql(`SELECT cash_cents FROM kq_equipment_wallets WHERE user_id='${user}';`), "96700");
  user = await player(); key = command();
  [, second] = await racing(call(user, key, 7), call(user, key, 7), true);
  check("concurrent retry after rollback receives its legitimate reward once", [second.replayed, second.result.gainCents, second.snapshot.cashCents], [false, 700, 100700]);
  check("rollback leaves one valid receipt", await sql(`SELECT count(*) FROM kq_school_receipts WHERE user_id='${user}';`), "1");
  }
  console.log(`PASS: ${checks.length} real PostgreSQL ${cultivationOnly ? "cultivation " : cannabinoidsOnly ? "cannabinoids " : terpenesOnly ? "terpenes " : botanyOnly ? "botany " : historyOnly ? "history " : ""}concurrency checks, isolated local PostgreSQL 17, no network/ports/mounts.`);
} finally {
  if (started) await run(["stop", "--time", "2", container]).catch(error => {
    if (!error.message.includes("No such container")) throw error;
  });
}
