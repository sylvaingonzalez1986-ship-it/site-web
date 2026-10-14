// Prepare an isolated migration workdir; never connects to or modifies a database.
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'output/customer-demand-migration');
const baseline = path.join(root, 'output/warehouse-migration/deploy/supabase');
const deploy = path.join(output, 'deploy/supabase');
const migration = '20261012002000_kq_variety_market_demands.sql';
const project = (await readFile(path.join(baseline, '.temp/project-ref'), 'utf8')).trim();
if (project !== 'eyowwwpdmfrulhkpvlnf') throw new Error('Unexpected linked project; preparation stopped.');
const files = (await readdir(path.join(baseline, 'migrations'))).filter(name => /^\d+.*\.sql$/.test(name)).sort();
if (!files.includes('20261012000700_kq_warehouse_supplier_invoices.sql') || !files.includes('20261011150000_kq_online_commerce.sql')) throw new Error('Required applied baseline missing.');
if (files.some(name => name.slice(0, 14) > '20261012000700' || name.startsWith('20261010000500'))) throw new Error('Baseline contains an unrelated pending migration.');
await mkdir(path.join(deploy, 'migrations'), { recursive: true });
await mkdir(path.join(deploy, '.temp'), { recursive: true });
const allowed = new Set([...files, migration]);
const unexpected = (await readdir(path.join(deploy, 'migrations'))).filter(name => !allowed.has(name));
if (unexpected.length) throw new Error(`Unexpected isolated files; no deletion performed: ${unexpected.join(', ')}`);
for (const file of files) await copyFile(path.join(baseline, 'migrations', file), path.join(deploy, 'migrations', file));
await copyFile(path.join(baseline, 'config.toml'), path.join(deploy, 'config.toml'));
for (const file of ['project-ref', 'pooler-url', 'postgres-version', 'linked-project.json']) await copyFile(path.join(baseline, '.temp', file), path.join(deploy, '.temp', file));
await copyFile(path.join(root, 'supabase/migrations', migration), path.join(deploy, 'migrations', migration));
const source = await readFile(path.join(root, 'supabase/migrations', migration), 'utf8');
const quote = value => `'${value.replaceAll("'", "''")}'`;
const anchors = [];
let signature;
for (const line of source.split(/\r?\n/)) {
  const fn = line.match(/SELECT pg_get_functiondef\('([^']+)'::regprocedure\)/);
  if (fn) signature = fn[1];
  const anchor = line.match(/fragment:='((?:''|[^'])*)';/);
  if (anchor) anchors.push([signature, anchor[1].replaceAll("''", "'")]);
}
if (anchors.length !== 8 || anchors.some(([fn]) => !fn)) throw new Error('Migration anchor inventory changed.');
const requiredRelations = ['auth.users', 'public.kq_flowers', 'public.kq_commerce_stock', 'public.kq_commerce_batches', 'public.kq_commerce_accounts', 'public.kq_commerce_quotes', 'public.kq_storage_lots', 'public.kq_online_accounts', 'public.kq_online_listings'];
const unrelated = (await readdir(path.join(root, 'supabase/migrations'))).filter(name => !allowed.has(name)).sort();
const preflight = `BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
WITH anchors(signature,anchor) AS (VALUES
 ${anchors.map(([fn, fragment]) => `(${quote(fn)},${quote(fragment)})`).join(',\n ')}
), checked_anchors AS (
 SELECT signature,COALESCE(strpos(pg_get_functiondef(to_regprocedure(signature)),anchor)>0,false) AS present FROM anchors
), relations(name) AS (VALUES ${requiredRelations.map(name => `(${quote(name)})`).join(',')}), checked_relations AS (
 SELECT name,to_regclass(name) IS NOT NULL AS present FROM relations
), history AS (
 SELECT version FROM supabase_migrations.schema_migrations
 WHERE version IN ('20261011150000','20261012000700','20261012002000','20261010000500','20261012000800','20261012000900','20261012001000')
), status AS (
 SELECT (SELECT bool_and(present) FROM checked_anchors) AND (SELECT bool_and(present) FROM checked_relations)
 AND EXISTS(SELECT 1 FROM history WHERE version='20261011150000') AND EXISTS(SELECT 1 FROM history WHERE version='20261012000700')
 AND NOT EXISTS(SELECT 1 FROM history WHERE version='20261012002000')
 AND to_regclass('public.kq_customer_demand_usage') IS NULL
 AND to_regprocedure('public.kq_customer_demand_previous_commerce_state(uuid)') IS NULL AS ok
)
SELECT jsonb_build_object('ok',(SELECT ok FROM status),'anchors',(SELECT jsonb_agg(checked_anchors) FROM checked_anchors),
 'relations',(SELECT jsonb_agg(checked_relations) FROM checked_relations),'relevantAppliedVersions',(SELECT jsonb_agg(version ORDER BY version) FROM history),
 'scope','Read-only catalogs and migration history; no player RPC or player data queried.') AS preflight;
ROLLBACK;
`;
await writeFile(path.join(output, 'preflight.sql'), preflight);

