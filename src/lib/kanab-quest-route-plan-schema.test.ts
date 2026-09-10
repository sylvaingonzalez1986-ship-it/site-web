import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260904000100_kq_equipment_route_goal.sql"),
  "utf8",
);
const backend = readFileSync(
  join(process.cwd(), "src/lib/supabase/kanab-quest-equipment-backend.ts"),
  "utf8",
);
const playerRoute = readFileSync(
  join(process.cwd(), "src/app/api/arena/placard/equipment/route.ts"),
  "utf8",
);
const placardHud = readFileSync(
  join(process.cwd(), "src/components/placard/KqPlacardHud.tsx"),
  "utf8",
);

describe("Kanab Quest persistent equipment route goal", () => {
  it("stores a valid route and its pivot machine as one nullable pair", () => {
    expect(migration).toContain("planned_route_code TEXT");
    expect(migration).toContain("planned_equipment_code TEXT");
    expect(migration).toContain("CHECK ((planned_route_code IS NULL) = (planned_equipment_code IS NULL))");
    expect(migration).toContain("FOREIGN KEY (planned_equipment_code) REFERENCES public.kq_equipment_catalog(code)");
  });

  it("keeps goal mutations behind a service-role RPC and a customer-scoped route", () => {
    expect(migration).toContain("rpc_kq_set_equipment_route_plan");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("TO service_role");
    expect(backend).toContain("setKqEquipmentRoutePlan");
    expect(backend).toContain("route.requiredUnlocks.some");
    expect(playerRoute).toContain('payload.action === "route-plan"');
    expect(playerRoute).toContain("session.customerId");
  });

  it("returns the saved goal with the equipment shop snapshot", () => {
    expect(backend).toContain("planned_route_code,planned_equipment_code");
    expect(backend).toContain("export async function getKqEquipmentRoutePlan");
    expect(backend).toContain("parseKqEquipmentRoutePlan");
    expect(backend).toContain(".maybeSingle()");
    expect(backend).toContain("routePlan,");
  });

  it("lets the recommended expertise mission become the persisted route goal", () => {
    expect(placardHud).toContain("getKqRoutePlanEquipmentGoal");
    expect(placardHud).toContain("pinExpertiseMission");
    expect(placardHud).toContain('action: "route-plan"');
    expect(placardHud).toContain("missionEquipmentGoal.equipmentCode");
  });
});
