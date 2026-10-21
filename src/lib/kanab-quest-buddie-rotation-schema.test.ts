import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(
  process.cwd(), "supabase/migrations/20260923000100_kq_buddie_rotation.sql",
), "utf8");
const reducedRotation = readFileSync(join(
  process.cwd(), "supabase/migrations/20261019000100_kq_buddie_rotation_two.sql",
), "utf8");

describe("Buddie rotation database guard", () => {
  it("covers every start without counting updates or skipped duplicate inserts", () => {
    expect(migration).toContain("CREATE TRIGGER kq_guard_buddie_rotation AFTER INSERT ON public.kq_runs");
    expect(migration).not.toMatch(/AFTER (?:INSERT OR )?UPDATE/);
    expect(migration).toContain("kq_buddie_rotation_locked");
    expect(migration).toContain("'remainingDistinctBuddies', 6 - v_position");
  });

  it("serializes player history with the existing equipment lock order", () => {
    const equipmentLock = migration.indexOf("PERFORM pg_advisory_xact_lock");
    const rotationLock = migration.indexOf("FOR UPDATE", equipmentLock);
    const advance = migration.indexOf("SET recent_buddie_codes", rotationLock);
    expect(equipmentLock).toBeGreaterThan(0);
    expect(rotationLock).toBeGreaterThan(equipmentLock);
    expect(advance).toBeGreaterThan(rotationLock);
    expect(migration).toContain("'kq-equipment:' || NEW.user_id::TEXT");
  });

  it("backfills five distinct codes across seasons under the migration lock", () => {
    expect(migration).toContain("LOCK TABLE public.kq_runs IN SHARE ROW EXCLUSIVE MODE");
    expect(migration).toContain("DISTINCT ON (run.user_id, definition.code)");
    expect(migration).toContain("array_agg(code ORDER BY recency)");
    expect(migration).toContain("WHERE recency <= 5");
    expect(migration).not.toContain("season_code");
    expect(migration).not.toMatch(/WHERE[^;]*status\s*=/);
  });

  it("lets only the server read history and the trigger change it", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.kq_buddie_rotation FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT SELECT ON TABLE public.kq_buddie_rotation TO service_role");
    expect(migration).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)/);
  });
});

describe("two-variety rotation migration", () => {
  it("preserves the latest two tracked codes under the run and history locks", () => {
    const runLock = reducedRotation.indexOf("LOCK TABLE public.kq_runs");
    const historyLock = reducedRotation.indexOf("LOCK TABLE public.kq_buddie_rotation");
    const trim = reducedRotation.indexOf("SET recent_buddie_codes = recent_buddie_codes[1:2]");
    expect(runLock).toBeGreaterThan(0);
    expect(historyLock).toBeGreaterThan(runLock);
    expect(trim).toBeGreaterThan(historyLock);
    expect(reducedRotation).toContain("CHECK (cardinality(recent_buddie_codes) <= 2)");
    expect(reducedRotation).not.toContain("UPDATE public.kq_runs");
  });

  it("keeps the campaign bypass and reports the two-other cooldown for solo starts", () => {
    expect(reducedRotation).toContain("IF NEW.campaign_id IS NOT NULL THEN RETURN NEW; END IF;");
    expect(reducedRotation).toContain("'remainingDistinctBuddies', 3 - v_position");
    expect(reducedRotation).toContain("ARRAY[v_code] || v_recent[1:1]");
    expect(reducedRotation).not.toContain("DROP TRIGGER");
  });

  it("changes only the campaign queue bound and fails if that anchor has drifted", () => {
    expect(reducedRotation).toContain("pg_get_functiondef('public.rpc_kq_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)'::REGPROCEDURE)");
    expect(reducedRotation).toContain("previous_bound TEXT := '(new_codes||previous_codes)[1:5]'");
    expect(reducedRotation).toContain("next_bound TEXT := '(new_codes||previous_codes)[1:2]'");
    expect(reducedRotation).toContain("cardinality(string_to_array(body, previous_bound)) = 2");
    expect(reducedRotation).toContain("kq_buddie_rotation_campaign_anchor_changed");
  });

  it("retains server-only read access and named campaign execute access", () => {
    expect(reducedRotation).toContain("REVOKE ALL ON TABLE public.kq_buddie_rotation FROM PUBLIC, anon, authenticated, service_role");
    expect(reducedRotation).toContain("GRANT SELECT ON TABLE public.kq_buddie_rotation TO service_role");
    expect(reducedRotation).toContain("GRANT EXECUTE ON FUNCTION public.rpc_kq_start_campaign(UUID,UUID,JSONB,JSONB,INTEGER,TEXT) TO service_role");
    expect(reducedRotation).not.toMatch(/GRANT (?:ALL|INSERT|UPDATE|DELETE)/);
  });
});
