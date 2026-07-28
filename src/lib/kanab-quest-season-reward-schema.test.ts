import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const atomicMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002000_kq_atomic_season_reward_grants.sql"),
  "utf8",
);
const serializationMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002100_kq_serialize_season_reward_grants.sql"),
  "utf8",
);
const notebookSerializationMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002200_kq_serialize_notebook_reward_grants.sql"),
  "utf8",
);
const heritagePurchaseSerializationMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002300_kq_serialize_heritage_purchase_draws.sql"),
  "utf8",
);

describe("Kanab Quest season reward database contract", () => {
  it("keeps the grant transaction server-only and guarded by dormant rules", () => {
    expect(atomicMigration).toContain("is_active = TRUE");
    expect(atomicMigration).toContain("BOTTE_DU_CHANVRIER_2026");
    expect(atomicMigration).toContain("kq_season_reward_inactive_or_ineligible");
    expect(atomicMigration).toContain("TO service_role");
  });

  it("serializes concurrent retries on the idempotency key", () => {
    expect(serializationMigration).toContain("pg_advisory_xact_lock");
    expect(serializationMigration).toContain("hashtextextended(v_lock_key, 0)");
    expect(serializationMigration).toContain("rpc_kq_grant_season_reward_unlocked");
    expect(serializationMigration).toContain("FROM PUBLIC, anon, authenticated, service_role");
  });

  it("serializes concurrent notebook grants and hides the unlocked function", () => {
    expect(notebookSerializationMigration).toContain("pg_advisory_xact_lock");
    expect(notebookSerializationMigration).toContain("p_profile_badge_id::TEXT");
    expect(notebookSerializationMigration).toContain("rpc_kq_grant_notebook_badge_reward_unlocked");
    expect(notebookSerializationMigration).toContain("FROM PUBLIC, anon, authenticated, service_role");
  });

  it("serializes concurrent Heritage draws for the same purchased unit", () => {
    expect(heritagePurchaseSerializationMigration).toContain("pg_advisory_xact_lock");
    expect(heritagePurchaseSerializationMigration).toContain("p_order_item_id::TEXT");
    expect(heritagePurchaseSerializationMigration).toContain("p_unit_index::TEXT");
    expect(heritagePurchaseSerializationMigration).toContain("rpc_kq_draw_heritage_for_purchase_unlocked");
    expect(heritagePurchaseSerializationMigration).toContain("FROM PUBLIC, anon, authenticated, service_role");
  });
});
