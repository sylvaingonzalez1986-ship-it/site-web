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
