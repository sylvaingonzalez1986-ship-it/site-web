// Isolated PostgreSQL: reuse the existing warehouse's real chronological
// commerce/storage/machine fixture, then exercise the new migration and TS
// Personnel engine together. PGlite cannot measure multi-connection contention.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
let checks = 0, historicalChecks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const reject = async (fn, code) => {
  await db.exec("SAVEPOINT expected_failure");
  try { await assert.rejects(fn, error => { assert(error.message.includes(code), `Expected ${code}, received ${error.message}`); return true; }); checks++; }
  finally { await db.exec("ROLLBACK TO SAVEPOINT expected_failure"); }
};
const section = (text, start, end) => {
  const first = text.indexOf(start), last = text.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Fixture markers: ${start}`); return text.slice(first, last);
};
const definition = async (file, name) => {
  const source = await sql(file);
  const found = source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert(found, name); return found[0].replace(/^CREATE FUNCTION/, "CREATE OR REPLACE FUNCTION");
};

try {
  const warehouse = (await readFile(new URL("./test-placard-warehouse.mjs", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const begin = warehouse.indexOf("try {\n"), end = warehouse.lastIndexOf('  await db.exec("ROLLBACK");');
  assert(begin >= 0 && end > begin, "Warehouse fixture boundaries changed");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fixture = await new AsyncFunction("db", "vite", "sql", "scalar", "definition", "equal", "reject", "readFile", "path", "randomUUID", "assert", "console",
    warehouse.slice(begin + 6, end).replaceAll("import.meta.url", "fixtureUrl")
      .replace('const onlineSource =', `const fixtureUrl = ${JSON.stringify(new URL("./test-placard-warehouse.mjs", import.meta.url).href)};\n  const onlineSource =`)
      + "\n return { createWorkshopLot, retainedWorkshop, prepareTierWorkshop, buyWorkshopTier, workshopSnapshot, earnCareer };"
  )(db, vite, sql, scalar, definition, equal, reject, readFile, path, randomUUID, assert, { log() {} });
  historicalChecks = checks; checks = 0;
  await db.exec("COMMIT");
  // Only surrounding social columns are fixture boundaries. The processing,
  // receipt, workday, archive, staff commit and machine functions are real SQL.
  await db.exec(`ALTER TABLE kq_runs ADD COLUMN IF NOT EXISTS campaign_id UUID;
    ALTER TABLE kq_equipment_wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    CREATE TABLE IF NOT EXISTS kq_social_platforms(user_id UUID,platform TEXT,followers INTEGER);
  `);
  await db.exec(await sql("20261107000100_kq_staff.sql"));
  await db.exec(await sql("20261107000300_kq_staff_accounting.sql"));
  const workday = await sql("20261107000500_kq_player_workday.sql");
  await db.exec(section(workday, "CREATE FUNCTION public.kq_player_work_day", "DO $$ DECLARE body TEXT; anchor TEXT; BEGIN"));
  let staffCommit = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  const cas = "IF account.revision<>p_expected_revision THEN RAISE EXCEPTION 'staff_changed'; END IF;";
  assert(staffCommit.includes(cas));
  await db.exec(staffCommit.replace("'cancel-leave','settle'", "'cancel-leave','player-assign','settle'")
    .replace(cas, cas + "\n PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);"));
  await db.exec(section(workday, "CREATE FUNCTION pg_temp.kq_player_work_wrap", "-- Registration list"));
  await scalar("SELECT pg_temp.kq_player_work_wrap($1,'commerce','p_action')", ["public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)"]);
  await db.exec(await sql("20261107000600_kq_staff_archive.sql"));
  await db.exec(await sql("20261108000200_kq_staff_weekly_plan.sql"));
  // Culture's independent roll/campaign ledger is covered by its own fixture;
  // compose its exact staff validator and snapshot here, where SQL writers meet.
  await db.exec(await definition("20261108000300_kq_culture_work_steps.sql", "kq_culture_work_validate_staff"));
  staffCommit = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  const weeklyGuard = "PERFORM public.kq_staff_validate_weekly_plan(p_user_id,p_command,p_state,p_debit_cents);";
  assert(staffCommit.includes(weeklyGuard));
  await db.exec(staffCommit.replace(weeklyGuard, weeklyGuard + "\n PERFORM public.kq_culture_work_validate_staff(p_user_id,p_state);"));
  await db.exec(section(await sql("20261108000300_kq_culture_work_steps.sql"), "ALTER FUNCTION public.kq_staff_snapshot(UUID)", "COMMIT;"));
  const oldRows = await scalar("SELECT jsonb_agg(to_jsonb(b) ORDER BY flower_id) FROM kq_commerce_batches b");
  await db.exec(await sql("20261108000400_kq_processing_work.sql"));
  await db.exec(await sql("20261108001300_kq_processing_work_choice.sql"));
  await db.exec("BEGIN");
  equal(await scalar("SELECT jsonb_agg(to_jsonb(b) ORDER BY flower_id) FROM kq_commerce_batches b"), oldRows, "Migration preserves every historical batch byte for byte");
  const engine = await vite.ssrLoadModule("/src/lib/kanab-quest-staff.ts");
  const model = await vite.ssrLoadModule("/src/lib/kanab-quest-processing-work.ts");
  const now = await scalar("SELECT now()::TEXT"), time = Date.parse(now);
  const owner = await fixture.prepareTierWorkshop();
  const pressPrice = await scalar("SELECT price_cents FROM kq_equipment_catalog WHERE code='PRESS-0600'");
  await fixture.buyWorkshopTier(owner, "PRESS-0600", 1, 0, pressPrice);
  await scalar("SELECT rpc_kq_equip_tent_equipment($1,'PRESS-0600',1)", [owner]);
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=now() WHERE user_id=$1", [owner]);
  await db.query("UPDATE kq_equipment_wallets SET created_at=now(),cash_cents=100000000 WHERE user_id=$1", [owner]);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=0 WHERE user_id=$1", [owner]);
  await db.query("UPDATE kq_commerce_batches SET processing_ready_at=now()-interval '1 hour' WHERE user_id=$1", [owner]);
  const read = () => scalar("SELECT rpc_kq_staff_snapshot($1)", [owner]);
  const getJob = id => scalar("SELECT (SELECT j FROM jsonb_array_elements(kq_processing_jobs_snapshot($1)) j WHERE j->>'flowerId'=$2)", [owner, id]);
  const used = async () => Number(await scalar("SELECT COALESCE((state->'playerWorkDays'->'1'->>'usedHours')::NUMERIC,0) FROM kq_staff_accounts WHERE user_id=$1", [owner]));
  const employee = { id: randomUUID(), code: "fixture-worker", name: "Anna", role: "processor", trait: "quick", portraitCode: "anna",
    skills: { culture: 0, processing: 8100, sales: 0, communication: 0, administration: 0 }, completedTasks: 0,
    status: "active", hiredAt: new Date(time - 60000).toISOString(), endsAt: null, nextPayrollAt: new Date(time + 86400000).toISOString(),
    weeklyHours: 35, workDays: {}, leave: [], contract: "cdi", reason: "permanent", paidUntil: now,
    grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false };
  const initial = engine.createKqStaffState(now); initial.employees = [employee];
  await db.query("INSERT INTO kq_staff_accounts(user_id,state) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state", [owner, initial]);
  const assign = async hours => {
    const raw = await read(), key = randomUUID(), command = { action: "assign", employeeId: employee.id, kind: "processing", hours };
    const transition = engine.applyKqStaffCommand(raw, command, key);
    return scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,$6,$7)", [owner, raw.revision, key, command, transition.state, transition.debitCents, transition.effects]);
  };
  const plan = (hours, passive = 0) => ({ version: 1, profileVersion: 1, inputGrams: 20, nominalHours: hours, passiveHours: passive,
    machines: [{ code: "PRESS-0600", name: "Pressage", model: "Reference", sourceUrl: "https://example.test/press", specification: "Fixture", material: "fleurs sèches", basis: "input", quantityGrams: 20, gramsPerHour: 20 / hours, hours, estimated: true, note: "Estimation" }],
    sources: [{ label: "Reference", url: "https://example.test/press" }], estimated: true });
  const makeLot = async work => {
    const { lot } = await fixture.createWorkshopLot(owner, "rosin-trial", 3600);
    // The official quote refresh persists these economic fields before prepare.
    await db.query(`UPDATE kq_market_lots SET options=jsonb_build_array(options->0||jsonb_build_object(
      'processingWork',$2::jsonb,'available',true,'processedInputGrams',20,'productGrams',5,'productBaseUnitCents',100,
      'storageRevision',(SELECT revision FROM kq_storage_lots WHERE flower_id=$1),'storageChangeAt',now()+interval '1 hour',
      'market',jsonb_build_object('processingCostCents',0,'reputation',(SELECT reputation FROM kq_equipment_wallets WHERE user_id=$3),
        'salesCount',(SELECT COALESCE(sum(sale_count),0) FROM kq_player_route_masteries WHERE user_id=$3)))) WHERE flower_id=$1`, [lot, work, owner]);
    return lot;
  };
  const quote = (id, work = null) => scalar("SELECT rpc_kq_processing_work_quote($1,$2,$3)", [owner, id, work]);
  const command = (action, payload, key = randomUUID()) => scalar("SELECT rpc_kq_commerce_command($1,$2,$3,$4)", [owner, action, payload, key]);
  const finish = id => db.query(`UPDATE kq_processing_jobs SET segments=jsonb_set(jsonb_set(jsonb_set(segments,
    ARRAY[(jsonb_array_length(segments)-1)::TEXT,'startedAt'],to_jsonb(now()-interval '2 hours')),
    ARRAY[(jsonb_array_length(segments)-1)::TEXT,'readyAt'],to_jsonb(now()-interval '1 hour')),
    ARRAY[(jsonb_array_length(segments)-1)::TEXT,'machineReadyAt'],to_jsonb(now()-interval '1 hour')) WHERE flower_id=$1`, [id]);

  await assign(2);
  equal((await read()).state.employees[0].workDays[1].usedHours, 2, "Assignment reserves employee availability once");
  const work = plan(3, 2), lot = await makeLot(work), offer = await quote(lot, work);
  equal(model.isKqProcessingWorkQuote(offer), true, "SQL quote satisfies application validation");
  equal([offer.source, offer.bookedHours, offer.nominalHours, offer.efficiency], ["employee", 2, 2, 1], "Quick expert remains capped at the machine throughput");
  await db.query("UPDATE kq_market_lots SET options=jsonb_set(options,'{0,processingWork,quote}',$2) WHERE flower_id=$1", [lot, offer]);
  const payload = { flowerId: lot, route: "rosin-trial", expectedCostCents: 0, expectedWork: offer.token }, key = randomUUID();
  const prepared = await command("prepare", payload, key);
  equal(await used(), 0, "Delegated preparation does not spend player hours");
  equal((await read()).state.employees[0].workDays[1].usedHours, 2, "Financing work does not debit employee availability twice");
  equal((await getJob(lot)).status, "running", "Partial preparation creates a running financed tranche");
  equal(model.isKqProcessingJob(await getJob(lot)), true, "Persisted SQL job satisfies the application contract");
  equal(Number(await scalar("SELECT extract(epoch FROM (segments->-1->>'readyAt')::TIMESTAMPTZ-(segments->-1->>'startedAt')::TIMESTAMPTZ) FROM kq_processing_jobs WHERE flower_id=$1", [lot])), 1200, "Two financed game hours take exactly twenty real minutes");
  equal(await scalar("SELECT processing_ready_at='9999-01-01'::TIMESTAMPTZ FROM kq_commerce_batches WHERE flower_id=$1", [lot]), true, "Unfinished transformed stock stays locked");
  await db.query("UPDATE kq_commerce_accounts SET computer_owned=true WHERE user_id=$1", [owner]);
  const online = (action, payload) => scalar("SELECT rpc_kq_online_command($1,$2,$3,$4)", [owner, action, payload, randomUUID()]);
  await online("upgrade-site", { tier: "basic", name: "Processing fixture" });
  await online("buy-packaging", { code: "kraft-5", quantity: 1 });
  await reject(() => online("create-listing", { stockId: prepared.stockId, formatGrams: 5, packagingCode: "kraft-5", packets: 1, packetPriceCents: 100 }), "warehouse_processing_pending");
  const effectRaw = await read();
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,0,$6)", [owner, effectRaw.revision, randomUUID(), { action: "settle" }, effectRaw.state,
    [{ kind: "processing", flowerId: lot, secondsSaved: 3600 }]]);
  equal(await scalar("SELECT processing_ready_at='9999-01-01'::TIMESTAMPTZ FROM kq_commerce_batches WHERE flower_id=$1", [lot]), true, "Legacy staff acceleration cannot touch a new job deadline");
  const forgedRaw = await read(), forged = structuredClone(forgedRaw.state);
  forged.tasks[0].processingUsedHours = 0;
  await reject(() => scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,0,'[]')", [owner, forgedRaw.revision, randomUUID(), { action: "settle" }, forged]), "processing_work_changed");
  const afterFirst = await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]);
  equal((await command("prepare", payload, key)).replayed, true, "Prepare replay returns the existing receipt");
  equal(await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]), afterFirst, "Replay cannot consume hours or award XP twice");
  await reject(() => command("prepare", { ...payload, expectedWork: "0".repeat(32) }, key), "commerce_request_mismatch");
  await reject(() => command("processing-work", { flowerId: lot, expectedWork: offer.token }), "processing_work_exhausted");
  await finish(lot);
  equal((await getJob(lot)).status, "blocked", "A finished partial tranche pauses instead of releasing stock");
  equal((await quote(lot)).source, "blocked", "Exhausted delegation never falls back to the player");
  equal(await used(), 0, "Paused delegation leaves personal hours intact");
  const nextLot = await makeLot(plan(.25));
  equal(await scalar("SELECT kq_processing_machine_available($1,ARRAY['PRESS-0600'])<=now()", [owner]), true, "Paused job releases the machine instead of queuing until year 9999");
  await assign(1);
  const resumed = await quote(lot), resumeKey = randomUUID(), resumePayload = { flowerId: lot, expectedWork: resumed.token };
  equal([resumed.source, resumed.bookedHours, resumed.passiveHours], ["employee", 1, 2], "Added hours finance the remainder and expose passive waiting separately");
  await command("processing-work", resumePayload, resumeKey);
  equal(await scalar("SELECT processing_ready_at<'9999-01-01'::TIMESTAMPTZ FROM kq_commerce_batches WHERE flower_id=$1", [lot]), true, "Fully financed lot gets its real final deadline");
  equal((await command("processing-work", resumePayload, resumeKey)).replayed, true, "Continuation replay is idempotent");
  equal((await read()).state.employees[0].completedTasks, 2, "Fully used reservations complete once each");
  await finish(lot);
  equal((await getJob(lot)).status, "passive", "Finishing active work preserves autonomous waiting");
  equal((await read()).context.processingBatches.some(batch => batch.flowerId === lot), false, "Legacy timer acceleration cannot select a new job");
  const beforeStale = await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]);
  await assign(.5);
  const smallQuote = await quote(nextLot, plan(.25));
  await reject(() => command("prepare", { flowerId: nextLot, route: "rosin-trial", expectedCostCents: 0, expectedWork: "0".repeat(32) }), "processing_work_changed");
  equal(await getJob(nextLot), null, "Stale confirmation rolls back the new job and stock");
  equal((await quote(nextLot, plan(.25))).token, smallQuote.token, "Failure does not consume the confirmed reserve");
  await command("prepare", { flowerId: nextLot, route: "rosin-trial", expectedCostCents: 0, expectedWork: smallQuote.token });
  equal([(await getJob(nextLot)).bookedHours, (await getJob(nextLot)).activeHours], [.5, .25], "Short job distinguishes its booked half-hour from exact work duration");
  await finish(nextLot);
  await assign(.5);
  const delegatedLot = await makeLot(plan(5)), delegatedQuote = await quote(delegatedLot, plan(5));
  await command("prepare", { flowerId: delegatedLot, route: "rosin-trial", expectedCostCents: 0, expectedWork: delegatedQuote.token });
  await finish(delegatedLot);
  // Completed reservations have already been archived by the real trigger.
  await db.query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{tasks}','[]') WHERE user_id=$1", [owner]);
  equal((await quote(delegatedLot)).source, "blocked", "Archived exhausted reservation still blocks player fallback");
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '4 hours' WHERE user_id=$1", [owner]);
  equal((await quote(delegatedLot)).source, "blocked", "Delegated job stays delegated on the next game day");
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '20 hours' WHERE user_id=$1", [owner]);
  equal((await quote(delegatedLot)).source, "blocked", "Weekend without a reservation cannot silently use player hours");
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '4 hours' WHERE user_id=$1", [owner]);
  const personalLot = await makeLot(plan(20)), personalQuote = await quote(personalLot, plan(20));
  equal([personalQuote.source, personalQuote.bookedHours, personalQuote.efficiency, personalQuote.nominalHours], ["player", 12, .55, 6.6], "Novice personal work finances only the available twelve hours at the capped effective rate");
  await command("prepare", { flowerId: personalLot, route: "rosin-trial", expectedCostCents: 0, expectedWork: personalQuote.token });
  equal(Number(await scalar("SELECT (state->'playerWorkDays'->'2'->>'usedHours')::NUMERIC FROM kq_staff_accounts WHERE user_id=$1", [owner])), 12, "Partial personal preparation charges twelve hours once, without the old flat extra hour");
  equal((await getJob(personalLot)).delegated, false, "A personal lot records its budget source durably");
  await finish(personalLot);
  equal((await quote(personalLot)).source, "blocked", "Personal day exhaustion pauses a large lot");
  const wrongOwner = await fixture.prepareTierWorkshop();
  await reject(() => scalar("SELECT rpc_kq_processing_work_quote($1,$2,$3)", [wrongOwner, personalLot, plan(20)]), "processing_work_unavailable");
  await reject(() => scalar("SELECT rpc_kq_commerce_command($1,'processing-work',$2,$3)", [wrongOwner, { flowerId: personalLot, expectedWork: personalQuote.token }, randomUUID()]), "processing_work_unavailable");
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '8 hours' WHERE user_id=$1", [owner]);
  const tomorrow = await quote(personalLot);
  equal([tomorrow.source, tomorrow.bookedHours, tomorrow.efficiency], ["player", 12, .6], "New personal day permits progress, with the real earned skill level");
  await command("processing-work", { flowerId: personalLot, expectedWork: tomorrow.token });
  equal((await getJob(personalLot)).remainingNominalHours, 6.2, "Resume preserves previous progress on a lot bigger than one workday");
  equal(model.isKqProcessingJob(await getJob(personalLot)), true, "Multi-day job remains compatible with application validation");
  const weeklyDays = Array.from({ length: 5 }, () => [{ kind: "processing", hours: 1 }]);
  let weeklyRaw = await read();
  const weeklyCommand = { action: "set-weekly-plan", employeeId: employee.id, enabled: true, days: weeklyDays, expectedWeeklyCostCents: 0 };
  const weeklyKey = randomUUID(), weeklyTransition = engine.applyKqStaffCommand(weeklyRaw, weeklyCommand, weeklyKey);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,$6,$7)", [owner, weeklyRaw.revision, weeklyKey, weeklyCommand, weeklyTransition.state, weeklyTransition.debitCents, weeklyTransition.effects]);
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '12 hours' WHERE user_id=$1", [owner]);
  weeklyRaw = await read();
  const advanced = engine.advanceKqStaff(weeklyRaw);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,$6,$7)", [owner, weeklyRaw.revision, randomUUID(), { action: "settle" }, advanced.state, advanced.debitCents, advanced.effects]);
  const weeklyTask = (await read()).state.tasks.find(task => task.processingShift && task.day === 4);
  equal([weeklyTask?.hours, weeklyTask?.processingUsedHours, weeklyTask?.targetId], [1, 0, undefined], "A weekly plan creates an unspent processing reserve without a target lot");
  const weeklyOffer = await quote(delegatedLot), workerBudget = (await read()).state.employees[0].workDays[4].usedHours;
  equal(weeklyOffer.source, "employee", "A delegated paused job can use its next weekly reservation");
  await command("processing-work", { flowerId: delegatedLot, expectedWork: weeklyOffer.token });
  equal((await read()).state.employees[0].workDays[4].usedHours, workerBudget, "Weekly reserve consumption keeps the day budget debited exactly once");
  equal((await read()).state.tasks.find(task => task.id === weeklyTask.id).processingUsedHours, 1, "Weekly reservation persists the financed hour through a fresh snapshot");
  equal((await getJob(delegatedLot)).remainingNominalHours, 3.5, "Weekly continuation preserves previous delegated progress");
  equal(await scalar("SELECT jury_score=9 FROM kq_market_lots WHERE flower_id=$1", [delegatedLot]), true, "Work accounting cannot change the original jury quality");
  const accountBeforeOtherReplay = await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]);
  equal((await command("prepare", payload, key)).replayed, true, "Original prepare can still be replayed after later days and reservations");
  equal(await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]), accountBeforeOtherReplay, "Late replay leaves all current work and payroll unchanged");
  assert(beforeStale); assert(prepared);
  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_table_privilege($1,'kq_processing_jobs','SELECT,INSERT,UPDATE,DELETE')", [role]), false, `${role} has no direct job privileges`);
    equal(await scalar("SELECT has_function_privilege($1,'rpc_kq_processing_work_quote(uuid,uuid,jsonb)','EXECUTE')", [role]), role === "service_role", `${role} quote permissions are explicit`);
  }
  equal((await scalar("SELECT rpc_kq_commerce_state($1)", [owner])).processingJobs.length, 4, "Commerce snapshot exposes only actual persisted jobs");

  // Explicit takeover starts a new segment; previous receipts and assignments
  // remain untouched. The same isolated database covers the real queue trigger.
  await db.exec("SAVEPOINT actor_choices");
  for (const existing of (await db.query("SELECT flower_id FROM kq_processing_jobs WHERE user_id=$1", [owner])).rows) await finish(existing.flower_id);
  await db.query("UPDATE kq_commerce_accounts SET business_started_at=now() WHERE user_id=$1", [owner]);
  const second = { ...structuredClone(employee), id: randomUUID(), name: "Maël", portraitCode: "mael", trait: "meticulous", skills: { ...employee.skills, processing: 100 }, workDays: { "1": { usedHours: 2, extraHours: 0 } } };
  const choiceState = engine.createKqStaffState(now);
  choiceState.employees = [{ ...structuredClone(employee), workDays: { "1": { usedHours: 1, extraHours: 0 } } }, second];
  const taskFor = (person, hours, extras = {}) => ({ id: randomUUID(), employeeId: person.id, kind: "processing", skill: "processing", hours,
    skillLevel: person.id === second.id ? 2 : 10, day: 1, status: "running", processingShift: true, processingUsedHours: 0,
    trainingCostCents: 0, startedAt: new Date(time - 60000).toISOString(), completesAt: new Date(time + 7200000).toISOString(), ...extras });
  choiceState.tasks = [taskFor(employee, 1), taskFor(second, 2)];
  await db.query("UPDATE kq_staff_accounts SET state=$2 WHERE user_id=$1", [owner, choiceState]);
  const explicitQuote = (id, work, actorId) => scalar("SELECT rpc_kq_processing_work_quote($1,$2,$3,$4)", [owner, id, work, actorId]);
  const takeoverWork = plan(4), takeoverLot = await makeLot(takeoverWork);
  const automatic = await quote(takeoverLot, takeoverWork), own = await explicitQuote(takeoverLot, takeoverWork, "player");
  equal(automatic.actorChoiceVersion, 1, "Automatic quote advertises the optional actor selector");
  equal(automatic.token, (await scalar("SELECT kq_processing_work_preview($1,$2,$3)", [owner, takeoverLot, takeoverWork])).token, "Automatic in-flight tokens remain compatible");
  equal(new Set(automatic.actors.map(person => person.id)), new Set(["player", employee.id, second.id]), "Only assigned employees and the player are offered");
  equal(model.isKqProcessingWorkQuote(own), true, "Explicit SQL quote satisfies strict client validation");
  equal([own.source, own.employee, own.efficiency], ["player", null, .55], "Taking control uses the player's actual skill despite an expert reserve");
  equal(own.token === automatic.token, false, "Explicit actor changes the confirmation token");
  await reject(() => command("prepare", { flowerId: takeoverLot, route: "rosin-trial", expectedCostCents: 0, expectedWork: automatic.token, actorId: "player" }), "processing_work_changed");
  equal(await getJob(takeoverLot), null, "Mismatched actor token rolls back the new lot");
  const specific = await explicitQuote(takeoverLot, takeoverWork, second.id);
  equal(specific.source, "employee", "Chosen employee has a usable current-day reservation");
  equal([specific.employee.id, specific.employee.level, specific.efficiency], [second.id, 2, .6 / 1.1], "Chosen employee supplies their own reserved level and trait");
  const choosePayload = { flowerId: takeoverLot, route: "rosin-trial", expectedCostCents: 0, expectedWork: specific.token, actorId: second.id }, chooseKey = randomUUID();
  const beforeChoose = await read();
  await command("prepare", choosePayload, chooseKey);
  equal(await used(), 0, "Explicit employee selection never charges the player");
  equal((await read()).state.employees.find(person => person.id === employee.id).skills, beforeChoose.state.employees.find(person => person.id === employee.id).skills, "Other employee gains no XP");
  equal((await getJob(takeoverLot)).actor.id, second.id, "Funded segment records the chosen employee");
  const afterChoose = await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]);
  equal((await command("prepare", choosePayload, chooseKey)).replayed, true, "Explicit prepare replays its original receipt");
  equal(await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]), afterChoose, "Explicit replay cannot double debit or award XP");
  await reject(() => command("prepare", { ...choosePayload, actorId: "player" }, chooseKey), "commerce_request_mismatch");
  equal((await explicitQuote(takeoverLot, null, "player")).source, "blocked", "A running funded segment cannot be reassigned");
  await finish(takeoverLot);
  const priorSegments = await scalar("SELECT segments FROM kq_processing_jobs WHERE flower_id=$1", [takeoverLot]);
  const takeover = await explicitQuote(takeoverLot, null, "player"), takeoverKey = randomUUID();
  equal(takeover.source, "player", "Player can explicitly take over a delegated paused lot");
  const takeoverPayload = { flowerId: takeoverLot, expectedWork: takeover.token, actorId: "player" };
  await command("processing-work", takeoverPayload, takeoverKey);
  equal(await used(), takeover.bookedHours, "Takeover charges only the newly funded personal hours");
  const segments = await scalar("SELECT segments FROM kq_processing_jobs WHERE flower_id=$1", [takeoverLot]);
  equal(segments.slice(0, priorSegments.length), priorSegments, "Personal takeover preserves all prior employee segments");
  const afterTakeover = await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]);
  equal((await command("processing-work", takeoverPayload, takeoverKey)).replayed, true, "Takeover request replay is idempotent");
  equal(await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [owner]), afterTakeover, "Takeover replay leaves hours and XP intact");
  const invalidLot = await makeLot(plan(1));
  equal((await explicitQuote(invalidLot, plan(1), randomUUID())).source, "blocked", "An unassigned actor never falls back to player hours");
  await reject(() => scalar("SELECT rpc_kq_processing_work_quote($1,$2,$3,$4)", [wrongOwner, invalidLot, plan(1), employee.id]), "processing_work_unavailable");
  await reject(() => explicitQuote(invalidLot, plan(1), " "), "processing_work_changed");
  await db.exec("SAVEPOINT fractional_processing_balance");
  await finish(takeoverLot);
  // Compose migration 006's real hundredth-hour ledger changes without unrelated
  // social wrapper dependencies absent from this isolated warehouse fixture.
  let fractionalCharge = await scalar("SELECT pg_get_functiondef('kq_player_work_charge(uuid,numeric)'::regprocedure)");
  fractionalCharge = fractionalCharge.replace('mod(p_hours,0.5)', 'mod(p_hours,0.01)').replace('mod(used,0.5)', 'mod(used,0.01)');
  await db.exec(fractionalCharge);
  for (const [balance, booking] of [[.49,0],[.55,.5],[4.2,4]]) {
    await db.exec("SAVEPOINT fractional_case");
    await db.query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{playerWorkDays}',jsonb_build_object('1',jsonb_build_object('usedHours',$2::numeric))) WHERE user_id=$1", [owner, 12-balance]);
    const largePlan=plan(20), fractionalLot=await makeLot(largePlan), fractional=await explicitQuote(fractionalLot,largePlan,"player");
    equal([fractional.playerRemainingHours, fractional.bookedHours], [balance, booking], `${balance} h books only complete half-hours`);
    equal(model.isKqProcessingWorkQuote(fractional), true, `${balance} h produces a valid quote`);
    const fractionalPayload={flowerId:fractionalLot,route:"rosin-trial",expectedCostCents:0,expectedWork:fractional.token,actorId:"player"};
    if(booking===0) {
      equal(fractional.source,"blocked","Less than half an hour cannot start a new segment");
      await reject(()=>command("prepare",fractionalPayload),"processing_work_exhausted");
    } else {
      await command("prepare",fractionalPayload);
      equal(await used(),Number((12-balance+booking).toFixed(2)),`${balance} h spends exactly ${booking} h and preserves the personal remainder`);
      equal(model.isKqProcessingJob(await getJob(fractionalLot)),true,"Fractional balance commits a valid persisted job");
    }
    await db.exec("ROLLBACK TO SAVEPOINT fractional_case");
  }
  await db.exec("ROLLBACK TO SAVEPOINT fractional_processing_balance");
  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_function_privilege($1,'rpc_kq_processing_work_quote(uuid,uuid,jsonb,text)','EXECUTE')", [role]), role === "service_role", `${role} actor quote permissions are explicit`);
    equal(await scalar("SELECT has_function_privilege($1,'kq_processing_work_preview_actor(uuid,uuid,jsonb,text)','EXECUTE')", [role]), false, `${role} cannot call the internal actor calculation`);
  }
  await db.exec("ROLLBACK TO SAVEPOINT actor_choices");
  await db.exec("ROLLBACK");
  console.log(`Processing work: ${checks} checks passed; ${historicalChecks} historical warehouse checks passed.`);
} catch (error) {
  console.error(error.stack ?? error, error.where ?? ""); process.exitCode = 1;
} finally { await db.close(); await vite.close(); }
