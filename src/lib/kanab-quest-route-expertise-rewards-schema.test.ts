import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260905000100_kq_route_expertise_rewards.sql"),
  "utf8",
);
const marketBackend = readFileSync(
  join(process.cwd(), "src/lib/supabase/kanab-quest-market-backend.ts"),
  "utf8",
);
const marketDesk = readFileSync(
  join(process.cwd(), "src/components/placard/KqMarketDesk.tsx"),
  "utf8",
);
const economyReview = readFileSync(
  join(process.cwd(), "src/components/admin/AdminPlacardEconomyReview.tsx"),
  "utf8",
);

describe("Kanab Quest route expertise rewards", () => {
  it("freezes the route sale number and bonus in every idempotent receipt", () => {
    expect(migration).toContain("route_sale_count INTEGER NOT NULL DEFAULT 1");
    expect(migration).toContain("expertise_bonus_reputation INTEGER NOT NULL DEFAULT 0");
    expect(migration).toContain("ROW_NUMBER() OVER");
    expect(migration).toContain("'routeSales', v_existing.route_sale_count");
    expect(migration).toContain("'expertiseBonusReputation', v_existing.expertise_bonus_reputation");
  });

  it("grants milestone reputation only to transformation routes", () => {
    expect(migration).toContain("'dry-sift', 'static-sift', 'ice-water-hash', 'hash-signature'");
    expect(migration).toContain("WHEN 3 THEN 5");
    expect(migration).toContain("WHEN 6 THEN 12");
    expect(migration).toContain("WHEN 10 THEN 25");
    expect(migration).toContain("v_reputation_gain := v_base_reputation_gain + v_expertise_bonus_reputation");
    expect(migration).toContain("reputation = reputation + v_reputation_gain");
  });

  it("returns the authoritative bonus and explains it before and after settlement", () => {
    expect(marketBackend).toContain("expertiseBonusReputation: Math.max");
    expect(marketDesk).toContain("getKqRouteExpertiseBonusReputation");
    expect(marketDesk).toContain("Prime de palier sur cette vente");
    expect(marketDesk).toContain("Prime de rang");
    expect(marketDesk).toContain("saleReceipt.routeMastery.expertiseBonusReputation");
  });

  it("exposes the milestone simulation in the read-only admin balance table", () => {
    expect(economyReview).toContain("routeSaleCount");
    expect(economyReview).toContain("report.expertise.milestones");
    expect(economyReview).toContain("projection.expertiseBonusReputation");
    expect(economyReview).toContain("projection.totalReputationGain");
    expect(economyReview).toContain("bonus expertise aux ventes 3, 6 et 10");
  });
});
