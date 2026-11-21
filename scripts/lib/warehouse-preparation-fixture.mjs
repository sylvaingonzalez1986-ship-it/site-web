import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = file => readFile(new URL("../../supabase/migrations/" + file + ".sql", import.meta.url), "utf8");
async function definition(file, name) {
  const sql = await migration(file);
  const match = sql.match(new RegExp("CREATE (?:OR REPLACE )?FUNCTION public\\." + name + "\\([\\s\\S]*?\\$\\$;", "i"));
  assert(match, name);
  return match[0];
}

// The care and browser fixtures already provide the wallet and run tables.
// Exercise the deployed stock, station and launch functions on those tables.
export async function installWarehousePreparations(db, { retail = true } = {}) {
  if (!(await db.query("SELECT to_regprocedure('public.kq_care_price(text)') AS price")).rows[0].price) {
    await db.exec(await definition("20261010000100_kq_culture_care","kq_care_price"));
  }
  await db.exec(`ALTER TABLE kq_equipment_wallets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
    ALTER TABLE kq_runs ADD COLUMN IF NOT EXISTS warehouse_zone_id text, ADD COLUMN IF NOT EXISTS campaign_id uuid;
    CREATE TABLE IF NOT EXISTS kq_commerce_accounts(user_id uuid primary key,business_started_at timestamptz);
    CREATE TABLE IF NOT EXISTS kq_warehouse_layouts(user_id uuid primary key,state jsonb);
    SET check_function_bodies=false;`);
  await db.exec(await definition("20261120000600_kq_warehouse_service_stations","kq_warehouse_station_service"));
  await db.exec(await migration("20261121001000_kq_warehouse_preparations"));
  await db.exec(await migration("20261121001010_kq_warehouse_preparation_commands"));
  await db.exec(await definition("20261121001020_kq_warehouse_preparations_runs","kq_warehouse_launch_preparations"));
  await db.exec(await migration("20261121001400_kq_warehouse_injectors"));
  if (retail) {
    await db.exec(await migration("20261122000200_kq_warehouse_retail_supplies"));
    await db.exec(await migration("20261122000310_kq_warehouse_airlock_preparation"));
  }
  await db.exec("SET check_function_bodies=true");
}
