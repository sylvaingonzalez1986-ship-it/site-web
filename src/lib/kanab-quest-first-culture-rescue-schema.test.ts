import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261007000200_kq_first_culture_rescue.sql"), "utf8");
const businessMigration = readFileSync(join(process.cwd(), "supabase/migrations/20260921000100_kq_business_calendar.sql"), "utf8");

describe("first official culture rescue database ownership", () => {
  it("serializes eligibility with the same per-user lock already taken by both start RPCs", () => {
    const lock = migration.indexOf("PERFORM pg_advisory_xact_lock");
    const history = migration.indexOf("IF NOT EXISTS (SELECT 1 FROM public.kq_runs WHERE user_id = NEW.user_id)");
    expect(lock).toBeGreaterThan(0);
    expect(history).toBeGreaterThan(lock);
    expect(migration).toContain("'kq-equipment:' || NEW.user_id::TEXT");
    expect(businessMigration).toContain("'kq-equipment:'||p_user::TEXT");
    expect(businessMigration).toContain("p.proname IN ('rpc_kq_start_run','rpc_kq_start_run_with_heritage')");
    expect(businessMigration).toContain("PERFORM public.kq_business_assert_domiciliation(p_user_id,p_initial_state)");
  });

  it("covers insertion and heritage-wrapper updates without filtering past runs or backfilling them", () => {
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF state ON public.kq_runs");
    expect(migration).toContain("ELSIF OLD.state->'firstCultureRescue' = 'true'::JSONB THEN");
    expect(migration).not.toMatch(/WHERE[^;]*(?:status|season|challenge_day)/);
    expect(migration).not.toMatch(/UPDATE public\.kq_runs/);
  });

  it("keeps the new routine trigger-only with no additional table privileges", () => {
    expect(migration).toContain("NEW.state := NEW.state - 'firstCultureRescue'");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).not.toMatch(/GRANT\s/);
    expect(migration).not.toMatch(/CREATE TABLE/);
  });
});
