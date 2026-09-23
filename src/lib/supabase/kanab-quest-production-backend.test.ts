import { beforeEach, describe, expect, it, vi } from "vitest";
const { createSupabaseServiceClient } = vi.hoisted(() => ({ createSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));
import { expandKqProduction, getKqEquipmentShopSnapshot } from "./kanab-quest-equipment-backend";
import { getKqEquipmentDefinition } from "../kanab-quest-equipment";
import { getKqMachineCondition } from "../kanab-quest-maintenance";
import { getKqCultureEquipmentCondition } from "../kanab-quest-culture-wear";
const input = { userId:"11000000-0000-4000-8000-000000000001", requestKey:"11000000-0000-4000-8000-000000000002", expectedUnits:1, expectedCostCents:30000 };

describe("production backend", () => {
  beforeEach(() => createSupabaseServiceClient.mockReset());
  it("sends confirmed units and price to the atomic transaction", async () => {
    const rpc=vi.fn().mockResolvedValue({data:{productionUnits:2,priceCents:30000,replayed:false},error:null});
    createSupabaseServiceClient.mockReturnValue({rpc});
    expect(await expandKqProduction(input)).toMatchObject({productionUnits:2,priceCents:30000});
    expect(rpc).toHaveBeenCalledWith("rpc_kq_expand_production",{p_user_id:input.userId,p_request_key:input.requestKey,p_expected_units:1,p_expected_cost_cents:30000});
  });
  it.each([0,1.5,5,8,Infinity])("rejects invalid expansion from %s before spending", async expectedUnits => {
    await expect(expandKqProduction({...input,expectedUnits})).rejects.toThrow("invalide");
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });
  it.each([0,-1,0.5,2147483648,NaN])("rejects an invalid confirmed price %s", async expectedCostCents => {
    await expect(expandKqProduction({...input,expectedCostCents})).rejects.toThrow("invalide");
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });
  it.each([
    ["production_active_run","Termine la culture"],
    ["production_units_changed","installation a changé"],
    ["production_price_changed","prix du matériel a changé"],
    ["production_insufficient_cash","Trésorerie insuffisante"],
    ["production_equipment_maintenance","Remplace ou répare"],
  ])("translates %s into a gameplay error", async (code, message) => {
    createSupabaseServiceClient.mockReturnValue({rpc:vi.fn().mockResolvedValue({error:{message:code}})});
    await expect(expandKqProduction(input)).rejects.toThrow(message);
  });
  it("returns fleet prices for the catalog, maintenance and culture replacement", async () => {
    const rows:Record<string,unknown>={
      kq_equipment_wallets:{cash_cents:1000000,reputation:0,production_units:4},
      kq_player_equipment:[{equipment_code:"LED-300",purchase_price_cents:35900,level:3,culture_wear_percent:50},{equipment_code:"WASHER-25L",purchase_price_cents:125000,level:2,wear_cycles:10}],
      kq_equipment_loadouts:[{equipment_code:"LED-300"}],
    };
    createSupabaseServiceClient.mockReturnValue({rpc:vi.fn().mockResolvedValue({error:null}),from:(table:string)=>{
      const query={select:()=>query,eq:()=>query,order:()=>query,single:()=>query,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:rows[table]??[],error:null,count:0}).then(resolve)};
      return query;
    }});
    const snapshot=await getKqEquipmentShopSnapshot(input.userId);
    expect(snapshot.productionUnits).toBe(4);
    expect(snapshot.production.nextUnits).toBe(8);
    expect(snapshot.catalog.find(item=>item.code==="LED-300")?.priceCents).toBe(getKqEquipmentDefinition("LED-300")!.priceCents*4);
    expect(snapshot.maintenance?.["WASHER-25L"].repairCents).toBe(getKqMachineCondition("WASHER-25L",2,10)!.repairCents*4);
    expect(snapshot.cultureWear?.["LED-300"].replacementCents).toBe(getKqCultureEquipmentCondition("LED-300",3,50)!.replacementCents*4);
    expect(snapshot.cultureWear?.["LED-300"].wearPercent).toBe(50);
  });
});
