// Isolated PostgreSQL integration checks: real staff/social SQL, workday helpers,
// and every generated wrapper. Absent business commands use explicit boundary
// fixtures for receipts/debits; their economics remain in their existing suites.
// PGlite has one connection: this verifies transaction rollback/CAS, not lock contention.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import { setupStaffDatabase } from "./test-placard-staff.mjs";

const db = new PGlite(), checks = [];
const query = (sql, values = []) => db.query(sql, values);
const scalar = async (sql, values = []) => Object.values((await query(sql, values)).rows[0])[0];
const migration = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const section = (source, first, last) => {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, `Fixture anchors: ${first}`); return source.slice(start, end);
};
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const commit = (user, revision, key, command, state, debit = 0, effects = []) => scalar(
  "SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)",
  [user, revision, key, JSON.stringify(command), JSON.stringify(state), debit, JSON.stringify(effects)]);
const staffState = snapshot => ({ version: 1, employees: [], tasks: [], payroll: [],
  supplierDiscountPercent: 0, supplierDiscountUntil: null, playerWorkDays: {},
  ...(snapshot.state ?? {}), lastSettledAt: snapshot.serverNow });
const hours = async user => Number(await scalar(`SELECT COALESCE((state->'playerWorkDays'->
  kq_player_work_day($1)::TEXT->>'usedHours')::NUMERIC,0) FROM kq_staff_accounts WHERE user_id=$1`, [user]) ?? 0);
const stored = user => scalar(`SELECT jsonb_build_object(
  'staff',(SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1),
  'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
  'staffReceipts',(SELECT count(*) FROM kq_staff_receipts WHERE user_id=$1),
  'boundaryReceipts',(SELECT count(*) FROM test_work_receipts WHERE user_id=$1),
  'social',(SELECT to_jsonb(a) FROM kq_social_accounts a WHERE user_id=$1),
  'platforms',(SELECT jsonb_agg(to_jsonb(p) ORDER BY platform) FROM kq_social_platforms p WHERE user_id=$1),
  'online',(SELECT to_jsonb(a) FROM kq_online_accounts a WHERE user_id=$1),
  'socialReceipts',(SELECT count(*) FROM kq_social_v2_receipts WHERE user_id=$1),
  'journal',(SELECT count(*) FROM kq_treasury_journal WHERE user_id=$1),
  'settlements',(SELECT count(*) FROM test_settlement_observations WHERE user_id=$1))`, [user]);
async function rejectUnchanged(name, user, action, pattern) {
  const before = await stored(user);
  await assert.rejects(action, pattern, name);
  check(`${name}; transaction unchanged`, await stored(user), before);
}
async function player() {
  const id = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [id]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [id]);
  await read(id);
  return id;
}
const commerce = (user, action, key = randomUUID(), payload = {}) => scalar(
  "SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4)", [user, action, JSON.stringify(payload), key]);
const online = (user, action, key = randomUUID(), payload = {}) => scalar(
  "SELECT rpc_kq_online_command($1,$2,$3::jsonb,$4)", [user, action, JSON.stringify(payload), key]);
async function personal(user, kind, amount, { trim = false, key = randomUUID(), mutate = state => state } = {}) {
  const snapshot = await scalar("SELECT kq_staff_snapshot($1)", [user]), state = staffState(snapshot);
  const day = await scalar("SELECT kq_player_work_day($1)", [user]);
  state.playerWorkDays = { ...state.playerWorkDays, [day]: { usedHours: (state.playerWorkDays[day]?.usedHours ?? 0) + amount } };
  state.tasks = [...state.tasks, { id: randomUUID(), employeeId: "player", kind, hours: amount, day, status: "running" }];
  const command = trim ? { action: "trim", employeeId: null, hours: amount, flowerId: randomUUID(), mode: "manual", expectedCostCents: 0 }
    : { action: "player-assign", kind, hours: amount, expectedCostCents: 0 };
  const result = await commit(user, snapshot.revision, key, command, mutate(state));
  return { result, command, state, revision: snapshot.revision, key };
}

