// Local PostgreSQL only. Reuse the accounting/workday/archive/weekly/trim
// integration database, then load real culture and campaign persistence bodies.
// Storage ageing/unrelated commerce retain the existing fixture boundaries;
// PGlite verifies atomicity/replay/CAS, not multi-connection contention.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";
import { setupStaffTrimDatabase } from "./test-placard-staff-trim.mjs";

async function cultureChecks({ db, vite, scalar, query, migration, section, check, rejects, read, stored }) {
  const definition = async (file, name) => {
    const sql = await migration(file);
    const start = sql.search(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\(`));
    assert(start >= 0, name);
    const end = sql.indexOf("END $$;", start);
    const simple = sql.indexOf("\n$$;", start);
    const finish = end >= 0 && (simple < 0 || end < simple) ? end + 7 : simple + 4;
    assert(finish > start, name); return sql.slice(start, finish);
  };
  await db.exec(`CREATE DOMAIN public.kq_run_status AS TEXT CHECK(VALUE IN ('active','completed','abandoned'));
    ALTER TABLE kq_runs ADD COLUMN integrity_code TEXT;
    ALTER TABLE kq_flowers ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE kq_flowers ADD COLUMN traits TEXT[],ADD COLUMN combos TEXT[],ADD COLUMN rules_version INTEGER,
      ADD COLUMN cannabinoid_report JSONB,ADD COLUMN cultivation_profile JSONB,ADD COLUMN terpene_report JSONB;`);
  const care = await definition("20261010000100_kq_culture_care.sql", "rpc_kq_update_run_state");
  await db.exec(care.replace("public.rpc_kq_update_run_state(", "public.kq_update_run_before_campaign("));
  const campaign = await migration("20261013000200_kq_shared_campaigns.sql");
  await db.exec(section(campaign, "CREATE TABLE public.kq_culture_campaigns", "-- Exact immutable")
    .replace("ALTER TABLE public.kq_runs ADD COLUMN campaign_id UUID REFERENCES public.kq_culture_campaigns(id) ON DELETE RESTRICT;", "")
    .replace("ALTER TABLE public.kq_flowers ADD COLUMN cultivation_profile JSONB,ADD COLUMN terpene_report JSONB;", ""));
  await db.exec(section(campaign, "CREATE FUNCTION public.kq_campaign_project_state", "CREATE FUNCTION public.kq_campaign_run_identity").replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"));
  await db.exec(await definition("20261013000200_kq_shared_campaigns.sql", "rpc_kq_update_run_state"));
  await db.exec(await definition("20261013000200_kq_shared_campaigns.sql", "rpc_kq_update_campaign_state"));
  const workday = await migration("20261107000500_kq_player_workday.sql");
  await db.exec(section(workday, "CREATE FUNCTION pg_temp.kq_player_work_wrap", "-- Registration list"));
  for (const name of ["update_run_state", "update_campaign_state"]) {
    await scalar("SELECT pg_temp.kq_player_work_wrap($1,'culture','p_action')", [`public.rpc_kq_${name}(uuid,uuid,timestamptz,text,jsonb,jsonb)`]);
  }
  const before = await scalar(`SELECT jsonb_build_object('staff',jsonb_agg(to_jsonb(a) ORDER BY user_id)) FROM kq_staff_accounts a`);
  await db.exec(await migration("20261108000300_kq_culture_work_steps.sql"));
  check("Culture migration leaves every existing staff account unchanged", await scalar(`SELECT jsonb_build_object('staff',jsonb_agg(to_jsonb(a) ORDER BY user_id)) FROM kq_staff_accounts a`), before);
  const game = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");
  const engine = await vite.ssrLoadModule("/src/lib/kanab-quest-staff.ts");
  const battle = await vite.ssrLoadModule("/src/lib/kanab-quest-battle.ts");
  const quoteModule = await vite.ssrLoadModule("/src/lib/kanab-quest-culture-work.ts");
  const profiles = await vite.ssrLoadModule("/src/lib/kanab-quest-buddie-cultivation.ts");
  const row = id => scalar("SELECT to_jsonb(r)||jsonb_build_object('updated_at',r.updated_at::TEXT) FROM kq_runs r WHERE id=$1", [id]);
  const quote = (user, id) => scalar("SELECT rpc_kq_culture_work_quote($1,$2)", [user, id]);
  const hours = async user => (await read(user)).state?.playerWorkDays?.[1]?.usedHours ?? 0;
  const commit = async (user, command, id = randomUUID()) => {
    const raw = await read(user), transition = engine.applyKqStaffCommand(raw, command, id);
    const result = await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,$6,$7)", [user, raw.revision, randomUUID(),
      JSON.stringify(command), JSON.stringify(transition.state), transition.debitCents, JSON.stringify(transition.effects)]);
    return { result, transition };
  };
  const player = async ({ allocation = 3, trait = "meticulous", levelXp = 8100 } = {}) => {
    const user = randomUUID(), worker = randomUUID();
    await query("INSERT INTO auth.users VALUES($1)", [user]);
    await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [user]);
    const raw = await read(user);
    check("Culture capability composes with weekly and shared trim", [raw.context.cultureWorkVersion, raw.context.weeklyPlanVersion, raw.context.trimQueueVersion], [1, 1, 2]);
    const candidate = engine.getKqStaffRecruitment(raw.context.businessStartedAt, raw.serverNow).candidates.find(c => c.contracts.includes("cdi"));
    await commit(user, { action: "hire", candidateCode: candidate.code, contract: "cdi", weeklyHours: 35, durationMonths: 0,
      reason: "permanent", expectedMonthlyCostCents: engine.getKqStaffMonthlyCost(candidate, 35).totalCents }, worker);
    // Only fixture skill/role selection: actual booking/consumption use TS + SQL.
    await query(`UPDATE kq_staff_accounts SET state=jsonb_set(jsonb_set(jsonb_set(state,'{employees,0,trait}',$2),
      '{employees,0,role}','"grower"'),'{employees,0,skills,culture}',$3) WHERE user_id=$1`, [user, JSON.stringify(trait), JSON.stringify(levelXp)]);
    if (allocation) await commit(user, { action: "assign", employeeId: worker, kind: "culture", hours: allocation, expectedCostCents: 0 });
    return { user, worker };
  };
  const start = async (user, override = {}) => {
    const id = randomUUID(), state = { ...game.startKqGame(123), ...override };
    state.care = { ...state.care, vitality: 80 };
    await query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3,'active')", [id, user, JSON.stringify(state)]);
    return row(id);
  };
  const rollParams = (user, run, choice = "auto", next = game.rollKqDice(run.state), members = null) =>
    [user, run.id, run.updated_at, JSON.stringify(next), members === null ? null : JSON.stringify(members), choice];
  const roll = params => scalar("SELECT rpc_kq_roll_culture_step($1,$2,$3,$4,$5,$6)", params);
  const persist = async (user, run, action, state) => {
    const flower = state.phase === "complete" && !state.cultureDead ? battle.createKqFlower(state) : null;
    return scalar("SELECT rpc_kq_update_run_state($1,$2,$3,$4,$5,$6)", [user, run.id, run.updated_at, action, JSON.stringify(state),
      flower ? JSON.stringify({ varietyCode: state.varietyCode, varietyName: state.varietyName, quality: state.quality,
        traits: state.traits, combos: state.combos, battleStats: flower.stats, integrityCode: flower.integrityCode,
        cannabinoidReport: flower.cannabinoidReport }) : null]);
  };
  const whole = user => scalar(`SELECT jsonb_build_object('staff',(SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1),
    'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM kq_runs r WHERE user_id=$1),
    'work',(SELECT jsonb_agg(to_jsonb(w) ORDER BY run_id,stage_index) FROM kq_culture_work_steps w WHERE user_id=$1),
    'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
    'archive',(SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,record_id) FROM kq_staff_archive a WHERE user_id=$1),
    'journal',(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM kq_treasury_journal j WHERE user_id=$1))`, [user]);
  const unchanged = async (name, user, call, pattern) => {
    const saved = await whole(user); await rejects(name, call, pattern); check(`${name}: atomic rollback`, await whole(user), saved);
  };

  const expert = await player(), run = await start(expert.user), startQuote = await quote(expert.user, run.id);
  check("Quote selects booked Culture employee with exact half hour and skill", [startQuote.source, startQuote.stepHours, startQuote.employee.level, startQuote.employee.remainingHours], ["employee", .5, 10, 3]);
  check("Quote obeys shared UI validator", quoteModule.isKqCultureWorkQuote(startQuote), true);
  const stable = await whole(expert.user); await quote(expert.user, run.id);
  check("Quote performs no settlement, clock, revision or ledger write", await whole(expert.user), stable);
  const firstParams = rollParams(expert.user, run), first = await roll(firstParams);
  check("Roll applies employee bonus before resolution and preserves dice/history", [first.state.care.vitality, first.state.care.terpenes,
    first.state.dice, first.state.history], [81, run.state.care.terpenes + 1, game.rollKqDice(run.state).dice, []]);
  check("Employee stage consumes reservation without touching player/booked hours", [await hours(expert.user),
    (await read(expert.user)).state.tasks[0].cultureUsedHours, (await read(expert.user)).state.employees[0].workDays[1].usedHours], [0, .5, 3]);
  await unchanged("Archive trigger forbids silently removing a used running reservation", expert.user, async () => {
    const raw = await read(expert.user);
    return scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,0,'[]')", [expert.user, raw.revision, randomUUID(),
      '{"action":"settle"}', JSON.stringify({ ...raw.state, tasks: [], lastSettledAt: raw.serverNow })]);
  }, /staff_archive_changed/);
  check("Paid quote is valid and shows actual consumed work", [quoteModule.isKqCultureWorkQuote(first.cultureWork), first.cultureWork.paid, first.cultureWork.employee.usedHours], [true, true, .5]);
  const firstStored = await whole(expert.user);
  check("Exact retry returns recorded work", (await roll(firstParams)).cultureWork, first.cultureWork);
  check("Exact retry changes no account, care, archive or receipt", await whole(expert.user), firstStored);
  await unchanged("A changed retry cannot charge the same stage again", expert.user,
    () => roll([...firstParams.slice(0, 5), "player"]), /culture_work_changed/);
  let total = { ...first.cultureWork.bonus };
  for (let stage = 0; stage < 6; stage++) {
    let current = await row(run.id);
    if (stage) {
      const result = await roll(rollParams(expert.user, current));
      for (const key of Object.keys(total)) total[key] += result.cultureWork.bonus[key];
      current = await row(run.id);
    }
    const usedBefore = await hours(expert.user);
    await persist(expert.user, current, "resolve", game.resolveKqStage({ ...current.state, dice: [6, 6, 6] }));
    current = await row(run.id);
    await persist(expert.user, current, "advance", game.advanceKqStage(current.state));
    check(`Stage ${stage + 1}: resolve/advance do not consume extra work`, await hours(expert.user), usedBefore);
  }
  const finished = await read(expert.user), finalRun = await row(run.id);
  check("Six rolls consume exactly three reserved hours", [finished.state.tasks[0].cultureUsedHours, finished.state.tasks[0].status,
    finished.state.employees[0].completedTasks, await hours(expert.user)], [3, "completed", 1, 0]);
  check("Half-hour bonuses sum to historical three-hour specialist formula", total, { vitality: 3, terpenes: 4, yieldPercent: 1, cannabinoids: 3 });
  check("Harvest persists actual enriched chemistry and all six resolutions", [finalRun.state.history.length,
    await scalar("SELECT cannabinoid_report->'score'=($2::jsonb->'care'->'cannabinoidExpression') FROM kq_flowers WHERE run_id=$1", [run.id, JSON.stringify(finalRun.state)])], [6, true]);
  check("Exhausted task is archived with final used hours", await scalar("SELECT payload->'cultureUsedHours' FROM kq_staff_archive WHERE user_id=$1 AND kind='task'", [expert.user]), 3);
  const afterFinal = await whole(expert.user); await roll(firstParams);
  check("Completed culture can replay its first stage without reopening or rewarding", await whole(expert.user), afterFinal);
  const finalQuote = await quote(expert.user, run.id);
  check("Completed quote remains a valid actual last-stage receipt", [quoteModule.isKqCultureWorkQuote(finalQuote), finalQuote.phase, finalQuote.paid], [true, "complete", true]);
  const exhaustedRun = await start(expert.user);
  check("Archived exhausted reservation blocks silent player fallback", (await quote(expert.user, exhaustedRun.id)).source, "blocked");
  await unchanged("Auto cannot overconsume exhausted reservation", expert.user, () => roll(rollParams(expert.user, exhaustedRun)), /culture_work_exhausted/);
  await unchanged("Forged player relay cannot bypass exhausted delegation", expert.user,
    () => roll(rollParams(expert.user, exhaustedRun, "player")), /culture_work_changed/);
  // Completed tasks may be compacted; the durable archive still forbids fallback.
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{tasks}','[]') WHERE user_id=$1", [expert.user]);
  check("Compacting exhausted tasks preserves delegated actor and block", [(await quote(expert.user, exhaustedRun.id)).source,
    (await quote(expert.user, exhaustedRun.id)).employee.id], ["blocked", expert.worker]);
  await unchanged("Archived reservation cannot become free personal fallback", expert.user,
    () => roll(rollParams(expert.user, exhaustedRun)), /culture_work_exhausted/);
  await commit(expert.user, { action: "assign", employeeId: expert.worker, kind: "culture", hours: .5, expectedCostCents: 0 });
  check("Adding an eligible reservation releases the blocked stage", (await quote(expert.user, exhaustedRun.id)).source, "employee");
  await roll(rollParams(expert.user, exhaustedRun));
  check("Added Culture reservation preserves player gauge", await hours(expert.user), 0);

  const twoHours = await player({ allocation: 2 }), twoHourRun = await start(twoHours.user);
  for (let stage = 0; stage < 6; stage++) {
    let currentStep = await row(twoHourRun.id);
    if (stage === 4) {
      check("Two-hour allocation covers exactly the first four stages", [(await read(twoHours.user)).state.tasks[0].cultureUsedHours,
        (await quote(twoHours.user, twoHourRun.id)).source, await hours(twoHours.user)], [2, "blocked", 0]);
      await unchanged("Fifth stage waits after the two-hour allocation", twoHours.user,
        () => roll(rollParams(twoHours.user, currentStep)), /culture_work_exhausted/);
      await commit(twoHours.user, { action: "assign", employeeId: twoHours.worker, kind: "culture", hours: 1, expectedCostCents: 0 });
    }
    await roll(rollParams(twoHours.user, currentStep));
    currentStep = await row(twoHourRun.id); await persist(twoHours.user, currentStep, "resolve", game.resolveKqStage({ ...currentStep.state, dice: [6, 6, 6] }));
    currentStep = await row(twoHourRun.id); await persist(twoHours.user, currentStep, "advance", game.advanceKqStage(currentStep.state));
  }
  check("Adding one hour finishes the last two stages without player work", [(await read(twoHours.user)).state.tasks.map(task => task.cultureUsedHours),
    await hours(twoHours.user), (await row(twoHourRun.id)).state.phase], [[2, 1], 0, "complete"]);

  const learner = await player({ allocation: 1, trait: "learner", levelXp: 0 }), learnerRun = await start(learner.user);
  const oldRaw = await read(learner.user);
  await roll(rollParams(learner.user, learnerRun));
  let current = await row(learnerRun.id);
  await persist(learner.user, current, "resolve", game.resolveKqStage({ ...current.state, dice: [6, 6, 6] }));
  current = await row(learnerRun.id); await persist(learner.user, current, "advance", game.advanceKqStage(current.state));
  await roll(rollParams(learner.user, await row(learnerRun.id)));
  check("Learner XP uses cumulative rounding: two half hours award fifteen", (await read(learner.user)).state.employees[0].skills.culture, 15);
  await rejects("Stale staff snapshots cannot restore consumed Culture hours", () => scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,0,'[]')", [learner.user,
    oldRaw.revision, randomUUID(), '{"action":"settle"}', JSON.stringify({ ...oldRaw.state, lastSettledAt: oldRaw.serverNow })]), /staff_changed/);

  const blocked = await player({ allocation: 2 }), blockedRun = await start(blocked.user);
  await query(`UPDATE kq_staff_accounts SET state=jsonb_set(state,'{payroll}',$2) WHERE user_id=$1`, [blocked.user, JSON.stringify([
    { id: "unpaid-culture", employeeId: blocked.worker, dueAt: blockedRun.updated_at, grossCents: 100, employerCents: 0, indemnityCents: 0, totalCents: 100, paidCents: 0 }])]);
  check("Overdue wages block delegated reservation", (await quote(blocked.user, blockedRun.id)).source, "blocked");
  await unchanged("Unpaid employee cannot consume reserved hours", blocked.user, () => roll(rollParams(blocked.user, blockedRun)), /culture_work_exhausted/);
  await unchanged("No player bypass is permitted during payroll debt", blocked.user,
    () => roll(rollParams(blocked.user, blockedRun, "player")), /culture_work_changed/);

  const interday = await player({ allocation: 1 }), interdayRun = await start(interday.user);
  await roll(rollParams(interday.user, interdayRun));
  current = await row(interdayRun.id);
  await persist(interday.user, current, "resolve", game.resolveKqStage({ ...current.state, dice: [6, 6, 6] }));
  current = await row(interdayRun.id); await persist(interday.user, current, "advance", game.advanceKqStage(current.state));
  await query("UPDATE kq_commerce_accounts SET business_started_at=business_started_at-interval '4 hours' WHERE user_id=$1", [interday.user]);
  const nextDay = await quote(interday.user, interdayRun.id);
  check("Next day without a new reservation preserves delegation and actor", [nextDay.day, nextDay.source, nextDay.employee.id], [2, "blocked", interday.worker]);
  await unchanged("No implicit player charge on a later day", interday.user, async () => roll(rollParams(interday.user, await row(interdayRun.id))), /culture_work_exhausted/);
  await commit(interday.user, { action: "assign", employeeId: interday.worker, kind: "culture", hours: .5, expectedCostCents: 0 });
  check("Next working day reservation unlocks delegated culture", (await quote(interday.user, interdayRun.id)).source, "employee");
  await roll(rollParams(interday.user, await row(interdayRun.id)));
  current = await row(interdayRun.id); await persist(interday.user, current, "resolve", game.resolveKqStage({ ...current.state, dice: [6, 6, 6] }));
  current = await row(interdayRun.id); await persist(interday.user, current, "advance", game.advanceKqStage(current.state));
  await query("UPDATE kq_commerce_accounts SET business_started_at=business_started_at-interval '16 hours' WHERE user_id=$1", [interday.user]);
  const weekend = await quote(interday.user, interdayRun.id);
  check("Weekend without reservation stays delegated instead of personal", [weekend.day, weekend.source, weekend.employee.id], [6, "blocked", interday.worker]);

  const invalid = await player({ allocation: 1 }), invalidRun = await start(invalid.user);
  const forgedStaff = async mutate => {
    const raw = await read(invalid.user), state = structuredClone(raw.state); state.lastSettledAt = raw.serverNow; mutate(state);
    return scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4,$5,0,'[]')", [invalid.user, raw.revision, randomUUID(), '{"action":"settle"}', JSON.stringify(state)]);
  };
  await unchanged("Engine commits cannot invent consumed Culture hours", invalid.user,
    () => forgedStaff(state => { state.tasks[0].cultureUsedHours = .5; }), /culture_work_changed/);
  await unchanged("Engine commits cannot enlarge an existing reservation", invalid.user,
    () => forgedStaff(state => { state.tasks[0].hours = 2; }), /culture_work_changed/);
  await unchanged("Old applications cannot drop the Culture reservation marker", invalid.user,
    () => forgedStaff(state => { delete state.tasks[0].cultureShift; delete state.tasks[0].cultureUsedHours; }), /culture_work_changed/);
  await unchanged("Old update RPC still forbids a flower on roll", invalid.user,
    () => scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'roll',$4,'{}')", [invalid.user, invalidRun.id, invalidRun.updated_at,
      JSON.stringify(game.rollKqDice(invalidRun.state))]), /kq_flower_before_completion/);
  await unchanged("Original immutable-seed guard rolls back hours, XP and ledger", invalid.user,
    () => roll(rollParams(invalid.user, invalidRun, "auto", { ...game.rollKqDice(invalidRun.state), seed: 999 })), /kq_invalid_state_transition/);
  const other = await player({ allocation: 0 });
  await unchanged("Foreign culture is unavailable without any debit", other.user, () => roll(rollParams(other.user, invalidRun)), /kq_run_unavailable/);
  await unchanged("Caller cannot invent care on a roll", invalid.user, () => roll(rollParams(invalid.user, invalidRun, "auto",
    { ...game.rollKqDice(invalidRun.state), care: { ...invalidRun.state.care, vitality: 99 } })), /culture_work_changed/);
  const legacy = await start(other.user);
  await query("UPDATE kq_runs SET state=$2 WHERE id=$1", [legacy.id, JSON.stringify(game.rollKqDice(legacy.state))]);
  const legacyQuote = await quote(other.user, legacy.id);
  check("Pre-ledger rolled culture is free and never invents paid evidence", [legacyQuote.paid, legacyQuote.source, legacyQuote.employee, legacyQuote.bonus,
    quoteModule.isKqCultureWorkQuote(legacyQuote)], [false, "player", null, { vitality: 0, terpenes: 0, yieldPercent: 0, cannabinoids: 0 }, true]);
  await persist(other.user, await row(legacy.id), "resolve", game.resolveKqStage({ ...game.rollKqDice(legacy.state), dice: [6, 6, 6] }));
  check("Legacy resolution never retroactively bills player", await hours(other.user), 0);
  const solo = await start(other.user);
  const soloResult = await persist(other.user, solo, "roll", game.rollKqDice(solo.state));
  check("Old update RPC also records one player stage through the new ledger", [soloResult.cultureWork.source, await hours(other.user)], ["player", .5]);

  const weekly = await player({ allocation: 0 });
  await commit(weekly.user, { action: "set-weekly-plan", employeeId: weekly.worker, enabled: true,
    days: Array.from({ length: 5 }, () => [{ kind: "culture", hours: 1 }]), expectedWeeklyCostCents: 0 });
  const weeklyRaw = await read(weekly.user), weeklyState = structuredClone(weeklyRaw.state);
  const shift = value => new Date(Date.parse(value) - 4 * 3600_000).toISOString();
  weeklyState.lastSettledAt = shift(weeklyState.lastSettledAt);
  weeklyState.employees[0].hiredAt = shift(weeklyState.employees[0].hiredAt);
  weeklyState.employees[0].weeklyPlan.updatedAt = shift(weeklyState.employees[0].weeklyPlan.updatedAt);
  await query("UPDATE kq_commerce_accounts SET business_started_at=business_started_at-interval '4 hours' WHERE user_id=$1", [weekly.user]);
  await query("UPDATE kq_staff_accounts SET state=$2 WHERE user_id=$1", [weekly.user, JSON.stringify(weeklyState)]);
  const auto = await commit(weekly.user, { action: "settle" });
  check("Real weekly scheduler reserves Culture with zero initial use", [auto.result.state.tasks[0].cultureShift,
    auto.result.state.tasks[0].cultureUsedHours, auto.result.state.tasks[0].weeklyCostCents], [true, 0, 0]);
  const weeklyRun = await start(weekly.user); await roll(rollParams(weekly.user, weeklyRun));
  const used = await read(weekly.user), usedXp = used.state.employees[0].skills.culture;
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{tasks,0,completesAt}',to_jsonb(now()-interval '1 second')) WHERE user_id=$1", [weekly.user]);
  const expired = await commit(weekly.user, { action: "settle" });
  check("Weekly expiry preserves SQL progress without a second XP/bonus reward", [expired.result.state.tasks[0].cultureUsedHours,
    expired.result.state.tasks[0].status, expired.result.state.employees[0].skills.culture,
    expired.result.state.employees[0].completedTasks, expired.transition.effects], [.5, "completed", usedXp, 1, []]);

  // Actual campaign validator and sync trigger: one shared charge, distinct
  // member identities, enriched projections, exact receipt replay.
  const campaignUser = await player({ allocation: 1 }), campaignId = randomUUID(), memberIds = [randomUUID(), randomUUID()];
  const memberStates = memberIds.map((id, i) => {
    const state = game.startKqGame(123, { varietyCode: `HH2026-00${i + 1}` });
    return { ...state, warehouse: null, energy: null, cultivationProfile: profiles.getKqBuddieCultivationProfile(state.varietyCode) };
  });
  const manifest = { version: 1, id: campaignId, leaderRunId: memberIds[0], members: memberIds.map(runId => ({ runId })) };
  await db.exec("BEGIN");
  await query("INSERT INTO kq_culture_campaigns(id,user_id,leader_run_id,request_key,request,manifest) VALUES($1,$2,$3,$4,'{}',$5)",
    [campaignId, campaignUser.user, memberIds[0], randomUUID(), JSON.stringify(manifest)]);
  for (let i = 0; i < 2; i++) await query("INSERT INTO kq_runs(id,user_id,campaign_id,state) VALUES($1,$2,$3,$4)",
    [memberIds[i], campaignUser.user, campaignId, JSON.stringify({ ...memberStates[i], campaign: manifest })]);
  await db.exec("COMMIT");
  const leader = await row(memberIds[0]), next = game.rollKqDice(leader.state);
  const members = await Promise.all(memberIds.map(async runId => ({ runId, flower: null, state: await scalar("SELECT kq_campaign_project_state($1,$2)",
    [JSON.stringify(next), JSON.stringify((await row(runId)).state)]) })));
  const campaignParams = rollParams(campaignUser.user, leader, "auto", next, members);
  await unchanged("Campaign projection mismatch rolls back employee work", campaignUser.user,
    () => roll(rollParams(campaignUser.user, leader, "auto", next, [{ ...members[0], state: { ...members[0].state, quality: 99 } }, members[1]])), /kq_campaign_members_changed/);
  const campaignResult = await roll(campaignParams);
  check("Campaign shares one half-hour reservation across both cultures", [(await read(campaignUser.user)).state.tasks[0].cultureUsedHours,
    await scalar("SELECT count(*)::INTEGER FROM kq_culture_work_steps WHERE user_id=$1", [campaignUser.user])], [.5, 1]);
  check("Actual campaign sync receives enriched care for every member", (await row(memberIds[1])).state.care, campaignResult.state.care);
  check("Member quote resolves the canonical leader and recorded actor", (await quote(campaignUser.user, memberIds[1])).runId, memberIds[0]);
  const campaignAfter = await whole(campaignUser.user); await roll(campaignParams);
  check("Campaign lost-response retry survives enriched inner receipt", await whole(campaignUser.user), campaignAfter);

  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`${role}: stage ledger is private`, await scalar("SELECT has_table_privilege($1,'public.kq_culture_work_steps','SELECT,INSERT,UPDATE,DELETE')", [role]), false);
    for (const signature of ["kq_culture_work_roll(uuid,uuid,timestamptz,jsonb,jsonb,text)", "kq_culture_work_preview(uuid,uuid,text)",
      "kq_culture_work_totals(numeric,integer,text,text)", "kq_culture_work_validate_staff(uuid,jsonb)", "kq_staff_snapshot_before_culture_work(uuid)"]) {
      check(`${role}: private ${signature}`, await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false);
    }
    for (const signature of ["rpc_kq_roll_culture_step(uuid,uuid,timestamptz,jsonb,jsonb,text)", "rpc_kq_culture_work_quote(uuid,uuid)"]) {
      check(`${role}: service-only ${signature}`, await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), role === "service_role");
    }
  }
  check("All old Culture gestures are free except stage roll and care purchase", await scalar(`SELECT jsonb_object_agg(action,kq_player_work_cost('culture',action))
    FROM unnest(ARRAY['start','roll','resolve','advance','redraw','heritage','card','heritage-swap','care','buy-care']) action`),
    { start: 0, roll: .5, resolve: 0, advance: 0, redraw: 0, heritage: 0, card: 0, "heritage-swap": 0, care: 0, "buy-care": .5 });
  check("Quote RPC is stable/read-only", await scalar("SELECT provolatile='s' FROM pg_proc WHERE oid='rpc_kq_culture_work_quote(uuid,uuid)'::regprocedure"), true);

  // Composition with the later skill-speed migration: personal gestures now
  // leave hundredths, while Culture still books/consumes half-hour steps.
  const skillSpeed = await migration("20261108000600_kq_communication_work_speed.sql");
  await db.exec(section(skillSpeed, "-- Hundredths retain", "-- Preserve each existing lock"));
  const fractionalEmployee = await player({ allocation: .5 }), fractionalEmployeeRun = await start(fractionalEmployee.user);
  await scalar("SELECT kq_player_work_charge($1,7.8)", [fractionalEmployee.user]);
  const fractionalEmployeeQuote = await quote(fractionalEmployee.user, fractionalEmployeeRun.id);
  check("An employee can cover Culture when the player's measured balance is 4.2 h", [quoteModule.isKqCultureWorkQuote(fractionalEmployeeQuote), fractionalEmployeeQuote.source, fractionalEmployeeQuote.playerRemainingHours], [true, "employee", 4.2]);
  const fractionalEmployeeParams = rollParams(fractionalEmployee.user, fractionalEmployeeRun);
  const fractionalEmployeeResult = await roll(fractionalEmployeeParams);
  check("Employee roll preserves the fractional player balance and consumes only 0.5 reserved h", [quoteModule.isKqCultureWorkQuote(fractionalEmployeeResult.cultureWork), fractionalEmployeeResult.cultureWork.playerRemainingHours,
    (await read(fractionalEmployee.user)).state.tasks[0].cultureUsedHours, await hours(fractionalEmployee.user)], [true, 4.2, .5, 7.8]);
  const employeeAfter = await whole(fractionalEmployee.user);
  await roll(fractionalEmployeeParams);
  check("Retry with a fractional personal balance does not double charge either worker", await whole(fractionalEmployee.user), employeeAfter);

  const fractionalPlayer = await player({ allocation: 0 }), fractionalPlayerRun = await start(fractionalPlayer.user);
  await scalar("SELECT kq_player_work_charge($1,.45)", [fractionalPlayer.user]);
  const fractionalPlayerQuote = await quote(fractionalPlayer.user, fractionalPlayerRun.id);
  check("A skilled gesture leaves an admissible 11.55 h personal quote", [quoteModule.isKqCultureWorkQuote(fractionalPlayerQuote), fractionalPlayerQuote.source, fractionalPlayerQuote.playerRemainingHours], [true, "player", 11.55]);
  const fractionalPlayerResult = await roll(rollParams(fractionalPlayer.user, fractionalPlayerRun));
  check("A personal Culture roll subtracts exactly 0.5 h without rounding the remainder", [quoteModule.isKqCultureWorkQuote(fractionalPlayerResult.cultureWork), fractionalPlayerResult.cultureWork.playerRemainingHours, await hours(fractionalPlayer.user)], [true, 11.05, .95]);

  const fractionalEmpty = await player({ allocation: 0 }), fractionalEmptyRun = await start(fractionalEmpty.user);
  await scalar("SELECT kq_player_work_charge($1,11.55)", [fractionalEmpty.user]);
  const fractionalEmptyQuote = await quote(fractionalEmpty.user, fractionalEmptyRun.id);
  check("An insufficient fractional balance is a valid blocked quote, not an unavailable quote", [quoteModule.isKqCultureWorkQuote(fractionalEmptyQuote), fractionalEmptyQuote.source, fractionalEmptyQuote.playerRemainingHours], [true, "blocked", .45]);
  await unchanged("Insufficient fractional hours still block the authoritative roll", fractionalEmpty.user,
    () => roll(rollParams(fractionalEmpty.user, fractionalEmptyRun)), /culture_work_exhausted|player_work_exhausted/);
}

let source = (await readFile(new URL("./test-placard-shared-trim.mjs", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const anchor = '  console.log(`Shared TRIM and weekly-plan SQL: ${checks.length} checks passed (isolated PGlite).`);';
assert(source.includes(anchor), "Shared staff integration fixture marker changed");
source = source.replace(anchor, `  await cultureChecks({ db, vite, scalar, query, migration, section, check, rejects, read, stored });
  console.log(\`Culture steps + staff/trim/weekly SQL: \${checks.length} checks passed (isolated PGlite).\`);`)
  .replace(/^import .*;\n/gm, "");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "PGlite", "createServer", "setupStaffTrimDatabase", "cultureChecks", source)(
  assert, randomUUID, readFile, path, PGlite, createServer, setupStaffTrimDatabase, cultureChecks);
