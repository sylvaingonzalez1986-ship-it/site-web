// In-memory PostgreSQL only. Rehearse the four delayed migrations AFTER the
// already released harvest-title and two-variety rotation migrations.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

const fixtureUrl = new URL("./test-placard-harvest-tier-campaigns.mjs", import.meta.url);
const preflight = await readFile(new URL("../output/game-followup-migrations-2026-10-19/preflight.sql", import.meta.url), "utf8");
const postflight = await readFile(new URL("../output/game-followup-migrations-2026-10-19/postflight.sql", import.meta.url), "utf8");
const injection = `
  await db.exec(await sql("20261019000300_kq_starting_budget.sql"));
  // The inherited culture fixture omits the bank offer RPC and its quote tables.
  // Load its real current definition for drift checks; the dedicated bank suite
  // separately exercises this RPC against the complete bank schema.
  await db.exec("SET check_function_bodies=false");
  await db.exec(await definition("20260923000700_kq_bank_investment_limits.sql","rpc_kq_bank"));
  const monthlyBankSource=await sql("20260924000100_kq_bank_monthly_installments.sql");
  const monthlyBankPatchStart=monthlyBankSource.indexOf("DO $$");
  await db.exec(monthlyBankSource.slice(monthlyBankPatchStart,monthlyBankSource.indexOf("END $$;",monthlyBankPatchStart)+7));
  await db.exec("SET check_function_bodies=true");
  const followupFingerprints = () => scalar("SELECT jsonb_object_agg(proname,md5(prosrc)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('kq_guard_buddie_rotation','rpc_kq_start_campaign','kq_harvest_tier_rank','kq_guard_harvest_tier_run','kq_guard_flower_harvest_evidence','kq_mission_metrics','rpc_kq_player_core_snapshot','kq_start_run_with_heritage_internal','kq_start_campaign_leader_internal')");
  const beforeFollowup = await followupFingerprints();
  const preflightResult = (await db.exec(${JSON.stringify(preflight)})).flatMap(result => result.rows ?? []).find(row => row.preflight)?.preflight;
  if (preflightResult.failedAnchors.length) console.error("Followup missing patch anchors:", JSON.stringify(preflightResult.failedAnchors));
  for (const [name, passed] of Object.entries(preflightResult.checks)) {
    // This culture fixture deliberately has no lottery/welcome-pack schema.
    if (!["newer_migrations_present", "newer_functions_present"].includes(name)) equal(passed,true,"followup preflight: "+name);
  }
  for (const migration of ["20261018000500_kq_postharvest_quality.sql","20261018000600_kq_postharvest_prices_and_climate_billing.sql","20261018000700_kq_postharvest_quality_tiers.sql","20261018000800_kq_bank_progressive_credit.sql"]) {
    if (migration.includes("bank_progressive")) await db.exec("SET check_function_bodies=false");
    await db.exec(await sql(migration));
    await db.exec("SET check_function_bodies=true");
    await db.query("INSERT INTO supabase_migrations.schema_migrations(version) VALUES($1)",[migration.slice(0,14)]);
  }
  equal(await followupFingerprints(),beforeFollowup,"delayed batch preserves harvest-title evidence, mission metrics, starts and two-variety rotation exactly");
  const postflightResult = (await db.exec(${JSON.stringify(postflight)})).flatMap(result => result.rows ?? []).find(row => row.postflight)?.postflight;
  for (const [name, passed] of Object.entries(postflightResult.checks)) {
    if (!["newer_migrations_present", "newer_functions_present"].includes(name)) equal(passed,true,"followup postflight: "+name);
  }
  console.log("Followup migrations: read-only preflight/postflight, delayed order and preserved newer functions passed.");
`;

const readFixture = async (file, ...options) => {
  const content = await readFile(file, ...options);
  const filename = (file instanceof URL ? file.pathname : String(file)).replaceAll("\\", "/");
  if (!filename.endsWith("/test-placard-shared-campaigns.mjs")) return content;
  const anchor = "  await db.exec(rotationMigration); // Safe to replay without restoring five-code histories.";
  assert(content.includes(anchor), "rotation fixture injection marker changed");
  return content.replace(anchor, () => anchor + injection);
};
let source = (await readFile(fixtureUrl, "utf8")).replaceAll("\r\n", "\n");
source = source.replace(/^import .*;\n/gm, "").replace('new URL("./test-placard-shared-campaigns.mjs", import.meta.url)', `new URL("./test-placard-shared-campaigns.mjs", ${JSON.stringify(fixtureUrl.href)})`);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", source)(assert, randomUUID, readFixture, path, createServer, PGlite);
if (!process.exitCode) console.log("Followup release rehearsal: actual campaign start, six persisted stages and harvest succeeded after all four migrations.");
