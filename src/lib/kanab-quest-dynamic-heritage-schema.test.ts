import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(path.join(
  process.cwd(),
  "supabase/migrations/20260906000500_kq_dynamic_producer_heritages.sql",
), "utf8");
const expandedEffectsMigration = fs.readFileSync(path.join(
  process.cwd(),
  "supabase/migrations/20260906000600_kq_expand_unique_heritage_effects.sql",
), "utf8");

describe("Kanab Quest dynamic producer Heritages", () => {
  it("creates exactly one auto-managed definition per producer", () => {
    expect(migration).toContain("uq_kq_heritage_definition_producer");
    expect(migration).toContain("kq_ensure_producer_heritage");
    expect(migration).toContain("AFTER INSERT OR UPDATE OF name, image ON public.producers");
  });

  it("archives a removed producer card without deleting player draws", () => {
    expect(migration).toContain("BEFORE DELETE ON public.producers");
    expect(migration).toContain("SET is_active = FALSE");
    expect(migration).toContain("producer_name TEXT NOT NULL DEFAULT ''");
    expect(migration).not.toContain("DELETE FROM public.kq_heritage_draws");
  });

  it("supports an extensible numeric catalogue and verifies the selected mechanic", () => {
    expect(migration).toContain("^HERITAGE-[0-9]{3,6}$");
    expect(migration).toContain("kq_heritage_card_number_seq");
    expect(migration).toContain("p_initial_state->>'heritageEffect'");
    expect(migration).toContain("p_initial_state->>'heritageTiming'");
  });

  it("crafts only an active missing producer card and debits five fragments atomically", () => {
    expect(migration).toContain("v_cost CONSTANT INTEGER := 5");
    expect(migration).toContain("WHERE code = p_card_code AND is_active = TRUE AND producer_id IS NOT NULL");
    expect(migration).toContain("RAISE EXCEPTION 'kq_heritage_already_owned'");
    expect(migration).toContain("WHERE user_id = p_user_id FOR UPDATE");
    expect(migration).toContain("SET balance = balance - v_cost");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_kq_craft_heritage_card(UUID, TEXT)");
    expect(migration).toContain("TO service_role");
  });

  it("assigns producer powers from an extensible catalog without active duplicates", () => {
    expect(expandedEffectsMigration).toContain("CREATE TABLE IF NOT EXISTS public.kq_heritage_effect_catalog");
    expect(expandedEffectsMigration).toContain("'fragile-quality-boost'");
    expect(expandedEffectsMigration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_active_heritage_effect");
    expect(expandedEffectsMigration).toContain("pg_advisory_xact_lock(hashtext('kq_heritage_unique_effect_assignment'))");
    expect(expandedEffectsMigration).toContain("NOT EXISTS (\n      SELECT 1\n      FROM public.kq_heritage_card_definitions definition");
    expect(expandedEffectsMigration).toContain("'pending-editorial-' || v_code");
    expect(expandedEffectsMigration).not.toContain("reuse the\n  -- least represented");
  });
});
