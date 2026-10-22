// Isolated PostgreSQL only: no environment files, credentials or remote writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8').then(source => source.replaceAll('\r\n', '\n'));
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
const command = (owner, action, payload = {}, key = randomUUID()) => scalar('SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4)', [owner, action, JSON.stringify(payload), key]);
const state = owner => scalar('SELECT rpc_kq_commerce_state($1)', [owner]);
const cash = owner => scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1', [owner]);
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const reject = async (operation, code) => { await db.exec('SAVEPOINT expected_failure'); try { await assert.rejects(operation, error => error.message.includes(code)); checks++; } finally { await db.exec('ROLLBACK TO SAVEPOINT expected_failure'); } };
const functionSource = async (file, name) => {
  const source = await sql(file), match = source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert(match, `Missing actual migration function ${name}`); return match[0];
};
const migrationName = '20261021000100_kq_retire_domiciliation.sql';

try {
  // Reuse the established real market/storage/bank/online migration fixture.
  const online = (await readFile(new URL('./test-placard-online.mjs', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const from = online.indexOf(' await db.exec(`'), until = online.indexOf(' // A real pre-migration receipt and account must survive the new catalogue.');
  assert(from >= 0 && until > from, 'Online bootstrap markers changed');
  const bootstrap = online.slice(from, until)
    .replace('CREATE TABLE kq_runs(', "CREATE TYPE public.kq_run_status AS ENUM ('active','completed','abandoned'); CREATE TABLE kq_runs(")
    .replace('state JSONB,status TEXT', 'state JSONB,status public.kq_run_status');
  assert(bootstrap.includes('state JSONB,status public.kq_run_status'), 'Run schema fixture marker changed');
  await new (Object.getPrototypeOf(async function () {}).constructor)('db', 'sql', 'scalar', bootstrap)(db, sql, scalar);
  for (const name of ['20261020000400_kq_online_site_progression.sql', '20261020000500_kq_online_merch.sql', '20261020000600_kq_online_studio.sql']) await db.exec(await sql(name));

  // The existing business integration uses representative start insert bodies.
  // Reuse those entry points and the actual production transition functions.
  await db.exec(`ALTER TABLE kq_runs ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE kq_runs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now(), ADD COLUMN integrity_code TEXT;
    ALTER TABLE kq_flowers ADD COLUMN rules_version SMALLINT DEFAULT 2, ADD COLUMN cannabinoid_report JSONB;`);
  const business = (await readFile(new URL('./test-placard-business.mjs', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const startFrom = business.indexOf('    -- Starts use representative'), startUntil = business.indexOf('  `);', startFrom);
  assert(startFrom >= 0 && startUntil > startFrom, 'Business start fixture markers changed');
  await db.exec(business.slice(startFrom, startUntil).replaceAll('    BEGIN\n', '    BEGIN\n      PERFORM public.kq_business_assert_domiciliation(p_user_id,p_initial_state);\n'));
  await db.exec(await functionSource('20261010000100_kq_culture_care.sql', 'kq_care_state_valid'));
  await db.exec(await functionSource('20261010000100_kq_culture_care.sql', 'rpc_kq_update_run_state'));
  let swap = await functionSource('20260725001800_kq_atomic_heritage_hand_swap.sql', 'rpc_kq_swap_heritage_hand');
  swap = swap.replace("OR p_next_state->'situationCodes' IS DISTINCT FROM v_run.state->'situationCodes'", "OR p_next_state->'situationCodes' IS DISTINCT FROM v_run.state->'situationCodes'\n    OR p_next_state->'domiciliation' IS DISTINCT FROM v_run.state->'domiciliation'");
  await db.exec(swap);
  await db.exec(`REVOKE ALL ON FUNCTION rpc_kq_update_run_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB),rpc_kq_swap_heritage_hand(UUID,UUID,TIMESTAMPTZ,JSONB) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION rpc_kq_update_run_state(UUID,UUID,TIMESTAMPTZ,TEXT,JSONB,JSONB),rpc_kq_swap_heritage_hand(UUID,UUID,TIMESTAMPTZ,JSONB) TO service_role;`);

  async function player() {
    const owner = randomUUID(); await db.query('INSERT INTO auth.users VALUES($1)', [owner]); await state(owner);
    await db.query('UPDATE kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1', [owner]);
    await db.query('UPDATE kq_commerce_accounts SET computer_owned=true WHERE user_id=$1', [owner]);
    await scalar("SELECT rpc_kq_online_command($1,'upgrade-site',$2::jsonb,$3)", [owner, JSON.stringify({ tier: 'basic', name: 'La Maison conservée' }), randomUUID()]);
    return owner;
  }
  const initial = { seed: 1, deckCodes: [], situationCodes: ['SECURITY'], usedCards: [], varietyCode: 'test', stageIndex: 0,
    rulesVersion: 2, phase: 'prepare', handCodes: ['A'], heritageReserveCodes: ['B'], history: [] };
  const start = (owner, snapshot, heritage = false) => scalar(heritage
    ? "SELECT rpc_kq_start_run_with_heritage($1,'TEST',1,'{}','{}',$2::jsonb,0,NULL)"
    : "SELECT rpc_kq_start_run($1,'TEST',1,'{}','{}',$2::jsonb,0)", [owner, JSON.stringify(snapshot)]).then(result => result.run);
  const owner = await player(), receiptKey = randomUUID(), archiveOwner = await player();
  const receipt = await command(owner, 'domiciliation', { mode: 'external' }, receiptKey);
  const oldHome = await start(archiveOwner, { ...initial, domiciliation: 'home' });
  const oldExternal = await start(owner, { ...initial, domiciliation: 'external' }, true);
  const oldMissingId = randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3::jsonb,'active')", [oldMissingId, archiveOwner, JSON.stringify(initial)]);
  // One contract is overdue and one has a future paid period. Neither is settled
  // before applying the retirement, which must never retroactively charge it.
  await db.query("UPDATE kq_commerce_accounts SET domiciliation_paid_until=now()-interval '121 hours' WHERE user_id=$1", [owner]);
  await db.query("UPDATE kq_online_accounts SET settled_until=now()-interval '122 hours' WHERE user_id=$1", [owner]);
  await db.query("UPDATE kq_commerce_accounts SET domiciliation_mode='external',domiciliation_renew=true,domiciliation_paid_until=now()+interval '1 hour' WHERE user_id=$1", [archiveOwner]);
  const facts = () => scalar(`SELECT jsonb_build_object(
    'accounts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY user_id) FROM kq_commerce_accounts a),
    'wallets',(SELECT jsonb_agg(to_jsonb(w) ORDER BY user_id) FROM kq_equipment_wallets w),
    'ledger',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM kq_business_ledger l),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY user_id,request_key) FROM kq_commerce_requests r),
    'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM kq_runs r))`);
  const permissions = () => scalar(`SELECT jsonb_agg(jsonb_build_object('name',oid::regprocedure::TEXT,'acl',proacl) ORDER BY oid)
    FROM pg_proc WHERE pronamespace='public'::regnamespace`);
  const before = await facts(), beforePermissions = await permissions();
  const previousSnapshot = await scalar('SELECT kq_business_snapshot($1)', [owner]);
  equal(previousSnapshot.domiciliation.retired, undefined, 'old server does not claim retirement');
  await db.exec(await sql(migrationName));
  const after = await facts();
  equal(after.wallets, before.wallets, 'retirement neither charges nor invents a refund');
  equal(after.ledger, before.ledger, 'financial history is unchanged');
  equal(after.receipts, before.receipts, 'old purchase receipts are unchanged');
  equal(after.runs, before.runs, 'ongoing home/external/missing-policy cultures are unchanged');
  equal(after.accounts, before.accounts.map(account => ({ ...account, domiciliation_renew: false, revision: account.revision + (account.domiciliation_renew ? 1 : 0) })), 'only future renewal and its revision are changed');
  equal(await permissions(), beforePermissions, 'migration preserves every existing function privilege');
  await db.exec(await sql(migrationName));
  equal(await facts(), after, 'reapplying the migration is idempotent');

  await db.exec('BEGIN');
  const retired = await scalar('SELECT kq_business_snapshot($1)', [owner]);
  equal(retired.domiciliation, { ...previousSnapshot.domiciliation, retired: true, renew: false, active: false }, 'snapshot retains the historical paid period and publishes retirement');
  for (const key of Object.keys(previousSnapshot).filter(key => !['domiciliation', 'nextEventAt', 'serverNow'].includes(key))) equal(retired[key], previousSnapshot[key], `snapshot preserves ${key}`);
  equal(Date.parse((await scalar('SELECT kq_business_snapshot($1)', [archiveOwner])).nextEventAt) > Date.parse((await scalar('SELECT kq_business_snapshot($1)', [archiveOwner])).domiciliation.paidUntil), true, 'retired paid period is not a future event');
  const balance = await cash(owner), payments = await scalar("SELECT count(*) FROM kq_business_ledger WHERE kind='domicile-paid'");
  for (let index = 0; index < 3; index++) await state(owner);
  equal(await cash(owner), balance, 'offline catch-up and repeated reads never renew the old subscription');
  equal(await scalar("SELECT count(*) FROM kq_business_ledger WHERE kind='domicile-paid'"), payments, 'no renewed address payment is recorded');
  equal((await state(owner)).business.shop.name, 'La Maison conservée', 'business name survives settlement');
  const replay = await command(owner, 'domiciliation', { mode: 'external' }, receiptKey);
  equal(replay, { ...receipt, replayed: true }, 'historical request is still replayable');
  equal(await cash(owner), balance, 'replay does not charge');
  for (const mode of ['home', 'external', 'retired']) await reject(() => command(owner, 'domiciliation', { mode }), 'commerce_domiciliation_retired');
  equal(await cash(owner), balance, 'new address commands do not charge');
  // Even a stale internal writer cannot reactivate billing, including when a
  // genuine VAT event shares the retired address deadline.
  await db.query("UPDATE kq_commerce_accounts SET domiciliation_renew=true,domiciliation_paid_until=now()-interval '1 second',vat_next_settlement_at=now()-interval '1 second' WHERE user_id=$1", [archiveOwner]);
  const staleBalance = await cash(archiveOwner);
  await db.query('SELECT kq_online_business_at($1,now())', [archiveOwner]);
  equal(await cash(archiveOwner), staleBalance, 'coincident real deadlines cannot charge a stale renewal');

  const compatibleRuns = [];
  for (const heritage of [false, true]) for (const policy of ['home', 'external']) {
    const starter = await player(), baseline = await cash(starter);
    const invoiceRun = randomUUID();
    await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{}','completed',now())", [invoiceRun, starter]);
    await db.query("INSERT INTO kq_lab_invoices(run_id,user_id,due_at) VALUES($1,$2,now()-interval '1 second')", [invoiceRun, starter]);
    for (const rejectedPolicy of [undefined, 'retired', 'invalid']) await reject(() => start(starter, { ...initial, ...(rejectedPolicy ? { domiciliation: rejectedPolicy } : {}) }, heritage), 'kq_domiciliation_changed');
    equal(await cash(starter), baseline, 'rejected stale start rolls back financial settlement');
    equal(await scalar('SELECT remaining_cents FROM kq_lab_invoices WHERE run_id=$1', [invoiceRun]), 4500, 'rejected start rolls back the genuine due invoice too');
    equal(await scalar("SELECT count(*) FROM kq_runs WHERE user_id=$1 AND status='active'", [starter]), 0, 'rejected start creates no culture');
    const run = await start(starter, { ...initial, domiciliation: policy }, heritage);
    compatibleRuns.push([run.id, run.state]);
    equal(run.state, { ...initial, domiciliation: policy }, 'old and retirement-aware servers keep the exact submitted state and path');
    equal(await cash(starter), baseline - 4500, 'valid start still settles unrelated due invoices exactly once');
  }
  const update = async (id, next, timestamp) => scalar("SELECT rpc_kq_update_run_state(user_id,id,$2::timestamptz,'roll',$3::jsonb,NULL) FROM kq_runs WHERE id=$1", [id, timestamp ?? await scalar('SELECT updated_at::TEXT FROM kq_runs WHERE id=$1', [id]), JSON.stringify(next)]);
  for (const [id, prior] of [[oldHome.id, oldHome.state], [oldExternal.id, oldExternal.state], [oldMissingId, initial], ...compatibleRuns]) {
    const version = await scalar('SELECT updated_at::TEXT FROM kq_runs WHERE id=$1', [id]);
    await reject(() => update(id, { ...prior, domiciliation: 'retired' }), 'kq_invalid_state_transition');
    await reject(() => update(id, { ...prior, domiciliation: prior.domiciliation === 'home' ? 'external' : 'home' }), 'kq_invalid_state_transition');
    equal(await scalar('SELECT updated_at::TEXT FROM kq_runs WHERE id=$1', [id]), version, 'rejected retrofit preserves the culture version');
    await update(id, prior);
    equal(await scalar('SELECT state FROM kq_runs WHERE id=$1', [id]), prior, 'historical culture can still advance with its original policy');
    await reject(() => update(id, prior, '2000-01-01T00:00:00Z'), 'kq_stale_run');
    await reject(() => scalar('SELECT rpc_kq_swap_heritage_hand(user_id,id,updated_at,$2::jsonb) FROM kq_runs WHERE id=$1', [id, JSON.stringify({ ...prior, domiciliation: 'retired' })]), 'kq_invalid_state_transition');
  }
  for (const role of ['anon', 'authenticated']) {
    for (const name of ['kq_business_assert_domiciliation(uuid,jsonb)', 'kq_business_command(uuid,text,jsonb)', 'kq_online_business_at(uuid,timestamptz)', 'rpc_kq_commerce_command(uuid,text,jsonb,uuid)']) equal(await scalar('SELECT has_function_privilege($1,$2,\'EXECUTE\')', [role, name]), false, `${role} cannot bypass ${name}`);
  }
  equal(await scalar("SELECT has_function_privilege('service_role','rpc_kq_commerce_command(uuid,text,jsonb,uuid)','EXECUTE')"), true, 'service role retains the commerce RPC');
  await db.exec('ROLLBACK');
  console.log(`PASS: ${checks} retirement checks; subscriptions, archive preservation, capability, receipt replay, immutable cultures and start authority.`);
} catch (error) {
  console.error(error.stack);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally { await db.close(); }