// Copy declarations, never invent public RPC signatures or their defaults.
async function sourceDeclarations() {
  const declarations = new Map();
  const names = (await readdir(path.resolve("supabase/migrations"))).filter(name => name.endsWith(".sql")).sort();
  for (const filename of names) {
    const source = await migration(filename);
    const pattern = /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+public\.(\w+)\s*\(/gi;
    for (const match of source.matchAll(pattern)) {
      const start = match.index + match[0].length;
      let end = start, depth = 1, quote = false;
      for (; end < source.length && depth; end++) {
        if (source[end] === "'") {
          if (quote && source[end + 1] === "'") { end++; continue; }
          quote = !quote;
        } else if (!quote && source[end] === "(") depth++;
        else if (!quote && source[end] === ")") depth--;
      }
      if (/^\s*RETURNS\s+JSONB\b/i.test(source.slice(end))) {
        declarations.set(match[1], { args: source.slice(start, end - 1), filename });
      }
    }
  }
  return declarations;
}

try {
  await setupStaffDatabase(db);
  await db.exec(await migration("20261025000200_kq_social_sponsor_fees.sql"));
  const trim = await migration("20261107000200_kq_staff_trim.sql");
  // This suite tests shared hours, not trim work effects: apply the exact real
  // whitelist prerequisite without loading the independent harvest/trim fixture.
  await db.exec(section(trim, "CREATE FUNCTION pg_temp.kq_staff_trim_patch", "SELECT pg_temp.kq_staff_trim_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',\n 'IF effect_kind"));
  await db.exec(`
    CREATE TABLE test_work_receipts(user_id UUID,request_key UUID,command JSONB,PRIMARY KEY(user_id,request_key));
    CREATE FUNCTION test_work_boundary(p_user UUID,p_key UUID,p_action TEXT,p_payload JSONB DEFAULT '{}') RETURNS JSONB
    LANGUAGE plpgsql AS $$ DECLARE previous JSONB; replay BOOLEAN; command JSONB:=jsonb_build_object('action',p_action,'payload',p_payload);
    BEGIN
      SELECT r.command INTO previous FROM test_work_receipts r WHERE user_id=p_user AND request_key=p_key;
      replay:=FOUND;
      IF replay AND previous IS DISTINCT FROM command THEN RAISE EXCEPTION 'boundary_request_mismatch'; END IF;
      IF NOT replay THEN
        UPDATE kq_equipment_wallets SET cash_cents=cash_cents-10 WHERE user_id=p_user;
        INSERT INTO test_work_receipts VALUES(p_user,p_key,command);
      END IF;
      IF p_payload->'nested'='true'::JSONB THEN RETURN jsonb_build_object('receipt',jsonb_build_object('replayed',replay)); END IF;
      RETURN jsonb_build_object('replayed',replay);
    END $$;
    CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT,tent_number INTEGER,slot TEXT);
    CREATE FUNCTION kq_equipment_storage_tent_for_user(p_user UUID,p_code TEXT,p_tent INTEGER) RETURNS INTEGER
    LANGUAGE sql AS $$ SELECT p_tent $$;
    CREATE FUNCTION public.kq_commerce_command_before_invoice_batch(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
    LANGUAGE plpgsql AS $$ BEGIN
      IF p_action='create-shop' THEN RETURN public.rpc_kq_online_command(p_user_id,'upgrade-site',p_payload,p_request_key); END IF;
      RETURN test_work_boundary(p_user_id,p_request_key,p_action,p_payload);
    END $$;
  `);
  const source = await migration("20261107000500_kq_player_workday.sql");
  const registrations = [...source.matchAll(/SELECT pg_temp\.kq_player_work_wrap\('([^']+)'/g)].map(match => match[1]);
  assert(registrations.length >= 23, "All production entrypoints must be registered");
  const declarations = await sourceDeclarations(), originals = new Map();
  for (const signature of registrations) {
    const name = signature.match(/public\.(\w+)\(/)[1], declaration = declarations.get(name);
    assert(declaration, `Production declaration for ${signature}`);
    if (!(await scalar("SELECT to_regprocedure($1)::TEXT", [signature]))) {
      const key = /\bp_request_key\b/i.test(declaration.args) ? "p_request_key" : "gen_random_uuid()";
      const action = /\bp_action\b/i.test(declaration.args) ? "p_action" : `'${name}'`;
      const payload = /\bp_payload\b/i.test(declaration.args) ? "p_payload" : "'{}'::JSONB";
      let body = `RETURN test_work_boundary(p_user_id,${key},${action},${payload});`;
      if (name === "rpc_kq_commerce_command") body = "RETURN public.kq_commerce_command_before_invoice_batch(p_user_id,p_action,p_payload,p_request_key);";
      if (name === "rpc_kq_purchase_workshop_tier") body = `
        IF EXISTS(SELECT 1 FROM test_work_receipts WHERE user_id=p_user_id AND request_key=p_request_key) THEN
          RETURN test_work_boundary(p_user_id,p_request_key,'workshop-tier'); END IF;
        PERFORM public.rpc_kq_purchase_tent_equipment(p_user_id,md5(p_request_key::TEXT||':purchase')::UUID,ARRAY[p_equipment_code],1);
        PERFORM public.rpc_kq_upgrade_tent_equipment(p_user_id,md5(p_request_key::TEXT||':upgrade')::UUID,p_equipment_code,1,1);
        RETURN test_work_boundary(p_user_id,p_request_key,'workshop-tier');`;
      await db.exec(`CREATE FUNCTION public.${name}(${declaration.args}) RETURNS JSONB LANGUAGE plpgsql AS $$ BEGIN ${body} END $$;`);
    }
    originals.set(signature, await scalar("SELECT pg_get_function_arguments($1::regprocedure)", [signature]));
  }
  const bankArgs = declarations.get("rpc_kq_bank")?.args;
  assert(bankArgs, "Bank production declaration");
  await db.exec(`CREATE FUNCTION public.rpc_kq_bank(${bankArgs}) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
 RETURN '{}'::JSONB;
END $$;`);
  await db.exec(source);
  for (const [signature, args] of originals) {
    check(`Preserves declared arguments/defaults: ${signature}`, await scalar("SELECT pg_get_function_arguments($1::regprocedure)", [signature]), args);
    const inner = signature.replace("rpc_kq_", "kq_work_inner_");
    check(`Public wrapper grant/private inner: ${signature}`, await scalar(`SELECT jsonb_build_array(
      has_function_privilege('service_role',$1,'EXECUTE'),has_function_privilege('anon',$1,'EXECUTE'),
      has_function_privilege('authenticated',$1,'EXECUTE'),has_function_privilege('service_role',$2,'EXECUTE'),
      has_function_privilege('anon',$2,'EXECUTE'),has_function_privilege('authenticated',$2,'EXECUTE'))`, [signature, inner]), [true, false, false, false, false, false]);
  }
  for (const signature of ["kq_player_work_day(uuid,timestamptz)", "kq_player_work_cost(text,text)", "kq_player_work_charge(uuid,numeric)", "kq_player_work_validate_staff(uuid,jsonb,jsonb)"]) {
    check(`Private canonical helper: ${signature}`, await scalar(`SELECT jsonb_build_array(
      has_function_privilege('service_role',$1,'EXECUTE'),has_function_privilege('anon',$1,'EXECUTE'),
      has_function_privilege('authenticated',$1,'EXECUTE'))`, [signature]), [false, false, false]);
  }
  const bankBody = await scalar("SELECT pg_get_functiondef('rpc_kq_bank(uuid,jsonb)'::regprocedure)");
  check("Bank gets advisory lock at body entry", /BEGIN\s+PERFORM pg_advisory_xact_lock/.test(bankBody), true);
  checks.push("Full migration installs all source-derived signatures and composite redirects");
  // The current display catalogue includes the later stage-based Culture
  // policy. Apply that exact cost-only patch here; its ledger and real culture
  // wrappers are exercised in test-placard-culture-work-steps.mjs.
  const cultureWork = await migration("20261108000300_kq_culture_work_steps.sql");
  await db.exec(section(cultureWork, "DO $$ DECLARE body TEXT; anchor TEXT; spec RECORD; BEGIN", " FOR spec IN SELECT") + "END $$;");
  // Production processing work delegates advertising through this renamed
  // wrapper. Keep that exact rename and private grant in the boundary fixture.
  const processingWork = await migration("20261108000400_kq_processing_work.sql");
  // Its real exemption decides whether preparation was already booked by a
  // processing job. Job mechanics are covered in their separate SQL fixture.
  await db.exec("CREATE TABLE kq_market_lots(flower_id UUID,owner_id UUID,options JSONB)");
  await db.exec("DO $$ DECLARE body TEXT; anchor TEXT; BEGIN\n" + section(processingWork,
    " -- Only v1 preparation already charged by its job skips the old flat 1 h.", "\nEND $$;") + "\nEND $$;");
  await db.exec(section(processingWork,
    "ALTER FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) RENAME TO kq_commerce_before_processing_work;",
    "CREATE FUNCTION public.rpc_kq_commerce_command"));
  await db.exec(`CREATE FUNCTION public.rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
    LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
    SELECT public.kq_commerce_before_processing_work(p_user_id,p_action,p_payload,p_request_key) $$;
    REVOKE ALL ON FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION public.rpc_kq_commerce_command(UUID,TEXT,JSONB,UUID) TO service_role;`);
  await db.exec(await migration("20261108000600_kq_communication_work_speed.sql"));
  for (const signature of ["kq_player_work_cost(uuid,text,text)", "kq_player_work_skill(text,text)"]) {
    check(`Skill-aware helper remains private: ${signature}`, await scalar(`SELECT jsonb_build_array(
      has_function_privilege('service_role',$1,'EXECUTE'),has_function_privilege('anon',$1,'EXECUTE'),
      has_function_privilege('authenticated',$1,'EXECUTE'))`, [signature]), [false, false, false]);
  }
  const catalogueSource = await readFile(path.resolve("src/lib/kanab-quest-player-action-costs.ts"), "utf8");
  const literal = catalogueSource.match(/KQ_PLAYER_ACTION_COSTS = ([\s\S]*?) as const;/)?.[1];
  assert(literal, "Plain TypeScript action catalogue object");
  const catalogue = runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
  const skillLiteral = catalogueSource.match(/KQ_PLAYER_ACTION_SKILLS = ([\s\S]*?) as const;/)?.[1];
  assert(skillLiteral, "Plain TypeScript action skills object");
  const actionSkills = runInNewContext(`(${skillLiteral})`, Object.create(null), { timeout: 1000 });
  for (const [domain, actions] of Object.entries(catalogue)) {
    for (const [action, expected] of Object.entries(actions)) {
      assert.equal(Number(await scalar("SELECT kq_player_work_cost($1,$2)", [domain, action])), expected, `${domain}/${action} displayed and authoritative costs`);
      assert.equal(await scalar("SELECT kq_player_work_skill($1,$2)", [domain, action]), actionSkills[domain]?.[action] ?? null,
        `${domain}/${action} displayed and authoritative skill mapping`);
    }
  }
  checks.push("Every displayed catalogue cost and skill matches canonical SQL");
  for (const [domain, action] of [["social", "recover"], ["social", "sponsor-claim"], ["commerce", "quote"], ["staff", "settle"], ["online", "pause-listing"]]) {
    assert.equal(Number(await scalar("SELECT kq_player_work_cost($1,$2)", [domain, action])), 0, `${domain}/${action} remains free`);
  }
  checks.push("Recovery, reward claims, quotes, passive settlement and pause remain free");

  const user = await player(), other = await player();
  check("Four real hours define the next game day", await scalar(`SELECT jsonb_build_array(
    kq_player_work_day($1,business_started_at+interval '3 hours 59 minutes'),
    kq_player_work_day($1,business_started_at+interval '4 hours')) FROM kq_commerce_accounts WHERE user_id=$1`, [user]), [1, 2]);
  await commerce(user, "prepare");
  check("First action initializes canonical shared ledger and revision", [(await read(user)).revision, await hours(user)], [1, 1]);
  const earlier = await read(user);
  await online(user, "start-marketing");
  check("Different domains share the same allowance", await hours(user), 2);
  check("Another player keeps an independent allowance", await hours(other), 0);
  await rejectUnchanged("Stale staff CAS cannot restore spent hours", user,
    () => commit(user, earlier.revision, randomUUID(), { action: "settle" }, staffState(earlier)), /staff_changed/);
  let snapshot = await read(user), state = staffState(snapshot);
  await rejectUnchanged("Fresh CAS cannot erase canonical ledger", user,
    () => commit(user, snapshot.revision, randomUUID(), { action: "settle" }, { ...state, playerWorkDays: {} }), /player_work_changed/);
  await rejectUnchanged("Future day cannot be pre-spent", user,
    () => commit(user, snapshot.revision, randomUUID(), { action: "settle" }, { ...state, playerWorkDays: { ...state.playerWorkDays, 2: { usedHours: 1 } } }), /player_work_changed/);
  await commit(user, snapshot.revision, randomUUID(), { action: "settle" }, state);
  check("Passive staff settlement consumes no player hours", await hours(user), 2);
  snapshot = await read(user); state = staffState(snapshot);
  state.tasks = [...state.tasks, { id: randomUUID(), employeeId: "employee", kind: "sales", day: 1, hours: 4, status: "running" }];
  await commit(user, snapshot.revision, randomUUID(), { action: "assign", employeeId: "employee", kind: "sales", hours: 4 }, state);
  check("Employee assignment consumes no player hours", await hours(user), 2);
  await personal(user, "sales", 2);
  await personal(user, "trim", 1.5, { trim: true });
  check("Personal missions and personal trim share previous screen costs", await hours(user), 5.5);
  await rejectUnchanged("Personal assignment requires a brand-new task", user,
    () => personal(user, "culture", 1, { mutate: next => ({ ...next, tasks: next.tasks.slice(0, -1) }) }), /player_work_changed/);
  await rejectUnchanged("Personal assignment requires matching task kind", user,
    () => personal(user, "culture", 1, { mutate: next => ({ ...next, tasks: next.tasks.map((task, i) => i === next.tasks.length - 1 ? { ...task, kind: "sales" } : task) }) }), /player_work_changed/);
  await rejectUnchanged("Personal assignment cannot understate its exact delta", user,
    () => personal(user, "culture", 1, { mutate: next => ({ ...next, playerWorkDays: { 1: { usedHours: 7 } } }) }), /player_work_changed/);
  const nestedKey = randomUUID();
  await commerce(user, "sell", nestedKey, { nested: true });
  check("Fresh nested receipt is charged", await hours(user), 6);
  const fill = await personal(user, "communication", 6);
  check("Exactly twelve shared hours are allowed", await hours(user), 12);
  await rejectUnchanged("Over-cap command rolls back business debit and receipt", user, () => commerce(user, "prepare"), /player_work_exhausted/);
  await rejectUnchanged("Over-cap personal task rolls back staff receipt and state", user, () => personal(user, "sales", 0.5), /player_work_exhausted/);
  const atCap = await stored(user);
  check("Nested receipt replay succeeds at cap", (await commerce(user, "sell", nestedKey, { nested: true })).receipt.replayed, true);
  check("Nested receipt replay changes nothing", await stored(user), atCap);
  check("Personal receipt replay succeeds with obsolete CAS at cap", (await commit(user, fill.revision, fill.key, fill.command, fill.state)).replayed, true);
  check("Personal replay changes nothing", await stored(user), atCap);
  const staffAtCap = await read(user);
  await commit(user, staffAtCap.revision, randomUUID(), { action: "settle" }, staffState(staffAtCap));
  check("Passive settlement remains available at cap", await hours(user), 12);
  await commerce(user, "read-only-setting");
  await scalar("SELECT rpc_kq_warehouse_save($1,$2,'{}',0,'{}','{}',0)", [user, randomUUID()]);
  check("Zero-cost action and unchanged warehouse save are free at cap", await hours(user), 12);

  const composite = await player();
  const shopKey = randomUUID();
  await commerce(composite, "create-shop", shopKey);
  check("Commerce delegation charges only the parent action", await hours(composite), 0.5);
  const workshopKey = randomUUID();
  await scalar("SELECT rpc_kq_purchase_workshop_tier($1,$2,'PRESS-0600',4,0,1000)", [composite, workshopKey]);
  check("Workshop purchase and upgrade children charge only once", await hours(composite), 1);
  check("Boundary children still produce their business receipts", await scalar("SELECT count(*) FROM test_work_receipts WHERE user_id=$1", [composite]), 4);
  await scalar("SELECT rpc_kq_purchase_workshop_tier($1,$2,'PRESS-0600',4,0,1000)", [composite, workshopKey]);
  check("Top-level composite replay is free", await hours(composite), 1);
  await query("INSERT INTO kq_equipment_loadouts VALUES($1,'PRESS-0600',1,'processing')", [composite]);
  await scalar("SELECT rpc_kq_equip_tent_equipment($1,'PRESS-0600',1)", [composite]);
  check("Already-installed equipment consumes no time", await hours(composite), 1);
  await scalar("SELECT rpc_kq_equip_tent_equipment($1,'WASHER-25L',1)", [composite]);
  check("Changed equipment installation costs half an hour", await hours(composite), 1.5);

  // Move only the fixture business epoch, never the PostgreSQL clock.
  await query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '4 hours 1 minute' WHERE user_id=$1", [user]);
  await commerce(user, "prepare");
  check("New game day restores allowance and preserves yesterday", (await read(user)).state.playerWorkDays, { 1: { usedHours: 12 }, 2: { usedHours: 1 } });
  snapshot = await read(user); state = staffState(snapshot);
  await rejectUnchanged("Retained history cannot be dropped", user,
    () => commit(user, snapshot.revision, randomUUID(), { action: "settle" }, { ...state, playerWorkDays: { 2: { usedHours: 1 } } }), /player_work_changed/);
  await rejectUnchanged("Retained history cannot be altered", user,
    () => commit(user, snapshot.revision, randomUUID(), { action: "settle" }, { ...state, playerWorkDays: { 1: { usedHours: 0 }, 2: { usedHours: 1 } } }), /player_work_changed/);
  const crossing = await player();
  await commerce(crossing, "prepare");
  snapshot = await read(crossing); state = staffState(snapshot);
  await query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '4 hours'+interval '30 seconds' WHERE user_id=$1", [crossing]);
  await query("UPDATE kq_commerce_accounts SET business_started_at=business_started_at-interval '1 minute' WHERE user_id=$1", [crossing]);
  // The payload is still within staff's five-minute freshness window, but was
  // computed on the other side of this player's game-day boundary.
  state.lastSettledAt = new Date(Date.now() - 60000).toISOString();
  await rejectUnchanged("Payload crossing the game-day boundary must refresh", crossing,
    () => commit(crossing, snapshot.revision, randomUUID(), { action: "settle" }, state), /player_work_changed/);

  const countryside = await player();
  await rejectUnchanged("Countryside assignment requires the whole twelve hours", countryside,
    () => personal(countryside, "countryside", 1), /player_work_invalid/);
  await personal(countryside, "countryside", 12);
  check("Countryside task reserves the same twelve-hour day", await hours(countryside), 12);
  await rejectUnchanged("Countryside prevents further manual screen work", countryside,
    () => online(countryside, "create-listing"), /player_work_exhausted/);

  const socialUser = await player();
  const socialInput = async (actor = socialUser, action = "choose") => {
    const envelope = await scalar("SELECT rpc_kq_social_v2_read($1,NULL)", [actor]);
    const current = envelope.state, key = randomUUID();
    // A minimal server-produced result exercises the actual social persistence
    // and receipt guards; narrative/eligibility resolution has its own suite.
    const platforms = Object.fromEntries(["instagram", "x"].map(platform => [platform,
      { ...current.platforms[platform], trust: current.platforms[platform].trust ?? 50 }]));
    platforms.instagram.followers++;
    const command = { action, modelVersion: 2, requestKey: key, expectedRevision: current.revision, platform: "instagram" };
    const next = { ...current, version: 2, revision: current.revision + 1, platforms,
      socialFollowers: platforms.instagram.followers + platforms.x.followers,
      audienceFollowers: current.audienceFollowers + 1, additionalVisitsPerDay: 0,
      sponsors: current.sponsors ?? { active: null, completedIds: [], declinedIds: [], earnedCents: 0 },
      history: [{ id: key, followersDelta: 1, hatersDelta: 0, moderationDelta: 0, energyDelta: 0, trustDelta: 0, rewardCents: 0 }] };
    return [actor, JSON.stringify(command), current.revision, current.audienceFollowers, JSON.stringify(next)];
  };
  const socialCommit = input => scalar("SELECT rpc_kq_social_v2_commit($1,$2::jsonb,$3,$4,$5::jsonb,0)", input);
  const firstSocial = await socialInput();
  await socialCommit(firstSocial);
  check("Real social SQL action spends the shared half hour", await hours(socialUser), 0.5);
  await personal(socialUser, "sales", 11.5);
  check("Real social receipt replays at cap", (await socialCommit(firstSocial)).replayed, true);
  check("Real social replay does not charge twice", await hours(socialUser), 12);
  const secondSocial = await socialInput();
  await rejectUnchanged("Over-cap real social action rolls back audience, revision and receipt", socialUser,
    () => socialCommit(secondSocial), /player_work_exhausted/);

  const setSkills = async (actor, skills, employees = []) => {
    const snapshot = await read(actor);
    await query("UPDATE kq_staff_accounts SET state=$2::jsonb WHERE user_id=$1", [actor,
      JSON.stringify({ ...staffState(snapshot), playerSkills: skills, employees })]);
  };
  const personalizedCost = (actor, domain, action) => scalar("SELECT kq_player_work_cost($1::uuid,$2,$3)", [actor, domain, action]);
  for (const [xp, expected, level] of [[0, 1, 1], [1600, 0.6, 5], [8100, 0.1, 10]]) {
    const actor = await player();
    await setSkills(actor, { communication: xp });
    for (const [domain, actions] of Object.entries(catalogue)) for (const [action, base] of Object.entries(actions)) {
      assert.equal(Number(await personalizedCost(actor, domain, action)), actionSkills[domain]?.[action] === "communication" ? Math.round(base * expected * 100) / 100 : base,
        `Communication level ${level}: ${domain}/${action} scales only with its own skill`);
    }
    const advertisement = randomUUID();
    await commerce(actor, "advertise", advertisement, { playerSkills: { communication: 8100 }, hours: 0 });
    check(`Level ${level}: advertising ignores payload skills and duration`, await hours(actor), expected);
    await online(actor, "start-marketing");
    check(`Level ${level}: online marketing uses persisted Communication`, await hours(actor), Math.round(expected * 20) / 10);
    await socialCommit(await socialInput(actor, "sponsor-post"));
    check(`Level ${level}: real social publication shares the same duration`, await hours(actor), Math.round(expected * 30) / 10);
    check(`Level ${level}: actions preserve existing XP progression`, (await read(actor)).state.playerSkills, { communication: xp });
    const snapshot = await read(actor);
    await commit(actor, snapshot.revision, randomUUID(), { action: "settle" }, staffState(snapshot));
    check(`Level ${level}: staff settlement preserves fractional screen costs`, await hours(actor), Math.round(expected * 30) / 10);
  }
  const boundaries = await player();
  for (const [xp, expected] of [[-1, 1], [99, 1], [100, 0.9], [1599, 0.7], [1600, 0.6], [8099, 0.2], [8100, 0.1], [99999999, 0.1]]) {
    await setSkills(boundaries, { communication: xp });
    check(`Communication XP ${xp} respects existing level boundaries and minimum`, Number(await personalizedCost(boundaries, "commerce", "advertise")), expected);
  }
  await setSkills(boundaries, { culture: 8100, processing: 8100, sales: 8100, administration: 8100 },
    [{ id: "expert-employee", skills: { communication: 8100 }, trait: "versatile" }]);
  check("Other player skills and employee expertise do not discount Communication", Number(await personalizedCost(boundaries, "commerce", "advertise")), 1);
  check("A player without a staff row defaults to level 1", Number(await personalizedCost(randomUUID(), "commerce", "advertise")), 1);

  for (const skill of ["processing", "sales", "administration"]) {
    const actor = await player();
    for (const [xp, level] of [[0, 1], [100, 2], [1600, 5], [8100, 10]]) {
      await setSkills(actor, { [skill]: xp });
      for (const [domain, actions] of Object.entries(catalogue)) for (const [action, base] of Object.entries(actions)) {
        const expected = actionSkills[domain]?.[action] === skill ? Math.round(base * (11 - level) * 10) / 100 : base;
        assert.equal(Number(await personalizedCost(actor, domain, action)), expected,
          `${skill} level ${level}: ${domain}/${action} keeps its base proportion and uses only its own skill`);
      }
      checks.push(`Full catalogue matches ${skill} level ${level}, with other skills and Culture unchanged`);
    }
  }
  const legacy = await player();
  await setSkills(legacy, { processing: 100 });
  await query("UPDATE kq_staff_accounts SET state=state||'{\"playerProcessingXp\":8100}'::jsonb WHERE user_id=$1", [legacy]);
  check("Legacy processing XP still drives raw conditioning speed", Number(await personalizedCost(legacy, "commerce", "prepare")), 0.1);
  check("Legacy processing XP still drives storage speed", Number(await personalizedCost(legacy, "storage", "place")), 0.05);
  check("Legacy processing XP does not discount sales", Number(await personalizedCost(legacy, "commerce", "sell")), 0.5);
  await setSkills(legacy, { processing: 8100 });
  await query("UPDATE kq_staff_accounts SET state=state||'{\"playerProcessingXp\":100}'::jsonb WHERE user_id=$1", [legacy]);
  check("New processing XP wins over older legacy experience", Number(await personalizedCost(legacy, "equipment", "repair")), 0.05);

  const expert = await player(), expertSkills = { culture: 8100, processing: 8100, communication: 8100, sales: 8100, administration: 8100 };
  await setSkills(expert, expertSkills);
  const wrapperCases = [
    ["commerce raw conditioning", "SELECT rpc_kq_commerce_command($1,'prepare','{}',$2)", 0.1],
    ["commerce sales", "SELECT rpc_kq_commerce_command($1,'sell','{}',$2)", 0.05],
    ["commerce shop management", "SELECT rpc_kq_commerce_command($1,'create-shop','{}',$2)", 0.05],
    ["online listing creation", "SELECT rpc_kq_online_command($1,'create-listing','{}',$2)", 0.1],
    ["online listing update", "SELECT rpc_kq_online_command($1,'update-listing','{}',$2)", 0.05],
    ["online purchases", "SELECT rpc_kq_online_command($1,'buy-packaging','{}',$2)", 0.05],
    ...["buy", "assign", "place", "sell-overflow"].map(action => [`storage ${action}`, `SELECT rpc_kq_storage_capacity_command($1,'${action}',NULL,NULL,1,NULL,$2)`, 0.05]),
    ["warehouse layout", "SELECT rpc_kq_warehouse_save($1,$2,'{}',0,'{}','{\"changed\":true}',0)", 0.05],
    ["warehouse condition", "SELECT rpc_kq_warehouse_save_condition($1,$2,'{}',0,'{}','{}',0,'{}','{\"changed\":true}')", 0.05],
    ["warehouse removal", "SELECT rpc_kq_warehouse_remove_zone($1,$2,'{}',0,'{}','{}','{}','{}',0)", 0.05],
    ["equipment purchase", "SELECT rpc_kq_purchase_tent_equipment($1,$2,ARRAY['PRESS-0600'],1)", 0.05],
    ["equipment upgrade", "SELECT rpc_kq_upgrade_tent_equipment($1,$2,'PRESS-0600',1,1)", 0.05],
    ["equipment repair", "SELECT rpc_kq_repair_tent_machine($1,'PRESS-0600',1,0,$2,1)", 0.05],
    ["equipment replacement", "SELECT rpc_kq_replace_tent_culture_equipment($1,'PRESS-0600',1,0,$2,1)", 0.05],
    ["workshop composite upgrade", "SELECT rpc_kq_purchase_workshop_tier($1,$2,'PRESS-0600',4,0,1000)", 0.05],
    ["energy payment", "SELECT rpc_kq_pay_energy($1,$2,0)", 0.05],
  ];
  for (const [name, sql, expected] of wrapperCases) {
    const key = randomUUID(), before = await hours(expert);
    await scalar(sql, [expert, key]);
    check(`Level 10 ${name} wrapper uses its proportional cost`, await hours(expert), Math.round((before + expected) * 100) / 100);
    await scalar(sql, [expert, key]);
    check(`Level 10 ${name} replay does not charge twice`, await hours(expert), Math.round((before + expected) * 100) / 100);
  }
  let expertBefore = await hours(expert);
  await scalar("SELECT rpc_kq_equip_tent_equipment($1,'PRESS-0600',1)", [expert]);
  check("Level 10 installation uses Processing", await hours(expert), Math.round((expertBefore + 0.05) * 100) / 100);
  await query("INSERT INTO kq_equipment_loadouts VALUES($1,'PRESS-0600',1,'processing')", [expert]);
  expertBefore = await hours(expert);
  await scalar("SELECT rpc_kq_equip_tent_equipment($1,'PRESS-0600',1)", [expert]);
  check("Already-installed equipment remains free for an expert", await hours(expert), expertBefore);
  await scalar("SELECT rpc_kq_warehouse_save($1,$2,'{}',0,'{}','{}',0)", [expert, randomUUID()]);
  check("Unchanged warehouse layout remains free for an expert", await hours(expert), expertBefore);
  const jobFlower = randomUUID();
  await query("INSERT INTO kq_market_lots VALUES($1,$2,'[{\"route\":\"dry-sift\",\"processingWork\":{\"version\":1}}]')", [jobFlower, expert]);
  await commerce(expert, "prepare", randomUUID(), { flowerId: jobFlower, route: "dry-sift" });
  check("Preparation already charged by a processing job retains its exemption", await hours(expert), expertBefore);
  check("Expert gestures do not modify existing skill progression", (await read(expert)).state.playerSkills, expertSkills);

  const hundredths = await player(), billKey = randomUUID();
  await setSkills(hundredths, { administration: 100 });
  await scalar("SELECT rpc_kq_pay_energy($1,$2,0)", [hundredths, billKey]);
  check("Level 2 management takes exactly 0.45 h", await hours(hundredths), 0.45);
  await personal(hundredths, "sales", 11.5);
  check("Half-hour personal bookings preserve hundredth-hour totals", await hours(hundredths), 11.95);
  const hundredthsSnapshot = await read(hundredths);
  await commit(hundredths, hundredthsSnapshot.revision, randomUUID(), { action: "settle" }, staffState(hundredthsSnapshot));
  check("Staff settlement preserves a 0.05 h remainder", await hours(hundredths), 11.95);
  await setSkills(hundredths, { administration: 8100 });
  await scalar("SELECT rpc_kq_pay_energy($1,$2,0)", [hundredths, randomUUID()]);
  check("Level 10 management can use the final three minutes exactly", await hours(hundredths), 12);
  await rejectUnchanged("Over-cap three-minute action rolls back money and receipt", hundredths,
    () => scalar("SELECT rpc_kq_pay_energy($1,$2,0)", [hundredths, randomUUID()]), /player_work_exhausted/);
  const hundredthsBefore = await stored(hundredths);
  await scalar("SELECT rpc_kq_pay_energy($1,$2,0)", [hundredths, billKey]);
  check("Old management receipt replays at cap despite a changed skill level", await stored(hundredths), hundredthsBefore);

  const fractional = await player(), fractionalKey = randomUUID();
  await setSkills(fractional, { communication: 8100 });
  await commerce(fractional, "advertise", fractionalKey);
  await personal(fractional, "sales", 11.5);
  check("Half-hour personal bookings coexist with six-minute ledger units", await hours(fractional), 11.6);
  await rejectUnchanged("Fractional remainder cannot fund another half-hour mission", fractional,
    () => personal(fractional, "sales", 0.5), /player_work_exhausted/);
  await rejectUnchanged("Personal missions retain their half-hour booking rule", fractional,
    () => personal(fractional, "communication", 0.1), /player_work_invalid/);
  await rejectUnchanged("Shared charge rejects unsupported sub-hundredth precision", fractional,
    () => scalar("SELECT kq_player_work_charge($1,0.005)", [fractional]), /player_work_invalid/);
  for (let i = 0; i < 3; i++) await online(fractional, "start-marketing");
  check("Repeated six-minute charges preserve the exact final six minutes", await hours(fractional), 11.9);
  const lastPublication = await socialInput(fractional, "sponsor-post");
  await socialCommit(lastPublication);
  check("Level 10 publication can use the final six minutes exactly", await hours(fractional), 12);
  await rejectUnchanged("Over-cap fractional advertising rolls back money and receipt", fractional,
    () => commerce(fractional, "advertise"), /player_work_exhausted/);
  await rejectUnchanged("Over-cap fractional marketing rolls back money and receipt", fractional,
    () => online(fractional, "start-marketing"), /player_work_exhausted/);
  const exhaustedPublication = await socialInput(fractional, "sponsor-post");
  await rejectUnchanged("Over-cap fractional publication rolls back real social state", fractional,
    () => socialCommit(exhaustedPublication), /player_work_exhausted/);
  let fractionalBefore = await stored(fractional);
  check("Fractional advertising replays at the daily cap", (await commerce(fractional, "advertise", fractionalKey)).replayed, true);
  check("Fractional advertising replay makes no second debit", await stored(fractional), fractionalBefore);
  check("Fractional social publication replays at the daily cap", (await socialCommit(lastPublication)).replayed, true);
  // Social reads/replays settle passive energy; the action's persisted work,
  // audience, game state, money and receipt must remain unchanged.
  const replayedSocial = await stored(fractional);
  for (const key of ["staff", "wallet", "online", "socialReceipts", "journal"]) {
    check(`Fractional social replay preserves ${key}`, replayedSocial[key], fractionalBefore[key]);
  }
  check("Fractional social replay preserves game state", replayedSocial.social.game_state, fractionalBefore.social.game_state);
  await rejectUnchanged("Changed advertising payload cannot reuse its receipt", fractional,
    () => commerce(fractional, "advertise", fractionalKey, { hours: 0 }), /boundary_request_mismatch/);

  const broke = await player();
  await setSkills(broke, { communication: 1600 });
  await query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [broke]);
  await rejectUnchanged("Failed advertising payment does not consume fractional hours", broke,
    () => commerce(broke, "advertise"), /check constraint/);

  console.log(`Player workday SQL: ${checks.length} checks passed (production staff/social, full wrapper migration, explicit business boundary fixtures).`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.close();
}
