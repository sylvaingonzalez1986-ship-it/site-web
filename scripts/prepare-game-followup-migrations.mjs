// Local release dossier only: this script never connects to a database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const destination = path.resolve("output/game-followup-migrations-2026-10-19");
const filenames = [
  "20261018000500_kq_postharvest_quality.sql",
  "20261018000600_kq_postharvest_prices_and_climate_billing.sql",
  "20261018000700_kq_postharvest_quality_tiers.sql",
  "20261018000800_kq_bank_progressive_credit.sql",
];
const migrations = await Promise.all(filenames.map(async (file) => {
  const content = await readFile(path.resolve("supabase/migrations", file), "utf8");
  return { file, version: file.slice(0, 14), sha256: createHash("sha256").update(content).digest("hex"), content };
}));
const quote = (text) => `'${text.replaceAll("'", "''")}'`;
const rows = (values) => values.map((row) => `(${row.map(quote).join(",")})`).join(",\n    ");
const singleRows = (values) => rows(values.map((value) => [value]));
const versions = migrations.map(({ version }) => version);
const preservedVersions = ["20261018000900", "20261019000100", "20261019000200", "20261019000300", "20261019000400"];
const climatePatches = [...migrations[1].content.matchAll(/SELECT pg_temp\.kq_climate_patch\('((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)'\);/g)]
  .map((match) => match.slice(1).map((part) => part.replaceAll("''", "'")));
assert.equal(climatePatches.length, 9, "Every guarded climate patch must be represented in the release checks");
const anchors = [
  ["public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)", "PERFORM public.kq_warehouse_validate_catalog_run(validation);"],
  ...climatePatches.map(([signature, before]) => [signature, before]),
  ["public.rpc_kq_bank(uuid,jsonb)", "cap:=CASE WHEN rep>=3000 THEN 25000000 WHEN rep>=1500 THEN 10000000 WHEN rep>=600 THEN 2500000 WHEN rep>=200 THEN 500000 ELSE 0 END;"],
  ["public.rpc_kq_bank(uuid,jsonb)", "'termDays',35,'expiresAt'"],
];
const preservedFunctions = [
  "public.kq_harvest_tier_rank(integer,integer,integer,integer)", "public.kq_guard_harvest_tier_run()",
  "public.kq_guard_flower_harvest_evidence()", "public.kq_mission_metrics(uuid)",
  "public.rpc_kq_player_core_snapshot(uuid)",
  "public.kq_start_run_with_heritage_internal(uuid,text,integer,text[],text[],jsonb,integer,text)",
  "public.kq_start_campaign_leader_internal(uuid,text,integer,text[],text[],jsonb,integer,text)",
  "public.kq_guard_buddie_rotation()", "public.rpc_kq_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)",
  "public.kq_starter_buddie_catalog()", "public.rpc_claim_welcome_pack(uuid)",
  "public.rpc_scratch_ticket(uuid,uuid)", "public.kq_scratch_ordinary_ticket(uuid,uuid)",
];
const renamedSources = [...migrations[0].content.matchAll(/ALTER FUNCTION public\.([a-z_]+)\(([^)]*)\) RENAME TO ([a-z_]+);/g)]
  .map((match) => [`public.${match[1]}(${match[2].toLowerCase()})`, `public.${match[3]}(${match[2].toLowerCase()})`]);
assert.equal(renamedSources.length, 2);
const privateHelpers = [...new Set(migrations.flatMap(({ content }) => [...content.matchAll(/REVOKE ALL ON FUNCTION ([\s\S]*?)\s+FROM PUBLIC\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role;/g)]
  .flatMap((match) => [...match[1].matchAll(/public\.([a-z_]+)\(([^)]*)\)/g)]
    .map((fn) => `public.${fn[1]}(${fn[2].toLowerCase().replaceAll(" ", "")})`))))]
  .filter((signature) => !signature.startsWith("public.rpc_"));
