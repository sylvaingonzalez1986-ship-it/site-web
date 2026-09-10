import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260830000100_kq_durable_equipment_shop.sql"),
  "utf8",
);
const currentCatalogMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901000100_kq_us_processing_and_culture_systems.sql"),
  "utf8",
);

describe("Kanab Quest durable equipment shop schema", () => {
  it("creates a wallet, durable inventory, loadout and receipts", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.kq_equipment_wallets");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.kq_player_equipment");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.kq_equipment_loadouts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.kq_equipment_purchase_receipts");
    expect(migration).toContain("cash_cents INTEGER NOT NULL DEFAULT 35000");
    expect(migration).toContain("reputation INTEGER NOT NULL DEFAULT 0");
  });

  it("grants and installs the starter equipment exactly once", () => {
    expect(migration).toContain("rpc_kq_ensure_equipment_profile");
    expect(migration).toContain("'TENT-080-STARTER'");
    expect(migration).toContain("'LED-150-STARTER'");
    expect(migration).toContain("'AIR-STARTER'");
    expect(migration).toContain("ON CONFLICT (user_id, equipment_code) DO NOTHING");
    expect(migration).toContain("ON CONFLICT (user_id, slot) DO NOTHING");
  });

  it("makes checkout atomic and idempotent", () => {
    expect(migration).toContain("UNIQUE (user_id, request_key)");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("'replayed', TRUE");
    expect(migration).toContain("insufficient_equipment_cash");
  });

  it("keeps mutations behind service-role RPCs", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.rpc_kq_purchase_equipment");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_equipment(UUID, UUID, TEXT[]) TO service_role");
    expect(migration).toContain("FOREIGN KEY (user_id, equipment_code)");
  });

  it("synchronizes the US processing catalog and its two new loadout slots", () => {
    expect(currentCatalogMigration).toContain("'filtration', 'static-separation'");
    expect(currentCatalogMigration).toContain("('STATIC-PLASMA', 'processing', 'static-separation', 2280000");
    expect(currentCatalogMigration).toContain("('TSS-225', 'processing', 'washing', 7940000");
    expect(currentCatalogMigration).toContain("('FREEZE-DRYER', 'processing', 'drying', 749500");
    expect(currentCatalogMigration).toContain("ON CONFLICT (code) DO UPDATE SET");
  });
});
