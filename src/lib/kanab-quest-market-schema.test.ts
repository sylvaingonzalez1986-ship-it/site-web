import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260830000200_kq_post_harvest_market.sql"),
  "utf8",
);

describe("Kanab Quest post-harvest market schema", () => {
  it("keeps the commercial lot distinct from its burned flower", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.kq_market_lots");
    expect(migration).toContain("flower_id UUID PRIMARY KEY REFERENCES public.kq_flowers");
    expect(migration).toContain("status = 'burned'");
    expect(migration).toContain("status IN ('ready', 'sold')");
  });

  it("settles each lot and request only once", () => {
    expect(migration).toContain("flower_id UUID NOT NULL UNIQUE");
    expect(migration).toContain("UNIQUE (owner_id, request_key)");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("'replayed', TRUE");
  });

  it("credits cash and reputation in the same transaction", () => {
    expect(migration).toContain("cash_cents = cash_cents + v_payout");
    expect(migration).toContain("reputation = reputation + v_reputation_gain");
    expect(migration).toContain("market_route_unavailable");
  });

  it("keeps mutations behind service-role functions", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_kq_sell_market_lot(UUID, UUID, UUID, TEXT) TO service_role");
  });
});