assert(privateHelpers.length > 25, "The full new private helper chain must be checked");
const fingerprints = `SELECT jsonb_object_agg(signature,md5(p.prosrc))
  FROM preserved_functions f LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.signature)`;
const releasePreconditions = `
    (SELECT count(*)=5 FROM supabase_migrations.schema_migrations WHERE version IN (${preservedVersions.map(quote).join(",")})) AS newer_migrations_present,
    (SELECT count(*)=13 FROM preserved_functions f JOIN pg_proc p ON p.oid=to_regprocedure(f.signature)) AS newer_functions_present,
    (SELECT pg_get_expr(d.adbin,d.adrelid)='100000' FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.kq_equipment_wallets'::regclass AND a.attname='cash_cents') AS starting_budget_preserved,
    EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.kq_buddie_rotation'::regclass AND conname='kq_buddie_rotation_two_recent_buddies') AS rotation_limit_preserved`;

const preflight = `-- Read-only: aggregate counts, catalog metadata and function fingerprints only.
BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
WITH anchors(signature,anchor) AS (VALUES
    ${rows(anchors)}
), preserved_functions(signature) AS (VALUES
    ${singleRows(preservedFunctions)}
), renamed_sources(signature,new_signature) AS (VALUES
    ${rows(renamedSources)}
), anchor_checks AS (
  SELECT signature,anchor,COALESCE((length(body)-length(replace(body,anchor,'')))=length(anchor),false) AS ok
  FROM anchors CROSS JOIN LATERAL (SELECT replace(pg_get_functiondef(to_regprocedure(signature)),E'\\r\\n',E'\\n') body) d
), checks AS (
  SELECT
    NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN (${versions.map(quote).join(",")})) AS four_migrations_pending,
    ${releasePreconditions},
    (SELECT bool_and(to_regprocedure(signature) IS NOT NULL AND to_regprocedure(new_signature) IS NULL) FROM renamed_sources) AS rename_sources_ready,
    to_regclass('public.kq_storage_climate_accounts') IS NULL AND to_regclass('public.kq_storage_climate_invoices') IS NULL AS climate_tables_absent,
    to_regprocedure('public.kq_bank_credit_limit(integer)') IS NULL AS progressive_limit_absent,
    (SELECT bool_and(ok) FROM anchor_checks) AS every_patch_anchor_exactly_once,
    NOT EXISTS(SELECT 1 FROM public.kq_storage_lots WHERE state->>'methodCode' IS NULL OR state->>'lastSettledAt' IS NULL OR state->>'curingStartedAt' IS NULL OR state->>'readyAt' IS NULL) AS storage_timestamps_present
)
SELECT jsonb_build_object(
 'ok',(SELECT bool_and(value='true'::jsonb) FROM jsonb_each(to_jsonb(c))),
 'checks',to_jsonb(c),
 'failedAnchors',COALESCE((SELECT jsonb_agg(jsonb_build_object('signature',signature,'anchor',anchor)) FROM anchor_checks WHERE NOT ok),'[]'::jsonb),
 'preservedFunctionHashes',(${fingerprints}),
 'counts',jsonb_build_object('storageLots',(SELECT count(*) FROM public.kq_storage_lots),'activeCultures',(SELECT count(*) FROM public.kq_runs WHERE status::text='active'),'installedClimates',(SELECT count(*) FROM public.kq_warehouse_layouts WHERE state ? 'storageClimateCode'))
) AS preflight FROM checks c;
ROLLBACK;
`;

