import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const statusMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002500_kq_cancelled_battle_status.sql"),
  "utf8",
);
const expiryMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002600_kq_expire_abandoned_battles.sql"),
  "utf8",
);
const dailyGateMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002700_kq_daily_battle_expiry_gate.sql"),
  "utf8",
);

describe("Kanab Quest abandoned battle expiry", () => {
  it("keeps cancelled battles as an auditable status", () => {
    expect(statusMigration).toContain("ADD VALUE IF NOT EXISTS 'cancelled'");
    expect(expiryMigration).toContain("SET status = 'cancelled'");
  });

  it("unlocks both flowers without burning them or changing ranking", () => {
    expect(expiryMigration).toContain("SET status = 'available', locked_at = NULL");
    expect(expiryMigration).toContain("burned_at IS NULL");
    expect(expiryMigration).toContain("v_unlocked_count <> 2");
    expect(expiryMigration).not.toContain("kq_rank_profiles");
  });

  it("processes bounded concurrent-safe batches", () => {
    expect(expiryMigration).toContain("LIMIT p_limit");
    expect(expiryMigration).toContain("FOR UPDATE SKIP LOCKED");
    expect(expiryMigration).toContain("'hasMore'");
  });

  it("runs once per day unless another bounded batch is still required", () => {
    expect(dailyGateMigration).toContain("kq_maintenance_runs");
    expect(dailyGateMigration).toContain("pg_advisory_xact_lock");
    expect(dailyGateMigration).toContain("run_day = current_date");
    expect(dailyGateMigration).toContain("v_previous->>'hasMore'");
    expect(dailyGateMigration).toContain("'skipped', true");
  });
});