const profileSource = await readFile(path.join(root, 'src/lib/kanab-quest-buddie-flavors.ts'), 'utf8');
const profiles = [...profileSource.matchAll(/  "(HH2026-\d+)": (\{"flavors":.*\}),/g)].map(([, code, raw]) => [code, JSON.parse(raw).flavors]);
if (profiles.length !== 52) throw new Error('Expected 52 flavor profiles.');
const expectedFunctions = ['kq_customer_demand_flavors(text)', 'kq_customer_demand_request(bigint,text)', 'kq_customer_demand_remaining(uuid,text,timestamp with time zone)', 'kq_customer_demand_snapshot(uuid,timestamp with time zone)', 'kq_customer_demand_match(uuid,uuid,text,numeric,integer,timestamp with time zone,boolean)', 'kq_customer_demand_consume(uuid,text,jsonb)', 'kq_customer_demand_validate_sale(uuid,public.kq_commerce_stock,jsonb,numeric,text,numeric)', 'kq_customer_demand_previous_commerce_state(uuid)', 'rpc_kq_commerce_state(uuid)'];
const verification = `BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
WITH roles(name) AS (VALUES ('anon'),('authenticated'),('service_role')),
 table_access AS (
 SELECT roles.name,c.relrowsecurity AS rls_enabled,
 has_table_privilege(roles.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS allowed
 FROM roles CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='kq_customer_demand_usage'
), functions(signature) AS (VALUES ${expectedFunctions.map(fn => `(${quote('public.' + fn)})`).join(',')}), function_access AS (
 SELECT signature,p.oid IS NOT NULL AS present,p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
 FROM functions LEFT JOIN pg_proc p ON p.oid=to_regprocedure(signature)
), profiles(code,expected) AS (VALUES
 ${profiles.map(([code, flavors]) => `(${quote(code)},ARRAY[${flavors.map(quote).join(',')}])`).join(',\n ')}
), checked_profiles AS (
 SELECT code,public.kq_customer_demand_flavors(code)=expected AS matches FROM profiles
), behavior AS (
 SELECT public.kq_online_raw_professional_price('cbd-shop',6.5,'normal',180,1)=300 AS shop_300,
 public.kq_online_raw_professional_price('cbd-shop',9.5,'restock',180,1.5)=300 AS shop_no_stacked_multiplier,
 public.kq_online_raw_professional_price('wholesale',6.5,'normal',180,1)=210 AS wholesale_210,
 public.kq_online_raw_professional_price('wholesale',6.49,'normal',180,1)=30 AS poor_quality_clearance_preserved,
 strpos(pg_get_functiondef('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure),'public.kq_customer_demand_validate_sale')>0 AS professional_settlement_hook,
 strpos(pg_get_functiondef('public.kq_online_offer(uuid,public.kq_online_listings,timestamptz)'::regprocedure),'WHEN quality>=9.5 THEN 1000 WHEN quality>=8.5 THEN 800 ELSE 700')>0 AS online_700_800_1000,
 strpos(pg_get_functiondef('public.kq_online_dispatch(uuid,uuid,timestamptz)'::regprocedure),'public.kq_customer_demand_consume')>0 AS online_consumption_hook,
 strpos(pg_get_functiondef('public.kq_online_settle_until(uuid,timestamptz)'::regprocedure),'floor(extract(epoch FROM cursor_at)/259200)')>0 AS offline_period_boundary,
 strpos(pg_get_functiondef('public.rpc_kq_commerce_state(uuid)'::regprocedure),'public.kq_customer_demand_snapshot')>0 AS snapshot_hook,
 EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.kq_customer_demand_usage'::regclass AND contype='p'
  AND pg_get_constraintdef(oid)='PRIMARY KEY (user_id, period, channel)') AS quota_shared_across_stocks
), requests AS (
 SELECT public.kq_customer_demand_request(6900,channel) AS item FROM unnest(ARRAY['online','cbd-shop','wholesale']) AS channels(channel)
), status AS (
 SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261012002000')
 AND (SELECT count(*)=3 AND bool_and(rls_enabled AND NOT allowed) FROM table_access)
 AND (SELECT bool_and(present AND NOT anon_execute AND NOT authenticated_execute
  AND service_execute=(signature='public.rpc_kq_commerce_state(uuid)')) FROM function_access)
 AND (SELECT count(*)=52 AND bool_and(matches) FROM checked_profiles)
 AND (SELECT bool_and(value::BOOLEAN) FROM behavior,jsonb_each_text(to_jsonb(behavior)))
 AND (SELECT count(*)=3 AND bool_and(jsonb_array_length(item->'flavorCodes')=2) FROM requests) AS ok
)
SELECT jsonb_build_object('ok',(SELECT ok FROM status),'tablePermissions',(SELECT jsonb_agg(table_access) FROM table_access),
 'functionPermissions',(SELECT jsonb_agg(function_access) FROM function_access),'behavior',(SELECT to_jsonb(behavior) FROM behavior),
 'profilesChecked',(SELECT count(*) FROM checked_profiles),'profileMismatches',(SELECT COALESCE(jsonb_agg(code),'[]'::JSONB) FROM checked_profiles WHERE NOT matches),
 'calendarExample',(SELECT jsonb_agg(item) FROM requests),
 'scope','Read-only catalogs, migration history and pure pricing/profile/calendar helpers; no player RPC or player account read.') AS verification;
ROLLBACK;
`;
await writeFile(path.join(output, 'verification.sql'), verification);
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const manifest = {
  project, preparedAtUtc: new Date().toISOString(), baselineSource: 'output/warehouse-migration/deploy',
  baselineMigrationCount: files.length, appliedBaselineMaximum: '20261012000700',
  newMigrations: [{ file: migration, sha256: sha256(await readFile(path.join(deploy, 'migrations', migration))) }],
  addedDependencies: [], excludedPendingMigrations: unrelated, assertedAnchors: anchors.length,
  verification: ['preflight.sql', 'verification.sql'].map(file => ({ file, sha256: sha256(file === 'preflight.sql' ? preflight : verification) })),
  note: 'Only the requested migration is new. Historical migration copies exist solely to match the already-applied remote history. No database operation was executed by this preparer.',
};
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const workdir = 'output/customer-demand-migration/deploy';
const modernCli = 'output/placard-rehearsal-tools/node_modules/@supabase/cli-windows-x64/bin/supabase.exe';
await writeFile(path.join(output, 'commands.json'), JSON.stringify({
  preflight: { executable: modernCli, args: ['db', 'query', '--linked', '--file', 'output/customer-demand-migration/preflight.sql', '--workdir', workdir, '--output', 'json'] },
  dryRun: { executable: 'C:/Users/sylva/scoop/shims/supabase.exe', args: ['db', 'push', '--linked', '--dry-run', '--workdir', workdir] },
  verification: { executable: modernCli, args: ['db', 'query', '--linked', '--file', 'output/customer-demand-migration/verification.sql', '--workdir', workdir, '--output', 'json'] },
  expectedDryRunMigrations: [migration],
  instruction: 'Stop if preflight.ok is not true or the dry-run lists any other migration. Root performs the authorized push separately; no push command is run here.'
}, null, 2) + '\n');
console.log(JSON.stringify({ output: path.relative(root, output), ...manifest }, null, 2));
