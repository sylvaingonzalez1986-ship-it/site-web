import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260726000100_kq_support_boosters_points_shop.sql"),
  "utf8",
);
const activationMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260726000200_kq_activate_ten_card_support_boosters.sql"),
  "utf8",
);

describe("Kanab Quest La Botte points shop schema", () => {
  it("keeps purchases separate from Buddies tickets and uses the shared loyalty wallet", () => {
    expect(migration).toContain("'points_purchase'");
    expect(migration).toContain("loyalty_points_spent");
    expect(migration).toContain("kq_support_booster_entitlements");
    expect(migration).not.toContain("INSERT INTO public.lottery_tickets");
  });

  it("makes a repeated purchase request idempotent", () => {
    expect(migration).toContain("kq_support_points_purchases");
    expect(migration).toContain("UNIQUE (user_id, request_key)");
    expect(migration).toContain("'replayed', TRUE");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("keeps the shop dormant while the La Botte collection is inactive", () => {
    expect(migration).toContain("code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE");
    expect(migration).toContain("support_collection_unavailable");
  });

  it("activates ten-card La Botte boosters without changing Buddies definitions", () => {
    expect(activationMigration).toContain("FOR v_slot_index IN 1..10 LOOP");
    expect(activationMigration).toContain("code = 'BOTTE_DU_CHANVRIER_2026'");
    expect(activationMigration).toContain("SET is_active = TRUE");
    expect(activationMigration).not.toContain("HH2026");
  });
});