const afterAnchors = [
  ["public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)", "PERFORM public.kq_warehouse_validate_postharvest_run(w);"],
  ...climatePatches.filter(([signature]) => signature !== "public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)").map(([signature,, after]) => [signature, after]),
  ["public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)", "w->'climateBillingVersion' IS DISTINCT FROM '2'::JSONB"],
  ["public.kq_validate_warehouse_run_start(uuid,uuid,jsonb)", "w->'postHarvestBalanceVersion' IS DISTINCT FROM '2'::JSONB"],
  ["public.rpc_kq_bank(uuid,jsonb)", "cap:=public.kq_bank_credit_limit(rep);"],
  ["public.rpc_kq_bank(uuid,jsonb)", "'termDays',35,'expiresAt'"],
];
const postflight = `-- Read-only: synthetic quotes, access checks and aggregate counts only.
-- Compare preservedFunctionHashes to preflight; player activity is not needed.
BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
WITH preserved_functions(signature) AS (VALUES
    ${singleRows(preservedFunctions)}
), anchors(signature,anchor) AS (VALUES
    ${rows(afterAnchors)}
), api_roles(role_name) AS (VALUES ('anon'),('authenticated'),('service_role')),
 helpers(signature) AS (VALUES
    ${singleRows(privateHelpers)}
), helper_procs AS (SELECT p.* FROM helpers h JOIN pg_proc p ON p.oid=to_regprocedure(h.signature)),
 climate_tables AS (SELECT * FROM pg_class WHERE oid IN ('public.kq_storage_climate_accounts'::regclass,'public.kq_storage_climate_invoices'::regclass)),
 prices(code,price) AS (VALUES ('SJ-DRYIT90',14900),('SIM-DRYING-02',69900),('SIM-DRYING-03',249900),('LP-SUPER-1L',2990),('BROR-JARS-48',64900),('CURTEC-60L',89900),('SIM-STORAGE-CLIMATE-01',49900),('SIM-STORAGE-CLIMATE-02',179900),('SIM-STORAGE-CLIMATE-03',499900)),
 credit_cases(reputation,expected) AS (VALUES (NULL::integer,0),(-1,0),(199,0),(200,500000),(201,505000),(599,2495000),(600,2500000),(601,2508300),(1499,9991600),(1500,10000000),(1501,10010000),(2999,24990000),(3000,25000000),(4000,25000000)),
 premium AS (SELECT '{"storageClimateCode":"SIM-STORAGE-CLIMATE-03","serviceZones":[{"kind":"drying","deviceCode":"SIM-DRYING-03","width":1,"height":1},{"kind":"storage","deviceCode":"CURTEC-60L","width":1,"height":1}]}'::jsonb state),
 quality AS (SELECT public.kq_warehouse_postharvest_profile(state) current_profile,public.kq_warehouse_postharvest_profile_v1(state) legacy_profile,public.kq_storage_climate_quote(state) climate FROM premium),
 checks AS (SELECT
    (SELECT count(*)=4 FROM supabase_migrations.schema_migrations WHERE version IN (${versions.map(quote).join(",")})) AS four_migrations_recorded,
    ${releasePreconditions},
    (SELECT bool_and(strpos(pg_get_functiondef(to_regprocedure(signature)),anchor)>0) FROM anchors) AS all_patches_present,
    (SELECT count(*)=${privateHelpers.length} FROM helper_procs) AS all_private_helpers_present,
    NOT EXISTS(SELECT 1 FROM helper_procs p CROSS JOIN api_roles r WHERE has_function_privilege(r.role_name,p.oid,'EXECUTE')) AND NOT EXISTS(SELECT 1 FROM helper_procs p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS helpers_private,
    (SELECT bool_and(relrowsecurity) FROM climate_tables) AND NOT EXISTS(SELECT 1 FROM climate_tables t CROSS JOIN api_roles r WHERE has_table_privilege(r.role_name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AND NOT EXISTS(SELECT 1 FROM climate_tables t CROSS JOIN LATERAL aclexplode(COALESCE(t.relacl,acldefault('r',t.relowner))) a WHERE a.grantee=0) AS climate_tables_private_rls,
    has_function_privilege('service_role','public.rpc_kq_bank(uuid,jsonb)','EXECUTE') AND has_function_privilege('service_role','public.rpc_kq_energy_snapshot(uuid)','EXECUTE') AND NOT EXISTS(SELECT 1 FROM api_roles r WHERE role_name<>'service_role' AND (has_function_privilege(r.role_name,'public.rpc_kq_bank(uuid,jsonb)','EXECUTE') OR has_function_privilege(r.role_name,'public.rpc_kq_energy_snapshot(uuid)','EXECUTE'))) AS rpc_service_only,
    (SELECT bool_and((public.kq_warehouse_device(code)->>'priceCents')::integer=price) FROM prices) AS nine_current_prices,
    (SELECT bool_and(public.kq_bank_credit_limit(reputation)=expected) FROM credit_cases) AS progressive_credit_boundaries,
    (SELECT (current_profile->>'dryingQualityBonus')::numeric=.7 AND (current_profile->>'storageQualityBonus')::numeric=.6 AND (current_profile->>'climateQualityBonus')::numeric=.5 AND (current_profile->>'aromaRateFactor')::numeric=33 FROM quality) AS premium_quality_and_protection,
    (SELECT (legacy_profile->>'dryingQualityBonus')::numeric=.4 AND (legacy_profile->>'storageQualityBonus')::numeric=.3 AND (legacy_profile->>'climateQualityBonus')::numeric=.3 FROM quality) AS historical_quality_retained,
    (SELECT (climate->>'monthlyCostCents')::numeric=600 AND (climate->>'monthlyKwh')::numeric=24 FROM quality) AS monthly_climate_per_square_metre,
    NOT EXISTS(SELECT 1 FROM public.kq_storage_lots WHERE NOT(state ? 'postHarvest')) AS existing_lots_checkpointed,
    (SELECT count(*)=3 FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'D' AND tgname IN ('kq_storage_postharvest_lot','kq_warehouse_z_postharvest_sync','kq_warehouse_storage_climate_billing')) AS three_triggers_enabled
)
SELECT jsonb_build_object(
 'ok',(SELECT bool_and(value='true'::jsonb) FROM jsonb_each(to_jsonb(c))),
 'checks',to_jsonb(c),
 'preservedFunctionHashes',(${fingerprints}),
 'counts',jsonb_build_object('storageLots',(SELECT count(*) FROM public.kq_storage_lots),'climateAccounts',(SELECT count(*) FROM public.kq_storage_climate_accounts),'climateInvoices',(SELECT count(*) FROM public.kq_storage_climate_invoices),'legacyTransitionCreditCents',(SELECT COALESCE(sum(initial_transition_credit_cents),0) FROM public.kq_storage_climate_accounts))
) AS postflight FROM checks c;
ROLLBACK;
`;
await mkdir(destination, { recursive: true });
for (const [name, content] of [["preflight.sql", preflight], ["postflight.sql", postflight]]) await writeFile(path.join(destination, name), content);
await writeFile(path.join(destination, "manifest.json"), JSON.stringify({
  generatedAt: new Date().toISOString(), status: "prepared-locally-not-applied",
  migrations: migrations.map(({ file, version, sha256 }) => ({ file, version, sha256 })),
  preservesAppliedVersions: preservedVersions, preservedFunctions,
  checkedClimatePatchCount: climatePatches.length, privateHelperCount: privateHelpers.length,
  releaseRequirement: "Deploy compatible game server immediately alongside this batch: new cultures require postHarvestBalanceVersion=2, and installed climate also requires climateBillingVersion=2.",
  effects: ["New equipment prices and monthly climate charges apply going forward.", "Existing active legacy climate quotes receive a non-cash credit against future monthly bills.", "Storage exposure is checkpointed at migration time; no past curing bonus is invented.", "New credit capacity follows reputation; existing signed loans and repayment dates stay unchanged."],
  verification: ["Run preflight in a read-only transaction and require ok=true.", "Ensure CLI dry-run lists exactly these four versions (older than the latest applied version).", "After application require postflight ok=true and identical preservedFunctionHashes.", "Do not invoke stateful player RPCs for verification."],
}, null, 2) + "\n");
console.log(`Prepared four migration hashes, ${anchors.length} preflight anchors, ${privateHelpers.length} private helper checks and read-only SQL in ${destination}.`);
