import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calculateKqBusinessDevelopment, type KqBusinessDevelopmentScore } from "./kanab-quest-development";
import { createKqWarehouseStarter, getKqWarehouseQuote, type KqWarehouseState } from "./kanab-quest-warehouse";

function warehouse(width = 1, height = 1): KqWarehouseState {
  const starter = createKqWarehouseStarter();
  return getKqWarehouseQuote({ ...starter,
    zones: starter.zones.map(zone => ({ ...zone, width, height })),
  }, starter).nextState;
}

describe("company turnover, production size and net value", () => {
  it("starts at zero and ignores invalid inputs", () => {
    expect(calculateKqBusinessDevelopment({})).toEqual({ score: 0, production: 0, sales: 0, companyValue: 0, productionAreaM2: 0, companyValueCents: 0 });
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateKqBusinessDevelopment({ productionAreaM2: value, salesTtcCents: value, companyValueCents: value }).score).toBe(0);
    }
  });

  it("scores physical size including fractional legacy tent areas", () => {
    expect([0, 0.81, 1, 1.44, 2.25, 24.5, 49.99, 50, 1000].map(productionAreaM2 =>
      calculateKqBusinessDevelopment({ productionAreaM2 }).production)).toEqual([0, 0, 1, 1, 2, 29, 59, 60, 60]);
  });

  it("adds diminishing settled turnover, capped at 10,000 euros", () => {
    expect([0, 99, 100, 399, 400, 10_000, 999_999, 1_000_000, Number.MAX_SAFE_INTEGER].map(salesTtcCents =>
      calculateKqBusinessDevelopment({ salesTtcCents }).sales)).toEqual([0, 0, 0, 1, 1, 8, 79, 80, 80]);
  });

  it("weights turnover 80, production 60 and company net value 60, capped at 200", () => {
    expect(calculateKqBusinessDevelopment({ productionAreaM2: 25, salesTtcCents: 250_000, companyValueCents: 250_000 }))
      .toEqual({ score: 100, production: 30, sales: 40, companyValue: 30, productionAreaM2: 25, companyValueCents: 250_000 });
    expect(calculateKqBusinessDevelopment({ productionAreaM2: 1000, salesTtcCents: Number.MAX_SAFE_INTEGER, companyValueCents: 1_000_000 }))
      .toEqual({ score: 200, production: 60, sales: 80, companyValue: 60, productionAreaM2: 1000, companyValueCents: 1_000_000 });
  });

  it("floors negative net worth at zero points without hiding the actual liability", () => {
    expect(calculateKqBusinessDevelopment({ companyValueCents: -150_000 }))
      .toMatchObject({ companyValue: 0, score: 0, companyValueCents: -150_000 });
    expect([0, 100, 400, 10_000, 250_000, 999_999, 1_000_000].map(companyValueCents =>
      calculateKqBusinessDevelopment({ companyValueCents }).companyValue)).toEqual([0, 0, 1, 6, 30, 59, 60]);
  });
});

