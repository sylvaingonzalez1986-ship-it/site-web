import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260904000200_kq_route_masteries.sql"),
  "utf8",
);
const marketBackend = readFileSync(
  join(process.cwd(), "src/lib/supabase/kanab-quest-market-backend.ts"),
  "utf8",
);
const equipmentBackend = readFileSync(
  join(process.cwd(), "src/lib/supabase/kanab-quest-equipment-backend.ts"),
  "utf8",
);
const marketDesk = readFileSync(
  join(process.cwd(), "src/components/placard/KqMarketDesk.tsx"),
  "utf8",
);
const placardHud = readFileSync(
  join(process.cwd(), "src/components/placard/KqPlacardHud.tsx"),
  "utf8",
);

describe("Kanab Quest route mastery persistence", () => {
  it("records one durable aggregate per player and market route", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.kq_player_route_masteries");
    expect(migration).toContain("PRIMARY KEY (user_id, route)");
    expect(migration).toContain("first_sale_receipt_id");
    expect(migration).toContain("best_jury_score");
    expect(migration).toContain("sale_count");
    expect(migration).toContain("total_payout_cents");
    expect(migration).toContain("kq_player_route_masteries_read_own");
  });

  it("backfills old sales without manufacturing a new celebration", () => {
    expect(migration).toContain("FROM public.kq_market_sale_receipts");
    expect(migration).toContain("ON CONFLICT (user_id, route) DO NOTHING");
    expect(migration).toContain("first_route_mastery BOOLEAN NOT NULL DEFAULT FALSE");
  });

  it("settles the sale, mastery and pinned-goal completion atomically", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.rpc_kq_sell_market_lot");
    expect(migration).toContain("v_matched_route_plan");
    expect(migration).toContain("planned_route_code = CASE WHEN v_matched_route_plan THEN NULL");
    expect(migration).toContain("INSERT INTO public.kq_player_route_masteries");
    expect(migration).toContain("'matchedPlan', v_matched_route_plan");
    expect(migration).toContain("'masteredRoutes', v_mastered_routes");
    expect(migration).toContain("v_existing.matched_route_plan");
  });

  it("maps the receipt to a same-family next tier and exposes the celebration", () => {
    expect(marketBackend).toContain("getKqNextRouteMasteryGoal");
    expect(marketBackend).toContain("routeMastery?.matchedPlan");
    expect(marketDesk).toContain("Nouvelle filière maîtrisée");
    expect(marketDesk).toContain("Objectif de filière accompli");
    expect(marketDesk).toContain("adoptNextRouteGoal");
    expect(marketDesk).toContain('action: "route-plan"');
  });

  it("keeps mastery visible in the shared snapshot, market and Placard HUD", () => {
    expect(equipmentBackend).toContain('from("kq_player_route_masteries")');
    expect(equipmentBackend).toContain("routeMasteries:");
    expect(marketBackend).toContain("routeMasteries: equipmentShop.routeMasteries");
    expect(marketDesk).toContain("mergeKqRouteMasteryAfterSale");
    expect(marketDesk).toContain("data-mastered={routeMastery ? true : undefined}");
    expect(marketDesk).toContain("Record personnel");
    expect(marketDesk).toContain("getKqRouteExpertiseProgress");
    expect(marketDesk).toContain("Nouveau rang de filière");
    expect(marketDesk).toContain("getKqRouteExpertiseMission");
    expect(marketDesk).toContain("data-mission={missionRoute || undefined}");
    expect(placardHud).toContain('aria-label="Filières maîtrisées"');
    expect(placardHud).toContain("Palmarès permanent");
    expect(placardHud).toContain("KQ_TRANSFORMATION_ROUTE_COUNT");
    expect(placardHud).toContain("mastery.expertise.nextTier");
    expect(placardHud).toContain('aria-label="Mission d’atelier"');
    expect(placardHud).toContain("getKqRoutePlanEquipmentGoal");
    expect(placardHud).toContain("pinExpertiseMission");
    expect(placardHud).toContain('action: "route-plan"');
  });
});
