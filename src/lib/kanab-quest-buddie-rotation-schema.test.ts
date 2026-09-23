import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(
  process.cwd(), "supabase/migrations/20260923000100_kq_buddie_rotation.sql",
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