describe("authoritative turnover and installed area SQL", () => {
  let db: PGlite;
  const userId = "11111111-1111-4111-8111-111111111111";
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY,production_units INTEGER);
      CREATE TABLE public.kq_player_equipment(user_id UUID,tent_number INTEGER,equipment_code TEXT,level INTEGER DEFAULT 1,purchase_price_cents INTEGER DEFAULT 0);
      CREATE TABLE public.kq_equipment_catalog(code TEXT PRIMARY KEY,slot TEXT,is_active BOOLEAN DEFAULT true);
      CREATE TABLE public.kq_equipment_loadouts(user_id UUID,tent_number INTEGER,slot TEXT,equipment_code TEXT,PRIMARY KEY(user_id,tent_number,slot));
      CREATE TABLE public.kq_warehouse_layouts(user_id UUID PRIMARY KEY,state JSONB);
      CREATE TABLE public.kq_commerce_accounts(user_id UUID PRIMARY KEY,vat_sales_ttc_cents BIGINT);
      CREATE TABLE public.kq_online_accounts(user_id UUID PRIMARY KEY,site_tier TEXT);
      REVOKE ALL ON public.kq_equipment_wallets,public.kq_player_equipment,public.kq_equipment_catalog,public.kq_equipment_loadouts,
        public.kq_warehouse_layouts,public.kq_commerce_accounts,public.kq_online_accounts FROM PUBLIC,anon,authenticated,service_role;
    `);
    const catalog = readFileSync("supabase/migrations/20261012000900_kq_warehouse_equipment_tiers.sql", "utf8");
    await db.exec(catalog.slice(catalog.indexOf("CREATE FUNCTION public.kq_warehouse_device"), catalog.indexOf("CREATE OR REPLACE FUNCTION")));
    await db.exec(readFileSync("scripts/fixtures/kq-company-valuation-schema.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014000000_kq_company_valuation.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014000100_kq_business_development_score.sql", "utf8"));
  }, 30_000);
  beforeEach(async () => {
    await db.exec("TRUNCATE public.kq_equipment_wallets,public.kq_player_equipment,public.kq_equipment_catalog,public.kq_equipment_loadouts,public.kq_warehouse_layouts,public.kq_commerce_accounts,public.kq_online_accounts");
  });
  afterAll(async () => { await db?.close(); });

  async function setWarehouse(state: KqWarehouseState) {
    await db.query("INSERT INTO public.kq_warehouse_layouts VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state", [userId, state]);
  }
  async function setTurnover(value: number | string) {
    await db.query("INSERT INTO public.kq_commerce_accounts VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET vat_sales_ttc_cents=EXCLUDED.vat_sales_ttc_cents", [userId, value]);
  }
  async function score() {
    return (await db.query<{ value: KqBusinessDevelopmentScore }>("SELECT public.kq_business_development_score($1) AS value", [userId])).rows[0].value;
  }
  async function legacyTents() {
    await db.query("INSERT INTO public.kq_equipment_wallets(user_id,production_units) VALUES($1,2)", [userId]);
    await db.exec(`INSERT INTO public.kq_equipment_catalog(code,slot) VALUES
      ('TENT-080-STARTER','tent'),('TENT-120','tent'),('TENT-150','tent'),('LED','lighting'),('AIR','air'),('PRESS','press');`);
    for (const [tentNumber, tentCode] of [[1, "TENT-080-STARTER"], [2, "TENT-120"]] as const) {
      for (const [slot, code] of [["tent", tentCode], ["lighting", "LED"], ["air", "AIR"]]) {
        await db.query("INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code) VALUES($1,$2,$3)", [userId, tentNumber, code]);
        await db.query("INSERT INTO public.kq_equipment_loadouts VALUES($1,$2,$3,$4)", [userId, tentNumber, slot, code]);
      }
    }
  }

  it("matches both formulas for starter, expanded and capped companies", async () => {
    expect(await score()).toEqual(calculateKqBusinessDevelopment({}));
    for (const [width, height, salesTtcCents] of [[1, 1, 100], [5, 5, 250_000], [10, 5, 1_000_000]]) {
      await setWarehouse(warehouse(width, height));
      await setTurnover(salesTtcCents);
      await db.query("INSERT INTO public.kq_equipment_wallets(user_id,cash_cents) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET cash_cents=EXCLUDED.cash_cents", [userId, salesTtcCents]);
      expect(await score()).toEqual(calculateKqBusinessDevelopment({ productionAreaM2: width * height, salesTtcCents, companyValueCents: salesTtcCents }));
    }
    await setTurnover("9223372036854775807");
    expect((await score()).sales).toBe(80);
  });

  it("counts paused equipped production, excluding services, spare equipment and unused floor", async () => {
    const state = warehouse(5, 5);
    state.preparedAreaM2 = 100;
    state.zones[0].active = false;
    state.equipment.push({ code: "SIM-LIGHT-03", quantity: 100 });
    await setWarehouse(state);
    expect(await score()).toEqual(calculateKqBusinessDevelopment({ productionAreaM2: 25 }));
    await setWarehouse({ ...state, zones: [] });
    expect((await score()).production).toBe(0);
  });

  it("excludes unfunded or insufficiently equipped plans, including shared-device shortages", async () => {
    const state = warehouse(5, 5);
    for (const invalid of [
      { ...state, preparedAreaM2: 0 },
      { ...state, preparedAreaM2: 25 },
      { ...state, equipment: state.equipment.filter(item => item.code !== "MH-TS1000") },
      { ...state, zones: [state.zones[0], { ...state.zones[0], id: "second", x: 5 }], preparedAreaM2: 52 },
    ]) {
      await setWarehouse(invalid);
      expect((await score()).production).toBe(0);
    }
  });

  it("uses installed owned legacy tents once and ignores spare tents or machine upgrades", async () => {
    await legacyTents();
    expect(await score()).toEqual(calculateKqBusinessDevelopment({ productionAreaM2: 2.25 }));
    await db.query("INSERT INTO public.kq_player_equipment(user_id,tent_number,equipment_code,level) VALUES($1,1,'TENT-150',10),($1,1,'PRESS',10)", [userId]);
    await db.exec("UPDATE public.kq_player_equipment SET level=10,purchase_price_cents=999999");
    await db.query("INSERT INTO public.kq_online_accounts VALUES($1,'pro')", [userId]);
    expect((await score()).productionAreaM2).toBe(2.25);
    expect((await score()).score).toBe(2);
    await db.query("DELETE FROM public.kq_player_equipment WHERE user_id=$1 AND tent_number=2 AND equipment_code='AIR'", [userId]);
    expect((await score()).productionAreaM2).toBe(0.81);
  });

  it("replaces archived legacy tents with the current warehouse, even when empty", async () => {
    await legacyTents();
    await setWarehouse(warehouse());
    expect((await score()).productionAreaM2).toBe(1);
    await setWarehouse({ ...warehouse(), zones: [] });
    expect((await score()).productionAreaM2).toBe(0);
  });

  it("does not reward warehouse device tiers without extra production area", async () => {
    const state = warehouse(5, 5);
    await setWarehouse(state);
    const original = await score();
    await setWarehouse(getKqWarehouseQuote({ ...state,
      zones: state.zones.map(zone => ({ ...zone, lightingCode: "SIM-LIGHT-03", airCode: "SIM-AIR-03" })),
    }, state).nextState);
    expect(await score()).toEqual(original);
  });

  it("permits only the service role to read the score without exposing private sources", async () => {
    await setWarehouse(warehouse(5, 5));
    await setTurnover(250_000);
    for (const role of ["anon", "authenticated", "service_role"]) {
      const rights = (await db.query<{ execute: boolean; read: boolean }>(`
        SELECT has_function_privilege($1,'public.kq_business_development_score(uuid)','EXECUTE') AS execute,
         has_table_privilege($1,'public.kq_warehouse_layouts','SELECT') AS read`, [role])).rows[0];
      expect(rights).toEqual({ execute: role === "service_role", read: false });
    }
    await db.exec("SET ROLE service_role");
    try { expect((await score()).score).toBe(70); } finally { await db.exec("RESET ROLE"); }
  });
});
