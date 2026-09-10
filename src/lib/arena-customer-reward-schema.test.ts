import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826000100_arena_customer_reward_pool.sql"),
  "utf8",
);
const weeklyDiceMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826000200_arena_customer_reward_weekly_dice.sql"),
  "utf8",
);

describe("Arena customer reward pool schema", () => {
  it("freezes the commercial facts used by the calculation", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS product_category TEXT");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS unit_weight_grams NUMERIC(12, 1)");
    expect(migration).toContain("arena_snapshot_order_item_product");
  });

  it("counts only paid flower weight and excludes gifts and cancelled orders", () => {
    expect(migration).toContain("o.payment_state = 'paid'");
    expect(migration).toContain("o.status <> 'cancelled'");
    expect(migration).toContain("o.archived_at IS NULL");
    expect(migration).toContain("item.product_category = 'fleurs'");
    expect(migration).toContain("item.line_total > 0");
    expect(migration).toContain("v_season.contribution_bps / 10000.0");
  });

  it("requires a frozen season before creating rewards", () => {
    expect(migration).toContain("rpc_arena_freeze_customer_reward_season");
    expect(migration).toContain("v_season.status <> 'frozen'");
    expect(migration).toContain("arena_customer_reward_season_must_be_frozen");
    expect(migration).toContain("arena_customer_reward_grants_already_exist");
  });

  it("keeps the surprise customer reward auditable and private", () => {
    expect(migration).toContain("lottery_secure_random_int(0, v_candidate_count - 1)");
    expect(migration).toContain("candidate_hash");
    expect(migration).toContain("arena_customer_reward_candidate_duplicate");
    expect(migration).toContain("arena_customer_reward_surprise_must_be_outside_top");
    expect(migration).toContain("oneChancePerCustomer");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("not a ticket product");
  });

  it("uses one weekly roll per Arena player to select 1/4/7/10 percent", () => {
    expect(weeklyDiceMigration).toContain("arena_customer_reward_week_rolls");
    expect(weeklyDiceMigration).toContain("UNIQUE (season_code, week_start, user_id)");
    expect(weeklyDiceMigration).toContain("dice_value BETWEEN 1 AND 6");
    expect(weeklyDiceMigration).toContain("p_average < 2.5 THEN 100");
    expect(weeklyDiceMigration).toContain("p_average < 3.5 THEN 400");
    expect(weeklyDiceMigration).toContain("p_average < 4.5 THEN 700");
    expect(weeklyDiceMigration).toContain("ELSE 1000");
    expect(weeklyDiceMigration).toContain("kq_rank_profiles");
  });

  it("freezes each finalized week with its own dice rate", () => {
    expect(weeklyDiceMigration).toContain("contribution_bps = public.arena_customer_reward_rate_from_dice");
    expect(weeklyDiceMigration).toContain("week_start < v_current_week");
    expect(weeklyDiceMigration).toContain("status = 'provisional'");
    expect(weeklyDiceMigration).toContain("Final weeks are immutable");
  });
});
