// Local PostgreSQL integration of the real staff transition, migration, receipts
// and accounting. Ordinary warehouse occupancy is an explicit fixture boundary.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';
import { setupStaffDatabase } from './test-placard-staff.mjs';

const db = new PGlite();
let vite;
const checks = [];
const query = (sql, params = []) => db.query(sql, params);
const scalar = async (sql, params = []) => Object.values((await query(sql, params)).rows[0])[0];
const migration = async name => (await readFile(path.resolve('supabase/migrations', name), 'utf8')).replaceAll('\r\n', '\n');
function section(text, first, last) {
  const start = text.indexOf(first), end = text.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, first); return text.slice(start, end);
}
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rejects = async (name, fn, pattern) => { await assert.rejects(fn, pattern, name); checks.push(name); };
const read = user => scalar('SELECT rpc_kq_staff_snapshot($1)', [user]);
const definition = async (file, name) => {
  const source = await migration(file);
  const found = source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert(found, name); return found[0].replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION');
};
async function commit(user, raw, command, transition, key = randomUUID()) {
  return scalar('SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)',
    [user, raw.revision, key, JSON.stringify(command), JSON.stringify(transition.state), transition.debitCents, JSON.stringify(transition.effects)]);
}
async function setup() {
  await setupStaffDatabase(db);
  console.log('Production SQL fixture: base staff ready');
  const trim = await migration('20261107000200_kq_staff_trim.sql');
  await db.exec(section(trim, 'CREATE TABLE public.kq_staff_trim_lots', 'CREATE FUNCTION public.kq_staff_trim_after_harvest'));
  await db.exec(section(trim, 'CREATE FUNCTION public.kq_staff_trim_snapshot', 'CREATE FUNCTION public.kq_staff_apply_trim'));
  await db.exec(section(trim, 'CREATE FUNCTION pg_temp.kq_staff_trim_patch', "SELECT pg_temp.kq_staff_trim_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',\n 'IF effect_kind"));
  await db.exec(`ALTER TABLE kq_commerce_accounts ADD COLUMN vat_reserved_cents INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE kq_lab_invoices ADD COLUMN user_id UUID;
    CREATE TABLE kq_energy_invoices(user_id UUID,remaining_cents INTEGER);
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    CREATE TABLE arena_chanvrier_savings_deposits(user_id UUID,balance_cents BIGINT);
    CREATE TABLE kq_bank_loans(user_id UUID,total_cents BIGINT,paid_cents BIGINT);
    CREATE TABLE kq_crypto_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE TABLE kq_stock_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    ALTER TABLE kq_staff_trim_lots ADD COLUMN completed_grams NUMERIC NOT NULL DEFAULT 0;`);
  const stock = await migration('20260923000800_kq_stock_market.sql'), suppliers = await migration('20261012000700_kq_warehouse_supplier_invoices.sql');
  await db.exec(section(stock, 'CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at', 'REVOKE ALL ON FUNCTION public.kq_treasury_balances_at'));
  await db.exec(section(suppliers, "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_balances_at", "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost"));
  await db.exec(await migration('20261107000300_kq_staff_accounting.sql'));
  const workday = await migration('20261107000500_kq_player_workday.sql');
  await db.exec(section(workday, 'CREATE FUNCTION public.kq_player_work_day', '-- Capture the exact current signatures/defaults'));
  await db.exec(await migration('20261107000600_kq_staff_archive.sql'));
  await db.exec(await migration('20261108000200_kq_staff_weekly_plan.sql'));
  await db.exec(await migration('20261108000700_kq_staff_contract_lifecycle.sql'));
  const culture = await migration('20261108000300_kq_culture_work_steps.sql');
  await db.exec(section(culture, 'CREATE TABLE public.kq_culture_work_steps', '-- Cumulative differences'));
  await db.exec(section(culture, 'CREATE FUNCTION public.kq_culture_work_validate_staff', 'DO $$ DECLARE body TEXT; anchor TEXT; spec RECORD; BEGIN'));
  const processing = await migration('20261108000400_kq_processing_work.sql');
  await db.exec(section(processing, 'CREATE TABLE public.kq_processing_jobs', 'CREATE FUNCTION public.kq_processing_machine_available'));
  await db.exec(section(processing, 'CREATE FUNCTION public.kq_processing_work_validate_staff', 'DO $$ DECLARE body TEXT; anchor TEXT; BEGIN'));
  let body = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  body = body.replace('AND processing_ready_at>now();', 'AND processing_ready_at>now() AND NOT EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.flower_id=(effect->>\'flowerId\')::UUID);');
  body = body.replace('PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);', 'PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);\n PERFORM public.kq_culture_work_validate_staff(p_user_id,p_state);\n PERFORM public.kq_processing_work_validate_staff(p_user_id,p_state);');
  await db.exec(body);
  await db.exec(await migration('20261108001100_kq_staff_benefits.sql'));
  const treasury = await migration('20260921000200_kq_treasury_accounting.sql');
  await db.exec(section(treasury, 'CREATE FUNCTION public.kq_treasury_queue', '-- Snapshot every existing account'));
  await db.exec('CREATE TRIGGER kq_treasury_vat AFTER INSERT OR UPDATE OF vat_reserved_cents ON public.kq_commerce_accounts FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe()');
  console.log('Production SQL fixture: composed staff guards ready');
  await db.exec(`ALTER TABLE kq_runs ADD COLUMN warehouse_zone_id TEXT;
    CREATE TABLE kq_warehouse_layouts(user_id UUID PRIMARY KEY,state JSONB,revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE kq_storage_lots(user_id UUID,flower_id UUID,state JSONB);
    CREATE TABLE kq_player_equipment(user_id UUID,equipment_code TEXT,level INTEGER);
    CREATE TABLE fixture_warehouse_capacity(user_id UUID PRIMARY KEY,drying NUMERIC,storage NUMERIC,used NUMERIC DEFAULT 0);
    CREATE FUNCTION kq_warehouse_stock_units(u UUID) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT COALESCE((SELECT used FROM fixture_warehouse_capacity WHERE user_id=u),0)*10 $$;
    CREATE FUNCTION kq_warehouse_reserved_storage_units(u UUID,p_except UUID DEFAULT NULL) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT CASE WHEN p_except IS NULL THEN 0 ELSE 100 END::NUMERIC $$;
    CREATE FUNCTION kq_warehouse_packed_stock_units(u UUID) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT 0::NUMERIC $$;
    CREATE FUNCTION kq_zone_reserved_harvest(u UUID) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT COALESCE(sum((state#>>'{warehouse,estimatedHarvestGrams}')::NUMERIC),0) FROM kq_runs WHERE user_id=u AND status='active' $$;
    CREATE FUNCTION kq_storage_remaining(u UUID) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT 0::NUMERIC $$;
    CREATE FUNCTION kq_warehouse_drying_capacity_grams(s JSONB) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT 10000::NUMERIC $$;
    CREATE FUNCTION kq_warehouse_storage_capacity_units(u UUID,s JSONB DEFAULT NULL) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT COALESCE((SELECT storage FROM fixture_warehouse_capacity WHERE user_id=u),0)*10 $$;
    CREATE FUNCTION kq_processing_machine_available(u UUID,c TEXT[],f UUID DEFAULT NULL) RETURNS TIMESTAMPTZ LANGUAGE sql AS $$ SELECT now() $$;
    CREATE FUNCTION kq_mission_metrics(u UUID) RETURNS JSONB LANGUAGE sql AS $$ SELECT jsonb_build_object('employee_tasks',(SELECT count(*) FROM kq_staff_archive WHERE user_id=u AND kind='task' AND payload->>'status'='completed')) $$;`);
  await db.exec(`ALTER FUNCTION kq_warehouse_stock_units(UUID) SET search_path=public;
    ALTER FUNCTION kq_warehouse_storage_capacity_units(UUID,JSONB) SET search_path=public;
    ALTER FUNCTION kq_zone_reserved_harvest(UUID) SET search_path=public;
    ALTER FUNCTION kq_mission_metrics(UUID) SET search_path=public;`);
  await db.exec(await migration('20261110000100_kq_staff_production.sql'));
  await db.exec(await migration('20261118000200_kq_team_day_plans.sql'));
  console.log('Production SQL fixture: new migration installed');
}
try {
  await setup();
  checks.push('Migration composes with staff, accounting, weekly plan, archives, lifecycle and work guards');
  vite = await createServer({ configFile: false, envDir: false, cacheDir: path.resolve('output/staff-production/vite-cache'), server: { middlewareMode: true, watch: null }, resolve: { alias: { '@': path.resolve('src') } } });
  const staff = await vite.ssrLoadModule('/src/lib/kanab-quest-staff.ts');
  const warehouse = await vite.ssrLoadModule('/src/lib/kanab-quest-warehouse.ts');
  const production = await vite.ssrLoadModule('/src/lib/kanab-quest-staff-production.ts');
  console.log('Production SQL fixture: TypeScript engine loaded');
  async function player(exactStartedAt) {
    const id = randomUUID();
    await query('INSERT INTO auth.users VALUES($1)', [id]);
    await query('INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,1000000)', [id]);
    const layout = warehouse.createKqWarehouseStarter();
    await query('INSERT INTO kq_warehouse_layouts(user_id,state) VALUES($1,$2)', [id, JSON.stringify(layout)]);
    await query('INSERT INTO fixture_warehouse_capacity(user_id,drying,storage) VALUES($1,10000,10000)', [id]);
    await query("INSERT INTO kq_player_equipment VALUES($1,'SIFT-TRAY',1)", [id]);
    let snapshot = await read(id);
    if (exactStartedAt) {
      await query('UPDATE kq_equipment_wallets SET created_at=$2 WHERE user_id=$1',[id,exactStartedAt]);
      await query('UPDATE kq_commerce_accounts SET business_started_at=$2 WHERE user_id=$1',[id,exactStartedAt]);
      snapshot = await read(id);
      snapshot.serverNow = exactStartedAt;
    }
    const command = { action: 'hire', candidateCode: 'mael', contract: 'cdi', weeklyHours: 35, durationMonths: 0, reason: 'permanent', expectedMonthlyCostCents: staff.getKqStaffMonthlyCost(staff.KQ_STAFF_CANDIDATES[1],35).totalCents };
    await commit(id, snapshot, command, staff.applyKqStaffCommand(snapshot, command, randomUUID()));
    return id;
  }
  const user = await player(), other = await player();
  {
    const planner = await player();
    let view = await read(planner);
    const memberId = view.state.employees[0].id;
    const personal = { action:'player-assign', kind:'communication', hours:2, expectedCostCents:0 };
    const reserve = { action:'save-day-plan', assignment:personal, day:1, expectedDay:1, expectedVersion:0 };
    const planId = randomUUID(), key = randomUUID();
    const save = staff.applyKqStaffCommand(view,reserve,planId);
    check('One-off planning advertised to every Quartier reader',view.context.dayPlanVersion,1);
    await commit(planner,view,reserve,save,key);
    await commit(planner,view,reserve,save,key);
    await rejects('Two writers cannot reserve from a stale snapshot',()=>commit(planner,view,reserve,save),/staff_changed/);
    view=await read(planner);
    check('A fresh read contains one plan with no charged work', [view.state.dayPlans.length,view.state.playerWorkDays['1']?.usedHours??0,view.state.tasks.length],[1,0,0]);
    const replacement={...reserve,planId,assignment:{action:'train',employeeId:memberId,skill:'culture',hours:2,expectedCostCents:7000},expectedVersion:1};
    view=await commit(planner,view,replacement,staff.applyKqStaffCommand(view,replacement,randomUUID()));
    check('Reassignment moves budget from player to employee without paying yet',[view.state.dayPlans[0].assigneeId,view.cashCents],[memberId,1000000]);
    const add={...reserve,assignment:{action:'assign',employeeId:memberId,kind:'communication',hours:2},expectedVersion:2,beforeId:planId};
    const another=randomUUID();
    view=await commit(planner,view,add,staff.applyKqStaffCommand(view,add,another));
    check('Queue reorder persists across reads',(await read(planner)).state.dayPlans.map(plan=>plan.id),[another,planId]);
    const start={action:'start-day-plan',planId,expectedVersion:3,expectedDay:1};
    assert.throws(()=>staff.applyKqStaffCommand(view,start,randomUUID()),/première tâche/);
    const remove={action:'remove-day-plan',planId:another,expectedDay:1,expectedVersion:3};
    view=await commit(planner,view,remove,staff.applyKqStaffCommand(view,remove,randomUUID()));
    start.expectedVersion=4;
    const launch=staff.applyKqStaffCommand(view,start,randomUUID()), launchKey=randomUUID();
    await commit(planner,view,start,launch,launchKey);
    await commit(planner,view,start,launch,launchKey);
    view=await read(planner);
    check('Launch and retry debit once and charge the original employee ledger', [view.cashCents,view.state.dayPlans.length,view.state.tasks.map(t=>t.id),view.state.employees[0].workDays['1'].usedHours],[993000,0,[planId],2]);
    check('Receipt matches original user command, including after refresh', (await scalar('SELECT rpc_kq_staff_receipt($1,$2,$3::jsonb)',[planner,launchKey,JSON.stringify(start)])).replayed,true);
    assert.throws(()=>staff.applyKqStaffCommand(view,{action:'start-team-task',assignment:add.assignment,expectedVersion:5,expectedDay:1},randomUUID()),/travaille déjà/);
    const pstart={action:'start-team-task',assignment:personal,expectedVersion:5,expectedDay:1};
    view=await commit(planner,view,pstart,staff.applyKqStaffCommand(view,pstart,randomUUID()));
    check('Immediate player work passes the existing SQL workload guard',view.state.playerWorkDays['1'].usedHours,2);
  }
  let raw = await read(user);
  check('Capability is explicit; existing game has no production automatically', [raw.context.productionVersion,raw.state.production], [1,undefined]);
  const config = { action:'set-production-rules',enabled:true,zoneId:'starter',route:'flower',maxDailyCostCents:100000,cashReserveCents:10000,expectedRevision:1 };
  const configured = staff.applyKqStaffCommand(raw,config,randomUUID());
  const key = randomUUID();
  await commit(user,raw,config,configured,key);
  check('Configuration spends no money', (await read(user)).cashCents, raw.cashCents);
  await commit(user,raw,config,configured,key);
  check('Lost response can replay configuration once', await scalar('SELECT count(*)::INTEGER FROM kq_staff_receipts WHERE user_id=$1 AND request_key=$2',[user,key]),1);
  raw = await read(user);
  const quota = raw.state.production.facility.storageCapacityGrams;
  check('Storage quota is visible to the ordinary capacity guard', await scalar('SELECT kq_warehouse_reserved_storage_units($1)',[user]),String(quota*10));
  check('Storage exclusion argument preserves the autonomous quota',await scalar('SELECT kq_warehouse_reserved_storage_units($1,$2)',[user,randomUUID()]),String(quota*10+100));
  check('Facility read excludes its own reservation',raw.context.productionFacility.usedStorageGrams,0);
  await rejects('Competition cannot occupy the dedicated culture zone',()=>query("INSERT INTO kq_runs(id,user_id,warehouse_zone_id,state) VALUES($1,$2,'starter','{}')",[randomUUID(),user]),/staff_production_occupied/);
  await rejects('Dedicated zone cannot be removed',()=>query("UPDATE kq_warehouse_layouts SET state=jsonb_set(state,'{zones}','[]') WHERE user_id=$1",[user]),/staff_production_occupied/);
  await rejects('Another owner cannot reuse this state',()=>commit(other,raw,config,configured),/staff_changed|staff_production/);
  const employee = raw.state.employees[0];
  const days = Array.from({length:5},()=>[{kind:'production',productionStep:'auto',hours:7}]);
  const planning = {action:'set-weekly-plan',employeeId:employee.id,enabled:true,days,expectedWeeklyCostCents:0};
  await commit(user,raw,planning,staff.applyKqStaffCommand(raw,planning,randomUUID()));
  raw = await read(user);
  check('Weekly template carries an explicit autonomous step',raw.state.employees[0].weeklyPlan.days[0][0].productionStep,'auto');
  // Advance fixture history, never production wall time. This gives the real
  // engine past authorized departures that it must catch up transactionally.
  const now = Date.parse(raw.serverNow), origin = now - 14*4*3600000;
  // PostgreSQL timestamps retain microseconds; Date.toISOString alone hides
  // shifts accidentally rounded before their authorization or into yesterday.
  const dated = new Date(origin).toISOString().replace('Z','456Z'), state = structuredClone(raw.state);
  state.lastSettledAt=dated; state.production.advancedAt=dated; state.production.settings.updatedAt=dated; state.production.stats.startedAt=dated;
  state.production.facility.equipmentEffectiveAt=dated;
  const e=state.employees[0]; e.hiredAt=dated; e.paidUntil=dated; e.nextPayrollAt=new Date(origin+30*4*3600000).toISOString();
  e.weeklyPlan.updatedAt=dated; e.weeklyPlan.nextDay=1; e.weeklyPlan.history=[];
  await query('UPDATE kq_equipment_wallets SET created_at=$2 WHERE user_id=$1',[user,dated]);
  await query('UPDATE kq_commerce_accounts SET business_started_at=$2 WHERE user_id=$1',[user,dated]);
  await query('UPDATE kq_staff_accounts SET state=$2 WHERE user_id=$1',[user,JSON.stringify(state)]);
  raw=await read(user);
  const transition=staff.applyKqStaffCommand(raw,{action:'settle'},randomUUID());
  assert(transition.effects.some(effect=>effect.kind==='production'));
  check('Every weekly shift preserves the SQL game day and exact authorization time',await scalar(`
    SELECT bool_and((t->>'startedAt')::TIMESTAMPTZ >= $3::TIMESTAMPTZ
      AND (t->>'day')::INTEGER = kq_player_work_day($1,(t->>'startedAt')::TIMESTAMPTZ)
      AND (t->>'day')::INTEGER = kq_player_work_day($1,(t->>'completesAt')::TIMESTAMPTZ-interval '1 microsecond'))
    FROM jsonb_array_elements($2::JSONB->'tasks') t WHERE t->>'kind'='production'`,
    [user,JSON.stringify(transition.state),dated]),true);
  const settleKey=randomUUID(), cashBefore=raw.cashCents;
  const settled=await commit(user,raw,{action:'settle'},transition,settleKey);
  check('Two weeks produce real sales after culture, maturation and trim',settled.state.production.stats.salesCents>0,true);
  check('SQL wallet matches chronological engine costs and receipts',settled.cashCents,cashBefore+production.getKqProductionCashDelta(transition.effects));
  check('Sales reserve their VAT once',Number(await scalar('SELECT vat_reserved_cents FROM kq_commerce_accounts WHERE user_id=$1',[user])),settled.state.production.stats.vatCents);
  check('Accounting has no unexplained production movement',Number(await scalar("SELECT COALESCE(sum(balance_cents),0) FROM kq_treasury_balances WHERE user_id=$1 AND account='suspense'",[user])),0);
  check('Accounting and wallet agree',Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='cash'",[user])),settled.cashCents);
  check('Autonomous completed tasks grant no mission progress',(await scalar('SELECT kq_mission_metrics($1)',[user])).employee_tasks,0);
  check('Employees gain no XP or completed-task rewards',settled.state.employees[0].skills,employee.skills);
  check('Production never creates competitive flowers',await scalar('SELECT count(*)::INTEGER FROM kq_flowers'),0);
  check('Production never increases reputation',await scalar('SELECT reputation FROM kq_equipment_wallets WHERE user_id=$1',[user]),0);
  const receipts=await scalar('SELECT count(*)::INTEGER FROM kq_staff_production_events WHERE user_id=$1',[user]);
  await commit(user,raw,{action:'settle'},transition,settleKey);
  check('Settlement replay cannot duplicate production money',await scalar('SELECT count(*)::INTEGER FROM kq_staff_production_events WHERE user_id=$1',[user]),receipts);
  check('Settlement replay preserves wallet',(await read(user)).cashCents,settled.cashCents);
  await rejects('Stale concurrent transition is rejected',()=>commit(user,raw,{action:'settle'},transition),/staff_changed/);
  raw=await read(user);
  const forged=staff.applyKqStaffCommand(raw,{action:'settle'},randomUUID());
  forged.state.production.stats.salesCents+=100;
  await rejects('Unreceipted revenue cannot enter the state',()=>commit(user,raw,{action:'settle'},forged),/staff_production_changed/);
  check('Failed transaction preserves the money',(await read(user)).cashCents,raw.cashCents);
  const pause={...config,enabled:false,zoneId:null};
  assert(raw.state.production.lots.length>0);
  const paused=await commit(user,raw,pause,staff.applyKqStaffCommand(raw,pause,randomUUID()));
  check('Pause with omitted zone preserves occupied zone',paused.state.production.settings.zoneId,'starter');
  check('Paused occupied production keeps its capacity',await scalar('SELECT kq_warehouse_reserved_storage_units($1)',[user]),String(quota*10));
  const otherRaw=await read(other), sift={...config,route:'dry-sift'};
  await commit(other,otherRaw,sift,staff.applyKqStaffCommand(otherRaw,sift,randomUUID()));
  await rejects('Reserved sieve cannot be used by competitive processing',()=>scalar("SELECT kq_processing_machine_available($1,ARRAY['SIFT-TRAY'])",[other]),/staff_production_machine_reserved/);
  await rejects('Reserved sieve cannot be removed',()=>query("DELETE FROM kq_player_equipment WHERE user_id=$1",[other]),/staff_production_machine_reserved/);
  check('Other machines remain available',!!await scalar("SELECT kq_processing_machine_available($1,ARRAY['PRESS-0600'])",[other]),true);
  let workRaw=await read(other);
  const training={action:'train',employeeId:workRaw.state.employees[0].id,skill:'culture',hours:2,expectedCostCents:staff.getKqStaffTrainingCost(2)};
  await commit(other,workRaw,training,staff.applyKqStaffCommand(workRaw,training,randomUUID()));
  workRaw=await read(other);
  const assignment={action:'assign-production',employeeId:workRaw.state.employees[0].id,productionStep:'auto',hours:2};
  const work=staff.applyKqStaffCommand(workRaw,assignment,randomUUID());
  const autonomous=work.state.tasks.find(task=>task.kind==='production'),formation=work.state.tasks.find(task=>task.kind==='training');
  check('Autonomous work starts after existing training',autonomous.startedAt,formation.completesAt);
  const shortened=structuredClone(work);
  shortened.state.tasks.find(task=>task.kind==='production').completesAt=autonomous.startedAt;
  await rejects('SQL rejects instantaneous autonomous work',()=>commit(other,workRaw,assignment,shortened),/staff_production_hours/);
  const assigned=await commit(other,workRaw,assignment,work);
  check('Both activities debit the same daily hours',assigned.state.employees[0].workDays['1'].usedHours,4);
  check('Reservation produces no instant harvest or sale',assigned.state.production.stats.salesCents+assigned.state.production.stats.harvestedGrams,0);
  const exactStartedAt=new Date(Date.now()-60000).toISOString().replace('Z','789Z');
  const synchronous=await player(exactStartedAt);
  let synchronousRaw=await read(synchronous);
  synchronousRaw.serverNow=exactStartedAt;
  await commit(synchronous,synchronousRaw,config,staff.applyKqStaffCommand(synchronousRaw,config,randomUUID()));
  synchronousRaw=await read(synchronous);
  synchronousRaw.serverNow=exactStartedAt;
  const synchronousCommand={action:'assign-production',employeeId:synchronousRaw.state.employees[0].id,productionStep:'auto',hours:2};
  const synchronousWork=staff.applyKqStaffCommand(synchronousRaw,synchronousCommand,randomUUID());
  const synchronousTask=synchronousWork.state.tasks.find(task=>task.kind==='production');
  check('Immediate assignment never predates the microsecond hire/configuration time',
    await scalar('SELECT $1::TIMESTAMPTZ >= $2::TIMESTAMPTZ',[synchronousTask.startedAt,exactStartedAt]),true);
  const synchronousAssigned=await commit(synchronous,synchronousRaw,synchronousCommand,synchronousWork);
  check('SQL accepts immediate work after a microsecond hire/configuration',synchronousAssigned.state.tasks.filter(task=>task.kind==='production').length,1);
  const unused=await player();
  await query('DELETE FROM kq_warehouse_layouts WHERE user_id=$1',[unused]);
  check('Unused warehouse can still be removed',await scalar('SELECT count(*)::INTEGER FROM kq_warehouse_layouts WHERE user_id=$1',[unused]),0);

  // Extend this fixture with actual catalog/condition formulas and the real
  // work-hours wrapper. Purchase persistence is the existing warehouse fixture
  // boundary; the new atomic RPC, capacity guards and asset validation are real.
  for (const [file, name] of [
    ['20261012000900_kq_warehouse_equipment_tiers.sql','kq_warehouse_device'],
    ['20261012000900_kq_warehouse_equipment_tiers.sql','kq_warehouse_catalog_projection'],
    ['20261012000800_kq_warehouse_simulation_options.sql','kq_warehouse_option'],
    ['20261012000800_kq_warehouse_simulation_options.sql','kq_warehouse_options_projection'],
  ]) await db.exec(await definition(file,name));
  await db.exec('ALTER FUNCTION kq_warehouse_option(TEXT) RENAME TO kq_warehouse_option_v1; ALTER FUNCTION kq_warehouse_options_projection(JSONB) RENAME TO kq_warehouse_options_projection_v1;');
  let legacyOptions=await scalar("SELECT pg_get_functiondef('kq_warehouse_options_projection_v1(jsonb)'::regprocedure)");
  await db.exec(legacyOptions.replaceAll('public.kq_warehouse_option(','public.kq_warehouse_option_v1('));
  for(const name of ['kq_warehouse_option','kq_warehouse_device_quality','kq_warehouse_options_projection'])
    await db.exec(await definition('20261015000400_kq_warehouse_tier_balance.sql',name));
  await db.exec('ALTER TABLE kq_warehouse_layouts ADD COLUMN culture_assets JSONB; ALTER TABLE kq_warehouse_layouts ADD COLUMN migration_credit_cents INTEGER NOT NULL DEFAULT 0;');
  for(const name of ['kq_warehouse_validate_assets','kq_warehouse_condition_projection'])
    await db.exec(await definition('20261030000100_kq_warehouse_condition_and_resale.sql',name));
  await db.exec(`CREATE TABLE fixture_equipment_receipts(user_id UUID,request_key UUID,request JSONB,receipt JSONB,PRIMARY KEY(user_id,request_key));
    CREATE FUNCTION kq_warehouse_snapshot_before_production_reservation(p_user_id UUID) RETURNS JSONB LANGUAGE sql AS $$
      SELECT jsonb_build_object('state',state,'revision',revision) FROM kq_warehouse_layouts WHERE user_id=p_user_id $$;
    CREATE FUNCTION kq_warehouse_snapshot(p_user_id UUID) RETURNS JSONB LANGUAGE sql AS $$ SELECT kq_warehouse_snapshot_before_production_reservation(p_user_id) $$;
    CREATE FUNCTION rpc_kq_warehouse_receipt(p_user_id UUID,p_request_key UUID,p_request JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
    DECLARE saved fixture_equipment_receipts%ROWTYPE; BEGIN
      SELECT * INTO saved FROM fixture_equipment_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
      IF NOT FOUND THEN RETURN NULL; END IF;
      IF saved.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'warehouse_request_mismatch'; END IF;
      RETURN kq_warehouse_snapshot(p_user_id)||jsonb_build_object('receipt',saved.receipt||'{"replayed":true}'::JSONB);
    END $$;
    CREATE FUNCTION kq_warehouse_save_before_condition(p_user_id UUID,p_request_key UUID,p_request JSONB,p_expected_revision INTEGER,p_previous_state JSONB,p_next_state JSONB,p_cost_cents INTEGER) RETURNS JSONB LANGUAGE plpgsql AS $$
    DECLARE receipt JSONB; BEGIN
      IF NOT EXISTS(SELECT 1 FROM kq_warehouse_layouts WHERE user_id=p_user_id AND revision=p_expected_revision AND state=p_previous_state) THEN RAISE EXCEPTION 'warehouse_revision_changed'; END IF;
      UPDATE kq_equipment_wallets SET cash_cents=cash_cents-p_cost_cents WHERE user_id=p_user_id;
      UPDATE kq_warehouse_layouts SET state=p_next_state,revision=revision+1 WHERE user_id=p_user_id;
      receipt:=jsonb_build_object('replayed',false,'chargedCents',p_cost_cents);
      INSERT INTO fixture_equipment_receipts VALUES(p_user_id,p_request_key,p_request,receipt);
      RETURN kq_warehouse_snapshot(p_user_id)||jsonb_build_object('receipt',receipt);
    END $$;`);
  await db.exec(`ALTER FUNCTION kq_warehouse_snapshot_before_production_reservation(UUID) SET search_path=public;
    ALTER FUNCTION kq_warehouse_snapshot(UUID) SET search_path=public;
    ALTER FUNCTION rpc_kq_warehouse_receipt(UUID,UUID,JSONB) SET search_path=public;
    ALTER FUNCTION kq_warehouse_save_before_condition(UUID,UUID,JSONB,INTEGER,JSONB,JSONB,INTEGER) SET search_path=public;`);
  await db.exec(await definition('20261030000100_kq_warehouse_condition_and_resale.sql','rpc_kq_warehouse_save_condition'));
  const wrapSource=await migration('20261107000500_kq_player_workday.sql');
  await db.exec(section(wrapSource,'CREATE FUNCTION pg_temp.kq_player_work_wrap','-- Registration list'));
  await db.exec("SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_warehouse_save_condition(uuid,uuid,jsonb,integer,jsonb,jsonb,integer,jsonb,jsonb)','warehouse','''save''','p_previous_state IS NOT DISTINCT FROM p_next_state AND p_previous_assets IS NOT DISTINCT FROM p_next_assets')");
  await db.exec(await migration('20261111000200_kq_production_equipment.sql'));
  const conditionModule=await vite.ssrLoadModule('/src/lib/kanab-quest-warehouse-condition.ts');
  const equipmentUser=await player();
  const equipmentPlan=warehouse.createKqWarehouseStarter();
  const equipmentCondition=conditionModule.initializeKqWarehouseCondition(equipmentPlan,true);
  await query('UPDATE kq_warehouse_layouts SET culture_assets=$2 WHERE user_id=$1',[equipmentUser,JSON.stringify(equipmentCondition.assets)]);
  let equipmentRaw=await read(equipmentUser);
  await commit(equipmentUser,equipmentRaw,config,staff.applyKqStaffCommand(equipmentRaw,config,randomUUID()));
  equipmentRaw=await read(equipmentUser);
  check('Enabled empty production publishes equipment editing capability',await scalar("SELECT kq_warehouse_snapshot($1)#>'{productionReservation,equipmentEditable}'",[equipmentUser]),true);
  const upgraded=warehouse.getKqWarehouseQuote({...equipmentPlan,zones:equipmentPlan.zones.map(zone=>({...zone,lightingCode:'SIM-LIGHT-03',optionCodes:['SIM-WATER-03','SIM-CLIMATE-03']}))},equipmentPlan);
  const upgradeKey=randomUUID();
  const upgradeCondition=conditionModule.reconcileKqWarehouseCondition(equipmentPlan,upgraded.nextState,equipmentCondition,{requestKey:upgradeKey,fundedFraction:1,fundedCents:upgraded.totalCostCents,investmentCents:upgraded.totalCostCents});
  const upgradeRequest={state:upgraded.nextState,expectedRevision:1,expectedCostCents:upgraded.totalCostCents};
  const equipmentArgs=[equipmentUser,upgradeKey,upgradeRequest,1,equipmentPlan,upgraded.nextState,upgraded.totalCostCents,equipmentCondition.assets,upgradeCondition.assets,equipmentRaw.revision,equipmentRaw.state.production.advancedAt];
  const install=(args=equipmentArgs)=>scalar('SELECT rpc_kq_warehouse_save_production_equipment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',args);
  await rejects('Unsettled/stale personnel revision cannot install',()=>install(equipmentArgs.map((value,index)=>index===9?value-1:value)),/staff_production_changed/);
  await query('UPDATE fixture_warehouse_capacity SET storage=1 WHERE user_id=$1',[equipmentUser]);
  const beforeInstallCash=await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[equipmentUser]);
  await rejects('Insufficient capacity rejects the purchase atomically',()=>install(),/staff_production_capacity/);
  check('Refused equipment purchase preserves cash',await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[equipmentUser]),beforeInstallCash);
  await query('UPDATE fixture_warehouse_capacity SET storage=10000 WHERE user_id=$1',[equipmentUser]);
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{production,settings,maxDailyCostCents}','1') WHERE user_id=$1",[equipmentUser]);
  await rejects('Insufficient recurring budget rejects before the equipment debit',()=>install(),/staff_production_budget/);
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{production,settings,maxDailyCostCents}','100000') WHERE user_id=$1",[equipmentUser]);
  await rejects('An ordinary layout update cannot bypass atomic facility refresh',()=>query("UPDATE kq_warehouse_layouts SET state=jsonb_set(state,'{zones,0,lightingCode}','\"SIM-LIGHT-03\"') WHERE user_id=$1",[equipmentUser]),/staff_production_equipment_busy/);
  const movedArgs=[...equipmentArgs]; movedArgs[5]=structuredClone(upgraded.nextState); movedArgs[5].zones[0].x++;
  await rejects('Atomic equipment endpoint still protects reserved geometry',()=>install(movedArgs),/staff_production_occupied/);
  check('All failed installation paths preserve cash',await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[equipmentUser]),beforeInstallCash);
  const priorSettings=structuredClone(equipmentRaw.state.production.settings);
  const beforeInstallAt=await scalar('SELECT clock_timestamp()');
  const installed=await install();
  const afterInstall=await read(equipmentUser), facility=afterInstall.state.production.facility;
  const tsQuote=production.getKqProductionFacilities(afterInstall.context)[0];
  check('Refreshed SQL facility matches TypeScript paid quote and condition',
    [facility.harvestGrams,facility.cycleCostCents,facility.qualityBonus,facility.dryingCapacityGrams,facility.storageCapacityGrams],
    [tsQuote.harvestGrams,tsQuote.cycleCostCents,tsQuote.qualityBonus,tsQuote.dryingCapacityGrams,tsQuote.storageCapacityGrams]);
  check('Equipment preserves all autonomous settings',afterInstall.state.production.settings,priorSettings);
  check('New equipment applies no earlier than the settled boundary',Date.parse(facility.equipmentEffectiveAt)>=Date.parse(equipmentRaw.state.production.advancedAt),true);
  check('Equipment boundary preserves PostgreSQL microseconds without early work',await scalar("SELECT $1::TIMESTAMPTZ >= $2::TIMESTAMPTZ AND $1::TIMESTAMPTZ=date_trunc('milliseconds',$1::TIMESTAMPTZ)",[facility.equipmentEffectiveAt,beforeInstallAt]),true);
  check('Equipment deducts exactly the paid quote',Number(beforeInstallCash)-Number(afterInstall.cashCents),upgraded.totalCostCents);
  check('Existing wrapper still charges warehouse hours',Object.values(afterInstall.state.playerWorkDays).reduce((sum,day)=>sum+day.usedHours,0),Number(await scalar("SELECT kq_player_work_cost('warehouse','save')")));
  const replayEquipment=await install();
  check('Lost equipment response replays before stale state validation',replayEquipment.receipt.replayed,true);
  check('Replay does not charge cash or hours twice',(await read(equipmentUser)).state,afterInstall.state);
  check('Purchase receipt remains the warehouse receipt',installed.receipt.chargedCents,upgraded.totalCostCents);
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{production,lots}','[{}]') WHERE user_id=$1",[equipmentUser]);
  check('Material in the circuit removes editing capability',await scalar("SELECT kq_warehouse_snapshot($1)#>'{productionReservation,equipmentEditable}'",[equipmentUser]),false);
  const occupiedArgs=[...equipmentArgs]; occupiedArgs[1]=randomUUID(); occupiedArgs[9]=afterInstall.revision;
  await rejects('Pending lot prevents equipment installation',()=>install(occupiedArgs),/staff_production_equipment_busy/);
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(jsonb_set(state,'{production,lots}','[]'),'{production,jobs}','[{}]') WHERE user_id=$1",[equipmentUser]);
  await rejects('Pending segment prevents equipment installation',()=>install(occupiedArgs),/staff_production_equipment_busy/);
  for(const role of ['anon','authenticated','service_role']) {
    check(`${role} equipment RPC permissions are explicit`,await scalar("SELECT has_function_privilege($1,'rpc_kq_warehouse_save_production_equipment(uuid,uuid,jsonb,integer,jsonb,jsonb,integer,jsonb,jsonb,integer,timestamptz)','EXECUTE')",[role]),role==='service_role');
    check(`${role} cannot execute private equipment quote`,await scalar("SELECT has_function_privilege($1,'kq_staff_production_equipment_quote(uuid,jsonb,jsonb,jsonb)','EXECUTE')",[role]),false);
  }
  for (const role of ['anon','authenticated','service_role']) {
    check(`${role} has no direct production table access`,await scalar("SELECT has_table_privilege($1,'kq_staff_production_events','SELECT') OR has_table_privilege($1,'kq_staff_production_events','INSERT')",[role]),false);
    check(`${role} cannot invoke internal production money function`,await scalar("SELECT has_function_privilege($1,'kq_staff_production_event(uuid,jsonb)','EXECUTE')",[role]),false);
  }
  check('Only service role executes staff commands',await scalar("SELECT has_function_privilege('service_role','rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)','EXECUTE')"),true);
  await mkdir('output/staff-production',{recursive:true});
  await writeFile('output/staff-production/sql-report.json',JSON.stringify({checks:checks.length,passed:checks},null,2));
  console.log(`Staff production SQL: ${checks.length} checks passed.`);
} catch (error) { console.error(error.message, error.where ?? '', error.internalQuery ?? '', error.position ?? '', error.stack?.split('\n').slice(1,3).join('\n') ?? ''); process.exitCode=1;
} finally { await vite?.close(); await db.close(); }
